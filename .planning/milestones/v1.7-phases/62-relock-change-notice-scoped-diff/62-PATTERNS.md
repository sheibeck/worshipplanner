# Phase 62: Re-lock Change Notice — Scoped Diff - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 8 new/modified units
**Analogs found:** 7 / 8 (one unit — the slide-text string hash — has NO in-repo analog and is flagged fresh; every other unit maps to a clean analog, several already Phase-62-shaped by Phase 61's stubs)

## File Classification

| New/Modified unit | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/utils/serviceLockDiff.ts::diffServiceSnapshots` | utility (pure) | transform | `src/utils/messagingRecipients.ts` (purity contract) + `src/utils/serviceRoles.ts` (header/shape) + `ServiceSnapshot` input (`services.ts:80-95`) | exact |
| `src/utils/__tests__/serviceLockDiff.test.ts` | test | — | `src/utils/__tests__/messagingRecipients.test.ts` (plain-fixture pure test) | exact |
| `src/components/ReLockNotifyPrompt.vue` | component (modal) | request-response | `MessageComposer.vue` (shell + recipient chips + Reaches-N + `queueServiceMessage`) + `PptxImportModal.vue` (bare shell) | role-match (dedicated, checkable — not free-text) |
| `src/components/__tests__/ReLockNotifyPrompt.test.ts` | test | — | `src/components/__tests__/MessageComposer.test.ts` | exact |
| `functions/src/index.ts` — `'relock-notification'` + `changeDiff` widening | config/enum + type | validation gate | `'lock-notification'` add (`1212`/`1214-1219`) + `QueuedMessageDoc.changeDiff` (`1284`) + `createQueuedMessage` (`1306-1322`) + `QueueMessageRequest` (`1249-1259`) | exact |
| `ServiceEditorView.vue::onMarkAsPlanned` re-lock branch | view (lock hook) | request-response / nested-doc write | the Phase 61 hook, same function `2907-2988` (wasFirstLock, read-before-write, auto-enqueue) | exact (extend in place) |
| slide-text fingerprint helper (`serviceLockDiff.ts` or sibling) | utility (pure) | transform | **NONE** — no hash/digest/stable-stringify util exists; `SlideGroup.sourceSignature` (`slideGroup.ts:64`) is a conceptual precedent only | **NO ANALOG — fresh** |
| `ServiceEditorView.test.ts` re-lock lock-hook block | test | — | Phase 61 lock-hook block in `src/views/__tests__/ServiceEditorView.test.ts` (`mockMarkAsPlanned` + `mockHttpsCallable` + getDoc/setDoc seam) | exact |

## Pattern Assignments

### `src/utils/serviceLockDiff.ts::diffServiceSnapshots` (utility, pure transform)

**Analogs:**
- **Purity contract + file header:** `src/utils/messagingRecipients.ts:1-9` and `src/utils/serviceRoles.ts:1-4` — both open with a comment declaring "No Firestore/Pinia/store imports (types only)… same 'pure function in utils/' convention." Copy that header verbatim (name `serviceRoles.ts`/`messagingRecipients.ts` as siblings), import types only.
- **Function shape:** `resolveRecipients` (`messagingRecipients.ts:52-83`) — typed params in, plain typed array/record out, no I/O. Mirror the signature style: `export function diffServiceSnapshots(previous: ServiceSnapshot, current: ServiceSnapshot, prevFingerprint: Record<string,string>|null, currFingerprint: Record<string,string>|null): ChangeEntry[]`.
- **Input shape:** `ServiceSnapshot` (`src/stores/services.ts:80-95`) — `slots: ServiceSlot[]`, `notes: string`, `roleAssignments:{ roleId, roleName, group, personNames }[]`. This is exactly what the Phase 61 hook already writes to `lockSnapshots/current.snapshot` (`ServiceEditorView.vue:2931`).
- **Stable slot id:** `ServiceSlot.id` (`src/types/service.ts:47`) — the D-01 stable identity, explicitly documented "never array index or `position`, both of which a drag-reorder rewrites." SONG and ORDER detection MUST match slots by this `id`.
- **`affectedTeams` element type:** `RoleGroup` from `src/types/roster.ts` (imported by both analogs).

**Copy vs change:**
- Copy the pure-util skeleton from `messagingRecipients.ts`. Change the body to the ARCHITECTURE `559-565` detection table:
  - **SONG:** same-`id` slot whose `songId`/`songTitle` changed (`SongSlot` fields, `service.ts:67-68`) → broad.
  - **ORDER:** a slot `id` that moved index in the (already section-ordered — `buildServiceSnapshot` calls `orderSlotsBySection`, `services.ts:111`) `slots` array without content change → broad.
  - **ROLE:** `roleAssignments[i].personNames` changed for a `roleId` → tag **exactly** `roleAssignments[i].group` (the one narrow tag).
  - **NOTES:** `notes` string changed → broad.
  - **SLIDES:** `prevFingerprint` vs `currFingerprint` map differs (any group added/removed/changed) → ONE coarse entry, broad.
- **Broad** = derive from the CURRENT snapshot's `roleAssignments`: the set of `group` values whose entry has `personNames.length > 0` (groups with ≥1 assigned person).

**TRAPS:**
- **Slots are already section-ordered in the snapshot** (`orderSlotsBySection`, `services.ts:111`) — do NOT re-sort; ORDER detection compares the persisted snapshot arrays as-is.
- **ROLE narrow vs everything-else broad** is R147's exact rule — a ROLE entry must NEVER fall back to broad.
- **Empty diff must be representable** (`[]`) — the hook branches on it (empty → silent overwrite, no prompt).
- `ChangeEntry` is a NEW exported type (`{ type:'SONG'|'ORDER'|'ROLE'|'NOTES'|'SLIDES'; description:string; affectedTeams:RoleGroup[] }`) — export it from this module; the modal, the hook, and the Functions `changeDiff` field all consume it.

---

### `src/utils/__tests__/serviceLockDiff.test.ts` (test)

**Analog:** `src/utils/__tests__/messagingRecipients.test.ts` — plain `ServiceSnapshot`/fixture objects passed straight into the pure function, zero Firestore/Pinia mocking. Copy its fixture-builder + `describe`/`it` structure.

**Copy vs change:** build two `ServiceSnapshot` literals per case; assert the returned `ChangeEntry[]`. Required cases: each of SONG/ORDER/ROLE/NOTES/SLIDES in isolation; ROLE tags exactly the changed role's group; broad = only groups with ≥1 assigned person; identical snapshots → `[]`; a moved-AND-changed slot classified deterministically; fingerprint null-vs-map and map-vs-map for SLIDES.

---

### `src/components/ReLockNotifyPrompt.vue` (dedicated modal — NOT the composer)

**Analogs:**
- **Modal shell:** `MessageComposer.vue:1-58` — `Teleport to="body"` + backdrop `Transition` + `role="dialog" aria-modal` panel + esc/close handlers. Copy the shell verbatim (or the leaner `PptxImportModal.vue` shell if the density is lower).
- **Team chips + labels:** `MessageComposer.vue:63-80` team-chip loop + `MESSAGING_TEAM_LABELS` import (`messagingRecipients.ts:17-22`).
- **Reaches-N:** `MessageComposer.vue` `resolved`/`reachableCount` computeds (`384-385`) feeding `data-testid="reaches-count"` (`234`). Copy this to show live reach for the chosen recipient set.
- **Send call:** `MessageComposer.vue:574-575` — `httpsCallable<QueueMessageRequest,{messageId}>(functions,'queueServiceMessage')` then invoke with the payload.

**Copy vs change (this is a DEDICATED modal, not `MessageComposer`):**
- REMOVE the free-text subject/body/type fields — the notice content IS the auto-generated diff. Replace the composer's message-body section with a **checkable list of `ChangeEntry` rows**: each row a checkbox + human `description` + its `affectedTeams` tags (rendered via `MESSAGING_TEAM_LABELS`).
- Recipient choice = **affected-teams (default: union of `affectedTeams` across CHECKED entries)** vs **everyone**. Feed the resulting `{ teams, individualPersonIds:[], includeEveryone }` into the same `resolveRecipients` computed for Reaches-N.
- **Send** → `queueServiceMessage({ type:'relock-notification', recipientSelector, changeDiff: <checked entries>, options:{ attachServiceLink:true, sendCopyToSelf:false }, subject/body auto-generated, scheduledFor:null })`.
- **Lock quietly** button — always present; emits confirm with no message.

**TRAPS:**
- **ROLE=narrow, others=broad** must survive into the recipient union: the default recipients are the union of affectedTeams across only the CHECKED rows, so unchecking a broad entry can narrow the send.
- The modal is opened ONLY on a non-empty diff (the hook decides); it never renders for a first lock or empty diff.
- `changeDiff` carries the CHECKED entries (audit of what was communicated), which may be a subset of the full diff.

---

### `src/components/__tests__/ReLockNotifyPrompt.test.ts` (test)

**Analog:** `src/components/__tests__/MessageComposer.test.ts` — its `mount` + `mockHttpsCallable` seam (the callable is mocked at module scope) + team-chip / reaches-count assertions. Copy the harness; assert: checkable rows render per ChangeEntry; default recipients = union of checked affectedTeams; unchecking narrows Reaches-N; Send fires the callable with `type:'relock-notification'` + `changeDiff` = checked entries; Lock-quietly emits confirm and fires NO callable.

---

### `functions/src/index.ts` — `'relock-notification'` type + `changeDiff` widening

**Analog (type add):** the 61-01 `'lock-notification'` add — the header comment at `1208-1211` already says *"Phase 62 will add 'relock-notification' the same way — append to BOTH the union and the MESSAGE_TYPES array."*
```typescript
// :1212
export type MessageType = "oneoff" | "reminder" | "share-link" | "lock-notification";
// :1214-1219
const MESSAGE_TYPES: readonly MessageType[] = [ "oneoff", "reminder", "share-link", "lock-notification" ];
```
**Copy vs change:** append `"relock-notification"` to BOTH `1212` (union) and the `1214-1219` array. The gate at `1372` (`if (!MESSAGE_TYPES.includes(type))`) reads the array, so the new type is accepted with zero gate edits.

**Analog (changeDiff field — ALREADY PRESENT as `null`):** the field EXISTS but is typed `null` and hard-coded `null`:
```typescript
// :1284  interface QueuedMessageDoc
changeDiff: null;
// :1315  createQueuedMessage() return
changeDiff: null,
```
**Copy vs change (widen, keep optional/nullable so other types are unaffected):**
- Widen `QueuedMessageDoc.changeDiff` (`1284`) from `null` to `ChangeEntry[] | null` (add a server-side `ChangeEntry` type mirroring the client one — Functions has its own type surface, do NOT import from `src/`).
- Add `changeDiff?: ChangeEntry[] | null` to `QueueMessageRequest` (`1249-1259`), destructure it in `queueServiceMessageHandler` (`1353-1362`).
- In `createQueuedMessage` (`1306-1322`) replace the hard-coded `changeDiff: null` (`1315`) with `input.changeDiff ?? null` — the same "absent leaf normalized to null, never undefined" discipline the comment at `1303-1304` already states (Firestore rejects `undefined`).

**TRAPS:**
- **Optional/nullable is load-bearing:** every other message type still writes `changeDiff: null` — widening the type must not require the field, so `oneoff`/`reminder`/`share-link`/`lock-notification` are byte-unchanged.
- This rides the already-UNDEPLOYED send Functions — **no new Function, no new secret, no `secrets:` array, no new index** (CONTEXT `35`, `104`).
- The gate at `1372` is the reason the type add matters: without the array entry, a `relock-notification` enqueue is rejected `invalid-argument` before any write.

---

### `ServiceEditorView.vue::onMarkAsPlanned` — re-lock branch (extend the Phase 61 hook)

**Analog:** the SAME function, Phase 61's lock side-effect block at `src/views/ServiceEditorView.vue:2907-2988` — already structured for Phase 62:
- **Read-before-write first-lock signal** (`2920-2925`): `const snapRef = doc(db,'organizations',orgId,'services',svc.id,'lockSnapshots','current'); const prior = await getDoc(snapRef); const wasFirstLock = !prior.exists()`.
- **Snapshot write** (`2930-2935`): `setDoc(snapRef, { snapshot: buildServiceSnapshot(svc), slideGroupsFingerprint: null, lockedAt: serverTimestamp(), lockedByUid })` — `buildServiceSnapshot` call site is `2931`; the `slideGroupsFingerprint: null` stub at `2932` is exactly what Phase 62 now COMPUTES.
- **First-lock auto-enqueue** (`2939-2982`): the `if (wasFirstLock)` branch — messaging-gate (`isMessagingEnabled() && effectiveLockNotify`, `2945`) + `resolveRecipients` (`2946`) + `queueServiceMessage` callable (`2962-2974`).
- **slideGroups source:** `slideGroupsStore = useSlideGroups()` (`1619`); `slideGroupsStore.groups` (the loaded `SlideGroup[]`) is the fingerprint input — each group's `slides` (`slideGroup.ts:65`) hold the ordered slide text.

**Copy vs change:**
- **Compute the fingerprint** (both first lock and re-lock) from `slideGroupsStore.groups`: a `{ [groupId]: hash-of-ordered-slide-text }` map. Replace the `slideGroupsFingerprint: null` at `2932` with the computed map. First-lock path is otherwise unchanged.
- **Read the PRIOR snapshot + fingerprint** from `prior.data()` BEFORE the `setDoc` (the `getDoc` at `2924` already runs first).
- **Restructure the branch:**
  - `wasFirstLock` → existing behavior (auto-enqueue `lock-notification`), now writing a real fingerprint.
  - **Re-lock** (`prior.exists()`): compute `diffServiceSnapshots(priorSnapshot, buildServiceSnapshot(svc), priorFp, currFp)`.
    - **Non-empty diff AND `isMessagingEnabled()`** → open `ReLockNotifyPrompt` (do NOT `setDoc` yet).
    - **Empty diff, OR messaging OFF** → `setDoc` the new snapshot+fingerprint silently, no prompt.
  - **On prompt confirm (send OR Lock-quietly)** → `setDoc` the new snapshot + fingerprint.

**TRAPS (load-bearing):**
- **Overwrite `lockSnapshots/current` ONLY on confirm for a re-lock.** The Phase 61 code writes on EVERY lock at `2930`; for the re-lock-with-prompt path this must move to the confirm handler — writing before the planner confirms destroys the diff basis (CONTEXT `81-83`, `147`). Keep the `setDoc` unconditional only on the first-lock and empty-diff/off paths.
- **Same non-re-raised discipline:** the whole block sits in its own `try/catch` (`2916`/`2984`) that never surfaces into `lifecycleError` — the lock already succeeded. The prompt + snapshot-overwrite are a non-blocking follow-up (mirrors the `bumpScheduledSongsLastUsed` block `2901-2905`).
- **Messaging OFF → NO prompt** — a re-lock with messaging off just overwrites the snapshot silently. Unlike the automatic first-lock send, the re-lock prompt is an explicit planner choice, but with nowhere to send there is no prompt (CONTEXT `97-100`).
- **Fingerprint reads already-loaded groups** — do NOT add a Firestore read; `slideGroupsStore.groups` is in memory in the editor. Do NOT push the fingerprint into `buildServiceSnapshot` (keep the share-link path untouched — ARCHITECTURE `578-588`).

---

### slide-text fingerprint helper — **NO CLEAN ANALOG (fresh)**

**Search performed:** grep `hash|fingerprint|digest|stableStringify` across `src/` returned only `ServiceEditorView.vue` + its test (the `slideGroupsFingerprint` stub literal) — **no string-hash / stable-stringify utility exists in the repo**. `SlideGroup.sourceSignature` (`src/types/slideGroup.ts:64`) is an *opaque per-group change-signature*, but it is a stored source-content marker written by the materializer, NOT a deterministic hash-of-ordered-slide-text and NOT re-derivable for diffing — it is a conceptual precedent only, not a copyable implementation.

**Recommendation:** write a tiny deterministic string hash fresh (e.g. FNV-1a / DJB2 over each group's ordered slide text — `LyricSlide.lines` (`slide.ts:81`), `ScriptureSlide.text` (`slide.ts:123`), `CongregationalSection.text` (`slide.ts:103`), joined in slide order). Keep it PURE and colocate in `serviceLockDiff.ts` (or a sibling `slideFingerprint.ts`) so it is unit-tested with the same plain-fixture harness. Output shape: `{ [groupId]: string }` (per-group granularity STORED so a future phase can say which group changed; v1.7 diff emits ONE coarse SLIDES entry).

**TRAP:** the hash must be **stable across runs/machines** (no `Math.random`, no object-key-order dependence) — sort/serialize deterministically. Empty/absent group → stable empty-hash, not `undefined`.

---

### `ServiceEditorView.test.ts` — re-lock lock-hook block (test)

**Analog:** the Phase 61 lock-hook describe block in `src/views/__tests__/ServiceEditorView.test.ts` — `mountView()` + `mockMarkAsPlanned` spy + the `mockHttpsCallable` seam + the `getDoc`/`setDoc` firestore seam (per 61-PATTERNS §Lock-hook test, `170-184`).

**Copy vs change / required cases (extends the Phase 61 cases):**
1. **First lock** (getDoc → not exists): snapshot written WITH a non-null fingerprint; `lock-notification` callable fires (unchanged Phase 61 behavior).
2. **Re-lock, non-empty diff, messaging ON:** `ReLockNotifyPrompt` opens; `lockSnapshots/current` is NOT overwritten until confirm; on confirm-send the callable fires with `type:'relock-notification'` + `changeDiff`; on Lock-quietly the snapshot IS overwritten and NO callable fires.
3. **Re-lock, empty diff:** snapshot silently overwritten, no prompt, no callable.
4. **Re-lock, messaging OFF:** snapshot silently overwritten, no prompt (even with a real diff).
5. **Lock rejected** (existing reject impl): neither snapshot nor prompt; old status retained.

**TRAP:** assert the **overwrite-timing** explicitly — a test that only checks "setDoc called" would pass even if the write happened before confirm. Assert setDoc is NOT called between opening the prompt and confirming.

## Shared Patterns

### Pure `utils/` transform, plain-fixture tested
**Source:** `messagingRecipients.ts` / `serviceRoles.ts` (header + signature), `messagingRecipients.test.ts`.
**Apply to:** `serviceLockDiff.ts` + the slide-fingerprint helper — types-only imports, no Firestore/Pinia, unit-tested with literal `ServiceSnapshot` fixtures.

### One canonical `messages` doc shaper, one send path
**Source:** `createQueuedMessage` (`functions/src/index.ts:1306-1322`) → `queueServiceMessage` → `sendQueuedMessage`.
**Apply to:** the re-lock notice terminates in the SAME path with `type:'relock-notification'` + `changeDiff`; `sendQueuedMessage` renders/sends unchanged, holds the only secret.

### Type enum add = union + array, gate unchanged
**Source:** the `'lock-notification'` add (`1212`/`1214-1219`), gate at `1372`.
**Apply to:** `'relock-notification'` — append to both, touch nothing else.

### Side-effect after the lifecycle transition lands, own try/catch, not re-raised
**Source:** `onMarkAsPlanned` bump block (`2901-2905`) and Phase 61 lock block (`2916-2988`).
**Apply to:** the re-lock diff + prompt + overwrite — non-blocking follow-up; a failure never reports "lock failed."

### Fail-closed messaging gate
**Source:** `isMessagingEnabled()` gate (`ServiceEditorView.vue:2945`), server re-check (`index.ts` kill-switch).
**Apply to:** the re-lock prompt gate — messaging off ⇒ silent overwrite, no prompt.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| slide-text fingerprint helper | utility (pure) | No hash/digest/stable-stringify util exists in the repo. `SlideGroup.sourceSignature` (`slideGroup.ts:64`) is a stored opaque source-marker, not a deterministic re-derivable hash — conceptual precedent only. Write a small deterministic string hash fresh; colocate + fixture-test like the other pure utils. |

## Metadata

**Analog search scope:** `src/utils/messagingRecipients.ts` (full), `src/utils/serviceRoles.ts` (`1-40`), `src/stores/services.ts` (`78-154` snapshot/builder), `src/types/service.ts` (`40-146` slot id/kinds), `src/types/slide.ts` (`75-124`), `src/types/slideGroup.ts` (`44-68`), `src/stores/slideGroups.ts` (`23-40`), `src/components/MessageComposer.vue` (`1-80`, `129-405`, `550-599`), `functions/src/index.ts` (`1208-1376` type/gate/shaper/request), `src/views/ServiceEditorView.vue::onMarkAsPlanned` (`2858-2988`, slideGroups source `1619`), `.planning/research/ARCHITECTURE.md` §Re-Lock Change Diff (`539-600`), `61-PATTERNS.md` (template), grep `hash|fingerprint|digest|sourceSignature` across `src/`.
**Files scanned:** 10 source/type/test files + 2 planning docs.
**Mapped:** 7 of 8 units to a clean analog; 1 unit (slide-text hash) flagged fresh — no unmapped-and-unexplained units.
**Pattern extraction date:** 2026-08-14
