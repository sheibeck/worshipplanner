# Phase 51: Service Order Editing Reliability - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (owner away — grey areas auto-decided at Claude's discretion, grounded in a live read of the reorder handlers)

<domain>
## Phase Boundary

Editing a service order — in BOTH the default-template editor (`ServiceTemplateEditor.vue`) and a live
service plan (`ServiceEditorView.vue`) — never corrupts item state, and every item keeps its true order
everywhere it appears (edit screen, Services listing, public share link). This is a correctness /
reliability phase for R110, R111, R112. No new features; no rearchitecture of the v1.4 per-section
SortableJS design.

</domain>

<decisions>
## Implementation Decisions

### Root-cause & fix strategy
- **Fix at the source of the desync, never mask with a reload.** Success criterion 4 is explicit: all
  three symptoms must stay fixed without a page refresh. A reload "fixes" them today only because it
  forces a full Vue re-render / re-read.
- **Write a failing reproduction test FIRST (RED → GREEN)** for each of the three defects before
  touching production code — the v1.4 drag-bug fix did exactly this, and CLAUDE.md mandates it for
  security/reliability work. jsdom cannot produce a real OS drag, but the v1.4 harness proved a
  SortableJS `onEnd` can be simulated with a synthetic event carrying `from`/`to`/`oldDraggableIndex`/
  `newDraggableIndex` — reuse that DOM-derived pattern (see `ServiceEditorView.test.ts`).
- **R110 hypothesis (confirm in plan-phase research):** the reactive state logic in `onTemplateSortEnd`
  (and its `ServiceEditorView.vue` sibling) is already CORRECT — it reassigns `moved.section = toKey`
  and rebuilds the array via `flattenBySection(groupBySection(...))`. The phantom is therefore NOT a
  state bug; it is a **SortableJS ↔ Vue DOM-ownership conflict on cross-LIST (cross-section) drags**:
  SortableJS physically relocates the dragged `<li>` from the source `<ul>` into the target `<ul>`,
  then Vue re-renders from the updated reactive array without reclaiming that orphaned node — leaving a
  second, event-handler-less "No Section" copy that cannot be deleted and disappears on refresh. Within
  a single section the node never changes `<ul>`, which is why same-section reorder works.
  - **Fix:** in `onEnd`, revert SortableJS's DOM mutation BEFORE applying the reactive update (move
    `evt.item` back to its origin list/position, or the equivalent), so Vue remains the sole owner of
    the DOM. This is the standard SortableJS-with-Vue cross-list integration pattern. Keep the v1.4
    per-section Sortable architecture — do NOT swap libraries or rebuild the grouping model.
- **R111 hypothesis:** moving an item to "No Section" sets `section = undefined`; Firestore `updateDoc`
  rejects raw `undefined` field values. `ServiceTemplateEditor.vue` already imports and uses
  `stripUndefined`, so the defect most likely lives on the LIVE-plan save path (`ServiceEditorView.vue`
  / `services` store), which writes the slot with `section: undefined` rather than omitting it or using
  `deleteField()`. Fix by never sending raw `undefined` (strip or delete-field) on the service save.
- **R112 hypothesis:** the Services listing (`ServicesView.vue`) and the public share snapshot render
  slots in an order that sinks empty-bodied items (e.g. blank Miscellaneous) to the bottom until text
  is typed. Make both read surfaces render in the SAME section-major order the editor uses — reuse the
  shared ordering contract in `slotTypes.ts` (`orderSlotsBySection` / `groupBySection` +
  `flattenBySection`) rather than any content/body-dependent sort. Confirm the exact mis-ordering
  (an `orderBy`, a filter-then-append, or an assembler bucket) with the plan-phase researcher.

### Scope & surfaces
- **All three surfaces in scope:** `ServiceEditorView.vue` (live plan), `ServiceTemplateEditor.vue`
  (default template), and an audit of `SlideGrid.vue`'s copy-pasted reorder for the same DOM-ownership
  class (fix if present; the notes flag it as copy-pasted).
- **Extract a shared cross-list-drag helper only if it reduces risk.** Both editors share the same bug
  and the same per-section Sortable shape, so a single tested helper (e.g. a `revertSortableDomMove`
  utility or a small composable) is attractive — but only if it does not force a risky refactor of two
  working handlers. Otherwise apply the identical in-place fix to each and cover both with tests.
- **Preserve the v1.5 Phase 41 share-snapshot refresh path** (`maybeRefreshShareLink` /
  `ensureShareLink`) — R112 is a read-ORDER fix, not a snapshot-write change; do not disturb the
  stable-token / auto-refresh behavior.
- **No new features, no behavior changes beyond correctness.** The five fixed sections, the palette,
  the dropdown, and autosave all stay exactly as they are.

### Claude's Discretion
- Exact fix mechanics (DOM-revert vs. nonce-keyed container re-render), helper extraction vs. in-place,
  and test structure are at Claude's discretion, subject to: repro-test-first, fix-at-source, and all
  four success criteria observable without a refresh.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/slotTypes.ts` — the ordering contract: `groupBySection` (buckets by `SERVICE_SECTIONS`,
  section-less → trailing `legacy`), `flattenBySection`, `orderSlotsBySection` (identity-preserving
  composition), `reindexSlots`. This is the single source of truth the editor already uses; the R112
  read surfaces should route through it too.
- `src/utils/stripUndefined.ts` — already used by `ServiceTemplateEditor.vue`; the pattern to apply on
  the live-plan save for R111.
- v1.4 DOM-derived drag test harness in `src/views/__tests__/ServiceEditorView.test.ts` and
  `src/components/slides/__tests__/SlideGrid.test.ts` — reuse for the RED repro tests.

### Established Patterns
- **Per-section SortableJS** (v1.4 Phase 29): one `Sortable.create` per section container, sharing a
  drag group, keyed on stable `slot.id` (never index/position). `ServiceTemplateEditor.vue` mirrors
  this exactly (`sectionSortables` map, `onTemplateSortEnd`).
- Reorder handlers read `evt.oldDraggableIndex` / `evt.newDraggableIndex` (NOT `oldIndex`/`newIndex`)
  and `evt.from.dataset.section` / `evt.to.dataset.section` — this part is already correct.

### Integration Points
- `ServiceEditorView.vue` — live Service Order reorder + save path (R110, R111).
- `ServiceTemplateEditor.vue` — default-template reorder (R110 in the template editor).
- `SlideGrid.vue` — copy-pasted reorder to audit (R110 class).
- `ServicesView.vue` — Services listing read surface (R112).
- The public share snapshot render path — share link read surface (R112); keep Phase 41 refresh intact.

</code_context>

<specifics>
## Specific Ideas

- Owner's reproduction, verbatim: "I add a Song item. I drag the song Item to the Worship section and
  drop it. Now I have 2 songs items. One has the dropdown showing Worship. The duplicated one still
  shows No Section." — the phantom is the orphaned Sortable DOM node; the real item is the one whose
  dropdown reflects the reassigned section.
- Owner: the same issue now also happens dragging items in the actual service plan, not just the
  default service order — hence both editors are in scope.
- Owner: putting text into a Miscellaneous item's input box made it "suddenly show up in the proper
  order" on the listing and share screens — this is the empty-body ordering tell for R112.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Item-editing enhancements like the notes field and
Miscellaneous default-no-slides are Phase 54; the template relocation is Phase 52.)

</deferred>
