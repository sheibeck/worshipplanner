# 0024. -- a disabled org must never reach even the cheapest of those checks

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/index.ts`. Documented at the time in `82-REVIEW`.

-- a disabled org must never reach even the cheapest of those checks. decodedCaller is always non-null here (anthropic is in SECRET_INJECTED, so the auth gate above already returned 401 for a null caller).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `CR-01`):

**`functions/src/index.ts:656-667`:**

```
      // -- a disabled org must never reach even the cheapest of those checks.
      // decodedCaller is always non-null here (anthropic is in
      // SECRET_INJECTED, so the auth gate above already returned 401 for a
      // null caller). resolveOrgId is used ONLY as a pointer to which org --
      // see checkOrgAiEnablement's own doc comment for why the live get()
      // inside it, not the claim payload, is the enforcement source.
      // CR-01 (82-REVIEW): an unresolvable org context must be a DENIAL, not
      // a skip. This proxy is a paid, per-org-gated resource -- a caller
      // whose token carries no `orgId` claim (an org-less authenticated
      // user, or a super-admin who entered an org with no synced membership
      // doc, R226) must never fall through to the Anthropic fetch below
      // un-gated.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:656-667`
