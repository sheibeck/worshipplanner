---
phase: quick/260809-vvq
plan: 01
subsystem: planning-center-export
tags: [planning-center, scripture, nlt, esv, export]
requires:
  - OrgSettings.bibleVersion (Phase 45)
  - fetchNltPassageText (src/utils/nltApi.ts)
provides:
  - version-routed scripture fetch in Planning Center export
  - PRAYER/MESSAGE/ANNOUNCEMENTS/MISC export in all three export paths
  - passage-only plan titles
affects:
  - src/utils/planningCenterApi.ts
  - src/views/ServiceEditorView.vue
tech-stack:
  patterns:
    - required (non-defaulted) param inserted mid-signature to force compiler-guided call-site updates
key-files:
  modified:
    - src/utils/planningCenterApi.ts
    - src/utils/__tests__/planningCenterApi.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/views/__tests__/hymnRetirement.regression.test.ts
decisions:
  - bibleVersion is a REQUIRED param after songs (not a trailing default) so every missed call site is a compile error
requirements:
  - A-NLT-ROUTING-AND-EMPTY-REF-GUARD
  - B-EXPORT-PRAYER-MESSAGE-ANNOUNCEMENTS-MISC
  - C-PLAN-TITLE-PASSAGE-ONLY
metrics:
  duration: ~35m
  completed: 2026-08-09
status: complete
---

# Quick 260809-vvq: Planning Center Export — NLT routing, all slot types, passage-only title Summary

Version-routed the Planning Center scripture export (NLT vs ESV) with an empty-reference guard, stopped dropping PRAYER/MESSAGE/ANNOUNCEMENTS/MISC slots in the existing-plan and new-plan-with-template export paths, and reduced generated plan titles to the sermon passage only.

## What changed per task

### Task 1 — `planningCenterApi.ts` (commit d97ea02)
- Added `import { fetchNltPassageText } from '@/utils/nltApi'`.
- `addSlotAsItem` gained a **required** `bibleVersion: 'ESV' | 'NLT'` parameter, inserted immediately after `songs` (before the optional `sermonPassage?`). Because it is required and not trailing, TypeScript flags every un-updated call site.
- SCRIPTURE branch now routes: `fetchNltPassageText(refText)` when `bibleVersion === 'NLT'`, else `fetchPassageText(refText)`. When `refText` is empty (unresolvable reference) **neither** fetch fires — the empty-query HTTP 400 is eliminated — and the item is still created with no `html_details`. The surrounding try/catch still swallows fetch errors.
- `buildPlanTitle` now returns the sermon passage only (teams suffix removed); its `Pick` narrowed to `'sermonPassage' | 'name'`. Fallbacks (trimmed name, then `'Service'`) unchanged.
- Tests: added an `nltApi` mock; reset both fetch mocks in `beforeEach`; inserted `'ESV'` into all 35 existing `addSlotAsItem` calls; added NLT-routing, ESV-routing, empty-ref-skip (ESV+NLT) tests; rewrote the `buildPlanTitle` block to assert passage-only output with teams present.

### Task 2 — `ServiceEditorView.vue` (commit 8c602bc)
- All 9 `addSlotAsItem` call sites in `onConfirmExport` now pass `authStore.settings.bibleVersion` after `songStore.songs`.
- Added an `otherSlots` bucket (`PRAYER | MESSAGE | ANNOUNCEMENTS | MISC`, service order preserved by `.filter`; IMPORTED excluded).
- Existing-plan branch: added a sixth pass appending `otherSlots` at the running `sequence`, with the same per-slot try/catch that pushes `slot.kind` as the failure label.
- New-plan-with-template branch: added the same append pass. No-template branch was already correct (unchanged).
- `NON_SCRIPTURE_REGULAR_TITLES` extended to `['message', 'prayer', 'announcements', 'miscellaneous']`.
- Tests: extended the mock `settings` type/default with `bibleVersion: 'NLT'`; added a 7-kind fixture and three tests (new-plan no-template, new-plan with-template, existing-plan) asserting the four kinds are exported, IMPORTED never is, and `bibleVersion` is threaded on every call.

## Gate outcomes
- `npm run type-check` (vue-tsc --build): **clean** (0 errors).
- `npx vitest run src/utils/__tests__/planningCenterApi.test.ts`: **115/115 passed**.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts`: **260/260 passed**.
- Full app suite scoped to `src` (`npx vitest run --dir src --exclude '**/rules.test.ts'`): **2972 tests, 13 failing — all inside the documented 2-file baseline** (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`). No new failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `hymnRetirement.regression.test.ts` for the new required param**
- **Found during:** Task 2 type-check gate.
- **Issue:** Making `bibleVersion` a required parameter broke 5 `addSlotAsItem` calls in `src/views/__tests__/hymnRetirement.regression.test.ts` (TS2554, 8-10 args expected, 7 given). This file was not in the plan's `files_modified` but is a direct caller.
- **Fix:** Inserted `'ESV'` after the songs argument in all 5 calls (behavior-neutral for the HYMN cases exercised there).
- **Commit:** 8c602bc.

## Notes on the full-suite command
Bare `npx vitest run` (vitest default glob, no `include` set in `vite.config.ts`) additionally sweeps in `render-service/src/render.test.ts`, which fails at import time on the documented root-vitest-4.0.18-vs-workspace-4.1.10 mismatch. It is a separate Cloud Run workspace with zero overlap with the changed files and is a pre-existing tooling artifact, not a regression. Scoping to `--dir src` isolates the app suite to the true 2-file baseline (confirmed above).

## Self-Check: PASSED
- Files verified present: `src/utils/planningCenterApi.ts`, `src/views/ServiceEditorView.vue`, both test files, `hymnRetirement.regression.test.ts`.
- Commits verified: d97ea02 (Task 1), 8c602bc (Task 2).
