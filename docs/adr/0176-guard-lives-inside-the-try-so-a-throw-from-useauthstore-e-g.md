# 0176. Guard lives INSIDE the try so a throw from useAuthStore() (e.g. no

## Status

Accepted

## Context

This rationale is applied at 4 call site(s) within `src/utils/claudeApi.ts`. Documented at the time in `39-REVIEW`.

WR-03 (39-REVIEW): guard lives INSIDE the try so a throw from useAuthStore() (e.g. no active Pinia) resolves to null, matching this module's documented never-throw contract, instead of rejecting.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/utils/claudeApi.ts:51-65`:**

```
 * remain parseable and editable even with AI off.
 *
 * The auth store is read inside this function body, never at module
 * evaluation time — Pinia requires an active app instance that does not exist
 * when this module is first imported.
 *
 * WR-03 (39-REVIEW): the guard is called INSIDE each export's `try` block,
 * not before it. `useAuthStore()` throws if invoked with no active Pinia
 * instance — placing the guard ahead of the `try` would let that throw
 * escape as a rejected promise, contradicting this module's documented
 * never-throw contract ("returns null on any error... never throw from
 * service/utility functions; let callers handle null"). Inside the `try`,
 * that same throw is caught and mapped to the same `null` every other
 * failure mode already returns.
 *
```

**`src/utils/claudeApi.ts:244-246`, `src/utils/claudeApi.ts:368-370`, `src/utils/claudeApi.ts:602-604`:**

```
    // WR-03 (39-REVIEW): guard lives INSIDE the try so a throw from
    // useAuthStore() (e.g. no active Pinia) resolves to null, matching this
    // module's documented never-throw contract, instead of rejecting.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/claudeApi.ts:51-65`
- `src/utils/claudeApi.ts:244-246`
- `src/utils/claudeApi.ts:368-370`
- `src/utils/claudeApi.ts:602-604`
