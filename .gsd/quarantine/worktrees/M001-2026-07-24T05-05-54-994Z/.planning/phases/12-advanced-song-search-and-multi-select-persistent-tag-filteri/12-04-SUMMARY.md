---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
plan: 04
subsystem: service-plan-song-picker
tags: [vue, tag-filter, ui-component, shared-state]
dependency_graph:
  requires:
    - "songStore.tagFilterChecked (Set<string>) — plan 12-02"
    - "songStore.tagFilterHide (boolean) — plan 12-02"
    - "songStore.clearTagFilter() — plan 12-02"
    - "src/components/TagFilterChecklist.vue (presentational shared component) — plan 12-03"
  provides:
    - "SongSlotPicker.vue consuming the same shared tag-filter store state as the Songs panel"
  affects:
    - "src/components/SongSlotPicker.vue"
tech-stack:
  added: []
  patterns:
    - "Reused presentational TagFilterChecklist.vue in a second surface (picker) bound directly to Pinia store refs, no local mirror state"
key-files:
  created: []
  modified:
    - src/components/SongSlotPicker.vue
decisions:
  - "Combined Task 1 (script: store wiring) and Task 2 (template: checklist mount) into a single commit — the two changes are structurally coupled (removing includeTag/excludeTag refs breaks the template's v-model bindings until the old <select>s are also removed), so splitting them would create an intermediate commit with a broken build. Both tasks' <action> content was implemented exactly as specified; only the commit granularity was merged to keep every commit buildable."
metrics:
  duration_minutes: 15
  completed: 2026-07-01
---

# Phase 12 Plan 04: Service-Plan Picker Shared Tag Filter Summary

Replaced `SongSlotPicker.vue`'s two local `includeTag`/`excludeTag` `<select>` dropdowns and their single-value filter logic with the shared `TagFilterChecklist.vue` component bound directly to the Pinia `songStore`'s `tagFilterChecked`/`tagFilterHide`/`clearTagFilter()` state (introduced in Plans 12-02/12-03). The picker's search box already called `songMatchesQuery`, so it inherits Plan 12-01's field-scoped/AND search engine automatically with no changes needed here.

## What Was Built

**Store wiring (script):**
- Imported `useSongStore` and `TagFilterChecklist` into `SongSlotPicker.vue`; added `const songStore = useSongStore()`.
- Removed the local `includeTag`/`excludeTag` refs entirely.
- Kept the existing `availableTags` computed (distinct sorted `Song.tags` from `props.songs`) — now feeds the shared checklist's `availableUserTags` prop.
- Reworked `tagFilteredSongs` to read `songStore.tagFilterChecked`/`songStore.tagFilterHide` and apply the same OR-in-show / exclude-in-hide semantics as the store's own `filteredSongs` (D-09/D-10): a song matches if it carries ANY checked tag in show mode, or does NOT carry any checked tag in hide mode.
- Updated the load-more reset watches: removed `watch(includeTag, ...)`/`watch(excludeTag, ...)`, added `watch(() => songStore.tagFilterChecked, ..., { deep: true })` and `watch(() => songStore.tagFilterHide, ...)` so infinite-scroll batching still resets to `BATCH_SIZE` whenever the shared tag filter changes.
- `searchResults` and the IntersectionObserver load-more machinery were left untouched — `searchResults` already calls `songMatchesQuery`, inheriting Plan 12-01's engine upgrade for free (D-07).

**Sticky bar template:**
- Removed the two `<select>` blocks (`Show all tags` / `Hide: {{ tag }}` options).
- Mounted `<TagFilterChecklist :availableUserTags="availableTags" :checkedTags="songStore.tagFilterChecked" :hide="songStore.tagFilterHide" @update:checkedTags="songStore.tagFilterChecked = $event" @update:hide="songStore.tagFilterHide = $event" @clear="songStore.clearTagFilter()" />` in their place.
- Kept the sticky container classes exactly as `sticky top-0 z-10 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5` (established by quick-task 260701-awp) — no added wrappers or padding.
- Kept the search input's placeholder (`Search songs...`) and classes unchanged; added a `title="Filter by field: tag: key: type: theme: team:"` attribute (no height/class change) to surface the field-scoped search syntax on hover.

## Verification

- `npm run type-check` — exits 0
- `npm run build-only` — exits 0 (production build succeeds)
- `grep -n "includeTag\|excludeTag" src/components/SongSlotPicker.vue` — no matches
- `grep -n "Show all tags\|Hide no tags" src/components/SongSlotPicker.vue` — no matches
- `src/components/SongSlotPicker.vue` imports and instantiates `useSongStore` and imports/mounts `TagFilterChecklist`
- `tagFilteredSongs` references `songStore.tagFilterChecked`/`songStore.tagFilterHide` with `hide ? !carriesChecked : carriesChecked`
- Load-more reset watches reference `songStore.tagFilterChecked` (deep) and `songStore.tagFilterHide`, not `includeTag`/`excludeTag`
- Sticky container still uses `sticky top-0 z-10 bg-gray-800 border-b border-gray-700 p-2 space-y-1.5`
- Search input placeholder `Search songs...` unchanged
- `npx vitest run src/stores/__tests__/songs.test.ts` — 56/56 passing (no regressions in the store this plan consumes)

## Deviations from Plan

### Commit granularity (not a Rule 1-4 deviation)

**Combined Task 1 + Task 2 into one commit.** The plan specified two separate commits (`feat(12-04): picker consumes shared tag-filter state` then `feat(12-04): mount shared TagFilterChecklist in picker sticky bar`), but the two changes are structurally coupled within the same file: Task 1 removes the `includeTag`/`excludeTag` refs from the script, which are still referenced by the two `<select>` `v-model`s in the template until Task 2 removes them. Committing Task 1 alone would leave a commit with a broken `type-check` (verified: 2 `TS2339` errors on `includeTag`/`excludeTag` not existing). To keep every commit in the history buildable and type-clean (a hard requirement of this project's workflow), both edits were applied together and committed as a single atomic commit: `feat(12-04): picker consumes shared tag-filter state and mounts shared TagFilterChecklist`. All content specified in both tasks' `<action>` blocks was implemented exactly as written — only the commit boundary changed.

No Rule 1-4 auto-fixes were needed; no architectural changes were made.

## Known Stubs

None — the picker's tag filter is fully wired to live Pinia store state; no placeholder data or empty stub renders were introduced.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Tag labels in the checklist render via the already-audited `TagFilterChecklist.vue` (Vue text interpolation, auto-escaped, no `v-html`), per T-12-11's `mitigate` disposition, inherited unchanged from Plan 12-03. The cross-surface shared-state coupling between picker and Songs panel (T-12-10) is the explicit, accepted design outcome of D-14 and was not introduced by this plan's implementation.

## Self-Check: PASSED

- FOUND: src/components/SongSlotPicker.vue (modified, verified via Read + grep)
- FOUND commit 2947b59 (feat(12-04): picker consumes shared tag-filter state and mounts shared TagFilterChecklist)
