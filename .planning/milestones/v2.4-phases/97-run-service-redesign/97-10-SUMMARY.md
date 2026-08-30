---
phase: 97-run-service-redesign
plan: 10
subsystem: testing
tags: [vue, run-control, vitest, broadcastchannel, behavioral-coverage]

# Dependency graph
requires:
  - phase: 97-09
    provides: redesigned RunControlView (State A pre-flight / State B live) + wiring/testids (run-rehearse-btn, run-blackout-btn, run-clear-btn, run-filmstrip-slide, run-live-status, run-next-preview, relocated run-go-live-btn)
  - phase: 97-08
    provides: useRunControl composable surface (rehearse/live/blackout/postBlackout, filmstrip indices, clock/elapsed)
provides:
  - "Behavioral coverage of the redesigned control screen against the REAL view + injected fake channel"
  - "R283 rehearse-without-screens (no window.open, live true, slide 0 posted)"
  - "R277 honest green-when-live (run-live-status green only once live, via rehearse or matched go-live)"
  - "R280 blackout via the B key + Black/Clear buttons with strictly-increasing seq (control + real placed-live session)"
  - "R282 in-item filmstrip click posts the GLOBAL array index + R276 scaled next-up"
  - "R276 go-live from the relocated pre-flight run-go-live-btn reaches placed + green live (owner fix #5)"
affects: [run-service-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse of the established control-suite harness (createFakeChannel/keydown/mountView) + output-suite go-live driver — new blocks are additive, zero source edits"
    - "State B is unreachable pre-live, so control-suite blackout/filmstrip/next-up blocks enter live via run-rehearse-btn (no window.open) first"
    - "Green-when-live asserted via the run-status--live class token on run-live-status (muted run-status--idle before)"

key-files:
  created:
    - .planning/phases/97-run-service-redesign/97-10-SUMMARY.md
  modified:
    - src/views/__tests__/RunControlView.test.ts
    - src/views/__tests__/RunControlView.output.test.ts

key-decisions:
  - "rehearse's slide-0 proof asserts the mount-posted index-0 state is still current (rehearse does not re-post since index is already 0), matching the composable's guarded rehearse()"
  - "window.open call count is captured via vi.mocked(window.open) (spied to null in the control-suite beforeEach) rather than a new spy, so the no-window assertion reads the existing stub"
  - "Blackout monotonic-seq is proven by collecting every state message's seq and asserting strict increase across B-key + Black/Clear posts"

patterns-established:
  - "Enter live via rehearse to reach State B in the control suite; assert green via the run-status--live class"

metrics:
  duration: ~15m
  completed: 2026-08-29
  tasks: 2
  files-modified: 2

status: complete
---

# Phase 97 Plan 10: Behavioral Coverage for the Redesigned Control Screen Summary

Extended the two RunControlView behavioral suites with the Phase 97 control coverage —
rehearse-without-screens (R283), honest green-when-live (R277), blackout via the B key +
Black/Clear with monotonic seq (R280), the in-item filmstrip click-to-jump posting the
GLOBAL array index + the scaled next-up (R282/R276), and go-live from the relocated
pre-flight panel reaching placed + green live (R276 owner fix #5) — all against the REAL
redesigned view + injected fake channel, no real window opened, no baseline regression.

## What was built

### Task 1 — `RunControlView.test.ts` (control suite, 13 → 16 tests)
Three new describe blocks, all driven through the real `useRunControl` + injected fake channel:
- **Rehearse without screens + live-green (R283/R277):** records `window.open`'s call count,
  clicks `run-rehearse-btn`, asserts the count is UNCHANGED (no window opened), the view is
  now live (`run-current-preview` present, `run-go-live-btn` gone), `run-live-status` carries
  the green `run-status--live` token (muted `run-status--idle` before), and `fake.states()`
  has an index-0 post still current.
- **Blackout via B + Black/Clear (R280):** after rehearse, `keydown('b')` posts `blackout:true`
  with a strictly higher seq; a second `keydown('b')` posts `blackout:false`; `run-blackout-btn`
  posts true and `run-clear-btn` posts false; every state seq is asserted strictly increasing.
- **Filmstrip jump + scaled next-up (R282/R276):** clicking the `run-filmstrip-slide` thumb
  whose `data-index` is 1 posts index 1 (the GLOBAL array index); `run-next-preview`'s html
  contains a `scale(` transform container.

### Task 2 — `RunControlView.output.test.ts` (output suite, 25 → 27 tests)
Two new describe blocks reusing the existing matched go-live driver + fake screens/windows:
- **Go-live from the pre-flight panel (R276/R277):** confirms State A (`run-preflight` +
  `run-go-live-btn`, `run-live-status` NOT green), then a matched go-live reaches
  `run-status-placed` AND turns `run-live-status` green — owner fix #5 end-to-end.
- **Blackout during a live session (R280):** after a matched go-live, `B` / Black / Clear post
  `blackout` true/false on the fake channel with strictly-increasing seq during the real placed
  live session.

## Behavioral confirmations
- **go-live → live:** matched go-live via the relocated pre-flight `run-go-live-btn` reaches
  `run-status-placed` + green `run-live-status`.
- **live-green:** `run-status--live` present ONLY after rehearse / matched go-live; `run-status--idle`
  before.
- **rehearse-no-window:** `window.open` call count unchanged across `run-rehearse-btn` click.
- **blackout-seq:** every blackout post keeps seq strictly increasing (control + real live session).
- **filmstrip-index:** the `data-index=1` thumb click posts state index 1.

## Deviations from Plan

None - plan executed exactly as written. No source files were edited (the redesign stayed frozen and green).

## Gate results
- `npx vitest run src/views/__tests__/RunControlView.test.ts src/views/__tests__/RunControlView.output.test.ts` — **2 files, 43 tests passed** (16 control + 27 output).
- `npm run type-check` (vue-tsc --build) — **clean**, no output.
- `npx vitest run` — **169 files / 4638 tests passed**; ONLY `src/storage.rules.test.ts` failed (25 timeouts, Storage-emulator dependent — the documented CLAUDE.md baseline, not chased). No `--dir src`; no rules suite invoked.

## Commits
- `e58c19c9` test(97-10): control-suite rehearse/live-green/blackout/filmstrip coverage (R283/R277/R280/R282)
- `a3259db2` test(97-10): output-suite go-live-from-preflight + live-session blackout (R276/R277/R280)

## Self-Check: PASSED
- FOUND: src/views/__tests__/RunControlView.test.ts
- FOUND: src/views/__tests__/RunControlView.output.test.ts
- FOUND commit: e58c19c9
- FOUND commit: a3259db2
