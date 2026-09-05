# Phase 124: Grouped File List, In-App Preview/Play, Download & Remove - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous smart-discuss; design pre-locked in 121-UI-SPEC)

<domain>
## Phase Boundary

Complete the Files tab: an editor (and, where reachable, a read-only viewer) can **browse, preview, play,
download, and safely remove** a song's attachments. Deliver R366 (Documents/Audio grouped rows +
metadata + per-group empty states), R367 (in-app PDF preview + MP3 player), R368 (download + remove with
the removes-everywhere confirm). This is the **final phase** of v2.11.

**Builds on Phase 123:** `SongFilesTab.vue` currently renders a FLAT functional attachment list. This
phase UPGRADES it into the grouped Documents/Audio rows with the per-row actions. Consumes the design
contract `.planning/phases/121-song-files-ui-design-spec/121-UI-SPEC.md` §6/7 (grouped rows), §8 (PDF
preview modal), §9 (MP3 player), §10 (remove confirm).
</domain>

<decisions>
## Implementation Decisions

### Grouped Documents/Audio list (R366)
- Restructure `SongFilesTab.vue`'s list into two always-rendered sections — **Documents** (PDF + generic
  links) and **Audio** (MP3) — per UI-SPEC §6/7: eyebrow group header (11px/500/uppercase + the group
  icon `text-gray-400`), metadata rows, and a per-group empty line ("No documents attached yet." /
  "No audio files attached yet.") when a group is empty.
- Row anatomy (UI-SPEC §6/7): file-type icon (document-text / musical-note, `text-gray-400`), filename
  (`truncate` + `title`), metadata line **`{TYPE} · {pages-or-duration} · {size} · {date}`**. Date format
  = `toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})` (reuse the existing
  convention). Linked rows: `{SOURCE} link · {date}` (no size/duration).
- **Metadata graceful omission:** MP3 duration — if 123 captured it (client `Audio` metadata), show it;
  else omit. PDF page count — **do NOT add a PDF library** (SEED-003: no new deps) — omit the pages field
  gracefully when unknown (`PDF · {size} · {date}`). The row must never show `undefined`/`NaN`.

### In-app preview & play (R367)
- **PDF preview = a modal overlay** (UI-SPEC §8), reusing the `CleanupEnableConfirmDialog.vue` dialog
  shell (backdrop `fixed inset-0 z-40`, `role="dialog" aria-modal="true"`), sized larger than the
  slideout; header = filename + Download + Close (X); body = `<iframe>`/`<embed>` on the attachment's
  `downloadUrl`; loading spinner + an error fallback ("Couldn't preview this file." + Download).
  **IMPORTANT — this modal SHOULD dismiss on Escape / backdrop-click / Close.** That is standard for a
  transient viewer overlay and is NOT in conflict with the recent quick-task change (which made the
  *editing slideout* non-dismissing on outside-click/Escape) — the preview modal is a separate, transient
  overlay, not the editing panel. Keep the modal's Escape/backdrop dismiss.
- **MP3 player = inline `<audio controls>`** (UI-SPEC §9) revealed beneath the clicked row (native chrome,
  no custom skin); one track expanded at a time (starting another collapses the first); native error →
  "Couldn't play this file." + Download fallback.

### Download & Remove (R368)
- **Download:** every uploaded attachment row has a Download action (the `downloadUrl`). Links have no
  Download (open-in-new-tab instead).
- **Remove:** the inline-expand confirm card (UI-SPEC §10, reusing the Delete-Song inline pattern), copy:
  "Remove '{filename}'? This file appears on every service that uses this song. Removing it here removes
  it everywhere — including past services. This can't be undone." One confirm open at a time.
- **Remove semantics (R368 + ties to R371):** add a store method `removeSongAttachment(songId,
  attachment)` mirroring 123's atomic `addSongAttachment`. **Removal-atomicity decision:** Firestore
  `arrayRemove` deletes an array element only by exact (deep) match, and attachments carry a `Timestamp`
  (`createdAt`) that may not round-trip identically — so prefer `arrayRemove(theLiveStoredObject)` fetched
  from `songStore.songs` by id (exact object), and if reliable exact-match proves flaky, fall back to a
  read-latest-then-filter-by-`id` write (removal is user-initiated one-at-a-time, so the lost-update risk
  is far lower than the concurrent-upload case). Resolve during planning/research; the acceptance truth is
  "clicking Remove → confirm → the attachment disappears from the song (and the count/badge/column update
  live) and does not reappear."
- **Storage cleanup on remove:** for an uploaded (non-link) attachment, best-effort `deleteObject(storagePath)`
  after the record is removed (skip for links). A failed Storage delete must NOT block or revert the record
  removal (a rare orphaned blob is acceptable — far better UX than a "removed" file reappearing); log it.
  This is the **editor-removal** half of R371 (the song-deletion half shipped in Phase 122's hardDeleteSong).

### Access control
- Preview / Play / Download are read actions (available to any who can see the tab). **Remove is
  editor-only.** Per Phase 122's finding the `/songs` screen is `requiresEditor` anyway, so only editors
  reach this — no viewer-variant is reachable; don't build one.

### Claude's Discretion
- Whether the PDF modal is a new `SongFilePreviewModal.vue` component vs inline in SongFilesTab, exact
  row decomposition, and the MP3 duration display are at Claude's discretion, guided by the UI-SPEC.
</decisions>

<code_context>
## Existing Code Insights

### Files this phase touches
- `src/components/SongFilesTab.vue` — the flat list from Phase 123 → restructure into grouped rows +
  per-row actions (preview/play/download/remove) + the inline remove-confirm.
- NEW (likely): a `SongFilePreviewModal.vue` (PDF iframe modal) — model on
  `src/components/admin/CleanupEnableConfirmDialog.vue` (the dialog shell + Escape/backdrop dismiss).
- `src/stores/songs.ts` — add `removeSongAttachment(id, attachment)` (atomic, mirrors the Phase-123
  `addSongAttachment` `arrayUnion` — this one uses `arrayRemove` or a filtered write; import `deleteObject`
  from firebase/storage, and `storage` from src/firebase).
- Reuse: `src/types/song.ts` `SongAttachment` (kind, storagePath, downloadUrl, mimeType, sizeBytes, href,
  linkSource, createdAt), `src/utils/songFiles.ts`.

### Design contract
- `.planning/phases/121-song-files-ui-design-spec/121-UI-SPEC.md` §6/7 (rows), §8 (PDF modal), §9 (MP3
  player), §10 (remove confirm), Icon Inventory (eye/play-pause/arrow-down-tray/trash/x-mark/
  arrow-top-right-on-square — hand-inlined Heroicons-outline SVG), Copywriting Contract (all failure copy).
- `.planning/phases/121-song-files-ui-design-spec/121-song-files-mock.html` — the visual mock.

### Established patterns
- Inline-expand confirm: the Delete-Song pattern in `SongSlideOver.vue:283–316`.
- Dialog shell + Escape/backdrop dismiss: `src/components/admin/CleanupEnableConfirmDialog.vue`.
- Spinner SVG: `SongTable.vue`. Icons: hand-inlined Heroicons-outline (no icon lib).

### Testing gates (CLAUDE.md)
- `npm run type-check` (vue-tsc --build). App suite `npx vitest run` baseline = only storage.rules.test.ts
  fails. Component tests via Vue Test Utils; mock firebase/storage `deleteObject`.
</code_context>

<specifics>
## Specific Ideas

- Build to the 121-UI-SPEC exactly for the rows/modal/player/confirm. Visual fidelity + the
  preview/play/download/remove UX are the milestone's final batched owner-UAT items.
- The remove flow is the editor-facing completion of R371's permanence model: an editor CAN delete an
  attachment (record via arrayRemove/filter + best-effort Storage delete), and nothing else does.
</specifics>

<deferred>
## Deferred Ideas

- Per-org storage quota, egress alerting, Rehearse/public playback, per-file "share with volunteers"
  toggle — all future milestone.
- A PDF page-count library — intentionally omitted (no new deps; the metadata line degrades gracefully).
</deferred>
