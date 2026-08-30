// Bug 2b (quick 260830-l9c) — shared onSnapshot error-handling helper.
//
// A handful of Firestore snapshot listeners only unsubscribe on view
// unmount, which happens AFTER the router redirects to /login on sign-out.
// In that window the auth token has already been revoked (Bug 2a tears down
// the ORG-SCOPED store listeners first, but these component-owned listeners
// are separate), so Firestore rejects the read with `permission-denied`.
// With no `onError` handler, that surfaces as "Uncaught Error in snapshot
// listener" — benign, but noisy. `ignorePermissionDenied` swallows exactly
// that one error code and still logs anything else.
export function isPermissionDenied(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'permission-denied'
}

// Returns an onSnapshot error callback. Typing the parameter as `unknown`
// still satisfies onSnapshot's onError slot (which expects a
// `(FirestoreError) => void`) by contravariance.
export function ignorePermissionDenied(context: string): (err: unknown) => void {
  return (err: unknown) => {
    if (isPermissionDenied(err)) return
    console.error(`[${context}] snapshot listener error:`, err)
  }
}
