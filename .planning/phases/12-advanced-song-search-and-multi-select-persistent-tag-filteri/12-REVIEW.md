---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
reviewed: 2026-07-02T21:52:57Z
depth: standard
diff_base: 98c3a9b
files_reviewed: 7
files_reviewed_list:
  - src/utils/songSearch.ts
  - src/stores/songs.ts
  - src/components/TagFilterChecklist.vue
  - src/components/SongFilters.vue
  - src/components/SongSlotPicker.vue
  - src/views/SongsView.vue
  - src/views/ServiceEditorView.vue
findings:
  critical: 0
  high: 0
  medium: 2
  low: 3
  total: 5
status: issues
---

# Phase 12: Code Review Report

**Reviewed:** 2026-07-02T21:52:57Z
**Depth:** standard
**Diff base:** `98c3a9b` (phase-start) → HEAD (`fecef46`)
**Files Reviewed:** 7
**Status:** issues

Note: this review supersedes/extends the earlier `12-REVIEW.md` pass (base `ecbad1e`), whose two findings (WR-01 tag-filter reset on user switch, WR-02 multi-word field-scoped search) were already fixed per `12-REVIEW-FIX.md` before this diff range begins. This pass covers only what changed between `98c3a9b` and HEAD: the tag-union unification (`e362a41`, `bae5162`), the hidden-song exclusion fix (`11c3760`), and the popover alignment/local-filter/min-height UI fixes (`1a702b8`, `673fe41`, `fecef46`).

## Summary

`src/utils/songSearch.ts` and `src/views/ServiceEditorView.vue` have zero diff against `98c3a9b` — not touched in this range, spot-checked only for integration context (confirmed the AI-suggestion song library already excludes hidden songs via `D-18` at `ServiceEditorView.vue:1452-1456`/`1562-1566`). The `filterTag`/`availableTags` (old, single-select) removal is clean — no dangling references remain anywhere in `src`, and `npx vue-tsc --noEmit` passes with no errors.

The hidden-song exclusion fix is correctly applied to `songs.ts` (`filteredSongs`), `SongsView.vue` (`availableUserTags`), and `SongSlotPicker.vue` (`visibleSongs` / `availableTags` / `tagFilteredSongs`). Two gaps remain, though: one path in `SongSlotPicker.vue` still resolves against the raw (hidden-inclusive) song list, and the new tag-filter popover uses CSS positioning that can be clipped when nested inside the picker's own scrollable dropdown. Neither is a security issue; both are UI-correctness gaps worth a follow-up pass. Three low-severity/nit items are also noted, including one instance of the exact "hidden song leaks into a filter option list" bug class this phase just fixed for tags, still present for the Key filter.

## Warnings

### WR-01: AI Picks path bypasses the hidden-song exclusion the rest of the picker enforces

**File:** `src/components/SongSlotPicker.vue:300-308`
**Issue:** The comment above `visibleSongs` (lines 246-249) states hidden songs "must not surface anywhere in the picker — not as suggestions/search results, and not as tag options." `visibleSongs` is correctly used for `availableTags`, `tagFilteredSongs` (→ rotation `suggestions` and `searchResults`), but `resolvedAiSuggestions` still resolves against the raw `props.songs`:
```ts
const resolvedAiSuggestions = computed<{ song: Song; reason: string }[]>(() => {
  if (!props.aiSuggestions) return []
  return props.aiSuggestions
    .map((ai) => {
      const song = props.songs.find((s) => s.id === ai.songId)   // ← raw props.songs, not visibleSongs
      return song ? { song, reason: ai.reason } : null
    })
    .filter((item): item is { song: Song; reason: string } => item !== null)
})
```
In the normal path this is masked because `ServiceEditorView.vue` already filters hidden songs out of the AI request's `songLibrary` before calling `getSongSuggestions` (`D-18`). But `aiPerSlotResults`/`aiSongCache` are cached per `(sermonTopic, sermonPassage, slotVwType)` and are not invalidated when a song's `hidden` flag changes later. If a song referenced by a cached AI suggestion is hidden after the suggestion was fetched (e.g. another team member soft-deletes it mid-session), it will still render in the "AI Picks" section and remain selectable via `onSelect`, silently violating the invariant the surrounding code otherwise enforces.
**Fix:** Resolve against `visibleSongs.value` instead of `props.songs`, for defense-in-depth consistent with the rest of the component:
```ts
const song = visibleSongs.value.find((s) => s.id === ai.songId)
```

### WR-02: TagFilterChecklist popover can be clipped when opened inside SongSlotPicker's scrollable dropdown

**File:** `src/components/TagFilterChecklist.vue:21-24`, `src/components/SongSlotPicker.vue:35-58`
**Issue:** The popover panel is `position: absolute` relative to the component's own `.relative` wrapper:
```html
<div class="absolute z-40 mt-1 w-56 rounded-md bg-gray-800 border border-gray-700 shadow-xl p-2" :class="align === 'right' ? 'right-0' : 'left-0'">
```
Used from `SongFilters.vue` this is fine (no clipping ancestor). But in `SongSlotPicker.vue` the checklist is nested inside the sticky search bar, itself inside the Teleported dropdown panel that has `overflow-y-auto`:
```html
<div class="fixed z-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-[600px] overflow-y-auto" :style="dropdownStyle">
```
An `overflow: auto` ancestor clips absolutely-positioned descendants to its own box. The outer dropdown itself avoids being clipped by whatever contains *it* specifically by using `Teleport to="body"` + `position: fixed` computed from `getBoundingClientRect()` in `openDropdown()` — the nested tag popover doesn't get that treatment. When the outer panel's effective height is constrained (the "flip above" branch with small `spaceAbove`, or the "not enough room below" branch capped to `spaceBelow`; see `openDropdown()` lines 403-421), the popover's header + search input + up to `max-h-48` tag list (roughly ~280-300px, starting ~60-90px below the panel's top) can exceed the panel's clipped viewport and be cut off or forced into the panel's own scroll rather than floating freely as a popover should. Even in the unconstrained (`fitsBelow`) case the margin is fairly tight relative to the new 420px `minHeight` floor introduced in `fecef46`.
**Fix:** Teleport the popover panel to `body` and position it via `getBoundingClientRect()`, mirroring `openDropdown()`'s own approach — keeps the component consistent with the pattern already established in this file rather than introducing a second, weaker positioning strategy.

## Info

### IN-01: `availableKeys` in SongsView.vue still leaks hidden-song metadata into the Key filter

**File:** `src/views/SongsView.vue:207-215`
**Issue:** This diff fixed hidden-song leakage for the tag filter (`availableUserTags`, lines 217-228, now guards `if (song.hidden === true) return`) but the sibling `availableKeys` computed just above it was not updated and still iterates `songStore.songs` unfiltered:
```ts
const availableKeys = computed(() => {
  const keys = new Set<string>()
  songStore.songs.forEach((song) => {
    song.arrangements.forEach((arr) => {
      if (arr.key) keys.add(arr.key)
    })
  })
  return Array.from(keys).sort()
})
```
Since `filteredSongs` in the store already excludes hidden songs from matching (`songs.ts:41`), a key that only exists on a hidden song appears as a selectable "All keys" option that yields zero visible results — the same class of bug this phase's tag-list fix (commit `11c3760`) just addressed for tags. Not part of this diff's touched lines, so flagged as a follow-up rather than a regression, but directly analogous.
**Fix:** Mirror the same guard: `if (song.hidden === true) return` before collecting `arr.key`.

### IN-02: Local `tagQuery` filter text isn't reset when the popover closes (persists across reopens in the SongFilters.vue usage)

**File:** `src/components/TagFilterChecklist.vue:110-118`
**Issue:** `tagQuery` is local `ref('')` state, only reset implicitly if the whole component unmounts. In `SongSlotPicker.vue` the component is destroyed/recreated each time the picker opens/closes (parent uses `<template v-if="isOpen">`), so this is a non-issue there. In `SongFilters.vue`, however, `TagFilterChecklist` is always mounted (only the internal `open` flag toggles the panel), so a user's typed filter text from a previous session silently persists the next time they open the tag popover on the Songs page, which may be surprising.
**Fix:** Reset on close:
```ts
watch(open, (v) => { if (!v) tagQuery.value = '' })
```

### IN-03: Inconsistent naming — `availableUserTags` now contains team tags and themes, not just user tags

**File:** `src/views/SongsView.vue:217-228` vs `src/components/SongSlotPicker.vue:252-261`
**Issue:** As part of this diff, `SongsView.vue`'s `availableUserTags` computed was widened to union `teamTags ∪ themes ∪ tags` (previously just `song.tags`), but it kept the `availableUserTags` name (and prop name, threaded through `SongFilters.vue` → `TagFilterChecklist.vue`). The equivalent concept in `SongSlotPicker.vue` was correctly named generically as `availableTags` for the same union in the same commit. Purely a naming/readability nit — no functional bug — but worth aligning for future maintainers, since "user tags" now reads as misleading (it drives the same checklist that also filters by team tags and themes).
**Fix:** Optional rename (e.g. `availableTagOptions`) across the `SongsView.vue` → `SongFilters.vue` → `TagFilterChecklist.vue` prop chain, or at minimum a comment noting the union.

---

_Reviewed: 2026-07-02T21:52:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
