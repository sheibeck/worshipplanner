---
phase: 15-per-role-frequency-role-categories
verified: 2026-07-09T00:00:00Z
status: gaps_found
score: 11/12 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The per-quarter role tier (roleTiers, D-05) is reconciled consistently across every read AND write path in the app, not just the scheduler and the availability drawer"
    status: failed
    reason: >
      D-05 states the per-quarter tier "becomes per-role" without qualification. In the actual
      codebase, `scheduler.ts`'s `tierOf` and `AvailabilityDrawer.vue`'s per-role UI correctly
      read/write `roleTiers`, but two other production surfaces still read only the legacy
      per-person `frequencyTier` field, and two write paths silently drop `roleTiers` on
      unrelated saves. Net effect: marking a person "out" for one specific role via the new
      per-role UI is invisible to the manual grid's quick-assign candidate list and to the
      roster's "Out this quarter" filter/status badge — the exact scenario D-05 exists to
      support (per-role differentiation) silently fails outside the drawer/scheduler. This
      was independently confirmed by re-reading the flagged files, not merely trusting
      15-REVIEW.md's prose.
    artifacts:
      - path: "src/components/QuarterGrid.vue"
        issue: "frequencyTierOf (lines 304-306) reads only pqd?.frequencyTier ?? 'regular' — never roleTiers. This feeds availableUnassigned (lines 310-319), which backs the 'Available, not yet assigned' quick-assign list and the swap/add dropdowns in the manual grid. A person marked 'out' for role X via AvailabilityDrawer's new per-role control still appears as an eligible, freely-assignable candidate for role X here, with zero warning (unlike the group-combo rule, which is intentionally warn-not-block; this exclusion is a hard filter that is supposed to work, per the existing doc comment on frequencyTierOf claiming it 'mirrors the auto-proposal exclusion')."
      - path: "src/components/AvailabilityRosterTable.vue"
        issue: "quarterDataFor (lines 135-148) reads only pqd?.frequencyTier ?? 'regular' — never roleTiers. This backs freqBadge, statusLabel, statusPillClass, blackoutSummary, and the activeFilter === 'out' predicate (line 167). A person marked 'out'/'fill-in' for one or more roles via the new per-role UI still shows status 'Regular' in this table and will NOT appear when an admin filters to 'Out this quarter' — the primary UI surface admins use to audit per-quarter availability silently fails to reflect this phase's headline feature."
      - path: "src/stores/quarters.ts"
        issue: "setPersonAvailability's reciprocal-pairing write (lines 193-204) constructs a brand-new PersonQuarterData object for personQuarterData.<partnerId> carrying only personId/blackoutDates/pairedWith/frequencyTier/note — roleTiers is never copied from the partner's existing entry. Because this is a Firestore dot-path field replacement (not a merge), any per-role tier the partner had already tuned is silently erased the moment someone else adds them as a 'must serve with' partner, even though the partner's own availability entry was never opened for editing. Separately, applyCsvToQuarter (lines 135-139) rebuilds every CSV-matched person's PersonQuarterData from only personId/blackoutDates/pairedWith, unconditionally dropping frequencyTier/roleTiers/note on every CSV re-import — a documented, routine workflow."
    missing:
      - "QuarterGrid.vue: replace frequencyTierOf(personId) with a per-(person,role) tierOf(personId, roleId) reading roleTiers?.[roleId] ?? frequencyTier ?? 'regular', mirroring scheduler.ts's tierOf, and use it in availableUnassigned's roleId-scoped filter"
      - "AvailabilityRosterTable.vue: compute status/badge/filter from roleTiers (aggregate across the person's held roles, or a per-role breakdown), falling back to the legacy frequencyTier only when roleTiers is absent"
      - "quarters.ts setPersonAvailability: scope the reciprocal partner write to just the personQuarterData.<partnerId>.pairedWith sub-path (mirroring the 'removed' loop directly below it) instead of reconstructing the whole object, OR explicitly carry forward the partner's existing roleTiers"
      - "quarters.ts applyCsvToQuarter: preserve each existing entry's frequencyTier/roleTiers/note fields when rebuilding personQuarterData[row.personId] on CSV re-import"
human_verification: []
---

# Phase 15: Per-Role Frequency & Role-Category Co-occurrence Rules — Verification Report

**Phase Goal:** Move serve frequency from one cadence per person to an independent cadence per (person, role) — someone can play Guitar weekly but sing Vocals monthly — and enforce same-service role compatibility by category. Role categories are TECH, BAND (instruments), VOCALS, and OTHER: TECH is exclusive; BAND/VOCALS/OTHER combine freely, capped at one BAND instrument per person per service. Replaces the scheduler's blanket one-slot-per-person/service check with a category exclusivity + cardinality check. Includes: role group classification/migration; migrating per-person frequencyTargetN to a per-role structure; reconciling Phase 14's per-person quarter frequencyTier with per-role cadence; and updating the Edit Volunteer form's single frequency control to per-role.

**Verified:** 2026-07-09
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped to D-01..D-12)

| # | Truth (Decision) | Status | Evidence |
|---|---|---|---|
| 1 | Edit Volunteer form shows one cadence control per held role, replacing the single select (D-01) | VERIFIED | `src/views/RosterView.vue:335` — `v-model.number="formRoleFrequencies[role.id]"` in a `v-for` over checked roles; `RosterView.test.ts` asserts one control per held role; human-verify checkpoint (15-05 Task 3) approved by user |
| 2 | New/blank role defaults to monthly N=4; existing roles load tuned value with fallback chain (D-02/D-03-at-read-time) | VERIFIED | `RosterView.vue:451-457` (init to 4 on check), `478-484` (`person.roleFrequencies?.[roleId] ?? person.frequencyTargetN ?? 4`) |
| 3 | One-time migration copies frequencyTargetN onto every currently-held role, idempotently, without clobbering tuned values (D-03) | VERIFIED | `src/stores/roster.ts:59-74` — patch-on-read in people `onSnapshot`, guarded on `data.roleFrequencies === undefined`; `roster.test.ts` covers backfill + idempotency + non-clobber |
| 4 | `Person.frequencyTargetN` becomes a per-role map/structure (D-04) | VERIFIED | `src/types/roster.ts:25-28` `Person.roleFrequencies?: Record<string, number>`, retained `frequencyTargetN` fallback; persisted through `addPerson`/`updatePerson`/`upsertPeople` in `roster.ts:108-239` |
| 5 | Per-quarter tier (regular/fill-in/out) becomes per-role, consistently, across the app (D-05) | **FAILED** | See Gaps section — `scheduler.ts` and `AvailabilityDrawer.vue` correctly read/write `roleTiers`, but `QuarterGrid.vue`'s quick-assign candidate list and `AvailabilityRosterTable.vue`'s status/filter still read only the legacy per-person `frequencyTier`; two write paths in `quarters.ts` (reciprocal pairing write, CSV re-import) silently drop `roleTiers` |
| 6 | Availability drawer shows one tier control per held role for the active quarter (D-06) | VERIFIED | `src/components/AvailabilityDrawer.vue:58-83` — `v-for` over `heldRoles` rendering FREQ_PRESETS per role, bound to `draft.roleTiers[role.id]`; human-verify checkpoint (15-06 Task 3) approved by user |
| 7 | Blackout dates and pairings stay per-person, unaffected by this phase (D-07) | VERIFIED | `PersonQuarterData.blackoutDates`/`pairedWith` shapes unchanged in `roster.ts` types; `AvailabilityDrawer.vue` blackout/pairing handling untouched by the roleTiers additions |
| 8 | `RoleGroup` extended with `'vocals'` as a first-class group (D-08) | VERIFIED | `src/types/roster.ts:3` — `RoleGroup = 'band' \| 'tech' \| 'vocals' \| 'other'`; all 5 `Record<RoleGroup,...>` exhaustive maps across 4 Vue files updated; `npm run type-check` exits 0 |
| 9 | Existing roles auto-classified on migration; seeded `vocals` role reclassified band→vocals; leader can re-classify via roles config UI (D-09) | VERIFIED | `DEFAULT_ROLES` vocals entry is `group: 'vocals'` (`roster.ts` types); `src/stores/roster.ts:85-93` patch-on-read migration (case-insensitive `name==='vocals' && group==='band'` guard); `RolesConfigPanel.vue:86` adds `<option value="vocals">` |
| 10 | Co-occurrence rules hardcoded from group: TECH exclusive; BAND/VOCALS capped at 1; OTHER uncapped (D-10) | VERIFIED | `src/utils/scheduler.ts:20-39` — `evaluateGroupCombo` exported pure function; TDD-covered in `scheduler.test.ts` (TECH exclusivity both directions, 1-BAND cap, 1-VOCALS cap, OTHER uncapped, allowed 1-BAND+1-VOCALS combo) |
| 11 | Enforcement scope: auto-propose strictly obeys the rules; manual grid edits that violate them are allowed but visibly flagged (D-11) | VERIFIED | Scheduler applies `isGroupCompatible` in both `eligible()` and `propagatePairing()` (`scheduler.ts:170-172, 198-199`); `QuarterGrid.vue:69-74, 271-281` renders a non-blocking orange "Group conflict" badge computed live from `props.quarter.calendar` via the shared `evaluateGroupCombo`; human-verify checkpoint (15-06 Task 3) confirmed warn-don't-block behavior |
| 12 | Scheduler eligibility check enforces group exclusivity/cardinality in BOTH the main assignment loop and `propagatePairing` (D-12), pure/deterministic | VERIFIED | `scheduler.ts:170-172` (`propagatePairing`'s `eligibleRoles` filter) and `:198-199` (`eligible()` filter) both call `isGroupCompatible`; dedicated TDD case for the pairing landmine; `generateProposal` in `quarters.ts:236-256` wires `buildRoleGroupOf(rosterStore.roles)` into `proposeQuarterSchedule` so the rule is engaged in production, not just inside scheduler.ts's own tests |

**Score:** 11/12 truths verified (1 FAILED)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/types/roster.ts` | RoleGroup +'vocals', Person.roleFrequencies?, PersonQuarterData.roleTiers?, UpsertPersonInput.roleFrequencies?, DEFAULT_ROLES vocals reseed | VERIFIED | All fields present, additive/optional, retained fallbacks intact |
| `src/utils/scheduler.ts` | roleGroupOf param, exported evaluateGroupCombo/isGroupCompatible, per-role deficit/tier | VERIFIED | Confirmed by direct read; `ProposeResult` external shape unchanged |
| `src/stores/roster.ts` | patch-on-read migrations (D-03/D-09) + roleFrequencies persistence | VERIFIED | Guarded, idempotent, per-doc scoped |
| `src/stores/quarters.ts` | buildRoleGroupOf wired into generateProposal; roleTiers in setPersonAvailability | VERIFIED (primary write) / **PARTIAL** (secondary writes) | Main scoped write is correct; reciprocal-partner write and applyCsvToQuarter drop roleTiers (see gaps) |
| `src/views/RosterView.vue` | per-role cadence controls + reconciled frequency sort | VERIFIED | Confirmed by direct read + passing component test |
| `src/components/AvailabilityDrawer.vue` | per-role tier controls + roleTiers in save payload | VERIFIED | Confirmed by direct read; WR-01 (internal readout still gated on stale `frequencyTier`) is a cosmetic/info-level issue, not a functional block |
| `src/components/QuarterGrid.vue` | group-violation warning badge (D-11) reusing evaluateGroupCombo | VERIFIED (badge) / **FAILED** (roleTiers exclusion) | The D-11 badge is correctly implemented; the pre-existing quick-assign exclusion (`frequencyTierOf`) was NOT updated to read per-role tiers, defeating D-05 for this surface |
| `src/components/AvailabilityRosterTable.vue` | vocals chip class (D-08 exhaustiveness) | VERIFIED (chip) / **FAILED** (status/filter reconciliation) | Chip class map updated; status badge/filter still legacy-only |
| `src/components/RolesConfigPanel.vue` | Vocals group option + label + badge + grouped list | VERIFIED | Confirmed by direct read |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `eligible()` predicate | shared group-combo helper | `isGroupCompatible` call in filter | WIRED | `scheduler.ts:198-199` |
| `propagatePairing()` role selection | shared group-combo helper | same helper applied to `eligibleRoles` | WIRED | `scheduler.ts:170-172` |
| `quarters.ts generateProposal` | `proposeQuarterSchedule roleGroupOf` param | `buildRoleGroupOf(rosterStore.roles)` | WIRED | `quarters.ts:245-252`; end-to-end test uses `vi.importActual` to prove real enforcement, not just mock call-args |
| `quarters.ts setPersonAvailability` | Firestore `personQuarterData.<personId>` | scoped dot-path write including roleTiers | WIRED (primary) / **NOT WIRED** (reciprocal secondary write) | The person's own entry write is correct; the reciprocal partner-pairing write (lines 193-204) does not carry `roleTiers` forward |
| `AvailabilityDrawer onSave` | `quarters store setPersonAvailability` | `roleTiers` included in payload | WIRED | `AvailabilityDrawer.vue:529-535` |
| `QuarterGrid warning computed` | `scheduler.ts evaluateGroupCombo` | import shared pure helper | WIRED | `QuarterGrid.vue:195, 271-281` |
| `RosterView Edit Volunteer form` | roster store `updatePerson`/`addPerson` | `onSaveVolunteer` includes `roleFrequencies` | WIRED | `RosterView.vue:502-503` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `AvailabilityDrawer.vue` per-role tier buttons | `draft.roleTiers` | `loadDraft` seeds from `pqd?.roleTiers?.[id] ?? pqd?.frequencyTier ?? 'regular'`, saved via `setPersonAvailability` | Yes — real Firestore round-trip | FLOWING |
| `scheduler.ts` `tierOf`/deficit | `roleTiers`/`roleFrequencies` | `personQuarterData`/`Person` passed in from `quarters.ts`/`roster.ts` stores | Yes | FLOWING |
| `QuarterGrid.vue` quick-assign candidate list | `frequencyTierOf` | reads only `pqd.frequencyTier`, never `roleTiers` | Stale — the per-role value written by the drawer is never consulted here | **DISCONNECTED** (from the roleTiers source) |
| `AvailabilityRosterTable.vue` status/filter | `quarterDataFor().frequencyTier` | reads only `pqd.frequencyTier`, never `roleTiers` | Stale — same disconnect | **DISCONNECTED** (from the roleTiers source) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full test suite passes | `npx vitest run` | 648/648 tests passed, 29 files | PASS |
| Project compiles cleanly with new types | `npm run type-check` | exits 0, no errors | PASS |
| `vocals` present in all RoleGroup-keyed maps | `grep -rn "vocals:" src/views/RosterView.vue src/components/QuarterGrid.vue src/components/RolesConfigPanel.vue src/components/AvailabilityRosterTable.vue` | match in all 4 files | PASS |
| `isGroupCompatible` used in both scheduler paths | `grep -n "isGroupCompatible" src/utils/scheduler.ts` | present in both `eligible()` region and `propagatePairing` region | PASS |
| `roleTiers` reconciled everywhere it's read | manual review of `QuarterGrid.vue`/`AvailabilityRosterTable.vue`/`quarters.ts` | 2 read sites + 2 write sites still legacy-only | **FAIL** (see gaps) |

### Requirements Coverage (D-01..D-12)

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| D-01 | 15-05 | Per-role cadence control per held role in Edit Volunteer form | SATISFIED | `RosterView.vue` |
| D-02 | 15-01, 15-03, 15-05 | Blank/new role defaults to monthly N=4 | SATISFIED | `RosterView.vue`, `roster.ts` |
| D-03 | 15-03 | One-time migration preserves existing tuning | SATISFIED | `roster.ts` patch-on-read |
| D-04 | 15-01, 15-02, 15-03 | Person.frequencyTargetN → per-role map | SATISFIED | `roster.ts` types + store |
| D-05 | 15-01, 15-02, 15-04, 15-06 | Per-quarter tier becomes per-role | **BLOCKED (partial)** | Scheduler + drawer correct; QuarterGrid/AvailabilityRosterTable/reciprocal-write/CSV-reimport not reconciled |
| D-06 | 15-06 | Availability drawer per-role tier control | SATISFIED | `AvailabilityDrawer.vue`, human-approved |
| D-07 | 15-01, 15-02, 15-03, 15-04, 15-06 | Blackout/pairings stay per-person | SATISFIED | Unchanged shapes/handling confirmed |
| D-08 | 15-01 | RoleGroup extended with 'vocals' | SATISFIED | `roster.ts` types |
| D-09 | 15-01, 15-03 | Auto-classify + reclassify UI | SATISFIED | `roster.ts` migration + `RolesConfigPanel.vue` |
| D-10 | 15-02 | Hardcoded group co-occurrence rules | SATISFIED | `scheduler.ts` `evaluateGroupCombo` |
| D-11 | 15-02, 15-06 | Auto-propose strictly obeys; manual warns | SATISFIED | Scheduler + `QuarterGrid.vue` badge, human-approved |
| D-12 | 15-02, 15-04 | Scheduler eligibility check both paths | SATISFIED | `scheduler.ts` both call sites; `quarters.ts` wiring |

No orphaned requirements — all D-01..D-12 are claimed by at least one plan's `requirements:` frontmatter and cross-referenced above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/components/QuarterGrid.vue` | 304-306 | Stale-field read (`frequencyTierOf` reads legacy `frequencyTier` only) | Blocker | Defeats D-05 per-role exclusion for manual quick-assign (see gaps) |
| `src/components/AvailabilityRosterTable.vue` | 135-148, 164-168 | Stale-field read (`quarterDataFor` reads legacy `frequencyTier` only) | Blocker | Defeats D-05 visibility/audit for the primary admin status table (see gaps) |
| `src/stores/quarters.ts` | 193-204 | Whole-object reconstruction dropping a field (`roleTiers` omitted from reciprocal partner write) | Blocker | Silent data loss of a partner's tuned per-role tiers on an unrelated save |
| `src/stores/quarters.ts` | 135-139 | Whole-object reconstruction dropping fields (`frequencyTier`/`roleTiers`/`note` omitted from CSV re-import) | Blocker | Silent data loss on a routine, documented workflow (CSV re-import) |
| `src/components/AvailabilityDrawer.vue` | 86, 409-419 | Stale-field gating (`draft.frequencyTier` readout/N-input visibility not updated by the new per-role buttons) | Warning | Cosmetic inconsistency within the very component that introduced the per-role feature; does not block persistence |
| `src/utils/scheduler.ts` / `src/utils/volunteerCsv.ts` | 210-224 / 53-56 | Missing input validation (`n <= 0` unguarded; `"1-in-0"` accepted by CSV parser) | Warning | Could produce `Infinity`/`NaN` deficit scores under malformed CSV input; not part of D-01..D-12 scope but a latent robustness gap introduced/touched by this phase |
| `src/views/RosterView.vue` | 431, 467, 478, 502 | Dead/unreachable form field (`formFrequencyN` persisted but has no template control) | Info | Functionally harmless (documented fallback), confusing for maintainers |
| `src/components/AvailabilityDrawer.vue` vs `src/views/RosterView.vue` | 330-336 vs 440-442 | Inconsistent sort ordering between the two per-role role lists | Info | Same person's roles can list in different order in the two per-role UIs |

No unresolved `TBD`/`FIXME`/`XXX` debt markers found in the phase's modified files.

### Human Verification Required

None outstanding. Both blocking `checkpoint:human-verify` tasks in this phase (15-05 Task 3, 15-06 Task 3) were already executed and approved by the user during execution, per their SUMMARY.md records:
- 15-05: "Per-role cadence controls verified in npm run dev by the user ... APPROVED"
- 15-06: "Verified in npm run dev by the user ... APPROVED"

The gaps identified in this verification are code-level (read-site/write-site reconciliation), independently confirmed by direct file inspection — they do not require additional human/UI judgment to resolve.

### Gaps Summary

The phase delivers a solid, well-tested foundation for per-role frequency and group co-occurrence: the type schema (D-04/D-05/D-08), the migration (D-03/D-09), the scheduler's group-exclusivity + cardinality enforcement in both assignment paths (D-10/D-11/D-12), the Edit Volunteer form's per-role cadence UI (D-01/D-02), and the availability drawer's per-role tier UI (D-06) are all genuinely implemented, TDD-covered, type-checked, and human-verified where required.

However, the phase's explicit "reconciling Phase 14's per-person quarter frequencyTier with per-role cadence" inclusion (D-05) is only reconciled in two of the app's several `frequencyTier`-reading surfaces (the scheduler and the availability drawer). The independent code review (15-REVIEW.md) is corroborated by direct inspection here: `QuarterGrid.vue`'s manual quick-assign candidate list and `AvailabilityRosterTable.vue`'s status badge/"Out this quarter" filter both still read only the legacy per-person `frequencyTier`, so a person marked "out" for a specific role through the new per-role UI silently remains assignable in the manual grid and shows as "Regular" in the primary admin audit table — the exact per-role differentiation D-05 exists to deliver fails outside the two surfaces that were directly touched by this phase's plans. Additionally, two `quarters.ts` write paths (the reciprocal must-serve-with partner write in `setPersonAvailability`, and the CSV re-import in `applyCsvToQuarter`) reconstruct `PersonQuarterData` objects that omit `roleTiers` (and, in the CSV case, also `frequencyTier`/`note`), causing silent data loss of already-tuned per-role tiers on unrelated saves.

These are judged as in-scope goal gaps, not out-of-scope follow-ups, because: (1) D-05 states the tier "becomes per-role" without qualifying which surfaces; (2) the roadmap's phase goal explicitly lists "reconciling Phase 14's per-person quarter frequencyTier with per-role cadence" as an inclusion, and reconciliation that only holds in 2 of 4+ read/write surfaces is not "reconciled"; (3) the data-loss write paths directly threaten the non-clobber guarantee this phase's own plans promised elsewhere (D-03's roster-side non-clobber precedent was explicitly established and should extend to the quarter-side write paths that touch the same `roleTiers` field); and (4) there is no later phase in ROADMAP.md to defer this to — Phase 15 is the last substantive phase (999.1 is an unrelated backlog item).

---

_Verified: 2026-07-09_
_Verifier: Claude (gsd-verifier)_
