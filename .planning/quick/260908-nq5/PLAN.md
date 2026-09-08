---
quick_id: 260908-nq5
slug: confirm-decline-my-schedule
status: in-progress
date: 2026-09-08
---

# Quick task: Confirm/Decline on My Schedule + a Decline state

## Description

Move the volunteer service-confirmation control off the volunteer service page and
onto **My Schedule**, next to each service's Rehearse button, and add a **Decline**
option alongside Confirm. Decline is a distinct persisted state a leader sees on the
service dashboard.

## Owner decisions (2026-09-08)

- **Decline = just the state** (no reason). Red "Declined" chip on the dashboard.
- **Whole-service** granularity — one Confirm and one Decline that set the state for
  ALL of the volunteer's roles on the service at once (matches today's aggregate).
- **Card refactor**: the whole My Schedule card is NO LONGER a link. "Rehearse →"
  becomes a real button/link you click specifically; Confirm/Decline are real
  buttons to its LEFT.

## Changes

Data model / rules:
- `src/utils/confirmations.ts` — `ConfirmationStatus` gains `'declined'`.
- `firestore.rules` — volunteer-arm write pin `status == 'confirmed'` →
  `status in ['confirmed','declined']` (needsReconfirmation stays editor-only).
- `src/rules.test.ts` — allow-declined test; keep needsReconfirmation-denied.

Dashboard surfacing:
- `src/utils/unconfirmedAssignments.ts` — surface `'declined'` too (attention feed).
- `src/views/DashboardView.vue` — add a red `declined` chip (class + label).
- `src/views/ServiceEditorView.vue` — planner chip maps gain `declined`.

Control + wiring:
- `src/components/rehearse/VolunteerConfirmBar.vue` — rework to a compact
  Confirm/Decline pair; add `declineAll()` (status 'declined', confirmedAt null);
  aggregate state gains 'declined'; clicking the active button undoes (delete).
- `src/components/ScheduleServiceCard.vue` — de-link the card: root is a `<div>`;
  "Rehearse →"/"Open service" becomes a real `<router-link>` button
  (`data-testid="rehearse-link"`); add an `#actions` slot to its LEFT.
- `src/views/MyScheduleView.vue` — pass VolunteerConfirmBar into `#actions` for
  upcoming cards only, using `doc.orgId` + `doc.roleAssignmentsByEmailLower[myEmail]`.
- `src/views/VolunteerServiceView.vue` — remove the confirm bar.

Tests: VolunteerConfirmBar, ScheduleServiceCard/MyScheduleView (href now on the
rehearse-link, not the card root), unconfirmedAssignments, useUnconfirmedVolunteers,
DashboardView, ServiceEditorView.confirmations, VolunteerServiceView (bar gone),
rules.

## Non-goals

- No decline reason field. No per-role granularity. No leader email notification
  (dashboard is the channel). Relock reconciliation logic unchanged.
