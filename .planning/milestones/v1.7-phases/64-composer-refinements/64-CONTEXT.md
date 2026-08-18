# Phase 64: Composer Refinements - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (v1.8 grant; grounded in the shipped `MessageComposer.vue` / `messagingRecipients.ts` / `ServiceMessageHistory.vue` / `functions/src/index.ts` send path)

<domain>
## Phase Boundary — the final v1.8 phase

Fix the ✉ Messages composer from owner UAT: roster-matching team labels, a working add-individual, a live
email preview, corrected merge tokens, a sending spinner, and message types that seed distinct content.

Requirements: R151 (Band/Vocals/Tech/Other labels), R152 ("+ Add someone" actually adds), R153 (live
real-time preview), R154 (drop `{{song_list}}`, add `{{name}}`), R155 (send spinner + kill the perpetual
"Sending…"), R156 (message types seed distinct content).

Out of this phase: the Messages tab / history relocation (Phase 63, done). The send path stays UNDEPLOYED
(owner deploy pending); the one small functions change here (R154's `{{name}}` server token) ships
built/tested/UNDEPLOYED.
</domain>

<decisions>
## Implementation Decisions

### R151 — Send-To labels mirror Volunteer Roles (Band / Vocals / Tech / Other)
- `src/utils/messagingRecipients.ts::MESSAGING_TEAM_LABELS` currently remaps `band→'Worship'`,
  `tech→'Tech'`, `vocals→'Vocals'`, `other→'Hosts'`. Change to `band→'Band'`, `tech→'Tech'`,
  `vocals→'Vocals'`, `other→'Other'` — the raw RoleGroup names, matching what users see in Volunteer Roles.
- This constant feeds the composer team chips AND `ReLockNotifyPrompt.vue`'s team tags — one change,
  consistent everywhere. Confirm no test hard-codes "Worship"/"Hosts" (update those assertions).

### R152 — "+ Add someone" actually adds a person
- Root cause (two candidates — research/executor to confirm): (a) the "＋ Add someone" is a `<label>`
  wrapping a native `<select>` (MessageComposer.vue ~L97-107); clicking the text only focuses the select
  ("just highlights the dropdown"), and the add happens only on the select's `@change="onAddIndividual"` —
  a confusing affordance. (b) `addablePeople = props.people.filter(p => p.active && …)` (~L412) — if roster
  `Person.active` is falsy for real people, the dropdown is EMPTY, so nothing can be added. **Verify whether
  roster people carry `active: true`;** if `active` is unreliable, relax the filter (only exclude
  already-selected, not on `active`).
- Fix: make the add a clear, working action — a visible person picker (a `<select>` that is not hidden
  behind a look-like-a-button label, plus/or an explicit "Add" affordance) whose selection pushes the
  person into `selection.individualPersonIds` and resets the picker, with the chosen person appearing as a
  removable pill (the pills already work, ~L109-125) and the live "Reaches N" reflecting them. Keep it
  keyboard-accessible. UI-SPEC decides the exact control.

### R153 — Live email preview (no click-to-preview)
- `samplePreview` is ALREADY a reactive computed (renders subject/body tokens against a sample recipient,
  ~L199-200), but it is gated `v-if="showPreview"` and toggled by a "Preview" button (`showPreview` ref
  ~L351, button ~L243-246). **Remove the Preview button + the `showPreview` gate — render the sample
  preview always**, so it updates in real time as the subject/body are edited (it already recomputes).
  Keep the "Sample" label + caption so it's clearly a representative render, not the final per-person text.

### R154 — Merge tokens: drop `{{song_list}}`, add `{{name}}`
- Client `tokenChips` (~L362-366): REMOVE the `song_list` chip; ADD `{ token: 'name', label: 'Name' }`.
- Client `samplePreview` render: render `{{name}}` as the sample recipient's name (and stop offering
  song_list). Confirm how samplePreview substitutes tokens and add `name`.
- **Server** `functions/src/index.ts` token renderer (the 59-03 `renderMessageTokens`): ADD `{{name}}` →
  the recipient's own `name` (per-recipient, like `{{their_roles}}`). Keep `{{song_list}}` SUPPORTED
  server-side (harmless; older/scheduled docs may contain it) but it is simply no longer offered in the
  palette. This is a functions change → ships built/tested/UNDEPLOYED (owner redeploys the send path).
- `ReLockNotifyPrompt.vue` auto-generates its body from the diff (no palette) — unaffected, but if it
  emits `{{song_list}}` anywhere, leave server support intact so it still renders.

### R155 — Sending spinner + kill the perpetual "Sending…"
- **Composer:** `onSend` already sets `sending.value` true/false and `sendDisabled` includes it, but the
  Send button needs a VISIBLE in-progress state — show a spinner + "Sending…" label on the button while
  `sending` (disable Cancel too, or at least the primary). Confirm the Send button markup (~L255-265).
- **Fix the disclosed toast defect HERE (the natural home):** `onSend` does `toasts.push('Message queued
  to N people')` on success (~L592), but `ToastHost.vue` hard-codes a red **"Save failed."** prefix (it's a
  failure-only stack), so success renders "Save failed. Message queued…". **Option A (agreed):** REMOVE the
  success `toasts.push` — the composer already `emit('sent')` and closes, and the Phase 60/63 history panel
  shows the sent message. (Leave the error path — `sendError` inline — as is.) Update the composer test that
  asserted the toast.
- **History side:** `ServiceMessageHistory.vue` renders a `queued` message as "Sending…" indefinitely
  (there is no failure/timeout affordance if `sendQueuedMessage` never flips the status). Add a
  **failed/timeout affordance**: a message stuck in `queued`/`sending` past a reasonable age (or a `failed`
  status) surfaces as "Failed to send" (or "Stuck — retry") rather than a perpetual spinner. Confirm the
  status → label mapping in ServiceMessageHistory and add the aged-queued → failed presentation. (This is a
  READ-only presentation change; no new write path. The DEFAULTED grey area — "how old is stuck" — default
  to a small threshold, e.g. queued with a `createdAt` older than ~5 min shows the failed affordance;
  research confirms the available timestamp fields.)

### R156 — Message types seed distinct content
- `selectType(t)` already applies `TYPE_DEFAULTS[t]` to subject/body behind a dirty guard (`if
  (!subjectDirty) …`). Keep the dirty guard (don't clobber edits). The "types do nothing" perception is
  because the preview was hidden (fixed by R153) and the seeds are subtle — plus Reminder doesn't set
  recipients. Changes:
  - **Align `TYPE_DEFAULTS` copy** to the agreed content: `oneoff` = blank; `reminder` subject
    `Reminder: {{service_date}}`, body seeded with the service link (and `{{name}}`/`{{their_roles}}` as
    apt); `share-link` subject `Service plan for {{service_date}}`, body = `{{service_link}}` (link-only).
  - **Reminder defaults recipients to everyone assigned:** `selectType('reminder')` sets
    `selection.includeEveryone = true` behind a recipient-dirty guard (a new `recipientDirty` flag set when
    the user changes team/individual/everyone selection) so it doesn't override a manual choice; One-off
    leaves recipients as-is; Share-link may also default to everyone (owner spec focuses on Reminder — apply
    to Reminder; leave Share/One-off manual unless trivially apt). State the exact behavior.
  - With R153's live preview, switching type now visibly changes the rendered email — closing the "does
    nothing" gap.

### Claude's Discretion
- The exact add-person control shape (visible select vs typeahead), the Send-button spinner styling, the
  "stuck" age threshold + label copy, the precise TYPE_DEFAULTS wording, and whether Share-link also
  defaults recipients — implementer/UI-SPEC discretion, guided by conventions.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/messagingRecipients.ts::MESSAGING_TEAM_LABELS` (~L17) — the R151 constant.
- `src/components/MessageComposer.vue` — the whole composer: team chips (~L70-90), individuals panel +
  `onAddIndividual`/`addablePeople` (~L93-126, ~L412-418), message-type control + `selectType` +
  `TYPE_DEFAULTS` (~L134-152, ~L356-380, ~L420-425), subject/body + `tokenChips`/`insertToken` (~L154-191,
  ~L362-366), `samplePreview` + `showPreview` + Preview button (~L193-201, ~L243-246, ~L351), `onSend` +
  `sending`/`sendDisabled`/`toasts.push` (~L580-605), Send button (~L255-265).
- `src/components/ServiceMessageHistory.vue` — the status → "Sending…" mapping to extend with a
  failed/timeout affordance (R155 history side).
- `functions/src/index.ts` `renderMessageTokens` (59-03) — the server token renderer to add `{{name}}`.
- `ToastHost.vue` (~L18) — the failure-only toast the composer must stop pushing success into (R155).

### Established Patterns
- Pure resolver + labels in `utils/`; the composer reuses `resolveRecipients` for "Reaches N".
- Dirty-guarded seeding on type change; client token preview mirrors the server render.
- Functions token render is per-recipient (their_roles precedent) → `{{name}}` follows it.

### Integration Points
- `src/utils/messagingRecipients.ts` (R151), `src/components/MessageComposer.vue` (R152/R153/R154-client/
  R155-spinner+toast/R156), `src/components/ServiceMessageHistory.vue` (R155-history), `functions/src/index.ts`
  (R154 server `{{name}}`) + all their tests. Roster/quarters read-only.
</code_context>

<specifics>
## Specific Ideas
- Labels must match Volunteer Roles exactly — no remap (R151).
- "+ Add someone" must visibly add a removable person and bump "Reaches N" (R152); check the `active` filter.
- Preview is live, always on (R153). Types seed visibly now that preview is live (R156).
- `{{name}}` is per-recipient server-rendered like `{{their_roles}}`; `{{song_list}}` leaves the palette (R154).
- Kill the misleading "Save failed." success toast (drop it) and the perpetual "Sending…" (aged-queued →
  failed) — both are R155's send-feedback domain.

## Owner-disclosed defect resolved here
The Phase 59 composer success-toast misrender (`PENDING-VERIFICATION.md` "⚠ DISCOVERED DEFECT") is fixed by
R155 Option A (drop the redundant success toast). Mark that PENDING item resolved when 64 lands.
</specifics>

<deferred>
## Deferred Ideas
- A real retry/re-send-from-history action for a stuck message — R155 only needs the failed/timeout
  *surfacing*; an actual retry button is a later enhancement (note it).
- Typeahead person search for large rosters — the simple picker suffices for this app's scale.
- Real email delivery / deploy — OWNER (send path stays undeployed; local `.secret.local` placeholder).
</deferred>
