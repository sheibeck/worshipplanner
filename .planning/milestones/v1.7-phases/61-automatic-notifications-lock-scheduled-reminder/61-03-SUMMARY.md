---
phase: 61-automatic-notifications-lock-scheduled-reminder
plan: 03
subsystem: api
tags: [firebase-functions, firestore, onSchedule, onDocumentCreated, transaction, messaging, cron]

# Dependency graph
requires:
  - phase: 61-02
    provides: the sendScheduledReminders onSchedule wrapper this dispatch sweep is wired into
  - phase: 59-02
    provides: createQueuedMessage shaper + the composer that writes status:'scheduled' docs
  - phase: 59-03
    provides: sendQueuedMessage onDocumentCreated trigger + its queued->sending transactional claim precedent
provides:
  - dispatchDueScheduledMessagesHandler — dispatches due user-scheduled messages by creating a fresh queued doc
  - schedule-for-later dispatch half of R141 (Phase 59 carryover completed)
  - a second sweep sharing the one daily sendScheduledReminders cron, fault-isolated in its own try/catch
affects: [verify-work 61, phase 62 relock-notification, messaging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onDocumentCreated re-fire via fresh-doc create: to (re)trigger an onDocumentCreated handler you must CREATE a new doc, never flip an existing doc's status"
    - "Two independently fault-isolated sweeps sharing one onSchedule invocation (one Cloud Scheduler job, one deploy), each in its own try/catch"
    - "Transactional scheduled->dispatched claim guard for at-least-once idempotency, mirroring the shipped queued->sending claim"

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "Create a fresh status:'queued' doc via createQueuedMessage (option a) rather than widening sendQueuedMessage to onDocumentWritten — a status flip on the existing doc would NOT re-fire the create trigger"
  - "Single-field collectionGroup('messages').where('status','==','scheduled') scan + code-filter scheduledFor<=now → NO composite Firestore index"
  - "Dispatch sweep folded into the ONE existing sendScheduledReminders onSchedule wrapper, each sweep in its own try/catch — no new wrapper, no new secret"
  - "scheduledFor reader supports BOTH an ISO string (the real composer's shape) and a Firestore Timestamp — a Timestamp-only reader would silently never dispatch any production scheduled message"

patterns-established:
  - "Pattern 1: re-fire an onDocumentCreated trigger by creating a fresh doc, not by mutating the inert one"
  - "Pattern 2: transactional status-claim guard makes a cron sweep idempotent under at-least-once delivery"

requirements-completed: [R141]

coverage:
  - id: D1
    description: "A due scheduled message is transactionally claimed scheduled->dispatched and exactly one fresh status:'queued' doc is created with copied type/subject/body/recipientSelector/options/requestedByUid (scheduledFor:null)"
    requirement: R141
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#a due scheduled message is claimed scheduled->dispatched AND one fresh status:'queued' doc is created with copied fields"
        status: pass
    human_judgment: false
  - id: D2
    description: "Idempotency: a second cron run over an already-'dispatched' doc claims nothing and creates no additional doc (no double-dispatch under at-least-once retry)"
    requirement: R141
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#idempotency: a SECOND run over an already-'dispatched' doc claims nothing and creates NO additional doc"
        status: pass
    human_judgment: false
  - id: D3
    description: "A future-scheduled message (scheduledFor > now) is code-filtered out — neither claimed nor recreated"
    requirement: R141
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#a future-scheduled message (scheduledFor > now) is neither claimed nor recreated (code-filtered)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The dispatch sweep is wired into the existing sendScheduledReminders onSchedule wrapper in its own try/catch — no new onSchedule wrapper, no secret, single-field scan (no composite index)"
    requirement: R141
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#SOURCE: the dispatch sweep is wired into the sendScheduledReminders wrapper in its own try/catch — no new onSchedule wrapper, no secret"
        status: pass
    human_judgment: false
  - id: D5
    description: "A real user-scheduled message actually sends once its time arrives and the daily cron runs (end-to-end email delivery)"
    verification: []
    human_judgment: true
    rationale: "No automated test can send a real email or drive Cloud Scheduler; ships UNDEPLOYED against a mocked provider — owner UAT at /gsd-verify-work 61 after deploy"

# Metrics
duration: 20 min
completed: 2026-08-14
status: complete
---

# Phase 61 Plan 03: Dispatch Due User-Scheduled Messages Summary

**dispatchDueScheduledMessagesHandler claims each due status:'scheduled' message scheduled→dispatched in a Firestore transaction and creates a FRESH status:'queued' doc via createQueuedMessage — a genuine onDocumentCreated that re-fires sendQueuedMessage — completing R141's schedule-for-later dispatch half deferred from Phase 59.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-14
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 2

## Accomplishments
- Added `dispatchDueScheduledMessagesHandler(now)` scanning `collectionGroup('messages').where('status','==','scheduled')` (single-field equality — no composite index) and code-filtering `scheduledFor <= now`.
- Per due message: a Firestore transaction claims the ORIGINAL `scheduled→dispatched` (guard: only if still `'scheduled'`), then — only if claimed — creates a fresh `status:'queued'` doc via the shared `createQueuedMessage` shaper (`scheduledFor:null`, original fields + `requestedByUid` preserved) so `onDocumentCreated` re-fires `sendQueuedMessage`.
- Idempotent under onSchedule at-least-once retry: a second run reads `'dispatched'`, the claim guard fails, and nothing fresh is created (proven in the suite).
- Wired into the EXISTING `sendScheduledReminders` onSchedule wrapper after the reminder sweep, each sweep in its own try/catch — no new wrapper, no new secret, no new Firestore index.

## Task Commits

1. **Task 1 (RED): failing tests for dispatchDueScheduledMessagesHandler** - `6d4c064f` (test)
2. **Task 1 (GREEN): dispatch due user-scheduled messages via fresh queued doc** - `ba031239` (feat)

**Plan metadata:** committed with this SUMMARY (docs)

## Files Created/Modified
- `functions/src/index.ts` - Added `DispatchSummary`, the `scheduledForMillis` reader (ISO-string + Timestamp), `dispatchDueScheduledMessagesHandler`, and wired both sweeps into the `sendScheduledReminders` wrapper with per-sweep try/catch.
- `functions/src/index.test.ts` - Added the `dispatchDueScheduledMessagesHandler` describe block (due dispatch, future-skip, idempotent second run, ISO-string scheduledFor, null-scheduledFor skip, per-item throw tolerated, orphan parent chain, source-inspection wiring).

## Decisions Made
- **Fresh-doc create, not status flip:** flipping the inert `scheduled` doc to `queued` would NOT re-fire the `onDocumentCreated` trigger; the sweep creates a genuine new `queued` doc so `sendQueuedMessage` fires exactly as for a human send (research Pitfall 1 / Key Design Problem).
- **No composite index:** single-field `where('status','==','scheduled')` + a CODE `scheduledFor <= now` filter, matching the reminder scan's no-index class.
- **One cron, two sweeps:** dispatch runs inside the existing `sendScheduledReminders` invocation, so the owner's single `firebase deploy --only functions:sendScheduledReminders` covers it (no separate Function/index).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] scheduledFor reader supports the real ISO-string shape, not just a Timestamp**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan's test fixtures model `scheduledFor` as a `{ toMillis }` Timestamp, but the real 59-02 composer (`queueServiceMessageHandler` → `createQueuedMessage`) persists `scheduledFor` as an **ISO string**. A Timestamp-only reader would match no production scheduled doc and silently never dispatch anything — defeating R141's whole purpose.
- **Fix:** Added `scheduledForMillis(value)` that reads epoch millis from a Firestore Timestamp (`toMillis()`), an ISO string (`Date.parse`), or a `Date`, returning null for absent/unparseable values. Added a dedicated test asserting an ISO-string `scheduledFor` dispatches.
- **Files modified:** functions/src/index.ts, functions/src/index.test.ts
- **Verification:** `functions/src/index.test.ts` case "supports the real composer's ISO-string scheduledFor" passes; full suites green.
- **Committed in:** `ba031239` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical correctness fix)
**Impact on plan:** The fix is essential for the feature to work in production against real composer-written docs; it strictly widens the accepted input and adds a test. No scope creep — still no new package, no new index, no secret.

## Issues Encountered
None — the reminder-sweep fake-builder patterns (collectionGroup scan chain, runTransaction fake, FieldValue sentinel) adapted cleanly to the dispatch sweep.

## Verification Results
- `cd functions && npx vitest run src/index.test.ts` — **147 passed** (1 file). Includes: due scheduled → one fresh queued doc + original marked dispatched; SECOND run creates nothing (idempotent); future-dated skipped; ISO-string scheduledFor dispatches; null-scheduledFor + orphan skipped; per-item throw tolerated; source-inspection wiring.
- `cd functions && npm test` — **248 passed** (8 files) — full functions suite green (additive).
- `cd functions && npm run build` (`tsc`) — clean, no errors.
- `npx vitest run` (root app suite) — **2 failed files / 112 passed (114)**, exactly the documented baseline: `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). This plan touches only `functions/`.
- `firestore.indexes.json` — NOT modified (single-field scan + code filter).

## User Setup Required
None - no external service configuration required by this plan. Deploy/UAT handover recorded in `.planning/PENDING-VERIFICATION.md` (61-03 entry) — NOT marked passed.

## Next Phase Readiness
- R141 schedule-for-later dispatch is built, unit-tested, and UNDEPLOYED against a mocked provider.
- Ships inside the same `sendScheduledReminders` cron — owner deploys once (`firebase deploy --only functions:sendScheduledReminders`); real-send UAT deferred to `/gsd-verify-work 61`.
- No blockers for remaining Phase 61 plans.

## Self-Check: PASSED
- `functions/src/index.ts` contains `export async function dispatchDueScheduledMessagesHandler(` — FOUND.
- `functions/src/index.test.ts` contains the `dispatchDueScheduledMessagesHandler` describe — FOUND.
- Commit `6d4c064f` (test) — FOUND. Commit `ba031239` (feat) — FOUND.
- `firestore.indexes.json` unmodified; no new secret; both sweeps in the one wrapper.

---
*Phase: 61-automatic-notifications-lock-scheduled-reminder*
*Completed: 2026-08-14*
