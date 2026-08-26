---
phase: 84-last-used-date-correctness-backfill
plan: 01
subsystem: scheduling
tags: [pinia, firestore, vitest, tdd]

requires: []
provides:
  - "src/utils/lastUsed.ts — canonical, framework-free lastUsedAt derivation (computeLastUsedDate, isLockedStatus, serviceDateToMillis, serviceToLastUsedInput)"
  - "services.ts lock/unlock recompute wired into markAsPlanned/reopenService"
  - "assignSongToSlot no longer stamps lastUsedAt on draft assignment"
affects: [84-last-used-date-correctness-backfill (plan 02 — backfillLastUsed.ts mirrors computeLastUsedDate + serviceDateToMillis verbatim)]

tech-stack:
  added: []
  patterns:
    - "Pure derivation module mirrored (not imported) across the src/ <-> functions/ package boundary, each side carrying its own tests so drift breaks a test"
    - "Lock-transition recompute overrides the triggering service's status in an in-memory snapshot rather than waiting on onSnapshot, to stay deterministic and timing-independent"

key-files:
  created:
    - src/utils/lastUsed.ts
    - src/utils/__tests__/lastUsed.test.ts
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "Locked === status !== 'draft' (covers 'planned' and 'exported'); lastUsedAt = MAX(service.date) over locked services containing the song, or null when none — never blanks a song in no service at all"
  - "Recompute triggers are the lock/unlock lifecycle only (markAsPlanned, reopenService) — deleteService deliberately NOT hooked, documented as a scope note; a deleted-locked-service correction is left to the 84-02 backfill"
  - "serviceDateToMillis's local-midnight parse convention is the single source both the live store and the 84-02 backfill must use so the written Timestamp is identical in both environments"

patterns-established:
  - "TDD RED/GREEN commit pairs per task, with a pre-existing test that asserted the OLD (now-fixed) behavior rewritten in the GREEN commit rather than left conflicting"

requirements-completed: [R247]

coverage:
  - id: D1
    description: "Adding a song to a DRAFT service does not set or advance its lastUsedAt (root-cause fix for the reported 'His Mercy Is More' bug)"
    requirement: "R247"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#lastUsedAt recompute (R247) > assignSongToSlot on a DRAFT service does NOT call songStore.updateSong (no wall-clock stamp)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Locking a service (markAsPlanned) sets each of its songs' lastUsedAt to MAX(service.date) over that song's LOCKED services"
    requirement: "R247"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#lastUsedAt recompute (R247) > markAsPlanned writes lastUsedAt as the Timestamp for the service date, for each song in the service"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#lastUsedAt recompute (R247) > locking a later-dated service advances lastUsedAt beyond an already-locked earlier service"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reopening a service recomputes the reopened service's songs' lastUsedAt from remaining locked services (may become null)"
    requirement: "R247"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#lastUsedAt recompute (R247) > reopenService on the only locked service containing a song recomputes its lastUsedAt to null"
        status: pass
    human_judgment: false
  - id: D4
    description: "computeLastUsedDate returns MAX locked service date, null when the song is in no LOCKED service, never throws"
    requirement: "R247"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/lastUsed.test.ts (16 tests: null/no-service, null/no-locked-service, single, MAX, tie, draft-excluded, parse convention)"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-08-26
status: complete
---

# Phase 84 Plan 01: Last-Used Date Correctness (Live Path) Summary

**Fixed `lastUsedAt` to derive from `MAX(service.date)` over a song's LOCKED (non-draft) services via a new canonical, firebase/vue-free `src/utils/lastUsed.ts` helper, wired into `services.ts`'s lock/unlock lifecycle — removing the old `serverTimestamp()` stamp on draft assignment that caused the reported "His Mercy Is More showed Aug 11 for a Sep 6 locked service" bug.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-08-26T02:24:00Z (approx, plan/context read)
- **Completed:** 2026-08-26T03:06:00Z
- **Tasks:** 2 (both TDD, RED/GREEN commit pairs)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- New pure module `src/utils/lastUsed.ts` (`computeLastUsedDate`, `isLockedStatus`, `serviceDateToMillis`, `serviceToLastUsedInput`) — imports nothing from `firebase*`/`vue`, ready to be mirrored verbatim by the 84-02 backfill.
- `assignSongToSlot` no longer writes `lastUsedAt` — a draft assignment stamps nothing (root-cause fix).
- `markAsPlanned` recomputes `lastUsedAt` for the newly-locked service's songs from the canonical MAX-over-locked-services derivation.
- `reopenService` captures the reopened service's song ids before the status write and recomputes each to its remaining locked MAX (or `null` if that was the only lock).
- `deleteService` deliberately left un-hooked, with an explicit scope-note comment (per 84-CONTEXT.md: the deleted-service case, if ever needed, belongs to the 84-02 backfill, not this delete path).

## Task Commits

Each task followed the TDD RED -> GREEN cycle with its own commit pair:

1. **Task 1: Canonical lastUsed helper**
   - `78de52fb` (test) — failing unit tests for `computeLastUsedDate`/`isLockedStatus`/`serviceDateToMillis`/`serviceToLastUsedInput` (RED: 16/16 fail against stub throws)
   - `e97f46ba` (feat) — real implementation (GREEN: 16/16 pass)
2. **Task 2: Remove assignment stamp, wire lock/unlock recompute**
   - `85c30c72` (test) — four new failing store tests for the draft-no-stamp / lock-writes-date / later-lock-advances / reopen-recomputes behaviors (RED: 4/4 fail)
   - `7498c4fc` (feat) — `services.ts` changes (stamp removal, `recomputeLastUsedFor`/`buildLastUsedSnapshot`/`songIdsInService` helpers, `markAsPlanned`/`reopenService` wiring) plus rewriting the pre-existing `assignSongToSlot` test that had asserted the old (now-removed) stamp behavior (GREEN: all 106 store tests + 16 helper tests pass)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/utils/lastUsed.ts` - Canonical pure last-used derivation (new)
- `src/utils/__tests__/lastUsed.test.ts` - Unit tests for the helper (new)
- `src/stores/services.ts` - Removed the `serverTimestamp()` stamp from `assignSongToSlot`; added `buildLastUsedSnapshot`/`recomputeLastUsedFor`/`songIdsInService` and wired recompute into `markAsPlanned`/`reopenService`; added `deleteService` scope-note comment
- `src/stores/__tests__/services.test.ts` - Added `Timestamp.fromMillis` mock; added `lastUsedAt recompute (R247)` describe block (4 tests); rewrote the pre-existing `assignSongToSlot` "calls updateSong with serverTimestamp" test to assert the fixed no-stamp behavior

## Decisions Made
- Locked === `status !== 'draft'` (covers `'planned'` and `'exported'`); value = `MAX(service.date)` over locked services containing the song via plain ISO-string comparison (no `Date` parsing needed for the MAX itself).
- `serviceDateToMillis`'s local-midnight parse (`new Date(`${date}T00:00:00`).getTime()`) is the single shared convention the live path and the 84-02 backfill must both use, so the written `Timestamp` is identical in both environments — documented in the helper's header comment for the mirroring plan to follow.
- The lock-transition recompute snapshot overrides the triggering service's status in-memory (`buildLastUsedSnapshot`) rather than relying on `services.value`, because the Firestore status write lands asynchronously through `onSnapshot` and the local cache can still show the pre-transition status at call time.
- `deleteService` is deliberately NOT a recompute trigger — per 84-CONTEXT.md, the triggers are the lock/unlock lifecycle only; a deleted-locked-service correction is out of scope here and left to the one-time 84-02 backfill.

## Deviations from Plan

None - plan executed exactly as written. One pre-existing test (`assignSongToSlot > calls useSongStore().updateSong with lastUsedAt serverTimestamp`) asserted the OLD stamp behavior the plan explicitly required removing; it was rewritten (not merely deleted) to assert the new no-stamp behavior, as anticipated by the plan's "keep the on-disk baseline green" instruction for Task 2.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/utils/lastUsed.ts` is ready to be mirrored verbatim into `functions/src/backfillLastUsed.ts` by plan 84-02 (R248 backfill).
- The live path fix is self-contained and does not depend on the backfill; existing songs whose `lastUsedAt` was stamped by the old bug remain wrong in Firestore until 84-02 runs.
- No blockers for 84-02.

---
*Phase: 84-last-used-date-correctness-backfill*
*Completed: 2026-08-26*

## Self-Check: PASSED

All created files present on disk; all four task commit hashes (78de52fb, e97f46ba, 85c30c72, 7498c4fc) found in git log.
