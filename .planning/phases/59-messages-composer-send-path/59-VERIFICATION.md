---
phase: 59-messages-composer-send-path
verified: 2026-08-14T13:05:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "Composer matches DESIGN §5a visually and the kill-switch disabled+tooltip reads correctly end-to-end in the running app (R136)"
    addressed_in: "verification_deferred_human — owner /gsd-verify-work 59"
    evidence: "Routed to PENDING-VERIFICATION.md item 59-04; v1.7 grant classifies visual/interaction UAT as deferred-human, not a phase gap. All send-path LOGIC is automated with Resend mocked."
  - truth: "Provider account (Resend), RESEND_API_KEY secret, SERVICE_SHARE_BASE_URL/MESSAGE_FROM_ADDRESS config, SPF/DKIM/DMARC DNS, and firebase deploy of both Functions (R131/SC5)"
    addressed_in: "owner-setup / deploy-gated (v1.7 grant)"
    evidence: "Intentionally UNDEPLOYED. Exact command handed to owner: firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage. Routed to PENDING-VERIFICATION.md items 59-01/02/03."
---

# Phase 59: Messages Composer & Send Path Verification Report

**Phase Goal:** A planner can compose and send a message to a service's volunteers, with the provider's API key confined to a single server-side Function — built/tested/UNDEPLOYED against mocked Resend.
**Verified:** 2026-08-14T13:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ✉ Messages button (hidden/disabled when Messaging off) opens a composer; recipients teams-first with individuals addable (R136) | ✓ VERIFIED | `serviceEditorActionBar.ts:252` `buildMessagesItem` — editor-gated (`if (!ctx.isEditor) return undefined`), `disabled: !ctx.messagingEnabled`, tooltip "Turn on Messaging in Settings…" (disabled-not-hidden). `MessageComposer.vue:396` renders `MESSAGING_TEAM_LABELS` team chips + Everyone + addable Individuals. |
| 2 | Three message types + subject/body with insertable tokens (service date/link, their roles, song list) (R137/R138) | ✓ VERIFIED | `MessageComposer.vue:357-359` types `oneoff`/`reminder`/`share-link`; `:363-366` token catalog `service_date`/`service_link`/`their_roles`/`song_list` inserted at caret storing RAW template. |
| 3 | Live "Reaches N people" + attach-link / send-copy / schedule-for-later options (R140/R141) | ✓ VERIFIED | `:234` `reaches-count` recomputes via `resolveRecipients` (`:384`); options `attachServiceLink`(:344)/`sendCopyToSelf`(:345)/`scheduleForLater`(:346) with schedule reveal + Send↔Schedule label flip (`:560`). |
| 4 | One personalized email per recipient (their_roles = that person's roles) via queueServiceMessage (onCall) → sendQueuedMessage (onDocumentCreated), the sole secret-holding Function, with transactional idempotency (R131/R139/SC4) | ✓ VERIFIED | `index.ts:1046` `queueServiceMessage = onCall(handler)` **no secrets array**; `:1356-1359` `sendQueuedMessage = onDocumentCreated({…, secrets:[RESEND_API_KEY]})` — `secrets:[RESEND_API_KEY]` occurs **exactly once**. `:1181-1191` transactional `queued→sending` claim. Idempotency proven behaviorally: `index.test.ts:1633` a second invocation on a `sending` doc → `expect(mockSend).not.toHaveBeenCalled()` (also `sent`:1646, `scheduled`:1656). Per-recipient render `index.test.ts:1620` (person A 'guitar' ≠ person B 'bass'). |
| 5 | Provider account + DNS are owner steps; Functions ship built/tested/UNDEPLOYED with exact deploy command (R131/SC5) | ✓ VERIFIED | Functions build clean (tsc exit 0), 178 functions tests green with Resend mocked, nothing deployed. Exact command documented (`firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage`) and routed to PENDING-VERIFICATION.md. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

The behavior-dependent truth (SC4 transactional `queued→sending` state transition) is upgraded to VERIFIED — not merely present — because `index.test.ts:1633/1646/1656` exercise the invariant and assert ZERO Resend calls on a retried/non-queued trigger.

### Deferred Items (owner / human — non-blocking, expected by v1.7 grant)

| # | Item | Route | Why not a gap |
|---|------|-------|---------------|
| 1 | Composer visual parity w/ DESIGN §5a + kill-switch disabled+tooltip end-to-end | `verification_deferred_human` → PENDING-VERIFICATION.md 59-04 | Visual/interaction judgment; all send-path logic is automated with Resend mocked. Task routing: classify deferred, do NOT fail. |
| 2 | Resend account + RESEND_API_KEY secret + SERVICE_SHARE_BASE_URL/MESSAGE_FROM_ADDRESS config + SPF/DKIM/DMARC DNS + `firebase deploy` | owner-setup / deploy-gated → PENDING-VERIFICATION.md 59-01/02/03 | Intentionally UNDEPLOYED per phase scope; deploy command handed to owner. Task routing: do NOT fail. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/index.ts` | queueServiceMessage (no secret) + sendQueuedMessage (secret) | ✓ VERIFIED | Both handlers exported separately from wrappers; `secrets:[RESEND_API_KEY]` once, on `sendQueuedMessage` only. |
| `functions/src/serviceRoles.ts` | Ported pure resolver + resolveMessageRecipients (per-recipient roleNames) | ✓ VERIFIED | Self-contained port; 14 lockstep tests (`serviceRoles.test.ts`). |
| `functions/src/messageTokens.ts` | Pure renderMessageTokens (R138/R139) | ✓ VERIFIED | 13 tests; per-recipient their_roles, empty-safe service_link. |
| `functions/package.json` | resend pinned exactly 6.19.0, functions-only | ✓ VERIFIED | `"resend": "6.19.0"` (no caret); absent from root package.json and all of `src/`; `import { Resend } from "resend"` only in `functions/src/index.ts`. |
| `src/components/MessageComposer.vue` | Composer: teams-first, types, tokens, Reaches-N, options, selector-only Send | ✓ VERIFIED | 19 tests; Send payload carries `recipientSelector` only. |
| `src/views/serviceEditorActionBar.ts` | ✉ action editor-gated, disabled-not-hidden | ✓ VERIFIED | `buildMessagesItem`; 47 action-bar tests. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `MessageComposer.vue` | `queueServiceMessage` Function | `httpsCallable<QueueMessageRequest>` `:574` | ✓ WIRED | Payload = `{orgId,serviceId,type,subject,body,recipientSelector,options,scheduledFor}` — **no resolved email list** (Anti-Pattern 1 client side; test asserts no `@example.com` in payload, `MessageComposer.test.ts:320`). |
| `queueServiceMessage` | `messages/{id}` doc | `createQueuedMessage()` `:1026` | ✓ WIRED | `status: scheduledFor ? "scheduled" : "queued"` (`:909`). |
| `messages/{id}` create | `sendQueuedMessage` trigger | `onDocumentCreated` on `.../messages/{messageId}` | ✓ WIRED | Trigger's `=== 'queued'` claim guard skips `scheduled` docs (left for Phase 61 cron). |
| `sendQueuedMessage` | recipients (server) | `resolveServiceRoleAssignments`+`resolveMessageRecipients` `:1231-1241` | ✓ WIRED | Re-resolves from Firestore; stale individualPersonId dropped (`index.test.ts:1677`). Never trusts client list. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Functions suite (send path, Resend mocked) | `cd functions && npm test` | 7 files / 178 tests passed | ✓ PASS |
| Functions type/build | `cd functions && npm run build` | tsc exit 0 | ✓ PASS |
| App suite (baseline check) | `npx vitest run` | 2 failed files / 108 passed (110); 13 failed tests | ✓ PASS (baseline) |
| Client type gate | `npm run type-check` (vue-tsc --build) | exit 0 | ✓ PASS |

App-suite failures are exactly the documented CLAUDE.md baseline — `src/storage.rules.test.ts` (12, Storage-emulator `firestore.exists()` cross-service limitation) and `src/views/__tests__/RosterView.test.ts` (1, stale assertion). No phase-introduced regression.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| R131 | Send path holds provider key server-side; no key/email list in client bundle | ✓ SATISFIED | `secrets:[RESEND_API_KEY]` once, only on `sendQueuedMessage`; resend absent from `src/`; composer sends selector only. |
| R136 | ✉ button opens composer, teams-first + individuals | ✓ SATISFIED | action-bar + composer + tests. |
| R137 | Three message types | ✓ SATISFIED | `oneoff`/`reminder`/`share-link` + type-seeding + validation. |
| R138 | Subject + body with insertable merge tokens | ✓ SATISFIED | 4-token catalog client; server renderMessageTokens. |
| R139 | Personalized per-recipient (their roles) | ✓ SATISFIED | per-recipient render `index.test.ts:1620`; `serviceRoles.test.ts` roleNames divergence. |
| R140 | Live "Reaches N people" minus unreachable | ✓ SATISFIED | `resolveRecipients` + unreachable note; pluralization tests. |
| R141 | attach-link / send-copy / schedule-for-later | ✓ SATISFIED | options + scheduled status persistence (dispatch = Phase 61). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `messageTokens.ts` | 36/55 | `EMPTY_ROLES_PLACEHOLDER` constant | ℹ️ Info | False positive — named fallback constant ("your role"), not a stub. |
| `index.ts` | 445 | comment "…not a TODO" | ℹ️ Info | False positive — comment negating a TODO, no debt. |
| `MessageComposer.vue` | 520 | SAMPLE preview renders `[service link]` | ℹ️ Info | Intentional per UI-SPEC #9 — composer stores RAW template; authoritative per-recipient render is server-side at send time. Not a data stub. |

No genuine debt markers (TODO/FIXME/XXX) in phase-modified files.

### Human Verification Required

None blocking. The two human/owner items are pre-recorded deferred/owner-gated items (see Deferred Items table) already routed to PENDING-VERIFICATION.md under the v1.7 grant — expected by phase design, not defects.

### Gaps Summary

No genuine (non-deferred, non-owner-deploy) gaps. The secret-confinement invariant (R131/SC4) holds exactly as specified: `resend@6.19.0` is functions-only, `secrets:[RESEND_API_KEY]` binds to `sendQueuedMessage` and nothing else, and the composer transmits only the `recipientSelector`. The transactional idempotency claim is genuinely new code (no PPTX analog) and is proven by a test that asserts a retried trigger sends zero emails. Server-side re-resolution (Anti-Pattern 1) is enforced and tested. Schedule-for-later correctly persists `status:'scheduled'` and is skipped by the `=== 'queued'` guard (dispatch deferred to Phase 61 by intent). All four gates are green. The phase goal — compose + send to volunteers with the provider key confined to one UNDEPLOYED server Function against mocked Resend — is achieved.

---

_Verified: 2026-08-14T13:05:00Z_
_Verifier: Claude (gsd-verifier)_
