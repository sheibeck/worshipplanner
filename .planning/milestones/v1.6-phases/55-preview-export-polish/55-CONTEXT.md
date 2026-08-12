# Phase 55: Preview & Export Polish - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (owner away — grey areas auto-decided at Claude's discretion, grounded in a live read of the attribution render sites, the export flow, and the SLIDE_FONTS registry)

<domain>
## Phase Boundary

Three small, independent refinements — the LAST phase of v1.6: (R124) the slideshow preview no longer
auto-appends the Bible version to scripture slides, though it can still be added manually; (R125) the
Planning Center export shows a spinner while running; (R126) Roboto joins the curated self-hosted slide
fonts, with Inter still available. The three are independent — no ordering dependency between them.

</domain>

<decisions>
## Implementation Decisions

### R124 — No auto-appended Bible version in preview
- Today the `(ESV)`/`(NLT)` attribution suffix is auto-appended at TWO render sites (v1.5 Phase 45
  R091): `slideDisplay.ts::slideBodyText()` (~:217, `const suffix = ` ${scriptureAttribution(...)}``)
  and `PresentationViewer.vue::scriptureAttributionSuffix()` (~:707, used at :213 and :222).
- **Remove the AUTOMATIC append at the render sites** so a scripture slide shows only its own text.
  The owner: "When previewing the slideshow, don't show the bible version. That can be manually added
  to slides if they desire, but don't auto add it."
- **KEEP the provenance machinery intact** — do NOT delete the `translationSource` field, the
  `resolveTranslationSource` resolver, or the `scriptureAttribution` helper. R092's capture-once
  immutability stays; the data remains stamped per-slide for manual use or a future setting. This is a
  RENDER change (stop drawing the suffix), not a data change.
- **Manual addition** = the user types "(ESV)" (or whatever) into the slide's own text if they want it;
  nothing special is built for manual add beyond leaving the text editable as it already is.
- **Scope — research MUST confirm:** the owner says "previewing the slideshow" (the presenter,
  `PresentationViewer.vue`), but the grid display (`slideDisplay.ts`) also auto-appends. Default to
  removing the auto-append at BOTH the presenter and the grid display (consistent "don't auto add it").
  Research MUST verify that PRINT and SHARE surfaces either have their own independent attribution or
  do not rely on these two sites — R124 must NOT regress required attribution on print/share if those
  are a separate concern. If print/share append via a different path, leave them; if they share these
  sites, flag it for an explicit decision (the owner's instruction is about the slideshow preview).

### R125 — Spinner on the Planning Center export
- The export flow lives in `ServiceEditorView.vue`. Add a **spinner / in-progress indicator** on the
  export action (button/dialog) that shows while the export is running and clears on completion/failure.
- Reuse the app's existing spinner/loading affordance (there is prior art — e.g. save-status /
  in-progress patterns); do not invent a new one. Disable/guard the trigger against double-invocation
  while running.

### R126 — Roboto slide font
- Install `@fontsource/roboto` (self-hosted woff2, matching the v1.5 Phase 46 curated set — NEVER the
  runtime Google Fonts API). Add a **Roboto** entry to the `SLIDE_FONTS` registry (`src/config/slideFonts.ts`)
  with its correct weight ramp, and a loader-map entry in `slideTypography.ts` (~:156-160, the static
  `@fontsource/roboto/${weight}.css` import). Inter (and the other four) remain unchanged.
- **Package legitimacy — research MUST verify** `@fontsource/roboto` the same way Phase 46 verified its
  five packages: confirm license (Roboto is Apache-2.0/OFL) and the available weights against the
  package's own files, not assumed. Pin the version consistent with the existing @fontsource packages
  (5.x line).

### Claude's Discretion
- Whether R124 removes the auto-append at one render site or both (default both, pending the
  print/share check), the exact spinner affordance for R125, and Roboto's exact weight ramp for R126
  are at Claude's discretion, subject to: R124 keeps the provenance data (render-only change), R125
  reuses existing loading UI, R126 is self-hosted woff2 with verified legitimacy, and
  `npm run type-check` stays clean.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/slides/slideDisplay.ts` — `slideBodyText()` auto-appends the attribution suffix (~:217); R124 render site.
- `src/components/PresentationViewer.vue` — `scriptureAttributionSuffix()` (~:707), used at :213/:222; R124 render site (the "slideshow preview").
- `src/utils/scripture.ts` — `scriptureAttribution`, `resolveTranslationSource` (KEEP; provenance helpers).
- `src/views/ServiceEditorView.vue` — the Planning Center export flow (R125 spinner).
- `src/config/slideFonts.ts` — the `SLIDE_FONTS` registry (R126 add Roboto).
- `src/utils/slideTypography.ts` — the `@fontsource/<pkg>/${weight}.css` loader map (~:156-160) and the DEFAULT_FAMILY='Inter' / weight-snapping logic (R126 add Roboto loader).

### Established Patterns
- v1.5 Phase 45 R091/R092: attribution suffix + per-slide `translationSource` capture-once immutability — R124 must preserve the data while stopping the auto-render.
- v1.5 Phase 46: SLIDE_FONTS + @fontsource self-hosted woff2, package-legitimacy audit against each package's LICENSE/CSS — R126 follows the same pattern for Roboto.
- Existing loading/spinner UI in the app (save-status, in-progress states) — reuse for R125.

### Integration Points
- R124: `slideDisplay.ts` + `PresentationViewer.vue` (render sites); confirm print/share independence.
- R125: `ServiceEditorView.vue` (export action).
- R126: `slideFonts.ts` (registry) + `slideTypography.ts` (loader) + `package.json` (@fontsource/roboto).

</code_context>

<specifics>
## Specific Ideas

- Owner: "When previewing the slideshow, don't show the bible version (ESV/NLT, etc). That can be
  manually added to slides if they desire, but don't auto add it."
- Owner: "Add a spinner to the services planning center export so users can see it's doing something."
- Owner (mid-milestone): "let's also add the Inter and Roboto fonts to our list of pre-packaged fonts."
  — Inter already ships (v1.5 Phase 46); this phase adds Roboto.

</specifics>

<deferred>
## Deferred Ideas

None — three self-contained polish items; discussion stayed within scope.

</deferred>
