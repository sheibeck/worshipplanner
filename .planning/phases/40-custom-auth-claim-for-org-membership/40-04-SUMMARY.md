---
phase: 40-custom-auth-claim-for-org-membership
plan: 04
subsystem: auth
tags: [firebase, functions, custom-claims, firestore, backfill, deploy-runbook, vitest]

# Dependency graph
requires:
  - phase: 40-custom-auth-claim-for-org-membership (plan 01)
    provides: "Dual-read storage.rules (isOrgMemberByClaim || isOrgMemberByFirestore) -- what deploy 1 in the runbook deploys, and what deploy 2 eventually narrows"
  - phase: 40-custom-auth-claim-for-org-membership (plan 02)
    provides: "decideMembershipClaim (functions/src/orgMembershipClaims.ts) -- imported directly by the backfill, not reimplemented"
  - phase: 40-custom-auth-claim-for-org-membership (plan 03)
    provides: "CLAIM_REFRESH_MAX_ATTEMPTS=4 / CLAIM_REFRESH_DELAY_MS=1500 -- quoted verbatim in the runbook's residual-risk section"
provides:
  - "functions/src/backfillOrgClaims.ts: backfillOrgMembershipClaims -- idempotent, dry-run-by-default Node script over the members collection group"
  - "functions/src/backfillOrgClaims.test.ts: 11 tests covering apply/dry-run, idempotent re-run, missing-user-doc, non-primary-org, per-uid failure, both structural-guard cases, and the defensive clear-not-reachable path"
  - "functions/DEPLOY-ORG-CLAIMS.md: the exact two-deploy sequence, the backfill invocation, the mandatory one-hour soak, the mandatory multi-org pre-check, and all four residual risks"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structural path guard applied before any decision (mirrors index.ts's MEDIA_PATH_GUARD): a collectionGroup('members') result is only ever a candidate when its parent chain resolves to an organizations/{orgId} document, checked via ref.parent.parent.parent.id === 'organizations'"
    - "Stateful fake Auth in tests (a Map-backed setCustomUserClaims/getUser pair) to genuinely exercise idempotency across two sequential calls to the function under test, rather than asserting it by construction"
    - "CLI wrapper guarded by require.main === module so importing the module under vitest never calls initializeApp() -- confirmed working under vitest's CJS interop (no fallback needed)"

key-files:
  created:
    - functions/src/backfillOrgClaims.ts
    - functions/src/backfillOrgClaims.test.ts
    - functions/DEPLOY-ORG-CLAIMS.md
  modified: []

key-decisions:
  - "require.main === module (as the plan specified) works correctly under vitest's CJS interop -- verified empirically by running the suite rather than assumed; no import.meta.url fallback was needed."
  - "The structural guard (resolveOrgId) returns undefined and the loop `continue`s BEFORE any counter increment, mirroring MEDIA_PATH_GUARD's pre-scannedCount discipline in index.ts -- a guard-failed document is invisible to processed/skipped/failed entirely, not counted as skipped."
  - "Added one test beyond the plan's <behavior> list: the defensive 'clear' branch (decideMembershipClaim returning {action:'clear'} is unreachable from a live members document, since role is only undefined on a delete and a deleted doc is never returned by this query) is still exercised directly, proving the defensive skip-without-throw code path actually works rather than being dead code no test ever runs."
  - "Deploy commands use `firebase deploy --only storage,functions:syncOrgMembershipClaim` (deploy 1) and `firebase deploy --only storage` (deploy 2), matching firebase.json's `storage` target and the `default` functions codebase's per-function scoping syntax -- confirmed against firebase.json rather than assumed."

requirements-completed: [R074, R075]

coverage:
  - id: D1
    description: "backfillOrgMembershipClaims iterates every organizations/*/members/* document and sets { orgId, role } for each user whose primary org matches, delegating the decision to the shared decideMembershipClaim rather than reimplementing it"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > apply mode: two members in their primary org, neither claimed -- processed 2, skipped 0, failed empty, setCustomUserClaims called twice"
        status: pass
    human_judgment: false
  - id: D2
    description: "Re-running the backfill changes nothing: the second run reports every account as skipped, and setCustomUserClaims is not called at all"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > immediate second run: processed 0, skipped 2, failed empty, setCustomUserClaims not called at all -- idempotency by skip-if-already-matching"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dry run (the default) classifies accounts identically to apply mode but never calls setCustomUserClaims"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > dry run (the default): same processed/skipped classification, but setCustomUserClaims is never called"
        status: pass
    human_judgment: false
  - id: D4
    description: "The one real never-accepted invite (no members/{uid} document) is never visited by the query and never appears in any of the three counts"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > pending invite: an org whose only pending invite has no members/{uid} document is never visited -- absent from all three counts, no error"
        status: pass
    human_judgment: false
  - id: D5
    description: "A members document whose users/{uid} document is missing is skipped, not failed and not crashed on"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > missing user document: a members doc whose users/{uid} does not exist is skipped, not failed, and does not throw"
        status: pass
    human_judgment: false
  - id: D6
    description: "A members document for a non-primary org is counted as skipped, not acted on"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > non-primary org: a members doc for an org that is not the user's orgIds[0] is counted as skipped"
        status: pass
    human_judgment: false
  - id: D7
    description: "A per-uid failure (e.g. a deleted auth user) is collected into failed with { uid, orgId, error } and the run continues to the next account"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > per-uid failure: when the auth lookup rejects for one uid, that uid appears in failed with its orgId and error, and the remaining accounts are still processed"
        status: pass
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > returns the summary shape { processed, skipped, failed } where failed is an array of { uid, orgId, error }"
        status: pass
    human_judgment: false
  - id: D8
    description: "A members document that is not structurally a child of an organizations/{orgId} document is skipped without being acted on, before any decision is made"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > structural guard: a members document that is not a child of an organizations/{orgId} document is skipped without being acted on"
        status: pass
      - kind: unit
        ref: "functions/src/backfillOrgClaims.test.ts#backfillOrgMembershipClaims > structural guard: a members document with no parent org document at all is skipped without being acted on"
        status: pass
    human_judgment: false
  - id: D9
    description: "functions/DEPLOY-ORG-CLAIMS.md states both deploy commands verbatim, what to observe after each of the four steps, and the rollback for each"
    requirement: "R075"
    verification: []
    human_judgment: true
    rationale: "A runbook's completeness and clarity for a human operator is not mechanically verifiable -- reviewed manually against every acceptance criterion in 40-04-PLAN.md's Task 2 (banner, both verbatim commands matching firebase.json targets, per-step observe/rollback, the one-hour soak with its reason, the backfill's dry-run-default + --apply behavior, the deploy-2 tripwire naming plan 40-01's guard test by its exact title, the mandatory multi-org pre-check, and all four residual risks including the exact CLAIM_REFRESH constants from plan 40-03). No deploy was run to test it end-to-end -- that is the owner's step, deferred to .planning/PENDING-VERIFICATION.md per the v1.5 standing autonomy grant."
  - id: D10
    description: "Live production behaviour of the two deploys, the backfill run against real data, the one-hour soak, and the multi-org pre-check -- genuinely requires the owner's action"
    verification: []
    human_judgment: true
    rationale: "Explicitly out of scope for this plan and this phase (hard scope fence: no firebase deploy, no gcloud, no running the backfill against real data). Deferred per the v1.5 standing autonomy grant; recorded in .planning/PENDING-VERIFICATION.md. ROADMAP success criterion 4 is explicit that reaching the handed-over, undeployed state IS the phase goal."

# Metrics
duration: ~15min
completed: 2026-08-06
status: complete
---

# Phase 40 Plan 04: Backfill Script and Two-Deploy Runbook Summary

**`backfillOrgMembershipClaims` -- an idempotent, dry-run-by-default Node script over `collectionGroup('members')` that shares its decision logic with the trigger via `decideMembershipClaim` -- plus `functions/DEPLOY-ORG-CLAIMS.md`, the exact owner-run two-deploy sequence with a mandatory one-hour soak and multi-org pre-check between the two deploys.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-06T19:11:08-04:00 (baseline: prior plan 40-03's completion commit)
- **Completed:** 2026-08-06T19:19:06-04:00
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments

- `functions/src/backfillOrgClaims.ts` exports `backfillOrgMembershipClaims`, a plain async function (not a deployed function -- not exported from `functions/src/index.ts`) that queries `getFirestore().collectionGroup('members').get()` once, with no cursor, pagination, batching, or rate limiting (D-10, correct at n=2).
- Every claim decision is delegated to `decideMembershipClaim` (imported from `./orgMembershipClaims`, plan 40-02) -- the backfill contains no second implementation of primary-org resolution, role normalisation, or the already-matching comparison, so it cannot drift from the trigger.
- A structural guard (`resolveOrgId`, mirroring `index.ts`'s `MEDIA_PATH_GUARD` discipline) checks that a `members` document's parent chain resolves to an `organizations/{orgId}` document before any decision is made -- verified via `.ref.parent.parent.parent.id === "organizations"`, exercised by two dedicated tests (a structurally-invalid parent collection name, and a `members` doc with no parent org document at all).
- Dry run is the default; writes require `--apply`. The CLI wrapper (guarded by `require.main === module`, confirmed working under vitest without needing a fallback) prints the resolved project id and an explicit dry-run banner before doing any work, and exits non-zero when any account fails.
- The returned summary is `{ processed, skipped, failed }` where `failed` is `Array<{ uid, orgId, error }>` -- every failure named by uid, per D-13.
- 11 new tests in `functions/src/backfillOrgClaims.test.ts` cover every case in the plan's `<behavior>` list plus one bonus test for the defensive `clear`-not-reachable branch. A stateful fake Auth (a `Map`-backed `setCustomUserClaims`/`getUser` pair) genuinely proves idempotency across two sequential calls, rather than asserting it by construction.
- `functions/DEPLOY-ORG-CLAIMS.md` documents the full owner-run sequence: deploy 1 (dual-read rule + `syncOrgMembershipClaim` together, purely additive), the backfill (dry-run example output, then `--apply`), a mandatory one-hour soak with its reason (Firebase's fixed 1-hour ID-token lifetime), a mandatory multi-org `orgIds` pre-check before deploy 2, and deploy 2 (removing the Firestore fallback, with plan 40-01's guard test named as the intended tripwire). Every step states what to observe and its rollback. Four residual risks are recorded, including the exact `CLAIM_REFRESH_MAX_ATTEMPTS=4` / `CLAIM_REFRESH_DELAY_MS=1500` (~4.5s worst case) from plan 40-03.
- `cd functions && npm run test` -- 102/102 passing (91 pre-existing + 11 new), no regression. `cd functions && npx tsc --noEmit` exits 0. `git diff functions/package.json functions/package-lock.json` is empty -- no dependency added.

## Task Commits

Each task was committed atomically:

1. **Task 1: Idempotent, dry-run-by-default backfill script over the members collection group** - `c0d2859` (feat)
2. **Task 2: Write functions/DEPLOY-ORG-CLAIMS.md -- the two-deploy sequence, observations, and rollbacks** - `8fecd61` (docs)

## Files Created/Modified

- `functions/src/backfillOrgClaims.ts` - `backfillOrgMembershipClaims`, the structural guard `resolveOrgId`, and a `require.main === module`-guarded CLI wrapper. No `initializeApp()` call reachable from importing the module.
- `functions/src/backfillOrgClaims.test.ts` - 11 tests: apply-mode processed count, idempotent second run, dry-run write-suppression, pending-invite absence, missing-user-document skip, non-primary-org skip, per-uid failure with continuation, both structural-guard cases, the summary shape, and the defensive clear-not-reachable path.
- `functions/DEPLOY-ORG-CLAIMS.md` - The two-deploy runbook: what is being rolled out, pre-flight, four numbered steps (deploy 1, backfill, soak, deploy 2) each with observe/rollback, four known limitations/residual risks, and a closing recovery section.

## Decisions Made

- Confirmed `require.main === module` works correctly under vitest's CJS interop by actually running the test suite rather than assuming it -- no `import.meta.url`-based fallback was needed, matching the plan's exact instruction.
- The structural guard `continue`s before any counter increment (mirrors `MEDIA_PATH_GUARD`'s pre-`scannedCount` discipline) -- a guard-failed document is invisible to `processed`/`skipped`/`failed` entirely, distinct from the missing-user-document case which IS counted as `skipped`.
- Added one test beyond the plan's `<behavior>` list, for the defensive `clear`-not-reachable branch: even though `decideMembershipClaim` can only return `{action: 'clear'}` for a delete (role undefined), and a deleted document is never returned by `collectionGroup('members').get()`, the defensive skip-without-throw handling is still directly exercised so it is not untested dead code.
- Deploy commands in the runbook were derived from `firebase.json` rather than assumed: `firebase deploy --only storage,functions:syncOrgMembershipClaim` for deploy 1 (storage target + one named function in the `default` codebase), `firebase deploy --only storage` for deploy 2.
- Added explicit "Rollback" subsections to Steps 2 (backfill) and 3 (soak) in the runbook, beyond the plan's literal four-step description, since the acceptance criteria required every one of the four numbered steps to state a rollback -- for the backfill this is "clear the claim by hand, the fallback is still live regardless"; for the soak it is "waiting causes no state change, abandoning the rollout falls back to Step 1's rollback."

## Deviations from Plan

None -- plan executed exactly as written. Both tasks' acceptance criteria were met without needing to fall back to any documented alternative (e.g., the plan's implicit risk that `require.main === module` might not work under vitest did not materialize).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Nothing was deployed and nothing was run against real data at any point in this plan, consistent with the hard scope fence: no `firebase deploy`, no `gcloud`, and `node lib/backfillOrgClaims.js` was never invoked (the script was only exercised via its unit tests, which import the module without ever reaching the `require.main === module` guard body).

## ROADMAP Criterion 4's "Resumable" Reconciled with D-10's "No Resume-from-Offset"

At n=2 these are the same thing, not in tension. D-11 (idempotency by skip-if-already-matching) means the script is always safely re-runnable from the very top after any interruption -- a second run naturally reports every already-claimed account as `skipped` and writes nothing further, which is resumability in the only sense that matters at this population size. This carries no cursor or offset state that could itself go stale, drift, or need reconciling -- the entire "resume state" is just "run the same query again," proven directly by the idempotency test (`functions/src/backfillOrgClaims.test.ts`'s "immediate second run" case).

## Next Phase/Milestone Readiness

- All four artifacts phase 40 set out to build (`storage.rules`' dual-read, `syncOrgMembershipClaim`, the client's bounded claim-refresh retry, and this plan's backfill + runbook) are complete, tested, and undeployed.
- ROADMAP success criterion 4 is met: the backfill and the exact two-deploy sequence are written and handed to the owner as the next action. Neither deploy ran during this phase.
- No blockers. The owner's next action is to follow `functions/DEPLOY-ORG-CLAIMS.md` starting at its Pre-flight section, when ready.
- Deferred to `.planning/PENDING-VERIFICATION.md` per the v1.5 standing autonomy grant: deploy 1 and the existing-member upload observation, the backfill dry run and apply run against real data, the one-hour soak, accepting the real never-accepted invite, the multi-org pre-check, and deploy 2.

---
*Phase: 40-custom-auth-claim-for-org-membership*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: functions/src/backfillOrgClaims.ts
- FOUND: functions/src/backfillOrgClaims.test.ts
- FOUND: functions/DEPLOY-ORG-CLAIMS.md
- FOUND: .planning/phases/40-custom-auth-claim-for-org-membership/40-04-SUMMARY.md
- FOUND: c0d2859 (feat(40-04): add idempotent backfill script for org membership claims)
- FOUND: 8fecd61 (docs(40-04): write the two-deploy runbook for org membership claims)
