# 0068. The exit button must stay reachable even if the idle-hide timer has

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/PresentationViewer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

WR-04: the exit button must stay reachable even if the idle-hide timer has already fired while there is still nothing else on screen to interact with (assembly taking >3s, or the rare empty/race state) — on a touch-only...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-04`):

**`src/components/PresentationViewer.vue:220-230`:**

```

/**
 * WR-04: the exit button must stay reachable even if the idle-hide timer has
 * already fired while there is still nothing else on screen to interact
 * with (assembly taking >3s, or the rare empty/race state) — on a
 * touch-only device there would otherwise be no way to trigger Escape.
 * `chromeVisible`'s own value (and its 3s timer) are untouched; this only
 * overrides what's DISPLAYED while loading/empty. Widened (46-04) to also
 * cover the R094 font-load gate — the exit affordance must stay reachable
 * for however long that gate holds too.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/PresentationViewer.vue:220-230`
