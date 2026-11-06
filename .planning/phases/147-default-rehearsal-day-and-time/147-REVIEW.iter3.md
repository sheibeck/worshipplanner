---
phase: 147-default-rehearsal-day-and-time
reviewed: 2026-11-06T17:30:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - docs/adr/0249-new-services-start-with-a-default-rehearsal.md
  - docs/specs/default-rehearsal.md
  - src/stores/__tests__/services.publicDocs.test.ts
  - src/stores/__tests__/services.rehearsalDefaults.test.ts
  - src/views/SettingsView.vue
  - src/views/__tests__/SettingsView.defaultsWrites.test.ts
  - src/views/__tests__/SettingsView.test.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 147: Code Review Report (re-review, `e1693a94..HEAD`)

**Reviewed:** 2026-11-06
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

The WR-01 fix holds, and the new four-source watch does not throw away unsaved typing. I proved that with the real auth store and the real `SettingsView`, using a throwaway test (deleted afterwards, nothing left in the tree). The tracing turned up one other defect on the same card. It comes from a line this phase's diff did not touch, but it is reachable and gives a wrong result for the feature this phase ships.

### Does the watch fire when nothing about the card changed? No.

Every place that replaces or mutates `settings` while Settings is open:

- **`applyOrgSnapshot` and `resetOrgContext`** replace `settings.value` with a new object and new array identities. The only callers are `loadOrgContext`, `enterOrgAsSuperAdmin` and `exitSuperAdminView`, reached from `onAuthStateChanged` (sign-in and sign-out only; it does not fire on token refresh), `selectOrg` and super-admin enter/exit. All of those are real context changes. The sidebar switcher renders the current church as a non-clickable row (`AppSidebar.vue:134`), so selecting the current church cannot happen.
- **The members `onSnapshot` in `auth.ts`** only writes `userRole`. No org-doc `onSnapshot` exists.
- **Other Settings cards** (`aiEnabled`, `pcEnabled`, `bibleVersion`, `slideTypography`, `timezone`, `messaging.*`) and `ServiceTemplateEditor`'s `updateOrgSettings({'settings.defaultServiceTemplate'})` assign leaf keys only. None touches `orgId`, the weekday, `rehearsalTimeDefaults` or `reportTimeDefault`. For the array and the weekday sources, `hasChanged` compares the same reactive proxy and the same primitive, so the callback does not run.

Concrete run, real store, org-1 seeded with `['18:30']` / `17:45`:

1. Type `19:00` into time row 0 and `18:00` into the report time.
2. Press "+ Add rehearsal time".
3. Pick `America/Denver` through the real timezone handler.
4. Call `updateOrgSettings({'settings.defaultServiceTemplate': ..., 'settings.timezone': 'America/Chicago'})`.
5. Flip `settings.aiEnabled` and `settings.messaging.enabled`, then flush.

Result: row 0 still `19:00`, report time still `18:00`, and two time rows are still present. Nothing was reseeded.

### Do the failed-save rollback and the watch fight? No.

`updateDoc` rejects before `updateOrgSettings` reaches its synchronous mirror-write loop, so `settings` is never touched and the watch never fires. I ran a rejected save after typing `19:00` and `18:00`. The inputs rolled back to `18:30` and `17:45`, and the store still held `['18:30']`.

On a successful save the mirror write is synchronous, so the watch fires once before the save handler's continuation. It reseeds the inputs with the values just saved, so nothing is lost.

### Fix verification

`SettingsView.test.ts` and `SettingsView.defaultsWrites.test.ts` pass (60 tests). The AC-RHD-67 spec widening and the ADR-0249 bullet match what `REVIEW-FIX.md` says. The WR-03 test rewrites assert against real store writes rather than a mock.

## Warnings

### WR-01: After "Save defaults", the time inputs are the same array as the store, so unsaved edits change the live defaults

**File:** `src/views/SettingsView.vue:1398` (with `src/stores/auth.ts:467`)
**Issue:** `onSaveRehearsalDefaults` builds `newRehearsalDefaults`, passes it to `updateOrgSettings`, and that mirror-write stores the same array object in `settings.rehearsalTimeDefaults` (`auth.ts:467`, `cursor[leaf] = value`). Line 1398 then assigns that same array to `rehearsalTimeDefaultsInput.value`. The new watch's reseed runs first and makes a copy, but line 1398 runs after it and re-links the input to the store's array. The line predates this phase (blame: `932ad4057`, 2026-09-09), so the fix did not introduce it. Its effect on this phase's feature is real, because the store array is what new services read for their default time (`services.ts:484`, `rehearsalTimeDefaults?.[0]`).

After a save, editing a time row, pressing Add, or pressing Remove mutates the store array in place. The `v-model` on `rehearsalTimeDefaultsInput[index]` writes straight through. Because the watch compares array identity, it does not fire, which is why this stays invisible.

Concrete input, run against the real store: seed `['18:30']`, set row 0 to `19:00`, press "Save defaults" (store reads `['19:00']`), then change row 0 to `20:00` and do not save. `authStore.settings.rehearsalTimeDefaults` is now `["20:00"]`. A service created next gets a rehearsal at 20:00, a time that was never saved. "+ Add rehearsal time" pushes `''` into the store array, which `ServiceEditorView.vue:1758` passes down as `default-times`. If a later save fails, the rollback captures `previousRehearsalDefaults` from the already-mutated store, so it "restores" the unsaved values beside a "Failed to save" message.

**Fix:** break the alias at the one assignment:
```ts
    rehearsalTimeDefaultsInput.value = [...newRehearsalDefaults]
```
The watch already reseeds the inputs from the store after a successful save, so deleting line 1398 would also work, but it would then depend on microtask order. The copy is the safer choice. Add a test in `SettingsView.defaultsWrites.test.ts` that saves, edits row 0 without saving, and asserts `authStore.settings.rehearsalTimeDefaults` is unchanged. It fails against the current code.

---

_Reviewed: 2026-11-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
