# Phase 11: Song Catalog & Service Planner Improvements - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the song catalog fully browsable/searchable and make service-plan editing reliable. Two thrusts:

1. **Catalog** — surface existing song metadata (themes) everywhere, add a user-controlled tagging system with hide/show filtering, complete full-field search, make every column sortable, and make the planner's song picker browse the whole catalog.
2. **Planner reliability & safety** — remove app-enforced VW-type constraints in the picker (user applies 1-2-3 themselves), fix the drag-drop reorder snap-back + autosave-timing data-integrity bugs, exclude hidden songs from AI suggestions, and add a delete-confirmation guard so items aren't lost by accident.

This clarifies HOW to implement the 8 scoped items from ROADMAP.md. No new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Tagging System (item 7)
- **D-01:** Add a new dedicated `tags: string[]` field to the `Song` type (`src/types/song.ts`) for user-defined tags (e.g. "Christmas"). Do NOT reuse `teamTags` (team compatibility) or `themes` (PC-imported thematic keywords).
- **D-02:** The new `tags` field is user-controlled and MUST be preserved across Planning Center re-imports — the import upsert must never overwrite or clear it. Same protection pattern already applied to the `hidden` flag in Phase 9. Include `tags` in `UpsertSongInput` handling so re-import merges rather than clobbers.
- **D-03:** Tag filtering supports BOTH directions: hide-by-tag (exclude songs carrying a tag) AND show-only/include-by-tag (show only songs carrying a tag). Available in BOTH the song list (`SongsView`/`SongFilters`) and the service-planner search (`SongSlotPicker`).
- **D-04:** Users can add/remove tags in three places: (a) the song editor form, (b) inline on song-list rows (quick add/remove), and (c) bulk multi-select — select multiple songs in the list and apply/remove a tag to all at once (fast for tagging a seasonal set).

### Search, Metadata & Sorting (items 2, 3, 6)
- **D-05:** Extend `songMatchesQuery()` (`src/utils/songSearch.ts`) to also match: arrangement `key`, the `notes` field, and the new `tags` field. Search already covers title, CCLI, author, themes, teamTags, and VW type/label — this completes "search on any field."
- **D-06:** Display `themes` (currently stored but never shown) as pills on each song-list row and each picker/search-result row. Also display the new user `tags` as pills. The three tag types — team tags, themes, user tags — must be visually distinct (e.g. different pill colors) so they're readable at a glance. Reuse the existing `TeamTagPill` styling approach with variants.
- **D-07:** Make all song-list columns sortable in `SongTable.vue` (currently only Title): Title, Category (VW type), Key, CCLI, Last Used. Default sort stays Title ascending so the list looks familiar on load. Extend the existing `sortField`/`sortDir`/`toggleSort()` mechanism.
- **D-08:** Capture `themes` on Planning Center import (item 2). The `themes` field exists; wire the PC import path to populate it from PC song data. Merge with existing themes on re-import (don't lose manually added ones — respect the same import-safety principle as tags).

### Planner Song Picker (item 1)
- **D-09:** Remove the 1/2/3 song-type filter from `SongSlotPicker.vue` — any song can be picked for any slot. The `requiredVwType` prop should no longer restrict or rank the list.
- **D-10:** The VW-type badge (`SongBadge`) stays visible on each picker row as INFORMATION ONLY. Slot type must NOT influence ordering — order the list purely by rotation/search relevance (remove the type-match ranking bonus in `rankSongsForSlot`/search re-sort).
- **D-11:** AI Picks in the picker suggest BROADLY from the whole (non-hidden) catalog — no longer weighting the slot's VW type. Users apply the 1-2-3 paradigm themselves.
- **D-12:** Fix picker browsability ("stops after a handful") with incremental load-more batching, mirroring `SongTable.vue`'s Intersection-Observer pattern (~50 at a time) rather than the current hard `slice(0, 15)` on the rotation list. Applies to both the rotation list and search results so the full catalog is reachable by scrolling.

### Edit Reliability & Safety (items 4, 8)
- **D-13:** Closing/dismissing any preview (scripture preview especially) must NEVER delete the underlying service element. Root cause: the delete (red X) button sits too close to the preview-close button, causing misclicks. Deletion must be a separate, deliberate action.
- **D-14:** Add a confirmation dialog before deleting any POPULATED service element (a slot with an assigned song, a scripture, a message, etc.). Empty/blank slots may be removed without a prompt. This guards both `removeSlot()` and `onClearSong()` in `ServiceEditorView.vue`. Reuse the existing Teleport modal pattern (as used by delete-service / `NewServiceDialog.vue`): backdrop `z-40`, dialog `z-50`, Cancel + red confirm buttons.
- **D-15:** Drag-reorder must persist IMMEDIATELY (not wait on the 800ms autosave debounce) so a quick follow-up interaction can't drop the change. A reorder is a deliberate action.
- **D-16:** Fix the SortableJS/Vue snap-back: the reordered order must stick visually and match persisted state (no revert-on-next-render). This is the classic SortableJS-mutates-DOM vs Vue-reactive-array conflict in `ServiceEditorView.vue` `Sortable.create(...).onEnd`.
- **D-17:** Fix the autosave-timing bug where the save button highlights (dirty) but autosave never fires after quick post-drag interactions. Ensure `isDirty` → autosave watcher → `onSave()` always completes and the dirty/inflight state cannot get stuck.

### Locked from Prior Phases
- **D-18:** AI song suggestions MUST exclude `hidden` (soft-deleted) songs (item 5). Root cause found: `suggestAllSongs()` in `ServiceEditorView.vue` (~line 310) passes `songStore.songs` (all songs) instead of the non-hidden filtered list. Switch to `songStore.filteredSongs` (or an explicit `.filter(s => !s.hidden)`) before building `librarySource` and before passing to `claudeApi.getSongSuggestions()`. This finishes a decision already made in Phase 9 (hidden songs excluded from AI/LLM planning).

### Claude's Discretion
- Exact pill colors / visual treatment distinguishing team tags vs themes vs user tags (follow the dark-mode palette: gray-950/900/800).
- Bulk-tagging UI affordance (checkbox column + action bar vs shift-select) — pick the approach most consistent with existing `SongTable.vue`.
- Whether the immediate reorder-save reuses `onSave()` directly or a lighter dedicated persist call.
- Whether to migrate SortableJS→`vuedraggable` or fix the existing SortableJS integration in place — choose the lower-risk fix that reliably resolves snap-back.
- Firestore backfill/default for the new `tags` field on existing song docs (default to `[]`).
- Column header UI for making all columns sortable (sort arrows already exist for Title — replicate).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Decisions
- `.planning/phases/09-pc-song-import-tag-management/09-CONTEXT.md` — Soft-delete (`hidden`) flag, import upsert/preservation rules, "hidden excluded from AI planning" decision, and the prior "extend teamTags or add dedicated tag system" discretion that D-01 now resolves.
- `.planning/PROJECT.md` — Vertical Worship 1-2-3 methodology, dark-mode canonical theme (gray-950/900/800), Firebase/Firestore + Pinia + Tailwind v4 stack constraints.

### Data Model
- `src/types/song.ts` — `Song` interface (`themes`, `teamTags`, `hidden`, `lastUsedAt`, `primaryArrangementId`) and `UpsertSongInput`. Add `tags: string[]` here.

### Song Catalog UI
- `src/components/SongTable.vue` — song list; existing sort (Title only), Intersection-Observer infinite scroll (batch 50), pill rendering. Extend for all-column sort + themes/tags pills.
- `src/components/SongFilters.vue` — search bar + filters; add tag hide/show filter.
- `src/components/TeamTagPill.vue` — existing pill component to reuse/vary for themes and user tags.
- `src/components/SongBadge.vue` — VW-type badge (info-only in picker).
- `src/utils/songSearch.ts` — `songMatchesQuery()`; extend to key + notes + tags.
- `src/stores/songs.ts` — `songs`/`filteredSongs` (excludes hidden), filter state, `upsertSongs()`, `deleteSong()`/`restoreSong()`.

### Service Planner
- `src/components/SongSlotPicker.vue` — planner song picker; remove type filter, info-only badge, incremental load-more, tag filter + themes/tags pills.
- `src/views/ServiceEditorView.vue` — SortableJS reorder (`onEnd`, `reindexSlots`), autosave state machine (~800ms debounce, `isDirty`, inflight guard), `removeSlot()`/`onClearSong()`, `suggestAllSongs()` (hidden-filter bug ~line 310), scripture preview.
- `src/stores/services.ts` — `updateService()`, `assignSongToSlot()`, `clearSongFromSlot()`.
- `src/utils/claudeApi.ts` — `getSongSuggestions()` (receives the song library to suggest from).

### Modal Pattern
- `src/components/NewServiceDialog.vue` — reference Teleport+Transition modal pattern for the delete-confirmation dialog.

### Planning Center Import (themes capture)
- The PC import path (Phase 9/10) — wire `themes` capture from PC song data. Confirm exact file during research (song import/reconciliation utility + `songs.ts` `upsertSongs`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TeamTagPill.vue` — pill renderer; add color/variant props for themes vs user tags.
- `SongBadge.vue` — VW-type badge; keep as info-only in the picker.
- `NewServiceDialog.vue` / delete-service modal — Teleport+Transition confirmation modal pattern to reuse for delete-confirm.
- `SongTable.vue` Intersection-Observer batching (BATCH_SIZE 50) — the template for fixing `SongSlotPicker` browsability.
- `songs.ts` `filteredSongs` (already excludes hidden) — the correct source for the AI-suggestion fix.

### Established Patterns
- Pinia stores with Firestore `onSnapshot` listeners; computed-based filtering/sorting; client-side array sort.
- Autosave: debounced deep watcher with inflight guard + undo snapshot in `ServiceEditorView.vue`.
- Drag-drop: SortableJS v1.15.7 with `position` reindexing (`reindexSlots`).
- Search: case-insensitive substring across multiple fields in `songSearch.ts`.

### Integration Points
- New `tags` field flows through: `song.ts` type → editor form → `SongTable`/`SongSlotPicker` display + filter → `songSearch.ts` → `upsertSongs()` import preservation → Firestore backfill (`[]` default).
- Delete-confirm hooks into `removeSlot()` and `onClearSong()`; preview-close decoupled from delete.
- Reorder-immediate-save hooks into SortableJS `onEnd` → services store `updateService()`.

</code_context>

<specifics>
## Specific Ideas

- Three tag types must be visually distinguishable: team tags (existing), themes, user tags.
- "Christmas" is the canonical example of a user tag the user wants to hide/show-filter by.
- The picker should feel type-agnostic: badge visible but zero ordering influence; AI suggests broadly.
- The delete/preview-close proximity is the concrete misclick cause — ensure the delete affordance reads as clearly separate and gated by confirmation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-song-catalog-service-planner-improvements*
*Context gathered: 2026-06-30*
