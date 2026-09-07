---
phase: 134-editor-presence
plan: 02
subsystem: ui
tags: [vue, firestore, onSnapshot, composable, presence, cost-hardening]

requires:
  - phase: 134-01
    provides: "presence.ts (PresenceDoc, isPresenceStale, PRESENCE_HEARTBEAT_MS, PRESENCE_STALE_TTL_MS) + org-scoped presence rules"
provides:
  - "useServicePresence composable: heartbeat write + onSnapshot subscribe + clock-driven client staleness filter + dual teardown (serviceId change / unmount)"
  - "ServiceEditorView header presence indicator (other current viewers by displayName)"
  - "forced-disconnect/staleness + paused-when-hidden fake-clock test suite"
affects: [135-dashboard-presence-rollup]

tech-stack:
  added: []
  patterns:
    - "Firestore onDisconnect()-less presence: coarse heartbeat + client-side soft-TTL filter (nowMs tick) as the real-time correctness mechanism"
    - "watch(serviceId, {immediate:true}) + onUnmounted dual teardown for a Router-reused view instance"
    - "Page Visibility gating of a recurring write for cost discipline"

key-files:
  created:
    - src/composables/useServicePresence.ts
    - src/composables/__tests__/useServicePresence.test.ts
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.confirmations.test.ts
    - src/views/__tests__/ServiceEditorView.stage.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/views/__tests__/hymnRetirement.regression.test.ts

key-decisions:
  - "Composable-level presentViewers includes ALL live viewers (including self); the view filters out the current user's own uid — keeps the composable reusable for Phase 135's dashboard roll-up, which may want the full set"
  - "Stubbed useServicePresence in the four ServiceEditorView test files unrelated to presence (mirrors the existing VolunteerServiceView.test.ts composable-stub convention), rather than editing 15+ exact setDoc-call-count assertions in ServiceEditorView.test.ts — the presence heartbeat's own setDoc call would otherwise shift every one of those indices by one"
  - "nowMs staleness tick set to 10s (well under the 60s TTL) so a forced-disconnect clears within ~10s of going stale, matching the plan's acceptance criteria"

patterns-established:
  - "Presence read shape (uid + displayName, filtered by clock-driven staleness) is reusable as-is by Phase 135's dashboard roll-up per 134-CONTEXT.md's deferred note"

requirements-completed: [R422]

coverage:
  - id: D1
    description: "useServicePresence composable heartbeats (immediate + ~30s interval), paused while document.hidden, resuming on visibilitychange"
    requirement: "R422"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useServicePresence.test.ts#writes the own presence doc immediately on start, before any timer advance"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useServicePresence.test.ts#PAUSED-WHEN-HIDDEN — no setDoc fires during a heartbeat interval while hidden; resumes on visibilitychange"
        status: pass
    human_judgment: false
  - id: D2
    description: "presentViewers filters staleness via a clock-driven nowMs tick (forced-disconnect: a viewer drops out with no new snapshot once the clock passes the TTL)"
    requirement: "R422"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useServicePresence.test.ts#FORCED DISCONNECT — a stale viewer drops out purely from the clock advancing, with NO new snapshot"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dual teardown deletes the own presence doc on serviceId change (watch, immediate) AND on unmount, and unsubscribes the snapshot both times"
    requirement: "R422"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useServicePresence.test.ts#TEARDOWN — a serviceId change deletes the OLD doc; unmount deletes again + unsubscribes"
        status: pass
    human_judgment: false
  - id: D4
    description: "ServiceEditorView header shows other current viewers by displayName (escaped text interpolation only), guarded on orgId+serviceId, collapsing when nobody else is present"
    requirement: "R422"
    verification:
      - kind: unit
        ref: "npm run type-check (clean) + npx vitest run (216/217 files pass, baseline unchanged)"
        status: pass
    human_judgment: true
    rationale: "The two-browser 'who's here appears/disappears live' UX is the plan's own human-check verification step; this milestone runs UAT-deferred (see Deferred UAT below)."

duration: 30min
completed: 2026-09-07
status: complete
---

# Phase 134 Plan 02: Editor Presence Composable + Header Indicator Summary

**`useServicePresence` composable — coarse heartbeat paused when hidden, onSnapshot subscribe, clock-driven client-side staleness filter (no Firestore onDisconnect), and dual teardown — wired into the ServiceEditorView header as a "who's here" indicator.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-07T15:50Z
- **Completed:** 2026-09-07T16:20Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `useServicePresence` composable: writes/refreshes the current user's own presence doc immediately + every `PRESENCE_HEARTBEAT_MS`, paused while the tab is hidden (Page Visibility); subscribes via `onSnapshot`; `presentViewers` is a computed filtered by a clock-driven `nowMs` tick against `isPresenceStale` — a stale doc drops out with NO new snapshot required (the forced-disconnect correctness mechanism, since Firestore has no `onDisconnect()`)
- Dual teardown: `watch(serviceId, {immediate:true})` deletes the OLD service's own doc on a Router-reused-instance service-to-service navigation; `onUnmounted` deletes the own doc + clears both intervals + removes the visibility listener
- Fake-clock test suite proving: immediate first write, forced-disconnect staleness (clock advances past TTL with no new snapshot), paused-when-hidden (no setDoc while `document.hidden`, resumes on `visibilitychange`), and dual teardown (serviceId change + unmount)
- ServiceEditorView header indicator: a dot + comma-joined name list of other current viewers, guarded on orgId+serviceId+signed-in-user, collapsing to nothing when alone, rendered via `{{ }}` text interpolation only (never v-html, per T-134-05)
- Fixed a real cross-file regression the new composable's always-on heartbeat introduced in four pre-existing ServiceEditorView test files (see Deviations)

## Task Commits

Each task was committed atomically:

1. **Task 1: useServicePresence composable** - `ad91ca93` (feat)
2. **Task 2: forced-disconnect + cost-behavior test** - `2bcdaa63` (test)
3. **Task 3: ServiceEditorView header presence indicator wiring** - `3de7a829` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/composables/useServicePresence.ts` - heartbeat + onSnapshot + client staleness + dual teardown composable
- `src/composables/__tests__/useServicePresence.test.ts` - 5-test fake-clock evidence suite
- `src/views/ServiceEditorView.vue` - imports + mounts `useServicePresence`; header indicator template + `otherPresentViewers` computed
- `src/views/__tests__/ServiceEditorView.confirmations.test.ts` - stubbed `useServicePresence` (out of scope for this file)
- `src/views/__tests__/ServiceEditorView.stage.test.ts` - stubbed `useServicePresence` (out of scope for this file)
- `src/views/__tests__/ServiceEditorView.test.ts` - stubbed `useServicePresence` (out of scope for this file's 15+ exact-`setDoc`-count assertions)
- `src/views/__tests__/hymnRetirement.regression.test.ts` - stubbed `useServicePresence` (out of scope for this file)

## Decisions Made
- `presentViewers` at the composable level includes ALL live viewers (self included); the VIEW is responsible for excluding the current user's own uid — keeps the presence read shape generically reusable for Phase 135's dashboard roll-up (134-CONTEXT.md's deferred note), which may want a different self-inclusion policy.
- Staleness recompute tick set to 10s (`NOW_TICK_MS`), well under the 60s `PRESENCE_STALE_TTL_MS`, so a forced disconnect clears within ~10s — matches the plan's "~60s soft-TTL, forced-disconnect visible quickly" intent without being so frequent it costs anything (it's a local `setInterval`, not a Firestore read).
- `watch(() => toValue(serviceId), ...)` is the ONLY reactive re-init trigger (not `[orgId, serviceId]`) per the plan's literal spec — org does not change independently of a service switch in this app's editor route, so this stays a single-source watch exactly as written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The new composable's always-on mount-time heartbeat write broke 4 pre-existing ServiceEditorView test files**
- **Found during:** Task 3 (ServiceEditorView header wiring) — running the full `npx vitest run` verification step per the plan's own `<verification>` block
- **Issue:** `useServicePresence` is now unconditionally invoked in `ServiceEditorView`'s `setup()`. In `ServiceEditorView.confirmations.test.ts`, `ServiceEditorView.stage.test.ts`, and `hymnRetirement.regression.test.ts`, the shared `firebase/firestore` mock did not export `deleteDoc` at all, throwing `No "deleteDoc" export is defined on the "firebase/firestore" mock` on unmount/serviceId-change. In `ServiceEditorView.test.ts`, `setDoc` WAS mocked, so the composable's own mount-time heartbeat wrote silently — but that file has 15+ assertions like `expect(mockSetDoc).toHaveBeenCalledTimes(1)` and `mockSetDoc.mock.calls[0]![1]` reading a specific payload, all of which the presence write's extra call would have shifted by one or corrupted.
- **Fix:** Stubbed `useServicePresence` to a constant `{ presentViewers: ref([]) }` in all four files via `vi.mock('@/composables/useServicePresence', ...)`, matching the codebase's existing precedent for stubbing an unrelated composable in a focused test file (e.g. `VolunteerServiceView.test.ts`'s `vi.mock('@/composables/useVolunteerServiceDoc', ...)`). This is architecturally correct, not a workaround: these four files test confirmations/stage/lock-flow/hymn-retirement behavior, none of which concern presence.
- **Files modified:** `src/views/__tests__/ServiceEditorView.confirmations.test.ts`, `src/views/__tests__/ServiceEditorView.stage.test.ts`, `src/views/__tests__/ServiceEditorView.test.ts`, `src/views/__tests__/hymnRetirement.regression.test.ts`
- **Verification:** Full `npx vitest run` returns to the documented baseline — 216/217 files passing, 5579 tests passing, the only failure being the pre-existing, documented `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation, unrelated to this phase).
- **Committed in:** `3de7a829` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug: a real cross-file test regression, not a pre-existing failure)
**Impact on plan:** Necessary fix to satisfy the plan's own verification requirement ("`npx vitest run` shows the known baseline only — no regression from the view wiring"). No scope creep — no production behavior changed, only test isolation.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Deferred UAT

Per the milestone's autonomous/UAT-deferred mode, Task 3's `<human-check>` verification step is NOT run here:

> Open the same service in two browser profiles (two org members). Each header names the other viewer within ~30s. Close/navigate one away; it disappears from the other's header within ~60s.

Code-side evidence for this behavior is complete and green (see coverage D1-D3's automated tests plus D4's type-check/vitest-baseline evidence). The live two-browser "who's here" demo is deferred to a later owner UAT pass and is NOT logged to `.planning/v2.14-DEFERRED-VERIFICATION.md` per this run's instructions — it is simply noted here as complete-but-unverified-live.

## Next Phase Readiness
- `useServicePresence`'s `presentViewers` read shape (uid + displayName, live/non-stale) is ready for Phase 135's dashboard editor-presence roll-up (R418) to reuse directly.
- Phase 134 Plan 03 (cleanup cron backstop, R423) already executed prior to this plan per STATE.md; Plan 02 was the last incomplete plan in this phase.

---
*Phase: 134-editor-presence*
*Completed: 2026-09-07*

## Self-Check: PASSED

All created/modified files verified present on disk; all three task commit hashes (`ad91ca93`, `2bcdaa63`, `3de7a829`) verified present in git log.
