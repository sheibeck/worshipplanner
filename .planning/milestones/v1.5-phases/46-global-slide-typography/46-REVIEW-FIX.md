---
phase: 46-global-slide-typography
fixed_at: 2026-08-08T19:30:00Z
review_path: .planning/phases/46-global-slide-typography/46-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 46: Code Review Fix Report

**Fixed at:** 2026-08-08T19:30:00Z
**Source review:** .planning/phases/46-global-slide-typography/46-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 Critical, 3 Warning, 2 Info — Info included per explicit task scope)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: SlideGrid/SlideCard/EditSlideDrawer apply a font-family that was never loaded

**Files modified:** `src/stores/auth.ts`, `src/stores/__tests__/auth.test.ts`
**Commit:** `ab6bc73`
**Applied fix:** `loadOrgContext` now eager-loads the org's resolved `slideTypography` family/weight (via `loadFontCss`, fire-and-forget with a `.catch` guard) immediately after the settings merge — the one point every render site's settings flow through, so `SlideGrid.vue` and `EditSlideDrawer.vue` (soft-gate surfaces per 46-UI-SPEC.md, `font-display: swap`) get the font's `@font-face` rule registered without needing Settings or the Presenter to have loaded it first in the session. Chose `auth.ts` over an `App.vue` watch (the review's other suggested insertion point) so the fix lands in a store method with existing, well-established test coverage rather than introducing a new, previously-untested component test file. Verified by 4 new test cases: no call for default Inter, correct family/weight for a non-default stored value, weight-snap applied before the call, and no call when the user belongs to no organization.

### CR-02: Presenter's R094 font-load gate has no error handling

**Files modified:** `src/components/PresentationViewer.vue`, `src/components/__tests__/PresentationViewer.test.ts`
**Commit:** `54fa900`
**Applied fix:** Wrapped `onMounted`'s font-load gate in `try/catch/finally`, and raced the *entire* load+wait sequence (not just `waitForSlideFont`'s internal timeout) against one shared `FONT_LOAD_TIMEOUT_MS` timeout via `Promise.race`. `fontReady.value = true` now runs unconditionally in `finally`, so a rejected `loadFontCss` (stale-chunk deploy, flaky Wi-Fi) or a rejected `document.fonts.load()` can never permanently strand the gate. Verified by 2 new tests: a rejected `loadFontCss` and a rejected `document.fonts.load()`, both asserting the presenter still renders. **Logic-fix caveat:** per the fixer's verification-strategy limitation, this is a control-flow/race-condition fix — tests pass and type-check is clean, but the race/finally semantics are flagged for a human sanity-check before the phase proceeds to verification.

### WR-01: Nested `slideTypography` object is shallow-merged at `loadOrgContext`

**Files modified:** `src/stores/auth.ts`, `src/stores/__tests__/auth.test.ts`
**Commit:** `30f6c75`
**Applied fix:** `loadOrgContext`'s settings merge now deep-merges `slideTypography` specifically (`{ ...DEFAULT_ORG_SETTINGS.slideTypography, ...orgSettings.slideTypography }`), alongside the existing top-level `...DEFAULT_ORG_SETTINGS, ...orgSettings` shallow spread. A partial/legacy stored value now resolves its missing leaf fields to their own defaults instead of `undefined`. Verified by a new test asserting `{ fontFamily: 'Poppins' }` alone (no `fontWeight`/`fontScale`) resolves to `{ fontFamily: 'Poppins', fontWeight: 400, fontScale: 'md' }`.

### WR-02: `waitForSlideFont` never resolves for a rejected `document.fonts.load()`

**Files modified:** `src/utils/slideTypography.ts`, `src/utils/__tests__/slideTypography.test.ts`
**Commit:** `77fc2b5`
**Applied fix:** The internal `load` promise's `.then(() => true)` became `.then(() => true, () => false)`, so a rejection resolves `false` (same as a timeout) instead of propagating a rejection through `Promise.race`. Verified by a new test that rejects `document.fonts.load()` and asserts the returned promise *resolves* `false` rather than rejecting.

### WR-03: `SettingsView.vue`'s family-change save fires an unguarded fire-and-forget `loadFontCss`

**Files modified:** `src/views/SettingsView.vue`, `src/views/__tests__/SettingsView.test.ts`
**Commit:** `d8edb71`
**Applied fix:** `onChangeSlideFontFamily` now chains `.catch(() => {})` onto the on-demand `loadFontCss(...)` call, matching the rest of the file's careful non-fatal-failure handling. Verified by a new test that rejects `loadFontCss` on a family change and asserts the save still completes (`"Saved!"` shown, `updateDoc` called once) with no thrown/unhandled rejection.

### IN-01: `waitForSlideFont`'s losing `setTimeout` is never cleared

**Files modified:** `src/utils/slideTypography.ts`
**Commit:** `f245246`
**Applied fix:** The timer id is now captured (`let timeoutId`) and `clearTimeout(timeoutId)` runs in a trailing `.then` once `Promise.race([load, timeout])` settles, so the losing side's timer no longer stays live for the rest of `timeoutMs` after the result is already known. Covered by the existing `waitForSlideFont` test suite (all pass unchanged); no new test needed since `clearTimeout` on an already-fired timer has no externally observable effect to assert on beyond "no regression," which the existing fake-timer tests already exercise.

### IN-02: Inconsistent CSS-variable value typing between the Settings preview and the render sites

**Files modified:** `src/views/SettingsView.vue`
**Commit:** `386184a`
**Applied fix:** `slideTypographyPreviewStyle` now spreads `cssVarsFor(...)`'s output unmodified (`...vars`) instead of re-typing `--slide-font-weight`/`--slide-font-scale` through `String(...)`, matching `PresentationViewer.vue`/`SlideGrid.vue`/`EditSlideDrawer.vue` exactly. Covered by the existing `SettingsView.test.ts` Slide Typography suite (all 31 tests pass unchanged); no test previously asserted the value's JS type, so there was nothing to update beyond confirming the DOM-level assertions still pass.

## Skipped Issues

None — all 7 in-scope findings were fixed.

## Verification

- `npm run type-check` (`vue-tsc --build`, includes test files per CLAUDE.md): clean after every fix.
- Targeted suites run after each fix: `auth.test.ts` (54 tests), `PresentationViewer.test.ts` (99 tests), `slideTypography.test.ts` (12 tests), `SettingsView.test.ts` (31 tests) — all passing.
- Full bare `npx vitest run`: 93/102 files passing, 2922/2935 tests passing (381.96s). 9 files failed:
  - `src/storage.rules.test.ts` (8 sub-failures) and `src/views/__tests__/RosterView.test.ts` (1) — the exact CLAUDE.md-documented 2-file baseline (Storage-emulator cross-service-read limitation; stale assertion). Unchanged by this fix pass.
  - `functions/src/backfillOrgClaims.test.ts`, `functions/src/index.test.ts`, `functions/src/orgMembershipClaims.test.ts`, `functions/src/pptxParser.test.ts`, `functions/src/renderInvoker.test.ts`, `render-service/src/render.test.ts`, `render-service/src/server.test.ts` — the same class of pre-existing tooling artifact CLAUDE.md calls out by name for `render-service/src/render.test.ts` (a separate npm workspace with its own Vitest version/config, collected by the root config's default recursive include glob rather than scoped out of it). None of this phase's 7 fixes touch `functions/` or `render-service/` — confirmed by `git diff` scoped to only `src/stores/auth.ts`, `src/components/PresentationViewer.vue`, `src/utils/slideTypography.ts`, `src/views/SettingsView.vue`, and their test files.
  - No new failing file was introduced by any of the 7 fixes above; the pre-fix and post-fix failing-file set is identical.

---

_Fixed: 2026-08-08T19:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
