---
phase: 09-pc-song-import-tag-management
plan: "03"
subsystem: ui
tags: [vue, planning-center, firestore, soft-delete, import]

requires:
  - phase: 09-01
    provides: "Song.hidden field, restoreSong, upsertSongs store methods, deleteSong as soft-delete"
  - phase: 09-02
    provides: "fetchAndMapPcSongs utility returning UpsertSongInput[]"
provides:
  - "PcImportModal.vue: fetch-preview-confirm import flow replacing CsvImportModal"
  - "SongsView hidden songs panel with toggle and per-song Restore button"
  - "SongSlideOver Delete button wired to soft-delete via existing deleteSong store method"
affects: [songs-view, song-management, planning-center-integration]

tech-stack:
  added: []
  patterns:
    - "Multi-step modal state machine: idle | fetching | preview | importing | done | error"
    - "classifySongs lookup by pcSongId > ccliNumber > title (lowercase) for dedup"
    - "Hidden songs computed locally in SongsView from store.songs — not a store getter"

key-files:
  created:
    - src/components/PcImportModal.vue
  modified:
    - src/views/SongsView.vue
    - src/components/SongSlideOver.vue
    - src/components/SongTable.vue
    - src/stores/songs.ts
    - src/utils/pcSongImport.ts
    - src/utils/planningCenterApi.ts
    - src/components/AppSidebar.vue

key-decisions:
  - "CsvImportModal.vue and csvImport.ts left in place as dead code — not deleted to avoid breaking any existing tests"
  - "classifySongs triple-key dedup (pcSongId, ccliNumber, title) matches upsertSongs logic for consistent preview counts"
  - "Hidden songs toggle button hidden until at least one hidden song exists (v-if hiddenSongs.length > 0 || showHidden)"
  - "SongTable songs-change watch removed — it reset infinite scroll cursor after soft-delete causing songs to disappear"
  - "pcSongImport batch size reduced to 3 with Retry-After header support to avoid PC API rate limits"
  - "PREDEFINED_TAGS updated to Choir/Orchestra/Hymn replacing older values; column header renamed to Tags"

requirements-completed:
  - replace-csv-import
  - import-preview
  - soft-delete-ui
  - view-restore-hidden
  - no-pc-credentials-guard

duration: ~120min (multi-session including checkpoint verification)
completed: 2026-03-12
---

# Phase 09 Plan 03: PC Import UI and Soft-Delete Flow Summary

**PcImportModal with fetch-preview-confirm flow replacing CsvImportModal, plus hidden songs panel with per-song restore in SongsView — full Phase 9 feature set verified end-to-end against real Planning Center account.**

## Performance

- **Duration:** ~120 min (multi-session including human verification checkpoint)
- **Started:** 2026-03-11
- **Completed:** 2026-03-12
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 7

## Accomplishments

- PcImportModal replaces CsvImportModal: credentials guard, fetch spinner, preview counts (new vs update), confirm, done state with per-import summary
- Hidden songs panel in SongsView: inline toggle button shows count, panel lists hidden songs with strikethrough styling and Restore button per song
- Soft-delete fully wired: Delete in SongSlideOver calls store.deleteSong (now soft-delete via Plan 01), song disappears from list and survives reload
- Re-import idempotent: classifySongs triple-key dedup prevents duplicates on repeated imports
- Six post-checkpoint bug fixes committed (rate limiting, sidebar visibility, tag labels, infinite scroll)

## Task Commits

1. **Task 1: Build PcImportModal and replace CsvImportModal in SongsView** - `88e521a` (feat)
2. **Task 2: Hidden songs panel in SongsView + SongSlideOver restore support** - `33c07c4` (feat)
3. **Task 3: Checkpoint verification fixes** - `bab0bf4` (fix)

## Files Created/Modified

- `src/components/PcImportModal.vue` - New modal: idle/fetching/preview/importing/done/error states, classifySongs dedup
- `src/views/SongsView.vue` - PcImportModal wired, hiddenSongs computed, showHidden toggle, hidden songs panel
- `src/components/SongSlideOver.vue` - PREDEFINED_TAGS updated (Choir/Orchestra/Hymn), label renamed to Tags
- `src/components/SongTable.vue` - Removed songs-change watch that broke infinite scroll after soft-delete; column header renamed to Tags
- `src/stores/songs.ts` - Fixed hidden field handling (existing.hidden ?? false, destructured from spread)
- `src/utils/pcSongImport.ts` - Pagination proxy URL rewrite fix, tags?.data safe access, batch size 3, Retry-After support, hidden field from spread
- `src/utils/planningCenterApi.ts` - Retry-After header support, chord_chart_key field for arrangement key
- `src/components/AppSidebar.vue` - Fixed responsive visibility (max-lg:-translate-x-full)

## Decisions Made

- CsvImportModal.vue and csvImport.ts left as dead code — removing could break existing tests.
- classifySongs triple-key dedup mirrors upsertSongs logic to keep preview counts consistent with actual import behavior.
- Hidden songs toggle uses `v-if="hiddenSongs.length > 0 || showHidden"` so button disappears when all songs are restored.
- SongTable songs-change watch was resetting the infinite scroll cursor after every store change, causing the song list to vanish after soft-delete; removed.
- PC API batch size reduced from 10 to 3 with Retry-After handling to survive rate limit windows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SongTable infinite scroll broken after soft-delete**
- **Found during:** Task 3 verification (soft-delete test)
- **Issue:** songs-change watch in SongTable reset the Firestore cursor on every store mutation, causing the list to empty after any delete
- **Fix:** Removed the songs-change watch entirely
- **Files modified:** src/components/SongTable.vue
- **Committed in:** bab0bf4

**2. [Rule 1 - Bug] PC API pagination proxy URL rewrite and tags safe access**
- **Found during:** Task 3 verification (PC import test)
- **Issue:** Pagination next-page URL was not being rewritten through the proxy; tags?.data access could throw on songs without tags
- **Fix:** Added proxy URL rewrite for pagination links; changed to tags?.data safe access
- **Files modified:** src/utils/pcSongImport.ts
- **Committed in:** bab0bf4

**3. [Rule 1 - Bug] songs.ts hidden field lost during upsert spread**
- **Found during:** Task 3 verification
- **Issue:** hidden field was not preserved when destructuring the spread in upsertSongs
- **Fix:** Explicit `existing.hidden ?? false` with destructuring from spread
- **Files modified:** src/stores/songs.ts
- **Committed in:** bab0bf4

**4. [Rule 2 - Missing Critical] Retry-After header support for PC API rate limits**
- **Found during:** Task 3 verification (large library import)
- **Issue:** PC API returns 429 with Retry-After header; client was not honoring it
- **Fix:** Added Retry-After parsing and exponential backoff in planningCenterApi.ts and pcSongImport.ts
- **Files modified:** src/utils/planningCenterApi.ts, src/utils/pcSongImport.ts
- **Committed in:** bab0bf4

**5. [Rule 1 - Bug] AppSidebar responsive visibility**
- **Found during:** Task 3 verification (mobile layout)
- **Issue:** Sidebar was visible on mobile when it should be hidden
- **Fix:** Added max-lg:-translate-x-full class
- **Files modified:** src/components/AppSidebar.vue
- **Committed in:** bab0bf4

---

**Total deviations:** 5 auto-fixed (3 bugs, 1 missing critical, 1 bug/UX)
**Impact on plan:** All fixes necessary for correctness and real-world use. No scope creep.

## Issues Encountered

- PC API rate limiting surfaced only with a full song library import (100+ songs). The batch-size-3 + Retry-After solution proved stable during verification.

## User Setup Required

None - no additional external service configuration required. PC credentials were already configured in Phase 08.

## Next Phase Readiness

- Full Phase 9 PC song import and soft-delete feature set is live and verified.
- Tag management (PREDEFINED_TAGS) updated; further tag customization would require a new plan.
- No blockers for subsequent phases.

---
*Phase: 09-pc-song-import-tag-management*
*Completed: 2026-03-12*
