# Phase 83: Roles/Teams Tab UX & Copy - Context

**Gathered:** 2026-08-24
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (owner testing-feedback item; grant defaults below). Pure client UI polish — no UI-SPEC needed, plan with `--skip-ui`.

<domain>
## Phase Boundary

Polish the Roles and Teams configuration tabs: constrain their width like the admin section (R244), adopt an
existing app save/delete UX pattern — at minimum a real Delete **button** (R245), and correct the
"soft planning target, not a hard cap" schedulable-roles description so it matches what the scheduler actually
does (R246). Client-only, no deploy.
</domain>

<decisions>
## Implementation Decisions (grant defaults — research confirms exact strings/patterns)

### R244 — constrain Roles/Teams tab width
- The Roles and Teams tabs render `RolesConfigPanel.vue` and `TeamsConfigPanel.vue` inside `RosterView.vue`.
  Constrain their content width to match the admin section's convention (SettingsView.vue uses
  `max-w-4xl` on its page container; the OrganizationsTab admin cards are similarly constrained) so the
  row inputs no longer stretch full-width. Apply a max-width wrapper to these two panels/tabs (mirror the
  admin/Settings constraint), NOT the whole RosterView (the Volunteers matrix legitimately uses full width).

### R245 — save/delete UX follows an existing pattern (real Delete button)
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

### R246 — correct the "soft planning target" copy
- `RolesConfigPanel.vue:6` reads: "Schedulable roles grouped by Band, Tech, and Other. Default count is a
  soft planning target, not a hard cap." The owner reports scheduling **hard-targets** this count and is fine
  with that behavior — only the copy must be accurate. RESEARCH must confirm exactly how the scheduler uses
  the per-role default count (how many volunteers it assigns per service) and reword the sentence to describe
  that truthfully (e.g. "Default count is the number of volunteers scheduled for this role each service.").
  Do not change scheduler behavior — copy only.

### Deploy discipline
- Client-only (layout + button markup + copy). No rules/functions/deploy.

### Claude's Discretion
- The exact max-width token for R244 (match whatever the admin/Settings section uses); the precise button
  markup, as long as it mirrors the existing destructive-button pattern; the exact reworded R246 sentence,
  as long as it accurately reflects the scheduler's real use of the count (confirmed by research).
</decisions>

<code_context>
## Existing Code Insights

### Integration Points
- `src/components/RolesConfigPanel.vue` (the `:6` copy string; inline delete/confirm; row inputs) and
  `src/components/TeamsConfigPanel.vue` (Phase 79 mirror) — R244, R245, R246.
- `src/views/RosterView.vue` — where the Roles/Teams tabs mount (apply the width constraint here or on the
  panels).
- `src/views/SettingsView.vue` — the `max-w-4xl` width convention (R244) + the PC-credentials button pattern
  to mirror (R245).
- The scheduler code that consumes the per-role default count (research to locate) — R246 accuracy.

### Established Patterns
- Editable-list panels (Roles/Teams) share a shape; keep them consistent.
- Destructive actions elsewhere use a real `bg-red-900/20 text-red-400` button, not a text link.
</code_context>

<specifics>
## Specific Ideas
- These are owner testing-feedback items #3 (width + save/delete UX) and #2 (soft-target copy).
</specifics>

<deferred>
## Deferred Ideas
- The full three-dot-menu / `>`-into-slideout redesign of the Roles/Teams editors (owner-offered option, not
  required this phase) — a possible future UX pass.
- Any change to the scheduler's actual targeting behavior (owner accepts current behavior; copy-only fix).
</deferred>
