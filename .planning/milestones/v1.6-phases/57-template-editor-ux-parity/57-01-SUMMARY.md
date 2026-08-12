---
phase: 57-template-editor-ux-parity
plan: 01
subsystem: settings / service-template editor
tags: [ui-parity, refactor, restyle, R129]
requires:
  - ServiceEditorView.vue three-rail redesign (quick task 260811-vsr)
  - kindBadgeClass, groupBySection, SERVICE_SECTIONS / SERVICE_SECTION_LABELS
provides:
  - shared kindBadgeClass helper in @/utils/slotTypes (single per-kind pill-tint source)
  - three-rail ServiceTemplateEditor rows (handle · badge · field column · ⋯ menu)
  - template-scoped per-row ⋯ menu (template-row-menu-*) owning Move-to-section + Delete
  - template-no-section-band for the ungrouped bucket
affects:
  - src/utils/slotTypes.ts
  - src/views/ServiceEditorView.vue
  - src/components/settings/ServiceTemplateEditor.vue
  - src/components/settings/__tests__/ServiceTemplateEditor.test.ts
tech-stack:
  added: []
  patterns:
    - "Share, don't fork: extract a duplicated per-kind helper to a shared util imported by both editors"
    - "Per-row ⋯ menu (single-open keyed on entry.id, fixed backdrop, absolute role=menu panel) replaces inline controls"
    - "Restyle + control-relocation with zero behavior/data change; test suite migrated in lockstep"
key-files:
  created: []
  modified:
    - src/utils/slotTypes.ts
    - src/views/ServiceEditorView.vue
    - src/components/settings/ServiceTemplateEditor.vue
    - src/components/settings/__tests__/ServiceTemplateEditor.test.ts
decisions:
  - "kindBadgeClass extracted to slotTypes.ts (beside slotLabel/miscLabel) and imported by both editors — badge tints can never fork"
  - "Template ⋯ menu is always rendered (no lock/viewer split in this editor); Save stays the only isEditor-gated action"
  - "onSectionChange(entry.id, value) / removeEntry(entry.id) reused unchanged as the menu's actions — control relocation, not a new data path"
metrics:
  tasks_completed: 3
  files_modified: 4
  completed: 2026-08-12
status: complete
---

# Phase 57 Plan 01: Template-Editor UX Parity Summary

Brought the Edit Default Template screen (`ServiceTemplateEditor.vue`) to visual/structural parity with the shipped Service Order redesign: three-rail rows (drag handle · shared-helper per-kind colored badge · stacked field column · per-row ⋯ menu), a muted/dashed "No Section" band, and mobile stacking — a pure restyle + control-relocation with zero behavior or data change (R129).

## What shipped

**Task 1 — shared `kindBadgeClass` (commit `49135fd`)**
Extracted the per-kind badge-tint switch verbatim from `ServiceEditorView.vue` into an exported `kindBadgeClass(kind: SlotKind)` in `src/utils/slotTypes.ts` (beside `slotLabel`/`miscLabel`), then deleted the local copy in the service editor and imported the shared version. Byte-identical class strings — the service editor's existing `slot-badge`/`kindBadgeClass` tests passed with no test change (279/279).

**Task 2 — three-rail rows + per-row ⋯ menu (commit `162f967`)**
Restructured the template row into: Zone 1 drag handle (unchanged) · Zone 2 new badge rail (`flex-none sm:w-32`, one pill `:class="kindBadgeClass(entry.kind)"` / text `kindLabel(entry.kind)`, testid `template-item-badge-<id>`) · Zone 3 field column (`flex-1 min-w-0 flex flex-col gap-2`, all existing inputs/testids untouched) · Zone 4 per-row ⋯ menu (`template-row-menu-*`, single-open keyed on `entry.id`, fixed backdrop + absolute `role="menu"` panel). The menu owns Move-to-section (→ `onSectionChange`) and Delete (→ `removeEntry`); the inline `template-section-select` and inline `template-item-remove` are removed. Row wrapper switched to `flex flex-col sm:flex-row sm:items-start gap-2` for mobile stacking. Added `openRowMenuId` ref + `toggleRowMenu`. Migrated the test suite off the retired testids to new menu helpers (`openRowMenuByIndex`/`moveViaRowMenu`/`deleteViaRowMenu`) and added badge + single-open/backdrop cases (35/35).

**Task 3 — No-Section band (commit `656e842`)**
Added `template-no-section-band` (muted/dashed, "No Section", no count/add control) as a sibling of the ungrouped list container, rendered only when the ungrouped bucket is non-empty and distinct from the real `template-section-header-*` headers. Confirmed Task 2's mobile stacking. Added two band tests (present when ungrouped non-empty; absent when all sectioned) (37/37).

## Verification

- **Type gate:** `npm run type-check` (vue-tsc --build) — clean after every task.
- **App suite:** `npx vitest run --dir src --exclude '**/rules.test.ts'` — 97 files pass, exactly 2 fail: `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts`. Both are the documented known-failing baseline (Firestore-emulator cross-service limitation; stale RosterView assertion) — neither touches this phase's files and neither is a regression.
- **Focused suites:** `ServiceEditorView.test.ts` 279/279 (badge/kindBadgeClass unchanged); `ServiceTemplateEditor.test.ts` 37/37.

## Deviations from Plan

None — plan executed as written. Test migration stayed within the tests named in the plan (the section/remove/aria/draft-cloning/reorder/cross-section cases) plus the plan-requested badge and No-Section-band additions; no extra tests needed migrating.

## Threat surface

No new surface beyond the plan's `<threat_model>`. T-57-01 mitigation upheld: all displayed text remains auto-escaped Vue bindings (`{{ }}` / `kindLabel(...)` / `SERVICE_SECTION_LABELS` constants); no `v-html` introduced. T-57-02: menu actions mutate only the local `draft`; Save stays `authStore.isEditor`-gated. No dependencies added (T-57-03).

## Deferred

Owner visual/feel + ~390px mobile pass is DEFERRED under the v1.6 standing grant — appended to `.planning/PENDING-VERIFICATION.md` (Phase 57 section). NOT self-approved. No deploys. STATE/progress/milestone lifecycle left to the orchestrator per `--no-transition`.

## Self-Check: PASSED

All four modified files and the SUMMARY exist on disk; all three task commits (`49135fd`, `162f967`, `656e842`) are present in git history.
