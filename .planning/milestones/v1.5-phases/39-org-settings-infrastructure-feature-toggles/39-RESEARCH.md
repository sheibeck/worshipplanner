# Phase 39: Org Settings Infrastructure & Feature Toggles - Research

**Researched:** 2026-08-06
**Domain:** Firestore org-doc settings shape (Vue 3 + Pinia) + module-entry-point feature gating
**Confidence:** HIGH — every claim below is grounded in a file/line read or grep during this research
pass. This phase is flagged "standard-pattern" in the milestone research (direct generalization of
`vwModeEnabled`), so this document focuses on the four codebase-specific unknowns flagged by the
orchestrator rather than re-deriving the general feature-flag concept.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**OrgSettings Shape**
- Nested `settings: {…}` sub-object on the organization document, not flat top-level fields.
- `vwModeEnabled` MIGRATES into `settings` (owner decision — overrides the initial recommendation to
  leave it flat). This is live production data; the migration must not flip a deliberately-off value
  back on. Required read shape: `settings?.vwModeEnabled ?? orgData.vwModeEnabled ?? true`. Dual-read
  with lazy backfill — write the value into `settings` on the next org write, never a bulk migration
  script. The flat field stays readable until every org has been backfilled; removing it is a later
  cleanup, not this phase's job.
- One defaults-merge point: `auth.ts::loadOrgContext`. It returns a fully-populated `OrgSettings` so no
  downstream caller ever writes `?? default`.
- Components read one typed `settings` computed on the auth store, not one ref per setting.

**Toggle Enforcement**
- `claudeApi.ts` returns `null` when AI is off (matches "don't throw from utils" convention and
  "AI is additive, never blocking").
- The guard imports the auth store **inside the guard function** — not threaded as a per-call-site
  parameter. Pinia permits store access outside `setup()` once the app is initialized.
- One shared internal guard, called by each exported entry point of `claudeApi.ts`. No exported
  function can forget it.
- The proving test calls each exported `claudeApi` function with the toggle off and asserts the
  underlying network call was never invoked. Success criterion 2 explicitly rejects a `v-if` test —
  the assertion must be at the module entry point, not the component layer.

**Off-State Behavior**
- AI entry points hide entirely when AI is off — not disabled-with-tooltip. Affects: song suggestions
  (`SongSlotPicker.vue`), scripture discovery (`ScriptureInput.vue`), congregational-reading AI split
  (`CongregationalEditor.vue`).
- Turning AI off never alters content AI already generated. An existing congregational split stays
  exactly as it is and remains fully editable by hand — hard guarantee (success criterion 4).
- Planning Center off hides: Export to PC, roster import, song import, and the credentials block.
  Stored credentials are retained, not cleared. Already-imported roster data and the status of
  already-`exported` services are untouched.

**Settings UI**
- The PC toggle lives inside the EXISTING "Planning Center Integration" section — not a new combined
  Integrations section.
- AI gets its own new section which explains which AI features the app supports before offering the
  off switch (song suggestions, scripture discovery, congregational reading split).
- Both toggles default to ON.
- No confirmation dialog on either toggle. Both flip immediately, the way `vwModeEnabled` already does.
- Editors can change these — same gating `SettingsView.vue` already applies. No new role tier.

### Claude's Discretion
- Exact `OrgSettings` field names and the `DEFAULT_ORG_SETTINGS` constant's location.
- Whether `Organization` and `OrgSettings` share one file (`src/types/organization.ts`) or split.
- Copy for the AI section's feature explanation, within the constraint that it names all three AI
  features.
- Test file placement, following the existing `__tests__` convention.

### Deferred Ideas (OUT OF SCOPE)
- Removing the flat `vwModeEnabled` field once every org document has been backfilled — a cleanup task,
  not this phase. The dual-read must stay until then.
- Owner-only settings tier — considered and declined; editors keep full settings access.
- Clearing PC credentials on disable — considered and declined; credentials are retained so re-enabling
  is frictionless.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R073 | Every church-level setting persists per organization and resolves to a sensible default when the field is absent — pre-v1.5 org docs never error or render blank. | § Standard Stack (OrgSettings shape), § Architecture Patterns (loadOrgContext merge), § Validation Architecture |
| R088 | A church can turn AI features off, and with them off the app makes no AI request from anywhere. | § Focus Area 2 (claudeApi.ts guard — full function inventory + import-cycle check), § Focus Area 3 (test pattern), § Validation Architecture |
| R089 | A church can turn Planning Center integration off, hiding its features without altering already-imported roster data or the status of services already exported. | § Focus Area 4 (PC surface inventory), § Validation Architecture |
</phase_requirements>

## Summary

This phase is infrastructure-first: it introduces the codebase's first `Organization`/`OrgSettings`
types and a single merge-with-defaults read point, then proves the shape with two real toggles (AI,
Planning Center) enforced at their respective module choke points. The general shape of this work —
nested settings object, `?? default` merge in `loadOrgContext`, mirror-write-not-live-sync — is a
direct, mechanical generalization of the `vwModeEnabled` pattern already shipped and battle-tested in
this codebase (Phase 16.1). No new library, no new architectural layer, and no Firestore migration
script is needed; Firestore's schemalessness is what makes the defaults-merge approach correct.

The four things that ARE genuinely uncertain and specific to this codebase — researched in depth below
— are: (1) the exact `vwModeEnabled` dual-read migration, verified against every read/write site found
by exhaustive grep; (2) the exact placement of the `claudeApi.ts` guard, verified against every
exported function and a confirmed absence of any import-cycle risk; (3) the existing fetch/SDK-mocking
test patterns this codebase already uses to prove "no network request fires," found in two different
flavors (SDK-level mock for `claudeApi.ts`, `vi.stubGlobal('fetch', ...)` for `planningCenterApi.ts`);
and (4) an exhaustive enumeration of every UI entry point that must hide when Planning Center is off,
including one existing precedent (`serviceEditorActionBar.ts`'s `buildExportOrCopyItem`) that already
implements exactly this hide-on-condition pattern for a different gate (`hasPcCredentials`) and should
be extended, not duplicated.

**Primary recommendation:** Add `src/types/organization.ts` (`Organization`, `OrgSettings`,
`DEFAULT_ORG_SETTINGS`), add one `settings = ref<OrgSettings>(DEFAULT_ORG_SETTINGS)` to the auth store
merged in `loadOrgContext` via `{ ...DEFAULT_ORG_SETTINGS, ...(orgData.settings ?? {}) }`, keep
`vwModeEnabled` as its own top-level ref exactly as it works today but change its assignment line to
the dual-read `(orgData.settings?.vwModeEnabled as boolean | undefined) ?? (orgData.vwModeEnabled as
boolean | undefined) ?? true`, add a single private `isAiEnabled()` guard function at the top of
`claudeApi.ts` that reads `useAuthStore().settings.aiEnabled` and is called first in each of the three
exported AI functions, and extend `buildExportOrCopyItem`'s existing gate
(`if (!ctx.hasPcCredentials) return undefined`) to also check a new `ctx.pcEnabled` context field.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OrgSettings storage & defaulting | Database / Storage (Firestore `organizations/{orgId}.settings`) | Frontend Server (Pinia `auth` store merge point) | Settings are per-org, must be readable by every session without a live subscription; Firestore is source of truth, Pinia is the one-time-read cache (existing `vwModeEnabled` precedent) |
| AI feature gate | API / Backend-adjacent utility (`claudeApi.ts`, browser-side but the sole proxy-call chokepoint) | Browser / Client (the four `v-if` consumers) | The guard must be unbypassable from any call site; the UI hide is a consequence of the guard, not a substitute for it (R088 explicit) |
| PC feature gate | API / Backend-adjacent utility (`planningCenterApi.ts` call sites) + `serviceEditorActionBar.ts` (declarative action-bar builder) | Browser / Client (RosterView, SongsView, SettingsView entry points) | PC has no single choke-point function like `claudeApi.ts` — enforcement is UI-entry-point hiding at every consumer, since PC calls originate from several independent modals/buttons, not one function family |
| Settings UI (toggles) | Browser / Client (`SettingsView.vue`) | Frontend Server (mirror-write to Firestore, same pattern as `onToggleVwMode`) | Settings screen is a thin read/write UI over the store; no new architectural layer needed |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pinia | ^3.0.4 (installed, verified `package.json`) | `useAuthStore()` — the settings store this phase extends | Already the app's sole state layer; no alternative considered |
| Firebase Firestore JS SDK | already installed (`firebase/firestore` imports in `auth.ts`) | `getDoc`/`updateDoc` dot-path writes for `settings.<key>` | Already the app's sole persistence layer |
| TypeScript | project-wide, `noUncheckedIndexedAccess: true` | `OrgSettings` interface + `DEFAULT_ORG_SETTINGS` const | Establishes the first typed org shape in the codebase (confirmed: no `Organization` type exists anywhere in `src/types/` today) |

No new package is introduced by this phase. **Package Legitimacy Audit is not applicable** — see below.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Nested `settings` sub-object | 8 flat top-level fields | Rejected by CONTEXT.md decision — flat fields don't scale past `vwModeEnabled`'s single boolean and pollute the org doc's identity fields |
| Nested `settings` sub-object | A `settings` subcollection | Unwarranted: nothing here is queried independently, unbounded in count, or written by a different actor — would only add a round trip (ARCHITECTURE.md §1) |
| Dual-read migration for `vwModeEnabled` | One-time Cloud Function backfill script | Explicitly rejected by CONTEXT.md — lazy backfill on next write is safer and requires no new infrastructure |

**Installation:** none — no new dependency.

## Package Legitimacy Audit

**Not applicable.** This phase adds zero new npm/pip/cargo packages — every primitive used
(`Pinia`, Firestore JS SDK, native TypeScript interfaces) is already installed and verified in
`package.json`. No `npm view`/registry check is needed because nothing new is being installed.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐
│ organizations/{orgId}   │   Firestore doc (existing identity fields
│  name, slug, pcAppId,   │   + NEW nested `settings` object)
│  pcSecret, vwModeEnabled│
│  settings: {            │
│    aiEnabled: bool      │
│    pcEnabled: bool      │
│    vwModeEnabled: bool  │ ← migrated in, dual-read with flat field
│  }                      │
└───────────┬──────────────┘
            │ getDoc (once per session, on sign-in / org switch)
            ▼
┌─────────────────────────────────────┐
│ auth.ts :: loadOrgContext()         │
│  settings.value = {                 │
│    ...DEFAULT_ORG_SETTINGS,         │
│    ...(orgData.settings ?? {}),     │
│  }                                  │
│  vwModeEnabled.value =              │
│    settings?.vwModeEnabled ??       │
│    orgData.vwModeEnabled ?? true    │
└───────────┬──────────────────────────┘
            │ store refs (authStore.settings, authStore.vwModeEnabled)
            ▼
┌──────────────────────────────┐      ┌───────────────────────────────┐
│ SettingsView.vue              │      │ claudeApi.ts                   │
│  toggles mirror-write         │      │  isAiEnabled() guard           │
│  updateDoc('settings.aiEnabled')│───▶│  called first in every         │
│  then authStore.settings.aiEnabled = │  exported fn; returns null     │
│    newValue (mirror, not live)│      │  before any network call       │
└──────────────────────────────┘      └───────────────┬─────────────────┘
                                                        │ (only if enabled)
                                                        ▼
                                        Anthropic proxy (/api/anthropic)
┌──────────────────────────────┐
│ 4 hide points, all v-if       │      ┌───────────────────────────────┐
│  SongSlotPicker.vue           │      │ PC entry points (no single     │
│  ScriptureInput.vue           │      │ choke point — gate each):       │
│  CongregationalEditor.vue     │      │  serviceEditorActionBar.ts      │
│  SettingsView.vue (PC creds)  │      │  RosterView.vue import btn      │
└──────────────────────────────┘      │  SongsView.vue import btn       │
                                        │  SettingsView.vue creds block   │
                                        └───────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── types/
│   └── organization.ts     # NEW — Organization, OrgSettings, DEFAULT_ORG_SETTINGS
├── stores/
│   └── auth.ts              # MODIFIED — settings ref + merge logic in loadOrgContext, dual-read vwModeEnabled
├── utils/
│   ├── claudeApi.ts         # MODIFIED — isAiEnabled() guard, one call per exported fn
│   └── planningCenterApi.ts # UNCHANGED (gate lives at UI entry points, not here — see Focus Area 4)
├── views/
│   ├── SettingsView.vue     # MODIFIED — new AI section, new PC toggle block
│   ├── serviceEditorActionBar.ts  # MODIFIED — buildExportOrCopyItem extended with pcEnabled check
├── components/
│   ├── SongSlotPicker.vue   # MODIFIED — v-if="authStore.settings.aiEnabled" around AI Picks block
│   ├── ScriptureInput.vue   # MODIFIED — compose into existing showAiSuggest v-if
│   └── CongregationalEditor.vue # MODIFIED — v-if around "Split with AI" button only
```

### Pattern 1: Defaults-merge at the single load point (generalizes `vwModeEnabled`)
**What:** `loadOrgContext` merges `DEFAULT_ORG_SETTINGS` under whatever `orgData.settings` contains,
so a legacy doc with no `settings` key, or one missing only the newest field, is never an error.
**When to use:** Every settings read in this phase and every later v1.5 phase that adds a field
(Phase 44 template, Phase 45 Bible version, Phase 46 font).
**Example (existing precedent in this codebase — the exact model to generalize):**
```typescript
// Source: src/stores/auth.ts:109 (verified — read during this research pass)
vwModeEnabled.value = (orgData.vwModeEnabled as boolean) ?? true
```
**New shape (this phase):**
```typescript
// settings ref, merged with defaults — never a per-field ?? at each consumption site
const orgSettings = (orgData.settings as Partial<OrgSettings> | undefined) ?? {}
settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings }

// vwModeEnabled dual-read (CONTEXT.md-mandated exact shape) — kept as its own ref,
// NOT folded only into `settings.value.vwModeEnabled`, so every existing `authStore.vwModeEnabled`
// call site (11 non-test read sites — see Focus Area 1 below) keeps working unchanged.
vwModeEnabled.value =
  (orgSettings.vwModeEnabled as boolean | undefined) ??
  (orgData.vwModeEnabled as boolean | undefined) ??
  true
```

### Pattern 2: Single internal guard function, called first in every exported entry point
**What:** One private function (not exported) that reads the auth store and returns a boolean; every
public function in the module calls it as its first statement and returns `null` if false.
**When to use:** `claudeApi.ts` only — this is the module R088 names explicitly as the enforcement
point.
**Example:**
```typescript
// NEW in src/utils/claudeApi.ts — pattern only, exact code is the planner's task
import { useAuthStore } from '@/stores/auth'

function isAiEnabled(): boolean {
  // Called inside the function body, never at module top level (CONTEXT.md decision) —
  // Pinia requires an active app instance, which does not exist at module-evaluation time.
  return useAuthStore().settings.aiEnabled
}

export async function getSongSuggestions(params: GetSongSuggestionsParams): Promise<AiSongSuggestion[] | null> {
  if (!isAiEnabled()) return null
  try {
    // ... unchanged existing body
  } catch (err) { /* unchanged */ }
}
```
This matches the codebase's existing `try { ... } catch { return null }` convention exactly — the
guard's `return null` is indistinguishable from any other failure mode to a caller, which is precisely
"additive, never blocking."

### Pattern 3: Extend an existing conditional-inclusion builder rather than adding a new gate
**What:** `serviceEditorActionBar.ts`'s `buildExportOrCopyItem` already returns `undefined` (omitting
the action-bar item entirely) when `!ctx.hasPcCredentials`. This is the exact "hide, don't
disable" pattern R089 requires, already live for a different but related condition.
**When to use:** The Export-to-PC action bar entry point specifically.
**Example:**
```typescript
// Source: src/views/serviceEditorActionBar.ts:86-87 (existing, verified)
function buildExportOrCopyItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.hasPcCredentials) return undefined
  // ...
}
// EXTEND (this phase) — compose, don't replace:
function buildExportOrCopyItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.hasPcCredentials || !ctx.pcEnabled) return undefined
  // ...
}
```
`ActionBarContext` (an interface, not a class) needs one new field `pcEnabled: boolean`, threaded from
`ServiceEditorView.vue`'s existing context-building call site (`hasPcCredentials:
authStore.hasPcCredentials,` at line 2075 — add `pcEnabled: authStore.settings.pcEnabled,` alongside
it).

### Anti-Patterns to Avoid
- **Threading `aiEnabled`/`pcEnabled` as a parameter through every call site:** CONTEXT.md explicitly
  rejects this — "where one missed site would silently bypass it." Read the store inside the guard.
- **Checking `authStore.settings.aiEnabled` only in the `.vue` files that call `claudeApi.ts`:** R088's
  own pitfall text calls this out by name as "the anti-pattern" — hiding UI while leaving the code path
  callable. The four `v-if`s are the *consequence* of the guard, never a substitute for it.
- **A per-org migration script or Cloud Function backfill for `vwModeEnabled`:** explicitly rejected;
  Firestore's schemalessness plus the dual-read make this unnecessary and CONTEXT.md forbids it.
- **Re-implementing the "hide from action bar" logic as a new standalone check** instead of extending
  `buildExportOrCopyItem`: would create two competing gates on the same button and risk drifting out of
  sync with the existing `hasPcCredentials` check.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is a setting present/valid" defaulting | A validation library or schema validator (zod, etc.) | Plain `{ ...DEFAULT_ORG_SETTINGS, ...(orgData.settings ?? {}) }` object-spread merge | This codebase has zero schema-validation dependencies anywhere; every other org field uses a bare `as T ?? default` cast. Introducing a validation library for one settings object would be a new, unjustified architectural layer for a two-boolean phase. |
| "Is AI/PC enabled" per-component checks | A new composable (`useFeatureFlag('ai')`) or a directive | Direct `authStore.settings.aiEnabled` reads in each of the ~7 consumer sites (4 hide points + 3 AI functions) | The codebase's own convention for `vwModeEnabled` (11 read sites) is direct store-ref reads with no abstraction layer; a new composable would be inconsistent with the sibling pattern this phase is meant to generalize, not diverge from. |

**Key insight:** This phase is explicitly flagged standard-pattern/skip-research in the milestone
SUMMARY.md. The correct amount of new abstraction is zero — every new thing this phase builds should
be traceable to an existing, working analogue already in this codebase (`vwModeEnabled` for the
settings-merge pattern, `buildExportOrCopyItem` for the hide-pattern, `try/catch → return null` for the
guard-return convention).

## Focus Area 1 — The `vwModeEnabled` migration: full read/write site inventory

**Exhaustive grep performed** (pattern `vwModeEnabled`, whole `src/` tree, non-test and test files
separated below). Total: 11 distinct non-test source locations, 3 test files with coverage, plus the
one Settings UI write site.

### Write sites (exactly 2)
| Site | File:line | What it writes |
|------|-----------|-----------------|
| 1 | `src/views/SettingsView.vue:481` | `updateDoc(doc(db, 'organizations', authStore.orgId), { vwModeEnabled: newValue })` — **flat field only, today** |
| 2 | `src/views/SettingsView.vue:482` | `authStore.vwModeEnabled = newValue` — mirror-write into the store ref |

**This phase's required change to write site 1:** per CONTEXT.md's lazy-backfill decision, the toggle's
save handler (`onToggleVwMode`) must be changed to write the **nested** path
(`updateDoc(orgRef, { 'settings.vwModeEnabled': newValue })`) going forward — this IS the lazy backfill:
the next time any org that still only has the flat field saves this toggle, it gets a `settings.vwModeEnabled`
entry written alongside (or instead of — see note below) the flat one. The flat field is left in place,
unwritten-to from this point on, exactly as CONTEXT.md specifies ("removing it is a later cleanup").

### Read sites (single source of truth today: `authStore.vwModeEnabled`, 1 store-internal read + 1 store export + 9 external consumers)
| # | File:line | Context |
|---|-----------|---------|
| 1 | `src/stores/auth.ts:46` | `const vwModeEnabled = ref(true)` — declaration |
| 2 | `src/stores/auth.ts:95` | no-org reset branch: `vwModeEnabled.value = true` |
| 3 | `src/stores/auth.ts:109` | **the read this phase changes**: `vwModeEnabled.value = (orgData.vwModeEnabled as boolean) ?? true` |
| 4 | `src/stores/auth.ts:152` | sign-out branch reset: `vwModeEnabled.value = true` |
| 5 | `src/stores/auth.ts:296` | `logout()` reset: `vwModeEnabled.value = true` |
| 6 | `src/stores/auth.ts:331` | exported from store return object |
| 7 | `src/views/SettingsView.vue:256,318` | local input ref sync + watcher |
| 8 | `src/views/ServiceEditorView.vue:871` | `v-if="slot.songId && authStore.vwModeEnabled"` |
| 9 | `src/views/DashboardView.vue:266-267` | conditional spread based on `authStore.vwModeEnabled` |
| 10 | `src/stores/songs.ts:58,63` | `filteredSongs` gates `type:` search prefix and `matchesVwType` |
| 11 | `src/components/SongTable.vue:93,211` | Category column header/cell gate |
| 12 | `src/components/SongSlotPicker.vue:104,144,177,244,307` | `SongBadge` gates + `songMatchesQuery` third arg |
| 13 | `src/components/SongSlideOver.vue:136` | VW Category selector wrapper |
| 14 | `src/components/SongFilters.vue:48` | VW-type `<select>` wrapper |

**All 14 non-test read/write sites read exclusively through `authStore.vwModeEnabled`** — none of them
read `orgData.vwModeEnabled` or Firestore directly. This is the single most important structural fact
for this migration: **because every consumer already goes through one store ref, the dual-read only
needs to be implemented ONCE, at `auth.ts:109`.** No consumer-side code changes are needed anywhere in
the 11-site list above — they keep reading `authStore.vwModeEnabled` exactly as today. This
dramatically de-risks the migration versus an alternative where consumers read the org doc directly.

### The admin→editor migration precedent — the shape to reuse for the lazy backfill
`loadOrgContext`'s member-doc `onSnapshot` handler (`auth.ts:114-138`) is the established precedent for
lazy, read-time backfill in this exact file:
```typescript
// Source: src/stores/auth.ts:124-134 (verified, read in full during this research pass)
const patch: Record<string, unknown> = {}
if (role === 'admin') patch.role = 'editor'
if (!data.email && user.value?.email) {
  patch.email = user.value!.email ?? ''
  patch.displayName = user.value!.displayName ?? ''
}
if (Object.keys(patch).length > 0) {
  await updateDoc(snap.ref, patch)
  if (role === 'admin') return // next snapshot sets userRole
}
```
**This precedent is a READ-triggered backfill** (fires inside the `onSnapshot` callback, i.e. on every
load). CONTEXT.md's decision for `vwModeEnabled`, however, is explicitly a **write-triggered** lazy
backfill ("write the value into `settings` on the next org write, never a bulk migration script") — the
distinction matters: `loadOrgContext`'s org-doc read (`getDoc`, not `onSnapshot`) is a one-time,
non-live read with no natural "write back on read" hook the way the member listener has one built in.
**Recommendation:** do NOT copy the member-listener's read-triggered-write shape for `vwModeEnabled`.
Instead, the backfill is naturally satisfied by write site 1 above (`onToggleVwMode`'s existing
`updateDoc`) writing to the nested path going forward — this is a write-time backfill, correctly
scoped to "the next time this org saves this toggle," which is exactly what CONTEXT.md specifies. No
new backfill code path is needed; changing the existing save handler's write target IS the backfill.

### Failure mode: a backfill write racing a concurrent settings write
**Scenario:** Two editors have Settings open simultaneously. Editor A saves the VW toggle
(`updateDoc({ 'settings.vwModeEnabled': false })`) at the same moment editor B saves the AI toggle
(`updateDoc({ 'settings.aiEnabled': false })`).
**Verified safe:** Firestore's `updateDoc` with **dot-path field references** merges only the named
leaf paths — `'settings.vwModeEnabled'` and `'settings.aiEnabled'` are two independent leaf writes into
the same top-level `settings` map field, and Firestore's document-level merge semantics for dot-paths
do NOT overwrite sibling keys. This is the same mechanism `ARCHITECTURE.md` §1 already names as the
reason for this exact dot-path scoped-write approach, citing the pre-existing
`roleAssignmentOverrides.${roleId}` precedent in `services.ts:332-335`, built specifically to avoid
concurrent-editor clobbering. **No transaction is needed** — this is not a read-modify-write race
(neither editor reads `settings` before writing; each writes only its own named leaf), so there is no
lost-update window to protect against, unlike a plain `updateDoc({ settings: {...wholeObject} })` which
WOULD clobber concurrent writes to other keys. **This is the one hazard the planner must explicitly
guard against**: any new toggle's save handler MUST use the dot-path form
(`{ 'settings.<key>': value }`), never a whole-object overwrite (`{ settings: {...} }`).

## Focus Area 2 — The `claudeApi.ts` guard: exhaustive function inventory and import-cycle check

### Every exported function in `claudeApi.ts` (verified by full file read)
| Function | Line | Makes a network call? |
|----------|------|------------------------|
| `safeParseJsonArray` | 93 | No — pure parsing helper, not an AI entry point |
| `validateSongSuggestions` | 122 | No — pure filter |
| `validateScriptureSuggestions` | 134 | No — pure filter |
| `getSongSuggestions` | 156 | **Yes** — `getClient().messages.create(...)` |
| `getScriptureSuggestions` | 276 | **Yes** — `getClient().messages.create(...)` |
| `validateSplitResult` | 403 | No — pure validation |
| `splitCongregationalReading` | 502 | **Yes** — `getClient().messages.parse(...)` |

**Exactly 3 functions make a network call and are the guard's true targets** — `getSongSuggestions`,
`getScriptureSuggestions`, `splitCongregationalReading`. The remaining 4 exports are pure functions
(parsing/validation helpers, some exported only for unit testing) and must NOT be gated — gating them
would be a functional regression (e.g. `safeParseJsonArray` is a generic JSON-array parser reused
elsewhere in principle, and gating it would silently break any future caller unrelated to the AI
toggle).

**Where the guard goes:** as the first statement inside each of the 3 network-calling functions' `try`
block (or immediately before the `try`, functionally equivalent) — i.e. `if (!isAiEnabled()) return
null` as line 1 of `getSongSuggestions`, `getScriptureSuggestions`, and `splitCongregationalReading`.
This satisfies "no exported entry point can bypass it" because these are the only 3 entry points that
touch the network in the first place.

### Import-cycle check — verified clean
- `claudeApi.ts` currently imports: `@anthropic-ai/sdk`, `@/types/song`, `@/types/service`,
  `@/types/slide`, `@/utils/scripture`, `@/utils/appAuth`, `@/utils/scriptureBoundaries`. **No Pinia
  store import today.**
- `src/stores/auth.ts` imports: `vue`, `pinia`, `firebase/auth`, `firebase/firestore`, `@/firebase`.
  **Does not import `claudeApi.ts`, `planningCenterApi.ts`, or `appAuth.ts`.**
- `src/utils/appAuth.ts` (imported by `claudeApi.ts`) imports only `@/firebase`. **Does not import
  `auth.ts`.**
- `src/firebase/index.ts` (the shared Firebase init module both `auth.ts` and `appAuth.ts` import)
  imports only the `firebase/*` SDK packages. **Does not import any app-level store or util.**

**Conclusion: `import { useAuthStore } from '@/stores/auth'` inside `claudeApi.ts` introduces zero
circular-import risk.** The dependency graph is a clean tree in the relevant direction:
`claudeApi.ts → auth.ts → firebase/index.ts`, with nothing on that path pointing back at `claudeApi.ts`.
This confirms CONTEXT.md's decision ("the guard imports the auth store inside the guard function") is
implementable exactly as specified, with the additional note that even a top-of-module `import` for
the type is safe here — only the *call* (`useAuthStore()`) must stay inside the function body, because
Pinia requires an active `app.use(pinia)` context that doesn't exist at module-evaluation time (this is
the reason for "inside the guard function," not import-cycle safety — both reasons independently point
to the same implementation).

## Focus Area 3 — Testing "no network request fires": two existing patterns to reuse, not a `fetch` mock

**This codebase already proves "no network call happens" using TWO different techniques, matched to
each module's own network-call mechanism — the planner should use whichever technique matches
`claudeApi.ts`'s actual transport, which is NOT raw `fetch`.**

### Pattern A — SDK-level mock (the one to use for `claudeApi.ts`)
`claudeApi.ts` does not call `fetch` directly — it calls `getClient().messages.create(...)` /
`.messages.parse(...)` through the `@anthropic-ai/sdk` package. The existing test file already mocks
the SDK, not `fetch`:
```typescript
// Source: src/utils/__tests__/claudeApi.test.ts:9-34 (verified, existing, passing test file)
const { mockCreate, mockParse } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  const mockParse = vi.fn()
  return { mockCreate, mockParse }
})

vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return {
      messages: { create: mockCreate, parse: mockParse },
    }
  }
  return { default: MockAnthropic }
})
```
**The R088 proving test extends this exact pattern**: mock the auth store's `settings.aiEnabled` to
`false` (via `vi.mock('@/stores/auth', ...)`, the same store-mocking convention used across this
codebase's other tests — see `SongTable.test.ts`'s `get vwModeEnabled() { return mockVwModeEnabled }`
getter-mock pattern for the precedent), call each of the 3 network-calling `claudeApi.ts` exports
directly (not through a component), and assert `mockCreate`/`mockParse` were never called
(`expect(mockCreate).not.toHaveBeenCalled()`). This is the module-entry-point assertion R088 and
CONTEXT.md require — no component, no `v-if`, direct function call.

### Pattern B — raw `fetch` mock (the existing precedent for `planningCenterApi.ts`, informative but
not the one this phase's proving test needs)
`planningCenterApi.ts` calls `fetch` directly (no SDK wrapper), and its test file uses
`vi.stubGlobal('fetch', vi.fn())` at the top of every test (confirmed: 19+ occurrences in
`src/utils/__tests__/planningCenterApi.test.ts`). This is the pattern to be aware of for R089's PC
work, but since this phase does NOT add a single choke-point function to `planningCenterApi.ts` (PC
enforcement is UI-entry-point hiding — see Focus Area 4), no `planningCenterApi.ts` module-level guard
test is needed for this phase. Documented here so the planner does not conflate the two modules'
different transport mechanisms.

### Store-mocking precedent for the R088 test (getter-mock convention)
```typescript
// Source: src/components/__tests__/SongTable.test.ts:39 (existing, verified precedent)
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get vwModeEnabled() { return mockVwModeEnabled },
    // ... other fields the test needs
  }),
}))
```
The R088 test file should mock `useAuthStore` similarly, exposing `settings: { aiEnabled: <toggle> }`
(or a `get settings()` accessor if the test needs to flip the value mid-test), matching this exact
getter-mock shape rather than inventing a new mocking convention.

## Focus Area 4 — Planning Center surface inventory (exhaustive, for the planner's `v-if` gating)

**Grepped exhaustively for every UI consumer of `planningCenterApi.ts` and every Export/roster-import/
song-import affordance.** Four distinct entry-point families found, each needing its own gate — there
is no single choke point for PC the way `claudeApi.ts` is for AI, because these calls originate from
independent modals/buttons rather than a shared function family.

| # | Surface | File | Trigger / gate today | What this phase adds |
|---|---------|------|----------------------|------------------------|
| 1 | **Export to Planning Center** (action bar button) | `src/views/serviceEditorActionBar.ts` — `buildExportOrCopyItem` (line 86-100), consumed by `ContextualActionBar.vue` | Already gated: `if (!ctx.hasPcCredentials) return undefined` | Extend to `if (!ctx.hasPcCredentials \|\| !ctx.pcEnabled) return undefined`. `ActionBarContext` interface (line 54) needs a new `pcEnabled: boolean` field; `ServiceEditorView.vue`'s context-build call site at line 2075 (`hasPcCredentials: authStore.hasPcCredentials,`) needs a sibling `pcEnabled: authStore.settings.pcEnabled,` |
| 2 | **Export dialog** (the modal itself, triggered by #1) | `src/views/ServiceEditorView.vue:380-383` (`v-if="showExportDialog"`), opened by `onExportToPC()` at line 3073-3077 | `onExportToPC` already early-returns `if (!authStore.hasPcCredentials \|\| !authStore.pcCredentials) return` | Add `\|\| !authStore.settings.pcEnabled` to the same early-return — belt-and-suspenders with #1 since the action-bar button won't render at all when off, but the function-level guard prevents any residual/stale-DOM invocation |
| 3 | **"Set up Planning Center in Settings" hint row** | `src/views/ServiceEditorView.vue:191-197` — `v-if="activeTab === 'service-order' && canEditService && !authStore.hasPcCredentials"` | Shown when creds are absent, nudging setup | **Planner decision needed**: this hint's purpose is "help the user connect PC" — when PC is *disabled* (not merely uncredentialed), showing "set up Planning Center" is misleading (it implies a currently-relevant action). Recommend composing: `!authStore.hasPcCredentials && authStore.settings.pcEnabled` — hides the nudge when PC is off, consistent with "hide entirely" rather than inviting a setup flow for a disabled feature |
| 4 | **Roster import** (button opens `RosterImportModal.vue`) | `src/views/RosterView.vue:20,77` (two "Import from Planning Center" button labels — appears to be both an empty-state CTA and a toolbar button, same `importModalOpen.value = true` handler at line 452) | No existing PC-specific gate found beyond generic auth | Wrap both button occurrences (and/or the modal's mount) in `v-if="authStore.settings.pcEnabled"` |
| 5 | **Song import** (button opens `PcImportModal.vue`) | `src/views/SongsView.vue:43` (`@click="importModalOpen = true"`) | No existing PC-specific gate found beyond generic auth | Wrap the button in `v-if="authStore.settings.pcEnabled"` |
| 6 | **Credentials display/edit block** | `src/views/SettingsView.vue:71-160` (the entire `<template v-if="authStore.hasPcCredentials && !editingPcCreds">` / `<template v-else>` pair) | Always shown inside the PC section | Per 39-UI-SPEC.md Layout §2: wrap in `v-if="pcEnabledInput"` (the new toggle's local ref) — **credentials are retained in Firestore, never cleared**; this is purely a display-hide |

**Important non-PC-utility consumers also found and confirmed correctly OUT of scope:**
- `src/utils/pcSongImport.ts` — imports `fetchSongArrangements`/`fetchLastScheduledItem` from
  `planningCenterApi.ts` internally; it has no UI of its own (consumed by `PcImportModal.vue`, already
  covered by surface #5's gate — hiding the button that opens the modal is sufficient, no separate gate
  needed inside `pcSongImport.ts` itself).
- `addSlotAsItem` (`planningCenterApi.ts:884-1005`, the per-slot PC export mapper) is called only from
  inside the already-gated export flow (surface #1/#2) — no independent gate needed.

**What "hidden" does NOT touch, confirmed by reading `onClearPcCredentials`
(`SettingsView.vue:455-468`) and `authStore.setPcCredentials`:** turning PC off never calls
`onClearPcCredentials`, never touches Firestore's `pcAppId`/`pcSecret` fields, and never resets
`authStore.pcAppId`/`pcSecret`. The retention guarantee (R089) is automatically satisfied by NOT
wiring the new toggle to any credential-clearing code path — this is an omission to preserve, not a
behavior to add.

## Common Pitfalls

### Pitfall 1: Whole-object `settings` overwrite clobbers concurrent-editor writes
**What goes wrong:** A save handler does `updateDoc(orgRef, { settings: { aiEnabled: newValue } })`
instead of the dot-path form, silently discarding any other `settings.*` field a concurrent editor
just wrote (e.g. the PC toggle).
**Why it happens:** It's the more "obvious" way to write a nested object update, and works fine in
single-editor testing.
**How to avoid:** Every settings-toggle save handler MUST use Firestore's dot-path field syntax:
`updateDoc(orgRef, { 'settings.aiEnabled': newValue })`, never `{ settings: {...} }`. This is the same
discipline `roleAssignmentOverrides.${roleId}` already establishes in `services.ts:332-335`.
**Warning signs:** A code review or test where toggling setting A and then checking setting B shows B
silently reverted to its pre-session value.

### Pitfall 2: Reading `orgData.settings?.vwModeEnabled` before confirming `orgData.settings` exists
**What goes wrong:** `noUncheckedIndexedAccess: true` is on for this project; a naive
`orgData.settings.vwModeEnabled` (no optional chain) throws or type-errors on a pre-v1.5 org doc where
`settings` doesn't exist at all.
**Why it happens:** Easy to write the dual-read as `orgData.settings.vwModeEnabled ?? orgData.vwModeEnabled ?? true`
and forget the `?.` — the CONTEXT.md-specified shape already has it right
(`settings?.vwModeEnabled ?? orgData.vwModeEnabled ?? true`), but a hand-typed variant during
implementation could drop it.
**How to avoid:** Copy CONTEXT.md's exact read shape verbatim; do not hand-retype it.
**Warning signs:** TypeScript compile error under `npm run type-check`, or a runtime crash on any
org document created before this phase ships.

### Pitfall 3: Gating a pure helper function in `claudeApi.ts` by mistake
**What goes wrong:** Adding the `isAiEnabled()` guard to `safeParseJsonArray`, `validateSongSuggestions`,
or `validateScriptureSuggestions` (the 4 non-network exports) "for consistency," breaking any
non-AI-toggle-related caller of these pure functions (they are exported and unit-tested independently
of the AI toggle in the existing test suite).
**Why it happens:** All 7 exports live in the same file; it's tempting to gate the whole module
uniformly.
**How to avoid:** Gate only the 3 functions that call `getClient().messages.*` — see Focus Area 2's
table.
**Warning signs:** `claudeApi.test.ts`'s existing pure-function tests (parsing/validation, unrelated to
the AI toggle) start failing once the toggle mock is introduced.

### Pitfall 4: New AI/PC toggle test coverage duplicating instead of extending existing test files
**What goes wrong:** Creating a whole new mock/test setup for `claudeApi.ts` instead of extending the
existing `vi.hoisted` SDK mock already in `claudeApi.test.ts`.
**Why it happens:** Not reading the existing test file before writing new tests.
**How to avoid:** Add the toggle-off test cases inside the existing `describe` blocks for
`getSongSuggestions`/`getScriptureSuggestions`/`splitCongregationalReading` in
`src/utils/__tests__/claudeApi.test.ts`, reusing the already-hoisted `mockCreate`/`mockParse`.

## Code Examples

### The exact dual-read for `vwModeEnabled` (CONTEXT.md-mandated, verified type-safe)
```typescript
// src/stores/auth.ts — replaces line 109
const orgSettings = (orgData.settings as Partial<OrgSettings> | undefined) ?? {}
settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings }
vwModeEnabled.value =
  orgSettings.vwModeEnabled ??
  (orgData.vwModeEnabled as boolean | undefined) ??
  true
```

### The AI guard, applied to all three network-calling exports
```typescript
// src/utils/claudeApi.ts
import { useAuthStore } from '@/stores/auth'

function isAiEnabled(): boolean {
  return useAuthStore().settings.aiEnabled
}

export async function getSongSuggestions(
  params: GetSongSuggestionsParams,
): Promise<AiSongSuggestion[] | null> {
  if (!isAiEnabled()) return null
  try {
    // ...unchanged
  } catch (err) {
    console.error('[claudeApi] getSongSuggestions failed:', err)
    return null
  }
}
// same one-line guard at the top of getScriptureSuggestions and splitCongregationalReading
```

### The action-bar PC gate extension
```typescript
// src/views/serviceEditorActionBar.ts
export interface ActionBarContext {
  // ...existing fields
  hasPcCredentials: boolean
  pcEnabled: boolean // NEW
  // ...
}

function buildExportOrCopyItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.hasPcCredentials || !ctx.pcEnabled) return undefined
  // ...unchanged
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Flat top-level org-doc booleans (`vwModeEnabled`, `pcAppId`, `pcSecret`) with per-consumer `?? default` | Nested `settings` object with one merge-with-defaults point | This phase (39) | Every later v1.5 settings phase (44, 45, 46) adds a field to `OrgSettings`/`DEFAULT_ORG_SETTINGS` and is done — no new load/reset logic anywhere |

**Deprecated/outdated:** none — `vwModeEnabled` as a store ref/consumer-facing API is explicitly NOT
deprecated by this phase (CONTEXT.md: "do not migrate `vwModeEnabled` itself [as a store field]; that
field already ships and works"). Only its Firestore *storage location* migrates, behind the dual-read.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The AI section's exact explanatory copy for the three features (song suggestions, scripture discovery, congregational split) is left to Claude's discretion per CONTEXT.md — 39-UI-SPEC.md's Copywriting Contract already provides exact locked strings, so this is resolved, not assumed. No entry needed. | — | — |
| A2 | `noUncheckedIndexedAccess` requires optional chaining on `orgData.settings?.vwModeEnabled` — verified directly against `tsconfig.app.json:7` (`[VERIFIED: tsconfig.app.json]`), not assumed. | — | — |

**This table is empty of genuine assumptions.** Every claim in this document was verified by reading
the actual file/line during this research pass (package.json, tsconfig.app.json, auth.ts,
claudeApi.ts, planningCenterApi.ts, serviceEditorActionBar.ts, SettingsView.vue, RosterView.vue,
SongsView.vue, ServiceEditorView.vue, appAuth.ts, firebase/index.ts, claudeApi.test.ts,
planningCenterApi.test.ts, SongTable.test.ts) or via an exhaustive grep whose full output was
inspected. No web/external research was needed — this is a pure codebase-integration research pass,
matching ARCHITECTURE.md's own precedent for this milestone.

## Open Questions

1. **Should the "Set up Planning Center in Settings" hint (Focus Area 4, surface #3) hide when PC is
   disabled, or only when credentials are absent?**
   - What we know: The hint's current gate is `!authStore.hasPcCredentials` only — it invites setup
     regardless of whether PC integration itself is on.
   - What's unclear: 39-UI-SPEC.md's Hide-Don't-Disable table (row 4) scopes the enumeration job to
     the planner but doesn't explicitly call out this particular hint row.
   - Recommendation: compose `!authStore.hasPcCredentials && authStore.settings.pcEnabled` so the
     nudge disappears when the feature itself is off — consistent with "hide entirely," but flag this
     as a discretionary UI call for the planner/UI-checker to confirm against 39-UI-SPEC.md's actual
     intent if it becomes ambiguous during implementation.

2. **Exact field name for the PC toggle — `pcEnabled` used throughout this document as the working
   name.**
   - What we know: CONTEXT.md leaves exact field names to Claude's discretion.
   - What's unclear: nothing blocking — this is confirmed discretionary.
   - Recommendation: `aiEnabled` / `pcEnabled` (matching `vwModeEnabled`'s existing naming convention:
     `<feature>Enabled`, camelCase, boolean).

## Environment Availability

Not applicable — this phase has no external tool/service/runtime dependency beyond what's already
installed (Pinia, Firestore SDK, Vitest, all confirmed present in `package.json`). No new CLI, database
connection, or service is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vite.config.ts` (app suite, excludes `src/rules.test.ts`) / `vitest.rules.config.ts` (rules suite — not touched by this phase) |
| Quick run command | `npx vitest run src/stores/__tests__/auth.test.ts src/utils/__tests__/claudeApi.test.ts src/views/__tests__/SettingsView.test.ts` (once these exist/are extended) |
| Full suite command | `npx vitest run --dir src --exclude '**/rules.test.ts'` (per CLAUDE.md — do NOT use `npx vitest run src/` or bare `--dir src` without the exclude) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| R073 | `loadOrgContext` resolves a fully-populated `OrgSettings` when `orgData.settings` is absent (pre-v1.5 org doc) | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "OrgSettings"` | ✅ file exists (`auth.test.ts`, extend it) — new describe block, Wave 0 |
| R073 | `vwModeEnabled` dual-read: a flat `vwModeEnabled: false` org doc (no `settings` key) still resolves to `false`, not the new default `true` | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "vwModeEnabled"` | ✅ file exists — existing `describe('vwModeEnabled (D-15/D-16)')` block at line 295 is the place to add the dual-read regression case |
| R073 | A `settings` object with only some keys present (e.g. only `aiEnabled`, missing `pcEnabled`) still resolves `pcEnabled` to its default | unit | same file, new test case | ✅ extend existing file |
| R088 | Each of the 3 network-calling `claudeApi.ts` exports returns `null` and never calls `mockCreate`/`mockParse` when `authStore.settings.aiEnabled === false` | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts -t "aiEnabled"` | ✅ file exists — extend existing `describe` blocks per function |
| R088 | `SongSlotPicker.vue`/`ScriptureInput.vue`/`CongregationalEditor.vue` hide their AI entry points when `aiEnabled` is false (the UI consequence, not the enforcement) | component | existing test files: `src/components/__tests__/CongregationalEditor.test.ts`, `ScriptureSlideEditor.test.ts` — extend | ✅ exist, extend |
| R088 | Turning AI off does not alter existing AI-generated content (e.g. an existing `CongregationalSection[]` split) | unit/component | `CongregationalEditor.test.ts` — assert the split data is unchanged and still editable with `aiEnabled: false` | ✅ extend existing file |
| R089 | `buildExportOrCopyItem` (action bar) omits the export item when `pcEnabled` is false, independent of `hasPcCredentials` | unit | `src/views/__tests__/serviceEditorActionBar.test.ts` if it exists, else new file alongside the module | ❓ verify existence — if absent, Wave 0 gap: create `src/views/__tests__/serviceEditorActionBar.test.ts` |
| R089 | Turning PC off does not clear `pcAppId`/`pcSecret` from Firestore or the store, and turning it back on shows the same masked credentials | unit | `src/stores/__tests__/auth.test.ts` or `SettingsView.test.ts` — assert `setPcCredentials`/`onClearPcCredentials` are never invoked by the toggle handler | ❓ verify `SettingsView.test.ts` exists — grep found no hits; likely Wave 0 gap |
| R089 | Roster import / song import buttons hide when `pcEnabled` is false | component | `RosterView.test.ts`, a `SongsView.test.ts` if it exists | ❓ `RosterView.test.ts` exists (known-failing baseline per CLAUDE.md — stale assertion, not blocking); verify `SongsView.test.ts` existence |

### Sampling Rate
- **Per task commit:** targeted file run, e.g. `npx vitest run src/utils/__tests__/claudeApi.test.ts`
- **Per wave merge:** `npx vitest run --dir src --exclude '**/rules.test.ts'`
- **Phase gate:** Full suite green (against the documented 2-file known-failing baseline —
  `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts`'s stale assertion — before
  `/gsd-verify-work`. **`npm run type-check` (the `vue-tsc --build` form, not `-p tsconfig.app.json`)
  must also be run** per CLAUDE.md, since it is the only gate that typechecks test files.

### Wave 0 Gaps
- [ ] Verify whether `src/views/__tests__/SettingsView.test.ts` exists — grep found zero hits for this
      filename during research; if absent, this phase needs to create it (or the planner may choose
      component-test coverage for the two new toggles lives elsewhere, but SOME test must exist for the
      new AI/PC toggle save handlers per this codebase's `__tests__` convention).
- [ ] Verify whether `src/views/__tests__/serviceEditorActionBar.test.ts` exists — needed for the
      `buildExportOrCopyItem` `pcEnabled` extension's unit coverage.
- [ ] Verify whether `src/views/__tests__/SongsView.test.ts` exists — needed for the song-import
      button's hide-when-`pcEnabled`-false coverage.
- [ ] `src/types/__tests__/organization.test.ts` (or inline in `auth.test.ts`) — coverage for
      `DEFAULT_ORG_SETTINGS`'s shape if the planner wants a standalone assertion that every key has a
      default (optional; `auth.test.ts`'s merge-behavior tests may already cover this indirectly).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Unchanged by this phase — no auth flow touched |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | Existing `isOrgEditor(orgId)` Firestore rule already gates all writes to `organizations/{orgId}`, including the new nested `settings.*` dot-paths (no rule change needed — confirmed by the same reasoning `16.1-RESEARCH.md` applied to `vwModeEnabled`: no field-level restriction exists or is needed within an already-editor-gated document). UI additionally gates both new toggles behind `authStore.isEditor`, matching the existing `vwModeInput` pattern. |
| V5 Input Validation | No new surface | Both new settings are booleans (checkbox-bound), not free text — no injection vector introduced |
| V6 Cryptography | No | Not touched — PC credentials remain stored exactly as today (this phase adds no new encryption/decryption code path) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Elevation of Privilege via a missing/loosened Firestore rule on the new nested field | Elevation of Privilege | None needed — the existing document-level `isOrgEditor` rule already covers arbitrary field writes within `organizations/{orgId}`, confirmed by the identical precedent this codebase already established for `vwModeEnabled` (`16.1-02-PLAN.md`'s threat-model line: "Reuses the existing isOrgEditor Firestore rule ... no rule change, no new unauthenticated surface") |
| Concurrent-write clobbering of sibling settings keys (Pitfall 1 above) | Tampering (data integrity, not an attacker threat, but a correctness hazard with security-adjacent consequences if a security-relevant future setting were silently reverted) | Dot-path scoped `updateDoc` writes only — never whole-object `settings` overwrites |

## Sources

### Primary (HIGH confidence — file/line read during this research pass)
- `.planning/phases/39-org-settings-infrastructure-feature-toggles/39-CONTEXT.md` — locked decisions
- `.planning/phases/39-org-settings-infrastructure-feature-toggles/39-UI-SPEC.md` — UI contract, Hide-Don't-Disable table
- `.planning/REQUIREMENTS.md` — R073, R088, R089 exact text
- `.planning/research/ARCHITECTURE.md` §1 — org settings expansion recommendation
- `src/stores/auth.ts` (full file) — `loadOrgContext`, member-migration precedent, `vwModeEnabled` lifecycle
- `src/views/SettingsView.vue` (full file) — existing toggle pattern, PC credentials block
- `src/utils/claudeApi.ts` (full file) — all 7 exports, network-call sites
- `src/utils/planningCenterApi.ts` (partial, 1200+ lines) — `addSlotAsItem`, PC surface functions
- `src/views/serviceEditorActionBar.ts` (grep + targeted read) — `buildExportOrCopyItem` existing gate
- `src/utils/__tests__/claudeApi.test.ts` — existing SDK-mock test pattern
- `src/utils/appAuth.ts`, `src/firebase/index.ts` — import-cycle verification
- `package.json`, `tsconfig.app.json` — version/config verification

### Secondary (MEDIUM confidence)
- Exhaustive grep results for `vwModeEnabled` (14 non-test read/write sites), `claudeApi` imports (7
  files), `planningCenterApi` imports (9 files), `fetch` mocking patterns (10 files) — grep output
  inspected in full, not sampled.

### Tertiary (LOW confidence)
- None — this phase required no web/external research; all findings are codebase-internal.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every primitive already installed and verified
- Architecture: HIGH — every pattern traces to an existing, working analogue in this exact codebase
- Pitfalls: HIGH — derived from direct reading of Firestore dot-path write precedent already in
  production use (`services.ts` role overrides) and this codebase's own `noUncheckedIndexedAccess`
  config

**Research date:** 2026-08-06
**Valid until:** 30 days (stable, no fast-moving external dependency)
