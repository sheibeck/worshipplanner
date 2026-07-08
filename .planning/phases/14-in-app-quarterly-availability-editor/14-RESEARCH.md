# Phase 14: In-App Quarterly Availability Editor - Research

**Researched:** 2026-07-07
**Domain:** In-app form-driven data entry replacing CSV round-trip; scoped Planning Center Services v2 team/position/assignment fetch; scheduler tier-aware candidate filtering; Firestore quarter-scoped sub-field editing
**Confidence:** MEDIUM-HIGH (drawer/store architecture HIGH — pure extension of proven Phase 13 patterns already in this codebase; PC `PersonTeamPositionAssignment` endpoint MEDIUM-HIGH — confirmed via PC's live docs site with full attribute/endpoint list, not via an authenticated live call; frequency-tier field placement MEDIUM — required interpretation of an intentionally-deferred CONTEXT.md decision, flagged in Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Navigation & UI
- **D-01:** Editor UI is **Variant A — Right drawer** from sketch `001-availability-editor`. Roster stays full-width and scannable; clicking a person's row slides the editor in from the right.
- **D-02:** The editor lives **on the Quarter/Schedule page**. The leader selects the active quarter first, then a roster list on that page opens the drawer per person. Keeps quarter context explicit and co-locates availability entry with where scheduling happens. (The availability data is quarter-scoped, so it belongs where the quarter is chosen — not on the standing Roster page.)
- **D-03:** Core drawer controls, per the sketch: Sundays-only blackout calendar (only real service dates clickable; "Nth Sunday" chips auto-select every Nth Sunday; date-range block selects the Sundays inside it), frequency segmented control with advanced raw 1-in-N override and live "≈ X of N Sundays" readout, must-serve-with typeahead → bidirectional chips, free-text quarter note.

#### Frequency model
- **D-04:** Frequency presets map to the existing `Person.frequencyTargetN` (1-in-N cadence). Two presets need behavior beyond a plain cadence:
  - **As-needed fill-in = last resort:** scheduled ONLY to fill gaps no regular-cadence volunteer covers (lowest scheduling priority).
  - **Out this quarter = fully excluded:** never appears in proposals for that quarter.
- **D-05:** Model these as an explicit **frequency tier** (regular 1-in-N / fill-in / out) rather than overloading a magic N value, so the scheduler can distinguish "rarely" from "gap-only" from "excluded." Exact field placement (new `frequencyTier` on `Person`, vs. per-quarter on `PersonQuarterData`) → planner decides; note that "out this quarter" is quarter-scoped by nature while a standing cadence is on `Person`.

#### Pairing scope
- **D-06:** Keep pairing to **bidirectional must-serve-with only** (the existing hard-constraint model, e.g. Julia ↔ Dean/Lisa serve the same dates). Reuse the bidirectional-sync logic `applyCsvToQuarter` already implements.
- **D-07:** The messier conditional rules seen in the sample notes ("schedule when Deb sings", "schedule only with Dean or Lisa if 1st Sundays") are captured in the **free-text quarter note** for the leader to honor manually — NOT modeled as structured constraints this phase.

#### Selective Planning Center import
- **D-08:** Import is scoped **by PC worship team AND by role/position**. Bring in only people **currently serving on a worship team** in a **specific individually-scheduled role**.
- **D-09:** **Exclude choir and orchestra** — those are group roles WorshipPlanner does not fill by individual, so their PC members are not imported.
- **D-10:** Mechanism: surface the worship team's PC positions (via `fetchTeamPositions`) and let the leader include only the individually-filled ones (choir/orchestra excluded), mapping each included PC position → a WorshipPlanner `Role`. People serving those positions are imported; everyone else is skipped. Exact "who is currently serving this position" endpoint is a research item (PC Services team membership / assignment).
- **D-11:** Modify the existing **`RosterImportModal.vue`** + `fetchAndMapPeople` path rather than adding a parallel importer — replace the whole-directory fetch with the team→position→people flow.

### Claude's Discretion
- Whether the "Nth Sunday" chips / range picker cover all real patterns is validated during build against `docs/Sample Frequency Notes.csv`; refine controls if a common pattern can't be expressed.
- Exact persistence shape for the frequency tier (D-05) and the position→role mapping UI (D-10) — planner/researcher choose, honoring the locked behaviors above.

### Deferred Ideas (OUT OF SCOPE)
- **Structured conditional pairing rules** (directional "A only when B serves", "with X if Nth Sundays") — captured in the quarter note for now (D-07); revisit as a future phase if manual handling proves painful.
- **Orphaned `personQuarterData` cleanup on `deleteAllPeople`** — known minor gap (deleting people leaves their blackouts/pairings on quarter docs). Low-risk given re-import + re-entry follows a clear; fix opportunistically, not required here.

### Canonical References (from CONTEXT.md)
- `.planning/sketches/001-availability-editor/index.html` — chosen UI (**Variant A — Right drawer**); all core controls prototyped here.
- `.planning/sketches/001-availability-editor/README.md` — design question, variant descriptions, control specs.
- `docs/Sample Frequency Notes.csv` — the real, messy quarterly notes the editor structures; validate control expressiveness against it.
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
</user_constraints>

<phase_requirements>
## Phase Requirements

No `.planning/REQUIREMENTS.md` exists in this project (confirmed absent — `.planning/` contains only `MILESTONES.md`, `RETROSPECTIVE.md`, `PROJECT.md`, `ROADMAP.md`, `STATE.md`). Per this project's established convention (Phase 13 used the same approach — see `13-RESEARCH.md` line 75), CONTEXT.md's decisions D-01 through D-11 constitute the requirement set the planner must satisfy. `ROADMAP.md` §"Phase 14" lists `Requirements: TBD (derive during /gsd-discuss-phase 14)` — CONTEXT.md's decisions fulfill that TBD.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Right-drawer editor UI (Variant A) | Architecture Patterns Pattern 1; Recommended Project Structure (`AvailabilityDrawer.vue`) |
| D-02 | Editor lives on QuarterView, roster list opens drawer per person | Architecture Patterns Pattern 1; System Architecture Diagram; Code Examples (mount point) |
| D-03 | Sundays-only calendar, Nth-Sunday chips, range block, frequency segmented control w/ advanced N, must-serve-with typeahead, quarter note | Common Pitfalls #1 (control expressiveness validated against sample notes); Code Examples |
| D-04 | Frequency presets incl. fill-in (last-resort) and out (fully excluded) tiers | Architecture Patterns Pattern 2 (scheduler two-pass fill); Code Examples (`frequencyTier` scheduler diff) |
| D-05 | Explicit `frequencyTier` field, not overloaded N; out-this-quarter is quarter-scoped | Don't Hand-Roll; Assumptions Log A1; Recommended Project Structure (`PersonQuarterData.frequencyTier`) |
| D-06 | Bidirectional must-serve-with pairing, reusing `applyCsvToQuarter`'s sync logic | Architecture Patterns Pattern 3; Assumptions Log A2 (add+remove extension) |
| D-07 | Conditional pairing rules stay in free-text note only | Common Pitfalls #1 (Bob Jeffers / Lisa Woodard rows) — confirms note field is sufficient, no structured modeling |
| D-08/D-09/D-10 | Selective PC import scoped by team + individually-scheduled position, excluding choir/orchestra, "currently serving" lookup | Architecture Patterns Pattern 4 (`PersonTeamPositionAssignment`); Sources (PC docs) |
| D-11 | Modify `RosterImportModal.vue` + replace `fetchAndMapPeople`'s whole-church fetch | Recommended Project Structure; System Architecture Diagram |
</phase_requirements>

## Summary

This phase has **zero new library dependencies** — `papaparse` (5.5.4 installed, satisfies `^5.5.3`), `firebase` (`^12.0.0`), and `pinia` (`^3.0.4`) already cover everything needed. The work is entirely: (1) a new Vue drawer component + roster-table section on `QuarterView.vue`, (2) two new/extended store actions on `quarters.ts` for single-person quarter-data writes with symmetric bidirectional pairing sync, (3) a `frequencyTier` field threaded through `roster.ts` types and `scheduler.ts`'s candidate-selection loop, and (4) a scoped Planning Center fetch chain (`fetchServiceTypeTeams` → `fetchTeamPositions` → new `fetchPeopleForTeamPositions`) replacing `fetchAndMapPeople`'s whole-directory pull in `RosterImportModal.vue`.

The **critical new PC API finding**: Planning Center Services v2 exposes exactly the resource needed for D-10's "who is currently serving this position" — `PersonTeamPositionAssignment`, confirmed via the live PC docs site (`api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/person_team_position_assignment`). Existence of a `PersonTeamPositionAssignment` record linking a `person` to a `team_position` is exactly "currently serving that position" — it is the record PC itself uses to say "this person can be scheduled into this position." The team-scoped endpoint `GET /services/v2/teams/{team_id}/person_team_position_assignments` (no `service_type_id` needed) matches the existing codebase's `fetchTeamPositions(teamId)` pattern (also team-scoped, no service-type dependency), so the new fetch slots cleanly after the existing `fetchServiceTypeTeams(serviceTypeId)` → `fetchTeamPositions(teamId)` chain without introducing a new plumbing dependency.

The **frequency-tier field-placement question (D-05)** resolves to: put `frequencyTier: 'regular' | 'fillin' | 'out'` on `PersonQuarterData` (quarter-scoped), defaulting to `'regular'` and resetting each new quarter — mirroring `blackoutDates`' existing reset-per-quarter behavior (established D-18 pattern from Phase 13). This is a genuine interpretation, not a locked fact (CONTEXT.md explicitly deferred the field-placement decision to research/planning) — see Assumptions Log A1 for the reasoning and the alternative (standing-on-`Person`) that was rejected. `Person.frequencyTargetN` stays standing and unchanged — it continues to mean "the N to use when tier is `'regular'`," edited via the drawer's advanced override exactly the way `applyCsvToQuarter` already upserts it through `rosterStore.updatePerson`.

Validating the sketch's controls (Nth-Sunday chips + date-range block) against every row of `docs/Sample Frequency Notes.csv` finds **no blocking expressiveness gap** — every real pattern (1st Sundays, explicit date lists, "gone June 12-19" ranges, "unavailable this cycle") is representable. Two non-blocking UX refinements are worth flagging to the planner (see Common Pitfalls #1): an "invert selection" quick-action for "available ONLY the 2nd week" patterns (Krystyn Broersma), and an optional "through end of quarter" range shortcut for open-ended absences (Julia Woodard's "gone to college by 8/16"). Neither blocks the phase; both are already achievable today with more clicks.

**Primary recommendation:** Add `PersonQuarterData.frequencyTier` (quarter-scoped, default `'regular'`), extend `quarters.ts` with `setPersonAvailability(quarterId, personId, {blackoutDates, pairedWith, frequencyTier})` performing symmetric bidirectional pairing sync via targeted Firestore dot-path updates, extend `scheduler.ts`'s per-role fill loop to a two-pass regular-then-fillin candidate search while filtering `'out'`-tier people out entirely, build `AvailabilityDrawer.vue` + a roster-table section on `QuarterView.vue` mirroring the sketch's Variant A markup exactly, and replace `RosterImportModal.vue`'s `fetchAndMapPeople` call with a new team→position→assignment selection flow built on `fetchServiceTypeTeams` + `fetchTeamPositions` + a new `fetchPeopleForTeamPositions` function using `PersonTeamPositionAssignment`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Availability drawer (calendar/frequency/pairing/note UI) | Browser (Vue component) | API/Backend (Firestore write per save) | New UI concern mounted on `QuarterView.vue`; each save is a scoped Firestore update, same shape as existing `QuarterGrid.vue` cell edits |
| Quarter-scoped availability data (`personQuarterData.{id}`) | API/Backend (Firestore) | Browser (Pinia store cache via `onSnapshot`) | Continues the existing `quarters` collection/store — no new collection, only new fields within the existing `personQuarterData` map |
| Frequency tier evaluation (regular / fill-in / out) | Browser (pure util — `scheduler.ts`) | — | Pure scoring/filtering logic, no I/O, directly extends the existing `proposeQuarterSchedule` pure function |
| Selective PC import (team → position → assignment fetch) | Browser (client-side fetch via existing `/api/planningcenter` proxy) | — | Same client-side-only PC integration pattern already used by every other PC fetch in this codebase; no backend function needed |
| Position → Role mapping UI (D-10) | Browser (Vue component, new step in `RosterImportModal.vue`) | — | Pure UI/config concern — the mapping only needs to exist transiently during the import flow, not persisted as a new collection |
| Manual gap-filling candidate list (`QuarterGrid.vue`'s `availableUnassigned`) | Browser (Vue component) | — | Must be updated to also respect the new `frequencyTier` (`'out'`-tier people should never appear as manual candidates either) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase (Firestore) | ^12.0.0 (already installed) [VERIFIED: package.json] | New `frequencyTier` field + dot-path writes to existing `quarters/{id}.personQuarterData.{personId}.*` | Existing backend, no schema migration tooling needed — Firestore is schemaless |
| pinia | ^3.0.4 (already installed) [VERIFIED: package.json] | `quarters.ts` store extension (`setPersonAvailability`) | Existing state pattern |
| papaparse | ^5.5.4 latest, `^5.5.3` installed range [VERIFIED: `npm view papaparse version` → 5.5.4] | Unchanged — CSV path stays as secondary bulk option (not removed per ROADMAP.md note) | Already the project's CSV parser; no change needed this phase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — (native `fetch`, existing `PC_BASE_URL` proxy) | n/a | New `fetchPeopleForTeamPositions` PC call | Follows the exact `fetchAllPeople`/`fetchTeamPositions` pagination + 429-retry pattern already in `planningCenterApi.ts` — no new HTTP client needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Quarter-scoped `PersonQuarterData.frequencyTier` (recommended) | Standing `Person.frequencyTier` | A standing tier would silently carry "out this quarter" into a brand-new quarter (contradicts the "this quarter" framing entirely) and would require an extra reset step at `createQuarter` time to avoid volunteers vanishing from every future quarter after one "out" mark. Rejected — see Assumptions Log A1. |
| Extending `applyCsvToQuarter`'s pairing-merge logic in place (add-only) | New `setPersonAvailability` with symmetric add+remove pairing sync | `applyCsvToQuarter`'s existing merge only ever *adds* a reciprocal id (CSV re-import never explicitly "removes" a pairing — a person just stops appearing in a future CSV row). The single-person drawer's ✕ button on a pairing chip is an explicit remove action the CSV path has never needed. A new function is required; it should extract/share the *pattern* (not the literal function) per D-06's "reuse the bidirectional-sync logic" instruction. |
| Fetching `person_team_position_assignments` per-position via the `service_type`-scoped nested endpoint | Team-scoped `GET /teams/{team_id}/person_team_position_assignments` (recommended) | The `service_type`-scoped endpoint requires threading a `serviceTypeId` through the whole selective-import flow (RosterImportModal currently has none). The team-scoped endpoint needs only the `teamId` already selected via `fetchServiceTypeTeams`/`fetchTeamPositions`, and returns all of a team's assignments in one paginated call (filter client-side by the leader's chosen `team_position` ids) — fewer round-trips, matches the existing `fetchTeamPositions(teamId)` no-service-type-needed shape exactly. |

**Installation:**
No new packages required — this phase reuses PapaParse, Firebase, and Pinia, all already present in `package.json`.

## Package Legitimacy Audit

**Not applicable this phase.** No new external packages are introduced. All work is additive TypeScript/Vue code and new Planning Center Services v2 API calls made through the already-audited client pattern in `planningCenterApi.ts` (Phase 13's Package Legitimacy Audit already covered PapaParse/Firebase/Pinia — see `13-RESEARCH.md`). If the planner discovers a genuine need for a new package during task breakdown, the Package Legitimacy Gate protocol must be run at that time.

## Architecture Patterns

### System Architecture Diagram

```
[Leader opens QuarterView, selects active quarter]
        |
        v
[NEW: Volunteer Availability roster table]  --reads-->  [rosterStore.activePeople + quartersStore.getQuarter(id).personQuarterData]
        |  (search/filter chips: All / Needs input / Out this quarter)
        |  click a row
        v
[NEW: AvailabilityDrawer.vue]  --reads current person's standing (Person) + quarter-scoped (PersonQuarterData) fields--
        |
        |  Sundays-only calendar / Nth-Sunday chips / range block  -->  toggles subset of quarter.serviceDates directly (no expandBlackoutCell needed — editor never produces free-text range syntax)
        |  frequency segmented control (+ advanced 1-in-N)          -->  sets frequencyTier (quarter-scoped) + optionally Person.frequencyTargetN (standing)
        |  must-serve-with typeahead                                -->  bidirectional pairedWith chips (add AND remove)
        |  quarter note                                             -->  free-text field on PersonQuarterData
        |
        v  on Save
[quartersStore.setPersonAvailability(quarterId, personId, {blackoutDates, pairedWith, frequencyTier, note})]
        |  1. computes symmetric bidirectional pairing diff (added partners get reciprocal id merged in;
        |     removed partners get reciprocal id stripped out) — same PATTERN as applyCsvToQuarter's merge,
        |     extended to support removal
        |  2. one updateDoc with multiple dot-path keys:
        |     personQuarterData.{personId} = {...}, personQuarterData.{addedPartnerId}.pairedWith = [...],
        |     personQuarterData.{removedPartnerId}.pairedWith = [...]
        v
[Firestore: organizations/{orgId}/quarters/{id}.personQuarterData]
        |
        |  (if advanced 1-in-N was changed)
        v
[rosterStore.updatePerson(personId, {frequencyTargetN})]  -->  [organizations/{orgId}/people/{personId}]  (standing, unchanged from Phase 13)
        |
        v
[proposeQuarterSchedule() — EXTENDED]
   NEW: filters out personQuarterData[id].frequencyTier === 'out' entirely from candidates
   NEW: two-pass fill per role/date — regular-tier candidates first; if none, fillin-tier as last resort
        |
        v
[QuarterGrid.vue's availableUnassigned() — EXTENDED to also exclude 'out'-tier from manual gap-filling candidates]


── Selective Planning Center import (separate flow, same modal) ──

[RosterImportModal.vue — NEW step before fetch]
        |
        v
[fetchServiceTypes(appId, secret)]  --leader picks a service type--
        v
[fetchServiceTypeTeams(appId, secret, serviceTypeId)]  --leader picks a worship team (excludes choir/orchestra teams, D-09)--
        v
[fetchTeamPositions(appId, secret, teamId)]  --leader checks which INDIVIDUALLY-scheduled positions to import (D-10)--
        |  leader maps each checked position -> a WorshipPlanner Role
        v
[NEW: fetchPeopleForTeamPositions(appId, secret, teamId, selectedPositionIds)]
   GET /services/v2/teams/{team_id}/person_team_position_assignments?include=person&per_page=100  (paginate via links.next)
   client-side filter: assignment.relationships.team_position.data.id in selectedPositionIds
   dedupe by person.id, merge roles[] for people serving multiple selected positions
        v
[mapped UpsertPersonInput[] with roles[] set from the position->Role mapping]  --preview (add/update counts, same as today)-->
        v
[rosterStore.upsertPeople()]  --unchanged from Phase 13--
```

### Recommended Project Structure
```
src/
├── types/
│   └── roster.ts                    # + FrequencyTier type, + PersonQuarterData.frequencyTier, PersonQuarterData.note
├── stores/
│   ├── roster.ts                    # unchanged (updatePerson already supports frequencyTargetN patch)
│   └── quarters.ts                  # + setPersonAvailability() — single-person quarter-data write w/ symmetric pairing sync
├── utils/
│   ├── scheduler.ts                 # extended: 'out' exclusion + two-pass regular-then-fillin fill loop
│   └── planningCenterApi.ts         # + fetchPeopleForTeamPositions(appId, secret, teamId, positionIds)
├── components/
│   ├── AvailabilityDrawer.vue       # NEW — Variant A right drawer (sketch 001, mirrors editorHtml() logic in Vue)
│   ├── AvailabilityRosterTable.vue  # NEW — search/filter + row table (mirrors sketch's tableA/rowHtml)
│   ├── RosterImportModal.vue        # extended — team/position selection step before preview (D-11)
│   └── QuarterGrid.vue              # extended — availableUnassigned() excludes 'out'-tier candidates
└── views/
    └── QuarterView.vue              # + <AvailabilityRosterTable> section + <AvailabilityDrawer> mount
```

### Pattern 1: Right-drawer editor mounted at the view level, controlled by an `openPersonId` ref
**What:** `QuarterView.vue` owns `const openPersonId = ref<string | null>(null)`. The new roster table's row-click sets it; `AvailabilityDrawer` is teleported to `body` (matching the existing `RosterImportModal.vue`/`VolunteerCsvImportModal.vue` overlay convention) and is `v-if="openPersonId"`-gated, reading both `rosterStore.people.find(id)` (standing fields: name, email, roles, frequencyTargetN) and `quartersStore.getQuarter(quarterId).personQuarterData[openPersonId] ?? emptyPersonQuarterData` (quarter-scoped fields, with a safe empty default for a person who has no entry yet this quarter — mirrors how `QuarterGrid.vue`'s `isBlackedOut` already does `?.blackoutDates.includes(date) ?? false` optional-chaining against a possibly-missing entry).
**When to use:** The drawer never fetches its own data — it's purely a controlled view over already-subscribed `roster`/`quarters` store state, consistent with every other modal/drawer in this codebase (`RosterImportModal`, `VolunteerCsvImportModal`).
**Example:**
```vue
<!-- Source: pattern derived from src/components/RosterImportModal.vue's existing Teleport structure -->
<Teleport to="body">
  <Transition><div v-if="open" class="fixed inset-0 z-60 bg-black/55" @click="close" /></Transition>
  <Transition>
    <div v-if="open" class="fixed top-0 right-0 bottom-0 z-61 w-full max-w-lg bg-gray-900 border-l border-gray-800 overflow-y-auto">
      <!-- ed-section blocks per D-03: frequency / calendar / pairing / note -->
    </div>
  </Transition>
</Teleport>
```

### Pattern 2: Scheduler two-pass fill — regular-tier first, fill-in as last resort (D-04)
**What:** For each role/date slot, run the existing candidate filter+score+pick loop restricted to `frequencyTier !== 'fillin' && frequencyTier !== 'out'`. Only if that pass yields zero candidates, re-run restricted to `frequencyTier === 'fillin'` people (still respecting blackout). `'out'`-tier people are filtered out of *both* passes unconditionally — they never appear as candidates, matching D-04's "fully excluded... never appears in proposals."
**When to use:** Inside `proposeQuarterSchedule`'s per-role `while` loop in `scheduler.ts`.
**Example:**
```typescript
// Source: pattern — extends the existing candidates filter in src/utils/scheduler.ts
function tierOf(personId: string): FrequencyTier {
  return pqdById.get(personId)?.frequencyTier ?? 'regular' // undefined = pre-migration data, treat as regular
}

while (calendar[date]![roleId]!.length < count) {
  const alreadyInRole = new Set(calendar[date]![roleId])
  const eligible = (tier: FrequencyTier) =>
    people.filter(
      (p) =>
        p.active &&
        p.roles.includes(roleId) &&
        !isBlackedOut(p.id, date) &&
        !alreadyInRole.has(p.id) &&
        tierOf(p.id) === tier,
    )

  let candidates = eligible('regular')
  if (candidates.length === 0) candidates = eligible('fillin') // last-resort pass, D-04

  if (candidates.length === 0) {
    unfilled.push({ date, roleId })
    break
  }
  // existing deficit-scoring sort unchanged — fill-in candidates still tie-broken by
  // (servedCount asc, name asc) since their "deficit" formula (dateIndex/N) is meaningless
  // without a real N; skip the deficit term entirely for fillin-tier candidates:
  const scored = candidates
    .map((p) => ({
      p,
      deficit: tierOf(p.id) === 'regular' ? (dateIndex + 1) / p.frequencyTargetN - (served.get(p.id) ?? 0) : 0,
    }))
    .sort(
      (a, b) =>
        b.deficit - a.deficit ||
        (served.get(a.p.id) ?? 0) - (served.get(b.p.id) ?? 0) ||
        a.p.name.localeCompare(b.p.name),
    )
  // ...unchanged assignToRole/propagatePairing calls
}
```
`'out'`-tier partners in pairing propagation must also be excluded — extend `propagatePairing`'s partner-eligibility check with `if (tierOf(partnerId) === 'out') { pairingConflicts.push({..., reason: 'partner out this quarter' }); continue }` alongside the existing blackout check (same conflict-reporting shape, new reason string).

### Pattern 3: Symmetric bidirectional pairing sync (extends D-06's `applyCsvToQuarter` pattern for single-person add+remove)
**What:** `applyCsvToQuarter`'s existing merge (`src/stores/quarters.ts` lines 134-150) only ever *adds* a reciprocal `pairedWith` entry — it has no remove path because CSV re-import never explicitly un-pairs two people. The drawer's pairing-chip ✕ button is an explicit remove action, so `setPersonAvailability` needs a genuinely new symmetric diff: compare the incoming `pairedWith` against the *previous* `pairedWith` for this person, compute `added` and `removed` partner-id sets, and update both this person's `pairedWith` AND every added/removed partner's own `pairedWith` entry (reciprocal add/remove) in one batched write.
**When to use:** `quarters.ts`'s new `setPersonAvailability`.
**Example:**
```typescript
// Source: pattern — extends the bidirectional merge already proven in applyCsvToQuarter (lines 134-150)
async function setPersonAvailability(
  quarterId: string,
  personId: string,
  data: { blackoutDates: string[]; pairedWith: string[]; frequencyTier: FrequencyTier; note: string },
): Promise<void> {
  if (!orgId.value) return
  const quarter = getQuarter(quarterId)
  const previous = quarter.personQuarterData[personId]?.pairedWith ?? []
  const added = data.pairedWith.filter((id) => !previous.includes(id))
  const removed = previous.filter((id) => !data.pairedWith.includes(id))

  const updates: Record<string, unknown> = {
    [`personQuarterData.${personId}`]: { personId, ...data },
    updatedAt: serverTimestamp(),
  }
  for (const partnerId of added) {
    const partnerPaired = quarter.personQuarterData[partnerId]?.pairedWith ?? []
    if (!partnerPaired.includes(personId)) {
      updates[`personQuarterData.${partnerId}`] = {
        personId: partnerId,
        blackoutDates: quarter.personQuarterData[partnerId]?.blackoutDates ?? [],
        pairedWith: [...partnerPaired, personId],
        frequencyTier: quarter.personQuarterData[partnerId]?.frequencyTier ?? 'regular',
        note: quarter.personQuarterData[partnerId]?.note ?? '',
      }
    }
  }
  for (const partnerId of removed) {
    const partnerData = quarter.personQuarterData[partnerId]
    if (partnerData) {
      updates[`personQuarterData.${partnerId}.pairedWith`] = partnerData.pairedWith.filter((id) => id !== personId)
    }
  }
  await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), updates)
}
```
Note: writing `personQuarterData.${personId}` as a *whole nested object* (not deeper dot-paths into it) is intentional and safe here — unlike `calendar.{date}.{roleId}` (which many concurrent editors touch simultaneously), only one leader is ever editing one person's availability drawer at a time, so whole-object replacement for that one person's entry carries no concurrent-edit risk (the risk `T-13-09-02`'s dot-path convention protects against was *other* dates/roles being clobbered by a full-map rewrite — not applicable to a single person's own sub-object).

### Pattern 4: `PersonTeamPositionAssignment` lookup for "currently serving this position" (D-10)
**What:** `GET /services/v2/teams/{team_id}/person_team_position_assignments?include=person&per_page=100`, paginated via `links.next` exactly like every other PC list fetch in `planningCenterApi.ts`. Each assignment record has a `to_one` relationship to `team_position` and a `to_one` relationship to `person`; with `include=person` the response's `included` array carries the full `Person` resource (same attribute shape `mapPcPersonToUpsert` already consumes) so no N+1 per-person fetch is needed (unlike the existing `fetchAndMapPeople`'s per-person `emails` batch-of-3 fetch).
**When to use:** New `fetchPeopleForTeamPositions` in `planningCenterApi.ts`, called after the leader has selected a team + one or more individually-scheduled positions.
**Example:**
```typescript
// Source: https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/person_team_position_assignment
// (CITED — confirmed attribute list, relationships, and endpoint list via WebFetch of PC's live docs site)
interface PcAssignment {
  id: string
  relationships: { person: { data: { id: string } }; team_position: { data: { id: string } } }
}
interface PcIncludedPerson {
  type: 'Person'
  id: string
  attributes: { first_name?: string; last_name?: string; name?: string }
}

export async function fetchPeopleForTeamPositions(
  appId: string,
  secret: string,
  teamId: string,
  selectedPositionIds: Set<string>,
): Promise<Array<{ pcPersonId: string; name: string }>> {
  const authHeader = basicAuthHeader(appId, secret)
  let url: string | undefined = `${PC_BASE_URL}/teams/${teamId}/person_team_position_assignments?include=person&per_page=100`
  const peopleById = new Map<string, string>() // pcPersonId -> name

  while (url) {
    const response = await fetch(url, { headers: { Authorization: authHeader, Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Failed to fetch team position assignments: ${response.status}`)
    const json = (await response.json()) as {
      data: PcAssignment[]
      included?: PcIncludedPerson[]
      links: { next?: string }
    }
    const includedById = new Map((json.included ?? []).map((p) => [p.id, p]))
    for (const assignment of json.data) {
      const posId = assignment.relationships.team_position.data.id
      if (!selectedPositionIds.has(posId)) continue
      const personId = assignment.relationships.person.data.id
      const person = includedById.get(personId)
      if (!person) continue
      const name =
        person.attributes.name?.trim() ||
        `${person.attributes.first_name ?? ''} ${person.attributes.last_name ?? ''}`.trim()
      peopleById.set(personId, name) // dedupes people serving multiple selected positions
    }
    url = json.links.next?.replace('https://api.planningcenteronline.com/services/v2', PC_BASE_URL)
  }

  return Array.from(peopleById, ([pcPersonId, name]) => ({ pcPersonId, name }))
}
```
Emails still require the existing per-person `fetchPersonEmails` (batched by 3) — `PersonTeamPositionAssignment`'s `include=person` does not carry nested `Email` resources (confirmed: `Email` is its own vertex under `/people/{id}/emails`, not embeddable via `include` on this endpoint per the PC docs' listed `include` options for this resource, which only name `person` and `team_position`).

### Anti-Patterns to Avoid
- **Auto-detecting choir/orchestra positions from PC metadata:** D-10 says the leader manually picks which positions are individually-scheduled; do not attempt to infer this from `TeamPosition.tags`/`tag_groups` or team name string-matching (`"choir"`/`"orchestra"`) — brittle and not requested. Just present a checkbox list from `fetchTeamPositions` and let the leader choose.
- **Calling `expandBlackoutCell` from the drawer:** The drawer toggles known `quarter.serviceDates` values directly (clicking a real Sunday, an Nth-Sunday chip, or a date-range button that already filters against `serviceDates` — see the sketch's `applyRange`). It never produces the CSV's free-text `"start..end"` string syntax, so it should never call `expandBlackoutCell` — that utility stays exclusively on the CSV import path. Calling it from the drawer would be dead code / a needless format round-trip.
- **Treating `frequencyTier === 'fillin'` as still eligible for the deficit-based scoring pass:** A fill-in person's "deficit" relative to a frequency target they don't have is meaningless; computing `(dateIndex+1)/frequencyTargetN` for a fillin-tier person using their (irrelevant) standing `frequencyTargetN` would make them compete unpredictably in the *regular* pass. Keep fill-in strictly in a separate, later pass (Pattern 2).
- **Rewriting the entire `personQuarterData` map on a single-person save:** Unlike `applyCsvToQuarter` (which legitimately touches the whole map because a CSV batch can affect many people at once), the drawer only ever changes one person (plus their pairing partners). Use targeted dot-path keys in `updateDoc` (Pattern 3), not `updateQuarter(quarterId, { personQuarterData: {...quarter.personQuarterData, [personId]: ... } })` — the latter reintroduces the last-write-wins race the dot-path convention (`T-13-09-02`) was specifically adopted to avoid.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sundays-only calendar grid | A custom generic date-picker with disabled-date logic | Iterate `quarter.serviceDates` directly (already a finite, pre-generated array) and render one button per entry | The sketch already proves this — no library needed, and using `serviceDates` guarantees the calendar can never show a non-service date, which a generic date-picker component would need extra config to enforce |
| Typeahead / autocomplete for the pairing picker | A generic autocomplete component/library | Plain `v-model` text input + computed filtered list + `v-if` dropdown (exactly as the sketch's `pairSearch`/`pairMenu` does with vanilla JS) | Small, fixed-size list (the org's active roster, typically dozens of people) — no virtualization or fuzzy-matching library is warranted |
| PC pagination + 429 retry for the new team-position-assignment fetch | A custom retry/backoff library | Copy the exact `while (url)` + `Retry-After`-respecting loop already used by `fetchAllPeople`/`fetchAllPcSongs` | Proven, already-tested pattern in this exact codebase; introducing a generic HTTP retry library adds indirection with no benefit at this call volume |

**Key insight:** Every piece of Phase 14's new infrastructure (drawer UI, PC pagination, Firestore dot-path writes, bidirectional pairing sync) is a direct extension of a pattern already proven in this codebase during Phase 13 — the only genuinely new *design* decision is the frequency-tier's field placement and the scheduler's two-pass fill order, both covered above.

## Common Pitfalls

### Pitfall 1: Assuming the sketch's Nth-Sunday chips + range block are individually sufficient without validating against real data
**What goes wrong:** Shipping the calendar controls as-is without checking whether every real quarterly-notes pattern is expressible leads to a leader hitting a wall mid-transcription (e.g., "how do I say she's available ONLY the 2nd week?") and reverting to the CSV escape hatch, defeating the phase's purpose.
**Why it happens:** The sketch's controls were designed against a *summary* of the sample notes (per the README), not validated row-by-row.
**How to avoid:** This research validated all 30 rows of `docs/Sample Frequency Notes.csv` against the sketch's controls. Result: **no blocking gap** — every pattern is expressible, sometimes with more clicks than ideal:
  - *"Available ONLY 2nd week"* (Krystyn Broersma) — requires clicking the 1st/3rd/4th/5th chips individually (blocking everything except the 2nd) rather than one "only" action. Recommend an optional **"invert selection"** quick-action as a nice-to-have refinement (not blocking).
  - *"gone to college by 8/16"* (Julia Woodard) — an open-ended "from date X through end of quarter" absence requires manually picking the quarter's last Sunday as the range's end bound. Recommend an optional **"through end of quarter"** shortcut button (not blocking) — the range picker already works today by setting the end date manually.
  - *Non-Sunday dates in notes* (Kalena Heibeck's "(Wed. 5/27)") — **not a real gap**: the scheduler only ever proposes Sunday services (Phase 13 D-01), so a Sundays-only calendar correctly has no way to represent a Wednesday absence, and doesn't need one.
  - *Per-role frequency* (Makayla Segard: "1 sound; as needed for projection" — regular for one role, fill-in for another) — **not a Phase 14 gap**, this is Phase 13's already-accepted, already-deferred limitation ("Per-role frequency targets — one target per person for now, not per-role" — Phase 13 Deferred Ideas). The single overall `frequencyTier` per person cannot represent this; the leader picks the person's *primary* commitment and adds nuance to the free-text note (D-07's designed fallback).
  - *Conditional pairing text stored in the Frequency column* (Lisa/Julia Woodard: "Schedule Julia with her if 1st Sundays") and *"schedule when Deb sings"* (Bob Jeffers) — **confirms D-07 is correctly scoped**: these are exactly the messy conditional rules the free-text quarter note is designed to absorb, not a calendar/frequency control gap.
**Warning signs:** A leader manually falls back to the CSV importer mid-quarter, or repeatedly requests "just let me type the dates."

### Pitfall 2: Silently dropping the pairing-partner reciprocal update when a person is removed as a pairing partner via the drawer
**What goes wrong:** If `setPersonAvailability` only writes the edited person's own `pairedWith` array and forgets the reciprocal removal on the *other* person's `personQuarterData` entry, the pairing becomes one-directional and stale (partner A no longer lists B, but B still lists A) — the scheduler's `propagatePairing` would then still try to pull A onto every date B serves, even though the leader believed they'd un-paired them.
**Why it happens:** `applyCsvToQuarter`'s existing bidirectional logic is add-only (see Alternatives Considered) — a naive "reuse" that copies its shape without adding the remove branch silently reintroduces this exact bug in the new single-person path.
**How to avoid:** Implement the explicit `added`/`removed` diff shown in Pattern 3, and cover it with a unit test asserting removal is reciprocal (`quarters.test.ts` gap — see Validation Architecture).
**Warning signs:** A pairing "ghost" — person B keeps appearing alongside A in generated proposals after the leader removed the pairing from A's drawer.

### Pitfall 3: Forgetting to update `QuarterGrid.vue`'s `availableUnassigned`/manual gap-filling candidate list to respect the new `frequencyTier`
**What goes wrong:** D-04 says an `'out'`-tier person "never appears in proposals" — but `QuarterGrid.vue`'s existing `availableUnassigned(date, roleId)` (Phase 13, D-23's manual "who's available to fill this gap" helper) filters only on `active` + role + not-blacked-out. Without an explicit `frequencyTier !== 'out'` filter added there too, an "out this quarter" person would still show up as a *manually selectable* candidate in the gap-filling panel — contradicting "fully excluded."
**Why it happens:** `frequencyTier` is a new field Phase 13's `availableUnassigned` predates; it's easy to update the *scheduler's* candidate filter (the obvious "proposals" surface) while missing this second, UI-only candidate-list surface.
**How to avoid:** Grep every call site that filters `rosterStore.activePeople` for scheduling/candidate purposes (currently: `scheduler.ts`'s two loops, and `QuarterGrid.vue`'s `availableUnassigned`) and add the `frequencyTier !== 'out'` check to all of them. Consider surfacing fill-in-tier candidates in the manual list with a distinct visual tag (they're valid *manual* picks even though the *auto-proposal* only reaches for them as a last resort).
**Warning signs:** An "out this quarter" person appears in the gap-filling dropdown even though they never appear in an auto-generated proposal.

### Pitfall 4: Pointing the selective-import person fetch at the `service_type`-scoped `person_team_position_assignments` endpoint and needing a `serviceTypeId` the existing flow doesn't have
**What goes wrong:** The PC docs list *two* URL shapes for this resource — team-scoped (`/teams/{team_id}/person_team_position_assignments`) and service-type-scoped (`/service_types/{id}/team_positions/{team_position_id}/person_team_position_assignments`). If the planner reaches for the service-type-scoped path (because it's the first one listed in some doc renderings), the new import flow needs to additionally collect/pass a `serviceTypeId` that `fetchTeamPositions(teamId)` currently has no dependency on — extra plumbing and an extra leader-facing selection step.
**Why it happens:** PC's Services v2 API frequently offers the same resource nested under multiple parent paths; picking the "wrong" one (relative to this codebase's existing call shape) creates avoidable friction.
**How to avoid:** Use the **team-scoped** endpoint (`GET /services/v2/teams/{team_id}/person_team_position_assignments`) — it requires only the `teamId` already available from the existing `fetchServiceTypeTeams` → `fetchTeamPositions` chain, with zero new required inputs.
**Warning signs:** The import flow prompts the leader to pick a service type a second time, or `fetchPeopleForTeamPositions` needs a `serviceTypeId` parameter that has to be threaded in from outside the natural team/position selection flow.

## Code Examples

### `FrequencyTier` type + `PersonQuarterData` extension (D-05)
```typescript
// Source: pattern — extends src/types/roster.ts
export type FrequencyTier = 'regular' | 'fillin' | 'out'

export interface PersonQuarterData {
  personId: string
  blackoutDates: string[]           // unchanged (D-17 shape)
  pairedWith: string[]              // unchanged (D-09 shape)
  frequencyTier: FrequencyTier      // NEW (D-04/D-05) — quarter-scoped, defaults 'regular', resets each new quarter
  note: string                      // NEW (D-03) — free-text quarter note, never auto-scheduled (D-07)
}
```
Existing `PersonQuarterData` entries created by Phase 13's CSV path (before this migration) will lack `frequencyTier`/`note` — every read site must default via `?? 'regular'` / `?? ''` (see Pattern 2's `tierOf` helper) rather than assuming the field is always present.

### Drawer-to-store save call (D-01/D-02/D-03 wiring)
```typescript
// Source: pattern — new save handler in AvailabilityDrawer.vue, mirrors QuarterGrid.vue's
// existing scoped-store-action call style (onClear/onAssign etc.)
async function onSave() {
  await quartersStore.setPersonAvailability(props.quarterId, props.personId, {
    blackoutDates: draft.blackoutDates,
    pairedWith: draft.pairedWith,
    frequencyTier: draft.frequencyTier,
    note: draft.note,
  })
  if (draft.frequencyTargetN !== originalFrequencyTargetN) {
    // Standing field — goes through rosterStore, same as applyCsvToQuarter's standing upsert
    await rosterStore.updatePerson(props.personId, { frequencyTargetN: draft.frequencyTargetN })
  }
  emit('close')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| CSV round-trip: leader hand-builds a `;`-separated CSV from email replies, imports via `VolunteerCsvImportModal.vue` | In-app drawer: leader transcribes replies directly into constrained controls (this phase) | Phase 14 | CSV import is NOT removed — it remains a secondary bulk-entry option (explicit ROADMAP.md note); the drawer becomes the *primary* path |
| PC roster import = whole-church directory (`fetchAndMapPeople` pulls every PC person) | PC roster import = scoped by worship team + individually-scheduled position (`fetchPeopleForTeamPositions`) | Phase 14 | `RosterImportModal.vue`'s "Import" button flow gains a team/position selection step before the existing preview step; `fetchAndMapPeople`'s whole-directory call is replaced, not merely supplemented |
| Frequency = a single numeric `frequencyTargetN` on `Person`, no concept of "excluded" or "gap-only" | Frequency = `frequencyTargetN` (standing, meaningful only when tier is `'regular'`) + `frequencyTier` (quarter-scoped: regular/fillin/out) | Phase 14 | `scheduler.ts`'s single-pass fill becomes a two-pass fill (Pattern 2); any code reading `frequencyTargetN` alone without checking tier will misbehave for fill-in/out people |

**Deprecated/outdated:** None — this phase extends Phase 13's data model and store surface rather than replacing it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `frequencyTier` belongs on `PersonQuarterData` (quarter-scoped, resets to `'regular'` each new quarter) rather than standing on `Person` | Summary, Recommended Project Structure, Code Examples | CONTEXT.md (D-05) explicitly deferred this placement decision — it is NOT a locked fact. If the user actually wants "fill-in" (not just "out") to be a *standing* trait that persists across quarters without re-confirmation each cycle (plausible for someone who is permanently "as-needed only," unlike "out this quarter" which is inherently temporary), the schema would need to split: `frequencyTier` on `Person` (standing) but with an `'out'` override still living per-quarter — a more complex two-field design. Recommend confirming with the user during planning/`/gsd:discuss-phase` follow-up if this distinction matters to them; the simpler single-location (quarter-scoped) design is recommended as the default because it matches the drawer's actual UX (the leader re-confirms tier alongside blackout dates every quarter, transcribing one email reply at a time — nothing in the sketch UI distinguishes "set once" vs. "set every quarter" fields). |
| A2 | `setPersonAvailability`'s bidirectional pairing sync needs new add+remove logic, not a literal call to `applyCsvToQuarter` (which is add-only) | Architecture Patterns Pattern 3, Common Pitfalls #2 | D-06 says "reuse the bidirectional-sync logic applyCsvToQuarter already implements" — read literally as "call the same function," this assumption reinterprets it as "reuse the same *pattern*, extended for removal." If the user intended the editor to be CSV-import-only-shaped (i.e., pairing removal isn't actually needed via the drawer, only additions), the ✕-button remove affordance visible in the sketch would need to be dropped from the UI — a scope reduction, not a schema change. Low risk either way since the sketch clearly shows a removable pairing chip; flagging for planner awareness only. |
| A3 | The team-scoped `GET /services/v2/teams/{team_id}/person_team_position_assignments` endpoint exists with the exact shape documented (attributes, `include=person`, `links.next` pagination) | Architecture Patterns Pattern 4, Sources | Confirmed via WebFetch against PC's live docs site (`api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/person_team_position_assignment`), which enumerated this exact URL alongside the `service_type`-scoped sibling and the `people/{id}/...` sibling — MEDIUM-HIGH confidence (same confidence tier Phase 13's PC research used for `/people` and `/people/{id}/emails`, which proved accurate). Not confirmed via an authenticated live call in this session. If the team-scoped endpoint's pagination shape differs from `links.next` (e.g. requires `offset` instead), `fetchPeopleForTeamPositions` needs a one-line pagination-strategy change — low-risk, isolated fix. |
| A4 | Existence of a `PersonTeamPositionAssignment` record (regardless of its `schedule_preference` attribute value, e.g. even `"Unavailable"`) means "currently serving this position" for import purposes | Summary, Architecture Patterns Pattern 4 | The resource's `schedule_preference` attribute can itself be `"Unavailable"` (per its documented enum) — a person could have an assignment record to a position but have told PC they're never available for it. If the user's intent for D-10's "currently serving" is stricter (excluding `schedule_preference === 'Unavailable'` records), `fetchPeopleForTeamPositions` needs one additional filter condition on that attribute. Recommend importing all assignment records regardless of `schedule_preference` as the default (simplest reading of "serving this position" = "is a member of the position roster at all"), flagged here for the planner/user to confirm during review if it matters. |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Does `frequencyTier` need to be editable independently of the frequency *preset* segmented control, or is it always implied 1:1 by which preset button is active?**
   - What we know: The sketch's `FREQ` object couples preset selection directly to `tier` (`weekly`/`biweek`/`monthly` all map to `tier:'regular'`; `fillin`/`out` are their own tiers) — there's no separate tier control in the UI, it's fully derived from which segmented-control button is active.
   - What's unclear: Whether the planner should model this as truly two fields that happen to be UI-coupled (as recommended above, since the data model needs `frequencyTier` distinct from `frequencyTargetN` per D-05) or whether the UI should expose it as one unified concept.
   - Recommendation: Keep them as two data fields (as designed) but ONE UI control (the segmented buttons already do double duty — selecting a preset sets both `frequencyTargetN`, when applicable, AND `frequencyTier` together) — this matches the sketch exactly and requires no new UI surface.

2. **Should a newly-imported (via selective PC import) person default to `frequencyTier: 'regular'` for the *current* active quarter automatically, or remain unset until the leader opens their drawer?**
   - What we know: `PersonQuarterData` entries are created lazily today (Phase 13: a person with no CSV row simply has no `personQuarterData` entry at all until first written) — the scheduler and `QuarterGrid.vue` both already handle a missing entry via optional-chaining defaults.
   - What's unclear: Whether a freshly-PC-imported person (mid-quarter, via the new selective import) should be immediately eligible for the *next* auto-generation as `'regular'` (via the `tierOf` helper's `?? 'regular'` default), or should require the leader to explicitly open their drawer first before they're schedulable.
   - Recommendation: Keep the existing lazy-default behavior (`tierOf` defaults missing entries to `'regular'`, `blackoutDates` defaults to `[]`) — a newly-imported person with no blackout data is immediately eligible with a full-availability assumption, consistent with how Phase 13 already treats any newly-added roster person. The leader edits the drawer to add real blackout/tier data as replies come in, same workflow as today.

## Environment Availability

No new external dependencies. Planning Center API access (Basic Auth over HTTPS via the existing `/api/planningcenter` Vite dev proxy / Firebase Hosting rewrite), Firebase/Firestore, and Pinia are all already configured and exercised by Phase 8/9/13. The one new external surface — the `person_team_position_assignments` endpoint — uses the exact same `PC_BASE_URL` proxy path and Basic Auth header already working for every other PC call in this codebase; no new credential or environment configuration is needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (already configured in `vite.config.ts`, `environment: 'jsdom'`) |
| Config file | `vite.config.ts` (unit tests), `vitest.rules.config.ts` (Firestore rules tests) |
| Quick run command | `npx vitest run src/utils/__tests__/scheduler.test.ts` |
| Full suite command | `npm run test:unit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-04/D-05 (fill-in last resort) | Fill-in-tier candidate only chosen when zero regular-tier candidates available for a role/date | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "fillin"` | ✅ existing file, ❌ new test case (Wave 0) |
| D-04/D-05 ('out' exclusion) | 'out'-tier person never appears in `calendar`, `unfilled`, or as a pairing-propagation target — surfaces a `pairingConflicts` entry instead if they're a chosen person's pairing partner | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "out tier"` | ✅ existing file, ❌ new test case (Wave 0) |
| D-06 (bidirectional add+remove pairing) | `setPersonAvailability` reciprocally adds AND removes partner `pairedWith` entries | unit | `npx vitest run src/stores/__tests__/quarters.test.ts -t "setPersonAvailability"` | ✅ existing file, ❌ new test case (Wave 0) |
| D-08/D-09/D-10 (selective PC import) | `fetchPeopleForTeamPositions` filters assignments to only the selected `team_position` ids and dedupes people serving multiple selected positions | unit | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts -t "fetchPeopleForTeamPositions"` | ✅ existing file, ❌ new test case (Wave 0) |
| D-01/D-02/D-03 (drawer read/write round-trip) | Opening the drawer for a person with existing `personQuarterData` pre-populates the calendar/frequency/pairing/note controls; saving writes back through `setPersonAvailability` | component/unit | `npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts` | ❌ Wave 0 (new component + new test file) |
| D-03 (Sundays-only calendar correctness) | Only dates present in `quarter.serviceDates` render as clickable; toggling writes exactly the clicked date into `blackoutDates` | component/unit | `npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts -t "calendar"` | ❌ Wave 0 |
| Pitfall 3 (manual candidate list respects `'out'` tier) | `QuarterGrid.vue`'s `availableUnassigned` excludes `'out'`-tier people | unit | `npx vitest run src/components/__tests__/QuarterGrid.test.ts -t "out tier"` | ❌ Wave 0 (no existing `QuarterGrid.test.ts` found — confirm during planning whether one exists under a different name) |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed-test-file>`
- **Per wave merge:** `npm run test:unit` (full suite) + `npm run type-check`
- **Phase gate:** Full suite green + `npm run test:rules` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/__tests__/scheduler.test.ts` — extend with fill-in last-resort + out-exclusion test cases (D-04/D-05)
- [ ] `src/stores/__tests__/quarters.test.ts` — extend with `setPersonAvailability` add+remove bidirectional pairing test cases (D-06)
- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — extend with `fetchPeopleForTeamPositions` pagination + filter + dedupe test cases (D-08/D-09/D-10)
- [ ] `src/components/__tests__/AvailabilityDrawer.test.ts` — new file, covers D-01/D-02/D-03 read/write round-trip and Sundays-only calendar correctness
- [ ] Confirm whether a `QuarterGrid.test.ts` exists (not found in the current test-file glob) — if not, this is a pre-existing Phase 13 gap the planner should note but is not required to backfill beyond the new `'out'`-tier filter assertion
- Framework install: none — Vitest already fully configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (new) | Reuses existing Firebase Auth — no new auth surface |
| V3 Session Management | no (new) | Reuses existing Firebase session handling |
| V4 Access Control | yes | Existing catch-all `organizations/{orgId}/{collection}/{docId}` editor-only Firestore rule (confirmed present in `firestore.rules`) already covers the new `frequencyTier`/`note` fields within `quarters/{id}.personQuarterData` — no rules change needed since no new top-level collection is introduced |
| V5 Input Validation | yes | The drawer's calendar/frequency/pairing controls are UI-constrained (button clicks over a known finite `serviceDates` array, a fixed 5-option segmented control, a typeahead restricted to existing roster ids) rather than free-text parsing — this *removes* the CSV path's input-validation burden (malformed cells, whitespace/case mismatches) for the primary editing path, though the CSV path itself still needs its existing validation (unchanged, Phase 13 Pitfall 4) |
| V6 Cryptography | no (new) | No new token/crypto surface introduced this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Selective PC import silently importing a wider set of people than intended (e.g. a stale/cached `selectedPositionIds` set leaking a previously-selected position from a different team) | Tampering / Information Disclosure | `fetchPeopleForTeamPositions`'s `selectedPositionIds` filter must be freshly derived from the current team-selection UI state each import run — not persisted/cached across modal opens (mirrors `RosterImportModal.vue`'s existing `resetToIdle()` pattern, which already clears all transient import state on modal open) |
| Concurrent editors clobbering each other's pairing edits via the whole-object `personQuarterData.{personId}` write in `setPersonAvailability` | Tampering (data loss, not security per se) | Acceptable given this codebase's existing concurrency model — only one leader is realistically editing one specific person's drawer at a time (see Pattern 3's note); this is consistent with the risk profile already accepted for `applyCsvToQuarter`'s coarser whole-map write |
| PC credential leakage via the new `fetchPeopleForTeamPositions` call | Information Disclosure | Reuses the existing `pcAppId`/`pcSecret` credential storage and masked-after-save UI from Phase 8 — no new credential handling code, so no new risk surface |

## Sources

### Primary (HIGH confidence)
- `src/types/roster.ts`, `src/stores/quarters.ts`, `src/stores/roster.ts`, `src/utils/scheduler.ts`, `src/utils/quarterDates.ts`, `src/utils/volunteerCsv.ts`, `src/utils/planningCenterApi.ts`, `src/components/RosterImportModal.vue`, `src/components/QuarterGrid.vue`, `src/views/QuarterView.vue` (this repo) — read in full for this research
- `.planning/sketches/001-availability-editor/index.html` + `README.md` (this repo) — the chosen Variant A UI, controls, and demo data
- `docs/Sample Frequency Notes.csv` (this repo) — validated row-by-row against the sketch's calendar/frequency controls (Common Pitfalls #1)
- `firestore.rules` (this repo) — confirmed existing `organizations/{orgId}` catch-all editor-only rule already covers new fields with no rules change
- `package.json` (this repo) — confirmed no new dependencies needed
- `.planning/phases/13-.../13-RESEARCH.md` (this repo) — Phase 13's PC people-fetch research (Pitfall 5: no phone vertex), scheduler pure-function pattern, dot-path Firestore write convention (T-13-09-02)

### Secondary (MEDIUM confidence)
- https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/person_team_position_assignment — full attribute list, relationships (`person`, `team_position`, `time_preference_options`), all documented URL endpoints incl. the team-scoped `GET /services/v2/teams/{team_id}/person_team_position_assignments`, pagination (`per_page`/`offset`), `include` options — WebFetch of PC's live docs site, same domain/methodology Phase 13's research used and validated (not confirmed via an authenticated live API call in this session)
- https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/team_position — `TeamPosition` attributes/relationships confirming `name`/`sequence`/`tags` shape already partially consumed by the existing `fetchTeamPositions`
- `npm view papaparse version` → 5.5.4 latest, project's `^5.5.3` satisfies range

### Tertiary (LOW confidence)
- None used as a basis for recommendations — the PC API claim central to this research (D-10's endpoint) was cross-checked directly against the live docs site (WebFetch), not left at a training-data-only or WebSearch-summary level.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; every dependency already proven in this exact codebase
- Architecture (drawer + store extension + scheduler tier logic): HIGH — every pattern is a direct, mechanical extension of an already-shipped Phase 13 pattern (dot-path writes, pure-function scheduler, Teleport-based overlays)
- PC selective-import endpoint (`PersonTeamPositionAssignment`): MEDIUM-HIGH — confirmed via PC's live docs site with a full attribute/endpoint/pagination listing (same confidence tier and methodology Phase 13's PC research used successfully), not confirmed via an authenticated live call in this session
- Frequency-tier field placement (D-05): MEDIUM — this is a documented interpretation of an intentionally-deferred decision, not a verified fact; flagged in Assumptions Log A1 for planner/user confirmation
- Calendar control expressiveness (Claude's Discretion item): HIGH — exhaustively validated against all 30 rows of the real sample data, not sampled

**Research date:** 2026-07-07
**Valid until:** 30 days (stable internal codebase patterns + a third-party API whose v2018-11-01 version is long-stable); re-verify the PC `person_team_position_assignment` endpoint shape if PC ships a new Services API version before implementation begins, and re-confirm A1's field-placement assumption with the user during `/gsd:discuss-phase` follow-up or plan review if not already resolved.
