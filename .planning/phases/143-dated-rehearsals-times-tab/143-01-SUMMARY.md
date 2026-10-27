---
phase: 143-dated-rehearsals-times-tab
plan: 01
subsystem: services-store, settings, display-regression
tags: [rehearsals, createService, settings-copy, adr, regression-tests]
requires: []
provides:
  - createService writes rehearsals [] (no seeded undated rows) and still copies reportTime
  - Settings Rehearsal & Report Defaults helper copy + data-testid rehearsal-defaults-helper
  - ADR-0245 (dated-rehearsal rule) indexed in docs/adr/README.md
  - R445 regression tests pinning R433 display on Dashboard, ServiceCard, MyScheduleView, VolunteerServiceView, ShareView
affects:
  - 143-02 and 143-03 (Times tab builds on the no-seeding rule and ADR-0245)
tech-stack:
  added: []
  patterns: [copy-not-live-bind retained for reportTime]
key-files:
  created:
    - docs/adr/0245-rehearsals-are-always-dated-defaults-prefill-the-add-form.md
    - src/views/__tests__/DashboardView.rehearsalTimes.test.ts
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.rehearsalDefaults.test.ts
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts
    - src/types/organization.ts
    - docs/adr/README.md
    - src/components/__tests__/ServiceCard.test.ts
    - src/views/__tests__/ShareView.test.ts
    - src/views/__tests__/VolunteerServiceView.test.ts
    - src/views/__tests__/MyScheduleView.test.ts
key-decisions:
  - "createService writes rehearsals: [] explicitly (not omitted) to keep isDirty stable and the empty-array test valid."
  - "No display surface, projection or util source changed; R445 is satisfied by regression tests plus a git gate."
requirements-completed: [R442, R443, R445]
status: complete
duration: ~25min
completed: 2026-10-27
---

# Phase 143 Plan 01: Stop seeding rehearsals, pin the R433 display Summary

New services now start with `rehearsals: []` while still copying the org report time; the Settings helper copy says default times pre-fill the add form; ADR-0245 records the rule; five R445 regression tests lock the existing cross-surface display.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | createService stops seeding rehearsal rows; Settings copy + org-type comment (R442) | f0b289d4 |
| 2 | ADR-0245 + README index row | 3ea02c31 |
| 3 | R445 regression tests on every read surface | ea879742 |

## Verification

- Targeted vitest (defaults, SettingsView, ServiceCard, ShareView, VolunteerServiceView, MyScheduleView, DashboardView.rehearsalTimes, ScheduleServiceCard, rehearsalProjection): all passing (49 + 81 tests).
- `npm run type-check` (vue-tsc --build): exit 0.
- R445 source gate: `git log 3539cb2a..HEAD` over the display surfaces, rehearseAccess.ts and the projection test prints nothing.
- buildServiceSnapshot gate: the only services.ts hunk is at line 474 (createService); nothing below line 450 is touched above it.
- organization.ts diff is doc-comment lines only.

## Deviations from Plan

None - plan executed as written. (Minor: `enableAutoUnmount` is imported from `@vue/test-utils`, not vitest, in the new Dashboard test.)

## Known Stubs

None.

## Manual / batched UAT items (not run)

- Visual: dashboard, Services card, My Schedule, volunteer view and share page still show "Report 8:00 AM · Rehearsals: ..." for dated rehearsals (automated tests cover the text; visual pass deferred to milestone UAT).
- Visual: Settings helper paragraph wraps acceptably on mobile.

## Threat Flags

None.

## Self-Check: PASSED

Files and commits f0b289d4, 3ea02c31, ea879742 verified present.
