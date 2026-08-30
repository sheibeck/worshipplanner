# Phase 97: Run Service Redesign - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Owner UAT-driven redesign (v2.4 milestone held open for hardware UAT; this is the follow-up).

<domain>
## Phase Boundary

Redesign the live "Run the Service" experience to match the owner's approved Claude Design
(`Run Service.dc.html`, distilled in `97-UI-SPEC.md`) and fix six concrete UX issues found during
hardware UAT. This supersedes the Phase 95 control-screen layout and the Phase 94 confidence split,
while PRESERVING all the underlying correctness machinery from phases 92–96.

IN SCOPE:
- **`RunControlView.vue` full redesign** into two live-operator states + a richer recovery surface:
  - **Pre-flight (State A):** a centered "Ready when you are" panel (moves Go-live OUT of the corner —
    owner fix #5): service readiness, the two display cards (assigned monitor, "Not open" until live),
    an honest "all N slides rendered" check, a **▶ Go live** primary action, and a **Rehearse without
    screens** secondary action.
  - **Live (State B):** header with an honest **live status that turns GREEN on go-live** (owner fix #4),
    **Clock + Elapsed** timers, the Displays cluster, and **End service**; a left order-of-service rail
    whose active item expands to its slides; a **Program / Next-up** preview split (Next-up at a SMALLER
    scaled font — owner fix #2); an **in-item slide filmstrip** with click-to-jump; an **Output** panel
    with **Black / Clear** (blackout) controls; and a bottom **transport bar** with the keyboard legend +
    service progress.
  - **Displays/recovery (State C):** promote the Phase 96 recovery to a full-width red bar on a closed
    output + a Displays panel with per-output thumbnails and Reopen / reassign actions.
- **`ConfidenceOutputView.vue`:** change the current+next layout from the Phase 94 VERTICAL 70/30 split
  to a side-by-side **left/right** split (owner fix #1); keep black-suppression + last-slide no-reflow.
- **Output windows self-fullscreen** on load via the granted window-management permission so they default
  to fullscreen on the assigned monitor (owner fix #6); the manual "Re-enter fullscreen" becomes a
  fallback that auto-attempts once.
- **`ServicesView.vue`:** a **Run** affordance on each LOCKED service row beside the existing actions
  (owner fix #3), gated `isLocked && orgId` (viewer-inclusive), → `/run/:serviceId?org=`.
- **Blackout/Clear** (owner-approved): wire the run channel's existing `blackout` field (Phase 91) —
  Black posts `blackout:true`, Clear posts `blackout:false`; output windows render a black overlay when
  true; bind the reserved **`B`** key. (OMIT Logo — no asset.)
- **Clock + Elapsed timers**, **in-item filmstrip**, **Rehearse without screens** (all owner-approved).

OUT OF SCOPE (omit — no data/system behind them; building would be fake UI):
- Activity feed / "N people watching" / presence; CCLI-number preflight validation; Key/BPM;
  "Follow me on confidence"; Logo-cut output; the Stage / 3rd output window (v2.4 is audience+confidence;
  "Stage" may appear only as a disabled "Off" placeholder in the Displays panel).
- Slide transitions/fades; auto-advance; remote companion — remain out of scope (REQUIREMENTS.md).

## Preserve (do NOT regress — carried from phases 92–96)
Single-writer channel + monotonic `seq` + `onHello` resend; the honest open state machine
(`idle/opening/placed/fallback/partial/blocked`) + WR-01 stale guard; non-destructive reopen +
`screenschange` reassign + poll cleanup on exit/unmount; confidence black-suppression + last-slide
no-reflow; receive-only outputs never `postState`; RBAC (any member can Run a locked service);
`useServiceAssembly`/`useOutputWindow` boundaries.
</domain>

<decisions>
## Implementation Decisions (verify exact shapes during plan-phase / pattern-mapping)

### Blackout (first real use of the channel `blackout` field)
- Control posts `blackout` in `RunState`; output windows (`AudienceOutputView`, `ConfidenceOutputView`)
  render a full-bleed black overlay when `blackout === true`, over/instead of the SlideCanvas. `B` toggles
  it. "Clear" = `blackout:false` (return to slide). The control screen indicates the blackout state.
  Confirm the exact `RunState`/`postState` plumbing (Phase 91 `runChannel.ts`, Phase 95 `postIndex`).

### Output self-fullscreen (owner fix #6 — the technical crux)
- The reliable path: each output window requests its OWN fullscreen. On mount, with the window-management
  permission already granted (Phase 92), resolve the assigned screen (via the saved mapping / a query
  param the control passes) and call `document.documentElement.requestFullscreen({ screen })` from the
  output's own context. Replace RELIANCE on the control's cross-document
  `win.document.documentElement.requestFullscreen()` (`RunControlView.vue:980`, unreliable). The
  `useOutputWindow` fullscreen-recovery affordance stays as a fallback and should auto-attempt once
  before rendering the manual button. This is best-effort and only fully provable on hardware (human-UAT).

### Live status (owner fix #4 — diverge from the design's red)
- Pre-live: display dots muted/amber "Not open". On Go live: the live indicator + display dots turn GREEN.
  Do NOT show an alarming red "LIVE" dot before the operator is actually live.

### Confidence left/right (owner fix #1)
- Side-by-side: current dominant on the LEFT, next on the RIGHT; both `suppressBackground`. Keep Phase 94's
  hard black-suppression invariant and the last-slide (no next) no-reflow behavior.

### Palette
- Run surfaces adopt the Nocturne blurple accent (#9184d9) as a Run-screen-scoped palette (see 97-UI-SPEC
  tokens); do NOT retheme the rest of the app. Match the design's header/rail/ground colors.

### Claude's Discretion
- Exact grid proportions, component decomposition (likely several new child components + composables for
  the timer and filmstrip), and copy — follow `97-UI-SPEC.md` and existing conventions. Keep the big
  `RunControlView.vue` maintainable (extract child components where the design's regions are natural
  seams: header, rail, preview pair, filmstrip, transport, displays panel).
</decisions>

<code_context>
## Existing Code Insights (verify during plan-phase / pattern-mapping)
- `src/views/RunControlView.vue` (Phases 95/96) — the control screen being redesigned; holds the channel
  single-writer, rail, preview, keyboard, exit-confirm, Go-live orchestration, closed-poll + reassign.
  The cross-document fullscreen attempt is at ~`:980`.
- `src/views/ConfidenceOutputView.vue` (Phase 94) — the 70/30 vertical split → change to left/right.
- `src/views/AudienceOutputView.vue` + `src/composables/useOutputWindow.ts` — output windows; the
  fullscreen-recovery affordance (`useOutputWindow.ts:~100`) → add self-fullscreen-on-load + auto-attempt.
- `src/components/slides/SlideCanvas.vue` — the renderer for program/next/filmstrip thumbnails; supports
  `suppressBackground`/`interactive`; needs a black-overlay path for blackout (or the output view overlays).
- `src/utils/runChannel.ts` (Phase 91) — `RunState { index, blackout, seq }`; blackout field already exists.
- `src/utils/serviceSlots.ts` — `sortedSlotsWithIndex` / `firstAssembledIndexBySlot` for the rail + filmstrip.
- `src/utils/monitorConfig.ts` — `loadMapping`/`matchMapping`/`computeFingerprint` for the display cards.
- `src/views/ServicesView.vue` — the service listing + existing row actions (print/share) for the Run button.
- `src/views/ServiceEditorView.vue` — the existing Run button (`canRunService = isLocked && !!orgId`,
  `run-service-btn`) — mirror its gating for the ServicesView row button.
- `97-UI-SPEC.md` — the distilled design contract (Nocturne tokens + the three states). Raw design is
  re-fetchable via the DesignSync tool `get_file` on project `e8e6c287-...`, `Run Service.dc.html`.
</code_context>

<specifics>
## Verification
- Unit tests (jsdom): Go-live from the pre-flight panel; live status turns green on go-live (not before);
  Rehearse enters live state WITHOUT `window.open`; Black/Clear post `blackout:true/false` + `B` toggles
  (assert against the injected fake channel); Next-up renders at a smaller scale; the in-item filmstrip
  lists the active item's slides and click jumps (posts the right index); confidence renders current+next
  LEFT/RIGHT both suppressed (no `presentation-background`), last-slide no-reflow; the ServicesView Run
  button appears on a locked row (viewer-inclusive) and navigates. Preserve ALL prior behavioral tests
  (Phase 94/95/96 suites stay green): single-writer seq, onHello resend, exit-confirm, closed-poll/reopen,
  reassign precedence, no-leak. Self-fullscreen: assert the output requests fullscreen on mount when a
  screen is resolvable (mock), no throw when not.
- Gates per CLAUDE.md: `npm run type-check` (vue-tsc --build; `NODE_OPTIONS=--max-old-space-size=8192` if
  OOM; NO `Array.prototype.at`) and bare `npx vitest run` (baseline `src/storage.rules.test.ts` only; no
  `--dir src`). No Firestore/rules change expected (client-only).
- **Human UAT (deferred to milestone end):** the full redesign on real hardware — Go-live → both outputs
  auto-fullscreen on the right monitors; confidence left/right legibility; blackout on the projector;
  timers; filmstrip navigation; closed/unplug recovery; and the overall run/stop feel. Adds to the
  existing v2.4 DEFERRED-HUMAN-UAT.md set.
</specifics>

<deferred>
## Deferred Ideas
- Logo-cut output (needs a logo asset + config); presence/activity; CCLI preflight; Key/BPM; Stage 3rd
  output; "Follow me on confidence" — revisit only if the owner requests and the backing data exists.
</deferred>
