---
phase: 88-editing-ux-polish-roles-teams-slideout-song-key-typeahead
reviewed: 2026-08-27T06:04:25Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/constants/keys.ts
  - src/components/ArrangementAccordion.vue
  - src/components/SongSlideOver.vue
  - src/components/RoleSlideOver.vue
  - src/components/TeamSlideOver.vue
  - src/components/RolesConfigPanel.vue
  - src/components/TeamsConfigPanel.vue
  - src/views/RosterView.vue
  - src/components/__tests__/ArrangementAccordion.test.ts
  - src/components/__tests__/RoleSlideOver.test.ts
  - src/components/__tests__/SongSlideOver.test.ts
  - src/components/__tests__/TeamSlideOver.test.ts
  - src/components/__tests__/RolesConfigPanel.test.ts
  - src/components/__tests__/TeamsConfigPanel.test.ts
  - src/constants/__tests__/keys.test.ts
  - src/views/__tests__/RosterView.test.ts
  - src/views/__tests__/RosterViewEditQuery.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: fixed
fixed_at: 2026-08-27T02:10:00Z
fix_report: 88-REVIEW-FIX.md
---

# Phase 88: Code Review Report

**Reviewed:** 2026-08-27T06:04:25Z
**Depth:** standard
**Files Reviewed:** 17 (8 source, 9 test)
**Status:** fixed — see `88-REVIEW-FIX.md` for the applied fixes (WR-01 and IN-01 both resolved, commits `5ebf6ed4` and `3c9b64e2`)

## Summary

Phase 88 is a UI refactor: `RolesConfigPanel`/`TeamsConfigPanel` become read-only rows, `RoleSlideOver`/`TeamSlideOver` absorb all edit/add/delete logic (including the deleted `TeamRecurrenceSlideOver`'s recurrence editor), `RosterView` owns selection state and mounts both slideouts (mirroring `SongsView`), and `SongSlideOver`'s Key field becomes an `<input list>+<datalist>` typeahead backed by a new shared `src/constants/keys.ts`.

I diffed every changed file against its pre-Phase-88 version (`441317fd~1`) line by line, specifically hunting for logic dropped rather than moved during the panel→slideout extraction. Verdict:

- **WR-01 (duplicate team name) and WR-02 (rename soft-warn)** were moved to `TeamSlideOver.vue` verbatim (comparator, order of checks, and the confirm-then-write flow are byte-for-byte equivalent to the deleted inline logic in the old `TeamsConfigPanel.vue`). The panel no longer contains either check.
- **Recurrence round-trip (R254/R255)**: ordinals are still seeded `Array.from(new Set(...)).sort(...)` on open and persisted the same way on save; `NewServiceDialog.vue`'s last commit predates this phase, confirming the auto-select-on-service-creation path is untouched.
- **Delete confirms** for both role and team preserve their original copy verbatim ("clears assignments across quarters" / "services that already selected it keep the reference").
- **RolesConfigPanel** keeps the Band/Tech/Other grouping; both panels are now purely presentational (`emit('edit', …)` / `emit('add')`, zero store calls) and `RosterView` owns `selectedRole`/`selectedTeam` + open flags exactly mirroring `SongsView`'s pattern.
- **No dangling references** to the deleted `TeamRecurrenceSlideOver.vue` remain anywhere under `src/` — the only two hits are comments inside `TeamSlideOver.vue` itself, documenting where the logic came from.
- **Scope boundary held**: the role vocal control is still the Band-only "Vocal role" checkbox; no multi-role work leaked in from Phase 89.
- **R258 Key datalist**: confirmed `MAJOR_KEYS`/`MINOR_KEYS` in the new `src/constants/keys.ts` are byte-identical (values and order) to the arrays previously inlined at `ArrangementAccordion.vue:179-180`; the datalist intentionally lists only the 14 major roots per the phase's own decision doc ("List contents = the existing 14 major-root keys"), and a free-typed value (e.g. "Am") still round-trips to the primary/first arrangement via the existing `primaryArrangementKey` computed setter.
- Ran the full set of changed/added test files (9 files, 88 tests) and `npm run type-check` (`vue-tsc --build`, which also typechecks test files per this repo's CLAUDE.md guidance) — both clean.

One real regression surfaced during the diff: the pre-Phase-88 "Add Role" flow had a `|| 1` safety fallback on `defaultCount` that did not survive the move into `RoleSlideOver`'s create-mode save path (see WR-01 below — unrelated numbering to the phase's own WR-01/WR-02, this is my finding ID). No test in the new suite exercises an emptied/zeroed Default count field, so this gap shipped uncaught.

## Warnings

### WR-01: `RoleSlideOver` create-mode Save lost the `defaultCount || 1` safety fallback present in the old inline "Add Role" flow

**File:** `src/components/RoleSlideOver.vue:220-228`
**Issue:** The pre-Phase-88 `RolesConfigPanel.vue` (`441317fd~1`) guarded the Add-Role payload with `defaultCount: newRoleCount.value || 1`. The number `<input>` has `min="1"` but that attribute is inert here — Save is a plain `<button type="button" @click="onSave">`, not a native form submit, so HTML5 constraint validation never runs. If a user clears the "Default count" field entirely before clicking Save, `v-model.number` leaves `form.value.defaultCount` as an empty string (Vue's `looseToNumber` falls back to the raw string when `parseFloat` is `NaN`), and `rosterStore.addRole()` writes that empty string straight to Firestore with no store-side validation (`stores/roster.ts:254-262` just spreads `input`). The role's `defaultCount` is documented as "the number of volunteers the scheduler auto-fills each service" — a non-numeric value here can corrupt scheduler auto-fill math downstream. The edit-mode branch (line 233) has the same gap, but that one is pre-existing (the old inline edit path also lacked a fallback); the create-mode loss is new in this phase.
**Fix:**
```ts
// create branch
defaultCount: form.value.defaultCount || 1,
// edit branch (tightens a pre-existing gap while touching this code)
defaultCount: form.value.defaultCount || 1,
```
Consider also adding `.trim()`-style coercion or a `Math.max(1, Number(form.value.defaultCount) || 1)` guard, and a regression test that clears the Default count input before Save.

## Info

### IN-01: `RoleSlideOver` / `TeamSlideOver` have no unsaved-changes guard, unlike `SongSlideOver` and the Volunteer drawer in the same view

**File:** `src/components/RoleSlideOver.vue`, `src/components/TeamSlideOver.vue`
**Issue:** `SongSlideOver.vue` and the Add/Edit Volunteer drawer in `RosterView.vue` both use `useUnsavedGuard()` to prompt before a dirty form is discarded via Cancel/backdrop/×. `RoleSlideOver`/`TeamSlideOver`'s `onCancel` just does `emit('close')` with no dirty check. This is not a regression — the pre-Phase-88 inline row editors and `TeamRecurrenceSlideOver.vue` had the same gap — but now that roles/teams get a full-form slideout matching `SongSlideOver`'s visual pattern, the inconsistency is more user-visible (the two side-by-side editing surfaces in this app behave differently on accidental close).
**Fix:** Wire `useUnsavedGuard()` into both slideouts' `onCancel`, mirroring `SongSlideOver.vue:595-598`, for parity across all three edit-drawer surfaces. Low priority — worth a follow-up ticket rather than blocking this phase.

---

_Reviewed: 2026-08-27T06:04:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
