# Phase 139: Rehearsal & Report Times - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Give services real **rehearsal** and **report** times and surface them everywhere the service date already
appears. Delivers R429–R433:
- Org-level defaults (default report time + default rehearsal time(s)) on the organization settings page.
- Per-service model: multiple **dated** rehearsals (each date + time) + one day-of report time, editable in
  the service editor; pre-filled by copying the org defaults at creation.
- Display of those times alongside the date on the dashboard, My Schedule, the volunteer service view, and
  the public share/plan views — threaded through both hand-maintained public projections.

Out of boundary: venue/location field (deferred → v2 LOC-01); per-team/per-role time scoping; ICS export;
dedicated `{{report_time}}`/`{{rehearsal_dates}}` merge tokens; anything Vamps (140/141) or church-picker/
email (138, done).
</domain>

<decisions>
## Implementation Decisions

### Data Model & Defaults
- **Service fields (additive, optional):** `rehearsals: { date: string /* YYYY-MM-DD */, time: string /* HH:mm */ }[]`
  and `reportTime: string /* HH:mm */`. **Plain strings, never `Timestamp`/`Date`** — matches `Service.date`'s
  existing convention and avoids timezone rebinding against the org's IANA `timezone`.
- **OrgSettings defaults (additive):** `rehearsalTimeDefaults: string[]` (each `HH:mm`, time-of-day only) and
  `reportTimeDefault: string` (`HH:mm`). Add to `DEFAULT_ORG_SETTINGS`; merge in `applyOrgSnapshot` if nested;
  write via `updateOrgSettings`.
- **New-service pre-fill = COPY, never live-bind:** on service creation, seed one rehearsal row per
  `rehearsalTimeDefaults` entry (time filled, **date blank** for the planner to set) and set `reportTime` from
  `reportTimeDefault`. Editing an org default afterward **never** mutates an already-created service.
- **Ordering:** rehearsals always display chronologically (by date then time) via a single shared
  `sortRehearsals` utility — never trust storage/array order.

### Editor UI & Display
- **Per-rehearsal fields = date + time only.** Native `<input type="date">` + `<input type="time">`. No
  label/venue field this milestone (deferred).
- **Editor placement:** a "Times" subsection in `ServiceEditorView` near the service date/header — add / edit /
  remove multiple rehearsals + a single report-time input. (Closes the pre-existing
  `ScheduleServiceCard.vue:40-41` "Service has no time-of-day/venue field yet" TODO.)
- **Settings placement:** a "Rehearsal & Report Defaults" section in `SettingsView.vue`, mirroring the
  existing messaging-defaults card pattern.
- **Display:** literal wall-clock, **12-hour** (e.g. "Report 8:00 AM · Rehearsal Thu Sep 11, 7:00 PM"),
  **never zone-shifted per viewer** (single physical venue). Shown on dashboard, `ServiceCard`,
  `ScheduleServiceCard`, `ShareView`, and the volunteer service view.
- **Projection threading (load-bearing):** the new fields MUST be added to BOTH hand-maintained projection
  builders — `buildServiceSnapshot` (`src/utils/serviceProjection.ts`) and `buildRehearseAccess`
  (`src/utils/rehearseAccess.ts`) — or volunteer/share surfaces silently show nothing. A projection test
  (mirroring `services.sharePii.test.ts`) must assert the new fields appear in both.

### Claude's Discretion
- Exact field/section labels and layout details; the shared time-format helper's location/name; whether a
  rehearsal with a blank date is hidden from public/volunteer display until dated (reasonable default: hide
  undated rehearsals from read-only surfaces, show them only in the editor).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets / Integration Points
- Types: `src/types/service.ts` (`Service`, currently `date` only), `src/types/organization.ts`
  (`OrgSettings` + `DEFAULT_ORG_SETTINGS`, has `timezone`).
- Stores: `src/stores/services.ts` (`createService` pre-fill call site; `ServiceSnapshot`/`buildServiceSnapshot`),
  `src/stores/auth.ts` (`applyOrgSnapshot` deep-merge, `updateOrgSettings`).
- Projections: `src/utils/serviceProjection.ts` (`buildServiceSnapshot`), `src/utils/rehearseAccess.ts`
  (`buildRehearseAccess`) — BOTH hand-maintained allowlists.
- Views/components: `src/views/ServiceEditorView.vue` (Times subsection), `src/views/SettingsView.vue`
  (defaults section), dashboard, `src/components/ServiceCard.vue`, `src/components/ScheduleServiceCard.vue`
  (has the TODO this closes), `src/views/ShareView.vue`, the volunteer service view (v2.12/2.13).
- Date idiom: pure `Intl`/`Date` string handling (`todayInTimeZone`, `parsedDate`) — no date library; do not add one.

### Established Patterns
- `Service.date` is a bare `YYYY-MM-DD` string throughout; time fields mirror this as `HH:mm` strings.
- Org settings defaults flow: `DEFAULT_ORG_SETTINGS` → `applyOrgSnapshot` merge → `updateOrgSettings` write.
</code_context>

<specifics>
## Specific Ideas
- Firestore rules: the new fields are additive on existing `services` / `organizations` docs already covered
  by current rules — confirm no rule change needed (no new collection/path).
- Add the shared `sortRehearsals` util with a unit test; a projection test asserting both builders carry the
  new fields; and a copy-not-live-bind test (org-default change doesn't alter an existing service).
</specifics>

<deferred>
## Deferred Ideas
- Rehearsal/service **venue/location** field (v2 LOC-01).
- Optional per-rehearsal **label** ("Full band" vs "Tech only").
- `{{report_time}}` / `{{rehearsal_dates}}` merge tokens (v2 TIME-EXTRA-03); ICS export; per-role time scoping.
</deferred>
