import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { db, storage } from '@/firebase'
import type { Vamp, UpsertVampInput } from '@/types/vamp'

/** R435/R436 — org-scoped Vamps library store. Narrowed mirror of
 * songs.ts: no legacy-field normalization, no tag/VW-type/import machinery,
 * and a single-slot attachment write (no arrayUnion) — see 140-PATTERNS.md. */
export const useVampStore = defineStore('vamps', () => {
  const vamps = ref<Vamp[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)
  const searchQuery = ref('')

  let unsubscribeFn: Unsubscribe | null = null

  function subscribe(orgIdValue: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    orgId.value = orgIdValue
    const q = query(
      collection(db, 'organizations', orgIdValue, 'vamps'),
      orderBy('name'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      vamps.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vamp)
      isLoading.value = false
    })
  }

  function unsubscribeAll() {
    unsubscribeFn?.()
    unsubscribeFn = null
    orgId.value = null
    vamps.value = []
    isLoading.value = true
  }

  async function addVamp(data: UpsertVampInput): Promise<string | undefined> {
    if (!orgId.value) return undefined
    const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'vamps'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }

  async function updateVamp(id: string, data: Partial<UpsertVampInput>) {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'vamps', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  // Single-step hard delete (locked decision — no soft-delete/restore). The
  // Storage cascade is best-effort: a failed deleteObject is logged and
  // never aborts the doc delete, mirroring hardDeleteSong's convention.
  async function deleteVamp(id: string) {
    if (!orgId.value) return
    const vamp = vamps.value.find((v) => v.id === id)
    if (vamp?.attachment?.storagePath) {
      try {
        await deleteObject(storageRef(storage, vamp.attachment.storagePath))
      } catch (err) {
        console.error(`deleteVamp: failed to delete attachment ${vamp.attachment.storagePath}:`, err)
      }
    }
    await deleteDoc(doc(db, 'organizations', orgId.value, 'vamps', id))
  }

  const filteredVamps = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return vamps.value
    return vamps.value.filter(
      (v) => v.name.toLowerCase().includes(q) || v.key.toLowerCase().includes(q),
    )
  })

  return {
    vamps,
    isLoading,
    orgId,
    searchQuery,
    filteredVamps,
    subscribe,
    unsubscribeAll,
    addVamp,
    updateVamp,
    deleteVamp,
  }
})
