import { getAuth } from "firebase-admin/auth";

// --- claimsHelpers (R175: closes the custom-claims replace/wipe hazard) ---
//
// This module deliberately does NOT call initializeApp() at module scope --
// mirrors the comment in orgMembershipClaims.ts: the deployed runtime's
// index.ts and the owner-run CLI scripts each initialize the Admin SDK
// themselves; a shared helper module that initializes would break one of
// those callers.
//
// Every custom-claim writer this app ever adds must route through the two
// functions below rather than calling getAuth().setCustomUserClaims(...)
// directly. A bare setCustomUserClaims(uid, patch) REPLACES the whole claims
// object, and setCustomUserClaims(uid, null) WIPES it entirely -- either
// would silently strip an unrelated claim (e.g. superAdmin) the next time
// any other claim writer runs. See orgMembershipClaims.ts:186-199 for the
// See ADR-0016 (docs/adr/0016-two-call-sites-this-module-was-extracted-to-fix-no-try-catch.md)
// object computed from a now-stale read, silently dropping the first
// writer's change.
//
// This is deliberately left undocumented-as-a-bug rather than "fixed": the
// Firebase Admin SDK has no compare-and-swap primitive for custom claims, so
// eliminating it would require an external lock (e.g. a Firestore transaction
// gating both writers on a shared per-uid claims-lock document, or a Cloud
// Tasks queue serializing writes per uid) -- disproportionate machinery for a
// window that only opens when a super-admin grant/revoke and an org-membership
// change race for the exact same uid, both infrequent admin-only actions.
// Accepted as a residual risk rather than mitigated; revisit only if a real
// collision is ever observed in practice.

/**
 * Reads the user's CURRENT custom claims, shallow-merges `patch` on top, and
 * writes the merged result back. This is the single fix for the
 * replace-instead-of-merge hazard: it preserves every existing claim key not
 * named in `patch`.
 */
export async function mergeAndSetCustomClaims(
  uid: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = (user.customClaims as Record<string, unknown> | undefined) ?? {};
  await getAuth().setCustomUserClaims(uid, { ...current, ...patch });
}

/**
 * The scoped counterpart to mergeAndSetCustomClaims: removes only the named
 * `keys`, preserving every other existing claim. The Firebase Admin SDK
 * requires `null` (not `{}`) to fully clear a user's custom claims, so this
 * only passes `null` when nothing remains after the delete -- an empty
 * object would be a no-op clear from the SDK's perspective, not a real one.
 */
export async function clearClaimKeys(uid: string, keys: readonly string[]): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = { ...((user.customClaims as Record<string, unknown> | undefined) ?? {}) };
  for (const key of keys) delete current[key];
  const hasRemaining = Object.keys(current).length > 0;
  await getAuth().setCustomUserClaims(uid, hasRemaining ? current : null);
}

/** See ADR-0017 (docs/adr/0017-the-atomic-counterpart-to-calling-clearclaimkeys-then.md) */
export async function mergeSetAndClearCustomClaims(
  uid: string,
  opts: { set?: Record<string, unknown>; clear?: readonly string[] },
): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = { ...((user.customClaims as Record<string, unknown> | undefined) ?? {}) };
  for (const key of opts.clear ?? []) delete current[key];
  Object.assign(current, opts.set ?? {});
  const hasRemaining = Object.keys(current).length > 0;
  await getAuth().setCustomUserClaims(uid, hasRemaining ? current : null);
}

/** See ADR-0018 (docs/adr/0018-patches-or-deletes-one-key-inside-a-nested-map-claim-e-g.md) */
export async function patchNestedClaimKey(
  uid: string,
  topLevelKey: string,
  nestedKey: string,
  value: true | undefined,
): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = { ...((user.customClaims as Record<string, unknown> | undefined) ?? {}) };
  const nested = { ...((current[topLevelKey] as Record<string, unknown> | undefined) ?? {}) };
  if (value === true) {
    nested[nestedKey] = true;
  } else {
    delete nested[nestedKey];
  }
  current[topLevelKey] = nested;
  await getAuth().setCustomUserClaims(uid, current);
}

/** See ADR-0012 (docs/adr/0012-the-1000-byte-custom-claims-cap-throws-auth-claims-too-large.md) */
export function isClaimsTooLargeError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "auth/claims-too-large"
  );
}
