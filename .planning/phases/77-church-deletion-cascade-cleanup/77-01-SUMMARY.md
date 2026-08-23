---
phase: 77-church-deletion-cascade-cleanup
plan: 01
subsystem: auth
tags: [firebase-functions, firestore-rules, cloud-functions, admin-sdk, storage]

# Dependency graph
requires:
  - phase: 76-church-deactivation-reactivation
    provides: "organizations/{orgId}.active field, setOrgActive lifecycle-field firestore.rules guard"
  - phase: 74-organizations-onboard-assign
    provides: assertSuperAdminCaller, normalizeOrgName, the orgProvisioning.ts callable pattern
provides:
  - "deleteOrganization({orgId, confirmName}) super-admin-gated callable — permanent cascade deletion of a deactivated church"
  - "EXTRA_ORG_KEYED_COLLECTIONS — the 5 orgId-keyed top-level collections (shareTokens/serviceShareLinks/orgSlugs/quarterShares/serviceShares) recursiveDelete cannot see"
  - "firestore.rules organizations/{orgId}: allow delete: if false (unconditional, Admin-SDK-only)"
affects: [77-02-client-delete-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "recursiveDelete(orgRef) for the whole org subtree, LAST -- after every cross-reference read/write and Storage sweep have completed (never before, or the cross-references it depends on are gone)"
    - "READ-everything-before-DELETE-anything: members, inviteLookup, orgNames guard, and the 5 extra collections are all captured into memory before any batch commits or recursiveDelete/deleteFiles fire"
    - "chunked WriteBatch (<=500 ops/batch, committed sequentially) for a cascade whose combined member+invite+share-doc count could exceed Firestore's single-batch cap"
    - "firestore.rules: allow write -> allow update narrowing is REQUIRED before a sibling allow delete: if false has any effect -- Firestore OR-evaluates every matching allow clause per operation, so a broader write grant silently wins over a narrower explicit deny"

key-files:
  created:
    - functions/src/orgDeletion.ts
    - functions/src/orgDeletion.test.ts
  modified:
    - functions/src/orgProvisioning.ts
    - functions/src/index.ts
    - firestore.rules
    - src/rules.test.ts

key-decisions:
  - "The 5 orgId-keyed top-level collections (shareTokens, serviceShareLinks, orgSlugs, quarterShares, serviceShares) are IN SCOPE for this cascade, per 77-RESEARCH.md Open Question 1's recommendation and the owner's 'everything associated with it' framing -- resolves T-77-07"
  - "aiUsage/aiRateLimits are deliberately OUT OF SCOPE (77-RESEARCH.md Open Question 2) -- platform cost-observability ledger, not tenant content"
  - "orgNames deletion is guarded: only deleted when its stored orgId matches the target org, closing the rename-collision risk 77-RESEARCH.md Pitfall 2 flags"
  - "firestore.rules delete DENY is UNCONDITIONAL -- no isSuperAdmin() exemption -- since the only legitimate deletion path is the Admin-SDK callable, which bypasses rules entirely (Pitfall 5)"

requirements-completed: [R215, R216, R217, R218, R219, R221]

coverage:
  - id: D1
    description: "deleteOrganization refuses an org whose active field is not explicitly false with failed-precondition, before any cascade read"
    requirement: R215
    verification:
      - kind: unit
        ref: "functions/src/orgDeletion.test.ts#deleteOrganizationHandler: eligibility gates"
        status: pass
    human_judgment: false
  - id: D2
    description: "assertSuperAdminCaller re-verified FIRST (claim + independent Firestore re-read); confirmName strict-matched against the server's stored name; client never bulk-deletes organizations/*, subcollections, orgNames/*, or inviteLookup/* directly"
    requirement: R216
    verification:
      - kind: unit
        ref: "functions/src/orgDeletion.test.ts#deleteOrganizationHandler: caller gate"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#Org deletion DENY (Phase 77, R216/T-77-04) — Admin-SDK-only"
        status: pass
    human_judgment: false
  - id: D3
    description: "No document survives under organizations/{orgId} -- recursiveDelete invoked last, after every cross-reference read/write and Storage sweep"
    requirement: R217
    verification:
      - kind: unit
        ref: "functions/src/orgDeletion.test.ts#deleteOrganizationHandler: cascade call order, recursiveDelete"
        status: pass
    human_judgment: false
  - id: D4
    description: "orgNames/{nameKey} (guarded), every matching inviteLookup/{email}, every matching doc across the 5 extra orgId-keyed collections, and each affected member's users/{uid}.orgIds (via arrayRemove, never overwrite) are removed; other orgs' data is untouched"
    requirement: "R218, R219"
    verification:
      - kind: unit
        ref: "functions/src/orgDeletion.test.ts#member unlinking, inviteLookup cleanup, orgNames guard, extra orgId-keyed collections, Storage cleanup"
        status: pass
    human_judgment: false
  - id: D5
    description: "Retrying an interrupted deleteOrganization call completes without throwing, returns zeroed counts for already-clean steps, and never touches another org's data"
    requirement: R221
    verification:
      - kind: unit
        ref: "functions/src/orgDeletion.test.ts#deleteOrganizationHandler: idempotent retry"
        status: pass
    human_judgment: false

# Metrics
duration: ~2h
completed: 2026-08-22
status: complete
---

# Phase 77 Plan 01: Church Deletion — Server Cascade + Rules DENY Summary

**Super-admin-gated `deleteOrganization` callable performing a full read-before-delete cascade (members, inviteLookup, orgNames, the 5 extra orgId-keyed collections, Storage, recursiveDelete) plus an unconditional `firestore.rules` client-delete DENY — shipped built, tested, and UNDEPLOYED.**

## Performance

- **Duration:** ~2h
- **Completed:** 2026-08-22
- **Tasks:** 2/2
- **Files modified/created:** 6 (2 new, 4 modified)

## Accomplishments

- `deleteOrganization({orgId, confirmName})` callable (`functions/src/orgDeletion.ts`): gated by `assertSuperAdminCaller` (imported from `orgProvisioning.ts`, not duplicated) FIRST; refuses `failed-precondition` on an org whose `active` is not explicitly `false`; refuses `invalid-argument` on a `confirmName` that doesn't strictly (`===`) match the server-stored org `name`; logs a single audit line (`orgId`, `name`, `callerUid`) once every guard has passed.
- READ phase (Pattern 2 / Pitfall 1): captures member uids, `inviteLookup` docs matching this org, the `orgNames` guard read, and all 5 `EXTRA_ORG_KEYED_COLLECTIONS` (`shareTokens`, `serviceShareLinks`, `orgSlugs`, `quarterShares`, `serviceShares`) — all fully resolved before any delete fires.
- WRITE phase: one ordered list of pending writes (per-member `users/{uid}` merge-set with `orgIds: arrayRemove(orgId)` — never an overwrite — plus deletes for `inviteLookup`, the guarded `orgNames` doc, and the 5 extra collections' matching docs), chunked into `<=500`-op `WriteBatch`es committed sequentially.
- Storage: `bucket.getFiles({prefix})` (for the count) then `bucket.deleteFiles({prefix: 'orgs/${orgId}/', force: true})`.
- `getFirestore().recursiveDelete(orgRef)` — LAST, after every cross-reference and Storage step.
- Returns `{ orgId, name, membersUnlinked, invitesDeleted, orgNameDeleted, shareDocsDeleted, storageObjectsDeleted }`.
- `functions/src/orgProvisioning.ts`: `assertSuperAdminCaller` and `normalizeOrgName` widened to `export function` (bodies unchanged) — `orgDeletion.ts` imports both rather than forking a second implementation.
- `functions/src/index.ts`: `deleteOrganization` registered in its own labeled re-export block.
- `functions/src/orgDeletion.test.ts`: a dedicated fake Firestore/Storage (NOT an extension of `orgProvisioning.test.ts`'s `FakeFirestore`, which has no `.where()`/top-level `recursiveDelete`) — 22 tests covering the caller gate, both eligibility gates, the shared-call-order-array proof that every READ (members/inviteLookup/orgNames/5-extras) precedes every DELETE (`getFiles`/`deleteFiles`/`recursiveDelete`), member `arrayRemove` scoping, `inviteLookup`/`orgNames`/extra-collection cross-org isolation, Storage call args + count, `recursiveDelete`-called-with-the-org's-own-ref-last, idempotent retry against an already-clean state, and the exact return shape.
- `firestore.rules`: `organizations/{orgId}`'s `allow write` narrowed to `allow update` (condition body unchanged — `isOrgEditor(orgId) && (preservesLifecycleFields() || isSuperAdmin())`), and an unconditional `allow delete: if false;` added right after `allow create` — no `isSuperAdmin()` exemption, since the only legitimate deletion path is the Admin-SDK callable, which bypasses rules entirely.
- `src/rules.test.ts`: two new emulator DENY tests — an ordinary editor AND a super-admin client context both fail `deleteDoc(organizations/{orgId})`.

## Task Commits

1. **Task 1: deleteOrganization callable — cascade handler + full unit test coverage (R215-R219, R221)** - `aa04dad2` (feat)
2. **Task 2: firestore.rules — unconditional client-delete DENY on organizations/{orgId} (R216)** - `fdaef52a` (fix)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `functions/src/orgDeletion.ts` (new) - `deleteOrganizationHandler`, `deleteOrganization`, `EXTRA_ORG_KEYED_COLLECTIONS`, `DeleteOrganizationRequest`/`DeleteOrganizationResponse`
- `functions/src/orgDeletion.test.ts` (new) - dedicated fake Firestore/Storage, 22 tests
- `functions/src/orgProvisioning.ts` - `assertSuperAdminCaller`/`normalizeOrgName` widened to exported
- `functions/src/index.ts` - `deleteOrganization` import + dedicated re-export block
- `firestore.rules` - `organizations/{orgId}`: `write` → `update` narrowing + unconditional `allow delete: if false;`
- `src/rules.test.ts` - 2 new delete-DENY emulator tests; 2 pre-existing tests' seed order fixed (see Deviations)

## Decisions Made

- The 5 orgId-keyed top-level collections are IN SCOPE (77-RESEARCH.md Open Question 1's recommendation, matching the owner's "everything associated with it" framing) — resolves T-77-07's information-disclosure/orphan risk rather than deferring it.
- `aiUsage`/`aiRateLimits` are deliberately OUT OF SCOPE (Open Question 2) — a platform cost-observability ledger, not tenant content; documented inline next to `EXTRA_ORG_KEYED_COLLECTIONS`.
- `orgNames` deletion stays guarded on an orgId match (never an unconditional delete-by-key), closing the rename-collision risk Pitfall 2 flags.
- The `firestore.rules` delete DENY is unconditional with no super-admin exemption (Pitfall 5) — deletion is Admin-SDK-only, by design; a permissive `allow delete: if isSuperAdmin()` would have re-opened exactly the client-side path this task exists to close.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `write` → `update` narrowing broke 2 pre-existing tests that relied on `setDoc` against a non-existent org doc resolving as CREATE**
- **Found during:** Task 2, first full rules-suite run after the narrowing
- **Issue:** `Editor vs viewer write permissions > allows editor to write org doc` and `Editor/Viewer RBAC > editor can write to org doc (update name)` never seed `organizations/{orgId}` before calling `setDoc` on it. Against a non-existent doc, `setDoc` is a Firestore **create**, not an update. Previously, the broad `allow write` rule (covering create+update+delete) let an editor satisfy this via `isOrgEditor(orgId)` alone; the separate, stricter `allow create` rule (requiring `request.resource.data.createdBy == request.auth.uid`) was masked by that OR. Narrowing `write` to `update` removed that OR path for create, so these two tests' unseeded `setDoc` calls now hit only the `create` rule and failed on a missing `createdBy` field.
- **Fix:** Both tests now seed `organizations/orgA` (via `seedDoc`, bypassing rules) with a `createdBy` field before calling `setDoc` — this makes the operation a genuine **update** (the org already exists), which is what each test's own name/intent describes ("write org doc" / "update name"), matching real usage where the org is always created beforehand via `orgProvisioning.ts`'s Admin-SDK path. The sibling "denies viewer" tests were given the same seed for consistency (already correctly denied either way).
- **Files modified:** `src/rules.test.ts`
- **Verification:** Full `src/rules.test.ts` suite (181 tests) passes with zero further regressions.
- **Committed in:** `fdaef52a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a test-seeding gap the security-motivated rules narrowing surfaced, not a defect in the narrowing itself)
**Impact on plan:** The fix is confined to test setup in the two affected tests; no production code or rule condition was loosened to accommodate it. The narrowing itself is unchanged from 77-RESEARCH.md's specification.

## Issues Encountered

See Deviations above — discovered and resolved during Task 2's own verification loop, not carried forward as an open problem.

## User Setup Required

None — no external service configuration required. Deploy is explicitly a hand-over (see below), not part of this plan's scope.

## CRITICAL SAFETY NOTE

`deleteOrganizationHandler` is a real, destructive, irreversible cascade. It was NEVER invoked against real or emulator data in this plan — `orgDeletion.test.ts` uses an entirely mocked Admin SDK (no live Firestore/Storage calls), and the `firestore.rules` tests only exercise the DENY path (no cascade). `deleteOrganization` is NOT deployed.

## Next Phase Readiness

**Deploy hand-over (this plan ships built + tested + UNDEPLOYED):**

```
firebase deploy --only functions:deleteOrganization,firestore:rules
```

- Server enforcement (the cascade + the rules DENY) is complete and independently verified — ready for Plan 02 (the client-side type-to-confirm delete dialog, R220) to build against `deleteOrganization`'s exact response shape: `{ orgId, name, membersUnlinked, invitesDeleted, orgNameDeleted, shareDocsDeleted, storageObjectsDeleted }`.
- Plan 02 maps `deleteOrganization`'s error codes (`failed-precondition` = not deactivated, `invalid-argument` = name mismatch or blank input, `permission-denied`/`unauthenticated` = caller gate, `not-found` = missing org) via the existing `friendlyCallableError` pattern.
- No blockers. The one auto-fixed deviation above is resolved in this plan's own commit, not deferred.

## Gate Results

- `npm run type-check` (`vue-tsc --build`) — **clean**.
- `cd functions && npx vitest run` — **542/542 pass** (full functions suite, including the new 22 `orgDeletion.test.ts` tests, zero regressions to `orgProvisioning.test.ts` or any other functions test file).
- Rules-emulator suite — an emulator was already running in this environment (port 8080 Firestore, per CLAUDE.md's guidance), so this plan ran `npx vitest run --config vitest.rules.config.ts` directly against it rather than `npm run test:rules`. **203/203 pass** (181 `firestore.rules` + 22 `storage.rules`), including both new Phase 77 delete-DENY tests, with the 2 pre-existing-test seed-order fixes noted in Deviations and zero other regressions.
- `npx vitest run` (app suite) — **Test Files: 2 failed | 134 passed (136)**, **Tests: 22 failed | 4068 passed (4090)** — exactly the documented known-failing baseline: `src/storage.rules.test.ts` (timeouts under the jsdom app-suite config — an environment limitation of running Storage-emulator rules tests outside `vitest.rules.config.ts`, not a regression) and `src/views/__tests__/RosterView.test.ts`'s pre-existing stale `'Roles config'` assertion. No other file regressed; this plan touched no app-suite (`src/`) source file besides the `src/rules.test.ts` additions/fixes above, which are exercised correctly under `vitest.rules.config.ts` (see the rules-emulator suite result above), not this jsdom run.

---
*Phase: 77-church-deletion-cascade-cleanup*
*Completed: 2026-08-22*

## Self-Check: PASSED

All 6 created/modified source/test files verified present on disk; both task commits (`aa04dad2`, `fdaef52a`) verified present in `git log --oneline --all`.
