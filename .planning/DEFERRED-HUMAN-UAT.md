# v2.4 — Deferred Human-UAT Items

Per the autonomous run directive ("run autonomously and defer human verification to the end"), each
phase's verifier marks hardware/browser-permission items as `human_needed` rather than failing. They
are collected here and presented to the owner at milestone end. Everything below is a **structural
limit of unit testing** (real permission prompts, physical multi-monitor hardware, real fullscreen /
wake-lock behavior over a service length), NOT a known defect.

## Phase 92 — Monitor Configuration Screen (verified 2026-08-28, pass-with-deferred-human-UAT)

1. Real Window-Management permission **grant** + multi-monitor detection on Chrome/Edge — the prompt
   appears and real monitor cards render for the connected displays.
2. Real permission **deny** / API-absent browser (Firefox/Safari) — the first-class fallback panel is
   shown (never a dead end).
3. **Drag + fullscreen** manual fallback path on real hardware actually produces fullscreen output on
   the target monitor.
4. Backstop (visual): a **3+ monitor** setup wraps the card grid at `md:grid-cols-2` without layout
   breakage. (Label truncation itself IS unit-verified via `MonitorCard.test.ts`; only the 3+ grid-wrap
   remains human.)
