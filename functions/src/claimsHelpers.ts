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
//
// KNOWN LIMITATION -- residual concurrent-write race (WR-02, 68-REVIEW.md):
// both helpers are read-then-write (getUser -> setCustomUserClaims) with no
// compare-and-swap or transaction. This phase's fix closes the *sequential*
// replace-clobbers-unrelated-key hazard described above, but it does NOT
// close a *concurrent* race: if syncOrgMembershipClaim and syncSuperAdminClaim
// both fire for the SAME uid within the same short window (e.g. an owner
// grants super-admin to a user at nearly the same moment that user's org role
// changes), both handlers read claims independently and whichever
// setCustomUserClaims call lands second overwrites the first with a claims
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

/**
 * The atomic counterpart to calling clearClaimKeys then mergeAndSetCustomClaims
 * as two SEPARATE writes (73-REVIEW.md WR-01). Reads current claims ONCE,
 * removes `opts.clear` keys and applies `opts.set` on top -- all in memory --
 * then issues a SINGLE setCustomUserClaims call. This closes the TOCTOU window
 * a two-write clear+set sequence opens: a token minted between the two writes
 * could carry a claim state that was never a deliberate end-state (e.g.
 * cleared primary `orgId`/`role` keys but a still-stale `orgs` map that lists
 * the org whose membership was just removed).
 *
 * Same null-vs-{} handling as clearClaimKeys: the Admin SDK requires `null`
 * (not `{}`) to fully clear a user's custom claims, so `null` is only passed
 * when nothing remains after clear+set.
 */
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

/**
 * Patches (or deletes) ONE key inside a NESTED map claim (e.g.
 * `deactivatedOrgs[orgId]`), preserving every other top-level claim key AND
 * every other key already inside that same nested map -- mirrors
 * `mergeSetAndClearCustomClaims`'s TOCTOU-safe shape (76-RESEARCH.md Pitfall
 * 3): a SINGLE `getUser` read, an in-memory patch of the ONE nested key, then
 * a SINGLE `setCustomUserClaims` write. Never a bare replace of the nested
 * map -- `mergeAndSetCustomClaims(uid, { deactivatedOrgs: {...} })` would
 * REPLACE the whole nested object, silently wiping a sibling org's
 * deactivated-flag for a user who belongs to more than one deactivated org.
 *
 * `value === true` sets `nested[nestedKey] = true`. `value === undefined`
 * deletes `nested[nestedKey]` -- deleting the LAST remaining nested key
 * leaves an empty object (`{}`), which is a valid, harmless claim value; this
 * helper never collapses an empty nested map to `null` (that full-wipe
 * special-case belongs to `clearClaimKeys`'s TOP-LEVEL-key contract only, not
 * to a nested map inside an otherwise-populated claims object).
 */
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

/**
 * Detects the Firebase Admin SDK's `auth/claims-too-large` error -- thrown by
 * `setCustomUserClaims` when the serialized custom-claims object exceeds the
 * ~1000-byte cap (73-REVIEW.md WR-02). Shared by every claim-write call site
 * so a claims-too-large failure logs a distinguishable, greppable line rather
 * than being indistinguishable from any other transient Auth API failure.
 */
export function isClaimsTooLargeError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "auth/claims-too-large"
  );
}
