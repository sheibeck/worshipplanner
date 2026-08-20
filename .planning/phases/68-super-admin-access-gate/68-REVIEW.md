---
phase: 68-super-admin-access-gate
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - functions/src/claimsHelpers.ts
  - functions/src/orgMembershipClaims.ts
  - functions/src/superAdminClaims.ts
  - functions/src/bootstrapSuperAdmin.ts
  - functions/src/index.ts
  - firestore.rules
  - src/stores/auth.ts
  - src/router/index.ts
  - src/components/AppSidebar.vue
  - src/views/OwnerConsoleView.vue
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 68: Code Review Report

**Reviewed:** 2026-08-20
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This is a well-executed phase for the security-sensitive surface it covers. The core claim-merge-safety
fix (`claimsHelpers.ts`'s `mergeAndSetCustomClaims`/`clearClaimKeys`) is correctly applied to BOTH branches
of `orgMembershipClaims.ts` (the `'set'` AND `'clear'` cases — Pitfall 1 from RESEARCH.md is genuinely
avoided) and to both directions of `superAdminClaims.ts`. The `setSuperAdminClaim` onCall independently
re-verifies caller authority two ways (token claim + fresh Firestore re-read), resolves the target
exclusively by email server-side (never a client-supplied uid), and the revoke path calls
`revokeRefreshTokens`. `firestore.rules`' `isSuperAdmin()` is genuinely claim-only with no `get()`/`exists()`
call, correctly placed above the catch-all deny rule, and does not collide with the `role`/`admin→editor`
namespace. The client console never writes `superAdmins/*` directly — every grant/revoke routes through the
callable. `functions/src/index.ts` correctly excludes `bootstrapSuperAdmin.ts` from its exports, and the
bootstrap script's dry-run path performs no writes (verified: only a read-only `getUserByEmail` call runs
when `--apply` is absent). `npx tsc --noEmit` on `functions/` is clean.

Three genuine issues found, all Warning-tier (no Critical/blocker-level defect — no privilege-escalation
path, no rule that denies-everyone, no data loss). The most concrete is a missing runtime validation on the
`grant` boolean field of the `setSuperAdminClaim` payload, which silently falls through to the REVOKE branch
on any malformed/incomplete call. The other two are a residual concurrent-write race in the claim-merge
helpers (inherent to the read-then-write pattern, not fully closed by this phase's fix) and a router-guard
race-condition risk from not mirroring the codebase's own more defensive `waitForRole()` wait pattern.

## Warnings

### WR-01: `setSuperAdminClaim` does not validate `grant` is actually a boolean — a malformed call silently revokes instead of erroring

**File:** `functions/src/superAdminClaims.ts:130-160`
**Issue:** `targetEmail` is validated (`if (!targetEmail) throw HttpsError('invalid-argument', ...)`), but
`grant` is not. The branch is a bare truthiness check:
```ts
const { targetEmail, grant } = request.data ?? ({} as SetSuperAdminClaimRequest);
if (!targetEmail) {
  throw new HttpsError("invalid-argument", "targetEmail is required.");
}
...
if (grant) {
  await targetRef.set({ ... });          // grant path
} else {
  await targetRef.delete();               // revoke path — also revokes refresh tokens
  await getAuth().revokeRefreshTokens(targetUid);
}
```
`CallableRequest<SetSuperAdminClaimRequest>`'s `grant: boolean` is a compile-time-only guarantee — nothing
enforces it at the actual network boundary (a raw `httpsCallable` invocation, a curl/Postman test against
the callable endpoint, or a future client bug that omits the field) can send `{ targetEmail }` with `grant`
missing/`undefined`/`null`/`0`/`""`. Because the code branches on `if (grant)` rather than
`if (grant === true)` with an explicit `else if (grant === false)` / reject-otherwise, ANY falsy or absent
`grant` silently takes the REVOKE path — deleting the target's `superAdmins/{targetUid}` doc and revoking
their refresh tokens, even when the caller's intent (or a client-side bug) was to grant. This is the more
dangerous of the two possible failure directions (privilege loss for a legitimate admin, not privilege gain
for an attacker), but it is a genuine correctness gap on a security-critical write path with no test guarding
the "missing grant field" case (per the required-reading grep, `superAdminClaims.ts` has no
`typeof grant === 'boolean'` or `grant === false` check anywhere).
**Fix:**
```ts
if (typeof grant !== "boolean") {
  throw new HttpsError("invalid-argument", "grant (boolean) is required.");
}
```

### WR-02: `mergeAndSetCustomClaims`/`clearClaimKeys` have no protection against concurrent claim writes for the same uid (residual TOCTOU race)

**File:** `functions/src/claimsHelpers.ts:29-51`
**Issue:** Both helpers are read-then-write with no compare-and-swap or transaction:
```ts
export async function mergeAndSetCustomClaims(uid, patch) {
  const user = await getAuth().getUser(uid);          // READ
  const current = (user.customClaims ...) ?? {};
  await getAuth().setCustomUserClaims(uid, { ...current, ...patch });  // WRITE (stale read wins)
}
```
This phase's fix genuinely closes the *sequential* replace-clobbers-unrelated-key bug (Pitfall 1 — both
branches of `orgMembershipClaims.ts` correctly route through this helper now). It does **not** close a
*concurrent* race: if `syncOrgMembershipClaim` (triggered by an org-membership write) and
`syncSuperAdminClaim` (triggered by a `superAdmins/{uid}` write) both fire for the **same uid** within the
same short window — e.g., an owner grants super-admin to a user at nearly the same moment that user's org
role changes, or a revoke's `syncSuperAdminClaim` clear races a concurrent org-membership `set` — both
handlers call `getAuth().getUser(uid)` independently, and whichever `setCustomUserClaims` call lands second
overwrites the first with a claims object computed from a now-stale read, silently dropping the first
writer's change. `firebase-admin`'s Auth API has no primitive for a compare-and-swap custom-claims write, so
this cannot be fully closed without an external lock (e.g., a Firestore transaction gating both writers on a
shared per-uid doc) — which is out of scope for this phase's stated fix, but the residual risk is not
documented anywhere in the code or CONTEXT/RESEARCH, and the review's focus area explicitly asked about it
("race conditions on concurrent claim writes"). In practice the window is narrow (both are infrequent admin
actions), so this is Warning- not Critical-tier, but it should be called out as a known limitation rather
than silently assumed closed by "the merge-safety fix."
**Fix:** Document the residual race as a known limitation in `claimsHelpers.ts`'s header comment (mirroring
how other residual risks in this codebase — e.g., the ≤1hr revoke-propagation window — are explicitly
documented rather than left implicit). If eliminating it is ever required, gate both writers through a
Firestore transaction on a shared per-uid claims-lock document, or serialize claim writes for a given uid
through a Cloud Tasks queue.

### WR-03: `requiresSuperAdmin` router guard reads `authStore.user` without waiting for it to be populated, unlike the more defensive `requiresEditor`/`waitForRole()` pattern

**File:** `src/router/index.ts:135-147`, `src/stores/auth.ts:165-177`
**Issue:** The `requiresEditor` guard branch explicitly waits for auth state to settle:
```ts
if (to.meta.requiresEditor) {
  const authStore = useAuthStore()
  await authStore.waitForRole()   // <- blocks until userRole is non-null or unauthenticated
  if (!authStore.isEditor) return { name: 'services' }
}
```
`waitForRole()` uses a `watch()` that resolves only once `userRole.value` is actually populated (or the user
is confirmed unauthenticated). The new `requiresSuperAdmin` branch does not follow this pattern:
```ts
if (to.meta.requiresSuperAdmin) {
  const authStore = useAuthStore()
  await authStore.refreshSuperAdminClaim()   // <- does NOT wait for user.value to be set
  if (!authStore.isSuperAdmin) return { name: 'services' }
}
```
and `refreshSuperAdminClaim()` itself:
```ts
async function refreshSuperAdminClaim(): Promise<void> {
  const currentUser = user.value
  if (!currentUser) {
    isSuperAdmin.value = false     // <- bails immediately, no wait/retry
    return
  }
  ...
}
```
If `authStore.user.value` has not yet been populated by the store's own `onAuthStateChanged` listener at the
moment this guard runs — the listener is only registered on the *first* `useAuthStore()` call anywhere in
the app (Pinia stores are lazy), which today happens to occur earlier in `App.vue`'s `setup()`
(`const authStore = useAuthStore()` at module scope) before the router resolves its first navigation, so in
practice the ordering usually works out — a genuine, already-authenticated super-admin doing a fresh
page-load/reload directly on `/owner-console` could be incorrectly redirected to `/services`, since
`refreshSuperAdminClaim` bails with `isSuperAdmin = false` on the first check rather than waiting like
`waitForRole()` does. This is an implicit ordering dependency on component-mount timing, not an explicit,
tested guarantee, and it is fragile to a future refactor (e.g., code-splitting `App.vue`, deferring the
store's first use, or moving the owner-console link into a component that mounts before `App.vue`'s setup
runs).
**Fix:** Either wait for `isReady.value` (already tracked in the store) before calling
`refreshSuperAdminClaim()`, or give `refreshSuperAdminClaim` the same bounded-retry/wait shape as
`waitForRole()`/`refreshOrgClaim` rather than a single immediate check-and-bail.

## Info

### IN-01: `getUserByEmail` failures are collapsed to a generic "not-found", masking transient/infra errors

**File:** `functions/src/superAdminClaims.ts:135-142`
**Issue:**
```ts
try {
  const targetUser = await getAuth().getUserByEmail(targetEmail);
  targetUid = targetUser.uid;
} catch (err) {
  console.error("[superAdminClaims] setSuperAdminClaim: getUserByEmail failed:", err);
  throw new HttpsError("not-found", `No user found for email "${targetEmail}".`);
}
```
Any failure from `getUserByEmail` — including a malformed email causing `auth/invalid-email`, or a transient
Admin SDK/network failure — is reported to the caller as "no user found," which is misleading for anything
other than the genuine `auth/user-not-found` case. Low severity since the error is logged server-side and
the caller is already a verified super-admin (not an external attacker), but worth narrowing to the specific
Firebase error code for a clearer operator-facing message.
**Fix:** Check `(err as { code?: string }).code === 'auth/user-not-found'` before choosing the `not-found`
HttpsError code; otherwise rethrow as `internal`.

### IN-02: No "last super-admin" lockout guard — a super-admin can revoke the only other/last super-admin (including, via direct API call, themselves) via the callable

**File:** `functions/src/superAdminClaims.ts:106-163`, `src/views/OwnerConsoleView.vue:62`
**Issue:** The UI defensively hides the revoke action for the signed-in user's own row (`v-if="admin.uid ===
authStore.user?.uid"` shows "You" instead of a Revoke button), but `setSuperAdminClaimHandler` itself has no
server-side check preventing a super-admin from revoking themselves or the last remaining super-admin via a
direct callable invocation (bypassing the UI). This is recoverable (the owner-run `bootstrapSuperAdmin.ts`
script can re-grant with no pre-existing super-admin required), so it is not a data-loss risk, but it is a
foot-gun with no guardrail and no test coverage for the "revoke leaves zero super-admins" case. Not required
by 68-CONTEXT.md (the roster is explicitly "minimal" for this phase), so this is informational rather than a
blocking gap.
**Fix (optional, future phase):** In `setSuperAdminClaimHandler`'s revoke branch, count remaining
`superAdmins` docs before deleting and reject with `failed-precondition` if the target is the last one.

### IN-03: Client-side email format check is a weak heuristic and duplicated nowhere else consistently

**File:** `src/views/OwnerConsoleView.vue:161-164`
**Issue:** `isValidEmailFormat` only checks for the presence of `@` and `.` (`e.includes('@') &&
e.includes('.')`), which accepts many invalid strings (e.g., `"@."`, `"a@.b"`). This is client-side UX only
— the real validation is the server's `getUserByEmail` lookup, which correctly rejects anything that isn't a
real registered account — so this has no security impact. Purely a UX polish item: obviously-malformed input
gets a confusing round-trip to the server's generic "No user found" error instead of an immediate,
more specific inline message.
**Fix:** Use a slightly stricter pattern (e.g. `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) if the loose check ever causes
support friction; not required to ship this phase.

---

_Reviewed: 2026-08-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
