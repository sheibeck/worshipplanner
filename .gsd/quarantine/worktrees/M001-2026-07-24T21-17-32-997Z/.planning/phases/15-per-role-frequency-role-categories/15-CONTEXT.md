# Phase 15: Per-Role Frequency & Role-Category Co-occurrence Rules - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Two linked scheduling-model changes, both building on Phase 13/14:

1. **Per-role serve frequency** — move serve cadence from one value per *person*
   (`Person.frequencyTargetN`) to an independent cadence per *(person, role)*.
   Someone can play Guitar weekly but sing Vocals monthly. This also splits the
   Phase 14 per-quarter availability **tier** (regular / fill-in / out) to be
   per-role.
2. **Same-service role co-occurrence rules (group-based)** — a person may hold
   more than one role on the same service, governed by role **group**. Groups
   become `tech | band | vocals | other` (vocals split out of band). **TECH is
   exclusive** (on tech → tech only that service); **BAND / VOCALS / OTHER
   combine freely**, capped at 1 BAND (instrument) and 1 VOCALS per person per
   service. Replaces the scheduler's per-person slot handling with a group-aware
   exclusivity + cardinality check.

In scope: `Role.group` enum extension + migration; per-role frequency schema +
one-time migration; per-role quarter tier + availability-drawer changes;
Edit-Volunteer-form per-role frequency UI; scheduler co-occurrence enforcement;
manual-grid warning surface.

Out of scope: structured conditional pairing rules (still Phase 14 quarter-note
territory); configurable co-occurrence matrix; any change to blackout-date or
pairing data shape (both stay per-person).
</domain>

<decisions>
## Implementation Decisions

### Per-role frequency (standing data)
- **D-01:** In the **Edit Volunteer form** (`RosterView.vue`), replace the single
  "Serve frequency" `<select>` with **one cadence control per role the person
  holds** — as a role is checked, that role gets its own frequency dropdown
  (role name + cadence select, one row per held role).
- **D-02:** A role with no explicitly chosen cadence (newly-added role, or a role
  left blank) defaults to **monthly (N=4)**.
- **D-03:** **One-time migration** of existing Phase 13/14 people: copy each
  person's current single `frequencyTargetN` onto **all roles they currently
  hold** (nothing already tuned is lost). Only roles added later or left blank
  fall back to the monthly default. This is a one-time transform when the
  per-role structure ships — not an ongoing behavior.
- **D-04:** `Person.frequencyTargetN` (single number) becomes a **per-role map /
  structure** keyed by roleId. Exact shape (e.g. `roleFrequencies: Record<roleId,
  number>` vs array) → planner decides, honoring D-01..D-03.

### Quarter tier reconciliation (quarter-scoped data)
- **D-05:** The per-quarter tier (`regular` / `fill-in` / `out`) becomes
  **per-role**. A person can be `out` for Tech this quarter but `regular` for
  Vocals. (Reconciles the Phase 14 `PersonQuarterData.frequencyTier`, which was
  one-per-person, into a per-role structure.)
- **D-06:** The **availability drawer** (`AvailabilityDrawer.vue`) shows **one
  tier control per role the person holds** for the active quarter (mirrors the
  D-01 roster layout).
- **D-07:** **Blackout dates and must-serve-with pairings stay per-person** — a
  blackout Sunday means the person is unavailable that day for *any* role;
  pairings remain person-to-person. Only cadence (D-04) and tier (D-05) go
  per-role. `PersonQuarterData.blackoutDates` / `pairedWith` shapes are unchanged.

### Role groups & migration
- **D-08:** **Extend the existing `RoleGroup` field** — do NOT introduce a
  separate "category" concept. `RoleGroup = 'tech' | 'band' | 'vocals' | 'other'`
  (adds `vocals`). Terminology stays "group"; the co-occurrence rules key off
  `group`.
- **D-09:** **Auto-classify existing roles on migration:** `band`→`band`,
  `tech`→`tech`, `other`→`other`, and the seeded **`vocals` role** (currently
  `group: 'band'`) → `vocals`. Leader can re-classify any role afterward in the
  roles config UI. `DEFAULT_ROLES` in `src/types/roster.ts` updates so `vocals`
  seeds with `group: 'vocals'`.

### Co-occurrence enforcement
- **D-10:** The co-occurrence rules are **hardcoded logic derived from `group`**,
  NOT a configurable matrix. Leaders only assign a group to each role. Rules:
  - **TECH is exclusive** — a person on a TECH role that service does TECH only
    (cannot combine with BAND / VOCALS / OTHER).
  - **BAND / VOCALS / OTHER combine freely.**
  - **Cardinality per person per service:** max **1 BAND** (instrument), max
    **1 VOCALS**; **OTHER is uncapped**.
- **D-11:** **Enforcement scope = auto-propose strictly obeys + manual warns.**
  The scheduler's generated proposal never creates an illegal combo. Manual grid
  edits that violate a rule are **allowed but flagged with a visible warning**
  (surfaced alongside the existing `unfilled` / `pairingConflicts` flags), keeping
  the leader in control rather than hard-blocking legitimate exceptions.
- **D-12:** In the scheduler (`src/utils/scheduler.ts`), replace / augment the
  per-role assignment loop so a candidate is ineligible for a role this date if
  it would violate group exclusivity (already on TECH, or role is TECH and they
  hold a non-TECH assignment) or a cardinality cap (already holds a BAND/VOCALS
  this date). Keep the function pure and deterministic.

### Claude's Discretion
- Exact persistence shape for the per-role frequency map (D-04) and the per-role
  tier structure (D-05) — planner/researcher choose, honoring the locked behaviors.
- Whether the scheduler expresses co-occurrence as an extra eligibility predicate
  in the existing `eligible()` filter vs. a separate post-pick guard.
- How the manual-grid warning is rendered (D-11) — reuse the existing conflict/
  unfilled flag pattern in `QuarterGrid.vue`.
- **RESEARCH ITEM:** how bidirectional pairing propagation (`propagatePairing` in
  `scheduler.ts`) interacts with same-person multi-role slots under the new
  cardinality caps — confirm a partner pulled in for a paired assignment still
  respects group exclusivity + caps.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's requirement source
- `.planning/todos/pending/per-role-frequency-and-vocal-instrument-pairing.md` —
  the originating request; the two linked changes, the co-occurrence matrix table,
  and the open design questions this discussion resolved. **This is the
  requirement set for Phase 15.**

### Phase 13/14 foundation (this phase modifies it)
- `src/types/roster.ts` — `RoleGroup` (extend to add `vocals`), `Role`, `Person`
  (`frequencyTargetN` → per-role map), `PersonQuarterData` (`frequencyTier` →
  per-role), `FrequencyTier`, `DEFAULT_ROLES` (reseed vocals as `group: 'vocals'`),
  `UpsertPersonInput`.
- `src/utils/scheduler.ts` — `proposeQuarterSchedule`; consumes `frequencyTargetN`
  and `frequencyTier`; the per-role assignment loop + `propagatePairing` gain the
  group exclusivity + cardinality check (D-10..D-12). Note: it currently has **no**
  cross-role same-service exclusion — Phase 15 adds it.
- `src/views/RosterView.vue` — Edit Volunteer form single "Serve frequency"
  `<select>` (line ~326) → per-role controls (D-01); `nToFrequencyLabel` usage in
  the frequency column (line ~127) and `frequency` sort key (line ~490/525) need
  per-role reconciliation; roles config UI is where re-classification (D-09) lives.
- `src/components/AvailabilityDrawer.vue` — per-quarter tier control → per-role
  (D-05/D-06).
- `src/components/QuarterGrid.vue` — manual assignment grid; surface the D-11
  co-occurrence warning here alongside existing unfilled/conflict flags.
- `src/components/AvailabilityRosterTable.vue` — per-person availability list that
  opens the drawer.
- `src/stores/quarters.ts` — `setPersonAvailability`, `applyCsvToQuarter`,
  `generateProposal`; per-role tier writes go through the store.
- `src/stores/roster.ts` — `upsertPeople`, roles config, `seedDefaultRolesIfEmpty`;
  the frequency-migration + vocals reclassification run against this data.
- `src/utils/volunteerCsv.ts` — `frequencyLabelToN` / `nToFrequencyLabel` /
  `expandBlackoutCell`; the CSV path must stay compatible with the new per-role
  shape (or degrade gracefully to a per-person default on import).
- `.planning/phases/14-in-app-quarterly-availability-editor/14-CONTEXT.md` —
  Phase 14 locked decisions (D-04/D-05 frequency tiers, D-06 pairing scope,
  standing-vs-quarter data split) that Phase 15 evolves.
- `.planning/phases/13-volunteer-scheduling-import-servers-from-planning-center-col/13-CONTEXT.md` —
  original roster/scheduler data-model decisions.

*No external specs/ADRs — requirements fully captured in the todo + decisions above.*
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`proposeQuarterSchedule` eligibility filter** (`scheduler.ts` line ~102 `eligible()`)
  — the natural insertion point for the group exclusivity + cardinality predicate;
  keep the function pure/deterministic (no wall-clock, no randomness).
- **Existing `unfilled` / `pairingConflicts` reporting arrays** (`ProposeResult`) —
  the manual-grid warning (D-11) can follow the same "report, don't fabricate/force"
  pattern already established.
- **`nToFrequencyLabel` / `frequencyLabelToN`** (`volunteerCsv.ts`) — reuse for the
  per-role cadence selects; presets map to the same 1-in-N values.
- **`RoleGroup` + `DEFAULT_ROLES`** — single enum extension + reseed handles the
  vocals split cleanly.

### Established Patterns
- **Standing vs quarter-scoped split (Phase 13 D-18):** roles + cadence live on
  `Person`; blackouts + pairings live per-quarter on `PersonQuarterData`. Per-role
  cadence stays standing (Person); per-role tier stays quarter-scoped
  (PersonQuarterData) — respect this split (D-04 vs D-05).
- **Optional-with-default migration pattern:** Phase 14's `frequencyTier?` defaults
  to `'regular'` when absent (`tierOf` in scheduler). Per-role fields should follow
  the same tolerant-read pattern so pre-migration data never throws.
- **Deterministic scheduler:** pure function, unit-tested (`scheduler.test.ts`) —
  new co-occurrence logic must be covered by TDD in the same file.

### Integration Points
- Edit Volunteer form (`RosterView.vue`) writes per-role cadence via `roster` store
  `upsertPeople`.
- Availability drawer writes per-role tier via `quarters` store `setPersonAvailability`.
- Scheduler consumes both when generating a proposal; `QuarterGrid.vue` surfaces
  manual-edit warnings.
- CSV import path (`VolunteerCsvImportModal.vue` / `volunteerCsv.ts`) must remain
  functional against the new per-role shape.
</code_context>

<specifics>
## Specific Ideas

- Canonical allowed combo the user cares about: **"1 instrument + vocals"** — this
  is exactly why vocals is split into its own group (D-08).
- User's mental model: "you can always be assigned to 1 instrument, and vocals";
  tech is a wholly separate responsibility that shouldn't mix.
- Migration must preserve tuning already done in Phases 13/14 (D-03) — leaders
  should not have to re-enter cadences.
- Terminology: the user is indifferent to "group" vs "category" — we keep the
  existing field name **`group`** and just add the `vocals` value.
</specifics>

<deferred>
## Deferred Ideas

- **Configurable co-occurrence matrix / cardinality caps** — rules are hardcoded
  from group this phase (D-10). Expose in settings only if a future church needs
  different combination rules.
- **Per-role blackout dates / pairings** — explicitly kept per-person this phase
  (D-07). Revisit only if role-specific date unavailability becomes a real need.
- **Structured conditional pairing rules** — still deferred from Phase 14 (D-07
  there); remains quarter-note territory.

*Otherwise: discussion stayed within phase scope.*
</deferred>

---

*Phase: 15-per-role-frequency-role-categories*
*Context gathered: 2026-07-08*
