---
phase: quick-8
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/utils/suggestions.ts
  - src/utils/__tests__/suggestions.test.ts
  - src/components/SongSlotPicker.vue
autonomous: true
requirements: [QUICK-8]

must_haves:
  truths:
    - "SongSlotPicker suggestions show ALL songs, not just those matching the slot VW type"
    - "Songs matching the slot VW type appear first (prioritized), other types and uncategorized below"
    - "Search results include all songs regardless of VW type, with VW type badge visible"
    - "Songs with null vwType (uncategorized) appear in both suggestions and search results"
  artifacts:
    - path: "src/utils/suggestions.ts"
      provides: "rankSongsForSlot with soft priority instead of hard VW type filter"
      contains: "typeBonus"
    - path: "src/components/SongSlotPicker.vue"
      provides: "SongSlotPicker with unfiltered search results"
    - path: "src/utils/__tests__/suggestions.test.ts"
      provides: "Updated tests reflecting priority sort instead of hard filter"
  key_links:
    - from: "src/components/SongSlotPicker.vue"
      to: "src/utils/suggestions.ts"
      via: "rankSongsForSlot import"
      pattern: "rankSongsForSlot"
---

<objective>
Change SongSlotPicker to show ALL songs regardless of VW type, with matching-type songs prioritized at the top. Currently, both the suggestion engine (rankSongsForSlot) and the search results hard-filter to only the slot's required VW type. Replace the hard filter with a soft priority sort so users can pick any song for any slot.

Purpose: Users need to see their full song library when picking songs, not just type-matched ones. The VW type becomes a priority signal, not a gate.
Output: Updated suggestions.ts, SongSlotPicker.vue, and suggestions.test.ts
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/utils/suggestions.ts
@src/utils/__tests__/suggestions.test.ts
@src/components/SongSlotPicker.vue
@src/components/SongBadge.vue
@src/types/song.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/types/song.ts:
```typescript
export type VWType = 1 | 2 | 3

export interface Song {
  id: string
  title: string
  ccliNumber: string
  author: string
  themes: string[]
  notes: string
  vwType: VWType | null
  teamTags: string[]
  arrangements: Arrangement[]
  lastUsedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

From src/utils/suggestions.ts:
```typescript
export interface SuggestionResult {
  song: Song
  score: number
  weeksAgo: number | null
  isRecent: boolean
}

export function rankSongsForSlot(
  songs: Song[],
  requiredVwType: VWType,
  serviceTeams: string[],
  nowMs?: number,
): SuggestionResult[]
```

From src/components/SongBadge.vue:
```typescript
// Already handles VWType | null — renders "Type 1/2/3" badge or em-dash for null
defineProps<{ type: VWType | null }>()
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace hard VW type filter with priority scoring in rankSongsForSlot</name>
  <files>src/utils/suggestions.ts, src/utils/__tests__/suggestions.test.ts</files>
  <behavior>
    - Test: songs of ALL VW types are returned (not filtered out), including null vwType
    - Test: songs matching requiredVwType get a typeBonus of +100 to their score
    - Test: songs NOT matching requiredVwType (different type or null) get NO typeBonus (score +0)
    - Test: with mixed types, matching-type songs rank above non-matching given equal recency
    - Test: team filtering (AND logic) still applies as before — team filter is NOT removed
    - Test: never-used songs still get base score 500 (plus typeBonus if matching)
    - Test: existing scoring logic (recency, staleness) unchanged except for added typeBonus
    - Test: null vwType songs appear in results (previously filtered out)
  </behavior>
  <action>
In src/utils/suggestions.ts:

1. Remove the hard VW type filter on line 31 (`const eligible = songs.filter((s) => s.vwType === requiredVwType)`). Instead, pass ALL songs directly to team filtering.

2. In the scoring section (the `.map()` block), add a type-match bonus AFTER the existing score calculation:
   - If `song.vwType === requiredVwType`, add +100 to the score (typeBonus)
   - If `song.vwType !== requiredVwType` (including null), add +0

   This ensures matching-type songs are prioritized but non-matching songs still appear. The bonus of +100 means a matching never-used song (500+100=600) outranks a non-matching never-used song (500+0=500), and a matching stale song (~200-500 + 100) generally outranks a non-matching stale song (~200-500 + 0).

3. Keep the team filtering logic unchanged — it should now operate on the full song list instead of only type-filtered songs.

In src/utils/__tests__/suggestions.test.ts:

4. Update the "VW type filtering" describe block — rename to "VW type prioritization":
   - Remove the test "returns empty array when no songs match required VW type" — this is no longer true (they return all team-compatible songs)
   - Remove the test "only returns songs matching the required VW type" — replace with a test that ALL songs are returned but matching-type songs rank higher
   - Remove the test "filters songs with null vwType out of results" — replace with a test that null vwType songs ARE included but ranked lower
   - Add test: "songs matching requiredVwType score +100 higher than equivalent non-matching songs"
   - Add test: "null vwType songs appear in results with no typeBonus"
   - Add test: "with mixed VW types, matching type sorts first given equal recency"

5. Update scoring tests: adjust expected scores to account for typeBonus (+100 for matching type). For example, a never-used matching song now scores 600 (500+100), not 500. Update the score assertions accordingly where the test songs match the required type.

6. Keep team filtering tests — they should still pass (AND logic unchanged). Songs now include non-matching types but team filtering operates the same way.

IMPORTANT: Do NOT change the SuggestionResult interface. Do NOT change the function signature. The only changes are removing the hard filter and adding the typeBonus in scoring.
  </action>
  <verify>
    <automated>npx vitest run src/utils/__tests__/suggestions.test.ts</automated>
  </verify>
  <done>rankSongsForSlot returns all team-compatible songs regardless of VW type, with matching-type songs scoring +100 higher. All tests pass reflecting new priority-sort behavior.</done>
</task>

<task type="auto">
  <name>Task 2: Remove hard VW type filter from SongSlotPicker search results</name>
  <files>src/components/SongSlotPicker.vue</files>
  <action>
In src/components/SongSlotPicker.vue, modify the `searchResults` computed (currently line 149-155):

Current code:
```typescript
const searchResults = computed<Song[]>(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value.toLowerCase()
  return props.songs
    .filter((s) => s.vwType === props.requiredVwType)
    .filter((s) => s.title.toLowerCase().includes(q))
})
```

Change to remove the `.filter((s) => s.vwType === props.requiredVwType)` line. Instead, sort search results so that songs matching `props.requiredVwType` appear first:

```typescript
const searchResults = computed<Song[]>(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value.toLowerCase()
  return props.songs
    .filter((s) => s.title.toLowerCase().includes(q))
    .sort((a, b) => {
      const aMatch = a.vwType === props.requiredVwType ? 1 : 0
      const bMatch = b.vwType === props.requiredVwType ? 1 : 0
      return bMatch - aMatch
    })
})
```

Also update the empty state message in the suggestions section (line 79-85). Currently it says "No songs with this category." which implies type filtering. Change to a more appropriate message since suggestions now include all songs. Replace the text:
- Change "No songs with this category." to "No songs in your library."
- Keep the "Add songs to your library first." and router-link to /songs as-is.

The SongBadge is already rendered next to every song in both suggestions and search results (lines 74 and 103), so no template changes needed for badge display.
  </action>
  <verify>
    <automated>npx vitest run src/views/__tests__/ServiceEditorView.test.ts</automated>
  </verify>
  <done>SongSlotPicker search shows all songs matching the query regardless of VW type, with matching-type songs sorted first. Empty state message updated. VW type badge already visible next to each song.</done>
</task>

</tasks>

<verification>
1. `npx vitest run src/utils/__tests__/suggestions.test.ts` — all suggestion tests pass with new priority behavior
2. `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — ServiceEditorView tests still pass
3. `npx vitest run` — full test suite green, no regressions
4. Manual: open a service, click a Type 1 song slot picker — should see Type 1 songs first, then Type 2, Type 3, and uncategorized songs below with their badges
5. Manual: search for a song that has a different VW type than the slot — it should appear in results with its badge
</verification>

<success_criteria>
- Song slot picker suggestions include songs of all VW types and uncategorized songs
- Matching VW type songs are prioritized (appear first) in both suggestions and search
- Search results are not filtered by VW type, only by title query
- VW type badge is displayed next to every song (already implemented, just verifying)
- All existing tests updated and passing, no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/8-song-picker-shows-all-songs-with-type-pr/8-SUMMARY.md`
</output>
