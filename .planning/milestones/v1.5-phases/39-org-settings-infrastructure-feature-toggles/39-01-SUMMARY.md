---
phase: 39-org-settings-infrastructure-feature-toggles
plan: 01
subsystem: testing
tags: [vitest, vue-test-utils, pinia-mock, harness]

requires: []
provides:
  - "src/views/__tests__/SettingsView.test.ts — runnable mount harness for SettingsView.vue, asserting today's Planning Center Integration and Vertical Worship headings"
  - "src/views/__tests__/SongsView.test.ts — runnable mount harness for SongsView.vue, asserting today's Import Songs trigger, plus the exported findImportSongsButton(wrapper) selector helper"
  - "A settings-shaped auth-store mock convention (aiEnabled/pcEnabled/vwModeEnabled via module-scope getters) shared identically across both new files"
affects: [39-02, 39-03, 39-05]

tech-stack:
  added: []
  patterns:
    - "Getter-mock module-scope state (SongTable.test.ts:39 precedent) for auth-store fields so later waves flip a toggle between assertions without rebuilding the mock factory"
    - "vi.hoisted() for firebase/firestore's updateDoc/getDoc mocks so they're reachable-and-assertable from test bodies (claudeApi.test.ts precedent)"

key-files:
  created:
    - src/views/__tests__/SettingsView.test.ts
    - src/views/__tests__/SongsView.test.ts
  modified: []

key-decisions:
  - "settings mock shape: a nested object with per-key getters (aiEnabled/pcEnabled/vwModeEnabled), each backed by an independent module-scope let, matching the exact getter-mock precedent 39-PATTERNS.md cites"
  - "findImportSongsButton(wrapper) typed as ReturnType<typeof mountSongsView> instead of VueWrapper<any> — repo's eslint config forbids @typescript-eslint/no-explicit-any, so the plan's literal type suggestion needed adjustment to pass the CLAUDE.md-mandated gates"

patterns-established:
  - "Wave 0 test-harness head comment convention: state the file was created as a forward-compatible harness, name what mock shape doesn't exist on the real store yet, and name which later plan extends it"

requirements-completed: [R073, R089]

coverage:
  - id: D1
    description: "src/views/__tests__/SettingsView.test.ts exists, mounts SettingsView.vue against unmodified source, and passes"
    requirement: "R073"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts#SettingsView (Wave 0 harness — Phase 39)"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/views/__tests__/SongsView.test.ts exists, mounts SongsView.vue against unmodified source, passes, and exports findImportSongsButton(wrapper) for Wave 2 reuse"
    requirement: "R089"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SongsView.test.ts#SongsView (Wave 0 harness — Phase 39)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both harnesses' auth-store mock carries a settings object with aiEnabled/pcEnabled/vwModeEnabled, and neither file references any not-yet-built symbol (aiEnabledInput/pcEnabledInput/onToggleAiEnabled/onTogglePcEnabled)"
    verification:
      - kind: other
        ref: "grep -c \"aiEnabled\"/\"pcEnabled\" on both files (>=1 each) and grep -cE for the four forbidden symbols (0) — see Task Commits section for exact counts"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-06
status: complete
---

# Phase 39 Plan 01: Wave 0 Test Harnesses Summary

**Two new mount-based Vitest harnesses (SettingsView.test.ts, SongsView.test.ts) against unmodified source, both carrying a forward-compatible settings-shaped auth-store mock and a shared findImportSongsButton selector for Wave 2 to reuse.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-06T~14:58Z
- **Completed:** 2026-08-06T19:10Z
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments
- `src/views/__tests__/SettingsView.test.ts` mounts `SettingsView.vue` with mocks for `@/stores/auth`, `firebase/firestore`, `@/firebase`, `@/utils/planningCenterApi`, `@/utils/slug`, and an `AppShell` stub; asserts the two headings that exist today (`Planning Center Integration`, `Vertical Worship`).
- `src/views/__tests__/SongsView.test.ts` mounts `SongsView.vue` with mocks for `@/stores/auth`, `@/stores/songs`, `vue-router`, and stubs for its six heavy children; asserts the `Import Songs` trigger is found via the exported `findImportSongsButton(wrapper)` helper.
- Both auth-store mocks expose the identical forward-compatible `settings` object (`aiEnabled` / `pcEnabled` / `vwModeEnabled`), each key backed by its own module-scope `let` behind a getter — the exact precedent 39-PATTERNS.md cites from `SongTable.test.ts:39` — so Waves 2/3 can flip a toggle mid-test without rebuilding the mock.
- Both files run together clean (`npx vitest run` on the pair: 3 tests pass), and the full suite matches its documented baseline exactly (2 known-failing files: `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts` — no new regressions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the SettingsView test harness** - `4a0b70c` (test)
2. **Task 2: Create the SongsView test harness** - `2ecef29` (test)
3. **Fix: satisfy no-explicit-any lint rule in the Task 2 harness** - `fa29752` (fix — see Deviations)

Acceptance-criteria grep checks (post-fix, both files):
- `grep -c "aiEnabled" SettingsView.test.ts` → 2
- `grep -c "pcEnabled" SettingsView.test.ts` → 2
- `grep -cE "aiEnabledInput|pcEnabledInput|onToggleAiEnabled|onTogglePcEnabled" SettingsView.test.ts` → 0
- `grep -c "findImportSongsButton" SongsView.test.ts` → 3
- `grep -c "pcEnabled" SongsView.test.ts` → 5

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `src/views/__tests__/SettingsView.test.ts` - Mount harness for SettingsView.vue; asserts today's two section headings only
- `src/views/__tests__/SongsView.test.ts` - Mount harness for SongsView.vue; asserts today's Import Songs trigger; exports `findImportSongsButton`

## Decisions Made
- **Getter-per-key `settings` object**, not a single object-with-a-getter and not a plain object — matches the plan's explicit instruction to back each of `aiEnabled`/`pcEnabled`/`vwModeEnabled` with its own module-scope mutable variable via a getter, so a later wave can flip exactly one toggle without touching the others.
- **`vi.hoisted()` for `firebase/firestore`'s `updateDoc`/`getDoc`** in `SettingsView.test.ts` rather than inline `vi.fn()` literals in the mock factory — required because the factory assigns the mock functions directly (not wrapped in a deferred call), so referencing module-scope `const`s declared later in the file would hit the temporal-dead-zone hoisting problem `vi.mock` calls are subject to. This is the exact precedent 39-PATTERNS.md cites from `claudeApi.test.ts`.
- **`findImportSongsButton`'s parameter type is `ReturnType<typeof mountSongsView>`**, not the plan's literal `VueWrapper<...>` suggestion — see Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `VueWrapper<never>` / `VueWrapper<any>` both fail this repo's gates**
- **Found during:** Task 2, during the plan's own post-task verification step (`npm run type-check`, run per CLAUDE.md's hard-constraint gate)
- **Issue:** The first working version of `findImportSongsButton(wrapper: VueWrapper<never>)` compiled against nothing (TS2345 — the real mounted wrapper's type isn't assignable to `VueWrapper<never>`). Switching to `VueWrapper<any>` fixed the type error but then failed `npx eslint` (`@typescript-eslint/no-explicit-any`) when I additionally ran ESLint as a further correctness check beyond the plan's stated gates.
- **Fix:** Moved `mountSongsView()`'s declaration above `findImportSongsButton` and typed the parameter as `ReturnType<typeof mountSongsView>` — precise, no `any`, no behavior change.
- **Files modified:** `src/views/__tests__/SongsView.test.ts`
- **Verification:** `npm run type-check` clean; `npx eslint` on both new files clean; both Wave 0 files still pass (3/3 tests) after the fix.
- **Committed in:** `fa29752` (follow-up fix commit, not amended into Task 2's commit per the "always create a new commit" rule)

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1)
**Impact on plan:** Pure type-safety/lint cleanup inside the one file the plan already scoped for creation. No scope creep, no application code touched, no change to which behavior is asserted.

## Issues Encountered
- **Concurrent execution in the same working directory (not a worktree):** while committing this plan's tasks, `git log` and `git status` showed plan 39-02's tasks (`4b90f14`, `79fa67d`) being committed interleaved with mine on the same branch, and at one point `git add <my-file>` left an unrelated in-progress file from 39-02 (`src/stores/__tests__/auth.test.ts`) sitting in the shared index as staged. I ran `git restore --staged` on that file before every commit and verified `git diff --cached --name-only` showed only my own file each time. No 39-02 file was ever committed by this plan's execution. Flagging this because it's a repo-level hazard (shared working tree + shared git index across concurrent wave executors) rather than anything specific to this plan's content — future concurrent executions in the same working directory should double-check `git diff --cached --name-only` before every commit, not just before the first one.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both files listed as MISSING in `39-VALIDATION.md` § Wave 0 Requirements now exist, pass, and are committed.
- Wave 2 (39-05, serviceEditorActionBar.test.ts extension and the RosterView/SongsView hide-PC-import work) can import `findImportSongsButton` from `src/views/__tests__/SongsView.test.ts` verbatim rather than inventing its own selector.
- Waves 2/3 extend both files' `settings`-shaped auth-store mock with real assertions once 39-02 (already landing concurrently — see Issues Encountered) and 39-03 build the real `settings` ref and the AI/PC toggle UI.
- No blockers for downstream plans.

---
*Phase: 39-org-settings-infrastructure-feature-toggles*
*Completed: 2026-08-06*

## Self-Check: PASSED
- FOUND: src/views/__tests__/SettingsView.test.ts
- FOUND: src/views/__tests__/SongsView.test.ts
- FOUND: .planning/phases/39-org-settings-infrastructure-feature-toggles/39-01-SUMMARY.md
- FOUND commit: 4a0b70c
- FOUND commit: 2ecef29
- FOUND commit: fa29752
