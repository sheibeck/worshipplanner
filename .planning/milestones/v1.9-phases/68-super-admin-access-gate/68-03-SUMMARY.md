---
phase: 68-super-admin-access-gate
plan: 03
subsystem: auth
tags: [firestore-rules, custom-claims, security-rules, rules-unit-testing]

# Dependency graph
requires:
  - phase: 68-super-admin-access-gate (plan 01)
    provides: claim-merge-safety foundation (mergeAndSetCustomClaims helper) that syncSuperAdminClaim (Plan 02) writes the `superAdmin` claim through
provides:
  - "isSuperAdmin() claim-only Firestore rules helper (request.auth.token.superAdmin == true, no get()/exists())"
  - "match /appConfig/{docId} — read+write gated on isSuperAdmin()"
  - "match /superAdmins/{uid} — read+write gated on isSuperAdmin()"
  - "Genuine ALLOW + DENY emulator test coverage for both collections in src/rules.test.ts"
affects: [69-app-config-contents, 68-04-owner-console-route-guard, 68-05-owner-console-roster-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Claim-only Firestore rules helper (no cross-document get()/exists())"]

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts

key-decisions:
  - "isSuperAdmin() is claim-only per R178's locked decision — deliberately does NOT mirror isOrgEditor's exists()/get() cross-document lookup shape, to avoid the exact rules-fragility class behind this repo's documented storage.rules deny-everyone incident (CLAUDE.md, 2026-08-06)."
  - "superAdmin is a wholly separate top-level boolean claim, never reusing role or the string 'admin' from isOrgEditor's per-org normalization — proven by a DENY test using an org-editor token ({orgId, role: 'editor'})."
  - "No appConfig document contents/schema written or validated this plan — Phase 69 owns appConfig/global's managed values; this plan is rules-only."

patterns-established:
  - "Claim-only Firestore rules helper: request.auth.token.<claim> == true, zero get()/exists() — the safer default for any future top-level admin-gated collection in this repo."

requirements-completed: [R178]

coverage:
  - id: D1
    description: "isSuperAdmin() Firestore rules helper is claim-only (no get()/exists()) and gates appConfig/* + superAdmins/* read+write"
    requirement: R178
    verification:
      - kind: integration
        ref: "src/rules.test.ts#appConfig / superAdmins — claim-based isSuperAdmin() gate (R178) > ALLOWS a genuine super-admin to write appConfig/global"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#appConfig / superAdmins — claim-based isSuperAdmin() gate (R178) > ALLOWS a genuine super-admin to write superAdmins/{uid}"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#appConfig / superAdmins — claim-based isSuperAdmin() gate (R178) > DENIES an unauthenticated caller from reading appConfig/global"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#appConfig / superAdmins — claim-based isSuperAdmin() gate (R178) > DENIES a signed-in non-admin from reading appConfig/global"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#appConfig / superAdmins — claim-based isSuperAdmin() gate (R178) > DENIES an ordinary org editor (orgId/role claim, no superAdmin) from writing superAdmins/{uid} — naming-collision guard"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#appConfig / superAdmins — claim-based isSuperAdmin() gate (R178) > DENIES an unauthenticated caller from writing superAdmins/{uid}"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-08-20
status: complete
---

# Phase 68 Plan 03: Claim-Only isSuperAdmin() Firestore Rules Gate Summary

**Claim-only `isSuperAdmin()` Firestore rules helper (`request.auth.token.superAdmin == true`, zero `get()`/`exists()`) gating `appConfig/*` and `superAdmins/*`, proven both directions (genuine ALLOW + DENY) against a real Firestore emulator.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-08-20T15:11:00Z (approx, first tool call)
- **Completed:** 2026-08-20T15:20:00Z (approx)
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- Added `isSuperAdmin()` helper to `firestore.rules`, immediately after `isOrgEditor()`, deliberately claim-only — no cross-document `get()`/`exists()` — per R178's locked decision and the repo's documented `storage.rules` deny-everyone incident.
- Added `match /appConfig/{docId}` and `match /superAdmins/{uid}` top-level blocks, both gated `allow read, write: if isSuperAdmin()`, placed near the existing `aiUsage`/`aiRateLimits` blocks and above the catch-all deny.
- Added a new describe block to `src/rules.test.ts` with 6 tests: 2 genuine ALLOW cases (a real `{superAdmin: true}` token writing `appConfig/global` and `superAdmins/{uid}`) and 4 DENY cases (unauthenticated read, ordinary signed-in user read, unauthenticated write, and the naming-collision guard — an org-editor token `{orgId, role: 'editor'}` denied write to `superAdmins/{uid}`).
- Followed rules-first TDD ordering: Task 1 landed the tests first and proved RED (DENY subset green via `-t "DENIES"`, ALLOW cases failing with `PERMISSION_DENIED` because the rule did not yet exist); Task 2 landed the rule and proved GREEN (all 6 `isSuperAdmin` tests pass via `-t "isSuperAdmin"`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ALLOW + DENY isSuperAdmin() describe block to src/rules.test.ts (tests first)** - `4de4f7d2` (test)
2. **Task 2: Add claim-only isSuperAdmin() helper + appConfig/superAdmins match blocks to firestore.rules** - `ee530cb8` (feat)

_TDD RED/GREEN gate sequence confirmed: `4de4f7d2` (test, RED) precedes `ee530cb8` (feat, GREEN) in git log — no separate refactor commit needed._

## Files Created/Modified
- `firestore.rules` - Added `isSuperAdmin()` helper (claim-only) and two top-level match blocks (`appConfig/{docId}`, `superAdmins/{uid}`) both gated on it.
- `src/rules.test.ts` - Added `describe('appConfig / superAdmins — claim-based isSuperAdmin() gate (R178)', ...)` with 2 ALLOW + 4 DENY tests.

## Decisions Made
- Followed 68-PATTERNS.md's prescribed test bodies and rule placement exactly (helper immediately after `isOrgEditor` at ~line 26; match blocks near `aiUsage`/`aiRateLimits` before the catch-all).
- Added two extra DENY tests beyond the plan's minimum three (unauthenticated read on `appConfig/global`, unauthenticated write on `superAdmins/{uid}`) to more fully cover both collections in both directions — consistent with the plan's "genuine ALLOW and DENY, both required" discipline and not a scope change (still R178-scoped rules-only tests).

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the rule and tests worked on first pass against the running emulator.

## Issues Encountered
None. A Firestore emulator was already running on `127.0.0.1:8080` at the start of this plan (confirmed via `curl`/`netstat` before any test run), so both the RED and GREEN gate verifications executed against a real emulator rather than being deferred.

## Verification Evidence

- `npx vitest run --config vitest.rules.config.ts -t "DENIES"` (Task 1, RED gate): 10 passed (includes the 4 new DENY cases plus other DENIES-matching tests in the file); confirms the catch-all denial + claim injection mechanism works before the rule exists.
- `npx vitest run --config vitest.rules.config.ts -t "ALLOWS a genuine super-admin"` (Task 1, RED confirmation): 2 failed as expected — `FirebaseError: 7 PERMISSION_DENIED` on both, proving the ALLOW cases genuinely require Task 2's rule (not a vacuous pass).
- `npx vitest run --config vitest.rules.config.ts -t "isSuperAdmin"` (Task 2, GREEN gate): 6 passed — both ALLOW cases now succeed, all 4 DENY cases still deny.
- `npx vitest run --config vitest.rules.config.ts` (wave-merge gate, full rules suite): `src/rules.test.ts` 167 passed / 13 skipped (full green, includes all pre-existing rules coverage). `src/storage.rules.test.ts` failed with `ECONNREFUSED 127.0.0.1:9199` — this is the documented, known-failing baseline (Storage emulator not running in this environment; CLAUDE.md explains this is an environment limitation of that specific rule, not a regression, and is unrelated to this plan's Firestore-only changes).
- `npm run type-check` (`vue-tsc --build`, the full gate per CLAUDE.md, not the narrower `-p tsconfig.app.json` form): clean, no errors.
- `npx vitest run` (app-suite baseline check): 3732 passed, 1 failed (`RosterView.test.ts` — the pre-existing documented stale-assertion failure), 13 skipped. This matches CLAUDE.md's documented known-failing baseline exactly; `src/rules.test.ts` is excluded from this run by `vite.config.ts` as expected, so this run is unaffected by this plan's rules-test additions.

## User Setup Required

None - no external service configuration required. Per the plan's deploy discipline (v1.9 grant), the `firestore.rules` change is built + tested only; NO `firebase deploy` was run. The owner deploys this rules change later, together with the syncSuperAdminClaim/setSuperAdminClaim functions from Plan 02, per the deploy-discipline handover already documented in 68-CONTEXT.md.

## Next Phase Readiness
- `isSuperAdmin()` is now the real server-side access boundary for `appConfig/*` and `superAdmins/*`, ready for Plan 04 (client route guard, convenience-only) and Plan 05 (owner console roster UI) to build against.
- Phase 69 can now safely add `appConfig/global` document contents/schema — the collection-level access gate already exists and is proven.
- No blockers.

---
*Phase: 68-super-admin-access-gate*
*Completed: 2026-08-20*

## Self-Check: PASSED
- firestore.rules — FOUND
- src/rules.test.ts — FOUND
- .planning/phases/68-super-admin-access-gate/68-03-SUMMARY.md — FOUND
- commit 4de4f7d2 (test) — FOUND
- commit ee530cb8 (feat) — FOUND
