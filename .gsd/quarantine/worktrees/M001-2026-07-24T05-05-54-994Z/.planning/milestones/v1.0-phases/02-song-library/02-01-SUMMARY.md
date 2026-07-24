---
phase: 02-song-library
plan: 01
subsystem: ui
tags: [vue3, pinia, firestore, tailwind, vitest, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Vue 3 + Firebase foundation, auth store (useAuthStore), AppShell component, router with auth guard, Firestore rules covering organizations/{orgId}/songs

provides:
  - Song and Arrangement TypeScript interfaces (src/types/song.ts)
  - useSongStore Pinia store with onSnapshot subscription, CRUD actions, importSongs batch, and filteredSongs computed
  - /songs route registered with requiresAuth guard
  - SongsView page with AppShell wrapper and orgId-safe Firestore subscription
  - SongTable component with sortable columns, empty state, loading state
  - SongFilters component with search bar and VW type / key / tag dropdowns
  - SongBadge component with static color-coded VW type badges (blue/purple/amber)
  - TeamTagPill component for team tag display

affects:
  - 02-song-library plan 02 (slide-over panel consumes Song types and useSongStore)
  - 02-song-library plan 03 (CSV import writes via importSongs action)
  - 03-service-planning (song snapshots use Song interface)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useSongStore follows auth.ts Pinia setup composition pattern with onSnapshot directly (no VueFire)
    - filteredSongs computed uses AND-combined client-side filter (appropriate for 50-500 song libraries)
    - SongBadge uses static class lookup object to prevent Tailwind v4 purge of dynamic VW type classes
    - importSongs chunks writeBatch at 499 ops to stay under Firestore 500-op hard limit
    - SongsView resolves orgId from user document on mount before calling subscribe()

key-files:
  created:
    - src/types/song.ts
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts
    - src/components/SongBadge.vue
    - src/components/TeamTagPill.vue
    - src/components/SongFilters.vue
    - src/components/SongTable.vue
    - src/views/SongsView.vue
    - src/components/__tests__/SongBadge.test.ts
  modified:
    - src/router/index.ts

key-decisions:
  - "filteredSongs computed lives in the Pinia store (not the view component) — keeps filter state centralized for Plan 02 slide-over and Plan 03 import to share"
  - "filterVwType accepts 1 | 2 | 3 | 'uncategorized' | null — 'uncategorized' is a distinct string value rather than a sentinel number to avoid ambiguity with VWType integers"
  - "availableKeys and availableTags are derived computeds in SongsView from the live songs array — no separate Firestore query needed"
  - "SongsView uses onMounted + async initStore() rather than watchEffect — avoids re-subscribing if auth user object reference changes for non-orgId reasons"

patterns-established:
  - "Static class lookup for Tailwind v4 dynamic styling: const classes = { 1: 'bg-blue-900/50...', 2: '...' } as const — prevents purge"
  - "orgId resolved from users/{uid} document on mount before calling store.subscribe(orgId)"
  - "Placeholder console.log handlers for inter-plan events (song select, add, import) — wired up in Plan 02 and 03"

requirements-completed: [SONG-03, SONG-05, SONG-06]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 2 Plan 01: Song Library Data Layer and Browse UI Summary

**Pinia song store with Firestore onSnapshot subscription, CRUD + batched import, AND-combined client-side filtering, and a full browsable /songs page with sortable table, color-coded VW type badges, team tag pills, and empty state**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T03:36:24Z
- **Completed:** 2026-03-04T03:40:52Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Song and Arrangement TypeScript interfaces aligned exactly with Firestore data model from RESEARCH.md
- useSongStore with onSnapshot subscription, CRUD actions (addSong/updateSong/deleteSong), importSongs with 499-op batch chunking, and filteredSongs computed covering all four filter dimensions (search + vwType + key + tag) with AND logic — 25 tests passing
- Full /songs page: SongsView wrapping AppShell, SongFilters with search + three filter dropdowns, SongTable with sortable columns and empty state import/add CTAs, SongBadge with static color-coded VW type badges, TeamTagPill for team tag display — 8 SongBadge tests passing, type check clean, build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Song types, Pinia store, tests, route** - `208d025` (feat)
2. **Task 2: SongsView, SongTable, SongFilters, SongBadge, TeamTagPill** - `767b779` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 1 followed TDD — tests written first (RED: import fails), then store implemented (GREEN: 25 tests pass)_

## Files Created/Modified
- `src/types/song.ts` - Song, Arrangement, VWType TypeScript interfaces
- `src/stores/songs.ts` - useSongStore: onSnapshot, CRUD, importSongs (499-chunk), filteredSongs computed
- `src/stores/__tests__/songs.test.ts` - 25 unit tests: subscribe/snapshot, search, vwType/key/tag filters, AND-combined, CRUD, batch chunking
- `src/router/index.ts` - Added /songs route with requiresAuth guard
- `src/components/SongBadge.vue` - VW type color-coded badge with static class map (blue/purple/amber/gray-muted)
- `src/components/TeamTagPill.vue` - Small dark pill for team tag display
- `src/components/SongFilters.vue` - Search bar + VW type / key / team tag filter dropdowns with v-model bindings
- `src/components/SongTable.vue` - Sortable table with SongBadge + TeamTagPill columns, loading spinner, empty state
- `src/views/SongsView.vue` - Songs page: AppShell wrapper, orgId-safe subscription, header with Add/Import buttons, filter + table wiring
- `src/components/__tests__/SongBadge.test.ts` - 8 tests: all VW types (1/2/3/null) render correct text and CSS classes

## Decisions Made
- filteredSongs computed lives in the Pinia store (not the view component) to keep filter state centralized for Plan 02 (slide-over) and Plan 03 (CSV import) to share without prop drilling
- filterVwType uses 1 | 2 | 3 | 'uncategorized' | null — 'uncategorized' as a distinct string value avoids ambiguity with VWType integer literals
- availableKeys and availableTags are derived computeds in SongsView from the live songs array — no extra Firestore query
- SongsView uses onMounted + async initStore() rather than watchEffect to avoid re-subscribing if auth user object reference changes for non-orgId reasons

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (SongSlideOver) can import useSongStore directly — filteredSongs, addSong, updateSong, deleteSong all ready
- Plan 03 (CSV import) can import useSongStore and call importSongs(songs[]) — batch chunking and orgId already handled
- GettingStarted.vue in Dashboard can be updated to use songStore.songs.length > 0 for the "Import song library" step completion check (noted in RESEARCH.md)

## Self-Check: PASSED

All 11 expected files found. Both task commits (208d025, 767b779) confirmed in git log.

---
*Phase: 02-song-library*
*Completed: 2026-03-04*
