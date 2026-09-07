---
phase: 135-dashboard-overhaul
reviewed: 2026-09-07T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/views/DashboardView.vue
  - src/utils/dashboardReadiness.ts
  - src/utils/unconfirmedAssignments.ts
  - src/composables/useUnconfirmedVolunteers.ts
  - src/utils/presenceRollup.ts
  - src/composables/usePresenceRollup.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 135: Code Review Report

**Reviewed:** 2026-09-07
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase 135 dashboard overhaul (commits `ded15853..ced5e734`): the R416 readiness
worst-of rollup, the R417 unconfirmed-volunteers bounded fan-out, and the R418 read-only
presence roll-up.

The two bounded-fan-out composables (`useUnconfirmedVolunteers.ts`, `usePresenceRollup.ts`) get
the hard part right: the ≤6-service cap is real (enforced by the caller slicing
`upcomingServices`/planned-only before the composable ever sees the array), the window-diff
`reconcile()` correctly tears down listeners for services that fall out of the window and only
opens new ones for services that enter it, the watch source is a joined id-string (not the array
reference) so an unrelated re-render never churns listeners, and `onUnmounted`/org-switch both
call `teardownAll()`. The read-only invariant for presence holds — there is no write path
(`setDoc`/`deleteDoc`/`serverTimestamp`/heartbeat) anywhere in `presenceRollup.ts` or
`usePresenceRollup.ts`. The `dashboardReadinessOf` worst-of order and its zero-slots guard are
correct and are backed by explicit unit tests covering exactly that edge case.

The one real defect found is a sticky-error bug in `useUnconfirmedVolunteers.ts` that
permanently disables the "Unconfirmed volunteers" card for the rest of the session after any
single transient snapshot error, on any of the ≤6 listeners, ever. Two further gaps (both
correctness-adjacent) are called out as warnings.

## Critical Issues

### CR-01: `unconfirmedError` never resets, permanently disabling the card after any transient snapshot error

**File:** `src/composables/useUnconfirmedVolunteers.ts:78-83, 99-102`
**Issue:**
Both `onSnapshot` error callbacks (`rehearseAccess` and `confirmations`, per service) do
`error.value = true` and nothing else. There is no corresponding `error.value = false` anywhere
in the file — not in either success callback, not in `reconcile()`, not on org switch, not when
the offending service falls out of the ≤6-service window. `error` is a single module-scope ref
shared across every service's listeners, so:

1. Any one of the up-to-12 listeners (2 per service × ≤6 services) erroring even once — a
   transient `permission-denied` while security-rule propagation catches up right after a
   service is locked (a documented risk pattern in this codebase per other Firestore-rule
   incidents), a momentary offline blip, or an internal Firestore error — sets `error.value =
   true` forever for the lifetime of the component.
2. `DashboardView.vue`'s template checks `unconfirmedError` first in the `v-else-if` chain
   (line 111), so once tripped it permanently shows "Couldn't load unconfirmed volunteers right
   now" and hides `unconfirmedRows` entirely — even while the underlying listeners keep
   delivering fresh, correct snapshots in the background.
3. Switching orgs (which calls `teardownAll()` + re-`reconcile()`, but never touches `error`)
   does not clear it either — an error tripped under one org poisons the widget for every
   subsequently-switched-to org for the rest of the session. The only recovery is a full page
   reload.

This defeats the entire purpose of the widget for the rest of the session on what is a very
plausible-to-trigger, purely transient condition.

**Fix:** Reset `error.value = false` on every successful snapshot for the service that errored
(or make the error state per-service and only show the aggregate banner while at least one
service is currently erroring), so a listener that recovers clears its own contribution:
```ts
state.unsubRehearse = onSnapshot(
  doc(db, 'organizations', org, 'rehearseAccess', serviceId),
  (snap) => {
    const data = snap.data() as RehearseAccessDoc | undefined
    state.roleAssignmentsByEmailLower = data?.roleAssignmentsByEmailLower
    state.hasRehearseSnapshot = true
    state.hasError = false          // per-service flag
    version.value++
  },
  (err: unknown) => {
    console.error('useUnconfirmedVolunteers: rehearseAccess subscription failed', err)
    state.hasError = true
    version.value++
  },
)
// error = computed(() => [...statesByServiceId.values()].some(s => s.hasError))
```
At minimum, reset the shared `error.value = false` at the top of `reconcile()` (before
subscribing) whenever `windowServices.length > 0`, so an org switch or window shift gives the
widget a clean slate even if the per-listener fix above isn't adopted.

## Warnings

### WR-01: Zero automated test coverage for the exact listener-lifecycle logic under review

**File:** `src/composables/useUnconfirmedVolunteers.ts`, `src/composables/usePresenceRollup.ts`
**Issue:** Both new composables are untested. Phase 135 added unit tests for the pure functions
they wrap (`dashboardReadiness.test.ts`, `unconfirmedAssignments.test.ts`,
`presenceRollup.test.ts`), but the composables themselves — the bounded-fan-out `reconcile()`,
the window-diff teardown, the org-switch teardown, and the `onUnmounted` teardown, i.e. precisely
the cost/leak-sensitive logic this review was asked to prioritize — have no corresponding test
file. This codebase already has precedent for testing this shape of logic
(`src/composables/__tests__/useServicePresence.test.ts` tests the single-service listener this
phase's composables generalize from), so the gap is inconsistent with established practice, not
a fundamental testing-approach limitation. CR-01 above is exactly the kind of bug a test
exercising "listener errors, then a later snapshot on the same listener succeeds" would have
caught.
**Fix:** Add `src/composables/__tests__/useUnconfirmedVolunteers.test.ts` and
`usePresenceRollup.test.ts` using the same Firestore-mocking approach as
`useServicePresence.test.ts`, covering at minimum: (a) window shrinks from 6→3 services tears
down the 3 dropped listeners and leaves the 3 kept ones untouched (no re-subscribe), (b) org
change tears down all listeners before subscribing to the new org, (c) unmount tears down every
open listener, and (d) an error on one listener followed by a successful snapshot on the same
listener clears the error state.

### WR-02: "Everyone's confirmed" is a false negative for services locked before Phase 133

**File:** `src/utils/unconfirmedAssignments.ts:27` (`if (!roleAssignmentsByEmailLower) return []`)
**Issue:** `roleAssignmentsByEmailLower` is optional on `RehearseAccessDoc` (`rehearseAccess.ts:90`)
and is genuinely `undefined` on any service locked before Phase 133 that hasn't since been
relocked. For such a service, `unconfirmedAssignments()` returns `[]` — indistinguishable from
"everyone assigned to this service has confirmed." `DashboardView.vue`'s copy for
`unconfirmedRows.length === 0` is unconditionally "Everyone's confirmed for the next N
service(s)" (line 116-118), with no separate branch for "this service predates confirmation
tracking and has never recorded a single confirmation." A leader relying on this card would be
told a pre-133, never-relocked Planned service is fully confirmed when in fact zero
confirmations have ever been requested or recorded for it.
**Fix:** Distinguish the two states — either treat a service with `roleAssignmentsByEmailLower
=== undefined` as "unknown" (surface it separately, e.g. "N service(s) need relocking to check
confirmations") rather than folding it into the same `unconfirmedRows.length === 0` success
path, or have `unconfirmedAssignments` signal the distinction explicitly (e.g. return a
`stale: boolean` alongside the row array) so the view can render different copy.

## Info

### IN-01: `serviceSongStats`'s inner `.kind === 'SONG'` check is redundant

**File:** `src/views/DashboardView.vue:299-302`
**Issue:** `songSlots` is already filtered to `s.kind === 'SONG'` on the line above, so the
second `s.kind === 'SONG' &&` in the `.filter` that computes `filled` is always true and only
exists to satisfy the `SongSlot`/`ServiceSlot` type narrowing for `s.songId`. Harmless, but a
future reader may assume it does more than narrow the type.
**Fix:** Use a type assertion or a typed intermediate (`songSlots as SongSlot[]`) instead of a
redundant runtime re-check, or add a one-line comment noting it's narrowing-only.

---

_Reviewed: 2026-09-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
