# Phase 59: Messages Composer & Send Path - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11 (0 with no clean analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `functions/src/index.ts::queueServiceMessage` (+ handler) | function (onCall) | request-response / enqueue | same file, `parsePptxHandler`/`parsePptx` (272-338) | exact |
| `functions/src/index.ts::sendQueuedMessage` (+ handler) | function (onDocumentCreated) | event-driven / batch | same file, `requestPptxRenderHandler`/`requestPptxRender` (392-518) | exact |
| `functions/src/index.ts::RESEND_API_KEY` secret | config | — | same file, `CLAUDE_API_KEY`/`ESV_API_KEY`/`NLT_API_KEY` `defineSecret` (18-20) | exact |
| `functions/src/index.ts::createQueuedMessage()` doc-builder helper | utility | transform | `functions/src/index.ts::pptxRenderDocRef` + `PptxRenderDoc` (230-245); shape/purity: `src/stores/services.ts::buildServiceSnapshot` (104-154) | role-match |
| `functions/src/index.test.ts` (2 new describe blocks) | test | — | same file, `parsePptxHandler`/`requestPptxRenderHandler` blocks + `vi.mock` seams (1-67) | exact |
| `functions/src/serviceRoles.ts` (Admin-SDK port of resolver) | utility | transform | `src/utils/serviceRoles.ts::resolveServiceRoleAssignments` (33-56) — DUPLICATED, not imported | exact (via copy) |
| `src/components/MessageComposer.vue` (new) | component | request-response | `src/components/PptxImportModal.vue` (whole modal shell) | exact |
| `src/views/serviceEditorActionBar.ts` (✉ item + ctx field) | component | — | same file, `buildShareItem`/`buildServiceOrderItems` (209-254) | exact |
| `src/views/ServiceEditorView.vue` (mount composer + thread ctx) | component | — | same file, `activeActionItems` computed (2258-2263) + `<SlidesTab>`/modal mounts | exact |
| client `queueServiceMessage` callable wrapper (in composer) | service | request-response | `PptxImportModal.vue` `httpsCallable(...,'parsePptx')` (213-322) | exact |
| `src/components/__tests__/MessageComposer.test.ts` (new) | test | — | `src/components/__tests__/PptxImportModal.test.ts` (mount + Teleport `body()` + emit asserts) | exact |
| token-render + "Reaches N" client logic (inside composer) | utility | transform | `src/utils/messagingRecipients.ts::resolveRecipients` (52-83) + `src/stores/services.ts::buildServiceSnapshot` (104-154) | exact (reuse verbatim) |

## Pattern Assignments

### `functions/src/index.ts::queueServiceMessage` (onCall enqueue)

**Analog:** `parsePptxHandler` (272-333) + `parsePptx` wrapper (335-338)

**Copy verbatim:**
- The **handler-body-exported-separately-from-the-wrapper** split (`export async function ...Handler(request: CallableRequest<T>)` at 272-274, then `export const queueServiceMessage = onCall({...}, queueServiceMessageHandler)` mirroring 335-338). This is what makes it unit-testable without the Functions harness.
- The **auth guard** (275-277): `if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.")`.
- The **required-args validation** (279-285): destructure `request.data ?? {}`, throw `invalid-argument` on any missing field.
- The **independent org-membership re-check** (292-302) — the load-bearing precedent. Copy exactly: read `organizations/{orgId}/members/{request.auth.uid}`, `throw new HttpsError("permission-denied", ...)` if `!memberDoc.exists`. **Never trust the client-declared `orgId`.**

**Change / add (no analog — new logic this phase):**
- After the membership check, **re-read the org kill-switch server-side** (`organizations/{orgId}.settings.messaging.enabled`) and throw `permission-denied` (or `failed-precondition`) if off. The UI gate (#0) is convenience only; this is the security boundary (UI-SPEC "Kill-switch defense in depth", 327-330). No existing Function reads `settings.messaging` — model the read on the `memberDoc.get()` shape at 294-299.
- Validate `scheduledFor` is not absurd (past / implausibly far future) → `invalid-argument`.
- Write ONE `messages/{id}` doc via the shared `createQueuedMessage()` helper (below), return `{ messageId }`.

**Trap:** Do **NOT** bind `RESEND_API_KEY` to this Function — only `sendQueuedMessage` gets it (CONTEXT 42-43; R131 "smallest review surface"). The `onCall({...}, ...)` options object here carries NO `secrets:` array.

---

### `functions/src/index.ts::sendQueuedMessage` (onDocumentCreated trigger)

**Analog:** `requestPptxRenderHandler` (392-508) + `requestPptxRender` wrapper (510-518)

**Copy verbatim:**
- The **exported-handler + thin `onDocumentCreated` wrapper** split (510-518): the wrapper destructures `event.params` and awaits the handler; the handler takes a plain `{ orgId, serviceId, messageId }` params object (mirrors 392-396). Path string form: `"organizations/{orgId}/services/{serviceId}/messages/{messageId}"` (mirror 511's single-string path).
- The **doc-load + missing-doc early return** idiom (399-403): `const doc = await docRef.get(); if (!doc.exists) { console.error(...); return {...} }`.
- The **write-status-back-with-`{ merge: true }` + `updatedAt: FieldValue.serverTimestamp()`** idiom used on every outcome branch (413-417, 432-436, 497-505).
- The **secret-bound wrapper**: `export const sendQueuedMessage = onDocumentCreated({ document: "...", secrets: [RESEND_API_KEY] }, async (event) => {...})`. The `secrets:` binding pattern is the `api` handler's `{ secrets: [CLAUDE_API_KEY, ...] }` at line 120 (onDocumentCreated at 510 currently takes a bare string path — here it needs the options-object form to attach the secret).

**Change / add (new logic, no verbatim analog):**
- **Idempotency claim via Firestore transaction** (CONTEXT 58-63, success criterion 4): read `messages/{id}.status`, flip `queued → sending` only inside a `getFirestore().runTransaction(...)`; bail if status is anything else. This defends the **retried at-least-once trigger** the same way `requestPptxRender` faces re-fire — but `requestPptxRender` uses no transaction (it is naturally idempotent-by-recount), so the transaction shape itself has **no local analog**; write it fresh. A `scheduled` doc never satisfies `=== 'queued'`, so Phase 61's cron owns it.
- **Re-resolve recipients from scratch** via the Admin-SDK port (`functions/src/serviceRoles.ts`, below) — never trust the doc's `recipientSelector` as a final list (Anti-Pattern 1; the client list was an estimate).
- **Per-recipient token render** personalizing `{{their_roles}}` (R139).
- **Call Resend once per recipient** (mocked in tests); pass `{ orgId, serviceId, messageId, recipientId }` as Resend metadata/tags (Phase 60 webhook addressing).
- Write one `recipients/{id}` doc per recipient, roll up `deliveryCounts`, flip `messages/{id}.status` to `sent | partial | failed`. The per-item try/catch tolerance mirrors `cleanupExpiredMediaHandler`'s per-file `try/catch` (606-613) — one failed send must not abort the batch.

---

### `functions/src/index.ts::RESEND_API_KEY` secret

**Analog:** `defineSecret` block (18-20):
```typescript
const CLAUDE_API_KEY = defineSecret("CLAUDE_API_KEY");
const ESV_API_KEY = defineSecret("ESV_API_KEY");
const NLT_API_KEY = defineSecret("NLT_API_KEY");
```
Add `const RESEND_API_KEY = defineSecret("RESEND_API_KEY");` alongside them, and extend the set-once doc-comment (13-17) with `firebase functions:secrets:set RESEND_API_KEY`. Bind it ONLY in `sendQueuedMessage`'s options `secrets: [RESEND_API_KEY]` (mirror the `api` handler's binding at 120). It is read via `RESEND_API_KEY.value()` inside the handler, exactly as `CLAUDE_API_KEY.value()` at 174.

**Trap:** This secret is **undeployed** this phase (CONTEXT 38-40) — the send Function ships built + tested + UNDEPLOYED. The tests mock `defineSecret` (see below), so `.value()` returns a fake, mirroring `PPTX_RENDER_SERVICE_URL`'s "empty default is a tested behaviour, not a placeholder" stance (348-351).

---

### `functions/src/index.ts::createQueuedMessage()` doc-builder helper

**Analog (path/ref builder + typed doc interface):** `pptxRenderDocRef` (239-245) + `PptxRenderDoc` interface (232-237) — the codebase's pattern for "one canonical doc-shape/path builder so the callable and the trigger cannot drift" (see the 220-228 comment rationale, which is *exactly* this helper's stated purpose: shared between the callable now and the cron later).

**Analog (field-assembly / pure-shaping):** `buildServiceSnapshot` (104-154) — a pure function that assembles a typed doc object from domain inputs with no side effects.

**Shape to build:** a `createQueuedMessage(input): QueuedMessageDoc` returning the CONTEXT §Data Model shape (114-115): `{ type, status, subject, body, recipientSelector, options, changeDiff: null, scheduledFor, requestedByUid, createdAt, sentAt: null, deliveryCounts }`. Use `FieldValue.serverTimestamp()` for `createdAt` (mirror 318). Status is `'queued'` for send-now, `'scheduled'` when `scheduledFor` is set (CONTEXT 104-108).

**Trap:** Firestore rejects `undefined` — only include optional keys when present (the `...(x !== undefined && { x })` idiom, PptxImportModal.vue 336/345). Location is implementer discretion (CONTEXT 123-127); co-locating in `index.ts` near the message Functions matches how `pptxRenderDocRef` sits beside its consumers.

---

### `functions/src/index.test.ts` (2 new describe blocks)

**Analog:** the whole file's mock scaffold (1-67) + the `parsePptxHandler` / `requestPptxRenderHandler` describe blocks.

**Copy verbatim:**
- The module-neutralizing `vi.mock` seams (33-58): `firebase-admin/app`, `firebase-admin/auth`, `firebase-admin/firestore` (note `FieldValue.serverTimestamp` sentinel at 42), `firebase-admin/storage`, `firebase-functions/params` (**`defineSecret: vi.fn(() => ({ value: () => "fake-secret" }))`** at 48 — this is the RESEND-secret mock seam; no new mock needed, `RESEND_API_KEY.value()` will return `"fake-secret"`), and `firebase-functions/v2/firestore` `onDocumentCreated` returning the handler (52).
- Import the two new handler bodies by name from `./index` (extend the import at 7-20), exactly as `parsePptxHandler`/`requestPptxRenderHandler` are imported (18-19) — this is why the handlers must be `export`ed separately.

**Add — the `resend` mock seam (implementer discretion, CONTEXT 123-127):** mirror the `vi.mock("./renderInvoker", () => ({ invokeRenderService: vi.fn() }))` seam (65-67). Either `vi.mock('resend', () => ({ Resend: vi.fn(() => ({ emails: { send: mockSend } })) }))` OR dependency-inject the sender. The DI route matches `invokeRenderService` being a separately-mockable module; the `vi.mock('resend')` route matches PptxImportModal.test's wholesale-module-replacement (15-25) — either is idiomatic here.

**Trap:** the CLAUDE.md testing note — `functions/` runs its OWN vitest is NOT true (that is `render-service/`); `functions/src/*.test.ts` run under the functions package. Follow the exact mock-everything-at-module-scope discipline (comment 29-32) so importing `./index` never touches real Firebase.

---

### `functions/src/serviceRoles.ts` (Admin-SDK recipient re-resolution)

**Analog:** `src/utils/serviceRoles.ts::resolveServiceRoleAssignments` (33-56) + `findQuarterForDate` (24-26).

**Copy vs change — DUPLICATE, do not import.** `functions/tsconfig.json` sets `"include": ["src"]` and there are **zero `../src` imports anywhere in `functions/src/`** (verified — `pptxParser.ts` is itself a functions-local duplicate of client parsing). The `@/` alias resolves to the client `src/` and is unavailable in the Functions build. So port the pure algorithm into a new `functions/src/serviceRoles.ts`:
- The resolver body (41-55: `override ?? quarter-scheduled ?? []`) is pure and copies verbatim.
- **Change the input source:** the client version takes already-loaded `Service`/`Quarter[]`/`Role[]` arrays; the Function must first LOAD them via Admin SDK (`getFirestore().collection('organizations').doc(orgId)...`), then feed them through the same pure resolver, then map person ids → email/name/roleNames from an Admin-loaded people collection (the `resolveRecipients` reachability split, messagingRecipients.ts 59-82, ported the same way).
- Re-declare the domain types locally (no `@/types` import available server-side) — same reason `PptxRenderDoc` is declared locally in `index.ts`.

**Trap:** keep the resolver PURE (types-only, no Firestore inside the resolve step) so it is unit-testable exactly like the client original — do the Firestore loading in the *caller* (`sendQueuedMessageHandler`), not inside the ported resolver.

---

### `src/components/MessageComposer.vue` (new)

**Analog:** `src/components/PptxImportModal.vue` (whole file) — the UI-SPEC (167-181) explicitly chose this shell.

**Copy verbatim:**
- The `<Teleport to="body">` + dual `<Transition>` (backdrop fade + modal opacity/scale) structure (2-31). Backdrop `bg-black/60 z-40`; container `fixed inset-0 z-50 flex items-center justify-center p-4`.
- The three-region flex shell (`shrink-0` header / `flex-1 overflow-y-auto` body / `shrink-0` footer) — header at 34-49, body at 52, footer at 172. **Change** `max-w-lg` → `max-w-2xl` (UI-SPEC 173, more form density).
- The icon-only ✕ close button verbatim (39-48), `aria-label="Close"`, inline SVG glyph.
- The footer button idioms: secondary `px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700` (176-181, → Cancel/Preview) and primary `...text-white bg-indigo-600 hover:bg-indigo-500 ... disabled:opacity-50 disabled:cursor-not-allowed` (193-202, → Send now/Schedule send).
- The `props`/`emit` + `watch(() => props.open, ...)` reset-on-open pattern (226-288): `defineProps<{ open, service, quarters, roles, people, orgId, ... }>()`, `emit<{ cancel: [], sent: [...] }>()`, `resetToIdle()`-style state reset when `open` flips true.
- The **in-flight button-local loading state** (step machine 246-247; footer buttons disabled while `step === 'uploading'|'parsing'|'confirming'`) → the composer's `Sending…`/`Scheduling…` disabled state (UI-SPEC 396).

**Change / add:** all the composer-specific body sub-components (SEND TO chips, Individuals panel, MESSAGE TYPE segmented control, Subject/Body + token palette, Sample preview, Options card) per UI-SPEC §Component Inventory. Chip idiom comes from `TeamTagPill.vue` (`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border`, cited UI-SPEC 197) — read it when building chips.

**Trap:** the ✕/backdrop/Escape all call one `onCancel` that no-ops while a send is in flight — copy the `onCancel` guard shape (444-447: `if (step is in-flight) return`).

---

### `src/views/serviceEditorActionBar.ts` (✉ Messages item)

**Analog:** `buildShareItem` (209-223) — an editor-gated item that returns `undefined` when the gate fails — and its wiring in `buildServiceOrderItems` (249-252).

**Copy vs change:**
- Add a `buildMessagesItem(ctx): ActionBarItem | undefined` modeled on `buildShareItem`: editor gate `if (!ctx.isEditor) return undefined` (210). Push it in `buildServiceOrderItems` **before Share** (UI-SPEC 149: "left of ⇱ Share, separated by the divider") — insert into the array at 249-252 ordering.
- Add `messagingEnabled: boolean` to `ActionBarContext` (65-105) as a **required** field, following the exact rationale the existing `aiEnabled` (70-77) and `pcEnabled` (79-85) comments give ("Required, not optional, so the compiler forces every call site to supply it").
- **Gate decision (UI-SPEC 154-160): DISABLED, not hidden** when `!messagingEnabled` — so unlike `buildShareItem`'s hide-on-fail, return the item with `disabled: !ctx.messagingEnabled` + `title: "Turn on Messaging in Settings to email volunteers"`. This diverges from Share (which hides) and from the WR-01 AI "hide-don't-disable" rule (229-231) — the CONTEXT deliberately chose disabled+tooltip for discoverability. State this divergence in the item's doc-comment.

**Trap:** thread `messagingEnabled` through the `buildActionBarItems(...)` call in `ServiceEditorView.vue` (2258-2263 currently passes `aiEnabled: authStore.settings.aiEnabled`) — add `messagingEnabled: isMessagingEnabled()` (or `authStore.settings.messaging.enabled`). Missing it is a compile error by design.

---

### `src/views/ServiceEditorView.vue` (mount composer + thread context)

**Analog:** the `activeActionItems` computed (2258-2263) threading view state into `buildActionBarItems`, and the existing modal-mount pattern (`<ContextualActionBar>` import 1525, other component mounts).

**Copy vs change:**
- Add `import MessageComposer from '@/components/MessageComposer.vue'` and `import { isMessagingEnabled } from '@/utils/messaging'` alongside the existing component imports (1522-1526).
- Add the `messagingEnabled` field to the `buildActionBarItems` ctx object (2260-2263).
- Add a `messageComposerOpen` ref + wire the ✉ item's `onClick` handler (in the `handlers` object threaded via `ActionBarHandlers`, 57-64 — add `onMessages: () => { messageComposerOpen.value = true }`).
- Mount `<MessageComposer :open="messageComposerOpen" :service="localService" :quarters=... :roles=... :people=... @cancel="messageComposerOpen = false" @sent="..." />` near the other teleported modals.

---

### client `queueServiceMessage` callable wrapper (inside `MessageComposer.vue`)

**Analog:** `PptxImportModal.vue` 213-322 — `import { httpsCallable } from 'firebase/functions'` + `import { functions } from '@/firebase'` (213-214), then:
```typescript
const queueServiceMessage = httpsCallable<
  { orgId: string; serviceId: string; type: ...; subject: string; body: string;
    recipientSelector: RecipientSelection; options: ...; scheduledFor: string | null },
  { messageId: string }
>(functions, 'queueServiceMessage')
const result = await queueServiceMessage({ ... })
```
mirroring the `parsePptx` callable typing and invocation (314-322).

**Copy the error handling shape** (355-368): `try { ... } catch (err) { console.error('[MessageComposer] ...', err); errorMessage.value = FRIENDLY_ERROR; ... }`. UI-SPEC 344 specifies the copy: generic `Couldn't send this message. Please try again.` plus the kill-switch-rejection variant. On success emit + close + toast (UI-SPEC 313 — surface via existing `ToastHost`).

---

### `src/components/__tests__/MessageComposer.test.ts` (new)

**Analog:** `src/components/__tests__/PptxImportModal.test.ts` (1-75).

**Copy verbatim:**
- `mount` + `flushPromises` + `DOMWrapper` + `enableAutoUnmount(afterEach)` imports (2) and the **`body()` = `new DOMWrapper(document.body)` Teleport helper** (72-74) — mandatory because the composer teleports to body (same as PptxImportModal), so every query goes through `body()`.
- The **`vi.mock('firebase/functions', ...)` + `mockHttpsCallable`/`mockQueueServiceMessage`** seam (27-39) — assert the composer calls `queueServiceMessage` with `{ orgId, serviceId, recipientSelector, ... }` only (never raw email lists — recipients re-resolve server-side).
- `vi.mock('@/firebase', () => ({ functions: {} }))` (51-54).

**Add:** assert emitted actions (`cancel`, `sent`) via `wrapper.emitted()`; assert the disabled-Send states (zero reachable / both-empty / past scheduledFor) from UI-SPEC 316-326; assert the "Reaches N" pluralization backstop (UI-SPEC 401). Mock `@/utils/messagingRecipients` OR feed real fixtures (the resolver is pure — prefer real fixtures, matching serviceRoles.test discipline).

---

### token-render + "Reaches N" client logic (inside composer)

**Analog / reuse verbatim (do NOT reimplement):**
- `src/utils/messagingRecipients.ts::resolveRecipients` (52-83) + `MESSAGING_TEAM_LABELS` (17-22) — call `resolveRecipients(service, quarters, roles, people, selection)` on every selection change; `reachable.length` → "Reaches N", `unreachableCount` → the muted "· N have no email" note (UI-SPEC 286-290, 94-96). Selection shape is the exported `RecipientSelection` (30-34).
- `src/stores/services.ts::buildServiceSnapshot` (104-154) — the canonical PII-guarded serialization the `{{song_list}}` token and the share link build on (CONTEXT 144). Reuse for the sample-preview render (UI-SPEC 257-267); it already resolves ordered slots + role assignments as name-only (PII guard 129-141).

**Copy the pluralization discipline** from UI-SPEC 401 (0/1/many for both counts) — a UI-state test over the resolver output covers it (backstop).

**Trap:** the body stores the **raw token template**, never pre-rendered (CONTEXT 88-93; R139 requires per-recipient render at send time). The composer's preview is a labelled SAMPLE only — the authoritative per-person render happens in `sendQueuedMessage`, not here.

## Shared Patterns

### Queue-then-trigger: exported handler body + thin wrapper, secret on the trigger only
**Source:** `functions/src/index.ts` — `parsePptxHandler`/`parsePptx` (272-338) → `requestPptxRenderHandler`/`requestPptxRender` (392-518)
**Apply to:** `queueServiceMessage` (enqueue, NO secret) → `sendQueuedMessage` (trigger, HOLDS `RESEND_API_KEY`)
Export the handler body separately so tests invoke it with a fake `CallableRequest`/params object; the `onCall`/`onDocumentCreated` wrapper is a one-liner. Bind the secret only in the wrapper that needs it (`{ secrets: [RESEND_API_KEY] }`, line-120 shape).

### Server-side re-validation — never trust client-declared orgId or client lists
**Source:** `parsePptxHandler` independent membership re-check (292-302) + `requestPptxRenderHandler` independent recount (457-489)
**Apply to:** `queueServiceMessage` (re-check membership AND kill-switch), `sendQueuedMessage` (re-resolve recipients from scratch — the client selector is a *who-to-resolve* instruction, never a final email list; Anti-Pattern 1).

### Idempotency against at-least-once trigger re-fire
**Source (hazard precedent only):** `requestPptxRender`'s status-flip-with-merge (497-505) — same at-least-once delivery model
**Apply to:** `sendQueuedMessage` — but via a NEW Firestore `runTransaction` `queued → sending` claim (no verbatim analog; write fresh). A `scheduled` doc never satisfies `=== 'queued'`, leaving it for Phase 61's cron.

### Firestore mock-everything-at-module-scope test scaffold
**Source:** `functions/src/index.test.ts` (33-67)
**Apply to:** both new handler describe blocks. Reuse the existing `defineSecret` mock (48) for `RESEND_API_KEY`; add a `resend` seam mirroring the `./renderInvoker` seam (65-67).

### Teleport-modal component test via `body()` DOMWrapper
**Source:** `PptxImportModal.test.ts` (64-74) + `enableAutoUnmount(afterEach)` (70)
**Apply to:** `MessageComposer.test.ts` — every element query through `body()`; assert emitted `cancel`/`sent`.

### Pure `utils/` resolver reused as client estimate + server-side Admin-SDK port
**Source:** `src/utils/serviceRoles.ts` (client) — duplicated (never imported) into `functions/src/serviceRoles.ts`
**Apply to:** the recipient resolution used by the composer (`resolveRecipients`, client estimate) and by `sendQueuedMessage` (authoritative Admin-SDK re-resolve). `functions/tsconfig.json` `"include": ["src"]` + zero `../src` imports = duplication is the established convention (cf. `pptxParser.ts`).

## No Analog Found

None with **zero** analog. Two items carry a NEW sub-pattern grafted onto an existing structure (flagged inline, not unmapped):
- **`sendQueuedMessage`'s `runTransaction` idempotency claim** — the queue-then-trigger *structure* is `requestPptxRender`, but the transaction-based `queued → sending` claim itself has no verbatim precedent; write it fresh.
- **The server-side kill-switch re-read in `queueServiceMessage`** — no existing Function reads `settings.messaging`; model the Firestore read on `parsePptxHandler`'s `memberDoc.get()` (294-299), the logic is new.

## Metadata

**Analog search scope:** `functions/src/` (index.ts, index.test.ts, tsconfig), `src/components/` (PptxImportModal.vue + test), `src/views/` (ServiceEditorView.vue, serviceEditorActionBar.ts), `src/utils/` (serviceRoles.ts, messagingRecipients.ts, messaging.ts), `src/stores/services.ts`
**Files scanned:** `index.ts`, `index.test.ts`, `functions/tsconfig.json`, `PptxImportModal.vue`, `PptxImportModal.test.ts`, `serviceEditorActionBar.ts`, `ServiceEditorView.vue` (action-bar wiring), `serviceRoles.ts`, `messagingRecipients.ts`, `messaging.ts`, `services.ts::buildServiceSnapshot`, `58-PATTERNS.md` (template)
**Pattern extraction date:** 2026-08-14
