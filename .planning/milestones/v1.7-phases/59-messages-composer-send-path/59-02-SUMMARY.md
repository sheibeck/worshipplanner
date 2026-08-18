---
phase: 59-messages-composer-send-path
plan: 02
subsystem: infra
tags: [cloud-functions, oncall, messaging, send-path, enqueue, kill-switch, tdd]

# Dependency graph
requires:
  - phase: 59-messages-composer-send-path
    plan: 01
    provides: resend@6.19.0 (functions-only, undeployed) + functions/src/serviceRoles.ts recipient resolver port
  - phase: 58-messages-composer
    provides: settings.messaging.enabled kill-switch + firestore.rules messages create=isOrgEditor (deploy-gated)
provides:
  - queueServiceMessageHandler + queueServiceMessage onCall wrapper (enqueue half of the send path, NO secret)
  - createQueuedMessage() shared pure doc-shaper for messages/{id} (reused by 59-03 and Phase 61 cron)
  - RESEND_API_KEY defineSecret declaration (unbound this plan; binds to sendQueuedMessage in 59-03)
  - exported request/response/doc types (QueueMessageRequest/QueueMessageResponse/QueuedMessageDoc/MessageType/RecipientSelector/MessageOptions/DeliveryCounts)
affects: [59-03, 59-04, sendQueuedMessage, MessageComposer.vue, phase-61-scheduled-cron]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onCall enqueue handler body exported separately from the wrapper for direct unit testing (parsePptxHandler precedent)"
    - "pure createQueuedMessage() doc-shaper so the callable and Phase 61 cron cannot drift the messages/{id} shape (pptxRenderDocRef precedent)"
    - "server-side re-authorization: independent members/{uid} role read + kill-switch re-read, never trusting the client-declared orgId or UI gate"
    - "secret declared but bound only to the single Function that needs it — smallest key-holding surface (R131)"

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "queueServiceMessage carries NO secrets array (bare onCall(handler)) — RESEND_API_KEY stays confined to sendQueuedMessage (59-03); RESEND_API_KEY is exported only so noUnusedLocals does not flag the declared-but-unbound secret"
  - "input validation (auth, required args, type enum, scheduledFor sanity) runs before any Firestore read; membership/role/kill-switch reads follow — matching parsePptxHandler's validate-then-authz ordering"
  - "scheduledFor sanity bounds: 5-min past clock-skew grace, ~1-year (366d) max-ahead window; unparseable/past/absurd-future → invalid-argument"
  - "kill-switch defaults CLOSED: a missing org doc or absent settings.messaging.enabled is treated as OFF (failed-precondition)"
  - "client queueServiceMessage callable wrapper deferred to 59-04 (MessageComposer.vue) per PLAN.md scope + 59-PATTERNS.md — no orphan client file created this plan"

requirements-completed: [R131, R137, R141]

coverage:
  - id: D1
    description: "queueServiceMessageHandler requires request.auth and independently re-reads members/{uid}, rejecting a non-member (wrong org) and a viewer (role not in editor|admin); admin is accepted (R131, T-59-02a/b)"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#queueServiceMessageHandler (unauthenticated / non-member permission-denied / viewer permission-denied / admin accepted)"
        status: pass
    human_judgment: false
  - id: D2
    description: "queueServiceMessageHandler re-reads settings.messaging.enabled server-side and rejects with failed-precondition when off, even for an editor (R131 defense in depth, T-59-02c)"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#queueServiceMessageHandler (kill-switch off rejects, no write)"
        status: pass
    human_judgment: false
  - id: D3
    description: "type enum (oneoff|reminder|share-link) and scheduledFor (past / absurd-future / unparseable) validation → invalid-argument before any write (R137, T-59-02d)"
    requirement: R137
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#queueServiceMessageHandler (bad type, past/far-future/unparseable scheduledFor, missing required field)"
        status: pass
    human_judgment: false
  - id: D4
    description: "createQueuedMessage() shapes the CONTEXT §Data Model messages/{id} doc: status queued (send-now) vs scheduled (scheduledFor set), zeroed deliveryCounts, null changeDiff/sentAt, serverTimestamp createdAt, no undefined leaves (R141)"
    requirement: R141
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#createQueuedMessage (queued vs scheduled, full shape, no-undefined)"
        status: pass
    human_judgment: false
  - id: D5
    description: "a valid send-now request enqueues exactly one messages/{id} under organizations/{orgId}/services/{serviceId}/messages with status queued and returns { messageId }; a scheduled request persists scheduledFor with status scheduled"
    requirement: R141
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#queueServiceMessageHandler (send-now queued enqueue, scheduled enqueue, enqueue path)"
        status: pass
    human_judgment: false
  - id: D6
    description: "the queueServiceMessage onCall wrapper carries NO secrets array — RESEND_API_KEY never binds to this Function (R131 smallest key-holding surface, T-59-02e)"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#queueServiceMessageHandler (SOURCE INSPECTION: wrapper carries no secrets array)"
        status: pass
    human_judgment: false
  - id: D7
    description: "the send Functions ship built + unit-tested + UNDEPLOYED; owner deploys with firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage after setting RESEND_API_KEY and DNS (R131)"
    requirement: R131
    verification: []
    human_judgment: true
    rationale: "Deploy-gated by the v1.7 grant — nothing is deployed and no secret is set this plan. Routed to PENDING-VERIFICATION.md item 59-02; must NOT be marked passed here. Live send is only verifiable after 59-03 + deploy."

# Metrics
duration: 18min
completed: 2026-08-14
status: complete
---

# Phase 59 Plan 02: queueServiceMessage Enqueue Handler Summary

**Added the enqueue half of the send path to `functions/src/index.ts` — `queueServiceMessage` (`onCall`, NO secret) that re-authorizes the caller (independent editor-tier membership re-check), re-reads the org messaging kill-switch server-side, validates the type enum + scheduledFor, then writes ONE `messages/{id}` doc via the shared pure `createQueuedMessage()` shaper and returns its id (R131/R137/R141), all UNDEPLOYED.**

## Performance
- **Duration:** ~18 min
- **Completed:** 2026-08-14
- **Tasks:** 2 (both TDD)
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments
- Added `createQueuedMessage()` — a pure, no-I/O doc-shaper producing the CONTEXT §Data Model `messages/{id}` shape: `status` `'queued'` for send-now vs `'scheduled'` when `scheduledFor` is set, `deliveryCounts: { sent: 0, failed: 0 }`, `changeDiff: null`, `sentAt: null`, `createdAt` = `FieldValue.serverTimestamp()`, with no `undefined` leaves. Factored so 59-03 and Phase 61's cron shape the doc identically (R141).
- Added `queueServiceMessageHandler` (exported) + `queueServiceMessage = onCall(queueServiceMessageHandler)`, mirroring the `parsePptxHandler`/`parsePptx` split so the handler body is directly unit-testable with a fake `CallableRequest`.
- Server-side re-authorization (R131): auth guard → independent `members/{uid}` read (non-member → `permission-denied`) → role re-check (`editor`/`admin` only; viewer → `permission-denied`) → org kill-switch re-read (`settings.messaging.enabled` !== true → `failed-precondition`). The client-declared `orgId` only scopes the Firestore path; membership and role are re-verified for THAT path.
- Input validation (R137): required-arg check, three-type enum (`oneoff|reminder|share-link`), and `scheduledFor` sanity (unparseable / past-beyond-grace / >~1-year-ahead) all → `invalid-argument` before any Firestore work.
- Declared `RESEND_API_KEY` (`defineSecret`) alongside the existing secrets and extended the set-once doc-comment, **bound to no Function this plan** — `queueServiceMessage`'s wrapper carries no `secrets:` array. The secret binds only to `sendQueuedMessage` (59-03), the smallest key-holding surface (R131).
- Exported the request/response/doc types (`QueueMessageRequest`, `QueueMessageResponse`, `QueuedMessageDoc`, `MessageType`, `RecipientSelector`, `MessageOptions`, `DeliveryCounts`) for 59-03/59-04 reuse.

## Task Commits
1. **Task 1 (TDD RED):** failing tests for `createQueuedMessage` — `58897dd` (test)
2. **Task 1 (TDD GREEN):** `createQueuedMessage` shaper + types + `RESEND_API_KEY` declaration — `5b08e76` (feat)
3. **Task 2 (TDD RED):** failing tests for `queueServiceMessageHandler` — `d6867bf4` (test)
4. **Task 2 (TDD GREEN):** `queueServiceMessageHandler` + `onCall` wrapper — `86da8a9` (feat)

No REFACTOR commits — both GREEN implementations were already clean.

## Gate Output

**Functions unit suite (target file)** — `cd functions && npx vitest run src/index.test.ts`:
```
 Test Files  1 passed (1)
      Tests  76 passed (76)
```

**Functions build (tsc clean, noUnusedLocals)** — `cd functions && npm run build`:
```
> build
> tsc
(exit 0, no diagnostics)
```

**Full functions suite (no regression)** — `cd functions && npm test`:
```
 Test Files  6 passed (6)
      Tests  149 passed (149)
```

**Root app suite (stays at the 2-file known-failing baseline)** — `npx vitest run`:
```
 Test Files  2 failed | 106 passed (108)
      Tests  13 failed | 3340 passed (3353)
```
The 2 failing files are exactly the documented baseline — `src/storage.rules.test.ts`
(Storage-emulator cross-service `firestore.exists()` limitation / no emulator up) and
`src/views/__tests__/RosterView.test.ts` (stale "Roles config" assertion). This plan's diff
touched **only** `functions/src/index.ts` and `functions/src/index.test.ts` (a separate package
not collected by the root `src/` run), so it cannot have regressed a `src/` test; the aggregate
count matches the baseline signature.

**Client type-check:** not run — no client wrapper file was added or modified this plan (see Decisions).

## Files Created/Modified
- `functions/src/index.ts` — `RESEND_API_KEY` secret declaration; `MessageType`/`RecipientSelector`/`MessageOptions`/`QueueMessageRequest`/`QueueMessageResponse`/`DeliveryCounts`/`QueuedMessageDoc` types; `createQueuedMessage()` shaper; `queueServiceMessageHandler` + `queueServiceMessage` wrapper (modified)
- `functions/src/index.test.ts` — `createQueuedMessage` describe block (4 tests) + `queueServiceMessageHandler` describe block (14 tests), mock-everything-at-module-scope discipline reused (modified)

## Decisions Made
- **No client callable wrapper this plan.** The prompt's phase overview mentions a client `queueServiceMessage` wrapper, but PLAN.md's `files_modified` and both tasks are strictly functions-side, and 59-PATTERNS.md places the client wrapper *inside* `MessageComposer.vue` (59-04). Creating a standalone client wrapper now would be an orphan file with no consumer and no test harness, so it is deferred to 59-04. The client type-check gate was therefore not triggered.
- **`queueServiceMessage` uses the bare `onCall(handler)` form** (no options object) to make the absence of a `secrets:` array unambiguous; a source-inspection test pins this so a future edit cannot silently attach `RESEND_API_KEY`.
- **`RESEND_API_KEY` is `export`ed** (unlike the proxy secrets) solely so `noUnusedLocals` does not flag it while it is declared-but-unbound this plan; 59-03 references it in-file when binding it to `sendQueuedMessage`.
- **Validation precedes authz reads** (auth → args → type → scheduledFor → membership → role → kill-switch), matching `parsePptxHandler`'s validate-the-path-before-membership ordering; each branch is covered by an independent test.
- **Kill-switch fails closed** — a missing org doc or absent `settings.messaging.enabled` is treated as OFF.

## Deviations from Plan
None — plan executed as written. No auto-fixes (Rules 1-3) were needed; no architectural decisions (Rule 4) arose. The only judgment call (deferring the client wrapper to 59-04) is a scope clarification consistent with PLAN.md and 59-PATTERNS.md, documented above rather than a deviation.

## Issues Encountered
- Two first-pass `tsc` diagnostics surfaced at the Task 1 build gate and were fixed before committing GREEN: (1) the no-undefined test needed `as unknown as Record<string, unknown>` (a direct cast from `QueuedMessageDoc` is a TS2352 non-overlap error); (2) `MESSAGE_TYPES` was declared in Task 1 but not consumed until Task 2, tripping `noUnusedLocals` — it was removed from Task 1 and reintroduced with the handler in Task 2. Both are inner-loop fixes within the same task, not plan deviations.

## User Setup Required
None runnable this plan — **DEPLOY-GATED**. The send path (this Function + 59-03's `sendQueuedMessage`) ships built, unit-tested, and UNDEPLOYED. Owner steps, routed to `.planning/PENDING-VERIFICATION.md` item 59-02 (and pre-deploy legitimacy re-confirm in item 59-01), to be done once 59-03 lands:
- create the Resend account and `firebase functions:secrets:set RESEND_API_KEY`,
- add the sending-domain SPF / DKIM / DMARC DNS records,
- **deploy both Functions together:** `firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage`.

These must NOT be marked passed here — they are pre-deploy gates.

## Next Phase Readiness
- `createQueuedMessage()` and the exported types are ready for 59-03's `sendQueuedMessageHandler` and Phase 61's scheduled-message cron to reuse without re-shaping the doc.
- `RESEND_API_KEY` is declared and ready for 59-03 to bind to `sendQueuedMessage` via `{ document: "...", secrets: [RESEND_API_KEY] }`.
- The exported `QueueMessageRequest`/`QueueMessageResponse` types are ready for 59-04's client `httpsCallable<QueueMessageRequest, QueueMessageResponse>(functions, 'queueServiceMessage')` wrapper inside `MessageComposer.vue`.
- **Blocker (intentional):** nothing is deployed and no secret is set — the owner completes the PENDING-VERIFICATION 59-01/59-02 pre-deploy steps before the send path goes live.

---
*Phase: 59-messages-composer-send-path*
*Completed: 2026-08-14*

## Self-Check: PASSED
- `functions/src/index.ts::createQueuedMessage` — FOUND
- `functions/src/index.ts::queueServiceMessageHandler` — FOUND
- `functions/src/index.ts::queueServiceMessage` (onCall wrapper) — FOUND
- Commit `58897dd` (test RED, createQueuedMessage) — FOUND
- Commit `5b08e76` (feat GREEN, createQueuedMessage + RESEND_API_KEY) — FOUND
- Commit `d6867bf4` (test RED, queueServiceMessageHandler) — FOUND
- Commit `86da8a9` (feat GREEN, queueServiceMessageHandler) — FOUND
