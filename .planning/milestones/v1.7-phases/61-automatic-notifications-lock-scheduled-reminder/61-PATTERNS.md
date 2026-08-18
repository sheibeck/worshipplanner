# Phase 61: Automatic Notifications — Lock & Scheduled Reminder - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 8 new/modified units
**Analogs found:** 8 / 8 (every unit has a clean in-repo analog; two carry a load-bearing trap grafted onto the analog — flagged inline)

## File Classification

| New/Modified unit | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `functions/src/index.ts::sendScheduledReminders` (+ handler) | function (onSchedule cron) | batch / collectionGroup scan | same file, `cleanupOrphanRendersHandler`/`cleanupOrphanRenders` (`729-817`) | exact |
| `functions/src/index.ts` `MessageType`/`MESSAGE_TYPES` + `'lock-notification'` | config / enum | validation gate | same file, existing `MessageType` (`832`), `MESSAGE_TYPES` (`834`), gate (`987`) | exact |
| cron's `createQueuedMessage()` reuse + scheduled-dispatch | function logic | queue-then-trigger | same file, `createQueuedMessage` (`921-937`) + `queueServiceMessageHandler` write (`1037-1054`) + `sendQueuedMessage` `onDocumentCreated` (`1064+`) | exact (dispatch has a trap) |
| `functions/src/index.test.ts` (cron describe blocks) | test | — | same file, `cleanupOrphanRendersHandler` block + `mockOrphanDb` collectionGroup fake (`754-808`) | exact |
| `firestore.indexes.json` cron indexes | config | — | Phase 60 `recipients.providerMessageId` **fieldOverride** (`3-14`) | partial (shape differs — see note) |
| lock hook: `lockSnapshots/current` write + auto-enqueue in lock flow | store + view | request-response / nested-doc write | `services.ts::markAsPlanned` (`346-354`), `buildServiceSnapshot` (`104-154`), `writeSharePayload::setDoc` (`576-585`), `ServiceEditorView.vue::onMarkAsPlanned` (`2757-2823`), `MessageComposer.vue::onSend` callable (`574-591`) | exact |
| lock-time feedback toast | store call | — | `src/stores/toasts.ts::push` (`24-29`) as used by `MessageComposer.vue` (`592-596`) | exact |
| lock-hook test | test | — | `ServiceEditorView.test.ts` R036/R037 block (`5464-5593`) + `mockMarkAsPlanned` spy (`320, 365, 5593`) | exact |

## Pattern Assignments

### `functions/src/index.ts::sendScheduledReminders` (onSchedule daily cron)

**Analog:** `cleanupOrphanRendersHandler`/`cleanupOrphanRenders` (`functions/src/index.ts:729-817`); secondary `cleanupExpiredMedia` (`607-663`).

**Copy vs change:**
- **Wrapper + schedule string (`812-817`):** copy verbatim, retarget to a NEW slot — `export const sendScheduledReminders = onSchedule({ schedule: "every day 04:00", timeZone: "UTC" }, async () => { await sendScheduledRemindersHandler(); });`. 02:00/03:00 are taken (`659`, `813`); use **04:00** so the three daily sweeps never overlap (the exact rationale in the `703-704` comment).
- **Handler exported separately (`729`):** `export async function sendScheduledRemindersHandler(): Promise<...Summary>` — the "body exported from the wrapper for direct unit test" convention (mirrors `cleanupOrphanRendersHandler` and `parsePptxHandler`). REQUIRED so `index.test.ts` imports it by name.
- **collectionGroup scan (`740-743`):** copy the `getFirestore().collectionGroup("pptxRenders").where("status","in",[...]).get()` shape → `collectionGroup("services").where("status","in",["planned","exported"]).get()`. **Never `draft`** (SC4). The lookahead window (~30 days) and the `service.date - effectiveN === today` check are done **in code**, not in the query (N varies per org/service — ARCHITECTURE `429-437`).
- **Parent-chain org recovery (`750-756`):** copy `const orgId = renderDoc.ref.parent.parent?.id; if (!orgId) { console.error(...); continue; }` verbatim — a service doc's parent chain gives the org id the same way.
- **Per-item try/catch (`781-799`):** copy the "one failure never aborts the run" tolerance — each candidate's enqueue+markSent wrapped so a bad service is logged and skipped.
- **Summary object + `console.log` (`802-809`):** mirror the `{ scannedCount, ... }` return for test assertions.

**Handler body (per candidate, ARCHITECTURE `435-448` + CONTEXT `67-86`):**
1. `effectiveReminderEnabled = service.messaging?.reminderEnabled ?? org.settings.messaging.reminderEnabled`; `effectiveN = service.messaging?.reminderDaysBefore ?? org.settings.messaging.reminderDaysBefore ?? 7`.
2. Skip if org `settings.messaging.enabled !== true` (kill-switch, same `=== true` fail-closed read the enqueue handler uses at `1025-1027`) or `effectiveReminderEnabled` off.
3. **Timezone (R133):** compute "today" in `org.settings.timezone` via `new Intl.DateTimeFormat('en-CA',{ timeZone }).format(now)` → `Y-M-D`; fire when `service.date` minus `effectiveN` days equals that string. **No new package** (CONTEXT `75-80`).
4. **Idempotency:** skip if `service.messaging?.reminderSentAt` is set; after enqueue, set `messaging.reminderSentAt` on the service doc via Admin SDK dot-path.
5. Enqueue via `createQueuedMessage({ type:'reminder', ... })` → `services/{id}/messages/{}.set(...)` (same write as `1037-1054`).

**TRAPS:**
- **`reminderSentAt` is Admin-SDK-only.** The cron writes it via `getFirestore()...update({ 'messaging.reminderSentAt': FieldValue.serverTimestamp() })`, which bypasses `firestore.rules` — the client `setServiceMessagingDefaults` (`services.ts:505-528`) deliberately does NOT write it (Phase 58 rules deny client writes to it) and is R036-guarded to draft. The cron MUST fire on a **locked** service, so it relies on the Admin-SDK rules bypass (ARCHITECTURE `226-232`).
- **Kill-switch read is fail-closed:** absent `settings.messaging.enabled` = OFF (`=== true`, mirror `1025-1027`).
- The MESSAGE_FROM_ADDRESS/SERVICE_SHARE_BASE_URL config already exist (`1084-1094`); the cron enqueues only and holds **no secret** — `sendQueuedMessage` sends (CONTEXT `154`). Add NO `secrets:` array to this wrapper.

---

### `functions/src/index.ts` — `MessageType` + `'lock-notification'` extension

**Analog:** the existing definition and its single validation gate:
```typescript
// functions/src/index.ts:832
export type MessageType = "oneoff" | "reminder" | "share-link";
// :834
const MESSAGE_TYPES: readonly MessageType[] = ["oneoff", "reminder", "share-link"];
// :987 (inside queueServiceMessageHandler)
if (!MESSAGE_TYPES.includes(type)) {
  throw new HttpsError("invalid-argument", `Unknown message type "${type}".`);
}
```

**Copy vs change:** add `"lock-notification"` to BOTH the union (`832`) AND the `MESSAGE_TYPES` array (`834`). Change nothing at the gate (`987`) — it reads the array, so the new type is accepted automatically. `createQueuedMessage` (`921`) and `QueuedMessageDoc.type` (`893`) are typed off `MessageType`, so both pick it up with zero further edits. (Phase 62 later adds `"relock-notification"` the same way.)

**TRAP — the validation gate is the whole reason this edit exists:** the client `queueServiceMessage` call for a lock email carries `type:'lock-notification'`; without the array entry, `queueServiceMessageHandler` rejects it at `987` with `invalid-argument` BEFORE any write. The `sendQueuedMessage` trigger renders/sends for any type already (no trigger change — CONTEXT `33-34`).

---

### cron's `createQueuedMessage()` reuse + scheduled-message dispatch

**Analog (doc shaper):** `createQueuedMessage` (`functions/src/index.ts:921-937`) — the single pure `messages/{id}` shaper. **Analog (write site):** `queueServiceMessageHandler`'s enqueue (`1037-1054`):
```typescript
const messageRef = orgRef.collection("services").doc(serviceId).collection("messages").doc();
await messageRef.set(createQueuedMessage({ orgId, serviceId, type, subject, body,
  recipientSelector, options, scheduledFor: normalizedScheduledFor, requestedByUid }));
```
**Analog (trigger):** `sendQueuedMessage` = `onDocumentCreated` on `.../messages/{messageId}` (`1064+`).

**Copy vs change:** the cron builds its reminder doc with the SAME `createQueuedMessage({ type:'reminder', scheduledFor:null, requestedByUid:'system' })` call and the SAME `.collection('messages').doc()` + `.set()`, so a cron-created message is indistinguishable from a human one at the trigger (ARCHITECTURE `442-447`). `requestedByUid` must be a non-empty sentinel (e.g. `"system"`) since there is no caller uid.

**LOAD-BEARING TRAP — scheduled-message dispatch (`onDocumentCreated` won't refire on update):** `sendQueuedMessage` fires on document **create**, not update. The CONTEXT deferral asks the cron to also dispatch user-scheduled messages (`collectionGroup('messages').where('status','==','scheduled').where('scheduledFor','<=',now)`). **Flipping an existing `scheduled` doc to `queued` will NOT re-fire the create trigger** (CONTEXT `87-95`). Two clean options — the planner must pick one and state it:
- (A) Preferred: the cron **creates a fresh `queued` message doc** from the scheduled one via `createQueuedMessage` (a genuine create → trigger fires), then marks the original `scheduled` doc `dispatched`/`sent`. Reuses the exact shaper; no trigger change.
- (B) Widen the trigger to `onDocumentWritten` and guard on a `queued`-transition — larger blast radius on the one Function that holds `RESEND_API_KEY`; requires re-proving idempotency (the `runTransaction` `queued→sending` claim already exists in `sendQueuedMessageHandler`).
Recommend (A). If it materially grows the phase it may be split to its own plan (CONTEXT `95`).

---

### `functions/src/index.test.ts` (cron describe blocks)

**Analog:** the `cleanupOrphanRendersHandler` describe block and its collectionGroup fake (`functions/src/index.test.ts:754-808`):
```typescript
// :792 mockOrphanDb — a fake collectionGroup(name).where('status','in',[...]).get() chain
const whereSpy = vi.fn((field, op, values) => ({
  get: vi.fn(async () => ({ docs: field === "status" && op === "in"
    ? allDocs.filter((d) => values.includes(d.data().status)) : allDocs })) }));
const collectionGroupSpy = vi.fn((name) => { if (name !== "pptxRenders") throw ...; return { where: whereSpy }; });
vi.mocked(getFirestore).mockReturnValue({ collectionGroup: collectionGroupSpy } as never);
```
plus the module-scope `getFirestore: vi.fn()` mock (`66`), the `import { cleanupOrphanRendersHandler } from ...` (`10-11`), and `vi.mocked(getFirestore).mockReset()` in `afterEach` (`827-831`).

**Copy vs change:**
- Copy `mockOrphanDb` → `mockServicesDb` retargeted to `collectionGroup("services")` filtering `status in ['planned','exported']`; each fake doc carries `date`, `messaging`, and a parent chain resolving `orgId` (mirror `fakeOrphanDoc`'s `ref.parent.parent.id`) plus the org doc's `settings.messaging`/`settings.timezone`.
- Import `sendScheduledRemindersHandler` by name (the reason it must be exported).
- **Add `vi.useFakeTimers()` + `vi.setSystemTime(FIXED_NOW)`** to pin "today" — the timezone date boundary is the load-bearing case. Note: `src/views/__tests__/ServiceEditorView.test.ts` uses fake timers already; the Functions suite pins via `Date.now` in the cleanup handlers (`612`, `734`), so setSystemTime is the analog for those too.

**Required cases (CONTEXT `62-86`, SC4):**
1. Fires when `service.date - effectiveN === today` in the org timezone (assert a `messages` doc `.set` with `type:'reminder'` + `reminderSentAt` written).
2. Skips a `draft` service (proven by the `where('status','in',['planned','exported'])` filter, exactly as the orphan test proves a `ready` doc is never returned — `788-790`).
3. Idempotent: a service with `messaging.reminderSentAt` already set enqueues nothing; a second run never double-sends.
4. Org-timezone DATE boundary: same UTC instant, two orgs in different IANA zones fire on different calendar days.

---

### `firestore.indexes.json` — cron collection-group indexes (deploy-gated)

**Analog:** the Phase 60 add — a **`fieldOverrides`** entry, NOT a composite `indexes[]` entry (`firestore.indexes.json:3-14`):
```json
{ "collectionGroup": "recipients", "fieldPath": "providerMessageId",
  "indexes": [ { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" } ] }
```
Note the file's `"indexes": []` is currently **empty** — Phase 60 needed only a single-field collection-group override.

**Copy vs change (PARTIAL — shape differs):**
- `sendScheduledReminders`' `collectionGroup('services').where('status','in',[...])` is a single-field collection-group query → a **`fieldOverrides`** entry for `services.status` COLLECTION_GROUP (mirror the Phase 60 shape exactly).
- The scheduled-message sweep `collectionGroup('messages').where('status','==',x).where('scheduledFor','<=',now)` is **two fields** → this needs a **composite `indexes[]`** entry (`collectionGroup:'messages'`, `queryScope:'COLLECTION_GROUP'`, fields `status ASC` + `scheduledFor ASC`) — a shape the current file has NO precedent for (`indexes` is empty). Confirm exact field order in research; ship deploy-gated with `firebase deploy --only firestore:indexes` (CONTEXT `97-101`).

**TRAP:** if dispatch option (A) is chosen and the cron reads scheduled messages via the same daily pass, the composite index is required or the query throws `FAILED_PRECONDITION` at runtime. If (A) is deferred to its own plan, only the single-field `services.status` override is needed this plan.

---

### Lock hook — `lockSnapshots/current` write + auto lock-notification enqueue

**Analogs (four, all exact):**
- **Lock flow to hook:** `services.ts::markAsPlanned` (`346-354`) — draft-guard + `updateDoc(status:'planned')`; and its caller `ServiceEditorView.vue::onMarkAsPlanned` (`2757-2823`), which `await serviceStore.markAsPlanned(...)` (`2778`) then `applyTransitionLocally('planned')` (`2779`), with a "bump AFTER the transition lands, own try/catch, NOT re-raised" side-effect pattern (`2800-2804`) — the exact shape a fire-after-lock notify should copy.
- **Snapshot payload:** `buildServiceSnapshot(service)` (`services.ts:104-154`) — client-available, PII-guarded; reused verbatim for `lockSnapshots/current.snapshot` (ARCHITECTURE `191-198`).
- **Nested-doc write:** `writeSharePayload::setDoc(doc(db, 'shareTokens', token), { serviceSnapshot, createdAt: serverTimestamp(), ... })` (`services.ts:576-585`) — the setDoc-with-snapshot idiom. For a nested subcollection doc use `setDoc(doc(db, 'organizations', orgId, 'services', id, 'lockSnapshots', 'current'), { snapshot: buildServiceSnapshot(service), slideGroupsFingerprint, lockedAt: serverTimestamp(), lockedByUid })`.
- **Client callable enqueue:** `MessageComposer.vue::onSend` (`565-604`) —
  ```typescript
  const queueServiceMessage = httpsCallable<QueueMessageRequest, { messageId: string }>(functions, 'queueServiceMessage')
  const result = await queueServiceMessage({ orgId, serviceId, type, subject, body,
    recipientSelector: { teams, individualPersonIds, includeEveryone }, options, scheduledFor })
  ```
  Copy this call site verbatim with `type:'lock-notification'`, `recipientSelector:{ teams:[], individualPersonIds:[], includeEveryone:true }`, `options:{ attachServiceLink:true, sendCopyToSelf:false }`, `scheduledFor:null`, and a lock-template subject/body.

**Placement / copy vs change:**
- **Recommend a new store action** (e.g. `lockAndMaybeNotify` or extend `markAsPlanned`) OR do the two side-effects in `onMarkAsPlanned` right after `markAsPlanned` resolves (`2778`) — the same "after the transition lands, own try/catch, not re-raised" discipline as the `bumpScheduledSongsLastUsed` block (`2800-2804`) so a notify failure never falsely reports the lock failed.
- **First-lock detection:** BEFORE writing `lockSnapshots/current`, read whether it already exists (`getDoc(doc(..., 'lockSnapshots', 'current'))`). Enqueue the lock-notification ONLY when no prior snapshot existed (ARCHITECTURE `547-551`, CONTEXT `55-57`). Always write/overwrite the snapshot regardless (Phase 62 diffs against it).
- **Gates:** enqueue only when `isMessagingEnabled()` (`src/utils/messaging.ts`) is true AND `service.messaging?.lockNotifyEnabled ?? org.settings.messaging.lockNotifyDefault` resolves ON (CONTEXT `44-54`).

**TRAPS:**
- **Never sends on draft / while off:** guaranteed because the enqueue sits only on the draft→locked path behind the two gates; the server `queueServiceMessage` ALSO re-checks the kill-switch at `1024-1033` (defense in depth).
- **First-lock only:** a re-lock (snapshot already exists) does NOT auto-send here — that's Phase 62's diff-prompt. Read-before-write ordering is load-bearing: check existence, then overwrite.
- The `lockSnapshots` write rule (`isOrgEditor`) and `messages` create rule (`isOrgEditor`) already shipped in Phase 58 — no new client-facing rule this phase.

---

### Lock-time feedback toast

**Analog:** `src/stores/toasts.ts::push(message)` (`24-29`) as consumed by `MessageComposer.vue` (`592-596`):
```typescript
toasts.push(`Message queued to ${reachableCount.value} ${reachableCount.value === 1 ? 'person' : 'people'}`)
```
**Copy vs change:** import `useToasts`, call `toasts.push('Notified N assigned volunteers')` after a first-lock enqueue succeeds (the callable returns `{ messageId }`; recipient count is the client `resolveRecipients` reachable count, same source MessageComposer uses).

**TRAP:** the toast store is deliberately failure/notice-only, single-message, no variants (`9-20`). Do NOT add a success variant/category — just push a plain string. Fire it only when a message was actually enqueued (messaging on + first lock + default ON); a silent lock (off/re-lock) shows nothing.

---

### Lock-hook test

**Analog:** the R036/R037 lifecycle-transitions describe block in `src/views/__tests__/ServiceEditorView.test.ts` (`5464-5593`), specifically the happy-path lock assertion at `5593`:
```typescript
expect(mockMarkAsPlanned).toHaveBeenCalledWith('service-1')
```
plus the `mockMarkAsPlanned` store spy wiring (`320`, injected into the mocked store at `365`, cleared/impl in `beforeEach` `5506-5507`, reject-path `5743`).

**Copy vs change:**
- Reuse `mountView()` (`5465-5492`) and the `mockMarkAsPlanned` spy. Add a `mockHttpsCallable` seam (the pattern already exists in `MessageComposer.test.ts:22` and `PptxImportModal.test.ts:38`) to assert the lock-notification callable fires with `type:'lock-notification'` + `includeEveryone:true`.
- **Add** a `getDoc`/`setDoc` firestore seam (or a store-action spy if the write is moved into the store) to assert `lockSnapshots/current` is written on lock.

**Required cases:**
1. First lock (no prior snapshot), messaging ON, default ON → `lockSnapshots/current` written AND callable fired with `type:'lock-notification'` AND toast pushed.
2. First lock, messaging OFF (or default OFF) → snapshot written, callable NOT fired (`expect(mockHttpsCallable).not.toHaveBeenCalled()`), no toast.
3. Re-lock (prior snapshot exists) → snapshot overwritten, callable NOT fired (first-lock-only).
4. Lock rejected (mirror `5743` reject impl) → neither snapshot nor callable, OLD status retained (existing no-optimistic-flip contract).

## Shared Patterns

### Handler body exported separately from the Function wrapper
**Source:** `cleanupOrphanRendersHandler`/`cleanupOrphanRenders` (`729-817`), `parsePptxHandler`, `sendQueuedMessageHandler`.
**Apply to:** `sendScheduledRemindersHandler` — export it; the `onSchedule` wrapper is a one-liner. REQUIRED for the unit test to import by name.

### One canonical `messages` doc shaper, one send code path
**Source:** `createQueuedMessage` (`921-937`) used by `queueServiceMessageHandler` (`1043`); `sendQueuedMessage` `onDocumentCreated` trigger.
**Apply to:** the cron and the lock enqueue — both terminate in the SAME `createQueuedMessage`→`messages/{id}`→`sendQueuedMessage` path. Only `sendQueuedMessage` holds `RESEND_API_KEY`; nothing else gets a `secrets:` array.

### Fail-closed kill-switch read
**Source:** `queueServiceMessageHandler` (`1024-1033`, `settings?.messaging?.enabled === true`).
**Apply to:** the cron's per-org skip AND the client lock gate (`isMessagingEnabled()`). Absent = OFF.

### Side-effect after the lifecycle transition lands, own try/catch, not re-raised
**Source:** `onMarkAsPlanned`'s `bumpScheduledSongsLastUsed` block (`ServiceEditorView.vue:2800-2804`).
**Apply to:** the lock-notification enqueue + toast — run after `markAsPlanned` resolves; a notify failure must never surface as "lock failed."

### Scoped nested-doc / dot-path write bypassing `updateService`'s R036 funnel
**Source:** `setRoleOverride`/`setServiceMessagingDefaults` (`services.ts:442-528`); `writeSharePayload::setDoc` (`576-585`).
**Apply to:** `lockSnapshots/current` client write (setDoc on the nested path) and the cron's Admin-SDK `messaging.reminderSentAt` update (dot-path, rules-bypassing).

## No Analog Found

None. Every unit maps to a clean in-repo analog. Two units graft a NEW sub-behavior onto an existing analog (flagged inline, not unmapped):
- **Scheduled-message dispatch** — the queue-then-trigger analog exists, but `sendQueuedMessage` is `onDocumentCreated` and will NOT refire on a status flip; the create-a-fresh-doc (or widen-trigger) resolution is new wiring (CONTEXT `87-95`).
- **`messages` composite index** — `firestore.indexes.json` has a single-field `fieldOverrides` precedent but an empty `indexes[]`; the two-field `status`+`scheduledFor` composite is a new shape (only needed if the dispatch sweep ships in this plan).

## Metadata

**Analog search scope:** `functions/src/index.ts` (`600-1140` cron/enqueue/trigger, `832-834`/`987` type gate), `functions/src/index.test.ts` (`1-70` mock scaffold, `754-808` orphan cron test), `firestore.indexes.json` (full), `src/stores/services.ts` (`100-154`, `340-534`, `576-585`), `src/views/ServiceEditorView.vue::onMarkAsPlanned` (`2745-2823`), `src/views/__tests__/ServiceEditorView.test.ts` (`320-365`, `5395-5593`, grep `mockMarkAsPlanned`), `src/components/MessageComposer.vue` (`565-604`), `src/stores/toasts.ts` (full), `.planning/research/ARCHITECTURE.md` §Scheduling / §Data Model / §Build Order D+E, `60-PATTERNS.md` (template).
**Files scanned:** 8 source/test/config files + 2 planning docs.
**Pattern extraction date:** 2026-08-14
