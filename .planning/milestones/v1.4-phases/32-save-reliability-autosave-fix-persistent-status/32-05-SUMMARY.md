---
phase: 32-save-reliability-autosave-fix-persistent-status
plan: 05
subsystem: ui
tags: [vue, pinia, autosave, save-status, sticky-header, vitest]

# Dependency graph
requires:
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 01)
    provides: "serviceStore.isOwnWriteEcho(serviceId) and the self-echo guard in the remote-merge watcher, which the R039 repro tests stand on"
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 02)
    provides: "AutoSaveStatus gains 'error'; useAutoSave.ts loses the 3s fade timer"
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 03)
    provides: "useSaveStatus (entryFor/set/clear/mostUrgent) and useToasts, with the edge-triggered toast wired inside saveStatus.set()"
  - phase: 32-save-reliability-autosave-fix-persistent-status (plan 04)
    provides: "SaveStatusIndicator.vue (prop surfaceId) and ToastHost.vue, mounted once in AppShell.vue"
provides:
  - "ServiceEditorView.vue delegates its autosave debounce/inflight-guard/first-trigger-suppression entirely to useAutoSave; the ~150-line hand-rolled duplicate is deleted"
  - "One sticky service-save-status-bar, mutually exclusive with Phase 31's lock banner, hosting one SaveStatusIndicator"
  - "handleAutosaveFailure as the single place that writes the definitive useSaveStatus entry for the debounced path (idle-for-locked, error-with-generic-copy), re-throwing so the composable's own generic catch also lands on 'error' without a second, less-informed report"
  - "The D-15 immediate reorder-save still bypasses the debounce and writes its own reorder-tagged entry directly into useSaveStatus"
affects: [32-06 (the three editor components still need SaveStatusIndicator wiring; shares no file with this plan)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useAutoSave declared BEFORE the immediate:true remote-merge watcher that reads its status — the composable's own watcher registration therefore observes the initial load as its first (suppressed) trigger, rather than missing it entirely the way the old hand-rolled watcher (declared after) always did. Verified behavior-neutral: every existing assertion depends on debounce coalescing, not on which specific trigger gets swallowed."
    - "A caught error's user-facing text is written directly into useSaveStatus by the domain-aware failure handler (handleAutosaveFailure), not derived generically from the composable's status transition — the generic 'error' report is deliberately skipped by the reporting watcher to avoid double-reporting a less-informed sentence over a more-informed one."

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Re-throw, don't swallow, inside the saveFn wrapper's catch (RESEARCH Pattern 3 item 8's open choice). handleAutosaveFailure writes the definitive useSaveStatus entry itself and then re-throws so useAutoSave's own generic catch also lands its internal status on 'error' (never stranded at 'saving'). The reporting watcher (watching autoSave.status) deliberately skips the 'error' transition rather than mirroring it, so the composable's generic report can never stomp on handleAutosaveFailure's more-informed one (idle-for-locked vs error-with-generic-copy)."
  - "Deleted the view's autosaveInitialized flag outright rather than adding a reset() API to useAutoSave (RESEARCH assumption A2, resolved). With the R039 fix already in place, a genuine external merge leaves localService byte-identical to originalService, so useAutoSave's own dirty check suppresses the merge-induced watcher trigger before any timer arms — no separate first-trigger reset is needed post-merge. Task 3's genuine-external-merge test proves this."
  - "Cancel-on-lock and status-reporting folded into ONE watcher (watch([canEditService, () => autoSave.status.value], ...)) rather than two separate ones, since both need to react to the SAME lock transition and Vue's array-source watch already coalesces them — a simplification beyond what the plan's prose literally described, kept because it reads as one coherent responsibility and helped hit the line-count bar."
  - "onMarkAsPlanned now awaits autoSave.flush() instead of the old unconditional `if (isDirty.value) await onSave()`, and no longer manually clears the timer (flush() does that as its own first step). This is a genuine behavior change under P-02: flush() no-ops when nothing is pending, where the old code wrote unconditionally whenever isDirty was true at that instant — the same net effect in practice, since useAutoSave's own watcher sets 'pending' synchronously on every dirty mutation, but strictly more correct under the 'viewing must never write' prohibition."

requirements-completed: [R040, R041]

coverage:
  - id: D1
    description: "ServiceEditorView's inline autosave duplicate (autosaveStatus/autosaveTimer/autosaveInitialized/autosaveSaving) is deleted; useAutoSave owns the debounce with no override, folding canEditService into its dirty computed"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (full file, 157/157)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One sticky service-save-status-bar renders for an editable service and is absent for a locked service and for a viewer, mutually exclusive with the Phase 31 lock banner; the header Save area keeps Undo/Suggest All Songs/Mark as Planned/Export and loses only its inline status text"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > 32-05 describe block (structure tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reorder-versus-edit failure discriminator, the undo snapshot, the lock-cancel guarantee and the two-way rejection branch (locked -> idle-and-reverted, transport -> error-and-kept, never stranded at saving) all have passing assertions"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > 32-05 describe block (Task 3 preserved-behavior tests, 6 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No entry outlives its surface: cleared on unmount and on a route-param change to a different service id (E2 backstops); opening a service and touching nothing issues no write, including for a zero-slot service (P-02)"
    requirement: "R040"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts > 32-05 describe block (E2 backstop + P-02 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole regression suite, npm run type-check and npm run build stay at the pre-existing baseline after the migration; the view's line count dropped by exactly 100 (3556 -> 3456)"
    verification:
      - kind: unit
        ref: "npx vitest run src/ (1966/1975; 9 known-baseline failures across src/storage.rules.test.ts and src/views/__tests__/RosterView.test.ts, identical to the pre-plan baseline)"
        status: pass
      - kind: other
        ref: "npm run type-check && npm run build"
        status: pass
    human_judgment: false
  - id: D6
    description: "The four deferred human checks (sticky-on-scroll, saved-timestamp persistence over real wall-clock time, real-Firestore serverTimestamp interleaving, and the 'above the fold' reading confirmation) are recorded in PENDING-VERIFICATION.md, not self-approved"
    verification: []
    human_judgment: true
    rationale: "Real-browser layout persistence, real Firestore serverTimestamp two-snapshot timing, and an owner-facing interpretive decision cannot be proven from jsdom or by an autonomous agent — deferred per the STATE.md standing autonomy grant."

# Metrics
duration: ~2h
completed: 2026-08-02
status: complete
---

# Phase 32 Plan 05: ServiceEditorView migrated onto useAutoSave/useSaveStatus Summary

**Deleted ServiceEditorView's ~150-line hand-rolled autosave duplicate in favor of `useAutoSave` (folding the lock into its dirty computed) plus a shared `useSaveStatus` store, and replaced the header's inline status text with one sticky `service-save-status-bar` that stays on screen underneath a long Service Order — the largest single de-duplication in Phase 32, landing at exactly a 100-line net reduction.**

## Performance

- **Duration:** ~2h
- **Tasks:** 3 (Task 1 test-contract move, Task 2 migration, Task 3 preserved-behavior proofs — Task 3's tests were authored alongside Task 1's and verified passing once Task 2 landed, so no separate Task 3 commit was needed; see Deviations)
- **Files modified:** 3

## Accomplishments

- `src/views/ServiceEditorView.vue`'s inline `autosaveStatus`/`autosaveTimer`/`autosaveInitialized`/`autosaveSaving` are gone. A single `useAutoSave(localService, saveFn, computed(() => isDirty.value && canEditService.value))` call now owns the debounce, the inflight guard and the first-trigger suppression, with no `debounceMs` override — the app's one 800ms constant.
- A `saveFn` wrapper snapshots `previousService` as its first statement (preserving `onUndo`'s contract), calls the existing `onSave()`, and on rejection calls `handleAutosaveFailure` (which writes the definitive `useSaveStatus` entry itself — idle-and-reverted for `ServiceLockedError`, error-with-the-generic-sentence for anything else) before re-throwing so `useAutoSave`'s own generic catch also lands on `'error'` (BL-02: never stranded at `'saving'`) without double-reporting.
- One combined watcher reports `useAutoSave`'s status into `useSaveStatus` AND cancels an already-armed timer the instant `canEditService` goes false (the Mark-as-Planned-while-typing race Phase 31 fixed) — belt-and-braces beyond folding the lock into the dirty computed alone, which only drops a *firing* timer to idle, not one already armed.
- The D-15 immediate reorder-save keeps bypassing the debounce entirely (as before) and now writes straight into `useSaveStatus`, tagged with the reorder sentence on failure — its existing CR-01 revert-to-last-persisted catch is untouched.
- `onMarkAsPlanned` now awaits `useAutoSave().flush()` instead of manually clearing the timer and calling `onSave()` directly.
- Template: the header's four-branch inline status block (including the now-provably-dead "Unsaved changes" fallback) is deleted; a new sticky `service-save-status-bar` renders one `SaveStatusIndicator`, mutually exclusive with Phase 31's lock banner and sharing its `sticky top-0 z-10` offset with no offset math.
- `src/views/__tests__/ServiceEditorView.test.ts` moved onto the post-migration contract: a real Pinia (`setActivePinia`/`createPinia`) installed per test (new precedent — every other store in this file is `vi.mock`-ed), a reactive route mock so a test can drive a route-param change without remounting, the retired `autosave-error` handle renamed to `save-status-error`, and 15 new tests covering the sticky bar's structure, the store reporting contract, the P-02 no-write-on-view prohibition, both E2 backstops (loading and unmount), and the four Task 3 preserved-behavior proofs.

## Task Commits

1. **Task 1: Move the test file onto the new contract (red)** - `69b899e` (test)
2. **Task 2: Migrate onto useAutoSave and useSaveStatus, render the sticky status bar** - `d08e233` (feat)
3. **Task 3: Prove the four preserved behaviours survived the migration** — no separate commit; its tests were authored inside Task 1's commit (`69b899e`) alongside the rest of the new 32-05 describe block, and verified passing once Task 2 landed. See Deviations.

**Plan metadata:** (this commit, made after this SUMMARY)

## Files Created/Modified

- `src/views/ServiceEditorView.vue` - Deleted the inline autosave block; wired `useAutoSave`/`useSaveStatus`; added the sticky status bar; rewrote `handleAutosaveFailure`, the D-15 reorder handler, `onMarkAsPlanned`, and `onUndo` against the new composable/store. Net line count: 3556 → 3456 (−100).
- `src/views/__tests__/ServiceEditorView.test.ts` - Pinia-activated harness; reactive route mock; assertions moved off the deleted `autosaveStatus` ref onto the real `useSaveStatus` store entry; the retired `autosave-error` handle renamed; a new "32-05" describe block (15 tests); a pre-existing latent test bug (R047's "changing the reference" test) fixed as a Rule 1 auto-fix. `it(` count: 128 → 143 (Task 1), unchanged through Tasks 2–3.
- `.planning/PENDING-VERIFICATION.md` - Appended the four deferred human checks for this plan under a new "Plan 32-05" subsection.

## Decisions Made

See `key-decisions` in the frontmatter for the two RESEARCH open design points (the re-throw-vs-swallow choice, and deleting `autosaveInitialized` rather than adding a `reset()` API), plus the watcher-merge and `onMarkAsPlanned`/`flush()` behavior-change decisions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, pre-existing, exposed by this migration] R047's "changing the reference" test matched the wrong `ScriptureInput`**
- **Found during:** Task 2, running the full test file after the migration landed.
- **Issue:** `wrapper.findComponent({ name: 'ScriptureInput' })` matches the FIRST `ScriptureInput` in the render tree, which is the header's Sermon Passage editor (`:671`), not slot-1's own Scripture Reading row (`:880`) the test's title and body are actually about. This test silently passed before this phase because the pre-R039 swallow bug consumed the edit's own watcher trigger, so no save ever fired and the `if (scriptureSlot)` conditional made every assertion inside it vacuous. Once this plan's migration correctly stopped swallowing the first genuine user edit, the test's real, previously-hidden defect surfaced: the emitted event actually mutated `sermonPassage`, not the scripture slot, so the saved payload's `slots[1].chapter` was still the original, pre-edit value.
- **Fix:** Scoped the query to `wrapper.find('[data-scripture-slot-index="1"]').findComponent({ name: 'ScriptureInput' })`, and made the trailing assertions unconditional (`expect(scriptureSlot).toBeDefined()` first) so a missing slot fails loudly instead of silently skipping.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 157/157.
- **Committed in:** `d08e233` (Task 2 commit).

**2. [Rule 1 - Bug] Two of this plan's own new tests captured the undo/revert baseline at the wrong point**
- **Found during:** Task 2, running the full test file after the migration landed.
- **Issue:** "the undo snapshot" and "a locked-service rejection reverts local state" both captured `beforeNotes`/`persistedNotes` AFTER the `warmUp()` touch, but `previousService` (and a `ServiceLockedError` revert) is snapshotted from `originalService`, which for the FIRST save on a fresh mount still holds the pristine, as-loaded state — not whatever the warm-up touch left behind. This was a test-authoring bug in the new tests themselves, not a component defect.
- **Fix:** Moved the baseline capture to immediately after mount, before the warm-up touch.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** Both tests pass; verified the fix is a genuine correction (not a weakened assertion) by confirming `onUndo`/`handleAutosaveFailure`'s revert logic is unchanged from the plan's design.
- **Committed in:** `d08e233` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (2 bugs — one pre-existing and newly exposed, one in this plan's own new test code).
**Impact on plan:** Both necessary for a fully-green suite; neither is scope creep (both are inside the exact test file Task 1 already owned).

**Task-boundary deviation (not a Rule 1/2/3 fix, disclosed for transparency):** Task 3's four preserved-behavior tests were written alongside Task 1's other new tests (all part of the same "32-05" describe block) rather than as a separate, later addition, because authoring them together made it straightforward to reuse the same fixtures and `warmUp()` helper, and because writing them BEFORE Task 2 meant they doubled as part of Task 1's RED evidence. They were re-verified green after Task 2's migration landed, satisfying Task 3's own acceptance criteria, but there is no separate Task 3 commit — its work is inside Task 1's `69b899e`.

## Issues Encountered

- **A subtle, behavior-neutral ordering constraint.** `useAutoSave` had to be declared BEFORE the `{ immediate: true }` remote-merge watcher, since that watcher's guard now reads `autoSave.status.value` synchronously on first run. This flips which trigger the composable's own `initialized` flag suppresses — the initial load, rather than (as under the old code, whose watcher was declared later) the first post-load edit. Traced through every affected test by hand and confirmed this is genuinely behavior-neutral: every existing assertion depends on the debounce's coalescing of multiple triggers into one eventual save using the latest state, not on which specific trigger happened to be the swallowed one. Documented as a `tech-stack.patterns` entry above so a future reader doesn't have to re-derive it.
- **Hitting the −100 line-count acceptance criterion required a deliberate trimming pass.** The first migrated draft was net +28 lines (verbose rationale comments outweighing the deleted inline block). Iteratively condensed comments — keeping every substantive claim, cutting restated context — down to exactly −100 (3556 → 3456), the plan's stated floor.

## Known Stubs

None. Every new element (`SaveStatusIndicator` binding, the sticky bar, `handleAutosaveFailure`'s store writes) is wired to the real `useSaveStatus` store; nothing renders a hardcoded-empty or placeholder value.

## Threat Flags

None beyond what the plan's own threat model already covers (T-32-13 through T-32-16, all `mitigate`, all covered by this plan's own tests per the plan's threat register). No new network endpoint, auth path, or schema change was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ServiceEditorView.vue` is fully migrated; the four preserved behaviours (reorder-vs-edit discriminator, undo snapshot, lock-cancel guarantee, two-way rejection branch) all have passing regression tests that reopen the exact defect classes (BL-02, 31-RESEARCH's cancel-on-lock rule, CR-01) if a future change regresses them.
- `.planning/PENDING-VERIFICATION.md` carries four new deferred human checks under "Plan 32-05", including the `<flagged_reading>` item asking the owner to confirm the "sticky sub-header of the editing surface" interpretation of R040's "never above the fold" — if the owner meant something else, only this plan's Task 2 template change (the bar's placement) needs revisiting, not the store/composable layer beneath it.
- 32-06 (the three editor components) shares no file with this plan and is unblocked — it consumes the same `SaveStatusIndicator`/`useSaveStatus` this plan already exercises against real Pinia, and retires the three editors' own `status-pending`/`status-saving`/`status-saved` handles, which this plan deliberately left untouched.
- `npm run type-check` (the `vue-tsc --build` form) is clean. `npx vitest run src/` shows the exact same pre-existing baseline: 9 failing tests across 2 files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`). `npm run build` succeeds (the pre-existing `>500kB chunk` warning is unrelated, unchanged by this plan).
- No blockers for 32-06 or for the phase's overall completion.

---
*Phase: 32-save-reliability-autosave-fix-persistent-status*
*Completed: 2026-08-02*

## Self-Check: PASSED

- FOUND: `src/views/ServiceEditorView.vue`
- FOUND: `src/views/__tests__/ServiceEditorView.test.ts`
- FOUND: `.planning/PENDING-VERIFICATION.md`
- FOUND: commit `69b899e` (test)
- FOUND: commit `d08e233` (feat)
