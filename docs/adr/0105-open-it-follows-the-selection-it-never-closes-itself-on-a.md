# 0105. Open. It follows the selection — it never closes itself on a

## Status

Accepted

## Context

This rationale is applied consistently at 2 call site(s) across 2 files: `src/components/slides/EditSlideDrawer.vue`, `src/components/slides/SlidesTab.vue`. Documented at the time in `26-RESEARCH.md`.

open. It follows the selection — it never closes itself on a selection change, only on its own close control or Escape.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/slides/EditSlideDrawer.vue:503-512`:**

```
 * open. It follows the selection — it never closes itself on a selection
 * change, only on its own close control or Escape.
 *
 * Renders nothing when closed, and nothing when `entry` is null — the latter
 * covers both "nothing selected" and the pre-materialization window where a
 * selected slide's synthetic fallback id has no stored entry behind it yet
 * (26-RESEARCH.md Pitfall 1). This is a plain `v-if` guard, not a loading
 * state — the window is sub-second in practice and the caller (`SlidesTab.vue`)
 * already handles clearing a dangling selection.
 */
```

**`src/components/slides/SlidesTab.vue:351-359`:**

```
 * DIRECT id lookup against `selectedGroup.slides`, with no mapping step. For
 * a materialized group `AssembledSlide.slide.id` equals `GroupSlideEntry.id`
 * verbatim (26-RESEARCH.md Pattern 1, verified against
 * `slideshowAssembler.ts`'s `emitFromGroup`). Resolves to `null` — treated by
 * the drawer as "nothing selected," never a loading state — for the
 * pre-materialization fallback-id window where a selected slide's synthetic
 * id has no `GroupSlideEntry` counterpart yet (Pitfall 1); do not "fix" that
 * window with a spinner.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/EditSlideDrawer.vue:503-512`
- `src/components/slides/SlidesTab.vue:351-359`
