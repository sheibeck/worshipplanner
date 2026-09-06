---
phase: 130-multi-church-volunteer-switcher
plan: 02
subsystem: ui
tags: [vue3, pinia, native-select, sidebar]

# Dependency graph
requires:
  - phase: 130-multi-church-volunteer-switcher (Plan 01)
    provides: mySchedule store's churches/selectedChurch/filteredDocs computeds and orgName-bearing docs
provides:
  - "MyScheduleView.vue church filter (gated on >1 church, R405) that scopes the rendered schedule via filteredDocs (R403)"
  - "AppSidebar.vue volunteerChurchLabel computed + v-else-if org-name slot branch (R404)"
affects: [volunteer-service-view, my-schedule]

tech-stack:
  added: []
  patterns: [native <select> filter mirroring SongFilters.vue, Pinia singleton cross-component store access]

key-files:
  created: []
  modified:
    - src/views/MyScheduleView.vue
    - src/views/__tests__/MyScheduleView.test.ts
    - src/components/AppSidebar.vue
    - src/components/__tests__/AppSidebar.test.ts

key-decisions:
  - "Sidebar volunteer label uses the literal 'Multiple churches' (owner's resolved decision) for the multi + all-selected state, not 130-UI-SPEC.md's Copywriting Contract row which lists 'All churches' — documented discrepancy resolved in the owner's favor per the plan's explicit instruction."
  - "The AppSidebar volunteer branch is a NEW sibling v-else-if div (matching 130-UI-SPEC.md's literal markup pattern), not a widened v-if on the existing admin div — keeps the admin authStore.orgName path byte-identical and untouched, satisfying the plan's 'do NOT restructure the admin branch' constraint."
  - "The filtered-empty message test exercises a directly-set stale selectedChurch (an orgId absent from all loaded docs) rather than a real UI selection, since churches (and therefore every selectable <select> option) are always derived from docs — a real click can never produce a truly-empty filteredDocs while docs is non-empty. This proves the defensive code path per 130-UI-SPEC.md's Copywriting Contract without asserting an unreachable-via-UI precondition."

requirements-completed: [R403, R404, R405]

coverage:
  - id: D1
    description: "Church filter (<select data-testid='church-filter'>) renders only when the volunteer serves >1 distinct church, gated with v-if for zero DOM footprint at 0/1 churches (R405)"
    requirement: "R405"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#church filter (R403/R404/R405, Phase 130) > renders no filter for a single-church volunteer (R405)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#church filter (R403/R404/R405, Phase 130) > renders no filter when there are zero docs (R405)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Church filter options labeled by orgName with 'Unnamed church' fallback, sorted alphabetically, default 'All churches' option (R404)"
    requirement: "R404"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#church filter (R403/R404/R405, Phase 130) > renders the filter with an \"All churches\" default plus one option per church, labeled by orgName (R403/R404)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selecting a church scopes the rendered This week/Later/Past sections to that church's services via mySchedule.filteredDocs, and never calls authStore.selectOrg (R403)"
    requirement: "R403"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#church filter (R403/R404/R405, Phase 130) > selecting a church scopes the rendered cards to that church and never calls authStore.selectOrg (R403)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#church filter (R403/R404/R405, Phase 130) > choosing \"All churches\" clears the filter and restores every card"
        status: pass
    human_judgment: false
  - id: D4
    description: "Filtered-empty message ('No upcoming services for {church}.') renders when a selected church's filtered set is empty while docs overall is non-empty"
    requirement: "R404"
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#church filter (R403/R404/R405, Phase 130) > shows a filtered-empty message when the selection matches zero of the loaded docs while docs overall is non-empty (R404)"
        status: pass
    human_judgment: false
  - id: D5
    description: "AppSidebar org-name slot shows the volunteer's current church name (single church name, 'Your church' fallback, 'Multiple churches' when multi+unselected, or the selected church's name) without disturbing the admin authStore.orgName path"
    requirement: "R404"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — volunteer church-name label (R404, Phase 130) > renders the admin org-name path unchanged, never the volunteer branch, when authStore.orgName is set"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — volunteer church-name label (R404, Phase 130) > shows the single church name for a zero-membership volunteer"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — volunteer church-name label (R404, Phase 130) > falls back to \"Your church\" when the single church has no orgName"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — volunteer church-name label (R404, Phase 130) > shows \"Multiple churches\" for a multi-church volunteer with no church selected"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — volunteer church-name label (R404, Phase 130) > shows the selected church name for a multi-church volunteer with a specific church selected"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AppSidebar.test.ts#AppSidebar — volunteer church-name label (R404, Phase 130) > renders nothing in the org-name slot for a volunteer with zero rehearseAccess docs"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-06
status: complete
---

# Phase 130 Plan 02: Volunteer UI — My Schedule Church Filter + AppSidebar Label Summary

**Native `<select>` church filter on My Schedule (gated on >1 church, driving `filteredDocs`) plus a new AppSidebar `v-else-if` branch showing the volunteer's current church name, both sourced from the Wave 1 `mySchedule` Pinia store.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-06T18:45:00Z
- **Completed:** 2026-09-06T19:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- My Schedule now shows a native church `<select>` (mirroring `SongFilters.vue`'s exact markup/classes) only when the volunteer serves at more than one church — zero DOM footprint otherwise (R405).
- Selecting a church filters the rendered This week / Later this month / Past sections via `mySchedule.filteredDocs`, with a distinct "No upcoming services for {church}." message when a selected church's filtered set is empty while other services exist.
- The filter never imports or calls `authStore.selectOrg` — asserted by a spy in the new test suite (R403).
- AppSidebar's org-name slot now shows a zero-membership volunteer's current church name (single church, "Your church" fallback, "Multiple churches" when multi + unselected, or the selected church's name) via a brand-new `v-else-if` sibling branch that leaves the admin `authStore.orgName` path completely untouched (R404).
- A best-effort `onMounted` guard in AppSidebar calls `mySchedule.loadMySchedule()` when a volunteer deep-links to a non-My-Schedule route before that view has ever mounted, so the sidebar label isn't blank on cold nav.

## Task Commits

Each task was committed atomically:

1. **Task 1: My Schedule church filter (gated, client-side)** - `0bfc2201` (feat)
2. **Task 2: Volunteer church-name label in the AppSidebar org-name slot** - `db7254d8` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/views/MyScheduleView.vue` - Church `<select>` filter, `sortedChurches`/`selectedChurchLabel`/`filteredEmpty` computeds, `onChurchChange`, `groups` now reads `mySchedule.filteredDocs`
- `src/views/__tests__/MyScheduleView.test.ts` - Extended mock store (`selectedChurch`/`churches`/`filteredDocs`), `selectOrg` spy on the auth mock, 6 new church-filter tests
- `src/components/AppSidebar.vue` - `volunteerChurchLabel` computed, new `v-else-if` org-name slot branch, `onMounted` cold-render guard, `useMyScheduleStore` import
- `src/components/__tests__/AppSidebar.test.ts` - Mocked `@/stores/mySchedule`, 6 new volunteer-label tests

## Decisions Made
- Implemented the sidebar's multi+all-selected label as the literal "Multiple churches" per the owner's settled decision (CONTEXT.md/130-RESEARCH.md/130-VALIDATION.md), diverging from 130-UI-SPEC.md's Copywriting Contract row which lists "All churches" for that state — the plan flagged this discrepancy explicitly and directed resolving in the owner's favor.
- Chose the UI-SPEC's literal markup pattern (a new sibling `v-else-if` div) over the plan action text's alternate phrasing ("widen the existing v-if"), since the sibling-div approach is the only one that satisfies the plan's own hard constraint of never restructuring/disturbing the admin `authStore.orgName` branch — verified with an explicit "admin unchanged" test.
- Added a `data-testid="volunteer-church-label"` attribute to the new sidebar div (not specified in the UI-SPEC markup) to make the "renders nothing" / "admin path only" test assertions precise and consistent with the project's existing `data-testid` conventions.

## Deviations from Plan

None — plan executed as written. The two clarifications above (Multiple-churches copy, sibling-div markup) were explicitly anticipated and resolved by the plan's own text, not undocumented deviations.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R403, R404, R405 are now fully covered by passing automated component tests.
- `npm run type-check` (vue-tsc --build) is clean.
- Full app suite: 212/213 files pass; the only failure is the pre-existing documented baseline `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation, unrelated to this plan).
- The 130-UI-SPEC.md backstop item ("partial (church context in VolunteerServiceView)") remains open per its own note — it's satisfied functionally by the sidebar label being global, not by a redundant per-view element; worth a quick manual check during batched UAT that opening a service from a filtered My Schedule doesn't show a stale sidebar church name.

---
*Phase: 130-multi-church-volunteer-switcher*
*Completed: 2026-09-06*

## Self-Check: PASSED

All created/modified files confirmed present on disk; both task commits (`0bfc2201`, `db7254d8`) confirmed in git log.
