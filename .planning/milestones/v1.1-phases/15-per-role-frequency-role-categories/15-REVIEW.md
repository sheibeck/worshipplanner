---
phase: 15-per-role-frequency-role-categories
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/components/QuarterGrid.vue
  - src/components/AvailabilityRosterTable.vue
  - src/stores/quarters.ts
  - src/components/__tests__/QuarterGrid.test.ts
  - src/components/__tests__/AvailabilityRosterTable.test.ts
  - src/stores/__tests__/quarters.test.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 15: Code Review Report (15-07 gap-closure)

**Reviewed:** 2026-07-09
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

> Scope note: this report covers the **15-07 gap-closure diff** (D-05 per-role `roleTiers`
> reconciliation) only, reviewed against `diff_base` e9225e0^. It supersedes the earlier
> full-phase review artifact for the three source files listed above.

## Summary

Focused adversarial review of the 15-07 gap-closure diff across `QuarterGrid.vue`
quick-assign, `AvailabilityRosterTable.vue` status/filter aggregation, and the
`setPersonAvailability` reciprocal pairing write in `quarters.ts`.

The three primary mechanisms called out for scrutiny are **correct**:

1. **Tier fallback chain** (`roleTiers?.[roleId] ?? frequencyTier ?? 'regular'`) in both
   `QuarterGrid.vue:308` and `AvailabilityRosterTable.vue:137` is byte-for-byte identical to
   the canonical `scheduler.ts:91-92` `tierOf`. No drift. The old per-person
   `frequencyTierOf` has no remaining callers (grep-verified).
2. **Most-restrictive aggregation** (`out > fillin > regular`) in `aggregateTier` correctly
   short-circuits `out` before `fillin` before `regular`.
3. **Branch-on-entry-existence reciprocal write** in `setPersonAvailability` correctly uses a
   scoped `personQuarterData.${partnerId}.pairedWith` sub-path for an existing partner
   (preserving their tuned `roleTiers`) and a complete defaulted entry (`blackoutDates: []`)
   for a brand-new partner. Both branches are directly covered by the two new gap-closure
   tests (`quarters.test.ts:545-590`).

One genuine correctness concern remains: the roster table's aggregate `out` status bleeds
into the **Frequency** and **Unavailable** columns, asserting false facts about a person who
is only out for a subset of their roles.

## Warnings

### WR-01: Aggregate `out` misrepresents a partially-out person as fully unavailable in the Frequency and Unavailable columns

**File:** `src/components/AvailabilityRosterTable.vue:216`, `:248`
**Issue:**
`quarterDataFor(person).frequencyTier` now returns the *aggregate* most-restrictive tier
(`aggregateTier`, line 168). That aggregate is consumed by three columns, but only the
**Status** pill is semantically an "any-role" audit signal. The other two consumers make
absolute, per-person claims that are false for a per-role-out volunteer:

- `freqBadge` (line 216): `if (pqd.frequencyTier === 'out') return '—'` — renders the
  Frequency column as `—` (nothing).
- `blackoutSummary` (line 248): `if (pqd.frequencyTier === 'out') return '— out all quarter —'`
  — renders the Unavailable column as **"out all quarter"**.

Concretely, the test fixture `person-out-role` ("Outrole Ollie") is `out` for `role-guitar`
but `regular` for `role-drums` (`AvailabilityRosterTable.test.ts:89`). Their row renders
Frequency `—` and Unavailable "— out all quarter —", even though they remain fully
schedulable for drums. On what the code comments call "the primary admin audit surface for
the per-role frequency feature," this can cause an admin to skip a volunteer who is actually
available. This misrepresentation is newly introduced by this diff — the pre-diff code read
the single per-person `frequencyTier`, so a `regular`-for-one-role person could never show as
"out all quarter." The new tests only assert the Status pill, so this regression is untested.

**Fix:** Gate the Frequency/Unavailable "out" shortcuts on a *fully*-out check rather than the
most-restrictive aggregate. For example:
```ts
// True only when every held role is 'out' (or legacy per-person out with no roleTiers).
function isFullyOut(person: Person): boolean {
  const pqd = props.quarter?.personQuarterData[person.id]
  if (!pqd?.roleTiers || Object.keys(pqd.roleTiers).length === 0) {
    return (pqd?.frequencyTier ?? 'regular') === 'out'
  }
  return person.roles.length > 0 && person.roles.every((r) => tierOf(person.id, r) === 'out')
}
```
Then `if (isFullyOut(person)) return '—'` in `freqBadge` and the "out all quarter" branch in
`blackoutSummary`, while the Status pill keeps using the most-restrictive `aggregateTier`.

## Info

### IN-01: `aggregateTier` doc comment contradicts its actual fallback behavior

**File:** `src/components/AvailabilityRosterTable.vue:145-154`
**Issue:** The comment states it "Falls back to the legacy per-person `frequencyTier` only
when `roleTiers` is absent/empty." That is not what the code does. When `roleTiers` is present
but does not cover every held role, `tierOf` (line 150 → 137) falls back to the legacy
`frequencyTier` for each *uncovered* role. So a person with
`roleTiers = { 'role-guitar': 'regular' }`, legacy `frequencyTier = 'out'`, and
`roles = ['role-guitar', 'role-drums']` aggregates to `out` (via the uncovered `role-drums`),
despite `roleTiers` being present and non-empty. This matches `scheduler.ts` semantics (so it
is not a behavioral bug relative to the scheduler), but the comment overstates the guarantee.
**Fix:** Reword to: "Falls back to the legacy per-person `frequencyTier` per-role for any held
role not present in `roleTiers`, and wholesale when `roleTiers` is absent/empty — mirroring
scheduler.ts tierOf."

### IN-02: `aggregateTier` reports `regular` for a person with no held roles even when `roleTiers` carries `out` entries

**File:** `src/components/AvailabilityRosterTable.vue:150-153`
**Issue:** `tiers` is built by mapping over `person.roles`. If `person.roles` is empty (e.g.
roles were removed from standing data after per-role tiers were tuned), `tiers` is `[]`, so
neither `includes('out')` nor `includes('fillin')` matches and the function returns
`regular` — even if `pqd.roleTiers` still contains `{ someRole: 'out' }`. Edge case, but it
silently downgrades a stale-but-restrictive record to `regular` on the audit surface.
**Fix:** When `person.roles` is empty but `roleTiers` is non-empty, aggregate over
`Object.values(pqd.roleTiers)` instead (or explicitly document that orphaned tiers are ignored).

### IN-03: `setPersonAvailability` would emit overlapping Firestore field paths on a self-pairing input (currently prevented only by UI)

**File:** `src/stores/quarters.ts:189-218`
**Issue:** If `data.pairedWith` ever contains `personId` itself, the `added` loop (line 193)
treats the person as their own new partner. Because their own entry exists, it writes the
scoped sub-path `personQuarterData.${personId}.pairedWith` (line 203) into the same `updates`
object that already holds the whole-object key `personQuarterData.${personId}` (line 190).
Firestore rejects an `updateDoc` payload targeting both a field and a nested sub-path of that
field ("field paths must not overlap"), so the write would throw. Self-pairing is currently
blocked upstream in `AvailabilityDrawer.vue:499` (`p.id !== props.personId`), so this is
unreachable today, but the store function has no defensive guard of its own.
**Fix:** Filter self-references at the top of `setPersonAvailability`, e.g.
`const nextPaired = data.pairedWith.filter((id) => id !== personId)`, and diff/write against that.

---

_Reviewed: 2026-07-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
