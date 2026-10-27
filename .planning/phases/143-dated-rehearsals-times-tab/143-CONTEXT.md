# Phase 143: Dated Rehearsals & Times Tab - Context

**Gathered:** 2026-10-27
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — owner instruction 2026-10-27 "take all your recommendations": every
grey-area answer below is the recommended option, auto-accepted.

<domain>
## Phase Boundary

Move the service editor's rehearsal/report-time controls into a dedicated **Times** tab (after Messages) and
make every rehearsal dated: no undated rehearsal can be created, org-default rehearsal times pre-fill the
time of a rehearsal being added instead of seeding undated rows, and legacy undated rows from v2.15 are
flagged for the planner without data loss. Cross-surface display (R433) is regression-guarded, not
reworked. Requirements R441–R445. Promoted from backlog 999.6 (owner field feedback 2026-09-18).

</domain>

<decisions>
## Implementation Decisions

### How a rehearsal gets its date (R441, R442)
- Adding uses an **inline add form** in the Times tab: a date input + a time input + an "Add rehearsal"
  button that is **disabled until both date and time are set**. The rehearsal row is created only on
  submit, so a row is never created undated and no date is guessed. The form resets after adding.
- **No rehearsal rows are seeded at service creation.** `createService` stops mapping
  `rehearsalTimeDefaults` into undated rows. Instead the add form's **time pre-fills from the org default**
  (first default); when the org has more than one default time, each default is offered as a one-click
  **time chip** that sets the form's time. The org-default **report time is still copied** onto a new
  service at creation (unchanged). Changing an org default never alters an existing service.
- **Clearing a date is rejected:** an edit that sets an existing rehearsal's date to '' reverts to the
  previous value (Remove is the way to delete a rehearsal).
- **Time is required too:** clearing an existing rehearsal's time is likewise reverted — every new rehearsal
  has both date and time (matches `isDisplayableRehearsal`).
- Settings (`SettingsView.vue`) org-defaults helper copy is updated to say the default rehearsal time(s)
  pre-fill the time when a planner adds a rehearsal. The defaults' data shape (`rehearsalTimeDefaults:
  string[]`, `reportTimeDefault: string`) is unchanged — no new org setting.

### Legacy undated rows from v2.15 (R443)
- Undated rows already stored on services render in the Times tab (editor view) with an amber
  **"Needs a date"** marker and a highlighted empty date input; setting a date clears the marker (the
  reject-clear rule only applies to rows that already have a date); Remove deletes the row.
- **No migration** — stored rows stay as-is until the planner acts. Read-only/public surfaces and both
  projections keep filtering them via the existing `isDisplayableRehearsal` predicate.
- A small **amber dot on the Times tab button** (editors only) when the service holds any non-displayable
  rehearsal row, so planners notice without opening the tab.
- Locked services holding undated rows get no special handling — rows stay hidden; Reopen to fix.

### Times tab placement & gating (R444)
- The tab is **visible to everyone, like Slides** (not editor-gated like Roles/Stage/Messages): editable when
  `canEditService` (editor + Draft), read-only otherwise. Editor order: Service Order · Slides · Roles ·
  Stage Layout · Messages · **Times**; viewer order: Service Order · Slides · Times. Added to
  `visibleTabOrder`, `tabButtonRef`, the `activeTab`/`ServiceEditorTabId` unions and roving-tabindex keyboard
  handling exactly like the sibling tabs (same classes, `role="tab"`, `aria-controls`, `v-show` panel).
- Read-only tab content: a simple list — "Report time: 8:00 AM" and each **dated** rehearsal (date, time)
  using the existing `formatWallClockTime` / `formatRehearsalDateShort`; an empty state when none.
- **Nothing time-related remains above the tab strip** — the header Times block (`data-testid=
  "service-times-section"`) is removed entirely.
- Editable tab layout: two sections — **Report time** (single time input, helper "Day-of call time on
  {service date}") and **Rehearsals** (chronologically sorted rows: date, time, Remove; then the inline add
  form + default-time chips). Rows stack on mobile. Same debounced autosave + persistent save status as
  today (writes still go through `updateService(id, { rehearsals, reportTime })`).

### Claude's Discretion
- Exact component split (e.g. extracting a `ServiceTimesPanel.vue` from `ServiceEditorView.vue` is
  encouraged — the view is ~4k lines), test-id names, chip styling, and the precise empty-state copy.
- Whether the "Needs a date" row also catches a dated-but-untimed legacy row (recommended: flag any
  non-displayable row, label "Needs a date" / "Needs a time" accordingly).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/rehearsalTimes.ts` — `Rehearsal`, `sortRehearsals`, `formatWallClockTime`,
  `isDisplayableRehearsal` (shared by both projections and every display surface).
- `ServiceEditorView.vue` helpers: `editableRehearsals`, `readOnlyRehearsals`, `formatRehearsalDateShort`,
  `onAddRehearsal` / `onRemoveRehearsal` / `onRehearsalDateChange` / `onRehearsalTimeChange` /
  `onReportTimeChange` (~L2800-2860) — each re-checks `canEditService` (keep that pattern).
- `authStore.settings.rehearsalTimeDefaults` / `reportTimeDefault` (`src/types/organization.ts:102-109`).

### Established Patterns
- Tab strip: `ServiceEditorView.vue:818` (`role="tablist"`, `.scrollbar-hide`, `handleTabKeydown`,
  ADR-0217 roving tabindex), tab buttons copied verbatim per tab, panels via `v-show="activeTab === …"`,
  `visibleTabOrder` computed at ~L1964 (Slides is the precedent for a viewer-visible tab).
- Handler-gates-itself (R036): every mutation handler re-checks `canEditService`.
- Dates/times are plain strings ('YYYY-MM-DD' / 'HH:mm'), never `Timestamp`, never `new Date(str)`.
- Comment convention: short comments; rationale → ADRs, behavior narration → `.planning/codebase/` maps.

### Integration Points
- Header Times block to remove: `ServiceEditorView.vue` ~L240-330 (`service-times-section`).
- `createService` pre-fill: `src/stores/services.ts` ~L474-483.
- Projections (must stay unchanged, regression-test): `buildServiceSnapshot` (`src/stores/services.ts`
  ~L196-205), `buildRehearseAccess` (`src/utils/rehearseAccess.ts`).
- Display surfaces (unchanged): DashboardView, ServiceCard, ScheduleServiceCard, ShareView,
  VolunteerServiceView.
- Settings org-defaults UI: `src/views/SettingsView.vue` ~L555-600.
- Existing tests to update/extend: ServiceEditorView times tests, services store createService tests.

</code_context>

<specifics>
## Specific Ideas

Owner field feedback (2026-09-18, v2.15 prod use): "every rehearsal must have a date"; the Times cluster
"belongs in its own tab after Messages". Default report time "is fine as-is".

</specifics>

<deferred>
## Deferred Ideas

- Org-level "default rehearsal day" (e.g. "the Thursday before") that could auto-create dated rows —
  v2 requirement in REQUIREMENTS.md.
- Rehearsal location / venue — carried v2 requirement.

</deferred>
