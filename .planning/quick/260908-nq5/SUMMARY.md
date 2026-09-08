---
quick_id: 260908-nq5
slug: confirm-decline-my-schedule
status: complete
date: 2026-09-08
commit: 812c4da7
---

# Summary: Confirm/Decline on My Schedule + a Decline state

**Status: complete ✓** — committed `812c4da7`. Type-check clean; targeted suites
green (VolunteerConfirmBar, MyScheduleView, unconfirmedAssignments,
useUnconfirmedVolunteers, ServiceEditorView.confirmations, VolunteerServiceView);
Firestore rules suite's confirmation block 17/17 against the live emulator.

## What shipped

- **Moved** the volunteer confirmation control off the volunteer service page
  (`VolunteerServiceView`) onto **My Schedule**, next to each service's Rehearse
  button.
- **Card refactor**: `ScheduleServiceCard` is no longer a whole-surface link —
  "Rehearse →"/"Open service" is a real `router-link` button
  (`data-testid="rehearse-link"`), and the Confirm/Decline buttons sit in a new
  `#actions` slot to its LEFT (Zone 3 widened to `sm:w-auto` + `sm:flex-nowrap`
  so they don't wrap above it).
- **Confirm / Decline** (`VolunteerConfirmBar` reworked): a compact pair acting on
  the volunteer's WHOLE responsibility for the service (worst-of aggregate).
  Confirm writes `status:'confirmed'`; Decline writes `status:'declined'`
  (`confirmedAt:null`); clicking the already-active button undoes it (delete →
  implicit unconfirmed).
- **Decline state end-to-end**: `ConfirmationStatus` gains `'declined'`;
  `firestore.rules` volunteer-arm pin relaxed to `status in ['confirmed','declined']`
  (`needsReconfirmation` stays editor-only); planner + dashboard chip maps gain a
  red **Declined** chip; `unconfirmedAssignments` surfaces declined rows (each row
  now carries its own `status`).
- **Dashboard row label**: the Unconfirmed-volunteers rows identify the service by
  **full date** ("Sunday, September 7", `formatServiceDateLong`) instead of the
  sometimes-blank service name.

## Owner decisions (2026-09-08)

- Decline = just the state (no reason). · Whole-service granularity. · De-link the
  card so Rehearse is a dedicated button with Confirm/Decline to its left.

## Tests

- `VolunteerConfirmBar.test.ts` — rewritten for the Confirm/Decline UI (confirm
  payload, decline payload with `confirmedAt:null`, whole-service batch, pressed
  states + undo-on-active-click, reconfirm hint).
- `MyScheduleView.test.ts` — href now asserted on `rehearse-link`; VolunteerConfirmBar
  stubbed (owns a live listener).
- `unconfirmedAssignments.test.ts` — rows carry `status`; +declined case.
- `rules.test.ts` — (1b) ALLOW volunteer writes 'declined'; (1c) DENY volunteer
  writes 'needsReconfirmation'.

## Non-goals

- No decline reason field, no per-role granularity, no leader email notification
  (dashboard is the channel). Relock reconciliation logic unchanged.
