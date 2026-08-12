---
phase: 55-preview-export-polish
plan: 02
subsystem: service-editor
tags: [planning-center, export, spinner, ux, R125]
requires: []
provides:
  - "The Planning Center Confirm Export button shows a visible animate-spin spinner while an export is in progress"
affects:
  - src/views/ServiceEditorView.vue
tech-stack:
  added: []
  patterns:
    - "Presentation-only affordance reusing the existing isExporting flag + :disabled guard — no new reactive state"
    - "Reused the app's established animate-spin ring glyph (VolunteerCsvImportModal) sized down for an inline button"
key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
decisions:
  - "R125 implemented by reusing the EXISTING isExporting ref and its :disabled guard — no second export-state flag (a duplicate flag risks the two disagreeing)"
  - "Spinner placed on the Confirm Export button only (the long PC round-trip), NOT the fast dialog-open which already shows 'Loading options...'"
  - "R125 tests leave a draft service in mockServicesList (Rule 1 hermetics fix) so the following Roles-tab describe — whose mountView reuses the last mockServicesList — is not handed a locked service"
metrics:
  duration: ~25m
  completed: 2026-08-11
  tasks: 2
  files_changed: 2
status: complete
---

# Phase 55 Plan 02: R125 — Planning Center Export In-Progress Spinner Summary

Added a visible `animate-spin` ring glyph to the Planning Center Confirm Export button, shown only while the already-wired `isExporting` flag is true — a presentation-only change that reuses the app's established spinner affordance and the existing `:disabled` guard, with no new reactive state introduced.

## What Was Built

**Task 1 (RED, test-first):** Added a new `describe` block to `ServiceEditorView.test.ts` (with its own `teleport: false` mountView, since the export dialog is a `<Teleport to="body">`). The tests drive the component into the "options loaded, export running" state by setting the existing `showExportDialog` / `exportLoading` / `exportSelectedServiceTypeId` / `isExporting` reactive flags directly (the same vm-level approach the file's WR-02 export tests use), then assert against `document.body` via `DOMWrapper` that `[data-testid="export-spinner"]` is present and carries the `animate-spin` class while exporting, and that the Confirm Export button (its "Exporting..." label) stays `disabled`. A complementary case asserts the spinner is absent when `isExporting` is false. Ran RED — failing on the missing glyph as expected; the absent-case passed.

**Task 2 (GREEN):** Inside the Confirm Export button (ServiceEditorView.vue :495-500), rendered an inline `<span>` shown via `v-if="isExporting"`, immediately before the existing `{{ isExporting ? 'Exporting...' : ... }}` label. It mirrors the `rounded-full animate-spin` ring from `VolunteerCsvImportModal.vue:99`, sized down for an inline button glyph (`h-4 w-4 border-2 border-white/70 border-t-transparent`) so it reads on the indigo button, and carries `data-testid="export-spinner"` + `aria-hidden="true"`. The button's class list gained `inline-flex items-center justify-center gap-2` so the glyph sits beside the label. The existing `isExporting` ref, the `:disabled="isExporting || !exportSelectedServiceTypeId"` guard, and the store-status re-check in `onConfirmExport` were left untouched — no new flag or guard.

## How to Verify

- `npm run type-check` (vue-tsc --build) — clean.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 267 passed (includes the 2 new R125 tests).
- Broad `npx vitest run --dir src --exclude '**/rules.test.ts'` — only the known 2-file baseline fails (`src/storage.rules.test.ts` 12 = no Storage emulator; `src/views/__tests__/RosterView.test.ts` 1 = stale assertion). No regression beyond baseline; ServiceEditorView fully green.
- Manual (deferred to `.planning/PENDING-VERIFICATION.md` under the v1.6 autonomy grant, owner away): trigger a real Planning Center export and confirm the Confirm Export button shows a spinner and stays disabled until the export completes or fails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] R125 tests leaked a locked (`planned`) service into the Roles-tab describe**
- **Found during:** Task 2 (full-file test run, after the two new tests passed in isolation)
- **Issue:** The new R125 mountView initially set `mockServicesList = [{ ...mockService, status: 'planned' }]`. The `ServiceEditorView - Roles tab (Phase 17-04)` describe that follows has a `mountView()` which does **not** set `mockServicesList` — it reuses whatever the previous describe left. A leaked `planned` (locked) service hid the editable role-override checkboxes, so two Roles tests ("override control (checkbox picker) appears", "rapid toggles ... (WR-02)") failed only in the full-file run. Baseline (before this plan) was fully green because the preceding describe left a `draft` service.
- **Fix:** Changed the R125 mountView calls to leave a `draft` service (the `mockService` default, matching what baseline left). The status is irrelevant to the R125 assertions because they set the export state via vm flags directly. Added an explanatory comment at the mount site.
- **Files modified:** src/views/__tests__/ServiceEditorView.test.ts
- **Commit:** 0ca6571

## Threat Surface

No new security-relevant surface. The plan's single accepted threat (T-55-02, duplicate export / double-fire) is unchanged: the existing `:disabled="isExporting || !exportSelectedServiceTypeId"` guard plus the store-status re-check in `onConfirmExport` are preserved verbatim — this change only adds a presentational glyph and a layout class. A test asserts the button remains `disabled` while exporting.

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue (export-spinner glyph present, count 1)
- FOUND: src/views/__tests__/ServiceEditorView.test.ts (R125 describe present)
- FOUND commit 2cf0aa7 (Task 1 RED test)
- FOUND commit 0ca6571 (Task 2 GREEN implementation + hermetics fix)
