---
phase: 60-delivery-history-bounce-webhook
plan: 02
subsystem: api
tags: [webhook, svix, hmac, resend, bounce, firestore, idempotency, security, onRequest]

# Dependency graph
requires:
  - phase: 60-delivery-history-bounce-webhook
    plan: 01
    provides: "verifySvixSignature(rawBody, headers, secret) + the deploy-gated recipients.providerMessageId collection-group index"
  - phase: 59-messaging-send
    plan: 03
    provides: "recipients/{id}.providerMessageId + the four Resend tags {orgId,serviceId,messageId,recipientId} sent at send time — the addressing keys the webhook resolves against"
provides:
  - "messageWebhook (onRequest) — the milestone's unauthenticated Resend delivery/bounce receiver; the ONLY Function bound to RESEND_WEBHOOK_SECRET"
  - "messageWebhookHandler(rawBody, headers, secret) — exported verify-first handler body (unit-testable with a fake req/headers, no res)"
  - "resolveRecipientRef(db, data) — tags-direct addressing with a providerMessageId collectionGroup fallback"
  - "recordBounce(db, recipientRef, bounce) — transition-guarded idempotent bounce write (literal deliveryCounts.bounced=prev+1)"
affects: [messageWebhook, bounce-handling, delivery-history, 61-scheduled-send]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verify-first trust boundary: assert Buffer.isBuffer(rawBody) -> verify Svix HMAC over rawBody -> ONLY THEN parse + touch Firestore; 401/400 with zero state access on a bad/malformed request (test asserts getFirestore never called)"
    - "Idempotent transition-guarded write: increment deliveryCounts.bounced as a LITERAL prev+1 (read in-txn) only on the not-bounced -> bounced transition, so an at-least-once duplicate is a safe no-op"
    - "200 for every valid-but-unprocessable event (soft/Transient, delivered, unknown, unresolvable); 4xx/5xx reserved for signature/malformed only, so a processing outcome never triggers a Resend retry storm"
    - "One secret bound to exactly one Function (RESEND_WEBHOOK_SECRET -> messageWebhook), verified by a source-inspection test"

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Bind RESEND_WEBHOOK_SECRET to messageWebhook only (mirrors RESEND_API_KEY -> sendQueuedMessage); distinct from the API key, never in client src/ or .env.local"
  - "Address the recipient via echoed tags (direct doc, no query, no index) first; the providerMessageId collectionGroup fallback is fully implemented (not a stub) as the true safety net"
  - "Write deliveryCounts.bounced as a literal prev+1 inside the transaction (NOT FieldValue.increment) so the existing FieldValue mock needs no increment and idempotency is transition-guarded, not counter-driven"

patterns-established:
  - "Pattern: unauthenticated onRequest webhook = exported verify-first handler body + thin secret-bound onRequest wrapper reading .value()"
  - "Pattern: prove the trust boundary with an explicit getFirestore-never-called assertion on a bad-signature request"

requirements-completed: [R143]

coverage:
  - id: D1
    description: "messageWebhookHandler verifies the Svix HMAC over req.rawBody FIRST; a missing/tampered/stale/wrong-secret signature returns 401 with ZERO Firestore access, a non-Buffer or non-JSON body returns 400 — proven by getFirestore-never-called assertions (R143 success criterion 3)"
    requirement: "R143"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts > messageWebhookHandler (60-02 verify-first) — 401 + getFirestore.not.toHaveBeenCalled for no-headers / tampered / stale / wrong-secret; 400 for non-Buffer + non-JSON, via `cd functions && npx vitest run src/index.test.ts`"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only email.bounced/Permanent surfaces; recordBounce idempotently sets status:'bounced' + literal deliveryCounts.bounced=prev+1 once, and a duplicate delivery keeps the count at 1 (R143 success criterion 4)"
    requirement: "R143"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts > recordBounce (IDEMPOTENT: second identical delivery keeps count at 1) + messageWebhookHandler (IDEMPOTENT end-to-end: two identical valid deliveries -> count == 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "resolveRecipientRef addresses via echoed tags (single doc(), no collectionGroup) with a fully-implemented providerMessageId collectionGroup fallback and null on miss"
    requirement: "R143"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts > resolveRecipientRef (60-02 addressing) — tags-direct (collectionGroup never called), fallback resolves via providerMessageId, null on miss, partial-tags fallthrough"
        status: pass
    human_judgment: false
  - id: D4
    description: "RESEND_WEBHOOK_SECRET is bound to exactly one Function (messageWebhook), absent from client src/ and .env.local"
    requirement: "R143"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts > SOURCE INSPECTION: RESEND_WEBHOOK_SECRET bound to EXACTLY ONE Function; grep confirms 0 occurrences under client src/ and absent from .env.local"
        status: pass
    human_judgment: false
  - id: D5
    description: "A real hard bounce from a live Resend webhook flips a recipient's history to bounced and increments deliveryCounts.bounced once, with the tags echo and ±5-min replay window confirmed against a real event"
    verification:
      - kind: manual_procedural
        ref: "owner: set RESEND_WEBHOOK_SECRET, deploy messageWebhook + firestore:indexes, configure the Resend dashboard webhook, then /gsd-verify-work 60 (PENDING-VERIFICATION.md 60-02)"
        status: unknown
    human_judgment: true
    rationale: "The webhook ships UNDEPLOYED against a mocked secret per the v1.7 grant; only an owner deploy + a real hard bounce (deferred_human) can prove the live path and confirm tags echo (A2) / replay tolerance (A1)."

# Metrics
duration: 14min
completed: 2026-08-14
status: complete
---

# Phase 60 Plan 02: messageWebhook Bounce Receiver Summary

**The milestone's unauthenticated Resend delivery/bounce `onRequest` receiver: it verifies the Svix HMAC over the raw body BEFORE any Firestore access (401/400 + zero state on a bad request), then — only for a hard `Permanent` bounce — idempotently flips the addressed `recipients/{id}` to `status:'bounced'` and increments `messages/{id}.deliveryCounts.bounced` once, bound to `RESEND_WEBHOOK_SECRET` and shipped built/tested/UNDEPLOYED.**

## Performance

- **Duration:** ~14 min
- **Completed:** 2026-08-14
- **Tasks:** 2 (both TDD: RED -> GREEN)
- **Files modified:** 3 (`functions/src/index.ts`, `functions/src/index.test.ts`, `.planning/PENDING-VERIFICATION.md`)

## Accomplishments

- **`resolveRecipientRef(db, data)`** — addresses the bounced recipient DIRECTLY from the echoed Resend tags (`organizations/{orgId}/services/{serviceId}/messages/{messageId}/recipients/{recipientId}`) via a single `doc()` with no query and no index, and falls back to `collectionGroup('recipients').where('providerMessageId','==',data.email_id).limit(1)` when tags are absent/incomplete. Returns `null` (never throws) when neither resolves. Both paths fully implemented and tested.
- **`recordBounce(db, recipientRef, bounce)`** — one transaction reads the recipient status AND the message count before any write; only on the not-bounced -> bounced transition does it set `status:'bounced'` + `bounceReason` + `bouncedAt` and write `deliveryCounts.bounced` as a **literal** `prev+1` via the dot-path merge (preserving sibling `sent`/`failed`). A duplicate delivery finds status already `'bounced'` and no-ops — the count stays 1.
- **`messageWebhookHandler(rawBody, headers, webhookSecret)`** — the verify-first order contract: non-Buffer body -> 400; `verifySvixSignature` over `rawBody` fails -> 401 with **zero Firestore access**; JSON parse only after the signature passes (unparseable -> 400); only `email.bounced`/`Permanent` surfaces; every other valid event (soft/`Transient`, `email.delivered`, unknown type, unresolvable recipient) -> 200 with no write.
- **`RESEND_WEBHOOK_SECRET` + `messageWebhook` wrapper** — `defineSecret('RESEND_WEBHOOK_SECRET')` declared next to the other secrets (with the set-once doc-comment extended), bound to `messageWebhook`'s `onRequest({ secrets: [RESEND_WEBHOOK_SECRET] })` and **no other Function**; the wrapper reads `.value()` and delegates to the exported handler body.

## Task Commits

1. **Task 1 (RED):** failing tests for `resolveRecipientRef` + `recordBounce` — `3b5863e4` (test)
2. **Task 1 (GREEN):** addressing + idempotent bounce helpers — `d9c727ab` (feat)
3. **Task 2 (RED):** failing tests for `messageWebhookHandler` — `68ec1bf3` (test)
4. **Task 2 (GREEN):** verify-first handler + `RESEND_WEBHOOK_SECRET` + wrapper — `ca1e4923` (feat)

_TDD: each task = test (RED) -> feat (GREEN); no refactor commit needed._

## Gate Output (verbatim key lines)

- **Plan unit test** (`cd functions && npx vitest run src/index.test.ts`):
  `Test Files  1 passed (1)` / `Tests  115 passed (115)`
- **Full functions suite** (`cd functions && npm test`):
  `Test Files  8 passed (8)` / `Tests  216 passed (216)`
- **Functions build** (`cd functions && npm run build` = `tsc`): `===BUILD_EXIT:0===`, clean (no output).
- **Root app suite** (`npx vitest run`, extended timeout ~216s):
  `Test Files  2 failed | 109 passed (111)` / `Tests  13 failed | 3433 passed (3446)` — the 2 failing files are EXACTLY the CLAUDE.md known baseline (`src/storage.rules.test.ts` — Storage-emulator cross-service `firestore.exists()` limitation / no emulator up; `src/views/__tests__/RosterView.test.ts` — stale "Roles config" assertion). No NEW failing file → regression-free. The new webhook tests live in `functions/src/index.test.ts` and pass within the root run.
- **Secret containment** (grep): `RESEND_WEBHOOK_SECRET` — **0** occurrences under client `src/`; **absent** from `.env.local`; exactly one `secrets: [RESEND_WEBHOOK_SECRET]` binding in `functions/src/index.ts`, inside the `messageWebhook` wrapper (also asserted by the source-inspection test).

## Security Tests Confirmed (load-bearing)

- **Zero-Firestore-on-bad-sig (T-60-02a, success criterion 3):** `messageWebhookHandler` with no svix headers / tampered body / stale timestamp / wrong secret returns **401** and `expect(getFirestore).not.toHaveBeenCalled()` — proven for all four bad-signature shapes; non-Buffer and non-JSON bodies return **400**, also with `getFirestore` un-called. **Exists and passes.**
- **Duplicate delivery -> count == 1 (T-60-02c, success criterion 4):** both `recordBounce` (two identical calls) and `messageWebhookHandler` (two identical valid deliveries end-to-end) leave `status:'bounced'` and `deliveryCounts.bounced == 1`, with exactly one message-count update. **Exists and passes.**
- **Secret binding (T-60-02f):** `RESEND_WEBHOOK_SECRET` binds only to `messageWebhook` (source-inspection test asserts exactly one `secrets: [...]` binding in the wrapper); confirmed absent from client `src/` and `.env.local`.

## Deviations from Plan

**1. [Test-only fix] `bouncedEvent` helper could not express a genuinely tags-absent event**
- **Found during:** Task 2 GREEN (the "unresolvable recipient -> 200, no transaction" test failed because the fake tags path always resolved).
- **Issue:** the helper's `overrides.tags === undefined` branch injected the default `TAGS` even when a test explicitly passed `tags: undefined`, so the tags-primary addressing path always fired and `runTransaction` ran.
- **Fix:** distinguish an absent key from an explicit-`undefined` value using `'tags' in overrides` — an absent key defaults to `TAGS`, an explicit `tags: undefined` omits tags entirely (forcing the providerMessageId fallback).
- **Files modified:** `functions/src/index.test.ts` (test helper only; no production change).
- **Verification:** the unresolvable-recipient test then passed; full plan suite 115/115.
- **Commit:** `ca1e4923`.

**Total deviations:** 1 (test-harness fix, no production impact). **Impact:** none on shipped behavior — the production handler was correct; the test fixture could not previously represent a no-tags event.

## Threat Surface

No security surface beyond the plan's `<threat_model>` was introduced. `messageWebhook` is the anticipated unauthenticated boundary; its only gate is the Svix HMAC over the raw body, checked before any Firestore access (T-60-02a), with replay tolerance (T-60-02b) inherited from 60-01, idempotent counting (T-60-02c), 200-on-unprocessable to avoid a retry storm (T-60-02d), parse-after-verify input handling (T-60-02e/g), and a single-Function secret binding (T-60-02f). Zero packages installed (T-60-SC).

## Issues Encountered

- The root app suite exceeded the default 2-minute Bash timeout (full jsdom suite ~216s); re-ran with an extended timeout and it completed at the expected 2-file baseline. Not a regression.

## User Setup Required

**Owner pre-deploy steps recorded in `.planning/PENDING-VERIFICATION.md` (item 60-02, NOT marked passed):**
- `firebase functions:secrets:set RESEND_WEBHOOK_SECRET` (the `whsec_` Svix signing secret; distinct from `RESEND_API_KEY`).
- `firebase deploy --only firestore:indexes` (the 60-01 `recipients.providerMessageId` collection-group index must reach **Enabled** before the fallback runs live).
- `firebase deploy --only functions:messageWebhook`.
- Configure the Resend dashboard webhook: point it at the deployed `messageWebhook` URL and paste the same signing secret.
- `/gsd-verify-work 60`: confirm a real hard bounce flips history to `bounced` (count increments once) and re-confirm the tags echo (A2) + ±5-min `REPLAY_TOLERANCE_SEC` (A1) against a real event.

## Next Phase Readiness

- The bounce path is complete and testable end-to-end against a mocked provider; delivery history can now surface `status:'bounced'` + `bounceReason` + `deliveryCounts.bounced`.
- `messageWebhook` ships UNDEPLOYED against a mocked secret and a hand-computed valid signature — no secret set, no deploy, no `.env.local` change (v1.7 grant honored).
- Owner deploy + a real hard bounce (`deferred_human`) is the only remaining gate for the live path.

## Self-Check: PASSED

- `functions/src/index.ts` (resolveRecipientRef, recordBounce, messageWebhookHandler, messageWebhook, RESEND_WEBHOOK_SECRET) — FOUND
- `functions/src/index.test.ts` (resolveRecipientRef / recordBounce / messageWebhookHandler describe blocks) — FOUND
- `.planning/PENDING-VERIFICATION.md` (60-02 handover section) — FOUND
- Commit `3b5863e4` (test task 1) — FOUND
- Commit `d9c727ab` (feat task 1) — FOUND
- Commit `68ec1bf3` (test task 2) — FOUND
- Commit `ca1e4923` (feat task 2) — FOUND

---
*Phase: 60-delivery-history-bounce-webhook*
*Completed: 2026-08-14*
