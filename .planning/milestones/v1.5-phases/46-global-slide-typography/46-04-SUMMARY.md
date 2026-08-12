---
phase: 46-global-slide-typography
plan: 04
subsystem: ui
tags: [vue, css-custom-properties, font-loading, typography, presenter, vitest]

requires:
  - phase: 46-global-slide-typography
    plan: 02
    provides: "OrgSettings.slideTypography, cssVarsFor()/snapWeight()/waitForSlideFont()/loadFontCss()/FONT_LOAD_TIMEOUT_MS in src/utils/slideTypography.ts, and the :root CSS-var fallbacks + eager Inter/400 import in main.ts"
provides:
  - "The three slide-typography render sites (SlideGrid, EditSlideDrawer's preview, PresentationViewer) each bind cssVarsFor(authStore.settings.slideTypography) as an inline CSS-variable wrapper"
  - "Scoped per-element font-weight/font-size overrides on every primary slide-text element in each render site, reading each element's own existing Tailwind base size"
  - "PresentationViewer's R094 font-load gate: fontReady ref, onMounted on-demand loadFontCss + waitForSlideFont(family, weight, FONT_LOAD_TIMEOUT_MS), and a showLoadingState computed that reuses the existing 'Loading slideshow…' state"
affects: []

tech-stack:
  added: []
  patterns:
    - "One CSS-variable wrapper per render site (grid container, drawer preview box, presenter root), with scoped <style> rules combining each element's existing Tailwind size class with a calc(base * var(--slide-font-scale)) override — unlayered scoped styles win over Tailwind's @layer utilities regardless of selector specificity"
    - "A presentational child (SlideCard) receives its typography as a prop computed once by its parent, rather than importing the store itself, preserving its existing 'reads no store' contract while staying self-contained/testable in isolation"

key-files:
  created: []
  modified:
    - src/components/PresentationViewer.vue
    - src/components/slides/SlideGrid.vue
    - src/components/slides/SlideCard.vue
    - src/components/slides/EditSlideDrawer.vue
    - src/components/__tests__/PresentationViewer.test.ts
    - src/components/slides/__tests__/SlideCard.test.ts
    - src/components/slides/__tests__/SlideGrid.test.ts
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "SlideCard.vue does not import useAuthStore itself — SlideGrid computes cssVarsFor(authStore.settings.slideTypography) once and passes it down via an optional typographyStyle prop (defaulting to cssVarsFor's own Inter/400/md fallback). This keeps the plan's literal 'three render surfaces import the auth store' instruction true, preserves SlideCard's existing 'reads no store, calls no composable' contract, and lets SlideCard's own test suite assert the CSS vars on its root without a Pinia instance."
  - "playCurrentMedia() in PresentationViewer's onMounted was moved to fire AFTER the font gate resolves (await waitForSlideFont(...); fontReady.value = true; await nextTick(); playCurrentMedia()) rather than before it, since the slide canvas — and the AudioPlayer/VideoPlayer refs it mounts — no longer exists synchronously at first render once the canvas is gated on fontReady."
  - "Replaced this plan's PresentationViewer.test.ts's 72 pre-existing 'await Promise.resolve()' calls with 'await flushPromises()' (a macrotask-based drain already imported in the file). The font gate's Promise.race/Promise.all chain needs more microtask ticks to settle than a single Promise.resolve() await guarantees, even when document.fonts resolves immediately by default — flushPromises' setImmediate/setTimeout(0) drain covers any number of hops without hand-tuning each of the ~90 existing call sites individually."

requirements-completed: [R093, R094]

coverage:
  - id: D1
    description: "SlideGrid's container and EditSlideDrawer's preview box each bind cssVarsFor(authStore.settings.slideTypography) as an inline :style wrapper with font-family set explicitly; scoped rules override font-weight/font-size on slide-card-body/drawer-preview-text via calc(base * var(--slide-font-scale))"
    requirement: "R093"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts, src/components/slides/__tests__/EditSlideDrawer.test.ts — 120 + 166 tests green, unchanged behavior"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts — 'slide-font CSS variables (46-04, R093)' — default Inter/400/md resolves to --slide-font-scale: 1; a non-default typographyStyle prop from the parent grid is reflected on the card's own root"
        status: pass
    human_judgment: false
  - id: D2
    description: "PresentationViewer's viewerRoot binds the same CSS-variable wrapper; scoped rules cover presentation-body (both its text-5xl and text-6xl variants), presentation-scripture-reference, presentation-speaker, presentation-congregational-section, presentation-copyright-fine-print, and the copyright authors line — the copyright title/authors' existing font-semibold hierarchy is left untouched (no weight override)"
    requirement: "R093"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts — 97 tests green (full existing suite, including the 'unified text-5xl size across every projected kind' and copyright-fine-print cases, unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PresentationViewer's R094 font-load gate: holds the existing 'Loading slideshow…' state and keeps the slide canvas absent until the chosen face's document.fonts.ready + document.fonts.load() both settle (or FONT_LOAD_TIMEOUT_MS elapses), on-demand loading a non-default curated face via loadFontCss first"
    requirement: "R094"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts § 'R094 presenter font-load gate' — 5 cases: holds/releases on the pending→resolved transition, proceeds after the bounded fake-timer timeout, triggers loadFontCss for a non-default family, never calls loadFontCss for the default family, and never gates the empty state (0 slides)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) clean; full app suite (npx vitest run --dir src --exclude '**/rules.test.ts') at the documented 2-file baseline (src/storage.rules.test.ts, RosterView.test.ts), 2898/2911 passing, no new failure"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manual-only projector verification (no fallback-font flash, per-family/size legibility, Large-scale long-line overflow) recorded as DEFERRED in PENDING-VERIFICATION.md § Phase 46, per the plan's own <verification> Manual-only table"
    human_judgment: true
    rationale: "jsdom cannot render real fonts, measure a real paint, or judge projection legibility/overflow at a human-visual level — these are the plan's own explicitly-designated manual-only items."

duration: 30min
completed: 2026-08-08
status: complete
---

# Phase 46 Plan 04: Render-Site Application & Presenter Font Gate Summary

**Wired the church's chosen slide typography (family/weight/scale) into the grid, drawer preview, and presenter — and gated the presenter's first paint on that font being resident (R094), closing UI-SPEC unresolved item #1 with a bounded 3000ms timeout.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-08T14:05:00-04:00 (approx, immediately after 46-03's completion commit)
- **Completed:** 2026-08-08T14:34:18-04:00
- **Tasks:** 3 (CSS-variable wrappers on 3 render sites; presenter font gate, tdd=true; presenter font-gate tests + SlideCard CSS-var assertions)
- **Files modified:** 8 source/test files + PENDING-VERIFICATION.md

## Accomplishments

- `SlideGrid.vue`'s container and `EditSlideDrawer.vue`'s preview box (the preview only, not the whole drawer chrome) each bind `cssVarsFor(authStore.settings.slideTypography)` as an inline `:style` wrapper with `font-family: var(--slide-font-family)` set explicitly so it inherits to every descendant slide-text element.
- `SlideCard.vue` receives its typography as an optional `typographyStyle` prop computed once by `SlideGrid.vue` and passed down, rather than importing the auth store itself — its existing "reads no store, calls no composable" contract survives, and the prop defaults to `cssVarsFor(undefined)`'s own Inter/400/md fallback so every standalone mount (its whole existing test suite) still shows the correct default.
- Scoped `<style>` blocks in `SlideCard.vue`, `EditSlideDrawer.vue`, and `PresentationViewer.vue` override `font-weight`/`font-size` on every primary slide-text element via `calc(<element's own existing Tailwind base size> * var(--slide-font-scale))` — unlayered scoped styles win over Tailwind's `@layer utilities` regardless of selector specificity, so the template's fixed Tailwind classes are never edited. `PresentationViewer.vue`'s `presentation-body` testid carries two distinct base sizes depending on slide kind (`text-5xl` for lyric/scripture/text, `text-6xl` for the copyright title) — targeted by combining the testid with the existing size class. The copyright title/authors' deliberate `font-semibold` hierarchy is left untouched (no weight override on those two elements or the fine-print line).
- `PresentationViewer.vue` gained a `fontReady` ref (initial `false`) and an `onMounted` font-load gate (R094): resolves the org's chosen family/weight against the curated `SLIDE_FONTS` registry (falling back to Inter/400 for an unknown family, snapping an unreachable weight to 400 via `snapWeight`), on-demand loads a non-default face via `loadFontCss` first (so its `@font-face` rule is registered before the browser is asked to resolve it), then awaits `waitForSlideFont(family, weight, FONT_LOAD_TIMEOUT_MS)` before flipping `fontReady` — always settles regardless of ready-vs-timeout, never leaves the presenter stuck.
- A new `fontGateActive` computed (`!fontReady && hasSlides`) is OR'd into a `showLoadingState` computed that the template's existing "Loading slideshow…" branch now renders for — the empty state (zero slides) is deliberately never gated, since there is nothing to flash when there is nothing to show. `exitVisible` was widened to stay reachable through the gate.
- `playCurrentMedia()` was moved to fire AFTER the font gate resolves and `nextTick()` settles, rather than before it, since the slide canvas — and the `AudioPlayer`/`VideoPlayer` refs it mounts — no longer exists synchronously at first render once gated on `fontReady`.
- Followed the task's `tdd="true"` flow: wrote the failing tests for the font gate first (confirmed 3 of them RED against the unmodified component, with the other ~94 pre-existing tests in the file unaffected), then implemented the gate and confirmed all 97 tests green.
- Added a default `document.fonts` stub (immediately-resolving `ready`/`load`) to the file's shared `beforeEach` so every pre-existing test keeps working unchanged, plus `@/stores/auth` and a partial `@/utils/slideTypography` mock (only `loadFontCss` mocked; `cssVarsFor`/`snapWeight`/`waitForSlideFont`/`FONT_LOAD_TIMEOUT_MS` stay real) so the gate's actual race/timeout logic is exercised by the new tests, not stood in for.
- `ServicePrintLayout.vue` was not touched — confirmed absent from every commit's diff (owner-locked exclusion, R093 success criterion 2).
- `npm run type-check` (`vue-tsc --build`) clean throughout. Full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`) at the documented 2-file baseline (`src/storage.rules.test.ts`, `RosterView.test.ts`) — 2898/2911 passing, no new failure introduced by this plan.

## Task Commits

1. **Task 1: Apply the slide-font CSS variables to the three render sites** - `e15a24b` (feat) — note: this commit also picked up the RED test additions to `PresentationViewer.test.ts` written ahead of Task 2 (a staging-order accident, not a scope violation — see Deviations).
2. **Task 2 RED: failing tests for the presenter font-load gate** - included in `e15a24b` above (see Deviations).
3. **Task 2 GREEN + Task 3: presenter font gate implementation + full font-gate test suite** - `1db8e7f` (feat)

**Plan metadata:** committed separately below (this commit).

## Files Created/Modified

- `src/components/PresentationViewer.vue` - CSS-variable wrapper, scoped per-element font-weight/font-size overrides, `fontReady`/`fontGateActive`/`showLoadingState`, `resolvedFontChoice()`, and the `onMounted` font-load gate
- `src/components/slides/SlideGrid.vue` - CSS-variable wrapper on the grid container; computes and passes `typographyStyle` down to each `SlideCard`
- `src/components/slides/SlideCard.vue` - optional `typographyStyle` prop (defaulted), bound on its own root; scoped `slide-card-body` font-weight/font-size override
- `src/components/slides/EditSlideDrawer.vue` - CSS-variable wrapper on the preview box only (merged via array `:style` with the existing background-image style); scoped `drawer-preview-text` font-weight/font-size override
- `src/components/__tests__/PresentationViewer.test.ts` - `@/stores/auth` + partial `@/utils/slideTypography` mocks, default `document.fonts` stub, 5 new font-gate test cases, and 72 `await Promise.resolve()` → `await flushPromises()` replacements
- `src/components/slides/__tests__/SlideCard.test.ts` - 2 new CSS-var presence/pass-through test cases
- `src/components/slides/__tests__/SlideGrid.test.ts`, `src/components/slides/__tests__/EditSlideDrawer.test.ts` - added `@/stores/auth` mocks
- `.planning/PENDING-VERIFICATION.md` - appended Plan 46-04's 3 manual-only projector-verification items under § Phase 46

## Decisions Made

- SlideCard.vue does not import `useAuthStore` itself — see key-decisions above (preserves its "reads no store" contract while staying testable in isolation).
- `playCurrentMedia()` reordering in `onMounted` — see key-decisions above (refs don't exist until the gated canvas mounts).
- Replaced this file's 72 `await Promise.resolve()` calls with `await flushPromises()` — see key-decisions above (the font gate's promise chain needs more than one microtask tick even in the default-resolved case).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue] Existing PresentationViewer.test.ts assertions broke against the gated component until switched to `flushPromises()`**
- **Found during:** Task 2 GREEN verification
- **Issue:** ~39 of the file's pre-existing tests failed once the font gate landed — they used a single `await Promise.resolve()` after `mount()`, which flushes only one microtask tick, while the gate's `Promise.race([Promise.all([...]).then(...), timeoutPromise])` chain needs several ticks to settle even when `document.fonts` resolves immediately by default.
- **Fix:** Replaced all 72 occurrences of `await Promise.resolve()` with `await flushPromises()` (already imported in the file; macrotask-based, drains the entire microtask queue regardless of chain depth).
- **Files modified:** `src/components/__tests__/PresentationViewer.test.ts`
- **Commit:** `1db8e7f`

**2. [Process note, not a defect] Task 1's and Task 2 RED's commits landed in one commit (`e15a24b`)**
- **Found during:** committing Task 1
- **Issue:** `PresentationViewer.test.ts`'s RED font-gate tests were staged (`git add`) before Task 1's grid/drawer/card commit was made, so they landed in that same commit rather than their own. The actual RED→GREEN sequence was still followed correctly (confirmed 3 failing tests against the unmodified component before implementing, per the `tdd="true"` flow) — only the commit boundary is imprecise, not the TDD discipline itself.
- **Fix:** Not re-split after the fact (would require a history rewrite, which the workflow prohibits) — documented here for transparency. `git show --stat e15a24b` shows exactly the grid/drawer/card files plus the test file's RED additions; `1db8e7f` is the clean GREEN commit.
- **Files modified:** none (record-only)
- **Commit:** `e15a24b`

## Known Stubs

None. All three render sites are fully wired to `authStore.settings.slideTypography` via `cssVarsFor`; the presenter's font gate is fully wired to `waitForSlideFont`/`loadFontCss`. Nothing in this plan renders from a hardcoded/mock value.

## Threat Flags

None beyond the plan's own declared `<threat_model>` (T-46-02, T-46-04), both of which are directly mitigated by the same `cssVarsFor`/`snapWeight` full-fallback and `waitForSlideFont`'s `Promise.race` this plan wires into the three render sites and the presenter gate — no new, undeclared security-relevant surface was introduced.

## Issues Encountered

None beyond the two documented deviations above.

## User Setup Required

None.

## Next Phase Readiness

Phase 46 (Global Slide Typography) is code-complete across all 4 plans (46-01 through 46-04). R093 and R094 are both fully wired end-to-end: the Settings card (46-03) is the single write point; the grid, drawer preview, and presenter (this plan) are pure readers; the presenter's first paint is gated on the chosen face being resident, with a bounded 3000ms fallback. The three manual-only projector-verification items (no font flash, per-family/size legibility, Large-scale overflow) are recorded in `PENDING-VERIFICATION.md § Phase 46` for the owner's hands-on pass. No blockers for the next phase.

---
*Phase: 46-global-slide-typography*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: src/components/PresentationViewer.vue
- FOUND: src/components/slides/SlideGrid.vue
- FOUND: src/components/slides/SlideCard.vue
- FOUND: src/components/slides/EditSlideDrawer.vue
- FOUND: src/components/__tests__/PresentationViewer.test.ts
- FOUND: src/components/slides/__tests__/SlideCard.test.ts
- FOUND: src/components/slides/__tests__/SlideGrid.test.ts
- FOUND: src/components/slides/__tests__/EditSlideDrawer.test.ts
- FOUND: .planning/PENDING-VERIFICATION.md
- FOUND commit: e15a24b
- FOUND commit: 1db8e7f
