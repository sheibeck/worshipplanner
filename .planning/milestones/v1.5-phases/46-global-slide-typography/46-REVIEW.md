---
phase: 46-global-slide-typography
reviewed: 2026-08-08T18:56:14Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - src/config/slideFonts.ts
  - src/types/organization.ts
  - src/utils/slideTypography.ts
  - src/main.ts
  - src/assets/main.css
  - src/views/SettingsView.vue
  - src/components/PresentationViewer.vue
  - src/components/slides/SlideGrid.vue
  - src/components/slides/SlideCard.vue
  - src/components/slides/EditSlideDrawer.vue
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: clean
fixed_at: 2026-08-08T19:30:00Z
fix_report: 46-REVIEW-FIX.md
---

# Phase 46: Code Review Report

**Reviewed:** 2026-08-08T18:56:14Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found — all 7 findings resolved, see `46-REVIEW-FIX.md` (fixed at 2026-08-08T19:30:00Z)

## Summary

The registry (`slideFonts.ts`), the OrgSettings contract (`organization.ts`), and the pure
helper functions (`slideTypography.ts`) are solid: the license/weight table was independently
re-verified against the actually-installed `node_modules/@fontsource/*` packages (all five
OFL-1.1, all weight claims correct including the two UI-SPEC corrections), `cssVarsFor`/
`snapWeight` have a genuinely defensive full-fallback posture that blocks free-text injection
into the `font-family` CSS variable or the `document.fonts.load()` template string, and
`ServicePrintLayout.vue` is confirmed absent from every phase-46 commit's diff.

However, tracing the font-CSS-loading call graph across all three render sites surfaced a
significant functional gap that the phase's own SUMMARY claims are closed but the code does
not actually close: **`loadFontCss` — the mechanism that registers a non-default family's
`@font-face` rule with the browser — is only ever called from `PresentationViewer.vue` and
`SettingsView.vue`. `SlideGrid.vue`, `SlideCard.vue`, and `EditSlideDrawer.vue` set the
`--slide-font-family` CSS variable to the org's chosen family name but never ensure that
family's stylesheet has been loaded**, so for any org whose chosen font differs from the
eager-loaded default (Inter), the grid and drawer will silently render in a system fallback
font on any page load where the user has not already visited Settings or the Presenter in
that same session — which is the common case, since editors typically build slides before
presenting. Separately, the presenter's own R094 gate has no `try/catch` around its
`loadFontCss`/`waitForSlideFont` chain, so a rejected dynamic CSS import (a well-documented
Vite failure mode after a stale-chunk deploy or a flaky connection) permanently strands
`fontReady` at `false`, hanging "Loading slideshow…" forever — the exact catastrophic failure
R094 exists to prevent, and a scenario the test suite cannot catch because it mocks
`loadFontCss` to always resolve.

## Critical Issues

### CR-01: SlideGrid/SlideCard/EditSlideDrawer apply a font-family that was never loaded — grid and drawer silently show the wrong font for any non-default org choice

**RESOLVED** (commit `ab6bc73`, see `46-REVIEW-FIX.md`) — `src/stores/auth.ts::loadOrgContext` now eager-loads the org's resolved `slideTypography` family/weight (fire-and-forget, `.catch`-guarded) right after the settings merge, the single point every render site's settings flow through. Verified by 4 new `auth.test.ts` cases.

**File:** `src/components/slides/SlideGrid.vue:407-410`, `src/components/slides/SlideCard.vue:169-200`, `src/components/slides/EditSlideDrawer.vue:600-603`

**Issue:** All three of these components bind `cssVarsFor(authStore.settings.slideTypography)`,
which correctly produces `'--slide-font-family': '"Lora", ui-serif, Georgia, serif'` (or
whichever family the org picked) — but none of them ever call `loadFontCss()` to actually
fetch/register that family's `@font-face` rule. The ONLY two places in the whole app that call
`loadFontCss` are `PresentationViewer.vue`'s `onMounted` (confirmed via `grep -rln
"loadFontCss" src/`) and `SettingsView.vue`'s family-change handler. `main.ts` only ever
eager-imports `@fontsource/inter/400.css` — the hardcoded default, not the org's actual choice.

Consequence: for any org whose `slideTypography.fontFamily` is not `Inter`, on a page load
where the current browser session has not already (a) opened Settings and previewed/changed
that family, or (b) opened the Presenter (which triggers its own on-demand load) — the grid
and the Edit Slide drawer preview apply `font-family: "Lora", ui-serif, Georgia, serif` to an
unregistered font name. The browser has no matching `@font-face` and (barring the rare case of
a locally-installed system font with that exact name) silently falls through to the generic
fallback (`ui-serif`/`Georgia`/system serif), NOT the chosen family. This is the app's two most
commonly used slide-editing surfaces — staff routinely build/edit slides in the Grid and Drawer
long before ever opening the Presenter — so this is not a rare edge case, it is close to the
default path for any church that picks a non-Inter family. This breaks R093 success criterion 2
("applies to every slide … the Slides grid, the Edit Slide drawer preview, and the presenter
all match") for exactly the two surfaces the UI-SPEC itself worried about getting this wrong
("leaving them out would make the Settings card's live preview a lie for two of the three
surfaces" — the CSS-variable wiring is present, but the underlying font asset was never
fetched).

**Fix:** Eager-load the org's actual chosen face once `authStore.settings.slideTypography` is
known — the natural point is a one-time call inside `loadOrgContext` (or a top-level `watch`
on `authStore.settings.slideTypography` set up once in `App.vue`) that calls
`loadFontCss(family, snapWeight(family, weight))` whenever the resolved family differs from the
`main.ts` eager default, so every render site benefits without each one having to import the
store and call it redundantly:
```ts
// e.g. in App.vue's onMounted, or inside loadOrgContext right after settings.value is set
watch(
  () => authStore.settings.slideTypography,
  (typography) => {
    const family = SLIDE_FONTS[typography.fontFamily] ? typography.fontFamily : 'Inter'
    if (family !== 'Inter') {
      void loadFontCss(family, snapWeight(family, typography.fontWeight))
    }
  },
  { immediate: true },
)
```

---

### CR-02: Presenter's R094 font-load gate has no error handling — a rejected `loadFontCss`/`waitForSlideFont` permanently hangs "Loading slideshow…"

**RESOLVED — requires human verification** (commit `54fa900`, see `46-REVIEW-FIX.md`) — `PresentationViewer.vue`'s `onMounted` gate now wraps the whole load+wait sequence in `Promise.race([...], timeout)` plus `try/catch/finally`, so `fontReady` always ends up `true`. Verified by 2 new tests exercising a rejected `loadFontCss` and a rejected `document.fonts.load()`. Logic-bug class fix — flagged for a human sanity-check of the race/finally semantics, per the fixer's verification-strategy limitation.

**File:** `src/components/PresentationViewer.vue:909-922`

**Issue:**
```ts
const { family, weight } = resolvedFontChoice()
if (family !== DEFAULT_FONT_FAMILY || weight !== DEFAULT_FONT_WEIGHT) {
  await loadFontCss(family, weight)
}
await waitForSlideFont(family, weight, FONT_LOAD_TIMEOUT_MS)
fontReady.value = true
```
Neither `await` is wrapped in `try/catch`. `loadFontCss` resolves a dynamic `import()` of a CSS
chunk (`src/utils/slideTypography.ts:141-145`) — Vite's dynamic-import machinery rejects that
promise on a failed chunk fetch (a very real, well-documented occurrence after a fresh deploy
replaces hashed filenames while an old tab is still open, or on any transient network error on
a church's venue Wi-Fi/hotspot). `waitForSlideFont` itself can also reject if the underlying
`document.fonts.load()` call rejects (its `Promise.all([...]).then(() => true)` has no
`.catch`, so a rejection propagates through `Promise.race` before the timeout branch ever gets
a chance to resolve).

If either promise rejects, the `await` throws inside this `onMounted` async callback. Vue does
not await/catch a component's `onMounted` return value, so the exception becomes an unhandled
rejection and — critically — `fontReady.value = true` is never reached. `showLoadingState`
(`fontGateActive.value = !fontReady.value && hasSlides.value`) stays permanently `true`,
so the presenter is stuck on "Loading slideshow…" for the rest of the service, with no timeout,
retry, or fallback. This is precisely the catastrophic failure mode R094 (and this component's
own `FONT_LOAD_TIMEOUT_MS` /"bounded degradation" design) exists to prevent, and it directly
contradicts 46-04-SUMMARY.md's own claim ("always settles regardless of ready-vs-timeout,
never leaves the presenter stuck"). It is untested: `PresentationViewer.test.ts` mocks
`loadFontCss: vi.fn().mockResolvedValue(undefined)` (line 35) and only exercises the
never-resolving (not rejecting) case for `document.fonts.load`, so this failure path has zero
test coverage.

Separately (same code, related defect): even on the happy path, the total delay before first
paint for a non-default family is `loadFontCss`'s network-fetch time (completely unbounded) PLUS
up to `FONT_LOAD_TIMEOUT_MS` (3000ms) for `waitForSlideFont` — the two are sequential `await`s,
not raced together, so the advertised "bounded 3000ms" guarantee only actually applies to the
`waitForSlideFont` half of the chain, not the on-demand load that precedes it for every
non-default family.

**Fix:** Wrap the whole gate in `try/catch`/`finally` (or race the *entire* sequence, including
`loadFontCss`, against one shared timeout) so `fontReady` always ends up `true` no matter what
fails:
```ts
try {
  const { family, weight } = resolvedFontChoice()
  await Promise.race([
    (async () => {
      if (family !== DEFAULT_FONT_FAMILY || weight !== DEFAULT_FONT_WEIGHT) {
        await loadFontCss(family, weight)
      }
      await waitForSlideFont(family, weight, FONT_LOAD_TIMEOUT_MS)
    })(),
    new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS)),
  ])
} catch {
  // A rejected dynamic import / font-load call must never leave the presenter
  // stuck — degrade to "render anyway", same as a timeout.
} finally {
  fontReady.value = true
}
```
Also add `.catch(() => true)` inside `waitForSlideFont`'s own `load` promise so a rejection
there resolves `false` rather than propagating through `Promise.race`.

## Warnings

### WR-01: Nested `slideTypography` object is shallow-merged at the single `loadOrgContext` point — a partial/legacy stored value silently drops sibling fields

**RESOLVED** (commit `30f6c75`, see `46-REVIEW-FIX.md`) — `loadOrgContext` now deep-merges `slideTypography` specifically: `{ ...DEFAULT_ORG_SETTINGS.slideTypography, ...orgSettings.slideTypography }`. Verified by a new `auth.test.ts` case asserting a partial stored value resolves its missing leaf fields to defaults.

**File:** `src/stores/auth.ts:201-205`, `src/views/SettingsView.vue:546-548`

**Issue:** `settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings }` is a *shallow* merge.
`slideTypography` is the first nested-object `OrgSettings` field this codebase has effectively
exercised end-to-end with a picker UI; if Firestore ever holds a partial value for it (e.g. a
hand-edited document, or any future code path that writes fewer than all three leaf keys), the
whole `slideTypography` object is replaced wholesale rather than deep-merged with the default —
`fontWeight`/`fontScale` end up `undefined` rather than falling back to `400`/`'md'`. The three
render sites are protected because `cssVarsFor` independently validates all three fields and
fully falls back to Inter/400/md if any one is invalid (T-46-03's stated mitigation) — but
`SettingsView.vue`'s local refs are initialized directly with no equivalent guard:
```ts
const slideFontWeightInput = ref(authStore.settings.slideTypography.fontWeight)  // could be undefined
const slideFontScaleInput = ref(authStore.settings.slideTypography.fontScale)    // could be undefined
```
An `undefined` value bound to the weight `<select v-model.number>` or the scale radio group
renders with no option selected/checked, a visibly broken control, even though the app itself
never currently produces this shape (all three leaf paths are always written together in one
`updateDoc` call — see `saveSlideTypography`).

**Fix:** Either deep-merge `slideTypography` specifically at the `loadOrgContext` merge point
(`slideTypography: { ...DEFAULT_ORG_SETTINGS.slideTypography, ...orgSettings.slideTypography }`),
or give the `SettingsView.vue` refs the same defensive fallback `cssVarsFor` already has:
```ts
const slideFontWeightInput = ref(authStore.settings.slideTypography.fontWeight ?? 400)
```

### WR-02: `waitForSlideFont` never returns `false`/resolves for a rejected `document.fonts.load()` — the "bounded, never hangs" contract is only true for a stalled load, not a failed one

**RESOLVED** (commit `77fc2b5`, see `46-REVIEW-FIX.md`) — the internal `load` promise now has a `(() => true, () => false)` handler pair, so a rejection resolves `false` instead of propagating through `Promise.race`. Verified by a new `slideTypography.test.ts` case.

**File:** `src/utils/slideTypography.ts:118-121`

**Issue:**
```ts
const load = Promise.all([
  document.fonts.ready,
  document.fonts.load(`${weight} 1em "${family}"`),
]).then(() => true)
```
If `document.fonts.load()` rejects, `load` becomes a rejected promise with no `.catch`, and
`Promise.race([load, timeout])` (line 127) will reject with that error if it settles before the
timeout does — the function's documented contract ("resolves `false` … rather than hanging the
caller's loading state indefinitely") silently does not hold for the reject case, only the
never-settles case. Compounds directly into CR-02 above.

**Fix:**
```ts
const load = Promise.all([
  document.fonts.ready,
  document.fonts.load(`${weight} 1em "${family}"`),
]).then(
  () => true,
  () => false, // a rejected load is a failed load — degrade the same as a timeout
)
```

### WR-03: `SettingsView.vue`'s family-change save fires a fire-and-forget `loadFontCss` with no `.catch`

**RESOLVED** (commit `d8edb71`, see `46-REVIEW-FIX.md`) — `onChangeSlideFontFamily` now chains `.catch(() => {})` onto the on-demand `loadFontCss` call. Verified by a new `SettingsView.test.ts` case asserting a rejected load neither throws nor blocks the save.

**File:** `src/views/SettingsView.vue:1003-1007`

**Issue:** `void loadFontCss(slideFontFamilyInput.value, snapped)` — a genuinely failed dynamic
import here (same class of failure as CR-02) produces an unhandled promise rejection logged to
the console on every affected family switch. It's not user-visible (the CSS stack's native
fallback still covers the Preview box per the UI-SPEC's own covered "error" row), but it is an
unnecessary unhandled-rejection surface for something this codebase is otherwise careful about
(every other async handler in this file wraps its await in `try/catch`).

**Fix:** `loadFontCss(slideFontFamilyInput.value, snapped).catch(() => {})` or route it through
the same `console.error(...)` pattern the rest of the file uses for non-fatal async failures.

## Info

### IN-01: `waitForSlideFont`'s losing `setTimeout` is never cleared

**RESOLVED** (commit `f245246`, see `46-REVIEW-FIX.md`) — the timer id is captured and `clearTimeout`'d once `Promise.race` settles, via a trailing `.then`.

**File:** `src/utils/slideTypography.ts:123-125`

**Issue:** The `timeout` promise's `setTimeout` keeps running for the full `timeoutMs` even
after `load` wins the `Promise.race` — harmless (it just resolves an already-irrelevant
promise) but leaves a live timer for up to 3000ms on every single presenter mount for no
purpose once the real result is already known.

**Fix:** Capture the timer id and `clearTimeout` it once `load` resolves, e.g. via a
`finally`-style wrapper, or accept it as intentionally out of scope given the low cost.

### IN-02: Inconsistent CSS-variable value typing between the Settings preview and the three render sites

**RESOLVED** (commit `386184a`, see `46-REVIEW-FIX.md`) — `slideTypographyPreviewStyle` now spreads `cssVarsFor`'s output unmodified (`...vars`), dropping both `String(...)` calls, matching the other three call sites exactly.

**File:** `src/views/SettingsView.vue:565-579` vs. `src/components/PresentationViewer.vue:423-426`, `src/components/slides/SlideGrid.vue:407-410`, `src/components/slides/EditSlideDrawer.vue:600-603`

**Issue:** The three render sites spread `cssVarsFor(...)` directly, binding
`'--slide-font-weight'`/`'--slide-font-scale'` as raw numbers (per `cssVarsFor`'s own return
type). `SettingsView.vue`'s live-preview style instead explicitly stringifies both
(`String(vars['--slide-font-weight'])`). Both work (the DOM's `CSSStyleDeclaration.setProperty`
WebIDL binding coerces either), but the plan's own stated intent is that the Preview "binds the
SAME `cssVarsFor`" the render sites use "so the preview always matches exactly" — the
gratuitous re-typing is a needless divergence from that single-source-of-truth claim.

**Fix:** Drop the `String(...)` calls in `slideTypographyPreviewStyle` and pass `cssVarsFor`'s
output through unmodified, matching the other three call sites exactly.

---

_Reviewed: 2026-08-08T18:56:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
