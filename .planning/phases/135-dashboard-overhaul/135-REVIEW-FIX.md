---
phase: 135-dashboard-overhaul
fixed_at: 2026-09-07T22:39:00Z
review_path: .planning/phases/135-dashboard-overhaul/135-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 135: Code Review Fix Report

**Fixed at:** 2026-09-07T22:39:00Z
**Source review:** .planning/phases/135-dashboard-overhaul/135-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, WR-02 — IN-01 excluded per fix_scope: critical_warning)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: `unconfirmedError` never resets, permanently disabling the card after any transient snapshot error

**Files modified:** `src/composables/useUnconfirmedVolunteers.ts`
**Commit:** 156d0145
**Applied fix:** Replaced the single shared `error = ref(false)` (set `true` in either
`onSnapshot` error callback, never reset) with a per-service `hasError` boolean on
`ServiceListenerState`, plus a derived `error = computed(...)` that is `true` only while at
least one currently-in-window service has `hasError`. Both success callbacks (rehearseAccess
and confirmations) now set `state.hasError = false` on delivery, so a listener that recovers
clears only its own contribution. A service that falls out of the window is removed from
`statesByServiceId` by `reconcile()`, so its error contribution disappears with it; org switch
(`teardownAll()`) clears the whole map, so `error` naturally reads `false` again with no
separate reset needed. Verified with the new CR-01 regression tests in
`useUnconfirmedVolunteers.test.ts` (error-then-recovery on the same listener, and error cleared
when the erroring service falls out of the window). `usePresenceRollup.ts` was reviewed per the
task's request to check for an analogous never-reset error ref — it does not expose an aggregate
`error` at all (only per-service `rows`, reset to `[]` on error and repopulated on the next
successful snapshot), so no change was needed there.

### WR-02: "Everyone's confirmed" is a false negative for services locked before Phase 133

**Files modified:** `src/composables/useUnconfirmedVolunteers.ts`, `src/views/DashboardView.vue`
**Commit:** dd31f172
**Applied fix:** Added a new `hasStaleAssignmentData` computed to `useUnconfirmedVolunteers`
that is `true` when at least one in-window service's rehearseAccess snapshot has arrived but
`roleAssignmentsByEmailLower` is `undefined` (a pre-Phase-133 service, never relocked). Left
`unconfirmedAssignments()` itself untouched (it already correctly excludes such a service from
the unconfirmed tally — the bug was purely at the display layer folding "no data" into "all
confirmed"). `DashboardView.vue` now branches on `hasStaleAssignmentData` before the "Everyone's
confirmed…" copy, showing "Some service(s) predate confirmation tracking — relock to check
confirmations." instead, per the review's "prefer excluding it from the positive claim"
guidance. Verified with the new WR-02 test cases in `useUnconfirmedVolunteers.test.ts` (undefined
projection flags stale; a real all-confirmed service does not).

### WR-01: Zero automated test coverage for the exact listener-lifecycle logic under review

**Files modified:** `src/composables/__tests__/useUnconfirmedVolunteers.test.ts` (new),
`src/composables/__tests__/usePresenceRollup.test.ts` (new)
**Commit:** 7a441da4
**Applied fix:** Added both test files, mirroring `useServicePresence.test.ts`'s
mount-a-throwaway-host + captured-callback firebase/firestore mock convention, generalized to
track multiple concurrent listeners (2 per service for the unconfirmed-volunteers composable, 1
per service for the presence roll-up). Coverage per file:
- `useUnconfirmedVolunteers.test.ts` (8 tests): listeners opened per service in a 6-service
  window; window shrink tears down only the dropped services' listeners with zero churn on kept
  ones; org switch tears down every listener before resubscribing under the new org; unmount
  tears down every open listener; the CR-01 regression (error on one listener, then a successful
  snapshot on the SAME listener clears `error`; and an errored service falling out of the window
  also clears `error`); the WR-02 case (undefined projection flags `hasStaleAssignmentData`, a
  real all-confirmed service does not).
- `usePresenceRollup.test.ts` (7 tests): listeners opened per service; window-shrink and
  org-switch teardown/no-churn parity with the above; unmount teardown; a fresh viewer appearing
  in `activeEditors`; the forced-disconnect staleness case (mirrors
  `useServicePresence.test.ts`'s clock-advance-only test); and an error-then-recovery case
  proving the per-service `rows` reset on error and repopulate on the next successful snapshot.

**Verification (all in scope):**
- `npx vitest run src/composables/__tests__/useUnconfirmedVolunteers.test.ts src/composables/__tests__/usePresenceRollup.test.ts src/utils/__tests__/unconfirmedAssignments.test.ts` — 3 files, 22 tests, all passing.
- `npm run type-check` (`vue-tsc --build`) — clean, no errors.

## Skipped Issues

None — all in-scope findings (CR-01, WR-01, WR-02) were fixed. IN-01 was excluded per
`fix_scope: critical_warning` and left for a future pass if promoted.

---

_Fixed: 2026-09-07T22:39:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
