---
task: stage-layout-print
date: 2026-09-01
status: complete
commit: pending
---

# Summary — Printable, legible Stage Layout

All six requirements implemented and verified.

## Changes

- **`StageRoom.vue`** — new `print` prop: stage platform rendered as a black OUTLINE (no
  fill), black labels at larger sizes, hollow audience seats, white ground. On-screen
  behaviour unchanged.
- **`StageMarkerChip.vue`** — new `print` prop (B&W tile: white + black outline, larger
  black type). On-screen tile fonts bumped for a11y (type caption 9.5→10.5px, notes/person
  10→10.5/11px, tile widened 92→100px).
- **`StageLayoutView.vue`** — passes `print` through to room + tiles.
- **`StageLayoutPrintDocument.vue`** (new) — hidden-on-screen, `print:block` LANDSCAPE B&W
  sheet: header (service name + long-form date) + outline diagram + a large marker list
  grouped On stage / Off stage (Type — Name — Note).
- **`ServiceEditorView.vue`** — `stagePrintMode` + `printStageLayout()` (injects a
  temporary `@page { size: landscape }`, swaps the portrait `ServicePrintLayout` out for
  the stage sheet, cleans up on `afterprint` with a 2s fallback). "Print for tech" button
  lives in the top button cluster beside **Mark as Planned** (shown only on the Stage
  Layout tab, `v-if="activeTab === 'stage'"`), **not** gated on `canEditService` so it
  works on a locked/planned service.

## Owner follow-ups (same day)

- Audience chairs removed from the PRINT version (`StageRoom` renders no seat rows when
  `print`; the "Audience" label stays for orientation).
- Print button moved up into the top cluster with Mark as Planned (was a standalone button
  in the tab panel).

## Tests

- `ServiceEditorView.stage.test.ts` — 2 new tests: the print button calls `window.print()`;
  it's present + working on a `planned` (locked) service. (12/12 pass.)
- `npm run type-check` clean; stage + print-consumer suites green.

## Note

These changes are part of the same still-uncommitted stage-layout feature line from this
session (redesign + refinements + save-status relocation). Commit pending owner direction
on how to bundle; STATE.md Quick Tasks row + commit hash to be filled in on commit.
