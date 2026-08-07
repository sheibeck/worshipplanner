---
phase: 44-default-service-template
fixed_at: 2026-08-07T19:03:00Z
review_path: .planning/phases/44-default-service-template/44-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 44: Code Review Fix Report

**Fixed at:** 2026-08-07T19:03:00Z
**Source review:** .planning/phases/44-default-service-template/44-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `ServiceTemplateEditor.vue`'s Reset/Save controls don't disable for a non-editor

**Files modified:** `src/components/settings/ServiceTemplateEditor.vue`
**Commit:** 1c13ca4
**Applied fix:** Added `:disabled="!authStore.isEditor"` to `template-reset` (plus `disabled:opacity-60 disabled:cursor-not-allowed` classes to match the visual pattern of `template-save`), added `!authStore.isEditor` to `template-save`'s existing `isSaving` disabled binding, and added an `if (!authStore.isEditor) return` early return at the top of both `onResetClick` and `applyReset`, mirroring `onSave`'s existing guard. This matches the defense-in-depth pattern already used by `vwModeInput`/`aiEnabledInput`/`pcEnabledInput` in `SettingsView.vue`.

### WR-02: `onTemplateSortEnd` never clears `section` when an item moves into the ungrouped bucket

**Files modified:** `src/components/settings/ServiceTemplateEditor.vue`
**Commit:** a41a5a2
**Applied fix:** Added the missing `else { moved.section = undefined }` branch alongside the existing `if (toKey !== 'ungrouped') { moved.section = toKey }`, exactly as suggested in the review. This is a state-handling fix on a path not currently reachable through the UI (masked by SortableJS's `put: false` on the ungrouped container) and not directly exercised by the existing test suite — **flagging for human verification** of the corrected behavior on any future direct-`onEnd` caller.

### IN-01: `templateSummary` copy is grammatically wrong for singular counts

**Files modified:** `src/views/SettingsView.vue`, `src/views/__tests__/SettingsView.test.ts`
**Commit:** ff28dad
**Applied fix:** Replaced the unconditional `${entries.length} items across ${sectionCount} sections` template literal with conditional singular/plural word selection (`item`/`items`, `section`/`sections`) based on each count. Updated the pinned test assertion `'2 items across 1 sections'` → `'2 items across 1 section'` in `SettingsView.test.ts:438`. The other pinned assertion (`'3 items across 2 sections'`) was already grammatically correct and needed no change.

### IN-02: Per-item section `<select>` relies on `title`, not `aria-label`

**Files modified:** `src/components/settings/ServiceTemplateEditor.vue`
**Commit:** b059e96
**Applied fix:** Added `aria-label="Section"` alongside the existing `title="Section"` attribute on the section `<select>`, matching the row's drag-handle and remove-button controls which both already carry explicit `aria-label`s.

## Skipped Issues

None — all four in-scope findings were fixed.

---

## Verification Gates (run after all four fixes)

- `npm run type-check` (`vue-tsc --build`, per CLAUDE.md — the mandated gate, not the narrower `-p tsconfig.app.json` form): **0 errors**.
- `npx vitest run --dir src --exclude '**/rules.test.ts'`: **89 passed / 2 failed files** (2805 tests passed, 1 failed, 13 skipped) — the failing files are exactly the pre-existing baseline (`src/storage.rules.test.ts` — Storage-emulator cross-service-read limitation per CLAUDE.md, and `src/views/__tests__/RosterView.test.ts` — stale assertion). No new failing file was introduced; the failing-file set is unchanged from baseline.
- The two directly-touched test files (`ServiceTemplateEditor.test.ts`, `SettingsView.test.ts`) pass in full (20 + 16 tests).

---

_Fixed: 2026-08-07T19:03:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
