// Pure confirmation model (Phase 133, R410/R412) — the shared vocabulary the
// volunteer-write rule, the relock reconciliation step, and the planner's
// live status read all import. No Firestore/Pinia/store imports (types
// only), following the same "pure function in utils/" convention as
// serviceRoles.ts/messagingRecipients.ts.
//
// organizations/{orgId}/services/{serviceId}/confirmations/{roleId}_{emailLower}

import type { Timestamp } from 'firebase/firestore'
import type { Service } from '@/types/service'
import type { Quarter, Role, Person } from '@/types/roster'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'

/** 'unconfirmed' is NEVER a stored value — it is the implicit default for
 *  any (roleId, emailLower) pair with no confirmation doc at all (R410,
 *  "Unconfirmed default, implicit"). The stored values:
 *   - 'confirmed' / 'declined' — the volunteer's own whole-service response
 *     (260908-nq5: Decline is a distinct state a leader sees on the dashboard).
 *   - 'needsReconfirmation' — editor-only, written by the relock reconciliation. */
export type ConfirmationStatus = 'confirmed' | 'declined' | 'needsReconfirmation'

export interface ConfirmationDoc {
  roleId: string
  /** Denormalized, mirrors rehearseAccess's own roleName denorm — lets the
   *  planner's live listener render without a roles lookup. */
  roleName: string
  emailLower: string
  status: ConfirmationStatus
  /** serverTimestamp() when status flips to 'confirmed'; null otherwise
   *  (including 'declined' and 'needsReconfirmation'). */
  confirmedAt: Timestamp | null
  /** serverTimestamp() on every write (volunteer confirm/unconfirm, or the
   *  editor-side relock reconciliation). */
  updatedAt: Timestamp
}

/**
 * Builds the confirmations subcollection doc id: `${roleId}_${emailLower}`.
 * The caller passes an ALREADY-lowercased email — this helper stays a pure
 * string join, matching firestore.rules' own
 * `request.resource.data.roleId + '_' + request.resource.data.emailLower`
 * identity check.
 */
export function confirmationKey(roleId: string, emailLower: string): string {
  return `${roleId}_${emailLower}`
}

/**
 * Returns the Set of confirmation keys valid for THIS relock's resolved
 * assignments — the R412 backbone a relock diffs stored 'confirmed' docs
 * against to flip stale ones to 'needsReconfirmation'. Mirrors
 * buildRehearseAccess's own empty-email skip (a person with no email cannot
 * hold a confirmation key at all).
 */
export function computeValidConfirmationKeys(
  service: Service,
  quarters: Quarter[],
  roles: Role[],
  people: Person[],
): Set<string> {
  const assignments = resolveServiceRoleAssignments(service, quarters, roles)
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const keys = new Set<string>()

  for (const a of assignments) {
    for (const pid of a.effectivePersonIds) {
      const person = peopleById.get(pid)
      if (!person || person.email === '') continue
      keys.add(confirmationKey(a.roleId, person.email.toLowerCase()))
    }
  }
  return keys
}
