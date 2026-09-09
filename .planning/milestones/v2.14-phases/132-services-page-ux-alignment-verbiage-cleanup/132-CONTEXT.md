# Phase 132: Services Page UX Alignment & Verbiage Cleanup - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — decisions grounded in a codebase scan of the existing header pattern

<domain>
## Phase Boundary

Bring the main Services page (`src/views/ServicesView.vue`) up to the app's standard page-header + mobile
conventions, add alternating row shading to the public share pages, and remove incidental "Planning Center"
UI copy — WITHOUT altering the real Planning Center integration/export code or copy.

Requirements: R406 (standard header on /services), R407 (mobile-friendly tabs + buttons), R408 (alternating
row shading on the share service-link pages), R409 (remove incidental "Planning Center" verbiage).
This phase is UI/copy polish; it touches none of the milestone's new data models.
</domain>

<decisions>
## Implementation Decisions

### R406 — Standard page header on /services
- **Observed inconsistency (verified):** other main views open with a page title —
  `<h1 class="text-xl font-semibold text-gray-100">Songs</h1>` (SongsView:17), same on RosterView:7
  ("Volunteers") and SettingsView:6 ("Settings"), inside the `px-6 py-8` container. `ServicesView.vue`
  currently has **no `<h1>` / page-header block** — it jumps straight into the tab bar.
- **Decision:** add the same standard header block ("Services" as the `<h1>`) to ServicesView, matching the
  exact classes/structure the other main views use, so it reads consistently. Match, don't invent — use the
  established inline header pattern (there is no shared PageHeader component; RunHeader.vue is run-mode only).

### R407 — Mobile-friendly tabs + buttons
- **Observed problem:** the tab row is a single horizontal flex (`flex items-center gap-1 … border-b`) with
  tab buttons, a `flex-1` spacer, then action buttons (Share Link / New Service) on the same row — this
  overflows and cramps at phone widths.
- **Decision:** make the tab strip horizontally scrollable OR wrap gracefully, and let the action buttons
  wrap below the tabs (or collapse into a reachable, tappable arrangement) at small breakpoints, matching
  the app's existing mobile/responsive button conventions (Tailwind `sm:`/`md:` breakpoints already used
  elsewhere). Tap targets must remain comfortably sized on a phone. Preserve current desktop layout.

### R408 — Alternating row shading on share service-link pages
- **Target:** the public/share service-link rendering (ShareView and any read-only share/order renderers it
  composes). Add an alternating light-gray row background (zebra striping) to the service-plan rows so it's
  easier to keep your place scanning.
- **Decision:** subtle alternating background using the app's existing subtle surface token (respect the
  share page's theme — it is a public page; ensure the stripe is visible but low-contrast). Apply to the
  per-row list of the service order/plan, not to headers.

### R409 — Remove incidental "Planning Center" verbiage (inventory-and-classify FIRST)
- **Load-bearing rule:** this app has a REAL, functioning Planning Center integration/export. A blind
  find-and-replace would garble substantive integration copy. So the FIRST task is a grep inventory of every
  user-visible "Planning Center" string, each CLASSIFIED as:
  - **(a) KEEP** — copy about the actual PC integration/export (e.g. PcImportModal, the PC export UI, the
    "Push to Planning Center" affordances, `planningCenterApi`/`pcSongImport` identifiers & comments —
    identifiers/comments are never touched regardless).
  - **(b) REMOVE/REWORD** — incidental UI copy that mentions PC where it adds nothing.
- **Confirmed removal (owner-specified):** the Planned/locked banner currently reads "Planned — editing is
  locked. Planning Center already has this plan. Reopen it…" → drop the "Planning Center already has this
  plan." sentence (keep the rest). Locate the exact string in source (likely in ServiceEditorView.vue /
  serviceEditorActionBar.ts or a related lock/banner component).
- **Do NOT touch:** code identifiers, function/variable names, comments, API/config strings, test fixtures,
  or any copy that genuinely describes the PC integration. Only user-visible incidental copy.
- Present the full classification table in the PLAN/SUMMARY so the removals are auditable before they land.

### Claude's Discretion
- Exact Tailwind breakpoint choices and whether the mobile tab strip scrolls vs wraps.
- The exact gray token/opacity for the zebra stripe.
- Which incidental "Planning Center" strings beyond the confirmed banner sentence qualify as (b) — decide
  per the classify rule and record each in the summary.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / Patterns
- Standard page-header pattern: `<h1 class="text-xl font-semibold text-gray-100">…</h1>` in the `px-6 py-8`
  container (SongsView.vue:17, RosterView.vue:7, SettingsView.vue:6).
- `src/views/ServicesView.vue` — the tab bar + action buttons to restructure (no `<h1>` today).
- Public share rendering: `src/views/ShareView.vue` (+ the read-only order/stage renderers it composes) —
  target for R408 row shading.
- "Planning Center" appears across ~20 src files; MOST are the real integration (planningCenterApi.ts,
  pcSongImport.ts, PcImportModal.vue, CsvImportModal.vue, stores) and must be left alone. The removal
  targets are user-visible incidental strings only.

### Integration Points
- ServicesView header/tab template; ShareView row rendering; the Planned/locked banner string source.
</code_context>

<specifics>
## Specific Ideas

Match existing patterns exactly (header classes, responsive conventions). The verbiage task is
inventory-first, classify-each, remove-only-incidental — the removals must be auditable (classification
table in the summary), because the app has a real PC integration whose copy must survive intact.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
