# Phase 121: Song Files UI/Design Spec - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous smart-discuss; product decisions pre-locked with owner 2026-09-05)

<domain>
## Phase Boundary

Produce an **app-fidelity design contract** for the Song Files feature — a `UI-SPEC.md` plus a
throwaway, standalone **HTML mock** (the "ux mocks" the owner asked for) rendering the Files surfaces in
the app's **real dark gray-950 / indigo design language**, mapping the owner's Nocturne "Song Files"
Claude Design mock onto the existing app.

**In scope (this phase):** the design contract + HTML mock only. **No app source changes** — this phase
writes no Vue components, stores, rules, or functions. It exists so phases 123/124 build against one
settled visual reference instead of improvising.

**Delivers (R373):** a reviewable UI-SPEC covering every Song Files surface, expressed in the app's own
palette (not raw Nocturne), consistent with the current Edit Song slideout Details/Lyrics tabs.
</domain>

<decisions>
## Implementation Decisions

### Design source & fidelity
- The design reference is the owner's **"Song Files" mock** ("Turn 10") in the *Worship Planner
  Slideshow Design* Claude Design project (id `e8e6c287-3e88-402f-88e1-7ad6d5101fa2`). Its layout and
  interaction model are authoritative; its **Nocturne palette is NOT** — remap every color/spacing/radius
  to the app's existing Tailwind v4 stock tokens.
- **Palette mapping:** slideout/panel `bg-gray-900`, app shell `bg-gray-950`, dividers `border-gray-800`,
  inputs `border-gray-700`, primary/accent `indigo-600`, active-tab `text-indigo-400 border-indigo-500`,
  inactive tab `text-gray-400 border-transparent hover:text-gray-300` on a `border-b-2 -mb-px` button
  (mirrors `SongSlideOver.vue:97–121`). Count/pill badges use the app triplet
  `inline-flex items-center px-2 py-0.5 rounded(-full) text-xs font-medium border` +
  `bg-{c}-900/50 text-{c}-300 border-{c}-800`.
- **Icons:** no icon library — every icon is a hand-inlined Heroicons-outline SVG
  (`<svg … stroke="currentColor" stroke-width="2">`). The paperclip, upload, file-pdf, file-audio,
  play, eye, download, trash, and external-link icons in the mock are each authored as inline SVG.

### Surfaces the spec must cover
- **Files tab** in the Edit Song slideout — third tab beside Details and Lyrics, with a count badge;
  states: empty, populated, and upload-in-progress.
- **Songs-list Files column** — paperclip + "N files" / "none" (a toggleable column).
- **Drop zone** — "Drop files here, or click to browse" with the helper line reading the app's real
  limits: **PDF, MP3 · up to 50 MB each · several at once** (NOTE: no MP4/JPG/PNG — narrower than the
  Nocturne mock, per owner scope).
- **Per-file upload progress** row.
- **Documents / Audio grouped rows** — icon, name, metadata (type · pages-or-duration · size · date),
  per-group empty states, and per-row actions: **Preview (PDF) / Play (MP3)**, **Download**, **Remove**.
- **"Link instead of upload"** field — paste a YouTube / Google Drive / Dropbox link; linked media opens
  in a new tab (helper text says so).
- **Remove-everywhere note** — "Files attached here appear for every service that uses this song.
  Removing a file removes it everywhere — past services included."

### Scope guardrails (locked with owner 2026-09-05)
- Uploads = **PDF + MP3 only**, **≤ 50 MB/file**. No image/uploaded-video types (video via external link
  only). In-app PDF preview + MP3 player ARE in scope (design them). Editors mutate; viewers read-only.
- The mock/spec should NOT design: per-org quota UI, egress dashboards, per-file "share with volunteers"
  toggles, or any Rehearse/public-playback surface — all deferred to a later milestone.

### Claude's Discretion
- Exact spacing, mock HTML structure, and which mock states to render on one page vs several are at
  Claude's discretion, provided every surface above is shown app-fidelity.
</decisions>

<code_context>
## Existing Code Insights

### Reusable / analog surfaces (map the mock onto these)
- **`src/components/SongSlideOver.vue`** — the Edit Song slideout. Tab bar `SongSlideOver.vue:97–121`
  (`data-testid="tab-bar"`), `activeTab = ref<'details'|'lyrics'>('details')` at `:361`, tab panels
  gated on `activeTab`. A third `'files'` tab button + panel follows the same shape. Save via
  `songStore.updateSong(id, data)` at `:615`. Panel bg `bg-gray-900`, `border-l border-gray-800` (`:30`).
- **`src/utils/songEditLink.ts:4`** — `SongEditTab = 'details' | 'lyrics'` + `VALID_TABS` (`:6`); both
  gain `'files'` in the implementation phases.
- **`src/components/SongTable.vue`** — the songs list (rendered via `SongBrowser` inside
  `src/views/SongsView.vue`). Column `th`/`td` pairs gated on `songStore.columnVisibility.<col>`;
  `toggleableColumns` array `:330–337`. A "Files" column joins before the trailing chevron.
- **`src/stores/songs.ts`** — `useSongStore` (`:32`); `columnVisibility` + `DEFAULT_COLUMN_VISIBILITY`
  (`:50–58`); `updateSong` (`:296–302`, plain `updateDoc` — attachments ride through as a partial field,
  no new store method needed); Firestore path `organizations/{orgId}/songs/{songId}`.
- **`src/types/song.ts`** — `interface Song` (`:23–42`), `UpsertSongInput` (`:48`). An `attachments`
  field is added additive/optional (like the `Service.stageLayout` pattern).

### Upload / storage patterns to reuse (implementation phases, informs the spec's realism)
- **`src/composables/useMediaUpload.ts`** — `MEDIA_MAX_BYTES = 52428800` (**50 MB**, already our cap),
  path `orgs/${orgId}/media/${mediaId}/${sanitizeFileName(file.name)}`, `uploadBytesResumable` +
  `state_changed` progress. `useBackgroundUpload.ts` mirrors it (10 MB). A future `useSongFileUpload.ts`
  mirrors these with `SONG_FILE_MAX_BYTES` and path `orgs/${orgId}/song-files/${songFileId}/…`.
- **`storage.rules`** — `isOrgMember(orgId)` claim-only (`:47–49`); generic member catch-all
  `match /orgs/{orgId}/{allPaths=**}` (`:69–77`, write `size < 26214400`); dedicated `media/` block
  (`:60–67`) is the template for a `song-files/` block (sibling blocks are OR-combined, don't cascade).
- **Cleanup sweeps** — all four in `functions/src/cleanupSweeps.ts` use hard-anchored regex guards
  (`/^orgs\/[^/]+\/media\//`, `…/backgrounds/`, `…/pptx-imports/…`); a `song-files/` prefix matches
  none, so it is retention-exempt by construction (Phase 122 adds a locking test).

### Established patterns
- Tailwind v4 stock palette (no `tailwind.config`), gray-950/900/800 + indigo-600/500/400. Slideout
  header/body/footer shell shared with `TeamSlideOver.vue`. Hand-inlined SVG icons throughout.
</code_context>

<specifics>
## Specific Ideas

- The owner's mock content (drop-zone copy, Documents/Audio grouping, per-row actions, the
  "Link instead of upload" affordance, the remove-everywhere footnote) is the concrete target — reproduce
  its structure faithfully, only re-skinned to the app's palette and with the file-type copy corrected to
  "PDF, MP3 · up to 50 MB each".
- Produce a **standalone HTML mock** the owner can open (self-contained, app palette) so the "ux mocks"
  deliverable is something they can look at before implementation — surface it to the owner at phase end.
</specifics>

<deferred>
## Deferred Ideas

- Per-org storage quota UI, egress monitoring dashboards, per-file "share with volunteers" toggle, and
  the Rehearse/public-playback experience — all belong to the later Rehearse milestone, not this design
  contract.
</deferred>
