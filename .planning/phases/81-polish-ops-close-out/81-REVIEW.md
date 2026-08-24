---
phase: 81-polish-ops-close-out
reviewed: 2026-08-24T12:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/components/admin/ConfigurationTab.vue
  - src/components/admin/__tests__/ConfigurationTab.test.ts
  - src/components/admin/OrganizationsTab.vue
  - src/components/admin/__tests__/OrganizationsTab.test.ts
  - src/components/admin/ConfigTextField.vue
  - src/components/admin/__tests__/ConfigTextField.test.ts
  - src/views/OwnerConsoleView.vue
  - src/views/__tests__/OwnerConsoleView.test.ts
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/utils/songSearch.ts
  - src/utils/__tests__/songSearch.test.ts
  - src/components/SongBrowser.vue
  - src/components/__tests__/SongBrowser.test.ts
  - src/components/SongFilters.vue
  - src/components/SongTable.vue
  - src/stores/songs.ts
  - src/views/SongsView.vue
  - src/views/__tests__/SongsView.test.ts
  - src/components/SongSlotPicker.vue
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 81: Code Review Report

**Reviewed:** 2026-08-24T12:00:00Z
**Depth:** standard
**Files Reviewed:** 17 source files (+ their test files)
**Status:** issues_found

## Summary

Reviewed 81-02 (a11y labels), 81-03 (ARIA tab semantics), and 81-04 (R240 `filterSongsByTags` extraction + `SongBrowser.vue` wrapper) commits. 81-01 was docs/verification only and was skipped per scope.

The R240 refactor's core correctness claim holds up: `filterSongsByTags()` in `src/utils/songSearch.ts:142-161` reproduces the old include/exclude semantics exactly (exclude wins, include OR-combines across themes+tags, both-empty is a no-op, undefined themes/tags treated as `[]`), and both real call sites (`stores/songs.ts:81`, `SongSlotPicker.vue:275-277`) delegate to it with the same inputs their pre-refactor inline copies used. `stores/songs.ts`'s `filteredSongs` still applies search → VW type → key, then tags, in the same order, and `.filter()` preserves ordering as claimed. The Songs page header count still reads `songStore.filteredSongs.length` (`SongsView.vue:19`), not a lower-fidelity SongBrowser-side value. `SongSlotPicker.vue`'s AI-Picks/By-Rotation/Search-Results rows, the `IntersectionObserver` load-more wiring, and `focusSearch()`-based autofocus are all preserved. The 81-02 label/aria-label changes correctly avoid duplicate ids (per-row input uses `aria-label`, not a static `id`/`for` pair) and `ConfigTextField`'s `useId()` correctly produces distinct per-instance ids. All 8 directly-affected test files pass (458 tests), and `npm run type-check` (the `vue-tsc --build` form, not the narrower `-p tsconfig.app.json`) is clean.

Two things pulled it out of "clean": the 81-03 ARIA tab strips add roving `tabindex="-1"` to inactive tabs without any arrow-key handler to compensate, which removes the inactive tab from the keyboard Tab order entirely and was previously reachable; and the highest-risk 81-04 consumer, `SongSlotPicker.vue`, ships with zero automated test coverage — the commit message explicitly says a verification test was written, run, and then deleted rather than committed. Neither is a correctness regression in the filtering logic itself, but both are real, provable gaps.

## Warnings

### WR-01: Roving tabindex on ARIA tab strips makes the inactive tab keyboard-unreachable

**File:** `src/views/OwnerConsoleView.vue:12,19` and `src/views/ServiceEditorView.vue:698,720,735,754`
**Issue:** Both tab strips add `:tabindex="activeTab === '<tab>' ? 0 : -1"` (roving tabindex) as part of the WAI-ARIA APG Tabs pattern, per `81-03-PLAN.md`'s explicit instruction to add it while deliberately deferring arrow-key navigation ("do NOT add arrow-key roving-tabindex JS handlers... keep scope tight"). No `@keydown` handler for `ArrowLeft`/`ArrowRight`/`Home`/`End` exists anywhere in either file (confirmed via `grep -n "keydown\|Arrow" src/views/OwnerConsoleView.vue src/views/ServiceEditorView.vue` — the only `keydown` listener in `ServiceEditorView.vue` is an unrelated undo-key handler). Before this phase, the tab buttons had no `tabindex` attribute at all, so both were plain `<button>`s in the default Tab order (Tab-key reachable). After this phase, a button with `tabindex="-1"` is removed from the sequential Tab order and has no other keyboard path to reach it — a keyboard-only user (no mouse, no arrow-key support implemented) who lands on the Owner Console with Organizations active, or on any Service Editor tab other than the first, cannot Tab their way to the other tabs at all. Roving tabindex without arrow-key support is a known WAI-ARIA APG anti-pattern (worse than doing nothing, since it actively removes elements from the accessibility tree's operable set). This was a tracked, deliberate scope cut (RESEARCH pitfall, `T-81-03-03` disposition "mitigate" only covers `aria-selected` desync, not this), not an accident — but it is a genuine keyboard-accessibility regression that ships as part of the a11y-focused phase and has no test coverage catching it (no test asserts keyboard reachability, only `aria-selected`/`role`/`aria-controls` values).
**Fix:** Either (a) drop the roving `tabindex` binding and let every tab button keep its default (implicit `tabindex=0`) focusability — this is still APG-compliant for a small, static tab set and requires no JS — or (b) keep roving tabindex and add the deferred arrow-key handler (`ArrowLeft`/`ArrowRight` moves focus + calls `setTab`/`activeTab = ...` on the adjacent tab, `Home`/`End` jump to first/last). Given the scope was already cut once, (a) is the lower-risk fix:
```html
<!-- OwnerConsoleView.vue / ServiceEditorView.vue -->
<button
  id="owner-tab-configuration"
  role="tab"
  type="button"
  :aria-selected="activeTab === 'configuration'"
  aria-controls="owner-panel-configuration"
  <!-- remove :tabindex — let it default to 0, matching pre-phase focusability -->
  ...
>
```

### WR-02: SongSlotPicker.vue — the riskiest R240 consumer — has zero automated test coverage

**File:** `src/components/SongSlotPicker.vue` (no corresponding test file anywhere in the repo)
**Issue:** `find src -iname "*songslotpicker*"` returns only the component itself. `ServiceEditorView.test.ts` — the only suite that mounts a tree containing `SongSlotPicker` — stubs it out entirely (`SongSlotPicker: true` at 20+ mount sites), so it provides no coverage of the component's internals. The 9bbfe3eb commit message states: *"Verified end-to-end at runtime with a throwaway sanity mount (dropdown open, rotation suggestions render, search narrows results, selection emits) before removing the scratch test."* That verification was real but is not repeatable — nothing in CI protects the picker's AI-Picks/By-Rotation/Search-Results rendering, the `tagFilteredSongs` → `filterSongsByTags()` wiring, the `IntersectionObserver` load-more (`visibleCount`/`hasMore`/`loadMore`), or the `focusSearch()`-based autofocus against a future regression in `SongBrowser.vue` or `songSearch.ts`. This is the component the review's own focus section calls out as highest risk, and it is the one 81-04 file with no regression test at all (compare to `SongBrowser.test.ts` and the updated `SongsView.test.ts`, both of which do have coverage of their respective wiring).
**Fix:** Add `src/components/__tests__/SongSlotPicker.test.ts` covering at minimum: dropdown open renders AI-Picks/By-Rotation rows when `!searchQuery`; typing in the search box switches to Search Results and calls `songMatchesQuery`-based filtering; tag include/exclude narrows the AI/rotation/search lists via the shared `tagFilteredSongs`; `openDropdown()` triggers `focusSearch()` on the `SongBrowser` ref; and the `IntersectionObserver` sentinel firing calls `loadMore()` when `hasMore` is true.

### WR-03: `SongBrowser.vue`'s exposed `filteredSongs` scoped-slot prop is never consumed by either production consumer

**File:** `src/components/SongBrowser.vue:141-143` (computed), `src/views/SongsView.vue:83` (`<template #default>`, no destructure), `src/components/SongSlotPicker.vue:53` (`<template #default>`, no destructure)
**Issue:** `SongBrowser`'s `filteredSongs` computed (`filterSongsByTags(props.songs, props.includeTags, props.excludeTags)`) is bound into the default scoped slot (`<slot :filteredSongs="filteredSongs" ... />`), but neither `SongsView.vue` nor `SongSlotPicker.vue` destructures or reads it — `SongsView.vue` renders `SongTable :songs="songStore.filteredSongs"` (the store's own independently-computed value) and `SongSlotPicker.vue` uses its own script-level `tagFilteredSongs` computed for the same reason (documented: the `IntersectionObserver` machinery needs synchronous script access outside the slot/render context). The result is a `filteredSongs` computed that recomputes on every relevant re-render (Vue evaluates all bound slot props on render regardless of whether the consumer destructures them) purely to serve `SongBrowser.test.ts`'s direct-mount tests — it has no production caller. This isn't a correctness bug (the three parallel computations are all provably equivalent per the accompanying code comments), but it slightly undercuts the "one shared source of truth" framing of the refactor: there are still three independent invocations of `filterSongsByTags()` at runtime (`SongBrowser`'s own, the store's, and the picker's), one of which produces a value nothing uses.
**Fix:** Either have `SongsView.vue`/`SongSlotPicker.vue` actually consume the slot's `filteredSongs` (removing the parallel computed in the store/picker) where feasible, or drop the unused slot prop and document that `SongBrowser` is intentionally search/tag-input-only for consumers with special filtering needs (leave `filterSongsByTags` as the shared primitive, not the scoped-slot value).

## Info

### IN-01: `SongBrowser.vue`'s search input has no accessible label, unaddressed by the phase's own a11y pass

**File:** `src/components/SongBrowser.vue:21-28`
**Issue:** The `<input type="text" ref="searchInputRef" ...>` has a `placeholder` but no `<label>`, `aria-label`, or `aria-labelledby`. This isn't a regression — neither the pre-refactor `SongFilters.vue` search input nor the pre-refactor `SongSlotPicker.vue` search input had one either (confirmed via `git show <parent>:...` diffs) — but 81-02 in this same phase specifically added `aria-label`/`<label for>` to other text inputs across the admin surface, and this search input (now shared across two pages) remains unlabeled.
**Fix:** Add `aria-label="Search songs"` (or a placeholder-matching value) to the `<input>` in `SongBrowser.vue`, benefiting both consumers with one change.

### IN-02: `SongBrowser.vue` two root nodes plus an always-truthy but frequently-empty `#filters` wrapper

**File:** `src/components/SongBrowser.vue:1,3,58-61,68-74,155`
**Issue:** Minor code-smell only: the search-input wrapper always renders `<div :class="layout === 'inline' ? 'flex-1' : ''">`, producing a stray empty `class=""` attribute in `layout="stacked"` mode (`SongSlotPicker.vue`'s usage). Cosmetic; no functional effect.
**Fix:** `:class="layout === 'inline' ? 'flex-1' : undefined"` to omit the attribute entirely when unused.

---

_Reviewed: 2026-08-24T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
