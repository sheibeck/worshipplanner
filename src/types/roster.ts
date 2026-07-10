import type { Timestamp } from 'firebase/firestore'

export type RoleGroup = 'band' | 'tech' | 'vocals' | 'other'

export interface Role {
  id: string
  name: string // e.g. "guitar", "sound", "scripture reader"
  group: RoleGroup
  defaultCount: number // default role-count template value (D-02) — a soft planning default, NOT a hard cap
  order: number // stable ascending order for the scheduler's inner role loop
}

export interface Person {
  id: string
  name: string
  email: string // from PC import, CSV, or manual entry
  /** APP-ONLY / manual — NOT fetchable from Planning Center Services v2 (D-14, RESEARCH Pitfall 5) */
  phone: string
  active: boolean // soft-delete inverse (D-20); inactive people drop out of proposals + pickers
  /** STANDING data (D-18) — Role.id[] this person can fill */
  roles: string[]
  /** @deprecated replaced by PersonQuarterData.roleFrequency (Phase 16 D-04); removed in plan 16-11.
   *  STANDING data (D-06/D-18) — 1-in-N cadence: 1 = weekly, 2 = every other week, 4 = ~monthly. */
  frequencyTargetN: number
  /** @deprecated replaced by PersonQuarterData.roleFrequency (Phase 16 D-04); removed in plan 16-11.
   *  STANDING data (D-04) — roleId -> 1-in-N cadence, one target per held role. */
  roleFrequencies?: Record<string, number>
  pcPersonId: string | null // Planning Center people id, for re-import matching
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface RoleSlotConfig {
  roleId: string
  count: number
}

// Quarter-scoped fill-in/out frequency behavior (D-04/D-05). Optional — defaults to
// 'regular' when absent (pre-migration Phase 13 data has no frequencyTier at all).
export type FrequencyTier = 'regular' | 'fillin' | 'out'

/**
 * Quarter-scoped, per-role serve frequency (D-04/D-05) — one control, one field per
 * held role. `tier` gates whether the role is regular/fill-in/out; `n` is the 1-in-N
 * cadence, meaningful when tier === 'regular' (default 4, ~once/month).
 */
export interface RoleFrequencyEntry {
  tier: FrequencyTier
  n: number
}

/**
 * Quarter-scoped, per-person availability — reset each quarter (D-18),
 * replaced per person on re-import (D-19). NOT standing data.
 */
export interface PersonQuarterData {
  personId: string
  blackoutDates: string[] // expanded YYYY-MM-DD list (D-17 ranges already expanded against serviceDates)
  pairedWith: string[] // Person.id[], bidirectional — must-serve-with pairings (D-09)
  /** Quarter-scoped, per-role, single source of truth (D-04/D-05) — replaces the old
   *  standing Person.roleFrequencies/frequencyTargetN AND the old PersonQuarterData
   *  roleTiers/frequencyTier split. One control, one lookup, one field per held role.
   *  Default when a role entry is absent: { tier: 'regular', n: 4 }. */
  roleFrequency?: Record<string, RoleFrequencyEntry>
  /** @deprecated replaced by PersonQuarterData.roleFrequency (Phase 16 D-04); removed in plan 16-11.
   *  Quarter-scoped (D-05/A1) — resets each new quarter. Optional; defaults to 'regular' when absent. */
  frequencyTier?: FrequencyTier
  /** @deprecated replaced by PersonQuarterData.roleFrequency (Phase 16 D-04); removed in plan 16-11.
   *  Quarter-scoped (D-05) — roleId -> tier, one tier per held role. */
  roleTiers?: Record<string, FrequencyTier>
  /** Free-text quarter note (D-03/D-07) — never auto-scheduled. Optional; defaults to '' when absent. */
  note?: string
}

// calendar[date][roleId] = personId[]  (multi-person-per-role, multi-role-per-person — D-04)
export type QuarterCalendar = Record<string, Record<string, string[]>>

export interface Quarter {
  id: string
  label: string // e.g. "Q3 2026"
  year: number
  quarter: 1 | 2 | 3 | 4
  serviceDates: string[] // generated Sundays + manual add/remove (D-01)
  roleOverridesByDate: Record<string, RoleSlotConfig[]> // per-date role-count overrides (D-02)
  personQuarterData: Record<string, PersonQuarterData> // keyed by personId (D-18/D-19)
  calendar: QuarterCalendar // generated + manually edited (D-22)
  status: 'draft' | 'finalized'
  shareToken: string | null // D-24
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ProposeResult {
  calendar: QuarterCalendar
  servedCounts: Record<string, number>
  unfilled: Array<{ date: string; roleId: string }>
  pairingConflicts: Array<{ date: string; personId: string; partnerId: string; reason: string }>
}

// Upsert shape used by PC import + CSV import + manual add (standing fields only; never blackouts/pairings)
export interface UpsertPersonInput {
  name: string
  email: string
  phone?: string
  roles?: string[]
  frequencyTargetN?: number
  roleFrequencies?: Record<string, number>
  pcPersonId?: string | null
}

// D-03 default role list, grouped. Leaders self-assign and are intentionally excluded (D-05).
// DEFAULT_ROLES omits `id` (assigned by Firestore on seed). Default counts are Claude's discretion — use 1 each.
export const DEFAULT_ROLES: Array<Omit<Role, 'id'>> = [
  { name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
  { name: 'drums', group: 'band', defaultCount: 1, order: 1 },
  { name: 'vocals', group: 'vocals', defaultCount: 1, order: 2 },
  { name: 'bass', group: 'band', defaultCount: 1, order: 3 },
  { name: 'sound', group: 'tech', defaultCount: 1, order: 4 },
  { name: 'livestream', group: 'tech', defaultCount: 1, order: 5 },
  { name: 'projection', group: 'tech', defaultCount: 1, order: 6 },
  { name: 'scripture reader', group: 'other', defaultCount: 1, order: 7 },
]
