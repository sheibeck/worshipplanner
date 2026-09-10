# Phase 140 — Vamps UI Design Notes (from `Vamps.dc.html`, Turn 12 "one row, one vamp")

Source: owner's Claude Design project `e8e6c287-…` file `Vamps.dc.html`, imported via the design MCP
(DesignSync) 2026-09-09. Design system = **Nocturne** (dark). **Implement Turn 12 ("12a")** — the flat
one-vamp-per-row layout — because the owner chose **one vamp = one key**. (Turn 11's multi-key-per-vamp
layout is NOT what we build.) Map the Nocturne palette → the app's existing **dark gray-950** language,
mirroring the shipped `SongTable.vue` / `SongSlideOver.vue` components (same approach v2.11/v2.12 used).

## Placement
- A **`Songs | Vamps` tab bar** on the **Songs page** (`SongsView.vue`). Page title stays "Songs"; the two
  tabs each show a count badge (Songs: existing count; Vamps: vamp count). Vamps tab active = the vamp table.
- **New vamp** button top-right (accent), same position as the Songs "New" affordance.

## Vamp list (flat table, one vamp per row)
- Columns: **Vamp** (name) · **Key** (mono chip, e.g. `G`) · **Tempo** (mono, e.g. `68 bpm` or `—`) ·
  **Audio** (play icon + filename + length on the right; or a warning icon + "No MP3 attached" in an amber
  tone when no file).
- Search box above the table: "Search vamp name or key…" — filters by name or key.
- Sub-head under the title: e.g. "8 vamps · 6 with audio".
- Row click → opens the slide-out editor for that vamp (selected row highlighted).

## Slide-out editor (right drawer, ~488px, mirrors SongSlideOver)
- Header: "EDIT VAMP" eyebrow + `{name} · {key}` title; **Close** + **Save** buttons + an X.
- Fields:
  - **Name** — text input.
  - **Key** — a chip picker of the 12 keys: `C Db D Eb E F F# G Ab A Bb B` (selected chip = accent).
  - **Tempo** — freeform text input (optional; "68 bpm", "—"). Narrow (~132px).
  - **MP3** — when a file exists: a row with play/pause button + filename + meta ("MP3 · 4.8 MB · Sep 2,
    2026" + length) + a remove (×) button. When none: a dashed drop-zone button "Drop an MP3, or click to
    browse".
  - **Delete vamp** — a subtle destructive (amber/red-tinted) button at the bottom.
- Key model note (design caption): "one name, one key, one MP3 — so 'Open Response in G' and 'Open Response
  in A' are simply two entries."

## Data model (this phase)
- `Vamp` = `{ id, name: string, key: string, tempo?: string, attachment?: {storagePath, downloadUrl,
  fileName, sizeBytes, mimeType, createdAt, createdBy} | null, createdAt, updatedAt }`. One MP3 per vamp.
- Org-scoped Firestore collection (mirror how songs are stored per org). Storage prefix
  `orgs/{orgId}/vamp-files/{vampId}/{sanitizedName}` (sibling of `song-files/`, **outside `media/`**, so it's
  structurally retention-exempt — same cleanup-sweep exemption song-files relies on).
- Reuse the v2.11 upload pipeline: `useSongFileUpload`-style resumable upload (MP3 only, ≤50 MB), or a thin
  `useVampFileUpload` mirroring it; `songFileStoragePath`-style path helper (`vampFileStoragePath`).

## Reuse map (Nocturne token → app)
- `--color-accent*` → the app's existing accent/primary; `--color-neutral-*` / `#101220` grounds → the app's
  gray-950/900/800 surfaces; `--radius-md/sm` → existing rounded utilities; JetBrains-Mono key/tempo chips →
  the app's existing mono treatment for keys (Songs already renders a song **Key** with a type-ahead — reuse
  that key vocabulary). Phosphor icons → the app's existing icon set.

## Out of this phase
Assigning a vamp to a slide + live playback + audibility/arm-audio is **Phase 141** (R437–R440). Phase 140
is only the library: the tab, the flat table, the slide-out CRUD, and the storage/rules foundation.
