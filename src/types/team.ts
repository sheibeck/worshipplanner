// Per-org configurable team list (Phase 79 — R228/R241). A team is a flat,
// unordered-in-meaning-but-stably-sorted entry the service-plan checkboxes
// render; it carries no roster group/defaultCount (unlike Role). The former
// optional `songFilterTag` (an AI-suggestion narrowing tag) was removed
// 2026-08-25 — it only ever fed the AI song-suggestion filter, did nothing
// when AI was off, and added user-facing confusion for no benefit.
export interface Team {
  id: string
  name: string
  order: number // stable ascending order, mirrors Role.order
  // Optional Nth-Sunday-of-month recurring pattern (Phase 86 — R254/R255).
  // `ordinals` holds integer values 1-5, each meaning the Nth occurrence of
  // the service date's own weekday within its month (a Sunday service on
  // the pattern's date is the "Nth Sunday" for a Sunday-scheduled team; a
  // 5th ordinal only exists in months where that weekday occurs 5 times).
  // Absent or empty `ordinals` means "no recurring pattern, no auto-select"
  // — existing team docs with no `recurrence` remain valid and untouched.
  recurrence?: { ordinals: number[] }
}

// See ADR-0175 (docs/adr/0175-d-79-default-team-list-byte-identical-to-the-pre-phase-79.md)
export const DEFAULT_TEAMS: Array<Omit<Team, 'id'>> = [
  { name: 'Choir', order: 0 },
  { name: 'Orchestra', order: 1 },
  { name: 'Communion', order: 2 },
  { name: 'Special', order: 3 },
]
