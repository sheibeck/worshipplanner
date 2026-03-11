# Phase 9: PC Song Import & Tag Management - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning
**Source:** PRD Express Path (inline user requirements)

<domain>
## Phase Boundary

Replace the existing CSV song import with a Planning Center API-based import. Songs are fetched from PC with their tags, arrangement metadata, categories, and last scheduled dates. Songs can be soft-deleted (hidden) in WorshipPlanner without affecting PC. Re-importing picks up new songs while keeping hidden songs hidden. Add custom tag management for songs within WorshipPlanner.

</domain>

<decisions>
## Implementation Decisions

### Import Source
- Replace CSV import with Planning Center API import (using existing PC API client from Phase 8)
- Import should fetch all songs from the connected PC service type
- Re-running import picks up any new songs added in PC since last import
- Songs already imported (match by CCLI or PC song ID) should be skipped/updated, not duplicated

### Tag Import
- Import tags from PC songs
- Songs with an arrangement titled "Orchestra" should be auto-tagged with an "Orchestra" tag — these are songs with orchestration available, used when planning Orchestra Sundays

### Category-to-Type Mapping
- PC "Category 1" maps to VW Type 1 on import
- PC "Category 2" maps to VW Type 2 on import
- PC "Category 3" maps to VW Type 3 on import

### Last Scheduled → Last Used
- PC "Last Scheduled" date maps to `lastUsedAt` field on import

### Soft Delete (Hide/Unhide)
- Deleting a song from WorshipPlanner should NOT truly delete it — just hide it
- Hidden songs must NOT appear in the song list
- Hidden songs must NOT be used for LLM/AI service planning
- There must be a way to view hidden/deleted songs and undelete (unhide) them
- Re-importing from PC must keep previously hidden songs as hidden
- This allows pruning the song list without making changes in Planning Center

### Tag Management
- WorshipPlanner should have its own tag management for songs
- Users can add/remove/manage custom tags on songs independently of PC
- Existing `teamTags` system should be extended or complemented

### Claude's Discretion
- Whether to add a `pcSongId` field to Song for matching during re-import (vs CCLI-only matching)
- How to implement the "hidden" flag (new boolean field vs status enum)
- UI placement of the "view hidden songs" toggle/page
- Whether import replaces the CSV modal or adds a new "Import from PC" option alongside it
- Batch size and error handling for large PC song libraries
- Whether to show import progress/preview before committing

</decisions>

<specifics>
## Specific Ideas

- "Orchestra" arrangement title detection should be case-insensitive
- The import flow should leverage the existing PC API credentials from Phase 8 settings
- Consider showing a preview of songs to import (like the existing CSV preview) before committing
- Hidden songs filter should also exclude from the AI suggestion algorithm (Phase 6)
- Tag management could use the existing `teamTags` field or add a new dedicated tags system

</specifics>

<deferred>
## Deferred Ideas

- Bi-directional sync (pushing WorshipPlanner changes back to PC)
- Automatic scheduled re-import (cron-style)
- Import from other sources beyond PC

</deferred>

---

*Phase: 09-pc-song-import-tag-management*
*Context gathered: 2026-03-11 via PRD Express Path*
