---
phase: 123-files-tab-songs-list-column-upload-external-link-attach
fixed_at: 2026-09-05T19:07:21Z
review_path: .planning/phases/123-files-tab-songs-list-column-upload-external-link-attach/123-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 123: Code Review Fix Report

**Fixed at:** 2026-09-05T19:07:21Z
**Source review:** .planning/phases/123-files-tab-songs-list-column-upload-external-link-attach/123-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, plus 2 of the 4 optional Info items: IN-01, IN-04)
- Fixed: 5
- Skipped: 0 (IN-02 and IN-03 were explicitly out of scope per instructions — not attempted)

## Fixed Issues

### CR-01: Lost-update race when two attachment-adding operations overlap in time

**Files modified:** `src/stores/songs.ts`, `src/stores/__tests__/songs.test.ts`,
`src/composables/useSongFileUpload.ts`, `src/composables/__tests__/useSongFileUpload.test.ts`,
`src/components/SongFilesTab.vue`, `src/components/__tests__/SongFilesTab.test.ts`
**Commit:** `e2f1cf03`
**Applied fix:** Added a new atomic store method `addSongAttachment(id, attachment)` in
`src/stores/songs.ts` that writes `{ attachments: arrayUnion(attachment), updatedAt: serverTimestamp() }`
via `updateDoc` (imported `arrayUnion` from `firebase/firestore`). Routed both the upload-completion
handler in `useSongFileUpload.ts` and `submitLink()` in `SongFilesTab.vue` through this method instead
of the previous read-modify-write of the whole `attachments` array (`updateSong(id, { attachments:
[...existing, ...completed] })`). Removed the now-unnecessary `existingAttachments` field from
`AddFilesContext` and the batch-local `completed` accumulator in `addFiles()` — each completed file now
persists independently via its own `arrayUnion` call, so overlapping operations (a second batch dropped
mid-upload, or a link submitted while an upload is in flight) can no longer silently clobber each other.
Kept `Timestamp.now()` for the attachment's own `createdAt` field per the fix guidance (a `serverTimestamp()`
sentinel resolves to `null` inside an array element).

Updated tests: `songs.test.ts` gained an `addSongAttachment` describe block proving (a) the write uses the
mocked `arrayUnion` sentinel (not a plain array) alongside `serverTimestamp()` for `updatedAt`, and (b) two
overlapping `addSongAttachment` calls (via `Promise.all`) each land as independent `updateDoc`/`arrayUnion`
calls — the core regression-guard for CR-01. `useSongFileUpload.test.ts` and `SongFilesTab.test.ts` were
updated to spy on `addSongAttachment` instead of `updateSong`, to assert each completion call carries only
its own new attachment (not the full array), and the composable's `AddFilesContext` no longer includes
`existingAttachments`.

### WR-01: Client validation's OR logic lets a MIME/extension mismatch through

**Files modified:** `src/composables/useSongFileUpload.ts`, `src/composables/__tests__/useSongFileUpload.test.ts`
**Commit:** `001e4528`
**Applied fix:** Changed `validateSongFile()`'s type check from `!hasAllowedMime && !hasAllowedExt`
(rejects only when *both* disagree) to `!hasAllowedMime || !hasAllowedExt` (rejects when *either*
disagrees), mirroring `storage.rules`' strict `contentType in [...]` check. Added a test proving a file
with an allowed extension (`.pdf`) but a mismatched MIME type (`text/plain`) is now rejected client-side
with the UI-SPEC copy, rather than passing validation and later failing with the misleading generic
"check your connection" message.

### WR-02: Off-by-one boundary mismatch for a file of exactly 50MB

**Files modified:** `src/composables/useSongFileUpload.ts`, `src/composables/__tests__/useSongFileUpload.test.ts`
**Commit:** `394801de`
**Applied fix:** Changed the size check from `file.size > SONG_FILE_MAX_BYTES` to
`file.size >= SONG_FILE_MAX_BYTES`, matching `storage.rules`' strict `size < 52428800`. Added a test
proving a file of exactly `SONG_FILE_MAX_BYTES` (52428800) bytes is now rejected client-side with the
"too large" copy instead of passing validation and being denied server-side.

### IN-01 (optional, applied): Missing `aria-live` upload-completion announcement

**Files modified:** `src/components/SongFilesTab.vue`, `src/components/__tests__/SongFilesTab.test.ts`
**Commit:** `d2438167`
**Applied fix:** Added a visually-hidden (`sr-only`) `<p role="status" aria-live="polite">` region driven
by a new `uploadStatusAnnouncement` computed that reports `"{doneCount} of {total} files uploaded."`,
counting only rows that reached `'uploading'` or `'done'` (rejected rows already get their own
visible/read error text) and staying empty until at least one file in the current set has completed.
Added two tests covering the populated and empty-before-completion states.

### IN-04 (optional, applied): Undocumented `Timestamp.now()` vs `serverTimestamp()` choice

**Files modified:** `src/composables/useSongFileUpload.ts`, `src/utils/songLinks.ts`
**Commit:** `854b80eb`
**Applied fix:** Added the exact one-line comment suggested by the review at both `createdAt:
Timestamp.now()` call sites, explaining that the value lives inside the `attachments` array field and that
`serverTimestamp()` resolves to `null` inside arrays — so a future reviewer doesn't "fix" this to
`serverTimestamp()` and reintroduce that bug.

## Skipped Issues

None of the 5 in-scope findings were skipped. IN-02 (`buildLinkAttachment`'s unreachable fallback branch)
and IN-03 (`createdBy` could persist as an empty string on an auth-hydration race) were explicitly marked
optional-and-may-skip by the task instructions; neither was attempted, in line with "skip anything risky"
guidance — IN-02 would require either a speculative comment with limited value or a test exercising
private module internals, and IN-03 touches auth-hydration timing in `SongSlideOver.vue` which is outside
this phase's file set and carries more risk than the "cheap" bar set for optional items.

## Verification

- `npm run type-check` (`vue-tsc --build`, includes test files per project convention): clean, no errors,
  checked after every individual commit's edit as well as at the end.
- `npx vitest run` (bare, full app suite): 194/195 files passed, 5194 tests passed, 35 skipped. The single
  failing file is `src/storage.rules.test.ts` (Storage-emulator `ECONNREFUSED` — the documented baseline;
  not a regression, not touched by this fix set).
- Touched-suite runs (`useSongFileUpload.test.ts`, `SongFilesTab.test.ts`, `songs.test.ts`,
  `songFiles.test.ts`, `songLinks.test.ts`) were re-run green after each individual commit's changes, not
  just once at the end.

No finding in this batch was classified as a pure logic-condition change requiring the
"fixed: requires human verification" flag beyond normal review — WR-01/WR-02 are boundary-condition fixes
directly mirroring the existing, already-deployed `storage.rules` server-side checks (not new logic), and
CR-01 replaces a hand-rolled read-modify-write with Firestore's own `arrayUnion` primitive (well-established
pattern already used elsewhere in this codebase, e.g. `src/stores/auth.ts`'s `orgIds` append). All five are
marked `fixed` (not `fixed: requires human verification`).

---

_Fixed: 2026-09-05T19:07:21Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
