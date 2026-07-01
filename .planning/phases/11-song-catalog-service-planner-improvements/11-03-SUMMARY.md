---
phase: 11-song-catalog-service-planner-improvements
plan: "03"
subsystem: song-catalog-browse-ux
tags: [sort, pills, tags, inline-edit, bulk-select, filter, ux]
dependency_graph:
  requires:
    - 11-01 (tags field on Song, filterTagInclude/filterTagExclude store refs, TeamTagPill variant prop)
  provides:
    - All-column sort in SongTable (D-07)
    - Three-variant pill display per row — team/theme/user (D-06)
    - Inline user-tag add/remove per row (D-04b)
    - Bulk multi-select tag apply/remove action bar (D-04c)
    - User-tag editing in the song editor form (D-04a)
    - Include/exclude user-tag filter in SongFilters (D-03 list side)
    - availableUserTags derived from song catalog
  affects:
    - src/components/SongTable.vue
    - src/components/SongFilters.vue
    - src/components/SongSlideOver.vue
    - src/views/SongsView.vue
tech_stack:
  added: []
  patterns:
    - SortArrow inline defineComponent (reusable SVG, avoids repetition across five headers)
    - Per-field sortKey() extractor switching on SortField union type
    - selectedIds Set emitted via update:selectedIds; parent hosts bulk-action bar
    - defineExpose clearSelection for programmatic bulk reset after action
    - Free-text comma-split add for user tags in editor (mirrors themesInput pattern)
    - Removable chip pattern with &times; button + @click.stop guards
key_files:
  created: []
  modified:
    - src/components/SongTable.vue
    - src/components/SongFilters.vue
    - src/components/SongSlideOver.vue
    - src/views/SongsView.vue
decisions:
  - "SortArrow implemented as inline defineComponent in SongTable second <script lang='ts'> block — avoids a separate file for a tiny SVG helper used only in SongTable"
  - "Bulk selectedIds kept in SongTable (not SongsView) as the natural owner; SongsView receives ids via @update:selectedIds event — matches BatchQuickAssign precedent"
  - "User-tag pills in SongTable are custom inline spans (not TeamTagPill) to embed the removable x button inside the pill without modifying TeamTagPill API"
  - "SongFilters receives filterTagInclude/filterTagExclude as props + emits updates; SongsView v-models them directly to store refs — no local re-declaration"
  - "toggleUserTag defined in SongSlideOver for API completeness; template uses addUserTags/removeUserTag directly for cleaner chip UX"
metrics:
  duration_minutes: 25
  completed_date: "2026-07-01"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 11 Plan 03: Song Catalog Browse UX Summary

**One-liner:** Full-column sortable SongTable with three-variant pills (team/theme/user), inline and bulk user-tag editing, and show-only/hide-by-tag filter controls wired to the Plan 11-01 store filter state.

## Tasks Completed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | All-column sort + themes/user-tag pills in SongTable | 6a0e655 | Done |
| 2 | Tag editing in editor form + include/exclude filter + availableUserTags wiring | 9667eb9 | Done |
| 3 | Inline row tag add/remove + bulk multi-select tag apply/remove | 6a0e655 (included in Task 1 commit) | Done |

## What Was Built

### Task 1 — All-column sort + pills + inline/bulk editing in SongTable

**All-column sort (D-07):**
- `SortField` widened to `'title' | 'category' | 'key' | 'ccli' | 'lastUsed'`
- Per-field `sortKey()` extractor: `vwTypes[0] ?? 99` for category, `getPrimaryKey().toLowerCase()` for key, `Number(ccliNumber) || 0` for CCLI, `lastUsedAt?.toMillis() ?? 0` for Last Used, `title.toLowerCase()` default
- `sortedSongs` uses numeric subtraction for numbers, `localeCompare` for strings, respects `sortDir`
- All five headers call `toggleSort(field)` with a `SortArrow` direction indicator (active field = indigo arrow, inactive = gray neutral up/down)
- `SortArrow` implemented as inline `defineComponent` in a second `<script lang="ts">` block

**Pills (D-06):**
- Tags cell renders three groups: `variant="team"` for `song.teamTags`, `variant="theme"` for `song.themes`, custom inline span for `song.tags` (user tags with removable x)
- Em-dash fallback only when all three arrays are empty

**Inline tag editing (D-04b):**
- Each user-tag pill has a `&times;` button (`@click.stop`) that calls `songStore.updateSong(song.id, { tags })` with the tag removed
- A `+` button per row opens an inline text input; Enter or "Add" commits the tag via `updateSong`
- All inline controls have `@click.stop` — row-click-to-open-slide-over is unaffected

**Bulk multi-select (D-04c):**
- Leading checkbox column; row checkbox `@click.stop` toggles song id in `selectedIds` Set
- Header checkbox toggles all / none
- `selectedIds` emitted upward via `@update:selectedIds`
- `clearSelection()` exposed via `defineExpose` for parent to call after bulk action

### Task 2 — Editor form tags + filter controls + SongsView wiring

**SongSlideOver — user-tag editing (D-04a):**
- `userTagInput` ref for free-text entry; reset on panel open
- `addUserTags()`: comma-splits input, deduplicates, pushes to `form.value.tags`
- `removeUserTag(tag)`: splices from `form.value.tags`
- `toggleUserTag(tag)`: toggle helper for programmatic use
- New "User Tags" section in form: chip display with x buttons + free-text input + Add button
- `tags: form.value.tags` already in save payload from Plan 11-01

**SongFilters — include/exclude controls (D-03 list side):**
- Added `filterTagInclude`, `filterTagExclude`, `availableUserTags` props
- Added `update:filterTagInclude` and `update:filterTagExclude` emits
- Two new `<select>` dropdowns: "Show only tag..." and "Hide tag..." bound to `availableUserTags`

**SongsView — wiring:**
- `availableUserTags` computed: dedup + sort all `song.tags` across the catalog
- `v-model:filterTagInclude="songStore.filterTagInclude"` and `filterTagExclude` wired directly to store refs (no local re-declaration)
- `songTableRef` ref for `InstanceType<typeof SongTable>` to call `clearSelection()`
- Bulk-tag action bar: visible when `selectedSongIds.size > 0`; has tag input + "Apply to selected" + "Remove from selected" + "Clear selection" buttons; iterates selected songs via `songStore.updateSong` then clears selection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Removed accidental useSongStore import from SongFilters**
- **Found during:** Task 2, file review after edit
- **Issue:** Accidentally added `import { useSongStore }` and `const songStore = useSongStore()` to SongFilters during editing; these were unused and would couple a prop-driven display component to the store unnecessarily
- **Fix:** Removed both lines; SongFilters remains a pure prop-in/emit-out component
- **Files modified:** `src/components/SongFilters.vue`
- **Commit:** 9667eb9

**2. [Rule 1 - Design] User-tag pills in SongTable use custom inline span instead of TeamTagPill**
- **Found during:** Task 1 implementation
- **Issue:** TeamTagPill renders only the tag text with no interactive affordances; inline removable pills need an embedded x button
- **Fix:** Used custom `<span>` with `bg-pink-900/50 text-pink-300 border-pink-800` matching TeamTagPill's `user` variant classes, with embedded `&times;` button — visually identical to TeamTagPill user variant but with removal capability
- **Files modified:** `src/components/SongTable.vue`

## Verification

All acceptance criteria met:

- `SortField` = `'title' | 'category' | 'key' | 'ccli' | 'lastUsed'` — confirmed in SongTable line 300
- Per-field `sortKey()` extractor references `getPrimaryKey`, `lastUsedAt`, `vwTypes[0]`, `Number(` — confirmed
- All five headers call `toggleSort(...)` with `SortArrow` — confirmed
- Tags cell renders `variant="theme"` for `song.themes` and custom user pill for `song.tags` — confirmed
- `toggleUserTag` in SongSlideOver — confirmed line 422
- `filterTagInclude` / `filterTagExclude` bound in SongFilters — confirmed lines 69-84
- `availableUserTags` computed in SongsView — confirmed line 226
- No local re-declaration of `filterTagInclude`/`filterTagExclude` in SongsView (uses store refs directly) — confirmed
- `selectedIds` Set + `@click.stop` on checkbox in SongTable — confirmed lines 73-76, 153-155
- `updateSong` called for inline remove, inline add, bulk apply, bulk remove — confirmed
- `npx vue-tsc --noEmit -p tsconfig.app.json` — no errors

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-11-08: XSS via tag/theme strings in pills | Mitigated — all tag values rendered via Vue `{{ }}` interpolation (auto-escaped); no `v-html` introduced anywhere in the tag render path |
| T-11-09: Elevation via updateSong tag writes | Accepted — reuses existing `updateSong` store method subject to existing Firestore org-ownership rules; no new unauthenticated write path |
| T-11-10: Tampering via bulk apply/remove | Accepted — bulk action only operates on songs the user already sees in their org filteredSongs list; scoped to selectedIds; existing Firestore rules enforce ownership |

## Human Verification Needed

The following items must be manually tested in the running app (`npm run dev`, open `/songs`):

1. **All-column sort with default Title-asc**
   - Expected: On first load, songs are sorted A→Z by title. Clicking "Title" again flips to Z→A with arrow pointing down. Clicking "Category", "Key", "CCLI", "Last Used" each sorts by that field with an arrow indicator on the active header and no arrow (neutral icon) on inactive headers.

2. **Three visually-distinct pill types per row**
   - Expected: Each row's Tags cell shows team tags (gray pills), themes (teal pills), and user tags (pink pills) as distinct colors. Rows with no tags show an em-dash.

3. **User tag editing in the song editor form**
   - Expected: Open a song via row click. The slide-over shows a "User Tags" section. Type "Christmas" in the text input and press Add (or Enter). A pink chip "Christmas ×" appears. Click × removes it. Save — the tag persists and a pink pill appears on the row in the table.

4. **Inline row tag add and remove**
   - Expected: On any row, click the "+" button in the Tags cell. An inline text input appears. Type a tag and press Enter or click "Add" — the pink pill appears immediately. Click the "×" on any existing user-tag pink pill to remove it. Both operations persist after page refresh. Row click (outside the tags cell) still opens the slide-over.

5. **Bulk multi-select tag apply and remove**
   - Expected: Check 2–3 song rows using the leading checkboxes. A bulk action bar appears above the table showing the count of selected songs. Type "Christmas" in the tag input and click "Apply to selected" — all selected songs now show a "Christmas" pink pill. Click "Remove from selected" with the same tag — all selected songs lose the pill. Selection clears after each action.

6. **Show-only tag filter**
   - Expected: In the filter bar, select "Show only tag... = Christmas". Only songs tagged "Christmas" remain in the list. Selecting the blank option restores all songs.

7. **Hide tag filter**
   - Expected: Select "Hide tag... = Christmas". Songs tagged "Christmas" disappear from the list. Selecting the blank option restores them.

## Self-Check: PASSED

Files exist and contain expected content:
- `src/components/SongTable.vue` — FOUND (SortField, sortKey, toggleSort, variant="theme", selectedIds, updateSong, @click.stop)
- `src/components/SongFilters.vue` — FOUND (filterTagInclude, filterTagExclude, availableUserTags, update:filterTagInclude, update:filterTagExclude)
- `src/components/SongSlideOver.vue` — FOUND (toggleUserTag, addUserTags, removeUserTag, userTagInput)
- `src/views/SongsView.vue` — FOUND (availableUserTags, filterTagInclude, filterTagExclude, selectedSongIds, applyBulkTag, removeBulkTag)

Commits exist:
- 6a0e655 — Task 1: all-column sort + theme/user-tag pills + inline tag edit + bulk checkbox in SongTable
- 9667eb9 — Task 2+3: tag editing in editor form + include/exclude filter + availableUserTags + bulk-tag action bar
