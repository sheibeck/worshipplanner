---
phase: 143-dated-rehearsals-times-tab
fixed_at: 2026-10-27T12:00:00Z
review_path: .planning/phases/143-dated-rehearsals-times-tab/143-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 143: Code Review Fix Report

**Fixed at:** 2026-10-27
**Source review:** .planning/phases/143-dated-rehearsals-times-tab/143-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 2
- Skipped: 1

## Fixed Issues

### WR-01: Parent regex guards silently drop values the panel accepts

**Files modified:** `src/utils/rehearsalTimes.ts`, `src/components/ServiceTimesPanel.vue`, `src/views/ServiceEditorView.vue`, `src/components/__tests__/ServiceTimesPanel.test.ts`
**Commit:** d1910d89
**Applied fix:** `YMD_RE`/`HM_RE` now live in `rehearsalTimes.ts` and are imported by both the panel and `ServiceEditorView.vue` (the duplicate local definitions were removed). The panel's `canAdd` requires both patterns, so a malformed add-form date keeps Add disabled. `onFieldChange` treats any non-empty value that fails the pattern like the cleared case: the input is forced back to the stored value and a status message ("That date is not valid. Use a four-digit year." / "That time is not valid.") shows, with nothing emitted. Both date inputs gained `max="9999-12-31"` to stop 5-6 digit years at the source. Three new panel tests cover the malformed edit, the malformed add, and the `max` attribute.

### WR-02: Duplicate org default times produce duplicate `:key` values and two "pressed" chips

**Files modified:** `src/views/SettingsView.vue`, `src/components/ServiceTimesPanel.vue`, `src/components/__tests__/ServiceTimesPanel.test.ts`, `src/views/__tests__/SettingsView.test.ts`
**Commit:** 716aea7a
**Applied fix:** `onSaveRehearsalDefaults` now de-duplicates with `[...new Set(...)]` after dropping blanks. The panel renders chips from a `chipTimes` computed (de-duplicated) and gates the chip row on `chipTimes.length > 1`, so legacy already-saved duplicates are also handled. New tests: panel collapses `['18:30','18:30','19:00']` to two chips with one pressed; `['18:30','18:30']` shows no chips; the Settings save call receives `['18:30','19:00']`.

## Skipped Issues

### WR-03: Remove steals focus unconditionally / stale `canEdit` flip

**File:** `src/components/ServiceTimesPanel.vue:122-125`
**Reason:** Not actionable as a code change. The review itself rates it low priority and notes the optional chain already makes the focus call null-safe. In practice the Remove button is only reachable while `canEdit` is true, which is exactly when the add form (and its date input) is mounted, so the focus call lands correctly. If the lock flips afterwards, the add input unmounts and focus drops regardless of what `onRemove` did. A fallback focus target would need a new focusable root or a parent-owned tab button ref, which is out of scope for a warning-level fix. Left unchanged.
**Original issue:** `onRemove` always calls `focusAddDate()`, even if the parent emit was a no-op because the service just locked.

## Verification

- `npx vitest run` on `ServiceTimesPanel.test.ts`, `ServiceEditorView.timesSection.test.ts`, `SettingsView.test.ts`, `rehearsalTimes.test.ts`: all passing.
- `npm run type-check` (`vue-tsc --build`): clean after each fix.
- Info findings (IN-01..03) are out of scope for `fix_scope: critical_warning`.
- Fixes were applied directly on `master` in the main working tree at the caller's instruction rather than in a separate worktree. `.planning/graphs/*` was not staged.

---

_Fixed: 2026-10-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
