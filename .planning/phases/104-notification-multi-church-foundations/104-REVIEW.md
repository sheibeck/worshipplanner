---
phase: 104-notification-multi-church-foundations
reviewed: 2026-09-01T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/stores/toasts.ts
  - src/components/ToastHost.vue
  - src/App.vue
  - src/components/AppShell.vue
  - src/composables/useRunControl.ts
  - src/views/RunControlView.vue
  - src/views/MonitorSetupView.vue
  - src/stores/auth.ts
  - src/stores/orgScopedStores.ts
  - src/components/AppSidebar.vue
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: fixed
fixed_at: 2026-09-01T01:50:00Z
fixed:
  critical: 1
  warning: 4
  info: 3
  total: 8
deferred: 0
---

# Phase 104: Code Review Report

**Reviewed:** 2026-09-01
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the generalized notification store/host (R309/R310) and the sidebar church switcher
(R311/R312). The notification primitive itself (`toasts.ts`/`ToastHost.vue`) is well-built —
idempotent dismiss/clearSticky, sticky-first ordering, a genuinely mandatory dismiss control on
every card — and the two proof-case migrations (`useRunControl.ts`, `MonitorSetupView.vue`) clear
their stickies on every exit path the authors traced.

Two classes of defect survived that tracing, however:

1. **A real R312 data-leak**: `resetOrgScopedStores()` only tears down the 11 registered Pinia
   stores. At least two components (`TeamView.vue`, `GettingStarted.vue`) hold their own
   org-scoped `onSnapshot` listeners, opened once in `onMounted` from a *non-reactive* read of
   `authStore.orgId`, with no watcher and no registration in `resetOrgScopedStores()`. Because the
   new sidebar switcher changes org context **in place** (no navigation, no remount), a multi-org
   editor who switches churches while sitting on `/admins` (or `/`) keeps watching the **previous**
   church's member/invite/roster data — the exact stale-cross-tenant-data class R312 exists to
   close, now reachable through a surface this phase itself added.
2. **Two ironic stuck/broken-message regressions inside the notification work itself** — a
   church-switch failure toast that never auto-dismisses (and never de-dupes) because of how
   `PushOptions` branches, and a sticky's "open in new tab" link that hard-codes `rel="noopener"`,
   silently breaking for the multi-org users it exists to help (this exact `noopener` pitfall is
   already documented and avoided elsewhere in the same file, for the same link).

None of these were caught by the plan's own test suite because the relevant tests mock the
notification store or don't exercise a same-instance org switch — see the Info section.

## Critical Issues

### CR-01: In-place church switch leaks stale org data in views the reset registry doesn't cover

**File:** `src/views/TeamView.vue:490-515` (also `src/components/GettingStarted.vue:120-130`)
**Issue:**
`AppSidebar.vue`'s new church switcher calls `authStore.selectOrg()` (`src/stores/auth.ts:689-700`),
which calls `resetOrgScopedStores()` (`src/stores/orgScopedStores.ts:41-53`) — but that function only
unsubscribes the **11 Pinia stores** registered in it. It has no way to reach a component's own local
`onSnapshot` subscriptions.

`TeamView.vue` (the `/admins` page, reachable by any editor, exactly the role the switcher targets)
opens its `members`/`invites` listeners once in `onMounted` from a **non-reactive** read of
`authStore.orgId`:
```ts
onMounted(() => {
  const orgId = authStore.orgId
  if (!orgId) return
  membersUnsub = onSnapshot(collection(db, 'organizations', orgId, 'members'), ...)
  invitesUnsub = onSnapshot(collection(db, 'organizations', orgId, 'invites'), ...)
})
```
There is no `watch(() => authStore.orgId, ...)` to re-subscribe, and nothing in
`resetOrgScopedStores()` tears these down. The switcher changes `authStore.orgId` **in place** —
no route change, no remount — so if an editor who belongs to two churches is sitting on `/admins`
and uses the new sidebar switcher, `TeamView.vue` keeps rendering the **previous** church's team
roster and pending invites (names/emails) under the new church's name in the sidebar header, until
the operator manually navigates away and back. `GettingStarted.vue` (mounted on the Dashboard,
also reachable while the switcher is visible) has the identical pattern for its member count.

This is precisely the stale-cross-org-data class R312 was written to close, and the new switcher —
unlike the pre-existing `enterOrgAsSuperAdmin`/`exitSuperAdminView`/`logout` paths, which all force
a router navigation that remounts the destination view — is the first `resetOrgScopedStores()`
caller that can leave the SAME component instance mounted across the switch, exposing every
listener the registry doesn't know about.

**Fix:** Either (a) add a `watch(() => authStore.orgId, (id) => { teardown(); if (id) subscribe(id) })`
to `TeamView.vue` and `GettingStarted.vue` (and audit for other `onMounted`-only, org-scoped
`onSnapshot` call sites outside the Pinia store layer), or (b) force a full remount on org switch
(e.g. `:key="authStore.orgId"` on the router-view in `App.vue`) so every view's own `onMounted`
teardown/resubscribe logic runs naturally. Given `resetOrgScopedStores()`'s own docblock already
tracks a "forward obligation" for Phase 107's `stageLayouts` store, this same audit should extend to
non-Pinia listeners before the switcher ships.

## Warnings

### WR-01: Reassign sticky's "Open monitor setup" link uses `rel="noopener"`, defeating it for the exact multi-org users it targets

**File:** `src/components/ToastHost.vue:45-53`
**Issue:** The rich sticky card's link renders as:
```html
<a :href="toast.link.href" target="_blank" rel="noopener" ...>{{ toast.link.label }}</a>
```
The only current consumer is `useRunControl.ts`'s `monitor-reassign` sticky
(`link: { label: 'Open monitor setup in a new tab', href: '/monitor-setup' }`,
`src/composables/useRunControl.ts:497`). This exact codebase already documents, at
`useRunControl.ts:1124-1136` (`openManage()`), why a new tab to `/monitor-setup` must NOT use
`noopener`: the router's org-selection guard depends on `sessionStorage`'s active-org choice, which
the HTML spec only copies to a popup when the opener relationship is preserved. `openManage()`
deliberately calls `window.open('/monitor-setup', '_blank')` with no `noopener` for exactly this
reason. `ToastHost.vue`'s generic `<a>` reintroduces the same bug for the sticky's link: a
multi-org operator who is live, hits the monitor-reassign warning, and clicks "Open monitor setup in
a new tab" gets bounced by the router guard to `/select-church` in the new tab instead of
`/monitor-setup`, because the popup has no inherited org context.
**Fix:**
```html
<a
  v-if="toast.link"
  :href="toast.link.href"
  target="_blank"
  ref="opener"
  @click.prevent="() => { window.open(toast.link!.href, '_blank'); }"
  ...
>
```
or simply drop `rel="noopener"` from the anchor (matching `openManage()`'s reasoning) unless a
future consumer needs it, in which case make it an opt-in field on `NotificationLink` rather than a
blanket default.

### WR-02: Church-switch failure toast is accidentally permanent (never auto-dismisses) and never de-dupes

**File:** `src/components/AppSidebar.vue:279`, `src/stores/toasts.ts:76-87`
**Issue:** `handleSwitch`'s catch branch calls:
```ts
toasts.push('Could not switch churches. Please try again.', { variant: 'error' })
```
`toasts.ts`'s `push()` only arms the auto-dismiss timer when `opts === undefined` (the legacy
back-compat path) or `opts.autoDismissMs !== undefined`:
```ts
if (opts === undefined) {
  setTimeout(() => dismiss(id), 6000)
} else if (opts.autoDismissMs !== undefined) {
  setTimeout(() => dismiss(id), opts.autoDismissMs)
}
// opts passed with autoDismissMs left undefined: sticky, no timer.
```
Passing `{ variant: 'error' }` (no `autoDismissMs`) falls into neither branch, so this toast is
**sticky forever** — it never self-clears, unlike every other `toasts.push(message)` call site in
the app (`CongregationalEditor.vue`, `TeamSlideOver.vue`), which all get the historical 6-second
timer. Worse, `push()` (unlike `setSticky()`) has no key-based de-dupe, so if a member's connection
is flaky and several switch attempts fail in a row, the toasts stack up indefinitely, each requiring
its own manual dismiss. This is a genuine stuck-message regression shipped inside the very phase
built to eliminate stuck messages (R309/R310) — it just happens to still have a working dismiss
button, so it isn't a total violation of R309, but it is a clear behavioral regression from every
other error toast in the app.
**Fix:** Since `'error'` is already `push()`'s default variant, the simplest fix is to drop the
options object entirely: `toasts.push('Could not switch churches. Please try again.')`. If the
explicit variant is wanted for clarity, pass `autoDismissMs` too:
`toasts.push('...', { variant: 'error', autoDismissMs: 6000 })`.

### WR-03: Church-switcher panel's "open focuses first item" can silently no-op on the active church

**File:** `src/components/AppSidebar.vue:119-147`, `243-247`
**Issue:** Opening the switcher panel is supposed to move focus to the first `[role="menuitem"]`
(mirroring `SlideActionMenu.vue`'s pattern):
```ts
watch(switcherOpen, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  switcherPanelRef.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
})
```
But the row for the **currently active** church renders as a plain, non-focusable element:
```html
<div v-if="m.id === authStore.orgId" role="menuitem" aria-current="true" ... class="... cursor-default ...">
```
— no `tabindex`, not a `<button>`. Calling `.focus()` on a `<div>` with no `tabindex` is a no-op in
every browser. Because `authStore.memberships` lists `orgIds` (primary org first) before any
claim-only extras, the active church — the one the operator most commonly has selected — is
frequently first in DOM order. Whenever that's the case, opening the panel silently fails to move
focus anywhere, breaking the "open-focuses-first-item" contract this component claims to establish
as its ARIA-menu pattern, for keyboard-only users specifically.
**Fix:** Give the active row `tabindex="-1"` (matches its non-interactive-but-focusable role) or, if
it should stay unfocusable, make the auto-focus target the first **focusable** menuitem instead of
the first DOM match:
```ts
switcherPanelRef.value?.querySelector<HTMLElement>('button[role="menuitem"]')?.focus()
```

### WR-04: `monitorChanged` isn't reset alongside the new defensive `clearSticky('monitor-reassign')` calls, reintroducing a stale-state desync this phase didn't have before

**File:** `src/composables/useRunControl.ts:876-914` (`endServiceTeardown`), `1152-1171` (`onUnmounted`)
**Issue:** Before this phase, the reassign warning had exactly one source of truth: `monitorChanged`.
This phase (correctly, per its own stated Rule-2 deviation) added defensive
`notifications.clearSticky('monitor-reassign')` calls to `endServiceTeardown()` and `onUnmounted()`
so the **notification** never survives past the live session. But it did not add a matching
`monitorChanged.value = false` at either site, and `monitorChanged` is still the flag
`RunDisplaysPanel` reads to decide its per-output "reassigning" chip precedence
(`src/components/run/RunDisplaysPanel.vue:59-61`, `:reassigning="monitorChanged"` in
`RunControlView.vue:226`). If an operator hits a monitor-reassign event, exits the live session
(clearing the sticky but not `monitorChanged`), and then goes live again **in the same mounted
RunControlView instance** (no route change — this composable's `onUnmounted` only fires on an
actual unmount), `RunDisplaysPanel` will render its stale "reassigning" chip state from the moment
the new session opens outputs, even though nothing has changed yet in the new session. The
notification (the newly-added, correctly-cleared half) and the display panel's own indicator (the
pre-existing, now-orphaned half) can now disagree — a desync this phase's migration introduced by
splitting one flag's responsibilities into two without keeping both halves in the same reset paths.
**Fix:** Add `monitorChanged.value = false` next to the two new `clearSticky('monitor-reassign')`
calls in `endServiceTeardown()` and `onUnmounted()`.

## Info

### IN-01: `MonitorSetupView`'s save-outcome sticky doesn't account for leaving the `'granted'` phase

**File:** `src/views/MonitorSetupView.vue:305-315`
**Issue:** The `watch(saveOutcome, ...)` that drives `setSticky`/`clearSticky` only fires when
`saveOutcome` itself changes value. If a save fails (`saveOutcome === 'not-persisted-warning'`) and
then, mid-session, the Window Management permission is revoked or `getScreenDetails()` starts
failing (moving `phase` to `'denied'`/`'unavailable'`), `saveOutcome` never changes, so the
"Setup not saved" sticky keeps showing over the now-unrelated fallback panel until the component
unmounts.
**Fix:** Reset `saveOutcome.value = 'idle'` (or clear the sticky directly) in
`handleDetectionFailure()`, matching the existing pattern where `resolveGrantedBranch()` already
resets it to `'idle'` on every successful re-resolution.

### IN-02: Missing test coverage exercising the real store's sticky-vs-transient branching for `push()`

**File:** `src/components/__tests__/AppSidebar.test.ts:68-73, 218-231`
**Issue:** The switch-failure test mocks `useToasts()` entirely (`push: mockToastPush`), so it only
asserts the call arguments, not the resulting toast's actual lifetime. This is why WR-02 above
shipped without a failing test — nothing in the suite constructs a real `useToasts()` store and
asserts the resulting toast auto-dismisses (or doesn't).
**Fix:** Add (or extend `toasts.test.ts` with) a case that calls the real store's `push(msg, {
variant: 'error' })` and asserts whether/when it self-clears, so any future opts-shape mismatch like
WR-02 fails a test instead of shipping silently.

### IN-03: `reassignRole` left stale after clear

**File:** `src/composables/useRunControl.ts:370, 462, 476, 500`
**Issue:** `reassignRole.value` is only ever written by `onScreensChange`'s mismatch branch; none of
the three clear sites (`reopenReassignedOutputs`, `onScreensChange`'s two clear branches) reset it
back to its `'audience or confidence'` default. Purely cosmetic today (nothing reads it while
`monitorChanged` is false), but it's a latent trap if a future consumer reads `reassignRole` without
also gating on `monitorChanged`.
**Fix:** Reset `reassignRole.value = 'audience or confidence'` alongside the existing clear calls,
for the same "don't leave stale state around" reasoning WR-04 argues for `monitorChanged`.

---

## Fix Log (2026-09-01)

All 8 findings fixed. Commits grouped by touched file(s) rather than strictly
one-per-finding where two findings landed on the same lines/file (WR-02+IN-02,
WR-04+IN-03) — each commit message names every finding ID it addresses.

### CR-01: In-place church switch leaks stale org data — **fixed**

**Files:** `src/views/TeamView.vue`, `src/components/GettingStarted.vue`
**Commit:** `452ef8dd`
**Approach:** Chose option (a) from the review's fix — replaced the
onMounted-only, non-reactive `authStore.orgId` read with
`watch(() => authStore.orgId, ..., { immediate: true })` in both views, tearing
down the previous listeners and clearing local state before resubscribing to
the new org. Audited the rest of `src/{views,components}` for the same
pattern: `ConfigurationTab.vue`'s `onSnapshot` targets the top-level
`superAdmins` collection (not org-scoped), so it is not affected.

### WR-01: ToastHost sticky link hard-codes `rel="noopener"` — **fixed**

**File:** `src/components/ToastHost.vue`
**Commit:** `f128b41a`
**Approach:** Dropped `rel="noopener"` from the anchor (the review's
"simply drop it" option), matching `useRunControl.ts`'s `openManage()`
reasoning for the same link/destination. Only current consumer is the
monitor-reassign sticky.

### WR-02: Church-switch failure toast never auto-dismisses — **fixed**

**File:** `src/components/AppSidebar.vue`
**Commit:** `a313bf54` (combined with WR-03/IN-02 — same file/test)
**Approach:** Dropped the `{ variant: 'error' }` options object from the
`toasts.push()` call in `handleSwitch`'s catch branch — `'error'` is already
`push()`'s default variant, so this restores the historical 6000ms
auto-dismiss timer with no behavior change to the message shown.

### WR-03: Switcher "focus first item" no-ops on the active church — **fixed**

**File:** `src/components/AppSidebar.vue`
**Commit:** `a313bf54` (combined with WR-02/IN-02 — same file/test)
**Approach:** Scoped the auto-focus query from `[role="menuitem"]` to
`button[role="menuitem"]` so it always lands on a focusable row instead of
silently no-opping on the non-interactive active-church `<div>`.

### WR-04: `monitorChanged` not reset alongside `clearSticky('monitor-reassign')` — **fixed**

**File:** `src/composables/useRunControl.ts`
**Commit:** `b5e6d862` (combined with IN-03 — same file/sites)
**Approach:** Added `monitorChanged.value = false` next to both new
`clearSticky('monitor-reassign')` calls (`endServiceTeardown()`,
`onUnmounted()`), exactly as the review's fix specified.

### IN-01: MonitorSetupView save-outcome sticky survives leaving 'granted' — **fixed**

**File:** `src/views/MonitorSetupView.vue`
**Commit:** `5347fdba`
**Approach:** Reset `saveOutcome.value = 'idle'` in `handleDetectionFailure()`,
mirroring `resolveGrantedBranch()`'s existing reset pattern, exactly as the
review's fix specified.

### IN-02: AppSidebar.test.ts mocks useToasts() entirely — **fixed**

**File:** `src/components/__tests__/AppSidebar.test.ts`
**Commit:** `a313bf54` (combined with WR-02/WR-03 — same file, same test)
**Approach:** Removed the `vi.mock('@/stores/toasts', ...)` entirely; the
switch-failure test now uses a real Pinia-backed `useToasts()` store (via
`setActivePinia(createPinia())` in `beforeEach`) and asserts the resulting
toast both matches its expected shape AND actually self-clears at the
6000ms mark (`vi.useFakeTimers()` / `vi.advanceTimersByTime`), so a future
opts-shape regression like WR-02 fails this test instead of shipping
silently.

### IN-03: `reassignRole` left stale after clear — **fixed**

**File:** `src/composables/useRunControl.ts`
**Commit:** `b5e6d862` (combined with WR-04 — same file/sites)
**Approach:** Reset `reassignRole.value = 'audience or confidence'` at all
three clear sites (`reopenReassignedOutputs`, both branches of
`onScreensChange`), exactly as the review's fix specified.

### Verification

- `npm run type-check` (vue-tsc --build, includes test files): clean.
- `npx vitest run` on the 8 touched/related test files
  (`AppSidebar.test.ts`, `ToastHost.test.ts`, `GettingStarted.test.ts`,
  `TeamView.test.ts`, `MonitorSetupView.test.ts`, `RunControlView.test.ts`,
  `RunControlView.output.test.ts`, `toasts.test.ts`): 133/133 passed.
- Full `npx vitest run`: 175/177 files, 4819/4846 tests passed. The 2
  failing files are the documented pre-existing baselines
  (`src/storage.rules.test.ts` — Storage-emulator/cross-service-`exists()`
  limitation; `src/stores/appConfig.test.ts` — stale duplicate test file),
  neither touched by this fix pass.

---

_Reviewed: 2026-09-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-09-01_
_Fixer: Claude (gsd-code-fixer)_
