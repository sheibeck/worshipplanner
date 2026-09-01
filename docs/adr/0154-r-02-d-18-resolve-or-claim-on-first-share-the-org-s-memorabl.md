# 0154. R-02/D-18: resolve (or claim, on first share) the org's memorable-URL

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/quarters.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

R-02/D-18: resolve (or claim, on first share) the org's memorable-URL slug, then write the quarterShares/{slug}__q{N}-{year} doc — a stable doc ID so every finalize OVERWRITES in place (Pitfall 2), never accumulates like...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tags: `Pitfall, R-02, WR-06`):

**`src/stores/quarters.ts:406-417`:**

```

    // R-02/D-18: resolve (or claim, on first share) the org's memorable-URL slug, then
    // write the quarterShares/{slug}__q{N}-{year} doc — a stable doc ID so every finalize
    // OVERWRITES in place (Pitfall 2), never accumulates like shareTokens above. Reuses the
    // exact calendarWithNames/roles/label/serviceDates snapshot already built — names only,
    // no email/phone (D-24).
    //
    // WR-06: by this point the opaque shareTokens doc AND the quarter's finalized status
    // have already been committed above — a failure in this memorable-URL step must NOT
    // surface as a hard "Failed to finalize and share" to the caller, since the finalize
    // itself already succeeded. This whole step is therefore soft-fail: any error here is
    // logged and swallowed, and the opaque token is still returned.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/quarters.ts:406-417`
