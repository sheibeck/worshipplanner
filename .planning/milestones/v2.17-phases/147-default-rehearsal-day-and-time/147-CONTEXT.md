# Phase 147: Default Rehearsal Day and Time - Context

**Gathered:** 2026-11-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A church sets one default rehearsal weekday in Settings, and every new service starts with its rehearsal on it, on
the most recent default weekday on or before the service date, at the first default time. Moving a service moves an
auto-added rehearsal nobody has changed. The add-rehearsal form fills in the default date when the service has no
rehearsal there. Existing services stay as they are, and read-only views show nothing new.

This is the pilot for the Phase 146 standard, so `docs/specs/default-rehearsal.md` is committed before any test or
code for this phase.

</domain>

<decisions>
## Implementation Decisions

### Decided earlier (owner, 2026-11-06; do not reopen)
- One default weekday, not several. When the service falls on that weekday, the rehearsal is the same day.
- New services get the rehearsal automatically. This reverses parts of ADR-0245 (a) and (b).
- "Admin" in R459 means the existing editor gate.
- Defaults apply at creation only; there's no data migration.
- The Planning Center export's hard-coded Wednesday rehearsal is out of scope.

### Spec-first order
- **Spec file:** `docs/specs/default-rehearsal.md`, code `RHD`, so IDs read `AC-RHD-01`. Each of R459-R465 traces to
  at least one numbered criterion, using the `(R460)` suffix.
- **Git history:** the spec commit comes ahead of every test and code commit for this phase. This is success
  criterion 1, so a dedicated first plan or task should land only the spec.
- **Red window:** a bare `npx vitest run` fails on purpose from the spec commit until tests cite every criterion,
  with `src/__tests__/specCoverage.test.ts` naming each uncited ID. Nothing may quiet it with an empty test or an
  exclusion. It must be green by the end of the phase.
- **Test-first:** stores and utilities get a failing test first. UI layout tests may land with the code but must cite
  the spec's criteria.

### Moving a service
- **A removed auto-added rehearsal stays gone.** Only a rehearsal still on the service moves, and nothing re-adds one.
- **Landing on an existing rehearsal:** same date and same time keeps one row, with no duplicate. Same date and a
  different time keeps both.
- **"Changed":** editing the date or time of an auto-added rehearsal ends auto-moving for good, even if it's set back
  to the old value. There's no comparison with the original.
- **A rehearsal date in the past is still added.** R460 has no exception, and a planner can remove it.
- From R462: a moved rehearsal keeps its own weekday and time, even if the Settings default has changed since.

### Saving a date change (owner, 2026-11-06, added after research)
- **Today's bug:** changing a service's date in the editor looks like it works, but `onSave` never sends `date`, so it
  reverts on reload. R462 can't work until that's fixed, so the fix is in this phase's scope. Add `date` to the `onSave`
  payload and to the post-save mirror comparison, at the same position, or `isDirty` never clears.
- **Retire the old public page:** when a service's date changes, remove `serviceShares/{slug}__service-{oldDate}`. A
  link already sent with the old date stops working, and the regular share link (the token) keeps working and stays
  current. This overrides RESEARCH.md's suggestion to accept the stale page; don't record it as an accepted residual.
- **Soft failure:** a failed removal must not fail the save, matching how the other share writes behave.
- **Two services on one date:** the public date page records only one of them. If that service moves, its page is
  removed, and the other service has no date page until its next save rewrites it. Its token link is unaffected. The
  owner accepts this; a spec criterion and a test record it.
- **Undo:** the editor's Undo restores the whole service, including the auto-added marker, so undoing an edit restores
  auto-moving. Undo means the edit never happened. The "ends auto-moving for good" rule covers setting a value back by
  hand. No extra code in `onUndo`.
- **Role overrides keyed by date** now follow the service's new date. That's correct and needs no change.
- The spec must have criteria for the date being saved and for the old page being removed.

### The add-rehearsal form
- **Weekday set, no default time:** the date still fills in and the time stays blank. R461 only stops the auto-add.
- **Which weekday:** the current Settings weekday, worked out from the service's current date. Nothing extra is stored
  on the service. Only an auto-added rehearsal keeps its own weekday.
- **Planner edits stand** until they add the rehearsal. If they haven't touched the date, it follows the service. This
  matches how the time field already works (`newTimeOverride`).
- **No note** says the date came from a default.
- From R464: if the service already has a rehearsal on the default date, the date stays blank. So adding that
  rehearsal leaves the date blank for the next one.

### Settings and what planners see
- **Control:** a "Default rehearsal day" dropdown (None, then Sunday to Saturday) in the existing Rehearsal & Report
  Defaults card, saved by that card's Save button. It's editor-gated like the rest of the card.
- **Help text:** "New services start with one rehearsal on the default day at the first default time. The report time
  is copied onto every new service. Changing these defaults doesn't affect existing services." This replaces the
  current text, so `src/views/__tests__/SettingsView.test.ts:367` changes on purpose.
- **No visible marker:** in the Times tab an auto-added rehearsal looks like any other rehearsal, for every role.

### ADR
- A new ADR-0249 supersedes ADR-0245 (b) and the parts of (a) this reverses: "created only by the Times-tab add form"
  and "always picked by the planner". (c)-(f) stand. Update ADR-0245's status and the `docs/adr/README.md` row.

### Claude's Discretion
- How the marker is stored (a flag on the rehearsal row is what the roadmap assumes) and its name.
- How the weekday is stored in `OrgSettings` (number or name), as long as "none" is distinct and old orgs with no value
  read as none.
- The pure helper names and where they sit, likely `src/utils/rehearsalTimes.ts`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/rehearsalTimes.ts`: `Rehearsal`, `YMD_RE`, `HM_RE`, `sortRehearsals`, `isDisplayableRehearsal`. It's
  dependency-free so both projections can import it.
- `src/components/ServiceTimesPanel.vue`: already takes `serviceDate` and `defaultTimes`. `newTime` is a computed over
  `newTimeOverride`, the pattern to copy for the date. `newDate` is a plain ref today, reset after submit.
- `src/views/SettingsView.vue`: `onSaveRehearsalDefaults` writes through `authStore.updateOrgSettings` with
  `settings.`-prefixed keys and rolls back on error.

### Established Patterns
- `createService` in `src/stores/services.ts:456` is the single creation path (one caller, `ServicesView.vue:431`). It
  reads `useAuthStore().settings` and writes `rehearsals: []`.
- Service dates are plain `YYYY-MM-DD` strings. The weekday maths must not depend on the computer's timezone (R460),
  so don't parse with a local-time `new Date('YYYY-MM-DD')`. See ADR-0009.
- Rehearsal rows are plain `date` + `time` strings, never `Timestamp`.
- Editor handlers re-check `canEditService` first (R036). `onDateChange` in `ServiceEditorView.vue:2749` only sets
  `localService.value.date` and returns early on an empty date; autosave persists the whole `rehearsals` array.
- `onRehearsalDateChange` and `onRehearsalTimeChange` (`ServiceEditorView.vue:2780`, `:2789`) are where a change must
  clear the marker.

### Integration Points
- **The marker leaks by default.** `buildServiceSnapshot` (`src/stores/services.ts:205`) and `buildRehearseAccess`
  (`src/utils/rehearseAccess.ts:281`) pass whole rows through `sortRehearsals`, which keeps every field, and
  `createService` mints the share link in the same call. Both must narrow rows to `{ id, date, time }`, with tests on
  the payloads they produce.
- `ServiceEditorView.vue:4791` and `:4826` copy `rehearsals` when loading and saving, so the marker must survive those.
- `src/types/organization.ts`: `OrgSettings` and its defaults (`rehearsalTimeDefaults: []` at line 185). Check how
  settings are read and merged so the new field survives a reload.
- `src/types/service.ts:282`: the inline row type needs the marker.
- `firestore.rules` and `functions/src` don't mention `rehearsals`, so neither needs a change for the rows. Confirm
  that settings writes aren't field-restricted.
- `src/stores/__tests__/services.rehearsalDefaults.test.ts` tests `rehearsals` equal to `[]` with no weekday set, which
  stays true under R461. `src/stores/__tests__/services.rehearsalProjection.test.ts` is the projection test home.

</code_context>

<specifics>
## Specific Ideas

- Worked example from the roadmap: with Wednesday set and 6:30 PM as the first default time, a new Sunday service
  starts with one rehearsal on the Wednesday before at 6:30 PM, and a new Wednesday service starts with one that same
  day, with the same date in any computer's timezone.

</specifics>

<deferred>
## Deferred Ideas

- Planning Center export using real rehearsals (already a v2 requirement).
- Several default rehearsal days (out of scope; a second rehearsal is picked by hand).

</deferred>
