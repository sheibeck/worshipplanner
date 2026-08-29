---
phase: 96-live-ops-hardening
verified: 2026-08-29T02:08:53Z
status: human_needed
score: 6/6 must-haves verified (code-verifiable); 3 human-UAT items pre-declared/deferred
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "During a real service, close an output window (audience or confidence) mid-service, then click the reopen chip and confirm the window reopens ONTO ITS ASSIGNED MONITOR with the current slide already showing."
    expected: "The named output reopens on the correct physical screen and immediately shows the live slide (no restart, no lost place); the other output is untouched."
    why_human: "Real cross-monitor window.open + requestFullscreen({screen}) placement and the hello->resendCurrent re-sync onto physical hardware cannot be exercised in jsdom; the poll->latch->reopen->handshake mechanism is unit-proven but the physical placement + timing is a human observation. Pre-declared in 96-CONTEXT."
  - test: "Physically unplug the monitor assigned to an output mid-service, use the reassign banner's PRIMARY 'Reopen & replace {role}' in-place action, and confirm recovery keeps the control running and the place intact."
    expected: "The reassign banner appears (amber), the in-place reopen re-opens the affected role against the current live screens WITHOUT navigating away/unmounting the control, the still-open output stays live, and position is restored to the current slide via the handshake."
    why_human: "A real screenschange from a hardware unplug and the resulting matchMapping/needs-reprompt + in-place reopen against post-change ScreenDetails.screens cannot be driven from jsdom (the listener is invoked directly in tests). The non-destructive in-place path is unit-proven (WR-01 test); the physical event is a human observation. Pre-declared in 96-CONTEXT."
  - test: "Run a full realistic-length service (many navigations over the whole service) and confirm the outputs stay in sync with no perceptible lag and nothing accumulates/teardown-leaks by the end."
    expected: "Navigation stays monotonic and instant on both outputs for the entire service; on exit the poll + screenschange listener are gone and no reopen chip resurfaces."
    why_human: "'No perceptible lag' and endurance over a real service duration are subjective/timing observations; the monotonic-seq mechanism and single-teardown are unit-proven but the felt latency and long-run stability require a human. Pre-declared in 96-CONTEXT."
---

# Phase 96: Live-Ops Hardening Verification Report

**Phase Goal:** The live session survives real-world operating conditions — closed windows, monitor replugs, and a realistic service duration — without losing the projectionist's place or requiring a restart.
**Verified:** 2026-08-29T02:08:53Z
**Status:** human_needed (pass with deferred human-UAT)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP SC / REQ) | Status | Evidence |
| - | ------------------------- | ------ | -------- |
| 1 | SC1 / R273 — outputs stay in sync with operator navigation, no drop/reorder, monotonic under rapid nav | ✓ VERIFIED | Single-writer model: `postIndex` (`:622-626`) sets `index` + increments `seq` + `postState`; `resendCurrent` (`:629-633`) advances `seq` so runChannel's stale-drop accepts the resend; `handle.onHello(resendCurrent)` wired at mount (`:1171`). Behavioral test `rapid navigation stays in sync` (`:938`) asserts ArrowRight×3/ArrowLeft×1 posts strictly-increasing `seq` and final index 2. (The subjective "no perceptible lag over a full service" is the human-UAT item below.) |
| 2 | SC2 / R274 — closed output window detected + one-click reopen WITHOUT losing slide position | ✓ VERIFIED | `startClosedPoll` (`:834-840`) single shared latch-only ~1s poll reading try/catch-guarded `readClosed` (`:820-826`); `reopenOutput` (`:855-869`) synchronous, reuses HELD `liveScreenDetails.screens` via `resolveScreen`+`openWindow`, clears the amber flag only on a non-null handle. Position-preserved test (`:703-733`): ArrowRight→index 2, close→latch→reopen→`deliver({type:'hello'})`, asserts last posted `state.index === 2 === preCloseIndex` (restored purely via handshake, nothing persisted). |
| 3 | SC3 / R274 — monitor unplugged mid-service detected + one-click reassign/recovery WITHOUT losing position; NON-DESTRUCTIVE (WR-01 crux) | ✓ VERIFIED | `onScreensChange` (`:903-920`) re-runs `matchMapping` on the held live screens → `monitorChanged` + names the missing role; listener attached AFTER the WR-01 stale guard, typeof-guarded (`:1101-1103`). **Non-destructive fix confirmed:** the banner's PRIMARY action is `run-reassign-reopen` → `reopenReassignedOutputs` (`:885-895`) which re-resolves the affected role in place via `reopenOutput` WITHOUT unmounting the control; the `/monitor-setup` affordance is now a `target="_blank"` anchor (`:259-267`), NOT a same-tab router-link. WR-01 test (`:782-831`) asserts the in-place reopen re-opens only the affected role, control stays mounted (`run-service-name` present), channel NOT closed, banner dismissed, and `state.index === 2 === preChangeIndex`. |
| 4 | SC4 — client-only: NO new Firestore document, NO firestore.rules change | ✓ VERIFIED | `grep firebase\|firestore\|rules` in `RunControlView.vue` → **no matches**; feature is in-memory `outputWindows` + BroadcastChannel + `localStorage` (`loadMapping`). No rules file touched, so `npm run test:rules` is correctly NOT required. Test file imports no firebase/emulator module. |
| 5 | Endurance — recovery watchers cleaned up exactly once; no reopen chip resurfaces post-exit; no leak | ✓ VERIFIED | `stopRecoveryWatchers` (`:930-943`) clears interval (`clearInterval(pollId); pollId=null`) AND removes the `screenschange` listener (null-guarded), invoked in `confirmExit` BEFORE `closeOutputs` (`:1149-1152`) and again in `onUnmounted` (`:1190`). Tests: `removeEventListener` fires on exit (`:872`) AND on unmount (`:891`); after a deliberate exit, advancing timers surfaces NO reopen chip (`:904`) — the load-bearing proof (since `closeOutputs` never nulls `outputWindows`). |
| 6 | Phase 95 behavior did not regress | ✓ VERIFIED | Both `RunControlView.test.ts` and `RunControlView.output.test.ts` (incl. all pre-96 Phase 95 cases: idle/no-open-on-mount, matched placement, fallback paths, blocked, WR-02 partial, WR-01 stale-guard, close-on-exit) are green in the full suite (166 files pass). |

**Score:** 6/6 code-verifiable truths verified (0 present-behavior-unverified). 3 pre-declared physical/subjective UAT items deferred to milestone end.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/views/RunControlView.vue` | Phase 96 hardening delta (poll + per-role reopen + screenschange + in-place reassign + teardown + honest closed lines) | ✓ VERIFIED | All symbols present, wired into openPlaced/openUnplaced tails, openOutputs().then (after WR-01 guard), confirmExit, onUnmounted. WR-01/WR-02/IN-03 fixes present at commit 3667a71a. |
| `src/views/__tests__/RunControlView.output.test.ts` | Behavioral coverage incl. position-preserved + WR-01 in-place + WR-02 precedence | ✓ VERIFIED | 25 tests, all passing; the crux position-preserved (`:703`) and WR-01 in-place (`:782`) tests assert real index restoration via the handshake. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| reopen chip → reopenOutput | held `liveScreenDetails.screens` | `resolveScreen` + `openWindow`, no fresh getScreenDetails | ✓ WIRED | Synchronous; no new stale-resolution window; IN-03 `isUnmounted` guard present (`:860`). |
| reassign banner PRIMARY → reopenReassignedOutputs | reopenOutput(role) in place | control never unmounts; handshake restores index | ✓ WIRED | Non-destructive (WR-01 fix). Setup link moved to `target=_blank`. |
| reopened output hello → resendCurrent | runChannel postState (seq+1) | onHello wired at mount | ✓ WIRED | Position restored via channel, nothing persisted. |
| stopRecoveryWatchers | confirmExit (before closeOutputs) + onUnmounted | clearInterval + removeEventListener | ✓ WIRED | Both sites; null-guarded double call. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 96 test suite | `npx vitest run src/views/__tests__/RunControlView.output.test.ts` | 25 passed | ✓ PASS |
| Type gate (typechecks test files too) | `npm run type-check` (vue-tsc --build) | clean, exit 0 | ✓ PASS |
| Full app suite baseline | `npx vitest run` (bare) | 166 files pass; ONLY `src/storage.rules.test.ts` fails (25 timeouts — documented Storage-emulator baseline, not chased) | ✓ PASS |
| Client-only check | `grep firebase\|firestore\|rules src/views/RunControlView.vue` | no matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| R273 | 96-01/96-02 | Single source of truth; outputs stay in sync, no perceptible lag | ✓ SATISFIED (mechanism); human-UAT for felt lag | Truth 1 |
| R274 | 96-01/96-02 | Closed window / unplugged monitor detected + one-click recovery without losing position | ✓ SATISFIED (mechanism); human-UAT for physical events | Truths 2 & 3 |

### Anti-Patterns Found

None blocking. No debt markers (TBD/FIXME/XXX) in the modified files. Recovery flags are latch-only and cleared only by a proven-successful action (honesty rule holds).

### Accepted-Open Info Items (from 96-REVIEW — not gaps)

- **IN-01** (accepted-open): reassign banner copy reads "unplugged … can't place {role}" even when a monitor was ADDED (bidirectional set-equality yields needs-reprompt). Copy nuance only; the reassign action remains correct. Not a blocker.
- **IN-02** (accepted-open): coverage backstops not asserted — both-outputs-closed stacking, single-shared-interval idempotency, reassign round-trip via the /monitor-setup link. The behaviors under test are correct; these are backstops. Not a blocker.
- **IN-03, WR-01, WR-02**: ✅ RESOLVED at commit 3667a71a and confirmed in source (see Truths 1-5).

### Human Verification Required

Three items, all PRE-DECLARED in 96-CONTEXT as deferred to milestone end (autonomous run). See frontmatter `human_verification` for full detail:

1. **Real closed-window reopen onto the right monitor** with the current slide intact.
2. **Physical monitor unplug + in-place reassign recovery** keeping the control running and place intact.
3. **Full realistic-length service** with no perceptible sync lag and no teardown accumulation.

### Gaps Summary

No gaps. Every code-verifiable success criterion (R273 sync mechanism, R274 closed-window reopen with position preservation, R274 monitor-unplug NON-DESTRUCTIVE in-place reassign, and the client-only constraint) is verified in source, backed by 25 passing behavioral tests, a clean `vue-tsc --build`, and a bare `npx vitest run` that shows only the documented `storage.rules.test.ts` Storage-emulator baseline. Phase 95 did not regress. The remaining items are physical-hardware / subjective-timing observations pre-declared for milestone-end UAT — this is the expected outcome for the milestone's robustness capstone, not a defect.

---

_Verified: 2026-08-29T02:08:53Z_
_Verifier: Claude (gsd-verifier)_
