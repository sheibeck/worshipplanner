---
phase: 97-run-service-redesign
reviewed: 2026-08-29T06:33:47Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - src/composables/useRunControl.ts
  - src/composables/useOutputWindow.ts
  - src/composables/useRunTimers.ts
  - src/views/RunControlView.vue
  - src/views/AudienceOutputView.vue
  - src/views/ConfidenceOutputView.vue
  - src/components/ServiceCard.vue
  - src/components/run/RunHeader.vue
  - src/components/run/RunRail.vue
  - src/components/run/RunPreviewPair.vue
  - src/components/run/RunFilmstrip.vue
  - src/components/run/RunTransportBar.vue
  - src/components/run/RunPreflightPanel.vue
  - src/components/run/RunDisplaysPanel.vue
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: resolved
resolved: 2026-08-29
resolved_findings:
  - WR-01
  - WR-02
  - IN-01
  - IN-02
---

# Phase 97: Code Review Report

**Reviewed:** 2026-08-29T06:33:47Z
**Depth:** deep
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Adversarial review of the Phase 97 Run Service redesign: the extracted `useRunControl.ts`
control-core, the new `live`/`blackout`/`rehearse`/timers/readiness/filmstrip derivations,
`useOutputWindow.ts` self-fullscreen + returned `blackout`, the two-state `RunControlView.vue`,
the audience/confidence blackout overlays + confidence left/right split, the `ServiceCard`
Run button, and the seven presentational children. Every claim below was traced in SOURCE,
cross-checked against 97-CONTEXT / 97-UI-SPEC / 97-PATTERNS, REQUIREMENTS R276–R284, and the
Phase 96 invariants carried forward.

**The load-bearing extraction and the eight scrutiny points largely hold:**

1. **Phase 92–96 machinery preserved — CLEAN.** `useServiceAssembly()` is called first (`:79`)
   so its subscribe `onMounted` registers before the channel-opening `onMounted` (`:793`)
   (subscribe-before-channel). `postIndex`/`resendCurrent`/`seq`/`onHello` single-writer intact
   (`:103-114`, `:795`). The honest open state machine (`OutputStatus`/`openOutputs`/`openPlaced`/
   `openUnplaced`/`bothOpened`/`openWindow`) and the WR-01 stale guard (`goLiveRequestId`/
   `isUnmounted`, token bump `:596`, drops `:607`/`:638`, `confirmExit` bump `:664`, `onUnmounted`
   set `:809`) are moved verbatim. Recovery (closed-poll `:348`, `onScreensChange` `:417`,
   `stopRecoveryWatchers` `:444`, `reopenOutput`/`reopenReassignedOutputs`) preserved, and the
   teardown order `stopRecoveryWatchers()` → `closeOutputs()` holds in BOTH `confirmExit` (`:670`
   before `:679`) and `onUnmounted` (`:814`). No leaked interval/listener: `pollId`, keydown, and
   `screenschange` are all cleared; `useRunTimers` clears its own interval on unmount.
2. **`live` flag semantics (R277) — CLEAN.** Set true ONLY in `openPlaced` (`:551`), `openUnplaced`
   (`:568`) — both AFTER the `bothOpened` gate — and `rehearse` (`:138`); never on `partial`/
   `blocked` (`bothOpened` returns before the `live` assignment). Reset in `confirmExit` (`:674`).
   `RunHeader` renders green only on `live`.
3. **Blackout (R280) — CLEAN.** `postBlackout` sets `blackout.value` then bumps `seq` BEFORE
   posting (`:124-127`), mirroring `resendCurrent` so `runChannel`'s monotonic stale-drop accepts
   it. `postIndex`/`resendCurrent` post `blackout.value` (default false). `B` toggles (`:268-274`).
   Both output views render a full-bleed overlay painted AFTER `SlideCanvas` and BEFORE the
   reenter affordance, so the re-enter button stays reachable during blackout.
4. **Self-fullscreen (R278) — CLEAN.** `useOutputWindow({ role })`; `resolveAssignedScreen`
   feature-detects `getScreenDetails`, try/caught, role-resolved via `loadMapping`/`computeFingerprint`;
   `selfFullscreen` calls `requestFullscreen` as the first statement per branch, promise `.catch`
   swallowed, sync try/catch — never throws when the API is absent or the screen is unresolvable.
   Manual reenter remains as the fallback (`v-if="!isFullscreen"`).
5. **Rehearse (R283) — CLEAN in the primary path.** `rehearse()` sets `live` + `startElapsed`
   and posts slide 0 without any `window.open`/`getScreenDetails`; `outputStatus` stays `idle`.
   (But see WR-01 for an out-of-band way to open a window while rehearsing.)
6. **Confidence left/right (R279) — CLEAN.** Root `flex-row`; current `flex-[3_1_0%]` LEFT, next
   `flex-[2_1_0%]` RIGHT, both `:suppressBackground="true"`; next scaled `0.8`; the next wrapper is
   unconditional so the last-slide advance does not reflow the current pane.
7. **ServiceCard Run (R284) — CLEAN.** `canRun = isLocked && !!authStore.orgId` with
   `isLocked = status !== 'draft'` (viewer-inclusive, not `isEditor`); absent on draft; `@click.stop`;
   both ids `encodeURIComponent`-encoded.
8. **No fake features / client-only — CLEAN.** No presence/CCLI/Key-BPM/Logo/follow-me; Stage is a
   disabled "Off" placeholder; readiness is `renderState`-derived (`s.slide.renderState === undefined`,
   a valid field path); no Firestore/rules import in any Phase 97 file.

Two warnings remain. Neither is data loss, but both are real behavioral defects introduced by the
redesign rather than carried invariants.

## Warnings

### WR-01: The header display dots expose `reopenOutput` in EVERY state, so clicking a "Not open" dot pre-live (or during Rehearse) opens an output window outside the go-live gesture — bypassing the honest open state machine — ✅ RESOLVED

> **Resolved 2026-08-29** (commits `38524267` + `6c136a76`). Fixed with BOTH the affordance gate
> and defense-in-depth, exactly as the fix advised. (a) In `RunHeader.vue` a display dot is now a
> reopen affordance ONLY when it represents a genuinely closed output within a live session —
> `audienceReopenable`/`confidenceReopenable` = `live && !open`. Pre-live (and for an already-open
> display) the dot is a `:disabled` passive status indicator whose click handler early-returns, so
> it never emits `reopen`. (b) In `useRunControl.ts` `reopenOutput` gained an early
> `if (!live.value || liveScreenDetails === null) return` (kept alongside the existing `isUnmounted`
> guard and the non-null-handle-only clear), so even a stray emit cannot open a window outside a real
> go-live: pre-flight is caught by `!live`, and Rehearse (live=true but no `getScreenDetails` ever
> resolved) is caught by `liveScreenDetails === null`. Regression tests assert a pre-flight dot click
> opens NO window (and the dot is disabled), and that after `rehearse()` a dot click still opens NO
> window; the Phase 96 genuine-reopen-after-real-go-live recovery tests (closed detection → reopen,
> reassign reopen, position-preserved) stay green, proving recovery is intact. `npm run type-check`
> clean; bare `npx vitest run` shows only the `storage.rules.test.ts` baseline.

**File:** `src/components/run/RunHeader.vue:61-85` (dots always rendered, `@click="$emit('reopen', …)"`), wired at `src/views/RunControlView.vue:24` (`@reopen="reopenOutput"`), landing in `src/composables/useRunControl.ts:369-383` (`reopenOutput`)
**Issue:** In Phase 96 `reopenOutput` was reachable ONLY from a chip rendered while `placed` and
mounted — that is exactly why its only guard is `if (isUnmounted) return` (96-REVIEW IN-03 accepted
this as safe *because the chip only renders while placed + mounted*). The redesign moves the
audience/confidence dots into `RunHeader`, which renders in BOTH states with an always-live
`@click="$emit('reopen', role)"`. Consequences when the operator clicks a muted "Not open" dot:

- **Pre-flight (State A, `live=false`, `outputStatus='idle'`):** `reopenOutput('audience')` runs.
  `liveScreenDetails` is `null`, so `resolveScreen` is skipped and `openWindow(url, name, null)` opens
  an UN-positioned audience window from the click gesture — outside `openOutputs`. `outputStatus`
  stays `idle`, `live` stays false, the closed-poll and `screenschange` watcher are never started,
  yet a real output window is now live showing the current slide (its `hello` → `resendCurrent`
  syncs it). The state machine now reports "nothing open" while a window is open — the precise
  dishonesty the `bothOpened`/`OutputStatus` design exists to prevent.
- **Rehearse (State B, `live=true`, `outputStatus='idle'`):** clicking the dot opens a window,
  violating R283's "rehearse enters live with NO `window.open`" contract.
- The orphaned `outputWindows['wp-audience']` handle then interacts with a later real Go-live
  (`window.open` reuses the same window name), leaving the session in a state no test covers.

No unit test exercises a dot click before go-live, so the suite stays green over this.
**Fix:** Gate the dots so `reopen` can only fire once the display is genuinely part of a live
session. Either (a) in `RunHeader`, only bind `@click`/render the dots as buttons when
`live && (outputStatus placed|fallback)`, rendering static indicators otherwise; or (b) harden
`reopenOutput` to no-op unless a live session exists — e.g. early-return when
`liveScreenDetails == null` (matching the WR-01 discipline and the 96-REVIEW IN-03 suggestion),
which also blocks the un-positioned pre-live open. Add a test asserting a pre-live/rehearse dot
click opens NO window.

### WR-02: The pre-flight "Press Enter to go live" hint is not wired — `handleKeydown` has no `Enter` case, and nothing focuses the Go-live button, so Enter does nothing on entering State A — ✅ RESOLVED

> **Resolved 2026-08-29** (commit `6c136a76`). `handleKeydown` now has an `Enter` branch that, while
> pre-flight (`!live`), calls `openOutputs()` — the SAME go-live action as `run-go-live-btn` — wiring
> the advertised "Press Enter to go live" hint. It inherits the existing inert-while-dialog-open and
> inert-in-text-input guards (the early returns at the top of the handler), and does nothing once
> live (there is no `Enter` case in the live branch). A regression test asserts Enter in State A
> reaches go-live (both output `window.open` calls attempted → honest `run-blocked-banner` under the
> null-stub) and that Enter is inert once live. `npm run type-check` clean; bare `npx vitest run`
> shows only the `storage.rules.test.ts` baseline.

**File:** `src/components/run/RunPreflightPanel.vue:143-145` (the hint), against `src/composables/useRunControl.ts:242-276` (`handleKeydown`)
**Issue:** State A renders "Press `Enter` to go live" and 97-UI-SPEC State A lists an "Enter" key
hint as a first-class affordance. But `handleKeydown` only handles ArrowRight/Space/ArrowLeft/
ArrowDown/ArrowUp/Escape/b — there is no `Enter` (or `'Enter'`) branch, and nothing autofocuses
`run-go-live-btn` on entering State A (the only programmatic focus is `cancelBtnRef` in the exit
dialog). So on a fresh pre-flight screen, pressing Enter does nothing until the operator manually
tabs onto the button (at which point it is native button activation, not the advertised shortcut).
The instruction is a broken/misleading affordance. The output suite drives go-live by CLICKING
`run-go-live-btn`, so no test catches the gap.
**Fix:** Add an `Enter` case to `handleKeydown` that, when `!live`, calls `openOutputs()` (guarded so
it is inert while the exit dialog is open / focus is in a text input, like the other keys) — or
remove the "Press Enter" copy if a global Enter shortcut is not wanted. If wiring Enter, add a test
asserting Enter in State A triggers go-live and does nothing once `live`.

## Info

### IN-01: Dead auto-scroll left in `useRunControl` after the rail extraction — `captureActiveRow`/`activeItemRef`/`railRef` and the `watch(index)` `scrollIntoView` are now no-ops — ✅ RESOLVED

> **Resolved 2026-08-29** (commit `6c136a76`). Deleted `railRef`, `activeItemRef`, `captureActiveRow`,
> and the `watch(index) → activeItemRef?.scrollIntoView` block from `useRunControl`, dropped them
> from the returned object, and removed the now-unused `ComponentPublicInstance` type import. `RunRail.vue`
> remains the sole owner of the active-row auto-scroll (its own `captureActiveRow` + `watch(activeIndex)`).
> The suite's `scrollIntoView` stub is still exercised by RunRail, so no test regressed. `npm run
> type-check` clean.

**File:** `src/composables/useRunControl.ts:228-236` (and the `railRef`/`captureActiveRow` exports `:861-862`)
**Issue:** `RunRail.vue` owns its own `captureActiveRow` + `watch(activeIndex)` auto-scroll
(`RunRail.vue:46-60`), and `RunControlView.vue` does not bind the composable's `captureActiveRow`
or `railRef` to the child. So `activeItemRef` is never populated and the composable's
`watch(index) → activeItemRef.value?.scrollIntoView(...)` is a permanent optional-chain no-op — a
harmless leftover from the extraction that duplicates the child's logic and can mislead a future
maintainer into thinking the parent still drives scrolling.
**Fix:** Delete `railRef`, `activeItemRef`, `captureActiveRow`, and the `watch(index)` scroll block
from `useRunControl` (and drop them from the returned object); the child is the sole owner now.

### IN-02: `B` and the arrow keys are active in State A (pre-flight), so blackout can be toggled and the show can be advanced off "slide 1" before go-live, with no on-screen control or legend to explain it — ✅ RESOLVED

> **Resolved 2026-08-29** (commit `6c136a76`). `handleKeydown` now branches on `live`: in pre-flight
> (`!live`) ONLY `Enter` (go live, WR-02) and `Escape` (open exit confirm) act; the transport keys
> (arrows/Space) and blackout (`B`) are inert. A stray pre-flight keypress can therefore no longer
> advance `index` off slide 0 or toggle `blackout` — go-live always starts on slide 0, un-blacked,
> which subsumes the "reset blackout at go-live" mitigation the fix offered as a minimum. A regression
> test asserts ArrowRight/ArrowDown/`B` in State A post no new `state` and leave the mount post at
> `{index:0, blackout:false}`. `npm run type-check` clean; bare `npx vitest run` shows only the
> `storage.rules.test.ts` baseline.

**File:** `src/composables/useRunControl.ts:242-276` (`handleKeydown` is document-wide from mount), `:797` (slide 0 posted on mount)
**Issue:** `postIndex(0)` runs on mount, so `index` is `0` (not null) throughout State A. Because the
document keydown handler is live from mount, pressing `B` in pre-flight toggles `blackout.value` and
posts `{index:0, blackout:true}` (harmless while no window is open, but it means Go-live then opens
the projector already black via the `hello` resend), and the arrow keys advance `index` — yet State
A shows neither the Output panel/`B` legend (both State B-only) nor a program preview, and the
copy promises "puts slide 1 on the screens." So a stray keypress silently changes what go-live will
show, with nothing in State A reflecting it. Recoverable (Clear in State B), low impact.
**Fix:** Either ignore `B`/navigation while `!live` in `handleKeydown`, or surface the pre-live
blackout/position state in State A. At minimum, reset `blackout` to false at the start of
`openOutputs`/`rehearse` so go-live never starts black from a pre-flight keypress.

### IN-03: In the `partial` recovery state one display is genuinely open, but the pre-flight cards and header dots both render a hardcoded/derived "Not open" for it

**File:** `src/components/run/RunPreflightPanel.vue:34-39,59-64` (badges hardcoded "Not open"), `src/composables/useRunControl.ts:724-729` (`audienceOpen`/`confidenceOpen` false when `outputStatus==='partial'`)
**Issue:** On `partial` (`live=false`, one window open), the view falls to State A. The pre-flight
Audience/Confidence cards always render a static amber "Not open" badge regardless of actual state,
and the header dots read amber because `audienceOpen`/`confidenceOpen` are false for `partial`. So
the one display that DID open is shown as "Not open" everywhere except the accurate `run-partial-banner`.
Minor honesty gap in a rare state; the banner carries the real story. (Also: `RunPreflightPanel`'s
`serviceName` prop is declared but never rendered — the panel heading is the static "Ready when you
are" — dead prop.)
**Fix:** Optional — drive the pre-flight badges from the real per-role open flags, and drop the
unused `serviceName` prop (or render it).

### IN-04: `useRunControl` returns several derivations the redesigned view never consumes

**File:** `src/composables/useRunControl.ts:819-886` (return object)
**Issue:** `filmstripCurrentIndex`, `filmstrip`, `firstIndexBySlot`, `countLabel`, `goByItem`,
`serviceName` (view uses it, but `RunPreflightPanel` ignores it), and the dead `railRef`/
`captureActiveRow` (IN-01) are exported but unused by `RunControlView.vue` (the template passes
`index` directly as `RunFilmstrip :currentIndex`, uses `filmstripSlides`/`filmstripIndices`, and
navigates via `goBySlide`/`jumpToSlot`). The comment at `:863-864` acknowledges some are
"forward-enabling." Not a bug — surface area to prune so the composable's public contract matches
what is actually wired.
**Fix:** Trim the return object to the members the view (and tests) actually use, or annotate the
intentionally-forward-exported ones.

---

_Reviewed: 2026-08-29T06:33:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
