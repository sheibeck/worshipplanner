import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
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
  RoleGroup,
  RoleFrequencyEntry,
} from '@/types/roster'
import { generateSundaysInQuarter, applyDateAdditionsRemovals } from '@/utils/quarterDates'
import { proposeQuarterSchedule } from '@/utils/scheduler'
import { useRosterStore } from '@/stores/roster'
import { deriveSlug, claimSlug } from '@/utils/slug'

// Payload for applyCsvToQuarter — the Plan 08 UI resolves CSV names→personIds and role-names→roleIds first.
export interface ResolvedCsvPerson {
  personId: string
  standing: { name?: string; email?: string; phone?: string; roles?: string[] }
  blackoutDates: string[]
  pairedWith: string[]
  // D-04/D-05: per-role cadence resolved from the CSV Frequency column, written to the quarter
  // (never a standing frequency write — CSV import is a quarter-scoped operation).
  roleFrequency?: Record<string, RoleFrequencyEntry>
}

// D-06: chronological ordering key for (year, quarterNum) — pure helper, no side effects.
function quarterKey(year: number, quarterNum: number): number {
  return year * 4 + quarterNum
}

// D-06: finds the chronologically prior quarter (if any) for new-quarter seeding.
function findPriorQuarter(quarters: Quarter[], year: number, quarterNum: number): Quarter | undefined {
  const target = quarterKey(year, quarterNum)
  return quarters
    .filter((q) => quarterKey(q.year, q.quarter) < target)
    .sort((a, b) => quarterKey(b.year, b.quarter) - quarterKey(a.year, a.quarter))[0]
}

export const useQuartersStore = defineStore('quarters', () => {
  const quarters = ref<Quarter[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)

  // Ephemeral (in-memory) record of which service dates had their assignments
  // change on the last generateProposal run, so the UI can highlight them. Not
  // persisted — cleared on reload, scoped to a quarter so a stale set from
  // another quarter never highlights the wrong grid.
  const lastRegenerate = ref<{ quarterId: string; changedDates: string[] } | null>(null)

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

  // D-06: seeds each (person, role) frequency + pairing from the chronologically prior
  // quarter when one exists, else defaults to once/month (N=4). Blackout Sundays never
  // carry forward — always reset to []. T-16-01-01: this whole-map construction is safe
  // ONLY at quarter creation (writing into a brand-new, empty doc) — ongoing edits use
  // the scoped dot-path writes in setPersonAvailability/applyCsvToQuarter, never this path.
  async function createQuarter(year: number, quarter: 1 | 2 | 3 | 4, label: string): Promise<string> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const rosterStore = useRosterStore()
    const prior = findPriorQuarter(quarters.value, year, quarter)

    const personQuarterData: Record<string, PersonQuarterData> = {}
    // Only seed active volunteers — inactive people are excluded from schedule
    // proposals, so seeding quarter data for them just creates throwaway entries.
    for (const person of rosterStore.activePeople) {
      const priorPQD = prior?.personQuarterData[person.id]
      const roleFrequency: Record<string, RoleFrequencyEntry> = {}
      for (const roleId of person.roles) {
        roleFrequency[roleId] = priorPQD?.roleFrequency?.[roleId] ?? { tier: 'regular', n: 4 }
      }
      personQuarterData[person.id] = {
        personId: person.id,
        blackoutDates: [], // D-06: never carried forward, always resets
        pairedWith: priorPQD?.pairedWith ?? [], // D-06: seeded from previous quarter when present
        roleFrequency,
      }
    }

    const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'quarters'), {
      label,
      year,
      quarter,
      serviceDates: generateSundaysInQuarter(year, quarter),
      roleOverridesByDate: {},
      personQuarterData,
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

  // See ADR-0153 (docs/adr/0153-d-19-replace-only-the-csv-present-people-s-quarter-scoped-en.md)
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
        roleFrequency: row.roleFrequency ?? {},
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
          roleFrequency: {},
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

  // D-03/D-05/D-06 — scoped dot-path save; pairedWith is ONE-WAY, never reciprocal-written.
  // See .planning/codebase/ARCHITECTURE.md (Store & Config Behavioral Notes (R318) ->
  // src/stores/quarters.ts).
  async function setPersonAvailability(
    quarterId: string,
    personId: string,
    data: {
      blackoutDates: string[]
      pairedWith: string[]
      note: string
      // D-04/D-05: per-role frequency, keyed by roleId — written wholesale within the
      // already-scoped `personQuarterData.${personId}` dot-path below, never a whole-map
      // rewrite, so other people's entries are never touched by this write.
      roleFrequency: Record<string, RoleFrequencyEntry>
    },
  ): Promise<void> {
    if (!orgId.value) return

    const updates: Record<string, unknown> = {
      [`personQuarterData.${personId}`]: { personId, ...data },
      updatedAt: serverTimestamp(),
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

  // D-12: projects Role[]→roleId→RoleGroup lookup so the scheduler's group co-occurrence
  // rules (Band<->Tech exclusivity, 1-Band-instrument cap) are actually enforced in production,
  // not just at the unit level inside scheduler.ts. Unknown/stale roleIds default to 'other' (the
  // least-restrictive group) so a missing lookup entry never crashes or silently blocks a slot.
  function buildRoleGroupOf(roles: Role[]): (roleId: string) => RoleGroup {
    const groupById = new Map(roles.map((r) => [r.id, r.group]))
    return (roleId: string) => groupById.get(roleId) ?? 'other'
  }

  // R259: projects Role[]→roleId→multiRole lookup, paired with buildRoleGroupOf, so the
  // scheduler's multi-role co-occurrence rule (a multi-role role never conflicts and may cross
  // Band/Tech/Other) is enforced in production. Unknown roleIds default to false (the safe,
  // non-exempt default).
  function buildIsMultiRole(roles: Role[]): (roleId: string) => boolean {
    const multiRoleById = new Map(roles.map((r) => [r.id, r.multiRole === true]))
    return (roleId: string) => multiRoleById.get(roleId) ?? false
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
      buildRoleGroupOf(rosterStore.roles),
      buildIsMultiRole(rosterStore.roles),
    )

    // Diff the previous calendar against the freshly proposed one so the UI can
    // highlight dates whose assignments changed (person added/removed). Compares
    // sorted person-id arrays per role; any difference marks the whole date.
    const prevCalendar = quarter.calendar
    const changedDates: string[] = []
    for (const date of quarter.serviceDates) {
      const prevRoles = prevCalendar[date] ?? {}
      const nextRoles = result.calendar[date] ?? {}
      const roleIds = new Set([...Object.keys(prevRoles), ...Object.keys(nextRoles)])
      let changed = false
      for (const roleId of roleIds) {
        const a = [...(prevRoles[roleId] ?? [])].sort()
        const b = [...(nextRoles[roleId] ?? [])].sort()
        if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
          changed = true
          break
        }
      }
      if (changed) changedDates.push(date)
    }
    lastRegenerate.value = { quarterId, changedDates }

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

    // See ADR-0154 (docs/adr/0154-r-02-d-18-resolve-or-claim-on-first-share-the-org-s-memorabl.md)
    try {
      const orgRef = doc(db, 'organizations', orgId.value)
      const orgSnap = await getDoc(orgRef)
      const orgData = orgSnap.exists() ? orgSnap.data() : {}
      let slug = orgData.slug as string | undefined
      if (!slug) {
        // An org with no name (or a name with no [a-z0-9] characters after lowercasing,
        // e.g. non-Latin-script) derives to '' — claimSlug('') would throw synchronously
        // (Firestore rejects an empty document-ID path) well before the retry loop's
        // permission-denied handling ever runs. Fall back to a generic base so claimSlug
        // always has a valid, non-empty candidate to start from (its own numeric-suffix
        // retry loop still guarantees uniqueness: org, org-2, org-3, ...).
        const derived = deriveSlug((orgData.name as string | undefined) ?? '')
        const base = derived || 'org'
        slug = await claimSlug(base, orgId.value)
        await updateDoc(orgRef, { slug })
      }

      // R347/SEC-S-02 re-acceptance: this id is deterministic/guessable by
      // slug+quarter+year, but the format is FROZEN — it's embedded in every
      // already-deployed memorable link, and SEC-S-01's get/list split already
      // denies enumeration, leaving only exact-slug+exact-quarter guessing
      // (residual Low, accepted in writing — see 118-02-SUMMARY.md). Do NOT
      // change this id shape.
      await setDoc(doc(db, 'quarterShares', `${slug}__q${quarter.quarter}-${quarter.year}`), {
        // See ADR-0155 (docs/adr/0155-the-owning-orgid-is-stored-on-the-doc-so-firestore-rules-can.md)
        orgId: orgId.value,
        orgSlug: slug,
        quarterSnapshot: {
          label: quarter.label,
          serviceDates: quarter.serviceDates,
          roles: rosterStore.roles.map((r) => ({ id: r.id, name: r.name, group: r.group })),
          calendar: calendarWithNames,
        },
        token,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error(
        'finalizeAndShare: memorable-URL slug/quarterShares write failed — the opaque share link above already succeeded',
        err,
      )
    }

    return token
  }

  // Delete an entire quarter — its setup (personQuarterData), its generated schedule
  // (calendar), and any public share artifacts finalizeAndShare wrote for it. The
  // public docs are revoked FIRST so a deleted quarter can never leave a live,
  // unauthenticated share link dangling. Deleting shareTokens/quarterShares requires
  // the org-editor delete rules added alongside this action; each delete is guarded by
  // a getDoc existence check so we never issue a delete against a non-existent doc
  // (which the rules deny on a null `resource`). If revocation fails (e.g. rules not
  // yet deployed), this throws before the quarter is removed — no orphaned link.
  async function deleteQuarter(quarterId: string): Promise<void> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const quarter = getQuarter(quarterId)

    if (quarter.shareToken) {
      // 1. Opaque token share (shareTokens/{token}).
      const tokenRef = doc(db, 'shareTokens', quarter.shareToken)
      const tokenSnap = await getDoc(tokenRef)
      if (tokenSnap.exists()) await deleteDoc(tokenRef)

      // 2. Memorable-URL share (quarterShares/{slug}__q{N}-{year}) — the doc id is
      // deterministic from the org slug plus this quarter's number/year.
      const orgSnap = await getDoc(doc(db, 'organizations', orgId.value))
      const slug = orgSnap.exists() ? (orgSnap.data().slug as string | undefined) : undefined
      if (slug) {
        const shareRef = doc(db, 'quarterShares', `${slug}__q${quarter.quarter}-${quarter.year}`)
        const shareSnap = await getDoc(shareRef)
        if (shareSnap.exists()) await deleteDoc(shareRef)
      }
    }

    // 3. Delete the quarter document itself.
    await deleteDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId))
  }

  return {
    quarters,
    isLoading,
    orgId,
    lastRegenerate,
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
    buildRoleGroupOf,
    buildIsMultiRole,
    generateProposal,
    assignPerson,
    clearAssignment,
    swapAssignment,
    finalizeAndShare,
    deleteQuarter,
  }
})
