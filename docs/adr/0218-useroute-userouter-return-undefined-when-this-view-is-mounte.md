# 0218. UseRoute()/useRouter() return undefined when this view is mounted

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/views/OwnerConsoleView.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

`useRoute()`/`useRouter()` return undefined when this view is mounted without a router (existing OwnerConsoleView.test.ts harness) — every read below is optional-chained (RosterView.vue precedent, RESEARCH Pitfall 2).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/views/OwnerConsoleView.vue:90-93`:**

```

// `useRoute()`/`useRouter()` return undefined when this view is mounted
// without a router (existing OwnerConsoleView.test.ts harness) — every read
// below is optional-chained (RosterView.vue precedent, RESEARCH Pitfall 2).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/views/OwnerConsoleView.vue:90-93`
