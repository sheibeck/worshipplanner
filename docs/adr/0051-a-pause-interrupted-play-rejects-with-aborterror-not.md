# 0051. A pause()-interrupted play() rejects with AbortError, not

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/AudioPlayer.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

A pause()-interrupted play() rejects with AbortError, not NotAllowedError (HTML media spec) — this is an expected, silent outcome (see WR-01): the presentation driver calls pauseCurrentMedia() at the start of every navig...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/AudioPlayer.vue:96-101`:**

```
    // A pause()-interrupted play() rejects with AbortError, not
    // NotAllowedError (HTML media spec) — this is an expected, silent
    // outcome (see WR-01): the presentation driver calls pauseCurrentMedia()
    // at the start of every navigation, which can legitimately race a
    // still-pending play() on this exact element. Never surface it as an
    // unhandled rejection.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/AudioPlayer.vue:96-101`
