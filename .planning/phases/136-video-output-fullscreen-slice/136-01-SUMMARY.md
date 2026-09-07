---
phase: 136-video-output-fullscreen-slice
plan: 01
subsystem: ui
tags: [vue, typescript, vitest, monitor-config, run-control]

# Dependency graph
requires:
  - phase: 114-monitor-setup-n-assignment
    provides: "The per-fingerprint MonitorRole/MonitorAssignment model, isValidMapping's untrusted-localStorage guard, and the >=1-Audience canSave gate this plan widens additively."
provides:
  - "MonitorRole widened to the 3-member union 'audience' | 'confidence' | 'video'"
  - "isValidMapping's role check widened to a strict 3-value allowlist (video accepted, any other role string still rejected)"
  - "MonitorCard's role radiogroup offers Video as a fourth (None/Audience/Confidence/Video) opt-in button"
  - "MonitorSetupView.roleLabel() resolves 'Video'; the >=1-Audience canSave gate is verified UNCHANGED"
  - "RunDisplaysPanel/RunPreflightPanel DisplayItem.role + roleTitle() widened so a saved Video assignment renders a correct 'Video' label in Run Control instead of a type error or a mislabeled 'Confidence' row"
affects: [136-02-video-output-view-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-way role label mapping (if/if/return) replacing 2-way ternaries wherever MonitorRole is switched over"

key-files:
  created: []
  modified:
    - src/utils/monitorConfig.ts
    - src/utils/__tests__/monitorConfig.test.ts
    - src/components/MonitorCard.vue
    - src/components/__tests__/MonitorCard.test.ts
    - src/views/MonitorSetupView.vue
    - src/views/__tests__/MonitorSetupView.test.ts
    - src/components/run/RunDisplaysPanel.vue
    - src/components/run/RunPreflightPanel.vue

key-decisions:
  - "Widened MonitorRole to a strict 3-member allowlist in isValidMapping (never typeof === 'string') so a forged/unknown role is still rejected — T-136-02."
  - "canSave (>=1 Audience gate) left byte-for-byte unchanged; Video is optional exactly like Confidence — verified by a dedicated persisted-round-trip test."
  - "Auto-fixed (Rule 1/3, in-scope): RunDisplaysPanel.vue and RunPreflightPanel.vue's DisplayItem.role/roleTitle() were still the old 2-member union. useRunControl's `displays` computed passes savedAssignments through verbatim (untouched), so a Video assignment saved via this plan's own MonitorSetupView change already flows into Run Control today — leaving the old union would have been both a vue-tsc build break (TS2322) and a live mislabeling bug (a Video row falling through to 'Confidence'). Widened both files' role typing/labels only; the actual video-output window launch is Plan 02's job."

requirements-completed: []  # R424 is only HALF-complete: this plan does the role/setup half (MonitorRole widen, validator, Monitor Setup UI). The VideoOutputView + route half is 136-02's job — do not mark R424 complete until that plan lands.

coverage:
  - id: D1
    description: "MonitorRole is the 3-member union 'audience' | 'confidence' | 'video'; a persisted video assignment round-trips through loadMapping while an unknown role string is still rejected"
    requirement: R424
    verification:
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts#round-trips a mapping with a single video-role assignment (R424 — the third role)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts#returns null when an assignment carries an unknown role string outside the 3-member union"
        status: pass
    human_judgment: false
  - id: D2
    description: "Monitor Setup offers Video as a fourth (None/Audience/Confidence/Video) role button on every monitor card; selecting it is mutually exclusive within that card's radiogroup"
    requirement: R424
    verification:
      - kind: unit
        ref: "src/components/__tests__/MonitorCard.test.ts#marks Video checked and None unchecked when selectedRole is video (R424)"
        status: pass
      - kind: integration
        ref: "src/views/__tests__/MonitorSetupView.test.ts#selects role video on a card and flips aria-checked mutually exclusively within that card"
        status: pass
    human_judgment: false
  - id: D3
    description: "The >=1-Audience Save/go-live gate is unchanged: a Video-only mapping cannot Save; adding an Audience assignment elsewhere enables Save and persists both assignments together"
    requirement: R424
    verification:
      - kind: integration
        ref: "src/views/__tests__/MonitorSetupView.test.ts#keeps the Save gate unchanged: a Video-only assignment cannot Save; adding Audience elsewhere enables it, and both persist"
        status: pass
    human_judgment: false
  - id: D4
    description: "A saved Video assignment renders a correct 'Video' label (not a type error, not a mislabeled 'Confidence' row) wherever Run Control's display list is rendered"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build, clean)"
        status: pass
      - kind: integration
        ref: "src/views/__tests__/RunControlView.test.ts (27 tests, all passing — no regression)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-09-07
status: complete
---

# Phase 136 Plan 01: MonitorRole widened to include 'video' — Monitor Setup offers it as a third assignable role Summary

**MonitorRole grows a third member ('video') with a strict-allowlist validator and a fourth opt-in role button in Monitor Setup — additive to the existing N-assignment model, the >=1-Audience Save gate verified unchanged by a dedicated test.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-07T19:07:01-04:00
- **Completed:** 2026-09-07T19:16:55-04:00
- **Tasks:** 2 completed
- **Files modified:** 8

## Accomplishments
- `MonitorRole` is now `'audience' | 'confidence' | 'video'`; `isValidMapping`'s role check is a strict 3-value allowlist (never `typeof === 'string'`) — a saved `video` assignment round-trips through `loadMapping`, an unknown role string (e.g. `'projector'`) is still rejected.
- `MonitorCard.vue`'s role radiogroup offers None / Audience / Confidence / Video; clicking Video is mutually exclusive within that card, exactly like the existing three options.
- `MonitorSetupView.vue`'s `roleLabel()` resolves 'Video'; the `>=1`-Audience `canSave` gate is byte-for-byte unchanged and covered by a new test proving a Video-only mapping cannot Save while an Audience assignment elsewhere enables it (and both persist together on Save).
- Downstream Run Control display rendering (`RunDisplaysPanel.vue`, `RunPreflightPanel.vue`) widened to the same 3-member role typing with a real "Video" label, since `useRunControl`'s `displays` computed already passes any saved assignment (including a fresh Video one) straight through today.

## Task Commits

Each task was committed atomically (TDD: test -> feat):

1. **Task 1: Widen MonitorRole + validator to include 'video'**
   - `1b6416f4` (test) — failing video-role validity + unknown-role-rejection cases
   - `bd7f915e` (feat) — `MonitorRole` widened; `isValidMapping` allowlist widened
2. **Task 2: Offer Video as a third assignable role in Monitor Setup**
   - `f9109d3c` (test) — failing Video-button-select + Save-gate-unchanged cases
   - `94f65be7` (feat) — `MonitorCard.vue` role array + caption; `MonitorSetupView.vue` `roleLabel()`
3. **Deviation fix (Rule 1/3, in-scope):**
   - `08ad2d30` (fix) — widened `RunDisplaysPanel.vue`/`RunPreflightPanel.vue`'s `DisplayItem.role`/`roleTitle()`; updated `MonitorCard.test.ts`'s stale "exactly three radios" assertion to four + added a Video-selected case

**Plan metadata:** (this commit, docs: complete plan — see final commit below)

## Files Created/Modified
- `src/utils/monitorConfig.ts` - `MonitorRole` widened to 3 members; `isValidMapping` role check widened to a strict allowlist
- `src/utils/__tests__/monitorConfig.test.ts` - video round-trip + unknown-role-rejection cases
- `src/components/MonitorCard.vue` - fourth Video role button; caption updated
- `src/components/__tests__/MonitorCard.test.ts` - radio-count assertion updated 3->4; Video-selected case added
- `src/views/MonitorSetupView.vue` - `roleLabel()` is now a 3-way mapping; `canSave` untouched
- `src/views/__tests__/MonitorSetupView.test.ts` - Video-select + Save-gate-unchanged cases
- `src/components/run/RunDisplaysPanel.vue` - `DisplayItem.role`/`roleTitle()` widened to include 'video' -> 'Video'
- `src/components/run/RunPreflightPanel.vue` - same widening, same reason

## Decisions Made
- Strict 3-value allowlist in `isValidMapping` (never relaxed to `typeof === 'string'`) — T-136-02 mitigation, covered by a negative unit test.
- `canSave` left exactly as-is; Video is optional additional output, never required to go live (per CONTEXT.md D-R424).
- Widened `RunDisplaysPanel.vue`/`RunPreflightPanel.vue`'s role typing/labels now (not deferred to Plan 02) because `useRunControl`'s `displays` computed already forwards any saved assignment verbatim — a Video assignment saved via this plan's own MonitorSetupView change would otherwise either fail `vue-tsc --build` or silently mislabel as "Confidence" in Run Control today, before Plan 02 lands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm run type-check` broke via `RunControlView.vue`'s `displays` prop passthrough**
- **Found during:** Verification (after Task 2, running the plan's required `npm run type-check` gate)
- **Issue:** `RunDisplaysPanel.vue` and `RunPreflightPanel.vue` each declared a local `DisplayItem { role: 'audience' | 'confidence' }` interface. `useRunControl.ts`'s `displays` computed infers its `role` field from `MonitorAssignment.role` (now the widened `MonitorRole`), so passing it into either panel's `:displays` prop became a `TS2322` type error the moment `MonitorRole` grew a third member — `vue-tsc --build` (the mandated gate) failed with two TS2322 errors in `RunControlView.vue`.
- **Fix:** Widened both panels' `DisplayItem.role` to `'audience' | 'confidence' | 'video'` and their `roleTitle()` to a 3-way mapping returning 'Video' for the new case. No other panel behavior changed.
- **Files modified:** `src/components/run/RunDisplaysPanel.vue`, `src/components/run/RunPreflightPanel.vue`
- **Verification:** `npm run type-check` clean; `src/views/__tests__/RunControlView.test.ts` (27 tests) unchanged and passing.
- **Committed in:** `08ad2d30`

**2. [Rule 1 - Bug] `MonitorCard.test.ts`'s "exactly three radios" assertion broke**
- **Found during:** Task 2 verification pass (running the full targeted test set, not just the plan's named test files)
- **Issue:** `MonitorCard.test.ts` had a pre-existing assertion `expect(radios).toHaveLength(3)`, which fails once the fourth (Video) role button is added by this same task.
- **Fix:** Updated the assertion to 4 and added an explicit `aria-checked` assertion for the new video test-id; added a companion case asserting Video-selected state renders correctly.
- **Files modified:** `src/components/__tests__/MonitorCard.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/MonitorCard.test.ts` — 10/10 passing.
- **Committed in:** `08ad2d30`

---

**Total deviations:** 2 auto-fixed (1 blocking type-check break, 1 bug — stale test assertion), both directly caused by this plan's own `MonitorRole`/`MonitorCard` widening and within the same files' blast radius.
**Impact on plan:** Both fixes were necessary for the plan's own mandated `npm run type-check` gate and for correctness of the existing test suite. No scope creep — no new features, no touching of `useRunControl.ts`'s launch logic (explicitly Plan 02's job).

## Issues Encountered
None beyond the two auto-fixed deviations above.

## Deferred UAT

This plan is code-only (widened type + validator + a new button in an existing settings screen) — no new visually-distinct screen was built. Per the autonomous-deferred-UAT mode for this execution, the human-visual checkpoint that would normally confirm "Video button renders correctly in Monitor Setup" is DEFERRED rather than blocking. Automated coverage (component + integration tests above) fully proves the described behavior; a human can visually confirm the Video button's appearance the next time Monitor Setup is opened, but this is not required to mark the plan complete.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `MonitorRole` now includes `'video'` and survives the untrusted-localStorage validator — Plan 02 (`VideoOutputView.vue`, the `/present/video/:serviceId` route, and `useRunControl.ts`'s launch-by-role wiring) can now safely persist and read a `'video'` assignment.
- No blockers. `useRunControl.ts`'s actual video-output window launch (`DEFAULT_VIDEO_ASSIGNMENT` if needed, openPlaced/openUnplaced wiring) remains entirely Plan 02's scope — untouched here except for the type-safety fix above.

---
*Phase: 136-video-output-fullscreen-slice*
*Completed: 2026-09-07*

## Self-Check: PASSED

All 8 modified source/test files confirmed present on disk; all 5 task commits (1b6416f4, bd7f915e, f9109d3c, 94f65be7, 08ad2d30) confirmed in git log.
