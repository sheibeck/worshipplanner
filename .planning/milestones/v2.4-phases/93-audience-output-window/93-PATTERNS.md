# Phase 93: Audience Output Window - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 3 new (view, route entry, test)
**Analogs found:** 3 / 3 (Wake Lock has no in-repo analog — flagged)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/views/AudienceOutputView.vue` | view (route) | event-driven receive-only + in-window assembly | `src/views/ServiceEditorView.vue` (service load + assembly) + `src/components/PresentationViewer.vue` (fullscreen render) | composite (no single exact analog) |
| `src/router/index.ts` (route entry) | route/config | request-response | `/monitor-setup` + `/services/:id` entries in `src/router/index.ts` | exact |
| `src/views/__tests__/AudienceOutputView.test.ts` | test | — | `src/views/__tests__/ServiceEditorView.test.ts` (store/router/firebase mock harness) + `src/components/__tests__/PresentationViewer.test.ts` (fullscreen stub) | role-match |

**Key divergence to hold in mind:** `PresentationViewer.vue` is a *prop-driven child* (`slides: AssembledSlide[]`, `initialIndex`, internal `currentIndex` + nav chrome) teleported into an existing app context. `AudienceOutputView.vue` is a *standalone route* that must self-bootstrap: load the Service, run `useSlideshowAssembly` in-window, and derive `currentSlide` from the run-channel `index` (no local nav, no chrome). Learn the rendering/fullscreen idioms from PresentationViewer; do NOT copy its prop contract, its nav/chrome, or its `handleFullscreenChange → exitPresentation()` auto-teardown.

---

## Pattern Assignments

### `src/views/AudienceOutputView.vue` (view, event-driven + in-window assembly)

#### 1. HIGHEST-VALUE: How a single Service is loaded by id + orgId

There is **no single-doc `getService(id)` fetch used by a view.** The established pattern (from the only other service-scoped route, `ServiceEditorView.vue`) is: **subscribe to the whole org `services` collection, then select the one service by id from the store array into a local ref.**

**Store subscription API** — `src/stores/services.ts`:
- `subscribe(orgId)` — line 180; opens the single `onSnapshot` over `organizations/{orgId}/services` (line 192). Idempotent guard via `serviceStore.orgId`.
- `services` — the reactive array the snapshot fills.
- `unsubscribeAll()` — line 216. NOTE ServiceEditorView deliberately does NOT call this on unmount (line 2922 "Don't unsubscribe serviceStore here — DashboardView may still be using it"). The audience window is a standalone browsing context with no shared consumer, so it MAY unsubscribe on unmount.

**Store subscribe kickoff in the view** — `src/views/ServiceEditorView.vue` `initStores()`, lines 2839-2844:
```typescript
function initStores() {
  const orgId = authStore.orgId
  if (!orgId) return
  if (!serviceStore.orgId) {
    serviceStore.subscribe(orgId)
  }
  // ...songStore, roster (editor-only), etc.
}
// called from onMounted (line 2900) and an isEditor watch (line 2890)
```

**Selecting the one service by id into a local ref** — `src/views/ServiceEditorView.vue`, lines 2725-2751:
```typescript
watch(
  () => serviceStore.services,
  (services) => {
    const found = services.find((s) => s.id === serviceId.value)
    if (!found) return
    // ...isOwnWriteEcho guard...
    if (!localService.value) {
      const backfilled = backfillSlotIds(found)
      localService.value = JSON.parse(JSON.stringify(backfilled))
      // ...
    }
    // else: remote-merge branch (only relevant to the editor; audience is read-only)
  },
  { immediate: true, deep: true },
)
```
- `serviceId` computed from the route param — line 2487: `const serviceId = computed(() => route.params.id as string)`.
- `localService = ref<Service | null>(null)` — line 1830. This is the exact `Ref<Service | null>` shape `useSlideshowAssembly` wants.

**Audience-window simplification:** the editor's slot-id backfill + JSON round-trip + remote-merge branches exist to protect *editing*. A receive-only audience window only needs the initial-load branch: `localService.value = found` (or a shallow copy) once `services.find(id)` hits. No `backfillSlotIds`, no `originalService`, no dirty tracking.

**orgId source — divergence from analog:** ServiceEditorView reads org from `authStore.orgId` (line 2247: `const orgIdRef = computed(() => authStore.orgId)`). Per 93-CONTEXT, the audience route carries org in the `?org=` query so it self-bootstraps without relying on the opener's auth-store selection state. Read it via `route.query.org`. Establish the ref like:
```typescript
const orgIdRef = computed(() => (route.query.org as string | undefined) ?? authStore.orgId ?? null)
```
The store's `subscribe()` needs a concrete orgId string; gate the subscribe call on `orgIdRef.value` being non-null (mirror `initStores`'s `if (!orgId) return`).

#### 2. `useSlideshowAssembly(...)` call signature + return shape + real call site

**Signature** — `src/composables/useSlideshowAssembly.ts`, lines 153-157:
```typescript
export function useSlideshowAssembly(
  service: Ref<Service | null> | ComputedRef<Service | null>,
  orgId: Ref<string | null> | string,
  options?: UseSlideshowAssemblyOptions,
): UseSlideshowAssemblyReturn
```
- `options.canWrite` (lines 67-79) defaults to `false`. **The audience window is read-only — OMIT `canWrite` entirely** (or pass `false`). This disables the materialize/rebuild write watchers (`materializationCandidates`/`rebuildOutcomes` early-return `[]` when `!canWrite.value`, lines 450 & 633), so a viewer never attempts a Firestore write its rules would deny.

**Return shape** — `UseSlideshowAssemblyReturn`, lines 95-145. The audience window needs only:
- `assembledSlideshow: ComputedRef<AssembledSlide[]>` (line 96) — the in-window slide source. `slides[index]` = `currentSlide`.
- `isLoading: Ref<boolean>` (line 98) — drives the black/loading gate.
Ignore `groupsBySlotId`, `ensureGroupMaterialized`, `suppressMaterialization`, `drainGroupWrites` (all write/editor concerns).

**Real call site** — `src/views/ServiceEditorView.vue`, lines 2271-2278:
```typescript
const {
  assembledSlideshow,
  isLoading: slideshowLoading,
  // ...write helpers...
} = useSlideshowAssembly(localService, orgIdRef, { canWrite: canWriteSlideGroups })
```
Audience-window form (no writes):
```typescript
const { assembledSlideshow, isLoading } = useSlideshowAssembly(localService, orgIdRef)
```

**Important cleanup note:** the composable calls `pptxRendersStore.unsubscribeAll()` on scope dispose (line 758), a store-WIDE teardown safe only under the "single call site" assumption (WR-02, lines 57-65, 744-758). A standalone audience window is its own browsing context with no other consumer, so this is safe here.

#### 3. Rendering: compose `SlideCanvas` (the divergence from PresentationViewer)

**The one call site to mirror** — `src/components/PresentationViewer.vue`, lines 49-54:
```vue
<SlideCanvas
  v-else-if="currentSlide"
  ref="slideCanvasRef"
  :slide="currentSlide"
  interactive
/>
```
Audience form: `<SlideCanvas :slide="currentSlide" :interactive="false" />` — background ON (do NOT pass `suppressBackground`; that is Phase 94's confidence job). No `initialIndex`, no nav chrome, no exit button, no progress pill.

**Media play/pause invariant (T-23-08)** — if an index change needs the pause→(index write)→play sequence, drive it through the exposed `play()/pause()` exactly as PresentationViewer's `goToIndex`, lines 280-287:
```typescript
async function goToIndex(next: number) {
  if (next === currentIndex.value) return
  slideCanvasRef.value?.pause()
  currentIndex.value = next
  await nextTick()
  slideCanvasRef.value?.play()
}
```
For the audience window the "index write" is driven by the channel `onState` callback, not user nav. `slideCanvasRef = ref<InstanceType<typeof SlideCanvas> | null>(null)` — PresentationViewer line 201. First-slide `play()` after mount + font gate: PresentationViewer lines 450-451.

**Loading / empty gate (congregation-safe = plain black, no chrome):** PresentationViewer's loading/empty branches (lines 15-42) show spinners and copy — the audience window must instead render a **bare black surface** until slides + first `state` arrive (93-CONTEXT decisions). Reuse only the `v-if currentSlide` structure, not the chrome-bearing loading markup.

#### 4. Run channel subscription (receive-only) — `src/utils/runChannel.ts`

- Open: `openRunChannel(serviceId)` (line 108) → `{ postState, onState, postHello, onHello, close }` (handle interface lines 68-74).
- Audience uses **only** `onState` + `postHello` + `close`. It NEVER calls `postState` (control is the single writer — module header lines 1-5).
- `onState(cb)` — line 144; `cb` receives `RunState { index, blackout, seq }` (lines 26-30). Built-in stale-seq drop lives at line 133 (`if (data.seq <= highestDeliveredSeq) return`) — rely on it; do not reimplement sequencing.
- `postHello()` on mount — line 147; prompts control to re-send current state to a freshly-opened/reloaded output.
- `close()` on unmount — line 155.
- Read `blackout` from state but drive no UI this milestone (forward-compat).
- **Testability seam:** `openRunChannel(serviceId, factory?)` takes an injectable `BroadcastChannelFactory` (line 108, `BroadcastChannelLike` at lines 48-52) — tests inject an in-memory fake. The view should accept/allow injecting this factory (e.g. a prop or module seam) so the test can drive `onState` deterministically without a native BroadcastChannel.

#### 5. Fullscreen — learn the idiom, DELIBERATELY diverge from teardown

**Reuse the request/detect idiom** — `src/components/PresentationViewer.vue`:
- `requestFullscreen()` from a gesture, lines 376-386 (`enterPresentation`): `await viewerRoot.value?.requestFullscreen()` wrapped in try/catch, silent fallback on reject.
- `document.addEventListener('fullscreenchange', handleFullscreenChange)` on mount (line 412), removed on unmount (line 464).
- `document.fullscreenElement` null-check idiom, lines 388-395.

**DIVERGE (93-CONTEXT / PITFALLS 5 & 6):** PresentationViewer's `handleFullscreenChange` calls `exitPresentation()` (lines 388-395) — auto-teardown. The audience window must NOT tear down. On `document.fullscreenElement === null`, render a single calm **"Re-enter fullscreen"** affordance whose click calls `requestFullscreen()` from that in-window gesture (only a gesture in THIS window can re-enter). Losing fullscreen must never `close()` the channel or unmount.

#### 6. Screen Wake Lock — NO in-repo analog (see "No Analog Found")

#### 7. `cursor: none` — new; apply to the root fullscreen container (93-CONTEXT UI).

---

### `src/router/index.ts` — new route entry (route/config, request-response)

**Analog (exact):** the `/monitor-setup` entry, lines 78-86 — the precedent for a presentation-adjacent route that is `requiresAuth` ONLY (no `requiresEditor`), with a comment citing the same R267/R275 "any authenticated org member" rule:
```typescript
{
  // R267/R275 — deliberately requiresAuth ONLY, mirroring /services, NOT
  // /settings' requiresEditor: true. Any authenticated org member
  // (editor or viewer) may reach the monitor setup screen.
  path: '/monitor-setup',
  name: 'monitor-setup',
  component: () => import('../views/MonitorSetupView.vue'),
  meta: { requiresAuth: true },
},
```
**Param + lazy-import precedent:** `/services/:id`, lines 60-65 (dynamic `:id` param, `requiresAuth: true`).

**New entry to add** (place among the static authed routes, before the trailing public dynamic slug routes at lines 116-132 so it is not shadowed):
```typescript
{
  // R270/R271/R275 — the audience output window. requiresAuth ONLY (any
  // authenticated org member; presentation-only, no editor tier). Org via
  // ?org= query. Opened programmatically by Phase 95 and directly loadable.
  path: '/present/audience/:serviceId',
  name: 'audience-output',
  component: () => import('../views/AudienceOutputView.vue'),
  meta: { requiresAuth: true },
},
```
Guard behavior is automatic: `router.beforeEach` (lines 136-157) enforces `requiresAuth` + the org-selection gate. **Watch-out:** the org-selection gate (lines 147-156) redirects to `/select-church` when `authStore.requiresOrgSelection` — a directly-loaded audience window for a multi-church user could be bounced. The `?org=` query is what lets the view self-scope; confirm during planning whether the gate needs the org pre-resolved (may interact with Phase 95's window.open flow).

---

### `src/views/__tests__/AudienceOutputView.test.ts` (test)

**Primary harness analog** — `src/views/__tests__/ServiceEditorView.test.ts` (a view that mounts with router + Pinia + Firebase-touching stores):
- Mock `vue-router` with a reactive route so params/query can be driven — lines 41-46:
  ```typescript
  const mockRoute = reactive({ params: { id: 'service-1' } })
  vi.mock('vue-router', () => ({
    useRoute: () => mockRoute,
    useRouter: () => ({ push: vi.fn() }),
    RouterLink: { template: '<a><slot /></a>' },
  }))
  ```
  For the audience view, seed `params: { serviceId }` and `query: { org }`.
- Mock `@/firebase` to inert objects — lines 81-85: `vi.mock('@/firebase', () => ({ auth: {}, db: {}, functions: {} }))`.
- `vi.hoisted` for Firestore seam spies (getDoc/setDoc/onSnapshot) — lines 51-79. The services store's `subscribe()` uses `onSnapshot` (services.ts line 192); the test needs to mock `firebase/firestore` so the store can be driven (or mock the services store directly — see below).
- Pinia: `createPinia`/`setActivePinia` (imported line 4). `enableAutoUnmount(afterEach)` (line 33) to run the view's `onUnmounted` channel/lock cleanup.

**Store-stubbing option:** rather than driving the real services store through mocked Firestore, the cleaner path for this view is to mock the composable + store directly — mock `useSlideshowAssembly` to return a fixed `{ assembledSlideshow: ref([...]), isLoading: ref(false) }`, and stub the services store's `services`/`subscribe`. See `PresentationViewer.test.ts` for how the slide/assembly types are faked (`Service`, `AssembledSlide` type imports, lines 6-10).

**Fullscreen stubbing** — `src/components/__tests__/PresentationViewer.test.ts`, lines 317-325:
```typescript
beforeEach(() => {
  // jsdom does not implement the Fullscreen API at all — stub per test.
  Element.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('not supported'))
  document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(document, 'fullscreenElement', {
    value: null, configurable: true, writable: true,
  })
})
```
Fullscreen-change assertion pattern — lines 520-527 (dispatch `new Event('fullscreenchange')` after setting `fullscreenElement`). For the audience view assert the OPPOSITE of PresentationViewer: losing fullscreen renders the "Re-enter fullscreen" affordance and does NOT close the channel.

**Channel injection in tests:** pass an in-memory `BroadcastChannelFactory` (runChannel.ts `BroadcastChannelLike`, lines 48-52) so the test can post a `state` and assert `currentSlide` follows `index`, assert `postHello` fired on mount, and assert `postState` is NEVER called.

**Wake Lock mocking** (test the new code): install/delete `navigator.wakeLock` per test (mirror MonitorSetupView.test.ts's `window.getScreenDetails` install/delete idiom, lines 39-55 & 71-74). Present → assert `request('screen')` called on mount and re-called on a dispatched `visibilitychange`→visible; absent → no throw.

---

## Shared Patterns

### Route auth guard shape
**Source:** `src/router/index.ts` lines 5-11 (RouteMeta declaration) + `beforeEach` lines 136-205.
**Apply to:** the new route. `requiresAuth: true` only; the guard machinery is inherited, no new code.

### Route param + query reading convention
**Param:** `route.params.<name> as string` — `ServiceEditorView.vue` line 2487 (`route.params.id as string`).
**Query:** `route.query.<name> as string | undefined` — `QuarterShareView.vue` line 168 (`(route.query.name as string | undefined) ?? null`). No route currently reads `?org`; this view establishes that convention.

### Store subscribe-once idempotency guard
**Source:** `ServiceEditorView.vue` `initStores` lines 2842-2844 (`if (!serviceStore.orgId) serviceStore.subscribe(orgId)`).
**Apply to:** the audience view's service subscription.

---

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Screen Wake Lock (`navigator.wakeLock.request('screen')`, re-acquire on `visibilitychange`, feature-detect `'wakeLock' in navigator`, release on unmount) | view behavior | device-lifecycle | **Zero `navigator.wakeLock` usage anywhere in `src/`** (grep: only `requestFullscreen`/`fullscreenElement` exist, both in `PresentationViewer.vue`). This is genuinely new. Follow 93-CONTEXT R271 + `.planning/research/PITFALLS.md` "Screen Wake Lock" note directly, not an in-repo pattern. Test-mock idiom can borrow MonitorSetupView.test.ts's per-test `window.*` install/delete shape. |
| "Re-enter fullscreen" recovery affordance (non-teardown) | view behavior | user-gesture | The repo's only fullscreen-loss handler (`PresentationViewer.handleFullscreenChange`) does the OPPOSITE (auto-teardown, lines 388-395). No analog for the calm-recovery behavior — build per PITFALLS 5/6. |
| Bare-black congregation-safe loading/empty gate | template | — | `PresentationViewer`'s loading/empty states (lines 15-42) carry spinners + copy — unsuitable for a congregation-facing surface. Structure only, not markup. |

## Metadata

**Analog search scope:** `src/views/`, `src/components/`, `src/composables/`, `src/stores/`, `src/router/`, `src/utils/`, and their `__tests__/`.
**Files scanned (read in full or targeted):** `useSlideshowAssembly.ts`, `runChannel.ts`, `router/index.ts`, `PresentationViewer.vue`, `ServiceEditorView.vue` (targeted), `stores/services.ts` (targeted), `SlidesTab.vue` (targeted), `MonitorSetupView.test.ts`, `ServiceEditorView.test.ts` (head), `PresentationViewer.test.ts` (targeted), `router.test.ts` (head).
**Pattern extraction date:** 2026-08-28
