# Phase 61: Automatic Notifications — Lock & Scheduled Reminder - Research

**Researched:** 2026-08-14
**Domain:** Two automatic email triggers riding the Phase 59 send path — a client-side first-lock enqueue and a daily `onSchedule` Cloud Functions cron (`sendScheduledReminders`), both deploy-gated; no new npm package
**Confidence:** HIGH — every claim is anchored to a live `file:line` in this repo or the shipped Phase 58/59/60 code. The one genuinely new mechanism (dispatching Phase 59's `status:'scheduled'` messages) is resolved below with a concrete, precedent-backed recommendation. No external package is installed this phase.

## Summary

Phase 61 adds **zero new send machinery** — it wires two automatic triggers into the already-shipped queue-then-trigger path (`createQueuedMessage` → `sendQueuedMessage`, `functions/src/index.ts:921/1180`). (1) A **client-side first-lock enqueue**: `onMarkAsPlanned` (`src/views/ServiceEditorView.vue:2757`) already flips draft→planned via `serviceStore.markAsPlanned` (`src/stores/services.ts:346`); after that lands, on the **draft→locked transition and only the first time**, the client writes `lockSnapshots/current` (for Phase 62 to diff later) and — behind the `isMessagingEnabled()` + effective-`lockNotifyEnabled` gates — enqueues a `type:'lock-notification'` message via the same `queueServiceMessage` callable the composer uses (`src/components/MessageComposer.vue:574`). (2) A new **`sendScheduledReminders` daily `onSchedule` cron** that mirrors `cleanupOrphanRenders` (`functions/src/index.ts:729-817`) exactly: a broad `collectionGroup('services').where('status','in',['planned','exported'])` scan, per-item try/catch, handler exported separately for unit test, offset to its own UTC slot; for each due service (org-timezone date math, R133) it enqueues a `type:'reminder'` message via `createQueuedMessage` and sets the Admin-SDK-only `messaging.reminderSentAt` idempotency marker.

The **key design problem** — how the cron actually *sends* a Phase 59 `status:'scheduled'` message, given `sendQueuedMessage` is `onDocumentCreated` and a status flip on an existing doc will **not** re-fire it — is resolved: **the cron CREATES a fresh `status:'queued'` doc from the scheduled one via the shared `createQueuedMessage()` helper and marks the original terminal (`'dispatched'`), guarded by a transactional `scheduled→dispatched` claim so a retried run never duplicates.** Widening the trigger to `onDocumentWritten` is rejected — it would re-fire on the handler's own `sending`/`sent`/`deliveryCounts` writes (re-entrancy) for no benefit. Because this touches a *different* collection group with its *own* idempotency and (optionally) index, it is recommended as **its own plan/wave** within Phase 61.

**Primary recommendation:** Mirror `cleanupOrphanRendersHandler` for the reminder cron (same `collectionGroup(...).where('status','in',[...])` shape — which ships today with **no** `firestore.indexes.json` entry, so the reminder scan needs **no new index**); compute org-local "today" with `Intl.DateTimeFormat('en-CA',{timeZone})` (**no package**, Node 22 ships full ICU); gate the lock enqueue on first-lock detection by reading `lockSnapshots/current` **before** writing it; add `'lock-notification'` to `MessageType`/`MESSAGE_TYPES` (`functions/src/index.ts:832-834`) — the send trigger renders/sends for any type unchanged; and **defer `slideGroupsFingerprint` to Phase 62** (write `null` now — `buildServiceSnapshot` contains no slide text and Phase 61 has no consumer).

<user_constraints>
## User Constraints (from 61-CONTEXT.md)

### Locked Decisions
- **Add `'lock-notification'` to `MessageType` + `MESSAGE_TYPES`** (`functions/src/index.ts:832-834`) so `queueServiceMessage` accepts the lock email. `sendQueuedMessage` renders/sends for any type — no trigger change. (Phase 62 later adds `'relock-notification'`.)
- **Lock notification (R144) — client-triggered on FIRST lock only.** Hook `onMarkAsPlanned` (`ServiceEditorView.vue:2757` → `markAsPlanned` `services.ts:346`). After the lock succeeds, on the draft→locked transition only: (1) write `services/{id}/lockSnapshots/current = { snapshot: buildServiceSnapshot(service), slideGroupsFingerprint, lockedAt, lockedByUid }` (client write, Phase 58 rule `lockSnapshots` write = `isOrgEditor`) — **every lock**, for Phase 62's diff; (2) **IF** `isMessagingEnabled()` **AND** effective `service.messaging.lockNotifyEnabled ?? org.settings.messaging.lockNotifyDefault` resolves ON **AND** this is the FIRST lock (no prior `lockSnapshots/current`) — enqueue a `messages` doc via the `queueServiceMessage` callable: `type:'lock-notification'`, `recipientSelector = { teams:[], individualPersonIds:[], includeEveryone:true }`, `options:{ attachServiceLink:true, sendCopyToSelf:false }`, subject/body from a lock template using `{{their_roles}}`, `{{song_list}}`, `{{service_link}}`. Server re-resolves recipients + renders per-recipient (R139).
- **Never sends while draft or while messaging is off (SC2)** — only fires on the draft→locked transition, behind the gates; server `queueServiceMessage` re-checks the kill-switch (defense in depth, `functions/src/index.ts:1024-1033`).
- **First-lock only** — a re-lock (a `lockSnapshots/current` already exists) does NOT auto-send here; that is Phase 62's prompt-with-diff. First lock is **automatic**, not a prompt (matches R144 + SC1).
- **`sendScheduledReminders` — a NEW daily `onSchedule` Function** mirroring `cleanupExpiredMedia`/`cleanupOrphanRenders` EXACTLY (broad `collectionGroup` scan, per-item try/catch, handler exported for test, own UTC slot e.g. `04:00`). Built against the mocked provider; ships built/tested/UNDEPLOYED. Handler: (1) `collectionGroup('services').where('status','in',['planned','exported'])` — never `draft`, ~30-day lookahead in CODE not the query; (2) `effectiveReminderEnabled`/`effectiveN` resolved service-then-org, default 7; skip if org kill-switch off or effective reminder off; (3) timezone (R133) via `Intl.DateTimeFormat({ timeZone })` — no package — fire when `service.date - effectiveN === today` in the org tz; **sub-day time-of-day precision out of scope** (day granularity); (4) idempotency (SC4) — skip if `messaging.reminderSentAt` set; after enqueuing set it (Admin SDK); (5) enqueue via shared `createQueuedMessage()` (`type:'reminder'`, everyone assigned, `attachServiceLink:true`).
- **Also dispatch due user-scheduled messages (the Phase 59 deferral)** in the same daily run (or a small sibling sweep): find `collectionGroup('messages')` where `status=='scheduled'` and due. Because `sendQueuedMessage` is `onDocumentCreated`, a status flip on the existing doc will NOT re-fire it — the cron must CREATE a fresh queued doc via `createQueuedMessage` and mark the original dispatched, or the trigger must be widened. **Resolved in this research.** May be split to its own plan if it materially complicates the phase.
- **Firestore indexes** — the `collectionGroup('services')` status query and any scheduled-message `collectionGroup('messages')` query may need collection-group indexes in `firestore.indexes.json` (Phase 60 pattern). Ship deploy-gated. Exact shapes confirmed in this research.
- **UI (light)** — Settings kill-switch + defaults + per-service overrides ALREADY shipped in Phase 58. Net-new UI is a small lock-time confirmation toast; the ui-phase decides the exact affordance. Keep light.

### Claude's Discretion
- Lock-email subject/body template copy, the exact toast/feedback affordance, the cron's UTC hour slot, the lookahead-window size, and the scheduled-message-dispatch mechanism (new-doc vs trigger-widening) — all at implementer discretion, guided by ARCHITECTURE, the send path, and conventions.

### Deferred Ideas (OUT OF SCOPE)
- Re-lock scoped change diff + checkable prompt + `'relock-notification'` type → Phase 62. (Phase 61 writes `lockSnapshots/current` on lock so Phase 62 has a prior snapshot; it does NOT compute or prompt a diff.)
- Sub-day (specific local hour) reminder precision — out of scope (day granularity; Cloud Tasks rejected in ARCHITECTURE).
- Real deploy of `sendScheduledReminders` + its indexes + secrets → OWNER (built/tested/UNDEPLOYED here). No new provider secret this phase (`sendQueuedMessage` already holds `RESEND_API_KEY`; the cron only enqueues).
- Soft-bounce/opens (Phase 60), any new composer UI (Phase 59).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R144 | Locking a service for the first time can automatically email everyone assigned (their roles, song list, service-order link), governed by the per-service/Settings lock-notify default. | Client hook in `onMarkAsPlanned` (`ServiceEditorView.vue:2757`); `'lock-notification'` added to `MessageType` (`functions/src/index.ts:832`); enqueue via the shipped `queueServiceMessage` callable (`MessageComposer.vue:574` pattern); `includeEveryone:true`; first-lock detected by reading `lockSnapshots/current` before writing; gates `isMessagingEnabled()` (`src/utils/messaging.ts:19`) + effective `lockNotifyEnabled ?? lockNotifyDefault` (`src/types/organization.ts:130`, default false). Tokens rendered server-side per-recipient (R139, `functions/src/index.ts:1300-1302`). |
| R145 | Auto-send the shared service link to everyone assigned N days before the service (default 7, configurable), reckoned in the org's local timezone (R133). | New `sendScheduledReminders` `onSchedule` cron mirroring `cleanupOrphanRendersHandler` (`functions/src/index.ts:729-817`); `collectionGroup('services').where('status','in',['planned','exported'])`; org-tz date math via `Intl.DateTimeFormat` (no package); `effectiveN = service.messaging.reminderDaysBefore ?? org.settings.messaging.reminderDaysBefore ?? 7` (`src/types/organization.ts:138/223`); enqueue `type:'reminder'` via `createQueuedMessage` (`functions/src/index.ts:921`); idempotency via `messaging.reminderSentAt` (`src/types/service.ts:186`, Admin-SDK-only). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| First-lock detection + `lockSnapshots/current` write | Browser / Client (`ServiceEditorView.vue`/`services.ts`) | Database (Phase 58 `lockSnapshots` rule, editor-write) | The lock is a client lifecycle action; the snapshot is a client-computable `buildServiceSnapshot` (`services.ts:104`, Pinia-bound). First-lock = "no prior snapshot," a client read. |
| Lock-notification enqueue | Browser / Client (calls `queueServiceMessage`) | API / Backend (server re-checks editor + kill-switch, then the trigger sends) | The client declares *intent* only; `queueServiceMessage` (`functions/src/index.ts:961`) re-authorizes and enqueues; `sendQueuedMessage` re-resolves recipients + sends (never the client's list). |
| Daily reminder scan + org-tz "is it due today" | API / Backend (`sendScheduledReminders` `onSchedule`) | Database (`collectionGroup('services')` scan) | A time-driven server job; no client can be trusted to run it. Mirrors the two shipped `onSchedule` sweeps. |
| Reminder idempotency (`reminderSentAt`) | API / Backend (Admin SDK) | Database (`services/{id}.messaging.reminderSentAt`) | Admin-SDK-only marker (Phase 58 rules deny client writes to `reminderSentAt`; it must be set on a *locked* service, bypassing the R036 draft guard). |
| Enqueue (reminder + scheduled-dispatch) | API / Backend (`createQueuedMessage`) | Database (`messages/{id}`) | Reuse the one canonical doc-shaper so a cron-created message is indistinguishable from a human one at the `onDocumentCreated` trigger. |
| Actual send (both triggers) | API / Backend (`sendQueuedMessage`, holds `RESEND_API_KEY`) | — | Unchanged from Phase 59. The only Function that sends. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-functions` | `^7.2.5` (already installed) | `onSchedule` (already imported, `functions/src/index.ts:2`), `onCall`/`onDocumentCreated` reused | Already the runtime; `onSchedule` ships two live crons. No change. |
| `firebase-admin` | `^13.10.0` (already installed) | Admin-SDK `collectionGroup` scan, `runTransaction` claim, `reminderSentAt` write | Already installed; bypasses rules by design (the cron writes Admin-SDK-only fields). |
| `Intl.DateTimeFormat` (Node built-in) | Node 22 runtime | Org-local "today" (Y-M-D) in an arbitrary IANA timezone for R133 | **Zero new dependency.** Node 22 ships full ICU, so any IANA `timeZone` resolves. Precedent: `formatServiceDate` (`functions/src/index.ts:1120-1130`) already uses `toLocaleDateString` with a `timeZone`. |
| `firebase/functions` (client) | already installed | `httpsCallable(functions,'queueServiceMessage')` for the lock enqueue | Exact reuse of `MessageComposer.vue:574`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^4.1.10` (functions), root `4.0.x` (app) | Handler-body + component unit tests | Both suites already exist; extend `functions/src/index.test.ts` and add a client spec. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fresh-queued-doc dispatch of scheduled messages | Widen `sendQueuedMessage` to `onDocumentWritten`/`onDocumentUpdated` | **Rejected.** `onDocumentWritten` re-fires on the handler's OWN `sending`/`sent`/`deliveryCounts` writes (re-entrancy — the transaction claim would absorb it but every status write triggers a needless invocation), and it complicates the clean `onDocumentCreated` semantics. Creating a new `status:'queued'` doc via the existing `createQueuedMessage` keeps the trigger untouched and idempotent. |
| `Intl.DateTimeFormat('en-CA', { timeZone })` | A date library (`luxon`/`date-fns-tz`) | No package needed — `en-CA` yields `YYYY-MM-DD` directly and Node 22 has full ICU. Adding a tz library is a supply-chain install gate for a one-liner. |
| `onSchedule` daily cron | Cloud Tasks (per-service scheduled task) | ARCHITECTURE §Scheduling explicitly rejects Cloud Tasks — day granularity + tiny scale make a daily `collectionGroup` scan trivially cheap; Cloud Tasks would add a queue + IAM + a second scheduling primitive. Locked. |

**Installation:** **None.** This phase adds **no new npm dependency**.

**Version verification:** N/A — no package installed. `onSchedule` and `Intl` are already available (`functions/src/index.ts:2`; Node 22 runtime, `functions/package.json`).

## Package Legitimacy Audit

> **No external package is installed this phase.** The reminder cron reuses `onSchedule` (already imported) and `Intl` (Node built-in); the lock enqueue reuses the shipped `queueServiceMessage` callable and `firebase/functions` (already installed). No `npm install` runs.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | **No install this phase** |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious (SUS):** none — nothing is installed. No `checkpoint:human-verify` for a package gate is required this phase.

## The Key Design Problem — Dispatching User-Scheduled Messages (RESOLVED)

**The trap (confirmed in code):** Phase 59's composer "schedule-for-later" writes a `messages/{id}` doc with `status:'scheduled'` (`createQueuedMessage`, `functions/src/index.ts:925`). `sendQueuedMessage` is `onDocumentCreated` (`functions/src/index.ts:1372-1384`) and its very first act is a transaction that flips `queued→sending` **only if `status === 'queued'`** (`:1197-1207`) — a `'scheduled'` doc is left inert by design (`:1201` comment: "leaves a 'scheduled' doc inert for Phase 61's cron"). **Flipping an existing `'scheduled'` doc to `'queued'` will NOT re-fire `onDocumentCreated`** — that trigger fires on document creation only. So an in-place status flip sends nothing.

**Recommendation (option a — create a fresh queued doc):**

1. Sweep `collectionGroup('messages').where('status','==','scheduled')` (Admin SDK). Filter "due" (`scheduledFor <= now`) in **code**, not the query (mirrors the reminder cron's "filter N in code" and keeps the query single-field — see Indexes below).
2. For each due scheduled doc, run a **transactional `scheduled→dispatched` claim** on the original (mirrors `sendQueuedMessage`'s `queued→sending` claim, `functions/src/index.ts:1197-1204`): read `status`; only if still `'scheduled'` set it to a terminal `'dispatched'` (optionally record `dispatchedAt`/`dispatchedMessageId`). A retried cron run finds `'dispatched'` and no-ops → **never a duplicate send.**
3. Only if the claim succeeded, CREATE a **new** `messages/{id}` doc in the same service via `createQueuedMessage({ ...copied fields..., scheduledFor: null, requestedByUid: original.requestedByUid })`. `scheduledFor:null` yields `status:'queued'` (`:922-925`) → `onDocumentCreated` fires → `sendQueuedMessage` sends exactly as for a human send. All needed fields (`type`, `subject`, `body`, `recipientSelector`, `options`, `requestedByUid`) are present on the original doc.

**Why the fresh doc, not a trigger widen:** the fresh-doc path (a) keeps `sendQueuedMessage` and its `onDocumentCreated` contract completely unchanged, (b) reuses the *exact* canonical shaper (`createQueuedMessage`) so a cron send is byte-identical to a human send at the trigger, and (c) preserves `requestedByUid` so `options.sendCopyToSelf` still resolves the original editor's address (`resolveEditorEmail`, `functions/src/index.ts:1170`). The claim-first ordering makes it idempotent under `onSchedule`'s at-least-once semantics.

**Recommend it be its own plan/wave within Phase 61.** It is a distinct concern from the reminder trigger (different collection group, its own `scheduled→dispatched` idempotency, its own optional index) and has an independent test surface. Keeping it a sibling handler/sweep inside the same daily `onSchedule` invocation is fine operationally, but plan/test it separately so a failure in one sweep doesn't obscure the other. If descoping is ever needed, this is the cleanest cut (R144/R145 do not depend on it — it fulfills Phase 59's deferral).

## Architecture Patterns

### System Architecture Diagram

```
CLIENT (lock notification, R144)                         CRON (reminder + dispatch, R145)
  ServiceEditorView.onMarkAsPlanned (:2757)                sendScheduledReminders  (onSchedule, 04:00 UTC)
    │ await serviceStore.markAsPlanned(id)  (draft→planned)   │ handler exported separately (unit-tested)
    │ applyTransitionLocally('planned')                       │
    ▼ (draft→locked transition only)                          │  SWEEP A — reminders:
    ① read lockSnapshots/current  ── exists? ── YES ─▶ re-lock │   collectionGroup('services')
    │     (Phase 62 handles; NO auto-send here)                │     .where('status','in',['planned','exported'])  ← never draft (SC4)
    │  NO (first lock)                                         │   for each service (per-item try/catch):
    ② write lockSnapshots/current =                           │     orgId = svc.ref.parent.parent.id → read org doc (cache)
    │   { snapshot: buildServiceSnapshot(svc),                │     skip if org.settings.messaging.enabled !== true
    │     slideGroupsFingerprint: null (defer→P62),           │     effN = svc.messaging.reminderDaysBefore
    │     lockedAt, lockedByUid }   (editor-write rule)       │            ?? org.settings.messaging.reminderDaysBefore ?? 7
    ③ IF isMessagingEnabled()                                 │     effEnabled = svc.messaging.reminderEnabled
    │   AND (svc.messaging.lockNotifyEnabled                  │              ?? org.settings.messaging.reminderEnabled
    │        ?? org.settings.messaging.lockNotifyDefault)     │     skip if !effEnabled  OR  svc.messaging.reminderSentAt set (SC4)
    │   AND wasFirstLock:                                     │     dueDate = service.date − effN  (UTC-pinned calendar math)
    ▼   httpsCallable(functions,'queueServiceMessage')({      │     today  = Intl.DateTimeFormat('en-CA',{timeZone: org tz}) (R133)
        type:'lock-notification', includeEveryone:true,      │     if dueDate === today:
        options:{attachServiceLink:true,sendCopyToSelf:false},│        createQueuedMessage(type:'reminder', includeEveryone, …) → messages/{id} status:'queued'
        subject/body with {{their_roles}}{{song_list}}{{service_link}} })   set svc.messaging.reminderSentAt (Admin SDK)  ← after enqueue
    │                                                         │
    │   (server re-checks editor + kill-switch, enqueues)     │  SWEEP B — dispatch scheduled (Phase 59 deferral):
    ▼                                                         │   collectionGroup('messages').where('status','==','scheduled')
  messages/{id} status:'queued'  ──onDocumentCreated──▶ sendQueuedMessage (unchanged; renders per-recipient; holds RESEND_API_KEY)
    ▲                                                         │   for each due (scheduledFor<=now, checked in code):
    └── a fresh 'queued' doc created from a 'scheduled' one ──┘     TX claim scheduled→dispatched (idempotent) ; then
                                                                     createQueuedMessage({...orig, scheduledFor:null}) → new 'queued' doc → fires trigger
```

### Recommended Structure (files this phase touches)
```
functions/src/
├── index.ts               # + 'lock-notification' in MessageType/MESSAGE_TYPES (:832-834)
│                          # + export sendScheduledRemindersHandler() (exported for test)
│                          # + export const sendScheduledReminders = onSchedule({schedule:'every day 04:00', timeZone:'UTC'}, ...)
│                          # + (Sweep B) dispatch helper: claim scheduled→dispatched + createQueuedMessage(new queued)
│                          # + a small todayInTimeZone(tz)/minusDays(ymd,n) date helper (pure, unit-tested)
└── index.test.ts          # + describe('sendScheduledRemindersHandler'): due/not-due, tz boundary,
                           #   reminderSentAt skip (SC4), draft-excluded (SC2/SC4), dispatch-creates-fresh-doc

src/
├── views/ServiceEditorView.vue        # + first-lock detect + lockSnapshots/current write + lock-notification enqueue in onMarkAsPlanned
├── stores/services.ts                 # (option) a writeLockSnapshot(id) action + read helper, OR keep it in the view
├── views/__tests__/ServiceEditorView.*.test.ts  # + first-lock enqueues once / re-lock does not / gates off → no send / draft never sends
└── (light) a lock-time toast component/affordance (ui-phase decides)

firestore.indexes.json     # likely NO new index for Sweep A (see Indexes); Sweep B stays single-field to avoid a composite
```

### Pattern 1: `onSchedule` handler exported separately (verified precedent)
```typescript
// Source: functions/src/index.ts:729-817 (cleanupOrphanRenders)
export async function cleanupOrphanRendersHandler(): Promise<OrphanCleanupSummary> {
  const snapshot = await getFirestore()
    .collectionGroup("pptxRenders")
    .where("status", "in", ["pending", "failed"])
    .get();
  for (const renderDoc of snapshot.docs) {
    const orgId = renderDoc.ref.parent.parent?.id;   // recover org from parent chain
    if (!orgId) { continue; }
    // ... per-item try/catch; one failure never aborts the run ...
  }
}
export const cleanupOrphanRenders = onSchedule(
  { schedule: "every day 03:00", timeZone: "UTC" },
  async () => { await cleanupOrphanRendersHandler(); },
);
```
`sendScheduledRemindersHandler()` + `export const sendScheduledReminders = onSchedule({ schedule: "every day 04:00", timeZone: "UTC" }, ...)` mirrors this exactly, offset to `04:00` so the three daily sweeps never overlap (`02:00` media, `03:00` renders, `04:00` reminders). **`onSchedule` is already imported (`:2`) and is NOT mocked in the test file — the real wrapper registers harmlessly at module load, so no new test mock is needed; the handler body is tested directly.**

### Pattern 2: Transactional idempotency claim (verified precedent — reuse for Sweep B)
```typescript
// Source: functions/src/index.ts:1197-1204 (sendQueuedMessage's queued→sending claim)
const claim = await db.runTransaction(async (tx) => {
  const snap = await tx.get(messageRef);
  if (!snap.exists) return { claimed: false as const, data: null };
  const data = snap.data() as QueuedMessageDoc | undefined;
  if (!data || data.status !== "queued") return { claimed: false as const, data: null };
  tx.update(messageRef, { status: "sending", updatedAt: FieldValue.serverTimestamp() });
  return { claimed: true as const, data };
});
```
Sweep B's `scheduled→dispatched` claim is the same shape (guard `status === 'scheduled'`). For the reminder `reminderSentAt` marker (Sweep A), a simple read-check-then-set is sufficient given daily cadence (see Idempotency below).

### Pattern 3: Reuse the canonical doc-shaper for a cron-created message (verified precedent)
```typescript
// Source: functions/src/index.ts:921-937 — createQueuedMessage is pure, no I/O.
// scheduledFor:null → status:'queued' → onDocumentCreated fires sendQueuedMessage.
const doc = createQueuedMessage({
  orgId, serviceId,
  type: "reminder",                       // or copied type for Sweep B dispatch
  subject, body,
  recipientSelector: { teams: [], individualPersonIds: [], includeEveryone: true },
  options: { attachServiceLink: true, sendCopyToSelf: false },
  scheduledFor: null,
  requestedByUid: "system",               // Sweep A reminder: sentinel; sendCopyToSelf is false so it is never resolved
});
await orgRef.collection("services").doc(serviceId).collection("messages").doc().set(doc);
```

### Pattern 4: Client callable enqueue for the lock notification (verified precedent)
```typescript
// Source: src/components/MessageComposer.vue:574
const queueServiceMessage = httpsCallable<QueueMessageRequest, { messageId: string }>(functions, 'queueServiceMessage')
const result = await queueServiceMessage({
  orgId, serviceId, type: 'lock-notification',
  subject, body,
  recipientSelector: { teams: [], individualPersonIds: [], includeEveryone: true },
  options: { attachServiceLink: true, sendCopyToSelf: false },
  scheduledFor: null,
})
```
`functions` is the client `firebase/functions` instance. The lock enqueue reuses this verbatim — no new client wrapper.

### Anti-Patterns to Avoid
- **Flipping an existing `'scheduled'` doc to `'queued'` and expecting a send** — `onDocumentCreated` does not re-fire on update. Create a fresh doc (Key Design Problem).
- **Widening `sendQueuedMessage` to `onDocumentWritten`** — re-entrancy on its own status/count writes; unnecessary.
- **Computing "today" with `new Date()` in server-local time** — the Function runs in UTC; org-local date must come from `Intl.DateTimeFormat({ timeZone })`, else a service near midnight fires a day early/late.
- **Reading org messaging from `org.messaging.*`** — the real path is `org.settings.messaging.*` (`functions/src/index.ts:1024-1027`, `src/types/organization.ts:119` nested under `OrgSettings`). CONTEXT's shorthand `org.messaging.reminderEnabled` means `settings.messaging.reminderEnabled`. Getting this wrong reads `undefined` and (per the null-coalescing) silently falls back to defaults.
- **Auto-sending on a re-lock in Phase 61** — first-lock only; a prior `lockSnapshots/current` means re-lock (Phase 62). Detect by reading it BEFORE the write.
- **Setting `reminderSentAt` from the client / on a draft** — it is Admin-SDK-only (Phase 58 rules) and must land on a locked service; only the cron writes it.
- **Calling `buildServiceSnapshot` server-side** — it is Pinia/`@/`-bound (`src/stores/services.ts:114-135`, imports `useSongStore`/`useRosterStore`/`useQuartersStore`); it is client-only. The lock snapshot is written client-side; the cron never needs it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Org-local "today" (R133) | A manual UTC-offset table / DST math | `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })` | Node 22 ICU handles every IANA zone + DST; `en-CA` emits `YYYY-MM-DD`. No package. |
| Message doc shape (reminder + dispatch) | A hand-built `messages` object | `createQueuedMessage()` (`functions/src/index.ts:921`) | The one canonical shaper so a cron message is identical to a human one at the trigger (its whole reason for existing, `:914` comment). |
| Send path | Anything | The shipped `sendQueuedMessage` trigger | It already re-resolves recipients, renders per-recipient tokens, sends, and rolls up counts. The cron only enqueues. |
| Scheduled-dispatch idempotency | A bare status flip | Transactional `scheduled→dispatched` claim (Pattern 2) | Only a read-guarded transaction is safe against `onSchedule` at-least-once retries. |
| Reminder idempotency | Re-sending every day | `messaging.reminderSentAt` skip-if-set (Phase 58 field, `src/types/service.ts:186`) | Admin-SDK-only marker already typed for exactly this. |
| Recipient resolution | Resolving in the cron | Leave it to `sendQueuedMessage` | The cron enqueues `includeEveryone:true`; the trigger re-resolves server-side (Anti-Pattern 1 from Phase 59). |

**Key insight:** the only genuinely new logic is (a) the reminder scan + org-tz date math, (b) the `scheduled→dispatched` claim + fresh-doc creation, and (c) the client first-lock detect + enqueue. Everything else is reuse of shipped code. Treat (a)–(c) as the risk surface and test each branch.

## Timezone Feasibility (R133) — CONFIRMED, no package

Node 22 ships full ICU, so `Intl.DateTimeFormat` resolves any IANA `timeZone`. The repo already relies on this: `formatServiceDate` (`functions/src/index.ts:1120-1130`) formats with `{ timeZone: "UTC" }` via `toLocaleDateString`. The exact snippet for "does `service.date − N days === today-in-org-tz`":

```typescript
/** Org-local calendar date as 'YYYY-MM-DD'. en-CA yields ISO-ordered parts directly. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // e.g. "2026-08-14"
}

/** service.date ('YYYY-MM-DD') minus n calendar days, UTC-pinned so DST never shifts the count. */
export function minusDays(dateYmd: string, n: number): string {
  const d = new Date(`${dateYmd}T00:00:00Z`);          // same UTC-pin as formatServiceDate
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);                  // 'YYYY-MM-DD'
}

// Fire the reminder when the org-local calendar day equals (service.date − effectiveN):
const isDueToday = minusDays(service.date, effectiveN) === todayInTimeZone(org.settings.timezone);
```

Notes: `service.date` is a plain calendar date (no time/zone), so subtracting days in UTC and comparing to the org-local *date* is the correct day-granularity reckoning. `formatToParts` is an equivalent alternative if `en-CA` is ever undesirable. **`OrgSettings.timezone` exists (Phase 58, `src/types/organization.ts:149`), default `'America/Chicago'` (`:226`).** SC3 says "firing at the org's local time of day," but CONTEXT locks **day granularity** (the local calendar-day boundary, not a specific local hour) — see Assumptions A2.

## Idempotency (SC4) — Design & Test

**Field:** `services/{id}.messaging.reminderSentAt` exists (Phase 58, `src/types/service.ts:186`, `Timestamp | null`) and is Admin-SDK-only — the Phase 58 `/services` update rule (`firestore.rules:107-127`) allows client writes only while `storedStatus()=='draft'` (or the export/reopen carve-outs), so a client cannot write `reminderSentAt` on a locked service; the cron (Admin SDK) bypasses rules entirely.

**Cron flow (Sweep A):** for a due service, (1) **skip if `messaging.reminderSentAt` is set**; (2) `createQueuedMessage(type:'reminder')` → `messages/{id}`; (3) **set `messaging.reminderSentAt = FieldValue.serverTimestamp()`** on the service doc. Because the skip check reads the marker and the daily cadence means each service is scanned once per day, a retried run in the same window finds `reminderSentAt` set and enqueues nothing.

**Ordering trade-off (recommend, and flag):** set `reminderSentAt` *after* a successful `createQueuedMessage` (CONTEXT wording). The only failure window is a crash *between* the enqueue write and the marker write — negligible at daily cadence and this scale, and its worst case is a rare double-reminder, not a lost one. For a strict SC4 "never twice" guarantee, upgrade to a transactional read-check-and-set of `reminderSentAt` *before* enqueue (mirrors Pattern 2); the trade is that a transient enqueue failure after the marker is set would skip that day's reminder. Given SC4's hard rule is "never twice," the transactional claim-first variant is the safer default if the executor wants belt-and-suspenders — either is acceptable; note the choice in the plan.

**Test (functions suite):** seed a candidate service (status `'planned'`, `date` == today + effectiveN, `reminderSentAt` unset) plus its org doc (kill-switch on, reminder on). Run `sendScheduledRemindersHandler()` → assert exactly one `messages` doc created (spy on the message `.set`) AND `reminderSentAt` set on the service. **Run the handler a SECOND time against the now-marked service → assert NO new message doc is created** (the second-run-in-same-window no-double-send assertion — the heart of SC4).

## Firestore Indexes — Confirmed Shapes

**Sweep A (reminder scan):** `collectionGroup('services').where('status','in',['planned','exported'])` is a **single-field `in` filter on a collection group** — structurally identical to the shipped `cleanupOrphanRendersHandler`'s `collectionGroup('pptxRenders').where('status','in',['pending','failed'])` (`functions/src/index.ts:740-743`), which ships **with no `firestore.indexes.json` entry** (the file contains only the Phase 60 `recipients.providerMessageId` override). By that direct in-repo precedent, **the reminder scan needs NO new index.**

**Sweep B (scheduled-message dispatch):** to avoid a composite index, query the **single field only** — `collectionGroup('messages').where('status','==','scheduled')` — and filter `scheduledFor <= now` in **code** (same "filter in code, not the query" discipline the reminder scan uses for N). That single-field equality collection-group query is the same class as Sweep A → **no new index needed.** If the executor instead writes the two-field query `.where('status','==','scheduled').where('scheduledFor','<=',now)`, that IS a composite collection-group query and REQUIRES this index:

```json
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "scheduledFor", "order": "ASCENDING" }
  ]
}
```
placed in the top-level `"indexes"` array of `firestore.indexes.json`, shipped deploy-gated with `firebase deploy --only firestore:indexes`. **Recommendation: use the single-field query + code filter and add NO index.**

**Deploy-gated fallback for both sweeps:** if a real deploy ever throws `FAILED_PRECONDITION` on a single-field collection-group query (Firestore's automatic single-field indexing normally covers these, which is why the two shipped sweeps need none), add a single-field `COLLECTION_GROUP` `fieldOverride` mirroring the shipped `recipients.providerMessageId` one (`firestore.indexes.json:4-13`) for `services.status` / `messages.status`. Document this as the contingency in `PENDING-VERIFICATION.md`; do not pre-add it against precedent.

## `slideGroupsFingerprint` — Now vs Defer Decision

**Decision: DEFER to Phase 62 — write `slideGroupsFingerprint: null` now.**

Rationale grounded in `buildServiceSnapshot` (`src/stores/services.ts:104-154`): it returns `{ date, name, progression, teams, slots (with bpm), sermonPassage, notes, status, roleAssignments }` — it contains **no slide/`slideGroups` text at all**. Slide content lives in a *separate* collection (`slideGroups`, one doc per slot keyed by slot id, `firestore.rules:172`) that `buildServiceSnapshot` never reads. So a meaningful slide fingerprint cannot be computed from the snapshot; it would require the lock hook to additionally read the `slideGroups` store — extra coupling for **zero Phase 61 benefit** (Phase 61 needs no diff; the snapshot's purpose here is only to *exist* so Phase 62 has a prior).

Deferring is also *safer* than guessing a format: Phase 62 owns the SLIDES-diff granularity decision (ROADMAP:397-398 explicitly leaves "coarse yes/no vs per-slide-group hash" open, "confirm at `/gsd-discuss-phase 62`"). If Phase 61 computes a fingerprint under a guessed format and Phase 62 changes it, the first post-upgrade re-lock diffs against an incompatible value — the same "first re-lock shows changed" outcome as a `null` placeholder, but with dead code to maintain. A nullable placeholder that Phase 62 backfills on its first lock is the honest minimum. Make the `lockSnapshots/current` `slideGroupsFingerprint` field **nullable** in whatever type documents it. (Flagged as A1 — the planner may override and compute a simple ordered-slide-text hash if it wants the snapshot "complete," but the recommendation is defer.)

## Common Pitfalls

### Pitfall 1: The `onDocumentCreated` non-re-fire trap
**What goes wrong:** The cron flips a `'scheduled'` doc to `'queued'`; nothing sends.
**Root cause:** `sendQueuedMessage` is `onDocumentCreated` (`functions/src/index.ts:1372`) — it fires on creation only, and its transaction guards `status === 'queued'` (`:1201`), so even the flip is inert.
**How to avoid:** Create a FRESH `'queued'` doc via `createQueuedMessage` (Key Design Problem); mark the original terminal under a transactional claim.
**Warning signs:** A "dispatch scheduled message" test that mutates status in place and asserts a send — it will pass against a mock but do nothing in production.

### Pitfall 2: `org.messaging` vs `org.settings.messaging`
**What goes wrong:** The cron reads `undefined` for the kill-switch/defaults and silently falls back to `?? 7` / off.
**Root cause:** Messaging lives under `OrgSettings` → `organizations/{id}.settings.messaging.*` (`functions/src/index.ts:1024-1027`, `src/types/organization.ts:119`). CONTEXT's `org.messaging.*` shorthand omits `settings`.
**How to avoid:** Read `orgDoc.data()?.settings?.messaging?.enabled === true` (exactly the `queueServiceMessageHandler` shape) and `settings.messaging.reminderEnabled/reminderDaysBefore`, `settings.timezone`.
**Warning signs:** Every org appears to have messaging off, or every reminder uses N=7 regardless of the org's configured value.

### Pitfall 3: Server-local date instead of org-local
**What goes wrong:** A reminder fires a day early or late for services near midnight in the org's zone.
**Root cause:** The Function runs in UTC; `new Date()` day != org-local day.
**How to avoid:** `todayInTimeZone(org.settings.timezone)` via `Intl.DateTimeFormat` (Timezone Feasibility snippet).

### Pitfall 4: First-lock detected AFTER writing the snapshot
**What goes wrong:** Every lock looks like a re-lock (or every lock auto-sends).
**Root cause:** `lockSnapshots/current` is written unconditionally in step 1; if you read it after, it always exists.
**How to avoid:** Read existence FIRST (`wasFirstLock = !exists`), then write, then gate the enqueue on `wasFirstLock`.

### Pitfall 5: Extending the functions test harness for the cron
**What goes wrong:** The reminder/dispatch tests need `collectionGroup(...).where(...).get()`, `runTransaction`, and a service-doc `.set` on the `getFirestore` fake.
**Root cause:** The module-scope `firebase-admin/firestore` mock exposes only `getFirestore: vi.fn()` + `FieldValue.serverTimestamp` (`functions/src/index.test.ts:65-68`); each test wires its own `db` fake (e.g. `cleanupOrphanRenders`' `collectionGroupSpy`, `:800-807`; `sendQueuedMessage`' `runTransaction` fake, `:1516-1540`).
**How to avoid:** Reuse those existing fake-builder patterns; the count/marker writes are literals so no `FieldValue.increment` mock is needed. `onSchedule` needs no mock (real wrapper registers at import).

### Pitfall 6: `.env.local` absent in a worktree
**What goes wrong:** Functions emulator / full app suite / `vite build` fail without secrets (per CLAUDE.md).
**How to avoid:** Symlink or copy `C:\projects\worshipplanner\.env.local` into any new worktree before emulator/build. Not relevant to the mocked unit tests (which stub `defineSecret`).

## Code Examples

### Reminder cron handler skeleton (mirrors cleanupOrphanRendersHandler)
```typescript
// Source shape: functions/src/index.ts:729-817
export async function sendScheduledRemindersHandler(now: Date = new Date()): Promise<ReminderSummary> {
  const db = getFirestore();
  const orgCache = new Map<string, OrgSettingsData | null>();
  const snapshot = await db.collectionGroup("services")
    .where("status", "in", ["planned", "exported"]).get();     // never 'draft' (SC2/SC4); same class as pptxRenders scan → no index
  let enqueued = 0;
  for (const svcDoc of snapshot.docs) {
    try {
      const orgId = svcDoc.ref.parent.parent?.id;
      if (!orgId) continue;
      const svc = svcDoc.data() as ServiceData;
      if (svc.messaging?.reminderSentAt) continue;             // SC4 idempotency skip
      const org = await loadOrg(db, orgId, orgCache);          // reads settings.messaging + settings.timezone
      if (org?.settings?.messaging?.enabled !== true) continue; // kill-switch (settings.messaging!)
      const effEnabled = svc.messaging?.reminderEnabled ?? org.settings.messaging.reminderEnabled;
      if (!effEnabled) continue;
      const effN = svc.messaging?.reminderDaysBefore ?? org.settings.messaging.reminderDaysBefore ?? 7;
      // optional lookahead bound in code, e.g. skip if service.date > today+30d
      if (minusDays(svc.date, effN) !== todayInTimeZone(org.settings.timezone, now)) continue;  // R133
      await enqueueReminder(db, orgId, svcDoc.id, /* subject/body */);   // createQueuedMessage(type:'reminder')
      await svcDoc.ref.set({ messaging: { ...svc.messaging, reminderSentAt: FieldValue.serverTimestamp() } }, { merge: true });
      enqueued++;
    } catch (err) {
      console.error(`sendScheduledReminders: failed for ${svcDoc.ref.path}:`, err);   // per-item try/catch
    }
  }
  return { scanned: snapshot.size, enqueued };
}
export const sendScheduledReminders = onSchedule(
  { schedule: "every day 04:00", timeZone: "UTC" },
  async () => { await sendScheduledRemindersHandler(); },
);
```

### Client first-lock enqueue (inside onMarkAsPlanned, after applyTransitionLocally('planned'))
```typescript
// Source: src/views/ServiceEditorView.vue:2778-2779 (existing) + MessageComposer.vue:574 (callable)
const svc = localService.value!
const snapRef = doc(db, 'organizations', orgId, 'services', svc.id, 'lockSnapshots', 'current')
const prior = await getDoc(snapRef)
const wasFirstLock = !prior.exists()
await setDoc(snapRef, {
  snapshot: buildServiceSnapshot(svc),
  slideGroupsFingerprint: null,          // DEFER to Phase 62
  lockedAt: serverTimestamp(),
  lockedByUid: authStore.uid,
})
const effectiveLockNotify = svc.messaging?.lockNotifyEnabled ?? authStore.settings.messaging.lockNotifyDefault
if (wasFirstLock && isMessagingEnabled() && effectiveLockNotify) {
  const queueServiceMessage = httpsCallable<QueueMessageRequest, { messageId: string }>(functions, 'queueServiceMessage')
  await queueServiceMessage({
    orgId, serviceId: svc.id, type: 'lock-notification',
    subject: LOCK_SUBJECT_TEMPLATE, body: LOCK_BODY_TEMPLATE,        // copy at discretion; uses {{their_roles}}{{song_list}}{{service_link}}
    recipientSelector: { teams: [], individualPersonIds: [], includeEveryone: true },
    options: { attachServiceLink: true, sendCopyToSelf: false },
    scheduledFor: null,
  })
  // then a light "Notified N assigned volunteers" toast (ui-phase)
}
```
(Failure of the enqueue must NOT undo the successful lock — wrap in its own try/catch and surface a soft toast, matching the `bumpScheduledSongsLastUsed` try/catch posture at `ServiceEditorView.vue:2800-2804`.)

## Runtime State Inventory

Not applicable — Phase 61 is additive (a new `onSchedule` Function + a client hook + a `'lock-notification'` enum member + populating already-typed fields). No rename/refactor/migration.

- **Stored data:** None re-keyed. `lockSnapshots/current` docs and `messaging.reminderSentAt` are NEW writes to already-defined shapes; older service docs simply lack them (nullable/absent, typecheck fine — `src/types/service.ts:182`).
- **Live service config:** The `sendScheduledReminders` Function must be **deployed** by the owner (`firebase deploy --only functions:sendScheduledReminders`) after this phase — routed to `PENDING-VERIFICATION.md`. No new provider secret (the cron only enqueues; `sendQueuedMessage` already holds `RESEND_API_KEY`).
- **OS-registered state:** None (Cloud Scheduler job is provisioned by the Functions deploy, not an OS registration).
- **Secrets/env vars:** None new this phase.
- **Build artifacts:** None — no package installed. (Any composite index for Sweep B, if chosen, is a config addition, deploy-gated.)

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

**Known-failing app-suite baseline (per CLAUDE.md, do NOT chase):** `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). A Phase 61 change is regression-free if it adds no *new* failing app-suite file beyond these two.

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | Suite / File | Exists? |
|----------|----------|-----------|-------------------|--------------|---------|
| R144 / SC1 | First lock (no prior `lockSnapshots/current`) with messaging on + effective `lockNotifyEnabled` on → enqueues ONE `type:'lock-notification'` via `queueServiceMessage` (`includeEveryone:true`) | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.*.test.ts` | app | ❌ Wave 0 |
| R144 | Every lock writes `lockSnapshots/current` (snapshot + `slideGroupsFingerprint:null`), even a re-lock | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.*.test.ts` | app | ❌ Wave 0 |
| R144 | **Re-lock** (a prior `lockSnapshots/current` exists) writes the snapshot but does NOT enqueue a lock notification | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.*.test.ts` | app | ❌ Wave 0 |
| **SC2** | Lock notification never enqueues when `isMessagingEnabled()` is false, or when effective `lockNotifyEnabled` resolves off — and never fires on a draft (only on the draft→locked transition) | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.*.test.ts` | app | ❌ Wave 0 |
| R137 plumbing | `queueServiceMessage` accepts `type:'lock-notification'` (in `MESSAGE_TYPES`); a non-editor/kill-switch-off caller still rejected | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| R145 / SC3 | Due service (status planned/exported, `service.date − effN === today-in-org-tz`, marker unset, gates on) → ONE `type:'reminder'` enqueued via `createQueuedMessage` | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| R145 / R133 | Org-tz boundary: a service due only in the org's zone (not in UTC) fires on the correct local calendar day (`todayInTimeZone`/`minusDays` unit) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| R145 | Effective N + enabled resolve service-then-org-then-default(7); kill-switch off (`settings.messaging.enabled`) → skip; reminder off → skip | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **SC4 (draft)** | A `draft` service is never scanned (query excludes it) → no reminder | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| **SC4 (no double)** | Second handler run in the same window against a service whose `reminderSentAt` is set → ZERO new messages (the idempotency assertion) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| Dispatch (Phase 59 deferral) | Due `status:'scheduled'` message → cron CREATES a fresh `status:'queued'` doc (via `createQueuedMessage`, fields copied) AND marks the original `'dispatched'`; a retried run creates NOTHING more (transactional claim) | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 |
| Type gate | No new TS errors across src + tests | typecheck | `npm run type-check` **and** `cd functions && npm run build` | both | n/a |

### Sampling Rate
- **Per task commit:** the single new/edited spec — `npx vitest run <file>` (app) or `cd functions && npx vitest run src/index.test.ts` (functions).
- **Per wave merge:** `npx vitest run` (app suite) **and** `cd functions && npm test` (functions suite).
- **Phase gate:** both suites green (app minus the 2-file known baseline), plus `npm run type-check` **and** `cd functions && npm run build`, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `functions/src/index.test.ts` — new `describe('sendScheduledRemindersHandler')` covering due/not-due, org-tz boundary, effective-N/enabled resolution, kill-switch skip, draft-excluded (SC4), **reminderSentAt no-double-send (SC4)**, and the scheduled-message dispatch (fresh-doc + idempotent claim). Reuse the `collectionGroup`/`runTransaction` fake-builder patterns already in this file (`:800-807`, `:1516-1540`).
- [ ] `functions/src/index.test.ts` — pure-helper tests for `todayInTimeZone(tz)` / `minusDays(ymd,n)` (a known instant in two zones straddling midnight; a DST-crossing subtraction).
- [ ] `src/views/__tests__/ServiceEditorView.*.test.ts` — first-lock-enqueues-once / re-lock-does-not / gates-off-no-send / draft-never-sends / snapshot-always-written. (An existing `ServiceEditorView.test.ts` already stubs `DEFAULT_ORG_SETTINGS.messaging` at `:415-445` — extend that harness.)
- [ ] `firestore.indexes.json` — **no change expected** (Sweep A + single-field Sweep B need none, per precedent). Only if the two-field Sweep B query is chosen: add the composite `messages` collection-group index (shape above), deploy-gated.
- [ ] No framework install — this phase adds no npm dependency.

## Security Domain

> `security_enforcement` is not present in `.planning/config.json` → treated as **enabled**.

Phase 61 adds **no new trust boundary** — both triggers ride the Phase 59 send path, whose boundary (client declares intent; server re-authorizes, re-resolves recipients, holds the key) is unchanged. The two new surfaces are a **time-driven server job** (no external caller) and a **client lifecycle hook** that goes through the already-hardened `queueServiceMessage`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control (this phase) |
|---------------|---------|-------------------------------|
| V4 Access Control | yes | The lock enqueue calls `queueServiceMessage`, which independently re-checks org-**editor** membership + the kill-switch server-side (`functions/src/index.ts:1011-1033`) — the client's `type:'lock-notification'` and `includeEveryone` are *intent*, re-resolved server-side. `reminderSentAt`/`lockSnapshots` writes are governed by Phase 58 rules (`firestore.rules:107-127`, `:162-165`); the cron's `reminderSentAt` write is Admin-SDK-only. |
| V5 Input Validation | yes | `queueServiceMessage` validates `type ∈ MESSAGE_TYPES` (`:987`) — `'lock-notification'` must be added there or the enqueue is rejected. The cron trusts no client input; it reads server data and computes dates itself. |
| V6 Cryptography / Secrets | yes | No new secret. The cron only enqueues; `RESEND_API_KEY` stays bound solely to `sendQueuedMessage` (`:1375`). Verify no key/`resend` import reaches the cron or the client. |
| V7 Error Handling / Logging | yes | Per-item try/catch in the cron so one bad service/org never aborts the run (mirrors `cleanupOrphanRenders`); the client lock enqueue is wrapped so its failure never rolls back the successful lock. Never log full recipient emails. |
| V2 Authentication | yes (unchanged) | The lock enqueue requires `request.auth` via `queueServiceMessage` (`:964`). The `onSchedule` cron is invoked by Cloud Scheduler, not an external HTTP caller — no auth surface. |
| V3 Session Management | no | No new session state. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client forces a lock email while messaging is off / as a non-editor | Elevation | `queueServiceMessage` re-checks editor + `settings.messaging.enabled` server-side (`:1017-1033`); the client gate is convenience only. |
| Reminder double-send on `onSchedule` retry (at-least-once) | — (duplication) | `messaging.reminderSentAt` skip-if-set + set-after-enqueue (optionally a transactional claim). Tested explicitly (SC4). |
| Scheduled-message double-dispatch on cron retry | — (duplication) | Transactional `scheduled→dispatched` claim before creating the fresh queued doc. |
| Reminder fires on a draft | Tampering / correctness | Query excludes `draft` (`where('status','in',['planned','exported'])`); tested (SC4). |
| Cross-org leakage in the scan | Information Disclosure | `orgId` recovered from `ref.parent.parent.id` (never a client field), org settings read for THAT org; identical to `cleanupOrphanRenders` (`:750`). |
| Client writes `reminderSentAt` to suppress a reminder, or forges a `sent` message | Tampering | Phase 58 rules: `/services` update is draft-only for clients (`firestore.rules:107-127`) so `reminderSentAt` can't be set on a locked service; `messages` `update,delete: if false` (`:144`). Only the Admin SDK writes these. |
| Timezone confusion sends at the wrong time | correctness | `Intl.DateTimeFormat({ timeZone })` org-local date; day granularity locked (sub-day out of scope). |

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Cloud Tasks per-service scheduled sends | A single daily `onSchedule` `collectionGroup` scan | this milestone (ARCHITECTURE §Scheduling) | Day granularity + tiny scale → the scan is trivially cheap; no queue/IAM. Locked. |
| Manual timezone offset math | `Intl.DateTimeFormat({ timeZone })` (full ICU in Node 22) | current | No tz package; DST handled by ICU. |
| `functions.config()` | `defineSecret`/`defineString` params | Functions v2 (already adopted) | N/A this phase (no new config/secret). |

**Deprecated/outdated:** none introduced. No package installed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `onSchedule` (`firebase-functions/v2/scheduler`) | the reminder cron | ✓ (already imported, `functions/src/index.ts:2`) | `^7.2.5` | — |
| `Intl.DateTimeFormat` w/ IANA tz | R133 org-local date | ✓ (Node 22 full ICU) | Node 22 | — |
| `firebase/functions` `httpsCallable` (client) | lock enqueue | ✓ (used by `MessageComposer.vue:574`) | installed | — |
| Cloud Scheduler / deployed `sendScheduledReminders` | live reminder firing | ✗ (by design — ships UNDEPLOYED) | — | mocked unit tests need no deploy; owner deploys at `/gsd-verify-work` |
| Firebase Functions emulator | optional live smoke | needs `.env.local` | — | mocked unit tests need no emulator |

**Missing with no fallback:** none blocks this phase — everything is built and unit-tested against mocks; the real deploy of the cron is deliberately deferred to the owner (deploy-gated).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `slideGroupsFingerprint` can be `null` in Phase 61 and backfilled by Phase 62; `buildServiceSnapshot` contains no slide text so a real fingerprint has no Phase 61 use. | slideGroupsFingerprint decision | If Phase 62 requires a Phase-61-era fingerprint for its very first diff, the first re-lock after Phase 62 ships shows "changed" once. Cosmetic, one-time. LOW. |
| A2 | SC3's "org's local time of day" is satisfied by day-granularity (the org-local calendar-day boundary), per CONTEXT's explicit sub-day-out-of-scope lock. | Timezone Feasibility | If the owner actually wants a specific local *hour*, day granularity fires at the cron's fixed UTC slot instead — a known, owner-confirmable trade (CONTEXT flags it). LOW–MEDIUM. |
| A3 | Single-field `in`/`==` collection-group queries need NO explicit index (per the shipped `cleanupOrphanRenders` precedent that has none). | Firestore Indexes | If a real deploy throws `FAILED_PRECONDITION`, add a single-field `COLLECTION_GROUP` `fieldOverride` (documented fallback). The two-field Sweep B variant definitely needs the composite (shape given). LOW. |
| A4 | `requestedByUid: 'system'` is safe for a cron reminder because `sendCopyToSelf:false` means `resolveEditorEmail` is never called for it. | Pattern 3 | If a future change resolves the requester regardless of `sendCopyToSelf`, `'system'` would fail to resolve → no self-copy (harmless for a reminder). LOW. |
| A5 | Setting `reminderSentAt` after (not before) enqueue is acceptable for SC4; the crash-between window is negligible at daily cadence. | Idempotency | A crash between the two writes could double-send once on the next run. Mitigated by offering the transactional claim-first variant. LOW. |

## Open Questions

1. **Reminder marker ordering (A5).** Set `reminderSentAt` after enqueue (simplest, CONTEXT wording) vs a transactional claim-first (strict "never twice"). Recommendation: default to after-enqueue; upgrade to claim-first only if the executor wants belt-and-suspenders. Both pass the SC4 test.

2. **Scheduled-dispatch as its own plan (Key Design Problem).** Recommendation: plan/test Sweep B separately from Sweep A (distinct collection group, idempotency, optional index) even if they share the one daily `onSchedule` invocation. Descope candidate if needed — R144/R145 don't depend on it.

3. **Lock-notification failure UX.** If `queueServiceMessage` throws after a successful lock, surface a soft toast, never roll back the lock (mirror `bumpScheduledSongsLastUsed`'s try/catch, `ServiceEditorView.vue:2800-2804`). ui-phase confirms the affordance.

## Sources

### Primary (HIGH confidence)
- `functions/src/index.ts` — `onSchedule` import (:2), `cleanupExpiredMediaHandler`/`cleanupExpiredMedia` (:607-663, `every day 02:00`), `cleanupOrphanRendersHandler`/`cleanupOrphanRenders` (:729-817, `collectionGroup('pptxRenders').where('status','in',[...])`, `ref.parent.parent?.id`, per-item try/catch, `03:00`), `MessageType`/`MESSAGE_TYPES` (:832-834), `createQueuedMessage` (:921-937), `queueServiceMessageHandler` (editor + kill-switch re-check :1011-1033, type enum :987), `queueServiceMessage` wrapper no-secret (:1062), `sendQueuedMessageHandler` transactional `queued→sending` claim (:1197-1204), per-recipient render/send (:1289-1350), `sendQueuedMessage` `onDocumentCreated` + `RESEND_API_KEY` (:1372-1384), `formatServiceDate` UTC-pin precedent (:1120-1130), `resolveEditorEmail` (:1170-1178).
- `functions/src/index.test.ts` — mock harness: `getFirestore` bare mock + `FieldValue.serverTimestamp` only (:65-68), `onDocumentCreated`→identity (:85-92), Resend mocked (:104-110), `collectionGroup` fake-builder (:800-807), `runTransaction` fake (:1516-1540); `onSchedule`/`firebase-functions/v2/scheduler` NOT mocked (real wrapper registers at import).
- `src/views/ServiceEditorView.vue` — `onMarkAsPlanned` (:2757), `await serviceStore.markAsPlanned` + `applyTransitionLocally('planned')` (:2778-2779), post-transition try/catch posture (:2800-2804), `isMessagingEnabled` import (:1560).
- `src/stores/services.ts` — `buildServiceSnapshot` (:104-154, returns no slide text; Pinia-bound), `markAsPlanned` (:346-354, draft→planned).
- `src/components/MessageComposer.vue:574` — the `httpsCallable(functions,'queueServiceMessage')` pattern the lock enqueue reuses.
- `src/types/organization.ts` — `OrgSettings.messaging` (:119-145: `enabled`/`lockNotifyDefault`/`reminderEnabled`/`reminderDaysBefore`), `timezone` (:149), `DEFAULT_ORG_SETTINGS` (:219-226: all-false messaging, `reminderDaysBefore:7`, `timezone:'America/Chicago'`); `src/stores/auth.ts:229-233` deep-merge of `settings.messaging`.
- `src/types/service.ts:182-187` — per-service `messaging` overrides (`lockNotifyEnabled`/`reminderEnabled`/`reminderDaysBefore` nullable, `reminderSentAt` Admin-SDK-only).
- `firestore.rules` — `/services` update draft-only + carve-outs (:107-127), `messages` create=isOrgEditor / update,delete=false (:141-144), `recipients` write=false (:150-153), `lockSnapshots` read=isOrgMember/write=isOrgEditor (:162-165).
- `firestore.indexes.json` — only the Phase 60 `recipients.providerMessageId` single-field `COLLECTION_GROUP` override (:4-13); no `pptxRenders.status` or `services.status` entry → precedent that single-field collection-group scans need none.
- `.planning/research/ARCHITECTURE.md` §Scheduling (:413-461, onSchedule not Cloud Tasks; the 5-step reminder shape; `createQueuedMessage` reuse); `.planning/ROADMAP.md` §Phase 61 (:347-372, SC1–SC4, deploy-gated note).
- `.planning/phases/59-*/59-RESEARCH.md`, `60-*/60-RESEARCH.md` — the shipped send-path + webhook context this phase builds on.

### Secondary (MEDIUM confidence)
- Node 22 full-ICU `Intl.DateTimeFormat({ timeZone })` for arbitrary IANA zones `[CITED: Node.js Intl docs]` — corroborated by the in-repo `formatServiceDate` usage.

### Tertiary (LOW confidence)
- None load-bearing.

## Metadata

**Confidence breakdown:**
- Standard stack / reuse: HIGH — every Function, field, rule, and pattern anchored to a live `file:line`; no package installed.
- Key design problem (scheduled-message dispatch): HIGH — grounded in the actual `onDocumentCreated` trigger + the `status==='queued'` guard; the fresh-doc + transactional-claim recommendation reuses shipped primitives.
- Indexes: MEDIUM–HIGH — the "no index for single-field collection-group scan" claim rests on the shipped `cleanupOrphanRenders` precedent (strong) plus a documented deploy-gated fallback; the composite shape (if the two-field query is chosen) is definitive.
- Timezone: HIGH — Node 22 ICU + an in-repo `toLocaleDateString({timeZone})` precedent.

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (30 days; stable — no fast-moving dependency).
