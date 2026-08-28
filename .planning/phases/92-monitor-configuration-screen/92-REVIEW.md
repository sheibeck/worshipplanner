---
phase: 92-monitor-configuration-screen
reviewed: 2026-08-28T16:03:46Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/views/MonitorSetupView.vue
  - src/components/MonitorCard.vue
  - src/components/MonitorFallbackPanel.vue
  - src/router/index.ts
  - src/components/AppSidebar.vue
  - src/views/__tests__/MonitorSetupView.test.ts
  - src/components/__tests__/AppSidebar.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 92: Code Review Report

**Reviewed:** 2026-08-28T16:03:46Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Monitor Configuration Screen (`MonitorSetupView.vue`, `MonitorCard.vue`,
`MonitorFallbackPanel.vue`), the new `/monitor-setup` route and `AppSidebar.vue` nav entry, and
the two new test files, against the 92-01/92-02 plans, the 92-UI-SPEC state machine, and
`PITFALLS.md`.

The core correctness contracts the plan calls out as highest-risk all check out:
- `getScreenDetails()` **is** called synchronously as the effective first statement of the Detect
  click handler — the two lines ahead of it (`'getScreenDetails' in window` and
  `phase.value = 'detecting'`) are synchronous property checks/ref writes, not awaits, store
  dispatches, or router calls, so user activation is preserved (verified both by inspection and
  by the passing synchronous-call test, which asserts the mock's call count is 1 immediately
  after `.trigger('click')`, before any `flushPromises()`).
- All three permission states (granted / denied / unavailable) are first-class: unavailable is
  feature-detected on mount before any Detect button renders, and ANY rejection (not just
  `NotAllowedError`) routes to the shared `MonitorFallbackPanel`, never a dead end.
- The save round-trip (`saveMapping` → `loadMapping` → set-equality check) is implemented and
  tested correctly: "Saved for this device" only renders on a confirmed persisted read-back; a
  forced `Storage.prototype.setItem` throw renders the non-blocking amber warning instead.
- State B3's "needs-reprompt" grid renders genuinely blank (never pre-guesses from the stale
  mapping); State B2's "Reassign roles" is the one correctly-scoped case that pre-selects.
- The `screenschange` listener is added once per successful detection (old listener explicitly
  removed before a new one is attached on re-detect) and is removed in `onUnmounted` — no leak.
- RBAC is correct: the route carries `requiresAuth` only (no `requiresEditor`), and the
  `AppSidebar` nav entry is gated on `authStore.orgId` alone, matching `/services` and diverging
  deliberately (with an inline comment) from the editor-gated `Settings`/`Admins` neighbors. Both
  are proven by passing tests.
- `npm run type-check` (`vue-tsc --build`) passes clean; both new test files (10 tests) pass.

Three warning-level correctness/quality gaps were found, all in `MonitorSetupView.vue`/
`MonitorCard.vue`, none of which are covered by the current test suite. None of them touch the
persisted-mapping integrity that Phase 95's Run flow depends on — they affect only in-session,
unsaved UI state and one CSS layout contract.

## Warnings

### WR-01: Long monitor labels will not actually truncate — `min-w-0` is on the wrong element

**File:** `src/components/MonitorCard.vue:4-5`
**Issue:** The card's label row is:
```html
<div class="flex items-center gap-2 min-w-0">
  <h3 class="text-base font-semibold text-gray-100 truncate">{{ screen.label || 'Unlabeled display' }}</h3>
  <span v-if="screen.isPrimary" class="... shrink-0">Primary</span>
</div>
```
`min-w-0` is applied to the **flex container**, not to the `<h3>` that carries `truncate`. In
CSS flexbox, a flex *item's* default `min-width` is `auto` (its min-content size), independent of
anything set on the container — `truncate`'s `overflow:hidden`/`white-space:nowrap` only clips
once the item's box is narrower than its content, and an item with `min-width:auto` will not
shrink below the full (unwrapped) width of its own text. For a genuinely long OS-provided label,
the `<h3>` will render at full width instead of eliding with `…`, pushing against/wrapping the
"Primary" badge and growing the card — the exact failure this phase's own must-have backstop truth
explicitly calls out as required to avoid ("Long OS-provided monitor labels truncate on the card
label row rather than wrapping and breaking card height").
**Fix:** Move (or add) `min-w-0` onto the `<h3>` itself (and give it `flex-1` so it's the element
that shrinks, with the badge kept `shrink-0`):
```html
<div class="flex items-center gap-2">
  <h3 class="flex-1 min-w-0 text-base font-semibold text-gray-100 truncate">{{ screen.label || 'Unlabeled display' }}</h3>
  <span v-if="screen.isPrimary" class="... shrink-0">Primary</span>
</div>
```

### WR-02: Re-detect / screenschange can silently discard unsaved in-progress role selections — ✅ RESOLVED

> **Resolved 2026-08-28.** Refactored `handleDetectionSuccess`/`onScreensChange` into a shared
> `applyDetectedScreens(details, isRefresh)`. On a mid-session refresh (Re-detect button or OS
> `screenschange`) whose physical screen SET is unchanged (`screenSetKey` equality) while an unsaved
> edit is in flight (`dirtyEdits`), the branch-resolution is skipped and a non-blocking
> "we kept your in-progress choices" notice (`[data-testid="refresh-kept-notice"]`) is shown instead
> of clobbering state; a genuine layout change still re-resolves. `dirtyEdits` is set by `onSelectRole`
> and the new `onReassignRoles`, and cleared on successful save / clean `resolveGrantedBranch`.
> Covered by a new regression test in `MonitorSetupView.test.ts` ("a same-layout re-detect must not
> discard unsaved role edits").

**File:** `src/views/MonitorSetupView.vue:249-274` (`resolveGrantedBranch`), `276-280`
(`onScreensChange`), `316-325` (`onRedetect`)
**Issue:** `resolveGrantedBranch()` unconditionally overwrites `audienceFingerprint` /
`confidenceFingerprint` (and, in the matched branch, also flips `editingFromMatched.value = false`,
collapsing the editable grid back to the read-only summary) every time it runs — and it runs from
three places that don't require anything to have been saved first:
1. The "Re-detect" button (visible whenever the editable grid is shown, including mid-"Reassign
   roles" edits from State B2).
2. The live `screenschange` listener, which can fire from an OS-level display event while the
   operator is mid-selection in State B/B3.
3. `MonitorFallbackPanel`'s retry handler (lower risk, since it's only reachable pre-grant).

Concretely: a projectionist opens the "Reassign roles" editor from a matched B2 summary, picks a
different monitor for Audience, then clicks "Re-detect" (offered right there in the same view for
a "mid-session replug refresh") before clicking Save. Because the physical layout hasn't actually
changed, `matchMapping` still reports `'matched'` against the *original* saved mapping, so
`resolveGrantedBranch()` resets `editingFromMatched` to `false` and re-populates
`audienceFingerprint`/`confidenceFingerprint` from the stale saved values — silently discarding the
change the operator just made, with no warning or confirmation.
**Fix:** Track whether the in-memory selection differs from what `resolveGrantedBranch()` is about
to apply (or simply skip re-running the branch-resolution logic when `editingFromMatched.value` is
`true` / the grid is dirty), and if a live re-detect would clobber an unsaved edit, surface a small
non-blocking notice instead of silently overwriting state — mirroring the "never silently discard"
posture the round-trip save check already uses elsewhere in this same file.

### WR-03: A stale `getScreenDetails()` resolution can override an explicit "Set up manually instead" choice

**File:** `src/views/MonitorSetupView.vue:35-41`, `282-291`, `302-312`
**Issue:** The "Set up manually instead" escape-hatch button (`@click="phase = 'denied'"`) has no
`:disabled` binding and remains clickable while `phase === 'detecting'`, i.e. while a real
`getScreenDetails()` promise from an earlier Detect click is still pending (the native permission
prompt does not block page interaction). If the operator clicks "Set up manually instead" while
that prompt is still up, `phase.value` becomes `'denied'` and the fallback panel renders — but the
in-flight promise is never cancelled or guarded. When it eventually resolves,
`handleDetectionSuccess` unconditionally sets `phase.value = 'granted'`, silently yanking the
operator out of the fallback panel they deliberately chose and into the auto-detected grid with no
indication of why the screen changed underneath them.
**Fix:** Guard the async callbacks against a stale `phase`, e.g. capture the phase (or a
monotonic request token) at call time and no-op if the user has since navigated away from
`'detecting'`:
```js
function onDetectClick() {
  if (!('getScreenDetails' in window)) { phase.value = 'unavailable'; return }
  phase.value = 'detecting'
  const requestId = ++detectRequestId
  ;(window as any).getScreenDetails()
    .then((details: any) => { if (requestId === detectRequestId) handleDetectionSuccess(details) })
    .catch(() => { if (requestId === detectRequestId) handleDetectionFailure() })
}
```

## Info

### IN-01: `computeFingerprint` collisions on mirrored/cloned displays are silently indistinguishable in this UI

**File:** `src/views/MonitorSetupView.vue:172-174` (`screensWithFingerprint`), inherited from
`src/utils/monitorConfig.ts` (Phase 91, not modified here)
**Issue:** `computeFingerprint` keys on label+resolution+position+isPrimary. Two screens set to
mirror one another (identical resolution, both at `left:0,top:0`) produce an identical fingerprint,
which becomes a duplicate `:key` in the `v-for` over `screensWithFingerprint` and means the two
cards' role selections cannot be told apart (`selectedRoleFor(fingerprint)` can't distinguish them).
This is a pre-existing property of the fingerprint module, not something introduced this phase, and
mirrored displays are an unusual choice for an Audience/Confidence split — noted for awareness, not
blocking.
**Fix:** Out of scope for this phase; if it needs addressing, `computeFingerprint` would need a
tie-breaker (e.g. append the screen's index among same-fingerprint duplicates) in `monitorConfig.ts`.

### IN-02: Role pills use `role="radio"` without the ARIA-APG roving-tabindex/arrow-key pattern

**File:** `src/components/MonitorCard.vue:18-38`
**Issue:** Each Audience/Confidence pill is a separately-`Tab`-able native `<button role="radio">`.
The WAI-ARIA Authoring Practices radiogroup pattern expects only one radio in the group to be
tab-stoppable at a time, with `ArrowLeft`/`ArrowRight` moving selection within the group — screen
reader users following that convention won't find arrow-key navigation here. This is an explicit,
documented deviation called out in both the UI-SPEC ("no custom key handling required... standard
Tab/Enter semantics only") and the plan, so it's not an implementation defect — flagging only as a
quality note for a future accessibility pass.
**Fix:** If ever revisited: implement roving `tabindex` (`tabindex="0"` on the selected/first pill,
`-1` on the other) and `ArrowLeft`/`ArrowRight` handling within each radiogroup.

### IN-03: "Set up manually instead" shows denial copy ("Your browser blocked automatic detection...") to a user who never attempted detection

**File:** `src/views/MonitorSetupView.vue:35-41`, `src/components/MonitorFallbackPanel.vue:41-45`
**Issue:** The State A escape hatch jumps straight to `phase = 'denied'`, reusing
`MonitorFallbackPanel`'s `reason="denied"` copy verbatim — "Your browser blocked automatic
detection" — even though nothing was ever attempted or blocked; the operator simply opted out. This
matches the 92-UI-SPEC's explicit instruction to "jump straight to State C's fallback panel," so
it's a spec-level copy choice, not a coding defect.
**Fix:** Optional future polish: a third `reason` variant ("skipped") with neutral copy, if this
copy inaccuracy is ever reported as confusing in UAT.

### IN-04: `Function` used as a TypeScript type erases call-signature checking

**File:** `src/views/MonitorSetupView.vue:170`, `282`
**Issue:** `screenDetailsRef` and `handleDetectionSuccess`'s `details` parameter type
`addEventListener`/`removeEventListener` as bare `Function`. This is a commonly-lint-flagged
pattern (`@typescript-eslint/ban-types`) because `Function` accepts any callable with any
signature/arity, defeating the purpose of typing the DOM-like `ScreenDetails` shape at all — a
call like `screenDetailsRef.removeEventListener('screenschange')` (wrong arg count) would still
type-check.
**Fix:**
```ts
let screenDetailsRef: {
  screens: ScreenLike[]
  addEventListener: (type: 'screenschange', listener: () => void) => void
  removeEventListener: (type: 'screenschange', listener: () => void) => void
} | null = null
```

---

_Reviewed: 2026-08-28T16:03:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
