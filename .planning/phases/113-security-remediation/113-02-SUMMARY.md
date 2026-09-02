---
phase: 113-security-remediation
plan: 02
subsystem: auth
tags: [firebase-functions, firebase-auth, custom-claims, storage-rules, revokeRefreshTokens, security]

# Dependency graph
requires:
  - phase: 112-security-review
    provides: SEC-ISO-02 finding (stale-token Storage authz window on member removal)
provides:
  - "syncOrgMembershipClaimHandler's clear branch revokes the removed uid's refresh tokens"
  - "functions unit test proving the revoke fires with the removed uid, and that a revoke throw never changes the clear outcome"
  - "Storage rules ALLOW-case proving the revoke's blast radius is scoped to the removed uid alone (authored, run-when-emulator-available)"
affects: [113-security-remediation (deploy step), future security-review phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getAuth().revokeRefreshTokens(uid) attempted only AFTER the claim write lands, wrapped in its own try/catch that logs a module-prefixed error and swallows -- never rethrows, never alters the caller-visible outcome (mirrors orgProvisioning.ts:461 / ADR-0049)"

key-files:
  created: []
  modified:
    - functions/src/orgMembershipClaims.ts
    - functions/src/orgMembershipClaims.test.ts
    - src/storage.rules.test.ts

key-decisions:
  - "revokeRefreshTokens(uid) added ONLY to the 'clear' branch (member-doc delete) -- 'set' and 'skip' branches are untouched, matching the plan's scope (a role change or unrelated-org write must not force re-auth)"
  - "Revoke happens strictly AFTER mergeSetAndClearCustomClaims succeeds, in its own try/catch: a revoke failure is logged-and-swallowed and never changes the returned { action: 'clear' } outcome, so the claim clear (the actual Firestore/Storage deny) is never undone by a revoke hiccup"
  - "Storage ALLOW-case authored per plan's Claude's Discretion clause: attempted against the live Storage emulator (127.0.0.1:9199), confirmed unreachable this session (ECONNREFUSED), so it is committed run-when-available rather than blocking the phase -- the functions-level unit test is the primary, emulator-independent proof"

requirements-completed: [R323]

coverage:
  - id: D1
    description: "syncOrgMembershipClaimHandler's clear branch calls getAuth().revokeRefreshTokens(uid) for the removed uid, only after the claim clear lands"
    requirement: "R323"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#primary-org DELETE while the user still belongs to a second org: ... revokeRefreshTokens assertion"
        status: pass
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#primary-org DELETE when the user belongs to no other org: ... revokeRefreshTokens assertion"
        status: pass
    human_judgment: false
  - id: D2
    description: "A revokeRefreshTokens failure on the clear path is logged and swallowed -- the outcome stays { action: 'clear' }, never surfaced as 'failed'"
    requirement: "R323"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#SEC-ISO-02 WR-02: a revokeRefreshTokens failure on the clear path is logged and swallowed"
        status: pass
    human_judgment: false
  - id: D3
    description: "A remaining member of an org retains Storage read/write access after an unrelated member of the same org is removed (revoke blast radius is scoped, not org-wide)"
    requirement: "R323"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — SEC-ISO-02 revoke blast radius (Phase 113) > a REMAINING member of an org still has read/write access after an UNRELATED member of the same org is removed"
        status: unknown
    human_judgment: true
    rationale: "Storage emulator (127.0.0.1:9199) was unreachable this session (ECONNREFUSED) -- test is authored and committed, will execute automatically once the emulator is up. Not a regression; documented env limitation, matches CLAUDE.md's known-baseline caveats. The functions-level D1/D2 tests are the primary, emulator-independent proof of the fix itself."

# Metrics
duration: 27min
completed: 2026-09-02
status: complete
---

# Phase 113 Plan 02: SEC-ISO-02 Refresh Token Revocation Summary

**Added `getAuth().revokeRefreshTokens(uid)` to `syncOrgMembershipClaimHandler`'s clear branch, closing the ~55-minute stale-token Storage authz window on member removal, with a functions unit test proving it fires and a Storage ALLOW-case proving scoped blast radius.**

## Performance

- **Duration:** 27 min
- **Started:** ~2026-09-02T15:50:00-04:00
- **Completed:** 2026-09-02T16:16:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `syncOrgMembershipClaimHandler`'s "clear" branch (member-doc delete) now revokes the removed uid's Firebase Auth refresh tokens immediately after the claim clear lands, forcing re-auth so Storage's claim-only membership check stops honoring an already-issued token.
- Functions unit test suite extended: both existing clear-branch tests assert `revokeRefreshTokens` was called with the removed uid; a new WR-02-style test proves a revoke throw is logged-and-swallowed and never changes the returned `{ action: "clear" }` outcome.
- Storage rules ALLOW-case authored (`src/storage.rules.test.ts`) proving a remaining org member retains access after an unrelated member's removal -- the scoped-blast-radius proof. Attempted against the live Storage emulator; confirmed unreachable this session (`ECONNREFUSED 127.0.0.1:9199`), so committed as run-when-emulator-available per plan's discretion clause.
- `npm run type-check` clean; `cd functions && npm test` passes (637/637); root `npx vitest run` confirmed at documented baseline (183/184 files pass, only `src/storage.rules.test.ts` fails, purely due to the unreachable Storage emulator).
- No `firebase deploy` or `gcloud` command run.

## Task Commits

Each task was committed atomically:

1. **Task 1: SEC-ISO-02 — add revokeRefreshTokens to the clear branch + functions unit test** - `63f0616e` (fix)
2. **Task 2: Storage ALLOW-case test (remaining member retains access) + functions type-check gate** - `38d623b9` (test)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `functions/src/orgMembershipClaims.ts` - `case "clear"` branch now calls `getAuth().revokeRefreshTokens(uid)` in a logged, non-blocking try/catch, mirroring `orgProvisioning.ts:461`/ADR-0049
- `functions/src/orgMembershipClaims.test.ts` - `firebase-admin/auth` mock factory, `mockAuth`, and `statefulAuth` extended with a `revokeRefreshTokens` spy; both clear-branch tests assert the revoke call; new WR-02 revoke-throw test added
- `src/storage.rules.test.ts` - new `describe('storage.rules — SEC-ISO-02 revoke blast radius (Phase 113)')` block with an ALLOW-case test; `deleteDoc` added to the top-level `firebase/firestore` import

## Decisions Made
- Scoped the revoke strictly to the "clear" branch — `set`/`skip` branches are untouched (a role change or an unrelated org's write must never force re-auth for a still-valid membership).
- Ordering: revoke only fires after `mergeSetAndClearCustomClaims` succeeds, and its own failure is caught, logged with a `[orgMembershipClaims]`-prefixed message, and swallowed — the returned `{ action: "clear" }` never changes, so the actual Firestore/Storage deny is never undone by a revoke hiccup.
- Storage ALLOW-case: attempted the live emulator first (per plan's "Claude's Discretion" clause); confirmed genuinely unreachable (`ECONNREFUSED`, not a rule failure) and committed the authored test with a clear inline run-when-available note rather than blocking the phase, since the functions-level unit test is the primary, emulator-independent proof.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>`/`<acceptance_criteria>` blocks; the Storage-emulator fallback path was explicitly anticipated by the plan and context (113-CONTEXT.md's "Claude's Discretion" and "Deferred" sections).

## Issues Encountered
- The Storage emulator (127.0.0.1:9199) was unreachable this session (`ECONNREFUSED`). Confirmed via a direct `curl` probe and by running `npx vitest run --config vitest.rules.config.ts src/storage.rules.test.ts` directly: the entire file fails at `beforeAll`'s `initializeTestEnvironment` call with `connect ECONNREFUSED 127.0.0.1:9199`, meaning every test in the file (including the new ALLOW-case) is skipped for this reason alone, not because of a rule defect. This matches the documented CLAUDE.md/112-SECURITY-REVIEW.md caveat that the Storage emulator was unreachable during Phase 112 as well. Resolution: authored the test, left it in the committed suite (it will run automatically the next time the emulator is up), and did not let it block the phase, per the plan's explicit guidance.

## User Setup Required

None - no external service configuration required. (Owner UAT/deploy confirmation for the phase's overall `firestore.rules` + this functions change happens at the orchestrator's deploy step, not in this plan.)

## Next Phase Readiness
- SEC-ISO-02 is code-complete, tested, and committed, UNDEPLOYED per plan scope.
- The orchestrator's deploy step should rebuild `functions` (`cd functions && npm run build` or equivalent) before any `firebase deploy --only functions`, and re-confirm with the owner per the standing deploy-policy-confirm-then-deploy rule.
- The Storage ALLOW-case test (D3) should be re-run once the Storage emulator is available (e.g., via `firebase emulators:start` or `npm run test:rules` with 9199 up) to close out its `unknown` verification status — this does not block SEC-ISO-02's correctness, which is proven by the functions-level tests (D1/D2).

---
*Phase: 113-security-remediation*
*Completed: 2026-09-02*

## Self-Check: PASSED
All key files verified present on disk; both task commits (63f0616e, 38d623b9) verified in git log.
