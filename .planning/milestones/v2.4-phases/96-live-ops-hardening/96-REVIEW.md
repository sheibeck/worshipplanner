---
phase: 96-live-ops-hardening
reviewed: 2026-08-29T01:45:48Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - src/views/RunControlView.vue
  - src/views/__tests__/RunControlView.output.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 96: Code Review Report

**Reviewed:** 2026-08-29T01:45:48Z
**Depth:** deep
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Adversarial review of the Phase 96 (Live-Ops Hardening) delta grafted into the Phase 95
`RunControlView.vue`: the single shared `.closed` poll (`readClosed`/`startClosedPoll` +
`audienceClosed`/`confidenceClosed`), the synchronous `reopenOutput(role)`, the held
`liveScreenDetails` + `screenschange` unplug listener (`onScreensChange`/`monitorChanged`/
`reassignRole`), `stopRecoveryWatchers()`, the template closed-recovery rows + `run-reassign-banner`,
and the 12 new tests (file now 24). Cross-checked against `runChannel.ts` (the `seq` stale-drop
handshake), `monitorConfig.ts` (`matchMapping` bidirectional set-equality, `resolveScreen`),
96-01/96-02-PLAN, 96-UI-SPEC, 96-CONTEXT, PITFALLS, and the Phase 95 WR-01/WR-02 guards. Every claim
below was traced in SOURCE, not inferred from the passing suite.

**The seven highest-risk contracts this phase names all hold up in the source:**

1. **Interval/listener cleanup — CLEAN.** `stopRecoveryWatchers()` (`:843-856`) clears the interval
   (`clearInterval(pollId); pollId = null`) AND removes the `screenschange` listener (guarded
   `removeEventListener?.` + `liveScreenDetails = null`), both null-guarded so a double call is safe.
   It is invoked in `confirmExit` (`:1062`) BEFORE `closeOutputs()` (`:1065`) and again in `onUnmounted`
   (`:1103`). Because `closeOutputs()` (`:1036-1044`) never nulls `outputWindows`, the clear-before-close
   ordering is what stops the poll from re-latching a deliberately-closed window post-exit — verified by
   the "advancing timers after a deliberate exit surfaces NO reopen chip" test (`:841-870`), which keeps
   the component mounted (router `push` is mocked) so only `stopRecoveryWatchers` can have cleared it.
2. **Reopen honors WR-01 and is genuinely synchronous — CLEAN.** `reopenOutput` (`:799-808`) resolves
   the screen from the already-held `liveScreenDetails.screens` via `resolveScreen` + `openWindow` with
   no fresh `getScreenDetails`, so it introduces no new async stale-resolution window and leaves the
   original `openOutputs().then` WR-01 guard (`:999`) untouched. It clears the closed ref ONLY on a
   non-null handle (`if (!win) return`), so a popup-blocked reopen stays amber — verified by the
   refused-reopen test (`:685-701`).
3. **Unplug listener attached AFTER the WR-01 guard, typeof-guarded — CLEAN.** The hold+attach block
   (`:1006-1016`) runs only after the `isUnmounted || requestId !== goLiveRequestId` early-return
   (`:999`), swaps off any prior handle first, and gates `addEventListener` on
   `typeof details.addEventListener === 'function'`. `onScreensChange` (`:816-833`) re-runs
   `matchMapping` and clears `monitorChanged` on a still-matching change — the no-false-alarm test
   (`:761-773`) proves it.
4. **Precedence — CLEAN.** Both closed rows are gated `v-if="…Closed && !monitorChanged"` (`:78`, `:101`)
   and the banner on `v-if="monitorChanged"` (`:187`), so no role ever shows a reopen chip and the
   reassign banner simultaneously — proven by the precedence test (`:785-804`).
5. **Position preservation via handshake only — CLEAN.** `reopenOutput` writes no index; restoration
   rides the reopened output's `hello` → `onHello(resendCurrent)` (`:1084`, `:573-577`). The
   position-preserved test (`:703-733`) closes→reopens→`deliver({type:'hello'})` and asserts the resent
   `state.index === 2`.
6. **Client-only — CLEAN.** No `firebase/firestore` or rules import is added to either file; the feature
   is purely in-memory `outputWindows` + BroadcastChannel + `localStorage` (`loadMapping`).
7. **Poll robustness — CLEAN.** `readClosed` (`:764-770`) try/catch-guards the `.closed` read; the poll
   (`:778-784`) is latch-only (only ever sets `true`) and single/shared (the `pollId != null` guard).

Two warnings remain — both about a promise the NEW copy/flow makes that the code does not fully keep on
the **monitor-unplug (reassign) path** specifically. Neither touches the closed-window reopen path,
which is solid.

## Warnings

### WR-01: The reassign banner promises "Your place in the service is safe," but taking its "Open monitor setup" link unmounts the control, drops the in-memory `index`, and desyncs the still-open outputs on return — ✅ RESOLVED

> **Resolved 2026-08-28** (commit `3667a71a`). The banner's sole action was a same-tab
> `<router-link to="/monitor-setup">` that unmounted `RunControlView`, destroying the per-instance
> `index`/`seq` and desyncing the still-open outputs against `runChannel`'s `highestDeliveredSeq`
> stale-drop on return. It now leads with a PRIMARY, place-preserving **"Reopen & replace {role}"**
> action (`reopenReassignedOutputs`) that re-resolves the affected role against the CURRENT (post-change)
> `liveScreenDetails.screens` through the existing `reopenOutput` → `resolveScreen` → `openWindow` path —
> the control never unmounts, and position is restored by the reopened output's `hello` →
> `onHello(resendCurrent)` handshake (nothing persisted). If the monitor is truly gone `resolveScreen`
> yields `null` and the output opens un-positioned (honest fallback), still without losing the session.
> The "Open monitor setup" affordance is now a `target="_blank"` anchor (new browser tab) so the running
> control — its `index`/`seq`/channel + open outputs — stays alive instead of being torn down by a
> same-tab navigation, and the copy no longer claims place-preservation for anything but the in-place
> reopen. A regression test drives unplug → `run-reassign-banner` → the in-place reopen → simulated
> `hello` and asserts the last posted `state.index` equals the pre-change index, the top-bar heading is
> still mounted, and the channel was never closed. `npm run type-check` clean; bare `npx vitest run`
> shows only the `storage.rules.test.ts` baseline.

**File:** `src/views/RunControlView.vue:205-212` (banner copy + `<router-link to="/monitor-setup">`), interacting with `:1095-1106` (`onUnmounted`) and `:561-577` (`index`/`seq` are per-instance locals)
**Issue:** For the CLOSED-window path, position is genuinely preserved because the control stays mounted
and only the output reopens (handshake resends the live `index`). The REASSIGN path is different: the
banner body asserts "Your place in the service is safe — reassign your displays to keep going" and the
sole offered action is a `router-link` to `/monitor-setup`. Following it navigates the control AWAY,
unmounting `RunControlView`; `index` and `seq` are per-instance `ref`/`let` (`:561-562`) and are
destroyed, and `onUnmounted` calls `handle?.close()` (`:1104`) but deliberately does NOT `closeOutputs()`
— so the audience/confidence windows stay open with their `runChannel` `highestDeliveredSeq` high-water
mark intact (`runChannel.ts:112,133`). When the operator returns and Runs again, the fresh control mounts
with `seq` reset to 0 and posts `postIndex(0)` → `{ index: 0, seq: 1 }`. Because `1 <= highestDeliveredSeq`
from the prior session, the still-open outputs' stale-drop REJECTS it (`runChannel.ts:133`); the outputs
neither move to slide 0 nor re-`hello` (they never remounted), so the control shows slide 0 while the
outputs sit on the old slide until navigation climbs `seq` back past the old high-water mark. Net: the
"place is safe" reassurance is not backed by any position-preservation on the reassign path, and R274's
"without losing position" is not met for the monitor-unplug case when the operator uses the provided
link. (Physical-unplug UAT is deferred to milestone end, which is why this is a warning, not a blocker —
but the copy overpromises today.)
**Fix:** Either (a) soften the copy so it does not claim the exact slide is preserved across a
`/monitor-setup` round-trip (e.g. "Your service is still loaded — reassign your displays, then Run
again"), or (b) preserve position across the round-trip — persist the live `index` (e.g.
`sessionStorage`) on unmount and rehydrate it on the next Run mount, and/or have the returning control
seed `seq` above the last-broadcast value (or `postHello` to force the outputs to resend/resync) so the
still-open outputs are not stuck behind the stale-drop. Add a test that mounts→navigates→2, unmounts,
remounts, and asserts the outputs are driven to the retained index rather than dropped.

### WR-02: During a simultaneous close + monitor-change, the closed output's line falls through `v-else` to the GREEN "{role} → {label}" ready line — a "ready" claim over a window that is actually closed — ✅ RESOLVED

> **Resolved 2026-08-28** (commit `3667a71a`). The per-role line was `v-if="…Closed && !monitorChanged"`
> with a green `v-else`, so a genuinely-closed window under close+unplug precedence fell through to the
> green "{role} → {label}" ready label. Each role line is now a three-branch cluster: (1) `…Closed &&
> !monitorChanged` → the amber closed-recovery row + reopen chip; (2) `…Closed` (i.e. closed while the
> reassign banner is up) → a muted amber "{role} → reassign displays to reopen" indicator with NO reopen
> button (the banner is the senior action); (3) `v-else` → the green ready label — now reachable ONLY
> when `!…Closed`, so a closed window is NEVER rendered green regardless of `monitorChanged`. The green
> ready line carries a `run-output-ready-{role}` testid and the muted line a
> `run-output-closed-{role}-muted` testid; the precedence test now asserts that with a closed audience
> under a monitor change the green `run-output-ready-audience` line is absent and the muted indicator is
> shown. `npm run type-check` clean; bare `npx vitest run` shows only the `storage.rules.test.ts`
> baseline.

**File:** `src/views/RunControlView.vue:78-99` (audience) and `:101-122` (confidence)
**Issue:** The closed-recovery rows are gated `v-if="audienceClosed && !monitorChanged"`; the `v-else`
(`:99`, `:122`) renders the original green `Audience → {{ readyAudienceLabel }}` / `Confidence → {{ readyConfidenceLabel }}`
line. When BOTH `audienceClosed` is latched true AND `monitorChanged` is true (the precedence case the
tests exercise at `:785-804`), the `&& !monitorChanged` clause makes the amber row's `v-if` false, so the
cluster falls back to the GREEN "ready" subordinate line for a window that is genuinely closed. This
contradicts the phase's load-bearing honesty rule (96-UI-SPEC: "No recovery affordance may claim success…"
/ "amber, never a green 'displays ready' over a dark display"). It is mitigated in practice because the
senior amber `run-reassign-banner` dominates the operator's attention, but the cluster line itself is
technically dishonest during the dual-failure window. The existing test only asserts the closed-row
`data-testid` is absent under precedence (`:803`); it does not assert what the fallen-through `v-else`
renders, so it does not catch this.
**Fix:** Give the closed-under-precedence case a neutral third branch rather than reverting to the green
"ready" label — e.g. render a muted `text-gray-400` "Audience → (reassign displays)" (or simply hide the
subordinate label) while `monitorChanged && audienceClosed`, so no green "ready" claim is made over a
closed window. Add an assertion that, under precedence with a closed audience, the cluster does NOT show
the green `Audience → {label}` ready text.

## Info

### IN-01: `reassignRole` and the banner body read "unplugged … can't place the {role} output on its old screen" even when a monitor was ADDED and both assigned outputs are still placeable

**File:** `src/views/RunControlView.vue:816-833` (`onScreensChange`) and `:206-209` (banner body)
**Issue:** `matchMapping` uses BIDIRECTIONAL set-equality (`monitorConfig.ts:149-155`), so plugging in a
NEW screen (both assigned fingerprints still live) also returns `needs-reprompt`. In that case
`audMissing`/`confMissing` are both false, so `reassignRole` stays the default `'audience or confidence'`
and the banner reads "A display was unplugged or rearranged, so we can't place the audience or confidence
output on its old screen." — but nothing was lost and both outputs are still placeable. The message is
grammatical but factually off for the added-monitor sub-case. Low impact (the reassign action is still
correct), but the copy asserts a loss that did not occur.
**Fix:** Distinguish "a saved monitor is gone" (a real reassign) from "an extra monitor appeared" (a
benign superset) in the body copy, or soften to "Your displays changed" when neither assigned role
resolved as missing.

### IN-02: Coverage gaps — both-outputs-closed stacking, the single-shared-interval guarantee, and reassign-round-trip position are unverified

**File:** `src/views/__tests__/RunControlView.output.test.ts` (whole new block set, `:610-897`)
**Issue:** Three behaviors the plan/UI-SPEC name are not asserted: (1) both outputs closed at once →
both amber rows stack (96-UI-SPEC §A "overflow" backstop) — no test flips both handles; (2) the poll is a
SINGLE shared interval created at most once (the `pollId != null` idempotency guard) — no test asserts a
second Go-live/reopen does not spawn a second interval; (3) the reassign-round-trip position behavior
called out in WR-01. These are backstops, not correctness holes in what IS tested, but they leave the
phase's "both closed" and "single teardown of one interval" claims unproven.
**Fix:** Add a both-closed stacking test, a `vi.getTimerCount()`/spy-based single-interval assertion, and
(with WR-01's fix) a round-trip position test.

### IN-03: `reopenOutput` carries no `isUnmounted`/`goLiveRequestId` parity guard (defense-in-depth) — ✅ RESOLVED

> **Resolved 2026-08-28** (commit `3667a71a`). `reopenOutput` now opens with `if (isUnmounted) return`,
> matching the `isUnmounted || requestId !== goLiveRequestId` discipline `openOutputs`' async resolve
> uses, so a reopen can never open a window outside a live, mounted session (defense-in-parity; not a
> live bug today since the chip only renders while placed + mounted). The non-null-handle-only flag-clear
> is unchanged — a pop-up-blocker-refused reopen still keeps the amber row.

**File:** `src/views/RunControlView.vue:799-808`
**Issue:** Unlike `openOutputs` (which guards its async resolve with `isUnmounted || requestId !== goLiveRequestId`),
`reopenOutput` has no such check. It is synchronous and only reachable from a button rendered while
`placed` and mounted, so in production it cannot fire after exit — not a live bug. But note that after
`confirmExit` (which nulls `liveScreenDetails` via `stopRecoveryWatchers`) the guard `saved && liveScreenDetails`
would resolve `screen` to `null` and `openWindow` would still open an UN-positioned window if the button
were somehow invoked post-exit (e.g. a future refactor that keeps the control mounted). Cheap hardening
for parity with the WR-01 discipline elsewhere in the file.
**Fix:** Optional — early-return from `reopenOutput` when `isUnmounted` (or when `liveScreenDetails == null`),
so a reopen can never open a window outside a live, matched session.

---

_Reviewed: 2026-08-29T01:45:48Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
