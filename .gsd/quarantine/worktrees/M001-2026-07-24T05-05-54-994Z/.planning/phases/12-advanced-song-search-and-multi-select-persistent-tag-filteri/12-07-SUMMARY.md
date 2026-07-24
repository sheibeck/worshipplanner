---
phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri
plan: 07
subsystem: ui-tag-filter
tags: [vue, tag-filter, popover, ui-component, shared-state]
dependency_graph:
  requires:
    - "src/components/TagFilterChecklist.vue (presentational shared component) — plan 12-03"
    - "songStore.tagFilterChecked / tagFilterHide / clearTagFilter() — plan 12-02"
    - "songs.ts filteredSongs teamTags∪themes∪tags union pattern — plan 12-06"
  provides:
    - "TagFilterChecklist.vue as a fixed-height-trigger dropdown/popover (no longer an always-expanded inline list)"
    - "SongSlotPicker.vue tag list and filter widened to the teamTags∪themes∪tags union, matching the Songs panel"
  affects:
    - "src/components/TagFilterChecklist.vue"
    - "src/components/SongSlotPicker.vue"
tech-stack:
  added: []
  patterns:
    - "Popover trigger + backdrop-close pattern reused from SongSlotPicker's existing Teleport dropdown (fixed inset-0 z-30 backdrop under a higher-z panel)"
    - "Three-field tag union (teamTags ∪ themes ∪ tags) now applied consistently in both the Songs-panel store (12-06) and the picker component (12-07)"
key-files:
  created: []
  modified:
    - src/components/TagFilterChecklist.vue
    - src/components/SongSlotPicker.vue
decisions:
  - "Kept TagFilterChecklist.vue fully presentational — internal `open` ref only, no store import, prop/emit contract unchanged so both mounting surfaces (Songs panel, picker) inherit the popover for free"
  - "Left Clear tags action without a forced popover close, per plan's discretion note, so multi-select interactions (checkbox/hide toggle/clear) all keep the panel open until backdrop or trigger click"
metrics:
  duration_minutes: 8
  completed: 2026-07-02
---

# Phase 12 Plan 07: Tag Filter Popover + Picker Union Widening Summary

Converted the shared `TagFilterChecklist.vue` from an always-expanded inline list into a fixed-height-trigger dropdown/popover (closing the "filter header grows and grows" UAT-3 gap), and widened `SongSlotPicker.vue`'s tag list/filter to the `teamTags ∪ themes ∪ tags` union so the service-plan picker matches the Songs panel's filtering behavior (established in plan 12-06).

## What Was Built

**TagFilterChecklist.vue (popover conversion):**
- Added an internal `open = ref(false)` — no store import, presentational only.
- Replaced the always-rendered header+checklist with a fixed-height `<button>` trigger showing `Tags`, an appended count (`Tags (2)`) when `checkedTags.size > 0`, and a `(hiding)` caption visible on the trigger itself when `hide` is true (so inverted mode is visible even with the popover closed).
- Trigger uses the same control chrome as sibling filter selects: `rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500`, plus an inline chevron SVG.
- When open, renders a `fixed inset-0 z-30` transparent backdrop (reusing the existing SongSlotPicker close-on-outside-click pattern) beneath an `absolute z-40 mt-1 w-56` popover panel containing the Hide toggle, Clear action, and the `max-h-48 overflow-y-auto` checklist — all unchanged in behavior and visual tokens (checked row `border-pink-800 bg-pink-900/50 text-pink-300`, unchecked `border-gray-700 bg-gray-800 text-gray-300`, empty-state copy).
- Checkbox/hide-toggle interactions do not force-close the panel; only backdrop click or re-clicking the trigger closes it.
- `defineProps`/`defineEmits` signatures are byte-identical to before (`availableUserTags`, `checkedTags`, `hide` / `update:checkedTags`, `update:hide`, `clear`).

**SongSlotPicker.vue (union widening):**
- `availableTags` computed now collects from `song.teamTags`, `song.themes`, AND `song.tags` (previously `song.tags` only).
- `tagFilteredSongs`'s `carriesChecked` now checks `s.teamTags`, `s.themes`, AND `s.tags` against the checked set, mirroring `songs.ts`'s `filteredSongs` union logic from plan 12-06. The `checked.size === 0` short-circuit and `hide ? !carriesChecked : carriesChecked` semantics are unchanged.
- The `<TagFilterChecklist>` mount, sticky-bar classes, `searchResults`, IntersectionObserver load-more machinery, orchestra-first sort, and `isNonOrchestraSong` were left untouched (out of scope per the plan's scope guard).

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert TagFilterChecklist.vue into a fixed-height-trigger dropdown/popover** - `ad86a3e` (fix)
2. **Task 2: Widen the picker's tag list and filter to the three-field union** - `bae5162` (fix)

## Files Created/Modified
- `src/components/TagFilterChecklist.vue` - Converted to fixed-height trigger + popover panel; prop/emit contract unchanged
- `src/components/SongSlotPicker.vue` - `availableTags` and `tagFilteredSongs` widened to the teamTags∪themes∪tags union

## Verification

- `npm run type-check` — exits 0 (both tasks)
- `npm run build-only` — exits 0 (both tasks)
- `npx vitest run src/stores/__tests__/songs.test.ts` — 60/60 passing (no store regression; confirms picker's union logic mirrors the store's existing pattern)
- Manual code inspection: TagFilterChecklist.vue contains internal `open` ref, no `@/stores/songs` import, no `font-medium`, retains `border-pink-800 bg-pink-900/50 text-pink-300` and `focus:ring-indigo-500`; panel uses `max-h-48 overflow-y-auto`; backdrop uses `fixed inset-0 z-30`
- Manual code inspection: SongSlotPicker.vue `availableTags`/`tagFilteredSongs` reference all three fields; `<TagFilterChecklist>` mount, sticky-bar classes, and `isNonOrchestraSong`/orchestra sort unchanged

## Decisions Made

- TagFilterChecklist.vue stays fully presentational (Option A) — internal `open` state only, no store coupling, so both the Songs panel and the picker inherit the popover behavior automatically with zero call-site changes.
- Clear tags action does not force-close the popover (plan left this at implementer discretion) — keeps behavior consistent with checkbox/hide toggles which also stay open for continued multi-select.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT test 3 gap (filter header growing unbounded) is closed: the tag control is now a fixed-height popover on both surfaces.
- Picker and Songs panel now share identical three-field tag union filtering logic (teamTags ∪ themes ∪ tags).
- Ready for re-UAT verification per the plan's manual verification note: opening the tag control on both surfaces shows a popover, adding many tags does not grow the filter header, hide mode is visible on the closed trigger, and the picker filters by team tags, themes, and user tags.

## Known Stubs

None — both changes are fully wired; no placeholder data or empty stub renders were introduced.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Tag values continue to render via Vue text interpolation (auto-escaped, no `v-html`) in both the trigger label and the popover checklist rows, consistent with the plan's `mitigate` disposition for T-12-14. The popover's bounded `max-h-48 overflow-y-auto` scroll matches T-12-15's accepted disposition — render cost is unchanged from the prior inline list, now simply contained.

---
*Phase: 12-advanced-song-search-and-multi-select-persistent-tag-filteri*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: src/components/TagFilterChecklist.vue
- FOUND: src/components/SongSlotPicker.vue
- FOUND: .planning/phases/12-advanced-song-search-and-multi-select-persistent-tag-filteri/12-07-SUMMARY.md
- FOUND commit ad86a3e (fix(12-07): make TagFilterChecklist a fixed-height dropdown/popover so the filter header stops growing)
- FOUND commit bae5162 (fix(12-07): widen picker tag list and filter to teamTags∪themes∪tags union)
