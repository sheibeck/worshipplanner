---
phase: 147-default-rehearsal-day-and-time
fixed_at: 2026-11-06T17:25:00Z
review_path: .planning/phases/147-default-rehearsal-day-and-time/147-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 147: Code Review Fix Report

**Fixed at:** 2026-11-06
**Source review:** .planning/phases/147-default-rehearsal-day-and-time/147-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 2
- Skipped: 1 (WR-02, by owner direction, documented instead of changed)

Order kept for WR-01: spec commit, then red test commit, then the fix commit.

## Fixed Issues

### WR-01: In-place church switch reseeds only the weekday

**Files modified:** `docs/specs/default-rehearsal.md`, `src/views/__tests__/SettingsView.test.ts`, `src/views/SettingsView.vue`
**Commits:** `6fa2435c` (spec), `6f7a7162` (failing tests), `662a9129` (fix)
**Status:** fixed: requires human verification (logic change in a watcher)

**Applied fix:**
- AC-RHD-67 widened to cover the default day, default times and report time, and what "Save defaults" writes after a switch. ID and `(R459)` kept. `**Last changed:**` already read 2026-11-06, so it was not touched.
- Three tests citing AC-RHD-67 added: two churches with the same weekday; the real `selectOrg` ordering; and "Save defaults" writing the new church's values. All three were red against the old weekday-only watch (the save test showed it writing `['18:30']` and `'17:45'` into the new church) and green after the fix.
- The weekday-only watch is replaced by a watch that reseeds all three inputs.

**Deviation from the reviewer's suggested fix, and why:** the review proposed keying the watch on `authStore.orgId` alone. That reads stale settings. In `selectOrg` -> `loadOrgContext` (`src/stores/auth.ts`), `orgId.value = activeId` is set at line 567, before `await refreshOrgClaim` and `await getDoc`. `applyOrgSnapshot` replaces `settings.value` only at line 616. A watch fired by the orgId change alone would reseed the new church's card from the old church's settings and never fire again. The watch therefore has four sources: `orgId`, the weekday, `rehearsalTimeDefaults` and `reportTimeDefault`. `orgId` makes a switch reseed even when nothing else differs, and the settings values reseed again when the new church's document arrives. The second AC-RHD-67 test models that ordering, with the org id changing first and the settings arriving later. `updateOrgSettings` mutating settings on a normal save also re-fires the watch, but it reseeds the inputs with exactly the values just saved, so nothing is lost.

The test mock needed a small reactive tick (`mockSwitchTick`) read by the `orgId`, `rehearsalTimeDefaults` and `reportTimeDefault` getters, because Vue cannot watch a plain `let` behind a getter.

### WR-03: The AC-RHD-09 and AC-RHD-10 tests could not fail

**Files modified:** `src/stores/__tests__/services.publicDocs.test.ts`, `src/stores/__tests__/services.rehearsalDefaults.test.ts`, `src/views/__tests__/SettingsView.defaultsWrites.test.ts` (new), `src/views/__tests__/SettingsView.test.ts`
**Commits:** `853b3cfb` (AC-RHD-10), `bbe3d575` (AC-RHD-09)
**Status:** fixed

**Which mock the save path uses:** the view's "Save defaults" handler calls `authStore.updateOrgSettings`. `SettingsView.test.ts` replaces that with `mockUpdateOrgSettings`. The `mockUpdateDoc` assertion in the old AC-RHD-09 test only covered a direct `updateDoc` from the view, which that handler does not make, so it could not see a write made inside the store.

**AC-RHD-09:** new file `src/views/__tests__/SettingsView.defaultsWrites.test.ts` mounts the real `SettingsView` against the real auth store (signed in through the mocked `onAuthStateChanged`, editor role). Every Firestore write function (`updateDoc`, `setDoc`, `addDoc`, `deleteDoc`, batch and transaction `set/update/delete`) records the path it targets. The test picks Friday, presses "Save defaults", then asserts that the real store's settings changed, that at least one write happened, that every write targets exactly `organizations/org-1` and none contains `services`, and that the patch holds only `settings.*` keys. The old test lost its AC-RHD-09 title (it stays as a smaller test of the keys handed to the store).

**AC-RHD-10:** the old test mutated settings after `addDoc` had returned, with nothing connecting the two. It is removed from `services.rehearsalDefaults.test.ts`. The replacement in `services.publicDocs.test.ts` seeds a service with an auto-added rehearsal in the in-memory store, changes the default day and times, and saves the service through the real `updateService`. It asserts that the service write carries no `rehearsals`, the stored service keeps its rows, and the `shareTokens` and `serviceShares` snapshots keep their original rows (marker narrowed away).

**Breakage attempts (each reverted with `git checkout --`, nothing committed):**
1. AC-RHD-10: `updateService` temporarily re-derived `rehearsals` from the current Settings via `buildAutoRehearsal`. The new test went red (`expected { notes: 'x', ... } to not have property "rehearsals"`). 18 other tests in the file stayed green.
2. AC-RHD-09: `onSaveRehearsalDefaults` temporarily wrote a service doc directly. The new test went red (`'organizations/org-1/services/svc-1'` was not `'organizations/org-1'`). The old test also went red for this one.
3. AC-RHD-09: `authStore.updateOrgSettings` temporarily wrote a service doc after the org write. Only the new test went red. The old SettingsView test stayed green, which is the gap WR-03 identified.

## Skipped Issues

### WR-02: Stale second tab reverts a date change and the moved rehearsal

**File:** `src/views/ServiceEditorView.vue:4771`
**Reason:** skipped by owner direction, code deliberately unchanged. Sending `date` only when it changed would be worse: a stale tab would still write its old `rehearsals` rows, leaving a new date beside old rows. Today the whole save is at least internally consistent. The residual is recorded as a bullet in ADR-0249 Consequences (commit `1542e9ac`): autosave writes the whole document, so a stale second tab with unsaved edits can write back the old date and rows, and `date` always travels with `rehearsals` so that write stays consistent.
**Original issue:** every autosave sends `date` and the whole `rehearsals` array, so a stale second tab with unsaved edits can revert another tab's date change and moved rehearsal.

## Verification

- `npx vitest run src/views/__tests__/SettingsView.test.ts src/stores/__tests__/services.rehearsalDefaults.test.ts src/stores/__tests__/services.publicDocs.test.ts src/__tests__/specCoverage.test.ts src/__tests__/defaultRehearsalAdr.test.ts`: 5 files, 265 tests passed. The new `SettingsView.defaultsWrites.test.ts` also passes (it is not in that list).
- `npm run type-check` (`vue-tsc --build`): exit 0.
- `git ls-files --eol` shows no `w/mixed` on any touched file. The four `.planning/graphs/*` files were never staged.
- `git ls-files --eol` shows the new test file as `w/lf`, matching the other LF test files.
- Out of scope and untouched: IN-01.

---

_Fixed: 2026-11-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
