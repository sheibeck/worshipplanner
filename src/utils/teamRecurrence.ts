/**
 * Nth-Sunday-of-month recurrence matching (R254/R255, Phase 86).
 *
 * Pure and framework-free — NO firebase, NO vue imports — so it stays a
 * small, independently-testable module that NewServiceDialog.vue (and any
 * future consumer) can import without pulling in store/component wiring.
 *
 * Date parsing mirrors the UTC-stable convention established in
 * `src/utils/lastUsed.ts` (`serviceDateToMillis`): split the "YYYY-MM-DD"
 * string on '-' and treat the parts as a UTC calendar date, rather than
 * constructing a `Date` that resolves "local midnight" against whichever
 * timezone the running process defaults to. Without this, the same date
 * string could compute a different ordinal depending on the host's
 * timezone — an off-by-one-day slip near a month boundary.
 *
 * Scope note: only the Nth-occurrence-of-the-month pattern is supported.
 * "Every N weeks" was considered and dropped for this phase (see the
 * phase CONTEXT's Deferred Ideas) — do not reintroduce it here.
 */

import type { Team } from '@/types/team'

/**
 * Returns the ordinal (1-5) of the given "YYYY-MM-DD" date's day-of-month
 * within its own weekday — i.e. the Nth time that weekday occurs in the
 * month. This is generic over whichever weekday the date itself falls on;
 * it does not re-derive or check the weekday. A 5th ordinal only occurs in
 * months where a weekday appears five times.
 */
export function ordinalOfMonth(dateStr: string): number {
  const parts = dateStr.split('-')
  const day = Number(parts[2])
  return Math.ceil(day / 7)
}

/**
 * Returns true only when `team.recurrence.ordinals` includes the ordinal
 * computed for `dateStr`. A team with absent or empty `ordinals` never
 * matches any date.
 */
export function teamMatchesDate(team: Pick<Team, 'recurrence'>, dateStr: string): boolean {
  const ordinals = team.recurrence?.ordinals
  if (!ordinals || ordinals.length === 0) return false
  return ordinals.includes(ordinalOfMonth(dateStr))
}
