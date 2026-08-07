---
phase: 42-powerpoint-rendered-image-display
plan: 08
subsystem: ui
tags: [vue, pinia, onSnapshot, firebase-storage, reactivity, effectScope]

# Dependency graph
requires:
  - phase: 42-02
    provides: PptxRenderDoc client type, renderedPagePath Storage-path convention, and the usePptxRenders store (dynamic per-renderImportId onSnapshot listener pool)
  - phase: 42-03
    provides: AssemblyInputs' two optional fields (pptxRendersByImportId, renderedImageUrlsByImportId) and the shared importedRenderReconciler
  - phase: 42-04
    provides: slideGroupMaterializer.ts's IMPORTED branch consuming pptxRendersByImportId
  - phase: 42-05
    provides: slideshowAssembler.ts's IMPORTED branches (group and fallback) consuming both render maps
provides:
  - useSlideshowAssembly.ts's fifth store subscription (distinctRenderImportIds -> pptxRendersStore.syncSubscriptions), live and torn down on scope disposal
  - useSlideshowAssembly.ts's second async loader (loadMissingRenderedUrls / renderedImageUrlsByImportId), caching resolved Storage download URLs keyed by renderImportId:renderedCount
  - Both render maps wired into all four AssemblyInputs construction sites in the composable
  - .planning/PENDING-VERIFICATION.md's Phase 42 section recording the four manual-only checks as deferred
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onScopeDispose (not onUnmounted) for a composable's teardown hook — fires on ANY active effect scope's disposal (component unmount OR an explicitly-created effectScope().stop()), not only a live component instance. Needed here because the new render-listener teardown (T-42-06) had to be assertable from this file's existing effectScope-wrapped test harness."
    - "Synchronous-computed-decides-WHAT / async-watch-does-the-work split, extended a second time in the same file: distinctRenderImportIds (Task 1) and renderReadySignal (Task 2) both mirror distinctSongIds's existing shape, keeping every async side effect out of any computed."
    - "Cache key folds in the value that must invalidate the cache (renderImportId:renderedCount) rather than keying on id alone, so a re-render that changes the page count cannot serve the previous render's array even by accident (T-42-07)."

key-files:
  created: []
  modified:
    - src/composables/useSlideshowAssembly.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Switched the composable's lifecycle hook from onUnmounted to onScopeDispose (Task 1). onUnmounted only registers against a live component instance and is a silent no-op otherwise — this file's own test suite invokes the composable outside a mounted component via an explicit effectScope() specifically to exercise its watchers, so the new render-listener teardown (T-42-06) would have been untestable without this change. Functionally equivalent inside a real component (Vue runs setup() inside the component's own detached scope), so no production behavior change."
  - "distinctRenderImportIds is a SEPARATE watch from the existing org-guarded scripture/imported/groups watch, not folded into it — the org watch is guarded to fire once per org, while the render-subscription watch must re-run whenever the id SET changes within the same org (a deck added/removed from the service)."
  - "renderReadySignal (a synchronous string encoding each referenced id's status:renderedCount) drives the URL-resolution watch alongside distinctRenderImportIds, because the id SET alone does not change across a pending -> ready transition — only the render document's own fields do. Without this second signal, ROADMAP criterion 4's live reactivity would not fire."
  - "renderedUrlCache is keyed \${renderImportId}:\${renderedCount} — the count invalidates the cache on any page-count change AND makes serving a previous render's array structurally impossible, not merely unlikely (T-42-07)."
  - "Both render maps (pptxRendersByImportId, renderedImageUrlsByImportId) are supplied at all four AssemblyInputs construction sites in one pass — the assembled slideshow (drawn) and the materialization/rebuild sites (written) must always agree, or the grid and the stored group would disagree about the same deck."
  - "Task 3: the Phase 42 PENDING-VERIFICATION.md section cross-references Phase 41's already-recorded firestore.rules deploy checkbox rather than restating the deploy command — verified by grep count staying at 2 occurrences of the exact command string, unchanged from what 42-01 left."

patterns-established:
  - "A composable's own store handles and reactive maps intended purely as internal caches (renderedUrlCache, distinctRenderImportIds, renderReadySignal, loadMissingRenderedUrls, renderedImageUrlsByImportId) stay module-private — no change to UseSlideshowAssemblyReturn's public surface."

requirements-completed: [R079, R080]

coverage:
  - id: D1
    description: "The composable subscribes to render documents with a LIVE onSnapshot set (via pptxRendersStore.syncSubscriptions), re-syncing when the service's IMPORTED-deck render-id set changes, and tears every listener down on scope disposal"
    requirement: R080
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts > PPTX render subscription lifecycle (Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rendered-page Storage URLs are resolved asynchronously outside the pure engines and cached by renderImportId:renderedCount, so repeated assembledSlideshow.value access never re-issues Storage calls, and a renderedCount change always serves the new array, never the previous one"
    requirement: R079
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts > rendered-page URL resolution and caching (Task 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A pending -> ready or failed -> ready render transition causes exactly ONE replaceGroupSlides write, with no special case for the starting state (D-10/D-12), and all four AssemblyInputs construction sites carry both render maps"
    requirement: R079
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts > render-status transition write count (D-10 / D-12)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase 42's four manual-only verifications (real-PPTX visual fidelity, the live pending->ready transition, overlay-badge legibility, the firestore.rules deploy cross-reference) are recorded as deferred in PENDING-VERIFICATION.md, none marked passed"
    requirement: R080
    verification:
      - kind: other
        ref: ".planning/PENDING-VERIFICATION.md § Phase 42 — PowerPoint Rendered-Image Display"
        status: pass
    human_judgment: true
    rationale: "The four items themselves require real visual judgment or a live Cloud Run round trip that no unit test can substitute for — that is precisely why they are recorded as deferred rather than closed by this plan."

# Metrics
duration: 24min
completed: 2026-08-07
status: complete
---

# Phase 42 Plan 08: Wire the Render-Status Subscription and URL Cache Summary

**A fifth live `onSnapshot` subscription and a second async URL-caching loader in `useSlideshowAssembly.ts` make a `pending → ready` render transition update the grid and presenter once, with no reload, bounded Storage calls, and no possibility of a stale page array — this is what makes ROADMAP criterion 4 observable end to end.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-07T07:39:00-04:00
- **Completed:** 2026-08-07T08:03:00-04:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `distinctRenderImportIds` (Task 1): a fully synchronous computed walking `service.slots` → `importedDecksById` → `deck.renderImportId`, deduplicated, driving `pptxRendersStore.syncSubscriptions(org, ids)` via a watch kept deliberately separate from the existing org-guarded subscription watch.
- Switched the composable's lifecycle hook from `onUnmounted` to `onScopeDispose` so the new listener teardown (`pptxRendersStore.unsubscribeAll()`) fires on ANY active effect scope's disposal — a real component's unmount, or the explicit `effectScope()` this test suite already uses — closing the T-42-06 listener-leak guard with test coverage that would otherwise have been impossible.
- `renderedUrlCache` + `loadMissingRenderedUrls` + `renderedImageUrlsByImportId` (Task 2): resolves and caches rendered-page download URLs keyed `${renderImportId}:${renderedCount}`, driven by a synchronous `renderReadySignal` so a `pending → ready` transition (which does not change the id set) still re-triggers resolution — the mechanism that gives criterion 4 its live reactivity.
- Both render maps wired into all four `AssemblyInputs` construction sites (`assembledSlideshow`, `materializationCandidates`, `ensureGroupMaterialized`, `rebuildOutcomes`) so the drawn grid and the written group document always agree about the same deck.
- `.planning/PENDING-VERIFICATION.md`'s Phase 42 section (Task 3) records the phase's four manual-only checks as deferred, cross-referencing (not restating) Phase 41's already-recorded `firestore.rules` deploy checkbox.

## Task Commits

Each task was committed atomically:

1. **Task 1: Subscribe the render documents the current service actually needs, and tear them down** - `6866cfa` (feat)
2. **Task 2: Resolve and cache rendered-page URLs, and feed both maps into all four AssemblyInputs sites** - `11f2736` (feat)
3. **Task 3: Record Phase 42's manual-only verifications as deferred** - `82e9128` (docs)

**Plan metadata:** committed separately by the state-update step.

## Files Created/Modified
- `src/composables/useSlideshowAssembly.ts` - `distinctRenderImportIds`, `stopRenderSubscriptionWatch`, `renderedUrlCache`, `renderReadySignal`, `loadMissingRenderedUrls`, `stopRenderedUrlsWatch`, `renderedImageUrlsByImportId`, the extended `cleanup()`, and the `onScopeDispose` switch — all four `AssemblyInputs` sites now carry both render maps
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - three new `describe` blocks (subscription lifecycle, URL caching, transition write count), the `pptxRendersState.rendersByImportId.clear()` beforeEach reset, and a `vi.hoisted` fix for `mockResolveImageUrl` (see Deviations)
- `.planning/PENDING-VERIFICATION.md` - new `## Phase 42` section, four items, all unchecked

## Decisions Made

See `key-decisions` in frontmatter — five decisions: the `onScopeDispose` switch, the separate render-subscription watch, `renderReadySignal`'s role in live reactivity, the `renderedUrlCache` key shape, and wiring both maps at all four sites in one pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched `useSlideshowAssembly`'s lifecycle hook from `onUnmounted` to `onScopeDispose`**
- **Found during:** Task 1
- **Issue:** The plan's Task 1 acceptance criteria require a test asserting `unsubscribeAll` is called exactly once when the composable's effect scope is stopped. `onUnmounted` only registers a callback against a live component instance; this test file's own header comment already documents that it never actually registers when the composable is invoked outside a mounted component (Vue warns "no active component instance"), which is exactly how this test suite exercises the composable (via an explicit `effectScope()`). Without a fix, the required test would have been unwritable.
- **Fix:** Replaced `onUnmounted(cleanup)` with `onScopeDispose(cleanup)`, which fires on ANY active effect scope's disposal — a real component's unmount (Vue runs `setup()` inside the component's own detached scope, so this is byte-identical to `onUnmounted` there) as well as an explicitly-created `effectScope().stop()`. Updated the test file's own header comment to describe the new mechanism accurately rather than leave a now-stale explanation.
- **Files modified:** src/composables/useSlideshowAssembly.ts, src/composables/__tests__/useSlideshowAssembly.test.ts
- **Verification:** `npx vitest run --dir src --exclude '**/rules.test.ts' src/composables/__tests__/useSlideshowAssembly.test.ts` — the new "calls unsubscribeAll exactly once when the composable's effect scope is stopped" test passes; full 49-test file green; `npm run type-check` 0 errors.
- **Committed in:** 6866cfa (Task 1 commit)

**2. [Rule 3 - Blocking] Converted `mockResolveImageUrl` to `vi.hoisted()`**
- **Found during:** Task 2
- **Issue:** Once `useSlideshowAssembly.ts` actually imports `resolveImageUrl` from `@/utils/pptxUpload` (previously this mock was documented as INERT — 42-02's Wave-0 scaffolding note explicitly says nothing imported it yet), the corresponding `vi.mock('@/utils/pptxUpload', ...)` factory executes for the first time during module resolution, before the test file's own top-level `const mockResolveImageUrl = vi.fn(...)` statement had run — producing `ReferenceError: Cannot access 'mockResolveImageUrl' before initialization` and failing the whole test file to load.
- **Fix:** Wrapped the mock in `vi.hoisted(() => vi.fn(...))`, which Vitest guarantees is evaluated before any `vi.mock` factory can run, regardless of import order. Documented why in an inline comment so a future reader does not "simplify" it back to a plain `const`.
- **Files modified:** src/composables/__tests__/useSlideshowAssembly.test.ts
- **Verification:** Test file loads and all 49 tests pass; `npm run type-check` 0 errors.
- **Committed in:** 11f2736 (Task 2 commit)

**3. [Rule 3 - Blocking] Replaced `.at(-1)` with explicit length-indexed access**
- **Found during:** Task 1 (post-hoc, discovered by the type-check gate)
- **Issue:** `Array.prototype.at` requires `lib` `es2022`+, which this project's `tsconfig` does not enable — `npm run type-check` (`vue-tsc --build`) reported `TS2550` on `mockSyncPptxRenderSubscriptions.mock.calls.at(-1)`.
- **Fix:** Replaced with `const calls = ...; calls[calls.length - 1]`.
- **Files modified:** src/composables/__tests__/useSlideshowAssembly.test.ts
- **Verification:** `npm run type-check` 0 errors.
- **Committed in:** 6866cfa (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug fix enabling a required test, 2 blocking test-infra fixes)
**Impact on plan:** All three were necessary to make the plan's own acceptance criteria testable or to pass the mandated type-check gate. No scope creep — no production behavior changed for a real mounted component in any of the three.

## Issues Encountered

The composable's largest single function body (`useSlideshowAssembly`) grew across both tasks with Task 2's code physically interleaved between Task 1's subscription block and the existing per-song lyrics section. To keep the two task commits genuinely atomic (Task 1 touches no `AssemblyInputs` site; Task 2 does, at all four), Task 2's additions were implemented first, then temporarily reverted, Task 1 committed alone, then Task 2's additions re-applied and committed — verified green (tests + type-check) at both intermediate states, not just the final one.

## User Setup Required

None - no external service configuration required. **No deploy was run** (verified: `git status` shows no changes under `render-service/` or `functions/`, and no commit in this plan's history invokes `firebase deploy` or `gcloud run deploy`).

## Next Phase Readiness

- This is the last plan of Phase 42. The full app suite (`npx vitest run`), the rules suite (`npx vitest run --config vitest.rules.config.ts` against the already-running emulator), and `npm run type-check` were all run as the phase gate:
  - App suite: 2841 passed, 13 failed, across exactly the documented 3-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`, `render-service/src/render.test.ts`) — no new failures introduced.
  - Rules suite: 138/138 passing.
  - Type-check: 0 errors.
- `.planning/PENDING-VERIFICATION.md`'s Phase 42 section leaves exactly four items for the owner, with the `firestore.rules` deploy still recorded as ONE checkbox (shared with Phase 41), verified by `grep -c 'firebase deploy --only firestore:rules' .planning/PENDING-VERIFICATION.md` returning 2 both before and after this plan.
- No blockers. Phase 42 is code-complete pending the owner's manual verifications and the still-outstanding `firestore.rules` deploy (Phase 41 + 42 combined, unchanged from 42-01).

---
*Phase: 42-powerpoint-rendered-image-display*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 4 files (2 production/test files, PENDING-VERIFICATION.md, this SUMMARY) confirmed present on
disk; all 3 task commit hashes (`6866cfa`, `11f2736`, `82e9128`) confirmed in git history.
