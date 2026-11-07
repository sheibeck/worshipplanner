---
phase: 147-default-rehearsal-day-and-time
plan: 02
subsystem: services
tags: [rehearsals, utc-date-maths, adr, tdd, typescript]

requires:
  - phase: 147-default-rehearsal-day-and-time
    provides: docs/specs/default-rehearsal.md (AC-RHD criteria)
provides:
  - weekday and date helpers (UTC arithmetic) in src/utils/rehearsalTimes.ts
  - StoredRehearsal marker type and toPublicRehearsal narrowing
  - OrgSettings.rehearsalDefaultWeekday (number | null, default null)
  - both public projections narrowed to id, date, time
  - in-process timezone test helper inZone with an offset canary
  - ADR-0249 (supersedes ADR-0245 (b) and reversed parts of (a)), index row, doc guard
affects: [147-03, 147-04, 147-05]

tech-stack:
  added: []
  patterns:
    - "UTC arithmetic on YYYY-MM-DD text, never local Date construction"
    - "inZone: in-process process.env.TZ switch asserted by a getTimezoneOffset canary"

key-files:
  created:
    - src/utils/__tests__/inZone.ts
    - src/__tests__/defaultRehearsalAdr.test.ts
    - docs/adr/0249-new-services-start-with-a-default-rehearsal.md
  modified:
    - src/utils/rehearsalTimes.ts
    - src/types/organization.ts
    - src/types/service.ts
    - src/stores/services.ts
    - src/utils/rehearseAccess.ts
    - src/utils/__tests__/rehearsalTimes.test.ts
    - src/stores/__tests__/auth.test.ts
    - src/stores/__tests__/services.rehearsalProjection.test.ts
    - docs/adr/0245-rehearsals-are-always-dated-defaults-prefill-the-add-form.md
    - docs/adr/README.md

key-decisions:
  - "inZone is async so the zone is restored only after an awaited store call finishes"
  - "ADR-0249 lands in Plan 02 so every later pointer comment resolves to a real file"
  - "moveAutoRehearsals drops only a marked row that clashes with an unmarked row or an earlier marked row"

requirements-completed: []
requirements-note: "R459, R460, R462, R465 are in the plan frontmatter but deliberately left open; the orchestrator closes them after phase verification."

duration: 8min
completed: 2026-11-06
status: complete
---

# Phase 147 Plan 02: Rehearsal primitives Summary

**UTC-safe weekday and date helpers, an `autoAdded` row marker, a `rehearsalDefaultWeekday` org setting, both public projections narrowed to exactly id/date/time, and ADR-0249.**

## Commits

| Step | Hash | Subject |
| ---- | ---- | ------- |
| Task 1 RED | `fc111d48` | test(147-02): add failing tests for rehearsal date helpers and public rows |
| Task 2 GREEN | `d2d428c9` | feat(147-02): add rehearsal date helpers, the weekday setting and public rows |
| Task 3 RED (guard) | `30064aff` | test(147-02): add ADR-0249 guard |
| Task 3 GREEN | `9412ba01` | docs(147-02): add ADR-0249 superseding parts of ADR-0245 |

## What passed at RED

At `fc111d48` every new test failed except two AC-RHD-06 tests (a saved 3, and a saved 0). That is as the plan flagged: `applyOrgSnapshot` spreads stored settings over the defaults, so a stored value already survives, and those tests are regression guards. AC-RHD-07 (no saved day reads as null) did fail at RED. The new helper tests, AC-RHD-12 to 16, 27, 31, 33, 34 and AC-RHD-49 and 50 all failed. The existing tests in the three files kept passing. The ADR guard failed at its own RED commit.

## Residual check

- After RED: `uncited=55 other=0` (matches the plan).
- After the guard and ADR: `uncited=54 other=0` (matches the plan).

## Verification

- Scoped run (rehearsalTimes, auth, rehearsalProjection, services, rehearseAccess): 5 files, 327 tests, all pass.
- `defaultRehearsalAdr.test.ts` and `brandName.test.ts`: 24 tests pass.
- `npm run type-check` exits 0 after the GREEN commit.
- `git ls-files --eol` shows no `w/mixed` on any touched file; GREEN diff has no whole-file churn (102 insertions, 6 deletions across five files).
- The `inZone` canary proved the zone really switched in this environment for Pacific/Pago_Pago (660), UTC (0) and Pacific/Kiritimati (-840), so AC-RHD-15 is a real proof.

## Deviations from Plan

None - plan executed as written. Notes:

- The plan's text and the spec agree on every ID this plan cites; no spec change was needed.
- `utcMsToYmd` returns null outside years 0-9999, so stepping back from year 0000 cannot produce a malformed date. This is a small guard beyond the plan's wording.
- `moveAutoRehearsals` only considers a clash for rows whose own date is a real date, which keeps "a row whose date is not real stays as it is".

## Known Stubs

None.

## Threat Flags

None. T-147-02 is mitigated here (both projections call `toPublicRehearsal`, AC-RHD-49 and 50); T-147-03 is mitigated by `normalizeWeekday` and the real-date check (AC-RHD-16). Plan 03 still has to prove the written Firestore documents.

## Notes for later plans

- Source files still carry `See ADR-0245` pointers on `createService` and `rehearsalTimeDefaults` sites that now belong to ADR-0249; ADR-0245's Source comments list no longer names them. Plans 03-05 re-point them as they edit those files.
- The bare `npx vitest run` is red by design until Plan 05 (`specCoverage.test.ts`).

## Self-Check: PASSED

- FOUND: src/utils/__tests__/inZone.ts, src/__tests__/defaultRehearsalAdr.test.ts, docs/adr/0249-new-services-start-with-a-default-rehearsal.md
- FOUND commits: fc111d48, d2d428c9, 30064aff, 9412ba01
