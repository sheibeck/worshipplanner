# Phase 13: Volunteer Role Scheduling - Research

**Researched:** 2026-07-06
**Domain:** Constraint-based volunteer roster scheduling; Planning Center Services v2 API extension; CSV import with preview/reconciliation; Firestore org-scoped data modeling
**Confidence:** MEDIUM-HIGH (algorithm design HIGH — pure-function pattern already proven in this codebase; PC people-endpoint shape MEDIUM — verified via PC's public docs site but not via a live authenticated call; data-model reconciliation of D-15/D-18/D-19 MEDIUM — required interpretation, flagged below)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Service dates & role slots
- **D-01:** Service dates are auto-generated as every Sunday within a chosen quarter (e.g. Q3 2026). Special/one-off dates are added or removed by hand after generation.
- **D-02:** Each service's required role slots come from a **default role-count template** applied to every Sunday, **overridable per date** (a specific Sunday can add/drop roles or change counts, e.g. an extra vocalist or no livestream).
- **D-03:** The **role list is editable** by the worship leader — ship known defaults but allow add/rename/remove. Defaults, grouped:
  - **Band:** guitar, drums, vocals, bass
  - **Tech:** sound, livestream, projection
  - **Other:** scripture reader
- **D-04:** A single role slot can hold **multiple people** on one Sunday (e.g. several vocalists). One person can hold **multiple roles** on the same Sunday (e.g. plays an instrument and also sings).
- **D-05:** "Worship leader" is intentionally **not a schedulable role** — the leaders assign themselves manually.

#### Proposal algorithm
- **D-06:** Each person has a **serve-frequency target expressed as a 1-in-N cadence** (e.g. weekly, twice a month, once a month) — applies to everyone, no special-casing.
- **D-07:** **Hard constraints (never violated):** blackout dates (never schedule a person on a date they blacked out) and pairings.
- **D-08:** **Soft constraint:** the frequency target — balanced toward, but bent when needed to fill a slot.
- **D-09:** **Pairing semantics = "same dates, own roles":** if either paired person is scheduled on a date, the other is also scheduled that date, in whatever role they can fill (kid on vocals, parent on guitar). Not the same role. (Primary use case: kids who must serve on the same dates as their serving parent.)
- **D-10:** **Unfillable slot → leave empty and flag it** (e.g. red "Unfilled"). Never fill by violating a blackout, and never silently over-schedule someone past their target to close a gap.
- **D-11:** **Tie-breaking:** when multiple people are equally eligible for a slot, pick whoever is **furthest below their frequency target** (most "owed" service relative to how often they want to serve).
- **D-12:** **No special back-to-back-week rule** — the 1-in-N target + furthest-below-target scoring naturally spaces low-frequency people out while allowing a weekly-target person to serve every week.

#### Roster & imports
- **D-13:** **Two import paths, divided:** Planning Center import seeds/updates the roster; the quarterly CSV carries per-quarter constraints.
- **D-14:** **PC people import** pulls the basic person record: **name, email, phone**. It does **not** import PC's stored blockouts/availability (availability comes via the CSV). Roles are assigned in-app (or via the CSV), not derived from PC.
- **D-15:** **Quarterly CSV layout = one row per person, multi-value cells `;`-separated.** Columns: **Name, Roles, Frequency, Blackout Dates, Serve-With.** (e.g. Roles = `vocals; guitar`; Blackout Dates = `2026-07-05; 2026-08-16`.)
- **D-16:** **CSV matching is by name** (case-insensitive) — the planner builds the CSV from email replies and typically won't have emails. Show an **import preview** that flags unmatched/ambiguous rows so the user can map-to-existing-person or create-new before committing. (Reuse the Phase 9 import-preview pattern.) Serve-With values reference the partner by name.
- **D-17:** **Blackout date format:** individual dates (`2026-07-05`) and **ranges** (`2026-07-05..2026-08-02`, covering a vacation), `;`-separated. Blackout dates are matched to / expanded across the generated service Sundays. (Shorthands like "all of August" are out — see Deferred.)

#### Quarter lifecycle
- **D-18:** **Roster + roles + frequency target persist** (standing data, set once, carried forward). **Blackout dates are per-quarter and reset (start empty) each new quarter**, filled by that quarter's CSV.
- **D-19:** **Same-quarter re-import = per-person replace:** for each person present in the new CSV, overwrite their quarter data (blackouts, frequency, serve-with); people **not** in the CSV are left untouched. (Lets a late reply be imported without wiping others.)
- **D-20:** **Person lifecycle = soft-delete / mark inactive** (mirrors the Phase 9 song hide/restore): inactive people drop out of proposals and pickers but their history and record persist; can be reactivated.

#### Output & Planning Center relationship
- **D-21:** The finished schedule lives in **WorshipPlanner only** — no push to Planning Center this phase.
- **D-22:** Primary interaction is an **editable grid: rows = service Sundays, columns = roles, cells = assigned people**, with unfilled slots flagged. Click a cell to reassign / swap / clear / add a second person. Whole-quarter-at-a-glance for spotting gaps and balance.
- **D-23:** The grid must be a **gap-filling aid**: per date (especially for unfilled slots) surface **who blacked out that date** (so the leader doesn't chase them) and the **available-but-unassigned candidates** for the role (so it's easy to see who to contact). Goal: see the whole schedule, find gaps, contact people to fill them manually.
- **D-24:** Output surfaces: **printable roster** and a **read-only share link** (reuse the existing service share pattern).
- **D-25:** **Availability collection stays external** — the leader emails volunteers and collects replies outside the app, then imports via CSV. The app does not send emails in this phase.

### Claude's Discretion
- Data model / Firestore collection shape for people, roles, role-count templates, quarters, blackouts, pairings, and the generated calendar (org-level, following existing store patterns). Roster people are NOT app users/RBAC members — a separate people collection.
- The exact constraint-solver approach (deterministic greedy/scored fill is the expected default given the hard/soft split and furthest-below-target tie-break; AI is not required for scheduling).
- Default role-count template values and the default frequency target for a newly-imported (not-yet-in-CSV) person.
- CSV column header exact spelling, downloadable template, and how the frequency value is expressed (friendly labels ↔ 1-in-N).
- Grid UI specifics (defer detailed layout to `/gsd:ui-phase 13` if desired).

### Deferred Ideas (OUT OF SCOPE)
- **Push assignments to Planning Center** — assign people to PC plan positions/teams so PC sends its accept/decline notifications. Large new PC-write integration; its own phase.
- **In-app self-service availability form** — a link for volunteers to submit their own blackout dates directly (no CSV). Needs a public form + identity handling; its own phase.
- **App-drafted quarterly ask email / contact-list export** — help send the "when can't you serve" email from the app. Convenience; future.
- **Blackout shorthands** — natural phrases like "all of August" or "every 2nd Sunday" in the CSV. Deferred in favor of explicit dates + ranges (D-17) to avoid ambiguous parsing.
- **Multiple services per Sunday** (e.g. two service times needing separate staffing) — not modeled this phase; single service per Sunday assumed.
- **Per-role frequency targets** — one target per person for now, not per-role.

### Canonical References (from CONTEXT.md)
- `src/utils/planningCenterApi.ts` — existing Services API v2 client (auth via Personal Access Token, `fetchServiceTypes`, `fetchServiceTypeTeams`, `fetchTeamPositions`, `fetchPlans`, etc.). Extend with a **people fetch** (`/services/v2/people` — name, email, phone) for the roster import.
- `.planning/phases/08-planning-center-api-export-for-published-service-plans/08-CONTEXT.md` — PC auth decisions: Personal Access Token (App ID + Secret), stored org-level in Firestore, masked after save, validated on save. Roster import reuses these credentials.
- `src/stores/songs.ts` — Phase 9 patterns: `upsertSongs`, soft-delete (`hidden`)/`restoreSong`, re-import-safe upsert. The roster upsert, per-person CSV replace (D-19), and person soft-delete (D-20) should follow these.
- `.planning/phases/09-pc-song-import-tag-management/09-CONTEXT.md` — import-preview + soft-delete/restore design reused by D-16 and D-20.
- `.planning/PROJECT.md` — this phase reverses the "Musician scheduling — handled in Planning Center" out-of-scope line (confirmed present at PROJECT.md line 51); update PROJECT.md scope during planning.
- `.planning/ROADMAP.md` §"Phase 13" — phase goal + scope (kept in sync with these decisions).
</user_constraints>

<phase_requirements>
## Phase Requirements

No formal REQ-IDs exist for this phase — per CONTEXT.md, the 25 decisions (D-01..D-25) above are the requirement set the planner must satisfy.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Auto-generate every Sunday in a chosen quarter; hand add/remove one-off dates | Code Examples § "Quarter date generation"; Validation Architecture (quarterDates.test.ts) |
| D-02 | Default role-count template, overridable per date | Architecture Patterns; Code Examples (`resolveRolesForDate`); Pitfall 1 (template is soft, not a hard cap) |
| D-03 | Editable role list, grouped Band/Tech/Other with named defaults | Recommended Project Structure (Role type); Assumption A5 (groups fixed, roles editable) |
| D-04 | Multi-person-per-role, multi-role-per-person | Scheduler Code Example (`calendar[date][roleId]` arrays; no "assigned today" block across roles); Validation Architecture |
| D-05 | Worship leader is not a schedulable role | Data model — no special-case field needed; simply never seed a "worship leader" Role record |
| D-06/D-08 | 1-in-N frequency target, soft constraint | Scheduler deficit formula in Summary + Code Examples |
| D-07 | Blackout + pairing are hard constraints | Scheduler `isBlackedOut` gate before every assignment attempt (incl. pairing propagation) |
| D-09 | Pairing = same date, own (not same) role | Scheduler `propagatePairing` function; Pitfall 1; Assumption A4 |
| D-10 | Unfillable slot → empty + flagged, never violate blackout or over-schedule | Scheduler `unfilled` array; Validation Architecture test row |
| D-11 | Tie-break = furthest below target | Scheduler sort comparator (`deficit` desc, then deterministic secondary keys) |
| D-12 | No back-to-back suppression rule | Explicitly NOT implemented — Validation Architecture "consecutive" test proves natural behavior |
| D-13/D-14 | PC import seeds roster (name/email/phone); no PC blockouts imported | Architecture Patterns Pattern 3; Pitfall 5 + Assumption A1 (phone not available via Services v2) |
| D-15/D-16/D-17 | Quarterly CSV shape, name-matching + preview, blackout dates/ranges | Code Examples (`expandBlackoutCell`); Pitfall 4; Validation Architecture (volunteerCsv.test.ts) |
| D-18/D-19 | Standing vs per-quarter fields; per-person replace on re-import | Pitfall 3 + Assumption A2 (schema reconciliation); Recommended Project Structure |
| D-20 | Soft-delete / reactivate person | Architecture Patterns Pattern 2 (mirrors `songs.ts` hidden/restoreSong) |
| D-21 | No push to Planning Center this phase | No PC write functions proposed anywhere in this research |
| D-22/D-23 | Editable dates×roles grid; surface blackouts + available-unassigned candidates per gap | Recommended Project Structure (`QuarterGrid.vue`); System Architecture Diagram |
| D-24 | Printable roster + read-only share link | Architecture Patterns (reuse `ServicePrintLayout.vue` / `createShareToken` / `ShareView.vue`) |
| D-25 | No in-app email sending | No email-sending code proposed |
</phase_requirements>

## Summary

This phase has almost no new library surface — it reuses PapaParse (already installed), the existing Planning Center Basic-Auth client pattern (`planningCenterApi.ts`), the existing soft-delete/upsert store pattern (`songs.ts`), and the existing share-link/print patterns. The genuinely new work is (1) a deterministic, pure, unit-testable **greedy weighted-fair-share scheduler** and (2) a **Firestore data model** for roster/roles/quarters/pairings/calendar that mirrors this codebase's established org-scoped `onSnapshot` Pinia-store conventions.

The scheduler is the centerpiece. It processes service dates chronologically and, within each date, processes roles in a stable configured order. For each open slot it computes a **deficit score** per eligible candidate — `deficit = expectedServiceCountByThisDate - actualServedSoFar`, where `expectedServiceCountByThisDate = (dateIndex + 1) / frequencyTargetN` — and picks the candidate with the highest deficit (furthest below their own target), a direct implementation of D-11. This is the same "pure function, injectable inputs, sort-by-score" shape already used by `src/utils/suggestions.ts` (verified in this codebase and unit-tested in `suggestions.test.ts`), so the scheduler should live in `src/utils/scheduler.ts` following that exact pattern.

Pairing (D-09) is modeled as a **propagation side-effect** of each normal assignment: whenever a person with a pairing partner is chosen for a slot, the partner is immediately assigned to the date too (in one of the partner's own eligible roles, consuming existing role-count capacity first and overflowing the configured count only as a last resort — never dropping the hard constraint). Blackout dates are checked before every assignment attempt (including pairing propagation) and can never be violated; if honoring a pairing would require violating the partner's blackout, the pairing is flagged as a conflict rather than silently broken or forced.

One important verified finding: **Planning Center Services v2 does not expose a phone-number resource** (confirmed against the live PC docs site — only `Email` exists as a nested vertex under `/services/v2/people/{id}/emails`; no `PhoneNumber`/`phone_numbers` vertex exists in the full 79-resource vertex list for API version `2018-11-01`). CONTEXT.md's D-14 says the PC import pulls "name, email, phone" — the planner needs to know phone is **not fetchable from Services v2** and must be entered/edited manually in-app (or sourced from the general People v2 app, which is out of scope per the canonical refs pointing at Services v2 only).

**Primary recommendation:** Build the scheduler as a pure function in `src/utils/scheduler.ts` (TDD, mirroring `suggestions.ts`/`suggestions.test.ts`), extend `planningCenterApi.ts` with a paginated `fetchAllPeople` (Person + nested `emails` fetch, no phone), model roster/roles/quarters as new org-scoped Firestore collections following `songs.ts`'s subscribe/upsert/soft-delete conventions, and reuse PapaParse + the Phase 9 `PcImportModal` preview-step pattern for the quarterly CSV.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Roster people CRUD + soft-delete | API/Backend (Firestore) | Browser (Pinia store cache) | Mirrors `songs.ts` — Firestore is source of truth, Pinia store is the reactive cache via `onSnapshot` |
| Role list + role-count template | API/Backend (Firestore) | Browser | Small, leader-editable config; same pattern as org-level settings |
| PC people import (fetch) | Browser (client-side fetch via Vite dev proxy / Firebase Hosting rewrite) | — | Existing `planningCenterApi.ts` client runs entirely client-side; no backend function needed (matches Phase 8/9 precedent) |
| CSV parsing + name-matching preview | Browser | — | PapaParse runs client-side; matching logic is pure JS, testable in isolation |
| Quarter date generation (Sundays) | Browser (pure util) | — | Pure date-math function, no I/O, highly testable |
| Constraint-solver / auto-proposal | Browser (pure util, called from a store action) | API/Backend (Firestore write of result) | Pure function computes the proposal in-memory; a store action then persists it in one write — same shape as `createShareToken` computing then writing |
| Dates×roles editable grid | Browser (Vue component) | API/Backend (Firestore write per edit) | UI concern; each cell edit is a small Firestore update, same as existing slot-editing patterns in `ServiceEditorView.vue` |
| Printable roster + share link | Browser (print CSS) + API/Backend (`shareTokens` doc) | — | Directly reuses `ServicePrintLayout.vue` + `createShareToken`/`ShareView.vue` pattern |
| RBAC (editor writes, viewer reads) | API/Backend (Firestore rules) | Browser (router meta + `authStore.isEditor`) | Existing `firestore.rules` catch-all (`match /{collection}/{docId}` under `organizations/{orgId}`) already covers new collections — no rules changes needed unless a public share-token-like read is required (see below) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PapaParse | ^5.5.3 (already installed; registry latest 5.5.4) [VERIFIED: package.json + npm registry] | Parse quarterly volunteer CSV | Already the project's CSV parser (used for song CSV import); no reason to introduce a second parser |
| firebase (Firestore + Auth) | ^12.0.0 (already installed) [VERIFIED: package.json] | Org-scoped data storage, `onSnapshot` real-time roster/calendar | Existing backend for the entire app |
| pinia | ^3.0.4 (already installed) [VERIFIED: package.json] | New `roster.ts` / `quarters.ts` stores | Existing state pattern (`songs.ts`, `services.ts`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — (native `crypto.getRandomValues`) | n/a | Share-token generation for the finalized quarter roster | Reuse the exact token-generation snippet already in `services.ts::createShareToken` — no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deterministic greedy/scored solver | A constraint-solving library (e.g. an ILP/CP solver, or a generic scheduling npm package) | CONTEXT.md's "Claude's Discretion" explicitly names deterministic greedy/scored fill as the expected default; a general CP/ILP solver adds a heavy new dependency, non-determinism/tuning risk, and is unnecessary at this data scale (a few dozen people × ~13 dates × ~10 roles). Not recommended. |
| Storing calendar as a subcollection (one doc per date) | Embedding the whole quarter's calendar as a single map field on the quarter doc | A single doc is simpler to `onSnapshot` (one listener per quarter, matching the existing "one collection/doc per store" convention) and the data volume (≈13 dates × ~10 roles × ~1.2 people ≈ 150 small entries) is trivially under Firestore's 1 MiB document limit. A subcollection-per-date would only be justified at a much larger date/role count. |

**Installation:**
No new packages required — this phase reuses PapaParse, Firebase, and Pinia, all already present in `package.json`.

## Package Legitimacy Audit

**Not applicable this phase.** No new external packages are introduced — the phase is implemented entirely with dependencies already installed and audited in prior phases (PapaParse for CSV, Firebase/Firestore for storage, Pinia for stores, native `crypto` for tokens). If the planner discovers a genuine need for a new package during task breakdown (e.g., a date-range library), the Package Legitimacy Gate protocol must be run at that time.

## Architecture Patterns

### System Architecture Diagram

```
[Planning Center Services v2 API]
        |  GET /services/v2/people (paginated via links.next)
        |  GET /services/v2/people/{id}/emails
        v
[fetchAllPeople() in planningCenterApi.ts]  --(client-side fetch via /api/planningcenter proxy)--
        |
        v
[RosterImportModal.vue]  --preview (add/update counts, mirrors PcImportModal.vue)-->  [user confirms]
        |
        v
[roster store: upsertPeople()]  --writeBatch/updateDoc/addDoc, preserves active + soft-delete-->  [organizations/{orgId}/people]
        |
        |  (separately, each quarter)
        v
[Quarterly CSV file] --PapaParse--> [parseVolunteerCsv() pure fn] --name-match against roster--> [ImportPreviewModal: unmatched/ambiguous rows]
        |
        v  (user resolves matches, confirms)
[quarters store: applyCsvToQuarter()] --per-person replace (D-19)--> [organizations/{orgId}/quarters/{id}/personQuarterData/{personId}]
        |
        v
[proposeQuarterSchedule() PURE FUNCTION in scheduler.ts]
   inputs: people[], roles[], roleTemplate, quarter.serviceDates[], quarter.roleOverridesByDate,
           personQuarterData[] (blackouts + pairings)
   output: { calendar: {date: {roleId: personId[]}}, unfilled: [...], conflicts: [...] }
        |
        v
[quarters store: saveGeneratedCalendar()] --writes result onto quarter doc-->  [organizations/{orgId}/quarters/{id}.calendar]
        |
        v
[QuarterGridView.vue] --dates x roles editable grid, reads calendar + blackouts + roster live via onSnapshot--
        |          |
        |          +--> per-cell edit --> quarters store: assignPerson()/clearAssignment()/swap() (direct Firestore update, same as ServiceEditorView slot edits)
        v
[Finalize] --> ServicePrintLayout-style print view + createShareToken()-style share link --> [shareTokens/{token}] (public read) --> [ShareView-style public route]
```

### Recommended Project Structure
```
src/
├── types/
│   └── roster.ts          # Person, Role, Quarter, PersonQuarterData, CalendarAssignment types
├── stores/
│   ├── roster.ts          # People + roles: subscribe/upsertPeople/deletePerson(soft)/restorePerson
│   └── quarters.ts        # Quarter CRUD, personQuarterData CSV apply, calendar save/edit, share token
├── utils/
│   ├── quarterDates.ts    # generateSundaysForQuarter(), applyDateAdditionsRemovals()
│   ├── volunteerCsv.ts    # parseVolunteerCsvRow(), expandBlackoutRanges(), matchNameToPerson()
│   ├── scheduler.ts        # proposeQuarterSchedule() — pure, no Firestore/PC imports
│   └── planningCenterApi.ts  # + fetchAllPeople() appended to existing file
├── components/
│   ├── RosterImportModal.vue      # mirrors PcImportModal.vue exactly
│   ├── VolunteerCsvImportModal.vue # mirrors CsvImportModal.vue + Phase 9 preview pattern
│   ├── QuarterGrid.vue             # dates x roles editable grid (D-22/D-23)
│   └── RosterPrintLayout.vue       # mirrors ServicePrintLayout.vue
└── views/
    ├── RosterView.vue      # people list, roles config, active/inactive
    ├── QuarterView.vue     # quarter picker, CSV import, generate, grid, finalize/share/print
    └── QuarterShareView.vue  # public read-only view (mirrors ShareView.vue), OR extend ShareView.vue's snapshot shape to a discriminated union
```

### Pattern 1: Pure-function scheduler with injectable inputs (no hidden state)
**What:** `proposeQuarterSchedule(people, roles, quarter, personQuarterData, options)` takes plain arrays/objects and returns a plain result object. It performs no Firestore reads/writes and no `Date.now()` calls (all dates come from `quarter.serviceDates`).
**When to use:** Any time the "propose" or "fill gaps" action is invoked from the store; the store is responsible for gathering current state, calling the pure function, and persisting the result.
**Example:**
```typescript
// Source: pattern verified in src/utils/suggestions.ts (existing codebase, unit-tested)
export function rankSongsForSlot(
  songs: Song[],
  requiredVwType: VWType,
  serviceTeams: string[],
  nowMs: number = Date.now(),
): SuggestionResult[] {
  // ... pure scoring + sort, no I/O
}
```
The scheduler should follow this exact shape: `proposeQuarterSchedule(...): { calendar, servedCounts, unfilled, pairingConflicts }`.

### Pattern 2: Org-scoped `onSnapshot` Pinia store with soft-delete
**What:** One collection under `organizations/{orgId}/...`, subscribed via `onSnapshot`, with `hidden`/`active` boolean instead of hard delete.
**When to use:** `roster.ts` store for people (mirrors `songs.ts` exactly — `active` plays the inverse role of `hidden`).
**Example:**
```typescript
// Source: src/stores/songs.ts (existing codebase)
async function deleteSong(id: string) {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'songs', id), {
    hidden: true,
    updatedAt: serverTimestamp(),
  })
}
async function restoreSong(id: string) {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'songs', id), {
    hidden: false,
    updatedAt: serverTimestamp(),
  })
}
```
For people: `deactivatePerson(id)` sets `active: false`; `reactivatePerson(id)` sets `active: true` (D-20). Filter proposals/pickers with `people.filter(p => p.active)`, exactly like `aiCandidateSongs` filters `hidden !== true`.

### Pattern 3: Paginated PC fetch via `links.next`
**What:** Follow JSON:API `links.next`, rewriting the absolute PC URL back to the local proxy path.
**When to use:** `fetchAllPeople()` — new function in `planningCenterApi.ts`, modeled directly on `fetchAllPcSongs()` in `pcSongImport.ts`.
**Example:**
```typescript
// Source: src/utils/pcSongImport.ts (existing codebase) — adapt for /services/v2/people
let url: string | undefined = `${PC_BASE_URL}/people?per_page=100`
const allPeople: PcPersonData[] = []
while (url) {
  const response = await fetch(url, { headers: { Authorization: authHeader, Accept: 'application/json' } })
  // ... 429 retry-after handling identical to fetchAllPcSongs
  const json = await response.json() as { data: PcPersonData[]; links: { next?: string } }
  allPeople.push(...json.data)
  url = json.links.next
    ? json.links.next.replace('https://api.planningcenteronline.com/services/v2', PC_BASE_URL)
    : undefined
}
```
Then, per person, fetch `emails` (nested endpoint `GET /services/v2/people/{id}/emails`) — batch in groups of 3 like `fetchAndMapPcSongs` does for arrangements, to respect PC rate limits. **There is no phone-number vertex to fetch** (verified — see Assumptions Log A1).

### Anti-Patterns to Avoid
- **Reactive/mid-loop pairing resolution without capacity bookkeeping:** Naively assigning a pairing partner without checking whether the role's configured count for that date is already exhausted will either silently overflow every role uncontrolled or silently drop assignments. Track per-role-per-date "slots filled so far" explicitly and treat pairing insertions as consuming that count first, overflowing only when necessary.
- **Storing blackout/pairing data merged into the standing person document:** This would force wiping blackout data on every new quarter to touch the same document leader-editable roster fields (roles, frequency), risking accidental overwrites of standing data during a quarter-reset operation. Keep quarter-scoped fields (blackouts, pairings) in a separate per-quarter subcollection.
- **Random tie-breaking in the scheduler:** Any use of `Math.random()` for tie-breaks makes the scheduler non-deterministic and untestable (repeated regeneration would silently reshuffle equally-eligible people). Always use a deterministic secondary sort key (e.g., current servedCount, then name).
- **Treating PC "Blockout"/"BlockoutDate" resources as this phase's blackout source:** PC Services v2 does have its own Blockout/BlockoutDate/BlockoutException vertices — D-14 explicitly excludes importing these. Do not wire `fetchAllPeople` to also pull blockouts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing / quoting / multi-value cells | A custom string-splitting parser | PapaParse (already installed) | Already handles quoting, embedded commas, and header mapping reliably; the app's existing song CSV import proves it handles the messy-real-world-export case |
| Cryptographically random share token | `Math.random()`-based ID | `crypto.getRandomValues` (already used in `createShareToken`) | Copy the exact existing snippet — don't reinvent |
| Date-range expansion for blackouts | Custom loop with manual date-string math and off-by-one risk | `Date` arithmetic on already-parsed `YYYY-MM-DD` strings, iterating only over the **generated Sunday list** (not every calendar day) — see Code Examples | Iterating the finite Sunday list (≤14 per quarter) avoids leap-year/month-boundary bugs that a raw day-by-day date range walker risks |
| Weighted fair scheduling / round robin | An external "fair scheduling" npm package | Deficit-based greedy fill (see Architecture Patterns) | The problem is small-scale (dozens of people, ~13 dates) and fully expressible as one scoring function; a generic package would add indirection with no benefit at this scale |

**Key insight:** Every piece of this phase's infrastructure (CSV parsing, org-scoped stores, soft-delete, share links, PC pagination) already has a working, tested reference implementation in this exact codebase. The only truly novel logic is the scheduler's scoring/propagation rules — everything else is "copy the pattern, change the shape."

## Common Pitfalls

### Pitfall 1: Treating role-count template as a hard cap during pairing propagation
**What goes wrong:** A pairing partner cannot be added to their eligible role because the role's default count for that date is "already full," so the pairing silently breaks.
**Why it happens:** Confusing the role-count template (a *planning default*, explicitly "overridable per date" per D-02) with a hard capacity constraint. Only blackout dates and pairings are hard constraints per D-07.
**How to avoid:** Let pairing-driven assignments overflow the configured count for that role/date as a fallback (D-04 already establishes multi-person-per-role is normal); never leave a pairing partner unscheduled solely due to a soft count limit.
**Warning signs:** Pairing test cases fail intermittently depending on which role gets processed first in a given date.

### Pitfall 2: Global (whole-quarter) fill order instead of chronological per-date fill
**What goes wrong:** If the algorithm iterates "for each role, fill all 13 dates" rather than "for each date, fill all roles," the deficit math (`expected = dateIndex / N`) becomes meaningless because `dateIndex` no longer represents "how many opportunities have passed" consistently across roles.
**Why it happens:** It's tempting to batch by role for simpler code, but the fairness model is inherently sequential-in-time.
**How to avoid:** Outer loop = dates (ascending), inner loop = roles (stable configured order), innermost = slot instances within a role's count.
**Warning signs:** A person with N=1 (weekly) isn't picked every week even when eligible and needed.

### Pitfall 3: Confusing "standing" vs "per-quarter" fields per D-18/D-19
**What goes wrong:** Storing `frequencyTargetN` and `roles` on the per-quarter document (so they reset/disappear each new quarter) breaks D-18's explicit "persist... carried forward" requirement; conversely, storing blackout dates on the standing person document breaks D-18's "reset each new quarter" requirement.
**Why it happens:** D-15's CSV column list (Roles, Frequency, Blackout Dates, Serve-With) makes all four look like "quarter data" since they're all imported via the same quarterly CSV — but D-18 explicitly splits Roles+Frequency (standing) from Blackout (quarter-scoped). D-19 additionally lists "frequency" as something re-import "overwrites," which is really describing an upsert onto the standing person record, not a quarter-scoped field.
**How to avoid:** Person doc holds `roles` + `frequencyTargetN` (upserted by CSV import, just like `upsertSongs` upserts standing song fields). A separate `personQuarterData` doc/subcollection entry holds `blackoutDates` and `pairedWith`, fully replaced (not merged) per D-19 for any person present in a re-imported CSV.
**Warning signs:** A leader imports a corrective CSV mid-quarter and either loses previously-set frequency targets for untouched people, or the new quarter silently inherits last quarter's blackout dates.

### Pitfall 4: Case-sensitive or whitespace-sensitive name matching for CSV rows
**What goes wrong:** "Sarah Smith" in the CSV fails to match "sarah  smith" (double space) or "Sarah Smith " (trailing space) in the roster, creating a false "new person" or false "unmatched" row.
**Why it happens:** Planners hand-type or copy-paste names from email replies; formatting is inconsistent.
**How to avoid:** Normalize both sides (trim, collapse internal whitespace, lowercase) before comparing, exactly as `upsertSongs`/`classifySongs` normalize titles (`.toLowerCase()`) for matching. Still surface **any** non-exact-after-normalization case in the import preview per D-16 (don't silently fuzzy-match beyond whitespace/case).
**Warning signs:** Duplicate roster entries appearing after a CSV import that "should" have matched existing people.

### Pitfall 5: Assuming PC Services v2 exposes phone numbers
**What goes wrong:** Building `fetchAllPeople` to request a `phone_numbers` include or nested endpoint that doesn't exist, causing a 404 or silently-empty phone field with no clear signal why.
**Why it happens:** The general "Planning Center People" product does track phone numbers, and D-14/canonical_refs describe importing "name, email, phone" — but that's the **People v2** app, not **Services v2** (this phase is scoped to Services v2 per the canonical refs).
**How to avoid:** Confirm with the user (flagged in Assumptions Log) that phone will be entered/edited manually in-app for each roster person, OR descope "phone" from the PC import and keep it as an app-only editable field.
**Warning signs:** Empty phone fields for every imported person with no import error surfaced.

## Code Examples

### Quarter date generation (D-01)
```typescript
// Source: pattern — pure date-math, no external library needed
export function generateSundaysInQuarter(year: number, quarter: 1 | 2 | 3 | 4): string[] {
  const startMonth = (quarter - 1) * 3 // 0, 3, 6, 9
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, startMonth + 3, 0) // last day of the quarter
  const sundays: string[] = []
  const d = new Date(start)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)) // advance to first Sunday
  while (d <= end) {
    sundays.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )
    d.setDate(d.getDate() + 7)
  }
  return sundays
}
```

### Blackout range expansion against the generated Sunday list (D-17)
```typescript
// Source: pattern — expand ranges only against known service dates, not raw calendar days
export function expandBlackoutCell(cell: string, serviceDates: string[]): string[] {
  // cell e.g. "2026-07-05; 2026-08-16..2026-08-30"
  const parts = cell.split(';').map((p) => p.trim()).filter(Boolean)
  const result = new Set<string>()
  for (const part of parts) {
    if (part.includes('..')) {
      const [start, end] = part.split('..').map((s) => s.trim())
      for (const date of serviceDates) {
        if (date >= start! && date <= end!) result.add(date)
      }
    } else if (serviceDates.includes(part)) {
      result.add(part)
    }
    // dates outside serviceDates are silently ignored (no matching Sunday) — surface as an
    // import warning per row, not a hard failure
  }
  return Array.from(result)
}
```
String comparison works directly here because dates are zero-padded `YYYY-MM-DD` (lexicographic order == chronological order).

### The scheduler core (concrete algorithm — D-06 through D-12)
```typescript
// Source: pattern — proposed design for src/utils/scheduler.ts
interface Person {
  id: string
  name: string
  active: boolean
  roles: string[]           // role IDs this person can fill
  frequencyTargetN: number  // 1 = weekly, 2 = every other week, 4 = ~monthly, etc.
}
interface RoleSlotConfig { roleId: string; count: number }
interface PersonQuarterData {
  personId: string
  blackoutDates: string[]     // expanded YYYY-MM-DD list
  pairedWith: string[]        // other person IDs (bidirectional)
}

export function proposeQuarterSchedule(
  people: Person[],
  serviceDates: string[],                       // ascending, e.g. quarter.serviceDates
  resolveRolesForDate: (date: string) => RoleSlotConfig[], // template + per-date overrides, roles in stable order
  personQuarterData: PersonQuarterData[],
  existingCalendar?: Record<string, Record<string, string[]>>, // for "fill gaps" mode — locked/pre-existing assignments
) {
  const pqdById = new Map(personQuarterData.map((p) => [p.personId, p]))
  const isBlackedOut = (personId: string, date: string) =>
    pqdById.get(personId)?.blackoutDates.includes(date) ?? false
  const partnersOf = (personId: string) => pqdById.get(personId)?.pairedWith ?? []

  const served = new Map<string, number>(people.map((p) => [p.id, 0])) // deficit tracking
  const calendar: Record<string, Record<string, string[]>> = {}
  const unfilled: Array<{ date: string; roleId: string }> = []
  const pairingConflicts: Array<{ date: string; personId: string; partnerId: string; reason: string }> = []

  // Seed with existing (locked) assignments in "fill gaps" mode so servedCount/deficit accounts for them
  if (existingCalendar) {
    for (const date of serviceDates) {
      calendar[date] = { ...(existingCalendar[date] ?? {}) }
      for (const ids of Object.values(calendar[date])) {
        for (const id of ids) served.set(id, (served.get(id) ?? 0) + 1)
      }
    }
  }

  serviceDates.forEach((date, dateIndex) => {
    calendar[date] ??= {}
    const rolesForDate = resolveRolesForDate(date)

    const assignToRole = (roleId: string, personId: string) => {
      calendar[date][roleId] ??= []
      if (!calendar[date][roleId].includes(personId)) {
        calendar[date][roleId].push(personId)
        served.set(personId, (served.get(personId) ?? 0) + 1)
      }
    }

    const propagatePairing = (personId: string, visited: Set<string>) => {
      for (const partnerId of partnersOf(personId)) {
        if (visited.has(partnerId)) continue
        visited.add(partnerId)
        const alreadyToday = Object.values(calendar[date]).some((ids) => ids.includes(partnerId))
        if (alreadyToday) continue
        if (isBlackedOut(partnerId, date)) {
          pairingConflicts.push({ date, personId, partnerId, reason: 'partner blacked out' })
          continue
        }
        const partner = people.find((p) => p.id === partnerId)
        if (!partner) continue
        // Own roles only (D-09) — prefer a role with remaining template capacity, else overflow first eligible role
        const eligibleRoles = rolesForDate.filter((r) => partner.roles.includes(r.roleId))
        const withCapacity = eligibleRoles.find(
          (r) => (calendar[date][r.roleId]?.length ?? 0) < r.count,
        )
        const target = withCapacity ?? eligibleRoles[0]
        if (!target) {
          pairingConflicts.push({ date, personId, partnerId, reason: 'no eligible role for partner today' })
          continue
        }
        assignToRole(target.roleId, partnerId)
        propagatePairing(partnerId, visited) // handle chained pairings (e.g. two kids, one parent)
      }
    }

    for (const { roleId, count } of rolesForDate) {
      calendar[date][roleId] ??= []
      while (calendar[date][roleId].length < count) {
        const alreadyInRole = new Set(calendar[date][roleId])
        const candidates = people.filter(
          (p) => p.active && p.roles.includes(roleId) && !isBlackedOut(p.id, date) && !alreadyInRole.has(p.id),
        )
        if (candidates.length === 0) {
          unfilled.push({ date, roleId })
          break // stop trying to fill this role's remaining slots for this date
        }
        const scored = candidates
          .map((p) => ({
            p,
            deficit: (dateIndex + 1) / p.frequencyTargetN - (served.get(p.id) ?? 0),
          }))
          .sort(
            (a, b) =>
              b.deficit - a.deficit ||
              (served.get(a.p.id) ?? 0) - (served.get(b.p.id) ?? 0) ||
              a.p.name.localeCompare(b.p.name), // deterministic final tie-break
          )
        const chosen = scored[0]!.p
        assignToRole(roleId, chosen.id)
        propagatePairing(chosen.id, new Set([chosen.id]))
      }
    }
  })

  return { calendar, servedCounts: Object.fromEntries(served), unfilled, pairingConflicts }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| n/a — this is a new capability, no prior WorshipPlanner scheduling code exists | Deterministic greedy/scored fill (this research) | This phase | Establishes the first version of this capability; no legacy behavior to preserve |

**Deprecated/outdated:** None — greenfield capability.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Planning Center Services v2 has no phone-number vertex/endpoint (only `Email` exists, nested under `/services/v2/people/{id}/emails`) | Summary, Pitfall 5, Code Examples | If PC actually does expose phone somewhere in Services v2 that wasn't surfaced by the docs site, the planner would unnecessarily descope an available field. Verified against the live `api.planningcenteronline.com/docs/apps/services/versions/2018-11-01` vertex list (79 resources enumerated, no PhoneNumber/phone_numbers vertex present) — MEDIUM-HIGH confidence, but not confirmed via an authenticated live API call. |
| A2 | `roles` and `frequencyTargetN` are standing fields on the Person document (upserted by CSV import), while `blackoutDates` and `pairedWith` are quarter-scoped fields in a separate `personQuarterData` record — this is a reconciliation of apparently-conflicting D-18 ("roles + frequency persist") vs D-19 ("re-import overwrites... frequency, serve-with") | Common Pitfalls #3, Architecture Patterns, Recommended Project Structure | If the user actually intends frequency to reset/be quarter-scoped (contradicting D-18's plain reading), the data model would need a `frequencyOverride` per quarter instead of a standing field — a schema change, not just a bugfix. Recommend confirming with the user before implementation. |
| A3 | Regenerating a quarter's proposal offers two modes — "regenerate all" (wipe + rebuild) vs "fill gaps" (existing/manual assignments locked, only empty slots filled) — since CONTEXT.md does not explicitly decide this interaction | Pattern 1, Code Examples (`existingCalendar` param), Validation Architecture | If the user only wants one mode (most likely "fill gaps" only, given D-22/D-23 frame manual editing as central), building both adds unnecessary UI/complexity; if only "regenerate all" is wanted, manual edits could be unexpectedly destroyed on a re-run. Flag for `/gsd:discuss-phase` amendment or explicit planner decision. |
| A4 | Pairing propagation is allowed to overflow a role's configured per-date count as a last resort (rather than leaving the pairing unhonored) | Architecture Patterns, Pitfall 1, Code Examples | If the intended behavior is instead "flag a pairing conflict and leave the role at its configured count," the UI needs a distinct "pairing overflow" indicator changed to a "pairing conflict, not auto-resolved" indicator — a UX/data shape change, not just logic. |
| A5 | Groups (Band / Tech / Other) are a fixed 3-way enum; only role *names* within groups (and default counts) are leader-editable, not the groups themselves | Recommended Project Structure (Role type) | If leaders need to add/rename entire groups (not just roles), the `Role.group` field needs to become a reference to an editable `Group` collection instead of a string enum — a modest schema expansion. |
| A6 | PC's paginated `/services/v2/people` response follows the same `links.next` cursor-pagination JSON:API shape already proven working for `/services/v2/songs` in this codebase | Architecture Patterns Pattern 3 | Low risk — both endpoints are part of the same JSON:API-based Services v2 app; if pagination differs (e.g. requires `offset` instead), `fetchAllPeople` needs a one-line change from `links.next` to an `offset` increment loop (the docs site also independently listed `per_page`/`offset` as valid params, so an offset-based fallback is a trivial adjustment either way). |

**If this table is empty:** N/A — see entries above.

## Open Questions

1. **Does "frequency target" reset or carry forward across quarters, and is it truly editable via CSV each quarter or only in-app?**
   - What we know: D-18 says roles+frequency are "standing data, set once, carried forward"; D-19 says CSV re-import "overwrites... frequency."
   - What's unclear: Whether the CSV is merely a convenience upsert path for a standing field (assumption A2, recommended) or whether frequency is secretly meant to be quarter-scoped like blackouts.
   - Recommendation: Confirm with the user before finalizing the Firestore schema; the reconciliation in A2 is implementable either way but the schema differs.

2. **What happens when a pairing partner has zero eligible roles active for a given date (e.g., a date override removed the only role they can fill)?**
   - What we know: D-09/D-07 establish pairing as hard, D-10 establishes unfillable-slot flagging as the pattern for "can't be honored."
   - What's unclear: Whether a pairing-can't-be-honored case should surface identically to an "Unfilled" role slot, or as a visually distinct "Pairing broken" flag (recommended, since the *cause* — and the fix — differs: an unfilled slot needs a new candidate, a broken pairing needs the leader to manually place the pinned partner or adjust that date's roles).
   - Recommendation: Model as a separate `pairingConflicts` array (as designed above) so the grid UI (D-23) can render a distinct visual treatment.

3. **Should the "furthest below target" deficit computation reset to 0 at the start of every quarter, or carry a running history across quarters?**
   - What we know: D-18 only discusses blackout dates resetting per quarter; nothing in the decisions addresses cross-quarter fairness history.
   - What's unclear: A person who served heavily last quarter and is "ahead" going into a new quarter — should that carry forward, or does every quarter start fair/fresh?
   - Recommendation: Reset to 0 each quarter (simplest, no extra history-tracking infrastructure, and self-consistent within a single quarter's ~13 dates) — flag as the default the planner should implement unless the user says otherwise.

4. **Is "role" grouping (Band/Tech/Other) itself editable, or only the roles within fixed groups?**
   - What we know: D-03 lists three named groups with defaults and says "the role list is editable... add/rename/remove."
   - What's unclear: Whether "the role list" refers only to individual roles or also to the enclosing groups.
   - Recommendation: Ship with a fixed 3-group enum (per assumption A5) unless the user clarifies during `/gsd:discuss-phase` follow-up or plan review that groups themselves must be creatable.

## Environment Availability

No new external dependencies are introduced by this phase — Planning Center API access (Basic Auth over HTTPS via the existing `/api/planningcenter` Vite dev proxy / Firebase Hosting rewrite), Firebase/Firestore, and PapaParse are all already configured and exercised by Phase 8/9. Skipping a formal probe table since every dependency is already verified working in the existing codebase (`planningCenterApi.ts`, `firebase.ts`, `csvImport.ts`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (already configured in `vite.config.ts`, `environment: 'jsdom'`) |
| Config file | `vite.config.ts` (unit tests), `vitest.rules.config.ts` (Firestore rules tests) |
| Quick run command | `npx vitest run src/utils/__tests__/scheduler.test.ts` |
| Full suite command | `npm run test:unit` |

### Phase Requirements → Test Map
| Req ID (D-#) | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-07 (blackout) | Person is never assigned on a blacked-out date, slot left unfilled instead | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "blackout"` | ❌ Wave 0 |
| D-09 (pairing) | Paired person is scheduled same date, own eligible role, when partner is chosen | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "pairing"` | ❌ Wave 0 |
| D-09 (pairing + blackout conflict) | Partner blackout on the paired date yields a flagged conflict, not a violated blackout | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "pairing conflict"` | ❌ Wave 0 |
| D-04 (multi-person/multi-role) | Role fills up to configured count with distinct people; one person can hold 2+ roles same date | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "multi"` | ❌ Wave 0 |
| D-06/D-08/D-11 (frequency + tie-break) | Furthest-below-target candidate chosen; deterministic secondary tie-break | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "deficit"` | ❌ Wave 0 |
| D-10 (unfillable) | Zero-candidate slot left empty and flagged, never over-scheduled to compensate | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "unfilled"` | ❌ Wave 0 |
| D-12 (no back-to-back rule) | Weekly-target (N=1) person legitimately picked on consecutive dates when needed | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "consecutive"` | ❌ Wave 0 |
| D-02 (date role overrides) | Per-date role-count override honored over default template | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts -t "override"` | ❌ Wave 0 |
| D-17 (blackout ranges) | Range cell expands to exactly the Sundays within `[start,end]` | unit | `npx vitest run src/utils/__tests__/volunteerCsv.test.ts -t "range"` | ❌ Wave 0 |
| D-16 (name matching + preview) | Ambiguous/unmatched rows surfaced, not silently created/guessed | unit | `npx vitest run src/utils/__tests__/volunteerCsv.test.ts -t "matching"` | ❌ Wave 0 |
| D-19 (per-person replace) | Re-import overwrites only CSV-present people's quarter data; others untouched | unit | `npx vitest run src/stores/__tests__/quarters.test.ts -t "replace"` | ❌ Wave 0 |
| D-20 (soft-delete) | Inactive person excluded from scheduler candidates and pickers, reactivatable | unit | `npx vitest run src/stores/__tests__/roster.test.ts -t "active"` | ❌ Wave 0 |
| D-01 (Sunday generation) | Every Sunday in chosen quarter generated; manual add/remove respected | unit | `npx vitest run src/utils/__tests__/quarterDates.test.ts` | ❌ Wave 0 |
| D-24 (share link / RBAC) | Public share route renders read-only snapshot; Firestore rule allows public read of `shareTokens/{token}` only | rules + smoke | `npm run test:rules` | ✅ (existing `shareTokens` rule already covers new token doc shape) |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed-test-file>`
- **Per wave merge:** `npm run test:unit` (full suite) + `npm run type-check`
- **Phase gate:** Full suite green + `npm run test:rules` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/__tests__/scheduler.test.ts` — covers D-04, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-02
- [ ] `src/utils/__tests__/quarterDates.test.ts` — covers D-01
- [ ] `src/utils/__tests__/volunteerCsv.test.ts` — covers D-16, D-17
- [ ] `src/stores/__tests__/roster.test.ts` — covers D-13, D-14, D-20 (mirror `songs.test.ts` structure for subscribe/upsert/soft-delete)
- [ ] `src/stores/__tests__/quarters.test.ts` — covers D-19, D-22 (mirror `services.test.ts` structure)
- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — extend existing file with `fetchAllPeople` pagination test (mirror `fetchAllPcSongs` tests in `pcSongImport.test.ts`)
- Framework install: none — Vitest already fully configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (new) | Reuses existing Firebase Auth (Google OAuth / email-password) — no new auth surface |
| V3 Session Management | no (new) | Reuses existing Firebase session handling |
| V4 Access Control | yes | Firestore rules — existing catch-all `match /{collection}/{docId} { allow read, write: if isOrgEditor(orgId); }` under `organizations/{orgId}` already covers new `people`, `roles`, `quarters` collections. Confirm roster read access should be editor-only (mirrors the `songs` rule, which is stricter than `services`' viewer-read/editor-write) — **recommend roster + quarters mirror `songs`' editor-only pattern** since roster data (names, emails) is more sensitive than service plans, and this phase has no explicit "viewer" use case called out in CONTEXT.md. |
| V5 Input Validation | yes | CSV cell parsing (PapaParse) + name-matching must reject/flag malformed rows rather than crash or silently corrupt roster data (see D-16 preview requirement) |
| V6 Cryptography | yes (share token only) | Reuse `crypto.getRandomValues`-based 36-hex-char token exactly as `createShareToken` does — never hand-roll a weaker token generator (e.g. `Math.random()`) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Public share link (`shareTokens/{token}`) guessing/enumeration | Information Disclosure | Token is a 144-bit cryptographically random hex string (18 random bytes) — same entropy already accepted for service-plan shares; Firestore rule already restricts `create` to signed-in editors and `update`/`delete` to `false`, preventing tampering |
| PII exposure of volunteer roster (names, emails, phone) to viewer-role members or via an overly-broad Firestore rule | Information Disclosure | Recommend scoping `people` and `quarters` collections to editor-only read/write (see V4 above) rather than inheriting the more permissive `services` viewer-read rule, since roster PII has no clear "viewer" use case in this phase's decisions |
| CSV injection (a cell like `=HYPERLINK(...)` opened later in Excel by the leader) | Tampering | Not a WorshipPlanner-side risk for *importing* CSVs (PapaParse parses as data, not formulas) — only relevant if the app ever re-exports a CSV for opening in Excel; no such export exists in this phase's scope, so no mitigation needed now, but flag if a future CSV-template-download feature is added |
| Planning Center credential leakage via a new people-import path | Information Disclosure | Reuses the existing `pcAppId`/`pcSecret` credential storage and masked-after-save UI from Phase 8 — no new credential handling code, so no new risk surface |

## Sources

### Primary (HIGH confidence)
- `src/utils/planningCenterApi.ts` (this repo) — existing PC Services v2 client, Basic Auth pattern, `/api/planningcenter` proxy usage
- `src/utils/pcSongImport.ts` (this repo) — `fetchAllPcSongs` pagination-via-`links.next` pattern, batched-per-3 rate-limit handling
- `src/stores/songs.ts` (this repo) — `upsertSongs`, `deleteSong`/`restoreSong` soft-delete pattern, `onSnapshot` subscribe pattern
- `src/utils/suggestions.ts` (this repo) — pure-function, injectable-input, sort-by-score pattern (direct template for the scheduler)
- `src/stores/services.ts` (this repo) — `createShareToken` pattern
- `src/views/ShareView.vue`, `src/components/ServicePrintLayout.vue` (this repo) — public share view + print layout patterns
- `firestore.rules` (this repo) — confirmed catch-all `organizations/{orgId}/{collection}/{docId}` editor-only rule already covers new collections without a rules change
- `package.json` (this repo) — confirmed PapaParse ^5.5.3 installed, no new dependencies needed
- https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/person — Person resource attributes, `/services/v2/people` endpoint, pagination params
- https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01/vertices/email — Email resource + nested `/services/v2/people/{id}/emails` endpoint
- https://api.planningcenteronline.com/docs/apps/services/versions/2018-11-01 — full 79-vertex list confirming no PhoneNumber resource exists in Services v2

### Secondary (MEDIUM confidence)
- `npm view papaparse version` → 5.5.4 latest, project's `^5.5.3` satisfies range

### Tertiary (LOW confidence)
- None used as a basis for recommendations — all PC API claims were cross-checked against the live docs site directly (WebFetch), not left at WebSearch-summary level.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all reused libraries already proven in this exact codebase
- Architecture (data model + scheduler design): MEDIUM-HIGH — scheduler algorithm is a novel design (not lifted from an external source) but follows an already-proven in-repo pattern (`suggestions.ts`); data model requires a documented interpretation of D-15/D-18/D-19 (see A2)
- Pitfalls: HIGH — derived directly from the mechanics of the proposed algorithm and directly analogous bugs already fixed in this codebase (e.g. name-matching whitespace/case, per-person CSV replace)
- PC people-endpoint shape: MEDIUM — verified via PC's live docs site (not a stale training-data guess), but not confirmed via an authenticated live API call in this session

**Research date:** 2026-07-06
**Valid until:** 30 days (stable internal codebase patterns + a third-party API whose v2018-11-01 version is long-stable); re-verify the PC people/email endpoint shape if PC ships a new Services API version before implementation begins
