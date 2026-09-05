---
phase: 123-files-tab-songs-list-column-upload-external-link-attach
plan: 03
subsystem: ui
tags: [vue, pinia, firestore, file-upload, external-link, song-attachments]

requires:
  - phase: 123-01
    provides: useSongFileUpload composable (client validation + resumable upload + progress rows) and songLinks helper (isValidExternalLink/inferLinkSource/buildLinkAttachment)
provides:
  - Files tab in SongSlideOver's tab bar (edit mode only) with a live indigo count badge
  - SongFilesTab.vue panel: drop zone (drag-drop + click, multi-file, per-file progress/rejection), external-link field, functional attachment list
  - 'files' added to SongEditTab/VALID_TABS so ?tab=files arriving links work
affects: [124-song-files-preview-manage]

tech-stack:
  added: []
  patterns:
    - "Live store resolution by id (songStore.songs.find) instead of a stale props reference, for a computed that must reflect just-written data without a remount"
    - "Attachments persisted independently of the edit form (outside FormState/unsavedGuard) so growing a collection never dirties or is clobbered by an unrelated Save"

key-files:
  created:
    - src/components/SongFilesTab.vue
    - src/components/__tests__/SongFilesTab.test.ts
  modified:
    - src/utils/songEditLink.ts
    - src/utils/__tests__/songEditLink.test.ts
    - src/components/SongSlideOver.vue
    - src/components/__tests__/SongSlideOver.test.ts
    - src/components/__tests__/SongLyricsTab.r035.test.ts

key-decisions:
  - "liveAttachments/filesCount computeds read songStore.songs.find(s => s.id === props.song.id) rather than props.song directly, falling back to props.song?.attachments for the (theoretical) case the song isn't yet in the store snapshot"
  - "Attachment mutation happens via direct updateSong calls from useSongFileUpload/SongFilesTab, never via SongSlideOver's onSave data object — so Save cannot clobber attachments and uploading cannot dirty the panel"
  - "Simple functional attachment-list rows only (icon + name + type/size meta); explicitly no preview/play/download/remove actions and no Documents/Audio grouping — deferred to Phase 124 per the 123-CONTEXT.md boundary"

patterns-established:
  - "Test-store mocks that back a computed reading a store's live array must expose it via a real Vue ref (not a plain-object getter over a mutable let), or reassigning the mock array will not invalidate the computed under test"

requirements-completed: [R361, R363, R365]

coverage:
  - id: D1
    description: "'files' added to SongEditTab/VALID_TABS so a ?tab=files link opens the Files tab"
    requirement: "R361"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/songEditLink.test.ts#accepts the files tab"
        status: pass
    human_judgment: false
  - id: D2
    description: "SongSlideOver shows a third Files tab (edit mode only) with a live indigo count badge shown only when count > 0"
    requirement: "R361"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#SongSlideOver — Files tab (R361)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Files panel attachments/count resolve LIVE from songStore.songs by id, not the stale props.song reference — a just-uploaded file appears without reopening the panel"
    requirement: "R361"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#resolves attachments LIVE from songStore.songs by id rather than the stale props.song reference"
        status: pass
    human_judgment: false
  - id: D4
    description: "SongFilesTab drop zone: exact copy, hidden multi-file input (.pdf,audio/mpeg), click-to-browse and drag-and-drop both call useSongFileUpload's addFiles with the live existingAttachments context"
    requirement: "R363"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders the drop zone with exact primary and helper copy"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#picking files via the input calls addFiles with the upload context"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#dropping files calls addFiles and clears the drag-over state"
        status: pass
    human_judgment: false
  - id: D5
    description: "Per-file upload progress rows (bar + percent) and rejected/error rows (red rejection message) render from useSongFileUpload's uploads"
    requirement: "R363"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders an in-flight upload row with a progress bar and percent"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders a rejected upload row with its red rejection message"
        status: pass
    human_judgment: false
  - id: D6
    description: "External-link field: exact copy; invalid link shows the UI-SPEC error and persists nothing; valid https link appends a kind:'link' attachment via updateSong and clears the field"
    requirement: "R365"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#submitting an invalid link shows the exact error and persists nothing"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#submitting a valid https link appends a kind:link attachment via updateSong and clears the field"
        status: pass
    human_judgment: false
  - id: D7
    description: "Functional attachment list: document/audio rows show name + type/size meta with NO action buttons; link rows are anchors opening in a new tab with rel=noopener noreferrer"
    requirement: "R361"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders a document row with name and no download/preview/remove action button"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#renders a link row as an anchor opening in a new tab with rel noopener"
        status: pass
    human_judgment: true
    rationale: "Visual fidelity against 121-song-files-mock.html (spacing, color, icon glyphs) is an owner-facing batched UAT item per the plan's own verification section — unit tests prove structure/behavior, not pixel parity."

duration: 55min
completed: 2026-09-05
status: complete
---

# Phase 123 Plan 03: Files Tab UI (drop zone, link field, attachment list) Summary

**Third Files tab in SongSlideOver with a live count badge, wired to a new SongFilesTab.vue panel that hosts the drag-drop/click multi-file upload zone (per-file progress + rejection), an external-link attach field, and a simple functional attachment list — attachments resolve live from the Pinia store by id so uploads appear without reopening the panel.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-05T18:53:00Z (approx, pre-session)
- **Completed:** 2026-09-05T18:11:28Z
- **Tasks:** 3 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Extended `SongEditTab`/`VALID_TABS` with `'files'` so the arriving-link seam (`?edit=<id>&tab=files`) works.
- Built `SongFilesTab.vue`: drop zone (drag-drop + click-to-browse, hidden multi-file input, drag-over state), external-link field (https validation, source inference, updateSong append), per-file upload progress/rejection rows, and a functional attachment list (document/audio rows with type+size meta, link rows as new-tab anchors with `rel="noopener noreferrer"`).
- Wired the Files tab + live indigo count badge + panel into `SongSlideOver.vue`, resolving attachments live from `songStore.songs` by id rather than the stale `props.song` reference — the load-bearing key-link from the plan's `critical_correctness` section.
- Kept attachments entirely out of the edit form/unsavedGuard/save path so growing the attachment collection never dirties the panel and Save never clobbers attachments.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 'files' to SongEditTab + VALID_TABS (R361)** - `7bd80c5c` (feat)
2. **Task 2: SongFilesTab.vue — drop zone, link field, attachment list (R363/R365 UI)** - `f32432d9` (test, RED) → `0badc8ef` (feat, GREEN)
3. **Task 3: Files tab + live count badge + panel in SongSlideOver (R361)** - `33e93fff` (feat)

_TDD task (Task 2) has two commits: a RED test commit proving the component didn't exist, then a GREEN feat commit with the passing implementation (12/12 tests). No REFACTOR commit was needed._

## Files Created/Modified
- `src/components/SongFilesTab.vue` - New presentational panel: drop zone, link field, upload progress rows, functional attachment list
- `src/components/__tests__/SongFilesTab.test.ts` - 12 tests covering copy, drag/drop/click upload wiring, link validation/persist, row rendering, upload progress/rejection
- `src/utils/songEditLink.ts` - Widened `SongEditTab` union + `VALID_TABS` to include `'files'`
- `src/utils/__tests__/songEditLink.test.ts` - Added a case proving `?tab=files` parses correctly
- `src/components/SongSlideOver.vue` - Added the Files tab button + badge, the Files panel mounting `SongFilesTab`, and the `liveAttachments`/`filesCount` computeds
- `src/components/__tests__/SongSlideOver.test.ts` - Added `songs` (via a real `ref`) to the mock store so `liveAttachments` resolves without crashing, plus 5 new Files-tab tests
- `src/components/__tests__/SongLyricsTab.r035.test.ts` - Widened `mountDrawer`'s local `initialTab` type to `SongEditTab` and added a `songs` getter to the mock store (both broken purely by the `SongEditTab`/`liveAttachments` widening from this plan, not related to R035's own subject matter)

## Decisions Made
- `liveAttachments` falls back to `props.song?.attachments ?? []` only when the song isn't found in `songStore.songs` (e.g. a brand-new song mid-creation before the store's onSnapshot delivers it) — the store lookup is always tried first.
- The attachment list's per-row meta line uses only fields this phase actually persists (`type + size`, e.g. "PDF · 2.4 MB") — no pages/duration, since `SongAttachment` carries neither field (that's a data/schema concern out of scope here, matching the plan's explicit instruction).
- Icon paths sourced as the standard Heroicons v2 outline glyphs (`arrow-up-tray`, `document-text`, `musical-note`, `exclamation-triangle`); the `arrow-top-right-on-square` link glyph reuses the exact `d` path already in `SongSlideOver.vue`'s SongSelect link (per the UI-SPEC's explicit instruction to match it verbatim).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two existing test files broke from the `SongEditTab`/`liveAttachments` type and computed changes, not from any defect in their own subject matter**
- **Found during:** Task 1 (type-check) and Task 3 (test run)
- **Issue:** (a) `SongLyricsTab.r035.test.ts`'s local `mountDrawer` helper hard-typed `initialTab?: 'details' | 'lyrics'`, which no longer accepted the widened `SongEditTab` return type from `parseSongEditRequest`. (b) Both `SongSlideOver.test.ts` and `SongLyricsTab.r035.test.ts` mock `@/stores/songs` with an object that had no `songs` property — `SongSlideOver.vue`'s new `liveAttachments` computed calls `songStore.songs.find(...)`, which threw `TypeError: Cannot read properties of undefined (reading 'find')` against the old mock shape.
- **Fix:** Widened the `mountDrawer` type to `SongEditTab` (imported from `@/utils/songEditLink`); added a `songs` getter backed by a mutable `let`/`ref` to both mock stores, seeded with the mounted song in each `mountDrawer` call. `SongSlideOver.test.ts`'s mock specifically uses a real Vue `ref` (not a plain-object getter over a `let`) so that reassigning it during a test actually invalidates `liveAttachments`' Vue-reactivity tracking — proven by the new "resolves attachments LIVE..." test.
- **Files modified:** `src/components/__tests__/SongLyricsTab.r035.test.ts`, `src/components/__tests__/SongSlideOver.test.ts`
- **Verification:** `npm run type-check` clean; `npx vitest run src/components/__tests__/SongSlideOver.test.ts src/components/__tests__/SongLyricsTab.r035.test.ts src/views/__tests__/SongsView.test.ts` — 44/44 pass; full `npx vitest run` — 194/195 files pass (only the known `storage.rules.test.ts` Storage-emulator baseline fails)
- **Committed in:** `7bd80c5c` (SongLyricsTab.r035.test.ts type fix, part of Task 1) and `33e93fff` (both files' `songs` mock fix, part of Task 3)

---

**Total deviations:** 1 auto-fixed (Rule 1 — pre-existing test breakage caused directly by this plan's own type/computed widening, not unrelated scope creep)
**Impact on plan:** Necessary to keep the existing test suite green; no behavior outside the plan's own files was touched.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 124 can build the per-row preview/play/download/remove actions and the polished Documents/Audio grouping directly on top of `SongFilesTab.vue`'s existing attachment-list rendering and `liveAttachments` plumbing — no rework needed to add those actions.
- Owner batched UAT item still pending (per the plan's own verification section, not a plan gate): visually compare the running Files tab to `121-song-files-mock.html` for fidelity (R373).

---
*Phase: 123-files-tab-songs-list-column-upload-external-link-attach*
*Completed: 2026-09-05*

## Self-Check: PASSED
All created files verified present on disk; all 4 task/RED-GREEN commits verified present in git log.
