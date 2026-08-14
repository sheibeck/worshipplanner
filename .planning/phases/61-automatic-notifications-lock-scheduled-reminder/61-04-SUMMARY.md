---
phase: 61-automatic-notifications-lock-scheduled-reminder
plan: 04
subsystem: ui
tags: [vue, firestore, firebase-functions, messaging, lock-notification, tdd]

# Dependency graph
requires:
  - phase: 61-01
    provides: "'lock-notification' as an accepted MessageType (server MESSAGE_TYPES)"
  - phase: 58
    provides: "org + per-service messaging defaults (settings.messaging.lockNotifyDefault, service.messaging.lockNotifyEnabled) and the lockSnapshots write rule (write=isOrgEditor)"
  - phase: 59
    provides: "queueServiceMessage callable + the MessageComposer QueueMessageRequest shape; resolveRecipients client resolver"
provides:
  - "onMarkAsPlanned client hook: writes services/{id}/lockSnapshots/current on EVERY lock (snapshot + slideGroupsFingerprint:null) for Phase 62 to diff"
  - "gated first-lock auto-enqueue of one type:'lock-notification' via queueServiceMessage (first-lock-only, messaging-on, effective-lock-notify-on, >=1 reachable)"
  - "non-blocking post-lock side-effect posture: a failed enqueue never re-raises into lifecycleError; drives the amber lockNotify 'error' state"
  - "subordinate aria-live=polite lock-banner confirmation line (sent/none-reachable/error states + Open Messages fallback link)"
affects: [phase-62-relock-diff-prompt, gsd-verify-work-61]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-transition side-effect in its own try/catch, never re-raised (mirrors bumpScheduledSongsLastUsed) — the lock succeeded, a secondary email failure is amber-informational not a red lock-failure"
    - "Read-before-write first-lock detection (getDoc existence BEFORE setDoc)"
    - "Client sends only the recipientSelector (includeEveryone) as intent; the server re-resolves + re-checks the kill-switch (no email list or provider key client-side)"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "lockedByUid uses authStore.user?.uid ?? null — the auth store exposes `user` (a ref), not a `uid` getter as the plan shorthand implied"
  - "lockNotify is a transient ref auto-cleared ~6s after set (toast-parity), also cleared on Reopen and unmount"
  - "slideGroupsFingerprint written as null — deferred to Phase 62 (buildServiceSnapshot carries no slide text)"

patterns-established:
  - "Amber-informational confirmation line hosted in an existing banner rather than the failure-only ToastHost (which hardcodes a red 'Save failed.' prefix)"

requirements-completed: [R144]

coverage:
  - id: D1
    description: "First-lock hook writes lockSnapshots/current on every lock (read-before-write) and gated-enqueues one lock-notification only on a first lock (messaging on + effective lock-notify on + >=1 reachable); re-lock/off/default-off/zero-reachable never enqueue; a failed enqueue leaves the lock succeeded (lifecycleError null) and never re-raises"
    requirement: R144
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#first-lock auto-notification (R144, 61-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lock-banner confirmation line renders per state: 'Notified N assigned volunteer(s).' (pluralized, aria-live polite, amber-200), muted zero-reachable line, muted error line with an Open Messages button that opens the composer, and nothing on a re-lock (lockNotify null)"
    requirement: R144
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#first-lock auto-notification (R144, 61-04) — banner render specs"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real lock email sends end-to-end to assigned volunteers (roles/song-list/service-link) and the amber banner renders correctly in the live app; SC2 by eyeball (messaging-off/default-off/re-lock send nothing)"
    verification: []
    human_judgment: true
    rationale: "The client calls the UNDEPLOYED queueServiceMessage (a real send needs the still-open 59-01/59-03 deploy gates); no automated test can send a real email or judge the live banner visual. Deferred to /gsd-verify-work 61 (recorded in PENDING-VERIFICATION.md)."

# Metrics
duration: 35min
completed: 2026-08-14
status: complete
---

# Phase 61 Plan 04: CLIENT first-lock hook + banner confirmation Summary

**Locking a draft service the first time now writes lockSnapshots/current and, behind the Phase 58 messaging gates, auto-enqueues one lock-notification via queueServiceMessage — surfaced by a subordinate amber aria-live confirmation line whose failure never misreports the successful lock.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-14
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 (2 source + PENDING-VERIFICATION)

## Accomplishments
- `onMarkAsPlanned` now, AFTER the transition lands, reads `services/{id}/lockSnapshots/current` (read-before-write first-lock detection) then writes it on EVERY lock (`snapshot` + `slideGroupsFingerprint:null` + `lockedAt` + `lockedByUid`) so Phase 62 has a prior snapshot to diff.
- On a FIRST lock only, behind `isMessagingEnabled()` + effective `lockNotifyEnabled ?? lockNotifyDefault` + `>=1` reachable recipient, the hook enqueues exactly one `type:'lock-notification'` via `httpsCallable(functions,'queueServiceMessage')` sending only the `includeEveryone` selector (never an email list).
- The whole snapshot-write + enqueue block runs in its own try/catch after the lock succeeded; a throw (network, or the server re-reading the kill-switch) drives the amber `lockNotify:'error'` line and is NEVER re-raised into the red `lifecycleError`.
- A subordinate `aria-live="polite"` `lock-notify-confirmation` line inside the existing `service-lock-banner` renders "Notified N assigned volunteer(s)." (pluralized), a muted zero-reachable line, a muted error line with an `Open Messages` button that opens the Phase 59 composer, and nothing when `lockNotify` is null.

## Task Commits

Each task followed RED → GREEN:

1. **Task 1 (test): failing tests for the first-lock hook** - `0f63ca55` (test)
2. **Task 1 (feat): lockSnapshots write + gated lock-notification enqueue** - `a9268851` (feat)
3. **Task 2 (test): failing tests for the lock-banner confirmation line** - `fe287e5b` (test)
4. **Task 2 (feat): sent/none-reachable/error confirmation line** - `2d35c68d` (feat)

_TDD: type-fixes to the new test mock typings were folded into the Task 1 feat commit to keep `npm run type-check` (vue-tsc --build) green._

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - Lock hook (`lockNotify` ref + timer helpers + `LOCK_SUBJECT`/`LOCK_BODY` + local `QueueMessageRequest`), the post-transition snapshot-write + gated enqueue block in `onMarkAsPlanned`, the banner confirmation-line markup, and lockNotify clears on Reopen/unmount.
- `src/views/__tests__/ServiceEditorView.test.ts` - New hoisted firestore/functions/messagingRecipients seams, `buildServiceSnapshot` added to the mocked `@/stores/services`, and a 13-spec `first-lock auto-notification (R144, 61-04)` describe block.
- `.planning/PENDING-VERIFICATION.md` - Appended the 61-04 deferred UAT (real lock email + banner visual + SC2 eyeball) — NOT marked passed.

## Decisions Made
- **`lockedByUid: authStore.user?.uid ?? null`** — the plan's `authStore.uid` shorthand does not exist on the store; `user` (a `ref<User|null>`) is the exposed field.
- **Transient `lockNotify`** — auto-cleared ~6s after set (mirrors the 6000ms toast dismiss), and eagerly cleared on Reopen and unmount, so the confirmation reads as a courtesy, not permanent furniture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `authStore.uid` does not exist on the auth store**
- **Found during:** Task 1 (implementing the snapshot write)
- **Issue:** The plan wrote `lockedByUid: authStore.uid`, but `src/stores/auth.ts` exposes `user` (a `ref<User|null>`), not a `uid` getter — `authStore.uid` would be `undefined`.
- **Fix:** Used `authStore.user?.uid ?? null`.
- **Files modified:** src/views/ServiceEditorView.vue
- **Verification:** `npm run type-check` clean; the hook's setDoc payload test passes.
- **Committed in:** a9268851 (Task 1 feat commit)

**2. [Rule 3 - Blocking] Mocked `@/stores/services` lacked `buildServiceSnapshot`**
- **Found during:** Task 1 (test seams)
- **Issue:** The component now imports `buildServiceSnapshot` from `@/stores/services`, which the test fully mocks; without adding it to the mock the import is `undefined` and the hook's snapshot write throws (caught by the outer try/catch → snapshot silently not written), which would make the Task 1 tests unsatisfiable.
- **Fix:** Added a lightweight `mockBuildServiceSnapshot` stub to the `@/stores/services` mock (the plan's test-seam list named only setDoc/functions/httpsCallable).
- **Files modified:** src/views/__tests__/ServiceEditorView.test.ts
- **Verification:** Task 1 sent-path test asserts the setDoc payload carries a `snapshot` object.
- **Committed in:** 0f63ca55 (Task 1 test commit) / a9268851

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking). **Impact on plan:** Both are wiring corrections against the real store/mocking surface; no behavior or scope change. The plan's contract (write on every lock, gated first-lock-only enqueue, non-blocking failure, amber banner states) is delivered exactly.

## Issues Encountered
- Initial `npm run type-check` (vue-tsc --build, which typechecks the test files per CLAUDE.md) surfaced 10 TS errors in the new test mock typings (spread-arg tuples, `never[]` reachable, over-strict getDoc/setDoc return shapes). Fixed by giving the hoisted `vi.hoisted` spies explicit `(...a: unknown[]) => …` signatures and broad return types. Re-ran the scoped suite (13 pass) and the full ServiceEditorView file (309 pass) after the type fixes.

## Verification Results
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — **309 passed** (13 new 61-04 specs). Confirms: first-lock-only enqueue behind the gates; NOT on re-lock / messaging-off / default-off / zero-reachable; lockSnapshots read-before-write + write; a callable-reject leaves status 'planned' + lifecycleError null (non-blocking); banner line states incl. singular/plural + aria-live + Open Messages opens the composer.
- `npm run type-check` — **clean** (vue-tsc --build).
- `npx vitest run` (full app suite) — **3508 passed, 13 failed across 2 files**, exactly the documented known-failing baseline: `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale "Roles config" assertion). No NEW failing file — no regression.

## User Setup Required
None - no external service configuration required this plan. (The real send path remains UNDEPLOYED behind the 59-01/59-03 pre-deploy gates; this plan is client-only.)

## Next Phase Readiness
- Every lock now persists `lockSnapshots/current` (snapshot + `slideGroupsFingerprint:null`), giving Phase 62 the prior snapshot it needs to compute the re-lock diff and its confirm-with-diff prompt.
- Deferred to owner at `/gsd-verify-work 61` (recorded in PENDING-VERIFICATION.md): the real lock email + live banner visual + SC2 eyeball — gated behind the same undeployed send path as 59/60/61-02/61-03. Do NOT mark passed.

## Self-Check: PASSED

- Files verified on disk: `61-04-SUMMARY.md`, `src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts` — all FOUND.
- Commits verified: `0f63ca55`, `a9268851`, `fe287e5b`, `2d35c68d` — all present in git log.

---
*Phase: 61-automatic-notifications-lock-scheduled-reminder*
*Completed: 2026-08-14*
