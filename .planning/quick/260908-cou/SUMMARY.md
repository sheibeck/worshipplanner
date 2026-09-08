---
quick_id: 260908-cou
slug: stage-chit-role-sync
status: complete
date: 2026-09-08
commit: 3fb268d2
---

# Summary: stage-layout chit ↔ role-assignment sync

**Status: complete ✓** — committed `3fb268d2`, type-check clean, targeted + full
suite at baseline (`storage.rules.test.ts` only).

## What shipped

1. **Remove role → remove chit (live).** Unchecking a person from a Band role in
   the Roles tab now prunes their matching stage chit immediately, via
   `reconcileStageForRoleChange` called from `onToggleOverridePerson` after the
   override write succeeds.
2. **Play + sing → one folded chit with "Player also sings".** A person on an
   instrument (non-vocal Band) role who also holds a vocal role seeds as ONE
   instrument chit with `withVocal` true (reads "Guitar + Vocal") — no separate
   Vocals chit. Applied both at auto-seed (`foldPlayAndSing`) and live (checking/
   unchecking the vocal role sets/clears `withVocal` on their instrument chits).

## Implementation

- `src/utils/stageLayout.ts`
  - `isVocalRoleName(name)` — `/vocal|vox|choir|sing/i`; excludes "lead" so
    "Lead Guitar" is not misread as vocal.
  - `foldPlayAndSing(assignments)` — pure; drops a play+sing person's vocal
    assignment and flags their instrument assignment(s) `withVocal`.
  - `autoPopulateMarkers` — `SeedAssignment` now carries optional `withVocal`,
    which rides onto the seeded marker.
- `src/views/ServiceEditorView.vue`
  - `onAutoPopulateStageLayout` folds band assignments before seeding.
  - `reconcileStageForRoleChange(roleId, personId, isRemoving)` — Band-only;
    mutates `localService.stageLayout` (rides useAutoSave). Remove instrument →
    drop chit; remove/add vocal → clear/set `withVocal`; add instrument → no-op.

## Tests

- `src/utils/__tests__/stageLayout.test.ts` — `isVocalRoleName`, `foldPlayAndSing`
  (fold, pure-vocalist, instrument-only, two-instrument singer, order/non-mutation),
  `autoPopulateMarkers` honoring `withVocal`. 37 pass.
- `src/views/__tests__/ServiceEditorView.stage.test.ts` — seed-fold + 3 live
  behaviors (remove instrument chit, add-vocal sets withVocal, remove-vocal clears
  it). 25 pass.
- Main `ServiceEditorView.test.ts` 346 pass (onToggleOverridePerson unchanged for
  non-stage paths).

## Decisions (owner, 2026-09-08)

- Fold into one chit (not two). · Live + on seed.

## Follow-up fix (owner UAT, same day) — full live mirror

Owner found the first cut only partially tracked: **"Reset to schedule"** didn't
touch the stage (`onResetRoleOverride` had no reconcile), and **adding a new band
member** added no chit (the reconcile deliberately never created markers).

Replaced the piecemeal per-(role,person) reconcile with a full **live mirror**:
new pure `reconcileBandMarkers(existing, desired)` drops stale managed chits,
keeps assigned ones in place (updating `withVocal`), and ADDS newly-assigned band
members into free grid cells (never reflowing existing markers).
`syncStageWithRoles()` runs it from BOTH `onToggleOverridePerson` and
`onResetRoleOverride` after the write persists. Only reconciles a non-empty
layout (the one-time seed still owns first creation; a cleared layout stays
cleared — WR-01). +6 `reconcileBandMarkers` unit tests, +2 integration tests
(reset removes a chit; adding a member adds an auto-placed chit). Stage 27/27,
util 42/42, type-check clean.

## Non-goals / edges (see PLAN.md)

- The one-time seed still owns FIRST creation; `syncStageWithRoles` only mirrors a
  layout that already has ≥1 chit (a deliberately-emptied stage stays empty).
- Removing a folded instrument chit does not resurrect a Vocals chit for a person
  who still sings.
