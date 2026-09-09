# Phase 133: Volunteer Responsibility Confirmation - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — owner-level decisions locked; codebase-specific "how" flagged for the phase-research pass

<domain>
## Phase Boundary

A worship-team volunteer can confirm ("I've got it") that they know they're responsible for an assignment
in a service; a planner sees live confirmation status on the roster and can nudge only the unconfirmed.
Requirements: R410 (two-state confirm + volunteer action), R411 (planner-visible live status), R412
(invalidate on reassignment/relock → "needs reconfirmation"), R413 (reminder nudges targeting only
unconfirmed, reusing v1.7 messaging).

Two-state ONLY (Unconfirmed default → Confirmed). NO Decline / replacement / blockout / deadline timers
(all deferred to backlog per the milestone scope decision).
</domain>

<decisions>
## Implementation Decisions (owner-level — locked)

### R410 — Two-state confirmation + volunteer "I've got it"
- **States:** `Unconfirmed` (default, implicit) → `Confirmed`. Optionally a distinct `NeedsReconfirmation`
  presentation (see R412) — but no Decline. A volunteer toggling confirms; un-confirming (back to
  Unconfirmed) is allowed (cheap, avoids a stuck state) unless research shows a reason not to.
- **Where the volunteer acts:** in the volunteer-facing surface they already use — the **My Schedule** card
  and/or the **VolunteerServiceView** for that service (v2.12/2.13). A per-assignment "I've got it" control
  next to the volunteer's role chip(s). A volunteer confirms **their own** assignment(s) only.

### R411 — Planner-visible live status
- On the service roster the planner already uses (the serving/roster view in the service editor and/or
  RosterView), show each assignment's status (Confirmed / Unconfirmed / NeedsReconfirmation), read **live**
  via `onSnapshot` (not a one-time fetch), matching the v2.13 live-volunteer-doc precedent.

### R412 — Invalidate on reassignment / relock
- Confirmation is keyed on **stable assignment identity** (the resolved (roleId, personId) pairing for the
  service — research to confirm the exact key; `roleAssignmentOverrides: Record<roleId, personId[]>` is the
  seed). When the underlying assignment changes — the person is removed/reassigned off that role, or an
  unlock→relock edit alters it — a prior `Confirmed` for that identity is invalidated to
  `NeedsReconfirmation` (or reverts to Unconfirmed with a "needs reconfirmation" affordance), never a stale
  checkmark. An assignment that is unchanged keeps its confirmation across unrelated roster edits.

### R413 — Reminder nudges, unconfirmed-only
- Reuse the existing **v1.7 volunteer-messaging** send path (MessageComposer + the server recipient
  resolver + queue-then-trigger send). Add a recipient-targeting mode that resolves to **only the people
  with unconfirmed (or needs-reconfirmation) assignments** for the service. This is a
  recipient-filter/query change, NOT a new send primitive. Respects the existing messaging kill-switch and
  the Resend test-mode caveat (real email only reaches the owner inbox until DNS verification, backlog
  999.6) — the nudge still works; delivery breadth is the standing follow-up.

### Claude's Discretion
- Exact UI treatment of the "I've got it" control and the roster status chip (colors/labels), matching the
  app's dark gray-950 language.
- Whether `NeedsReconfirmation` is a stored third state or derived (Confirmed-but-assignment-changed).
</decisions>

<code_context>
## Existing Code Insights (verified landmarks — research to deepen)

### Reusable Assets / Surfaces
- **Assignment model:** `roleAssignmentOverrides?: Record<string, string[]>` (roleId → personId[]) on the
  service type (`src/types/service.ts`); services also carry "resolved role assignments" used for staging.
- **Volunteer surfaces:** `src/views/MyScheduleView.vue`, `src/views/VolunteerServiceView.vue`,
  `src/stores/mySchedule.ts`, `src/stores/volunteerAuth.ts` (v2.12/2.13 passwordless scoped access).
- **Planner roster:** the serving/roster view in `ServiceEditorView.vue` and/or `RosterView.vue`.
- **Messaging (v1.7):** `src/components/MessageComposer.vue`, `ReLockNotifyPrompt.vue`, plus the server-side
  recipient resolver + `queueServiceMessage` (functions). Reuse for R413.

### Integration Points
- Confirmation state storage on/under the service doc; volunteer write path (scoped); planner live read;
  messaging recipient targeting.
</code_context>

<specifics>
## Specific Ideas / Research flags (MUST be resolved during the phase-research pass)

1. **SECURITY (load-bearing):** volunteers today have **scoped READ** via v2.12 `rehearseAccess`; confirming
   is a **scoped WRITE** to a service by a non-org-member volunteer — a NEW surface. The Firestore rules
   must let a volunteer write ONLY their own confirmation for a service they're actually assigned to, without
   broadening any other access, and without letting them touch the plan/order/roster. Reuse the
   `rehearseAccess`/`volunteerAuth` identity + scope model. This phase is **security-relevant** — expect a
   threat model + rules ALLOW/DENY tests. Do NOT let a confirmation write become a cross-tenant or
   plan-mutation vector (mind the v2.8 SEC-S-01 lesson).
2. **Exact stable assignment identity** — confirm the canonical key so R412 invalidation is precise
   (roleId+personId vs a serving-assignment id vs slot id).
3. **Where confirmation state lives** — a map on the service doc vs a `services/{id}/confirmations/*`
   subcollection; pick the shape that supports live planner read + scoped volunteer write + clean
   invalidation, and that fits the existing retention/rules model.
4. **Reassignment/relock detection hook** — where roster changes and the unlock→relock cycle are handled, so
   invalidation fires at the right point.
5. **Recipient targeting for unconfirmed-only** — how the existing resolver enumerates a service's assigned
   people, to filter to unconfirmed.
</specifics>

<deferred>
## Deferred Ideas

Decline / replacement self-swap, blockout dates, confirmation deadline / auto-decline timers — all out of
scope (milestone backlog). Two-state only.
</deferred>
