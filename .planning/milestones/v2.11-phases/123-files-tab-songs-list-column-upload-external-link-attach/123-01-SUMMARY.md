---
phase: 123-files-tab-songs-list-column-upload-external-link-attach
plan: 01
subsystem: ui
tags: [firebase-storage, firestore, vue-composable, file-upload, resumable-upload]

requires:
  - phase: 122-song-attachment-foundation
    provides: SongAttachment type, attachments? field on Song, songFiles.ts constants/path helper, song-files/ storage.rules
provides:
  - useSongFileUpload composable — multi-file resumable upload with per-file progress/validation/persist
  - songLinks helpers — https link validation, source inference, buildLinkAttachment
  - Shared exported sanitizeFileName in songFiles.ts (Phase 122 code-review IN-03 closed)
affects: [123-03-files-tab-ui, 124-attachment-actions]

tech-stack:
  added: []
  patterns:
    - "Reactive per-file upload row list (UploadRow[]) with index-based reactive updates, extending useMediaUpload's single-file resumable-upload idiom to a batch"
    - "Batch-local completed[] accumulator written on every completion alongside existingAttachments, so the final persisted array is complete regardless of file finish order (Firestore last-write-wins)"

key-files:
  created:
    - src/composables/useSongFileUpload.ts
    - src/composables/__tests__/useSongFileUpload.test.ts
    - src/utils/songLinks.ts
    - src/utils/__tests__/songLinks.test.ts
  modified:
    - src/utils/songFiles.ts
    - src/composables/useMediaUpload.ts

key-decisions:
  - "sanitizeFileName promoted from private helpers in both songFiles.ts and useMediaUpload.ts into a single exported function in songFiles.ts, imported by useMediaUpload.ts — closes Phase 122 code-review IN-03"
  - "Client validation checks TYPE (allowed MIME OR .pdf/.mp3 extension) before SIZE, matching the plan's precedence and the UI-SPEC's two distinct rejection strings"
  - "addFiles uses a batch-local `completed` array (not a composable-scoped one) so each addFiles() call gets its own accumulator, matching the plan's 'batch-local' wording"

patterns-established:
  - "Composables holding a reactive list of async-in-flight rows replace items by index (`uploads.value[i] = { ...current, ... }`) rather than mutating a captured object reference, to keep Vue's array reactivity triggering correctly for real component consumers"

requirements-completed: [R363, R365]

coverage:
  - id: D1
    description: "useSongFileUpload uploads several PDF/MP3 files with independent per-file progress rows"
    requirement: "R363"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSongFileUpload.test.ts#addFiles with two valid files creates two uploading rows with correct kind"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useSongFileUpload.test.ts#state_changed updates each row's progress independently, and completion marks it done"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wrong-type/oversized files are rejected client-side with the exact UI-SPEC copy, while valid files in the same batch continue uploading"
    requirement: "R363"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSongFileUpload.test.ts#rejects a wrong-type file with the exact UI-SPEC copy and starts no upload, while a valid file in the same batch still uploads"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useSongFileUpload.test.ts#rejects a >50MB file with the exact UI-SPEC copy and starts no upload"
        status: pass
    human_judgment: false
  - id: D3
    description: "A completed upload persists a document|audio SongAttachment via songStore.updateSong(id, { attachments }), preserving existingAttachments"
    requirement: "R363"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSongFileUpload.test.ts#preserves existingAttachments on every completion write"
        status: pass
    human_judgment: false
  - id: D4
    description: "A valid https link infers linkSource from the host and builds a kind:'link' SongAttachment with href+linkSource+name and no storagePath/size"
    requirement: "R365"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songLinks.test.ts#buildLinkAttachment"
        status: pass
    human_judgment: false
  - id: D5
    description: "A non-https or unparseable link is rejected"
    requirement: "R365"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songLinks.test.ts#isValidExternalLink"
        status: pass
    human_judgment: false
  - id: D6
    description: "Exactly one sanitizeFileName implementation exists, shared by song-file and media uploads (Phase 122 IN-03 closed)"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useMediaUpload.test.ts (all 7 tests still pass after the refactor)"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-05
status: complete
---

# Phase 123 Plan 01: Song File Upload & Link Logic Layer Summary

**Multi-file resumable upload composable (`useSongFileUpload`) with per-file progress and UI-SPEC-exact client validation, plus `songLinks` https-link validation/source-inference/attachment-builder helpers — both persisting via `songStore.updateSong`, with the Phase 122 IN-03 sanitizer duplication closed.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-05
- **Tasks:** 3
- **Files modified:** 6 (2 created composables/utils + 2 created test files + 2 modified files)

## Accomplishments
- Closed Phase 122 code-review finding IN-03: `sanitizeFileName` now lives once, exported from `src/utils/songFiles.ts`, and `useMediaUpload.ts` imports it instead of keeping a private duplicate — behavior-preserving (all 7 existing `useMediaUpload` tests pass unchanged).
- Built `src/utils/songLinks.ts` (R365): `isValidExternalLink` (https-only, rejects http/javascript:/data:/unparseable), `inferLinkSource` (youtube/drive/dropbox/other by host), and `buildLinkAttachment` (kind:'link' SongAttachment with href+linkSource+name, no storagePath/downloadUrl/mimeType/sizeBytes keys — never set to `undefined`, simply omitted).
- Built `src/composables/useSongFileUpload.ts` (R363): reactive `UploadRow[]` list, per-file client validation (type checked before size, exact UI-SPEC rejection copy), resumable upload via `uploadBytesResumable`/`getDownloadURL` mirroring `useMediaUpload`'s idiom, and persistence of completed document|audio `SongAttachment`s via `useSongStore().updateSong(songId, { attachments })` — writing `existingAttachments` plus a batch-local running accumulator on every completion so the final array is always complete regardless of finish order.

## Task Commits

Each task was committed atomically:

1. **Task 1: Close IN-03 — one shared sanitizeFileName** - `d2485499` (refactor)
2. **Task 2: External-link validation + source inference (R365 logic)** - `db383a67` (test, RED) → `230055ed` (feat, GREEN)
3. **Task 3: useSongFileUpload — multi-file upload, progress, per-file validation, persist (R363)** - `15e94e83` (test, RED) → `a2c66a6d` (feat, GREEN)

**Plan metadata:** committed alongside this SUMMARY (see final commit hash in orchestrator output).

## Files Created/Modified
- `src/utils/songFiles.ts` - `sanitizeSongFileName` promoted to exported `sanitizeFileName`; `songFileStoragePath` now calls the exported function
- `src/composables/useMediaUpload.ts` - Removed private `sanitizeFileName`; imports the shared one from `@/utils/songFiles`
- `src/utils/songLinks.ts` - New: `isValidExternalLink`, `inferLinkSource`, `buildLinkAttachment` (R365)
- `src/utils/__tests__/songLinks.test.ts` - New: 16 tests covering every behavior in the plan's `<behavior>` block
- `src/composables/useSongFileUpload.ts` - New: `useSongFileUpload()` composable, `UploadRow`/`AddFilesContext` types (R363)
- `src/composables/__tests__/useSongFileUpload.test.ts` - New: 7 tests covering multi-file progress, per-file rejection (wrong-type/oversized), persistence with existing-attachment preservation, upload-task error, and reset()

## Decisions Made
- `sanitizeFileName` lives in `songFiles.ts` (not a new shared util file) since it was already the more-central location per the plan's explicit instruction, and `songFileStoragePath` already depended on it locally.
- Client validation order is TYPE then SIZE (per plan), so a wrong-type oversized file reports the type-rejection copy, not the size one — matches the plan's explicit precedence and keeps a single deterministic rejection message per file.
- Used index-based reactive replacement (`uploads.value[i] = {...current, ...}`) rather than mutating a captured row object reference, to keep Vue's reactivity system correctly notified for real component consumers (not required by the unit tests, which read state directly, but correct for the Files-tab UI that plan 123-03 will build on top of this composable).

## Deviations from Plan

None - plan executed exactly as written. All three tasks completed with their prescribed TDD (RED/GREEN) cycles where marked, using the exact UI-SPEC rejection copy and exact behavior contracts specified.

## Issues Encountered

The initial `useSongFileUpload.test.ts` draft used direct array-index property access (`uploads.value[0].status`) which `vue-tsc --build`'s strict `noUncheckedIndexedAccess`-style checking flagged as `TS2532: Object is possibly 'undefined'` (13 instances) and `TS18048` for a `mock.calls[...]` lookup. Fixed by adding non-null assertions (`!`) at each access point — the test's own prior `expect(...).toHaveLength(...)` assertions already guarantee the index is populated, so the assertion is safe. Not a Rule 1/2/3 deviation (test-only, no production code change) — logged here per CLAUDE.md's warning that `npm run type-check` (not the narrower `-p tsconfig.app.json` form) also typechecks test files.

## User Setup Required

None - no external service configuration required. This plan touches only Firestore/Storage client SDK calls already configured in Phase 122; no new environment variables or dashboard steps.

## Next Phase Readiness

- `useSongFileUpload` and `songLinks` are ready to be wired into the Files-tab UI component in plan 123-03 (drop zone, link field, per-file progress rows).
- The songs-list Files column (R362) and the Files tab shell (R361) are separate UI-only plans in this phase and are unaffected by this plan's scope.
- No blockers. The `storage.rules.test.ts` baseline failure (Storage-emulator dependent, no emulator running) is expected per CLAUDE.md and is unrelated to this plan's changes.

---
*Phase: 123-files-tab-songs-list-column-upload-external-link-attach*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created files verified present on disk; all task commit hashes (d2485499, db383a67, 230055ed, 15e94e83, a2c66a6d) verified present in git history.
