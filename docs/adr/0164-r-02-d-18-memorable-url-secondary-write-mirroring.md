# 0164. R-02/D-18: memorable-URL secondary write, mirroring

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/services.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

R-02/D-18: memorable-URL secondary write, mirroring quarters.ts::finalizeAndShare exactly — resolve (or claim, on first share) the org's slug, then overwrite serviceShares/{slug}__service-{date} in place.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `R-02, WR-06`):

**`src/stores/services.ts:878-884`:**

```

    // R-02/D-18: memorable-URL secondary write, mirroring
    // quarters.ts::finalizeAndShare exactly — resolve (or claim, on first share)
    // the org's slug, then overwrite serviceShares/{slug}__service-{date} in
    // place. WR-06: the opaque shareTokens doc above has already succeeded, so
    // this whole step is soft-fail — any error here is logged and swallowed, the
    // token is still returned (T-17-03-03).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/services.ts:878-884`
