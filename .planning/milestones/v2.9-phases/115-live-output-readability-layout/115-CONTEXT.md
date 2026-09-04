# Phase 115: Live-Output Readability & Layout - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas proposed in batch, owner accepted all

<domain>
## Phase Boundary

Make the live presentation output and the Run/control screen readable during a real service: slide text
**auto-scales to fill** the Audience and Confidence output displays (no manual size control; the configured
font FAMILY still renders), the Run screen's live main view is **smaller** while the preview **thumbnails
are larger/legible**, an **end-of-item marker** tells the operator the current item is ending and names the
next item, and the filmstrip's horizontal **scrollbar is reliably visible on macOS**.

Delivers R329, R330, R331, R332. Scope is the live-output rendering + Run-screen preview layout only — NOT
the multi-monitor assignment/launch work (Phase 114, done) or the lyric editor / song UX (Phase 116).
</domain>

<decisions>
## Implementation Decisions

### Auto-fit text scaling (R329)
- **Mechanism:** measure each slide's text against the canonical **1280×720** slide frame and pick the
  largest font scale that fits (iterative/binary-search driven by a ResizeObserver), modeled on the
  existing `useScaleToFit()` in `RunPreviewPair.vue`. This **replaces the discrete `--slide-font-scale`
  multiplier** as the source of text size.
- **Where it applies:** at the **SlideCanvas / canonical-stage level**, so the same computed fit flows to
  the Audience + Confidence output windows AND the Run-screen previews/thumbnails — this preserves WYSIWYG
  (the previews keep mirroring exactly what the projector shows). Auto-fit is NOT output-only.
- **Bounds:** scale **down** to avoid overflow AND **up** to fill, with a sane **max cap** so a two-word
  slide is not absurdly huge.
- **Granularity:** **per-slide** — each slide is fit independently (max readability, like ProPresenter).
- **Settings:** **remove the manual Size control** (`fontScale` sm/md/lg — the `slide-font-scale-*` radios
  in `SettingsView.vue`, the `SCALE_MAP`, and the `--slide-font-scale` var). **Keep** font **family** and
  **weight** (`fontFamily`, `fontWeight`). All render sites that read `--slide-font-scale` migrate to the
  new auto-fit scale (or drop the multiplier).

### Run-screen live view + thumbnails (R330)
- **Live "On screen" pane:** make it **smaller** — reduce it from the dominant 2/3 (`lg:col-span-2`) share
  so it no longer crowds out the thumbnails.
- **Thumbnails:** enlarge `RunFilmstrip` thumbs from **`w-32` (128px)** to **~`w-48` (192px)** so slide
  content is legible at a glance (keep the 1280×720 reference-stage scaling so text does not re-wrap).
- **Next-up preview:** keep it, sized alongside the smaller live pane.
- **Exact proportions:** ship sensible defaults; the exact px are tuned on the owner's real screen during
  the batched milestone-end UAT.

### End-of-item marker (R331) + macOS scrollbar (R332)
- **End marker:** replace the static "Next item →" span at the end of the filmstrip with an **end cap that
  names the next service item** ("End of item · Next: {item name}"), always rendered at the strip end so
  the operator sees the item is ending and what is coming.
- **Next-item data:** pass the next item's label into `RunFilmstrip` from `useRunControl` (it owns the slot
  model); do not recompute inside the presentational component.
- **Scrollbar (R332):** force an **always-visible styled scrollbar** on the filmstrip
  (`overflow-x: scroll` + a persistent `::-webkit-scrollbar` that does not rely on macOS overlay
  auto-hide), plus a subtle edge fade to signal more content off-screen.

### Claude's Discretion
- Exact fit algorithm details (binary-search step count, max-cap value), the precise live-pane column
  ratio and thumbnail px, the end-cap copy/styling, and the scrollbar/edge-fade styling are at Claude's
  discretion, consistent with existing run-component patterns.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/run/RunPreviewPair.vue` — `useScaleToFit()` (`:164-190`): ResizeObserver measuring a
  container and scaling a fixed 1280×720 reference stage (`REFERENCE_WIDTH/HEIGHT`, `stageStyle`). The
  nearest primitive to model per-slide auto-fit on.
- `src/components/slides/SlideCanvas.vue` — the single text-sizing choke-point: scoped rules (`:513-543`)
  compute `font-size: calc(<base> * var(--slide-font-scale))`; content wrapper (`:30-34`) is the box a
  fit-to-frame measurement targets. Font FAMILY is inherited via `--slide-font-family` (SlideCanvas never
  sets family/size directly).
- `src/composables/useOutputWindow.ts` (`:43-47`) — `rootStyle` injects `cssVarsFor(slideTypography)` +
  `fontFamily` into both output views; gates first paint on `fontReady`.
- `src/views/AudienceOutputView.vue` (root `:7`) and `src/views/ConfidenceOutputView.vue` (current pane
  `:22`, next pane `:45` with a static `scale(0.8)`) — the output containers R329 fills.
- `src/components/run/RunFilmstrip.vue` — scroll container (`:12` `.filmstrip-scroll overflow-x-auto`),
  fixed `w-32` thumbs (`:21`, `THUMB_WIDTH=128`), static "Next item →" end span (`:30`), scrollbar scoped
  styles (`:100-120`). The R330 thumb size, R331 end marker, and R332 scrollbar all live here.
- `src/utils/slideTypography.ts` — `SCALE_MAP {sm:0.85,md:1.0,lg:1.25}` + `cssVarsFor()` emitting
  `--slide-font-scale` / `--slide-font-family`. Removing the manual scale edits `SCALE_MAP`/`cssVarsFor`.
- `src/types/organization.ts` (`:63-67`, defaults `:163-167`) — `slideTypography {fontFamily, fontWeight,
  fontScale}`; R329 drops `fontScale`.
- `src/views/SettingsView.vue` (`:407-459`) — the Size radios (`slide-font-scale-sm/md/lg`) to remove;
  keep family (`:383-391`) + weight (`:396-404`).
- `src/composables/useRunControl.ts` (`:1123-1138`) — `filmstrip` derives the current item's slides; the
  next-item label for R331 is sourced here.

### Established Patterns
- Fixed 1280×720 reference stage + ResizeObserver scale (RunPreviewPair, RunFilmstrip) so text never
  re-wraps at small sizes (ARCHITECTURE.md:1675-1716). Auto-fit must set the STAGE's text scale, not the
  container transform, to stay WYSIWYG across output + previews + thumbnails.
- Scoped unlayered styles override Tailwind size classes without touching the template (STACK.md:256-267).
- Render sites reading `--slide-font-scale` (all affected by dropping it): `PresentationViewer.vue`,
  `useOutputWindow.ts`, `SlideCard.vue`, `SlideGrid.vue`, `EditSlideDrawer.vue`, SlideCanvas scoped rules.

### Integration Points
- Output views (Audience/Confidence) + in-app `PresentationViewer` + Run previews/thumbnails all render
  the same SlideCanvas stage — auto-fit computed once at the stage flows to all.
- Font family/weight vars stay; only the size multiplier is replaced by the measured scale.
</code_context>

<specifics>
## Specific Ideas
- Readability is judged at **projection distance** on the owner's real church Mac + projector — exact
  thumbnail px and live-pane ratio are tuned there during the batched UAT.
- WYSIWYG matters: the Run-screen previews must keep matching the projector output after auto-fit lands.
</specifics>

<deferred>
## Deferred Ideas
- Lyric editor / song UX (relabeled edit link, SongSelect link, Cancel→Close, manual Credits/CCLI, hidden
  History tab) — Phase 116.
- Audio (vamps, canned music) — backlog 999.13 storage cluster (out of milestone scope).
</deferred>
