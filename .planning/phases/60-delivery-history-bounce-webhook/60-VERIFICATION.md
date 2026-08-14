---
phase: 60-delivery-history-bounce-webhook
verified: 2026-08-14T00:00:00Z
status: passed
score: 4/4 success criteria verified (+ all supporting must-have truths)
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "A real hard bounce from a live Resend webhook flips a recipient's history to bounced, increments deliveryCounts.bounced once, and the ±5-min replay window + tags echo hold against a real event"
    addressed_in: "Owner pre-deploy + /gsd-verify-work 60 (PENDING-VERIFICATION.md 60-01/60-02)"
    evidence: "v1.7 grant ships webhook + index built/tested/UNDEPLOYED; deploy (firebase functions:secrets:set RESEND_WEBHOOK_SECRET, firebase deploy --only functions:messageWebhook + firestore:indexes, Resend dashboard config) is owner-setup, explicitly out of this phase's scope. Phase goal states 'UNDEPLOYED' as the expected end state."
  - truth: "Visual layout of the history panel matches DESIGN-messaging.md §5b; the red 'N bounced' indicator surfaces on a live bounce; 'Fix email →' navigates to /volunteers?edit={personId}"
    addressed_in: "verification_deferred_human — /gsd-verify-work 60 (PENDING-VERIFICATION.md 60-03)"
    evidence: "Visual/interaction/live-bounce UAT is owner-deferred by design; already routed to PENDING-VERIFICATION.md, never marked passed by automation."
---

# Phase 60: Delivery History & Bounce Webhook Verification Report

**Phase Goal:** A planner can see what was sent on a service and knows immediately when an address hard-bounced — via a signature-verified, idempotent bounce webhook. Deploy-gated (webhook + index built/tested/UNDEPLOYED).
**Verified:** 2026-08-14
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal — a delivery-history surface (R142) + hard-bounce surfacing with a fix affordance (R143), fed by a signature-verified, idempotent bounce webhook that ships **built/tested/UNDEPLOYED** — is achieved in the live codebase. All four ROADMAP success criteria are implemented, wired, and test-exercised (not merely present). The only remaining work is owner deploy + live/visual UAT, which the phase goal explicitly scopes as UNDEPLOYED and which is already routed to PENDING-VERIFICATION.md.

### Observable Truths

| #   | Truth (ROADMAP Success Criteria) | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | Each service has a "Sent on this service" history listing every message with type, recipient count, and send time (R142) | ✓ VERIFIED | `ServiceMessageHistory.vue` renders `role=list`, one `message-row` per message newest-first (store `orderBy('createdAt','desc')`), muted type badge (One-off/Reminder/Share link/Automatic), count line, and `sendTimeLabel`. Mounted in ServiceEditorView Service Order tab below `messaging-defaults-panel`. Tests: `ServiceMessageHistory.test.ts` 16/16, `serviceMessages.test.ts` 8/8, `ServiceEditorView.test.ts` present-assertion. |
| SC2 | A hard bounce surfaces per message in the history with an affordance to fix the bad address (R143) | ✓ VERIFIED | `deliveryCounts.bounced > 0` → red `bounce-indicator` button (aria-expanded) expanding to `bounced-recipient` rows (name/email/`bounceReason ?? 'Address rejected'`) + `RouterLink` `fix-email-link` to `{name:'volunteers', query:{edit: personId}}`. RosterView `applyEditQuery()` opens that person's edit form on mount/query-change/people-load; unknown id / no query = no-op. Tests: `ServiceMessageHistory.test.ts`, `RosterViewEditQuery.test.ts` 3/3. |
| SC3 | The webhook verifies the provider HMAC over the RAW body before touching Firestore; unsigned/malformed → 401/400 with zero writes | ✓ VERIFIED | `messageWebhookHandler` (index.ts:1509) order: Buffer guard→400, then `verifySvixSignature(rawBody,…)`→401, then parse→400, then type/hard-bounce gate, and `getFirestore()` is called ONLY at line 1535 after all pass. Tests assert `expect(getFirestore).not.toHaveBeenCalled()` for no-headers/tampered/stale/wrong-secret (401) and non-Buffer/non-JSON (400). Verifier byte-for-byte matches the Svix scheme (see Key Links). |
| SC4 | A duplicate webhook delivery for the same bounce event is a safe no-op — never a duplicate count | ✓ VERIFIED | `recordBounce` (index.ts:1461) runs one `runTransaction`, reads recipient+message before any write, returns early when `status==='bounced'`, and writes `'deliveryCounts.bounced'` as a **literal** `prev+1` (dot-path merge, not FieldValue.increment). Tests: unit "IDEMPOTENT: second identical delivery… count stays 1" and end-to-end "two identical valid deliveries → bounced == 1" both assert count == 1 and exactly one message update. |

**Score:** 4/4 success criteria verified (0 present-but-behavior-unverified). Both behavior-dependent invariants (SC3 zero-write ordering, SC4 idempotent transition) are backed by passing behavioral tests that exercise the exact transition, so they qualify as VERIFIED (not presence-only).

### Supporting Must-Have Truths (from PLAN frontmatter)

| Truth | Status | Evidence |
| --- | --- | --- |
| verifySvixSignature is a pure node:crypto verifier over `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256/base64, whsec_-strip+base64-decode, space-delimited `v1,` any-match, length-guarded `timingSafeEqual`, `REPLAY_TOLERANCE_SEC=300` | ✓ VERIFIED | `functions/src/webhookSignature.ts` — all elements present and correct; no firebase-admin/svix import. `webhookSignature.test.ts` 15/15 (missing/tampered/wrong-length no-throw/stale/multi-v1/base64-secret). |
| Only-401-for-sig-failure: a valid-sig unprocessable event (Transient/delivered/unknown/unresolvable) → 200, no write | ✓ VERIFIED | Handler line 1532 gates on `type==='email.bounced' && bounce.type==='Permanent'`; tests for Transient, email.delivered, unknown type, and unresolvable-recipient all assert 200 + `runTransaction` not called. |
| Addressing: tags-primary direct doc (no query) + `collectionGroup('recipients').where('providerMessageId','==',email_id)` fallback, both implemented | ✓ VERIFIED | `resolveRecipientRef` (index.ts:1427). Tests assert tags→direct doc() with `collectionGroup` NOT called; tags-absent→fallback with `doc()` NOT called; partial-tags→fallback; null on miss. Collection-group index present in `firestore.indexes.json` (deploy-gated). |
| Secret confinement: RESEND_WEBHOOK_SECRET bound ONLY to messageWebhook; no new npm package | ✓ VERIFIED | 0 occurrences under client `src/`; absent from `.env.local`; exactly one `secrets:[RESEND_WEBHOOK_SECRET]` binding (source-inspection test). No svix package; `functions/package.json` unchanged this phase (last dep add was 59-01 resend). |
| Panel reads NESTED-path only (no client collectionGroup, no new firestore.rules); hidden when messaging off / non-editor | ✓ VERIFIED | `serviceMessages.ts` uses `collection(db,'organizations',org,'services',svc,'messages')` + nested `recipients` `where('status','==','bounced')` — no client `collectionGroup`. Panel `v-if="isMessagingEnabled() && canEditService"`; ServiceEditorView tests prove present (editor+on) / absent (off) / absent (non-editor). |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `functions/src/webhookSignature.ts` | Pure Svix HMAC verifier | ✓ VERIFIED | 86 lines, node:crypto only, exported, imported by index.ts:19 |
| `functions/src/index.ts` | messageWebhook + handler + helpers + secret | ✓ VERIFIED | resolveRecipientRef, recordBounce, messageWebhookHandler, messageWebhook wrapper, RESEND_WEBHOOK_SECRET all present and wired |
| `firestore.indexes.json` | recipients.providerMessageId COLLECTION_GROUP index | ✓ VERIFIED | fieldOverride present, ASCENDING/COLLECTION_GROUP, well-formed JSON (UNDEPLOYED) |
| `src/stores/serviceMessages.ts` | Nested subscribe + lazy bounced read | ✓ VERIFIED | single-listener guard, missing bounced→0, nested-path only |
| `src/components/ServiceMessageHistory.vue` | Props-driven history + bounce surfacing | ✓ VERIFIED | pure props/emit, all UI-SPEC elements, RouterLink deep-link |
| `src/views/ServiceEditorView.vue` | Mount + gate + subscribe/teardown | ✓ VERIFIED | mounted below defaults panel, gated, subscribe watcher + onUnmounted teardown, expand handler |
| `src/views/RosterView.vue` | ?edit={personId} deep-link | ✓ VERIFIED | applyEditQuery on mount/query/people watchers, graceful fallback |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| messageWebhookHandler | verifySvixSignature | import + call BEFORE getFirestore | ✓ WIRED | verify at line 1519; getFirestore at 1535 (after) |
| messageWebhook wrapper | messageWebhookHandler | req.rawBody + req.headers + .value() | ✓ WIRED | onRequest({secrets:[RESEND_WEBHOOK_SECRET]}) delegates to exported body |
| resolveRecipientRef fallback | firestore.indexes.json | collectionGroup providerMessageId index | ✓ WIRED (deploy-gated) | index declared; deploy is owner step |
| ServiceMessageHistory | RosterView | RouterLink /volunteers?edit={personId} | ✓ WIRED | applyEditQuery reads route.query.edit and opens edit form |
| ServiceEditorView | serviceMessages store | subscribe/expand/teardown | ✓ WIRED | subscribe watcher (2485), onExpandMessage→fetchBouncedRecipients (1664), teardown (2679) |

### Behavioral Spot-Checks / Gate Evidence

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full functions suite | `cd functions && npm test` | Test Files 8 passed, Tests 216 passed | ✓ PASS |
| Functions build | `cd functions && npm run build` | exit 0, clean | ✓ PASS |
| New client test files | `npx vitest run` (3 files) | 27 passed (8+16+3) | ✓ PASS |
| ServiceEditorView suite | `npx vitest run …ServiceEditorView.test.ts` | 296 passed | ✓ PASS |
| Type-check | `npm run type-check` (vue-tsc --build) | exit 0, clean | ✓ PASS |
| Full app suite (regression) | `npx vitest run` | 2 failed files / 112 passed (114); 13 failed = EXACTLY the CLAUDE.md 2-file baseline (`storage.rules.test.ts` env limit, stale `RosterView.test.ts`) | ✓ PASS (no new failing file) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| R142 | 60-03 | Per-service "Sent on this service" history (type/count/time) | ✓ SATISFIED | SC1 verified — panel + store + mount |
| R143 | 60-01/60-02/60-03 | Hard-bounce surfacing + fix affordance, via verified idempotent webhook | ✓ SATISFIED | SC2/SC3/SC4 verified — webhook + verifier + panel indicator + deep-link |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER`/"not yet implemented" markers in any phase-modified source file. The addressing fallback and recordBounce are fully implemented (not TODO stubs). The `if (!messageRef) return` in recordBounce is a documented defensive guard, not a stub.

### Deferred Items (owner-setup / deferred_human — NOT gaps)

Per the v1.7 deploy grant, these are explicitly out of this phase's scope (the goal states the webhook + index ship **UNDEPLOYED**). Already routed to `.planning/PENDING-VERIFICATION.md`; never marked passed by automation.

| # | Item | Routing |
| --- | --- | --- |
| 1 | `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`, `firebase deploy --only functions:messageWebhook` + `firestore:indexes`, Resend dashboard webhook config | owner-setup / deploy-gated |
| 2 | Live hard-bounce flips history + count increments once; confirm ±5-min tolerance + tags echo against a real event | verification_deferred_human (/gsd-verify-work 60) |
| 3 | Visual layout vs DESIGN-messaging.md §5b; "Fix email →" navigation UAT | verification_deferred_human (/gsd-verify-work 60) |

### Human Verification Required

None blocking. All human-facing verification (visual layout, live bounce, fix-navigation) is deferred-by-design to owner UAT after the owner deploys, and is already tracked in PENDING-VERIFICATION.md. No new human-verification item is raised by this verification.

### Observations (non-blocking)

- **Recipient count wording:** SC1 asks for a "recipient count"; the panel's count line renders `{{ deliveryCounts.sent }} sent` (the delivered leaf) rather than the sent+failed+bounced total the plan's task text described. This still satisfies the ROADMAP SC1 ("a count per message") and is within the scope of the deferred visual UAT. Noted for the owner's visual pass; not a gap.

### Gaps Summary

No genuine (non-deferred, non-owner-deploy) gaps. Every ROADMAP success criterion is implemented in live code, correctly wired end-to-end, and exercised by passing tests — including the two security-critical invariants (SC3 verify-first zero-Firestore-on-bad-signature, proven by `getFirestore.not.toHaveBeenCalled()`; SC4 idempotent duplicate no-op, proven by count==1 across two deliveries). The webhook's HMAC verifier matches the confirmed Svix scheme byte-for-byte, the secret is confined to a single Function and absent from the client, no npm dependency was added, and the client panel reads nested paths under existing rules. All gate commands pass, with the app suite at exactly the documented 2-file known-failing baseline. Remaining deploy + visual/live UAT are deferred by the v1.7 grant and correctly routed.

---

_Verified: 2026-08-14_
_Verifier: Claude (gsd-verifier)_
