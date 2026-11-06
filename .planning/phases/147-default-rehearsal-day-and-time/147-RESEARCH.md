# Phase 147: Default Rehearsal Day and Time - Research

**Researched:** 2026-11-06
**Domain:** Vue 3 + Pinia + Firestore app; org-settings field, store-level auto-add, editor date handler, add-form pre-fill, public-projection narrowing; first feature built to the Phase 146 spec-first standard
**Confidence:** HIGH (every integration point was read in code; the date-persistence gap, the timezone technique and the red-window behaviour were each reproduced by running code in this repo)

## Summary

The feature is small in code and large in bookkeeping. The code is: one new `OrgSettings` field, a few pure date helpers in `src/utils/rehearsalTimes.ts`, an auto-add in `createService`, a move in the editor's `onDateChange`, a computed default for the add form's Date, one Settings `<select>`, and narrowing of two public projections. The bookkeeping is a 55-criterion spec that must exist before any test or code, and a plan split that keeps `src/__tests__/specCoverage.test.ts` red only for criteria whose plan has not run yet.

**Three findings change the plan and the planner must read them first.**

1. **A service date change made in the editor is never saved today.** `onSave` in `ServiceEditorView.vue` sends an explicit allow-list payload (`name, teams, sermonPassage, sermonTopic, notes, status, slots, stageLayout, stageLayoutAutoSeeded, rehearsals, reportTime`). `date` is not in it, and never was (git history shows `date` was never added). I reproduced this by running the real view test harness: `onDateChange('2026-12-25')` then a second change, one autosave fired, payload keys exactly as above. `onDateChange` is the only code path that edits `date` on an existing service, so R462 as written ("changing a service's date moves an auto-added rehearsal") would persist the moved rehearsal but not the date, leaving the document inconsistent on reload. This phase must make the date persist, and the new payload key must be added in two places (the payload and the post-save "mirror" comparison) or `isDirty` strands and autosave loops. See Pitfall 1 and Open Question 1.
2. **Row flag is the right marker, but only with a shared narrowing function.** A flag on the row rides the existing `rehearsals` payload and dirty-mirror with no new plumbing, and removal or edit of the row removes or clears it for free. The cost is that both public projections spread whole rows, so narrowing is mandatory (it is also what the roadmap already demands). Recommended: `autoAdded?: true` on the stored row, narrowed by one shared `toPublicRehearsal` used by both builders.
3. **The timezone proof must be in-process.** `process.env.TZ = '...'` assigned inside a vitest test works on this Windows machine and is restored in `finally`. A shell prefix `TZ=Pacific/Kiritimati npx vitest ...` from Git Bash is **silently ignored** (the child sees `process.env.TZ === undefined`, zone stays America/New_York); only `TZ=UTC` and PowerShell `$env:TZ=` work. A test that relies on the shell prefix would pass vacuously.

**Primary recommendation:** Six plans in five waves (spec, foundation, store plus Settings/panel UI in parallel, editor, ADR and close-out). Store the weekday as `number | null` (0 = Sunday to 6 = Saturday, `null` = none), mark the auto row with `autoAdded: true`, do all calendar maths with UTC arithmetic on the `YYYY-MM-DD` text, persist `date` in `onSave`, and prove timezone independence by switching `process.env.TZ` inside the test at UTC-11, UTC and UTC+14 with a canary assertion on `getTimezoneOffset()`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Decided earlier (owner, 2026-11-06; do not reopen)
- One default weekday, not several. When the service falls on that weekday, the rehearsal is the same day.
- New services get the rehearsal automatically. This reverses parts of ADR-0245 (a) and (b).
- "Admin" in R459 means the existing editor gate.
- Defaults apply at creation only; there's no data migration.
- The Planning Center export's hard-coded Wednesday rehearsal is out of scope.

#### Spec-first order
- **Spec file:** `docs/specs/default-rehearsal.md`, code `RHD`, so IDs read `AC-RHD-01`. Each of R459-R465 traces to at least one numbered criterion, using the `(R460)` suffix.
- **Git history:** the spec commit comes ahead of every test and code commit for this phase. This is success criterion 1, so a dedicated first plan or task should land only the spec.
- **Red window:** a bare `npx vitest run` fails on purpose from the spec commit until tests cite every criterion, with `src/__tests__/specCoverage.test.ts` naming each uncited ID. Nothing may quiet it with an empty test or an exclusion. It must be green by the end of the phase.
- **Test-first:** stores and utilities get a failing test first. UI layout tests may land with the code but must cite the spec's criteria.

#### Moving a service
- **A removed auto-added rehearsal stays gone.** Only a rehearsal still on the service moves, and nothing re-adds one.
- **Landing on an existing rehearsal:** same date and same time keeps one row, with no duplicate. Same date and a different time keeps both.
- **"Changed":** editing the date or time of an auto-added rehearsal ends auto-moving for good, even if it's set back to the old value. There's no comparison with the original.
- **A rehearsal date in the past is still added.** R460 has no exception, and a planner can remove it.
- From R462: a moved rehearsal keeps its own weekday and time, even if the Settings default has changed since.

#### The add-rehearsal form
- **Weekday set, no default time:** the date still fills in and the time stays blank. R461 only stops the auto-add.
- **Which weekday:** the current Settings weekday, worked out from the service's current date. Nothing extra is stored on the service. Only an auto-added rehearsal keeps its own weekday.
- **Planner edits stand** until they add the rehearsal. If they haven't touched the date, it follows the service. This matches how the time field already works (`newTimeOverride`).
- **No note** says the date came from a default.
- From R464: if the service already has a rehearsal on the default date, the date stays blank. So adding that rehearsal leaves the date blank for the next one.

#### Settings and what planners see
- **Control:** a "Default rehearsal day" dropdown (None, then Sunday to Saturday) in the existing Rehearsal & Report Defaults card, saved by that card's Save button. It's editor-gated like the rest of the card.
- **Help text:** "New services start with one rehearsal on the default day at the first default time. The report time is copied onto every new service. Changing these defaults doesn't affect existing services." This replaces the current text, so `src/views/__tests__/SettingsView.test.ts:367` changes on purpose.
- **No visible marker:** in the Times tab an auto-added rehearsal looks like any other rehearsal, for every role.

#### ADR
- A new ADR-0249 supersedes ADR-0245 (b) and the parts of (a) this reverses: "created only by the Times-tab add form" and "always picked by the planner". (c)-(f) stand. Update ADR-0245's status and the `docs/adr/README.md` row.

### Claude's Discretion
- How the marker is stored (a flag on the rehearsal row is what the roadmap assumes) and its name.
- How the weekday is stored in `OrgSettings` (number or name), as long as "none" is distinct and old orgs with no value read as none.
- The pure helper names and where they sit, likely `src/utils/rehearsalTimes.ts`.

### Deferred Ideas (OUT OF SCOPE)
- Planning Center export using real rehearsals (already a v2 requirement).
- Several default rehearsal days (out of scope; a second rehearsal is picked by hand).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R459 | An admin can set one default rehearsal weekday, or none, in Settings. | `OrgSettings.rehearsalDefaultWeekday: number \| null` merges through the single `applyOrgSnapshot` spread, so an old org reads `null`; `updateOrgSettings` dot-path write and `firestore.rules` `organizations/{orgId}` update need no change (Q4) |
| R460 | With a weekday and at least one default time, a new service gets one rehearsal on the most recent weekday on or before the service date, at the first default time. | UTC-arithmetic helper `mostRecentWeekdayOnOrBefore`; auto-add inside `createService` (single creation path); in-process `process.env.TZ` proof (Q5) |
| R461 | Unless both a weekday and a default time are set, a new service gets no rehearsal. | `buildAutoRehearsal` returns `null` unless weekday normalizes to 0-6, date is real, and first time matches `HM_RE`; existing `rehearsalDefaults` tests stay true (no weekday in their mock) |
| R462 | Changing a service's date moves an auto-added rehearsal nobody has changed, keeping its weekday and time. A changed one stays. | `autoAdded` row flag; pure `moveAutoRehearsals`; marker cleared in `onRehearsalDateChange` / `onRehearsalTimeChange`; **`date` must be added to `onSave`** (Pitfall 1) |
| R463 | Changing the Settings default does not touch existing services, no data migration. | Defaults read once at creation (copy-not-live-bind, same shape as the R442 test); settings write path touches only `settings.*`; nothing in `functions/` or rules is involved |
| R464 | The add form pre-fills the default date only if the service has no rehearsal on that date; otherwise blank. | `newDateOverride` + writable computed mirroring `newTime` / `newTimeOverride`; panel gets a weekday prop |
| R465 | A new ADR supersedes the reversed parts of ADR-0245; the marker never appears on share links or other read-only views. | One shared `toPublicRehearsal` narrowing used by `buildServiceSnapshot` and `buildRehearseAccess`; payload-level tests on `setDoc` calls; ADR-0249 plus README/0245 status updates |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Spec-driven development (applies from this phase on).** "No feature work starts until its spec exists in docs/specs/, and a behavior change updates the spec before the tests and the code." Order is spec, tests, code. Stores, utilities, functions and security rules need a failing test first; UI layout tests may land with the code but must cite spec criteria. `workflow.tdd_mode` is on but the planner heuristic does **not** exempt a store change.
- **Citing a criterion:** the ID goes in the test title, e.g. `it('adds it on the prior Wednesday (AC-RHD-17)')`. A comment does not count. Skipped, `todo`, `fails`, `skipIf`/`runIf`, options-object-off, no-body, empty-body tests do not count; `.only` anywhere in a file voids the whole file; a `describe` title counts only if it holds a counted test. No `AC-` token may appear in a title inside `specCoverage.test.ts`.
- **Removing a criterion** moves it to the spec's Retired list; numbers are never reused.
- **Type gate is `npm run type-check`** (`vue-tsc --build`, includes test files), not `vue-tsc --noEmit -p tsconfig.app.json`.
- **Test commands:** bare `npx vitest run` is the app suite (excludes `src/rules.test.ts` and `render-service/**`). Do not use `--dir src`. Known-failing baseline is `src/storage.rules.test.ts` only; between the spec commit and the commits that add its tests, `specCoverage.test.ts` also fails on purpose. Do not quiet it.
- **Comment convention:** short comments, rationale in ADRs, behaviour narration in `.planning/codebase/` map docs. Source comments are pointers like `// See ADR-0249 (docs/adr/0249-....md)`.
- **graphify** knowledge graph exists; the CONTEXT already names the integration points and they were verified by direct reads, so graph queries were not needed.
- **Brand guard** (`src/__tests__/brandName.test.ts`) fails on the old product name in repo text; write "WorshipBuilder" in any new doc or comment. [VERIFIED: read src/__tests__/brandName.test.ts]
- **CRLF:** `services.ts`, `rehearsalTimes.ts`, `rehearseAccess.ts`, `service.ts`, `organization.ts`, `SettingsView.vue` and several test files are CRLF in the working tree (index is LF). Multi-line `Edit` anchors can miss; prefer single-line anchors or a short node script, and confirm `git diff --stat` shows no whole-file churn (Phase 146-02 hit this). [VERIFIED: `git ls-files --eol`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Default weekday setting (storage, merge, default) | Database / Storage (org doc `settings.*`) | Browser / Client (`authStore.settings`) | Org settings live on `organizations/{orgId}`; the client merges defaults once in `applyOrgSnapshot` |
| Default weekday control | Browser / Client (`SettingsView`) | — | Editor-gated form control, saved through `authStore.updateOrgSettings` |
| Auto-add rehearsal at creation | Browser / Client (`createService` in the Pinia store) | Database / Storage | Single creation path (`ServicesView` -> `createService`); no function creates services |
| Moving a rehearsal when the date changes | Browser / Client (`ServiceEditorView` handlers + pure util) | Database / Storage | Done in the same local object mutation that autosave persists |
| Calendar maths | Browser / Client (pure util, no Date-local APIs) | — | Must be timezone-independent; shared by store and panel |
| Add-form default date | Browser / Client (`ServiceTimesPanel`) | — | Computed from props; no stored field |
| Keeping the marker off public surfaces | Browser / Client (projection builders) | Database / Storage (public docs are the sink) | Clients write the public docs (`shareTokens`, `serviceShares`, `rehearseAccess`); the narrowing must happen before the write |
| Authorization of the setting and the date edit | Database / Storage (`firestore.rules` `isOrgEditor`) | Browser / Client (`isEditor`, `canEditService`) | Rules already allow editors to update non-lifecycle org keys and draft services; no rule change |

## Standard Stack

### Core
No new libraries. The phase uses what the repo already has.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 / Pinia | existing | Panel, Settings and store changes | The codebase's UI and state layer [VERIFIED: package.json] |
| vitest | 4.0.18 | Unit, component and store tests | The repo's runner; `npx vitest --version` ran as `v4.0.18` [VERIFIED: run] |
| @vue/test-utils | existing | `mount` / `shallowMount` of views and panel | Existing pattern in `ServiceTimesPanel.test.ts`, `ServiceEditorView.timesSection.test.ts` |
| typescript (via specCoverage) | existing | Parses test titles for the spec check | `src/__tests__/specCoverage.ts` imports it [VERIFIED: file read] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Row flag `autoAdded` | Service-level `autoRehearsalId` | Service-level id keeps public rows clean by construction, but it is a new top-level field that `onSave`'s allow-list payload and its mirror comparison would silently drop unless added in both places, and it leaves a dangling id after Remove. The row flag rides the already-persisted `rehearsals` array. Recommend the row flag. |
| `Date.UTC` arithmetic | `Temporal` / date-fns / dayjs | New dependency for a 15-line function; UTC arithmetic is already the repo convention (`serviceDateToMillis`, ADR-0009) |
| Weekday as a name string | Number 0-6 | Number matches `getUTCDay()`, needs no mapping table in the util; `null` is distinct from Sunday (0). Both satisfy the CONTEXT constraint. Recommend number. |

**Installation:** none.

**Version verification:** no packages are added, so no registry check applies. Runtime facts: Node `v24.22.2`, vitest `4.0.18`. [VERIFIED: run]

## Package Legitimacy Audit

No external packages are installed in this phase, so there is nothing to audit.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Settings (editor) --Save defaults--> authStore.updateOrgSettings
   { 'settings.rehearsalDefaultWeekday': 0..6|null, ...times, ...report }
        |                                  organizations/{org}.settings.*   (rules: editor update, no field list)
        v                                              |
  authStore.settings  <--- applyOrgSnapshot: {...DEFAULT_ORG_SETTINGS, ...stored}  (missing -> null)
        |
        +-----------------------------+------------------------------------------+
        |                             |                                          |
  createService(data)          ServiceEditorView                          ServiceTimesPanel (props)
   weekday+first time           passes defaultWeekday + defaultTimes       defaultDate = mostRecent(...)
   -> buildAutoRehearsal        |                                          newDate = override ?? defaultDate
   -> addDoc {rehearsals:[row   onDateChange(newDate)                      (blank if a row already on it)
        + autoAdded:true]}        validate YMD, canEditService
   -> ensureShareLink(created)    date = newDate
        |                         rehearsals = moveAutoRehearsals(...)     onRehearsalDate/TimeChange
        v                         (one local mutation)                      -> delete row.autoAdded
  buildServiceSnapshot  --map toPublicRehearsal-->  shareTokens / serviceShares   (id,date,time only)
                                  |
                                  v   autosave (800 ms debounce, deep watch)
                              onSave payload { ..., date, rehearsals, reportTime }   <-- date added
                                  v  ONE updateDoc
                              updateService -> assertWritable -> updateDoc
                                  -> maybeRefreshShareLink(id, data) -> writeSharePayload
markAsPlanned -> buildRehearseAccess --map toPublicRehearsal--> rehearseAccess/{id}  (id,date,time only)
Read-only surfaces (ServiceCard, Dashboard, ShareView, VolunteerServiceView, MyScheduleView) read date+time only.
```

### Recommended Project Structure
```
docs/specs/default-rehearsal.md            # Plan 01 only (first commit of the phase)
docs/adr/0249-<kebab-title>.md             # Plan 06; also 0245 status + README row
src/utils/rehearsalTimes.ts                # + StoredRehearsal, toPublicRehearsal, weekday/date helpers, buildAutoRehearsal, moveAutoRehearsals
src/types/organization.ts                  # + rehearsalDefaultWeekday: number | null (default null)
src/types/service.ts                       # rehearsals?: StoredRehearsal[]  (type-only import)
src/stores/services.ts                     # createService auto-add; both builders narrow
src/utils/rehearseAccess.ts                # narrow via toPublicRehearsal
src/views/SettingsView.vue                 # select + help text + save/rollback
src/components/ServiceTimesPanel.vue       # defaultWeekday prop, newDateOverride/newDate
src/views/ServiceEditorView.vue            # onDateChange move, marker clear, onSave date, pass weekday prop
src/__tests__/defaultRehearsalAdr.test.ts  # doc guard citing the ADR criterion (new)
```

### Pattern 1: Row flag, shared narrowing (the marker)
**What:** `StoredRehearsal = Rehearsal & { autoAdded?: true }` is the stored/editor shape; `Rehearsal` (`{id,date,time}`) remains the public/display shape. `toPublicRehearsal` maps a row to exactly those three keys. Both builders do `sortRehearsals(filtered).map(toPublicRehearsal)`.
**When to use:** every place that turns stored rows into something a non-member or another surface can read.
**Example:**
```ts
// src/utils/rehearsalTimes.ts   // See ADR-0249 (docs/adr/0249-....md)
export interface StoredRehearsal extends Rehearsal { autoAdded?: true }
export function toPublicRehearsal(r: Rehearsal): Rehearsal {
  return { id: r.id, date: r.date, time: r.time }
}
```
"Clear" means `delete row.autoAdded` (never `= false`), so an edited auto row is byte-identical to a hand-added one and `JSON.stringify` dirty-compares behave.

### Pattern 2: Timezone-free calendar arithmetic
**What:** parse `YYYY-MM-DD` into UTC milliseconds, use `getUTCDay()`, subtract whole days, format with UTC getters. Never `new Date('YYYY-MM-DD')` plus local getters, never local-midnight constructors.
**Example:**
```ts
// Source: reproduced in this repo under six TZ values (see Validation Architecture)
const DAY_MS = 86_400_000
function ymdToUtcMs(ymd: string): number | null {
  if (!YMD_RE.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number]
  const dt = new Date(0)
  dt.setUTCFullYear(y, m - 1, d) // not Date.UTC(): it maps years 0-99 to 1900-1999
  const real = dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  return real ? dt.getTime() : null // rejects 2026-02-30
}
const utcMsToYmd = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}
export function normalizeWeekday(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6 ? v : null
}
export function weekdayOfYmd(ymd: string): number | null {
  const ms = ymdToUtcMs(ymd)
  return ms === null ? null : new Date(ms).getUTCDay()
}
export function mostRecentWeekdayOnOrBefore(ymd: string, weekday: unknown): string | null {
  const w = normalizeWeekday(weekday)
  const ms = ymdToUtcMs(ymd)
  if (w === null || ms === null) return null
  const back = (new Date(ms).getUTCDay() - w + 7) % 7
  return utcMsToYmd(ms - back * DAY_MS)
}
```
Moving "keeping its weekday": `mostRecentWeekdayOnOrBefore(newServiceDate, weekdayOfYmd(row.date))`. Shifting by the day delta would break the weekday when the new service date is not a multiple of 7 days from the old one (service moved Sunday to Monday: delta-shift lands the Wednesday rehearsal on Thursday).

### Pattern 3: Pure move with dedupe (the util the editor calls)
```ts
export function moveAutoRehearsals(rows: StoredRehearsal[], newServiceDate: string): StoredRehearsal[] {
  if (ymdToUtcMs(newServiceDate) === null) return rows
  const moved = rows.map((r) => {
    if (!r.autoAdded) return r
    const w = weekdayOfYmd(r.date)
    const next = w === null ? null : mostRecentWeekdayOnOrBefore(newServiceDate, w)
    return next === null ? r : { ...r, date: next }
  })
  // Same date+time as a different row: keep the other (planner's) row, drop the moved one.
  return moved.filter((r, i) => !(r.autoAdded && moved.some((o, j) => j !== i && o.date === r.date && o.time === r.time)))
}
```
At most one row ever carries the marker (only `createService` sets it), so a duplicate is always against an unmarked row. Same date, different time keeps both (no rule needed).

### Pattern 4: Add-form default date (mirror of `newTime`)
```ts
const newDateOverride = ref<string | null>(null)
const defaultDate = computed(() => {
  const d = mostRecentWeekdayOnOrBefore(props.serviceDate, props.defaultWeekday)
  return d && !props.rehearsals.some((r) => r.date === d) ? d : ''
})
const newDate = computed<string>({
  get: () => newDateOverride.value ?? defaultDate.value, // '' override stays '' (?? only skips null)
  set: (v) => { newDateOverride.value = v },
})
// onSubmitAdd: newDateOverride.value = null   (was: newDate.value = '')
```
`v-model="newDate"` on the existing `<input type="date">` works with a writable computed; no markup change (UI-SPEC section 3).

### Anti-Patterns to Avoid
- **`new Date('YYYY-MM-DD')` / local-midnight maths:** off by a day at UTC-11 or UTC+14. The existing `formatRehearsalDateShort` / `parsedDate` use local construction for display only; do not reuse them for maths.
- **Storing the marker as `false` or `undefined`:** `undefined` is stripped by `stripUndefined`, `false` leaks a key. Absent means "not auto-added".
- **A second place that decides what a public row looks like:** the two builders must call the same `toPublicRehearsal`, or they drift (ADR-0245 (e) already warns about this class).
- **Re-adding on move:** nothing in `onDateChange` may create a rehearsal; only `createService` does.
- **Gating the add-form default on a default time:** R461 stops only the auto-add (CONTEXT).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weekday and date maths | A local-time `Date` walk | The UTC helpers above (`setUTCFullYear` + `getUTCDay`) | DST and zone offsets; proven under six zones |
| Dropping `undefined` before Firestore | Per-field checks | `stripUndefined` (already in `updateService`) | Existing funnel |
| Settings write + local mirror | `updateDoc` in the view | `authStore.updateOrgSettings({'settings.x': v})` | Single store-owned mutation (R355) |
| Autosave of the date and rehearsals | A dedicated save call in `onDateChange` | The existing `useAutoSave` + `onSave` payload | One write path; an extra write would race the debounce |
| Share-link refresh | Manual refresh after a move | `updateService` already calls `maybeRefreshShareLink(id, data)` | Merges `data` overrides, so the new date and moved rehearsal reach the public payload |
| Spec coverage check | A custom script | `src/__tests__/specCoverage.test.ts` (runs in the bare suite) | Phase 146 deliverable |

**Key insight:** every persistence, projection and gating mechanism this feature needs already exists. The work is wiring one more field through each, and the failure mode is a field that is silently dropped (`onSave` allow-list) or silently leaked (projection spread).

## Question-by-Question Findings

### Q1. Every place a rehearsal row is copied, rebuilt or read

| Site | Behaviour with a row flag | Verdict |
|------|---------------------------|---------|
| `createService` (`services.ts:456`) | Builds `rehearsals` once and uses the same array for `addDoc` **and** for `created`, which is passed to `ensureShareLink` in the same call | Marker is written to the service doc (members only) and **would reach `shareTokens`/`serviceShares` on the first write** unless the builder narrows. Required. |
| `updateService` -> `maybeRefreshShareLink(id, data)` | `effectiveService = {...local, ...data}` -> `writeSharePayload` -> `buildServiceSnapshot` | Same leak path on every edit. Fixed by narrowing in `buildServiceSnapshot`. |
| `buildServiceSnapshot` (`services.ts:201-205`) | `sortRehearsals(datedRehearsals)` keeps every field | **Leaks.** Narrow. |
| `toPublicServiceSnapshot` | Spreads the snapshot; strips only `notes` and marker `note` | Safe once the builder narrows (it adds no rehearsal logic). Test it anyway. |
| `buildRehearseAccess` (`rehearseAccess.ts:274-281`) | Same `sortRehearsals(datedRehearsals)` | **Leaks.** Narrow. Written at `markAsPlanned` and after. |
| `ServiceEditorView` load | Clones the store service with `JSON.parse(JSON.stringify(...))`; rows keep every field | Survives. |
| `ServiceEditorView.onSave` (`:4791`) | `rehearsals: data.rehearsals ?? []` whole array; mirror comparison (`:4826`) uses the same array | Survives, no change needed for the flag (this is the argument for the row flag). |
| `onAddRehearsal` | Pushes `{id,date,time}`, no flag | Correct: hand-added rows are never marked. |
| `onRehearsalDateChange` / `onRehearsalTimeChange` | Set the field on the found row | **Must clear the marker** after the guards pass. Guards that return early (reject-clear, malformed) must not clear it. |
| `ServiceTimesPanel` | Props `Rehearsal[]`; renders date and time only; emits `{id,...}` events, not rows | Marker never rendered; panel needs no change for the marker. |
| `ServiceCard`, `DashboardView` | Read `service.rehearsals`, filter, format date and time | Ignore extra keys. Add characterization tests only. |
| `ScheduleServiceCard`, `MyScheduleView`, `ShareView`, `VolunteerServiceView` | Read the already-projected `{id,date,time}` docs | Safe once projections narrow. |
| Print, export | No rehearsal output in print; the Planning Center export hard-codes "Wednesday Rehearsal" / "Sunday Rehearsal" (`ServiceEditorView.vue:4137-4144`) | Out of scope (CONTEXT). |
| `functions/src` | No reference to service `rehearsals` (grep: only `bootstrapSuperAdmin.ts` matches the word "Wednesday" for an unrelated reason) | No change. |
| `firestore.rules` | No reference to `rehearsals`; service update rule checks status and `createdBy/createdAt`, not other keys | No change; the marker can be forged by an editor, which is harmless (UI-only meaning). |
| `backfillSlotIds` (remote-merge watcher) | Only rebuilds `slots` | Does not touch rows. |

[VERIFIED: grep and reads of each file listed]

**Silent-disappearance risks:** (a) a service-level id field not added to the `onSave` payload and mirror; avoided by the row flag; (b) `undefined`/`false` assignment instead of `delete`; (c) a new array built with `.map(({id,date,time}) => ...)` in the editor would drop it, so never use `toPublicRehearsal` outside the two projections; (d) the undo path restores a previous clone, which carries the flag, fine.

**Recommendation:** row flag `autoAdded: true`; the service-level alternative buys nothing once narrowing exists and adds a persistence trap.

### Q2. Every way a service date changes
- `onDateChange` (`ServiceEditorView.vue:2749`) is the only code that assigns `date` on an existing service. It is called from the header date picker (`:63`), gated by `canEditService`. [VERIFIED: grep of all `updateService(`, `updateDoc(`, `setDoc(` call sites in `src/`; the store has no `setServiceDate`/duplicate/reschedule action; `functions/src` never writes a service `date`; `quarters.addServiceDate` edits a quarter's date list, not a service.]
- Creation (`createService`) sets `date` once; it is the single caller target (`ServicesView.vue:431`).
- **But the change is not persisted** (Pitfall 1). So there is effectively no second path, and R462 needs no extra path, but R462 does need `onSave` to carry `date`.
- Once `date` persists, side effects the planner should know about: `maybeRefreshShareLink` writes `serviceShares/{slug}__service-{newDate}`; the old-date doc remains as a stale pointer (accepted residual, record in ADR-0249); `resolveServiceRoleAssignments` and `quarters.roleOverridesByDate[date]` key off `service.date`, so a moved date can change which quarter overrides apply (correct behaviour, but newly reachable).

### Q3. Autosave interaction
- `onDateChange` and the rehearsal move are two assignments in one synchronous handler on one reactive object, so the deep watcher sees one change and `useAutoSave` schedules one debounced `onSave` (800 ms). `onSave` builds one `payload` and calls `updateService` once, which is one `updateDoc`. So the write is atomic **provided `date` is in that payload**.
- Remote merge: the store watcher ignores remote snapshots while `autoSave.status` is `pending`/`saving` and while `isOwnWriteEcho`; it applies a remote document only when idle/saved and different. A moved rehearsal therefore cannot be overwritten by its own echo. Concurrent editors are last-writer-wins on the whole `rehearsals` array (pre-existing for every field; not new).
- The first deep-watch trigger after mount is swallowed (`initialized` flag), so a test of the autosave write needs **two** mutations; I reproduced this (two `onDateChange` calls produced one `updateService` call).
- Mirror trap: after a successful save the view only marks itself clean if `JSON.stringify` of the current fields equals `sentSnapshot` (`:4813-4831`). Adding `date` to the payload without adding it, **in the same key position**, to that comparison object makes the comparison fail forever, so `isDirty` stays true and autosave re-fires.

### Q4. Org settings path
- Read: `applyOrgSnapshot` does `settings.value = { ...DEFAULT_ORG_SETTINGS, ...orgSettings, ... }` (`auth.ts:~399`). A new top-level field with default `null` in `DEFAULT_ORG_SETTINGS` reads `null` for every old org with no further code. The shallow spread keeps a stored `0` (Sunday) correctly because it is a value, not a falsy check; use `normalizeWeekday` at use sites, never `||`.
- Write: `authStore.updateOrgSettings({'settings.rehearsalDefaultWeekday': v})` does `updateDoc` on `organizations/{orgId}` plus a local mirror-write; guarded on `orgId` and `isEditor`. Firestore stores `null` as null; the local mirror sets the same value.
- Rules: `allow update: if isOrgEditor(orgId) && preservesLifecycleFields() && preservesCreatedBy()`; only lifecycle keys (`active`, `aiMasterEnabled`, `bibleApiEnabled` and their audit siblings) and `createdBy` are restricted. `settings.*` is not field-restricted. **No rules change and no rules test.**
- Functions: `buildDefaultOrgSettings` in `functions/src/orgTemplateSeed.ts` already omits `rehearsalTimeDefaults` and `reportTimeDefault`; `PortedOrgSettings` is a separate interface with no parity test against `DEFAULT_ORG_SETTINGS`. **No change**; the client default covers new orgs.
- The Settings view seeds its inputs once at setup (`rehearsalTimeDefaultsInput` etc.) and has no watcher for the rehearsal fields, unlike `timezone`. The router waits for auth readiness so a normal reload is fine; an in-place church switch could show a stale weekday. Add one `watch(() => authStore.settings.rehearsalDefaultWeekday, ...)` like the `timezone` watcher (cheap, recommended).
- **Existing test that must change:** `SettingsView.test.ts:375` (`WR-02`) asserts `updateOrgSettings` was called with exactly two keys; the new key makes it fail until the expectation gains `'settings.rehearsalDefaultWeekday': null`. The mock `settings` object also needs a `rehearsalDefaultWeekday` getter/setter.

### Q5. Timezone-safe weekday maths
Function shapes are in Pattern 2 and 3 above. Verified behaviour:

- Ran a probe vitest file (since deleted) that assigned `process.env.TZ` inside each test and restored it in `finally`. Offsets on 2026-11-08: UTC `0`, Pacific/Kiritimati `-840`, Pacific/Pago_Pago `660`, America/Chicago `360`, Asia/Kolkata `-330`, Pacific/Apia `-780`. All four assertions (Sunday to prior Wednesday, same-day Wednesday, 2026-03-08 to 2026-03-04, 2026-11-01 to 2026-10-28 across US DST end) passed in every zone. [VERIFIED: ran vitest 4.0.18 on this machine]
- The probe also printed `new Date('2026-11-08').getDate()`: 7 at UTC-11 and America/Chicago, 8 elsewhere, proving a UTC-parse plus local-getter implementation fails at UTC-11. The mirror failure (local-midnight plus ISO formatting) fails at UTC+14. Testing at UTC-11, UTC and UTC+14 therefore catches both naive families.
- **Windows reliability:** the machine's own zone is America/New_York. `TZ=Pacific/Kiritimati node script.cjs` from Git Bash yields `process.env.TZ === undefined` and no zone change; `TZ=UTC` works; PowerShell `$env:TZ="Pacific/Kiritimati"; node ...` works; in-process assignment works. **Use in-process assignment and add a canary.**
```ts
function inZone<T>(tz: string, expectedOffsetMin: number, fn: () => T): T {
  const prev = process.env.TZ
  process.env.TZ = tz
  try {
    // canary: a silently ignored TZ would let a naive implementation pass
    expect(new Date(2026, 10, 8).getTimezoneOffset()).toBe(expectedOffsetMin)
    return fn()
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
}
// zones: ['Pacific/Pago_Pago', 660], ['UTC', 0], ['Pacific/Kiritimati', -840]
```
- Year quirk: `Date.UTC(y, ...)` maps years 0-99 to 1900-1999; `setUTCFullYear` does not. `YMD_RE` admits `0026-...`; the helper must not mis-map it. Round-trip validation also rejects `2026-02-30`.

### Q6. Acceptance criteria
See **Draft Acceptance Criteria** below.

### Q7. The red window
- **What fails, exactly.** I wrote a probe spec into `docs/specs/`, ran `src/__tests__/specCoverage.test.ts`, then deleted it: exactly one test failed, `the real repo (R457) > passes: every criterion in docs/specs is cited by a test`, with an `AssertionError` listing `AC-RHD-NN (default-rehearsal.md) has no test citing it` for each uncited ID. Every other specCoverage test (parser, citation rules, fixtures) kept passing. The probe also confirmed that `###` group headings, bold-ID bullets and a wrapped continuation line that mentions another ID parse cleanly.
- **A citation closes at the RED commit, not the GREEN one.** The check reads titles statically and does not run the tests, so a failing-but-cited test already removes its ID from the uncited list. The suite goes from "specCoverage red" to "that plan's new tests red" at RED, then to green at GREEN. Plan verification must therefore be scoped.
- **Residual list without vitest.** Node 24 strips types, so this prints the current uncited list in about a second and works from Git Bash:
```bash
node -e "import('./src/__tests__/specCoverage.ts').then(m=>console.log(m.runSpecCoverage(process.cwd()).join('\n')))"
```
  [VERIFIED: ran; printed `[]` on the real repo, and the three probe IDs while the probe spec existed.] Per-plan check: the output must contain exactly the expected IDs and no line that is not `has no test citing it`.
- **GSD gates.**
  - `tdd.review-checkpoint` (`check-command-router.cjs`) scans only `*-PLAN.md` files whose frontmatter has `type: tdd`, and greps the whole git log for subjects starting `test(<planId>):` and `feat(<planId>):` where `planId` is the file basename minus `-PLAN.md` (for example `147-03`). It is advisory (`block` only warns). It blocks only when `MVP_MODE` and `TDD_MODE` are both on; `.planning/config.json` has `tdd_mode: true` but no MVP mode, and the roadmap phase has `mode: null`, so it never blocks here. Mark plans 02, 03 and 05 `type: tdd` and use exactly `test(147-0N): ...` then `feat(147-0N): ...` subjects so the report is clean. Plan 04 (UI) and 01/06 (docs) are `type: execute`, as Phase 146 did. [VERIFIED: read the router source]
  - **The post-merge test gate and regression gate default to `npm test`, and `package.json` has no `test` script** (only `test:unit` and `test:rules`); `workflow.test_command` is unset. [VERIFIED: package.json, `gsd-tools query config-get workflow.test_command` returns empty] So those gates already misfire here independent of this phase. Recommend the plan (or the orchestrator) set `workflow.test_command` to `npx vitest run`. Once set, the gates fail after every wave before the last, by design, because `specCoverage` is red; the plan text must say so and state the expected residual per wave (table below) so "Fix now / Continue" at the prompt is answered by checking the residual, not by guessing.
  - The task-level `<verify>` commands should be scoped (`npx vitest run <files>`), which stays meaningful in the window. Type-check (`npm run type-check`) is required at each GREEN commit; at a RED commit it can fail because tests import not-yet-existing exports, which is acceptable at RED only.
- **Plan split and sequencing** (use_worktrees is false, so same-wave plans must be file-disjoint):

| Plan | Wave | Type | Lands | Commits |
|------|------|------|-------|---------|
| 147-01 spec | 1 | execute | `docs/specs/default-rehearsal.md` only | `docs(147-01): add default-rehearsal spec (R459-R465)` |
| 147-02 foundation | 2 | tdd | util helpers, `StoredRehearsal`, `OrgSettings` field, both projections narrowed, auth read, card/dashboard characterization | `test(147-02): ...` then `feat(147-02): ...` |
| 147-03 createService | 3 | tdd | auto-add, no-leak payload tests, copy-not-live-bind | `test(147-03)` / `feat(147-03)` |
| 147-04 Settings and panel UI | 3 | execute | select, help text, save/rollback, watcher; panel prop and `newDateOverride`; tests land with code | `feat(147-04)` (tests in same or preceding commit) |
| 147-05 editor | 4 | tdd | `onDateChange` move + validation, marker clear, `onSave` date, pass weekday prop, hand-added row, opening adds nothing | `test(147-05)` / `feat(147-05)` |
| 147-06 ADR and close-out | 5 | execute | guard test (RED), ADR-0249, 0245 status, README, pointer comments, map docs, spec `Status: Active` | `test(147-06)` then `docs(147-06)` |

Plans 03 and 04 are file-disjoint (`services.ts` + store tests versus `SettingsView.vue` / `ServiceTimesPanel.vue` + their tests). Plan 05 follows 04 because it edits `ServiceEditorView.vue` and needs the panel prop.

- **Demonstrating spec-first in git.** Plan 01's verification and the phase verifier can run:
```bash
SPEC=$(git log --diff-filter=A --format=%H -- docs/specs/default-rehearsal.md | tail -1)
FIRST=$(git rev-list --reverse HEAD --grep='^[a-z]*(147-0[2-6])' | head -1)
git merge-base --is-ancestor "$SPEC" "$FIRST" && echo "spec first: ok"
```
  Planning-doc commits such as `docs(147): UI design contract` precede the spec and are neither tests nor code.

**Expected residual uncited IDs (first-citing plan owns an ID):**

| After | Uncited count | IDs still uncited |
|-------|---------------|-------------------|
| 147-01 | 55 | all |
| 147-02 RED commit | 40 | everything except 06, 07, 12-16, 27, 31, 33, 34, 35, 49, 50, 54 |
| 147-03 RED commit | 28 | also minus 10, 17-25, 51, 52 |
| 147-04 (wave 3 done) | 11 | also minus 01-05, 08, 09, 40-48, 53 |
| 147-05 RED commit | 1 | only 55 |
| 147-06 RED commit | 0 | none (specCoverage green); the phase then needs the full suite green |

### Q8. What changes on purpose
- `src/views/__tests__/SettingsView.test.ts:365-367` (`R442` helper-text test): both assertions change. The new text no longer says "pre-fill the time when a planner adds a rehearsal" or "Dates are always chosen per service."
- `SettingsView.test.ts:375` (`WR-02`): exact `toHaveBeenCalledWith` gains the weekday key; mock `settings` gains the getter.
- `src/stores/__tests__/services.rehearsalDefaults.test.ts`: the `[]` assertions use mock settings with no weekday, so they stay true under R461. Update the header comment (it cites ADR-0245 for "createService writes rehearsals []") and rename the describe so it no longer says "no seeded rehearsals"; add the weekday cases here. Do not delete the existing cases; they are the R461 regression guard.
- No existing test asserts "rehearsals is `[]` when a weekday could be set" other than the above.
- `ServiceEditorView.timesSection.test.ts` panel-props test (`:405-418`) uses `props(...)` per key, so a new `defaultWeekday` prop does not break it; add one assertion.
- ADR-0245 pointers to update to ADR-0249 (or add alongside): `src/stores/services.ts:474` (comment says rehearsals start empty), `src/types/organization.ts:102-103` (doc says defaults are "never copied into a service", now false for the first time), `src/views/SettingsView.vue:543`, `src/components/ServiceTimesPanel.vue:2`, `src/views/ServiceEditorView.vue:1743` and `:2760` (keep 0245 for (c) and add 0249), `src/stores/__tests__/services.rehearsalDefaults.test.ts:5`, `.planning/codebase/ARCHITECTURE.md:1655` (ServiceTimesPanel decision record) and its "Add form time" bullet, plus ADR-0245's own Source-comments list. `src/utils/rehearsalTimes.ts:10` stays (legacy rows, (d)).
- ADR-0245 `Status` becomes a partial-supersede line (the README vocabulary is Accepted / Superseded / Deprecated; use `Accepted; (a) in part and (b) superseded by ADR-0249`), and the README index row for 0245 gets the same note; add the 0249 row.

## Draft Acceptance Criteria

Spec file: `docs/specs/default-rehearsal.md`, `**Code:** RHD`. Each line is a column-0 bullet `- **AC-RHD-NN** - text. (Rnnn)`. `###` group headings are allowed inside the section (verified by running `parseSpec`). Status starts `Draft`, becomes `Active` in Plan 06. T = test-first (failing test committed before the code), U = may land with the UI code but must cite.

| ID | Criterion | Src | Cited from | When |
|----|-----------|-----|------------|------|
| 01 | In the "Rehearsal & Report Defaults" card the "Default rehearsal day" select lists None, then Sunday to Saturday, and shows the saved day, or None when the church has none. | R459 | `SettingsView.test.ts` | U, plan 04 |
| 02 | "Save defaults" saves the chosen day with the card's other defaults, as 0 (Sunday) to 6 (Saturday), or null for None. | R459 | `SettingsView.test.ts` | U, 04 |
| 03 | Choosing a day saves nothing until "Save defaults" is pressed. | R459 | `SettingsView.test.ts` | U, 04 |
| 04 | When the save fails, the previous day is restored with the other defaults and the card's existing error line shows. | R459 | `SettingsView.test.ts` | U, 04 |
| 05 | For a user who is not an editor the select is disabled and "Save defaults" is not shown. | R459 | `SettingsView.test.ts` | U, 04 |
| 06 | A church's saved default day is still there after the organization reloads. | R459 | `stores/__tests__/auth.test.ts` | T, 02 |
| 07 | A church with no saved default day reads as None. | R459 | `stores/__tests__/auth.test.ts` | T, 02 |
| 08 | The card's help text reads "New services start with one rehearsal on the default day at the first default time. The report time is copied onto every new service. Changing these defaults doesn't affect existing services." | R463 | `SettingsView.test.ts` | U, 04 |
| 09 | Saving the defaults changes only the organization's settings and writes to no service. | R463 | `SettingsView.test.ts` | U, 04 |
| 10 | Changing the default day leaves a service created earlier with the rehearsals it already has. | R463 | `stores/__tests__/services.rehearsalDefaults.test.ts` | T, 03 |
| 11 | Opening or saving a service that has no rehearsals never adds one, whatever the Settings default day and time are. | R463 | `views/__tests__/ServiceEditorView.timesSection.test.ts` | T, 05 |
| 12 | The default rehearsal date for a service date and a weekday is the most recent day with that weekday on or before the service date. | R460 | `utils/__tests__/rehearsalTimes.test.ts` | T, 02 |
| 13 | When the service date falls on that weekday, the default rehearsal date is the service date. | R460 | `rehearsalTimes.test.ts` | T, 02 |
| 14 | The default rehearsal date is correct across month ends, year ends and a leap day. | R460 | `rehearsalTimes.test.ts` | T, 02 |
| 15 | The default rehearsal date is the same on a computer set to UTC-11, UTC or UTC+14. | R460 | `rehearsalTimes.test.ts` | T, 02 |
| 16 | A service date that is not a real YYYY-MM-DD date, or a weekday that is not a whole number from 0 to 6, gives no default rehearsal date. | R460 | `rehearsalTimes.test.ts` | T, 02 |
| 17 | With Wednesday as the default day and 6:30 PM as the first default time, a new Sunday service (2026-11-08) starts with one rehearsal on Wednesday 2026-11-04 at 18:30. | R460 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 18 | With the same defaults, a new Wednesday service (2026-11-04) starts with one rehearsal that same day at 18:30. | R460 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 19 | When there are several default times, the rehearsal uses the first. | R460 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 20 | A rehearsal whose date is already in the past is still added. | R460 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 21 | The same service date gets the same rehearsal date on a computer set to UTC-11, UTC or UTC+14. | R460 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 22 | When no default day is set, a new service starts with no rehearsal. | R461 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 23 | When a default day is set but no default time, a new service starts with no rehearsal. | R461 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 24 | A new service whose date is not a real date is still created, with no rehearsal. | R461 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 25 | The rehearsal added at creation carries the auto-added marker. | R462 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 26 | A rehearsal added from the Times tab form never carries the marker. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 27 | Changing the service date moves a rehearsal that is still auto-added to the most recent day with the rehearsal's own weekday on or before the new service date, and keeps its time. | R462 | `rehearsalTimes.test.ts` and `ServiceEditorView.timesSection.test.ts` | T, 02 (first) |
| 28 | A moved rehearsal keeps its own weekday after the Settings default day has changed. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 29 | Editing an auto-added rehearsal's date or time ends auto-moving for good, even when it is set back to the old value. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 30 | A rejected edit (a cleared or malformed date or time) does not end auto-moving. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 31 | A rehearsal without the marker stays where it is when the service date changes. | R462 | `rehearsalTimes.test.ts` (and view) | T, 02 |
| 32 | When an auto-added rehearsal has been removed, changing the service date adds nothing back. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 33 | When a moved rehearsal lands on the same date and time as another rehearsal, one row remains. | R462 | `rehearsalTimes.test.ts` | T, 02 |
| 34 | When a moved rehearsal lands on the same date at a different time, both rows remain. | R462 | `rehearsalTimes.test.ts` | T, 02 |
| 35 | A service date that is cleared or not a real date is not applied and moves no rehearsal. | R462 | `rehearsalTimes.test.ts` (and view) | T, 02 |
| 36 | On a service that cannot be edited, changing the date changes nothing. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 37 | A changed service date is saved with the service. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 38 | The new service date and the moved rehearsal are saved in the same write. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 39 | The auto-added marker is still on the rehearsal after the service is opened and saved again. | R462 | `ServiceEditorView.timesSection.test.ts` | T, 05 |
| 40 | When a default day is set, the service has a real date and no rehearsal falls on the default date, the add form's Date is filled with the default date. | R464 | `components/__tests__/ServiceTimesPanel.test.ts` | U, 04 |
| 41 | When the service already has a rehearsal on the default date, the add form's Date is blank. | R464 | `ServiceTimesPanel.test.ts` | U, 04 |
| 42 | When no default day is set, or the service has no real date, the add form's Date is blank. | R464 | `ServiceTimesPanel.test.ts` | U, 04 |
| 43 | When a default day is set but no default time, the Date is filled and the Time stays blank, and Add stays off until a time is entered. | R464 | `ServiceTimesPanel.test.ts` | U, 04 |
| 44 | A date the planner has typed or cleared stays until they add the rehearsal. | R464 | `ServiceTimesPanel.test.ts` | U, 04 |
| 45 | A date the planner has not touched follows the service date and the Settings day as they change. | R464 | `ServiceTimesPanel.test.ts` | U, 04 |
| 46 | After "Add rehearsal" the Date returns to the default date, or to blank when that date now holds the rehearsal just added. | R464 | `ServiceTimesPanel.test.ts` | U, 04 |
| 47 | Pre-filling the Date adds no rehearsal until "Add rehearsal" is pressed. | R464 | `ServiceTimesPanel.test.ts` | U, 04 |
| 48 | The add form shows no note that the Date came from a default. | R464 | `ServiceTimesPanel.test.ts` | U, 04 |
| 49 | The rehearsals in the public share snapshot (`buildServiceSnapshot`, then `toPublicServiceSnapshot`) have exactly id, date and time. | R465 | `stores/__tests__/services.rehearsalProjection.test.ts` | T, 02 |
| 50 | The rehearsals in the volunteer rehearse projection (`buildRehearseAccess`) have exactly id, date and time. | R465 | `utils/rehearseAccess.test.ts` | T, 02 |
| 51 | The share-link documents written when a service is created (`shareTokens`, `serviceShares`) carry no marker. | R465 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 52 | The share-link documents rewritten after an edit carry no marker. | R465 | `services.rehearsalDefaults.test.ts` | T, 03 |
| 53 | In the Times tab an auto-added rehearsal looks like any other, for editors and for viewers. | R465 | `ServiceTimesPanel.test.ts` | U, 04 |
| 54 | The service cards and the dashboard show an auto-added rehearsal like any other. | R465 | `components/__tests__/ServiceCard.test.ts`, `views/__tests__/DashboardView.rehearsalTimes.test.ts` | T (characterization), 02 |
| 55 | ADR-0249 supersedes the reversed parts of ADR-0245, and ADR-0245 and the ADR index point to it. | R465 | `src/__tests__/defaultRehearsalAdr.test.ts` (new guard) | T, 06 |

Coverage: R459 -> 01-07; R460 -> 12-21; R461 -> 22-24; R462 -> 25-39; R463 -> 08-11; R464 -> 40-48; R465 -> 49-55. Every CONTEXT decision maps: removed stays gone (32), landing on an existing rehearsal (33, 34), "changed" is sticky (29, 30), past date still added (20), own weekday after a Settings change (28), weekday set with no time (43), which weekday (40, 45), edits stand (44), no note (48), blank after adding the default date (46), no visible marker (53), editor gate (05), no migration (10, 11).

Notes for the spec author:
- The spec's **Behavior**, **Edge cases** (each edge case naming its AC), **Out of scope** (Planning Center export, several weekdays, a visible marker, stale old-date memorable link) and **ADRs** (ADR-0249, ADR-0245, ADR-0248) sections follow `docs/specs/TEMPLATE.md`. Keep the *Retired criteria* heading with a comment-only body; template sample IDs must not be copied.
- A planner who wants fewer criteria can safely merge 12-14 or 40-42, but merging 28-30 or 33-34 hides distinct behaviours that CONTEXT locked separately.
- Do not put `AC-RHD-` text in any test title inside `specCoverage.test.ts`. Do not list IDs as table rows or indented items under *Acceptance criteria*: the parser treats those as errors.
- Criterion 15/21 tests use the `inZone` helper with its canary assertion; the canary is what stops a silent no-op from satisfying the criterion.

## Common Pitfalls

### Pitfall 1: The service date is never sent by `onSave`
**What goes wrong:** the moved rehearsal persists, the date does not; after reload the service shows the old date with a rehearsal relative to the new one. Worse, adding `date` to only one of the two places loops autosave.
**Why it happens:** `payload` is an allow-list, and the post-save comparison object must mirror it key-for-key in the same order (`JSON.stringify` is order-sensitive).
**How to avoid:** add `date: data.date` to `payload` and `date: localService.value.date` to the mirror object, at the same position. Guard `onDateChange` so only a value matching `YMD_RE` is applied (the header input has no `max`, so a 5+ digit year would otherwise be saved); add `max="9999-12-31"` to that input, as the panel's inputs have. Test: an autosave after two `onDateChange` calls sends `date` and `rehearsals` in one `updateService` call, and `isDirty` clears afterwards (no second call after the debounce).
**Warning signs:** `updateService` payload keys lack `date`; "Unsaved changes" badge never clears; repeated writes.

### Pitfall 2: Projection spread leaks the marker
**What goes wrong:** the first share-link write inside `createService` publishes `autoAdded` to `shareTokens`/`serviceShares`.
**How to avoid:** narrow in both builders through the one shared function; assert on the actual `setDoc` payloads (`JSON.stringify` of every `setDoc` argument must not contain the marker key), not only on the builder return.

### Pitfall 3: Shell `TZ=` is silently ignored on this machine
**What goes wrong:** a timezone test that "passes" under `TZ=Pacific/Kiritimati npx vitest` never ran in that zone.
**How to avoid:** assign `process.env.TZ` in the test and assert `getTimezoneOffset()`; never rely on the shell prefix.

### Pitfall 4: Autosave swallows the first mutation
**What goes wrong:** a test that edits once and expects a save sees none.
**How to avoid:** use two mutations (existing tests do), or assert on `localService` instead of `updateService`.

### Pitfall 5: `0` is a valid weekday
**What goes wrong:** `settings.rehearsalDefaultWeekday || null`, `if (weekday)` or `v-model` string coercion turns Sunday into "none".
**How to avoid:** `normalizeWeekday` everywhere; Vue `<option :value="0">` and `:value="null"` keep real values under `v-model` (no `.number` needed).

### Pitfall 6: Time default can create a date-only row
**What goes wrong:** a stored default time that is empty or malformed would create a row `isDisplayableRehearsal` hides but the editor flags "Needs a time".
**How to avoid:** `buildAutoRehearsal` requires `HM_RE.test(firstTime)`; the auto row is therefore always dated and timed, which preserves the ADR-0245 (d) invariant.

### Pitfall 7: Test mocks lack the new setting
**What goes wrong:** component and store tests mock `settings` without `rehearsalDefaultWeekday`; code that reads it must treat `undefined` as `null`.
**How to avoid:** always go through `normalizeWeekday(authStore.settings.rehearsalDefaultWeekday)`; extend only the mocks of tests that exercise the weekday.

### Pitfall 8: `crypto.randomUUID` in store tests
**What goes wrong:** `services.rehearsalDefaults.test.ts` stubs `crypto` with only `getRandomValues` and `randomUUID`; other store tests may stub differently.
**How to avoid:** give `buildAutoRehearsal` an injectable `makeId` defaulting to `crypto.randomUUID()`, and keep id creation after all the "return null" guards so a stub cannot break the no-rehearsal paths.

## Code Examples

### Auto-add inside `createService`
```ts
// Source: derived from src/stores/services.ts:456-512 (single creation path)
const weekday = normalizeWeekday(authStore.settings.rehearsalDefaultWeekday)
const firstTime = authStore.settings.rehearsalTimeDefaults?.[0] ?? ''
const auto = buildAutoRehearsal(data.date, weekday, firstTime) // StoredRehearsal | null
const rehearsals: StoredRehearsal[] = auto ? [auto] : []
// addDoc({... rehearsals, reportTime}) and the `created` object for ensureShareLink use the same array.
```

### Narrowing in both builders
```ts
// buildServiceSnapshot and buildRehearseAccess
...(datedRehearsals.length > 0
  ? { rehearsals: sortRehearsals(datedRehearsals).map(toPublicRehearsal) }
  : {}),
```

### Editor handlers
```ts
function onDateChange(newDate: string) {
  if (!canEditService.value) return
  if (!localService.value || !YMD_RE.test(newDate) || !isRealYmd(newDate)) return
  localService.value.date = newDate
  if (localService.value.rehearsals) {
    localService.value.rehearsals = moveAutoRehearsals(localService.value.rehearsals, newDate)
  }
}
// onRehearsalDateChange / onRehearsalTimeChange: after the existing guards and the assignment:
delete rehearsal.autoAdded
```

### Settings save (extends the existing handler)
```ts
await authStore.updateOrgSettings({
  'settings.rehearsalTimeDefaults': newRehearsalDefaults,
  'settings.reportTimeDefault': newReportTimeDefault,
  'settings.rehearsalDefaultWeekday': rehearsalDefaultWeekdayInput.value, // number | null
})
// catch: rehearsalDefaultWeekdayInput.value = previousWeekday
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ADR-0245 (a): rehearsal created only by the Times-tab form, date always picked | New services get one auto-added rehearsal; the add form pre-fills the default date | This phase (owner, 2026-11-06) | ADR-0249 supersedes (a) in part and (b) |
| ADR-0245 (b): `createService` writes `rehearsals: []` | Writes `[]` unless weekday and first time are set | This phase | `rehearsalDefaults` tests stay valid because their mock sets no weekday |
| Org default times "never copied into a service" | The first default time is copied into the auto row once, at creation | This phase | Update the `organization.ts` doc comment |

**Deprecated/outdated:** the Settings helper text "Dates are always chosen per service." and the `organization.ts` comment above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The owner accepts this phase also fixing the editor's date persistence (a pre-existing defect that R462 depends on), and the newly reachable side effects (stale old-date memorable share link, quarter role-override keying) | Summary, Q2, Open Question 1 | If the owner wants the date picker left alone, R462 cannot be delivered consistently; the orchestrator should confirm before Plan 05 executes |
| A2 | A browser date input without `max` can emit a 5+ digit year (Chrome behaviour), which motivates the `YMD_RE` guard and `max` on the header input | Pitfall 1 | Low; the guard is harmless if wrong. The panel already guards the same case and its tests cover a 5-digit year |
| A3 | Firestore accepts `null` as a value in a dot-path `updateDoc` on a map field | Q4 | Low; if not, use `deleteField()` for None and `normalizeWeekday` already reads missing as none. No existing code in this repo stores `null` under `settings.*` that I verified, so confirm in the Settings save test with the real store mock |
| A4 | The post-merge and regression gates will run `npm test` (no such script) unless `workflow.test_command` is set | Q7 | If the orchestrator already overrides the command elsewhere, the note is moot |

## Open Questions (RESOLVED)

1. **Editor date changes are not persisted (R462 depends on them).**
   - What we know: `onSave` never sends `date`; reproduced by test; no other path writes it.
   - RESOLVED: include the fix in Plan 05 (`date` in payload and mirror, `YMD_RE` guard, `max` on the input), covered by AC-RHD-35, 37 and 38 and called out in the spec's Edge cases. The orchestrator should surface this to the owner as a discovered pre-existing defect at the consent gate before executing Plan 05 (A1).
2. **Stale `serviceShares/{slug}__service-{oldDate}` after a persisted date change.**
   - RESOLVED: accept and record in ADR-0249 Consequences and the spec's Out of scope; deleting the old doc is a separate decision (the id format is frozen per R347).
3. **Marker storage and name.**
   - RESOLVED: row flag `autoAdded?: true`, cleared with `delete`, narrowed out of both projections by `toPublicRehearsal`.
4. **Weekday encoding.**
   - RESOLVED: `number | null`, 0 Sunday to 6 Saturday, default `null`, `normalizeWeekday` at every use.
5. **Which row survives when a moved rehearsal collides.**
   - RESOLVED: keep the existing (unmarked) row, drop the moved one; the marker disappears with it and nothing re-adds.
6. **Settings view re-seeding after an in-place church switch.**
   - RESOLVED: add one watcher on `authStore.settings.rehearsalDefaultWeekday`, like `timezone`.
7. **Where the calendar helpers live.**
   - RESOLVED: `src/utils/rehearsalTimes.ts` (already dependency-free and imported by both projections and the panel); tests extend `src/utils/__tests__/rehearsalTimes.test.ts`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all tests, residual-list one-liner | ✓ | v24.22.2 | — |
| vitest | all tests | ✓ | 4.0.18 | — |
| `vue-tsc` (`npm run type-check`) | type gate | ✓ (devDependency) | ^3.2.5 | — |
| Firestore emulator | not needed (no rules or functions change) | not probed | — | `npm run test:rules` is out of scope for this phase |
| `.env.local` | component tests that import Firebase config | present in main checkout | — | copy via the `worktree-env-setup` skill if a worktree is ever used (`use_worktrees` is false) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. A bare `npx vitest run` takes about 5 minutes (Phase 146-02 summary), so use scoped runs inside a plan.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18, jsdom, `@vue/test-utils` |
| Config file | `vite.config.ts` (excludes `src/rules.test.ts` and `render-service/**`) |
| Quick run command | `npx vitest run <the plan's test files>` |
| Full suite command | `npx vitest run` then `npm run type-check` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R459 | Select, save, rollback, gate | component | `npx vitest run src/views/__tests__/SettingsView.test.ts` | ✅ (edit) |
| R459 | Stored day survives load; missing reads none | store | `npx vitest run src/stores/__tests__/auth.test.ts` | ✅ (edit) |
| R460 | Weekday maths, boundaries, timezone | unit | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts` | ✅ (edit) |
| R460, R461 | Auto-add and its guards in `createService` | store | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts` | ✅ (edit) |
| R462 | Move, sticky edit, dedupe, persistence, marker survives | unit + view | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts src/views/__tests__/ServiceEditorView.timesSection.test.ts` | ✅ (edit) |
| R463 | Copy-not-live-bind, no service write, opening adds nothing | store + view | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts src/views/__tests__/ServiceEditorView.timesSection.test.ts src/views/__tests__/SettingsView.test.ts` | ✅ (edit) |
| R464 | Add-form default date | component | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts` | ✅ (edit) |
| R465 | Projection narrowing, payload no-leak, display parity | store + unit + component | `npx vitest run src/stores/__tests__/services.rehearsalProjection.test.ts src/utils/rehearseAccess.test.ts src/components/__tests__/ServiceCard.test.ts src/views/__tests__/DashboardView.rehearsalTimes.test.ts` | ✅ (edit) |
| R465 | ADR-0249 and pointers | doc guard | `npx vitest run src/__tests__/defaultRehearsalAdr.test.ts` | ❌ Wave (plan 06) |
| R457 (pilot) | Every criterion cited | check | `npx vitest run src/__tests__/specCoverage.test.ts` and the node residual one-liner | ✅ |

### Sampling Rate
- **Per task commit:** the scoped command above for the files touched. At a GREEN commit also `npm run type-check`.
- **Per wave merge:** scoped files for the wave plus the residual one-liner; compare with the "Expected residual" table (not "green").
- **Phase gate:** bare `npx vitest run` must show only the documented `src/storage.rules.test.ts` baseline failure, `specCoverage.test.ts` passing, and `npm run type-check` clean, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/__tests__/defaultRehearsalAdr.test.ts` - doc guard for AC-RHD-55 (created in plan 06, RED before the ADR)
- [ ] Mock updates: `SettingsView.test.ts` `settings` getter/setter for `rehearsalDefaultWeekday`; `ServiceEditorView.timesSection.test.ts` `mockAuthState.settings.rehearsalDefaultWeekday` (optional field) and a mock service helper that accepts `date` and marked rows
- [ ] `inZone` helper (in `rehearsalTimes.test.ts`; copy into `services.rehearsalDefaults.test.ts` or export from a small shared test util)
- Framework install: none.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Existing: `authStore.isEditor` gates the select and the save; `canEditService` gates `onDateChange` and every rehearsal handler (R036); `firestore.rules` `isOrgEditor` and the draft-only service rule enforce server-side. No rule change. |
| V5 Input Validation | yes | `YMD_RE` / `HM_RE`, real-calendar round-trip, `normalizeWeekday`; reject a malformed service date before it is saved |
| V6 Cryptography | no | `crypto.randomUUID()` for row ids only (same as `onAddRehearsal`) |
| V8 Data Protection | yes | The marker is internal state; keep it off `shareTokens`, `serviceShares`, `rehearseAccess` by narrowing before the public write and by payload-level tests |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Internal field published to an unauthenticated or non-member surface | Information disclosure | One shared `toPublicRehearsal` in both builders; tests on the written `setDoc` payloads |
| Editor forges `autoAdded` on a row | Tampering | Harmless: it only decides auto-moving for that service; rules intentionally do not validate rehearsal fields (ADR-0245 consequences) |
| Malformed service date saved (now that `date` persists) | Tampering | Handler rejects non-`YMD_RE` / non-real dates; `max="9999-12-31"` on the picker |
| Viewer or locked-service mutation through a stale handler reference | Elevation of privilege | `canEditService` re-check at the top of every handler (existing pattern); AC-RHD-36 |

## Sources

### Primary (HIGH confidence)
- Repo code read and executed in this session: `src/stores/services.ts`, `src/utils/rehearsalTimes.ts`, `src/utils/rehearseAccess.ts`, `src/types/service.ts`, `src/types/organization.ts`, `src/stores/auth.ts`, `src/views/ServiceEditorView.vue`, `src/views/SettingsView.vue`, `src/components/ServiceTimesPanel.vue`, `src/composables/useAutoSave.ts`, `src/__tests__/specCoverage.ts`, `firestore.rules`, `functions/src/orgTemplateSeed.ts`, `functions/src/orgProvisioning.ts`
- Executed probes (all cleaned up afterwards): editor `onDateChange` autosave payload keys; six-zone vitest probe; Git Bash versus PowerShell versus in-process `TZ`; a temporary `docs/specs/default-rehearsal.md` run through `specCoverage.test.ts` and `runSpecCoverage`
- `docs/adr/0245-...md`, `docs/adr/0248-...md`, `docs/specs/TEMPLATE.md`, `.planning/phases/146-spec-standard/146-02-SUMMARY.md`, `147-CONTEXT.md`, `147-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
- GSD core: `~/.claude/gsd-core/workflows/execute-phase.md`, `workflows/execute-phase/steps/post-merge-gate.md`, `regression-gate.md`, `references/execute-mvp-tdd.md`, `bin/lib/check-command-router.cjs` (`tdd.review-checkpoint`)

### Secondary (MEDIUM confidence)
- none

### Tertiary (LOW confidence)
- Chrome 5+-digit-year date-input behaviour (A2), taken from the existing panel comments and tests rather than re-run

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; versions confirmed by running tools
- Architecture: HIGH - every integration point read; the one surprising behaviour (date not persisted) reproduced by test
- Pitfalls: HIGH - each was either reproduced or read directly in code
- Acceptance criteria and plan split: MEDIUM-HIGH - the parse and red-window behaviour were run, but the criteria text is a proposal for the planner and owner to adjust

**Research date:** 2026-11-06
**Valid until:** 2026-12-06 (stable code; re-check `onSave` and the spec check if Phase 146 files change)
