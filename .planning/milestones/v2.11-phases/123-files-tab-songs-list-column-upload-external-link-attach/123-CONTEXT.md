# Phase 123: Files Tab, Songs List Column, Upload & External Link Attach - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous smart-discuss; design pre-locked in 121-UI-SPEC, foundation in Phase 122)

<domain>
## Phase Boundary

An editor can **see, grow, and link** a song's attachment collection. Deliver: the **Files tab** in the
Edit Song slideout (R361), the **Songs-list Files column** (R362), **multi-file upload** with per-file
progress (R363), and **external media link** attach (R365).

**Consumes:** the verified design contract `.planning/phases/121-song-files-ui-design-spec/121-UI-SPEC.md`
(the whole-feature visual/interaction contract — build to it) and the Phase 122 foundation (the
`SongAttachment` type + `attachments?` field on `Song`, `src/utils/songFiles.ts` constants/path helper,
and the `song-files/` `storage.rules` block that already gates uploads to editor + PDF/MP3 + ≤50MB).

**Boundary with Phase 124 (do NOT build here):** the per-row **in-app PDF preview + MP3 player** (R367),
**Download + Remove** actions (R368), and the polished **Documents/Audio grouping with full metadata rows
+ empty states** (R366) are Phase 124. This phase renders a **functional list** of the song's attachments
(so the collection is visibly "seen" and a just-uploaded file appears) — but WITHOUT the preview/play/
download/remove row actions and without owning the final grouped-metadata polish. Keep 124's actions out.
</domain>

<decisions>
## Implementation Decisions

### Files tab (R361)
- Add a third tab **Files** to `SongSlideOver.vue`'s tab bar (`:97–121`), beside Details/Lyrics, using the
  EXACT active/inactive idiom from the UI-SPEC (`text-indigo-400 border-indigo-500` active /
  `text-gray-400 border-transparent hover:text-gray-300` inactive, `border-b-2 -mb-px`). Extend
  `activeTab` ref (`:361`) to `'details' | 'lyrics' | 'files'` and add `'files'` to `SongEditTab` +
  `VALID_TABS` in `src/utils/songEditLink.ts:4,6`. Count badge (`bg-indigo-900/50 text-indigo-300
  border-indigo-800`) shows only when count > 0. Tab + panel gated `v-if` like Lyrics (not in create mode).
- Panel container matches the Details tab (`px-5 py-5 space-y-5`) for zero layout jump. Panel body order
  per UI-SPEC: Drop Zone → Link field → the attachment list.

### Songs-list Files column (R362)
- Add a toggleable **Files** column to `SongTable.vue`, positioned last before the trailing chevron.
  Paperclip inline-SVG + text `none` / `1 file` / `N files` (plain text, NOT a pill — pill is the tab
  badge only). Add `files: true` to `DEFAULT_COLUMN_VISIBILITY` (`src/stores/songs.ts:50–58`) and a
  `{ key:'files', label:'Files' }` entry to `toggleableColumns` (`SongTable.vue:330–337`), gated on
  `songStore.columnVisibility.files` like every other column. Count derives from `song.attachments?.length`.

### Multi-file upload (R363)
- New composable `src/composables/useSongFileUpload.ts` mirroring `useMediaUpload.ts` (refs
  `progress`/`error`/`isUploading` + `uploadBytesResumable` + `state_changed` progress + `getDownloadURL`),
  using `songFileStoragePath()` and `SONG_FILE_MAX_BYTES`/`SONG_FILE_ALLOWED_MIME` from Phase 122's
  `src/utils/songFiles.ts`. **Address code-review IN-03 from Phase 122 here:** de-duplicate the filename
  sanitizer — extract/share one `sanitizeFileName` rather than keeping the deliberate temporary copy.
- Drop zone: drag-and-drop OR click-to-browse, hidden `<input type="file" multiple accept=".pdf,audio/mpeg">`.
  **Several files at once**; validate EACH file client-side the instant it's dropped/picked — reject wrong
  type / >50MB per-file with the UI-SPEC copy, and continue uploading the valid ones (a bad file never
  blocks the good ones). Per-file progress row (bar + %). On completion, append a `SongAttachment` record
  (kind document|audio, storagePath, downloadUrl, mimeType, sizeBytes, name, createdAt, createdBy) to the
  song's `attachments` and persist via `songStore.updateSong(id, { attachments })`.
- Compute display extras at upload time where cheap: MP3 duration (via an `Audio`/`AudioContext` metadata
  read) and PDF page count are NICE-TO-HAVE for the metadata line — if a robust client-side read is
  awkward, store what's easy (size, date, type) and leave page/duration for the metadata line to omit
  gracefully (124's rows already handle a missing field). Don't block the milestone on PDF page counting.

### External media link (R365)
- A "link instead of uploading" input (per UI-SPEC §4): validate it's a URL (starts with https://),
  infer `linkSource` from the host (youtube/drive/dropbox/other), append a `SongAttachment` of
  `kind:'link'` (href + linkSource + name, no storagePath/size), persist via `updateSong`. No file
  transfer. The link opens in a new tab (the open affordance itself is fine to wire here or in 124 — the
  UI-SPEC has links open in a new tab and shows an external-link glyph; keep it simple).

### Attachment list rendering (R361 "see the collection")
- Render the song's current `attachments` as a functional list in the Files tab so uploads are visible.
  Simple rows (icon + name + basic meta) are enough for THIS phase. **Leave the polished Documents/Audio
  grouping + full metadata + empty-state copy (R366) and the preview/play/download/remove actions
  (R367/R368) to Phase 124.** If it's cleaner to build the grouped container now and have 124 fill in
  actions, that's acceptable — but do not build 124's row actions here.

### Access control
- Editor-only surfaces (drop zone, link field) render for editors. Per Phase 122's finding, the app's
  `/songs` route is `requiresEditor` so only editors reach this screen anyway — no viewer-specific UI is
  reachable; don't spend effort on a viewer variant (the rules layer already denies viewer writes).

### Claude's Discretion
- Component decomposition (e.g. a `SongFilesTab.vue` child vs inline in `SongSlideOver.vue`), exact
  drag/drop event handling, and whether to compute PDF page count client-side are at Claude's discretion,
  guided by the UI-SPEC and existing slideout conventions.
</decisions>

<code_context>
## Existing Code Insights

### Files this phase touches
- `src/components/SongSlideOver.vue` — tab bar `:97–121`, `activeTab` `:361`, panel gating like Lyrics
  `:323`; save path `onSave()` `:562` → `songStore.updateSong(id, data)` `:615`.
- `src/utils/songEditLink.ts:4,6` — `SongEditTab` + `VALID_TABS` gain `'files'`.
- `src/components/SongTable.vue` — column `th`/`td` (gated on `columnVisibility`), `toggleableColumns`
  `:330–337`.
- `src/stores/songs.ts` — `columnVisibility` + `DEFAULT_COLUMN_VISIBILITY` `:50–58`; `updateSong`
  `:296–302` (attachments ride through as a partial field — no new method).
- NEW: `src/composables/useSongFileUpload.ts` (+ its test).
- Reuse: `src/composables/useMediaUpload.ts` (the pattern), `src/utils/songFiles.ts` (Phase 122
  constants/helper), `src/types/song.ts` (`SongAttachment` from Phase 122).

### Design contract
- `.planning/phases/121-song-files-ui-design-spec/121-UI-SPEC.md` — the authoritative visual/interaction
  contract for every surface (build to it exactly: palette tokens, the drop-zone copy "PDF, MP3 · up to
  50 MB each · several at once", the link field copy, the count/column copy, per-file client rejection).
- `.planning/phases/121-song-files-ui-design-spec/121-song-files-mock.html` — the throwaway visual mock.

### Established patterns
- Hand-inlined Heroicons-outline SVGs (no icon library) — paperclip, arrow-up-tray, arrow-top-right-on-square.
- Tailwind v4 stock gray-950/900/800 + indigo-600/500/400.

### Testing gates (CLAUDE.md)
- `npm run type-check` (vue-tsc --build) is the type gate. App suite `npx vitest run` — baseline: only
  `storage.rules.test.ts` fails (Storage-emulator). Component tests via Vue Test Utils where present.
</code_context>

<specifics>
## Specific Ideas

- Build to the 121-UI-SPEC exactly — it already resolved copy, states (empty/populated/upload-in-progress),
  the drag-over treatment, and the per-file client-rejection flow. The visual fidelity is an owner-facing
  batched UAT item (compare the running Files tab to 121-song-files-mock.html).
- Fold in Phase 122's code-review IN-03 (dedupe the filename sanitizer) while building the upload composable.
</specifics>

<deferred>
## Deferred Ideas

- In-app PDF preview + MP3 player (R367), Download + Remove row actions (R368), polished Documents/Audio
  grouping + metadata + empty states (R366) — all Phase 124.
- Per-org storage quota, egress alerting, Rehearse/public playback — future milestone.
</deferred>
