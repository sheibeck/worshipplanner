# Phase 59: Messages Composer & Send Path - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas defaulted per the v1.7 standing autonomy grant; grounded in `.planning/research/ARCHITECTURE.md` §Send Path / §Data Model / §Recipient Resolution / §Anti-Patterns, `.planning/research/DESIGN-messaging.md`, and the Phase 58 foundation that already shipped)

<domain>
## Phase Boundary

Deliver the ✉ **Messages composer** and the **queue-then-trigger send path** so a planner can compose
and send an email to a service's volunteers — with the provider's API key confined to a single
server-side Function. This is the first phase in v1.7 that actually sends.

Requirements: R131 (backend send path holds the provider key), R136 (✉ Messages button opens a composer,
teams-first recipients + individuals), R137 (three message types: One-off, Reminder, Share service link),
R138 (subject + body with insertable merge tokens: service date, service link, their roles, song list),
R139 (personalized per-recipient email — "their roles" renders that person's own roles), R140 (live
"Reaches N people" count minus unreachable), R141 (attach-service-order-link, send-me-a-copy,
schedule-for-later options).

Out of this phase:
- **Delivery-history panel + hard-bounce webhook** → Phase 60 (`messageWebhook onRequest`, HMAC-verified).
  Phase 59 writes the `recipients/{id}` docs and `deliveryCounts` the history panel will later read, but
  builds no history UI and no webhook receiver.
- **Automatic lock / re-lock notifications** → Phases 61–62.
- **Scheduled-reminder cron** (`sendScheduledReminders`) → Phase 61. Phase 59's composer *offers*
  schedule-for-later and persists `scheduledFor`, but the daily sweep that actually dispatches a
  future-dated message is Phase 61's cron (see the schedule-for-later decision below).
</domain>

<decisions>
## Implementation Decisions

### Provider = Resend; account + DNS are OWNER steps; build against a MOCK (R131)
- Provider is **Resend** (`resend` npm SDK), per `research/SUMMARY.md`'s recommendation. It is added to
  **`functions/package.json`** only (the send path is server-side); the client never imports it.
- Per the v1.7 grant, **this phase builds and unit-tests with the Resend SDK MOCKED** — no real send, no
  deploy. The send Function ships **built, tested, UNDEPLOYED**. Owner tasks handed over at
  `/gsd-verify-work`: (a) create the Resend account, (b) `firebase functions:secrets:set RESEND_API_KEY`,
  (c) domain SPF/DKIM/DMARC DNS records, (d) `firebase deploy --only functions:queueServiceMessage,functions:sendQueuedMessage`.
- `RESEND_API_KEY` is a `defineSecret("RESEND_API_KEY")` in `functions/src/index.ts`, mirroring the
  existing `CLAUDE_API_KEY`/`ESV_API_KEY`/`NLT_API_KEY` secrets. It is bound ONLY to `sendQueuedMessage`
  (the one Function that ever holds it) — `queueServiceMessage` does NOT get the secret (it only enqueues).

### Send path = thin `onCall` enqueue → `onDocumentCreated` trigger (R131, R139)
Mirrors the EXISTING `parsePptxHandler` → `pptxRenders/{importId}` → `requestPptxRender` triad
(`functions/src/index.ts`), the codebase's proven queue-then-trigger shape. Two new Functions:

- **`queueServiceMessage`** (`onCall`, NO provider secret): independently re-checks org-editor membership
  of *this* org (never trusts the client-declared orgId — `parsePptxHandler:292-301` precedent), checks
  the org **kill-switch is actually on** server-side, validates `scheduledFor` is not absurd, then writes
  ONE `messages/{id}` doc via a shared `createQueuedMessage()` helper (so the future cron shapes the doc
  identically). Returns the new message id. Does NOT resolve recipients or send.
- **`sendQueuedMessage`** (`onDocumentCreated` on `.../messages/{messageId}`, HOLDS `RESEND_API_KEY`),
  handler body exported separately from the trigger wrapper for direct unit testing (mirrors
  `requestPptxRenderHandler`):
  1. Load the `messages/{id}` doc + parent service doc (Admin SDK).
  2. **Idempotency claim (success criterion 4):** run a Firestore **transaction** that reads
     `messages/{id}.status` and, only if it is `queued`, flips it to `sending`; if it is anything else
     (`sending`/`sent`/`scheduled`/…) the transaction returns "already claimed" and the handler
     returns without sending. This stops a **retried `onDocumentCreated` trigger** from double-sending
     (the same at-least-once-delivery hazard `requestPptxRender` faces). A future-dated `scheduled`
     doc never satisfies the `=== 'queued'` guard, so it is left untouched for Phase 61's cron.
  3. **Re-resolve recipients from scratch** via an Admin-SDK port of `resolveServiceRoleAssignments`
     (Anti-Pattern 1: the client's list is a live *estimate*, never the send list). Selector's
     teams/individuals/everyone are instructions for *who to resolve*, not a final email list.
  4. Render `subject`/`body` tokens, personalizing "their roles" **per recipient** (R139).
  5. Call Resend once per recipient (mock in tests), capturing the provider message id; pass
     `{ orgId, serviceId, messageId, recipientId }` as Resend metadata/tags so Phase 60's webhook can
     address the exact `recipients/{id}` doc with no `collectionGroup` query.
  6. Write one `recipients/{id}` doc per recipient (`status: 'sent'` | `'failed'`), roll up
     `deliveryCounts`, and flip `messages/{id}.status` to `sent` | `partial` | `failed`.
- `options.sendCopyToSelf` → also send the rendered message to the requesting editor's own email
  (resolved server-side from their member record / auth token, never a client-supplied address).

### Composer UI — `MessageComposer.vue`, opened from the service action bar (R136, R137, R138, R140, R141)
- New `src/components/MessageComposer.vue` (modal/panel), opened by a ✉ **Messages** action wired into
  `ServiceEditorView.vue`'s `buildActionBarItems` (same action-bar plumbing every other service action
  uses). The action is **hidden or disabled when `isMessagingEnabled()` is false** (the Phase 58 choke
  point) — a fresh org with messaging off shows no live send surface. Editor-gated (`authStore.isEditor`).
- **Recipients teams-first** (R136): the four teams (`MESSAGING_TEAM_LABELS` from Phase 58 —
  Worship/Tech/Vocals/Hosts) as the primary selector, plus an "Everyone assigned" option, with
  individual people addable below. Selection state is the `recipientSelector` shape
  `{ teams, individualPersonIds, includeEveryone }`.
- **Three message types** (R137): One-off, Reminder, Share service link — a type selector that seeds
  sensible subject/body defaults (e.g. Share-link pre-inserts the `{{service_link}}` token). Maps to
  `messages.type` `'oneoff' | 'reminder' | 'share-link'`.
- **Subject + body with insertable merge tokens** (R138): a token catalog — `{{service_date}}`,
  `{{service_link}}`, `{{their_roles}}`, `{{song_list}}` — inserted at the cursor. Bodies store the raw
  token template (NOT pre-rendered), because `{{their_roles}}` can only be correct per-recipient at send
  time (ARCHITECTURE §Data Model). The composer shows a **preview** rendering tokens against a
  representative sample (the current user, or the first reachable recipient) so the planner sees the shape
  — clearly labelled a sample, not the final per-person text.
- **Live "Reaches N people"** (R140): reuse Phase 58's pure `resolveRecipients(service, quarters, roles,
  people, selection)` → `{ reachable, unreachableCount }`; show `Reaches {reachable.length} people` and,
  when `unreachableCount > 0`, a muted "· N have no email" note. Recomputes on every selection change.
- **Options** (R141): attach-service-order-link (→ `options.attachServiceLink`, appends the public share
  link / enables the `{{service_link}}` token), send-me-a-copy (→ `options.sendCopyToSelf`), and
  schedule-for-later (a date/time → `scheduledFor`). Send button calls `queueServiceMessage`.

### Schedule-for-later scope (R141) — DEFAULTED grey area
- **Send-now** works end-to-end this phase (mocked): `queueServiceMessage` writes `status: 'queued'`, the
  `sendQueuedMessage` trigger fires immediately and sends.
- **Schedule-for-later** this phase **persists intent only**: `queueServiceMessage` writes
  `scheduledFor` + `status: 'scheduled'`. The trigger's idempotency guard (`=== 'queued'`) intentionally
  skips it, so a scheduled doc sits inert until dispatched. **Actual dispatch of a due scheduled message
  is Phase 61's daily cron** (`sendScheduledReminders` will also sweep `messages` where `status ==
  'scheduled' && scheduledFor <= now` and flip them to `queued`, re-triggering the same send path). This
  keeps Phase 59 scoped to the composer + immediate send primitive without a second scheduling mechanism,
  and reuses the one-code-path property. Recorded as a Phase 61 dependency in the roadmap notes; flag at
  verification so it is not mistaken for an incomplete Phase 59.

### Data model (already specified in Phase 58's rules + ARCHITECTURE) — this phase POPULATES it
- `messages/{id}`: `{ type, status, subject, body, recipientSelector, options, changeDiff:null,
  scheduledFor, requestedByUid, createdAt, sentAt, deliveryCounts }` (ARCHITECTURE §Data Model).
- `messages/{id}/recipients/{id}`: `{ personId, email, name, roleNames, status, providerMessageId,
  bounceReason, sentAt, bouncedAt }` — written by `sendQueuedMessage` (Admin SDK; rules deny client
  writes, already deployed-gated in Phase 58).
- The `firestore.rules` `messages`/`recipients` blocks from Phase 58 already gate this (create =
  isOrgEditor, recipients write = false / Admin-SDK-only). **No new rules this phase** unless a gap
  surfaces; if one does it ships deploy-gated with the exact command.

### Claude's Discretion
- Composer modal-vs-drawer presentation, token-insertion UX (button palette vs `/`-menu), the exact
  `RESEND`-mock test seam (dependency-inject the sender vs `vi.mock('resend')`), `createQueuedMessage()`
  helper location, and delivery-count rollup field names — all at implementer discretion, guided by
  codebase conventions, the imported design, and ARCHITECTURE.md.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/index.ts` — the queue-then-trigger triad to mirror: `parsePptxHandler`/`parsePptx`
  (`onCall`, ~248-338), `requestPptxRenderHandler`/`requestPptxRender` (`onDocumentCreated`, handler
  exported separately for unit test, ~371-518), `defineSecret` usage (~18-20), independent org-membership
  re-check (~292-301). `cleanupExpiredMedia`/`cleanupOrphanRenders` are the `onSchedule` analogs Phase 61
  will use.
- `src/utils/messagingRecipients.ts::resolveRecipients` + `MESSAGING_TEAM_LABELS` (Phase 58) — the live
  "Reaches N" source, reused verbatim by the composer.
- `src/utils/serviceRoles.ts::resolveServiceRoleAssignments` / `findQuarterForDate` — the resolver
  `sendQueuedMessage` must PORT server-side (Admin SDK) to re-resolve recipients at send time.
- `src/stores/services.ts::buildServiceSnapshot` (~104-154) — canonical PII-guarded service serialization
  (song list, ordered slots, resolved roles) the `{{song_list}}` token + share link build on.
- `src/utils/messaging.ts::isMessagingEnabled()` (Phase 58) — the one gate the ✉ action checks.
- `ServiceEditorView.vue::buildActionBarItems` — where the ✉ Messages action is wired.
- `firestore.rules` `services/{id}/messages` + `/recipients` blocks (Phase 58) — already gate the writes.

### Established Patterns
- Queue-then-trigger: `onCall` enqueues a doc → `onDocumentCreated` does the batch work; handler bodies
  exported separately from wrappers for unit testing; secret bound only to the Function that needs it.
- Server-side re-validation: never trust client-declared orgId or client recipient lists.
- Pure `utils/` resolver reused across client (estimate) and a server-side port (authoritative).

### Integration Points
- `functions/src/index.ts` (2 new Functions + secret), `functions/package.json` (`resend` dep),
  `ServiceEditorView.vue` (action-bar ✉ + composer mount), new `MessageComposer.vue`, a client wrapper to
  call `queueServiceMessage` (mirroring how the client calls `parsePptx`). Roster/quarters/roles read-only.
</code_context>

<specifics>
## Specific Ideas
- The imported design ("Turn 5 — Messaging volunteers", composer 5a in `research/DESIGN-messaging.md`) is
  the composer's visual reference — teams-first recipient chips, message-type selector, token insertion,
  "Reaches N" line, and the options row. OMIT "opened" tracking (out of scope; sent + bounces only).
- Only ONE Function ever holds the Resend secret (`sendQueuedMessage`) — smallest review surface for the
  owner's gated deploy, per R131's intent.
- Kill-switch OFF must hide/disable the live send surface, not just fail server-side.
</specifics>

<deferred>
## Deferred Ideas
- Delivery-history panel + `messageWebhook` HMAC-verified bounce receiver → Phase 60 (reads the
  `recipients`/`deliveryCounts` this phase writes).
- `sendScheduledReminders` daily cron (auto-reminder N-days-before AND dispatch of user-scheduled
  `status:'scheduled'` messages) → Phase 61.
- Automatic lock / re-lock notifications + `lockSnapshots/current` writes → Phases 61–62.
- Real send / provider account / domain DNS / secret set / deploy → OWNER, handed over at
  `/gsd-verify-work`.
</deferred>
