# Phase 140: Vamps Library — CRUD & Storage - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **Vamps library** — a keyed audio-clip collection managed from a **"Vamps" tab on the Songs page**.
Delivers R435 (create/manage vamps: name + key + optional tempo + one MP3 ≤50 MB, stored in a retention-exempt
org-scoped prefix) and R436 (flat browsable/searchable one-vamp-per-row table + slide-out editor, built to
the `Vamps.dc.html` Turn-12 design).

Out of boundary: assigning a vamp to a slide, live playback, arm-audio, and Audience-only audibility — all
**Phase 141** (R437–R440). This phase is the library + storage foundation ONLY.
</domain>

<decisions>
## Implementation Decisions

### Placement & UX (from the owner-supplied `Vamps.dc.html`, confirmed 2026-09-09)
- **Vamps is a TAB on the Songs page** (a `Songs | Vamps` tab bar in `SongsView.vue`), per the owner's
  original "a Vamps tab in the songs page" and the design's Turn-12 layout — NOT a separate sidebar route.
  This **supersedes** the earlier requirements-draft wording ("dedicated page/sidebar nav").
- **Flat, one-vamp-per-row** table (design Turn 12 "12a"): columns **Vamp · Key · Tempo · Audio**; search by
  vamp name or key; "No MP3 attached" warning state; row-click opens a slide-out editor. Full structure,
  fields, and interactions are in **`140-DESIGN-NOTES.md`** (distilled from the design; the full HTML is
  re-fetchable via the design MCP `get_file`).
- **Slide-out editor** mirrors `SongSlideOver.vue`: Name input, Key chip-picker (12 keys), Tempo input, MP3
  attach/play/remove (dashed drop-zone when none), Delete vamp.

### Data model
- **Vamp = one name, one key, one optional tempo, one MP3** (1:1 with a Song row; "Open Response in G" and
  "…in A" are two separate vamps). Tempo is an **optional freeform string** ("68 bpm", "—") — INCLUDED per
  the design (this overrides the FEATURES-research "BPM is an anti-feature" note, because the owner designed
  tempo in).
- Org-scoped Firestore collection for vamps (mirror the per-org songs storage). Storage prefix
  `orgs/{orgId}/vamp-files/{vampId}/{sanitizedName}` — sibling of `song-files/`, **outside `media/`**, so it
  is structurally exempt from every retention/cleanup sweep (same guarantee song-files relies on;
  `MEDIA_PATH_GUARD` allowlist already excludes non-`media/` prefixes — verify no sweep change needed).
- Reuse the v2.11 upload pipeline: a `useVampFileUpload` mirroring `useSongFileUpload` (resumable, MP3 only,
  ≤50 MB, per-file progress) + a `vampFileStoragePath` helper mirroring `songFileStoragePath`.
- `storage.rules`: a `vamp-files/` block mirroring the shipped `song-files/` block (editor-gated,
  `audio/mpeg` only, <50 MB, immutable/editor-only). NOTE the `firestore.exists()`-in-Storage-emulator blind
  spot (CLAUDE.md): annotate expected-local-failure allow-cases; verify the real upload in a deployed env.

### Styling
- Map the Nocturne palette → the app's existing **dark gray-950** language, mirroring `SongTable.vue` /
  `SongSlideOver.vue` (same mapping approach v2.11/v2.12 used). Reuse the app's existing key vocabulary
  (Songs already has an editable Key with a type-ahead).

### Claude's Discretion
- Whether the vamps store is a standalone Pinia store (`vamps.ts` mirroring `songs.ts`) or folded near the
  songs store — recommend a standalone `vamps.ts` store, subscribed by org like `songs.ts`.
- Exact tab-bar component (new small component vs. inline in SongsView) and how the search/filter is shared
  with the Songs tab.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / Analogs
- `src/views/SongsView.vue` (add the `Songs | Vamps` tab bar here), `src/components/SongTable.vue` (flat
  table analog), `src/components/SongSlideOver.vue` (slide-out editor analog), `src/stores/songs.ts`
  (`useSongStore` subscribe/onSnapshot/CRUD analog for a new `useVampStore`).
- `src/composables/useSongFileUpload.ts` (resumable MP3 upload — mirror as `useVampFileUpload`),
  `src/utils/songFiles.ts` (`songFileStoragePath`, `SONG_FILE_MAX_BYTES`, `SONG_FILE_ALLOWED_MIME` — mirror
  as `vampFiles.ts`).
- `src/types/song.ts` (`SongAttachment` — analog for the vamp's single attachment).
- `storage.rules` (the `song-files/` block to mirror), `functions/src/cleanupSweeps.ts` (`MEDIA_PATH_GUARD` —
  confirm `vamp-files/` is exempt by construction).

### Established Patterns
- Per-org onSnapshot subscription via `watch(() => authStore.orgId, {immediate:true})` (church-switch safe).
- Editor-gated writes (`isEditor`/`canEdit`); Storage rules editor-gated by claim.
</code_context>

<specifics>
## Specific Ideas
- Add unit tests: a `vamps` store CRUD test (mirror the songs store tests), a `vampFiles` path/validation
  test, and a `storage.rules` vamp-files allow/deny test (annotating the 2 emulator-blind allow-cases like
  song-files does).
- The Vamps tab must be church-switch safe (re-subscribe on orgId change).
</specifics>

<deferred>
## Deferred Ideas
- Vamp→slide assignment, live playback, arm-audio, Audience-only audibility (Phase 141, R437–R440).
- Multi-key-per-vamp (design Turn 11) — explicitly NOT built; the owner chose one-key-per-vamp.
- Progression/scale-degree field (design Turn 11 only) — not in the chosen one-row model.
</deferred>
