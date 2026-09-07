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
}

/**
 * Diffs a service's roleAssignmentsByEmailLower projection against its live
 * confirmation statuses. A pair is unconfirmed when it has no entry in
 * `confirmationStatuses` (the implicit default, per confirmations.ts) or the
 * stored status is 'needsReconfirmation' — mirrors ServiceEditorView.vue's
 * confirmationStatusFor default semantics exactly. Order is stable (input
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
      const status = confirmationStatuses.get(confirmationKey(roleId, emailLower))
      if (status === undefined || status === 'needsReconfirmation') {
        result.push({ emailLower, roleId, roleName })
      }
    }
  }
  return result
}
