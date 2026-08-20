---
phase: 68-super-admin-access-gate
plan: 01
subsystem: auth
tags: [firebase-admin, custom-claims, cloud-functions, vitest]

# Dependency graph
requires: []
provides:
  - "functions/src/claimsHelpers.ts: mergeAndSetCustomClaims(uid, patch) and clearClaimKeys(uid, keys) — the single shared read-merge-write claim writer every future custom-claim writer in this app must route through"
  - "orgMembershipClaims.ts's 'set' and 'clear' branches refactored onto the shared helper, closing the claim-replace/claim-wipe hazard (R175)"
  - "'preserves superAdmin' regression proving org-membership churn never strips an unrelated custom claim"
affects: [68-02, superAdminClaims, syncSuperAdminClaim, bootstrapSuperAdmin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared read-merge-write claim helper (claimsHelpers.ts) — read current via getAuth().getUser(uid), shallow-merge/scoped-delete, write back; null passed only when the clear result is empty"
    - "Spread a plan-defined interface into a fresh object literal at the call site when passing it to a Record<string, unknown> parameter — avoids TS2345 'index signature missing' without loosening the helper's own signature"

key-files:
  created:
    - functions/src/claimsHelpers.ts
    - functions/src/claimsHelpers.test.ts
  modified:
    - functions/src/orgMembershipClaims.ts
    - functions/src/orgMembershipClaims.test.ts

key-decisions:
  - "Both blind-write call sites (the 'set' at line ~188 and the 'clear' at line ~191) were refactored, not just the more visible 'set' branch — the plan's documented Pitfall 1 (fixing only 'set' still wipes superAdmin via the clear branch's null argument)"
  - "decision.claims is spread into a fresh object literal ({ ...decision.claims }) at the mergeAndSetCustomClaims call site rather than widening the helper's Record<string, unknown> signature — keeps the plan-specified helper signature exact while satisfying tsc's index-signature assignability rule"

patterns-established:
  - "Pattern: every future custom-claim writer (syncSuperAdminClaim in Plan 02, any later claim type) must call mergeAndSetCustomClaims/clearClaimKeys — never getAuth().setCustomUserClaims directly"

requirements-completed: [R175]

coverage:
  - id: D1
    description: "mergeAndSetCustomClaims(uid, patch) shallow-merges onto existing claims (preserves unrelated keys), writes just the patch when there are no existing claims, and later-patch keys overwrite same-named existing keys"
    requirement: "R175"
    verification:
      - kind: unit
        ref: "functions/src/claimsHelpers.test.ts#mergeAndSetCustomClaims (3 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "clearClaimKeys(uid, keys) removes only the named keys (preserving unrelated claims like superAdmin), and passes null (never {}) only when nothing remains after the clear"
    requirement: "R175"
    verification:
      - kind: unit
        ref: "functions/src/claimsHelpers.test.ts#clearClaimKeys (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "orgMembershipClaims.ts's 'set' branch routes through mergeAndSetCustomClaims and 'clear' branch routes through clearClaimKeys(uid, ORG_CLAIM_KEYS) — no direct setCustomUserClaims remains in the switch"
    requirement: "R175"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler (existing 9 tests, all still pass against the refactored implementation)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SC1 direction A regression: a user carrying { orgId, role, superAdmin: true } whose primary org membership is deleted ends with setCustomUserClaims called with { superAdmin: true } (not null) — superAdmin survives an org-membership clear, outcome remains { action: 'clear' }"
    requirement: "R175"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#\"preserves superAdmin: a primary-org membership delete clears only { orgId, role }...\""
        status: pass
    human_judgment: false
  - id: D5
    description: "Whole functions test suite green and functions' own tsc build clean after the refactor (no regression to existing behavior)"
    verification:
      - kind: unit
        ref: "cd functions && npm test (378/378 passed)"
        status: pass
      - kind: other
        ref: "cd functions && npm run build (tsc, exit 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Root type-check gate (vue-tsc --build, per CLAUDE.md) stays clean"
    verification:
      - kind: other
        ref: "npm run type-check (exit 0)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-08-20
status: complete
---

# Phase 68 Plan 01: Claim-Merge-Safety Foundation Summary

**Shared `mergeAndSetCustomClaims`/`clearClaimKeys` helper closes the custom-claims replace/wipe hazard in both `orgMembershipClaims.ts` write branches, proven by a regression showing an org-membership clear preserves an unrelated `superAdmin` claim.**

## Performance

- **Duration:** 9 min (11:02–11:11 local)
- **Started:** 2026-08-20T15:02:00Z
- **Completed:** 2026-08-20T15:11:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- New `functions/src/claimsHelpers.ts` exporting `mergeAndSetCustomClaims(uid, patch)` (read-current → shallow-merge → write) and `clearClaimKeys(uid, keys)` (read-current → delete named keys → write, `null` only when the result is empty).
- `orgMembershipClaims.ts`'s `syncOrgMembershipClaimHandler` no longer calls `getAuth().setCustomUserClaims` directly anywhere — both the `'set'` branch (merge) and the `'clear'` branch (scoped clear via `ORG_CLAIM_KEYS`) route through the shared helper.
- New "preserves superAdmin" regression in `orgMembershipClaims.test.ts` proving SC1 direction A: an org-membership clear on a user who also carries `superAdmin: true` leaves that claim intact.
- Fixed a genuine `tsc` build error (TS2345) surfaced by the refactor, invisible to the root `vue-tsc --build` gate because `functions/` isn't part of that project.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create claimsHelpers.ts shared read-merge-write helper + unit test** - `ef11b81a` (feat)
2. **Task 2: Route orgMembershipClaims.ts both write branches through the helper + SC1 regression test** - `0f62d02f` (fix)

**Deviation fix commit:** `3e40f5c8` (fix — TS2345 in `functions`' own `tsc` build, see Deviations below)

**Plan metadata:** commit created below (docs: complete plan)

## Files Created/Modified
- `functions/src/claimsHelpers.ts` - `mergeAndSetCustomClaims`/`clearClaimKeys`, the shared read-merge-write custom-claims writer
- `functions/src/claimsHelpers.test.ts` - 6 unit tests proving merge-preserves-unrelated-keys and clear-scopes-to-named-keys (including null-on-empty-clear)
- `functions/src/orgMembershipClaims.ts` - `'set'`/`'clear'` branches of `syncOrgMembershipClaimHandler` refactored onto `claimsHelpers`; call-site spread fix for TS2345
- `functions/src/orgMembershipClaims.test.ts` - added the "preserves superAdmin" SC1 regression (all 24 tests, including pre-existing 23, pass unmodified against the new implementation)

## Decisions Made
- Both write branches (`'set'` and `'clear'`) were changed in the same commit-pair, per the plan's explicit Pitfall 1 warning — the `'clear'` branch's old `setCustomUserClaims(uid, null)` is the more dangerous of the two since `null` wipes the entire claims object, not just `{orgId, role}`.
- `decision.claims` (typed `OrgMembershipClaim`, no index signature) is spread into a fresh object literal (`{ ...decision.claims }`) at the `mergeAndSetCustomClaims` call site rather than loosening the helper's `Record<string, unknown>` parameter type — verified via an isolated `tsc --strict` scratch test that spreading (unlike passing the typed variable directly, and unlike an `as` cast) satisfies the index-signature assignability rule cleanly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2345 in functions' own `tsc` build after the refactor**
- **Found during:** Task 2 gate verification (running `cd functions && npm run build` after the plan's specified test/type-check gates)
- **Issue:** `await mergeAndSetCustomClaims(uid, decision.claims);` fails `tsc` with `TS2345: Argument of type 'OrgMembershipClaim' is not assignable to parameter of type 'Record<string, unknown>'. Index signature for type 'string' is missing in type 'OrgMembershipClaim'.` This is invisible to the plan's specified `npm run type-check` gate (root `vue-tsc --build`) because `functions/` has its own standalone `tsc` build (`functions/tsconfig.json`), not included in the root project references.
- **Fix:** Changed the call site to `await mergeAndSetCustomClaims(uid, { ...decision.claims });` — spreading into a fresh object literal satisfies TS's index-signature assignability check without widening the helper's plan-specified `Record<string, unknown>` signature. Confirmed via an isolated `tsc --strict` scratch check that the direct-variable and `as`-cast forms both still fail, while the spread form compiles cleanly.
- **Files modified:** `functions/src/orgMembershipClaims.ts`
- **Verification:** `cd functions && npm run build` exits 0; full `cd functions && npm test` (378/378) and root `npm run type-check` (`vue-tsc --build`) both still pass.
- **Committed in:** `3e40f5c8`

---

**Total deviations:** 1 auto-fixed (1 blocking build error, Rule 1)
**Impact on plan:** Necessary correctness fix surfaced by running `functions`' own `tsc` build in addition to the plan's specified gates — no scope creep, no behavior change to the helper's public contract.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required. No deploy performed (v1.9 deploy discipline: build + test only).

## Next Phase Readiness
- `claimsHelpers.ts` is ready for Plan 02's `syncSuperAdminClaim` trigger and `bootstrapSuperAdmin.ts` script to both route through the same `mergeAndSetCustomClaims`/`clearClaimKeys` helper, per CONTEXT.md's locked "one shared helper" decision.
- No blockers. The merge-safety fix landed strictly before the new `superAdmin` claim type is introduced, matching the plan's stated Wave-1-before-Wave-2 rationale.

---
*Phase: 68-super-admin-access-gate*
*Completed: 2026-08-20*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all three task/deviation commit hashes (`ef11b81a`, `0f62d02f`, `3e40f5c8`) confirmed in `git log`.
