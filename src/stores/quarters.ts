import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type {
  Quarter,
  RoleSlotConfig,
  PersonQuarterData,
  ProposeResult,
  Role,
  FrequencyTier,
} from '@/types/roster'
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

  // D-03/D-05/D-06: single-person quarter-data save from the availability drawer. Writes only
  // scoped `personQuarterData.${id}` / `personQuarterData.${id}.pairedWith` dot-paths — never the
  // whole `personQuarterData` map — so concurrent edits to other people's entries aren't clobbered
  // (T-14-03-01). Performs a symmetric added/removed diff against the *previous* pairedWith so a
  // dropped partner is reciprocally un-paired, not just left as a stale one-directional link
  // (T-14-03-02 / 14-RESEARCH Pitfall 2).
  async function setPersonAvailability(
    quarterId: string,
    personId: string,
    data: { blackoutDates: string[]; pairedWith: string[]; frequencyTier: FrequencyTier; note: string },
  ): Promise<void> {
    if (!orgId.value) return
    const quarter = getQuarter(quarterId)
    const previous = quarter.personQuarterData[personId]?.pairedWith ?? []
    const added = data.pairedWith.filter((id) => !previous.includes(id))
    const removed = previous.filter((id) => !data.pairedWith.includes(id))

    const updates: Record<string, unknown> = {
      [`personQuarterData.${personId}`]: { personId, ...data },
      updatedAt: serverTimestamp(),
    }
    for (const partnerId of added) {
      const partnerPaired = quarter.personQuarterData[partnerId]?.pairedWith ?? []
      if (!partnerPaired.includes(personId)) {
        updates[`personQuarterData.${partnerId}`] = {
          personId: partnerId,
          blackoutDates: quarter.personQuarterData[partnerId]?.blackoutDates ?? [],
          pairedWith: [...partnerPaired, personId],
          frequencyTier: quarter.personQuarterData[partnerId]?.frequencyTier ?? 'regular',
          note: quarter.personQuarterData[partnerId]?.note ?? '',
        }
      }
    }
    for (const partnerId of removed) {
      const partnerData = quarter.personQuarterData[partnerId]
      if (partnerData) {
        updates[`personQuarterData.${partnerId}.pairedWith`] = partnerData.pairedWith.filter(
          (id) => id !== personId,
        )
      }
    }
    await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), updates)
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

  // Finalize + public share (D-24). No Planning Center write of any kind (D-21) — the
  // quarterSnapshot is a denormalized, read-only copy resolving person NAMES (not raw ids)
  // so the public view needs no roster access and no PII beyond names is exposed (T-13-06-02).
  async function finalizeAndShare(quarterId: string): Promise<string> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const quarter = getQuarter(quarterId)
    const rosterStore = useRosterStore()

    // Cryptographically random 36-char hex token (144-bit entropy) — same generator as
    // services.ts's createShareToken.
    const array = new Uint8Array(18)
    crypto.getRandomValues(array)
    const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')

    const nameById = new Map(rosterStore.people.map((p) => [p.id, p.name]))
    const calendarWithNames: Record<string, Record<string, string[]>> = {}
    for (const [date, roleMap] of Object.entries(quarter.calendar)) {
      calendarWithNames[date] = {}
      for (const [roleId, personIds] of Object.entries(roleMap)) {
        calendarWithNames[date]![roleId] = personIds.map((id) => nameById.get(id) ?? id)
      }
    }

    await setDoc(doc(db, 'shareTokens', token), {
      orgId: orgId.value,
      quarterId,
      quarterSnapshot: {
        label: quarter.label,
        serviceDates: quarter.serviceDates,
        roles: rosterStore.roles.map((r) => ({ id: r.id, name: r.name, group: r.group })),
        calendar: calendarWithNames,
      },
      createdAt: serverTimestamp(),
    })

    await updateQuarter(quarterId, { status: 'finalized', shareToken: token })

    return token
  }

  return {
    quarters,
    isLoading,
    orgId,
    subscribe,
    unsubscribeAll,
    getQuarter,
    createQuarter,
    addServiceDate,
    removeServiceDate,
    setRoleOverrideForDate,
    applyCsvToQuarter,
    setPersonAvailability,
    buildResolveRolesForDate,
    generateProposal,
    assignPerson,
    clearAssignment,
    swapAssignment,
    finalizeAndShare,
  }
})
