# 0059. Change: the provenance helpers in @/utils/scripture and the per-slide

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/PresentationViewer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

change: the provenance helpers in `@/utils/scripture` and the per-slide `translationSource` field are untouched (R092 preserved), and the version can still be typed into a slide's own editable text.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/components/PresentationViewer.vue:250-259`:**

```
// change: the provenance helpers in `@/utils/scripture` and the per-slide
// `translationSource` field are untouched (R092 preserved), and the version
// can still be typed into a slide's own editable text.

// A live edit that shortens the show cannot leave currentIndex out of range.
// Clamping must route through the same pause/play lifecycle as goToIndex()
// (WR-03) — otherwise nothing ever calls .play() on whatever media element
// SlideCanvas mounts for the new slide. SlideCanvas's own internal watcher
// (Phase 90) resets the OLD slide's degraded-state flags on this same
// slide-identity change, so they never leak onto the clamped-to slide.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/PresentationViewer.vue:250-259`
