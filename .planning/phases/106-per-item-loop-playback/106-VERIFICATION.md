---
phase: 106-per-item-loop-playback
verified: 2026-09-01T06:15:00Z
status: human_needed
score: 6/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Confirm per-item loop on a REAL second display (106-02 Task 4, R308 #4)."
    expected: "1) A multi-slide looping item auto-advances on its interval on the physical Audience output and wraps to the item's FIRST slide (never into the next item). 2) A mid-interval manual arrow-key nav takes effect immediately and the next auto-advance is a full interval later. 3) Navigating to a non-looping item stops auto-advance; returning resumes it. 4) 'Go to black' stops the slides advancing behind the blackout; restoring resumes without an unexpected jump. 5) Exiting Run and reopening starts clean with nothing still ticking."
    why_human: "The plan (106-02 Task 4, `checkpoint:human-verify gate=\"blocking\"`) explicitly requires this be checked in a REAL output window on physical hardware, not just the control screen or a faked BroadcastChannel/window harness — go-to-black pause/resume and control↔output sync 'can only be fully trusted on a physical output window.' This run's own SUMMARY records the checkpoint as deferred/NOT approved ('a PENDING deferred item, not accepted or approved'), and no later STATE.md/PENDING-VERIFICATION.md entry shows it was subsequently run. The automated output-window-context test (`RunControlView.loop.test.ts`'s go-to-black case, asserting `fake.posted` on a matched go-live with both fake output windows open) stands as the R308 #4 evidence for code correctness, but does not substitute for the plan's own real-hardware gate."
---

# Phase 106: Per-Item Loop Playback Verification Report

**Phase Goal:** An operator can mark any service item to auto-advance and loop its own slides during Run,
with predictable, leak-free start/stop behavior.
**Verified:** 2026-09-01T06:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A per-item Loop checkbox renders in the Service Order item editor, editor-only, draft-locked, with a preset/custom interval control (R306 authoring, R307) | ✓ VERIFIED | `src/views/ServiceEditorView.vue:1310-1355` — `slot-loop-row`/`slot-loop-checkbox`/`slot-loop-preset`/`slot-loop-custom-seconds` render verbatim per 106-UI-SPEC.md §1, gated `v-if="canEditService"`; 10 scoped tests in `ServiceEditorView.test.ts` (describe block "Service Order — per-item loop authoring (R306/R307)") pass, run live: 350/350 in that file |
| 2 | During Run, a looping multi-slide item auto-advances on its interval and, from the last slide, loops back to the item's FIRST slide — never into the next item (R306 runtime) | ✓ VERIFIED | `useRunControl.ts:1160-1167` `advanceLoop()` wraps within `filmstrip.value.indices` only, never calls `goByItem`; behavioral test `RunControlView.loop.test.ts` "auto-advances 0→1→2 then wraps to the item FIRST slide, never leaving slotIndex 0" — run live, passes; second test confirms `index === 3` (next item) never occurs |
| 3 | Loop interval defaults to 10s, changeable via preset dropdown or custom entry, and persists with the item (R307) | ✓ VERIFIED | `src/types/service.ts:77` `MediaAttachableSlot.loop?: { enabled, intervalSeconds }`, default 10 on first check (`onToggleLoop`); `loopPresetFor` round-trip test (intervalSeconds=45 → renders "Custom…" pre-filled with 45, never snaps to a preset) passes; 5 clamp-on-blur cases (0, -5, '', 'not-a-number', 9999) pass; persistence rides the existing single `useAutoSave(localService, ...)` deep-watch — no new save call added (confirmed by code read, no new save-path grep hits) |
| 4 | Manual navigation never fights the loop — a mid-interval manual nav restarts the interval from the new position, and a manual press is never overruled by a stale tick (R308) | ✓ VERIFIED | `useLoopTimer.arm()` always `disarm()`s first (`useLoopTimer.ts:38-41`); `reconcileLoop()` is called at the end of `postIndex()` (`useRunControl.ts:135`), so every manual nav re-arms fresh; behavioral test "a manual nav mid-interval restarts the clock" asserts the leftover ~5s of the old clock does NOT fire and the new full interval does — run live, passes |
| 5 | Timer tears down cleanly on item-change, route-away/unmount, and run-end, with only ONE active timer ever and no leaks or control↔output desync (R308) | ✓ VERIFIED | `useLoopTimer` holds exactly one `intervalId`, `onUnmounted(disarm)` registered unconditionally; `reconcileLoop()` wired from `watch(currentSlotIndex)`, `watch(live)`, and (post-code-review fix WR-01) `watch(() => filmstrip.value.slides.length)`; explicit `loopTimer.disarm()` in `endServiceTeardown()` AND (post-review fix WR-02) `endRehearsal()`. 4 dedicated behavioral tests (single-slide no-op, item-change disarm, unmount teardown, WR-01 async-render-arms-without-nav, WR-02 end-rehearsal-disarms) all pass live. Independent code review (106-REVIEW.md) traced every path adversarially and found/fixed 2 real watcher-ordering gaps before sign-off (`fix_status: all_fixed`) |
| 6 | "Go to black" PAUSES the loop and restoring RESUMES it, verified in an output-window context (R308 #4) | ✓ VERIFIED | `postBlackout()` calls `reconcileLoop()` synchronously after setting `blackout.value` (`useRunControl.ts:152-160`) — disarm on true, re-arm (fresh clock) on false. Test "'Go to black' PAUSES the loop and clearing it RESUMES" uses a MATCHED go-live with BOTH fake output windows opened (`installGetScreenDetails([screenA, screenB])` + `seedMatchingMapping` + `goLiveFake`), toggles the real `run-blackout-toggle` control, and asserts against `fake.posted` state messages (the exact objects the output windows receive) that no content-advancing state is posted while black and exactly one advance fires a full interval after resume — run live, passes |
| 7 | Real-hardware, real-second-display confirmation of the above (106-02 Task 4, `checkpoint:human-verify gate="blocking"`) | ? UNCERTAIN → human_needed | 106-02-SUMMARY.md explicitly records this checkpoint as **deferred, NOT approved**: "a PENDING deferred item, not accepted or approved... The real-hardware spot-check should still be performed before the v2.7 milestone is archived." No later artifact (STATE.md, PENDING-VERIFICATION.md) shows it was subsequently run. Per the task brief, this is recorded as a human-verification item, not a blocker — the automated output-window-context test (truth #6) stands as code-correctness evidence in its place |

**Score:** 6/7 truths verified (1 human-verification item outstanding, not a code gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/service.ts` | Additive `MediaAttachableSlot.loop?` field | ✓ VERIFIED | Field present with full lifecycle doc comment; `npm run type-check` passes with the field absent on all existing fixtures |
| `src/views/ServiceEditorView.vue` | Loop checkbox + interval control, handlers | ✓ VERIFIED | Row + 4 handlers (`onToggleLoop`/`loopPresetFor`/`onLoopPresetChange`/`onLoopCustomBlur`) present and wired to `localService.value.slots[index]` |
| `src/views/__tests__/ServiceEditorView.test.ts` | Scoped authoring tests | ✓ VERIFIED | 10 new cases, all pass; 350/350 total in file, no regression |
| `src/composables/useLoopTimer.ts` | Single-active-timer primitive | ✓ VERIFIED | `arm`/`disarm`, one `intervalId`, `onUnmounted(disarm)` |
| `src/composables/useRunControl.ts` | Loop arming/advance/teardown wired through `postIndex` | ✓ VERIFIED | `clampInterval`/`currentLoopSlot`/`advanceLoop`/`reconcileLoop` present; wired from `postIndex`, `postBlackout`, `watch(currentSlotIndex)`, `watch(live)`, `watch(filmstrip.slides.length)` (WR-01 fix), `endServiceTeardown`, `endRehearsal` (WR-02 fix) |
| `src/views/__tests__/RunControlView.loop.test.ts` | Behavioral suite | ✓ VERIFIED | 8 cases (6 planned + 2 code-review regression additions WR-01/WR-02), all pass live |
| `src/components/run/RunRail.vue` | Optional Loop badge | ✓ VERIFIED | `rail-loop-badge` span present, gated `v-if="row.loop"`, kept per drop-if-costly gate |
| `src/components/run/__tests__/RunRail.test.ts` | Badge presence/absence test | ✓ VERIFIED | "shows the Loop badge for a looping row and hides it for a non-looping row" present and passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `slot.loop` mutations | Firestore persistence | Existing `useAutoSave(localService, ...)` deep-watch | ✓ WIRED | No new save call added; handlers mutate `localService.value.slots[index]` directly (same pattern as `notes`/`bibleVersion`) |
| Every loop advance | Output windows | `postIndex()` single-writer choke point | ✓ WIRED | Exhaustive grep confirms `index.value =` assigned in exactly one place (`postIndex`, `useRunControl.ts:127`); `advanceLoop()` never touches `index.value` or the channel directly |
| `reconcileLoop()` | Arm/disarm decision | `postIndex`, `postBlackout`, `watch(currentSlotIndex)`, `watch(live)`, `watch(filmstrip.slides.length)`, `endServiceTeardown`, `endRehearsal` | ✓ WIRED | All 7 call sites confirmed present via grep + code read; independently traced and fixed by code review (WR-01, WR-02) before sign-off |
| Persisted `intervalSeconds` | Run-time timer | `clampInterval()` defensive clamp (1–3600, fallback 10) | ✓ WIRED | Applied on every `arm()` call |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Loop-authoring UI + persistence | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | 350/350 passing | ✓ PASS |
| Run-time loop timer (auto-advance/wrap, manual-nav reset, item-change/unmount teardown, go-to-black pause/resume, WR-01/WR-02 regressions) | `npx vitest run src/views/__tests__/RunControlView.loop.test.ts` | 8/8 passing | ✓ PASS |
| No regression to existing Run-control/RunRail suites (scoped run) | `npx vitest run src/views/__tests__/RunControlView.loop.test.ts src/views/__tests__/RunControlView.output.test.ts src/views/__tests__/RunControlView.test.ts src/components/run/__tests__/RunRail.test.ts src/views/__tests__/ServiceEditorView.test.ts` | 430/430 passing (all 5 files) | ✓ PASS |
| Type gate | `npm run type-check` (vue-tsc --build, typechecks test files) | Clean, no errors | ✓ PASS |
| Full workspace suite — confirms no regression anywhere else in the app (ran once, per verification constraints) | `npx vitest run` | 181/183 files passing, 4954/4981 tests passing, 26 skipped. The only per-test failure shown is the documented stale `src/stores/appConfig.test.ts` `saveField` dot-path assertion; the 2nd failing file is consistent with the documented `src/storage.rules.test.ts` (Storage-emulator-dependent) baseline — matching CLAUDE.md's stated 2-file baseline exactly, with zero new failures attributable to Phase 106 | ✓ PASS (baseline-only) |
| Real-second-display hardware confirmation (106-02 Task 4) | Manual, not run | Deferred — see human verification | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R306 | 106-01, 106-02 | Per-item loop checkbox; during Run auto-advance + loop back to item's first slide | ✓ SATISFIED | Authoring UI (106-01) + Run-time timer (106-02) both implemented and behaviorally tested |
| R307 | 106-01 | Interval defaults 10s, preset dropdown + custom, persists | ✓ SATISFIED | Field model + UI + 10 authoring tests, incl. clamp and round-trip cases |
| R308 | 106-02 | No timer fights manual nav; clean teardown on every exit path; explicit Go-to-black decision, verified in an output window | ✓ SATISFIED (code) / human-verify pending on real hardware | 8 behavioral tests including the output-window-context go-to-black test; real second-display confirmation (plan's own Task 4 gate) not yet run |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` debt markers in any of the 8 files this phase modified. No stub returns, no hardcoded-empty data flowing to render, no console-log-only handlers.

### Code Review

`106-REVIEW.md` (standard depth, 5 files reviewed) found 2 warnings + 1 info, all fixed and re-verified before this verification pass:
- WR-01 (watcher-ordering gap: a mid-run async slide-count growth on the current item was not reconciled without navigation) — fixed with `watch(() => filmstrip.value.slides.length, reconcileLoop)`, regression test added.
- WR-02 (`endRehearsal()` missing explicit `loopTimer.disarm()`, unlike `endServiceTeardown()`) — fixed, regression test added.
- IN-01 (dead `isArmed` field) — removed.

All three fixes independently confirmed present in the live codebase during this verification pass (grep + read of `useRunControl.ts` lines 903-908, 967-973, 1192-1208; `RunControlView.loop.test.ts` WR-01/WR-02 test cases).

### Human Verification Required

### 1. Real second-display hardware confirmation (106-02 Task 4, R308 #4)

**Test:** On a machine with a second display: mark a multi-slide item Loop (short interval, e.g. 5s), Go live so the Audience output opens on the second display, and confirm: (1) auto-advance every 5s wrapping to the item's first slide, never into the next item; (2) a mid-interval arrow-key press takes effect immediately with the next auto-advance a full interval later; (3) navigating to a non-looping item stops auto-advance and returning resumes it; (4) "Go to black" stops the slides advancing behind the blackout, restoring resumes without an unexpected jump; (5) exiting Run and reopening starts clean.

**Expected:** All five behaviors hold on the physical Audience output exactly as they do in the automated fake-channel test.

**Why human:** The plan's own Task 4 is a `checkpoint:human-verify gate="blocking"` explicitly requiring physical-hardware confirmation ("can only be fully trusted on a physical output window, not the control screen alone") and explicitly instructs "Do NOT self-approve this checkpoint." The 106-02-SUMMARY.md records it as deferred/PENDING, not approved. This is a DEFERRED item per the phase brief, not a blocker — the automated output-window-context test stands as code-correctness evidence — but it must still be recorded and closed before the v2.7 milestone archives.

### Gaps Summary

No code gaps found. All R306/R307/R308 truths are implemented, wired, and behaviorally proven by an independent, adversarially-traced test suite (8 dedicated Run-time cases + 10 authoring cases), with a prior code review that found and fixed two real watcher-ordering gaps before this verification pass. A full workspace `npx vitest run` (4981 tests, 998s) confirms zero new regressions — exactly the documented 2-file baseline (`storage.rules.test.ts`, stale duplicate `appConfig.test.ts`) fails, nothing else. The single outstanding item is the plan's own blocking human-verify checkpoint (real second-display hardware confirmation), which was deliberately deferred to end-of-milestone per this run's execution instructions and is not evidence of an unimplemented or broken behavior — it is a physical-hardware confirmation step that cannot be run by an automated verifier.

---

_Verified: 2026-09-01T06:15:00Z_
_Verifier: Claude (gsd-verifier)_
