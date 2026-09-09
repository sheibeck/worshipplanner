# Phase 137: Video Output — Banner Render - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grounded in the codebase scan + `.planning/research/ARCHITECTURE.md`. Builds on Phase 136 (the Video output + shared `FullscreenSlideOutput.vue`). FINAL phase of v2.14.

<domain>
## Phase Boundary

Give a slide item a per-item choice to appear on the **Video** output as a bottom **Banner** (lower-third)
instead of full-screen, and render that banner fit to the lower region with the rest of the output
transparent by default (plus a configurable solid key-color fallback for chroma-key tools). Requirements:
R425 (per-item Banner/Full-screen choice — authoring UI + schema), R427 (the banner lower-third render:
transparent-default + solid key-color fallback; banner valid ONLY on the Video output).
</domain>

<decisions>
## Implementation Decisions

### Model (owner decision 2026-09-07): **Full-screen is the DEFAULT; Banner is the per-item exception**
- An unconfigured slide on the Video output renders **FULL-SCREEN** (Phase 136's behavior — fills the video
  picture like Audience). There is NO "empty/nothing" state. The per-item flag lets you make a specific
  slide a **Banner** instead. This matches "banner INSTEAD of full screen." **No transparent/black "unset"
  state to build** — transparency applies ONLY to the banner mode's non-content region.

### R425 — Per-item Banner/Full-screen choice
- Add `videoOutput?: { mode: 'banner' | 'fullscreen' }` to the base **`MediaAttachableSlot`**
  (`src/types/service.ts:39`), a sibling of the existing `loop?: { enabled, intervalSeconds }` field
  (line 57) — the exact per-item-field precedent. Absent OR `'fullscreen'` = full-screen (default);
  `'banner'` = lower-third. Additive/optional (no migration).
- Authoring: a per-item control in **`SlidesTab.vue`** (`src/components/slides/`) MIRRORING the `loop`
  control's relay pattern — a `@video-output-change` (or similar) event bubbled up through SlidesTab →
  `ServiceEditorView` persists onto `slot.videoOutput`, riding the existing `useAutoSave` deep-watch (no new
  save path), exactly like `@loop-change` → `slot.loop`.
- **Banner is meaningful ONLY for the Video output.** On the Audience/Confidence outputs the `videoOutput`
  field is IGNORED — those always render full-screen. Make this clear in the authoring UI (the control is
  about "how this slide appears on the Video/live-stream output").

### R427 — Banner (lower-third) render (transparent-default + key-color fallback)
- Extend the Phase 136 **`FullscreenSlideOutput.vue`** (or branch within the Video render path): when
  `role === 'video'` AND the current item's `videoOutput.mode === 'banner'`, render the slide fit to a
  **bottom lower-third region** (a `useContainScale` region constrained to the lower band, reusing
  `SlideCanvas`), with a **title-safe inset** and readable default text sizing (1–2 lines). The rest of the
  output (above the banner) is rendered **transparent by default** (CSS `background: transparent`) so a
  software compositor (OBS/vMix Browser Source) shows live stage video behind + the slide along the bottom.
- **Configurable solid key-color fallback:** a toggle "use a solid key color instead of transparent" + a
  color picker (`<input type="color">`, **default a saturated magenta `#FF00FF`**) for any downstream tool
  that needs chroma-key rather than an alpha source. When enabled, the banner's non-content region (and, in
  banner mode, the whole area outside the banner) is filled with the key color. Persist this setting where
  the Video output is configured — **planner's call on storage** (per-device localStorage alongside the
  monitor config is the leaning, since keying is a per-installation/video-room property, mirroring
  `MONITOR_CONFIG_STORAGE_KEY`; a per-org OrgSettings field is the alternative). Keep it discoverable near
  the Video output / Monitor Setup.
- **Full-screen mode (default) is UNCHANGED** — it renders exactly as Phase 136 (the shared fullscreen
  render). Banner is purely additive: a new branch for `mode === 'banner'` on the Video output only.

### Audience/Confidence unaffected
- Audience and Confidence outputs ignore `videoOutput` entirely and keep rendering full-screen — the shared
  `FullscreenSlideOutput.vue` behavior for `role !== 'video'` (and for Video fullscreen mode) is untouched.
  The unedited `AudienceOutputView.test.ts` must stay green (banner is a Video-only branch).

### Claude's Discretion
- The exact banner height/proportion (a lower-third ≈ bottom 25–33%), the title-safe inset value, and the
  banner text layout — favor legibility over live video.
- Storage of the key-color setting (per-device localStorage vs per-org) — pick the simpler, and keep the
  transparent-default so the common software-compositor path needs zero config.
- The SlidesTab control's exact affordance (a small Banner/Full-screen segmented toggle or a checkbox
  "show as lower-third banner on the Video output").
</decisions>

<code_context>
## Existing Code Insights (verified landmarks)

### Reusable Assets / Precedent
- `src/types/service.ts` — `MediaAttachableSlot` (line 39) + the `loop?: { enabled, intervalSeconds }` field
  (line 57): the per-item optional-field precedent `videoOutput` mirrors.
- `src/components/slides/SlidesTab.vue` — the per-item authoring surface + the `@loop-change` relay pattern
  (`(e:'loop-change', index, loop)`) to mirror for `videoOutput`.
- `src/views/ServiceEditorView.vue` — persists per-item fields onto the slot (the `loop` persistence path),
  riding `useAutoSave`.
- `src/components/output/FullscreenSlideOutput.vue` (Phase 136 — the shared render to extend with the banner
  branch) + `src/components/slides/SlideCanvas.vue` (the slide render) + `useContainScale` (the fit-to-region
  scaler already used for fullscreen).
- `src/utils/monitorConfig.ts` (`MONITOR_CONFIG_STORAGE_KEY` — the per-device persistence precedent for the
  key-color setting if per-device is chosen).

### Integration Points
- `MediaAttachableSlot.videoOutput` field; SlidesTab control + ServiceEditorView persistence; the banner
  branch in the Video render; the key-color setting storage + a control near Monitor Setup / the Video output.
</code_context>

<specifics>
## Specific Ideas

This is the one genuinely NEW rendering surface in v2.14, but it's tightly scoped: a per-item field (loop
precedent), a SlidesTab control (loop-change precedent), and a banner branch on the Phase-136 shared render
(transparent-default + key-color). Keep full-screen (the default) byte-identical to Phase 136 — banner is a
purely additive Video-only branch. Blackbird is irrelevant (owner decision); no hardware dependency.
</specifics>

<deferred>
## Deferred Ideas

Banner backing-bar / drop-shadow contrast-treatment differentiator → backlog (basic banner legibility —
title-safe inset + readable text — stays in scope). "Fill + Key" dual-output hardware path → out (software
compositor path only). No per-item "nothing/hidden on Video" state (owner chose fullscreen-default).
</deferred>
