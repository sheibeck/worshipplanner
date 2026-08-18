# Phase 60: Delivery History & Bounce Webhook - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 9 new/modified files
**Analogs found:** 8 / 9 (1 with NO clean analog — the HMAC verify helper — flagged fresh)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `functions/src/index.ts::messageWebhook` (+ handler) | function (onRequest) | request-response / inbound webhook | same file, `api` onRequest (140-230) | role-match (inbound, not proxy) |
| `functions/src/index.ts::RESEND_WEBHOOK_SECRET` `defineSecret` | config | — | same file, `RESEND_API_KEY`/`CLAUDE_API_KEY` `defineSecret` (30-41) | exact |
| HMAC signature-verify helper (node `crypto`) | utility | transform / verify | **NONE in repo** — closest verify-before-act is `parsePptxHandler` membership re-check (313-323) | NO ANALOG (fresh) |
| transition-guarded `deliveryCounts.bounced` increment (transaction) | function logic | event-driven / idempotent write | same file, `sendQueuedMessageHandler` runTransaction claim (1181-1191) | role-match |
| `functions/src/index.test.ts` (webhook describe blocks) | test | — | same file, `sendQueuedMessageHandler` block + `vi.mock` seams (1512-1536, module-scope mocks) | exact |
| `src/components/MessageDeliveryHistory.vue` (new panel) | component | CRUD (read) | `src/components/LyricVersionHistory.vue` (whole file) | exact |
| store read/subscribe for `messages` (+`recipients`) subcollection | store | streaming (onSnapshot) | `src/stores/songLyrics.ts::subscribeLyrics` (37-65) | exact |
| "fix the bad address" affordance (link to roster edit) | component | — | `RosterView.vue::startEdit` (513-517) + route `volunteers` (`router/index.ts:41-46`) | partial (nav yes, deep-link fresh) |
| `MessageDeliveryHistory.test.ts` (panel test) | test | — | `src/components/__tests__/LyricVersionHistory.test.ts` (1-55) | exact |

## Pattern Assignments

### `functions/src/index.ts::messageWebhook` (onRequest inbound receiver)

**Analog:** `api` onRequest (`functions/src/index.ts:140-230`).

**Copy vs change:**
- **Wrapper shape + secret binding (140-141):** `export const messageWebhook = onRequest({ secrets: [RESEND_WEBHOOK_SECRET] }, messageWebhookHandler)`. The `api` handler binds `{ secrets: [CLAUDE_API_KEY, ESV_API_KEY, NLT_API_KEY] }` at 141 — mirror the options-object form, but bind ONLY `RESEND_WEBHOOK_SECRET`.
- **Handler exported separately for unit test:** `api` currently inlines its handler as an anonymous arrow (142). CONTEXT 33-36 requires the 59-era convention — export `messageWebmookHandler(req, res)` as a named function (mirror `parsePptxHandler`/`sendQueuedMessageHandler` being `export`ed) and pass it as the 2nd arg, so `index.test.ts` imports it by name. **Change from `api`**: do NOT inline.
- **Request read / early-return-with-status idiom (144-165):** copy the `res.status(NNN).json({...}); return;` guard-clause cascade verbatim as the response shape. `api` uses 404/401; the webhook uses **401** (missing/invalid signature) and **400** (malformed body/headers) then **200** on success (CONTEXT 40, 65).
- **Response codes:** `api` mirrors upstream status (212-217). The webhook instead responds `200 OK` fast and does the count rollup best-effort/non-blocking (CONTEXT 65, ARCHITECTURE 408-411) — providers retry on non-2xx.

**RAW-BODY ACCESS POINT (load-bearing trap):** the HMAC is computed over the exact received bytes. In Cloud Functions v2 `onRequest`, use **`req.rawBody`** (a `Buffer` Firebase populates) as the HMAC input — NOT `JSON.stringify(req.body)`. `api` uses `req.body` re-serialized at 209 because it is a pass-through proxy where byte-fidelity does not matter; here it is everything (key reordering / whitespace breaks verification). CONTEXT 41-44. Parse `req.body` (or `JSON.parse(req.rawBody)`) for the event fields ONLY AFTER signature verification passes.

**Order contract (CONTEXT 37-40, ARCHITECTURE 399):** verify signature → on failure `401/400` with **ZERO Firestore access** → only then parse event + touch Firestore. This is the milestone's new unauthenticated trust boundary.

---

### `functions/src/index.ts::RESEND_WEBHOOK_SECRET` (`defineSecret`)

**Analog:** the `defineSecret` block (30-41):
```typescript
const CLAUDE_API_KEY = defineSecret("CLAUDE_API_KEY");
const ESV_API_KEY = defineSecret("ESV_API_KEY");
const NLT_API_KEY = defineSecret("NLT_API_KEY");
// ...
export const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
```
Add `const RESEND_WEBHOOK_SECRET = defineSecret("RESEND_WEBHOOK_SECRET");` alongside them and extend the set-once doc-comment (24-29) with `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`. Bind it in exactly one place — `messageWebhook`'s options `secrets: [RESEND_WEBHOOK_SECRET]` — exactly as `RESEND_API_KEY` binds ONLY to `sendQueuedMessage` (1356-1360). Read via `RESEND_WEBHOOK_SECRET.value()` inside the handler (cf. `CLAUDE_API_KEY.value()` at 195, `RESEND_API_KEY.value()` at 1273).

**Trap:** undeployed this phase (CONTEXT 104-107). Tests get the fake via the existing `defineSecret: vi.fn(() => ({ value: () => "fake-secret" }))` mock seam in `index.test.ts` — no new mock needed. Never in `.env.local`, never client-side.

---

### HMAC signature-verify helper (node `crypto`) — **NO ANALOG, WRITE FRESH**

**Search result:** grep for `createHmac|timingSafeEqual|crypto|svix|signature` across `functions/` returned **zero** matches. No existing HMAC, timing-safe-compare, or webhook-signature code exists anywhere in the Functions package (or the client). **This is the one genuinely new primitive in the phase — flag it to the planner as no-analog.**

**Closest structural precedent (verify-before-act only, NOT the crypto itself):** `parsePptxHandler`'s independent membership re-check (`functions/src/index.ts:313-323`) — the "re-validate independently before any state access, fail closed on failure" stance. Mirror that *discipline* (throw/reject before touching Firestore), not any code.

**What to write fresh (CONTEXT 48-55):** a pure, exported, unit-testable helper using node built-in `crypto` — no new npm dependency. Resend signs via **Svix**: headers `svix-id`, `svix-timestamp`, `svix-signature`; HMAC-SHA256 over `` `${svix-id}.${svix-timestamp}.${rawBody}` `` with the base64-decoded `whsec_`-prefixed secret; **`crypto.timingSafeEqual`** compare; timestamp-tolerance window to reject replays. Signature verification is over `req.rawBody` (see webhook trap above).

**Traps:**
- Base64 secret handling: strip the `whsec_` prefix, base64-decode the remainder before `createHmac`.
- `timingSafeEqual` throws if buffers differ in length — length-guard first, fail closed.
- The phase research MUST confirm Resend's exact current scheme byte-for-byte; documented fallback is the pinned `svix` package (functions-only) if materially more complex — but manual is preferred. STATE the decision in the plan.
- Keep it PURE (secret + headers + rawBody in → boolean out) so it unit-tests without Firebase, exactly like `buildUpstreamUrl`/`redactUrl` (84-116) are pure and separately testable.

---

### Transition-guarded `deliveryCounts.bounced` increment (transaction)

**Analog:** `sendQueuedMessageHandler`'s transactional idempotency claim (`functions/src/index.ts:1181-1191`):
```typescript
const claim = await db.runTransaction(async (tx) => {
  const snap = await tx.get(messageRef);
  if (!snap.exists) return { claimed: false as const, data: null };
  const data = snap.data() as QueuedMessageDoc | undefined;
  if (!data || data.status !== "queued") return { claimed: false as const, data: null };
  tx.update(messageRef, { status: "sending", updatedAt: FieldValue.serverTimestamp() });
  return { claimed: true as const, data };
});
```

**Copy vs change (CONTEXT 67-74):** copy the `runTransaction` → `tx.get` → status-guard → conditional `tx.update` shape. **Change the guard subject:** read `recipients/{recipientId}.status`; only when it is NOT already `'bounced'` do BOTH (a) `tx.update(recipientRef, { status: 'bounced', bounceReason, bouncedAt })` AND (b) `tx.update(messageRef, { 'deliveryCounts.bounced': FieldValue.increment(1) })` — in the SAME transaction so a retry that finds status already `'bounced'` is a no-op and never double-counts. The recipient-status overwrite alone is naturally idempotent (same-value write); the transaction exists specifically to protect the counter.

**Traps:**
- `FieldValue.increment` is imported already (`index.ts:7`). A bare `increment(1)` on every webhook — outside the guard — double-counts on provider retry (CONTEXT 71-72). The guard is the whole point.
- `deliveryCounts.bounced` is a NEW leaf; Phase 59 shipped `{ sent, failed }` (1345). No migration — write via dot-path `'deliveryCounts.bounced'` so it merges into existing docs; UI treats missing as 0 (CONTEXT 76-79).
- Addressing the doc: read `{orgId, serviceId, messageId, recipientId}` from the echoed Resend tags (sent at 1293-1298) → direct doc path, no query. Fallback `collectionGroup('recipients').where('providerMessageId','==', data.email_id)` is Admin-SDK server-side (bypasses rules) — design both, prefer tags (CONTEXT 56-62).

---

### `functions/src/index.test.ts` (webhook describe blocks)

**Analog:** the `sendQueuedMessageHandler` test block (~1402+) and its transaction mock (1512-1536):
```typescript
const runTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => { ... });
// returns { db, messageSetSpy, recipientWrites, txUpdateSpy, runTransaction }
```
plus the module-scope `vi.mock` scaffold at the top of the file (`firebase-admin/firestore` with `FieldValue` sentinels, `firebase-functions/params` `defineSecret` fake, etc.).

**Copy vs change:**
- Reuse the `defineSecret` fake for `RESEND_WEBHOOK_SECRET.value()` → `"fake-secret"` (no new mock).
- Import `messageWebhookHandler` (and the pure HMAC helper) by name from `./index` — the reason both must be `export`ed.
- Reuse the `runTransaction`/`txUpdateSpy`/`recipientWrites` fake-db builder (1512-1536) to assert the transition-guarded increment.
- **Add** a fake `req`/`res` pair (the `api` handler has no existing test harness — Assumption A2 in 59-PATTERNS): `req` carries `rawBody` (a Buffer) + `headers` (`svix-*`); `res` is `{ status: vi.fn().mreturnThis?, json: vi.fn(), send: vi.fn() }` spy object.

**Required test cases (CONTEXT 40, 65-74):**
1. Valid signature → recipient status flips to `bounced`, `deliveryCounts.bounced == 1`, `res.status(200)`.
2. Bad/missing signature → `res.status(401)` (or 400 malformed) AND **zero Firestore access** (assert the db/txn spies never called).
3. Duplicate delivery (same event twice) → status `bounced` once, count stays `1` (idempotency proof).

---

### `src/components/MessageDeliveryHistory.vue` (new "Sent on this service" panel)

**Analog:** `src/components/LyricVersionHistory.vue` (whole file, 1-72) — a props-driven read-only list of rows, each with a relative-time label, a **status badge**, and a per-row action button. This is the exact reusable row/badge idiom.

**Copy vs change:**
- The row shell verbatim (8-35): `v-for` over the list, `:key`, `data-testid`, `flex items-center justify-between gap-2 rounded-md bg-gray-800 border border-gray-700/50 px-3 py-2`.
- The **badge idiom** (18-24): `inline-flex items-center rounded-full ... px-2 py-0.5 text-xs font-medium ...`. Reuse for the message **type** chip (`oneoff→One-off`, `reminder→Reminder`, `share-link→Share link`, `lock/relock→automatic`; CONTEXT 81-86) and for a **hard-bounce indicator** when `deliveryCounts.bounced > 0` (use a red/amber variant, e.g. `bg-red-900/30 border-red-500/40 text-red-300`).
- The empty-state (4-6): `No messages sent yet` when the list is empty.
- `formatRelativeTime(timestamp)` (53-65) verbatim for the **send time** column (`sentAt`, or `scheduledFor` when still scheduled).
- **Props-in, emit-out (44-51):** `defineProps<{ messages: ..., recipientsByMessage?: ... }>()` and `emit<{ fixAddress: [personId] }>()` — parent (`ServiceEditorView.vue`) owns the store subscription and passes data down, exactly as the lyric editor passes `versions` down.

**Change / add (new, per CONTEXT 87-91):** an expandable per-message section that, when `bounced > 0`, lists the `recipients` with `status==='bounced'` (name + bounceReason) and renders the fix-address affordance below. Recipient count comes from `deliveryCounts` (`sent + failed + bounced`) or the recipients subcollection length. Reads only — no write path from the panel.

**Trap:** gate the whole surface behind `isMessagingEnabled()` (`src/utils/messaging.ts`) like the composer (CONTEXT 92) — a fresh org with messaging off shows no history surface.

---

### Store read/subscribe for `messages` (+`recipients`) subcollection

**Analog:** `src/stores/songLyrics.ts::subscribeLyrics` (37-65) — the exact nested-subcollection real-time read idiom:
```typescript
function subscribeLyrics(orgId: string, songId: string) {
  if (unsubscribeFn) unsubscribeFn()
  isLoading.value = true
  const q = query(
    collection(db, 'organizations', orgId, 'songs', songId, 'lyrics'),
    orderBy('createdAt', 'desc'),
  )
  unsubscribeFn = onSnapshot(q, (snap) => {
    lyrics.value = snap.docs.map((d) => ({ id: d.id, songId, ...d.data() }) as SongLyrics)
    isLoading.value = false
  })
}
```

**Copy vs change:** copy verbatim, retargeting the path to `organizations/{orgId}/services/{serviceId}/messages` ordered by `createdAt`/`sentAt` desc. Keep the `unsubscribeFn` single-listener guard (38-40), the `isLoading` flag, and the `unsubscribeLyrics`-style cleanup (60-65). For the per-message `recipients` (only needed when a message has bounces), either a second `subscribe(orgId, serviceId, messageId)` on-demand or a one-shot `getDocs` on expand — mirror the same `collection(db, 'organizations', orgId, 'services', serviceId, 'messages', messageId, 'recipients')` path form.

**Placement:** a new subscribe/unsubscribe pair. `src/stores/services.ts` only subscribes to the top-level `services` collection (`services.ts:178-206`) — it is NOT the nested-read precedent. `songLyrics.ts` is the correct one (its own tiny store per subcollection). Match that: a small dedicated store (e.g. `serviceMessages.ts`) or add scoped subscribe functions.

**Trap:** the `messages` read = `isOrgMember` and `recipients` read = `isOrgMember` rules **already shipped in Phase 58** (ARCHITECTURE 291-308) — these are nested two-segment-deep paths that already have explicit allow blocks. **NO new client-facing rule this phase** for nested reads (CONTEXT 96-102). Only a *client* `collectionGroup` read would need a new rule + allow-case test — so prefer nested-path reads and avoid collectionGroup on the client.

---

### "Fix the bad address" affordance (link to roster person edit)

**Analog (navigation):** the `volunteers` route (`src/router/index.ts:41-46`, `name: 'volunteers'` → `RosterView.vue`) and `RosterView.vue::startEdit` (513-517) which sets `editingPersonId.value = person.id` to open the edit modal.

**Copy vs change:** the panel emits `fixAddress: [personId]`; `ServiceEditorView.vue` handles it with `router.push({ name: 'volunteers' })`. The roster `Person.email` is the source of truth — fixing it there is the durable fix (CONTEXT 88-91).

**PARTIAL analog / fresh bit:** there is currently **no deep-link route param** to pre-open a specific person's edit — `editingPersonId` is internal component state at `/volunteers` with no query-param hydration. So the clean nav exists but "land on roster with THIS person's editor open" is not yet supported. Options for the planner: (a) simplest — navigate to `/volunteers` only (no auto-open), the DEFAULT the CONTEXT allows ("deep-link vs inline edit … implementer discretion", 109-112); or (b) add a `?edit={personId}` query param that `RosterView.vue` reads on mount and feeds into `startEdit` — this is NEW wiring (no existing analog), flag if chosen. Reads only; no new write path from the panel.

---

### `src/components/__tests__/MessageDeliveryHistory.test.ts` (panel test)

**Analog:** `src/components/__tests__/LyricVersionHistory.test.ts` (1-55) — mounts a list component with array props and asserts rendered rows/badges.

**Copy vs change:**
- The `makeVersion(overrides)` fixture-factory idiom (8-24) → a `makeMessage(overrides)` factory producing `{ id, type, status, sentAt, deliveryCounts }` with `toMillis`-shaped Timestamps (20-21).
- The `vi.useFakeTimers()` + `vi.setSystemTime(FIXED_NOW)` (27-34) so `formatRelativeTime` output is deterministic.
- `mount(Component, { props: { messages, ... } })` + `findAll('[data-testid="..."]')` length + `.text()` assertions (41-48).

**Add:** assert the type-badge mapping, the bounce indicator shows only when `deliveryCounts.bounced > 0`, the expanded bounced-recipient list, and that clicking "fix address" emits `fixAddress` with the right `personId` (`wrapper.emitted()`). Because the parent owns the store subscription (data passed as props), this stays a pure props-driven mount — no Firebase mock needed (unlike PptxImportModal.test's callable seam). If the panel reads a store directly instead, mock it like `services`/`auth` stores in existing store-backed component tests.

## Shared Patterns

### Verify-first before any state access (inbound trust boundary)
**Source (discipline only, NO crypto analog):** `parsePptxHandler` independent re-check (313-323); the response-guard cascade in `api` (144-165).
**Apply to:** `messageWebhook` — verify the Svix HMAC over `req.rawBody` FIRST; on failure `401/400` with zero Firestore access; only then parse + write. The crypto itself is fresh (no repo precedent).

### One secret bound to exactly one Function
**Source:** `RESEND_API_KEY` → only `sendQueuedMessage` (`index.ts:1356-1360`); `defineSecret` block 30-41.
**Apply to:** `RESEND_WEBHOOK_SECRET` → only `messageWebhook`. Smallest key-holding surface (R131).

### Transactional transition-guarded write for idempotency
**Source:** `sendQueuedMessageHandler` runTransaction claim (1181-1191).
**Apply to:** the bounce-count increment — guard on `recipients/{id}.status !== 'bounced'` inside `runTransaction`, then update status + `FieldValue.increment` in the same tx. Proven by a duplicate-delivery test.

### Handler body exported separately from the Function wrapper
**Source:** `parsePptxHandler`/`sendQueuedMessageHandler` are exported; wrappers are one-liners (1356-1368).
**Apply to:** `messageWebhookHandler` + the pure HMAC helper — both exported for direct unit testing (the `api` handler's inline-arrow shape is the anti-pattern to avoid here).

### Props-driven read-only list with time-label + status badge + row action
**Source:** `LyricVersionHistory.vue` (8-35, 53-65) + its test (1-55).
**Apply to:** `MessageDeliveryHistory.vue` + test — parent owns the `onSnapshot` subscription (`songLyrics.ts::subscribeLyrics` shape), panel receives arrays as props and emits `fixAddress`.

### Nested-subcollection onSnapshot store read (isOrgMember rule already shipped)
**Source:** `songLyrics.ts::subscribeLyrics` (37-65).
**Apply to:** the `messages`/`recipients` read. Phase 58 already shipped the `isOrgMember` read rules for both nested paths — NO new client rule this phase unless a client `collectionGroup` read is introduced (prefer nested-path reads to avoid that).

## No Analog Found

| Item | Role | Data Flow | Reason |
|---|---|---|---|
| HMAC signature-verify helper (`crypto`, Svix scheme) | utility | verify | **Zero** `createHmac`/`timingSafeEqual`/`crypto`/`svix` matches anywhere in the repo. First cryptographic verification primitive in the codebase — write fresh (pure + exported), modeled structurally (not in code) on `parsePptxHandler`'s fail-closed re-check. |

Two further items graft a NEW sub-pattern onto an existing structure (flagged inline, not unmapped):
- **`messageWebhook` `req.rawBody` HMAC input** — the `onRequest` *wrapper* is `api`, but `api` re-serializes `req.body` (byte-lossy); the raw-body requirement is new here.
- **Deep-link-to-specific-person roster edit** — navigation to `/volunteers` has an analog; pre-opening a specific person's editor via a query param does not (implementer may default to plain navigation).

## Metadata

**Analog search scope:** `functions/src/` (index.ts, index.test.ts — full grep for crypto/HMAC/transaction/deliveryCounts), `src/stores/` (services.ts, songLyrics.ts nested subscribe), `src/components/` (LyricVersionHistory.vue + test, list/badge/import components), `src/views/RosterView.vue` (edit wiring), `src/router/index.ts` (volunteers route), `.planning/research/ARCHITECTURE.md` §Bounce webhook / §Data Model, `59-PATTERNS.md` (template).
**Files scanned:** `functions/src/index.ts` (1-350, 1164-1368), `functions/src/index.test.ts` (grep), `src/stores/services.ts` (170-214), `src/stores/songLyrics.ts` (full), `src/components/LyricVersionHistory.vue` (full), `src/components/__tests__/LyricVersionHistory.test.ts` (1-55), `src/views/RosterView.vue` (grep), `src/router/index.ts` (36-56).
**Pattern extraction date:** 2026-08-14
