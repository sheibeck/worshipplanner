---
phase: quick-260918-pms
quick_id: 260918-pms
slug: add-a-vamp-button-slide-over
plan: 01
subsystem: slides-editor
tags: [vamp, group-media-panel, slide-over, ux-consistency]
dependency-graph:
  requires: [260918-nm2]
  provides: [VampPickerSlideOver]
  affects: [SlideGroupMusicControl]
tech-stack:
  added: []
  patterns: ["dedicated slide-over shell component (mirrors RoleSlideOver.vue)", "window-keydown Escape close (mirrors EditSlideDrawer.vue)"]
key-files:
  created:
    - src/components/VampPickerSlideOver.vue
    - src/components/__tests__/VampPickerSlideOver.test.ts
  modified:
    - src/components/slides/SlideGroupMusicControl.vue
    - src/components/slides/__tests__/SlideGroupMusicControl.test.ts
decisions:
  - "New dedicated VampPickerSlideOver.vue component, not a shared wrapper — matches this app's convention of every slide-over inlining its own shell (RoleSlideOver.vue, VampSlideOver.vue)."
  - "VampPicker.vue left completely untouched; the slide-over accepts its mt-2 root margin and max-h-56 list cap as-is per the plan's design point 2."
metrics:
  duration: "~50 minutes"
  completed: "2026-09-18"
status: complete
---

# Quick Task 260918-pms: "+ Add a vamp for this group" real button + slide-over picker Summary

Replaced the group media panel's two "Choose a vamp" text links with a real `<button>` reading
`+ Add a vamp for this group`, styled byte-identically to the neighbouring `group-music-add` label,
and replaced the inline `VampPicker` mount with a new dedicated `VampPickerSlideOver.vue` — the
app's standard right-hand slide-over shell (Teleport, backdrop, panel, header with title `Choose a
vamp` and a × close, Escape-to-close) hosting the unmodified `VampPicker` in its scrolling body.

## What Was Built

### Task 1 — `VampPickerSlideOver.vue`
A new props-only component mirroring `RoleSlideOver.vue`'s shell exactly (Teleport to body,
backdrop `Transition` + panel `Transition` with the same class strings, header
`flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 shrink-0` containing
only the title `Choose a vamp` and a × Close button — no Cancel/Save, since `VampPicker` owns its
own Cancel). Body wraps `<VampPicker>` unchanged and forwards `vamps`/`loading`/`selectedVampId`.
Escape-to-close mirrors `EditSlideDrawer.vue`'s `window` keydown listener pattern: added on open,
removed on close and on unmount. `select` and `close` are the only two emits; the parent owns
`open` and decides whether to close on select.

9 new tests in `VampPickerSlideOver.test.ts` cover: closed renders nothing; open renders shell +
title + close button + VampPicker with all three props passed through and hosted inside the panel;
selecting a row re-emits `select` without closing itself; the picker's own `cancel` closes with no
select; the header ×, the backdrop, and Escape all close with no select; a closed `open` prop or an
unmount removes the Escape listener (no further/throwing emits).

### Task 2 — `SlideGroupMusicControl.vue`
Both `group-music-choose-vamp` affordances (the no-bed empty-state row and the uploaded-file action
cluster) are now `<button type="button">` elements reading `+ Add a vamp for this group` (ASCII
`+`), with the class string copied verbatim from the `group-music-add` label:
`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5
text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800`. The vamp-bed state's
`Change` button is untouched (`text-xs font-medium text-indigo-400 hover:text-indigo-300 shrink-0`).
The inline `<VampPicker v-if="vampPickerOpen && isEditor">` was replaced with an unconditionally
mounted `<VampPickerSlideOver :open="vampPickerOpen && isEditor" ...>`; `vampPickerOpen`,
`openVampPicker`, `closeVampPicker`, and `onVampSelected` are unchanged. The import swapped from
`VampPicker` to `VampPickerSlideOver`.

28 tests in the `260918-nm2, 260918-pms` describe block (up from 12) now cover: button tag/type/
text/class-identity in both no-bed and uploaded-bed states; `Change`'s unchanged small-action
styling; nothing renders inline before any click; opening via either button or `Change` mounts the
slide-over with the right vamp list/loading/pre-selection; select emits `attach-vamp` and closes it;
Cancel/backdrop/×/Escape all close with no emit; the viewer case now also asserts the slide-over is
absent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `wrapper.get(...).exists()` type errors + untyped `mountControl` props**
- **Found during:** Task 2's final `npm run type-check` gate (the per-task `npx vitest run` gate
  does not typecheck).
- **Issue:** `@vue/test-utils`'s `.get()` return type omits `exists` (it already throws if the
  element is absent, so calling `.exists()` on it is a type error, not a runtime bug) — three
  call sites in `SlideGroupMusicControl.test.ts` and one in `VampPickerSlideOver.test.ts` did this.
  Separately, `mountControl`'s `props: Record<string, unknown>` parameter didn't satisfy
  `SlideGroupMusicControl`'s prop types.
- **Fix:** Changed the three `.get(...).exists()` call sites to `.find(...).exists()` (or dropped
  the redundant assertion where a nearby `.get()` already proved existence), and typed
  `mountControl`'s parameter as `InstanceType<typeof SlideGroupMusicControl>['$props']`.
- **Files modified:** `src/components/__tests__/VampPickerSlideOver.test.ts`,
  `src/components/slides/__tests__/SlideGroupMusicControl.test.ts`.
- **Commit:** `a912e019` (bundled into the Task 2 GREEN commit, since it was discovered by that
  task's own plan-final type-check gate step). Note: this means the Task 2 GREEN commit touches
  `VampPickerSlideOver.test.ts` in addition to `SlideGroupMusicControl.vue` and its own test — a
  narrow, test-only, type-only fix with zero runtime/behavioral impact (already-passing vitest
  assertions unchanged).

No architectural changes, no scope-boundary fixes, no auth gates. The `fill` prop allowance for
`VampPicker.vue` (permitted but not required by the task brief) was not exercised — nothing in
this plan needed the picker list to grow to fill the slide-over body, and `VampPicker.vue` was
left completely untouched as design point 3 requires.

## Test Counts

- `src/components/__tests__/VampPickerSlideOver.test.ts`: 9 passed (new file)
- `src/components/slides/__tests__/SlideGroupMusicControl.test.ts`: 28 passed (12 pre-existing in
  the 260918-nm2 block updated/extended, 16 new; the untouched first describe block's 12 tests
  also still pass)
- `src/components/slides/__tests__/SlideGrid.test.ts`: 152 passed (regression, untouched)
- `src/components/__tests__/VampPicker.test.ts`: 10 passed (regression, proves VampPicker untouched)
- Combined gate run: 199 passed, 0 failed
- `npm run type-check` (vue-tsc --build): clean, 0 errors

## Commits

- `ee5e2cef` — test(260918-pms): failing tests — VampPickerSlideOver open/close/select pass-through
- `40ae6cf4` — feat(260918-pms): VampPickerSlideOver — slide-over shell hosting VampPicker
- `5cb3f4ee` — test(260918-pms): failing tests — "+ Add a vamp for this group" button + slide-over picker on the group music control
- `a912e019` — feat(260918-pms): group music control — real "+ Add a vamp for this group" button opening the vamp picker slide-over

## TDD Gate Compliance

Both tasks followed RED → GREEN: each `test(260918-pms): ...` commit precedes its corresponding
`feat(260918-pms): ...` commit, and the RED commits were confirmed failing (module-not-found for
Task 1; 7 failing / 21 passing against the pre-existing inline implementation for Task 2) before
the GREEN implementation was written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust
boundaries were introduced. The plan's `<threat_model>` (T-pms-01 elevation-of-privilege, T-pms-02
DoS via leaked keydown listener) is fully covered by the test suite: viewer-absence assertions in
both `VampPickerSlideOver.test.ts` (props-only, no isEditor concept) and
`SlideGroupMusicControl.test.ts` (`isEditor: false` hides the button/Change/slide-over), and the
Escape-listener add/remove-on-close/remove-on-unmount tests in `VampPickerSlideOver.test.ts`.

## Self-Check: PASSED

- FOUND: src/components/VampPickerSlideOver.vue
- FOUND: src/components/__tests__/VampPickerSlideOver.test.ts
- FOUND: src/components/slides/SlideGroupMusicControl.vue (modified)
- FOUND: src/components/slides/__tests__/SlideGroupMusicControl.test.ts (modified)
- FOUND: ee5e2cef
- FOUND: 40ae6cf4
- FOUND: 5cb3f4ee
- FOUND: a912e019

## Orchestrator addendum (2026-09-18)

The authorized optional `fill` prop was not applied by the executor; added by the orchestrator in two further TDD commits (test + feat): `VampPicker.fill` (default off — EditSlideDrawer unchanged) drops the `mt-2` card margin and the `max-h-56` list cap, and `VampPickerSlideOver` passes it so the list grows to the panel height. 236/236 across VampPicker, VampPickerSlideOver, SlideGroupMusicControl and EditSlideDrawer tests; `npm run type-check` clean.
