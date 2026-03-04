---
phase: 02-song-library
plan: 02
subsystem: ui
tags: [vue3, pinia, firestore, tailwind, typescript, teleport, transitions]

# Dependency graph
requires:
  - phase: 02-song-library
    plan: 01
    provides: Song/Arrangement TypeScript interfaces, useSongStore with addSong/updateSong/deleteSong, SongsView with placeholder handlers, SongTable emitting select/add events

provides:
  - SongSlideOver component with Teleport-to-body, slide animation, create/edit/delete modes, VW type selector, arrangement accordion, explicit Save/Cancel
  - ArrangementAccordion component for inline arrangement editing (key, BPM, length, chord URL, notes, team tags)
  - BatchQuickAssign component for rapid VW type categorization of uncategorized songs
  - SongsView wired with slide-over, selectedSong ref, and Batch Assign button
  - GettingStarted step 2 reactive to songStore.songs.length > 0
  - DashboardView subscribes to songs on mount for cross-view GettingStarted accuracy

affects:
  - 02-song-library plan 03 (CSV import) — slide-over can be used post-import to edit imported songs
  - 03-service-planning — slide-over pattern established for other entity panels

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Teleport to body for panels that must escape stacking context (z-index correctness)
    - Static Tailwind class maps in VW type buttons to prevent v4 purge of dynamic color classes
    - Local reactive form copy in slide-over — deep clone on open, write to store on Save only (no auto-save)
    - crypto.randomUUID() for client-side arrangement ID generation before Firestore write
    - Guard pattern in DashboardView: if (songStore.orgId) return — prevents double-subscription
    - computed() steps array in GettingStarted for reactive step completion checking

key-files:
  created:
    - src/components/SongSlideOver.vue
    - src/components/ArrangementAccordion.vue
    - src/components/BatchQuickAssign.vue
  modified:
    - src/views/SongsView.vue
    - src/views/DashboardView.vue
    - src/components/GettingStarted.vue

key-decisions:
  - "SongSlideOver uses Teleport to body so the panel escapes AppShell's overflow-y-auto stacking context — required for correct z-index layering"
  - "Song-level teamTags computed as union of explicit song tags + all arrangement teamTags on Save — denormalized for filter queries"
  - "DashboardView subscribes to songs on mount with guard (if orgId already set, skip) — enables GettingStarted step 2 to be accurate whether user lands on dashboard or songs first"
  - "BatchQuickAssign uses currentIndex ref rather than splicing the prop array — Firestore onSnapshot removes assigned songs from uncategorized list reactively"

patterns-established:
  - "Slide-over pattern: Teleport to body + Vue Transition + fixed right panel + semi-transparent backdrop — reusable for service/team entity panels"
  - "Local form copy: songToForm() on open, emitUpdate() to parent, store write only on explicit Save — prevents accidental auto-save"

requirements-completed: [SONG-02, SONG-04, SONG-05]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 2 Plan 02: Song Detail Slide-Over and Batch Quick-Assign Summary

**Right-side slide-over panel (Teleport to body, Vue Transition) for song create/edit/delete with inline arrangement accordion, per-song VW type selector, batch quick-assign mode for uncategorized songs, and reactive GettingStarted step 2**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T03:43:35Z
- **Completed:** 2026-03-04T03:48:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- SongSlideOver and ArrangementAccordion components deliver the full song editing experience: create/edit/delete with confirmation, VW type selector, arrangement sections with key/BPM/length/chord chart/notes/team tags, and explicit Save/Cancel (no auto-save)
- BatchQuickAssign component enables rapid post-import categorization with large 1/2/3 buttons, progress bar, skip functionality, and all-done state
- GettingStarted step 2 reactive via computed array reading songStore.songs.length — DashboardView subscribes on mount with double-subscription guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Build SongSlideOver with arrangements and ArrangementAccordion** - `236d062` (feat)
2. **Task 2: Wire slide-over to SongsView, add BatchQuickAssign, update GettingStarted** - `72e867c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/SongSlideOver.vue` - Right-panel slide-over (Teleport to body, Transition, create/edit/delete, VW type, team tags, arrangements)
- `src/components/ArrangementAccordion.vue` - Collapsible arrangement editor with key select, BPM, length mm:ss display, chord URL, notes, team tag toggles
- `src/components/BatchQuickAssign.vue` - Focused mode: uncategorized song card with type-1/2/3 buttons, progress bar, skip, all-done state
- `src/views/SongsView.vue` - selectedSong + slideOverOpen refs wired, Batch Assign button when uncategorized > 0, SongSlideOver and BatchQuickAssign imported
- `src/views/DashboardView.vue` - Subscribes to songs on mount (with orgId guard) so GettingStarted reflects real song count
- `src/components/GettingStarted.vue` - steps changed from static array to computed; step 2 done = songStore.songs.length > 0

## Decisions Made
- SongSlideOver uses `<Teleport to="body">` to escape AppShell's overflow-y-auto stacking context — required for correct z-index rendering per plan's explicit requirement
- Song-level teamTags on Save computed as union of explicitly toggled song tags plus all arrangement teamTags — denormalizes for filter query correctness
- DashboardView subscribes to songs with `if (songStore.orgId) return` guard — prevents double-subscription if user navigated to /songs first
- BatchQuickAssign advances via currentIndex ref; Firestore onSnapshot removes assigned songs reactively from the `uncategorizedSongs` computed prop

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 (CSV import) can use the slide-over immediately post-import to edit any imported song
- The Teleport + Vue Transition slide-over pattern is established for future entity panels (services, teams)
- GettingStarted step 3 (Plan your first service) remains `done: false` — Phase 3 will make it reactive

## Self-Check: PASSED

All 6 expected files exist. Both task commits (236d062, 72e867c) confirmed in git log.

---
*Phase: 02-song-library*
*Completed: 2026-03-04*
