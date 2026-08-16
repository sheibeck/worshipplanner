// Pure recipient resolver (Phase 58) — wraps resolveServiceRoleAssignments to
// turn team/individual/everyone selections into deduped, reachable/
// unreachable recipient lists. No Firestore/Pinia/store imports (types
// only), so this is testable without any app/store setup, following the
// same "pure function in utils/" convention as src/utils/serviceRoles.ts.

import type { Service } from '@/types/service'
import type { Quarter, Role, RoleGroup, Person } from '@/types/roster'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'

/**
 * UI label remap of the existing RoleGroup enum for the messaging surfaces
 * (Phase 59's composer, etc). Deliberately its OWN constant — do NOT import
 * or repurpose RolesConfigPanel.vue's `groupLabels`. Two UIs are allowed to
 * describe the same enum differently (58-CONTEXT.md).
 */
export const MESSAGING_TEAM_LABELS: Record<RoleGroup, string> = {
  band: 'Band',
  tech: 'Tech',
  vocals: 'Vocals',
  other: 'Other',
}

export interface RecipientCandidate {
  id: string
  name: string
  email: string
}

export interface RecipientSelection {
  teams: RoleGroup[]
  individualPersonIds: string[]
  includeEveryone: boolean
}

/**
 * Resolves a { teams, individualPersonIds, includeEveryone } selection into
 * deduped (by person id), reachability-split recipient lists. Wraps the
 * already-pure resolveServiceRoleAssignments — the only recipient-resolution
 * algorithm any later messaging phase (composer, auto-sends, re-lock notice)
 * consumes.
 *
 * - includeEveryone resolves every assigned role regardless of group.
 * - A person assigned to two matching roles/teams is deduped and appears once.
 * - A matched person with email === '' is excluded from `reachable` and
 *   increments `unreachableCount`.
 * - An unfilled role (effectivePersonIds === []) contributes 0 recipients and
 *   does NOT change unreachableCount — distinct from an unreachable person.
 * - A matched personId absent from `people` (stale/deleted) is silently
 *   skipped and does NOT increment unreachableCount.
 */
export function resolveRecipients(
  service: Service,
  quarters: Quarter[],
  roles: Role[],
  people: Person[],
  selection: RecipientSelection,
): { reachable: RecipientCandidate[]; unreachableCount: number } {
  const assignments = resolveServiceRoleAssignments(service, quarters, roles)
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const matchedPersonIds = new Set<string>()

  for (const a of assignments) {
    const matchesTeam = selection.includeEveryone || selection.teams.includes(a.group)
    if (matchesTeam) {
      for (const pid of a.effectivePersonIds) matchedPersonIds.add(pid)
    }
  }
  for (const pid of selection.individualPersonIds) matchedPersonIds.add(pid)

  const reachable: RecipientCandidate[] = []
  let unreachableCount = 0
  for (const pid of matchedPersonIds) {
    const person = peopleById.get(pid)
    if (!person) continue // stale/deleted person id — silently skip, not an unreachable count
    if (person.email === '') {
      unreachableCount++
    } else {
      reachable.push({ id: person.id, name: person.name, email: person.email })
    }
  }
  return { reachable, unreachableCount }
}
