# 0100. Keys the VideoPlayer instance on the SLIDE (WR-02) so switching

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/slides/SlideCanvas.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Keys the VideoPlayer instance on the SLIDE (WR-02) so switching between two video slides always remounts the player — even two adjacent video slides sharing an identical `videoSrc` must not reuse the child instance, or a...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/components/slides/SlideCanvas.vue:379-386`:**

```

/**
 * Keys the VideoPlayer instance on the SLIDE (WR-02) so switching between two
 * video slides always remounts the player — even two adjacent video slides
 * sharing an identical `videoSrc` must not reuse the child instance, or a
 * slide that went through the muted-retry path would silently stay muted on
 * the next one with zero on-screen indication.
 */
```

**`src/components/slides/SlideCanvas.vue:388-395`:**

```

/**
 * Keys the AudioPlayer instance on the SLIDE, not just the media URL (WR-02).
 * Phase 24 (R030/D-04): a GROUP BED (`audioFromBed` true, with a `groupId`)
 * is deliberately kept as ONE continuous instance across every slide of that
 * group (R030 bed continuity). A slide with no `groupId` always falls
 * through to the per-slide key.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/slides/SlideCanvas.vue:379-386`
- `src/components/slides/SlideCanvas.vue:388-395`
