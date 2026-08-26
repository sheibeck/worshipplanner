# Phase 85: Team Conflicts — Vocals into Band & One-Team-Per-Date - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Reshape the roster/scheduler role-group co-occurrence rule so that **Vocals folds into the Band team**
and a volunteer can't serve on two conflicting teams on the same date, with **Vocals as the single
special-case exception**. Requirements: R250 (vocals→band), R251 (one-team-per-date conflict), R252
(vocals multi-person + sing-and-play exception).

The rule lives in ONE shared pure module today — `src/utils/scheduler.ts::evaluateGroupCombo` /
`isGroupCompatible` (D-10) — consumed by the auto-scheduler (`proposeQuarterSchedule`) AND the manual
quarter grid warn badge (`QuarterGrid.vue`, D-11). Keep it that way: one rule, multiple consumers.
</domain>

<decisions>
## Implementation Decisions

### Exclusivity scope — owner: "Only Band ↔ Tech" (Area 1)
- **Band and Tech are mutually exclusive per date**: a person holding a Band role that date cannot also
  hold a Tech role that date, and vice versa.
- **"Other" combines freely** with a Band OR a Tech assignment (this RELAXES the current rule, where
  TECH was exclusive of *everything* including Other — Other↔Tech and Other↔Band are now both allowed).
- This is a per-DATE rule (a service is on a date), matching the current per-date evaluation.

### Vocals into Band + the exception — owner (Area 2)
- **Vocals folds into the Band team** (R250): for team-exclusivity purposes a vocals assignment counts as
  **Band** (so vocals conflicts with Tech, combines with Other).
- **Vocals is exempt from the one-instrument cap** (R252): the Band cap is "at most ONE band *instrument*
  role per person per date"; a person may additionally hold **Vocals** (sing AND play). Vocals does not
  count toward the instrument cap.
- **"Vocals is the only thing multiple people can do"** — interpret as: vocals combines and can have many
  people. **Leave existing per-role counts as the multiplicity control** — do NOT add a new hard
  one-person cap to every other role (owner chose "leave role counts as-is").

### Enforcement strength (Area 3)
- **Auto-scheduler hard-blocks** (unchanged mechanism): `isGroupCompatible` keeps filtering out illegal
  candidates in `proposeQuarterSchedule`.
- **Manual surfaces warn-don't-block** (owner): the `QuarterGrid.vue` D-11 group-violation badge stays a
  WARNING, not a block — coordinators keep the override. Update its rule to the new Band↔Tech +
  vocal-exempt semantics (it already calls `evaluateGroupCombo`, so it inherits the change).
- The per-service Roles tab (`ServiceEditorView.vue`) does NOT currently do co-occurrence warnings — do
  not add a new blocking gate there; a warn is optional/at planner discretion only if that surface
  already assigns volunteers per date. Do not expand scope.

### Mechanism + migration (Area 3 — Claude's discretion, semantics fixed above)
- **RoleGroup team identity becomes `'band' | 'tech' | 'other'`** (drop `'vocals'` as a team). Distinguish
  a vocal role from an instrument role via an explicit role-level flag (e.g. `vocal?: boolean` on `Role` /
  projected into the scheduler), NOT a magic role name (churches can rename/add roles).
- `evaluateGroupCombo` / `isGroupCompatible` gain the vocal information they need (e.g. an `isVocal`
  predicate alongside `roleGroupOf`) so the instrument cap can exempt vocals. Update BOTH the main loop
  and `propagatePairing` (they share `isGroupCompatible`, so one change covers both — RESEARCH Pitfall 2).
- **DEFAULT_ROLES:** the seeded `vocals` role moves to `group: 'band'` with the vocal flag set.
- **Backward-compat (no data-migration write required):** existing per-org roles stored with
  `group: 'vocals'` must still work — coerce `'vocals'` → `{ group: 'band', vocal: true }` at read time
  (a compat shim), so no Firestore migration is needed and old data can't break the type.
- **RolesConfigPanel.vue:** remove the standalone **Vocals** group `<option>` (and the `'vocals'` entries
  in `groupOrder`/`groupLabels`/`groupBadgeClasses`); represent a vocal role as a Band role carrying the
  vocal flag (e.g. a "vocal role (can sing & play)" checkbox when group = Band). Its description already
  reads "grouped by Band, Tech, and Other" — this aligns the code with the copy that's already shipped.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/scheduler.ts` — `evaluateGroupCombo(roleIds, roleGroupOf)` (the D-10 rule to rewrite),
  `isGroupCompatible` (shared by main loop + `propagatePairing`), `proposeQuarterSchedule`.
- `src/types/roster.ts` — `RoleGroup` type (line 3), `Role`/`RoleSlotConfig` shapes, `DEFAULT_ROLES`
  (lines 100–107; `vocals` at line 102 currently `group: 'vocals'`).
- `src/components/QuarterGrid.vue` — `cellHasGroupViolation` calls `evaluateGroupCombo`; `roleGroupOf`
  reads `r.group`. Warn badge (D-11) — keep warn semantics.
- `src/components/RolesConfigPanel.vue` — the add/edit roles UI exposing the 4 group options incl.
  `vocals` (`groupOrder`, `groupLabels`, `<option value="vocals">`, line ~89); description line 6 already
  says "Band, Tech, and Other".
- `src/stores/quarters.ts` (D-12, ~line 258) — projects `Role[] → roleId → RoleGroup` for the scheduler;
  update to also project the vocal flag.
- `src/stores/roster.ts` — roles store + seeding (`DEFAULT_ROLES`); the read-time compat shim for
  `group: 'vocals'` belongs here or at the type-projection boundary.

### Established Patterns
- Current D-10 rule: TECH exclusive of all; ≤1 BAND, ≤1 VOCALS; OTHER uncapped. New rule: Band↔Tech
  exclusive; ≤1 band INSTRUMENT (vocals exempt); Other combines with either.
- The pure rule is unit-tested in `src/utils/__tests__/scheduler.test.ts` — update those group-combo cases
  and add: tech+band blocked, tech+other allowed, band+other allowed, band-instrument+vocals allowed,
  two-instruments blocked, legacy `group:'vocals'` coerced to band+vocal.

### Integration Points
- Auto-scheduler (`quarters.ts` → `proposeQuarterSchedule`) — hard block via `isGroupCompatible`.
- `QuarterGrid.vue` warn badge — inherits the rule change (already calls `evaluateGroupCombo`).
- `RolesConfigPanel.vue` — group options + vocal representation.
</code_context>

<specifics>
## Specific Ideas

- Owner's canonical example: "if you are running tech, you can't also be in the band." Tech↔Band is the
  hard conflict. "You can be on vocals and you can play an instrument" — vocals + one instrument is the
  allowed combo. "Vocals is the only thing you can have multiple people doing."
- Keep the rule change confined to the ONE shared pure function so auto-scheduler and manual grid stay in
  lockstep (the D-12/Pitfall-2 landmine: two independent role-selection paths must use the same check).
</specifics>

<deferred>
## Deferred Ideas

- Adding a brand-new co-occurrence warning to the per-service Roles tab (ServiceEditorView) — out of
  scope unless that surface already assigns volunteers per date; do not build a new gate.
- A one-time Firestore data migration of `group:'vocals'` roles — avoided via a read-time compat shim
  (no write migration in this phase).
- Hard-blocking on manual surfaces — owner chose warn-don't-block; the coordinator override stays.
- A hard one-person cap on non-vocals roles — owner chose to leave per-role counts as the control.
</deferred>
