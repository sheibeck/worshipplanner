# 0021. R164: an explicit maxInstances ceiling motivated by the highest-cost

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/index.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

R164: an explicit maxInstances ceiling motivated by the highest-cost route (the anthropic branch of `api` spends real money per call).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-02`):

**`functions/src/index.ts:232-241`:**

```

// R164: an explicit maxInstances ceiling motivated by the highest-cost route
// (the anthropic branch of `api` spends real money per call). NOTE (WR-02,
// accepted as won't-fix): `maxInstances` is a Cloud Functions v2 /
// Cloud Run FUNCTION-level setting on the single shared `onRequest` below --
// it caps the whole `api` function (esv/nlt/planningcenter traffic included),
// not just the anthropic upstream. That's intentional: esv/nlt/planningcenter
// also cost money to run, and there is no way to scope maxInstances to one
// upstream within a single function. Env-overridable so the owner can tune
// fan-out without a logic redeploy.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:232-241`
