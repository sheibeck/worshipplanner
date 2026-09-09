---
phase: 133-volunteer-responsibility-confirmation
plan: 04
subsystem: store
tags: [firestore, markAsPlanned, confirmations, relock, reconciliation, best-effort]

requires:
  - phase: 133-01
    provides: "src/utils/confirmations.ts — computeValidConfirmationKeys(service, quarters, roles, people), confirmationKey(roleId, emailLower), ConfirmationDoc/ConfirmationStatus"
provides:
  - "reconcileConfirmations(service, org, quarters, roles, people) in src/stores/services.ts — relock invalidation for R412"
  - "markAsPlanned now reconciles confirmations, best-effort, right after the rehearseAccess projection write"
affects: [133-05]

tech-stack:
  added: []
  patterns:
    - "Best-effort try/catch discipline mirrored verbatim from writeRehearseAccessDoc/ensureShareLink's own catches inside markAsPlanned — a reconciliation failure logs and never rolls back the already-succeeded status transition"
    - "getDocs-then-updateDoc-by-rebuilt-ref, following deleteService/resyncRehearseAccessForSong's own convention of rebuilding a doc() ref from a queried doc's id rather than using a snapshot's .ref"

key-files:
  created: []
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "reconcileConfirmations takes org as an explicit parameter (mirroring writeRehearseAccessDoc's own signature) rather than closing over the store's orgId ref — it is a module-level function, not a store-closure function, so org must be passed in exactly like writeRehearseAccessDoc already does"
  - "The confirmations getDocs read is left as the single legitimate one-time read for this whole feature (per RESEARCH.md Pitfall 1) — it runs once per relock, is the authoritative moment of change, and is explicitly NOT reused anywhere in a live display path"
  - "Docs already 'needsReconfirmation' are left untouched even if their key is still stale — nothing about their status needs to change twice, and re-writing them would bump updatedAt for no behavioral reason"

requirements-completed: [R412]

coverage:
  - id: D1
    description: "On relock, a prior 'confirmed' doc whose (roleId, emailLower) is no longer a valid assignment flips to 'needsReconfirmation'"
    requirement: R412
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#flips a stale confirmed doc to needsReconfirmation when its assignment is no longer valid"
        status: pass
    human_judgment: false
  - id: D2
    description: "A confirmation whose assignment is unchanged across the relock keeps its 'confirmed' status untouched (no write)"
    requirement: R412
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#leaves a confirmed doc untouched when its assignment is unchanged across the relock"
        status: pass
    human_judgment: false
  - id: D3
    description: "A doc already 'needsReconfirmation' is not re-written, even if its key remains stale"
    requirement: R412
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#does not re-write a doc already needsReconfirmation, even if its key is still stale"
        status: pass
    human_judgment: false
  - id: D4
    description: "No confirmation doc is created for a still-unconfirmed assignment (unconfirmed stays implicit)"
    requirement: R412
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#does not create a doc for a still-unconfirmed assignment"
        status: pass
    human_judgment: false
  - id: D5
    description: "Reconciliation is best-effort: a confirmations getDocs read failure or a flip updateDoc failure logs and never blocks/rolls back the already-succeeded status transition"
    requirement: R412
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#is best-effort: a confirmations read failure logs and does not block the status transition"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#is best-effort: a confirmations write (flip) failure logs and does not block the status transition"
        status: pass
    human_judgment: false
  - id: D6
    description: "Manual (batched UAT): confirm a role, reopen + reassign that role away, relock -> the confirmation shows Needs reconfirmation; a confirmation for an unchanged role stays Confirmed"
    human_judgment: true
    rationale: "Requires a live browser session against a real/emulated Firestore backend driving the full confirm -> reopen -> reassign -> relock cycle visually — out of scope for this plan's unit-test harness. Deferred per the milestone's autonomous/UAT-deferred mode."
    verification: []

duration: 20min
completed: 2026-09-07
status: complete
---

# Phase 133 Plan 04: R412 Relock Invalidation Summary

**`reconcileConfirmations` diffs `computeValidConfirmationKeys` against the stored confirmations subcollection on every `markAsPlanned` relock, flipping only stale `confirmed` docs to `needsReconfirmation` while leaving unchanged and already-flipped docs untouched — best-effort, never blocking the lock.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-07T18:05Z
- **Completed:** 2026-09-07T18:25Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added `reconcileConfirmations(service, org, quarters, roles, people)` as a module-level function in `src/stores/services.ts`, right after `writeRehearseAccessDoc` — it reads the current `organizations/{orgId}/services/{serviceId}/confirmations` subcollection once via `getDocs` (the single legitimate one-time read this feature needs, per 133-RESEARCH.md Pitfall 1), computes the new valid key set via `computeValidConfirmationKeys` (from Plan 133-01's `src/utils/confirmations.ts`), and `updateDoc`s only the docs where `status === 'confirmed'` AND the doc's `${roleId}_${emailLower}` key is no longer valid.
- Wired the call into `markAsPlanned`, immediately after the existing `writeRehearseAccessDoc` try/catch, in its own best-effort try/catch mirroring the surrounding `writeRehearseAccessDoc`/`ensureShareLink` catches verbatim in structure — a confirmations read or flip failure logs `console.error(...)` and never rolls back the already-succeeded status transition.
- `reopenService` needed no change: the volunteer's entire confirmations read/write path is already cut off the instant `rehearseAccess` is deleted at reopen, so the next relock's reconciliation is the only hook that ever needs to run (documented in a code comment at the call site, per the plan).
- Extended `src/stores/__tests__/services.test.ts` with a new `confirmations reconciliation on relock (R412, Plan 133-04)` describe block: 7 tests covering stale-flip, unchanged-untouched, needsReconfirmation-not-rewritten, no-create-for-unconfirmed, and two best-effort-failure cases (read failure, flip-write failure).

## Task Commits

Each task was committed atomically:

1. **Task 1: reconcileConfirmations + markAsPlanned wiring** - `51dc0a26` (feat)

**Plan metadata:** committed as part of this SUMMARY (see below).

## Files Created/Modified
- `src/stores/services.ts` - added the `computeValidConfirmationKeys`/`confirmationKey`/`ConfirmationDoc` import, the new `reconcileConfirmations` function, and its best-effort call site inside `markAsPlanned`
- `src/stores/__tests__/services.test.ts` - new `confirmations reconciliation on relock (R412, Plan 133-04)` describe block (7 tests)

## Decisions Made
- `reconcileConfirmations` takes `org: string` as an explicit parameter rather than closing over the store's `orgId` ref, mirroring `writeRehearseAccessDoc`'s own signature exactly — both are module-level functions outside the `defineStore` closure, called from inside `markAsPlanned` with `orgId.value` passed in. (The plan's `<action>` prose listed the signature without an org param; this is a necessary completion of the design, not a deviation — the function cannot build a Firestore path without it, and the existing sibling function already establishes the pattern.)
- Stale docs already `needsReconfirmation` are explicitly left untouched (checked via `data.status !== 'confirmed'` short-circuit) rather than re-written — avoids a pointless `updatedAt` bump and keeps the flip idempotent across repeated relocks.
- Rebuilt each flip's doc ref via `doc(db, 'organizations', org, 'services', service.id, 'confirmations', d.id)` rather than a snapshot's `.ref`, matching this file's existing convention in `deleteService`/`resyncRehearseAccessForSong` (this codebase's mocked Firestore SDK doesn't stand up real `DocumentReference`s on query results, so this is also the only pattern the test harness supports).

## Deviations from Plan

### Auto-fixed Issues

None — the plan's core design was already directly implementable. The only addition was the `org` parameter noted above, which is a necessary completion (Rule 3 — blocking issue: the function cannot construct a Firestore collection path without the org id), not a bug fix or architectural change.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Run

- `npx vitest run src/stores/__tests__/services.test.ts` — 126/126 pass (was 119 before this plan; +7 new tests, zero regressions)
- `npm run type-check` (`vue-tsc --build`, per CLAUDE.md) — clean, zero errors
- Full app suite (`npx vitest run`) — 215 files / 5557 tests pass, 35 skipped; the only failing file is `src/storage.rules.test.ts` (documented CLAUDE.md environment-limitation baseline — Storage emulator not running in this session, unrelated to this plan)

## Deferred UAT

Per the milestone's autonomous/UAT-deferred mode: the plan's one manual verification step —
"confirm a role, reopen + reassign that role away, relock -> the confirmation shows Needs
reconfirmation; a confirmation for an unchanged role stays Confirmed" — requires a live browser
session against a real/emulated Firestore backend driving the full cycle and is deferred, not
executed in this run. Coverage `D6` above documents it explicitly as `human_judgment: true`.

## Next Phase Readiness
- R412 is now fully implemented and unit-tested. The store's `reconcileConfirmations` and its
  test fixtures give Plan 05 (R413, unconfirmed-only nudge targeting) a proven confirmation-state
  read/write surface to build the messaging filter against.
- No blockers identified for Plan 05.

## Self-Check: PASSED

Both claimed files found on disk; the claimed commit hash was found in git log.

---
*Phase: 133-volunteer-responsibility-confirmation*
*Completed: 2026-09-07*
