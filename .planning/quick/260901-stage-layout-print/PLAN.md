---
task: stage-layout-print
date: 2026-09-01
mode: quick
---

# Quick task: Printable, legible Stage Layout for the tech team

The stage layout is printed and read by a tech person setting up the stage. Make it
print-ready and legible.

## Requirements (owner)

1. **Legibility / a11y** — on-screen fonts were too small; bump for readability.
2. **Print button** — add a way to print just the stage layout.
3. **Landscape** — the printed sheet is landscape.
4. **Black & white** — no colour on the print.
5. **Outline stage** — on print the stage platform is a line/outline, not a filled shape.
6. **Print when planned** — must work on a locked/planned service, not only a draft
   (printing is read-only).

## Approach

- Add a `print` variant to `StageRoom` / `StageMarkerChip` / `StageLayoutView`: outline
  stage (no fill), larger black type, B&W tiles (white + black outline), hollow audience
  seats. Bump the on-screen tile fonts modestly for a11y.
- New `StageLayoutPrintDocument.vue` — a hidden-on-screen, `print:block` LANDSCAPE sheet:
  header (service name/date) + the B&W outline diagram + a large grouped marker list
  (On stage / Off stage: Type — Name — Note) so it reads at a glance.
- `ServiceEditorView.printStageLayout()` toggles `stagePrintMode` (swaps the normal
  portrait `ServicePrintLayout` out for the stage sheet) and injects a temporary
  `@page { size: landscape }` rule (removed on `afterprint`), so it doesn't disturb the
  normal service print.
- "Print for tech" button in the Stage Layout tab panel, NOT gated on `canEditService`
  (so it works on a planned/locked service).

## Tests / gates

- `npm run type-check` clean.
- Stage suites (`StageLayoutView`, `StageLayoutEditor`) + print consumers
  (`ServicePrintLayout`, `ShareView`) green.
- `ServiceEditorView.stage.test.ts`: print button calls `window.print()`, and is present
  + working on a `planned` (locked) service.
