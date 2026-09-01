# 0103. Reset whenever the selected plan item changes. openMenuEntryId is

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/SlideGrid.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-02: reset whenever the selected plan item changes. `openMenuEntryId` is local, persistent state on this instance — it is NOT remounted when `SlidesTab.vue`'s rail selection changes plan item, only `selectedSlot`/ `gro...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/slides/SlideGrid.vue:635-643`:**

```

// WR-02: reset whenever the selected plan item changes. `openMenuEntryId` is
// local, persistent state on this instance — it is NOT remounted when
// `SlidesTab.vue`'s rail selection changes plan item, only `selectedSlot`/
// `group` props change and `cards` recomputes to a different filtered list.
// Without this, returning to a previously-selected plan item whose group
// still contains a `GroupSlideEntry.id` matching the stale `openMenuEntryId`
// (stable ids, so this reliably recurs) makes that card's menu reopen with
// no click, tap, or keypress from the user.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlideGrid.vue:635-643`
