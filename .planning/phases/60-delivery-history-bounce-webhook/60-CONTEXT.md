# Phase 60: Delivery History & Bounce Webhook - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas defaulted per the v1.7 standing autonomy grant; grounded in `.planning/research/ARCHITECTURE.md` §Bounce webhook / §Data Model, the Phase 59 send path already shipped, and the STATE.md webhook trust-boundary mandate)

<domain>
## Phase Boundary

Two deliverables on top of Phase 59's send path: (1) a per-service **"Sent on this service" delivery-history
panel**, and (2) a **`messageWebhook` HTTP Function** that receives the provider's delivery/bounce events,
verifies the signature over the RAW body before any Firestore access, and surfaces hard bounces.

Requirements: R142 (per-service history listing every message with type / recipient count / send time),
R143 (hard bounces surfaced per message with an affordance to fix the bad address).

**This is the milestone's new unauthenticated trust boundary** (STATE.md grant §"The bounce webhook is a
new unauthenticated trust boundary"): the webhook MUST verify the provider HMAC signature over the raw
request body BEFORE any Firestore write — a forgeable webhook is a live write hole. Treated with the same
rules-first / verify-first discipline as v1.5's security work.

Out of this phase:
- Automatic lock / re-lock / scheduled notifications → Phases 61–62.
- Soft-bounce / complaint / open tracking — v1.7 tracks **sent + HARD bounces only** (locked decision;
  soft bounces logged, never surfaced as a user-facing failure; opens out of scope).
- The provider webhook-URL configuration in the Resend dashboard is an OWNER step after deploy.
</domain>

<decisions>
## Implementation Decisions

### `messageWebhook` — dedicated `onRequest` HTTP Function, signature-verified before any Firestore access (R143)
- A NEW `onRequest` Function in `functions/src/index.ts`, SEPARATE from the existing `api` proxy (which is
  outbound proxying with Firebase-Auth-gated secret injection — a fundamentally different trust boundary).
  Mirrors the `api` `onRequest` shape (`functions/src/index.ts:119`) for the wrapper, handler body exported
  separately for unit testing (the codebase convention).
- **Signature verification FIRST, before ANY Firestore read/write** (STATE.md mandate; ARCHITECTURE
  §Bounce webhook step 1): read the raw request body, verify the provider signature; on missing/malformed/
  invalid signature respond **401/400 with ZERO Firestore access**. Only after a valid signature does the
  handler parse the event and touch Firestore. Success criterion 3.
  - **Raw body is load-bearing** — the HMAC is computed over the exact received bytes. In Cloud Functions
    v2 (`onRequest`), use `req.rawBody` (Firebase provides it) for the HMAC input, NOT a re-serialized
    `req.body` (key reordering/whitespace would break verification). Flag this as a known pitfall for the
    planner/executor.
- **Secret**: `RESEND_WEBHOOK_SECRET = defineSecret("RESEND_WEBHOOK_SECRET")`, bound ONLY to
  `messageWebhook` (mirrors how `RESEND_API_KEY` binds only to `sendQueuedMessage`). Owner-set via
  `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`. Never in `.env.local`, never in the client.
- **DEFAULTED grey area — Svix vs manual HMAC:** Resend signs webhooks via **Svix** (headers
  `svix-id`, `svix-timestamp`, `svix-signature`; HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}`
  with a base64 secret, `whsec_`-prefixed, timing-safe compare, timestamp-tolerance to stop replay).
  **Default: verify manually with node's built-in `crypto`** (≈30 lines, fully unit-testable, NO new npm
  dependency — avoids another supply-chain install gate). The phase research must confirm Resend's exact
  current scheme so the manual impl matches byte-for-byte; if the scheme is materially more complex than
  documented, the fallback is to add the official `svix` package (exact-pinned, functions-only) — but the
  manual path is preferred. STATE this decision in the plan.
- **Addressing the recipient doc from the event** (ARCHITECTURE §Bounce webhook step 3): 59-03 sends each
  email with Resend `tags: [{orgId},{serviceId},{messageId},{recipientId}]` AND stores `providerMessageId`
  (Resend `data.id`) on each `recipients/{id}` doc. **Primary path:** read `{orgId,serviceId,messageId,
  recipientId}` from the echoed tags → address the exact doc path, no query. **Fallback (research must
  confirm which Resend actually echoes in webhook payloads):** if tags are NOT echoed, match on the
  provider message id via `collectionGroup('recipients').where('providerMessageId','==', data.email_id)`
  (Admin SDK bypasses rules; scoped by the unique provider id). Design BOTH; prefer tags.
- **Event handling:** parse event type — `email.bounced` (hard) surfaces; `email.delivered` may confirm;
  `email.complained` / soft bounce → logged, NOT surfaced (locked decision). Respond `200 OK` fast; the
  count rollup is best-effort/non-blocking to the ack (providers retry on non-2xx).

### Idempotent bounce write (R143, success criterion 4)
- A duplicate webhook delivery for the same event must be a **safe no-op**, never a double count. The
  `recipients/{id}.status` overwrite to `'bounced'` (+ `bounceReason`, `bouncedAt`) is naturally idempotent
  (same-value write). **The risk is `deliveryCounts.bounced`**: a bare `FieldValue.increment(1)` on every
  webhook would double-count on retry. **Decision:** run a Firestore **transaction** that reads the
  recipient's current status and increments `messages/{id}.deliveryCounts.bounced` ONLY when the status was
  not already `'bounced'` (transition-guarded increment) — the same discipline as 59-03's transactional
  idempotency claim. Explicit test: two identical webhook deliveries → status bounced once, count == 1.

### `deliveryCounts.bounced` (data-model addition)
- Phase 59 shipped `messages/{id}.deliveryCounts = { sent, failed }`. Phase 60 ADDS a `bounced` leaf,
  written by the webhook. The history panel reads `{ sent, failed, bounced }`. No migration needed —
  treat a missing `bounced` as 0 in the UI (older docs).

### Delivery-history panel — "Sent on this service" (R142, R143)
- A new client panel/section on the service (likely on `ServiceEditorView.vue`, near where the composer
  mounts, or a dedicated tab/section) listing each `messages/{id}` for the service: **type** (map
  `oneoff→One-off`, `reminder→Reminder`/automatic, `share-link→Share link`, `lock-notification`/
  `relock-notification`→automatic), **recipient count** (from `deliveryCounts` / the recipients
  subcollection), and **send time** (`sentAt`, or `scheduledFor` when still scheduled). Success criterion 1.
- **Hard bounce surfacing** (R143): when a message has `deliveryCounts.bounced > 0`, show a per-message
  bounce indicator; expanding reveals which recipients bounced (read the `recipients` subcollection,
  `status==='bounced'`) with **an affordance to fix the bad address** — DEFAULT: a link/button routing to
  that person's roster edit (the roster `Person.email` is the source of truth; fixing it there is the durable
  fix). Success criterion 2. Reads only; no new write path from the panel.
- Gated by `isMessagingEnabled()` like the composer (a fresh org with messaging off shows no history
  surface). Reads use the Phase 58 rules (`messages` read = isOrgMember, `recipients` read = isOrgMember —
  already deployed-gated).

### Firestore rules
- The `messages` and `recipients` READ rules (isOrgMember) already shipped in Phase 58; the webhook WRITES
  via Admin SDK (bypasses rules). **Expected: NO new client-facing rules this phase.** IF the fallback
  `collectionGroup('recipients')` query is used, that is Admin-SDK server-side (bypasses rules) — but if any
  CLIENT collectionGroup read is introduced for the history panel, it needs its own rule + a genuine
  ALLOW-case test (per CLAUDE.md's storage.rules incident). Prefer nested-path client reads to avoid this.
  Any rules change ships deploy-gated with the exact command.

### Deploy-gated (v1.7 grant)
- `messageWebhook` ships built/tested/UNDEPLOYED. Owner steps handed over: `firebase functions:secrets:set
  RESEND_WEBHOOK_SECRET`, `firebase deploy --only functions:messageWebhook`, then configure the webhook URL
  + signing secret in the Resend dashboard. Route all of these to `.planning/PENDING-VERIFICATION.md`.

### Claude's Discretion
- Panel placement (inline section vs tab vs modal) and the exact "fix address" affordance (deep-link vs
  inline edit), the manual-HMAC helper's file location, and whether delivered-events update a per-recipient
  `delivered` flag — all at implementer discretion, guided by the UI-SPEC, ARCHITECTURE, and conventions.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/index.ts::api` (`onRequest`, ~119-210) — the `onRequest` wrapper shape + handler-exported-
  for-test convention for `messageWebhook`.
- `functions/src/index.ts` — 59-03's `sendQueuedMessage` writes `recipients/{id}` with `providerMessageId`
  + `bouncedAt:null` (~1279-1336) and `messages/{id}.deliveryCounts = { sent, failed }` (~1345); the webhook
  reads/updates these. `RESEND_API_KEY = defineSecret(...)` (~18-20) is the secret-binding precedent for
  `RESEND_WEBHOOK_SECRET`. The transactional idempotency claim in `sendQueuedMessageHandler` (~1181) is the
  transition-guarded-write precedent for the bounce-count guard.
- `src/utils/messaging.ts::isMessagingEnabled()` — gates the history panel like the composer.
- `src/components/MessageComposer.vue` / `ServiceEditorView.vue` (Phase 59) — where the history panel mounts;
  `PptxImportModal.vue` modal idiom if the panel is a modal.
- `src/stores/services.ts` — the `services` store; a new subscription/read for a service's `messages`
  subcollection (nested-path read, isOrgMember rule).
- `firestore.rules` `services/{id}/messages` + `/recipients` read blocks (Phase 58) — already gate the panel reads.
- Node built-in `crypto` (`createHmac`, `timingSafeEqual`) — manual signature verification, no new dep.

### Established Patterns
- Signature/verify-first before any state access (new here, but mirrors the "re-validate before acting"
  stance of `parsePptxHandler`).
- Transactional transition-guarded writes for idempotency (59-03).
- Handler body exported separately from the Function wrapper for direct unit testing.
- Secret bound only to the one Function that needs it.

### Integration Points
- `functions/src/index.ts` (new `messageWebhook` + `RESEND_WEBHOOK_SECRET`), the client history panel
  (`ServiceEditorView.vue` + a new component + a store read), `deliveryCounts.bounced` leaf. Roster is the
  fix-address target (read-only link). No changes to the send path itself.
</code_context>

<specifics>
## Specific Ideas
- Verify-first is non-negotiable: no Firestore access on an unsigned/malformed request (401/400, zero writes).
- Idempotent count: transition-guarded increment, proven by a duplicate-delivery test.
- Hard bounces only — soft bounces/opens are out of scope; the "fix address" affordance points at the roster.
- Only `messageWebhook` holds `RESEND_WEBHOOK_SECRET`; only `sendQueuedMessage` holds `RESEND_API_KEY`.
</specifics>

<deferred>
## Deferred Ideas
- Automatic lock / re-lock / scheduled-reminder sends → Phases 61–62.
- Soft-bounce/complaint/open analytics — out of scope for v1.7.
- Provider webhook-URL + signing-secret dashboard configuration → OWNER, after deploy.
- Retry/resend of a bounced message from the history panel — not in R142/R143; a candidate for a later
  milestone.
</deferred>
