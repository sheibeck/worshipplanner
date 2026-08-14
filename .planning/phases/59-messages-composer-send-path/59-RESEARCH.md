# Phase 59: Messages Composer & Send Path - Research

**Researched:** 2026-08-14
**Domain:** Vue 3 composer UI + Firebase Cloud Functions queue-then-trigger email send path (Resend, mocked & deploy-gated)
**Confidence:** HIGH — every claim is anchored to a live file:line in this repo or a verified registry/doc lookup. This is a **consolidation** of milestone-level research (`ARCHITECTURE.md`) mapped onto Phase 59's scope, not a re-derivation.

## Summary

Phase 59 ships the **first live send surface** in v1.7: one new client component (`MessageComposer.vue`) plus the **queue-then-trigger** send primitive — a thin `queueServiceMessage` (`onCall`, no secret) that enqueues a `messages/{id}` doc, and a `sendQueuedMessage` (`onDocumentCreated`, holds `RESEND_API_KEY`) trigger that re-resolves recipients server-side, renders per-recipient tokens, calls Resend, and writes `recipients/{id}` status docs. The shape is an **exact reuse** of the shipped `parsePptxHandler → pptxRenders/{importId} → requestPptxRenderHandler` triad (`functions/src/index.ts`). Nothing architecturally new is invented — the work is wiring.

The provider (Resend) is **added to `functions/package.json` only** and **mocked in tests** (`vi.mock("resend")` or a dependency-injected sender), so no real email is sent and no secret is needed to run the suite. The Function ships **built, tested, UNDEPLOYED**; account creation, secret-set, DNS, and deploy are owner tasks handed over at `/gsd-verify-work`. Firestore rules for `messages`/`recipients` **already shipped in Phase 58** (`firestore.rules:141-153`) — no new rules this phase.

**Primary recommendation:** Mirror `requestPptxRenderHandler` verbatim for structure (handler body exported separately from the `onDocumentCreated` wrapper for direct unit testing), but **add a genuinely new transactional `queued→sending` idempotency claim** — the PPTX precedent does *not* guard on a status field, so this is a strengthening the planner must test explicitly, not a copy. Port the pure resolver (`resolveServiceRoleAssignments`) into `functions/src/` as a **copy** — `functions/` cannot import `../src` (separate tsconfig, no `@/` alias).

<user_constraints>
## User Constraints (from 59-CONTEXT.md)

### Locked Decisions
- **Provider = Resend** (`resend` npm SDK), added to **`functions/package.json` only**; the client never imports it. This phase builds and unit-tests with the **Resend SDK MOCKED** — no real send, no deploy. The Function ships **built, tested, UNDEPLOYED**. Owner tasks at `/gsd-verify-work`: (a) create Resend account, (b) `firebase functions:secrets:set RESEND_API_KEY`, (c) SPF/DKIM/DMARC DNS, (d) `firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage`.
- **`RESEND_API_KEY` is a `defineSecret("RESEND_API_KEY")`**, mirroring existing `CLAUDE_API_KEY`/`ESV_API_KEY`/`NLT_API_KEY`. Bound **ONLY to `sendQueuedMessage`** — `queueServiceMessage` does NOT get the secret (it only enqueues).
- **Send path = thin `onCall` enqueue → `onDocumentCreated` trigger.** `queueServiceMessage` (onCall, no secret) independently re-checks org-editor membership of *this* org, checks the org kill-switch is on server-side, validates `scheduledFor`, then writes ONE `messages/{id}` doc via a shared `createQueuedMessage()` helper. Returns the message id. Does NOT resolve recipients or send.
- **`sendQueuedMessage`** (onDocumentCreated on `.../messages/{messageId}`, holds `RESEND_API_KEY`), handler body exported separately from the trigger wrapper. Steps: (1) load message + parent service docs (Admin SDK); (2) **transactional idempotency claim** — read `status`, flip `queued→sending` only if currently `queued`, else return "already claimed"; (3) re-resolve recipients from scratch (Admin-SDK port of `resolveServiceRoleAssignments`); (4) render tokens, personalizing "their roles" **per recipient**; (5) call Resend once per recipient (mocked in tests), passing `{orgId, serviceId, messageId, recipientId}` as tags; (6) write one `recipients/{id}` doc per recipient, roll up `deliveryCounts`, flip message status to `sent`|`partial`|`failed`.
- **`options.sendCopyToSelf`** → also send to the requesting editor's own email, resolved **server-side** from their member record / auth token, never a client-supplied address.
- **Composer** = new `src/components/MessageComposer.vue` (modal), opened by a ✉ **Messages** action wired into `ServiceEditorView.vue`'s `buildActionBarItems`. **Hidden/disabled when `isMessagingEnabled()` is false** (Phase 58 choke point). Editor-gated (`authStore.isEditor`). Teams-first recipients (`MESSAGING_TEAM_LABELS`) + individuals; three message types (`oneoff`/`reminder`/`share-link`); subject + body with insertable tokens `{{service_date}}`/`{{service_link}}`/`{{their_roles}}`/`{{song_list}}` (body stores raw template, never pre-rendered); live "Reaches N" via `resolveRecipients`; options attach-service-link / send-me-a-copy / schedule-for-later.
- **Schedule-for-later persists intent only** this phase: `queueServiceMessage` writes `scheduledFor` + `status: 'scheduled'`. The trigger's `=== 'queued'` guard skips it; actual dispatch is **Phase 61's cron**.
- **Data model already specified in Phase 58's rules + ARCHITECTURE** — this phase POPULATES it. **No new firestore rules this phase** unless a gap surfaces (then it ships deploy-gated with the exact command).

### Claude's Discretion
- Composer modal-vs-drawer presentation, token-insertion UX (button palette vs `/`-menu), the exact Resend-mock test seam (dependency-inject the sender vs `vi.mock('resend')`), `createQueuedMessage()` helper location, and delivery-count rollup field names — all at implementer discretion, guided by codebase conventions, the imported design, and ARCHITECTURE.md.

### Deferred Ideas (OUT OF SCOPE)
- Delivery-history panel + `messageWebhook` HMAC-verified bounce receiver → **Phase 60** (reads the `recipients`/`deliveryCounts` this phase writes).
- `sendScheduledReminders` daily cron (auto-reminder + dispatch of user-scheduled `status:'scheduled'` messages) → **Phase 61**.
- Automatic lock / re-lock notifications + `lockSnapshots/current` writes → **Phases 61–62**.
- Real send / provider account / domain DNS / secret set / deploy → **OWNER**, handed over at `/gsd-verify-work`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R131 | Volunteer email sends through a backend send path holding the provider API key server-side — no address list or key ever in the client bundle. | `sendQueuedMessage` is the only Function holding `RESEND_API_KEY` (`defineSecret`, `functions/src/index.ts:18-20` precedent). `resend` is a `functions/package.json` dep only — never imported client-side. Recipient re-resolution is server-side (Admin SDK). |
| R136 | ✉ Messages button opens a composer; recipients teams-first, individuals addable. | Action-bar wiring into `ServiceEditorView.vue::buildActionBarItems`; `MESSAGING_TEAM_LABELS` + `resolveRecipients` (`src/utils/messagingRecipients.ts:17,52`). |
| R137 | Three message types — One-off, Reminder, Share service link. | `messages.type` enum `'oneoff'|'reminder'|'share-link'` (ARCHITECTURE §Data Model); type selector seeds subject/body defaults (UI-SPEC #6). |
| R138 | Subject + body with insertable merge tokens: service date, service link, their roles, song list. | Token catalog `{{service_date}}`/`{{service_link}}`/`{{their_roles}}`/`{{song_list}}`; body stores raw template. Server derives song_list from service `slots`, service_link from the share link (see §Token Rendering). |
| R139 | Personalized per-recipient email — "their roles" renders that person's own roles. | Rendering happens in `sendQueuedMessage` per recipient using the ported `resolveServiceRoleAssignments` (`effectivePersonIds` → per-person `roleNames`). Never pre-rendered client-side. |
| R140 | Live "Reaches N people" count minus unreachable. | `resolveRecipients(...)` → `{ reachable, unreachableCount }` (`src/utils/messagingRecipients.ts:52-83`), recomputed on every selection change, `aria-live="polite"`. |
| R141 | attach-service-order-link, send-me-a-copy, schedule-for-later. | `options.attachServiceLink` / `options.sendCopyToSelf` / `scheduledFor` (ARCHITECTURE §Data Model); schedule persists intent only this phase. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compose UI, token insertion, live "Reaches N" | Browser / Client (`MessageComposer.vue`) | — | Pure presentation + a client-side estimate; `resolveRecipients` runs in-browser against loaded stores (no round trip), matching `buildServiceSnapshot`'s established pattern. |
| Enqueue + server-side authorization (org-editor re-check, kill-switch, `scheduledFor` sanity) | API / Backend (`queueServiceMessage` onCall) | — | Never trust client-declared orgId or kill-switch state (`parsePptxHandler:292-301` precedent). Writes the queued doc; holds no secret. |
| Authoritative recipient resolution + token render + provider send | API / Backend (`sendQueuedMessage` onDocumentCreated) | — | The client list is an *estimate*, never the send list (Anti-Pattern 1). Only this Function holds `RESEND_API_KEY`. |
| Message/recipient persistence + delivery-count rollup | Database / Storage (Firestore, Admin SDK) | — | Nested subcollections under the service; status writes are Admin-SDK-only (rules deny client writes). |
| Feature gate (kill-switch) | Client (`isMessagingEnabled()`) **and** Backend (server re-check) | — | UI gate is convenience; the server re-check in `queueServiceMessage` is the security boundary (defense in depth). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | **pin `6.19.0`** (latest `6.20.0`, see audit) | Transactional email send from `sendQueuedMessage` only | `research/SUMMARY.md` recommendation; ~9.57M weekly downloads; official `github.com/resend/resend-node` repo `[VERIFIED: npm registry]`. Goes in `functions/package.json` ONLY. |
| `firebase-functions` | `^7.2.5` (already installed) | `onCall` / `onDocumentCreated` / `defineSecret` | Already the Functions runtime (`functions/package.json:16`). No change. |
| `firebase-admin` | `^13.10.0` (already installed) | Admin-SDK Firestore reads/writes + transaction | Already installed (`functions/package.json:15`). Bypasses rules by design. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.1.10` (functions), root `4.0.x` | Handler-body unit tests with mocks | Already the functions test runner (`functions/package.json:22`). |
| `firebase/functions` (client) | already installed | `httpsCallable(functions, 'queueServiceMessage')` | Client wrapper mirrors `PptxImportModal.vue:314-322`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | Postmark / SendGrid / SES | ARCHITECTURE is provider-agnostic, but SUMMARY locked Resend on cost/DX; all support the metadata/tag echo the Phase 60 webhook needs. Locked — do not revisit. |
| Transactional `runTransaction` claim | Optimistic `update` with a precondition | A read-then-write transaction is the race-safe primitive for the `queued→sending` claim against a retried trigger; a bare `update` cannot atomically read-and-guard. |

**Installation (functions only):**
```bash
cd functions && npm install resend@6.19.0
```

**Version verification:** `npm view resend version` → `6.20.0` (latest, published 2026-08-13) `[VERIFIED: npm registry]`. `npm view resend scripts.postinstall` → empty (no postinstall) `[VERIFIED]`.

## Package Legitimacy Audit

> `resend` is the only external package this phase installs.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `resend` | npm | latest `6.20.0` published **2026-08-13** (yesterday) | **9,569,860/wk** | `github.com/resend/resend-node` | **SUS (`too-new`)** | **Keep — flagged.** Planner must add a `checkpoint:human-verify` before install. |

**Why SUS, and why it is nonetheless legitimate:** the `package-legitimacy check` seam flagged `resend` **`SUS` / `too-new`** because it keys on the *latest release's* publish date — `6.20.0` shipped 2026-08-13, one day before this research. That is a routine patch release of a mature, high-trust package (9.57M weekly downloads, canonical `resend/resend-node` repo, no `postinstall`). It is unambiguously the real Resend SDK, not a slopsquat. **Mitigation (per SUS protocol):** pin to an **exact, slightly-older stable** version (`6.19.0`, not `latest`/`^`) to avoid pulling a <24h-old release, and gate the install behind a `checkpoint:human-verify` task so a human confirms the pinned version before it lands in `functions/package.json`.

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious (SUS):** `resend` — planner inserts one `checkpoint:human-verify` before the `cd functions && npm install resend@<pinned>` task.

## Architecture Patterns

### System Architecture Diagram

```
MessageComposer.vue (client)
  │  reads: rosterStore.people/roles, quartersStore.quarters, service (props)
  │  resolveRecipients(...) ── live "Reaches N" estimate (client-side, no round trip)
  │  isMessagingEnabled() ── entry-point gate
  ▼  httpsCallable(functions,'queueServiceMessage')({ orgId, serviceId, type,
     │                                                 subject, body,
     │                                                 recipientSelector, options,
     │                                                 scheduledFor })
     ▼
queueServiceMessage (onCall, NO secret)
  │  ① require request.auth        (unauthenticated → HttpsError)
  │  ② independent org-EDITOR re-check via Firestore members read (never trust client orgId)
  │  ③ kill-switch: read org settings.messaging.enabled server-side, reject if off
  │  ④ validate scheduledFor (not absurd / not in past for send-now)
  │  ⑤ createQueuedMessage(): write ONE messages/{id}
  │       status = scheduledFor ? 'scheduled' : 'queued'
  ▼  returns { messageId }
     │
     │  Firestore onDocumentCreated .../messages/{messageId}
     ▼
sendQueuedMessage (onDocumentCreated, HOLDS RESEND_API_KEY)  [handler body exported separately]
  │  ① load messages/{id} + parent service doc (Admin SDK)
  │  ② TRANSACTION: read status; if 'queued' → flip 'sending'; else return "already claimed"
  │       ('scheduled' never satisfies the guard → left inert for Phase 61 cron)
  │  ③ re-resolve recipients from scratch  (ported resolveServiceRoleAssignments, Admin SDK)
  │  ④ render subject/body tokens, {{their_roles}} PER RECIPIENT
  │  ⑤ for each recipient: resend.emails.send({ from, to, subject, html/text,
  │       tags:[{name:'orgId',value},{name:'serviceId',value},
  │             {name:'messageId',value},{name:'recipientId',value}] })   [MOCKED in tests]
  │       + sendCopyToSelf → also send to requesting editor's own email (server-resolved)
  │  ⑥ write recipients/{id} per recipient (status 'sent'|'failed', providerMessageId)
  │  ⑦ roll up deliveryCounts, flip messages/{id}.status = 'sent'|'partial'|'failed'
  ▼
Resend API (real key server-side only; never in client bundle) ── tags echoed back on
                                                                   Phase 60's Svix webhook
```

### Recommended Structure (files this phase touches)
```
functions/src/
├── index.ts                    # + defineSecret RESEND_API_KEY, + 2 exported Functions
│                               #   (or split into functions/src/messaging/* per ARCHITECTURE;
│                               #    implementer discretion — index.ts is the shipped convention)
├── serviceRoles.ts             # NEW — ported copy of src/utils/serviceRoles.ts (types rewired)
└── index.test.ts (or messaging.test.ts) # + queueServiceMessage/sendQueuedMessage handler tests

src/
├── components/MessageComposer.vue          # NEW
├── components/__tests__/MessageComposer.test.ts  # NEW
├── views/ServiceEditorView.vue             # + ✉ action-bar item
└── <client wrapper for queueServiceMessage> # mirrors PptxImportModal.vue:314-322
```

### Pattern 1: Handler body exported separately from the trigger wrapper
**What:** Export the async handler as a plain function; the `onDocumentCreated`/`onCall` wrapper just calls it.
**When to use:** Every new Function this phase — enables direct unit testing without the Functions test harness.
**Example (verified precedent):**
```typescript
// Source: functions/src/index.ts:392-518
export async function requestPptxRenderHandler(params: { orgId: string; importId: string }): Promise<RenderOutcome> {
  const docRef = pptxRenderDocRef(params.orgId, params.importId);
  const doc = await docRef.get();
  if (!doc.exists) { return { status: "failed", renderedCount: 0, failureReason: "missing-render-doc" }; }
  // ...work...
}
export const requestPptxRender = onDocumentCreated(
  "organizations/{orgId}/pptxRenders/{importId}",
  async (event) => { await requestPptxRenderHandler({ orgId: event.params.orgId, importId: event.params.importId }); },
);
```
`sendQueuedMessageHandler({ orgId, serviceId, messageId })` + `export const sendQueuedMessage = onDocumentCreated(".../messages/{messageId}", ...)` mirrors this exactly.

### Pattern 2: Independent server-side authorization re-check
**What:** Re-verify org membership (here: org-**editor**) with a Firestore read; never trust the client-declared orgId.
**Example (verified precedent):**
```typescript
// Source: functions/src/index.ts:292-302 (parsePptxHandler)
const memberDoc = await getFirestore().collection("organizations").doc(orgId)
  .collection("members").doc(request.auth.uid).get();
if (!memberDoc.exists) { throw new HttpsError("permission-denied", "You are not a member of this organization."); }
```
`queueServiceMessage` extends this to an **editor**-tier check + a kill-switch read.

### Pattern 3: Client callable invocation
**What:** `httpsCallable<Req, Res>(functions, 'name')` then `await fn(payload)`.
**Example (verified precedent):**
```typescript
// Source: src/components/PptxImportModal.vue:314-322
const parsePptx = httpsCallable<{ orgId: string; importId: string; storagePath: string }, { slides: ... }>(functions, 'parsePptx')
const result = await parsePptx({ orgId: props.orgId, importId, storagePath })
```
Composer wrapper: `httpsCallable<QueueMessageReq, { messageId: string }>(functions, 'queueServiceMessage')`. `functions` is imported from `src/firebase/index.ts:21`.

### Anti-Patterns to Avoid
- **Trusting the client's recipient list at send time** (ARCHITECTURE Anti-Pattern 1): `sendQueuedMessage` MUST re-resolve from Firestore. The client `recipientSelector` is *intent* (who to resolve), never a final email list. For a scheduled send the roster may genuinely have changed — re-resolution is a correctness feature, not just defense.
- **Calling `buildServiceSnapshot` server-side:** it is a **client store function** (imports `useSongStore`/`useRosterStore`/`useQuartersStore`, `src/stores/services.ts:114-134`) and uses the `@/` alias — it is NOT runnable or importable in `functions/`. The server render path must derive `{{song_list}}` from the service doc's `slots` and `{{service_link}}` from the share link directly (see §Token Rendering).
- **One do-everything callable** (Anti-Pattern 2): keep enqueue and send split so the future cron reuses the same doc shape and trigger.
- **Binding `RESEND_API_KEY` to `queueServiceMessage`:** only `sendQueuedMessage` gets the secret — smallest gated-deploy review surface (R131 intent).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recipient resolution | A new team→person walk in the Function | Port `resolveServiceRoleAssignments` (`src/utils/serviceRoles.ts:33-56`) verbatim | It already computes `override ?? scheduled ?? []` per role, dedup-ready; the client `resolveRecipients` wraps it — server must match to agree with the "Reaches N" estimate. |
| Transactional send-claim | An ad-hoc read-then-`update` | `getFirestore().runTransaction(...)` reading `status` and guarding `=== 'queued'` | Only a transaction is race-safe against a retried `onDocumentCreated`. |
| Provider send / retries / bounce parsing | A raw `fetch` to an SMTP/HTTP endpoint | `resend` SDK (`resend.emails.send`) | Handles auth, batching, tags, and the Svix-signed webhook echo Phase 60 consumes. |
| Feature gate | Scattered `settings.messaging.enabled` reads | `isMessagingEnabled()` (`src/utils/messaging.ts`, Phase 58) client-side + explicit server re-check | Single choke point; server re-check is the real boundary. |

**Key insight:** Nearly everything is reuse. The only genuinely new logic is (a) the transactional `queued→sending` claim, (b) the ported resolver copy, (c) token rendering, and (d) the composer UI. Treat those four as the risk surface.

## Token Rendering (R138/R139) — where each token resolves

| Token | Client PREVIEW source (sample) | Server AUTHORITATIVE source (`sendQueuedMessage`) |
|-------|-------------------------------|---------------------------------------------------|
| `{{service_date}}` | `service.date` (formatted) | `service.date` from the loaded service doc |
| `{{service_link}}` | existing share link (client store) | the service's stored share-link URL, read via Admin SDK (do NOT rebuild via `buildServiceSnapshot`) |
| `{{their_roles}}` | sample recipient's roles from `resolveServiceRoleAssignments` | **per recipient** — that person's `roleNames` from the ported resolver's `effectivePersonIds` (R139) |
| `{{song_list}}` | SONG slots' titles (client can use `buildServiceSnapshot`) | derived from the service doc's `slots` where `kind === 'SONG'` (Admin SDK read) — `buildServiceSnapshot` is Pinia/`@/`-bound and not importable in functions |

**Body stores the raw token template**, never pre-rendered (ARCHITECTURE §Data Model): `{{their_roles}}` can only be correct per-recipient at send time. The composer preview renders against a **representative sample** recipient and is clearly labelled a sample (UI-SPEC #9).

## Common Pitfalls

### Pitfall 1: Assuming the PPTX precedent already does a status-claim (IT DOES NOT)
**What goes wrong:** Copying `requestPptxRenderHandler` and assuming its idempotency is a status guard you can mirror.
**Root cause:** `requestPptxRenderHandler` (`functions/src/index.ts:392-508`) re-reads the doc and proceeds; it guards only on **missing doc / missing storagePath / unconfigured URL** — there is **no transactional `status` claim**. It tolerates a duplicate `onDocumentCreated` because a re-render is idempotent-ish, not because it claims a status.
**How to avoid:** `sendQueuedMessage`'s `queued→sending` transaction is **new code** with no exact in-repo precedent — write it deliberately and unit-test the "already claimed" branch (a second invocation must NOT re-send). CONTEXT calls it "mirrors real precedent"; the precedent is the *queue-then-trigger split*, not a status claim.
**Warning signs:** A test that sends twice on a duplicate trigger passes silently.

### Pitfall 2: Trying to import `../src/utils` from `functions/`
**What goes wrong:** `import { resolveServiceRoleAssignments } from '../../src/utils/serviceRoles'` (or `@/...`) fails to compile.
**Root cause:** `functions/tsconfig.json` has `"include": ["src"]`, no `rootDir` override, no `baseUrl`/`paths`, no `@/` alias (`functions/tsconfig.json:1-15`). `src/utils/serviceRoles.ts` imports `@/types/service` / `@/types/roster` (`src/utils/serviceRoles.ts:6-7`) which do not resolve in the functions project; and `../src` sits outside the inferred rootDir (TS6059). Grep confirms **zero** `../src` or `@/` imports exist in `functions/src/` today.
**How to avoid:** **Port a copy** into `functions/src/serviceRoles.ts` with its `@/types/*` imports rewired to functions-local type declarations (inline the small `Service`/`Quarter`/`Role`/`RoleGroup`/`Person` shapes it needs). ARCHITECTURE §Recipient Resolution records this as a standing "keep in lockstep, no shared package" maintenance note.
**Warning signs:** `tsc` in `functions/` errors TS2307 (cannot find module `@/...`) or TS6059 (file not under rootDir).

### Pitfall 3: Resend `tags` charset restriction
**What goes wrong:** A tag value with a disallowed character is rejected by the send.
**Root cause:** Resend `tags` (name and value) allow only **ASCII letters, numbers, underscores, dashes** `[CITED: resend.com/docs]`. Firestore auto-IDs (the `orgId`/`serviceId`/`messageId`/`recipientId` this phase passes) are `[A-Za-z0-9]` and safe — but validate before sending if any ID could contain other characters.
**How to avoid:** Assert/sanitize IDs are tag-safe; tags are what the Phase 60 webhook echoes back, so keep them the exact document-path segments (no `collectionGroup` query needed later).

### Pitfall 4: `.env.local` absent in a worktree breaks the emulator/build
**What goes wrong:** Functions emulator, full unit suite, or `vite build` fail without secrets.
**Root cause / avoid:** Per CLAUDE.md, symlink or copy `C:\projects\worshipplanner\.env.local` into any new worktree before running the emulator/tests/build. Not relevant to the mocked unit tests (which stub `defineSecret`) but relevant to any live-emulator verification.

## Code Examples

### Functions test harness (Resend mocked, no secret needed)
```typescript
// Source: functions/src/index.test.ts:33-67 (existing pattern to extend)
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), getApps: vi.fn(() => []) }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP_SENTINEL"), increment: vi.fn((n) => ({ __inc: n })) },
}));
vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn(() => ({ value: () => "fake-secret" })),   // RESEND_API_KEY never real in tests
  defineString: vi.fn(() => ({ value: () => "" })),
}));
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: vi.fn((_path: string, handler: unknown) => handler),
  onDocumentWritten: vi.fn((_path: string, handler: unknown) => handler),
}));
// NEW for Phase 59 — no real email is ever sent:
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: vi.fn(async () => ({ data: { id: "re_fake_123" }, error: null })) } })),
}));
// then: import { sendQueuedMessageHandler, queueServiceMessageHandler } from "./index";
//       invoke the handler bodies directly with a fake CallableRequest / { orgId, serviceId, messageId }.
```
Alternative per CONTEXT discretion: **dependency-inject the sender** (pass a `sender` fn into the handler) instead of `vi.mock("resend")` — either satisfies "no real email, no secret."

### Client callable wrapper (composer)
```typescript
// mirrors src/components/PptxImportModal.vue:314-322
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
const queueServiceMessage = httpsCallable<
  { orgId: string; serviceId: string; type: 'oneoff'|'reminder'|'share-link'; subject: string; body: string;
    recipientSelector: { teams: string[]; individualPersonIds: string[]; includeEveryone: boolean };
    options: { attachServiceLink: boolean; sendCopyToSelf: boolean }; scheduledFor: string | null },
  { messageId: string }
>(functions, 'queueServiceMessage')
const { data } = await queueServiceMessage(payload)
```

## Runtime State Inventory

Not applicable — Phase 59 is additive greenfield (new component + new Functions + populates already-defined collections). No rename/refactor/migration. No stored data re-keying, live-service config, OS-registered state, secret renames, or build-artifact staleness introduced. **None — verified: this phase adds new code paths and writes new docs; it renames nothing.**

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` → treated as **enabled**.

### Test Frameworks (two separate suites)
| Property | App suite (client) | Functions suite (server) |
|----------|--------------------|--------------------------|
| Framework | Vitest (root, jsdom) | Vitest `^4.1.10` (node) |
| Config | `vite.config.ts` `test` block (`vite.config.ts:143-165`) | `functions/vitest.config.ts` (env `node`, `include: ['src/**/*.test.ts']`) |
| Quick run command | `npx vitest run <file>` | `cd functions && npx vitest run src/index.test.ts` |
| Full suite command | `npx vitest run` (excludes `rules.test.ts`, `functions/lib/**`, `render-service/**`) | **`cd functions && npm test`** (= `vitest run`) — **CONFIRMED** via `functions/package.json:9` |
| Typecheck gate | `npm run type-check` (`vue-tsc --build`, includes test files — per CLAUDE.md) | `cd functions && npm run build` (= `tsc`, `functions/package.json:6`) — **CONFIRMED** |

**Known-failing app-suite baseline (per CLAUDE.md, do NOT chase):** `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). A Phase 59 change is regression-free if it adds no *new* failing app-suite file beyond these two.

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | Suite / File | Exists? |
|-----|----------|-----------|-------------------|--------------|---------|
| R131 | `sendQueuedMessage` calls Resend (mocked) with the server-held key; `queueServiceMessage` does not; no recipient list crosses to client | unit | `cd functions && npx vitest run src/index.test.ts` | functions / `index.test.ts` (new describe) | ❌ Wave 0 |
| R131 | `queueServiceMessage` rejects a non-editor / wrong-org caller (independent re-check) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| R131 | `queueServiceMessage` rejects when kill-switch off server-side | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| R136 | ✉ action present for editor & `isMessagingEnabled()`; disabled when off; absent for viewer | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.*.test.ts` (or a new spec) | app | ❌ Wave 0 |
| R136 | Composer renders team chips + individuals; selection writes `{teams, individualPersonIds, includeEveryone}` | unit (component) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | app | ❌ Wave 0 |
| R137 | Type selector maps to `oneoff|reminder|share-link` and seeds defaults (dirty-guard) | unit (component) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | app | ❌ Wave 0 |
| R138 | Token chip inserts `{{token}}` at caret; body stores raw template | unit (component) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | app | ❌ Wave 0 |
| R138/R139 | Server renders `{{their_roles}}` **per recipient** (person A ≠ person B); `{{song_list}}` from slots | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| R139 | `sendQueuedMessage` sends one personalized email per recipient; `sendCopyToSelf` adds the editor's own address (server-resolved) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| R140 | "Reaches N" recomputes on selection change; pluralizes 0/1/many; unreachable count shown | unit (component, `zero-one-many` backstop per UI-SPEC) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | app | ❌ Wave 0 |
| R141 | Options write `attachServiceLink`/`sendCopyToSelf`/`scheduledFor`; schedule sets `status:'scheduled'` + CTA flips | unit (component) | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | app | ❌ Wave 0 |
| Idempotency (CONTEXT success crit. 4) | Duplicate `onDocumentCreated` → transactional claim; second invocation does NOT re-send; `scheduled` doc is skipped by `=== 'queued'` guard | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single new/edited spec — `npx vitest run <file>` (app) or `cd functions && npx vitest run src/index.test.ts` (functions).
- **Per wave merge:** `npx vitest run` (app suite) **and** `cd functions && npm test` (functions suite).
- **Phase gate:** both suites green (app minus the 2-file known baseline), plus `npm run type-check` **and** `cd functions && npm run build`, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/components/__tests__/MessageComposer.test.ts` — covers R136/R137/R138/R140/R141 (component behavior + zero-one-many pluralization backstop).
- [ ] Functions describe blocks for `queueServiceMessage` + `sendQueuedMessage` in `functions/src/index.test.ts` (or a new `functions/src/messaging.test.ts` if the Functions are split into `functions/src/messaging/`) — covers R131/R139/idempotency/per-recipient render.
- [ ] `vi.mock("resend")` (or the DI sender seam) added to the functions test file.
- [ ] Ported `functions/src/serviceRoles.ts` needs its own resolver unit test kept in lockstep with `src/utils/__tests__/serviceRoles` coverage.
- [ ] Framework install: `cd functions && npm install resend@6.19.0` (behind a `checkpoint:human-verify`, per the legitimacy audit).

## Security Domain

> `security_enforcement` is not present in `.planning/config.json` → treated as **enabled**.

Phase 59 introduces **one new trust boundary: the send path**. A client can now cause emails to be sent to volunteers. The design's entire defense is that the client controls *intent* only, never the send list, the key, or the authorization verdict.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (this phase) |
|---------------|---------|-------------------------------|
| V2 Authentication | yes | `queueServiceMessage` requires `request.auth` (unauthenticated → `HttpsError`), mirroring `parsePptxHandler:275-277`. |
| V4 Access Control | yes | Independent org-**editor** re-check via Firestore members read (`parsePptxHandler:292-302` pattern); never trust client-declared orgId. Firestore rules already deny client writes to `recipients` and status updates (`firestore.rules:141-153`, Admin-SDK-only). |
| V5 Input Validation | yes | Validate `type` enum, `scheduledFor` (not absurd/not past for send-now), and Resend tag charset (`[A-Za-z0-9_-]`) before send. `recipientSelector` is *never* trusted as a final list — re-resolved server-side. |
| V6 Cryptography / Secrets | yes | `RESEND_API_KEY` via `defineSecret`, bound **only** to `sendQueuedMessage`; never in the client bundle (R131). Do not log the key or full recipient emails at info level. |
| V7 Error Handling / Logging | yes | Per-recipient try/catch so one bad address → `status:'failed'` on that recipient doc, not an aborted batch (mirrors `requestPptxRenderHandler`'s per-item resilience). Message rolls up to `partial`. |
| V3 Session Management | no | Firebase Auth session handled by the platform; no new session state. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client forges a recipient list / emails arbitrary addresses | Spoofing / Elevation | `sendQueuedMessage` re-resolves recipients from Firestore via Admin SDK; the client list is discarded (Anti-Pattern 1). |
| Compromised client sends despite kill-switch off | Elevation | `queueServiceMessage` re-reads `settings.messaging.enabled` server-side; the UI gate is convenience only. |
| Cross-org send (client-declared orgId) | Tampering / Elevation | Independent org-editor membership read scoped to the path-derived orgId; `firestore.rules` `isOrgEditor` resolves orgId from the path, never a client field. |
| Retried trigger double-sends (at-least-once delivery) | — (duplication) | Transactional `queued→sending` claim; a second invocation returns "already claimed" without sending. **New code — test explicitly (Pitfall 1).** |
| Secret leakage to client bundle | Information Disclosure | `resend` is a `functions/package.json` dep only; key via `defineSecret` bound to one Function; verify no `resend`/key import reaches `src/`. |
| Forged bounce event marks recipients bounced | Tampering | Out of scope this phase (Phase 60's HMAC/Svix-verified `messageWebhook`). Phase 59 only writes send-time tags that the webhook will later verify. |

**Note on the existing rule:** `messages` `allow create: if isOrgEditor` (`firestore.rules:143`) is **defense-in-depth**, not the enforcement point — `queueServiceMessage` writes via the Admin SDK, which bypasses rules. The Function's own org-editor re-check is the real control.

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| `functions.config()` for config | `defineSecret`/`defineString` (params) | Firebase Functions v2 (already adopted here, `functions/src/index.ts:4,18-20`) | Use `defineSecret("RESEND_API_KEY")` — do not reach for the deprecated config API. |
| Manual webhook signature crypto | Resend uses Svix-signed webhooks (`svix-id/timestamp/signature`, `webhooks.verify`) | current | Relevant to **Phase 60**, not this phase; noted so the send-time tags are shaped for it. |

**Deprecated/outdated:** none introduced. `resend@6.20.0` is the current line (published 2026-08-13); pin `6.19.0` to avoid a <24h release (see audit).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `resend` npm | `sendQueuedMessage` send | ✗ (not yet installed) | target `6.19.0` | — (install behind checkpoint) |
| Real `RESEND_API_KEY` | live send | ✗ (by design) | — | tests mock it; owner sets at `/gsd-verify-work` |
| Firebase Functions emulator | live-emulator verification (optional) | needs `.env.local` | — | mocked unit tests need no emulator |
| Node 22 | functions runtime | ✓ (declared `functions/package.json:12`) | 22 | — |

**Missing with no fallback:** none blocks this phase — the entire send path is built and tested against a mocked provider; the real key/DNS/deploy are deliberately deferred to the owner.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `{{service_link}}` server-side reads the service's already-stored share-link URL (not rebuilt via `buildServiceSnapshot`). | Token Rendering | If no share link exists yet at send time, the token renders empty; planner may need `sendQueuedMessage` to trigger/ensure a share link, or the composer to require `attachServiceLink` before that token is usable. LOW–MEDIUM. |
| A2 | Firestore auto-IDs used for orgId/serviceId/messageId/recipientId are Resend-tag-safe (`[A-Za-z0-9_-]`). | Pitfall 3 | If any ID contains other chars, the send is rejected — mitigated by validating before send. LOW. |
| A3 | Pinning `resend@6.19.0` (vs `6.20.0`) is acceptable; `6.19.0` is a stable line with the same `emails.send`/tags API. | Package audit | If `6.19.0` lacks a needed API, bump to `6.20.0` (still SUS-flagged). LOW. |
| A4 | Splitting the two Functions into `functions/src/messaging/*` vs adding to `index.ts` is implementer discretion; either compiles under the existing tsconfig. | Structure | None material — `functions/tsconfig.json` includes all of `src`. LOW. |

## Open Questions

1. **Share-link availability at send time (A1).**
   - Known: `{{service_link}}` needs a public share URL; `buildServiceSnapshot`/`ensureShareLink` are client/Pinia-bound.
   - Unclear: whether every service being messaged already has a share link, or whether `sendQueuedMessage` must ensure one server-side.
   - Recommendation: planner decides — simplest is to render `{{service_link}}` from the stored link and treat its absence as an empty substitution + a composer hint when `attachServiceLink` is checked. Defer share-link *creation* server-side unless required.

2. **Does root `npx vitest run` also collect `functions/src/*.test.ts`?**
   - Known: `vite.config.ts:145-164` excludes `functions/lib/**` and `render-service/**` but NOT `functions/src/**`; the functions suite has its own node-env config.
   - Recommendation: treat `cd functions && npm test` as the **authoritative** functions gate (confirmed command) and keep new functions test files node-safe/self-contained (the existing ones already survive the jsdom root run). Do not rely on the root run for functions coverage.

## Sources

### Primary (HIGH confidence)
- `functions/src/index.ts` — `parsePptxHandler` (:272-338, onCall + org re-check :292-302), `requestPptxRenderHandler`/`requestPptxRender` (:392-518, handler-exported-separately, **no status claim**), `defineSecret` (:18-20), `cleanupExpiredMediaHandler` (per-item resilience).
- `functions/src/index.test.ts:33-67` — the `vi.mock` harness to extend (admin/app, admin/firestore, functions/params, v2/firestore).
- `functions/package.json` — `test: vitest run` (:9), `build: tsc` (:6); `functions/tsconfig.json` — `include:["src"]`, no `@/` alias/`paths`; `functions/vitest.config.ts` — node env, `include: src/**/*.test.ts`.
- `src/utils/serviceRoles.ts:33-56` (resolver to port), `src/utils/messagingRecipients.ts:17,52-83` (`MESSAGING_TEAM_LABELS`, `resolveRecipients`), `src/stores/services.ts:104-154` (`buildServiceSnapshot`, client/Pinia-bound), `src/components/PptxImportModal.vue:314-322` (client callable), `src/firebase/index.ts:21` (`functions` export).
- `firestore.rules:141-164` — `messages`/`recipients`/`lockSnapshots` blocks already shipped (Phase 58).
- `.planning/research/ARCHITECTURE.md` — §Send Path, §Data Model, §Recipient Resolution, §Anti-Patterns, §Security-Rule Implications, §Build Order (Phases B+C).
- `.planning/REQUIREMENTS.md:28,48-64` — R131, R136–R141 text.
- `vite.config.ts:143-165` + CLAUDE.md — app-suite scoping and the 2-file known-failing baseline.

### Secondary (MEDIUM confidence)
- `npm view resend` — version `6.20.0`, published 2026-08-13, no postinstall `[VERIFIED: npm registry]`.
- `gsd-tools query package-legitimacy check` — `resend` verdict `SUS`/`too-new`, 9.57M weekly downloads, repo `github.com/resend/resend-node`.
- Resend webhooks/tags docs — tags echoed on Svix-signed webhook events; tag charset `[A-Za-z0-9_-]` `[CITED: resend.com/docs/webhooks, resend.com/changelog]`.

### Tertiary (LOW confidence)
- None load-bearing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every Function/pattern anchored to shipped file:line; resend verified on registry.
- Architecture: HIGH — direct reuse of the proven PPTX triad; ARCHITECTURE.md consolidated.
- Pitfalls: HIGH — the "no status claim in precedent" and "functions can't import ../src" findings are grep-verified against the live tree.

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (30 days; `resend` line moves fast — re-verify the pin if picking this up later).
