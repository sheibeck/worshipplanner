# Phase 58: Messaging Infrastructure, Settings & Recipient Resolution - Research

**Researched:** 2026-08-13
**Domain:** Firestore data-model/settings plumbing + pure recipient-resolution logic + security rules scaffolding for a Vue 3 + Firebase SPA (no sends in this phase)
**Confidence:** HIGH

## Summary

This is a **consolidation** research pass, not a from-scratch one. The milestone-level
`.planning/research/ARCHITECTURE.md` already did the deep design work for the entire v1.7 messaging
system, anchored to exact files/lines in this codebase, and `58-CONTEXT.md` already locked every
implementation decision this phase needs. There is nothing left to explore — every claim below is either
re-verified directly against the current source tree in this session, or copied forward from
ARCHITECTURE.md's Phase-A slice.

Phase 58 delivers zero UI for sending and zero Cloud Functions. It is: one new `OrgSettings.messaging`
block (kill-switch default `false`) plus `OrgSettings.timezone`, merged in `loadOrgContext`'s single
existing defaults-merge point; a "Messaging" Settings card and a per-service inherit/override defaults
panel, both byte-for-byte reusing existing card/select idioms; a pure `messagingRecipients.ts` resolver
wrapping the already-pure `resolveServiceRoleAssignments`; and `firestore.rules` blocks for
`messages`/`recipients`/`lockSnapshots` nested under `services/{docId}`, proven by a genuine
emulator ALLOW-case test (not only deny-cases — this is a documented incident class in this repo, see
CLAUDE.md's `storage.rules.test.ts` postmortem).

**Primary recommendation:** Implement every piece as a direct structural copy of an existing, named
precedent (`aiEnabled`/`pcEnabled` for the settings block, `setRoleOverride`/`clearRoleOverride` for the
scoped dot-path write, the scripture Bible-version override select for the inherit/override UI idiom,
`songs/{id}/lyrics/{id}` for the nested-rules-block shape) — there is no novel design decision left to
make in this phase, only faithful reuse plus new pure-function unit tests and one rules-emulator test file
addition.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Org messaging kill-switch + defaults storage | Database (Firestore `organizations/{orgId}.settings`) | Frontend Server — none (SPA, no SSR) | Settings persist server-side; client (`SettingsView.vue`) is the only writer, same as `aiEnabled`/`pcEnabled` |
| `isMessagingEnabled()` choke point | Browser / Client | — | Pure client-side read of `authStore.settings.messaging.enabled`, mirrors `claudeApi.ts::isAiEnabled` exactly — no server enforcement needed in THIS phase because no send path exists yet (server-side enforcement is Phase 59's `queueServiceMessage`'s job) |
| Per-service messaging defaults (`services/{id}.messaging`) | Database (Firestore nested field on `services/{id}`) | Browser / Client | Client writes via scoped dot-path `updateDoc`, same shape as `roleAssignmentOverrides`; no Function involved this phase |
| `messagingRecipients.ts` resolver | Browser / Client | — | Pure function, zero Firestore/Pinia imports — explicitly NOT a server-side concern in Phase 58 (the server-side port lives in Phase 59 for send-time re-resolution) |
| `firestore.rules` `messages`/`recipients`/`lockSnapshots` blocks | Database (security rules, evaluated by Firestore itself) | — | Rules are the sole server-side enforcement layer this phase adds; no Cloud Function exists yet to double-enforce |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Org settings & kill-switch (R130)**
- Extend `OrgSettings` (`src/types/organization.ts`) with one nested `messaging` block:
  `{ enabled: boolean, lockNotifyDefault: boolean, reminderEnabled: boolean, reminderDaysBefore: number, fromName?: string, replyTo?: string }`.
- `DEFAULT_ORG_SETTINGS.messaging.enabled = false` — deliberate deviation from `aiEnabled`/`pcEnabled`
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

**Org timezone (R133)**
- Add `OrgSettings.timezone: string` (IANA name, e.g. `'America/Chicago'`) — a top-level org setting
  (conceptually org-wide, though only the scheduled reminder consumes it in v1.7). Rendered as a
  timezone `<select>` on the Messaging (or General) Settings card.
- **Defaulted grey area:** `DEFAULT_ORG_SETTINGS.timezone = 'America/Chicago'` as a sensible US-central
  placeholder the owner changes in Settings. The value is only load-bearing for Phase 61's cron; this
  phase just persists the field + UI. Flag for owner confirmation at verification.

**Per-service automatic-email defaults (R132)**
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

**Recipient resolver (R134, R135)**
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

**Firestore rules & data-model scaffolding (all Rs, enabling)**
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

### Deferred Ideas (OUT OF SCOPE)
- ✉ Messages composer + `queueServiceMessage`/`sendQueuedMessage` send path — Phase 59.
- Delivery-history panel + bounce webhook — Phase 60.
- Lock/re-lock notify prompts, `lockSnapshots/current` writes, scheduled reminder cron — Phases 61–62
  (this phase only creates the `lockSnapshots` RULES + the per-service defaults storage they'll consume).
- `functions/src/serviceRoles.ts` server-side port of the resolver — Phase 59 (the send path needs it;
  this phase's resolver is client-only/pure).
- SLIDES-diff fingerprint on the lock snapshot — Phase 62.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R130 | Org owner can turn messaging off from Settings; disabled by default; every send surface honors the switch | `OrgSettings.messaging.enabled` block + `DEFAULT_ORG_SETTINGS.messaging.enabled = false` + `isMessagingEnabled()` choke point — see Standard Stack, Code Examples |
| R132 | Per-service automatic-email defaults inherit from Settings, overridable while in Draft | `services/{id}.messaging` nested object + `setServiceMessagingDefaults` scoped dot-path action + Draft-only gate matching `setRoleOverride` — see Code Examples |
| R133 | Org can set its local timezone so scheduled sends fire at the intended local time | `OrgSettings.timezone` field, curated 7-zone `<select>`, default `'America/Chicago'` — see Architecture Patterns |
| R134 | Recipients resolved from assigned roles, grouped into selectable teams + "Everyone" | `messagingRecipients.ts::resolveRecipients` wrapping `resolveServiceRoleAssignments`, `MESSAGING_TEAM_LABELS` — see Code Examples |
| R135 | Dedup by address; no-email roles excluded and surfaced as unreachable count | `resolveRecipients` dedup-by-person-id + `unreachableCount` split logic — see Code Examples, Common Pitfalls |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives apply directly to how this phase's plan must specify verification steps:

- **Type-checking:** use `npm run type-check` (runs `vue-tsc --build`, typechecks test files too), never
  `vue-tsc --noEmit -p tsconfig.app.json` as the gate — the narrower form silently skips test files and
  has previously let real `TS2339` errors survive two phases undetected.
- **App test suite:** bare `npx vitest run` is correct and already excludes `src/rules.test.ts` and
  `render-service/**` via `vite.config.ts`. Do **not** use `npx vitest run --dir src` (bypasses the
  exclude and pulls in `rules.test.ts`, which then fails with no emulator running — a tooling artifact,
  not a regression).
- **Rules suite:** `npm run test:rules` runs `firebase emulators:exec` with its own emulator; it fails
  with "port taken" if an emulator is already running, in which case run
  `npx vitest run --config vitest.rules.config.ts` directly against the already-running emulator instead.
  This is a **separate test file and separate command** from the app suite — Phase 58's new
  `messages`/`recipients`/`lockSnapshots` ALLOW-case tests belong in `src/rules.test.ts` (or a sibling
  file picked up by `vitest.rules.config.ts`), run only via the rules command, never via
  `npx vitest run`.
- **Known-failing baseline** (pre-existing, unrelated to this phase — do not chase):
  `src/storage.rules.test.ts` (2 allow-cases fail due to a documented Storage-emulator
  `firestore.exists()` limitation, production already fixed via IAM) and
  `src/views/__tests__/RosterView.test.ts` (stale assertion). Neither should regress further, but neither
  blocks Phase 58's own new tests from being green.
- **`.env.local` required:** any new worktree needs a symlink/copy of the main checkout's `.env.local`
  before the emulator, `npm run test:rules`, or a full `vitest run` (component tests importing Firebase
  config) will work.

## Standard Stack

### Core

No new runtime dependencies. Phase 58 is pure application code (TypeScript + Vue 3 SFC + Firestore
security rules) built entirely on packages already in `package.json`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` (client SDK: `firestore`, `doc`/`updateDoc`) | already pinned in `package.json` [VERIFIED: codebase] | `updateDoc` dot-path writes for settings + per-service defaults | Existing pattern, no new install |
| `vitest` | already pinned in root `package.json` and `vitest.rules.config.ts` [VERIFIED: codebase] | Unit tests for `messagingRecipients.ts`; rules-emulator tests | Existing test runner, two configs (app / rules) already wired |
| `@firebase/rules-unit-testing` | already a devDependency [VERIFIED: codebase] (used by `src/rules.test.ts`) | `initializeTestEnvironment`, `assertSucceeds`/`assertFails` for the new rules tests | Existing rules-test harness |

### Supporting

None — this phase adds no new supporting libraries.

### Alternatives Considered

Not applicable — no library choice is being made in this phase; every piece is a structural copy of an
existing in-repo pattern per the locked decisions above.

**Installation:** none required.

**Version verification:** not applicable — no packages installed this phase.

## Package Legitimacy Audit

**Not applicable.** Phase 58 installs zero external packages (no `npm install` of any kind). Every
dependency used (`firebase`, `vitest`, `@firebase/rules-unit-testing`) is already present in
`package.json`/`package-lock.json` and was vetted when originally added in earlier phases. The Package
Legitimacy Gate protocol is skipped for this reason — there is nothing new to audit.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BROWSER (Vue 3 SPA)                                                      │
│                                                                            │
│  SettingsView.vue                        ServiceEditorView.vue           │
│   ├─ NEW "Messaging" card                 ├─ NEW "Messaging defaults"    │
│   │   • kill-switch checkbox              │   panel (Service Order tab)  │
│   │     @change → onToggleMessaging       │   • 3 inherit/override       │
│   │     Enabled() → updateDoc             │     selects → @change →     │
│   │     'settings.messaging.enabled'      │     setServiceMessagingDe-  │
│   │   • org defaults sub-block            │     faults(serviceId,patch) │
│   │     (lockNotify/reminder/from/reply)  │     → updateDoc dot-path    │
│   │   • timezone select                   │     'messaging.<field>'     │
│   │     → updateDoc 'settings.timezone'   │   • v-if="canEditService"   │
│   │                                        │     else read-only summary │
│   │                                        │                             │
│  authStore (Pinia) ── loadOrgContext() ───┴──── merges settings.messaging│
│   settings.messaging.*  ◄── single merge point, DEFAULT_ORG_SETTINGS     │
│   settings.timezone     ◄── fallback                                     │
│                                                                            │
│  src/utils/messaging.ts::isMessagingEnabled()                            │
│   reads authStore.settings.messaging.enabled ── the ONE choke point      │
│   (not yet CALLED by any UI surface this phase — no send UI exists yet;  │
│   it exists so Phase 59+ has exactly one place to import from)           │
│                                                                            │
│  src/utils/messagingRecipients.ts (pure, no Firestore/Pinia imports)     │
│   resolveRecipients(service, quarters, roles, people, selection)         │
│    └─ wraps resolveServiceRoleAssignments (existing, serviceRoles.ts)    │
│    └─ dedup by personId → { reachable[], unreachableCount }              │
│   NOT yet called by any UI component this phase (composer is Phase 59)   │
│   — unit-tested directly, in isolation                                   │
└───────────────────────────┬───────────────────────────────────────────-─┘
                             │ Firestore client SDK (rules-gated)
┌────────────────────────────▼───────────────────────────────────────────-─┐
│ FIRESTORE  organizations/{orgId}/                                        │
│   .settings.messaging { enabled, lockNotifyDefault, reminderEnabled,     │
│                          reminderDaysBefore, fromName?, replyTo? }        │
│   .settings.timezone   (IANA string)                                     │
│   services/{serviceId}.messaging { lockNotifyEnabled, reminderEnabled,   │
│                          reminderDaysBefore, reminderSentAt } (all       │
│                          nullable = inherit)                              │
│     ├─ messages/{messageId}        NEW rules block, NO writer yet        │
│     │    └─ recipients/{recipientId}  NEW rules block, NO writer yet     │
│     └─ lockSnapshots/{snapshotId}  NEW rules block, NO writer yet        │
│                                                                            │
│  firestore.rules evaluates every read/write above — the ONLY server-     │
│  side enforcement this phase adds (no Cloud Function exists yet)         │
└────────────────────────────────────────────────────────────────────────-─┘
```

**Read this diagram literally:** the `messages`/`recipients`/`lockSnapshots` rules blocks are added with
**no client code that ever writes to them yet** — proven only by the rules-emulator test's own seeded
writes (`context.firestore()` calls under `assertSucceeds`/`assertFails`, not real app traffic). That is
intentional and matches `58-CONTEXT.md`'s "rules-first discipline" note and the milestone
`ARCHITECTURE.md`'s Phase A description ("firestore.rules: add the blocks... even before any UI writes to
them").

### Recommended Project Structure

```
src/
├── types/organization.ts        # MODIFIED — OrgSettings.messaging + .timezone, DEFAULT_ORG_SETTINGS
├── stores/auth.ts                # MODIFIED — loadOrgContext merges settings.messaging + settings.timezone
├── stores/services.ts            # MODIFIED — new setServiceMessagingDefaults(serviceId, patch) action
├── utils/
│   ├── messaging.ts              # NEW — isMessagingEnabled() choke point
│   ├── messagingRecipients.ts    # NEW — pure resolveRecipients(), MESSAGING_TEAM_LABELS
│   └── __tests__/
│       └── messagingRecipients.test.ts   # NEW — unit tests, zero Firestore/Pinia mocking
├── views/
│   ├── SettingsView.vue          # MODIFIED — new "Messaging" card (appended after Slide Typography)
│   └── ServiceEditorView.vue     # MODIFIED — new per-service "Messaging defaults" panel (Service Order tab)
└── rules.test.ts                 # MODIFIED — new describe block(s): messages/recipients/lockSnapshots
                                   #   ALLOW-case + deny-case tests

firestore.rules                   # MODIFIED — messages/recipients/lockSnapshots blocks under
                                   #   match /services/{docId}; UNDEPLOYED this phase (owner deploy step)
```

### Pattern 1: Org-settings kill-switch + nested defaults block

**What:** A boolean feature toggle nested under `organizations/{orgId}.settings`, defaulting `false`,
merged exactly once in `auth.ts::loadOrgContext`, gated at a single client choke-point function.
**When to use:** Any org-wide feature that must fail closed for a fresh org (contrast with `aiEnabled`/
`pcEnabled`, which default `true` because they work with zero extra config).
**Example (settings type + default, adapt into `src/types/organization.ts`):**
```typescript
// Source: existing OrgSettings pattern (src/types/organization.ts:52-114, 158-178) — new field only,
// same shape discipline every member REQUIRED, optionality lives at loadOrgContext.
export interface OrgSettings {
  // ...existing fields unchanged...
  messaging: {
    enabled: boolean            // R130 — GLOBAL kill switch, defaults false (deliberate deviation)
    lockNotifyDefault: boolean  // conservative default false
    reminderEnabled: boolean    // conservative default false
    reminderDaysBefore: number  // default 7
    fromName?: string
    replyTo?: string
  }
  timezone: string              // R133 — IANA name, default 'America/Chicago'
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  // ...existing fields unchanged...
  messaging: {
    enabled: false,
    lockNotifyDefault: false,
    reminderEnabled: false,
    reminderDaysBefore: 7,
  },
  timezone: 'America/Chicago',
}
```

**Merge point (`src/stores/auth.ts::loadOrgContext`, adapt the existing shallow-spread + deep-merge
block at ~line 205-215):**
```typescript
// Source: existing pattern, src/stores/auth.ts:205-215 (slideTypography deep-merge precedent
// WR-01/46-REVIEW.md — the plain `...orgSettings` spread is shallow, so a partial/legacy stored
// `messaging` value must be deep-merged the same way slideTypography already is, or a doc that
// persisted only `enabled` would leave lockNotifyDefault/reminderEnabled/reminderDaysBefore
// `undefined` instead of falling back to defaults.
settings.value = {
  ...DEFAULT_ORG_SETTINGS,
  ...orgSettings,
  vwModeEnabled: resolvedVwModeEnabled,
  slideTypography: {
    ...DEFAULT_ORG_SETTINGS.slideTypography,
    ...orgSettings.slideTypography,
  },
  messaging: {
    ...DEFAULT_ORG_SETTINGS.messaging,
    ...orgSettings.messaging,
  },
  // timezone is a flat string field — plain `...orgSettings` spread already covers it correctly,
  // no deep-merge needed (unlike the nested objects above).
}
```

### Pattern 2: Single choke-point feature gate

**What:** One function per feature that every UI surface calls instead of reading
`authStore.settings.<field>` directly at each call site.
**When to use:** Any feature with more than one entry point that must honor a toggle consistently.
**Example:**
```typescript
// Source: existing precedent, src/utils/claudeApi.ts:69-71 (isAiEnabled) — new file
// src/utils/messaging.ts, same shape, adapted for messaging's toggle.
import { useAuthStore } from '@/stores/auth'

/**
 * Single shared choke point for the org-level messaging kill switch (R130).
 * No UI surface in THIS phase calls it yet (the composer/lock-notify/reminder
 * surfaces that will are Phases 59-61) — it exists now so every later phase
 * has exactly one place to import from, per claudeApi.ts's precedent.
 */
export function isMessagingEnabled(): boolean {
  return useAuthStore().settings.messaging.enabled
}
```

### Pattern 3: Scoped dot-path write for per-service overrides

**What:** `updateDoc` targeting a single nested leaf key (e.g. `messaging.lockNotifyEnabled`), never the
whole `messaging` map — prevents two editors' concurrent per-field overrides from clobbering each other.
**When to use:** Any per-service metadata field that (a) must NOT go through `updateService`'s R036
draft-only content guard, and (b) must not race with sibling-field writes.
**Example:**
```typescript
// Source: existing precedent, src/stores/services.ts:442-461 (setRoleOverride) — adapt shape.
async function setServiceMessagingDefaults(
  serviceId: string,
  patch: Partial<{
    lockNotifyEnabled: boolean | null
    reminderEnabled: boolean | null
    reminderDaysBefore: number | null
  }>,
): Promise<void> {
  if (!orgId.value) return
  // Draft-only editability (58-CONTEXT.md) — same R036 guard shape as setRoleOverride,
  // even though this write bypasses updateService's own content-path guard.
  const stored = storedStatusOf(serviceId)
  if (stored !== 'draft') {
    throw new ServiceLockedError(serviceId, stored, 'set messaging defaults on')
  }
  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    updates[`messaging.${key}`] = value
  }
  updates['updatedAt'] = serverTimestamp()
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), updates)
}
```

### Pattern 4: Inherit/override `<select>` idiom

**What:** A `<select>` whose empty-string option means "inherit the org default," with the org's
resolved value interpolated into the option's own label.
**When to use:** Any per-service field that inherits from a Settings-level default (already shipped once
for the per-scripture-slot Bible-version override).
**Example:**
```html
<!-- Source: existing precedent, ServiceEditorView.vue:1078-1092 (Bible-version override select) —
     same idiom, new field. -->
<select
  :value="service.messaging?.lockNotifyEnabled === null || service.messaging?.lockNotifyEnabled === undefined
    ? ''
    : String(service.messaging.lockNotifyEnabled)"
  @change="onChangeLockNotifyOverride(($event.target as HTMLSelectElement).value)"
>
  <option value="">Default (Settings: {{ authStore.settings.messaging.lockNotifyDefault ? 'On' : 'Off' }})</option>
  <option value="true">On</option>
  <option value="false">Off</option>
</select>
<!-- Locked-read-only branch mirrors ServiceEditorView.vue:1093-1100 exactly:
     v-if="canEditService" (editable) / v-else-if="authStore.isEditor && isLocked" (read-only summary)
     / v-else (viewer, same read-only summary). -->
```

### Pattern 5: Pure recipient resolver

**What:** A zero-dependency function that maps a selection (`teams`/`individualPersonIds`/
`includeEveryone`) through the existing role-assignment resolver into deduped, reachability-split
recipient lists.
**When to use:** Any surface needing "who does this apply to" from assigned service roles — this phase's
consumer is the unit test suite only; Phase 59's composer will be the first real UI consumer.
**Example:**
```typescript
// Source: adapts existing resolveServiceRoleAssignments (src/utils/serviceRoles.ts:33-56) per
// ARCHITECTURE.md's Recipient Resolution section + 58-CONTEXT.md's locked signature.
import type { Service } from '@/types/service'
import type { Quarter, Role, RoleGroup, Person } from '@/types/roster'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'

export const MESSAGING_TEAM_LABELS: Record<RoleGroup, string> = {
  band: 'Worship',
  tech: 'Tech',
  vocals: 'Vocals',
  other: 'Hosts',
}

export interface RecipientCandidate {
  id: string
  name: string
  email: string
}

export interface RecipientSelection {
  teams: RoleGroup[]
  individualPersonIds: string[]
  includeEveryone: boolean
}

export function resolveRecipients(
  service: Service,
  quarters: Quarter[],
  roles: Role[],
  people: Person[],
  selection: RecipientSelection,
): { reachable: RecipientCandidate[]; unreachableCount: number } {
  const assignments = resolveServiceRoleAssignments(service, quarters, roles)
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const matchedPersonIds = new Set<string>()

  for (const a of assignments) {
    const matchesTeam = selection.includeEveryone || selection.teams.includes(a.group)
    if (matchesTeam) {
      for (const pid of a.effectivePersonIds) matchedPersonIds.add(pid)
    }
  }
  for (const pid of selection.individualPersonIds) matchedPersonIds.add(pid)

  const reachable: RecipientCandidate[] = []
  let unreachableCount = 0
  for (const pid of matchedPersonIds) {
    const person = peopleById.get(pid)
    if (!person) continue // stale/deleted person id — silently skip, not an unreachable count
    if (person.email === '') {
      unreachableCount++
    } else {
      reachable.push({ id: person.id, name: person.name, email: person.email })
    }
  }
  return { reachable, unreachableCount }
}
```

### Anti-Patterns to Avoid

- **Whole-map settings overwrite:** never `updateDoc(orgRef, { settings: { ...newFullMap } })` — always a
  scoped dot-path leaf (`'settings.messaging.enabled'`), matching `onToggleAiEnabled`'s exact shape. A
  whole-map write would race with any other Settings save happening concurrently in another tab.
- **Routing per-service messaging defaults through `updateService`:** this would subject the write to the
  R036 draft-only content guard's `affectedKeys()` check, which does not have a carve-out for `messaging`
  — the write would be silently rejected by rules on a non-draft service in a confusing way. Use the
  dedicated scoped action instead, with its own explicit draft check (mirrors `setRoleOverride`).
- **Repurposing `RolesConfigPanel.vue`'s `groupLabels`:** introduce `MESSAGING_TEAM_LABELS` as its own
  constant. The two UIs are allowed to describe the same `RoleGroup` enum differently ("Band" vs
  "Worship"); conflating them would make a Roles-config copy change silently ripple into the messaging
  composer's team names.
- **Treating an unfilled role the same as an unreachable person:** `effectivePersonIds = []` (no one
  assigned) is 0 recipients with no warning; a person assigned but with `email === ''` is a genuinely
  different, warning-worthy case (`unreachableCount`). Conflating them under-communicates a real gap in
  volunteer contact info.
- **A rules-emulator test suite with only deny-cases:** CLAUDE.md documents that
  `src/storage.rules.test.ts` was mislabeled "not a defect" for an entire milestone while every one of its
  ALLOW-cases silently failed — the deny-cases alone gave false confidence. Phase 58's new rules tests
  MUST include at least one genuine ALLOW-case per new collection.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Settings defaults merge | A second `?? default` fallback scattered at each consumer | The single `loadOrgContext` merge point, extended with the new `messaging`/`timezone` fields | `OrgSettings`'s own JSDoc states every member is REQUIRED and optionality lives ONLY at this one boundary — a second fallback site would violate that documented invariant |
| Recipient email dedup | A `Set<string>` keyed on lowercased email address | Dedup by `person.id` (Map keyed on person id) | Two different people could theoretically share an email typo; dedup-by-person-id also naturally collapses "same person, two matching roles" without any string normalization concerns |
| IANA timezone validation | A hand-rolled regex or an enumerated-string union type covering every IANA zone | The curated 7-entry `<select>` locked in `58-UI-SPEC.md` (`America/New_York`, `America/Chicago`, `America/Denver`, `America/Phoenix`, `America/Los_Angeles`, `America/Anchorage`, `Pacific/Honolulu`) | Discretionary call already made in UI-SPEC; a full IANA list needs `Intl.supportedValuesOf('timeZone')` (browser-only, no polyfill needed) but the curated shortlist was chosen specifically to avoid the "find your city in a 400-entry list" UX cost for a 2-3-planner tool |

**Key insight:** Every "don't hand-roll" item in this phase is really "don't re-derive a decision this
codebase (or this phase's own CONTEXT/UI-SPEC) already made" — there is no new algorithmic complexity
here, only discipline about reusing the one merge point, the one choke point, and the one dedup key.

## Common Pitfalls

### Pitfall 1: Shallow-spreading the new `messaging` settings block

**What goes wrong:** A Firestore document that has only partially persisted `settings.messaging` (e.g.
hand-edited, or written by a future code path that omits a field) gets merged with a plain
`...orgSettings` spread, leaving `lockNotifyDefault`/`reminderEnabled`/`reminderDaysBefore` `undefined`
instead of falling back to `DEFAULT_ORG_SETTINGS.messaging`'s per-field defaults.
**Why it happens:** The existing `...orgSettings` top-level spread is shallow by design (documented at
`WR-01`/`46-REVIEW.md` for `slideTypography`) — nested objects need their own explicit deep-merge line,
easy to forget when adding a new nested field.
**How to avoid:** Deep-merge `messaging` exactly the way `slideTypography` already is (see Pattern 1
above) — `messaging: { ...DEFAULT_ORG_SETTINGS.messaging, ...orgSettings.messaging }`.
**Warning signs:** A unit/component test that seeds a partial `settings.messaging` object (e.g. just
`{ enabled: true }`) and asserts the other fields still resolve to their documented defaults — if this
test doesn't exist, the gap won't be caught until a real partial document appears in production.

### Pitfall 2: Forgetting the mirror-write into `authStore.settings`

**What goes wrong:** After a successful `updateDoc`, the Settings card's local `authStore.settings.*`
value isn't updated to match, so the UI shows a stale value until the next full page load / `loadOrgContext`
re-run.
**Why it happens:** `settings` is documented as "Mirror-written from Settings, exactly like
`vwModeEnabled`... NOT live-synced via `onSnapshot`" (`src/stores/auth.ts:66-69`) — every save handler is
individually responsible for this mirror write, and it's easy to add the `updateDoc` call without the
paired `authStore.settings.messaging.<field> = newValue` line.
**How to avoid:** Copy `onToggleAiEnabled`'s exact two-step shape (`updateDoc` then
`authStore.settings.aiEnabled = newValue`) for every new toggle/select handler.
**Warning signs:** A component test that toggles the switch, asserts the `updateDoc` mock was called, but
does NOT also assert `authStore.settings.messaging.enabled` reflects the new value — that gap hides this
bug.

### Pitfall 3: Rules-block placement outside `match /services/{docId}`

**What goes wrong:** Adding `match /messages/{messageId}` etc. as a **sibling** of `match
/services/{docId}` (both under `organizations/{orgId}`) instead of **nested inside** it. A sibling match
targets `organizations/{orgId}/messages/{messageId}` — a completely different, wrong path — never
`organizations/{orgId}/services/{serviceId}/messages/{messageId}`.
**Why it happens:** Firestore rules syntax makes nested-vs-sibling placement a matter of brace scoping,
not an obviously-wrong-looking structural error — a misplaced closing brace compiles and deploys fine,
it just protects the wrong collection.
**How to avoid:** Follow the exact precedent at `firestore.rules:189-199` (`songs/{songId}` containing a
nested `match /lyrics/{lyricsId}`) — the new `messages`/`lockSnapshots` blocks go inside
`match /services/{docId} { ... }`, before its closing brace (currently line 128), and `recipients` nests
one level further inside `messages`.
**Warning signs:** An emulator test that writes to `organizations/{orgId}/messages/{id}` succeeds when it
should fail (because it's hitting the accidentally-permissive sibling path, not the intended nested one)
— write the emulator test against the FULL nested path
(`organizations/{orgId}/services/{serviceId}/messages/{id}`) explicitly to catch this.

### Pitfall 4: Rules test suite with only deny-cases (the CLAUDE.md-documented incident class)

**What goes wrong:** A rules test file asserts every unauthorized-access case correctly fails, but never
actually proves an authorized case succeeds — a rule that silently denies EVERYONE (including legitimate
editors) still passes 100% of a deny-only suite.
**Why it happens:** Deny-cases are easier to write first and feel more obviously "security testing"; the
allow-case requires seeding a realistic member doc + service doc first, which is more setup.
**How to avoid:** Per `58-CONTEXT.md`'s explicit non-negotiable: write at least one genuine ALLOW-case per
new collection — an org editor creating a `messages` doc, an org member reading it, an org editor writing
a `lockSnapshots` doc. Use `seedMembershipDoc`/`seedDoc` helpers already in `src/rules.test.ts` to set up
the fixture, then `assertSucceeds`.
**Warning signs:** Exactly the CLAUDE.md-documented signature — "every deny case passes, every allow case
would fail if written" — is invisible unless the allow case actually exists in the suite. This is stated
as a hard requirement, not a nice-to-have, precisely because it silently shipped once already in this
project (`storage.rules.test.ts`, described in CLAUDE.md).

### Pitfall 5: `reminderDaysBefore` select value type coercion

**What goes wrong:** HTML `<select>` option values are always strings; if the store action or the
component handler doesn't explicitly `Number(...)` the selected value before writing it to Firestore,
`reminderDaysBefore` gets persisted as the string `"7"` instead of the number `7` — later code (Phase 61's
cron, comparing `service.date - effectiveN`) would then do string arithmetic or `NaN` math.
**Why it happens:** Native `<select>` semantics; easy to forget when the existing precedent
(`slot.bibleVersion`) happens to be a string field, so the cast-to-number step has no direct precedent to
copy in this specific codebase.
**How to avoid:** Explicit `Number($event.target.value)` in the `@change` handler for both the org-level
and per-service `reminderDaysBefore` selects, and a unit/component test asserting the persisted value's
`typeof` is `'number'`.
**Warning signs:** A test that only checks the UI displays the right label, never inspects the type of
the value passed to `updateDoc`/the store action.

## Runtime State Inventory

Not applicable — this is a greenfield-within-milestone phase (new fields/collections), not a rename,
refactor, or migration. No existing stored data, live service config, OS-registered state, secrets, or
build artifacts carry any of the new field/collection names being introduced (`messaging`, `timezone`,
`messages`, `recipients`, `lockSnapshots`) under a DIFFERENT name that would need updating. Verified by:
`grep -rn "messaging\." src/types/organization.ts` and `grep -rn "\.messaging" firestore.rules` both
return zero hits prior to this phase's changes — these are genuinely new keys with no prior life under a
different name.

## Code Examples

Verified patterns from this codebase (all confirmed present at the cited lines in this session):

### Settings toggle save handler (adapt for the new Messaging card)
```typescript
// Source: src/views/SettingsView.vue:846-864 (onToggleAiEnabled) — verbatim shape to adapt
async function onToggleMessagingEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return
  const newValue = messagingEnabledInput.value
  messagingSaveError.value = null
  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), {
      'settings.messaging.enabled': newValue,
    })
    authStore.settings.messaging.enabled = newValue
    messagingSavedFeedback.value = true
    setTimeout(() => { messagingSavedFeedback.value = false }, 2000)
  } catch (err) {
    console.error('[SettingsView] save messaging.enabled error:', err)
    messagingSaveError.value = 'Failed to save. Please try again.'
    messagingEnabledInput.value = !newValue // revert
  }
}
```

### Rules block (exact nesting target, adapt into `firestore.rules` inside `match /services/{docId}`)
```
// Source: adapts songs/lyrics nesting precedent (firestore.rules:189-199) and pptxRenders'
// Admin-SDK-only-write precedent (firestore.rules:215-217) — placed inside match /services/{docId}
// (currently closes at line 128), before that block's own closing brace.
match /messages/{messageId} {
  allow read: if isOrgMember(orgId);
  allow create: if isOrgEditor(orgId);
  allow update, delete: if false;   // status transitions are Admin-SDK-only (Phase 59+)

  match /recipients/{recipientId} {
    allow read: if isOrgMember(orgId);
    allow write: if false;          // Admin-SDK-only (Phase 59+)
  }
}

match /lockSnapshots/{snapshotId} {
  allow read: if isOrgMember(orgId);
  allow write: if isOrgEditor(orgId);
}
```

### Rules-emulator ALLOW-case test (new pattern for this phase, matching existing test file shape)
```typescript
// Source: adapts existing helpers/shape from src/rules.test.ts:33-90
// (seedMembershipDoc, assertSucceeds/assertFails, authenticatedContext)
describe('services/{id}/messages nested collection', () => {
  it('allows an org editor to create a messages doc under their org service', async () => {
    await seedMembershipDoc('orgA', 'editorA', 'editor')
    await seedDoc('organizations/orgA/services/svc1', { status: 'draft' })
    const context = testEnv.authenticatedContext('editorA')
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1'), {
        type: 'oneoff',
        status: 'queued',
      }),
    )
  })

  it('allows an org member to read a messages doc', async () => {
    await seedMembershipDoc('orgA', 'memberA', 'member')
    await seedDoc('organizations/orgA/services/svc1/messages/msg1', { type: 'oneoff' })
    const context = testEnv.authenticatedContext('memberA')
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1')))
  })

  it('denies a viewer from creating a messages doc', async () => {
    await seedMembershipDoc('orgA', 'viewerA', 'viewer')
    const context = testEnv.authenticatedContext('viewerA')
    const db = context.firestore()
    await assertFails(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1'), { type: 'oneoff' }),
    )
  })

  it('denies any client write to a recipients subdoc (Admin-SDK-only)', async () => {
    await seedMembershipDoc('orgA', 'editorA', 'editor')
    const context = testEnv.authenticatedContext('editorA')
    const db = context.firestore()
    await assertFails(
      setDoc(
        doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1', 'recipients', 'r1'),
        { status: 'sent' },
      ),
    )
  })
})
```

## State of the Art

Not applicable — nothing in this phase's domain (Firestore settings merge pattern, security rules,
Vue toggle cards) has a "current approach superseding an old approach" axis. Every pattern reused is the
stable, already-shipping convention of this specific codebase, not an evolving external ecosystem
convention.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DEFAULT_ORG_SETTINGS.timezone = 'America/Chicago'` is an acceptable placeholder default | Pattern 1, User Constraints | Low — `58-CONTEXT.md` already flags this explicitly as "Flag for owner confirmation at verification"; only load-bearing once Phase 61's cron ships, not this phase |
| A2 | The curated 7-timezone shortlist (not the full IANA list) is sufficient for v1.7 | Don't Hand-Roll | Low — already a locked discretionary decision in `58-UI-SPEC.md`; if wrong, swapping to `Intl.supportedValuesOf('timeZone')` is a small, isolated follow-up change to one `<select>`'s options |
| A3 | `resolveRecipients` silently skipping a `personId` with no matching `Person` record (stale/deleted person still referenced by `roleAssignmentOverrides` or a quarter's calendar) is correct behavior, distinct from "unreachable" | Pattern 5 (Code Examples) | Medium — if a stale person-id should instead count toward `unreachableCount` or surface a different warning, the composer (Phase 59) would under-report a data-integrity gap; not specified explicitly in CONTEXT.md, inferred from "unreachable = assigned but empty email," which presumes the person record exists |

**If this table is empty:** N/A — see entries above; two of three are already explicitly flagged in
upstream docs as owner-confirmable, the third (A3) is a genuine implementation-detail inference worth a
one-line confirmation during planning or verification.

## Open Questions

1. **Should `resolveRecipients` treat a stale/deleted `personId` (present in `roleAssignmentOverrides` or
   a quarter's calendar, absent from the current `people` roster) as `unreachableCount` or as a silent
   skip?**
   - What we know: the locked spec only defines "unreachable" as "assigned but `person.email === ''`" —
     it presumes the `Person` record exists.
   - What's unclear: whether a genuinely deleted/missing person should inflate the same counter (so the
     planner sees "N people can't be reached") or be invisible (current proposal, Assumption A3).
   - Recommendation: implement the silent-skip behavior (Assumption A3) as the default for Phase 58 (it's
     the more conservative, more literal reading of the locked spec), but flag this as a one-line
     confirmation point for whoever plans/executes this phase — it's a two-line code change either way,
     not worth blocking on.

2. **Exact `RecipientCandidate` field set** — `58-CONTEXT.md` explicitly defers this to "Claude's
   Discretion." The Code Examples above propose `{ id, name, email }`; Phase 59's composer will likely
   need `roleNames` too (per `ARCHITECTURE.md`'s `recipients/{recipientId}.roleNames`, resolved at SEND
   time, not compose time) — Phase 58's shape does not need to anticipate that; keep it minimal now,
   Phase 59 extends if needed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (root `package.json`) [VERIFIED: codebase — matches CLAUDE.md's documented pinning] |
| Config file | App suite: `vite.config.ts` (root, excludes `src/rules.test.ts` and `render-service/**`). Rules suite: `vitest.rules.config.ts` (separate config, runs under `firebase emulators:exec`) |
| Quick run command | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts` (pure unit, no emulator) |
| Full suite command | App: `npx vitest run`. Rules: `npm run test:rules` (starts its own emulator) — or, if an emulator is already running, `npx vitest run --config vitest.rules.config.ts` directly (per CLAUDE.md's documented port-conflict workaround) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R130 | `DEFAULT_ORG_SETTINGS.messaging.enabled === false` | unit | `npx vitest run src/types/__tests__/organization.test.ts -t "messaging"` (or inline assertion in an existing organization-settings test) | ❌ Wave 0 — no `organization.test.ts` currently exists; a lightweight new test file is the cleanest home, OR fold the assertion into `SettingsView.test.ts` |
| R130 | `isMessagingEnabled()` returns the store's current `settings.messaging.enabled` value, both `true` and `false` | unit | `npx vitest run src/utils/__tests__/messaging.test.ts` | ❌ Wave 0 — new file, mirrors `src/utils/__tests__/claudeApi.test.ts`'s shape for its own `isAiEnabled` equivalent |
| R130 | Messaging card checkbox toggle calls `updateDoc` with `'settings.messaging.enabled'` dot-path and mirror-writes `authStore.settings.messaging.enabled` | component | `npx vitest run src/views/__tests__/SettingsView.test.ts -t "messaging"` | ✅ `SettingsView.test.ts` exists (extend it) |
| R132 | `setServiceMessagingDefaults` writes only the changed dot-path key(s), throws `ServiceLockedError` when service is not `draft` | unit/store | `npx vitest run src/stores/__tests__/services.test.ts -t "messaging defaults"` | ✅ `src/stores/__tests__/services.test.ts` exists (extend it) |
| R132 | Per-service panel shows editable selects when `canEditService`, read-only summary when locked (viewer or editor) | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "messaging defaults"` | ✅ `src/views/__tests__/ServiceEditorView.test.ts` exists (extend it) |
| R133 | `OrgSettings.timezone` persists via `updateDoc('settings.timezone', ...)` and merges correctly (including the partial-document fallback case, Pitfall 1) | unit + component | `npx vitest run src/views/__tests__/SettingsView.test.ts -t "timezone"` | ✅ extend `SettingsView.test.ts` |
| R134 | `resolveRecipients` groups by team (`RoleGroup`), resolves `includeEveryone`, and an unfilled role yields 0 recipients with no warning | unit | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts` | ❌ Wave 0 — new file, mirrors `src/utils/__tests__/serviceRoles.test.ts`'s shape |
| R135 | Dedup: a person on two matching teams counts once; unreachable count for empty-email roles; team-group filtering excludes non-selected teams | unit | `npx vitest run src/utils/__tests__/messagingRecipients.test.ts` | ❌ Wave 0 — same new file as above |
| R130/R132/R134/R135 (rules scaffolding) | `messages`/`recipients`/`lockSnapshots` deny-by-default + genuine ALLOW-case (org editor creates `messages`, org member reads it, org editor writes `lockSnapshots`) + Admin-SDK-only enforcement on `recipients`/message status fields | rules-emulator | `npm run test:rules` (or `npx vitest run --config vitest.rules.config.ts` if an emulator is already running) | ✅ `src/rules.test.ts` exists — add new `describe` block(s) per Pitfall 4/Code Examples above |

### Sampling Rate

- **Per task commit:** the relevant quick command from the table above (unit tests for
  `messagingRecipients.ts`/`messaging.ts` run in well under a second; component tests for
  `SettingsView.vue`/`ServiceEditorView.vue` run as part of `npx vitest run` scoped to that file).
- **Per wave merge:** `npx vitest run` (full app suite, excludes rules per `vite.config.ts` — this is
  correct per CLAUDE.md, not a gap) **plus** `npm run test:rules` (full rules suite — required for this
  phase specifically, since its primary new surface IS `firestore.rules`; do not skip this even though it
  runs in a separate command).
- **Phase gate:** both `npx vitest run` and `npm run test:rules` green, plus `npm run type-check` (the
  `vue-tsc --build` form, not the narrower `-p tsconfig.app.json` form — CLAUDE.md's documented gate)
  before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/utils/__tests__/messagingRecipients.test.ts` — new file, covers R134/R135 (dedup, unreachable
  count, `includeEveryone`, unfilled-role-zero-recipients-no-warning, team-group filtering)
- [ ] `src/utils/__tests__/messaging.test.ts` — new file, covers R130's `isMessagingEnabled()` choke point
  in isolation (mirrors `claudeApi.test.ts`'s Pinia-store-mocking shape for `isAiEnabled`)
- [x] Confirmed `src/stores/__tests__/services.test.ts` and `src/views/__tests__/ServiceEditorView.test.ts`
  both exist — R132's tests are extensions of existing files, not new files.
- [ ] New `describe` block(s) in `src/rules.test.ts` for `messages`/`recipients`/`lockSnapshots` — framework
  and helpers (`seedMembershipDoc`, `seedDoc`, `assertSucceeds`/`assertFails`) already exist; only new
  test cases are needed, not new infrastructure.
- [ ] No new test framework or config needed — Vitest (app) and Vitest+emulator (rules) are both already
  fully wired.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Firebase Auth already governs session identity; this phase adds no new auth surface |
| V3 Session Management | No | Unchanged — no new session concept introduced |
| V4 Access Control | Yes | `isOrgMember`/`isOrgEditor` role checks on every new `firestore.rules` block, exactly mirroring the existing `services/{docId}` and `songs/{id}/lyrics/{id}` precedent; `recipients` and message status fields are Admin-SDK-only (deny all client writes), anticipating Phase 59's server-side enforcement without prematurely exposing a client write path |
| V5 Input Validation | Partial | The `reminderDaysBefore` select is a closed enumerated set (`1,2,3,5,7,10,14`), not free text — no injection surface. `fromName`/`replyTo` are free-text inputs with no declared max-length (flagged as an open UI-SPEC item, not a security gap per se — these values are never sent anywhere in THIS phase, only stored) |
| V6 Cryptography | No | No secrets, tokens, or cryptographic material touched by this phase |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A viewer (non-editor) org member attempting to create/write a `messages`/`lockSnapshots` doc directly via the Firestore client SDK, bypassing any future UI gating | Elevation of Privilege | `firestore.rules`'s `isOrgEditor(orgId)` create/write checks (this phase's core deliverable) — client-side gating (`isMessagingEnabled()`, `canEditService`) is UX only, never the security boundary; the rules ARE the boundary and are exercised directly by the emulator test's deny-cases |
| A member of Org A attempting to read/write Org B's `messages`/`recipients`/`lockSnapshots` by guessing/enumerating another org's `serviceId` | Information Disclosure / Tampering | `isOrgMember(orgId)`/`isOrgEditor(orgId)` both resolve `orgId` from the URL path segment itself (`organizations/{orgId}/...`), not from any client-supplied field — cross-org access is structurally impossible without also forging a `members/{uid}` doc under the target org, which rules also prevent. No `collectionGroup` query exists in this phase's scope to create a cross-org leak vector |
| A client attempting to directly flip a `recipients/{id}.status` or a `messages/{id}.status`/`deliveryCounts` field (forging a "sent" status without an actual send occurring) | Tampering | `allow update, delete: if false` on `messages`, `allow write: if false` on `recipients` — no client, editor or otherwise, can write these fields this phase or any future phase; only the Admin SDK (a Phase 59+ Cloud Function) can, per the locked rules design in `58-CONTEXT.md` |
| Deploying `firestore.rules` changes without testing (rules typos silently fail open or fail closed) | Tampering / Repudiation | `npm run test:rules` against the real rules file content (`readFileSync('firestore.rules', 'utf8')` in `src/rules.test.ts`'s `beforeAll`) — the emulator evaluates the ACTUAL rules text, not a mock, so a syntax or logic error is caught before the owner's manual `firebase deploy --only firestore:rules` step |

## Sources

### Primary (HIGH confidence)
- `.planning/research/ARCHITECTURE.md` — the milestone-level deep design pass this phase consolidates
  (Data Model, Security-Rule Implications, Recipient Resolution, Build Order § Phase A sections)
  [VERIFIED: codebase — cross-checked against live source in this session, not merely copied]
- `.planning/phases/58-messaging-infrastructure-settings-recipient-resolution/58-CONTEXT.md` — locked
  implementation decisions for this specific phase
- `.planning/phases/58-messaging-infrastructure-settings-recipient-resolution/58-UI-SPEC.md` — locked UI
  contract (card markup, spacing, copy, select idiom)
- `.planning/REQUIREMENTS.md` — R130–R135 exact requirement text
- `src/types/organization.ts` — `OrgSettings`, `DEFAULT_ORG_SETTINGS` (read directly, lines 52-178)
- `src/stores/auth.ts` — `loadOrgContext`'s settings merge point (read directly, lines ~150-230)
- `src/utils/serviceRoles.ts` — `resolveServiceRoleAssignments`, `findQuarterForDate` (read directly,
  full file, 57 lines)
- `src/utils/claudeApi.ts` — `isAiEnabled` choke-point precedent (read directly, lines 1-80)
- `src/stores/services.ts` — `setRoleOverride`/`clearRoleOverride` scoped dot-path write precedent (read
  directly, lines 420-500)
- `src/types/roster.ts` — `RoleGroup`, `Person`, `Role` (read directly, lines 1-40)
- `src/views/SettingsView.vue` — `onToggleAiEnabled` handler shape (read directly, lines 288-301,
  846-864)
- `src/views/ServiceEditorView.vue` — scripture Bible-version override select + locked/read-only branch
  precedent (read directly, lines 1050-1105)
- `firestore.rules` — `isOrgMember`/`isOrgEditor`, `services/{docId}` block, `songs/{id}/lyrics/{id}`
  nesting precedent, `slideGroups`/`pptxRenders` precedent (read directly, lines 1-40, 100-200)
- `src/rules.test.ts` — existing emulator test harness shape (`seedMembershipDoc`, `seedDoc`,
  `assertSucceeds`/`assertFails`) (read directly, lines 1-90)
- `C:\projects\worshipplanner\CLAUDE.md` — type-check/test-suite discipline, `storage.rules.test.ts`
  ALLOW-case incident

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — cross-file consensus confirming Phase 58 = Phase 1/2 of the roadmap's
  proposed 7-phase build order, flagged "standard patterns... plan directly from SUMMARY + ARCHITECTURE.md"

### Tertiary (LOW confidence)
- None — every claim in this phase's research is either directly verified against live source in this
  session, or copied forward from a HIGH-confidence prior research pass.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every pattern is a direct read of live source in this
  session
- Architecture: HIGH — every recommendation anchored to a real file/line, re-verified (not merely
  trusted from ARCHITECTURE.md) in this session
- Pitfalls: HIGH — four of five pitfalls are direct extrapolations of documented precedent (deep-merge
  gap, mirror-write gap, rules nesting, deny-only test suite — the last one an actual CLAUDE.md-documented
  incident in this exact codebase); the fifth (select-value type coercion) is a standard HTML footgun,
  MEDIUM-confidence but low-risk

**Research date:** 2026-08-13
**Valid until:** 30 days (stable, in-repo consolidation — no external ecosystem drift risk since no new
dependencies are introduced)
