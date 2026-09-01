# 0240. Clear query param without navigation. WR-01: AWAITED — route.query

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/SongsView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Clear query param without navigation. WR-01: AWAITED — `route.query` does not update until this navigation resolves, so if a song-edit request is ALSO present in the query, resolveSongEditRequest()'s own synchronous clea...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/views/SongsView.vue:413-419`:**

```
    // Clear query param without navigation. WR-01: AWAITED — `route.query`
    // does not update until this navigation resolves, so if a song-edit
    // request is ALSO present in the query, resolveSongEditRequest()'s own
    // synchronous clearSongEditQueryParam() call below must not read a
    // pre-clear route.query snapshot and race this replace (whichever one's
    // navigation resolved last would otherwise win, silently dropping the
    // other's clear).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/SongsView.vue:413-419`
