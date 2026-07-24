---
phase: 15-per-role-frequency-role-categories
verified: 2026-07-09T00:00:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 11/12
  gaps_closed:
    - "D-05: The per-quarter role tier (roleTiers) is reconciled consistently across every read AND write path in the app, not just the scheduler and the availability drawer"
  gaps_remaining: []
  regressions: []
human_verification: []
---

# Phase 15: Per-Role Frequency & Role-Category Co-occurrence Rules — Verification Report

**Phase Goal:** Move serve frequency from one cadence per person to an independent cadence per (person, role) — someone can play Guitar weekly but sing Vocals monthly — and enforce same-service role compatibility by category. Role categories are TECH, BAND (instruments), VOCALS, and OTHER: TECH is exclusive; BAND/VOCALS/OTHER combine freely, capped at one BAND instrument per person per service. Replaces the scheduler's blanket one-slot-per-person/service check with a category exclusivity + cardinality check. Includes: role group classification/migration; migrating per-person frequencyTargetN to a per-role structure; reconciling Phase 14's per-person quarter frequencyTier with per-role cadence; and updating the Edit Volunteer form's single frequency control to per-role.

**Verified:** 2026-07-09
**Status:** passed
**Re-verification:** Yes — after gap-closure plan 15-07

## Goal Achievement

### Observable Truths (mapped to D-01..D-12)

| # | Truth (Decision) | Status | Evidence |
|---|---|---|---|
| 1 | Edit Volunteer form shows one cadence control per held role, replacing the single select (D-01) | VERIFIED (regression check — unchanged since prior pass) | `src/views/RosterView.vue:335` — `v-model.number="formRoleFrequencies[role.id]"` in a `v-for` over checked roles |
| 2 | New/blank role defaults to monthly N=4; existing roles load tuned value with fallback chain (D-02/D-03) | VERIFIED (regression check) | `RosterView.vue:451-457`, `478-484` — `person.roleFrequencies?.[roleId] ?? person.frequencyTargetN ?? 4` |
| 3 | One-time migration copies frequencyTargetN onto every currently-held role, idempotently (D-03) | VERIFIED (regression check) | `src/stores/roster.ts:59-74` patch-on-read, guarded on `roleFrequencies === undefined` |
| 4 | `Person.frequencyTargetN` becomes a per-role map/structure (D-04) | VERIFIED (regression check) | `src/types/roster.ts` `Person.roleFrequencies?: Record<string, number>` |
| 5 | Per-quarter tier (regular/fill-in/out) becomes per-role, consistently, across the app (D-05) | **VERIFIED (gap closed by 15-07)** | All four production read/write surfaces now reconcile `roleTiers`: `scheduler.ts:91-92` `tierOf`, `AvailabilityDrawer.vue` per-role controls, `QuarterGrid.vue:306-309` `tierOf(personId, roleId)` feeding `availableUnassigned`, `AvailabilityRosterTable.vue:135-186` `tierOf`/`aggregateTier`/`allRolesOut` feeding status pill, freqBadge, blackoutSummary, and the "out" filter; `quarters.ts` `setPersonAvailability` reciprocal write (lines 193-218) branches on partner-entry-existence to preserve `roleTiers` via scoped sub-path. `applyCsvToQuarter` intentionally left unreconciled (CSV workflow being retired — explicit scope fence in 15-07 plan, not a regression) |
| 6 | Availability drawer shows one tier control per held role for the active quarter (D-06) | VERIFIED (regression check) | `AvailabilityDrawer.vue:58-83` `v-for` over `heldRoles` bound to `draft.roleTiers[role.id]` |
| 7 | Blackout dates and pairings stay per-person, unaffected by this phase (D-07) | VERIFIED (regression check) | `PersonQuarterData.blackoutDates`/`pairedWith` shapes unchanged; 15-07's reciprocal-write fix only changes which dot-path carries `pairedWith`, not its per-person shape |
| 8 | `RoleGroup` extended with `'vocals'` as a first-class group (D-08) | VERIFIED (regression check) | `src/types/roster.ts:3` — `RoleGroup = 'band' \| 'tech' \| 'vocals' \| 'other'` |
| 9 | Existing roles auto-classified on migration; seeded `vocals` role reclassified band→vocals; leader can re-classify via roles config UI (D-09) | VERIFIED (regression check) | `roster.ts:85-93` patch-on-read migration; `RolesConfigPanel.vue:86` `<option value="vocals">` |
| 10 | Co-occurrence rules hardcoded from group: TECH exclusive; BAND/VOCALS capped at 1; OTHER uncapped (D-10) | VERIFIED (regression check) | `scheduler.ts` `evaluateGroupCombo`, TDD-covered |
| 11 | Enforcement scope: auto-propose strictly obeys the rules; manual grid edits that violate them are allowed but visibly flagged (D-11) | VERIFIED (regression check) | Scheduler applies `isGroupCompatible` in `eligible()`/`propagatePairing()`; `QuarterGrid.vue` renders non-blocking "Group conflict" badge |
| 12 | Scheduler eligibility check enforces group exclusivity/cardinality in BOTH the main assignment loop and `propagatePairing` (D-12), pure/deterministic | VERIFIED (regression check) | `scheduler.ts:170-172`, `:198-199` both call `isGroupCompatible`; `quarters.ts:245-252` wires `buildRoleGroupOf` into `generateProposal` |

**Score:** 12/12 truths verified (D-05 gap closed by plan 15-07)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/components/QuarterGrid.vue` | Per-(person,role) tier read consulting `roleTiers`, applied in `availableUnassigned`'s roleId-scoped filter | VERIFIED | `tierOf(personId, roleId)` at lines 306-309 reads `pqd?.roleTiers?.[roleId] ?? pqd?.frequencyTier ?? 'regular'`; `availableUnassigned` (313-322) calls `tierOf(p.id, roleId) !== 'out'` |
| `src/components/AvailabilityRosterTable.vue` | Status/badge/filter computed from `roleTiers` with legacy fallback | VERIFIED | `tierOf`/`aggregateTier`/`allRolesOut` (lines 135-169); `quarterDataFor` (173-186) derives `frequencyTier: aggregateTier(person)`; `activeFilter === 'out'` predicate (line 205) consumes it |
| `src/stores/quarters.ts` | Reciprocal partner write preserves partner's existing `roleTiers` | VERIFIED | `setPersonAvailability` (189-228): existing-entry branch writes only the scoped `personQuarterData.${partnerId}.pairedWith` dot-path (line 203); brand-new-partner branch seeds a complete defaulted entry (209-215) |
| `src/components/__tests__/QuarterGrid.test.ts` | Test proving per-role exclusion + legacy fallback | VERIFIED | New test (line 128) "excludes a person from a candidate list only for the role they are out for, per-role (D-05 gap closure)" |
| `src/components/__tests__/AvailabilityRosterTable.test.ts` | New test file proving aggregation + fallback + WR-01 fix | VERIFIED | 6 tests: per-role out/fillin aggregation, legacy fallback, no-entry default, partial-out-not-fully-unavailable (WR-01), fully-out legacy case |
| `src/stores/__tests__/quarters.test.ts` | Tests proving both reciprocal-write branches | VERIFIED | Lines 545-590: existing-entry scoped-write test + brand-new-partner complete-entry test |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `QuarterGrid.vue availableUnassigned` | `PersonQuarterData.roleTiers` | `tierOf(personId, roleId)` | WIRED | `QuarterGrid.vue:306-320` |
| `AvailabilityRosterTable.vue quarterDataFor` / `activeFilter 'out'` | `PersonQuarterData.roleTiers` | `aggregateTier` (most-restrictive across held roles) | WIRED | `AvailabilityRosterTable.vue:145-154, 173-186, 205` |
| `quarters.ts setPersonAvailability reciprocal write` | `PersonQuarterData.roleTiers` (partner) | entry-existence branch: scoped `pairedWith` sub-path (preserve) vs. full seeded object (new) | WIRED | `quarters.ts:193-218` |
| `scheduler.ts tierOf` | `PersonQuarterData.roleTiers` | canonical fallback chain (unchanged, regression-checked) | WIRED | `scheduler.ts:91-92` |
| `AvailabilityDrawer.vue onSave` | `quarters store setPersonAvailability` | `roleTiers` in payload (unchanged, regression-checked) | WIRED | `AvailabilityDrawer.vue` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `QuarterGrid.vue` quick-assign candidate list | `tierOf(personId, roleId)` | `props.quarter.personQuarterData[personId].roleTiers[roleId]`, written by `AvailabilityDrawer` via `setPersonAvailability` | Yes | FLOWING |
| `AvailabilityRosterTable.vue` status pill / "Out this quarter" filter | `aggregateTier(person)` | same `roleTiers` source, aggregated most-restrictive across `person.roles` | Yes | FLOWING |
| `quarters.ts` reciprocal partner write | partner's existing `roleTiers` | preserved via scoped sub-path when partner entry exists | Yes (no longer erased) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full test suite passes, no regressions | `npx vitest run` | 657/657 tests passed, 30 files (up from 648 baseline; +9 net for 15-07's new/extended tests) | PASS |
| Project compiles cleanly | `npm run type-check` | `vue-tsc --build` exits 0, no errors | PASS |
| Targeted 15-07 test files pass | `npx vitest run src/components/__tests__/QuarterGrid.test.ts src/components/__tests__/AvailabilityRosterTable.test.ts src/stores/__tests__/quarters.test.ts` | 44/44 tests passed (3 files) | PASS |
| `roleTiers?.[` present in QuarterGrid.vue (acceptance criterion) | `grep -n "roleTiers?\.\[" src/components/QuarterGrid.vue` | match at line 308 | PASS |
| `roleTiers` present in AvailabilityRosterTable.vue (acceptance criterion) | `grep -n "roleTiers" src/components/AvailabilityRosterTable.vue` | 5 matches | PASS |
| `roleTiers` reconciliation comment present in quarters.ts reciprocal write | `grep -n "roleTiers" src/stores/quarters.ts` | 3 matches around the branch logic | PASS |
| `applyCsvToQuarter` unchanged (scope fence honored) | manual read of `quarters.ts:125-161` | unchanged since before 15-07 (no `roleTiers` reference, matches intentional exclusion) | PASS |
| WR-01 (code-review warning) fixed | `grep -n "allRolesOut" src/components/AvailabilityRosterTable.vue` | `allRolesOut` gates `freqBadge`/`blackoutSummary`, distinct from `aggregateTier`'s status-pill use — commit `b1fe953` | PASS |

### Requirements Coverage (D-01..D-12)

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| D-01 | 15-05 | Per-role cadence control per held role in Edit Volunteer form | SATISFIED | `RosterView.vue` |
| D-02 | 15-01, 15-03, 15-05 | Blank/new role defaults to monthly N=4 | SATISFIED | `RosterView.vue`, `roster.ts` |
| D-03 | 15-03 | One-time migration preserves existing tuning | SATISFIED | `roster.ts` patch-on-read |
| D-04 | 15-01, 15-02, 15-03 | Person.frequencyTargetN → per-role map | SATISFIED | `roster.ts` types + store |
| D-05 | 15-01, 15-02, 15-04, 15-06, **15-07** | Per-quarter tier becomes per-role, consistently across the app | **SATISFIED (gap closed)** | Scheduler + drawer (established earlier) + QuarterGrid + AvailabilityRosterTable + quarters.ts reciprocal write (closed by 15-07); CSV path intentionally excluded (retiring workflow, explicit scope fence) |
| D-06 | 15-06 | Availability drawer per-role tier control | SATISFIED | `AvailabilityDrawer.vue` |
| D-07 | 15-01..15-04, 15-06 | Blackout/pairings stay per-person | SATISFIED | Unchanged shapes/handling |
| D-08 | 15-01 | RoleGroup extended with 'vocals' | SATISFIED | `roster.ts` types |
| D-09 | 15-01, 15-03 | Auto-classify + reclassify UI | SATISFIED | `roster.ts` migration + `RolesConfigPanel.vue` |
| D-10 | 15-02 | Hardcoded group co-occurrence rules | SATISFIED | `scheduler.ts` `evaluateGroupCombo` |
| D-11 | 15-02, 15-06 | Auto-propose strictly obeys; manual warns | SATISFIED | Scheduler + `QuarterGrid.vue` badge |
| D-12 | 15-02, 15-04 | Scheduler eligibility check both paths | SATISFIED | `scheduler.ts` both call sites; `quarters.ts` wiring |

No orphaned requirements — all D-01..D-12 satisfied, D-05 confirmed closed by this re-verification pass.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/stores/quarters.ts` | 129-140 | `applyCsvToQuarter` still constructs `PersonQuarterData` without `roleTiers`/`frequencyTier` | Info (accepted, out of scope) | Intentional per 15-07's explicit scope fence — CSV import workflow is being retired, not extended. Not treated as a gap per this verification's task instructions. |
| `src/components/AvailabilityRosterTable.vue` | 145-154 | `aggregateTier` doc comment slightly overstates fallback granularity (IN-01 in 15-REVIEW.md) | Info | Cosmetic comment-accuracy issue, not a behavioral bug — code matches `scheduler.ts` semantics |
| `src/components/AvailabilityRosterTable.vue` | 150-153 | `aggregateTier` returns 'regular' if `person.roles` is empty even when `roleTiers` has entries (IN-02) | Info | Edge case (orphaned tiers after role removal), not exercised by any current workflow |
| `src/stores/quarters.ts` | 189-218 | No defensive guard against `personId` self-pairing in `data.pairedWith` (IN-03) | Info | Unreachable today — blocked upstream in `AvailabilityDrawer.vue`; theoretical Firestore overlapping-path crash if that upstream guard is ever removed |

No unresolved `TBD`/`FIXME`/`XXX` debt markers found in the phase's modified files (verified via direct grep, zero matches).

### Human Verification Required

None. All `checkpoint:human-verify` tasks from 15-05/15-06 were already approved during original execution. Plan 15-07 is fully `autonomous: true` with automated acceptance criteria (grep patterns + test assertions), all of which pass. The WR-01 code-review warning was independently fixed and verified in code (commit `b1fe953`), not merely claimed.

### Gaps Summary

None. The single BLOCKER gap from the prior verification (D-05: per-quarter role tier not reconciled across `QuarterGrid.vue`'s quick-assign, `AvailabilityRosterTable.vue`'s status/filter, and `quarters.ts`'s reciprocal pairing write) has been closed by gap-closure plan 15-07:

1. **`QuarterGrid.vue`** — `frequencyTierOf(personId)` replaced with `tierOf(personId, roleId)`, mirroring `scheduler.ts`'s canonical fallback chain byte-for-byte; `availableUnassigned` now excludes per-(person,role), not per-person.
2. **`AvailabilityRosterTable.vue`** — new `tierOf`/`aggregateTier` functions compute a most-restrictive aggregate across held roles for the status pill and "Out this quarter" filter, with legacy `frequencyTier` fallback preserved. A follow-up code-review warning (WR-01: aggregate `out` falsely marking a partially-out person as fully unavailable in the Frequency/Unavailable columns) was caught and fixed in commit `b1fe953` via a separate `allRolesOut` predicate that requires ALL held roles to be out before those columns render the fully-unavailable treatment.
3. **`quarters.ts` `setPersonAvailability`** — the reciprocal must-serve-with partner write now branches on partner-entry-existence: an existing partner's entry is touched only via a scoped `pairedWith` sub-path (preserving their `roleTiers` and all other fields), while a brand-new partner still receives a complete, well-formed seeded entry (avoiding a partial-doc crash regression in downstream unguarded `.blackoutDates.includes()` reads).

The CSV-import `applyCsvToQuarter` gap flagged in the original verification was intentionally excluded from 15-07's scope — the CSV workflow is being retired, per explicit instruction from the task and the plan's own scope fence — and is correctly not treated as an open gap here.

All 44 new/extended tests pass, the full suite is green at 657/657 (up from the 648 baseline, +9 net), `vue-tsc --build` exits 0, and direct code inspection confirms the fallback chain `roleTiers?.[roleId] ?? frequencyTier ?? 'regular'` is now identical across all four production read surfaces (`scheduler.ts`, `AvailabilityDrawer.vue`, `QuarterGrid.vue`, `AvailabilityRosterTable.vue`) and correctly preserved across the one write surface that previously dropped it (`quarters.ts`).

D-05 is now fully reconciled. All 12 of Phase 15's locked decisions (D-01..D-12) are satisfied. Phase goal achieved.

---

_Verified: 2026-07-09_
_Verifier: Claude (gsd-verifier)_
