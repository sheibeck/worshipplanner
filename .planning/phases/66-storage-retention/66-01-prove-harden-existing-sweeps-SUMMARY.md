---
phase: 66-storage-retention
plan: 01
subsystem: infra
tags: [firebase-functions, cloud-storage, cron, retention, cost-controls]

# Dependency graph
requires:
  - phase: 22-03 (pre-v1.8 history)
    provides: cleanupExpiredMediaHandler (MEDIA_CLEANUP_ENABLED gate, MEDIA_PATH_GUARD, RETENTION_DAYS)
  - phase: 37-04 / 62 (pre-v1.8 history)
    provides: cleanupOrphanRendersHandler (PPTX_RENDER_CLEANUP_ENABLED gate, RENDERED_OBJECT_GUARD, ORPHAN_RENDER_STALE_HOURS)
provides:
  - readDeleteCap() shared helper (STORAGE_CLEANUP_MAX_DELETES_PER_RUN, default 500) — reused by 66-02's new sweeps
  - Proof-by-test that both existing dry-run sweeps actually delete the guarded+aged/stale object set when their flag is exactly "true"
  - deletedBytes + cappedByLimit observability fields on both cleanup summaries
  - Owner-gated enablement command sequence for the first LIVE deletion (handed over below, not executed)
affects: [66-02-new-retention-sweeps]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-run delete cap: LIVE mode checks a run-level counter against readDeleteCap() before each delete and breaks (not skips) once reached; dry-run is never capped so the owner sees the true backlog before enabling."
    - "cleanupOrphanRendersHandler now only deletes a render doc once ALL of its rendered/ objects were deleted in the same run — if the cap is hit mid-doc, the doc is left in place for the next run to finish."

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "readDeleteCap() built on the existing readNumericKnob(raw, fallback) parser, then narrowed to a positive integer (falls back to 500 on 0/negative/non-integer) rather than writing a fully separate parser."
  - "The cap is enforced with a run-level (not per-doc) counter in cleanupOrphanRendersHandler per the plan's explicit instruction, so a doc's rendered objects are only ever partially capped, never the doc deleted out from under a partially-cleared object set."
  - "Task 1 and Task 2's source edits landed together in the Task 1 commit (both handlers share readDeleteCap() and were edited in one pass); Task 2's commit carries only its test coverage. Both gates (test/build) were verified green after each task's logical unit was complete."

requirements-completed: [R165, R166]

coverage:
  - id: D1
    description: "cleanupExpiredMediaHandler actually deletes an aged orgs/{orgId}/media/ object when MEDIA_CLEANUP_ENABLED=\"true\" (not just dry-run-logs), and deletes exactly the guarded+aged set (an aged pptx-imports file and a recent media file both survive)."
    requirement: "R165"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler > deletes a media file older than the retention window when explicitly enabled"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler > R165: deletes exactly the guarded+aged set -- an aged pptx-imports file and a recent media file both survive alongside an aged media file"
        status: pass
    human_judgment: false
  - id: D2
    description: "cleanupExpiredMediaHandler stays dry-run (deletes nothing) for every non-\"true\" MEDIA_CLEANUP_ENABLED value: unset, \"\", \"false\", \"1\", \"True\"."
    requirement: "R165"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler > FAILS SAFE (5 cases: unset/empty/false/\"1\"/\"True\")"
        status: pass
    human_judgment: false
  - id: D3
    description: "cleanupExpiredMediaHandler reports deletedBytes (summed known file sizes) and cappedByLimit; a per-run STORAGE_CLEANUP_MAX_DELETES_PER_RUN cap bounds a LIVE run to exactly N deletes without truncating the dry-run count."
    requirement: "R165"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler > R165/T-66-01-04: reports deletedBytes for a LIVE delete, and dry-run reports the same would-delete byte total"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler > T-66-01-02: a per-run delete cap bounds a LIVE run"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupExpiredMediaHandler > T-66-01-02: the delete cap does NOT truncate a dry-run"
        status: pass
    human_judgment: false
  - id: D4
    description: "cleanupOrphanRendersHandler actually deletes both stale rendered/ objects and their render doc when PPTX_RENDER_CLEANUP_ENABLED=\"true\"; ready/fresh/guard exclusions and the fail-safe gate direction (★ SOURCE INSPECTION) all still hold."
    requirement: "R166"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanRendersHandler > deletes both rendered objects and the doc when explicitly enabled"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanRendersHandler > ★ SOURCE INSPECTION: the dry-run gate direction is pinned against the 2026-07-28 inverted-gate incident (9f1b881)"
        status: pass
    human_judgment: false
  - id: D5
    description: "cleanupOrphanRendersHandler reports deletedBytes (summed known rendered-object sizes) and cappedByLimit; the shared readDeleteCap() bounds total object deletes across the whole run, and a doc is only removed once its rendered objects are fully cleared -- never left partially deleted."
    requirement: "R166"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanRendersHandler > R166/T-66-01-04: reports deletedBytes for a LIVE run summing known rendered-object sizes"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanRendersHandler > T-66-01-02: a per-run delete cap bounds a LIVE run within a single doc"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanRendersHandler > T-66-01-02: the delete cap does NOT truncate a dry-run"
        status: pass
    human_judgment: false

# Metrics
duration: ~11min
completed: 2026-08-20
status: complete
---

# Phase 66 Plan 01: Prove + Harden Existing Storage Sweeps Summary

**Proved by test (against mocked Storage/Firestore) that `cleanupExpiredMediaHandler` (R165) and `cleanupOrphanRendersHandler` (R166) actually delete the right objects when enabled, and added a shared `readDeleteCap()` per-run delete-cap plus `deletedBytes`/`cappedByLimit` observability to both — every enable flag still ships OFF.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-08-20T05:20:00Z (approx, session start)
- **Completed:** 2026-08-20T05:31:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (`functions/src/index.ts`, `functions/src/index.test.ts`)

## Accomplishments
- `cleanupExpiredMediaHandler`'s LIVE delete branch is proven by test to delete exactly the `orgs/{orgId}/media/` + aged set — a same-run aged `pptx-imports/` file and a recent media file both survive alongside it.
- `cleanupOrphanRendersHandler`'s LIVE delete branch is proven by test to delete both stale `rendered/` objects and their render doc, with the ★ SOURCE INSPECTION gate-direction regression test unchanged and still passing.
- New shared `readDeleteCap()` helper (`STORAGE_CLEANUP_MAX_DELETES_PER_RUN`, default 500) bounds a single LIVE run's blast radius for both sweeps — and is exported for reuse by 66-02's new sweeps.
- Both `CleanupSummary`/`OrphanCleanupSummary` now report `deletedBytes` and `cappedByLimit`; dry-run is never capped (the owner sees the true backlog/byte count before flipping the enable flag).
- `cleanupOrphanRendersHandler`'s cap is enforced as a single run-level counter (not per-doc): if the cap is hit partway through a doc's rendered objects, the doc itself is left undeleted so the next daily run finishes clearing it before removing it.
- Fail-safe coverage extended for both handlers to explicitly cover `""` and `"True"` alongside the pre-existing unset/`"false"`/`"1"` cases.
- `cd functions && npm test` — 313/313 tests pass (full suite; 209/209 in `index.test.ts` alone, up from 197 pre-plan). `cd functions && npm run build` is clean.
- No `firebase deploy` was run. No `functions/.env` was written or read by this plan (pre-existing local file, untouched — confirmed via `git status` showing no diff against it).

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden and prove cleanupExpiredMediaHandler — delete cap + deleted-bytes + delete-branch proof (R165)** - `ba217ab` (feat)
   - Includes the shared `readDeleteCap()` helper and both handlers' `CleanupSummary`/`OrphanCleanupSummary` + delete-cap-loop source changes (see Deviations below for why Task 2's source landed here).
2. **Task 2: Harden and prove cleanupOrphanRendersHandler — delete cap + deleted-bytes + delete-branch proof (R166)** - `e1f28d43` (test)
   - Adds the test coverage proving the `cleanupOrphanRendersHandler` changes already present in commit `ba217ab`.

**Plan metadata:** _(final docs commit, see below)_

## Files Created/Modified
- `functions/src/index.ts` — added `readDeleteCap()`; extended `CleanupSummary`/`OrphanCleanupSummary` with `deletedBytes`/`cappedByLimit`; both handlers now sum byte sizes and enforce the per-run cap in LIVE mode only.
- `functions/src/index.test.ts` — extended `fakeFile`/`fakeRenderedObject` with an optional byte-size param; added delete-branch-proof, exact-guarded-set, deletedBytes, and delete-cap test cases to both `describe` blocks; extended fail-safe coverage to `""`/`"True"` for `MEDIA_CLEANUP_ENABLED`.

## Decisions Made
- `readDeleteCap()` reuses the existing `readNumericKnob(raw, fallback)` parser (per the plan's suggestion) rather than a bespoke parser, then narrows the result to a positive integer — 0, negative, or non-integer values fall back to the default of 500.
- The cap in `cleanupOrphanRendersHandler` is a single run-level counter across all docs (not reset per-doc), matching the plan's explicit instruction; once hit mid-doc, the run stops issuing further object deletes AND stops deleting further docs (including not deleting the doc whose objects were only partially cleared).
- Existing partial-failure tolerance (a rejected `file.delete()` doesn't abort the run and the doc is still deleted) is preserved unchanged — the "doc only deleted once fully cleared" rule applies only to the delete-cap path, not to per-object delete errors.

## Deviations from Plan

### Auto-fixed Issues
None — no bugs, missing critical functionality, or blocking issues were found; both handlers' pre-existing safety contracts (path guards, fail-safe gate direction, partial-failure tolerance, Firestore-free `cleanupExpiredMediaHandler`) were left byte-for-byte unchanged as instructed.

### Commit organization note (not a deviation rule, but worth flagging)
Because `readDeleteCap()` is shared by both handlers, all of Task 1's and Task 2's `functions/src/index.ts` source edits were made in one pass before the first task's tests/build were verified and committed — so the Task 1 commit (`ba217ab`) contains both handlers' source changes, and the Task 2 commit (`e1f28d43`) contains only its test additions. Both tasks' `verify:` gates (`cd functions && npm test -- --run src/index.test.ts`, `cd functions && npm run build`) were run and passed green at the point each task's logical unit (source + its own tests) was complete, satisfying the plan's per-task verification contract even though the source-file diff boundary doesn't split cleanly along the task boundary.

---

**Total deviations:** 0 auto-fixed. One commit-organization note (source changes for both handlers landed in the Task 1 commit due to the shared helper).
**Impact on plan:** None on functionality or safety — every `verify:`/`<done>` criterion for both tasks passed. No scope creep.

## Issues Encountered
None.

## User Setup Required

None — no external service configuration is needed to ship this plan (everything is proven against mocked Storage/Firestore). However, the plan's `user_setup` block hands over the OWNER-GATED steps for the first LIVE deletion, which are NOT executed by this plan and are recorded verbatim below.

## Handover — Owner-Gated First LIVE Deletion (do NOT run; not executed by this plan)

Both sweeps still delete NOTHING by default (`MEDIA_CLEANUP_ENABLED` and `PPTX_RENDER_CLEANUP_ENABLED` are unset in this codebase; `functions/.env` was neither written nor read). Enabling real deletion in production is the owner's gated first-deletion deploy:

1. **Media sweep:** add `MEDIA_CLEANUP_ENABLED=true` to `functions/.env`, then run:
   ```
   firebase deploy --only functions:cleanupExpiredMedia
   ```
2. **Orphan-render sweep:** add `PPTX_RENDER_CLEANUP_ENABLED=true` to `functions/.env`, then run:
   ```
   firebase deploy --only functions:cleanupOrphanRenders
   ```
3. **(Optional) tune the blast radius** of the first LIVE run before or alongside the above by adding `STORAGE_CLEANUP_MAX_DELETES_PER_RUN=<n>` to `functions/.env` (default 500 if unset). **Review a dry-run's logged `deletedCount`/`deletedBytes` in Cloud Logging BEFORE enabling** — both sweeps already log their full would-delete count and byte total every day at 02:00 UTC (media) and 03:00 UTC (orphan renders), so the owner can see the true backlog size before flipping either flag.

Separately, the hardened (still dry-run-by-default) `cleanupExpiredMedia`/`cleanupOrphanRenders` FUNCTIONS themselves are autonomous-deployable per the v1.8 grant (they delete nothing with flags off) — the orchestrator may fold `firebase deploy --only functions:cleanupExpiredMedia,functions:cleanupOrphanRenders` into its consolidated end-of-milestone deploy. This plan itself did NOT run any `firebase deploy`.

## Next Phase Readiness
- `readDeleteCap()` is exported from `functions/src/index.ts` and ready for 66-02's new background/pptx-source sweeps to reuse directly.
- No blockers for 66-02 (new retention sweeps for R167/R168) — it depends on this plan only for the shared cap helper, which is now in place and tested.

---
*Phase: 66-storage-retention*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: functions/src/index.ts
- FOUND: functions/src/index.test.ts
- FOUND: .planning/phases/66-storage-retention/66-01-prove-harden-existing-sweeps-SUMMARY.md
- FOUND commit: ba217ab
- FOUND commit: e1f28d43
