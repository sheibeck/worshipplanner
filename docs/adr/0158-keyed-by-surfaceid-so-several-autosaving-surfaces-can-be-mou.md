# 0158. Keyed by surfaceId so several autosaving surfaces can be mounted

## Status

Accepted

## Context

This rationale is applied at 1 call site(s) within `src/stores/saveStatus.ts`. Documented at the time in `32-REVIEW, 32-UI-SPEC`.

Keyed by surfaceId so several autosaving surfaces can be mounted simultaneously without one surface's 'saved' erasing another's 'saving'.

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `WR-03`):

**`src/stores/saveStatus.ts:33-47`:**

```
 *
 * Keyed by surfaceId so several autosaving surfaces can be mounted
 * simultaneously without one surface's 'saved' erasing another's 'saving'.
 * This store holds no Firestore state at all — no orgId, no subscribe, no
 * unsubscribeAll.
 *
 * WR-03 (32-REVIEW): a `mostUrgent` cross-surface rollup (deterministic
 * urgency ranking + tie-break) used to live here, fully built and tested,
 * with no production consumer anywhere in `src/` — dead code as shipped.
 * Removed rather than kept "for later," per this codebase's own "don't
 * build more than is needed" convention (32-UI-SPEC § 4's toast-stacking
 * note makes the same call). Re-add it if/when a real cross-surface
 * indicator is planned — the deleted logic is in this phase's own review
 * fix commit for reference.
 */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/stores/saveStatus.ts:33-47`
