# Phase 97: Run Service Redesign - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 9 changed + ~7 new (components/composables) + 5 test suites
**Analogs found:** 14 / 16 (2 build-from-spec with no in-repo analog)

This map is decomposition-first: the load-bearing risk in Phase 97 is that
`RunControlView.vue` carries the entire Phase 92-96 correctness machinery
(single-writer channel, honest open state machine, WR-01 stale guard, closed-poll
+ screenschange reassign). The redesign MUST move only presentation into children
and keep that machinery in the parent (or a parent-owned composable). Everything
below cites concrete file:line seams.

---

## File Classification

| New/Changed File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/views/RunControlView.vue` (rewrite template, keep script core) | view/controller | event-driven / single-writer | itself (Phase 95/96) | exact — refactor in place |
| `src/composables/useRunControl.ts` (NEW, optional) | composable | event-driven | `src/composables/useOutputWindow.ts` | role-match |
| `src/composables/useRunTimers.ts` (NEW) | composable | event-driven (tick) | `useOutputWindow.ts` wake-lock lifecycle | partial |
| `src/components/run/RunPreflightPanel.vue` (NEW) | component | request-response (props) | `RunControlView` header cluster L20-182 | role-match |
| `src/components/run/RunHeader.vue` (NEW) | component | props/emits | `RunControlView` header L10-203 | exact |
| `src/components/run/RunRail.vue` (NEW) | component | props/emits | `RunControlView` rail L391-463 | exact |
| `src/components/run/RunPreviewPair.vue` (NEW) | component | props | `RunControlView` preview L466-511 | exact |
| `src/components/run/RunFilmstrip.vue` (NEW) | component | props/emits | preview stage + `SlideCanvas` thumbs | partial |
| `src/components/run/RunTransportBar.vue` (NEW) | component | props/emits | footer legend L515-534 | exact |
| `src/components/run/RunDisplaysPanel.vue` (NEW) | component | props/emits | recovery cluster L83-149 + banners L212-386 | role-match |
| `src/views/ConfidenceOutputView.vue` (flex 70/30 → left/right) | view | receive-only | itself (Phase 94) | exact — in place |
| `src/views/AudienceOutputView.vue` (+ blackout overlay) | view | receive-only | itself + Confidence overlay L66-94 | exact |
| `src/composables/useOutputWindow.ts` (+ self-fullscreen, expose blackout) | composable | receive-only | itself (Phase 94) | exact |
| `src/components/ServiceCard.vue` (+ Run button) | component | request-response | footer L41-58 + `ServiceEditorView` Run L101-113 | exact |
| `src/utils/runChannel.ts` | util | pub-sub | no change — already carries `blackout` | n/a |
| test suites (below) | test | — | existing harnesses | exact |

---

## The RunControlView decomposition (the core question)

### What MUST stay in the parent (or a parent-owned `useRunControl` composable) — do NOT push into children

These are the Phase 92-96 invariants. They are tested by mounting the REAL
`RunControlView.vue` and driving the REAL `openRunChannel` through an injected
`channelFactory` (`RunControlView.test.ts:37-47`, `.output.test.ts:37-42`). The
tests assert against `data-testid`s and channel posts, NOT internal component
boundaries — so any child extraction is safe ONLY if the parent keeps owning this
state and keeps rendering the same testids.

- **Single-writer channel** — `postIndex` (L622-626), `resendCurrent` (L629-633),
  the `seq` counter (L618) and `handle` (L619); `onHello(resendCurrent)` wired in
  `onMounted` (L1171). This is R266's whole contract. Keep in parent/composable.
- **Navigation model** — `goBySlide` (L689-694), `goByItem` (L696-711),
  `jumpToSlot` (L713-717). Children EMIT intent (`@jump="jumpToSlot"`,
  `@next`/`@prev`); the parent owns the post.
- **Honest open state machine** — `OutputStatus` type (L781), `outputStatus` ref
  (L782), `openOutputs` (L1071-1120), `openPlaced` (L1024-1039), `openUnplaced`
  (L1042-1052), `bothOpened` (L1011-1021), `openWindow` (L963-988). Keep whole.
- **WR-01 stale guard** — `goLiveRequestId` + `isUnmounted` (L951-952), the token
  bump in `openOutputs` (L1075), the `isUnmounted || requestId !== goLiveRequestId`
  drops (L1086, L1117), the `confirmExit` bump (L1143), `onUnmounted` set (L1185).
- **Phase 96 recovery** — `startClosedPoll` (L834-840), `onScreensChange`
  (L903-920), `stopRecoveryWatchers` (L930-943), `reopenOutput` (L855-869),
  `reopenReassignedOutputs` (L885-895), the `audienceClosed`/`confidenceClosed`/
  `monitorChanged` latches (L806-811), `liveScreenDetails` hold (L817), the
  `resolveScreen` helper (L991-995). Keep whole; `RunDisplaysPanel.vue` renders
  these as props and emits `@reopen`/`@reopen-reassigned`.
- **Exit** — `closeOutputs` (L1123-1131), `confirmExit` (L1140-1155), the ordering
  contract (stopRecoveryWatchers → closeOutputs → handle.close → router.push).
- **Keyboard handler** — `handleKeydown` (L734-762) registered on `document`
  (L1172, removed L1192). Stays parent-level (document listener, not a child's).
  Phase 97 adds `B` → blackout toggle at the reserved slot (L760 comment).
- **Rail derivations** — `rail` (L643), `firstIndexBySlot` (L644),
  `slideCountBySlot` (L647-653), `railRows` (L674-686), `currentSlotIndex` (L641).
  Compute in parent, pass `railRows` as a prop to `RunRail.vue`.

Recommendation: extract a **`useRunControl.ts` composable** that owns ALL of the
above (mirroring how `useOutputWindow.ts` owns the output lifecycle). The `.vue`
becomes template + child wiring only. This is the lowest-regression path because
the composable can be unit-covered by the SAME channelFactory injection the view
tests use, and the view template swap does not touch the invariants. If a
composable extraction feels too large in one plan, the fallback is: keep script
`<setup>` as-is and extract only the presentational children below.

### What moves into children (pure presentation, props-in / emits-out)

| Child | Props in | Emits | Source markup |
|---|---|---|---|
| `RunHeader.vue` | `serviceHeading`, `outputStatus`, live/green flag, closed/reassign flags, timer strings | `@go-live`, `@exit`, `@reopen` | L10-203 |
| `RunPreflightPanel.vue` (State A) | assigned monitors (from `loadMapping()`), readiness (`renderState`), `slideCount` | `@go-live`, `@rehearse` | NEW from spec, reuses card idiom of L66-149 |
| `RunRail.vue` | `railRows`, `activeIndex`, expand-active slide list | `@jump(index)` | L391-463 |
| `RunPreviewPair.vue` | `current`, `next` slides, `nextScale` | — | L466-511 (Next-up gets smaller scale, owner fix #2) |
| `RunFilmstrip.vue` | active-slot slides + array indices, `currentIndex` | `@jump(index)` | NEW; build from `assembledSlideshow` filtered by `currentSlotIndex` |
| `RunTransportBar.vue` | `progress`, `Y of M`, legend | `@next`, `@prev` | L515-534 |
| `RunDisplaysPanel.vue` (State C) | closed/reassign latches, `reassignRole`, ready labels, per-output thumbs | `@reopen(role)`, `@reopen-reassigned` | L83-149, L212-386 |

Auto-scroll of the active rail row (`captureActiveRow` L722-724 + `watch(index)`
L725-728) moves WITH `RunRail.vue` since it is presentation, but the `index` watch
source stays parent-owned; pass active-ness down and let the child scroll itself,
or keep the ref-capture in parent via a template ref forwarded to the child.

---

## Pattern Assignments (per changed/new file)

### `ConfidenceOutputView.vue` — 70/30 vertical → left/right (owner fix #1)

**Analog:** itself. The ONLY change is the two region wrappers' flex direction.

- Root is `class="fixed inset-0 bg-black flex flex-col"` (L13) → change to
  `flex-row` (or a two-column grid).
- CURRENT region `flex-[7_1_0%]` (L23) → e.g. `flex-[3_1_0%]` (left, dominant).
- NEXT region `flex-[3_1_0%]` (L43) + `border-t` seam → `flex-[2_1_0%]` and the
  seam becomes `border-l border-white/10` (left→ vertical seam).
- **Preserve black-suppression:** both `<SlideCanvas :suppressBackground="true">`
  (L28-30, L45-48) stay — this is the Phase 94 invariant (`SlideCanvas.vue:360`
  returns null background when `suppressBackground`).
- **Preserve last-slide no-reflow:** the NEXT region stays present with a FIXED
  flex basis when `nextSlide` is null (L34-40 comment, `v-if="nextSlide && fontReady"`
  on the canvas only, not the wrapper). Keep the wrapper unconditional so the
  current pane never resizes on the final advance.
- **Next-up smaller font (owner fix #2):** wrap the next `SlideCanvas` in a
  `transform: scale()` container; SlideCanvas has no font-size prop, so scale the
  rendered output down to fit the narrower right pane.

### `AudienceOutputView.vue` + blackout overlay

**Analog:** its own reenter-fullscreen overlay (L32-60) is the exact idiom for a
full-bleed absolute overlay. The blackout overlay is simpler:

```
<div v-if="blackout" class="absolute inset-0 bg-black" data-testid="audience-blackout" />
```
Placed as a sibling of `<SlideCanvas>` inside the fixed root (L7-24), above it in
paint order. **Approach: overlay in the output VIEW, not a SlideCanvas prop** —
keeps SlideCanvas unchanged and matches the confidence reenter overlay precedent.
Same overlay is added to `ConfidenceOutputView.vue`.

### `useOutputWindow.ts` — expose `blackout`, add self-fullscreen-on-load (owner fix #6)

**Analog:** itself.

- **Blackout wiring (consume side):** `blackout` ref ALREADY exists (L59) and is
  ALREADY written by `onState` (L136: `blackout.value = state.blackout`). It is
  currently commented "drives NO UI this milestone" (L59). Phase 97 just **adds
  `blackout` to the returned object** (L184) so the views can render the overlay.
  Zero protocol change.
- **Self-fullscreen on mount:** the granted window-management permission (Phase 92)
  means the output can resolve its own screen. Add to the `onMounted` (L130-167),
  AFTER `postHello()` (L138): read the assigned screen and call
  `rootRef.value?.requestFullscreen({ screen })`. The screen is resolvable via the
  saved mapping (`loadMapping()` + `resolveScreen` fingerprint match) keyed by the
  role — but the output window does not know its role from context, so **pass the
  role (or the screen fingerprint) as a query param** the control already builds in
  `audienceUrl()`/`confidenceUrl()` (`RunControlView.vue:1055-1060`) — add
  `&role=audience`. Then in the output, `loadMapping()` + `getScreenDetails()` +
  `resolveScreen(saved, role, screens)` gives the `{screen}` for
  `requestFullscreen`. Reuse the exact `handleReenterFullscreen` idiom (L97-104):
  requestFullscreen as the first statement, `.catch(()=>{})` swallow.
- **Fallback auto-attempt:** the existing manual affordance (Audience L32-60,
  Confidence L66-94) stays but should auto-fire once — call
  `handleReenterFullscreen()` once on mount if not fullscreen before rendering the
  button. `isFullscreen` (L88) already gates the button.
- **Note:** cross-monitor fullscreen is only provable on hardware → human-UAT
  (CONTEXT.md L126-129). Unit test asserts requestFullscreen is CALLED on mount
  when a screen resolves (mock), and does NOT throw when it does not.

### `RunControlView.vue` self-fullscreen cleanup

The cross-document attempt at **L980** (`win.document?.documentElement?.requestFullscreen?.({screen})`
inside `openWindow`) is the unreliable path CONTEXT.md L69 flags. Keep it as a
harmless best-effort (already `try/catch` silent, L976-985) OR remove reliance —
the OUTPUT self-fullscreen above supersedes it. Do NOT delete `openWindow`'s
`moveTo` placement (L971-975); only the fullscreen line is the weak part.

### Blackout wiring (control side)

**Wiring point:** `postIndex` (`RunControlView.vue:622-626`) and `resendCurrent`
(L629-633) currently HARD-CODE `blackout: false`. Introduce a parent
`blackout = ref(false)` and:
- `postIndex` / `resendCurrent` post `blackout: blackout.value` instead of `false`.
- Add `postBlackout(v: boolean)` that sets `blackout.value = v`, bumps `seq`, and
  posts the CURRENT `index` with the new blackout — mirror `resendCurrent`'s
  seq-advance-then-post shape (L629-633) so the stale-drop (`runChannel.ts:133`)
  accepts it.
- `B` key in `handleKeydown` (L760 reserved slot) → `postBlackout(!blackout.value)`.
- Black/Clear buttons in `RunDisplaysPanel.vue` (or the Output panel) emit
  `@blackout(true/false)` → `postBlackout`.
- Test asserts against the injected fake channel: pressing `B` / clicking Black
  posts `{blackout:true}`, Clear posts `{blackout:false}` (harness already captures
  posts — `.output.test.ts` drives the real channel).

### `ServiceCard.vue` — Run button (owner fix #3, R284)

**Analog:** the exact gating + button live in `ServiceEditorView.vue:101-113`
(`canRunService = isLocked && !!authStore.orgId`, `data-testid="run-service-btn"`,
the play-triangle SVG, `@click="onRun"`). Mirror verbatim into ServiceCard.

- **Row-actions location:** the action footer at `ServiceCard.vue:42-58` (Share +
  Print, `@click.stop` outside the router-link) — add the Run button here, first.
- **Lock check:** ServiceCard has no `isLocked` yet; it has `props.service.status`.
  Add `const isLocked = computed(() => props.service.status !== 'draft')` (mirrors
  `ServiceEditorView.vue:2113`) and `const canRun = computed(() => isLocked.value && !!authStore.orgId)`
  (`authStore` already imported L71, L80). Viewer-inclusive: gate on `canRun`, NOT
  `isEditor` (comment at ServiceEditorView L94-100).
- **Navigate:** `onRun` → `router.push('/run/' + props.service.id + '?org=' + authStore.orgId)`.
  `router` already available (L77). Must `@click.stop` since the card body is a
  router-link. Reuse the `onPrint` push shape (L244-248).

---

## Build-from-spec (no in-repo analog)

| Piece | Nearest idiom | Note |
|---|---|---|
| **Clock + Elapsed timer** (R281) | `useOutputWindow.ts` wake-lock lifecycle (L106-123) for the onMounted/onUnmounted + visibility idiom | NEW `useRunTimers.ts`: `setInterval` tick → `clock` (wall) + `elapsed` (now − goLiveAt). Clear on unmount (mirror `stopRecoveryWatchers` clearInterval discipline, `RunControlView.vue:931-933`). `elapsed` starts at go-live (`openOutputs` / rehearse entry). |
| **In-item filmstrip** (R282) | `firstAssembledIndexBySlot` (`serviceSlots.ts:46`) + the preview `SlideCanvas` (L482) | Filter `assembledSlideshow` by `currentSlotIndex` (L641); render each as a scaled `<SlideCanvas :interactive="false">` thumb; click emits the slide's ARRAY index → `postIndex`. No new util needed — the slotIndex is on every `AssembledSlide`. |
| **Pre-flight readiness panel** (R276) | monitor cards from `loadMapping()`/`resolveScreen` (`RunControlView.vue:863-864, 991-995`) | "All N slides rendered" reads each `AssembledSlide.renderState` (verify field name during plan) — an HONEST check, not the design's CCLI. Monitor cards show `loadMapping()` assignments; live screen names need `getScreenDetails()` (only inside a gesture) so pre-live shows the SAVED mapping name + "Not open" amber. |
| **Blackout overlay + `B` key** | Confidence reenter overlay (L66-94); reserved `B` (L760) | Covered above. |
| **Rehearse mode** (R283) | `openOutputs` (L1071) but WITHOUT `window.open` | Add `rehearse()` that sets the live UI state (a `live`/`rehearsing` ref) and posts slide 0 via `postIndex(0)` WITHOUT calling `openPlaced`/`openUnplaced`. No windows, no `getScreenDetails`. Live status green path must key off a `live` flag set by BOTH `openOutputs` success and `rehearse()`. Test asserts NO `window.open` after Rehearse. |
| **Output self-fullscreen** | `handleReenterFullscreen` (`useOutputWindow.ts:97-104`) | Covered above. |

Live-status green (R277) is NOT purely `outputStatus === 'placed'`: introduce a
`live` boolean set on go-live/rehearse; dots read amber "Not open" until `live`,
green after. Diverges from the design's red (owner fix #4).

---

## Shared Patterns

### Injectable channel factory (testability seam)
**Source:** `RunControlView.vue:605-607`, `useOutputWindow.ts:32-40`,
`AudienceOutputView.vue:77-79`. Every new child/composable that touches the channel
keeps the `channelFactory?` prop/option pass-through. Do NOT let a child open its
own channel — the parent stays single-writer.

### Never-throw window/storage access
**Source:** `readClosed` (L820-826), `openWindow` try/catch (L971-985),
`monitorConfig.ts:82-89` storage guard. All new hardware/permission calls
(requestFullscreen, getScreenDetails) follow the silent `.catch(()=>{})` idiom.

### Receive-only outputs never postState
**Source:** `useOutputWindow.ts:130-138` (onState/postHello only). Blackout is
still control-posted; outputs only READ `state.blackout`. Preserve.

### Nocturne Run-scoped palette
**Source:** `97-UI-SPEC.md:20-34`. Apply as local CSS custom properties on the Run
root(s) only; do NOT retheme the app. The current view uses `bg-gray-950` /
`bg-gray-900` / indigo (L8, L27); the redesign swaps to the blurple `#9184d9`
accent scoped to these surfaces.

---

## Test harness fit

| Suite | How the redesign stays green | New tests |
|---|---|---|
| `RunControlView.test.ts` (543L) | Mounts real view + injected `createFakeChannel` (L37-47); asserts posts + testids. Child extraction is invisible to it IF the parent keeps posting and testids persist. Update rail/preview testids only if renamed. | Rehearse posts slide 0 w/o window.open; `B` posts blackout; live status green after go-live/rehearse; filmstrip jump posts index; Next-up smaller-scale present. |
| `RunControlView.output.test.ts` (960L) | Drives real go-live via `run-go-live-btn` click, fakes `getScreenDetails`/`window.open`/`saveMapping` (L11-25). Go-live moves into State-A panel → update the trigger's location, keep the testid. Recovery/reassign/WR-01 blocks unchanged. | Blackout channel posts; self-fullscreen (in output suites). |
| `ConfidenceOutputView.test.ts` (723L) | Asserts both panes suppressed + last-slide no-reflow. Flex-direction change keeps testids `confidence-current-region` / `confidence-next-region`. | left/right layout assertion; blackout overlay renders when `state.blackout`. |
| `AudienceOutputView.test.ts` | receive-only + never-post. | blackout overlay; self-fullscreen requestFullscreen called on mount (mock screen), no-throw when unresolved. |
| `ServicesView.test.ts` / ServiceCard test | — | Run button appears on a locked (`status !== 'draft'`) row, viewer-inclusive, navigates to `/run/:id?org=`. |

Harness lineage note: all Run suites descend from `AudienceOutputView.test.ts`
(reactive vue-router mock, inert `@/firebase`, mocked stores + assembly, stubbed
`SlideCanvas`, `createFakeChannel`, `enableAutoUnmount`) — new component tests
should stub `SlideCanvas` the same way (`.output.test.ts:103-110`).

---

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `useRunTimers.ts` (clock/elapsed) | composable | No timer composable in repo; nearest idiom is wake-lock lifecycle in `useOutputWindow.ts`. |
| Pre-flight readiness "N slides rendered" check | logic | No honest render-state readiness check exists yet; drive from `AssembledSlide.renderState` (verify field). |

## Metadata

**Analog search scope:** `src/views`, `src/composables`, `src/components`,
`src/utils`, `src/views/__tests__`.
**Key line anchors:** channel core `RunControlView.vue:616-717`; open state machine
`:781-1052`; WR-01 `:945-1120`; recovery `:792-943`; cross-doc fullscreen `:980`;
confidence flex `ConfidenceOutputView.vue:23,43`; blackout ref
`useOutputWindow.ts:59,136,184`; Run button `ServiceEditorView.vue:101-113`;
ServiceCard footer `:42-58`; blackout field `runChannel.ts:26-30,133`.
**Pattern extraction date:** 2026-08-28
