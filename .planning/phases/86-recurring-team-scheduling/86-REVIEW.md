---
phase: 86-recurring-team-scheduling
reviewed: 2026-08-27T01:56:39Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/types/team.ts
  - src/utils/teamRecurrence.ts
  - src/utils/__tests__/teamRecurrence.test.ts
  - src/components/NewServiceDialog.vue
  - src/components/__tests__/NewServiceDialog.test.ts
  - src/components/TeamRecurrenceSlideOver.vue
  - src/components/TeamsConfigPanel.vue
  - src/components/__tests__/TeamsConfigPanel.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: fixed
fixed_at: 2026-08-26T22:12:00Z
fixes:
  - id: WR-1
    status: fixed
    commit: dcf0d584
  - id: WR-2
    status: fixed
    commit: 71b4d2c3
  - id: IN-1
    status: fixed
    commit: c390e1e8
---

# Phase 86: Code Review Report

**Reviewed:** 2026-08-27T01:56:39Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** fixed (2026-08-26) — see Fixes Applied below

## Summary

Reviewed the full Phase 86 diff (commits d6cd003a, 35d5edd4, 3aa94f55, 06ddda94, d01304da, 352a7697,
373f92ab, 87526e8c) against the locked owner semantics in `86-CONTEXT.md`: the date-ordinal math, the
creation-only/non-clobbering auto-select, the slideout round-trip, and the additive Teams-panel UI.

**Date math (highest-risk area) is correct.** `ordinalOfMonth` (`Math.ceil(day / 7)`) is verified by hand
for every day 1–31 (1–7→1, 8–14→2, 15–21→3, 22–28→4, 29–31→5) and matches the 14 unit tests. Critically,
it never constructs a `Date` at all — it works purely on the integer parsed out of the `"YYYY-MM-DD"`
string — which sidesteps the exact local-timezone class of bug the Phase 84 `serviceDateToMillis` fix
was written to avoid, rather than merely mirroring it. `teamMatchesDate` correctly treats absent/empty
`recurrence.ordinals` as "never matches," and there is no crash path for a non-Sunday date (the helper
never inspects weekday).

**Creation-only + non-clobbering is correctly implemented.** `teamMatchesDate`/`ordinalOfMonth` are
imported nowhere outside `NewServiceDialog.vue` (confirmed by grep) — `ServiceEditorView.vue` is
untouched, so there is no retroactive path. The dual `autoAddedTeams`/`manuallyTouchedTeams` tracking
sets correctly survive repeated date changes; the 20 `NewServiceDialog.test.ts` cases (including the four
new manual-override scenarios) and a live `vitest run` of all three phase test files (52/52 passing) both
confirm this. `npm run type-check` (`vue-tsc --build`) is also clean.

**Slideout round-trip matches spec.** `TeamRecurrenceSlideOver` seeds `localOrdinals` from
`team.recurrence.ordinals` on open, and `onSave` always writes the full `{ ordinals: [...] }` object
(never a partial/dotted update), so clearing to none persists `{ ordinals: [] }` rather than leaving a
stale value — `teamMatchesDate` already treats an empty array as "no pattern," so this is consistent.

**Additive UI does not break existing guards.** The `>` chevron sits alongside the existing
Save/Delete row actions; all 13 pre-existing `TeamsConfigPanel.test.ts` assertions (WR-01 duplicate-name
guard, WR-02 rename soft-warn, WR-04 add-team in-flight guard, IN-02, R245) continue to pass alongside
the 5 new R254 tests.

Three lower-severity findings below concern robustness at the edges of the otherwise-correct
implementation: a store-load race that can silently skip the auto-select window, a missing dedupe step
on the ordinals array, and an inconsistently-applied re-entrancy guard on Save.

## Warnings

### WR-01: Auto-select can silently miss its window if the teams store hasn't loaded yet, with nothing to re-trigger it

**File:** `src/components/NewServiceDialog.vue:152-233`
**Issue:** `NewServiceDialog` is mounted once via `v-if="authStore.isEditor"` in `ServicesView.vue` (not
per-open), and `applyRecurrenceAutoSelect(form.value.date)` runs synchronously at component `setup()`
time (line 205) plus again in the `props.open` watcher (line 230). Both of these read
`teamsStore.teams` directly. `teamsStore.subscribe(orgId)` (called from `ServicesView`'s `onMounted`) is
an async `onSnapshot` subscription — if the dialog is opened before the first snapshot has arrived
(realistic on a cold cache / slow connection, e.g. a user who has the "New Service" button focused and
presses Enter/clicks immediately after page load), `teamsStore.teams` is still `[]` at the moment
`applyRecurrenceAutoSelect` runs, so it computes zero matches and pre-checks nothing. Nothing observes
`teamsStore.teams` to retroactively re-run the auto-select once the snapshot lands — the next recompute
only happens on a manual Service Date change or a dialog re-open, so a user who accepts the pre-filled
default date on that first open gets no auto-select at all, silently, for a team whose pattern genuinely
matches. This directly undercuts R255 ("auto-select on matching date") in the one window where it's
supposed to matter most (first-open UX).
**Fix:** Add a `watch(() => teamsStore.teams, () => applyRecurrenceAutoSelect(form.value.date))` (guarded
to only fire while `props.open` is true, so it doesn't fight a later manual toggle before the dialog is
even shown), or gate the initial/open-time call on `teamsStore.teams.length > 0` and retry once it
populates.

### WR-02: Ordinals are sorted but never de-duplicated on read or write

**File:** `src/components/TeamRecurrenceSlideOver.vue:144, 168`
**Issue:** `localOrdinals.value = [...(props.team?.recurrence?.ordinals ?? [])].sort((a, b) => a - b)`
(seed) and `recurrence: { ordinals: [...localOrdinals.value].sort((a, b) => a - b) }` (save) both sort but
never call anything equivalent to `Array.from(new Set(...))`. Under normal UI use `toggleOrdinal` can
never introduce a duplicate (it only pushes when `indexOf` returns `-1`), so this is unreachable through
the slideout itself today. But the `Team.recurrence.ordinals` field is plain `number[]` on an
un-validated Firestore document — nothing in `firestore.rules`' generic
`match /{collection}/{docId}` write rule (firestore.rules:496-502) constrains its shape, so a duplicate
can enter via direct Firestore console edits, a future migration, or a bug in some other future writer.
Once a duplicate is present (e.g. `[1, 1, 3]`), `toggleOrdinal(1)` only splices the *first* match, leaving
`[1, 3]` — `localOrdinals.includes(1)` is still `true`, so the UI shows the button as still selected right
after the user clicked it to turn it off, and there is no way to actually clear ordinal 1 from the UI
(each click removes one copy but the button never renders as deselected). `onSave` would then persist the
duplicate right back.
**Fix:** Dedupe on both the read-side seed and the write-side save, e.g.
```ts
localOrdinals.value = Array.from(new Set(props.team?.recurrence?.ordinals ?? [])).sort((a, b) => a - b)
// ...
recurrence: { ordinals: Array.from(new Set(localOrdinals.value)).sort((a, b) => a - b) }
```

## Info

### IN-01: `TeamRecurrenceSlideOver.onSave` has no explicit re-entrancy guard, unlike the sibling `onAddTeam`

**File:** `src/components/TeamRecurrenceSlideOver.vue:163-174`
**Issue:** `onSave` relies solely on the `:disabled="isSaving"` binding on the Save button to prevent a
double-submit; there is no `if (isSaving.value) return` guard at the top of the function itself. The same
file family (`TeamsConfigPanel.vue`'s `onAddTeam`) explicitly added a WR-04 guard
(`if (adding.value) return`) for exactly this race — a fast double-click firing the handler twice before
the DOM re-renders the `disabled` attribute — and has a regression test for it. `onSave` here doesn't
carry the same protection, so a rapid double-click could in principle call `teamsStore.updateTeam` twice
concurrently for the same team.
**Fix:** Add the same explicit guard used elsewhere in this phase's own code for consistency and defense
in depth: `if (isSaving.value) return` as the first line of `onSave`.

## Fixes Applied

All 3 findings (2 warnings, 1 info) were fixed and committed atomically.

### WR-1: fixed — commit `dcf0d584`

Added `watch(() => teamsStore.teams, () => { if (props.open) applyRecurrenceAutoSelect(form.value.date) })`
to `NewServiceDialog.vue`. Since `teamsStore.subscribe()`'s `onSnapshot` reassigns `teams.value` to a
brand-new array on every emission (`src/stores/teams.ts`), a plain (non-deep) reference watch fires once
the first real snapshot lands after the dialog is already open, recomputing auto-select for the current
form date. Guarded on `props.open`; `applyRecurrenceAutoSelect` already skips `manuallyTouchedTeams`, so
a manually-unchecked team is not re-added. Covered by two new tests in `NewServiceDialog.test.ts`: teams
arriving after open pre-checks the matching team, and a manually-unchecked team stays unchecked across a
later snapshot re-emission.

### WR-2: fixed — commit `71b4d2c3`

`TeamRecurrenceSlideOver.vue` now dedupes `localOrdinals` with `Array.from(new Set(...))` on both the
open-time seed (read) and the pre-`updateTeam` write, keeping the existing ascending sort. Covered by a
new test in `TeamsConfigPanel.test.ts` seeding a team with a duplicate ordinal (`[1, 1, 3]`) and asserting
a single click fully deselects it and Save persists `[3]` with no duplicate.

### IN-1: fixed — commit `c390e1e8`

Added `if (isSaving.value) return` as the first line of `TeamRecurrenceSlideOver.vue`'s `onSave`,
matching the sibling `onAddTeam` guard pattern in `TeamsConfigPanel.vue`. Covered by a new test asserting
a second Save click while the first save is in flight does not call `updateTeam` twice.

**Verification:** `npm run type-check` clean; scoped test files
(`NewServiceDialog.test.ts` 22/22, `TeamsConfigPanel.test.ts` 20/20) pass; a bare `npx vitest run`
confirms no failures beyond the documented 2-file baseline (`src/storage.rules.test.ts` — Storage
emulator not running; `RosterView.test.ts` — pre-existing stale assertion), 4386 tests passing.

---

_Reviewed: 2026-08-27T01:56:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-08-26T22:12:00Z_
_Fixer: Claude (gsd-code-fixer)_
