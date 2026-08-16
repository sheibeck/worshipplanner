# Phase 64: Composer Refinements - Research

**Researched:** 2026-08-15
**Domain:** Vue 3 SFC composer UX + one pure Firebase Functions token-renderer change (messaging surface, all UNDEPLOYED)
**Confidence:** HIGH (every claim anchored to a live file:line read this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **R151** — `MESSAGING_TEAM_LABELS` becomes `band→'Band'`, `tech→'Tech'`, `vocals→'Vocals'`, `other→'Other'` (raw RoleGroup names matching Volunteer Roles). One constant feeds the composer chips AND `ReLockNotifyPrompt.vue`. Update tests that hard-code "Worship"/"Hosts".
- **R152** — "+ Add someone" must visibly add a removable person and bump "Reaches N". Fix the affordance (a working, keyboard-accessible picker, not a `<label>` that only focuses a hidden select). Verify whether `Person.active` is reliable; if not, relax the filter to only-exclude-already-selected.
- **R153** — Remove the `Preview` button + `showPreview` gate; render `samplePreview` ALWAYS (it already recomputes reactively). Keep the "Sample" label + caption.
- **R154** — Client `tokenChips`: REMOVE `song_list`, ADD `{ token: 'name', label: 'Name' }`. Client `samplePreview`: render `{{name}}` as the sample recipient's name. Server renderer: ADD `{{name}}` → recipient's own name (per-recipient, like `{{their_roles}}`); KEEP `{{song_list}}` supported server-side. Functions change ships built/tested/UNDEPLOYED.
- **R155** — Composer Send button gets a visible in-progress spinner + "Sending…" while `sending`. REMOVE the success `toasts.push` (Option A) — leave the inline `sendError` path. History: a message stuck in `queued`/`sending` past a reasonable age surfaces as "Failed to send" / "Stuck" instead of a perpetual spinner. Read-only presentation change, no new write path.
- **R156** — Keep the dirty-guarded seeding. Align `TYPE_DEFAULTS` copy (oneoff blank; reminder subject `Reminder: {{service_date}}`, body seeded with service link + `{{name}}`/`{{their_roles}}`; share-link subject `Service plan for {{service_date}}`, body `{{service_link}}`). Reminder defaults `selection.includeEveryone = true` behind a new `recipientDirty` guard. One-off leaves recipients as-is.

### Claude's Discretion
- Exact add-person control shape (visible select vs typeahead), Send-button spinner styling, the "stuck" age threshold + label copy, the precise `TYPE_DEFAULTS` wording, and whether Share-link also defaults recipients (owner spec focuses on Reminder — apply to Reminder; leave Share/One-off manual).

### Deferred Ideas (OUT OF SCOPE)
- A real retry/re-send-from-history action (R155 needs only the failed/timeout *surfacing*).
- Typeahead person search for large rosters.
- Real email delivery / deploy (owner redeploys the send path; stays UNDEPLOYED).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R151 | Send-To labels mirror Volunteer Roles (Band/Vocals/Tech/Other) | One constant `MESSAGING_TEAM_LABELS` (messagingRecipients.ts:17); 4 test files hard-code old labels (see §R151) |
| R152 | "+ Add someone" actually adds | `Person.active` IS a real, reliably-set field; root cause is the `<label>`-wrapped-select affordance, not the filter (see §R152) |
| R153 | Live real-time preview (no click-to-preview) | `samplePreview` already reactive-computed (MessageComposer.vue:526); remove `v-if="showPreview"` gate + Preview button |
| R154 | Drop `{{song_list}}` from palette, add `{{name}}` | Server renderer in `functions/src/messageTokens.ts` (NOT index.ts); client `renderSample` in MessageComposer.vue:518 (see §R154) |
| R155 | Send spinner + kill perpetual "Sending…" + fix success toast | `sending` ref + `sendLabel` already present; `createdAt`/`sentAt` on `ServiceMessageDoc`; ToastHost is failure-only (see §R155) |
| R156 | Message types seed distinct content | `selectType`/`TYPE_DEFAULTS`/`subjectDirty`/`bodyDirty` present; add `recipientDirty` (see §R156) |
</phase_requirements>

## Summary

Phase 64 is six independent, low-risk refinements to the already-shipped ✉ Messages composer. Five are pure client-side Vue changes in `src/components/MessageComposer.vue` and `src/components/ServiceMessageHistory.vue` plus the one-line label constant in `src/utils/messagingRecipients.ts`. Exactly one change touches Firebase Functions: R154's `{{name}}` server token, which is a small additive edit to the pure renderer in `functions/src/messageTokens.ts` and its single call site in `functions/src/index.ts`. That functions change ships built + tested but UNDEPLOYED (owner redeploys the send path).

The three concrete findings that steer planning: (1) the server renderer is **`functions/src/messageTokens.ts`**, imported at `index.ts:18` — CONTEXT said "in `functions/src/index.ts`", but the actual pure function lives in the sibling file; the per-recipient `name` is already available as `target.name` at the call site (`index.ts:1738`). (2) `Person.active` is a **real, required, reliably-populated** field (`roster.ts:22`, soft-delete inverse D-20) — so the empty-dropdown risk is NOT from the `active` filter; the true R152 root cause is the affordance (the `<label>` at MessageComposer.vue:97 only focuses a hidden `<select>`; the add fires solely on `@change`). Keep the `active` filter; fix the control. (3) `ServiceMessageDoc` carries both `createdAt` and `sentAt` as `Timestamp | null` (`serviceMessages.ts:59,61`) — R155's "stuck" affordance compares `createdAt.toMillis()` against `Date.now()` with a ~5-minute (300000 ms) default threshold.

**Primary recommendation:** Treat R151/R153/R155-composer/R156 as small edits to one SFC; R154 as a paired client+functions edit that must keep client-render and server-render token semantics identical; R152 as an affordance fix (not a filter fix); R155-history as a read-only `statusPill`/`sendTimeLabel` age check. Update the four R151 label tests, the one composer toast test, and the functions `messageTokens.test.ts` ctx helper.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Team-label display (R151) | Client util constant | — | `MESSAGING_TEAM_LABELS` is a presentation remap; consumed by two Vue components only |
| Add-individual picker (R152) | Client component | — | Pure selection-state mutation in the composer; no server contract change |
| Live preview (R153) | Client component | — | `samplePreview` is a client-only representative render; server does the authoritative per-person render at send time |
| `{{name}}` token (R154) | API / Functions (send trigger) | Client component (sample render only) | Authoritative per-recipient substitution is server-side (R139 precedent); client only mirrors it for the sample |
| Send spinner + toast (R155) | Client component | — | In-flight UI state + toast suppression; no write-path change |
| Stuck-message surfacing (R155) | Client component | — | Read-only presentation over existing `createdAt`/`status`; no new write |
| Type seeding (R156) | Client component | — | `TYPE_DEFAULTS` + dirty guards are compose-local state |

## Standard Stack

No new packages. All changes use the existing stack (Vue 3 `<script setup>`, Pinia toasts store, Firebase callable/trigger, Vitest). **No `## Package Legitimacy Audit` needed — this phase installs nothing.**

## Findings by Requirement

### R151 — Team labels (client util constant)

**Change:** `src/utils/messagingRecipients.ts:17-22` `MESSAGING_TEAM_LABELS` — `band: 'Worship'→'Band'`, `other: 'Hosts'→'Other'` (`tech`/`vocals` unchanged). `[VERIFIED: messagingRecipients.ts:17-22]`

This constant is the single source for the composer team chips (`MessageComposer.vue:396-400` maps `Object.keys(MESSAGING_TEAM_LABELS)`) and `ReLockNotifyPrompt.vue`'s team tags — one edit, consistent everywhere. `[VERIFIED: MessageComposer.vue:275,396]`

**Tests that hard-code the old labels and MUST update** (grep-confirmed):
| File:line | Current assertion | New |
|-----------|-------------------|-----|
| `src/utils/__tests__/messagingRecipients.test.ts:86,89` | `band: 'Worship'`, `other: 'Hosts'` | `'Band'`, `'Other'` `[VERIFIED]` |
| `src/components/__tests__/MessageComposer.test.ts:140,141,170` | `toContain('Worship')`, `toContain('Hosts')`, `/Worship\s*·\s*1/` | `'Band'`, `'Other'`, `/Band\s*·\s*1/` `[VERIFIED]` |
| `src/components/__tests__/ReLockNotifyPrompt.test.ts:156-160` | `toContain('Worship')` (×3) | `'Band'` `[VERIFIED]` |
| `src/views/__tests__/ServiceEditorView.test.ts:97` | MOCK `MESSAGING_TEAM_LABELS: { band: 'Worship', … other: 'Hosts' }` | update mock to `'Band'`/`'Other'` for consistency `[VERIFIED]` |

**Nuance:** `ServiceEditorView.test.ts:97` mocks the constant, and its assertion at `:1780` reads `toContain('Worship')` off the mock — so it passes regardless of the real constant. Update BOTH the mock (`:97`) and the assertion (`:1780`) to `'Band'` so the test reflects reality. `[VERIFIED: ServiceEditorView.test.ts:97,1780]`

The non-messaging "Worship" hits in the grep (hymn titles, VW methodology, "Worship Song -" PC export prefix, `ServiceEditorView.vue:1684` role-name variants) are UNRELATED and must NOT be touched.

### R152 — "+ Add someone" actually adds

**`Person.active` is a real, reliably-populated field.** `roster.ts:13-25` declares `active: boolean` as a **required** field with the doc comment "soft-delete inverse (D-20); inactive people drop out of proposals + pickers." `[VERIFIED: roster.ts:22]` The composer test fixture sets `active: true` on every person (`MessageComposer.test.ts:51`). `[VERIFIED: MessageComposer.test.ts:51]` Because `active` is a required boolean on the `Person` type and its documented purpose is exactly "exclude inactive people from pickers," the `addablePeople` filter (`MessageComposer.vue:412`, `p.active && !alreadySelected`) is **correct and intended** — inactive people SHOULD be hidden. `[VERIFIED: MessageComposer.vue:412]`

→ **The empty-dropdown risk is NOT the `active` filter** (confidence MEDIUM-HIGH; the type guarantees the field exists, and roster semantics guarantee real/active people carry `true`). The real root cause is candidate (a): the picker is a `<label>` (`MessageComposer.vue:97`) wrapping a `<select>` whose add fires only on `@change="onAddIndividual"` (`:102`). Clicking the "＋ Add someone" text focuses the select but adds nothing — a confusing affordance. `[VERIFIED: MessageComposer.vue:97-107]`

`onAddIndividual` itself is **correct**: it reads `el.value`, pushes to `selection.individualPersonIds` when not already present, and resets `el.value = ''` (`:449-454`). The pills + `removeIndividual` + "Reaches N" already react to `selection.individualPersonIds`. `[VERIFIED: MessageComposer.vue:449-459,109-125,234]`

**Recommendation:** Keep the `p.active` filter. Fix the *control* — expose a visible, labeled `<select>` (not hidden behind a button-styled `<label>`) and/or an explicit "Add" affordance, keyboard-accessible, whose selection routes through the existing `onAddIndividual` logic. UI-SPEC picks the exact shape. **Planner note:** if the planner wants belt-and-suspenders, a `checkpoint:human-verify` could confirm the roster create path always writes `active: true`; but the type contract already makes this safe, so it is optional, not required.

### R153 — Live preview

`samplePreview` is ALREADY a reactive `computed` rendering subject/body tokens against `sampleRecipient` (`MessageComposer.vue:526-529`, `sampleRecipient` = `resolved.value.reachable[0]` at `:489`). It updates in real time as subject/body/recipients change. `[VERIFIED: MessageComposer.vue:489,526-529]`

**Change:** Remove the `v-if="showPreview"` gate on the preview block (`:194`), remove the Preview button (`:241-246`), and remove the `showPreview` ref (`:351`) + its reset (`:629`). Keep the "Sample" badge + `sampleCaption` (`:195-198`). No logic change to the computed. `[VERIFIED: MessageComposer.vue:194,241-246,351,629]`

### R154 — Merge tokens (client + one functions change)

**Server renderer location correction:** the pure renderer is **`functions/src/messageTokens.ts`**, imported at `functions/src/index.ts:18` (`import { renderMessageTokens } from "./messageTokens"`). CONTEXT said "the 59-03 `renderMessageTokens` … in `functions/src/index.ts`" — the *call site* is in index.ts; the *function* is the sibling file. `[VERIFIED: index.ts:18, messageTokens.ts:54]`

**Server change (additive):**
1. Add `recipientName: string` to the `MessageTokenContext` interface (`messageTokens.ts:18-27`). `[VERIFIED: messageTokens.ts:18-27]`
2. Add one line in `renderMessageTokens` (`:54-63`): `out = replaceToken(out, "name", ctx.recipientName);` — using the existing private `replaceToken` regex-escape helper (`:44-47`), exactly like the four current tokens. `[VERIFIED: messageTokens.ts:44-63]`
3. At the single call site (`index.ts:1738`), the per-recipient `name` is already in scope as `target.name` — the `tokenCtx` object literal just gains `recipientName: target.name`. `target` comes from `sendList`, whose entries carry `name` (`:1711-1716` `name: r.name`, and the self-copy `name: "You"` at `:1720`). `[VERIFIED: index.ts:1711-1720,1738]`

**Keep `{{song_list}}` supported server-side** — no removal. The renderer's `song_list` branch (`messageTokens.ts:56,61`) stays; only the CLIENT palette drops the chip. Older/scheduled/relock docs may still contain `{{song_list}}` and must render. `[VERIFIED: messageTokens.ts:56,61]` Confirmed: dropping the client chip does NOT require any server removal.

**Client change (`MessageComposer.vue`):**
1. `tokenChips` (`:362-367`): remove `{ token: 'song_list', label: 'Song list' }`; add `{ token: 'name', label: 'Name' }`. `[VERIFIED: MessageComposer.vue:362-367]`
2. `renderSample` (`:518-524`) uses the local `fillToken` split/join helper. Add `out = fillToken(out, 'name', sampleRecipient.value?.name ?? '[name]')`. `[VERIFIED: MessageComposer.vue:514-524,489]` The client already fills `service_date`, `service_link`, `their_roles`, `song_list` — adding `name` keeps the sample render faithful to the server. Leaving the `song_list` fill line in `renderSample` is harmless (the chip is gone so users won't insert it, but a legacy/seeded template containing it still renders in the sample) — this MATCHES the server keeping `song_list`, so it is the correct choice.

**Client/server parity check:** after these edits both renderers substitute the same five tokens (`service_date`, `service_link`, `their_roles`, `song_list`, `name`); the client's `name` value (`sampleRecipient.name`) is the same field the server passes (`target.name`). Preview is faithful. `[VERIFIED: cross-referenced messageTokens.ts + MessageComposer.vue]`

**Functions test impact:** `functions/src/messageTokens.test.ts` builds a full context via the `ctx()` helper (`:9-17`). Adding a required `recipientName` to `MessageTokenContext` makes `ctx()` a type error until it gains a default (e.g. `recipientName: "Alex Kim"`). Add a `{{name}}` test case alongside the existing per-token cases. `[VERIFIED: messageTokens.test.ts:1-53]`

### R155 — Spinner, toast, and stuck-message affordance

**Composer spinner:** `sending` ref exists (`:349`); `sendDisabled` includes `sending.value` (`:547-553`); `sendLabel` already returns `'Sending…'`/`'Scheduling…'` while sending (`:559-562`). `[VERIFIED: MessageComposer.vue:349,547-562]` The only gap is a VISIBLE spinner glyph on the Send button (`:253-260`). Add an animated spinner span shown when `sending` (the `ServiceMessageHistory.vue:87` spinner markup — `h-3 w-3 border-2 … animate-spin` — is a reusable idiom). `ReLockNotifyPrompt.test.ts:297-307` shows the sibling pattern (Send disabled + "Sending…" in flight). `[VERIFIED: ServiceMessageHistory.vue:87, ReLockNotifyPrompt.test.ts:297-307]`

**Toast fix (Option A — remove the success push):** `onSend` calls `toasts.push('Message queued to N …'/'Message scheduled')` on success (`:592-596`). `ToastHost.vue:18` hard-codes a red `<span>Save failed.</span>` prefix — it is a **failure-only** stack — so success renders "Save failed. Message queued…". `[VERIFIED: MessageComposer.vue:592-596, ToastHost.vue:18]` Remove the `toasts.push(...)` block entirely (both the scheduled and send-now branches). The composer already `emit('sent', …)` (`:597`) and the parent closes it; the Phase 60/63 history panel shows the result. Leave the inline `sendError` path (`:600`) untouched. `[VERIFIED: MessageComposer.vue:597,600]`

**Test to update:** `MessageComposer.test.ts:327` asserts `expect(mockToastPush).toHaveBeenCalledTimes(1)` after a successful send (comment at `:324` "raises a toast"). Change to `expect(mockToastPush).not.toHaveBeenCalled()` and drop the stale comment. No other test asserts the success toast; the "Save failed." assertions in `ToastHost.test.ts:32,94` and `toasts.test.ts` are ToastHost/store unit tests and stay as-is. `[VERIFIED: MessageComposer.test.ts:324-327]`

**History stuck affordance (read-only):** `ServiceMessageDoc` carries `createdAt: Timestamp | null`, `sentAt: Timestamp | null`, `scheduledFor: string | null`, and `status` ∈ `queued|scheduled|sending|sent|partial|failed` (`serviceMessages.ts:30-63`). `createdAt` is the server `FieldValue.serverTimestamp()` set by `createQueuedMessage` (`index.ts:1340`, `sentAt: null` until the send trigger flips it at `:1798`). `[VERIFIED: serviceMessages.ts:30-63, index.ts:1332-1342,1795-1799]`

The status→label mapping lives in TWO functions:
- `statusPill(message)` (`ServiceMessageHistory.vue:211-225`): `queued`/`sending` → `{ label: 'Sending…', spinner: true }`. `[VERIFIED: ServiceMessageHistory.vue:219-221]`
- `sendTimeLabel(message)` (`:241-255`): `queued`/`sending` → returns the string `'Sending…'`. `[VERIFIED: ServiceMessageHistory.vue:247-249]`

**Recommended presentation:** in `statusPill`, for `queued`/`sending`, compute age from `createdAt`: `const ageMs = message.createdAt ? Date.now() - message.createdAt.toMillis() : 0`. If `message.createdAt` is non-null AND `ageMs > STUCK_THRESHOLD_MS`, return the failed-style pill (`bg-red-900/50 text-red-300 border-red-800`, `spinner: false`, label `'Failed to send'` or `'Stuck'` — copy is discretion) instead of the spinner. Otherwise keep the current spinner pill. Mirror the same age check in `sendTimeLabel`. `[VERIFIED: ServiceMessageHistory.vue:211-255]`

- **Field to compare:** `createdAt` (server-set on queue). `sentAt` is `null` while queued, so it is NOT the age source. Guard the null case: a freshly-written doc may briefly have `createdAt: null` (serverTimestamp sentinel not yet resolved) — treat null as "not stuck" (keep spinner).
- **Default threshold:** `STUCK_THRESHOLD_MS = 5 * 60 * 1000` (300000 ms / 5 min), per CONTEXT's suggested default. Adjustable by UI-SPEC.
- **No write path.** This is pure presentation over existing fields — no retry action (deferred), no status mutation.

### R156 — Message types seed distinct content

`selectType(t)` (`:462-467`) applies `TYPE_DEFAULTS[t]` to `subject`/`body` behind `if (!subjectDirty.value)` / `if (!bodyDirty.value)` guards, set by the subject/body `@input` handlers (`:162,176`). `[VERIFIED: MessageComposer.vue:462-467,162,176,341-342]`

**Changes:**
1. **Align `TYPE_DEFAULTS` copy** (`:371-381`) to the agreed content (oneoff blank; reminder subject `Reminder: {{service_date}}` + body with `{{service_link}}`/`{{name}}`/`{{their_roles}}`; share-link subject `Service plan for {{service_date}}`, body `{{service_link}}`). **Safe to change:** grep confirms the current strings `'Reminder: serving on {{service_date}}'` and `'Service order for {{service_date}}'` appear ONLY in `MessageComposer.vue` — no test asserts `TYPE_DEFAULTS` content. `[VERIFIED: grep 'Reminder: serving'/'Service order for' → MessageComposer.vue only]`
2. **Add a `recipientDirty` ref** (default `false`), set `true` in `toggleTeam`, `toggleEveryone`, `onAddIndividual`, `removeIndividual` (`:431-459`), and reset in `resetComposer` (`:614-630`). In `selectType('reminder')`: `if (!recipientDirty.value) selection.includeEveryone = true`. One-off and Share-link leave recipients as-is (owner spec is Reminder-only). `[VERIFIED: MessageComposer.vue:431-459,614-630]`

With R153's always-on preview, switching type now visibly re-renders the sample email — closing the "types do nothing" perception.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-recipient token substitution | A new client-side renderer | Existing `renderMessageTokens` (server, authoritative) + the existing `fillToken` sample helper | Two renderers already exist and must stay in lockstep; adding a third invites drift |
| Recipient resolution / "Reaches N" | Re-resolve people in the composer | `resolveRecipients` (messagingRecipients.ts) already wired via `resolved` computed | Pure Phase-58 resolver, deduped + reachability-split |
| Spinner markup | New spinner component | The `border-2 … animate-spin` idiom already in ServiceMessageHistory.vue:87 / history loading | Consistent visual, zero new deps |

## Common Pitfalls

### Pitfall 1: Editing the wrong renderer for R154
`renderMessageTokens` is in `functions/src/messageTokens.ts`, NOT `functions/src/index.ts` (index.ts only imports + calls it). Adding a required field to `MessageTokenContext` breaks `messageTokens.test.ts`'s `ctx()` helper until it gets a `recipientName` default. **Warning sign:** `cd functions && npm run build` TS error on the test file.

### Pitfall 2: Assuming R152 is a filter bug
`Person.active` is required and reliable; removing the `active` filter would wrongly re-surface soft-deleted people in the picker. The fix is the affordance, not the filter.

### Pitfall 3: Null `createdAt` on a just-queued doc (R155)
`createdAt` is a serverTimestamp sentinel — briefly `null` in the client snapshot before the write resolves. If the stuck-check treats `null` as age `0` from epoch, every fresh message flashes "Failed". Guard: `null` ⇒ not stuck (keep spinner).

### Pitfall 4: Removing only one of the two "Sending…" sites
The history label lives in BOTH `statusPill` and `sendTimeLabel`. Update both or the pill says "Failed" while the time column still says "Sending…".

### Pitfall 5: Touching unrelated "Worship" strings
"Worship" appears in hymn titles, VW methodology copy, and the PC "Worship Song -" export prefix. Only the two `MESSAGING_TEAM_LABELS` values (`band`, `other`) and their tests change.

## Runtime State Inventory

Not a rename/migration phase in the datastore sense, but R154 has a data-compatibility angle worth noting:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `messages/{id}` docs store RAW token templates in `subject`/`body` (never pre-rendered — index.ts:1295). Existing/scheduled docs may contain `{{song_list}}`. | None — server keeps `song_list` support; new `{{name}}` renders on send. No migration. |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | `RESEND_API_KEY`, `MESSAGE_FROM_ADDRESS` (send trigger, unchanged) | None — R154 touches only the pure renderer + call-site literal |
| Build artifacts | `functions/` must be rebuilt (`npm run build`) before deploy | Owner redeploys (UNDEPLOYED per phase boundary) |

## Validation Architecture

Nyquist validation treated as ENABLED (default). Test commands per CLAUDE.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (client, jsdom, root config); Vitest (functions, node env, `functions/` package) |
| Client quick run | `npx vitest run <file>` (single file) |
| Client type gate | `npm run type-check` (vue-tsc --build — typechecks test files too; the `-p tsconfig.app.json` form is INSUFFICIENT per CLAUDE.md) |
| Functions test | `cd functions && npm test` |
| Functions type/build gate | `cd functions && npm run build` |
| App suite (2-file baseline, ~300s) | bare `npx vitest run` (excludes `src/rules.test.ts` + `render-service/**`; known-failing baseline: `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | Tier | File exists? |
|-----|----------|-----------|-------------------|------|--------------|
| R151 | Chips read Band/Vocals/Tech/Other; resolver labels updated | unit | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts src/components/__tests__/MessageComposer.test.ts src/components/__tests__/ReLockNotifyPrompt.test.ts` | client-only | ✅ (update assertions) |
| R152 | Selecting a person in the picker pushes a removable pill + bumps "Reaches N"; keyboard-accessible | component | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | client-only | ✅ (add add-person test) |
| R153 | Preview renders without clicking; updates on subject/body edit | component | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | client-only | ✅ (assert `sample-preview` present without Preview click) |
| R154 (client) | `name` chip present, `song_list` chip gone; sample renders `{{name}}` | component | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | client-only | ✅ |
| R154 (server) | `renderMessageTokens` substitutes `{{name}}`; still supports `{{song_list}}` | unit | `cd functions && npm test` + `cd functions && npm run build` | **functions (the one server change)** | ✅ (add `{{name}}` case; fix `ctx()` helper) |
| R155 (spinner) | Send button shows spinner + disabled while `sending` | component | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | client-only | ✅ |
| R155 (toast) | No `toasts.push` on success; `emit('sent')` still fires | component | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | client-only | ✅ (update `:327` to `not.toHaveBeenCalled()`) |
| R155 (stuck) | Aged `queued`/`sending` past threshold renders Failed pill, not spinner; fresh/null `createdAt` keeps spinner | component | `npx vitest run src/components/__tests__/ServiceMessageHistory.test.ts` | client-only | ✅ (add aged-queued case) |
| R156 | Type switch re-seeds subject/body behind dirty guard; Reminder sets `includeEveryone` behind `recipientDirty` | component | `npx vitest run src/components/__tests__/MessageComposer.test.ts` | client-only | ✅ (add recipient-default + recipientDirty cases) |

### Sampling Rate
- **Per task commit:** the single relevant `npx vitest run <file>` + `npm run type-check` (client) OR `cd functions && npm test && npm run build` (R154 server task).
- **Per wave merge:** all touched client spec files in one `npx vitest run <files…>`.
- **Phase gate:** bare `npx vitest run` (full app suite, ~300s) green against the known 2-file baseline, plus `cd functions && npm test` green, before `/gsd-verify-work`.

### Wave 0 Gaps
- `src/components/__tests__/ServiceMessageHistory.test.ts` — confirm it exists and covers the new aged-queued path; if the stuck-affordance branch is uncovered, add it. (All other target spec files exist.)
- No framework install needed.

## Security Domain

Low-surface phase; `security_enforcement` treated as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V5 Input Validation / Output Encoding | yes | R154 `{{name}}` is server-substituted into a **plaintext** email (`resend.emails.send({ text: body })`, index.ts:1746) — no HTML context, so no new XSS surface. The renderer's `replaceToken` regex-escapes the token *name*, not the value; the value is a roster-entered person name in a text body. No change to injection posture. |
| V4 Access Control | unchanged | Send path already re-verifies org membership + editor role + kill-switch server-side (index.ts:1351-1362). Phase 64 adds no new callable/trigger and no new client trust. |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Recipient name injected into email body via `{{name}}` | Tampering/Injection | Plaintext `text:` body (not HTML); name is org-scoped roster data written by an editor; no new escaping required. If a future change moves to an HTML email body, `{{name}}` (and all tokens) would need HTML-escaping — flag for that future phase, out of scope here. |
| Client sends resolved emails | Information Disclosure | Unchanged — composer sends only a `recipientSelector`; server re-resolves (existing test `MessageComposer.test.ts:318-322` asserts no `@example.com` in payload). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Roster create path always writes `active: true` for new people (inferred from the required `active: boolean` type + D-20 soft-delete semantics; the roster store create path was not read this session) | R152 | If some create path omits `active`, the picker could hide real people — mitigated by keeping the filter defensive; planner may add an optional human-verify checkpoint |
| A2 | 5-minute (300000 ms) stuck threshold is acceptable UX | R155 history | Too low ⇒ premature "Failed" on a slow send; too high ⇒ perpetual spinner persists. Discretion per CONTEXT; tune in UI-SPEC |
| A3 | `ServiceMessageHistory.test.ts` exists and can host the aged-queued case | Validation | If absent, Wave 0 must create it |

**Non-assumed (verified this session):** server renderer file location, `Person.active` field existence, `createdAt`/`sentAt` presence + types, the two "Sending…" sites, the failure-only ToastHost, the four R151 test locations, the composer toast test at `:327`, and that no test asserts `TYPE_DEFAULTS` copy.

## Open Questions

1. **Exact add-person control shape (R152)** — visible `<select>` vs typeahead. Recommendation: visible labeled `<select>` + explicit "Add", routed through existing `onAddIndividual`; typeahead is deferred. UI-SPEC decides.
2. **Stuck label copy + threshold (R155)** — "Failed to send" vs "Stuck — retry"; 5 min default. Discretion; no retry action (deferred).
3. **Share-link recipient default (R156)** — CONTEXT scopes the everyone-default to Reminder only; leave Share/One-off manual unless UI-SPEC says otherwise.

## Environment Availability

No external tools/services introduced. Existing Node/npm + Firebase functions toolchain (already present) cover the one functions build. `.env.local` required for the full app suite and any functions run (per CLAUDE.md) — assumed present in the main checkout.

## Sources

### Primary (HIGH confidence — live files read this session)
- `src/components/MessageComposer.vue` (full) — chips, picker, preview, tokens, send, seeding
- `src/components/ServiceMessageHistory.vue` (full) — `statusPill`, `sendTimeLabel`
- `src/utils/messagingRecipients.ts` — `MESSAGING_TEAM_LABELS`, `resolveRecipients`
- `src/types/roster.ts` — `Person.active`
- `src/stores/serviceMessages.ts:29-98` — `ServiceMessageDoc` (`createdAt`/`sentAt`/`status`)
- `functions/src/messageTokens.ts` (full) + `functions/src/messageTokens.test.ts:1-53`
- `functions/src/index.ts:18,1290-1344,1690-1805` — call site, `createQueuedMessage`, send loop
- `src/components/__tests__/MessageComposer.test.ts:300-364,51,138-179`
- Grep across `src/**/*.{ts,vue}` for label/toast/token strings (R151/R155/R156 test-impact)

### Secondary
- `.planning/phases/59-messages-composer-send-path/59-RESEARCH.md` (referenced as model; not re-quoted)

## Metadata

**Confidence breakdown:**
- R151/R153/R155-composer/R156 mechanics: HIGH — direct file:line reads
- R154 client+server wiring: HIGH — both renderers + call site read
- R152 root cause + `active` reliability: MEDIUM-HIGH — type guarantees the field; roster create path not read (A1)
- R155 stuck threshold: MEDIUM — timestamp fields verified; threshold is a UX default (A2)

**Research date:** 2026-08-15
**Valid until:** 2026-09-14 (stable; codebase-anchored, low churn)
