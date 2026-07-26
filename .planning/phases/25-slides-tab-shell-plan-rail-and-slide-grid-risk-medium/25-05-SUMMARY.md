---
phase: 25
plan: 05
subsystem: slides-tab
tags: [vue, service-editor, slide-grid, sortablejs, drag-reorder, slideGroups-store, ui-spec]
dependency-graph:
  requires:
    - phase: 25-01
      provides: "VideoSlide type + widened authored-text SourceRef, which makes a hand-added blank slide's own words possible"
    - phase: 25-04
      provides: "SlideCard.vue and SlideGrid.vue, mounted into SlidesTab.vue with the D-12 selection round trip closed"
  provides:
    - "ensureGroupMaterialized on useSlideshowAssembly — on-demand group materialization that also handles a zero-slide derivation"
    - "＋ Add slide control on SlideGrid, appending an authored text entry at the end of the selected group (D-16)"
    - "Drag-reorder within a group's grid, via a SlideCard footer grip and SortableJS wiring on SlideGrid"
  affects: [SlidesTab, 25-06, 25-07]
tech-stack:
  added: []
  patterns:
    - "On-demand materializer returns the entries it wrote rather than expecting the caller to re-read groupsBySlotId, since the store's write does not update that map until the Firestore snapshot round trip lands"
    - "SlideGrid imports useSlideGroups() directly for its two write actions (add-slide, drag-reorder) while still never importing useSlideshowAssembly itself — the composable/store boundary this directory enforces"
    - "SortableJS wiring in SlideGrid.vue reuses ServiceEditorView.vue's slot-list pattern verbatim: handle/draggable scoping, the DOM-revert-before-Vue-re-render trick, and reading current props at onEnd call time rather than at instance-creation time"
key-files:
  created: []
  modified:
    - src/composables/useSlideshowAssembly.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts
    - src/components/slides/SlideCard.vue
    - src/components/slides/__tests__/SlideCard.test.ts
    - src/components/slides/slideDisplay.ts
decisions:
  - "ensureGroupMaterialized deliberately does NOT reuse materializationCandidates' zero-slide skip — that skip implements Phase 24 D-02's automatic-materialization rule; this function exists precisely because a user just asked to put something into an (possibly empty) plan item, R032's exact case."
  - "SlideGrid's add-slide handler ALWAYS calls ensureGroupMaterialized first, even when props.group already reflects a stored document, rather than reading props.group.slides directly — that prop lags a Firestore snapshot round trip behind a just-issued write."
  - "The new entry's SourceRef is { kind: 'text', title: 'New slide', body: '' } — an authored ref (25-01's widening) so it resolves to something visible instead of falling through to the (empty) slot-derived fallback; both fields become editable in Phase 26's drawer."
  - "The drag grip sits between the kind badge and the footer label (footer order: badge, grip, label, audio chip) — satisfying the UI-SPEC's 'to the left of the label' placement without disturbing the existing badge-first layout from 25-04."
  - "SlideGrid's Sortable instance is gated on both isEditor AND group !== null (canReorder) — a group with no stored document has no slides array to reorder and would reject at the store, so the grip/instance is withheld rather than offered and failing."
metrics:
  duration: "~2h"
  completed: 2026-07-26
status: complete
---

# Phase 25 Plan 05: Add Slide and Drag-Reorder Within a Group Summary

Opened the on-demand group-materialization seam (`ensureGroupMaterialized`) that makes every write
path in this phase work even on an empty plan item, then used it to ship the two write controls R031
and R032 need: a `＋ Add slide` button that appends an authored blank slide at the end of the selected
group, and SortableJS-driven drag-reorder within that group via a footer grip on each card.

## What Was Built

**Task 1 — On-demand group materialization, exposed and threaded to the grid** (`31faf32`)

`useSlideshowAssembly.ts` gained `ensureGroupMaterialized(slotId)`, returning
`{ entries, sourceSignature } | undefined`. For a slot with an existing group it resolves with that
group's stored entries and signature and writes nothing. For a slot with no group, it derives the
input via `buildInitialGroup` (which also performs Phase 24 D-05's now-audio-only bed handling) and
creates it through the store's existing `materializeGroupIfMissing` action — **deliberately without**
`materializationCandidates`' zero-slide skip, since that skip implements the automatic path's "groups
are always populated" rule (Phase 24 D-02) and this function only ever runs because a user just asked
to put something into this specific plan item. Concurrent calls for the same slot are deduped through
an in-flight promise map, and the function additionally participates in the existing
`materializingSlotIds` re-entrancy set so the automatic watcher and an explicit call cannot both create
the same document — belt and braces on top of the store's deterministic doc id.

The function returns the entries it wrote rather than expecting the caller to re-read
`groupsBySlotId` — the store's write does not update that map until the Firestore snapshot round trip
lands, so a caller that re-read the map immediately would append to a stale (or still-empty) list and
erase what it just wrote. This return contract is the reason the function exists rather than every
write-path caller calling the store directly.

Threaded straight through: destructured at the single `useSlideshowAssembly` call site in
`ServiceEditorView.vue`, passed to `SlidesTab.vue` as a prop, passed through unused to `SlideGrid.vue`.
No component under `src/components/slides/` imports the composable itself — `EnsureGroupMaterializedResult`
is mirrored by value in `slideDisplay.ts` (alongside `PendingReconciliation`, the same pattern 25-04
established) rather than imported from the composable module.

**Task 2 — Add a slide, appended at the end of the selected group** (`8c808e1`)

`SlideGrid.vue` gained the `＋ Add slide` header control (editor-only, neutral bordered secondary
button per the UI-SPEC's color rules — the accent stays reserved for its four uses). The handler
always resolves the group through `ensureGroupMaterialized` first — even when `props.group` already
reflects a stored document, for the staleness reason above — computes the next order as one past the
highest existing entry's order (zero for an empty group), mints a new `GroupSlideEntry` with an
authored `text` SourceRef (`{ kind: 'text', title: 'New slide', body: '' }` — 25-01's widening exists
for exactly this), and persists via `useSlideGroups().replaceGroupSlides` with the existing entries
plus the new one and the group's stored source signature passed through unchanged. A rejected write is
logged and the handler returns without throwing past it; nothing here touches `localService` or its
autosave.

**Task 3 — Drag-reorder slides within their group** (`19d24a0`)

`SlideCard.vue` gained a drag-grip element in its footer (positioned between the kind badge and the
footer label), rendered only when the new `reorderable` prop is true — a decision `SlideGrid` makes,
never the card itself. The grip carries `aria-label="Reorder slide"` plus `aria-describedby` pointing
at the card's own footer-label span, and stops click propagation so grabbing it never fires the card's
selection click. The card's root button also gained a `slide-card` class for SortableJS's `draggable`
scoping.

`SlideGrid.vue` wires `Sortable.create` on the cards container, reusing `ServiceEditorView.vue`'s
slot-list pattern verbatim: `handle: '.drag-handle'`, `draggable: '.slide-card'`, the DOM-revert step
before touching Vue state (prevents the SortableJS snap-back flash), and reading `props.group` /
`props.selectedSlot` **inside** the `onEnd` handler rather than values captured when the watcher
created the instance — the same container instance serves whichever group is currently selected. On a
real index change, the group's entries are spliced into the new order and renumbered consecutively from
zero, then persisted via `replaceGroupSlides` with the stored source signature unchanged. A drag ending
at its starting index issues no write. The instance is created only when `isEditor` is true AND
`group !== null` (`canReorder`) — a group with no stored document has nothing to reorder and would
reject at the store — and is destroyed on unmount or whenever that condition stops holding.

## Deviations from Plan

None — the plan executed as written for all three tasks, including its explicit prohibitions (DOM-revert
step kept verbatim, no second drag library, no drag affordance added to the rail, `localService`/its
autosave never touched by any write this plan adds).

## Known Stubs / Deliberate Limitations

- **Reconciliation confirm dialog is not built here** (documented in the plan as expected, not a bug):
  if a user hand-adds a slide to a plan item and THEN assigns a scripture passage or deck to it, the
  group's stored signature diverges from the fresh source, the hand-added entry counts as customization
  (25-01's `isNonDerivableEntry`), and reconciliation routes to the confirm-required path rather than
  replacing the user's work — leaving the passive banner (25-04) with no source slides shown until
  Phase 26 ships the confirm dialog (R033). This is Phase 24 D-02's "never silently drop a user's added
  slide" working as intended.
- **No keyboard reordering.** SortableJS provides none out of the box and this plan does not add a
  custom keyboard path; the grip stays focusable (`tabindex="0"`) so it is not entirely unreachable, but
  reordering itself requires a pointer drag. Flagged per the UI-SPEC's own instruction to surface this
  rather than silently omit it — deferred, not fixed here.

## Verification

- `npx vitest run src/components/slides/ src/composables/__tests__/useSlideshowAssembly.test.ts src/views/__tests__/ServiceEditorView.test.ts` — 249 tests across 7 real files, all passing (the two `.gsd/quarantine/worktrees/**` copies of `ServiceEditorView.test.ts` fail as documented baseline, unrelated to this plan).
- `npx vitest run src/` — 10 failed test files (matches the documented baseline exactly: 8 under `.gsd/quarantine/worktrees/**`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`); 152 passed test files, 3254 passed tests, did not grow past baseline.
- `npm run type-check` — 0 errors (`vue-tsc --build`), checked after each task.
- `npm run build` — succeeds after each task; the pre-existing >500kB chunk warning is unrelated to this plan.
- `git grep -n "sortablejs" package.json` — shows `"sortablejs": "^1.15.7"` unchanged; no new drag dependency was added.

## Self-Check: PASSED

- FOUND: `src/composables/useSlideshowAssembly.ts` (modified — `ensureGroupMaterialized` present)
- FOUND: `src/views/ServiceEditorView.vue` (modified — destructures and threads `ensureGroupMaterialized`)
- FOUND: `src/components/slides/SlidesTab.vue` (modified — threads `orgId`/`ensureGroupMaterialized` to the grid)
- FOUND: `src/components/slides/SlideGrid.vue` (modified — add-slide control, SortableJS wiring)
- FOUND: `src/components/slides/SlideCard.vue` (modified — drag grip, `slide-card` class)
- FOUND commit `31faf32` (Task 1 — on-demand materialization)
- FOUND commit `8c808e1` (Task 2 — add slide)
- FOUND commit `19d24a0` (Task 3 — drag-reorder)
