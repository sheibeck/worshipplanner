---
phase: 135-dashboard-overhaul
plan: 02
subsystem: ui
tags: [vue, firestore, onSnapshot, confirmations, dashboard]

# Dependency graph
requires:
  - phase: 133-volunteer-confirmation
    provides: "confirmations subcollection + roleAssignmentsByEmailLower/roleIdsByEmailLower projection on rehearseAccess docs, ConfirmationStatus/confirmationKey vocabulary"
  - phase: 135-01
    provides: "restructured single-column DashboardView.vue feed branch (v-else) this plan adds the attention card inside"
provides:
  - "unconfirmedAssignments pure diff util (roleAssignmentsByEmailLower vs confirmationStatuses)"
  - "useUnconfirmedVolunteers composable — bounded <=6-service dual-listener (rehearseAccess doc + confirmations subcollection) read-only fan-out"
  - "Unconfirmed volunteers attention card in DashboardView.vue (R417)"
affects: [135-03, dashboard-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded N-service fan-out composable: per-serviceId dual onSnapshot listeners, reconciled via a windowIds Set diff on orgId/window-change watch, version ref bump for computed invalidation instead of relying on Vue's reactive-Map instrumentation"

key-files:
  created:
    - src/utils/unconfirmedAssignments.ts
    - src/utils/__tests__/unconfirmedAssignments.test.ts
    - src/composables/useUnconfirmedVolunteers.ts
  modified:
    - src/views/DashboardView.vue

key-decisions:
  - "unconfirmedAssignments() stays a pure {emailLower, roleId, roleName}[] diff per the plan's artifact contract; the composable separately re-derives each row's actual status (unconfirmed | needsReconfirmation) from the same confirmationStatuses map so the view can pick the UI-SPEC's gray-vs-amber chip without widening the tested pure-function contract."
  - "attentionServices window is Planned-only (status === 'planned'), distinct from the feed's own draft-inclusive upcomingServices window — Draft services have no rehearseAccess/confirmations doc yet (built at markAsPlanned lock time), so including them would just show false unconfirmed noise."
  - "Added a 3rd empty sub-state ('No Planned services yet to check confirmations for.') for the edge case where upcomingServices is non-empty but entirely Draft (attentionServices.length === 0) — the UI-SPEC's literal 'Everyone's confirmed for the next 0 services.' text would read as nonsensical at N=0."
  - "The attention-cards row currently renders lg:col-span-2 on the single Unconfirmed volunteers card (Plan 03 has not yet added the presence card) — left a comment for Plan 03 to drop the span when it adds the second card, per 135-UI-SPEC.md's side-by-side contract."

patterns-established:
  - "Bounded-fan-out composable shape (per-id dual-listener state map + windowIds diff + version-ref invalidation) for any future N-service read aggregation on this dashboard."

requirements-completed: [R417]

coverage:
  - id: D1
    description: "unconfirmedAssignments pure diff util: no-doc/needsReconfirmation counted unconfirmed, confirmed excluded, undefined/empty input graceful, multi-role-per-email, stable order"
    requirement: "R417"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/unconfirmedAssignments.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "useUnconfirmedVolunteers composable: bounded <=6-service read-only fan-out over rehearseAccess + confirmations, listener teardown on window/org change and unmount"
    requirement: "R417"
    verification:
      - kind: unit
        ref: "node -e read-only/pure-diff/teardown static-analysis check (plan verify script) — pass"
    human_judgment: false
  - id: D3
    description: "Unconfirmed volunteers attention card renders in DashboardView, always shown with positive empty sub-state, capped at 8 rows with +N more link, rows link to service, reuses ServiceEditorView confirmation chip vocabulary"
    requirement: "R417"
    verification:
      - kind: unit
        ref: "node -e wiring check (useUnconfirmedVolunteers + Everyone's confirmed sub-state present) — pass"
    human_judgment: true
    rationale: "Visual/interaction correctness (chip colors match roster tab, live update on confirm, card layout at 375px) requires a human looking at the rendered page against 135-UI-SPEC.md Widget 2 — deferred per autonomous UAT-deferred mode."

# Metrics
duration: 25min
completed: 2026-09-07
status: complete
---

# Phase 135 Plan 02: Unconfirmed Volunteers Attention Card Summary

**Bounded ≤6-service dual-listener fan-out (rehearseAccess + confirmations) feeding a pure diff util, surfaced as an always-shown Unconfirmed volunteers card on the dashboard (R417).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-07T21:52:54Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Pure `unconfirmedAssignments()` util diffing `roleAssignmentsByEmailLower` against live confirmation statuses, reusing `confirmationKey`/`ConfirmationStatus` verbatim from `@/utils/confirmations` — 7 unit tests (RED then GREEN).
- `useUnconfirmedVolunteers` composable: for each of the next ≤6 upcoming Planned services, opens a `rehearseAccess/{serviceId}` doc listener and a `confirmations` subcollection listener, recomputes unconfirmed rows on every snapshot, and tears both down on orgId/window change and unmount. Read-only — no writes anywhere in the composable.
- Unconfirmed volunteers attention card added to `DashboardView.vue` inside the populated feed branch: header with amber count badge, rows capped at 8 with a "+N more — view roster" link to `/volunteers`, the exact gray/amber confirmation-chip vocabulary from `ServiceEditorView.vue`, and a positive "Everyone's confirmed for the next N services." empty sub-state that keeps the card visible rather than hiding it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure unconfirmed-assignment diff util** — `5daf5a79` (test, RED) → `c4bdb02d` (feat, GREEN)
2. **Task 2: Bounded fan-out composable** — `e0ea6166` (feat)
3. **Task 3: Unconfirmed volunteers attention card in DashboardView** — `a171b0a2` (feat)

_TDD tasks had multiple commits (test → feat), per Task 1's `tdd="true"` frontmatter._

## Files Created/Modified
- `src/utils/unconfirmedAssignments.ts` — pure diff, no Firestore/Pinia imports
- `src/utils/__tests__/unconfirmedAssignments.test.ts` — 7 unit tests covering all behavior bullets
- `src/composables/useUnconfirmedVolunteers.ts` — bounded ≤6-service dual-listener fan-out + lifecycle teardown
- `src/views/DashboardView.vue` — Unconfirmed volunteers attention card, `attentionServices` computed, chip class/label maps, `personDisplayName` lookup

## Decisions Made
- Kept `unconfirmedAssignments()`'s tested contract exactly as specified (`{emailLower, roleId, roleName}[]`) and re-derived the display-only `status` field (`unconfirmed` | `needsReconfirmation`) inside the composable from the same `confirmationStatuses` map, so the view can render the UI-SPEC's two distinct chip colors without widening the pure util's tested surface.
- `attentionServices` window filters to `status === 'planned'` only (not the feed's draft-inclusive `upcomingServices`) — Draft services have no `rehearseAccess`/`confirmations` docs yet, so including them would surface false "unconfirmed" noise for services that haven't been locked.
- Added an explicit zero-Planned-services empty sub-state ("No Planned services yet to check confirmations for.") distinct from the zero-unconfirmed sub-state, to avoid a nonsensical "next 0 services" message when every upcoming service is still Draft.
- Card currently spans `lg:col-span-2` full-width (Plan 03's presence card doesn't exist yet); left an inline comment for Plan 03 to drop that span when the second card is added, matching 135-UI-SPEC.md's side-by-side attention-cards row contract.

## Deviations from Plan

None — plan executed exactly as written. The `status` field addition to `UnconfirmedVolunteerRow` (not explicitly named in the plan's artifact list) is a display-detail extension of Task 2's composable, required to satisfy Task 3's explicit instruction to reuse "the exact confirmation chip vocabulary... for implicit-unconfirmed" alongside 135-UI-SPEC.md's stated dual gray/amber vocabulary — not a scope change.

## Issues Encountered
None.

## Deferred UAT

Per `/gsd-autonomous` UAT-deferred mode, Task 3's `<human-check>` (visual verification that unconfirmed people appear with correct chip colors, confirming a volunteer removes them live, the positive empty sub-state shows when everyone's confirmed, and clicking a row opens the service) was **not** run interactively. Code is complete, automated verification (unit tests, type-check, wiring checks) passed, and the plan is treated as complete. Not appended to a DEFERRED-VERIFICATION.md file per the milestone's autonomous-mode instruction for this phase.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 03 (R418 editor-presence roll-up) can now add its "Currently editing" card into the same attention-cards row in `DashboardView.vue`; it should drop the `lg:col-span-2` currently on the Unconfirmed volunteers card wrapper when it adds the second card.
- `useUnconfirmedVolunteers` and `unconfirmedAssignments` are both store-free/composable-shaped and reusable if a future phase needs the same unconfirmed-volunteers signal elsewhere (e.g. a per-service roster tab badge).

---
*Phase: 135-dashboard-overhaul*
*Completed: 2026-09-07*

## Self-Check: PASSED

All created files verified on disk; all 4 task commit hashes (5daf5a79, c4bdb02d, e0ea6166, a171b0a2) verified in git log.
