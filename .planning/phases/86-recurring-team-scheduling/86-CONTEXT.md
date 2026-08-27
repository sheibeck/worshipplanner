# Phase 86: Recurring Team Scheduling - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Let a planner give a team a recurring **Nth-Sunday-of-the-month** pattern from a `>` slideout on the
Volunteer → Teams tab, and have a **newly created** service whose date matches auto-pre-select that
team. Requirements: R254 (configure the pattern), R255 (auto-select on matching date).

"Teams" here = the per-org configurable **service teams** (`Team = {id,name,order}` in `src/types/team.ts`,
the v2.2 `organizations/{org}/teams` subcollection + `useTeamsStore`) — NOT the roster role-groups from
Phase 85. This effectively reintroduces the v2.2-removed hard-coded ordinal-Sunday auto-select (R231) as a
**per-team, user-configurable** feature.
</domain>

<decisions>
## Implementation Decisions

### Pattern model — owner: "Only Nth Sunday of month" (Area 1)
- Support ONLY the **Nth-Sunday-of-the-month** ordinal pattern. **Drop "every N weeks"** entirely.
- **Multi-select ordinals** — a team may serve on more than one ordinal (e.g. 1st AND 3rd Sunday).
  Ordinals are 1–5 (5th Sunday exists only in some months).
- Storage: an optional `recurrence` field on the `Team` doc, e.g.
  `recurrence?: { ordinals: number[] }` (list of 1–5). Absent/empty ⇒ no recurring pattern ⇒ no
  auto-select. Keep the field optional so existing team docs (no recurrence) are untouched.
- Matching: a pure `teamMatchesDate(team, dateStr)` helper. Compute the ordinal of the service date's own
  weekday within its month generically — `ordinal = Math.ceil(dayOfMonth / 7)` on the `"YYYY-MM-DD"` date
  (a service on the 15th → 3rd occurrence; for a Sunday service that's "3rd Sunday"). Match when
  `team.recurrence?.ordinals` includes that ordinal. Parse the date in a timezone-stable way (UTC calendar
  parse, consistent with the Phase 84 `serviceDateToMillis` fix).

### Auto-select behavior — owner: "At creation only" (Area 2)
- Auto-select fires ONLY at **service creation** (`NewServiceDialog.vue`): when the user picks/changes the
  Service Date, pre-check every team whose pattern matches that date (add its `name` to `form.teams`).
- **Fully overridable** — the pre-check is a smart default; the user can uncheck any team before saving.
  Implementation nuance: track which team names were auto-added so that when the date changes again, the
  previous auto-added set is recomputed WITHOUT clobbering the user's manual check/uncheck choices.
- **Never retroactively change existing/opened services** — do NOT re-apply the pattern when opening an
  existing service (draft or locked). No change to `ServiceEditorView`'s team checkboxes beyond what
  already exists.

### Slideout UX (Area 3 — Claude's discretion, pattern fixed above)
- Add a per-row `>` chevron to `TeamsConfigPanel.vue` (Volunteer → Teams) opening a Teleported right-side
  slide-over that MIRRORS `SongSlideOver.vue`'s shell (`Teleport to="body"`, `fixed inset-y-0 right-0`,
  `translate-x-full` enter/leave transition, scrim, header with close/save). The Song table's trailing
  chevron → SongSlideOver is the exact pattern the owner referenced ("the slideout with > at the end like
  the Song table has").
- The slideout body: a multi-select of the five ordinals (1st / 2nd / 3rd / 4th / 5th Sunday) bound to
  `team.recurrence.ordinals`, plus a clear/none state; Save persists via the existing
  `teamsStore.updateTeam(id, { recurrence })`.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/team.ts` — `Team = {id,name,order}` (add optional `recurrence`), `DEFAULT_TEAMS`.
- `src/stores/teams.ts` — `useTeamsStore` (subscribe/seed/addTeam/`updateTeam(id, patch)`/deleteTeam);
  `updateTeam` already does a partial `updateDoc`, so persisting `recurrence` needs no new store method.
- `src/components/TeamsConfigPanel.vue` — the Teams tab flat-list rows (name input + Save + Delete); add
  the `>` chevron + slideout here.
- `src/components/SongSlideOver.vue` — the Teleported right-drawer shell to mirror for the recurrence
  slideout.
- `src/components/NewServiceDialog.vue` — service creation; `form.teams` (array of team NAMES),
  `form.date` (`type="date"`), renders `teamsStore.teams` checkboxes. The single place auto-select fires.
- `src/stores/services.ts` — `createService({ date, teams: string[], ... })`; `service.teams` are names.

### Established Patterns
- `service.teams` is an array of team **names** (strings), matched against `teamsStore.teams[].name`
  (see `ServiceEditorView.vue:805` `localService.teams.includes(team.name)` and NewServiceDialog).
- Date strings are `"YYYY-MM-DD"`. Parse UTC-stable (Phase 84 precedent) for ordinal computation.
- v2.2 removed the old hard-coded ordinal rule (1st Sun → Orchestra+Communion, 3rd Sun → Choir) as
  R231 — this phase brings it back as configurable-per-team.

### Integration Points
- `TeamsConfigPanel.vue` slideout ↔ `teamsStore.updateTeam` (persist recurrence).
- `NewServiceDialog.vue` date-change ↔ `teamMatchesDate` ↔ `form.teams` pre-check.
- Pure `teamMatchesDate(team, dateStr)` + `ordinalOfMonth(dateStr)` helpers (new, unit-tested).
</code_context>

<specifics>
## Specific Ideas

- Owner: "Schedule a specific team … every Nth week, or Nth Sunday of the Month … configured in the
  Volunteer → Teams tab. Add the slideout with > at the end like the Song table has." Scoped to
  Nth-Sunday-of-month only, auto-select at creation only.
- Keep the auto-select a smart default the planner can override — not a lock (mirrors the removed
  ordinal rule's UX, now configurable).
</specifics>

<deferred>
## Deferred Ideas

- "Every N weeks" / bi-weekly recurrence — owner dropped it; only Nth-Sunday-of-month this phase.
- Arbitrary specific-date scheduling — already deferred at milestone scoping (REQUIREMENTS.md R-FUT).
- Re-applying the pattern when opening/editing an existing service — out of scope; auto-select is
  creation-only and never retroactive.
- Auto-assigning individual volunteers via the pattern — R254/R255 select the TEAM only.
</deferred>
