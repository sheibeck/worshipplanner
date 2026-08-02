---
phase: 32-save-reliability-autosave-fix-persistent-status
plan: 04
subsystem: ui
tags: [vue, pinia, aria-live, toast, save-status, vitest]

# Dependency graph
requires:
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 03)
    provides: "useSaveStatus (entryFor/set/clear/mostUrgent) and useToasts (toasts/push/dismiss), both real Pinia stores with edge-triggered toast wiring inside saveStatus.set()"
provides:
  - "SaveStatusIndicator.vue — the one shared save-status component, prop surfaceId, reads useSaveStatus().entryFor(surfaceId) reactively, renders nothing at idle"
  - "ToastHost.vue — the app-level failure alert stack, mounted once in AppShell.vue, renders useToasts().toasts as role=alert cards"
  - "AppShell.vue now mounts <ToastHost /> as a sibling immediately after </main>, inside the inner flex column"
affects: [32-05, 32-06 (the four autosaving surfaces swap their old status markup for <SaveStatusIndicator :surface-id=... /> and wire useAutoSave's error edge into useSaveStatus.set())]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First two component tests in this codebase to install a real Pinia (setActivePinia(createPinia())) rather than vi.mock-ing the store, matching 32-03's own new-precedent choice for its store tests"
    - "Count-based single-live-region assertion (wrapper.findAll('[aria-live]')).toHaveLength(1)) rather than an eyeballed check, following the SongLyricsTab.r035.test.ts precedent of asserting structural invariants by count"

key-files:
  created:
    - src/components/SaveStatusIndicator.vue
    - src/components/__tests__/SaveStatusIndicator.test.ts
    - src/components/ToastHost.vue
    - src/components/__tests__/ToastHost.test.ts
  modified:
    - src/components/AppShell.vue

key-decisions:
  - "Reworded ToastHost.vue's script-block doc comment (not the markup) to avoid a second incidental grep match on the literal substring 'role=\"alert\"', so the plan's grep -c acceptance criterion (exactly 1) holds against the real single role=alert element in the template."
  - "Placed <ToastHost /> as a sibling immediately after </main> but still INSIDE the inner 'flex-1 flex flex-col' content column (not as a sibling of the outer flex-row shell alongside AppSidebar), matching 32-UI-SPEC.md §4's literal insertion snippet."

patterns-established:
  - "SaveStatusIndicator is the last stop for the four-state save-status idiom: no variant prop, no per-surface wrapper component — every caller differs only in which surfaceId string it passes."
  - "ToastHost never composes its own copy — the toast body is always the store's message field, verbatim, so there is exactly one string to maintain per failure mode (inline + toast share the same source)."

requirements-completed: [R040, R041]

coverage:
  - id: D1
    description: "SaveStatusIndicator.vue renders four mutually exclusive states (pending/saving/saved/error) inside one aria-live=polite aria-atomic=true region, renders nothing at idle, and resolves an unknown surfaceId to idle rather than throwing"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SaveStatusIndicator.test.ts (12 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ToastHost.vue renders useToasts().toasts as role=alert cards with a bold 'Save failed.' lead, the store's message mirrored verbatim, an aria-hidden icon and an aria-label=Dismiss button; timers live in the store so unmounting the host cannot orphan a timer"
    requirement: "R041"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ToastHost.test.ts (9 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ToastHost is mounted exactly once, in AppShell.vue, as a sibling immediately after </main> inside the inner flex column; no other component in src/ renders it"
    verification:
      - kind: unit
        ref: "grep -rc 'ToastHost' src/ --include=*.vue excluding ToastHost.vue and AppShell.vue: 0 matches everywhere else"
        status: pass
    human_judgment: false
  - id: D4
    description: "E1 overflow backstop: the 59-character generic error sentence renders with no truncation class and its full text content present inside a narrow (120px) mounted parent"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SaveStatusIndicator.test.ts#E1 overflow backstop"
        status: pass
    human_judgment: true
    rationale: "jsdom cannot measure real layout — the test proves 'no truncation class and full text present', not 'visually wraps rather than clips' in a real browser. Recorded as PENDING-VERIFICATION.md item 32-04.1."
  - id: D5
    description: "The whole regression suite (npx vitest run src/), npm run type-check (vue-tsc --build form), and npm run build stay at the pre-existing baseline after mounting ToastHost app-wide"
    verification:
      - kind: unit
        ref: "npx vitest run src/ (74/76 files pass; 9 known-baseline failures across src/storage.rules.test.ts and src/views/__tests__/RosterView.test.ts, identical to the pre-plan baseline)"
        status: pass
      - kind: other
        ref: "npm run type-check && npm run build"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-02
status: complete
---

# Phase 32 Plan 04: SaveStatusIndicator.vue and ToastHost.vue Summary

**Two new components — a single shared `aria-live` save-status span consumed by four surfaces, and an app-level `role="alert"` failure-toast stack mounted once in `AppShell.vue` — built verbatim from 32-UI-SPEC.md's markup against the real `useSaveStatus`/`useToasts` Pinia stores plan 03 shipped, with no surface migrated yet.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 5 (4 new, 1 modified)

## Accomplishments
- `src/components/SaveStatusIndicator.vue` — one shared status component, prop `surfaceId: string`, reads its own entry from `useSaveStatus().entryFor(surfaceId)` reactively via a `computed`. Renders exactly one of four mutually exclusive spans (`pending`/`saving`/`saved`/`error`) inside a single `aria-live="polite" aria-atomic="true"` wrapper carrying `data-testid="save-status"` — idle has no branch at all, so it renders no placeholder and reserves no layout height. The error span additionally carries `data-testid="save-status-error"`. `formattedSavedAt` uses `toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })`, matching the codebase's existing wall-clock convention.
- `src/components/ToastHost.vue` — the failure-toast stack, copied verbatim from 32-UI-SPEC.md §4: `fixed` at `z-[60]` (above every existing `z-50` Teleport dialog), bottom-right on `sm:` and up, full-width-minus-16px below it, `flex flex-col` with `gap-2`. Each card is `role="alert"` with an `aria-hidden` warning SVG, a `font-medium` "Save failed." lead, the store's message mirrored verbatim, and an `aria-label="Dismiss"` button. Zero toasts leaves the container with no children (verified by `element.children.length === 0`). Not wired to `lifecycleError`, no `v-html`, no toast library.
- `src/components/AppShell.vue` — mounts `<ToastHost />` once, as a sibling immediately after `</main>`, still inside the inner `flex-1 flex flex-col` content column (not the outer sidebar-plus-content row) so it stays fixed regardless of scroll and independent of the sidebar's own stacking context.
- Both new component test files install a real Pinia (`setActivePinia(createPinia())`) and drive the actual stores rather than mocking them — the new-precedent hazard the plan flagged, matching 32-03's own choice for its store tests. `SaveStatusIndicator.test.ts` (12 tests) and `ToastHost.test.ts` (9 tests) both assert structural invariants by count (`wrapper.findAll('[aria-live]')` has length 1) rather than by eye, following the `SongLyricsTab.r035.test.ts` precedent cited in the plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: SaveStatusIndicator.vue — the one shared status component** - `699f927` (feat)
2. **Task 2: ToastHost.vue — the app-level failure alert stack** - `3786ace` (feat)
3. **Task 3: Mount ToastHost once in AppShell** - `12188af` (feat)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `src/components/SaveStatusIndicator.vue` - the one shared save-status component (idle/pending/saving/saved/error)
- `src/components/__tests__/SaveStatusIndicator.test.ts` - 12 tests: per-state rendering, single-live-region count assertion, unknown-surfaceId safety, reactivity, E1 overflow backstop
- `src/components/ToastHost.vue` - app-level failure-toast stack, mounted once
- `src/components/__tests__/ToastHost.test.ts` - 9 tests: empty/populated/many, dismiss, auto-dismiss, mirrored copy, order, unmount backstop
- `src/components/AppShell.vue` - mounts `<ToastHost />` as the new global mount point

## Decisions Made
- Reworded `ToastHost.vue`'s doc comment to avoid a second incidental match on `role="alert"` in the plan's `grep -c` acceptance criterion (see `key-decisions` above) — the same class of fix 32-03 already made for its own store files' doc comments.
- Placed `<ToastHost />` inside the inner content flex column rather than as a sibling of the outer sidebar row, matching 32-UI-SPEC.md §4's exact insertion snippet (`<main>...</main><ToastHost />` inside the same parent).
- Added a 9th test to `ToastHost.test.ts` (toast render order) beyond the 8 the behavior block strictly required, to clear the plan's "at least 9 `it(` blocks" acceptance criterion with a genuine behavioral assertion rather than a padding test.

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps, both test files, `npm run type-check` (the `vue-tsc --build` form), `npm run build`, and the full `npx vitest run src/` regression pass were run and matched expectations without needing a Rule 1/2/3 fix.

## Issues Encountered

Two component tests initially failed because `useSaveStatus().set(...)` mutates the store synchronously but the mounted component's DOM only reflects the change after Vue's next render tick — the first test draft asserted `wrapper.text()` immediately after `set()` with no `await wrapper.vm.$nextTick()`. Fixed by awaiting `$nextTick()` after every `set()`/`push()` call whose effect is asserted post-mount (the initial-mount tests, which read state already present before `mount()`, needed no such await). This is ordinary Vue reactivity-timing housekeeping, not a Rule 1/2/3 deviation from the plan's design.

## Known Stubs

None. Both components are fully wired to their real stores; no surface calls into `SaveStatusIndicator` or `ToastHost` yet (that migration is plans 05/06's job), but neither component itself contains any placeholder, hardcoded-empty, or "coming soon" content.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SaveStatusIndicator.vue` and `ToastHost.vue` exist, are fully tested against real Pinia stores, and are ready for plans 05 and 06 to consume as a pure swap: replace each of the four surfaces' old dot/title status markup with `<SaveStatusIndicator :surface-id="..." />`, and delete the three old per-status `data-testid`s (`status-pending`/`status-saving`/`status-saved`) as the deliberate breaking rename 32-UI-SPEC.md §5 calls for.
- `AppShell.vue` is the single, confirmed mount point for `ToastHost` — grep confirms no other `.vue` file in `src/` renders it. Plans 05/06 must not add a second mount; they only need to call `useSaveStatus().set(surfaceId, {...})` on status transitions (including the not-error→error edge, which `saveStatus.set()` already turns into a toast automatically per plan 03's wiring) — no direct `useToasts()` call is needed from any of the four surfaces.
- `useAutoSave.ts`'s `'error'` status (plan 02) and the fade-timer removal are both load-bearing here: `SaveStatusIndicator`'s `saved` branch has no auto-hide, so any surface that still relies on the old 3-second fade behavior will now show a persistent `Saved h:mm` until its next edit — this is intentional per R040, not a regression to fix in 05/06.
- `npm run type-check` (the `vue-tsc --build` form) is clean. `npx vitest run src/` shows the exact same pre-existing baseline: 9 failing tests across 2 files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), no new failing file. `npm run build` succeeds (the pre-existing `>500kB chunk` warning is unrelated, unchanged by this plan).
- Deferred to human verification (`PENDING-VERIFICATION.md`, Phase 32 section, items 32-04.1 and 32-04.2): the E1 overflow backstop's real-browser wrap behavior, and the toast's real-viewport bottom-right/mobile positioning relative to the sticky status bar and lock banner — neither is provable from jsdom.
- No blockers for plan 05 or 06.

---
*Phase: 32-save-reliability-autosave-fix-persistent-status*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: `src/components/SaveStatusIndicator.vue`
- FOUND: `src/components/__tests__/SaveStatusIndicator.test.ts`
- FOUND: `src/components/ToastHost.vue`
- FOUND: `src/components/__tests__/ToastHost.test.ts`
- FOUND: `src/components/AppShell.vue`
- FOUND: commit `699f927` (feat)
- FOUND: commit `3786ace` (feat)
- FOUND: commit `12188af` (feat)
