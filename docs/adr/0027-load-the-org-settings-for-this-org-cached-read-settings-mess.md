# 0027. Load the org settings for THIS org (cached). Read settings.messaging

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/index.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Load the org settings for THIS org (cached). Read settings.messaging.* and settings.timezone -- NOT messaging.* (research Pitfall 2).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/index.ts:2192-2194`:**

```

      // Load the org settings for THIS org (cached). Read settings.messaging.*
      // and settings.timezone -- NOT messaging.* (research Pitfall 2).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:2192-2194`
