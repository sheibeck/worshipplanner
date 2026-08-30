---
phase: 97-run-service-redesign
verified: 2026-08-29T03:05:00Z
status: human_needed
score: 10/10 must-haves verified (code) + 1 machinery-preservation truth
behavior_unverified: 0
overrides_applied: 0
verdict: pass-with-deferred-human-UAT
gates:
  type_check: clean (vue-tsc --build)
  vitest_app: 169 files pass; only src/storage.rules.test.ts fails (documented Storage-emulator baseline — not a regression)
human_verification:
  - test: "Go live on real hardware — verify BOTH output windows auto-open AND self-fullscreen on their assigned monitors with no manual re-enter."
    expected: "Audience → projector, Confidence → band monitor, both fullscreen on the correct screens on the first Go live."
    why_human: "requestFullscreen({ screen }) + window.open placement require a live user-gesture activation and real multi-monitor Window Management grants; jsdom cannot exercise cross-monitor fullscreen. Pre-declared in 97-CONTEXT."
  - test: "Confidence monitor legibility — read current (left) + next (right) side-by-side from the band's viewing distance."
    expected: "Current dominant on the left is legible; next preview on the right reads smaller but usable; backgrounds are black."
    why_human: "Legibility/scale at physical distance is a visual judgment. Pre-declared in 97-CONTEXT."
  - test: "Blackout on the projector — press B / click Black during a live service, then Clear."
    expected: "Projector goes fully black immediately and restores to the current slide on Clear; no partial reveal."
    why_human: "Real projector paint + channel round-trip across windows is only provable on hardware. Pre-declared in 97-CONTEXT."
  - test: "Clock + elapsed timers and in-item filmstrip navigation during a live run."
    expected: "Clock shows wall time, elapsed counts from go-live; clicking a filmstrip thumb jumps the outputs to that slide."
    why_human: "End-to-end timing feel + cross-window slide jump under real BroadcastChannel. Pre-declared in 97-CONTEXT."
  - test: "Closed / unplug recovery on hardware — close an output window or unplug a monitor mid-service, then Reopen / reassign."
    expected: "Honest closed/reassign banner appears; Reopen restores the display to the current slide without losing place."
    why_human: "Physical monitor teardown + screenschange events cannot be simulated in jsdom. Pre-declared in 97-CONTEXT."
  - test: "Overall run/stop feel — full pre-flight → go live → run → End service cycle on the owner's rig."
    expected: "Calm pre-flight, confident go-live, clean teardown (projector blanks on exit)."
    why_human: "Holistic UX judgment on real hardware. Pre-declared in 97-CONTEXT (v2.4 DEFERRED-HUMAN-UAT set)."
---

# Phase 97: Run Service Redesign — Verification Report

**Phase Goal:** The live Run experience matches the owner's approved design and resolves the hardware-UAT UX issues — calm pre-flight → live control screen, side-by-side confidence, auto-fullscreen outputs, blackout, timers, in-item filmstrip, rehearse mode, and a service-list Run button — without regressing any Phase 92–96 correctness machinery.

**Verified:** 2026-08-29
**Status:** human_needed (all code-verifiable criteria PASS; six pre-declared hardware-UAT items deferred)
**Verdict:** **pass-with-deferred-human-UAT**
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths (Requirements R276–R284)

| # | Truth | Status | Evidence (source-traced) |
|---|-------|--------|--------------------------|
| R276 | Pre-flight ("Ready when you are", Go-live centered) + live (program/next-up split, in-item filmstrip, transport bar) states; next-up smaller/scaled | ✓ VERIFIED | `RunControlView.vue` two-state by `live` (`:354` State A `RunPreflightPanel`, `:376` State B). `RunPreflightPanel.vue` centered "Ready when you are" + `run-go-live-btn` (`:127`). `RunPreviewPair.vue` program LEFT (`lg:col-span-2`) + next-up RIGHT scaled `nextScale=0.8` transform (`:56`). `RunFilmstrip.vue` + `RunTransportBar.vue` present in State B. |
| R277 | Live status not-green before go-live, green once live (via go-live OR rehearse; never partial/blocked) | ✓ VERIFIED | `live` set true ONLY in `openPlaced` (`useRunControl.ts:578`), `openUnplaced` (`:595`) — both past the `bothOpened` gate — and `rehearse` (`:138`); reset in `confirmExit` (`:701`). `RunHeader.vue` `run-status--live` = green (`:191-198`), `--idle` = amber "Not open" (`:199-206`), driven by `live` prop only. `bothOpened` returns before the `live` assignment on partial/blocked. |
| R278 | Output windows self-fullscreen on load (feature-detected, role-resolved, try/caught, manual fallback) | ✓ VERIFIED | `useOutputWindow.ts` `selfFullscreen()` called on mount (`:201`), `resolveAssignedScreen()` feature-detects `getScreenDetails` (`:127`), role-resolved via `loadMapping`/`computeFingerprint`, try/catch + promise `.catch` swallowed (`:144-163`); manual `handleReenterFullscreen` remains as `v-if="!isFullscreen"` fallback in both output views. Passed `role: 'audience'`/`'confidence'` from each view. |
| R279 | Confidence current+next side-by-side (left/right), backgrounds suppressed to black, last-slide no-reflow | ✓ VERIFIED | `ConfidenceOutputView.vue` root `flex flex-row` (`:14`); current `flex-[3_1_0%]` LEFT (`:24`), next `flex-[2_1_0%]` RIGHT (`:47`), both `:suppressBackground="true"`; next scaled `scale(0.8)` (`:52`); next region div is unconditional (only inner content is `v-if="nextSlide"`) so last-slide advance does not reflow the current pane. |
| R280 | Blackout/clear (+B key) via channel `blackout` field with correct seq advance | ✓ VERIFIED | `postBlackout` (`useRunControl.ts:123-128`) sets `blackout.value` then bumps `seq` BEFORE posting (mirrors `resendCurrent`) so runChannel's monotonic drop accepts it; `postIndex`/`resendCurrent` carry `blackout.value`. `B`/`b` toggles (`:286-292`). Black/Clear buttons `run-blackout-btn`/`run-clear-btn` → `postBlackout(true/false)` (`RunControlView.vue:407,421`). Both output views render `v-if="blackout"` full-bleed overlay after SlideCanvas, before the reenter affordance. |
| R281 | Clock + elapsed timers | ✓ VERIFIED | `useRunTimers.ts` single ~1s interval; `clock` = wall time, `elapsed` from go-live origin; `startElapsed` idempotent (first go-live OR rehearse), `resetElapsed` on exit; interval cleared on unmount. Rendered in `RunHeader.vue` `run-clock`/`run-elapsed` (`:76-78`). |
| R282 | In-item filmstrip click-to-jump (global index) | ✓ VERIFIED | `filmstrip` computed filters `assembledSlideshow` by `currentSlotIndex`, building parallel `slides`+GLOBAL `indices` (`useRunControl.ts:762-774`). `RunFilmstrip.vue` emits `@jump(thumb.index)` = the GLOBAL array index, wired to `postIndex` (`RunControlView.vue:383`). |
| R283 | Rehearse without opening windows | ✓ VERIFIED | `rehearse()` sets `live` + `startElapsed` + posts slide 0; NO `window.open`/`getScreenDetails`/`openPlaced`/`openUnplaced` (`useRunControl.ts:137-141`); `outputStatus` stays `idle`. WR-01 hardening: `reopenOutput` early-returns when `!live || liveScreenDetails === null` (`:401`) so a stray dot click during rehearse opens nothing. |
| R284 | Run button on locked service rows in the listing (viewer-inclusive) | ✓ VERIFIED | `ServiceCard.vue` `canRun = isLocked && !!authStore.orgId`, `isLocked = status !== 'draft'` (viewer-inclusive, NOT `isEditor`) (`:99-100`); `run-service-card-btn` `v-if="canRun"`, `@click.stop`; `onRun` pushes `/run/:id?org=` with both ids `encodeURIComponent`-encoded (`:105-112`). |
| Preserve | Phase 92–96 machinery not regressed (single-writer seq, onHello resend, exit-confirm no-teardown, closed-poll/reopen, reassign precedence, no-leak, WR-01 reopen guard, confidence suppression); client-only | ✓ VERIFIED | See "Machinery Preservation" below. `npx vitest run` = 169 files pass (only Storage-rules baseline fails). No `firebase`/`firestore`/`onSnapshot`/`collection`/`doc` import in any Phase 97 file. |

**Score:** 10/10 code-verifiable requirements verified; machinery-preservation truth verified.

### Machinery Preservation (Phase 92–96, do-not-regress)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| Single-writer seq + onHello resend | ✓ | `postIndex`/`resendCurrent` bump `seq` before every `postState` (`useRunControl.ts:103-114`); `handle.onHello(resendCurrent)` on mount (`:822`). |
| Subscribe-before-channel | ✓ | `useServiceAssembly()` called FIRST (`:79`) so its subscribe `onMounted` registers before the channel-opening `onMounted` (`:820`). |
| WR-01 stale guard | ✓ | `goLiveRequestId`/`isUnmounted` token bump (`:623`), stale drop (`:634`/`:665`), `confirmExit` bump (`:691`), `onUnmounted` set (`:836`). |
| Exit-confirm no immediate teardown | ✓ | Escape opens `confirmOpen`, never tears down; `confirmExit` runs `stopRecoveryWatchers()` → `closeOutputs()` → `handle.close()` → router push (`:688-709`). |
| Teardown order (watchers before close) | ✓ | `stopRecoveryWatchers()` (`:697`) precedes `closeOutputs()` (`:706`) in confirmExit and in `onUnmounted` (`:841-842`). |
| Closed-poll / reopen / reassign precedence | ✓ | `startClosedPoll` (latch-only), `reopenOutput` (synchronous, held ScreenDetails), `onScreensChange` reassign, `reopenReassignedOutputs`; reassign banner suppresses reopen chip in template (`RunControlView.vue:73,107`). |
| WR-01 reopen guard (no window opens outside go-live, incl. rehearse) | ✓ | `reopenOutput` early-returns on `!live.value || liveScreenDetails === null` (`:401`); `RunHeader` dots are affordances only when `live && !open` (`audienceReopenable`/`confidenceReopenable`), disabled + early-return otherwise (`:45-52`). |
| No leaked interval/listener | ✓ | `stopRecoveryWatchers` clears `pollId` + removes `screenschange`; `useRunTimers` clears its own interval; keydown removed on unmount (`:843`). |
| Confidence black-suppression + last-slide no-reflow | ✓ | Both panes `:suppressBackground="true"`; next region div unconditional (R279 evidence). |
| Client-only | ✓ | Zero Firestore/rules imports in Phase 97 files (grep clean). |

### No Fake Features Smuggled In

| Omitted feature | Status | Evidence |
|-----------------|--------|----------|
| Presence / "N watching" | ✓ absent | No presence code in any run component. |
| CCLI preflight | ✓ absent | Appears only in comments explaining its omission; readiness is `renderState`-derived (`renderedCount`/`allRendered`, `useRunControl.ts:733-737`). |
| Key/BPM | ✓ absent | Comment-only omission note in `RunPreviewPair.vue`. |
| Logo-cut output | ✓ absent | Not present; Output panel is Black/Clear only. |
| Stage 3rd output | ✓ disabled placeholder | `RunDisplaysPanel.vue` `run-display-stage-off` `aria-disabled="true"`, "Off" label, no 3rd-output build (`:113-124`). |
| Follow-me-on-confidence | ✓ absent | Not present. |

### Code Review Cross-Check

`97-REVIEW.md` (deep, 13 files): 0 critical. WR-01 (pre-live/rehearse dot opening a window) and WR-02 (Enter-to-go-live not wired) both **✅ RESOLVED** — confirmed in source: `reopenOutput` guard at `:401`, `RunHeader` `reopenable` gating, and the `Enter` branch in `handleKeydown` (`:252-255`) calling `openOutputs()` while `!live`. IN-01/IN-02 resolved (dead auto-scroll removed; pre-live keyboard now inert except Enter/Escape — `:250-262`). IN-03 (partial-state "Not open" cosmetic) and IN-04 (unused composable exports) accepted-open, cosmetic, non-blocking.

### Gates

| Gate | Result | Status |
|------|--------|--------|
| `npm run type-check` (vue-tsc --build) | No errors | ✓ PASS |
| `npx vitest run` (app suite) | 169 files pass; 4643 tests pass. Only `src/storage.rules.test.ts` fails (25 tests, Storage-emulator baseline) | ✓ PASS (baseline-only failure) |

The `storage.rules.test.ts` failure is the documented Storage-emulator cross-service-read limitation (CLAUDE.md) — a known environment baseline, not a Phase 97 regression. No `--dir src` used.

### Human Verification Required (deferred — milestone held open for owner hardware UAT)

All six items below were **pre-declared** in `97-CONTEXT.md` §Verification and add to the existing v2.4 DEFERRED-HUMAN-UAT set. They are NOT failures — each depends on real multi-monitor hardware, live user-gesture fullscreen grants, or physical monitor teardown that jsdom cannot exercise:

1. Go live → both outputs auto-fullscreen on the right monitors (R278).
2. Confidence left/right legibility at band viewing distance (R279).
3. Blackout on the real projector, B key + Clear (R280).
4. Clock/elapsed timers + filmstrip click-to-jump end-to-end (R281/R282).
5. Closed/unplug recovery — reopen/reassign on hardware.
6. Overall run/stop feel across the full pre-flight → live → End cycle.

### Gaps Summary

No gaps. Every code-verifiable requirement (R276–R284) is implemented and wired in source, the Phase 92–96 correctness machinery is preserved (traced + suite-green), the redesign is client-only, and no fake/unbacked features were introduced. The only outstanding items are the pre-declared hardware-UAT checks the milestone is deliberately held open for.

---

_Verified: 2026-08-29_
_Verifier: Claude (gsd-verifier)_
