---
phase: 89-multi-role-scheduling
reviewed: 2026-08-27T12:38:33Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - src/types/roster.ts
  - src/stores/roster.ts
  - src/stores/quarters.ts
  - src/utils/scheduler.ts
  - src/utils/__tests__/scheduler.test.ts
  - src/components/RoleSlideOver.vue
  - src/components/RolesConfigPanel.vue
  - src/components/QuarterGrid.vue
  - src/views/__tests__/RosterView.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: fixed
fix_note: "WR-01 (order-independence overclaim) fixed 2026-08-27 — no behavior change: corrected the misleading code comment at the propagateMultiRole call site in scheduler.ts and appended an empirically-verified correction to 89-RESEARCH.md B.4 (the schedule is deterministic for a fixed, stable role order but NOT order-independent for contested slots). IN-01 (two-multi-instruments config footgun) and IN-02 (O(n) find) accepted as out-of-scope/documented."
---

# Phase 89: Code Review Report

**Reviewed:** 2026-08-27T12:38:33Z
**Depth:** deep
**Files Reviewed:** 9 (plus test-fixture updates in RolesConfigPanel/QuarterGrid/AvailabilityDrawer/ServiceEditorView tests, spot-checked)
**Status:** issues_found (no blockers)

## Summary

This reviewed the Phase 89 rename (`Role.vocal` → `Role.multiRole`), the rewritten
`evaluateGroupCombo` filter-multi-first predicate, and the new `propagateMultiRole` same-date
bundling pass added to `proposeQuarterSchedule`, against `89-RESEARCH.md`/`89-CONTEXT.md`'s
design and the 9 enumerated pitfalls.

**Verified correct:**
- The compat shim in `src/stores/roster.ts` (`onSnapshot` for `roles`) maps both legacy shapes —
  `group:'vocals'` and the legacy `vocal` field name — to `multiRole` for **every** role, with
  the correct branch-specific defaulting (`?? true` only on the vocals-group branch). No role
  can silently lose the flag; no Firestore write migration occurs. Confirmed against 4 dedicated
  shim tests (`roster.test.ts:577-`), all passing.
- `evaluateGroupCombo` exactly matches RESEARCH A.3's filter-multi-first predicate; every edge
  case in the research's table (all-multi, multi+1 instrument, multi+2 instruments blocked,
  sound+sing cross-type allowed, non-multi cross-type still blocked, two non-multi band roles
  still blocked) has a direct unit test, all passing.
- `propagateMultiRole` is non-recursive, reuses `assignToRole` (no double-counting), is gated
  per-pulled-role by `isMultiRole` + `person.roles.includes` + not-already-assigned + regular
  tier + `withinCadence` + slot capacity + `isGroupCompatible`, and is fired from both trigger
  points (main loop, and inside `propagatePairing` for a pulled-in partner). Blackout safety
  relies correctly on the invariant that both callers (`chosen.id` in the main loop, `partnerId`
  in `propagatePairing`) are already blackout-filtered before `propagateMultiRole` is ever
  invoked — verified by reading both call sites. The `existingCalendar`/fillGaps seeding loop
  correctly does NOT call `propagateMultiRole` (Pitfall 7), confirmed by the coverage-bounded
  solo test. No `Math.random`/wall-clock usage was introduced.
- No leftover `.vocal`/`isVocal`/`buildIsVocal` references anywhere in `src/` outside the
  intentional legacy-shim compat code; `functions/src/serviceRoles.ts` is untouched, matching
  the research's no-deploy-required finding.
- Ran the full project gates as part of this review: `npm run type-check` (`vue-tsc --build`)
  is clean; the targeted phase test files (scheduler, roster, RoleSlideOver, RolesConfigPanel,
  QuarterGrid — 115 tests) all pass; the full app suite (`npx vitest run`) is green except the
  pre-existing documented `src/storage.rules.test.ts` baseline failure (Storage-emulator
  cross-service limitation, unrelated to this phase, per CLAUDE.md) — 4440 passed, 26 skipped.

**One design-claim vs. actual-behavior gap found and empirically confirmed** (see WR-01) — not
a functional defect against the owner's stated requirements (bundling is explicitly meant to be
a "strong preference" that can win contested slots), but it disproves a specific determinism
claim asserted in both `89-RESEARCH.md` §B.4 and the inline code comment at
`scheduler.ts:330-332`, which could mislead a future maintainer into believing role/template
ordering is provably inert.

## Warnings

### WR-01: `propagateMultiRole`'s outcome is NOT independent of template role order, contradicting the documented "commutative ⇒ order-independent" claim

**File:** `src/utils/scheduler.ts:244-277, 330-332`
**Also affects:** `.planning/phases/89-multi-role-scheduling/89-RESEARCH.md` §B.4 ("the final
set of a person's roles on a date ... independent of trigger order and template order") and
`.planning/phases/89-multi-role-scheduling/89-02-SUMMARY.md` ("order does not affect the final
bundled set since the pass is commutative").

**Issue:** The claim is true only for a single person's *own* multi-role set when there is no
cross-person contention for a shared slot. When two different people compete for the same
multi-role slot (count-limited), **which one wins depends on which multi-role gets processed
first in `rolesForDate` (i.e., `resolveRolesForDate`'s role-template order)** — because
`propagateMultiRole` can pre-claim a shared slot before the main loop's own scoring pass for
that role ever runs (this is exactly what the shipped "competition" test exploits and asserts,
just from one fixed template order — it was never tested against the *reversed* order to check
the claimed order-independence).

Empirical repro (verified live against the shipped code, using the exact `wl`/`ava` competition
fixture from `scheduler.test.ts:881-911`, with only the resolver's role order swapped):

```
bass-first template order [{bass,1},{vocals,1}]:   vocals winner = 'wl'   (bundling wins)
vocals-first template order [{vocals,1},{bass,1}]: vocals winner = 'ava' (direct scoring wins)
```

Same people, same `PersonQuarterData`, same date — different final calendar depending solely on
role-template order. This means:
1. The R260 "anchor on the rarest role" guarantee is not unconditional — it depends on the rare
   role being template-ordered before the roles it's meant to anchor, when a slot is contested.
2. If `role.order` (which drives `rolesForDate`/`buildResolveRolesForDate`) is ever changed —
   today only indirectly, via role creation order (`maxOrder + 1` in `RoleSlideOver.vue:245`) or
   direct Firestore edits — previously-stable contested-slot outcomes can silently flip on the
   next proposal, with no UI signal that order caused the change.
3. The inline code comment at `scheduler.ts:330-332` states this ordering "does not affect the
   final bundled set (commutative, RESEARCH B.4)" — this is inaccurate for the contested-slot
   case and will mislead the next person who touches this function into treating role reordering
   as always safe.

**Fix:** At minimum, correct the claim — narrow the code comment and RESEARCH.md's B.4 to state
the guarantee only holds absent same-slot, cross-person contention (which is the same residual
already correctly scoped in RESEARCH B.5 Pitfall 8, just not reconciled with the stronger B.4
wording). If true order-independence for the "anchor on rarest" behavior is desired, consider
sorting `rolesForDate` by ascending cadence-`n` (rarest-anchor-first) before the main loop's
role iteration, rather than trusting incidental template order — that would make the "anchor on
the rarest multi-role" outcome an invariant rather than a per-org role-creation-order accident.

```typescript
// scheduler.ts:330-332 — narrow the claim to match reality:
// R260 — fire after propagatePairing so a pulled partner is already present; order between
// this call and propagatePairing does not affect the final bundled set (both are commutative
// with respect to each other). NOTE: template role order (rolesForDate) DOES affect outcomes
// when two different people contend for the same multi-role slot — the earlier-processed
// multi-role can pre-claim it via bundling ahead of the later role's own scoring pass. See
// RESEARCH B.5 Pitfall 8 (accepted residual); this comment previously overstated the guarantee.
if (isMultiRole(roleId)) propagateMultiRole(chosen.id)
```

## Info

### IN-01: `evaluateGroupCombo`/`propagateMultiRole`'s cross-instrument exemption is a silent per-org footgun if two real instruments are both flagged multi-role

**File:** `src/utils/scheduler.ts:30-54, 244-277`
**Issue:** Documented and accepted in RESEARCH B.5 Pitfall 9 as a "config-time caution, not an
algorithm bug" — flagging two Band-group instrument roles (e.g., guitar AND bass) both
`multiRole: true` removes both from the one-instrument cap, letting one person legitimately hold
both instruments same-date. This is intentional per the generalized flag design, but there is no
UI warning in `RoleSlideOver.vue` when an admin checks "Multi-role" on a second Band instrument
role that could produce this outcome.
**Fix:** No code change required for this phase (correctly out of scope per RESEARCH). Consider
a future UX nudge (e.g., helper-text callout) if org admins report unexpected double-instrument
scheduling after flagging multiple Band roles as multi-role.

### IN-02: `propagateMultiRole` does one full linear `people.find` scan per invocation

**File:** `src/utils/scheduler.ts:264`
**Issue:** `people.find((p) => p.id === personId)` is O(n) and `propagateMultiRole` can be
invoked multiple times per date (once per multi-role assignment, from two trigger points). For
typical org roster sizes this is inconsequential; flagged only for completeness. Out of v1
review scope per the performance exclusion, included here as an FYI only — not a required fix.
**Fix:** Not required. If ever revisited, a `peopleById` Map built once per `proposeQuarterSchedule`
call (mirroring `pqdById`) would remove the scan, consistent with the existing `pqdById` pattern
already used for `PersonQuarterData` lookups.

---

_Reviewed: 2026-08-27T12:38:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
