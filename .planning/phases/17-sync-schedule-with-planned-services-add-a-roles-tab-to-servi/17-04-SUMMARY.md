---
phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi
plan: 04
subsystem: ui
tags: [vue, pinia, tabs, rbac, service-editor, role-assignment, editor-gating]
requires:
  - phase: 17-01
    provides: "resolveServiceRoleAssignments/findQuarterForDate resolver + Service.roleAssignmentOverrides field"
  - phase: 17-03
    provides: "useServiceStore.setRoleOverride/clearRoleOverride scoped dot-path writes"
provides:
  - "ServiceEditorView Music/Roles tab bar (defaults to Music, preserves all existing behavior)"
  - "Roles tab body: schedule-seeded role list, per-role override/clear control, empty state"
  - "Editor-gated rosterStore/quartersStore subscription in ServiceEditorView (viewer never reads editor-only collections)"
affects:
  - "17-05 (public ShareView Who's-Serving already consumes the same resolver/snapshot; no coupling to this view)"
tech-stack:
  added: []
  patterns:
    - "Inline activeTab ref + button-class tab bar copied from QuarterView.vue (no tabs component/library — D-03)"
    - "authStore.isEditor gates the DATA SUBSCRIPTION (not just UI) for a route lacking a requiresEditor guard (Pitfall 4 / T-17-04-01)"
    - "Roles tab consumes the pure resolver + scoped store actions — the Quarter/schedule is never mutated from this view"
key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
key-decisions:
  - "Roles tab is editor-only in-app: the Roles tab BUTTON is hidden for viewers and rosterStore/quartersStore are subscribed only when authStore.isEditor — Phase 16.2 removal decision left intact; viewer visibility ships exclusively via the 17-05 public share link"
  - "Override control is a per-role checkbox picker filtered by person.roles.includes(roleId) (reuses QuarterGrid.vue's hasRole eligibility — no hand-rolled eligibility, D-03)"
  - "Toggling any checkbox writes the full effective set via setRoleOverride; 'Reset to schedule' calls clearRoleOverride — both scoped dot-path writes from 17-03"
patterns-established:
  - "Tab bar on ServiceEditorView.vue for the first time (previously a single-scroll page), mirroring QuarterView.vue markup verbatim"
  - "Editor-gated store subscription pattern for a member-readable route that must not touch editor-only collections"
requirements-completed: [CR-01, CR-02, CR-03, CR-05]
coverage:
  - id: D1
    description: "ServiceEditorView shows a Music/Roles tab bar defaulting to Music, preserving existing behavior"
    requirement: CR-01
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#editor: Roles tab lists seeded role assignments resolved from the quarterly schedule"
        status: pass
      - kind: manual_procedural
        ref: "17-04 human-verify checkpoint step 1 (approved 2026-07-22)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Roles tab lists each role with its effective assigned person name(s) seeded from the quarterly schedule for the service date"
    requirement: CR-02
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#editor: Roles tab lists seeded role assignments resolved from the quarterly schedule"
        status: pass
      - kind: manual_procedural
        ref: "17-04 human-verify checkpoint step 1 (approved 2026-07-22)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Editor can override a role's people (filtered to those holding the role) and reset back to the schedule via the store's scoped dot-path actions, without mutating the schedule"
    requirement: CR-03
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#editor: override control (checkbox picker) appears, filtered by role eligibility"
        status: pass
      - kind: manual_procedural
        ref: "17-04 human-verify checkpoint steps 2-3 — override + reset, schedule NOT mutated (approved 2026-07-22)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Roles tab renders a clear empty/informational state when no quarter covers the service date"
    requirement: CR-02
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#editor: empty state renders when no quarter covers the service date"
        status: pass
      - kind: manual_procedural
        ref: "17-04 human-verify checkpoint step 4 (approved 2026-07-22)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Roles tab is editor-only: non-editors trigger no read of roles/quarters/people and the tab is not exposed in-app"
    requirement: CR-05
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#non-editor: Roles tab button is hidden and no roster/quarters data is read"
        status: pass
      - kind: manual_procedural
        ref: "17-04 human-verify checkpoint step 5 — viewer gating, no permission-denied errors (approved 2026-07-22)"
        status: pass
    human_judgment: false
duration: ~40min
completed: 2026-07-22
status: complete
---

# Phase 17 Plan 04: Service editor Roles tab Summary

**Added a first-ever Music/Roles tab bar to ServiceEditorView with an editor-only Roles tab that seeds each role's people from the quarterly schedule for the service date, lets editors override/clear per role via scoped store writes (schedule never mutated), and shows an empty state when no quarter covers the date — with roster/quarters data subscribed only for editors so a viewer on the guard-less /services/:id route never reads editor-only collections.**

## Performance

- **Duration:** ~40 min (active; excludes the human-verify checkpoint round-trip)
- **Completed:** 2026-07-22
- **Tasks:** 2 auto tasks + 1 human-verify checkpoint (approved)
- **Files modified:** 2

## Accomplishments

- **Task 1 — Music/Roles tab bar + editor-gated data.** Added `const activeTab = ref<'music' | 'roles'>('music')` (defaults to Music, so every existing user/screenshot/test still lands on the music flow). Copied QuarterView.vue's inline tab-bar markup verbatim (same Tailwind classes) — no tabs component/library (D-03). Wrapped the entire existing Teams/Sermon/Slots content in `v-show="activeTab === 'music'"` and added a `v-show="activeTab === 'roles'"` container. Gated `rosterStore`/`quartersStore` subscription in `initStores()` behind `authStore.isEditor` and hid the Roles tab button for viewers, so a non-editor landing on `/services/:id` (which has no `requiresEditor` guard) never triggers a first-time read of the editor-only `roles`/`quarters`/`people` collections (Pitfall 4, T-17-04-01, CR-05, Phase 16.2 removal decision).
- **Task 2 — Roles tab body.** Renders a computed `resolveServiceRoleAssignments(localService, quartersStore.quarters, rosterStore.roles)` list: each role shows its effective assigned person name(s) (mapped via `rosterStore.people`) plus an "Overridden" marker when `overriddenPersonIds !== null`, and a "Reset to schedule" action. The per-role override control is a checkbox picker populated from `rosterStore.activePeople` filtered by `person.roles.includes(roleId)` (reuses QuarterGrid.vue's `hasRole` eligibility). Toggling writes the full effective set via `servicesStore.setRoleOverride`; reset calls `servicesStore.clearRoleOverride` (both 17-03 scoped dot-path writes — the Quarter/schedule is never touched). When `findQuarterForDate` finds no covering quarter, an explicit "No schedule found for this date — assign roles manually" state renders instead of a blank/error.
- **Human-verify checkpoint approved** (2026-07-22): seeded lists render for scheduled people; per-role override + reset work; source schedule NOT mutated; empty/no-quarter state renders cleanly; viewer gating hides the Roles tab with no permission-denied errors.

## Task Commits

1. **Task 1 + Task 2: Music/Roles tab bar + editor-gated Roles tab body** — `6c47a7b` (feat)
2. **Test-timeout fix (deviation Rule 1):** warm SFC transform to fix first-mount timeout — `325cdc2` (test)

_Tasks 1 and 2 both modify the same SFC and were committed together in `6c47a7b` (the tab bar wrapper and the Roles body are one coherent edit; splitting them would have left an intermediate commit with an empty Roles container)._

## Files Created/Modified

- `src/views/ServiceEditorView.vue` — Added `activeTab` ref + Music/Roles tab bar; wrapped existing content in the Music container; added the Roles tab body (seeded list, per-role checkbox override picker, "Reset to schedule", empty state); added `useRosterStore`/`useQuartersStore` and gated their subscription behind `authStore.isEditor` in `initStores()`; added `resolvedRoleAssignments`/`hasQuarterForServiceDate` computeds and `effectiveNames`/`eligiblePeople`/`onToggleOverridePerson`/`onResetRoleOverride` handlers.
- `src/views/__tests__/ServiceEditorView.test.ts` — Added `rosterStore`/`quartersStore` mocks and mutable `mockIsEditor`/`mockOrgId` per-test state; 4 new cases (seeded list, override-picker eligibility + write, non-editor tab hidden, no-quarter empty state); a top-level `beforeAll` warmup that fixes a first-mount timeout (see Deviations).

## Decisions Made

- **Editor-only in-app Roles tab** (locked pre-plan): the tab button is hidden for viewers AND the roster/quarters subscription is editor-gated — not just UI hiding. Viewer visibility ships only via the 17-05 public share link; the Phase 16.2 decision to not expand viewer read access is left intact.
- **Tasks 1 + 2 committed together** in `6c47a7b` rather than as two commits, since the Music-wrapper and the Roles-body are a single coherent SFC edit (an intermediate commit would have shipped an empty Roles container).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] First-mount test timeout caused by the larger SFC**
- **Found during:** Task 2 wave gate (`npm run test:unit`), surfaced once `.env.local` let the full view-test suite run together.
- **Issue:** 17-04 grew `ServiceEditorView.vue` (Roles tab template + `useRosterStore`/`useQuartersStore` imports). The *first* cold SFC transform + template compile of this 2200+ line component now exceeds vitest's default 5s per-test `testTimeout` on a loaded machine, flaking whichever test mounts first (the pre-existing Print/Copy-for-PC tests).
- **Fix:** Warm the transform once in a top-level `beforeAll(…, 30000)` in the test file, so each individual test's timer measures only a warm mount. Per-test time dropped from ~5000ms (timeout) to ~350ms.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` → 7/7 pass; passes alongside `RosterView.test.ts` (no cross-file flake).
- **Committed in:** `325cdc2`

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug directly caused by this plan's own change).
**Impact on plan:** Minimal — a test-infrastructure fix within this plan's own test file; no product-code change beyond the two planned tasks, no scope creep.

## Issues Encountered

- **Pre-existing, out-of-scope test failure (NOT fixed):** `RosterView.test.ts > R-11 > "wraps Roles config in CollapsibleSection"` fails (`expect(text).toContain('Roles config')`). Root cause pre-dates this phase — quick-task `260713-wm9`/`df1ca34` renamed/refactored RosterView's "Roles config" section into a "Roles" tab. That file previously failed to *load* entirely (`Firebase: Error (auth/invalid-api-key)` without env vars), masking the stale assertion; `.env.local` now lets it load and the stale test surfaces. `RosterView.vue`/its test are untouched by 17-04 — logged to `deferred-items.md`, not fixed (scope boundary).

## User Setup Required

None — no external service configuration required.

## Known Stubs

None. The Roles tab is fully wired to the real resolver (`resolveServiceRoleAssignments`) and real store actions (`setRoleOverride`/`clearRoleOverride`); mocked only in tests.

## Threat Flags

None beyond the plan's own threat model. T-17-04-01 (viewer reading editor-only roster/quarters via the guard-less route) is mitigated as required — the data SUBSCRIPTION (not just the UI) is gated behind `authStore.isEditor`, proven by the "non-editor: Roles tab button is hidden and no roster/quarters data is read" test and confirmed by the human-verify viewer step (no permission-denied errors). T-17-04-02 (whole-map override clobber) is transferred to 17-03's scoped dot-path writes, which this view calls without ever constructing a whole-map write.

## Next Phase Readiness

- 17-05 (public ShareView "Who's Serving") is independent — it consumes the same resolver/snapshot via `createShareToken` (17-03), not this view; no coupling introduced.
- No blockers. Phase 17 in-app Roles surface is complete.

## Self-Check: PASSED

- FOUND: `src/views/ServiceEditorView.vue`
- FOUND: `src/views/__tests__/ServiceEditorView.test.ts`
- FOUND commit: `6c47a7b` (feat: tab bar + Roles tab body)
- FOUND commit: `325cdc2` (test: SFC transform warmup)
- FOUND grep targets: `activeTab` union ref, `resolveServiceRoleAssignments`, `setRoleOverride`, `clearRoleOverride` in ServiceEditorView.vue
- `npx vue-tsc --build` — clean
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 7/7 pass

---
*Phase: 17-sync-schedule-with-planned-services-add-a-roles-tab-to-servi*
*Completed: 2026-07-22*
