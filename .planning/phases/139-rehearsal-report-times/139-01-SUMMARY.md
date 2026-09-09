---
phase: 139-rehearsal-report-times
plan: 01
subsystem: services
tags: [pinia, firestore, vue3, typescript, rehearsal-times, projection-builders]

# Dependency graph
requires:
  - phase: 138-church-picker-email
    provides: prior service/org-settings shape this phase adds fields onto
provides:
  - "src/utils/rehearsalTimes.ts: Rehearsal interface, sortRehearsals(), formatWallClockTime()"
  - "Service.rehearsals?/reportTime? (plain date/time strings, no migration)"
  - "OrgSettings.rehearsalTimeDefaults/reportTimeDefault + DEFAULT_ORG_SETTINGS seeds"
  - "createService copy-not-live-bind pre-fill of rehearsals/reportTime from org defaults"
  - "ServiceSnapshot.rehearsals?/reportTime? (buildServiceSnapshot, services.ts)"
  - "RehearseAccessDoc.rehearsals?/reportTime? (buildRehearseAccess, rehearseAccess.ts)"
affects: [139-02, service-editor-times-ui, settings-rehearsal-defaults, dashboard, my-schedule, share-view, volunteer-service-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy-not-live-bind org-default pre-fill (mirrors defaultServiceTemplate at createService time)"
    - "Dual hand-maintained projection builders edited atomically, verified by one shared test"
    - "Pure store-free time/sort utility importable from both a Pinia store and a pure utils module"

key-files:
  created:
    - src/utils/rehearsalTimes.ts
    - src/utils/__tests__/rehearsalTimes.test.ts
    - src/stores/__tests__/services.rehearsalDefaults.test.ts
    - src/stores/__tests__/services.rehearsalProjection.test.ts
  modified:
    - src/types/service.ts
    - src/types/organization.ts
    - src/stores/services.ts
    - src/utils/rehearseAccess.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "rehearsals/reportTime stored as plain 'YYYY-MM-DD'/'HH:mm' strings, never Timestamp/Date — mirrors Service.date's existing convention, avoids timezone rebinding"
  - "Undated rehearsals (date === '') are filtered from both public projections but remain visible in the raw Service doc for the editor"
  - "No deep-merge branch added to applyOrgSnapshot for the two new OrgSettings fields — confirmed flat, already covered by the existing shallow spread"

requirements-completed: [R429, R430, R431, R432, R433]

coverage:
  - id: D1
    description: "Shared rehearsalTimes util: chronological sortRehearsals (undated last, no mutation) + timezone-stable formatWallClockTime 12-hour formatter"
    requirement: "R430"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/rehearsalTimes.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Service.rehearsals?/reportTime? and OrgSettings.rehearsalTimeDefaults/reportTimeDefault (+ DEFAULT_ORG_SETTINGS) added, type-check clean"
    requirement: "R429"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D3
    description: "createService copies org defaults into rehearsals[]/reportTime once at creation (addDoc payload + parallel created object); a later org-default edit never mutates an already-created service; a service created after a defaults change picks up the new defaults"
    requirement: "R432"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.rehearsalDefaults.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildServiceSnapshot and buildRehearseAccess both carry rehearsals/reportTime, filter undated rows, sort chronologically, and omit empties"
    requirement: "R433"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.rehearsalProjection.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 21min
completed: 2026-09-09
status: complete
---

# Phase 139 Plan 01: Rehearsal & Report Times — Data Foundation Summary

**Additive Service/OrgSettings schema, one shared timezone-stable sort/format util, copy-not-live-bind org-default pre-fill, and both public projection builders threaded together for R429-R433's rehearsal/report-time feature.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-09T15:49:10-04:00
- **Completed:** 2026-09-09T16:10:07-04:00
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified as new; 1 pre-existing test file additionally touched — see Deviations)

## Accomplishments
- `src/utils/rehearsalTimes.ts` — pure, store-free `Rehearsal` interface, `sortRehearsals` (chronological, undated-last, non-mutating), `formatWallClockTime` (12-hour, timezone-stable via throwaway local-Date construction)
- `Service.rehearsals?`/`Service.reportTime?` and `OrgSettings.rehearsalTimeDefaults`/`reportTimeDefault` (+ `DEFAULT_ORG_SETTINGS` seeds) — additive, no-migration
- `createService` copies org defaults into a new service's own `rehearsals[]`/`reportTime` at creation time (both the `addDoc` payload and the parallel `created: Service` object used for `ensureShareLink`), proven never to retroactively mutate an already-created service
- Both `buildServiceSnapshot` (services.ts) and `buildRehearseAccess` (rehearseAccess.ts) carry the new fields, filtering undated rows and sorting via the shared util — edited atomically and verified by one dual-builder test

## Task Commits

1. **Task 1: Shared rehearsal-times util (sortRehearsals + formatWallClockTime) with unit test** - `37f0e391` (feat)
2. **Task 2: Additive types + createService copy-not-live-bind pre-fill, with copy test** - `16151051` (feat)
3. **Task 3: Thread both public projections atomically with dual-builder projection test** - `ffb2841f` (feat)

_No TDD RED/GREEN split commits — tests were authored alongside implementation per task, matching this plan's `tdd="true"` intent of behavior-first verification rather than a strict separate-commit RED/GREEN cycle._

## Files Created/Modified
- `src/utils/rehearsalTimes.ts` - New shared util: `Rehearsal`, `sortRehearsals`, `formatWallClockTime`
- `src/utils/__tests__/rehearsalTimes.test.ts` - Unit tests incl. timezone-stability across UTC/+14/-12
- `src/types/service.ts` - `Service.rehearsals?`/`reportTime?` additive fields
- `src/types/organization.ts` - `OrgSettings.rehearsalTimeDefaults`/`reportTimeDefault` + `DEFAULT_ORG_SETTINGS` seeds
- `src/stores/services.ts` - `createService` copy-not-live-bind synthesis; `ServiceSnapshot`/`buildServiceSnapshot` carry the new fields
- `src/utils/rehearseAccess.ts` - `RehearseAccessDoc`/`buildRehearseAccess` carry the new fields
- `src/stores/__tests__/services.rehearsalDefaults.test.ts` - Copy, copy-not-bind, fresh-copy-inverse, empty-defaults tests
- `src/stores/__tests__/services.rehearsalProjection.test.ts` - Dual-builder projection tests (value surfaces, undated filter, sort order, omission)
- `src/stores/__tests__/services.test.ts` - Deviation fix: `mockAuthState.settings` extended with the two new fields (see below)

## Decisions Made
- Plain `'YYYY-MM-DD'`/`'HH:mm'` strings for all new time/date fields — never `Timestamp`/`Date` — matching `Service.date`'s existing convention and CLAUDE.md's no-date-library rule.
- Undated rehearsals (`date === ''`, the org-default-seeded, not-yet-dated state) are filtered from both public projections but remain visible in the raw `Service` doc for the editor (per CONTEXT.md's stated "reasonable default").
- Confirmed (per RESEARCH.md) that `rehearsalTimeDefaults`/`reportTimeDefault` are flat fields needing no deep-merge branch in `applyOrgSnapshot` — the existing shallow `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings }` spread already covers them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended `services.test.ts`'s `mockAuthState.settings` with the two new fields**
- **Found during:** Task 2 (createService copy-not-live-bind pre-fill)
- **Issue:** `createService` now unconditionally reads `authStore.settings.rehearsalTimeDefaults.map(...)`. The pre-existing `src/stores/__tests__/services.test.ts` mocks `useAuthStore` with a `mockAuthState.settings` object that lacked `rehearsalTimeDefaults`/`reportTimeDefault` — every existing `createService` test would have thrown `Cannot read properties of undefined (reading 'map')`.
- **Fix:** Added `rehearsalTimeDefaults: string[]` / `reportTimeDefault: string` to `mockAuthState.settings`'s type and default value (both empty/unset), and reset them in `beforeEach` alongside the other settings fields.
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Verification:** All 126 pre-existing tests in that file still pass.
- **Committed in:** `16151051` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug-preventing-regression)
**Impact on plan:** Necessary to keep the existing 126-test baseline green after `createService`'s behavior change; no scope creep — this file was already implicitly in `createService`'s test surface even though not listed in `files_modified`.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Zero Firestore rules changes needed (verified in RESEARCH.md: the `services/{docId}` draft-status update rule has no field allowlist, and `organizations/{orgId}.settings` writes are unrestricted for an editor).

## Next Phase Readiness
- All types, the shared time util, org defaults, copy-at-create pre-fill, and both public projections are in place — Plan 139-02 (editor "Times" UI, Settings "Rehearsal & Report Defaults" section, and the 6 display sites: dashboard, ServiceCard, ScheduleServiceCard × 3 call sites, ShareView, VolunteerServiceView) can now render fields the types actually have.
- Full app suite green except the documented `storage.rules.test.ts` baseline (34 tests, Storage-emulator dependent per CLAUDE.md — not a regression); `npm run type-check` (vue-tsc --build) clean.
- No known stubs. No new threat-surface flags — RESEARCH.md's threat model (all `accept` disposition, zero rules changes) was verified to hold exactly as designed.

---
*Phase: 139-rehearsal-report-times*
*Completed: 2026-09-09*

## Self-Check: PASSED

All 8 created/modified files verified present on disk; all 3 task commit hashes (`37f0e391`, `16151051`, `ffb2841f`) verified present in git log.
