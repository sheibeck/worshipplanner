---
phase: 124-grouped-file-list-in-app-preview-play-download-remove
plan: 02
subsystem: ui
tags: [vue, teleport, dialog, audio, iframe, songs]

requires:
  - phase: 124-01
    provides: grouped Documents/Audio rows in SongFilesTab.vue with Download + Remove actions
provides:
  - SongFilePreviewModal.vue — a transient PDF preview overlay (iframe on downloadUrl) reusing the CleanupEnableConfirmDialog dialog shell
  - Preview (eye icon) wired onto document rows, opening the modal with that row's attachment
  - Play (play/pause icon) wired onto audio rows, revealing an inline native <audio controls> beneath the row, one at a time
  - Native-error fallbacks for both surfaces: "Couldn't preview this file." + Download, and "Couldn't play this file." + Download
affects: [124-grouped-file-list-in-app-preview-play-download-remove, song-file-attachments-v2.11]

tech-stack:
  added: []
  patterns:
    - "Transient overlay dismiss scoped to the dialog root's own @keydown listener (never window/document) so Escape can never bubble to and affect a sibling non-dismissing panel (SongSlideOver)."
    - "Teleport-based dialogs are tested with the same `global: { stubs: { Teleport: { template: '<div><slot /></div>' } } }` convention as CleanupEnableConfirmDialog.test.ts, so VTU's find()/findAll() can see the teleported DOM."

key-files:
  created:
    - src/components/SongFilePreviewModal.vue
    - src/components/__tests__/SongFilePreviewModal.test.ts
  modified:
    - src/components/SongFilesTab.vue
    - src/components/__tests__/SongFilesTab.test.ts

key-decisions:
  - "PDF preview built as a standalone SongFilePreviewModal.vue component (not inlined in SongFilesTab) mounted once at the tab root, driven by a single previewAttachment ref — matches the plan's interface_context and keeps SongFilesTab's template from growing a second dialog block per row."
  - "MP3 player state is a single playingId ref (not a per-row boolean map) — trivially enforces the one-at-a-time constraint by construction rather than by explicit collapse logic."
  - "Genuinely verified RED before GREEN for both tasks: SongFilePreviewModal.vue was moved aside to confirm its 9 tests fail on import-resolution before restoring it (8/9 initially failed pending the Teleport-stub fix); SongFilesTab.vue's Preview/Play changes were reverted via git checkout to confirm the 7 new tests fail against the 124-01 baseline before reapplying."

patterns-established:
  - "Icon-only row action buttons follow aria-label conventions already established by Download/Remove: `Preview {filename}` / `Play {filename}`."

requirements-completed: [R367]

coverage:
  - id: D1
    description: "Clicking Preview (eye) on a document row opens SongFilePreviewModal with that row's attachment; the modal renders a PDF iframe on downloadUrl and dismisses on Escape/backdrop-click/Close."
    requirement: "R367"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilePreviewModal.test.ts — dialog role/aria-modal, iframe src, Close/backdrop/Escape emit close"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#R367: Preview (PDF modal) + Play (inline MP3 player) > clicking Preview on a PDF row opens SongFilePreviewModal with that attachment"
        status: pass
    human_judgment: false
  - id: D2
    description: "The PDF modal shows a loading spinner before the iframe load event and the exact 'Couldn't preview this file.' + Download fallback on iframe error."
    requirement: "R367"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilePreviewModal.test.ts — loading spinner before/after load; iframe error swap"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clicking Play on an MP3 row reveals an inline native <audio controls> on downloadUrl; starting a second Play collapses the first (one at a time); a native error renders the exact 'Couldn't play this file.' + Download fallback."
    requirement: "R367"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#R367 — Play reveals audio, second Play collapses first, native error fallback"
        status: pass
    human_judgment: false
  - id: D4
    description: "Link rows expose neither Preview nor Play (open-in-new-tab only, per R365); document rows get Preview only, audio rows get Play only."
    requirement: "R367"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilesTab.test.ts#R367 — link/document/audio row action exclusivity"
        status: pass
    human_judgment: false
  - id: D5
    description: "Escape/backdrop dismiss on the PDF modal is scoped to the modal's own dialog-root keydown handler (not window/document), so it cannot bubble to or affect SongSlideOver's deliberately non-dismissing editing slideout (T-124-06)."
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongFilePreviewModal.test.ts — Escape on dialog root emits close; non-Escape keydowns do not"
        status: pass
    human_judgment: true
    rationale: "The absence of a window/document listener is verifiable by code review and by the fact these tests pass without a global listener registered, but there is no automated test that mounts SongSlideOver alongside the modal to prove no cross-component leakage — that integration is asserted by design (no window/document.addEventListener anywhere in SongFilePreviewModal.vue) rather than by a dedicated test."

duration: 20min
completed: 2026-09-05
status: complete
---

# Phase 124 Plan 2: In-App Preview & Play Summary

**New `SongFilePreviewModal.vue` (PDF iframe overlay reusing the CleanupEnableConfirmDialog shell) wired onto document rows via a Preview eye icon, plus an inline one-at-a-time native `<audio controls>` player wired onto audio rows via a Play icon — completes R367 and the Files tab's read-side UX for v2.11.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-05T16:13:40-04:00
- **Completed:** 2026-09-05T16:32:54-04:00
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `SongFilePreviewModal.vue`: a transient PDF viewer overlay (Teleport, backdrop, `role="dialog" aria-modal="true"`, `w-full max-w-3xl h-[85vh]`) with a filename+Download+Close header, an iframe body on `attachment.downloadUrl`, a loading spinner (SongTable.vue pattern), and the exact `"Couldn't preview this file."` + Download fallback on iframe error. Dismisses on Close click, backdrop `@click.self`, and Escape — the Escape handler is bound via `@keydown` on the dialog root element only, never window/document, so it structurally cannot bubble up and re-introduce dismiss behavior on SongSlideOver's editing slideout.
- `SongFilesTab.vue` now mounts `SongFilePreviewModal` once at the tab root (`previewAttachment` ref) and wires an eye-icon Preview button (before Download) onto every document row.
- `SongFilesTab.vue` audio rows get a play/pause toggle (before Download) tracked by a single `playingId` ref — clicking Play on a different row atomically collapses whichever track was previously expanded, since only one `id` can equal `playingId` at a time. The revealed `<audio controls :src="downloadUrl">` surfaces the exact `"Couldn't play this file."` + Download fallback on a native `error` event.
- Link rows are untouched by this plan — they keep only the existing open-in-new-tab action, exposing neither Preview nor Play (R365 unaffected).

## Task Commits

Each task followed the RED → GREEN TDD cycle with genuinely-verified failing tests before implementation:

1. **Task 1: Build SongFilePreviewModal.vue** — `f228fcd9` (test), `71f096e5` (feat)
2. **Task 2: Wire Preview + Play into the grouped rows** — `e700d693` (test), `e5771931` (feat)

**Plan metadata:** (this commit, following state updates)

## Files Created/Modified
- `src/components/SongFilePreviewModal.vue` - new transient PDF preview modal (iframe, loading/error states, DOM-scoped Escape/backdrop/Close dismiss)
- `src/components/__tests__/SongFilePreviewModal.test.ts` - 9 component tests covering render, dismiss paths, loading/error states
- `src/components/SongFilesTab.vue` - mounts SongFilePreviewModal; adds Preview button to document rows; adds Play toggle + inline `<audio>` + error fallback to audio rows
- `src/components/__tests__/SongFilesTab.test.ts` - 7 new tests covering Preview-opens-modal, modal-close-clears-state, Play-reveals-audio, one-track-at-a-time, native-error fallback, and per-kind action exclusivity

## Decisions Made
- Kept `SongFilePreviewModal` as its own component (plan's `interface_context` specified this explicitly) rather than inlining a second dialog block into `SongFilesTab.vue`.
- Used a single `playingId: Ref<string | null>` rather than a per-row boolean/Set — the "only one at a time" constraint falls out of the data structure instead of needing an explicit "collapse all others" step.
- Verified RED honestly rather than skipping it: for Task 1, temporarily moved `SongFilePreviewModal.vue` aside and confirmed the test file failed on import resolution; for Task 2, used `git checkout --` to revert the in-progress `SongFilesTab.vue` template/script changes and confirmed all 7 new tests failed against the 124-01 baseline, before restoring both implementations to reach GREEN.
- Adopted the existing `global: { stubs: { Teleport: { template: '<div><slot /></div>' } } }` convention from `CleanupEnableConfirmDialog.test.ts` in `SongFilePreviewModal.test.ts` — VTU's `find()`/`findAll()` don't otherwise see content that Vue teleports out to `document.body`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The only friction was discovering (via a first failing test run) that `@vue/test-utils`'s `find()`/`findAll()` don't search into `<Teleport>` targets by default — resolved by applying the codebase's existing Teleport-stub test convention, already used by `CleanupEnableConfirmDialog.test.ts`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
This is the **last plan of v2.11 (Song File Attachments)**. With this plan, the Files tab delivers all of R366 (grouped rows), R367 (in-app PDF preview + MP3 play), and R368 (download + remove) from Phase 121's design contract. The milestone's remaining outstanding item is the batched owner UAT deferred across phases 121-124 — no further autonomous build work is scoped for v2.11.

---
*Phase: 124-grouped-file-list-in-app-preview-play-download-remove*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files verified to exist on disk; all four task commits (f228fcd9, 71f096e5, e700d693, e5771931) verified present in git log.
