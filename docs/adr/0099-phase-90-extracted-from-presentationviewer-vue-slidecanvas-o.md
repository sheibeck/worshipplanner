# 0099. Phase 90 — extracted from PresentationViewer.vue. SlideCanvas owns

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/slides/SlideCanvas.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Phase 90 — extracted from PresentationViewer.vue. SlideCanvas owns ONLY per-slide rendering + media (video/audio) playback lifecycle + the background layer.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/slides/SlideCanvas.vue:299-306`:**

```

/**
 * Phase 90 — extracted from PresentationViewer.vue. SlideCanvas owns ONLY
 * per-slide rendering + media (video/audio) playback lifecycle + the
 * background layer. It does NOT own exit chrome, nav chrome, keyboard,
 * fullscreen, Escape teardown, or the font-load gate — those stay in
 * PresentationViewer.vue (PITFALLS Pitfall 6/19 — a deliberate NON-copy).
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlideCanvas.vue:299-306`
