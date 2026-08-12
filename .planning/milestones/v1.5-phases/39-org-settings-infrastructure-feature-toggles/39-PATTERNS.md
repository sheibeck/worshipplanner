# Phase 39: Org Settings Infrastructure & Feature Toggles - Pattern Map

**Mapped:** 2026-08-06
**Files analyzed:** 11 (3 create, 8 modify/extend)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/types/organization.ts` | model (type module) | CRUD (defaults shape) | `src/types/service.ts` | role-match (first `Organization` type; borrows type-module conventions) |
| `src/stores/auth.ts` (`loadOrgContext` + reset paths) | store | request-response (one-time `getDoc` merge) | itself — `vwModeEnabled` read/reset lines already in file | exact (extend in place) |
| `src/views/SettingsView.vue` (new AI section, PC toggle) | component | request-response (mirror-write) | itself — `onToggleVwMode` + its template block | exact (copy verbatim per UI-SPEC) |
| `src/utils/claudeApi.ts` (internal guard) | utility/service | request-response | itself — existing `try/catch → return null` convention on `getSongSuggestions` etc. | exact |
| `src/views/serviceEditorActionBar.ts` (`buildExportOrCopyItem`) | utility (pure builder) | transform | itself — existing `hasPcCredentials` gate | exact |
| `src/views/RosterView.vue` (hide PC import button) | component | request-response | `src/views/serviceEditorActionBar.ts`'s hide-pattern (conceptually); markup itself | role-match |
| `src/views/SongsView.vue` (hide PC import button) | component | request-response | same as above | role-match |
| `src/views/__tests__/SettingsView.test.ts` | test | — | `src/views/__tests__/RosterView.test.ts` (store-mock + `mount`) | role-match (closest full-mount view test with store mocks) |
| `src/views/__tests__/SongsView.test.ts` | test | — | `src/views/__tests__/RosterView.test.ts` | role-match |
| `src/stores/__tests__/auth.test.ts` (extend) | test | — | itself — existing `firebase/firestore` mock block | exact |
| `src/utils/__tests__/claudeApi.test.ts` (extend) | test | — | itself — existing `vi.hoisted` SDK mock | exact |
| `src/views/__tests__/serviceEditorActionBar.test.ts` (extend) | test | — | itself — existing `makeContext()` builder | exact |
| `src/components/__tests__/CongregationalEditor.test.ts` (extend) | test | — | itself (not read this pass — extend existing describe blocks per RESEARCH.md Pitfall 4 guidance) | exact |

## Pattern Assignments

### `src/types/organization.ts` (model, new file)

**Analog:** `src/types/service.ts`

**Type-module conventions to copy** (`src/types/service.ts:1-27`):
```typescript
import type { Timestamp } from 'firebase/firestore'
import type { VWType } from './song'

export type ServiceStatus = 'draft' | 'planned' | 'exported'

/**
 * Formalized service sections (D005). Exactly these five members — no others.
 * ...
 */
export type ServiceSection = 'pre-service' | 'worship' | 'message' | 'sending' | 'post-service'

export const SERVICE_SECTIONS: readonly ServiceSection[] = ['pre-service', ...]

export const SERVICE_SECTION_LABELS: Record<ServiceSection, string> = { ... }
```
**Copy:** the shape of "interface + a co-located exported `DEFAULT_*`/`*_LABELS` constant typed against
that interface," JSDoc above each exported type explaining *why* the shape is what it is (not just
what it is), and `readonly` on any array constant. **Change:** `Organization`/`OrgSettings` have no
`Timestamp` fields needed here (unless `createdAt` is desired — check CONTEXT.md's discretion note; not
required by this phase). Field naming: `aiEnabled` / `pcEnabled` / `vwModeEnabled`, camelCase booleans,
matching `vwModeEnabled`'s existing `<feature>Enabled` convention (RESEARCH.md Open Question 2).
`DEFAULT_ORG_SETTINGS` follows the `SERVICE_SECTION_LABELS`-style exported const:
```typescript
export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  aiEnabled: true,
  pcEnabled: true,
  vwModeEnabled: true,
}
```

---

### `src/stores/auth.ts::loadOrgContext` (store, modify)

**Analog:** itself — no external analog needed; extend the existing merge/reset lines.

**Current defaults-merge line to replace** (`src/stores/auth.ts:109`, confirmed):
```typescript
vwModeEnabled.value = (orgData.vwModeEnabled as boolean) ?? true
```
**New shape** (per CONTEXT.md-mandated exact form, RESEARCH.md "Code Examples"):
```typescript
const orgSettings = (orgData.settings as Partial<OrgSettings> | undefined) ?? {}
settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings }
vwModeEnabled.value =
  orgSettings.vwModeEnabled ??
  (orgData.vwModeEnabled as boolean | undefined) ??
  true
```
**Reset-path precedent — the no-org branch** (`src/stores/auth.ts:~90-96`, confirmed):
```typescript
if (ids.length === 0) {
  orgId.value = null
  orgName.value = null
  orgSlug.value = null
  userRole.value = null
  pcAppId.value = null
  pcSecret.value = null
  vwModeEnabled.value = true
  return
}
```
**Copy:** add `settings.value = { ...DEFAULT_ORG_SETTINGS }` as a new line in this same reset branch, and
in the two other reset sites RESEARCH.md's Focus Area 1 table lists (`auth.ts:152` sign-out branch,
`auth.ts:296` `logout()`), and in the `onAuthStateChanged` no-user branch. **Every place `vwModeEnabled.value = true` appears as a reset is a place `settings.value = { ...DEFAULT_ORG_SETTINGS }` must be added alongside it** — do not miss one (RESEARCH.md's 4-site enumeration is exhaustive).

**Declaration site to copy the shape of** (`src/stores/auth.ts:46`, confirmed):
```typescript
const pcSecret = ref<string | null>(null)
// Church-level Vertical Worship 1-2-3 methodology toggle (D-15). Default ON — ...
const vwModeEnabled = ref(true)
```
Add `const settings = ref<OrgSettings>({ ...DEFAULT_ORG_SETTINGS })` right beside it, with a JSDoc
comment following the same "why" style as `vwModeEnabled`'s.

**Lazy-backfill precedent — do NOT copy this shape for `vwModeEnabled`'s migration** (member `onSnapshot`
read-triggered backfill, `src/stores/auth.ts:124-134`, confirmed — included because RESEARCH.md flags it
as the file's only backfill precedent, then explains why it's the *wrong* one to reuse here):
```typescript
const patch: Record<string, unknown> = {}
if (role === 'admin') patch.role = 'editor'
if (!data.email && user.value?.email) {
  patch.email = user.value!.email ?? ''
  patch.displayName = user.value!.displayName ?? ''
}
if (Object.keys(patch).length > 0) {
  await updateDoc(snap.ref, patch)
  if (role === 'admin') return
}
```
**Copy the shape** (`patch` object + conditional `updateDoc`) **if** any future read-triggered backfill
is ever needed elsewhere. **For `vwModeEnabled` specifically, do not add a read-time backfill at all** —
per RESEARCH.md, the backfill is satisfied entirely by write site 1 below switching its write target to
the dot-path form; this is a write-triggered backfill, not a read-triggered one.

**Export the new ref at the store's return statement** — find the existing `return { ... vwModeEnabled, ... }` line and add `settings` alongside it.

---

### `src/views/SettingsView.vue` (component, modify)

**Analog:** itself — `onToggleVwMode` and its template block, to be copied twice (once for AI, once for PC) per 39-UI-SPEC.md verbatim.

**Save-handler pattern to copy** (`src/views/SettingsView.vue:~469-489`, confirmed):
```typescript
async function onToggleVwMode() {
  if (!authStore.orgId || !authStore.isEditor) return

  const newValue = vwModeInput.value
  vwSaveError.value = null

  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { vwModeEnabled: newValue })
    authStore.vwModeEnabled = newValue

    vwSavedFeedback.value = true
    setTimeout(() => {
      vwSavedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[SettingsView] save vwModeEnabled error:', err)
    vwSaveError.value = 'Failed to save. Please try again.'
    vwModeInput.value = !newValue
  }
}
```
**Copy exactly, changing only:**
1. The Firestore write — MUST become the dot-path form for both new toggles (this is the
   CONTEXT.md-mandated lazy backfill for VW, and the required concurrency-safe write for the two new
   settings per RESEARCH.md Pitfall 1):
   ```typescript
   await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.aiEnabled': newValue })
   authStore.settings.aiEnabled = newValue
   ```
   and likewise `{ 'settings.pcEnabled': newValue }` / `authStore.settings.pcEnabled = newValue`.
   **`onToggleVwMode` itself must also switch its write to `{ 'settings.vwModeEnabled': newValue }`**
   — this is the lazy backfill CONTEXT.md specifies; do not touch `authStore.vwModeEnabled = newValue`
   (the store ref assignment stays exactly as-is, only the Firestore write path changes).
2. The error message stays the byte-identical string `'Failed to save. Please try again.'` per
   39-UI-SPEC.md's Copywriting Contract (verbatim reuse across all three toggles).
3. Ref names: `aiEnabledInput`/`aiSavedFeedback`/`aiSaveError`, `pcEnabledInput`/`pcEnabledSavedFeedback`/`pcEnabledSaveError`, matching `vwModeInput`/`vwSavedFeedback`/`vwSaveError`'s naming.

**Markup to copy verbatim (exact source already given in 39-UI-SPEC.md § "Component Pattern — Toggle
Row" and § "Layout — Two New Surfaces")** — do not re-derive; 39-UI-SPEC.md's HTML blocks are the
copy-paste source, changing only `v-model`/`@change`/label text per toggle. The PC toggle's credentials
block gets `v-if="pcEnabledInput"` wrapped around the existing `<template v-if="authStore.hasPcCredentials && !editingPcCreds">` / `<template v-else>` pair — do not touch `onClearPcCredentials`
or credential state itself.

---

### `src/utils/claudeApi.ts` (utility, modify)

**Analog:** itself — the file's own `try { ... } catch (err) { console.error(...); return null }`
convention (CONVENTIONS.md "Error Handling"), extended with one new private guard.

**Existing convention to match** (CONVENTIONS.md, verbatim example already in this file per RESEARCH.md
Focus Area 2):
```typescript
try {
  const result = await someAsyncOperation()
  return result
} catch (err) {
  console.error('[moduleName] functionName failed:', err)
  return null
}
```
**New guard — insert as the first statement in exactly 3 exports** (`getSongSuggestions`,
`getScriptureSuggestions`, `splitCongregationalReading` — the only 3 that call
`getClient().messages.*`; the other 4 exports are pure and must NOT be gated per RESEARCH.md Pitfall 3):
```typescript
import { useAuthStore } from '@/stores/auth'

function isAiEnabled(): boolean {
  return useAuthStore().settings.aiEnabled
}

export async function getSongSuggestions(
  params: GetSongSuggestionsParams,
): Promise<AiSongSuggestion[] | null> {
  if (!isAiEnabled()) return null
  try {
    // ...unchanged existing body
  } catch (err) {
    console.error('[claudeApi] getSongSuggestions failed:', err)
    return null
  }
}
```
**Copy:** the "returns `null`, never throws" convention this file already lives by — the guard's
`return null` is indistinguishable from any other failure to callers, which is the correct behavior.
**Change:** nothing about the function bodies below the guard line. Import placement follows
CONVENTIONS.md's 4-tier import order (Vue → external → Firebase → `@/*` local) — `useAuthStore` is a
local `@/*` import, goes in the last group alongside this file's existing `@/types/*`/`@/utils/*` imports.

---

### `src/views/serviceEditorActionBar.ts::buildExportOrCopyItem` (utility, modify)

**Analog:** itself — the existing single-line gate.

**Existing gate to extend** (`src/views/serviceEditorActionBar.ts:86-87`, confirmed):
```typescript
function buildExportOrCopyItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.hasPcCredentials) return undefined
  return {
    key: 'export-pc',
    // ...unchanged
  }
}
```
**Change:** compose, don't replace:
```typescript
function buildExportOrCopyItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.hasPcCredentials || !ctx.pcEnabled) return undefined
  // ...unchanged
}
```
Add `pcEnabled: boolean` to the `ActionBarContext` interface (alongside `hasPcCredentials: boolean` at
the top of the file) and thread it from `ServiceEditorView.vue`'s context-build call site (line ~2075:
`hasPcCredentials: authStore.hasPcCredentials,` gets a sibling `pcEnabled: authStore.settings.pcEnabled,`).
**Copy:** the file's header-comment convention of citing exact line numbers for every gate this module
mirrors — extend the file's own top-of-file comment block to note the new `pcEnabled` composition, in
the same documentary style already used for the `hasPcCredentials`-only gate and the "Copy for PC button"
removal note.

---

### `src/views/RosterView.vue` / `src/views/SongsView.vue` (hide PC import affordances)

**Analog:** `buildExportOrCopyItem`'s composed-boolean gate (conceptually) — but these are plain
template `v-if`s, not builder functions, since there's no shared choke point for PC (RESEARCH.md Focus
Area 4: "no single choke point for PC the way `claudeApi.ts` is for AI").

**Pattern:** wrap each existing "Import from Planning Center" button occurrence in
`v-if="authStore.settings.pcEnabled"`. RosterView.vue has two occurrences (empty-state CTA at line ~20
and toolbar button at line ~77, both driving `importModalOpen.value = true` at line ~452 per
RESEARCH.md). SongsView.vue has one (`@click="importModalOpen = true"` at line ~43). **Copy:** the
existing button markup untouched — only add the `v-if`. **Do not** touch `authStore.pcAppId`/`pcSecret`
or any import-modal internals; hiding the trigger is sufficient (RESEARCH.md's non-scope note on
`pcSongImport.ts`).

---

### `src/views/__tests__/SettingsView.test.ts` / `src/views/__tests__/SongsView.test.ts` (new test files)

**Analog:** `src/views/__tests__/RosterView.test.ts` — the closest full-`mount()` view test with a
store-mock harness in this codebase.

**Store-mock + mount pattern to copy** (`src/views/__tests__/RosterView.test.ts:1-27`, confirmed):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RosterView from '../RosterView.vue'

const mockAddPerson = vi.fn(() => Promise.resolve('new-id'))
// ...other fn mocks

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ orgId: 'org-1' }),
}))

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockPeople,
    // ...
  }),
}))
```
**Copy:** the `vi.mock('@/stores/auth', ...)` shape, `mount(Component)`, and per-fn `vi.fn()` mocks.
**Change:** the auth-store mock must expose `settings: { pcEnabled: <toggle>, aiEnabled: <toggle> }` (or
a `get settings()` accessor if a test needs to flip mid-test — see the `SongTable.test.ts` getter-mock
precedent below) so `SettingsView.test.ts` can assert the AI/PC toggle save handlers write the correct
dot-path and mirror the store, and `SongsView.test.ts` can assert the import button is absent when
`pcEnabled` is `false`. For `SettingsView.test.ts` also mock `firebase/firestore`'s `updateDoc` the way
`src/stores/__tests__/auth.test.ts` does (see below) since the component calls it directly.

**Getter-mock precedent for a toggle-flip-mid-test** (`src/components/__tests__/SongTable.test.ts:39`,
cited in RESEARCH.md, not independently re-read this pass — trust RESEARCH.md's verified excerpt):
```typescript
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get vwModeEnabled() { return mockVwModeEnabled },
    // ... other fields the test needs
  }),
}))
```
**Copy:** this getter-mock shape for `settings` if a test needs the same mock object to reflect a
toggle change across multiple assertions without re-mounting.

---

### `src/stores/__tests__/auth.test.ts` (extend)

**Analog:** itself — the existing `firebase/firestore` mock block.

**Firestore mock to extend, not replace** (`src/stores/__tests__/auth.test.ts:31-49`, confirmed):
```typescript
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => false,
      data: () => null,
    }),
  ),
  onSnapshot: vi.fn(() => () => {}),
  updateDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-org-id' })),
  writeBatch: vi.fn(() => ({ ... })),
  serverTimestamp: vi.fn(() => new Date()),
}))
```
**Copy:** this mock verbatim (do not rewrite it) — new test cases override `getDoc`'s resolved value
per-test (e.g. `.mockResolvedValueOnce({ exists: () => true, data: () => ({ vwModeEnabled: false }) })`)
to exercise: (1) a pre-v1.5 doc with no `settings` key resolves `OrgSettings` fully from
`DEFAULT_ORG_SETTINGS`, (2) a flat `vwModeEnabled: false` doc (no `settings` key) still resolves to
`false`, not the new default `true` — the critical regression case CONTEXT.md flags, (3) a `settings`
object with only some keys present still resolves the missing ones to their defaults. Add these inside
new `describe` blocks; the existing `describe('vwModeEnabled (D-15/D-16)')` block (line ~295 per
RESEARCH.md) is the place for the dual-read regression case specifically.

---

### `src/utils/__tests__/claudeApi.test.ts` (extend)

**Analog:** itself — the existing `vi.hoisted` SDK mock.

**SDK mock to extend, not replace** (`src/utils/__tests__/claudeApi.test.ts:9-34`, confirmed via
RESEARCH.md's verified excerpt — do not re-derive):
```typescript
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
**Existing describe blocks to extend** (confirmed via grep): `getSongSuggestions` (line 208),
`getScriptureSuggestions` (line 298), `splitCongregationalReading` (line 664). **Add a new
`vi.mock('@/stores/auth', ...)`** exposing `settings: { aiEnabled: <toggle> }` (getter-mock shape, per
`SongTable.test.ts`'s precedent above), then inside each of the 3 existing describe blocks add one case:
call the export with `aiEnabled: false`, assert the return is `null` and
`expect(mockCreate).not.toHaveBeenCalled()` / `expect(mockParse).not.toHaveBeenCalled()`. **Do not**
touch the 4 pure-function describe blocks (`safeParseJsonArray`, `validateSongSuggestions`,
`validateScriptureSuggestions`, `validateSplitResult`, `SPLIT_SCHEMA`) — RESEARCH.md Pitfall 3.

---

### `src/views/__tests__/serviceEditorActionBar.test.ts` (extend)

**Analog:** itself — the existing `makeContext()` builder.

**Context builder to extend** (`src/views/__tests__/serviceEditorActionBar.test.ts:33-46`, confirmed):
```typescript
function makeContext(overrides: Partial<ActionBarContext> = {}): ActionBarContext {
  return {
    canEditService: true,
    hasSermonContext: true,
    aiSuggestingAll: false,
    hasPcCredentials: true,
    isExporting: false,
    serviceStatus: 'planned',
    isDirty: true,
    isSaving: false,
    canPresent: true,
    handlers: makeHandlers(),
    ...overrides,
  }
}
```
**Copy:** add `pcEnabled: true` to this default object (so every existing test keeps passing unchanged),
then add new test cases using `makeContext({ pcEnabled: false })` asserting `export-pc` is absent from
`keysOf('service-order', ctx)` even when `hasPcCredentials: true` — this is the data-level (not
DOM-level) assertion style this file already established for R068, matching CONTEXT.md's stated
preference to avoid the DOM-test-in-three-places anti-pattern this file's header comment documents.

## Shared Patterns

### Firestore dot-path scoped write (concurrency-safe partial update)
**Source:** `src/stores/services.ts:325-332` (`setRoleOverride`)
```typescript
await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), {
  [`roleAssignmentOverrides.${roleId}`]: personIds,
  updatedAt: serverTimestamp(),
})
```
**Apply to:** every settings-toggle save handler in `SettingsView.vue` (`onToggleVwMode`, the new
AI-toggle handler, the new PC-toggle handler). **The single hazard RESEARCH.md flags**: never write
`{ settings: {...wholeObject} }` — always the dot-path leaf form `{ 'settings.<key>': value }`, or a
concurrent editor's write to a sibling `settings.*` key is silently clobbered.

### Lazy read-time backfill (member `onSnapshot` migration)
**Source:** `src/stores/auth.ts:124-134`
```typescript
const patch: Record<string, unknown> = {}
if (role === 'admin') patch.role = 'editor'
if (!data.email && user.value?.email) {
  patch.email = user.value!.email ?? ''
  patch.displayName = user.value!.displayName ?? ''
}
if (Object.keys(patch).length > 0) {
  await updateDoc(snap.ref, patch)
  if (role === 'admin') return
}
```
**Apply to:** general precedent for any future read-triggered backfill in this file. **Do not apply to**
`vwModeEnabled`'s migration specifically — that one is write-triggered (satisfied by changing
`onToggleVwMode`'s write target to the dot-path form), per CONTEXT.md's explicit "never a bulk migration
script" instruction and RESEARCH.md's analysis of why the read-triggered shape doesn't fit a one-time
`getDoc` (vs. the member doc's live `onSnapshot`).

### Error-return convention (never throw from utils)
**Source:** CONVENTIONS.md "Error Handling", live in every `claudeApi.ts` export and
`SettingsView.vue`'s save handlers.
```typescript
try {
  const result = await someAsyncOperation()
  return result
} catch (err) {
  console.error('[moduleName] functionName failed:', err)
  return null
}
```
**Apply to:** the `claudeApi.ts` guard's `return null` (matches this convention exactly — indistinguishable
from any other failure to callers), and every new/modified save handler in `SettingsView.vue`.

## No Analog Found

None — every file in scope has a strong same-file or same-repo analog (this phase is flagged
standard-pattern/skip-research in the milestone SUMMARY.md; RESEARCH.md independently confirms zero new
architectural layers are needed).

## Metadata

**Analog search scope:** `src/types/`, `src/stores/`, `src/utils/`, `src/views/`, `src/views/__tests__/`,
`src/stores/__tests__/`, `src/utils/__tests__/`
**Files scanned:** `src/types/service.ts`, `src/stores/auth.ts`, `src/views/SettingsView.vue`,
`src/views/serviceEditorActionBar.ts`, `src/stores/services.ts`, `src/views/__tests__/RosterView.test.ts`,
`src/views/__tests__/serviceEditorActionBar.test.ts`, `src/stores/__tests__/auth.test.ts`,
`src/utils/__tests__/claudeApi.test.ts`, `src/views/__tests__/TeamView.test.ts` (ruled out — pure-helper
test style, not a mount-based analog)
**Pattern extraction date:** 2026-08-06
