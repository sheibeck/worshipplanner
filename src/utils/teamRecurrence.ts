/**
 * Nth-Sunday-of-month recurrence matching (R254/R255, Phase 86). Pure and
 * framework-free — NO firebase, NO vue imports. Only the Nth-occurrence-of-
 * the-month pattern is supported — do not reintroduce "every N weeks" here.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/teamRecurrence.ts)
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
