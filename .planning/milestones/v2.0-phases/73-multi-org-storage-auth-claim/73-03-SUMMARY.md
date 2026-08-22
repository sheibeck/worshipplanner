---
phase: 73-multi-org-storage-auth-claim
plan: 03
subsystem: auth
tags: [firebase-admin, custom-claims, backfill-script, storage-rules, multi-org]

# Dependency graph
requires:
  - phase: 73-multi-org-storage-auth-claim (plan 73-01)
    provides: "buildOrgsMapClaim / resolveOrgId shared helpers in functions/src/orgMembershipClaims.ts, and the widened syncOrgMembershipClaimHandler trigger that writes the orgs map on every future membership write"
  - phase: 73-multi-org-storage-auth-claim (plan 73-02)
    provides: "storage.rules' isOrgMemberByClaim widened with a null-guarded orgs-map arm, ready to read the orgs claim once it exists"
provides:
  - "backfillOrgMembershipClaims widened to add the orgs map for every EXISTING user (not just future writes), from a single grouped-by-uid collectionGroup('members') scan"
  - "Backfill write path switched from bare setCustomUserClaims to mergeAndSetCustomClaims, closing a latent superAdmin-wipe hazard now that Phase 68's superAdmin claim exists"
  - "DEPLOY-ORG-CLAIMS.md Phase 73 rollout section: the exact owner-run STEP 1/2/3 order (widened writer -> backfill -> storage.rules) with commands and the no-access-gap rationale"
affects: [73-multi-org-storage-auth-claim (owner-run deploy, not yet executed), any future phase touching functions/src/backfillOrgClaims.ts or the DEPLOY-ORG-CLAIMS.md runbook]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Group-once, reconcile-per-uid: a single collectionGroup('members').get() grouped into an in-memory Map<uid, memberships[]>, never re-scanned per uid (avoids the O(n) re-scan anti-pattern computeOrgsClaimForUid would cause if called in a loop)"
    - "Try-until-non-not-primary: decidePrimaryClaim tries each of a uid's memberships against the shared decideMembershipClaim until one is NOT skipped for not-primary-org, converging on the true primary decision regardless of collectionGroup doc order without a separate primary-org lookup"
    - "Combined skip-if-matching: idempotency now checks BOTH the primary orgId/role keys (via decideMembershipClaim's own already-current check) AND the orgs map (via a local shallow-equal), so a repeat run only skips when nothing at all has changed"

key-files:
  created: []
  modified:
    - "functions/src/backfillOrgClaims.ts - widened backfillOrgMembershipClaims: group-by-uid, shared buildOrgsMapClaim/resolveOrgId imports, mergeAndSetCustomClaims write path, combined primary+orgs idempotency"
    - "functions/src/backfillOrgClaims.test.ts - added multi-org single-write + single-scan test, superAdmin-preservation test, orgs-only write test (+ its own idempotency), updated exact-match assertions to the widened claim shape"
    - "functions/DEPLOY-ORG-CLAIMS.md - new Phase 73 rollout section (STEP 1/2/3 order, rationale, soak pointer, rollback), Known Limitation #1 marked closed once deployed"

key-decisions:
  - "Kept the orgs-map equality check (orgsMapsEqual) as a small LOCAL copy in backfillOrgClaims.ts rather than exporting orgMembershipClaims.ts's private helper, to respect the plan's declared files_modified boundary (which does not include orgMembershipClaims.ts) -- pure equality on the SAME shared buildOrgsMapClaim output, so there is no drift risk on what an orgs map should contain, only on whether two of them compare equal"
  - "For a user with multiple org memberships, resolve the primary decision by trying decideMembershipClaim against each membership in collectionGroup doc order until one is not skipped for not-primary-org, instead of pre-fetching users/{uid}.orgIds ourselves -- reuses the shared function's own primary-org re-derivation rather than adding a second lookup"
  - "A non-primary-org membership (previously counted as plain 'skipped') now triggers an orgs-only write when its org isn't yet in the user's orgs map -- this is the intended widening (a genuine secondary-org membership must no longer be silently dropped), so the pre-existing 'non-primary org: counted as skipped' test was rewritten to assert the orgs-only write instead of no-op"

requirements-completed: [R210, R208]

coverage:
  - id: D1
    description: "Backfill recomputes the widened claim (adds orgs map, preserves primary keys) for every existing user, apply-gated behind --apply with dry-run as the default"
    requirement: "R210"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#apply mode: two members in their primary org, neither claimed -- processed 2, skipped 0, failed empty, setCustomUserClaims called twice with the widened claim (primary keys + orgs)"
        status: pass
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#dry run (the default): same processed/skipped classification, but setCustomUserClaims is never called"
        status: pass
    human_judgment: false
  - id: D2
    description: "The orgs map is derived from ONE collectionGroup('members') scan grouped by uid in memory -- no per-uid or per-membership rescan, even for a multi-org user"
    requirement: "R210"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#multi-org: a user with TWO org memberships (orgA primary, orgB secondary) gets ONE write carrying the primary keys plus a two-entry orgs map, from a single grouped scan (R210, 73-RESEARCH.md Pattern 4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A second backfill run against the same state reports every already-current account skipped and writes zero claims -- idempotent across both the primary keys and the orgs map"
    requirement: "R210"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#immediate second run: processed 0, skipped 2, failed empty, setCustomUserClaims not called at all -- idempotency by skip-if-already-matching (extended to orgs, D-11)"
        status: pass
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#non-primary org, second run: the orgs-only write from the previous test is idempotent -- an immediate repeat reports skipped and writes nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "The backfill writes via mergeAndSetCustomClaims, not a bare setCustomUserClaims, so a superAdmin account survives a backfill run with superAdmin intact"
    requirement: "R208"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#superAdmin preserved: mergeAndSetCustomClaims merges the widened claim on top of an existing superAdmin:true grant rather than replacing it (R208, closes T-73-01)"
        status: pass
    human_judgment: false
  - id: D5
    description: "DEPLOY-ORG-CLAIMS.md documents the exact owner-run rollout order (widened writer -> backfill dry-run/--apply -> storage.rules) with commands and the no-access-gap rationale; everything ships UNDEPLOYED"
    requirement: "R210"
    verification:
      - kind: other
        ref: "node -e \"const d=require('fs').readFileSync('functions/DEPLOY-ORG-CLAIMS.md','utf8'); for (const t of ['functions:syncOrgMembershipClaim','--only storage','--apply']) if(!d.includes(t)){process.exit(1);}\" (plan's own verify script)"
        status: pass
    human_judgment: true
    rationale: "The plan's automated verify only checks that the three command strings are present in the file; whether the surrounding prose correctly explains the rollout order, the no-access-gap rationale, and the UNDEPLOYED hand-over framing is a reading-comprehension judgment call, not something a grep can confirm."

# Metrics
duration: 24min
completed: 2026-08-21
status: complete
---

# Phase 73 Plan 03: Widen the Org-Claims Backfill + Deploy Runbook Summary

**Backfill now writes the multi-org `orgs` map for every existing user from a single grouped scan, via `mergeAndSetCustomClaims` (no more superAdmin-wipe hazard), and the runbook has the exact owner-run rollout order for it.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-21T18:52:00Z
- **Completed:** 2026-08-21T19:16:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `backfillOrgMembershipClaims` restructured to group the single `collectionGroup('members').get()` scan by uid in memory, reusing the shared `resolveOrgId` / `buildOrgsMapClaim` / `decideMembershipClaim` from `orgMembershipClaims.ts` so the trigger and backfill can never drift on what an `orgs` map or a primary decision should be.
- Write path switched from a bare `getAuth().setCustomUserClaims` to `mergeAndSetCustomClaims`, closing the latent superAdmin-wipe hazard RESEARCH flagged now that Phase 68's `superAdmin` claim exists — proven by a new test that seeds `superAdmin: true` and asserts it survives a backfill write.
- Idempotency (skip-if-already-matching) extended to cover both the primary `orgId`/`role` keys AND the `orgs` map — a repeat run only skips a uid when neither has changed.
- A genuine non-primary-org membership (previously reported as a no-op "skipped") now correctly triggers an orgs-only write, closing the gap the primary-only claim always had for multi-org users.
- `functions/DEPLOY-ORG-CLAIMS.md` gained a new Phase 73 section with the exact three-command owner-run order and the no-access-gap rationale (legacy arms bridge the rollout; the writer deploys before anything reads `orgs`; the rule deploys only after every account's `orgs` claim exists).

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the backfill — group-by-uid, shared orgs builder, mergeAndSetCustomClaims, idempotent** - `e9fb2e3d` (feat)
2. **Task 2: Update DEPLOY-ORG-CLAIMS.md with the Phase 73 widened-claim rollout order** - `b99a85f1` (docs)

**Plan metadata:** (this commit, docs: complete 73-03 plan)

## Files Created/Modified
- `functions/src/backfillOrgClaims.ts` - widened `backfillOrgMembershipClaims`: single scan grouped by uid, shared `decideMembershipClaim`/`buildOrgsMapClaim`/`resolveOrgId` imports (local duplicate `resolveOrgId` removed), `mergeAndSetCustomClaims` write path, combined primary+orgs skip-if-matching, `decidePrimaryClaim` helper, local `orgsMapsEqual` equality check
- `functions/src/backfillOrgClaims.test.ts` - added multi-org single-write + single-scan test, superAdmin-preservation test, orgs-only write test plus its own idempotency test, updated existing exact-match `toHaveBeenCalledWith` assertions to the widened claim shape, rewrote the "non-primary org" test to assert the new orgs-only-write behavior
- `functions/DEPLOY-ORG-CLAIMS.md` - new "Phase 73 — widening to multi-org (`orgs` map)" section (STEP 1/2/3 commands, why-this-order rationale, soak pointer, rollback), Known Limitation #1 updated to "CLOSED by Phase 73, once its three steps below are deployed"

## Decisions Made
- Kept the orgs-map equality check as a small local copy in `backfillOrgClaims.ts` rather than exporting `orgMembershipClaims.ts`'s private `orgsMapsEqual`, to respect the plan's declared `files_modified` boundary (which does not list `orgMembershipClaims.ts`). It is pure equality over the SAME shared `buildOrgsMapClaim` output, so there is no risk of two implementations disagreeing on what an `orgs` map should *contain* — only a private, self-contained equality check.
- For a multi-org uid, resolve the primary decision by trying `decideMembershipClaim` against each of that uid's memberships (in `collectionGroup` doc order) until one is not skipped for `not-primary-org`, rather than pre-fetching `users/{uid}.orgIds` ourselves first. This reuses the shared function's own primary-org re-derivation instead of adding a second lookup path, and converges on the correct primary regardless of doc order.
- Treated the pre-existing "non-primary org: counted as skipped" test as intentionally superseded rather than preserved verbatim — the widened behavior (an orgs-only write for a genuine secondary-org membership) is the entire point of R210/R207, so the old "no-op skip" expectation was wrong post-widening and was rewritten (plus a companion idempotency test for the new write) rather than kept as a stale regression guard.

## Deviations from Plan

None - plan executed exactly as written. The one interpretive judgment call (rewriting the "non-primary org" test's expected outcome rather than treating the old assertion as a locked contract) was explicitly anticipated by the plan's own instruction to "extend/keep the existing tests, updating exact-match assertions to include the orgs map" and by the plan's own behavior spec, which requires a genuine secondary-org membership to produce a write, not a no-op skip.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan produces no owner-run actions of its own; `functions/DEPLOY-ORG-CLAIMS.md`'s new Phase 73 section documents the owner-run deploy sequence for a LATER, explicit hand-over — nothing in this plan executes any deploy or backfill command.

## Next Phase Readiness

- All Phase 73 code artifacts (73-01 writer, 73-02 rules, 73-03 backfill + runbook) are built, tested, and committed on `master`, fully undeployed per the standing NO DEPLOYS grant.
- `cd functions && npx vitest run` is green at 445/445 tests (up from the 442+ baseline the plan's gate named).
- `cd functions && npm run build` and root `npm run type-check` (the `vue-tsc --build` form) are both clean.
- Ready for the owner to run the three-step Phase 73 rollout in `functions/DEPLOY-ORG-CLAIMS.md` whenever they choose — no further planning work is required to unblock that.

---
*Phase: 73-multi-org-storage-auth-claim*
*Completed: 2026-08-21*

## Self-Check: PASSED

All created/modified files found on disk (`functions/src/backfillOrgClaims.ts`, `functions/src/backfillOrgClaims.test.ts`, `functions/DEPLOY-ORG-CLAIMS.md`, this SUMMARY.md) and both task commit hashes (`e9fb2e3d`, `b99a85f1`) confirmed present in `git log`.
