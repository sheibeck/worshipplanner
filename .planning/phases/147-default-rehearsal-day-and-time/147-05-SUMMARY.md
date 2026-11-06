---
phase: 147-default-rehearsal-day-and-time
plan: 05
subsystem: ui
tags: [rehearsals, service-editor, autosave, vue, tdd, typescript, spec-driven]

requires:
  - phase: 147-default-rehearsal-day-and-time
    provides: isRealYmd, moveAutoRehearsals, StoredRehearsal (Plan 02); old-page retirement in updateService (Plan 03); ServiceTimesPanel defaultWeekday prop (Plan 04)
provides:
  - Service date saved by the editor (date added to onSave payload and its post-save mirror)
  - onDateChange guard (isRealYmd) and in-place move of marked rehearsals in one synchronous mutation
  - Marker cleared by onRehearsalDateChange / onRehearsalTimeChange after their guards pass
  - Settings default weekday wired to the add form through the editor; header date input capped at 9999-12-31
  - Map docs updated and docs/specs/default-rehearsal.md set to Active with all 68 criteria cited
affects: [phase-147-verification]

tech-stack:
  added: []
  patterns:
    - "A new persisted field must appear at the same key position in onSave's payload and its post-save mirror, or isDirty never clears (ADR-0235)"
    - "delete row.marker rather than assigning false/undefined, so an edited row is byte-identical to a hand-added one"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.timesSection.test.ts
    - .planning/codebase/ARCHITECTURE.md
    - docs/specs/default-rehearsal.md

key-decisions:
  - "Undo restores the marker (ADR-0249 i): no code in onUndo, because date and rehearsals sit in the same previousService clone and the following save sends both"
  - "AC-RHD-37/38/63 mount and mutate once with no warm-up touch, so a swallowed first mutation in the most common flow would show up"
  - "ADR-0249 pointer added to the Times tab template comment as a continuation line inside the same HTML comment"

patterns-established:
  - "Spec first, then tests citing AC-RHD-NN in titles, then code: git history shows the spec ahead of every 147-02..05 commit"

requirements-completed: []
requirements-note: "R462, R463, R464 are in the plan frontmatter but deliberately left open; the orchestrator closes R459-R465 after phase verification."

duration: 30min
completed: 2026-11-06
status: complete
---

# Phase 147 Plan 05: Editor wiring and phase close Summary

**A service date change now saves, moves an untouched auto-added rehearsal in the same write, and shows as saved with no second save; the default-rehearsal spec is Active with every criterion cited.**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-11-06
- **Tasks:** 3 of 3 (Task 1 RED, Task 2 GREEN, Task 3 docs and gate)
- **Files modified:** 4

## Accomplishments

- Fixed the real defect behind R462: `onDateChange` looked like it worked and the page showed "Saved", but `date` was never in `onSave`'s payload, so it was gone on reload. It is now sent, and mirrored at the same key position so `isDirty` clears (AC-RHD-37, 63).
- `onDateChange` rejects a cleared or unreal date (and one past year 9999) before applying it, then calls `moveAutoRehearsals` in the same synchronous handler, so the date and the moved rows go out in one write (AC-RHD-35, 38). `canEditService` stays the first line (AC-RHD-36).
- Editing a rehearsal's date or time deletes `autoAdded` once the guards pass; a rejected edit leaves it (AC-RHD-29, 30). Undo restores the whole snapshot, marker included, with no `onUndo` change (AC-RHD-64, 65).
- `:default-weekday` forwards the Settings day to `ServiceTimesPanel` (AC-RHD-45), and the header date input has `max="9999-12-31"`.
- Cited the last 14 criteria: the spec-coverage residual went from 14 to 0.

## Task Commits

1. **Task 1 RED: failing editor tests** - `ad8d8321` (test)
2. **Task 2 GREEN: save the date, move on change, clear marker on edit** - `1cea9079` (feat)
3. **Task 3: map docs and Active spec** - `9b92f6a3` (docs)

Final metadata commit follows this summary.

## RED state

Tests that failed at RED, as intended: AC-RHD-27, 28, 29 (all four variants), 30, 35 (not-a-real-day, not-a-date, past-9999), 37, 38, 45, 63, 64, 65.
Tests that passed at RED by design as regression guards: AC-RHD-11, 26, 31, 32, 36 and 39. The "cleared" variant of AC-RHD-35 also passed at RED because the old `!newDate` guard already rejected it. At GREEN every `ServiceEditorView*` file passed (438 tests plus 52 in `serviceEditorActionBar.test.ts`).

## Gate results

- Bare `npx vitest run`: 254 files passed, 1 failed, 6436 tests passed, 43 skipped. The one failing file is `src/storage.rules.test.ts` (documented baseline). `src/__tests__/specCoverage.test.ts` passes.
- `npm run type-check` (`vue-tsc --build`): exit 0 after the test file and again after the GREEN commit.
- Residual check: `uncited=0 other=0`, exit 0.
- Spec-first check: `spec first: ok`.
- `git ls-files --eol` over files changed in the phase: no `w/mixed`. `ARCHITECTURE.md` stays CRLF with a 9-insertion, 1-deletion diff.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Array.prototype.at` not in the TS lib**
- **Found during:** Task 1 (`npm run type-check`)
- **Issue:** `mock.calls.at(-1)` raised TS2550 under the project's lib target, caught only by `vue-tsc --build`.
- **Fix:** Indexed the last call by `length - 1`.
- **Files modified:** `src/views/__tests__/ServiceEditorView.timesSection.test.ts`
- **Commit:** `ad8d8321` (fixed before the RED commit)

No spec and plan disagreement was found.

## Issues Encountered

None beyond the above. Running the editor tests with the AC-RHD-39 single touch (no warm-up) did save, so no warm-up was needed anywhere in the new describe.

## Human checks pending

Task 3's `<human-check>` needs a browser and a local Firebase emulator and was NOT run or marked passed. For the verifier to route to the owner:

- **Test:** in the local emulator, share a draft service, change its date in the editor, reload, then open the new public page, the old public page and the regular share link.
- **Expected:** the new date and the moved rehearsal survive the reload; the new page and the regular link open and show the new date; the old page no longer opens.
- **Why human:** needs real Firestore and the public share page; the unit suite mocks both (`mockUpdateService` cannot see old-page removal, which Plan 03 proves against stored documents).

## Known Stubs

None.

## Threat Flags

None. The only new surface is the saved `date`, covered by T-147-12 (isRealYmd and max), T-147-13 (canEditService first) and T-147-14 (marker cleared only after guards).

## Next Phase Readiness

All five plans in phase 147 are executed. The phase needs orchestrator verification, the pending human check above, and closing R459-R465.

## Self-Check: PASSED

- Files exist: ServiceEditorView.vue, ServiceEditorView.timesSection.test.ts, ARCHITECTURE.md, default-rehearsal.md.
- Commits exist: ad8d8321, 1cea9079, 9b92f6a3.
