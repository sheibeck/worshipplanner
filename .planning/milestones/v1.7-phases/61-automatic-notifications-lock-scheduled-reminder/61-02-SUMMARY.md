---
phase: 61-automatic-notifications-lock-scheduled-reminder
plan: 02
subsystem: infra
tags: [firebase-functions, onSchedule, cron, reminders, timezone, idempotency, collectionGroup, resend]

# Dependency graph
requires:
  - phase: 61-01
    provides: "todayInTimeZone / minusDays org-tz date helpers and the 'lock-notification' MessageType"
  - phase: 59-02
    provides: "shared createQueuedMessage() doc-shaper + messages/{id} write shape"
  - phase: 59-03
    provides: "sendQueuedMessage onDocumentCreated trigger — the single RESEND_API_KEY holder that renders + sends any queued message"
provides:
  - "sendScheduledRemindersHandler — the R145 reminder engine body (exported for unit test)"
  - "sendScheduledReminders — the daily 04:00 UTC onSchedule cron wrapper (built/tested/UNDEPLOYED, holds NO secret)"
  - "REMINDER_MAX_DAYS_BEFORE code-side lookahead bound (366)"
  - "ReminderSummary { scanned, enqueued } return type"
affects: [62-relock-notification, verify-work-61, deploy-functions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onSchedule cron: handler body exported separately from the wrapper, broad collectionGroup status-in scan, per-item try/catch, org recovered from parent chain (mirrors cleanupOrphanRendersHandler)"
    - "org-local calendar-day due check via minusDays(service.date, N) === todayInTimeZone(org tz, now)"
    - "reminderSentAt idempotency marker written via Admin-SDK dot-path merge (bypasses the Phase 58 draft-only /services rule so it lands on a LOCKED service)"

key-files:
  created: []
  modified:
    - "functions/src/index.ts — sendScheduledRemindersHandler + sendScheduledReminders wrapper + ReminderSummary/OrgReminderData/ServiceMessagingFields types + REMINDER_MAX_DAYS_BEFORE"
    - "functions/src/index.test.ts — describe('sendScheduledRemindersHandler') with 16 cases incl. the R133 tz boundary and SC4 no-double-send"

key-decisions:
  - "Idempotency ordering: set reminderSentAt AFTER a successful enqueue (per research §Idempotency / CONTEXT). Leaves a rare crash-between-writes double-send window at daily cadence; the claim-first transactional upgrade is documented below as future hardening (research A5 / Open Question 1)."
  - "Read org messaging from settings.messaging.* and the zone from settings.timezone — NOT messaging.* (research Pitfall 2)."
  - "NO new Firestore index — the single-field status-in collection-group scan is the same class as the shipped pptxRenders scan; the ~30-day/366-day lookahead is a CODE filter (REMINDER_MAX_DAYS_BEFORE), not a query filter."
  - "The cron holds NO secret and gets NO secrets: array — it only enqueues; RESEND_API_KEY binds solely to sendQueuedMessage (R131 smallest key-holding surface)."
  - "04:00 UTC daily slot, offset from cleanupExpiredMedia (02:00) and cleanupOrphanRenders (03:00) so the three sweeps never overlap."

patterns-established:
  - "Cron enqueues through the SAME createQueuedMessage → messages/{id} → sendQueuedMessage path as a human send, so a cron reminder is byte-identical to a composer send at the trigger."

requirements-completed: [R145]

coverage:
  - id: D1
    description: "A due (org-tz N-days-before) planned/exported service enqueues exactly one type:'reminder' message (includeEveryone, attachServiceLink, requestedByUid:'system') and sets messaging.reminderSentAt after the enqueue"
    requirement: "R145"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#enqueues exactly one type:'reminder' message AND sets reminderSentAt for a due planned service"
        status: pass
    human_judgment: false
  - id: D2
    description: "SC4 never-on-draft: a 'draft' service is structurally excluded by the where('status','in',['planned','exported']) scan"
    requirement: "R145"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#SC4: a 'draft' service is never returned by the scan -- the where filter excludes it, no reminder"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC4 no-double-send: an already-marked service enqueues zero, and a second same-window run against a just-marked service creates no additional message"
    requirement: "R145"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#★ SC4 no-double-send: a SECOND run in the same window against a just-marked service enqueues ZERO new messages"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#SC4: a service whose reminderSentAt is already set enqueues ZERO messages"
        status: pass
    human_judgment: false
  - id: D4
    description: "R133/SC3 org-timezone boundary: the same UTC instant + same service.date fires in America/Chicago but not in Pacific/Kiritimati (org-local calendar day)"
    requirement: "R145"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#R133/SC3 org-timezone boundary: the SAME instant + SAME service.date fires in Chicago but NOT in Kiritimati"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#mirror boundary: a Kiritimati service dated to be due in ITS zone fires while the Chicago-dated one does not"
        status: pass
    human_judgment: false
  - id: D5
    description: "Skips: org kill-switch off (settings.messaging.enabled !== true), missing org doc, effectiveReminderEnabled off, not-due; effectiveN resolves service-then-org-then-7"
    requirement: "R145"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#skips when the org kill-switch is off (settings.messaging.enabled !== true) -- fail-closed"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#effectiveN uses the service-level reminderDaysBefore over the org default"
        status: pass
      - kind: unit
        ref: "functions/src/index.test.ts#effectiveN falls back to 7 when neither the service nor the org sets reminderDaysBefore"
        status: pass
    human_judgment: false
  - id: D6
    description: "Per-item try/catch tolerance: one service that throws (malformed date) is logged and skipped; other candidates in the same run still enqueue; missing parent-chain org id is skipped"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#per-item try/catch: one service that throws (malformed date) is skipped; other candidates still enqueue"
        status: pass
    human_judgment: false
  - id: D7
    description: "Structural invariants: scan is planned/exported (never draft), wrapper is 04:00 UTC, and carries no secrets: array"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#★ SOURCE INSPECTION: the scan is planned/exported (never draft), the wrapper is 04:00 UTC, and it holds NO secret"
        status: pass
    human_judgment: false
  - id: D8
    description: "sendScheduledReminders deployed and a real reminder email arrives N days before a service, reckoned in the org-local timezone"
    requirement: "R145"
    verification: []
    human_judgment: true
    rationale: "Ships built/tested/UNDEPLOYED under the v1.7 grant against a mocked provider. Deploy (firebase deploy --only functions:sendScheduledReminders) and the real org-local live send are owner UAT at /gsd-verify-work 61 (verification_deferred_human) — no automated test can send a real email or exercise Cloud Scheduler."

# Metrics
duration: 14 min
completed: 2026-08-14
status: complete
---

# Phase 61 Plan 02: sendScheduledReminders daily cron Summary

**R145 reminder engine — a daily 04:00 UTC onSchedule Cloud Function that auto-enqueues the shared service link to everyone assigned N days before a planned/exported service, reckoned in the org's local timezone, exactly once; built/tested against a mocked provider and UNDEPLOYED.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-14T19:48:10Z
- **Completed:** 2026-08-14T20:02:31Z
- **Tasks:** 1 (TDD)
- **Files modified:** 2

## Accomplishments
- `sendScheduledRemindersHandler(now)` mirrors `cleanupOrphanRendersHandler` exactly: a broad `collectionGroup('services').where('status','in',['planned','exported'])` scan (never `draft`), org id recovered from the parent chain, per-item try/catch so one bad service never aborts the daily run, handler body exported separately for direct unit test.
- Due check (R133/SC3): a candidate fires only when `minusDays(service.date, effectiveN) === todayInTimeZone(org.settings.timezone, now)` — org-local calendar-day granularity via the 61-01 helpers. Proven load-bearing by a two-zone test: the same instant + same service date fires in America/Chicago but not Pacific/Kiritimati.
- Resolution reads `settings.messaging.*` (not `messaging.*`): fail-closed kill-switch (`enabled === true`), `effectiveReminderEnabled = service ?? org`, `effectiveN = service ?? org ?? 7`.
- Enqueues via the SHARED `createQueuedMessage({ type:'reminder', includeEveryone:true, attachServiceLink:true, requestedByUid:'system', scheduledFor:null })` → `messages/{id}.set(...)`, byte-identical to a human send, then sets `messaging.reminderSentAt` via an Admin-SDK dot-path merge (bypasses the Phase 58 draft-only rule so it lands on a LOCKED service).
- SC4 idempotency: an already-marked service enqueues zero, and a second same-window run against a just-marked service creates no additional message.
- The `sendScheduledReminders` onSchedule wrapper runs at 04:00 UTC (offset from 02:00/03:00) and carries NO `secrets:` array — the cron only enqueues; `RESEND_API_KEY` binds solely to `sendQueuedMessage`.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 (RED): failing tests for the reminder cron** - `a3dc6948` (test)
2. **Task 1 (GREEN): sendScheduledRemindersHandler + wrapper** - `1585e1a4` (feat)

**Plan metadata:** committed separately (docs: complete plan).

_No REFACTOR commit — the GREEN implementation was already minimal and clean._

## Files Created/Modified
- `functions/src/index.ts` - Added `REMINDER_MAX_DAYS_BEFORE`, `ReminderSummary`, `ServiceMessagingFields`/`OrgReminderData` types, `sendScheduledRemindersHandler`, and the `sendScheduledReminders` 04:00 UTC onSchedule wrapper (no secrets array).
- `functions/src/index.test.ts` - Added the `describe('sendScheduledRemindersHandler')` block (16 cases) with a `mockServicesDb` collectionGroup+org-read+messages-enqueue fake, mutable `fakeServiceDoc` (ref.set reflects into data() for the SC4 second-run proof), and `vi.useFakeTimers()`/`setSystemTime` pinning.

## Gate Output

- `cd functions && npx vitest run src/index.test.ts` → **Test Files 1 passed (1); Tests 139 passed (139)**.
- `cd functions && npm test` (full functions suite) → **Test Files 8 passed (8); Tests 240 passed (240)**.
- `cd functions && npm run build` (tsc) → **exit 0, clean** (after the D-below deviation fix).
- `npx vitest run` (root app suite) → **Test Files 2 failed | 112 passed (114); Tests 13 failed | 3487 passed (3500)** — the 2 failed files are exactly the documented known-failing baseline: `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation, CLAUDE.md) and `src/views/__tests__/RosterView.test.ts` (stale "Roles config" assertion). No new regressions; this plan touches only `functions/`. Duration ~292s (a timeout would not have been a failure).

Explicit confirmations requested:
- **SC4 second-run-enqueues-zero** — PASS (`★ SC4 no-double-send: a SECOND run in the same window against a just-marked service enqueues ZERO new messages`, plus the already-marked-enqueues-zero case).
- **SC2 draft-excluded / off-skip** — PASS (`SC4: a 'draft' service is never returned by the scan …`; kill-switch-off, reminder-off, org-default-off, and not-due skip cases all green).

## Decisions Made
See `key-decisions` frontmatter. The load-bearing one: `reminderSentAt` is written AFTER the enqueue (see the idempotency note below).

## Idempotency ordering — known crash-window and future hardening (carried from plan-check WARNING)

The handler writes `messaging.reminderSentAt` **after** a successful `createQueuedMessage` enqueue. This is the ordering the research §Idempotency / CONTEXT specified, and it satisfies SC4's **same-window** no-double-send guarantee, which is what this plan proves: the skip-if-`reminderSentAt`-set guard runs before any work, so a second handler run in the same daily window against a service the first run marked enqueues **zero** new messages (asserted by the `★ SC4 no-double-send` test).

The residual gap is a **crash-between-writes window**: if the process dies after `messageRef.set(...)` lands but before `svcDoc.ref.set({ messaging: { reminderSentAt } })` lands, the next daily run would see an unmarked-but-already-enqueued service and enqueue a second reminder. At daily cadence this is a rare single duplicate, never a lost reminder (fail-toward-delivery). 

**Future hardening (claim-first transactional upgrade, research A5 / Open Question 1):** flip the order to *claim then send* inside a `runTransaction` — read the service, assert `reminderSentAt` unset, write the marker, and only enqueue on a committed claim (the same `queued→sending` claim pattern `sendQueuedMessageHandler` already uses). That closes the window at the cost of a transaction per candidate. Deferred; not required for SC4 as scoped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the org-doc TypeScript interface shape**
- **Found during:** Task 1 (GREEN, `npm run build`)
- **Issue:** The org-read type was first declared as the `settings.messaging` *leaf* (`OrgReminderSettings`) but the handler casts `orgSnap.data()` (the whole org doc) and accesses `org.settings.messaging` → three `TS2339: Property 'settings' does not exist` errors; `tsc` failed.
- **Fix:** Renamed to `OrgReminderData` and nested the fields under a `settings?: { timezone?, messaging? }` wrapper matching the actual doc shape; updated the two references.
- **Files modified:** functions/src/index.ts
- **Verification:** `npm run build` exit 0 clean; `npm test` 240/240 green (no test change needed — behavior unchanged).
- **Committed in:** `1585e1a4` (part of the GREEN task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — a type-only correction).
**Impact on plan:** Type-shape fix only; no behavior change, no scope creep. All plan invariants (no new package, no new index, no secret, no deploy) held.

## Issues Encountered
None beyond the type-shape fix above.

## User Setup Required
None in-repo. The owner deploy step is recorded in `.planning/PENDING-VERIFICATION.md` (see below) — do NOT mark passed.

## Next Phase Readiness
- The R145 reminder engine is complete, built, unit-tested, and UNDEPLOYED. Ready for `62` (relock-notification, which appends a `'relock-notification'` type the same way) and for owner deploy + `/gsd-verify-work 61`.
- **Deploy handover (PENDING-VERIFICATION):** `firebase deploy --only functions:sendScheduledReminders`. NO new index is needed (single-field collection-group scan); the single-field `services.status` COLLECTION_GROUP fieldOverride is the documented contingency only if a real deploy throws `FAILED_PRECONDITION` (research A3). NO new secret (the cron only enqueues).

## Self-Check: PASSED

- `functions/src/index.ts` + `functions/src/index.test.ts` modified and on disk.
- Commits verified in git log: `a3dc6948` (test/RED), `1585e1a4` (feat/GREEN), `a225daf8` (docs/metadata).
- SUMMARY.md present at `.planning/phases/61-automatic-notifications-lock-scheduled-reminder/61-02-SUMMARY.md`.

---
*Phase: 61-automatic-notifications-lock-scheduled-reminder*
*Completed: 2026-08-14*
