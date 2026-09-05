---
phase: 120-architecture-god-module-decomposition
plan: 02
subsystem: infra
tags: [firebase-functions, typescript, refactor, module-extraction]

requires:
  - phase: 120-architecture-god-module-decomposition (plan 01, if applicable)
    provides: n/a — this plan has no depends_on
provides:
  - functions/src/cleanupSweeps.ts holding the four scheduled Storage-retention sweeps
  - The orgProvisioning-style import/re-export split pattern applied a second time in functions/src/index.ts
affects: [future functions/src/index.ts decomposition plans, backend architecture docs]

tech-stack:
  added: []
  patterns:
    - "Cloud Function concern extraction: implementation module owns handler + onSchedule/onCall wrapper + exclusive helpers; index.ts imports at top and re-exports deploy-facing wrappers on a single line at the bottom (mirrors orgProvisioning.ts/orgMembershipClaims.ts/superAdminClaims.ts)."
    - "Shared helper used by both a moved concern and a concern staying behind: home it in the moved module and import it back into index.ts, rather than importing from index.ts into the new module — keeps the dependency direction one-way (index.ts -> leaf modules) and avoids a require() cycle."

key-files:
  created: [functions/src/cleanupSweeps.ts]
  modified: [functions/src/index.ts, functions/src/index.test.ts]

key-decisions:
  - "Moved renderedPrefixFor (shared by cleanupOrphanRendersHandler and requestPptxRenderHandler) into cleanupSweeps.ts rather than leaving it in index.ts, to avoid a circular require() between index.ts and cleanupSweeps.ts."
  - "Fixed 3 pre-existing SOURCE INSPECTION tests in index.test.ts that read functions/src/index.ts as text to locate the moved handler bodies — repointed to read functions/src/cleanupSweeps.ts instead, since the handlers physically moved."

patterns-established:
  - "Pattern 1: God-module concern extraction via import-top/export-bottom split, applied per-concern to functions/src/index.ts (first precedent beyond the original orgProvisioning/orgMembershipClaims/superAdminClaims trio)."

requirements-completed: [R359]

coverage:
  - id: D1
    description: "The four cleanup sweeps (cleanupExpiredMedia, cleanupOrphanRenders, cleanupOrphanBackgrounds, cleanupPptxSources) plus readDeleteCap moved verbatim into functions/src/cleanupSweeps.ts with no behavior change."
    requirement: "R359"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — cleanupExpiredMediaHandler / cleanupOrphanRendersHandler / cleanupOrphanBackgroundsHandler / cleanupPptxSourcesHandler test blocks (all pass unchanged in behavior)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every moved deploy-facing wrapper is re-exported from index.ts so firebase deploy still finds it — the re-export trap is closed."
    requirement: "R359"
    verification:
      - kind: other
        ref: "word-boundary grep loop: for f in cleanupExpiredMedia cleanupOrphanRenders cleanupOrphanBackgrounds cleanupPptxSources; grep -qE \"\\b$f\\b\" functions/src/index.ts — all four found (import block + bottom re-export line)"
        status: pass
      - kind: other
        ref: "cd functions && npm run build (tsc) — compiles clean, proving the re-exports and previewCleanupDryRunHandler's handler imports resolve"
        status: pass
    human_judgment: false
  - id: D3
    description: "cd functions && npm test is green after the move (functions suite, not the root app suite)."
    requirement: "R359"
    verification:
      - kind: unit
        ref: "cd functions && npm test — 660/660 tests pass, 18/18 files"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-05
status: complete
---

# Phase 120 Plan 02: Extract cleanup sweeps into cleanupSweeps.ts Summary

**Moved the four scheduled Storage-retention sweeps (cleanupExpiredMedia, cleanupOrphanRenders, cleanupOrphanBackgrounds, cleanupPptxSources) out of functions/src/index.ts into a new functions/src/cleanupSweeps.ts, wired via the same import-top/export-bottom pattern as orgProvisioning.ts, and closed the re-export trap with a dedicated grep + build + test verification.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-05T05:17:00Z
- **Completed:** 2026-09-05T05:29:12Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created `functions/src/cleanupSweeps.ts` owning: `readDeleteCap`, `renderedPrefixFor`, the four cleanup handlers (`cleanupExpiredMediaHandler`, `cleanupOrphanRendersHandler`, `cleanupOrphanBackgroundsHandler`, `cleanupPptxSourcesHandler`), their four `onSchedule` wrappers, and every cleanup-only constant/type (`RETENTION_DAYS`, `MEDIA_PATH_GUARD`, `CleanupSummary`, `ORPHAN_RENDER_STALE_HOURS`, `RENDERED_OBJECT_GUARD`, `OrphanCleanupSummary`, `DAY_MS`, `BACKGROUND_RETENTION_DAYS`, `BACKGROUND_PATH_GUARD`, `OrphanBackgroundSummary`, `extractBackgroundObjectPath`, `PPTX_SOURCE_RETENTION_DAYS`, `PPTX_SOURCE_GUARD`, `sourcePrefixFor`, `PptxSourceCleanupSummary`).
- `functions/src/index.ts` shrank by removing the ~670-line cleanup region; `previewCleanupDryRunHandler` stays in place and now imports the four handlers from `./cleanupSweeps`; the four wrappers are re-exported on a single line at the bottom of the file, mirroring the `orgProvisioning` re-export block.
- Re-pointed `functions/src/index.test.ts`'s cleanup-symbol imports to `./cleanupSweeps` (import/wiring change only — no assertion changed).
- Closed the re-export trap: word-boundary grep confirms all four wrapper names survive in `index.ts` (the import block at the top and the single-line re-export at the bottom); `cd functions && npm run build` compiles clean; `cd functions && npm test` is green (660/660).

## Task Commits

Both tasks landed in a single commit — Task 2 was pure verification (grep + build + test) and required no further code changes once Task 1's move was correct.

1. **Task 1 + Task 2: Move cleanup sweeps into cleanupSweeps.ts and verify the re-export trap is closed** - `d03b45bd` (refactor)

_No separate plan-metadata commit was made prior to this SUMMARY; the final docs commit follows below._

## Files Created/Modified
- `functions/src/cleanupSweeps.ts` - New module: the four cleanup sweep Cloud Functions, their handlers, `readDeleteCap`, and `renderedPrefixFor` (moved here to avoid a circular import — see Deviations).
- `functions/src/index.ts` - Cleanup region removed; import of the four handlers/wrappers/`renderedPrefixFor` from `./cleanupSweeps` added near the top; single-line re-export of the four wrappers added at the bottom (mirroring the `orgProvisioning` block); `previewCleanupDryRunHandler` untouched in place, now calling the imported handlers.
- `functions/src/index.test.ts` - Cleanup-symbol imports re-pointed to `./cleanupSweeps`; 3 pre-existing SOURCE INSPECTION tests updated to read `cleanupSweeps.ts` instead of `index.ts` (the handler bodies they inspect physically moved).

## Decisions Made
- **renderedPrefixFor placement:** this one-line helper is used by both `cleanupOrphanRendersHandler` (moving) and `requestPptxRenderHandler` (staying in index.ts). Rather than leave it in `index.ts` and have `cleanupSweeps.ts` import it back — which would create a `require()` cycle (`index.ts` already imports the four handlers/wrappers from `cleanupSweeps.ts`, and the bottom re-export closes the loop the other way) — it was moved into `cleanupSweeps.ts` and `index.ts` now imports it from there. This keeps the dependency graph one-directional (`index.ts` → `cleanupSweeps.ts`), consistent with every other extraction in this file (`orgProvisioning.ts`, `orgMembershipClaims.ts`, `superAdminClaims.ts` — none of which import back from `index.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 SOURCE INSPECTION tests that read the wrong file after the move**
- **Found during:** Task 1 verification (`cd functions && npm test`)
- **Issue:** Three tests in `index.test.ts` (`cleanupOrphanRendersHandler`'s inverted-gate pin, `cleanupOrphanBackgroundsHandler`'s dry-run-gate pin, `cleanupPptxSourcesHandler`'s dry-run-gate pin) do source-text inspection by `readFileSync(path.join(__dirname, "index.ts"))` and search for the handler body by name. After the move, those handler bodies no longer exist in `index.ts`, so `source.indexOf(...)` returned `-1` and all three failed with `expected -1 to be greater than -1`.
- **Fix:** Repointed the `readFileSync` call in each of the 3 tests to `cleanupSweeps.ts` (the handlers' new home). No assertion logic changed — same regex/substring checks, same expected pass/fail semantics.
- **Files modified:** `functions/src/index.test.ts`
- **Verification:** `cd functions && npm test` — 660/660 pass (was 657/660 before the fix).
- **Committed in:** `d03b45bd` (Task 1/2 commit)

**2. [Rule 1 - Bug avoidance] Moved renderedPrefixFor into cleanupSweeps.ts instead of leaving it in index.ts**
- **Found during:** Task 1 planning (before writing code)
- **Issue:** The plan's action text doesn't call out `renderedPrefixFor` explicitly, but it is used inside `cleanupOrphanRendersHandler` (moving) and is also used inside `requestPptxRenderHandler` (staying). Leaving it in `index.ts` and importing it into `cleanupSweeps.ts` (the plan's generic "leave shared helpers in index.ts and import them" guidance) would create a two-way `require()` cycle between `index.ts` and `cleanupSweeps.ts`, since `index.ts` already imports the four handlers/wrappers from `cleanupSweeps.ts` at the top and re-exports them at the bottom.
- **Fix:** Moved `renderedPrefixFor` into `cleanupSweeps.ts` (exported) and added it to `index.ts`'s top-of-file import from `./cleanupSweeps`, used unchanged by `requestPptxRenderHandler`. Dependency direction stays one-way.
- **Files modified:** `functions/src/cleanupSweeps.ts`, `functions/src/index.ts`
- **Verification:** `cd functions && npm run build` compiles clean; `cd functions && npm test` green; `requestPptxRenderHandler`'s existing tests pass unchanged.
- **Committed in:** `d03b45bd` (Task 1/2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix in tests, 1 bug-avoidance in module design)
**Impact on plan:** Both were necessary for correctness (a genuinely broken test suite in case 1; a latent circular-import risk in case 2). No scope creep — no other concern was touched, and no Cloud Function's behavior, schedule, guard, or deploy name changed.

## Issues Encountered
None beyond the two deviations above, both resolved inline during Task 1.

## User Setup Required
None - no external service configuration required. This is a pure code-organization move; nothing is deployed as part of this plan (per project convention, deploys require explicit owner confirmation).

## Next Phase Readiness
- `functions/src/index.ts` is measurably smaller (the ~670-line cleanup region is gone) and the extraction pattern (import-top/export-bottom, shared-helper-lives-with-its-primary-consumer-to-avoid-cycles) is now demonstrated twice (orgProvisioning family + cleanupSweeps), ready to be repeated for the remaining god-module concerns (API proxy, PPTX pipeline, cron, messaging) in future backlog phases.
- R359 acceptance criteria fully met: moved functions' tests pass with behavior unchanged; every moved function is re-exported from `index.ts`; `cd functions && npm run build` succeeds; functions suite green (660/660); re-export trap explicitly verified via word-boundary grep.
- This is the last plan of the last phase (120) of milestone v2.10 — ready for the milestone audit + completion run per 120-CONTEXT.md.

---
*Phase: 120-architecture-god-module-decomposition*
*Completed: 2026-09-05*

## Self-Check: PASSED
- FOUND: functions/src/cleanupSweeps.ts
- FOUND: .planning/phases/120-architecture-god-module-decomposition/120-02-SUMMARY.md
- FOUND: d03b45bd (git log --oneline --all)
