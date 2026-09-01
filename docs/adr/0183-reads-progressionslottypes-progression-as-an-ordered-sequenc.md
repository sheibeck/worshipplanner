# 0183. Reads PROGRESSIONSLOTTYPES[progression] as an ORDERED SEQUENCE of VW

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/utils/slotTypes.ts`. Documented at the time in `44-RESEARCH.md`.

Reads `PROGRESSION_SLOT_TYPES[progression]` as an ORDERED SEQUENCE of VW types, not a position lookup (Pitfall #2, 44-RESEARCH.md).

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/slotTypes.ts:372-382`:**

```

/**
 * Reads `PROGRESSION_SLOT_TYPES[progression]` as an ORDERED SEQUENCE of VW
 * types, not a position lookup (Pitfall #2, 44-RESEARCH.md). The map's keys
 * are absolute array indices that only mean anything against `buildSlots()`'s
 * fixed 9-slot layout — sorting those keys ascending and mapping to their
 * values yields the sequence a custom (arbitrary-shape) template must walk
 * by SONG ordinal instead.
 *
 * '1-2-2-3' → [1, 2, 2, 3, 3]   '1-2-3-3' → [1, 2, 3, 3, 3]
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/slotTypes.ts:372-382`
