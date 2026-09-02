// Bug 2b (quick 260830-l9c) — shared onSnapshot error-handling helper.
// See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/firestoreListener.ts)
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
