import { auth } from '@/firebase'

/**
 * Header the API proxy (Cloud Function) uses to verify the caller is a signed-in
 * app user before spending our server-held secrets (Claude, ESV). See functions/src/index.ts.
 *
 * Returns an empty object when no user is signed in — the proxy will reject the
 * request with 401, which is the correct outcome (these features are auth-gated).
 */
export async function getAppAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { 'X-App-Auth': token }
}
