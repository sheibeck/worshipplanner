---
phase: 11-song-catalog-service-planner-improvements
plan: "01"
subsystem: song-catalog-data-model
tags: [data-model, search, import, store, component, tdd]
dependency_graph:
  requires: []
  provides:
    - tags field on Song type (D-01)
    - full-field search covering tags/notes/key (D-05)
    - tag preservation across PC re-imports (D-02)
    - theme union merge on re-import (D-08)
    - legacy tags backfill to [] on subscribe (normalization)
    - filterTagInclude/filterTagExclude filter state (D-03)
    - TeamTagPill variant prop team/theme/user (D-06 foundation)
  affects:
    - src/types/song.ts (Song interface, UpsertSongInput)
    - src/stores/songs.ts (filteredSongs, upsertSongs, subscribe)
    - src/utils/songSearch.ts (songMatchesQuery)
    - src/utils/pcSongImport.ts (mapPcSongToUpsert)
    - src/utils/csvImport.ts (ParsedSongPreview, mapRowToSong)
    - src/components/TeamTagPill.vue (variant prop)
    - src/components/SongSlideOver.vue (FormState, save payload)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN for Task 1 (songSearch) and Task 2 (store)
    - Static Tailwind class map (purge-safe variants) in TeamTagPill
    - Import-preservation pattern (existing.tags ?? []) matching hidden field pattern
    - Set-based theme union (Array.from(new Set([...existing, ...incoming])))
    - Legacy field normalization in onSnapshot mapper (same pattern as vwTypes)
key_files:
  created: []
  modified:
    - src/types/song.ts
    - src/utils/songSearch.ts
    - src/utils/__tests__/songSearch.test.ts
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts
    - src/utils/pcSongImport.ts
    - src/utils/csvImport.ts
    - src/components/TeamTagPill.vue
    - src/components/SongSlideOver.vue
decisions:
  - "tags: string[] placed after hidden in Song interface (D-01); UpsertSongInput inherits via Omit automatically"
  - "Removed obsolete 'does NOT match keys' test — D-05 reverses this decision; key exact-match now included"
  - "csvImport.ts ParsedSongPreview and mapRowToSong required tags field to satisfy UpsertSongInput type (Rule 2 fix)"
  - "SongSlideOver.vue FormState gained tags field to satisfy UpsertSongInput type in addSong/updateSong calls (Rule 2 fix)"
  - "themes destructured out of restIncoming before spread so explicit union override takes effect correctly"
metrics:
  duration_minutes: 11
  completed_date: "2026-07-01"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 9
---

# Phase 11 Plan 01: Song Data Model Foundation Summary

**One-liner:** Added user-defined `tags: string[]` to Song type with full-field search (tags/notes/key), import-safe tag preservation + theme union merge, legacy doc backfill, include/exclude filter state, and a three-variant TeamTagPill component.

## Tasks Completed

| # | Name | Commit | Status |
|---|------|--------|--------|
| 1 | Add tags field to Song type and extend full-field search | a708e08 | Done |
| 2 | Preserve tags + merge themes on import, backfill legacy docs, add include/exclude filter state | 85c28bf | Done |
| 3 | Add variant prop to TeamTagPill for team/theme/user pill styles | 1f408d6 | Done |

## What Was Built

### Task 1 — Song type + search extension
- Added `tags: string[]` to `Song` interface immediately after `hidden: boolean` with inline D-01 comment
- `UpsertSongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>` automatically inherits `tags` — no separate declaration needed
- Extended `songMatchesQuery()` with three new checks: `song.tags?.some(...)`, `song.notes?.toLowerCase()`, and `song.arrangements.some(a => a.key.toLowerCase() === q)` (exact key match)
- Updated JSDoc to document new matched fields; removed sentence about key-exclusion
- Added `tags: []` to `makeSong()` factory in tests
- Added 3 new test cases: matches user tags (case-insensitive), matches notes, matches arrangement key exactly

### Task 2 — Store: tag preservation, theme merge, backfill, filter state
- `subscribe` mapper: added `if (!Array.isArray(data.tags)) data.tags = []` after vwTypes normalization
- `upsertSongs` existing branch: destructured `tags: _tags` and `themes: _themes` out of incoming before spread, then set `tags: existing.tags ?? []` and `themes: Array.from(new Set([...(existing.themes ?? []), ...(_themes ?? [])]))` 
- `upsertSongs` new-doc branch: added `tags: incoming.tags ?? []`
- Added `filterTagInclude` and `filterTagExclude` refs to filter state
- Added `matchesTagInclude` and `matchesTagExclude` predicates to `filteredSongs` computed
- Exported both new refs from store return block
- `pcSongImport.ts`: added `tags: []` to `mapPcSongToUpsert` return object

### Task 3 — TeamTagPill variant prop
- Added `variant?: 'team' | 'theme' | 'user'` prop with default `'team'`
- Static `variantClasses` const object (not dynamic concatenation — Tailwind v4 purge-safe)
- `team`: `bg-gray-800 text-gray-400 border-gray-700` (existing look, default)
- `theme`: `bg-teal-900/50 text-teal-300 border-teal-800` (PC-imported themes)
- `user`: `bg-pink-900/50 text-pink-300 border-pink-800` (user-defined tags)
- Colors visually distinct from SongBadge (blue/purple/amber)
- All existing call sites unaffected (default `'team'` variant)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed obsolete 'does NOT match arrangement keys' test**
- **Found during:** Task 1 GREEN phase
- **Issue:** The existing test `it('does NOT match arrangement keys...')` asserted `false` for key 'A', but D-05 reverses this decision — keys now ARE matched. The test was contradicting the new intended behavior.
- **Fix:** Removed the obsolete test; the new `it('matches arrangement key exactly...')` test covers the correct behavior
- **Files modified:** `src/utils/__tests__/songSearch.test.ts`
- **Commit:** a708e08

**2. [Rule 2 - Missing required field] Added tags to csvImport.ts ParsedSongPreview**
- **Found during:** Task 2, TypeScript check
- **Issue:** `ParsedSongPreview` in `csvImport.ts` was missing the `tags` field required by the extended `UpsertSongInput` type. `CsvImportModal.vue` strips `isDuplicate`/`_warnings` and passes the rest to `importSongs` which expects `SongInput` (alias of `UpsertSongInput`)
- **Fix:** Added `tags: string[]` to `ParsedSongPreview` interface and `tags: []` to `mapRowToSong` return
- **Files modified:** `src/utils/csvImport.ts`
- **Commit:** 85c28bf

**3. [Rule 2 - Missing required field] Added tags to SongSlideOver.vue FormState**
- **Found during:** Task 2, TypeScript check
- **Issue:** `SongSlideOver.vue` `FormState` interface was missing `tags`, causing a type error when passing the form data to `addSong`/`updateSong` (which accept `SongInput = Omit<Song, 'id' | 'createdAt' | 'updatedAt'>`)
- **Fix:** Added `tags: string[]` to `FormState`, `emptyForm()`, `songToForm()`, and the `data` save object. Tags flow through the editor correctly for downstream plans to wire the UI.
- **Files modified:** `src/components/SongSlideOver.vue`
- **Commit:** 85c28bf

## Verification

All verification criteria met:
- `npx vitest run src/utils/__tests__/songSearch.test.ts src/stores/__tests__/songs.test.ts src/utils/__tests__/pcSongImport.test.ts` — 97 tests passed
- `npx vue-tsc --noEmit -p tsconfig.app.json` — no errors
- `tags: string[]` in `src/types/song.ts` Song interface — confirmed
- `existing.tags` and `new Set(` in `src/stores/songs.ts` — confirmed
- `tags: []` in `src/utils/pcSongImport.ts` — confirmed
- `variantClasses` in `src/components/TeamTagPill.vue` — confirmed
- `filterTagInclude` and `filterTagExclude` exported from store — confirmed

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-11-01: Tampering via import clearing user tags | Mitigated — `tags: existing.tags ?? []` in upsertSongs existing branch; crafted/empty import payload cannot clear user tags |
| T-11-02: TeamTagPill renders via `{{ tag }}` (auto-escaped) | Accepted — no v-html introduced |
| T-11-03: PC import write path for tags | Accepted — `tags: []` hardcoded in import; import never sources tag values |

## Self-Check: PASSED

Files exist:
- `src/types/song.ts` — FOUND (tags field on line 40)
- `src/utils/songSearch.ts` — FOUND (song.tags, song.notes, a.key checks)
- `src/stores/songs.ts` — FOUND (filterTagInclude, filterTagExclude, existing.tags, new Set)
- `src/utils/pcSongImport.ts` — FOUND (tags: [])
- `src/components/TeamTagPill.vue` — FOUND (variantClasses, variant prop)

Commits exist:
- a708e08 — FOUND (Task 1: add tags field to Song type and extend full-field search)
- 85c28bf — FOUND (Task 2: preserve tags + merge themes on import, backfill legacy docs, add filter state)
- 1f408d6 — FOUND (Task 3: add variant prop to TeamTagPill for team/theme/user pill styles)
