# Phase 46: Global Slide Typography - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey-area answers proposed and accepted at Claude's
discretion under the v1.5 standing autonomy grant (STATE.md, 2026-08-06). The consequential
scope decisions were already **owner-locked** in ROADMAP.md / REQUIREMENTS.md and are NOT
re-opened here: family + weight + size only (no outline/shadow), slide surfaces only,
self-hosted `@fontsource` woff2 (not the runtime Google Fonts API), Inter as the Helvetica
Neue stand-in, and `ServicePrintLayout.vue` explicitly excluded.

<domain>
## Phase Boundary

A church sets one house font — **family, weight, and size** — that applies to every **slide
surface** (the Slides-tab grid, the Edit Slide drawer preview, and the presenter view), and
the presenter never renders a visible fallback font mid-service.

**In scope:** a new `slideTypography` setting on `OrgSettings`; a "Slide Typography" Settings
card; a curated, self-hosted `@fontsource/*` font list with a recorded license per family;
CSS-variable propagation to the three slide render sites; and `document.fonts.ready`-gated
first paint in the presenter.

**Out of scope (owner-locked):** text outline/shadow (declined 2026-08-06); the printed Order
of Service (`ServicePrintLayout.vue` is a text document, not a slide — one size cannot serve
48pt projected and 11pt printed); the runtime Google Fonts API (a projector without internet
at service time cannot fetch a remote font).

Requirements: **R093** (set family+weight+size for every slide), **R094** (chosen font loaded
before first paint — no font flash).
</domain>

<decisions>
## Implementation Decisions

### Storage Shape & Size Semantics
- **One nested field** `slideTypography: { fontFamily: string; fontWeight: number; fontScale:
  'sm' | 'md' | 'lg' }` added to `OrgSettings`, plus one default in `DEFAULT_ORG_SETTINGS`.
  This honors the type's stated contract — "Phases 44, 45 and 46 each extend this contract by
  adding one field here plus one default … They must never introduce a second defaults-merge
  point." The single merge point stays `auth.ts::loadOrgContext`.
- **"Size" is a scale, not an absolute px.** The presenter renders text at fixed Tailwind
  steps (`PresentationViewer.vue`: body `text-5xl`, scripture reference `text-6xl`, speaker
  label `text-2xl`, copyright `text-xs`). A single absolute px cannot serve all of those at
  once, so the size control is a global **scale** exposed as a `--slide-font-scale` CSS
  variable (Small ≈ 0.85, Medium = 1.0, Large ≈ 1.25). Medium is the identity scale.
- **Weight options:** offer the standard ramp (300/400/500/600/700), but only the weights
  actually shipped for the selected family (Helvetica-Neue-Light = Inter **300** must be
  reachable, per R093's explicit note that a family-only picker cannot reach it).
- **Defaults:** `fontFamily: 'Inter'`, `fontWeight: 400`, `fontScale: 'md'`. Inter is the
  ROADMAP's designated Helvetica Neue stand-in, so anchoring the default there is consistent
  with the milestone's own framing. Medium scale = 1.0 means **no size change** for an existing
  church that never opens the setting. (Accepted, disclosed behavior change: slide text moves
  from the system-ui sans stack to Inter Regular — a polish improvement, not a regression.)

### Curated Font List & Licensing
- **Curated set, deliberately small** (bounds bundle size and the per-family license
  verification): **Inter** (sans / HN stand-in), **Open Sans** (humanist sans), **Poppins**
  (geometric display), **Lora** (serif), **Source Serif 4** (serif). All are OFL/Apache and
  available as `@fontsource/*`. The planner may adjust the exact membership during research
  (projection-legibility is SUMMARY's remaining research ask), but the size of the set and the
  "every family OFL/Apache, license recorded" rule are fixed.
- **License recorded, not assumed** (success criterion 4): a typed registry (e.g.
  `SLIDE_FONTS` / `slideFonts.ts`) carrying `{ family, package, weights, license, licenseUrl }`
  per family, each entry **verified against that package's actual LICENSE file** — never
  assumed by analogy to Inter.
- **Package legitimacy:** run the package-legitimacy provenance check for each `@fontsource/*`
  package added (the same discipline Phase 37 applied to its new deps) and record the verdict
  in the phase SUMMARY. `@fontsource` is the canonical self-hosting convention, but each
  package is still checked, not trusted by name.
- **Bundle strategy:** eager-load only the org's **chosen** family+weight at app init so R094's
  before-first-paint guarantee holds without shipping every family up front; the other curated
  families load on demand when previewed in the Settings picker.

### Application Mechanism & Font-Flash Gating
- **CSS custom properties** (`--slide-font-family`, `--slide-font-weight`, `--slide-font-scale`)
  set on a shared slide-root wrapper/class and driven from
  `authStore.settings.slideTypography`. All three render sites — `PresentationViewer.vue`, the
  Slides grid (`SlideGrid`/`SlideCard`), and the Edit Slide drawer preview — consume the
  variables rather than each hard-coding a font. One write point, three readers.
- **Presenter hard-gate (R094):** the presenter gates first paint on `document.fonts.ready`
  **plus** an explicit `document.fonts.load('<weight> 1em "<family>"')` for the chosen
  family+weight, plus a pre-measurement check, reusing the existing "Loading slideshow…" state
  until the font is proven resident. `fonts.ready` alone is not sufficient — it resolves for
  the initial font set, so the explicit `load()` for the chosen face is what closes the flash.
- **Non-presenter surfaces** (grid, drawer preview) use `font-display: swap` — a brief swap in
  an editing context is acceptable and not worth a hard gate; only the projected presenter
  view, where a mid-service flash is the real failure mode, gets the blocking gate.
- **Print surface untouched:** `ServicePrintLayout.vue` does **not** consume the slide-font
  variables. Owner-locked exclusion.

### Claude's Discretion
- Exact curated-family membership (pending projection-legibility research), the numeric scale
  values, the CSS variable names, the precise Settings-card copy, and the file layout of the
  font registry are all at Claude's discretion within the decisions above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/organization.ts` — `OrgSettings`, `DEFAULT_ORG_SETTINGS`. The extension pattern is
  documented in-file: one field + one default, single merge point. Phase 45's `bibleVersion`
  is the closest analog (a scalar setting added the same way).
- `src/views/SettingsView.vue` — cards follow a uniform shape: `<section>` +
  `<h2 class="text-sm font-semibold text-gray-300 mb-3">Name</h2>` + controls. The "Bible
  Translation" card (R090) is the closest analog for a new choice-style setting card.
- `src/components/PresentationViewer.vue` — the presenter; owns first-paint states (a
  "Loading slideshow…" state already exists at the spot the fonts.ready gate belongs) and the
  fixed slide text sizes the scale multiplies.
- `src/components/slides/slideDisplay.ts` + the Slides grid (`SlideGrid`/`SlideCard`) and the
  Edit Slide drawer preview — the other two surfaces that must inherit the slide font.
- `src/assets/main.css` — Tailwind **v4** via `@import "tailwindcss"` (CSS-based config, no
  `tailwind.config.js`); the natural home for `@font-face`/`@theme` font registration and the
  slide-font CSS variables. Currently sets only the dark-mode base; **no font-family is defined
  anywhere**, so the app currently renders in the system-ui sans stack.

### Established Patterns
- Settings are read everywhere as `authStore.settings.<field>` (already merged) — no consumer
  writes its own `?? default`.
- Presentation text styling is fixed Tailwind size/weight classes today; the scale + font-family
  are introduced as CSS variables layered over those classes rather than rewriting them.

### Integration Points
- `OrgSettings` / `DEFAULT_ORG_SETTINGS` (new field + default).
- `auth.ts::loadOrgContext` (the single defaults-merge point — no change beyond the new field
  flowing through `Partial<OrgSettings>`).
- Settings UI (new card), app init (eager font load of the chosen face), and the three slide
  render sites (consume the CSS variables).
</code_context>

<specifics>
## Specific Ideas

- Inter Light = weight **300** must be selectable — R093 calls this out explicitly ("Helvetica
  Neue Light is a weight and a family-only picker cannot reach it").
- The font-flash failure mode is specifically a **projection-screen mid-service flash**; the
  gate exists for the presenter, judged on a real projector at human-verify time.
- Success criterion 4 is a **licensing-evidence** requirement, not a functional one: every
  family actually added ships with a recorded, verified license.
</specifics>

<deferred>
## Deferred Ideas

- Text outline / shadow for slide legibility over background images — raised in research,
  **declined by the owner 2026-08-06**; revisit only if it bites during a real service.
- Applying global typography to the printed Order of Service — owner-declined; slide surfaces
  only.
- Per-slide or per-item font overrides — not requested; this phase is one house font for the
  whole org.
</deferred>
