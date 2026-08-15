# Phase 62: Re-lock Change Notice — Scoped Diff - Research

**Researched:** 2026-08-14
**Domain:** A pure two-snapshot diff + a checkable re-lock notify modal riding the shipped Phase 59 send path; a client-side per-group slide fingerprint; one optional audit field (`changeDiff`) on the message doc and one new `MessageType`. No new Function, rule, index, secret, or npm package.
**Confidence:** HIGH — every claim is anchored to a live `file:line` in this repo or the shipped Phase 58/59/61 code. The one design gap (slide TEXT is not stored on the group doc) is resolved below with a concrete fingerprint recommendation grounded in the `SlideGroup`/`SourceRef` types.

## Summary

Phase 62 adds **zero new send machinery and zero new backend surface**. It introduces one pure client module (`src/utils/serviceLockDiff.ts::diffServiceSnapshots`), one dedicated modal (`ReLockNotifyPrompt.vue`), a small client-side slide fingerprint helper, and three tiny plumbing edits: add `'relock-notification'` to `MessageType`/`MESSAGE_TYPES` and widen the `changeDiff` field from the hard-coded `null` it is today to `ChangeEntry[] | null` on `QueueMessageRequest`/`QueuedMessageDoc`/`createQueuedMessage` (`functions/src/index.ts`). The re-lock notice reuses the exact `queueServiceMessage` callable the composer and the Phase 61 lock hook already call.

The heavy lifting is a **pure function over two `ServiceSnapshot`s** (already the canonical serialization written to `lockSnapshots/current` by the Phase 61 lock hook) plus two slide-fingerprint maps. `ServiceSlot` carries a **stable `id`** (`src/types/service.ts:39-47`, D-01), so SONG changes match by slot id and ORDER moves are detectable by index change — the whole diff is computable with plain fixtures and no mocking. The lock-hook restructure is surgical: the Phase 61 R144 block already reads the prior snapshot **before** writing (the first-lock signal), so Phase 62 only has to (a) compute a real fingerprint instead of `null`, (b) on the re-lock branch, diff and **defer** the `lockSnapshots/current` overwrite until the planner confirms (send or "Lock quietly"), and (c) overwrite silently when the diff is empty.

**Primary recommendation:** Build the diff as a pure `utils/` module (SONG/ORDER matched by stable slot `id`, ROLE by `roleAssignments[].roleId`, NOTES by string equality, SLIDES by comparing two `{ [slotId]: hash }` fingerprint maps); compute the fingerprint client-side in the lock hook from the already-subscribed `slideGroupsStore.groups` by hashing each group's **ordered `sourceRef` identities** (slide TEXT is NOT stored on the group doc — invariant 3); widen `changeDiff` from `null` to `ChangeEntry[] | null` (it is hard-coded `null` today — this is a real add); restructure `onMarkAsPlanned`'s R144 block to defer the re-lock overwrite until confirm; and confirm **no** new rule/index/secret/Function is needed (Phase 58's `messages` create = `isOrgEditor` and `lockSnapshots` write = `isOrgEditor` already cover every write).

<user_constraints>
## User Constraints (from 62-CONTEXT.md)

### Locked Decisions
- **Add `'relock-notification'` to `MessageType` + `MESSAGE_TYPES`** (`functions/src/index.ts:1212/1214`, mirrors 61-01's `'lock-notification'` add). The enum gate + shared shaper pick it up unchanged.
- **The message doc carries `changeDiff: ChangeEntry[] | null`** — the audit trail of exactly what was communicated (present only for `relock-notification`; null for every other type). Keep it optional/nullable so all other types are unaffected. The client passes `changeDiff` through the `queueServiceMessage` wrapper (extend its payload). This functions change rides along the already-UNDEPLOYED send Functions (owner deploys later); **no new Function, no new secret, no new index.**
- **Pure diff — `src/utils/serviceLockDiff.ts::diffServiceSnapshots`** (R146, R147): a new PURE module (no Firestore/Pinia imports), signature `diffServiceSnapshots(previous: ServiceSnapshot, current: ServiceSnapshot, prevFingerprint, currFingerprint): ChangeEntry[]`. `ChangeEntry = { type: 'SONG'|'ORDER'|'ROLE'|'NOTES'|'SLIDES'; description: string; affectedTeams: RoleGroup[] }`.

  | Type | Detection | Default `affectedTeams` |
  |------|-----------|--------------------------|
  | SONG | a slot's `songId`/`songTitle` changed, matched by stable slot **id** | broad = every RoleGroup with a non-empty role on the service |
  | ORDER | a slot's stable id moved position in the section-ordered `slots` array without its content changing | broad |
  | ROLE | a `roleAssignments[i].personNames` changed for a given `roleId` | **exactly** that role's `group` (the one narrow tag) |
  | NOTES | `notes` changed | broad |
  | SLIDES | `slideGroupsFingerprint` differs | broad |

  "Broad = every RoleGroup with a non-empty role on the service" — derive from the CURRENT snapshot's `roleAssignments` (groups with ≥1 assigned person). A ROLE entry tags ONLY `roleAssignments[i].group`.
- **SLIDES fingerprint** (per ARCHITECTURE recommendation **(2)**): compute a `slideGroupsFingerprint` as a SEPARATE step at lock time (NOT inside `buildServiceSnapshot` — keep the share-link path untouched) and store it in `lockSnapshots/current`. Phase 61 wrote `slideGroupsFingerprint: null`; Phase 62 now COMPUTES it. Granularity: a **per-slide-group hash map** `{ [groupId]: hash-of-ordered-slide-text }`, computed client-side in the lock hook from the already-loaded slideGroups. The diff compares prev vs curr maps; ANY group added/removed/changed → a single coarse **SLIDES** ChangeEntry (broad teams).
- **Lock-hook restructure** (extends Phase 61's `onMarkAsPlanned`): First lock (no prior snapshot) = compute snapshot + fingerprint, write, auto-send `lock-notification` — unchanged except the fingerprint is now real. Re-lock (prior exists) = read prior snapshot + fingerprint BEFORE overwriting, compute current, diff; **non-empty → open prompt, do NOT overwrite yet**; **empty → overwrite silently, no prompt**. On confirm (notify-send OR "Lock quietly") → overwrite `lockSnapshots/current` (SC4). The overwrite-on-confirm timing is load-bearing.
- **Re-lock prompt UI** (`ReLockNotifyPrompt.vue`, NOT the free-text `MessageComposer`): lists the typed **checkable** ChangeEntry rows with human descriptions + **affected-team tags** (reuse `MESSAGING_TEAM_LABELS`); a recipient choice **notify affected teams** (default — union of `affectedTeams` across CHECKED entries) vs **notify everyone** (SC2); live "Reaches N" via `resolveRecipients`. **Send** → `queueServiceMessage` (type:`'relock-notification'`, recipientSelector from the choice, `changeDiff` = CHECKED entries, `options.attachServiceLink:true`, subject/body auto-generated). **Lock quietly** → always available (SC3), no message, still overwrites (SC4). Gated by `isMessagingEnabled()` — with messaging OFF, re-lock never prompts (it just overwrites the snapshot silently).
- **Firestore rules / indexes** — `messages` create = `isOrgEditor` and `lockSnapshots` write = `isOrgEditor` already shipped (Phase 58). **No new rules, no new index, no new secret, no new Function.**

### Claude's Discretion
- The slide-text hash function, the auto-generated re-lock subject/body copy, the modal's exact layout, whether "notify everyone" is a toggle vs a segmented control, and the ChangeEntry `description` phrasing — all at implementer discretion, guided by the UI-SPEC, ARCHITECTURE, and conventions.

### Deferred Ideas (OUT OF SCOPE)
- Finer SLIDES description ("Slides changed in group X") — the per-group fingerprint is STORED to enable it later; v1.7 ships a coarse SLIDES entry.
- Free-text editing of the re-lock notice — the notice IS the generated diff summary.
- Milestone lifecycle (audit/complete/cleanup) — DEFERRED to the owner; after Phase 62 code-complete, STOP and hand over the verify list.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R146 | Re-lock prompts a scoped, typed, checkable change diff (SONG/ORDER/ROLE/NOTES/SLIDES). | Pure `diffServiceSnapshots` over two `ServiceSnapshot`s (`src/stores/services.ts:80-95`) + two fingerprint maps; `ServiceSlot.id` stable (`src/types/service.ts:39-47`) enables SONG/ORDER; `roleAssignments[].roleId/group` enables ROLE (`services.ts:89-94`); `notes` string equality; fingerprint-map compare for SLIDES. Rendered as a checkable modal `ReLockNotifyPrompt.vue`. Opened from the re-lock branch of `onMarkAsPlanned` (`ServiceEditorView.vue:2858`). |
| R147 | Each entry team-tagged (ROLE = that role's team, others = all assigned teams); send to affected vs everyone. | `ChangeEntry.affectedTeams: RoleGroup[]` (`src/types/roster.ts:3`); ROLE tags `roleAssignments[i].group`, all others tag broad = groups with a non-empty role derived from the CURRENT snapshot's `roleAssignments`. Recipient choice → `resolveRecipients` (`src/utils/messagingRecipients.ts:52`) with `{teams: union-of-checked-affectedTeams}` vs `{includeEveryone:true}`; team tags via `MESSAGING_TEAM_LABELS` (`:17`); "Reaches N" via `.reachable.length`. |
| R148 | "Lock quietly" always available; confirming (send or quiet) overwrites `lockSnapshots/current`. | Lock-hook restructure in `onMarkAsPlanned` R144 block (`ServiceEditorView.vue:2907-2988`): defer the `setDoc(snapRef, …)` overwrite until confirm; both the modal's Send and its Lock-quietly paths call the same overwrite. Empty diff → silent overwrite. `lockSnapshots` write rule = `isOrgEditor` (`firestore.rules:162-165`). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compute the change diff | Browser / Client (`src/utils/serviceLockDiff.ts`, pure) | — | A pure function over two client-computed `ServiceSnapshot`s + two fingerprint maps. No I/O; testable with plain fixtures. |
| Slide fingerprint compute | Browser / Client (lock hook, reads `slideGroupsStore.groups`) | Database (`slideGroups` already subscribed org-wide) | Slides live in the `slideGroups` subcollection; the fingerprint is a cheap client-side hash of the already-loaded groups. Kept OUT of `buildServiceSnapshot` so the share-link path is untouched. |
| First-lock vs re-lock detection + snapshot overwrite | Browser / Client (`ServiceEditorView.vue`) | Database (`lockSnapshots/current`, editor-write rule) | The lock is a client lifecycle action; "re-lock" = a prior `lockSnapshots/current` exists (a client read before the write). |
| Re-lock prompt + recipient choice | Browser / Client (`ReLockNotifyPrompt.vue`) | — | The notice content IS the diff (auto-generated); the planner only checks entries + picks affected-vs-everyone. `resolveRecipients` is pure/client. |
| Re-lock notice enqueue | Browser / Client (`queueServiceMessage` callable) | API / Backend (server re-checks editor + kill-switch, then `sendQueuedMessage` sends) | The client declares intent only; the server re-authorizes and re-resolves recipients (never the client's list). Unchanged from Phase 59/61. |
| `changeDiff` audit persistence + `'relock-notification'` enum | API / Backend (`createQueuedMessage`/`MessageType`) | Database (`messages/{id}`) | The message doc's audit field + a new type member; one shaper edit. |
| Actual send | API / Backend (`sendQueuedMessage`, holds `RESEND_API_KEY`) | — | Unchanged. The only Function that sends; renders per-recipient tokens. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | — | The entire phase is one pure util, one Vue modal, and small edits to shipped files | No install. The diff is pure TS; the fingerprint hash is a hand-written deterministic string hash (see Don't Hand-Roll); the send path is the shipped `queueServiceMessage`. |
| `firebase/firestore` (client) | already installed | `doc`/`getDoc`/`setDoc` for `lockSnapshots/current` read-before-write + deferred overwrite | Exact reuse of the Phase 61 lock-hook idioms (`ServiceEditorView.vue:2923-2935`). |
| `firebase/functions` (client) | already installed | `httpsCallable(functions,'queueServiceMessage')` for the re-lock enqueue | Exact reuse of `ServiceEditorView.vue:2962` / `MessageComposer.vue:574`. |
| `vitest` | app root `4.0.x`; functions `^4.1.10` | Unit tests for the pure diff, the modal, the lock hook, and the functions plumbing | Both suites already exist. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vue/test-utils` | already installed | Mount `ReLockNotifyPrompt.vue` + the editor hook tests | Existing component-test convention (`ServiceEditorView.test.ts`). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written deterministic string hash for the slide fingerprint | A crypto/hash npm package (`object-hash`, `xxhash-wasm`) | Rejected — a supply-chain install gate for a coarse change-detector. A 20-line DJB2/FNV-1a over the group's ordered `sourceRef` identities is deterministic, dependency-free, and collision-risk is irrelevant (worst case: a missed SLIDES entry on a hash collision, astronomically unlikely and self-corrects next re-lock). |
| A dedicated `ReLockNotifyPrompt.vue` | Reuse `MessageComposer.vue` | Rejected per CONTEXT — the notice content IS the auto-generated diff, not free text; the composer's subject/body editor and team pickers are the wrong affordance. Reuse only the idioms (`resolveRecipients`, `MESSAGING_TEAM_LABELS`, the `queueServiceMessage` callable), not the component. |
| Storing the full slide text in the fingerprint | Hashing resolved slide TEXT | Not possible cheaply — slide TEXT is NOT stored on the group doc (invariant 3, `slideGroup.ts:22-36`); it resolves LIVE via `sourceRef`. Hashing `sourceRef` identity (kind + ids + any authored congregational/text/video content) is the correct, available signal. See "The SLIDES Fingerprint" below. |

**Installation:** **None.** This phase adds **no new npm dependency**.

**Version verification:** N/A — nothing is installed.

## Package Legitimacy Audit

> **No external package is installed this phase.** The diff is pure TS, the fingerprint is a hand-written hash, and the send path reuses the shipped `queueServiceMessage` callable + `firebase/functions` (already installed).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | **No install this phase** |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious (SUS):** none — nothing is installed. No `checkpoint:human-verify` package gate is required this phase.

## The Critical Findings (answer the phase's explicit questions)

### 1. `ServiceSlot` HAS a stable `id` — CONFIRMED (the diff's foundation)
`ServiceSlot` is a union whose every member `extends MediaAttachableSlot`, which carries `id: string` — the **stable slot identity (D-01, Phase 24)**, minted by `createSlot()`/`buildSlots()` and backfilled for legacy docs by `backfillSlotIds()` (`src/types/service.ts:39-47`, doc comment: "never array index or `position`, both of which a drag-reorder rewrites"). `ServiceSnapshot.slots: ServiceSlot[]` (`src/stores/services.ts:85`) therefore carries `slot.id` on every entry. **This is exactly what SONG (match by id, compare `songId`/`songTitle`) and ORDER (same id, index changed, content unchanged) need.** Note `buildServiceSnapshot` already returns slots in **section-major canonical order** (`orderSlotsBySection`, `services.ts:111`), so both snapshots are pre-sorted — an ORDER move is a genuine index change, not a serialization artifact.

- SONG slot fields on `SongSlot`: `songId: string | null`, `songTitle: string | null`, `songKey`, `position` (`src/types/service.ts:63-71`). Compare `songId` + `songTitle` for the same `slot.id`.
- `RoleGroup = 'band' | 'tech' | 'vocals' | 'other'` (`src/types/roster.ts:3`) — the `affectedTeams` element type. "Broad = groups with a non-empty role" is derivable from `current.roleAssignments` (each entry has `group: RoleGroup` + `personNames: string[]`; a group is "in play" if any entry with that group has `personNames.length > 0`).

### 2. The SLIDES fingerprint — source, and a correction the planner MUST know
**Source:** the `useSlideGroups` store (`src/stores/slideGroups.ts`). Its `groups` ref is an **org-wide** subscription established once on first org-id resolution via `slideGroupsStore.subscribeGroups(id)` in `useSlideshowAssembly.ts:185` — and `ServiceEditorView.vue` already holds `slideGroupsStore = useSlideGroups()` (`:1619`) and consumes assembly, so `slideGroupsStore.groups` is **populated at lock time**. Filter to this service with `groups.filter(g => g.serviceId === svc.id)`. Each group's doc id === `slotId` === the anchoring `ServiceSlot.id` (invariant 1, `slideGroup.ts:11-15`), so the map key is the slot id.

**Correction (critical):** CONTEXT says "hash of each group's ordered slide **text**." But **slide TEXT is NOT stored on the `slideGroup` document** — invariant 3 (`slideGroup.ts:22-36`): "Slide TEXT is never stored on this document — it resolves LIVE from the canonical song/scripture/imported-deck record via `sourceRef`." What the group's `slides: GroupSlideEntry[]` DOES carry per entry is `order`, `sourceRef` (a discriminated union: `lyric`/`copyright`/`scripture`/`imported`/`text`/`video`), and optional authored fields (`notes`, `audioUrl`, `backgroundImageUrl`; and for `text`/`scripture`-congregational/`video` members, the actual authored `title`/`body`/`speaker`/`text`/`verseRange`/`videoSrc`). So:

> **Recommendation — hash each group's ordered `sourceRef` identities, not "resolved text."** For each group (sorted by `slides[].order`), serialize each entry's `sourceRef` deterministically (its `kind` plus its discriminating ids/text — e.g. `lyric:{songId}:{sectionId}`, `scripture:{speaker}:{text}:{verseRange}`, `imported:{importId}:{innerSlideId}:{renderedPage}`, `text:{title}:{body}`, `video:{videoSrc}`), join in order, and run a deterministic string hash (DJB2/FNV-1a). Store `slideGroupsFingerprint = { [slotId]: hash }`.

This **detects** slide add/remove/reorder within a group, group add/remove across the service, and authored content edits on congregational/text/video entries. It does **NOT** detect a live song-lyric edit (the lyric text resolves live and `songId` is unchanged) — which is acceptable and correct for v1.7's coarse SLIDES entry (a lyric edit to a song already on the service is a content edit to an unchanged deck structure; the SONG entry covers a song *swap*). Flag this boundary as **A1** — the planner may broaden the hash later but should not attempt to resolve live text at lock time (that would re-introduce the `slideGroups`-store coupling ARCHITECTURE recommendation (2) deliberately avoids). The diff's SLIDES rule: if `prevFingerprint` and `currFingerprint` maps differ by any key or value → one coarse SLIDES `ChangeEntry` (broad teams).

### 3. `changeDiff` MUST be ADDED — it is hard-coded `null` today
The field EXISTS in name but is a hard `null`, not a carrier:
- `QueuedMessageDoc.changeDiff: null` — the type is the literal `null` (`functions/src/index.ts:1284`).
- `createQueuedMessage` hard-codes `changeDiff: null` in the returned object (`:1315`).
- `QueueMessageRequest` has **no** `changeDiff` field at all (`:1249-1259`).

**Minimal add (keep every other type unaffected):**
1. Define a functions-local `ChangeEntry` interface (functions cannot import from `src/`): `{ type: string; description: string; affectedTeams: string[] }` (keep `affectedTeams: string[]` — do NOT import `RoleGroup`; the values are the same enum strings).
2. Widen `QueuedMessageDoc.changeDiff` → `changeDiff: ChangeEntry[] | null`.
3. Add optional `changeDiff?: ChangeEntry[] | null` to `QueueMessageRequest`.
4. In `createQueuedMessage`, `changeDiff: input.changeDiff ?? null` (Firestore rejects `undefined`, so normalize to `null` — same pattern the shaper already applies to `scheduledFor`/`sentAt`, `:1303-1304`).
5. Add `'relock-notification'` to the `MessageType` union (`:1212`) AND the `MESSAGE_TYPES` array (`:1214-1219`). The enum gate (`MESSAGE_TYPES.includes(type)`, `:1372`) + the shared shaper then accept it unchanged. `sendQueuedMessage` renders/sends for any type — no trigger change (the doc comment at `:1208-1210` explicitly anticipates this exact Phase 62 add).

**Client wrapper passthrough:** the client re-declares `QueueMessageRequest` locally (it cannot import from `functions/`). The Phase 61 lock hook already has a local interface at `ServiceEditorView.vue:2789-2798` (`type: 'lock-notification'`). Phase 62's modal declares its own local request type with `type: 'relock-notification'` and an added `changeDiff: ChangeEntry[]` field, and passes the CHECKED entries through. Only the selector + the audit diff cross the boundary — never a resolved email list.

### 4. The lock-hook restructure — the exact point
The R144 block lives inside `onMarkAsPlanned` at `ServiceEditorView.vue:2907-2988` (the whole function is `:2858-3007`), in its OWN try/catch whose failure is never re-raised into `lifecycleError` (the lock already succeeded). Today it does, unconditionally on every lock:
1. `getDoc(snapRef)` → `wasFirstLock = !prior.exists()` (`:2924-2925`) — **reads prior BEFORE write** (the first-lock signal; do NOT move this).
2. `setDoc(snapRef, { snapshot: buildServiceSnapshot(svc), slideGroupsFingerprint: null, lockedAt, lockedByUid })` — **unconditional overwrite** (`:2930-2935`).
3. `if (wasFirstLock)` → gated `queueServiceMessage` auto-send (`:2939-2982`).

**Phase 62 restructures the overwrite (step 2) and adds a re-lock branch:**
- Compute `currFingerprint = fingerprintSlideGroups(slideGroupsStore.groups, svc.id)` and `currSnapshot = buildServiceSnapshot(svc)` up front.
- **First lock** (`wasFirstLock`): keep steps 2+3 exactly as today, but write the REAL `slideGroupsFingerprint: currFingerprint` instead of `null`. Auto-send unchanged. **This preserves the Phase 61 first-lock path and its behavior.**
- **Re-lock** (`prior.exists()`): read `prior.data().snapshot` + `prior.data().slideGroupsFingerprint`, compute `entries = diffServiceSnapshots(priorSnapshot, currSnapshot, priorFingerprint, currFingerprint)`.
  - **Non-empty diff** AND `isMessagingEnabled()` → open `ReLockNotifyPrompt` with the entries; **do NOT `setDoc` yet**. The overwrite (`setDoc(snapRef, { snapshot: currSnapshot, slideGroupsFingerprint: currFingerprint, lockedAt, lockedByUid })`) becomes a callback the modal invokes on Send AND on Lock-quietly (SC4).
  - **Empty diff** (or messaging OFF) → `setDoc` the overwrite **silently**, no prompt.

**Timing risk (load-bearing):** overwriting `lockSnapshots/current` before the planner confirms would destroy the diff basis (the next re-lock would diff against the just-written state). The read-before-write ordering already present means the diff can be computed safely; the only new discipline is **deferring the write on the non-empty re-lock path**. Keep the whole block non-blocking to the lock transition (the service is already `planned` on screen; the prompt + overwrite are a follow-up, mirroring Phase 61's non-blocking enqueue).

**Regression watch (flag for the planner):** the Phase 61 first-lock tests assert `lockSnapshots/current` is written with `slideGroupsFingerprint: null` (see `src/views/__tests__/ServiceEditorView.test.ts`, the R144 first-lock cases). Phase 62 now writes a real map — **those assertions must be updated** (they are asserting the *deferred* stub, not a contract). This is a test update, not a behavior regression. Also verify the existing re-lock test ("re-lock does NOT auto-send") still holds: it must now additionally assert the overwrite is deferred/gated rather than unconditional.

### 5. The re-lock prompt → send wiring
`ReLockNotifyPrompt.vue` (new): checkable ChangeEntry rows (each with `description` + `affectedTeams` tags rendered via `MESSAGING_TEAM_LABELS[group]`), a recipient toggle (affected-vs-everyone), and a live "Reaches N".
- **Reaches N / affected teams:** `resolveRecipients(svc, quartersStore.quarters, rosterStore.roles, rosterStore.people, selection).reachable.length` (`src/utils/messagingRecipients.ts:52`). For "affected," `selection = { teams: unionOfCheckedAffectedTeams, individualPersonIds: [], includeEveryone: false }`; for "everyone," `{ teams: [], individualPersonIds: [], includeEveryone: true }`. Same idiom as `MessageComposer.vue:385-409`.
- **Send:** `httpsCallable<QueueMessageRequest, {messageId:string}>(functions, 'queueServiceMessage')({ orgId, serviceId: svc.id, type: 'relock-notification', subject, body, recipientSelector: selectionToSelector(selection), options: { attachServiceLink: true, sendCopyToSelf: false }, scheduledFor: null, changeDiff: checkedEntries })`. Then invoke the snapshot-overwrite callback (SC4).
- **Lock quietly:** no callable; invoke the snapshot-overwrite callback (SC4). Always present (SC3).
- **Gate:** the parent only opens the modal when `isMessagingEnabled()` is true AND the diff is non-empty; with messaging off the re-lock never prompts (overwrite is silent).

### 6. No new rules/index/secret/Function — CONFIRMED
- `messages` create = `isOrgEditor(orgId)` (`firestore.rules:143`); read = `isOrgMember`; update/delete = `false` (`:144`) — so the `changeDiff`-bearing create is authorized and the doc is immutable after create (no tamper vector). No `recipients` change (Admin-SDK-only, `:150-153`).
- `lockSnapshots/{snapshotId}` write = `isOrgEditor(orgId)` (`firestore.rules:162-165`) — covers the deferred overwrite.
- No `collectionGroup` query is introduced (the diff reads a single `lockSnapshots/current` doc + the already-subscribed `slideGroups`). No `firestore.indexes.json` entry. No new secret (`sendQueuedMessage` already holds `RESEND_API_KEY`; the re-lock notice only enqueues). No new Function.

## Architecture Patterns

### System Architecture Diagram
```
CLIENT — onMarkAsPlanned (ServiceEditorView.vue:2858), R144 block :2907-2988
  await markAsPlanned(id) ; applyTransitionLocally('planned')     (draft→locked, already on screen)
    │
    ├─ currSnapshot = buildServiceSnapshot(svc)                    (services.ts:104, pure/Pinia-bound)
    ├─ currFingerprint = fingerprintSlideGroups(                    (NEW helper; hashes ordered sourceRefs)
    │      slideGroupsStore.groups.filter(g => g.serviceId===svc.id))
    ├─ prior = getDoc(lockSnapshots/current)                       (READ BEFORE WRITE — first-lock signal)
    │
    ├─ FIRST LOCK (!prior.exists()):
    │     setDoc(lockSnapshots/current = { snapshot: currSnapshot,
    │            slideGroupsFingerprint: currFingerprint,  ← REAL now (was null in P61)
    │            lockedAt, lockedByUid })
    │     if isMessagingEnabled() && effectiveLockNotify && reachable>0:
    │        queueServiceMessage(type:'lock-notification', includeEveryone) → (unchanged P61)
    │
    └─ RE-LOCK (prior.exists()):
          entries = diffServiceSnapshots(prior.snapshot, currSnapshot,        ← PURE (utils/serviceLockDiff.ts)
                        prior.slideGroupsFingerprint, currFingerprint)
          if entries.length === 0  OR  !isMessagingEnabled():
             setDoc(lockSnapshots/current = {curr…})    ← SILENT overwrite (SC4), no prompt
          else:
             open ReLockNotifyPrompt(entries)           ← SC1 ; DO NOT overwrite yet
                ├─ checkable rows + team tags (MESSAGING_TEAM_LABELS)
                ├─ affected-vs-everyone → resolveRecipients(...).reachable.length  "Reaches N"  (SC2)
                ├─ Send   → queueServiceMessage(type:'relock-notification',
                │              recipientSelector, changeDiff: checkedEntries,
                │              options.attachServiceLink) ─────────┐
                └─ Lock quietly (always, SC3) ───────────────┐    │
                                                             ▼    ▼
                                       overwrite lockSnapshots/current = {curr…}  (SC4, on EITHER path)

SERVER (unchanged): queueServiceMessage (createQueuedMessage shaper; +changeDiff, +'relock-notification' enum)
   → messages/{id} status:'queued' ──onDocumentCreated──▶ sendQueuedMessage (renders per-recipient, holds RESEND_API_KEY)
```

### Recommended Structure (files this phase touches)
```
src/
├── utils/serviceLockDiff.ts               # NEW — pure diffServiceSnapshots + a fingerprint compare helper
├── utils/__tests__/serviceLockDiff.test.ts# NEW — the heaviest unit target (every type, affectedTeams, empty)
├── components/ReLockNotifyPrompt.vue       # NEW — checkable diff modal (reuses resolveRecipients + labels)
├── components/__tests__/ReLockNotifyPrompt.test.ts  # NEW — checkable→ReachesN, affected-vs-everyone, Send vs quiet
├── views/ServiceEditorView.vue             # EDIT — restructure R144 block: real fingerprint + re-lock branch + deferred overwrite
├── views/__tests__/ServiceEditorView.test.ts # EDIT — re-lock branch tests; UPDATE the P61 slideGroupsFingerprint:null assertions
└── (helper) fingerprintSlideGroups()       # small pure helper — colocate in serviceLockDiff.ts or a slides util

functions/src/
├── index.ts        # EDIT — 'relock-notification' in MessageType/MESSAGE_TYPES; ChangeEntry type;
│                   #        changeDiff → ChangeEntry[]|null on QueueMessageRequest/QueuedMessageDoc/createQueuedMessage
└── index.test.ts   # EDIT — queueServiceMessage accepts 'relock-notification'; changeDiff persisted on the doc

firestore.rules / firestore.indexes.json    # UNCHANGED (Phase 58 already covers messages create + lockSnapshots write)
```

### Pattern 1: The pure diff (matched by stable slot id)
```typescript
// src/utils/serviceLockDiff.ts — pure, no Firestore/Pinia imports (serviceRoles.ts convention).
// Source shapes: ServiceSnapshot (src/stores/services.ts:80-95), ServiceSlot.id (src/types/service.ts:47).
export type SlideFingerprint = Record<string, string>  // { [slotId]: hash }
export interface ChangeEntry { type: 'SONG'|'ORDER'|'ROLE'|'NOTES'|'SLIDES'; description: string; affectedTeams: RoleGroup[] }

export function diffServiceSnapshots(
  previous: ServiceSnapshot, current: ServiceSnapshot,
  prevFingerprint: SlideFingerprint | null, currFingerprint: SlideFingerprint | null,
): ChangeEntry[] {
  const broad = groupsWithAssignments(current.roleAssignments)          // R147 broad default
  const entries: ChangeEntry[] = []
  const prevById = new Map(previous.slots.map(s => [s.id, s]))
  const currById = new Map(current.slots.map(s => [s.id, s]))
  // SONG — same slot id, songId/songTitle changed (SongSlot fields)
  for (const [id, cur] of currById) {
    const prev = prevById.get(id)
    if (prev && cur.kind === 'SONG' && prev.kind === 'SONG'
        && (prev.songId !== cur.songId || prev.songTitle !== cur.songTitle))
      entries.push({ type: 'SONG', description: `Song changed: …`, affectedTeams: broad })
  }
  // ORDER — a shared slot id's index moved (both arrays already section-sorted by buildServiceSnapshot)
  if (orderChanged(previous.slots, current.slots)) entries.push({ type: 'ORDER', description: 'Service order changed', affectedTeams: broad })
  // ROLE — a roleAssignments[roleId].personNames changed; tag ONLY that role's group (the narrow tag)
  for (const cur of current.roleAssignments) {
    const prev = previous.roleAssignments.find(r => r.roleId === cur.roleId)
    if (prev && !sameNames(prev.personNames, cur.personNames))
      entries.push({ type: 'ROLE', description: `${cur.roleName} assignment changed`, affectedTeams: [cur.group] })
  }
  // NOTES — string equality
  if (previous.notes !== current.notes) entries.push({ type: 'NOTES', description: 'Service notes changed', affectedTeams: broad })
  // SLIDES — fingerprint maps differ (any key added/removed/changed)
  if (fingerprintsDiffer(prevFingerprint, currFingerprint)) entries.push({ type: 'SLIDES', description: 'Slides changed', affectedTeams: broad })
  return entries
}
```

### Pattern 2: Deterministic slide fingerprint (no package)
```typescript
// Hash each group's ORDERED sourceRef identities — slide TEXT is not stored on the group (slideGroup.ts:22-36).
function refKey(ref: SourceRef): string {
  switch (ref.kind) {
    case 'lyric':     return `lyric:${ref.songId}:${ref.sectionId}`
    case 'copyright': return `copyright:${ref.songId}`
    case 'scripture': return `scripture:${ref.speaker ?? ''}:${ref.text ?? ''}:${ref.verseRange ?? ''}:${ref.scriptureReadingId ?? ''}`
    case 'imported':  return `imported:${ref.importId}:${ref.innerSlideId}:${ref.renderedPage ?? ''}`
    case 'text':      return `text:${ref.title ?? ''}:${ref.body ?? ''}`
    case 'video':     return `video:${ref.videoSrc}`
  }
}
function djb2(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }
export function fingerprintSlideGroups(groups: SlideGroup[], serviceId: string): SlideFingerprint {
  const out: SlideFingerprint = {}
  for (const g of groups) {
    if (g.serviceId !== serviceId) continue
    const ordered = [...g.slides].sort((a, b) => a.order - b.order).map(refKey).join('|')
    out[g.slotId] = djb2(ordered)
  }
  return out
}
```

### Anti-Patterns to Avoid
- **Overwriting `lockSnapshots/current` before the planner confirms a re-lock** — destroys the diff basis; the next re-lock would show "no changes." Defer the write to the modal's Send/Lock-quietly callbacks (SC4).
- **Reading `prior` AFTER writing the snapshot** — every lock would look like a re-lock (Phase 61 Pitfall 4; the current code correctly reads first — keep it).
- **Hashing "resolved slide text"** — slide text is not on the group doc; it resolves live via `sourceRef`. Hash the ordered `sourceRef` identities (Pattern 2).
- **Importing `RoleGroup`/`ServiceSnapshot` into `functions/`** — the client and functions share no package (ARCHITECTURE §Re-Lock notes the monorepo has no shared package). The functions `ChangeEntry` is a local minimal interface with `affectedTeams: string[]`.
- **Leaving `changeDiff` as `undefined` in the shaper** — Firestore rejects `undefined`; normalize `input.changeDiff ?? null` (matches the shaper's existing null-normalization of `scheduledFor`/`sentAt`).
- **Prompting on re-lock when messaging is off** — nowhere to send; overwrite the snapshot silently (CONTEXT).
- **Re-declaring the diff/detection in the modal** — the modal renders `ChangeEntry[]` it is handed; ALL detection lives in the pure util.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recipient resolution + "Reaches N" | A second team→people resolver in the modal | `resolveRecipients` (`src/utils/messagingRecipients.ts:52`) | The one pure resolver every messaging surface consumes; dedup + reachability already handled. |
| Team labels | New label constant | `MESSAGING_TEAM_LABELS` (`messagingRecipients.ts:17`) | The shipped messaging-surface label remap for `RoleGroup`. |
| Message doc shape + enqueue | A hand-built `messages` object | `queueServiceMessage` callable → `createQueuedMessage` shaper | Server re-authorizes, re-checks kill-switch, and `sendQueuedMessage` re-resolves + renders per-recipient. The re-lock notice is just another queued message. |
| Snapshot serialization | A re-lock-specific serializer | `buildServiceSnapshot` (`src/stores/services.ts:104`) | Already the canonical `ServiceSnapshot` written to `lockSnapshots/current`; both diff inputs use it, so they can never disagree on field shape. |
| Slide hashing | A crypto/hash package | A 10-line DJB2/FNV-1a (Pattern 2) | Coarse change-detection; a collision's worst case is one missed SLIDES entry that self-corrects next re-lock. No install gate. |

**Key insight:** the ONLY genuinely new logic is the pure `diffServiceSnapshots` + the `fingerprintSlideGroups` helper + the modal + the lock-hook re-lock branch. Everything else — the snapshot, the resolver, the labels, the send path, the rules — is shipped. Treat those four as the risk surface and test each branch.

## Runtime State Inventory

Not applicable — Phase 62 is additive (a new pure util, a new modal, a `changeDiff` field widened from `null`, a new `MessageType` member, and a lock-hook branch). No rename/refactor/migration.

- **Stored data:** `lockSnapshots/current.slideGroupsFingerprint` transitions from the Phase 61 stub `null` to a `{ [slotId]: hash }` map on the next lock of each service. Older snapshots simply carry `null`, which the diff treats as "no prior fingerprint" → the first post-upgrade re-lock may surface a coarse SLIDES entry (expected, harmless). No re-key, no backfill. `changeDiff` on `messages/{id}` is a new field on new docs only (existing message docs keep `null`).
- **Live service config:** none new. The `changeDiff`/`'relock-notification'` functions edit rides the already-UNDEPLOYED send Functions the owner deploys later; no separate deploy step this phase beyond what Phase 59/61 already pended.
- **OS-registered state:** none.
- **Secrets/env vars:** none new (`RESEND_API_KEY` already held by `sendQueuedMessage`).
- **Build artifacts:** none — no package installed.

## Common Pitfalls

### Pitfall 1: Overwriting the snapshot before confirm
**What goes wrong:** the next re-lock shows "no changes" even after real edits.
**Root cause:** `lockSnapshots/current` was overwritten at lock time (Phase 61 behavior) rather than deferred to the modal's confirm.
**How to avoid:** on the non-empty re-lock path, do NOT `setDoc` until Send or Lock-quietly fires (SC4). Empty-diff and first-lock paths still write immediately.
**Warning signs:** a test that re-locks, edits, re-locks again and asserts a diff — it will be empty if the overwrite wasn't deferred.

### Pitfall 2: Expecting the fingerprint to catch a live lyric edit
**What goes wrong:** an author edits a song's lyrics on an already-scheduled song; re-lock shows no SLIDES entry.
**Root cause:** slide text resolves live via `sourceRef`; the group doc stores only the reference, whose identity is unchanged.
**How to avoid:** accept it — v1.7 SLIDES is coarse (deck structure/authored-entry changes). Document as A1; do not couple the lock hook to live text resolution.

### Pitfall 3: The P61 first-lock tests break on the real fingerprint
**What goes wrong:** `ServiceEditorView.test.ts` R144 cases assert `slideGroupsFingerprint: null`.
**Root cause:** Phase 61 stubbed it null; Phase 62 writes the real map.
**How to avoid:** update those assertions to expect the computed map (or an object) — it is the deferred stub being realized, not a regression.

### Pitfall 4: `changeDiff` left as the `null` literal type
**What goes wrong:** TS rejects assigning `ChangeEntry[]` to a field typed `null`; or the shaper drops the array.
**Root cause:** `QueuedMessageDoc.changeDiff: null` and `createQueuedMessage`'s hard-coded `changeDiff: null` (`functions/src/index.ts:1284/1315`).
**How to avoid:** widen the type to `ChangeEntry[] | null`, add `changeDiff?` to `QueueMessageRequest`, and thread `input.changeDiff ?? null` through the shaper.

### Pitfall 5: `.env.local` absent in a worktree
**What goes wrong:** the full app suite / `vite build` / functions emulator fail without secrets (CLAUDE.md).
**How to avoid:** symlink or copy `C:\projects\worshipplanner\.env.local` into any new worktree before running the full suite or a build. Not relevant to the mocked unit tests (the pure diff needs no env at all).

## Code Examples

### Adding the type + widening changeDiff (functions)
```typescript
// functions/src/index.ts
export type MessageType = "oneoff" | "reminder" | "share-link" | "lock-notification" | "relock-notification";
const MESSAGE_TYPES: readonly MessageType[] = ["oneoff", "reminder", "share-link", "lock-notification", "relock-notification"];

export interface ChangeEntry { type: string; description: string; affectedTeams: string[]; }  // functions-local; no src import

export interface QueueMessageRequest {
  orgId: string; serviceId: string; type: MessageType; subject: string; body: string;
  recipientSelector: RecipientSelector; options: MessageOptions; scheduledFor: string | null;
  changeDiff?: ChangeEntry[] | null;          // NEW — audit trail, relock-notification only
}
export interface QueuedMessageDoc { /* … */ changeDiff: ChangeEntry[] | null; /* … */ }
export function createQueuedMessage(input: CreateQueuedMessageInput): QueuedMessageDoc {
  return { /* … */ changeDiff: input.changeDiff ?? null, /* … */ };
}
```

### Deferred overwrite on the re-lock branch (client, inside onMarkAsPlanned)
```typescript
// src/views/ServiceEditorView.vue — restructured R144 block (:2907-2988)
const currSnapshot = buildServiceSnapshot(svc)
const currFingerprint = fingerprintSlideGroups(slideGroupsStore.groups, svc.id)
const prior = await getDoc(snapRef)
const writeSnapshot = () => setDoc(snapRef, {
  snapshot: currSnapshot, slideGroupsFingerprint: currFingerprint,
  lockedAt: serverTimestamp(), lockedByUid: authStore.user?.uid ?? null,
})
if (!prior.exists()) {
  await writeSnapshot()                                   // first lock — real fingerprint now
  /* …existing gated lock-notification auto-send (unchanged)… */
} else {
  const p = prior.data()
  const entries = diffServiceSnapshots(p.snapshot, currSnapshot, p.slideGroupsFingerprint ?? null, currFingerprint)
  if (entries.length === 0 || !isMessagingEnabled()) {
    await writeSnapshot()                                 // silent overwrite (SC4)
  } else {
    openReLockPrompt(entries, { onConfirm: writeSnapshot })  // SC1; overwrite deferred to Send/Lock-quietly
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `slideGroupsFingerprint: null` stub (Phase 61) | Real `{ [slotId]: hash }` map computed client-side | Phase 62 | Enables the SLIDES ChangeEntry; older snapshots' `null` treated as "no prior fingerprint." |
| `changeDiff: null` literal (Phase 59) | `changeDiff: ChangeEntry[] \| null` | Phase 62 | The message doc becomes an audit trail for re-lock notices. |
| Re-lock is inert (Phase 61 auto-sends only first lock) | Re-lock opens a checkable scoped-diff prompt | Phase 62 | R146/R147/R148. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The SLIDES fingerprint hashes ordered `sourceRef` identities (not live-resolved lyric text), so a live song-lyric edit to an unchanged deck is NOT flagged SLIDES. | The SLIDES Fingerprint (2) | A planner expecting lyric-edit detection would find it missing; acceptable per v1.7 coarse SLIDES scope, but confirm the intent. Broadening later means resolving live text — the coupling ARCHITECTURE (2) avoids. |
| A2 | Slot ADD/REMOVE (a slot id present in one snapshot but not the other) folds into ORDER (a non-SONG slot appears/disappears) or SONG (a SONG slot appears/disappears). CONTEXT's table only enumerates "moved position" for ORDER and "matched by id" for SONG, neither of which explicitly covers add/remove. | Pattern 1 | If unhandled, adding/removing a slot yields no entry and no notice. Recommend: a changed slot-id SET → an ORDER entry (broad), plus a SONG entry if a SONG slot was added/removed. Confirm the phrasing with the planner. |
| A3 | The re-lock prompt is suppressed entirely (silent overwrite) when `isMessagingEnabled()` is false, even if the diff is non-empty. | User Constraints / Pattern in §4 | Matches CONTEXT ("with messaging OFF, re-lock never prompts"); if the owner wanted a "review changes" prompt independent of sending, this would suppress it. CONTEXT is explicit, so low risk. |
| A4 | `slideGroupsStore.groups` is reliably populated at lock time (subscription established in `useSlideshowAssembly.ts:185`, editor consumes assembly). | The SLIDES Fingerprint (2) | If a service is locked before the org-wide slideGroups subscription settles, the fingerprint could be empty → a spurious/missed SLIDES entry on the first re-lock. Low risk (the editor mounts assembly), but the plan's test should mount with `groups` seeded. |

## Open Questions

1. **Slot add/remove classification (A2).**
   - What we know: SONG matches by id; ORDER is a position move of a shared id.
   - What's unclear: how an ADDED or REMOVED slot maps to the five types.
   - Recommendation: treat any change to the slot-id set as an ORDER entry, and additionally emit a SONG entry when a SONG slot was added/removed. Keep it in the pure diff so it is unit-tested.

2. **Empty-checked-entries Send.**
   - What we know: the modal is checkable; the union of CHECKED entries drives "affected."
   - What's unclear: whether Send is allowed with zero entries checked (an empty audit, everyone/affected = ∅).
   - Recommendation: disable Send when no entries are checked (mirror the composer's `reachableCount === 0` disable); "Lock quietly" remains the zero-notice path.

## Environment Availability

Not applicable — Phase 62 is client TS/Vue + a functions type edit, both unit-tested against mocks. No new external tool/service/runtime is required. (The full app suite and any `vite build`/functions emulator run require `.env.local` per CLAUDE.md, but that is existing infrastructure, not a Phase 62 dependency.)

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` → treated as **enabled**.

### Test Frameworks (two separate suites)
| Property | App suite (client) | Functions suite (server) |
|----------|--------------------|--------------------------|
| Framework | Vitest (root, jsdom) | Vitest `^4.1.10` (node) |
| Config | `vite.config.ts` `test` block | `functions/vitest.config.ts` (env `node`) |
| Quick run command | `npx vitest run <file>` | `cd functions && npx vitest run src/index.test.ts` |
| Full suite command | `npx vitest run` (bare — excludes `rules.test.ts`, `render-service/**` per CLAUDE.md; ~300s timeout) | `cd functions && npm test` |
| Typecheck gate | `npm run type-check` (`vue-tsc --build`, **includes test files** — the narrow `-p tsconfig.app.json` is NOT sufficient evidence per CLAUDE.md) | `cd functions && npm run build` (= `tsc`) |

**Known-failing app-suite baseline (per CLAUDE.md, do NOT chase):** `src/storage.rules.test.ts` (Storage-emulator cross-service `firestore.exists()` limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). A Phase 62 change is regression-free if it adds no *new* failing app-suite file beyond these two.

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | Suite / File | Exists? |
|----------|----------|-----------|-------------------|--------------|---------|
| R146 (SONG) | A slot's `songId`/`songTitle` change (matched by stable id) → one SONG entry; unchanged slots → none | unit (pure) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | app | ❌ Wave 0 |
| R146 (ORDER) | A shared slot id moved index (content unchanged) → one ORDER entry; identical order → none | unit (pure) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | app | ❌ Wave 0 |
| R146 (ROLE) | A `roleAssignments[roleId].personNames` change → one ROLE entry; identical names → none | unit (pure) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | app | ❌ Wave 0 |
| R146 (NOTES) | `notes` string change → one NOTES entry | unit (pure) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | app | ❌ Wave 0 |
| R146 (SLIDES) | Fingerprint maps differ (group added/removed/reordered/edited) → one coarse SLIDES entry; identical maps → none | unit (pure) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | app | ❌ Wave 0 |
| R146 (empty) | Two identical snapshots + identical fingerprints → `[]` (drives the silent-overwrite branch) | unit (pure) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | app | ❌ Wave 0 |
| R147 (affectedTeams) | ROLE entry tags EXACTLY `roleAssignments[i].group`; SONG/ORDER/NOTES/SLIDES tag broad = groups with a non-empty role from CURRENT snapshot | unit (pure) | `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` | app | ❌ Wave 0 |
| SC1 | Re-lock with a non-empty diff (prior snapshot exists) opens `ReLockNotifyPrompt`; the snapshot is NOT overwritten before confirm | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | app | ❌ Wave 0 (edit) |
| SC1 (no-change) | Re-lock with an empty diff overwrites `lockSnapshots/current` silently, no prompt | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | app | ❌ Wave 0 (edit) |
| R144 (no regression) | First lock (no prior) still writes the snapshot + auto-sends `lock-notification`; now with a REAL fingerprint map (update the P61 `null` assertion) | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | app | ⚠ Update |
| SC4 | Confirming Send OR Lock-quietly overwrites `lockSnapshots/current` with the new snapshot + fingerprint | unit (component) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | app | ❌ Wave 0 (edit) |
| R146/R147 (modal) | Checkable rows render with team-label tags; toggling checks recomputes the affected-team union → "Reaches N" | unit (component) | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | app | ❌ Wave 0 |
| SC2 (modal) | Affected-vs-everyone switch changes `resolveRecipients` selection (union-of-checked-teams vs `includeEveryone`) and the count | unit (component) | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | app | ❌ Wave 0 |
| SC3 / R148 (modal) | "Lock quietly" is always present, sends no message, and still triggers the overwrite callback | unit (component) | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | app | ❌ Wave 0 |
| Send wiring (modal) | Send calls `queueServiceMessage` with `type:'relock-notification'`, the chosen `recipientSelector`, and `changeDiff` = checked entries | unit (component) | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts` | app | ❌ Wave 0 |
| Plumbing | `queueServiceMessage` accepts `type:'relock-notification'` (in `MESSAGE_TYPES`); a non-editor/kill-switch-off caller still rejected | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 (edit) |
| Plumbing (audit) | `createQueuedMessage` persists `changeDiff` (an array) on the doc; other types keep `changeDiff: null` | unit | `cd functions && npx vitest run src/index.test.ts` | functions | ❌ Wave 0 (edit) |
| Type gate | No new TS errors across src + tests, and functions builds | typecheck | `npm run type-check` **and** `cd functions && npm run build` | both | n/a |
| Regression gate | No new failing app-suite file beyond the two known-failing baseline files | full suite | `npx vitest run` (~300s timeout) | app | n/a |

### Sampling Rate
- **Per task commit:** the single new/edited spec — `npx vitest run <file>` (app) or `cd functions && npx vitest run src/index.test.ts` (functions).
- **Per wave merge:** the full app suite `npx vitest run` + `cd functions && npm test`, plus `npm run type-check` and `cd functions && npm run build`.
- **Phase gate:** full suites green (modulo the two known-failing baseline files) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/utils/__tests__/serviceLockDiff.test.ts` — the pure diff (every type + affectedTeams rule + empty-diff). Heaviest target; zero mocking.
- [ ] `src/components/__tests__/ReLockNotifyPrompt.test.ts` — checkable→Reaches-N, affected-vs-everyone, Send vs Lock-quietly, changeDiff passthrough.
- [ ] `src/views/__tests__/ServiceEditorView.test.ts` — EDIT: add re-lock branch cases (SC1/SC4, silent-overwrite); UPDATE the P61 `slideGroupsFingerprint: null` first-lock assertions.
- [ ] `functions/src/index.test.ts` — EDIT: `'relock-notification'` accepted + `changeDiff` persisted.

## Security Domain

> `security_enforcement` is not disabled in config → enabled. Messaging touches PII (volunteer names/emails), so this section applies.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `queueServiceMessage` requires Firebase Auth (`request.auth`); unchanged from Phase 59. |
| V4 Access Control | yes | `messages` create = `isOrgEditor(orgId)` (`firestore.rules:143`); the callable independently re-reads `organizations/{orgId}/members/{uid}` and requires role ∈ editor/admin; `lockSnapshots` write = `isOrgEditor` (`:164`). The client-declared `orgId` scopes the path only; membership is re-verified for that path. |
| V5 Input Validation | yes | `MESSAGE_TYPES.includes(type)` enum gate (`functions/src/index.ts:1372`) now includes `'relock-notification'`; `scheduledFor` sanity-checked; `changeDiff` is stored audit only, never rendered/evaluated (subject/body are the sent content, generated client-side and re-validated server-side exactly as Phase 59). |
| V6 Cryptography | no | The slide fingerprint is a non-security change-detector (DJB2), not a security hash. No secret, no signature — never used for auth or integrity. |
| V8 Data Protection / PII | yes | The re-lock notice recipient list is re-resolved SERVER-side (`sendQueuedMessage`), never the client's list (R131/R141). `changeDiff` descriptions may embed volunteer NAMES (from `roleAssignments[].personNames`) — this stays inside the org-scoped `messages/{id}` doc (read = `isOrgMember`, write-after-create = `false`), the same PII exposure surface as the already-shipped snapshot's `roleAssignments`. No emails are placed in `changeDiff`. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A viewer or wrong-org caller queues a re-lock notice | Elevation of Privilege | Server re-checks `isOrgEditor` + org membership for the path (`firestore.rules:143`, callable re-read); the client `orgId` is never trusted for authorization. |
| Kill-switch bypass (messaging turned off org-wide) | Spoofing / policy bypass | `queueServiceMessage` re-reads `settings.messaging.enabled` server-side and rejects when off (defense in depth); the modal is also gated on `isMessagingEnabled()` client-side. |
| Tampering with the audit `changeDiff` after send | Tampering / Repudiation | `messages` `update, delete: if false` (`firestore.rules:144`) — the doc (and its `changeDiff`) is immutable after create; no post-hoc edit vector. |
| PII leak of volunteer names/emails via the notice | Information Disclosure | Recipients re-resolved server-side (never a client-supplied list); `changeDiff` carries names only, inside an org-scoped, member-read doc; emails never enter `changeDiff`. Reachability split already excludes empty-email people (`resolveRecipients`). |
| Injection via auto-generated subject/body | Tampering | Subject/body are plain text rendered server-side per-recipient (Phase 59 token render, no HTML eval of `changeDiff`); `changeDiff` is data, never a template. |

## Sources

### Primary (HIGH confidence — in-repo, anchored)
- `src/types/service.ts:39-47,63-71` — `MediaAttachableSlot.id` (stable slot id, D-01) + `SongSlot` fields.
- `src/stores/services.ts:80-95,104-154` — `ServiceSnapshot` shape + `buildServiceSnapshot` (section-ordered slots, `roleAssignments`).
- `src/types/slideGroup.ts:11-15,22-36,44-95,165-186` — invariants (doc id = slot id; slide TEXT not stored; resolves via `sourceRef`); `SlideGroup`/`GroupSlideEntry`/`SourceRef` shapes.
- `src/stores/slideGroups.ts:38-68,402-414` — `useSlideGroups`, org-wide `groups` subscription, `groupsBySlotId`.
- `src/composables/useSlideshowAssembly.ts:185` — where `subscribeGroups` is called (groups populated at lock time).
- `src/views/ServiceEditorView.vue:2858-3007` (R144 block `:2907-2988`, local `QueueMessageRequest` `:2789-2798`, `LOCK_SUBJECT/BODY` `:2771-2785`, imports `:1593/1601/1619`) — the lock hook to restructure.
- `functions/src/index.ts:1206-1322` — `MessageType`/`MESSAGE_TYPES`, `QueueMessageRequest`, `QueuedMessageDoc` (`changeDiff: null`), `createQueuedMessage` (hard-coded `changeDiff: null`), the enum gate `:1372`.
- `src/utils/messagingRecipients.ts:17-83` — `MESSAGING_TEAM_LABELS`, `resolveRecipients`.
- `src/types/roster.ts:3` — `RoleGroup` union.
- `firestore.rules:141-165` — `messages` create=`isOrgEditor`/update-delete=`false`; `lockSnapshots` write=`isOrgEditor`.
- `.planning/research/ARCHITECTURE.md:539-601` — Re-Lock Change Diff (detection table, SLIDES recommendation (2), overwrite-on-confirm).
- `.planning/phases/61-.../61-RESEARCH.md` — the sibling phase this models on (lock hook, fingerprint-defer decision, two-suite validation).
- `.planning/ROADMAP.md:382-406` — Phase 62 goal + SC1–SC4.

### Secondary (MEDIUM confidence)
- `src/components/MessageComposer.vue:275-319,385-409,574` — the `resolveRecipients`/"Reaches N"/`queueServiceMessage` idioms the modal reuses (not the component itself).

### Tertiary (LOW confidence)
- None — every claim is anchored in-repo.

## Metadata

**Confidence breakdown:**
- Diff design (stable slot id, ROLE/NOTES/ORDER): HIGH — `ServiceSlot.id` and `ServiceSnapshot` fields confirmed in source.
- SLIDES fingerprint: HIGH on mechanism (source of groups, no stored text) / MEDIUM on the exact `sourceRef` serialization (discretion; A1 boundary noted).
- `changeDiff`/`MessageType` plumbing: HIGH — the hard-coded `null` and enum are read directly.
- Lock-hook restructure: HIGH — the exact block + read-before-write ordering confirmed; the deferred-overwrite discipline is the one new behavior.
- No new rules/index/secret/Function: HIGH — rules lines confirmed; no collectionGroup introduced.

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (stable — reuses shipped Phase 58/59/61 surfaces; re-verify if the messaging Functions are deployed/refactored in the interim).
