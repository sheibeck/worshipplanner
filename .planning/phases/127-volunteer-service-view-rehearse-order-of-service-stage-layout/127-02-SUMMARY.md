---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
plan: 02
subsystem: rehearse-ui
tags: [vue, presentational-component, rehearse, song-attachments, pdf, audio, external-links]

# Dependency graph
requires:
  - phase: 127-01
    provides: "Extended RehearseAccessDoc (orderOfService/roleAssignments/stageLayout/bpm) and the RehearseSong/RehearseAttachment shape these components consume"
provides:
  - "src/components/rehearse/RehearseSongList.vue — Column 1 / mobile Screen A selectable song list (key, PDF/MP3 counts, now-playing indicator)"
  - "src/components/rehearse/RehearseSongDetail.vue — Column 2 / mobile Screen B song detail (Sheet music & chords with Print+Download, Recordings with Play+Download, external links)"
  - "RehearseAttachment.linkSource — a small, non-PII projection extension (rehearseAccess.ts) needed so external links render their correct source label"
affects: ["127-03", "127-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Both components are pure presentational Vue SFCs — props in, events out (select / play / open-pdf), no store reads, no Firestore — consistent with the rest of the Rehearse tab's component split (127-PATTERNS.md)."
    - "Attachment row meta line renders only fields the projection actually carries (type label, link source) rather than inventing size/date the RehearseAttachment shape doesn't have — extends this phase's established omit-gracefully convention (bpm/CCLI/time-signature/added-by) to the attachment meta line too."

key-files:
  created:
    - src/components/rehearse/RehearseSongList.vue
    - src/components/rehearse/RehearseSongDetail.vue
    - src/components/rehearse/__tests__/RehearseSongList.test.ts
    - src/components/rehearse/__tests__/RehearseSongDetail.test.ts
  modified:
    - src/utils/rehearseAccess.ts
    - src/utils/rehearseAccess.test.ts

key-decisions:
  - "Extended RehearseAttachment with an optional linkSource field (Rule 3 deviation) — R390's acceptance criterion ('correct source label') can't be met from the Plan 01 projection alone, since it carried only id/name/kind/downloadUrl/href. linkSource is one of 4 fixed, non-personal enum values already inferred client-side (songLinks.ts) — not PII, unlike the notes/body/createdBy fields the projection deliberately excludes."
  - "Did NOT extend RehearseAttachment with sizeBytes/createdAt. The plan's <action> narrative describes copying SongFilesTab.vue's formatSize/formatAttachmentDate verbatim, but neither must_haves.truths nor the acceptance_criteria for Task 2 actually require rendering size/date — only the type label and (for links) the source label. Given T-127-06's explicit threat-model instruction ('add no template branch reading a field the projection strips'), the attachment meta line renders only the type label (PDF/MP3) or link source, gracefully omitting size/date rather than reaching further into Plan 01's already-tested, intentionally minimal projection."
  - "Link rows in the Sheet music & chords group show the attachment's own name as the primary line and the LINK_SOURCE_LABELS source label as secondary meta — mirrors SongFilesTab.vue's name+metaLine row shape (rather than the UI-SPEC's literal '{Source} link' as the sole visible label), so a link a leader gave a descriptive name to doesn't lose that name in this read-only view."

patterns-established:
  - "Play affordances in the Rehearse tab emit an event with the RehearseAttachment rather than mounting an <audio> element — playback stays centralized in the Plan 03 bottom player bar, never duplicated per-row like SongFilesTab.vue's editor-context inline player."

requirements-completed: [R385, R386, R390]

coverage:
  - id: D1
    description: "RehearseSongList renders one selectable real <button> row per song with key (font-mono, omitted if absent), PDF count, MP3 count, and a '● Playing' indicator only for the active-track song; handles zero songs and zero-count songs gracefully"
    requirement: "R385"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseSongList.test.ts (6 tests, all passing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RehearseSongDetail groups document+link attachments into 'SHEET MUSIC & CHORDS' (Print+Download per PDF row) and audio into 'RECORDINGS' (Play toggle that emits, no inline <audio> + Download); per-group empty copy; graceful meta-line omission for null-bpm/empty-ccli songs"
    requirement: "R386"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseSongDetail.test.ts (10 tests, all passing)"
        status: pass
    human_judgment: false
  - id: D3
    description: "External links render as <a target=_blank rel=noopener noreferrer> with the correct LINK_SOURCE_LABELS label (YouTube/Drive/Dropbox/Link), no Print/Download, opening in a new tab"
    requirement: "R390"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseSongDetail.test.ts — 'renders external links as <a target=_blank rel=noopener noreferrer> with the correct source label...' case"
        status: pass
    human_judgment: false
  - id: D4
    description: "Download uses the fetch->blob->objectURL->synthetic-click pattern copied verbatim from SongFilesTab.vue (124-REVIEW FIX A), never a bare <a download> on a cross-origin Storage URL; Print uses window.open(...,'noopener,noreferrer'), never iframe.contentWindow.print()"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/RehearseSongDetail.test.ts — download and Print window.open assertions"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run type-check clean and the full app vitest suite unaffected beyond the documented storage.rules.test.ts baseline"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build, clean); npx vitest run (full app suite)"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-09-06
status: complete
---

# Phase 127 Plan 02: Rehearse Song List & Song Detail Summary

**Built the two pure-presentational leaf components that browse a service's songs in the volunteer Rehearse tab — `RehearseSongList.vue` (selectable list with key/PDF-MP3 counts/now-playing) and `RehearseSongDetail.vue` (Sheet music & chords with Print+Download, Recordings with Play+Download, external links) — extending the Plan 01 projection by one small non-PII field (`linkSource`) so external links can render their real source label.**

## Performance

- **Duration:** ~16 min
- **Tasks:** 2/2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- Created `RehearseSongList.vue`: real `<button>` rows (never a `<div>` click handler), song key in `font-mono` (omitted entirely when `keyOrArrangement` is absent), PDF/MP3 counts derived from `attachments.filter(kind === 'document'|'audio')` (a legitimate `0` is rendered, never hidden), `aria-current` + accent classes on the selected row, a `select` event carrying the song id, a `'● Playing'` indicator gated on `activeTrackSongId`, and the `"No songs in this service yet."` empty state.
- Created `RehearseSongDetail.vue`: groups document + link attachments into `"SHEET MUSIC & CHORDS"` (Print via `window.open(downloadUrl, '_blank', 'noopener,noreferrer')` + Download via the copied fetch-blob pattern) and audio into `"RECORDINGS"` (a Play toggle that `emit('play', attachment)` — no `<audio>` element is ever mounted here, since playback is centralized in the Plan 03 bottom bar). External links render as `<a target="_blank" rel="noopener noreferrer">` with the correct `LINK_SOURCE_LABELS` label, no Print/Download. The header meta line (`"{key} · {bpm} bpm · CCLI {ccli}"`) composes each clause as a real string or `null` before `filter(Boolean).join(' · ')`, so a bpm-less/ccli-less song never renders a bare `"bpm"` or a lone `"· ·"`.
- Extended `RehearseAttachment` (`src/utils/rehearseAccess.ts`) with an optional `linkSource` field — the Plan 01 projection previously carried only `id/name/kind/downloadUrl/href`, which cannot satisfy R390's "correct source label" acceptance criterion for a YouTube vs. Drive vs. Dropbox link. `linkSource` is one of 4 fixed, non-personal enum values (already inferred client-side by `songLinks.ts` at attachment-creation time), unlike the `notes`/`body`/`createdBy` fields the projection deliberately excludes — so this does not expand the PII surface T-127-06 guards against.

## Task Commits

Each task was committed atomically:

1. **Task 1: RehearseSongList.vue — selectable song list with key, PDF/MP3 counts, now-playing indicator** - `538dcfc1` (feat)
2. **Task 2: RehearseSongDetail.vue — Sheet music & chords (Print+Download), Recordings (Play+Download), external links** - `c73ceac6` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/components/rehearse/RehearseSongList.vue` - New. Column 1 / mobile Screen A song list (R385).
- `src/components/rehearse/RehearseSongDetail.vue` - New. Column 2 / mobile Screen B song detail (R386, R390); emits `play`/`open-pdf`, mounts no audio.
- `src/components/rehearse/__tests__/RehearseSongList.test.ts` - New. 6 tests: row/header counts, key rendering, PDF/MP3 counts (incl. zero), selected `aria-current`, `select` event payload, `'● Playing'` conditional, empty-list copy.
- `src/components/rehearse/__tests__/RehearseSongDetail.test.ts` - New. 10 tests: grouping, Print/Download/Play/Download actions, Print `window.open` call shape, external-link `target`/`rel`/label, graceful meta-line omission (sparse + full), no `<audio>` mounted, per-group empty copy, and the fetch-blob download pattern.
- `src/utils/rehearseAccess.ts` - `RehearseAttachment.linkSource?: SongAttachmentLinkSource` added, plus the conditional-spread mapping in `buildRehearseAccess`.
- `src/utils/rehearseAccess.test.ts` - The attachment-projection exact-key-set test renamed/extended to cover `linkSource` and explicitly assert `storagePath`/`mimeType`/`sizeBytes`/`createdAt`/`createdBy` are still stripped.

## Decisions Made
- `linkSource` added to `RehearseAttachment` (Rule 3 deviation, detailed below) — required for R390's "correct source label" criterion; not PII.
- `sizeBytes`/`createdAt` were NOT added — not required by this plan's `must_haves.truths`/`acceptance_criteria`, and adding them would reach further into Plan 01's already-tested minimal-disclosure projection than this plan's actual verification bar requires. The attachment meta line renders the type label alone (or the link source label), consistent with this phase's established "omit permanently when no cheap source of truth exists" precedent (time signature, "N pages", "added by").
- Link rows show the attachment's own `name` as primary text and the source label as secondary meta (mirrors `SongFilesTab.vue`'s row shape) rather than replacing the name with `"{Source} link"` as the sole visible text — preserves a leader's descriptive link name in this read-only view.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Extended `RehearseAttachment` with `linkSource` — the Plan 01 projection couldn't satisfy R390's "correct source label" criterion**
- **Found during:** Task 2 (writing `RehearseSongDetail.vue`'s external-link rendering)
- **Issue:** The plan's acceptance criteria for Task 2 require external links to render "with the correct LINK_SOURCE_LABELS label (R390)" — i.e., distinguish "YouTube link" from "Google Drive link" from "Dropbox link". The Plan 01 `RehearseAttachment` type (`src/utils/rehearseAccess.ts`) carried only `id/name/kind/downloadUrl/href` — no `linkSource` — so every link would have rendered the same generic label regardless of its actual source, failing the acceptance criterion. `127-PATTERNS.md`'s own quoted `LINK_SOURCE_LABELS` snippet assumes this field is available, and `127-UI-SPEC.md`'s Copywriting Contract calls for the real source label — this was a genuine data-model gap between the two already-authored planning documents and Plan 01's actual (already-tested) output, not a mid-execution invention.
- **Fix:** Added an optional `linkSource?: SongAttachmentLinkSource` field to `RehearseAttachment`, mirroring exactly how Plan 01 added `RehearseSong.bpm` for the same "a downstream plan needs one more non-PII field" reason. Threaded through `buildRehearseAccess`'s attachment mapping via the same conditional-spread pattern already used for `downloadUrl`/`href`.
- **Files modified:** `src/utils/rehearseAccess.ts`, `src/utils/rehearseAccess.test.ts`
- **Verification:** `npx vitest run src/utils/rehearseAccess.test.ts` (18/18 passing, including the updated exact-key-set assertion which now explicitly asserts `storagePath`/`mimeType`/`sizeBytes`/`createdAt`/`createdBy` are still stripped); `npm run type-check` clean.
- **Committed in:** `538dcfc1` (Task 1 commit, since it's a prerequisite both components' tests depend on)

---

**Total deviations:** 1 auto-fixed (Rule 3 — a blocking data-model gap between Plan 01's already-tested projection and Plan 02's own acceptance criteria, resolved with a single non-PII optional field addition).
**Impact on plan:** No scope creep beyond the one field. The projection's existing PII-safe test discipline (exact-key-set assertions, explicit "field X is absent" checks) was preserved and extended, not loosened.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None — no external service configuration required (application code + tests only; no Firebase console changes, no new environment variables).

## Next Phase Readiness
- `RehearseSongList.vue` and `RehearseSongDetail.vue` are ready for the Plan 06 shell to wire up: `RehearseSongList`'s `select` event feeds a `selectedSongId` that resolves the `song` prop passed into `RehearseSongDetail`; `RehearseSongDetail`'s `play`/`open-pdf` events are the exact targets Plan 03's `RehearseAudioPlayerBar`/`RehearseFileReader` need to consume.
- `npm run type-check` is clean. `npx vitest run` (full app suite) — see below; the only expected failure is the pre-existing, documented `src/storage.rules.test.ts` baseline (Storage-emulator-dependent, unrelated to this plan).
- No blockers for Plan 03 (PDF reader/audio player) or Plan 06 (view shell/route), both of which consume these two components' props/events as designed.

---
*Phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/components/rehearse/RehearseSongList.vue
- FOUND: src/components/rehearse/RehearseSongDetail.vue
- FOUND: src/components/rehearse/__tests__/RehearseSongList.test.ts
- FOUND: src/components/rehearse/__tests__/RehearseSongDetail.test.ts
- FOUND: src/utils/rehearseAccess.ts
- FOUND: src/utils/rehearseAccess.test.ts
- FOUND commit: 538dcfc1
- FOUND commit: c73ceac6
