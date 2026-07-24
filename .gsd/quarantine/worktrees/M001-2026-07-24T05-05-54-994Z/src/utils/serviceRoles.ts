// Pure seeding-join resolver (Phase 17) — computes each role's effective assignment
// for a service date as override ?? quarter-scheduled ?? []. No Firestore/Pinia/store
// imports (types only), so this is testable without any app/store setup, following the
// same "pure function in utils/" convention as src/utils/slug.ts and src/utils/quarterDates.ts.

import type { Service } from '@/types/service'
import type { Quarter, Role, RoleGroup } from '@/types/roster'

export interface ResolvedRoleAssignment {
  roleId: string
  roleName: string
  group: RoleGroup
  scheduledPersonIds: string[]
  overriddenPersonIds: string[] | null
  effectivePersonIds: string[]
}

/**
 * Returns the first quarter whose serviceDates includes the given date, or undefined
 * when none match. Two quarters listing the same date is unenforced in the data model
 * (accepted, pre-existing edge case — see 17-RESEARCH.md Open Question 1); first-match
 * in array order is the deterministic, documented tie-break.
 */
export function findQuarterForDate(quarters: Quarter[], date: string): Quarter | undefined {
  return quarters.find((q) => q.serviceDates.includes(date))
}

/**
 * Resolves, for each role sorted by order, the effective person assignment for a
 * service's date: override ?? quarter-scheduled ?? []. Overrides are never mutated
 * onto the schedule — the Quarter/calendar remains the unmerged source of truth.
 */
export function resolveServiceRoleAssignments(
  service: Service,
  quarters: Quarter[],
  roles: Role[],
): ResolvedRoleAssignment[] {
  const quarter = findQuarterForDate(quarters, service.date)
  const scheduleForDate = quarter?.calendar[service.date] ?? {}

  return roles
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((role) => {
      const scheduledPersonIds = scheduleForDate[role.id] ?? []
      const overriddenPersonIds = service.roleAssignmentOverrides?.[role.id] ?? null
      return {
        roleId: role.id,
        roleName: role.name,
        group: role.group,
        scheduledPersonIds,
        overriddenPersonIds,
        effectivePersonIds: overriddenPersonIds ?? scheduledPersonIds,
      }
    })
}
