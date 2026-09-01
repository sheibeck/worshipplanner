# 0151. Only a genuine permission-denied is treated as permanent-for-session

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/services.ts`. Documented at the time in `41-REVIEW`.

WR-02 (41-REVIEW): only a genuine `permission-denied` is treated as permanent-for-session.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`src/stores/services.ts:1069-1077`:**

```
      // WR-02 (41-REVIEW): only a genuine `permission-denied` is treated as
      // permanent-for-session. Before this distinction, ANY error — including
      // a transient network blip or a brief rules-propagation delay —
      // permanently disabled refresh for the service for the rest of the
      // Pinia instance's lifetime, silently drifting an already-public
      // service out of sync with no way to recover short of a page reload.
      // Caching `false` on permission-denied specifically is still
      // deliberate: before the owner deploys Plan 01's rules, every attempt
      // is denied, and retrying on every keystroke would flood the console
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/services.ts:1069-1077`
