# 0170. Caller (quarters.ts) builds this from rosterStore.roles. Unknown

## Status

Accepted

## Context

This rationale is applied at 7 call site(s) within `src/utils/scheduler.ts`. No external review/research document is cited for this decision — it was a file-local judgment call.

Caller (quarters.ts) builds this from rosterStore.roles. Unknown roleIds default to 'other' (safe default) so existing call-sites that omit this param keep compiling and behave as "everything combines" (RESEARCH Pitfall...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`src/utils/scheduler.ts:55-61`:**

```

/**
 * Whether adding `candidateRoleId` to a person's already-assigned roleIds for a given date
 * (`assignedRoleIdsThisDate`) keeps the resulting combo legal (D-10/D-12). Pure/deterministic —
 * used by BOTH the main `eligible()` filter and `propagatePairing`'s role selection so paired
 * partners can never be pulled into an illegal combo (RESEARCH Pitfall 2).
 */
```

**`src/utils/scheduler.ts:78-89`:**

```
 * (person, role), not blended across a person's roles). Blackout dates (D-07) and pairings
 * (D-09) are hard constraints — never violated. Unfillable slots are reported in `unfilled`
 * rather than fabricating an assignment (D-10); pairings that can't be honored (partner
 * blacked out, out-tier for every eligible role, or no group-compatible role available) are
 * reported in `pairingConflicts` rather than silently dropped or forced. Group co-occurrence
 * rules (D-10) are enforced identically in both the main assignment loop and the pairing
 * propagation path via the shared `isGroupCompatible` helper (RESEARCH Pitfall 2).
 *
 * Pure function: no database reads/writes, no framework imports, no wall-clock reads, no
 * non-deterministic randomness — fully deterministic and unit-testable, mirroring the
 * pattern established by src/utils/suggestions.ts.
 */
```

**`src/utils/scheduler.ts:96-98`:**

```
  // Caller (quarters.ts) builds this from rosterStore.roles. Unknown roleIds default to 'other'
  // (safe default) so existing call-sites that omit this param keep compiling and behave as
  // "everything combines" (RESEARCH Pitfall 1).
```

**`src/utils/scheduler.ts:212-214`:**

```
        // D-12/Pitfall 2 — the CONFIRMED landmine: propagatePairing is a second, independent
        // role-selection path. It MUST apply the exact same shared group-compatibility check as
        // the main loop below, or a paired partner can silently be pulled into an illegal combo.
```

**`src/utils/scheduler.ts:236-241`:**

```
        // Residual scope boundary (RESEARCH Pitfall 4 / Open Question 1, consciously accepted):
        // this gate only constrains pull-ins via propagation. If the partner independently holds
        // a role the anchor does not, the main loop's spacing pass could in principle still pick
        // the partner directly on a date the anchor isn't serving at all, which a maximally strict
        // reading of containment would forbid. The canonical pairing shape (co-vocalists /
        // parent-child sharing the same role) does not hit this edge case, so it's shipped as-is.
```

**`src/utils/scheduler.ts:247-250`:**

```
        // R260 — a pulled-in paired partner who is themselves a multi-role holder also bundles
        // their own other multi-roles onto this date (RESEARCH Open Question 1: implement the
        // consistent version). Composes cleanly since propagateMultiRole is independent per
        // person (RESEARCH Pitfall 4).
```

**`src/utils/scheduler.ts:255-262`:**

```

    // R260 — same-date bundling of a person's OTHER multi-role assignments (RESEARCH B.2). A
    // NON-recursive single sweep (Pitfall 2: no infinite propagation) over the person's whole
    // role set for this date, triggered after every multi-role assignment (both here and inside
    // propagatePairing above). Each pulled role is gated by its OWN withinCadence + slot
    // capacity + isGroupCompatible via the shared assignToRole (never a parallel writer —
    // Pitfall 1, dedupes and increments servedByRole exactly once). No rarity sort, no deficit
    // scoring change — rarity-anchoring is emergent from withinCadence's even-spread gate (B.3).
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `src/utils/scheduler.ts:55-61`
- `src/utils/scheduler.ts:78-89`
- `src/utils/scheduler.ts:96-98`
- `src/utils/scheduler.ts:212-214`
- `src/utils/scheduler.ts:236-241`
- `src/utils/scheduler.ts:247-250`
- `src/utils/scheduler.ts:255-262`
