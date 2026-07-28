# Phase 13: Volunteer Role Scheduling - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Staff worship roles across a quarter's Sundays from a managed volunteer roster and an auto-proposed, weight-balanced, manually-editable calendar.

The app: (1) maintains a roster of people who serve, seeded by importing people from Planning Center (Services); (2) ingests a per-quarter CSV of each person's blackout dates, must-serve-with pairings, roles, and serve-frequency target; (3) auto-proposes a quarterly assignment of people to role slots on each Sunday, honoring hard constraints and balancing toward each person's frequency target; (4) presents an editable dates×roles grid for manual adjustment before finalizing; (5) outputs the finished schedule as a printable roster and read-only share link.

**Explicitly NOT in this phase:** worship-leader scheduling (leaders self-assign manually — "worship leader" is not a role); sending emails / in-app availability collection (external email → CSV import only); pushing assignments back to Planning Center; multi-service-per-Sunday handling. See Deferred Ideas.

</domain>

<decisions>
## Implementation Decisions

### Service dates & role slots
- **D-01:** Service dates are auto-generated as every Sunday within a chosen quarter (e.g. Q3 2026). Special/one-off dates are added or removed by hand after generation.
- **D-02:** Each service's required role slots come from a **default role-count template** applied to every Sunday, **overridable per date** (a specific Sunday can add/drop roles or change counts, e.g. an extra vocalist or no livestream).
- **D-03:** The **role list is editable** by the worship leader — ship known defaults but allow add/rename/remove. Defaults, grouped:
  - **Band:** guitar, drums, vocals, bass
  - **Tech:** sound, livestream, projection
  - **Other:** scripture reader
- **D-04:** A single role slot can hold **multiple people** on one Sunday (e.g. several vocalists). One person can hold **multiple roles** on the same Sunday (e.g. plays an instrument and also sings).
- **D-05:** "Worship leader" is intentionally **not a schedulable role** — the leaders assign themselves manually.

### Proposal algorithm
- **D-06:** Each person has a **serve-frequency target expressed as a 1-in-N cadence** (e.g. weekly, twice a month, once a month) — applies to everyone, no special-casing.
- **D-07:** **Hard constraints (never violated):** blackout dates (never schedule a person on a date they blacked out) and pairings.
- **D-08:** **Soft constraint:** the frequency target — balanced toward, but bent when needed to fill a slot.
- **D-09:** **Pairing semantics = "same dates, own roles":** if either paired person is scheduled on a date, the other is also scheduled that date, in whatever role they can fill (kid on vocals, parent on guitar). Not the same role. (Primary use case: kids who must serve on the same dates as their serving parent.)
- **D-10:** **Unfillable slot → leave empty and flag it** (e.g. red "Unfilled"). Never fill by violating a blackout, and never silently over-schedule someone past their target to close a gap.
- **D-11:** **Tie-breaking:** when multiple people are equally eligible for a slot, pick whoever is **furthest below their frequency target** (most "owed" service relative to how often they want to serve).
- **D-12:** **No special back-to-back-week rule** — the 1-in-N target + furthest-below-target scoring naturally spaces low-frequency people out while allowing a weekly-target person to serve every week.

### Roster & imports
- **D-13:** **Two import paths, divided:** Planning Center import seeds/updates the roster; the quarterly CSV carries per-quarter constraints.
- **D-14:** **PC people import** pulls the basic person record: **name, email, phone**. It does **not** import PC's stored blockouts/availability (availability comes via the CSV). Roles are assigned in-app (or via the CSV), not derived from PC.
- **D-15:** **Quarterly CSV layout = one row per person, multi-value cells `;`-separated.** Columns: **Name, Roles, Frequency, Blackout Dates, Serve-With.** (e.g. Roles = `vocals; guitar`; Blackout Dates = `2026-07-05; 2026-08-16`.)
- **D-16:** **CSV matching is by name** (case-insensitive) — the planner builds the CSV from email replies and typically won't have emails. Show an **import preview** that flags unmatched/ambiguous rows so the user can map-to-existing-person or create-new before committing. (Reuse the Phase 9 import-preview pattern.) Serve-With values reference the partner by name.
- **D-17:** **Blackout date format:** individual dates (`2026-07-05`) and **ranges** (`2026-07-05..2026-08-02`, covering a vacation), `;`-separated. Blackout dates are matched to / expanded across the generated service Sundays. (Shorthands like "all of August" are out — see Deferred.)

### Quarter lifecycle
- **D-18:** **Roster + roles + frequency target persist** (standing data, set once, carried forward). **Blackout dates are per-quarter and reset (start empty) each new quarter**, filled by that quarter's CSV.
- **D-19:** **Same-quarter re-import = per-person replace:** for each person present in the new CSV, overwrite their quarter data (blackouts, frequency, serve-with); people **not** in the CSV are left untouched. (Lets a late reply be imported without wiping others.)
- **D-20:** **Person lifecycle = soft-delete / mark inactive** (mirrors the Phase 9 song hide/restore): inactive people drop out of proposals and pickers but their history and record persist; can be reactivated.

### Output & Planning Center relationship
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Center integration (reuse, don't rebuild)
- `src/utils/planningCenterApi.ts` — existing Services API v2 client (auth via Personal Access Token, `fetchServiceTypes`, `fetchServiceTypeTeams`, `fetchTeamPositions`, `fetchPlans`, etc.). Extend with a **people fetch** (`/services/v2/people` — name, email, phone) for the roster import.
- `.planning/phases/08-planning-center-api-export-for-published-service-plans/08-CONTEXT.md` — PC auth decisions: Personal Access Token (App ID + Secret), stored org-level in Firestore, masked after save, validated on save. Roster import reuses these credentials.

### Import + soft-delete patterns to mirror
- `src/stores/songs.ts` — Phase 9 patterns: `upsertSongs`, soft-delete (`hidden`)/`restoreSong`, re-import-safe upsert. The roster upsert, per-person CSV replace (D-19), and person soft-delete (D-20) should follow these.
- `.planning/phases/09-pc-song-import-tag-management/09-CONTEXT.md` — import-preview + soft-delete/restore design reused by D-16 and D-20.

### Project context
- `.planning/PROJECT.md` — **Note:** this phase reverses the "Musician scheduling — handled in Planning Center" out-of-scope line; the PROJECT.md scope entry should be updated during planning.
- `.planning/ROADMAP.md` §"Phase 13" — phase goal + scope (kept in sync with these decisions).

No external ADRs/specs beyond the above — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/planningCenterApi.ts`: Services API v2 client + PAT auth + Vite dev proxy (`/api/planningcenter`). Add `fetchAllPeople` (paginated, name/email/phone).
- `src/stores/songs.ts`: `upsertSongs` / soft-delete (`hidden`) / `restoreSong` — template for roster upsert, per-person CSV replace, and inactive-person handling.
- PapaParse (used for the existing song CSV import) — reuse for parsing the quarterly volunteer CSV.
- `SettingsView.vue`: existing PC credentials section (Phase 8) — no new auth UI needed for people import.
- Existing service **print** view and **read-only share link** (`ShareView.vue` / share pattern) — reuse for the schedule roster output (D-24).

### Established Patterns
- Org-level Firestore data (`organizations/{orgId}`) + `onSnapshot` Pinia stores (`src/stores/`). New roster + schedule data follows this.
- Roster people are distinct from RBAC members/app users (Phase 7) — a separate people collection; kids/volunteers don't log in.
- Import-preview + confirm pattern (Phase 9 `PcImportModal`) — reuse for CSV name-matching resolution (D-16).
- Dark-mode palette (gray-950 body, gray-900 cards, gray-800 inputs, indigo-600 primary); inline "Saved!" feedback with setTimeout.

### Integration Points
- New nav/view for the roster (people list, roles, frequency, active/inactive) and the quarterly scheduling grid.
- PC people fetch added to `planningCenterApi.ts`; consumed by a new roster store.
- CSV import UI (upload → preview name-matching → commit) built on PapaParse + the Phase 9 preview pattern.
- Router: new routes (roster, schedule/quarter grid, share view for a published quarter) with editor/viewer RBAC consistent with existing routes.

</code_context>

<specifics>
## Specific Ideas

- The dates×roles grid is the centerpiece and doubles as a **gap-filling console**: "at a glance we can see the whole schedule, find gaps, and then make it easier to contact people manually to fill the gaps" — including showing who's blacked out per date so the leader knows who NOT to try to assign (D-23).
- Kids-with-parents is the driving pairing case: paired people serve the **same dates** but in their **own roles** (D-09).
- The planner hand-builds the quarterly CSV from email replies and keys people by **name, not email** (D-16).
- Frequency is stated per person as a real-world cadence ("once a month," "twice a month," "weekly") — everyone, including leaders' non-leader roles, uses the same 1-in-N mechanism (D-06).

</specifics>

<deferred>
## Deferred Ideas

- **Push assignments to Planning Center** — assign people to PC plan positions/teams so PC sends its accept/decline notifications. Large new PC-write integration; its own phase.
- **In-app self-service availability form** — a link for volunteers to submit their own blackout dates directly (no CSV). Needs a public form + identity handling; its own phase.
- **App-drafted quarterly ask email / contact-list export** — help send the "when can't you serve" email from the app. Convenience; future.
- **Blackout shorthands** — natural phrases like "all of August" or "every 2nd Sunday" in the CSV. Deferred in favor of explicit dates + ranges (D-17) to avoid ambiguous parsing.
- **Multiple services per Sunday** (e.g. two service times needing separate staffing) — not modeled this phase; single service per Sunday assumed.
- **Per-role frequency targets** — one target per person for now, not per-role.

None of the above block this phase — discussion stayed within scope; these are genuinely separable capabilities.

</deferred>

---

*Phase: 13-volunteer-scheduling-import-servers-from-planning-center-col*
*Context gathered: 2026-07-06*
