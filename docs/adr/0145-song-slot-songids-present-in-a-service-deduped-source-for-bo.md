# 0145. SONG-slot songIds present in a service, deduped source for both

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/services.ts`. Documented at the time in `84-REVIEW`.

SONG-slot songIds present in a service, deduped source for both lock/unlock hooks. WR-01 (84-REVIEW): a song repeated across multiple SONG slots (e.g.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/stores/services.ts:419-425`:**

```

  /**
   * SONG-slot songIds present in a service, deduped source for both
   * lock/unlock hooks. WR-01 (84-REVIEW): a song repeated across multiple
   * SONG slots (e.g. a repeated chorus) must trigger exactly ONE recompute
   * per `markAsPlanned`/`reopenService` call, not one per occurrence.
   */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/services.ts:419-425`
