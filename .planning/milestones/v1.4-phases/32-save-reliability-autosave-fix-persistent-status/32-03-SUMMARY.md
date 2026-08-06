---
phase: 32-save-reliability-autosave-fix-persistent-status
plan: 03
subsystem: state
tags: [pinia, vue, save-status, toast, vitest]

# Dependency graph
requires:
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 02)
    provides: "AutoSaveStatus extended to a five-member union including 'error', which SaveStatusEntry.status is typed against"
provides:
  - "useSaveStatus (src/stores/saveStatus.ts) — a per-surfaceId Pinia store with set()/clear()/entryFor()/mostUrgent, sitting strictly above useAutoSave"
  - "useToasts (src/stores/toasts.ts) — a minimal array-backed failure-toast store with per-toast 6000ms self-dismiss timers"
  - "Edge-triggered toast wiring inside saveStatus.set(): a toast fires only on the not-error -> error transition per surface, mirroring the entry's own errorText"
affects: [32-04 (SaveStatusIndicator.vue and ToastHost.vue components consume these two stores), 32-05, 32-06 (the four editors and ServiceEditorView wire into useSaveStatus)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First purely client-state Pinia stores in the codebase (no orgId, no Firestore subscription) — still follow the same defineStore(id, () => {...}) setup-store + flat return convention as the nine existing stores"
    - "Edge-detection lives inside the writer (saveStatus.set()), not inside the reader (a component watch) — so no caller of set() needs to know a toast store exists"
    - "Per-item timers owned by the store that creates them (useToasts), not by the component that renders them, so an unmounting consumer cannot strand or prematurely kill a timer"

key-files:
  created:
    - src/stores/saveStatus.ts
    - src/stores/toasts.ts
    - src/stores/__tests__/saveStatus.test.ts
    - src/stores/__tests__/toasts.test.ts
  modified: []

key-decisions:
  - "Combined each task's test-authoring and implementation into a single commit per task (matching this plan's own task boundaries, where each task's <action> block specifies both the store file and its test file as one deliverable), rather than splitting into separate RED/GREEN commits — consistent with how the plan's <task_commit_protocol> and <done> criteria are scoped per task."
  - "Wrote SaveStatusEntry's urgency ranking as a module-level Record<AutoSaveStatus, number> and reduced over Object.keys(entries.value).sort() using a strict '>' comparison, so the lexicographically-first key wins any same-status tie deterministically, satisfying the plan's determinism backstop without needing insertion-order tracking."
  - "Reworded two doc comments in saveStatus.ts (the module-scope prose, not the code) to avoid the literal substrings 'debounce' and a second '6000' occurrence in toasts.ts, so the plan's grep -c acceptance criteria (exactly 0 and exactly 1 respectively) hold without weakening the comments' meaning."

patterns-established:
  - "useToasts.push()/dismiss() idempotence: filtering an absent id is a no-op, never a throw — this is what lets the store's own setTimeout live safely past its raising component's unmount."
  - "useSaveStatus.entryFor() always returns a freshly-allocated idle object for a missing key, never a shared singleton, so a consumer cannot accidentally mutate store state through a read."

requirements-completed: [R040, R041]

coverage:
  - id: D1
    description: "useToasts store: push() mints an id and appends a toast, dismiss() removes immediately, an orphaned auto-dismiss timer after a manual dismiss is harmless, and two toasts pushed at different times dismiss independently on their own 6000ms timers"
    requirement: "R041"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/toasts.test.ts (8 tests, all pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useSaveStatus store: per-surface entries are isolated (one surface's set() never overwrites another's), entryFor() returns a non-mutable idle default for an unknown key, mostUrgent is a deterministic computed rollup (error > saving > pending > saved > idle, lexicographic tie-break), and clear() fully removes a surface's entry"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/saveStatus.test.ts (9 base-behavior tests, all pass)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The failure toast is edge-triggered from inside saveStatus.set(): exactly one toast on the not-error -> error transition per surface, no toast on a repeated error set(), a new toast on a new failure episode after leaving error, silence on all non-error statuses, two independent toasts for two concurrently-failing surfaces, and the generic Copywriting-Contract fallback when errorText is undefined"
    requirement: "R041"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/saveStatus.test.ts (edge-triggered failure toast describe block, 6 tests, all pass)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-02
status: complete
---

# Phase 32 Plan 03: The `useSaveStatus` and `useToasts` stores Summary

**Two client-only Pinia stores — a per-surfaceId save-status aggregator with a deterministic "most urgent" rollup, and a minimal array-backed failure-toast store — wired together so a save failure raises exactly one toast per episode, from inside `set()`, with zero Firestore involvement in either store.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 4 (all new)

## Accomplishments
- `src/stores/toasts.ts` — `useToasts`, the first array-backed, timer-driven, purely client-state Pinia store in the codebase. `push(message)` mints an id via `crypto.randomUUID()`, appends `{ id, message }`, arms a 6000ms self-dismiss timer inside the store (not the component), and returns the id. `dismiss(id)` is idempotent.
- `src/stores/saveStatus.ts` — `useSaveStatus`, keyed by `surfaceId`. `set()`/`clear()`/`entryFor()` give per-surface isolation; `mostUrgent` is a `computed` reduce over lexicographically-sorted keys ranked `error > saving > pending > saved > idle`, so same-status ties resolve identically on every re-evaluation regardless of insertion order. Holds no Firestore state — no `orgId`, no `subscribe`, no import from `firebase/firestore` or `@/firebase` — and does not re-implement any of `useAutoSave`'s debounce/inflight/flush/cleanup machinery.
- Edge-triggered toast wiring: `set()` reads the surface's previous entry before overwriting and calls `useToasts().push(...)` only on the `!== 'error' -> === 'error'` transition, so a caller never has to know toasts exist and an 800ms-debounced retry against a still-down network cannot spam a new toast every tick. The toast body is always the entry's own `errorText`, falling back to the exact generic Copywriting-Contract string when `errorText` is undefined.
- Both stores are covered by real Pinia instances (`setActivePinia(createPinia())`), not `vi.mock`-ed — the new-precedent hazard the plan flagged (every existing store test mocks the store; these are consumed for real by the components plan 04 builds next).

## Task Commits

Each task was committed atomically:

1. **Task 1: The useToasts store** - `6c23751` (feat)
2. **Task 2: The useSaveStatus store — per-surface entries and a derived rollup** - `eb5b1b4` (feat)
3. **Task 3: Edge-trigger the failure toast from inside set()** - `6139002` (feat)

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified
- `src/stores/toasts.ts` - `useToasts` store: `Toast` interface, `toasts` ref, `push(message)`, `dismiss(id)`
- `src/stores/__tests__/toasts.test.ts` - 8 tests: push, auto-dismiss timing, manual dismiss, double-dismiss idempotence, independent per-toast timers, orphaned-timer-after-manual-dismiss safety
- `src/stores/saveStatus.ts` - `useSaveStatus` store: `SaveStatusEntry` interface, `entries` ref, `set()` (with the edge-triggered toast call), `clear()`, `entryFor()`, `mostUrgent` computed
- `src/stores/__tests__/saveStatus.test.ts` - 15 tests: 9 base per-surface/rollup/clear/determinism tests plus a 6-test edge-triggered-failure-toast describe block

## Decisions Made
- Combined test-authoring and implementation into one commit per task (see `key-decisions` above) — this plan's own task boundaries bundle the store file and its test file as a single deliverable per task, unlike plan 02 where RED and GREEN were separate numbered tasks.
- `mostUrgent`'s tie-break is implemented via sorted-key iteration with a strict `>` comparison rather than tracking insertion order, giving deterministic lexicographic-first-wins semantics with no extra state.
- Two doc-comment wordings in `saveStatus.ts` were adjusted (not the code, not the behavior) to satisfy the plan's literal `grep -c "debounce"` (must be 0) and `grep -c "6000"` in `toasts.ts` (must be 1) acceptance criteria — see `key-decisions` for exact wording.

## Deviations from Plan

None — plan executed exactly as written. All acceptance-criteria greps, both test files, `npm run type-check`, and the full `npx vitest run src/` regression pass were run and matched expectations without needing a Rule 1/2/3 fix.

## Issues Encountered

Initial drafts of both files' doc comments incidentally used the literal substrings the plan's mechanical `grep -c` acceptance criteria check for an exact count on (`"debounce"` in `saveStatus.ts` must be 0; `"6000"` in `toasts.ts` must be exactly 1, i.e. only the real `setTimeout(..., 6000)` call, not also mentioned in prose). Both were caught immediately by running the exact grep commands from the plan's `<acceptance_criteria>` and fixed by rewording the surrounding prose without changing meaning or removing the underlying explanation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useSaveStatus` and `useToasts` exist, are fully tested with real Pinia instances, and are ready for plan 04 to build `SaveStatusIndicator.vue` (reads `useSaveStatus().entryFor(surfaceId)`) and `ToastHost.vue` (renders `useToasts().toasts`) against.
- `SaveStatusEntry.status` is typed as `AutoSaveStatus` imported from `@/composables/useAutoSave`, so the `'error'` member plan 02 added is already load-bearing here — any future change to that union will need a corresponding look at `URGENCY` in `saveStatus.ts`.
- The toast's fallback generic error string is duplicated as a literal in `saveStatus.ts` (`GENERIC_ERROR_TEXT`) matching 32-UI-SPEC.md's Copywriting Contract verbatim; plans 05/06 (which set `errorText` at their call sites) should pass the real strings explicitly rather than relying on the fallback, per the UI-SPEC's "never independently authored" rule.
- `npm run type-check` (the `vue-tsc --build` form) is clean. `npx vitest run src/` shows the same 9 pre-existing baseline failures across the same 2 files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) and no new failing file.
- No blockers for plan 04.

---
*Phase: 32-save-reliability-autosave-fix-persistent-status*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: `src/stores/toasts.ts`
- FOUND: `src/stores/__tests__/toasts.test.ts`
- FOUND: `src/stores/saveStatus.ts`
- FOUND: `src/stores/__tests__/saveStatus.test.ts`
- FOUND: commit `6c23751` (feat)
- FOUND: commit `eb5b1b4` (feat)
- FOUND: commit `6139002` (feat)
