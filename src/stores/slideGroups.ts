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
 * NEVER use addDoc here. Every group document's id IS the anchoring slot's
 * stable id (D-01) — a deterministic doc id, not a random auto-id — so that
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

  return {
    groups,
    isLoading,
    groupsBySlotId,
    subscribeGroups,
    unsubscribeGroups,
  }
})
