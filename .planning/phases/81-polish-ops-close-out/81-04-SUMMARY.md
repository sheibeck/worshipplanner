---
phase: 81-polish-ops-close-out
plan: 04
subsystem: ui
tags: [vue3, pinia, refactor, song-browse, tag-filter]

# Dependency graph
requires:
  - phase: 81-polish-ops-close-out (plan 03)
    provides: ServiceEditorView song-tag-filter suite (regression net reused, not edited)
provides:
  - "filterSongsByTags(songs, include, exclude) — one pure tag include/exclude filter in src/utils/songSearch.ts, replacing two byte-for-byte-duplicated inline copies"
  - "SongBrowser.vue — a row-free shared search+tag shell (search input + TagFilterChecklist + filterSongsByTags-based filteredSongs computed) exposing a scoped default slot { filteredSongs, searchQuery } and a #filters slot"
  - "Songs page (SongsView.vue) browses through SongBrowser; SongFilters.vue reduced to VW-type/key selects"
  - "SongSlotPicker.vue browses through SongBrowser (layout=stacked); autofocus-on-open now goes through SongBrowser's exposed focusSearch()"
affects: [songs, service-editor, song-picker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared search+filter SHELL component with a scoped default slot for row markup, leaving two UX-incompatible row renderers (data table vs. AI/rotation dropdown) untouched (RESEARCH Pitfall 6)"
    - "layout prop ('inline' | 'stacked') switches a wrapper component's chrome/positioning without branching its data logic"

key-files:
  created:
    - src/components/SongBrowser.vue
    - src/components/__tests__/SongBrowser.test.ts
  modified:
    - src/utils/songSearch.ts
    - src/utils/__tests__/songSearch.test.ts
    - src/components/SongFilters.vue
    - src/views/SongsView.vue
    - src/views/__tests__/SongsView.test.ts
    - src/stores/songs.ts
    - src/components/SongSlotPicker.vue
    - src/components/SongTable.vue (comment-only)

key-decisions:
  - "Kept SongSlotPicker's tagFilteredSongs as a script-level computed (delegating to the shared filterSongsByTags()) rather than reading SongBrowser's slot-scoped filteredSongs directly, because the IntersectionObserver load-more machinery (hasMore/loadMore) runs outside the template's render/slot context and needs synchronous script access — both computeds call the exact same pure function with the exact same reactive inputs, so they are provably identical at every render."
  - "SongBrowser owns visual spacing (mb-4 in 'inline' layout, the sticky-bar classes in 'stacked' layout) since both were previously owned by the page/component wrapping the filter row — a reasonable presentational-chrome consolidation, not a behavior change."

patterns-established:
  - "Wrapper components that share a SHELL (not row markup) across UX-incompatible consumers via a scoped default slot + a named slot for consumer-specific controls."

requirements-completed: [R240]

coverage:
  - id: D1
    description: "filterSongsByTags(songs, include, exclude) extracted into songSearch.ts: empty-sets passthrough, exclude-by-theme, exclude-by-tag, exclude-wins-over-include, include-OR across themes+tags, undefined themes/tags safe"
    requirement: "R240"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songSearch.test.ts#filterSongsByTags (R240)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SongBrowser.vue: row-free shell (search input + TagFilterChecklist + filterSongsByTags-based filteredSongs computed), scoped default slot + #filters slot, focusSearch() exposed"
    requirement: "R240"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongBrowser.test.ts#SongBrowser (R240)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Songs page browses through SongBrowser (search + tag), VW-type/key selects preserved via #filters, SongTable rows unchanged and still fed by songStore.filteredSongs which now delegates its tag step to filterSongsByTags"
    requirement: "R240"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SongsView.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "SongSlotPicker.vue browses through SongBrowser (layout=stacked); AI-Picks/By-Rotation/Search-Results rows, IntersectionObserver load-more, and search autofocus-on-open all preserved exactly"
    requirement: "R240"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - song-tag filter (R230/R241)"
        status: pass
      - kind: other
        ref: "throwaway sanity mount (removed before commit): dropdown open, rotation suggestions render, search narrows results, selection emits — all confirmed at runtime"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-24
status: complete
---

# Phase 81 Plan 04: Shared Song-Browse Component (R240) Summary

**Extracted the duplicated tag include/exclude Set-intersection logic into `filterSongsByTags()` and built a real `SongBrowser.vue` shell (search + tag checklist + shared filtered-song computed) that now powers both the Songs page and the service-plan song picker, leaving both consumers' row markup untouched.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-24T11:06Z (approx., first tool call)
- **Completed:** 2026-08-24T11:28Z
- **Tasks:** 4/4
- **Files modified:** 9 (2 created, 7 modified, 1 of which comment-only)

## Accomplishments
- One pure `filterSongsByTags(songs, include, exclude)` in `src/utils/songSearch.ts`, replacing the two byte-for-byte-duplicated inline copies in `stores/songs.ts` and `SongSlotPicker.vue`
- A real `SongBrowser.vue` component — not just a shared util — owning the search input, `TagFilterChecklist`, and the shared `filteredSongs` computed, with a scoped default slot `{ filteredSongs, searchQuery }` and a named `#filters` slot
- The Songs page (`SongsView.vue`) now browses through `SongBrowser`; `SongFilters.vue` reduced to just the VW-type/key selects, rendered in the `#filters` slot
- `SongSlotPicker.vue` now browses through `SongBrowser` (`layout="stacked"`), with AI-Picks/By-Rotation/Search-Results rows, IntersectionObserver load-more, and search autofocus-on-open all preserved exactly
- `SongTable.vue`'s rows and the picker's AI/rotation/search rows were never touched (RESEARCH Pitfall 6 guardrail honored)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract filterSongsByTags into songSearch.ts with unit tests** - `3d8c4033` (feat)
2. **Task 2: Build the shared SongBrowser.vue wrapper + component test** - `2301bcba` (feat)
3. **Task 3: Wire SongBrowser into the Songs page + repoint the store's tag filter** - `90a5715b` (feat)
4. **Task 4: Wire SongBrowser into SongSlotPicker.vue** - `9bbfe3eb` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/utils/songSearch.ts` - added `filterSongsByTags()` export
- `src/utils/__tests__/songSearch.test.ts` - new `filterSongsByTags (R240)` describe block (6 tests)
- `src/components/SongBrowser.vue` - new shared search+tag shell component
- `src/components/__tests__/SongBrowser.test.ts` - new component test (8 tests)
- `src/components/SongFilters.vue` - reduced to VW-type + key selects only (search input + TagFilterChecklist removed, now owned by SongBrowser)
- `src/views/SongsView.vue` - `<SongFilters>` + `<SongTable>` blocks replaced with `<SongBrowser>` wrapping both via `#filters` and default slots
- `src/views/__tests__/SongsView.test.ts` - added a `SongBrowser` stub (slot passthrough) alongside the existing `SongFilters`/`SongTable` stubs
- `src/stores/songs.ts` - `filteredSongs`'s inline tag include/exclude block replaced with a final `filterSongsByTags(result, tagFilterInclude, tagFilterExclude)` pass
- `src/components/SongSlotPicker.vue` - sticky search+tag bar replaced with `<SongBrowser layout="stacked">`; `tagFilteredSongs` now delegates to `filterSongsByTags`; autofocus now calls the SongBrowser ref's `focusSearch()`
- `src/components/SongTable.vue` - comment-only update (stale reference to `SongFilters`' search input, now owned by `SongBrowser`)

## Decisions Made
- Kept `SongSlotPicker.vue`'s `tagFilteredSongs` as a script-level computed (delegating to the shared `filterSongsByTags()`) rather than literally destructuring `SongBrowser`'s scoped-slot `filteredSongs` value, because the picker's IntersectionObserver load-more bookkeeping (`hasMore`, `loadMore()`, `visibleCount` watchers) runs in script context outside the template's render/slot scope and needs synchronous, non-render-time access to the current tag-filtered pool. Both computeds call the exact same pure `filterSongsByTags` function with the exact same reactive inputs (`visibleSongs`/`songStore.tagFilterInclude`/`songStore.tagFilterExclude`), so they are provably identical at every render — this satisfies the "identical set" truth without a fragile render-time state-sync hack.
- `SongBrowser` owns the visual spacing/positioning that was previously split across its two consumers (`mb-4` under the inline filter row on the Songs page; the `sticky top-0 ... p-2 space-y-1.5` classes around the picker's search+tag bar) — a reasonable presentational-chrome consolidation since it's the shell's own row now, not a behavior change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a stale code comment in `SongTable.vue`**
- **Found during:** Task 3
- **Issue:** A comment on `filterByPill()` said `searchQuery is bound to SongFilters' input via SongsView's v-model`, which became inaccurate once the search input moved to `SongBrowser`.
- **Fix:** Updated the comment to reference `SongBrowser`'s search input (R240 note).
- **Files modified:** `src/components/SongTable.vue`
- **Verification:** Comment-only change; `SongTable.test.ts` still passes (18/18).
- **Committed in:** `90a5715b` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/doc-drift)
**Impact on plan:** Cosmetic comment fix caused directly by the task's own rename; no scope creep, no behavior change.

## Issues Encountered
None. The main design challenge — reconciling the plan's "sourced from the slot's filteredSongs" language with `SongSlotPicker`'s IntersectionObserver needing script-level synchronous access — was resolved via the script-level-mirror-computed approach documented above in Decisions Made, and confirmed correct with a throwaway runtime sanity mount (dropdown open → rotation suggestions render → search narrows to the matching song → selecting emits `select`) before the commit.

## User Setup Required
None - no external service configuration required. Client-only refactor, no deploy.

## Next Phase Readiness
- R240 delivered: one real shared `SongBrowser.vue` component (not just a util) powers both song-browse surfaces.
- All four Phase 81 plans (R237, R238, R239, R240) now complete.
- App suite verified at the documented 2-file known-failing baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) — unaffected by this plan's changes.

---
*Phase: 81-polish-ops-close-out*
*Completed: 2026-08-24*

## Self-Check: PASSED

All 10 created/modified files confirmed present on disk; all 4 task commits (`3d8c4033`, `2301bcba`, `90a5715b`, `9bbfe3eb`) confirmed in git log.
