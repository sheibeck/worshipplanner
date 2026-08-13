# Phase 58: Messaging Infrastructure, Settings & Recipient Resolution - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas defaulted per the v1.7 standing autonomy grant; grounded in `.planning/research/ARCHITECTURE.md` "Phase A" + Data Model + Recipient Resolution + Security-Rule sections)

<domain>
## Phase Boundary

Stand up all messaging plumbing so later phases have something to build on — **no sends happen in this
phase**. Delivers: the org-level messaging kill-switch (default OFF), an org local-timezone setting,
per-service automatic-email default overrides (Draft-only, inherit from org), one shared pure recipient
resolver (teams → people, deduped, with an unreachable count), and the deny-by-default `firestore.rules`
scaffolding for the new `messages` / `recipients` / `lockSnapshots` collections.

Requirements: R130 (kill-switch), R132 (per-service defaults inherit from Settings), R133 (org
timezone), R134 (recipients from assigned roles → teams + Everyone), R135 (dedup + unreachable count).

Out of this phase: the ✉ composer and any send Function (Phase 59), delivery history/webhook (Phase 60),
lock/reminder triggers (Phase 61), the re-lock diff (Phase 62).
</domain>

<decisions>
## Implementation Decisions

### Org settings & kill-switch (R130)
- Extend `OrgSettings` (`src/types/organization.ts`) with one nested `messaging` block:
  `{ enabled: boolean, lockNotifyDefault: boolean, reminderEnabled: boolean, reminderDaysBefore: number, fromName?: string, replyTo?: string }`.
- `DEFAULT_ORG_SETTINGS.messaging.enabled = **false**` — deliberate deviation from `aiEnabled`/`pcEnabled`
  (which default true): a fresh org has no provider configured, so messaging must fail closed until the
  owner sets up the provider and flips it on. `reminderDaysBefore` default = 7; `lockNotifyDefault` and
  `reminderEnabled` default false (conservative — owner opts in).
- Merge in `auth.ts::loadOrgContext` at the single existing defaults-merge point, exactly like the v1.5
  `aiEnabled`/`pcEnabled`/`vwModeEnabled` dual-read (concurrency-safe dot-path leaf writes, never a
  whole-map overwrite).
- New "Messaging" card on `SettingsView.vue`, mirroring the existing AI Features / Planning Center /
  Bible Translation toggle cards exactly (same markup + editor-gated write). The card carries the
  global on/off switch and the org-level automatic-email defaults (lock-notify default, reminder
  enabled + days-before, optional From name / Reply-to).
- Single client choke point `src/utils/messaging.ts::isMessagingEnabled()` reading
  `useAuthStore().settings.messaging.enabled`, mirroring `claudeApi.ts::isAiEnabled()`. Every later
  messaging surface gates on this one function — no scattered `settings.messaging.enabled` reads.

### Org timezone (R133)
- Add `OrgSettings.timezone: string` (IANA name, e.g. `'America/Chicago'`) — a top-level org setting
  (conceptually org-wide, though only the scheduled reminder consumes it in v1.7). Rendered as a
  timezone `<select>` on the Messaging (or General) Settings card.
- **Defaulted grey area:** `DEFAULT_ORG_SETTINGS.timezone = 'America/Chicago'` as a sensible US-central
  placeholder the owner changes in Settings. The value is only load-bearing for Phase 61's cron; this
  phase just persists the field + UI. Flag for owner confirmation at verification.

### Per-service automatic-email defaults (R132)
- Store on the service document as a small nested object `services/{id}.messaging =
  { lockNotifyEnabled: boolean|null, reminderEnabled: boolean|null, reminderDaysBefore: number|null,
  reminderSentAt: Timestamp|null }` — `null` means "inherit the org default". `reminderSentAt` is an
  Admin-SDK-only idempotency guard (Phase 61 writes it), never written from the client here.
- Written via a NEW scoped store action `setServiceMessagingDefaults(serviceId, patch)` using the
  `updateDoc(..., { 'messaging.lockNotifyEnabled': v })` dot-path shape (mirrors
  `setRoleOverride`/`clearRoleOverride`), NOT routed through `updateService` (so it isn't caught by the
  R036 draft guard's content path).
- **Draft-only editability** for v1.7 (no new rules carve-out; matches every other service-metadata
  field's lifecycle). A locked service shows the effective values read-only. Success criterion 3.

### Recipient resolver (R134, R135)
- New pure module `src/utils/messagingRecipients.ts` (no Firestore/Pinia imports — same purity contract
  as `src/utils/serviceRoles.ts`), wrapping the existing `resolveServiceRoleAssignments`:
  `resolveRecipients(service, quarters, roles, people, selection) → { reachable: RecipientCandidate[], unreachableCount }`
  where `selection = { teams: RoleGroup[], individualPersonIds: string[], includeEveryone: boolean }`.
- Teams are a UI label remap of the EXISTING `RoleGroup` enum (`'band'|'tech'|'vocals'|'other'`), NOT a
  new type. New constant `MESSAGING_TEAM_LABELS = { band:'Worship', tech:'Tech', vocals:'Vocals', other:'Hosts' }`
  — do NOT repurpose `RolesConfigPanel.vue`'s `groupLabels` (two UIs may describe the same enum
  differently). `includeEveryone` resolves every assigned role regardless of group.
- Dedup by person id (a person in two matching roles counts once). Split reachable (non-empty
  `person.email`) vs `unreachableCount` (assigned but empty email — the roster schema permits `''`).
  An unfilled role (`effectivePersonIds = []`) is 0 recipients with NO warning — distinct from
  unreachable. Unit-testable immediately with zero Firestore mocking.

### Firestore rules & data-model scaffolding (all Rs, enabling)
- Add explicit `allow` blocks under `match /services/{docId}` for the nested collections (they fall
  through to default-deny otherwise — no exclusion clause needed, unlike the single-segment
  `pptxRenders`):
  - `messages/{messageId}`: read if `isOrgMember`; create if `isOrgEditor`; update/delete `if false`
    (Admin-SDK-only status transitions).
  - `messages/{messageId}/recipients/{recipientId}`: read if `isOrgMember`; write `if false`
    (Admin-SDK-only).
  - `lockSnapshots/{snapshotId}`: read if `isOrgMember`; write if `isOrgEditor`.
- **Rules-testing discipline (non-negotiable, per CLAUDE.md incident):** the emulator test suite must
  include a genuine ALLOW-case that passes (an org editor creating a `messages` doc; an org member
  reading it), not only deny-cases. Success criterion 5.
- **Deploy-gated:** `firestore.rules` changes ship built/tested/UNDEPLOYED; hand the owner the exact
  `firebase deploy --only firestore:rules`. No client writes these collections yet this phase, so the
  rules being undeployed blocks nothing in Phase 58 itself.

### Claude's Discretion
- Exact TypeScript field ordering, the `RecipientCandidate` shape, test file organization, and whether
  the timezone select ships a curated shortlist vs the full IANA list — all at implementer discretion,
  guided by codebase conventions and ARCHITECTURE.md.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/serviceRoles.ts::resolveServiceRoleAssignments` / `findQuarterForDate` — pure resolver that
  already computes `effectivePersonIds` (override ?? quarter-scheduled ?? []); the recipient resolver
  wraps it. Already how `buildServiceSnapshot` builds the share-link role list.
- `src/stores/auth.ts::loadOrgContext` (~185-221) — the single `OrgSettings` defaults-merge point.
- `src/types/organization.ts` (~52-178) — `OrgSettings` + `DEFAULT_ORG_SETTINGS` (see `aiEnabled`/`pcEnabled` pattern).
- `src/views/SettingsView.vue` — AI Features / Planning Center / Bible Translation cards to mirror.
- `src/utils/claudeApi.ts::isAiEnabled` (~39-70) — single-choke-point gate to mirror for `isMessagingEnabled`.
- `src/stores/services.ts::setRoleOverride`/`clearRoleOverride` (~442-494) — scoped dot-path write shape for `setServiceMessagingDefaults`.
- `src/types/roster.ts` — `RoleGroup` enum, `Person` (email may be `''`).
- `firestore.rules` — `isOrgMember`/`isOrgEditor`; `songs/{id}/lyrics/{id}` (~192-199) nested-block precedent; `pptxRenders` (~202-246) Admin-SDK-only-write precedent.

### Established Patterns
- Feature toggles: nested `settings.<field>` leaf, merged once in `loadOrgContext`, gated at one choke point.
- Scoped dot-path `updateDoc` writes to avoid whole-map races.
- Pure `utils/` modules unit-tested without store/Firestore mocking.
- Rules-first: add locked-down nested blocks early, prove with an emulator allow-case.

### Integration Points
- `SettingsView.vue` (new Messaging card), `auth.ts` (settings merge), `services.ts` (new scoped action),
  `firestore.rules` (new nested blocks). No changes to roster/quarters/roles data (read-only source).
</code_context>

<specifics>
## Specific Ideas

- Settings cards must look and behave like the existing v1.5 toggle cards (AI/PC/Bible) — same editor
  gating, same dot-path write, live preview where relevant.
- The imported design ("Turn 5 — Messaging volunteers", 5b) shows the Automatic-email settings block and
  its inheritance-from-Settings framing — this phase builds the Settings side of that inheritance and
  the per-service override storage, but NOT the automatic sends themselves.
- Kill-switch OFF by default is a hard requirement, not a preference — a fresh org must not send.
</specifics>

<deferred>
## Deferred Ideas

- ✉ Messages composer + `queueServiceMessage`/`sendQueuedMessage` send path — Phase 59.
- Delivery-history panel + bounce webhook — Phase 60.
- Lock/re-lock notify prompts, `lockSnapshots/current` writes, scheduled reminder cron — Phases 61–62
  (this phase only creates the `lockSnapshots` RULES + the per-service defaults storage they'll consume).
- `functions/src/serviceRoles.ts` server-side port of the resolver — Phase 59 (the send path needs it;
  this phase's resolver is client-only/pure).
- SLIDES-diff fingerprint on the lock snapshot — Phase 62.
</deferred>
