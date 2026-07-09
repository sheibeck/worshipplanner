# Phase 16: Quarterly Schedule Share Link — matrix view, name filter, cross-screen volunteer editing & UX overhaul — Specification

**Created:** 2026-07-09
**Ambiguity score:** 0.19 (gate: ≤ 0.20)
**Requirements:** 13 locked

## Goal

Make the quarterly schedule usable for both organizers and volunteers by giving the public share link a matrix view + memorable URL + name filter, unifying volunteer availability/frequency/pairing editing across the Schedule and Volunteer screens (authenticated only), and reworking the schedule editing UX (research-then-concrete redesign, collapsible sections, whole-cell-clickable right-side slide-out group editor). The scheduler pairing fix (original R-12) is split into its own separate phase and is NOT part of Phase 16.

## Background

Current state, grounded in code:

- **Public share** (`src/views/QuarterShareView.vue`, route `/quarter-share/:token`): unauthenticated, reads a denormalized `shareTokens/{token}` snapshot (person **names** pre-resolved, no roster/auth access, no PII beyond names — D-24). Renders **list view only** (dates down, roles nested under each). No matrix, no view toggle, no name filter. URL uses an opaque 36-char hex token generated in `quarters.ts::finalizeAndShare`.
- **Schedule screen** (`src/views/QuarterView.vue`, route `/schedule`, authenticated + editor-gated): quarter create/select via a bare `<select>` + year/quarter inputs (R-10 pain point), CSV import, service-date editor, generate/regenerate/fill-gaps, `AvailabilityRosterTable` → `AvailabilityDrawer`, and `QuarterGrid`. Includes a **separate serve-frequency** surface and a **date-range picker** inside `AvailabilityDrawer.vue` (lines ~122-136) for blocking Sundays in a span (R-08 target).
- **QuarterGrid** (`src/components/QuarterGrid.vue`): a scheduled-group cell `@click` toggles an editor that **expands underneath** the row; per-person remove pills use `@click.stop`. R-13 wants the whole cell clickable; R-14 wants a right-side slide-out instead of expand-underneath.
- **Data model** (`src/types/roster.ts`): per-role frequency (`Person.roleFrequencies`, `PersonQuarterData.roleTiers`) already exists from Phase 15. `blackoutDates` is quarter-scoped on `PersonQuarterData` (reset each quarter, D-18). Org has a `name` (auth store `orgName`) but **no URL slug**.
- **Scheduler** (`src/utils/scheduler.ts`): `propagatePairing` pulls a paired partner in on every occurrence the anchor serves — the R-12 concern — but R-12 is **out of this phase** (separate phase).
- No `REQUIREMENTS.md` exists; the requirement set is the R-01..R-14 list in ROADMAP.md.

## Requirements

1. **Share-link matrix view (R-01)**: The public share page renders the schedule as a matrix (roles across the top, dates down the left) with a list/matrix toggle.
   - Current: `QuarterShareView.vue` renders list view only; no toggle
   - Target: Matrix is the **default** view; a visible toggle switches to the existing list view; matrix cells show the assigned person names per (date, role), matching the list view's data
   - Acceptance: Loading a shared link shows a roles-columns × dates-rows matrix by default; toggling shows the list; both display identical assignments for a known snapshot; a role/date with no one shows an empty/unassigned indicator

2. **Memorable share URL (R-02)**: A friendly URL `/{church-slug}/quarterN-YYYY` resolves to the shared schedule, alongside the existing opaque token URL.
   - Current: only `/quarter-share/:token` (opaque hex) exists; org has no slug
   - Target: A unique church slug is auto-derived from the org name on first share and is editable in Settings; a route `/{slug}/quarter{N}-{YYYY}` resolves to the same public snapshot; the opaque `/quarter-share/:token` route continues to work as a fallback
   - Acceptance: For an org with slug `grace` and a shared Q1 2026, visiting `/grace/quarter1-2026` shows that quarter's shared schedule; the opaque token URL still resolves; two orgs cannot hold the same slug (collision → numeric suffix); editing the slug in Settings persists it on the org doc

3. **Filter by name (R-03)**: A viewer can filter the shared schedule by a person's name; dates where that person serves no role are hidden.
   - Current: no filtering on the share page
   - Target: A name filter control on the public share page; when set, only dates where the named person is assigned to ≥1 role remain visible (both matrix and list views); the active filter is reflected in the URL query so a filtered view is bookmarkable
   - Acceptance: Filtering to a person shows only the dates they serve; clearing shows all dates; the URL updates to include the filter and reloading that URL reproduces the filtered view; filter applies in both matrix and list views

4. **Cross-screen pairing & role editing (R-04)**: Pairings and the roles a person fills are editable from both the Schedule screen and the Volunteer (roster) screen.
   - Current: role/pairing editing lives on one surface only (roster form / availability drawer); not unified across both screens
   - Target: The same pairing + role-membership editing controls are reachable from both `QuarterView` (Schedule) and `RosterView` (Volunteer), writing through the shared store — authenticated editors only
   - Acceptance: Editing a person's pairing or roles from the Schedule screen and from the Volunteer screen produce the same persisted result; a change made on one screen is reflected on the other after reload

5. **Unify serve frequency (R-05)**: Remove the Schedule screen's separate serve-frequency control; surface and edit the Phase-15 per-role frequency from both Schedule and Volunteer screens.
   - Current: the Schedule surface has its own frequency control distinct from the per-role frequency defined at the volunteer level
   - Target: The separate Schedule frequency control is removed; the per-role frequency (`roleFrequencies`/`roleTiers`) is the single source, editable from both screens
   - Acceptance: No separate/duplicate frequency control remains on the Schedule screen; per-role frequency edited from either screen writes to the same fields and is reflected on both

6. **Quarter framed as blackout dates (R-06)**: Per-quarter volunteer editing is framed as setting that quarter's blackout (unavailable) Sundays.
   - Current: availability editing exists but framing/labeling is not explicitly "blackout dates for this quarter"
   - Target: The per-quarter editing UI presents availability as choosing the Sundays the volunteer is unavailable for the selected quarter
   - Acceptance: The quarter availability editor labels/frames the control as blackout/unavailable Sundays for the active quarter; toggling a Sunday writes to that quarter's `blackoutDates`

7. **Unavailable Sundays editable from both screens (R-07)**: A volunteer's unavailable Sundays remain quarter-scoped but are editable from both the Volunteer and Schedule screens.
   - Current: blackout editing is reachable from the Schedule side only
   - Target: `blackoutDates` stays quarter-scoped on `PersonQuarterData` (no data-model change); the same blackout editor is reachable from the Volunteer/roster screen as well as the Schedule screen
   - Acceptance: A volunteer's unavailable Sundays for a quarter can be edited from the Volunteer screen and from the Schedule screen, both writing the same quarter's `blackoutDates`; no migration of blackout data to standing person-level storage occurs

8. **Remove the date-range control (R-08)**: The date-range picker on the volunteer availability editor is removed; individual Sunday toggling is the only blackout entry method.
   - Current: `AvailabilityDrawer.vue` has a date-range picker (`rangeStart`/`rangeEnd`, "Block Sundays in range") plus per-Sunday toggles
   - Target: The date-range picker is removed; per-Sunday click-to-toggle remains (≈13 Sundays/quarter makes range entry unnecessary)
   - Acceptance: No date-range start/end inputs or "Block Sundays in range" button remain in the availability editor; individual Sunday toggling still sets blackout dates

9. **Schedule-page UX research artifact, then concrete redesign (R-09)**: Produce a short UX research note evaluating the schedule-page layout (including calendar/matrix format), then implement its recommendation.
   - Current: schedule page is a stack of cards; no research artifact; calendar-format fit unevaluated
   - Target: A research note is written (in the phase directory) evaluating layout options incl. calendar/matrix format for the schedule editing page; the recommended concrete redesign is then implemented
   - Acceptance: A research artifact file exists in `.planning/phases/16-quarterly-schedule-share-link/`; the shipped schedule page reflects the redesign the note recommends (verifiable diff between before/after layout)

10. **Clearer add-quarter flow, research-then-concrete (R-10)**: Redesign selecting an existing quarter vs. adding a new one so the two actions are visually distinct.
    - Current: a bare `<select>` of quarters sits next to year/quarter inputs + a "New quarter" button, conflating selection and creation
    - Target: The redesign (informed by the R-09 research note) clearly separates "select an already-defined quarter" from "add a new quarter" as distinct actions
    - Acceptance: The Schedule screen presents selecting an existing quarter and creating a new quarter as visually distinct, non-conflated controls; creating a new quarter and selecting an existing one each still work

11. **Collapsible sections (R-11)**: Dense sections on the Schedule and Volunteer pages can be collapsed/expanded.
    - Current: sections (Volunteer Availability, Service dates, Generate controls, grid) are always fully expanded
    - Target: Dense sections on both the Schedule and Volunteer pages have a collapse/expand affordance
    - Acceptance: At least the identified dense sections on the Schedule page and the Volunteer page can be toggled collapsed and expanded; collapsed state hides the section body and shows a header/toggle

12. **Group-edit whole-cell hit target (R-13)**: The entire scheduled-group cell is clickable to open the editor, not just the pill area.
    - Current: cell `@click` toggles the editor but the interactive target is effectively the pill region; empty cell areas are less obviously clickable
    - Target: Clicking anywhere within a scheduled-group cell opens the group editor; per-person remove (x) pills retain their own `@click.stop` quick-remove
    - Acceptance: Clicking any part of a group cell (including empty space) opens the editor; clicking a person's remove (x) removes only that person without opening the editor

13. **Right-side slide-out group editor (R-14)**: The group/cell editor opens as a right-side slide-out panel instead of expanding underneath the cell.
    - Current: `QuarterGrid` expands the editor in a row underneath the clicked cell
    - Target: The group editor opens as a right-side slide-out panel (same pattern as `AvailabilityDrawer`), replacing the expand-underneath behavior entirely
    - Acceptance: Opening a cell's editor slides a panel in from the right; the old under-row expansion no longer appears; the slide-out supports the existing edit actions (add/remove/clear people for that date+role)

## Boundaries

**In scope:**
- Public share page (`QuarterShareView`): matrix view + list/matrix toggle (matrix default), name filter with URL persistence
- Memorable URL: auto-derived, Settings-editable, unique church slug; `/{slug}/quarter{N}-{YYYY}` route resolving to the public snapshot; opaque token route retained
- Cross-screen (Schedule ↔ Volunteer) editing of pairings, roles, per-role frequency, and quarter blackout Sundays — authenticated editors only
- Removal of the Schedule screen's separate serve-frequency control (unified onto Phase-15 per-role frequency)
- Removal of the date-range picker in the availability editor (keep per-Sunday toggling)
- Framing per-quarter volunteer editing as blackout/unavailable Sundays
- Collapsible dense sections on the Schedule and Volunteer pages
- Schedule-page UX research note + the concrete redesign it recommends (incl. add-quarter flow clarity)
- QuarterGrid group editor: whole-cell click target + right-side slide-out panel

**Out of scope:**
- **Scheduler pairing-honors-frequency fix (original R-12)** — split into its own separate phase; no `scheduler.ts` algorithm changes here
- **Public-link editing / volunteer self-service** — the public share link stays strictly read-only; no volunteer login or self-edit (locked round 1)
- **Planning Center import / re-import changes** — no changes to PC people/song import flows
- **Notifications / emailing volunteers** — sharing remains link-only; no email or push
- **Moving blackout dates to standing person-level storage** — `blackoutDates` stays quarter-scoped; no data-model migration (locked round 3)

## Constraints

- The public share page must remain unauthenticated and read-only, exposing no PII beyond person names — preserve the D-24 denormalized-snapshot pattern (`shareTokens/{token}`, names pre-resolved); the matrix view and name filter must read only the snapshot, not roster/auth stores.
- The memorable URL is intentionally guessable (`/{slug}/quarter{N}-{YYYY}`) — this privacy tradeoff is accepted (locked round 2). Church slug must be unique across orgs (collision → numeric suffix).
- Reuse the Phase-15 per-role frequency model (`Person.roleFrequencies`, `PersonQuarterData.roleTiers`); do not introduce a parallel frequency representation.
- `blackoutDates` remains quarter-scoped on `PersonQuarterData` — no migration to standing/person-level data.
- Cross-screen editing writes through the existing shared stores (`roster`, `quarters`); the same edit from either screen must produce identical persisted state.

## Acceptance Criteria

- [ ] Public share page defaults to a roles-columns × dates-rows matrix view with a working toggle to the existing list view
- [ ] `/{church-slug}/quarter{N}-{YYYY}` resolves to the shared schedule; the opaque `/quarter-share/:token` route still resolves
- [ ] Church slug is auto-derived from org name, editable in Settings, unique across orgs (collision → numeric suffix), persisted on the org doc
- [ ] Name filter on the share page hides dates where the named person serves no role, works in both views, and is reflected in the URL (bookmark reproduces the filter)
- [ ] Pairings and role membership are editable from both the Schedule screen and the Volunteer screen, with identical persisted results
- [ ] The Schedule screen's separate serve-frequency control is removed; per-role frequency is edited from both screens against the same fields
- [ ] Quarter availability editing is framed/labeled as blackout (unavailable) Sundays for the active quarter
- [ ] A quarter's blackout Sundays are editable from both the Volunteer and Schedule screens; no blackout data-model migration occurs
- [ ] The date-range picker is removed from the availability editor; per-Sunday toggling still works
- [ ] A UX research artifact exists in the phase directory; the shipped schedule-page redesign (incl. distinct select-vs-add-quarter controls) reflects it
- [ ] Dense sections on the Schedule and Volunteer pages can be collapsed and expanded
- [ ] Clicking anywhere in a group cell opens the editor; a person's remove (x) removes only that person without opening the editor
- [ ] The group editor opens as a right-side slide-out panel; the expand-underneath behavior is gone
- [ ] No `scheduler.ts` algorithm changes are included (R-12 handled separately)

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                             |
|--------------------|-------|------|--------|---------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | R-12 split out; all remaining features concrete   |
| Boundary Clarity   | 0.82  | 0.70 | ✓      | Explicit out-of-scope; auth-only edit surface     |
| Constraint Clarity | 0.74  | 0.65 | ✓      | Public read-only, slug uniqueness, no migration   |
| Acceptance Criteria| 0.74  | 0.70 | ✓      | 14 pass/fail criteria                             |
| **Ambiguity**      | 0.19  | ≤0.20| ✓      | Gate passed after 3 rounds                        |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                              | Decision locked                                                        |
|-------|-----------------|-----------------------------------------------|-----------------------------------------------------------------------|
| 1     | Researcher/Scope| Is R-01..R-14 one phase or split?             | Split off scheduler fix R-12 into its own phase; rest stays           |
| 1     | Researcher      | Where does cross-screen editing live?         | Authenticated Schedule screen only; public share stays read-only      |
| 1     | Researcher      | How should the memorable URL work?            | Church slug + keep opaque token fallback (guessable URL accepted)      |
| 2     | Simplifier      | How to treat R-09/R-10 (research/'intuitive')?| Research artifact first, then implement the concrete recommendation    |
| 2     | Researcher      | Share view default + filter persistence?      | Matrix default, toggle to list, name filter persisted in URL          |
| 2     | Researcher      | How is the church slug created/managed?       | Auto-derive from org name, editable in Settings, collision-suffixed   |
| 3     | Boundary Keeper | R-07 blackout: standing or quarter-scoped?    | Quarter-scoped (no migration), editable from Volunteer screen too     |
| 3     | Boundary Keeper | R-13/R-14 cell editor design?                 | Right-side slide-out, whole cell clickable (replaces expand-underneath)|
| 3     | Boundary Keeper | What's explicitly out of scope?               | PC import changes + notifications OUT (plus R-12 & public-editing R1)  |

---

*Phase: 16-quarterly-schedule-share-link*
*Spec created: 2026-07-09*
*Next step: /gsd:discuss-phase 16 — implementation decisions (how to build what's specified above)*
