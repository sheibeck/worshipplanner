---
phase: 46-global-slide-typography
verified: 2026-08-08T19:59:46Z
status: human_needed
score: 18/18 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "No fallback-font flash mid-service (R094)"
    expected: "On a real projector, presenting a service shows the chosen font resident on the first slide — no visible swap from a fallback face."
    why_human: "jsdom cannot render real fonts or measure a real paint; the flash is a projector-visible timing effect. The gate logic itself (hold until ready, release on resolve/timeout/rejection) is proven by 8 passing automated tests in PresentationViewer.test.ts, but the real-font-swap absence is a visual/hardware judgment."
  - test: "Projection legibility of each curated family/weight/size (R093)"
    expected: "Each of the five curated families, at each of the three weights and three sizes a church might pick, is readable at typical projection distance."
    why_human: "Legibility at projection distance is a human visual judgment; jsdom has no rendering surface to measure this."
  - test: "Long-line overflow at Large (1.25) scale (R093, UI-SPEC unresolved item #2)"
    expected: "An already-long lyric/scripture line at Large scale on a real projector overflows acceptably (no auto-fit is in scope; a worse-than-today overflow would need follow-up)."
    why_human: "Overflow is a projector-visible layout effect; REQUIREMENTS.md explicitly puts shrink-to-fit/auto-fit out of scope for this phase, so this is a recorded human check, not a coded behavior."
---

# Phase 46: Global Slide Typography Verification Report

**Phase Goal:** A church sets one house font — family, weight, and size — for every slide, and the presenter never renders a visible fallback font.
**Verified:** 2026-08-08T19:59:46Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Five curated families installed as self-hosted `@fontsource` woff2 packages, never the runtime Google Fonts API | ✓ VERIFIED | `package.json` lines 21–25: `@fontsource/{inter,lora,open-sans,poppins,source-serif-4}` all `^5.3.0`; no Google Fonts API/`<link>` reference anywhere in the diff |
| 2 | Every family ships a license read from that package's own LICENSE file, not assumed by analogy | ✓ VERIFIED | `src/config/slideFonts.ts` JSDoc documents the direct LICENSE-file verification; `slideFonts.test.ts` (8/8 passing) asserts `license === 'OFL-1.1'` + non-empty `licenseUrl` on all 5 entries |
| 3 | The longest curated name (Source Serif 4) fits a native `<select>` option with no custom overflow handling | ✓ VERIFIED | `SettingsView.vue` renders a plain native `<option v-for="name in SLIDE_FONT_FAMILY_NAMES">` — no custom dropdown component; UI-SPEC records this as covered |
| 4 | `OrgSettings.slideTypography` field + `DEFAULT_ORG_SETTINGS` default, extended at the single `loadOrgContext` merge point (no second defaults-merge point) | ✓ VERIFIED | `src/types/organization.ts:93-97,157-161`; `src/stores/auth.ts:212-220` — one merge site, with `slideTypography` specifically deep-merged (WR-01 fix) alongside the existing top-level shallow spread |
| 5 | A church that never opens the setting sees zero size change — Medium (md) is the identity scale | ✓ VERIFIED | `SCALE_MAP.md === 1.0` in `src/utils/slideTypography.ts:14-18`, asserted by `slideTypography.test.ts` |
| 6 | Inter Light (weight 300) is reachable through the registry ramp | ✓ VERIFIED | `SLIDE_FONTS.Inter.weights` includes 300; `SettingsView.test.ts` case "offers weight 300 (Inter Light) when Inter is the selected family" passes |
| 7 | Changing `fontFamily` re-derives weight options from `SLIDE_FONTS[family].weights` and snaps an unreachable weight to 400 before save/render | ✓ VERIFIED | `SettingsView.vue` `slideFontWeightOptions` computed + `onChangeSlideFontFamily`'s `snapWeight` call; `SettingsView.test.ts` "snaps the weight to 400 when switching family to Lora while weight 300 is selected" (discoverable via `-t "snap"`) passes; `cssVarsFor` independently re-validates at render time |
| 8 | The default family+weight is fetched at app init before `app.mount()` | ✓ VERIFIED | `src/main.ts:8` — `import '@fontsource/inter/400.css'` placed before `createApp`/`app.mount()` |
| 9 | `waitForSlideFont` resolves ready when `document.fonts.ready` + `document.fonts.load()` settle, and resolves not-ready (proceed to render) after `FONT_LOAD_TIMEOUT_MS` via `Promise.race` — never hanging indefinitely | ✓ VERIFIED (behavioral) | `slideTypography.test.ts` 3 passing cases: resolves ready on settle, resolves not-ready after fake-timer advance, resolves not-ready (does not reject) when `document.fonts.load()` rejects (WR-02 fix) — the rejection-safety case is exactly the invariant this truth asserts and it is exercised, not merely present |
| 10 | A church can set one family, one weight, and one size in Settings; the choice saves and persists (R093 SC1) | ✓ VERIFIED | `SettingsView.vue` "Slide Typography" card; `saveSlideTypography()` writes 3 leaf dot-paths in one `updateDoc`; `SettingsView.test.ts` "saves family/weight/size as three leaf dot-paths and mirrors into the store" passes |
| 11 | The picker is never unset — default resolves to `{Inter,400,md}` through the single merge point | ✓ VERIFIED | Same merge point as truth 4; `DEFAULT_ORG_SETTINGS.slideTypography` deep-equals `{fontFamily:'Inter',fontWeight:400,fontScale:'md'}` |
| 12 | While a previewed family's woff2 is fetching, the Preview keeps the last successfully-loaded face rather than blanking; a failed asset falls back to the CSS stack | ✓ VERIFIED (native-fallback, covered per UI-SPEC) | `font-display: swap` is @fontsource's shipped default (no custom loading/error UI added, matching the UI-SPEC's covered rows); `SettingsView.vue`'s `onChangeSlideFontFamily` `.catch(() => {})`s a rejected `loadFontCss` (WR-03 fix) so a failed fetch never throws, letting the native stack fall through |
| 13 | The Slide Typography card's save control is editor-gated (`authStore.isEditor`) | ✓ VERIFIED | `SettingsView.vue` `:disabled="!authStore.isEditor"` on all 3 controls; `SettingsView.test.ts` "disables all three controls and blocks saving for a non-editor (viewer)" passes |
| 14 | The grid, the Edit Slide drawer preview, and the presenter all render the church's chosen family/weight/size; the printed Order of Service is unaffected (R093 SC2) | ✓ VERIFIED | `SlideGrid.vue:407-410`, `SlideCard.vue:198`, `EditSlideDrawer.vue:600-603`, `PresentationViewer.vue:423-426` all bind `cssVarsFor(authStore.settings.slideTypography)`; `git log` confirms `ServicePrintLayout.vue` untouched by any phase-46 commit |
| 15 | A church on Medium scale sees zero visual change to the grid or drawer today | ✓ VERIFIED | `SCALE_MAP.md === 1.0`; scoped `calc(base * var(--slide-font-scale))` rules resolve to the unmodified base at scale 1 |
| 16 | The Slides-grid card body and drawer preview already truncate independent of font metrics — Large scale is not a new failure mode | ✓ VERIFIED | `SlideCard.vue:81` `line-clamp-6`; `EditSlideDrawer.vue:47` `overflow-y-auto` scrollable region — both pre-existing, unmodified by this phase |
| 17 | The presenter's canvas never renders before the font-load promise resolves — proven by automated test (R094) | ✓ VERIFIED (behavioral) | `PresentationViewer.test.ts` "R094 presenter font-load gate" — "holds presentation-loading and keeps presentation-slide absent while the font-load promise is pending, then releases once it resolves" passes; gate wrapped in `try/catch/finally` (CR-02 fix) so `fontReady.value = true` is unconditional |
| 18 | The presenter proceeds after `FONT_LOAD_TIMEOUT_MS` even if the font-load promise never resolves — proven by fake-timer test | ✓ VERIFIED (behavioral) | Same suite: "proceeds after the bounded FONT_LOAD_TIMEOUT_MS timeout even when the font-load promise never resolves" passes, plus 2 additional CR-02 tests for a **rejected** `loadFontCss` and a **rejected** `document.fonts.load()`, both asserting the presenter still releases the gate and renders — this closes the exact catastrophic-hang failure mode the original code review found |

**Score:** 18/18 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/config/slideFonts.ts` | `SLIDE_FONTS` registry + `SLIDE_FONT_FAMILY_NAMES` | ✓ VERIFIED | 5 entries, license/weights verified, wired everywhere it's needed |
| `src/config/__tests__/slideFonts.test.ts` | Registry membership/license/weight tests | ✓ VERIFIED | 8/8 passing |
| `src/types/organization.ts` | `slideTypography` field + default | ✓ VERIFIED | Present with correct JSDoc and default |
| `src/utils/slideTypography.ts` | `SCALE_MAP`, `FONT_LOAD_TIMEOUT_MS`, `cssVarsFor`, `snapWeight`, `waitForSlideFont`, `loadFontCss` | ✓ VERIFIED | All 6 exports present, all wired into ≥1 consumer |
| `src/utils/__tests__/slideTypography.test.ts` | Pure-helper tests incl. bounded-timeout + rejection paths | ✓ VERIFIED | 12/12 passing |
| `src/assets/main.css` | `:root` CSS vars w/ Inter/400/1 fallback | ✓ VERIFIED | Lines 24-26 |
| `src/main.ts` | Eager `@fontsource/inter/400.css` import before mount | ✓ VERIFIED | Line 8, before `app.mount()` |
| `src/views/SettingsView.vue` | "Slide Typography" card: family/weight/size + live Preview | ✓ VERIFIED | Card present with all data-testids, save, snap, preview |
| `src/views/__tests__/SettingsView.test.ts` | Save/persist, snap, editor-gating, Inter-300 tests | ✓ VERIFIED | 31/31 passing (incl. Slide Typography describe block) |
| `src/components/PresentationViewer.vue` | CSS-var wrapper + R094 font-load gate | ✓ VERIFIED | `typographyStyle`, `fontReady`, `try/catch/finally` gate, `resolvedFontChoice()` |
| `src/components/slides/SlideGrid.vue` | CSS-var wrapper on grid container | ✓ VERIFIED | `slideTypographyStyle` bound + passed to `SlideCard` |
| `src/components/slides/SlideCard.vue` | `typographyStyle` prop + scoped weight/size overrides | ✓ VERIFIED | Prop-based (not store-importing) design, scoped rules present |
| `src/components/slides/EditSlideDrawer.vue` | CSS-var wrapper on preview box only | ✓ VERIFIED | `previewTypographyStyle`, scoped rules on `drawer-preview-text` |
| `src/stores/auth.ts` | Eager `loadFontCss` for the org's resolved family at `loadOrgContext` (CR-01 fix) | ✓ VERIFIED | Lines 236-249; 4 passing `auth.test.ts` cases |
| `ServicePrintLayout.vue` NOT modified | Owner-locked exclusion | ✓ VERIFIED | No commit in phase 46 touches this file (`git log` confirms last touch predates the phase) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `SettingsView.vue` | `authStore.settings.slideTypography` | leaf dot-path `updateDoc` + object mirror | WIRED | Confirmed by save test + code read |
| `SlideGrid.vue`/`SlideCard.vue`/`EditSlideDrawer.vue`/`PresentationViewer.vue` | `authStore.settings.slideTypography` | `cssVarsFor()` | WIRED | All four call sites confirmed |
| `loadOrgContext` | `loadFontCss` | eager fire-and-forget on settings resolve | WIRED | CR-01 fix — the single point that makes the grid/drawer surfaces actually load the org's chosen face, not just bind its CSS variable name |
| `PresentationViewer.vue` `onMounted` | `waitForSlideFont`/`loadFontCss`/`FONT_LOAD_TIMEOUT_MS` | `Promise.race` + `try/catch/finally` | WIRED | CR-02 fix — gate always releases regardless of resolve/timeout/reject |
| `slideFontWeightOptions`/`onChangeSlideFontFamily` | `SLIDE_FONTS[family].weights` / `snapWeight` | direct read/call | WIRED | Confirmed by snap test |

### Behavioral Spot-Checks / Named Test Runs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| R094 gate holds/releases on pending→resolved | `npx vitest run src/components/__tests__/PresentationViewer.test.ts -t "font"` | 8/8 passed | ✓ PASS |
| R094 gate releases after bounded timeout | (same run, "proceeds after the bounded FONT_LOAD_TIMEOUT_MS timeout…") | passed | ✓ PASS |
| R094 gate releases on rejected `loadFontCss` (CR-02) | (same run, "releases fontReady when loadFontCss REJECTS…") | passed | ✓ PASS |
| R094 gate releases on rejected `document.fonts.load()` (CR-02) | (same run, "releases fontReady when document.fonts.load() REJECTS") | passed | ✓ PASS |
| `waitForSlideFont` resolve/timeout/reject paths (WR-02) | `npx vitest run src/utils/__tests__/slideTypography.test.ts` | 12/12 passed | ✓ PASS |
| `loadOrgContext` eager-loads non-default family (CR-01) | `npx vitest run src/stores/__tests__/auth.test.ts` | 54/54 passed | ✓ PASS |
| Settings save/snap/editor-gate/preview | `npx vitest run src/views/__tests__/SettingsView.test.ts` | 31/31 passed | ✓ PASS |
| Registry shape/license/weights | `npx vitest run src/config/__tests__/slideFonts.test.ts` | 8/8 passed | ✓ PASS |
| `npm run type-check` (`vue-tsc --build`, includes test files per CLAUDE.md) | — | clean, 0 errors | ✓ PASS |
| Full app suite regression check | `npx vitest run --dir src --exclude '**/rules.test.ts'` | 92/94 files, 2907/2920 tests — the two documented baseline files (`src/storage.rules.test.ts`, `RosterView.test.ts`) are the only failures | ✓ PASS (no new regression) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R093 | 46-01, 46-02, 46-03, 46-04 | A church can set one font family, weight and size that applies to every slide | ✓ SATISFIED | Truths 1-16 above; REQUIREMENTS.md marks R093 `[x]` → Phase 46 Complete |
| R094 | 46-02, 46-04 | The presenter never renders a fallback font — chosen font loaded before first paint | ✓ SATISFIED | Truths 9, 17, 18 above (with CR-02's rejection-path fix closing the one real gap found in code review); REQUIREMENTS.md marks R094 `[x]` → Phase 46 Complete |

No orphaned requirements — R093/R094 are the only two REQUIREMENTS.md rows mapped to Phase 46, and both are declared across the four plans' frontmatter.

### Anti-Patterns Found

None. `grep` for `TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER|not yet implemented|coming soon` across all 11 phase-46-touched source files returned zero matches. No stub returns, no hardcoded empty data flowing to render, no console-log-only handlers.

### Code Review Resolution (46-REVIEW.md → 46-REVIEW-FIX.md)

The phase's own code review found 2 Critical + 3 Warning + 2 Info issues. All 7 are independently confirmed fixed in the current source (not merely claimed in the fix report):

- **CR-01** (grid/drawer never loaded the org's actual chosen font) — fixed via an eager `loadFontCss` call inside `loadOrgContext`; confirmed present at `src/stores/auth.ts:236-249` and covered by 4 passing tests.
- **CR-02** (presenter gate could hang forever on a rejected font load) — fixed via `try/catch/finally` wrapping the whole load+wait sequence in one shared `Promise.race`; confirmed present at `src/components/PresentationViewer.vue:920-939` and covered by 2 new passing rejection-path tests, in addition to the 2 original resolve/timeout tests.
- **WR-01** (shallow merge could leave `fontWeight`/`fontScale` undefined) — fixed via a `slideTypography`-specific deep merge at `src/stores/auth.ts:216-219`; covered by a passing test.
- **WR-02** (`waitForSlideFont` didn't handle a rejected `document.fonts.load()`) — fixed via a `.then(() => true, () => false)` handler pair; covered by a passing test.
- **WR-03** (unguarded fire-and-forget `loadFontCss` in Settings) — fixed via `.catch(() => {})`; confirmed at `src/views/SettingsView.vue:1016`.
- **IN-01/IN-02** (timer leak, inconsistent CSS-var typing) — both confirmed fixed in source.

This is the phase's central risk (R094's "never a visible fallback" claim would otherwise be false for the two most-used editing surfaces, and would hang on any deploy-triggered stale-chunk font fetch failure) — the fixes are real, not just documented.

### Human Verification Required

These three items are legitimately unprovable by an automated suite (jsdom has no real font rendering/paint measurement) and are correctly recorded by the phase itself as manual-only in `.planning/PENDING-VERIFICATION.md § Phase 46`. They do not indicate a coding gap — the gate logic they'd confirm is already proven by 8 passing automated tests covering every reachable code path (resolve, timeout, and both rejection cases).

### 1. No fallback-font flash mid-service (R094)

**Test:** On a real projector, present a service with a non-default chosen family and watch the first slide's transition into view.
**Expected:** The chosen font is resident on the first slide — no visible swap from a fallback face.
**Why human:** jsdom cannot render real fonts or measure a real paint; this is a projector-visible timing effect.

### 2. Projection legibility of each curated family/weight/size (R093)

**Test:** Present with each of the five curated families at each of the three sizes on a real projector.
**Expected:** All combinations are readable at typical projection distance.
**Why human:** Legibility at projection distance is a human visual judgment.

### 3. Long-line overflow at Large (1.25) scale (R093, UI-SPEC unresolved item #2)

**Test:** On a real projector at Large scale, present an already-long lyric/scripture line.
**Expected:** The overflow is acceptable, or is flagged for a follow-up auto-fit feature if it bites.
**Why human:** Overflow is a projector-visible layout effect; REQUIREMENTS.md explicitly places auto-fit/shrink-to-fit out of scope for this phase, so no code changes were expected to close this — only the human observation.

### Gaps Summary

No gaps found. All 18 derived observable truths (covering R093 and R094's success criteria, the phase's own must_haves across all four plans, and the two behavior-dependent invariants the code review specifically flagged as previously broken) are verified against the actual source, not just SUMMARY claims. The phase's own code review caught two real critical defects (CR-01: grid/drawer never actually loaded the chosen font; CR-02: the presenter gate could hang forever on a rejected font load) — both are independently confirmed fixed in the current codebase with passing regression tests, not merely claimed fixed. `npm run type-check` is clean and the full app suite shows zero new failures beyond the CLAUDE.md-documented 2-file baseline. `ServicePrintLayout.vue` is confirmed untouched. The only reason this report is not `passed` is the three inherently-manual, jsdom-unprovable projector items, which the phase itself correctly deferred to `.planning/PENDING-VERIFICATION.md` for the owner's hands-on pass — this is the expected, correct outcome for a phase with real hardware/visual requirements, not a code defect.

---

_Verified: 2026-08-08T19:59:46Z_
_Verifier: Claude (gsd-verifier)_
