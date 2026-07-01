---
phase: 11-song-catalog-service-planner-improvements
plan: "04"
subsystem: service-planner-song-picker
tags: [picker, type-agnostic, load-more, intersection-observer, tag-filter, pills, ai-suggestions]
dependency_graph:
  requires:
    - 11-01 (Song.tags field, TeamTagPill variant prop)
  provides:
    - type-agnostic picker ranking (D-09, D-10)
    - IntersectionObserver load-more batching in picker (D-12)
    - themes/user-tag pills on picker rows (D-06)
    - include/exclude tag filter in picker header (D-03 picker side)
    - broadened AI Picks prompt (D-11)
  affects:
    - src/components/SongSlotPicker.vue
    - src/utils/suggestions.ts
    - src/utils/__tests__/suggestions.test.ts
    - src/utils/claudeApi.ts
tech_stack:
  added: []
  patterns:
    - IntersectionObserver sentinel at scroll container bottom (mirrors SongTable.vue)
    - visibleCount slice applied to both rotation and search lists
    - tagFilteredSongs computed as base for ranking and search (picker-local, not store-global)
    - TeamTagPill variant prop (team/theme/user) for distinct pill colors
key_files:
  created: []
  modified:
    - src/components/SongSlotPicker.vue
    - src/utils/suggestions.ts
    - src/utils/__tests__/suggestions.test.ts
    - src/utils/claudeApi.ts
decisions:
  - "typeBonus (+100) removed outright from rankSongsForSlot — simplest per PATTERNS discretion (D-10)"
  - "VW type secondary sort in searchResults removed (replaced by return 0 for non-orchestra paths)"
  - "Tasks 2 and 3 committed as a single atomic commit — both modify only SongSlotPicker.vue and are tightly coupled"
  - "tagFilteredSongs is picker-local (not reusing store global filterTagInclude/Exclude) per intentional design in plan (D-03)"
  - "Sentinel re-observed in openDropdown nextTick because the dropdown is teleported and only in DOM when isOpen"
metrics:
  duration_minutes: 20
  completed_date: "2026-07-01"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 11 Plan 04: Picker Type-Agnostic, Load-More, Pills, Tag Filter Summary

**One-liner:** Made the service-plan song picker type-agnostic (removed typeBonus ranking), added IntersectionObserver load-more batching (BATCH_SIZE 50) for full-catalog browsing, rendered theme and user-tag pills on every row, added include/exclude tag filter selects in the picker header, and broadened the AI Picks prompt to suggest across the whole catalog.

## Tasks Completed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Remove type-match ranking and neutralize typeBonus (D-09, D-10, D-11) | feaf302 | Done |
| 2 | IntersectionObserver load-more batching for full-catalog browsing (D-12) | 282c02d | Done |
| 3 | Themes/user-tag pills (D-06) + include/exclude tag filter (D-03) in picker | 282c02d | Done |

## What Was Built

### Task 1 — Remove typeBonus, neutralize VW-type influence (D-09, D-10, D-11)

**suggestions.ts:**
- Deleted the `typeBonus` line (`song.vwTypes.includes(requiredVwType) ? 100 : 0`) from `rankSongsForSlot`
- The `requiredVwType` parameter is kept for API compatibility but noted as non-scoring in the JSDoc
- `orchestraBonus` (+200) is the only score modifier beyond the rotation/recency base scores
- Score comment block updated: never-used = 500 (no longer 600), 3-weeks-ago = 245 (no longer 345)

**suggestions.test.ts:**
- Rewrote the "VW type prioritization" describe block to "VW type (type-agnostic, D-10)"
- Removed all assertions of 600 scores (were 500+typeBonus); now assert 500
- Added `type-matching and non-matching songs score EQUALLY` assertion
- Added `uncategorized songs score the same as type-matching songs` assertion
- Updated score values: 1-week → 60 (was 160), 3-weeks → 245 (was 345)
- Updated sorting describe: "matching-type ranks above non-matching" → "songs of different VW types score equally"

**SongSlotPicker.vue (D-10 search re-sort):**
- Removed the secondary `bMatch - aMatch` VW-type sort from `searchResults` computed
- Replaced with `return 0` (orchestra path still applies for non-orchestra comparison)

**claudeApi.ts (D-11):**
- Rewrote `SONG_SYSTEM_PROMPT`: changed "strongly prefer songs matching the required VW type" to "suggest broadly across the whole catalog — the slot's VW type is provided as context only"
- Changed user message label from `Required VW Type:` to `Slot VW Type (advisory context only):`

### Tasks 2 + 3 — IntersectionObserver batching, pills, tag filter (D-12, D-06, D-03)

**SongSlotPicker.vue (complete rewrite of script + template):**

**Load-more batching (D-12):**
- `const BATCH_SIZE = 50`, `const visibleCount = ref(BATCH_SIZE)`
- `visibleSuggestions` = `suggestions.value.slice(0, visibleCount.value)`
- `visibleSearchResults` = `searchResults.value.slice(0, visibleCount.value)`
- `totalVisible` computed against whichever list is active (rotation or search)
- `hasMore` = `visibleCount < totalVisible`
- `loadMore()` increments by BATCH_SIZE (mirrors SongTable.vue)
- `watch(searchQuery/includeTag/excludeTag/props.songs)` each reset `visibleCount` to BATCH_SIZE
- `onMounted`: creates `IntersectionObserver` with `rootMargin: '200px'` observing `sentinelRef`; calls `loadMore()` when `hasMore`
- `onUnmounted`: `observer?.disconnect()`
- Sentinel `<div ref="sentinelRef" class="h-1" />` placed at bottom of dropdown
- "Showing X of Y — scroll for more" footer added

**Tag filter (D-03 picker side):**
- `includeTag` and `excludeTag` refs (both default `''`)
- `availableTags` computed: distinct tags across all `props.songs`, sorted
- `tagFilteredSongs` computed: filters `props.songs` by include/exclude; used as base for `rankSongsForSlot` and `searchResults`
- Two `<select>` controls in sticky header below the search input: "Show all tags" / "Only: {tag}" and "Hide no tags" / "Hide: {tag}"
- Picker-local by design — independent of store's global `filterTagInclude`/`filterTagExclude` (prevents picker filter from altering catalog view)

**Pills (D-06):**
- Both rotation rows and search rows now render three distinct pill types:
  - `<TeamTagPill variant="team" />` for `song.teamTags` (gray, existing)
  - `<TeamTagPill variant="theme" />` for `song.themes` (teal, PC-imported themes)
  - `<TeamTagPill variant="user" />` for `song.tags` (pink, user-defined tags)
- The `v-if="teamTags.length > 0"` guard removed — the flex container is always rendered; empty arrays produce no pills

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. Tasks 2 and 3 were implemented together in a single SongSlotPicker.vue rewrite (both touch only that file and are logically interdependent); committed as one atomic commit rather than two.

## Verification

All criteria met:

- `npx vitest run src/utils/__tests__/suggestions.test.ts` — 28 tests passed
- `npx vue-tsc --noEmit -p tsconfig.app.json` — no errors
- `grep` confirms:
  - No `slice(0, 15)` in `SongSlotPicker.vue`
  - `IntersectionObserver`, `visibleCount`, `sentinelRef`, `loadMore` present
  - `variant="theme"` and `variant="user"` in both rotation and search row templates
  - `includeTag`, `excludeTag`, `tagFilteredSongs` present and wired
  - VW-type re-sort (`bMatch - aMatch`) absent from `searchResults`
  - `typeBonus` absent from `suggestions.ts`

## Human Verification Needed

The final checkpoint (Task 4) is deferred for human UAT. The following items must be manually verified in the running app (`npm run dev`):

### 1. Full-catalog browsing via scroll (D-12)

**How to test:** Open a service in the editor, open the song picker on any slot.

**Expected behavior:**
- The rotation list ("By Rotation") loads the first 50 songs and continues loading in batches of 50 as you scroll down
- You can scroll past the initial 50 and reach songs deep in the catalog (not capped at ~15)
- A "Showing X of Y" footer is visible at the bottom of the list; it updates as more songs load
- Type a broad search term (e.g., "the") and confirm search results also load beyond 50 by scrolling

### 2. Type-agnostic list — any song pickable for any slot (D-09, D-10)

**How to test:** Open a slot typed as VW Type 1. Scroll the rotation list.

**Expected behavior:**
- Songs of Type 2, Type 3, and uncategorized songs appear in the list
- Type 2 and Type 3 songs are NOT pushed to the bottom — they appear in rotation/recency order alongside Type 1 songs
- The VW-type badge (blue/purple/amber) is visible on each row as information only
- Type 1 songs do NOT appear above other types purely because of their type match

### 3. Themes and user-tag pills on picker rows (D-06)

**How to test:** Open the picker on any slot. Find a song that has themes (PC-imported) and/or user tags.

**Expected behavior:**
- Team tags appear as gray pills
- Themes appear as teal pills (distinct from gray team tags)
- User tags appear as pink pills (distinct from both)
- Songs without themes or tags show no extra pills (no visual clutter)

### 4. Include/exclude tag filter in picker header (D-03)

**How to test:** Open the picker. Use the "Show only tag" select to choose "Christmas" (or any tag present in your library).

**Expected behavior:**
- Only songs with that tag appear in the rotation list and search results
- The "Hide tag" select with "Christmas" causes those songs to disappear
- Changing the filter resets the visible count (scroll back to top behavior)
- Picker filter is independent of any tag filter set on the main song catalog page

### 5. AI Picks — broad suggestions, no hidden songs (D-11)

**How to test:** Open a slot with sermon context set. Trigger AI Picks.

**Expected behavior:**
- AI suggestions span different VW types (not restricted to the slot's type)
- No hidden/soft-deleted songs appear in AI suggestions
- The reason text reflects thematic connection to the sermon, not type matching

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-11-11: XSS in pill render | Mitigated — all tag/theme/tag values rendered via `{{ tag }}` prop (Vue auto-escaped); no `v-html` in the picker |
| T-11-12: Hidden song disclosure via AI | Accepted — hidden-song exclusion enforced caller-side (Plan 11-02 D-18); broadened prompt does not add fields |
| T-11-13: IntersectionObserver DoS | Accepted — BATCH_SIZE 50 + observer disconnect on unmount mirrors proven SongTable pattern |

## Self-Check: PASSED

Files exist:
- `src/components/SongSlotPicker.vue` — FOUND (IntersectionObserver, visibleCount, sentinelRef, includeTag, excludeTag, variant="theme", variant="user")
- `src/utils/suggestions.ts` — FOUND (typeBonus removed, orchestraBonus only)
- `src/utils/__tests__/suggestions.test.ts` — FOUND (equal-score assertions, 500 base scores)
- `src/utils/claudeApi.ts` — FOUND (advisory-only slotVwType label)

Commits exist:
- feaf302 — FOUND (Task 1: remove type-match ranking bonus)
- 282c02d — FOUND (Tasks 2+3: IntersectionObserver batching, pills, tag filter)
