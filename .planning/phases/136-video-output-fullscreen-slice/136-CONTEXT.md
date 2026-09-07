# Phase 136: Video Output — Fullscreen Slice - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — a low-risk STRUCTURAL COPY of the v2.9 N-assignment role generalization (research flagged "skip research-phase"). Technical approach from `.planning/research/ARCHITECTURE.md` + a direct codebase scan.

<domain>
## Phase Boundary

Add a THIRD output type "Video" to the existing multi-monitor role system (alongside Audience + Confidence),
and render a slide sent to the Video output FULL-SCREEN (filling the entire video picture), reusing the
existing Audience render. Requirements: R424 (the Video output role/setup/route/view), R426 (fullscreen
Video render = reuse Audience render).

**This phase is the Fullscreen slice ONLY.** The per-slide-item Banner/Full-screen CHOICE (R425) and the
transparent-default banner (lower-third) render (R427) are Phase 137 — NOT here. In Phase 136, anything sent
to the Video output renders full-screen exactly like Audience.
</domain>

<decisions>
## Implementation Decisions

### R424 — Third "Video" output type (additive to the v2.9 N-assignment model)
- **Widen `MonitorRole`** in `src/utils/monitorConfig.ts` (line 20) from `'audience' | 'confidence'` to
  `'audience' | 'confidence' | 'video'`. Update the role-membership validation (`monitorConfig.ts:127`,
  the `role !== 'audience' && role !== 'confidence'` check) to include `'video'`.
- **MonitorSetupView.vue** offers Video as a third assignable role (a monitor can be assigned Audience /
  Confidence / Video). Video is OPT-IN — unlike Audience/Confidence there is no auto-default video monitor;
  a user assigns a display to Video when they want a live-stream feed.
- **New `VideoOutputView.vue`** — a sibling of `AudienceOutputView.vue`/`ConfidenceOutputView.vue`.
- **New static route** `/present/video/:serviceId` mirroring `/present/audience/:serviceId` (line 102) and
  `/present/confidence/:serviceId` (line 117) — presentation-only auth tier (requiresAuth only, any
  authenticated org member; same meta as the other two output routes).
- **`useRunControl.ts`** launches the Video output window keyed by the `'video'` role, reusing the existing
  N-assignment output-window launch machinery (openPlaced/openUnplaced). Add a `DEFAULT_VIDEO_ASSIGNMENT`
  only if the launch model requires a default entry; otherwise Video assignments come purely from the setup
  UI. The **go-live gate stays `>=1 Audience`** — Video is an OPTIONAL additional output, never required to
  go live.

### R426 — Fullscreen Video render (REUSE Audience render)
- `VideoOutputView.vue` renders the current slide FULL-SCREEN exactly like `AudienceOutputView.vue` — the
  slide (with its background) fills the entire output. Reuse the Audience render path/components; do NOT
  write a new rendering surface. It is driven by the same run-control channel/current-slide state as the
  other outputs (the projectionist's navigation drives all outputs together).
- No banner, no transparency, no per-item flag in this phase — a slide on the Video output is simply the
  full-screen slide. (Phase 137 adds the Banner mode + transparent-default render.)

### Claude's Discretion
- Whether `VideoOutputView.vue` is a thin wrapper delegating to the Audience render component vs a near-verbatim
  sibling — planner's call, but favor SHARING the Audience render (a wrapper) over copy-paste so Phase 137 can
  extend cleanly and there's one render definition.
- The exact MonitorSetupView UI treatment of the 3rd role (matching the existing Audience/Confidence controls).
- Default nickname/label for a Video-assigned monitor.
</decisions>

<code_context>
## Existing Code Insights (verified landmarks)

### Reusable Assets / Precedent (v2.9 N-assignment role generalization)
- `src/utils/monitorConfig.ts` — `MonitorRole` type (line 20), the role-membership check (line 127),
  `MonitorAssignment`, storage key, fingerprint model.
- `src/views/AudienceOutputView.vue` (the fullscreen render to REUSE) + `ConfidenceOutputView.vue` (sibling
  structure to mirror).
- `src/router/index.ts` — `/present/audience/:serviceId` (line 102) + `/present/confidence/:serviceId`
  (line 117) static routes + their presentation-only auth meta.
- `src/composables/useRunControl.ts` — `DEFAULT_AUDIENCE_ASSIGNMENT`/`DEFAULT_CONFIDENCE_ASSIGNMENT` (lines
  79-80), the go-live gate (`>=1 Audience`), the openPlaced/openUnplaced output-window launch, the run
  channel driving current-slide state.
- `src/views/MonitorSetupView.vue` — the per-monitor role assignment UI to extend to a 3rd role.

### Integration Points
- `MonitorRole` widen + validation; MonitorSetupView role option; new route + VideoOutputView; useRunControl
  launch-by-role. All ADDITIVE — the existing Audience/Confidence paths and the N-assignment model are
  unchanged except for the widened enum + the new 'video' branch.
</code_context>

<specifics>
## Specific Ideas

This is deliberately the LOW-RISK slice: a structural copy of v2.9's role generalization, shipped and
demoable on its own (a Video output that mirrors Audience full-screen). Keep it additive — do not disturb
the existing Audience/Confidence behavior, the go-live gate, or the N-assignment persistence. SHARE the
Audience render (don't fork it) so Phase 137's banner/transparency work has one render to extend.
</specifics>

<deferred>
## Deferred Ideas

Per-slide-item Banner/Full-screen CHOICE (R425) and the transparent-default banner (lower-third) render with
solid key-color fallback (R427) are **Phase 137**, not here. No "Fill+Key" hardware path (out of milestone
scope). Blackbird is irrelevant (owner decision).
</deferred>
