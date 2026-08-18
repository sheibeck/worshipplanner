# Phase 64: Composer Refinements - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 4 shipped source files + 4 test files (all EDITS, no new files)
**Analogs found:** 8 / 8 changes mapped to an in-repo analog

> All Phase 64 work is edits to already-shipped files. "Analog" here means the
> existing in-repo pattern each edit must copy/mirror so the change stays
> consistent with the codebase. Nothing is greenfield.

## File Classification

| Modified File | Role | Data Flow | Change(s) | Closest Analog | Match |
|---------------|------|-----------|-----------|----------------|-------|
| `src/utils/messagingRecipients.ts` | utility (label constant) | transform | R151 | `RolesConfigPanel.vue::groupLabels` | exact |
| `src/components/MessageComposer.vue` | component (modal) | request-response | R152/R153/R154-client/R155-spinner+toast/R156 | self + `QuarterGrid.vue` add-picker + `ServiceMessageHistory.vue` spinner | mixed (see below) |
| `src/components/ServiceMessageHistory.vue` | component (read-only list) | request-response | R155-history | self (`statusPill`/`sendTimeLabel`) | exact (self) |
| `functions/src/messageTokens.ts` + `functions/src/index.ts` | service (send trigger) | batch/per-recipient | R154-server | `renderMessageTokens` `their_roles` path | exact |

---

## Pattern Assignments

### R151 — `MESSAGING_TEAM_LABELS` (messagingRecipients.ts:17-22)

**Change:** remap values `band:'Worship'→'Band'`, `other:'Hosts'→'Other'` (tech/vocals unchanged).

**Analog (authoritative label source):** `src/components/RolesConfigPanel.vue:119`
```ts
const groupLabels: Record<RoleGroup, string> = { band: 'Band', tech: 'Tech', vocals: 'Vocals', other: 'Other' }
```
Also confirmed by the raw `<option>` values in the add-role form (`RolesConfigPanel.vue:87-90`:
`Band / Vocals / Tech / Other`) — these are exactly what users see in Volunteer Roles.

**Copy vs change:** Copy the four RHS strings verbatim from `groupLabels`. Do NOT
`import` `groupLabels` — the file comment (`messagingRecipients.ts:11-16`) deliberately keeps
this constant independent ("Two UIs are allowed to describe the same enum differently"). Keep it
its own literal; just make the values match.

**Traps:**
- **Breaks hard-coded assertions.** `src/utils/__tests__/messagingRecipients.test.ts:86,89`
  asserts `band:'Worship'` / `other:'Hosts'`; `src/components/__tests__/MessageComposer.test.ts:139-141,170`
  asserts chips contain `'Worship'` / `'Hosts'` and `/Worship\s*·\s*1/`;
  `src/views/__tests__/ServiceEditorView.test.ts:97` mocks `MESSAGING_TEAM_LABELS` with the old
  values. All must be updated to `Band`/`Other`.
- This constant also feeds `ReLockNotifyPrompt.vue` team tags — one change propagates; verify no
  other file asserts the old strings (grep `Worship`/`Hosts` — `ServiceEditorView.vue:1684-1685`
  `Worship Band`/`Worship Vocals` are unrelated normalization aliases, leave them).

---

### R152 — "+ Add someone" actually adds (MessageComposer.vue:93-107, 449-454, 412)

**Change:** replace the label-wrapped hidden `<select>` (`:99-107`) with a clear picker + explicit
Add affordance; relax/verify the `addablePeople` `active` filter (`:412`).

**Analog (in-app "select a person and add" pattern):** `src/components/QuarterGrid.vue:172-194`
```html
<select v-model="addSelectByRole[role.id]" class="text-xs rounded-md bg-gray-800 border border-gray-700 …">
  <option value="">Add a person…</option>
  <option v-for="candidate in availableUnassigned(activeDate, role.id)" :key="candidate.id" :value="candidate.id">
    {{ candidate.name }}
  </option>
</select>
<button type="button" :disabled="!addSelectByRole[role.id]" @click="onAdd(role.id)">Assign</button>
```
This is the canonical pattern: a **visible** `<select>` bound to a ref + an explicit **Assign**
button that is disabled until a choice is made. Mirror it: bind the picker to a new
`addSelect` ref, show a visible "Add" button `@click` that pushes into
`selection.individualPersonIds` and clears the ref.

**Self-analogs already correct (keep):** the removable pills + `removeIndividual`
(`MessageComposer.vue:109-125, 456-459`) and `onAddIndividual` push-and-dedup logic
(`:449-454`) already work — reuse the mutation, only change the affordance. "Reaches N"
(`reaches-count`, `:234`) already reflects `selection` reactively.

**Copy vs change:** Copy QuarterGrid's visible-select + explicit-button shape. Change the
`addablePeople` filter (`:412`) — see trap.

**Traps:**
- **`active`-filter risk.** `addablePeople = props.people.filter((p) => p.active && …)` (`:412`).
  If roster `Person.active` is falsy/undefined for real people the dropdown is EMPTY and nothing
  can be added — the likely root cause. Verify whether roster people carry `active:true`; if
  unreliable, relax to exclude only already-selected ids (drop the `p.active` clause). QuarterGrid's
  `availableUnassigned` (`:360`) filters on tier/`out`, not a raw `active` flag — precedent for not
  gating the picker on `active`.
- Keep keyboard-accessible (native `<select>` + `<button>` already are).
- Test extends: `MessageComposer.test.ts:138` (`add-someone-select` exists), `:179-185` (select a
  person → `Reaches 1`). If the `data-testid` changes, update these; prefer keeping
  `add-someone-select` on the visible select to minimize churn.

---

### R153 — Always-on live preview (MessageComposer.vue:194, 243-246, 351, 629)

**Change:** delete the `showPreview` gate — render the sample preview unconditionally.

**Analog:** the preview computed is ALREADY the "always-reactive computed" pattern —
`samplePreview` (`:526-529`) recomputes from `subject`/`body`/`sampleRecipient` with no gate. The
only thing gating its *display* is `v-if="showPreview"` (`:194`). The change is a **deletion**:
- remove `v-if="showPreview"` on the preview block (`:194`) — render always;
- remove the Preview button (`:243-246`, `data-testid="preview-btn"`);
- remove the `showPreview` ref (`:351`) and its reset line (`:629`).

Precedent for "an always-rendered reactive computed with no toggle" elsewhere in this same
component: `resolved`/`reachableCount` (`:384-385`) and `teamChips` (`:395-401`) render live with
no gate — `samplePreview` should match them.

**Copy vs change:** Pure deletion of a gate; keep the "Sample" badge + `sampleCaption` (`:195-197`)
so it stays clearly representative.

**Traps:** none structural. Any test asserting `preview-btn` must be removed/updated (grep shows no
current assertion on `preview-btn` in `MessageComposer.test.ts`).

---

### R154 — Tokens: drop `{{song_list}}` chip, add `{{name}}` (client + server)

**Client — `tokenChips` (MessageComposer.vue:362-367) + `samplePreview` render (:514-524).**
- Remove `{ token: 'song_list', label: 'Song list' }` from `tokenChips` (`:366`); add
  `{ token: 'name', label: 'Name' }`.
- Analog for the sample substitution: `renderSample` (`:518-524`) already fills tokens via
  `fillToken(...)`. Add `out = fillToken(out, 'name', sampleRecipient.value?.name ?? '[name]')`
  mirroring the existing `their_roles` line (`:521`). Keep the `song_list` fill line (`:522`)
  harmless or drop with the chip — but see server trap: server support stays.

**Server — `renderMessageTokens` (functions/src/messageTokens.ts:54-64) + call site (index.ts:1738-1740).**
- **Exact per-recipient substitution to mirror** is the `their_roles` line
  (`messageTokens.ts:60`): `out = replaceToken(out, "their_roles", rolesText);`. Add a sibling:
  `out = replaceToken(out, "name", ctx.recipientName);`.
- Extend `MessageTokenContext` (`messageTokens.ts:18-27`) with `recipientName: string` (the new
  per-recipient field, documented like `theirRoles` at `:21`).
- Populate at the call site: `index.ts:1738`
  `const tokenCtx = { serviceDate, theirRoles: target.roleNames, songTitles, serviceLink };`
  → add `recipientName: target.name` (`target.name` is already on `SendTarget`, set at
  `index.ts:1711-1720`). This is the exact per-recipient render loop — `{{name}}` is
  personalized identically to `{{their_roles}}`.

**Copy vs change:** Copy the `their_roles` replaceToken line + its interface field. Change client
chip list.

**Traps:**
- **KEEP server `{{song_list}}` support.** `messageTokens.ts:61` must stay — older/scheduled docs
  and `ReLockNotifyPrompt.vue` bodies may still contain it (CONTEXT R154). Only the *client palette*
  drops it.
- **This functions change ships built/tested/UNDEPLOYED** — the send path is undeployed (owner
  redeploys). Do not treat as live.
- Test block to extend is **`functions/src/messageTokens.test.ts`** (NOT `index.test.ts` — the
  renderer's unit tests live in `messageTokens.test.ts:19-72`). Add a `{{name}}` case mirroring the
  `their_roles` test (`:25-33`) and keep the `{{song_list}}` tests (`:45-51`) green.

---

### R155 — Send spinner + stuck/failed pill + toast removal

**(a) Send-button spinner (MessageComposer.vue:253-260).**
- **Analog:** the in-pill spinner recipe already in `ServiceMessageHistory.vue:85-89`:
  ```html
  <span class="inline-block h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"></span>
  ```
  (app-wide idiom — also `PptxImportModal.vue:103/118/152`, `ServiceMessageHistory.vue:30`). Add
  this spinning `<span>` inside the Send button when `sending.value`, alongside the existing
  `sendLabel` (`:559-562`, already returns "Sending…"/"Scheduling…"). `sendDisabled` already
  includes `sending` (`:547-549`).

**(b) Aged-queued → "Failed to send" (ServiceMessageHistory.vue:211-225, 241-255).**
- **Analog (the pill recipe to copy):** `statusPill` `failed` case (`:217`):
  `{ label: 'Failed', classes: 'bg-red-900/50 text-red-300 border-red-800', spinner: false }`
  and the `queued`/`sending` case (`:219-221`, `spinner:true`, "Sending…"). Add logic: a message in
  `queued`/`sending` whose age exceeds a small threshold (default ~5 min; use `message.sentAt`/
  `createdAt`/`scheduledFor` — confirm available timestamp; `sentAt.toMillis()` used at `:251`)
  returns the red `failed`-style pill ("Failed to send" / "Stuck — retry") instead of the spinner.
  Mirror the `bg-{hue}-900/50 text-{hue}-300 border-{hue}-800` recipe used across `statusPill`
  (`:214-218`) and the bounce indicator (`:99`).
- Also update `sendTimeLabel` (`:247-249`) so aged-queued doesn't render perpetual "Sending…".

**(c) Toast removal (MessageComposer.vue:592-596).**
- **Analog / defect source:** `ToastHost.vue:18` hard-codes `<span class="font-medium">Save failed.</span>`
  — a failure-only stack — so the success `toasts.push(...)` at `MessageComposer.vue:592-596`
  renders "Save failed. Message queued…". **Option A:** delete the success `toasts.push` block
  (`:592-596`); the composer already `emit('sent', …)` (`:597`) and the history panel shows the
  message. Leave the error path (`sendError` inline, `:600`) untouched.

**Traps:**
- **Removing the toast breaks a test that asserts it.** `MessageComposer.test.ts:29-32` mocks the
  toasts store and `:324` ("Success → emits 'sent' … + raises a toast") asserts the push — update
  it to assert only `emit('sent')`, no toast.
- History R155 is a **read-only presentation change** — no new write path; do not add a retry write
  (deferred, CONTEXT).
- Test extends: `ServiceMessageHistory.test.ts:82-93` (status-pill matrix incl. `['sending','Sending']`)
  — add an aged-`queued`→failed case; the existing `sending`→"Sending" case now needs a *recent*
  timestamp to still show the spinner.

---

### R156 — Type seeds distinct content + Reminder defaults everyone (MessageComposer.vue:371-381, 462-467)

**Change:** align `TYPE_DEFAULTS` copy (`:371-381`); `selectType('reminder')` sets
`selection.includeEveryone = true` behind a new `recipientDirty` guard.

**Analog (dirty-guarded seeding):** `selectType` (`:462-467`) already applies `TYPE_DEFAULTS[t]`
behind `subjectDirty`/`bodyDirty` guards:
```ts
if (!subjectDirty.value) subject.value = d.subject
if (!bodyDirty.value) body.value = d.body
```
The recipient default must copy this exact shape with a **new `recipientDirty` ref** (mirror the
`subjectDirty`/`bodyDirty` declaration at `:341-342` and their `@input` setters at `:162,176`):
```ts
if (t === 'reminder' && !recipientDirty.value) selection.includeEveryone = true
```
Set `recipientDirty = true` in `toggleTeam`/`toggleEveryone`/add/remove mutations (`:431-459`) —
the analog is how `subjectDirty` is set on the subject `@input` (`:162`). Reset it in
`resetComposer` (`:614-630`) alongside `subjectDirty`/`bodyDirty` (`:621-622`).

**Copy vs change:** Copy the dirty-guard idiom for recipients. Change `TYPE_DEFAULTS` strings
(`:371-381`) to the agreed copy (oneoff blank; reminder `Reminder: {{service_date}}` + service link;
share-link `Service plan for {{service_date}}` / body `{{service_link}}`). One-off leaves recipients
as-is; Share-link recipients optional (owner spec focuses on Reminder).

**Traps:**
- Keep the existing subject/body dirty guards — don't clobber edits.
- With R153's live preview now always on, switching type is visibly reflected — no extra wiring.
- `resetComposer` seeds from `TYPE_DEFAULTS.oneoff` (`:619-620`) — if oneoff becomes blank that's a
  blank compose (intended).

---

## Shared Patterns

### Spinner
**Source:** `ServiceMessageHistory.vue:85-89` / `PptxImportModal.vue:103`
`border-2 border-…-500 border-t-transparent rounded-full animate-spin`. Apply to the Send button
(R155a) and reuse for any in-flight affordance.

### Status pill hue recipe
**Source:** `ServiceMessageHistory.vue:214-218` — `bg-{hue}-900/50 text-{hue}-300 border-{hue}-800`.
Apply to the new aged-queued→failed pill (R155b).

### Dirty-guarded seed
**Source:** `MessageComposer.vue:341-342, 462-467`. Apply the same pattern to the new
`recipientDirty` (R156).

### Per-recipient token replace
**Source:** `functions/src/messageTokens.ts:60`. Apply for `{{name}}` (R154 server).

---

## No Analog Found

None. Every change maps to an in-repo analog. The closest to "novel" is the **aged-queued age
threshold** (R155b) — the *pill/label rendering* has a clean analog (`statusPill`), but the
"how old is stuck" timestamp comparison is new logic (default ~5 min); flagged as
implementer-discretion in CONTEXT, no structural precedent needed beyond `formatInstant`/`toMillis`
already used at `ServiceMessageHistory.vue:228-253`.

## Metadata

**Analog search scope:** `src/components/`, `src/utils/`, `functions/src/`, and the four
`__tests__` dirs.
**Mapped changes:** 8 (R151, R152, R153, R154-client, R154-server, R155, R156, tests).
**Source files touched:** 4 (`messagingRecipients.ts`, `MessageComposer.vue`,
`ServiceMessageHistory.vue`, `functions/src/messageTokens.ts` + call site `functions/src/index.ts`).
**Test files touched:** `src/components/__tests__/MessageComposer.test.ts`,
`src/components/__tests__/ServiceMessageHistory.test.ts`,
`src/utils/__tests__/messagingRecipients.test.ts`,
`functions/src/messageTokens.test.ts` (note: renderer tests live here, not `index.test.ts`),
plus `src/views/__tests__/ServiceEditorView.test.ts:97` label-mock fix.
**Pattern extraction date:** 2026-08-15
</content>
</invoke>
