---
phase: 03-service-planning
plan: 03
subsystem: ui
tags: [vue, typescript, vitest, service-planning, song-suggestions, scripture, teleport]

# Dependency graph
requires:
  - phase: 03-01
    provides: rankSongsForSlot, esvLink, scripturesOverlap, SLOT_LABELS, BIBLE_BOOKS, ScriptureRef types
  - phase: 03-02
    provides: useServiceStore with assignSongToSlot, clearSongFromSlot, updateService
  - phase: 02-song-library
    provides: useSongStore with songs array, SongBadge component

provides:
  - ServiceEditorView full-page service editor at /services/:id with 9-slot template
  - SongSlotPicker dropdown with Teleport to body, suggestion algorithm integration, and search
  - ScriptureInput structured book/chapter/verse picker with ESV link and Psalms hint
  - ScriptureInput component tests (8 tests covering hint, ESV link, overlap warning)

affects: [03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Teleport to body pattern for dropdowns in overflow-y-auto containers (SongSlotPicker mirrors SongSlideOver)
    - getBoundingClientRect() + fixed positioning for Teleported dropdown placement
    - JSON.stringify deep equality for dirty detection on complex service objects
    - Local reactive copy pattern for explicit save flow (localService vs originalService)

key-files:
  created:
    - src/components/SongSlotPicker.vue
    - src/components/ScriptureInput.vue
    - src/components/__tests__/ScriptureInput.test.ts
  modified:
    - src/views/ServiceEditorView.vue

key-decisions:
  - "ServiceEditorView uses JSON.stringify comparison for isDirty detection — avoids deep watch complexity with nested slot arrays"
  - "SongSlotPicker uses Teleport to body with getBoundingClientRect() fixed positioning to escape AppShell overflow-y-auto stacking context (per RESEARCH.md Pitfall 4)"
  - "Transparent backdrop overlay (z-30) handles SongSlotPicker click-outside close — same pattern as SongSlideOver"
  - "Save flow separates assignSongToSlot calls (for lastUsedAt cross-store write) from updateService call (for non-song fields)"
  - "ScriptureInput showOverlapWarning prop guards overlap display — sermon passage input sets showOverlapWarning=false, reading slots set true"

patterns-established:
  - "Teleport dropdown pattern: trigger getBoundingClientRect() → set fixed top/left/width → Teleport to body with z-40"
  - "Local copy + explicit save pattern: ref<Service | null> localService, compare to originalService via JSON.stringify for isDirty"
  - "TDD for Vue components: vitest + @vue/test-utils mount pattern established in ScriptureInput.test.ts"

requirements-completed:
  - PLAN-07
  - SCRI-01
  - SCRI-02
  - SCRI-04

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 3 Plan 03: Service Editor View Summary

**ServiceEditorView full-page 9-slot editor with SongSlotPicker (Teleport dropdown + suggestion algorithm) and ScriptureInput (structured book/chapter/verse + ESV link + Psalms hint) with 8 passing component tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T10:57:33Z
- **Completed:** 2026-03-04T11:02:31Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 replaced placeholder)

## Accomplishments

- Built ServiceEditorView replacing placeholder — full 9-slot template rendering SONG/SCRIPTURE/PRAYER/MESSAGE kinds, team checkboxes, sermon passage input, dirty detection, and explicit Save flow
- Built SongSlotPicker with Teleport to body dropdown, top-5 suggestions from rankSongsForSlot(), search bar filtering by VW type and title, and song title/key/lastUsed/badge per suggestion row
- Built ScriptureInput with 66-book dropdown, chapter/verse inputs, conditional ESV.org link, always-visible Psalms hint text, and sermon passage overlap warning
- 8 ScriptureInput component tests pass; 188 total tests pass across all test files
- Production build succeeds: ServiceEditorView chunk 18.56 kB gzipped 6.21 kB

## Task Commits

Each task was committed atomically:

1. **Task 1: ServiceEditorView shell with 9-slot layout, team checkboxes, and save flow** - `37cb180` (feat)
2. **Task 2: SongSlotPicker dropdown with suggestions and search (Teleport to body)** - `2215fb2` (feat)
3. **Task 3: ScriptureInput component with tests (SCRI-04)** - `7e7f5e3` (feat)

## Files Created/Modified

- `src/views/ServiceEditorView.vue` - Full-page editor at /services/:id with 9-slot template, team checkboxes, sermon passage input, isDirty detection, explicit Save button, loading/not-found states
- `src/components/SongSlotPicker.vue` - In-slot dropdown with Teleport to body, top-5 suggestion rows (title/key/lastUsed/badge), search bar filtering by VW type, transparent backdrop close
- `src/components/ScriptureInput.vue` - Structured book/chapter/verse picker with BIBLE_BOOKS select, ESV link when complete, Psalms hint always visible, overlap warning when showOverlapWarning=true
- `src/components/__tests__/ScriptureInput.test.ts` - 8 component tests: book options, hint text, ESV link, overlap warning with showOverlapWarning flag

## Decisions Made

- ServiceEditorView uses `JSON.stringify` for `isDirty` computed — handles nested slot arrays without deep watchers; negligible perf for single-service objects
- SongSlotPicker Teleport to body with `getBoundingClientRect()` — mirrors SongSlideOver pattern per RESEARCH.md Pitfall 4 (AppShell overflow clips absolute dropdowns)
- Save flow calls `assignSongToSlot()` for changed song slots first (triggers lastUsedAt cross-store write), then `updateService()` for all other fields
- `showOverlapWarning=false` on the Sermon Passage ScriptureInput — sermon passage itself cannot overlap with itself; only reading slots should warn

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ServiceEditorView is the complete primary planning interface — users can now build full service orders
- Plan 04 (ServicesView list page) is already complete (committed earlier in session)
- SongSlotPicker and ScriptureInput are reusable components available for any future service-planning views
- All 188 tests pass; production build clean

---
*Phase: 03-service-planning*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/components/SongSlotPicker.vue
- FOUND: src/components/ScriptureInput.vue
- FOUND: src/components/__tests__/ScriptureInput.test.ts
- FOUND: .planning/phases/03-service-planning/03-03-SUMMARY.md
- FOUND commit: 37cb180 (Task 1)
- FOUND commit: 2215fb2 (Task 2)
- FOUND commit: 7e7f5e3 (Task 3)
