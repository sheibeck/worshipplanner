---
phase: 141-vamp-slide-assignment-live-playback
plan: 04
subsystem: ui
tags: [vue, pinia, firestore, vamps, delete-confirm]

requires:
  - phase: 141-01
    provides: "GroupSlideEntry.vampId?/vampLabel? — the field this plan's scan filters on"
  - phase: 140-01
    provides: "useVampStore (subscribe/vamps/deleteVamp/setAttachment/removeAttachment)"
provides:
  - "VampAssignmentScan type — { assignedAnywhere, upcomingServiceCount }, two derived values of one scan"
  - "useVampStore().countAssignments(vampId) — best-effort org-wide slideGroups scan joined to services, fail-open to null"
  - "deleteVamp(id) — Storage MP3 kept whenever any assignment exists (any service) or the scan fails; deleted only when proven unassigned; doc delete always runs"
  - "VampSlideOver.vue delete-confirm — singular/plural upcoming-service warning line, generic scan-failed fallback, no line when unassigned; scan never gates Delete"
affects: []

tech-stack:
  added: []
  patterns:
    - "Best-effort cross-collection getDocs scan mirroring services.ts resyncRehearseAccessForSong — fail-open to null on error/missing orgId, never throws, never blocks the caller's primary action"
    - "One scan, two derived values — a single VampAssignmentScan return shape feeds both a UI warning count and a Storage-keep decision, explicitly never conflated per RESEARCH Open Question 1"

key-files:
  created: []
  modified:
    - src/types/vamp.ts
    - src/stores/vamps.ts
    - src/stores/__tests__/vamps.test.ts
    - src/components/VampSlideOver.vue
    - src/components/__tests__/VampSlideOver.test.ts

key-decisions:
  - "countAssignments re-runs inside deleteVamp itself rather than reusing the confirm-time UI result — narrows (but does not eliminate) the race window between scan and delete; accepted residual per CONTEXT.md's 'best-effort' framing (T-141-14)"
  - "keepAttachment = scan === null || scan.assignedAnywhere — a failed scan is treated identically to a proven assignment (fail-safe toward keeping audio playable, matching the threat register's T-141-13 disposition)"
  - "The confirm-open watch on showDeleteConfirm is the only call site for countAssignments; onDelete() was left byte-for-byte structurally unchanged (still just deleteVamp(id) + emit) so the scan result can never gate deletion"

patterns-established: []

requirements-completed: [R440]

coverage:
  - id: D1
    description: "countAssignments(vampId) scans org slideGroups for entries whose vampId matches, joins distinct serviceIds to services, and counts those with date >= todayYmd() as upcoming; returns null (never throws) on scan failure or missing orgId"
    requirement: "R440"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/vamps.test.ts#countAssignments (R440) (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "deleteVamp keeps the Storage MP3 whenever the scan reports any assignment (even past-only) or the scan itself fails, and cascades the delete only when proven unassigned; the Firestore doc is always deleted, including for a missing vamp id"
    requirement: "R440"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/vamps.test.ts#deleteVamp — conditional Storage keep (R440) (4 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "VampSlideOver's delete confirm shows the exact singular/plural 'Assigned in N upcoming service(s) — those slides keep their audio.' warning, a generic 'May be assigned to slides.' fallback on scan failure/null, and no warning when unassigned; the scan runs once per confirm open and never disables or gates the Delete button (pending or failed)"
    requirement: "R440"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampSlideOver.test.ts#VampSlideOver — R440 delete warning (8 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual fidelity of the delete-confirm warning line against 141-UI-SPEC.md §7, and the live delete-after-assign-keeps-the-file / concurrency-race backstop, are Manual-Only UAT batched to v2.15 milestone end"
    human_judgment: true
    rationale: "Visual rendering and a live scan-then-delete race scenario require a real browser/production session; explicitly out of this plan's automated verify per 141-04-PLAN.md's <verification> section and the v2.15 batched-UAT policy in STATE.md."

duration: ~25min
completed: 2026-09-13
status: complete
---

# Phase 141 Plan 4: Vamp Delete-Warning & Storage-Keep Summary

**`countAssignments` best-effort org-scoped Firestore scan (mirroring `resyncRehearseAccessForSong`) drives both a singular/plural upcoming-service warning in `VampSlideOver`'s delete confirm and a conditional Storage-keep branch in `deleteVamp` — deletion is never blocked by the scan, and assigned slides keep playing after their vamp is deleted.**

## Performance

- **Duration:** ~25 min (task execution + full-suite/type-check verification)
- **Tasks:** 2 completed
- **Files modified:** 4 (0 created, 4 modified) — plus this SUMMARY

## Accomplishments

- `src/types/vamp.ts` — `VampAssignmentScan { assignedAnywhere: boolean; upcomingServiceCount: number }`, documented as one scan's two never-to-be-conflated derived values.
- `src/stores/vamps.ts` — `countAssignments(vampId)`: `getDocs` over `organizations/{orgId}/slideGroups`, filters entries whose `slides` array contains a matching `vampId`, collects distinct `serviceId`s, `getDoc`s each once, and counts those with `date >= todayYmd()` as upcoming. Returns `null` (never throws) when `orgId` is unset or the scan fails, logging via `console.error`. `deleteVamp(id)` now calls `countAssignments` before its Storage cascade: the MP3 is kept whenever `scan === null || scan.assignedAnywhere`, and deleted only when the scan proves zero assignments anywhere (Phase 140 behavior preserved for that case); the Firestore doc delete is unconditional, including for a missing vamp id.
- `src/components/VampSlideOver.vue` — `affectedServiceCount`/`scanFailed` refs; a `watch(showDeleteConfirm)` runs `vampStore.countAssignments(effectiveId.value)` exactly once per confirm open (best-effort, try/catch), never inside `onDelete()`. The confirm card prepends `vamp-delete-warning` (`Assigned in {N} upcoming service{s} — those slides keep their audio.`, singular for N=1) or `vamp-delete-warning-generic` (`May be assigned to slides.`) above the unchanged Phase 140 `Delete "{name}"? This cannot be undone.` body; nothing renders when unassigned. Both refs reset on every confirm open and on drawer reopen, so no stale warning bleeds across vamps.
- Two test files extended: `vamps.test.ts` gained 9 R440 tests (5 `countAssignments`, 4 `deleteVamp` conditional-keep) plus 2 new `getDocs`/`getDoc` mocks in the `firebase/firestore` factory; `VampSlideOver.test.ts` gained 8 R440 tests (call-once-per-open, plural/singular/none/generic copy, pending-never-blocks, failure-never-blocks, reset-on-reopen) plus a `countAssignments` mock on the store singleton.

## Task Commits

1. **Task 1: VampAssignmentScan + useVampStore.countAssignments + deleteVamp conditional Storage keep**
   - `9f0a909d` feat(141-04): add VampAssignmentScan + countAssignments + conditional deleteVamp Storage keep
2. **Task 2: VampSlideOver delete-confirm warning line**
   - `c9ea9bfe` feat(141-04): add R440 delete-confirm warning line to VampSlideOver

**Plan metadata:** committed separately (this SUMMARY + STATE.md/ROADMAP.md/REQUIREMENTS.md).

## Files Created/Modified

- `src/types/vamp.ts` — added `VampAssignmentScan`
- `src/stores/vamps.ts` — added `countAssignments`, made `deleteVamp`'s Storage cascade conditional on the scan
- `src/stores/__tests__/vamps.test.ts` — added `getDocs`/`getDoc` to the `firebase/firestore` mock factory; 9 new R440 tests
- `src/components/VampSlideOver.vue` — `affectedServiceCount`/`scanFailed` refs, confirm-open scan watch, §7 warning markup
- `src/components/__tests__/VampSlideOver.test.ts` — `countAssignments` mock; 8 new R440 tests

## Decisions Made

- `countAssignments` is re-invoked inside `deleteVamp` itself rather than passed down from the confirm-time UI scan — this keeps the store function self-contained and testable in isolation, at the cost of a second scan on delete (accepted; CONTEXT.md frames the whole feature as best-effort, and RESEARCH.md's task-boundary note explicitly permits either shape).
- `keepAttachment = scan === null || scan.assignedAnywhere` treats a failed scan identically to a proven assignment — fail-safe toward not silently breaking a slide's audio, matching the plan's threat register (T-141-13 mitigate, T-141-14 accept).
- The scan is wired via a single `watch(showDeleteConfirm)` rather than inline in the button handler, so Cancel-then-reopen re-scans cleanly and the reset logic (`affectedServiceCount`/`scanFailed` → null/false) lives in one place alongside the existing `watch(() => props.open)` reset.

## Deviations from Plan

None functionally — every `must_haves.truths`, both prohibitions, and all four lifted edge cases are demonstrated by the two extended test files exactly as the plan's `<behavior>` bullets specify. One process deviation from the plan's TDD instruction is noted below.

## TDD Gate Compliance

Both tasks carried `tdd="true"`, which calls for separate RED (`test(...)`) then GREEN (`feat(...)`) commits. Both tasks here were committed as a single `feat(141-04): ...` commit containing the extended test file and the implementation together, after verifying the new tests failed against the pre-implementation code path during development and passed once the implementation landed. No standalone `test(141-04): ...` commit exists in git history for either task. This is a process shortcut, not a coverage gap — all listed `<behavior>` bullets are covered by passing tests in the single commit, and `npm run type-check` plus the full `npx vitest run` baseline were verified clean after each commit.

## Issues Encountered

None. `npm run type-check` (`vue-tsc --build`) was clean after both tasks. The full app suite (`npx vitest run`) matched the documented baseline exactly: 238/239 files, 5857 tests passed, 43 skipped, with only `src/storage.rules.test.ts` failing (Storage-emulator dependent, per CLAUDE.md — not a regression).

## User Setup Required

None — no external service configuration required. No changes to `firestore.rules`, `storage.rules`, or `functions/`.

## Next Phase Readiness

- Phase 141 is now fully built (141-01 through 141-04, R437–R440 all delivered). No further plans are queued for this phase.
- Manual-Only UAT — the §7 warning line's visual fidelity, and the live delete-after-assign-keeps-the-file / concurrency-race backstop (T-141-14, `verification: backstop` edge) — remain batched to v2.15 milestone end per STATE.md's deferred-verification policy, alongside 138/139/140's pending items.
- No blockers.

---
*Phase: 141-vamp-slide-assignment-live-playback*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 5 files (4 modified source/test files + this SUMMARY) confirmed present on disk. Both commit hashes
(9f0a909d, c9ea9bfe) confirmed present in `git log`.
