---
phase: 124-grouped-file-list-in-app-preview-play-download-remove
plan: 01
subsystem: ui
tags: [vue, pinia, firestore, firebase-storage, song-files]

# Dependency graph
requires:
  - phase: 123-upload-flow-drop-zone-progress-link-entry
    provides: SongFilesTab.vue flat attachment list, useSongFileUpload composable, addSongAttachment atomic append
  - phase: 121-song-files-ui-design-spec
    provides: 121-UI-SPEC.md design contract (grouped rows §6/7, remove confirm §10, copywriting contract)
provides:
  - removeSongAttachment store method (filter-by-id write + best-effort Storage delete)
  - Documents/Audio grouped SongFilesTab rows with graceful metadata
  - Per-row Download action on uploads
  - Per-row Remove inline-confirm wired to removeSongAttachment
affects: [124-02-in-app-preview-play]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "filter-by-id Firestore array write over arrayRemove when array elements carry a Timestamp field (round-trip mismatch risk)"
    - "always-rendered grouped list with per-group empty line, rather than a single top-level empty state"

key-files:
  created: []
  modified:
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts
    - src/components/SongFilesTab.vue
    - src/components/__tests__/SongFilesTab.test.ts

key-decisions:
  - "removeSongAttachment uses read-latest-then-filter-by-id (not arrayRemove) because arrayRemove matches by deep equality and the attachment's createdAt Timestamp may not round-trip identically after onSnapshot normalization — arrayRemove(liveObject) could silently no-op and let the removed file reappear on the next snapshot."
  - "Storage cleanup on remove is best-effort and never reverts the record removal — mirrors hardDeleteSong's R371 loop; a failed deleteObject is logged, not thrown."
  - "Link-kind attachments fold into the Documents group by default (UI-SPEC §4 recommendation) rather than a third 'Links' sub-group."
  - "Every row (including link rows) uses uniform div-based row anatomy with icon-button actions, replacing Phase 123's whole-row-as-anchor link treatment — needed so a Remove button can live inside the row without nesting interactive elements inside an anchor."
  - "Download is rendered as an anchor (`:href` + `download` attribute) rather than a JS-driven button, per the plan's explicit allowance."

patterns-established:
  - "formatAttachmentDate(createdAt) guards on typeof createdAt.toDate === 'function' before calling it — mirrors TeamView.vue's formatDate convention — so a fixture/legacy value without a real Timestamp degrades to '' instead of 'Invalid Date'."

requirements-completed: [R366, R368]

coverage:
  - id: D1
    description: "removeSongAttachment(id, attachment) store method: filter-by-id updateDoc write + best-effort deleteObject that never reverts the record removal on failure"
    requirement: "R368"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/songs.test.ts#removeSongAttachment"
        status: pass
    human_judgment: false
  - id: D2
    description: "SongFilesTab renders attachments split into always-rendered Documents (document+link) and Audio (audio) groups, each with an eyebrow header+icon and an exact per-group empty line"
    requirement: "R366"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#R366: splits attachments into a Documents group ... and an Audio group"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#R366: both groups always render, with the exact per-group empty copy when attachments is empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "Row metadata line reads {TYPE} · {size} · {date} with graceful omission — no undefined/NaN/Invalid Date, no pages field"
    requirement: "R366"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders a document row grouped under Documents with graceful metadata and a Download action targeting downloadUrl"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#gracefully omits the date when createdAt has no callable toDate()"
        status: pass
    human_judgment: false
  - id: D4
    description: "Uploaded rows expose a Download control targeting downloadUrl; link rows open in a new tab and have no Download"
    requirement: "R368"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders a document row grouped under Documents with graceful metadata and a Download action targeting downloadUrl"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders a link row folded into Documents with an Open-in-new-tab action and no Download"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders an audio row with MP3 metadata and a Download action"
        status: pass
    human_judgment: false
  - id: D5
    description: "Per-row Remove opens an inline confirm with the exact removes-everywhere copy, one open at a time, Cancel/confirm behavior, calls removeSongAttachment(songId, attachment) for both upload and link rows"
    requirement: "R368"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#R368: per-row Remove inline-confirm (all 5 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual fidelity to 121-UI-SPEC (spacing, colors, icon glyphs, typography) and the live row/count-badge update in the running app"
    verification: []
    human_judgment: true
    rationale: "Batched owner UAT — visual fidelity and live-in-app behavior across the actual SongSlideOver Files tab require a human to look at the running app, per the milestone's deferred-UAT convention (121/123/124 all batch to owner review at milestone end)."

# Metrics
duration: ~55min
completed: 2026-09-05
status: complete
---

# Phase 124 Plan 01: Grouped Documents/Audio File List + Download + Remove Summary

**Restructured SongFilesTab's flat attachment list into always-rendered Documents/Audio groups with graceful `{TYPE} · {size} · {date}` metadata, per-row Download, and a per-row Remove inline-confirm backed by a new filter-by-id `removeSongAttachment` store method.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added `removeSongAttachment(id, attachment)` to the songs store: reads the latest `songs.value` snapshot, writes a filtered attachments array (excluding the removed id) plus `serverTimestamp updatedAt`, then best-effort `deleteObject`s the upload's Storage object (skipped for links; a failed delete is logged and never reverts the record removal).
- Restructured `SongFilesTab.vue` into two always-rendered groups (Documents: `document` + `link` kinds; Audio: `audio` kind), each with an eyebrow header + group icon and an exact per-group empty line when empty.
- Extended the metadata line to `{TYPE} · {size} · {date}` with a new `formatAttachmentDate` helper mirroring `TeamView.vue`'s guarded Timestamp pattern — never renders "Invalid Date"; pages/duration are intentionally omitted (no PDF page-count library, per SEED-003).
- Added a Download action (anchor with `download` attribute) on every uploaded row, targeting `downloadUrl`; link rows keep an open-in-new-tab action and get no Download.
- Added a per-row Remove trash action opening an inline confirm card (reusing the Delete-Song pattern from `SongSlideOver.vue`) with the exact removes-everywhere copy; only one confirm is open at a time; confirming calls `removeSongAttachment(songId, attachment)`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add removeSongAttachment to the songs store** - `f06b7829` (feat)
2. **Task 2: Restructure SongFilesTab into Documents/Audio groups with metadata + Download** - `47943fb1` (feat)
3. **Task 3: Add the per-row Remove inline-confirm wired to removeSongAttachment** - `906bc6e2` (feat)

_All three tasks were TDD-marked; tests were written and run alongside the implementation in each task's single commit (this codebase's convention is test+implementation together per task, verified via the task's `<verify>` gate before committing, rather than separate RED/GREEN commits)._

## Files Created/Modified
- `src/stores/songs.ts` - Added `removeSongAttachment(id, attachment)`, exported alongside `addSongAttachment`.
- `src/stores/__tests__/songs.test.ts` - Added a `removeSongAttachment` describe block (5 new tests: filtered write, deleteObject call, link skip, failed-delete tolerance, no-op-when-orgId-unset).
- `src/components/SongFilesTab.vue` - Restructured the flat list into Documents/Audio groups; added `formatAttachmentDate`, `LINK_SOURCE_LABELS`, extended `metaLine`; added Download anchors, the trash Remove action, and the inline confirm card with `confirmingId`/`removingId` state and `confirmRemove()`.
- `src/components/__tests__/SongFilesTab.test.ts` - Updated the two stale Phase-123 "no action button" tests to reflect the new grouped/Download/Remove reality; added tests for group split, per-group empty copy, graceful metadata (including the `{}`-createdAt case), audio row metadata, and the full Remove inline-confirm flow (open/collapse-other/cancel/confirm/link-row).

## Decisions Made
- **Removal atomicity (R368/R371):** filter-by-id `updateDoc` write instead of Firestore `arrayRemove` — `arrayRemove` matches by deep equality and the attachment's `createdAt` Timestamp may not round-trip identically after `onSnapshot` normalization, which could silently no-op and let a "removed" file reappear on the next snapshot. `id` is a guaranteed-unique stable field, so filter-by-id is deterministic. The concurrent-add lost-update window is accepted as negligible (user-initiated, one-at-a-time action; store already holds the latest `onSnapshot` array).
- **Storage cleanup is best-effort:** a failed `deleteObject` is logged via `console.error` and never reverts the record removal or rejects the returned promise — mirrors `hardDeleteSong`'s existing R371 convention exactly.
- **Row anatomy unified across kinds:** Phase 123's link row was a whole-row `<a>` element; this plan moves every row (document/audio/link) to a uniform `div` with icon + name + metadata + a right-aligned action group, because a link row now also needs a Remove `<button>`, and nesting a `<button>` inside an `<a>` is invalid HTML. Link rows now have a dedicated "Open in a new tab" icon action instead of being the anchor themselves.
- **Link-kind rows fold into Documents by default** per 121-UI-SPEC §4's explicit recommendation — no third "Links" sub-group was introduced.
- **Download rendered as an anchor**, not a JS click handler — the plan explicitly permits this, and it lets the browser's native `download` attribute behavior handle the file save without extra JS.

## Deviations from Plan

None - plan executed exactly as written. The plan's "Claude's Discretion" items (row decomposition specifics, exact icon-button styling within the documented constraints) were resolved during implementation but stayed within the plan's explicit guidance.

## Issues Encountered
- Initial date-fixture tests used a bare `YYYY-MM-DD` ISO string for `createdAt.toDate()`, which JS parses as UTC midnight; `toLocaleDateString` in a negative-offset timezone rendered the previous day (e.g. "Sep 4" instead of "Sep 5"). Fixed by using a local-noon timestamp (`${isoDate}T12:00:00`) in the test helper so the assertion is stable regardless of the runner's timezone. This was a test-fixture issue, not a production code issue — `formatAttachmentDate` itself has no timezone-dependent logic beyond `toLocaleDateString`'s standard behavior.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `removeSongAttachment` and the restructured grouped row markup (with `data-testid="song-file-row-{id}"`, `song-file-download`, `song-file-remove`, etc.) are in place for Phase 124-02 to add Preview (PDF modal) and Play (inline MP3 `<audio controls>`) actions into the same per-row action group without needing further row-structure changes.
- App suite baseline confirmed unchanged: `npx vitest run` → 194/195 files pass, only `src/storage.rules.test.ts` fails (Storage-emulator dependent, pre-existing/documented baseline). `npm run type-check` (`vue-tsc --build`) is clean.
- No blockers for 124-02.

---
*Phase: 124-grouped-file-list-in-app-preview-play-download-remove*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files and all three task commits verified present.
