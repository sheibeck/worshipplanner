---
phase: 66-storage-retention
plan: 02
subsystem: infra
tags: [firebase-functions, cloud-storage, cron, retention, cost-controls, reference-integrity]

# Dependency graph
requires:
  - phase: 66-01
    provides: readDeleteCap() shared helper (STORAGE_CLEANUP_MAX_DELETES_PER_RUN, default 500)
  - phase: pre-v1.8 history
    provides: cleanupOrphanRendersHandler / pptxRenders collectionGroup / renderedPrefixFor pattern mirrored by both new sweeps
provides:
  - cleanupOrphanBackgroundsHandler + cleanupOrphanBackgrounds cron (R167) -- the FIRST retention path ever built for orgs/{orgId}/backgrounds/
  - cleanupPptxSourcesHandler + cleanupPptxSources cron (R168) -- the FIRST retention path ever built for pptx-import source.pptx + images/
  - extractBackgroundObjectPath() pure helper (Firebase download URL -> object path)
  - sourcePrefixFor() pure helper (mirrors renderedPrefixFor)
  - Confirmed three-tier background reference model (see "Background Reference Model" below), reusable by any future background-touching work
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Orphan+age double gate (never pure age): a background is a delete candidate only when BOTH unreferenced across all tiers AND older than the retention window."
    - "References-incomplete fail-safe: an unparseable reference URL or a throwing scan forces the WHOLE run to dry-run, not just the affected item."
    - "Floor guard (new, beyond the plan's original spec): a reference scan that succeeds but returns literally zero references while candidate objects exist is ALSO treated as incomplete -- closes the gap the throw/parse-failure fail-safe alone doesn't cover (a scan against the wrong collection, or a permissions issue, that silently returns no docs)."
    - "Positive path guards (PPTX_SOURCE_GUARD) instead of negative exception lists -- rendered/ is structurally unmatchable, not excluded by a runtime check."
    - "Render-doc-driven scope: cleanupPptxSourcesHandler only ever sees imports that have a pptxRenders doc, so an image-only import (no render doc) is out of scope by construction, never by an explicit check."

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "Floor guard added per the orchestrator's plan-checker hardening instruction: `referencedPaths.size === 0 && candidates.length > 0` forces `referencesComplete = false`, which forces `effectiveDryRun = true`. A dedicated test proves this fires even when both collectionGroup scans succeed cleanly (no throw, no unparseable URL) but simply return zero docs."
  - "The floor guard does NOT fire when there are zero candidates AND zero references (e.g. a brand-new org with no backgrounds uploaded yet) -- that is not an anomaly. A dedicated test proves this distinction (candidates.length === 0 is the escape hatch)."
  - "DAY_MS is a new shared local constant (not exported) introduced above both sweeps, replacing what would otherwise be two separate `24 * 60 * 60 * 1000` inline literals -- mirrors the existing sweeps' inline style but avoids duplicating the magic number across two new handlers."
  - "cleanupPptxSourcesHandler enforces readDeleteCap() as a single run-level counter across ALL eligible imports in the run (via a labeled `outer` for-loop break), matching cleanupOrphanRendersHandler's 66-01 run-level (not per-doc) cap semantics."
  - "Per 66-01's established precedent, Task 1's and Task 2's source edits were written in one pass (Task 2's cleanupPptxSourcesHandler is adjacent to and follows Task 1's cleanupOrphanBackgroundsHandler in the file), then split into two atomic commits by reconstructing an intermediate 'Task 1 only' file state (background sweep + its tests only, pptx-source additions removed), verifying `npm run build` + `npm test -- --run src/index.test.ts` green against that intermediate state, committing, then restoring the full final state and verifying + committing again. Both tasks' `<verify>` gates were run and passed against the exact code state each commit represents -- not just at the end."

requirements-completed: [R167, R168]

coverage:
  - id: D1
    description: "cleanupOrphanBackgroundsHandler deletes an aged (>30d), unreferenced background when BACKGROUND_CLEANUP_ENABLED=\"true\", and reports deletedCount=1/dryRun=false."
    requirement: "R167"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > R167: deletes an aged unreferenced background when explicitly enabled, and never deletes an aged background referenced at the GROUP tier in the same run"
        status: pass
    human_judgment: false
  - id: D2
    description: "A background referenced at ANY of the three tiers (slideGroups group field, embedded slides[] array entry, songs/*/lyrics/* field) is NEVER deleted regardless of age -- one test per tier."
    requirement: "R167"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > R167: deletes an aged unreferenced background... (GROUP tier survives)"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > NEVER deletes a background referenced at the SLIDE tier (embedded slides[] array entry, not the group field)"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > NEVER deletes a background referenced at the SONG (lyrics) tier"
        status: pass
    human_judgment: false
  - id: D3
    description: "REFERENCES-INCOMPLETE fail-safe: an unparseable backgroundImageUrl, OR a throwing collectionGroup scan, forces the WHOLE run to dry-run (deletes nothing) even with the flag enabled."
    requirement: "R167"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > REFERENCES-INCOMPLETE FAIL-SAFE: an unparseable backgroundImageUrl forces the whole run to dry-run, even with the flag enabled"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > REFERENCES-INCOMPLETE FAIL-SAFE: a collectionGroup scan throwing forces the whole run to dry-run"
        status: pass
    human_judgment: false
  - id: D4
    description: "FLOOR GUARD (plan-checker hardening, beyond the plan's original spec): zero total references found anywhere, while candidate backgrounds exist, ALSO forces the whole run to dry-run -- never delete every background because a scan came back silently empty. A companion test proves the guard does NOT misfire when there are truly zero candidates (an empty-backgrounds org)."
    requirement: "R167"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > FLOOR GUARD: zero total references found anywhere, yet candidate backgrounds exist -- treats references as incomplete and deletes nothing"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > does NOT trip the floor guard when there truly are no candidate backgrounds at all (zero references, zero candidates is not suspicious)"
        status: pass
    human_judgment: false
  - id: D5
    description: "BACKGROUND_PATH_GUARD, age gate (NaN/unreadable timeCreated skipped), the exact !== \"true\" fail-safe gate direction (5 non-true values), and the per-run readDeleteCap() (both LIVE-bounded and never-truncated-dry-run) all hold for cleanupOrphanBackgroundsHandler."
    requirement: "R167"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > path guard: an aged object under orgs/{orgId}/media/ or .../pptx-imports/ is never considered, even when enabled"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > an unreadable/missing timeCreated is skipped even with the gate enabled -- fail safe"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > FAILS SAFE: unset/empty/false/1/True all leave dryRun=true and delete nothing"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > T-66-02-04: a per-run delete cap bounds a LIVE run -- exactly one delete() call, cappedByLimit=true"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > the delete cap does NOT truncate a dry-run -- would-delete bytes/count reported in full"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler > ★ SOURCE INSPECTION: the dry-run gate direction is pinned (BACKGROUND_CLEANUP_ENABLED)"
        status: pass
    human_judgment: false
  - id: D6
    description: "cleanupPptxSourcesHandler deletes source.pptx + images/ for a CONSUMED (\"ready\") aged import while KEEPING rendered/ -- proven both for the delete branch and dedicated 90-day-old rendered/-survives assertion."
    requirement: "R168"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > R168: deletes source.pptx and images/ for a CONSUMED (ready) aged import while KEEPING rendered/"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > KEEP rendered/: even a 90-day-old ready import with the flag enabled never has a rendered/ object deleted"
        status: pass
    human_judgment: false
  - id: D7
    description: "An aged FAILED import's source.pptx + images/ are also pruned (rendered/ and doc lifecycle stay owned by cleanupOrphanRendersHandler, unchanged); a too-new ready import and a pending import are both never touched; an unreadable createdAt and a missing parent org id are both skipped."
    requirement: "R168"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > prunes source.pptx + images/ for an aged FAILED import too -- rendered/ and doc lifecycle stay owned by cleanupOrphanRenders"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > never touches a fresh/too-new ready import -- consumption alone is not sufficient, only consumption AND age"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > never touches a pending import -- excluded by the status filter itself"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > an unreadable/missing createdAt is skipped even with the gate enabled -- fail safe"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > skips a doc whose parent org id is missing from the parent chain"
        status: pass
    human_judgment: false
  - id: D8
    description: "PPTX_SOURCE_GUARD is a positive guard (matches ONLY source.pptx + images/, never rendered/), the exact !== \"true\" fail-safe gate direction (5 non-true values) holds, and the per-run readDeleteCap() (both LIVE-bounded and never-truncated-dry-run) holds."
    requirement: "R168"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#PPTX_SOURCE_GUARD > NEVER matches rendered/ -- structurally excluded, not by exception list"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > FAILS SAFE: unset/empty/false/1/True all leave dryRun=true and delete nothing"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > T-66-02-04: a per-run delete cap bounds a LIVE run -- exactly one object delete() call, cappedByLimit=true"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > the delete cap does NOT truncate a dry-run -- the full would-delete object count is still reported"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupPptxSourcesHandler > ★ SOURCE INSPECTION: the dry-run gate direction is pinned (PPTX_SOURCE_CLEANUP_ENABLED)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-08-20
status: complete
---

# Phase 66 Plan 02: New Retention Sweeps (R167/R168) Summary

**Built the first-ever retention paths for two Storage areas that grow forever today: background images (orphan+age, with a three-tier reference model and two independent fail-safes) and PPTX-import sources (positive-guard consumed/failed pruning that structurally cannot touch the rendered display artifacts) -- both dry-run by default, both proven only against mocked Storage/Firestore.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-20T01:35:00Z (approx, session start)
- **Completed:** 2026-08-20T01:46:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (`functions/src/index.ts`, `functions/src/index.test.ts`)

## Accomplishments

- `cleanupOrphanBackgroundsHandler` (new `cleanupOrphanBackgrounds` cron, 05:00 UTC): orphan+age background sweep. Enumerates all three live-reference tiers (slideGroups group field, embedded `slides[]` array entries, `songs/*/lyrics/*` field) via two `collectionGroup()` scans and a pure `extractBackgroundObjectPath()` URL parser, then deletes only an object that is BOTH unreferenced at every tier AND older than `BACKGROUND_RETENTION_DAYS` (30).
- **Two independent safety nets**, both proven by test: (1) the plan's original `referencesComplete` fail-safe -- an unparseable reference URL or a throwing scan forces the whole run to dry-run; (2) a **new floor guard**, added per this run's plan-checker hardening instruction -- a reference scan that succeeds but returns literally zero references while candidate backgrounds exist is ALSO forced to dry-run, closing the gap the original fail-safe alone doesn't cover (a scan against the wrong collection, or a permissions issue, "succeeding" with an empty result). A companion test proves the floor guard correctly does NOT misfire when there are truly zero candidates (a brand-new org with no backgrounds at all).
- `cleanupPptxSourcesHandler` (new `cleanupPptxSources` cron, 06:00 UTC): prunes `source.pptx` + extracted `images/` for a **consumed** ("ready") or **failed** `pptxRenders` import older than `PPTX_SOURCE_RETENTION_DAYS` (30), via the POSITIVE `PPTX_SOURCE_GUARD` regex that matches only those two paths -- `rendered/` is structurally unmatchable by the guard, not excluded by a runtime check. The render doc and its `rendered/` objects stay owned by `cleanupOrphanRendersHandler`, unchanged by this sweep. An image-only import (no `pptxRenders` doc at all) is out of scope by construction, since the scan is entirely render-doc-driven.
- Both sweeps mirror 66-01's `readDeleteCap()` for a shared per-run LIVE-delete cap (`STORAGE_CLEANUP_MAX_DELETES_PER_RUN`, default 500, dry-run never capped) and report `deletedBytes`/`cappedByLimit` observability fields, consistent with the existing sweeps' shape.
- `cd functions && npm test` -- 347/347 tests pass (full suite; 243/243 in `index.test.ts` alone, up from 209 pre-plan -- 34 new tests: 18 for `cleanupOrphanBackgroundsHandler` + guard/parser describes, 16 for `cleanupPptxSourcesHandler` + its guard describe). `cd functions && npm run build` is clean.
- No `firebase deploy` was run. No `functions/.env` was written or read by this plan (confirmed via `git status`/`git diff` showing no change against it).

## Background Reference Model (confirmed, for future reference)

A background is referenced at exactly one of three tiers, all stored as the **full Firebase Storage download URL string** (never the bare object path or backgroundId):

1. **Group tier** -- `organizations/{orgId}/slideGroups/{slotId}.backgroundImageUrl`.
2. **Slide tier** -- the SAME slideGroups doc's embedded `slides[]` array field, each entry's `.backgroundImageUrl` (an array field, NOT a subcollection -- enumerated via `doc.data().slides`).
3. **Song tier** -- `organizations/{orgId}/songs/{songId}/lyrics/{lyricsId}.backgroundImageUrl`.

A cron recovers the raw object path from a download URL's `/o/{ENCODED_PATH}?...` segment via `decodeURIComponent` -- this is deterministic and requires no Firestore write-side changes. Object names embed the orgId (`orgs/{orgId}/backgrounds/{backgroundId}/{fileName}`), so a single global referenced-path `Set` is safe across orgs.

## Task Commits

Each task was committed atomically, verified against the exact code state it represents (not just at the end of the plan):

1. **Task 1: cleanupOrphanBackgrounds -- orphan+age background sweep with reference fail-safe (R167)** - `bee33c42` (feat)
   - Adds `DAY_MS`, `BACKGROUND_RETENTION_DAYS`, `BACKGROUND_PATH_GUARD`, `extractBackgroundObjectPath()`, `OrphanBackgroundSummary`, `cleanupOrphanBackgroundsHandler`, `cleanupOrphanBackgrounds` cron, and all of Task 1's tests (18 new test cases + 2 guard/parser describe blocks). Verified: `npm run build` clean, `npm test -- --run src/index.test.ts` -- 227/227 pass, against an intermediate file state containing ONLY this task's additions (the pptx-source block had not yet been introduced at this commit).
2. **Task 2: cleanupPptxSources -- prune consumed/failed import sources, keep rendered/ (R168)** - `4c32364e` (feat)
   - Adds `PPTX_SOURCE_RETENTION_DAYS`, `PPTX_SOURCE_GUARD`, `sourcePrefixFor()`, `PptxSourceCleanupSummary`, `cleanupPptxSourcesHandler`, `cleanupPptxSources` cron, and all of Task 2's tests (16 new test cases + 1 guard describe block). Verified: `npm run build` clean, `npm test -- --run src/index.test.ts` -- 243/243 pass, against the full final file state.

## Files Created/Modified
- `functions/src/index.ts` -- added `cleanupOrphanBackgroundsHandler`/`cleanupOrphanBackgrounds` (R167) and `cleanupPptxSourcesHandler`/`cleanupPptxSources` (R168), plus their constants/guards/summary interfaces/helper functions, inserted directly after the existing `cleanupOrphanRenders` cron.
- `functions/src/index.test.ts` -- added `describe("BACKGROUND_PATH_GUARD")`, `describe("extractBackgroundObjectPath")`, `describe("PPTX_SOURCE_GUARD")`, `describe("cleanupOrphanBackgroundsHandler")` (18 tests), and `describe("cleanupPptxSourcesHandler")` (16 tests), inserted directly after the existing `cleanupOrphanRendersHandler` describe block; extended the top-of-file import list with the new exported symbols.

## Decisions Made
- **Floor guard added beyond the plan's original spec**, per this run's explicit plan-checker hardening instruction: the plan's `referencesComplete` fail-safe only covers a throwing scan or an unparseable URL; it does NOT cover a scan that "succeeds" but returns a silently empty reference set while background candidates exist. Added `if (referencedPaths.size === 0 && candidates.length > 0) { referencesComplete = false; }` immediately after building the candidate list from the bucket listing, before computing `effectiveDryRun`. Proven by a dedicated test, plus a companion test proving the guard correctly does NOT fire when there are zero candidates at all (an empty-backgrounds org is not an anomaly).
- `DAY_MS` (24*60*60*1000) is a new shared, non-exported local constant introduced once above both new sweeps, rather than repeating the inline `24 * 60 * 60 * 1000` literal (the existing sweeps' style) twice across two new handlers.
- `cleanupPptxSourcesHandler`'s `readDeleteCap()` enforcement uses a labeled `outer` for-loop (`break outer`) to stop the ENTIRE run -- across all remaining eligible imports, not just the current one -- once the cap is hit, matching `cleanupOrphanRendersHandler`'s established run-level (not per-doc) cap semantics from 66-01.
- Per 66-01's established precedent for a shared-helper/adjacent-code situation, Task 1's and Task 2's source edits were made in one continuous pass in the file (Task 2's handler is adjacent to and follows Task 1's), then **split into two genuinely atomic commits** by reconstructing an intermediate "Task 1 only" file state (verified green against `npm run build` + the full `index.test.ts` gate), committing it, then restoring the full final state (verified green again) and committing Task 2. This is a stronger atomicity guarantee than 66-01's own precedent (which committed Task 2's tests alone against source that already included both handlers) -- here, Task 1's commit contains ONLY Task 1's handler/tests and was proven green in that exact state, not just at the end.

## Deviations from Plan

### Auto-fixed Issues
None -- no bugs, missing critical functionality, or blocking issues were found in the plan's own instructions.

### Rule 2 addition (per orchestrator's explicit hardening instruction, not a self-discovered deviation)
**[Rule 2 - missing critical functionality] Added the floor guard described above.** The plan's `<must_haves>` already stated the fail-safe direction ("if the reference picture is incomplete... the background run deletes NOTHING") but only explicitly specified the unparseable-URL and scan-throw triggers. The orchestrator's `<critical_execution_rules>` explicitly called out a gap: a scan that returns silently EMPTY (no throw, no parse failure) was not covered, and instructed adding this exact guard plus a unit test. Implemented as specified; both the guard-fires and guard-does-not-misfire cases are covered by test. Files: `functions/src/index.ts` (both commits, `bee33c42`). Commit: `bee33c42`.

---

**Total deviations:** 0 auto-fixed bugs. 1 explicitly-instructed hardening addition (the floor guard), which the orchestrator's brief pre-specified in full including the exact test requirement -- not an executor-discovered deviation under Rules 1-4, but documented here for traceability.
**Impact on plan:** None on the plan's own success criteria -- all pass. The floor guard is a strict safety strengthening (more scenarios force dry-run, never fewer), so it cannot cause a previously-safe delete to become unsafe, and cannot cause a previously-required delete (per the plan's Task 1 behavior spec) to be skipped, because every Task-1-specified delete test includes a non-empty reference elsewhere in its mock (matching real-world usage, where most orgs have SOME referenced background) precisely so the floor guard does not spuriously trip on legitimate orphan-delete scenarios.

## Issues Encountered
None.

## User Setup Required

None -- no external service configuration is needed to ship this plan (everything is proven against mocked Storage/Firestore). The plan's `user_setup` block hands over the OWNER-GATED steps for the first LIVE deletion of BOTH new sweeps, which are NOT executed by this plan and are recorded verbatim below.

## Handover -- Owner-Gated First LIVE Deletion (do NOT run; not executed by this plan)

Both new sweeps still delete NOTHING by default (`BACKGROUND_CLEANUP_ENABLED` and `PPTX_SOURCE_CLEANUP_ENABLED` are unset in this codebase; `functions/.env` was neither written nor read). Enabling real deletion in production is the owner's gated first-deletion deploy:

1. **Backgrounds (R167):** review a dry-run's logged `orphanCount`/`deletedBytes`/`referencesComplete` in Cloud Logging FIRST -- `referencesComplete` must read `true` before enabling, otherwise the reference picture is incomplete and the sweep is (correctly) doing nothing. Then add `BACKGROUND_CLEANUP_ENABLED=true` to `functions/.env` and run:
   ```
   firebase deploy --only functions:cleanupOrphanBackgrounds
   ```
2. **PPTX sources (R168):** review a dry-run's logged `deletedObjectCount`/`deletedBytes` in Cloud Logging FIRST. Then add `PPTX_SOURCE_CLEANUP_ENABLED=true` to `functions/.env` and run:
   ```
   firebase deploy --only functions:cleanupPptxSources
   ```
3. **(Optional) tune the blast radius** of the first LIVE run of either sweep by adding `STORAGE_CLEANUP_MAX_DELETES_PER_RUN=<n>` to `functions/.env` (default 500 if unset, shared with the 66-01 sweeps). Retention windows are independently tunable via `BACKGROUND_RETENTION_DAYS` / `PPTX_SOURCE_RETENTION_DAYS` if desired (both default 30 in code -- these are NOT currently read from env, so tuning them requires a code change, matching the existing `RETENTION_DAYS`/`ORPHAN_RENDER_STALE_HOURS` pattern).

Both sweeps already log their full would-delete summary every day at their scheduled time (05:00 UTC backgrounds, 06:00 UTC pptx sources) even while OFF, so the owner can see the true backlog size and confirm `referencesComplete: true` before flipping either flag.

Separately, the two new (still dry-run-by-default) FUNCTIONS themselves are autonomous-deployable per the v1.8 grant (they delete nothing with flags off) -- the orchestrator may fold `firebase deploy --only functions:cleanupOrphanBackgrounds,functions:cleanupPptxSources` into its consolidated end-of-milestone deploy, per the plan's `<deploy>` staging note. This plan itself did NOT run any `firebase deploy`.

## Next Phase Readiness
- All four Storage retention requirements for this phase (R165, R166 from 66-01; R167, R168 from this plan) are now built and tested. No blockers for phase completion.
- `functions/src/index.ts` now has FOUR daily cleanup/reminder crons at staggered UTC slots: `cleanupExpiredMedia` (02:00), `cleanupOrphanRenders` (03:00), `sendScheduledReminders`+dispatch (04:00), `cleanupOrphanBackgrounds` (05:00, NEW), `cleanupPptxSources` (06:00, NEW) -- none overlap.

---
*Phase: 66-storage-retention*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: functions/src/index.ts
- FOUND: functions/src/index.test.ts
- FOUND: .planning/phases/66-storage-retention/66-02-new-retention-sweeps-SUMMARY.md
- FOUND commit: bee33c42
- FOUND commit: 4c32364e
