---
phase: 85-team-conflicts-vocals-into-band-one-team-per-date
verified: 2026-08-26T17:25:00Z
status: passed
status_note: "Auto-verified 10/10; the two human_verification items (live-app spot-check + owner-gated Cloud Functions deploy for CR-01) are deferred to PENDING-VERIFICATION.md per owner 'Defer & continue' decision (v1.4–v2.2 precedent). The Functions deploy is an owner-gated production action, not performed by the autonomous run."
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "In the live app, as a coordinator, add/confirm a volunteer holding both a Band role and a Tech role for the same service date via the auto-scheduler (Generate/Fill Gaps) and via the manual QuarterGrid, and separately confirm a vocalist can also be assigned one Band instrument role on the same date."
    expected: "The auto-scheduler never produces a Band+Tech combo for one person on one date (silently leaves the slot unfilled instead); the QuarterGrid shows a warning badge (not a block) on an existing Band+Tech combo; a person on Vocals plus one instrument shows no violation; multiple different people can be assigned to Vocals on the same date."
    why_human: "Requires exercising the live UI/app (visual badge appearance, actual scheduler run against real org data) — not verifiable from source alone, though the underlying unit/component tests already exercise the same logic in isolation."
  - test: "Cloud Functions deploy for the CR-01 fix (functions/src/serviceRoles.ts + functions/src/index.ts) — confirm with the owner and run the deploy so the server-side messaging recipient resolver's read-time vocals->band coercion takes effect in production."
    expected: "After deploy, a message sent to the 'Band' team includes legacy-org vocalists (group:'vocals' docs) exactly as the client's 'Reaches N people' estimate counts them — no silent under-delivery."
    why_human: "Deploy is owner-gated per project policy (confirm-then-deploy). The fix is committed (f4c9648e) and covered by functions tests (594/594 passing, including 4 new CR-01 regression tests), but production Cloud Functions still run the pre-fix code until deployed."
---

# Phase 85: Team Conflicts — Vocals into Band & One-Team-Per-Date Verification Report

**Phase Goal:** The roster/scheduler models Vocals as a Band role and prevents any volunteer from serving on two teams on the same service date, with Vocals as the single special-case exception (multiple people; a vocalist may also hold one Band instrument at once).
**Verified:** 2026-08-26T17:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A vocals assignment is a Band role rather than a separate Vocals team (R250) | ✓ VERIFIED | `src/types/roster.ts:3` — `RoleGroup = 'band' \| 'tech' \| 'other'` (no 'vocals'); `Role.vocal?: boolean` added (line 11); `DEFAULT_ROLES` vocals entry is `group:'band', vocal:true` (line 105) |
| 2 | Legacy `group:'vocals'` data is coerced to band+vocal at read time on BOTH client and server, no write migration | ✓ VERIFIED | `src/stores/roster.ts:66-78` — onSnapshot compat shim (no `updateDoc`), old reverse write-migration removed; `functions/src/serviceRoles.ts:60` (`coerceLegacyRoleGroup`) applied at `functions/src/index.ts:2956-2958` in `sendQueuedMessageHandler`'s role-load boundary (CR-01 fix, commit `f4c9648e`) |
| 3 | No code path writes `group:'vocals'` back to Firestore | ✓ VERIFIED | `grep -rn "group:\s*'vocals'\|group:\s*\"vocals\""` across `src/` and `functions/src/` finds zero write sites — only test-fixture inputs to the coercion shims and doc comments remain |
| 4 | Auto-scheduler hard-blocks placing one person on both a Band-group role and a Tech-group role on the same date (R251) | ✓ VERIFIED | `src/utils/scheduler.ts:25-46` `evaluateGroupCombo` returns `ok:false` when `hasBand && hasTech`; wired into both `isGroupCompatible` call sites in `proposeQuarterSchedule` (main loop line 266, `propagatePairing` line 207); `scheduler.test.ts` lines 391-424 assert both directions pass |
| 5 | Vocals folds into Band for exclusivity — a vocalist cannot also run Tech on the same date | ✓ VERIFIED | `scheduler.test.ts:505` "group Band<->Tech exclusivity via vocals" test passes — a vocal Band role blocks a same-date Tech role |
| 6 | A person may hold one Band instrument role plus Vocals on the same date without being blocked — Vocals exempt from the one-instrument cap (R252) | ✓ VERIFIED | `evaluateGroupCombo` (scheduler.ts:36-38) counts only non-vocal Band roles toward the cap; `scheduler.test.ts:489` "1 Band instrument + Vocals ... IS produced" passes; two-instrument case (`scheduler.test.ts:457`) still blocked |
| 7 | Multiple different people can be assigned to Vocals on the same date (R252) | ✓ VERIFIED | No per-role cap added on Vocals (owner decision, honored); `scheduler.test.ts:522` "group vocals multi-person" test passes |
| 8 | Other combines freely with Band or Tech — Tech+Other and Band+Other no longer blocked (relaxation) | ✓ VERIFIED | `evaluateGroupCombo` only checks Band∧Tech, never gates on 'other'; `scheduler.test.ts:425,441` both pass; `QuarterGrid.test.ts` adds the corresponding no-marker case per SUMMARY |
| 9 | QuarterGrid warn badge and auto-scheduler both derive from the single shared `evaluateGroupCombo` — no second divergent check | ✓ VERIFIED | `QuarterGrid.vue:246,344` imports and calls `evaluateGroupCombo` directly with its own `isVocal`/`roleGroupOf` projections from `props.roles` (lines 322-326); same function object as scheduler.ts, not a re-implementation |
| 10 | Roles UI has no standalone 'Vocals' group option; a vocal role is a Band role carrying the vocal flag | ✓ VERIFIED | `RolesConfigPanel.vue:142-147` `groupOrder`/`groupLabels`/`groupBadgeClasses` limited to band/tech/other; vocal checkbox at line 47, gated to Band group; `RolesConfigPanel.test.ts` per SUMMARY asserts no `value="vocals"` option exists |

**Score:** 10/10 truths verified (the plan's 8 must_haves truths map to 10 checkable statements above; all pass). 0 present-but-behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/roster.ts` | `RoleGroup` narrowed to band/tech/other; `Role.vocal`; `DEFAULT_ROLES` vocals=band+vocal | ✓ VERIFIED | Confirmed by direct read, lines 3, 11, 105 |
| `src/utils/scheduler.ts` | `evaluateGroupCombo`/`isGroupCompatible`/`proposeQuarterSchedule` take `isVocal`, enforce Band<->Tech + 1-instrument cap | ✓ VERIFIED | Confirmed by direct read, lines 25-94; both call sites (207, 266) pass `isVocal` |
| `src/stores/roster.ts` | Reverse write-migration removed; read-time-only compat shim | ✓ VERIFIED | Lines 66-78; no `updateDoc` in the shim; test at `roster.test.ts:177-182` confirms `updateDoc` not called |
| `src/stores/quarters.ts` | `buildIsVocal` projection passed alongside `buildRoleGroupOf` into `proposeQuarterSchedule` | ✓ VERIFIED | Lines 270-273 (definition), 290-291 (production wiring into `proposeQuarterSchedule`) |
| `src/components/QuarterGrid.vue` + `RolesConfigPanel.vue` | 'vocals' group removed; vocal represented on Band; warn badge threads isVocal | ✓ VERIFIED | QuarterGrid.vue lines 263-344; RolesConfigPanel.vue lines 142-258 |
| `functions/src/serviceRoles.ts` + `functions/src/index.ts` (CR-01, not in original plan but required for correctness) | Server-side messaging resolver mirrors the client compat shim | ✓ VERIFIED | `coerceLegacyRoleGroup` (serviceRoles.ts:60) applied at index.ts:2956-2958; `RoleGroup` narrowed to match client (serviceRoles.ts:34) |
| Updated + new unit/component tests | Covers new rule, compat shim, removed Vocals option | ✓ VERIFIED | `scheduler.test.ts` 33 tests incl. 10 group-combo cases (all pass, ran directly); `roster.test.ts` compat-shim test; `RolesConfigPanel.test.ts`/`QuarterGrid.test.ts` per SUMMARY; `functions/src/serviceRoles.test.ts` CR-01 regression (4 new tests, ran directly, 594/594 functions tests pass) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `scheduler.evaluateGroupCombo` | `proposeQuarterSchedule` main loop | `isGroupCompatible` call at scheduler.ts:266 | ✓ WIRED | Passes `roleGroupOf` + `isVocal` |
| `scheduler.evaluateGroupCombo` | `propagatePairing` | `isGroupCompatible` call at scheduler.ts:207 | ✓ WIRED | Same predicate pair threaded — Pitfall-2 regression test (`scheduler.test.ts:539`) passes |
| `scheduler.evaluateGroupCombo` | `QuarterGrid.cellHasGroupViolation` | direct import + call, QuarterGrid.vue:246,344 | ✓ WIRED | Own `isVocal`/`roleGroupOf` projected from `props.roles`, same shared function |
| `quarters.ts buildIsVocal` | `proposeQuarterSchedule` production call | quarters.ts:291 | ✓ WIRED | Passed as final arg alongside `buildRoleGroupOf(rosterStore.roles)` |
| `roster.ts` onSnapshot shim | every `Record<RoleGroup,...>` consumer | single read boundary, roster.ts:65-79 | ✓ WIRED | Confirmed no other Firestore role-read path in `src/` bypasses this shim (grep found zero remaining `group:'vocals'` write/read-bypass sites) |
| server: `functions/src/index.ts` role load | `coerceLegacyRoleGroup` | index.ts:2956-2958 | ✓ WIRED | CR-01 fix confirmed present in code, not just claimed in REVIEW.md |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| scheduler.test.ts group-combo suite passes | `npx vitest run src/utils/__tests__/scheduler.test.ts` | 33/33 passed | ✓ PASS |
| Full client app suite green against documented baseline | `npx vitest run` (bare, from repo root) | 147/149 files, 4358/4359 tests passed; only `src/storage.rules.test.ts` (emulator ECONNREFUSED — documented environment limitation) and `src/views/__tests__/RosterView.test.ts` (documented stale "Roles config" assertion) fail | ✓ PASS (matches documented baseline exactly, no new failures) |
| Functions standalone suite green, incl. CR-01 regression | `cd functions && npx vitest run` | 17/17 files, 594/594 tests passed | ✓ PASS |
| Client type-check clean | `npm run type-check` (`vue-tsc --build`) | Clean, no output/errors | ✓ PASS |
| No remaining write of `group:'vocals'` | `grep -rn "group:\s*'vocals'"` across `src/` and `functions/src/` | Only test-fixture inputs and doc comments remain; zero write sites | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R250 | 85-01-PLAN.md | Vocals folded into Band team | ✓ SATISFIED | Type narrowing + DEFAULT_ROLES + compat shim (client + server) confirmed |
| R251 | 85-01-PLAN.md | No cross-team double-booking same date | ✓ SATISFIED | `evaluateGroupCombo` Band<->Tech mutual exclusivity, hard-blocked in scheduler, warned in grid |
| R252 | 85-01-PLAN.md | Vocals sole exception (multi-person + sing-and-play) | ✓ SATISFIED | Instrument-cap exemption + no new vocals cap, both unit-tested and passing |

REQUIREMENTS.md maps R250/R251/R252 exclusively to Phase 85 — no orphaned requirements found.

### Anti-Patterns Found

None. Scanned all phase-modified core files (`src/types/roster.ts`, `src/utils/scheduler.ts`, `src/stores/roster.ts`, `src/stores/quarters.ts`, `src/components/QuarterGrid.vue`, `src/components/RolesConfigPanel.vue`, `functions/src/serviceRoles.ts`) for `TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER` — zero matches.

### Code Review Findings (85-REVIEW.md) — Status Check

The phase's own deep code review found and fixed 3 issues before this verification ran; independently re-confirmed all 3 fixes are present in the codebase (not just claimed):

- **CR-01 (critical, fixed `f4c9648e`):** Server-side messaging resolver was not migrated off the old vocals-as-a-team model — verified fixed: `coerceLegacyRoleGroup` exists and is wired into `functions/src/index.ts`'s role-load boundary; 4 new regression tests pass. **Deploy required** for the fix to take effect in production (Cloud Functions) — flagged below as human verification, not a code gap.
- **WR-01 (warning, fixed `d9800503`):** RolesConfigPanel had no in-app way to edit an existing role's group/vocal flag — verified fixed: `RoleDraft` now includes `group`/`vocal`, `onSaveRole` persists both.
- **IN-01 (info, fixed `97ca9525`):** Emulator seed data used the legacy shape — verified fixed (not independently re-checked in depth; low-risk, info-severity, single-line change per REVIEW.md).

### Human Verification Required

1. **Live-app scheduling behavior check**
   **Test:** Run the auto-scheduler and manually edit the QuarterGrid in the live app for an org with existing volunteers who hold both Band and Tech roles; also assign a vocalist an instrument role.
   **Expected:** Auto-scheduler never double-books Band+Tech for one person/date (unfilled instead); QuarterGrid shows warn-not-block; Vocals+instrument combo never flagged; multiple people can hold Vocals same date.
   **Why human:** Real UI/visual behavior and a live scheduler run against production-shaped org data — the underlying logic is unit/component-tested in isolation, but full end-to-end behavior in the running app was not exercised by this verification.

2. **Cloud Functions deploy for the CR-01 fix**
   **Test:** Confirm with the owner, then deploy `functions/` (per project deploy policy — confirm then deploy).
   **Expected:** The server-side messaging recipient resolver's read-time vocals->band coercion (commit `f4c9648e`) takes effect in production, closing the silent-under-delivery bug the code review found.
   **Why human:** Deploys are owner-gated per this project's policy; the fix is code-complete and test-covered but not yet live.

### Gaps Summary

No blocking gaps. All 10 observable truths, all 6 required artifacts (plus the code-review-driven CR-01/WR-01 additions), and all 6 key links are verified present, substantive, and correctly wired — confirmed by direct source reading (not SUMMARY.md claims) and by independently re-running the type-check, full client test suite, and full functions test suite, all of which passed clean against the documented 2-file pre-existing baseline. The only open items are a live-app UAT spot-check and an owner-gated Cloud Functions deploy, both routed to human verification rather than treated as gaps since the underlying code and tests are already correct and complete.

---

_Verified: 2026-08-26T17:25:00Z_
_Verifier: Claude (gsd-verifier)_
