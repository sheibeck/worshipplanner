import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Quarter, RoleSlotConfig } from '@/types/roster'
import { generateSundaysInQuarter, applyDateAdditionsRemovals } from '@/utils/quarterDates'

export const useQuartersStore = defineStore('quarters', () => {
  const quarters = ref<Quarter[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)

  let unsubscribeFn: Unsubscribe | null = null

  function subscribe(orgIdValue: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    orgId.value = orgIdValue
    const q = query(
      collection(db, 'organizations', orgIdValue, 'quarters'),
      orderBy('createdAt', 'desc'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      quarters.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Quarter)
      isLoading.value = false
    })
  }

  function unsubscribeAll() {
    unsubscribeFn?.()
    unsubscribeFn = null
    orgId.value = null
    quarters.value = []
    isLoading.value = true
  }

  function getQuarter(quarterId: string): Quarter {
    const quarter = quarters.value.find((q) => q.id === quarterId)
    if (!quarter) throw new Error(`Quarter ${quarterId} not found`)
    return quarter
  }

  async function updateQuarter(id: string, data: Record<string, unknown>) {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  async function createQuarter(year: number, quarter: 1 | 2 | 3 | 4, label: string): Promise<string> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'quarters'), {
      label,
      year,
      quarter,
      serviceDates: generateSundaysInQuarter(year, quarter),
      roleOverridesByDate: {},
      personQuarterData: {},
      calendar: {},
      status: 'draft',
      shareToken: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }

  async function addServiceDate(quarterId: string, date: string): Promise<void> {
    const quarter = getQuarter(quarterId)
    const serviceDates = applyDateAdditionsRemovals(quarter.serviceDates, { add: [date] })
    await updateQuarter(quarterId, { serviceDates })
  }

  async function removeServiceDate(quarterId: string, date: string): Promise<void> {
    const quarter = getQuarter(quarterId)
    const serviceDates = applyDateAdditionsRemovals(quarter.serviceDates, { remove: [date] })
    await updateQuarter(quarterId, { serviceDates })
  }

  async function setRoleOverrideForDate(
    quarterId: string,
    date: string,
    config: RoleSlotConfig[],
  ): Promise<void> {
    const quarter = getQuarter(quarterId)
    const roleOverridesByDate = { ...quarter.roleOverridesByDate, [date]: config }
    await updateQuarter(quarterId, { roleOverridesByDate })
  }

  return {
    quarters,
    isLoading,
    orgId,
    subscribe,
    unsubscribeAll,
    createQuarter,
    addServiceDate,
    removeServiceDate,
    setRoleOverrideForDate,
  }
})
