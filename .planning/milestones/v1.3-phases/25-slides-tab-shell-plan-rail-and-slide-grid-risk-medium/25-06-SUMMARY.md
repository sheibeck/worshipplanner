---
phase: 25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium
plan: 06
subsystem: slides-tab
tags: [vue, slide-group, group-bed, audio, useMediaUpload, slideGroups-store, ui-spec]

requires:
  - phase: 25-05
    provides: "SlideGrid.vue's write-control pattern (add-slide, drag-reorder) and ensureGroupMaterialized, extended here with a third scoped write path"
provides:
  - "SlideGroupMusicControl.vue — emit-only attach/preview/remove control for a slide group's audio bed, audio-only per D-14/D-18"
  - "SlideGrid.vue mounts the control between the grid header and the card grid and intercepts both events, writing through the slideGroups store's setGroupBedMedia"
  - "serviceId threaded from SlidesTab.vue down to SlideGrid.vue (new prop), needed for setGroupBedMedia's skeleton-create payload"
affects: [SlidesTab, 25-07]

tech-stack:
  added: []
  patterns:
    - "The bed-media write path needs NO on-demand materialization step, unlike every slide-appending path in this phase — setGroupBedMedia's own merging skeleton-create (WR-01, Phase 24) already covers a plan item with no group document yet, so SlideGrid's attach/remove handlers call the store directly"
    - "bedAudioLabel (already shared with the rail's own bed-music line, 25-03) is reused verbatim by the new control rather than re-deriving a filename-from-URL parser a second time"
    - "A chromeless AudioPlayer plus a single custom icon-only preview button (carrying the UI-SPEC's exact aria-label) replaces native <audio controls> — native controls cannot carry a custom accessible name, so the icon-only convention wins over reusing the player's own built-in controls"

key-files:
  created:
    - src/components/slides/SlideGroupMusicControl.vue
    - src/components/slides/__tests__/SlideGroupMusicControl.test.ts
  modified:
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts
    - src/components/slides/SlidesTab.vue

decisions:
  - "SlideGroupMusicControl emits two distinct events (attach: [url], remove: []) rather than SlotMediaAttachment's single v-model-style update:audioUrl — the plan's read_first explicitly calls these 'its two events', and the grid's two handlers map cleanly onto them without an undefined-vs-value branch."
  - "The displayed filename is derived from the stored bedAudioUrl via the existing bedAudioLabel helper (introduced in 25-03 for the rail's own bed-music line) rather than a second URL parser — same decode/last-segment/fallback-to-generic-label logic, single source of truth."
  - "Preview is a chromeless AudioPlayer plus a custom icon-only button with a static aria-label ('Preview group music') rather than the analog's native <audio controls> — native controls have no way to carry the UI-SPEC's required accessible name, so the control mounts its own button and drives play()/pause() imperatively via the player's exposed methods."
  - "No on-demand materialization call added to the grid's two new handlers — setGroupBedMedia's existing merging skeleton-create (Phase 24 WR-01) already handles a plan item with no group document yet, and adding a second materialize call here would only reintroduce the exact race that merging write exists to prevent."
  - "serviceId added as a new required SlideGrid prop (threaded from SlidesTab, which already had it) — setGroupBedMedia's skeleton-create payload needs it and no existing SlideGrid prop carried it."

metrics:
  duration: ~50min
  completed: 2026-07-26
status: complete
---

# Phase 25 Plan 06: Group Music Control Summary

Gave a slide group its own audio bed from the Slides tab: `SlideGroupMusicControl.vue` (modelled on `SlotMediaAttachment.vue`, audio-only per D-14/D-18) attaches, previews, and removes the group's music, and `SlideGrid.vue` mounts it above the card grid and writes both events straight through `useSlideGroups().setGroupBedMedia` — no new save path, no on-demand materialization step, and no legacy slot-level fallback.

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `SlideGroupMusicControl.vue` — emit-only control with two states: an empty-state add affordance (`＋ Add music for this group`, UI-SPEC Mockup Correction 7) and a populated state showing the derived filename, a `plays across all N slides` scope line, an icon-only preview button, and an icon-only remove button
- A failed upload reproduces `SlotMediaAttachment.vue`'s deliberate no-emit contract exactly — the composable's own error text renders, and neither `attach` nor `remove` ever fires, so an existing attachment can never be cleared by a failed upload
- Both icon-only controls carry the UI-SPEC's exact accessible names (`Preview group music`, `Remove group music`); the add affordance and remove control are gated on the editor flag while the preview control and player remain available to a viewer
- `SlideGrid.vue` mounts the control between the header and the card grid, feeding it the selected group's `bedAudioUrl` and the same filtered slide count the grid already computes, and intercepts both events to call `setGroupBedMedia` with the selected slot id — an explicit `clearAudio: true` on removal, never an undefined URL
- Verified end-to-end: the write path needs no `ensureGroupMaterialized` call (the store's own merging skeleton-create already covers an unmaterialized group), the service store's `updateService` is never touched by either path, and a rejected write is caught and logged without throwing

## Task Commits

1. **Task 1: SlideGroupMusicControl — attach, preview, remove a group audio bed** - `183d1e0` (feat)
2. **Task 2: Mount the music control in the grid and persist the bed** - `0590d10` (feat)

## Files Created/Modified

- `src/components/slides/SlideGroupMusicControl.vue` - new emit-only group-bed audio control (audio-only, two states, editor-gated add/remove)
- `src/components/slides/__tests__/SlideGroupMusicControl.test.ts` - 11 tests covering both states, filename derivation/fallback, upload success/failure/progress, remove, accessible names, and viewer gating
- `src/components/slides/SlideGrid.vue` - mounts `SlideGroupMusicControl` between the header and the card grid; new `serviceId` prop; `onAttachGroupMusic`/`onRemoveGroupMusic` handlers calling `setGroupBedMedia` directly
- `src/components/slides/__tests__/SlideGrid.test.ts` - added a `setGroupBedMedia` store mock, a `services` store mock (to prove it's never called), and 7 new tests for the music-bar mount/write path
- `src/components/slides/SlidesTab.vue` - threads its existing `serviceId` prop down to `SlideGrid`

## Decisions Made

See frontmatter `decisions` — key ones: two distinct emit events over a v-model-style single event, reusing `bedAudioLabel` rather than a second URL parser, a chromeless player plus a custom accessible preview button (native `<audio controls>` cannot carry a custom aria-label), no redundant materialization call on the bed-write path, and the new `serviceId` prop threaded down from `SlidesTab`.

## Deviations from Plan

None — the plan executed as written for both tasks, including its explicit prohibitions (audio-only, no video-bed affordance; no confirmation dialog on remove; no new upload-progress/error copy; no duplicated upload logic; `SlotMediaAttachment.vue` and `storage.rules` untouched).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The bed-media write path this plan proves (scoped store write, explicit clear flag, no materialization needed) is exactly the persistence path 25-07's drop-target routing needs for its audio-drop branch.
- `git diff --stat src/components/SlotMediaAttachment.vue storage.rules` confirmed empty — that control and the storage rules are untouched, as required.
- Manual-only verifications (attach `docs/example.mp3`, reload, confirm the name/scope persist and audio plays; Present-mode continuous bed playback) are deferred to the project's batch human-verify per `25-VALIDATION.md`, not a blocking checkpoint here.

---
*Phase: 25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium*
*Completed: 2026-07-26*

## Self-Check: PASSED

- FOUND: `src/components/slides/SlideGroupMusicControl.vue`
- FOUND: `src/components/slides/__tests__/SlideGroupMusicControl.test.ts`
- FOUND: `src/components/slides/SlideGrid.vue` (modified — music control mount, serviceId prop, attach/remove handlers)
- FOUND: `src/components/slides/__tests__/SlideGrid.test.ts` (modified — group music bar describe block)
- FOUND: `src/components/slides/SlidesTab.vue` (modified — serviceId threaded to SlideGrid)
- FOUND commit `183d1e0` (Task 1 — SlideGroupMusicControl)
- FOUND commit `0590d10` (Task 2 — mount + persist)
