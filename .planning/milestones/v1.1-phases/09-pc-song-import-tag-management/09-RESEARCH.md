# Phase 9: PC Song Import & Tag Management - Research

## PC API Endpoints Needed

### Fetching Songs from PC
The PC Services API provides song listing at the **organization level** (not per service type):
- `GET /songs?per_page=100&offset={n}` — paginated list of all songs in the PC org
- Each song has attributes: `title`, `ccli_number`, `author`, `created_at`, `updated_at`, `last_scheduled_at`
- Songs also have `admin` and `themes` attributes
- **Pagination**: PC uses `per_page` + `offset` or `links.next` for pagination. Max 100 per page.

### Fetching Song Tags
- `GET /songs/{id}/tags` — returns tags for a song
- Each tag has `attributes.name`
- Tags in PC are organization-wide labels applied to songs

### Fetching Song Arrangements
Already implemented: `fetchSongArrangements(appId, secret, pcSongId)` in `planningCenterApi.ts`
- Returns `{id, name}[]`
- Need to check arrangement name for "Orchestra" (case-insensitive)

### Song Categories (Folder-based)
PC uses "Song folders" for categorization, not inline `Category 1/2/3` fields. However, looking at the CSV export format, "Category 1/2/3" are folder assignments visible in the export. In the API:
- Categories may map to folder assignments or custom fields
- The simplest approach: fetch tags and use tag names like "Category 1", "Category 2", "Category 3" for VW type mapping
- Alternative: If categories are actually PC song folders, we'd use `GET /tag_groups` and `GET /songs/{id}/tags`

**Decision needed**: How PC exposes Category 1/2/3. Most likely these are tag-based, so checking tag names during import.

## Existing Codebase Analysis

### Song Interface (src/types/song.ts)
```typescript
interface Song {
  id: string                    // Firestore doc ID
  title: string
  ccliNumber: string
  author: string
  themes: string[]
  notes: string
  vwType: VWType | null         // 1 | 2 | 3 | null
  teamTags: string[]
  arrangements: Arrangement[]
  lastUsedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**New fields needed:**
- `pcSongId: string | null` — PC song ID for matching during re-import
- `hidden: boolean` — soft-delete flag (default false)

### Song Store (src/stores/songs.ts)
- `deleteSong(id)` — currently calls `deleteDoc` (true delete). Must change to soft-delete.
- `filteredSongs` — computed that filters by search, vwType, key, tag. Must also exclude `hidden === true`.
- `importSongs(songsData)` — batch creates new docs. Needs upsert logic (match by ccliNumber or pcSongId, update if exists, add if new).

### CSV Import (src/utils/csvImport.ts + CsvImportModal.vue)
- Currently the only import path
- Will be replaced by PC API import
- CsvImportModal.vue can be repurposed or replaced with PcImportModal.vue
- Keep CSV import available as fallback? User said "replace" — remove CSV path

### AI Suggestions
- `rankSongsForSlot()` in `suggestions.ts` takes `songs: Song[]` as input — whatever is passed in
- `claudeApi.ts` builds song library for AI from songs passed in
- Both consume `songs` array from store — if `filteredSongs` excludes hidden, AI won't see them

### SongSlideOver.vue
- Line 405: `await songStore.deleteSong(props.song.id)` — needs to call soft-delete instead
- Should add "Restore" action for hidden songs view

### SongsView.vue
- Main song library page
- Will need "Show hidden songs" toggle or separate view
- Import button currently opens CsvImportModal — will switch to PC import

## Implementation Architecture

### 1. Data Model Changes
Add to Song interface:
```typescript
pcSongId: string | null    // Planning Center song ID (for re-import matching)
hidden: boolean             // true = soft-deleted, excluded from lists and AI
```

Existing songs in Firestore won't have these fields. Handle with defaults:
- `pcSongId` → null (not imported from PC yet)
- `hidden` → false (existing songs are visible)

Firestore doesn't require schema migration — just handle missing fields in code.

### 2. Import Flow
1. User clicks "Import from Planning Center" in SongsView
2. Fetch all songs from PC API (paginated)
3. For each PC song:
   a. Fetch tags
   b. Fetch arrangements
   c. Map to Song shape:
      - `pcSongId` = PC song ID
      - `ccliNumber` from PC
      - `title` from PC
      - `author` from PC
      - `lastUsedAt` from `last_scheduled_at`
      - `vwType` from Category 1/2/3 tags
      - `teamTags` from PC tags + "Orchestra" if arrangement named "Orchestra"
      - `arrangements` from PC arrangements
4. Match against existing songs:
   - Primary: match by `pcSongId` (if previously imported)
   - Secondary: match by `ccliNumber`
   - Tertiary: match by title (case-insensitive)
5. For matches: update metadata fields (don't overwrite user-set vwType if already set? Or always overwrite?)
   - Update: pcSongId, author, lastUsedAt, arrangements, themes/tags from PC
   - Preserve: hidden status, user-added teamTags
   - VW type: only set if currently null (don't overwrite user's manual categorization)
6. For new songs: create new Firestore doc
7. Never delete existing songs

### 3. Soft Delete
- Change `deleteSong()` to set `hidden: true` instead of `deleteDoc`
- Add `restoreSong(id)` that sets `hidden: false`
- `filteredSongs` adds `!song.hidden` check
- Hidden songs view: separate computed or toggle that shows only hidden songs

### 4. Tag Management
Existing `teamTags` field is already used. Options:
- Extend existing: tags managed on SongSlideOver already
- Add tag management page/modal for bulk operations
- Import PC tags into `teamTags`
- Keep PC-imported tags vs user-added tags? Probably just merge into one list.

### 5. API Rate Limiting
PC API rate limits: 100 requests per 20 seconds.
For a library of 200 songs, fetching songs + tags + arrangements = ~600 requests.
Need batching/throttling or use `?include=tags,arrangements` to reduce calls.

**Key optimization**: `GET /songs?include=tags,arrangements&per_page=100` — PC JSON:API supports sideloading related resources.

## Validation Architecture

### Testable Boundaries
1. **PC API fetch functions** — unit test with mocked fetch
2. **Song mapping logic** — pure function: PC song → Song shape
3. **Upsert matching logic** — pure function: given PC songs + existing songs, return {toCreate, toUpdate}
4. **Soft delete** — store method changes
5. **Filter exclusion** — computed property test

### Integration Points
1. PC API → Import utility → Song store → Firestore
2. Song store filteredSongs → SongsView, AI suggestions
3. SongSlideOver delete → soft-delete → hidden flag

## Risk Areas
1. **PC API pagination** — must handle libraries with 500+ songs
2. **Rate limiting** — use `include` parameter to minimize API calls
3. **Matching accuracy** — CCLI numbers may be missing; title matching is fuzzy
4. **Field conflicts on update** — what to preserve vs overwrite during re-import
5. **Existing Firestore docs missing new fields** — handle gracefully with defaults

## RESEARCH COMPLETE
