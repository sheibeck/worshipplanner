# 0079. Mirror of the above (review WR-01): the original cross-field rule was

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/components/admin/AiProxyConfigCard.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

Mirror of the above (review WR-01): the original cross-field rule was only wired onto the rateLimitPerDay field, so an owner could raise rateLimitPerMin above the (unchanged) rateLimitPerDay with no warning and Save woul...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/components/admin/AiProxyConfigCard.vue:141-148`:**

```

// Mirror of the above (review WR-01): the original cross-field rule was only
// wired onto the rateLimitPerDay field, so an owner could raise
// rateLimitPerMin above the (unchanged) rateLimitPerDay with no warning and
// Save would succeed. Bidirectional by construction — both computeds react
// to the OTHER field's live edited value the same way, so raising either
// field past the other's current effective value blocks Save on the field
// being edited.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/AiProxyConfigCard.vue:141-148`
