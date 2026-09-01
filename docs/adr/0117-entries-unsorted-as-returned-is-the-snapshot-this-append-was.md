# 0117. Entries (unsorted, as returned) is the snapshot this append was

## Status

Accepted

## Context

This rationale is applied at 5 call site(s) within `src/components/slides/SlideGrid.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

CR-02: `entries` (unsorted, as returned) is the snapshot this append was computed FROM — passed through as `baseSlides` so a concurrent write (a double-click's other call, or a drag-reorder landing first) is detected and...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-02`):

**`src/components/slides/SlideGrid.vue:767-774`:**

```
// handler in this file does the same. Entries are sorted by their existing
// `order` before filtering, mirroring the drag-reorder handler's own
// defensive sort, so the survivors' relative PLAY order (not raw array
// insertion order) is what gets renumbered. Does NOT touch
// `group.sourceSignature` — a removal changes no source (R107 territory is
// untouched here) — and passes `group.slides` as `baseSlides` so the write
// routes through the CR-02 concurrent-write transaction merge, exactly like
// every other group-slides write in this file.
```

**`src/components/slides/SlideGrid.vue:841-847`:**

```
    // CR-02: `entries` (unsorted, as returned) is the snapshot this append
    // was computed FROM — passed through as `baseSlides` so a concurrent
    // write (a double-click's other call, or a drag-reorder landing first)
    // is detected and merged rather than silently overwritten. See
    // `replaceGroupSlides`'s doc comment. Re-sorting THIS argument would
    // defeat the merge — only the payload passed as `slides` goes through
    // `appendToGroup`.
```

**`src/components/slides/SlideGrid.vue:920-920`:**

```
    // CR-02: see `onAddSlide` — `entries` (unsorted) is this append's base snapshot.
```

**`src/components/slides/SlideGrid.vue:941-945`:**

```
    // CR-02: `baseEntries` is the snapshot this whole drop's appends were
    // computed FROM (captured once, before the loop below builds up its own
    // list of new entries) — passed through to `replaceGroupSlides` as
    // `baseSlides` so a concurrent write is detected and merged rather than
    // silently overwritten.
```

**`src/components/slides/SlideGrid.vue:1179-1183`:**

```
            // CR-02: `currentGroup.slides` (read from props above, same as
            // `sorted`/`reordered` were derived from) is this write's base
            // snapshot — passed through so a concurrent append that lands
            // between this read and this write is detected and merged rather
            // than silently overwritten by the reorder's full-array replace.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlideGrid.vue:767-774`
- `src/components/slides/SlideGrid.vue:841-847`
- `src/components/slides/SlideGrid.vue:920-920`
- `src/components/slides/SlideGrid.vue:941-945`
- `src/components/slides/SlideGrid.vue:1179-1183`
