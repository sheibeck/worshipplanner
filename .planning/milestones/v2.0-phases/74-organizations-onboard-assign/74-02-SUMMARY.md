---
phase: 74-organizations-onboard-assign
plan: 02
subsystem: ui
tags: [vue, firebase-functions, httpsCallable, owner-console, multi-tenancy]

requires:
  - phase: 74-organizations-onboard-assign
    provides: "onboardOrganization/assignOrgAdmin/listOrganizations callables (functions/src/orgProvisioning.ts) with contracts: listOrganizations -> {organizations:{orgId,name,createdAt,memberCount}[]}; onboard/assign -> {status:'added'|'invited'}"
provides:
  - "OrganizationsTab.vue: real platform multi-tenancy UI (org list, onboard-a-church form, per-org assign-admin control), replacing the Phase 72 placeholder"
  - "OrganizationsTab.test.ts: 16-test component suite proving list/onboard/assign states and the httpsCallable-only backend surface"
affects: [owner-console, organizations-onboarding, multi-tenancy]

tech-stack:
  added: []
  patterns:
    - "Pure httpsCallable consumer component: no firestore write imports at all, mirroring ConfigurationTab's setSuperAdminClaim idiom extended to three callables"
    - "One-shot refetch (not realtime onSnapshot) after a successful onboard/assign to keep list counts current"
    - "Per-orgId keyed error/feedback maps (assignError/assignFeedback) so row-scoped state never leaks across org rows"

key-files:
  created:
    - src/components/admin/__tests__/OrganizationsTab.test.ts
  modified:
    - src/components/admin/OrganizationsTab.vue
    - src/views/__tests__/OwnerConsoleView.test.ts

key-decisions:
  - "friendlyCallableError extended with an already-exists branch returning 'That church name is taken.' (R201), copied+extended from ConfigurationTab.vue rather than shared/refactored — keeps this plan client-only with no shared-util churn"
  - "OwnerConsoleView.test.ts's generic httpsCallable mock updated to resolve {data:{ok:true, organizations:[]}} instead of {data:{ok:true}} -- OrganizationsTab now mounts unconditionally under v-show and calls listOrganizations on mount, so the previous mock shape threw on orgs.length"

patterns-established:
  - "Row-scoped async action state (per-orgId error/feedback ref maps), cleared on open/close of the inline control"

requirements-completed: [R196, R197, R199, R200, R201, R202, R203, R204, R205]

coverage:
  - id: D1
    description: "Organizations list renders name/org-id/created/member-count with loading/empty/error states, refetched via listOrganizations on mount (R196)"
    requirement: R196
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- list (R196)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Onboard-a-church form calls onboardOrganization with client-side validation, added-vs-invited success copy, and name-taken (already-exists) error mapping"
    requirement: R197
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- onboard form (R197/R201/R202)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-org inline assign-admin control calls assignOrgAdmin with added-vs-invited feedback and per-row (orgId-keyed) errors"
    requirement: R203
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- per-org assign admin (R203/R205)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Client performs no privileged Firestore writes -- only the three httpsCallable selectors are ever invoked (R200/R204)"
    requirement: R200
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#OrganizationsTab -- no direct writes (R200/R204)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real-browser visual confirmation of the styled tab (dark palette match, layout, focus states)"
    verification: []
    human_judgment: true
    rationale: "jsdom component tests cannot prove live visual rendering; deferred to /gsd-verify-work 74 per plan's success_criteria"

duration: 55min
completed: 2026-08-21
status: complete
---

# Phase 74 Plan 02: Organizations Tab UI Summary

**Built the real Organizations tab (list + onboard-a-church form + per-org assign-admin control) as a pure `httpsCallable` consumer of Plan 01's three callables, replacing the Phase 72 placeholder.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-08-21T20:06:00Z
- **Completed:** 2026-08-21T21:01:16Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `OrganizationsTab.vue` renders the org list table (Church / Org ID / Created / Members / Actions) with loading, empty, and error states driven by `listOrganizations` on mount (R196).
- The "Onboard a church" form (church name + first-admin email) client-validates before calling `onboardOrganization`, shows added-vs-invited success copy verbatim from the callable, and maps `already-exists` to "That church name is taken." (R197/R201/R202).
- The per-org "Assign admin" inline control (click-to-reveal, indigo accent, add-not-destructive styling) calls `assignOrgAdmin` with row-scoped (orgId-keyed) success/error feedback (R203/R205).
- List refetches once after every successful onboard/assign so counts/rows stay current (one-shot, not realtime).
- Component imports zero firestore write helpers — the only backend surface is the three named `httpsCallable` selectors (R200/R204), enforced by a name-keyed mock in the new test file that throws on any other callable name.
- 16-test component suite (`OrganizationsTab.test.ts`) covers list (loading/empty/populated/error), onboard (validation, added, invited, name-taken), and assign (added, invited, invalid, error, per-row scoping, cancel).

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the Organizations tab UI (list + onboard form + per-org assign control)** - `0c967f80` (feat)
2. **Task 2: Component tests for the Organizations tab** - `f3ef83ef` (test — also carries the Rule 1 OwnerConsoleView.test.ts mock fix)

**Plan metadata:** pending (final docs commit, see below)

## Files Created/Modified
- `src/components/admin/OrganizationsTab.vue` - Real org list / onboard form / assign-admin control UI, replacing the Phase 72 placeholder
- `src/components/admin/__tests__/OrganizationsTab.test.ts` - New 16-test component suite (mount + name-keyed httpsCallable mock)
- `src/views/__tests__/OwnerConsoleView.test.ts` - Generic httpsCallable mock's resolved data extended with `organizations: []` (Rule 1 fix, see below)

## Decisions Made
- Extended `friendlyCallableError` with an `already-exists` branch inline in `OrganizationsTab.vue` (copied from `ConfigurationTab.vue`, not shared/refactored into a util) — keeps this plan strictly client-only per the plan's file-scope constraint.
- Kept the assign-admin control's "Cancel assign" copy (not a bare "Cancel") per the UI-SPEC's action-scoped label recipe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OwnerConsoleView.test.ts's generic httpsCallable mock broke on the now-real OrganizationsTab**
- **Found during:** Task 2, running the full app suite (`npx vitest run`) after adding OrganizationsTab.test.ts
- **Issue:** `OwnerConsoleView.vue` mounts `ConfigurationTab` and `OrganizationsTab` unconditionally under `v-show` (both stay mounted for the console's lifetime). `OrganizationsTab` now calls `listOrganizations` in `onMounted` (previously it was a static placeholder with no callable). `OwnerConsoleView.test.ts`'s `firebase/functions` mock resolved every callable to `{data:{ok:true}}` regardless of name, so `result.data.organizations` was `undefined`, and the template's `orgs.length === 0` threw a `TypeError` as an unhandled promise rejection during every test in that file.
- **Fix:** Extended the mock's resolved shape to `{data:{ok:true, organizations:[]}}` — covers both `ConfigurationTab`'s `setSuperAdminClaim` (`ok: true`) and `OrganizationsTab`'s `listOrganizations` (`organizations: []`) without needing per-name dispatch in that file.
- **Files modified:** `src/views/__tests__/OwnerConsoleView.test.ts`
- **Verification:** `npx vitest run src/views/__tests__/OwnerConsoleView.test.ts` — 13/13 pass, zero unhandled rejections. Full app suite (`npx vitest run`) confirmed back at the documented 2-file baseline.
- **Committed in:** `f3ef83ef` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix)
**Impact on plan:** Necessary to keep the existing OwnerConsoleView suite green now that OrganizationsTab performs a real network call on mount. No scope creep — fix is confined to test-mock shape, not application behavior.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both Plan 01 (callables) and Plan 02 (UI) are complete for Phase 74; the Organizations tab is fully functional end-to-end against the three Wave 1 callables.
- Real-browser visual confirmation of the tab (dark-palette match, spacing, focus rings) is deferred to `/gsd-verify-work 74` per the plan's success criteria — jsdom component tests cannot prove live visual rendering.
- No blockers for downstream phases.

---
*Phase: 74-organizations-onboard-assign*
*Completed: 2026-08-21*

## Self-Check: PASSED
All created files and commit hashes verified present.
