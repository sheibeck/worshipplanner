# 0108. The fresh-base write (T-26-05-01, 26-RESEARCH.md Pattern 2/Pitfall 2)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/EditSlideDrawer.vue`. Documented at the time in `25-REVIEW, 26-RESEARCH.md`.

The fresh-base write (T-26-05-01, 26-RESEARCH.md Pattern 2/Pitfall 2).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `CR-02, Pitfall`):

**`src/components/slides/EditSlideDrawer.vue:1189-1201`:**

```

/**
 * The fresh-base write (T-26-05-01, 26-RESEARCH.md Pattern 2/Pitfall 2). Reads
 * `props.group.slides` FRESH at the moment this function actually runs — never
 * a copy captured when the drawer opened or when the debounce timer was
 * scheduled. A stale base would silently discard any change that landed
 * elsewhere during a long-open session; this is the exact data-loss class
 * 25-REVIEW CR-02 already had to fix once, and every later write this drawer
 * adds must route through this same helper for that reason. `entryId` is
 * captured separately, at schedule time — it names WHICH entry to update even
 * if the drawer's selection has since moved on to a different slide (see
 * `flushField`, called when the edited entry changes).
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/EditSlideDrawer.vue:1189-1201`
