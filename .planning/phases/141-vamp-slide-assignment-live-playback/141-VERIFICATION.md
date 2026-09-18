---
phase: 141-vamp-slide-assignment-live-playback
verified: 2026-09-18T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open a Run session in a FRESH browser profile (no prior autoplay-policy grant), rehearse/go-live on a service with a vamp assigned to the first slide. Do NOT click the arm toggle: advance to the vamp slide and confirm no sound plays and the on-screen state stays 'Audio: Off'. Then click 'Audio: Armed' and confirm the vamp plays audibly from the control machine's speakers, loops, and stops on slide change/blackout/exit."
    expected: "No sound before arming; audible looping playback from the control machine only after arming; the Audience/Confidence/Video output windows (open on other monitors/machines) stay silent for the same slide — no echo/triple-play."
    why_human: "Real audible output and Chrome's autoplay-policy enforcement on a fresh profile are hardware/browser-dependent and cannot be modeled in jsdom (VALIDATION.md Manual-Only Verifications, row 1 and 2). Automated tests already prove the code-level state machine (arm/disarm, play/pause sequencing, single-audio-element invariant, suppressAudio gate on all three outputs) via src/views/__tests__/RunControlView.audio.test.ts and the three output-view suites."
  - test: "With a real deployed session and no arm click, advance to a vamp slide, confirm the amber 'Audio blocked — click to play' banner appears (simulating the browser rejecting an unprimed play()), then click 'Play audio' and confirm playback starts and the banner clears."
    expected: "A visible, persistent warning appears whenever playback is genuinely blocked by the browser — never a silent failure — and the one-click retry recovers it."
    why_human: "Browser autoplay-policy rejection (NotAllowedError) is a real Chrome behavior not reproducible in jsdom; the composable/view wiring for the blocked-banner and retry path is unit-proven (RunControlView.audio.test.ts 'blocked-banner+retry' case), but the actual browser-triggered rejection is hardware/browser-dependent (VALIDATION.md row 2)."
  - test: "Visually compare the vamp picker (EditSlideDrawer), the assigned-vamp row, the Run header's arm toggle/playing-dot/unavailable indicator, the ♪ Vamp badges on the preview panes, and the delete-confirm warning line against 141-UI-SPEC.md."
    expected: "Layout, spacing, copy, and color treatment match the UI-SPEC's markup/classes (already reproduced verbatim in source, per source-level checks in this report) when rendered in a real browser."
    why_human: "Visual/layout design fidelity is a judgment call that grep/unit assertions cannot make; VALIDATION.md explicitly routes this to batched UAT (row 3). Source-level fidelity (exact classes, copy strings, data-testids) was directly confirmed against 141-UI-SPEC.md in this verification pass."
  - test: "Delete a vamp that is genuinely assigned to a slide in an upcoming service; confirm the warning shows the correct count, then confirm the delete; reopen the slide's editor and confirm the slide's audio still plays (the MP3 was kept in Storage) even though the vamp no longer appears in the library."
    expected: "The MP3 file survives in Storage and the slide's denormalized audioUrl keeps resolving; the editor row still shows 'Vamp: {label} (no longer in library)'."
    why_human: "This is the R440 concurrency/real-Storage backstop explicitly marked `verification: backstop` in 141-04-PLAN.md's must_haves (an assignment created between the pre-delete scan and the delete is an accepted residual risk) — it requires a real Firestore/Storage round trip in a deployed environment, not a mocked unit test. Unit tests already prove the conditional-keep branch logic in isolation (src/stores/__tests__/vamps.test.ts)."
---

# Phase 141: Vamp Slide Assignment & Live Playback Verification Report

**Phase Goal:** A planner can assign a vamp to a slide, and it plays audibly and reliably as that slide goes
live in Run the Service, with no silent failures.
**Verified:** 2026-09-18
**Status:** human_needed
**Re-verification:** No — initial verification

## Owner Decision Applied

Per `141-CONTEXT.md` ("Owner decision, 2026-09-13") and the ROADMAP's Phase 141 "Planning note", this
verification checks vamp audio against **control-window-only playback** (all three outputs silent via
`suppressAudio`), which supersedes the originally-worded "Audience output only" success criteria 2–3 and
R438/R439 text. The control-window ownership is treated as the correct, intended design — not a gap.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A planner assigns a vamp to a slide via a "Choose a vamp" picker in the service editor, and can change/clear the assignment (R437) | ✓ VERIFIED | `src/components/VampPicker.vue` (searchable, sortable list; disabled `No MP3` rows with `aria-disabled`). `EditSlideDrawer.vue#attachVampToSlide` (line 924) denormalizes `vamp.attachment.downloadUrl` → `audioUrl`, sets `audioLoop: true`, `vampId`, `vampLabel` in ONE `replaceGroupSlides` fresh-base write (line 941); is idempotent on re-selecting the same vamp; `clearVampAssignment` (line 950) deletes all 4 keys on a shallow copy (never writes `undefined`). `ServiceEditorView.vue` subscribes `vampStore` inside the `authStore.isEditor` gate (line 3177-3179). Confirmed by direct source read; `npx vitest run src/components/__tests__/VampPicker.test.ts src/components/slides/__tests__/EditSlideDrawer.test.ts src/views/__tests__/ServiceEditorView.test.ts` — all green (executed this pass). |
| 2 | When a slide with an assigned vamp goes live, its vamp plays and loops until the slide changes or is cleared, audible ONLY from the Run control window; Audience/Confidence/Video outputs are silent by construction (R438, owner override) | ✓ VERIFIED | **Control-window owner:** `RunControlView.vue` mounts exactly ONE `<AudioPlayer>` (`data-testid="run-control-audio"`, line 42), keyed on `current.slide.audioUrl`, wired to `useRunControl.ts`'s `onAudioBlocked/onAudioError/onAudioPlay/onAudioPause`. `useRunControl.ts` (lines 258-321) implements `stopAudio`/`tryPlayAudio` gated on `audioArmed && !blackout`, a multi-source `watch([id, audioUrl])` that pauses-then-replays only on a genuine slide-identity/url change (never a resend), a `watch(blackout)` pause/resume, and resets in `endServiceTeardown()`/`endRehearsal()`/`onUnmounted`. **Outputs silenced:** `SlideCanvas.vue` `suppressAudio` prop (line 339) forces `currentAudioUrl` to `null` (line 390-391) as the FIRST guard in the computed — gating the `presentation-audio` `v-if`. All four output-tier mounts hardcode `:suppress-audio="true"`: `FullscreenSlideOutput.vue` (lines 38, 65 — covers Audience + Video, which are confirmed thin delegating wrappers with zero own edits) and `ConfidenceOutputView.vue` (lines 41, 74). Behavioral tests executed this pass and passed: `RunControlView.audio.test.ts` (arm→play, disarm→pause, hello-resend-no-restart, url-change pause-before-play + single element, same-url reuses element, blackout pause/resume, exit resets to Off — 13+ tests), `SlideCanvas.test.ts` `suppressAudio` describe (5 tests, incl. blackout override + reactive toggle), and the three output-view suites' non-vacuous `every(suppressAudio === true)` assertions. |
| 3 | A projectionist arms audio with an explicit gesture on the Run control screen; if playback is still blocked, a visible warning is shown — never a silent failure (R439) | ✓ VERIFIED | `RunHeader.vue` renders `run-audio-toggle` (`Audio: Off` / `Audio: Armed`, `aria-pressed`, needed-pulse, sr-only `run-audio-needed-prompt`) emitting `toggle-audio` → `useRunControl.ts#toggleAudioArmed` (line 272), which primes/plays immediately on arm (the click is the R439 gesture) and pauses on disarm. `RunControlView.vue` renders `run-audio-blocked-banner` (line 185, `v-if="audioBlocked"`) with `Audio blocked — click to play` + a `run-audio-blocked-retry` button calling `retryPlayAudio`; `run-audio-unavailable` badge on media `error`. Arm state is in-memory only, reset in `endServiceTeardown`/`endRehearsal`/`onUnmounted` (never persisted — no `localStorage`/`sessionStorage` writes found). Behavioral tests executed this pass and passed: arm-plays-immediately, second-click-disarms, blocked-banner+retry-clears, error-indicator+clears-on-change, exit-resets-to-Off (`RunControlView.audio.test.ts`). |
| 4 | A `♪ Vamp: {label}` badge is visible on the operator's On-screen/Next-up preview panes for an assigned slide, resolved off the stored entry (never the assembler output) | ✓ VERIFIED | `useRunControl.ts#vampLabelFor` (line 328) resolves via `useSlideGroups().groupsBySlotId.get(slide.groupId)?.slides.find(...)` — never `AssembledSlide`/`Slide`. `RunPreviewPair.vue` renders `run-current-vamp-badge`/`run-next-vamp-badge` (lines 48, 98) bound to `currentVampLabel`/`nextVampLabel` props, `font-medium` + `max-w-[220px] truncate`, plus `:suppress-audio="true"` on its own inert preview canvases (lines 63, 112 — defense-in-depth). `RunPreviewPair.test.ts` (badge describe, 4 tests) + `RunControlView.audio.test.ts` integration case — executed this pass, passed. |
| 5 | Deleting a vamp assigned to one or more upcoming services' slides shows a warning naming the affected count, but the deletion is always allowed; already-assigned slides keep playing (R440) | ✓ VERIFIED | `src/stores/vamps.ts#countAssignments` (line 96) — best-effort `getDocs` scan of `organizations/{org}/slideGroups` filtered on matching `vampId`, joined to distinct `services` via `getDoc`, counting `date >= todayYmd()` as upcoming; fails open to `null` on error/missing orgId (never throws). `deleteVamp` (line 128) computes `keepAttachment = scan === null \|\| scan.assignedAnywhere` — the MP3 is kept whenever ANY assignment exists (any service) or the scan failed; `deleteDoc` always runs. `VampSlideOver.vue`'s `watch(showDeleteConfirm)` (line 401) runs the scan once per confirm-open and renders `vamp-delete-warning` (`Assigned in {N} upcoming service{s} — those slides keep their audio.`, singular-branched) or `vamp-delete-warning-generic` (`May be assigned to slides.`) — `onDelete()` (line 449) never reads either ref, so the scan can never gate the Delete button. Tests executed this pass and passed: `vamps.test.ts` (`countAssignments (R440)` + `deleteVamp — conditional Storage keep (R440)` describes) and `VampSlideOver.test.ts` (`VampSlideOver — R440 delete warning` describe, incl. pending-never-blocks and failure-never-blocks cases). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/slideGroup.ts` | `GroupSlideEntry.vampId?`/`vampLabel?` | ✓ VERIFIED | Lines 76, 78 — additive, optional, display-only |
| `src/components/VampPicker.vue` | Searchable vamp list, props-driven | ✓ VERIFIED | No store import; `vamps`/`loading`/`selectedVampId` props, `select` emit; disabled No-MP3 rows |
| `src/components/slides/EditSlideDrawer.vue` | assign/change/clear via fresh-base write | ✓ VERIFIED | `attachVampToSlide`/`clearVampAssignment`/`openVampPicker`/`closeVampPicker`/`onVampSelected`, all through `replaceGroupSlides` |
| `src/views/ServiceEditorView.vue` | `vampStore.subscribe` inside editor gate | ✓ VERIFIED | Line 3177-3179, inside `authStore.isEditor` block |
| `src/components/slides/SlideCanvas.vue` | `suppressAudio` render-time gate | ✓ VERIFIED | Line 339 prop, line 390-391 guarded computed, no template edit needed |
| `src/components/output/FullscreenSlideOutput.vue` | `:suppress-audio="true"` x2 | ✓ VERIFIED | Lines 38, 65 |
| `src/views/ConfidenceOutputView.vue` | `:suppress-audio="true"` x2 | ✓ VERIFIED | Lines 41, 74 |
| `src/views/AudienceOutputView.vue` / `VideoOutputView.vue` | Untouched (delegate to FullscreenSlideOutput) | ✓ VERIFIED | Confirmed both are thin wrappers with no `suppressAudio`/audio-related edits |
| `src/composables/useRunControl.ts` | Audio state machine + vamp-label lookup | ✓ VERIFIED | `AudioPlayerHandle`, `audioArmed/Blocked/Unavailable/Playing/Needed`, `toggleAudioArmed`, `vampLabelFor`, teardown resets |
| `src/views/RunControlView.vue` | Single `AudioPlayer` mount + blocked banner | ✓ VERIFIED | `run-control-audio`, `run-audio-blocked-banner`/`retry` |
| `src/components/run/RunHeader.vue` | Arm toggle + indicators | ✓ VERIFIED | `run-audio-toggle`, `run-audio-playing`, `run-audio-unavailable`, `run-audio-needed-prompt` |
| `src/components/run/RunPreviewPair.vue` | ♪ Vamp badges + suppress-audio | ✓ VERIFIED | `run-current-vamp-badge`/`run-next-vamp-badge`, both preview canvases suppressed |
| `src/types/vamp.ts` | `VampAssignmentScan` | ✓ VERIFIED | Line 35 |
| `src/stores/vamps.ts` | `countAssignments` + conditional `deleteVamp` | ✓ VERIFIED | Lines 96-147 |
| `src/components/VampSlideOver.vue` | Delete-confirm warning line | ✓ VERIFIED | `vamp-delete-warning`/`vamp-delete-warning-generic`, scan never gates delete |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `EditSlideDrawer.vue` assign/clear | `useSlideGroups().replaceGroupSlides` | Same fresh-base helper `attachSlideAudio`/`removeSlideAudio` already use | ✓ WIRED | Lines 941, 966 |
| `SlideCanvas.vue` `suppressAudio` | `currentAudioUrl` computed | First-statement guard mirroring `suppressBackground` | ✓ WIRED | Lines 390-391 |
| 4 output-tier `SlideCanvas` mounts | `suppressAudio` prop | Hardcoded `:suppress-audio="true"` | ✓ WIRED | `FullscreenSlideOutput.vue` x2, `ConfidenceOutputView.vue` x2 |
| `RunControlView.vue` `<AudioPlayer ref="audioElRef">` | `useRunControl.ts` `audioElRef` | Composable-owned template ref (same pattern as `cancelBtnRef`) | ✓ WIRED | Confirmed both sides reference the same ref name |
| `useRunControl.ts` `vampLabelFor` | `useSlideGroups().groupsBySlotId` | Raw `GroupSlideEntry` lookup, bypassing the assembler | ✓ WIRED | Line 328-334; `AssembledSlide`/`slide.ts`/`slideshowAssembler.ts` untouched (confirmed no vamp fields added there) |
| `RunHeader.vue` `run-audio-toggle` click | `useRunControl.ts#toggleAudioArmed` | `@click="$emit('toggle-audio')"` → `RunControlView.vue` `@toggle-audio="toggleAudioArmed"` | ✓ WIRED | Parent-owns-state contract, same as blackout toggle |
| `VampSlideOver.vue` delete-confirm open | `vampStore.countAssignments` | `watch(showDeleteConfirm)` — one scan per open, never inside `onDelete()` | ✓ WIRED | Line 401-415; `onDelete` (line 449) confirmed to not read `affectedServiceCount`/`scanFailed` |
| `vamps.ts#deleteVamp` | `countAssignments` | Re-scans inside `deleteVamp` itself; `keepAttachment` branches `deleteObject` | ✓ WIRED | Lines 133-141 |

### Behavioral Spot-Checks / Targeted Test Execution

Per the orchestrator's regression gate (full suite + type-check already run and clean, 2026-09-18), this
pass executed the 11 phase-141-specific test files directly (not the full suite) to confirm behavioral
proof, not just presence:

| Suite | Result |
|-------|--------|
| `RunControlView.audio.test.ts` | ✓ PASS |
| `RunPreviewPair.test.ts` | ✓ PASS |
| `SlideCanvas.test.ts` | ✓ PASS |
| `vamps.test.ts` | ✓ PASS |
| `VampSlideOver.test.ts` | ✓ PASS |
| `VampPicker.test.ts` | ✓ PASS |
| `EditSlideDrawer.test.ts` | ✓ PASS |
| `ServiceEditorView.test.ts` | ✓ PASS |
| `AudienceOutputView.test.ts` | ✓ PASS |
| `ConfidenceOutputView.test.ts` | ✓ PASS |
| `VideoOutputView.test.ts` | ✓ PASS |

Combined result: **11 files, 699 tests, all passed** (executed 2026-09-18 as part of this verification).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R437 | 141-01 | Assign/change/clear a vamp on a slide | ✓ SATISFIED | Truth #1, artifacts above |
| R438 | 141-02, 141-03 | Vamp plays + loops while live, audible only from control window, outputs silent (owner override) | ✓ SATISFIED | Truths #2, #4 |
| R439 | 141-03 | Explicit arm gesture + visible blocked-audio warning | ✓ SATISFIED | Truth #3 |
| R440 | 141-04 | Delete-vamp warning with affected-service count, never blocks | ✓ SATISFIED | Truth #5 |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps only R437-R440 to Phase 141 (marked `[x]` Complete),
and all four are declared across the four plans' frontmatter (`requirements:` fields).

### Anti-Patterns Found

None. Scanned all 14 phase-141 modified/created source files (types, stores, composables, and components
listed in the artifacts table) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and
"not yet implemented"/"coming soon" phrasing — zero matches. All `placeholder` string matches found are
legitimate HTML `placeholder=` input attributes (search box, name/tempo fields) or pre-existing,
phase-unrelated code (`ServiceEditorView.vue`'s "Add to existing plan" slot-matching logic) — none are stub
markers.

Code review (`141-REVIEW.md`, 3 fix iterations, `141-REVIEW-FIX.md`) reports `status: clean` (0 critical,
0 warning, 1 info) as of the final re-review; the 3 post-summary fix commits (`084aadb2`, `6c7d2f6b`,
`5ad2126e`) are present in `git log` and their effects (stale error-banner reset on retry, rejected-delete
surfacing via `finally`-independent catch) were confirmed present in the current source
(`EditSlideDrawer.vue` `beginVampWrite`/`failVampWrite`, `VampSlideOver.vue` `onDelete`'s `catch` block).

### Human Verification Required

See frontmatter `human_verification` (4 items): real-speaker/fresh-profile audibility + silence-on-outputs
(R438), real autoplay-block/retry on an actual browser (R439), visual fidelity against 141-UI-SPEC.md
(R437/R439/R440), and the R440 concurrency/real-Storage delete-keeps-the-file backstop. All four are
explicitly scoped as Manual-Only in `141-VALIDATION.md` and batched to the v2.15 milestone's
deferred-verification policy (`STATE.md`, `.planning/v2.15-DEFERRED-VERIFICATION.md`) — consistent with
Phase 140's verification pattern, not a new gap.

### Gaps Summary

No gaps. All 5 goal-backward truths (R437-R440, including the owner's 2026-09-13 control-window-only
audio override) are backed by source-level evidence and passing behavioral tests executed directly in
this pass (not merely claimed in the SUMMARYs). The owner's audio-ownership decision is correctly
implemented as the single audio owner in the Run control window, with all three outputs structurally
silenced (render-time gate, not a post-mount mute). The only remaining items are the four Manual-Only
hardware/browser/visual/production checks already anticipated by the phase's own VALIDATION.md and the
project's standing v2.15 batched-UAT policy — the same pattern Phase 140 was verified against.

---

_Verified: 2026-09-18_
_Verifier: Claude (gsd-verifier)_
