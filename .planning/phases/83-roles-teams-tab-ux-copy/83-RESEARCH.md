# Phase 83: Roles/Teams Tab UX & Copy - Research

**Researched:** 2026-08-24
**Domain:** Vue 3 SFC UI polish (layout width, button restyle, static copy) — no backend/store changes
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### R244 — constrain Roles/Teams tab width
- The Roles and Teams tabs render `RolesConfigPanel.vue` and `TeamsConfigPanel.vue` inside `RosterView.vue`.
  Constrain their content width to match the admin section's convention (SettingsView.vue uses
  `max-w-4xl` on its page container; the OrganizationsTab admin cards are similarly constrained) so the
  row inputs no longer stretch full-width. Apply a max-width wrapper to these two panels/tabs (mirror the
  admin/Settings constraint), NOT the whole RosterView (the Volunteers matrix legitimately uses full width).

#### R245 — save/delete UX follows an existing pattern (real Delete button)
- Today both panels use an inline text-link Delete + an inline confirm block. Per the owner: **at minimum
  turn Delete into a real button** consistent with an existing save/delete surface. The canonical in-app
  pattern to mirror is the Planning-Center-credentials block in `SettingsView.vue` (an "Edit Credentials"
  `bg-gray-800` button + a "Clear Credentials" `bg-red-900/20 text-red-400` button). Convert the Roles/Teams
  Delete affordance to a real button in that destructive-button style, keeping the existing inline
  confirm-before-delete (soft-warn) behavior. A three-dot menu / `>`-into-slideout was offered by the owner as
  an OPTION, not a requirement — do NOT do the larger slideout redesign this phase; the real-button minimum
  satisfies R245. Keep the Save button style consistent with the same surface.
- Apply the SAME treatment to BOTH `RolesConfigPanel.vue` and `TeamsConfigPanel.vue` so the two tabs stay
  consistent (TeamsConfigPanel was intentionally built to mirror RolesConfigPanel in Phase 79).

#### R246 — correct the "soft planning target" copy
- `RolesConfigPanel.vue:6` reads: "Schedulable roles grouped by Band, Tech, and Other. Default count is a
  soft planning target, not a hard cap." The owner reports scheduling **hard-targets** this count and is fine
  with that behavior — only the copy must be accurate. RESEARCH must confirm exactly how the scheduler uses
  the per-role default count (how many volunteers it assigns per service) and reword the sentence to describe
  that truthfully (e.g. "Default count is the number of volunteers scheduled for this role each service.").
  Do not change scheduler behavior — copy only.

#### Deploy discipline
- Client-only (layout + button markup + copy). No rules/functions/deploy.

### Claude's Discretion
- The exact max-width token for R244 (match whatever the admin/Settings section uses); the precise button
  markup, as long as it mirrors the existing destructive-button pattern; the exact reworded R246 sentence,
  as long as it accurately reflects the scheduler's real use of the count (confirmed by research below).

### Deferred Ideas (OUT OF SCOPE)
- The full three-dot-menu / `>`-into-slideout redesign of the Roles/Teams editors (owner-offered option, not
  required this phase) — a possible future UX pass.
- Any change to the scheduler's actual targeting behavior (owner accepts current behavior; copy-only fix).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R244 | Roles/Teams tabs constrain their input/content width like the admin section, instead of stretching full-width | Confirmed `max-w-4xl` is SettingsView's exact width token (SettingsView.vue:3); confirmed where to apply the wrapper in RosterView.vue without touching the Volunteers matrix |
| R245 | Roles/Teams Delete becomes a real button matching an existing destructive-button pattern, keeping the inline soft-warn confirm | Confirmed exact markup of SettingsView.vue's "Clear Credentials" button (`bg-red-900/20 hover:bg-red-900/40 text-red-400`) and both panels' current inline Delete text-link + confirm block to convert |
| R246 | Schedulable-roles copy accurately describes the scheduler's actual per-role-count behavior | Traced `defaultCount` end-to-end through `quarters.ts` → `scheduler.ts`'s fill loop and `QuarterGrid.vue`'s unfilled-cell flag — confirmed it IS the auto-scheduler's per-role fill target |
</phase_requirements>

## Summary

This is a pure client-side UI-polish phase touching exactly three files — `RolesConfigPanel.vue`,
`TeamsConfigPanel.vue`, and (for the width wrapper) `RosterView.vue` — plus one comment/type-doc note that is
technically out of scope but worth flagging. There is no backend, store, or scheduler-behavior change; R246 is
copy-only, confirmed by tracing the real code path.

**R244:** `SettingsView.vue`'s page container is `<div class="px-6 py-8 max-w-4xl">` (SettingsView.vue:3) — the
single, unambiguous width token to mirror. `RosterView.vue`'s Roles/Teams tab-panel wrappers
(`<div v-show="activeTab === 'roles'">` / `<div v-show="activeTab === 'teams'">`, RosterView.vue:244-251) are the
correct injection point: adding `max-w-4xl` there constrains both panels without touching the sibling
`v-show="activeTab === 'volunteers'"` block, which must keep its current full-width table.

**R245:** The two panels' current Delete affordance is already a `<button type="button">` element styled as a
text link (`class="text-xs text-red-400 hover:text-red-300 transition-colors"`, RolesConfigPanel.vue:43-47 /
TeamsConfigPanel.vue:37-42) — it only needs a **class swap** to the destructive-button treatment, not a markup
restructure. `SettingsView.vue`'s "Clear Credentials" button (line 124-130) is the exact pattern to mirror:
`bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-md px-4 py-2 text-sm font-medium transition-colors`. The
existing inline soft-warn confirm blocks (the `confirmDeleteId === row.role.id` / `row.team.id` div with "Delete
Role"/"Delete Team" + "Cancel" buttons) are untouched — R245 only asks for the trigger button's visual treatment,
not a behavior change. `TeamsConfigPanel.test.ts` asserts on `button.text() === 'Delete'` and `'Delete Team'`,
not on class names, so a class-only change does not break existing coverage.

**R246:** Traced `role.defaultCount` through the whole pipeline. `quarters.ts:247-256`
(`buildResolveRolesForDate`) turns each role into `{ roleId, count: r.defaultCount }` (absent a per-date
override). `scheduler.ts`'s `proposeQuarterSchedule` fill loop (`scheduler.ts:231-233`) does
`while (calendar[date]![roleId]!.length < count)` — the automated scheduler actively fills each role's slots up
to (never past) `count`, choosing the best-fit eligible candidate each iteration; if no eligible candidate
remains it pushes the slot to `unfilled` and stops (a role can end up understaffed, but the scheduler never
assigns more than `count`). `QuarterGrid.vue:290-303`'s `effectiveCountFor`/`cellIsUnfilled` uses the exact same
`defaultCount` (or a per-date override) to flag a manually-viewed cell red when fewer people are assigned than
the target. So `defaultCount` **is** the number of volunteers the app tries to schedule for that role each
service — an active fill target the auto-scheduler works toward and the grid visually enforces, not a number
the app ignores. It is NOT a hard block on manual entry, though: `quarters.ts`'s `assignPerson` (line 313-327)
has no count check, so a planner can still manually add more people than `defaultCount` from the grid if they
choose — the "hard cap" framing in the OLD copy was wrong in the opposite direction the owner suspected (it's
not "soft," it IS the auto-fill target — but it's also not a strict block on manual additions above it).
Recommended replacement copy (owner-suggested form, confirmed accurate):
**"Default count is the number of volunteers the scheduler auto-fills for this role each service."**

**Primary recommendation:** Three surgical edits — a `max-w-4xl` wrapper on the two tab-panel `v-show` divs in
`RosterView.vue`, a class swap on both panels' Delete `<button>` (already a real button element) to the
`bg-red-900/20 text-red-400` destructive style, and a one-sentence copy edit at `RolesConfigPanel.vue:6`. No
type, store, or scheduler changes.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab-panel width constraint (R244) | Browser / Client (Vue SFC template) | — | Pure CSS/Tailwind class change on an existing `v-show` wrapper div; no logic involved |
| Delete button restyle (R245) | Browser / Client (Vue SFC template) | — | Class-only change to an existing `<button>` element; click handler (`confirmDeleteId = row.role.id`) is untouched |
| Schedulable-roles copy (R246) | Browser / Client (Vue SFC template, static text) | — | Static `<p>` string; no data binding, no store read |
| Scheduler's actual use of `defaultCount` (informs R246 accuracy) | Business logic (`src/utils/scheduler.ts`, pure function) | Store orchestration (`src/stores/quarters.ts`) | The fill-target behavior already lives in the pure scheduler function; this phase reads but does not modify it |

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. All three changes use only Tailwind utility classes and
existing Vue/TypeScript already present in the project's dependency tree.

## Architecture Patterns

### System Architecture Diagram

```
RosterView.vue (tab shell)
│
├─ activeTab === 'volunteers'  →  full-width Volunteers table/matrix  (UNCHANGED — no max-w wrapper)
│
├─ activeTab === 'roles'  →  [NEW: max-w-4xl wrapper] → RolesConfigPanel.vue
│                                                          ├─ header copy (R246 edit: RolesConfigPanel.vue:6)
│                                                          ├─ per-role row: name input, count input,
│                                                          │    Save button, Delete button (R245 restyle)
│                                                          │    → confirmDeleteId soft-warn block (unchanged)
│                                                          └─ Add Role row (unchanged)
│
└─ activeTab === 'teams'  →  [NEW: max-w-4xl wrapper] → TeamsConfigPanel.vue
                                                           ├─ per-team row: name input, tag select,
                                                           │    Save button, Delete button (R245 restyle,
                                                           │    same treatment as Roles for consistency)
                                                           │    → confirmDeleteId soft-warn block (unchanged)
                                                           └─ Add Team row (unchanged)

Data path informing R246 (read-only this phase, traced for copy accuracy):
Role.defaultCount (src/types/roster.ts)
  → quarters.ts buildResolveRolesForDate(): { roleId, count: role.defaultCount }
    → scheduler.ts proposeQuarterSchedule(): while (assigned.length < count) { fill from eligible pool }
    → QuarterGrid.vue effectiveCountFor()/cellIsUnfilled(): flags a cell red when assigned < count
```

### Recommended Project Structure
No new files. Edits confined to:
```
src/
├── views/
│   └── RosterView.vue           # R244: max-w-4xl on the two tab-panel v-show wrappers
└── components/
    ├── RolesConfigPanel.vue     # R245: Delete button class swap; R246: copy at line 6
    └── TeamsConfigPanel.vue     # R245: Delete button class swap (same treatment)
```

### Pattern 1: Admin-section width constraint
**What:** A `max-w-4xl` class on a page/section container to prevent form rows from stretching full-width on
wide viewports.
**When to use:** Any config/settings-style panel of stacked rows (name + a few small controls), as opposed to
data-table/matrix views that legitimately want full width.
**Example:**
```html
<!-- Source: src/views/SettingsView.vue:3 (existing pattern to mirror) -->
<div class="px-6 py-8 max-w-4xl">
```
Applied at the RosterView tab-panel level (not inside each child component, so both panels get it identically
and the Volunteers tab is unaffected):
```html
<!-- src/views/RosterView.vue:244 / :249 — add max-w-4xl to both v-show wrappers -->
<div v-show="activeTab === 'roles'" class="max-w-4xl">
  <RolesConfigPanel />
</div>
<div v-show="activeTab === 'teams'" class="max-w-4xl">
  <TeamsConfigPanel />
</div>
```

### Pattern 2: Destructive-button styling (mirrors SettingsView's "Clear Credentials")
**What:** A real `<button>` styled with a subdued red fill (`bg-red-900/20`), red text, and a stronger hover
state — distinct from the primary indigo Save button and from a plain text link.
**When to use:** Any single-click destructive trigger that opens an inline confirm step (not an immediate,
un-confirmed delete).
**Example:**
```html
<!-- Source: src/views/SettingsView.vue:124-130 (existing pattern to mirror) -->
<button
  type="button"
  @click="onClearPcCredentials"
  class="bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-md px-4 py-2 text-sm font-medium transition-colors"
>
  Clear Credentials
</button>
```
Applied to RolesConfigPanel.vue/TeamsConfigPanel.vue's existing Delete button — same element, class swap only
(size trimmed to match the row's other `text-xs px-3 py-1.5` controls so it doesn't visually dominate a dense
row; the Settings precedent's `px-4 py-2 text-sm` is a full-width-form-row size, appropriate there but oversized
for a compact table row — Claude's discretion per CONTEXT.md, still same color/style family):
```html
<!-- RolesConfigPanel.vue:43-47 — BEFORE -->
<button
  type="button"
  @click="confirmDeleteId = row.role.id"
  class="text-xs text-red-400 hover:text-red-300 transition-colors"
>Delete</button>

<!-- AFTER — real destructive button, same click handler, row-appropriate sizing -->
<button
  type="button"
  @click="confirmDeleteId = row.role.id"
  class="text-xs px-3 py-1.5 rounded-md font-medium bg-red-900/20 hover:bg-red-900/40 text-red-400 transition-colors"
>Delete</button>
```
The same class change applies verbatim to `TeamsConfigPanel.vue:37-42`'s Delete button (identical current
classes, identical fix, per CONTEXT's "apply the SAME treatment to BOTH panels").

### Pattern 3: Copy correction sourced from traced behavior, not guesswork
**What:** Replace an inaccurate inline description with one confirmed against the actual consuming code path.
**When to use:** Any user-facing copy describing system behavior (limits, targets, defaults) — verify against
the real implementation before wording it, per this project's own R246 precedent.
**Example:**
```html
<!-- RolesConfigPanel.vue:5-7 — BEFORE -->
<p class="text-xs text-gray-500 mt-0.5">
  Schedulable roles grouped by Band, Tech, and Other. Default count is a soft planning target, not a hard cap.
</p>

<!-- AFTER (confirmed accurate against scheduler.ts's fill loop, this RESEARCH's Summary) -->
<p class="text-xs text-gray-500 mt-0.5">
  Schedulable roles grouped by Band, Tech, and Other. Default count is the number of volunteers the
  scheduler auto-fills for this role each service.
</p>
```

### Anti-Patterns to Avoid
- **Applying `max-w-4xl` to the whole `RosterView.vue` page container:** would also constrain the Volunteers
  table, which the owner and CONTEXT explicitly want to stay full-width. Scope the wrapper to the two `v-show`
  tab-panel divs only.
- **Rebuilding the Delete affordance as a three-dot menu or slideout:** explicitly deferred (CONTEXT.md
  `## Deferred Ideas`). The real-button minimum satisfies R245; do not scope-creep into the larger redesign.
- **Changing scheduler.ts's fill-loop behavior to "explain" the copy:** R246 is copy-only. The owner has
  already accepted the current hard-target auto-fill behavior; only the description was wrong.
- **Widening the Settings "Clear Credentials" button size (`px-4 py-2 text-sm`) verbatim into the dense
  role/team rows:** that sizing is calibrated for a standalone settings-card row, not a compact multi-control
  table row. Keep the row's existing `text-xs px-3 py-1.5` sizing family (matching the adjacent Save button)
  and only adopt the red color/background treatment from the Settings precedent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Destructive-button styling | A new red-button color/spacing convention | The exact `bg-red-900/20 hover:bg-red-900/40 text-red-400` classes from SettingsView.vue:124-130 | Keeps every destructive action in the app visually consistent (CONTEXT.md's explicit requirement) |
| Width constraint | A new responsive breakpoint scheme or custom CSS | The existing `max-w-4xl` Tailwind utility already used by SettingsView.vue | Single source of truth for "admin section width"; no new token to maintain |

**Key insight:** Every piece of this phase already has a living precedent elsewhere in the codebase (width
token, button style, and even the "trace behavior before wording copy" discipline evidenced by R246 itself).
The work is applying existing patterns, not inventing new ones.

## Common Pitfalls

### Pitfall 1: Assuming the Delete button needs new markup
**What goes wrong:** Treating R245 as "replace a text link with a `<button>` element" would lead to
unnecessarily restructuring the template.
**Why it happens:** The phase description says "convert the Delete affordance to a real button," which sounds
like a markup change.
**How to avoid:** Both panels' Delete affordance is ALREADY a `<button type="button">` — it is styled to
*look* like a text link (`text-xs text-red-400 hover:text-red-300`). Only the `class` attribute needs to
change; the element, `@click` handler, and surrounding confirm-block logic are untouched.
**Warning signs:** A diff touching the confirm-block logic (`confirmDeleteId`, `onConfirmDelete`) or the
button's `@click` handler is out of scope for R245.

### Pitfall 2: The stale "soft planning default" wording also lives in a code comment, not just the UI copy
**What goes wrong:** `src/types/roster.ts:9` has the identical stale claim baked into a TypeScript comment:
`defaultCount: number // default role-count template value (D-02) — a soft planning default, NOT a hard cap`.
Fixing only the UI string leaves a contradicting, equally-wrong comment in the type definition.
**Why it happens:** The original "soft cap" framing (D-02, Phase 13) predates this correction and was copied
into both the UI copy and the type doc-comment at the same time.
**How to avoid:** R246 is explicitly scoped to "the copy" (user-facing `RolesConfigPanel.vue:6`) per
CONTEXT.md — the type-comment fix is technically out of R246's stated scope, but leaving a directly
contradictory statement sitting three files away is a clear "leave the codebase better" opportunity with zero
risk (comment-only, no behavior/type change). Recommend the plan include this comment fix as a low-risk bonus
edit in the same task as the R246 UI copy change, but do not treat it as a blocking requirement if the planner
prefers strict R246 scope.
**Warning signs:** None — this is an FYI, not a functional risk either way.

### Pitfall 3: `RolesConfigPanel.vue` has no dedicated unit test file
**What goes wrong:** Assuming `RolesConfigPanel`'s markup changes (width, button, copy) are covered by
`RosterView.test.ts` because that view renders the panel.
**Why it happens:** `RosterView.vue` does mount `RolesConfigPanel`, but `RosterView.test.ts` explicitly stubs
it out: `RolesConfigPanel: { template: '<div />' }` (RosterView.test.ts:108), same for `TeamsConfigPanel`. So
today NEITHER panel's rendered markup is exercised by any test at the RosterView level.
**How to avoid:** `TeamsConfigPanel.test.ts` DOES fully mount and assert on `TeamsConfigPanel`'s real markup
(including the Delete button's text and the confirm flow) — this phase's `TeamsConfigPanel` changes are
covered by that existing file (button text stays `'Delete'`/`'Delete Team'`, so a class-only change does not
break its assertions). `RolesConfigPanel.vue` has **no equivalent test file at all** — see Validation
Architecture below for the Wave 0 gap this creates.
**Warning signs:** A plan that claims "existing tests cover RolesConfigPanel's Delete-button change" without
first creating `RolesConfigPanel.test.ts` is asserting coverage that does not exist.

### Pitfall 4: `RosterView.test.ts` has a pre-existing, unrelated failure — do not chase it
**What goes wrong:** Per this project's `CLAUDE.md`, `src/views/__tests__/RosterView.test.ts` is in the
documented known-failing baseline ("stale assertion"), independent of this phase's changes.
**Why it happens:** A prior phase changed behavior the test still asserts the old way against; it was never
updated.
**How to avoid:** Run the app suite (`npx vitest run`) before AND after this phase's changes. If
`RosterView.test.ts` fails identically before your changes, that failure is the documented baseline, not a
regression introduced by R244's wrapper-div edit. Do not spend a task "fixing" it unless the plan is
deliberately scoped to that (it is not, per CONTEXT's phase boundary).
**Warning signs:** Treating a `RosterView.test.ts` failure as a phase-83 regression without first confirming
it also fails on `master` before any edit.

## Code Examples

Verified patterns from the actual codebase (this phase reuses existing app conventions, not external library
docs — there is no new library, so Context7/official-docs sourcing does not apply here):

### Destructive button (source of truth for R245)
```html
<!-- Source: src/views/SettingsView.vue:124-130 -->
<button
  type="button"
  @click="onClearPcCredentials"
  class="bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-md px-4 py-2 text-sm font-medium transition-colors"
>
  Clear Credentials
</button>
```

### Width container (source of truth for R244)
```html
<!-- Source: src/views/SettingsView.vue:3 -->
<div class="px-6 py-8 max-w-4xl">
```

### Scheduler's actual fill-target behavior (source of truth for R246)
```typescript
// Source: src/utils/scheduler.ts:231-233 — the automated scheduler's per-role fill loop.
// `count` originates from role.defaultCount via quarters.ts:254's
// `.map((r) => ({ roleId: r.id, count: r.defaultCount }))` (absent a per-date override).
for (const { roleId, count } of rolesForDate) {
  calendar[date]![roleId] ??= []
  while (calendar[date]![roleId]!.length < count) {
    // ...picks the best-fit eligible candidate, or pushes to `unfilled` and stops if none remain
  }
}
```
```typescript
// Source: src/components/QuarterGrid.vue:290-303 — the manual grid uses the SAME count to
// flag a cell red ("unfilled") whenever fewer people are assigned than the target.
function effectiveCountFor(date: string, roleId: string): number {
  const override = props.quarter.roleOverridesByDate[date]
  const overrideMatch = override?.find((r) => r.roleId === roleId)
  if (overrideMatch) return overrideMatch.count
  const role = props.roles.find((r) => r.id === roleId)
  return role?.defaultCount ?? 0
}
function cellIsUnfilled(date: string, roleId: string): boolean {
  return cellPeople(date, roleId).length < effectiveCountFor(date, roleId)
}
```

## State of the Art

Not applicable — no external library/framework version drift is relevant to this phase. All patterns sourced
are the project's own existing, current conventions (Vue 3 `<script setup>`, Tailwind v4 utility classes).

**Deprecated/outdated:**
- The `RolesConfigPanel.vue:6` copy string and the `src/types/roster.ts:9` doc-comment both describe an
  outdated ("soft target, not a hard cap") understanding of `defaultCount` that the owner has confirmed does
  not match actual scheduler behavior. See Pitfall 2 above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact reworded R246 sentence ("Default count is the number of volunteers the scheduler auto-fills for this role each service") is the best final wording, though CONTEXT.md leaves the exact phrasing to Claude's discretion | Summary / Pattern 3 | Low — the underlying behavioral claim is `[VERIFIED: codebase]` (traced through scheduler.ts + QuarterGrid.vue), only the exact sentence wording is a stylistic choice, not a factual risk |
| A2 | Trimming the destructive-button size from Settings' `px-4 py-2 text-sm` down to the row's existing `text-xs px-3 py-1.5` is the right call for R245, rather than using the Settings sizing verbatim | Pattern 2 | Low — CONTEXT.md explicitly leaves "the precise button markup" to Claude's discretion as long as it mirrors the destructive-button *pattern* (color/style), not necessarily its exact padding; a reviewer could reasonably prefer the larger size instead |

**If this table is empty:** N/A — see above; both items are low-risk styling/wording judgment calls, not
unverified factual claims.

## Open Questions

1. **Should the `src/types/roster.ts:9` stale comment be fixed in the same phase as R246?**
   - What we know: It contains the identical outdated claim as the old `RolesConfigPanel.vue:6` copy; R246's
     stated scope is "the copy" (user-facing text), not code comments.
   - What's unclear: Whether the planner wants to bundle this zero-risk comment fix into the same task or
     leave it for a future pass.
   - Recommendation: Bundle it — it's a one-line comment edit with no behavioral or type impact, in the same
     file family as R246's fix, and leaving a directly contradictory comment right next to a just-corrected UI
     string is an obvious follow-up a code reviewer would flag anyway.

## Environment Availability

Skipped — this phase has no external dependencies (pure Vue SFC template/class/copy edits; no new packages,
no service, no CLI tool beyond the project's existing `npm`/`vitest`/`vue-tsc` toolchain already required by
every other phase).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.x (root, jsdom) — `@vue/test-utils` for component mounts |
| Config file | `vite.config.ts` (root suite; excludes `src/rules.test.ts` and `render-service/**`) |
| Quick run command | `npx vitest run src/components/__tests__/TeamsConfigPanel.test.ts src/views/__tests__/RosterView.test.ts` |
| Full suite command | `npx vitest run` (per CLAUDE.md: bare `npx vitest run` is the correct 2-file-baseline app-suite command — do NOT use `--dir src`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R244 | Roles/Teams tab-panel wrapper carries a width-constraining class (`max-w-4xl`) in RosterView.vue | unit (component) | `npx vitest run src/views/__tests__/RosterView.test.ts` | ✅ (existing file — needs a NEW assertion added; panels are stubbed so this only checks the wrapper div's class, not panel internals) |
| R245 (Teams) | Teams Delete trigger renders as a `<button>` with the destructive-button classes (`bg-red-900/20`/`text-red-400`); soft-warn confirm still works | unit (component) | `npx vitest run src/components/__tests__/TeamsConfigPanel.test.ts` | ✅ Wave 0: existing text/behavior assertions (`'Delete'`, `'Delete Team'`, confirm/cancel flow) already pass unchanged with a class-only edit; ADD one new assertion on the button's class list |
| R245 (Roles) | Roles Delete trigger renders as a `<button>` with the destructive-button classes; soft-warn confirm still works | unit (component) | `npx vitest run src/components/__tests__/RolesConfigPanel.test.ts` | ❌ Wave 0 — **no test file exists for RolesConfigPanel at all** (see Pitfall 3) |
| R246 | `RolesConfigPanel.vue`'s header paragraph no longer contains "soft planning target, not a hard cap" and instead states the scheduler auto-fills the count | unit (component) | `npx vitest run src/components/__tests__/RolesConfigPanel.test.ts` | ❌ Wave 0 — same new file as above should assert the corrected copy string is present and the old phrase is absent |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/__tests__/TeamsConfigPanel.test.ts src/components/__tests__/RolesConfigPanel.test.ts src/views/__tests__/RosterView.test.ts` (targeted, <30s)
- **Per wave merge:** `npx vitest run` (full app-suite baseline)
- **Phase gate:** `npm run type-check` (per CLAUDE.md, this is `vue-tsc --build`, which also typechecks test
  files — the narrower `-p tsconfig.app.json` form is NOT sufficient evidence of a clean gate) + full suite
  green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/components/__tests__/RolesConfigPanel.test.ts` — does not exist; create it mirroring
  `TeamsConfigPanel.test.ts`'s mount/mock pattern (`vi.mock('@/stores/roster')`) so R245 (Roles Delete button)
  and R246 (corrected copy) both have real, executable assertions instead of relying on manual inspection.
  Minimum coverage: (a) the header paragraph contains the corrected sentence and does NOT contain "soft
  planning target" / "not a hard cap"; (b) the Delete button carries `bg-red-900/20` and `text-red-400` in its
  class list; (c) the existing Delete → confirm → "Delete Role" / Cancel flow still works exactly as today
  (mirrors the Teams suite's existing "clicking Delete reveals an inline soft-warn confirm" test).
- [ ] `src/views/__tests__/RosterView.test.ts` — add one assertion that the `activeTab === 'roles'` and
  `activeTab === 'teams'` wrapper divs carry the width-constraining class, since both child panels are stubbed
  and cannot otherwise prove the wrapper is actually applied at the RosterView level.
- [ ] Confirm the pre-existing "stale assertion" failure in `RosterView.test.ts` (CLAUDE.md's documented
  baseline) still reproduces identically on `master` before this phase's edits, so it is never miscounted as
  a regression this phase introduced (Pitfall 4).

*(No framework install needed — Vitest + @vue/test-utils are already configured and used by the sibling
`TeamsConfigPanel.test.ts`.)*

## Security Domain

Not applicable — this phase makes no auth, session, access-control, input-validation, or cryptography changes.
It is a static UI layout/copy/button-style change with no new user input surface, no Firestore rule change, and
no data written beyond what the existing `updateRole`/`updateTeam`/`deleteRole`/`deleteTeam` store methods
already handle unchanged (per CONTEXT.md: "Do not change scheduler behavior — copy only" and "Client-only ...
No rules/functions/deploy").

## Sources

### Primary (HIGH confidence)
- `src/views/SettingsView.vue` (read directly, this session) — `max-w-4xl` width token (line 3), destructive
  "Clear Credentials" button markup (lines 124-130)
- `src/components/RolesConfigPanel.vue` (read directly, this session) — current copy (line 6), current Delete
  button markup (lines 43-47), confirm block (lines 50-66)
- `src/components/TeamsConfigPanel.vue` (read directly, this session) — current Delete button markup (lines
  37-42), confirm block (lines 64-80)
- `src/views/RosterView.vue` (read directly, this session) — tab-panel `v-show` wrapper structure (lines
  244-251)
- `src/utils/scheduler.ts` (read directly, this session) — the fill-loop confirming `defaultCount`/`count` is
  an active auto-fill target (lines 231-233), not ignored
- `src/stores/quarters.ts` (read directly, this session) — `buildResolveRolesForDate` mapping `defaultCount`
  into the scheduler's `count` input (lines 247-256); `assignPerson`'s lack of a count check confirming manual
  entry is not hard-blocked (lines 313-327)
- `src/components/QuarterGrid.vue` (read directly, this session) — `effectiveCountFor`/`cellIsUnfilled` using
  the same `defaultCount` to flag understaffed cells (lines 290-303)
- `src/types/roster.ts` (read directly, this session) — the stale "soft planning default, NOT a hard cap"
  doc-comment at line 9 (Pitfall 2)
- `.planning/phases/83-roles-teams-tab-ux-copy/83-CONTEXT.md` — locked decisions and discretion areas (this
  session)
- `.planning/REQUIREMENTS.md` / `.planning/ROADMAP.md` — R244/R245/R246 definitions and Phase 83 success
  criteria (this session)
- `src/components/__tests__/TeamsConfigPanel.test.ts` (read directly, this session) — existing Delete-button
  test coverage that must survive a class-only R245 edit
- `src/views/__tests__/RosterView.test.ts` (read directly, this session) — confirmed both panels are stubbed
  (line 106-113), so no existing coverage of panel internals exists at the RosterView level
- `C:\projects\worshipplanner\CLAUDE.md` (read directly, this session) — testing/type-check gate commands and
  the documented `RosterView.test.ts` known-failing baseline

### Secondary (MEDIUM confidence)
None used — this phase required no external documentation lookup; everything needed was verifiable directly
in the project's own source.

### Tertiary (LOW confidence)
None.

## Project Constraints (from CLAUDE.md)

- Use `npm run type-check` (which runs `vue-tsc --build`, typechecking test files too) as the type-check gate
  for this phase — not the narrower `-p tsconfig.app.json` form.
- Use bare `npx vitest run` for the app suite (excludes `src/rules.test.ts` and `render-service/**`
  automatically via `vite.config.ts`); do NOT use `--dir src` (bypasses the exclude and pulls in
  `rules.test.ts`, which needs a live Firestore emulator).
- `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` are a documented known-failing
  baseline (unrelated to this phase) — do not chase them as regressions; confirm they fail identically before
  this phase's edits if in doubt.
- This phase is client-only per the milestone's stated deploy policy (Phase 83's ROADMAP deploy note: "no
  deploy hand-over") — no `firebase deploy` commands belong in this phase's plan.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new stack/library — pure internal-pattern reuse) — HIGH confidence the identified
  existing patterns (SettingsView width/button) are the correct precedents, per CONTEXT.md's own explicit
  pointer to them, confirmed by direct file read.
- Architecture: HIGH — every file touched was read directly this session; the width-wrapper injection point
  and button-class-swap-only nature of R245 are confirmed against the live template, not inferred.
- R246 scheduler behavior: HIGH — traced end-to-end through three files (`quarters.ts` → `scheduler.ts` →
  `QuarterGrid.vue`) with exact line citations; not an assumption.
- Pitfalls: HIGH — the "no RolesConfigPanel test file" gap and the RosterView.test.ts stub/baseline-failure
  facts were confirmed by direct grep/read, not inferred from documentation.

**Research date:** 2026-08-24
**Valid until:** No expiry driver (internal-codebase-only research, no external library version dependency) —
re-verify only if `RolesConfigPanel.vue`, `TeamsConfigPanel.vue`, `RosterView.vue`, `SettingsView.vue`, or
`scheduler.ts` change materially before this phase is planned/executed.
