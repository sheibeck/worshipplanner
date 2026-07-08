# Phase 15: Per-Role Frequency & Role-Category Co-occurrence Rules - Research

**Researched:** 2026-07-08
**Domain:** Internal data-model evolution (TypeScript/Vue/Pinia/Firestore) — no new external dependencies
**Confidence:** HIGH (this is an existing, fully-read codebase; every claim below is grounded in the actual source files, not framework/library documentation)

## Summary

This phase reshapes two already-shipped Phase 13/14 data structures (`Person.frequencyTargetN`,
`PersonQuarterData.frequencyTier`) from per-person to per-(person, role), and adds a new
group-based co-occurrence constraint to the deterministic scheduler. There are no new libraries
to evaluate — the entire research problem is "how does the existing code need to change, and
where are the landmines." All findings below come directly from reading
`src/types/roster.ts`, `src/utils/scheduler.ts` (+ its test file), `src/stores/roster.ts`,
`src/stores/quarters.ts`, `src/views/RosterView.vue`, `src/components/AvailabilityDrawer.vue`,
`src/components/QuarterGrid.vue`, `src/components/RolesConfigPanel.vue`,
`src/components/AvailabilityRosterTable.vue`, `src/utils/volunteerCsv.ts`,
`src/components/VolunteerCsvImportModal.vue`, and `src/stores/auth.ts` (for the project's only
existing "one-time migration" precedent).

Two architecturally significant findings drive the plan:

1. **`scheduler.ts` currently has no access to `Role.group` at all.** `resolveRolesForDate`
   returns `RoleSlotConfig[]` = `{ roleId, count }` — no group field. D-12's group-exclusivity
   check cannot be implemented without threading a roleId→group lookup into
   `proposeQuarterSchedule`'s signature. This is a required, not optional, signature change.
2. **`propagatePairing` is a second, independent assignment path that bypasses the main
   `eligible()` filter entirely.** It already existed as a normal code path in the current
   scheduler and picks "first eligible role with capacity, else first eligible role" for a
   pulled-in partner — with zero awareness of what that partner already holds that date. If the
   D-12 group-exclusivity/cardinality check is added only to the main `eligible()` predicate and
   not also to `propagatePairing`'s role-selection logic, paired partners can silently produce
   illegal group combos that D-11 promises never happen in auto-propose. This is the RESEARCH
   ITEM the user flagged, and it is confirmed as a real gap, not a hypothetical one.

There is also a project-native precedent for exactly the kind of one-time migration D-03/D-09
need: `src/stores/auth.ts` (lines 109-124) does an **opportunistic self-healing migration** —
on each document snapshot read, it checks for the old shape (`role === 'admin'`) and patches to
the new shape (`role: 'editor'`) via `updateDoc`, guarded so it only writes when the old shape is
detected. This project has no batch-migration-script tooling (no `scripts/migrate*` directory,
no CLI runner) — migrations here are always "lazy, idempotent, patch-on-read" implemented inside
a Pinia store's snapshot handler or a component's mount lifecycle (mirrors `seedDefaultRolesIfEmpty`
too). The planner should follow this exact pattern for D-03/D-09 rather than inventing a new
migration mechanism.

**Primary recommendation:** Model `Person.roleFrequencies: Record<string, number>` (roleId → N)
alongside a *retained* `Person.frequencyTargetN` (now a fallback/default-for-new-roles value, not
deleted), following the same tolerant-optional-with-default pattern Phase 14 established for
`frequencyTier?`. Extend `RoleGroup` to add `'vocals'`. Thread role-group data into
`proposeQuarterSchedule` via a new parameter (roleId→group map) so both the main `eligible()`
loop and `propagatePairing`'s role-selection both enforce group exclusivity + cardinality caps.
Implement D-03/D-09 migrations as opportunistic patch-on-read inside `roster.ts`'s `subscribe()`
snapshot handlers, exactly mirroring `auth.ts`'s admin→editor precedent.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-role frequency data (standing) | Database/Storage (Firestore `people` doc) | Frontend Server-none (SPA) / API-none | Standing data lives on `Person` doc per Phase 13 D-18 split; no backend server exists — Vue SPA + Firestore SDK directly |
| Per-role frequency UI (Edit Volunteer form) | Browser/Client (Vue component) | — | `RosterView.vue` is a client-rendered form; no SSR in this app |
| Per-role tier data (quarter-scoped) | Database/Storage (Firestore `quarters` doc, `personQuarterData` map) | — | Quarter-scoped per Phase 13/14 convention |
| Per-role tier UI (availability drawer) | Browser/Client | — | `AvailabilityDrawer.vue` |
| Role group classification + migration | Database/Storage (Firestore `roles` doc) + Client (Pinia store patch-on-read) | — | No backend; migration logic must live in the Pinia store layer that already owns Firestore reads/writes |
| Co-occurrence enforcement (auto-propose) | API/Backend-equivalent (`src/utils/scheduler.ts`, a pure function) | — | This app has no server; `scheduler.ts` is the closest analog to a backend business-logic layer — pure, deterministic, unit-tested exactly like a backend service function |
| Co-occurrence warning (manual grid) | Browser/Client (`QuarterGrid.vue` computed) | — | Live, client-computed from current `quarter.calendar` + `roles` props — not persisted, not part of `ProposeResult` |
| CSV import/export compatibility | Browser/Client (`volunteerCsv.ts`, `VolunteerCsvImportModal.vue`) | Database/Storage (writes via `roster`/`quarters` stores) | Parsing is pure client-side; persistence flows through existing store actions |

**Note on architecture:** WorshipPlanner is a pure Vue 3 + Pinia + Firebase SPA with no
custom backend server — Firestore Security Rules are the only server-side gate. "API tier" in
this map maps to the client-side `stores/` + `utils/` layer that owns all Firestore reads/writes,
since there is no separate backend process.

## Standard Stack

Not applicable in the traditional sense — this phase adds zero new dependencies. All work is
within the existing stack already declared in `package.json`: Vue 3.5, Pinia 3, Firebase 12 SDK
(Firestore), Vitest 4 + @vue/test-utils 2.4 for tests, TypeScript 5.9. `RoleGroup`, `Role`,
`Person`, `PersonQuarterData`, `FrequencyTier` are project-internal types in `src/types/roster.ts`
— no library research required for these.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Opportunistic patch-on-read migration (D-03/D-09) | A one-off Node/Firebase Admin SDK migration script run once via `npm run migrate` | Script approach is more "textbook" but this codebase has zero precedent for it (no Admin SDK dependency, no scripts/ directory, no service-account credential handling anywhere) — introducing one would be a much larger, riskier surface change than following the existing `auth.ts` self-healing pattern already proven in production |
| `Record<roleId, number>` for `roleFrequencies` | `Array<{ roleId: string; n: number }>` | Record enables Firestore dot-path partial writes (`roleFrequencies.${roleId}`) exactly like `personQuarterData.${personId}` already does in `quarters.ts` — array would force whole-array rewrites and O(n) find/replace on every edit |

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. Skipping the Package Legitimacy Gate
per its own scope condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐        ┌──────────────────────────┐
│ RosterView.vue          │        │ AvailabilityDrawer.vue    │
│ (Edit Volunteer form)   │        │ (per-quarter tier control) │
│ D-01: one freq select   │        │ D-06: one tier control     │
│  per held role          │        │  per held role              │
└───────────┬─────────────┘        └────────────┬─────────────┘
            │ writes                              │ writes
            ▼                                      ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│ roster.ts store          │        │ quarters.ts store          │
│ upsertPeople /           │        │ setPersonAvailability /     │
│ updatePerson             │        │ applyCsvToQuarter           │
│ → Person.roleFrequencies │        │ → PersonQuarterData         │
│   (Firestore people doc) │        │   .roleTiers (quarter doc)  │
└───────────┬─────────────┘        └────────────┬─────────────┘
            │                                     │
            └───────────────┬─────────────────────┘
                             ▼
              ┌───────────────────────────────┐
              │ quarters.ts: generateProposal   │
              │  buildResolveRolesForDate       │
              │  (now also emits roleId→group)  │
              └───────────────┬────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │ scheduler.ts:                    │
              │ proposeQuarterSchedule (pure)     │
              │  ├─ eligible() — D-12 group check │
              │  ├─ propagatePairing() — SAME     │
              │  │   group check applied to        │
              │  │   partner's role selection      │
              │  └─ returns ProposeResult          │
              │     (calendar/unfilled/            │
              │      pairingConflicts — unchanged   │
              │      shape)                          │
              └───────────────┬────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │ QuarterGrid.vue                  │
              │  displays calendar                │
              │  D-11: NEW live-computed          │
              │  co-occurrence warning badge       │
              │  (reads quarter.calendar +          │
              │   props.roles directly — does NOT   │
              │   depend on ProposeResult)          │
              └───────────────────────────────┘
```

### Recommended Project Structure

No new files/folders — this phase modifies existing files in place:
```
src/
├── types/roster.ts          # RoleGroup +'vocals', Person.roleFrequencies,
│                             #   PersonQuarterData.roleTiers, UpsertPersonInput
├── utils/
│   ├── scheduler.ts          # new roleGroupOf param, group-exclusivity/cardinality
│   │                         #   check in eligible() AND propagatePairing()
│   └── volunteerCsv.ts       # unchanged shape; frequency stays one column, applied
│                             #   to all roles in the row on import (see CSV section)
├── stores/
│   ├── roster.ts             # D-03/D-09 patch-on-read migration in subscribe()
│   └── quarters.ts           # setPersonAvailability per-role tier write;
│                              #   buildResolveRolesForDate emits group map too
├── components/
│   ├── AvailabilityDrawer.vue    # D-05/D-06 per-role tier controls
│   ├── QuarterGrid.vue           # D-11 co-occurrence warning
│   ├── RolesConfigPanel.vue      # D-08 vocals group option in dropdown + badges
│   └── AvailabilityRosterTable.vue # role-group badge classes need 'vocals' entry
└── views/RosterView.vue      # D-01/D-02 per-role frequency controls
```

### Pattern 1: Tolerant optional-with-default (established Phase 14 convention)

**What:** New/changed fields are declared optional (`field?: T`) on the TypeScript interface,
and every read site defaults via `?? fallback` rather than requiring a migration to complete
before the field is safe to read.
**When to use:** Both D-04 (`roleFrequencies`) and D-05 (per-role tier) — pre-migration documents
must never throw.
**Example (existing precedent, `scheduler.ts` line 37):**
```typescript
// Source: src/utils/scheduler.ts (existing code, D-05 Phase 14)
const tierOf = (personId: string): FrequencyTier => pqdById.get(personId)?.frequencyTier ?? 'regular'
```
Phase 15 analog to write: `tierOf(personId, roleId)` should default to `'regular'` when the
per-role tier map or the specific roleId entry is absent — same shape of guard, one more key
level deep.

### Pattern 2: Opportunistic patch-on-read migration (established `auth.ts` precedent)

**What:** On each Firestore snapshot callback, detect the old shape and `updateDoc` a patch —
no separate migration script, no downtime, self-heals lazily as data is read.
**When to use:** D-03 (copy `frequencyTargetN` onto all held roles) and D-09 (reclassify
`vocals`-named role from `group: 'band'` to `group: 'vocals'`; leave other groups as-is).
**Example (existing precedent):**
```typescript
// Source: src/stores/auth.ts lines 109-124 (existing code)
const data = snap.data()
const role = data.role as string
// One-time migration: admin → editor + backfill missing fields
const patch: Record<string, unknown> = {}
if (role === 'admin') patch.role = 'editor'
if (!data.email && user.value?.email) {
  patch.email = user.value!.email ?? ''
  patch.displayName = user.value!.displayName ?? ''
}
if (Object.keys(patch).length > 0) {
  await updateDoc(snap.ref, patch)
}
```
Phase 15 analog: in `roster.ts`'s `subscribe()` `onSnapshot` callback for `people`, if a person
has no `roleFrequencies` field at all, patch `roleFrequencies` = `Object.fromEntries(person.roles
.map(r => [r, person.frequencyTargetN]))`. In the `roles` snapshot callback, if
`role.name.toLowerCase() === 'vocals' && role.group === 'band'`, patch `group: 'vocals'`.
Both guards make the migration idempotent (run harmlessly on every snapshot once the field/value
already matches the new shape).

### Pattern 3: Firestore dot-path scoped writes (established `quarters.ts` precedent — avoid whole-map rewrites)

**What:** Every existing per-person quarter-scoped write in this codebase writes only the scoped
dot-path key (`personQuarterData.${personId}`, `calendar.${date}.${roleId}`), never the whole
map — this is explicitly called out as a concurrency-safety pattern (T-13-09-02, T-14-03-01).
**When to use:** Any new per-role field write. `roleFrequencies.${roleId}` and a per-role tier
equivalent (e.g. `personQuarterData.${personId}.roleTiers.${roleId}`) should follow the same
dot-path convention, not a full-object `updateDoc`.
**Example:**
```typescript
// Source: src/stores/quarters.ts (existing code, assignPerson)
await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), {
  [`calendar.${date}.${roleId}`]: [...existing, personId],
  updatedAt: serverTimestamp(),
})
```

### Anti-Patterns to Avoid

- **Adding the group-exclusivity check only inside `eligible()` and skipping `propagatePairing`:**
  Confirmed landmine — `propagatePairing`'s role-selection (`rolesForDate.filter(r =>
  partner.roles.includes(r.roleId))` then `withCapacity ?? eligibleRoles[0]`) has zero visibility
  into what group(s) the partner is already assigned to that date. Must apply the identical
  group-check predicate here too, or D-11's "auto-propose never creates an illegal combo"
  guarantee is silently broken for anyone with a pairing.
- **Treating `servedCounts`/deficit scoring as still per-person-total:** Because frequency is now
  per-(person, role), the existing deficit formula `(dateIndex+1)/p.frequencyTargetN -
  served.get(p.id)` (scheduler.ts line 127) mixes a role's own cadence against a cross-role
  total served count. If Guitar is weekly (N=1) and Vocals is monthly (N=4) for the same person,
  a single aggregate `served` counter will under- or over-credit one of the two roles. The
  planner must decide whether to track `served` per (person, role) pair internally (recommended)
  or accept a documented approximation — this is NOT free to ignore silently.
- **Forgetting the four other `RoleGroup`-keyed exhaustive class/label maps:** `RoleGroup` is
  used as a `Record<RoleGroup, string>` key in at least 4 places outside `scheduler.ts`/`roster.ts`
  types: `RosterView.vue` (`groupBadgeClasses`), `QuarterGrid.vue` (`groupHeaderBg` +
  `GROUP_ORDER` array), `RolesConfigPanel.vue` (`groupLabels`, `groupBadgeClasses`, `groupOrder`
  array, and the `<select>` of hardcoded `<option>`s), `AvailabilityRosterTable.vue`
  (`ROLE_CHIP_CLASS`). TypeScript's `Record<RoleGroup, string>` will fail to compile if `'vocals'`
  is missing from any of these — this acts as a built-in exhaustiveness check, but the planner
  must budget a task/wave step for each file, not assume the type extension alone suffices.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| One-time data migration | A new "migrations" module/CLI/admin script | Opportunistic patch-on-read inside the existing Pinia store `onSnapshot` handlers (see `auth.ts` precedent) | Zero new infra, zero new credentials, consistent with 100% of existing migration code in this repo |
| Per-role default fallback | A new "role config resolver" service | Simple `?? default` reads exactly like `tierOf`/`frequencyTier ?? 'regular'` already do | Established, tested, understood pattern — no new abstraction needed |

**Key insight:** This phase is small enough, and this codebase consistent enough, that "don't
hand-roll" mostly means "don't invent a new mechanism when an existing one-line pattern already
solves the same shape of problem twice in this repo (auth.ts migration, scheduler.ts tolerant
defaults)."

## Common Pitfalls

### Pitfall 1: `scheduler.ts` has no role-group data in its function signature today

**What goes wrong:** A plan that tries to implement D-12 purely inside `eligible()` without
first adding a way to look up a roleId's `group` will hit a hard blocker — `RoleSlotConfig` is
`{roleId, count}` only.
**Why it happens:** `resolveRolesForDate` (built in `quarters.ts`'s `buildResolveRolesForDate`)
deliberately projects `Role[]` down to `RoleSlotConfig[]` before handing it to the pure scheduler,
dropping `group` along the way.
**How to avoid:** Add a new parameter to `proposeQuarterSchedule`, e.g.
`roleGroupOf: (roleId: string) => RoleGroup`, built by the caller (`quarters.ts`) from
`rosterStore.roles`. This is a signature change to a pure, well-tested function — plan a
dedicated task for it with full `scheduler.test.ts` coverage of the new parameter (existing tests
build resolvers manually and will need updating to supply the new argument, or the parameter
should have a safe default such as treating unknown roleIds as `'other'` group so existing tests
don't all need touching — planner's call, but must be decided explicitly, not left implicit).
**Warning signs:** If a plan's task list never mentions changing `proposeQuarterSchedule`'s
signature or `buildResolveRolesForDate`, this pitfall has been missed.

### Pitfall 2: `propagatePairing` bypasses the group check unless explicitly threaded through

**What goes wrong:** Pairing propagation can assign a partner into a role that violates group
exclusivity or the 1-BAND/1-VOCALS cap, because it does its own independent "first eligible role"
search rather than reusing `eligible()`.
**Why it happens:** `propagatePairing` and the main `eligible()` filter are two separate code
paths in `scheduler.ts` today (lines 67-96 vs 102-110); they were written that way to prioritize
pairing as a hard constraint over general "fill the highest deficit" — but that separation means
any new predicate added to one does not automatically apply to the other.
**How to avoid:** Extract the group-exclusivity+cardinality check into a single shared helper
(e.g. `isGroupCompatible(personId, roleId, date)`), call it from both `eligible()`'s filter
predicate AND from `propagatePairing`'s `eligibleRoles` filter.
**Warning signs:** A plan/test suite that only adds co-occurrence unit tests for the main
assignment loop and never adds a "paired partner respects group cap" test case has not covered
this — a dedicated `scheduler.test.ts` case pairing two people where the partner's only
"eligible by role" option would violate group exclusivity should be a required Wave 0/1 test.

### Pitfall 3: `RoleGroup` used as an exhaustive Record key in 5+ UI files

**What goes wrong:** Adding `'vocals'` to the `RoleGroup` union type without updating every
`Record<RoleGroup, string>` map will produce TypeScript compile errors (`vue-tsc --build` is the
project's `type-check` script and gate) at files the planner may not have anticipated touching.
**Why it happens:** Multiple components independently define their own static class/label maps
for role groups (a repeated pattern, not a shared constant) — see `RosterView.vue`,
`QuarterGrid.vue`, `RolesConfigPanel.vue`, `AvailabilityRosterTable.vue`.
**How to avoid:** Grep for `Record<RoleGroup` and `GROUP_ORDER`/`groupOrder` before considering
the type extension "done"; each file needs a `vocals` entry added with a distinct Tailwind color
(the existing files already avoid dynamically-constructed Tailwind classes for purge-safety — new
entries must follow the same static-literal-class convention, not string interpolation).
**Warning signs:** `npm run type-check` (vue-tsc --build) failing after the `RoleGroup` type
change is the direct signal; this should be run as a verification step in the plan.

### Pitfall 4: CSV frequency column is one-per-row, not one-per-role

**What goes wrong:** Assuming the existing volunteer CSV format (`Frequency` column, one value)
needs restructuring into multiple per-role columns to support D-04. It does not — nothing in
CONTEXT.md asks for a CSV schema change, and the todo explicitly allows "degrade gracefully to a
per-person default on import."
**Why it happens:** The temptation to make CSV "fully" per-role-aware mirrors the in-app UI, but
`parseVolunteerCsvRow`/`VolunteerCsvImportModal.vue` currently read one `Frequency` cell and apply
it to the whole row's `rolesRaw` list.
**How to avoid:** Recommended approach — on CSV import, apply the single parsed
`frequencyTargetN` value as the initial `roleFrequencies[roleId]` for every role in that row's
`rolesRaw` (mirrors exactly what D-03's migration does for existing people), and continue writing
`frequencyTargetN` too (as the person's fallback/default value for any future new role). No CSV
column schema change needed; `frequencyLabelToN`/`nToFrequencyLabel` in `volunteerCsv.ts` are
reused unchanged for each per-role select in the new UI.
**Warning signs:** A plan that proposes changing the CSV header schema (e.g. `Frequency:Guitar`,
`Frequency:Vocals` columns) is over-scoping relative to CONTEXT.md's explicit "degrade
gracefully" allowance — flag for discussion if a plan does this.

### Pitfall 5: `PersonQuarterData.blackoutDates`/`pairedWith` must NOT be touched by this phase

**What goes wrong:** Because both cadence (D-04) and tier (D-05) are moving to per-role, it's
easy to over-generalize and start threading roleId through blackout/pairing logic too.
**Why it happens:** D-05's reconciliation work sits right next to blackout/pairing fields on the
same `PersonQuarterData` interface.
**How to avoid:** D-07 explicitly locks blackout dates and pairings as per-person, unchanged
shape. Only `frequencyTier` (→ per-role) moves; `blackoutDates: string[]` and `pairedWith:
string[]` stay exactly as they are.
**Warning signs:** Any diff touching `isBlackedOut`/`partnersOf`/`propagatePairing`'s blackout or
pairing *data shape* (as opposed to its group-check logic, which does need touching) is out of
scope.

## Code Examples

### Existing tolerant-default read (to mirror for per-role tier)
```typescript
// Source: src/utils/scheduler.ts line 37 (existing code)
const tierOf = (personId: string): FrequencyTier => pqdById.get(personId)?.frequencyTier ?? 'regular'
```

### Existing scoped Firestore dot-path write (to mirror for roleFrequencies/per-role tier)
```typescript
// Source: src/stores/quarters.ts setPersonAvailability (existing code)
const updates: Record<string, unknown> = {
  [`personQuarterData.${personId}`]: { personId, ...data },
  updatedAt: serverTimestamp(),
}
```

### Existing opportunistic migration (to mirror for D-03/D-09)
```typescript
// Source: src/stores/auth.ts lines 109-124 (existing code)
const patch: Record<string, unknown> = {}
if (role === 'admin') patch.role = 'editor'
if (Object.keys(patch).length > 0) {
  await updateDoc(snap.ref, patch)
}
```

### Existing deterministic scheduler test factory pattern (to extend for co-occurrence tests)
```typescript
// Source: src/utils/__tests__/scheduler.test.ts (existing code)
function makePerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    // ...
    roles: overrides.roles ?? [],
    frequencyTargetN: overrides.frequencyTargetN ?? 1,
    // Phase 15: extend with roleFrequencies default here too
  }
}
```

## State of the Art

Not applicable — no external library/framework version drift to track. All "state of the art"
here is internal: Phase 13 (base data model) → Phase 14 (per-person tier + availability editor)
→ Phase 15 (per-role frequency + tier + group co-occurrence). See PROJECT.md Key Decisions and
each phase's CONTEXT.md for the evolution chain.

**Superseded by this phase:**
- `Person.frequencyTargetN` as the sole cadence value — becomes a fallback/default; per-role
  `roleFrequencies` becomes authoritative when present.
- `PersonQuarterData.frequencyTier` as a single per-person value — becomes per-role (exact field
  name is planner's discretion per D-05, e.g. `roleTiers: Record<string, FrequencyTier>`).
- `RoleGroup = 'band' | 'tech' | 'other'` — becomes `'band' | 'tech' | 'vocals' | 'other'`.
- The scheduler's implicit "no cross-role same-service exclusion" behavior (explicitly called
  out as a gap in CONTEXT.md canonical refs) — replaced by the D-10/D-12 group rules.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Person.roleFrequencies: Record<string, number>` is the best persistence shape (vs. keeping `frequencyTargetN` only or an array) | Standard Stack / Summary | Low — D-04 explicitly leaves this to planner's discretion; this is a recommendation, not a locked decision, and the rationale (Firestore dot-path writes, mirrors existing `personQuarterData` map pattern) is verifiable in-repo, not external-sourced |
| A2 | Deficit/servedCounts scoring should move to per-(person, role) tracking internally | Anti-Patterns / Pitfall | Medium — if the planner instead keeps a per-person aggregate `served` count without per-role granularity, fairness across differently-cadenced roles for the same person will be subtly wrong; this is a design call flagged for the planner, not something research can unilaterally decide |
| A3 | CSV format should NOT change (single Frequency column applied to all roles in the row) | Pitfall 4 | Low — directly supported by CONTEXT.md's explicit "degrade gracefully to a per-person default on import" allowance |
| A4 | Migration should be opportunistic/patch-on-read (mirroring `auth.ts`), not a batch script | Pattern 2 / Don't Hand-Roll | Low — this is the only migration pattern that exists anywhere in this codebase; a batch-script alternative would require new tooling (Firebase Admin SDK, service account) with zero precedent |

**None of the above are compliance/security/performance-target claims** — all are internal
architecture recommendations grounded in code actually read this session.

## Open Questions

1. **Exact field name and shape for per-role tier on `PersonQuarterData`**
   - What we know: it must be per-role (D-05), quarter-scoped (stays on `PersonQuarterData`, not
     `Person` — D-07 confirms only cadence/tier move, and tier is explicitly quarter-scoped by
     Phase 14's own reasoning), and must default to `'regular'` per-role when absent (mirrors
     current `frequencyTier ?? 'regular'`).
   - What's unclear: whether to name it `roleTiers: Record<string, FrequencyTier>` or nest it
     differently (e.g., replace `frequencyTier?` entirely vs. keep both fields during a
     transition window).
   - Recommendation: `roleTiers?: Record<string, FrequencyTier>` alongside a retained
     `frequencyTier?` (deprecated fallback, same "keep the old field as default-source" approach
     recommended for `frequencyTargetN`) — the planner should decide whether to keep or drop the
     old singular fields after migration; keeping them is lower-risk (additive change, existing
     tests/reads keep working) but adds minor duplication.

2. **Whether `servedCounts` in `ProposeResult` should become per-(person, role) or stay
   per-person aggregate**
   - What we know: nothing in the current codebase reads `servedCounts` outside
     `scheduler.ts`/its tests — no UI consumes it today (confirmed via grep).
   - What's unclear: whether a future phase might want per-role fairness reporting in the UI,
     which would argue for making the shape richer now vs. later.
   - Recommendation: keep the external `ProposeResult.servedCounts` shape as `Record<personId,
     number>` (aggregate, for back-compat and because nothing currently needs more), but track
     deficit scoring internally per-(person, role) — this satisfies both the "don't break the
     external contract" and "score fairness correctly" concerns simultaneously.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the project's
existing Node/npm/Firebase toolchain, all of which are already in use by every prior phase in
this repo (no new probing needed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (`vitest.config.ts` via `vite.config.ts` merge — project already fully wired) |
| Config file | `vitest.config.ts` (component/unit tests); `vitest.rules.config.ts` (Firestore rules, separate — not relevant to this phase) |
| Quick run command | `npx vitest run src/utils/__tests__/scheduler.test.ts` |
| Full suite command | `npm run test:unit` |

### Phase Requirements → Test Map

No formal `.planning/REQUIREMENTS.md` exists in this project — CONTEXT.md's D-01..D-12 decisions
are the requirement set for this phase (per task framing). Mapping each to its verification test:

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-01/D-02 | Per-role frequency control renders one row per held role, defaults to N=4 when blank | component | `npx vitest run src/views/__tests__/RosterView.test.ts` (or new file) | ❌ Wave 0 — no `RosterView.test.ts` exists today; new file needed |
| D-03 | Migration copies `frequencyTargetN` onto all currently-held roles, once, idempotently | unit | `npx vitest run src/stores/__tests__/roster.test.ts` | ✅ file exists — add new test cases (mock snapshot with legacy shape → assert patch `updateDoc` call) |
| D-04 | `roleFrequencies` map persists and round-trips through `upsertPeople`/`updatePerson` | unit | `npx vitest run src/stores/__tests__/roster.test.ts` | ✅ existing file, extend |
| D-05 | Per-role tier defaults to `'regular'` when absent; `PersonQuarterData` supports per-role map | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts` | ✅ existing file, extend `makePQD` factory + add cases |
| D-06 | Availability drawer renders one tier control per held role | component | `npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts` | ✅ existing file, extend |
| D-07 | Blackout/pairing shapes unchanged (regression) | unit | existing `scheduler.test.ts` pairing/blackout cases must still pass unmodified | ✅ existing, no new file |
| D-08/D-09 | `RoleGroup` includes `'vocals'`; migration reclassifies seeded `vocals` role band→vocals | unit | `npx vitest run src/stores/__tests__/roster.test.ts` | ✅ existing, extend (mock roles snapshot with legacy `group: 'band'`, name `'vocals'` → assert patch) |
| D-10/D-12 | Scheduler never assigns TECH + non-TECH same date/person; caps 1 BAND + 1 VOCALS per person/date | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts` | ❌ Wave 0 — new test cases required (main loop AND `propagatePairing` path — see Pitfall 2) |
| D-11 | `QuarterGrid.vue` renders a visible warning badge on manual assignments that violate group rules, without blocking the edit | component | `npx vitest run src/components/__tests__/QuarterGrid.test.ts` | ✅ existing file, extend |
| CSV compatibility | Per-role frequency import applies the row's single Frequency value to all roles in that row | unit | `npx vitest run src/utils/__tests__/volunteerCsv.test.ts` + `src/components/__tests__/CsvImportModal.test.ts` (mislabeled — actually covers song CSV; volunteer CSV import UI has no existing component test file) | ❌ Wave 0 for a `VolunteerCsvImportModal.test.ts` if per-role behavior needs component-level coverage; `volunteerCsv.ts` pure-function coverage already exists |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` (fast, targeted — mirrors existing project convention of file-scoped test runs)
- **Per wave merge:** `npm run test:unit` (full suite) + `npm run type-check` (`vue-tsc --build` — critical here because of the `RoleGroup` exhaustive-Record-key pitfall)
- **Phase gate:** Full suite + type-check green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/views/__tests__/RosterView.test.ts` — does not exist; needed to cover D-01/D-02 per-role
      frequency form rendering (no existing test file for this view was found)
- [ ] New `scheduler.test.ts` cases for D-10/D-12 group exclusivity + cardinality, covering BOTH
      the main `eligible()` loop and the `propagatePairing` path explicitly (Pitfall 2)
- [ ] Decide whether `VolunteerCsvImportModal.vue` needs a new dedicated test file, or whether
      existing `volunteerCsv.ts` pure-function tests are sufficient coverage for the CSV
      compatibility requirement (component has no existing test file — `CsvImportModal.test.ts`
      is a different, song-import component)
- [ ] Framework install: none — Vitest/@vue/test-utils already fully configured

## Security Domain

Not applicable — `security_enforcement` is absent from `.planning/config.json`'s workflow block,
which per the protocol defaults to "enabled," but this phase introduces no new authentication,
session, input-boundary-crossing, or cryptographic surface. It is a pure data-shape/business-logic
change on an already-authenticated, already-org-scoped Firestore collection (`people`, `roles`,
`quarters` — all already gated by existing Firestore Security Rules and org membership checks
established in prior phases). No new ASVS categories are triggered.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | no (unchanged) | Existing org-scoped Firestore rules already gate all `people`/`roles`/`quarters` reads/writes; this phase adds fields to existing documents under the same rules, no new collections/paths |
| V5 Input Validation | yes (unchanged pattern) | Per-role frequency input still constrained to `[1,8]` via the same `Math.max(1, Math.min(8, ...))` clamp pattern already used in `AvailabilityDrawer.vue`'s `onFrequencyNChange` — reuse, don't reinvent |

## Sources

### Primary (HIGH confidence — all direct code reads this session)
- `C:\projects\worshipplanner\src\types\roster.ts` — RoleGroup, Role, Person, PersonQuarterData, FrequencyTier, DEFAULT_ROLES, UpsertPersonInput, ProposeResult
- `C:\projects\worshipplanner\src\utils\scheduler.ts` — proposeQuarterSchedule, eligible(), propagatePairing(), tierOf()
- `C:\projects\worshipplanner\src\utils\__tests__\scheduler.test.ts` — all 14 existing deterministic test cases (blackout, multi-role, deficit, tie-break, unfilled, pairing, pairing conflict, override, consecutive, fillin, fillin-last-resort, out-tier, default-safety, fill-gaps)
- `C:\projects\worshipplanner\src\stores\roster.ts` — upsertPeople, addPerson, updatePerson, seedDefaultRolesIfEmpty, addRole/updateRole/deleteRole
- `C:\projects\worshipplanner\src\stores\quarters.ts` — applyCsvToQuarter, setPersonAvailability, buildResolveRolesForDate, generateProposal, assignPerson/clearAssignment/swapAssignment
- `C:\projects\worshipplanner\src\stores\auth.ts` (lines 75-144) — the project's only existing one-time-migration precedent (admin→editor patch-on-read)
- `C:\projects\worshipplanner\src\views\RosterView.vue` — Edit Volunteer form (single frequency select, roles checklist, sort/search)
- `C:\projects\worshipplanner\src\components\AvailabilityDrawer.vue` — per-quarter tier/frequency controls, FREQ_PRESETS
- `C:\projects\worshipplanner\src\components\QuarterGrid.vue` — manual assignment grid, cellIsUnfilled/cellHasConflict pattern, GROUP_ORDER/groupHeaderBg
- `C:\projects\worshipplanner\src\components\RolesConfigPanel.vue` — role group config UI, groupLabels/groupBadgeClasses/groupOrder
- `C:\projects\worshipplanner\src\components\AvailabilityRosterTable.vue` — ROLE_CHIP_CLASS, quarterDataFor tolerant-default pattern
- `C:\projects\worshipplanner\src\utils\volunteerCsv.ts` — frequencyLabelToN/nToFrequencyLabel/expandBlackoutCell/parseVolunteerCsvRow
- `C:\projects\worshipplanner\src\components\VolunteerCsvImportModal.vue` — CSV import commit flow, single-Frequency-column-per-row confirmed
- `C:\projects\worshipplanner\.planning\phases\15-per-role-frequency-role-categories\15-CONTEXT.md` — D-01..D-12 locked decisions
- `C:\projects\worshipplanner\.planning\phases\14-in-app-quarterly-availability-editor\14-CONTEXT.md` — Phase 14 D-04/D-05/D-06 foundation this phase reconciles
- `C:\projects\worshipplanner\.planning\todos\pending\per-role-frequency-and-vocal-instrument-pairing.md` — originating requirement/co-occurrence matrix
- `C:\projects\worshipplanner\package.json` — confirmed test stack (Vitest 4.0.18, @vue/test-utils 2.4.6, no new deps needed)
- `C:\projects\worshipplanner\.planning\config.json` — confirmed `nyquist_validation` absent (defaults enabled) and no `security_enforcement: false`

### Secondary / Tertiary
None — this research required no external web search, Context7, or WebFetch lookups; the entire
scope is internal codebase investigation, and all claims trace to files read directly in this
session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing stack fully verified via package.json
- Architecture: HIGH — every file/line cited was read directly this session, not inferred
- Pitfalls: HIGH — Pitfalls 1, 2, 3 are confirmed by direct code inspection (missing group field
  in `RoleSlotConfig`, `propagatePairing`'s independent code path, and the 5 `Record<RoleGroup,
  ...>` usage sites), not speculation

**Research date:** 2026-07-08
**Valid until:** No expiry driver — this is internal-codebase research tied to the current commit
state, not a time-sensitive external ecosystem; valid as long as no other phase changes
`scheduler.ts`/`roster.ts`/`roster.ts` types before Phase 15 executes. Recommend re-checking `git
diff` against these files at plan time if there's a gap between this research and execution.
