---
phase: 93-audience-output-window
reviewed: 2026-08-28T00:00:00Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - src/views/AudienceOutputView.vue
  - src/router/index.ts
  - src/views/__tests__/AudienceOutputView.test.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 93: Code Review Report

**Reviewed:** 2026-08-28
**Depth:** deep
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed `AudienceOutputView.vue` (the new chromeless receive-only fullscreen audience output), the
single new `/present/audience/:serviceId` route entry in `src/router/index.ts`, and the 13-test
`AudienceOutputView.test.ts`, against the 93-01/93-02 plans, the 93-UI-SPEC contract, 93-CONTEXT
scope, PITFALLS (Pitfalls 5/6 + the Wake-Lock re-acquire note), and R270/R271.

**Every one of the six highest-risk correctness contracts the phase calls out checks out in the
actual source, not just the tests:**

1. **No auto-teardown on fullscreen loss (Pitfall 6) — CLEAN.** `handleFullscreenChange`
   (`AudienceOutputView.vue:170-172`) has exactly one statement:
   `isFullscreen.value = !!document.fullscreenElement`. It reaches no exit/close/unmount/teardown
   path. `grep` for `postState|exitPresentation|router.push|unmount` in the view returns only the
   two doc-comment mentions that describe the divergence. This is the single most dangerous
   copy-paste from `PresentationViewer.vue` (whose `handleFullscreenChange` calls
   `exitPresentation()`), and it was correctly diverged.
2. **Receive-only channel — CLEAN.** The view calls `openRunChannel(...).onState(...)`,
   `postHello()`, and `close()` only (`:212-217`, `:255`). No `postState` anywhere. Control stays
   the single writer.
3. **Cursor toggle — CLEAN.** `rootStyle` binds `cursor: isFullscreen.value ? 'none' : 'auto'`
   (`:148`), so the cursor is hidden while fullscreen and restored windowed, keeping the re-enter
   affordance clickable.
4. **Wake Lock lifecycle — CLEAN.** Feature-detected (`'wakeLock' in navigator`, `:187`), acquired
   on mount (`:221`), re-acquired on `visibilitychange`→visible (`:195-200`, `:220`), released and
   nulled on unmount (`:258-263`), every call try/caught — no unhandled rejection.
5. **Self-bootstrap — CLEAN with caveats.** Service load via `serviceStore.subscribe` +
   `watch(services).find(id)` initial-load-only branch (`:99-113`), `useSlideshowAssembly` with
   `canWrite` omitted (read-only), `blackout` held but drives no UI. The `?? authStore.orgId`
   fallback is sound (no privilege escalation — Firestore rules still gate the read), see IN-01.
   The media `pause→nextTick→play` watcher (`:133-137`) mirrors `PresentationViewer.goToIndex`
   correctly (default pre-flush watcher pauses the outgoing slide before the canvas re-renders).
6. **Chrome absence — CLEAN.** No exit button, nav chevrons, progress pill, slide count, or org
   label. The re-enter affordance is the only interactive element and only renders when
   `!isFullscreen`. Loading/empty is a pure-black root with zero elements (`v-if="currentSlide &&
   fontReady"`).

The T-93-01 tampering boundary is also correctly closed: a null, out-of-range, negative, or
non-integer channel index all resolve to `assembledSlideshow.value[index] ?? null` → pure black,
never a crash.

Two warnings and five info items were found. None is a blocker; none touches the no-teardown /
receive-only / chrome-absence contracts that R270/R271 hinge on. The warnings are (a) a missing
automated assertion on the highlighted media pause→play race, and (b) a latent cross-org desync in
the `!serviceStore.orgId` subscribe gate that only manifests on same-tab navigation (not the
intended standalone-window path).

## Warnings

### WR-01: The T-23-08 media pause→nextTick→play invariant has zero automated coverage — ✅ RESOLVED

> **Resolved 2026-08-28.** The `SlideCanvasStub`'s bare no-op `play`/`pause` are now shared `vi.fn()`
> spies (hoisted as `slideCanvasSpies`, exposed via the stub's `expose(...)` exactly as the real
> SlideCanvas exposes them), cleared per-test in `beforeEach`. A new test
> ("pauses the outgoing slide before playing the incoming on a slide change") pushes two successive
> states and asserts `pause` and `play` both fire and that
> `pause.invocationCallOrder[0] < play.invocationCallOrder[last]` — locking down the pause → nextTick →
> play ordering so a dropped `await nextTick()` or a reorder fails loudly. A second new test
> ("releases the acquired wake-lock sentinel on unmount") asserts the acquired sentinel's `release()`
> is called on unmount, closing the previously-unasserted R271 released-on-unmount contract. All prior
> tests stay green (13 → 18).

**File:** `src/views/AudienceOutputView.vue:133-137`; `src/views/__tests__/AudienceOutputView.test.ts:113-121`
**Issue:** The prompt flags the `watch(index)` media watcher as one of the phase's top race
concerns, and the implementation is correct (default pre-flush watcher → `pause()` on the outgoing
slide → `await nextTick()` → `play()` on the incoming). But the test suite cannot catch a
regression to it: the `SlideCanvasStub` exposes `play`/`pause` as bare inline no-op arrows
(`expose({ play: () => {}, pause: () => {} })`), not `vi.fn()`s, and no test asserts that an index
change calls `pause()` before `play()`, or that `play()` runs after the DOM has swapped to the new
slide. A future edit that drops the `await nextTick()` (playing the outgoing slide's media, or
playing before the canvas mounts), or that reorders pause/play, would leave all 13 tests green. On a
congregation-facing projector this is exactly the class of defect (audio/video from the wrong slide,
or a black media frame) that must not regress silently.
**Fix:** Make the stub expose `vi.fn()` handles and add a test that pushes two successive states and
asserts ordering, e.g.:
```ts
const play = vi.fn(); const pause = vi.fn()
// in the stub: expose({ play, pause })
// in the test, after emitState(0,1) then emitState(1,2):
expect(pause).toHaveBeenCalled()
expect(play).toHaveBeenCalled()
expect(pause.mock.invocationCallOrder[0]).toBeLessThan(play.mock.invocationCallOrder.at(-1)!)
```
While there, also assert `sentinel.release` is called on unmount to lock down the R271
"released on unmount" contract, which is currently unasserted.

### WR-02: The `!serviceStore.orgId` subscribe gate assumes a fresh store — a same-tab load desyncs the service source from the assembly org — ✅ RESOLVED

> **Resolved 2026-08-28.** The mount-time subscribe gate now keys off an org MISMATCH rather than a
> fresh store: `if (orgId && serviceStore.orgId !== orgId) serviceStore.subscribe(orgId)`. The store's
> `subscribe()` is idempotent (it tears down the prior `onSnapshot` first), so on a same-tab navigation
> where the store is already on org X while the URL requests Y, the view re-subscribes the service
> source to Y — the same `orgIdRef` `useSlideshowAssembly` uses — eliminating the cross-org bleed; when
> the org already matches, the existing subscription is preserved (no redundant re-listen). Proven by
> three new tests in the `org-scoped service subscription (WR-02)` suite: fresh store subscribes to the
> requested `?org=`; a store already on a DIFFERENT org re-subscribes to the requested org; a store
> already on the requested org does NOT re-subscribe. The Phase 95 `/select-church` router-guard
> deferral (IN-02) was left untouched as documented.

**File:** `src/views/AudienceOutputView.vue:203-208` (subscribe gate), `:99-113` (service select), `:113` (assembly)
**Issue:** On mount the view subscribes the services store only when `!serviceStore.orgId`
(`if (orgId && !serviceStore.orgId) serviceStore.subscribe(orgId)`). In the intended standalone
`window.open` path the store is a fresh Pinia singleton (new JS realm) with `orgId === null`, so it
subscribes to the `?org=`/fallback org and everything is consistent. But this route is also a
normal, directly-loadable SPA route: if it is reached in a tab where the services store is *already*
subscribed to org **X** (e.g. the operator was in `/services` for org X, then the URL is navigated
to `/present/audience/:serviceId?org=Y`), the gate skips the re-subscribe, so `services` still holds
**X's** services while `useSlideshowAssembly(localService, orgIdRef)` subscribes scripture/lyrics/
slide-groups to **Y**. Result: either the service is never found (permanent pure black) or an X
service is assembled against Y's content maps (empty/wrong slides) — on the congregation surface,
with no diagnostic. It is a narrow trigger (there is no in-app nav link to this route yet; Phase 95
owns the opener), but the latent assumption is worth hardening before Phase 95 wires up navigation.
**Fix:** Re-subscribe when the store's org does not match the resolved org, rather than only when it
is unset — e.g. `if (orgId && serviceStore.orgId !== orgId) serviceStore.subscribe(orgId)` (relying
on the store's own idempotency/teardown), or assert the standalone-window precondition explicitly.
Either way, keep the service-source org and the assembly org derived from the same `orgIdRef`.

## Info

### IN-01: `?? authStore.orgId` fallback is sound, but a mismatched active org yields undiagnosable permanent black

**File:** `src/views/AudienceOutputView.vue:94`
**Issue:** `orgIdRef = (route.query.org as string) ?? authStore.orgId ?? null`. Security-wise this is
sound — the fallback resolves to the operator's own active org, not an attacker-chosen one, and all
reads remain gated by Firestore org-membership rules (canWrite is omitted, so no write is attempted;
T-93-03 holds). The behavior note: when `?org=` is absent and the operator's active `authStore.orgId`
does not contain `:serviceId`, `watch(services).find(id)` never matches, `localService` stays null,
and the surface stays pure black forever with no signal (congregation-safe by design, but
operator-hostile). This is acceptable for the phase's scope; flagged so Phase 95 (which supplies the
explicit `?org=`) and any future UAT know the fallback masks a not-found service as an intentional
blackout.
**Fix:** None required this phase. If desired later, the control window (Phase 95) could detect a
never-resolving service and surface a status on the *control* surface only.

### IN-02: Directly-loaded audience URL bounces multi-church members to /select-church (documented deferral)

**File:** `src/router/index.ts:87-99`, `:149-169`
**Issue:** The route is `requiresAuth` only and `beforeEach` was deliberately left untouched (per
93-01 Task 1 and 93-CONTEXT OUT OF SCOPE). Consequently a member of more than one church who
*directly* loads `/present/audience/:serviceId?org=Y` in a fresh window hits the org-selection gate
(`requiresOrgSelection` true) and is redirected to `/select-church` — the `?org=` query is ignored
by the guard. This weakens the "self-bootstraps / directly loadable without an opener" claim for
multi-church users. It is an explicitly documented scope boundary owned by Phase 95's window.open
flow, not a defect of this phase — recorded here for the milestone-end UAT and Phase 95 planning.
**Fix:** Out of scope for Phase 93. Phase 95 must either pre-resolve the org from `?org=` before/at
navigation, or open the window with the active org already selected.

### IN-03: Wake-lock re-acquire overwrites the sentinel ref without observing its release

**File:** `src/views/AudienceOutputView.vue:186-200`
**Issue:** `acquireWakeLock()` assigns `wakeLock.value = await navigator.wakeLock.request('screen')`
every time it runs, including from `handleVisibilityChange`. Nothing listens to the sentinel's
`release` event to null the ref, and nothing releases the previous sentinel before overwriting it.
In normal operation this is harmless (the browser auto-releases the prior lock when the tab hides,
which is precisely why re-acquisition is needed), but if a `visibilitychange`→`visible` ever fired
without a preceding auto-release, the old still-held sentinel would be orphaned (unreleasable). Low
likelihood; noted for robustness.
**Fix:** Optionally attach `sentinel.addEventListener('release', () => { wakeLock.value = null })`
after a successful request so the ref reflects the true lock state, and/or release an existing
non-null sentinel before re-requesting.

### IN-04: `onUnmounted` gates `serviceStore.unsubscribeAll()` behind an awaited `wakeLock.release()`

**File:** `src/views/AudienceOutputView.vue:254-267`
**Issue:** The hook is `async`; `serviceStore.unsubscribeAll()` runs only *after*
`await wakeLock.value?.release()`. The critical synchronous teardown (`handle.close()`,
`removeEventListener` ×2) correctly runs before the first `await`, and a rejected release is
try/caught — but if `release()` ever hung (never resolves), the services-store Firestore listener
would leak. This is moot for the intended standalone window (it is closing anyway) and release()
hanging is not a realistic browser failure mode, so this is a minor ordering nit.
**Fix:** Move `serviceStore.unsubscribeAll()` above the awaited release (or drop the `await` and let
release settle detached), so store teardown never depends on an external promise settling.

### IN-05: `resolvedFontChoice` + `DEFAULT_FONT_*` constants are duplicated from `PresentationViewer.vue`

**File:** `src/views/AudienceOutputView.vue:140-159`
**Issue:** Per Pitfall 17 the view correctly reuses the shared `slideTypography.ts` helpers
(`cssVarsFor`, `snapWeight`, `waitForSlideFont`, `loadFontCss`, `FONT_LOAD_TIMEOUT_MS`) for the
heavy lifting, but the thin `resolvedFontChoice()` wrapper and the `DEFAULT_FONT_FAMILY`/
`DEFAULT_FONT_WEIGHT` constants are copy-pasted from `PresentationViewer.vue`. Two independent copies
of this wrapper can drift (exactly the risk Pitfall 17 warns about for the font gate). Not a defect —
the load-bearing gate logic is shared — but a small consolidation opportunity.
**Fix:** Consider promoting `resolvedFontChoice`/the default constants into `slideTypography.ts`
alongside the other shared helpers so both render sites call one implementation.

---

_Reviewed: 2026-08-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
