---
phase: 79-dedup-configurable-teams
plan: 01
subsystem: data-layer
tags: [pinia, firestore, vue3, typescript, teams]

# Dependency graph
requires: []
provides:
  - "Team type (src/types/team.ts) with DEFAULT_TEAMS seed constant"
  - "useTeamsStore() Pinia store — per-org teams subcollection subscribe/CRUD/seed"
  - "Church-switch teardown registration for the teams store"
affects: [79-02-teams-config-panel, 79-03-consumer-rewiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seeded per-org subcollection store (Pinia) mirroring roster.ts's roles half"

key-files:
  created:
    - src/types/team.ts
    - src/stores/teams.ts
    - src/stores/__tests__/teams.test.ts
  modified:
    - src/stores/orgScopedStores.ts

key-decisions:
  - "DEFAULT_TEAMS byte-matches today's hard-coded ['Choir','Orchestra','Communion','Special'] (order 0-3, no songFilterTag) so existing orgs see zero behavior change on first load post-deploy"
  - "teams store mirrors ONLY the roles half of roster.ts (no people-half, no isLoading, no grouping, no vocals-style migration block)"
  - "useTeamsStore().unsubscribeAll() registered in resetOrgScopedStores() in the same commit that introduces the store, preventing the church-switch stale-data-flash bug"

patterns-established:
  - "Team CRUD (addTeam/updateTeam/deleteTeam) and seedDefaultTeamsIfEmpty() follow roster.ts's addRole/updateRole/deleteRole/seedDefaultRolesIfEmpty() shape exactly — future per-org config subcollections should copy this same pattern"

requirements-completed: []  # R228/R241 are NOT fully satisfied by this plan alone — REQUIREMENTS.md
  # describes them as the full editable-list + editor UX (R228) and full consumer dedup (R241), which
  # land in 79-02/79-03. This plan builds the prerequisite data layer only; do not check off R228/R241
  # in REQUIREMENTS.md until 79-02 (editor panel) and 79-03 (consumer rewiring) both complete.

coverage:
  - id: D1
    description: "seedDefaultTeamsIfEmpty() writes exactly 4 default teams (Choir/Orchestra/Communion/Special, order 0-3, no songFilterTag) when the org has zero team docs, and writes nothing when teams already exist (idempotent, never clobbers)"
    requirement: "R228"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/teams.test.ts#seedDefaultTeamsIfEmpty (R228, RESEARCH Pitfall 4 — byte-match today's list)"
        status: pass
    human_judgment: false
  - id: D2
    description: "addTeam/updateTeam/deleteTeam perform the matching Firestore add/update/delete on organizations/{orgId}/teams"
    requirement: "R241"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/teams.test.ts#addTeam / updateTeam / deleteTeam CRUD"
        status: pass
    human_judgment: false
  - id: D3
    description: "teams store subscribes organizations/{orgId}/teams ordered by 'order' and maps snapshot docs to Team objects; unsubscribeAll tears the listener down and clears state"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/teams.test.ts#subscribe / onSnapshot"
        status: pass
    human_judgment: false
  - id: D4
    description: "useTeamsStore().unsubscribeAll() is called inside resetOrgScopedStores() so the teams listener is torn down on church switch"
    requirement: "R241"
    verification:
      - kind: other
        ref: "grep -c 'useTeamsStore' src/stores/orgScopedStores.ts (returns 2)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-23
status: complete
---

# Phase 79 Plan 01: Teams Store Foundation Summary

**Per-org `teams` Firestore subcollection + `useTeamsStore()` Pinia store, mirroring `roster.ts`'s roles half exactly, with an idempotent 4-team default seed and church-switch teardown registration**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-23T22:03:36-04:00 (approx, first commit follows immediately after)
- **Completed:** 2026-08-23T22:15:00-04:00 (approx, after full-suite confirmation)
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Created `src/types/team.ts` with `Team` interface and `DEFAULT_TEAMS` constant, byte-matching today's hard-coded `['Choir','Orchestra','Communion','Special']` team list (order 0-3, no `songFilterTag`)
- Created `src/stores/teams.ts` — `useTeamsStore()` Pinia store mirroring `roster.ts`'s roles half: `subscribe(orgId)` (ordered by `order`), `unsubscribeAll()`, `seedDefaultTeamsIfEmpty()` (guarded on `teams.value.length !== 0`, first-writer-wins), `addTeam`/`updateTeam`/`deleteTeam`
- Created `src/stores/__tests__/teams.test.ts` with 10 tests covering initial state, subscription/onSnapshot, seed idempotency (writes exactly 4 on empty, nothing when teams exist), and CRUD
- Registered `useTeamsStore().unsubscribeAll()` in `resetOrgScopedStores()` (`src/stores/orgScopedStores.ts`) so the new store is torn down on church switch, closing RESEARCH Pitfall 3 (the store didn't exist when commit `11064ac5` enumerated org-scoped stores)

## Task Commits

Each task was committed atomically:

1. **Task 1: Team type, teams store, and its unit tests** - `deeabd89` (feat)
2. **Task 2: Register teams store in the church-switch teardown** - `35111430` (feat)

**Plan metadata:** (this commit, pending)

_Note: Both tasks were straightforward feature additions per plan — no TDD RED/GREEN split beyond what's noted below._

## Files Created/Modified
- `src/types/team.ts` - `Team` interface + `DEFAULT_TEAMS` seed constant
- `src/stores/teams.ts` - `useTeamsStore()` Pinia store, per-org `teams` subcollection CRUD + idempotent seed
- `src/stores/__tests__/teams.test.ts` - 10 unit tests for the store
- `src/stores/orgScopedStores.ts` - added `useTeamsStore` import + `unsubscribeAll()` call in `resetOrgScopedStores()`

## Decisions Made
- Followed the plan's exact mirror-of-`roster.ts` shape: dropped `isLoading` and the one-time 'vocals' migration block (no equivalent needed for teams), kept the same seed-guard/CRUD/timestamp conventions
- `DEFAULT_TEAMS` seeds no `songFilterTag` on any entry, per CONTEXT.md's explicit lock ("seeding the tag is optional and left to the admin")

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. No firestore.rules change, no deploy, no env changes (client-only, per plan's key constraints).

## Next Phase Readiness
- `useTeamsStore()` is ready to be consumed by 79-02 (Teams editor panel in Settings) and 79-03 (repointing `ServiceEditorView.vue`/`NewServiceDialog.vue`'s hard-coded team lists and the Orchestra song-tag filter)
- No blockers. The store's public surface (`teams`, `subscribe`, `unsubscribeAll`, `seedDefaultTeamsIfEmpty`, `addTeam`, `updateTeam`, `deleteTeam`) matches exactly what RESEARCH's consumer-rewiring plan expects (e.g. `teamsStore.teams` as the order-sorted array consumers iterate)

## Self-Check: PASSED
- FOUND: src/types/team.ts
- FOUND: src/stores/teams.ts
- FOUND: src/stores/__tests__/teams.test.ts
- FOUND: src/stores/orgScopedStores.ts (modified, contains useTeamsStore x2)
- FOUND commit: deeabd89
- FOUND commit: 35111430

---
*Phase: 79-dedup-configurable-teams*
*Completed: 2026-08-23*
