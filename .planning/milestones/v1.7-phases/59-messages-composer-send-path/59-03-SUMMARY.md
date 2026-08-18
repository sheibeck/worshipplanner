---
phase: 59-messages-composer-send-path
plan: 03
subsystem: infra
tags: [cloud-functions, ondocumentcreated, messaging, send-path, resend, idempotency, token-rendering, tdd]

# Dependency graph
requires:
  - phase: 59-messages-composer-send-path
    plan: 01
    provides: resend@6.19.0 (functions-only) + functions/src/serviceRoles.ts (resolveServiceRoleAssignments + resolveMessageRecipients per-recipient roleNames)
  - phase: 59-messages-composer-send-path
    plan: 02
    provides: createQueuedMessage() shaper, RESEND_API_KEY defineSecret declaration, QueuedMessageDoc/RecipientSelector/MessageOptions types
provides:
  - sendQueuedMessageHandler + sendQueuedMessage onDocumentCreated wrapper (the ONLY Function bound to RESEND_API_KEY)
  - functions/src/messageTokens.ts renderMessageTokens pure token renderer (R138/R139)
  - transactional queued->sending idempotency claim (duplicate/sent/scheduled trigger -> zero resend)
  - server-side recipient re-resolution + per-recipient token render + recipients/{id} writes + deliveryCounts rollup
  - SERVICE_SHARE_BASE_URL + MESSAGE_FROM_ADDRESS defineString configs (tested empty/placeholder defaults)
affects: [phase-60-message-webhook, phase-61-scheduled-cron, MessageComposer.vue, gsd-verify-work-59]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onDocumentCreated handler body exported separately from the secret-bound wrapper (requestPptxRenderHandler precedent) for direct unit testing with Resend mocked"
    - "transactional queued->sending idempotency claim — NEW code (no PPTX analog); a retried/non-queued trigger returns without sending"
    - "server-side re-resolution: the client recipientSelector is who-to-resolve intent only, never the send list (Anti-Pattern 1)"
    - "pure token renderer isolated in its own module so R138/R139 substitution is unit-tested string-in/string-out (no Firestore/Pinia/buildServiceSnapshot)"
    - "per-recipient try/catch resilience so one bad address is a failed recipient, not an aborted batch"

key-files:
  created:
    - functions/src/messageTokens.ts
    - functions/src/messageTokens.test.ts
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Resend mock uses a REGULAR function (not an arrow) in vi.mock('resend') — `new Resend(key)` on an arrow throws 'is not a constructor'; the 59-RESEARCH example arrow form does not actually construct"
  - "defineString mock made NAME-AWARE (SERVICE_SHARE_BASE_URL / MESSAGE_FROM_ADDRESS / fallback) so the three configs don't collide on one shared value; existing PPTX tests keep using fakeRenderServiceUrl via the fallback branch"
  - "{{their_roles}} empty list renders the documented placeholder 'your role' (EMPTY_ROLES_PLACEHOLDER), not a bare empty string — implementer discretion per the plan"
  - "sendCopyToSelf resolves the editor email via getAuth().getUser(requestedByUid).email server-side, appended to the send list as a recipient with roleNames [] and recipientId = the uid; it writes a recipients/{uid} doc and counts in the rollup"
  - "message-level tag ids (orgId/serviceId/messageId) validated tag-safe up front (fail-closed); recipientId validated per recipient (that recipient -> failed)"
  - "two new defineString configs (SERVICE_SHARE_BASE_URL empty default, MESSAGE_FROM_ADDRESS placeholder default) with tested branches; owner sets production values at deploy"

patterns-established:
  - "Name-aware defineString test seam pattern for multiple string configs in one module"
  - "runTransaction fake: tx.get returns a status-mutable message snapshot, tx.update flips the shared status var, so the claim's queued/non-queued branches are both drivable"

requirements-completed: [R131, R138, R139]

coverage:
  - id: D1
    description: "renderMessageTokens purely substitutes {{service_date}}/{{their_roles}}/{{song_list}}/{{service_link}} globally, per-recipient their_roles (R139), empty-safe service_link (A1), leaves unknown tokens verbatim, no-op on token-free templates"
    requirement: R138
    verification:
      - kind: unit
        ref: "functions/src/messageTokens.test.ts#renderMessageTokens (13 cases incl per-recipient divergence, empty placeholder, unknown-token, repeated-token)"
        status: pass
    human_judgment: false
  - id: D2
    description: "sendQueuedMessage is the ONLY Function bound to RESEND_API_KEY (secrets:[RESEND_API_KEY] occurs exactly once in index.ts and lives inside the sendQueuedMessage wrapper), R131 smallest key-holding surface"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler (SOURCE INSPECTION: RESEND_API_KEY bound to exactly one Function)"
        status: pass
    human_judgment: false
  - id: D3
    description: "the transactional queued->sending claim flips status only when currently 'queued'; a SECOND invocation on a 'sending' or 'sent' doc, or a 'scheduled'/missing doc, calls Resend ZERO times and writes no status flip (ROADMAP idempotency criterion 4)"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler (already-sending 0 sends / already-sent 0 sends / scheduled skipped / missing-doc skipped / queued flips to sending)"
        status: pass
    human_judgment: false
  - id: D4
    description: "recipients are re-resolved server-side via the 59-01 port using recipientSelector as who-to-resolve intent — a stale individualPersonId is dropped and the real address comes only from people/{id}, never the client list (Anti-Pattern 1)"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler (Anti-Pattern 1: re-resolves from Firestore, stale id dropped)"
        status: pass
    human_judgment: false
  - id: D5
    description: "per-recipient {{their_roles}} renders each person's own roleNames (person A 'guitar' != person B 'bass' from the SAME body template); Resend tags are the exact [orgId,serviceId,messageId,recipientId] path segments (R139, Phase 60 webhook contract)"
    requirement: R139
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler (R139 per-recipient render / exact Resend tags)"
        status: pass
    human_judgment: false
  - id: D6
    description: "{{song_list}} derives from the service doc's SONG slots in order (non-SONG excluded); {{service_link}} builds ${base}/share/${token} from the latest org-matching shareTokens doc, or '' when none/unconfigured (A1)"
    requirement: R138
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler (song_list ordered / service_link from latest token / service_link empty when none)"
        status: pass
    human_judgment: false
  - id: D7
    description: "one recipients/{id} doc per recipient with status sent|failed; deliveryCounts rolled up; message status flips to sent|partial|failed; one failing send is a failed recipient, not an aborted batch (partial rollup)"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler (queued full-send rollup / partial failure / all-failed)"
        status: pass
    human_judgment: false
  - id: D8
    description: "options.sendCopyToSelf also sends to the requesting editor's own email, resolved server-side from getAuth().getUser(requestedByUid) — never a client-supplied address"
    requirement: R131
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#sendQueuedMessageHandler (sendCopyToSelf server-resolved extra send + recipients/{uid} doc)"
        status: pass
    human_judgment: false
  - id: D9
    description: "the send path ships built + unit-tested + UNDEPLOYED against a mocked Resend; owner creates the Resend account, sets RESEND_API_KEY + SERVICE_SHARE_BASE_URL + MESSAGE_FROM_ADDRESS + DNS, then deploys both Functions — a real email reaching an inbox is owner-verified at /gsd-verify-work 59"
    requirement: R131
    verification: []
    human_judgment: true
    rationale: "Deploy-gated by the v1.7 grant — nothing is deployed, no secret set, no real email sent this plan. Routed to PENDING-VERIFICATION.md item 59-03; must NOT be marked passed here."

# Metrics
duration: 13min
completed: 2026-08-14
status: complete
---

# Phase 59 Plan 03: sendQueuedMessage Send Trigger Summary

**Added the send half of the path — `sendQueuedMessage` (`onDocumentCreated`, the sole `RESEND_API_KEY` holder) with a transactional `queued→sending` idempotency claim, server-side recipient re-resolution, per-recipient token rendering via a new pure `messageTokens.ts`, Resend send (mocked), `recipients/{id}` writes and `deliveryCounts` rollup (R131/R138/R139), all UNDEPLOYED against a mocked provider.**

## Performance
- **Duration:** ~13 min
- **Started:** 2026-08-14T16:10:50Z
- **Completed:** 2026-08-14T16:24:31Z
- **Tasks:** 2 (both TDD)
- **Files:** 4 (2 created, 2 modified) + PENDING-VERIFICATION.md

## Accomplishments
- Added `functions/src/messageTokens.ts` — a pure `renderMessageTokens(template, ctx)` that globally substitutes `{{service_date}}`/`{{their_roles}}`/`{{song_list}}`/`{{service_link}}`, personalizes `{{their_roles}}` per recipient (R139), leaves unknown tokens verbatim, and is empty-safe (`{{service_link}}` → `''`; empty roles → the documented `EMPTY_ROLES_PLACEHOLDER`). No Firestore/Pinia and no `buildServiceSnapshot` import (Anti-Pattern).
- Added `sendQueuedMessageHandler` (exported) + the `sendQueuedMessage = onDocumentCreated({ document, secrets: [RESEND_API_KEY] }, …)` wrapper — the **ONLY** Function bound to `RESEND_API_KEY` (R131), verified by a source-inspection test that the binding occurs exactly once and inside this wrapper.
- **Idempotency (ROADMAP criterion 4, NEW code — no PPTX analog):** a `runTransaction` reads `messages/{id}.status` and flips `queued→sending` only when currently `queued`; a retried trigger, or a `sending`/`sent`/`scheduled`/missing doc, returns without sending — explicitly tested that a second invocation calls Resend **zero** times and a `scheduled` doc is skipped for Phase 61's cron.
- **Server-side re-resolution (Anti-Pattern 1, R131):** Admin-SDK-loads the service, quarters, roles and people and feeds them through the 59-01 port (`resolveServiceRoleAssignments` + `resolveMessageRecipients`), using the doc's `recipientSelector` as who-to-resolve intent — never the client's stored list. A stale individual id is dropped.
- **Token context server-side (R138):** `{{service_date}}` from the service doc (UTC-pinned formatting), `{{song_list}}` from the service doc's SONG slots in order (Admin SDK, non-SONG excluded), `{{service_link}}` from the latest org-matching top-level `shareTokens` doc (`${base}/share/${token}`, or `''` when unconfigured/none — A1).
- **Send + persistence:** per recipient, renders subject+body with THAT person's roleNames, validates the four ids are Resend-tag-safe, calls the mocked Resend with `tags:[orgId,serviceId,messageId,recipientId]`, and (per-recipient try/catch) writes one `recipients/{id}` doc (`sent`|`failed`, `providerMessageId`) so one bad address is a failed recipient, not an aborted batch. Rolls up `deliveryCounts` and flips the message status to `sent`|`partial`|`failed`. `options.sendCopyToSelf` appends a server-resolved copy to the requesting editor's own email (`getAuth().getUser(requestedByUid)`).

## Task Commits
1. **Task 1 (TDD RED):** failing tests for `renderMessageTokens` — `db9cc66` (test)
2. **Task 1 (TDD GREEN):** `functions/src/messageTokens.ts` pure renderer — `45d9849` (feat)
3. **Task 2 (TDD RED):** failing tests for the `sendQueuedMessage` trigger — `0a69120` (test)
4. **Task 2 (TDD GREEN):** `sendQueuedMessageHandler` + secret-bound wrapper + configs — `592f6c8` (feat)

No REFACTOR commits — both GREEN implementations were clean.

## Gate Output

**Token renderer** — `cd functions && npx vitest run src/messageTokens.test.ts`:
```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

**Send trigger + full index suite** — `cd functions && npx vitest run src/index.test.ts`:
```
 Test Files  1 passed (1)
      Tests  92 passed (92)
```
Includes the duplicate-trigger no-resend idempotency test (second invocation → mockSend 0 times), the already-sent and scheduled-skip cases, the never-trust-client-list re-resolve, per-recipient personalization (R139), the partial-failure and all-failed rollups, sendCopyToSelf, and the RESEND_API_KEY single-binding source inspection.

**Full functions suite** — `cd functions && npm test`:
```
 Test Files  7 passed (7)
      Tests  178 passed (178)
```

**Functions build (tsc)** — `cd functions && npm run build`:
```
> build
> tsc
BUILD_EXIT=0
```

**Root app suite (stays at the 2-file known-failing baseline)** — `npx vitest run`:
```
 Test Files  2 failed | 107 passed (109)
      Tests  13 failed | 3369 passed (3382)
```
The 2 failing files are exactly the documented CLAUDE.md baseline — `src/storage.rules.test.ts` (12, Storage-emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (1, stale assertion). The new self-contained functions tests are collected under the root jsdom run and add **+29 passing** (messageTokens 13 + new send tests 16) with no new failing file — baseline preserved.

## Files Created/Modified
- `functions/src/messageTokens.ts` — pure `renderMessageTokens` + `EMPTY_ROLES_PLACEHOLDER` (created)
- `functions/src/messageTokens.test.ts` — 13 token-render tests (created)
- `functions/src/index.ts` — `sendQueuedMessageHandler` + `sendQueuedMessage` wrapper, `SERVICE_SHARE_BASE_URL`/`MESSAGE_FROM_ADDRESS` configs, `formatServiceDate`/`resolveServiceLink`/`resolveEditorEmail` helpers, imports for Resend + the port + the token renderer (modified)
- `functions/src/index.test.ts` — name-aware defineString mock, getAuth.getUser mock, hoisted Resend mock, `sendQueuedMessageHandler` describe block (16 tests) (modified)
- `.planning/PENDING-VERIFICATION.md` — item 59-03 owner pre-deploy handover (modified)

## Decisions Made
See frontmatter `key-decisions`. The load-bearing one: the `vi.mock("resend")` factory must use a **regular function**, not the arrow form shown in 59-RESEARCH.md — `new Resend(key)` on an arrow throws `"is not a constructor"` (see Issues Encountered). Also: the `defineString` mock was made name-aware so the two new configs don't collide with `PPTX_RENDER_SERVICE_URL` on a single shared value.

## Deviations from Plan
None — plan executed as written. No Rules 1–3 auto-fixes to production code and no Rule 4 architectural decisions arose. The Resend-mock function-vs-arrow correction was an inner-loop test-harness fix within Task 2 (the plan explicitly left the mock seam to implementer discretion), documented under Issues Encountered rather than as a plan deviation.

## Issues Encountered
- **Resend mock arrow-vs-function.** The first Task-2 GREEN run failed with `() => ({ emails: { send: mockSend } }) is not a constructor` — `new Resend(key)` cannot construct an arrow function. The 59-RESEARCH.md Code Example used the arrow form (`Resend: vi.fn(() => ({...}))`), which does not actually construct. Fixed by wrapping a regular `function () { return { emails: { send: mockSend } } }` in `vi.fn`; all 16 send tests then passed. Inner-loop harness fix, same task.

## User Setup Required
None runnable this plan — **DEPLOY-GATED**. The send path ships built, unit-tested, and UNDEPLOYED against a mocked Resend. Owner steps are routed to `.planning/PENDING-VERIFICATION.md` item 59-03 (and the pre-deploy pin re-confirm in 59-01): create the Resend account, `firebase functions:secrets:set RESEND_API_KEY`, set `SERVICE_SHARE_BASE_URL` + `MESSAGE_FROM_ADDRESS`, add SPF/DKIM/DMARC DNS, then `firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage`. These must NOT be marked passed here.

## Next Phase Readiness
- `sendQueuedMessage` writes `recipients/{id}` docs (status, providerMessageId) and `deliveryCounts` with `tags:[orgId,serviceId,messageId,recipientId]` — the exact contract Phase 60's HMAC-verified `messageWebhook` reads to address a recipient with no `collectionGroup` query.
- A `scheduled` doc is left inert by the `=== 'queued'` guard for Phase 61's `sendScheduledReminders` cron to flip to `queued` and re-trigger the same send path.
- `MessageComposer.vue` (59-04) can now queue a send-now message end-to-end (mocked provider) against `queueServiceMessage` → `sendQueuedMessage`.
- **Blocker (intentional):** nothing is deployed, no secret set, no real email sent — the owner completes the PENDING-VERIFICATION 59-01/59-02/59-03 pre-deploy steps before the send path goes live.

---
*Phase: 59-messages-composer-send-path*
*Completed: 2026-08-14*

## Self-Check: PASSED
- `functions/src/messageTokens.ts` — FOUND
- `functions/src/messageTokens.test.ts` — FOUND
- `functions/src/index.ts::sendQueuedMessageHandler` — FOUND
- `functions/src/index.ts::sendQueuedMessage` (onDocumentCreated wrapper, secrets:[RESEND_API_KEY]) — FOUND
- Commit `db9cc66` (test RED, messageTokens) — FOUND
- Commit `45d9849` (feat GREEN, messageTokens) — FOUND
- Commit `0a69120` (test RED, send trigger) — FOUND
- Commit `592f6c8` (feat GREEN, sendQueuedMessage) — FOUND
