---
phase: 116-lyric-editor-song-ux
plan: 01
subsystem: ui
tags: [vue, vitest, vue-router, songselect, ccli]

# Dependency graph
requires:
  - phase: 115-live-output-readability-layout
    provides: nothing this plan reuses directly — independent of the live-output/monitor work
provides:
  - "A read-only SONG-group badge that names the song and opens the lyric editor in a new tab"
  - "A SongSelect deep-link in the song editor header, gated on the persisted CCLI number"
  - "A relabeled 'Close' header dismiss button (was 'Cancel')"
affects: [116-02-lyric-editor-song-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New-tab navigation from a resolved route: router.resolve(location).href passed to window.open(href, '_blank', 'noopener') — avoids router.push when the current tab's place must be preserved."

key-files:
  created: []
  modified:
    - src/components/slides/SlideGrid.vue
    - src/components/slides/SlidesTab.vue
    - src/components/SongSlideOver.vue
    - src/components/slides/__tests__/SlideGrid.test.ts
    - src/components/slides/__tests__/SlidesTab.test.ts
    - src/components/__tests__/SongSlideOver.test.ts

key-decisions:
  - "songEditLabel computed in SlideGrid.vue reads songTitle only when selectedSlot.kind === 'SONG', mirroring the existing songGroupSongId computed — keeps the T-33-24/T-116-01 property that the emitted navigation target is sourced only from the slot, never the DOM event."
  - "SongSelect link is gated on props.song?.ccliNumber (the persisted Details-tab field SongTable.vue already links on), not form.ccliNumber or the paste-derived copyright.ccliSongNumber, per the plan's explicit instruction."
  - "The 3-dot menu's edit-in-song (SlidesTab onMenuAction) was left untouched — only the read-only badge's handler (onEditInSongBadge) was changed to open a new tab; the menu path is out of R333's scope."

patterns-established:
  - "Pattern: reusing an existing CCLI link-out (SongTable.vue) verbatim in a second surface (SongSlideOver.vue header) rather than extracting a shared component, since the plan asked for the exact same href/target/rel and this is the second (not yet third) usage site."

requirements-completed: [R333, R334, R335]

coverage:
  - id: D1
    description: "Read-only SlideGrid song-group badge reads 'Edit song lyrics for {song name}' (fallback 'Edit song lyrics' when no title), and clicking it opens the lyric editor deep-link in a new browser tab (window.open with noopener) instead of navigating the current tab away."
    requirement: "R333"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#the actionable badge text is \"Edit song lyrics for {title}\" when the slot carries a songTitle"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#the actionable badge text falls back to \"Edit song lyrics\" when songTitle is null"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts#badge: SlideGrid's edit-in-song emit opens the lyrics deep-link in a new noopener tab, not router.push"
        status: pass
    human_judgment: false
  - id: D2
    description: "Song editor header shows a SongSelect link next to the song name (https://songselect.ccli.com/songs/{ccliNumber}, target=_blank, rel=noopener) when the song has a non-empty persisted ccliNumber; hidden when empty or in create mode; visible on both Details and Lyrics tabs."
    requirement: "R334"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#shows a SongSelect link to the persisted ccliNumber, opening in a new noopener tab"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#hides the SongSelect link when ccliNumber is empty"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#hides the SongSelect link in create mode (no song)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#keeps the SongSelect link visible on the Lyrics tab too — it lives in the shared header"
        status: pass
    human_judgment: false
  - id: D3
    description: "Song editor header dismiss button reads 'Close' (was 'Cancel'), with unchanged onCancel unsaved-changes-guard + emit('close') behavior; delete-confirm/paste Cancel buttons untouched."
    requirement: "R335"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#the header no longer shows a \"Cancel\" button, and \"Close\" emits close"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-04
status: complete
---

# Phase 116 Plan 01: Read-Only Badge Retarget + Song Editor Header Summary

**Read-only slide-viewer badge now names the song and opens the lyric editor in a new tab (leaving the viewer in place); the song editor header gained a SongSelect deep link and its dismiss button now reads "Close" instead of "Cancel".**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments
- R333: SlideGrid's read-only SONG-group badge now reads "Edit song lyrics for {song name}" (fallback "Edit song lyrics"), and SlidesTab's `onEditInSongBadge` opens the resolved lyrics deep-link in a new tab (`window.open(href, '_blank', 'noopener')`) instead of `router.push`, so a planner reading the slideshow doesn't lose their place. The 3-dot menu's in-app `edit-in-song` navigation is untouched.
- R334: SongSlideOver's header now shows a `SongSelect` link (reusing SongTable.vue's exact `https://songselect.ccli.com/songs/{ccliNumber}` pattern, `target="_blank"`, `rel="noopener"`) next to the song title, gated on the persisted `Song.ccliNumber`, visible on both Details and Lyrics tabs.
- R335: SongSlideOver's header dismiss button text changed from "Cancel" to "Close"; the `onCancel` unsaved-changes guard and `emit('close')` behavior are unchanged, and no other Cancel button (delete-confirm, remove-section, paste region) was touched.

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation) TDD, each half committed atomically:

1. **Task 1: R333 badge label + new-tab open**
   - `3692ea20` test(116-01): failing tests for R333 badge label + new-tab edit-in-song
   - `275df645` feat(116-01): R333 badge names the song + opens lyric editor in a new tab
2. **Task 2: R334 SongSelect link + R335 Close relabel**
   - `7f6a426b` test(116-01): failing tests for SongSelect header link + Close relabel
   - `d850ad6a` feat(116-01): R334 SongSelect header link + R335 relabel Cancel to Close

**Plan metadata:** (this commit) docs(116-01): complete plan

## Files Created/Modified
- `src/components/slides/SlideGrid.vue` - new `songEditLabel` computed; badge button/span text + button `aria-label` now bound to it.
- `src/components/slides/SlidesTab.vue` - `onEditInSongBadge` resolves the lyrics deep-link and opens it in a new noopener tab instead of `router.push`.
- `src/components/SongSlideOver.vue` - header gained a SongSelect anchor next to the title; dismiss button text "Cancel" -> "Close".
- `src/components/slides/__tests__/SlideGrid.test.ts` - badge label/aria-label coverage for titled and untitled SONG slots.
- `src/components/slides/__tests__/SlidesTab.test.ts` - router mock extended with `resolve`; badge handler test now asserts `window.open` (not `router.push`).
- `src/components/__tests__/SongSlideOver.test.ts` - SongSelect link presence/absence/tab-persistence and "Close" relabel + emit coverage.

## Decisions Made
- `songEditLabel` reads `songTitle` only for `selectedSlot.kind === 'SONG'`, matching the existing `songGroupSongId` computed's pattern (T-116-01: navigation target is sourced only from the slot, never the DOM click event).
- SongSelect link gated on `props.song?.ccliNumber` (persisted Details field), not `form.ccliNumber` or `copyright.ccliSongNumber`, per plan instruction — matches SongTable.vue's own gate.
- Left `onMenuAction`'s `edit-in-song` case (3-dot menu) untouched — only the read-only badge path changed to open a new tab, as scoped by R333.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

116-02-PLAN.md (R336 manual credits editing, R337 hide History) is unblocked and independent of this plan's changes — no shared state or component surface conflicts expected (this plan touched SlideGrid/SlidesTab/SongSlideOver's header; 116-02 targets SongLyricEditor.vue's copyright block and History toggle/panel).

## Self-Check: PASSED

All 7 files and 4 task commit hashes verified present on disk / in git log.

---
*Phase: 116-lyric-editor-song-ux*
*Completed: 2026-09-04*
