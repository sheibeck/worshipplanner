---
phase: 95-run-control-screen
verified: 2026-08-29T00:48:56Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "On real Chrome/Edge with two monitors and a saved matched mapping, click Run on a locked service, then click Go live ONCE."
    expected: "Both audience and confidence windows open, each lands on its assigned monitor and goes fullscreen from the single gesture; the status cluster shows the green 'Displays ready' with the correct per-monitor labels."
    why_human: "getScreenDetails() + window.open + requestFullscreen({ screen }) placement across physical displays and the transient-activation window cannot be exercised in jsdom; tests mock window.open (returns null) and assert call args only."
  - test: "Drive a full live service end-to-end from the keyboard: Right/Space next slide, Left previous, Down/Up next/prev item; watch the audience + confidence outputs track every navigation."
    expected: "Every keypress immediately updates BOTH live output windows to the selected slide with no separate push-to-live step; the rail 'you are here' highlight and the dual preview follow."
    why_human: "Real cross-window BroadcastChannel propagation to live output windows and the operator's perception of latency/'in charge' feel are runtime/hardware qualities."
  - test: "Press Escape (or click Exit) mid-service and evaluate the confirm dialog's feel; confirm to exit, and cancel on a separate run."
    expected: "A stray Escape never tears down the live service — it opens a confirm; confirming closes both output windows (projector goes blank) and returns to the editor; cancelling leaves the live service untouched."
    why_human: "The subjective 'safe/calm' feel of the confirm gate and the real projector-blanking on window.close() are hardware-observable, not unit-testable."
  - test: "Force the fallback path (no saved mapping / non-matching monitors): click Go live, then drag each pop-out onto its monitor and click its own Enter fullscreen affordance."
    expected: "Two un-positioned pop-outs open with an amber (never red) 'finish setting up your displays' banner and a monitor-setup link; each output window's own fullscreen affordance works after manual placement."
    why_human: "Manual drag-to-monitor + per-window fullscreen and the pop-out lifecycle require a real multi-window browser session."
  - test: "Force the blocked and partial popup states on real hardware: with the pop-up blocker on, click Go live (blocked = zero windows); on a browser that grants only one window per gesture, click Go live (partial = one dark display)."
    expected: "Blocked shows the amber 'browser blocked the display windows' banner + retry and NEVER a green ready claim; partial shows the amber 'only one display opened' banner naming the dark role (audience/confidence) + retry, and never a green 'Displays ready'."
    why_human: "Real browser pop-up-blocker behavior and one-window-per-gesture policies are environment-specific and cannot be reproduced in jsdom's window.open stub."
---

# Phase 95: Run/Control Screen + Run Entry Point Verification Report

**Phase Goal:** A projectionist can start and drive a locked service's live presentation from one calm control screen that stays in charge of both output windows, with no separate "push to live" step.
**Verified:** 2026-08-29T00:48:56Z
**Status:** human_needed (pass-with-deferred-human-UAT)
**Re-verification:** No — initial verification

## Goal Achievement

Verified in SOURCE (not merely that tests pass) against ROADMAP Phase 95 success criteria, REQUIREMENTS R261-R266/R275, 95-CONTEXT boundary, and the 95-REVIEW resolved/open findings. Every behavior-dependent invariant (single-writer seq monotonicity, onHello resend, Escape-no-teardown, WR-01 stale-resolution guard, WR-02 partial honesty) is additionally backed by a passing behavioral test, so each is VERIFIED rather than present-only.

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Run button on a locked service opens a standalone Run screen (not editor); absent/disabled on draft (R261) | ✓ VERIFIED | `ServiceEditorView.vue:2125` `canRunService = isLocked && !!orgId`; button `v-if="canRunService"` (`:102`), header flex row not the editor lock banner; `onRun` (`:2132`) pure `router.push('/run/'+encodeURIComponent(id)+'?org=…')`; route `/run/:serviceId` name `run-control` (`router/index.ts:125-128`), lazy standalone `RunControlView.vue`, not the editor. Tests: draft absent, editor present, navigates (ServiceEditorView.test.ts:8860-8898). |
| 2 | Any authenticated org member (editor OR viewer) can Run; running grants no edit ability (R275) | ✓ VERIFIED | Gate is `isLocked && !!orgId` — NOT `isEditor` (`:2125`); route is `requiresAuth` only, no RBAC tier (`router/index.ts:128`); `onRun` performs no store mutation. Test: viewer (isEditor=false) sees Run (test.ts:8875); org-less absent (:8884). |
| 3 | Order-of-service list with current item highlighted + large current preview + smaller next preview (R262, R264) | ✓ VERIFIED | `railRows` (`RunControlView.vue:539`) built from `sortedSlotsWithIndex` with `isActive = item.index === currentSlotIndex` (`:548`); active row styled/dotted (`:290-300`). Dual preview: dominant current `<SlideCanvas :interactive="false">` in `lg:col-span-2` (`:334-347`), smaller next in `lg:col-span-1` (`:358-366`). Tests: highlight moves on nav (test.ts:354), current+next+"End of service" (:506). |
| 4 | Clicking an item jumps live to its first slide; keyboard Right/Space=next, Left=prev, Down/Up=item, Escape=exit-with-confirm (R263, R265) | ✓ VERIFIED | `jumpToSlot` (`:578`) via `firstAssembledIndexBySlot`, no-op on empty slot; `goByItem` walks skipping empty slots (`:561`); `handleKeydown` (`:599`) maps keys exactly; Escape only sets `confirmOpen=true` (`:621-623`), top guard `if (confirmOpen.value) return` (`:600`) makes nav keys inert; only `confirmExit` (`:829`) tears down (closeOutputs→handle.close→push). Tests: click posts first index / empty no-op (:375), arrows (:415,:440), Escape opens dialog without teardown, nav inert (:459), confirm navigates (:481). |
| 5 | Current/selected slide IS live — no separate push-to-live step (R266) | ✓ VERIFIED | Single writer: `postIndex` (`:487`) is the ONLY state write path, `seq += 1` before every `handle.postState`; view registers `onHello` only, NEVER `onState` (`:852-854`) so it cannot act on its own state; `resendCurrent` also bumps seq (`:494`). No push-to-live control exists. Tests: strictly-increasing seq on every nav (:271), onHello resends higher seq (:303), go-live-once no double slide-0 (:328), no push control (:528). |

**Score:** 5/5 truths verified (0 present, behavior-unverified). All behavior-dependent truths carry a passing named behavioral test.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/composables/useServiceAssembly.ts` | Extracted shared service-load + read-only assembly slice | ✓ VERIFIED | Owns `serviceId`/`orgIdRef` scoping, initial-load watch, read-only `useSlideshowAssembly`, WR-02 org-mismatch subscribe gate; registers NO `unsubscribeAll`/`onUnmounted` (so in-app route never tears down peers). Consumed by both consumers. |
| `src/composables/useOutputWindow.ts` | Refactored to consume useServiceAssembly | ✓ VERIFIED | `unsubscribeAll()` stays ONLY in this composable's `onUnmounted`; 12 tests green — Phase 93/94 not regressed. |
| `src/views/RunControlView.vue` | Control screen: single-writer channel, rail, dual preview, keyboard, Escape-confirm, honest Go-live state machine + stale guard | ✓ VERIFIED | 873 lines, all contracts present and wired; `idle/opening/placed/partial/fallback/blocked` states mutually exclusive by one ref; WR-01 `goLiveRequestId`+`isUnmounted` guard; WR-02 `bothOpened` gate. |
| `src/router/index.ts` | `/run/:serviceId`, requiresAuth only | ✓ VERIFIED | `router/index.ts:125-128`, name `run-control`, `meta:{requiresAuth:true}`, no RBAC tier. |
| `src/views/ServiceEditorView.vue` | Run button, `canRunService = isLocked && !!orgId` | ✓ VERIFIED | `:2125`/`:102`/`:2132`; IN-03 encodeURIComponent applied. |
| `RunControlView.test.ts` (12) | Core behavioral tests | ✓ VERIFIED | 12 tests pass. |
| `RunControlView.output.test.ts` (12) | Output-orchestration tests incl. WR-01/WR-02 regressions | ✓ VERIFIED | 12 tests pass. |
| ServiceEditorView Run-button block (+5) | R261/R275 button tests | ✓ VERIFIED | 5 tests (draft absent, editor present, viewer present, org-less absent, navigates). |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| RunControlView | runChannel | `openRunChannel` + `postState` (single writer), `onHello`→`resendCurrent` | ✓ WIRED (`:852-854`, `:487-498`) |
| RunControlView | serviceSlots | `sortedSlotsWithIndex` (rail), `firstAssembledIndexBySlot` (jump) | ✓ WIRED (`:508-509`, `:578`) |
| RunControlView | monitorConfig | `loadMapping`/`matchMapping`/`computeFingerprint` in Go-live gesture | ✓ WIRED (`:793-803`) |
| RunControlView | useServiceAssembly | shared load+assembly slice | ✓ WIRED (`:478`) |
| ServiceEditorView Run button | `/run/:serviceId?org=` | `router.push` on click | ✓ WIRED (`:2138`) |
| Go-live gesture | audience/confidence output windows | plain `window.open` (no noopener) + `requestFullscreen({screen})` | ✓ WIRED (`:675-700`); real placement is human_needed |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 95 core suite | `vitest run RunControlView.test.ts` | 12 passed | ✓ PASS |
| Phase 95 output suite | `vitest run RunControlView.output.test.ts` | 12 passed | ✓ PASS |
| Phase 93 audience (no regression) | `vitest run AudienceOutputView.test.ts` | 18 passed | ✓ PASS |
| Phase 94 confidence (no regression) | `vitest run ConfidenceOutputView.test.ts` | 23 passed | ✓ PASS |
| Phase 94 composable (no regression) | `vitest run useOutputWindow.test.ts` | 12 passed | ✓ PASS |
| Type-check gate | `npm run type-check` (vue-tsc --build) | clean | ✓ PASS |
| Full app suite | bare `npx vitest run` | 166 files pass; only `storage.rules.test.ts` fails | ✓ PASS (documented Storage-emulator baseline) |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| --- | --- | --- | --- |
| R261 | Run button on locked service opens standalone screen; absent/disabled on draft | ✓ SATISFIED | Truth 1 |
| R262 | Order of service with "you are here" highlight | ✓ SATISFIED | Truth 3 (`railRows.isActive`) |
| R263 | Click item jumps to its first slide | ✓ SATISFIED | Truth 4 (`jumpToSlot`/`firstAssembledIndexBySlot`) |
| R264 | Large current preview + smaller next preview | ✓ SATISFIED | Truth 3 (dual SlideCanvas) |
| R265 | Keyboard nav + Escape-with-confirmation | ✓ SATISFIED | Truth 4 (`handleKeydown`, confirm gate) |
| R266 | Single-selection, no push-to-live | ✓ SATISFIED | Truth 5 (single-writer `postIndex`) |
| R275 | Any member (editor or viewer) can Run; no new RBAC, no edit path | ✓ SATISFIED | Truth 2 (`!!orgId` gate, requiresAuth route) |

### Anti-Patterns Found

None blocking. No unreferenced TBD/FIXME/XXX markers in the phase files. The empty-array/null literals in RunControlView are reactive initial state overwritten by assembly/navigation, not stubs. 95-REVIEW open items IN-01/IN-02/IN-04 are documented, low-likelihood, accepted cosmetic/theoretical notes (misleading load-vs-empty copy; unclamped stale index after a mid-run shrink; a non-reachable setup→mount ordering edge) — none affect any success criterion. WR-01, WR-02, and IN-03 are RESOLVED in commits e3072efa / 36394d0f and confirmed in source.

### Regression Check — Phases 92/93/94

No regression. `useServiceAssembly` registers no `unsubscribeAll`/`onUnmounted`, so the extraction cannot tear down peers' store subscriptions; `useOutputWindow` retains its own teardown. Suite evidence: Audience 18, Confidence 23, composable 12 — all green, matching the pre-phase baselines. The full run shows 4593 tests passing across 166 files.

### Human Verification Required

Five pre-declared real-hardware UAT items (95-CONTEXT § Verification, deferred to milestone end) — see frontmatter `human_verification`:
1. Real two-monitor open + place + fullscreen from one Go-live click on Chrome/Edge.
2. End-to-end keyboard driving of a live service across both output windows.
3. The Escape-confirm feel + real projector-blanking on confirmed exit.
4. The pop-out fallback drag-to-monitor + per-window fullscreen.
5. The blocked and partial popup states on real hardware.

### Gaps Summary

No gaps. All 5 ROADMAP success criteria and all 7 requirements (R261-R266, R275) are code-verified in source with passing behavioral tests, and Phases 92-94 did not regress. Status is `human_needed` solely because of the five pre-declared real-hardware UAT items that jsdom cannot exercise — these are expected deferrals, not failures. Verdict: pass-with-deferred-human-UAT.

---

_Verified: 2026-08-29T00:48:56Z_
_Verifier: Claude (gsd-verifier)_
