---
phase: 135-dashboard-overhaul
plan: 01
subsystem: ui
tags: [vue, dashboard, readiness, tailwind]

requires:
  - phase: 126-my-schedule
    provides: readinessOf() media-readiness computation in myScheduleGrouping.ts (the single source of truth this plan reuses)
provides:
  - dashboardReadiness.ts pure worst-of readiness rollup util (serviceReadinessSongs + dashboardReadinessOf)
  - DashboardView.vue restructured to a single-column "needs your attention" feed with a readiness signal per service
  - R419 all-caught-up empty state
affects: [135-02-dashboard-overhaul, 135-03-dashboard-overhaul]

tech-stack:
  added: []
  patterns:
    - "Dashboard-only derived state composes existing pure functions (serviceSongStats + readinessOf) rather than inventing a new media-readiness rule — REUSE over reinvent."

key-files:
  created:
    - src/utils/dashboardReadiness.ts
    - src/utils/__tests__/dashboardReadiness.test.ts
  modified:
    - src/views/DashboardView.vue

key-decisions:
  - "dashboardReadinessOf gates both songs-needed and media-missing checks on total > 0 so a zero-SONG-slot service never misreads readinessOf([])'s waiting default as media-missing."
  - "media-missing copy reproduces readinessOf's partial-vs-waiting split by comparing missingMediaCount against the readiness song count in the view layer, rather than exposing a 4th state from the util."
  - "The old per-row 'No upcoming services' dashed empty state inside the feed section was removed as dead code once the outer R419 branch made it unreachable (nextService is only null when upcomingServices.length === 0)."

patterns-established:
  - "dashboardReadinessOf/serviceReadinessSongs: pure, store-free rollup helpers colocated in src/utils/, following the myScheduleGrouping.ts convention of pure derivation functions with an injectable now/inputs for testability."

requirements-completed: [R414, R415, R416, R419]

coverage:
  - id: D1
    description: "'Volunteer coverage' section (Active volunteers + under-staffed roles) fully removed, including dead understaffedRoles computed/MIN_VOLUNTEERS_PER_ROLE constant."
    requirement: "R414"
    verification:
      - kind: other
        ref: "grep DashboardView.vue for 'Volunteer coverage'/understaffedRoles/MIN_VOLUNTEERS_PER_ROLE — zero matches"
        status: pass
    human_judgment: false
  - id: D2
    description: "Upcoming-services feed (hero + list) renders full width, soonest first, no longer sharing the 2-col grid."
    requirement: "R415"
    verification:
      - kind: other
        ref: "grep DashboardView.vue confirms grid-cols-2 wrapper replaced with space-y-6 single column"
        status: pass
    human_judgment: true
    rationale: "Visual full-width layout and responsive behavior need a human to view the rendered page; deferred per autonomous UAT-deferred mode."
  - id: D3
    description: "dashboardReadinessOf worst-of rollup (songs-needed -> media-missing -> draft -> ready), including the zero-slots guard, reusing readinessOf verbatim."
    requirement: "R416"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/dashboardReadiness.test.ts — 10/10 tests pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "Readiness signal wired into hero pill and list rows with color+text label and a visible keyboard focus ring."
    requirement: "R416"
    verification:
      - kind: other
        ref: "node -e grep check for dashboardReadinessOf + focus:ring-indigo-500 in DashboardView.vue"
        status: pass
    human_judgment: true
    rationale: "Visual color/label pairing and keyboard-focus-ring appearance need a human to view the rendered page; deferred per autonomous UAT-deferred mode."
  - id: D5
    description: "'You're all caught up' empty state renders in place of the feed when upcomingServices.length === 0; Song library still renders."
    requirement: "R419"
    verification:
      - kind: other
        ref: "node -e grep check for \"You're all caught up\" string present in DashboardView.vue"
        status: pass
    human_judgment: true
    rationale: "Whether the empty state actually appears only with zero upcoming services (vs. the feed otherwise) is a rendered-page behavior; deferred per autonomous UAT-deferred mode."

duration: 25min
completed: 2026-09-07
status: complete
---

# Phase 135 Plan 01: Dashboard Feed Restructure & Readiness Rollup Summary

**Removed the undefined "Volunteer coverage" metric, made the upcoming-services feed the full-width spine of the dashboard, and added a single worst-of readiness signal (songs-needed → media-missing → draft → ready) computed via a new `dashboardReadinessOf` util that reuses `readinessOf` verbatim.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-07T17:20:00Z (approx)
- **Completed:** 2026-09-07T17:45:00Z (approx)
- **Tasks:** 3 completed
- **Files modified:** 3 (1 created util, 1 created test, 1 modified view)

## Accomplishments
- New pure `src/utils/dashboardReadiness.ts` with `serviceReadinessSongs` (dedupes filled SONG slots into `RehearseSong[]`, stubbing deleted songs) and `dashboardReadinessOf` (worst-of rollup gated on `total > 0` to guard the zero-slots edge case), built TDD (RED test commit, then GREEN implementation commit).
- `DashboardView.vue`'s "Volunteer coverage" section deleted along with its dead `understaffedRoles`/`MIN_VOLUNTEERS_PER_ROLE` code (R414); the 2-column grid replaced with a `space-y-6` single-column flow so the feed and Song library render full width (R415).
- `upcomingServices.length === 0` now renders a dedicated "You're all caught up" card (reusing GettingStarted's checkmark path) in place of the feed; Song library still renders unconditionally (R419).
- Hero card's songs-assigned pill and each `upcomingAfterNext` row's bare dot replaced with the combined `dashboardReadinessOf` signal — color + always-visible text label, plus a visible keyboard focus ring on both the hero and list-row links (R416).

## Task Commits

Each task was committed atomically (TDD split into RED/GREEN for Task 1):

1. **Task 1 (RED): failing test for dashboard readiness rollup** - `d16c2b19` (test)
2. **Task 1 (GREEN): implement dashboard readiness worst-of rollup** - `ded15853` (feat)
3. **Task 2: remove Volunteer coverage + restructure feed to full width + R419 empty state** - `638a832f` (feat)
4. **Task 3: wire the R416 readiness signal into hero card + feed rows** - `d93b8ca2` (feat)

**Plan metadata:** (pending — final docs commit below)

## Files Created/Modified
- `src/utils/dashboardReadiness.ts` - Pure `serviceReadinessSongs` + `dashboardReadinessOf`; imports `readinessOf` from `myScheduleGrouping.ts`, never redefines media detection.
- `src/utils/__tests__/dashboardReadiness.test.ts` - 10 unit tests covering the worst-of order and the zero-slots guard.
- `src/views/DashboardView.vue` - Volunteer coverage section removed; single-column full-width feed + Song library; R419 all-caught-up card; readiness signal + focus rings wired into the hero and list rows.

## Decisions Made
- Gated both `songs-needed` and `media-missing` checks on `total > 0` inside `dashboardReadinessOf` (rather than only in the view) so the zero-slots guard is enforced at the source, not re-derived at every call site.
- Kept the media-missing partial-vs-waiting copy split (`"{N} song(s) missing media"` vs `"Songs missing media"`) in the view layer by comparing `missingMediaCount` to the readiness song count, rather than adding a 5th state to `DashboardReadinessState` — matches the plan's explicit instruction to reproduce, not duplicate, `readinessOf`'s own state semantics.
- Removed the pre-existing per-row "No upcoming services. Create one..." dashed card inside the feed `<section>`, since it became unreachable dead code once the section itself is only rendered in the `v-else` branch of the new `upcomingServices.length === 0` check (R419's card fully supersedes it).

## Deviations from Plan

None - plan executed exactly as written. `rosterStore` import and its `orgId`-watch subscription were retained per the plan's explicit instruction (needed by Plan 02 for R417).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Deferred UAT

Per the autonomous/UAT-deferred execution mode for this plan, the following human-visual checks were NOT performed and are deferred (treated as code-complete, not re-queued to v2.14-DEFERRED-VERIFICATION.md per this plan's explicit instruction):

- Task 2 human-check: loading `/` with and without upcoming services — confirming no Volunteer coverage panel, full-width feed, and the all-caught-up card appearing only at zero upcoming services.
- Task 3 human-check: confirming each feed service's readiness signal shows a visible text label (not a bare dot), a zero-song-slot service never shows media-missing, and keyboard-tabbing the feed rows shows a visible focus ring.

All automated checks (grep assertions, `npm run type-check`, `npx vitest run src/utils/__tests__/dashboardReadiness.test.ts`) passed for both tasks.

## Next Phase Readiness
- `src/views/DashboardView.vue` is left in a clean single-column structure (empty-state branch / feed section / Song library section) ready for Plan 02 (R417 unconfirmed-volunteers widget) and Plan 03 (R418 editor-presence roll-up) to add an "attention cards row" between the feed and Song library, per 135-UI-SPEC.md's layout contract.
- `rosterStore` subscription is already live in the `orgId` watch for Plan 02 to consume `rosterStore.people`/roster data without adding a new subscription.
- No blockers.

---
*Phase: 135-dashboard-overhaul*
*Completed: 2026-09-07*

## Self-Check: PASSED

All created files verified present on disk (`src/utils/dashboardReadiness.ts`, `src/utils/__tests__/dashboardReadiness.test.ts`, `src/views/DashboardView.vue`, this SUMMARY). All 4 task commits (`d16c2b19`, `ded15853`, `638a832f`, `d93b8ca2`) verified present in git log.
