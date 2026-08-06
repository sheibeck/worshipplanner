import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  query,
  orderBy,
  deleteField,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { stripUndefined } from '@/utils/stripUndefined'
import type { SlideGroup, SlideGroupInput, GroupSlideEntry } from '@/types/slideGroup'

/**
 * Pinia store for slide groups (Phase 24). Mirrors useImportedSlides /
 * useScriptureSlides (src/stores/importedSlides.ts, src/stores/scriptureSlides.ts)
 * against the organizations/{orgId}/slideGroups sibling collection, with `slides`
 * as an EMBEDDED ARRAY field (never a nested subcollection — see src/types/slideGroup.ts).
 *
 * This is the ONLY module in the phase that talks to Firestore about groups —
 * every group write (materialize, delete, bed media, slide replace) lives here
 * so a second, competing save path never appears next to ServiceEditorView's
 * existing whole-document autosave (R018).
 *
 * NEVER use the random-auto-id create function here. Every group document's id
 * IS the anchoring slot's stable id (D-01) — a deterministic doc id — so that
 * lazy materialization from two simultaneously-open tabs can never create two
 * divergent documents for the same slot (RESEARCH.md Pattern 1).
 */
export const useSlideGroups = defineStore('slideGroups', () => {
  const groups = ref<SlideGroup[]>([])
  const isLoading = ref(true)

  let unsubscribeFn: Unsubscribe | null = null

  const groupsBySlotId = computed<Map<string, SlideGroup>>(() => {
    const map = new Map<string, SlideGroup>()
    for (const group of groups.value) {
      map.set(group.slotId, group)
    }
    return map
  })

  function subscribeGroups(orgId: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    isLoading.value = true
    const q = query(
      collection(db, 'organizations', orgId, 'slideGroups'),
      orderBy('updatedAt', 'desc'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      groups.value = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return { id: d.id, ...data } as SlideGroup
      })
      isLoading.value = false
    })
  }

  function unsubscribeGroups() {
    unsubscribeFn?.()
    unsubscribeFn = null
    groups.value = []
    isLoading.value = true
  }

  /**
   * Create the group document for `input.slotId` if (and only if) it does not
   * already exist. Resolves `true` when this call created the document, `false`
   * when a document already existed (no write performed).
   *
   * The document id IS the slot id (D-01, RESEARCH.md Pattern 1) — deliberately
   * never the random-auto-id create function, so two tabs racing to
   * first-materialize the same slot can only ever produce a harmless
   * overwrite-with-equivalent-content, never two divergent documents. No
   * `runTransaction`, mutex, or check-then-create retry loop is used here —
   * RESEARCH.md's "Don't Hand-Roll" section rules those out as unnecessary
   * complexity for a race whose worst case is an overwrite.
   *
   * `input` carries no bed by default (D-19 — the slot-media migration is
   * gone; a freshly materialized group always starts with no bed) and lands
   * in this SAME `setDoc` as the slides. The bed is audio-only (D-18) —
   * there is no video bed field.
   *
   * CR-01 (asymmetric WR-01 fix): this create is now ALSO `{ merge: true }`.
   * `setGroupBedMedia`'s skeleton-create was made a merge write specifically
   * because it races this function — both independently `getDoc` the same
   * not-yet-existing doc and, on absence, `setDoc`. Only guarding
   * `setGroupBedMedia`'s half left this function's plain, non-merge `setDoc`
   * able to win the race and silently erase a `bedAudioUrl` a user had JUST
   * attached (a concurrently-landing bed-media skeleton write's `bedAudioUrl`
   * key, which is absent from `input`, would otherwise be wiped by a full
   * replace). Since this branch only ever runs when `getDoc` found NO
   * existing document, `merge: true` is a no-op in the ordinary
   * (non-racing) case — it changes behavior ONLY inside the race window.
   * `slides` (and every other key `input` carries) IS present in this
   * payload, so merge does not preserve a stale `slides` array here — Firestore
   * merge only preserves EXISTING top-level keys the incoming payload omits;
   * `slides` is always authoritatively replaced by `input.slides` because the
   * key is always present in this write. Only `bedAudioUrl` (absent from
   * `input`, D-19) can ever survive from a racing write.
   */
  async function materializeGroupIfMissing(
    orgId: string,
    input: SlideGroupInput,
  ): Promise<boolean> {
    const ref = doc(db, 'organizations', orgId, 'slideGroups', input.slotId)
    const existing = await getDoc(ref)
    if (existing.exists()) return false
    await setDoc(
      ref,
      {
        ...stripUndefined(input),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    return true
  }

  /**
   * The R029 cascade target: 24-06's slot-delete handler calls this alongside
   * removing the slot from `service.slots`. Firestore's `deleteDoc` on a
   * missing document is a no-op (resolves without error), so no existence
   * guard is added here — do not add a defensive `getDoc` before this call.
   */
  async function deleteGroup(orgId: string, slotId: string): Promise<void> {
    await deleteDoc(doc(db, 'organizations', orgId, 'slideGroups', slotId))
  }

  interface BedMediaPatch {
    serviceId: string
    bedAudioUrl?: string
    clearAudio?: boolean
  }

  /**
   * Scoped bed-media write (mirrors services.ts::setRoleOverride's scoped
   * dot-path precedent) — touches only the bed field being changed plus
   * `updatedAt`, never the whole document. The bed is audio-only (D-18) — no
   * bed video path exists. An explicit `clearAudio` flag is used (rather than
   * "an undefined url means clear") because `stripUndefined()` would
   * otherwise erase that intent before it reached Firestore —
   * `deleteField()` is the only way to actually remove a field.
   *
   * If the group has not materialized yet, creates a skeleton document
   * (`slotId`, `serviceId`, `slides: []`, the supplied bed field, both server
   * timestamps) so attaching media to a slot with no group yet cannot throw.
   *
   * WR-01: this skeleton create races `materializeGroupIfMissing` — both
   * functions independently `getDoc` the same not-yet-existing doc and, on
   * absence, `setDoc`. If a user attaches bed media in the same round-trip
   * window as first materialization, whichever write lands last would win
   * outright under a plain (non-merge) `setDoc`, and since this skeleton's
   * payload always carries `slides: []`, landing after materialization's
   * fully-populated write would silently reset the group's real derived
   * `slides` back to empty. `{ merge: true }` makes this create idempotent
   * against that race: a concurrently-landing `materializeGroupIfMissing`
   * write's `slides` field is preserved rather than clobbered by this
   * skeleton's empty array.
   */
  async function setGroupBedMedia(
    orgId: string,
    slotId: string,
    patch: BedMediaPatch,
  ): Promise<void> {
    const ref = doc(db, 'organizations', orgId, 'slideGroups', slotId)
    const existing = await getDoc(ref)

    if (existing.exists()) {
      const update: Record<string, unknown> = { updatedAt: serverTimestamp() }
      if (patch.clearAudio) update.bedAudioUrl = deleteField()
      else if (patch.bedAudioUrl !== undefined) update.bedAudioUrl = patch.bedAudioUrl
      await updateDoc(ref, update)
      return
    }

    await setDoc(
      ref,
      {
        ...stripUndefined({
          id: slotId,
          slotId,
          serviceId: patch.serviceId,
          slides: [],
          bedAudioUrl: patch.bedAudioUrl,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  interface GroupBackgroundPatch {
    serviceId: string
    backgroundImageUrl?: string
    clearBackground?: boolean
  }

  /**
   * Scoped group-background write (R055) — structurally mirrors
   * `setGroupBedMedia` above exactly rather than extending its patch type: the
   * same existence check, the same single-field `updateDoc` on the existing
   * branch, the same explicit `clearBackground` flag (an undefined url would
   * be stripped by `stripUndefined()` before the intent reached Firestore —
   * `deleteField()` is the only way to actually remove the field), and the
   * same merging skeleton `setDoc` on the missing branch for the identical
   * WR-01 race reason documented on `setGroupBedMedia`.
   *
   * Touches only `backgroundImageUrl` and `updatedAt` on the existing-doc
   * branch — never `slides`, never `bedAudioUrl`. Setting a group's
   * background must never overwrite or clear any slide's own background (the
   * R055 adjacency truth) — this function reads and writes nothing about
   * `slides` at all.
   */
  async function setGroupBackground(
    orgId: string,
    slotId: string,
    patch: GroupBackgroundPatch,
  ): Promise<void> {
    const ref = doc(db, 'organizations', orgId, 'slideGroups', slotId)
    const existing = await getDoc(ref)

    if (existing.exists()) {
      const update: Record<string, unknown> = { updatedAt: serverTimestamp() }
      if (patch.clearBackground) update.backgroundImageUrl = deleteField()
      else if (patch.backgroundImageUrl !== undefined) update.backgroundImageUrl = patch.backgroundImageUrl
      await updateDoc(ref, update)
      return
    }

    await setDoc(
      ref,
      {
        ...stripUndefined({
          id: slotId,
          slotId,
          serviceId: patch.serviceId,
          slides: [],
          backgroundImageUrl: patch.backgroundImageUrl,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  /**
   * The apply half of reconciliation — writes only `slides`/`sourceSignature`/
   * `updatedAt`, never a bed field. The decision of WHETHER to apply a
   * reconciled slide list lives in 24-03's pure functions and 24-05's
   * composable, never here.
   *
   * CR-02: every call site (add-slide, import, video-append, drag-reorder in
   * `SlideGrid.vue`, and the reconciliation watcher in
   * `useSlideshowAssembly.ts`) reads a LOCAL snapshot of the group's current
   * `entries`/`slides` BEFORE computing its own next `slides` array, with no
   * shared in-process lock across those independent call sites. A plain
   * `updateDoc` here is therefore a last-write-wins race — a fast
   * double-click on "+ Add slide", or an append racing a drag-reorder, would
   * silently discard whichever write lands first.
   *
   * `baseSlides` — the snapshot the CALLER actually started from before
   * computing `slides` — turns this into a `runTransaction` compare-and-swap:
   * inside the transaction we read the LIVE document and diff it against
   * `baseSlides` by entry id. Any entry present on the live document but
   * absent from BOTH `baseSlides` and the caller's own `slides` payload was
   * added by a different, concurrent write that landed after this caller
   * read `baseSlides` — it is re-appended onto the caller's payload instead
   * of being silently overwritten. This closes both the append-vs-append race
   * (two callers computing the same "append one entry" delta from the same
   * stale base) and the append-vs-reorder race (a reorder's full-array
   * overwrite landing after a concurrent append), because whichever write
   * loses the commit race re-derives against the OTHER write's already-landed
   * result rather than blindly replacing it.
   *
   * 26-REVIEW CR-02: this also reconciles a concurrent DELETION (Phase 26
   * ships the first delete-a-slide path, `EditSlideDrawer.vue`'s Delete Slide
   * action). `mergeConcurrentlyAddedEntries` strips any entry that this
   * caller's stale `next` still carries (derived from `base`, which had not
   * yet observed the deletion) but that is absent from the live document —
   * without this, a slower stale-base write (e.g. a debounced label/notes
   * edit scheduled before the delete, committing after it) would silently
   * resurrect the slide the user explicitly deleted. This does not re-derive
   * a drag-reorder's index math against a changed live array — reordering
   * still only recovers/strips entries by id, never recomputes positions
   * against a live array it never saw. `baseSlides` is optional: omitting it
   * keeps the previous plain-overwrite behavior for any caller that has not
   * been updated to track a base snapshot.
   *
   * 38-REVIEW CR-01: `sourceSignature` is a tri-state, mirroring
   * `setGroupBedMedia`'s `clearAudio` precedent (documented above) — an
   * `undefined` value means "no opinion, leave the stored field alone" and is
   * simply omitted from the write (via `stripUndefined`, as before); an
   * explicit `null` means "clear this field" and is written as a real
   * `deleteField()` sentinel, because `stripUndefined` cannot distinguish
   * "no opinion" from "clear" for a plain `undefined`. Only
   * `rebuildScriptureGroup`'s CLEARED REFERENCE branch (via
   * `useSlideshowAssembly.ts`'s `freshSignature`) passes `null` today — the
   * one rebuild path that empties a Congregational group's derived slides
   * without any reference left to sign, where leaving the OLD signature
   * stored would let a later identical re-entry hit the DETACHED
   * short-circuit against a permanently-empty `slides` array.
   */
  async function replaceGroupSlides(
    orgId: string,
    slotId: string,
    slides: GroupSlideEntry[],
    sourceSignature?: string | null,
    baseSlides?: GroupSlideEntry[],
  ): Promise<void> {
    const ref = doc(db, 'organizations', orgId, 'slideGroups', slotId)
    const signatureField: Record<string, unknown> =
      sourceSignature === null
        ? { sourceSignature: deleteField() }
        : sourceSignature !== undefined
          ? { sourceSignature }
          : {}

    if (!baseSlides) {
      await updateDoc(ref, {
        ...stripUndefined({ slides }),
        ...signatureField,
        updatedAt: serverTimestamp(),
      })
      return
    }

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const liveSlides = (snap.exists() ? (snap.data() as Record<string, unknown>).slides : undefined) as
        | GroupSlideEntry[]
        | undefined
      const merged = mergeConcurrentlyAddedEntries(baseSlides, liveSlides ?? [], slides)
      tx.update(ref, {
        ...stripUndefined({ slides: merged }),
        ...signatureField,
        updatedAt: serverTimestamp(),
      })
    })
  }

  /**
   * CR-02 helper: entries present on the LIVE document but absent from both
   * the caller's own snapshot (`base`) and its computed payload (`next`) were
   * added by a concurrent write that landed after `base` was read — append
   * them rather than let `next`'s write silently erase them. Reassigns
   * `order` to trail whatever `next` already contains so the recovered
   * entries sort after it; ids are never regenerated (invariant 2,
   * `slideGroup.ts`).
   *
   * CR-02 fix: this function must ALSO recognize a concurrent *deletion*, not
   * just a concurrent addition. `next` is always derived from `base`
   * (`base.map(...)` / `base.filter(...)`), so a caller whose own write has
   * nothing to do with a given entry still carries that entry in `next`
   * (present in both `base` and `next`) even after a different writer has
   * since deleted it (absent from `live`). Left unchecked, this caller's
   * commit would resurrect the deleted entry. An entry present in `base` AND
   * still present in `next` (this caller did not itself intend to remove it)
   * but MISSING from `live` (a concurrent writer's delete already landed) is
   * therefore stripped before the concurrently-added entries are appended. An
   * entry this caller itself intentionally removed (present in `base`,
   * absent from `next`) is untouched by this filter either way — it was
   * never a candidate for resurrection in the first place.
   */
  function mergeConcurrentlyAddedEntries(
    base: GroupSlideEntry[],
    live: GroupSlideEntry[],
    next: GroupSlideEntry[],
  ): GroupSlideEntry[] {
    const baseIds = new Set(base.map((e) => e.id))
    const liveIds = new Set(live.map((e) => e.id))
    const nextIds = new Set(next.map((e) => e.id))

    // Drop any entry this caller's `next` still carries only because it was
    // derived from a now-stale `base` — a concurrent writer already deleted
    // it (absent from `live`) before this caller's own write landed.
    const withoutConcurrentlyDeleted = next.filter((e) => !baseIds.has(e.id) || liveIds.has(e.id))

    const concurrentlyAdded = live.filter((e) => !baseIds.has(e.id) && !nextIds.has(e.id))
    if (concurrentlyAdded.length === 0) return withoutConcurrentlyDeleted
    const maxOrder = withoutConcurrentlyDeleted.reduce((max, e) => Math.max(max, e.order), -1)
    return [
      ...withoutConcurrentlyDeleted,
      ...concurrentlyAdded.map((entry, i) => ({ ...entry, order: maxOrder + 1 + i })),
    ]
  }

  return {
    groups,
    isLoading,
    groupsBySlotId,
    subscribeGroups,
    unsubscribeGroups,
    materializeGroupIfMissing,
    deleteGroup,
    setGroupBedMedia,
    setGroupBackground,
    replaceGroupSlides,
  }
})
