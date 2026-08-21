# Phase 72: Owner Console Tabs - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 3 (1 modified view, 1 modified test file, optionally 2 new child components)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/views/OwnerConsoleView.vue` (modified — becomes tab shell) | view/controller | request-response (route-query driven UI state) | `src/views/ServiceEditorView.vue` (tab strip, lines 690-746) + `src/views/QuarterShareView.vue` (query persistence, lines 150-246) | exact (composite: two analogs, each exact for its concern) |
| `src/components/admin/ConfigurationTab.vue` (optional extraction, discretionary) | component (panel/tab child) | request-response | `src/components/admin/CleanupConfigCard.vue` et al. (sibling child components already composed into OwnerConsoleView) | role-match |
| `src/components/admin/OrganizationsTab.vue` (or inline placeholder pane, discretionary) | component | transform (static render, no data flow) | UI-SPEC's own placeholder spec (`72-UI-SPEC.md` "Component Spec: Organizations Placeholder Pane") — no live analog; closest structural sibling is the "Super-admins" card block in `OwnerConsoleView.vue:11` | role-match (spec-provided, no runtime analog) |
| `src/views/__tests__/OwnerConsoleView.test.ts` (modified — add tab coverage) | test | request-response | Same file (carry-forward harness) + `src/views/__tests__/QuarterShareView.test.ts` (vue-router mock pattern, lines 1-17) | exact |

## Pattern Assignments

### `src/views/OwnerConsoleView.vue` (view, becomes tab shell)

**Analog 1 — tab strip + conditional panes:** `src/views/ServiceEditorView.vue:690-748`

Container (mirror exactly, reduced to 2 static tabs, no `v-if` gating since both tabs are always visible behind the same super-admin gate):
```html
<div class="flex items-center gap-1 mb-3 border-b border-gray-800 pb-0">
  <button
    type="button"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'configuration'
      ? 'text-indigo-300 border-indigo-500 bg-gray-900'
      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="setTab('configuration')"
  >
    Configuration
  </button>
  <button
    type="button"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'organizations'
      ? 'text-indigo-300 border-indigo-500 bg-gray-900'
      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="setTab('organizations')"
  >
    Organizations
  </button>
</div>
```
Pane sibling pattern (`ServiceEditorView.vue:748`):
```html
<div v-show="activeTab === 'service-order'" data-testid="service-order-panel"> ... </div>
```
For Phase 72, use the same `v-show`/`v-if` sibling shape:
```html
<div v-show="activeTab === 'configuration'" data-testid="configuration-panel"> <!-- existing console body verbatim --> </div>
<div v-show="activeTab === 'organizations'" data-testid="organizations-panel"> <!-- placeholder --> </div>
```
No ARIA `role="tablist"`/`role="tab"` — `ServiceEditorView.vue`'s tab strip uses plain buttons with no ARIA tab roles; Phase 72 mirrors that precedent exactly (per UI-SPEC).

**Analog 2 — reading/writing a route query param reactively:** `src/views/QuarterShareView.vue:150-246` (with `src/views/SongsView.vue:359-399` as the second real-world instance of the same convention)

`QuarterShareView.vue:153-154, 163-164`:
```typescript
const route = useRoute()
const router = useRouter()
...
const initialView = (route.query.view as ViewMode | undefined) ?? (isDesktop.value ? 'matrix' : 'list')
const viewMode = ref<ViewMode>(initialView)
```
`QuarterShareView.vue:241-246` — the write-back convention, explicitly commented as mirroring `SongsView.vue`'s `router.replace({query})` convention:
```typescript
// ── URL persistence (D-16) ─────────────────────────────────────────────────
// Mirrors SongsView.vue's router.replace({query}) convention — spreads existing
// route.query and never pushes a history entry for view/filter changes.
watch([viewMode, nameFilter], ([view, name]) => {
  router.replace({ query: { ...route.query, view, name: name || undefined } })
})
```
`SongsView.vue:399` (the sibling instance, same shape, called directly rather than via `watch`):
```typescript
await router.replace({ query: { ...route.query, import: undefined } })
```

**Adaptation for Phase 72:** default-to-configuration + click-driven write (not a `watch`, since the trigger is `setTab()` on click, and initial hydration is on mount from `route.query.tab`):
```typescript
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

type OwnerConsoleTab = 'configuration' | 'organizations'

const activeTab = ref<OwnerConsoleTab>(
  route.query.tab === 'organizations' ? 'organizations' : 'configuration',
)

function setTab(tab: OwnerConsoleTab) {
  activeTab.value = tab
  router.replace({ query: { ...route.query, tab } })
}
```
This satisfies both directions from CONTEXT.md: URL→pane on load (read `route.query.tab` at init), pane→URL on click (`router.replace` inside `setTab`, not a `push`, consistent with the no-history-spam decision and both existing analogs).

**Preserve verbatim (no pattern change — this is the "byte-preserved" body):**
- The `superAdmins` `onSnapshot` subscription and lifecycle (`OwnerConsoleView.vue:298-324`, `onMounted`/`onUnmounted`).
- The `appConfigStore.subscribe()`/`unsubscribe()` calls, same `onMounted`/`onUnmounted` hooks — both subscriptions must remain **unconditional** in `onMounted`, not deferred behind `activeTab === 'configuration'`, per CONTEXT.md's explicit "do not lazy-defer" instruction. This is a divergence from a naive "only mount pane content when active" tab pattern — call out to the executor: subscriptions stay at the shell/`onMounted` level regardless of which pane is chosen for extraction.
- All grant/revoke handlers, `formatDate`/`formatStamp`, `friendlyCallableError`, the four config card imports/usages (`OwnerConsoleView.vue:141-152, 226-294`) — move under the Configuration pane's markup/scope unchanged.

### `src/components/admin/ConfigurationTab.vue` (optional extraction)

**Analog:** existing sibling child components already composed into `OwnerConsoleView.vue`, e.g. `src/components/admin/CleanupConfigCard.vue` — imported and rendered with no props (`<CleanupConfigCard />` at `OwnerConsoleView.vue:122`), each presumably reading/writing via `useAppConfigStore()` internally rather than via props/emits.

If extracted, `ConfigurationTab.vue` should follow the same **no-props, store-driven** shape only for the config-card portion; the roster portion currently owns local `ref` state (`superAdmins`, `grantEmail`, etc.) in the parent — CONTEXT.md permits either "extract into `ConfigurationTab.vue`" or "wrap inline under a `v-if` pane"; given the roster state and its onSnapshot subscription must stay live regardless of which pane is showing, **inline `v-if`/`v-show` pane (not extraction) is the lower-risk choice** unless the executor passes the roster state/subscription lifecycle down via props+emit or lifts the subscription to the shell and passes `superAdmins`/`loaded` as props into an extracted child. Either approach is acceptable per CONTEXT; no existing analog in this codebase currently does "shell owns subscription, child receives data via props" for a config-card-style component — the four config cards are the closest analog and they own their own store access internally, not via props.

### `src/components/admin/OrganizationsTab.vue` (or inline placeholder)

**No live analog exists in the codebase** for a purely static placeholder pane; UI-SPEC (`72-UI-SPEC.md` "Component Spec: Organizations Placeholder Pane") is authoritative:
```html
<div class="rounded-lg bg-gray-900 border border-gray-800 p-4">
  <h2 class="text-sm font-semibold text-gray-300 mb-2">Organizations</h2>
  <p class="text-sm text-gray-400">Organization management is coming in this milestone.</p>
</div>
```
Structurally this mirrors the existing "Super-admins" card shell in `OwnerConsoleView.vue:11` (`rounded-lg bg-gray-900 border border-gray-800 p-4` wrapper + `h2.text-sm.font-semibold.text-gray-300` heading) — same card idiom, no dynamic content.

---

### `src/views/__tests__/OwnerConsoleView.test.ts` (modified — carry forward + add tab coverage)

**Analog — existing mount harness (carry forward unchanged):** the file's own `vi.hoisted` firebase/firestore mock (lines 23-55), `@/stores/auth` mock (lines 70-75), `driveSnapshot`/`makeAppConfigSnap`/`makeRosterSnap` helpers (lines 77-89), and `mountViewSync`/`mountView` (lines 98-112). All pre-existing `describe`/`it` blocks (roster grant/revoke, four cards' presence, provenance stamp) should pass unmodified once the Configuration pane relocation is behavior-identical — they may need `data-testid="configuration-panel"` scoping added if assertions use `wrapper.find` against elements that now live inside the pane's `v-show` wrapper, but `v-show` (not `v-if`) keeps elements in the DOM regardless of active tab, so no test should need to switch tabs first unless it explicitly tests tab-gated visibility.

**Analog — vue-router mock for query-param tab tests:** `src/views/__tests__/QuarterShareView.test.ts:4-17`
```typescript
// Mock vue-router — mirrors ShareView.test.ts's harness, extended with a mutable
// query object (view/name persistence) and a spy-able router.replace.
const mockRouterReplace = vi.fn()
let mockRouteQuery: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: { token: 'test-token-123' },
    query: mockRouteQuery,
  })),
  useRouter: vi.fn(() => ({
    replace: mockRouterReplace,
  })),
}))
```
**Adaptation for Phase 72** — `OwnerConsoleView.vue` has no route `params` (no `:id` in `/owner-console`), so the mocked `useRoute()` only needs `query`:
```typescript
const mockRouterReplace = vi.fn()
let mockRouteQuery: Record<string, string> = {}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ query: mockRouteQuery })),
  useRouter: vi.fn(() => ({ replace: mockRouterReplace })),
}))
```
Reset `mockRouteQuery = {}` in `beforeEach` (mirroring the existing `mockOnSnapshot.mockClear()` reset block at lines 91-96) so each test starts from a clean/default query state. New test cases per CONTEXT.md's SC4:
- default tab = Configuration when `mockRouteQuery = {}`.
- tab switch via clicking the Organizations button asserts `mockRouterReplace` was called with `{ query: { tab: 'organizations' } }` (spread of empty `route.query`).
- deep-link: set `mockRouteQuery = { tab: 'organizations' }` before mount, assert the Organizations pane renders as active on load (no click needed).

## Shared Patterns

### Tab strip (UI + interaction)
**Source:** `src/views/ServiceEditorView.vue:690-746`
**Apply to:** `OwnerConsoleView.vue`'s new tab strip container and both tab buttons — copy the class recipe verbatim (`px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2`, active `text-indigo-300 border-indigo-500 bg-gray-900`, inactive `text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600`). No ARIA tab roles — plain buttons, per project precedent.

### Route-query-driven active state
**Source:** `src/views/QuarterShareView.vue:153-154,163-164,241-246`; sibling instance `src/views/SongsView.vue:359,399`
**Apply to:** `OwnerConsoleView.vue`'s `activeTab` ref (hydrate from `route.query.tab` at declaration) and `setTab()` (write via `router.replace({ query: { ...route.query, tab } })`, never `router.push`).

### Card shell idiom (for the Organizations placeholder)
**Source:** `src/views/OwnerConsoleView.vue:11` (existing "Super-admins" card wrapper) — also `72-UI-SPEC.md`'s "Component Spec: Organizations Placeholder Pane"
**Apply to:** the Organizations pane's placeholder markup — `rounded-lg bg-gray-900 border border-gray-800 p-4` wrapper, `h2.text-sm.font-semibold.text-gray-300.mb-2`/`mb-3` heading, `p.text-sm.text-gray-400` body.

### Subscription lifecycle (preserve, do not adapt)
**Source:** `src/views/OwnerConsoleView.vue:298-324` (`onMounted`/`onUnmounted`)
**Apply to:** must remain in the shell's top-level `onMounted`/`onUnmounted`, unconditional on `activeTab` — this is the one place where the "tab shell" restructure must NOT introduce a new pattern (e.g. lazy-mount-on-tab-select), because CONTEXT.md explicitly requires the roster/appConfig subscriptions active on load regardless of which tab is open.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/admin/OrganizationsTab.vue` (if extracted as a component rather than inline) | component | transform (static) | No existing purely-static placeholder component exists in the codebase to copy structural conventions from beyond the UI-SPEC's own literal markup and the "Super-admins" card shell it's modeled on. |

## Metadata

**Analog search scope:** `src/views/`, `src/views/__tests__/`, `src/components/admin/`, `src/router/`
**Files scanned:** `OwnerConsoleView.vue`, `OwnerConsoleView.test.ts`, `ServiceEditorView.vue` (lines 1-1118, tab strip section 690-748), `QuarterShareView.vue` (lines 150-249), `SongsView.vue` (grep hits 359-399), `QuarterShareView.test.ts` (lines 1-40), `router/index.ts`
**Pattern extraction date:** 2026-08-21
