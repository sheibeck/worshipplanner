---
phase: 32-save-reliability-autosave-fix-persistent-status
plan: 06
subsystem: ui
tags: [vue, pinia, autosave, save-status, aria-live, vitest]

# Dependency graph
requires:
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 02)
    provides: "AutoSaveStatus gains 'error'; useAutoSave.ts loses the 3s fade timer"
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 03)
    provides: "useSaveStatus (entryFor/set/clear/mostUrgent) and useToasts, with the edge-triggered toast wired inside saveStatus.set()"
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 04)
    provides: "SaveStatusIndicator.vue (prop surfaceId), data-testid=save-status/save-status-error"
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 05)
    provides: "ServiceEditorView.vue's own migration onto useAutoSave/useSaveStatus — the real-Pinia test-setup idiom this plan reuses"
provides:
  - "CongregationalEditor.vue, ScriptureSlideEditor.vue, SongLyricEditor.vue all render SaveStatusIndicator instead of their own three-span status markup — R040's 'every surface' clause is now satisfied by all four autosaving surfaces, not just ServiceEditorView"
  - "A stable-surface-id capture pattern (capture once, the first time the underlying record id resolves, register nothing before then) applied identically across all three editors, closing the E4 partial/loading backstops"
  - "A minimal defineExpose({ currentReadingId }) test seam on the two readings editors, matching PptxImportModal.vue's existing precedent, since currentReadingId has no reactive prop-watcher in production"
  - "enableAutoUnmount added to all four editor-family test files (three rewritten here, plus SongLyricsTab.r035.test.ts fixed as a same-plan regression) — a documented Pinia-plus-Vue-watcher hazard for any future test file that mounts a component consuming a Pinia store while also holding onto a shared, module-level mocked ref"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capture-once surface id: a dedicated ref, assigned exactly once (the first time the driving id/prop resolves to non-null) via a watch with { immediate: true }, and never re-derived. The reporting watch (on the composable's own status) is a SEPARATE watcher, guarded by `if (!surfaceId.value) return`, so nothing is written to the store before the id resolves and nothing is ever re-attributed once it has."
    - "enableAutoUnmount(afterEach) is load-bearing, not just tidy cleanup, in any test file where a mocked composable returns a SHARED, module-level status ref consumed by a component that also calls a real Pinia store action. Pinia wraps every store action (including setup-store returned functions) to call setActivePinia(itsOwnPinia) before running, as an ergonomic guarantee that nested useOtherStore() calls resolve correctly. An un-unmounted wrapper's watcher stays subscribed to the shared ref; firing it later hijacks the GLOBALLY-active Pinia back to that wrapper's own (possibly stale) instance, silently corrupting an unrelated LATER test's freshly-created store. Diagnosed empirically (see Issues Encountered) since no prior test file in this codebase combined a shared-ref composable mock with a real Pinia store."

key-files:
  created: []
  modified:
    - src/components/CongregationalEditor.vue
    - src/components/ScriptureSlideEditor.vue
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/CongregationalEditor.test.ts
    - src/components/__tests__/ScriptureSlideEditor.test.ts
    - src/components/__tests__/SongLyricEditor.test.ts
    - src/components/__tests__/SongLyricsTab.r035.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "The three per-status data-testids (status-pending/status-saving/status-saved) are retired everywhere, exactly as 32-UI-SPEC.md § 5 mandates — a deliberate breaking rename, not incidental test breakage. All nine occurrences (three per editor) are gone from both src/ components and their test files; verified by a zero-count grep audit."
  - "Added defineExpose({ currentReadingId }) to CongregationalEditor.vue and ScriptureSlideEditor.vue — a minimal, precedented (PptxImportModal.vue already does this for testability) seam. currentReadingId has no reactive watcher on props.readingId in production (it is seeded once at ref-init and assigned once more inside onFetchPassage), so the E4 partial backstop test — which needs to force the null-to-id resolution race, and then a further id 'switch', independently of the component's own async fetch flow — had no other way to drive that state from outside. This is a test-only addition; it changes no runtime behavior."
  - "SongLyricEditor's E4 partial backstop is written explicitly as a DEFENSIVE test, not a live-repro one, and says so in its own title and in this SUMMARY: SongSlideOver.vue only renders this editor while its panel is open, behind a full-viewport click-blocking backdrop, and SongsView.vue always sets the row selection and the open flag together — so a mid-mount songId swap is not reachable in production today. The test still exercises the real code path (via wrapper.setProps, which IS a legitimate Vue prop-reactivity trigger for this editor, unlike the two readings editors) to guard the structural property if that reachability guarantee ever changes."
  - "SongLyricsTab.r035.test.ts (an existing, out-of-plan-scope test file that composes SongSlideOver + the REAL SongLyricEditor, unlike SongSlideOver.test.ts which stubs SongLyricEditor entirely) started failing with a Pinia 'no active pinia' error once SongLyricEditor.vue began calling useSaveStatus(). This is a direct, same-cause regression from this plan's Task 2 change, not a pre-existing failure — fixed under Rule 1 (auto-fix bugs this plan's own change introduced) by adding the same setActivePinia(createPinia()) + enableAutoUnmount(afterEach) idiom used in the plan's own three test files."

requirements-completed: [R040, R041]

coverage:
  - id: D1
    description: "CongregationalEditor.vue, ScriptureSlideEditor.vue and SongLyricEditor.vue all render SaveStatusIndicator in their existing (non-sticky) header slot instead of the retired three-span markup; idle renders nothing, saved persists, and only the generic failure sentence appears (never the reorder variant)"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts (19/19), src/components/__tests__/ScriptureSlideEditor.test.ts (20/20), src/components/__tests__/SongLyricEditor.test.ts (51/51)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each editor's surface id is captured exactly once, the first time the underlying record id resolves, and nothing is registered in the store before then; each editor clears its own store entry inside its existing unmount hook"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "CongregationalEditor.test.ts and ScriptureSlideEditor.test.ts 'clears its store entry on unmount' + 'E4 partial backstop' tests; SongLyricEditor.test.ts's own equivalents"
        status: pass
    human_judgment: false
  - id: D3
    description: "E4 loading backstop: a freshly-mounted editor for a different record never inherits a previous record's saved status. E4 partial backstop (the sharpest correctness risk in the phase's UI layer): a save armed before the surface id resolves, followed by the id changing again, must not misattribute the in-flight result to the new id — proven for both readings editors (genuinely reachable) and written defensively for the lyrics editor (not currently reachable, documented as such)"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "CongregationalEditor.test.ts and ScriptureSlideEditor.test.ts 'E4 loading backstop' + 'E4 partial backstop' tests; SongLyricEditor.test.ts's equivalents (the partial one explicitly titled 'defensive')"
        status: pass
    human_judgment: false
  - id: D4
    description: "E1/E4 overflow backstop: the 59-character generic failure sentence renders without a truncation class inside SongLyricEditor's header — the narrowest of the three editor headers per 32-UI-SPEC.md"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#E1/E4 overflow backstop"
        status: pass
    human_judgment: true
    rationale: "jsdom cannot measure real layout — the test proves 'no truncation class and full text present', not 'visually wraps rather than clips' in a real browser. Deferred to PENDING-VERIFICATION.md item 32-06.2, matching plan 04's own precedent for the same limitation."
  - id: D5
    description: "The whole regression suite (npx vitest run src/), npm run type-check (vue-tsc --build form) and npm run build stay at the pre-existing baseline after this migration, including a regression this plan's own change exposed in an out-of-scope test file (SongLyricsTab.r035.test.ts), fixed in the same commit"
    verification:
      - kind: unit
        ref: "npx vitest run src/ (1977/1986; 9 known-baseline failures across src/storage.rules.test.ts and src/views/__tests__/RosterView.test.ts, identical to the pre-plan baseline)"
        status: pass
      - kind: other
        ref: "npm run type-check && npm run build"
        status: pass
    human_judgment: false
  - id: D6
    description: "The three deferred human checks (SongLyricEditor visual confirmation, the overflow-wrap visual check, and the screen-reader announcement check) are recorded in PENDING-VERIFICATION.md, not self-approved"
    verification: []
    human_judgment: true
    rationale: "Real-browser wrap behavior, and live screen-reader announcement timing/politeness, cannot be proven from jsdom or by an autonomous agent — deferred per the STATE.md standing autonomy grant."

# Metrics
duration: ~1h 40min
completed: 2026-08-02
status: complete
---

# Phase 32 Plan 06: The three remaining editors migrated onto SaveStatusIndicator Summary

**Rolled the shared `SaveStatusIndicator`/`useSaveStatus` pair out to `CongregationalEditor.vue`, `ScriptureSlideEditor.vue` and `SongLyricEditor.vue` — retiring the nine per-status `data-testid`s these three duplicated, resolving the surface-id race the phase's own RESEARCH flagged as its sharpest UI-layer correctness risk, and fixing a same-plan regression in an out-of-scope test file this migration exposed. This is Phase 32's last plan.**

## Performance

- **Duration:** ~1h 40min
- **Tasks:** 3 (Task 1: readings editors' markup + stable-id capture; Task 2: SongLyricEditor's identical swap; Task 3: all three test files moved onto the new handles, plus the three E4 backstop tests)
- **Files modified:** 8 (3 source components, 3 rewritten test files, 1 regression-fix test file, 1 PENDING-VERIFICATION.md append)

## Accomplishments

- All four autosaving surfaces in the app now render the identical `SaveStatusIndicator` component — `ServiceEditorView.vue` (plan 05) plus these three. R040's "every surface with autosave" clause is now fully satisfied, not just satisfied for the one view that got its own plan.
- `CongregationalEditor.vue` and `ScriptureSlideEditor.vue`: the three-span dot/title status block is replaced by one `<SaveStatusIndicator :surface-id="surfaceId ?? ''" />` in the same non-shrinking header slot. A dedicated `surfaceId` ref is captured exactly once — the first time `currentReadingId` resolves to non-null — via a `watch(currentReadingId, ..., { immediate: true })` that only ever assigns when `!surfaceId.value`. A separate reporting watch on `autoSaveStatus.value` writes into `useSaveStatus` only when `surfaceId.value` is truthy, so nothing is ever registered under a stale `congregational:null`-style key. Both files' existing `useAutoSave` call sites, debounce (800ms, unchanged), and `onFetchPassage`/`doAutoSave` logic are untouched — only the reporting and rendering changed.
- `SongLyricEditor.vue`: the identical swap, with `surfaceId` captured at setup from `props.songId` using the same capture-watch shape (resolves immediately here, since the prop is non-null from mount).
- All three unmount hooks now call `saveStatus.clear(surfaceId.value)` (guarded) next to their existing composable `cleanup()` call, so a later mount never reads a stale entry.
- No `isEditor`/lock gate was added to any of the three — access control for these panels stays at the route level, unchanged, matching the plan's explicit instruction.
- Added `defineExpose({ currentReadingId })` to the two readings editors — a minimal, precedented (`PptxImportModal.vue` already does this) test-only seam needed to drive the E4 `partial` backstop, since `currentReadingId` has no reactive prop-watcher in production.
- All three test files were moved onto real Pinia (`setActivePinia(createPinia())`) rather than mocking `useSaveStatus`, matching plans 04/05's own precedent, plus `enableAutoUnmount(afterEach)` — which turned out to be load-bearing, not just cleanup (see Issues Encountered).
- The nine retired handles (`status-pending`/`status-saving`/`status-saved` × 3 editors) are gone from every file under `src/`, both source and tests — verified by a zero-count grep audit.
- The three E4 backstops (loading, partial, overflow) all have real, passing tests, written per-editor with the readings-editors' `partial` test proven genuinely reachable and the lyrics editor's written explicitly as defensive.
- Fixed a regression this plan's own Task 2 change exposed in `SongLyricsTab.r035.test.ts` (an out-of-scope, pre-existing test file that mounts the REAL `SongLyricEditor` via `SongSlideOver`, unlike `SongSlideOver.test.ts` which stubs it): it started failing with Pinia's "no active pinia" error once `SongLyricEditor.vue` began calling `useSaveStatus()`. Fixed with the same `setActivePinia`/`enableAutoUnmount` idiom.

## Task Commits

1. **Task 1: Congregational and Scripture editors — swap the markup and resolve the stable surface id** - `333b905` (feat)
2. **Task 2: SongLyricEditor — the same swap, with its id captured at setup** - `e96af19` (feat)
3. **Task 3: Move the three test files onto the new handles and add the E4 backstops** - `af027a7` (test) — includes the `defineExpose` additions (needed by this task's own tests) and the `SongLyricsTab.r035.test.ts` regression fix

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified

- `src/components/CongregationalEditor.vue` - `SaveStatusIndicator` swap; capture-once `surfaceId`; reporting watch; unmount clear; `defineExpose({ currentReadingId })` test seam
- `src/components/ScriptureSlideEditor.vue` - identical to CongregationalEditor.vue
- `src/components/SongLyricEditor.vue` - identical swap, `surfaceId` captured at setup from `props.songId`
- `src/components/__tests__/CongregationalEditor.test.ts` - real Pinia + `enableAutoUnmount`; retired-handle assertions moved to `save-status`/`save-status-error`; new store-clear, E4 loading, and E4 partial tests. `it(` count: 15 → 19
- `src/components/__tests__/ScriptureSlideEditor.test.ts` - same shape. `it(` count: 16 → 20
- `src/components/__tests__/SongLyricEditor.test.ts` - same shape, plus the E1/E4 overflow backstop and a `beforeEach` reset of the shared mocked status ref (see Issues Encountered). `it(` count: 48 → 51
- `src/components/__tests__/SongLyricsTab.r035.test.ts` - added `setActivePinia(createPinia())` to its existing `beforeEach` (Rule 1 fix for this plan's own regression); `enableAutoUnmount` was already present
- `.planning/PENDING-VERIFICATION.md` - appended the three deferred human checks for this plan under a new "Plan 32-06" subsection

## Decisions Made

See `key-decisions` in the frontmatter for the `defineExpose` test-seam rationale, the SongLyricEditor defensive-vs-reachable framing, and the `SongLyricsTab.r035.test.ts` regression classification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, exposed by this plan's own change] `SongLyricsTab.r035.test.ts` broke because it mounts the real `SongLyricEditor` without an active Pinia**
- **Found during:** Task 3, running the full suite after Task 2's `SongLyricEditor.vue` migration landed.
- **Issue:** `SongLyricsTab.r035.test.ts` composes `SongSlideOver` + the real `SongLyricEditor` (unlike `SongSlideOver.test.ts`, which stubs `SongLyricEditor` out entirely) to prove the R035 single-scroll-surface property across both components together. Once `SongLyricEditor.vue` started calling `useSaveStatus()` inside `setup()`, this file's five tests that reach that mount path failed with Pinia's `"getActivePinia() was called but there was no active Pinia"` error — a direct, same-cause consequence of this plan's Task 2 change, not a pre-existing defect.
- **Fix:** Added `setActivePinia(createPinia())` to the file's existing `describe`-level `beforeEach` (it already imported and called `enableAutoUnmount(afterEach)` for an unrelated reason, so only the Pinia line was missing).
- **Files modified:** `src/components/__tests__/SongLyricsTab.r035.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/SongLyricsTab.r035.test.ts` — 7/7.
- **Committed in:** `af027a7` (Task 3 commit).

**2. [Rule 3 - Blocking] `enableAutoUnmount` was required, not optional, for the new E4 backstop tests to pass reliably**
- **Found during:** Task 3, while writing the `CongregationalEditor.test.ts` E4 `partial` backstop test.
- **Issue:** Diagnosed and empirically confirmed a hazard not previously present in this codebase's test suite: when a mocked composable returns a SHARED, module-level status ref (as all three editors' `useAutoSave` mocks already did, pre-dating this plan) consumed by a component that ALSO calls a real Pinia store action, an un-unmounted wrapper from an EARLIER test keeps its reporting watcher subscribed to that shared ref. The next time a LATER test changes the ref's value, that zombie watcher fires and calls a `useSaveStatus` action — and Pinia wraps every store action to call `setActivePinia(itsOwnPinia)` before running (an ergonomic guarantee so nested `useOtherStore()` calls inside an action resolve correctly). This silently flips the GLOBALLY-active Pinia back to the zombie's own (stale) instance, so the LATER test's freshly-created, supposedly-isolated Pinia store ends up polluted with the earlier test's entries. Without `enableAutoUnmount`, this plan's `CongregationalEditor.test.ts` E4 `partial` test failed nondeterministically depending on which earlier tests happened to leave wrappers mounted.
- **Fix:** Added `enableAutoUnmount(afterEach)` to all three rewritten test files (matching `ServiceEditorView.test.ts`'s own existing precedent from plan 05, which this plan had not initially connected to this specific failure mode) and to `SongLyricEditor.test.ts`'s `beforeEach`, additionally resetting the shared mocked status ref to `'idle'` each test (Vue's `watch()` only fires on an actual value change, so two adjacent tests driving the ref to the SAME status back-to-back would otherwise silently no-op).
- **Files modified:** `src/components/__tests__/CongregationalEditor.test.ts`, `src/components/__tests__/ScriptureSlideEditor.test.ts`, `src/components/__tests__/SongLyricEditor.test.ts`
- **Verification:** All three files pass in isolation AND as part of the full `npx vitest run src/` run (order-independence confirmed).
- **Committed in:** `af027a7` (Task 3 commit).

---

**Total deviations:** 2 auto-fixed (1 bug exposed by this plan's own change, 1 blocking test-infrastructure issue).
**Impact on plan:** Both necessary for a fully-green, order-independent suite. Neither is scope creep — the first is a direct consequence of Task 2's change in a file the plan's own Task 3 verification step (`npx vitest run src/`) is required to run clean, and the second was required to make Task 3's own required E4 backstop tests pass reliably.

## Issues Encountered

- **The `enableAutoUnmount` diagnosis (see Deviation 2) took real investigation to pin down.** The symptom — a fresh `createPinia()` in a later test's `beforeEach` somehow already containing an entry from an EARLIER test — looked at first like Pinia itself failing to isolate state across instances. Four progressively-narrower reproduction scripts (outside the actual test files, in a scratch location) were needed to isolate the actual mechanism: it is not Pinia-instance leakage at all, but a live Vue `watch()` effect from a never-unmounted PRIOR component instance firing during a LATER test and, as a side effect of Pinia's action-wrapping (`setActivePinia` called at the top of every wrapped action), silently redirecting the process-global "active Pinia" pointer. This is now documented as a `tech-stack.patterns` entry above so a future test file combining a shared-ref composable mock with a real Pinia store doesn't have to rediscover it.
- **Designing a test for the E4 `partial` backstop required a test-only `defineExpose`, not just new assertions.** `currentReadingId` in both readings editors has no reactive watcher on `props.readingId` in production — it is a plain `ref` seeded once at declaration and reassigned once more, internally, inside `onFetchPassage`. There was no way to force the exact "id resolves, then resolves AGAIN to something different" sequence the backstop needs to exercise from outside the component without either (a) reaching into internal state via `defineExpose` (the path taken, precedented by `PptxImportModal.vue`), or (b) fabricating a network-timing race through the mocked `store.createReading`/`fetchPassageText` promises, which would have been far more fragile and harder to read. `SongLyricEditor.vue` needed no such seam since `props.songId` is genuinely reactive and `wrapper.setProps()` is sufficient.

## Known Stubs

None. Every new element (`SaveStatusIndicator` binding, the capture-once `surfaceId`, the reporting watch, the unmount clear) is wired to the real `useSaveStatus` store; nothing renders a hardcoded-empty or placeholder value.

## Threat Flags

None beyond what the plan's own threat model already covers (T-32-17 through T-32-20, all addressed by this plan's own implementation and tests per the plan's threat register). No new network endpoint, auth path, or schema change was introduced. The `defineExpose({ currentReadingId })` test seam exposes read/write access to an internal id ref via the component's public instance — this is test-only surface (no production code path reads `$refs`/`expose()` on these components), and `currentReadingId` itself carries no secret or user-supplied HTML, so it introduces no new sink.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 32 is now complete: all four autosaving surfaces (`ServiceEditorView.vue` via plan 05, plus these three via this plan) share one `SaveStatusIndicator` component, one `useSaveStatus` store, and one `useToasts` failure-toast host. The nine retired per-editor status handles and ServiceEditorView's own inline failure-text handle (retired in plan 05) are gone from `src/` entirely.
- `CongregationalEditor.vue` and `ScriptureSlideEditor.vue` remain unmounted dead weight pending Phase 34 (unchanged by this plan) — when that phase mounts them, the surface-id capture-once fix this plan made is what prevents the E4 `partial` misattribution risk from becoming a live production bug the moment they're wired into a real view.
- `npm run type-check` (the `vue-tsc --build` form) is clean. `npx vitest run src/` shows the exact same pre-existing baseline: 9 failing tests across 2 files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), no new failing file beyond that baseline. `npm run build` succeeds (the pre-existing `>500kB chunk` warning is unrelated, unchanged by this plan).
- Three human checks deferred to `.planning/PENDING-VERIFICATION.md` under "Plan 32-06": the SongLyricEditor visual confirmation (Saving…/Saved h:mm replacing the old dot-and-tick — currently only checkable against `SongLyricEditor.vue` since the other two are unmounted), the overflow-wrap visual check (jsdom cannot prove real wrapping), and the screen-reader announcement check.
- No blockers remain for the phase's overall completion.

---
*Phase: 32-save-reliability-autosave-fix-persistent-status*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: `src/components/CongregationalEditor.vue`
- FOUND: `src/components/ScriptureSlideEditor.vue`
- FOUND: `src/components/SongLyricEditor.vue`
- FOUND: `src/components/__tests__/CongregationalEditor.test.ts`
- FOUND: `src/components/__tests__/ScriptureSlideEditor.test.ts`
- FOUND: `src/components/__tests__/SongLyricEditor.test.ts`
- FOUND: `src/components/__tests__/SongLyricsTab.r035.test.ts`
- FOUND: `.planning/PENDING-VERIFICATION.md`
- FOUND: commit `333b905` (feat)
- FOUND: commit `e96af19` (feat)
- FOUND: commit `af027a7` (test)
