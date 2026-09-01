# 0031. Resolve the app's usable share/sign-in base URL, or '' when

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/inviteOnboarding.ts`. Documented at the time in `99-RESEARCH.md`.

Resolve the app's usable share/sign-in base URL, or '' when unconfigured.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/inviteOnboarding.ts:66-72`:**

```

/**
 * Resolve the app's usable share/sign-in base URL, or '' when unconfigured.
 * Fresh module-private copy, verbatim shape ported from
 * functions/src/adminEmail.ts:50-54 -- resolveAppBaseUrl is module-private
 * there too (99-RESEARCH.md Pitfall 5), so it cannot be imported.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/inviteOnboarding.ts:66-72`
