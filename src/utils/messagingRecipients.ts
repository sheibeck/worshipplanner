// Pure recipient resolver (Phase 58) — wraps resolveServiceRoleAssignments to
// turn team/individual/everyone selections into deduped, reachable/
// unreachable recipient lists. No Firestore/Pinia/store imports (types
// only), so this is testable without any app/store setup, following the
// same "pure function in utils/" convention as src/utils/serviceRoles.ts.

import type { Service } from '@/types/service'
import type { Quarter, Role, RoleGroup, Person } from '@/types/roster'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'
import { confirmationKey } from '@/utils/confirmations'

/**
 * UI label remap of the existing RoleGroup enum for the messaging surfaces
 * (Phase 59's composer, etc). Deliberately its OWN constant — do NOT import
 * or repurpose RolesConfigPanel.vue's `groupLabels`. Two UIs are allowed to
 * describe the same enum differently (58-CONTEXT.md).
 */
export const MESSAGING_TEAM_LABELS: Record<RoleGroup, string> = {
  band: 'Band',
  tech: 'Tech',
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
  /** R413: narrow the matched set to people with at least one unconfirmed (or
   *  needs-reconfirmation) assignment for this service — per-assignment, not
   *  per-person (a person with one confirmed and one unconfirmed role still
   *  qualifies). Preview-only here; the server re-resolves authoritatively. */
  unconfirmedOnly?: boolean
}

/**
 * Resolves a { teams, individualPersonIds, includeEveryone } selection into
 * deduped (by person id), reachability-split recipient lists. `confirmedKeys`
 * (R413) is the set of `confirmationKey(roleId, emailLower)` pairs currently
 * `'confirmed'` — only consulted when `selection.unconfirmedOnly` is true.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/messagingRecipients.ts)
 */
export function resolveRecipients(
  service: Service,
  quarters: Quarter[],
  roles: Role[],
  people: Person[],
  selection: RecipientSelection,
  confirmedKeys?: Set<string>,
): { reachable: RecipientCandidate[]; unreachableCount: number } {
  const assignments = resolveServiceRoleAssignments(service, quarters, roles)
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const matchedPersonIds = new Set<string>()
  // R413: which roleIds a person matched THROUGH (team-matched assignments
  // only — mirrors the existing per-recipient roleNames convention). A person
  // added purely via individualPersonIds with no team-matched role has no
  // entry here and is never filtered by unconfirmedOnly (nothing to check).
  const roleIdsByPerson = new Map<string, Set<string>>()

  for (const a of assignments) {
    const matchesTeam = selection.includeEveryone || selection.teams.includes(a.group)
    if (matchesTeam) {
      for (const pid of a.effectivePersonIds) {
        matchedPersonIds.add(pid)
        if (selection.unconfirmedOnly) {
          let ids = roleIdsByPerson.get(pid)
          if (!ids) {
            ids = new Set()
            roleIdsByPerson.set(pid, ids)
          }
          ids.add(a.roleId)
        }
      }
    }
  }
  for (const pid of selection.individualPersonIds) matchedPersonIds.add(pid)

  const reachable: RecipientCandidate[] = []
  let unreachableCount = 0
  for (const pid of matchedPersonIds) {
    const person = peopleById.get(pid)
    if (!person) continue // stale/deleted person id — silently skip, not an unreachable count
    if (selection.unconfirmedOnly && confirmedKeys) {
      const roleIds = roleIdsByPerson.get(pid)
      if (roleIds && roleIds.size > 0) {
        const emailLower = person.email.toLowerCase()
        const allConfirmed = [...roleIds].every((roleId) => confirmedKeys.has(confirmationKey(roleId, emailLower)))
        if (allConfirmed) continue // every matched assignment is confirmed — drop
      }
    }
    if (person.email === '') {
      unreachableCount++
    } else {
      reachable.push({ id: person.id, name: person.name, email: person.email })
    }
  }
  return { reachable, unreachableCount }
}
