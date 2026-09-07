---
phase: 132-services-page-ux-alignment-verbiage-cleanup
plan: 03
subsystem: ui
tags: [vue, copy, planning-center]

requires:
  - phase: 132-services-page-ux-alignment-verbiage-cleanup (plan 01/02)
    provides: Services page header/mobile layout and share-page zebra striping (independent, no code overlap)
provides:
  - "Inventory-first KEEP / REMOVE-REWORD / NEVER-TOUCH classification of every 'Planning Center' occurrence under src/ (115 total)"
  - "Removed the incidental 'Planning Center already has this plan.' sentence from the Planned/locked banner"
affects: [ServiceEditorView, service-lock-banner]

tech-stack:
  added: []
  patterns:
    - "Inventory-and-classify before any find-and-replace on shared vocabulary that spans both real integration copy and incidental mentions"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue

key-decisions:
  - "Removed only the leading sentence of the hasPcExportEvidence branch of lockBannerBody; kept the 'Reopen it for editing...' guidance verbatim"
  - "Every other 'Planning Center' occurrence (114 of 115) classified KEEP or NEVER-TOUCH and left untouched — confirmed by grep and by npx vitest run showing zero new failures"

patterns-established:
  - "Inventory-first classification table as the audit trail before removing vocabulary shared between real integration copy and incidental UI mentions"

requirements-completed: [R409]

coverage:
  - id: D1
    description: "Inventory + classify every user-visible 'Planning Center' string under src/ into KEEP / REMOVE-REWORD / NEVER-TOUCH"
    requirement: "R409"
    verification:
      - kind: other
        ref: "git grep -n \"Planning Center\" -- src/ | wc -l  (115 occurrences enumerated and classified in this SUMMARY)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Remove the incidental 'Planning Center already has this plan.' sentence from the Planned/locked banner (lockBannerBody computed), keeping the Reopen guidance"
    requirement: "R409"
    verification:
      - kind: unit
        ref: "npx vitest run -- src/views/__tests__/ServiceEditorView.test.ts (5532 tests pass suite-wide; no test asserted the removed sentence)"
        status: pass
      - kind: other
        ref: "grep -rn \"already has this plan\" src/  (zero matches)"
        status: pass
      - kind: other
        ref: "KEEP-anchor grep: 'Export to Planning Center' / 'Exported to Planning Center' / 'exported to Planning Center' / 'Import from Planning Center' all present unchanged"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-07
status: complete
---

# Phase 132 Plan 03: Remove Incidental "Planning Center" Verbiage (R409) Summary

**Grep-inventoried all 115 "Planning Center" occurrences under `src/`, classified each KEEP / REMOVE-REWORD / NEVER-TOUCH, and removed the single owner-confirmed incidental sentence — the Planned/locked banner's "Planning Center already has this plan." — from `ServiceEditorView.vue`'s `lockBannerBody` computed, leaving all 114 other occurrences (real PC integration/export/import copy, comments, identifiers, API strings, tests) untouched.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-07T15:49:28Z
- **Tasks:** 2 (Task 1: inventory + classify; Task 2: remove the classified sentence)
- **Files modified:** 1 (`src/views/ServiceEditorView.vue`)

## Accomplishments
- Full inventory of every "Planning Center" occurrence under `src/` (115 lines via `git grep`), classified line-by-line.
- Confirmed the single owner-specified removal target: the leading sentence of `lockBannerBody`'s `hasPcExportEvidence` branch.
- Removed only that sentence; the "Reopen it for editing to change the order, slides or roles here." guidance is unchanged.
- Verified every KEEP-classified integration/export/import string (Settings PC section, Export/Exported to Planning Center, Import from Planning Center, PC/CSV/roster import modals, `serviceEditorActionBar`'s "Already exported to Planning Center") is byte-identical to before.
- `npm run type-check` (vue-tsc --build) passes clean.
- `npx vitest run`: 212/213 files pass, 5532/5567 tests pass (35 skipped); the only failing file is the documented baseline `src/storage.rules.test.ts` (Storage-emulator `firestore.exists()` cross-service limitation — pre-existing, unrelated to this change).

## Task Commits

Each task was committed atomically:

1. **Task 1: Inventory + classify every user-visible "Planning Center" string** — no commit (analysis-only; produced zero source diffs by design — see acceptance criteria "no source file was modified in this task"). Full classification table below, this SUMMARY is the audit record.
2. **Task 2: Remove the classified incidental banner sentence (R409)** — `444d78ce` (feat)

**Plan metadata:** (this commit, docs — see below)

## Files Created/Modified
- `src/views/ServiceEditorView.vue` — `lockBannerBody` computed, `hasPcExportEvidence` (true) branch: removed the leading "Planning Center already has this plan." sentence; kept "Reopen it for editing to change the order, slides or roles here." Single-line diff.

## Final Classification Table (Task 1 — auditable, all 115 occurrences)

Legend: **REMOVE** = incidental copy removed in Task 2. **KEEP** = real, user-visible Planning Center integration/export/import copy, left unchanged. **NEVER-TOUCH** = code identifier, inline comment, API/config string, or test fixture — out of bounds regardless of anything else.

### REMOVE (1 occurrence)

| # | File:Line | Copy | Classification |
|---|-----------|------|-----------------|
| 1 | `ServiceEditorView.vue:2189` | `lockBannerBody` computed, `hasPcExportEvidence` branch — leading sentence "Planning Center already has this plan." | **REMOVE** (owner-confirmed) — dropped; "Reopen it for editing to change the order, slides or roles here." retained |

### KEEP (30 occurrences — real, user-visible PC integration/export/import copy)

| # | File:Line(s) | Copy (summary) | Classification |
|---|--------------|-----------------|-----------------|
| 2 | `CsvImportModal.vue:39` | "Planning Center export format supported" | KEEP — real CSV-from-PC import guidance |
| 3 | `CsvImportModal.vue:93` | "How to export from Planning Center:" | KEEP |
| 4 | `CsvImportModal.vue:95` | "Go to Planning Center Music → Songs" | KEEP |
| 5 | `GettingStarted.vue:143` | "Import songs from Planning Center CSV or add them manually." | KEEP — onboarding pointer to real import |
| 6 | `PcImportModal.vue:36` | "Import from Planning Center" (heading) | KEEP — real PC song import UI |
| 7 | `PcImportModal.vue:79` | "Ready to sync songs from Planning Center." | KEEP |
| 8 | `PcImportModal.vue:99` | "Fetching songs from Planning Center..." | KEEP |
| 9 | `PcImportModal.vue:119` | "{N} songs total from Planning Center" | KEEP |
| 10 | `RosterImportModal.vue:36` | "Import from Planning Center" (heading) | KEEP — real PC roster import UI |
| 11 | `RosterImportModal.vue:83` | "Planning Center does not provide them; enter phone manually per person." | KEEP |
| 12 | `RosterImportModal.vue:172` | "Fetching from Planning Center..." | KEEP |
| 13 | `RosterImportModal.vue:192` | "{N} people total from Planning Center" | KEEP |
| 14 | `RosterImportModal.vue:233` | "Go to Settings to check your Planning Center credentials." | KEEP |
| 15 | `SongTable.vue:43` | "Import your songs from Planning Center or add them one at a time." | KEEP — points at the real import affordance |
| 16 | `RosterView.vue:21` | "Import from Planning Center" (button) | KEEP |
| 17 | `RosterView.vue:81` | "Import your team from Planning Center or add people one at a time." | KEEP |
| 18 | `RosterView.vue:89` | "Import from Planning Center" (empty-state button) | KEEP |
| 19 | `RosterView.vue:367` | "(manual — not synced from Planning Center)" | KEEP |
| 20 | `ServiceEditorView.vue:285` | "Planning Center export needs credentials for this organization —" | KEEP — real credentials-missing warning |
| 21 | `ServiceEditorView.vue:472` | "Export to Planning Center" (heading) | KEEP — real export UI |
| 22 | `ServiceEditorView.vue:654` | "Edits you make now won't reach Planning Center until you export again." | KEEP |
| 23 | `ServiceEditorView.vue:686` | "Exported to Planning Center" | KEEP |
| 24 | `ServiceEditorView.vue:2021` | "This service was exported to Planning Center. Deleting it here does not remove that plan." (`deleteConfirmBody`) | KEEP |
| 25 | `ServiceEditorView.vue:2201` | "This service was exported to Planning Center. That plan is still there — reopening here does not change or remove it." (`reopenPcWarning`) | KEEP |
| 26 | `ServiceEditorView.vue:3736` | "This service has already been exported to Planning Center. Reload to see the current state." | KEEP |
| 27 | `ServiceEditorView.vue:4074` | "The plan was written to Planning Center, but this service changed status before we ..." | KEEP |
| 28 | `SettingsView.vue:69` | "Planning Center Integration" (section heading) | KEEP |
| 29 | `SettingsView.vue:85` | "Enable Planning Center integration" | KEEP |
| 30 | `SettingsView.vue:89` | "...roster import, song import, and Export to Planning Center are hidden..." | KEEP |
| 31 | `SettingsView.vue:149` | placeholder "Your Planning Center App ID" | KEEP |
| 32 | `SettingsView.vue:159` | placeholder "Your Planning Center Secret" | KEEP |
| 33 | `serviceEditorActionBar.ts:92` | "Already exported to Planning Center" (action-bar button title, user-visible) | KEEP |

### NEVER-TOUCH (84 occurrences — comments, identifiers, API/config strings, test fixtures)

| # | File:Line(s) | Type | Classification |
|---|--------------|------|-----------------|
| 34 | `ScriptureInput.vue:261` | inline comment | NEVER-TOUCH |
| 35 | `ServiceEditorView.vue:275, 628, 1859, 1874, 2171, 3256, 3728, 4068` | inline comments | NEVER-TOUCH |
| 36 | `SettingsView.vue:67, 138, 597, 1014` | inline comments | NEVER-TOUCH |
| 37 | `serviceEditorActionBar.ts:29` | inline comment | NEVER-TOUCH |
| 38 | `auth.ts:124` | inline comment | NEVER-TOUCH |
| 39 | `quarters.ts:360` | inline comment | NEVER-TOUCH |
| 40 | `services.ts:527` | inline comment | NEVER-TOUCH |
| 41 | `songs.ts:460` | inline comment | NEVER-TOUCH |
| 42 | `organization.ts:32, 34` | JSDoc comment | NEVER-TOUCH |
| 43 | `roster.ts:27` | inline comment (`pcPersonId` field doc) | NEVER-TOUCH |
| 44 | `csvImport.ts:93` | JSDoc comment | NEVER-TOUCH |
| 45 | `pcSongImport.ts:6, 13, 44, 134, 290` | JSDoc/inline comments | NEVER-TOUCH |
| 46 | `planningCenterApi.ts:10, 55, 78, 227, 310, 391, 475, 665, 701, 820, 881, 889` | JSDoc/inline comments | NEVER-TOUCH |
| 47 | `scripture.ts:187` | inline comment | NEVER-TOUCH |
| 48 | `ScriptureInput.test.ts:204` | test comment | NEVER-TOUCH |
| 49 | `rules.test.ts:1972, 2085` | test comment / `describe()` label | NEVER-TOUCH |
| 50 | `auth.test.ts:1828` | `describe()` label | NEVER-TOUCH |
| 51 | `quarters.test.ts:1108` | `it()` label | NEVER-TOUCH |
| 52 | `services.test.ts:2127, 2128, 2407, 2439` | test comments / `it()` label | NEVER-TOUCH |
| 53 | `RosterView.test.ts:644, 650, 654, 660` | test comment / assertion literals | NEVER-TOUCH |
| 54 | `ServiceEditorView.test.ts:567, 1005, 1007, 1416, 1522, 5898, 5906, 5927, 5949, 6087, 6098, 6102, 6112, 7377, 7380, 7446, 7488` | test comments / `describe`/`it()` labels / assertion literals | NEVER-TOUCH |
| 55 | `SettingsView.test.ts:4, 322, 324, 334, 454, 482` | test comments / `describe`/`it()` labels / assertion literals | NEVER-TOUCH |
| 56 | `SongsView.test.ts:3, 10, 109, 138` | test comments | NEVER-TOUCH |
| 57 | `hymnRetirement.regression.test.ts:395` | `it()` label | NEVER-TOUCH |
| 58 | `serviceEditorActionBar.test.ts:359` | assertion literal (asserts the KEEP-classified `serviceEditorActionBar.ts:92` string, unchanged) | NEVER-TOUCH |

**Total: 1 REMOVE + 32 KEEP + 82 NEVER-TOUCH = 115** (matches `git grep -n "Planning Center" -- src/ | wc -l`).

Note: rows are grouped by file where the classification and content-type are identical across adjacent lines, to keep the table readable; every underlying line number from the raw `git grep` inventory is listed above (verified line-count match before and after grouping).

## Decisions Made
- Confirmed via test-suite inspection (`ServiceEditorView.test.ts:5940-5950`, `:5901-5907`) that no test asserts the removed "already has this plan" sentence's literal content — the only related assertions check for absence of "Planning Center" text in a *different* branch (no-evidence) and existence of the banner test-id, so the removal is test-safe. No test changes were required or made.
- Treated Task 1 as analysis-only with zero source diff, per the plan's own acceptance criteria ("no source file was modified in this task") — its output (this classification table) is the auditable artifact rather than a git commit.

## Deviations from Plan

None — plan executed exactly as written. Task 1's inventory reconciled cleanly against the planner's "Starting classification" table; no additional incidental strings were found beyond the single owner-confirmed banner sentence.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Deferred UAT

Running under `/gsd-autonomous` with UAT deferred to milestone end. The classification table above is the artifact for human review (owner should visually confirm the Planned/locked banner reads "Planned — editing is locked. Reopen it for editing to change the order, slides or roles here." with no Planning Center mention, when a service has PC export evidence). Not appended to `.planning/v2.14-DEFERRED-VERIFICATION.md` — orchestrator owns that file.

## Next Phase Readiness
- R409 complete. Plan 132-03 is independent of 132-01/132-02 (different files) — no blockers for phase close-out once all three plans in phase 132 are done.

---
*Phase: 132-services-page-ux-alignment-verbiage-cleanup*
*Completed: 2026-09-07*

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue
- FOUND: .planning/phases/132-services-page-ux-alignment-verbiage-cleanup/132-03-SUMMARY.md
- FOUND: 444d78ce (Task 2 commit)
