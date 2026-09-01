# 0148. This doc is keyed purely by slug+date, and the app enforces no

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/stores/services.ts`. Documented at the time in `80-REVIEW`.

CR-01 (80-REVIEW): this doc is keyed purely by slug+date, and the app enforces no per-org date uniqueness, so two services can share one serviceShares doc.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`src/stores/services.ts:650-656`:**

```
          // CR-01 (80-REVIEW): this doc is keyed by slug+date, NOT serviceId —
          // two services on the same date share one serviceShares doc. Only
          // delete it if it still records THIS service as owner; otherwise a
          // same-date sibling service's live public share page would be
          // silently destroyed. A doc written before this guard existed (no
          // serviceId field) is treated as "not mine" and left alone rather
          // than deleted on an undefined === id false match.
```

**`src/stores/services.ts:898-903`:**

```
        // CR-01 (80-REVIEW): this doc is keyed purely by slug+date, and the
        // app enforces no per-org date uniqueness, so two services can share
        // one serviceShares doc. serviceId lets deleteService tell "this doc
        // is mine" from "this doc belongs to a same-date sibling service"
        // before deleting it — without this field the doc has no way to
        // disambiguate ownership.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/services.ts:650-656`
- `src/stores/services.ts:898-903`
