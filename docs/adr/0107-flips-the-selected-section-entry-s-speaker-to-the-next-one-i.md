# 0107. Flips the selected section entry's speaker to the next one in the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/EditSlideDrawer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Flips the selected section entry's speaker to the next one in the 3-way cycle (RESEARCH Pitfall 5 — the old binary ternary silently mapped ANY non-LEADER value, including ALL, straight to LEADER, corrupting an ALL slide...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/slides/EditSlideDrawer.vue:778-789`:**

```

/**
 * Flips the selected section entry's speaker to the next one in the 3-way
 * cycle (RESEARCH Pitfall 5 — the old binary ternary silently mapped ANY
 * non-LEADER value, including ALL, straight to LEADER, corrupting an ALL
 * slide on a single click). Modeled on `onLoopToggle`'s immediate-write
 * shape (this plan's key_links): re-checks `canMutate` inside the handler
 * (not just the template `v-if`), reads the group's CURRENT slides as the
 * base, maps only the selected entry, and awaits the store call so a
 * rejected write reaches Vue's handler like every other write here.
 * Deliberately NOT debounced — a discrete choice, not a stream of
 * keystrokes, so routing it through the debounced `body` machinery could
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/EditSlideDrawer.vue:778-789`
