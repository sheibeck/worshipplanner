---
phase: 75-pending-invite-visibility
plan: 01
subsystem: api
tags: [firestore, count-aggregate, callable-functions, vue, admin-ui, a11y]

# Dependency graph
requires:
  - phase: 74-super-admin-org-provisioning
    provides: listOrganizations callable, OrgSummary type, Organizations tab list table
provides:
  - "OrgSummary.pendingCount computed server-side via a Firestore count() aggregate over each org's invites subcollection"
  - "Members cell 'N pending' accessible badge in the Organizations tab, distinguishing active members from unclaimed invitees"
affects: [admin-org-management, invite-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two count() aggregates per org fired concurrently via Promise.all inside the same per-org Promise.all mapper (no serialization)"
    - "Accessible status badges convey state via text ('N pending'), never color alone"

key-files:
  created: []
  modified:
    - functions/src/orgProvisioning.ts
    - functions/src/orgProvisioning.test.ts
    - src/components/admin/OrganizationsTab.vue
    - src/components/admin/__tests__/OrganizationsTab.test.ts

key-decisions:
  - "pendingCount always explicit 0 rather than omitted/undefined -- data layer never leaves ambiguity between 'no invites' and 'not computed'"
  - "Badge is a suffix inside the existing Members cell, not a new column -- matches CONTEXT.md's decision to avoid layout churn"
  - "Ships built + tested + UNDEPLOYED; deploy is a hand-over step for the owner"

patterns-established:
  - "Concurrent per-org Firestore count() aggregates (Promise.all of Promise.all) as the pattern for adding a second subcollection metric alongside an existing one"

requirements-completed: [R222, R223]

coverage:
  - id: D1
    description: "listOrganizationsHandler returns pendingCount per org from a live invites count() aggregate, computed concurrently with memberCount"
    requirement: "R223"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#R222/R223: pendingCount reflects each org's live invites count() aggregate, computed alongside memberCount"
        status: pass
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#R222: an org with no invite docs returns pendingCount: 0 explicitly (never omitted/undefined)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Organizations tab Members cell shows an accessible 'N pending' badge whenever pendingCount > 0, with no badge for genuinely empty orgs"
    requirement: "R222"
    verification:
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#renders an accessible \"N pending\" badge when pendingCount > 0 (R222)"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#shows \"0\" active plus \"1 pending\" for an onboarded-but-unclaimed admin (R222)"
        status: pass
      - kind: unit
        ref: "src/components/admin/__tests__/OrganizationsTab.test.ts#renders no \"pending\" text for a genuinely empty org (0 active, 0 pending) (R222)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-08-22
status: complete
---

# Phase 75 Plan 01: Pending-Invite Visibility Summary

**Server-side `pendingCount` from a concurrent Firestore `invites` count() aggregate, surfaced as an accessible "N pending" badge in the Organizations tab's Members cell.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-22T19:04:58Z
- **Completed:** 2026-08-22T19:22:21Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4

## Accomplishments
- `listOrganizationsHandler` now computes `pendingCount` per org from a live `invites` subcollection `count()` aggregate, run concurrently with the existing `memberCount` aggregate in the same per-org `Promise.all` mapper -- no serialization added, no new client-facing read path.
- `OrgSummary` (both server and client) carries `pendingCount: number`, always explicit (never omitted/undefined) even when an org has zero invites.
- The Organizations tab's Members cell now appends a small amber pill reading "N pending" whenever `pendingCount > 0`, so an org whose only admin was onboarded by email but never logged in reads `0` plus `1 pending`, never a bare confusing `0`. The word "pending" is always present in the rendered text (not color-only), satisfying accessibility.
- Genuinely empty orgs (0 active, 0 pending) render no badge at all -- unchanged from today's plain `0`.

## Task Commits

Each task followed RED -> GREEN (TDD):

1. **Task 1: Server -- pendingCount from an invites count() aggregate (R222, R223)**
   - `d2847117` test(75-01): add failing tests for OrgSummary.pendingCount aggregate (RED)
   - `2f1dcb78` feat(75-01): compute pendingCount from invites count() aggregate (GREEN)
2. **Task 2: Client -- pending badge in the Organizations tab Members cell (R222)**
   - `4acad34d` test(75-01): add failing tests for pending-invite badge in Members cell (RED)
   - `a9ce4430` feat(75-01): show pending-invite badge in Organizations tab Members cell (GREEN)

**Plan metadata:** (this commit, follows)

_Both tasks: RED confirmed via observed test failures before writing the implementation, then GREEN confirmed via a passing re-run, in each case before committing._

## Files Created/Modified
- `functions/src/orgProvisioning.ts` - `OrgSummary.pendingCount` field; `listOrganizationsHandler` runs `members` and `invites` count() aggregates concurrently per org via `Promise.all`.
- `functions/src/orgProvisioning.test.ts` - `FakeFirestore`'s org-doc `collection()` stub now answers `"invites"` like `"members"`; two new cases (N-invites, zero-invites-defaults-to-0) plus updated shape assertions on the two pre-existing cases.
- `src/components/admin/OrganizationsTab.vue` - client `OrgSummary.pendingCount` field; Members `<td>` appends a `v-if="org.pendingCount > 0"` amber pill containing the literal word "pending".
- `src/components/admin/__tests__/OrganizationsTab.test.ts` - `makeOrg` fixture gains `pendingCount: 0` default; three new cases (badge-present, 0-active/1-pending unclaimed-admin, 0-0 no-badge).

## Decisions Made
- Kept `pendingCount` inside the existing Members cell as a suffix pill rather than adding a new `<th>`/column, per 75-CONTEXT.md's explicit guidance and to avoid touching the `colspan="5"` empty-state row.
- Used `amber-900/40`/`amber-300`/`amber-800/50` pill styling to match the existing dark-table idiom (ConfigurationTab precedent) while remaining visually distinct from the plain gray active count.
- No new callable, no `firestore.rules`/`storage.rules` change -- purely an Admin-SDK read widening an already-gated response shape, per the plan's threat model (T-75-01, T-75-02: both accepted, low severity, no new exposure to non-privileged callers).

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the specified TDD RED/GREEN sequence with commits matching the plan's file list.

## Issues Encountered
None.

## Hand-Over: Deploy Required

**The extended `listOrganizations` callable ships built + tested + UNDEPLOYED.** The owner must run:

```
firebase deploy --only functions:listOrganizations
```

The Organizations-tab UI half (client-only change) needs no deploy.

## User Setup Required
None - no external service configuration required. (See "Hand-Over: Deploy Required" above for the one owner-run deploy command.)

## Gate Results

- `npm run type-check` (`vue-tsc --build`) -- **clean** (exit 0).
- `cd functions && npx vitest run src/orgProvisioning.test.ts` -- **green**, 30/30 tests (includes the 2 new pendingCount cases).
- `cd functions && npx vitest run` (full functions suite) -- **green**, 14/14 files, 488/488 tests, no regressions.
- `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` -- **green**, 23/23 tests (includes the 3 new pending-badge cases).
- `npx vitest run` (full app suite) -- at the documented 2-file baseline exactly: `src/storage.rules.test.ts` (Storage-emulator `firestore.exists()` cross-service limitation, pre-existing) and `src/views/__tests__/RosterView.test.ts` (stale assertion, pre-existing). No new failures introduced by this phase.

## Next Phase Readiness
- `pendingCount` visibility is complete and ready to ship once the owner runs the hand-over deploy command above.
- Deferred scope (per 75-CONTEXT.md): listing actual pending email addresses, per-org invite drill-down, resend-invite, revoke-invite -- all future scope, out of this phase's boundary.

---
*Phase: 75-pending-invite-visibility*
*Completed: 2026-08-22*

## Self-Check: PASSED

All 4 modified source/test files and the SUMMARY.md verified present on disk; all 4 task commit hashes (`d2847117`, `2f1dcb78`, `4acad34d`, `a9ce4430`) verified present in `git log --all`.
