# Schedule-Page UX Redesign — Research Note (R-09)

**Status:** Decision record. Formalizes RESEARCH.md Pattern 5's evaluation for Phase 16.
**Scope:** `src/views/QuarterView.vue` (Schedule page) and its child components
(`QuarterGrid.vue`, plus the new `AddQuarterModal`/`CollapsibleSection.vue`).
**Decides:** R-09 (layout direction, D-11), R-10 (add-quarter flow, D-13), R-11
(collapsible sections). Downstream plans 16-06 (Volunteer/Roster) and 16-08 (Schedule)
implement this recommendation — they do not re-litigate it.

## Options Evaluated

### Option A — Evolve the existing dark card-stack (RECOMMENDED)

Keep `QuarterView.vue`'s current structure — a vertical stack of cards (quarter
selector, Volunteer Availability, Service dates, Generate controls, then the
always-visible `QuarterGrid` matrix) — but declutter it: wrap the setup cards in a
collapsible affordance and separate the "select a quarter" action from the "create a
new quarter" action.

**Evidence for this option:**

1. `QuarterGrid` — the page's actual data-entry surface — is *already* a roles×dates
   matrix. A "calendar/matrix-centric redesign" would be, structurally, already halfway
   accomplished by the existing component; there is no separate "calendar view" left to
   build. D-12 independently resolves to keeping the current date-grouped grid shape
   (no reorientation), which removes the main argument for a wholesale layout swap.
2. R-11's own existence (collapsible sections) is direct evidence for the intended
   direction. Collapsible sections only make sense as a decluttering pass over an
   *existing stack of cards* — "keep the stack, make it collapsible + reorganize," not
   "throw the stack away for a calendar widget."
3. R-09's acceptance bar is modest: a research artifact plus a verifiable before/after
   layout diff — not a full information-architecture overhaul. A calendar-library pivot
   (new dependency, drag-and-drop, month/week navigation chrome) is disproportionate
   engineering lift for a UX-polish phase whose other requirements (R-01..R-14) are
   targeted and incremental, not a rewrite.
4. No calendar/scheduling UI library exists in `package.json` today. Introducing one
   would be the first non-trivial new runtime dependency in a phase explicitly scoped as
   internal feature/UX work — a cost with no corresponding requirement asking for it.

### Option B — Pivot to a calendar/matrix-centric single view

Replace the card-stack with a month/quarter calendar widget as the primary Schedule
surface, with setup controls (volunteer availability, service dates, generation) moved
into secondary panels, modals, or a settings-style page.

**Why not chosen:** No requirement in this phase asks for a calendar-format view of the
*Schedule (editing) page* — R-01/R-02 (matrix/list toggle) apply to the public
*share* page, not the internal editing view (D-12 keeps the editing grid as-is). A
calendar pivot would require a new dependency, new interaction patterns (drag-and-drop
reassignment, month navigation), and a much larger surface of behavior change than R-09
through R-11 call for. It also discards `QuarterGrid`, which already satisfies the
"matrix" shape R-01 wants for the share page — rebuilding it as a calendar widget would
duplicate effort without a clear user-facing gain this phase requires.

## Recommendation

**Evolve the existing card-stack (Option A).** Do not pivot to a calendar-centric
redesign of the Schedule page.

## Concrete Redesign Elements (binding on plans 16-06 / 16-08)

1. **Quarter switcher separated from Add-quarter (R-10/D-13).** Replace the current
   single card that conflates "select an existing quarter" (`<select>`) with "create a
   new quarter" (year/quarter inputs + button) into two visually distinct controls:
   - A lightweight dropdown or segmented control for *selecting* an existing quarter —
     visually primary/lightweight, always visible.
   - A clearly secondary **"+ Add quarter"** button that opens a small modal or inline
     form (year input, quarter select, create button) — visually distinct from the
     selector (e.g. outlined/ghost button vs. the selector's filled control) so the two
     actions are never conflated by the user.

2. **Collapsible setup sections (R-11/D-17).** Wrap the three existing setup cards —
   Volunteer Availability, Service dates, and Generate controls — in the shared
   `CollapsibleSection.vue` component (title + `storageKey` props, chevron affordance
   adapted from `ArrangementAccordion.vue`). Each section **defaults expanded** and
   remembers its own open/closed state per user via `localStorage`, keyed distinctly per
   section (e.g. `schedule.section.volunteerAvailability`, `schedule.section.serviceDates`,
   `schedule.section.generateControls`) to avoid key collisions.

3. **QuarterGrid stays always-visible.** The matrix itself is the primary work surface,
   not a "dense section" to hide — it is never wrapped in `CollapsibleSection` and
   remains rendered below the (now collapsible) setup cards regardless of their
   open/closed state.

4. **Roster page gets the same treatment (applies in 16-06).** `RosterView.vue`'s
   "Roles config panel" and "Inactive Volunteers" blocks (already visually separated
   sections) are wrapped in the same shared `CollapsibleSection.vue`, using
   `roster.section.*` storage keys. The main active-people table stays always visible.

## Verifiable Before/After Diff

- **Before:** one card mixing quarter-select and quarter-create controls; three
  always-expanded setup cards pushing `QuarterGrid` below the fold on small screens;
  no way to collapse setup once a quarter is generated.
- **After:** quarter switcher and "+ Add quarter" are two distinct, separately styled
  controls; the three setup cards default open but collapse individually and remember
  state across visits; `QuarterGrid` is reachable with less scrolling once sections are
  collapsed.

This note is the R-09 artifact; plans 16-06 and 16-08 implement the elements listed
above without re-deciding layout direction.
