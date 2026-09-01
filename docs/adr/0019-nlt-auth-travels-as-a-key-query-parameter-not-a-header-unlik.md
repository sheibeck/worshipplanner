# 0019. NLT auth travels as a key QUERY PARAMETER, not a header — unlike the

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `functions/src/index.ts`. Documented at the time in `45-RESEARCH.md`.

NLT auth travels as a `key` QUERY PARAMETER, not a header — unlike the esv/ anthropic branches, which only ever rewrite `headers`.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`functions/src/index.ts:91-112`:**

```
/**
 * NLT auth travels as a `key` QUERY PARAMETER, not a header — unlike the esv/
 * anthropic branches, which only ever rewrite `headers`. `upstreamUrl` is built
 * once as a `const` before any service-specific branching runs (see below), so
 * this is a small pure helper rather than an inline mutation, both to avoid
 * restructuring that `const` into a `let` inline in the handler body and to be
 * unit-testable in isolation (Pitfall 6 / Assumption A2 — the `api` onRequest
 * handler otherwise has zero existing test precedent).
 *
 * For `esv`/`anthropic` (and any other service), the URL is returned
 * byte-unchanged — their secrets are injected into `headers` elsewhere, never
 * into the URL.
 *
 * For `nlt`, the `key` search param is always SET (overwritten, never merged)
 * to the server-held secret — a client-supplied `key=attacker` on the inbound
 * request must never survive onto the outbound URL (T-45-11, spoofing/quota
 * theft). This holds even though NLT's own upstream does not actually enforce
 * the key (verified live, 45-RESEARCH.md Pitfall 4: a missing or garbage key
 * still returns HTTP 200 with correct content) — the point of injecting here
 * is keeping NLT_API_KEY out of the client bundle, independent of whether the
 * upstream enforces it. Do NOT "fix" this by removing the injection.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `functions/src/index.ts:91-112`
