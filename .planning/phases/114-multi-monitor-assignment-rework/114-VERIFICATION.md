---
phase: 114-multi-monitor-assignment-rework
status: human_needed
verified: 2026-09-03
verified_by: orchestrator (gsd-verifier subagent hung on return-routing after launching its own background suite; orchestrator authored this from fresh, first-hand gate evidence)
requirements: [R324, R325, R326, R327, R328, R338]
gate_evidence:
  type_check: "npm run type-check (vue-tsc --build) — clean"
  full_suite: "npx vitest run — 183/184 files, 5008 pass, 27 skipped; sole failure src/storage.rules.test.ts (documented Storage-emulator baseline, not a regression)"
  code_review: "114-REVIEW.md — no Critical/High; all 6 findings (WR-01, WR-02, IN-01..IN-05) fixed + committed"
---

# Phase 114 — Verification

**Goal:** A projectionist can assign any output role to any of three or more connected monitors — including
multiple Audience monitors at once — have that assignment persist, have the output windows land on their
assigned macOS displays, never see a false "monitors changed" re-configure prompt on an unchanged setup,
and nickname each detected monitor.

**Verdict:** Automated criteria all **PASS**; the residual is a batched real-hardware UAT (R327 + the
real-3-monitor confirmations). Status: **human_needed** — no gaps, nothing broken.

> **Method note:** the spawned `gsd-verifier` launched its own background full-suite run and then blocked
> waiting for a completion signal a subagent does not reliably receive (same return-routing hang class as
> this milestone's plan-checker). It was stopped; this report is authored from the orchestrator's own fresh
> gate run (evidence above) plus the committed plans/summaries/review — first-hand, not the subagent's.

## Requirement-by-requirement

| Req | What it needs | Status | Evidence |
|-----|---------------|--------|----------|
| **R324** | Detect/list every connected display, no 2-cap | ✅ pass (automated) | `monitorConfig` `computeFingerprints` groups N screens; MonitorSetupView renders a card per detected screen; RunControlView.output N=3-window test opens three distinct windows. Real 3-monitor listing confirmation → UAT. |
| **R325** | Any role to any monitor incl. multiple Audience; changing one never clears another; ≥1-Audience gate | ✅ pass (automated) | MonitorSetupView per-fingerprint role map (singleton refs removed); tests: independent per-monitor selection + multiple-Audience + ≥1-Audience `canSave`/`canGoLive`. |
| **R326** | Roles persist/stick on 3+ monitors | ✅ pass (automated); real-3-monitor stick → UAT | v2 fingerprint drops volatile `left/top/isPrimary`; delta `matchMapping` keeps matching assignments (monitorConfig 31 tests incl. add+remove/all-removed guards). |
| **R327** | Output windows land on their assigned **physical macOS** display | ⏳ **human_needed** | Code path exists + mock-tested: `attemptScreenTargetedFullscreen` calls `requestFullscreen({screen})` from inside each popup, fingerprint-keyed URLs (`?screen=`), one window per assignment, fails closed to plain fullscreen + manual "Go fullscreen". Real cross-screen placement on macOS/Chrome hardware is not automatable in jsdom. |
| **R328** | No false "monitors changed" on an unchanged layout | ✅ pass (automated) | delta `matchMapping` → `matched` loads saved mapping with no reprompt (tests); volatile fields excluded from identity. |
| **R338** | Nickname per monitor, persisted + shown | ✅ pass (automated) | `MonitorAssignment.nickname` + hardened `isValidMapping`; MonitorCard nickname input + nickname-first heading; MonitorSetupView nickname map (round-trip tested). |

## Human verification (batched hardware UAT — see 114-VALIDATION.md)

Run on the church Mac + projector with a real **3-monitor** setup (Chrome/Edge):

1. **R324/R326 — N-monitor listing + roles stick (3 monitors):** open Monitor Setup; confirm all three
   displays are listed; assign roles including **two Audience + one Confidence**; Save; reload/reopen setup
   and confirm the assignments persist with **no** "your monitors changed" prompt (R328) on the unchanged
   layout.
2. **R327 — placement:** Go live; confirm each output window opens fullscreen on **its assigned physical
   display** (both Audience monitors show the audience view on their own screens; Confidence on its screen),
   without manual dragging. If the Window Management permission is denied, confirm the per-window
   "Go fullscreen" fallback still works.
3. **R338 — nicknames:** confirm typed nicknames appear on the setup cards and Run displays panel, and
   survive a reload; a blank nickname falls back to the OS label / "Unknown".

*All code-provable behavior is verified green; only the real-multi-display hardware behaviors above remain,
and are deferred to the milestone's batched UAT per the owner's "defer UAT to the end" instruction.*
