import { ref, computed } from 'vue'
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
import type { ScriptureReading } from '@/types/scriptureReading'

export const useScriptureSlides = defineStore('scriptureSlides', () => {
  const readings = ref<ScriptureReading[]>([])
  const isLoading = ref(true)

  let unsubscribeFn: Unsubscribe | null = null

  const currentReading = computed<ScriptureReading | null>(() =>
    readings.value.length > 0 ? readings.value[0]! : null,
  )

  function subscribeReadings(orgId: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    isLoading.value = true
    const q = query(
      collection(db, 'organizations', orgId, 'scriptureReadings'),
      orderBy('updatedAt', 'desc'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      readings.value = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return { id: d.id, ...data } as ScriptureReading
      })
      isLoading.value = false
    })
  }

  function unsubscribeReadings() {
    unsubscribeFn?.()
    unsubscribeFn = null
    readings.value = []
    isLoading.value = true
  }

  async function createReading(
    orgId: string,
    data: Omit<ScriptureReading, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const docRef = await addDoc(
      collection(db, 'organizations', orgId, 'scriptureReadings'),
      {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    )
    return docRef.id
  }

  async function updateReading(
    orgId: string,
    readingId: string,
    data: Partial<Omit<ScriptureReading, 'id' | 'createdAt' | 'updatedAt'>>,
  ) {
    await updateDoc(
      doc(db, 'organizations', orgId, 'scriptureReadings', readingId),
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
    )
  }

  async function getReading(orgId: string, readingId: string) {
    const snap = await getDoc(
      doc(db, 'organizations', orgId, 'scriptureReadings', readingId),
    )
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as ScriptureReading
  }

  return {
    readings,
    isLoading,
    currentReading,
    subscribeReadings,
    unsubscribeReadings,
    createReading,
    updateReading,
    getReading,
  }
})
