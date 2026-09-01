# 0020. Cached form (no {fresh:true}) -- the api handler is a hot request

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `functions/src/index.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Cached form (no {fresh:true}) -- the api handler is a hot request path (R183); getFirestore() is already called later in this same handler (checkAndConsumeRateLimit/writeUsageLedger), so this is no new Firestore dependen...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`functions/src/index.ts:201-209`:**

```

/**
 * WR-01 fix: parses an env-var numeric knob so an operator's explicit `0`
 * (e.g. an emergency full-stop on `AI_RATELIMIT_MAX_PER_MIN=0`) is honored
 * rather than discarded. `Number(x) || fallback` treats a genuinely-parsed
 * `0` as falsy and silently replaces it with the default -- the opposite of
 * the caller's intent. Only an unset, blank/whitespace-only, or non-numeric
 * value falls back to `fallback`.
 */
```

**`functions/src/index.ts:678-689`:**

```

      // Cached form (no {fresh:true}) -- the api handler is a hot request
      // path (R183); getFirestore() is already called later in this same
      // handler (checkAndConsumeRateLimit/writeUsageLedger), so this is no
      // new Firestore dependency class, only an additional cached read.
      // Scoped to the anthropic branch only (review WR-01): esv/nlt/
      // planningcenter have no relationship to AI cost controls and must
      // stay Firestore-independent, exactly as before this phase. The read
      // itself is fail-open (same guardrail-not-security-control rationale
      // as the rate limiter below): a Firestore hiccup degrades the
      // anthropic route to DEFAULT_APP_CONFIG's limits rather than failing
      // the request outright.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:201-209`
- `functions/src/index.ts:678-689`
