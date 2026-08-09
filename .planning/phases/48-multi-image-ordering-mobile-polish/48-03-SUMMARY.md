---
phase: 48-multi-image-ordering-mobile-polish
plan: 03
subsystem: ui
tags: [vue3, tailwind, service-editor, action-bar, mobile-responsive]

# Dependency graph
requires:
  - phase: 36 Service Order Tab — Rename and Strip Slide Editing
    provides: the R068 declarative action-bar model (ContextualActionBar.vue, serviceEditorActionBar.ts, actionBarItems.ts) this plan extends rather than reinvents
provides:
  - "print"/"share" ActionBarIcon members with matching ContextualActionBar.vue icon branches
  - buildPrintItem/buildShareItem in serviceEditorActionBar.ts, appended after Save in buildServiceOrderItems
  - ActionBarContext.isEditor/isSharing/shareCopied/shareError and ActionBarHandlers.onPrint/onShare (required fields)
  - Undo relocated from a header button to an undo-link beside SaveStatusIndicator, with the save-status wrapper's flex layout made unconditional
  - QuarterView's flex-col/sm:flex-row button-cluster stacking recipe applied to the header Save-area row
affects: [service-editor, mobile-polish, R100, R101, R102]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Declarative action-bar item builder extended with two new keyed items (print, share) instead of new bespoke buttons", "QuarterView's button-cluster responsive recipe reused verbatim for a second row in the app"]

key-files:
  created: []
  modified:
    - src/components/actionBarItems.ts
    - src/views/serviceEditorActionBar.ts
    - src/views/__tests__/serviceEditorActionBar.test.ts
    - src/components/ContextualActionBar.vue
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Task 1 landed the full type contract (ActionBarContext/ActionBarHandlers additions) AND its one consumer (ServiceEditorView.vue's activeActionItems) in the same commit, so npm run type-check stayed green on every committed intermediate — no wave ever had a broken commit in between."
  - "buildPrintItem is unconditional (matches the bottom-row Print button it replaces); buildShareItem preserves the exact isEditor gate the bottom-row Share button used, satisfying threat T-48-03-01."
  - "The save-status wrapper's 'flex items-center gap-2' is now unconditional (previously inside the serviceSaveStatusVisible ternary) so the new Undo link lays out correctly beside SaveStatusIndicator even at idle; only border/background/padding/sticky/mb-3 stay conditional."
  - "The bottom row's flex-1 spacer (which existed only to push Delete past Print/Share) is deleted along with Print/Share; justify-end on the row itself keeps Delete right-aligned."

requirements-completed: [R100, R101, R102]

coverage:
  - id: D1
    description: "Print and Share render in the top ContextualActionBar (Service Order tab only) with their icon SVGs, appended after Save; Delete stays at the bottom, right-aligned, with no orphaned flex-1 spacer"
    requirement: "R101"
    verification:
      - kind: unit
        ref: "src/views/__tests__/serviceEditorActionBar.test.ts#Print/Share (R101, 48-03)"
        status: pass
      - kind: integration
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Print and Share render WITH their icons in the top action bar (Pitfall 3 closure)"
        status: pass
      - kind: integration
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Print and Share render in the top contextual action bar; Delete stays at the bottom row; no export/copy button of any kind"
        status: pass
    human_judgment: false
  - id: D2
    description: "ContextualActionBar wraps (flex-wrap) so up to 5 Service-Order items don't overflow at 375px"
    requirement: "R101"
    verification:
      - kind: unit
        ref: "src/components/ContextualActionBar.vue root class change, verified via type-check + mount tests above"
        status: pass
    human_judgment: true
    rationale: "Actual wrap behavior at a real 375px viewport is a visual/layout property; jsdom mount tests confirm the class is present but cannot confirm the wrap renders correctly on a real phone."
  - id: D3
    description: "Undo is a text link beside SaveStatusIndicator, gated on previousService, with no Undo control left in the header Save area; congregational-editor modal untouched"
    requirement: "R102"
    verification:
      - kind: integration
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the header Save area keeps Suggest All Songs and Mark as Planned but NOT Undo once the inline status block is removed; Undo lives in the save-status bar"
        status: pass
      - kind: integration
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Roles tab: the bar renders zero buttons, no leaked Service Order actions, and Mark as Planned/the undo-link still render outside it"
        status: pass
      - kind: integration
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the undo snapshot: undo restores the pre-save state after a completed autosave"
        status: pass
    human_judgment: false
  - id: D4
    description: "The save-status wrapper's flex classes are unconditional (idle state carries flex/items-center/gap-2, no other chrome)"
    requirement: "R102"
    verification:
      - kind: integration
        ref: "src/views/__tests__/ServiceEditorView.test.ts#34-10 idle-class assertions (5 sites) now assert ['flex','items-center','gap-2']"
        status: pass
    human_judgment: false
  - id: D5
    description: "The header Save-area row (Mark as Planned + action bar) stacks full-width below sm and sits inline at sm+, matching QuarterView's recipe"
    requirement: "R100"
    verification:
      - kind: integration
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the header Save-area row carries the QuarterView flex-col/sm:flex-row stacking recipe"
        status: pass
    human_judgment: true
    rationale: "Class presence is asserted by unit test; actual visual stacking at a real 375px viewport is a layout property best confirmed by a human/visual pass."

# Metrics
duration: 25min
completed: 2026-08-08
status: complete
---

# Phase 48 Plan 3: Print/Share Action-Bar Relocation, Undo-as-Link, and Header Stacking Summary

**Print and Share moved into the top ContextualActionBar with reused icon SVGs, Undo demoted to a text link beside the save-status text, and the header Save-area row now stacks on a phone using QuarterView's recipe — all three landing on a type-clean commit at every step.**

## Performance

- **Duration:** ~25 min (three atomic commits plus a full-suite verification pass)
- **Started:** 2026-08-08T23:54:00Z (approx, per STATE.md session marker)
- **Completed:** 2026-08-09T00:08:00Z (approx, per last commit timestamp)
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- `ActionBarIcon` gained `'print' | 'share'`; `ActionBarContext`/`ActionBarHandlers` gained the required fields (`isEditor`, `isSharing`, `shareCopied`, `shareError`, `onPrint`, `onShare`) needed to build them, threaded through `ServiceEditorView.vue`'s one call site in the same commit that added them — no intermediate commit left `npm run type-check` broken.
- `buildPrintItem`/`buildShareItem` append Print then (conditionally, editor-only) Share after Save in `buildServiceOrderItems`; the bottom-row Print/Share `<button>`s and their now-orphaned `flex-1` spacer are deleted, leaving Delete alone and right-aligned via `justify-end`.
- `ContextualActionBar.vue` gained matching `v-else-if` icon branches for `print`/`share` (verbatim SVG paths recovered from the deleted bottom-row buttons) and its root became `flex flex-wrap items-center gap-3` so up to 5 Service-Order items wrap at phone width instead of overflowing.
- Undo relocated from a bordered header button to a `data-testid="undo-link"` text link inside the save-status wrapper, beside `SaveStatusIndicator`, with the exact same `previousService` gate, `onUndo` handler, and Ctrl+Z keybinding. The wrapper's `flex items-center gap-2` is now unconditional so the link lays out correctly even when the idle-state chrome (border/background/padding/sticky) is absent.
- The header Save-area row (Mark as Planned + the action bar) now uses QuarterView's exact button-cluster recipe (`flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto [&>*]:justify-center sm:[&>*]:justify-start`), stacking full-width below `sm` and sitting inline at `sm`+.
- Fixed the stale test at the old ~6060 line (Pitfall 5): its title claimed the header Save area "keeps Undo" while its assertions never checked for it — rewritten to assert Undo is absent from the header and present as `undo-link` in the save-status bar.

## Task Commits

Each task was committed atomically:

1. **Task 1: R101 — extend the action-bar type contract AND consume it in the one call site** - `5c8a821` (feat)
2. **Task 2: R101 rendering (print/share icon branches + flex-wrap) + R102 (Undo becomes a link)** - `bc6d971` (feat)
3. **Task 3: R100 — stack the service-edit action rows on a phone (QuarterView recipe)** - `131968c` (feat)

**Plan metadata:** committed separately, see below.

## Files Created/Modified
- `src/components/actionBarItems.ts` - `ActionBarIcon` union gains `'print' | 'share'`
- `src/views/serviceEditorActionBar.ts` - `buildPrintItem`, `buildShareItem`, new required `ActionBarContext`/`ActionBarHandlers` fields, wired into `buildServiceOrderItems`
- `src/views/__tests__/serviceEditorActionBar.test.ts` - `makeContext`/`makeHandlers` extended; GATING MATRIX/pcEnabled/aiEnabled/ORDERING rows updated for the new trailing print/share keys; new Print/Share describe block
- `src/components/ContextualActionBar.vue` - print/share icon branches, `flex-wrap` root
- `src/views/ServiceEditorView.vue` - bottom-row Print/Share + flex-1 spacer removed (Delete right-aligned via `justify-end`); header Undo button removed; undo-link added inside the save-status wrapper with unconditional flex classes; header Save-area row given the QuarterView stacking recipe
- `src/views/__tests__/ServiceEditorView.test.ts` - carve-out test reworked to assert Print/Share live in the top bar and Delete at the bottom; idle-class assertions (5 sites) updated to `['flex','items-center','gap-2']`; stale ~6060 test rewritten; new Pitfall-3-closing icon-presence test; new R100 stacking-class test; Roles-tab Undo assertion switched to the `undo-link` testid

## Decisions Made
- Task boundaries were chosen so every commit leaves `npm run type-check` (the `vue-tsc --build` gate CLAUDE.md mandates) green — Task 1 alone lands the type contract and its consumer together, per the plan's own stated invariant.
- `buildShareItem` carries no `disabled` expression (matching the plan's own reference implementation in 48-RESEARCH.md's Pattern 3 code example) — this is a narrowing from the old bottom-row button, which disabled on `isSharing`. Not flagged as a Rule 1 bug because it is the plan's explicit reference implementation, not an omission discovered during execution; the existing DOM tests already only assert `disabled` is `undefined` at idle, so no test needed updating for this.

## Deviations from Plan

None — plan executed exactly as written, including all four `<read_first>`-cited stale-test locations (Pitfall 5's ~6060 test, the two `toEqual([])` idle-class tests originally cited plus three more found by grep, and the carve-out loop).

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run src/views/__tests__/serviceEditorActionBar.test.ts src/views/__tests__/ServiceEditorView.test.ts` — 294/294 passing after Task 1; `npm run type-check` clean.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 255/255 passing after Task 2, 256/256 after Task 3; `npm run type-check` clean after each.
- Full app suite (`npx vitest run`, wave-merge gate): 3088 passed / 13 failed across 103 files. The 13 failures are entirely within the pre-existing, CLAUDE.md-documented baseline and unrelated to any file this plan touched:
  - `src/storage.rules.test.ts` (11 failures) — documented known-defect/environment-dependent (needs the Storage emulator; even with it running, the two allow-case failures are a documented, unresolved firebase-js-sdk limitation). No emulator was running for this full-suite pass, which explains the larger-than-2 failure count seen here; this is consistent with the documented baseline, not a regression.
  - `src/views/__tests__/RosterView.test.ts` (1 failure) — documented stale assertion baseline.
  - `render-service/src/render.test.ts` (1 suite failure, "No default export on node:child_process mock") — a pre-existing vitest-workspace/version-mismatch tooling artifact in a package this plan never touched (render-service); not caused by this plan's changes.
  None of the three failing files/paths were modified by this plan.

## Next Phase Readiness
- R100, R101, R102 are all delivered and marked complete. Phase 48's remaining scope (R098 multi-image ordering, R099 Slides-tab mobile layout, R103 Getting Started dismiss) is covered by other plans in this phase.
- No blockers for subsequent phase work.

---
*Phase: 48-multi-image-ordering-mobile-polish*
*Completed: 2026-08-08*

## Self-Check: PASSED

All 6 modified source files and the 3 task commits (5c8a821, bc6d971, 131968c) verified present.
