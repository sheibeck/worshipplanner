---
phase: 73-multi-org-storage-auth-claim
plan: 02
subsystem: auth
tags: [firebase, storage-rules, auth-claims, emulator-testing]

# Dependency graph
requires:
  - phase: 73-multi-org-storage-auth-claim (plan 01)
    provides: "the widened syncOrgMembershipClaimHandler that writes the additive `orgs: {orgId: role}` claim map alongside the unchanged primary orgId/role"
provides:
  - "storage.rules isOrgMemberByClaim widened with a null-guarded multi-org orgs-map arm, ORed with the unchanged legacy orgId/role arm"
  - "genuine emulator proof: multi-org ALLOW on two orgs, cross-org DENY, legacy-claim ALLOW (R211 backward-compat)"
affects: [74-organizations-tab-owner-console]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Null-guard-before-index pattern for reading a map-shaped custom claim in Storage rules (orgs != null && orgs[orgId] != null) before ORing with a legacy scalar-claim arm"

key-files:
  created: []
  modified:
    - storage.rules
    - src/storage.rules.test.ts

key-decisions:
  - "Kept the multi-org arm and legacy arm ORed (never ANDed) per plan/research, so a not-yet-backfilled token is never denied access to its own primary org during rollout"
  - "Did not touch isOrgMember, size caps, or any Firestore-side rule — scope stayed exactly to isOrgMemberByClaim and its comments plus the test file per the plan's file list"

patterns-established:
  - "Null-guard-before-index for map-shaped custom claims in security rules languages that hard-deny on an evaluation error rather than returning false"

requirements-completed: [R209, R211]

coverage:
  - id: D1
    description: "storage.rules isOrgMemberByClaim widened with a new orgs-map arm (null-guarded) ORed with the unchanged legacy orgId/role arm; module comments updated to describe the widened design"
    requirement: R209
    verification:
      - kind: unit
        ref: "node -e static-assertion check (Task 1 automated verify) — confirms request.auth.token.orgs is read and no firestore.exists( is present"
        status: pass
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — claim-only membership (Deploy 2, R075 guard) > proves membership on the claim ALONE, with no Firestore fallback re-introduced"
        status: pass
    human_judgment: false
  - id: D2
    description: "Multi-org ALLOW — a user whose orgs claim map carries orgA+orgB succeeds read/write on BOTH orgs/orgA/** and orgs/orgB/**"
    requirement: R209
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — multi-org claim (phase 73, R209/R211) > allows a multi-org user to read and write under BOTH orgs in their orgs map"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cross-org DENY — the same multi-org user is denied under orgC, which is absent from their orgs map"
    requirement: R209
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — multi-org claim (phase 73, R209/R211) > denies a multi-org user under an org NOT present in their orgs map (cross-org DENY)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Legacy-claim ALLOW — a token carrying only orgId/role (no orgs key at all) still succeeds on its primary org, proving R211 backward-compat and the null-guard from Pitfall 4"
    requirement: R211
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — multi-org claim (phase 73, R209/R211) > allows a legacy claim (no orgs key at all) to still access its primary org (R211)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-21
status: complete
---

# Phase 73 Plan 2: Multi-Org Storage Auth Claim — Rules Widening Summary

**Widened `storage.rules`' `isOrgMemberByClaim` with a null-guarded `orgs`-map arm ORed with the unchanged legacy arm, proven by genuine multi-org ALLOW, cross-org DENY, and legacy-claim ALLOW emulator tests.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-21T18:35:00Z
- **Completed:** 2026-08-21T19:00:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `isOrgMemberByClaim(orgId)` now checks the full `orgs` claim map (guarded null-check before indexing, per RESEARCH Pitfall 4) ORed with the unchanged legacy `orgId == orgId && role != null` arm, so both a genuinely multi-org user and a not-yet-backfilled legacy token authorize correctly with no access gap.
- Updated both stale module comment blocks (the "v1.5 claim migration — COMPLETE" header block and the "KNOWN LIMITATION (D-01/D-04)" block above the function) to describe the widened design, retiring the single-primary-org limitation language.
- Added three new emulator-backed tests proving the exact three behavioral truths the plan requires: multi-org ALLOW across two orgs, cross-org DENY on an org absent from the claim map, and legacy-claim ALLOW with no `orgs` key at all.
- Extended the existing static-assertion guard test to positively assert `request.auth.token.orgs` is read by the rule text, while keeping every existing negative assertion (no `firestore.exists(`, no `isOrgMemberByFirestore`, no `/databases/(default)/documents/`) unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen isOrgMemberByClaim with the orgs-map arm (null-guarded) and update the module comments** - `f781af39` (feat)
2. **Task 2: Extend the emulator rules suite — multi-org ALLOW, cross-org DENY, legacy-claim ALLOW, static guard** - `e89d43c0` (test)

## Files Created/Modified
- `storage.rules` - Widened `isOrgMemberByClaim` with the null-guarded multi-org `orgs`-map arm ORed with the unchanged legacy arm; updated the two stale comment blocks
- `src/storage.rules.test.ts` - Added multi-org ALLOW, cross-org DENY, and legacy-claim ALLOW emulator tests; extended the static-assertion guard to positively assert `request.auth.token.orgs` is read

## Decisions Made
- Kept the new arm and the legacy arm ORed (never ANDed), matching the plan and RESEARCH Code Examples exactly, so no scenario can leave a not-yet-backfilled token without access to its own primary org.
- Guarded `orgs != null` before indexing `orgs[orgId]` per Pitfall 4 — verified concretely by the legacy-claim ALLOW test, which would fail with a rules evaluation error (hard deny) rather than a clean pass if the guard were missing or ordered incorrectly.
- Did not touch `isOrgMember`, either size-cap conjunct, or `firestore.rules` — stayed exactly within the plan's `files_modified` list.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. An emulator was already running on ports 8080/9199 from a prior session, so per `CLAUDE.md` guidance the direct `npx vitest run --config vitest.rules.config.ts` form was used instead of `npm run test:rules` (which would have failed with "port taken"). All 183 tests in the rules suite (`src/rules.test.ts` + `src/storage.rules.test.ts`) passed — the two baseline failures documented in `CLAUDE.md` for `src/storage.rules.test.ts` did not manifest, because that document describes a firestore.exists() cross-service limitation from before Phase 40 Deploy 2 removed the fallback arm from storage.rules; the current test file has no test that depends on that removed check. `npm run type-check` (root `vue-tsc --build`) also passed clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
`storage.rules` now authorizes a genuinely multi-org user (once plan 73-01's claim writer populates the `orgs` map and the phase's backfill/deploy plan runs it) on every org they belong to, with zero access gap for not-yet-backfilled sessions. This is the authorization prerequisite Phase 74 (Organizations tab / owner console) needs before it can safely let a user operate across multiple orgs. Remaining work in this phase: plan 73-03 (backfill script + deploy runbook), not part of this plan.

---
*Phase: 73-multi-org-storage-auth-claim*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: storage.rules
- FOUND: src/storage.rules.test.ts
- FOUND: f781af39
- FOUND: e89d43c0
