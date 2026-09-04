# Phase 114: Multi-Monitor Assignment Rework - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — grey areas proposed in batch, owner accepted all + added R338 (nicknames)

<domain>
## Phase Boundary

Rework the v2.4 single-select Audience/Confidence monitor-configuration model so a projectionist can
assign any output role to any of *N* connected monitors (including **multiple Audience** monitors),
have those assignments **persist and stay stuck** on a real 3-monitor setup, have the output windows
**land on their assigned physical displays on macOS/Chrome**, and never see a false "your monitors
changed" re-configure prompt on an unchanged layout. Adds per-monitor **nicknames** (R338) so displays
that report as a bare number or "Unknown" (common on macOS) can be identified confidently.

Delivers R324, R325, R326, R327, R328, R338. Scope is the Run-mode monitor setup + output-window launch
only — NOT the slide/thumbnail readability work (Phase 115) or lyric editor (Phase 116).
</domain>

<decisions>
## Implementation Decisions

### Monitor identity & the false "monitors changed" prompt (R326, R328)
- **Stable fingerprint:** identify a monitor by `label + WxH` only; **drop the volatile `left,top`
  position and `isPrimary`** from the fingerprint — those flip between macOS re-detects and are the root
  cause of the false "monitors changed" reprompt and the roles-not-sticking symptom.
- **Delta-only reprompt:** when a monitor is added/removed vs the saved mapping, **keep the matching
  assignments and prompt only for the delta** — never wipe the whole mapping and force a full reconfigure.
- **Identical monitors** (same label+resolution): disambiguate with a **stable index by sorted position
  captured at save time**, tolerant to small coordinate drift.
- **Migration:** bump the storage key (`wp:runMonitorConfig:v1` → `v2`); the old mapping is ignored with a
  one-time reconfigure rather than a risky in-place migrate.

### Role model — any role to any monitor, multiple Audience (R324, R325)
- **Cardinality:** each monitor holds **one role or none**; the **same role may repeat** — multiple
  Audience AND multiple Confidence monitors are both allowed. No monitor is forced to hold a role.
- **Interaction:** a **per-monitor role selector** (None / Audience / Confidence). Changing one monitor's
  role **never mutates another monitor** — this is what kills the reported "select Audience on one and it
  clears on the other" bug (a UI/state bug; the `MonitorAssignment[]` model already supports it).
- **Minimum to Run:** require **≥1 Audience**; Confidence is optional; Run is allowed with Audience only.
- **Single screen / nothing assigned (dev):** keep the existing pop-out-window + per-window "Go
  fullscreen" fallback path.

### Output-window launch across N displays incl. macOS (R327)
- **One output window per assignment:** N Audience windows each mirror the same AudienceOutputView; each
  Confidence window renders ConfidenceOutputView.
- **macOS placement:** **re-run `getScreenDetails()` at launch** for live coordinates, open the window
  then `moveTo`/`resizeTo` onto the target screen and `requestFullscreen()` there; if the Window
  Management API or its permission is unavailable, fall back to the existing per-window "Go fullscreen"
  button.
- **Coords source:** always taken **live at launch**; the saved mapping supplies only role-by-identity,
  never stale coordinates.

### Monitor nicknames (R338 — owner-added)
- A user can type a **nickname per detected monitor**, persisted alongside that monitor's identity
  (fingerprint) in the v2 mapping and shown on the setup/assignment UI (and reused wherever a monitor is
  labeled). Nickname persistence follows the same stable-identity rule so it survives re-detects; a blank
  nickname falls back to the OS label (or "Unknown").

### Claude's Discretion
- Exact selector control (segmented buttons vs dropdown), nickname edit affordance, and the precise
  delta-reprompt copy are at Claude's discretion, consistent with existing MonitorSetupView patterns.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/monitorConfig.ts` — the pure, framework-free persistence model: `ScreenLike`,
  `MonitorRole`, `MonitorAssignment[]`, `MonitorMapping`, `computeFingerprint`, `save/loadMapping`,
  `matchMapping` (bidirectional set-equality). **This is the primary file to rework** — fingerprint
  fields (R328), the mapping shape (add nickname, R338), and `matchMapping` → delta logic.
- `src/utils/__tests__/monitorConfig.test.ts` — existing unit coverage to extend (fingerprint stability,
  delta match, nickname round-trip).
- `src/views/MonitorSetupView.vue` (+ test) — the role-assignment UI; the single-select "unselect the
  other" bug lives here (R325).
- `src/composables/useOutputWindow.ts` (+ `__tests__/useOutputWindow.test.ts`) — output-window
  open/place/fullscreen; the macOS placement (R327) and one-window-per-monitor (R325) work.
- `src/composables/useRunControl.ts`, `src/views/RunControlView.vue`, `src/components/run/*`
  (`RunDisplaysPanel`, `RunPreflightPanel`, `MonitorCard`, `MonitorFallbackPanel`) — Run launch surface.
- `src/views/AudienceOutputView.vue`, `src/views/ConfidenceOutputView.vue` — the output views mirrored
  per window.

### Established Patterns
- Monitor config persists to **localStorage, not Firestore** (ARCHITECTURE.md Anti-Pattern 3; ADR-0183) —
  keep it device-scoped, pure, never-throws.
- Pure util modules are dependency-free and unit-tested in isolation (mirrors `lastUsed.ts`).
- Comment convention: short pointers; rationale in ADRs (docs/adr/), behavior in `.planning/codebase/`.

### Integration Points
- Window Management API (`getScreenDetails`) is Chromium-only with a permission gate — v2.4 already uses
  it with a pop-out+fullscreen fallback; extend, don't replace.
- Storage-key version bump (v1→v2) is the migration seam.
</code_context>

<specifics>
## Specific Ideas

- The multiple-Audience "unselecting" symptom and the roles-don't-stick-on-3-monitors symptom are the
  headline bugs — verify against a **real 3-monitor setup** (the owner tests on a church Mac + projector,
  the external-link hardware). Manual dragging is explicitly NOT an acceptable answer for macOS.
- Monitor nicknames were requested because macOS/Chrome frequently reports a bare number or "Unknown".
</specifics>

<deferred>
## Deferred Ideas

- Audio (vamps, canned music) — deferred to the backlog 999.13 storage cluster (out of milestone scope).
- Live-output font auto-scaling, thumbnail sizing, "end" marker — Phase 115.
</deferred>
