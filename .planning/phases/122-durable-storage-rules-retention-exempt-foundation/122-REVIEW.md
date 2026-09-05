---
phase: 122-durable-storage-rules-retention-exempt-foundation
reviewed: 2026-09-05T16:37:17Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - storage.rules
  - src/storage.rules.test.ts
  - src/types/song.ts
  - src/utils/songFiles.ts
  - src/utils/__tests__/songFiles.test.ts
  - functions/src/cleanupSweeps.ts
  - functions/src/index.test.ts
  - src/stores/songs.ts
  - src/stores/__tests__/songs.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 122: Code Review Report

**Reviewed:** 2026-09-05T16:37:17Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found (Info only — no Critical or Warning findings)

## Summary

Phase 122 adds a permanent, org-scoped `orgs/{orgId}/song-files/` Storage prefix for Song
attachments, a dedicated `isOrgEditor`/`isOrgEditorByClaim` rules helper, an additive
`SongAttachment` type, a `songFileStoragePath` helper, comment-only retention-exemption
annotations on the four existing Cloud Functions sweep guards, and a best-effort Storage
cascade in `hardDeleteSong`.

This is the highest-stakes surface in the phase — a rules bug here is either a cross-tenant
data leak or a silent-deletion-of-permanent-data bug — so it received line-by-line tracing
of every conjunct in `storage.rules`, cross-checked against the emulator test suite and the
retention-lock unit test, plus an actual test run (`npx vitest run` for the touched app-side
files, `cd functions && npx vitest run` scoped to the retention-exemption describe block) and
a full `npm run type-check` / `functions` `tsc --noEmit`, all clean.

I traced the following specifically and found them correct:

- The `song-files/{allPaths=**}` block's `create` gate is a proper AND of
  `isOrgEditor(orgId) && size<50MB && contentType∈{pdf,mp3}` — a viewer is denied (test:
  "DENIES a viewer from uploading"), an over-cap editor upload is denied, and a small
  wrong-content-type editor upload is denied specifically via the catch-all exclusion (not
  merely the size cap) — the load-bearing Pitfall-1 regression test.
- `allow update: if false` is the correct way to make re-upload-to-same-path a no-op deny;
  `allow delete: if isOrgEditor(orgId)` correctly avoids referencing `request.resource`
  (which is `null` on delete and would hard-error/deny if touched), and is proven by both an
  editor-allow and viewer-deny emulator test.
- The catch-all's `^orgs/[^/]+/song-files/.*` exclusion is applied to the correct variable on
  each verb (`resource.name` for read, `request.resource.name` for write) and cannot be
  bypassed by a sibling name like `song-files-evil/…` (the regex requires the literal `/`
  after `song-files`). Because Storage rule blocks are OR-combined (not closest-match-wins
  like Firestore), the exclusion is load-bearing exactly where documented — without it, the
  catch-all's laxer 25MB/any-content-type write would leak through as an OR-alternative to
  the dedicated block's deny. This is proven by the wrong-content-type regression test.
- No `firestore.exists()` cross-service call was reintroduced anywhere in the new
  `isOrgEditorByClaim`/`isOrgEditor` functions — both are pure claim reads, mirroring
  `isOrgMemberByClaim` exactly, and the file's own static "claim-only membership" guard test
  still passes unmodified.
- `hardDeleteSong`'s Storage cascade is a sequential `for` loop with a per-item `try/catch`
  around each `deleteObject` call — not `Promise.all`/`Promise.allSettled` — so one rejected
  delete cannot reject a batch or abort the loop; it logs and continues, then still runs the
  Firestore doc/lyrics delete. Link-kind attachments (`storagePath` undefined) are correctly
  skipped. The soft-delete path (`deleteSong`) is untouched and does not call `deleteObject`,
  confirmed by an explicit non-cascade test.
- `SongAttachment` is fully additive: `Song.attachments` is optional, and every
  `SongAttachment` field beyond `id`/`kind`/`name`/`createdAt`/`createdBy` is optional —
  existing songs without the field are unaffected, and no downstream code in this phase's
  file set assumes `attachments` is present.
- The retention-exemption lock test (`functions/src/index.test.ts`, "Song-files retention
  exemption") asserts non-match against all four sweep guards (`MEDIA_PATH_GUARD`,
  `RENDERED_OBJECT_GUARD`, `BACKGROUND_PATH_GUARD`, `PPTX_SOURCE_GUARD`) for both a `.pdf`
  and a `.mp3` song-files path via `it.each` — a future guard-widening edit that started
  matching `song-files/` would fail this test, which is exactly the intended tripwire. The
  four `// R370: …` comments added to `cleanupSweeps.ts` are comment-only, next to
  POSITIVE-match guards (each regex matches only its own dedicated prefix), so song-files/ is
  structurally excluded by construction, not by an exception list that could be forgotten.

No Critical or Warning-severity issues were found. The three Info items below are
pre-existing-pattern-consistent limitations, not regressions or exploitable gaps.

## Info

### IN-01: Content-type gate is client-supplied metadata, not content-sniffed

**File:** `storage.rules:110-112`
**Issue:** `allow create` restricts `request.resource.contentType` to
`['application/pdf', 'audio/mpeg']`, but `contentType` is metadata the uploading client sets
on the request — it is not derived from the actual file bytes. An editor can upload arbitrary
bytes (e.g., a script or a corrupt file) while declaring `contentType: 'application/pdf'`,
and the rule will accept it. This is a pre-existing trust model already used elsewhere in
this file (the `media/` and catch-all blocks have no content-type check at all, so this is
strictly tighter than the status quo, not a regression), and Storage does not execute
uploaded objects, so the practical risk is a mislabeled/corrupt attachment rather than code
execution. Flagging for awareness only — the same limitation would apply to any
content-type allowlist implemented purely in security rules.
**Fix:** No change required for this phase. If stronger validation is wanted later, it would
need a Cloud Function trigger that inspects magic bytes post-upload and quarantines/deletes
mismatches — out of scope for R372's rules-only gate.

### IN-02: `songFileStoragePath` sanitizes `name` but not `orgId`/`attachmentId`

**File:** `src/utils/songFiles.ts:17-19`
**Issue:** `sanitizeSongFileName` is applied only to the trailing `name` segment;
`orgId` and `attachmentId` are interpolated into the path unsanitized. Today both are
internally generated (resolved org context, generated attachment id) so this isn't
reachable with attacker-controlled input from the files reviewed in this phase. Cloud
Storage object names are a flat namespace (no `..`-style path resolution), and the
`storage.rules` regex gate (`^orgs/[^/]+/song-files/.*`) would still catch a
maliciously-shaped id since `orgId` itself must remain slash-free to keep the object under
`orgs/{orgId}/…` at all — so this is not an active bypass, only a latent footgun for a
future caller that passes a less-trusted `attachmentId`.
**Fix:** Consider asserting/sanitizing `attachmentId` (e.g., restricting to
`[a-zA-Z0-9_-]+`) the same way `name` is sanitized, so the helper is safe by construction
regardless of caller trust level, rather than relying on callers to only ever pass
Firestore-generated ids.

### IN-03: `sanitizeSongFileName` duplicates `useMediaUpload`'s private sanitizer

**File:** `src/utils/songFiles.ts:9-13`
**Issue:** The function's own comment acknowledges the duplication ("kept separate — not
imported — since that module is Phase 123 territory"). This is a deliberate, documented
trade-off rather than an oversight, so it is not a Warning, but it is worth tracking so the
two implementations don't silently drift once Phase 123 lands.
**Fix:** When Phase 123 touches `useMediaUpload.ts`, consider extracting one shared
`sanitizeFileName` helper both modules import, per the existing "mirrors …'s pattern"
convention already used elsewhere in this file.

---

_Reviewed: 2026-09-05T16:37:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
