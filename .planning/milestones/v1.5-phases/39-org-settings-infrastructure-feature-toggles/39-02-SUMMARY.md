---
phase: 39-org-settings-infrastructure-feature-toggles
plan: 02
subsystem: auth
tags: [pinia, firestore, typescript, org-settings, feature-flags]

# Dependency graph
requires: []
provides:
  - "src/types/organization.ts — Organization, OrgSettings, DEFAULT_ORG_SETTINGS"
  - "authStore.settings — the one typed org-settings ref every later Phase 39/44/45/46 consumer reads"
  - "authStore.vwModeEnabled dual-read (nested settings -> legacy flat field -> true default)"
affects: [39-03, 39-04, 39-05, 39-06, 44, 45, 46]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single defaults-merge point (auth.ts::loadOrgContext) — every later settings field is added to OrgSettings + DEFAULT_ORG_SETTINGS only, no new load/reset logic"
    - "Dual-read migration with lazy write-triggered backfill (no read-time write, no bulk migration script)"

key-files:
  created:
    - src/types/organization.ts
  modified:
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts

key-decisions:
  - "OrgSettings members are all REQUIRED (not optional) — optionality lives only at the Firestore-read boundary in loadOrgContext, so every consumer reads authStore.settings.<field> as a plain boolean with no ?? default"
  - "settings ref is reset to a fresh spread copy of DEFAULT_ORG_SETTINGS at all three reset branches (no-org, sign-out, logout()), matching every existing vwModeEnabled reset site 1:1"
  - "No read-triggered backfill was added inside loadOrgContext — the member onSnapshot admin->editor migration precedent was deliberately NOT copied; the vwModeEnabled backfill is write-triggered and lands in 39-03 by changing the Settings toggle's write target to the settings.vwModeEnabled dot-path"

patterns-established:
  - "Pattern: nested settings sub-object merged once via { ...DEFAULT_ORG_SETTINGS, ...(orgData.settings ?? {}) }, never a per-field ?? default at the consumption site"

requirements-completed: [R073]

coverage:
  - id: D1
    description: "A pre-v1.5 organization document with no settings key loads through loadOrgContext without error and yields a fully-populated OrgSettings equal to DEFAULT_ORG_SETTINGS"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings (R073) > resolves full OrgSettings from defaults when the org document has no settings key"
        status: pass
    human_judgment: false
  - id: D2
    description: "A settings object carrying only some keys still resolves the absent keys to their DEFAULT_ORG_SETTINGS values"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings (R073) > resolves an absent key to its default when settings is partially populated"
        status: pass
    human_judgment: false
  - id: D3
    description: "A flat vwModeEnabled: false organization with no settings key is NOT silently flipped back on by the dual-read migration"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#vwModeEnabled (D-15/D-16) > keeps a flat vwModeEnabled false when there is no settings key"
        status: pass
    human_judgment: false
  - id: D4
    description: "A nested settings.vwModeEnabled value takes precedence over a conflicting flat legacy field"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings (R073) > prefers a nested settings value over the flat legacy field"
        status: pass
    human_judgment: false
  - id: D5
    description: "settings resets to DEFAULT_ORG_SETTINGS across an org switch (no-org branch) and sign-out/logout, so no stale org's settings leak"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings (R073) > resets settings to defaults when the user belongs to no organization"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings (R073) > resets settings to defaults on logout"
        status: pass
    human_judgment: false
  - id: D6
    description: "loadOrgContext performs no Firestore write while loading an org document that lacks settings (no read-triggered backfill introduced)"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings (R073) > does not write to Firestore while loading an org document that lacks settings"
        status: pass
    human_judgment: false
  - id: D7
    description: "Defaults on a genuinely pre-v1.5 org document render correctly in the deployed app (real Settings screen, real legacy org doc), not just in the fixture-based unit test"
    verification: []
    human_judgment: true
    rationale: "Backstop must_have — a fixture proves the merge function, only a real pre-v1.5 org document proves the deployed read path. Carried forward to PENDING-VERIFICATION.md per the v1.5 standing autonomy grant; the Settings UI itself does not exist until 39-03, so this cannot be checked until that plan ships."

duration: 10min
completed: 2026-08-06
status: complete
---

# Phase 39 Plan 02: Org Settings Infrastructure Summary

**Typed `OrgSettings`/`Organization` shape in `src/types/organization.ts`, a single defaults-merge point in `auth.ts::loadOrgContext`, and a dual-read for `vwModeEnabled` that cannot silently re-enable a deliberately-off church.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-06T15:00:31-04:00
- **Completed:** 2026-08-06T15:10:53-04:00
- **Tasks:** 3
- **Files modified:** 2 (plus 1 created)

## Accomplishments
- `src/types/organization.ts` created — `Organization`, `OrgSettings` (all members required), `DEFAULT_ORG_SETTINGS` (all three ON)
- `authStore.settings` declared, merged once in `loadOrgContext` from a `Partial<OrgSettings>` narrowed off `orgData.settings`, exported from the store
- `vwModeEnabled` dual-read implemented exactly once: `settings.vwModeEnabled ?? orgData.vwModeEnabled ?? true` — all 14 existing non-test read/write sites keep working unchanged, since every one of them already goes through the single `authStore.vwModeEnabled` ref
- `settings` reset to `DEFAULT_ORG_SETTINGS` at all three existing reset branches (no-org, sign-out, `logout()`), matching every `vwModeEnabled.value = true` reset 1:1
- No read-triggered backfill added — the member-doc `onSnapshot` admin→editor precedent was explicitly NOT copied for this migration; the write-triggered backfill is 39-03's job
- R073 regression coverage added to `auth.test.ts`: 6 new tests (5 in a new `OrgSettings (R073)` block, 1 inside the existing `vwModeEnabled (D-15/D-16)` block) proving full-defaults resolution, partial-key fallback, nested-over-flat precedence, the no-silent-flip regression, no-write-on-read, and reset-on-no-org/logout

## Task Commits

1. **Task 1: Create the Organization / OrgSettings type module** - `4b90f14` (feat)
2. **Task 2: Merge settings once in loadOrgContext and dual-read vwModeEnabled** - `79fa67d` (feat)
3. **Task 3: Prove R073 in auth.test.ts** - `fe75d46` (test)

_Note: task 3's commit hash range also spans an unrelated `fa29752` commit (plan 39-01, a different plan running concurrently in the same working tree) — see Deviations for detail; it is not part of this plan's work._

## Files Created/Modified
- `src/types/organization.ts` - New: `Organization`, `OrgSettings`, `DEFAULT_ORG_SETTINGS`
- `src/stores/auth.ts` - `settings` ref declared/merged/reset/exported; `vwModeEnabled` dual-read
- `src/stores/__tests__/auth.test.ts` - R073 test coverage (6 new tests)

## Decisions Made
- Followed the plan's exact dual-read shape verbatim (`orgSettings.vwModeEnabled ?? orgData.vwModeEnabled as boolean|undefined ?? true`) rather than hand-retyping it, per 39-RESEARCH.md Pitfall 2's warning about dropping the optional chain.
- Combined `import type { OrgSettings }` and `import { DEFAULT_ORG_SETTINGS }` as two separate import statements (matching this codebase's existing convention of always splitting type-only imports from value imports — verified against every other `src/stores/*.ts` file).
- The reset-path regression tests (`resets settings to defaults ...`) were written as two independent test cases (no-org branch, logout) rather than one combined test, for clearer failure isolation.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written for all three tasks. No Rule 1/2/3 auto-fixes were needed.

### Documented (not auto-fixed) discrepancies

**1. `DEFAULT_ORG_SETTINGS` occurrence count is 6, not the plan's stated 5**
- **Found during:** Task 2 acceptance-criteria check
- **Detail:** `grep -v '^\s*[*/]' src/stores/auth.ts | grep -c "DEFAULT_ORG_SETTINGS"` returns 6. Enumerated: (1) the `import { DEFAULT_ORG_SETTINGS } from '@/types/organization'` line, (2) the `settings` ref's declaration initializer `ref<OrgSettings>({ ...DEFAULT_ORG_SETTINGS })`, (3) the merge in `loadOrgContext`'s `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings }`, and (4)-(6) the three reset-site spreads (`{ ...DEFAULT_ORG_SETTINGS }`) in the no-org branch, the sign-out branch, and `logout()`. The plan's own acceptance-criteria text pre-authorized this exact outcome: "if the count differs, enumerate and justify every occurrence in the SUMMARY rather than adjusting the gate." Every occurrence is required — none is redundant — and all three reset sites are exercised by Task 3's `OrgSettings (R073)` reset tests.
- **Impact:** None — behavior matches every `<behavior>`/`<done>` clause in the plan exactly; only the plan's own count estimate was off by one.

**2. Pre-existing, out-of-scope type-check error observed transiently, then resolved by a concurrent plan**
- **Found during:** Task 2's `npm run type-check` gate run
- **Detail:** `src/views/__tests__/SongsView.test.ts` (created in plan 39-01's `2ecef29` commit, before this plan started) failed `vue-tsc --build` with a `VueWrapper<never>` generic mismatch (`TS2345`) unrelated to `organization.ts`/`auth.ts` — the failing line never references `OrgSettings` or `authStore.settings`. Per the deviation rules' scope boundary, this file is out of scope for 39-02 (it belongs to plan 39-01) and was not touched. By the time Task 3's gate ran, the error had disappeared: commit `fa29752` ("fix(39-01): satisfy no-explicit-any lint rule in SongsView harness"), authored by a concurrent process working on plan 39-01 in the same working tree, incidentally fixed the same `VueWrapper` typing issue while addressing an unrelated ESLint finding. This plan performed no fix and made no change to that file.
- **Impact:** None on this plan's files. Documented for traceability since the phase-gate `npm run type-check` output differed between two consecutive runs within this plan's execution window for a reason external to this plan.

---

**Total deviations:** 0 auto-fixed; 2 documented-only discrepancies (both benign, both explained above)
**Impact on plan:** None on scope or correctness. `npm run type-check` is clean as of the final Task 3 run.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

`authStore.settings` is exported and typed, ready for 39-03 (Settings UI — AI/PC toggles, and the `onToggleVwMode` write-target change that completes the lazy backfill), 39-04 (`claudeApi.ts` AI guard), and 39-05 (Planning Center hide points). Phases 44, 45, and 46 can extend `OrgSettings`/`DEFAULT_ORG_SETTINGS` with one field each with no further load/reset/defaulting work required.

**Not yet verified:** the backstop must_have requiring a real pre-v1.5 organization document to render correct defaults on the actual Settings screen — the Settings screen does not exist until 39-03 ships. This is a deferred human-verify item (D7 above), consistent with the phase's `must_haves` marking it `verification: backstop`.

---
*Phase: 39-org-settings-infrastructure-feature-toggles*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: src/types/organization.ts
- FOUND: 4b90f14 (Task 1 commit)
- FOUND: 79fa67d (Task 2 commit)
- FOUND: fe75d46 (Task 3 commit)
