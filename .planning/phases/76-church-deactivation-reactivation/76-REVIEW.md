---
phase: 76-church-deactivation-reactivation
reviewed: 2026-08-23T00:45:56Z
depth: deep
files_reviewed: 15
files_reviewed_list:
  - functions/src/orgProvisioning.ts
  - functions/src/claimsHelpers.ts
  - functions/src/orgMembershipClaims.ts
  - functions/src/index.ts
  - firestore.rules
  - storage.rules
  - src/stores/auth.ts
  - src/views/SelectChurchView.vue
  - src/components/admin/OrganizationsTab.vue
  - functions/src/claimsHelpers.test.ts
  - functions/src/orgProvisioning.test.ts
  - src/rules.test.ts
  - src/storage.rules.test.ts
  - src/stores/__tests__/auth.test.ts
  - src/views/__tests__/SelectChurchView.test.ts
  - src/components/admin/__tests__/OrganizationsTab.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: fixed
fixed_at: 2026-08-23T01:15:00Z
fix_report: 76-REVIEW-FIX.md
---

# Phase 76: Code Review Report — Church Deactivation & Reactivation

**Reviewed:** 2026-08-23T00:45:56Z
**Depth:** deep (cross-file: functions ↔ firestore.rules ↔ storage.rules ↔ client store ↔ UI)
**Files Reviewed:** 15 (both plans: 76-01 server+rules, 76-02 client+UI)
**Status:** findings

## Summary

`patchNestedClaimKey` (the highest-priority item) is correct: a single `getUser`→mutate→`setCustomUserClaims`
read-mutate-write that preserves `superAdmin`, the `orgs` map, and every sibling `deactivatedOrgs` entry, with a
thorough test suite including an explicit deactivate→reactivate round trip. `firestore.rules`' `isOrgActive()`
default-true/`exists()`-guard composition into `isOrgMember`/`isOrgEditor` is sound and narrowly exempts only a
super-admin who already holds a genuine membership doc — it does not weaken the active check for anyone else.
`storage.rules`' `isOrgDeactivatedForCaller()` correctly wraps the *entire* `isOrgMemberByClaim` OR-expression
(both the legacy and multi-org arms), uses the safe `.get(key, default)` accessor, and is proven by real
emulator ALLOW/DENY tests including the specific "wraps the whole expression, not one arm" case. The client
(`src/stores/auth.ts`) correctly treats a denied primary-org read as the deactivation signal, always flips
`isReady`, and widens `requiresOrgSelection` for the single-org-deactivated case without regressing the
existing multi-org-picker / auto-enter / empty-state paths — well covered by tests. `revokeRefreshTokens` is
deactivate-only, targeted per affected member, never called on reactivate.

The one **Critical** finding is a genuine gap in the phase's core deliverable (R213: "all of its members are
blocked... enforced by storage.rules") that none of the shipped tests exercise: the `deactivatedOrgs` claim
fan-out only reaches members who are present in `organizations/{orgId}/members` **at the moment `setOrgActive`
runs**. Neither the pending-invite acceptance path (`firestore.rules`' `members/{uid}` create rule) nor
`assignOrgAdminHandler` were updated to respect the new `active` flag, so a member who joins a deactivated org
*after* the fan-out — via a pre-existing pending invite, or via a super-admin assigning a new admin to a
still-deactivated org — gets full, indefinite Storage access to that org's files despite Firestore correctly
denying them everything else.

## Critical Issues

### CR-01: A member who joins a deactivated org after the claim fan-out gets full, indefinite Storage access

**File:** `functions/src/orgProvisioning.ts:500-509` (fan-out scope), `firestore.rules:93-124` (invite-acceptance
create rule), `functions/src/orgProvisioning.ts:316-365` (`assignOrgAdminHandler`)

**Issue:** `setOrgActiveHandler`'s member fan-out is a one-time snapshot: it queries
`organizations/{orgId}/members` and patches `deactivatedOrgs[orgId]` only for the uids that exist **at that
instant**. Nothing keeps that claim in sync going forward, and two existing paths can add a *new* member to an
already-deactivated org without ever being taught about `active`:

1. **Invite acceptance** (`src/stores/auth.ts`'s `ensureUserDocument`, gated by `firestore.rules:93-124`'s
   `members/{uid}` `create` rule, Flow 2) has **no `isOrgActive()` check at all** — only "the invite exists and
   the role matches." A user with a pending invite created *before* deactivation can still accept it *after*
   deactivation, and the write succeeds.
2. **`assignOrgAdminHandler`** (`orgProvisioning.ts:316-365`) never reads `organizations/{orgId}.active` before
   calling `writeAdminAssignment`. A super-admin can click "Assign admin" on a deactivated org row in
   `OrganizationsTab.vue` (that button has no `:disabled` tied to `org.active`) and successfully create a brand
   new membership.

Either path fires `syncOrgMembershipClaim` (`orgMembershipClaims.ts`), which sets valid `orgId`/`role`/`orgs`
claims for the new member — but that trigger was deliberately left untouched by this phase and never consults
`deactivatedOrgs` or the org's `active` field. The new member therefore ends up with a token that satisfies
`isOrgMemberByClaim` and carries **no** `deactivatedOrgs[orgId]` entry at all, so
`storage.rules`' `isOrgDeactivatedForCaller(orgId)` evaluates `false` and Storage access is **granted** —
indefinitely, since nothing will ever fan the claim out to this uid unless a future `setOrgActive` call happens
to run again after they've joined. Firestore access is still correctly denied (the live `isOrgActive()` check
covers reads/writes independent of membership timing), so this is Storage-only, but it directly defeats R213's
"all of its members are blocked... enforced by storage.rules" for anyone who joins after the toggle.

This is not a documented/accepted trade-off: 76-RESEARCH.md's four "Common Pitfalls" cover the legacy-arm OR,
`revokeRefreshTokens`'s bounded-exposure nature, the nested-claim-delete shape, and partial fan-out failure —
none of them address a member joining after the fan-out ran.

**Fix:** Close at least one of the two paths (both is safer):
```typescript
// orgProvisioning.ts — assignOrgAdminHandler, after the existing not-found check:
const orgActive = (orgSnap.data() as { active?: boolean } | undefined)?.active ?? true;
// ... after writeAdminAssignment's batch commits, if the target is an existing user and !orgActive:
if (!orgActive && target.kind === "existing") {
  await patchNestedClaimKey(target.uid, DEACTIVATED_ORGS_CLAIM_KEY, orgId, true);
}
```
```
// firestore.rules — members/{uid} create rule (Flow 2, invite acceptance), add the same
// isOrgActive(orgId) guard the read/write rules already carry:
(request.auth.token.email != null
  && exists(.../invites/$(request.auth.token.email.lower()))
  && request.resource.data.role == get(.../invites/$(...)).data.role
  && isOrgActive(orgId))
```
Either change should ship with a dedicated regression test (an emulator ALLOW/DENY pair for invite acceptance
against a deactivated org, and a unit test for `assignOrgAdminHandler` targeting a deactivated org).

## Warnings

### WR-01: `claimFailures` is never surfaced to the operator, defeating its own documented purpose

**File:** `src/components/admin/OrganizationsTab.vue:420-450`

**Issue:** 76-RESEARCH.md's Pitfall 4 explicitly designs `claimFailures` as "the resilience story ... calling
`setOrgActive` again is a safe, idempotent retry" — i.e. the operator is expected to notice a nonzero count and
retry. `onToggleActive` receives `result.data.claimFailures` (typed in `SetOrgActiveResponse`) but never reads
it; on any response, success or partial, the UI shows an unqualified `'Deactivated.'`/`'Reactivated.'`. If even
every member's claim patch fails (e.g. a transient Admin API outage) while the org-doc write succeeds, the
admin has no way to know Storage enforcement never actually reached anyone and no reason to retry.

**Fix:**
```typescript
toggleFeedback.value = {
  ...toggleFeedback.value,
  [orgId]: result.data.claimFailures > 0
    ? `${nextActive ? 'Reactivated' : 'Deactivated'}, but ${result.data.claimFailures} member claim update(s) failed — click again to retry.`
    : nextActive ? 'Reactivated.' : 'Deactivated.',
}
```

### WR-02: `claimFailures` conflates a failed claim patch with a failed `revokeRefreshTokens` call

**File:** `functions/src/orgProvisioning.ts:500-510`

**Issue:** Each `Promise.allSettled` entry runs `await patchNestedClaimKey(...)` then, on deactivate,
`await getAuth().revokeRefreshTokens(uid)` — both inside the same try. If the claim patch succeeds but the
revoke call throws, that member's entry is still counted in `claimFailures`, identical to a member whose claim
patch itself never landed. A retry is harmless (patching an already-patched key is idempotent) but the response
gives no way to distinguish "this uid's Storage-side deny never took effect" (needs a retry) from "the deny is
in place, only the bounded-exposure revoke didn't fire" (cosmetic, self-heals within the token's remaining
lifetime).

**Fix:** Track the two outcomes separately, e.g. return `{ claimFailures, revokeFailures }`, or only count a
`patchNestedClaimKey` rejection toward `claimFailures` and log-only (not count) a `revokeRefreshTokens`
rejection.

### WR-03: Reactivate's fan-out never reaches a member who left mid-deactivation and later rejoins

**File:** `functions/src/orgProvisioning.ts:500-509`

**Issue:** Symmetric to CR-01 but for the reactivate direction and a narrower trigger: if a member is removed
from `organizations/{orgId}/members` while the org is deactivated (e.g. by a super-admin, since an ordinary
editor's writes are blocked by `isOrgEditor`'s own `isOrgActive` check) and later re-added, the reactivate
fan-out that already ran before they rejoined never cleared their `deactivatedOrgs[orgId]` entry, and nothing
else ever will. That member keeps a permanent, incorrect Storage lockout on an otherwise fully-reactivated org.
Lower likelihood than CR-01 (requires a super-admin-driven membership removal during the deactivation window,
for which this codebase currently has no dedicated admin-console action), but the same class of bug: the
fan-out is a point-in-time operation over a set that can change out from under it.

**Fix:** Same root fix as CR-01 — make claim state resync whenever `syncOrgMembershipClaim` fires (read the
org's `active` field and set/clear `deactivatedOrgs[orgId]` accordingly on every membership write), rather than
relying solely on `setOrgActive`'s one-shot fan-out.

## Info

### IN-01: Pre-existing latent `orgs != null` guard quirk (out of scope, noted per plan)

**File:** `storage.rules:52-57`

Already flagged by the executor's own code comment: the multi-org arm's `request.auth.token.orgs != null`
guard has the same "absent custom-claim key does not reliably evaluate to null in the Storage rules engine"
quirk that motivated `isOrgDeactivatedForCaller`'s `.get(key, default)` form — currently masked only by the
unconditional OR with the legacy arm. Confirmed present; out of scope for Phase 76 per the review brief, no fix
proposed here.

### IN-02: `loadOrgContext`'s member-doc listener has no error callback

**File:** `src/stores/auth.ts:471-496`

If an org is deactivated by another admin while a member has a live session, the `members/{uid}` `onSnapshot`
listener will start receiving `permission-denied` on its next re-evaluation (the underlying `isOrgMember` rule
re-reads the org doc live), but `onSnapshot` is called here with no error callback, so the rejection is
swallowed to the console with no user-facing signal — the member continues operating on stale in-memory
`orgName`/`userRole`/etc. until their session next reloads or their refresh token is rejected (bounded to
`revokeRefreshTokens`'s documented ≤1h window). R213's stated scope is the sign-in/org-load path, not real-time
mid-session revocation, so this is not a regression against a stated requirement — just a residual UX gap worth
a follow-up if it surfaces in practice.

---

## Resolution (76-REVIEW-FIX.md, 2026-08-23T01:15:00Z)

All in-scope findings addressed. See `76-REVIEW-FIX.md` for full detail, commit hashes, and gate results.

- **CR-01 — fixed (fully closed).** Primary fix: `orgMembershipClaims.ts`'s `syncOrgMembershipClaim`
  trigger now recomputes `deactivatedOrgs` (via new `computeDeactivatedOrgsClaimForUid`) from each
  surviving org's LIVE `active` field on every membership write — self-healing the claim for any path
  that adds a member (pending-invite acceptance, `assignOrgAdminHandler`, onboarding), not just
  `setOrgActive`'s point-in-time fan-out. Belt-and-suspenders: `assignOrgAdminHandler` now also refuses
  outright (`failed-precondition`) to assign an admin into a deactivated org. `firestore.rules`'
  invite-acceptance create rule was deliberately left untouched per the review brief's guidance — the
  trigger self-heal is the safety net for that path.
- **WR-01 — fixed.** `OrganizationsTab.vue`'s `onToggleActive` now reads `result.data.claimFailures` and
  surfaces a non-blocking, longer-lived amber warning ("N member claim update(s) failed — click again to
  retry") instead of an unqualified success message.
- **WR-02 — fixed.** `setOrgActiveHandler`'s fan-out now tracks `patchNestedClaimKey` and
  `revokeRefreshTokens` outcomes independently, returning both `claimFailures` and a new
  `revokeFailures` field rather than conflating them.
- **WR-03 — fixed (confirmed via the CR-01 primary fix).** The same trigger self-heal recomputes
  `deactivatedOrgs` from the org's current `active` state on EVERY membership write, so a member removed
  and later re-added mid-deactivation (or after reactivation) gets a freshly-computed value, not a stale
  fan-out-time one. Covered by a dedicated unit test.
- **IN-01 — accepted, no fix.** Pre-existing latent `orgs != null` guard quirk; out of scope per the
  review brief.
- **IN-02 — accepted, no fix.** `loadOrgContext`'s `onSnapshot` listener still has no error callback for
  live mid-session deactivation; noted as a residual UX gap, not a regression against R213's stated
  sign-in/org-load scope.

---

_Reviewed: 2026-08-23T00:45:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
