---
phase: 76-church-deactivation-reactivation
plan: 01
subsystem: auth
tags: [firebase-functions, firestore-rules, storage-rules, custom-claims, cloud-functions]

# Dependency graph
requires:
  - phase: 74-organizations-onboard-assign
    provides: assertSuperAdminCaller, the orgProvisioning.ts callable pattern, listOrganizations
  - phase: 73-multi-org-claims
    provides: the orgs claim map, ORGS_CLAIM_KEY, mergeSetAndClearCustomClaims TOCTOU-safe pattern
  - phase: 68-super-admin-foundation
    provides: isSuperAdmin() (firestore.rules), the superAdmin custom claim
provides:
  - "setOrgActive({orgId, active}) super-admin-gated callable persisting organizations/{orgId}.active + audit fields"
  - "deactivatedOrgs additive custom-claim key + patchNestedClaimKey TOCTOU-safe helper"
  - "firestore.rules isOrgActive() composed into isOrgMember/isOrgEditor"
  - "storage.rules isOrgDeactivatedForCaller() composed into isOrgMemberByClaim"
affects: [76-02-client-login-block, 77-church-deletion, 78-super-admin-enter-any-church]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "patchNestedClaimKey: single read-mutate-write of ONE nested claim-map key, mirroring mergeSetAndClearCustomClaims's TOCTOU-safe shape"
    - "Storage Rules custom-claim absent-key access: use request.auth.token.get(key, default).get(nestedKey, default) — NOT `!= null` dot/bracket guards, which do not reliably read as null for an absent key in the Storage rules engine (see Deviations)"
    - "Firestore Rules cross-document get(): guard with !exists(path) || get(path)... — an unguarded get(...).data on a non-existent doc throws (Null value error → deny), and this codebase has many established fixtures that seed only a members/{uid} subdoc, never the parent org doc"

key-files:
  created: []
  modified:
    - functions/src/orgProvisioning.ts
    - functions/src/orgMembershipClaims.ts
    - functions/src/claimsHelpers.ts
    - functions/src/claimsHelpers.test.ts
    - functions/src/orgProvisioning.test.ts
    - functions/src/index.ts
    - firestore.rules
    - storage.rules
    - src/rules.test.ts
    - src/storage.rules.test.ts

key-decisions:
  - "Option 2 (additive deactivatedOrgs claim map) per 76-RESEARCH.md — zero changes to computeOrgsClaimForUid/buildOrgsMapClaim/decideMembershipClaim"
  - "Super-admin exemption is NARROW: only waives the active check for a super-admin who already has a genuine membership doc — exists()/membership-arm checks are untouched (Phase 78/R225 owns membership-doc-less entry)"
  - "Same-state short-circuit skips the org-doc audit-field rewrite but the member claim fan-out ALWAYS runs, so a retry of a partially-failed call can finish the job"
  - "revokeRefreshTokens only on deactivate, never on reactivate — don't force re-login on restore"

patterns-established:
  - "storage.rules custom-claim map access must use .get(key, default) for BOTH the top-level key and any nested key — dot/bracket + `!= null` is an unreliable idiom for an absent key in this rules engine, discovered empirically against the emulator (see Deviations)"

requirements-completed: [R212, R213, R214]

coverage:
  - id: D1
    description: "setOrgActive callable persists active/deactivatedAt/deactivatedBy (or reactivatedAt/reactivatedBy) on organizations/{orgId}, gated by assertSuperAdminCaller"
    requirement: R212
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#setOrgActiveHandler"
        status: pass
    human_judgment: false
  - id: D2
    description: "firestore.rules denies org-scoped reads/writes to a non-super-admin member of a deactivated org; a legacy/explicitly-active org's member is unaffected; a super-admin with a genuine membership doc is exempt"
    requirement: R213
    verification:
      - kind: integration
        ref: "src/rules.test.ts#isOrgActive — deactivation gate (R213, Phase 76)"
        status: pass
    human_judgment: false
  - id: D3
    description: "storage.rules denies a deactivated member across BOTH the multi-org claim arm and the legacy claim arm, while a super-admin (with a valid membership claim) is exempt"
    requirement: R213
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — deactivatedOrgs claim (R213, Phase 76)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reactivation clears the deactivatedOrgs claim entry for every affected member server-side, no manual per-member fix-up, preserving sibling deactivatedOrgs entries and unrelated claims (superAdmin, orgs)"
    requirement: R214
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#setOrgActiveHandler (reactivate)"
        status: pass
      - kind: unit
        ref: "functions/src/claimsHelpers.test.ts#patchNestedClaimKey (round trip)"
        status: pass
    human_judgment: false

# Metrics
duration: ~4h (incl. empirical Storage-rules-engine debugging, see Deviations)
completed: 2026-08-22
status: complete
---

# Phase 76 Plan 01: Church Deactivation/Reactivation — Server Enforcement Summary

**Super-admin-gated `setOrgActive` callable + `deactivatedOrgs` claim fan-out, with `firestore.rules`/`storage.rules` independently denying a deactivated org's ordinary members — shipped built, tested, and UNDEPLOYED.**

## Performance

- **Duration:** ~4h (most of it empirically diagnosing a Storage-rules-engine quirk — see Deviations)
- **Completed:** 2026-08-22
- **Tasks:** 2/2
- **Files modified:** 10

## Accomplishments
- `setOrgActive({orgId, active})` callable (`functions/src/orgProvisioning.ts`): caller-gated by `assertSuperAdminCaller`, validates input, persists `active`/`deactivatedAt`/`deactivatedBy` (or `reactivatedAt`/`reactivatedBy`) on `organizations/{orgId}` with a same-state short-circuit, fans out `deactivatedOrgs[orgId]` to every member of the org (scoped `organizations/{orgId}/members` query, never a global `collectionGroup`), and calls `revokeRefreshTokens` on deactivate only. `listOrganizations` gains an `active: boolean` field.
- `patchNestedClaimKey` (`functions/src/claimsHelpers.ts`): a new TOCTOU-safe helper (single read, in-memory patch of ONE nested claim-map key, single write) mirroring `mergeSetAndClearCustomClaims`'s established shape — proven by a deactivate→reactivate round-trip test asserting `superAdmin`/`orgs`/a sibling `deactivatedOrgs` entry all survive.
- `DEACTIVATED_ORGS_CLAIM_KEY`/`DeactivatedOrgsClaim` (`functions/src/orgMembershipClaims.ts`): purely additive claim surface — zero changes to `computeOrgsClaimForUid`/`buildOrgsMapClaim`/`decideMembershipClaim`.
- `firestore.rules`: `isOrgActive(orgId)` live-reads `organizations/{orgId}.active` (default-true), composed into `isOrgMember`/`isOrgEditor` ORed with `isSuperAdmin()` — the exemption is narrow, scoped to a super-admin who already has a genuine membership doc.
- `storage.rules`: `isOrgDeactivatedForCaller(orgId)` reads the `deactivatedOrgs` claim safely via `.get(key, default)`, composed as a guard wrapping the WHOLE `isOrgMemberByClaim` OR-expression (both the multi-org and legacy arms), exempting a super-admin.
- Genuine emulator ALLOW/DENY test coverage: 7 new tests in `src/rules.test.ts`, 5 new tests in `src/storage.rules.test.ts` — full rules suite green at 195/195 with zero regressions to any pre-existing test.

## Task Commits

1. **Task 1: setOrgActive callable + deactivatedOrgs claim helper (R212, R214)** - `21ad9d90` (feat)
2. **Task 2: firestore.rules isOrgActive + storage.rules deactivatedOrgs guard + emulator ALLOW/DENY suites (R213)** - `d6d73ec3` (feat)

**Plan metadata:** (this commit, following)

## Files Created/Modified
- `functions/src/orgProvisioning.ts` - `setOrgActive`/`setOrgActiveHandler`, `active` field on `OrgSummary`
- `functions/src/orgMembershipClaims.ts` - `DEACTIVATED_ORGS_CLAIM_KEY`, `DeactivatedOrgsClaim`
- `functions/src/claimsHelpers.ts` - `patchNestedClaimKey`
- `functions/src/claimsHelpers.test.ts` - `patchNestedClaimKey` unit tests (5 new)
- `functions/src/orgProvisioning.test.ts` - `setOrgActiveHandler` describe block (10 new tests) + caller-gate cases + `active` field assertions on existing `listOrganizations` tests
- `functions/src/index.ts` - export `setOrgActive`
- `firestore.rules` - `isOrgActive()`, composed into `isOrgMember`/`isOrgEditor`
- `storage.rules` - `isOrgDeactivatedForCaller()`, composed into `isOrgMemberByClaim`
- `src/rules.test.ts` - `isOrgActive — deactivation gate (R213, Phase 76)` describe block (7 new tests)
- `src/storage.rules.test.ts` - `storage.rules — deactivatedOrgs claim (R213, Phase 76)` describe block (5 new tests)

## Decisions Made
- Option 2 (additive `deactivatedOrgs` claim map, per 76-RESEARCH.md) over Option 1 (excluding deactivated orgs from the `orgs` claim computation) — zero risk to the already-shipped Phase 73 multi-org claim logic.
- Super-admin exemption stays narrow per 76-RESEARCH.md Open Question 1's recommendation: only waives the *active* check for a super-admin who is already a genuine member. Membership-doc-less entry is explicitly out of scope, reserved for Phase 78 (R225).
- Same-state short-circuit skips the org-doc audit-field rewrite on a redundant call, but the member claim fan-out always runs unconditionally — makes a partial-failure retry safe and idempotent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] firestore.rules' `isOrgActive()` needed an `exists()` guard the plan's/research's literal code example omitted**
- **Found during:** Task 2, first full rules-suite run after the initial implementation
- **Issue:** Both 76-CONTEXT.md and 76-RESEARCH.md specify `isOrgActive(orgId)` as a bare `get(...).data.get('active', true) == true`. Running the full existing `src/rules.test.ts`/`src/storage.rules.test.ts` suite against this exact shape caused 34 pre-existing tests to fail with "Null value error" — this codebase has many long-established test fixtures that seed only an `organizations/{orgId}/members/{uid}` doc via `seedMembershipDoc`, never the parent `organizations/{orgId}` doc itself (`isOrgMember`'s pre-existing contract never required the org doc to exist, only the membership subdoc). An unguarded `get()` on that non-existent org doc throws a "Null value error", which Firestore treats as DENY, not false — this silently broke nearly every existing org-scoped rule.
- **Fix:** `isOrgActive` now guards with `!exists(orgPath) || get(orgPath).data.get('active', true) == true` — mirrors this file's own established `isOrgEditor`/`parentDraft` "guard before `.data` access" idiom. A missing org doc now reads as active (same default-true posture as a present doc with no `active` field), matching every pre-existing test fixture's assumption.
- **Files modified:** `firestore.rules`
- **Verification:** Full `src/rules.test.ts` suite (174 tests) passes with zero regressions.
- **Committed in:** `d6d73ec3` (Task 2 commit)

**2. [Rule 1 - Bug] storage.rules' `deactivatedOrgs` claim access needed `.get(key, default)`, not `!= null` dot/bracket access, per 76-RESEARCH.md's own literal code example**
- **Found during:** Task 2, empirical debugging after the initial `isOrgDeactivatedForCaller` implementation (following 76-RESEARCH.md's "storage.rules — full recommended diff shape" verbatim) caused every pre-existing `storage.rules` test to fail
- **Issue:** Bisected empirically against the running Storage emulator (isolating the guard clause piece by piece): `request.auth.token.SOMEKEY != null` does **not** reliably evaluate to a clean `false` when `SOMEKEY` is genuinely absent from the token's custom claims, in the Storage Rules engine specifically (Firestore Rules' behavior on comparable constructs was not the mechanism at fault here — this is a Storage-rules-engine-specific finding). Wrapping the guard in a helper function or inlining it made no difference; testing with an arbitrary/never-used key name (`fooBarBaz`) reproduced the same failure, and — more significantly — testing the codebase's own **pre-existing** `request.auth.token.orgs != null` guard (used by the already-shipped multi-org arm at line 55, unchanged by this plan) in isolation reproduced the identical failure. That guard's apparent correctness in the existing suite is masked by the `||` with the legacy arm: when the multi-org arm's guard misfires and the subsequent `orgs[orgId]` indexing then errors, the enclosing `||`'s error-tolerant semantics (an errored left operand does not fail the whole `||` when the right operand is `true`) silently absorbs it. My new deactivation guard sits OUTSIDE that OR, ANDed onto its result, so it had no such error-tolerant escape hatch — the pre-existing latent issue became directly observable for the first time.
- **Fix:** Switched `isOrgDeactivatedForCaller` to the safe map-accessor method chain: `request.auth.token.get('deactivatedOrgs', {}).get(orgId, false) == true`. This is the same `.get(key, default)` idiom already used successfully on the Firestore side (`.data.get('active', true)`, `.data.get('role', '')`) and resolves cleanly for an absent top-level key, an absent nested key, or a present-and-true nested key, with no error path.
- **Files modified:** `storage.rules`
- **Verification:** Full `src/storage.rules.test.ts` suite (21 tests, 16 pre-existing + 5 new) passes with zero regressions.
- **Committed in:** `d6d73ec3` (Task 2 commit)
- **Note for future work:** the pre-existing `orgs != null` guard on the multi-org arm (line 55, unchanged by this plan — out of this plan's scope to fix) carries the same latent quirk, currently masked only by the `||` with the legacy arm. Flagged here for visibility; not remediated in this plan since the multi-org arm's own test coverage all currently passes and touching it is out of this plan's stated file scope.

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs found empirically against the emulator, not caught by the research/plan's literal code examples)
**Impact on plan:** Both fixes were necessary for correctness — the literal code shapes documented in 76-CONTEXT.md/76-RESEARCH.md, if shipped as written, would have caused a severe regression (denying most existing org-scoped Firestore access) and would have made the new Storage deactivation guard a no-op deny-none (or, depending on claim shape, an unpredictable deny-some). No scope creep — both fixes are confined to the exact two functions the plan specifies.

## Issues Encountered
See Deviations above — both issues were discovered and resolved during Task 2's own verification loop, not carried forward as open problems.

## User Setup Required
None - no external service configuration required. Deploy is explicitly a hand-over (see below), not part of this plan's scope.

## Next Phase Readiness

**Deploy hand-over (this plan ships built + tested + UNDEPLOYED, per the plan's stated posture):**

```
firebase deploy --only firestore:rules,storage,functions:setOrgActive
```

- **Server enforcement is complete and independently verified** for both `firestore.rules` and `storage.rules` — ready for 76-02 (the client-side login-block/UX layer) to build on top of it, and for Phase 77 (deletion gated on deactivated) and Phase 78 (super-admin enter-any-church) to compose with these rules changes as designed.
- `setOrgActive`'s response shape (`{orgId, active, memberCount, claimFailures}`) is the exact contract 76-02-PLAN.md's `OrganizationsTab.vue` control is expected to call.
- No blockers. The two auto-fixed deviations above are resolved in this plan's own commits, not deferred.

## Gate Results

- `npm run type-check` (`vue-tsc --build`) — **clean**.
- `cd functions && npx vitest run` — **506/506 pass** (full functions suite, including the new `setOrgActive`/`patchNestedClaimKey` tests).
- Rules-emulator suite — an emulator was already running in this environment (port 8080 Firestore, 9199 Storage, 4000 UI) when this plan executed, so per CLAUDE.md's guidance this plan ran `npx vitest run --config vitest.rules.config.ts` directly against it rather than `npm run test:rules` (which would have failed "port taken"). **195/195 pass** (174 firestore.rules + 21 storage.rules), including all 12 new Phase 76 deactivation tests, with zero regressions to any pre-existing test.
- `npx vitest run` (app suite) — **Test Files: 2 failed | 133 passed (135)**, exactly the documented known-failing baseline (`src/storage.rules.test.ts` under the jsdom app-suite config, and `src/views/__tests__/RosterView.test.ts`'s pre-existing stale assertion) — no other file regressed.

---
*Phase: 76-church-deactivation-reactivation*
*Completed: 2026-08-22*

## Self-Check: PASSED

All 10 modified source/test files and this SUMMARY.md verified present on disk; both task commits (`21ad9d90`, `d6d73ec3`) verified present in `git log --oneline --all`.
