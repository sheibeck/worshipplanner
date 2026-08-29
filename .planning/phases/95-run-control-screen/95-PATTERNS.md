# Phase 95: Run/Control Screen + Run Entry Point - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 5 (1 new view, 1 route add, 1 button add, 1 confirm dialog, ≥1 test)
**Analogs found:** 5 / 5 (window.open placement is build-from-spec)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/views/RunControlView.vue` (NEW) | view (operator control) | event-driven / pub-sub (single writer) | `src/views/AudienceOutputView.vue` + `src/composables/useOutputWindow.ts` | role-match (writer, not reader) |
| `src/router/index.ts` (route add) | route | request-response | `/present/audience/:serviceId` entry (`:95-99`) | exact |
| `src/views/ServiceEditorView.vue` (Run button) | view (button add) | request-response | status pill `:82-92` / lock banner `:308-331` | role-match |
| Escape-exit confirm dialog | component (inline) | request-response | reopen-confirm dialog `ServiceEditorView.vue:629-665` | exact |
| `src/views/__tests__/RunControlView.test.ts` (NEW) | test | — | `AudienceOutputView.test.ts` + `MonitorSetupView.test.ts` | exact |

---

## Pattern Assignments

### `src/views/RunControlView.vue` (view, single-writer + orchestrator)

**Analogs:** `useOutputWindow.ts` (service-load/assembly), `AudienceOutputView.vue` (view shell), `MonitorSetupView.vue` (placement), `PresentationViewer.vue` (keyboard).

#### Service-load + assembly self-bootstrap — RECOMMENDATION: extract a light helper, do NOT reuse `useOutputWindow`

The reusable service-load core is `useOutputWindow.ts:49-72`:
```typescript
const serviceId = computed(() => route.params.serviceId as string)
const orgIdRef = computed(() => (route.query.org as string | undefined) ?? authStore.orgId ?? null)

const localService = ref<Service | null>(null)
watch(() => serviceStore.services, (services) => {
  if (localService.value) return       // initial-load only
  const found = services.find((s) => s.id === serviceId.value)
  if (found) localService.value = found
}, { immediate: true })

const { assembledSlideshow } = useSlideshowAssembly(localService, orgIdRef)
```
plus the WR-02 org-mismatch subscribe gate in its `onMounted` (`:158-161`):
```typescript
const orgId = orgIdRef.value
if (orgId && serviceStore.orgId !== orgId) serviceStore.subscribe(orgId)
```

**Do NOT call `useOutputWindow` from the control screen.** That composable is welded to the
congregation-output lifecycle the control screen must NOT have: it `postHello()`s and is
**receive-only — it never `postState`s** (`:164-170`, and the doc comment "NEVER postState" at
`:10`), it acquires the Screen Wake Lock (`:123-140`), hides the cursor while fullscreen via
`rootStyle` (`:85-89`), owns fullscreen-loss recovery (`:101-121`), and — decisively — calls
`serviceStore.unsubscribeAll()` on unmount (`:213`) because it assumes it is the sole store consumer
in a standalone `window.open` popup. The control screen is a normal in-app SPA route whose store may
be shared; and it is the run channel's **single writer**, the exact inverse of `useOutputWindow`'s
receive-only channel role. Reusing it would be a semantic conflict, not just dead weight.

**Cleanest option:** extract the ~20 lines above (serviceId/orgId computeds + initial-load watch +
WR-02 subscribe gate + `useSlideshowAssembly` call) into a small shared composable, e.g.
`useServiceAssembly(options)`, and have BOTH `useOutputWindow` and `RunControlView` call it. If a
shared extraction is judged too invasive for this phase, inline the same 20-line idiom in
`RunControlView` (it is pure and self-contained). Either way, take the service-load+assembly slice
ONLY — none of the wake-lock/fullscreen/cursor/unsubscribeAll/postHello machinery.

#### Run channel — single writer, seq owned by the view

`src/utils/runChannel.ts`. The control view is the single `state` writer and also handles `hello`:
- `openRunChannel(serviceId.value, props.channelFactory)` (`runChannel.ts:108`; inject the factory as a
  test seam exactly as `AudienceOutputView.vue:77-87` forwards `channelFactory`).
- The **`seq` counter lives in the view** — the module posts verbatim and never generates one (module
  doc `:12-19`, `postState` `:139-142`). Keep `let seq = 0` (or a `ref`) in `setup()`; every
  navigation does `handle.postState({ index, blackout: false, seq: ++seq })`.
- `handle.onHello(() => handle.postState({ index: currentIndex, blackout: false, seq: ++seq }))` so a
  freshly (re)mounted output resyncs — the resend advances seq so the output's stale-drop
  (`runChannel.ts:133`) accepts it.
- `handle.close()` in `onUnmounted`.

#### Rail ordering + item→slide join (R262/R263)

`src/utils/serviceSlots.ts`:
- Rail list = `sortedSlotsWithIndex(localService.value)` (`:34-37`) → `IndexedServiceSlot[]`; each
  item's `.index` is the ORIGINAL `service.slots` array index.
- **Active-item highlight:** the item whose `.index === currentSlide.slotIndex`. The join key is
  `AssembledSlide.slotIndex` — confirmed: `serviceSlots.ts` module doc `:8-13` states the emitted
  `slotIndex` IS that original array index "the same number by construction", and
  `AudienceOutputView.test.ts:53` fixtures carry `slotIndex` on each assembled slide.
- **Click-to-jump:** `firstAssembledIndexBySlot(assembledSlideshow.value)` (`:46-54`) → `Map<slotIndex,
  firstArrayIndex>`. On item click, `const target = map.get(item.index); if (target === undefined)
  return /* empty slot: not clickable, no-op */; postState({ index: target, ... })`. Up/Down move to the
  prev/next item's first assembled index the same way.

`current = assembledSlideshow.value[index] ?? null`; `next = assembledSlideshow.value[index+1] ?? null`
(mirror `AudienceOutputView.vue:93-95`'s null-safe out-of-range guard). Render both through
`<SlideCanvas :interactive="false" />` (analog `AudienceOutputView.vue:19-24`), windowed/small.

#### Keyboard idiom (R265)

Mirror `PresentationViewer.vue` `handleKeydown` (`:353-372`): a single `switch (e.key)`,
`e.preventDefault()` on the consumed keys. Bindings for this phase: `ArrowRight`/`' '` → next slide;
`ArrowLeft` → prev slide; `ArrowDown` → next item's first slide; `ArrowUp` → prev item's first slide;
`Escape` → open the confirm dialog (NOT immediate teardown).
- Mount/unmount registration: PresentationViewer binds `@keydown` on its focused root
  (`PresentationViewer.vue:12`, `viewerRoot.value?.focus()` in onMounted `:410`). For a full-screen
  control surface, prefer `document.addEventListener('keydown', handleKeydown)` in `onMounted` +
  `removeEventListener` in `onUnmounted` (the canonical add/remove-on-mount/unmount pair).
- **Input/dialog guard:** when the Escape-confirm dialog is open, keys must not drive navigation — gate
  the switch behind `if (confirmOpen.value) return` (let only the dialog's own buttons handle it), and
  skip when an editable element is focused using PresentationViewer's `document.activeElement` idiom
  (`:337`): `const t = document.activeElement; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return`.

#### Monitor placement (mirror `MonitorSetupView.vue`)

The synchronous-gesture idiom is `MonitorSetupView.vue:414-434` (`onDetectClick`): the FIRST statement
after the plain `'getScreenDetails' in window` feature-detect is `getScreenDetails()` — **no await, no
store dispatch, no router call before it**, or user activation is lost (PITFALLS 1/5). The Run click
handler must follow the identical shape: feature-detect → `getScreenDetails()` synchronously → in the
`.then`, `matchMapping(loadMapping(), details.screens)` and branch. Reuse `monitorConfig.ts`
`loadMapping` (`:124`), `matchMapping` (`:149`, returns `{status:'matched'|'needs-reprompt'}`),
`computeFingerprint` (`:69`, recompute per live `ScreenDetailed` to resolve role→fingerprint→screen).
Guard all three states as first-class exactly as MonitorSetupView does (`matched`/`reprompt`/
`unavailable`+`denied` → `MonitorFallbackPanel`, `:14-22`). Use its `ScreenDetailsLike` typed shape
(`:177-181`) rather than `any` where practical.

---

### `src/router/index.ts` — `/run/:serviceId` (exact analog: `/present/audience`)

Copy the `/present/audience/:serviceId` block verbatim in shape (`router/index.ts:95-99`), changing
path/name/component:
```typescript
{
  path: '/run/:serviceId',
  name: 'run-control',
  component: () => import('../views/RunControlView.vue'),
  meta: { requiresAuth: true },   // R275 — requiresAuth ONLY, never requiresEditor
},
```
Place among the static authed routes before the trailing public dynamic-slug routes so it is never
shadowed (same comment rationale at `:93-94`). Org travels in `?org=` like the output routes.

---

### `src/views/ServiceEditorView.vue` — Run button placement

**Put the Run button next to the status pill header (`ServiceEditorView.vue:82-92`, the
`service-status-pill` span), NOT inside the lock banner.** The lock banner at `:308-331` is gated
`v-if="authStore.isEditor && isLocked"` (`:309`) — editor-only — and reusing that gate would violate
R275 (viewers must Run). The status pill renders for every member.

**Gate:** show when `isLocked` (`:2092`, `localService.status !== 'draft'`) AND the user is an
authenticated member — do **NOT** reuse `canEditService` (`:2094`, `authStore.isEditor && !isLocked`),
which is both editor-gated and inverted on lock. Introduce a membership/orgId-based predicate (any
authenticated member with the active org), mirroring the route's `requiresAuth`-only gate. Absent or
disabled on a draft.

**Button styling/handler:** mirror the existing `reopen-service-btn` button element
(`:323-331`) for classes/`type="button"`; handler = `router.push('/run/' + localService.id + '?org=' +
orgId)` (ordinary SPA nav). A services-list secondary placement is acceptable (Claude's discretion) but
the ServiceEditorView locked header is the primary home.

---

### Escape-exit confirm dialog (exact analog: reopen-confirm)

There is **no shared confirm-dialog component** in this repo — confirmations are either `window.confirm`
(`useUnsavedGuard.ts:38`, `SlideGrid.vue:723`) or an **inline `<Teleport to="body">` modal**. Copy the
reopen-confirm modal at `ServiceEditorView.vue:629-665`: `Teleport to="body"` → `v-if="confirmOpen"`
scrim `fixed inset-0 z-50 flex items-center justify-center bg-black/60` → gray-900 card with a Cancel
(`bg-gray-800`) and a confirm button (`bg-indigo-600`), each `data-testid`'d. This is the closest
existing confirm dialog; do not build a `window.confirm` here (a live service teardown deserves the
same deliberate two-button surface, and it is testable in jsdom).

---

### `src/views/__tests__/RunControlView.test.ts` (analog: `AudienceOutputView.test.ts`)

Mirror `AudienceOutputView.test.ts` harness lineage (documented at its `:17-22`):
- Reactive `vue-router` mock seeding `params.serviceId` + `query.org` (`:40-44`).
- Inert `@/firebase` (`:81`) and mocked `@/stores/auth` / `@/stores/services` / `useSlideshowAssembly`
  so the test is about THIS view (`:49-90`).
- `enableAutoUnmount(afterEach)` (`:33`) so `onUnmounted` channel-close fires.
- **Inject a fake channel** via the `channelFactory` prop (an in-memory `BroadcastChannelLike`,
  `:28`) and assert `postState` is called with a **strictly increasing seq** per navigation, and that
  `onHello` triggers a resend. This view is the WRITER, so assert `postState` (opposite of the audience
  test, which asserts it never posts).
- **Stub `window.open`** (jsdom returns `null`): `vi.spyOn(window, 'open').mockReturnValue(null)` and
  assert the call args/features + that a null return does not throw. Never actually open a window.
- **Stub `getScreenDetails`**: install/delete it per-test as `MonitorSetupView.test.ts` installs
  `navigator.*` capabilities; return a fake `{ screens, addEventListener, removeEventListener }`; assert
  matched → `window.open` + `requestFullscreen({screen})` per role, reprompt/unavailable → un-positioned
  pop-outs + monitor-setup link, no throw.

---

## Shared Patterns

### Single-writer run channel
**Source:** `src/utils/runChannel.ts` (`openRunChannel` `:108`, `postState` `:139`, `onHello` `:152`).
**Apply to:** RunControlView only. Caller owns `seq` (`:12-19`); increment per navigation and per `onHello` resend.

### Synchronous getScreenDetails-in-gesture (user activation)
**Source:** `MonitorSetupView.vue:414-434`. **Apply to:** the Run-click placement handler. No await before `getScreenDetails()`; keep `requestFullscreen({screen})` in the same synchronous gesture chain (PITFALLS 1/5).

### Read-only assembly self-bootstrap
**Source:** `useOutputWindow.ts:49-72` + WR-02 gate `:158-161`. **Apply to:** RunControlView service load (extract-or-inline, output-lifecycle parts excluded).

### Inline Teleport confirm modal
**Source:** `ServiceEditorView.vue:629-665`. **Apply to:** the Escape-exit confirm.

---

## Build-From-Spec (no in-repo analog)

| Piece | Reason |
|-------|--------|
| `window.open('/present/audience/'+id+'?org='+org, 'wp-audience', features)` (+ confidence) | **No `window.open` exists anywhere in `src/`** (grep found only `useOutputWindow.ts` doc-comment mentions and `window.confirm`). Build per ARCHITECTURE.md: plain `window.open`, **never `noopener`** (HTML spec copies opener `sessionStorage` to the child only without noopener — carries the picked org). Stable window names (`wp-audience`/`wp-confidence`) so re-open reuses the slot. |
| `moveTo(screen.left, screen.top)` + `requestFullscreen({ screen })` per window | No `moveTo` / `requestFullscreen({screen})` usage in repo (repo only uses argument-less `requestFullscreen()` at `useOutputWindow.ts:117`, `PresentationViewer.vue:378`). Multi-screen placement is the sanctioned one-gesture path (PITFALLS Pitfall 5); must originate from the operator's Run click. |
| Own `seq` counter in the view | The module deliberately does not own it (`runChannel.ts:12-19`); no existing writer exists yet — this view is the first `postState` caller in the codebase. |

## Metadata

**Analog search scope:** `src/views`, `src/composables`, `src/utils`, `src/components`, `src/router`.
**Pattern extraction date:** 2026-08-28
