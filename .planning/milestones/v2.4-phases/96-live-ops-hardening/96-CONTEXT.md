# Phase 96: Live-Ops Hardening - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous run (discuss skipped; distilled from `.planning/research/` and the Phase 90–95 artifacts it hardens)

<domain>
## Phase Boundary

Make the live Run session survive real-world operating conditions — a **closed output window**, a
**monitor unplugged mid-service**, and a realistic service duration — WITHOUT losing the projectionist's
place or requiring a restart. This is the milestone's robustness capstone: it hardens the Phase 95
control screen + the Phase 93/94 outputs rather than adding new surfaces. Requirements: **R273, R274**.

IN SCOPE (primarily hardening `src/views/RunControlView.vue`; small additive touches only):
- **Sync robustness (R273):** the control screen is the single source of truth; the audience + confidence
  outputs stay in sync with the operator's navigation with no perceptible lag. The BroadcastChannel
  `postState`/`onState` + `seq` stale-drop + `hello`→resend handshake already deliver this (Phases 91/93/
  94/95) — this phase's job is to CONFIRM it end-to-end and close any residual gap (e.g. that a reopened/
  reloaded output re-syncs to the exact current index via the handshake, and that rapid navigation never
  drops or reorders on the outputs). Add a lightweight resilience only if a real gap is found; do NOT
  introduce a polling/heartbeat re-broadcast if the existing event-driven handshake already covers it.
- **Closed-window recovery (R274):** the control screen DETECTS when an output window is closed
  mid-service and offers **one-click reopen** WITHOUT losing the current slide position. Phase 95 stores
  the opened `Window` handles under stable names (`wp-audience`/`wp-confidence`). Detect closure by
  polling `handle.closed` on an interval (there is no reliable cross-window "closed" event for a
  popup the opener launched) and/or a `pagehide`/`beforeunload` signal from the output; on detection,
  mark that specific output "closed" and surface a calm **"Reopen Audience/Confidence"** affordance that
  re-runs Phase 95's open+place path for THAT output only. Because the control view holds the current
  `index` (single source of truth) and the reopened output `postHello`s → control `onHello` resends the
  current state, **position is restored automatically** — verify this rather than persisting position
  anywhere.
- **Monitor-unplug recovery (R274):** the control screen detects a physical display change mid-service
  and offers **one-click reassign/recovery** without losing position. Listen to `screens` /
  `currentscreenchange` on the `ScreenDetails` object obtained during Go-live (the same object Phase 92/
  the output windows listen to). On a change, re-run `matchMapping(loadMapping(), liveScreens)`; if the
  assigned monitor is gone (`needs-reprompt`), surface a first-class recovery affordance — reassign via a
  link to `/monitor-setup` (Phase 92) and/or reopen+replace the affected output — mirroring Phase 92's
  matched/reprompt language. The interval poll for `handle.closed` must be cleared on exit/unmount, and
  the `screenschange` listener removed on exit/unmount (no leak).
- **Endurance confirmation:** the session (channel handle, listeners, wake locks in the outputs) must
  survive a realistic service length without teardown; confirm the poll/listeners are cleaned up exactly
  once and nothing accumulates.

OUT OF SCOPE:
- Any NEW route/view/output surface — this phase only hardens existing ones.
- Blackout affordance (protocol field only) → out of scope for v2.4.
- Auto-advance / timed progression, transitions, remote companion → out of scope (REQUIREMENTS.md).

### Client-only constraint (ROADMAP success criterion 4 — MUST hold)
This milestone is confirmed **client-side only**. R273/R274 must be satisfied with **NO new Firestore
document and NO `firestore.rules` change**. If — and only if — one turns out to be genuinely required,
it MUST carry rules-test coverage verified via `npm run test:rules` (see CLAUDE.md's rules-suite notes).
The expected outcome is that none is needed; the plan should explicitly re-confirm this.
</domain>

<decisions>
## Implementation Decisions (verify exact shapes during plan-phase / pattern-mapping)

### Closed-window detection
- Poll the stored `Window` handles' `.closed` on a modest interval (e.g. ~1s) started when outputs open
  and cleared on exit/unmount. Per-output "open | closed" status drives the reopen affordance. Prefer a
  single shared interval over one per window. A `pagehide` beacon from the output (optional, additive) can
  make detection snappier but the poll is the reliable floor.
- Reopen reuses Phase 95's `openWindow`/`openPlaced`/`openUnplaced` for the single affected role; keep the
  honest state machine (placed/fallback/partial/blocked) and the stale-resolution guard (WR-01) intact.

### Monitor-unplug detection
- Hold the `ScreenDetails` reference from Go-live; add a `screenschange`/`currentscreenchange` listener that
  re-runs `matchMapping`. On `needs-reprompt`, first-class reassign (mirror Phase 92). Remove the listener
  on exit/unmount.

### Position preservation
- Do NOT persist the index externally. The control view is the single writer; the handshake
  (`postHello`→`onHello`→resend current `seq`+1) restores a reopened output to the exact current slide.
  Assert this in tests.

### Claude's Discretion
- The exact recovery UI (inline banners in the top-bar output-status cluster vs a small panel), the poll
  interval, and the copy are at Claude's discretion — follow the UI-SPEC produced for this phase and reuse
  Phase 95's output-status cluster + Phase 92's fallback language.
</decisions>

<code_context>
## Existing Code Insights (verify during plan-phase / pattern-mapping)
- `src/views/RunControlView.vue` (Phase 95) — stores output `Window` handles (`wp-audience`/`wp-confidence`),
  owns the `index` single-source-of-truth + `seq` writer + `onHello` resend + the honest output state
  machine (`idle|opening|placed|fallback|partial|blocked`) + `openWindow`/`openPlaced`/`openUnplaced` +
  the WR-01 stale-resolution guard (`goLiveRequestId`/`isUnmounted`) + `closeOutputs()`. This is the file
  Phase 96 hardens.
- `src/utils/runChannel.ts` (Phase 91) — `postState`/`onState`/`postHello`/`onHello`/`close`; the `seq`
  stale-drop that guarantees a reopened output never goes backward.
- `src/views/MonitorSetupView.vue` (Phase 92) — the `getScreenDetails()`/`screenschange` listener idiom and
  the matched/needs-reprompt handling to mirror for unplug recovery.
- `src/composables/useOutputWindow.ts` (Phase 93/94) — the outputs' `postHello`-on-mount handshake that
  makes reopen-restores-position work; and their own wake-lock/fullscreen recovery (already robust).
- `src/utils/monitorConfig.ts` — `loadMapping`/`matchMapping`/`computeFingerprint`.
- `.planning/research/PITFALLS.md` — Pitfall notes on closed-window detection, monitor hot-plug staleness,
  and Wake Lock endurance; `.planning/research/ARCHITECTURE.md` — the single-writer/handshake model.
- CLAUDE.md — the two test suites; `npm run test:rules` ONLY if a rules change is (unexpectedly) needed.
</code_context>

<specifics>
## Verification
- Unit tests (jsdom): simulate an output `Window` handle going `.closed=true` → the control surfaces the
  reopen affordance for that output and NOT the other; clicking reopen re-invokes the open path and (via a
  simulated `hello`) the control resends the CURRENT index (position preserved — assert the resent state's
  index equals the pre-close index). Simulate a `screenschange` where the assigned fingerprint is gone →
  `matchMapping` needs-reprompt → the reassign affordance appears; where it still matches → no false alarm.
  Assert the poll interval + `screenschange` listener are cleared/removed on exit and unmount (no leak).
  Confirm no new Firestore write/read is introduced (R273/R274 are pure client + channel).
- Gates per CLAUDE.md: `npm run type-check` (vue-tsc --build; `NODE_OPTIONS=--max-old-space-size=8192` if it
  OOM-crashes; NO `Array.prototype.at`) and bare `npx vitest run` (baseline `src/storage.rules.test.ts`
  only — do not chase; no `--dir src`). If (unexpectedly) a rules change is added, ALSO run
  `npm run test:rules`.
- **Human UAT (expected — deferred to milestone end):** actually closing an output mid-service and
  one-click reopening it onto the right monitor with the current slide intact; physically unplugging a
  monitor and recovering; and a full realistic-length service with no sync lag or teardown. The verifier
  marks these `human_needed`; the autonomous run defers.
</specifics>

<deferred>
## Deferred Ideas
- Snappier `pagehide`-beacon closed-window detection (additive over the poll floor) — include only if clean.
- Blackout affordance (protocol field only) → out of scope for v2.4.
</deferred>
