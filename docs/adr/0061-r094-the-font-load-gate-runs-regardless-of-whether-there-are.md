# 0061. R094 — the font-load gate. Runs regardless of whether there are

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/PresentationViewer.vue`. Documented at the time in `46-REVIEW.md`.

R094 — the font-load gate. Runs regardless of whether there are slides yet (`fontReady` only ever gates rendering when `hasSlides` is true, see `fontGateActive` above), so it never races the assembly-in-flight state.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-02`):

**`src/components/PresentationViewer.vue:414-425`:**

```

  // R094 — the font-load gate. Runs regardless of whether there are slides
  // yet (`fontReady` only ever gates rendering when `hasSlides` is true, see
  // `fontGateActive` above), so it never races the assembly-in-flight state.
  //
  // CR-02 (46-REVIEW.md): the whole sequence — including loadFontCss's
  // unbounded network fetch, NOT just waitForSlideFont's own internal
  // timeout — is raced against ONE shared FONT_LOAD_TIMEOUT_MS timeout and
  // wrapped in try/catch/finally, so a rejected dynamic import (stale-chunk
  // deploy, flaky venue Wi-Fi) or a rejected document.fonts.load() can
  // never permanently strand fontReady at false and hang "Loading
  // slideshow…" for the rest of the service.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/PresentationViewer.vue:414-425`
