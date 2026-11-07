# Spec: Default rehearsal day and time

**Code:** RHD
**Status:** Active
**Last changed:** 2026-11-07

## Purpose

Most churches rehearse on the same weekday every week. This feature lets an editor set that weekday once, in Settings, so every new service starts with its rehearsal already on it, and planners only step in for the weeks that differ. Existing services are left alone, and read-only views show nothing new.

## Behavior

An editor picks one default rehearsal day, or None, in the Rehearsal & Report Defaults card. With a default day and at least one default time set, a new service starts with one rehearsal on the most recent default day on or before the service date, at the first default time. When the service falls on the default day, the rehearsal is that same day. Without both, a new service starts with no rehearsal.

The defaults apply when a service is created, and only then. Changing them later does not touch existing services, and there is no data migration.

A rehearsal added this way carries an internal auto-added marker. While it does, changing the service's date moves it to the most recent day with its own weekday on or before the new date, at its own time, even if the Settings default has changed since. Editing its date or time ends this for good, even if the value is set back by hand. Undo is different: it means the edit never happened, so it restores the rehearsal as it was, auto-moving included. Removing it is final: nothing adds it back.

A changed service date is saved with the service. The regular share link keeps working and shows the new date. The public page for the old date is removed, so a link already sent with that date stops working. That removal never fails the save. If a second service shares that date, it has no date page until its next save, and its regular share link is unaffected.

The add-rehearsal form fills in the default date for the service's current date, using the current Settings day, unless the service already has a rehearsal on that date. Nothing extra is stored on the service. A date the planner has typed or cleared stands until they add the rehearsal.

The marker is internal. In the Times tab an auto-added rehearsal looks like any other, for every role, and the marker never appears on a share link or another read-only view.

## Acceptance criteria

<!-- An ID is literal text, so adding, removing or reordering criteria never changes another ID. Gaps are fine. -->

### Settings

- **AC-RHD-01** - In the "Rehearsal & Report Defaults" card the "Default rehearsal day" select lists None, then Sunday to Saturday, and shows the saved day, or None when the church has none. (R459)
- **AC-RHD-02** - "Save defaults" saves the chosen day with the card's other defaults, as 0 (Sunday) to 6 (Saturday), or null for None. (R459)
- **AC-RHD-03** - Choosing a day saves nothing until "Save defaults" is pressed. (R459)
- **AC-RHD-69** - After a save, typing in the default time fields changes nothing in the church's settings until "Save defaults" is pressed. (R459)
- **AC-RHD-04** - When the save fails, the previous day is restored with the other defaults and the card's existing error line shows. (R459)
- **AC-RHD-05** - For a user who is not an editor the select is disabled and "Save defaults" is not shown. (R459)
- **AC-RHD-70** - For a user who is not an editor, the card's select and time fields look disabled: dimmed, with a not-allowed cursor. (R459)
- **AC-RHD-06** - A church's saved default day is still there after the organization reloads. (R459)
- **AC-RHD-07** - A church with no saved default day reads as None. (R459)
- **AC-RHD-67** - After an in-place switch to another church, the card shows that church's saved default day, default times and report time, and "Save defaults" writes those values, not the previous church's. (R459)
- **AC-RHD-08** - The card's help text reads "New services start with one rehearsal on the default day at the first default time. The report time is copied onto every new service. Changing these defaults doesn't affect existing services." (R463)
- **AC-RHD-09** - Saving the defaults changes only the organization's settings and writes to no service. (R463)
- **AC-RHD-10** - Changing the default day leaves a service created earlier with the rehearsals it already has. (R463)
- **AC-RHD-11** - Opening or saving a service that has no rehearsals never adds one, whatever the Settings default day and time are. (R463)

### The default date

- **AC-RHD-12** - The default rehearsal date for a service date and a weekday is the most recent day with that weekday on or before the service date. (R460)
- **AC-RHD-13** - When the service date falls on that weekday, the default rehearsal date is the service date. (R460)
- **AC-RHD-14** - The default rehearsal date is correct across month ends, year ends and a leap day. (R460)
- **AC-RHD-15** - The default rehearsal date is the same on a computer set to UTC-11, UTC or UTC+14. (R460)
- **AC-RHD-16** - A service date that is not a real YYYY-MM-DD date, or a weekday that is not a whole number from 0 to 6, gives no default rehearsal date. (R460)

### New services

- **AC-RHD-17** - With Wednesday as the default day and 6:30 PM as the first default time, a new Sunday service (2026-11-08) starts with one rehearsal on Wednesday 2026-11-04 at 18:30. (R460)
- **AC-RHD-18** - With the same defaults, a new Wednesday service (2026-11-04) starts with one rehearsal that same day at 18:30. (R460)
- **AC-RHD-19** - When there are several default times, the rehearsal uses the first, in the order they are stored. (R460)
- **AC-RHD-20** - A rehearsal whose date is already in the past is still added. (R460)
- **AC-RHD-21** - The same service date gets the same rehearsal date on a computer set to UTC-11, UTC or UTC+14. (R460)
- **AC-RHD-22** - When no default day is set, a new service starts with no rehearsal. (R461)
- **AC-RHD-23** - When a default day is set but no default time, a new service starts with no rehearsal. (R461)
- **AC-RHD-24** - A new service whose date is not a real date is still created, with no rehearsal. (R461)
- **AC-RHD-66** - When the first default time is blank or not in HH:mm form, a new service starts with no rehearsal. (R461)

### Moving a service

- **AC-RHD-25** - The rehearsal added at creation carries the auto-added marker. (R462)
- **AC-RHD-26** - A rehearsal added from the Times tab form never carries the marker. (R462)
- **AC-RHD-27** - Changing the service date moves a rehearsal that is still auto-added to the most recent day with the rehearsal's own weekday on or before the new service date, and keeps its time. (R462)
- **AC-RHD-28** - A moved rehearsal keeps its own weekday after the Settings default day has changed. (R462)
- **AC-RHD-29** - Editing an auto-added rehearsal's date or time ends auto-moving for good, even when it is set back to the old value. (R462)
- **AC-RHD-30** - A rejected edit (a cleared or malformed date or time) does not end auto-moving. (R462)
- **AC-RHD-31** - A rehearsal without the marker stays where it is when the service date changes. (R462)
- **AC-RHD-32** - When an auto-added rehearsal has been removed, changing the service date adds nothing back. (R462)
- **AC-RHD-33** - When a moved rehearsal lands on the same date and time as another rehearsal, the moved one is dropped and the other stays, so one row remains. (R462)
- **AC-RHD-34** - When a moved rehearsal lands on the same date at a different time, both rows remain. (R462)
- **AC-RHD-36** - On a service that cannot be edited, changing the date changes nothing. (R462)

### Saving a date change

- **AC-RHD-35** - A service date that is cleared, not a real date or past the year 9999 is not applied and moves no rehearsal. (R462)
- **AC-RHD-37** - A changed service date is saved with the service. (R462)
- **AC-RHD-38** - The new service date and the moved rehearsal are saved in the same write. (R462)
- **AC-RHD-39** - The auto-added marker is still on the rehearsal after the service is opened and saved again. (R462)
- **AC-RHD-63** - After a date change is saved the service shows as saved, and no second save follows. (R462)
- **AC-RHD-64** - Undoing a saved date change restores the service date and its rehearsals together, in one save. (R462)
- **AC-RHD-65** - Undoing a save that edited an auto-added rehearsal restores the rehearsal as it was, auto-moving included. (R462)

### The old date's public page

- **AC-RHD-56** - When a service's date changes, its public page for the old date (`serviceShares/{slug}__service-{oldDate}`) is removed, so a link already sent with that date stops working. (R462)
- **AC-RHD-57** - The regular share link (the token) keeps working after a date change and shows the new date. (R462)
- **AC-RHD-58** - The old page is removed only once the new date's page exists. If the new page could not be written, the old page stays. (R462)
- **AC-RHD-59** - A failed removal does not fail the save. (R462)
- **AC-RHD-60** - A save that does not change the date, because it carries the same date or no date, reads and removes no public page. (R462)
- **AC-RHD-61** - A page on the old date that does not record this service as its owner stays in place. (R462)
- **AC-RHD-62** - When the service itself fails to save, no public page is removed. (R462)
- **AC-RHD-68** - When two services share a date and the one recorded on the public page moves, that page is removed, the other service has no date page until its next save writes one, and its regular share link keeps working. (R462)

### The add-rehearsal form

- **AC-RHD-40** - When a default day is set, the service has a real date and no rehearsal falls on the default date, the add form's Date is filled with the default date. (R464)
- **AC-RHD-41** - When the service already has a rehearsal on the default date, the add form's Date is blank. (R464)
- **AC-RHD-42** - When no default day is set, or the service has no real date, the add form's Date is blank. (R464)
- **AC-RHD-43** - When a default day is set but no default time, the Date is filled and the Time stays blank, and Add stays off until a time is entered. (R464)
- **AC-RHD-71** - While the Date holds a real date and the Time is blank, the Time field has the amber border the Times tab uses for a missing value. It returns to the normal border once a time is entered, and it is never amber while the Date is blank. (R464)
- **AC-RHD-44** - A date the planner has typed or cleared stays until they add the rehearsal. (R464)
- **AC-RHD-45** - A date the planner has not touched follows the service date and the Settings day as they change. (R464)
- **AC-RHD-46** - After "Add rehearsal" the Date returns to the default date, or to blank when that date now holds the rehearsal just added. (R464)
- **AC-RHD-47** - Pre-filling the Date adds no rehearsal until "Add rehearsal" is pressed. (R464)
- **AC-RHD-48** - The Date field shows no note about a default. (R464)

### Read-only views

- **AC-RHD-49** - The rehearsals in the public share snapshot (`buildServiceSnapshot`, then `toPublicServiceSnapshot`) have exactly id, date and time. (R465)
- **AC-RHD-50** - The rehearsals in the volunteer rehearse projection (`buildRehearseAccess`) have exactly id, date and time. (R465)
- **AC-RHD-51** - The share-link documents written when a service is created (`shareTokens`, `serviceShares`) carry no marker. (R465)
- **AC-RHD-52** - The share-link documents rewritten after an edit carry no marker. (R465)
- **AC-RHD-53** - In the Times tab an auto-added rehearsal looks like any other, for editors and for viewers. (R465)
- **AC-RHD-54** - The service cards and the dashboard show an auto-added rehearsal like any other. (R465)
- **AC-RHD-55** - ADR-0249 supersedes the reversed parts of ADR-0245, and ADR-0245 and the ADR index point to it. (R465)

## Edge cases

- The service falls on the default day: the rehearsal is that same day (AC-RHD-13, AC-RHD-18).
- The rehearsal date is already in the past: it is still added, and a planner can remove it (AC-RHD-20).
- A default day with no default time: no rehearsal is added, and the add form still fills the date, with the blank Time marked as missing (AC-RHD-23, AC-RHD-43, AC-RHD-71).
- The first default time is blank or malformed: no rehearsal is added (AC-RHD-66).
- The service date is not a real date: nothing is worked out from it (AC-RHD-16, AC-RHD-24, AC-RHD-35, AC-RHD-42).
- Several default times: the first in stored order is used (AC-RHD-19).
- A computer in any timezone: the dates do not change (AC-RHD-15, AC-RHD-21).
- A moved rehearsal lands on another one: same time keeps one row, a different time keeps both (AC-RHD-33, AC-RHD-34).
- The planner removed the auto-added rehearsal: nothing re-adds it (AC-RHD-32).
- The planner edited it, then set it back: it still stays put (AC-RHD-29).
- An edit was rejected: auto-moving continues (AC-RHD-30).
- The Settings day changed after creation: the rehearsal keeps its own weekday (AC-RHD-28).
- The service already has a rehearsal on the default date: the add form's date stays blank (AC-RHD-41, AC-RHD-46).
- A viewer, or a locked service: nothing changes, and a viewer's Settings controls look disabled (AC-RHD-05, AC-RHD-36, AC-RHD-70).
- Another service owns the page on the old date: it stays (AC-RHD-61).
- Two services share a date and the one on the page moves: the other has no date page until its next save, and its regular share link is unaffected (AC-RHD-68).
- The new page could not be written: the old page stays (AC-RHD-58).
- The removal fails, or the service save fails: the removal never fails a save, and a failed save removes nothing (AC-RHD-59, AC-RHD-62).
- A save that only reorders slots or carries the same date: no public page is touched (AC-RHD-60).
- Undo after a date change: the date and rehearsals return together, including auto-moving (AC-RHD-64, AC-RHD-65).

## Out of scope

- The Planning Center export's hard-coded Wednesday rehearsal.
- Several default rehearsal days. A second rehearsal is picked by hand.
- A visible marker on an auto-added rehearsal, for any role.
- Any migration of existing services, or any change to them when Settings change.
- Role overrides keyed by date. They already follow the service's date, so a moved service picks up the new date's overrides with no change here.
- Two services on one date sharing one memorable page (ADR-0163). That stays as it is.

## Retired criteria

<!-- A removed criterion moves here and its number is never reused. Tests must stop citing it. -->

## Tests

Cite a criterion by putting its ID in a test title. A comment does not count:

    it('adds it on the prior Wednesday (AC-RHD-17)', () => { ... })

A test that is skipped, `todo`, `fails`, conditional (`skipIf`, `runIf`), switched off by an options object, missing its
function or empty (only `;`, a bare `return` or `undefined`) does not count either, nor does any test in a file with
`.only`, nor a `describe` title with no counted test under it.

`src/__tests__/specCoverage.test.ts` fails if a criterion has no citing test, or if a line under Acceptance criteria is
not a criterion. That proves a test title cites the criterion, not that the test ran or asserts anything, and it cannot
see a test inside `if (false)` or a function nobody calls. Criteria for security rules are cited from `src/rules.test.ts`
or `src/storage.rules.test.ts`, which a bare `npx vitest run` does not prove, so those also need `npm run test:rules`.
Criteria cited from `render-service/src` need `cd render-service && npm test`, which a bare run does not run either.

## ADRs

- ADR-0249 (docs/adr/0249-new-services-start-with-a-default-rehearsal.md)
- ADR-0245 (docs/adr/0245-rehearsals-are-always-dated-defaults-prefill-the-add-form.md)
- ADR-0248 (docs/adr/0248-feature-specs-are-the-source-of-truth-tests-cite-criteria-in-titles.md)
- ADR-0163 (docs/adr/0163-this-doc-is-keyed-purely-by-slug-date-and-the-app-enforces-n.md)
