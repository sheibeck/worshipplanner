# Phase 29: Order Structure — Stable Reordering & Post-Service - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Service items and slides reorder reliably and land exactly where dropped, with the view correct
immediately and no refresh required. The five service sections — Pre-Service → Worship → Message →
Sending → Post-Service — render in fixed order, are never themselves draggable, and stay visible when
empty. Adds Post-Service as the fifth section.

**Requirements:** R042, R043, R044, R049, R050.

**In scope:** the reorder mechanism in `ServiceEditorView.vue` and `SlideGrid.vue`, the section model in
`src/types/service.ts`, and the four downstream consumers that hard-code four sections.

**Out of scope:** the save-status indicator UI (Phase 32 — this phase only adds a correct error path),
slide-group mirroring of service order (Phase 30), and any slide *editing* behavior (Phase 33).

</domain>

<decisions>
## Implementation Decisions

### Reorder Mechanism

- **One Sortable instance per section container**, not one flat list. Section headers stop being members
  of any sortable list, so they cannot be dragged and cannot be miscounted. This is the more robust of
  the two options ARCHITECTURE.md offered.
- **Cross-section moves use SortableJS `group` with a shared name.** `onEnd` derives the target section
  from `evt.to` / `evt.from` and assigns `slot.section` accordingly. The existing section `<select>`
  dropdown stays as a non-drag alternative.
- **`v-for` key becomes `slot.id`.** Currently `slot.kind + '-' + slot.position`, and
  `reindexSlots()` (`src/utils/slotTypes.ts:98`) rewrites `position` to the array index on every
  reorder — so every key changes on every reorder and Vue's keyed diff is defeated. `slot.id` is stable
  and guaranteed present by the Phase 24 D-01 lazy backfill.
- **Remove the D-16 single-step DOM revert** (`ServiceEditorView.vue:1436-1437`,
  `SlideGrid.vue:677-678`). With per-section lists and a stable key, Vue re-renders correctly from
  state; the revert exists only to paper over the key instability. Removing it is a deliberate
  simplification, not an oversight — see the note below.

### Post-Service Section

- **No migration.** `ServiceSlot.section` is already optional, so adding `'post-service'` to
  `SERVICE_SECTIONS` (`src/types/service.ts:15`) makes the section render empty for every existing
  service. No write against production v1.0 service documents.
- **Any item kind is allowed** in Post-Service — same as every other section. R042's "cycling exit deck"
  is the motivating use case, not a restriction to enforce.
- **Empty sections are always visible** with a placeholder and a live drop target. This also closes the
  known v1.2 defect where Pre-Service did not render at all because it had no items.
- **Post-Service flows through to print, share link, and Planning Center export**, ordered last. All
  four consumers get audited for hard-coded four-section assumptions.

### Persistence & Save Semantics

- **Keep D-15 immediate-save on reorder** — cancel the debounce and write straight away. A reorder is a
  discrete action, and it is exactly the mutation class R039 says must reliably fire a save.
- **On save failure, revert local state and surface the error.** Today the `try` block at
  `ServiceEditorView.vue:1453-1462` has only a `finally`, so a rejected write leaves the UI displaying
  an order that was never persisted — the silent-failure pattern R041 exists to eliminate.
  `AutoSaveStatus` has no error state today; add one (Phase 32 consumes it).
- **The save-status indicator UI is Phase 32's**, not this phase's. Build the error path and the state,
  not the shared component.
- **A cross-section move is ONE write.** `slots` is a single array field on the service document, so a
  move that changes both order and `section` updates one field and cannot half-apply.

### Proving the Fix

- **Build the failing repro FIRST**, shaped like the reported service `ZTXcpNRcJTalEQp42fTx` — Sending
  rendered mid-list, Message last, Worship appearing twice.
- **Test fixtures MUST include section-header nodes in the container.** The existing tests
  (`SlideGrid.test.ts:417`, `SongLyricEditor.test.ts:454`) call `onEnd` directly with hand-passed
  indices against a header-free list — they pass with the bug present. That is how this survived.
- **Assert on `slot.id` identity after a reorder, never on index.** An index-based assertion cannot
  distinguish "moved the right item" from "moved the item at the right position."
- **Add a regression guard asserting the handler reads `oldDraggableIndex`/`newDraggableIndex`**, so
  nobody reintroduces `oldIndex` on the belief that `draggable` scopes it.
- **One manual human-verify item** for a real cross-section OS drag — jsdom cannot synthesize genuine
  drag events. Keep it to that single check; no new E2E tooling this phase.

### Claude's Discretion

- Exact per-section container markup and how the shared `group` name is chosen.
- Placeholder copy and styling for an empty section (follow the existing dark-theme conventions).
- Whether `SlideGrid.vue`'s fix is a shared helper or a parallel edit — both files have the same three
  defects copy-pasted; extract only if it falls out naturally.

</decisions>

<code_context>
## Existing Code Insights

### The three confirmed defects (verified by reading the code, 2026-07-28)

**`ServiceEditorView.vue:1418-1467`** — the Sortable instance and its `onEnd`:

1. **Wrong index source.** Line 1431/1440/1442 use `evt.oldIndex` / `evt.newIndex`. Section headers ARE
   siblings inside the same flat container — line 526 renders `class="section-header"` inside the same
   `<template v-for>` that line 534 renders `class="slot-item"` from — so those indices count headers.
   Only `oldDraggableIndex` / `newDraggableIndex` respect the `draggable` selector.

2. **⚠ A FALSE COMMENT MARKS THE PREVIOUS FIX ATTEMPT.** Lines 1422-1427 read: *"Scope both drag
   eligibility AND index counting (oldIndex/newIndex) to `.slot-item` — section-header divs are
   siblings in the same flat container but must stay non-draggable and excluded from the index math."*
   **This is factually wrong** — `draggable` does not affect `oldIndex`/`newIndex` in SortableJS
   v1.15.7. Someone previously believed they had fixed this and documented the belief. Delete the
   comment along with the bug; this is the same failure class as the `cleanupExpiredMedia`
   doc-comment-contradicts-code incident recorded in STATE.md.

3. **Unstable key.** Line 521: `:key="slot.kind + '-' + slot.position"`, and `reindexSlots()`
   (`src/utils/slotTypes.ts:97-99`) maps every slot to `{...slot, position: index}` on every reorder.

**`SlideGrid.vue:661-691`** carries the same pattern copy-pasted (`evt.oldIndex` at 670/671/677/689,
single-step revert at 677-678). This is why "new slide lands second-to-last" (R050) is the same
root-cause family, not a separate defect.

`SongLyricEditor.vue:523-543` has the same shape but is Phase 28's song-section editor — NOT in this
phase's scope (R049 covers the Slides tab grid). Leave it alone unless a shared helper makes it free.

### Reusable Assets

- `SERVICE_SECTIONS` / `SERVICE_SECTION_LABELS` (`src/types/service.ts:13-22`) — the file's own comment
  at line 10 calls `SERVICE_SECTIONS` "the single source of truth for the section set." Adding
  Post-Service is one union member plus one array entry.
- `reindexSlots()` and the D-01 `slot.id` backfill in `src/utils/slotTypes.ts`.
- The section `<select>` at line 899 already iterates `SERVICE_SECTIONS`, so it picks up the fifth
  section for free.
- `.planning/codebase/` has CONVENTIONS.md, STRUCTURE.md, TESTING.md — consult during planning.

### Established Patterns

- Sortable instances are created in a `watch(ref, ..., { flush: 'post' })` on a container ref.
- Tests capture the options object handed to `Sortable.create` and invoke `onEnd` directly
  (`SlideGrid.test.ts:91`, `SongLyricEditor.test.ts:8`) — keep this approach, but fix the fixtures.
- Autosave writes through `serviceStore.updateService(id, { slots })`.

### Integration Points

- Consumers to audit for hard-coded four-section assumptions: the slideshow assembler, the plan rail,
  the print layout, and the Planning Center export.

</code_context>

<specifics>
## Specific Ideas

- Reported reproduction: service `ZTXcpNRcJTalEQp42fTx` — after repeated dragging, the Sending section
  rendered in the middle, Message at the bottom, and Worship appeared twice; a page refresh restored
  the correct order. "Correct after refresh" is the diagnostic signature of local state diverging from
  what was persisted/rendered, and it is the behavior this phase must eliminate.
- Owner: *"The sections for Pre-Service, Worship, Message, Sending, Post-Service should never move.
  They should always be in that order. Then you can move items between and in them."*
- Owner: *"Re-ordering service items is pretty much completely broken. Things get all out of whack if
  you drag them around enough."*

</specifics>

<deferred>
## Deferred Ideas

- **Keyboard-accessible reordering** (up/down buttons + `aria-live`) — a real gap SortableJS does not
  cover, recorded in REQUIREMENTS.md under Future Requirements. Additive, no new dependency, but not a
  v1.4 commitment.
- **`SongLyricEditor.vue`'s copy of the same pattern** — Phase 28 territory, not in R049's scope.
  Worth fixing if a shared helper makes it nearly free; otherwise leave it.
- **E2E drag testing** (Playwright or similar) — new infrastructure, out of scope.

</deferred>
