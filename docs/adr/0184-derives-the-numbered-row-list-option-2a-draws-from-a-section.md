# 0184. Derives the numbered row list option 2a draws from a (sections

## Status

Accepted

## Context

This rationale is applied at 2 call site(s) within `src/utils/songSectionOrder.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Derives the numbered row list option 2a draws from a (sections, order) pair. Skips an order id that resolves to no pooled section rather than emitting a row with an undefined section. Never mutates its arguments.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-01`):

**`src/utils/songSectionOrder.ts:31-38`:**

```
   * Unique within a single `buildSectionRows` result. Positionally derived
   * (`${sectionId}#${occurrenceIndex}`) — used for display/testid purposes
   * only. NOT stable across a mutation that changes which occurrence of a
   * repeated section comes first (drag reorder, duplicate/remove of an
   * earlier occurrence). Callers that need to track UI state (e.g.
   * expand/collapse) per physical row across such mutations must use
   * `stableKey` instead (WR-01).
   */
```

**`src/utils/songSectionOrder.ts:82-93`:**

```
 * Derives the numbered row list option 2a draws from a (sections, order)
 * pair. Skips an order id that resolves to no pooled section rather than
 * emitting a row with an undefined section. Never mutates its arguments.
 *
 * `slotIds`, when supplied, must be the same length as `order` — element
 * `i` is a stable identity for the order slot at `order[i]`, independent of
 * section id or position, exposed as `SectionRow.stableKey` (WR-01: lets a
 * caller track UI state, e.g. expand/collapse, per physical row across a
 * reorder/duplicate/remove instead of by the positionally-derived
 * `rowKey`). Omitted or mismatched-length `slotIds` falls back to `rowKey`
 * for `stableKey`, preserving prior behavior for callers that don't pass it.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/songSectionOrder.ts:31-38`
- `src/utils/songSectionOrder.ts:82-93`
