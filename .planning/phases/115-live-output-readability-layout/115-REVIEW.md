---
phase: 115-live-output-readability-layout
reviewed: 2026-09-04T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/composables/useSlideAutoFit.ts
  - src/composables/useRunControl.ts
  - src/components/run/RunFilmstrip.vue
  - src/components/run/RunPreviewPair.vue
  - src/components/slides/SlideCanvas.vue
  - src/components/slides/SlideCard.vue
  - src/components/slides/EditSlideDrawer.vue
  - src/views/AudienceOutputView.vue
  - src/views/ConfidenceOutputView.vue
  - src/views/RunControlView.vue
  - src/views/SettingsView.vue
  - src/utils/slideTypography.ts
  - src/types/organization.ts
  - src/assets/main.css
  - src/composables/__tests__/useSlideAutoFit.test.ts
  - src/components/run/__tests__/RunFilmstrip.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 115: Code Review Report

**Reviewed:** 2026-09-04
**Depth:** standard
**Files Reviewed:** 16 (of the 28 changed files in scope; the remainder were mechanical fixture-only test diffs, verified via `git diff` and spot-checked, with no additional findings)
**Status:** issues_found

## Summary

Reviewed the auto-fit engine (`computeFitScale`/`computeContainScale`/`useSlideAutoFit`/`useContainScale`), its wiring into `SlideCanvas.vue`, `AudienceOutputView.vue`, `ConfidenceOutputView.vue`, `RunPreviewPair.vue`, `RunFilmstrip.vue`, the `useRunControl.ts` R331 `deriveNextItemLabel` addition, and the mechanical `--slide-font-scale` → auto-fit removal across `SettingsView.vue`, `slideTypography.ts`, `organization.ts`, `SlideCard.vue`, and `EditSlideDrawer.vue`.

The core fit math (`computeFitScale`'s binary search, `computeContainScale`'s min-ratio letterbox) is correct and well-guarded against NaN/zero/negative inputs, and traced no layout-thrash-induced infinite loop: `frameRef` (the element the `ResizeObserver` watches) never changes size as a side effect of the `contentRef` mutations `measure()` performs during the binary search, so there is no observer feedback loop. The final DOM write in `measure()` happens before the reactive `scale.value` assignment, so Vue's virtual-DOM style diffing can never leave the DOM stuck on an intermediate binary-search trial value. All spot-run tests pass (`useSlideAutoFit.test.ts`, `RunFilmstrip.test.ts`, `RunPreviewPair.test.ts`, `SlideCanvas.test.ts` — 40/40).

Issues found are all quality/robustness gaps, not functional regressions in the shipped call sites (every production usage happens to route through the affected code paths safely today). No critical/security issues found.

## Warnings

### WR-01: `useSlideAutoFit`'s ResizeObserver is silently never installed if `frameRef` is null at mount

**File:** `src/composables/useSlideAutoFit.ts:129-135`
**Issue:** The `ResizeObserver` is created and attached only inside `onMounted`, gated on `frameRef.value` being truthy at that exact moment:
```ts
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && frameRef.value) {
    observer = new ResizeObserver(() => measure())
    observer.observe(frameRef.value)
  }
})
```
`onMounted` fires exactly once. If a consumer mounts `SlideCanvas` while `frameRef`'s backing element is not yet in the DOM (e.g. `<SlideCanvas v-if="someLaterCondition">`, or any future call site that renders the component before its `slide` prop resolves), the observer is permanently skipped for that instance's lifetime — later container/window resizes will never re-trigger `measure()`, and the slide's text will stay locked at whatever scale (or the `DEFAULT_FIT_SCALE` fallback) was computed at mount. The doc comment on `useSlideAutoFit` promises "Re-measured on mount, on `retrigger()`, and via a feature-detected ResizeObserver on the frame" — this is not always true.

Every current production call site (`AudienceOutputView.vue`, `ConfidenceOutputView.vue` — both `v-if="currentSlide && fontReady"` around the wrapping stage; `RunPreviewPair.vue` — `v-if="current"`/`v-if="next"`; `RunFilmstrip.vue` — always a real slide) happens to only mount `SlideCanvas` once `slide` is already non-null, so Vue never creates the component instance with a null slide and this gap is currently dormant. It is untested (`useSlideAutoFit.test.ts`'s composable-shell tests always mount the host with the ref present) and will resurface silently the next time someone reuses this composable or `SlideCanvas` in a context that mounts before the slide resolves.
**Fix:** Re-attempt observer attachment inside `measure()`/`retrigger()` (or add a `watch(frameRef, ...)` that (re)installs the observer whenever the element becomes available), e.g.:
```ts
watch(frameRef, (el, _old, onCleanup) => {
  observer?.disconnect()
  observer = null
  if (typeof ResizeObserver !== 'undefined' && el) {
    observer = new ResizeObserver(() => measure())
    observer.observe(el)
  }
  onCleanup(() => observer?.disconnect())
})
```

### WR-02: `RunPreviewPair.vue` reimplements `useContainScale` instead of reusing it

**File:** `src/components/run/RunPreviewPair.vue:169-195`
**Issue:** This phase built `useContainScale` (in `useSlideAutoFit.ts`) specifically as the shared scale-to-contain composable, and both `AudienceOutputView.vue` and `ConfidenceOutputView.vue` correctly import and use it. `RunPreviewPair.vue` instead keeps its own private `useScaleToFit()` with near-identical ResizeObserver lifecycle code, duplicated inline:
```ts
function useScaleToFit() {
  const boxRef = ref<HTMLElement | null>(null)
  const scale = ref(1)
  let observer: ResizeObserver | null = null
  function measure() {
    const el = boxRef.value
    if (!el) return
    const width = el.clientWidth
    if (width > 0) scale.value = width / REFERENCE_WIDTH
  }
  onMounted(() => { ... })
  onBeforeUnmount(() => { ... })
  return { boxRef, scale }
}
```
This is a width-only scale (not `computeContainScale`'s min-of-both-ratios), which happens to be equivalent here only because the panes are constrained to `aspect-video` matching the 1280×720 reference ratio exactly. It also duplicates the exact `ResizeObserver` lifecycle bug pattern from WR-01 (observer only attaches if `boxRef.value` is truthy at mount) — `currentBox`/`nextBox` are unconditional in this component so it's not currently triggered, but a future edit that wraps either box in a `v-if` would silently reintroduce WR-01 here too. Any future fix to `computeContainScale`/`useContainScale` (e.g. correcting an edge case) will not propagate to this component.
**Fix:** Replace the local `useScaleToFit()` with the shared `useContainScale()` from `@/composables/useSlideAutoFit`, matching the pattern already used in `AudienceOutputView.vue`/`ConfidenceOutputView.vue`.

### WR-03: Stale `--slide-font-scale` CSS variable left declared in `main.css`

**File:** `src/assets/main.css:26`
**Issue:** `:root` still declares:
```css
:root {
  --slide-font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --slide-font-weight: 400;
  --slide-font-scale: 1;
}
```
This phase removed every reader of `--slide-font-scale` (`SlideCanvas.vue`, `SlideCard.vue`, and `EditSlideDrawer.vue` were all migrated to `--slide-fit-scale` or a fixed literal size in this same phase — confirmed via `grep -r 'slide-font-scale'`, the only remaining hits are this declaration, the two explanatory comments in `SlideCanvas.vue`, and stale test IDs asserting the setting's removal). Leaving the fallback declared here is confusing dead code: a future reader will reasonably assume something still consumes it, and might reintroduce a font-scale consumer expecting this global default to matter, when in fact every actual render path is on the auto-fit engine now.
**Fix:** Delete the `--slide-font-scale: 1;` line (and update the block comment above it, which still says "Slide typography CSS variables" — fine — but no longer needs to account for a third leaf).

## Info

### IN-01: Stale "Inter/400/md fallback" comment in `SlideCard.vue`

**File:** `src/components/slides/SlideCard.vue:201`
**Issue:** The `typographyStyle` prop doc still reads:
```
* Defaults to `cssVarsFor`'s own Inter/400/md fallback so every
```
`fontScale`/`'md'` was removed from `cssVarsFor`'s contract by this phase (`src/utils/slideTypography.ts`), so the default is now just Inter/400. The comment was not updated even though the adjacent `<style>` block's comment three lines above the diff (`Size is fixed (R329) — the manual scale multiplier is retired...`) was correctly added — this one reference was missed.
**Fix:** Reword to "Defaults to `cssVarsFor`'s own Inter/400 fallback...".

### IN-02: `REFERENCE_WIDTH`/`REFERENCE_HEIGHT` re-declared as local literals instead of imported

**File:** `src/components/run/RunFilmstrip.vue:94-95`, `src/components/run/RunPreviewPair.vue:147-148`
**Issue:** `useSlideAutoFit.ts` exports `REFERENCE_WIDTH`/`REFERENCE_HEIGHT` (1280/720) precisely so every consumer shares one source of truth (`AudienceOutputView.vue` and `ConfidenceOutputView.vue` both correctly `import { ... REFERENCE_WIDTH, REFERENCE_HEIGHT } from '@/composables/useSlideAutoFit'`). `RunFilmstrip.vue` and `RunPreviewPair.vue` instead each redeclare their own local `const REFERENCE_WIDTH = 1280` / `const REFERENCE_HEIGHT = 720`. Comments in both files assert these "must stay in sync," but nothing enforces it — a future change to the canonical constants (e.g. widening the reference stage) would silently desync these two call sites' thumbnail/preview scaling from the real output views.
**Fix:** Import `REFERENCE_WIDTH`/`REFERENCE_HEIGHT` from `@/composables/useSlideAutoFit` in both files instead of the local literals.

---

_Reviewed: 2026-09-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
