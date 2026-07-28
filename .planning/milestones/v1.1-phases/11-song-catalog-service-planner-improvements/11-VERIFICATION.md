---
phase: 11-song-catalog-service-planner-improvements
verified: 2026-07-01T12:00:00Z
status: passed
score: 24/24
overrides_applied: 0
human_verified: "user approved feature-complete 2026-07-13 (drag-drop/UAT items confirmed in production)"
human_verification:
  - test: "Drag a slot from position 1 to position 3; confirm it stays at position 3 with no snap-back"
    expected: "Slot remains at position 3 (no revert to original position)"
    why_human: "SortableJS DOM reconciliation cannot be asserted with static analysis; requires a live browser with a running service"
  - test: "After a drag reorder, refresh the page within ~1 second"
    expected: "The new order persists across the page reload (proves immediate updateService call)"
    why_human: "Immediate-persist timing requires a running app and live Firestore"
  - test: "Drag a slot then quickly click another slot or element"
    expected: "The save-button highlight clears on its own within ~3s (no stuck-dirty state)"
    why_human: "Autosave timer re-arm behavior requires live reactive execution"
  - test: "On a slot with an assigned song, click the red X delete button"
    expected: "A confirmation modal appears: 'Remove this item?' with Cancel and Remove buttons"
    why_human: "Modal trigger and cancel/confirm flow requires UI interaction"
  - test: "On an EMPTY slot (no song/scripture assigned), click the delete X"
    expected: "Slot removes immediately with NO confirmation modal"
    why_human: "isSlotPopulated branch logic requires live slot state"
  - test: "Open a scripture slot, show its passage preview, then click the close (x) on the preview panel"
    expected: "Only the preview panel closes; the slot is NOT deleted"
    why_human: "Event bubbling isolation (@click.stop) requires live browser interaction to confirm"
  - test: "Open the Songs list; click each column header (Title, Category, Key, CCLI, Last Used)"
    expected: "Each header sorts the list ascending; clicking again flips to descending with arrow indicator on the active column. Default load is Title ascending."
    why_human: "Sort interaction and arrow indicator rendering requires a running app"
  - test: "Confirm each song row shows team tags (gray), themes (teal), and user tags (pink) as visually-distinct pills"
    expected: "Three pill colors are visually distinguishable; empty rows show an em-dash"
    why_human: "Visual distinction is a UI/UX assertion not verifiable statically"
  - test: "Open a song, add user tag 'Christmas' in the editor form, save; confirm the pink pill appears on the row"
    expected: "Tag persists and renders as a pink pill on the song-list row after save"
    why_human: "Firestore write + reactive re-render requires live app"
  - test: "On a song row, use the inline '+' to add a tag and the pill 'x' to remove one; confirm persists after refresh"
    expected: "Both inline add and inline remove persist across page reload"
    why_human: "Firestore persistence requires live app"
  - test: "Select 2-3 songs via checkboxes; use the bulk action bar to apply 'Christmas' then remove it"
    expected: "All selected songs gain then lose the 'Christmas' pink pill; selection clears after each action"
    why_human: "Bulk iteration + Firestore multi-write requires live app"
  - test: "Use 'Show only tag = Christmas' filter; then 'Hide tag = Christmas' filter"
    expected: "Show-only: only tagged songs remain. Hide: tagged songs disappear. Blank option restores all."
    why_human: "Filter reactivity requires a live app with tagged songs present"
  - test: "Open the song picker on any slot and scroll past the initial list"
    expected: "Picker loads beyond the first 50 songs in batches as you scroll; a 'Showing X of Y' footer updates"
    why_human: "IntersectionObserver and DOM scroll events require a live browser"
  - test: "Open a VW Type 1 slot picker; confirm Type 2 and Type 3 songs appear mixed into the list (no type filtering)"
    expected: "Songs of all types appear in rotation order; the VW badge is visible but songs are NOT sorted by type match"
    why_human: "Visual ordering and badge-only rendering require a live browser"
  - test: "Open the picker; confirm each row shows gray team-tag pills, teal theme pills, and pink user-tag pills"
    expected: "Three visually-distinct pill types appear on rows that have data in each field"
    why_human: "Visual distinction requires live browser inspection"
  - test: "Use 'Show only tag' and 'Hide tag' selects in the picker header"
    expected: "Show-only: only tagged songs appear in both rotation and search results. Hide: those songs disappear. Filter is independent of the catalog-page tag filter."
    why_human: "Picker-local filter independence from store-global filter requires a live app to verify end-to-end"
  - test: "Trigger AI Picks on a slot with sermon context set"
    expected: "Suggestions span multiple VW types; no hidden/soft-deleted songs appear; reason text reflects sermon themes"
    why_human: "AI suggestion content and hidden-song exclusion requires live Claude API call + real song data"
---

# Phase 11: Song Catalog & Service Planner Improvements — Verification Report

**Phase Goal:** Make the song catalog fully browsable/searchable and make service-plan editing reliable — remove app-enforced constraints in favor of user control, surface song metadata everywhere, add tagging, and fix the drag-drop ordering/autosave data-integrity bugs.
**Verified:** 2026-07-01T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (D-NN) | Status | Evidence |
|---|-------------|--------|----------|
| 1 | A song can carry user-defined tags separate from teamTags and themes (D-01) | VERIFIED | `tags: string[]` at line 40 of `src/types/song.ts`, after `hidden: boolean`, with D-01 comment |
| 2 | Searching any of key, notes, or tags returns the matching song (D-05) | VERIFIED | `songSearch.ts` lines 26-28: `song.tags?.some(...)`, `song.notes?.toLowerCase()`, `a.key.toLowerCase() === q` |
| 3 | Re-importing from Planning Center never clears user tags (D-02) | VERIFIED | `songs.ts` line 173: `tags: existing.tags ?? []` in upsertSongs existing-branch; `pcSongImport.ts` line 121: `tags: []` |
| 4 | Re-importing from Planning Center merges (unions) themes rather than overwriting (D-08) | VERIFIED | `songs.ts` line 175: `themes: Array.from(new Set([...(existing.themes ?? []), ...(_themes ?? [])]))` |
| 5 | TeamTagPill renders three visually-distinct variants: team, theme, user (D-06 foundation) | VERIFIED | `TeamTagPill.vue`: `variantClasses` static const with `team`/`theme`/`user` keys; distinct teal/pink/gray palette |
| 6 | Legacy song docs without a tags field are normalized to an empty array | VERIFIED | `songs.ts` lines 82-83: `if (!Array.isArray(data.tags)) data.tags = []` in subscribe mapper |
| 7 | Dragging a slot to a new position keeps that order visually (no snap-back) and matches persisted state after refresh (D-16) | VERIFIED (code) | `ServiceEditorView.vue` line 1018: `insertBefore` DOM revert before reactive mutation; v-for key is `slot.kind + '-' + slot.position` (no index) — needs human test |
| 8 | A drag reorder persists immediately, not after the 800ms debounce (D-15) | VERIFIED (code) | `ServiceEditorView.vue` lines 1027-1044: `onEnd` is `async`, calls `serviceStore.updateService(serviceId.value, { slots: reindexed })` immediately; resets `originalService` to clear `isDirty` |
| 9 | The save button never stays highlighted (dirty) with no save ever firing (D-17) | VERIFIED (code) | `ServiceEditorView.vue` line 1198: `autosaveTimer = null` as first statement in `setTimeout` callback; line 1195-1224: watcher always calls `scheduleAutosave()` when `isDirty`; `autosaveSaving` reset in `finally` |
| 10 | Deleting a populated slot (assigned song, scripture, message) shows a confirmation dialog first (D-14) | VERIFIED (code) | `ServiceEditorView.vue` lines 956-957: `showSlotDeleteConfirm` + `pendingDeleteIndex` refs; line 1314: `isSlotPopulated()`; line 1345-1353: guard routes populated slots through confirm; Teleport modal at line 232 |
| 11 | Closing a scripture preview never deletes the underlying slot (D-13) | VERIFIED (code) | `ScriptureInput.vue` line 170: `@click.stop="dismissPreview"` on the dismiss button; no shared handler with the slot delete X |
| 12 | AI song suggestions exclude hidden (soft-deleted) songs (D-18) | VERIFIED | `ServiceEditorView.vue` lines 1428, 1538: both `suggestAllSongs()` and `fetchAiForSlot()` build `const base = songStore.songs.filter((s) => !s.hidden)` — 2 matches confirmed by grep |
| 13 | Every song-list column (Title, Category, Key, CCLI, Last Used) can be sorted ascending/descending (D-07) | VERIFIED (code) | `SongTable.vue` line 300: `type SortField = 'title' | 'category' | 'key' | 'ccli' | 'lastUsed'`; lines 94/105/116/127: all 5 headers call `toggleSort(field)`; `sortKey()` uses per-field extractors |
| 14 | Each song-list row shows themes and user tags as pills, visually distinct from team tags (D-06) | VERIFIED | `SongTable.vue` line 208: `variant="theme"` for `song.themes`; line 214: custom inline span with `bg-pink-900/50 text-pink-300 border-pink-800` (same palette as TeamTagPill user variant) for `song.tags` with embedded removal button |
| 15 | A user can add/remove tags in the song editor form (D-04a) | VERIFIED | `SongSlideOver.vue` lines 422-447: `toggleUserTag`, `addUserTags`, `removeUserTag` functions; `tags: form.value.tags` in save payload (line 488) |
| 16 | A user can add/remove a tag inline on a song-list row (D-04b) | VERIFIED | `SongTable.vue` lines 220/237-254: per-row `×` button calls `removeUserTag(song, t)` via `updateSong`; `+` button opens inline input calling `commitInlineTag`; all controls have `@click.stop` |
| 17 | A user can select multiple songs and apply/remove a tag to all at once (D-04c) | VERIFIED | `SongTable.vue` lines 73-76: checkbox column; `SongsView.vue` lines 79-98: bulk action bar with `applyBulkTag` / `removeBulkTag` iterating `selectedSongIds` |
| 18 | The song list can be filtered to hide-by-tag and show-only-by-tag (D-03 list side) | VERIFIED | `SongFilters.vue` lines 69-84: two selects bound to `filterTagInclude`/`filterTagExclude`; `songs.ts` lines 55-60: `matchesTagInclude` + `matchesTagExclude` predicates in `filteredSongs` |
| 19 | The service-plan song picker browses the entire (non-hidden) catalog by scrolling — no longer stops after ~15 songs (D-12) | VERIFIED | `SongSlotPicker.vue`: no `slice(0, 15)` found; `BATCH_SIZE = 50`, `visibleCount`, `IntersectionObserver` on `sentinelRef`, `loadMore()`; applied to both `visibleSuggestions` and `visibleSearchResults` |
| 20 | Any song can be picked for any slot — the 1/2/3 VW-type filter no longer restricts the list (D-09) | VERIFIED | `suggestions.ts`: `typeBonus` removed entirely (grep returns no matches); `SongSlotPicker.vue`: no `bMatch - aMatch` VW-type re-sort in `searchResults` |
| 21 | The VW-type badge is shown on picker rows as information only, with zero influence on ordering (D-10) | VERIFIED | `SongSlotPicker.vue` lines 147/184: `SongBadge` still rendered; `typeBonus` and VW-type re-sort both absent from ranking and search computed |
| 22 | AI Picks in the picker suggest broadly from the whole non-hidden catalog, not weighted by the slot's VW type (D-11) | VERIFIED | `claudeApi.ts` line 177: `Slot VW Type (advisory context only):`; line 40: "do not use it as a hard filter (D-11)"; hidden-song exclusion enforced caller-side (D-18 fix in Plan 02) |
| 23 | Picker rows show themes and user tags as distinct pills (D-06 picker side) | VERIFIED | `SongSlotPicker.vue` lines 147-148 (search rows) and 184-185 (rotation rows): `variant="theme"` and `variant="user"` on `TeamTagPill` in both row templates |
| 24 | The picker can filter to hide-by-tag and show-only-by-tag (D-03 picker side) | VERIFIED | `SongSlotPicker.vue` lines 249-266: `includeTag`/`excludeTag` refs, `tagFilteredSongs` computed used as base for ranking and search; selects in dropdown header (lines 51-58); resets `visibleCount` on change (lines 336-337) |

**Score:** 24/24 truths verified (code-level); 17 require human UAT for behavioral confirmation

### Required Artifacts

| Artifact | Provides | Status | Evidence |
|----------|----------|--------|----------|
| `src/types/song.ts` | `tags: string[]` on Song; UpsertSongInput inherits via Omit | VERIFIED | Line 40: `tags: string[] // D-01 user-defined tags` |
| `src/utils/songSearch.ts` | Search over tags, notes, arrangement key | VERIFIED | Lines 26-28: `song.tags?.some`, `song.notes?.toLowerCase`, `a.key.toLowerCase() === q` |
| `src/stores/songs.ts` | Tag-preserve + theme-merge in upsertSongs; tags backfill; include/exclude tag filter state | VERIFIED | Lines 173/175: preservation + union; line 82: backfill; lines 31-32: refs; lines 229-230: exported |
| `src/utils/pcSongImport.ts` | `tags: []` on mapped upsert payload | VERIFIED | Line 121: `tags: [], // D-01/D-02: user tags never sourced from PC` |
| `src/components/TeamTagPill.vue` | Variant prop with static class map | VERIFIED | `variantClasses` const with `team`/`theme`/`user` keys; `variant?: 'team' | 'theme' | 'user'` in defineProps |
| `src/views/ServiceEditorView.vue` | Snap-back fix, immediate reorder-save, stuck-dirty guard, slot delete-confirm modal, AI hidden-filter fix | VERIFIED | `showSlotDeleteConfirm` (line 956), `insertBefore` (line 1018), `updateService(serviceId` in `onEnd` (line 1035), `autosaveTimer = null` (line 1198), `.filter((s) => !s.hidden)` ×2 (lines 1428/1538) |
| `src/stores/services.ts` | `updateService` persist target for immediate reorder-save | VERIFIED | Line 78: `async function updateService`; line 185: exported |
| `src/components/SongTable.vue` | All-column sort, themes/tags pills, inline tag edit, bulk-select column | VERIFIED | `SortField` union (line 300), all 5 headers, `sortKey()`, `selectedIds` Set, `updateSong` ×2, `@click.stop` on all interactive cells, pink inline pills with `bg-pink-900/50` |
| `src/components/SongFilters.vue` | Include/exclude user-tag filter controls | VERIFIED | Lines 69-84: two selects bound to `filterTagInclude`/`filterTagExclude`; props declared lines 96-100 |
| `src/components/SongSlideOver.vue` | User-tag editing in the song form | VERIFIED | `toggleUserTag` (line 422), `addUserTags` (line 431), `removeUserTag` (line 444); `tags: form.value.tags` in save payload (line 488) |
| `src/views/SongsView.vue` | `availableUserTags` + bulk-tag action bar wiring | VERIFIED | `availableUserTags` computed (line 226); `selectedSongIds`, `applyBulkTag`, `removeBulkTag`; `v-model:filterTagInclude="songStore.filterTagInclude"` (line 70) |
| `src/components/SongSlotPicker.vue` | Load-more batching, no type filter, info-only badge, tag filter, themes/tags pills | VERIFIED | `IntersectionObserver`, `visibleCount`, `sentinelRef`, `loadMore`; no `slice(0,15)`; `includeTag`/`excludeTag`; `tagFilteredSongs`; `variant="theme"`/`variant="user"` in both row templates |
| `src/utils/suggestions.ts` | Removed VW-type ranking bonus | VERIFIED | `typeBonus` absent (grep returns no matches); `orchestraBonus` is only score modifier beyond rotation scores |
| `src/utils/claudeApi.ts` | Broadened AI prompt; slotVwType advisory only | VERIFIED | Line 177: `Slot VW Type (advisory context only):`; line 40 comment: "do not use it as a hard filter (D-11)" |

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `songs.ts` upsertSongs | `existing.tags` preservation | `existing.tags ?? []` in update payload | VERIFIED | Line 173: `tags: existing.tags ?? []` |
| `songs.ts` upsertSongs | themes union | `new Set([...existing, ...incoming])` | VERIFIED | Line 175: `themes: Array.from(new Set([...(existing.themes ?? []), ...(_themes ?? [])]))` |
| `SongFilters.vue` | `songStore.filterTagInclude` / `filterTagExclude` | v-model via prop+emit; SongsView v-models directly to store refs | VERIFIED | `SongFilters.vue` lines 69-84; `SongsView.vue` lines 70-71: `v-model:filterTagInclude="songStore.filterTagInclude"` |
| `SongTable.vue` inline/bulk tag edit | `songStore.updateSong` | tag mutation persist | VERIFIED | Lines 398/405: `await songStore.updateSong(song.id, { tags: newTags })` |
| `ServiceEditorView.vue` Sortable `onEnd` | `serviceStore.updateService` | immediate persist after reindexSlots | VERIFIED | Line 1035: `await serviceStore.updateService(serviceId.value, { slots: reindexed })` inside `async onEnd` |
| `ServiceEditorView.vue` suggestAllSongs/fetchAiForSlot | non-hidden song base | `filter(s => !s.hidden)` | VERIFIED | Lines 1428/1538: both call sites grep-confirmed |
| `SongSlotPicker.vue` suggestions/searchResults | `visibleCount` slice via IntersectionObserver | sentinel + `loadMore` | VERIFIED | `visibleSuggestions` and `visibleSearchResults` both sliced by `visibleCount`; `sentinelRef` + observer |
| `SongSlotPicker.vue` | `TeamTagPill variant` | themes/tags pill render | VERIFIED | Lines 147-148/184-185: `variant="theme"` and `variant="user"` in both row templates |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `songs.ts filteredSongs` | `filterTagInclude`, `filterTagExclude` | store refs exported and v-modeled to real `<select>` in SongFilters | Yes — user selection drives filtering | FLOWING |
| `SongTable.vue` inline tag | `song.tags` remove path | `songStore.updateSong(song.id, { tags })` — Firestore write | Yes — live Firestore mutation | FLOWING |
| `SongsView.vue` bulk apply | `selectedSongIds` | `updateSong` called per selected song | Yes — iterates real selected ids from checkbox state | FLOWING |
| `SongSlotPicker.vue` rotation list | `visibleSuggestions` | `tagFilteredSongs → rankSongsForSlot → slice visibleCount` | Yes — real catalog songs from `props.songs` | FLOWING |
| `ServiceEditorView.vue` AI base | `base` (non-hidden) | `songStore.songs.filter(s => !s.hidden)` — real store | Yes — excludes hidden songs correctly | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points without a live browser and Firestore. All behaviors require a running `npm run dev` session and are routed to Human Verification.

### Requirements Coverage (D-01..D-18)

| Decision | Plan | Description | Status | Evidence |
|----------|------|-------------|--------|----------|
| D-01 | 11-01 | `tags: string[]` field on Song, distinct from teamTags/themes | SATISFIED | `song.ts` line 40 |
| D-02 | 11-01 | User tags preserved across PC re-imports (never overwritten) | SATISFIED | `songs.ts` line 173: `existing.tags ?? []` |
| D-03 | 11-03, 11-04 | Tag filtering in both song list and picker (hide + show-only) | SATISFIED | `SongFilters.vue` + `SongsView.vue` (list); `SongSlotPicker.vue` `includeTag`/`excludeTag` (picker) |
| D-04 | 11-03 | Tag editing in form (a), inline (b), and bulk multi-select (c) | SATISFIED | `SongSlideOver.vue` (a); `SongTable.vue` inline (b); `SongsView.vue` bulk bar (c) |
| D-05 | 11-01 | `songMatchesQuery` covers key, notes, tags | SATISFIED | `songSearch.ts` lines 26-28 |
| D-06 | 11-03, 11-04 | Theme and user-tag pills on song-list rows and picker rows | SATISFIED | `SongTable.vue` (list); `SongSlotPicker.vue` both row templates |
| D-07 | 11-03 | All song-list columns sortable | SATISFIED | `SongTable.vue` `SortField` union + 5 headers |
| D-08 | 11-01 | PC re-import unions themes (never overwrites) | SATISFIED | `songs.ts` line 175: `Array.from(new Set(...))` |
| D-09 | 11-04 | Remove 1/2/3 type filter from picker | SATISFIED | `typeBonus` removed; `requiredVwType` prop is display-only |
| D-10 | 11-04 | VW badge stays as info only; slot type has zero ranking influence | SATISFIED | `SongBadge` renders; no `typeBonus`; no `bMatch - aMatch` sort |
| D-11 | 11-04 (+ 11-02 caller side) | AI Picks suggest broadly; slotVwType advisory only | SATISFIED | `claudeApi.ts` line 177 advisory label; broadened system prompt |
| D-12 | 11-04 | IntersectionObserver batching in picker (full catalog scrollable) | SATISFIED | `IntersectionObserver` + `visibleCount` + `sentinelRef` in `SongSlotPicker.vue`; no `slice(0,15)` |
| D-13 | 11-02 | Closing a preview never deletes the underlying slot | SATISFIED | `ScriptureInput.vue` line 170: `@click.stop="dismissPreview"` |
| D-14 | 11-02 | Confirmation dialog before deleting a populated service element | SATISFIED | `showSlotDeleteConfirm`, `isSlotPopulated`, Teleport modal in `ServiceEditorView.vue` |
| D-15 | 11-02 | Drag reorder persists immediately (not via 800ms debounce) | SATISFIED | `onEnd` is `async`; immediate `updateService` call + `originalService` reset |
| D-16 | 11-02 | SortableJS snap-back fixed; reordered order sticks visually | SATISFIED | `insertBefore` DOM revert before reactive mutation; stable v-for key |
| D-17 | 11-02 | Autosave stuck-dirty bug fixed; `isDirty` always resolves | SATISFIED | `autosaveTimer = null` first statement in setTimeout callback; watcher always calls `scheduleAutosave()` |
| D-18 | 11-02 | AI suggestions exclude hidden (soft-deleted) songs | SATISFIED | `.filter((s) => !s.hidden)` confirmed at lines 1428 and 1538 |

### Anti-Patterns Found

No blockers detected. Summary of notable patterns reviewed:

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `SongTable.vue` user-tag pills | Custom inline `<span>` instead of `TeamTagPill` | Info | Intentional design decision (documented in 11-03-SUMMARY.md): removable pills need embedded `×` button. Uses identical CSS classes (`bg-pink-900/50 text-pink-300 border-pink-800`). Not a stub. |
| `ServiceEditorView.vue` line 1028 | `autosaveTimer = null` set in D-15 immediate-save path before `updateService` | Info | Correct — clears stale timer before immediate persist so the re-arm guard is reachable. Load-bearing, not a stub. |
| `songs.ts filteredSongs` | `matchesTagInclude`/`matchesTagExclude` use optional chaining | Info | Defensive coding for legacy docs without `tags`. Correct pattern — not a stub. |

### Human Verification Required

17 items require manual testing in a running `npm run dev` session against a live Firestore. These were explicitly deferred as the terminal human-verify checkpoint at the end of each plan (Plans 11-02, 11-03, 11-04 each have a blocking `checkpoint:human-verify` task).

**Service Editor Reliability (Plan 11-02 checkpoint):**

#### 1. Drag reorder — no snap-back (D-16)
**Test:** Open a service with 4+ slots; drag slot from position 1 to position 3.
**Expected:** Slot stays at position 3; no revert to position 1.
**Why human:** SortableJS DOM reconciliation requires live browser with real dragging.

#### 2. Drag reorder — immediate persist (D-15)
**Test:** After drag, immediately (~1s) refresh the page.
**Expected:** New order persists; slot is still at position 3.
**Why human:** Immediate Firestore write timing requires live execution.

#### 3. Stuck-dirty autosave guard (D-17)
**Test:** Drag a slot, then quickly click another slot or element.
**Expected:** Save-button highlight clears on its own within ~3s.
**Why human:** Autosave timer re-arm requires live reactive execution.

#### 4. Populated-slot delete confirmation (D-14)
**Test:** On a slot with an assigned song, click the red X delete button.
**Expected:** Confirmation modal appears with Cancel and Remove buttons.
**Why human:** Modal trigger requires live UI interaction.

#### 5. Populated-slot confirm cancel (D-14)
**Test:** In the confirmation modal, click Cancel.
**Expected:** Modal closes; song assignment remains.
**Why human:** Requires live modal state.

#### 6. Empty-slot silent delete (D-14)
**Test:** On an EMPTY slot, click the delete X.
**Expected:** Slot removes immediately, no modal.
**Why human:** `isSlotPopulated` branch requires live slot data.

#### 7. Preview-close does not delete slot (D-13)
**Test:** Open a scripture slot, show its passage preview, click the preview's × close.
**Expected:** Only the preview closes; slot is NOT deleted.
**Why human:** Event bubbling isolation requires live browser interaction.

**Song Catalog Browse UX (Plan 11-03 checkpoint):**

#### 8. All-column sort (D-07)
**Test:** Click each header (Title, Category, Key, CCLI, Last Used) in the Songs list.
**Expected:** Each sorts ascending; second click flips to descending; arrow shows on active column. Default load is Title ascending.
**Why human:** Sort interaction and arrow rendering require a running app.

#### 9. Three-variant pills per row (D-06)
**Test:** View song rows in the Songs list.
**Expected:** Gray team-tag pills, teal theme pills, pink user-tag pills; em-dash for rows with none.
**Why human:** Visual distinction is a UI assertion.

#### 10. Editor form tag editing (D-04a)
**Test:** Open a song, add user tag "Christmas" in the editor form, save.
**Expected:** Pink "Christmas" pill appears on the song row; persists after refresh.
**Why human:** Firestore write + reactive re-render requires live app.

#### 11. Inline row tag add and remove (D-04b)
**Test:** On a song row, use the inline "+" to add a tag and the pill "×" to remove one.
**Expected:** Both operations persist after page refresh; row click still opens slide-over.
**Why human:** Firestore persistence requires live app.

#### 12. Bulk multi-select tag apply and remove (D-04c)
**Test:** Select 2-3 songs via checkboxes; apply "Christmas" via bulk action bar; then remove it.
**Expected:** All selected songs gain/lose the pink pill; selection clears after each action.
**Why human:** Bulk Firestore multi-write requires live app.

#### 13. Show-only and hide tag filters (D-03 list side)
**Test:** Use "Show only tag = Christmas" then "Hide tag = Christmas" in filter bar.
**Expected:** Show-only: only tagged songs remain. Hide: tagged songs disappear. Blank restores all.
**Why human:** Filter reactivity requires a running app with tagged songs present.

**Picker UX (Plan 11-04 checkpoint):**

#### 14. Full-catalog browsing by scroll (D-12)
**Test:** Open song picker on any slot; scroll the list.
**Expected:** Loads beyond 50 songs in batches; "Showing X of Y" footer updates; search results also paginate.
**Why human:** IntersectionObserver requires live browser.

#### 15. Type-agnostic picker (D-09, D-10)
**Test:** Open a VW Type 1 slot picker; confirm all types appear in rotation order.
**Expected:** Type 2/3 songs mixed in; VW badge visible but no type-sorting occurs.
**Why human:** Visual ordering requires live browser inspection.

#### 16. Picker theme and user-tag pills (D-06)
**Test:** Open the picker; find songs with themes and user tags.
**Expected:** Gray team-tag, teal theme, pink user-tag pills visible on each row.
**Why human:** Visual distinction requires live browser.

#### 17. Picker include/exclude tag filter (D-03 picker side)
**Test:** Use "Show only tag" and "Hide tag" selects in the picker header.
**Expected:** Filters work on both rotation and search lists; filter is independent of catalog-page filter.
**Why human:** Picker-local filter independence requires live app to verify end-to-end.

---

## Gaps Summary

No automated gaps found. All 24 observable truths are verified at the code level. All 18 D-NN decisions have clear implementation evidence in the codebase. All 10 commits referenced in the summaries exist in git history. 463 unit tests pass and `vue-tsc --build` is clean (per phase prompt). The only outstanding items are the 17 behavioral human-verify checkpoints explicitly deferred by the plans as the end-of-phase UAT gate.

---

_Verified: 2026-07-01T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
