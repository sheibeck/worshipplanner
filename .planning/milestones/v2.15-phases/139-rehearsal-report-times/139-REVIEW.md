---
phase: 139-rehearsal-report-times
reviewed: 2026-09-09T00:00:00Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - src/utils/rehearsalTimes.ts
  - src/utils/__tests__/rehearsalTimes.test.ts
  - src/types/service.ts
  - src/types/organization.ts
  - src/stores/services.ts
  - src/utils/rehearseAccess.ts
  - src/stores/__tests__/services.rehearsalDefaults.test.ts
  - src/stores/__tests__/services.rehearsalProjection.test.ts
  - src/stores/__tests__/services.test.ts
  - src/views/ServiceEditorView.vue
  - src/views/SettingsView.vue
  - src/views/__tests__/SettingsView.test.ts
  - src/components/ServiceCard.vue
  - src/components/ScheduleServiceCard.vue
  - src/components/__tests__/ScheduleServiceCard.test.ts
  - src/views/MyScheduleView.vue
  - src/views/ShareView.vue
  - src/views/DashboardView.vue
  - src/views/VolunteerServiceView.vue
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: issues_found
fixed_at: 2026-09-09T00:00:00Z
fix_status: partial
---

## Fix Status (2026-09-09)

- **CR-01: FIXED** — commit `6e281581`. Added `isDisplayableRehearsal` (requires both `date` AND
  `time`) to `src/utils/rehearsalTimes.ts`, exported it, and replaced the duplicated
  `r.date !== ''` filter at all five cited call sites (`services.ts`, `rehearseAccess.ts`,
  `ServiceCard.vue`, `DashboardView.vue`, `ServiceEditorView.vue`'s `readOnlyRehearsals`). The
  editor's `editableRehearsals` (which intentionally still shows every row, including
  undated/untimed seed rows, for in-progress editing) was left unchanged — only the read-only
  display path was tightened. `formatWallClockTime` now defensively returns `''` for an
  empty/malformed input instead of "Invalid Date". Added regression tests: 4 new
  `isDisplayableRehearsal` unit tests + a "Invalid Date" guard test in
  `rehearsalTimes.test.ts`, and 2 new dated-but-timeless projection tests in
  `services.rehearsalProjection.test.ts`. `npm run type-check` clean; full `npx vitest run`
  shows only the pre-existing `storage.rules.test.ts` baseline failure (230/231 files passing).

- **CR-02: FIXED** — commit `5537daea`. Split the Times subsection's condition from
  `v-if="!canEditService && hasStuff"` / `v-else` to a bare `v-if="!canEditService"` (with the
  "anything to show" check moved to `v-show` on the read-only `<p>`), matching the date picker's
  established pure-`canEditService` pattern one section above. Added `:disabled="!canEditService"`
  to the three interactive inputs as defense in depth (mirrors `SettingsView.vue`). Added
  `ServiceEditorView.timesSection.test.ts` (5 tests) covering: editable UI renders for an editor
  on a draft service; editable UI does NOT render for a non-editor with no times set; editable UI
  does NOT render for an editor viewing a locked (`planned`) service with no times set; inputs
  carry the `:disabled` binding; `onAddRehearsal` no-ops when `canEditService` is false.

- **WR-01: CLOSED (as a side effect of CR-02's fix).** `ServiceEditorView.timesSection.test.ts`
  now covers the read-only/editable split and the add-handler no-op path, closing the coverage
  gap this finding flagged.

- **WR-02: NOT FIXED (left as documented, non-blocking).** `createService` still writes
  `reportTime: ''` / `rehearsals: []` rather than omitting the keys. Confirmed harmless (every
  projection builder and display site treats `''`/`[]` identically to "absent" via
  truthy/length checks) and scoped by the reviewer as a quality-only JSDoc-contract nuance, not a
  functional defect. Deferred to a future pass rather than risking scope creep on this fix round.

- **IN-01: NOT FIXED (left as documented, scoped-as-expected).** `SettingsView.vue`'s
  "Rehearsal & Report Defaults" save/revert/filter logic still has no dedicated automated test —
  the phase's own plan deferred this to human UAT (no `tdd="true"` on the relevant task).

- **IN-02: CLOSED (as a side effect of CR-01's fix).** The duplicated filter predicate is now the
  single shared `isDisplayableRehearsal` export in `src/utils/rehearsalTimes.ts`, consumed by all
  five former call sites.

# Phase 139: Code Review Report

**Reviewed:** 2026-09-09
**Depth:** deep
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the full diff from `94821ad7..HEAD` for Phase 139 (rehearsal/report times), covering both
139-01 (foundation: types, `rehearsalTimes.ts` util, org defaults, copy-not-live-bind `createService`,
both projection builders) and 139-02 (editor UI, Settings defaults UI, and display on six read-only
surfaces).

The load-bearing structural claims hold up under direct inspection: `formatWallClockTime`/
`sortRehearsals` are timezone-safe (verified against a live `TZ`-override test run), `createService`
performs a real array/object copy (not an alias) so a later org-default edit cannot retroactively
mutate an already-created service (verified with `npm run type-check` clean and the new
`services.rehearsalDefaults.test.ts` passing), and both `buildServiceSnapshot` and `buildRehearseAccess`
carry `rehearsals`/`reportTime` with matching filter/sort/omit treatment. All new/updated unit tests
pass, and a full `npx vitest run` shows only the pre-existing documented `storage.rules.test.ts`
baseline failure (5726/5760 passing, 1/230 files failing) — no regression.

However, two real defects were found by tracing edge cases the test suite does not cover:

1. A dated-but-time-blank rehearsal row (a very plausible mid-edit state: planner picks a date,
   has not yet picked a time) is not filtered anywhere in the pipeline and renders the literal string
   `"Invalid Date"` on live, including the **public** Share page.
2. The `ServiceEditorView.vue` "Times" subsection's `v-if`/`v-else` split does not actually gate on
   `canEditService` the way its own comment and the codebase's established pattern (the date picker
   immediately above it) claim to — a non-editor or a viewer of a locked service sees the fully
   interactive Add/Edit/Remove UI whenever the service has no times set yet.

Both are reproducible from direct code reading (traced below) and neither is caught by any existing or
new test — the new automated tests exercise the "happy path" (fully-filled rows) and the store-layer
projection filters, but never a partially-filled row, and there is zero test coverage of
`ServiceEditorView.vue`'s new Times subsection at all.

## Critical Issues

### CR-01: Dated-but-timeless rehearsal renders literal "Invalid Date" text, including on the public Share page

**File:** `src/stores/services.ts:199` (and identically `src/utils/rehearseAccess.ts:271`,
`src/components/ServiceCard.vue:172`, `src/views/DashboardView.vue:422`,
`src/views/ServiceEditorView.vue:2810`)

**Issue:** Every filter that decides whether a rehearsal row is "real" checks only `r.date !== ''`:

```ts
// src/stores/services.ts:199 — identical logic duplicated at the 4 other sites above
const datedRehearsals = (service.rehearsals ?? []).filter((r) => r.date !== '')
```

Nothing anywhere in the pipeline checks `r.time`. A rehearsal row with `date: '2026-09-11', time: ''`
(the natural in-progress state right after a planner fills the date `<input type="date">` and has not
yet touched the time `<input type="time">` — and this state autosaves immediately via the existing
800ms debounce, `onDateChange`'s sibling `onRehearsalDateChange`) passes the filter cleanly and is
handed to `formatWallClockTime('')`:

```ts
// src/utils/rehearsalTimes.ts:38
export function formatWallClockTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
```
`''.split(':')` is `['']`, `Number('')` is `0`, `m` is `undefined` → `new Date(2000, 0, 1, 0, undefined)`
is an Invalid Date → `.toLocaleTimeString()` returns the literal string `"Invalid Date"` (verified with
`node`, not just read):
```
$ node -e "console.log(new Date(2000,0,1,0,undefined).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}))"
Invalid Date
```

Because `updateService` calls `maybeRefreshShareLink` on **every** autosave (not just at lock/
`markAsPlanned`), this string reaches the **public, unauthenticated Share page**
(`src/views/ShareView.vue`) live, mid-edit, the moment a planner autosaves a date-only rehearsal row on
an already-shared service — not only the internal-only `RehearseAccessDoc` surfaces that are deferred
to the next `markAsPlanned` refresh. It also shows on `ServiceCard`, `DashboardView`,
`ScheduleServiceCard` (via `MyScheduleView`), `VolunteerServiceView`, and the editor's own read-only
branch.

None of the new tests exercise this state — `services.rehearsalProjection.test.ts` only tests
`date: ''` (fully undated) vs. fully-filled rows, never a dated-row-with-blank-time.

**Fix:** Filter (or coerce) on both fields wherever a rehearsal is treated as "complete," ideally by
adding one shared predicate to `src/utils/rehearsalTimes.ts` so the 5 duplicated filter call sites don't
each need an independent fix:

```ts
// src/utils/rehearsalTimes.ts
export function isDatedRehearsal(r: Rehearsal): boolean {
  return r.date !== '' && r.time !== ''
}
```
and replace every `.filter((r) => r.date !== '')` (services.ts, rehearseAccess.ts, ServiceCard.vue,
DashboardView.vue, ServiceEditorView.vue) with `.filter(isDatedRehearsal)`. Additionally, consider
making `formatWallClockTime` defensive (`return hhmm ? ... : ''`) as a second line of defense so a
future bad caller degrades to an empty string instead of visible garbage text.

---

### CR-02: ServiceEditorView "Times" subsection is not actually gated on `canEditService` — non-editors and viewers of locked services get the full interactive Add/Edit/Remove UI whenever no times are set yet

**File:** `src/views/ServiceEditorView.vue:252-266`

**Issue:** The section's own comment claims to mirror the date picker's `v-if="!canEditService"` /
`v-else` split (line ~51), but the actual condition is not a pure `canEditService` check:

```vue
<div class="mb-3" data-testid="service-times-section">
  <p
    v-if="!canEditService && (readOnlyRehearsals.length > 0 || !!localService.reportTime)"
    ...
  >...</p>

  <template v-else>
    <h2>Times</h2>
    <!-- Add / Edit / Remove rehearsal rows + Report time input, all fully
         interactive, none of the <input>s carry a :disabled binding -->
  </template>
</div>
```

`v-else` is the negation of the entire `v-if` expression: `canEditService || !hasStuff`. So the editable
branch renders whenever `canEditService` is true **OR whenever there is nothing to show**, regardless of
edit permission. Concretely: any non-editor viewing a service that has no rehearsal/report times set
yet (the default state of every newly-created service before a planner has visited the Times section),
or any editor viewing a **locked** (`planned`/`exported`) service that has no times set, sees the entire
canEditService-gated UI: the "+ Add rehearsal" button, un-disabled `<input type="date">` /
`<input type="time">` rows, "Remove" buttons, and the report-time input — none of which are
`:disabled`-bound (contrast with `SettingsView.vue`'s equivalent inputs, which are all
`:disabled="!authStore.isEditor"`).

This does not corrupt data — `onAddRehearsal`/`onRemoveRehearsal`/`onRehearsalDateChange`/
`onRehearsalTimeChange`/`onReportTimeChange` each independently re-check `canEditService.value` and
silently no-op, and Firestore rules independently block the write — but it is a real, easily-reproduced
UX/authorization-surface bug: a viewer gets fully interactive form controls that silently discard every
edit with zero feedback, directly contradicting the phase's own stated must-have ("gated by
`canEditService`") and the comment's own claim to mirror the pure `v-if="!canEditService"` pattern used
one section above it. There is no test coverage anywhere for this subsection (no
`ServiceEditorView.*.test.ts` references `service-times-section`/`rehearsal-date-input`/
`report-time-input`), so nothing caught this.

**Fix:** Split the condition into what it should be — a bare `canEditService` gate for which branch
renders, and the "anything to show" check only for whether the read-only branch renders content at all:

```vue
<div class="mb-3" data-testid="service-times-section">
  <p
    v-if="!canEditService"
    v-show="readOnlyRehearsals.length > 0 || !!localService.reportTime"
    ...
  >...</p>

  <template v-else>
    ...
  </template>
</div>
```
(or simply always render the empty read-only `<p>` — an empty paragraph is harmless — rather than
changing which template branch is chosen based on content). Also add `:disabled="!canEditService"` to
the three inputs as defense in depth, matching `SettingsView.vue`'s convention.

## Warnings

### WR-01: No automated test coverage for the ServiceEditorView "Times" subsection's add/edit/remove logic or its read-only/editable split

**File:** `src/views/ServiceEditorView.vue:2792-2845`

**Issue:** `onAddRehearsal`, `onRemoveRehearsal`, `onRehearsalDateChange`, `onRehearsalTimeChange`,
`onReportTimeChange`, and the `v-if`/`v-else` display split (CR-02) have zero test coverage. 139-02's
plan explicitly scoped Task 1's verification to `npm run type-check` + a deferred human-check, so this
is a plan-sanctioned gap rather than a deviation — but it is precisely the code containing CR-02, and a
basic `@vue/test-utils` mount asserting "the editable Times UI does not render for a non-editor viewing
a timesless service" would have caught it for near-zero cost (the pattern already exists in this same
plan's `ScheduleServiceCard.test.ts`).

**Fix:** Add a small component test file (e.g. `ServiceEditorView.timesSection.test.ts`) covering: (a)
editable UI renders when `canEditService` is true; (b) editable UI does NOT render when
`canEditService` is false, regardless of whether times are set; (c) add/remove/edit handlers no-op when
`canEditService` is false.

### WR-02: `createService` writes `reportTime: ''` / `rehearsals: []` onto every new service, contradicting the field's own documented "absent means unset" contract

**File:** `src/stores/services.ts:472-495`

**Issue:** `Service.reportTime`'s JSDoc (`src/types/service.ts:281-286`) and `Service.rehearsals`'s
JSDoc both describe "additive, no-migration... absent on every service doc written before this field
existed, which is the legitimate 'no times set' state." But `createService` unconditionally writes both
fields (as `''` / `[]`) into the `addDoc` payload and the parallel `created` object for **every** new
service, even when `authStore.settings.rehearsalTimeDefaults`/`reportTimeDefault` are themselves unset.
So post-Phase-139 services never actually reach the "absent" state the type comment describes as
legitimate — only pre-Phase-139 services do. This is functionally harmless (both projection builders
and every display site treat `''`/`[]` identically to "absent" via truthy/length checks), but it's a
quality inconsistency between the documented contract and the actual write path, and it means a
`'rehearsals' in service` / `'reportTime' in service` check (the exact style the phase's own
`services.rehearsalProjection.test.ts` uses for the *projection* objects) would behave differently for a
raw `Service` doc than the JSDoc promises.

**Fix:** Either update the JSDoc to say "absent, or present-but-empty, both mean unset" for clarity, or
have `createService` omit the keys entirely when the corresponding org default is empty/unset (mirroring
the conditional-spread idiom the projection builders already use).

## Info

### IN-01: `SettingsView.vue`'s new "Rehearsal & Report Defaults" section has no automated test coverage of its own save/revert/filter behavior

**File:** `src/views/SettingsView.vue:1355-1385`

**Issue:** `onSaveRehearsalDefaults` has real branching logic worth a unit test — it filters blank rows
before saving (`newRehearsalDefaults = rehearsalTimeDefaultsInput.value.filter((t) => t !== '')`) and
reverts both local refs on a failed `updateOrgSettings` call. The diff to `SettingsView.test.ts` only
adds mock scaffolding (new getters/setters so pre-existing tests keep mounting) — no test in the
211-line diff actually clicks "Save defaults," asserts the blank-row filter, or asserts the
revert-on-error path. 139-02's plan deferred this to human UAT (no `tdd="true"` on Task 1), so this is
scoped-as-expected rather than a deviation, but it's the same style of gap as WR-01 — untested branching
logic in a section that otherwise looks correct by inspection.

**Fix:** Low-cost follow-up: a `describe('Rehearsal & Report Defaults')` block asserting the blank-row
filter and the revert-on-error behavior, mirroring the existing `describe('SettingsView Messaging
card...')` structure already in this file.

### IN-02: The "undated rehearsal" filter predicate is duplicated ad hoc across 5 call sites instead of being one shared helper

**File:** `src/stores/services.ts:199`, `src/utils/rehearseAccess.ts:271`, `src/components/ServiceCard.vue:172`,
`src/views/DashboardView.vue:422`, `src/views/ServiceEditorView.vue:2810`

**Issue:** `(service.rehearsals ?? []).filter((r) => r.date !== '')` is copy-pasted five times rather
than being one exported helper in `src/utils/rehearsalTimes.ts` alongside `sortRehearsals`/
`formatWallClockTime` — the exact "one shared time utility... no 6th hand-rolled copy" principle
139-01's own plan states for `sortRehearsals`/`formatWallClockTime` themselves. This is precisely why
the CR-01 bug (filter checks `date` only, not `time`) had to be fixed in five places instead of one.

**Fix:** See CR-01's fix — extracting `isDatedRehearsal`/`hasCompleteTime` into `rehearsalTimes.ts`
resolves both findings at once.

---

_Reviewed: 2026-09-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
