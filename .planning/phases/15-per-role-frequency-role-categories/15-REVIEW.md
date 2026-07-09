---
phase: 15-per-role-frequency-role-categories
reviewed: 2026-07-09T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/types/roster.ts
  - src/utils/scheduler.ts
  - src/stores/roster.ts
  - src/stores/quarters.ts
  - src/views/RosterView.vue
  - src/components/AvailabilityDrawer.vue
  - src/components/QuarterGrid.vue
  - src/components/RolesConfigPanel.vue
  - src/components/AvailabilityRosterTable.vue
findings:
  critical: 4
  warning: 2
  info: 3
  total: 9
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-07-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

`scheduler.ts`'s `evaluateGroupCombo`/`isGroupCompatible` and the per-(person, role) cadence/tier
lookups (`tierOf`, `servedByRole`) are correctly implemented and consistently shared between the
main assignment loop and `propagatePairing` — this is the one part of the phase that was clearly
built with the "two independent code paths must agree" risk in mind, and it holds up.

However, the per-role tier feature (`PersonQuarterData.roleTiers`) was only wired into
**some** of the read paths. `scheduler.ts` and `AvailabilityDrawer.vue`'s per-role UI read
`roleTiers` correctly, but `QuarterGrid.vue` (the manual gap-filling grid) and
`AvailabilityRosterTable.vue` (the roster status list) still read only the legacy, per-person
`frequencyTier` field — a field the new UI no longer writes non-default values into. The net
effect: marking a person "out" for one specific role via the new UI is invisible to the manual
grid's candidate list and to the roster's "Out this quarter" filter/status badge, silently
defeating the D-05 exclusion those surfaces are supposed to enforce.

Separately, two of the scoped Firestore dot-path writes in `quarters.ts` construct a
**whole-object replacement** for a nested `personQuarterData.{id}` map without carrying forward
the new `roleTiers` field, which will silently delete another person's already-tuned per-role
tiers on unrelated saves (pairing add, CSV re-import).

## Critical Issues

### CR-01: Reciprocal pairing write in `setPersonAvailability` drops the partner's `roleTiers`

**File:** `src/stores/quarters.ts:193-204`
**Issue:** When person A adds person B as a "must serve with" partner (and B doesn't already
list A back), the reciprocal write constructs a brand-new object for
`personQuarterData.${partnerId}` that only carries `personId`, `blackoutDates`, `pairedWith`,
`frequencyTier`, and `note` — `roleTiers` is never copied from
`quarter.personQuarterData[partnerId]?.roleTiers`. Because this is a Firestore dot-path field
update, the value at that path is **replaced wholesale**, not merged — so any per-role tier
B had already tuned (e.g. "out" for a specific role) is silently erased the moment someone else
pairs with them, even though B's own availability entry was never opened for editing.
```ts
for (const partnerId of added) {
  const partnerPaired = quarter.personQuarterData[partnerId]?.pairedWith ?? []
  if (!partnerPaired.includes(personId)) {
    updates[`personQuarterData.${partnerId}`] = {
      personId: partnerId,
      blackoutDates: quarter.personQuarterData[partnerId]?.blackoutDates ?? [],
      pairedWith: [...partnerPaired, personId],
      frequencyTier: quarter.personQuarterData[partnerId]?.frequencyTier ?? 'regular',
      note: quarter.personQuarterData[partnerId]?.note ?? '',
      // roleTiers missing here
    }
  }
}
```
**Fix:** Either include the existing `roleTiers` map in the reconstructed object, or (preferred)
scope the write to just the `pairedWith` sub-path so no other field can ever be clobbered,
mirroring the `removed` loop directly below it:
```ts
for (const partnerId of added) {
  const partnerPaired = quarter.personQuarterData[partnerId]?.pairedWith ?? []
  if (!partnerPaired.includes(personId)) {
    if (quarter.personQuarterData[partnerId]) {
      updates[`personQuarterData.${partnerId}.pairedWith`] = [...partnerPaired, personId]
    } else {
      updates[`personQuarterData.${partnerId}`] = {
        personId: partnerId,
        blackoutDates: [],
        pairedWith: [personId],
        frequencyTier: 'regular',
        roleTiers: {},
        note: '',
      }
    }
  }
}
```

### CR-02: `applyCsvToQuarter` wipes `frequencyTier`/`roleTiers`/`note` for every CSV-matched person

**File:** `src/stores/quarters.ts:135-139`
**Issue:** For every row in a CSV re-import, the new quarter-scoped entry is built from scratch
with only `personId`, `blackoutDates`, `pairedWith`:
```ts
personQuarterData[row.personId] = {
  personId: row.personId,
  blackoutDates: row.blackoutDates,
  pairedWith: row.pairedWith,
}
```
This entirely drops `frequencyTier`, `roleTiers`, and `note` for anyone present in the CSV,
even though the whole point of `roleTiers`/per-role tiers introduced in this phase is to be
tuned once per quarter and preserved across re-imports (mirrors the "must never clobber
already-tuned cadence" rule the phase explicitly applied to `roster.ts`'s `upsertPeople`, but
never applied here). A routine CSV re-import (the documented D-19 workflow) silently resets
every re-imported person back to "regular" tier with no per-role overrides and no note, discarding
admin-entered per-role "out"/"fill-in" decisions and quarter notes.
**Fix:** Preserve the existing entry's tier/roleTiers/note fields, same pattern already used for
standing-field preservation elsewhere in this phase:
```ts
const existingPqd = quarter.personQuarterData[row.personId]
personQuarterData[row.personId] = {
  personId: row.personId,
  blackoutDates: row.blackoutDates,
  pairedWith: row.pairedWith,
  frequencyTier: existingPqd?.frequencyTier,
  roleTiers: existingPqd?.roleTiers,
  note: existingPqd?.note,
}
```

### CR-03: `QuarterGrid.vue`'s manual candidate list ignores per-role `roleTiers`

**File:** `src/components/QuarterGrid.vue:301-319`
**Issue:** `frequencyTierOf` (used by `availableUnassigned`, which feeds the "Available, not yet
assigned" quick-assign list and the swap/add dropdowns) reads only the legacy per-person tier:
```ts
function frequencyTierOf(personId: string): FrequencyTier {
  return props.quarter.personQuarterData[personId]?.frequencyTier ?? 'regular'
}
```
The doc comment directly above it claims this "mirror[s] the auto-proposal exclusion," but
`scheduler.ts`'s `tierOf` (the actual auto-proposal exclusion) is per-(person, role):
`roleTiers?.[roleId] ?? frequencyTier ?? 'regular'`. Since the new per-role UI
(`AvailabilityDrawer.vue`) writes tier decisions into `roleTiers` and no longer updates the
legacy `frequencyTier` field for new tier changes (see WR-01), a person marked "out" for role X
via the new UI will still appear as an eligible, assignable candidate for role X in this manual
grid — an admin can freely quick-assign someone the system is supposed to treat as unavailable
for that specific role, with no warning at all (unlike the group-combo rule, which is
warn-don't-block by design; this exclusion is documented as a hard filter).
**Fix:** Mirror `scheduler.ts`'s `tierOf`, scoped by `roleId`:
```ts
function tierOf(personId: string, roleId: string): FrequencyTier {
  const pqd = props.quarter.personQuarterData[personId]
  return pqd?.roleTiers?.[roleId] ?? pqd?.frequencyTier ?? 'regular'
}
// ...
function availableUnassigned(date: string, roleId: string): Person[] {
  const assigned = new Set(cellPeople(date, roleId))
  return rosterStore.activePeople.filter(
    (p) =>
      hasRole(p, roleId) &&
      !isBlackedOut(p.id, date) &&
      !assigned.has(p.id) &&
      tierOf(p.id, roleId) !== 'out',
  )
}
```

### CR-04: `AvailabilityRosterTable.vue` status badge and "Out this quarter" filter ignore `roleTiers`

**File:** `src/components/AvailabilityRosterTable.vue:135-148, 164-168, 191-209`
**Issue:** `quarterDataFor` (backing `freqBadge`, `statusLabel`, `statusPillClass`,
`blackoutSummary`, and the `activeFilter === 'out'` filter predicate) reads only
`pqd?.frequencyTier ?? 'regular'`, never `roleTiers`. Because
`AvailabilityDrawer.vue`'s per-role tier controls (this phase's headline feature) never write to
the legacy `frequencyTier` field for new selections (see WR-01), any person marked "out" or
"fill-in" for one or more roles through the new UI will still show status "Regular" in this
table and will **not** appear when an admin filters to "Out this quarter" — the primary UI
surface admins use to audit per-quarter availability now silently fails to reflect the feature
this phase shipped.
**Fix:** Compute an aggregate/representative tier (or per-role breakdown) from `roleTiers`,
falling back to the legacy field only when `roleTiers` is absent, consistent with every other
read site in this phase:
```ts
function effectiveTiers(personId: string, heldRoleIds: string[]): FrequencyTier[] {
  const pqd = props.quarter?.personQuarterData[personId]
  if (!pqd) return ['regular']
  if (heldRoleIds.length === 0) return [pqd.frequencyTier ?? 'regular']
  return heldRoleIds.map((r) => pqd.roleTiers?.[r] ?? pqd.frequencyTier ?? 'regular')
}
// e.g. "out" filter/status = every held-role tier is 'out'; badge could show a per-role summary
```

## Warnings

### WR-01: `AvailabilityDrawer.vue`'s own readout/N-input are gated on the now-stale legacy tier field

**File:** `src/components/AvailabilityDrawer.vue:86, 409-419`
**Issue:** `selectRoleTierPreset` (the new per-role control) only ever writes
`draft.roleTiers[roleId]`; nothing in this phase's changes updates the top-level
`draft.frequencyTier` any more except `onFrequencyNChange`, which unconditionally forces it back
to `'regular'`. Yet the template still gates the "1-in-N" number input and `freqReadout`'s
message on `draft.frequencyTier === 'regular'` / its value, e.g.:
```html
<span v-if="draft.frequencyTier === 'regular'">1-in-<input v-model.number="draft.frequencyTargetN" ... /></span>
```
and
```ts
const freqReadout = computed<string>(() => {
  if (draft.frequencyTier === 'out') return 'Excluded from every proposal this quarter.'
  ...
})
```
Once a role is set to "out"/"fill-in" via the new per-role buttons, `draft.frequencyTier`
never reflects it, so this summary line and the N-input's visibility are effectively frozen at
whatever the legacy field happened to be on load — they no longer describe what the per-role
buttons above them just set. This is the same root cause as CR-03/CR-04, but visible within the
very component that introduced the per-role feature.
**Fix:** Either remove the legacy readout/gating entirely (roleTiers now carries the real state,
one row per role already shows it) or recompute the readout per-role/aggregate from
`draft.roleTiers` instead of `draft.frequencyTier`.

### WR-02: No guard against a zero or non-positive cadence producing `Infinity`/`NaN` scheduling scores

**File:** `src/utils/scheduler.ts:210-224`, `src/utils/volunteerCsv.ts:53-56`
**Issue:** `scheduler.ts` computes `n = p.roleFrequencies?.[roleId] ?? p.frequencyTargetN` and
then `deficit = (dateIndex + 1) / n - getServedByRole(...)`. `n` is never validated to be `> 0`.
`volunteerCsv.ts`'s `frequencyLabelToN` accepts the free-text pattern `1-in-(\d+)`, which matches
`"1-in-0"` and returns `0` unchecked:
```ts
const oneInNMatch = normalized.match(/^1-in-(\d+)$/)
if (oneInNMatch) {
  return Number(oneInNMatch[1]) // "1-in-0" -> 0, never rejected
}
```
A `0` here flows straight into `frequencyTargetN`/`roleFrequencies` via CSV import, producing
`n = 0` in the scheduler, `Infinity` deficits, and — if two or more such candidates are compared
in the same sort pass — `Infinity - Infinity = NaN`, which makes `Array.prototype.sort`'s
comparator result unspecified/non-deterministic, undermining the scheduler's documented
determinism guarantee.
**Fix:** Reject `n <= 0` in `frequencyLabelToN` (treat as unrecognized, same as any other bad
input), and defensively clamp in the scheduler: `const n = Math.max(1, p.roleFrequencies?.[roleId] ?? p.frequencyTargetN)`.

## Info

### IN-01: `formFrequencyN` is set and persisted but has no template control

**File:** `src/views/RosterView.vue:431, 467, 478, 502`
**Issue:** The old single "Serve frequency" `<select v-model.number="formFrequencyN">` was
removed in favor of per-role cadence selects, but `formFrequencyN` itself is still declared,
reset in `onAddVolunteer`, populated in `onEditPerson`, and sent to the store in
`onSaveVolunteer` as `frequencyTargetN`. It is never bound to any input in the template, so it
silently passes through whatever value was loaded (or the `4` default for new volunteers) with
no way for a user to intentionally change it from this form. Functionally harmless (the value is
only a documented fallback), but confusing for future maintainers who will not find where it's
supposed to be edited.
**Fix:** Add a short comment near the declaration noting it is write-through-only and
intentionally has no direct control in this form, or remove the field and always send
`existing.frequencyTargetN` unchanged from `updatePerson`'s partial-patch semantics.

### IN-02: Inconsistent held-role ordering between the two per-role UIs

**File:** `src/components/AvailabilityDrawer.vue:330-336` vs `src/views/RosterView.vue:440-442`
**Issue:** `RosterView.vue`'s `heldRolesSorted` explicitly sorts by `rosterStore.rolesSorted`
(alphabetical), but `AvailabilityDrawer.vue`'s `heldRoles` computed just maps
`person.roles` (Firestore array order, effectively arbitrary/insertion order) with no sort. The
two per-role controls for the same person can list roles in a different order depending on
which drawer you open.
**Fix:** Sort `heldRoles` in `AvailabilityDrawer.vue` the same way, e.g.
`rosterStore.rolesSorted.filter((r) => person.roles.includes(r.id))`.

### IN-03: Unnecessary `deep: true` on a primitive-array watch

**File:** `src/views/RosterView.vue:447-460`
**Issue:** `watch(formRoles, ..., { deep: true })` deep-watches a `ref<string[]>` of role IDs
(primitives). Vue already fires the callback on array reassignment or in-place mutation without
`deep`; `deep: true` here only adds unnecessary per-element comparison overhead for no behavioral
benefit, since the callback body doesn't rely on deep-mutation detection (it only reads
`newRoles`/`oldRoles` as whole arrays).
**Fix:** Drop `{ deep: true }` (a plain `watch(formRoles, ...)` is sufficient since `formRoles`
is only ever reassigned wholesale, never mutated in place, elsewhere in this file).

---

_Reviewed: 2026-07-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
