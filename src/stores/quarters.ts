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
import type { Quarter, RoleSlotConfig, PersonQuarterData, ProposeResult, Role } from '@/types/roster'
import { generateSundaysInQuarter, applyDateAdditionsRemovals } from '@/utils/quarterDates'
import { proposeQuarterSchedule } from '@/utils/scheduler'
import { useRosterStore } from '@/stores/roster'

// Payload for applyCsvToQuarter — the Plan 08 UI resolves CSV names→personIds and role-names→roleIds first.
export interface ResolvedCsvPerson {
  personId: string
  standing: { name?: string; email?: string; phone?: string; roles?: string[]; frequencyTargetN?: number }
  blackoutDates: string[]
  pairedWith: string[]
}

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

  // D-19: replace ONLY the CSV-present people's quarter-scoped entries wholesale; standing
  // fields are upserted through the roster store (Pitfall 3). People absent from `rows` keep
  // their existing personQuarterData entry untouched — except for a bidirectional pairing
  // merge below, which only ever adds a partner id to an existing (or fresh) entry.
  async function applyCsvToQuarter(quarterId: string, rows: ResolvedCsvPerson[]): Promise<void> {
    const quarter = getQuarter(quarterId)
    const rosterStore = useRosterStore()

    const personQuarterData: Record<string, PersonQuarterData> = { ...quarter.personQuarterData }

    for (const row of rows) {
      if (Object.keys(row.standing).length > 0) {
        await rosterStore.updatePerson(row.personId, row.standing)
      }
      personQuarterData[row.personId] = {
        personId: row.personId,
        blackoutDates: row.blackoutDates,
        pairedWith: row.pairedWith,
      }
    }

    // Bidirectional pairing: a partner not present in `rows` still gets the reciprocal
    // pairing merged into their (otherwise untouched) entry.
    for (const row of rows) {
      for (const partnerId of row.pairedWith) {
        const partnerEntry = personQuarterData[partnerId] ?? {
          personId: partnerId,
          blackoutDates: [],
          pairedWith: [],
        }
        if (!partnerEntry.pairedWith.includes(row.personId)) {
          personQuarterData[partnerId] = {
            ...partnerEntry,
            pairedWith: [...partnerEntry.pairedWith, row.personId],
          }
        }
      }
    }

    await updateQuarter(quarterId, { personQuarterData })
  }

  function buildResolveRolesForDate(
    quarter: Quarter,
    roles: Role[],
  ): (date: string) => RoleSlotConfig[] {
    const defaultConfig = roles
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((r) => ({ roleId: r.id, count: r.defaultCount }))
    return (date: string) => quarter.roleOverridesByDate[date] ?? defaultConfig
  }

  async function generateProposal(
    quarterId: string,
    mode: 'regenerate' | 'fillGaps',
  ): Promise<ProposeResult> {
    const quarter = getQuarter(quarterId)
    const rosterStore = useRosterStore()
    const resolveRolesForDate = buildResolveRolesForDate(quarter, rosterStore.roles)
    const personQuarterData = Object.values(quarter.personQuarterData)

    const result = proposeQuarterSchedule(
      rosterStore.activePeople,
      quarter.serviceDates,
      resolveRolesForDate,
      personQuarterData,
      mode === 'fillGaps' ? quarter.calendar : undefined,
    )

    await updateQuarter(quarterId, { calendar: result.calendar })
    return result
  }

  // Scoped cell edits — each writes only `calendar.{date}.{roleId}` via Firestore dot-path
  // field update, leaving every other cell in the calendar untouched (D-22).
  async function assignPerson(
    quarterId: string,
    date: string,
    roleId: string,
    personId: string,
  ): Promise<void> {
    if (!orgId.value) return
    const quarter = getQuarter(quarterId)
    const existing = quarter.calendar[date]?.[roleId] ?? []
    if (existing.includes(personId)) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), {
      [`calendar.${date}.${roleId}`]: [...existing, personId],
      updatedAt: serverTimestamp(),
    })
  }

  async function clearAssignment(
    quarterId: string,
    date: string,
    roleId: string,
    personId: string,
  ): Promise<void> {
    if (!orgId.value) return
    const quarter = getQuarter(quarterId)
    const existing = quarter.calendar[date]?.[roleId] ?? []
    await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), {
      [`calendar.${date}.${roleId}`]: existing.filter((id) => id !== personId),
      updatedAt: serverTimestamp(),
    })
  }

  async function swapAssignment(
    quarterId: string,
    date: string,
    roleId: string,
    fromPersonId: string,
    toPersonId: string,
  ): Promise<void> {
    if (!orgId.value) return
    const quarter = getQuarter(quarterId)
    const existing = quarter.calendar[date]?.[roleId] ?? []
    await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), {
      [`calendar.${date}.${roleId}`]: existing.map((id) => (id === fromPersonId ? toPersonId : id)),
      updatedAt: serverTimestamp(),
    })
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
    applyCsvToQuarter,
    buildResolveRolesForDate,
    generateProposal,
    assignPerson,
    clearAssignment,
    swapAssignment,
  }
})
