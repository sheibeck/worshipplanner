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
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 143: Code Review Report

**Reviewed:** 2026-10-27
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The phase swaps the seeded-undated-row model for an add-form-only model. It adds `ServiceTimesPanel.vue`, a Times tab, parent-side handler guards, and the `createService` change to `rehearsals: []`. The core invariants hold. Read-only surfaces still go through the unchanged `isDisplayableRehearsal` filter. The read-only branch of the panel is a bare `v-if="!canEdit"`, so the editable branch can never render for a viewer. Every parent handler re-checks `canEditService`. The `createService` change cannot leak undated rows. The autosave payload and its post-save snapshot comparison already mirror `rehearsals`/`reportTime`, so `isDirty` does not strand.

No blockers. The three warnings are all input-validation edge cases at the panel/parent boundary, plus one duplicate-key case.

## Warnings

### WR-01: Parent regex guards silently drop values the panel accepts (6-digit year typo loses the rehearsal or desyncs the DOM)

**File:** `src/views/ServiceEditorView.vue:2759-2795` (guards), `src/components/ServiceTimesPanel.vue:69-82,103-116`
**Issue:** The panel treats any non-empty `<input type=date>` value as valid. The parent then applies `YMD_RE = /^\d{4}-\d{2}-\d{2}$/` and silently returns on a mismatch. Chrome lets a user keep typing digits into the year segment, up to 6 digits, so a typo such as year `20266` yields the value `20266-01-01`. That value fails the regex. Two outcomes follow:
- **Add path:** `onSubmitAdd` emits, the parent drops the row without a message, and the panel then clears `newDate`, resets the time and refocuses. The planner sees the form reset as if the add succeeded, and no row appears. This is silent data loss.
- **Edit path:** `onFieldChange` emits `date-change`, the parent rejects it, and the model keeps the old date. The native input keeps showing the rejected value, because Vue does not repaint an unchanged one-way binding. The panel's own revert-forcing exists for exactly this case, but it only covers the `''` case. The DOM and the state then disagree, and the planner believes the new date was saved.

**Fix:** Validate in the panel with the same patterns as the parent, so the reject-clear and revert UX also covers malformed values. Share the regexes from `rehearsalTimes.ts`.
```ts
// rehearsalTimes.ts
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
export const HM_RE = /^\d{2}:\d{2}$/

// ServiceTimesPanel.vue
const canAdd = computed(() => props.canEdit && YMD_RE.test(newDate.value) && HM_RE.test(newTime.value))
// onFieldChange: treat a non-matching, non-empty value like the '' case
const valid = field === 'date' ? YMD_RE.test(next) : HM_RE.test(next)
if (next !== '' && !valid && current !== '') { el.value = current; showRevert(row.id, field); return }
```
Also add `max="9999-12-31"` to the date inputs. The two guard sites then share one definition.

### WR-02: Duplicate org default times produce duplicate `:key` values and two "pressed" chips

**File:** `src/components/ServiceTimesPanel.vue:289-302`, `src/views/SettingsView.vue:1352`
**Issue:** The Settings save only filters out `''` entries (`rehearsalTimeDefaultsInput.value.filter((t) => t !== '')`), so `['18:30','18:30']` persists. The panel then renders chips with `:key="t"`, which duplicates the key. Vue warns, patching is unreliable, and both chips show `aria-pressed=true`.
**Fix:** De-duplicate when saving in SettingsView (`[...new Set(...)]`), and defensively in the panel (`const chips = computed(() => [...new Set(props.defaultTimes)])`, rendered with `chips.length > 1`).

### WR-03: Panel row removal and field edits have no guard against a stale `canEdit` flip while the revert timer is live (minor), and Remove steals focus unconditionally

**File:** `src/components/ServiceTimesPanel.vue:122-125`
**Issue:** `onRemove` always calls `focusAddDate()`, even when the emit was a no-op in the parent (service just locked, so `canEditService` is false and the add form has been unmounted by the `v-if`). `nextTick(() => newDateInput.value?.focus())` is null-safe, so nothing crashes. A keyboard user is left with focus dropped to `<body>` after the editable branch unmounts. This is a minor a11y and robustness issue rather than a crash.
**Fix:** Only move focus when the add input is still mounted. The optional chain already covers the null case, so the practical fix is to focus the next remaining row's control (or the tab button) when the add form is gone. Low priority.

## Info

### IN-01: Attention dot is gated on `authStore.isEditor`, not `canEditService`

**File:** `src/views/ServiceEditorView.vue:~842`
**Issue:** On a locked service, an editor sees the amber "needs attention" dot for legacy undated rows. The panel is read-only there and hides those rows, so the dot points at nothing actionable.
**Fix:** Gate on `canEditService && hasNonDisplayableRehearsal`, or accept the current behavior and document it in ADR-0245.

### IN-02: Dynamically inserted `role="status"` revert message may not be announced

**File:** `src/components/ServiceTimesPanel.vue:232-243`
**Issue:** A live region that is inserted into the DOM already populated is announced unreliably by some screen readers. The reject-clear explanation therefore may not reach those users.
**Fix:** Keep a persistent `<p role="status" class="sr-only">` container per panel and update its text, or use `aria-live="polite"` on a stable wrapper.

### IN-03: `services.rehearsalDefaults.test.ts` second case no longer tests rehearsal copy independence

**File:** `src/stores/__tests__/services.rehearsalDefaults.test.ts:~100-120`
**Issue:** With `rehearsals` now always `[]`, the "copy-not-live-bind ... byte-identical" test asserts `[]` equals `[]` for rehearsals. Only the `reportTime` half remains meaningful. The test name still implies rehearsal coverage.
**Fix:** Rename it to focus on the `reportTime` copy. Optionally add an assertion that mutating `rehearsalTimeDefaults` afterward does not change the already-created payload's `rehearsals` (still `[]`).

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
