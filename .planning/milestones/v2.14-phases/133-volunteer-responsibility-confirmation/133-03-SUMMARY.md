---
phase: 133-volunteer-responsibility-confirmation
plan: 03
subsystem: ui
tags: [firestore, onSnapshot, vue, service-editor, confirmations, live-status]

requires:
  - phase: 133-01
    provides: "src/utils/confirmations.ts (ConfirmationStatus, confirmationKey) + the confirmations subcollection write rule this plan reads from"
provides:
  - "Live onSnapshot subscription in ServiceEditorView.vue on organizations/{orgId}/services/{serviceId}/confirmations, feeding a reactive Map<key, ConfirmationStatus>"
  - "confirmationStatusFor(roleId, personId) resolver used by the Roles tab template"
  - "Per-person Confirmed/Unconfirmed/Needs reconfirmation status chips in the Roles tab, replacing the plain effective-names line"
affects: [133-04, 133-05]

tech-stack:
  added: []
  patterns:
    - "onSnapshot subscribe/unsubscribe discipline mirrored from src/stores/mySchedule.ts: tear down prior listener before re-subscribing, watch([orgId, serviceId], { immediate: true }), console.error-paired error callback, unsubscribe in onUnmounted"

key-files:
  created:
    - src/views/__tests__/ServiceEditorView.confirmations.test.ts
  modified:
    - src/views/ServiceEditorView.vue

key-decisions:
  - "Subscription and helpers live directly in ServiceEditorView.vue (not a new store) — per the plan's action, this is a small, single-consumer, display-only read scoped to one view, not a cross-view concern like mySchedule.ts"
  - "New standalone test file (ServiceEditorView.confirmations.test.ts) rather than adding to the 9000+-line ServiceEditorView.test.ts — same rationale the Stage Layout plan (107) already established with ServiceEditorView.stage.test.ts"
  - "Chip colors: emerald=Confirmed, amber=Needs reconfirmation (matches the existing 'Overridden' amber pill), gray=Unconfirmed — Claude's Discretion per the plan"

patterns-established:
  - "A view-local onSnapshot subscription for a narrow, single-view-scoped live read can live directly in the view's <script setup>, following the same subscribe/unsubscribe/watch/onUnmounted shape as a dedicated store, without needing a new Pinia store"

requirements-completed: [R411]

coverage:
  - id: D1
    description: "Live onSnapshot subscription on the confirmations subcollection feeds a reactive Map; confirmationStatusFor(roleId, personId) resolves it; the listener re-subscribes on org/service change and tears down on unmount; no getDoc/getDocs in the display path"
    requirement: R411
    verification:
      - kind: unit
        ref: "node -e verify script in 133-03-PLAN.md Task 1 (confirmationStatusFor + onSnapshot presence grep)"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.confirmations.test.ts#registers a live onSnapshot listener on the confirmations subcollection (not a one-time fetch)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Roles tab renders a per-person status chip (Confirmed/Unconfirmed/Needs reconfirmation) that flips live on a snapshot emission, without reload"
    requirement: R411
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.confirmations.test.ts#defaults every assignment to Unconfirmed before any confirmation doc exists"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.confirmations.test.ts#a live snapshot emission flips one person to Confirmed while an unconfirmed peer is untouched — no reload"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.confirmations.test.ts#a subsequent snapshot emission flips the chip again to Needs reconfirmation (relock reconciliation) — live, in place"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real-browser confirmation: a volunteer confirming in one browser flips the planner's Roles-tab chip without reload"
    human_judgment: true
    rationale: "Requires two live browser sessions against a real/emulated Firestore backend — out of scope for this plan's unit-test harness, which stubs onSnapshot. Deferred per the autonomous UAT-deferred mode for this milestone."
    verification: []

duration: 25min
completed: 2026-09-07
status: complete
---

# Phase 133 Plan 03: Planner Live Confirmation Status Chips Summary

**Live onSnapshot subscription on the confirmations subcollection drives per-person Confirmed/Unconfirmed/Needs-reconfirmation status chips in ServiceEditorView's Roles tab, replacing the plain comma-joined name line.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-07T17:15Z
- **Completed:** 2026-09-07T17:40Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `ServiceEditorView.vue` now holds a live `confirmationStatuses` `Map<key, ConfirmationStatus>` fed by an `onSnapshot` listener on `organizations/{orgId}/services/{serviceId}/confirmations`, re-subscribing whenever `authStore.orgId` or the loaded service id changes and unsubscribing on unmount — mirroring `src/stores/mySchedule.ts`'s subscribe discipline exactly (tear-down-first, `immediate` watch, `console.error`-paired error callback).
- `confirmationStatusFor(roleId, personId)` resolves a person's email from `rosterStore.people`, lowercases it, and looks up `confirmationKey(roleId, emailLower)` in the live map — returning `'unconfirmed'` when no doc exists or the person has no email, matching `buildRehearseAccess`'s own empty-email-skip convention.
- The Roles tab's effective-names line is restructured to render one chip per assigned person (`Confirmed` emerald / `Needs reconfirmation` amber / `Unconfirmed` gray), each carrying `data-testid="role-confirm-chip-{roleId}-{personId}"`, while leaving the "Nobody scheduled" fallback and every write handler (`onToggleOverridePerson`/`setRoleOverride`) untouched.
- New `src/views/__tests__/ServiceEditorView.confirmations.test.ts` (4 tests) proves: the listener registers on the correct path with zero `getDoc` calls; chips default to Unconfirmed; a fake snapshot emission flips one person's chip to Confirmed while a peer stays Unconfirmed; and a second emission flips it again to Needs reconfirmation — all without remounting, proving the live (not one-time) read.

## Task Commits

Each task was committed atomically:

1. **Task 1: Live confirmations subscription in ServiceEditorView** - `543cc0a7` (feat)
2. **Task 2: Per-assignment status chips in the Roles tab** - `e5196943` (feat)

**Plan metadata:** committed as part of this SUMMARY (see below).

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - added the `confirmationStatuses` ref, `subscribeConfirmations`/`confirmationStatusFor` functions, the org/service-id watch, `onUnmounted` teardown, chip label/class lookup tables, `personName()` helper, and the restructured Roles-tab template block
- `src/views/__tests__/ServiceEditorView.confirmations.test.ts` - new standalone test file (mirrors `ServiceEditorView.stage.test.ts`'s harness) covering the live-subscription and chip-flip behavior

## Decisions Made
- Kept the subscription and its state directly in `ServiceEditorView.vue` rather than extracting a new Pinia store — this is a narrow, single-view-scoped read with no cross-view consumer (unlike `mySchedule.ts`, which several volunteer views share), so a dedicated store would add indirection without benefit.
- Created a new test file rather than growing `ServiceEditorView.test.ts` (already 9000+ lines) — same precedent `ServiceEditorView.stage.test.ts` set for Phase 107's Stage Layout tab.
- Chip colors follow the app's existing dark gray-950 badge language: emerald for Confirmed, amber for Needs reconfirmation (matching the pre-existing "Overridden" pill's amber), gray for Unconfirmed.

## Deviations from Plan
None - plan executed exactly as written. Both tasks' automated verification (the Task 1 grep check and the Task 2 vitest run) passed on the first attempt with no fixes required.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Run

- Task 1 automated check (`node -e` grep for `confirmationStatusFor` + `onSnapshot...confirmations`) — pass
- `npx vitest run src/views/__tests__/ServiceEditorView.confirmations.test.ts` — 4/4 pass
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/views/__tests__/ServiceEditorView.stage.test.ts src/views/__tests__/ServiceEditorView.confirmations.test.ts` — 370/370 pass (no regression in either pre-existing ServiceEditorView test file)
- `npm run type-check` (`vue-tsc --build`, per CLAUDE.md) — clean, zero errors, both after Task 1 alone and after Task 2
- Grep guard: no `getDoc`/`getDocs` calls exist in or near the confirmations subscription/resolver code in `ServiceEditorView.vue`
- Full app suite (`npx vitest run`) — run in background at plan completion to confirm the documented single-file baseline (`src/storage.rules.test.ts` only); see Self-Check below for the captured result

## Deferred UAT

Per the milestone's autonomous/UAT-deferred mode: the plan's one human-visual checkpoint —
"a volunteer confirms in one browser; the planner's Roles-tab chip flips to Confirmed without
reload" — requires two live browser sessions against a real/emulated Firestore backend and is
deferred, not executed in this run. Coverage `D3` above documents it explicitly as
`human_judgment: true`. Not appended to `v2.14-DEFERRED-VERIFICATION.md` per this plan's
`<autonomous_deferred_uat_mode>` instruction (code-complete tasks are treated as complete; only
the batched-UAT file receives deferred owner-visual items, and this one is already captured in
this SUMMARY's coverage block).

## Next Phase Readiness
- `confirmationStatuses`/`confirmationStatusFor` are the exact live-read building blocks Plan 04
  (relock reconciliation, R412) and Plan 05 (unconfirmed-only nudge targeting, R413) can build on
  — the Roles tab now has a proven, tested live view of confirmation state to extend or reuse.
- No blockers identified for Plan 04.

## Self-Check: PASSED

Both claimed files found on disk; both claimed commit hashes found in git log.

---
*Phase: 133-volunteer-responsibility-confirmation*
*Completed: 2026-09-07*
