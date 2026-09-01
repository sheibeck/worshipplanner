---
phase: 104-notification-multi-church-foundations
plan: 01
subsystem: ui
tags: [pinia, vue3, notifications, toast, accessibility]

# Dependency graph
requires: []
provides:
  - "Generalized src/stores/toasts.ts — the one app-wide dismissible-message store (four severities, transient + keyed-sticky lifetimes, back-compat push())"
  - "Generalized ToastHost.vue — severity color ramp, compact/rich card shapes, mandatory dismiss on every card, mounted at App.vue root"
  - "Two migrated proof cases: RunControlView.vue's monitor-reassign sticky and MonitorSetupView.vue's save-outcome sticky, both keyed and auto-clearing"
affects: [104-02 church switcher (Task 2's setSticky/push contract is the notification primitive it will reuse for its own error state)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keyed sticky notifications (setSticky/clearSticky) — a view/composable owns a stable key, sets it when a condition is true, clears it (idempotently) the moment the condition resolves; setSticky de-dupes in place so re-raising the same key never stacks."
    - "Notification host relocated to App.vue root (not AppShell.vue) — the correct mount point for any future full-viewport view (like RunControlView.vue) that intentionally bypasses AppShell."

key-files:
  created: []
  modified:
    - src/stores/toasts.ts
    - src/stores/__tests__/toasts.test.ts
    - src/components/ToastHost.vue
    - src/App.vue
    - src/components/AppShell.vue
    - src/composables/useRunControl.ts
    - src/views/RunControlView.vue
    - src/views/__tests__/RunControlView.output.test.ts
    - src/views/__tests__/RunControlView.test.ts
    - src/views/MonitorSetupView.vue
    - src/views/__tests__/MonitorSetupView.test.ts

key-decisions:
  - "Kept the store id 'toasts' and useToasts export name unchanged (back-compat for 3 existing call sites) despite the store now covering all four severities and both lifetimes."
  - "The literal 'Save failed.' lead text (pre-existing, hardcoded in ToastHost.vue) is preserved ONLY for the compact (no-heading) error-variant card — the exact back-compat shape every pre-Phase-104 push(message) call site renders — and is not applied to other variants or to the rich sticky shape."
  - "MonitorSetupView's save-outcome sticky clear is driven by a single watch(saveOutcome) rather than scattering clearSticky calls at each of the 3 places saveOutcome can leave 'not-persisted-warning' — simpler and provably exhaustive."
  - "Added defensive clearSticky('monitor-reassign') on RunControlView's exit/unmount paths beyond what the plan's action text specified (Rule 2 — R309's 'no message stuck' requirement, since the host is now app-global and a sticky raised mid-session must not survive into whatever screen the operator navigates to next)."

patterns-established:
  - "Sticky-first ordering in the host stack (App-global): computed splits toasts.value into stickies (key !== undefined) and transient (key === undefined), concatenating stickies first, preserving push order within each group."

requirements-completed: [R309, R310]

coverage:
  - id: D1
    description: "Every notification (info/success/warning/error) renders a working manual-dismiss button that removes it immediately regardless of condition state"
    requirement: "R309"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ToastHost.test.ts#clicking the dismiss button removes that card and leaves any other card present"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/toasts.test.ts#dismissing a keyed sticky by its id also clears it, and a later clearSticky for the same key is a harmless no-op"
        status: pass
    human_judgment: false
  - id: D2
    description: "RunControlView's monitor-reassign warning renders through the shared host, auto-clears the moment monitors are reconfigured, and is manually dismissible in the meantime"
    requirement: "R310"
    verification:
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#a screenschange that drops an assigned monitor (needs-reprompt) sets the monitor-reassign sticky with a working reopen action + monitor-setup link"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/RunControlView.output.test.ts#the IN-PLACE reassign reopen (the sticky action) re-opens the affected role WITHOUT unmounting the control and WITHOUT losing index (WR-01; R274)"
        status: pass
    human_judgment: true
    rationale: "Automated coverage proves the store contract end-to-end (set/clear/action), but the plan's own <verification> section defers the visual collision check (sticky card vs. Run screen's bottom transport chrome at real viewport sizes) to owner UAT — that is a rendering/visual judgment, not something the unit suite can assert."
  - id: D3
    description: "The notification host is mounted at App.vue root so it renders on every route, including RunControlView.vue which does not use AppShell"
    requirement: "R310"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AppShell.test.ts (ToastHost removed, all 5 tests still pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every existing toasts.push(message) call site keeps rendering its red 'Save failed.' alert unchanged"
    requirement: "R309"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ToastHost.test.ts#one toast: renders a role=\"alert\" card with the bold lead, the mirrored body, an aria-hidden icon and a labelled dismiss button"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-01
status: complete
---

# Phase 104 Plan 01: Notification System Foundation Summary

**Generalized the failure-only toasts.ts/ToastHost.vue pair into the app's one dismissible-message system (4 severities, keyed sticky lifetime), relocated the host to App.vue so it reaches RunControlView.vue, and migrated the two known stuck warnings onto it.**

## Performance

- **Duration:** ~12 min (first commit 00:52:22 → last commit 01:04:47, 2026-09-01)
- **Tasks:** 3 completed
- **Files modified:** 11

## Accomplishments
- `src/stores/toasts.ts` widened in place: `variant` (info/success/warning/error, default 'error'), `setSticky(key, opts)`/`clearSticky(key)` for keyed, auto-clearing persistent messages, exact back-compat default path for `push(message)` (variant 'error', 6000ms timer).
- `ToastHost.vue` renders the four-severity Heroicons-solid color ramp, sticky-first ordering, two card shapes (compact transient / rich sticky with heading+body+action+link), and a mandatory `<button>` dismiss on every card — mounted once at `App.vue` root (moved off `AppShell.vue`) so it renders on every route.
- `RunControlView.vue`'s ad-hoc "Your monitor setup changed" `v-if` banner (no dismiss path — the actual R309/R310 stuck bug) is removed; `useRunControl.ts` now drives it as a `setSticky('monitor-reassign', …)` from `onScreensChange`, cleared from the benign-refresh branch, the in-place reopen action, and (Rule 2, defense-in-depth) run exit/unmount.
- `MonitorSetupView.vue`'s inline "couldn't save this on your browser" warning is removed; it is now `setSticky('monitor-save-not-persisted', …)`, cleared via a single `watch(saveOutcome)` covering every path away from that state, plus on unmount.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generalize the toasts store into the system-wide notification store** - `ed4c257f` (feat)
2. **Task 2: Generalize ToastHost (severities + dismiss contract + two card shapes) and relocate its mount to App.vue** - `d8f9d983` (feat)
3. **Task 3: Migrate the two stuck warnings onto the sticky notification store (R310 proof cases)** - `9fcaa76f` (feat)

_No TDD RED/GREEN split was used — Task 1 was written test-first internally but committed as a single `feat` per the plan's `tdd="true"` behavior/action structure being a single cohesive store change._

## Files Created/Modified
- `src/stores/toasts.ts` - Widened `Toast` with variant/key/heading/body/action/link; added `setSticky`/`clearSticky`; preserved `push`/`dismiss` back-compat exactly
- `src/stores/__tests__/toasts.test.ts` - 8 original tests kept (3 minimally updated to include the new `variant: 'error'` field in `toEqual` assertions, an unavoidable consequence of the mandated Toast widening) + 8 new tests for variant defaulting, sticky lifetime, de-dupe, clearSticky idempotence, and dismiss/clearSticky race safety
- `src/components/ToastHost.vue` - Four-severity color ramp, sticky-first ordering, compact/rich card shapes, per-severity dismiss button, Heroicons-solid icon set
- `src/App.vue` - Added `<ToastHost />` as a sibling of `<RouterView>`
- `src/components/AppShell.vue` - Removed `<ToastHost />` mount + import (now redundant)
- `src/composables/useRunControl.ts` - `useToasts()` wired in; `onScreensChange`/`reopenReassignedOutputs` set/clear the `'monitor-reassign'` sticky; cleared defensively on `endServiceTeardown`/`onUnmounted`
- `src/views/RunControlView.vue` - Removed the inline reassign banner markup; dropped now-unused `reassignRole`/`reopenReassignedOutputs` destructures (both moved fully into the composable)
- `src/views/__tests__/RunControlView.output.test.ts` - Added `setActivePinia`; rewrote the reassign-banner testid assertions (8 across 4 tests, plus 1 new exit-clears-sticky test) to assert against the `notifications` store directly, since the host is not mounted in this view-only test tree
- `src/views/__tests__/RunControlView.test.ts` - Added `setActivePinia` (now required — `useRunControl` reads the notifications store on every mount)
- `src/views/MonitorSetupView.vue` - Removed the inline not-persisted warning `<p>`; added `useToasts()` + a `watch(saveOutcome)` driving `setSticky`/`clearSticky('monitor-save-not-persisted')`; cleared on unmount
- `src/views/__tests__/MonitorSetupView.test.ts` - Added `setActivePinia`; rewrote the not-persisted-warning test to assert store state instead of DOM text; added a new test proving the sticky clears on a successful retry

## Decisions Made
- Preserved the store id `'toasts'` / `useToasts` export (3 existing call sites in `CongregationalEditor.vue`, `TeamSlideOver.vue`, `saveStatus.ts` import it unchanged).
- The hardcoded "Save failed." lead text stays, but now conditioned on `variant === 'error' && !heading` — the exact shape every pre-existing `push(message)` call renders, without leaking onto new severities or the rich sticky shape.
- `MonitorSetupView`'s sticky clear uses one `watch(saveOutcome, …)` rather than 3 scattered `clearSticky` calls at each place `saveOutcome` can leave `'not-persisted-warning'` (onSave success, onSelectRole, resolveGrantedBranch) — simpler, provably exhaustive, and `clearSticky` is idempotent so it's harmless when nothing is set.
- Removed `reassignRole`/`reopenReassignedOutputs` from `RunControlView.vue`'s destructure since the banner (their only consumer in the view) moved fully into the composable — they remain in `useRunControl`'s public return for the store-driven `action.onClick`/interpolation use.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Cleared the monitor-reassign sticky on RunControlView exit/unmount, beyond the plan's two specified clear points**
- **Found during:** Task 3
- **Issue:** The plan specified clearing `'monitor-reassign'` only from the benign-refresh branch and after the in-place reopen. Because the host is now app-global (Task 2's relocation to `App.vue`), a sticky raised during a live session and never resolved before the operator exits/navigates away would otherwise persist and render on whatever screen they land on next — directly violating R309's "no message may stay stuck" intent.
- **Fix:** Added `notifications.clearSticky('monitor-reassign')` to `endServiceTeardown()` and `onUnmounted()` in `useRunControl.ts`. Idempotent no-op when nothing is set.
- **Files modified:** src/composables/useRunControl.ts
- **Verification:** New test `RunControlView.output.test.ts#exiting the run while the sticky is up clears it (R309 — no message may stay stuck across routes)` passes.
- **Committed in:** 9fcaa76f (Task 3 commit)

**2. [Rule 2 - Missing Critical] Cleared the monitor-save-not-persisted sticky on MonitorSetupView unmount**
- **Found during:** Task 3
- **Issue:** Same class of bug as #1 — `MonitorSetupView.vue`'s save-outcome sticky is view-scoped but the host is app-global; leaving the view without saving successfully would strand the warning.
- **Fix:** Added `notifications.clearSticky('monitor-save-not-persisted')` to `onUnmounted()` in `MonitorSetupView.vue`.
- **Files modified:** src/views/MonitorSetupView.vue
- **Verification:** Covered indirectly by the existing unmount/retry test coverage; store is idempotent so this is a pure safety addition with no test regression risk.
- **Committed in:** 9fcaa76f (Task 3 commit)

**3. [Rule 1 - Necessary] Updated 3 of the "8 existing" toasts.test.ts assertions to include the mandated `variant` field**
- **Found during:** Task 1
- **Issue:** The task's own action text mandates widening `Toast` with a `variant` field on every item (including default `push()`). Three existing tests used `toEqual` with an exact-shape object (`{ id, message }`), which necessarily fails once `variant` is added — an unavoidable, direct consequence of the task's own required change, not an independent regression.
- **Fix:** Added `variant: 'error'` to the three `toEqual` expectations. All behavioral assertions (timing, dismiss idempotence, independent timers) were left untouched.
- **Files modified:** src/stores/__tests__/toasts.test.ts
- **Verification:** `npx vitest run src/stores/__tests__/toasts.test.ts` — all 16 tests (8 original + 8 new) pass.
- **Committed in:** ed4c257f (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 necessary test-shape update)
**Impact on plan:** All three are direct, scope-bounded consequences of the plan's own mandated store/host changes (R309's "no stuck message" guarantee once the host became app-global, and the Toast interface widening the plan itself specified). No architectural changes, no scope creep beyond the plan's stated proof cases.

## Issues Encountered
- The full-suite `npx vitest run` surfaced one failure unrelated to this phase: `src/stores/appConfig.test.ts` (a stale duplicate of the canonical, passing `src/stores/__tests__/appConfig.test.ts`, last touched in Phase 70, confirmed via `git diff HEAD~3` showing zero changes to that file across all 3 of this plan's commits). Logged to `.planning/phases/104-notification-multi-church-foundations/deferred-items.md` per the SCOPE BOUNDARY rule rather than fixed here. `src/storage.rules.test.ts` failed as documented in CLAUDE.md (Storage emulator not running locally — not a regression).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The notification primitive (`push`/`setSticky`/`clearSticky`, four severities, mandatory dismiss) is ready for reuse. Plan 104-02 (church switcher, R311/R312) is expected to call `notifications.push(..., { variant: 'error' })` for its own `selectOrg()` failure state per the UI-SPEC's Copywriting Contract — no further store/host changes needed for that consumer.
- `npm run type-check` (the authoritative gate — includes test files) is clean. All directly-touched test files pass; the only two failing files in a full run (`src/storage.rules.test.ts`, `src/stores/appConfig.test.ts`) are both pre-existing and unrelated to this plan.

---
*Phase: 104-notification-multi-church-foundations*
*Completed: 2026-09-01*

## Self-Check: PASSED

All 11 modified files confirmed present on disk; all 3 task commit hashes (`ed4c257f`, `d8f9d983`, `9fcaa76f`) confirmed present in `git log`.
