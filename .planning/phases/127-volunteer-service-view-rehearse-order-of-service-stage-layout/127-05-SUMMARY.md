---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
plan: 05
subsystem: auth
tags: [vue, composable, pinia, firestore, security, tdd]

requires:
  - phase: 126-volunteer-my-schedule-magic-link-access
    provides: mySchedule store (docs[] with per-doc orgId resolved from Firestore path)
  - phase: 125-rehearse-access-foundation-magic-link-auth
    provides: RehearseAccessDoc type + the rehearseAccess get-arm rules (R377 parentIsPlanned re-check)
provides:
  - useVolunteerServiceDoc(serviceId) composable — orgId-from-store resolution + live get-arm re-fetch + 4-state machine
affects: [127-06-volunteer-service-view]

tech-stack:
  added: []
  patterns:
    - "Security-sensitive orgId resolution isolated in a testable composable, never trusting a route param/query for a value that gates a Firestore path (T-127-02)"
    - "Reactive-mock-store test convention (vi.mock('@/stores/x', ...) with a shared reactive fixture object) mirrored from MyScheduleView.test.ts for a store the composable consumes but doesn't own"

key-files:
  created:
    - src/composables/useVolunteerServiceDoc.ts
    - src/composables/__tests__/useVolunteerServiceDoc.test.ts
  modified: []

key-decisions:
  - "orgId is resolved ONLY by matching serviceId against mySchedule.docs (never accepted as a function argument, never read from a route param/query) — a post-fallback miss returns access-denied without ever constructing a getDoc call, so the client cannot be used to probe for another org's service existence (T-127-05)."
  - "A fresh getDoc always re-runs on load/retry rather than trusting the cached list-arm doc, closing the reopen-staleness gap (T-127-03) — permission-denied and a missing doc both map to the same access-denied state (no signal leaked to the client about which), while any other error maps to a distinct, retryable load-failure state."
  - "load() fires immediately in the composable body (not gated by onMounted) so the composable's test suite calls it directly without a host component/mount wrapper — matches this plan's TDD test authoring needs without an unrelated Vue lifecycle dependency."

requirements-completed: []

coverage:
  - id: D1
    description: "useVolunteerServiceDoc resolves orgId exclusively from the volunteer's own mySchedule store (warm match, cold-store single loadMySchedule() fallback, and a post-fallback miss returning access-denied without a getDoc call)"
    requirement: R384
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useVolunteerServiceDoc.test.ts#warm-store match resolves orgId from the matched doc and loads the fresh getDoc result"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useVolunteerServiceDoc.test.ts#cold-store calls loadMySchedule exactly once, then resolves from the newly loaded match"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useVolunteerServiceDoc.test.ts#no match even after the fallback load returns access-denied WITHOUT calling getDoc"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useVolunteerServiceDoc.test.ts#sources orgId exclusively from the matched store doc — never from any other value"
        status: pass
    human_judgment: false
  - id: D2
    description: "A fresh getDoc re-checks the live rehearseAccess get arm on every load/retry, exposing 4 distinct states: loading / loaded / access-denied (missing doc or permission-denied) / load-failure (network/unknown, retryable)"
    requirement: R384
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useVolunteerServiceDoc.test.ts#a non-existent rehearseAccess doc returns access-denied"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useVolunteerServiceDoc.test.ts#a permission-denied getDoc error maps to access-denied"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useVolunteerServiceDoc.test.ts#a network/unknown getDoc error maps to load-failure (retryable, distinct from access-denied)"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useVolunteerServiceDoc.test.ts#retry() re-runs the full resolution flow and can recover from load-failure"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-06
status: complete
---

# Phase 127 Plan 05: useVolunteerServiceDoc — orgId-from-store resolution + live get-arm re-fetch Summary

**`useVolunteerServiceDoc(serviceId)` composable: resolves orgId exclusively from the volunteer's own `mySchedule` store (never a route input), then re-validates against a fresh `getDoc` on the `rehearseAccess` get arm, exposing a loading/loaded/access-denied/load-failure state machine — TDD RED→GREEN, 8/8 unit assertions.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-06T07:06:00-04:00
- **Completed:** 2026-09-06T07:12:00-04:00
- **Tasks:** 1
- **Files modified:** 2 (both new)

## Accomplishments
- Built the single most security-sensitive piece of the volunteer client: `orgId` resolution for a route (`/volunteer/service/:serviceId`) that carries no `orgId` param by design.
- orgId comes exclusively from matching `serviceId` against the volunteer's own server-filtered `mySchedule.docs`, with exactly one `loadMySchedule()` fallback on cold navigation; a miss after the fallback is `access-denied` WITHOUT ever attempting a `getDoc` with a guessed/absent orgId.
- Every load/retry re-checks the live R377 get arm via a fresh `getDoc` rather than trusting the store's possibly-stale cached doc, closing the reopen-staleness gap (T-127-03).
- A 4-state machine (`loading` / `loaded` / `access-denied` / `load-failure`) distinguishes "denied or doesn't exist" (no distinguishing signal leaked to the client) from a retryable network/unknown error, plus a `retry()` that re-runs the whole flow.
- Full TDD RED→GREEN cycle: a stub implementation proved all 8 test assertions fail first, then the real implementation turned them green.

## Task Commits

Each task was committed atomically:

1. **Task 1: useVolunteerServiceDoc.ts — store-based orgId resolution + live get-arm re-fetch with a 4-state machine**
   - `1f1e4d37` (test) — 8 failing assertions against a stub implementation (RED)
   - `d67271e5` (feat) — real implementation, all 8 assertions green (GREEN)

**Plan metadata:** pending (docs: complete plan, committed alongside this summary)

## Files Created/Modified
- `src/composables/useVolunteerServiceDoc.ts` - orgId-from-store resolution + live get-arm re-fetch + 4-state machine (loading/loaded/access-denied/load-failure) + retry()
- `src/composables/__tests__/useVolunteerServiceDoc.test.ts` - 8 unit tests covering warm/cold-store resolution, no-match access-denied without a getDoc call, non-existent-doc/permission-denied access-denied, network-error load-failure, retry recovery, and an explicit orgId-source assertion

## Decisions Made
- orgId resolution is a pure store lookup + one fallback load, never a function argument and never a route/query read — see key-decisions above.
- `permission-denied` and a missing/non-existent doc are deliberately collapsed into the same `access-denied` state (no signal to the client about which case occurred), while any other thrown error is the distinct, retryable `load-failure` state — matches the plan's `<behavior>` spec exactly.
- The load routine fires immediately in the composable body rather than inside `onMounted`, since there's no subscription/listener needing cleanup and this lets the unit tests call the composable directly without mounting a host component (mirrors this plan's own test-authoring need; no existing composable in this codebase needed this exact shape, so no analog was overridden).

## Deviations from Plan

None - plan executed exactly as written. The composable's shape, error mapping, and test coverage match the plan's `<action>` and `<acceptance_criteria>` verbatim.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `useVolunteerServiceDoc` is ready for Plan 06 (`VolunteerServiceView.vue`) to consume as its whole-view state source: the view reads `serviceId` from the route, calls `useVolunteerServiceDoc(serviceId)`, and renders loading/access-denied/load-failure/populated branches off `state` + `doc`.
- No blockers. `npm run type-check` is clean project-wide; the targeted test file is 8/8 green.

---
*Phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout*
*Completed: 2026-09-06*

## Self-Check: PASSED
- FOUND: src/composables/useVolunteerServiceDoc.ts
- FOUND: src/composables/__tests__/useVolunteerServiceDoc.test.ts
- FOUND: 1f1e4d37 (test commit)
- FOUND: d67271e5 (feat commit)
