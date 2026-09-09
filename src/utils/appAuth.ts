import { auth } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

/**
 * Headers the API proxy (Cloud Function) uses to authorize a caller before
 * spending our server-held secrets (Claude, ESV, NLT) or relaying Planning
 * Center.
 *
 * - `X-App-Auth`: the caller's Firebase ID token. Absent => the proxy 401s,
 *   which is the correct outcome (these features are auth-gated).
 * - `X-Org-Id`: the church the user is ACTIVELY viewing (`authStore.orgId`).
 *   The proxy's per-org AI/Bible enablement gate reads this instead of the
 *   token's primary-org claim, so a multi-church user gets the gate evaluated
 *   against the church they switched to. The server honors it only when the
 *   verified token proves membership (or super-admin); otherwise it falls back
 *   to the primary claim, so sending it can never widen access.
 *
 * Returns an empty object when no user is signed in. The store read is wrapped
 * defensively: if Pinia isn't active yet, X-Org-Id is simply omitted and the
 * server falls back to the primary-org claim (prior behavior).
 */
export async function getAppAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  const headers: Record<string, string> = { 'X-App-Auth': token }
  try {
    const orgId = useAuthStore().orgId
    if (orgId) headers['X-Org-Id'] = orgId
  } catch {
    // Pinia not ready — omit X-Org-Id; server falls back to the primary claim.
  }
  return headers
}
