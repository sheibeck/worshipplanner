# Phase 16: Quarterly Schedule Share Link — matrix view, name filter, cross-screen volunteer editing & UX overhaul - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the quarterly schedule usable for both organizers and volunteers:
- Public share link gets a **matrix view** (roles × dates) with a list toggle, a **memorable URL** (`/{church-slug}/quarter{N}-{YYYY}`), and a **name filter** — all reading the read-only denormalized snapshot only.
- **Consolidate serve frequency** onto a single per-role, quarter-scoped model and rework the per-person editing surfaces.
- **Schedule-page UX overhaul** (research-then-concrete redesign, collapsible sections, clearer add-vs-select-quarter flow).
- **QuarterGrid group editor**: whole-cell click target + right-side slide-out panel.
- **Scheduler fix (R-12)**: must-serve-with pairing honors each person's per-role frequency.

> ⚠️ **This discussion revised two SPEC assumptions (owner decisions — see D-04 and D-10).** The frequency data model moved from *standing* to *quarter-scoped*, and the "edit from both screens" requirement (R-04/05/07) was reduced to a cleaner split. Downstream agents: the decisions below **supersede** the corresponding parts of `16-SPEC.md`.
</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**14 requirements are locked.** See `16-SPEC.md` for full requirements, boundaries, and acceptance criteria. Downstream agents MUST read `16-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Public share page (`QuarterShareView`): matrix view + list/matrix toggle (matrix default), name filter with URL persistence
- Memorable URL: auto-derived, Settings-editable, unique church slug; `/{slug}/quarter{N}-{YYYY}` route resolving to the public snapshot; opaque token route retained
- Cross-screen (Schedule ↔ Volunteer) editing of pairings, roles, per-role frequency, and quarter blackout Sundays — authenticated editors only
- Removal of the Schedule screen's separate serve-frequency control (unified onto per-role frequency)
- Removal of the date-range picker in the availability editor (keep per-Sunday toggling)
- Framing per-quarter volunteer editing as blackout/unavailable Sundays
- Collapsible dense sections on the Schedule and Volunteer pages
- Schedule-page UX research note + the concrete redesign it recommends (incl. add-quarter flow clarity)
- QuarterGrid group editor: whole-cell click target + right-side slide-out panel
- Scheduler fix (`scheduler.ts::propagatePairing`) so must-serve-with pairing honors each person's per-role frequency (R-12)

**Out of scope (from SPEC.md):**
- Public-link editing / volunteer self-service — share link stays strictly read-only
- Planning Center import / re-import changes
- Notifications / emailing volunteers
- Moving blackout dates to standing person-level storage — stays quarter-scoped, no migration

> **SPEC overrides from this discussion:** The "edit from both screens" scope for **frequency and blackout** (R-05/R-07) and **pairing** (R-04) is reduced — see D-10. Frequency's storage location changed from standing to quarter-scoped — see D-04 (softens the SPEC constraint "reuse the Phase-15 per-role frequency model" / "do not introduce a parallel frequency representation": we do not add a parallel representation, we *relocate the single representation* to be quarter-scoped).
</spec_lock>

<decisions>
## Implementation Decisions

### Pairing fix — R-12 (`scheduler.ts::propagatePairing`)
- **D-01: Containment (asymmetric) guarantee.** For a must-serve-with pair where the partners have different cadences (canonical: Nolan once/month ↔ Tim twice/month), **every date the lower-cadence partner serves must also be a date the other serves**, but the higher-cadence partner may serve extra dates alone. This matches the SPEC acceptance ("every Nolan occurrence coincides with a Tim occurrence; Tim's extras don't drag Nolan in"). NOT symmetric always-together (that would clamp Tim down to Nolan's cadence).
- **D-02: Even-spread, deficit-aligned placement.** The lower-cadence partner's limited occurrences are distributed across the quarter (not front-loaded), reusing the scheduler's existing deficit model (`(dateIndex+1)/n - servedByRole`), snapping each chosen occurrence to one of the anchor's dates. The mechanism: gate `propagatePairing` so a partner is only pulled in when doing so would **not** exceed their own per-role cadence target for that role.
- **D-03: Cadence-driven skips are silent.** When the anchor serves but the partner has already met their per-role cadence, skipping is the correct/expected outcome — do **not** add it to `pairingConflicts`. Keep `pairingConflicts` reserved for genuine problems (partner blacked out, no eligible role today, group-rule violation), exactly as the code does now.
- **D-04-note:** The R-12 fix reads the **quarter-scoped** per-role frequency (see D-04), not a standing value. Existing hard constraints (blackout, group-compatibility via `isGroupCompatible`) must remain intact — the fix layers cadence-awareness onto the current propagation, it does not remove existing checks.

### Frequency model — R-05 (data-model change, supersedes SPEC assumption)
- **D-04: Frequency is quarter-scoped + per-role — the single source of truth.** The standing `Person.roleFrequencies` / `Person.frequencyTargetN` (Phase 15 D-04) is **removed** as a live source. Per-role serve frequency now lives on the **quarter** (per person, per role). This is greenfield (feature not live) — **no migration, no carry-forward of the old standing values, losing current standing-frequency data is acceptable.**
- **D-05: One "frequency" control, Phase-14 shape.** The single per-role frequency control's values are the cadences (weekly / 2× month / monthly / …) **plus** "fill-in" and "out this quarter" — how volunteers actually phrase it. Exact storage shape on `PersonQuarterData` (merge the existing `roleTiers` enum with a per-role cadence number, vs. a single per-role structure) → **planner/researcher decides**, honoring: per-role, quarter-scoped, values include fill-in + out.
- **D-06: New-quarter seeding (per person, per role).** When a new quarter is created, default each (person, role) frequency to that person's value for that role in the **previous quarter** if it exists; otherwise **once/month (N=4)**. **Also seed pairing / "serve-with" relationships** from the previous quarter when present. Blackout Sundays do **not** carry forward (quarter-specific dates; the existing per-quarter reset stays — Phase 13 D-18).

### Editing surfaces — R-04/05/07 (scope reduction, supersedes SPEC "both screens")
- **D-07: Volunteer edit screen = roles only.** `RosterView` edit surface edits only which roles a person serves in (plus name/email/active). No frequency, no blackout, no pairing there — this removes the confusing frequency duplication.
- **D-08: All scheduling data lives on the Schedule screen's per-quarter per-person editor.** Per-role frequency (D-05), blackout Sundays, and pairing are edited from the Schedule screen against the selected quarter. Editing schemas stay **separate** between the two screens — no cross-screen unification of these three.
- **D-09: Roles are editable from BOTH screens.** To avoid flipping back to the roster mid-scheduling, the Schedule screen's per-person editor can also add/remove a person's **roles**. Roles remain standing (`Person.roles`), written through the `roster` store from either surface — identical persisted result. (This is the surviving piece of R-04's "roles from both screens".)
- **D-10: Net effect on SPEC.** R-04 pairing-cross-screen, R-05 frequency-cross-screen, and R-07 blackout-cross-screen are **descoped**; only **roles** are cross-screen. The Volunteer screen therefore needs **no quarter context** (roles are standing). Update acceptance criteria accordingly during planning.

### Schedule-page redesign — R-09/R-10
- **D-11: Layout direction is fully open — the research note decides.** No user steer on card-stack-evolution vs calendar/matrix-centric; the R-09 research artifact evaluates options (incl. calendar/matrix format) on merit and recommends, then it's implemented. Constraint: the redesign must integrate the R-11 collapsible sections.
- **D-12: Editing-grid format deferred to research.** Whether the editing assignment grid mirrors the new share-view matrix (roles × dates) or keeps the current date-grouped `QuarterGrid` shape is left to the R-09 note (weigh consistency-with-share vs editing ergonomics).
- **D-13: Add-quarter flow (R-10).** Separate "select an existing quarter" (a quarter switcher — dropdown/segmented) from "add a new quarter" (a visually distinct secondary "Add quarter" button opening a small create form/modal). Both existing behaviors (select / create) keep working.

### Share page — R-01/R-03
- **D-14: Matrix auto-falls back to list on narrow/phone screens.** Matrix (roles × dates) renders on wider screens; phones default to the existing list view; the list/matrix toggle remains available on both. (Chosen over always-matrix-with-horizontal-scroll.)
- **D-15: Name filter is a searchable dropdown/typeahead of snapshot names.** Only real names in the snapshot are selectable (no typos); the exact selected name is persisted in the URL. Applies in both matrix and list views; clearing shows all dates.
- **D-16: Both view mode and name filter persist in the URL.** A bookmarked/shared link reproduces exactly what the sender saw (view = matrix|list, plus the active name filter). Extends the SPEC's filter-in-URL requirement to also cover the view toggle.

### Smaller decisions locked by default (no further discussion needed)
- **D-17: Collapsible sections (R-11)** default to **expanded**; collapse/expand state is remembered per-user (localStorage). Applies to the identified dense sections on the Schedule and Volunteer pages.
- **D-18: Church slug stability (R-02).** The slug is auto-derived **once** on first share (lowercase, hyphenated, non-alphanumerics stripped) and stays **stable across org renames** — regenerating would break already-shared memorable URLs. Only a manual Settings edit changes it. Collision → numeric suffix (per SPEC). Editing persists on the org doc.
- **D-19: Reserved-slug guard (R-02).** The `/{slug}/quarter{N}-{YYYY}` route must not shadow existing app routes — reserve the top-level app path segments (`songs`, `roster`, `schedule`, `services`, `team`, `settings`, `login`, `share`, `quarter-share`, `public`) so a church slug cannot collide with them (reject/suffix on derive, and/or order routes so the quarter-segment pattern disambiguates). Planner: confirm the route-matching approach.

### Claude's Discretion
- Exact persistence shape for the quarter-scoped per-role frequency (D-05) — merge with `roleTiers` vs a new per-role structure on `PersonQuarterData`.
- The precise reconciliation mechanism inside `propagatePairing` (D-01/D-02) — e.g. a remaining-cadence predicate before `assignToRole`, vs a post-pass — as long as containment + even-spread + existing hard constraints hold and `scheduler.test.ts` passes.
- QuarterGrid slide-out (R-14) mobile presentation (full-width sheet vs right panel) — reuse the `AvailabilityDrawer` Teleport-to-body pattern.
- Matrix multi-person cell rendering (roles with count > 1, e.g. 2 vocals) — stacked vs comma-separated names.
- Exact "previous quarter" selection for seeding (D-06) — chronologically prior by (year, quarterNum).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's locked requirements
- `.planning/phases/16-quarterly-schedule-share-link/16-SPEC.md` — 14 locked requirements, boundaries, acceptance criteria. **MUST read before planning.** Note the SPEC overrides captured above (D-04 frequency relocation; D-10 cross-screen descope).

### Scheduler (R-12)
- `src/utils/scheduler.ts` — `proposeQuarterSchedule`; `propagatePairing` (lines ~143-184) is the fix site; `eligible()` filter + `isGroupCompatible` shared helper (must stay honored); per-role deficit model (lines ~210-233) is what D-02 reuses. Now reads quarter-scoped frequency (D-04).
- `src/utils/scheduler.test.ts` — deterministic unit tests; R-12 fix must be TDD'd here and the suite must pass (Nolan/Tim case).

### Frequency & editing model (R-04/05/07)
- `src/types/roster.ts` — `Person` (remove `roleFrequencies`/`frequencyTargetN` as standing source — D-04), `PersonQuarterData` (`roleTiers` / blackoutDates / pairedWith; per-role frequency now lands here — D-05), `Role`, `RoleGroup`, `FrequencyTier`, `DEFAULT_ROLES`.
- `src/stores/quarters.ts` — `finalizeAndShare` (lines ~324-358, snapshot writer — the share features read this shape), `setPersonAvailability`, `applyCsvToQuarter` (bidirectional pairing sync to reuse for D-06 seeding), quarter-create path (where new-quarter seeding D-06 hooks in), `updateQuarter`.
- `src/stores/roster.ts` — `upsertPeople` (roles written here from both screens — D-09), roles config, `seedDefaultRolesIfEmpty`.
- `src/views/RosterView.vue` — Volunteer edit form; **remove the per-role frequency control** (D-04/D-07), keep roles editing (D-09). No quarter context needed (D-10).
- `src/views/QuarterView.vue` — Schedule screen; hosts the per-quarter per-person editor (frequency + blackout + pairing + roles — D-08/D-09); `selectedQuarterId` is component-local (no shared store active-quarter today); add-quarter flow redesign (D-13) lives here.
- `src/components/AvailabilityDrawer.vue` — per-quarter per-person editor to extend; **remove the date-range picker** (R-08); add the single per-role frequency control + roles editing; pattern reused for the R-14 slide-out.
- `src/components/AvailabilityRosterTable.vue` — per-person availability list that opens the drawer.

### Share page & routing (R-01/02/03)
- `src/views/QuarterShareView.vue` — public share page (route `/quarter-share/:token`); add matrix view + list/matrix toggle (matrix default), name filter, URL persistence of view+filter (D-14/15/16). Reads snapshot only (names pre-resolved) — no roster/auth access (D-24 pattern).
- `src/router/index.ts` — existing routes incl. `/quarter-share/:token`; add the memorable `/{slug}/quarter{N}-{YYYY}` route with reserved-slug guard (D-18/D-19). Reserved segments: `songs`, `roster`, `schedule`, `services`, `team`, `settings`, `login`, `share`, `quarter-share`, `public`.
- Org/auth store (`orgName`, org doc) + Settings view — slug storage on the org doc, editable in Settings (D-18).

### QuarterGrid group editor (R-13/R-14)
- `src/components/QuarterGrid.vue` — whole-cell click target (R-13) + right-side slide-out group editor replacing expand-underneath (R-14); per-person remove pills keep `@click.stop`.

### Prior-phase context (foundation this phase evolves)
- `.planning/phases/15-per-role-frequency-role-categories/15-CONTEXT.md` — per-role frequency + group co-occurrence model (Phase 15). **NOTE:** D-04 here relocates the frequency storage that Phase 15 D-04 placed standing.
- `.planning/phases/14-in-app-quarterly-availability-editor/14-CONTEXT.md` — availability drawer (right-drawer variant), frequency-tier design (fill-in/out), standing-vs-quarter split.
- `.planning/phases/13-.../13-CONTEXT.md` — original roster/scheduler data-model + quarter reset (D-18).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AvailabilityDrawer.vue` (right drawer, Teleport-to-body)** — the pattern to reuse for the R-14 slide-out group editor and the home for the consolidated per-quarter editor (frequency + blackout + pairing + roles).
- **`propagatePairing` + `eligible()` + `isGroupCompatible`** (`scheduler.ts`) — the R-12 fix layers a remaining-cadence gate onto the existing propagation; existing group/blackout checks are already shared and must stay.
- **Per-role deficit model** (`(dateIndex+1)/n - servedByRole`, `scheduler.ts` ~215-229) — directly reusable for D-02 even-spread alignment.
- **`applyCsvToQuarter` bidirectional pairing sync** (`quarters.ts`) — reuse for seeding pairing into a new quarter (D-06).
- **`finalizeAndShare` snapshot** (`quarters.ts` ~324-358) — already denormalizes names + roles into `shareTokens/{token}`; the matrix + name filter read this exact shape (roles list + `calendar[date][roleId] = names[]`).

### Established Patterns
- **Standing vs quarter-scoped split (Phase 13 D-18):** roles live standing on `Person`; blackouts/pairings live per-quarter on `PersonQuarterData`. D-04 moves *frequency* into the quarter-scoped side; roles (D-09) stay standing.
- **Read-only denormalized public snapshot (D-24):** matrix + filter must read only the snapshot, never roster/auth stores — preserves the no-PII-beyond-names guarantee.
- **Deterministic, unit-tested scheduler:** pure function; new R-12 logic must be covered in `scheduler.test.ts`.
- **Component-local quarter selection:** `selectedQuarterId` is local to `QuarterView.vue`; there is no shared store active-quarter (matters only for the Schedule editor now, since the Volunteer screen needs no quarter — D-10).

### Integration Points
- New-quarter creation (`quarters` store) is where D-06 seeding (frequency + pairing from previous quarter) hooks in.
- The Schedule per-person editor writes roles → `roster` store (`upsertPeople`), and frequency/blackout/pairing → `quarters` store (`setPersonAvailability`).
- The memorable-URL route resolves to the same public snapshot the opaque token route already serves.
</code_context>

<specifics>
## Specific Ideas

- Canonical pairing case the R-12 fix must satisfy: **Nolan (once/month, must-serve-with Tim) + Tim (twice/month)** → Nolan ~once/month, every Nolan date coincides with a Tim date, Tim's extra dates don't drag Nolan in.
- User's driving concern on frequency: **"It's too confusing to have frequency on both the volunteer roster and the schedule."** → one frequency, quarter-scoped, seeded from last quarter.
- User's driving concern on roles: **"we don't want to flip back and forth if we accidentally forget to add/remove a role"** → roles editable from the Schedule screen too (D-09).
- Greenfield latitude: the frequency feature is not live — **no migration/carry-forward of old standing frequency is required**; losing that data now is fine.
</specifics>

<deferred>
## Deferred Ideas

- **Cross-screen editing of frequency / blackout / pairing** — deliberately descoped this phase (D-10); only roles are cross-screen. Revisit if organizers later want full parity between the Volunteer and Schedule editors.
- **Horizontal-scroll matrix on mobile (sticky date column)** — not chosen (D-14 auto-falls back to list on phones). Reconsider if users want the grid on phones.

### Reviewed Todos (not folded)
- `.planning/todos/pending/per-role-frequency-and-vocal-instrument-pairing.md` — this was the **Phase 15 requirement source** and is already shipped (per-role frequency + group co-occurrence, "Validated in Phase 15"). Its only leftover — pairing honoring per-role frequency — is already captured as R-12 in `16-SPEC.md`. **Not folded** (already delivered / already in this SPEC); the pending todo can be closed out separately.

*Otherwise: discussion stayed within phase scope; the two SPEC revisions (D-04, D-10) are refinements of R-05/R-04/R-07, not new capabilities.*
</deferred>

---

*Phase: 16-quarterly-schedule-share-link*
*Context gathered: 2026-07-09*
