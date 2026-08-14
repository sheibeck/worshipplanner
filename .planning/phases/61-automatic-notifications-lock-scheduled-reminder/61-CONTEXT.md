# Phase 61: Automatic Notifications — Lock & Scheduled Reminder - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas defaulted per the v1.7 standing autonomy grant; grounded in `.planning/research/ARCHITECTURE.md` §Scheduling / §Build Order Phase D & E / §Data Model, and the Phase 58/59/60 foundation already shipped)

<domain>
## Phase Boundary

Two automatic notifications, neither requiring planner action at send time, both riding the Phase 59 send
path:
1. **Lock notification (R144)** — when a service is locked for the FIRST time (draft→planned/exported),
   automatically email everyone assigned (their roles, song list, service-order link), governed by the
   per-service/Settings `lockNotifyEnabled` default from Phase 58.
2. **Scheduled reminder (R145)** — a daily `sendScheduledReminders` cron auto-sends the shared service
   link to everyone assigned N days before the service (default 7, per-service/Settings configurable),
   reckoned in the org's local timezone (R133).

Requirements: R144 (auto lock email), R145 (auto N-days-before reminder).

Out of this phase:
- **Re-lock scoped change diff + prompt** → Phase 62 (this phase writes `lockSnapshots/current` on lock so
  Phase 62 has a prior snapshot to diff against, but does NOT compute or prompt a diff).
- Soft-bounce/opens (Phase 60 scope note), any new composer UI (Phase 59).
</domain>

<decisions>
## Implementation Decisions

### Allow the `lock-notification` message type (send-path plumbing)
- `functions/src/index.ts` currently validates `MessageType = 'oneoff' | 'reminder' | 'share-link'`
  (`:832`, `MESSAGE_TYPES` `:834`, checked `:987`). **Add `'lock-notification'`** to the type + array so
  `queueServiceMessage` accepts a lock email. (Phase 62 later adds `'relock-notification'`.) The
  `sendQueuedMessage` trigger already renders tokens + sends for any type — no trigger change needed.

### Lock notification (R144) — client-triggered on FIRST lock
- Hook into the existing lock flow: `onMarkAsPlanned` (`src/views/ServiceEditorView.vue:2757`, calls
  `serviceStore.markAsPlanned` `:2778` → services.ts:346). After the lock succeeds, on the **draft→locked
  transition only**:
  1. Write **`services/{id}/lockSnapshots/current`** = `{ snapshot: buildServiceSnapshot(service),
     slideGroupsFingerprint, lockedAt, lockedByUid }` (client write; Phase 58 rule `lockSnapshots` write =
     `isOrgEditor`; `buildServiceSnapshot` is `services.ts:104`, already client-available). This exists for
     **Phase 62's diff** — write it on every lock; Phase 61 needs no diff.
  2. **IF** `isMessagingEnabled()` is true **AND** the effective lock-notify default resolves ON
     (`service.messaging.lockNotifyEnabled ?? org.settings.messaging.lockNotifyDefault`) **AND** this is the
     FIRST lock (no prior `lockSnapshots/current` existed before step 1) — automatically enqueue a
     `messages` doc via the `queueServiceMessage` client callable: `type:'lock-notification'`,
     `recipientSelector = { teams:[], individualPersonIds:[], includeEveryone:true }` (everyone assigned),
     `options:{ attachServiceLink:true, sendCopyToSelf:false }`, subject/body from a lock template using
     `{{their_roles}}`, `{{song_list}}`, `{{service_link}}`. The send path (`sendQueuedMessage`) does the
     rest — server re-resolves recipients + renders per-recipient (R139 already proven).
- **Never sends while draft or while messaging is off (SC2):** guaranteed — the send only fires on the
  draft→locked transition (never on a draft) and behind the `isMessagingEnabled()` + `lockNotifyEnabled`
  gates. The server `queueServiceMessage` ALSO re-checks the kill-switch (defense in depth, 59-02).
- **First-lock only:** re-lock (a `lockSnapshots/current` already exists) does NOT auto-send here — that is
  Phase 62's prompt-with-diff. So a re-locked service gets no notification until Phase 62 ships; acceptable
  for the phased build and matches R144/SC1's "for the first time."
- **DEFAULTED grey area — automatic vs prompt on first lock:** first lock is **automatic** (governed by the
  default), NOT a prompt — matches R144 "can automatically email" + SC1. The prompt is only for re-lock
  (Phase 62). If the owner wants a confirm-before-send on first lock too, that's a later tweak.

### Scheduled reminder cron (R145) — `sendScheduledReminders` onSchedule daily (DEPLOY-GATED)
- A NEW `onSchedule` Function in `functions/src/index.ts`, mirroring `cleanupExpiredMedia`/
  `cleanupOrphanRenders` EXACTLY (`functions/src/index.ts` ~621/775 — broad `collectionGroup` scan, per-item
  try/catch so one failure never aborts the run, handler body exported separately for unit test, offset to
  its own daily UTC slot e.g. `04:00`). Build against MOCKED provider; ships built/tested/UNDEPLOYED.
- Handler:
  1. `collectionGroup('services').where('status','in',['planned','exported'])` — **never `draft`** (SC4
     skip rule) — bounded to a reasonable lookahead window (~30 days) checked in CODE, not the query (N
     varies per org/service).
  2. For each candidate: `effectiveReminderEnabled = service.messaging.reminderEnabled ??
     org.messaging.reminderEnabled`; `effectiveN = service.messaging.reminderDaysBefore ??
     org.messaging.reminderDaysBefore ?? 7`. Skip if the org `messaging.enabled` kill-switch is off or
     `effectiveReminderEnabled` is off.
  3. **Timezone (R133):** compute "today" in the org's IANA `settings.timezone` via `Intl.DateTimeFormat`
     (`{ timeZone }` → Y-M-D) — **no new package** — and fire when `service.date - effectiveN === today`
     reckoned in that timezone. **DEFAULTED grey area:** the cron runs once daily at a fixed UTC hour and
     uses the org timezone for the DATE boundary; **sub-day time-of-day precision is out of scope** (day
     granularity — ARCHITECTURE deliberately rejected Cloud Tasks; "org's local time of day" = the local
     calendar-day boundary, not a specific local hour). Flag for owner confirmation.
  4. **Idempotency (SC4):** skip if `service.messaging.reminderSentAt` is already set; after enqueuing, set
     `reminderSentAt` on the service doc (Admin SDK — `reminderSentAt` is Admin-SDK-only, Phase 58 rules
     deny client writes, and it must fire on a LOCKED service so it bypasses the R036 draft guard). A
     retried run never double-sends.
  5. Enqueue via the SHARED `createQueuedMessage()` helper (59-02) — `type:'reminder'`, everyone assigned,
     `options.attachServiceLink:true` — so `sendQueuedMessage` fires identically to a human send.
- **Also dispatch due user-scheduled messages (the Phase 59 deferral):** in the same daily run (or a small
  sibling sweep), `collectionGroup('messages').where('status','==','scheduled').where('scheduledFor','<=',
  now)` → flip each to `status:'queued'` (re-triggering `sendQueuedMessage` via the onDocumentUpdated... —
  NOTE: `sendQueuedMessage` is `onDocumentCreated`, so a status flip on an EXISTING doc will NOT re-fire it;
  the dispatch must instead CREATE a fresh queued message doc from the scheduled one, or the trigger must be
  widened. **Resolve in research/planning:** simplest is the cron creates a new `type` doc via
  createQueuedMessage mirroring the scheduled one and marks the original `sent`/`dispatched`. Confirm the
  cleanest mechanism so a scheduled message actually sends). This fulfills 59's "schedule-for-later
  dispatch deferred to Phase 61." If it materially complicates the phase, it may be split to its own plan.

### Firestore indexes (deploy-gated)
- The cron's `collectionGroup('services')` status query and the scheduled-message `collectionGroup('messages')`
  status+scheduledFor query likely need collection-group / composite indexes in `firestore.indexes.json`
  (mirroring 60-01's index add). Ship deploy-gated with the exact `firebase deploy --only firestore:indexes`.
  Confirm exact index shapes in research.

### UI (light — R144/R145 are mostly automatic)
- The Settings kill-switch + automatic-email defaults (lockNotifyDefault, reminderEnabled,
  reminderDaysBefore, timezone) and the per-service overrides ALREADY shipped in Phase 58 — no new settings
  UI. The net-new UI is a small **lock-time confirmation** (e.g. a toast "Notified N assigned volunteers"
  after a first lock that sent) and possibly surfacing that a reminder is scheduled/sent on the service
  (the Phase 60 delivery-history panel already lists sent `reminder`/`lock-notification` messages). Keep it
  light; the ui-phase decides the exact feedback affordance.

### Claude's Discretion
- The lock-email subject/body template copy, the exact toast/feedback affordance, the cron's UTC hour slot,
  the lookahead-window size, and the scheduled-message-dispatch mechanism (new-doc vs trigger-widening) —
  all at implementer discretion, guided by ARCHITECTURE, the send path, and conventions.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/index.ts` — `MessageType`/`MESSAGE_TYPES` (`:832-834`) to extend; `createQueuedMessage()`
  (59-02) shared doc-shaper the cron reuses; `sendQueuedMessage` trigger (59-03) fires for any type;
  `cleanupExpiredMedia`/`cleanupOrphanRenders` (`~621/775`) the `onSchedule` shape to mirror;
  `defineSecret`/handler-exported-for-test conventions.
- `src/views/ServiceEditorView.vue::onMarkAsPlanned` (`:2757`) + `src/stores/services.ts::markAsPlanned`
  (`:346`) — the lock flow to hook.
- `src/stores/services.ts::buildServiceSnapshot` (`:104`) — the `lockSnapshots/current` payload (client).
- `src/utils/messaging.ts::isMessagingEnabled()` + the Phase 58 `messaging` settings/per-service overrides —
  the gates governing the lock email.
- `src/utils/messagingRecipients.ts` / `functions/src/serviceRoles.ts` (ported, 59-01) — everyone-assigned
  resolution (server re-resolves at send).
- `firestore.rules` `lockSnapshots` (write isOrgEditor) + `messages` (create isOrgEditor) — Phase 58, already
  gate these writes. `reminderSentAt` is Admin-SDK-only (bypasses rules; fires on locked services).
- `firestore.indexes.json` (Phase 60 pattern) — where the cron's collection-group/composite indexes go.
- Node `Intl.DateTimeFormat({ timeZone })` — org-local date computation, no new package.

### Established Patterns
- Queue-then-trigger reused by BOTH a human send (composer) and the cron (createQueuedMessage → sendQueuedMessage).
- onSchedule cron: broad collectionGroup scan, per-item try/catch, idempotent-by-a-marker, handler exported for test.
- Client hooks into an existing lifecycle action (lock) rather than a new surface.

### Integration Points
- `functions/src/index.ts` (MessageType + `sendScheduledReminders` cron + scheduled-message dispatch),
  `firestore.indexes.json` (cron indexes), `ServiceEditorView.vue`/`services.ts` (lock hook: lockSnapshots
  write + auto lock-notification enqueue), a light lock-time toast. Roster/quarters read-only.
</code_context>

<specifics>
## Specific Ideas
- First lock = automatic (governed by the Phase 58 default); re-lock prompt+diff is Phase 62. Write
  `lockSnapshots/current` on every lock so Phase 62 can diff.
- The cron must NEVER send on a draft and NEVER double-send (reminderSentAt idempotency) — the two hard SC4 rules.
- Reuse createQueuedMessage so a cron-created message is indistinguishable from a human one at the trigger.
- No new provider secret this phase (sendQueuedMessage already holds RESEND_API_KEY); the cron only enqueues.
</specifics>

<deferred>
## Deferred Ideas
- Re-lock scoped change diff + checkable prompt + `'relock-notification'` type → Phase 62.
- Sub-day (specific local hour) reminder precision — out of scope (day granularity; Cloud Tasks rejected).
- Real deploy of `sendScheduledReminders` + its indexes + secrets → OWNER (built/tested/UNDEPLOYED here).
</deferred>
