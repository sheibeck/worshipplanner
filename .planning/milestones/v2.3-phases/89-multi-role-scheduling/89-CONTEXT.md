# Phase 89: Multi-Role Scheduling — Generalized Combinable Flag + Same-Date Bundling - Context

**Gathered:** 2026-08-27 (design settled with owner in v2.3 UAT discussion)
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the Phase-85 vocals-only "sing & play" exemption into a general, per-role **multi-role** concept, and
teach the quarterly scheduler to **bundle a person's multi-role assignments onto the same date**.
Requirements: R259 (the flag + co-occurrence rule), R260 (the same-date bundling weight in the scheduler).

Motivating example (owner): a worship leader who also sings and plays bass — three roles one person holds
that should be scheduled *together* on the same date, not scattered across the month.
</domain>

<decisions>
## Implementation Decisions (settled with owner 2026-08-27)

### R259 — the multi-role flag + co-occurrence rule
- **Generalize `Role.vocal` → a per-role multi-role flag** (name TBD by planner — candidates: `multiRole`,
  `combinable`; owner's working term is "multi-role"). Settable on ANY role in ANY group (not Band-only).
- **Vocals ships with the flag ON by default** — the generic flag REPLACES the Phase-85 vocals-specific
  exemption (no more special-casing vocals in the rule).
- **Helper text** on the control, e.g.: *"Multi-role: this person can serve this role alongside their
  other roles on the same date, and the scheduler tries to put their roles on the same day (e.g. sing +
  play bass + lead together) instead of spreading them out."*
- **New co-occurrence rule** (generalize `evaluateGroupCombo`): a multi-role role NEVER causes a conflict —
  it may co-occur with anything, **crossing Band/Tech/Other**. Concretely: filter the person's roles for a
  date down to the NON-multi-role ones, then apply the EXISTING rule to just those — Band↔Tech mutually
  exclusive, ≤1 Band **instrument**. So: sing (multi) + one instrument = OK; sound (tech) + sing (multi) =
  OK (cross-type); guitar + drums (both non-multi band) = still blocked; sound + guitar (both non-multi,
  cross-type) = still blocked. Non-multi-role roles keep the normal one-role-per-date exclusivity.
- The rule stays in the ONE shared pure function consumed by `proposeQuarterSchedule` (main loop +
  `propagatePairing`) AND `QuarterGrid.vue`'s warn badge — do not fork it.

### R260 — same-date bundling weight (the real engineering)
- **Anchor on the person's RAREST multi-role.** The lowest-cadence multi-role sets the bundling dates; the
  person's higher-cadence multi-role roles ride along on those dates AND fill their extra occurrences on
  other days. (Owner example: bass 1×/mo anchors; on the bass date also schedule vocals + worship-lead;
  the *second* vocals+lead date happens without bass.)
- **Riding along consumes cadence** — a bundled assignment counts toward that role's 1-in-N cadence like
  any other (so vocals bundled on the bass date is one of vocals' 2 monthly occurrences).
- **Strong preference, coverage-bounded ("more hard than soft").** Bundling is a firm weight, NOT an
  absolute: when it can't bundle (e.g. the person is the only bassist that week but already at their
  vocals cap), the role is still filled **solo** rather than left empty, and NO role ever exceeds its
  per-role cadence cap. It yields to other people's cadence/availability and to coverage.
- **Cross-type bundling is unrestricted** — any of a person's multi-role roles may be bundled regardless of
  group; there are no forbidden auto-bundle pairings.
- **Closest existing analog:** `propagatePairing` in `src/utils/scheduler.ts` already co-schedules a paired
  *person* onto the same date subject to cadence + group-compatibility. Multi-role bundling is the same
  shape but co-schedules a *single person's other multi-role roles* instead of a partner. The planner
  should extend/parallel that path (and its `withinCadence` gate + slot-capacity checks), NOT bolt on a
  second divergent scheduling pass. This phase almost certainly warrants a RESEARCH pass on the exact
  greedy-fair-share integration (anchor ordering vs. the template's role iteration order).

### Phasing / dependencies
- **Depends on Phase 88** (the RoleSlideOver that surfaces the flag control). Phase 88 keeps the current
  `vocal` Band-only checkbox as-is; Phase 89 renames/generalizes it (label → "Multi-role", show for any
  group, add helper text, vocals default-on).
- The flag rename ripples through everything Phase 85 touched: `src/types/roster.ts`, `src/utils/scheduler.ts`
  (`evaluateGroupCombo`/`isGroupCompatible`/`proposeQuarterSchedule`), `src/stores/roster.ts`/`quarters.ts`,
  `RolesConfigPanel.vue`/RoleSlideOver, `QuarterGrid.vue`, and the read-time compat shim
  (`group:'vocals'` legacy). If `functions/src/serviceRoles.ts` references the vocal/group model, update it
  too — that carries an **owner-gated Cloud Functions deploy** (like Phase 85's).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/scheduler.ts` — `evaluateGroupCombo`/`isGroupCompatible` (generalize to treat multi-role as
  always-compatible), `proposeQuarterSchedule` (greedy weighted-fair-share; per-(person,role) cadence via
  `withinCadence`/`roleFrequencyOf`), and `propagatePairing` (THE analog to extend for bundling).
- `src/types/roster.ts` — `Role.vocal` (rename), `RoleGroup`, `RoleFrequencyEntry`/cadence types.
- `src/stores/quarters.ts` — `buildIsVocal`/`buildRoleGroupOf` projections wired into `proposeQuarterSchedule`
  (rename `buildIsVocal` → the multi-role projection).
- `src/stores/roster.ts` — `DEFAULT_ROLES` (vocals gets the flag), the read-time `group:'vocals'` compat shim.
- `src/components/RolesConfigPanel.vue` / the Phase-88 RoleSlideOver — the flag control + helper text.
- `src/components/QuarterGrid.vue` — the warn badge that reuses `evaluateGroupCombo`.
- `functions/src/serviceRoles.ts` — server-side role/group model (check for vocal/group references).

### Established Patterns
- The Phase-85 rule + Phase-88 flag control are the substrate; this phase generalizes the flag and adds the
  scheduling weight. Keep the pure rule single-sourced (Phase-85 D-10/D-12 / RESEARCH Pitfall 2).
- `propagatePairing` shows how to co-schedule under cadence + capacity + group constraints without breaking
  the fairness math — mirror it for multi-role bundling.

### Integration Points
- Flag: `roster.ts` type → RoleSlideOver control (Phase 88) → `DEFAULT_ROLES` seed → compat shim.
- Rule: `evaluateGroupCombo` → scheduler main loop + `propagatePairing` + `QuarterGrid` warn.
- Bundling: `proposeQuarterSchedule` (new multi-role propagation, anchored on rarest, cadence-consuming).
- Server: `functions/src/serviceRoles.ts` (owner-gated deploy if touched).
</code_context>

<specifics>
## Specific Ideas

- Owner: "Worship leader is a custom role. When I lead worship I also sing and play bass… when I am
  scheduled we schedule all 3 together… weight them so they fall on the same date for the same person…
  more hard than soft… Even though I'd never do tech mixed with band, someone could set up sound and then
  sing — Multi-role should technically cross types."
- Owner: "Vocals would be the prime candidate, so by default it would be multi-role. Add helper text."
- Owner-ratified defaults: anchor on rarest; strong-but-coverage-bounded; cross-type unrestricted.
</specifics>

<deferred>
## Deferred Ideas

- None specific. (The flag NAME is planner's discretion within the owner's "multi-role" intent.)
</deferred>
