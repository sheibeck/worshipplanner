# Phase 70: Admin Console UI & No-Reply Sender - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 8 (2 mandated + 1 view modify + up to 6 optional components/store, counted individually below)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/config/appConfigDefaults.ts` | config | transform (deep-merge) | `functions/src/appConfig.ts` (source of truth to mirror) | exact (cross-boundary duplicate, no client precedent exists) |
| `src/stores/appConfig.ts` | store | event-driven (onSnapshot) + CRUD (setDoc) | `src/stores/auth.ts` (onSnapshot lifecycle) + `src/views/OwnerConsoleView.vue`'s roster subscription | role-match |
| `src/views/OwnerConsoleView.vue` (MODIFY) | component (view) | request-response (form save) | `src/views/SettingsView.vue` (cards, save triad, toggle pattern) | exact (same file already partially this shape) |
| `src/components/admin/ConfigNumberField.vue` (optional, recommended) | component | request-response | `SettingsView.vue`'s inline numeric field + Save-button blocks (e.g. org-name field lines ~1-40, `onSave`) | role-match (no standalone reusable field component precedent exists yet — pattern extracted from inline repetition) |
| `src/components/admin/ConfigTextField.vue` (optional, recommended) | component | request-response | Same as above (text variant) | role-match |
| `src/components/admin/CleanupConfigCard.vue` / `AiProxyConfigCard.vue` / `MessagingConfigCard.vue` / `SenderConfigCard.vue` (optional, recommended) | component | CRUD | `SettingsView.vue`'s card sections (AI Features / Messaging / Bible Translation cards) | role-match |
| `src/views/__tests__/OwnerConsoleView.test.ts` (NEW — no existing file) | test | request-response | `src/views/__tests__/SettingsView.test.ts` (mount + vi.hoisted firebase mock + auth-store mock) | role-match |

## Pattern Assignments

### `src/config/appConfigDefaults.ts` (config, transform)

**Analog:** `functions/src/appConfig.ts`

**Source shape to mirror** (`functions/src/appConfig.ts:24-97`):
```typescript
export interface AppConfig {
  cleanup: {
    mediaEnabled: boolean;
    pptxRenderEnabled: boolean;
    backgroundEnabled: boolean;
    pptxSourceEnabled: boolean;
  };
  retention: {
    mediaDays: number;
    orphanRenderStaleHours: number;
    backgroundDays: number;
    pptxSourceDays: number;
  };
  deleteCapPerRun: number;
  aiProxy: {
    rateLimitPerMin: number;
    rateLimitPerDay: number;
    allowedModels: string[];
    maxTokensCeiling: number;
  };
  messaging: {
    scheduledCronEnabled: boolean;
    maxRecipients: number;
    orgDailyEmailQuota: number;
  };
  sender: { fromName: string; fromAddress: string };
  updatedBy?: string;
  updatedAt?: unknown;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  cleanup: { mediaEnabled: false, pptxRenderEnabled: false, backgroundEnabled: false, pptxSourceEnabled: false },
  retention: { mediaDays: 30, orphanRenderStaleHours: 24, backgroundDays: 30, pptxSourceDays: 30 },
  deleteCapPerRun: 500,
  aiProxy: {
    rateLimitPerMin: 20,
    rateLimitPerDay: 500,
    allowedModels: ["claude-haiku-4-5-20251001"],
    maxTokensCeiling: 2048,
  },
  messaging: { scheduledCronEnabled: false, maxRecipients: 200, orgDailyEmailQuota: 1000 },
  sender: { fromName: "", fromAddress: "onboarding@resend.dev" },
};
```

**Copy verbatim (this IS a deliberate cross-build-target duplicate, not a paraphrase).** `src/` (Vite) cannot
import `functions/` (Cloud Functions build) — confirmed no existing client module imports from `functions/`
anywhere in the codebase. Add a comment in `src/config/appConfigDefaults.ts` pointing back at
`functions/src/appConfig.ts:24-97`, and a matching comment in `functions/src/appConfig.ts` (if not already
present) pointing forward, so a future default-value change is caught by a human.

**mergeAppConfig — also mirror this from RESEARCH.md's Code Examples** (per-group merge, NOT a naive recursive
deep-merge, so a doc setting only `cleanup.mediaEnabled` never wipes sibling `cleanup.*` defaults):
```typescript
export function mergeAppConfig(raw: Partial<AppConfig> | undefined): AppConfig {
  const p = raw ?? {}
  return {
    cleanup: { ...DEFAULT_APP_CONFIG.cleanup, ...p.cleanup },
    retention: { ...DEFAULT_APP_CONFIG.retention, ...p.retention },
    deleteCapPerRun: p.deleteCapPerRun ?? DEFAULT_APP_CONFIG.deleteCapPerRun,
    aiProxy: { ...DEFAULT_APP_CONFIG.aiProxy, ...p.aiProxy },
    messaging: { ...DEFAULT_APP_CONFIG.messaging, ...p.messaging },
    sender: { ...DEFAULT_APP_CONFIG.sender, ...p.sender },
    ...(p.updatedBy ? { updatedBy: p.updatedBy } : {}),
    ...(p.updatedAt !== undefined ? { updatedAt: p.updatedAt } : {}),
  }
}
```

**No client analog exists for this file's role** — there is no other `src/config/*.ts` static-constant module
in the codebase today; `functions/src/appConfig.ts` is the only structural precedent (as source-of-truth, not
as a same-tier analog).

---

### `src/stores/appConfig.ts` (store, event-driven + CRUD)

**Analog 1 (onSnapshot lifecycle):** `src/stores/auth.ts` — general `onSnapshot`/`Unsubscribe` pattern (per
RESEARCH.md, lines 322-347 for the member-doc subscription shape).

**Analog 2 (subscribe/unsubscribe called from component lifecycle, not module scope):**
`src/views/OwnerConsoleView.vue:244-265` (roster subscription — read verbatim above):
```typescript
const superAdmins = ref<SuperAdminEntry[]>([])
const loaded = ref(false)
let superAdminsUnsub: Unsubscribe | null = null
// ...
onMounted(() => {
  superAdminsUnsub = onSnapshot(
    collection(db, 'superAdmins'),
    (snap) => {
      superAdmins.value = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<SuperAdminEntry, 'uid'>) }))
      loaded.value = true
    },
    (err) => {
      console.error('[OwnerConsoleView] roster subscription error:', err)
      loaded.value = true
    },
  )
})
onUnmounted(() => {
  superAdminsUnsub?.()
})
```
Adapt this exact shape into a Pinia `defineStore` setup-store with explicit `subscribe()`/`unsubscribe()`
actions (not side effects at module scope) — `OwnerConsoleView.vue`'s `onMounted`/`onUnmounted` then call
`appConfigStore.subscribe()` / `.unsubscribe()`, mirroring how the view already manages its own roster
subscription lifecycle, for consistency and testability (store stays mockable without a component mount).

**Write pattern — CRITICAL DEVIATION from every existing settings write in this codebase.** Every existing
dot-path write in `SettingsView.vue` targets `organizations/{orgId}` — guaranteed to exist since signup — and
therefore safely uses `updateDoc` (see excerpt below). `appConfig/global` has no such guarantee (R182: an
absent doc is valid). **Copy the `updateDoc` call SHAPE (dot-path leaf key, single field) but SWAP the function
to `setDoc(ref, patch, {merge:true})`.** The one existing `setDoc(...,{merge:true})` precedent in this codebase
is `src/stores/auth.ts`'s `ensureUserDocument` (per RESEARCH.md Pattern 3, cited at line 382) — use that as the
`setDoc` shape reference, and `SettingsView.vue`'s dot-path key naming as the field-path reference:

`SettingsView.vue:1013` (dot-path key naming to copy, but with `setDoc`+`merge:true` substituted for `updateDoc`):
```typescript
await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.vwModeEnabled': newValue })
```
becomes, for this phase's store:
```typescript
await setDoc(
  doc(db, 'appConfig', 'global'),
  { [path]: value, updatedBy: authStore.user?.email ?? 'unknown', updatedAt: serverTimestamp() },
  { merge: true },
)
```

**Full store skeleton** — copy directly from RESEARCH.md's "Pattern 1" code example (already vetted against
this exact codebase's conventions); do not re-derive.

---

### `src/views/OwnerConsoleView.vue` (MODIFY — component, request-response)

**Analog:** `src/views/SettingsView.vue` (cards, save triad, toggle-immediate-save pattern) — plus the file's
own existing roster section for structural conventions.

**Placeholder to replace** (`src/views/OwnerConsoleView.vue:105-110`):
```html
<!-- Platform configuration — placeholder section/slot for Phase 70's
     config-editor panels. Intentionally not built out here (68-04). -->
<div class="rounded-lg bg-gray-900 border border-gray-800 border-dashed p-4">
  <h2 class="text-sm font-semibold text-gray-500">Platform configuration</h2>
  <p class="text-xs text-gray-600 mt-1">Config-editor panels will appear here in a future release.</p>
</div>
```
Replace this exact block (UI-SPEC's Layout section reproduces the target markup contract in full).

**Reuse `isValidEmailFormat` verbatim** (`OwnerConsoleView.vue:161-164`, already in this same file — do not
reimplement a stricter check):
```typescript
function isValidEmailFormat(email: string): boolean {
  const e = email.trim()
  return e.includes('@') && e.includes('.')
}
```

**Explicit-Save numeric/text field triad — copy from `SettingsView.vue`'s org-name Save button**
(`SettingsView.vue:21-36`, template):
```html
@keydown.enter="onSave"
...
@click="onSave"
:disabled="isSaveDisabled"
...
{{ isSaving ? 'Saving...' : savedFeedback ? 'Saved!' : 'Save' }}
...
<p v-if="saveError" class="text-red-400 text-sm mt-2">{{ saveError }}</p>
```
and script (`SettingsView.vue:602-604`, `732-747`, `845-874`):
```typescript
const isSaving = ref(false)
const savedFeedback = ref(false)
const saveError = ref<string | null>(null)
// ...
const isSaveDisabled = computed(() => { /* dirty-check + validity */ })
// ...
async function onSave() {
  if (isSaveDisabled.value) return
  saveError.value = null
  isSaving.value = true
  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { name: trimmed })
    savedFeedback.value = true
    setTimeout(() => { savedFeedback.value = false }, 2000)
  } catch {
    saveError.value = 'Failed to save. Please try again.'
  } finally {
    isSaving.value = false
  }
}
```
Adapt with `store.saveField(path, value)` replacing the direct `updateDoc` call (store already wraps the
`setDoc(...,{merge:true})` mechanics — see above), and add the min/max/required validation block into
`isSaveDisabled`/`fieldError` per the UI-SPEC bounds table.

**Immediate-save toggle pattern — copy for `messaging.scheduledCronEnabled`** (the ONE editable boolean;
`SettingsView.vue:1033-1053`, `onToggleAiEnabled`):
```typescript
async function onToggleAiEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return
  const newValue = aiEnabledInput.value
  aiSaveError.value = null
  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.aiEnabled': newValue })
    authStore.settings.aiEnabled = newValue
    aiSavedFeedback.value = true
    setTimeout(() => { aiSavedFeedback.value = false }, 2000)
  } catch (err) {
    console.error('[SettingsView] save aiEnabled error:', err)
    aiSaveError.value = 'Failed to save. Please try again.'
    aiEnabledInput.value = !newValue   // revert on failure
  }
}
```
Same structure for `messaging.scheduledCronEnabled`, swapping the `updateDoc(...)` call for
`store.saveField('messaging.scheduledCronEnabled', newValue)`.

**Read-only cleanup toggles** — no analog needed (new pattern, fully specified in UI-SPEC's Component
Inventory § Cleanup card — a `disabled` checkbox, `opacity-60 cursor-not-allowed`, no handler).

**`onMounted`/`onUnmounted` store subscription** — copy the exact shape already at
`OwnerConsoleView.vue:244-265` (reproduced above under the store section) — call
`appConfigStore.subscribe()` / `appConfigStore.unsubscribe()` instead of a local `onSnapshot`.

---

### `src/components/admin/ConfigNumberField.vue` / `ConfigTextField.vue` (optional, recommended — component)

**Analog:** No standalone reusable field component exists yet anywhere in `src/components/`; every field in
`SettingsView.vue` is inline markup within the parent view. Extract the reusable shape FROM the inline pattern
above (label + `(default)` badge + input + Save button + status triad), parameterized via props
(`modelValue`, `label`, `min`, `max`, `required`, `defaultShown`, `error`, `saving`, `saved`, `saveError`,
`@save`). Treat `SettingsView.vue`'s org-name field block (`SettingsView.vue:1-40` template region +
`602-604`/`845-874` script) as the field-level source to factor out, not a component-level analog (none
exists).

---

### `src/components/admin/{CleanupConfigCard,AiProxyConfigCard,MessagingConfigCard,SenderConfigCard}.vue` (optional, recommended — component, CRUD)

**Analog:** `SettingsView.vue`'s existing per-area card sections (AI Features card, Messaging card, Bible
Translation card) — each is a `rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6` block with an `<h2
class="text-sm font-semibold text-gray-300 mb-3">` heading, an explanatory paragraph, then its fields. Exact
Tailwind class strings are specified in UI-SPEC's Layout section — copy those literally rather than
re-deriving from `SettingsView.vue`'s current classes (UI-SPEC is the locked, checker-approved contract).

---

### `src/views/__tests__/OwnerConsoleView.test.ts` (NEW — test, request-response)

**Analog:** `src/views/__tests__/SettingsView.test.ts` — mount + `vi.hoisted` firebase/firestore mock + `@/stores/auth` mock factory shape.

**File does not currently exist — must be created fresh, not extended** (confirmed via Glob: only
`SettingsView.test.ts` exists in `src/views/__tests__/`).

**firebase/firestore mock shape to copy** (`SettingsView.test.ts:28-60`):
```typescript
const { mockUpdateDoc, mockGetDoc } = vi.hoisted(() => {
  return {
    mockUpdateDoc: vi.fn((_ref: unknown, _data: Record<string, unknown>) => Promise.resolve()),
    mockGetDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => null })),
  }
})

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  setDoc: vi.fn(() => Promise.resolve()),
  getDoc: mockGetDoc,
  onSnapshot: vi.fn(() => () => {}),
  updateDoc: mockUpdateDoc,
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-org-id' })),
  writeBatch: vi.fn(() => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(() => Promise.resolve()) })),
  serverTimestamp: vi.fn(() => new Date()),
}))

vi.mock('@/firebase', () => ({ db: {} }))
```
For this phase, additionally hoist a `mockSetDoc` (this store's actual write call is `setDoc`, not
`updateDoc` — see the CRITICAL DEVIATION note above) so save-payload assertions can inspect the `merge:true`
option and the dot-path field key, mirroring how `mockUpdateDoc` is asserted elsewhere in this file's later
`describe` blocks (`SettingsView.test.ts:320` "dot-path writes" describe block is the pattern to copy for a
new "appConfig dot-path writes" describe block in the new file).

**Auth-store mock — MUST ADD fields not present in `SettingsView.test.ts`'s mock** (per RESEARCH.md Pitfall
5): `SettingsView.test.ts:130-150` establishes the getter-based mock shape —
```typescript
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get orgId() { return mockOrgId },
    get orgName() { return mockOrgName },
    get isEditor() { return mockIsEditor },
    // ...
  }),
}))
```
— copy this getter-per-field shape, but the new file's mock needs `isSuperAdmin` (boolean) and `user.email`
(string) at minimum, since `OwnerConsoleView.vue`'s existing roster code already reads `authStore.user?.uid`
and this phase's provenance stamp reads `authStore.user?.email` for the `saveField` write. Also mock the new
`@/stores/appConfig` store (its own `resolvedConfig`/`rawDoc`/`saveField` shape) OR mock `onSnapshot`/`setDoc`
directly via the same `firebase/firestore` `vi.mock` above, if testing the four cards standalone instead of
through the parent view (RESEARCH.md's Assumption A2 — a valid alternative decomposition).

**Mount + enableAutoUnmount pattern** (`SettingsView.test.ts:11-21`):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
enableAutoUnmount(afterEach)
```
Copy this import/setup block verbatim; it is the standard harness header for every view test in this codebase.

## Shared Patterns

### Explicit-Save / immediate-save status triad (`isSaving`/`savedFeedback`/`saveError`)
**Source:** `SettingsView.vue:602-604`, `845-874`, `1002-1026`
**Apply to:** Every editable number/text field (explicit Save) and the one editable toggle (immediate save) in
`OwnerConsoleView.vue`'s new config cards.
```typescript
const isSaving = ref(false)
const savedFeedback = ref(false)
const saveError = ref<string | null>(null)
// on failure: saveError.value = 'Failed to save. Please try again.'
// on success: savedFeedback.value = true; setTimeout(() => { savedFeedback.value = false }, 2000)
```

### `setDoc(ref, patch, {merge:true})` — NOT `updateDoc` — for every `appConfig/global` write
**Source:** `src/stores/auth.ts`'s `ensureUserDocument` (the one existing `setDoc(...,{merge:true})` call in
this codebase — cited by RESEARCH.md at line 382), contrasted with `SettingsView.vue`'s `updateDoc` convention
(every write there targets `organizations/{orgId}`, guaranteed to exist since signup).
**Apply to:** `src/stores/appConfig.ts`'s `saveField` action — the single most load-bearing implementation
fact in this phase (per both RESEARCH.md and UI-SPEC.md). Never copy `SettingsView.vue`'s `updateDoc(...)`
calls verbatim for this doc.

### `isValidEmailFormat`
**Source:** `src/views/OwnerConsoleView.vue:161-164` (already in the file being modified)
**Apply to:** Sender card's `fromAddress` field validation — reuse directly, do not add a stricter regex (UI-
SPEC resolved decision #5).

### `onSnapshot` subscribe/unsubscribe via component lifecycle
**Source:** `src/views/OwnerConsoleView.vue:244-265` (roster subscription)
**Apply to:** `src/stores/appConfig.ts`'s `subscribe()`/`unsubscribe()` actions, called from
`OwnerConsoleView.vue`'s own `onMounted`/`onUnmounted` (already imported in that file).

### Card shell markup
**Source:** UI-SPEC.md's Layout section (authoritative, checker-approved) — `rounded-lg bg-gray-900 border
border-gray-800 p-4 mt-6` cards with `text-sm font-semibold text-gray-300 mb-3` headings, matching
`SettingsView.vue`'s existing card sections structurally.
**Apply to:** All four new config cards + the deploy-time settings dashed-border note (reuses
`OwnerConsoleView.vue`'s own existing placeholder's dashed-border visual language, `border-dashed`).

## No Analog Found

None — every file in this phase has at least a role-match analog in the existing codebase. The one partial
gap is `ConfigNumberField.vue`/`ConfigTextField.vue`: no standalone reusable field COMPONENT precedent exists
(every existing field is inline in `SettingsView.vue`), so these two files are extracted-and-generalized from
inline patterns rather than copied from an existing component of the same shape. This is flagged, not blocking
— the underlying field-level logic (validation triad, save button, error line) has a strong analog; only the
"factor into a separate .vue file" packaging is novel to this codebase.

## Metadata

**Analog search scope:** `src/views/`, `src/views/__tests__/`, `src/stores/`, `functions/src/appConfig.ts`
**Files scanned:** `OwnerConsoleView.vue`, `SettingsView.vue`, `SettingsView.test.ts`, `functions/src/appConfig.ts`, `src/stores/auth.ts` (referenced via RESEARCH.md's already-cited line ranges)
**Pattern extraction date:** 2026-08-20
