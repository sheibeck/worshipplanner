# 0078. ── Cross-field rule: rateLimitPerDay >= rateLimitPerMin (RESEARCH

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/components/admin/AiProxyConfigCard.vue`. No external review/research document is cited for this decision — it was a file-local judgment call.

── Cross-field rule: rateLimitPerDay >= rateLimitPerMin (RESEARCH Pitfall 4) ── ConfigNumberField's `update:modelValue` (70-02 addition) exposes the LIVE edited value so this reacts to what the owner is currently typing,...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/components/admin/AiProxyConfigCard.vue:71-74`:**

```
// Phase 70-02 (R186/R187) — AI Proxy card: three ConfigNumberField number
// knobs (incl. the rateLimitPerDay >= rateLimitPerMin cross-field rule, RESEARCH
// Pitfall 4) plus allowedModels as ONE comma-separated ConfigTextField (RESEARCH
// Pitfall 3 — split/trim/filter/require-non-empty before saving a string[]).
```

**`src/components/admin/AiProxyConfigCard.vue:121-126`:**

```

// ── Cross-field rule: rateLimitPerDay >= rateLimitPerMin (RESEARCH Pitfall 4) ──
// ConfigNumberField's `update:modelValue` (70-02 addition) exposes the LIVE
// edited value so this reacts to what the owner is currently typing, not just
// the last-saved effective value — a naive "compare only saved values" check
// would let a genuinely invalid save through.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/components/admin/AiProxyConfigCard.vue:71-74`
- `src/components/admin/AiProxyConfigCard.vue:121-126`
