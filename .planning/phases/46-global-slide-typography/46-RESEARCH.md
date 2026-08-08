# Phase 46: Global Slide Typography - Research

**Researched:** 2026-08-08
**Domain:** Self-hosted web font management (Vite + Tailwind v4) and the browser Font Loading API, layered onto an existing Vue 3 SPA / Pinia / Firestore settings contract.
**Confidence:** HIGH — every package-level claim below was verified by direct npm registry inspection and by downloading and opening each `@fontsource/*` tarball's own `metadata.json`/`LICENSE`/`*.css` files, not by web search or training-data recall. The two areas that remain judgment calls (font-load timeout value, non-Latin glyph coverage) are flagged explicitly in Open Questions.

## Summary

This phase adds exactly one new domain to an otherwise-established codebase: browser-native web-font loading. Everything else — the `OrgSettings` extension pattern, the Settings-card UI convention, the CSS-variable-over-fixed-Tailwind-classes mechanism — is already fully specified in `46-CONTEXT.md` and `46-UI-SPEC.md` and requires no further research; this document does not re-derive those decisions.

The two things worth a planner's attention: **(1)** the UI-SPEC's proposed per-family weight table contains two factual errors that direct package inspection catches — Open Sans and Source Serif 4 both ship more weights than stated (see Curated Font List below) — and the plan must build `SLIDE_FONTS` from the corrected, verified table, not the UI-SPEC's table. **(2)** `document.fonts.ready` alone is a documented, real footgun (WebKit bug tracker confirms it "is sometimes still resolved too quickly" for a specific face not yet requested) — this independently corroborates 46-CONTEXT.md's own reasoning for pairing it with an explicit `document.fonts.load()` call, so that part of the design is validated, not merely asserted.

**Primary recommendation:** Install the five curated `@fontsource/*` **static** (non-variable) packages at their currently-published `5.3.0`; eager-import only the org's chosen `{family}/{weight}.css` in `main.ts` before `app.mount()`; drive `--slide-font-family`/`--slide-font-weight`/`--slide-font-scale` as plain runtime CSS custom properties set from `authStore.settings.slideTypography` (NOT via Tailwind v4's `@theme`, which is a build-time mechanism and cannot hold a runtime/per-org value); gate `PresentationViewer.vue`'s first paint on `Promise.race([document.fonts.load(...), timeout])` so a stalled load degrades to "render anyway" rather than a stuck loading screen; and follow the exact `Object.defineProperty(document, ...)` per-test mock pattern this codebase's own `PresentationViewer.test.ts` already uses for `document.fullscreenElement` to stub `document.fonts` in jsdom.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R093 | A church can set one font family, weight and size that applies to every slide. Family+weight (not family alone) because "Helvetica Neue Light" is a weight. Curated self-hosted `@fontsource/*` woff2, not the runtime Google Fonts API. | Curated Font List (verified weights/license per family, corrected from UI-SPEC's table); CSS-variable application mechanism; weight re-derivation/snap pattern |
| R094 | The presenter never renders a fallback font — the chosen font is loaded before first paint. | Font-flash gating pattern (`document.fonts.ready` + `document.fonts.load()` + bounded timeout via `Promise.race`); WebKit bug corroboration for why `fonts.ready` alone is insufficient; jsdom testability pattern |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Type-check gate is `npm run type-check` (`vue-tsc --build`, which also type-checks test files) — **not** `vue-tsc --noEmit -p tsconfig.app.json`, which silently skips them.
- App test suite: `npx vitest run` (bare, no path args) or `npx vitest run --dir src --exclude '**/rules.test.ts'`. Do **not** run `npx vitest run src/` (picks up `render-service/src/render.test.ts` by substring match, different Vitest version, dies) and do **not** run `npx vitest run --dir src` alone (bypasses the config-level exclude, pulls in `src/rules.test.ts`, which needs a live Firestore emulator).
- Known-failing baseline (pre-existing, not this phase's concern): `src/storage.rules.test.ts` (environment limitation, documented root cause) and `src/views/__tests__/RosterView.test.ts` (stale assertion). A clean run for this phase = no *new* failing file beyond these two.
- `.env.local` must exist in this worktree (Firebase config) for the emulator/build/full test suite to run at all — already present in the main checkout per project convention; nothing new needed for this phase.
- No deploys, no destructive git operations, per the v1.5 standing autonomy grant (STATE.md) — not directly relevant here since this phase ships no Cloud Function or rules change, only client code + npm packages.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **One nested field** `slideTypography: { fontFamily: string; fontWeight: number; fontScale: 'sm' | 'md' | 'lg' }` added to `OrgSettings`, plus one default in `DEFAULT_ORG_SETTINGS`. Single merge point stays `auth.ts::loadOrgContext`.
- **"Size" is a scale, not an absolute px** — `--slide-font-scale` CSS variable (Small ≈ 0.85, Medium = 1.0, Large ≈ 1.25). Medium is the identity scale.
- **Weight options:** offer the standard ramp (300/400/500/600/700), but only the weights actually shipped for the selected family (Inter 300 must be reachable — R093's explicit note).
- **Defaults:** `fontFamily: 'Inter'`, `fontWeight: 400`, `fontScale: 'md'`.
- **Curated set, deliberately small:** Inter, Open Sans, Poppins, Lora, Source Serif 4. All OFL/Apache, available as `@fontsource/*`. Planner may adjust exact membership during research (this document does not change membership — all five check out); the "OFL/Apache, license recorded" rule is fixed.
- **License recorded, not assumed:** a typed registry (`SLIDE_FONTS`/`slideFonts.ts`) with `{ family, package, weights, license, licenseUrl }` per family, verified against that package's actual LICENSE file.
- **Package legitimacy:** run the provenance check for each `@fontsource/*` package and record the verdict in the phase SUMMARY.
- **Bundle strategy:** eager-load only the org's chosen family+weight at app init; other curated families load on demand when previewed in Settings.
- **CSS custom properties** (`--slide-font-family`, `--slide-font-weight`, `--slide-font-scale`) set on a shared slide-root wrapper/class per render site, driven from `authStore.settings.slideTypography`. All three render sites (`PresentationViewer.vue`, Slides grid, Edit Slide drawer preview) consume the variables.
- **Presenter hard-gate (R094):** gate first paint on `document.fonts.ready` **plus** an explicit `document.fonts.load('<weight> 1em "<family>"')`, plus a pre-measurement check, reusing "Loading slideshow…".
- **Non-presenter surfaces** use `font-display: swap` — no hard gate.
- **Print surface untouched:** `ServicePrintLayout.vue` does not consume the slide-font variables.

### Claude's Discretion

- Exact curated-family membership (pending this research's projection-legibility pass — verified acceptable, see below), the numeric scale values, the CSS variable names, the precise Settings-card copy, and the file layout of the font registry.

### Deferred Ideas (OUT OF SCOPE)

- Text outline/shadow for slide legibility over background images — declined by the owner 2026-08-06.
- Applying global typography to the printed Order of Service — owner-declined; slide surfaces only.
- Per-slide or per-item font overrides — not requested.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Store `slideTypography` setting | Database/Storage (Firestore `organizations/{orgId}.settings`) | API/Backend (Firebase client SDK read/write via `auth.ts`) | This is a client-only SPA with no custom backend endpoint for settings — the Firebase SDK itself is the "API tier" here; Firestore is the persistence layer |
| Settings UI (family/weight/size picker) | Browser/Client | — | `SettingsView.vue` is a plain client-rendered Vue SFC; the app has no SSR |
| Font asset delivery (`@fontsource` woff2) | CDN/Static | Browser/Client | Vite bundles each imported `@fontsource/*` CSS+woff2 into hashed static assets served from the same origin as the rest of the built app (Firebase Hosting); the browser fetches/caches them like any other static asset |
| CSS variable propagation to 3 render surfaces | Browser/Client | — | Runtime DOM custom properties set from a Pinia store value (`authStore.settings.slideTypography`), consumed by scoped component styles — pure client-side reactivity |
| Font-flash gating (`document.fonts`) | Browser/Client | — | The Font Loading API is browser-only; there is no server-side equivalent and none is needed since rendering is entirely client-side |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fontsource/inter` | 5.3.0 [VERIFIED: npm registry — `npm view` + tarball `metadata.json`] | Self-hosted Inter woff2 + generated `@font-face` CSS; Helvetica Neue stand-in; default family | Canonical self-hosting package for Google-Fonts-sourced OFL fonts; matches R093's explicit "not the runtime Google Fonts API" requirement |
| `@fontsource/open-sans` | 5.3.0 [VERIFIED: npm registry] | Humanist sans alternative | Same package family/convention |
| `@fontsource/poppins` | 5.3.0 [VERIFIED: npm registry] | Geometric display alternative | Same package family/convention |
| `@fontsource/lora` | 5.3.0 [VERIFIED: npm registry] | Serif alternative | Same package family/convention |
| `@fontsource/source-serif-4` | 5.3.0 [VERIFIED: npm registry] | Second serif alternative | Same package family/convention |

All five packages share one publish date (2026-07-19T03:4x:xx) and one major version line — `@fontsource` releases its entire catalog in lockstep whenever the upstream Google Fonts source files update, which is why "publish recency" is a weak legitimacy signal for this specific package family (see Package Legitimacy Audit below).

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none — native `document.fonts` Font Loading API)* | Baseline browser API | Detects when a specific font face has actually finished loading | No polyfill/library needed for the target runtime (a laptop/browser driving a projector); the once-standard `fontfaceobserver` npm package is now legacy (see State of the Art) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource/*` (static, one file per weight) | `@fontsource-variable/*` (one variable-font file spanning the whole weight axis) | Fontsource's own docs recommend variable fonts "when working with multiple weights, to reduce bundle size" — but this phase eager-loads exactly **one** weight of **one** family at a time (CONTEXT.md's bundle strategy). A single static woff2 for one weight (Inter 400 latin ≈ 23.7 KB) is smaller than a variable-font file carrying the full axis. Static packages are the correct choice here; variable fonts would only pay off if the app let a user scrub a live weight slider, which it does not (R093 is a fixed enum picker) |
| Native `document.fonts` API | `fontfaceobserver` (npm) or a custom `<img>`/canvas text-measurement poller | The Font Loading API has had broad support since ~2016 in every browser this app targets; a hand-rolled or third-party observer is solving an already-solved problem (see Don't Hand-Roll) |
| Runtime Google Fonts `<link>`/`@import` | Self-hosted `@fontsource` | Already owner-locked out of scope — a projector without internet at service time cannot fetch a remote font |

**Installation:**
```bash
npm install @fontsource/inter @fontsource/open-sans @fontsource/poppins @fontsource/lora @fontsource/source-serif-4
```

**Version verification (2026-08-08):**
```
npm view @fontsource/inter version license          → 5.3.0, OFL-1.1
npm view @fontsource/open-sans version license       → 5.3.0, OFL-1.1
npm view @fontsource/poppins version license         → 5.3.0, OFL-1.1
npm view @fontsource/lora version license            → 5.3.0, OFL-1.1
npm view @fontsource/source-serif-4 version license  → 5.3.0, OFL-1.1
```
All five confirmed on the npm registry with `npm --version` 11.15.0 / `node --version` v24.11.1, both already available in this environment — no runtime/tooling gap.

## Package Legitimacy Audit

| Package | Registry | Age (this version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|--------------|---------|-------------|
| `@fontsource/inter` | npm | ~3 weeks (5.3.0 published 2026-07-19) | 2,371,098/wk | `github.com/fontsource/font-files` | SUS | Flagged — planner must add `checkpoint:human-verify` before install |
| `@fontsource/open-sans` | npm | ~3 weeks | 778,813/wk | `github.com/fontsource/font-files` | SUS | Flagged — same checkpoint |
| `@fontsource/poppins` | npm | ~3 weeks | 569,498/wk | `github.com/fontsource/font-files` | SUS | Flagged — same checkpoint |
| `@fontsource/lora` | npm | ~3 weeks | 103,938/wk | `github.com/fontsource/font-files` | SUS | Flagged — same checkpoint |
| `@fontsource/source-serif-4` | npm | ~3 weeks | 110,265/wk | `github.com/fontsource/font-files` | SUS | Flagged — same checkpoint |

**Reading the SUS verdict:** `gsd-tools query package-legitimacy check` flagged all five with reason `"too-new"` — driven purely by the **publish date of this specific version** (5.3.0, 2026-07-19), because `@fontsource` re-releases its entire multi-hundred-package catalog in lockstep on every upstream Google Fonts data refresh (multiple times a year). This is a structurally different signal from "this package itself is new/unproven": all five resolve to the canonical `fontsource/font-files` monorepo, weekly download counts range from ~104K to ~2.37M, and `postinstall` is `null` for every one (no supply-chain script risk). Per the Package Legitimacy Gate protocol, the verdict is still recorded as **SUS, not OK**, because the check's rule fired — the planner must still insert a `checkpoint:human-verify` task before each `npm install`, but should not read that checkpoint as "these are suspected slopsquats"; it should read it as "confirm the version-pin behaves as expected in `package-lock.json` before merging."

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** all five (`@fontsource/inter`, `@fontsource/open-sans`, `@fontsource/poppins`, `@fontsource/lora`, `@fontsource/source-serif-4`) — reason is version-publish recency from the catalog-wide lockstep release pattern, not an unverified/unknown package identity. The package **names**, weights, and license data below were independently confirmed by downloading the actual npm tarballs and reading each package's own `metadata.json`/`LICENSE`/`*.css` files directly (not web search, not training data) — this is a stronger verification than "official docs," but per the letter of the Package Legitimacy Gate, the SUS verdict from the automated check still stands and still requires the checkpoint.

## Curated Font List (R093 success criterion 4 — license evidence, CORRECTED from 46-UI-SPEC.md)

> **Two corrections to 46-UI-SPEC.md's proposed table**, found by extracting and reading each package's actual `metadata.json` (2026-08-08): **Open Sans** ships weight **500** in addition to the UI-SPEC's stated 300/400/600/700, and **Source Serif 4** ships weights **300 and 500** — the UI-SPEC's claim of "no 300/500 — narrower weight ramp" is incorrect. Both corrections only ADD reachable weights; nothing the UI-SPEC claimed is unreachable turns out to be unreachable. Build `slideFonts.ts` from this table, not the UI-SPEC's.

| Family | Package | Weights shipped (full) | Weights offered in the standard 300–700 ramp | License [VERIFIED: package `metadata.json`/`LICENSE`] | Projection-legibility notes |
|---|---|---|---|---|---|
| Inter | `@fontsource/inter` | 100,200,300,400,500,600,700,800,900 | 300,400,500,600,700 (all present) | OFL-1.1 | Purpose-built for UI/screen legibility at a range of sizes; the Helvetica-Neue-Light stand-in (300) renders cleanly at large projected sizes. Strong choice, no concerns. |
| Open Sans | `@fontsource/open-sans` | 300,400,500,600,700,800 | 300,400,500,600,700 (**500 corrected in — UI-SPEC omitted it**) | OFL-1.1 | Humanist sans designed for print/screen at a wide range of sizes; high x-height reads well from a distance. No concerns. |
| Poppins | `@fontsource/poppins` | 100,200,300,400,500,600,700,800,900 | 300,400,500,600,700 (all present) | OFL-1.1 | Geometric display sans. Circular geometric letterforms (lowercase "l"/"I" especially) are the one legibility caveat commonly raised for geometric sans at long viewing distance — acceptable as an optional/display choice, not a concern for the default. |
| Lora | `@fontsource/lora` | 400,500,600,700 (no 300) | 400,500,600,700 (matches UI-SPEC exactly) | OFL-1.1 | Serif with moderate contrast, designed for on-screen reading; readable at large projected sizes. No 300/Light weight exists in the package at all — the picker must not offer it for this family (already handled by CONTEXT.md's per-family weight-list rule). |
| Source Serif 4 | `@fontsource/source-serif-4` | 200,300,400,500,600,700,800,900 | 300,400,500,600,700 (**300 and 500 corrected in — UI-SPEC said neither existed**) | OFL-1.1 | Serif designed as a companion to Source Sans, tuned for on-screen text; comparable projection legibility to Lora. No concerns. |

**Suggested file layout** (unchanged from UI-SPEC's discretion): `src/config/slideFonts.ts` exporting `SLIDE_FONTS: Record<string, { family: string; package: string; weights: number[]; license: string; licenseUrl: string }>` using the corrected `weights` arrays above (the "standard ramp" column, not the "full" column — do not expose 100/200/800/900, which fall outside CONTEXT.md's locked 300–700 ramp), and a derived `SLIDE_FONT_FAMILY_NAMES` list for the `<select>`.

## Architecture Patterns

### System Architecture Diagram

```
 Firestore                          Pinia (authStore)                 Vue components (3 render sites)
 organizations/{orgId}                                                
   .settings.slideTypography  ──►  loadOrgContext() merges       ──►  authStore.settings.slideTypography
   { fontFamily, fontWeight,       under DEFAULT_ORG_SETTINGS         (single source of truth, read-only
     fontScale }                   (SINGLE merge point,                everywhere except the Settings card)
                                    unchanged mechanism)
                                          │                                    │
                                          │                     ┌──────────────┼──────────────────┐
                                          ▼                     ▼              ▼                   ▼
                                   SettingsView.vue      PresentationViewer  SlideGrid/SlideCard  EditSlideDrawer
                                   "Slide Typography"    .vue (wrapper)     .vue (wrapper)         preview (wrapper)
                                   card — writes new            │                  │                   │
                                   settings.slideTypography     └── each sets --slide-font-family / --slide-font-weight
                                   back to Firestore                / --slide-font-scale as inline CSS custom
                                                                     properties on its own root element
                                                                            │
                                                                            ▼
                                                          descendant text elements consume:
                                                          font-family: var(--slide-font-family)
                                                          font-weight: var(--slide-font-weight)
                                                          font-size: calc(<existing Tailwind rem value> * var(--slide-font-scale))

 App init (main.ts, before app.mount())
   import `@fontsource/${chosenFamily}/${chosenWeight}.css`   ──►  triggers browser fetch of the matching
   (ONE eager import; other 4 curated families NOT imported        latin-subset woff2 (~24 KB for Inter 400)
    here — they load lazily only if previewed in Settings)         populates document.fonts

 PresentationViewer.vue onMounted()
   isLoadingState (existing "Loading slideshow…") stays true
       │
       ▼
   Promise.race([
     Promise.all([document.fonts.ready, document.fonts.load('<weight> 1em "<family>"')]),
     timeout(3000ms)
   ])
       │
       ├── resolves in time ──► font is proven resident ──► flip to slide canvas, no flash
       └── timeout fires ─────► proceed to render anyway (bounded degradation, never a stuck screen)
```

### Recommended Project Structure

```
src/
├── config/
│   └── slideFonts.ts          # SLIDE_FONTS registry (family/package/weights/license), corrected table above
├── composables/ or utils/
│   └── slideTypography.ts     # pure functions: cssVarsFor(settings), snapWeight(family, weight),
│                               # loadChosenFont(family, weight, timeoutMs) — the gate logic, unit-testable
│                               # in isolation from PresentationViewer.vue
├── components/
│   ├── PresentationViewer.vue     # consumes cssVarsFor() on its root; calls loadChosenFont() in onMounted
│   └── slides/
│       ├── SlideGrid.vue          # consumes cssVarsFor() on its container root
│       └── EditSlideDrawer.vue    # consumes cssVarsFor() on the preview wrapper (not the whole drawer)
├── views/
│   └── SettingsView.vue           # new "Slide Typography" card, same shape as the Bible Translation card (R090)
└── main.ts                        # ONE eager `import '@fontsource/<family>/<weight>.css'` before app.mount()
```

### Pattern 1: Runtime CSS custom properties, NOT Tailwind `@theme`

**What:** Tailwind v4's CSS-first config (`@theme { --font-sans: ...; --default-font-family: ...; }` in `src/assets/main.css`) compiles a **literal, build-time** value into generated utility classes. This phase's font choice is a **runtime**, per-organization value loaded from Firestore after the app boots — it cannot be expressed through `@theme`.

**When to use:** Use `@theme` only for values that are the same for every build/every org (this app currently declares none). Use plain CSS custom properties, set imperatively (inline `:style` binding or `element.style.setProperty`), for anything that varies per org/session/user.

**Example:**
```css
/* src/assets/main.css — declare the variables with safe fallbacks, once */
:root {
  --slide-font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --slide-font-weight: 400;
  --slide-font-scale: 1;
}
```
```vue
<!-- Each of the 3 render-site roots binds the live values -->
<div
  :style="{
    '--slide-font-family': slideFontStack,
    '--slide-font-weight': authStore.settings.slideTypography.fontWeight,
    '--slide-font-scale': SCALE_MAP[authStore.settings.slideTypography.fontScale],
  }"
>
```
```css
/* Existing fixed classes stay; layer family/weight/scale on top */
[data-testid="presentation-body"] {
  font-family: var(--slide-font-family);
  font-weight: var(--slide-font-weight);
  font-size: calc(1rem * 3 * var(--slide-font-scale)); /* text-5xl base = 3rem, scaled */
}
```
`[VERIFIED: package tarball inspection + tailwindcss.com/docs/theme cross-check via WebSearch]`

### Pattern 2: Font-flash gate with bounded timeout

**What:** Race the font-load promise against a timeout so a stalled/failed load degrades to "render with fallback" rather than hanging the loading screen forever — the UI-SPEC's own "unresolved" backstop, closed here.

**When to use:** `PresentationViewer.vue`'s `onMounted()`, before flipping `isLoadingState` false.

**Example:**
```typescript
// src/utils/slideTypography.ts (or composables/) — pure, independently testable
export async function waitForSlideFont(
  family: string,
  weight: number,
  timeoutMs = 3000,
): Promise<{ ready: boolean; timedOut: boolean }> {
  const load = Promise.all([
    document.fonts.ready,
    document.fonts.load(`${weight} 1em "${family}"`),
  ]).then(() => ({ ready: true, timedOut: false }))

  const timeout = new Promise<{ ready: boolean; timedOut: boolean }>((resolve) =>
    setTimeout(() => resolve({ ready: false, timedOut: true }), timeoutMs),
  )

  return Promise.race([load, timeout])
}
```
Source pattern: `[CITED: bramstein.com/writing/web-font-loading-patterns.html]`, cross-checked against `[CITED: gomakethings.com — "A modern font loading strategy with FontFaceSet.load()"]`. `document.fonts.load()` forcing the specific face — rather than relying on `fonts.ready` alone — is independently corroborated as necessary by `[CITED: bugs.webkit.org/show_bug.cgi?id=225790 — "document.fonts.ready is sometimes still resolved too quickly"]`.

### Pattern 3: Weight re-derivation and snap on family change

**What:** When the family `<select>` changes, recompute the weight options from `SLIDE_FONTS[family].weights`; if the currently-selected weight isn't in that list, snap to `400` (every curated family ships 400) before the next save.

**When to use:** `SettingsView.vue`'s family-change handler, and defensively wherever `slideTypography` is read for rendering (in case Firestore ever holds a stale `{family, weight}` pair from before a weight-list correction).

**Example:**
```typescript
export function snapWeight(family: string, weight: number): number {
  const weights = SLIDE_FONTS[family]?.weights ?? [400]
  return weights.includes(weight) ? weight : 400
}
```

### Anti-Patterns to Avoid

- **Importing every curated family's CSS eagerly "to be safe":** defeats R094's own bundle-size rationale and ships 4 unused font families to every presenter. Only the chosen family+weight is eager; the rest lazy-load on Settings-card preview.
- **Using `@fontsource-variable/*` packages here:** larger than a single static weight file for this phase's "load exactly one weight" usage pattern (see Alternatives Considered).
- **Polling computed text width to detect font load** (the pre-2016 hand-rolled technique): the native Font Loading API replaces this entirely and is the "don't hand-roll" case below.
- **Writing `document.fonts` mocks per ad-hoc `vi.fn()` shape:** follow the exact `Object.defineProperty(document, '<prop>', { value, configurable: true, writable: true })` shape `PresentationViewer.test.ts` already uses for `fullscreenElement` — a different shape in the same file/suite is an unnecessary inconsistency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting when a specific font face has actually finished downloading | A custom `<link rel="preload">` + `setTimeout` poll, or a canvas/`<img>` text-width comparison trick | Native `document.fonts.load()` + `document.fonts.ready` (Font Loading API) | The browser already tracks exact per-face load state; this is precisely the problem the API was standardized to solve, and it has had broad support since ~2016 in every browser this app's target environment (a laptop driving a projector) would run |
| Self-hosting Google-Fonts-sourced woff2 with correct subsetting/unicode-range/font-display | A custom build-time fetch-and-inline script, or a hand-written `@font-face` block per weight | `@fontsource/*` packages | Already solves subsetting, per-language `unicode-range` splitting (so only the Latin-matching face is fetched for English content — verified by tarball inspection), and bakes in `font-display: swap` on every rule; this is the de facto standard mechanism for exactly the "self-hosted, no runtime Google Fonts API" constraint R093 states |
| License-compliance tracking for bundled font families | A spreadsheet, a code comment, or "it's OFL like Inter so it's fine" | A typed `SLIDE_FONTS` registry with `license`/`licenseUrl` fields, each independently checked against that package's own `LICENSE` file | Keeps the fact machine-checkable and colocated with the code that uses it; this phase already caught two factual weight-list errors by not trusting an un-verified table, which is the same failure mode license-by-analogy would produce |

**Key insight:** every piece of "custom" work this phase might be tempted to write (font-load detection, font subsetting, license bookkeeping) already has a maintained, standard answer. The only genuinely new code this phase writes is the *glue*: reading one Firestore-backed setting, setting three CSS variables from it, and racing one promise against one timeout.

## Common Pitfalls

### Pitfall 1: `document.fonts.ready` resolving before the CHOSEN face is loaded
**What goes wrong:** A presenter briefly shows the fallback font even though the code "waited for fonts.ready."
**Why it happens:** `fonts.ready` resolves once the fonts needed for the *page's initial render* have settled — if the chosen family+weight wasn't already requested by that point (e.g., it's only referenced by a CSS rule that hasn't matched any element yet), `fonts.ready` can resolve without it. This is a documented, real browser behavior, not a theoretical concern — WebKit's own bug tracker has an open issue titled exactly this. `[CITED: bugs.webkit.org/show_bug.cgi?id=225790]`
**How to avoid:** Always pair `fonts.ready` with an explicit `document.fonts.load('<weight> 1em "<family>"')` call for the specific face, as 46-CONTEXT.md already specifies — this research corroborates that decision rather than changing it.
**Warning signs:** A human-verify projector test shows a one-frame flash even though the gate "passed" — check that the `load()` call's weight/family string exactly matches what's actually being rendered (a mismatched quote style or weight number silently no-ops).

### Pitfall 2: jsdom has no `document.fonts` at all
**What goes wrong:** Any test that mounts `PresentationViewer.vue` and lets `onMounted` run to completion throws `TypeError: Cannot read properties of undefined (reading 'ready')` the moment the gate logic executes.
**Why it happens:** jsdom does not implement the `FontFaceSet`/`document.fonts` API. `[CITED: multiple sources — Mantine docs, canopas.com "How to Test CSS Font Loading API Using Jest", erikonarheim.com "Don't Test Fonts"]`
**How to avoid:** Stub `document.fonts` per test using the exact pattern this codebase's own `PresentationViewer.test.ts` already uses for `document.fullscreenElement` (`Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve(), load: vi.fn().mockResolvedValue([]) }, configurable: true, writable: true })` in `beforeEach`), so the gate logic path is exercised without needing a real browser.
**Warning signs:** A new test file for this phase passes locally in a real browser dev session but fails under `npx vitest run` — the jsdom gap is almost certainly why.

### Pitfall 3: Trusting the UI-SPEC's weight table without re-verifying against the actual package
**What goes wrong:** `slideFonts.ts` ships a weight picker that's *too narrow* (Open Sans hides its real 500 weight, Source Serif 4 hides its real 300/500) — not a crash, but a quietly wrong feature.
**Why it happens:** The UI-SPEC's own text says "stated intent, not verified evidence" — it was written before this research pass opened the actual packages.
**How to avoid:** Build `slideFonts.ts` from the Curated Font List table above (verified 2026-08-08 by extracting each tarball's `metadata.json`), not from `46-UI-SPEC.md`'s table.
**Warning signs:** None at runtime — this is a silent scope gap, only caught by comparing the shipped registry against the verified table.

### Pitfall 4: Import order — the eager font CSS import must run before `app.mount()`
**What goes wrong:** The chosen font's CSS is imported from inside a component's `onMounted()` or a Pinia store action instead of `main.ts`'s top level, so the very first paint still races the CSS import rather than being gated correctly.
**Why it happens:** It's tempting to import the font once the org settings are known (post-`loadOrgContext`), but by then Vue has already started mounting.
**How to avoid:** Keep the CSS import path static and evaluated at module load (before `createApp(App).mount('#app')`), keyed off whatever the *default* org settings resolve to for the very first paint, and let `PresentationViewer.vue`'s own gate (Pattern 2) handle the case where the actual org's chosen family/weight differs from the default and needs its own on-demand import+load before the presenter opens.
**Warning signs:** The Settings-card family picker itself flashes on first load even before any org data has arrived.

### Pitfall 5: Non-Latin/diacritic glyphs not covered by the default `document.fonts.load()` test string
**What goes wrong:** `document.fonts.load('400 1em "Inter"')` with no explicit text argument uses the browser's default probe string (`"BESbswy"` in most implementations) — which only proves the Latin-basic subset of the chosen face has loaded. A scripture reference or lyric containing curly quotes, em-dashes, or accented characters (e.g. "café", "naïve") could theoretically still flash if those specific glyphs live in a different `unicode-range` block within the same weight.
**Why it happens:** `@fontsource` splits each weight into multiple `@font-face` blocks by Unicode subset (latin, latin-ext, cyrillic, greek, vietnamese — confirmed by tarball inspection); the default probe string only forces the `latin` block.
**How to avoid:** For this app's content (English-language worship service text), this is very low risk — flag as an Open Question below rather than as a blocking pitfall, and confirm with the owner at human-verify time using real service content with typographic punctuation.
**Warning signs:** A flash specifically on slides containing curly quotes/em-dashes/accented loanwords, not on plain-ASCII slides.

## Code Examples

### Font-load gate with bounded timeout (R094)
```typescript
// Source: pattern synthesized from bramstein.com/writing/web-font-loading-patterns.html
// and gomakethings.com's FontFaceSet.load() writeup; document.fonts.ready-alone
// insufficiency independently corroborated by bugs.webkit.org/show_bug.cgi?id=225790
export async function waitForSlideFont(
  family: string,
  weight: number,
  timeoutMs = 3000,
): Promise<boolean> {
  const load = Promise.all([
    document.fonts.ready,
    document.fonts.load(`${weight} 1em "${family}"`),
  ]).then(() => true)
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
  return Promise.race([load, timeout])
}
```

### jsdom test stub, matching this codebase's existing convention
```typescript
// Source: src/components/__tests__/PresentationViewer.test.ts:220-227 (existing pattern
// for document.fullscreenElement) — apply the identical shape for document.fonts
beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    value: {
      ready: Promise.resolve(),
      load: vi.fn().mockResolvedValue([]),
    },
    configurable: true,
    writable: true,
  })
})
```

### Eager import at app init (main.ts)
```typescript
// Source: fontsource.org/docs/getting-started/install (via WebFetch) — "a single
// import statement will load ONE font file"
import './assets/main.css'
import '@fontsource/inter/400.css' // the DEFAULT family+weight; matches DEFAULT_ORG_SETTINGS
// Note: once org settings are loaded, PresentationViewer's own gate (see above)
// handles the case where the org's chosen family/weight differs from this default.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Runtime `<link href="fonts.googleapis.com/...">` or `@import url(...)` | Self-hosted `@fontsource/*` npm packages, bundled at build time | Industry-wide shift accelerated by privacy rulings (EU, ~2022) requiring consent for third-party font CDN requests, plus general "no external network dependency" pressure | Directly required by this app's own constraint: a projector without internet at service time cannot fetch a remote font (R093) |
| `fontfaceobserver` npm library for load detection | Native `document.fonts` Font Loading API | Broad browser support since ~2016 | No extra runtime dependency needed for this phase's font-flash gate |
| Tailwind v3 `tailwind.config.js` `theme.fontFamily` | Tailwind v4 CSS-first `@theme { --font-*: ... }` | Tailwind v4 (2025) | Not directly usable for this phase's runtime/per-org value — noted as an anti-pattern above so the planner doesn't reach for it by habit |

**Deprecated/outdated:**
- `fontfaceobserver`: superseded by the native API for any browser this app targets; do not add it as a dependency.
- Runtime Google Fonts API: explicitly owner-rejected for this project (out of scope table).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | 3000ms is the right bounded timeout value for the font-load gate before falling back to "render anyway" | Pattern 2 / Common Pitfalls | Too short: real churches on slow venue WiFi/laptops could regularly hit the fallback and see the exact flash R094 exists to prevent, even though the font *would* have loaded given more time. Too long: a genuinely broken/missing font asset makes the presenter appear frozen for the full timeout every time. 46-UI-SPEC.md already flags this as an unresolved, planner-owned decision — this research does not resolve it further, only inherits the flag |
| A2 | The `package-legitimacy check`'s "too-new" SUS verdict reflects `@fontsource`'s catalog-wide lockstep release cadence rather than genuine supply-chain risk | Package Legitimacy Audit | If wrong (i.e., if this specific release actually were compromised despite the high download counts and canonical repo match), skipping extra scrutiny beyond the standard checkpoint could let a bad package through. Low likelihood given the corroborating signals (repo, downloads, no postinstall script), but the checkpoint is still recorded, not skipped |
| A3 | `document.fonts.load()`'s default probe string sufficiently represents the glyphs actually used on this app's slides (English-language scripture/lyrics, occasional curly quotes/em-dashes/accented loanwords) | Common Pitfalls Pitfall 5 | If wrong, a slide with an unusual glyph could show a very brief flash for just that glyph even though the gate reported success — a narrow, cosmetic edge case, not a functional break. Recommended to confirm at the human-verify projector pass with real service content, not to block the phase on it |

## Open Questions

1. **Bounded timeout value for the font-load gate**
   - What we know: `Promise.race([load, timeout])` is the right shape; 46-UI-SPEC.md itself recommends 3000ms as a starting point.
   - What's unclear: whether 3000ms is long enough on the slowest realistic venue hardware/network this app will run on (a church laptop, possibly on cellular hotspot backup internet) without being so long that a genuine failure looks frozen.
   - Recommendation: ship 3000ms as the default (per UI-SPEC's own suggestion, and this is a same-origin self-hosted ~24 KB asset so 3s is generous), but make it a named constant (not a magic number inline) so it's a one-line change if human-verify on real hardware says otherwise.

2. **Whether the font-load gate needs a distinct visual/telemetry signal for the timeout-fallback path**
   - What we know: the app has no telemetry/analytics infrastructure anywhere else; the existing "Loading slideshow…" state has no analogous error path either.
   - What's unclear: whether silently proceeding to render (with no on-screen indication that the gate timed out) is acceptable, or whether it should log to the console for later debugging.
   - Recommendation: silently proceed (matches every other degraded-state precedent in this component — e.g. `onMediaError` also silently degrades with no console output); a `console.warn` is low-risk to add if the planner wants a debugging breadcrumb, but is not required by any requirement.

3. **Non-Latin/diacritic glyph coverage in the font-load probe** — see Pitfall 5 / Assumption A3 above. Recommend confirming at the human-verify projector pass rather than building special-case glyph-probing logic now.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | build/dev tooling | ✓ | v24.11.1 | — |
| npm registry access | `npm install @fontsource/*` | ✓ (verified live 2026-08-08 via `npm view`/`npm pack`) | npm 11.15.0 | — |
| Browser Font Loading API (`document.fonts`) | R094's gate, at runtime in the shipped app | ✓ (broad support since ~2016 in all evergreen browsers) | — | none needed — this is the baseline this whole phase is built on |
| jsdom `document.fonts` | Unit tests exercising the gate | ✗ (not implemented in jsdom) | — | Per-test `Object.defineProperty` stub (Pitfall 2 / Code Examples) — same pattern already used in this codebase for `document.fullscreenElement` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** jsdom's missing `document.fonts` — stubbed per test, as documented above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @vue/test-utils ^2.4.6 |
| Config file | `vite.config.ts` (`test: { environment: 'jsdom', exclude: [...] }`) — no `setupFiles` currently configured; this codebase's convention is per-test-file `Object.defineProperty` stubs (see `PresentationViewer.test.ts`'s existing `fullscreenElement` mock), not a shared global setup file |
| Quick run command | `npx vitest run src/components/__tests__/PresentationViewer.test.ts src/views/__tests__/SettingsView.test.ts` (or whichever specific new/touched files) |
| Full suite command | `npx vitest run` (bare — per CLAUDE.md, do not add `src/` or `--dir src` without the matching exclude) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| R093 | Family/weight/size picker saves `slideTypography` to `authStore.settings` and persists via the existing save mechanism | unit | `npx vitest run src/views/__tests__/SettingsView.test.ts` | ✅ (existing file, add cases) |
| R093 | Changing family re-derives weight options and snaps an unreachable weight to 400 | unit | `npx vitest run src/views/__tests__/SettingsView.test.ts -t "snap"` | ❌ Wave 0 — new test cases |
| R093 | CSS variables (`--slide-font-family`/`-weight`/`-scale`) are correctly computed from settings for all three render sites | unit | new `src/utils/__tests__/slideTypography.test.ts` (or co-located with the composable) | ❌ Wave 0 — new file, new pure-function module to test |
| R094 | Presenter does not flip out of `isLoadingState` until the mocked font-load promise resolves | unit | `npx vitest run src/components/__tests__/PresentationViewer.test.ts -t "font"` | ❌ Wave 0 — new test cases, needs the `document.fonts` stub |
| R094 | Presenter proceeds to render after the bounded timeout even if the font-load promise never resolves | unit (fake timers) | same file, `vi.useFakeTimers()` + `vi.advanceTimersByTime(3000)` | ❌ Wave 0 — new test case |
| R094 (visual, real projector) | No visible font flash during an actual service | manual-only | n/a — human-verify | n/a — inherently outside jsdom's capability (Pitfall 2) |

### Sampling Rate
- **Per task commit:** the quick run command scoped to whichever file(s) that task touched.
- **Per wave merge:** `npx vitest run` (full app suite), plus `npm run type-check` per CLAUDE.md's documented gate.
- **Phase gate:** full suite green (baseline 2-file failure set unchanged) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `document.fonts` per-test stub added to `PresentationViewer.test.ts`'s existing `beforeEach`, following the exact `fullscreenElement` shape already in that file.
- [ ] New pure-function module (`src/utils/slideTypography.ts` or similar) extracted so the CSS-var computation and weight-snap logic are unit-testable independent of any component mount.
- [ ] `SLIDE_FONTS` registry (`src/config/slideFonts.ts`) built from the corrected Curated Font List table above.
- [ ] No test framework installation needed — Vitest/`@vue/test-utils` are already fully configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | Unrelated to this phase — no new auth surface |
| V3 Session Management | No | Unrelated |
| V4 Access Control | Yes (pre-existing, unchanged) | The Settings card's save action must stay gated to `authStore.isEditor`, matching every sibling Settings card (Bible Translation, Services template) — no new access-control code needed, just apply the existing pattern |
| V5 Input Validation | Yes | `fontFamily` must be constrained to `SLIDE_FONTS`'s known keys and `fontWeight` to that family's `weights` array — **never** interpolate a free-text or otherwise-unvalidated string into the `font-family` CSS custom property or the `document.fonts.load()` template string, since both are attacker-influenceable injection points if the enum constraint is ever loosened (e.g. a future "custom font name" feature) |
| V6 Cryptography | No | Unrelated |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| CSS/font-family value injection via an unvalidated Firestore field (e.g. a manually-edited Firestore document setting `fontFamily` to something outside the curated set) | Tampering | The picker UI only ever writes values sourced from `SLIDE_FONTS`'s own keys (never free text), and the render-side computed CSS-var function should defensively fall back to the default (`Inter`, `400`, `'md'`) if the stored value isn't a recognized key/weight/scale — the same defensive posture `snapWeight()` already gives the weight field, extended to the family and scale fields too |
| Firestore rules currently place no additional constraint on `settings.slideTypography` beyond the existing per-field write rules already covering `settings.*` (no new rules work is needed for this phase, per 46-CONTEXT.md's scope) | Tampering (org-editor-only, already scoped) | Existing `firestore.rules` org-editor write gate on `organizations/{orgId}` already covers this new nested field — no rules changes required for this phase; verify this assumption during planning by reading the current rule, don't re-derive it here since it's out of this research's declared domain |

## Sources

### Primary (HIGH confidence)
- npm registry — `npm view @fontsource/{inter,open-sans,poppins,lora,source-serif-4} version license` (2026-08-08) — version/license confirmed live.
- `@fontsource/*` npm tarballs, downloaded and extracted directly (`npm pack`) — `metadata.json`, `LICENSE`, and per-weight `*.css` files opened and read for weights, license text, `font-display`, and `unicode-range` behavior (2026-08-08).
- This codebase — `src/types/organization.ts`, `src/stores/auth.ts` (`loadOrgContext`), `src/components/PresentationViewer.vue`, `src/components/slides/{SlideCard,SlideGrid,EditSlideDrawer}.vue`, `src/assets/main.css`, `vite.config.ts`, `src/views/SettingsView.vue`, `src/components/__tests__/PresentationViewer.test.ts` — read directly for the existing conventions this phase must extend.
- `gsd-tools query package-legitimacy check --ecosystem npm` — automated legitimacy verdicts for all 5 curated packages.

### Secondary (MEDIUM confidence)
- `bugs.webkit.org/show_bug.cgi?id=225790` — "document.fonts.ready is sometimes still resolved too quickly" (corroborates 46-CONTEXT.md's own reasoning for pairing `fonts.ready` with an explicit `load()` call).
- `fontsource.org/docs/getting-started/install` (via WebFetch) — confirms one-import-per-weight-file syntax; did not itself confirm `font-display: swap`, which was instead confirmed directly by reading the shipped CSS (primary source, stronger than this citation).
- `bramstein.com/writing/web-font-loading-patterns.html`, `gomakethings.com` — `Promise.race`-based font-load timeout pattern, cross-checked across multiple independent write-ups.
- Mantine docs, `canopas.com`, `erikonarheim.com` ("Don't Test Fonts") — jsdom's lack of `document.fonts` support, cross-checked across multiple independent sources.
- `tailwindcss.com/docs/theme` and GitHub Tailwind Labs discussions (via WebSearch) — `@theme`/`--default-font-family` is a build-time mechanism, informing Pattern 1's anti-pattern warning.

### Tertiary (LOW confidence)
- None used as the basis for any claim above without a corroborating primary/secondary source.

## Metadata

**Confidence breakdown:**
- Standard stack (package identity, versions, weights, licenses): HIGH — directly verified via registry + tarball inspection, not web search or recall.
- Package legitimacy: MEDIUM — automated verdict is SUS across the board for a structural reason (catalog lockstep releases) that this research explains but the checkpoint still stands per protocol.
- Architecture (CSS-variable mechanism, Tailwind v4 boundary, font-load gate pattern): HIGH for the codebase-specific parts (read directly), MEDIUM for the general web-platform pattern (cross-checked web sources, one bug-tracker citation).
- Pitfalls: HIGH for the jsdom/testing pitfalls (this codebase's own test file already demonstrates the exact fix pattern); MEDIUM for the `fonts.ready` timing pitfall (corroborated by an external bug report, not reproduced locally).
- Testability: HIGH — Vitest/jsdom setup already exists and needs no new tooling, only new test files.

**Research date:** 2026-08-08
**Valid until:** 30 days (stable domain — `@fontsource` package versions and the Font Loading API are both slow-moving; re-verify package versions if planning is delayed past ~2026-09-07)
