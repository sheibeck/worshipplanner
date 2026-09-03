---
phase: 113-security-remediation
reviewed: 2026-09-02T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - firestore.rules
  - functions/src/orgMembershipClaims.ts
  - functions/src/orgMembershipClaims.test.ts
  - src/rules.test.ts
  - src/storage.rules.test.ts
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 113: Code Review Report

**Reviewed:** 2026-09-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the SEC-S-01 (shareTokens/quarterShares/serviceShares get/list split), SEC-ISO-01
(legacy org self-provisioning removal), and SEC-ISO-02 (revokeRefreshTokens on member
removal) remediations for correctness and completeness.

**SEC-S-01** is correctly implemented for all three collections
(`allow get: if true; allow list: if false;`), and no other collection in `firestore.rules`
was left with an unaddressed public `list` surface — `orgSlugs`/`orgNames` are the accepted
SEC-ISO-06 backlog residual per the review brief, and everything else denies by default.
**However, the split breaks a real legitimate query the app makes**: `deleteService()` in
`src/stores/services.ts` queries `shareTokens` by `serviceId` (not by doc id) to revoke every
token adopted for a deleted service. That query is a `list` operation and is now
unconditionally denied — see CR-01 below. This is the exact regression class the review brief
asked to check for ("If the app legitimately lists one of these somewhere, list:false would
break it") and it was not caught by any test (no rules-test exercises `deleteService`'s
shareTokens cleanup, and the store's own unit tests mock Firestore so they can't see a rules
denial).

**SEC-ISO-01** is correctly and completely implemented: `organizations/{orgId}` has no
`allow create` clause left, the `members/{uid}` create rule now permits only Flow 2 (invite
acceptance via `inviteLookup`), the client (`ensureUserDocument` in `src/stores/auth.ts`) no
longer attempts the removed Flow-1 batch, and the "founder self-provision" trap test is
correctly flipped to `assertFails`. Flow 2 (invite acceptance) is intact and covered by both
positive and negative tests.

**SEC-ISO-02** is correctly wired for the primary case: `revokeRefreshTokens(uid)` lives only
in the `clear` branch (primary-org member removal), fires with the removed uid, after the
claim clear, in a try/catch that never surfaces as `action: "failed"`. Tests assert the exact
uid and the swallow-on-failure behavior. One residual gap: a member removed from a
**non-primary** org (`decideMembershipClaim` returns `skip`/`not-primary-org`) never reaches
the `clear` branch, so `revokeRefreshTokens` is never called for that removal even though the
`orgs` claim map is recomputed to drop it — see WR-01 below.

## Critical Issues

### CR-01: SEC-S-01's shareTokens get/list split breaks the deleteService cleanup query, silently leaving public share links live forever after the service is deleted

**File:** `firestore.rules:346-347` (the `allow list: if false;` on `shareTokens`)
**Also implicated:** `src/stores/services.ts:509-519`

**Issue:** `deleteService()` revokes a service's public share artifacts before deleting the
service doc. For `shareTokens` specifically it does not know the token id (a service can have
2+ adopted tokens), so it queries by field instead of by id:

```ts
// src/stores/services.ts:513
const tokensSnap = await getDocs(query(collection(db, 'shareTokens'), where('serviceId', '==', id)))
for (const tokenDoc of tokensSnap.docs) {
  await deleteDoc(doc(db, 'shareTokens', tokenDoc.id))
}
```

A `collection().where()` query is a Firestore `list` operation, not `get`. Before this phase,
`shareTokens` had `allow read: if true`, which grants both `get` and `list`, so this query
succeeded. After the SEC-S-01 split (`allow get: if true; allow list: if false;`), this query
is now **unconditionally denied** for every caller, including the org editor who owns the
service being deleted. The call is wrapped in try/catch
(`catch (err) { console.error(...); }`), so the deletion itself does not fail and no user-
facing error appears — but the shareTokens cleanup step now silently no-ops on every service
deletion.

The practical effect: a `shareTokens` doc carries a full `serviceSnapshot` (the shared
content) and is public-readable by design (`allow get: if true`). Once `deleteService()` can
no longer revoke it, **any previously-shared public link for a deleted service keeps serving
its snapshot indefinitely** — the exact "revoke on delete" guarantee the feature and its own
code comments (`R234`, "revoke public share artifacts FIRST") promise is now permanently
broken for `shareTokens` specifically. (The `quarterShares`/`serviceShares` revocation paths in
`src/stores/quarters.ts` use direct-keyed `getDoc`/`deleteDoc`, not a query, so they are
unaffected by the `list: false` change — this is isolated to `shareTokens`.)

No test in `src/rules.test.ts` or `src/stores/__tests__/services.test.ts` exercises this path
against real rules (the store test mocks Firestore, and the rules-test DENY-case coverage for
SEC-S-01 only proves an *unauthenticated* `getDocs(collection(db, 'shareTokens'))` is denied —
it never exercises the authenticated, `where('serviceId', '==', id)`-scoped query an org editor
actually issues from `deleteService`), so this regression shipped un-caught.

**Fix:** `deleteService` cannot use a collection query against `shareTokens` anymore. Either:
1. Store the set of adopted token ids on the service doc (or a side index client code can read
   by id) so revocation becomes direct-keyed `getDoc`/`deleteDoc`, matching the
   `quarterShares`/`serviceShares` pattern already used in `quarters.ts`; or
2. Move this specific cleanup step into an Admin-SDK Cloud Function trigger
   (`onDocumentDeleted('organizations/{orgId}/services/{serviceId}')`) that queries
   `shareTokens` server-side, bypassing rules entirely — consistent with how this repo already
   treats other Admin-SDK-only cleanup sweeps.

Either way, this needs a rules-test (or functions-test, for option 2) that seeds an org editor,
seeds 2+ `shareTokens` docs for the same `serviceId`, invokes the real deletion path, and
asserts the tokens are actually gone — not just that unauthenticated `list` is denied.

## Warnings

### WR-01: revokeRefreshTokens is never called when a member is removed from a non-primary org

**File:** `functions/src/orgMembershipClaims.ts:298-319` (the `skip` case of
`syncOrgMembershipClaimHandler`'s switch), compare to the `clear` case at lines 276-297

**Issue:** `decideMembershipClaim` only returns `{ action: "clear" }` when the deleted
membership doc belongs to the user's **primary** org (`orgIds[0]`). A delete of a
**non-primary** membership returns `{ action: "skip", reason: "not-primary-org" }`
(`orgMembershipClaims.ts:172-174`), which recomputes and writes the `orgs`/`deactivatedOrgs`
maps (dropping the removed org) but never enters the `clear` branch — so
`getAuth().revokeRefreshTokens(uid)` is never invoked for that removal.

Because Firebase custom claims only take effect on token refresh (natural expiry, ~1 hour, or
a forced `getIdTokenResult(user, true)`), a user removed from a non-primary org retains a
still-valid ID token carrying the old `orgs` entry for the org they were just removed from,
for up to an hour, even though their Firestore membership doc is already gone. This is a
narrower blast radius than the primary-org case SEC-ISO-02 closes (the user still has a
legitimate primary-org session; this is not a full-account-compromise scenario), but it is a
real residual access window for the specific org they were removed from, and it sits in the
same code path SEC-ISO-02 just hardened.

**Fix:** Either call `revokeRefreshTokens(uid)` in the `skip` branch too whenever
`desiredOrgs` loses a key relative to `existingClaims?.orgs` (i.e., a genuine membership
removal, not merely a role change or an unrelated org's active-flag flip), or explicitly
document this as an accepted residual (mirroring how `orgSlugs`/`orgNames` public-read is
documented as SEC-ISO-06 backlog) so it isn't mistaken for full SEC-ISO-02 coverage later.

## Info

### IN-01: preservesLifecycleFields()'s "create" branch is now dead code

**File:** `firestore.rules:86-96`

**Issue:** `preservesLifecycleFields()` branches on `request.resource == null` (delete) vs.
`resource == null` (create, "no prior doc") vs. update (diff against `resource.data`). SEC-
ISO-01 removed the only `allow create` clause on `organizations/{orgId}` that ever invoked this
function in create context; it is now called exclusively from `allow update`
(`firestore.rules:124`), where `resource` is guaranteed non-null by Firestore's own operation
semantics (an `update` cannot target a nonexistent document). The `resource == null ?
!request.resource.data.keys().hasAny(...) : ...` create branch (line 91-93) is therefore
unreachable.

This is not a security issue (the unreachable branch, if it somehow ran, is at least as
restrictive as the update branch, not less), but it is stale logic left behind by SEC-ISO-01's
removal of the create path, and a future reader could reasonably assume it still guards a live
create flow.

**Fix:** Either delete the now-dead create branch and its comment, or add a one-line note next
to it explicitly stating it is intentionally retained as inert/defense-in-depth in case a
create clause is ever reintroduced.

---

_Reviewed: 2026-09-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
