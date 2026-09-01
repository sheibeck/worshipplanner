---
phase: 107-visual-stage-layout
reviewed: 2026-09-01T09:43:11Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/types/service.ts
  - src/utils/stageLayout.ts
  - src/components/stage/StageLayoutView.vue
  - src/components/stage/StageLayoutEditor.vue
  - src/views/ServiceEditorView.vue
  - src/views/serviceEditorActionBar.ts
  - src/stores/services.ts
  - src/views/ShareView.vue
  - src/components/ServicePrintLayout.vue
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found_fixed
fix_log:
  fixed_at: 2026-09-01T09:56:00Z
  fixed: 5
  deferred: 1
  commits:
    - id: WR-01
      hash: eeeb003f
    - id: WR-02
      hash: eeeb003f
    - id: WR-03
      hash: 1106ff0b
    - id: IN-01
      hash: cc113ed6
    - id: IN-03
      hash: e86b9527
      followup_hash: d2a99519
  deferred_ids:
    - IN-02
---

# Phase 107: Code Review Report

**Reviewed:** 2026-09-01T09:43:11Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the full Visual Stage Layout surface: the additive `StageMarker`/`Service.stageLayout`
type, the pure geometry helpers, the shared read-only renderer, the freeform Pointer-Events drag
editor, the `ServiceEditorView` wiring (tab gating + autosave payload fix), the `buildServiceSnapshot`
denormalization, and both public/print read-only render surfaces.

The public-surface security requirements hold up under adversarial reading: `ShareView.vue` reads
only the already-fetched `serviceSnapshot` (confirmed — no new `getDoc`/org-scoped read introduced),
`buildServiceSnapshot()` projects markers through an explicit 6-field object literal (never a raw
spread — verified against `services.stageLayout.test.ts`'s smuggled-`secretField` test), the
conditional spread correctly omits the `stageLayout` key entirely (never writes `undefined`) when a
service has no layout or zero markers, and `StageLayoutView.vue` binds every label through Vue text
interpolation only — no `v-html`, no `innerHTML`, confirmed XSS-safe. The `onSave()` payload's
`data.stageLayout ?? null` fix genuinely closes the clear-on-empty gap it claims to: `stripUndefined`
preserves `null` (only drops `undefined`), so the explicit `null` reaches Firestore's `updateDoc` and
actually overwrites the remote field — traced end-to-end including the `maybeRefreshShareLink`
merge path, which correctly re-derives an empty snapshot from the merged `null`. Draft-lock gating is
consistent: `StageLayoutEditor`'s template unmounts every interactive element when `editable` is
false (falls back to the same shared `StageLayoutView`), and every mutation handler in
`ServiceEditorView` re-checks `canEditService.value` independently of the child's own `editable` gate
(defense in depth against a stale prop during a lock race).

The drag mechanics are where the real gaps are. `dragState` is a single component-scoped ref, not
keyed by pointer or marker, so a second pointer landing on a chip while a drag is already in flight
silently clobbers the first drag's state and leaks its pointer capture (WR-01) — exactly the kind of
multi-touch edge case this phase's own commentary calls out as historically dangerous for this
codebase. The zone bounding rects are captured once at `pointerdown` and never revalidated for the
remainder of that same drag, so a resize or scroll that happens strictly between `pointerdown` and
`pointerup` (mid-drag) can produce a stale zone/percentage resolution at drop (WR-02). Neither of
these is exercised by the test suite. A handful of minor code-quality items round out the findings.

## Warnings

### WR-01: A second pointer starting a drag while one is already in progress clobbers `dragState` and leaks pointer capture on the first chip

**Status:** ✅ Fixed — commit `eeeb003f`. `onChipPointerDown` now returns early (never calls `setPointerCapture`) when `dragState.value` is already set, so a second pointer can no longer clobber the first drag or leave its chip's capture unreleased. Regression test added in `StageLayoutEditor.test.ts` (`WR-01: a second pointerdown on another chip...`) simulating a second pointerdown mid-drag and asserting the first drag completes normally, capture is released, and the second chip never gets capture.

**File:** `src/components/stage/StageLayoutEditor.vue:195-212`
**Issue:** `dragState` is a single `ref<DragState | null>` shared by every marker chip in both zones, and `onChipPointerDown` overwrites it unconditionally:
```ts
function onChipPointerDown(event: PointerEvent, marker: StageMarker) {
  if (!props.editable) return
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  dragState.value = { markerId: marker.id, pointerId: event.pointerId, ... }
}
```
There is no guard against a drag already being in progress. If a second pointer (a second finger on
a touchscreen — the exact device class this feature targets per 107-CONTEXT.md/PITFALLS Pitfall 3, or
even a second finger landing on a *different* chip) fires `pointerdown` on another marker while the
first pointer is still down, `dragState.value` is reassigned to describe the second drag. From that
point on:
- `onChipPointerMove`/`onChipPointerUp` for the FIRST marker check `ds.markerId !== marker.id`, which
  now fails (ds points at the second marker), so they return **before** reaching
  `target.releasePointerCapture(event.pointerId)` — the first chip's DOM element keeps pointer
  capture for the first pointer indefinitely (until the underlying OS/browser force-releases it), and
  that drag is silently abandoned with no `move` emitted (so no data corruption), but the chip
  visually snaps back and its element is left in a captured state that the app never explicitly
  released.
- This is a genuine, reachable "drag corruption" edge case on exactly the touch hardware this feature
  is built for (a tech volunteer's tablet), and it is not covered by any test in
  `StageLayoutEditor.test.ts` (every drag test in that file uses a single hardcoded `pointerId: 1`).

**Fix:** Guard `onChipPointerDown` against a drag already in flight, and/or key `dragState` by
`pointerId` so two independent drags cannot collide:
```ts
function onChipPointerDown(event: PointerEvent, marker: StageMarker) {
  if (!props.editable) return
  if (dragState.value) return // a drag is already in progress — ignore additional pointers
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  dragState.value = { markerId: marker.id, pointerId: event.pointerId, ... }
}
```
Add a regression test that dispatches a second `pointerdown` (different `pointerId`, different
marker) while the first marker's drag is mid-flight, and asserts the first chip's pointer capture is
released and no `move` is emitted for either the abandoned or the orphaned pointer.

### WR-02: Zone bounding rects captured once at `pointerdown` are never revalidated if the layout reflows mid-drag

**Status:** ✅ Fixed — commit `eeeb003f`. Implemented option (a) from the review's own fix suggestion: `resize`/`scroll` listeners (scroll registered in the capture phase, since ancestor-container scroll does not bubble to `window`) are registered for the duration of a drag and abort it (no emit) exactly like `pointercancel` if either fires. Regression tests added for both the resize and scroll cases.

**File:** `src/components/stage/StageLayoutEditor.vue:195-260`
**Issue:** `onstageRect`/`offstageRect` are fetched via `getBoundingClientRect()` exactly once, at
`pointerdown`, and reused unmodified by `zoneFromPoint`/`pctWithinRect` at `pointerup` — correct per
the phase's own stated design ("never cached across mount or a *prior* drag"), but the code has no
mitigation for a reflow that happens *within* the same drag gesture (window resize, orientation
change, or the page scrolling while the pointer is still down — all plausible on the mobile/tablet
hardware this feature targets, e.g. a keyboard opening for the add-marker label input, or the browser
chrome collapsing on scroll). If that happens, the drop math at `pointerup` resolves the wrong zone
or an off-by-N% position against rects that no longer match the DOM's actual on-screen geometry —
plausible on touch devices, and not covered by any test.
**Fix:** Either (a) treat a `resize`/`scroll` event observed while `dragState.value` is non-null the
same way `pointercancel` is already treated (abort the drag, no emit — cheapest, consistent with the
existing "the platform took the gesture away" philosophy), or (b) re-measure both rects on
`pointerup` immediately before computing the drop math instead of reusing the `pointerdown`-time
values. Option (a) is the smaller, lower-risk change:
```ts
function onWindowReflow() {
  if (!dragState.value) return
  dragState.value = null // treat exactly like pointercancel — abort, no emit
}
// registered/unregistered around the drag lifecycle, or globally with a dragState.value guard
```

### WR-03: Duplicated onstage/offstage marker-chip template block (and equivalently in `StageLayoutView.vue`)

**Status:** ✅ Fixed — commit `1106ff0b`. Extracted the marker-chip block from `StageLayoutEditor.vue` into a new `StageMarkerChip.vue`, rendered once per zone via the existing `v-for`. Deduped `StageLayoutView.vue`'s equivalent onstage/offstage zone-container duplication via a `v-for` over a small zone descriptor array. All existing tests (both files) pass unmodified against the new structure since `data-testid`/class/attribute output is unchanged.

**File:** `src/components/stage/StageLayoutEditor.vue:403-444` and `:460-501`
**Issue:** The entire marker-chip block (chip div, accent dot, label span, edit/remove buttons with
identical SVGs and handlers) is duplicated verbatim between the on-stage and off-stage zone
containers — a ~40-line block copy-pasted with only the surrounding `onstageMarkers`/`offstageMarkers`
loop variable changed. Any future change to the chip markup (e.g. adding a new affordance, changing
the SVG, adjusting the touch target) must be applied twice or the two zones will silently drift. The
same duplication pattern exists between the two zone blocks in the read-only `StageLayoutView.vue`
(`:52-80` vs `:82-110`).
**Fix:** Extract the marker-chip row into a small sub-component (e.g. `StageMarkerChip.vue`) taking
`marker` + the relevant event handlers as props, and render it from a single `v-for` over
`[{ zone: 'onstage', markers: onstageMarkers }, { zone: 'offstage', markers: offstageMarkers }]`, or
extract the zone container itself into a component parameterized by zone. Same suggestion applies to
`StageLayoutView.vue`'s two zone blocks.

## Info

### IN-01: New markers always start at the exact same coordinate, stacking silently when added in sequence

**Status:** ✅ Fixed — commit `cc113ed6`. `submitAdd()` now offsets `xPct`/`yPct` by `(countInZone % 5) * 4` based on how many markers already occupy the target zone; a fresh empty zone still gets the exact 50/50 center. Regression test added.

**File:** `src/components/stage/StageLayoutEditor.vue:97-103`
**Issue:** `submitAdd()` always constructs a new marker at `xPct: 50, yPct: 50` regardless of how many
markers already occupy that zone. Adding two or three markers back-to-back without dragging the
previous one first stacks them exactly on top of each other (same `left`/`top`), which can make it
look like the "Add" click did nothing until the user notices multiple overlapping chips.
**Fix:** Not blocking, but consider a small deterministic offset per existing marker in the target
zone (e.g. `xPct: 50 + (count % 5) * 4`) so sequential adds are visually distinguishable before the
user drags them apart.

### IN-02: Edit/remove chip buttons are only revealed on hover/focus-within, which touch devices without hover cannot trigger directly

**Status:** ⏸ Deferred — left as-is per explicit fix-scope instruction. Already mitigated by the tap-to-popover path (a plain tap opens the full edit popover, which includes its own remove-confirm flow), so the hover-revealed icon buttons are a redundant fast-path rather than the only path to these actions. No code change made.

**File:** `src/components/stage/StageLayoutEditor.vue:417, 474`
**Issue:** `class="ml-1 hidden items-center gap-1 group-hover:flex group-focus-within:flex"` means the
44px edit/remove buttons are invisible until the group is hovered or a descendant is focused. A
touch-only device has no hover state, so a tech volunteer on a tablet can only reach these buttons via
`group-focus-within` (tapping precisely inside the chip without triggering the >4px drag threshold,
which is itself indirect). This is mitigated by the fact that a plain tap (no meaningful movement)
already opens the full edit popover (which includes its own remove-confirm flow), so the buttons are
a redundant fast-path rather than the only path — not blocking, but worth a note since this feature's
stated audience is touch/tablet users.
**Fix:** Consider always showing the icon buttons at a reduced opacity on touch/coarse-pointer media
(`@media (hover: none)`), or explicitly documenting that tap-to-popover is the touch-primary path.

### IN-03: `buildServiceSnapshot`'s marker projection does not defensively re-clamp `xPct`/`yPct`

**Status:** ✅ Fixed — commit `e86b9527` (test correction follow-up in `d2a99519`). The projection now wraps both fields in `clampPct()` from `@/utils/stageLayout`. Regression test added simulating an out-of-range stored value (`xPct: 145, yPct: -20`) and asserting the snapshot clamps to `[0,100]`.

**File:** `src/stores/services.ts:172-179`
**Issue:** Every UI-driven write path (`createMarker`, `pctWithinRect`, `onMoveZone`) clamps
`xPct`/`yPct` to `[0,100]` before the value reaches `Service.stageLayout`, so this is not reachable
through the app's own UI. However `buildServiceSnapshot()` passes `marker.xPct`/`marker.yPct` through
verbatim with no defensive clamp, so any out-of-range value that reaches the stored `Service` document
by a path other than this editor (a future bulk-import, a manual Firestore edit, a bug in a future
caller) would propagate unclamped straight onto the public, unauthenticated `ShareView` page
(`left: 145%`), which is a cosmetic rendering break rather than a security issue given the doc write
itself requires the same org-scoped auth this phase does not change.
**Fix:** Not blocking. Consider clamping defensively inside the projection (`xPct: clampPct(marker.xPct)`)
so the public render surface cannot be pushed off-canvas by a value that didn't originate from this
phase's own UI.

## Fix Log

**Fixed at:** 2026-09-01T09:56:00Z (approximate)
**Fix scope:** 3 Warnings + 2 cheap Info items (per explicit fixer instruction)
**Gates:** `npm run type-check` clean; all affected scoped test files pass.

| ID | Status | Commit | Notes |
|----|--------|--------|-------|
| WR-01 | Fixed | `eeeb003f` | Guarded `onChipPointerDown` against a drag already in flight; new regression test |
| WR-02 | Fixed | `eeeb003f` | Abort drag on mid-drag `resize`/`scroll`, mirroring `pointercancel`; 2 new regression tests |
| WR-03 | Fixed | `1106ff0b` | Extracted `StageMarkerChip.vue`; deduped `StageLayoutView.vue` zones via `v-for` |
| IN-01 | Fixed | `cc113ed6` | Deterministic per-marker-count offset on new-marker placement; new regression test |
| IN-02 | Deferred | — | Left as-is per fix scope — already mitigated by tap-to-popover; no code change |
| IN-03 | Fixed | `e86b9527` (+ test correction `d2a99519`) | `buildServiceSnapshot` projection now clamps `xPct`/`yPct`; new regression test |

**Verification performed per fix:**
- `npx vue-tsc --noEmit -p tsconfig.app.json` (fast inner-loop) after each change
- `npm run type-check` (`vue-tsc --build`, includes test files) clean after all fixes — one follow-up
  commit (`d2a99519`) was needed to drop an unused `@ts-expect-error` in the IN-03 test, which the
  narrower `-p tsconfig.app.json` form would have silently missed
- `npx vitest run` scoped to every touched test file — all passing, no baseline regressions:
  - `src/components/stage/__tests__/StageLayoutEditor.test.ts` (29 tests)
  - `src/components/stage/__tests__/StageLayoutView.test.ts` (9 tests)
  - `src/stores/__tests__/services.stageLayout.test.ts` (7 tests)
  - `src/stores/__tests__/services.test.ts` (109 tests, broader sanity check on the shared `services.ts` file)

**Files touched:**
- `src/components/stage/StageLayoutEditor.vue`
- `src/components/stage/StageLayoutView.vue`
- `src/components/stage/StageMarkerChip.vue` (new)
- `src/components/stage/__tests__/StageLayoutEditor.test.ts`
- `src/stores/services.ts`
- `src/stores/__tests__/services.stageLayout.test.ts`

---

_Reviewed: 2026-09-01T09:43:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-09-01_
_Fixer: Claude (gsd-code-fixer)_
