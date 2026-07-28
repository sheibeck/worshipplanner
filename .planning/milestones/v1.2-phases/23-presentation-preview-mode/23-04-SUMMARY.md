---
phase: 23-presentation-preview-mode
plan: 04
subsystem: ui
tags: [vue, slideshow-preview, service-editor, entry-cta, presentation-viewer]

# Dependency graph
requires:
  - phase: 23-02
    provides: PresentationViewer.vue full-screen shell (props/emits contract)
  - phase: 23-03
    provides: PresentationViewer.vue media playback layer (complete, self-contained)
provides:
  - "Present Slideshow" entry CTA in SlideshowPreview's panel header, disabled+self-explanatory at zero slides
  - ServiceEditorView presenting boolean + PresentationViewer mount site wired to the live assembledSlideshow
affects: [23-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Disabled-primary-button idiom (bg-indigo-600/hover:bg-indigo-500/disabled:opacity-50 disabled:cursor-not-allowed) copied verbatim from PptxImportModal.vue's confirm-btn, reused for the new present-slideshow-cta"
    - "canPresent computed aliases hasAnySlides (documented equivalence to assembledSlideshow.length > 0) rather than adding a second prop/computed doing the same check"
    - "ServiceEditorView widens its existing useSlideshowAssembly destructure (assembledSections, assembledSlideshow, isLoading) instead of re-flattening assembledSections into a new array — no new ordering logic introduced"
    - "PresentationViewer mounted with v-if=\"presenting\" directly beside SlideshowPreview (no Teleport wrapper at the call site — the component teleports itself to body)"

key-files:
  created: []
  modified:
    - src/components/SlideshowPreview.vue
    - src/components/__tests__/SlideshowPreview.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "PresentationViewer test stub in ServiceEditorView.test.ts explicitly declares props: ['slides', 'isLoading'] rather than a bare template-only stub, so wrapper.findComponent(PresentationViewer).props('slides') resolves for the array-identity assertion (a props-less custom stub treats bound attributes as fallthrough, not tracked component props)."
  - "The array-identity behavior is verified by asserting the same array reference is returned by PresentationViewer's slides prop across two consecutive re-renders with no underlying data change, rather than by mocking useSlideshowAssembly to inject a sentinel array — the real (unmocked) composable's memoized computed already prevents both a false negative (mock divergence from prod wiring) and a false positive (a rebuilt array would produce a new reference on the second read)."

requirements-completed: [R016, R018]

coverage:
  - id: D1
    description: "With at least one slide, present-slideshow-cta renders enabled with no title attribute and emits present exactly once per click; with zero slides it renders disabled with the exact title 'Add songs or scripture to build a slideshow to present.' and emits nothing on click"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SlideshowPreview.test.ts#renders an enabled.../#disables the..."
        status: pass
    human_judgment: false
  - id: D2
    description: "The Slideshow Preview heading and every pre-existing SlideshowPreview assertion (dividers, cards, empty state, media wrappers, no-Pinia-import) still pass unchanged"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "npx vitest run src/components/__tests__/SlideshowPreview.test.ts (11/11 pass, 8 pre-existing + 3 new)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PresentationViewer is absent on initial ServiceEditorView render, mounts when SlideshowPreview emits present, and unmounts when PresentationViewer emits exit"
    requirement: "R016, R018"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#does not mount.../#mounts PresentationViewer when..."
        status: pass
    human_judgment: false
  - id: D4
    description: "PresentationViewer receives the same assembledSlideshow array instance across re-renders (not locally rebuilt/re-flattened)"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#passes the same assembledSlideshow array instance..."
        status: pass
      - kind: static
        ref: "grep -c 'assembledSections.flatMap\\|assembledSections.reduce\\|\\.flat()' src/views/ServiceEditorView.vue = 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "The full source unit suite, type-check, and production build are all green, with no dependency drift"
    requirement: "R016, R018"
    verification:
      - kind: unit
        ref: "npx vitest run src/ — 147/155 files pass; all 8 failing files are documented pre-existing debris (see Deferred Issues), zero new failures"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exit 0"
        status: pass
      - kind: other
        ref: "npm run build exit 0, dist/ produced"
        status: pass
      - kind: static
        ref: "git diff --stat package.json package-lock.json — empty"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-25
status: complete
---

# Phase 23 Plan 04: Presentation Viewer Entry CTA Summary

**Added a "Present Slideshow" CTA to the existing `SlideshowPreview` panel header and wired it through `ServiceEditorView` to mount/unmount the full-screen `PresentationViewer` over the live `assembledSlideshow` — the entry point that makes plans 23-01 through 23-03 reachable from the service editor.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-25T19:24:00Z
- **Tasks:** 3 completed (Task 3 was verification-only, no source changes)
- **Files modified:** 4

## Accomplishments

- `SlideshowPreview.vue`'s header is now a flex row: the existing "Slideshow Preview" heading plus a new `present-slideshow-cta` button (icon + "Present Slideshow" label, indigo-600 primary, `PptxImportModal.vue`'s disabled-button idiom reused verbatim).
- The CTA is disabled (not hidden) and carries `title="Add songs or scripture to build a slideshow to present."` exactly when `canPresent` (aliasing the existing `hasAnySlides` computed) is false; enabled with no `title` attribute otherwise. Clicking emits a bare `present` event; no new prop was added (`sections` remains the component's only prop).
- `ServiceEditorView.vue` widened its existing `useSlideshowAssembly` destructure to also pull `assembledSlideshow` and `isLoading` (aliased `slideshowLoading`) — the composable's own flat array is passed straight through, with zero re-flattening/re-derivation logic added.
- A new `presenting` ref, defaulting `false`, gates a new `<PresentationViewer v-if="presenting" :slides="assembledSlideshow" :is-loading="slideshowLoading" @exit="presenting = false" />` mounted immediately after `SlideshowPreview`, which now also receives `@present="presenting = true"`. No `<Teleport>` wrapper was added at the call site since `PresentationViewer` already teleports itself to `body`.
- The full automated phase gate ran clean: `npx vitest run src/` (147/155 test files pass; all 8 failing files are pre-existing, documented debris — see Deferred Issues below, zero new regressions), `npm run type-check` exit 0, `npm run build` exit 0 producing `dist/`, and zero `package.json`/`package-lock.json` drift.
- The project knowledge graph was refreshed (`graphify update .`): 19,007 nodes / 18,019 edges, built at commit `cff14e9` (current, not stale).

## Task Commits

1. **Task 1: Add the "Present Slideshow" CTA to the SlideshowPreview header**
   - `701f7b4` (feat) — new `present` emit, `canPresent` computed, CTA markup, 3 new test cases (11/11 total pass)

2. **Task 2: Wire the CTA through ServiceEditorView and mount the viewer**
   - `cff14e9` (feat) — widened `useSlideshowAssembly` destructure, `presenting` ref, `PresentationViewer` import/mount, 3 new test cases (17 total pass in the real file)

3. **Task 3: Run the automated phase gate and refresh the knowledge graph**
   - No source-changing commit — verification only. Graph artifacts refreshed and folded into this plan's metadata commit (see below).

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/SlideshowPreview.vue` (MODIFIED) — header wrapper widened to a flex row; new `present-slideshow-cta` button with heroicons-outline fullscreen-expand glyph; new `defineEmits<{ present: [] }>()`; new `canPresent` computed
- `src/components/__tests__/SlideshowPreview.test.ts` (MODIFIED) — 3 new cases: enabled+emits-once, disabled+title+no-emit, heading still renders
- `src/views/ServiceEditorView.vue` (MODIFIED) — `PresentationViewer` import added next to `SlideshowPreview`'s; `useSlideshowAssembly` destructure widened; `presenting` ref added; mount site updated with `@present`/`v-if`/`@exit` wiring
- `src/views/__tests__/ServiceEditorView.test.ts` (MODIFIED) — `PresentationViewer` import added; mount helper's `stubs` extended with a props-aware `PresentationViewer` stub; 3 new cases: absent-on-initial-render, mount-on-present/unmount-on-exit, array-identity-across-re-renders

## Decisions Made

- **PresentationViewer test stub declares `props: ['slides', 'isLoading']`** rather than the plan's literal bare-template stub, because `wrapper.findComponent(PresentationViewer).props('slides')` only resolves against a component's own declared props — a props-less custom stub treats `:slides`/`:is-loading` as fallthrough attributes, which silently broke the array-identity assertion (`firstSlides` read as `undefined`). Minor, mechanically-necessary deviation from the plan's literal stub string; the rendered DOM output (`data-testid="presentation-viewer-stub"`) is unchanged.
- **Array-identity behavior tested via same-reference-across-re-renders, not via mocking `useSlideshowAssembly`.** The suite does not mock the composable (it runs for real, driven by the mocked Firestore/store layer already in place for this file), so "the same instance the composable returns" is verified by asserting `PresentationViewer`'s `slides` prop is `Object.is`-equal across two consecutive `nextTick()` reads with no underlying service-data change — a locally re-flattened array would produce a new reference on the second read; the composable's memoized computed does not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `PresentationViewer` test stub needed declared props for `.props()` to resolve**
- **Found during:** Task 2, first run of the array-identity test
- **Issue:** The plan's literal stub (`{ template: '<div data-testid="presentation-viewer-stub" />' }`) has no `props` option, so Vue Test Utils treats `:slides`/`:is-loading` as fallthrough attributes rather than tracked component props, and `wrapper.findComponent(PresentationViewer).props('slides')` returned `undefined`.
- **Fix:** Added `props: ['slides', 'isLoading']` to the stub definition. No change to the stub's rendered output or test IDs.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Commit:** `cff14e9`

None else — plan executed exactly as written otherwise.

### Deferred Issues (pre-existing, not introduced by this plan)

Per `.planning/STATE.md` and this plan's `<known_pre_existing_failures>` constraint, the following `npx vitest run src/` failures predate Phase 23 and were left untouched:

- `src/storage.rules.test.ts` (8 tests) — requires the Storage emulator, which this run was forbidden from starting.
- `src/views/__tests__/RosterView.test.ts` (1 test, "wraps Roles config in CollapsibleSection") — stale assertion expecting the pre-rename tab label "Roles config".
- `.gsd/quarantine/worktrees/**` (multiple `rules.test.ts`, `RosterView.test.ts`, and `ServiceEditorView.test.ts` copies) — known stale-duplicate-suite debris; `npx vitest run src/` picks these up because the argument is a substring filter, not a rooted-directory filter, and the quarantine paths contain a nested `src/` segment.

No other files failed. Both `SlideshowPreview.test.ts` and `ServiceEditorView.test.ts` (the real, non-quarantine copies) pass in full: 11/11 and 17/17 respectively.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources introduced by this plan.

## Threat Flags

None — this plan's new surface (`present`/`exit` event wiring, the CTA button) renders inside the already auth-guarded `ServiceEditorView` and reads only the `assembledSlideshow` the authorized session already holds, exactly as recorded in the plan's own `<threat_model>` (T-23-10, accepted with no additional control). `npm run build` ran successfully in the main checkout with `.env.local` present (T-23-11 mitigation verified), and `git diff --stat package.json package-lock.json` was empty (T-23-12 verified — zero dependency drift).

## Issues Encountered

None beyond the test-stub props fix documented above (caught and fixed pre-commit).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The end-to-end path from the service editor into full-screen presentation mode is complete and automated-test-covered: a volunteer can click "Present Slideshow" in the Slideshow Preview panel, land in the viewer over the live assembled slideshow, and exit back to the editor.
- The CTA's disabled state is self-explanatory (title text) whenever there is nothing to present.
- No blockers for plan 23-05.
- Human-verify carried forward from 23-03 (rapid key-repeat media-interleaving check) remains open, plus a new lightweight visual check for this plan: confirm in a real browser that clicking "Present Slideshow" from a populated service enters full-screen and that the CTA's disabled/title state looks correct at zero slides — both are candidates for the batch human-verify pass STATE.md already tracks for Phase 20/21/22/23.

---
*Phase: 23-presentation-preview-mode*
*Completed: 2026-07-25*

## Self-Check: PASSED

`src/components/SlideshowPreview.vue`, `src/components/__tests__/SlideshowPreview.test.ts`, `src/views/ServiceEditorView.vue`, and `src/views/__tests__/ServiceEditorView.test.ts` all found on disk with the expected content; commits `701f7b4` and `cff14e9` found in git log; `npx vitest run src/components/__tests__/SlideshowPreview.test.ts` (11/11) and `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (17/17 real-file tests) both pass; `npm run type-check` exits 0; `npm run build` exits 0 with `dist/` produced.
