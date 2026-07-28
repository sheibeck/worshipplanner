---
phase: 22-media-attachments-and-storage-lifecycle
plan: 03
subsystem: infra
tags: [firebase-functions, onSchedule, cloud-storage, retention, vitest]

# Dependency graph
requires:
  - phase: 22-01
    provides: "media stored under orgs/{orgId}/media/... with createdAt custom metadata; storage.rules media match block"
provides:
  - "cleanupExpiredMedia (onSchedule, daily 02:00 UTC) + testable cleanupExpiredMediaHandler in functions/src/index.ts"
  - "MEDIA_PATH_GUARD (^orgs/[^/]+/media/) hard path guard, RETENTION_DAYS=14 constant, CleanupSummary type — all exported for reuse/testing"
  - "MEDIA_CLEANUP_DRY_RUN env-flag dry-run mode (default-safe: dry-run unless explicitly set to 'true')"
affects: [media-cleanup-function, storage-cost-ops, milestone-v1.2-signoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Testable-handler split for a scheduled function: cleanupExpiredMediaHandler (exported, unit-testable) wrapped by cleanupExpiredMedia = onSchedule(...) — mirrors the 21-04 parsePptxHandler/parsePptx split"
    - "Hard path guard applied to every listing candidate BEFORE any delete/count decision, independent of and in addition to a narrowed getFiles() prefix — defense in depth against over-broad deletion"
    - "Age keyed on native GCS object timeCreated (server-set, tamper-resistant), never on client-settable custom metadata"
    - "Per-file try/catch around delete() so one failure never aborts the run; idempotent-by-age design means a partial run is safely retried by the next daily invocation with no double-effect"

key-files:
  created:
    - functions/src/index.test.ts
  modified:
    - functions/src/index.ts

key-decisions:
  - "MEDIA_PATH_GUARD, RETENTION_DAYS, and CleanupSummary are all exported (not module-private) so tests can assert the regex directly and so the handler's return value is directly assertable, rather than only inferring behavior from mock call counts"
  - "getFiles({ prefix: 'orgs/', autoPaginate: true }) plus the MEDIA_PATH_GUARD regex are two independent, stacked safety bounds (a narrowed prefix AND a regex re-check per file) — neither alone is trusted as the sole safety mechanism, per the threat model's defense-in-depth intent"
  - "An unreadable/missing timeCreated fails safe (file is skipped, not deleted) rather than defaulting to 'old enough to delete'"
  - "Dry-run mode still increments deletedCount (as a 'would-delete' count) and scannedCount, but never calls file.delete() — the summary log distinguishes real vs simulated action via the dryRun boolean, matching the acceptance criteria's 'still counts/logs it' requirement"

patterns-established:
  - "Scheduled Cloud Function testable-handler split: export the handler body separately from the onSchedule(...) wrapper so it can be invoked directly in tests against a mocked bucket, with no Firebase Functions test harness needed"

requirements-completed: [R015]

coverage:
  - id: D1
    description: "cleanupExpiredMedia scheduled function (onSchedule, daily 02:00 UTC) + cleanupExpiredMediaHandler deletes only Storage objects under orgs/{orgId}/media/ older than 14 days, keyed on native timeCreated"
    requirement: "R015"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler deletes a media file older than the retention window"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler does not delete a recent media file"
        status: pass
    human_judgment: false
  - id: D2
    description: "MEDIA_PATH_GUARD excludes pptx-imports and every non-media path from deletion, even when old — the hard safety gate"
    requirement: "R015"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#MEDIA_PATH_GUARD matches/does-not-match tests"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler never deletes a non-media (pptx-imports) object even when old"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dry-run mode (MEDIA_CLEANUP_DRY_RUN=true) scans and logs but deletes nothing"
    requirement: "R015"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler dry-run mode counts/logs an old media file but calls no delete"
        status: pass
    human_judgment: false
  - id: D4
    description: "Handler makes no Firestore call — structurally incapable of touching slide metadata/text"
    requirement: "R015"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler makes no Firestore call -- slide metadata is structurally untouchable"
        status: pass
    human_judgment: false
  - id: D5
    description: "Run is idempotent by age: a second run against a bucket missing the already-deleted file performs no further deletes"
    requirement: "R015"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler is idempotent by age: a second run ... performs no further deletes"
        status: pass
    human_judgment: false
  - id: D6
    description: "Human dry-run review before enabling live deletion of the production bucket"
    verification: []
    human_judgment: true
    rationale: "This is a destructive, unattended, scheduled job against the production Storage bucket. Per the plan's explicit blocking-human checkpoint (Task 2, gate=blocking-human) and this execution's instructions, the executor must NOT self-approve enabling live deletion. A human must review dry-run output (sample summary log, path-guard behavior, retention window) before MEDIA_CLEANUP_DRY_RUN is unset/disabled in the deployed environment. PENDING at time of this SUMMARY."

# Metrics
duration: ~20min
completed: 2026-07-25
status: pending-human-verification
---

# Phase 22 Plan 03: cleanupExpiredMedia Scheduled Storage Retention Summary

**Daily `onSchedule` Cloud Function that deletes only >14-day-old objects under `orgs/{orgId}/media/`, keyed on native GCS `timeCreated`, dry-run by default, never touching Firestore — human dry-run review is PENDING before live deletion is enabled.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-25T17:05:00-04:00 (approx.)
- **Completed:** 2026-07-25T17:25:00-04:00 (approx.)
- **Tasks:** 1 of 2 (Task 2 is a blocking human-verify checkpoint, PENDING)
- **Files modified:** 2 (1 new, 1 modified)

## Accomplishments
- Added `cleanupExpiredMediaHandler` (testable) and `cleanupExpiredMedia` (`onSchedule`, `every day 02:00` UTC) to `functions/src/index.ts`, mirroring the existing `parsePptxHandler`/`parsePptx` testable-handler split.
- `MEDIA_PATH_GUARD` (`^orgs/[^/]+/media/`) is applied to every candidate object before any delete decision — a hard, independent safety gate stacked on top of the already-narrowed `getFiles({ prefix: "orgs/" })` listing scope.
- Age is keyed exclusively on the object's native GCS `timeCreated` (never client-settable custom metadata); `RETENTION_DAYS = 14`.
- `MEDIA_CLEANUP_DRY_RUN` env flag defaults the function to dry-run (scans + logs, deletes nothing) — the function ships safe by default and must be explicitly opted into live deletion.
- Handler imports/calls no Firestore API anywhere — it is structurally incapable of touching slide documents, slot metadata, or slide text.
- Per-file delete is wrapped in try/catch (one failure never aborts the run) and the design is idempotent-by-age (a partially-failed run is safely retried by the next daily invocation with no double-effect).
- `functions/src/index.test.ts` (new): 8 tests — path-guard match/non-match, delete-when-old, skip-when-recent, skip-non-media-even-when-old, dry-run-deletes-nothing, no-Firestore-call assertion, and a two-run idempotency test.
- Full `functions/` suite: 23/23 tests pass (2 test files); `npm --prefix functions run build` (tsc) succeeds with 0 errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the cleanupExpiredMedia scheduled function + tested handler** - `9c1fd78` (feat)
2. **Task 2: Human-verify the destructive cleanup deleter via a dry-run** - PENDING (blocking-human checkpoint, see below)

**Plan metadata:** committed alongside this SUMMARY (see final commit below)

_No TDD tasks in this plan — single feat commit for Task 1._

## Files Created/Modified
- `functions/src/index.ts` - Added `onSchedule` import (`firebase-functions/v2/scheduler`), `RETENTION_DAYS`, `MEDIA_PATH_GUARD`, `CleanupSummary`, `cleanupExpiredMediaHandler`, and `cleanupExpiredMedia` (the `onSchedule` wrapper, daily 02:00 UTC)
- `functions/src/index.test.ts` - New file: 8 tests against a mocked `firebase-admin/storage` bucket (`getFiles`/`file.delete` spies), mirroring `pptxParser.test.ts`'s mocking pattern for `firebase-admin/app`, `firebase-admin/auth`, `firebase-admin/firestore`, and `firebase-functions/params`

## Decisions Made
- `MEDIA_PATH_GUARD`, `RETENTION_DAYS`, and `CleanupSummary` are exported (not module-private) so tests can assert the guard regex directly and the handler's return value directly, rather than inferring correctness purely from mock call-count side effects.
- Kept two independent, stacked safety bounds (narrowed `getFiles` prefix `"orgs/"` AND a per-file `MEDIA_PATH_GUARD` regex re-check) rather than relying on either alone — defense in depth per the threat model's intent (T-22-03-01).
- An object with a missing or unparseable `timeCreated` fails safe: it is skipped (never deleted), not treated as "old enough."
- Dry-run mode still increments `deletedCount` (interpreted as "would-delete count") and `scannedCount` so the logged summary is informative for the human dry-run review, while `dryRun: true` in the returned/logged summary makes clear no real deletion occurred.

## Deviations from Plan

None - plan executed exactly as written for Task 1. No auto-fixes were needed; the existing `parsePptxHandler`/`parsePptx` split and `pptxParser.test.ts` mocking conventions transferred directly.

## Issues Encountered

None. `npm --prefix functions run build` and the full `functions/` vitest suite were run without needing the emulator (per this execution's environment constraints) — all mocking is done via `vi.mock` against `firebase-admin/*` modules, so no live Firebase project, emulator, or network call was ever touched.

## User Setup Required

None - no new environment variables or external service configuration required to ship dry-run mode (it is the safe default with no env var set). `MEDIA_CLEANUP_DRY_RUN` only needs to be explicitly set (and only after human approval per Task 2) to move to live deletion in a deployed environment.

## Next Phase Readiness

- Code and unit tests for `cleanupExpiredMedia` are complete and committed (`9c1fd78`). `npm --prefix functions run build` and the full test suite are green.
- **BLOCKED on human-verify (Task 2, gate=blocking-human):** This plan's checkpoint requires a human to review dry-run output (sample summary log showing `scannedCount`/`deletedCount`/`dryRun: true`, confirmation the path guard spares `pptx-imports` and recent media, and confirmation no Firestore call occurs) before `MEDIA_CLEANUP_DRY_RUN` is disabled in any deployed environment. The executor did NOT self-approve enabling live deletion, per explicit instruction. See the CHECKPOINT REACHED section returned alongside this SUMMARY for exact review steps.
- Once approved, deploying `cleanupExpiredMedia` with `MEDIA_CLEANUP_DRY_RUN` unset (or `"false"`) in the Cloud Functions environment will enable live daily deletion of >14-day-old media objects.

---
*Phase: 22-media-attachments-and-storage-lifecycle*
*Completed: 2026-07-25*

## Self-Check: PASSED

All created/modified files found on disk; task commit hash (9c1fd78) found in git log; 23/23 functions tests pass; tsc build succeeds with 0 errors.
