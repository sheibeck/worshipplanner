---
phase: 84-last-used-date-correctness-backfill
plan: 02
subsystem: infra
tags: [firebase-admin, firestore, vitest, backfill, cloud-functions]

requires:
  - phase: 84-last-used-date-correctness-backfill (plan 01)
    provides: "src/utils/lastUsed.ts — canonical computeLastUsedDate/serviceDateToMillis/isLockedStatus/LastUsedServiceInput derivation, mirrored here verbatim"
provides:
  - "functions/src/backfillLastUsed.ts — owner-run, single-org, dry-run-default Admin-SDK backfill for R248"
  - "functions/src/backfillLastUsed.test.ts — dry-run/apply/idempotency/conservative-write/parity coverage"
affects: []

tech-stack:
  added: []
  patterns:
    - "Pure derivation module mirrored (not imported) across the src/ <-> functions/ package boundary, byte-identical aside from wrapper comments, with each side's own tests enforcing parity (established in 84-01, applied here as the consumer)"
    - "Owner-run Admin-SDK backfill script pattern (dry-run default, --apply to write, guarded require.main === module CLI wrapper, deliberately not re-exported from functions/src/index.ts) — same shape as backfillOrgClaims.ts, now proven a second time"

key-files:
  created:
    - functions/src/backfillLastUsed.ts
    - functions/src/backfillLastUsed.test.ts
  modified: []

key-decisions:
  - "computeLastUsedDate/serviceDateToMillis/isLockedStatus/LastUsedServiceInput are copied byte-identical (verified via a scripted diff, not eyeballed) from src/utils/lastUsed.ts, including its single-quote/no-semicolon style — deliberately breaking the surrounding file's double-quote/semicolon convention so a future sync between the two copies is a pure diff, not a reformat-plus-diff"
  - "Idempotency check uses Timestamp.isEqual() (Admin SDK's own equality method) rather than a manual millis comparison, so the check exercises the real Firestore Timestamp API the fixture mocks stand in for"
  - "Org resolution (--org arg, or the sole organizations doc when exactly one exists, abort on zero/multiple) lives in a separately-exported resolveOrgIdFromArgsOrSoleOrg — not unit-tested this plan (out of the plan's explicit task scope, which covers backfillLastUsedForOrg's dry-run/apply/idempotency/parity), but structurally isolated so it could be tested independently later"
  - "A song's existing lastUsedAt is read fresh per song via songDoc.data() rather than cached, so the conservative skip-if-already-current check always compares against the doc's actual on-disk value"

requirements-completed: [R248]

coverage:
  - id: D1
    description: "Dry run (default, no flags) classifies every song and writes nothing"
    requirement: "R248"
    verification:
      - kind: unit
        ref: "functions/src/backfillLastUsed.test.ts#backfillLastUsedForOrg > dry run (apply: false): classifies every song but never calls .update()"
        status: pass
    human_judgment: false
  - id: D2
    description: "--apply writes lastUsedAt = MAX(date) of the locked services containing the song, only for songs with >=1 locked service"
    requirement: "R248"
    verification:
      - kind: unit
        ref: "functions/src/backfillLastUsed.test.ts#backfillLastUsedForOrg > apply (apply: true): writes ONLY Song A, to the MAX locked date; B/C/D untouched"
        status: pass
    human_judgment: false
  - id: D3
    description: "A song with no locked service (draft-only, or in no service at all) is skipped and never blanked — Planning-Center-imported dates preserved"
    requirement: "R248"
    verification:
      - kind: unit
        ref: "functions/src/backfillLastUsed.test.ts#backfillLastUsedForOrg > conservative write rule: a song with no locked service (draft-only, or no service) is NEVER blanked"
        status: pass
    human_judgment: false
  - id: D4
    description: "Re-running --apply against the post-write state is idempotent — writes nothing on the second run"
    requirement: "R248"
    verification:
      - kind: unit
        ref: "functions/src/backfillLastUsed.test.ts#backfillLastUsedForOrg > idempotent: re-running --apply against the post-write state writes nothing on the second run"
        status: pass
    human_judgment: false
  - id: D5
    description: "The mirrored derivation core (computeLastUsedDate/serviceDateToMillis/isLockedStatus) matches the canonical src/utils/lastUsed.ts behavior — max, tie, draft-exclusion, null/no-locked-service, and the local-midnight parse convention"
    requirement: "R248"
    verification:
      - kind: unit
        ref: "functions/src/backfillLastUsed.test.ts#mirrored derivation parity with src/utils/lastUsed.ts (84-01) (8 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The single-org, dry-run-default, --apply, idempotent Admin-SDK script compiles under the functions build and is not part of the deployable function surface"
    requirement: "R248"
    verification:
      - kind: unit
        ref: "cd functions && npm run build (tsc, clean)"
        status: pass
      - kind: other
        ref: "grep backfillLastUsed functions/src/index.ts (no match)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-26
status: complete
---

# Phase 84 Plan 02: Last-Used Date Correctness Backfill (R248) Summary

**One-time, owner-run Admin-SDK Node script (`functions/src/backfillLastUsed.ts`) that retroactively corrects `lastUsedAt` for the single production org, writing `MAX(locked service date)` only for songs that have at least one locked service and never touching any other song — mirroring `computeLastUsedDate`/`serviceDateToMillis` byte-identical from the 84-01 canonical helper so the live path and the backfill can never disagree.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-25T23:08:00-04:00 (approx, plan/context read)
- **Completed:** 2026-08-25T23:14:26-04:00
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- New `functions/src/backfillLastUsed.ts`: reads `organizations/{orgId}/services` and `organizations/{orgId}/songs` once via the Admin SDK, computes each song's `MAX(locked service date)` via the mirrored `computeLastUsedDate`, and applies the conservative write rule (write only when a locked service exists; skip and never blank every other song).
- Dry run is the default; `--apply` is required to write. Single-org scoped via `--org <id>` or the sole `organizations` doc, aborting with a clear message on zero or multiple orgs (never an all-orgs sweep).
- Idempotent: a song whose `lastUsedAt` already equals the computed `Timestamp` (via `Timestamp.isEqual`) is skipped, not rewritten.
- Guarded CLI wrapper (`require.main === module`) mirrors `backfillOrgClaims.ts`'s safety posture — importing the module for tests never calls `initializeApp()`.
- `functions/src/backfillLastUsed.test.ts`: 13 tests covering dry-run-writes-nothing, apply-writes-only-the-eligible-song, the conservative never-blank rule, cross-call idempotency (via mutated fixture records, not asserted by construction), per-song failure isolation, and an 8-case parity block mirroring `src/utils/__tests__/lastUsed.test.ts`'s own cases.
- Not re-exported from `functions/src/index.ts` — confirmed by grep; it stays out of the deployable function surface.

## Task Commits

1. **Task 1: Create the single-org last-used backfill script** - `0b7e79d3` (feat)
2. **Task 2: Unit-test the backfill (dry-run, conservative write, idempotency, parity)** - `09e5af6d` (test)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `functions/src/backfillLastUsed.ts` - New Admin-SDK backfill script (mirrored core + org resolution + core `backfillLastUsedForOrg` + guarded CLI wrapper)
- `functions/src/backfillLastUsed.test.ts` - New unit test suite (13 tests: dry-run, apply, conservative-write, idempotency, per-song failure, 8-case parity)

## Decisions Made
- The mirrored `computeLastUsedDate`/`serviceDateToMillis`/`isLockedStatus`/`LastUsedServiceInput` block was copied byte-for-byte from `src/utils/lastUsed.ts`, including its single-quote/no-semicolon style, verified with a scripted string-diff rather than eyeballed — this deliberately breaks the surrounding file's double-quote/semicolon convention so future syncs between the two copies are a clean diff.
- Idempotency uses the Admin SDK `Timestamp`'s own `isEqual()` method (not a manual millis comparison), exercised against a fixture `FakeTimestamp` class implementing `fromMillis`/`isEqual`/`toMillis` — the first functions test to construct/compare Admin SDK Timestamps.
- Org resolution (`resolveOrgIdFromArgsOrSoleOrg`) is exported separately from the CLI wrapper but was not itself unit-tested this plan — the plan's task list scoped Task 2 to `backfillLastUsedForOrg`'s dry-run/apply/idempotency/parity behavior; the resolver is structurally isolated (its own exported function) so it can be tested independently if ever needed.
- The owner-run `--apply` execution against the production Berean org is explicitly out of this plan's scope (per the plan's "Owner-run step" note and the 2026-08-25 confirm-then-deploy policy) — building and unit-testing the script is the deliverable; running it against production is a separate owner action.

## Deviations from Plan

None - plan executed exactly as written. The plan's acceptance criterion "byte-identical to src/utils/lastUsed.ts (aside from the surrounding mirrored-from comment)" was interpreted strictly (matching quote style and semicolon usage, not just logic) and verified programmatically rather than assumed — this is a stricter-than-minimum reading of the plan, not a deviation from it.

## Issues Encountered
None.

## User Setup Required
None for this plan. A separate, owner-run, owner-confirmed step remains outstanding: after building (`cd functions && npm run build`), the owner runs `node functions/lib/backfillLastUsed.js --apply` locally with Admin credentials against the production Berean org. This is explicitly NOT part of this plan's scope (see plan's "Owner-run step" note) and is NOT a `firebase deploy`.

## Next Phase Readiness
- R247 (live path, 84-01) and R248 (this backfill) are both complete; Phase 84's two requirements are fully implemented and unit-tested.
- Outstanding action for the owner: run the `--apply` backfill against the production Berean org (see "User Setup Required" above) to complete the retroactive correction described in R248's success criteria. This is a manual, owner-confirmed step outside GSD execution scope.
- No blockers for closing Phase 84.

---
*Phase: 84-last-used-date-correctness-backfill*
*Completed: 2026-08-26*

## Self-Check: PASSED

All created files present on disk (`functions/src/backfillLastUsed.ts`, `functions/src/backfillLastUsed.test.ts`); both task commit hashes (`0b7e79d3`, `09e5af6d`) found in git log; `cd functions && npm run build` compiles cleanly; `cd functions && npx vitest run src/backfillLastUsed.test.ts` passes (13/13); `cd functions && npm test` remains green (588/588); grep confirms `backfillLastUsed` is absent from `functions/src/index.ts`.
