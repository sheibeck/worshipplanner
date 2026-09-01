# 0077. NotAllowedError (autoplay policy) and AbortError (the play() request

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/VideoPlayer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

`NotAllowedError` (autoplay policy) and `AbortError` (the play() request was interrupted by a same-element `pause()` call, per the HTML media spec — see WR-01) are both expected, silent outcomes here: the presentation dr...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/VideoPlayer.vue:76-83`:**

```

/**
 * `NotAllowedError` (autoplay policy) and `AbortError` (the play() request
 * was interrupted by a same-element `pause()` call, per the HTML media spec
 * — see WR-01) are both expected, silent outcomes here: the presentation
 * driver calls `pauseCurrentMedia()` at the start of every navigation, which
 * can legitimately race a still-pending `play()` on this exact element.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/VideoPlayer.vue:76-83`
