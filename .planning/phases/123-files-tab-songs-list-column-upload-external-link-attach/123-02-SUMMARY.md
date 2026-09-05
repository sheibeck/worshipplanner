---
phase: 123-files-tab-songs-list-column-upload-external-link-attach
plan: 02
subsystem: ui
tags: [vue, songtable, column-visibility, pinia]

requires:
  - phase: 122-song-attachment-foundation
    provides: SongAttachment type, attachments? field on Song
provides:
  - Songs-list toggleable Files column (paperclip + none/1 file/N files)
  - files:true key in songs store DEFAULT_COLUMN_VISIBILITY + cog-menu entry
affects: [123-03-files-tab-ui, 124-attachment-actions]

tech-stack:
  added: []
  patterns:
    - "Per-row plain-text derived-count column following the exact th/td/toggleableColumns idiom already used by category/key/ccli/lastUsed/tags/themes"

key-files:
  created: []
  modified:
    - src/stores/songs.ts
    - src/components/SongTable.vue
    - src/components/__tests__/SongTable.test.ts
    - src/stores/__tests__/songs.test.ts

key-decisions:
  - "filesLabel(song) extracted as a small helper function (not an inline triple-ternary) computing none/1 file/N files from song.attachments?.length ?? 0"
  - "Sourced the paperclip glyph d-path from Heroicons v2 outline per the UI-SPEC's explicit 'do not hand-approximate' instruction"

patterns-established: []

requirements-completed: [R362]

coverage:
  - id: D1
    description: "Songs-list Files column renders paperclip + none/1 file/N files, gated on columnVisibility.files, last before the chevron"
    requirement: "R362"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#Files column (R362) > renders the Files header when columnVisibility.files is true"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#Files column (R362) > does not render the Files header or cells when columnVisibility.files is false"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#Files column (R362) > renders 'none' for a song with an empty attachments array"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#Files column (R362) > renders 'none' without throwing for a legacy song with no attachments field"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#Files column (R362) > renders '1 file' for a song with exactly one attachment"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#Files column (R362) > renders 'N files' for a song with two or more attachments"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cog menu includes a Files checkbox that toggles visibility via toggleColumn('files'), defaulting visible"
    requirement: "R362"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#Files column (R362) > includes a Files checkbox in the cog menu that calls toggleColumn on change"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/songs.test.ts#useSongStore > column visibility (D-08/D-09/D-10) > defaults all seven toggleable columns to visible, with no title key"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-05
status: complete
---

# Phase 123 Plan 02: Songs-list Files Column Summary

**Toggleable Files column in `SongTable.vue` — paperclip glyph + plain-text `none`/`1 file`/`N files` derived from `song.attachments?.length`, positioned last before the row chevron and wired into the existing column-visibility cog/store preference.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-05
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments
- Added `files: true` to `DEFAULT_COLUMN_VISIBILITY` in `src/stores/songs.ts` — the existing generic `toggleColumn`/`resetColumns`/`persistColumnVisibility`/`hydrateColumnVisibility` machinery and the hydrate merge (`{ ...DEFAULT_COLUMN_VISIBILITY, ...parsed }`) required no additional store code, so an older saved localStorage payload predating this key still defaults the column visible.
- Added the Files `th`/`td` to `SongTable.vue` as the last data column before the trailing chevron, exactly matching the existing toggleable-column idiom (`v-if="songStore.columnVisibility.files"`).
- Rendered a hand-inlined Heroicons v2 outline `paperclip` SVG (`h-4 w-4 text-gray-500`) beside plain `text-sm` copy — explicitly not a pill/badge, per the UI-SPEC (the pill treatment is reserved for the Files-tab count badge in plan 123-03).
- Added a `filesLabel(song)` helper computing `none` (0) / `1 file` (1) / `N files` (2+) from `song.attachments?.length ?? 0`, safe for legacy songs where `attachments` is `undefined`.
- Added `{ key: 'files', label: 'Files' }` to `toggleableColumns` so the cog-menu checkbox renders via the existing `v-for` with zero additional markup.
- Extended `SongTable.test.ts` with 6 new tests (RED confirmed before implementation, then GREEN) covering header/cell gating both ways, the `none`/`1 file`/`N files` copy variants, the legacy no-attachments case, and the cog-toggle wiring.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add files column key to the store preference (R362)** - `c7f15ef1` (feat)
2. **Task 2: Files column th/td + cog toggle in SongTable (R362)** - `b936f4e4` (feat, includes RED→GREEN test additions and the songs.test.ts fix as one commit — see Deviations)

**Plan metadata:** committed alongside this SUMMARY (see final commit hash in orchestrator output).

_Note: Task 2 was `tdd="true"`; the plan's RED/GREEN cycle was run manually (tests written and confirmed failing via `npx vitest run` before the implementation edit), then squashed into a single commit alongside the pre-existing test fix rather than split into separate `test(...)`/`feat(...)` commits, since both changes land in the same files and the plan's atomic-commit-per-task instruction takes precedence over the general TDD multi-commit convention here._

## Files Created/Modified
- `src/stores/songs.ts` - `files: true` added to `DEFAULT_COLUMN_VISIBILITY`
- `src/components/SongTable.vue` - Files `th`/`td` (paperclip + `filesLabel()` copy), `{ key: 'files', label: 'Files' }` added to `toggleableColumns`
- `src/components/__tests__/SongTable.test.ts` - 6 new tests under `describe('Files column (R362)')`, plus `files: true` added to the mock `columnVisibility` fixture
- `src/stores/__tests__/songs.test.ts` - 4 pre-existing tests updated (see Deviations)

## Decisions Made
- `filesLabel(song)` is a plain function (not a per-row computed) since it's a cheap synchronous derivation off already-subscribed data with no memoization benefit, matching the codebase's existing `getPrimaryKey`/`formatDate` helper pattern used inline in the template.
- Sourced the paperclip `d`-path from Heroicons v2 outline as instructed (`M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13`) rather than approximating.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 4 pre-existing songs-store tests broken by the new default column key**
- **Found during:** Task 2 (after implementation, running the full `npx vitest run` gate)
- **Issue:** `src/stores/__tests__/songs.test.ts` had 4 tests asserting `store.columnVisibility` deep-equals a hard-coded six-key object (the pre-Task-1 default map). Task 1's addition of `files: true` to `DEFAULT_COLUMN_VISIBILITY` — required by this plan — made those exact-equality assertions fail, since the map now legitimately carries a seventh key.
- **Fix:** Added `files: true` to the expected object literal in all 4 tests (`defaults all six toggleable columns to visible...` → renamed to `...all seven...`, `resetColumns restores every key to true`, `resets to all-true when the saved payload is corrupt`, `resets to all-true when no saved key exists`).
- **Files modified:** `src/stores/__tests__/songs.test.ts`
- **Verification:** `npx vitest run src/stores/__tests__/songs.test.ts` — 99/99 pass.
- **Committed in:** `b936f4e4` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, direct consequence of the plan's own DEFAULT_COLUMN_VISIBILITY change)
**Impact on plan:** No scope creep — the fix only updates test expectations to match the plan's own intended store change.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Songs-list Files column is independent of and unaffected by plan 123-03 (Files tab UI) and 123-01 (upload composable/links, already executed) — no shared state beyond the `Song.attachments` field both already assume from Phase 122.
- Full gate results: `npm run type-check` clean; `npx vitest run` — 193/194 files pass, 5170/5205 tests pass (35 skipped), only `src/storage.rules.test.ts` fails, matching the documented Storage-emulator baseline in CLAUDE.md. No new baseline regressions introduced.
- No blockers.

---
*Phase: 123-files-tab-songs-list-column-upload-external-link-attach*
*Completed: 2026-09-05*

## Self-Check: PASSED

All modified files verified present on disk; both task commit hashes (c7f15ef1, b936f4e4) verified present in git history.
