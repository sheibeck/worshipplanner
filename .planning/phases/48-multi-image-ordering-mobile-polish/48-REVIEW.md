---
phase: 48-multi-image-ordering-mobile-polish
reviewed: 2026-08-09T00:34:11Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/slides/dropRouting.ts
  - src/components/GettingStarted.vue
  - src/components/slides/SlidesTab.vue
  - src/components/slides/SlidePlanRail.vue
  - src/components/slides/SlideCard.vue
  - src/components/slides/SlideActionMenu.vue
  - src/components/slides/SlideGrid.vue
  - src/components/actionBarItems.ts
  - src/views/serviceEditorActionBar.ts
  - src/components/ContextualActionBar.vue
  - src/views/ServiceEditorView.vue
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: clean
fixed_at: 2026-08-09T21:15:00Z
dispositions:
  WR-01: "fixed (3a321ca)"
  WR-02: "deferred — owner design decision"
  WR-03: "fixed (33087d9)"
  IN-01: "fixed (90dadbf)"
  IN-02: "fixed (af4e2c0)"
---

## Resolution (2026-08-09)

All findings dispositioned; no unresolved Critical/Warning remain.

- **WR-01** — fixed in `3a321ca`. `buildShareItem` now sets `disabled: ctx.isSharing`
  and `onShare()` gained its own `if (isSharing.value) return` re-entrancy guard.
  Covered by a new regression test (`ServiceEditorView.test.ts` — "a second click
  while a share is in flight does not issue a second createShareToken write").
- **WR-02** — **DEFERRED — owner design decision.** Print/Share being confined to
  the Service Order tab is a documented, UI-checker-approved 48-UI-SPEC.md § Action
  Bar Migration decision that satisfies R101 literally ("Print and Share appear in
  the top contextual action bar"). No code change made. The cross-tab-availability
  trade-off is recorded for the owner in PENDING-VERIFICATION.md § Phase 48 for an
  explicit sign-off decision (accept the narrowed scope, or expand Print/Share to
  Slides/Roles in a future phase).
- **WR-03** — fixed in `33087d9`. The drag handle's invisible hit-area padding is
  now asymmetric (6px left/right matching `gap-1.5`, 8px top matching `mt-2`, 14px
  bottom unchanged) so the enlarged hit-testable box no longer crosses into the
  kind-badge/label spans or the preview `div` above and silently swallow a
  selection click meant for them. The resulting ~28x38px footprint is smaller than
  the 44px floor in the capped directions — documented in-code as a known
  trade-off; real-thumb reachability at this size remains the 🧪 physical-device
  backstop 48-UI-SPEC.md's own UI Considerations table already calls out for this
  affordance, not newly introduced by this fix.
- **IN-01** — fixed in `90dadbf`. `GettingStarted.vue`'s `localStorage`
  read/write are now wrapped in try/catch, mirroring `src/stores/songs.ts`'s
  established pattern. Covered by two new regression tests (getItem throws,
  setItem throws).
- **IN-02** — fixed in `af4e2c0`. `Intl.Collator` hoisted to a module-level
  `NATURAL_ORDER_COLLATOR` constant in `dropRouting.ts`.

Verification: `npm run type-check` clean after every fix; affected suites
(`ServiceEditorView.test.ts`, `SlideCard.test.ts`, `GettingStarted.test.ts`,
`dropRouting.test.ts`) green; `npx vitest run --dir src --exclude '**/rules.test.ts'`
stays at the documented 2-file baseline (`storage.rules.test.ts` — needs the
Storage emulator, `RosterView.test.ts` — stale assertion), no new failures.

# Phase 48: Code Review Report

**Reviewed:** 2026-08-09T00:34:11Z
**Depth:** standard
**Files Reviewed:** 11 (dropRouting.ts, GettingStarted.vue, SlidesTab.vue, SlidePlanRail.vue, SlideCard.vue, SlideActionMenu.vue, SlideGrid.vue, actionBarItems.ts, serviceEditorActionBar.ts, ContextualActionBar.vue, ServiceEditorView.vue)
**Status:** issues_found

## Summary

R098 (`Intl.Collator` natural sort, images bucket only) and R103 (dismissible Getting Started
panel) are implemented exactly as specified — verified line-for-line against 48-UI-SPEC.md and
48-RESEARCH.md, and both are test-covered (`dropRouting.test.ts`, `GettingStarted.test.ts`, both
green). R099's SortableJS change is provably additive: `handle`/`draggable`/`animation`/
`ghostClass`/the `onEnd` body are byte-identical to the pre-phase version, with only `delay:150,
delayOnTouchOnly:true, touchStartThreshold:5` appended — the exact shape the locked decision
required. R100's QuarterView stacking recipe and R102's Undo-as-link relocation (including the
now-unconditional `flex items-center gap-2` on the save-status wrapper) both match the UI-SPEC
verbatim, `npm run type-check` (`vue-tsc --build`) is clean, and the full `ServiceEditorView.test.ts`
+ slides suites (256 + 248 tests) pass.

Two real issues survived the migration, both in the R101 action-bar relocation:

1. The bottom-row Share button's `:disabled="!localService || isSharing"` guard against
   double-submission while a share request is in flight was dropped — `buildShareItem` never sets
   `disabled`, and `onShare()` itself has no re-entrancy guard, so the button is now clickable
   repeatedly during an in-flight share, which the pre-migration UI explicitly prevented.
2. Print and Share, previously available from every tab (Service Order, Slides, Roles — the old
   bottom row rendered outside all three `v-show="activeTab===…"` wrappers), are now confined to
   the Service Order tab only, per `buildActionBarItems`'s per-tab routing. This is stated as a
   deliberate decision in 48-UI-SPEC.md § Action Bar Migration, but it is a genuine, user-visible
   capability loss (a user on the Slides tab can no longer print or share without switching tabs)
   worth flagging for product sign-off rather than treating as self-evidently correct.

A third, lower-confidence item concerns the new 44px hit-area technique (invisible padding +
negative margin) on `SlideCard.vue`'s drag handle: the CSS math shows its expanded hit-box can
overlap an adjacent sibling's box in the DOM (the footer label to its right, and the bottom edge of
the 140px preview area above), and because later-painted siblings win the overlap, clicks in that
sliver may be silently swallowed by the drag handle's `@click.stop` rather than reaching the card's
selection handler. This is exactly the class of risk 48-UI-SPEC.md itself calls a physical-device
backstop (not unit-testable) — flagged here so it isn't lost, not because it is proven wrong.

## Warnings

### WR-01: Share button's in-flight double-submit guard was dropped during the action-bar migration

**Disposition:** fixed (`3a321ca`) — see § Resolution.

**File:** `src/views/serviceEditorActionBar.ts:209-217`
**Issue:** The pre-migration bottom-row Share button was `:disabled="!localService || isSharing"`
(confirmed via `git show 9baf3d6:src/views/ServiceEditorView.vue`). `buildShareItem` — its
replacement in the top action bar — never sets `disabled` at all:
```ts
function buildShareItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.isEditor) return undefined
  return {
    key: 'share',
    label: ctx.isSharing ? 'Sharing...' : ctx.shareCopied ? 'Link Copied!' : ctx.shareError ? ctx.shareError : 'Share',
    icon: 'share',
    onClick: ctx.handlers.onShare,
  }
}
```
`onShare()` (`ServiceEditorView.vue:3503-3523`) has no internal re-entrancy check (no
`if (isSharing.value) return`) — it relied entirely on the button being disabled while
`isSharing` was true. With that gone, a user who clicks Share multiple times in quick succession
(or double-clicks) while a share-token request is in flight fires multiple concurrent
`serviceStore.createShareToken` writes and multiple `navigator.clipboard.writeText` calls, with
the label/`shareCopied`/`shareError` state left to whichever async call resolves last. No test
covers the in-flight state — `ServiceEditorView.test.ts:5253-5255` only asserts `disabled` is
`undefined` in the idle (not-sharing) state, which is true both before and after this regression
and does not catch it.

**Fix:**
```ts
function buildShareItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.isEditor) return undefined
  return {
    key: 'share',
    label: ctx.isSharing ? 'Sharing...' : ctx.shareCopied ? 'Link Copied!' : ctx.shareError ? ctx.shareError : 'Share',
    icon: 'share',
    disabled: ctx.isSharing,
    onClick: ctx.handlers.onShare,
  }
}
```
(Note: `buildPrintItem`'s dropped `:disabled="!localService"` is NOT a regression — the whole
button tree only mounts once `localService` is truthy, per the `v-else-if="!localService"` /
`v-else` branch at `ServiceEditorView.vue:14-25`, so that condition was always `false` and is
correctly omitted.)

### WR-02: Print and Share are now confined to the Service Order tab — a real capability loss from "moved," not merely relocated

**Disposition:** DEFERRED — owner design decision. See § Resolution; recorded in PENDING-VERIFICATION.md § Phase 48 for owner sign-off. No code change made.

**File:** `src/views/serviceEditorActionBar.ts:250-271`, `src/views/ServiceEditorView.vue:1313-1320`
**Issue:** Before this phase, the bottom "Print, Share, Delete" row rendered outside all three
`v-show="activeTab === …"` wrappers (`service-order` at :682, `roles` at :1200, `slides` at
:1287) — confirmed via `git show 9baf3d6` — so Print and Share (Share editor-gated) were reachable
from every tab. After the migration, `buildActionBarItems` routes Print/Share only through
`buildServiceOrderItems`; `buildSlidesItems` and the Roles `[]` branch don't include them
(confirmed by `ServiceEditorView.test.ts:883-905`, which asserts zero action-bar buttons on
Roles). A user viewing the Slides tab who wants to print the service, or share it with a team
member, must now first switch to the Service Order tab. 48-UI-SPEC.md § Action Bar Migration does
call this out as an explicit scope decision ("adding them to Slides or Roles would be a scope
expansion this phase does not call for"), so this is not an unnoticed defect — but it is a
functional regression in a shipped feature that R101's own framing ("Print and Share appear in the
top contextual action bar," "move existing controls") does not obviously predict, and is worth a
deliberate product sign-off rather than being absorbed silently into "moved."
**Fix:** Either accept the narrowed scope explicitly (record it in STATE.md/CHANGELOG as an
intentional behavior change so a future bug report of "I can't print from the Slides tab" isn't
treated as a new regression), or push `buildPrintItem`/`buildShareItem` into `buildSlidesItems` and
the Roles branch as well if the intent was truly "relocate," not "restrict to one tab."

### WR-03: 44px hit-area negative-margin technique can overlap adjacent siblings and swallow clicks meant for them

**Disposition:** fixed (`33087d9`) — see § Resolution.

**File:** `src/components/slides/SlideCard.vue:86-105`
**Issue:** The drag-handle span (`p-3.5 -m-3.5`, 16px icon at `h-4 w-4`) sits inside a `flex
items-center gap-1.5` footer row between the kind-badge span and the truncated label span, directly
below a 140px preview `div` separated by only `mt-2` (8px). The invisible padding + compensating
negative margin technique keeps the handle's contribution to the flex layout at 16px (so the
surrounding row doesn't shift), but the element's actual paintable/hit-testable border-box is 44px,
extending ~14px beyond its nominal position in every direction — into the label span's box to its
right (an 8px overlap given the `gap-1.5`/6px spacing) and into the bottom edge of the preview `div`
above (a 6px overlap given the 8px `mt-2` gap). Because the drag-handle carries `@click.stop` and is
later in DOM order than the preview area (so it paints on top within that overlap), a click landing
in either overlap sliver is captured and silently discarded by the drag handle rather than reaching
the card's own `@click="emit('select', …)"` handler — a small band near the bottom of the card
preview, and a small band of the footer label, would appear clickable but do nothing. This is
exactly the category of risk 48-UI-SPEC.md flags as a `🧪 backstop` (not verifiable by
DOM/unit test — jsdom doesn't lay out real box geometry the way a browser does), so it is not
provable from source alone, but the CSS box-model arithmetic supports it and it was not addressed
by adding e.g. a `z-index`/`pointer-events` guard or reordering DOM to keep the enlarged hit area
from competing with neighbors.
**Fix:** When performing the manual/real-device verification this phase's checkpoint already
defers (48-02-PLAN.md Task 4), specifically test clicking near the boundary between the drag handle
and the footer label, and near the very bottom edge of the slide preview, to confirm card selection
still fires there. If it doesn't, consider `pointer-events: none` on the invisible padding region
(not achievable with padding alone — would need a dedicated pseudo-element or a smaller
negative-margin value that doesn't reach into siblings) or reducing the horizontal negative margin
on the side facing the label.

## Info

### IN-01: `GettingStarted.vue`'s `localStorage` access is unguarded, unlike this codebase's own established pattern for the same risk

**Disposition:** fixed (`90dadbf`) — see § Resolution.

**File:** `src/components/GettingStarted.vue:95,98`
**Issue:** `const dismissed = ref(localStorage.getItem(DISMISS_KEY) !== null)` runs synchronously in
`setup()` with no `try/catch`. If `localStorage` throws (private-browsing modes that fully disable
Web Storage, enterprise policies, some browser extensions), this throws during component setup,
which Vue would need to catch via an error boundary — absent one, it can crash the panel (or
propagate further) rather than degrading gracefully. This mirrors an existing gap in
`CollapsibleSection.vue:42` (the precedent this code intentionally follows), but the same codebase
already has a hardened pattern for exactly this failure mode in `src/stores/songs.ts:149-158,
169-187`, which wraps every `localStorage.getItem`/`setItem` call in `try { … } catch { /* ignore:
private mode / quota — degrade to in-memory only */ }`. `GettingStarted.vue` is mounted on every
Dashboard visit, so this is a wider blast radius than `CollapsibleSection`'s per-section usage.
**Fix:**
```ts
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null
  } catch {
    return false // degrade to "not dismissed" rather than crashing setup()
  }
}
const dismissed = ref(readDismissed())

function onDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, 'true')
  } catch { /* ignore: private mode / quota — degrade to in-memory only for this session */ }
  dismissed.value = true
}
```

### IN-02: `Intl.Collator` is constructed fresh on every `classifyFiles` call

**Disposition:** fixed (`af4e2c0`) — see § Resolution.

**File:** `src/components/slides/dropRouting.ts:65`
**Issue:** `new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` is allocated
inside `classifyFiles` on every invocation rather than once at module scope. This is out of scope
for this review (performance, not correctness — a drop's file list is small and this module-level
concern is explicitly deprioritized in v1), but is a trivially avoidable allocation if this
function is ever called at higher frequency in the future.
**Fix:** Hoist to module scope: `const NATURAL_ORDER_COLLATOR = new Intl.Collator(undefined, {
numeric: true, sensitivity: 'base' })`, then `images.sort((a, b) => NATURAL_ORDER_COLLATOR.compare(a.name, b.name))`.

---

_Reviewed: 2026-08-09T00:34:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
