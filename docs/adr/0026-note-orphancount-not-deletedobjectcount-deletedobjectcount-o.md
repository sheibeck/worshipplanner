# 0026. NOTE: orphanCount, NOT deletedObjectCount -- deletedObjectCount only

## Status

Accepted

## Context

This rationale is applied at 3 call site(s) within `functions/src/index.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

NOTE: orphanCount, NOT deletedObjectCount -- deletedObjectCount only increments on the live-delete branch and is always 0 in forced-dry-run mode for this handler (71-PATTERNS.md Pitfall 1).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/index.ts:2067-2069`:**

```
      // NOTE: orphanCount, NOT deletedObjectCount -- deletedObjectCount only
      // increments on the live-delete branch and is always 0 in forced-dry-run
      // mode for this handler (71-PATTERNS.md Pitfall 1).
```

**`functions/src/index.ts:2192-2194`:**

```

      // Load the org settings for THIS org (cached). Read settings.messaging.*
      // and settings.timezone -- NOT messaging.* (research Pitfall 2).
```

**`functions/src/index.ts:2975-2977`:**

```

  // The three message-level ids become Resend tags (Pitfall 3). If any is not
  // tag-safe the send is unsafe for the whole message — fail closed.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:2067-2069`
- `functions/src/index.ts:2192-2194`
- `functions/src/index.ts:2975-2977`
