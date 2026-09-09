---
phase: 133-volunteer-responsibility-confirmation
plan: 02
subsystem: frontend
tags: [vue-component, firestore, onSnapshot, volunteer-facing, rehearse]

requires:
  - phase: 133-volunteer-responsibility-confirmation
    plan: "01"
    provides: "confirmations.ts (ConfirmationDoc/confirmationKey), roleAssignmentsByEmailLower on RehearseAccessDoc, the confirmations subcollection write rule"
provides:
  - "VolunteerConfirmBar.vue — the live 'I've got it'/Undo control mounted in VolunteerServiceView"
  - "myAssignments computed on VolunteerServiceView (auth.currentUser email -> doc.roleAssignmentsByEmailLower lookup)"
affects: [133-03, 133-04]

tech-stack:
  added: []
  patterns:
    - "per-role Map<confirmationKey, ConfirmationDoc> built from a collection onSnapshot, re-subscribed on orgId/serviceId/assignment-count change"
    - "confirming identity derived only from auth.currentUser?.email, never a prop/route value (defense-in-depth on top of the Plan 01 rule)"

key-files:
  created:
    - src/components/rehearse/VolunteerConfirmBar.vue
    - src/components/rehearse/__tests__/VolunteerConfirmBar.test.ts
  modified:
    - src/views/VolunteerServiceView.vue

key-decisions:
  - "The confirm bar skips opening its onSnapshot listener entirely when myAssignments is empty (Rule 2 addition, not in the plan's literal text) — avoids an idle Firestore read for a volunteer holding no role on the service"
  - "The confirm control lives EXCLUSIVELY in VolunteerServiceView's tri-tab shell, per 133-RESEARCH.md's resolved Open Question 1 — ScheduleServiceCard.vue stays untouched and read-only"

requirements-completed: [R410]

coverage:
  - id: D1
    description: "VolunteerConfirmBar.vue: per-role confirm/undo controls, live onSnapshot state, scoped write/delete"
    requirement: R410
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/VolunteerConfirmBar.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "VolunteerServiceView mounts the bar with the volunteer's own assignments, guarded for legacy docs"
    requirement: R410
    verification:
      - kind: unit
        ref: "src/views/__tests__/VolunteerServiceView.test.ts (19 tests, all still pass)"
        status: pass
      - kind: static
        ref: "npm run type-check"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-09-07
status: complete
---

# Phase 133 Plan 02: Volunteer "I've got it" Confirm Control Summary

**New `VolunteerConfirmBar.vue` renders one live confirm/undo chip per role the signed-in volunteer holds on a Planned service, mounted in `VolunteerServiceView`'s tri-tab shell above the tab strip — never nested in `ScheduleServiceCard`'s router-link.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-07T17:00Z (approx)
- **Completed:** 2026-09-07T17:22Z (approx)
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `src/components/rehearse/VolunteerConfirmBar.vue`: props `orgId`/`serviceId`/`myAssignments`; subscribes live (`onSnapshot`) to `organizations/{orgId}/services/{serviceId}/confirmations`, maps docs by `confirmationKey(roleId, emailLower)`, and renders per role: an "I've got it" button (Unconfirmed), a green "Confirmed" chip with Undo, or an amber "Please reconfirm" chip with the confirm action still available (needsReconfirmation).
- The confirming email is resolved exclusively from `auth.currentUser?.email` (never a prop/route value — T-133-08); writes carry exactly the 6 rule-allowlisted fields (`roleId`, `roleName`, `emailLower`, `status: 'confirmed'`, `confirmedAt`, `updatedAt`) via `setDoc` — T-133-09; un-confirm is a `deleteDoc`, never a client-chosen `'unconfirmed'` write.
- `VolunteerServiceView.vue` now imports and mounts the bar between the service header and the tablist, computing `myAssignments` from `doc.roleAssignmentsByEmailLower?.[myEmailLower] ?? []` — an absent field (legacy doc) or unmatched email yields `[]`, rendering nothing, no crash.
- 7 new component tests: empty-assignments render + no-listener, write payload assertion, live confirmed-state flip + Undo affordance, needsReconfirmation treatment, Undo delete call, and re-subscribe-on-change.

## Task Commits

Each task was committed atomically:

1. **Task 1: VolunteerConfirmBar component (live read + scoped write)** - `35393a8d` (feat)
2. **Type-check fix (Mock.calls cast) + Task 2: mount in VolunteerServiceView** - `c9170a07` (fix)

**Plan metadata:** committed as part of this SUMMARY (see below).

## Files Created/Modified
- `src/components/rehearse/VolunteerConfirmBar.vue` - the confirm/undo control
- `src/components/rehearse/__tests__/VolunteerConfirmBar.test.ts` - 7 component tests
- `src/views/VolunteerServiceView.vue` - mounts the bar, computes `myAssignments`, imports `auth` from `@/firebase`

## Decisions Made
- Skip opening the confirmations listener when `myAssignments` is empty (Rule 2: avoid an idle Firestore read for a volunteer who holds no role on this service) — not explicitly required by the plan text, but a low-risk efficiency addition consistent with the plan's "empty myAssignments -> renders nothing" intent.
- Kept the confirm bar entirely inside `VolunteerServiceView.vue`; `ScheduleServiceCard.vue` untouched, per 133-RESEARCH.md's resolved Open Question 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cast `Mock.calls[0]` tuples via `unknown` first**
- **Found during:** Post-Task-1 verification (`npm run type-check`)
- **Issue:** `vue-tsc --build` flagged two direct tuple casts (`mockSetDoc.mock.calls[0] as [{path},...]` and the `deleteDoc` equivalent) as an insufficient-overlap conversion — `Mock.calls` is typed `unknown[][]`, and TS won't narrow a 0-or-2-element array directly to a fixed 2-tuple without an intermediate `unknown`.
- **Fix:** Routed both casts through `unknown` first (`as unknown as [...]`), matching this codebase's established mock-assertion pattern seen elsewhere in the test suite.
- **Files modified:** `src/components/rehearse/__tests__/VolunteerConfirmBar.test.ts`
- **Verification:** `npm run type-check` clean; the 7 component tests still pass.
- **Committed in:** `c9170a07`

**2. Commit-staging note (process, not code):** Task 2's `VolunteerServiceView.vue` change was staged (via `git add`) before the Task 1 type-check fix was committed, and both landed in the same commit (`c9170a07`, message titled around the fix). No functional impact — both changes are Plan 133-02 work — but the commit message doesn't fully describe the `VolunteerServiceView.vue` mount change it also contains. Flagged here for transparency; not re-split, since amending/rewriting history is discouraged and the net diff is correct and fully covered by this Summary's Task Commits table.

---

**Total deviations:** 1 auto-fixed (type-check cast), 1 process note (commit-grouping, no functional impact)
**Impact on plan:** None — all plan behavior delivered exactly as specified; only the type-check syntax and commit grouping needed adjustment.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Deferred UAT

Per `/gsd-autonomous` (UAT deferred to milestone end), the manual verification step in this plan's
`<verification>` section — "a volunteer on a Planned service taps 'I've got it' -> Confirmed; Undo ->
Unconfirmed; a second browser/tab reflects the change live" — was NOT performed interactively. All code
tasks are complete and auto-verified (component tests green, type-check clean, full app suite at
baseline). This deferred item is tracked by the milestone orchestrator, not appended here per this
plan's instructions.

## Verification Run

- `npx vitest run src/components/rehearse/__tests__/VolunteerConfirmBar.test.ts` — 7/7 pass
- `npx vitest run src/components/rehearse/__tests__/VolunteerConfirmBar.test.ts src/views/__tests__/VolunteerServiceView.test.ts` — 26/26 pass (VolunteerServiceView's existing 19 tests unaffected)
- `npm run type-check` (`vue-tsc --build`, per CLAUDE.md) — clean, zero errors
- `npx vitest run` (full app suite, no `--dir`) — 214/215 files pass, **5547 passed / 35 skipped** — exactly the documented baseline: only `src/storage.rules.test.ts` fails (Storage-emulator `firestore.exists()` cross-service limitation, CLAUDE.md-documented, not a regression)

## Next Phase Readiness
- `VolunteerConfirmBar.vue`'s props/behavior contract (`orgId`/`serviceId`/`myAssignments` in, live confirm/undo out) is stable for any later plan that wants to reuse the same confirmations read pattern (e.g. Plan 133-03's planner-side live status).
- No blockers identified for Plan 03.

## Self-Check: PASSED

Both created files found on disk; both claimed commit hashes found in git log.

---
*Phase: 133-volunteer-responsibility-confirmation*
*Completed: 2026-09-07*
