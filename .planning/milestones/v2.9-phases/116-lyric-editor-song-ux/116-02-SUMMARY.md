---
phase: 116-lyric-editor-song-ux
plan: 02
subsystem: ui
tags: [vue, vitest, songLyrics, ccli, copyright]

# Dependency graph
requires:
  - phase: 116-lyric-editor-song-ux
    provides: "116-01's header changes to SongSlideOver.vue/SlideGrid.vue/SlidesTab.vue — independent surfaces from this plan's SongLyricEditor.vue changes, no conflict"
provides:
  - "An inline 'Edit credits'/'Add credits' form over the copyright block, saving all 5 CopyrightInfo fields through the existing saveLyrics without re-parsing lyric sections"
  - "A widened hasCredits display gate — the read-only copyright block now shows for ANY non-empty credit field, not only ccliSongNumber"
  - "History toggle button and history disclosure panel hidden from the lyric editor UI (LyricVersionHistory.vue and the store's version state/handlers untouched in code)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HISTORY_ENABLED = false template gate: keeps every symbol (showHistory, onSaveVersion, onRevertVersion, the LyricVersionHistory import) referenced by the template so a future re-enable is a one-line flip, rather than an unused-import risk from deleting the template usage."
    - "creditsForm holds authors/copyrightLines as newline-joined strings (authorsText/copyrightLinesText), split/trimmed/filtered only at save time — keeps the textarea v-model simple while the persisted CopyrightInfo stays string[]."

key-files:
  created: []
  modified:
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/SongLyricEditor.test.ts

key-decisions:
  - "hasCredits computed reads all 5 CopyrightInfo fields (title/authors.length/ccliSongNumber/copyrightLines.length/ccliLicenseNumber) rather than the old ccliSongNumber-only check, per the plan's explicit widened-gate requirement."
  - "saveCreditsEdit mirrors onSaveVersion's saveLyrics call shape exactly (sections: editableState.sections, copyright: edited, performanceOrder: editableState.performanceOrder) — the lyric sections/order are never touched by a credits save, satisfying threat T-116-04 (no re-parse)."
  - "Chose the HISTORY_ENABLED constant-gate over deleting the History toggle/panel markup, per the plan's stated preference when unused-symbol risk is a concern — even though vue-tsc's actual tsconfig has no noUnusedLocals set (verified), the gate is still the cleaner 'deferred, not deleted' hide and keeps LyricVersionHistory.vue's import demonstrably load-bearing."
  - "Credit form fields render through Vue text interpolation/v-model (no v-html anywhere) — satisfies threat T-116-05 (no stored-XSS path for manually-entered credit text)."

patterns-established: []

requirements-completed: [R336, R337]

coverage:
  - id: D1
    description: "A user can toggle the read-only copyright block into an inline form editing all 5 CopyrightInfo fields (title, authors[], ccliSongNumber, copyrightLines[], ccliLicenseNumber) and save without re-parsing the lyric sections; the editor works starting from empty credits."
    requirement: "R336"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#opening \"Edit credits\" shows a form pre-filled with all 5 fields from the current copyright (R336)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#editing the title and authors then saving calls saveLyrics with the edited copyright and unchanged sections/order, then closes the form (R336)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#starting from empty credits, entering a ccliSongNumber and saving calls saveLyrics with that number and empty-derived arrays (R336)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#canceling the credits edit closes the form and does not call saveLyrics (R336)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The read-only copyright display shows whenever ANY credit field is non-empty (not only ccliSongNumber), and is hidden/absent when all fields are blank; the edit toggle is present whenever currentLyrics exists, including with empty credits."
    requirement: "R336"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#hides the copyright display when all credit fields are blank, and offers the edit toggle instead (R336)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#a copyright with only copyrightLines populated still shows the read-only display — the ccliSongNumber-only gate no longer suppresses it (R336)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#shows the copyright display, inside the single scroll region, when ccliSongNumber is present"
        status: pass
    human_judgment: false
  - id: D3
    description: "The History toggle button and history disclosure panel are absent from the lyric editor UI, while LyricVersionHistory.vue and the songLyricsStore version state/handlers remain intact in code."
    requirement: "R337"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#shows \"Paste lyrics\" as the only header action when lyrics are loaded; History is hidden (R337)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#the History toggle, panel, and Save Version action are absent from the UI even with versions loaded — hidden per R337, not deleted"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/LyricVersionHistory.test.ts (untouched, still green)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-04
status: complete
---

# Phase 116 Plan 02: Manual Credits Editing + Hide History Summary

**SongLyricEditor's copyright block now has an inline "Edit credits" form covering all 5 CCLI fields (works from empty), its read-only display gate widened to any non-empty field, and the History toggle/panel are hidden (not deleted) from the editor UI.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- R336: Added `editingCredits`/`hasCredits`/`creditsForm` state and `openCreditsEdit()`/`cancelCreditsEdit()`/`saveCreditsEdit()` handlers to SongLyricEditor.vue. The read-only `copyright-display` now renders on `hasCredits && !editingCredits` (widened from the old `ccliSongNumber`-only gate) — a copyright with only `copyrightLines` populated now shows. A `copyright-edit-toggle` button ("Edit credits" or "Add credits" depending on `hasCredits`) is reachable whenever `currentLyrics` exists, including with empty credits, and opens a `copyright-edit-form` with 5 fields (`authors`/`copyrightLines` as one-per-line textareas). Save parses the textareas back into trimmed, empty-filtered string arrays and calls `songLyricsStore.saveLyrics(orgId, songId, { sections: editableState.sections, copyright: edited, performanceOrder: editableState.performanceOrder })` — identical shape to `onSaveVersion`, so the lyric sections/order pass through unchanged (no re-parse).
- R337: Added a `HISTORY_ENABLED = false` constant and gated the History toggle button (`v-if="HISTORY_ENABLED"`) and the history disclosure panel (`v-if="HISTORY_ENABLED && showHistory"`) behind it. `LyricVersionHistory.vue`, `showHistory`, `onSaveVersion`, `onRevertVersion`, and the store's version state (`lyricVersions`, `revertToVersion`, `saveLyrics`) remain unchanged and still referenced by the template — re-enabling later is a one-line flip of the constant.

## Task Commits

Task 1 followed RED (failing test) -> GREEN (implementation) TDD, each half committed atomically:

1. **Task 1: R336 inline credits editor**
   - `a7a7b3da` test(116-02): failing tests for inline credits editing (R336)
   - `1b3fd38a` feat(116-02): inline "Edit credits" editor over the copyright block (R336)
2. **Task 2: R337 hide History (test + implementation in one commit; not TDD-gated in the plan)**
   - `cca33fcc` feat(116-02): hide History toggle + panel, keep code intact (R337)

**Plan metadata:** (this commit) docs(116-02): complete plan

## Files Created/Modified
- `src/components/SongLyricEditor.vue` — new `editingCredits`/`hasCredits`/`creditsForm` reactive state, `openCreditsEdit()`/`cancelCreditsEdit()`/`saveCreditsEdit()`/`parseCreditLines()`; copyright block template restructured into an always-present wrapper holding the conditional read-only display, the edit toggle, and the edit form; `HISTORY_ENABLED = false` constant gating the History toggle button and history disclosure panel.
- `src/components/__tests__/SongLyricEditor.test.ts` — revised the copyright-absent test to use a fully-empty `CopyrightInfo` fixture and assert the edit toggle appears; added 4 new tests for the credits-edit form (pre-fill, save with edit, save from empty, cancel) and 1 new test for the copyrightLines-only display case; revised the header-actions test and replaced the 3 History-interaction tests with a single absence assertion covering `history-toggle-btn`, `history-panel`, and `save-version-btn`.

## Decisions Made
- `hasCredits` reads all 5 fields (not just `ccliSongNumber`), per the plan's explicit R336 requirement that a manual-only entry (e.g. only `copyrightLines`) still shows the read-only display.
- `saveCreditsEdit` mirrors `onSaveVersion`'s exact `saveLyrics` call shape — `editableState.sections`/`performanceOrder` are never touched, satisfying the plan's threat mitigation T-116-04 (a credits save can never drop or rewrite the lyric sections).
- Chose the `HISTORY_ENABLED` constant-gate approach over deleting the History markup, per the plan's stated fallback for unused-symbol risk — confirmed via `tsconfig.app.json`/`tsconfig.vitest.json`/`@vue/tsconfig` that `noUnusedLocals` is not set (so deletion would have type-checked fine too), but the gate is still the cleaner "deferred, not deleted" hide and keeps every retained symbol demonstrably load-bearing in the template.
- Credit form fields render through `{{ }}` interpolation and `v-model` only — no `v-html` anywhere — satisfying threat mitigation T-116-05 (no stored-XSS path introduced for manually-entered credit text).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. `npm run type-check` (vue-tsc --build) is clean. `npx vitest run src/components/__tests__/SongLyricEditor.test.ts src/components/__tests__/LyricVersionHistory.test.ts` passes (97/97). The full `npx vitest run` shows exactly the documented single-file baseline failure (`src/storage.rules.test.ts`, Storage-emulator dependent per CLAUDE.md) — 185 passed files / 5051 passed tests, no new regressions from this plan's changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

This was the final plan of Phase 116 (Lyric Editor & Song UX), which was the final phase of the v2.9 "Live Presentation Field Fixes" milestone (Phases 114-116, all now executed). Per the owner's 2026-09-03 instruction, verification is deferred and batched — see `.planning/STATE.md`'s "Deferred Verification (v2.9)" table and `.planning/v2.9-DEFERRED-VERIFICATION.md` for the milestone-end UAT pass. No further plans remain in Phase 116.

## Self-Check: PASSED

Both files and all 3 task commit hashes verified present on disk / in git log.

---
*Phase: 116-lyric-editor-song-ux*
*Completed: 2026-09-04*
