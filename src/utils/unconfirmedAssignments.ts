// Pure diff util (Phase 135, R417) — the dashboard's unconfirmed-volunteers
// signal. No Firestore/Pinia imports, mirroring confirmations.ts's own
// "pure function in utils/" convention. Reuses confirmationKey verbatim
// (never reimplements the `${roleId}_${emailLower}` join).

import { confirmationKey, type ConfirmationStatus } from '@/utils/confirmations'
import type { RehearseAccessDoc } from '@/utils/rehearseAccess'

export interface UnconfirmedAssignment {
  emailLower: string
  roleId: string
  roleName: string
  /** The attention status driving this row's chip: 'unconfirmed' (no doc),
   *  'needsReconfirmation' (stale after a relock), or 'declined' (260908-nq5 —
   *  the volunteer actively declined). 'confirmed' rows never appear here. */
  status: 'unconfirmed' | 'needsReconfirmation' | 'declined'
}

/**
 * Diffs a service's roleAssignmentsByEmailLower projection against its live
 * confirmation statuses. A pair needs attention when it has no entry in
 * `confirmationStatuses` (the implicit 'unconfirmed' default, per
 * confirmations.ts), the stored status is 'needsReconfirmation', or the
 * volunteer 'declined' (260908-nq5) — mirrors ServiceEditorView.vue's
 * confirmationStatusFor default semantics. Each row carries its own status so
 * the dashboard can chip declined rows distinctly. Order is stable (input
 * iteration order) so callers can slice deterministically.
 */
export function unconfirmedAssignments(
  roleAssignmentsByEmailLower: RehearseAccessDoc['roleAssignmentsByEmailLower'],
  confirmationStatuses: Map<string, ConfirmationStatus>,
): UnconfirmedAssignment[] {
  if (!roleAssignmentsByEmailLower) return []

  const result: UnconfirmedAssignment[] = []
  for (const [emailLower, roles] of Object.entries(roleAssignmentsByEmailLower)) {
    for (const { roleId, roleName } of roles) {
      const stored = confirmationStatuses.get(confirmationKey(roleId, emailLower))
      if (stored === 'confirmed') continue
      const status = stored ?? 'unconfirmed'
      result.push({ emailLower, roleId, roleName, status })
    }
  }
  return result
}
