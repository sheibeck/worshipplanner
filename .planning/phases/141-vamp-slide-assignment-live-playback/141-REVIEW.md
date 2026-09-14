---
phase: 141-vamp-slide-assignment-live-playback
reviewed: 2026-09-13T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - src/types/slideGroup.ts
  - src/types/vamp.ts
  - src/components/VampPicker.vue
  - src/components/__tests__/VampPicker.test.ts
  - src/components/slides/EditSlideDrawer.vue
  - src/components/slides/__tests__/EditSlideDrawer.test.ts
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/components/slides/SlideCanvas.vue
  - src/components/slides/__tests__/SlideCanvas.test.ts
  - src/components/output/FullscreenSlideOutput.vue
  - src/views/ConfidenceOutputView.vue
  - src/views/__tests__/AudienceOutputView.test.ts
  - src/views/__tests__/ConfidenceOutputView.test.ts
  - src/views/__tests__/VideoOutputView.test.ts
  - src/composables/useRunControl.ts
  - src/views/RunControlView.vue
  - src/components/run/RunHeader.vue
  - src/components/run/RunPreviewPair.vue
  - src/views/__tests__/RunControlView.audio.test.ts
  - src/components/run/__tests__/RunPreviewPair.test.ts
  - src/stores/vamps.ts
  - src/stores/__tests__/vamps.test.ts
  - src/components/VampSlideOver.vue
  - src/components/__tests__/VampSlideOver.test.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: issues_found
---

# Phase 141: Code Review Report

**Reviewed:** 2026-09-13
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the Phase 141 diff against `33ce439f^`: vamp assignment in `EditSlideDrawer.vue`/`VampPicker.vue`,
the control-window-only audio state machine in `useRunControl.ts`/`RunControlView.vue`, `suppressAudio`
propagation through `SlideCanvas.vue` and all three output views, and the R440 delete-warning scan in
`vamps.ts`/`VampSlideOver.vue`.

The core mechanisms hold up well under adversarial tracing:
- `suppressAudio` gates both the resolved value (`currentAudioUrl`) and the `<AudioPlayer>` mount site in
  `SlideCanvas.vue`, and all three output-tier call sites (`FullscreenSlideOutput.vue` for
  Audience/Video, `ConfidenceOutputView.vue`) hardcode it `true`, with tests that record and assert the
  actual per-instance prop value rather than just checking the component compiles.
- The control-window audio state machine (`tryPlayAudio`/`postBlackout`/the `[id, audioUrl]` watch) correctly
  gates `.play()` on armed-and-not-blackout, pauses on slide change/blackout/exit, and resets arm state on
  every teardown path (`endServiceTeardown`, `endRehearsal`) and on `onUnmounted`. The real `AudioPlayer.vue`
  (not a stub) is exercised in `RunControlView.audio.test.ts`, giving good confidence in the
  autoplay-blocked/error wiring.
- `EditSlideDrawer.vue`'s assign/change/clear paths write through the single `replaceGroupSlides` fresh-base
  helper, never write `undefined` into an entry field (uses `delete` on a shallow copy, matching the
  existing `removeSlideAudio` idiom), and the idempotent-reselect / stale-vamp-hint logic is correctly gated
  on `vampStore.isLoading` (which defaults `true` and never flips for a viewer whose store never subscribes
  — `ServiceEditorView.vue` subscribes `useVampStore()` strictly inside the `isEditor` gate, and this is
  regression-tested).
- `countAssignments`/`deleteVamp` in `vamps.ts` fail open (`scan === null` keeps the attachment), count
  distinct `serviceId`s, filter on `date >= todayYmd()`, and leave Phase 140's `setAttachment`/
  `removeAttachment` byte-for-byte untouched (confirmed via `git diff`).

Four warnings below are worth fixing before this ships to real operators; none are data-loss or security
issues, but two are genuinely reproducible UI/robustness defects introduced by this phase's new code
(items WR-01 and WR-03).

## Warnings

### WR-01: Vamp picker's open/closed state is never reset when the drawer closes, only when the selected entry changes

**File:** `src/components/slides/EditSlideDrawer.vue:886-892, 896, 906-913`

**Issue:** `vampPickerOpen` is a local `ref(false)` reset only by the `watch(() => props.entry?.id, ...)`
handler (line 886-892) and by `closeVampPicker()` (called only from `onVampSelected`, line 952-955). Nothing
resets it when the drawer itself closes. `SlidesTab.vue` mounts `EditSlideDrawer` unconditionally
(`<EditSlideDrawer :open="drawerOpen" ... />`, no `v-if` around the component) — the component instance,
and therefore `vampPickerOpen`, persists across every open/close cycle. Reproduction: open the drawer on a
slide with no audio, click "Choose a vamp" (picker opens), click the drawer's own close button (X) without
picking a vamp, then reopen the drawer for the *same* slide (e.g. click it again in the grid without
selecting a different slide in between) — `props.entry?.id` never changes, so the picker panel is still
expanded on reopen, taking up layout space and showing a search box the operator never asked for. This is
new code (confirmed via `git diff 33ce439f^..HEAD`) — there is no equivalent leak for other per-slide UI
state in this file, because nothing else in the drawer has state that outlives a `props.entry` change.

**Fix:** Reset it in the same `watch(isOpenAndResolvable, ...)` handler that already handles focus/keydown
teardown on close (around line 643-647):
```ts
} else {
  window.removeEventListener('keydown', onKeydown)
  previouslyFocused?.focus?.()
  previouslyFocused = null
  vampPickerOpen.value = false // WR-01: don't leak the picker open across a close/reopen
}
```

### WR-02: The inline vamp picker has no cancel/close affordance of its own

**File:** `src/components/slides/EditSlideDrawer.vue:346-352`, `src/components/VampPicker.vue`

**Issue:** Once opened via "Choose a vamp" or "Change" (`openVampPicker()`), the only way `vampPickerOpen`
returns to `false` is selecting a vamp (`onVampSelected` → `closeVampPicker()`) or the entry changing. There
is no close/cancel button on `VampPicker.vue` itself, and no click-outside dismissal. An operator who opens
the picker, changes their mind, and wants to keep the currently-assigned vamp (or the currently-attached
manual file) has no way to back out except switching to a different slide and back (which happens to reset
it via the entry-id watch) or closing the whole drawer (which, per WR-01, doesn't even reliably work).

**Fix:** Add a small "Cancel" affordance to `VampPicker.vue` (a new `cancel` emit) or a close button in the
picker's header row in `EditSlideDrawer.vue`, wired to `closeVampPicker()`.

### WR-03: Vamp assign/clear writes have no error handling — a failed write is a silent no-feedback failure

**File:** `src/components/slides/EditSlideDrawer.vue:916-932` (`attachVampToSlide`), `934-950`
(`clearVampAssignment`)

**Issue:** Both functions `await slideGroupsStore.replaceGroupSlides(...)` with no `try`/`catch` and no
status update. Contrast with `onSpeakerToggle`, `onDuplicate`, and `onConfirmDelete` in the same file, which
all wrap their write in `try { ... } catch (err) { console.error(...) }`, and with the debounced text-field
path (`writeField`) which additionally sets a visible `status.value = 'error'` rendered as "Failed to save.
Please try again." in the header. If `replaceGroupSlides` rejects here (permission-denied, a stale
`sourceSignature` conflict, offline), the operator sees the picker close (or stay open, per `onVampSelected`
which calls `closeVampPicker()` unconditionally after `attachVampToSlide` regardless of whether it
succeeded) with no error surfaced anywhere — the audio row still shows the *old* state (no vamp, or the
previous vamp), and nothing tells the operator the assignment didn't take. This is exactly the kind of
"never a silent failure" gap the phase's own R439 (audio blocked/unavailable) design explicitly guards
against for playback — the same principle doesn't reach the assignment write path itself. There is no test
in `EditSlideDrawer.test.ts` that exercises a rejected `replaceGroupSlides` for the vamp paths (the loop/
speaker/notes paths are equally exercisable but also untested for the failure branch — this file's error
paths generally aren't unit-tested — but the vamp path additionally lacks even the `console.error` a
maintainer could grep for in production logs).

**Fix:** Wrap both writes the same way `onSpeakerToggle` does:
```ts
async function attachVampToSlide(vamp: Vamp): Promise<void> {
  ...
  try {
    await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
  } catch (err) {
    console.error('Failed to assign vamp to slide:', err)
    // surface via the existing `status`/statusText mechanism, or a dedicated flag
  }
}
```

### WR-04: `VampSlideOver.vue`'s delete has no error handling either

**File:** `src/components/VampSlideOver.vue:443-453`

**Issue:** `onDelete()` awaits `vampStore.deleteVamp(id)` inside a bare `try { ... } finally { isDeleting.value
= false }` — there is no `catch`. If `deleteVamp` rejects (e.g. `deleteDoc` permission-denied), `isDeleting`
resets and the delete-confirm panel just sits there with no error message; the operator has no way to know
the delete failed versus succeeded-and-still-showing (the drawer only closes/emits `deleted` on the caller's
own success path, so nothing here tells them which happened). `deleteVamp` itself is designed to be
fail-open only for the *scan* (`countAssignments`), not for the final `deleteDoc` call, which can still
throw.

**Fix:** Add a `catch` that surfaces an inline error (mirroring the pattern already used for
`vamp-mp3-upload-error` rows a few lines above in the same file) instead of relying on `finally` alone.

## Info

### IN-01: No warning is shown for a vamp assigned only to past services, even though the MP3 is silently retained

**File:** `src/components/VampSlideOver.vue:259-264`

**Issue:** When `countAssignments` returns `{ assignedAnywhere: true, upcomingServiceCount: 0 }` (the vamp
is only referenced by services whose date is before today), the confirm dialog shows neither
`vamp-delete-warning` (`affectedServiceCount > 0` is false) nor `vamp-delete-warning-generic` (`scanFailed`
is false) — the operator sees a plain "Delete '{name}'? This cannot be undone." with no indication that
`deleteVamp` will keep the MP3 object in Storage indefinitely (per R440's `keepAttachment` logic in
`vamps.ts`). This matches the letter of the 141-CONTEXT.md decision (the warning copy is defined only for
the upcoming-count and scan-failure cases), so it is not a spec violation, but it is a UX blind spot: the
orphaned Storage object has no further UI path to ever being cleaned up, and the operator is never told it
exists.

**Fix (optional):** Consider a third, lower-key copy variant ("Keeps its audio on past services.") when
`assignedAnywhere && upcomingServiceCount === 0`, purely for operator awareness — not required by the locked
decision.

---

_Reviewed: 2026-09-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
