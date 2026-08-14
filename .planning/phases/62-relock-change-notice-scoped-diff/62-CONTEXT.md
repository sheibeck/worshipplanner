# Phase 62: Re-lock Change Notice — Scoped Diff - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas defaulted per the v1.7 standing autonomy grant; grounded in `.planning/research/ARCHITECTURE.md` §Re-Lock Change Diff, the Phase 61 lock hook + `lockSnapshots/current` this phase extends, and the Phase 58/59 send path/resolver)

<domain>
## Phase Boundary — the FINAL v1.7 phase (highest-complexity, most novel)

After a planner edits an already-locked service (unlock → edit → re-lock), show a **scoped change diff**
of typed, checkable entries and let them choose who to notify — or lock quietly. On confirm, overwrite
`lockSnapshots/current` so the next re-lock diffs against the new state.

Requirements: R146 (re-lock prompts a scoped, typed, checkable change diff: SONG/ORDER/ROLE/NOTES/SLIDES),
R147 (each entry tagged with affected teams — ROLE tags exactly that role's team, others default to all
assigned teams; send to affected teams or everyone), R148 ("Lock quietly" always available; confirming
either notify-send or quiet lock overwrites `lockSnapshots/current`).

Out of this phase: nothing after — this is the last v1.7 phase. The milestone lifecycle
(audit/complete/cleanup) is DEFERRED to the owner per the standing grant.
</domain>

<decisions>
## Implementation Decisions

### Allow the `'relock-notification'` message type + `changeDiff` audit field (send-path plumbing)
- Add `'relock-notification'` to `MessageType` + `MESSAGE_TYPES` in `functions/src/index.ts` (mirrors
  61-01's `'lock-notification'` add) so `queueServiceMessage` accepts the re-lock notice.
- The message doc carries **`changeDiff: ChangeEntry[] | null`** — the audit trail of exactly what was
  communicated (ARCHITECTURE §Data Model; present only for `relock-notification`). Confirm in research
  whether `createQueuedMessage`/`QueuedMessageDoc` already carry `changeDiff` (Phase 59 CONTEXT listed it as
  `null`) or need the field added; if added, keep it optional/nullable so all other types are unaffected.
  The client passes `changeDiff` through the `queueServiceMessage` wrapper (extend its payload).
- This functions change rides along the already-UNDEPLOYED send Functions (owner deploys later); no new
  Function, no new secret, no new index.

### Pure diff — `src/utils/serviceLockDiff.ts::diffServiceSnapshots` (R146, R147)
- New PURE module (same `utils/` convention as `serviceRoles.ts`/`messagingRecipients.ts` — no Firestore/
  Pinia imports): `diffServiceSnapshots(previous: ServiceSnapshot, current: ServiceSnapshot,
  prevFingerprint, currFingerprint): ChangeEntry[]`. `ChangeEntry = { type: 'SONG'|'ORDER'|'ROLE'|'NOTES'|
  'SLIDES'; description: string; affectedTeams: RoleGroup[] }`.
- Detection (ARCHITECTURE table), against the shipped `ServiceSnapshot` (`services.ts:80-95`: `slots`,
  `notes`, `roleAssignments:{roleId,roleName,group,personNames}[]`):

  | Type | Detection | Default `affectedTeams` |
  |------|-----------|--------------------------|
  | SONG | a slot's `songId`/`songTitle` changed, matched by stable slot **id** | broad = every RoleGroup with a non-empty role on the service |
  | ORDER | a slot's stable id moved position in the section-ordered `slots` array without its content changing | broad |
  | ROLE | a `roleAssignments[i].personNames` changed for a given `roleId` | **exactly** that role's `group` (the one narrow tag) |
  | NOTES | `notes` changed | broad |
  | SLIDES | `slideGroupsFingerprint` differs (see below) | broad |

- "Broad = every RoleGroup with a non-empty role on the service" — derive from the current snapshot's
  `roleAssignments` (groups that have ≥1 assigned person). A ROLE entry tags ONLY `roleAssignments[i].group`.
- Unit-testable immediately with plain `ServiceSnapshot` fixtures — zero Firestore mocking.

### SLIDES fingerprint (the deferred design decision — R146 SLIDES entry)
- `ServiceSnapshot` deliberately excludes slide content (slides live in the `slideGroups` subcollection).
  Per ARCHITECTURE recommendation **(2)**: compute a `slideGroupsFingerprint` as a SEPARATE step at lock
  time (NOT inside `buildServiceSnapshot` — keep the share-link path untouched) and store it in
  `lockSnapshots/current`. Phase 61 wrote `slideGroupsFingerprint: null`; Phase 62 now COMPUTES it.
- **DEFAULTED grey area — granularity:** a **per-slide-group hash map** `{ [groupId]: hash-of-ordered-
  slide-text }` (a stable, cheap string hash of each group's ordered slide text), computed client-side in
  the lock hook from the already-loaded slideGroups. The diff compares prev vs curr maps; ANY group
  added/removed/changed → a single coarse **SLIDES** ChangeEntry (broad teams). Per-group granularity is
  stored (so a future phase could describe *which* group changed) but the v1.7 entry is coarse
  ("Slides changed"). Confirm the hash + where slideGroups are read from in research.

### Lock-hook restructure (client, extends Phase 61's `onMarkAsPlanned`)
Phase 61 writes `lockSnapshots/current` on every lock and auto-sends on FIRST lock. Phase 62 changes the
RE-LOCK path (the first-lock path is unchanged except it now also computes+stores the fingerprint):
1. **First lock** (no prior `lockSnapshots/current`): compute snapshot + fingerprint, write
   `lockSnapshots/current`, auto-send `lock-notification` (Phase 61) — unchanged behavior, now with a real
   fingerprint instead of null.
2. **Re-lock** (prior snapshot exists): read the PRIOR snapshot + fingerprint BEFORE overwriting; compute
   the CURRENT snapshot + fingerprint; `diffServiceSnapshots(prior, current, …)`.
   - **Non-empty diff** → open the re-lock prompt (SC1). Do NOT overwrite `lockSnapshots/current` yet.
   - **Empty diff** (nothing material changed) → overwrite `lockSnapshots/current` silently, no prompt.
3. **On prompt confirm — either a notify-send OR "Lock quietly" — overwrite `lockSnapshots/current`** with
   the new snapshot + fingerprint (SC4): the next re-lock diffs against this new state, not the original.
- The overwrite-on-confirm timing is load-bearing: writing the new snapshot before the planner confirms
  would destroy the diff basis. Keep it non-blocking to the lock transition itself (the service is already
  locked; the prompt + snapshot-overwrite are a follow-up, mirroring Phase 61's non-blocking enqueue).

### Re-lock prompt UI (R146, R147, R148)
- A dedicated **re-lock notify modal** (e.g. `ReLockNotifyPrompt.vue`) opened by the re-lock branch — NOT
  the full free-text `MessageComposer` (the notice content IS the diff, auto-generated):
  - Lists the typed **checkable** ChangeEntry rows (SONG/ORDER/ROLE/NOTES/SLIDES), each with a human
    description and its **affected-team tags** (reuse `MESSAGING_TEAM_LABELS` from Phase 58).
  - A recipient choice: **notify affected teams** (default — the union of `affectedTeams` across CHECKED
    entries) vs **notify everyone** on the service (SC2). Live "Reaches N" via the Phase 58 resolver as in
    the composer.
  - **Send** → `queueServiceMessage` with `type:'relock-notification'`, `recipientSelector` = the chosen
    teams (`{ teams, individualPersonIds:[], includeEveryone }`), `changeDiff` = the CHECKED entries
    (audit), `options.attachServiceLink:true`, subject/body auto-generated from the checked entries.
  - **Lock quietly** → always available (SC3), no message; still overwrites the snapshot (SC4).
- Gated by `isMessagingEnabled()` — with messaging OFF, re-lock never prompts (it just overwrites the
  snapshot silently); the lock-notify default does NOT gate the re-lock prompt (re-lock is an explicit
  planner-facing choice, unlike the automatic first-lock send — but if messaging is off there is nowhere
  to send, so no prompt). State this.

### Firestore rules / indexes
- `messages` create = isOrgEditor and `lockSnapshots` write = isOrgEditor already shipped (Phase 58). The
  re-lock notice reuses the send path. **No new rules, no new index, no new secret, no new Function.**

### Claude's Discretion
- The slide-text hash function, the auto-generated re-lock subject/body copy, the modal's exact layout,
  whether "notify everyone" is a toggle vs a segmented control, and the ChangeEntry `description` phrasing —
  all at implementer discretion, guided by the UI-SPEC, ARCHITECTURE, and conventions.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/services.ts::buildServiceSnapshot` (`:104-154`) + `ServiceSnapshot` (`:80-95`) — the two
  inputs to the diff; already written by the Phase 61 lock hook to `lockSnapshots/current`.
- `src/views/ServiceEditorView.vue::onMarkAsPlanned` (Phase 61 lock hook, ~2757/2939) — where the re-lock
  branch + fingerprint compute + prompt hook in; `wasFirstLock` detection already exists there.
- `functions/src/index.ts` — `MessageType`/`MESSAGE_TYPES` (61-01) to extend with `'relock-notification'`;
  `createQueuedMessage`/`QueuedMessageDoc` (59-02) for the `changeDiff` field; `queueServiceMessage`
  accepts the type; `sendQueuedMessage` renders/sends unchanged.
- `src/components/MessageComposer.vue` (59-04) — the "Reaches N" + recipient-selector + queueServiceMessage
  wrapper idioms the re-lock modal reuses (but the modal is dedicated, not the composer).
- `src/utils/messagingRecipients.ts::resolveRecipients` + `MESSAGING_TEAM_LABELS` (Phase 58) — team tags +
  live count.
- `src/types/roster.ts::RoleGroup` — the `affectedTeams` element type.
- slideGroups source (subcollection loaded in the editor) — the SLIDES fingerprint input (confirm the store
  path in research).

### Established Patterns
- Pure `utils/` diff/resolver modules, unit-tested with plain fixtures (serviceRoles/messagingRecipients).
- Non-blocking follow-up after the lock transition (Phase 61 enqueue) — the re-lock prompt is the same shape.
- Reuse the one send path (queueServiceMessage → sendQueuedMessage) for every message type.

### Integration Points
- `functions/src/index.ts` (MessageType + changeDiff), new `src/utils/serviceLockDiff.ts`, new
  `ReLockNotifyPrompt.vue`, the `ServiceEditorView.vue` lock hook (re-lock branch + fingerprint + prompt),
  the `queueServiceMessage` client wrapper (changeDiff passthrough). Roster/quarters read-only.
</code_context>

<specifics>
## Specific Ideas
- The diff is a PURE function over two ServiceSnapshots + fingerprints — testable without any mocking.
- ROLE entries get the ONE narrow team tag; every other type defaults broad — R147's exact rule.
- "Lock quietly" is ALWAYS available and still overwrites the snapshot (SC3+SC4).
- Overwrite `lockSnapshots/current` only ON CONFIRM for a re-lock — overwriting earlier destroys the diff basis.
- SLIDES needs the fingerprint Phase 61 stubbed to null; Phase 62 computes it (per-group hash, coarse entry).
</specifics>

<deferred>
## Deferred Ideas
- Finer SLIDES description ("Slides changed in group X") — the per-group fingerprint is stored to enable it
  later; v1.7 ships a coarse SLIDES entry.
- Free-text editing of the re-lock notice — out of scope; the notice is the generated diff summary.
- Milestone lifecycle (audit/complete/cleanup) — DEFERRED to the owner (grant); after Phase 62 code-complete,
  STOP and hand over the verify list.
</deferred>
