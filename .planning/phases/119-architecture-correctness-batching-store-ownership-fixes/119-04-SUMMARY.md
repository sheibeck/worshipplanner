---
phase: 119-architecture-correctness-batching-store-ownership-fixes
plan: 04
subsystem: ui
tags: [vue, firestore, autosave, sortablejs, dead-code-removal, regression-test]

requires:
  - phase: 119-architecture-correctness-batching-store-ownership-fixes (119-01/02/03)
    provides: sibling architecture fixes in the same phase (batching, lifecycle) — this plan is deliberately independent, no shared files
provides:
  - reopenPcWarning with no unreachable dead-code date branch (R352/ARCH-012)
  - A regression test proving the reorder-save / remote-merge coordination window is safe (R357/ARCH-013)
affects: [120-god-module-decomposition]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "R352: removed the dead reopenPcWarning date branch rather than fixing the JSON deep-clone (lower risk — the clone idiom is load-bearing across 7 sites and gates the autosave dirty-check per ARCH-023)."
  - "R357: wrote the proving regression test only — it passed against current code on the first run, confirming ARCH-023's finding that the reorder-save/remote-merge coordination window is already safe. No production guard was added (none was needed)."

patterns-established: []

requirements-completed: [R352, R357]

coverage:
  - id: D1
    description: "reopenPcWarning renders the accurate Planning-Center-export sentence with no unreachable dead date branch"
    requirement: "R352"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the PC warning is the accurate no-date sentence, exact match — no unreachable date branch (R352/ARCH-012)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A regression test proves a remote snapshot arriving during an in-flight reorder save does not clobber the user's edit (no stale overwrite, no lost edit)"
    requirement: "R357"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#a differing remote snapshot arriving during an in-flight reorder-save does not clobber it — no stale overwrite, no lost edit (R357/ARCH-013)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-05
status: complete
---

# Phase 119 Plan 04: ServiceEditorView Dead-Code Removal + Coordination Regression Test Summary

**Removed reopenPcWarning's unreachable date branch (R352) and proved by regression test that the reorder-save/remote-merge coordination window is already safe with no production change needed (R357).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-05T03:40:00Z (approx)
- **Completed:** 2026-09-05T04:16:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `reopenPcWarning` (src/views/ServiceEditorView.vue) reduced to a single accurate sentence — deleted the `pcExportedAt` read, the `toDate` guard, the `when` variable, and the date-formatted return, all of which were unreachable because every `localService` assignment site round-trips through `JSON.parse(JSON.stringify(...))`, stripping the Firestore `Timestamp`'s `.toDate()` method.
- Added an exact-match regression test for the warning text, using a `Timestamp`-shaped stub with a real `.toDate()` — a test that would have failed loudly had the dead branch still been reachable.
- Added a regression test that holds a reorder-save's `serviceStore.updateService` call pending, pushes a genuinely differing (non-echo) remote snapshot mid-flight, then resolves the write — and confirms the user's reordered slots survive untouched. Passed on the first run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the unreachable reopenPcWarning date branch (R352)** - `80bdadf1` (fix)
2. **Task 2: Regression test for the reorder-save / remote-snapshot coordination window (R357)** - `92624509` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - `reopenPcWarning` computed trimmed to the single accurate sentence; no other logic touched.
- `src/views/__tests__/ServiceEditorView.test.ts` - Added an exact-match test for `reopenPcWarning` (R352) and a new coordination regression test that holds `updateService` pending during a Sortable reorder-save and pushes a differing remote snapshot mid-flight (R357).

## Decisions Made
- **R352 (Claude's discretion per CONTEXT.md):** chose remove-the-dead-branch over fix-the-clone. Confirmed by reading all four `localService.value =` assignment sites in ServiceEditorView.vue — every one round-trips through `JSON.parse`/`JSON.stringify`, so the date branch could never have rendered. Removing it is behavior-preserving and isolated; fixing the clone would touch a load-bearing idiom shared across seven sites and the autosave dirty-check.
- **R357:** per the plan's explicit guidance, wrote the proving test first and only added a production guard if it exposed a genuine gap. It did not — the test passed on its first run. Root cause: the reorder-save's own slot mutation independently fires `useAutoSave`'s internal deep watch on `localService`, setting `autoSave.status.value` to `'pending'` (a mechanism separate from the reorder-save's own direct-write/`saveStatus` UI reporting). The remote-merge watcher only applies a merge when status is `idle`/`saved`/(`error` && not dirty) — `'pending'` is excluded, so the in-flight reorder is protected. No production change was needed, matching ARCH-023's prior finding.

## Deviations from Plan

None — plan executed exactly as written. Both tasks resolved with the lower-risk/no-op option CONTEXT.md anticipated (dead-code removal for R352, proving-test-only for R357).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ServiceEditorView.vue is otherwise untouched — the 4600-line monolith decomposition (Phase 120, ARCH-006/010) is unaffected and unblocked by this plan.
- Both R352 and R357 requirements are closed; no follow-up work identified for either finding.

---
*Phase: 119-architecture-correctness-batching-store-ownership-fixes*
*Completed: 2026-09-05*

## Self-Check: PASSED
- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND: .planning/phases/119-architecture-correctness-batching-store-ownership-fixes/119-04-SUMMARY.md
- FOUND commit: 80bdadf1 (fix(119-04): remove unreachable reopenPcWarning date branch (R352))
- FOUND commit: 92624509 (test(119-04): prove reorder-save / remote-merge coordination is safe (R357))
