---
phase: 15-per-role-frequency-role-categories
plan: 05
subsystem: frontend
tags: [vue, pinia, tdd, roster-ui, per-role-frequency]

# Dependency graph
requires:
  - phase: 15-per-role-frequency-role-categories
    plan: 01
    provides: "Person.roleFrequencies?: Record<string, number> optional schema field"
  - phase: 15-per-role-frequency-role-categories
    plan: 03
    provides: "roster store persistence of roleFrequencies via UpsertPersonInput; D-03 read-time migration in onSnapshot"
provides:
  - "Per-role cadence controls in the Edit Volunteer form — one frequency <select> per held role (D-01), replacing the single Serve-frequency select"
  - "Newly-checked role defaults its cadence to monthly N=4 (D-02); existing roles load person.roleFrequencies?.[id] ?? person.frequencyTargetN ?? 4 (D-03 read-time)"
  - "onSaveVolunteer persists a roleFrequencies map through the roster store input"
  - "Roster-list frequency sort reconciled to order by each person's minimum per-role cadence (most-frequent role first) with a deterministic name tie-break, empty-map safe"
affects: [availability-drawer, quarter-grid]

# Tech tracking
tech-stack:
  added: []
  patterns: [reactive-per-key-map-bound-to-vfor-selects, read-time-default-chain, deterministic-min-with-name-tiebreak]

key-files:
  created:
    - src/views/__tests__/RosterView.test.ts
  modified:
    - src/views/RosterView.vue

key-decisions:
  - "formRoleFrequencies is a reactive Record<string, number> keyed by roleId; the v-for renders one cadence <select> ([1,2,4] via nToFrequencyLabel, reused unchanged) per checked role. Checking a role initializes its entry to 4 (D-02); unchecking deletes the entry"
  - "onEditPerson populates each held role via person.roleFrequencies?.[id] ?? person.frequencyTargetN ?? 4 so pre-migration people never appear reset to monthly (D-03 read-time, T-15-05-02 mitigation)"
  - "frequencyTargetN is still sent on save as the retained fallback; roleFrequencies is added alongside it, not replacing it"
  - "Frequency sort key computes Math.min over Object.values(roleFrequencies) plus frequencyTargetN, guarding the empty case by falling back to frequencyTargetN — no NaN/throw — with name as secondary tie-break for determinism"
  - "New RosterView.test.ts created (no prior test file for this view) mirroring the AvailabilityDrawer.test.ts mount + pinia harness convention"

requirements-completed: [D-01, D-02]

# Metrics
duration: ~15min

# Verification
automated:
  - "npx vitest run src/views/__tests__/RosterView.test.ts — 5/5 passed"
  - "npx vitest run (full suite) — 643/643 passed (one unrelated pre-existing flaky timeout in ServiceEditorView.test.ts under full-suite load; passes 3/3 in isolation)"
  - "npm run type-check (vue-tsc --build) — exits 0"
  - "grep confirms formRoleFrequencies in template (v-for/v-model), onEditPerson, and onSaveVolunteer; roleFrequencies added to store input"
human_verify:
  - "Per-role cadence controls verified in npm run dev by the user — one cadence dropdown per held role, newly-checked role defaults to Monthly, prior tuning preserved, independent per-role persistence, roster frequency sort sensible — APPROVED"
---

# 15-05 Summary: Per-Role Cadence Controls in the Edit Volunteer Form

Replaced the single "Serve frequency" select in the Edit Volunteer form with one cadence
control per role the person holds (D-01), defaulting blanks to monthly N=4 (D-02). This is
the user-facing point of the per-role frequency model: a leader can set Guitar weekly and
Vocals monthly for the same volunteer. Also reconciled the roster-list frequency-column
sort to order by each person's most-frequent role cadence deterministically.

## What was built

- **Per-role cadence UI** (`src/views/RosterView.vue`): a reactive `formRoleFrequencies`
  map backs a `v-for` over the checked roles, rendering one `nToFrequencyLabel`-driven
  `<select>` per held role. Newly-checked roles default to N=4; unchecked roles drop their
  entry. `onEditPerson` seeds each entry from `roleFrequencies?.[id] ?? frequencyTargetN ?? 4`;
  `onSaveVolunteer` persists the map via the store.
- **Reconciled frequency sort** (`src/views/RosterView.vue`): sorts by the minimum per-role
  cadence (empty-map safe, name tie-break) rather than silently pointing at the now-fallback
  `frequencyTargetN`.
- **New component test** (`src/views/__tests__/RosterView.test.ts`): asserts one control per
  held role, N=4 default, save payload includes `roleFrequencies`, and the sort ordering.

## Commits

- `d7c1276` test(15-05): add failing tests for per-role cadence controls + frequency sort
- `2dd3163` feat(15-05): per-role cadence controls in Edit Volunteer form
- `72a43b4` feat(15-05): reconcile roster frequency sort with per-role cadence

## Checkpoint

Task 3 was a blocking `checkpoint:human-verify`. The user verified the running app
(`npm run dev`) per the plan's how-to-verify steps and approved. No issues reported.

## Deviations

None — plan executed as written. TDD RED→GREEN sequence confirmed in git log.

## Self-Check: PASSED
