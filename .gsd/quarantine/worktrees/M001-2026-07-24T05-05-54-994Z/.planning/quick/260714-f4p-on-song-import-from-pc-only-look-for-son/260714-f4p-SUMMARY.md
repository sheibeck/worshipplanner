---
quick_id: 260714-f4p
status: complete
date: 2026-07-14
---

# Quick Task 260714-f4p: Import new songs only (PC import)

**Task:** On song import from PC, only look for songs that have not been imported yet — skip already-imported songs. Add an "Import new songs only" checkbox on the import screen.

## Outcome

Complete. 2/2 tasks executed, tests green, no type errors.

## What changed

### Task 1 — Export `partitionPcSongs` matching helper (`fed36d8`)
- Added exported `partitionPcSongs()` to `src/utils/pcSongImport.ts`, centralizing the "already imported" determination that was previously duplicated across the modal's internal `classifySongs` and `importFromPc`.
- Matching key (a mapped PC song is treated as already-imported if ANY match):
  - `pcSongId` matches an existing library song, OR
  - non-empty `ccliNumber` matches, OR
  - lowercased `title` matches an existing song's title.
- Added 8 unit tests in `src/utils/__tests__/pcSongImport.test.ts` (42/42 in file pass).

### Task 2 — Wire the checkbox (`d3ceb87`)
- Added "Import new songs only" checkbox to `src/components/PcImportModal.vue`, bound to `newOnly` ref, **checked by default** (`const newOnly = ref(true)`).
- When on: preview reads "Existing songs skipped", confirm upserts only new songs, done summary counts only added songs.
- When off: restores prior behavior (add new + update existing) — nothing silently lost.
- Removed the now-redundant internal `classifySongs` in favor of the shared helper.

## Verification

- `npx vitest run src/utils/__tests__/pcSongImport.test.ts` → **42/42 passed**
- `npx vue-tsc --build --force` → **0 errors** (none referencing PcImportModal)

## Commits

- `fed36d8` feat(quick-260714-f4p-01): export partitionPcSongs matching helper with tests
- `d3ceb87` feat(quick-260714-f4p-01): wire Import new songs only checkbox into PcImportModal

## Files

- `src/utils/pcSongImport.ts` — added exported `partitionPcSongs()`
- `src/utils/__tests__/pcSongImport.test.ts` — 8 new unit tests
- `src/components/PcImportModal.vue` — checkbox wired, `classifySongs` removed

## Notes

- Defaulting the checkbox to **on** changes the default import behavior from "update existing + add new" to "add new only", matching the request's intent to skip already-imported songs. Flip `newOnly` to `false` in `PcImportModal.vue` if opt-in-to-skip is preferred instead.
- SUMMARY.md was reconstructed by the orchestrator after the executor's worktree was removed before rescue; content verified against the merged code and passing tests.
