---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
plan: 03
subsystem: songs-panel-ui
tags: [vue, tag-filter, ui-component, checklist]
dependency_graph:
  requires:
    - "songStore.tagFilterChecked (Set<string>) — plan 12-02"
    - "songStore.tagFilterHide (boolean) — plan 12-02"
    - "songStore.clearTagFilter() — plan 12-02"
  provides:
    - "src/components/TagFilterChecklist.vue (shared presentational component, consumable by picker in plan 12-04/12-05)"
    - "SongFilters.vue tagFilterChecked/tagFilterHide props + update:tagFilterChecked/update:tagFilterHide/clearTagFilter emits"
  affects:
    - "src/views/SongsView.vue (binds SongFilters to songStore tag-filter state)"
    - "song picker (plan 12-04/12-05 will reuse TagFilterChecklist.vue against the same store state)"
tech-stack:
  added: []
  patterns:
    - "Presentational v-model Vue SFC pattern (no store import) for cross-surface reuse (D-07/D-14)"
    - "Static Tailwind class map for checked/unchecked row state (avoids v4 purge of dynamic strings)"
key-files:
  created:
    - src/components/TagFilterChecklist.vue
  modified:
    - src/components/SongFilters.vue
    - src/views/SongsView.vue
decisions:
  - "TagFilterChecklist.vue is purely presentational — receives availableUserTags/checkedTags/hide as props and emits update:checkedTags/update:hide/clear, so it can be mounted identically in SongSlotPicker.vue in a later plan without any store coupling"
  - "Checked-row highlight and Hide-toggle-on caption both use literal (non-concatenated) Tailwind class strings per UI-SPEC's Tailwind v4 purge-safety requirement"
  - "'(hiding)' caption rendered next to the header only when hide is true, satisfying the UI-SPEC requirement that inverted mode stay legible even if the toggle checkbox scrolls out of view"
metrics:
  duration_minutes: 20
  completed: 2026-07-01
---

# Phase 12 Plan 03: Songs Panel Shared Tag Checklist Summary

Created the shared `TagFilterChecklist.vue` presentational component (checkbox list + Hide toggle + Clear action) and wired it into the Songs panel, replacing the two legacy `filterTagInclude`/`filterTagExclude` `<select>` dropdowns in `SongFilters.vue` with a single multi-select checklist bound to the Plan 12-02 store state (`tagFilterChecked`, `tagFilterHide`, `clearTagFilter()`).

## What Was Built

**Task 1 — `src/components/TagFilterChecklist.vue`:**
- New `<script setup lang="ts">` SFC taking `availableUserTags: string[]`, `checkedTags: Set<string>`, `hide: boolean` as props and emitting `update:checkedTags`, `update:hide`, `clear`.
- `toggleTag()` builds an immutable `new Set(props.checkedTags)` copy before mutating, so Vue's reactivity fires correctly on `update:checkedTags`.
- Header row: "Hide tags" checkbox + label (indigo-accented, `title="Invert: hide checked tags instead of showing only them"`), a `(hiding)` caption (`text-xs font-semibold text-indigo-300`) shown only when `hide` is true, and a "Clear tags" gray text link (`text-xs text-gray-500 hover:text-gray-300 transition-colors`, `title="Clear tag filter"`).
- Scrollable checklist (`max-h-48 overflow-y-auto`): one row per tag, `py-1` density, checkbox + label; checked rows use the static pink identity classes (`border-pink-800 bg-pink-900/50 text-pink-300`), unchecked use `border-gray-700 bg-gray-800 text-gray-300`; checkbox has `focus:ring-1 focus:ring-indigo-500`.
- Empty state (`availableUserTags.length === 0`): "No tags yet" heading + "Add tags to songs in the Songs panel to filter by them here." body, matching UI-SPEC copy exactly.
- Typography: only weight 400 (default) and 600 (`font-semibold` on the `(hiding)` caption) used — no `font-medium` anywhere in the file.
- Component does not import `@/stores/songs` — stays presentational so it can be reused by the picker surface in a later plan.

**Task 2 — Songs panel wiring:**
- `src/components/SongFilters.vue`: removed the two `focus:ring-pink-500` `<select>` blocks (`filterTagInclude`/`filterTagExclude`) and their corresponding props/emits; added `TagFilterChecklist` import and mount, bound via `:availableUserTags`, `:checkedTags="tagFilterChecked"`, `:hide="tagFilterHide"`, re-emitting `update:tagFilterChecked`, `update:tagFilterHide`, `clearTagFilter`. Search input and VW-type/Key/team-tag `<select>`s (D-06) left untouched — same placeholder text, same classes.
- `src/views/SongsView.vue`: replaced `v-model:filterTagInclude`/`v-model:filterTagExclude` bindings with `v-model:tagFilterChecked="songStore.tagFilterChecked"`, `v-model:tagFilterHide="songStore.tagFilterHide"`, and `@clearTagFilter="songStore.clearTagFilter()"`. `:availableUserTags` binding unchanged (computed already existed from before this plan).

## Verification

- `npm run type-check` — exits 0, full project (including the two lines in `SongsView.vue` flagged as a temporary cross-plan boundary in 12-02-SUMMARY.md are now resolved)
- `npm run build-only` — exits 0, production build succeeds (163 modules transformed)
- `grep -rn "filterTagInclude\|filterTagExclude" src/` — no matches anywhere in the codebase
- `src/components/SongFilters.vue` imports and mounts `TagFilterChecklist`, emits `update:tagFilterChecked`/`update:tagFilterHide`/`clearTagFilter`
- `src/components/SongFilters.vue` still contains `All types`, `All keys`, `All tags` (VW-type/Key/team-tag dropdowns retained per D-06)
- `src/views/SongsView.vue` binds `v-model:tagFilterChecked`, `v-model:tagFilterHide`, `@clearTagFilter="songStore.clearTagFilter()"`
- Search placeholder `Search title, CCLI, theme, tag, category...` unchanged
- `npx vitest run src/stores/__tests__/songs.test.ts` — 56/56 passing (no regressions in the store this plan consumes)

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>` blocks precisely; no Rule 1-4 fixes were needed.

## Known Stubs

None — both tasks are fully wired to live store state; no placeholder data or empty stub renders were introduced.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Tag labels render via Vue text interpolation (`{{ tag }}`), auto-escaped, matching the plan's threat model disposition (T-12-08, mitigated). The shared-state coupling between picker and panel (T-12-09) is an intentional accepted design per D-14, not introduced by this plan's implementation.

## Self-Check: PASSED

- FOUND: src/components/TagFilterChecklist.vue
- FOUND: src/components/SongFilters.vue (modified)
- FOUND: src/views/SongsView.vue (modified)
- FOUND commit 34151ce (feat(12-03): shared TagFilterChecklist component)
- FOUND commit c29e255 (feat(12-03): Songs panel uses shared TagFilterChecklist)
