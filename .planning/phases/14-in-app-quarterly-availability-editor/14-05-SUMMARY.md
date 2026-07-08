---
phase: 14-in-app-quarterly-availability-editor
plan: 05
subsystem: ui
tags: [vue3, pinia, teleport, drawer, availability, roster, scheduling]

# Dependency graph
requires:
  - phase: 14-in-app-quarterly-availability-editor (Plan 01)
    provides: FrequencyTier type + PersonQuarterData.frequencyTier/note fields
  - phase: 14-in-app-quarterly-availability-editor (Plan 03)
    provides: quartersStore.setPersonAvailability with bidirectional pairing diff
provides:
  - AvailabilityDrawer.vue — Variant A right-drawer editor with all D-03 controls
    (frequency segmented control + advanced 1-in-N, Sundays-only calendar, Nth-Sunday
    chips, date-range block, must-serve-with typeahead, quarter note)
  - QuarterGrid.vue availableUnassigned 'out'-tier exclusion (closes D-04 gap for
    manual gap-filling, matching the auto-proposal exclusion)
  - quartersStore.getQuarter exposed as public API (was internal-only)
affects: [14-06, future roster/availability UI work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Right-drawer overlay: single <Teleport to=\"body\"> wrapping a backdrop
      Transition + a translate-x slide Transition, gated on a nullable id prop
      (personId) rather than a boolean open prop"
    - "Draft-loading watcher: immediate watch(() => props.personId, loadDraft) reads
      standing fields from rosterStore.people.find(id) and quarter-scoped fields from
      quartersStore.getQuarter(quarterId).personQuarterData[id] with ?? defaults"
    - "Standing vs quarter-scoped save split: quarter-scoped fields always go through
      setPersonAvailability; frequencyTargetN only goes through updatePerson, and only
      when changed from the loaded value"
    - "Sundays-only calendar iterates quarter.serviceDates directly (never a generic
      date input) — data-date attributes added for deterministic test targeting"

key-files:
  created:
    - src/components/AvailabilityDrawer.vue
    - src/components/__tests__/AvailabilityDrawer.test.ts
    - src/components/__tests__/QuarterGrid.test.ts
  modified:
    - src/components/QuarterGrid.vue
    - src/stores/quarters.ts

key-decisions:
  - "Exposed quartersStore.getQuarter on the store's returned object (was previously
    an internal-only helper) — every plan in this phase's interfaces/RESEARCH/PATTERNS
    assumed it was public API, and the drawer genuinely needs it to read a quarter's
    serviceDates + personQuarterData"
  - "Added data-role/data-date/data-preset/data-active attributes to the drawer's
    calendar and frequency buttons purely for stable test targeting — no behavior
    change, keeps the dark-theme utility classes as the only styling mechanism"
  - "Test mounts stub Teleport as an inline <div><slot /></div> since content
    teleported to document.body isn't reachable via wrapper.find/findAll — first
    Teleport-mounting component test in this codebase, no prior convention existed"

patterns-established:
  - "Component tests for Teleport-based overlays must stub Teleport inline
    (global.stubs: { Teleport: { template: '<div><slot /></div>' } }) rather than
    querying document.body"

requirements-completed: [D-01, D-03, D-04, D-06, D-07]

# Metrics
duration: 55min
completed: 2026-07-08
---

# Phase 14 Plan 05: Availability Drawer + QuarterGrid 'out'-tier Fix Summary

**Ported the sketch's Variant A right-drawer control set (frequency/calendar/pairing/note) to a real Vue component wired to the Phase 13/14 stores, and closed the last 'out'-tier leak in QuarterGrid's manual candidate list.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-08T11:35:00Z (approx, per STATE.md session)
- **Completed:** 2026-07-08T12:29:43Z
- **Tasks:** 3 completed
- **Files modified:** 5 (2 created new, 1 new test file per modified component, 1 store fix)

## Accomplishments
- `AvailabilityDrawer.vue` — full D-03 control set (segmented frequency control with
  live readout + advanced 1-in-N override, Sundays-only calendar with Nth-Sunday chips
  and date-range blocking, must-serve-with typeahead with bidirectional chips, quarter
  note textarea) reading/writing one person's quarter data through the correct
  standing/quarter-scoped store split
- `QuarterGrid.vue`'s `availableUnassigned` now excludes 'out'-tier people from the
  manual gap-filling candidate list, matching the scheduler's auto-proposal exclusion
  (D-04 Pitfall 3 fully closed — both auto and manual paths now agree)
- 5 new tests (3 for the drawer, 2 for QuarterGrid) all green; full suite (608 tests)
  and `vue-tsc --build` green throughout

## Task Commits

Each task was committed atomically:

1. **Task 1: AvailabilityDrawer.vue — right-drawer editor with all D-03 controls** - `4e96057` (feat, includes the quarters.ts `getQuarter` exposure fix)
2. **Task 2: AvailabilityDrawer.test.ts — round-trip + Sundays-only calendar** - `fd877b9` (test, includes a real bugfix found while writing the test)
3. **Task 3: QuarterGrid 'out'-tier exclusion in manual candidate list** - `0e89ff2` (test, RED) → `4e4ced6` (feat, GREEN)

_TDD tasks (2 and 3) each have a test-then-fix/feat commit pair as required by the RED/GREEN gate._

## Files Created/Modified
- `src/components/AvailabilityDrawer.vue` - New right-drawer editor (Teleport + slide Transition), all D-03 controls, onSave routes through setPersonAvailability/updatePerson per the standing/quarter split
- `src/components/__tests__/AvailabilityDrawer.test.ts` - Pre-populate, calendar correctness, save-call tests (Teleport stubbed inline)
- `src/components/QuarterGrid.vue` - `frequencyTierOf` helper + `'out'` exclusion added to `availableUnassigned`; `blackedOutToday` left unchanged
- `src/components/__tests__/QuarterGrid.test.ts` - New file; asserts 'out'-tier exclusion and that an absent-frequencyTier person still appears (defaults 'regular')
- `src/stores/quarters.ts` - `getQuarter` added to the store's returned object (was internal-only; required by the drawer and matches the interfaces every other Phase 14 planning doc assumed)

## Decisions Made
- `getQuarter` exposed publicly on `useQuartersStore()` — a pre-existing gap between the store's actual internal API and what every Phase 14 planning document (RESEARCH, PATTERNS, this plan's `<interfaces>` block) assumed was already public
- Test-only `data-*` attributes added to the drawer's calendar/frequency buttons for deterministic targeting, since the dark-theme utility classes alone don't provide a stable test hook
- Teleport stubbed inline for the drawer's component test (no existing convention in this codebase for testing a mounted Teleport component — documented as a new pattern above)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exposed `quartersStore.getQuarter` as public API**
- **Found during:** Task 1 (AvailabilityDrawer.vue), `npm run type-check`
- **Issue:** `getQuarter` existed in `quarters.ts` and was used internally by 10+ store functions (including `setPersonAvailability` from Plan 14-03), but was never added to the store's returned object — so `quartersStore.getQuarter(...)` failed to type-check from any component. Every Phase 14 planning doc (RESEARCH Pattern 1/Code Examples, PATTERNS.md, this plan's `<interfaces>` block) assumed it was already public.
- **Fix:** Added `getQuarter` to the `return { ... }` object in `src/stores/quarters.ts`. No change to the function's implementation or behavior.
- **Files modified:** `src/stores/quarters.ts`
- **Verification:** `npm run type-check` exits 0; `AvailabilityDrawer.test.ts`'s mocked `getQuarter` calls resolve correctly
- **Committed in:** `4e96057` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed temporal-dead-zone ReferenceError in the drawer's immediate watcher**
- **Found during:** Task 2 (AvailabilityDrawer.test.ts), first test run
- **Issue:** `watch(() => props.personId, ..., { immediate: true })` calls `loadDraft()` synchronously during `setup()`. `loadDraft` referenced `rangeStart`/`rangeEnd`/`pairQuery`/`pairMenuOpen` refs that were declared further down the script — by call time those `const` bindings were still in the temporal dead zone, throwing `ReferenceError: Cannot access 'pairQuery' before initialization` on mount.
- **Fix:** Moved the four ref declarations above `loadDraft`/the watcher (removed the now-duplicate declarations at their original locations).
- **Files modified:** `src/components/AvailabilityDrawer.vue`
- **Verification:** All 3 `AvailabilityDrawer.test.ts` tests pass; full suite (608 tests) green
- **Committed in:** `fd877b9` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for the plan's own acceptance criteria to be achievable (type-check green, tests green) — no scope creep beyond what Task 1/Task 2 already required.

## Issues Encountered
- Vue Test Utils does not surface `<Teleport to="body">` content via `wrapper.find`/`findAll` by default (content really moves to `document.body` in jsdom). Resolved by stubbing `Teleport` as an inline pass-through component in the test's `mount(...)` call — no prior convention existed in this codebase since no other Teleport-using component (`RosterImportModal`, `VolunteerCsvImportModal`, `CsvImportModal`, `PcImportModal`, `NewServiceDialog`, `SongSlideOver`, `SongSlotPicker`) had a component-level test before this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `AvailabilityDrawer.vue` is ready to be mounted from `QuarterView.vue` (Plan 14-06), controlled by an `openPersonId` ref per the existing `RESEARCH.md`/`PATTERNS.md` guidance — not yet wired into the view in this plan.
- `QuarterGrid.vue`'s candidate list and the scheduler's auto-proposals now agree on 'out'-tier exclusion; no remaining gaps for D-04 identified in 14-RESEARCH.

---
*Phase: 14-in-app-quarterly-availability-editor*
*Completed: 2026-07-08*

## Self-Check: PASSED

All created files verified present on disk; all 5 commit hashes (0e89ff2, 4e4ced6, 4e96057, fd877b9, 02a8eff) verified present in git log.
