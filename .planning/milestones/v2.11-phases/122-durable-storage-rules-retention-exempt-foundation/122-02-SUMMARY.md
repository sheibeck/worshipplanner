---
phase: 122-durable-storage-rules-retention-exempt-foundation
plan: 02
subsystem: database
tags: [firebase-storage, firestore, cloud-functions, vitest, song-attachments]

# Dependency graph
requires:
  - phase: 122-01
    provides: "storage.rules song-files/ block + isOrgEditor Storage claim helper + rules-emulator tests"
provides:
  - "SongAttachment TypeScript schema (additive, optional Song.attachments?)"
  - "src/utils/songFiles.ts constants/path helper for the song-files/ Storage prefix"
  - "Locking test proving song-files/ is structurally exempt from all 4 retention sweeps (R370)"
  - "hardDeleteSong best-effort Storage cascade (R371)"
affects: [123-song-files-ui, 124-song-files-preview-play]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive optional Song field (mirrors Service.stageLayout pattern) — no migration for new schema fields"
    - "Storage cascade delete confined to the hard/permanent delete path only, never the soft delete"
    - "Best-effort try/catch loop for multi-object Storage deletes (mirrors cleanupSweeps.ts's partial-failure tolerance)"

key-files:
  created:
    - src/utils/songFiles.ts
    - src/utils/__tests__/songFiles.test.ts
  modified:
    - src/types/song.ts
    - functions/src/cleanupSweeps.ts
    - functions/src/index.test.ts
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts

key-decisions:
  - "SongAttachment fields follow 122-CONTEXT.md's locked field list exactly (id, kind, name, storagePath?, downloadUrl?, mimeType?, sizeBytes?, linkSource?, href?, createdAt, createdBy)."
  - "Retention-exemption test uses it.each over both a .pdf and .mp3 song-files path against all four existing guard imports — no new guard/sweep/export added, per the owner's permanence mandate."
  - "Storage cascade lives only in hardDeleteSong (gated on hidden===true), never in deleteSong (soft delete), so attachments survive a soft-delete/restore cycle."

patterns-established:
  - "songFiles.ts constants module mirrors useMediaUpload.ts's MEDIA_MAX_BYTES/sanitizeFileName precedent without importing from it (kept separate — useMediaUpload.ts is Phase 123 territory)."

requirements-completed: [R369, R370, R371]

coverage:
  - id: D1
    description: "Additive SongAttachment schema + song-files constants/path helper (SongAttachment/SongAttachmentKind/SongAttachmentLinkSource types, optional Song.attachments?, SONG_FILE_MAX_BYTES, SONG_FILE_ALLOWED_MIME, songFileStoragePath())"
    requirement: R369
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songFiles.test.ts — all 6 tests"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Locking test proving song-files/ paths (.pdf and .mp3) match none of MEDIA_PATH_GUARD/RENDERED_OBJECT_GUARD/BACKGROUND_PATH_GUARD/PPTX_SOURCE_GUARD, plus one-line exemption comments at each guard"
    requirement: R370
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — 'Song-files retention exemption (R370, Phase 122)' describe block (2 tests via it.each)"
        status: pass
      - kind: unit
        ref: "cd functions && npx vitest run — full 662-test functions suite green after the comment-only guard edits"
        status: pass
    human_judgment: false
  - id: D3
    description: "hardDeleteSong best-effort Storage cascade: deletes each upload attachment's storagePath before the Firestore doc delete, tolerates partial failure, skips link-kind attachments; deleteSong (soft) never touches attachments"
    requirement: R371
    verification:
      - kind: unit
        ref: "src/stores/__tests__/songs.test.ts — 'hardDeleteSong — Storage attachment cascade (R371)' describe block (4 tests)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-05
status: complete
---

# Phase 122 Plan 02: Durable Storage — SongAttachment Schema, Retention Lock, Deletion Cascade Summary

**Additive SongAttachment schema + songFiles.ts path helper, a locking test proving song-files/ is structurally exempt from all four retention sweeps, and a best-effort Storage cascade confined to hardDeleteSong.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-05T12:16:34-04:00
- **Completed:** 2026-09-05T12:29:20-04:00
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `SongAttachment`/`SongAttachmentKind`/`SongAttachmentLinkSource` types + optional `Song.attachments?` field — additive, no migration, legacy songs load unchanged.
- `src/utils/songFiles.ts` — `SONG_FILE_MAX_BYTES` (50MB), `SONG_FILE_ALLOWED_MIME` (PDF + MP3), and `songFileStoragePath()` producing `orgs/{orgId}/song-files/{id}/{sanitizedName}`, proven outside `media/`.
- A locking `it.each` test in `functions/src/index.test.ts` asserting a representative `.pdf` and `.mp3` song-files path matches none of the four existing sweep guards, plus a one-line comment-only exemption note beside each guard regex in `cleanupSweeps.ts`.
- `hardDeleteSong` now best-effort deletes every upload attachment's Storage object (tolerating partial failure) before the Firestore doc/lyrics delete; link-kind attachments are skipped; `deleteSong` (soft delete) is untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive SongAttachment schema + song-files constants/path helper (R369)** - `2f6769fa` (feat)
2. **Task 2: Lock the retention-sweep exemption for song-files/ (R370)** - `aa676631` (test)
3. **Task 3: Best-effort Storage cascade on hardDeleteSong (R371)** - `b98a062e` (feat)

_Note: all three tasks were marked `tdd="true"` in the plan; each was executed as a single commit per task (test file + implementation together) rather than separate RED/GREEN commits, since the plan's `type: execute` frontmatter (not `type: tdd`) does not require the strict plan-level RED/GREEN/REFACTOR gate sequence — behavior + test were verified together before each commit._

## Files Created/Modified
- `src/types/song.ts` - Added `SongAttachment`/`SongAttachmentKind`/`SongAttachmentLinkSource` + optional `Song.attachments?`
- `src/utils/songFiles.ts` - New: `SONG_FILE_MAX_BYTES`, `SONG_FILE_ALLOWED_MIME`, `songFileStoragePath()`
- `src/utils/__tests__/songFiles.test.ts` - New: 6 unit tests for the constants/helper
- `functions/src/cleanupSweeps.ts` - One-line R370 exemption comment beside each of the 4 guard regexes (comment-only)
- `functions/src/index.test.ts` - New `Song-files retention exemption (R370, Phase 122)` describe block
- `src/stores/songs.ts` - `hardDeleteSong` extended with a best-effort Storage cascade over `song.attachments`
- `src/stores/__tests__/songs.test.ts` - `firebase/storage` mock + `storage: {}` on the `@/firebase` mock; `attachments` override on `makeSong`; 4 new tests for the cascade

## Decisions Made
- Kept `sanitizeSongFileName` private and duplicated (not imported from `useMediaUpload.ts`) per the plan's explicit instruction — `useMediaUpload.ts` is Phase 123 territory.
- Used `it.each([SONG_FILE_PDF_PATH, SONG_FILE_MP3_PATH])` for the retention-exemption test rather than two separate `it()` blocks — equivalent coverage, less duplication.
- No changes to `deleteSong` (soft delete) — verified with a dedicated test that `deleteObject` is never called from it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- A type-check error surfaced in the new `songs.test.ts` cascade test: `vi.mocked(deleteObject).mock.calls.map((call) => (call[0] as { path: string }).path)` failed because the real `firebase/storage` `ref()` return type (`StorageReference`) doesn't overlap with the test's mocked shape `{ path: string }`. Fixed by casting through `unknown` first (`call[0] as unknown as { path: string }`), a standard TypeScript pattern for asserting a mock's return shape differs from the real type. Verified clean by rerunning `npm run type-check` and the store test suite.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `SongAttachment` schema is ready for Phase 123's upload/link UI to write into via `songStore.updateSong(id, { attachments })` (no new store method needed — rides through the existing `Partial<SongInput>` update path).
- `songFileStoragePath()` and the size/MIME constants are ready for Phase 123's upload composable to reuse.
- The R370 permanence invariant is locked — any future edit widening a sweep guard to reach `song-files/` will fail `functions/src/index.test.ts`'s new describe block.
- The R371 no-orphans guarantee (hardDeleteSong cascade) depends in production on Plan 122-01's `allow delete: if isOrgEditor(orgId)` Storage grant, already shipped in that plan's commit.
- No blockers for Phase 123.

## Gate Results

- **Type gate:** `npm run type-check` (vue-tsc --build) — clean, no errors.
- **App suite:** `npx vitest run` — 191/192 test files passed, 5140/5175 tests passed (35 skipped); the single failing file is `src/storage.rules.test.ts` (`ECONNREFUSED 127.0.0.1:9199` — no Storage emulator running), which is the documented CLAUDE.md baseline, not a regression. All new tests (`songFiles.test.ts`, extended `songs.test.ts`) pass.
- **Functions suite:** `cd functions && npx vitest run` — 18/18 test files, 662/662 tests passed, including the new retention-exemption describe block and all 4 pre-existing guard describe blocks.

---
*Phase: 122-durable-storage-rules-retention-exempt-foundation*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files found on disk; all 3 task commit hashes found in git log.
