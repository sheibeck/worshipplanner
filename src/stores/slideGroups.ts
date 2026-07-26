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
   * The caller supplies the already-migrated D-05 bed (bedAudioUrl/bedVideoUrl,
   * read from the slot's deprecated Phase 22 audioUrl/videoUrl) inside `input` —
   * it lands in this SAME `setDoc` as the slides, so a group can never exist in
   * a half-migrated state.
   */
  async function materializeGroupIfMissing(
    orgId: string,
    input: SlideGroupInput,
  ): Promise<boolean> {
    const ref = doc(db, 'organizations', orgId, 'slideGroups', input.slotId)
    const existing = await getDoc(ref)
    if (existing.exists()) return false
    await setDoc(ref, {
      ...stripUndefined(input),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
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
    bedVideoUrl?: string
    clearAudio?: boolean
    clearVideo?: boolean
  }

  /**
   * Scoped bed-media write (mirrors services.ts::setRoleOverride's scoped
   * dot-path precedent) — touches only the bed field(s) being changed plus
   * `updatedAt`, never the whole document. Explicit `clearAudio`/`clearVideo`
   * flags are used (rather than "an undefined url means clear") because
   * `stripUndefined()` would otherwise erase that intent before it reached
   * Firestore — `deleteField()` is the only way to actually remove a field.
   *
   * If the group has not materialized yet, creates a skeleton document
   * (`slotId`, `serviceId`, `slides: []`, the supplied bed field, both server
   * timestamps) so attaching media to a slot with no group yet cannot throw.
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
      if (patch.clearVideo) update.bedVideoUrl = deleteField()
      else if (patch.bedVideoUrl !== undefined) update.bedVideoUrl = patch.bedVideoUrl
      await updateDoc(ref, update)
      return
    }

    await setDoc(ref, {
      ...stripUndefined({
        id: slotId,
        slotId,
        serviceId: patch.serviceId,
        slides: [],
        bedAudioUrl: patch.bedAudioUrl,
        bedVideoUrl: patch.bedVideoUrl,
      }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  /**
   * The apply half of reconciliation — writes only `slides`/`sourceSignature`/
   * `updatedAt`, never a bed field. The decision of WHETHER to apply a
   * reconciled slide list lives in 24-03's pure functions and 24-05's
   * composable, never here.
   *
   * Open Question 1 (RESEARCH.md) resolved: a `GroupSlideEntry` whose
   * `audioScope` is `'group'` is persisted by the Phase 26 UI as a write to
   * the PARENT group's `bedAudioUrl` (via `setGroupBedMedia`) with the
   * entry's own `audioUrl` cleared. The stored `audioScope` value exists only
   * so the drawer can round-trip the toggle's visual state — the assembler
   * never interprets it.
   */
  async function replaceGroupSlides(
    orgId: string,
    slotId: string,
    slides: GroupSlideEntry[],
    sourceSignature?: string,
  ): Promise<void> {
    const ref = doc(db, 'organizations', orgId, 'slideGroups', slotId)
    await updateDoc(ref, {
      ...stripUndefined({ slides, sourceSignature }),
      updatedAt: serverTimestamp(),
    })
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
    replaceGroupSlides,
  }
})
