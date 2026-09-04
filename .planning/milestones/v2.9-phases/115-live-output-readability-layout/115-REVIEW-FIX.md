---
phase: 115-live-output-readability-layout
fixed_at: 2026-09-04T02:36:41-04:00
review_path: .planning/phases/115-live-output-readability-layout/115-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 115: Code Review Fix Report

**Fixed at:** 2026-09-04T02:36:41-04:00
**Source review:** .planning/phases/115-live-output-readability-layout/115-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01, WR-02, WR-03, IN-01, IN-02)
- Fixed: 4
- Skipped: 1 (behavior-preservation call, per explicit guidance)

## Fixed Issues

### WR-01: `useSlideAutoFit`'s ResizeObserver is silently never installed if `frameRef` is null at mount

**Files modified:** `src/composables/useSlideAutoFit.ts`, `src/composables/__tests__/useSlideAutoFit.test.ts`
**Commit:** 8aeda02a
**Applied fix:** Replaced the `onMounted`-gated observer-attach in both `useSlideAutoFit` and `useContainScale` with `watch(ref, ..., { immediate: true, flush: 'post' })`, which disconnects any prior observer, reinstalls it on the current element (if present), and re-runs `measure()` whenever `frameRef`/`containerRef` attaches or changes — not only once at mount. `onBeforeUnmount` still disconnects. Updated both doc comments to describe the new re-measure conditions accurately. Removed the now-unused `onMounted` import. Added a `LateFitHost`/`LateContainHost` regression test pair (toggling a `visible` prop to defer the ref's first attach past mount) asserting the composable still degrades to `DEFAULT_FIT_SCALE` and never throws when the element attaches late — jsdom has no layout engine so this covers the never-throws/no-observer-loss contract, not real measured scales (covered by the existing integration tests and hardware UAT per the file's own test-strategy comment).

### WR-03: Stale `--slide-font-scale` CSS variable left declared in `main.css`

**Files modified:** `src/assets/main.css`
**Commit:** 6fd5f8e8
**Applied fix:** Deleted the `--slide-font-scale: 1;` line from `:root`. Verified via `grep -rn slide-font-scale src` before deleting that no remaining reference reads `var(--slide-font-scale)` — the only hits left are a rationale comment in `useSlideAutoFit.ts`, two explanatory comments in `SlideCanvas.vue`, and stale `data-testid` strings in `SettingsView.test.ts` asserting the old setting's removal, none of which are CSS var reads.

### IN-01: Stale "Inter/400/md fallback" comment in `SlideCard.vue`

**Files modified:** `src/components/slides/SlideCard.vue`
**Commit:** 4aa04b81
**Applied fix:** Reworded the `typographyStyle` prop doc from "Defaults to `cssVarsFor`'s own Inter/400/md fallback…" to "Defaults to `cssVarsFor`'s own Inter/400 fallback…", matching `slideTypography.ts`'s current contract (fontScale/'md' were removed this phase).

### IN-02: `REFERENCE_WIDTH`/`REFERENCE_HEIGHT` re-declared as local literals instead of imported

**Files modified:** `src/components/run/RunFilmstrip.vue`, `src/components/run/RunPreviewPair.vue`
**Commit:** 5c2f1384
**Applied fix:** Both components now `import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from '@/composables/useSlideAutoFit'` instead of redeclaring local `const REFERENCE_WIDTH = 1280` / `const REFERENCE_HEIGHT = 720`, matching the pattern already used by `AudienceOutputView.vue`/`ConfidenceOutputView.vue`. Values were confirmed identical (canonical 1280x720) before the swap. `RunFilmstrip.vue`'s comment above `THUMB_WIDTH` was updated to note the import; `RunPreviewPair.vue`'s now-redundant local doc comment (which just restated `useSlideAutoFit.ts`'s own rationale) was removed in favor of the import.

## Skipped Issues

### WR-02: `RunPreviewPair.vue` reimplements `useContainScale` instead of reusing it

**File:** `src/components/run/RunPreviewPair.vue:169-195`
**Reason:** skipped — behavior differs (width-only vs contain), out of scope for a review fix. Verified by reading the actual code: `RunPreviewPair`'s private `useScaleToFit()` computes `scale.value = width / REFERENCE_WIDTH` (width ratio only), whereas `useContainScale`/`computeContainScale` compute `Math.min(containerW / refW, containerH / refH)` (min of both ratios — true "contain"). The two are numerically identical *only* because both `currentBox`/`nextBox` panes are constrained `aspect-video` (16:9), exactly matching `REFERENCE_WIDTH`/`REFERENCE_HEIGHT`'s ratio — but that equivalence is an environmental coincidence of the current CSS, not a property of the two functions. Swapping to `useContainScale` would be a behavior change disguised as a DRY refactor (correctness/behavior preservation takes priority per the fix instructions), so the local composable was left in place. `IN-02`'s constant-import part of this file was still applied (see above), and a short comment was added above `useScaleToFit()` explaining the skip and pointing back at this finding for the next person who touches it.
**Original issue:** `RunPreviewPair.vue` duplicates `useContainScale`'s ResizeObserver lifecycle in a private `useScaleToFit()`, so a future fix to the shared composable would not propagate here, and it also carries the same "observer only attaches if the ref is truthy at mount" pattern as WR-01 (currently dormant since `currentBox`/`nextBox` are unconditionally rendered, not gated behind `v-if`).

## Verification

- `npm run type-check` (vue-tsc --build): clean, no errors.
- `npx vitest run src/composables/__tests__/useSlideAutoFit.test.ts src/components/run/__tests__/RunFilmstrip.test.ts src/components/run/__tests__/RunPreviewPair.test.ts src/components/slides/__tests__/SlideCard.test.ts`: 4 files, 69 tests, all passing.
- `npx vitest run` (full suite): 186 files, 5040 passed / 27 skipped, 1 file failing — `src/storage.rules.test.ts` (`ECONNREFUSED 127.0.0.1:8080`, no Storage emulator running), which is the documented pre-existing baseline failure per `CLAUDE.md`, not a regression introduced by these fixes.

---

_Fixed: 2026-09-04T02:36:41-04:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
