---
phase: 121-song-files-ui-design-spec
plan: 01
status: complete
completed: 2026-09-05
requirements: [R373]
files_changed:
  - .planning/phases/121-song-files-ui-design-spec/121-UI-SPEC.md
  - .planning/phases/121-song-files-ui-design-spec/121-song-files-mock.html
---

# Phase 121 Plan 01 — Summary

## What was delivered

**121-UI-SPEC.md** — the app-fidelity design contract for Song Files (R373). Authored by
gsd-ui-researcher, verified by gsd-ui-checker at **6/6 dimensions** (Copywriting, Visuals, Color,
Typography, Spacing, Registry Safety) after one revision. Covers every surface: the Files tab (empty /
populated / upload-in-progress), the Songs-list Files column, the drop zone, the "link instead" field,
per-file upload progress, Documents/Audio grouped rows, in-app PDF preview (modal) + MP3 player (inline
`<audio>`), and the inline remove-confirmation. Includes an Icon Inventory (Heroicons-outline glyphs), an
Access-Control section (editor mutates / viewer read-only), a full Copywriting Contract, and a resolved
`## UI Considerations` state-coverage table (20 covered, 1 backstop).

**121-song-files-mock.html** — a throwaway, self-contained HTML mock rendering the surfaces in the app's
real dark theme for owner review, with the corrected PDF+MP3-only ≤50MB copy.

## Key decisions locked for the implementation phases

- Files tab reuses the exact `SongSlideOver.vue:97–121` active/inactive tab idiom
  (`text-indigo-400 border-indigo-500` active); count badge only shows when count > 0.
- Songs-list Files column is a toggleable, plain-text column (paperclip + `none`/`1 file`/`N files`),
  positioned last before the trailing chevron.
- Drop zone accepts PDF + MP3 only, ≤ 50 MB, several at once; per-file client rejection continues the
  batch for valid files.
- External links (YouTube/Drive/Dropbox) appear as their own row with an open-in-new-tab glyph, no
  preview/play/download.
- In-app PDF preview = modal reusing the `CleanupEnableConfirmDialog.vue` dialog shell; MP3 = native
  `<audio controls>` inline expansion, one track at a time.
- Remove = the inline-expand confirm pattern from the existing Delete-Song flow, with the
  removes-everywhere copy.
- The legacy-song / no-`attachments`-field partial state is a **backstop** — must render identically to an
  empty array and never throw (held-out test owed in the implementation phases).

## Scope note

No app source (`src/**`, `functions/**`, `*.rules`) was touched — deliverables are the design contract +
mock only. Implementation lands in phases 122 (data/rules/retention), 123 (Files tab + upload UI), and
124 (preview/play/manage).

## Owner review (batched UAT)

The HTML mock is queued for the batched end-of-milestone owner review (see the v2.11 deferred-verification
list) — a visual look before shipping, not a blocking gate (R373 is satisfied by the checker-verified
UI-SPEC).
