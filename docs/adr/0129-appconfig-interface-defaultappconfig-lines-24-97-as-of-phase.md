# 0129. AppConfig interface + DEFAULTAPPCONFIG (lines 24-97 as of Phase 69)

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/config/appConfigDefaults.ts`. Documented at the time in `70-RESEARCH.md`.

`AppConfig` interface + `DEFAULT_APP_CONFIG` (lines 24-97 as of Phase 69). This file is a DELIBERATE DUPLICATE, not an import.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/config/appConfigDefaults.ts:2-15`:**

```
// `AppConfig` interface + `DEFAULT_APP_CONFIG` (lines 24-97 as of Phase 69).
//
// This file is a DELIBERATE DUPLICATE, not an import. `src/` (Vite build) and
// `functions/` (Cloud Functions build) are separate build targets in this
// repo — a relative import across that boundary would either fail to resolve
// at build time or silently bundle server-only code into the client. See
// 70-RESEARCH.md Pitfall 2 / Anti-Patterns for the full rationale.
//
// If functions/src/appConfig.ts's DEFAULT_APP_CONFIG values ever change, this
// file MUST be updated by hand to match — that file carries a matching
// forward-pointing comment. `appConfigDefaults.test.ts`'s drift-guard/
// snapshot test hard-codes the values below so an unmirrored change fails
// loudly at test time, not just via a stale docs comment.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/config/appConfigDefaults.ts:2-15`
