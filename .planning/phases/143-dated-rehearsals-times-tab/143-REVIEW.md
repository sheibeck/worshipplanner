---
phase: 143-dated-rehearsals-times-tab
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - docs/adr/0245-rehearsals-are-always-dated-defaults-prefill-the-add-form.md
  - docs/adr/README.md
  - src/components/ServiceTimesPanel.vue
  - src/components/__tests__/ServiceCard.test.ts
  - src/components/__tests__/ServiceTimesPanel.test.ts
  - src/stores/__tests__/services.rehearsalDefaults.test.ts
  - src/stores/services.ts
  - src/types/organization.ts
  - src/utils/__tests__/rehearsalTimes.test.ts
  - src/utils/rehearsalTimes.ts
  - src/views/ServiceEditorView.vue
  - src/views/SettingsView.vue
  - src/views/__tests__/DashboardView.rehearsalTimes.test.ts
  - src/views/__tests__/MyScheduleView.test.ts
  - src/views/__tests__/ServiceEditorView.stage.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/views/__tests__/ServiceEditorView.timesSection.test.ts
  - src/views/__tests__/SettingsView.test.ts
  - src/views/__tests__/ShareView.test.ts
  - src/views/__tests__/VolunteerServiceView.test.ts
  - src/views/serviceEditorActionBar.ts
  - src/views/__tests__/serviceEditorActionBar.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: clean
---

# Phase 143: Code Review Report (iteration 2)

**Reviewed:** 2026-10-27
**Depth:** standard
**Files Reviewed:** 22
**Status:** clean (no critical or warning findings; 3 info items remain)

## Summary

This pass re-reviewed the phase after the iteration-1 fixes (d1910d89 for WR-01, 716aea7a for WR-02). I traced each fix and the code it touches. I also evaluated the skipped WR-03.

**WR-01 (resolved).** `YMD_RE` and `HM_RE` now have a single definition in `src/utils/rehearsalTimes.ts`. The panel and `ServiceEditorView.vue` both import them.
- Add path: `canAdd` requires both patterns, so a malformed date can never reach `emit('add')`. `onSubmitAdd` re-checks `canAdd`, so a form submit by Enter is covered too.
- Edit path: `onFieldChange` handles three cases in order.
  - A cleared value on a dated row is forced back to the stored value, with the existing "needs a date" message.
  - A cleared value on an already-empty legacy row returns silently.
  - A malformed non-empty value forces `el.value` back and shows the "not valid" message. This also works for a legacy empty row, where `current` is `''`.
- Parent guards: `onRehearsalDateChange` and `onRehearsalTimeChange` use the same regexes, so the panel and parent can no longer disagree.
- Regex precedence: in `newDate === '' ? rehearsal.date !== '' : !YMD_RE.test(newDate)`, the ternary binds correctly. An empty value is only allowed through for a row that is already empty.
- Year cap: `max="9999-12-31"` on both date inputs stops the 5-6 digit year at the source in Chrome.
- Tests: the three new panel tests cover the malformed edit, the malformed add, and the `max` attribute.

**WR-02 (resolved).**
- Save: `onSaveRehearsalDefaults` de-duplicates with `[...new Set(filter(...))]`. Order is preserved, and the local input list is reset to the de-duplicated array after a successful save.
- Panel: `chipTimes` is a de-duplicated computed, and the chip row is gated on `chipTimes.length > 1`. This covers legacy duplicates that are already saved. The `:key="t"` values are now unique.
- Tests: both are covered.

**WR-03 (skip rationale accepted).** The fixer's reasoning holds.
- The Remove button lives only inside the `v-else` branch of `v-if="!canEdit"`, and the add form with its date input is mounted in that same branch. The prop that gates both is the same value as the parent's `canEditService`.
- The only way for focus to be lost is the lock flipping between the click and the re-render. In that case the whole editable branch unmounts, and no alternative focus target in this component would survive.
- `nextTick(() => newDateInput.value?.focus())` is null-safe.
- Making it correct would need a new focusable root or a parent-owned ref, which is disproportionate for a transient edge case. I am not re-raising it.

I found no new bugs, security issues, or regressions in the changed hunks. The read-only branch is still a bare `v-if="!canEdit"`, and every parent handler still re-checks `canEditService`. The `serviceEditorActionBar` and store changes are unchanged since the previous pass.

## Info

### IN-01: Attention dot gated on `authStore.isEditor`, not `canEditService` (carried over, unchanged)

**File:** `src/views/ServiceEditorView.vue:837`
**Issue:** On a locked service, an editor still sees the "needs attention" indicator for legacy undated rows. The panel is read-only there and hides those rows, so the indicator points at nothing actionable.
**Fix:** Gate on `canEditService && hasNonDisplayableRehearsal`, or record the current behavior in ADR-0245.

### IN-02: Dynamically inserted `role="status"` message may not be announced (carried over, unchanged)

**File:** `src/components/ServiceTimesPanel.vue:243-258`
**Issue:** Some screen readers announce a live region inserted already populated unreliably. The reject-clear and invalid-value explanations may therefore not reach those users.
**Fix:** Keep a persistent `role="status"` container per row (or one per panel) and update only its text.

### IN-03: Misleading test name and dead `:disabled="!canEdit"` bindings (partly carried over)

**File:** `src/stores/__tests__/services.rehearsalDefaults.test.ts` (~100-120); `src/components/ServiceTimesPanel.vue:185,218,227,235`
**Issue:**
- With `rehearsals` always `[]`, the "copy-not-live-bind" test only meaningfully covers `reportTime`, but its name still implies rehearsal coverage.
- The `:disabled="!canEdit"` bindings sit inside the `v-else` (canEdit true) branch, so they are always false and are dead code. This is harmless, but it can mislead a reader into thinking a disabled editable state exists.

**Fix:** Rename the test to focus on the `reportTime` copy. Drop the redundant `:disabled` bindings, or leave them as deliberate defense in depth with a one-line note.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
