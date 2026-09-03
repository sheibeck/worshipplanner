---
phase: 114-multi-monitor-assignment-rework
plan: 02
subsystem: ui
tags: [monitor-setup, role-assignment, nicknames, run-mode, vue]

# Dependency graph
requires:
  - "114-01: computeFingerprints, delta matchMapping (MatchResultV2), MonitorAssignment.nickname"
provides:
  - "MonitorSetupView role state = per-fingerprint role map (roleByFingerprint) + nickname map (nicknameByFingerprint), replacing the two singleton audience/confidence refs"
  - "MonitorCard: None option (first radio), optional nickname input, nickname-first heading (nickname → OS label → 'Unknown')"
  - "≥1-Audience Save gate (canSave); independent per-monitor selection (changing one card never mutates another)"
  - "delta-aware reprompt: a 'partial' match pre-selects kept assignments and prompts only for newly-added screens (no wipe-everything banner)"
affects: [114-03-run-control]

# Tech tracking
tech-stack:
  added: []
---

# Phase 114 — Plan 02 Execution Summary

> **Close-out note:** The executor committed both tasks atomically, then was terminated by a transient
> API 529 (Overloaded) before it could write this SUMMARY or run the verification gates. The orchestrator
> verified the committed work green (type-check clean; MonitorSetupView 16/16 + MonitorCard 9/9; full suite
> 183/184 files at the documented `storage.rules.test.ts`-only baseline, 4999 tests pass) and wrote this
> close-out rather than re-executing (which would double-apply the same edits). No work was lost.

## What Was Built

Reworked the Run-mode Monitor Setup role-assignment UI so a projectionist can assign any role to any of N
monitors — including **multiple Audience** — with independent per-monitor selection, a None option,
per-monitor nicknames, and a delta-aware reprompt, consuming Plan 01's v2 `monitorConfig` contract.

1. **MonitorCard (Task 1, `bb01c2e6`):** added a **None** entry as the first role radio (aria-checked off
   `selectedRole === null`), a `nickname` prop + `update-nickname` emit with an optional text input, and a
   **nickname-first heading** (nickname if present → OS screen label → "Unknown"). The placeholder fallback
   is render-time only — a blank nickname stays blank in storage (per RESEARCH anti-pattern). Existing
   resolution line + Primary badge retained.

2. **MonitorSetupView (Task 2, `c7eab844`):** replaced the two singleton `audienceFingerprint` /
   `confidenceFingerprint` refs with a **per-fingerprint role map** (`roleByFingerprint`) plus a
   `nicknameByFingerprint` map — **this is the exact fix for the "select Audience on one monitor, it clears
   on the other" bug (R325)**: each card's selection is independent, and the same role may repeat across
   monitors. Added `canSave` = at least one Audience assigned (the ≥1-Audience Save gate), and delta
   consumption of `MatchResultV2`: a `partial` result pre-populates the kept cards (role + nickname) and
   surfaces only the new screen(s) under a "we found a new display" affordance, instead of the old
   wipe-everything "your monitors changed" banner. Retired `sameMonitorSelected` and the "Choose two
   different displays" copy.

## Task Commits
1. **MonitorCard — None option + nickname input + nickname-first heading** — `bb01c2e6` (feat)
2. **MonitorSetupView — per-fingerprint role map, ≥1-Audience gate, independent selection, delta reprompt, nickname state** — `c7eab844` (feat)

## Files Created/Modified
- `src/components/MonitorCard.vue` — None radio, nickname input + emit, nickname-first heading
- `src/components/__tests__/MonitorCard.test.ts` — 9 tests (three radios incl. None; None checked/emits null; nickname-as-heading + empty-nickname label fallback; nickname input emits)
- `src/views/MonitorSetupView.vue` — per-fingerprint role/nickname maps replace singleton refs; canSave ≥1-Audience; delta 'partial' reprompt
- `src/views/__tests__/MonitorSetupView.test.ts` — 16 tests (independent per-monitor selection incl. multiple Audience; ≥1-Audience gate; matched summary no-reprompt; partial pre-selects kept + prompts only new)

## Requirement Coverage (this plan)
- **R325** (multiple Audience / no cross-clear) — delivered on the assignment side here; the launch side lands in Plan 03.
- **R324** (list all N monitors, no 2-cap) — the setup UI renders a card per detected screen; Run-side launch in Plan 03.
- **R338** (nicknames) — UI input + persistence wiring (model from Plan 01).
- **R328** (no false reprompt) — the delta 'partial' consumption is the UI half; matchMapping logic from Plan 01.

*Phase-level confirmation of R324/R325 across the setup + run surfaces is the verifier's job at phase end.*

## Verification
- `npm run type-check` (`vue-tsc --build`): clean.
- `npx vitest run src/views/__tests__/MonitorSetupView.test.ts src/components/__tests__/MonitorCard.test.ts`: 25/25 pass.
- `npx vitest run` (full): 183/184 files, 4999 tests pass, 27 skipped; sole failing file `src/storage.rules.test.ts` is the documented Storage-emulator baseline (unrelated).

## Deviations from Plan
None in the implementation. Process deviation only: the executor was killed by a transient API 529 after
its atomic task commits; the orchestrator closed the plan out (verify + this SUMMARY + tracking) instead of
re-running. No `--no-verify`, no partial/uncommitted edits — the tree was clean at the failure boundary.

## Next Phase Readiness
- Plan 03 (useRunControl / RunDisplaysPanel / RunPreflightPanel N-window orchestration) can consume the
  per-fingerprint role map and nicknames; the assignment UI is complete.

---
*Phase: 114-multi-monitor-assignment-rework*
*Completed: 2026-09-03 (close-out by orchestrator after transient-529 executor termination)*
