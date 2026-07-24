# Phase 14: In-App Quarterly Availability Editor - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two capabilities that let a worship leader manage volunteer input entirely inside WorshipPlanner, without hand-cleaning spreadsheets or pulling the whole-church directory:

1. **In-app quarterly availability editor** — the leader transcribes each volunteer's quarterly email reply directly into constrained controls (Sundays-only blackout calendar, frequency segmented control, must-serve-with pairing, quarter note). Edits write straight into the existing `PersonQuarterData` via the store — no CSV in the middle. The CSV import path stays as a secondary bulk option.
2. **Selective Planning Center import** — replace the current "import everyone" behavior with a scoped import that brings in only people currently serving on a **worship team** in **individually-scheduled roles**, excluding choir/orchestra positions.

Builds directly on Phase 13's data model, stores, scheduler, and quarter-Sundays generator. Does NOT change the scheduler's core algorithm except where the new frequency tiers require it. Deleting volunteers is already shipped (out of scope).
</domain>

<decisions>
## Implementation Decisions

### Navigation & UI
- **D-01:** Editor UI is **Variant A — Right drawer** from sketch `001-availability-editor`. Roster stays full-width and scannable; clicking a person's row slides the editor in from the right.
- **D-02:** The editor lives **on the Quarter/Schedule page**. The leader selects the active quarter first, then a roster list on that page opens the drawer per person. Keeps quarter context explicit and co-locates availability entry with where scheduling happens. (The availability data is quarter-scoped, so it belongs where the quarter is chosen — not on the standing Roster page.)
- **D-03:** Core drawer controls, per the sketch: Sundays-only blackout calendar (only real service dates clickable; "Nth Sunday" chips auto-select every Nth Sunday; date-range block selects the Sundays inside it), frequency segmented control with advanced raw 1-in-N override and live "≈ X of N Sundays" readout, must-serve-with typeahead → bidirectional chips, free-text quarter note.

### Frequency model
- **D-04:** Frequency presets map to the existing `Person.frequencyTargetN` (1-in-N cadence). Two presets need behavior beyond a plain cadence:
  - **As-needed fill-in = last resort:** scheduled ONLY to fill gaps no regular-cadence volunteer covers (lowest scheduling priority).
  - **Out this quarter = fully excluded:** never appears in proposals for that quarter.
- **D-05:** Model these as an explicit **frequency tier** (regular 1-in-N / fill-in / out) rather than overloading a magic N value, so the scheduler can distinguish "rarely" from "gap-only" from "excluded." Exact field placement (new `frequencyTier` on `Person`, vs. per-quarter on `PersonQuarterData`) → planner decides; note that "out this quarter" is quarter-scoped by nature while a standing cadence is on `Person`.

### Pairing scope
- **D-06:** Keep pairing to **bidirectional must-serve-with only** (the existing hard-constraint model, e.g. Julia ↔ Dean/Lisa serve the same dates). Reuse the bidirectional-sync logic `applyCsvToQuarter` already implements.
- **D-07:** The messier conditional rules seen in the sample notes ("schedule when Deb sings", "schedule only with Dean or Lisa if 1st Sundays") are captured in the **free-text quarter note** for the leader to honor manually — NOT modeled as structured constraints this phase.

### Selective Planning Center import
- **D-08:** Import is scoped **by PC worship team AND by role/position**. Bring in only people **currently serving on a worship team** in a **specific individually-scheduled role**.
- **D-09:** **Exclude choir and orchestra** — those are group roles WorshipPlanner does not fill by individual, so their PC members are not imported.
- **D-10:** Mechanism: surface the worship team's PC positions (via `fetchTeamPositions`) and let the leader include only the individually-filled ones (choir/orchestra excluded), mapping each included PC position → a WorshipPlanner `Role`. People serving those positions are imported; everyone else is skipped. Exact "who is currently serving this position" endpoint is a research item (PC Services team membership / assignment).
- **D-11:** Modify the existing **`RosterImportModal.vue`** + `fetchAndMapPeople` path rather than adding a parallel importer — replace the whole-directory fetch with the team→position→people flow.

### Claude's Discretion
- Whether the "Nth Sunday" chips / range picker cover all real patterns is validated during build against `docs/Sample Frequency Notes.csv`; refine controls if a common pattern can't be expressed.
- Exact persistence shape for the frequency tier (D-05) and the position→role mapping UI (D-10) — planner/researcher choose, honoring the locked behaviors above.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's design inputs
- `.planning/sketches/001-availability-editor/index.html` — chosen UI (**Variant A — Right drawer**); all core controls prototyped here.
- `.planning/sketches/001-availability-editor/README.md` — design question, variant descriptions, control specs.
- `docs/Sample Frequency Notes.csv` — the real, messy quarterly notes the editor structures; validate control expressiveness against it.

### Phase 13 foundation (this phase builds on it)
- `.planning/phases/13-volunteer-scheduling-import-servers-from-planning-center-col/13-CONTEXT.md` — locked data-model decisions (D-04 multi-person/role, D-06/D-18 standing vs quarter data, D-09 pairings, D-17 blackout ranges, D-18/D-19 quarter reset/replace-on-import).
- `.planning/phases/13-volunteer-scheduling-import-servers-from-planning-center-col/13-RESEARCH.md` — PC people-fetch research (esp. Pitfall 5: phone not fetchable).
- `src/types/roster.ts` — `Person`, `PersonQuarterData`, `Quarter`, `Role`, `UpsertPersonInput`, `DEFAULT_ROLES`.
- `src/stores/quarters.ts` — `applyCsvToQuarter` (the mutation the new editor reuses, incl. bidirectional pairing sync), `generateProposal`, `updateQuarter`.
- `src/stores/roster.ts` — `upsertPeople`, `deleteAllPeople` (already shipped; not in scope), roles config.
- `src/utils/quarterDates.ts` — quarter-Sundays generator (drives the Sundays-only calendar).
- `src/utils/volunteerCsv.ts` — `frequencyLabelToN` / `nToFrequencyLabel` / `expandBlackoutCell` (blackout expansion shape the editor must match).
- `src/utils/scheduler.ts` — weighted-fair-share proposal; consumes `frequencyTargetN`; must learn fill-in/out tiers (D-04/D-05).
- `src/utils/planningCenterApi.ts` — reuse `fetchServiceTypeTeams` (line ~106) and `fetchTeamPositions` (line ~587) for selective import; `fetchAndMapPeople` (line ~301 caller) is the whole-church fetch being replaced.
- `src/components/RosterImportModal.vue` — the PC import modal to modify (D-11).
- `src/views/QuarterView.vue` — where the editor drawer is added (D-02).

*No external specs/ADRs — requirements fully captured in the decisions above.*
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`quarters.applyCsvToQuarter` mutation pattern** — already writes `PersonQuarterData` (blackoutDates, pairedWith) with bidirectional pairing sync. The drawer editor calls the same store surface per person instead of a CSV batch.
- **`fetchTeamPositions(teamId)` + `fetchServiceTypeTeams(serviceTypeId)`** — existing PC client functions that make team+position-scoped selective import achievable without new API plumbing.
- **`quarterDates.ts` Sundays generator** — feeds the Sundays-only calendar so only real service dates are clickable.
- **`frequencyLabelToN` / `expandBlackoutCell`** — the editor's frequency presets and blackout output must produce the same shapes these already emit (keeps CSV path and editor path interchangeable).

### Established Patterns
- **Standing vs quarter-scoped data (Phase 13 D-18):** `roles` + `frequencyTargetN` live on `Person`; blackouts + pairings live per-quarter in `PersonQuarterData`. The frequency-tier decision (D-05) must respect this split — "out this quarter" is inherently quarter-scoped.
- **Blackouts stored expanded** as `YYYY-MM-DD[]` (ranges already expanded against `serviceDates`) — the calendar toggles/chips/ranges resolve to this list.
- **Modal-step flow** in `RosterImportModal.vue` (`idle → fetching → preview → importing → done`) — selective import adds a team/position selection step before preview.

### Integration Points
- New availability drawer mounts on `QuarterView.vue`, reads active quarter's `personQuarterData`, writes via `quarters` store.
- Selective import continues to feed the `roster` store's `upsertPeople`; only the PC-side fetch/filter changes.
- Scheduler (`scheduler.ts`) must honor fill-in-as-last-resort and out-this-quarter-excluded when consuming per-quarter data.
</code_context>

<specifics>
## Specific Ideas

- User explicitly wants the app to **control input shape** so nothing arrives as free-text/CSV that needs cleaning — the whole point of the editor.
- Chosen sketch variant is **A (right drawer)**, not B (master-detail) or C (inline expand).
- Real examples the design must handle (from the sample notes): Anne (monthly, 1st Sundays), Krystyn (only 2nd week available), David DeBoer (fill-in only), John Segard (out this quarter), Tim Paasche (~3-of-4), Julia Woodard (must-serve-with Dean/Lisa).
- Selective import driver: "Our worship volunteer list is much smaller and music-only; the PC list is everyone from our church." Choir/orchestra are group roles, not individually scheduled — do not import them.
</specifics>

<deferred>
## Deferred Ideas

- **Structured conditional pairing rules** (directional "A only when B serves", "with X if Nth Sundays") — captured in the quarter note for now (D-07); revisit as a future phase if manual handling proves painful.
- **Orphaned `personQuarterData` cleanup on `deleteAllPeople`** — known minor gap (deleting people leaves their blackouts/pairings on quarter docs). Low-risk given re-import + re-entry follows a clear; fix opportunistically, not required here.

*Otherwise: discussion stayed within phase scope.*
</deferred>

---

*Phase: 14-in-app-quarterly-availability-editor*
*Context gathered: 2026-07-07*
