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
// two call sites this module was extracted to fix.
//
// No try/catch here -- these helpers throw through. Callers (the trigger
// handlers) wrap the call and convert a failure into a { action: "failed" }
// outcome rather than rethrowing out of a Firestore trigger.

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
