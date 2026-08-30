# Phase 96: Live-Ops Hardening - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 2 (1 view hardened + its output test file) — NO new view/route
**Analogs found:** 2 / 2 (both in-repo, exact)

## Boundary reminder

This phase adds NO new file surface. Every behavior lands **inside** two existing files:
- `src/views/RunControlView.vue` (Phase 95) — the file being hardened.
- `src/views/__tests__/RunControlView.output.test.ts` (Phase 95 Plan 06) — the test file being extended.

The analogs to COPY FROM are already sitting in the same repo (`MonitorSetupView.vue` for the
`screenschange` idiom; `useOutputWindow.ts` for the output-side handshake), so this map is mostly
"where in RunControlView.vue do I graft, and which existing idiom do I mirror" rather than a
cross-file scaffold.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/views/RunControlView.vue` | view (control surface) | event-driven + polling | self (Phase 95) + `MonitorSetupView.vue` (screenschange) | exact (self-hardening) |
| `src/views/__tests__/RunControlView.output.test.ts` | test | — | self (existing suite) | exact |

---

## Pattern Assignments

### 1. Closed-output detection + one-click reopen

**Where Phase 95 stores the output `Window` handles**
`src/views/RunControlView.vue:655`
```ts
// Raw window handles (NOT reactive), keyed by stable window name.
const outputWindows: Record<string, Window | null> = {}
```
Keyed by the stable names `'wp-audience'` / `'wp-confidence'` (written at `openWindow`, line 680:
`outputWindows[name] = win`). This is the map the `.closed` poll reads.

**The open path to REUSE for reopen-one-output** (do not fork):
- `openWindow(url, name, screen)` — `src/views/RunControlView.vue:675-700` (the single `window.open`
  + `moveTo` + `requestFullscreen({ screen })` primitive; returns the real handle or null).
- `openPlaced(saved, screens)` — `:736-748` (matched path: resolve each role's screen, open both,
  gate on `bothOpened`, set `outputStatus='placed'`).
- `openUnplaced()` — `:751-758` (fallback path: open both un-positioned, `outputStatus='fallback'`).
- `resolveScreen(saved, role, screens)` — `:703-707` (role → saved fingerprint → live screen).
- `audienceUrl()` / `confidenceUrl()` — `:761-766` (URLs read CURRENT serviceId/org at open time).

**The honest state machine** (leave its transitions intact; a reopen must not fabricate a green
claim over a dark monitor):
`src/views/RunControlView.vue:646-647`
```ts
type OutputStatus = 'idle' | 'opening' | 'placed' | 'partial' | 'fallback' | 'blocked'
const outputStatus = ref<OutputStatus>('idle')
```
- `bothOpened(aWin, cWin)` gate — `:723-733` (both null → `blocked`; one null → `partial` naming
  `blockedRole`; both open → true). A per-output reopen affordance is a NARROWER version of this
  honesty: reopening one role must confirm its single handle is non-null before claiming it's back.

**The WR-01 stale-resolution guard** (any new async open path — e.g. reopen re-running
`getScreenDetails()` — MUST honor it):
`src/views/RunControlView.vue:663-664`
```ts
let goLiveRequestId = 0
let isUnmounted = false
```
Bumped at every `openOutputs()` entry (`:781 const requestId = ++goLiveRequestId`), checked before
opening inside the `.then` / `.catch` (`:792`, `:806`: `if (isUnmounted || requestId !== goLiveRequestId) return`),
bumped again on exit (`:832`) and set on unmount (`:868`). A reopen-one-output that awaits
`getScreenDetails()` for re-placement must take the same token + guard, or add a simpler
same-position reopen that reuses the LAST resolved screen set without a fresh async detect.

**`closeOutputs()`** (unchanged; the poll must not fight it):
`src/views/RunControlView.vue:812-820` — iterates `outputWindows` and `.close()`es each, swallowing
throws. Note it does NOT null the map entries, so after exit the handles remain `.closed === true`;
the poll must be CLEARED on exit (see cleanup below) so it never re-surfaces a reopen affordance for
a window the operator intentionally closed.

**New poll shape to add** (Claude's discretion on interval/UI): a single shared `setInterval`
(~1s) started when outputs first open (end of `openPlaced`/`openUnplaced`, or lazily) that reads
`outputWindows['wp-audience']?.closed` / `['wp-confidence']?.closed` into per-output reactive
`ref`s driving the reopen affordance. Prefer ONE interval over one-per-window (CONTEXT decision).
Store the id in a module-scope `let pollId: ReturnType<typeof setInterval> | null` and clear it in
the same two sites the existing teardown uses (see §4).

### 2. Monitor-unplug detection — mirror MonitorSetupView's `screenschange` idiom

**The idiom to mirror**, `src/views/MonitorSetupView.vue`:
- The precise ScreenDetails shape (copy this interface; do NOT use bare `Function`):
  `:177-181`
  ```ts
  interface ScreenDetailsLike {
    screens: ScreenLike[]
    addEventListener: (type: 'screenschange', listener: () => void) => void
    removeEventListener: (type: 'screenschange', listener: () => void) => void
  }
  ```
- The non-reactive held handle: `:206` `let screenDetailsRef: ScreenDetailsLike | null = null`.
- **Add listener** (attach, swapping off any prior handle first): `:365-369`
  ```ts
  if (screenDetailsRef && screenDetailsRef !== details) {
    screenDetailsRef.removeEventListener('screenschange', onScreensChange)
  }
  screenDetailsRef = details
  details.addEventListener('screenschange', onScreensChange)
  ```
- **The change handler** re-running match: `onScreensChange()` `:381-384` → `applyDetectedScreens`
  → `resolveGrantedBranch()` `:309-340`, which calls `matchMapping(saved, liveScreens.value)`
  (`:324`) and on `needs-reprompt` sets the first-class reprompt UI (`:332-338`).
- **Remove listener on unmount**: `:486-490`
  ```ts
  onUnmounted(() => {
    if (screenDetailsRef) {
      screenDetailsRef.removeEventListener('screenschange', onScreensChange)
    }
  })
  ```

**In RunControlView, the ScreenDetails object arrives at `openOutputs`'s `.then`**
(`src/views/RunControlView.vue:789 (details) => …`). Today it is used and discarded. Phase 96 must
HOLD it (a `let liveScreenDetails: ScreenDetailsLike | null`), attach `screenschange`, and on change
re-run `matchMapping(loadMapping(), liveScreenDetails.screens)`. On `needs-reprompt`, surface a
reassign affordance — mirror Phase 92's reprompt language (`MonitorSetupView.vue:75-83`) and reuse
the existing `<router-link to="/monitor-setup">` pattern already in the fallback banner
(`RunControlView.vue:163-165`).

**The reprompt banner language to mirror** (`MonitorSetupView.vue:75-83`): "Your monitor setup
changed / We found different displays than last time."

### 3. Reopen restores position — the existing handshake (verify, do not build)

Position preservation is ALREADY wired; Phase 96 asserts it rather than persisting an index.

- Control is the single writer + `seq` owner: `postIndex(target)` `:487-491`, `resendCurrent()`
  `:494-498` (both bump `seq` so runChannel's stale-drop accepts them).
- `onHello` wiring: `src/views/RunControlView.vue:854` `handle.onHello(resendCurrent)` (registered in
  `onMounted`). So a freshly (re)opened output posts `hello` → control resends CURRENT `index`.
- The output side that posts the hello on (re)mount: `src/composables/useOutputWindow.ts:138`
  `handle.postHello()` (inside its `onMounted`, after `handle.onState(...)` at `:134-137`).
- The stale-drop that guarantees no backward jump: `src/utils/runChannel.ts:133-135`
  (`if (data.seq <= highestDeliveredSeq) return`).

Because `index.value` is never touched by close/reopen, a reopened output re-syncs to the exact
current slide with zero external persistence. **Test assertion:** after a simulated close→reopen,
the last state posted on the fake channel has `index === ` the pre-close index.

### 4. Interval / listener cleanup — the existing single-teardown sites

The new poll interval AND the new `screenschange` listener must be cleared/removed in BOTH places
the existing teardown already runs, exactly once, no leak:

- **`confirmExit()`** — `src/views/RunControlView.vue:829-838` (the operator-exit path): already
  bumps `goLiveRequestId` (`:832`), calls `closeOutputs()` (`:835`), `handle?.close()` (`:836`),
  then `router.push`. Add `clearInterval(pollId)` + `liveScreenDetails?.removeEventListener(...)`
  here.
- **`onUnmounted()`** — `src/views/RunControlView.vue:865-871`: sets `isUnmounted = true`,
  `handle?.close()`, `document.removeEventListener('keydown', handleKeydown)`. Add the same
  `clearInterval` + `removeEventListener('screenschange', …)` here.

Guard both against double-clear (null the `pollId` / `liveScreenDetails` after clearing) since
`confirmExit` then unmounts — the same double-teardown ordering the existing `handle?.close()`
already tolerates.

### 5. Test harness — how to fake the new signals

The existing suite (`RunControlView.output.test.ts`) already provides every seam the new tests need:

- **Fake window handles** captured in `openedWins` via `makeFakeWin()` (`:144-152`) and
  `openSpy = vi.spyOn(window, 'open').mockImplementation(() => makeFakeWin())` (`:241`). To fake a
  **closed output**, add a `closed` field to `FakeWin` (default `false`) and flip it:
  `openedWins[0].closed = true` — then advance the poll. `window.open` returns the SAME captured
  objects the poll reads out of `outputWindows`, so mutating `openedWins[i].closed` is observed.
- **getScreenDetails** installed/deleted per test: `installGetScreenDetails(screens)` (`:155-159`)
  returns `Promise.resolve({ screens })`. For **unplug**, the returned `{ screens }` object needs
  `addEventListener`/`removeEventListener` spies (today the fake only has `screens`). Extend the fake
  ScreenDetails to a `{ screens, addEventListener, removeEventListener }` object that captures the
  `screenschange` listener, then **fire it**: call the captured listener after mutating the screen
  set (e.g. resolve a second `getScreenDetails` with `[screenA]` only, or have the listener re-read a
  mutable `screens` ref) so `matchMapping` returns `needs-reprompt`. Assert the reassign affordance
  appears; a still-matching change asserts NO false alarm.
- **Position-preserved assertion**: the fake channel's `posted[]` array (`createFakeChannel`,
  `:114-126`) records every `postState`. After close→reopen (a simulated `hello` — call the handle's
  hello callback, or drive `postHello` via the injected factory), assert the last `type:'state'`
  message's `index` equals the pre-close index.
- **Cleanup/no-leak assertions**: `enableAutoUnmount(afterEach)` (`:42`) already unmounts. Spy the
  ScreenDetails `removeEventListener` and assert it's called once on exit and once… — actually assert
  it is called on `wrapper.unmount()` and on the `run-exit-confirm` path (see the existing close-on-
  exit test at `:500-522` for the Escape→confirm driving idiom). For the interval, prefer real timers
  cleared correctly; assert no further `.closed` transition surfaces UI after unmount.

**Fake timers — needed?** YES for the `.closed` poll. jsdom does not advance `setInterval` on its
own within a synchronous test, so the poll tests should use `vi.useFakeTimers()` +
`vi.advanceTimersByTime(1000)` (with `vi.useRealTimers()` in `afterEach`). Note the suite currently
uses `flushPromises()` (real microtasks) and `Element.prototype.scrollIntoView` is stubbed (`:245`);
if fake timers are enabled globally they can interfere with `flushPromises` on the async
`getScreenDetails` path — scope `vi.useFakeTimers()` to the poll tests only, or use
`await vi.advanceTimersByTimeAsync(...)`. The `screenschange` tests need NO fake timers (the listener
is invoked directly).

---

## Shared Patterns

### Held-handle + monotonic-token + explicit-remove (applies to poll AND screenschange)
**Source:** `MonitorSetupView.vue:206-214, 365-384, 486-490` and `RunControlView.vue:663-664, 792, 806`.
Both new subscriptions follow the same three-part shape already proven in-repo: a non-reactive
module-scope handle, a stale-guard (reuse `isUnmounted`/`goLiveRequestId`), and removal in the two
existing teardown sites.

### Never-throw, best-effort browser calls
**Source:** `RunControlView.vue:682-698, 812-820`. Every `.closed` read / `.close()` / reopen must be
wrapped so a cross-origin or already-closed handle can't propagate — mirror the existing try/catch
swallow style. A `handle.closed` read on a cross-origin popup can throw; guard it.

### Reprompt language reuse
**Source:** `MonitorSetupView.vue:75-83` (amber "Your monitor setup changed") + the existing
`<router-link to="/monitor-setup">` at `RunControlView.vue:163`.

## No Analog Found

None. Every new behavior maps to an existing in-repo idiom.

## Client-only confirmation (ROADMAP success criterion 4)

**CONFIRMED: no Firestore write/read is implicated by R273/R274.** Verified by tracing every data
dependency the new code touches:
- Output handles: in-memory `outputWindows` map (`RunControlView.vue:655`) — no persistence.
- Sync: `BroadcastChannel` only (`runChannel.ts`) — explicitly "free of Vue/Firebase/Pinia imports"
  (`runChannel.ts:4`); its sole runtime dep is the BroadcastChannel primitive.
- Monitor mapping: `localStorage` only (`monitorConfig.ts:59`, `MONITOR_CONFIG_STORAGE_KEY`) —
  the module doc explicitly says "Persisted to `localStorage`, NOT Firestore" (`monitorConfig.ts:6`)
  and "never calls the Window Management API itself" (`monitorConfig.ts:17`).
- Position preservation is pure channel handshake (`onHello`→`resendCurrent`), no store.

**Nothing tempts a Firestore change.** The one place to stay disciplined: the unplug-reassign
affordance must reuse `loadMapping()`/`matchMapping()` (localStorage + pure) and link to
`/monitor-setup` — it must NOT introduce any server-side "remembered monitor" record. If a plan ever
proposes persisting the current index or a monitor state server-side, that is the anti-pattern to
reject (ARCHITECTURE Anti-Pattern 3, cited in `monitorConfig.ts:6`). No `firestore.rules` change is
needed; `npm run test:rules` is therefore NOT required for this phase.

## Metadata

**Analog search scope:** `src/views/RunControlView.vue`, `src/views/MonitorSetupView.vue`,
`src/composables/useOutputWindow.ts`, `src/utils/runChannel.ts`, `src/utils/monitorConfig.ts`,
`src/views/__tests__/RunControlView.output.test.ts`.
**Files scanned:** 6
**Pattern extraction date:** 2026-08-28
