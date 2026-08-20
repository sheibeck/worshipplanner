---
phase: 71-cleanup-deletion-toggle-safety
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - functions/src/index.ts
  - src/components/admin/CleanupConfigCard.vue
  - src/components/admin/CleanupEnableConfirmDialog.vue
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 71: Code Review Report

**Reviewed:** 2026-08-20
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The server-side half of this phase (`functions/src/index.ts`) is clean. The four cleanup handlers
gained exactly the one-line `forceDryRun`-first ternary the research/plan prescribed — verified
against the actual commit diff (`418094c4`), which touches nothing else in any of the four handler
bodies (the `referencesComplete`/floor-guard/`effectiveDryRun` block in
`cleanupOrphanBackgroundsHandler` is byte-for-byte untouched, satisfying R190). `previewCleanupDryRun`
correctly re-verifies the caller with the two-check super-admin pattern, validates `type` against a
fixed allow-list, uses the exact per-type field mapping the research flagged as the dangerous part
(`orphanCount` for backgrounds, not `deletedObjectCount`), and asserts `s.dryRun === true` as a
belt-and-suspenders check before returning. The functions-side unit tests include a load-bearing case
proving the preview never deletes even when `getAppConfig` is mocked cleanup-enabled — this is solid,
well-tested code.

The client side (`CleanupConfigCard.vue`) also gets the write-gating right: the checkbox never has a
change handler, the enable write only happens from `onDialogConfirm`, and Disable is a direct
`saveField(..., false)` with no preview, matching R189.

The one genuine defect is in `CleanupEnableConfirmDialog.vue`: the UI-SPEC's own state table requires
"Cancel also disabled (prevents closing mid-write)" during the `enabling` state, and the Cancel
*button* does honor that (`:disabled="confirming"`) — but the backdrop click, the panel's
`@click.self`, and the Escape keydown handler all call `onCancel()` unconditionally, without checking
`confirming`. A user can dismiss the dialog while the `saveField` write is still in flight; the write
is not aborted, so the flag can flip to enabled (or the error can be silently swallowed) after the
user believes they cancelled. Given the entire purpose of this phase is giving the owner confident,
visible control over enabling a deletion sweep, this undermines that guarantee and is not covered by
either test file. There is also a secondary accessibility gap: the UI-SPEC's "on close, focus returns
to the row's Enable button that opened the dialog" requirement is not implemented at all — neither
component tracks or restores the triggering element's focus.

## Critical Issues

### CR-01: Backdrop click and Escape bypass the "Cancel disabled while confirming" safety rule, allowing the enable write to complete silently after an apparent cancel

**File:** `src/components/admin/CleanupEnableConfirmDialog.vue:12-16, 28-32, 187-192`
**Issue:**
`71-UI-SPEC.md`'s state table is explicit for the `enabling` state: *"Confirm → `Enabling…`, disabled;
**Cancel also disabled (prevents closing mid-write)**."* The Cancel `<button>` element does honor this
(`:disabled="confirming"` at line 72), but three other paths that also call `onCancel()` do not check
`confirming` at all:

```
12  <div
13    v-if="open"
14    class="fixed inset-0 z-40 bg-black/60"
15    @click="onCancel"          <!-- no confirming guard -->
16  ></div>
...
28  <div
29    v-if="open"
30    class="fixed inset-0 z-50 flex items-center justify-center p-4"
31    @click.self="onCancel"     <!-- no confirming guard -->
32  >
...
187 function onKeydown(event: KeyboardEvent): void {
188   if (event.key === 'Escape') {
189     event.preventDefault()
190     onCancel()                <!-- no confirming guard -->
191     return
192   }
```

`onCancel()` unconditionally `emit('cancel')`s, and the parent's handler
(`CleanupConfigCard.vue:327-330`) unconditionally nulls the dialog state:

```ts
function onDialogCancel(): void {
  activeDialog.value = null
  confirmError.value = null
}
```

Meanwhile `onDialogConfirm` (`CleanupConfigCard.vue:306-325`) captured `type` into a local `const`
before its `await store.saveField(...)` call, so the in-flight write is **not aborted** by the dialog
closing — it keeps running:

```ts
async function onDialogConfirm(): Promise<void> {
  if (!activeDialog.value) return
  const { type } = activeDialog.value   // captured before the closing race
  confirming.value = true
  confirmError.value = null
  try {
    await store.saveField(`cleanup.${configFieldFor(type)}`, true)
    activeDialog.value = null
    ...
```

**Concrete failure scenario:** Super-admin clicks Enable → dialog shows "delete up to 47 objects... on
the next scheduled run" → clicks the destructive Confirm → while the Firestore write is in flight
(network latency, or the user has second thoughts), the admin presses **Escape** or clicks the
backdrop, believing this cancels the action (this is standard modal muscle-memory, and the UI-SPEC
itself blesses Escape as "identical to clicking Cancel"). The dialog closes immediately. The
`saveField` write is still running and, when it resolves, `cleanup.mediaEnabled` is set to `true` in
Firestore — arming real deletion on the next cron run — with **no visible confirmation** the admin
ever agreed to it after their apparent cancel. If the write instead fails, `confirmError.value` is set
on a ref that no longer renders anywhere (`activeDialog.value` is already `null`, so the dialog is
unmounted) — the failure is silently swallowed with no user-visible signal at all.

Neither `CleanupEnableConfirmDialog.test.ts`'s Escape test nor `CleanupConfigCard.test.ts`'s Cancel
test exercises this with `confirming: true`, so nothing currently catches it.

**Fix:** Gate all three cancel paths on `confirming`, mirroring the button's own guard:
```ts
function onCancel(): void {
  if (props.confirming) return
  emit('cancel')
}
```
and drop the `@click`/`@click.self` handlers to a no-op (or add `v-if="!confirming"` styling) while a
write is in flight, so the modal is genuinely un-dismissible during `enabling`, matching the UI-SPEC's
explicit requirement instead of only the button element honoring it.

## Warnings

### WR-01: Focus is never restored to the triggering Enable button when the dialog closes

**File:** `src/components/admin/CleanupEnableConfirmDialog.vue:164-173`
**Issue:** `71-UI-SPEC.md`'s Accessibility section states: *"on close, focus returns to the row's
`Enable` button that opened the dialog."* The only focus-management code in the component is:
```ts
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void nextTick(() => {
        cancelButtonRef.value?.focus()
      })
    }
  },
)
```
There is no `else` branch, and `CleanupConfigCard.vue` never captures a reference to the row's Enable
button or restores focus to it after `activeDialog.value = null`. When the dialog unmounts
(`v-if="open"` on the panel), focus silently falls back to `document.body`, forcing a keyboard-only
user to re-navigate the page from the top instead of landing back where they were. This is untested
(`CleanupEnableConfirmDialog.test.ts` only asserts focus-on-open, not focus-on-close).
**Fix:** Have `CleanupConfigCard.vue` pass a ref/callback for "the button that opened this dialog" (or
track the last-focused element before `nextTick` inside the dialog itself via
`document.activeElement` at open time) and call `.focus()` on it once `open` transitions to `false`.

## Info

### IN-01: Hard-blocked Confirm button is always red, even when `wouldDeleteCount === 0`

**File:** `src/components/admin/CleanupEnableConfirmDialog.vue:78-85`
**Issue:** `71-UI-SPEC.md`'s Danger/Warning table reserves the red/destructive treatment for the
Confirm button "ONLY when `wouldDeleteCount > 0`", with indigo used otherwise so the color doesn't
over-warn. The `isBlocked` variant of the Confirm button is hardcoded `bg-red-600` regardless of
`wouldDeleteCount`:
```html
<button v-if="isBlocked" type="button" disabled
  class="... bg-red-600 opacity-60 cursor-not-allowed ...">
  Enable
</button>
```
So a backgrounds preview that returns `wouldDeleteCount: 0` together with `referencesComplete: false`
(a scan failure before any orphan was tallied) renders a red button, contradicting the spec's own
count-driven color rule. Low impact since the button is disabled either way, but worth aligning if the
spec's color rule is meant to be followed exactly.
**Fix:** Reuse the `isDestructive` computed for the blocked button's fill too, e.g.
`:class="isDestructive ? 'bg-red-600' : 'bg-indigo-600'"`, or intentionally document that "blocked"
always renders red regardless of count (in which case update the UI-SPEC to say so).

---

_Reviewed: 2026-08-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
