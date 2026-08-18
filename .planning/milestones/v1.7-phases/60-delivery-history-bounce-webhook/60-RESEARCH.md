# Phase 60: Delivery History & Bounce Webhook - Research

**Researched:** 2026-08-14
**Domain:** Vue 3 delivery-history panel + an **unauthenticated** Firebase `onRequest` webhook that verifies a **Svix/Standard-Webhooks HMAC-SHA256 signature over the raw body BEFORE any Firestore access**
**Confidence:** HIGH — the Svix signature scheme is confirmed against the official Svix manual-verification docs and Resend's own webhook pages; every codebase claim is anchored to a live `file:line`; the one genuine uncertainty (whether Resend echoes custom send-time tags) is flagged with a robust fallback that does not depend on it.

## Summary

Phase 60 adds two things on top of Phase 59's shipped send path: (1) a **read-only client history panel** ("Sent on this service") that lists each `messages/{id}` for a service with type / recipient count / send time and surfaces hard bounces with a "fix the address" affordance, and (2) a **new `messageWebhook` `onRequest` Function** that receives Resend's delivery/bounce events, **verifies the Svix HMAC signature over `req.rawBody` before touching Firestore**, and — only on a valid signature — flips the addressed `recipients/{id}` doc to `status:'bounced'` and does a **transition-guarded increment** of `messages/{id}.deliveryCounts.bounced`.

The critical unknown — Resend's webhook signature scheme — is **CONFIRMED**. Resend signs via **Svix / the Standard Webhooks spec**. Headers are `svix-id`, `svix-timestamp`, `svix-signature`. The signed content is exactly **`` `${svix-id}.${svix-timestamp}.${rawBody}` ``**. The algorithm is **HMAC-SHA256, base64-encoded**. The signing secret is **`whsec_`-prefixed and the part after the prefix is base64** — you strip `whsec_` and **base64-decode the remainder to get the HMAC key bytes**. The `svix-signature` header is a **space-delimited list of `v1,<base64sig>` entries** (there can be several during key rotation) — accept if ANY entry matches. This is ~30 lines of node built-in `crypto` and is **fully unit-testable with no new dependency** — the DEFAULT recommendation stands: **verify manually, do NOT add the `svix` package.**

**Primary recommendation:** Build `messageWebhookHandler(rawBody, headers)` exported separately from the `onRequest` wrapper (the codebase convention); verify the Svix signature first and return **401 with ZERO Firestore access** on any missing/malformed/invalid/stale signature; then parse the event, address the recipient doc, and idempotently record the bounce inside a transaction that reads current status and only increments `deliveryCounts.bounced` on the `not-bounced → bounced` transition. For addressing, **prefer the echoed `data.tags` (direct doc path, no query, no index); fall back to `collectionGroup('recipients').where('providerMessageId','==', data.email_id)`** — `data.email_id` is contractually present in every event and is exactly what 59-03 stored as `providerMessageId`. Ship the collection-group index for the fallback deploy-gated so the fallback actually works if tags are ever absent. The history panel reads `messages` + `recipients` via **nested-path reads under the already-shipped Phase 58 `isOrgMember` rules — NO new client rule.**

<user_constraints>
## User Constraints (from 60-CONTEXT.md)

### Locked Decisions
- **`messageWebhook` = a NEW `onRequest` HTTP Function**, SEPARATE from the existing `api` proxy, in `functions/src/index.ts`. Wrapper mirrors the `api` `onRequest` shape (`functions/src/index.ts:140`); handler body exported separately for unit testing.
- **Signature verification FIRST, before ANY Firestore read/write.** On missing/malformed/invalid signature → respond **401/400 with ZERO Firestore access.** Only after a valid signature does the handler parse the event and touch Firestore. The HMAC is computed over the **raw received bytes** — use **`req.rawBody`** (Cloud Functions v2 provides it), NOT a re-serialized `req.body`.
- **Secret:** `RESEND_WEBHOOK_SECRET = defineSecret("RESEND_WEBHOOK_SECRET")`, bound **ONLY to `messageWebhook`** (mirrors `RESEND_API_KEY` binding only to `sendQueuedMessage`). Owner-set via `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`. Never in `.env.local`, never in the client.
- **DEFAULTED grey area — Svix vs manual HMAC:** Resend signs via **Svix** (`svix-id`/`svix-timestamp`/`svix-signature`; HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}` with a base64, `whsec_`-prefixed secret; timing-safe compare; timestamp tolerance to stop replay). **Default: verify manually with node's built-in `crypto`** — no new npm dependency. Adding the official `svix` package is the fallback ONLY if the manual path is materially error-prone.
- **Addressing the recipient doc:** 59-03 sends `tags: [{orgId},{serviceId},{messageId},{recipientId}]` AND stores `providerMessageId` (Resend `data.id`). **Primary: read the echoed tags → address the exact doc path, no query. Fallback:** `collectionGroup('recipients').where('providerMessageId','==', data.email_id)` (Admin SDK). Design BOTH; prefer tags.
- **Event handling:** `email.bounced` (hard) surfaces; `email.delivered` may confirm; `email.complained` / soft bounce → logged, NOT surfaced. Respond `200 OK` fast; count rollup is best-effort/non-blocking to the ack (providers retry on non-2xx).
- **Idempotent bounce write:** duplicate webhook delivery = safe no-op, never a double count. The `status:'bounced'` overwrite is naturally idempotent; the risk is `deliveryCounts.bounced` — run a **transaction** that reads current recipient status and increments the count ONLY when status was not already `'bounced'` (transition-guarded). Explicit test: two identical deliveries → status bounced once, count == 1.
- **`deliveryCounts.bounced`** = a new leaf added by the webhook; the panel reads `{ sent, failed, bounced }`; treat a missing `bounced` as 0 (older docs). No migration.
- **History panel** ("Sent on this service") on the service (likely `ServiceEditorView.vue`) listing each `messages/{id}`: type, recipient count (from `deliveryCounts` / recipients), send time (`sentAt`, or `scheduledFor` when scheduled). Hard-bounce surfacing when `deliveryCounts.bounced > 0`; expand → which recipients bounced (`recipients` where `status==='bounced'`) + a **fix-address affordance** (DEFAULT: deep-link to that person's roster edit). Reads only; no new write path from the panel. Gated by `isMessagingEnabled()`.
- **Firestore rules:** `messages`/`recipients` READ rules (isOrgMember) already shipped in Phase 58; the webhook WRITES via Admin SDK (bypasses rules). **Expected: NO new client-facing rules.** If a CLIENT `collectionGroup` read were introduced it needs its own rule + a genuine ALLOW-case test — **prefer nested-path client reads** to avoid this.
- **Deploy-gated:** `messageWebhook` ships built/tested/UNDEPLOYED. Owner steps → `.planning/PENDING-VERIFICATION.md`: `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`, `firebase deploy --only functions:messageWebhook`, then configure the webhook URL + signing secret in the Resend dashboard.

### Claude's Discretion
- Panel placement (inline section vs tab vs modal) and the exact "fix address" affordance (deep-link vs inline edit), the manual-HMAC helper's file location, and whether delivered-events update a per-recipient `delivered` flag.

### Deferred Ideas (OUT OF SCOPE)
- Automatic lock / re-lock / scheduled-reminder sends → Phases 61–62.
- Soft-bounce / complaint / open analytics — out of scope for v1.7 (soft bounces logged, never surfaced; opens out).
- Provider webhook-URL + signing-secret dashboard configuration → OWNER, after deploy.
- Retry/resend of a bounced message from the history panel — not in R142/R143; a later-milestone candidate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R142 | Per-service delivery history listing every message with type / recipient count / send time. | Nested-path client read of `messages/{id}` under the service (Phase 58 `isOrgMember` rule, `firestore.rules:142`); type from `messages.type` (Phase 59 enum), recipient count from `deliveryCounts` (`{sent,failed}` shipped 59-03 `functions/src/index.ts:1345`, `bounced` added this phase), send time from `sentAt`/`scheduledFor`. |
| R143 | Hard bounces surfaced per message with an affordance to fix the bad address. | `messageWebhook` verifies the Svix signature over `req.rawBody`, addresses `recipients/{id}` from echoed tags (fallback `providerMessageId==data.email_id`), sets `status:'bounced'`, transition-guarded `deliveryCounts.bounced++`. Panel reads `recipients` where `status==='bounced'` (nested-path, `firestore.rules:151`) → deep-link to roster edit of `Person.email` (source of truth). Only `email.bounced` with `bounce.type==='Permanent'` surfaces. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Signature verification over raw bytes | API / Backend (`messageWebhook` `onRequest`) | — | The HMAC must be computed over the exact received bytes; only the server holds `RESEND_WEBHOOK_SECRET`. This is the milestone's new **unauthenticated trust boundary** — verify before any state access. |
| Bounce persistence + transition-guarded count | Database / Storage (Firestore, Admin SDK, transaction) | — | Admin-SDK-only; the webhook is the sole writer of `status:'bounced'` and `deliveryCounts.bounced`; rules deny all client writes here (`firestore.rules:144,152`). |
| Recipient-doc addressing from the event | API / Backend (`messageWebhook`) | — | Tags (or the `providerMessageId` fallback) map an opaque provider event onto the exact `recipients/{id}` doc path. |
| History panel: list messages, recipient counts, send time | Browser / Client (new component on `ServiceEditorView.vue`) | Database (nested-path reads) | Pure presentation over already-permitted `isOrgMember` reads; no round-trip to a Function. |
| Hard-bounce surfacing + "fix address" affordance | Browser / Client | — | Reads `recipients` where `status==='bounced'`; the fix is a deep-link to roster edit (`Person.email` is the source of truth). Read-only — no new client write path. |
| Feature gate (kill-switch) | Client (`isMessagingEnabled()`) | — | The panel is hidden when messaging is off, mirroring the composer (Phase 59). The webhook itself is provider-facing and is not gated by the kill-switch. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` (built-in) | Node 22 runtime | `createHmac('sha256', keyBytes)` + `timingSafeEqual` for manual Svix verification | Zero new dependency, fully unit-testable, no supply-chain install gate. The Svix scheme is simple enough to implement in ~30 lines `[CITED: docs.svix.com/receiving/verifying-payloads/how-manual]`. |
| `firebase-functions` | `^7.2.5` (already installed) | `onRequest` + `defineSecret` | Already the runtime (`functions/package.json`). `req.rawBody` (Buffer) is provided by the platform for `onRequest`. No change. |
| `firebase-admin` | `^13.10.0` (already installed) | Admin-SDK Firestore reads/writes + `runTransaction` for the transition-guarded count | Already installed; bypasses rules by design (the webhook is the sole writer of bounce state). |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.1.10` (functions) | Handler-body unit tests (valid/tampered/missing signature, idempotent duplicate) | Already the functions runner (`functions/package.json:9`). |
| Vue 3 + Pinia (client, already installed) | — | The history panel component + a `messages`/`recipients` store read | Mirrors existing service subscriptions (`src/stores/services.ts`). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `node:crypto` verification | The official **`svix`** npm package (`svix.Webhook(secret).verify(rawBody, headers)`) | `svix` is correct and terse, but it is **another functions-only supply-chain install** requiring the full package-legitimacy gate + a `checkpoint:human-verify`. The manual path is ~30 lines, testable, and the scheme is fully documented — **not materially error-prone → do NOT add `svix`.** Only revisit if a scheme quirk surfaces in verification. |
| Tags-based direct addressing | `providerMessageId` collection-group query only | Tags need no index/query but depend on the (documented-but-not-guaranteed-in-the-official-bounced-example) tags echo; the `providerMessageId` path is contractually reliable but needs a collection-group index. **Ship both**; prefer tags, keep the index for the fallback. |
| `FieldValue.increment(1)` for the bounce count | Read-and-write-literal inside the transaction | `increment` double-counts on webhook retry unless guarded; reading current status + writing `bounced+1` only on transition is race-safe AND matches 59-03's literal-count style (`deliveryCounts:{sent,failed}` are literals, `functions/src/index.ts:1345`), so the test harness needs no `FieldValue.increment` mock. |

**Installation:** **None.** This phase adds **no new npm dependency** (the DEFAULT). The manual verifier uses node's built-in `crypto`.

**Version verification:** N/A — no package installed. (If the `svix` fallback were ever taken: `npm view svix version` and the full legitimacy gate would be required; it is NOT taken here.)

## Package Legitimacy Audit

> **No external package is installed this phase.** The manual `node:crypto` path is the locked default. The audit below documents the `svix` fallback *only* so the planner knows the gate that applies IF it were ever taken.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | **No install this phase** |
| `svix` (fallback only, NOT installed) | npm | mature | high | `github.com/svix/svix-webhooks` | not run (not installed) | **Would require full legitimacy gate + `checkpoint:human-verify` IF taken.** Manual path preferred → not taken. |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious (SUS):** none — nothing is installed.

## Architecture Patterns

### System Architecture Diagram

```
Resend (provider)                                      Client (browser)
  │  POST webhook                                         │
  │  headers: svix-id, svix-timestamp, svix-signature     │  DeliveryHistoryPanel.vue (new)
  │  body (raw bytes): { type:'email.bounced',            │   gated by isMessagingEnabled()
  │                      created_at, data:{ email_id,     │   │
  │                      tags:{orgId,serviceId,...},      │   │ nested-path reads (isOrgMember, Phase 58 rules)
  │                      bounce:{type:'Permanent',...} }} │   ▼
  ▼                                                       │  services/{id}/messages/{id}     → type, deliveryCounts, sentAt
messageWebhook (onRequest, HOLDS RESEND_WEBHOOK_SECRET)   │  services/{id}/messages/{id}/recipients/{id}
  │  handler body exported separately (unit-testable)     │        where status==='bounced'  → bad addresses
  │                                                        │   │
  │  ① read req.rawBody (Buffer) + svix-* headers          │   ▼ "fix address" → deep-link to roster edit
  │  ② VERIFY SIGNATURE FIRST  ───────── invalid/missing/  │      (Person.email = source of truth)
  │     │  signed = `${id}.${ts}.${rawBody}`     stale ────┼──▶ 401/400, ZERO Firestore access
  │     │  key = base64decode(secret.slice('whsec_'.len))  │
  │     │  hmac = HMAC_SHA256(key, signed) → base64         │
  │     │  accept if any `v1,<sig>` in header matches       │
  │     │  (timingSafeEqual) AND |now-ts| ≤ tolerance       │
  │     ▼ VALID                                             │
  │  ③ parse event; if not email.bounced+Permanent →        │
  │       log (soft/complaint/delivered) and 200, no write  │
  │  ④ address recipients/{id}:                             │
  │       primary  → path from data.tags {orgId,serviceId,  │
  │                  messageId,recipientId}                 │
  │       fallback → collectionGroup('recipients')          │
  │                  .where('providerMessageId','==',       │
  │                         data.email_id)                  │
  │  ⑤ TRANSACTION (idempotent): read recipient.status;     │
  │       if !== 'bounced' → set status:'bounced',          │
  │         bounceReason, bouncedAt; and on the message     │
  │         doc write deliveryCounts.bounced = prev+1       │
  │       else → no-op (duplicate delivery)                 │
  ▼  200 OK (fast; rollup best-effort — non-2xx triggers provider retry)
```

### Recommended Structure (files this phase touches)
```
functions/src/
├── index.ts                       # + RESEND_WEBHOOK_SECRET defineSecret
│                                   # + messageWebhookHandler(rawBody, headers) exported
│                                   # + export const messageWebhook = onRequest({secrets:[...]}, ...)
├── svixVerify.ts (NEW, discretion) # verifySvixSignature(rawBody, headers, secret): boolean
│                                   #   — pure, node:crypto only, unit-tested in isolation
└── index.test.ts                  # + describe('messageWebhookHandler'): valid→writes,
                                    #   missing/tampered→401 + ZERO Firestore, duplicate→count==1
functions/                         # + firestore.indexes.json: collection-group index on
                                    #   recipients.providerMessageId (deploy-gated, for the fallback)

src/
├── components/DeliveryHistoryPanel.vue          # NEW (name at discretion)
├── components/__tests__/DeliveryHistoryPanel.test.ts  # NEW
├── views/ServiceEditorView.vue                  # + mount the panel (gated by isMessagingEnabled())
└── stores/services.ts (or a small new read)     # nested-path read of a service's messages + recipients
```

### Pattern 1: `onRequest` wrapper with handler body exported for test (verified precedent)
**What:** The `onRequest` wrapper attaches the secret and delegates to an exported handler function.
**Example (verified precedent — the `api` proxy):**
```typescript
// Source: functions/src/index.ts:140-142
export const api = onRequest(
  { secrets: [CLAUDE_API_KEY, ESV_API_KEY, NLT_API_KEY] },
  async (req, res) => { /* ... */ },
);
```
`messageWebhook` mirrors this: `onRequest({ secrets: [RESEND_WEBHOOK_SECRET] }, async (req, res) => { const ok = await messageWebhookHandler(req.rawBody, req.headers, RESEND_WEBHOOK_SECRET.value()); res.status(ok.status).send(ok.body); })`. Export `messageWebhookHandler` separately (the codebase convention — cf. `sendQueuedMessageHandler` / `requestPptxRenderHandler`) so it is unit-testable with a fake `{ rawBody, headers }` and no `res`.

### Pattern 2: Secret bound only to the one Function that needs it (verified precedent)
```typescript
// Source: functions/src/index.ts:41 (RESEND_API_KEY) + :1356-1360 (bound ONLY to sendQueuedMessage)
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
export const sendQueuedMessage = onDocumentCreated(
  { document: ".../messages/{messageId}", secrets: [RESEND_API_KEY] }, ...);
```
Add `export const RESEND_WEBHOOK_SECRET = defineSecret("RESEND_WEBHOOK_SECRET");` next to line 41, bound ONLY in `messageWebhook`'s `{ secrets: [RESEND_WEBHOOK_SECRET] }`. Do NOT add it to `sendQueuedMessage` or `api`.

### Pattern 3: Transactional transition-guarded write for idempotency (verified precedent)
```typescript
// Source: functions/src/index.ts:1181-1191 (sendQueuedMessage's queued->sending claim)
const claim = await db.runTransaction(async (tx) => {
  const snap = await tx.get(messageRef);
  if (!snap.exists) return { claimed: false as const };
  const data = snap.data();
  if (!data || data.status !== "queued") return { claimed: false as const };  // guard
  tx.update(messageRef, { status: "sending", ... });
  return { claimed: true as const };
});
```
The bounce write mirrors this exactly: read `recipients/{id}.status`; only if it is NOT already `'bounced'` do you set it to `'bounced'` AND write `messages/{id}.deliveryCounts.bounced = prevBounced + 1` (read the message's current `bounced` inside the same transaction and write the literal — do not use `FieldValue.increment`). A duplicate delivery finds `status==='bounced'` and no-ops → count stays 1.

### Pattern 4: Manual Svix verification (node:crypto, ~30 lines)
```typescript
// Source: docs.svix.com/receiving/verifying-payloads/how-manual  [CITED]
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySvixSignature(
  rawBody: Buffer,               // req.rawBody — exact received bytes
  headers: Record<string, string | string[] | undefined>,
  secret: string,               // "whsec_<base64>"
  toleranceSec = 300,           // 5-minute replay window (Svix library default)
): boolean {
  const id = hdr(headers, "svix-id");
  const ts = hdr(headers, "svix-timestamp");
  const sigHeader = hdr(headers, "svix-signature");
  if (!id || !ts || !sigHeader) return false;

  // replay window
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > toleranceSec) return false;

  // key bytes: strip "whsec_", base64-decode the remainder
  const keyBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");

  // signed content: `${id}.${ts}.${rawBody}`  (rawBody as UTF-8 bytes/string)
  const signedContent = `${id}.${ts}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", keyBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected);

  // header is space-delimited "v1,<base64sig> v1,<base64sig> ..."; accept ANY match
  for (const part of sigHeader.split(" ")) {
    const comma = part.indexOf(",");
    const sig = comma >= 0 ? part.slice(comma + 1) : part;   // strip "v1,"
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) return true;
  }
  return false;
}
```
`hdr()` normalizes a possibly-array header to a single string. **`timingSafeEqual` throws on unequal buffer lengths — guard with the length check first** (as above) or it becomes a crash, not a `false`.

### Anti-Patterns to Avoid
- **Hashing `req.body` (parsed/re-serialized) instead of `req.rawBody`:** JSON parse→stringify reorders keys and changes whitespace → the HMAC never matches. The raw bytes are load-bearing. Assert `Buffer.isBuffer(req.rawBody)` in the handler.
- **Any Firestore read/write before the signature check passes:** the whole point of this trust boundary. An unsigned request must reach ZERO Firestore calls (assert the Firestore mock was never invoked in the test).
- **`FieldValue.increment(1)` on the bounce count without a transition guard:** double-counts on the provider's at-least-once retries. Guard on the recipient's current status inside a transaction.
- **Returning non-2xx on a *processing* error (e.g. recipient not found):** Resend retries on non-2xx. A validly-signed event whose recipient can't be located should be **logged and 200'd** (or 200 after a best-effort write), not 4xx/5xx — otherwise it retries forever. Reserve 401/400 for **signature** failures only.
- **A client `collectionGroup('recipients')` read for the panel:** needs a new rule + a genuine ALLOW-case test (per the CLAUDE.md storage.rules incident). Use **nested-path reads** — the panel already knows the `orgId/serviceId`, so it reads `messages/{id}` and `messages/{id}/recipients` directly under the Phase 58 `isOrgMember` rules.
- **Gating the webhook on `isMessagingEnabled()`:** the kill-switch is a client/composer concept; the webhook is provider-facing and must accept events regardless (only the signature gates it).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC / constant-time compare | A hand-rolled hash or `===` string compare | `node:crypto` `createHmac('sha256', …)` + `timingSafeEqual` | `===` leaks timing; crypto is built-in and correct. (This is the *scheme* implemented manually — not the *primitives*.) |
| Raw request bytes | Re-serializing `req.body` to bytes | `req.rawBody` (Firebase provides the Buffer) | Re-serialization changes the bytes → signature mismatch. |
| Recipient-doc addressing | A new bespoke index scheme | Echoed `data.tags` path (primary) / `providerMessageId==data.email_id` collection-group query (fallback) | Both already exist in the data (59-03 wrote both). No new addressing model. |
| Idempotent count | A bare `increment` + hope | `runTransaction` transition guard (Pattern 3) | Only a read-guarded transaction is safe against at-least-once retries. |
| Bounce hard/soft classification | Parsing free-text diagnostic codes | `data.bounce.type === 'Permanent'` (hard) vs `'Transient'` (soft) | Resend classifies for you `[CITED: resend.com/docs/webhooks/emails/bounced]`. |

**Key insight:** The only genuinely new logic is (a) the ~30-line Svix verifier, (b) the verify-first webhook handler, (c) the transition-guarded bounce write, and (d) the read-only history panel. Everything else is reuse of shipped patterns. Treat (a)–(c) as the security-critical risk surface and test each branch explicitly.

## Confirmed Resend / Svix Signature Scheme (the critical unknown)

| Question | Confirmed answer | Source |
|----------|------------------|--------|
| Signing mechanism | **Svix / Standard Webhooks spec** (Resend is built on Svix) | `[CITED: resend.com/docs/dashboard/webhooks/verify-webhooks-requests]` |
| Headers | **`svix-id`, `svix-timestamp`, `svix-signature`** (Resend uses the `svix-` names, not `webhook-`) | `[CITED: resend.com/docs/.../verify-webhooks-requests]` |
| Signed content | **`` `${svix-id}.${svix-timestamp}.${rawBody}` ``** — id, timestamp, raw payload joined by `.` | `[CITED: docs.svix.com/receiving/verifying-payloads/how-manual]` |
| Algorithm | **HMAC-SHA256, output base64** | `[CITED: docs.svix.com/.../how-manual]` |
| Secret format | **`whsec_`-prefixed; strip the prefix, then base64-decode the remainder** to get the HMAC key bytes | `[CITED: docs.svix.com/.../how-manual]` — "given `whsec_MfKQ9r8…` use `MfKQ9r8…` then base64-decode it" |
| `svix-signature` header | **space-delimited list of `v1,<base64sig>` entries** (multiple during key rotation); strip the `v1,` prefix and accept if ANY entry matches | `[CITED: docs.svix.com/.../how-manual]` |
| Replay tolerance | Svix's own libraries use a **±5-minute** window; the doc says "make sure it's within your tolerance" without stating the number | `[CITED: docs.svix.com/.../how-manual]` for the requirement; **`[ASSUMED]` 5 min** as the concrete value (Svix library default) |

**Byte-for-byte impl note:** decode the secret with `Buffer.from(secret.replace(/^whsec_/,''), 'base64')`; build `signedContent` with `rawBody.toString('utf8')` (Svix signs the UTF-8 payload string); compute `createHmac('sha256', keyBytes).update(signedContent).digest('base64')`; compare (length-guarded `timingSafeEqual`) against each `v1,`-stripped entry. This matches the Svix reference snippet exactly.

## Tags Echo vs `providerMessageId` Fallback (the load-bearing addressing decision)

**What 59-03 sends** (`functions/src/index.ts:1293-1298`): `tags: [{name:'orgId',value},{name:'serviceId',value},{name:'messageId',value},{name:'recipientId',value}]` — an **array of `{name,value}`**. It also stores `providerMessageId = result.data.id` on `recipients/{id}` (`:1300,1308`), and the recipient **doc id is the personId** (`target.id`, `:1279`), which equals the `recipientId` tag value.

**What the webhook payload contains** (confirmed `email.bounced` shape):
```json
{
  "type": "email.bounced",
  "created_at": "2026-11-22T23:41:12.126Z",
  "data": {
    "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
    "tags": { "category": "confirm_email" },
    "bounce": { "type": "Permanent", "subType": "Suppressed", "message": "...", "diagnosticCode": ["..."] }
  }
}
```
`[CITED: resend.com/docs/webhooks/emails/bounced]`

- **`data.email_id` is GUARANTEED present** in every event and is exactly the value 59-03 stored as `providerMessageId` (Resend's send response `data.id` === the webhook's `data.email_id`, the same email identifier). `[CITED]` — this makes the fallback contractually reliable.
- **`data.tags` is echoed as an OBJECT** (`Record<string,string>`), NOT the array you sent. Secondary sources confirm custom send-time tags DO round-trip, flattened to `{ orgId:"…", serviceId:"…", messageId:"…", recipientId:"…" }`. `[CITED: resend.com blog/webhooks + anymail.dev resend docs]` **BUT** the official `email.bounced` example only shows a Resend-internal `category` tag, so treat "our custom tags are echoed" as **MEDIUM confidence** — do not bet correctness on it alone.

**Recommendation — build BOTH, prefer tags, keep the fallback reliable:**
1. **Primary (tags):** if `data.tags?.orgId && data.tags.serviceId && data.tags.messageId && data.tags.recipientId` are all present, address `organizations/{orgId}/services/{serviceId}/messages/{messageId}/recipients/{recipientId}` **directly (a single `.get()`, no query, no index).** Cheapest and most precise.
2. **Fallback (`providerMessageId`):** otherwise `collectionGroup('recipients').where('providerMessageId','==', data.email_id).limit(1)` (Admin SDK, bypasses rules). Each recipient send has a distinct `email_id`, so this resolves to exactly one doc. From that doc's `ref.parent.parent` you also recover the message ref for the count.
3. **The fallback needs a Firestore collection-group index** on `recipients.providerMessageId`. Add it to `firestore.indexes.json` and ship it **deploy-gated** alongside the Function, so the fallback works in production even though the happy path is tags. Without the index the collection-group query throws `FAILED_PRECONDITION`.

Because tags-echo is only MEDIUM confidence, **the fallback is the true safety net** — implement it fully and unit-test it, don't leave it as a TODO.

## Common Pitfalls

### Pitfall 1: `req.rawBody` not used (or assumed absent)
**What goes wrong:** HMAC computed over `JSON.stringify(req.body)` never matches; verification always fails.
**Root cause / avoid:** Cloud Functions v2 `onRequest` populates **`req.rawBody` as a Buffer** of the unparsed body (the same field Firebase's own Stripe-webhook examples use). Compute the HMAC over `req.rawBody`. **Verify at runtime** with `Buffer.isBuffer(req.rawBody)` and fail-closed (401) if it is missing — do not silently fall back to `req.body`. `[CITED: Firebase docs — HTTP functions rawBody]`; executor should assert it in an emulator smoke test if any doubt.
**Warning signs:** All signatures fail even with a known-good fixture; a test that stringifies the body "works" but production rejects every real event.

### Pitfall 2: `timingSafeEqual` throws on length mismatch
**What goes wrong:** An attacker-supplied (or malformed) signature of a different length makes `crypto.timingSafeEqual` **throw**, turning a clean `false` into an unhandled 500.
**How to avoid:** Length-check the two buffers before calling `timingSafeEqual` (as in Pattern 4). A length mismatch is simply "not a match."
**Warning signs:** 500s on garbage-signature requests instead of 401s; the "tampered signature" test crashes instead of asserting 401.

### Pitfall 3: Retrying forever on a processing error
**What goes wrong:** The handler returns 4xx/5xx when a validly-signed event's recipient can't be found → Resend retries indefinitely.
**How to avoid:** **401/400 is ONLY for signature failures.** A valid signature whose recipient is unresolvable → log and **200**. Ack fast; do the rollup best-effort.

### Pitfall 4: Double-counting on duplicate delivery
**What goes wrong:** `deliveryCounts.bounced` grows on every retry of the same event.
**How to avoid:** Transition-guarded transaction (Pattern 3): increment only on `not-bounced → bounced`. Test two identical deliveries → count == 1.

### Pitfall 5: Extending the test harness for the count
**What goes wrong:** The existing `firebase-admin/firestore` mock exposes only `FieldValue.serverTimestamp` (`functions/src/index.test.ts:63`) — no `increment`, and `getFirestore` has no `runTransaction`/`collectionGroup` by default.
**How to avoid:** Because the recommended count write is a **literal** (`bounced: prev+1`) inside a transaction, you need NO `FieldValue.increment`; but you DO need the test's `getFirestore` fake to provide `runTransaction` (and `collectionGroup` if the fallback path is exercised). Add these to the per-test `db` fake (Wave 0 harness gap). Do not add real `firebase-admin` behavior — extend the existing mock object shape.

### Pitfall 6: `.env.local` absent in a worktree
**What goes wrong:** Functions emulator / full app suite / `vite build` fail without secrets (per CLAUDE.md).
**How to avoid:** Symlink or copy `C:\projects\worshipplanner\.env.local` into any new worktree before emulator/build. Not relevant to the mocked unit tests (which stub `defineSecret`) — `RESEND_WEBHOOK_SECRET` is never real in tests.

## Code Examples

### Webhook handler skeleton (verify-first, exported for test)
```typescript
// mirrors functions/src/index.ts:140 (api onRequest) + :1164 (handler exported separately)
export async function messageWebhookHandler(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  webhookSecret: string,
): Promise<{ status: number; body: string }> {
  // ① VERIFY FIRST — zero Firestore access before this passes
  if (!Buffer.isBuffer(rawBody) || !verifySvixSignature(rawBody, headers, webhookSecret)) {
    return { status: 401, body: "invalid signature" };
  }
  // ② parse only after a valid signature
  const event = JSON.parse(rawBody.toString("utf8")) as ResendWebhookEvent;
  if (event.type !== "email.bounced" || event.data?.bounce?.type !== "Permanent") {
    // soft bounce / complaint / delivered / anything else → log, do not surface
    return { status: 200, body: "ok" };            // ack fast, no bounce write
  }
  // ③ address the recipient doc: tags primary, providerMessageId fallback
  const ref = await resolveRecipientRef(getFirestore(), event.data);   // returns null if unresolved
  if (!ref) return { status: 200, body: "ok" };     // valid but unresolvable → 200 (never retry-loop)
  // ④ idempotent transition-guarded bounce write (Pattern 3)
  await recordBounce(getFirestore(), ref, event.data.bounce);
  return { status: 200, body: "ok" };
}

export const messageWebhook = onRequest(
  { secrets: [RESEND_WEBHOOK_SECRET] },
  async (req, res) => {
    const out = await messageWebhookHandler(req.rawBody, req.headers, RESEND_WEBHOOK_SECRET.value());
    res.status(out.status).send(out.body);
  },
);
```

### Unit test seam (extends the existing harness)
```typescript
// Source: functions/src/index.test.ts:49-106 (existing vi.mock harness to extend)
// firebase-functions/v2/https is NOT currently mocked in this file — onRequest/HttpsError
// are imported REAL. That is fine: we test messageWebhookHandler(rawBody, headers, secret)
// DIRECTLY (no wrapper, no `res`), so onRequest is never invoked in the test.

// valid signature → writes:
//   build rawBody = Buffer.from(JSON.stringify(bouncedEvent))
//   headers = svixHeadersFor(rawBody, ts, secret)   // helper computes a real v1 sig with the same algo
//   getFirestore fake provides runTransaction + doc().get()/set()
//   assert status 200 AND the recipient set('bounced') AND message deliveryCounts.bounced == 1

// missing/tampered signature → 401 + ZERO Firestore:
//   const getFirestoreSpy = vi.mocked(getFirestore)
//   await messageWebhookHandler(rawBody, {}, secret)          // no svix headers
//   expect(result.status).toBe(401)
//   expect(getFirestoreSpy).not.toHaveBeenCalled()            // the load-bearing assertion

// duplicate delivery → idempotent:
//   run the SAME valid event twice against a fake whose recipient status is already 'bounced'
//   on the 2nd → status stays 'bounced', deliveryCounts.bounced stays 1
```

## Runtime State Inventory

Not applicable — Phase 60 is additive greenfield (a new Function + a new read-only client panel + a new `deliveryCounts.bounced` leaf on already-existing docs). No rename/refactor/migration.

- **Stored data:** None re-keyed. `deliveryCounts.bounced` is a NEW leaf; older docs simply lack it → the UI treats missing as 0. No backfill.
- **Live service config:** The Resend **webhook URL + signing secret** must be configured in the Resend dashboard — an **OWNER** step after deploy (routed to `PENDING-VERIFICATION.md`), not a repo change.
- **OS-registered state:** None.
- **Secrets/env vars:** One NEW secret, `RESEND_WEBHOOK_SECRET`, set via `firebase functions:secrets:set` (OWNER). Never in `.env.local`, never client-side. Not a rename of anything.
- **Build artifacts:** None — no package installed, no generated artifact. (The `firestore.indexes.json` collection-group index for the fallback is a config addition, deploy-gated.)

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` → treated as **enabled**.

### Test Frameworks (two separate suites)
| Property | App suite (client) | Functions suite (server) |
|----------|--------------------|--------------------------|
| Framework | Vitest (root, jsdom) | Vitest `^4.1.10` (node) |
| Config | `vite.config.ts` `test` block | `functions/vitest.config.ts` (env `node`) |
| Quick run command | `npx vitest run <file>` | `cd functions && npx vitest run src/index.test.ts` |
| Full suite command | `npx vitest run` (bare — excludes `rules.test.ts`, `render-service/**`, `functions/lib/**` per CLAUDE.md) | **`cd functions && npm test`** (= `vitest run`) |
| Typecheck gate | `npm run type-check` (`vue-tsc --build`, **includes test files** — per CLAUDE.md; the narrow `-p tsconfig.app.json` form is NOT sufficient evidence) | `cd functions && npm run build` (= `tsc`) |

**Known-failing app-suite baseline (per CLAUDE.md, do NOT chase):** `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). A Phase 60 change is regression-free if it adds no *new* failing app-suite file beyond these two.

### Phase Requirements → Test Map
| Req / Invariant | Behavior | Test Type | Automated Command | Suite / File | Exists? |
|-----------------|----------|-----------|-------------------|--------------|---------|
| **SIG (R143)** | Valid Svix signature over rawBody → handler proceeds and writes | unit | `cd functions && npx vitest run src/index.test.ts` | functions / `index.test.ts` (new describe) | ❌ Wave 0 |
| **SIG (R143)** | Missing svix-* headers → **401 + ZERO Firestore** (`getFirestore` mock never called) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **SIG (R143)** | Tampered signature (body changed after signing) → 401 + ZERO Firestore | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **SIG (R143)** | Stale timestamp (outside ±5 min) → 401 (replay defense) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **SIG (R143)** | `verifySvixSignature` unit: multi-`v1,` header accepts a matching entry; wrong-length sig → false (not throw) | unit | `cd functions && npx vitest run src/svixVerify.test.ts` (or in index.test.ts) | functions | ❌ Wave 0 |
| **BOUNCE (R143)** | Valid `email.bounced`/`Permanent` → recipient `status:'bounced'` (+`bounceReason`,`bouncedAt`); `deliveryCounts.bounced == 1` | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **BOUNCE (R143)** | Duplicate delivery of same event → status stays bounced, count stays **1** (transition guard) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **BOUNCE (R143)** | Soft bounce (`Transient`) / complaint / delivered → 200, NO recipient write, NO count change | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **ADDR (R143)** | Tags present → direct doc addressed (no query); tags absent → `providerMessageId==email_id` fallback resolves the doc | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **BOUNCE (R143)** | Valid signature but unresolvable recipient → **200** (never 4xx/5xx retry-loop) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **R142** | Panel lists each message with type label, recipient count (`deliveryCounts`, missing `bounced`→0), send time (`sentAt`/`scheduledFor`) | unit (component) | `npx vitest run src/components/__tests__/DeliveryHistoryPanel.test.ts` | app | ❌ Wave 0 |
| **R143** | `deliveryCounts.bounced > 0` → bounce indicator; expand shows bounced recipients + fix-address deep-link to roster | unit (component) | `npx vitest run src/components/__tests__/DeliveryHistoryPanel.test.ts` | app | ❌ Wave 0 |
| **R142/R143** | Panel hidden when `isMessagingEnabled()` is false | unit (component) | `npx vitest run src/components/__tests__/DeliveryHistoryPanel.test.ts` | app | ❌ Wave 0 |
| Type gate | No new TS errors across src + tests | typecheck | `npm run type-check` **and** `cd functions && npm run build` | both | n/a |

### Sampling Rate
- **Per task commit:** the single new/edited spec — `npx vitest run <file>` (app) or `cd functions && npx vitest run src/index.test.ts` (functions).
- **Per wave merge:** `npx vitest run` (app suite) **and** `cd functions && npm test` (functions suite).
- **Phase gate:** both suites green (app minus the 2-file known baseline), plus `npm run type-check` **and** `cd functions && npm run build`, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `functions/src/index.test.ts` — new `describe('messageWebhookHandler')` covering all SIG/BOUNCE/ADDR rows above, plus a `svixHeadersFor(rawBody, ts, secret)` test helper that produces a real `v1,` signature with the same algorithm (so "valid" is genuinely valid).
- [ ] Extend the per-test `getFirestore` fake with `runTransaction` (and `collectionGroup().where().limit().get()` for the fallback path). The module-scope `firebase-admin/firestore` mock (`index.test.ts:61-64`) needs no `increment` because the count is written as a literal.
- [ ] (If `svixVerify.ts` is split out) `functions/src/svixVerify.test.ts` — pure verifier unit tests (multi-signature header, wrong-length no-throw, whsec_ base64 decode, tolerance window).
- [ ] `src/components/__tests__/DeliveryHistoryPanel.test.ts` — covers R142 listing + R143 bounce surfacing + kill-switch gating.
- [ ] `firestore.indexes.json` — add the collection-group index on `recipients.providerMessageId` (needed for the fallback query; deploy-gated).
- [ ] No framework install — this phase adds no npm dependency.

## Security Domain

> `security_enforcement` is not present in `.planning/config.json` → treated as **enabled**.

Phase 60 introduces the milestone's **new unauthenticated trust boundary: `messageWebhook`.** Anyone on the internet can POST to it. The entire defense is: **verify the Svix HMAC over the raw body BEFORE any Firestore access, and never write bounce state on an unsigned request.** A forgeable webhook is a live Firestore write hole (an attacker could mark arbitrary recipients bounced or inflate counts).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (this phase) |
|---------------|---------|-------------------------------|
| V2 Authentication (of the sender) | yes | HMAC-SHA256 signature verification over `req.rawBody` using `RESEND_WEBHOOK_SECRET` (Svix scheme). No valid signature → 401, no state access. |
| V5 Input Validation | yes | Parse the event ONLY after signature passes; validate `event.type === 'email.bounced'` and `bounce.type === 'Permanent'` before surfacing; treat all IDs/tags as untrusted strings (they came from a signed-but-external source — still validate the doc path segments). |
| V6 Cryptography | yes | `node:crypto` `createHmac('sha256', keyBytes)` + **`timingSafeEqual`** (constant-time); secret via `defineSecret`, bound only to `messageWebhook`, never in the client bundle or `.env.local`. Do NOT hand-roll the compare with `===`. |
| V7 Error Handling / Logging | yes | Signature failure → 401 (no detail leak); processing failure on a valid event → log + 200 (avoid retry storms); never log the raw secret, full recipient emails, or the raw signature at info level. `timingSafeEqual` length-guarded so garbage input is `false`, not a 500. |
| V4 Access Control (client panel) | yes | Panel reads `messages`/`recipients` via nested-path reads under the already-shipped Phase 58 `isOrgMember` rules (`firestore.rules:142,151`); the webhook writes via Admin SDK (rules deny all client writes to these — `:144,152`), so no client can forge bounce state. |
| V3 Session Management | no | The webhook is sessionless by design (provider-to-server, signature-authenticated); the panel uses the existing Firebase Auth session. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged webhook marks recipients bounced / inflates counts | Spoofing / Tampering | Svix HMAC verify over `req.rawBody` FIRST; 401 + zero Firestore on failure. **The central control of this phase.** |
| Replay of a previously-valid event | Tampering (replay) | `svix-timestamp` within ±5 min tolerance; stale → 401. Plus the transition-guarded write makes even an accepted replay a no-op on the count. |
| Timing side-channel on signature compare | Information Disclosure | `crypto.timingSafeEqual` (constant-time), length-guarded to avoid a throw. |
| Duplicate delivery double-counts (at-least-once) | — (duplication) | Transactional transition-guarded `deliveryCounts.bounced` (count only on `not-bounced → bounced`). Tested explicitly. |
| Retry storm from returning non-2xx on processing errors | Availability | Reserve 4xx for signature failures; valid-but-unprocessable events → 200. |
| Secret leakage | Information Disclosure | `RESEND_WEBHOOK_SECRET` via `defineSecret`, bound only to `messageWebhook`; never logged, never in the client bundle or `.env.local`; verify no import reaches `src/`. |
| Malformed/oversized body crashes the handler | DoS / Availability | `Buffer.isBuffer(rawBody)` guard; `JSON.parse` only after signature passes and inside the already-authenticated path; length-guarded compare. |
| Client tampering with bounce state via the panel | Tampering | Panel is READ-only; `recipients` `allow write: if false` (`firestore.rules:152`), `messages` `allow update,delete: if false` (`:144`). |

**Note:** `RESEND_WEBHOOK_SECRET` and `RESEND_API_KEY` are two distinct secrets bound to two distinct Functions (webhook vs send). Keep them separate — do not reuse the API key for signature verification (they are different values with different formats: the webhook secret is `whsec_`-prefixed base64).

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| `functions.config()` for config | `defineSecret`/`defineString` (params) | Firebase Functions v2 (already adopted) | Use `defineSecret("RESEND_WEBHOOK_SECRET")`. |
| Provider-specific ad-hoc webhook signatures | **Standard Webhooks / Svix** (`svix-id/timestamp/signature`, HMAC-SHA256, `whsec_` base64 secret) | current | Resend adopted Svix; the scheme is stable and documented — safe to implement manually with `node:crypto`. |
| `FieldValue.increment` for event counts | Transition-guarded transactional literal write | this phase (mirrors 59-03) | Idempotent under at-least-once webhook delivery. |

**Deprecated/outdated:** none introduced. No package installed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `node:crypto` | Svix signature verification | ✓ (Node built-in) | Node 22 | — |
| Real `RESEND_WEBHOOK_SECRET` | live signature verification | ✗ (by design) | — | tests mock `defineSecret`; owner sets at `/gsd-verify-work` |
| Firestore collection-group index (`recipients.providerMessageId`) | the addressing fallback query | ✗ (must be added) | — | tags primary path needs no index; index is deploy-gated |
| Firebase Functions emulator | optional live-emulator smoke of `req.rawBody` | needs `.env.local` | — | mocked unit tests need no emulator |
| Node 22 | functions runtime | ✓ (`functions/package.json`) | 22 | — |

**Missing with no fallback:** none blocks this phase — the webhook is built and unit-tested against a mocked secret and a hand-computed valid signature; the real secret, index deploy, dashboard config, and Function deploy are deliberately deferred to the owner.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Svix replay tolerance is **±5 minutes** (Svix library default); Resend/Svix docs state "within your tolerance" without a number. | Signature Scheme / Pattern 4 | If Resend uses a different window, a too-tight value rejects legitimate (slightly-delayed/retried) events. Make the tolerance a named constant; loosen if real events are rejected. LOW–MEDIUM. |
| A2 | Resend echoes our **custom send-time `tags`** back in the webhook payload (as a flattened object). Official `email.bounced` example shows only a Resend-internal `category` tag. | Tags Echo | If custom tags are NOT echoed, the tags primary path never fires and the handler always uses the `providerMessageId` fallback — which is why the fallback (and its index) MUST be implemented, not stubbed. MEDIUM. |
| A3 | `req.rawBody` is available as a Buffer in v2 `onRequest`. | Pitfall 1 | If absent/not-a-Buffer, verification can't run — the handler fail-closes (401) and an emulator smoke test would catch it. LOW (well-established Firebase behavior). |
| A4 | Resend's send-response `data.id` (stored as `providerMessageId` in 59-03) === the webhook's `data.email_id`. | Tags Echo / Fallback | If they differ, the fallback query matches nothing. Both are documented as "the email id"; verify with one real event at `/gsd-verify-work`. LOW–MEDIUM. |
| A5 | The `functions` test suite can construct a genuinely-valid signature in-test (same algo) to exercise the "valid" branch without the real secret. | Validation | None material — the verifier is deterministic; the test helper reuses the same `whsec_`+base64+HMAC steps. LOW. |

## Open Questions

1. **Exact replay tolerance (A1).**
   - Known: Svix requires a timestamp-tolerance check; libraries default to ±5 min.
   - Recommendation: implement ±5 min as a named constant; confirm against a real event log at `/gsd-verify-work` and adjust if legitimate events are rejected.

2. **Are our custom tags actually echoed (A2/A4)?**
   - Known: `data.email_id` is guaranteed; custom-tag echo is documented by secondary sources but not shown in the official bounced example.
   - Recommendation: implement **both** paths; rely on the `providerMessageId==email_id` fallback as the safety net; confirm the tags path with one real bounced event during owner verification, then keep tags as the fast path.

3. **Does the fallback collection-group index need explicit enablement?**
   - Known: a `collectionGroup(...).where('providerMessageId','==',...)` query requires a collection-group single-field index; absent it throws `FAILED_PRECONDITION`.
   - Recommendation: add it to `firestore.indexes.json` and include `firebase deploy --only firestore:indexes` in the deploy-gated owner steps.

## Sources

### Primary (HIGH confidence)
- `functions/src/index.ts` — `api` `onRequest` wrapper (:140-142), `defineSecret` precedent (:30-41), `sendQueuedMessageHandler` transactional claim (:1181-1191), recipient write with `providerMessageId`/`bounceReason`/`bouncedAt`/`status` (:1279-1334), `deliveryCounts:{sent,failed}` rollup (:1341-1348), `sendQueuedMessage` secret binding (:1356-1360), Resend `tags` array sent (:1293-1298), `RESEND_TAG_SAFE` (:1081).
- `functions/src/index.test.ts` — the `vi.mock` harness to extend (:49-106): `firebase-admin/firestore` mock exposes only `FieldValue.serverTimestamp` (:61-64), `defineSecret`→fake (:69), `firebase-functions/v2/https` NOT mocked (handler tested directly); Resend mocked (:100-106).
- `firestore.rules` — Phase 58 blocks: `messages` `read: isOrgMember` / `update,delete: false` (:141-144), `recipients` `read: isOrgMember` / `write: false` (:150-153), `isOrgMember`/`isOrgEditor` resolve orgId from the path (:11-33). **Confirms the panel needs NO new client rule via nested-path reads.**
- `docs.svix.com/receiving/verifying-payloads/how-manual` — signed content `${id}.${ts}.${body}`, HMAC-SHA256 base64, `whsec_`-strip + base64-decode secret, space-delimited `v1,<sig>` header, constant-time compare `[CITED]`.
- `resend.com/docs/dashboard/webhooks/verify-webhooks-requests` — headers are `svix-id`/`svix-timestamp`/`svix-signature`; Resend defers to Svix for the algorithm `[CITED]`.
- `resend.com/docs/webhooks/emails/bounced` + `.../event-types` — `email.bounced` = permanent/hard; `email.delivered` exists; payload has `data.email_id`, `data.tags` (object), `data.bounce.{type,subType}` (`Permanent` vs `Transient`) `[CITED]`.

### Secondary (MEDIUM confidence)
- `resend.com/blog/webhooks` + `anymail.dev` Resend docs — custom send-time tags round-trip into webhook payloads flattened to an object `[CITED]` (A2 — verify with a real event).
- Svix library default replay tolerance ±5 min `[ASSUMED]` (A1).
- Firebase v2 `onRequest` provides `req.rawBody` as a Buffer `[CITED: Firebase HTTP-functions docs pattern]` (A3).

### Tertiary (LOW confidence)
- None load-bearing.

## Metadata

**Confidence breakdown:**
- Signature scheme (the critical unknown): HIGH — confirmed against official Svix manual-verification docs + Resend's own webhook pages; the byte-for-byte algorithm is specified.
- Codebase anchors (webhook shape, recipient/deliveryCounts fields, secret pattern, rules, test harness): HIGH — every claim cites a live `file:line`.
- Tags echo: MEDIUM — documented by secondary sources but not shown in the official bounced example; mitigated by a fully-implemented `providerMessageId` fallback.
- Replay tolerance value: MEDIUM — the requirement is confirmed; the exact 5-min number is the Svix library convention.

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (30 days; re-verify the tags-echo behavior and the replay tolerance against a real event at owner verification).
