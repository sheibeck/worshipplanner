# 0118. Present (D-05). - selectedSlideId — the individual slide (an

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/SlidesTab.vue`. Documented at the time in `25-RESEARCH.md, 26-RESEARCH.md`.

present (D-05). - `selectedSlideId` — the individual slide (an assembled slide's own id, which equals the stored `GroupSlideEntry.id` once the group has materialized) the future drawer opens against.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, WR-02`):

**`src/components/slides/SlidesTab.vue:79-114`:**

```
 *    present (D-05).
 *  - `selectedSlideId` — the individual slide (an assembled slide's own id,
 *    which equals the stored `GroupSlideEntry.id` once the group has
 *    materialized) the future drawer opens against. Always cleared when the
 *    selected slot changes (a slide selection belongs to its own group), and
 *    cleared again if it stops resolving against the selected slot's own
 *    assembled slides — 25-RESEARCH.md Pitfall 4 documents that a slide's id
 *    changes shape the moment its group materializes (a slot-derived
 *    fallback id gives way to the stored entry id). Fixing the id-minting
 *    scheme itself is Phase 23's WR-02 contract, not this component's job.
 *
 * "Edit in scripture" relay (Phase 26-03, D-15): `ServiceEditorView`'s tab
 * state and its per-plan-item scripture-editor expansion set are local state
 * it alone owns — nothing under this component may reach them directly
 * (26-RESEARCH.md Pitfall 5). `requestEditInScripture` emits
 * `navigate-to-scripture-editor` carrying the selected plan item's raw array
 * index, the one upward channel a page-level action can travel through.
 * Phase 33-09 (R051/R052): the trigger moved from an in-drawer link to the
 * 3-dot menu's `edit-in-scripture` key — `onMenuAction` calls this exact
 * function directly, so the drawer never reaches page state and this
 * component's own relay plumbing is unchanged.
 *
 * Edit Slide drawer seam (Phase 26-05, R033): `selectedEntry` resolves
 * `selectedSlideId` against the selected group's stored slides by a DIRECT id
 * lookup — for a materialized group, `AssembledSlide.slide.id` equals
 * `GroupSlideEntry.id` verbatim (26-RESEARCH.md Pattern 1), so no mapping
 * layer exists or is needed. A selection with no matching entry (the
 * pre-materialization fallback-id window, Pitfall 1) resolves to `null` and
 * the drawer renders nothing — not a loading state.
 *
 * Phase 33-09 (R051): selecting a card no longer opens the drawer — that
 * coupling is exactly what R051 exists to break, so a slide can be dragged
 * without triggering edit. `drawerOpen` is now set true only by
 * `onMenuAction`'s edit key and by the post-duplicate follow-selection
 * handler (`selectSlideById`), and false only by the drawer's own `close`
 * emit or by the selection itself disappearing (below). It is still NEVER
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlidesTab.vue:79-114`
