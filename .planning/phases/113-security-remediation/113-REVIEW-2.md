---
phase: 113-security-remediation
reviewed: 2026-09-02T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - firestore.rules
  - src/stores/services.ts
  - src/rules.test.ts
  - functions/src/orgMembershipClaims.ts
  - functions/src/orgMembershipClaims.test.ts
findings:
  critical: 1
  warning: 0
  info: 1
  total: 2
status: issues_found
---

# Phase 113: Code Review Report (Re-Review 2)

**Reviewed:** 2026-09-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is a re-review of the fixes claimed for 113-REVIEW.md's CR-01, WR-01, and IN-01. Two of
the three are genuinely closed with correct, non-tautological test coverage. **CR-01 is only
half-fixed**: the org-gated `shareTokens` list rule correctly satisfies `deleteService()`'s
cleanup query, but a **second, more heavily-used `list` call site on the same collection —
`ensureShareLink()`'s adopt-or-mint query — was never updated to carry the required `orgId`
equality filter**, and now fails closed under the new rule. This breaks share-link creation
(both the automatic one fired from `createService` and the manual "Share" button) for every
service that doesn't already have a `serviceShareLinks` doc — i.e. essentially every first
share. This is a new, severe functional regression introduced by (or at minimum left
unaddressed by) this remediation, and it ships silently: the rules suite and the mocked unit
suite both pass because neither exercises this exact query shape against live rules.

- **CR-01 (prior finding): PARTIALLY closed.** `deleteService()`'s query is correctly fixed.
  `ensureShareLink()`'s adoption query is not. See CR-02 below.
- **WR-01: CLOSED.** The removed-org-key diff correctly fires `revokeRefreshTokens` only on a
  genuine key drop, not on a role change or an active-flag flip. Both a positive and a negative
  test back this precisely (not tautological).
- **IN-01: CLOSED.** The dead create-branch is gone; `preservesLifecycleFields()` is now called
  only from `allow update`, where `resource` is guaranteed non-null, so behavior is unchanged.
- No regression found in Flow-2 invite acceptance or any other unrelated rule from this churn.

## Critical Issues

### CR-02: `ensureShareLink()`'s adoption query on `shareTokens` was not org-scoped, and now fails under the CR-01 list rule — breaks the primary share-link creation path

**File:** `src/stores/services.ts:814` (also `firestore.rules:367`)
**Issue:**

The CR-01 fix changed `shareTokens`' list rule from a flat deny to:

```
allow list: if isSignedIn() && isOrgEditor(resource.data.orgId);
```

As the fix's own comment at `firestore.rules:363-365` states, Firestore can only admit a `list`
against a rule that reads `resource.data.orgId` when the **query itself** carries a matching
equality filter on `orgId` — otherwise Firestore rejects the query outright as
`permission-denied`, regardless of whether any matching documents exist. `deleteService()` was
updated to add that filter (`firestore.rules:521`), and 113-REVIEW-2 confirms that fix is
correct.

However, `shareTokens` has a **second** `getDocs` call site with the exact same shape, and it
was not touched:

```js
// src/stores/services.ts:814 — ensureShareLink()'s adopt-or-mint query
const adoptionQuery = query(collection(db, 'shareTokens'), where('serviceId', '==', service.id))
const candidatesSnap = await getDocs(adoptionQuery)
```

No `orgId` equality filter. Under the new list rule this call now throws
`permission-denied` unconditionally — the query is rejected before Firestore even evaluates
whether any candidate exists.

`ensureShareLink()` only reaches this query when `serviceShareLinks/{service.id}` does **not**
yet exist (the `getDoc(linkRef)` steady-state check at line 798 misses). That is the case for:

1. **Every brand-new service.** `createService()` (services.ts:268-321) calls `ensureShareLink`
   immediately after creation specifically because the link doc doesn't exist yet. This call is
   wrapped in a soft-fail `try/catch` (line 305-319), so the auto-generated share link silently
   never gets created — every service created after this change ships with no share link, and
   the `serviceShareLinks` doc is never populated, so the failure repeats on every subsequent
   attempt too (see next point).
2. **Any manual "Share" click** via `ServiceEditorView.vue:4259/4292` or
   `ServiceCard.vue:259`, both of which call `serviceStore.createShareToken` →
   `ensureShareLink` with **no** soft-fail — the `catch` blocks in those components set
   `shareError.value = 'Failed to create share link'` and surface it to the user. Because (1)
   above means the link doc was never created at service-creation time either, this manual path
   is broken for essentially every service in the system, not just brand-new ones.

The comment introduced by the CR-01 fix (`firestore.rules:352-365`) explicitly claims
`deleteService()` is "the ONE legitimate `list` this collection needs" — that claim is false;
this adoption query is a second legitimate, and far more frequently exercised, `list` use that
the fix overlooked.

This was not caught by either test suite because:
- `src/rules.test.ts` only exercises the query shape used by `deleteService` (with the `orgId`
  filter present, lines 1299/1313) — there is no rules test for the unscoped
  `where('serviceId','==', x)`-only shape `ensureShareLink` actually issues.
- `src/stores/__tests__/services.test.ts` mocks `firebase/firestore` entirely, so it cannot
  observe a real rules-engine `permission-denied` on this query.

**Fix:** Add the same `orgId` equality filter to the adoption query — `pickAdoptableToken`
already filters candidates down to the caller's own `orgId` in JS (`src/utils/shareTokens.ts:74`),
so a matching org-scoped equality filter here changes nothing about the function's semantics,
only makes the query satisfiable under the new rule:

```js
const adoptionQuery = query(
  collection(db, 'shareTokens'),
  where('serviceId', '==', service.id),
  where('orgId', '==', orgIdValue),
)
```

Add a rules-suite regression test mirroring this exact shape (unscoped `serviceId`-only query
must fail; `serviceId` + `orgId` query for the caller's own org must succeed) so this class of
gap — a second call site with the same query shape that the reviewer/fixer didn't think to
check — can't silently reappear.

## Info

### IN-02: Redundant `isSignedIn()` in the new `shareTokens` list rule

**File:** `firestore.rules:367`
**Issue:** `allow list: if isSignedIn() && isOrgEditor(resource.data.orgId);` — `isOrgEditor()`
already opens with `isSignedIn() && (...)` (line 35), so the outer `isSignedIn()` is dead
weight, not a behavior difference. Every other data-scoped `isOrgEditor`-gated rule in this file
(e.g. `orgSlugs`, `orgNames`, `serviceShareLinks` create/update/delete) calls `isOrgEditor(...)`
bare, without a redundant `isSignedIn()` wrapper — this one line is the outlier.
**Fix:** Drop the redundant clause for consistency with the rest of the file:
```
allow list: if isOrgEditor(resource.data.orgId);
```

---

_Reviewed: 2026-09-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
