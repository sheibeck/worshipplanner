# 0245. Rehearsals are always dated; org-default times pre-fill the add form

## Status

Accepted

## Context

v2.15 Phase 139 (R430/R432) seeded one undated rehearsal row per org default time at `createService`. Owner field feedback (2026-09-18): "every rehearsal must have a date", and the Times controls belong in their own tab after Messages. Backlog 999.6 was promoted as Phase 143 (R441-R445).

## Decision

- **(a) Dated on submit only.** A rehearsal row is created only by the Times-tab add form on submit with BOTH a date and a time. The date is always picked by the planner and never defaulted from the service date (that default was rejected because it guesses).
- **(b) No seeding at creation.** `createService` writes `rehearsals: []`. The org default rehearsal time(s) only pre-fill the add form's time (the first default; chips when more than one). `reportTimeDefault` is still copied onto the service at creation (copy-not-live-bind: changing an org default never alters an existing service).
- **(c) Reject-clear.** Clearing an existing row's date or time is rejected and the native input is forced back (Vue does not repaint an unchanged one-way binding); the parent handlers re-enforce the same invariant as defense in depth. Remove is the only delete.
- **(d) No migration.** Legacy v2.15 undated/untimed rows stay stored as-is, are flagged "Needs a date"/"Needs a time" in the editor, and stay hidden on every read-only surface through the unchanged `isDisplayableRehearsal` filter in both projections (`buildServiceSnapshot`, `buildRehearseAccess`).
- **(e) Panel ordering.** The panel lists non-displayable legacy rows first, then dated rows via the unchanged `sortRehearsals` (which keeps undated-last because both projections depend on it).
- **(f) Times tab.** Visible to every role like Slides, editable only when `canEditService`; `buildActionBarItems` returns `[]` for it (its early-return chain would otherwise fall through to the Service Order items).

## Consequences

Projections and display surfaces are unchanged and pinned by R445 regression tests. Firestore rules still do not validate rehearsal fields (client invariant plus read-surface filter is the boundary; pre-existing). A backspaced single segment in a native date/time input may fire change with '' and snap back (accepted; batched UAT). Reversing (a)-(d) without re-reading this ADR reopens the undated-row leak class.

## Source comments

- `src/stores/services.ts` (createService)
- `src/views/SettingsView.vue` (Rehearsal & Report Defaults card)
- `src/types/organization.ts` (rehearsalTimeDefaults)
- `src/components/ServiceTimesPanel.vue` (header)
- `src/views/ServiceEditorView.vue` (Times tab handlers)
- `src/views/serviceEditorActionBar.ts` (times branch)
