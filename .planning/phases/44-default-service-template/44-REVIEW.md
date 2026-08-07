---
phase: 44-default-service-template
reviewed: 2026-08-07T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/types/organization.ts
  - src/utils/slotTypes.ts
  - src/stores/services.ts
  - src/components/settings/ServiceTemplateEditor.vue
  - src/views/SettingsView.vue
  - src/utils/__tests__/slotTypes.test.ts
  - src/stores/__tests__/services.test.ts
  - src/components/settings/__tests__/ServiceTemplateEditor.test.ts
  - src/views/__tests__/SettingsView.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-08-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed the default-service-template feature: `ServiceTemplateEntry`/`OrgSettings.defaultServiceTemplate`
in `organization.ts`, the ordinal VW-type mapping in `slotTypes.ts`
(`progressionVwTypeSequence`/`buildSlotsFromTemplate`), `services.ts::createService`'s reroute to
template-driven slot construction, and the `ServiceTemplateEditor.vue` slide-out plus its
`SettingsView.vue` host.

The correctness-critical logic checked out under manual trace and against the test suite:

- **Ordinal VW mapping is correct.** `progressionVwTypeSequence` reads `PROGRESSION_SLOT_TYPES` as a
  position-sorted sequence (`1-2-2-3` → `[1,2,2,3,3]`), and `buildSlotsFromTemplate` walks it by a
  running `songOrdinal` counter that increments only on `SONG` entries — verified against a manual
  trace of `Prayer, Song, Song, Scripture, Song` (VW types `1, 2, 2` on the three SONG entries, in
  order) and against the `44-01` test block (`slotTypes.test.ts:793-860`), including the 7-song
  modulo-cycle case and the VW-off passthrough to `createSlot`'s default `2`.
- **Empty-template override confirmed.** `createService` calls `buildSlotsFromTemplate` directly with
  no `?? buildSlots(...)` fallback (`services.ts:232-235`); an empty `defaultServiceTemplate` produces
  `slots: []`, pinned by `services.test.ts:489-506`.
- **Single merge point confirmed.** `auth.ts::loadOrgContext` (lines 183-206) is the only place
  `DEFAULT_ORG_SETTINGS` is spread against Firestore data; a repo-wide grep found no second
  `?? []`/defaults-merge for `defaultServiceTemplate`, and `SettingsView.vue`/`ServiceTemplateEditor.vue`
  both read `authStore.settings.defaultServiceTemplate` directly.
- **No content freezing.** `ServiceTemplateEntry` is `{id, kind, section?}` only; `buildSlotsFromTemplate`
  never reads a stored VW type and computes it fresh every call.
- **Firestore undefined safety.** `ServiceTemplateEditor.vue::onSave` runs `stripUndefined(draft.value)`
  before the `updateDoc`, and `stripUndefined` recurses into arrays/plain objects — verified this drops
  `addEntry`'s explicit `section: undefined` key (test at `ServiceTemplateEditor.test.ts:173-194`
  asserts the saved entry has exactly `['id', 'kind']`).
- **Draft cloning confirmed.** The `props.isOpen` watcher clones each entry (`{...entry}`) into a local
  `draft` ref; every mutation (add/remove/reorder/section-change/reset) touches only `draft` until
  `onSave` writes the dot-path key and reassigns `authStore.settings.defaultServiceTemplate`.
- No `v-html` anywhere in the reviewed files; icon-only controls (close, drag handle, remove) all carry
  `aria-label`.

`npm run type-check` (the CLAUDE.md-mandated gate, not the narrower `-p tsconfig.app.json` form) is
clean, and the four test files reviewed here (200 tests) pass with `npx vitest run --dir src --exclude
'**/rules.test.ts'`.

Two robustness/consistency gaps are worth fixing before this ships (Warnings below); two are cosmetic
(Info).

## Warnings

### WR-01: `ServiceTemplateEditor.vue`'s Reset/Save controls don't disable for a non-editor, unlike every sibling Settings control

**File:** `src/components/settings/ServiceTemplateEditor.vue:172-186`
**Issue:** Every other Settings toggle this phase touches (`vwModeInput`, `aiEnabledInput`,
`pcEnabledInput` in `SettingsView.vue`) disables its own control with `:disabled="!authStore.isEditor"`
in addition to gating the save handler — defense in depth, so a role change mid-session (or any other
way the panel ends up open for a non-editor) can't even attempt a local edit. `ServiceTemplateEditor.vue`
breaks that pattern:
- `template-reset` has no `:disabled` binding at all, and `onResetClick`/`applyReset` (lines 405-420)
  have no `authStore.isEditor` check anywhere — a non-editor can freely clear/replace the draft.
- `template-save` is only disabled by `isSaving` (line 182); the `!authStore.isEditor` check exists
  solely inside `onSave` (line 430), so clicking Save as a non-editor silently no-ops with zero
  feedback (no error message, no indication the click did nothing).

In practice the panel is only reachable today because `SettingsView.vue`'s "Edit Default Template"
button is disabled for non-editors, so this is not currently exploitable through the UI. But it's a
real inconsistency with the established pattern in this same phase, and it means a role downgrade
while the panel is already open (or any future caller that opens this component without going through
that specific button) gets silent, unguarded local mutation and a silently-failing Save.
**Fix:**
```vue
<button ... :disabled="!authStore.isEditor" data-testid="template-reset" @click="onResetClick">Reset to 1-2-3 default</button>
<button ... :disabled="isSaving || !authStore.isEditor" data-testid="template-save" @click="onSave">...</button>
```
and add an early return in `onResetClick`/`applyReset` mirroring the `onSave` guard.

### WR-02: `onTemplateSortEnd` never clears `section` when an item moves into the ungrouped bucket

**File:** `src/components/settings/ServiceTemplateEditor.vue:336-357`
**Issue:** The handler only updates `moved.section` on the "into a named section" branch:
```js
if (toKey !== 'ungrouped') {
  moved.section = toKey
}
```
There's no corresponding `else { moved.section = undefined }` for `toKey === 'ungrouped'`. Today this is
masked because the ungrouped Sortable container is configured `put: false` (line 381), so SortableJS's
own drag machinery refuses a drop into it and `onEnd` never fires with a real cross-section move into
that bucket. But the JS handler itself has no independent guarantee of that — it's relying entirely on
an external library's group config to make an inconsistent code path unreachable. If that config is
ever weakened (a future refactor, a shared-group typo, or a direct call as already exists in this file's
own test suite via `options.onEnd?.(...)`), an entry would land in the `legacy`/ungrouped array bucket
for exactly one render pass, then on the *next* render `sectionGroups`' `groupBySection(draft.value,
(entry) => entry.section)` (line 289) would re-derive grouping purely from `entry.section` — which is
still the OLD named section — and silently snap the item back to its original section, discarding the
just-performed reorder without any error or indication to the user.
**Fix:**
```js
if (toKey !== 'ungrouped') {
  moved.section = toKey
} else {
  moved.section = undefined
}
```

## Info

### IN-01: `templateSummary` copy is grammatically wrong for singular counts

**File:** `src/views/SettingsView.vue:385-393`
**Issue:** `` `${entries.length} items across ${sectionCount} sections` `` always pluralizes both nouns,
so a 1-entry/1-section template reads "1 items across 1 sections" — the test suite even pins this exact
string (`SettingsView.test.ts:432-439`, `'2 items across 1 sections'`).
**Fix:** Pluralize conditionally, e.g. `` `${entries.length} ${entries.length === 1 ? 'item' : 'items'} across ${sectionCount} ${sectionCount === 1 ? 'section' : 'sections'}` ``, and update the pinned test string.

### IN-02: Per-item section `<select>` relies on `title`, not `aria-label`, for its accessible name

**File:** `src/components/settings/ServiceTemplateEditor.vue:108-117`
**Issue:** The drag handle and remove button in the same row both carry explicit `aria-label`s, but the
section `<select>` only has `title="Section"`. `title` is not a reliable accessible-name source across
assistive technologies (support varies by browser/AT combination), unlike `aria-label`.
**Fix:** Add `aria-label="Section"` alongside the existing `title` attribute for consistency with the
row's other controls.

---

_Reviewed: 2026-08-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
