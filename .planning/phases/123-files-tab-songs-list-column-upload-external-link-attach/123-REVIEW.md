---
phase: 123-files-tab-songs-list-column-upload-external-link-attach
reviewed: 2026-09-05T00:00:00Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - src/composables/useSongFileUpload.ts
  - src/utils/songLinks.ts
  - src/utils/songFiles.ts
  - src/composables/useMediaUpload.ts
  - src/components/SongFilesTab.vue
  - src/components/SongSlideOver.vue
  - src/components/SongTable.vue
  - src/stores/songs.ts
  - src/utils/songEditLink.ts
  - src/composables/__tests__/useSongFileUpload.test.ts
  - src/utils/__tests__/songLinks.test.ts
  - src/utils/__tests__/songFiles.test.ts
  - src/components/__tests__/SongFilesTab.test.ts
  - src/composables/__tests__/useMediaUpload.test.ts
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 123: Code Review Report

**Reviewed:** 2026-09-05
**Depth:** deep
**Files Reviewed:** 10 source files + 5 test files
**Status:** issues_found

## Summary

Reviewed the Files tab, Songs-list Files column, multi-file upload composable, and external-link
attach flow against R361/R362/R363/R365 and the 121-UI-SPEC contract. `npm run type-check`
(`vue-tsc --build`) is clean and all 48 relevant tests (`useSongFileUpload`, `songLinks`,
`songFiles`, `SongFilesTab`, `useMediaUpload`) pass.

The implementation gets the well-tested cases right: per-file client rejection genuinely doesn't
block the rest of a batch, the shared `sanitizeFileName` dedupe is verified behavior-preserving,
`SongSlideOver.vue`'s `liveAttachments` computed correctly resolves by id from `songStore.songs`
(not the stale `props.song`) so a just-uploaded file appears without reopening the panel, `onSave`'s
`data` payload never includes `attachments` (isolating it from the unsaved-guard/Details-Lyrics save
path), the link field rejects non-https/`javascript:`/`data:` values, links render with
`rel="noopener noreferrer"`, and optional attachment fields (`storagePath`/`downloadUrl`/
`mimeType`/`sizeBytes` for links) are correctly omitted rather than set to `undefined`.

The one substantive defect is a genuine lost-update race in `useSongFileUpload.ts`: the
`existingAttachments` snapshot is captured once per `addFiles()` call and never refreshed, so two
overlapping attachment-adding operations (a second drop while the first batch is still uploading, or
a link submitted while a batch is in flight) can silently drop one side's write. The existing test
suite only proves the single-batch, multiple-files-in-one-call case is safe — it does not (and
cannot, as currently designed) prove the cross-operation case, because the fix requires re-reading
current state at write time rather than closing over a stale array.

## Critical Issues

### CR-01: Lost-update race when two attachment-adding operations overlap in time

**File:** `src/composables/useSongFileUpload.ts:76-167` (also `src/components/SongFilesTab.vue:157-192`)

**Issue:** `addFiles()` captures `ctx.existingAttachments` once, at the top of the call
(`src/composables/useSongFileUpload.ts:76`), and closes over it for the lifetime of every upload in
that batch. Each file's completion handler writes
`songStore.updateSong(ctx.songId, { attachments: [...ctx.existingAttachments, ...completed] })`
(line 149-151), where `completed` only accumulates files from *this same* `addFiles()` call.

This is a full-field overwrite via `updateDoc` (`src/stores/songs.ts:298-304`), not an atomic
`arrayUnion` or transaction. The in-batch accumulator (`completed`) correctly protects against files
finishing out of order *within one `addFiles()` invocation* — the code comment and the
`useSongFileUpload.test.ts` "preserves existingAttachments on every completion write" /
"state_changed updates each row's progress independently" tests demonstrate this case is handled and
verified.

But nothing protects against two *different* attachment-adding operations overlapping:

1. User drops file A (starts a large, slow upload). Composable freezes `ctx.existingAttachments = existing`.
2. Before A finishes, the user drops file B (a second `addFiles()` call) or submits a link via
   `submitLink()` (`src/components/SongFilesTab.vue:183-192`). This second operation reads
   `props.attachments` fresh at its own call time and writes `[...existing, B]` (or `[...existing, link]`).
   That write commits and the store updates.
3. File A finally finishes. Its completion handler still has the *original* frozen `existing` (which
   does not include B or the link) and writes `[...existing, A]`.
4. Step 3's write silently overwrites step 2's addition — B or the link disappears from the song's
   `attachments` field with no error surfaced anywhere.

This is realistic, not hypothetical: (a) users routinely drop a first batch, then drop more files
before the first finishes (the drop zone is explicitly "always visible... the permanent 'add more'
affordance" per 121-UI-SPEC §3, encouraging exactly this); (b) uploading a file and then immediately
pasting a link is a normal two-step workflow the UI actively supports side-by-side in the same panel;
(c) two editors on the same worship team could be in the Files tab for the same song concurrently.
In every case, the attachment that finishes writing *last* wins, and any addition made while another
operation was still in flight is dropped without any indication to either user.

**Fix:** Re-read the current server/store state at write time instead of closing over a stale
snapshot — e.g. read `songStore.songs.find(s => s.id === songId)?.attachments` (or re-fetch the doc)
immediately before each `updateSong` call rather than using the value captured when `addFiles()` was
first invoked:

```ts
// inside the getDownloadURL().then() completion handler, replacing the
// ctx.existingAttachments read:
const store = useSongStore()
const currentAttachments = store.songs.find((s) => s.id === ctx.songId)?.attachments ?? ctx.existingAttachments
completed.push(attachment)
await store.updateSong(ctx.songId, {
  attachments: [...currentAttachments, ...completed.filter((c) => !currentAttachments.some((a) => a.id === c.id))],
})
```

or, more robustly, switch to Firestore's `arrayUnion(attachment)` per completed file (one `updateDoc`
call per file instead of a full-array replace) so concurrent writes to the same field merge instead
of racing. The same re-read-before-write fix applies to `submitLink()` in `SongFilesTab.vue:189-190`,
which has the identical shape of bug in miniature (uses `props.attachments` captured at click time
rather than re-verifying against current state before persisting).

## Warnings

### WR-01: Client validation's OR logic lets a MIME/extension mismatch through, producing a misleading error later

**File:** `src/composables/useSongFileUpload.ts:56-67`

**Issue:** `validateSongFile()` only rejects when *both* the MIME type and the extension are wrong:
```ts
if (!hasAllowedMime && !hasAllowedExt) {
  return `'${file.name}' can't be uploaded — PDF and MP3 only, up to 50 MB.`
}
```
A file with an allowed extension but a mismatched browser-inferred MIME type (e.g. a `.pdf`-named
file that the browser reports as `text/plain`, or any renamed file) passes client validation and
starts uploading. `storage.rules:110-112` checks `request.resource.contentType in
['application/pdf', 'audio/mpeg']` strictly — since `uploadBytesResumable` doesn't override
`contentType`, it defaults to `file.type`, so this upload is then denied server-side. The user sees
the generic `state_changed` error-handler message "Upload failed. Check your connection and try
again." (`useSongFileUpload.ts:131`), which is actively misleading — the real cause is a rejected
file type, not a connection problem, and the UI-SPEC's specific wrong-type copy never fires for this
case even though it's exactly the wrong-type scenario.

**Fix:** Require both checks to agree (mirror the server rule exactly), or at minimum treat a
MIME/extension mismatch as a rejection using the same UI-SPEC copy:
```ts
if (!hasAllowedMime || !hasAllowedExt) {
  return `'${file.name}' can't be uploaded — PDF and MP3 only, up to 50 MB.`
}
```

### WR-02: Off-by-one boundary mismatch between client size check and storage.rules for a file of exactly 50MB

**File:** `src/composables/useSongFileUpload.ts:63-65`

**Issue:** Client validation rejects only when `file.size > SONG_FILE_MAX_BYTES` (52428800), so a
file whose size is *exactly* 52428800 bytes passes client validation and begins uploading.
`storage.rules:111` requires `request.resource.size < 52428800` (strict less-than), so that same file
is denied server-side. The user again gets the generic "Upload failed. Check your connection and try
again." message instead of the size-rejection copy, for a file that is, by the stated "up to 50 MB"
contract, supposed to be accepted.

**Fix:** Use `>=` in the client check to match the rule's strict `<`:
```ts
if (file.size >= SONG_FILE_MAX_BYTES) {
  return `'${file.name}' is too large — max 50 MB.`
}
```

## Info

### IN-01: Missing `aria-live` upload-completion announcement per UI-SPEC

**File:** `src/components/SongFilesTab.vue:59-78`

**Issue:** 121-UI-SPEC §5 A11y calls for "a visually-hidden `aria-live=\"polite\"` region updated at
completion... e.g. '3 of 3 files uploaded.'" No such region exists in the per-file upload progress
markup. Screen-reader users get no non-visual signal when a batch finishes.

**Fix:** Add a visually-hidden `aria-live="polite"` element updated once per batch completion (not
per progress tick), e.g. driven by a computed count of `uploads` with `status === 'done'`.

### IN-02: `buildLinkAttachment`'s href-parse-failure fallback is unreachable in practice

**File:** `src/utils/songLinks.ts:44-63`

**Issue:** `buildLinkAttachment`'s `fallbackName` computation catches a `URL` parse failure and falls
back to `params.href` verbatim (line 49-50). The only caller, `submitLink()` in `SongFilesTab.vue`,
always calls `isValidExternalLink()` first and returns early on failure, so `buildLinkAttachment`
only ever receives an already-validated, parseable `https://` URL — the catch branch can't currently
be reached. Harmless as defensive code, but worth a one-line comment noting the invariant so a future
caller doesn't assume the fallback is exercised/tested (it isn't — no test drives this branch).

**Fix:** Add a short comment noting the precondition, or add a test that calls `buildLinkAttachment`
directly with an unparseable `href` to actually exercise the fallback path.

### IN-03: `createdBy` can silently persist as an empty string

**File:** `src/components/SongSlideOver.vue:353`

**Issue:** `SongFilesTab` is given `:created-by="authStore.user?.uid ?? ''"`. If a race on auth-state
hydration ever left `authStore.user` null while the editor-gated `/songs` route was already
reachable, every attachment added in that window would persist `createdBy: ''` permanently (uploads
are described elsewhere as immutable once created). Low likelihood given the route guard, but there's
no guard at the point of use to catch it if it ever happens.

**Fix:** Consider gating the drop zone / link field on `authStore.user?.uid` being present, or at
minimum logging when the fallback empty string is used, so a future audit isn't looking at
unexplained empty `createdBy` values.

### IN-04: `Timestamp.now()` (client clock) used for `createdAt` instead of `serverTimestamp()`

**File:** `src/composables/useSongFileUpload.ts:145`, `src/utils/songLinks.ts:60`

**Issue:** Every other timestamp in this codebase's Firestore writes (`songs.ts`'s `addSong`,
`updateSong`, `deleteSong`, etc.) uses `serverTimestamp()` for consistency and to avoid client clock
skew. Attachment `createdAt` instead uses `Timestamp.now()`, which reflects the uploading browser's
local clock. This is a minor inconsistency — 122-CONTEXT's `SongAttachment.createdAt: Timestamp` type
doesn't distinguish the two, and array-nested `serverTimestamp()` sentinels have well-known Firestore
quirks (they don't work as array-element values, which is likely *why* `Timestamp.now()` was chosen
here — `attachments` is an array field, and `serverTimestamp()` is documented to resolve to `null`
inside arrays). If that's the reasoning, it's a correct decision but is undocumented in the code;
worth a one-line comment so a future reviewer doesn't "fix" it to `serverTimestamp()` and
reintroduce the null-in-array bug.

**Fix:** Add a short comment at both call sites: `// Timestamp.now(), not serverTimestamp() — this
value lives inside the attachments ARRAY, and serverTimestamp() resolves to null inside arrays.`

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
