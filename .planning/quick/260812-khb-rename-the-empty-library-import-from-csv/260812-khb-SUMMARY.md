---
phase: 260812-khb-rename-the-empty-library-import-from-csv
plan: 01
subsystem: ui
tags: [vue, pinia, firestore, songs]

requires: []
provides:
  - "SongTable empty-state control renamed from 'Import from CSV' to 'Import Songs', emitting `import` into the same PcImportModal flow as the top-of-page button"
  - "Both import triggers gated on authStore.settings.pcEnabled"
  - "songStore.hardDeleteSong(id) — hidden-only, permanently deletes a song doc + its lyrics subcollection"
  - "Hidden Songs panel Delete button with inline (non-window.confirm) confirmation"
affects: [songs, roster]

tech-stack:
  added: []
  patterns:
    - "Per-row confirm-by-id state (ref<string | null>) for a destructive action inside a v-for list, mirroring SongSlideOver's single-row showDeleteConfirm pattern extended to multiple rows"

key-files:
  created: []
  modified:
    - src/components/SongTable.vue
    - src/components/__tests__/SongTable.test.ts
    - src/views/SongsView.vue
    - src/views/__tests__/SongsView.test.ts
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts

key-decisions:
  - "Empty-state help paragraph text branches on pcEnabled (drops the CSV/Planning Center mention when PC is off) rather than showing generic copy always, matching KHB-02's intent that PC-off orgs see no PC-flavored UI"
  - "hardDeleteSong uses deleteDoc directly when a song has no lyrics docs, and a writeBatch only when lyrics exist — avoids an unnecessary batch for the common song-with-no-split-lyrics case while still guaranteeing atomic multi-doc deletion when lyrics do exist"

requirements-completed: [KHB-01, KHB-02, KHB-03]

coverage:
  - id: D1
    description: "Empty-state 'Import Songs' button unifies with the top-of-page import flow and is PC-gated"
    requirement: "KHB-01"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#empty-state import button (KHB-01, KHB-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both import buttons hidden when authStore.settings.pcEnabled is false"
    requirement: "KHB-02"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongTable.test.ts#empty-state import button (KHB-01, KHB-02)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/SongsView.test.ts#SongsView (Wave 0 harness — Phase 39)"
        status: pass
    human_judgment: false
  - id: D3
    description: "songStore.hardDeleteSong permanently deletes a hidden song doc + lyrics subcollection, no-ops for non-hidden/unset-org/unknown-id cases"
    requirement: "KHB-03"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/songs.test.ts#hardDeleteSong"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hidden Songs list Delete button requires in-app confirmation before calling hardDeleteSong; Cancel aborts"
    requirement: "KHB-03"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SongsView.test.ts#Hidden Songs — permanent delete (KHB-03)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-08-12
status: complete
---

# Quick Task 260812-khb: Songs Library Import Rename, PC Gating, Permanent Delete Summary

**Empty-state library import unified into the existing PcImportModal flow, both import triggers gated on the Planning Center setting, and a confirmed hard-delete added for already-hidden songs**

## Performance

- **Duration:** 35 min
- **Tasks:** 3 (Task 2 is TDD: RED then GREEN)
- **Files modified:** 6

## Accomplishments
- SongTable's empty-state control now reads "Import Songs" (never "Import from CSV"), emits `import` instead of navigating via `router-link`, and opens the same `PcImportModal` the top-of-page button opens
- Both import triggers (top-of-page and empty-state) are gated on `authStore.settings.pcEnabled` — the top button was already gated; the empty-state one is now gated too, with its help copy adapting when PC is off
- `songStore.hardDeleteSong(id)` permanently deletes a song document and its `lyrics` subcollection in a single batch commit (or a plain `deleteDoc` when there are no lyrics docs), guarded to only ever act on an already-hidden song, and no-ops when `orgId` is unset or the song id isn't found
- Hidden Songs panel gained a Delete button per row with an inline, non-`window.confirm` confirmation (tracked per song id since the panel lists multiple rows) before calling `hardDeleteSong`

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename empty-state import to "Import Songs", unify flow, PC-gate it** - `7f03e22` (feat)
2. **Task 2: Add hardDeleteSong store action (RED)** - `5399dee` (test)
2. **Task 2: Add hardDeleteSong store action (GREEN)** - `8c8cc04` (feat)
3. **Task 3: Hidden Songs list — Delete button with in-app confirmation** - `5a30b17` (feat)

**Plan metadata:** committed separately by the orchestrator (this executor does not commit docs artifacts per its constraints)

_Task 2 followed the RED → GREEN cycle; no REFACTOR commit was needed since the initial implementation was already clean._

## Files Created/Modified
- `src/components/SongTable.vue` - Empty-state import control renamed/rewired to emit `import`, PC-gated; help copy branches on `pcEnabled`; added `import` to `defineEmits`
- `src/components/__tests__/SongTable.test.ts` - Extended the `@/stores/auth` mock with `settings.pcEnabled`; added tests for the renamed button's emit and its PC-gated absence
- `src/views/SongsView.vue` - Wired `SongTable`'s `@import` to `importModalOpen = true` (same state the top button sets); added Hidden Songs panel Delete button, `deleteConfirmId`/`deletingId` refs, and `onHardDeleteSong` handler
- `src/views/__tests__/SongsView.test.ts` - Added `mockHardDeleteSong` to the songs-store mock; added a describe block covering confirm-show, Cancel-aborts, and confirm-calls-hardDeleteSong
- `src/stores/songs.ts` - Added `hardDeleteSong(id)` action (imports `deleteDoc`, `getDocs`); exported it alongside `deleteSong`/`restoreSong`
- `src/stores/__tests__/songs.test.ts` - Added `getDocs` to the `firebase/firestore` mock with a configurable `mockLyricsDocs`, extended `mockBatch`/`mockBatchOps` to record `delete` ops, and added the `hardDeleteSong` describe block (5 tests)

## Decisions Made
- Kept the hidden-only guard in `hardDeleteSong` as defense-in-depth even though the UI only ever surfaces Delete on already-hidden rows (per the plan's threat model T-khb-02/03)
- Did not touch `firestore.rules` — verified during planning that the existing `allow read, write: if isOrgEditor(orgId)` rule on `songs/{songId}` (and its `lyrics` subcollection) already permits `delete`; this held true and no rules change was made or discovered to be necessary during execution

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched their `<action>` and `<done>` criteria without requiring Rule 1-4 auto-fixes.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Results

- `npm run type-check` (`vue-tsc --build`, which also typechecks test files): **clean, 0 errors**
- `npx vitest run` (bare app suite, excludes `src/rules.test.ts` via `vite.config.ts`): **3253 passed, 13 failed** — all 13 failures are in the two pre-existing documented-baseline files and are not new regressions:
  - `src/storage.rules.test.ts` — 12 tests time out (`Test timed out in 5000ms`) because no Storage emulator was running for this task; this is the documented "needs the Storage emulator" behavior (CLAUDE.md), and separately CLAUDE.md documents 2 of these as a genuine `firestore.exists()`-in-Storage-emulator defect unrelated to this task's changes
  - `src/views/__tests__/RosterView.test.ts` — 1 test (`wraps Roles config in CollapsibleSection`) fails on a stale assertion, documented as pre-existing in CLAUDE.md
  - No other test file regressed; nothing touched by this task's 3 changed source files (`SongTable.vue`, `SongsView.vue`, `songs.ts`) shows a new failure
- No change was made to `firestore.rules` — no `npm run test:rules` run and no `firebase deploy` step required for this task, as scoped

## Next Phase Readiness
This was a standalone quick task; no downstream phase depends on it. The Songs library page's empty-state import, PC gating, and permanent-delete affordances are complete and tested.

---
*Phase: 260812-khb-rename-the-empty-library-import-from-csv*
*Completed: 2026-08-12*

## Self-Check: PASSED

All 6 modified source/test files and the SUMMARY.md itself found on disk; all 4 task commit hashes (7f03e22, 5399dee, 8c8cc04, 5a30b17) found in git log.
