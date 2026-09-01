# Phase 106: Per-Item Loop Playback - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, auto-optimized from v2.7 research ARCHITECTURE/PITFALLS + owner decisions)

<domain>
## Phase Boundary

Let an operator mark any service item to **auto-advance and loop its own slides** during Run — e.g. a
pre-service or post-service looping slide set. In scope: R306 (per-item loop checkbox; auto-advance +
loop back to the item's first slide), R307 (configurable interval, default 10s, preset dropdown + custom,
persisted with the item), R308 (timer never fights manual nav, tears down cleanly, no leaks/desync; plus
an explicit, tested decision on the "Go to black" ↔ loop interaction). Out of scope: cross-item
auto-advance (a loop stays WITHIN its item), any rehearsal/storage work, blackout-slide authoring (Phase 105).
</domain>

<decisions>
## Implementation Decisions

### Loop model & authoring (R306, R307)
- **Additive, optional loop config on the service item** (no migration): a `loop?` shape carrying an
  enabled flag + interval in ms (e.g. `{ enabled: boolean, intervalMs: number }`, default interval
  10000). Persist with the item like any other item field; absent/`enabled:false` ⇒ current behavior.
- **Authoring UI:** a per-item **"Loop" checkbox** in the Service Order item editor (near the item's
  existing controls), and when checked, an **interval control** — a preset dropdown (**5s, 10s (default),
  15s, 20s, 30s, 60s**) plus a **custom** numeric entry (seconds). The chosen interval persists.
- **Loop semantics:** during Run, a looping item's slides **auto-advance on the interval and, when the
  last slide is reached, loop back to the item's FIRST slide** — it does NOT auto-advance into the next
  service item. Looping is only meaningful for multi-slide items; a single-slide looping item is a
  harmless no-op (stays put).

### Timer correctness (R308) — the risky part
- **Route the auto-advance through the existing Run choke point.** The loop timer lives in a small
  `setInterval`/`clearInterval` composable driven from `useRunControl.ts`, and every advance goes through
  the **same `postIndex()` navigation choke point** manual navigation uses — so the loop and manual nav
  can never fight or double-drive the output window.
- **Clean teardown — no leaked timers, no control↔output desync.** The timer stops/resets cleanly when:
  the operator manually navigates (arrow/space/click) — restart the interval from the new position if
  still on the looping item; the current item changes to a non-looping item; the operator leaves the Run
  screen (route change / unmount); or the run ends. Clear on unmount. Only ONE loop timer is ever active.
- **"Go to black" ↔ loop decision (explicit, per the standing flag): "Go to black" PAUSES the loop.**
  When the operator triggers the runtime "Go to black" (now Audience-only, Phase 105), the loop timer is
  **paused**; restoring from black **resumes** it. Rationale: "Go to black" is an operator "hold" — letting
  slides silently advance behind the blackout would desync what the operator sees on the confidence monitor
  from the frozen audience, and land them on an unexpected slide when they un-black. **This behavior MUST
  be verified in a REAL output window, not just the control screen** (R308's 4th criterion).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/composables/useRunControl.ts` — Run control state + the `postIndex()`/navigation choke point the
  loop timer must route through; also owns "Go to black" state.
- `src/utils/runChannel.ts` — BroadcastChannel to the output windows (no protocol change expected; the
  loop drives the same index navigation).
- The Service Order item editor component (per-item controls) — where the Loop checkbox + interval control
  mount. Find it under src/components/src/views (the service-order editor, NOT the Slides tab).
- The service item type (src/types/…service…) — additive `loop?` field.

### Established Patterns
- Additive, optional, no-migration model changes.
- Run navigation is single-writer to the output window via runChannel; keep it that way (one timer,
  routed through postIndex).
- Composable-scoped timers with onUnmounted cleanup (mirror existing composable teardown discipline).

### Integration Points
- Item editor (authoring) → item model (`loop`) → Run control reads it and arms/disarms the timer as the
  current item changes → postIndex drives the output window.
- "Go to black" state in useRunControl gates (pauses) the timer.
</code_context>

<specifics>
## Specific Ideas

- Owner intent (verbatim): "Allow an option to loop an item in the service … a looping set of slides at
  the beginning or end … a checkbox that marks this item as looping, and you loop back to the beginning.
  It should default to some reasonable period of time before advancing slides, maybe with a dropdown box
  of options? Default to every 10 seconds, with an option to modify that number."
</specifics>

<deferred>
## Deferred Ideas

- Cross-item auto-advance / a whole-service auto-run — out of scope; a loop stays within its own item.
- Per-slide dwell times (different interval per slide) — one interval per looping item for v2.7.
</deferred>
