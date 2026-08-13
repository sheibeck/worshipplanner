# Architecture Research: Volunteer Messaging & Notifications (v1.7)

**Domain:** Integration of a new messaging/notifications subsystem into an existing Vue 3 + Firebase (Firestore/Auth/Functions) worship-planning SPA
**Researched:** 2026-08-13
**Confidence:** HIGH — every recommendation below is anchored to a real, currently-shipping file in this codebase (cited by path), not a generic pattern. The two genuinely new decisions (email provider choice, exact SLIDES-diff fingerprinting) are flagged explicitly as open questions rather than asserted.

This is an **integration** research file, not a greenfield stack pick — v1.7 has zero net-new architectural primitives to invent. Every seam below reuses a pattern this codebase already ships: org-scoped subcollections, a Pinia store owning `onSnapshot` + guarded writes, an `onCall`/`onRequest`/`onSchedule` Cloud Function triad, and a single-choke-point feature toggle. The work is wiring, not architecture.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CLIENT (Vue 3 SPA)                                                        │
│                                                                            │
│  ServiceEditorView.vue                                                    │
│   ├─ action bar: NEW "✉ Messages" button ─────► MessageComposer.vue (new)│
│   │                                               reads: messagingRecip-  │
│   │                                               ients.ts (new, pure)    │
│   │                                               + rosterStore + quarters│
│   │                                               store (existing)        │
│   │                                               writes: services/{id}/  │
│   │                                               messages/{msgId} via    │
│   │                                               queueServiceMessage()   │
│   │                                               callable                │
│   │                                                                       │
│   ├─ onMarkAsPlanned() (existing, R037 lock)                              │
│   │    └─► NEW: write lockSnapshots/current (buildServiceSnapshot reuse)  │
│   │    └─► NEW: first-lock notify prompt → same queue path                │
│   │    └─► NEW: re-lock → serviceLockDiff.ts (new, pure) → checkable      │
│   │        diff UI → same queue path, type='relock-notification'         │
│   │                                                                       │
│   └─ Delivery history panel (new) — reads messages+recipients subcolls    │
│                                                                            │
│  SettingsView.vue — NEW messaging kill-switch + org defaults block        │
│  (same settings.<field> pattern as aiEnabled/pcEnabled)                   │
└───────────────────────────┬────────────────────────────────────────────-─┘
                             │ Firestore (client SDK, rules-gated)
┌────────────────────────────▼───────────────────────────────────────────-─┐
│ FIRESTORE  organizations/{orgId}/                                        │
│   services/{serviceId}                       (existing)                  │
│     ├─ messages/{messageId}                  NEW — queued/sent record    │
│     │    └─ recipients/{recipientId}         NEW — per-recipient status  │
│     └─ lockSnapshots/current                 NEW — re-lock diff baseline │
│   settings (nested on org doc)               existing + NEW `messaging`  │
│   people, roles, quarters                    existing (unmodified — READ │
│                                               ONLY source for recipients)│
└───────────────────────────┬────────────────────────────────────────────-─┘
                             │ onDocumentCreated / onDocumentWritten trigger
┌────────────────────────────▼──────────────────────────────────────────-──┐
│ CLOUD FUNCTIONS (functions/src/, Admin SDK — bypasses Firestore rules)   │
│                                                                            │
│  queueServiceMessage (onCall, NEW)                                       │
│    — thin: auth + org-membership + kill-switch check, writes the         │
│      `messages` doc. Mirrors parsePptxHandler's shape exactly.           │
│                                                                            │
│  sendQueuedMessage (onDocumentCreated on .../messages/{id}, NEW)          │
│    — the ONLY place that holds the provider secret and calls it.         │
│      Re-resolves recipients server-side (never trusts the client list),  │
│      renders tokens, calls provider, writes recipients/{id} docs,        │
│      rolls up message status. Mirrors requestPptxRenderHandler's shape.  │
│                                                                            │
│  sendScheduledReminders (onSchedule, daily cron, NEW)                     │
│    — mirrors cleanupExpiredMedia/cleanupOrphanRenders exactly. Scans due  │
│      services, creates `messages` docs (type='reminder'); does NOT call  │
│      the provider itself — sendQueuedMessage's trigger does that, so     │
│      there is exactly one send code path for every trigger type.         │
│                                                                            │
│  messageWebhook (onRequest, NEW, HMAC-verified, no Firebase Auth)         │
│    — provider bounce/delivery callback. Updates recipients/{id}.status   │
│      and rolls up messages/{id} delivery counters.                       │
└────────────────────────────────────────────────────────────────────────-─┘
                             │ HTTPS (secret held server-side only)
                    ┌────────▼─────────┐
                    │  Email provider   │  (owner-approved, chosen by STACK
                    │  (SMTP/HTTP API)  │  research — out of scope here)
                    └───────────────────┘
```

### Component Responsibilities

| Component | Responsibility | New or modified |
|-----------|-----------------|------------------|
| `src/utils/messagingRecipients.ts` | Pure: team(RoleGroup)→recipient resolution, dedup, unreachable-count, "Reaches N" | **New** |
| `src/utils/serviceLockDiff.ts` | Pure: diff two `ServiceSnapshot`s into typed `ChangeEntry[]` tagged with affected teams | **New** |
| `src/components/MessageComposer.vue` | Composer modal/drawer: teams-first recipients, message type, tokens, schedule | **New** |
| `src/views/ServiceEditorView.vue` | Hosts the ✉ Messages action-bar entry; hooks lock/re-lock notify prompts into `onMarkAsPlanned` | **Modified** |
| `src/stores/services.ts` | `buildServiceSnapshot` reused verbatim for lock snapshots; new `lockAndMaybeNotify()`/`setMessagingDefaults()` actions | **Modified** |
| `src/stores/messages.ts` (or folded into `services.ts`) | Subscribes to `messages`/`recipients` for the delivery-history panel | **New** |
| `src/types/organization.ts` | `OrgSettings.messaging` block + `DEFAULT_ORG_SETTINGS.messaging` | **Modified** |
| `functions/src/messaging/queueServiceMessage.ts` | Callable: validate + write queued `messages` doc | **New** |
| `functions/src/messaging/sendQueuedMessage.ts` | Trigger: authoritative recipient resolution, render, provider call, status rollup | **New** |
| `functions/src/messaging/sendScheduledReminders.ts` | Cron: scan due services, enqueue reminder messages | **New** |
| `functions/src/messaging/webhook.ts` | HTTP: provider bounce/delivery callback → recipient status | **New** |
| `functions/src/serviceRoles.ts` | Server-side port of `src/utils/serviceRoles.ts`'s pure resolver (see Recipient Resolution) | **New** |
| `firestore.rules` | New `messages`/`recipients`/`lockSnapshots` match blocks under `services/{docId}` | **Modified** |

## Data Model

All new collections live **nested under the service they belong to**
(`organizations/{orgId}/services/{serviceId}/...`), not as org-level siblings of
`services`. Two reasons, both drawn from precedent already in this codebase:

1. Every "Sent on this service" / "lock snapshot" concept is intrinsically
   scoped to one service, exactly like `slideGroups` (one doc per slot, but
   reachable "via the serviceId field," per `firestore.rules:130-186`) — except
   messaging's ownership is even tighter, so a true nested subcollection (not
   a field-pointer) is the right shape, matching `songs/{id}/lyrics/{id}`
   (`firestore.rules:192-199`), the only other **genuinely nested** (two
   segments under org) precedent in this rules file.
2. It keeps the **hot list-read path lean**. `ServicesView.vue` and the
   `services` store's `subscribe()` (`src/stores/services.ts:173-207`) load
   the *entire* `services` collection for the org on every session — the same
   reasoning that already kept `slideGroups`, `shareTokens`, and
   `serviceShareLinks` **out** of the `services` document applies doubly to a
   growing message history: it must never inflate every row of the services
   list.

### `organizations/{orgId}/services/{serviceId}/messages/{messageId}`

```
type            'oneoff' | 'reminder' | 'share-link' | 'lock-notification' | 'relock-notification'
status          'queued' | 'scheduled' | 'sending' | 'sent' | 'partial' | 'failed'
subject         string
body            string                    // with tokens NOT yet substituted per-recipient;
                                           // per-recipient substitution (e.g. "their roles")
                                           // happens in sendQueuedMessage, never stored per-recipient
recipientSelector {
  teams: RoleGroup[]                      // 'band' | 'tech' | 'vocals' | 'other' — reuses the
                                           // EXISTING RoleGroup enum (src/types/roster.ts), not a
                                           // new "Team" type. UI label remap only ("band"→"Worship",
                                           // "other"→"Hosts" — see Recipient Resolution).
  individualPersonIds: string[]
  includeEveryone: boolean
}
options         { attachServiceLink: bool, sendCopyToSelf: bool }
changeDiff      ChangeEntry[] | null      // present only for type='relock-notification'
scheduledFor    Timestamp | null          // null = send now
requestedByUid  string
createdAt       Timestamp
sentAt          Timestamp | null
deliveryCounts  { queued: n, sent: n, bounced: n, failed: n }   // rolled up by
                                                                  // sendQueuedMessage / webhook
```

**Why a `body` template rather than a fully-rendered string:** `resolveServiceRoleAssignments`
already personalizes "their roles" per person (`src/utils/serviceRoles.ts`), and that
personalization can only be correct **at send time** for a scheduled message (the
volunteer's assignment may change between compose and send — see Recipient
Resolution). Storing one template and rendering per-recipient inside
`sendQueuedMessage` keeps that correctness property; storing N fully-rendered
bodies up front would either go stale or require re-writing the doc at send
time anyway.

### `.../messages/{messageId}/recipients/{recipientId}`

```
personId        string | null   // null for a manually-typed individual recipient, if ever allowed
email           string
name            string
roleNames       string[]        // resolved AT SEND TIME, snapshotted for history
status          'queued' | 'sent' | 'bounced' | 'failed'
providerMessageId string | null
bounceReason    string | null
sentAt          Timestamp | null
bouncedAt       Timestamp | null
```

**Why a subcollection, not an array field on `messages/{messageId}`:** bounce
webhooks arrive concurrently, out of order, and asynchronously relative to the
send. A single array field would force read-modify-write races under
concurrent webhook delivery (the exact hazard `setRoleOverride`'s scoped
dot-path write already exists in this codebase to avoid —
`src/stores/services.ts:436-441`). One document per recipient, addressed
directly by the webhook (see Send Path), makes every bounce update an
independent, race-free write.

### `.../services/{serviceId}/lockSnapshots/current`

A single doc (not a growing history), overwritten on every successful lock/re-lock:

```
snapshot                ServiceSnapshot        // buildServiceSnapshot() output, REUSED VERBATIM
slideGroupsFingerprint  string                  // hash of ordered slide text per group — see
                                                 // Re-Lock Change Diff, SLIDES gap
lockedAt                Timestamp
lockedByUid             string
```

Reusing `buildServiceSnapshot` (`src/stores/services.ts:104-154`) — already
the canonical, PII-guarded (D-04/D-24: person **names**, never raw `Person`
objects with email/phone) serialization of a service for the public share
link — means the lock-diff snapshot needs **zero new serialization logic**.
It already resolves song BPM, orders slots section-major, and resolves role
assignments through the same `resolveServiceRoleAssignments` the messaging
recipient resolver also uses. One function, three consumers (share link,
lock snapshot, and indirectly the diff).

### Per-service automatic-email defaults

Live directly on the service document as a small nested object, **not** a
separate collection — it is always read together with the service and is
tiny, matching `roleAssignmentOverrides`' existing precedent for
scoped-dot-path service metadata:

```
organizations/{orgId}/services/{serviceId}.messaging = {
  lockNotifyEnabled: boolean | null,   // null = inherit org default
  reminderEnabled: boolean | null,     // null = inherit
  reminderDaysBefore: number | null,   // null = inherit
  reminderSentAt: Timestamp | null,    // idempotency guard, Admin-SDK-written only
}
```

Written via a new scoped action, e.g. `setServiceMessagingDefaults(serviceId,
patch)`, using the same `updateDoc(..., { 'messaging.lockNotifyEnabled':
value })` dot-path shape as `setRoleOverride`/`clearRoleOverride`
(`src/stores/services.ts:442-494`) — **not** routed through `updateService`,
so it is not blocked by the R036 draft-only guard the way ordinary content
edits are. Recommend keeping it draft-only anyway for v1.7 simplicity (no new
rules carve-out needed, matches every other service-metadata field's
lifecycle); flag as an open question if the requirements phase wants it
editable on a locked service too.

`reminderSentAt` is written only by `sendScheduledReminders` via the Admin
SDK, which — like `pptxRenders` and `requestPptxRenderHandler`
(`functions/src/index.ts:225-228`) — **bypasses `firestore.rules` entirely**,
so it is never subject to the R036 lock guard regardless of the service's
status. This matters: the reminder must still fire on a **locked** (`planned`)
service; only `draft` services are skipped, per the milestone's explicit
"skipped while still a draft" rule.

### Org-level messaging settings + kill switch

Extend `OrgSettings` (`src/types/organization.ts:52-114`) with one new nested
field, following the **exact** established pattern (`aiEnabled`/`pcEnabled`,
merged once in `auth.ts::loadOrgContext`, `src/stores/auth.ts:185-221`):

```typescript
interface OrgSettings {
  // ...existing fields unchanged...
  messaging: {
    enabled: boolean            // the GLOBAL kill switch
    lockNotifyDefault: boolean
    reminderEnabled: boolean
    reminderDaysBefore: number  // default 7
    fromName?: string
    replyTo?: string
  }
}
```

**Deliberate deviation from precedent:** `aiEnabled`/`pcEnabled` both default
`true` (`DEFAULT_ORG_SETTINGS`, `src/types/organization.ts:158-178`) because
those features work with zero extra configuration. Messaging's kill switch
should default **`enabled: false`** — a fresh org has no provider configured
and sending would either silently no-op or (worse) throw from a Function with
a missing secret. Default-off until the owner has actually set up the
provider and flips it on in Settings is the safer posture, and mirrors how
`PPTX_RENDER_SERVICE_URL`'s empty-string default fails closed
(`functions/src/index.ts:420-437`, `renderServiceUrl === ""` → status
`"failed"` before any invocation, never a silent no-op).

**Client choke point:** create `src/utils/messaging.ts` with an
`isMessagingEnabled()` gate reading `useAuthStore().settings.messaging.enabled`,
mirroring `claudeApi.ts`'s single-entry-point AI gate
(`src/utils/claudeApi.ts:39-70`) exactly. Every messaging UI surface (the ✉
button, the lock-notify prompt, the reminder scheduler UI) checks this one
function, not a scattered `authStore.settings.messaging.enabled` read at each
call site — same rationale PROJECT.md already records for the AI toggle
("all three AI surfaces already route through one module — the toggle has
exactly one place to live").

## Security-Rule Implications

`firestore.rules`' existing generic wildcard
(`match /{collection}/{docId} { ... }`, lines 261-267) grants org-editor
read/write to any **single-segment** nested collection directly under
`organizations/{orgId}/`, with three explicit exclusions (`services`,
`slideGroups`, `pptxRenders`). It does **not** reach two-segments-deep paths
like `services/{id}/messages/{id}` at all — those fall through to the
top-level default-deny (`match /{document=**} { allow read, write: if false }`)
unless given their **own** explicit block, exactly as `songs/{id}/lyrics/{id}`
already required its own block (`firestore.rules:192-199`, comment: "the
catch-all below only matches single-segment subcollections directly under the
org"). So **no exclusion clause is needed** for the new collections — only
new, explicit `allow` blocks:

```
match /services/{docId} {
  // ...existing block unchanged...

  match /messages/{messageId} {
    allow read: if isOrgMember(orgId);
    allow create: if isOrgEditor(orgId);          // queueServiceMessage's write path;
                                                     // Admin SDK sends (status/deliveryCounts
                                                     // updates) bypass this entirely.
    allow update, delete: if false;                 // status transitions are Admin-SDK-only —
                                                     // mirrors pptxRenders' read-only-for-members
                                                     // shape (functions/src/index.ts comment at
                                                     // firestore.rules:202-217).

    match /recipients/{recipientId} {
      allow read: if isOrgMember(orgId);            // for the delivery-history panel
      allow write: if false;                        // Admin SDK (sendQueuedMessage, webhook) only
    }
  }

  match /lockSnapshots/{snapshotId} {
    allow read: if isOrgMember(orgId);
    allow write: if isOrgEditor(orgId);             // client writes this at lock time
  }
}
```

This is a smaller, cleaner rules surface than `pptxRenders` needed, precisely
because messages/recipients are nested (automatically denied by default)
rather than single-segment org children (which needed an explicit
exclusion carved out of the generic wildcard to avoid an editor forging a
status flip — see `firestore.rules:236-246`). No such carve-out risk exists
here.

**The webhook Function is the one new genuinely public endpoint.** It cannot
require a Firebase ID token (the provider calling it isn't a signed-in app
user) — it must instead verify the provider's HMAC/signature header, exactly
as `api`'s `SECRET_INJECTED` gate (`functions/src/index.ts:136-144`) verifies
a Firebase ID token for a different reason (spend protection, not payload
authenticity). Treat an unverified or malformed signature as a hard reject
(`401`/`400`) **before** touching Firestore — a forged bounce event could
otherwise let an attacker mark arbitrary recipients as "bounced" and pollute
delivery history.

## Send Path

**Recommendation: a thin `onCall` callable that only enqueues, plus a
Firestore-triggered `onDocumentCreated` that does the actual send.** Not a
single do-everything callable, and not a client-writes-doc-with-no-callable
design either.

Why this specific split, not the alternatives:

- **Not** a single synchronous callable that resolves recipients, renders,
  and calls the provider inline (the way `esv`/`anthropic` proxy through
  `api` synchronously, `functions/src/index.ts:119-210`). That shape works
  for a single upstream call with a single caller waiting; a message send is
  a **batch** operation (N recipients, N potential partial failures) whose
  natural retry/observability boundary is a Firestore document, not a
  function invocation that either fully succeeds or the caller has no record
  of what happened. It also cannot be reused for scheduled sends without
  duplicating the entire body.
- **Not** a bare client `setDoc` with no callable in front of it at all —
  the write must be validated server-side first (kill-switch is actually on,
  caller is actually an org editor of *this* org, `scheduledFor` isn't
  absurdly far in the future) before it becomes something a trigger will act
  on, mirroring `parsePptxHandler`'s "independent org-membership re-check,
  never trust the client-declared orgId alone"
  (`functions/src/index.ts:292-301`).
- **The queue-then-trigger split is not new here** — it is the *exact* shape
  `parsePptxHandler` → `pptxRenders/{importId}` (status `"pending"`) →
  `requestPptxRender` (`onDocumentCreated`) already ships
  (`functions/src/index.ts:247-338, 340-518`). Reusing it means:
  - **One code path for every trigger type.** Immediate "send now," "schedule
    for later," the lock-notification, the re-lock notification, and the
    cron-driven reminder (see Scheduling) all terminate in the *same*
    `messages` doc shape and the *same* `sendQueuedMessage` trigger. Only one
    function in the whole feature ever calls the provider or holds its
    secret — the smallest possible surface for the owner to review on every
    gated deploy.
  - **Retries are natural.** A failed send leaves `status: 'failed'` on a
    real document that a future sweep (mirroring `cleanupOrphanRenders`'s
    shape, `functions/src/index.ts:628-780`) could retry, rather than a
    caller that simply got an error and gave up.

`sendQueuedMessage`'s body, mirroring `requestPptxRenderHandler`'s own
"exported separately from the trigger wrapper so it's directly unit-testable"
convention (`functions/src/index.ts:371-395`):

1. Load the `messages/{id}` doc + parent service doc (Admin SDK).
2. **Re-resolve recipients from scratch** — never trust `recipientSelector`'s
   *intent* as a final email list, only as instructions for who to resolve
   (teams/individuals/everyone). See Recipient Resolution.
3. Render `subject`/`body` tokens, personalizing "their roles" per recipient.
4. Call the provider's send API, capturing its per-recipient message id.
5. Write one `recipients/{id}` doc per recipient (`status: 'sent'` or
   `'failed'` if the provider rejected that address outright).
6. Roll up `deliveryCounts` and flip `messages/{id}.status`.

### Bounce webhook

A dedicated `onRequest` Function (not folded into the existing `api` proxy,
which is scoped to outbound proxying with Firebase-Auth-gated secret
injection — a fundamentally different trust boundary). At send time
(`sendQueuedMessage`), pass `{ orgId, serviceId, messageId, recipientId }` as
the provider's message metadata/tag field (every mainstream transactional
provider — Postmark, Resend, SendGrid, SES via SNS — supports an opaque
metadata/tag payload echoed back on webhook events). The webhook handler then:

1. Verifies the signature (reject fast, before any Firestore read).
2. Parses the event type (delivered / hard-bounced / soft-bounced — v1.7
   tracks sent + **hard** bounces only, per the locked decision; a soft
   bounce should be logged but not surface as a user-facing failure).
3. Reads `{ orgId, serviceId, messageId, recipientId }` straight out of the
   echoed metadata — **no `collectionGroup` query needed**, and no risk of a
   cross-org lookup, because the exact document path is already known.
4. Writes `recipients/{recipientId}.status` directly (idempotent — a
   duplicate webhook delivery for the same event is a same-value overwrite).
5. Increments `messages/{messageId}.deliveryCounts.bounced` via
   `FieldValue.increment()`, non-blocking to the `200 OK` response (providers
   retry on non-2xx; the ack must be fast and independent of the rollup
   write's success).

## Scheduling

**Recommendation: a daily `onSchedule` cron Function, not Cloud Tasks.**

This codebase already ships two daily `onSchedule` jobs —
`cleanupExpiredMedia` (`functions/src/index.ts:621-626`, `every day 02:00
UTC`) and `cleanupOrphanRenders` (`functions/src/index.ts:775-780`, `every
day 03:00 UTC`, deliberately offset by an hour so the two sweeps never
overlap) — and both establish the exact shape this feature needs: a broad
`collectionGroup` scan, fail-safe defaults, per-item try/catch so one failure
never aborts the run, and a handler exported separately from its `onSchedule`
wrapper for direct unit testing.

`sendScheduledReminders` follows the same shape, offset to its own time slot
(e.g. `04:00 UTC`):

1. `collectionGroup('services').where('status', 'in', ['planned', 'exported'])`
   — **never** `draft`, per the milestone's explicit skip rule — bounded to a
   reasonable lookahead window (e.g. next 30 days) checked in code, not in
   the query (Firestore can't filter "date minus a per-org/per-service N
   equals today" server-side, since N varies by org default and per-service
   override).
2. For each candidate, resolve `effectiveReminderDaysBefore` = service's
   `messaging.reminderDaysBefore` ?? org's `settings.messaging.reminderDaysBefore`
   ?? `7`, and check `service.date - effectiveN === today`.
3. Skip if `service.messaging.reminderSentAt` is already set (idempotency —
   same principle as `cleanupExpiredMediaHandler`'s "idempotent by age" note,
   `functions/src/index.ts:544-546`) or if the org's `messaging.enabled`
   kill-switch is off.
4. Create a `messages/{id}` doc (`type: 'reminder'`, teams = everyone
   assigned) using the **same** doc-creation logic `queueServiceMessage`
   uses (factor it into a shared `createQueuedMessage()` helper so there is
   exactly one place that shapes a `messages` doc) — `sendQueuedMessage`'s
   trigger fires identically regardless of whether a human or the cron job
   created the doc.
5. Set `reminderSentAt` on the service doc.

**Why not Cloud Tasks:** Cloud Tasks earns its complexity when timing needs
sub-day precision (e.g., a specific hour in each recipient's own timezone) or
when the fan-out is large enough that a single daily scan becomes a
performance or cost problem. Neither applies: the spec asks for day-granularity
("N days before, default 7"), and this app's scale (2-3 active planners per
church, a handful of churches) means a full `collectionGroup` scan across all
orgs' services is trivially cheap — the same argument that already justified
`cleanupOrphanRenders` scanning *every* org's `pptxRenders` in one daily pass.
Introducing Cloud Tasks would mean provisioning a queue, granting new IAM,
and reasoning about a second scheduling primitive for a feature this
project's own precedent already solves with `onSchedule` twice over.

## Recipient Resolution

**Team → RoleGroup mapping.** The composer's "teams first" concept
(Worship / Tech / Vocals / Hosts) is a UI label remap of the **existing**
`RoleGroup` enum (`'band' | 'tech' | 'vocals' | 'other'`,
`src/types/roster.ts:3`) — not a new domain concept. `RolesConfigPanel.vue`
already has a `groupLabels` map (`band: 'Band', tech: 'Tech', vocals:
'Vocals', other: 'Other'`, line 119) for a different surface; the messaging
composer needs its **own** label map (`band → 'Worship'`, `other → 'Hosts'`,
`tech`/`vocals` unchanged) since the copy differs by context — introduce a
`MESSAGING_TEAM_LABELS` constant rather than repurposing `groupLabels`
in place (two different UIs are allowed to describe the same enum
differently; conflating them would make one composer's copy change silently
ripple into the Roles config screen).

**Building the recipient list — reuse, don't reinvent.**
`resolveServiceRoleAssignments` (`src/utils/serviceRoles.ts:33-56`) already
computes, for every role on a service, the `effectivePersonIds` (override ??
quarter-scheduled ?? `[]`) — this is *already* how `buildServiceSnapshot`
builds the public share link's role-assignment list
(`src/stores/services.ts:135-141`). The new
`src/utils/messagingRecipients.ts` wraps it:

```typescript
function resolveRecipients(
  service: Service,
  quarters: Quarter[],
  roles: Role[],
  people: Person[],
  selection: { teams: RoleGroup[]; individualPersonIds: string[]; includeEveryone: boolean },
): { reachable: RecipientCandidate[]; unreachableCount: number }
```

For each `ResolvedRoleAssignment` matching the selection (by `group` or by
`includeEveryone`), map `effectivePersonIds` through the roster `people` list
to `{ id, name, email }`, dedupe by person id (a person holding two matching
roles counts once), and split into `reachable` (non-empty `email`) vs
`unreachableCount` (assigned but `person.email === ''` — the roster schema
already permits an empty email string, `src/types/roster.ts:16`). **Surface
`unreachableCount` in the composer** ("3 people can't be reached — no email
on file") rather than silently dropping them; an unfilled role
(`effectivePersonIds = []`) is a different, expected case (0 recipients, no
warning).

**Client (live "Reaches N") vs server (authoritative) — split by design, not
an oversight.** The composer's live count runs `resolveRecipients` entirely
client-side, against whatever the browser currently has loaded in
`rosterStore`/`quartersStore` — instant, no round trip, matches
`buildServiceSnapshot`'s already-established pattern of doing this exact kind
of resolve-and-lookup purely in the browser. But `sendQueuedMessage` (the
Function) **must independently re-resolve from scratch** using the Admin SDK,
never trusting the client's `recipientSelector` as anything more than
*intent* — this is the same "never trust the client-declared value alone,
independently re-verify" discipline this codebase already applies twice
(`parsePptxHandler`'s org-membership re-check,
`functions/src/index.ts:292-301`; `requestPptxRenderHandler`'s independent
Storage recount rather than trusting the render service's self-report,
`functions/src/index.ts:457-489`). This is not merely defense-in-depth: for a
**scheduled** send (a 7-day-out reminder), the roster may genuinely have
changed between compose time and send time — re-resolving at send time is a
correctness *feature* (the volunteer swapped in on day 5 gets the reminder,
not the one who was originally assigned), not a race to guard against.

**Client/server duplication risk — flag, don't solve here.**
`src/utils/serviceRoles.ts` is *already* pure (its own header comment:
"No Firestore/Pinia/store imports (types only)... testable without any
app/store setup," lines 1-4), so porting `resolveServiceRoleAssignments` +
`findQuarterForDate` into `functions/src/serviceRoles.ts` is a straight copy
with zero client-SDK rewiring. But it **is** a copy, in a monorepo with no
shared package between `src/` and `functions/` today (verified: `functions/`
has its own `package.json`, `tsconfig`, and dependency set, entirely separate
from the root Vite/Vitest project) — the two files can drift. Treat "keep
`src/utils/serviceRoles.ts` and `functions/src/serviceRoles.ts` in lockstep"
as a standing maintenance note for whichever phase ports it (a shared
workspace package is the durable fix, but is very likely overkill for v1.7's
first cut and is a reasonable thing to defer).

## Re-Lock Change Diff

**Snapshot at lock time:** call `buildServiceSnapshot(service)`
(`src/stores/services.ts:104-154`) — already the canonical serialization used
for share links — and write it to `lockSnapshots/current` (see Data Model)
the moment `markAsPlanned()` succeeds. Zero new serialization logic.

**Detecting a re-lock vs a first lock:** simply check whether
`lockSnapshots/current` already exists for this service *before* the
transition. A first lock has no prior snapshot (no diff, no prompt — the
"locking" notification is the only relevant one). A re-lock (a service that
was `planned`, `reopenService()`'d back to `draft`, edited, and now
`markAsPlanned()`'d again) always has one.

**Computing the diff:** a new pure function,
`diffServiceSnapshots(previous, current): ChangeEntry[]` in
`src/utils/serviceLockDiff.ts` (same "pure function in `utils/`" convention
`serviceRoles.ts`'s own header comment names explicitly), comparing two
`ServiceSnapshot` objects field by field:

| Diff type | Detection | Default `affectedTeams` |
|-----------|-----------|--------------------------|
| SONG | A slot's `songId`/`songTitle` changed, matched by stable slot id | RoleGroups with a non-empty role on the service (broad default — a song change is generally everyone's business) |
| ORDER | A slot's stable id moved position in the section-ordered array without its content changing | Same broad default |
| ROLE | A `roleAssignments[i].personNames` changed for a given `roleId` | **Exactly** that role's `RoleGroup` — the one precise, narrow tag |
| NOTES | `notes` field changed | Broad default |
| SLIDES | See gap below | Broad default |

**SLIDES is a real gap, not an oversight — flagging for requirements/roadmap.**
`ServiceSnapshot` does not carry slide content today (slides live in the
separate `slideGroups` subcollection, deliberately kept out of the snapshot
to avoid duplicating that data — the same reasoning that keeps `slideGroups`
out of the `services` document itself). Two ways to close this, neither
free:

1. Extend `buildServiceSnapshot`/`ServiceSnapshot` to also embed a
   lightweight per-group fingerprint (e.g., a hash of each group's ordered
   slide text) — cheap to diff, but is new surface on a function every
   share-link write already calls, so it must stay genuinely lightweight.
2. Compute the fingerprint as a **separate** step alongside (not inside)
   `buildServiceSnapshot`, stored only in `lockSnapshots/current`
   (`slideGroupsFingerprint`, per the Data Model section) — keeps the
   share-link path untouched.

Recommend (2): it isolates the new cost to the lock/re-lock path only, which
already pays for a full snapshot read/write, rather than adding weight to
every autosave-triggered share-link refresh
(`maybeRefreshShareLink`, `src/stores/services.ts:682-743`, which calls
`writeSharePayload`→`buildServiceSnapshot` on *every* edit to a shared
service).

**Selecting and sending:** the checkable diff UI feeds directly into the same
`MessageComposer`/`queueServiceMessage` path as any other message
(`type: 'relock-notification'`, `changeDiff` stored on the doc as an audit
trail of exactly what was communicated), pre-selecting recipients as the
union of `affectedTeams` across checked entries, with an explicit
"notify everyone" override and "Lock quietly" (no message at all) always
available, per the locked requirement.

**On confirm (send or "Lock quietly"), overwrite `lockSnapshots/current`**
with the new snapshot — the *next* re-lock diffs against this state, not the
original lock.

## Build Order

Respecting the stated dependency chain (roster/roles → recipients → send
path → automatic/lock triggers → scheduling → history/bounces). Roster/roles
already exist and need **no changes** — every phase below only reads them.

### Phase A — Data model & recipient resolution (foundation, no sending)

- `OrgSettings.messaging` + `DEFAULT_ORG_SETTINGS.messaging` (kill switch OFF
  by default), merged in `loadOrgContext` per the R073 pattern.
- `src/utils/messagingRecipients.ts` (pure, client-only) — unit-testable
  immediately, no Functions involved.
- `firestore.rules`: add the `messages`/`recipients`/`lockSnapshots` blocks
  (Security-Rule Implications section) even before any UI writes to them —
  this codebase has a demonstrated rules-first discipline (Phase 31, Phase
  40) and a locked-down-by-default nested collection costs nothing to add
  early.

### Phase B — Composer UI (client-only; send path is a stub)

- New `MessageComposer.vue`, wired into `ServiceEditorView.vue`'s action bar
  (`buildActionBarItems`).
- Live "Reaches N" / unreachable-count from Phase A's resolver.
- `queueServiceMessage` callable exists but is intentionally minimal (auth +
  kill-switch + write the `messages` doc) — unblocks composer UI development
  and rules testing in parallel with Phase C.

### Phase C — Send path (provider integration; OWNER-GATED deploy)

- Provider account + secret setup (owner step, per the standing
  `.env.local`/deploy-gate rule).
- `sendQueuedMessage` trigger: port `resolveServiceRoleAssignments` server-
  side, render tokens, call the provider, write `recipients/{id}` docs, roll
  up `messages/{id}.status`.
- `messageWebhook` HTTP function + provider-side webhook URL configuration
  (also an owner step — requires the deployed Function URL).
- Delivery-history panel on the service, reading `messages`+`recipients`.

*Phases B and C can be built in parallel once Phase A's rules and resolver
land — B only needs the doc shape, not a working send.*

### Phase D — Lock / re-lock triggers (depends on A + C)

- `lockSnapshots/current` write hooked into the existing `markAsPlanned()`
  flow (`onMarkAsPlanned`, `ServiceEditorView.vue:2604-2670`).
- Lock-notification prompt (first lock, no diff) using the org/service
  messaging defaults.
- `src/utils/serviceLockDiff.ts` + re-lock checkable diff UI, triggered when
  `lockSnapshots/current` already exists.
- Per-service automatic-email defaults toggle (Settings-inherited) — natural
  to ship alongside the triggers that actually consume it.

### Phase E — Scheduled reminder (depends on C; independent of D)

- `sendScheduledReminders` daily cron, mirroring
  `cleanupExpiredMedia`/`cleanupOrphanRenders` exactly.
- Org kill-switch + reminder-days-before UI in Settings (may already exist
  from Phase A/D's settings surface work — just needs the reminder-specific
  fields wired to something).

**Total new Functions: 4** (`queueServiceMessage`, `sendQueuedMessage`,
`sendScheduledReminders`, `messageWebhook`) — comparable in count to the
Phase 37/40 PPTX-render and org-claims work this codebase has already
shipped through the same `onCall`/`onDocumentCreated`/`onSchedule` triad,
plus one new `onRequest` (the webhook) alongside the existing `api` proxy.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Trusting the client's recipient list at send time

**What people do:** have the composer resolve the recipient list and send
it, along with the compose action, straight to the send Function.
**Why it's wrong:** the client's `rosterStore`/`quartersStore` state can be
stale (someone else edited the roster since the composer opened), and for a
scheduled send it is *guaranteed* to be stale (days elapse). It also opens a
trivial spoofing vector — a compromised client could ask to email anyone.
**Instead:** the client's list is a live *estimate* only; `sendQueuedMessage`
always re-resolves from Firestore via the Admin SDK before sending.

### Anti-Pattern 2: One do-everything callable for send

**What people do:** put recipient resolution, rendering, and the provider
call all inside a single synchronous `onCall`, reused (via extra parameters)
for scheduled sends too.
**Why it's wrong:** couples the UI's request/response cycle to the full
batch-send latency, gives the cron job nothing to call (it has no client
waiting for a response), and means every future retry/observability need
gets bolted onto a function signature instead of living on a document.
**Instead:** enqueue (callable or cron, both write the same doc shape) →
one trigger performs the actual send. This is the same shape
`parsePptxHandler`→`pptxRenders`→`requestPptxRender` already proves out in
this codebase.

### Anti-Pattern 3: Embedding message history on the `services` document

**What people do:** append sent-message summaries directly onto the service
doc's own fields, since it's "just a few more fields."
**Why it's wrong:** the `services` collection is read in full on every
session (`services.ts:subscribe()`) and on the `ServicesView.vue` list — an
unbounded, ever-growing message history there inflates every list load for
every service, forever.
**Instead:** a nested `messages` subcollection, read only when the delivery
history panel or the composer for *that specific service* is open.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `MessageComposer.vue` ↔ `rosterStore`/`quartersStore` | Direct Pinia read (existing stores, unmodified) | Read-only; messaging never writes roster/quarter data |
| `MessageComposer.vue` ↔ `messagingRecipients.ts` | Pure function call, no store | Testable without any Firestore mocking |
| `ServiceEditorView.vue::onMarkAsPlanned` ↔ `services.ts::buildServiceSnapshot` | Direct import, reused verbatim | Zero new serialization logic for lock snapshots |
| Client ↔ `queueServiceMessage` | `httpsCallable`, mirrors existing `parsePptx` callable usage | Auth token forwarded automatically by the SDK |
| `sendQueuedMessage` ↔ `functions/src/serviceRoles.ts` | Direct import (ported copy of the client's pure resolver) | Must be kept in lockstep with `src/utils/serviceRoles.ts` — no shared package today |
| Provider webhook ↔ `messageWebhook` | HTTPS POST, HMAC-signature-verified | No Firebase Auth possible; signature verification is the entire trust boundary |
| `messageWebhook` ↔ Firestore | Admin SDK, direct doc path from echoed metadata | No `collectionGroup` query needed — path is known from send-time metadata |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Email provider (chosen by STACK research) | Server-held API key via Cloud Functions secret (`defineSecret`, mirroring `CLAUDE_API_KEY`/`ESV_API_KEY`), called only from `sendQueuedMessage` | Never shipped to the client bundle — same rule this project already enforces for every other third-party secret (`functions/src/index.ts:13-20`) |
| Provider bounce webhook | Inbound `onRequest`, HMAC-verified | New unauthenticated (by Firebase Auth) surface — the one genuinely new trust boundary this feature introduces |

## Open Questions for Requirements/Roadmap

- **SLIDES diff fingerprint exact shape** — a hash of ordered slide text per
  group is proposed above; the requirements phase should confirm whether a
  coarser "slides changed: yes/no" is sufficient for v1.7 or whether
  per-slide-group granularity in the diff list is expected.
- **`affectedTeams` inference for SONG/ORDER/NOTES/SLIDES entries** — this
  file proposes a broad "every team with an assigned role" default (only
  ROLE entries get a precise single-team tag); confirm this matches the
  product's mental model before implementation, since a narrower mapping
  (e.g. SONG → vocals+band only) is equally defensible and changes the
  default recipient selection materially.
- **Per-service messaging defaults on a locked service** — this file
  recommends draft-only editing for `services/{id}.messaging` (no new rules
  carve-out needed); confirm whether toggling automatic-email defaults on an
  already-locked service is actually needed for v1.7.
- **Email provider choice itself** — deliberately out of scope for this file
  (STACK research's job); the send-path and webhook design above are written
  to be provider-agnostic (any provider with an HTTP send API and a
  metadata-echoing webhook fits this shape — Postmark, Resend, and SendGrid
  all qualify; a provider without webhook metadata echoing would force the
  less-clean `collectionGroup` bounce-lookup fallback).

## Sources

- `src/stores/services.ts` — `buildServiceSnapshot`, `markAsPlanned`,
  `reopenService`, `setRoleOverride`/`clearRoleOverride`, `ensureShareLink`,
  `maybeRefreshShareLink`, `assertWritable`/`ServiceLockedError` (R036 guard)
- `src/stores/roster.ts`, `src/types/roster.ts` — `Person`, `Role`,
  `RoleGroup`, `DEFAULT_ROLES`
- `src/stores/auth.ts` — `loadOrgContext`, `OrgSettings` merge pattern
- `src/types/organization.ts` — `OrgSettings`, `DEFAULT_ORG_SETTINGS`
- `src/utils/serviceRoles.ts` — `resolveServiceRoleAssignments`,
  `findQuarterForDate` (pure resolver, the recipient-resolution foundation)
- `src/utils/claudeApi.ts` — single-choke-point feature-gate precedent
- `src/components/RolesConfigPanel.vue` — `groupLabels` (team display-label
  precedent)
- `src/views/ServiceEditorView.vue` — `onMarkAsPlanned`, `onReopenRequest`/
  `runReopen`, `buildActionBarItems`, tab-bar structure
- `functions/src/index.ts` — `parsePptxHandler`/`parsePptx` (callable
  precedent), `requestPptxRenderHandler`/`requestPptxRender` (trigger
  precedent), `cleanupExpiredMedia`/`cleanupOrphanRenders` (cron precedent),
  `api` (onRequest proxy, secret-injection precedent)
- `firestore.rules` — `isOrgMember`/`isOrgEditor`, `services/{docId}` block
  (R036's server-side mirror), `slideGroups`/`songs/lyrics`/`pptxRenders`
  nested-vs-wildcard precedent
- `.planning/PROJECT.md` — v1.7 milestone scope, locked decisions
  (recipients-from-roles, sent+hard-bounce-only, backend send path, owner-
  gated deploy)

---
*Architecture research for: WorshipPlanner v1.7 Volunteer Messaging & Notifications*
*Researched: 2026-08-13*
