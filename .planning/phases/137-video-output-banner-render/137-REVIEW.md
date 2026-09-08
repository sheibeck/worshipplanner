---
phase: 137-video-output-banner-render
reviewed: 2026-09-08T02:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/components/output/FullscreenSlideOutput.vue
  - src/utils/monitorConfig.ts
  - src/views/MonitorSetupView.vue
  - src/composables/useOutputWindow.ts
  - src/types/service.ts
  - src/components/slides/SlotVideoOutputControl.vue
  - src/components/slides/SlideGrid.vue
  - src/views/ServiceEditorView.vue
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 137: Code Review Report

**Reviewed:** 2026-09-08T02:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the three Phase 137 commits (`0c82e49d`, `8e649800`, `d30e2194`) against the four
priority areas called out in scope: the banner render branch on `FullscreenSlideOutput.vue`,
key-color read-time validation in `monitorConfig.ts`, the `videoOutput` field + relay chain
(`SlotVideoOutputControl` → `SlideGrid` → `SlidesTab` → `ServiceEditorView`), and the
`MonitorSetupView.vue` key-color card gating.

The banner render branch is solid: it is additive and correctly scoped to
`role==='video' && videoOutput.mode==='banner'`, the FULLSCREEN path (`bg-black`/`rootStyle`)
is untouched for every other case, the second `useContainScale` region is independently wired
(own `containerRef`/`scale`, no shared-state collision with the main stage), and the v-if
toggle cleanly mounts/unmounts the banner container (Vue nulls the template ref on unmount,
which disconnects the `ResizeObserver` via the existing `watch` in `useSlideAutoFit.ts`). This
is backed by a dedicated, well-targeted test file
(`FullscreenSlideOutput.banner.test.ts`) that asserts the required matrix (banner-flagged,
unflagged, explicit-fullscreen, audience-ignores-videoOutput, null/out-of-range index).

The key-color injection guard is also correctly implemented: `loadVideoKeyColor` validates the
strict `^#[0-9a-fA-F]{6}$` pattern **on read**, not just on write, with a well-tested set of
rejection cases (CSS `expression()`, a bare color keyword, wrong-typed `enabled`, malformed
JSON, a throwing storage backend) — all falling back to the transparent-default
`{enabled:false, colorHex:'#FF00FF'}`, never throwing.

The `videoOutput` field and relay chain (Plan 01) are additive/optional exactly as documented,
mirror the existing `loop` field's persistence pattern verbatim, and ride the existing
`useAutoSave` deep-watch with no new save path — this is a low-risk, well-tested change.

The one real defect found is in `MonitorSetupView.vue`: the new "Video output background" card
is placed inside the `v-else` (editable-grid) branch and is therefore **unreachable** in the
State B2 "already configured, matches live screens" branch — which is the state a returning
user normally lands in. See CR-01.

## Critical Issues

### CR-01: Video output background card is unreachable in the normal "already configured" state

**File:** `src/views/MonitorSetupView.vue:40-166`
**Issue:** The template has two top-level branches inside `phase === 'granted'`:
- `v-if="grantedView === 'matched' && !editingFromMatched"` (lines 40-60) — the "Your displays
  are set up" / State B2 summary, which is what a returning user with an unchanged monitor
  layout sees on every subsequent visit (`resolveGrantedBranch()` sets `grantedView.value =
  'matched'` whenever `matchMapping()` returns `'matched'`, per
  `src/views/MonitorSetupView.vue:419-423`).
- `v-else` (lines 63-167) — the editable grid, entered either on first-time setup, on a
  layout-delta ("partial"), or after explicitly clicking "Reassign roles"
  (`editingFromMatched.value = true`).

The new "Video output background" card (lines 136-166) is nested entirely inside the second
(`v-else`) branch, gated additionally on `hasVideoRoleAssigned` (a computed over
`roleByFingerprint`, which IS correctly populated in the matched case via
`applyAssignmentsToMaps(saved.assignments)` at line 423 — so the underlying data is available,
only the markup placement is wrong).

Net effect: once a church has completed monitor setup and assigned the Video role (the
steady-state a location returns to on every subsequent visit), the key-color card simply does
not render. The only way to reach it is to click "Reassign roles" — a button whose label and
stated purpose ("Reassign roles") has nothing to do with adjusting the Video output's
background — which is a confusing, undiscoverable workaround for what should be a
direct settings toggle. This makes the R427 admin surface effectively unusable for its primary
audience (a returning operator who already has Video role assigned and only wants to flip
transparent ↔ key-color).

No test exercises this path: `MonitorSetupView.test.ts` has no assertions at all for
`video-key-color-card`, `video-key-color-toggle`, or `video-key-color-picker` (confirmed via
grep — zero matches), and the existing State B2 "matched" tests
(`MonitorSetupView.test.ts:278+`) never assert on the new card's presence/absence, so this gap
shipped without a failing test to catch it.

**Fix:** Move the card outside the `v-if`/`v-else` split so it renders in both granted-view
branches, gated only on `hasVideoRoleAssigned` (and `phase === 'granted'`, which is already the
enclosing condition):

```vue
<!-- Granted -->
<div v-else-if="phase === 'granted'">
  <div v-if="grantedView === 'matched' && !editingFromMatched" ...>
    ...
  </div>
  <div v-else>
    ...
  </div>

  <!-- R427 — moved out of the v-if/v-else split so it is reachable from
       BOTH the "already configured" summary and the editable grid. -->
  <div v-if="hasVideoRoleAssigned" class="mt-4 rounded-lg bg-gray-900 border border-gray-800 p-4" data-testid="video-key-color-card">
    ...
  </div>
</div>
```

Add a test asserting the card renders in the State B2 "matched" branch (mount → detect →
save with a Video role assigned → remount → assert `video-key-color-card` exists without
clicking "Reassign roles").

## Warnings

### WR-01: No component-level test coverage for the MonitorSetupView key-color card

**File:** `src/views/MonitorSetupView.vue:136-166`, `src/views/__tests__/MonitorSetupView.test.ts`
**Issue:** Commit `8e649800` added thorough unit tests for `saveVideoKeyColor`/`loadVideoKeyColor`
in `monitorConfig.test.ts`, but added zero tests for the new UI card itself — not the
visibility gate (`hasVideoRoleAssigned`), not the checkbox/color-input round-trip through
`onVideoKeyColorChange`, and not (per CR-01) the branch-placement bug. A card with a
`data-testid` and non-trivial conditional visibility logic shipping with no view-level test is
how CR-01 slipped through.
**Fix:** Add tests mounting `MonitorSetupView` with a Video-role assignment present, covering:
card hidden when no monitor has role `'video'`; card visible when one does (in both the
`matched` and editable-grid branches, once CR-01 is fixed); toggling the checkbox and picking a
color calls `saveVideoKeyColor` with the expected value.

## Info

### IN-01: Key-color is read once at setup with no live-update path while the output window is open

**File:** `src/components/output/FullscreenSlideOutput.vue:194-196`
**Issue:** `const keyColor = loadVideoKeyColor()` reads localStorage exactly once at component
setup and is never re-read. If an operator opens the Video output window and then changes the
key-color setting in `MonitorSetupView` (a different tab/window) while the output is already
running, the change will not take effect until the output window is closed and reopened. The
code comment explains this is a deliberate, discretionary choice ("this standalone output
window opens fresh per launch, so a live storage-event listener is unnecessary"), so this is
not a functional bug, but it is worth surfacing as an explicit product/UX tradeoff: an operator
mid-service has no visible affordance telling them a key-color change requires relaunching the
Video output.
**Fix:** No code change required if the tradeoff is accepted; consider adding a one-line note
to the "Video output background" card in `MonitorSetupView.vue` (e.g. "Relaunch the Video
output window to apply a change") so operators aren't left wondering why a live change had no
effect.

---

_Reviewed: 2026-09-08T02:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
