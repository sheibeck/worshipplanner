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
 * See .planning/codebase/STACK.md (Store & Entry-Point Stack Notes (R318) ->
 * src/stores/slideGroups.ts).
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
    * See ADR-0167 (docs/adr/0167-input-carries-no-bed-by-default-d-19-the-slot-media-migratio.md)
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
    * See ADR-0168 (docs/adr/0168-deletefield-is-the-only-way-to-actually-remove-a-field-if-th.md)
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

  /** See ADR-0168 (docs/adr/0168-deletefield-is-the-only-way-to-actually-remove-a-field-if-th.md) */
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
   * See ADR-0169 (docs/adr/0169-helper-entries-present-on-the-live-document-but-absent-from.md)
   *
   * `baseSlides` — the snapshot the CALLER actually started from before
   * computing `slides` — turns this into a `runTransaction` compare-and-swap:
   * inside the transaction we read the LIVE document and diff it against
   * `baseSlides` by entry id. Any entry present on the live document but
   * absent from BOTH `baseSlides` and the caller's own `slides` payload was
   * added by a different, concurrent write that landed after this caller
   * read `baseSlides` — it is re-appended onto the caller's payload instead
   * of being silently overwritten. This closes both the append-vs-append race
    * See ADR-0170 (docs/adr/0170-two-callers-computing-the-same-append-one-entry-delta-from-t.md)
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

  /** See ADR-0169 (docs/adr/0169-helper-entries-present-on-the-live-document-but-absent-from.md) */
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
