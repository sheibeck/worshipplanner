---
phase: 26-edit-slide-drawer-risk-medium
plan: 02
subsystem: ui
tags: [vue-router, query-param-convention, song-editor, navigation]

# Dependency graph
requires:
  - phase: 26-01
    provides: SlideGroup.dismissedSignature / ReconcileResult.songSwap data-model gaps (unrelated to this plan's contract, but same phase/wave)
provides:
  - "src/utils/songEditLink.ts — pure builder/parser/clearer for a one-shot ?edit=/?tab= song-edit link"
  - "SongSlideOver.vue accepts an initialTab prop, applied inside its existing open-watcher"
  - "SongsView.vue resolves an arriving song-edit request against the live song catalogue, tolerating async load, then clears the query"
affects: [26-07 (Edit Slide drawer's own 'Edit in song' link — the sender half of this contract)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-shot query-param navigation convention (arrive → act → router.replace to clear), extended from SongsView.vue's existing ?import=true precedent"
    - "Resolve-through-watch for a request that targets a not-yet-loaded item in a live Firestore subscription: try immediate lookup, else watch the collection ref until found, then self-stop"

key-files:
  created:
    - src/utils/songEditLink.ts
    - src/utils/__tests__/songEditLink.test.ts
  modified:
    - src/components/SongSlideOver.vue
    - src/components/__tests__/SongSlideOver.test.ts
    - src/views/SongsView.vue

key-decisions:
  - "songEditLink.ts imports nothing from Vue, vue-router, or any store — even type-only imports from vue-router were avoided (a hand-rolled SongEditRouteLocation/SongEditQuery shape is used instead) so the module is provably pure and cannot drift from either caller."
  - "The opening-tab prop is applied inside SongSlideOver's existing watch(() => props.open, ...) handler, not a new watcher — that handler unconditionally resets the tab on every open, so this was the only place a requested tab could survive."
  - "requestedTab is explicitly reset to undefined in onSelectSong/onAddSong (manual open paths) so a stale arrival request can never leak into an unrelated, later open of the editor."
  - "Task 3 deliberately has no new test file (see 'TDD Gate Compliance' below) — its own read_first/action explicitly said not to add one, since both halves of its wiring (parsing, tab application) are already covered by Tasks 1 and 2's tests."

requirements-completed: [R033, R018]

coverage:
  - id: D1
    description: "songEditLink.ts: builder produces a router location naming the songs route with song id + tab in query; parser round-trips it, normalizes array-valued params, drops unrecognised/absent tabs; clearing helper removes only its own keys"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songEditLink.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "SongSlideOver.vue opens on Details by default, honours a requested lyrics/details tab, re-honours a new request on close-then-reopen, still allows a manual tab click afterward, and create-mode stays unaffected"
    requirement: R033
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts (describe: 'SongSlideOver — opening tab (initialTab prop)')"
        status: pass
    human_judgment: false
  - id: D3
    description: "SongsView.vue resolves an arriving ?edit=/?tab= request (immediate or async-catalogue), opens the right song on the right tab, clears the query without navigating, and never reopens once resolved"
    requirement: R033
    verification: []
    human_judgment: true
    rationale: "Deliberate no-test-file decision (Task 3's own instruction) — wiring is verified via type-check/build plus the plan's own <human-check> steps (26-02-PLAN.md Task 3 verify block), not a unit test against this view."

# Metrics
duration: ~35min
completed: 2026-07-26
status: complete
---

# Phase 26 Plan 02: Song Editor Navigation Target Summary

**A pure `?edit=`/`?tab=` link contract, an opening-tab prop on `SongSlideOver.vue`, and arrival-handling in `SongsView.vue` that tolerates an async song catalogue — the destination half of the future "Edit in song" link (D-14/D-15), built before the drawer that will call it.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `src/utils/songEditLink.ts` — a pure module (no Vue/router/store imports) owning the whole link convention: `buildSongEditLink`, `parseSongEditRequest` (array-value normalization, unrecognised/absent-tab handling), `clearSongEditRequest`, and the `SongEditTab` union — with its own 10-test suite.
- `SongSlideOver.vue` gained an optional `initialTab?: SongEditTab` prop, applied inside the existing `watch(() => props.open, ...)` handler (the one place a requested tab survives that handler's unconditional reset-to-Details). Default behaviour (opens on Details when nothing is requested) is unchanged; a manual tab click still works after arrival; create mode is unaffected.
- `SongsView.vue` now parses an arriving `?edit=`/`?tab=` request alongside its existing `?import=true` handling. If the song is already in `songStore.songs`, it opens immediately; otherwise it watches the live catalogue until the song appears (stopping itself the instant it fires, or simply never firing for a bad/stale id) and then opens it. Once honoured, the request is cleared from the address via a non-navigating `router.replace`, preserving unrelated query params.

## Task Commits

Each task was committed atomically (Tasks 1 and 2 as TDD RED → GREEN pairs; Task 3 as a single commit per its own no-test instruction):

1. **Task 1: The song-edit link contract, as one pure module**
   - `d02e5ca` test(26-02): add failing test for song-edit link contract
   - `29d544b` feat(26-02): implement song-edit link contract module
2. **Task 2: The song editor can be opened on a chosen tab**
   - `0c6d342` test(26-02): add failing test for song editor opening-tab prop
   - `d71e98a` feat(26-02): let the song editor open on a requested tab
3. **Task 3: The song list view honours an arriving link**
   - `05f43cb` feat(26-02): honour an arriving song-edit link on the song list view

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified
- `src/utils/songEditLink.ts` — the pure link contract (builder/parser/clearer/tab union)
- `src/utils/__tests__/songEditLink.test.ts` — 10 tests covering builder, parser, and clearing-helper behavior
- `src/components/SongSlideOver.vue` — new `initialTab` prop, applied inside the existing open-watcher
- `src/components/__tests__/SongSlideOver.test.ts` — 6 new tests for the opening-tab behavior (extended, not a new file)
- `src/views/SongsView.vue` — arrival handling: parse, resolve (immediate or via watch), open, clear query

## Decisions Made
- `songEditLink.ts` deliberately does not import even *types* from `vue-router` — it defines its own `SongEditRouteLocation`/`SongEditQuery` shapes so the module is unambiguously import-free of Vue/router/store, per the task's explicit constraint.
- The opening-tab input is read inside the SAME watcher that resets the tab and re-seeds the form on open — applying it anywhere else would be silently discarded, since that watcher runs unconditionally on every `open` transition.
- `onSelectSong`/`onAddSong` (the pre-existing manual-click paths) now explicitly reset `requestedTab.value = undefined`, so a resolved arrival request can never leak its tab into a later, unrelated manual open of the editor.
- The catalogue-arrival watcher intentionally has no "give up after N ms" timeout: a stale/bad song id in the link simply never resolves (no editor opens, no error), matching Task 3's specified behavior ("leave the list as it is and open nothing") rather than inventing a settle-detection heuristic the plan didn't ask for.

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

Task 3 (`SongsView.vue` arrival handling) carries `tdd="true"` in its own frontmatter tag, but its `<action>` explicitly instructs: *"Do not add a test file for this view. It has none today and standing one up would require mocking the shell, the auth store, the song store and the router for a handler whose two halves — the parsing and the tab application — are already covered by Tasks 1 and 2."* This is a deliberate, plan-authored exception to the `tdd="true"` RED→GREEN gate, not a silently-skipped requirement. Verification for Task 3 instead rests on:
- `npm run type-check` (0 errors, confirmed)
- `npm run build` (succeeds, confirmed)
- The full test suite staying within the 10-file known-failing baseline (confirmed — see Verification below)
- The plan's own `<human-check>` steps in 26-02-PLAN.md Task 3, deferred to the milestone's batch human-verify per `workflow.verifier: false` (see STATE.md)

Tasks 1 and 2 both followed the full RED → GREEN gate sequence (see Task Commits above): a `test(...)` commit with a run confirmed failing before the implementation existed, followed by a `feat(...)` commit with the same test run confirmed passing.

## Issues Encountered

None.

## Verification

- `npx vitest run src/utils/__tests__/songEditLink.test.ts src/components/__tests__/SongSlideOver.test.ts` — 40 tests pass (10 + 30, including the two pre-existing quarantined duplicate copies of `SongSlideOver.test.ts` that also matched the path and passed).
- `npm run type-check` — 0 errors.
- `npm run build` — succeeds.
- `npx vitest run src/` (full suite, run twice) — both runs: **10 failed test files / 156 passed (166 total)**, matching the documented baseline file set exactly (8 `.gsd/quarantine/worktrees/**` files + `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`). The failing-test *count* flapped between runs (52 vs. 39, consistent with the known quarantined-rules-test flakiness called out in 26-VALIDATION.md), but the FILE SET did not grow past 10.

## Known Stubs

None. No hardcoded empty/placeholder values were introduced; the arrival-handling wiring is fully connected to the live song store and router.

## Threat Flags

None beyond what 26-02-PLAN.md's own `<threat_model>` already registers (T-26-02-01/02/03 — all `mitigate`, already implemented as designed: the parser validates the tab against a closed union, the resolution only opens songs the live catalogue already delivered to this user, and the watcher self-stops after one resolution).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The link contract (`buildSongEditLink`) is ready for 26-07 (the drawer's own "Edit in song" affordance) to call directly — it only needs a song id and a `SongEditTab`, and returns a plain object usable with `router.push`.
- `SongSlideOver.vue`'s `initialTab` prop and `SongsView.vue`'s arrival handling are both live in the running app today, independent of the drawer's existence — this plan's destination half works even before 26-07 builds the sender half.
- No blockers for 26-03 (scripture navigation plumbing, the phase's other Wave 1 plan) or 26-04+ (which depend on Wave 1 completing).

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 5 task commit hashes (`d02e5ca`, `29d544b`, `0c6d342`, `d71e98a`, `05f43cb`) confirmed present in `git log`.
