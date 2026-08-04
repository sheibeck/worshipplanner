---
phase: 36-ui-rework-service-order-contextual-action-bars
plan: 04
subsystem: ui
tags: [vue, tailwind, service-order, addSlot, section-bands, testing, tdd]

requires:
  - phase: 36-03
    provides: "The contextual action bar mounted in ServiceEditorView's header and the Service Order · Slides · Roles tab order — this plan builds inside that same tab's section-band list"
provides:
  - "Every Service Order section band (Pre-Service/Worship/Message/Sending/Post-Service) renders a labelled header with a slide-count caption and, for an editor, a per-band ＋ Add item affordance (R067, ROADMAP criterion 1's structural half)"
  - "addSlot(kind, vwType?, targetSection?) — one additive optional parameter that routes a new slot into a specific band, bypassing the inherit-from-last-slot fallback; every pre-existing call site is byte-identical"
  - "sectionSlideCount(entries) — pure per-band assembled-slide-count helper mirroring SlidePlanRail's own slotIndex-filtered derivation"
affects: [36-05]

tech-stack:
  added: []
  patterns:
    - "Per-band inline add-chip row as a template SIBLING of both the section header and the section-list container (never a child of either) — keeps a new interactive region outside an existing Sortable instance's draggable membership without touching that instance's own selector"
    - "Explicit-argument bypass of an inherit-from-last-slot fallback: targetSection ?? currentSlots[currentSlots.length - 1]?.section — the additive-parameter shape that makes a per-band control land correctly even in an empty band, which has no 'last slot in this section' to inherit from"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Task 1 (addSlot signature + sectionSlideCount helper + openSectionAddKey/toggleSectionAdd UI state) ships with no new tests of its own beyond the existing regression suite passing unchanged (197/197, zero edited expectations). Rationale: ServiceEditorView.vue is a <script setup> component with no defineExpose (confirmed empty grep), so its internal functions are unreachable from a test except through a rendered UI trigger — and the only UI trigger for an explicit targetSection is Task 2's chip row, which does not exist until that task lands. Task 2's 14 new tests are the first point at which the new parameter and the new helper become externally observable, and they cover every Task 1 acceptance criterion that needs a live UI path (targeted vs. untargeted add, empty-band routing, canEditService gating). This mirrors 36-03's own precedent: 'verified test-first within a single commit per task,' not a separate RED/GREEN commit pair per task."
  - "The four flagged items from this plan's own frontmatter assumptions, implemented as specified — recorded here for a checker who reads SUMMARY.md, not PLAN.md: (1) SPEC CORRECTION — the band slide-count caption uses text-[11px], not UI-SPEC §9's illustrative text-[10.5px], because [11px] is one of the spec's own four declared Typography sizes and [10.5px] is not; (2) DISCRETIONARY — the caption copy is '{n} slides' / '1 slide' singular, matching SlidePlanRail's existing per-row convention (no Copywriting Contract entry existed for this caption); (3) DISCRETIONARY — the per-band add control is INLINE (a chip row toggled directly beneath the clicked band's header), not a popover — simpler than the dropdown menu it will be superseded by in 36-05, and the wireframe draws no expanded state for this control either way; (4) SPEC-DIRECTED RESTYLE — the band label moves from text-xs font-semibold (12px/600) to text-[11px] with no weight class (11px/400) and tracking-[.14em], and the divider moves from a border-rule to a gradient span, per UI-SPEC § Typography and §9."
  - "The row-level ⋯ kebab and the assigned-song Change link remain deliberately UNIMPLEMENTED — both appear in the wireframe with no drawn behavior and no current-code equivalent (UI-SPEC Finding 4 item 6, this plan's own `assumptions` and `prohibitions`). No menu was invented for the kebab; no non-destructive song-swap flow was invented for Change. Their absence is a recorded gap, not an omission."
  - "The bottom-of-page 'Add Element' dropdown (ServiceEditorView.vue:~1126-1159) is untouched by this plan, per the plan's own objective ('The bottom-of-page palette is 36-05's'). Its addSlot('SONG', 2) / addSlot('SCRIPTURE') / etc. calls still omit the new third argument and behave byte-identically — this is the concrete proof, alongside 197 unedited pre-existing test expectations, that the new parameter is additive."

requirements-completed: [R067]

coverage:
  - id: D1
    description: "Every one of the five section bands renders a header with its label, a gradient divider, a '{n} slide(s)' count derived from assembledSlideshow (not group.slides.length), and — for an editor on an unlocked service — a ＋ Add item link; the trailing ungrouped bucket still renders no header, no count and no add link even with a legacy slot present"
    requirement: "R067"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — describe('ServiceEditorView - section-band slide count and per-band add (36-04, R067)'), tests 'all five band headers carry a label...', 'still renders exactly 5 headers with a legacy ungrouped slot present...', 'reads singular \"1 slide\"...', 'reads plural \"2 slides\"...', 'an empty band...still renders its header...'"
        status: pass
    human_judgment: false
  - id: D2
    description: "addSlot gains an optional trailing targetSection parameter that bypasses the inherit-from-last-slot fallback; every pre-existing call site (the bottom Add Element dropdown) omits it and is byte-identical; a per-band ＋ Add item chip passes its own band's key explicitly, landing the new slot in that band even when it is empty, even when the service's last slot sits in a different band"
    requirement: "R067"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — 'backstop: clicking worship's add-item then the Prayer chip lands the new slot in worship while the service's last slot (sending) is unchanged' (the plan's own concrete WORSHIP/SENDING backstop case); 'an empty band's add-item routes the new slot into that band as its only entry (E5)'; 'two successive targeted adds into two different bands each land in their own band'; plus the pre-existing (unedited) 'adding a slot inherits the section of the current last slot...' test in the Phase 20-04 describe block, proving the untargeted path is unchanged; 197/197 pre-existing ServiceEditorView.test.ts assertions pass with zero edits"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clicking a band's ＋ Add item link toggles an inline 5-chip add row (Song/Scripture/Prayer/Message/Hymn) directly beneath that band's header; clicking the same link again closes it; opening another band's link closes the first; clicking a chip closes the row after adding; the row is a template sibling of the section-list container so it never enters that section's Sortable draggable set"
    requirement: "R067"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — 'clicking a band add-item link opens exactly 5 chips; clicking it again closes it; opening another band closes the first'; 'clicking a chip twice, reopening the row between clicks, adds exactly two slots'; 're-rendering a band does not duplicate its header, its count or its add-item link (idempotency)'; 'drag-reorder is untouched by the header rebuild...'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Locked service or viewer: the per-band ＋ Add item link and its chip row do not render, while every band's label, divider and count stay visible ('removed, not disabled')"
    requirement: "R067"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — 'locked service: no per-band add-item links or chip menus render, while every header, label and count still does'; 'viewer: no per-band add-item links or chip menus render, while every header, label and count still does'"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-04
status: complete
---

# Phase 36 Plan 04: Service Order Section-Band Rebuild — Slide Count + Per-Band Add Summary

**Every Service Order section band now renders a labelled, counted header with its own inline `＋ Add item` chip row, backed by an additive `addSlot(kind, vwType?, targetSection?)` parameter that routes a per-band add into the clicked band — even an empty one — while every existing capability (drag, section select, remove, scripture editing, the lock banner, the save-status bar) is verified untouched.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-04
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- `addSlot`'s new optional third parameter (`targetSection?: ServiceSection`) bypasses the inherit-from-last-slot fallback only when explicitly supplied; the existing bottom-of-page "Add Element" dropdown's calls all omit it and are byte-identical (197/197 pre-existing tests pass with zero edited expectations)
- `sectionSlideCount(entries)` — a pure helper that sums `assembledSlideshow` entries whose `slotIndex` falls in a band's own set of absolute slot indices, deliberately mirroring `SlidePlanRail.vue`'s existing per-row derivation rather than reading `group.slides.length` (which reads zero for an unmaterialized group)
- Each section-band header (Pre-Service/Worship/Message/Sending/Post-Service) restyled per UI-SPEC §9: `text-[11px]` uppercase-tracked label, gradient-span divider, a `section-slide-count-{key}` caption ("{n} slides", singular at exactly 1), and — editor only — a `section-add-item-{key}` link
- Clicking a band's add-item link opens an inline `section-add-menu-{key}` chip row (Song/Scripture/Prayer/Message/Hymn) directly beneath that band's header; clicking a chip calls `addSlot(kind, vwType, group.key)` and closes the row
- The chip row is a template sibling of both the header and the section-list container — never a member of either — so it stays outside that section's Sortable draggable set without any change to the existing `draggable: '.slot-item'` selector
- 14 new tests cover the full acceptance-criteria matrix: all-five-headers, ungrouped-bucket-gets-none, singular/plural count text, empty-band + placeholder verbatim, open/close/switch toggle, the plan's own WORSHIP/SENDING backstop routing case, double-add idempotency, two-band concurrency, empty-band E5 routing, locked/viewer absence, header/count/link non-duplication, and drag-reorder unaffected
- `npm run type-check` (`vue-tsc --build`, the mandated gate — not the narrower `-p tsconfig.app.json` form) is clean; the full app suite (`npx vitest run --dir src`) is 2407 passing with the documented pre-existing baseline failing (`storage.rules.test.ts` needs the Storage emulator, `RosterView.test.ts` has a stale assertion) — no new failures

## Task Commits

Each task was committed atomically:

1. **Task 1: addSlot gains an optional targetSection, and a pure per-band slide-count helper lands** - `8f17f3f` (feat)
2. **Task 2: Section-band headers gain the label treatment, the slide count and the ＋ Add item chip row** - `9d9f77b` (feat)

**Plan metadata:** committed after this summary (see below).

_Note: neither task used a separate RED/GREEN/REFACTOR commit sequence — see `key-decisions` above for why Task 1's new logic only becomes test-observable once Task 2's chip row exists (no `defineExpose` on this `<script setup>` component), matching 36-03's own precedent of verifying test-first within a single commit per task._

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - `addSlot(kind, vwType?, targetSection?)`, `sectionSlideCount(entries)`, `openSectionAddKey`/`toggleSectionAdd`, the rebuilt section-band header (label restyle + divider restyle + slide count + add-item link), and the new per-band inline chip row
- `src/views/__tests__/ServiceEditorView.test.ts` - one new describe block, `ServiceEditorView - section-band slide count and per-band add (36-04, R067)`, 14 tests; zero edits to any pre-existing test in the file

## Decisions Made
See `key-decisions` in the frontmatter above — summarized: (1) Task 1's new code is proven additive by the unedited pre-existing suite, with its behavior first exercised end-to-end by Task 2's UI-driven tests, since the component exposes no internal API; (2) all four of the plan's own flagged frontmatter items (the `text-[10.5px]`→`text-[11px]` typography correction, the `{n} slides` copy call, the inline-not-popover call, and the label/divider restyle) were implemented exactly as specified; (3) the row-level kebab and the song `Change` link remain deliberately unimplemented; (4) the bottom-of-page "Add Element" palette is untouched, reserved for `36-05`.

## Test Edit Classification (test_edit_discipline)

**Zero pre-existing test assertions were edited.** Every change to `ServiceEditorView.test.ts` in this plan is net-new coverage:

### New coverage (not edits)
- One new describe block, `ServiceEditorView - section-band slide count and per-band add (36-04, R067)`, 14 tests, added after the pre-existing "Section headers and slideshow preview (Phase 20-04)" describe block. None of that block's own tests (including "adding a slot inherits the section of the current last slot," which proves the untargeted `addSlot` path is unchanged) were touched.

No test was edited because a control moved (the header div's `data-testid`, its `v-if="group.label"` gate, and its position in the template are all unchanged — only its inner markup and one new sibling div were added) — so there is no "moved-control" category to classify this plan, unlike 36-03's tab-reorder and Present-relocation work.

## The Four Things That Must Survive — verified

1. **34-10's save-status chrome-strip.** Not touched by any edit in this plan — the block this plan modifies (`section-header` div, lines ~742-780) is well above the save-status bar in the template, and the full 211-test `ServiceEditorView.test.ts` run (which includes the 34-10 regression guard added in 36-03) is 211/211 passing.
2. **34-12's R071 no-credentials note.** Not touched — lives inside `ContextualActionBar`'s `hint-copy-pc` slot (36-03's territory), untouched by this plan's files_modified scope beyond the shared test file, where its describe block (unedited) still passes.
3. **Phase 34's congregational modal.** Not touched — `CongregationalEditor.vue` and its mount point are outside this plan's `<files_modified>`; its pre-existing WR-04/34-07 describe blocks pass unmodified.
4. **36-03's contextual action bar and Service Order · Slides · Roles tab order.** Not touched by this plan; the contextual-action-bar wiring describe block (36-03) and the tab-order assertions both pass unmodified in the full 211-test run.

## The Two Discrepancies Left Unfilled (per this plan's own `prohibitions`)

- **Row-level `⋯` kebab** — no menu was invented. It has no drawn behavior in the wireframe and no current-code equivalent; still absent from every slot row.
- **Assigned-song `Change` link** — no non-destructive song-swap flow was invented. A song can still only be swapped by clearing it (`✕`) and re-picking via `SongSlotPicker`, exactly as before this plan.

Both remain **explicitly unimplemented, not silently omitted** — this SUMMARY, the plan's own `assumptions`, and UI-SPEC Finding 4 item 6 all record the same gap independently.

## Deviations from Plan

**None that change scope or behavior.** One scheduling clarification, documented under `key-decisions`: Task 1's own `<verify>` step (run the test file) passes because the existing 197 tests are unedited — Task 1 introduces no test-observable surface of its own (the component has no `defineExpose`, so its new `addSlot` parameter and `sectionSlideCount` helper cannot be driven from a test until Task 2's chip-row UI exists to call them). All acceptance-criteria coverage for both tasks' behavior lands in Task 2's 14 new tests, which is the first point either becomes externally observable. This mirrors 36-03's own recorded precedent for TDD-flagged tasks in this codebase.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `36-05` is expected to build the bottom-of-page `＋ Add to the service` palette (UI-SPEC §8), which this plan deliberately left untouched (the existing "Add Element" dropdown at `ServiceEditorView.vue:~1126-1159` still works, unchanged) — a future planner should re-check whether `36-05` also wants to reconcile its 5-chip palette styling with this plan's own 5-chip per-band styling (both currently hand-duplicate the same class strings; a shared small component is a legitimate follow-up, not required by either plan).
- The palette's 9-vs-5 chip gap (UI-SPEC Finding 4 item 7 — the wireframe draws `Announcements`/`Video`/`Offering`/`Misc` with no `SlotKind` behind them) is still open for `36-05` to inherit or re-flag; this plan's own per-band chip row narrows to the same 5 kinds for the same reason (no data-model change in scope).
- The row-level kebab and the song `Change` link (§ above) remain open, undirected UI-Considerations `unresolved` items with no phase currently scoped to build them.

---
*Phase: 36-ui-rework-service-order-contextual-action-bars*
*Completed: 2026-08-04*

## Self-Check: PASSED

Both commit hashes (`8f17f3f`, `9d9f77b`) and all files referenced (`src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`, this SUMMARY) verified present.
