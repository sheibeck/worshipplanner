# 0142. Module-level (not store-internal) so both the toast fallback below

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/saveStatus.ts`. Documented at the time in `32-REVIEW, 32-UI-SPEC`.

WR-01 (32-REVIEW): module-level (not store-internal) so both the toast fallback below AND SaveStatusIndicator.vue's inline-error fallback share the identical string — 32-UI-SPEC § 4's "toast body always mirrors the inlin...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/stores/saveStatus.ts:11-16`:**

```

// WR-01 (32-REVIEW): module-level (not store-internal) so both the toast
// fallback below AND SaveStatusIndicator.vue's inline-error fallback share
// the identical string — 32-UI-SPEC § 4's "toast body always mirrors the
// inline text, word for word" contract would otherwise depend on two
// separately-maintained copies never drifting apart.
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/saveStatus.ts:11-16`
