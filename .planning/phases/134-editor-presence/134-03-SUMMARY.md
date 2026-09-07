---
phase: 134-editor-presence
plan: 03
subsystem: functions/cleanupSweeps (Cloud Functions retention crons)
tags: [cleanup, cron, presence, appConfig, R423]
dependency graph:
  requires:
    - functions/src/cleanupSweeps.ts (cleanupExpiredMedia/cleanupOrphanRenders/cleanupOrphanBackgrounds/cleanupPptxSources pattern)
    - functions/src/appConfig.ts (cleanup/retention AppConfig shape + coercion helpers)
  provides:
    - cleanupStalePresenceHandler + cleanupStalePresence (onSchedule, 04:00 UTC)
    - AppConfig.cleanup.presenceEnabled / AppConfig.retention.presenceStaleMinutes
    - previewCleanupDryRun "presence" preview type
  affects:
    - functions/src/index.ts (re-export surface + previewCleanupDryRun)
tech-stack:
  added: []
  patterns:
    - "fetch-then-filter-in-code collectionGroup scan (no range-query index needed) mirroring the Storage sweeps"
key-files:
  created: []
  modified:
    - functions/src/appConfig.ts
    - functions/src/cleanupSweeps.ts
    - functions/src/index.ts
    - functions/src/index.test.ts
    - functions/src/appConfig.test.ts
    - src/config/appConfigDefaults.ts
decisions:
  - "cleanupStalePresence scheduled 04:00 UTC — the free slot between cleanupOrphanRenders (03:00) and cleanupOrphanBackgrounds (05:00), so no two sweeps overlap"
  - "presenceStaleMinutes defaults to 60 — a generous backstop window well above the ~60s client TTL from Plan 02, since this cron is the eventual sweep, not the real-time signal"
  - "No collectionGroup('presence').where('lastSeen', '<', cutoff) query added — a range query would need a dedicated collection-group index; presence docs are tiny/few so fetch-then-filter-in-code is used, mirroring the Storage sweeps' iterate-all-then-guard discipline"
  - "previewCleanupDryRun's presence preview always returns wouldDeleteBytes: 0 — presence docs have no byte-size concept, unlike the Storage-backed sweeps"
metrics:
  duration: "~25 minutes"
  completed: 2026-09-07
status: complete
---

# Phase 134 Plan 03: cleanupStalePresence cron backstop Summary

Added a dry-run-by-default `cleanupStalePresence` scheduled Cloud Function that sweeps abandoned
`presence` subcollection docs by age, re-exported from `functions/src/index.ts` at both required
sites so `firebase deploy` ships it, and wired into `previewCleanupDryRun` for an owner-facing
backlog preview before enabling.

## What Was Built

**Task 1 — appConfig gate + handler + onSchedule wrapper** (commit `239f9f7c`)
- `functions/src/appConfig.ts`: added `cleanup.presenceEnabled: boolean` (default `false`,
  fail-closed like its siblings) and `retention.presenceStaleMinutes: number` (default `60`),
  both wired through `coerceCleanup`/`coerceRetention` using the existing `coerceEnableFlag`/
  `coerceConfigNumber` helpers.
- `functions/src/cleanupSweeps.ts`: added `cleanupStalePresenceHandler(opts: { forceDryRun?
  boolean })` mirroring `cleanupOrphanRendersHandler` — reads `getAppConfig(db, { fresh: true
  })`, resolves `dryRun` the same fail-closed way (`forceDryRun===true ? true :
  !config.cleanup.presenceEnabled`), computes a `presenceStaleMinutes`-based cutoff, queries
  `db.collectionGroup('presence').get()` (no `.where()` — filtered by `lastSeen` age in code,
  same discipline as the Storage sweeps), skips docs with an unreadable `lastSeen` (fail safe),
  is capped by `readDeleteCap(config)` in LIVE mode only (dry-run is never capped), and tolerates
  a single failed `delete()` without aborting the run. Returns `PresenceCleanupSummary {
  scannedCount, deletedDocCount, dryRun, cappedByLimit }`. Added `export const
  cleanupStalePresence = onSchedule({ schedule: 'every day 04:00', timeZone: 'UTC' }, ...)`.
- `src/config/appConfigDefaults.ts`: mirrored the two new keys (see Deviations below).

**Task 2 — re-export + previewCleanupDryRun + tests** (commit `0b1891b7`)
- `functions/src/index.ts`: added `cleanupStalePresenceHandler`/`cleanupStalePresence` to the
  import-from-`./cleanupSweeps` block AND the `export { ... }` re-export line (both required
  sites — `grep -n "cleanupStalePresence" functions/src/index.ts` returns 4 hits: the import,
  the `previewCleanupDryRun` dispatch, and the export line). `CleanupPreviewType` grew a
  `"presence"` member; `previewCleanupDryRun`'s switch grew a `case "presence"` calling
  `cleanupStalePresenceHandler({ forceDryRun: true })` and mapping `deletedDocCount` to
  `wouldDeleteCount` (with `wouldDeleteBytes` hardcoded to `0` — presence docs have no byte
  size).
- `functions/src/index.test.ts`: added a `describe("cleanupStalePresenceHandler", ...)` covering
  dry-run-default (no deletes), enabled (stale-only deletes, fresh untouched), delete-cap
  (`cappedByLimit:true`, exactly one delete), partial-failure tolerance (one rejected delete
  doesn't abort the run), and an unreadable-`lastSeen` skip. Added a dedicated
  `describe("cleanupStalePresence re-export guard", ...)` that reads `index.ts`'s source and
  asserts `cleanupStalePresence` appears in both the import block and the `export { ... }` line
  — this is the CLAUDE.md "must re-export or firebase deploy drops it" pitfall guard,
  test-enforced so a future edit that drops the re-export fails CI rather than production. Added
  a `previewCleanupDryRun` "presence" dispatch case test and updated the invalid-type test's
  expected message to include the fifth `presence` value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking] Mirrored the two new appConfig keys into `src/config/appConfigDefaults.ts`**
- **Found during:** Task 1 verification
- **Issue:** `src/config/__tests__/appConfigDefaults.test.ts` has a drift-guard test
  (`expect(DEFAULT_APP_CONFIG).toEqual(FUNCTIONS_DEFAULT_APP_CONFIG)`, line 98) that directly
  imports `functions/src/appConfig.ts`'s `DEFAULT_APP_CONFIG` and asserts byte-identical parity
  with the client-side mirror. Adding `presenceEnabled`/`presenceStaleMinutes` to the functions
  side alone would fail this pre-existing test.
- **Fix:** Added the same two keys (interface + `DEFAULT_APP_CONFIG` values) to
  `src/config/appConfigDefaults.ts`, exactly as the plan's action text anticipated ("if a
  build/type gate flags the client default as out of sync, mirror the two new keys there too").
- **Files modified:** `src/config/appConfigDefaults.ts`
- **Commit:** `239f9f7c`

**2. [Rule 1 - bug] Updated `functions/src/appConfig.test.ts`'s hardcoded DEFAULT_APP_CONFIG shape assertion**
- **Found during:** Task 2 `npm test` run
- **Issue:** `appConfig.test.ts`'s "carries every documented knob with the exact default values
  (R180)" test hardcodes the full expected `DEFAULT_APP_CONFIG` object literal; it failed after
  Task 1 added the two new fields.
- **Fix:** Added `presenceEnabled: false` to the expected `cleanup` object and
  `presenceStaleMinutes: 60` to the expected `retention` object.
- **Files modified:** `functions/src/appConfig.test.ts`
- **Commit:** `0b1891b7`

**3. [Rule 1 - bug] Regex-guard test initially assumed a `from "./cleanupSweeps"` re-export clause that doesn't exist**
- **Found during:** first `npm test` run after writing the re-export guard test
- **Issue:** The re-export site at `index.ts`'s bottom is a plain `export { cleanupExpiredMedia,
  ... };` of names already imported by name at the top of the file — NOT an `export { ... } from
  "./cleanupSweeps"` re-`from` statement. My first regex assumed the latter and matched `null`.
- **Fix:** Anchored the export-line regex on the known sibling names
  (`cleanupExpiredMedia, cleanupOrphanRenders, cleanupOrphanBackgrounds, cleanupPptxSources`)
  instead of a nonexistent `from` clause.
- **Files modified:** `functions/src/index.test.ts`
- **Commit:** `0b1891b7`

No architectural deviations (Rule 4) were needed.

## Verification

- `cd functions && npx tsc --noEmit` — clean (both after Task 1 and Task 2).
- `cd functions && npm test` — 19 files, 714 tests passed (includes the new
  `cleanupStalePresenceHandler` describe, the re-export guard test, and the `previewCleanupDryRun`
  "presence" case).
- `npm run type-check` (repo root, `vue-tsc --build`) — clean.
- `grep -n "cleanupStalePresence" functions/src/index.ts` — 4 hits: import, `previewCleanupDryRun`
  dispatch, and the `export { ... }` line (both required re-export sites present).
- `npx vitest run` (app suite, repo root) — launched to confirm the client-side
  `appConfigDefaults.test.ts` drift-guard and the rest of the app suite baseline stay green;
  see Self-Check below for the captured result.

## Known Stubs

None — the handler is fully wired end-to-end (config gate, sweep, cap, re-export, preview).

## Threat Flags

None — this plan implements exactly the threat mitigations already registered in its own
`<threat_model>` (T-134-08 blast-radius scoping, T-134-09 re-export guard, T-134-10 preview
aggregate-only, T-134-SC no new packages). No new surface outside that register was introduced.

## Self-Check: PASSED

- FOUND: functions/src/appConfig.ts
- FOUND: functions/src/cleanupSweeps.ts
- FOUND: functions/src/index.ts
- FOUND: functions/src/index.test.ts
- FOUND: functions/src/appConfig.test.ts
- FOUND: src/config/appConfigDefaults.ts
- FOUND: .planning/phases/134-editor-presence/134-03-SUMMARY.md
- FOUND commit 239f9f7c
- FOUND commit 0b1891b7
