import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { stripUndefined } from '@/utils/stripUndefined'
import type { ImportedDeck } from '@/types/importedDeck'

/**
 * Pinia store for imported PPTX/image decks (Phase 21). Mirrors
 * useScriptureSlides (src/stores/scriptureSlides.ts) against the
 * organizations/{orgId}/importedSlides subcollection.
 */
export const useImportedSlides = defineStore('importedSlides', () => {
  const decks = ref<ImportedDeck[]>([])
  const isLoading = ref(true)

  let unsubscribeFn: Unsubscribe | null = null

  function subscribeDecks(orgId: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    isLoading.value = true
    const q = query(
      collection(db, 'organizations', orgId, 'importedSlides'),
      orderBy('updatedAt', 'desc'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      decks.value = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return { id: d.id, ...data } as ImportedDeck
      })
      isLoading.value = false
    })
  }

  function unsubscribeDecks() {
    unsubscribeFn?.()
    unsubscribeFn = null
    decks.value = []
    isLoading.value = true
  }

  async function createDeck(
    orgId: string,
    data: Omit<ImportedDeck, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const docRef = await addDoc(
      collection(db, 'organizations', orgId, 'importedSlides'),
      {
        // stripUndefined: Firestore rejects any `undefined` field (e.g. title-less slides).
        ...stripUndefined(data),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    )
    return docRef.id
  }

  async function updateDeck(
    orgId: string,
    importId: string,
    data: Partial<Omit<ImportedDeck, 'id' | 'createdAt' | 'updatedAt'>>,
  ) {
    await updateDoc(
      doc(db, 'organizations', orgId, 'importedSlides', importId),
      {
        // stripUndefined: guards the edit path (ImportedSlideEditor) from the same
        // "Unsupported field value: undefined" Firestore rejection as the import path.
        ...stripUndefined(data),
        updatedAt: serverTimestamp(),
      },
    )
  }

  async function getDeck(orgId: string, importId: string) {
    const snap = await getDoc(
      doc(db, 'organizations', orgId, 'importedSlides', importId),
    )
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as ImportedDeck
  }

  return {
    decks,
    isLoading,
    subscribeDecks,
    unsubscribeDecks,
    createDeck,
    updateDeck,
    getDeck,
  }
})
