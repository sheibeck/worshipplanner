---
phase: 147-default-rehearsal-day-and-time
plan: 01
subsystem: docs
tags: [spec-driven, specs, rehearsal, settings]
requires:
  - phase: 146
    provides: spec standard, docs/specs/TEMPLATE.md, specCoverage check
provides:
  - docs/specs/default-rehearsal.md (code RHD, Draft, 68 criteria)
affects: [147-02, 147-03, 147-04, 147-05]
tech-stack:
  added: []
  patterns: [spec committed alone ahead of any test or code]
key-files:
  created: [docs/specs/default-rehearsal.md]
  modified: []
key-decisions:
  - "Spec lands alone in its own commit so git history proves spec-then-tests-then-code order"
patterns-established:
  - "Criteria numbering is final; later plans cite IDs by number"
requirements-completed: []
duration: 5min
completed: 2026-11-06
status: complete
---

# Phase 147 Plan 01: Default Rehearsal Spec Summary

Spec `docs/specs/default-rehearsal.md` (code RHD, Status Draft, 68 criteria) committed alone as `1446b42e`, ahead of every test and code commit for the phase.

## Verification

- 68 criteria; suffix counts R459 8, R460 10, R461 4, R462 26, R463 4, R464 9, R465 7.
- The Phase 146 check reports `uncited=68 other=0`: no parse error, every criterion named as uncited.
- Out of scope section does not mention the old-date page.
- Commit holds exactly one file.
- Bare `npx vitest run` is red on purpose (`specCoverage.test.ts`) until Plan 05. Residual uncited count: 68.

## Deviations from Plan

None - plan executed exactly as written.

## Notes

- ADR-0249 does not exist yet; Plan 02 creates it under the filename the spec references.

## Self-Check: PASSED
