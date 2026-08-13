# Phase 58: Messaging Infrastructure, Settings & Recipient Resolution - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/types/organization.ts` (extend `OrgSettings`/`DEFAULT_ORG_SETTINGS`) | model | CRUD | same file, `aiEnabled`/`bibleVersion`/`slideTypography` fields | exact |
| `src/stores/auth.ts::loadOrgContext` (extend merge) | store | CRUD | same file, `vwModeEnabled`/`slideTypography` merge block (~185-221) | exact |
| `src/views/SettingsView.vue` (new "Messaging" card + timezone select) | component | request-response | same file, AI Features card (~254-301) + PC reveal-block (~67-99) + Bible Translation radio card (~303-351) | exact |
| `src/views/ServiceEditorView.vue` (new "Messaging defaults" panel) | component | CRUD | same file, per-slot Bible-version override select (~1078-1104) | exact |
| `src/stores/services.ts::setServiceMessagingDefaults` (new action) | service | CRUD | same file, `setRoleOverride`/`clearRoleOverride` (~442-494) | exact |
| `src/utils/messaging.ts::isMessagingEnabled` (new) | utility | request-response | `src/utils/claudeApi.ts::isAiEnabled` (~35-71) | exact |
| `src/utils/messagingRecipients.ts` (new) | utility | transform | `src/utils/serviceRoles.ts` (whole file, pure resolver) | exact |
| `firestore.rules` (new `messages`/`recipients`/`lockSnapshots` blocks) | config | CRUD | same file, `songs/{id}/lyrics/{id}` nested-block (~189-200) + `pptxRenders` read-only-member/Admin-write block (~202-217) | exact |
| `src/rules.test.ts` (new allow/deny cases) | test | request-response | same file, `pptxRenders — org-member read, no client write` describe block (~1496-1600) | exact |

## Pattern Assignments

### `src/types/organization.ts` (model, CRUD)

**Analog:** same file, lines 52-178

**Field-add pattern** — add ONE nested field to `OrgSettings`, doc-commented like the others (lines 52-114), plus a top-level `timezone: string` field per `58-CONTEXT.md`:
```typescript
export interface OrgSettings {
  // ...existing fields...
  messaging: {
    enabled: boolean            // GLOBAL kill switch — see DEFAULT_ORG_SETTINGS deviation note
    lockNotifyDefault: boolean
    reminderEnabled: boolean
    reminderDaysBefore: number
    fromName?: string
    replyTo?: string
  }
  timezone: string              // IANA name, e.g. 'America/Chicago'
}
```

**Defaults pattern** (lines 158-178) — every member of `DEFAULT_ORG_SETTINGS` is REQUIRED (no optional leaves):
```typescript
export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  aiEnabled: true,
  pcEnabled: true,
  // ...
  messaging: {
    enabled: false,              // DELIBERATE deviation from aiEnabled/pcEnabled's default-true
    lockNotifyDefault: false,
    reminderEnabled: false,
    reminderDaysBefore: 7,
  },
  timezone: 'America/Chicago',
}
```
Note: `fromName`/`replyTo` stay optional (`?:`) inside the nested object — mirrors nothing existing exactly since no prior field has this shape, but is consistent with `Organization.pcAppId?`'s optional-string convention (same file, lines 122-134).

---

### `src/stores/auth.ts::loadOrgContext` (store, CRUD)

**Analog:** same file, lines 185-221 (the ONE defaults-merge point)

**Merge pattern** — plain top-level fields spread flat; nested objects need an explicit deep-merge exactly like `slideTypography`'s WR-01 fix (lines 203-219), because a shallow `...orgSettings` spread on a partial/legacy stored `messaging` object would otherwise wipe unset leaf keys to `undefined`:
```typescript
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
}
```
`timezone` needs no deep merge (flat string field) — it's covered by the outer `...orgSettings` spread, same as `bibleVersion`.

No dual-read/migration needed for `messaging`/`timezone` (unlike `vwModeEnabled`) — these are brand-new fields with no legacy flat-field precedent, so a straight `?? DEFAULT` merge is correct; do not invent a dual-read.

---

### `src/views/SettingsView.vue` (component, request-response)

**Analog 1 — toggle + explain-first card shell:** AI Features card, lines 254-301 (template) + `onToggleAiEnabled`, lines 846-866 (script)

Template shell (verbatim reuse):
```html
<div class="rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6">
  <h2 class="text-sm font-semibold text-gray-300 mb-3">Messaging</h2>
  <p class="text-xs text-gray-400 mb-3">...explain-first copy...</p>
  <label class="flex items-center gap-3" :class="authStore.isEditor ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'">
    <input v-model="messagingEnabledInput" type="checkbox" :disabled="!authStore.isEditor"
      @change="onToggleMessagingEnabled"
      class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0" />
    <span class="text-sm text-gray-200">Enable volunteer email messaging</span>
  </label>
  <p v-if="messagingSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
  <p v-if="messagingSaveError" class="text-red-400 text-sm mt-2">{{ messagingSaveError }}</p>
</div>
```

Save-action handler (copy `onToggleAiEnabled` verbatim, swap field name and **flip the revert semantics is unchanged** — still `= !newValue`):
```typescript
async function onToggleMessagingEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return
  const newValue = messagingEnabledInput.value
  messagingSaveError.value = null
  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.messaging.enabled': newValue })
    authStore.settings.messaging.enabled = newValue
    messagingSavedFeedback.value = true
    setTimeout(() => { messagingSavedFeedback.value = false }, 2000)
  } catch (err) {
    console.error('[SettingsView] save messaging.enabled error:', err)
    messagingSaveError.value = 'Failed to save. Please try again.'
    messagingEnabledInput.value = !newValue
  }
}
```
**IMPORTANT:** default value of the local ref must be seeded `false` (not `true`) to match `DEFAULT_ORG_SETTINGS.messaging.enabled` — this is the one deliberate divergence from the AI/PC toggle refs' seed value.

**Analog 2 — conditional reveal sub-block:** PC Integration card's credentials reveal, line 99 (`v-if="pcEnabledInput"` wrapping `mt-6 pt-6 border-t border-gray-800`). Reuse verbatim for `v-if="messagingEnabledInput"` wrapping the "Automatic email defaults" sub-block (lock-notify checkbox, reminder checkbox, conditionally-revealed days-before select, From-name/Reply-to text inputs).

**Analog 3 — two-option select auto-save (radio):** Bible Translation card, lines 303-351 (template) + `onChangeBibleVersion`, lines 901-923 (script) — use for the `reminderDaysBefore` `<select>` and the `timezone` `<select>` (adapt from radio-group to `<select @change>`, same dot-path/`Saved!`/revert shape). Reminder-days select's revert-on-error should restore the prior numeric value (not a two-way flip like Bible Version's ESV/NLT).

**Analog 4 — explicit-Save free-text sub-form:** Organization Name/Slug fields' explicit-Save pattern (grep `authStore.orgName`/`onSaveOrgName` equivalent — same file, near top) — mirror for the grouped From-name/Reply-to inputs under one `Save` button, per UI-SPEC. Not separately read in this pass; UI-SPEC's copywriting/component-inventory sections already fully specify field styling (`w-full sm:w-80 bg-gray-800 border border-gray-700 ...`, identical to the Organization Name input).

---

### `src/views/ServiceEditorView.vue` (component, CRUD)

**Analog:** same file, lines 1078-1104 (per-slot Bible-version override select + locked-read-only branch)

**Inherit-or-override select idiom** (copy verbatim, swap field/label):
```html
<select
  :value="localService.messaging?.lockNotifyEnabled ?? ''"
  class="flex-none rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-xs px-1.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
  @change="onChangeMessagingDefault('lockNotifyEnabled', ($event.target as HTMLSelectElement).value)"
>
  <option value="">Default (Settings: {{ authStore.settings.messaging.lockNotifyDefault ? 'On' : 'Off' }})</option>
  <option value="true">On</option>
  <option value="false">Off</option>
</select>
```

**Draft-editable / locked-read-only branch idiom** (copy the three-branch structure verbatim, lines 1061/1093-1104):
```html
<template v-if="canEditService">
  <!-- editable selects -->
</template>
<p v-else-if="authStore.isEditor && isLocked" class="text-sm text-gray-200">
  Lock notification: {{ lockNotifyResolvedText }} · Service-link reminder: {{ reminderResolvedText }}
</p>
<p v-else class="text-sm text-gray-200">
  Lock notification: {{ lockNotifyResolvedText }} · Service-link reminder: {{ reminderResolvedText }}
</p>
```
`@change` calls `servicesStore.setServiceMessagingDefaults(serviceId, patch)` directly — no local `localService` mutation queued for a debounced autosave, matching the Roles tab's override selects (which also call a scoped store action directly rather than routing through the generic autosave watcher).

---

### `src/stores/services.ts::setServiceMessagingDefaults` (service, CRUD)

**Analog:** same file, `setRoleOverride`/`clearRoleOverride`, lines 442-494

**Scoped dot-path write + R036 draft guard idiom** (copy structure verbatim):
```typescript
async function setServiceMessagingDefaults(
  serviceId: string,
  patch: Partial<{
    lockNotifyEnabled: boolean | null
    reminderEnabled: boolean | null
    reminderDaysBefore: number | null
  }>,
): Promise<void> {
  if (!orgId.value) return
  const stored = storedStatusOf(serviceId)
  if (stored !== 'draft') {
    throw new ServiceLockedError(serviceId, stored, 'set messaging defaults on')
  }
  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const [key, value] of Object.entries(patch)) {
    updates[`messaging.${key}`] = value === null ? null : value
  }
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), updates)
  // mirror into local services.value + maybeRefreshShareLink, same as setRoleOverride (lines 462-467)
}
```
Do NOT route through `updateService` — same reasoning `setRoleOverride`'s comment gives (R036 guard's `affectedKeys()` surfacing).

Remember to add `setServiceMessagingDefaults` to the store's returned object (mirror line 761 `setRoleOverride,`).

---

### `src/utils/messaging.ts::isMessagingEnabled` (utility, request-response)

**Analog:** `src/utils/claudeApi.ts::isAiEnabled`, lines 35-71

**Single choke-point gate idiom** (copy structure, drop the "called inside try block" nuance since this gate makes no network call and can be called from template-bound computed properties safely):
```typescript
import { useAuthStore } from '@/stores/auth'

/**
 * Single shared choke point for the org-level messaging kill switch
 * (`authStore.settings.messaging.enabled`). Every messaging UI surface (the
 * ✉ button, lock-notify prompt, reminder scheduler UI, later phases) checks
 * this one function — mirrors claudeApi.ts::isAiEnabled's rationale.
 */
export function isMessagingEnabled(): boolean {
  return useAuthStore().settings.messaging.enabled
}
```
Note: `isAiEnabled` is called inside each network-calling export's `try` block because `useAuthStore()` throws with no active Pinia instance and that file has a "never throw" contract. `isMessagingEnabled` has no such contract yet (Phase 58 has no callers that throw-sensitive) — plan can decide whether to wrap call sites in try/catch, but the gate function itself should NOT swallow the Pinia-instance-missing throw internally (keep it a thin, honest boolean read, unlike `isAiEnabled`'s catch-wrapped callers).

---

### `src/utils/messagingRecipients.ts` (utility, transform)

**Analog:** `src/utils/serviceRoles.ts` (whole file — purity contract, resolver-wrapping pattern)

**Purity-contract header comment idiom** (copy the shape of lines 1-4):
```typescript
// Pure recipient resolver (Phase 58) — wraps resolveServiceRoleAssignments to
// turn team/individual/everyone selections into deduped, reachable/
// unreachable recipient lists. No Firestore/Pinia/store imports (types
// only), so this is testable without any app/store setup, following the
// same "pure function in utils/" convention as src/utils/serviceRoles.ts.
```

**Wrap-and-transform idiom** (mirrors `resolveServiceRoleAssignments`'s signature shape, lines 33-56 — takes `service, quarters, roles` plus one additional domain input `people`/`selection`, returns a typed result object, no side effects):
```typescript
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'
import type { Service } from '@/types/service'
import type { Quarter, Role, RoleGroup, Person } from '@/types/roster'

export const MESSAGING_TEAM_LABELS: Record<RoleGroup, string> = {
  band: 'Worship', tech: 'Tech', vocals: 'Vocals', other: 'Hosts',
}

export interface RecipientCandidate { id: string; name: string; email: string }

export function resolveRecipients(
  service: Service,
  quarters: Quarter[],
  roles: Role[],
  people: Person[],
  selection: { teams: RoleGroup[]; individualPersonIds: string[]; includeEveryone: boolean },
): { reachable: RecipientCandidate[]; unreachableCount: number } {
  const assignments = resolveServiceRoleAssignments(service, quarters, roles)
  // filter by selection.teams / includeEveryone, flatten effectivePersonIds,
  // map through people, dedupe by id, split on person.email === ''
}
```
Do NOT import `RolesConfigPanel.vue`'s `groupLabels` — define `MESSAGING_TEAM_LABELS` as its own constant per `58-CONTEXT.md`/ARCHITECTURE.md's explicit instruction (two UIs independently describing the same `RoleGroup` enum).

---

### `firestore.rules` (config, CRUD)

**Analog 1 — genuinely nested (two-segment) block, no wildcard exclusion needed:** `songs/{id}/lyrics/{id}`, lines 189-200
```
match /messages/{messageId} {
  allow read: if isOrgMember(orgId);
  allow create: if isOrgEditor(orgId);
  allow update, delete: if false;

  match /recipients/{recipientId} {
    allow read: if isOrgMember(orgId);
    allow write: if false;
  }
}
```
Place this AND `lockSnapshots` as new `match` blocks nested inside the existing `match /services/{docId} { ... }` block (same file, opens at line 100) — same nesting level as where `slideGroups`' own top-level sibling block sits, but note `messages`/`lockSnapshots` nest INSIDE `/services/{docId}`, unlike `slideGroups` which is a top-level sibling (per ARCHITECTURE.md's Security-Rule Implications section — copy that exact snippet, it's already fully drafted there).

**Analog 2 — member-read / Admin-SDK-only-write block:** `pptxRenders`, lines 202-217 — same shape for `lockSnapshots` (except `lockSnapshots` grants client `write: if isOrgEditor(orgId)`, unlike `pptxRenders`' pure read-only, since the client DOES write lock snapshots at lock time per Data Model).

**No exclusion clause needed** — comment block at lines 219-254 explains why single-segment collections need the `collection != 'X'` exclusion on the generic wildcard (line 261-266) but two-segment-deep paths like `services/{id}/messages/{id}` fall through to default-deny automatically. Do not add `messages`/`lockSnapshots` to that exclusion list — they don't need it (same reasoning already documented for `songs/{id}/lyrics/{id}`).

---

### `src/rules.test.ts` (test, request-response)

**Analog:** `pptxRenders — org-member read, no client write` describe block, lines 1496-1600, using `seedMembershipDoc`/`seedDoc` helpers (lines 32-51) and `testEnv.authenticatedContext(...).firestore()`.

**Genuine ALLOW-case idiom (non-negotiable per CLAUDE.md/58-CONTEXT.md's rules-testing discipline)** — model on `pptxRenders`' ALLOW test at line 1513, but this phase must cover a CREATE allow (not just a read allow, since `pptxRenders` has no client-create case to copy):
```typescript
describe('services/{id}/messages — org-editor create, org-member read, Admin-SDK-only status writes', () => {
  it('ALLOW — an org editor can create a messages doc under their own service', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA' })
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1'), {
        type: 'oneoff', status: 'queued', /* ... */
      }),
    )
  })

  it('ALLOW — an org member (viewer) can read a messages doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'viewer')
    await seedDoc('organizations/orgA/services/svc1/messages/msg1', { status: 'sent' })
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA' })
    await assertSucceeds(getDoc(doc(context.firestore(), 'organizations', 'orgA', 'services', 'svc1', 'messages', 'msg1')))
  })

  it('DENY — an org editor cannot update a messages doc status directly (Admin-SDK-only)', async () => {
    // mirrors pptxRenders' DENY test at line 1497
  })
})
```
Also add a `lockSnapshots` describe block with the same allow-write-by-editor / deny-by-viewer / deny-cross-org shape as the `pptxRenders` DENY tests (lines 1525-1545), since `lockSnapshots` grants editor write (unlike `pptxRenders`).

## Shared Patterns

### Feature-toggle single choke point + Settings-card auto-save triad
**Source:** `src/utils/claudeApi.ts::isAiEnabled` (gate) + `src/views/SettingsView.vue::onToggleAiEnabled`/`onTogglePcEnabled`/`onChangeBibleVersion` (save triad)
**Apply to:** `src/utils/messaging.ts`, `src/views/SettingsView.vue`'s Messaging card, all its auto-saving sub-fields
```typescript
await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.<leaf>': newValue })
authStore.settings.<leaf> = newValue
savedFeedback.value = true
setTimeout(() => { savedFeedback.value = false }, 2000)
// catch: saveError.value = 'Failed to save. Please try again.'; revert local ref
```

### Scoped dot-path `updateDoc` to avoid whole-map races + R036 draft guard
**Source:** `src/stores/services.ts::setRoleOverride`/`clearRoleOverride` (lines 442-494)
**Apply to:** `setServiceMessagingDefaults`
```typescript
const stored = storedStatusOf(serviceId)
if (stored !== 'draft') throw new ServiceLockedError(serviceId, stored, '<action>')
await updateDoc(docRef, { [`messaging.${key}`]: value, updatedAt: serverTimestamp() })
```

### Pure `utils/` resolver, zero Firestore/Pinia imports
**Source:** `src/utils/serviceRoles.ts` (file header, lines 1-4)
**Apply to:** `src/utils/messagingRecipients.ts`
Same "no Firestore/Pinia/store imports (types only)" contract, unit-testable with zero mocking.

### Rules-first nested-collection scaffolding, no wildcard exclusion for two-segment paths
**Source:** `firestore.rules::songs/{id}/lyrics/{id}` (lines 189-200) + generic wildcard comment block (lines 219-254)
**Apply to:** `firestore.rules::services/{id}/messages`, `.../messages/{id}/recipients`, `.../lockSnapshots`
Two-segments-deep paths fall through to default-deny automatically — only add explicit `allow` blocks, never touch the `collection != 'X'` exclusion list.

### Rules-testing discipline — allow-case required, not only deny-case
**Source:** `src/rules.test.ts::pptxRenders` describe block (lines 1496-1600), `seedMembershipDoc`/`seedDoc` helpers (lines 32-51)
**Apply to:** new `messages`/`recipients`/`lockSnapshots` describe blocks
Per CLAUDE.md's incident history and `58-CONTEXT.md`'s explicit non-negotiable: every new rules block ships at least one genuine `assertSucceeds` case for its intended-allowed actor, not exclusively `assertFails` deny cases.

## No Analog Found

None — every file in this phase's scope has a strong, cited analog in the existing codebase (this phase is explicitly framed by ARCHITECTURE.md as "wiring, not architecture," zero net-new primitives).

## Metadata

**Analog search scope:** `src/types/`, `src/stores/`, `src/views/`, `src/utils/`, `firestore.rules`, `src/rules.test.ts`
**Files scanned:** `organization.ts`, `auth.ts`, `SettingsView.vue`, `services.ts`, `serviceRoles.ts`, `claudeApi.ts`, `roster.ts`, `ServiceEditorView.vue`, `firestore.rules`, `rules.test.ts`
**Pattern extraction date:** 2026-08-13
