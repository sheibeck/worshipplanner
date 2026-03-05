---
phase: quick-20
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/SongTable.vue
autonomous: true
requirements: [QUICK-20]

must_haves:
  truths:
    - "Song table initially renders only 50 rows, not all 200+"
    - "Scrolling near the bottom of the table loads the next batch of 50 rows"
    - "When search or filters change, visible count resets to 50 and list starts from top"
    - "All sorting still works correctly on the full visible set"
    - "A count indicator shows how many songs are displayed vs total filtered"
  artifacts:
    - path: "src/components/SongTable.vue"
      provides: "Progressive rendering with scroll-based load-more"
      contains: "visibleCount"
  key_links:
    - from: "src/components/SongTable.vue"
      to: "props.songs (filteredSongs from store)"
      via: "visibleSongs computed slices sortedSongs by visibleCount"
      pattern: "sortedSongs.*slice.*visibleCount"
---

<objective>
Add progressive rendering (infinite scroll) to SongTable so only N rows render at a time, loading more as the user scrolls. All 200+ songs remain in memory via the Pinia store; this change only limits DOM rendering.

Purpose: Prevent rendering 200+ table rows at once, improving initial render performance and scroll smoothness.
Output: Updated SongTable.vue with scroll-based progressive rendering and filter-aware visible count reset.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/SongTable.vue
@src/views/SongsView.vue
@src/stores/songs.ts

<interfaces>
<!-- SongTable receives the full filtered list from the parent view -->

From src/views/SongsView.vue (line 68-73):
```vue
<SongTable
  :songs="songStore.filteredSongs"
  :loading="songStore.isLoading"
  @select="onSelectSong"
  @add="onAddSong"
/>
```

From src/stores/songs.ts (line 34-56):
```typescript
const filteredSongs = computed(() => {
  return songs.value.filter((song) => {
    const matchesSearch = !searchQuery.value ||
      song.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      song.ccliNumber.includes(searchQuery.value)
    // ... other filters
    return matchesSearch && matchesVwType && matchesKey && matchesTag
  })
})
```

From src/components/SongTable.vue (line 187-195):
```typescript
const props = defineProps<{
  songs: Song[]
  loading: boolean
}>()

defineEmits<{
  select: [song: Song]
  add: []
}>()
```

Current rendering: `v-for="song in sortedSongs"` iterates ALL songs (line 123-124).
sortedSongs is a computed that sorts the full `props.songs` array (line 212-219).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add progressive rendering with scroll-based load-more to SongTable</name>
  <files>src/components/SongTable.vue</files>
  <action>
Modify SongTable.vue to progressively render songs instead of all at once:

1. Add a `visibleCount` ref initialized to `BATCH_SIZE` (const = 50).

2. Create a `visibleSongs` computed that slices `sortedSongs` to `visibleCount.value`:
   ```typescript
   const visibleSongs = computed(() => sortedSongs.value.slice(0, visibleCount.value))
   ```

3. Add a `hasMore` computed:
   ```typescript
   const hasMore = computed(() => visibleCount.value < sortedSongs.value.length)
   ```

4. Add a `loadMore` function that increments `visibleCount` by `BATCH_SIZE`:
   ```typescript
   function loadMore() {
     visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, sortedSongs.value.length)
   }
   ```

5. Watch `() => props.songs` to reset `visibleCount` back to `BATCH_SIZE` when the input changes (filters/search changed). Use `{ flush: 'sync' }` so the reset happens immediately before Vue re-renders. Also import `watch` from vue.
   ```typescript
   watch(() => props.songs, () => {
     visibleCount.value = BATCH_SIZE
   })
   ```

6. Add a scroll sentinel element after the `</tbody>` closing tag but before the `</table>` closing tag is NOT possible (table only allows thead/tbody/tfoot). Instead, add the sentinel AFTER the `</table>` tag but still inside the outer `<div>`:
   - Place a `<div ref="sentinelRef" class="h-1" />` after `</table>` (invisible 1px-tall div).
   - Use IntersectionObserver to detect when the sentinel enters the viewport.
   - On intersection (and `hasMore` is true), call `loadMore()`.
   - Set up the observer in `onMounted`, disconnect in `onUnmounted`. Import both from vue.
   - Use `{ rootMargin: '200px' }` so loading triggers 200px before the user reaches the bottom for seamless experience.

7. Change the template `v-for` from iterating `sortedSongs` to iterating `visibleSongs`:
   ```html
   <tr v-for="song in visibleSongs" :key="song.id" ...>
   ```

8. Add a "Showing X of Y songs" indicator below the table (after the sentinel div), inside the outer container div:
   ```html
   <div v-if="!loading && songs.length > 0" class="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-800">
     Showing {{ visibleSongs.length }} of {{ sortedSongs.length }} songs
     <span v-if="hasMore"> &mdash; scroll for more</span>
   </div>
   ```

9. Do NOT add any new npm dependencies. IntersectionObserver is a native browser API.

10. Do NOT change the component's props, emits, or any external contract. The sort logic stays as-is.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - SongTable renders at most 50 rows initially (visibleCount = BATCH_SIZE = 50)
    - IntersectionObserver on sentinel div triggers loadMore() when user scrolls near bottom
    - visibleCount resets to BATCH_SIZE when props.songs changes (search/filter)
    - "Showing X of Y songs" indicator displayed below table
    - Sorting operates on full list, slicing happens after sort
    - No new dependencies added
    - TypeScript compiles cleanly
  </done>
</task>

</tasks>

<verification>
- `npx vue-tsc --noEmit` passes with no errors
- `npm run build` completes successfully
- Manual: Open Songs view with 50+ songs, confirm only first batch renders, scroll to load more, search resets visible count
</verification>

<success_criteria>
- SongTable progressively renders 50 songs at a time
- Scrolling loads additional batches seamlessly
- Filter/search changes reset the visible count
- Count indicator shows "Showing X of Y songs"
- No regressions in sorting, selection, or empty/loading states
</success_criteria>

<output>
After completion, create `.planning/quick/20-infinite-scroll-for-song-list-with-searc/20-SUMMARY.md`
</output>
