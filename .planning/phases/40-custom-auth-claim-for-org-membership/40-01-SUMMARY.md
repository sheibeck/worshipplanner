---
phase: 40-custom-auth-claim-for-org-membership
plan: 01
subsystem: auth
tags: [firebase, storage-rules, custom-claims, firestore, rules-unit-testing, vitest]

# Dependency graph
requires: []
provides:
  - "Dual-read storage.rules: isOrgMember(orgId) = isOrgMemberByClaim(orgId) || isOrgMemberByFirestore(orgId), claim evaluated first"
  - "Claim contract consumed by plan 40-02's Cloud Function: request.auth.token.orgId / request.auth.token.role"
  - "Non-vacuous src/storage.rules.test.ts: every allow-case is claim-borne, every deny-case's denial is attributable to the intended conjunct"
  - "Static structural guard proving the Firestore-fallback arm is still present and OR-joined (proxy for the arm the Storage emulator cannot behaviourally exercise)"
affects: [40-02, 40-03, 40-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-read Storage rule: claim (direct JWT read) OR pre-existing cross-service firestore.exists(), claim first so || short-circuits past the emulator-inert call"
    - "authenticatedContext(uid, { orgId, role }) to prove the claim arm in @firebase/rules-unit-testing without a members document"
    - "Static source-assertion test (readFileSync + normalized-whitespace regex) as the honest substitute for a behavioural test the Storage emulator structurally cannot run"

key-files:
  created: []
  modified:
    - storage.rules
    - src/storage.rules.test.ts

key-decisions:
  - "Helper-function form (isOrgMemberByClaim/isOrgMemberByFirestore/isOrgMember) worked on first try in the Storage emulator — the plan's inline-expression fallback was not needed."
  - "Left the vestigial seedMembershipDoc('orgA','userA','editor') call in 'denies a non-member from reading an object under another org path' untouched — it seeds an unrelated Firestore doc, does not affect the test's actual assertion (which now uses userB with a mismatched orgB claim), and the plan's Task 3(b) instruction only asked to add a claim to userB, not to prune this line."
  - "Ran an out-of-plan sanity check: manually mutated storage.rules to isOrgMemberByClaim(orgId) && isOrgMemberByFirestore(orgId) and reran the new structural-guard test in isolation — it failed as expected, then storage.rules was restored via git checkout. This confirms the guard test is not vacuous (CLAUDE.md's core lesson)."

requirements-completed: [R074, R075]

coverage:
  - id: D1
    description: "storage.rules dual-reads the claim OR the existing Firestore membership check, claim evaluated first, in all four allow clauses"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "src/storage.rules.test.ts#storage.rules — dual-read structure (R075 lockout guard) > keeps the Firestore-membership fallback ORed, never ANDed, into the membership check"
        status: pass
    human_judgment: false
  - id: D2
    description: "The two measured-baseline allow-case failures now pass, proven by a claim-bearing token with no members document seeded"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "src/storage.rules.test.ts#storage.rules — org membership > allows an org member to write and read an object under their org path"
        status: pass
      - kind: unit
        ref: "src/storage.rules.test.ts#storage.rules — media path > allows an org member to upload a ~40MB media file (under the 50MB media cap)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rollout never locks out an existing member (OR never AND); a user in no organization is denied on both branches, including a claim naming a different org and a claim with no role"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "src/storage.rules.test.ts#storage.rules — org membership > denies a caller whose claim names a different organization"
        status: pass
      - kind: unit
        ref: "src/storage.rules.test.ts#storage.rules — org membership > denies a caller whose claim carries an orgId but no role"
        status: pass
      - kind: unit
        ref: "src/storage.rules.test.ts#storage.rules — media path > denies a caller with neither a claim nor a membership document on the media path"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Firestore-membership fallback arm's allow behaviour is structurally proven (source assertion), since the Storage emulator cannot behaviourally exercise it (firebase-js-sdk#6803); production confirmation is deferred to the owner post-deploy-1"
    requirement: "R074"
    verification: []
    human_judgment: true
    rationale: "The Firestore-fallback arm's ALLOW case cannot pass in the Storage emulator by design (firestore.exists() is inert there). This deliverable is proven structurally, not behaviourally, in this plan. Final confirmation that it works in production requires the owner to deploy and test after plan 40-04 — genuinely not automatable here."

# Metrics
duration: 10min
completed: 2026-08-06
status: complete
---

# Phase 40 Plan 01: Dual-Read Storage Rules Summary

**Added a claim-first dual-read (`isOrgMemberByClaim || isOrgMemberByFirestore`) to `storage.rules` and rewrote `src/storage.rules.test.ts` so every assertion is non-vacuous — turned the measured-baseline `2 failed | 96 passed (98)` into `0 failed | 103 passed (103)`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-06T22:42:00Z (baseline confirmation run)
- **Completed:** 2026-08-06T22:48:46Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `storage.rules` now gates all four `allow` clauses on `isOrgMember(orgId) = isOrgMemberByClaim(orgId) || isOrgMemberByFirestore(orgId)`, claim evaluated first so Firebase Rules' short-circuiting `||` skips the emulator-inert `firestore.exists()` call whenever a matching claim is present.
- Both headline allow-case tests from the measured baseline now pass, proven by `authenticatedContext(uid, { orgId, role })` with **no** members document seeded — an unambiguous proof the claim arm alone grants access.
- Three previously-vacuous deny-tests (two size-cap, one regression) now authenticate with a valid claim so their denial is attributable to the size conjunct alone, not a membership failure against a deny-everyone rule.
- Two cross-org deny-tests strengthened to use a valid-but-mismatched claim (`orgId: 'orgB'`) instead of a claim-less token, proving the rule rejects the wrong org, not merely "no claim."
- Three new deny-cases added for R075: claim naming a different org (no Firestore doc anywhere), claim with `orgId` but no `role` key, and neither claim nor membership doc on the media path.
- A new static structural-guard test (`keeps the Firestore-membership fallback ORed, never ANDed...`) reads `storage.rules` directly and asserts the Firestore predicate is present and disjunctively joined with the claim predicate — the honest substitute for a behavioural test the Storage emulator cannot run (firebase-js-sdk#6803). Manually verified this test trips on an AND-mutation before restoring the correct rule.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the claim arm to storage.rules as a dual-read OR, claim evaluated first** - `0e40f9c` (feat)
2. **Task 2: Turn the two measured allow-case failures green via claim-bearing tokens** - `f1fcae5` (test)
3. **Task 3: De-vacuum the deny-cases and assert the fallback arm is still OR-joined** - `cb108e2` (test)

_Note: Task 2 was TDD-marked but this plan modifies test assertions directly (not source behavior against pre-written tests) — the rewritten assertions themselves are the "red→green" transition, verified by running the suite before and after each change rather than as separate RED/GREEN commits._

## Files Created/Modified

- `storage.rules` - Three helper functions (`isOrgMemberByClaim`, `isOrgMemberByFirestore`, `isOrgMember`) declared once inside `match /b/{bucket}/o`, used by all four allow clauses across both match blocks. Firestore predicate moved verbatim from the original four clauses, never altered. Size caps (25MB generic, 52428800 media) unchanged.
- `src/storage.rules.test.ts` - Rewrote the two baseline-failing allow-cases with claim-bearing tokens; added a viewer-role allow-case; gave valid claims to the three size-cap deny-tests and the two cross-org deny-tests; added three new deny-cases (mismatched org, orgId-without-role, neither-claim-nor-doc-on-media); added the static structural-guard describe block.

## Decisions Made

- Used the helper-function form for the rules predicates (not the plan's documented inline fallback) — it compiled and evaluated correctly in the Storage emulator on the first attempt, confirmed by the test run reporting permission outcomes rather than a rules-compilation error.
- Left `seedMembershipDoc('orgA', 'userA', 'editor')` in place in `denies a non-member from reading an object under another org path` — it seeds an unrelated Firestore doc used only incidentally; the object being read is seeded via `withSecurityRulesDisabled`, and the actual asserting identity (`userB`) now carries a mismatched claim. Not touching it kept the diff scoped to exactly what Task 3(b) asked for.
- Performed an out-of-plan verification step: temporarily mutated `storage.rules` to `&&` and reran the new structural-guard test in isolation to confirm it fails on that mutation, then restored the file via `git checkout -- storage.rules`. This is the same discipline CLAUDE.md demands — a guard test that hasn't been shown to fail on the regression it claims to catch is an untested assertion.

## Deviations from Plan

None — plan executed exactly as written. The documented "fallback if the emulator rejects helper functions" branch in Task 1 was not needed; the helper-function form worked on the first `storage.rules` edit.

## Issues Encountered

None. Baseline matched the plan's `<measured_baseline>` exactly (`2 failed | 96 passed (98)`, both allow-cases, both `assertSucceeds` failures with `storage/unauthorized`) before any change was made, confirming the plan's premise was current.

## User Setup Required

None - no external service configuration required. No deploy command was run; `firestore.rules` and `package.json`/`package-lock.json` are untouched (verified via `git diff --name-only`).

## Which Arm Each Test Proves

- **Claim arm, allow** — behaviourally proven. `authenticatedContext(uid, { orgId, role })` bakes the claim into the mock JWT with no members document seeded; a pass can only have come from `request.auth.token.orgId`/`.role`. Covers the two headline tests plus the new viewer-role test.
- **Claim arm, deny** — behaviourally proven for: wrong org (valid claim, mismatched `orgId`), missing role (`orgId` present, no `role` key), and neither claim nor doc.
- **Firestore-fallback arm, allow** — **NOT behaviourally provable in the Storage emulator**, ever (firebase-js-sdk#6803: `firestore.exists()` returns false there even for a document proven to exist by an admin read). Proven instead by the static source-assertion test confirming the predicate is present and OR-joined, corroborated by production's own confirmed working state since the 2026-08-06 IAM grant. The owner re-confirms live after plan 40-04's deploy 1, per `functions/DEPLOY-ORG-CLAIMS.md` (not yet written — future plan).
- **Deny-everyone regression guard** — the static structural-guard test fails if the OR predicate is ever changed to AND or the Firestore predicate is deleted; manually verified to trip on that exact mutation during this plan's execution (see Decisions Made).

## Before/After Test Counts

```
Before (measured baseline, confirmed at plan start):
Test Files  1 failed | 1 passed (2)
     Tests  2 failed | 96 passed (98)

After Task 1 (storage.rules dual-read added, tests not yet rewritten — expected still-failing):
Test Files  1 failed | 1 passed (2)
     Tests  2 failed | 96 passed (98)

After Task 2 (headline allow-cases rewritten with claim tokens):
Test Files  2 passed (2)
     Tests  99 passed (99)

After Task 3 (deny-cases de-vacuumed, new R075 cases + structural guard added):
Test Files  2 passed (2)
     Tests  103 passed (103)
```

`npm run type-check` (the `vue-tsc --build` form) exits 0.

## Next Phase Readiness

- Plan 40-02 can now build `functions/src/orgMembershipClaims.ts` against a confirmed, byte-exact claim contract: `request.auth.token.orgId` / `request.auth.token.role`, both already load-bearing in this plan's rules and tests.
- `src/storage.rules.test.ts` is a stable, non-vacuous regression suite for any future `storage.rules` edit — the structural guard alone will catch an accidental AND or a deleted fallback.
- No blockers. Nothing deployed. `firestore.rules` untouched, as required by R074's scope fence.

---
*Phase: 40-custom-auth-claim-for-org-membership*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: storage.rules
- FOUND: src/storage.rules.test.ts
- FOUND: .planning/phases/40-custom-auth-claim-for-org-membership/40-01-SUMMARY.md
- FOUND: 0e40f9c (feat(40-01): add claim arm to storage.rules as dual-read OR)
- FOUND: f1fcae5 (test(40-01): turn the two allow-case failures green via claim tokens)
- FOUND: cb108e2 (test(40-01): de-vacuum deny-cases and guard the OR structure)
