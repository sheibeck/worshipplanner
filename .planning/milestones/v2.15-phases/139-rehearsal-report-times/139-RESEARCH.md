# Phase 139: Rehearsal & Report Times - Research

**Researched:** 2026-09-09
**Domain:** Additive data-model + display-surface threading in a shipped Vue 3 + Pinia + Firebase app
**Confidence:** HIGH

## Summary

This phase is pure additive-schema work on a codebase that already has three well-established
precedents to copy exactly: (1) `Service.date`'s plain-string, no-`Timestamp` convention, (2)
`OrgSettings`/`DEFAULT_ORG_SETTINGS`'s "defaults live on the org, copied at creation" pattern
(already used for `defaultServiceTemplate`), and (3) the two hand-maintained PII-safe projection
builders that must both be updated explicitly whenever `Service` grows a new non-free-text field.
No new npm dependency, no new Firestore collection, no `storage.rules`/`firestore.rules` change.

One correction to the milestone-level research this phase inherits: `buildServiceSnapshot` is
**not** defined in `src/utils/serviceProjection.ts` — it lives in `src/stores/services.ts`
(lines 123-207), inside the Pinia store, because it needs `useSongStore()`/`useRosterStore()`/
`useQuartersStore()`. `src/utils/serviceProjection.ts` only holds the shared, store-free allowlist
**helpers** (`mapSlotAllowlist`, `mapStageMarkerAllowlist`, `resolvePersonName`) that both
`buildServiceSnapshot` (services.ts) and `buildRehearseAccess` (rehearseAccess.ts) call so the two
PII boundaries can't drift. The planner must edit `src/stores/services.ts`'s `buildServiceSnapshot`
return object directly for the `ServiceSnapshot` side — not `serviceProjection.ts`.

Also confirmed: `createService`'s `CreateServiceInput` type is `{ date, name, teams }` only — the
caller (the New Service modal) never passes rehearsal/report data today, and `createService` itself
already reads `authStore.settings` for exactly one other field (`defaultServiceTemplate`, line 452).
Adding `rehearsals`/`reportTime` synthesis to the same function body, reading the two new
`authStore.settings` fields, is a direct, low-risk copy of an existing pattern.

**Primary recommendation:** Add `rehearsals?: {id,date,time}[]` and `reportTime?: string` to
`Service` (plain strings, mirroring `date`); add `rehearsalTimeDefaults: string[]` and
`reportTimeDefault: string` to `OrgSettings`/`DEFAULT_ORG_SETTINGS` (both flat — no deep-merge
needed in `applyOrgSnapshot`, unlike `slideTypography`/`messaging`); copy the defaults into
`rehearsals`/`reportTime` inside `createService` (services.ts:440-494); add both new fields to
`buildServiceSnapshot`'s return (services.ts) AND `buildRehearseAccess`'s return
(rehearseAccess.ts) in the same commit; write one shared `sortRehearsals` util and one shared
12-hour time-format helper; wire a "Times" section into `ServiceEditorView.vue`'s header area
(near the existing `localService.date` picker at line ~52-65) and a "Rehearsal & Report Defaults"
section into `SettingsView.vue` (mirroring the Messaging section, line ~424+); thread display
into the 6 enumerated read sites below.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Org-level default report/rehearsal times (R429) | API/Backend (Firestore doc + Pinia store) | Browser (Settings form) | `OrgSettings` is a Firestore-persisted, org-scoped document; the Settings UI is a thin form over `updateOrgSettings` |
| Per-service rehearsals/report time CRUD (R430/R431) | API/Backend (Firestore `services/{id}` doc) | Browser (ServiceEditorView form) | Same store/doc pattern as every other `Service` field; editor UI is a thin form over `updateService` |
| Copy-not-live-bind default→service (R432) | API/Backend (`createService` store action) | — | Must happen server-write-adjacent, at document-creation time, not in a component — this is exactly the boundary `defaultServiceTemplate` already established |
| Chronological ordering (`sortRehearsals`) | Browser (pure util, called by every render site) | — | No server-side consumer needs sorted order; it's a display concern only, but must be ONE shared function, not per-component |
| Display everywhere the date shows (R433) | Browser (Vue components reading store/projection state) | API/Backend (the two projection builders that must carry the fields) | The display itself is client-rendered; but volunteer/share surfaces are fed by frozen server-written projections, so the projection builders are the real gate |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R429 | Org-level default report time + rehearsal time(s), Settings page | `OrgSettings`/`DEFAULT_ORG_SETTINGS` verified shape below; `updateOrgSettings` dot-path write pattern verified; Settings UI pattern to mirror identified (Messaging section) |
| R430 | Multiple dated rehearsals per service, add/edit/remove, chronological display | `Service` type verified; `sortRehearsals` design below; Firestore rules verified to need no change (draft-only edit already covers this) |
| R431 | Single day-of report time per service | Same `Service`/rules verification as R430 |
| R432 | Copy-not-live-bind pre-fill at creation | `createService` call site verified (services.ts:440-494); `applyOrgSnapshot` merge behavior verified (flat fields need no deep-merge, unlike `messaging`/`slideTypography`) |
| R433 | Display everywhere date shows, threaded through both projections | All 6 display sites verified by file/line below; both projection builders' exact locations and shapes verified; re-projection trigger (`maybeRefreshShareLink`) verified to already fire on any `updateService` call |

## Standard Stack

No new libraries. This phase is 100% additive TypeScript/Vue against the existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none new) | — | — | Pure `Intl`/`Date` string handling, matching `Service.date`'s existing convention — CLAUDE.md explicitly forbids adding a date library |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `HH:mm`/`YYYY-MM-DD` strings | `Timestamp` (Firestore) | Rejected — bakes in a UTC instant and forces timezone math on a value that's a wall-clock label, exactly the mistake `Service.date` already avoided (see Pitfall 5 in `.planning/research/PITFALLS.md`) |
| Hand-rolled `Intl.DateTimeFormat`/`toLocaleTimeString` per component | `date-fns`/`luxon` | Rejected — CLAUDE.md: "no date library (pure Intl/Date string idiom)"; adding one now would be the first and only date-library dependency in the codebase for a problem five components already solve inline |

**Installation:** none.

## Package Legitimacy Audit

Not applicable — no external packages are installed in this phase.

## Verified Integration Points (file:line)

### 1. `src/types/service.ts` — `Service` interface

Current shape (lines 219-270), additive fields go at the end, mirroring `stageLayout?`/
`messaging?`'s own JSDoc-with-rationale style:

```typescript
export interface Service {
  id: string
  date: string
  name: string
  // ... unchanged existing fields ...
  stageLayoutAutoSeeded?: boolean

  // NEW — R429-R433, Phase 139. Additive, no-migration (same convention as
  // stageLayout?/messaging? above): absent on every service doc written
  // before this field existed, which is the legitimate "no times set" state.
  /**
   * Multiple dated rehearsals (R430). Plain date+time strings — NEVER
   * Timestamp — mirroring Service.date's own convention exactly (avoids
   * timezone rebinding against OrgSettings.timezone; a rehearsal time is a
   * wall-clock label for a single physical venue, not an absolute instant).
   * Display order is NEVER trusted from array/storage order — always run
   * through the shared sortRehearsals() util (see Common Pitfalls).
   */
  rehearsals?: { id: string; date: string; time: string }[]
  /**
   * Single day-of report time (R431), 'HH:mm' 24h (native <input type="time">
   * value format — no AM/PM parsing needed at the input boundary).
   */
  reportTime?: string
}
```

`id` on each rehearsal row: mint with `crypto.randomUUID()` at add-time, matching the codebase's
existing id-minting idiom (17 files already do this, including `StageMarker.id`-adjacent code in
`slotTypes.ts`, `EditSlideDrawer.vue`, `SlideGrid.vue`). Needed as a stable React/Vue `:key` for
add/edit/remove list rendering, not for any storage/lookup purpose.

### 2. `src/types/organization.ts` — `OrgSettings` / `DEFAULT_ORG_SETTINGS`

Current shape verified (lines 26-178). Add two flat fields, following the `bibleVersion`/
`timezone` pattern (flat, no nested object — unlike `slideTypography`/`messaging`, which are
objects requiring an explicit deep-merge in `applyOrgSnapshot`):

```typescript
// OrgSettings interface, alongside `timezone`:
/** Org-level default rehearsal time(s) (R429), time-of-day only — a default
 *  cannot know a future service's date, so no `date` field here. Each entry
 *  is 'HH:mm'. Copied (never live-bound) into a new Service's `rehearsals[]`
 *  at createService time — see Common Pitfalls (retroactive-drift). */
rehearsalTimeDefaults: string[]
/** Org-level default day-of report time (R429), 'HH:mm', '' = unset. */
reportTimeDefault: string
```

```typescript
// DEFAULT_ORG_SETTINGS, alongside `timezone: 'America/Chicago'`:
rehearsalTimeDefaults: [],
reportTimeDefault: '',
```

**Verified — no deep-merge needed in `applyOrgSnapshot`.** Read `auth.ts:399-411`: the merge is
`{ ...DEFAULT_ORG_SETTINGS, ...orgSettings, vwModeEnabled: ..., slideTypography: {...deep merge...},
messaging: {...deep merge...} }`. The explicit deep-merges exist ONLY for `slideTypography` and
`messaging` because they are **nested objects** where a partial stored value would leave sibling
leaves `undefined`. `rehearsalTimeDefaults` (a flat array) and `reportTimeDefault` (a flat string)
behave exactly like `bibleVersion`/`timezone` — the outer shallow `...orgSettings` spread already
covers them correctly. **This contradicts CONTEXT.md's "merge in applyOrgSnapshot if nested"
hedge** — they are not nested, so no extra merge line is needed; a bare additive spread is
correct and sufficient. (Do not add a deep-merge branch for these two fields — there is nothing
to merge.)

### 3. `src/stores/auth.ts` — `updateOrgSettings` write path

Verified (lines 447-469): dot-path patch write, e.g.
`{ 'settings.rehearsalTimeDefaults': [...], 'settings.reportTimeDefault': '08:00' }`. The mirror-
write loop (lines 450-468) walks `key.split('.')` and assigns the **whole value** at the final
segment — for a 2-segment key (`settings.reportTimeDefault`) this directly overwrites
`settings.value.reportTimeDefault`, and for `settings.rehearsalTimeDefaults` it overwrites the
whole array (no per-element merge, which is correct — a defaults-list save is a full replace, not
a patch). No changes needed to `updateOrgSettings` itself; call it exactly as the Messaging
section already does (`SettingsView.vue`'s `onToggleMessagingEnabled`/reminder-days save handlers,
lines ~1121-1217, are the pattern to mirror for the new "Rehearsal & Report Defaults" section).

### 4. `src/stores/services.ts` — `createService` (lines 440-494) and `updateService` (603-621)

**`createService` verified:**
```typescript
type CreateServiceInput = { date: string; name: string; teams: string[] }  // line 46-50

async function createService(data: CreateServiceInput): Promise<string> {
  const authStore = useAuthStore()
  const stored = authStore.settings.defaultServiceTemplate   // line 452 — EXISTING precedent
  // ...
  const ref = await addDoc(collection(db, 'organizations', orgId.value, 'services'), {
    ...data,
    progression: '1-2-2-3',
    slots,
    status: 'draft',
    // ... ADD HERE: rehearsals + reportTime, synthesized from org defaults ...
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
```

`authStore` is already in scope inside `createService` (it's how `defaultServiceTemplate` is
read today) — **confirmed this call site CAN read `OrgSettings` at create time**, no plumbing
gap. The copy-not-live-bind synthesis:

```typescript
const rehearsals = authStore.settings.rehearsalTimeDefaults.map((time) => ({
  id: crypto.randomUUID(),
  date: '',   // planner dates each rehearsal — an org default cannot know a future service's date
  time,
}))
const reportTime = authStore.settings.reportTimeDefault
```

Add both to the `addDoc(...)` payload AND to the `created: Service` object built at
lines 478-487 for the `ensureShareLink(created, ...)` call immediately below — that object is a
second, parallel construction of the just-created service (used only for the share-link
auto-generation) and must carry the same fields or the very first `buildServiceSnapshot` call for
a brand-new service will silently omit them until the next edit.

**`updateService` verified (lines 603-621):** generic `Record<string, unknown>` patch,
`stripUndefined`'d, then `maybeRefreshShareLink(id, data as Partial<Service>)` is called
**unconditionally on every `updateService` call**. This means: **the `ServiceEditorView.vue`
"Times" UI needs no special re-projection code** — writing `{ rehearsals, reportTime }` through
the existing `updateService(id, data)` path automatically re-runs `buildServiceSnapshot` (via
`writeSharePayload` inside `maybeRefreshShareLink`, services.ts:1245-1289) and refreshes the
public share doc, exactly like any other field edit already does. No new hook needed for R433's
ShareView surface.

**`buildRehearseAccess`/`RehearseAccessDoc`, by contrast, is a frozen snapshot** written only at
`markAsPlanned` (services.ts:628+) — this is an EXISTING, already-accepted latency contract (every
other `RehearseAccessDoc` field has it too, per `ARCHITECTURE.md`'s Internal Boundaries table).
**Verified this is not a NEW gap for this phase**: `firestore.rules`' `services/{docId}` update
rule (below) already blocks ordinary field edits once `status != 'draft'`, so editing
times on an already-planned service requires the existing reopen → edit → re-lock cycle
regardless — which already re-runs `markAsPlanned` → `writeRehearseAccessDoc` on relock. No
additional resync mechanism is needed beyond what the app already does for every other field.

### 5. Both projection builders — exact locations (correcting CONTEXT.md/ARCHITECTURE.md)

**`buildServiceSnapshot` — `src/stores/services.ts:123-207`, NOT `src/utils/serviceProjection.ts`.**
`ServiceSnapshot` interface is at lines 90-114. Add both fields to the interface and to the
literal return object (lines 189-206):

```typescript
export interface ServiceSnapshot {
  date: string
  // ADD:
  rehearsals?: { id: string; date: string; time: string }[]
  reportTime?: string
  name: string
  // ... unchanged ...
}

export function buildServiceSnapshot(service: Service): ServiceSnapshot {
  // ...
  return {
    date: service.date,
    // ADD (conditional-spread on rehearsals, mirroring the existing
    // stageLayout?.length-gated omission pattern at line 205 — an empty
    // array should be omitted, not written as `[]`, so it round-trips
    // through Firestore's undefined-rejection the same way):
    ...(service.rehearsals && service.rehearsals.length > 0
      ? { rehearsals: sortRehearsals(service.rehearsals) }
      : {}),
    ...(service.reportTime ? { reportTime: service.reportTime } : {}),
    name: service.name,
    // ... unchanged ...
  }
}
```

Not PII, no strip needed in `toPublicServiceSnapshot` (lines 237-251) — these fields behave like
`date`, not like `notes`/stage-marker `note`.

**`buildRehearseAccess` — `src/utils/rehearseAccess.ts:131-278`.** `RehearseAccessDoc` interface
is at lines 55-107; `serviceDate: string` is currently its only date-shaped field (line 63). Add
alongside it, same treatment:

```typescript
export interface RehearseAccessDoc {
  serviceId: string
  orgId: string
  orgName?: string
  serviceDate: string
  // ADD:
  rehearsals?: { id: string; date: string; time: string }[]
  reportTime?: string
  title: string
  // ... unchanged ...
}

export function buildRehearseAccess(service: Service, ...): RehearseAccessDoc {
  // ...
  return {
    serviceId: service.id,
    orgId,
    ...(orgName ? { orgName } : {}),
    serviceDate: service.date,
    // ADD, same conditional-spread pattern as buildServiceSnapshot above:
    ...(service.rehearsals && service.rehearsals.length > 0
      ? { rehearsals: sortRehearsals(service.rehearsals) }
      : {}),
    ...(service.reportTime ? { reportTime: service.reportTime } : {}),
    title: service.name,
    // ... unchanged ...
  }
}
```

`rehearseAccess.ts` is a pure, store-free file (no Firestore/Pinia imports) — `sortRehearsals`
must live in a similarly pure `utils/` module (not a store) so both builders can import it with
no dependency-direction violation. Recommended location: a new `src/utils/rehearsalTimes.ts`
(sibling to `serviceProjection.ts`/`rehearseAccess.ts`), exporting `sortRehearsals` and the
shared time-format helper together.

### 6. Every DISPLAY site rendering `service.date` today — verified file:line

| # | Surface | File:line | Reads | What feeds it |
|---|---------|-----------|-------|----------------|
| 1 | Dashboard "Next service" card | `src/views/DashboardView.vue:47` `{{ formatServiceDate(nextService.date) }}` | Live `Service` (editor-facing store, not a projection) | `services` store directly |
| 2 | Dashboard "Following services" list | `src/views/DashboardView.vue:84` `{{ formatServiceDate(s.date) }}` | Same live `Service` | `services` store directly |
| 3 | Services list card | `src/components/ServiceCard.vue:124` `props.service.date.split('-')...` | Live `Service` prop | `services` store directly |
| 4 | Service editor header | `src/views/ServiceEditorView.vue:51-65` `formattedDate`/`localService.date` `<input type="date">` | Live `Service` (editable) | The service being edited — this is the EDIT surface, not just display; the new "Times" section goes here |
| 5 | Public share/plan page | `src/views/ShareView.vue:181-194` `formattedDate` computed off `serviceSnapshot.value.date` | `ServiceSnapshot` (frozen, read from `shareTokens/{token}` or `serviceShares/{slug}...`) | `buildServiceSnapshot` — MUST carry the new fields or this page shows nothing |
| 6 | My Schedule cards | `src/views/MyScheduleView.vue:64,88,129` `:service-date="doc.serviceDate"` → `src/components/ScheduleServiceCard.vue:40-41` (the explicit TODO comment this phase closes) | `RehearseAccessDoc` (`MyScheduleDoc = RehearseAccessDoc & {orgId}`, `src/stores/mySchedule.ts:23`) | `buildRehearseAccess` — MUST carry the new fields |
| 7 | Volunteer service view header | `src/views/VolunteerServiceView.vue:46,218-222` `formattedDate` off `doc.serviceDate` | Same `RehearseAccessDoc` via `useVolunteerServiceDoc` | `buildRehearseAccess` — same as #6 |

**`ScheduleServiceCard.vue` prop surface verified (lines 103-111):** it takes **explicit named
props** (`serviceId`, `title`, `serviceDate`, `songs`, `roles`, `isNextUp`, `isPast`) — it does
**not** receive the whole `RehearseAccessDoc`. Adding display requires (a) two new optional props
on `ScheduleServiceCard.vue` (e.g. `reportTime?: string`, `rehearsals?: {id,date,time}[]`), and
(b) passing `:report-time="doc.reportTime"` / `:rehearsals="doc.rehearsals"` at all **3** call
sites in `MyScheduleView.vue` (lines 59-73, 83-97, 124-134) — missing even one of the three
(This Week / Later This Month / Past) leaves that bucket silently blank.

**No existing shared date/time formatting utility exists in `src/`.** Despite CONTEXT.md's
reference to a "`todayInTimeZone`/`parsedDate`" idiom, `todayInTimeZone` only exists **server-side**
in `functions/src/index.ts` — it is not importable from `src/`. The identical
`date.split('-').map(Number)` → `new Date(y, m-1, d)` → `.toLocaleDateString(...)` snippet is
**hand-duplicated** in at least 5 places (`ServiceCard.vue:124`, `ScheduleServiceCard.vue:117-120`,
`DashboardView.vue:377-396`, `ShareView.vue:187-194`, `VolunteerServiceView.vue:220-221`) — there
is no single function to extend. The planner should create ONE new shared helper (in the same new
`src/utils/rehearsalTimes.ts` module recommended above, or a small sibling) for formatting an
`'HH:mm'` string as 12-hour wall-clock text, rather than adding a 6th hand-rolled copy. A working
reference for the desired output format already exists at `src/composables/useRunTimers.ts:49`:
`d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })` produces e.g. `"8:00 AM"` with
no `hour12` option needed (browser default is 12-hour for `en-US`/unspecified locale). For an
`'HH:mm'` string input (no `Date` object), construct a throwaway local date
(`new Date(2000, 0, 1, hh, mm)`) purely to borrow `toLocaleTimeString`'s formatting — never
`new Date('...')` parsed from a combined ISO string (timezone-ambiguous, see Pitfall 5 below).

## Architecture Patterns

### System Architecture Diagram

```
SettingsView.vue "Rehearsal & Report Defaults" (NEW section, mirrors Messaging section pattern)
    │ authStore.updateOrgSettings({ 'settings.rehearsalTimeDefaults': [...], 'settings.reportTimeDefault': '...' })
    ▼
organizations/{orgId}.settings.rehearsalTimeDefaults / .reportTimeDefault  (Firestore)
    │ applyOrgSnapshot() — flat spread, NO deep-merge needed (unlike messaging/slideTypography)
    ▼
authStore.settings.rehearsalTimeDefaults / .reportTimeDefault  (Pinia, reactive)
    │
    ▼
services.ts createService()  ── COPY (never live-read) into new doc ──▶  Service.rehearsals[] / .reportTime
    │  (rehearsals seeded with time filled, date:'' — planner dates each one)
    ▼
ServiceEditorView.vue "Times" section (NEW, header area near existing date picker)
    │ v-model on localService.rehearsals[] / .reportTime, gated by canEditService
    │ same debounced-autosave pipeline as every other field → updateService(id, {rehearsals, reportTime})
    ▼
organizations/{orgId}/services/{id}.rehearsals / .reportTime  (Firestore)
    │
    ├──▶ updateService()'s existing maybeRefreshShareLink() [ALREADY WIRED, no new hook needed]
    │        ▼
    │    buildServiceSnapshot()  [src/stores/services.ts — ADD fields here]
    │        ▼
    │    ServiceSnapshot.rehearsals / .reportTime  →  shareTokens/{token} & serviceShares/{...}
    │        ▼
    │    ShareView.vue (public plan page) — display site #5
    │
    └──▶ markAsPlanned() [only at lock time — existing frozen-snapshot contract, unchanged]
             ▼
         buildRehearseAccess()  [src/utils/rehearseAccess.ts — ADD fields here]
             ▼
         RehearseAccessDoc.rehearsals / .reportTime  →  organizations/{orgId}/rehearseAccess/{id}
             ▼
         MyScheduleView.vue → ScheduleServiceCard.vue (NEW props) — display site #6
         VolunteerServiceView.vue — display site #7

DashboardView.vue / ServiceCard.vue  — read Service directly off the subscribed `services` store,
    no projection hop (display sites #1-3) — same as how they already read service.date today.
```

### Recommended Project Structure

No new directories. One new file:

```
src/utils/
├── rehearsalTimes.ts   # NEW — sortRehearsals(), formatWallClockTime() (12-hour helper), used by
│                          both projection builders + every display component + the editor UI
├── serviceProjection.ts  # UNCHANGED — no new shared allowlist helper needed (rehearsals/reportTime
│                          are flat, non-PII fields copied straight through, not switch-mapped)
└── rehearseAccess.ts    # MODIFIED — add fields to RehearseAccessDoc + buildRehearseAccess
```

### Pattern 1: Shared sort utility, called from every consumer (not per-component)

**What:** One pure function, `sortRehearsals(rehearsals: {date,time}[]): {date,time}[]`, sorting
by `date` then `time` ascending (both are zero-padded strings, so a plain string comparison via
`.localeCompare` or `<` is correct and sufficient — no numeric parsing needed).

**When to use:** Every place a rehearsal array is rendered — the org-settings defaults list is
NOT sorted this way (it's a flat time-only list with no date, order is free-form/add-order), but
every PER-SERVICE rehearsal list (editor, dashboard, My Schedule, share view) must call it.
Recommended: call `sortRehearsals` **inside both projection builders** (shown above) so
`ServiceSnapshot.rehearsals`/`RehearseAccessDoc.rehearsals` are pre-sorted and every downstream
display component can render the array as-is with zero re-sort logic — this also satisfies the
Performance Trap noted in `.planning/research/PITFALLS.md` ("re-sorting on every render... compute
the sorted order once at the store/projection layer").

**Example:**
```typescript
// src/utils/rehearsalTimes.ts
export interface Rehearsal {
  id: string
  date: string  // 'YYYY-MM-DD', may be '' (undated, editor-only — see below)
  time: string  // 'HH:mm'
}

/** Chronological order by date then time — NEVER trust array/storage order.
 *  Undated rehearsals (date === '') sort last, since they have no real
 *  position in a timeline yet (editor-only state, hidden from read-only
 *  surfaces per CONTEXT.md's discretion note). */
export function sortRehearsals(rehearsals: Rehearsal[]): Rehearsal[] {
  return [...rehearsals].sort((a, b) => {
    if (a.date === '' && b.date === '') return a.time.localeCompare(b.time)
    if (a.date === '') return 1
    if (b.date === '') return -1
    return a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  })
}
```

### Pattern 2: Editor-only undated rehearsals hidden from read-only surfaces

**What:** CONTEXT.md's "Claude's Discretion" section flags this as an open call: "whether a
rehearsal with a blank date is hidden from public/volunteer display until dated (reasonable
default: hide undated rehearsals from read-only surfaces, show them only in the editor)."

**Recommendation (adopting the stated reasonable default):** the two projection builders should
filter `rehearsals` to `date !== ''` before sorting/attaching — an org-default-seeded, not-yet-
dated rehearsal (created via `createService`'s copy step, `date: ''`) is real editor-visible state
but is meaningless to a volunteer or public share viewer ("Rehearsal: [no date]" reads as broken,
not helpful). The editor's own "Times" UI reads `service.rehearsals` directly (unfiltered) so the
planner can see and date every seeded row.

```typescript
// Inside buildServiceSnapshot / buildRehearseAccess, before the conditional-spread shown above:
const datedRehearsals = (service.rehearsals ?? []).filter((r) => r.date !== '')
...(datedRehearsals.length > 0 ? { rehearsals: sortRehearsals(datedRehearsals) } : {}),
```

### Anti-Patterns to Avoid

- **Storing `reportTime`/rehearsal `time` as a `Timestamp`:** forces every consumer to re-derive
  "what time does this display as" through `OrgSettings.timezone` just to show a label. Use plain
  `'HH:mm'` strings — see Pitfall 3 below and `.planning/research/PITFALLS.md` Pitfall 5.
- **Reading org defaults live at render time instead of copying at `createService`:** would
  retroactively change an already-locked, already-emailed service's displayed times the moment an
  editor tweaks the org default. See Pitfall 1 below.
- **Editing `Service.ts` and one projection builder but not the other:** the single most likely
  omission in this phase — see Pitfall 2 below and the required projection test in Validation
  Architecture.
- **Adding a `date` library dependency:** CLAUDE.md forbids it; every date need in this phase is
  solvable with the existing `Intl`/`Date`-string idiom already used 5+ places in the codebase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Chronological rehearsal ordering | A per-component `.sort()` call in the editor, dashboard, My Schedule, and share view separately | One shared `sortRehearsals()` in `src/utils/rehearsalTimes.ts`, called once inside both projection builders | Exactly the class of drift Pitfall 6 (`.planning/research/PITFALLS.md`) describes — this codebase's own `orderSlotsBySection` precedent (shared, called from both `buildServiceSnapshot` and `buildRehearseAccess`) is the template to copy |
| 12-hour time display formatting | A 6th hand-rolled `Date`-construction + `toLocaleDateString` snippet | One shared helper (same new util file), reusing the `toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})` idiom already proven at `useRunTimers.ts:49` | 5 existing call sites already duplicate the DATE half of this pattern; don't add a 6th duplicate for the TIME half |
| Copy-vs-live-bind semantics | An ad-hoc `computed` that reads `authStore.settings.reportTimeDefault` directly into the service editor's display when `reportTime` is unset | An explicit one-time copy at `createService`, stored as a real field on the doc from the moment of creation | Any live-read shortcut reintroduces Pitfall 1/7 — the field must be a real, independent value on the service doc from t=0 |

**Key insight:** every "don't hand-roll" item here is really the same insight restated three
ways: this codebase already has the exact right precedent for each piece (`orderSlotsBySection`,
`toLocaleTimeString` idiom, `defaultServiceTemplate`'s copy-at-create) — the risk isn't a missing
capability, it's forgetting to reuse the precedent and duplicating logic per-surface instead.

## Common Pitfalls

*(Full detail already researched at the milestone level in `.planning/research/PITFALLS.md`
Pitfalls 5-8 — summarized and re-verified against real code here; do not re-derive from scratch.)*

### Pitfall 1: Org-default change retroactively mutates an already-created service
**What goes wrong:** if `reportTime`/`rehearsals` were ever a live read of `authStore.settings`
rather than a value copied onto the service doc, changing the org default later silently changes
every existing (including locked/shared) service's displayed time.
**How to avoid:** `createService` copies the defaults into the new doc's own fields at creation
(verified call site: services.ts:440-494, same pattern as `defaultServiceTemplate`). Never read
`authStore.settings.rehearsalTimeDefaults`/`reportTimeDefault` from any DISPLAY component —
only `createService` (write-once) and the Settings form (its own source of truth) should ever
reference them.
**Verification:** a unit test that changes the org default via `updateOrgSettings`, then asserts
an already-created service's stored `rehearsals`/`reportTime` are byte-identical to before.

### Pitfall 2: New fields never reach `ServiceSnapshot`/`RehearseAccessDoc`
**What goes wrong:** `Service.rehearsals`/`.reportTime` get added and the editor UI works, but
`buildServiceSnapshot` and/or `buildRehearseAccess` are forgotten — ShareView/My Schedule/
VolunteerServiceView keep showing nothing, with no compile error (the allowlist pattern fails
silently by omission).
**How to avoid:** treat editing `Service` type + BOTH builders as one atomic checklist item, per
this document's Verified Integration Points §5 above. Both files are in-scope for the SAME task
in the plan, not sequential tasks.
**Verification:** a projection test mirroring `services.sharePii.test.ts`'s
`await import('../services')` pattern, asserting `buildServiceSnapshot(service).rehearsals`/
`.reportTime` AND `buildRehearseAccess(service, ...).rehearsals`/`.reportTime` both surface a
known input value.

### Pitfall 3: Timezone-implicit `Date` construction from a combined date+time string
**What goes wrong:** `new Date('2026-09-13T18:30')` is interpreted in the BROWSER's local
timezone, not the org's. A report time entered by a planner in the church's own timezone can
render wrong on a device set to a different zone, or roll to the wrong calendar day near midnight.
**How to avoid:** never concatenate `date` + `T` + `time` into a single string passed to `new
Date(...)`. Keep them as two separate stored strings (already the design above) and, when
formatting for 12-hour display, construct a throwaway LOCAL date purely from the numeric
components (`new Date(2000, 0, 1, hh, mm)`) — never let the runtime infer a timezone from an ISO
string. There is no cross-timezone volunteer concern here per R429-433's explicit "single physical
venue, literal wall-clock, never zone-shifted" design decision — the risk is purely an
implementation bug (implicit `Date` string parsing), not a genuine multi-timezone requirement.
**Verification:** a unit test asserting the 12-hour formatter produces an identical string
regardless of the TEST RUNNER's own system timezone (set `process.env.TZ` in the test, or run
under `Intl.DateTimeFormat().resolvedOptions().timeZone` variation) — CI is commonly UTC while
local dev machines are not, a real and easy way to catch this bug class before a volunteer sees it.

### Pitfall 4: `ScheduleServiceCard.vue` needs new props threaded at ALL 3 call sites
**What goes wrong:** `MyScheduleView.vue` renders `ScheduleServiceCard` three times (This Week /
Later This Month / Past, lines 59-73 / 83-97 / 124-134) with separately-typed prop lists — adding
`report-time`/`rehearsals` to the component's `defineProps` but only updating 1-2 of the 3 call
sites leaves that bucket silently blank.
**How to avoid:** grep for `<ScheduleServiceCard` before considering the task done; all 3 call
sites must pass the same two new props.

## Code Examples

### Firestore rules — confirmed no changes needed

`firestore.rules:209-231` (`match /services/{docId}` update rule) allows unrestricted field edits
while `storedStatus() == 'draft'` (only `createdBy`/`createdAt` are excluded via
`!keys().hasAny([...])`) — there is no field allowlist restricting to known keys, so `rehearsals`/
`reportTime` require **zero rules changes**. Same for the org doc: `firestore.rules:61-89`'s
`lifecycleFields()` exclusion list only covers super-admin-only audit fields
(`active`/`aiMasterEnabled`/`bibleApiEnabled`/etc.) — an ordinary editor's `settings.*` write,
including the two new default fields, is unrestricted.

**One existing constraint to be aware of, not a new gap this phase introduces:** once a service's
`status` is `planned`/`exported`, the update rule's other two branches (lines 220-230) are narrow
`hasOnly([...])` allowlists that do NOT include arbitrary fields — so `rehearsals`/`reportTime`
can only be edited while the service is in `draft` status (same as every other field in this app
today). The service editor's existing `canEditService = authStore.isEditor && !isLocked` gate
(ServiceEditorView.vue:2203) already enforces exactly this, so the new "Times" UI needs no new
gating logic — reuse `canEditService` verbatim, the same way the existing date-picker button does
(line 51-65).

### Settings UI pattern to mirror (verified, SettingsView.vue:424-1217)

```vue
<!-- Messaging section is the structural template: h2 label, form controls,
     a save handler that calls authStore.updateOrgSettings + local mirror-write,
     `Saved!`/error feedback text. Copy this shape for "Rehearsal & Report Defaults". -->
<h2 class="text-sm font-semibold text-gray-300 mb-3">Messaging</h2>
...
<input type="checkbox" v-model="lockNotifyDefaultInput" @change="onToggleLockNotifyDefault" />
...
<p v-if="reminderDaysBeforeSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
```

```typescript
// save handler pattern (SettingsView.vue:1152-1168), to mirror for the new section:
async function onSaveRehearsalDefaults() {
  const previous = authStore.settings.rehearsalTimeDefaults
  try {
    await authStore.updateOrgSettings({
      'settings.rehearsalTimeDefaults': rehearsalTimeDefaultsInput.value,
    })
    savedFeedback.value = true
    setTimeout(() => { savedFeedback.value = false }, 2000)
  } catch (err) {
    console.error('[SettingsView] save rehearsalTimeDefaults error:', err)
    saveError.value = 'Failed to save. Please try again.'
    rehearsalTimeDefaultsInput.value = previous  // revert local input on failure
  }
}
```

### Service editor "Times" UI placement (verified, ServiceEditorView.vue:37-92, 2694-2702)

The existing date control is a hidden `<input type="date">` triggered via `showPicker()` from a
styled button, bound to `localService.value.date`, writing through `onDateChange` →
`localService.value.date = newDate` → the existing debounced autosave → `updateService`. A
"Times" section should follow the SAME `localService.value.rehearsals`/`.reportTime` v-model →
debounced-autosave → `updateService(id, {rehearsals, reportTime})` path, gated by the same
`canEditService` computed already used for the date picker (line 52 `v-else` branch) — no new
save/dirty-tracking mechanism needed, reuse the existing one.

## State of the Art

Not applicable — this is greenfield within the codebase (no prior rehearsal/report-time
implementation to supersede). The one relevant "old approach → current approach" is internal to
this phase: the `ScheduleServiceCard.vue:40-41` comment IS the documented "old approach" (times
omitted entirely) this phase replaces.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Undated rehearsals (`date === ''`) should be filtered out of both public projections, per CONTEXT.md's own stated "reasonable default" | Architecture Patterns, Pattern 2 | Low — CONTEXT.md explicitly frames this as Claude's discretion with a stated preferred default; if the owner wants undated rows shown with a placeholder instead, this is a small, isolated filter-condition change in exactly 2 functions |
| A2 | `sortRehearsals` should live in a NEW file `src/utils/rehearsalTimes.ts` rather than being added to the existing `src/utils/serviceProjection.ts` | Recommended Project Structure | Low — purely a file-organization choice; `serviceProjection.ts`'s own header comment scopes it to "per-kind slot/marker allowlist helpers," so a rehearsal-specific sort utility is a natural sibling file, not a shoehorned addition, but the planner could equally choose to extend `serviceProjection.ts` and lose nothing functionally |
| A3 | The org-settings defaults list (`rehearsalTimeDefaults: string[]`) has no natural sort order requirement (time-only, no date) and does not need `sortRehearsals` applied to it | Pattern 1 | Low — if the owner wants the Settings UI's default-times list also chronologically sorted by time-of-day, that's a one-line `.sort()` on plain `HH:mm` strings (lexicographic sort is already correct for zero-padded HH:mm), not a design change |

## Open Questions

1. **Exact rehearsal-add UX for the org-defaults section — fixed slots or a free add/remove list?**
   - What we know: `rehearsalTimeDefaults: string[]` supports any number of default times (R429
     says "one or more").
   - What's unclear: whether the Settings UI should look like a fixed 1-3 time inputs or a full
     add/remove list mirroring the per-service rehearsal editor's own UX.
   - Recommendation: mirror the per-service editor's add/remove list pattern (consistency, and it
     already needs to be built once) — this is a UI-labels/layout decision explicitly left to
     Claude's Discretion per CONTEXT.md.

## Environment Availability

Not applicable — no new external tool/service/runtime dependency. All work is within the existing
Vue/Pinia/Firestore stack already running locally per `.env.local`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (root config) |
| Config file | `vite.config.ts` (excludes `src/rules.test.ts` and `render-service/**`) |
| Quick run command | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts` (new file) |
| Full suite command | `npx vitest run` (bare — per CLAUDE.md, this is the correct baseline command; do NOT use `--dir src`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| R430 | `sortRehearsals` orders chronologically regardless of storage-array order, including an out-of-order insert (not just append) | unit | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts` | ❌ Wave 0 |
| R430 | Formatting an `'HH:mm'` string to 12-hour wall-clock text is stable across system timezones | unit | same file | ❌ Wave 0 |
| R432 | Copy-not-live-bind: changing `rehearsalTimeDefaults`/`reportTimeDefault` via `updateOrgSettings` does NOT mutate an already-created service's stored `rehearsals`/`reportTime` | unit | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts` (new file, mirrors `services.sharePii.test.ts`'s mock/import setup) | ❌ Wave 0 |
| R432 | A service created AFTER an org-default change picks up the NEW default (inverse of the above — catches stale-settings-object bugs) | unit | same file | ❌ Wave 0 |
| R433 | `buildServiceSnapshot(service).rehearsals`/`.reportTime` AND `buildRehearseAccess(service, ...).rehearsals`/`.reportTime` both surface a known input value | unit | `npx vitest run src/stores/__tests__/services.rehearsalProjection.test.ts` (new file, mirrors `services.sharePii.test.ts` exactly — same `vi.mock`/`await import('../services')` setup) | ❌ Wave 0 |
| R433 | Undated rehearsal (`date: ''`) is filtered from both projections but present in the raw `Service` doc | unit | same file as above | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <the new/touched test file>`
- **Per wave merge:** `npx vitest run` (bare, full app suite) + `npm run type-check` (per CLAUDE.md,
  NOT `vue-tsc --noEmit -p tsconfig.app.json` — that form silently skips test files)
- **Phase gate:** Full suite green (expect exactly the pre-existing `storage.rules.test.ts`
  baseline failure, nothing new) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/utils/rehearsalTimes.ts` + `src/utils/__tests__/rehearsalTimes.test.ts` — `sortRehearsals`
      + the 12-hour formatter, both new
- [ ] `src/stores/__tests__/services.rehearsalDefaults.test.ts` — copy-not-live-bind test pair
      (mirrors `services.sharePii.test.ts`'s mock scaffold: `vi.mock('firebase/firestore')`,
      `vi.mock('@/firebase')`, `vi.mock('@/stores/songs'|'roster'|'quarters')`,
      `await import('../services')`)
- [ ] `src/stores/__tests__/services.rehearsalProjection.test.ts` — the required both-projections
      test, same mock scaffold

**Display-site checks — unit-testable vs. human/visual UAT:**
- Unit-testable: the DATA reaching each surface (props/computed values derived from
  `ServiceSnapshot`/`RehearseAccessDoc`/live `Service` are plain objects/strings — a component
  test asserting `wrapper.text()` contains the formatted time string is straightforward and cheap
  for `ScheduleServiceCard.vue`, `ServiceCard.vue`, and `ShareView.vue`'s computed).
- Human/visual UAT only: the actual visual placement/spacing of the new time text next to the
  date on each of the 4 named surfaces (dashboard, My Schedule, volunteer view, share/plan) —
  Vitest+jsdom cannot verify layout, and per the `.planning/research/PITFALLS.md` "Looks Done But
  Isn't" checklist, "often missing one or more of the four named surfaces... verify each surface
  individually, don't assume the editor showing it correctly means every consumer does."
- Recommend a manual pass through all 7 verified display sites (table above) as the phase's UAT
  checklist item, since #6/#7 are fed by a projection that only refreshes at `markAsPlanned` —
  a UAT session must re-lock a service after adding times to see them on My Schedule/Volunteer
  view, not just save the editor.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | No new auth surface |
| V3 Session Management | no | No new session concern |
| V4 Access Control | yes (unchanged) | Existing `isOrgEditor`/`isOrgMember` gates on `services/{docId}` and `organizations/{orgId}` already cover the new fields — verified no rule change needed (see Code Examples above) |
| V5 Input Validation | yes | `<input type="date">`/`<input type="time">` constrain the browser-side format; store-side, `stripUndefined` (already used by `updateService`) strips any `undefined` leaves before the Firestore write. No new server-side validation function is needed — these are display strings, not security-sensitive values (unlike, e.g., an email or role id) |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A non-editor client attempts to write `rehearsals`/`reportTime` directly | Tampering | Already covered by the existing `isOrgEditor(orgId)` gate on the `services/{docId}` update rule — no new rule needed, verified above |
| Stale/frozen `RehearseAccessDoc` shows outdated times after an edit that wasn't followed by a re-lock | Information disclosure (minor — shows an OLD, not a forged, value) | Existing, already-accepted latency contract for every `RehearseAccessDoc` field (not new to this phase); document in UAT that a re-lock is required for My Schedule/Volunteer view to reflect a post-lock time edit |

## Sources

### Primary (HIGH confidence — direct source reads this session, 2026-09-09)
- `src/types/service.ts` (full file) — `Service` interface, lines 219-270
- `src/types/organization.ts` (full file) — `OrgSettings`/`DEFAULT_ORG_SETTINGS`, lines 26-178
- `src/stores/auth.ts` — `applyOrgSnapshot` (372-438), `updateOrgSettings` (447-469)
- `src/stores/services.ts` — imports (1-40), `ServiceSnapshot`/`buildServiceSnapshot`/
  `toPublicServiceSnapshot` (75-251), `CreateServiceInput` (46-50), `createService` (440-494),
  `updateService` (603-621), `maybeRefreshShareLink` (1245-1289)
- `src/utils/serviceProjection.ts` (full file) — shared allowlist helpers, confirms
  `buildServiceSnapshot` is NOT defined here
- `src/utils/rehearseAccess.ts` (full file) — `RehearseAccessDoc`/`buildRehearseAccess`
- `src/components/ServiceCard.vue:124`, `src/components/ScheduleServiceCard.vue` (full file)
- `src/views/ShareView.vue:170-233`, `src/views/DashboardView.vue:1-100,370-396`
- `src/views/MyScheduleView.vue:50-149`, `src/views/VolunteerServiceView.vue:1-60,210-244`
- `src/stores/mySchedule.ts:14-23,140` — `MyScheduleDoc = RehearseAccessDoc & {orgId}`
- `src/stores/__tests__/services.sharePii.test.ts:1-165` — projection test pattern to mirror
- `firestore.rules:61-104,201-231` — `organizations/{orgId}` and `services/{docId}` write rules
- `src/views/ServiceEditorView.vue:30-92,2203,2694-2702` — header/date-picker/canEditService pattern
- `src/views/SettingsView.vue:424-510,618-638,1121-1217` — Messaging section pattern to mirror
- `src/composables/useRunTimers.ts:49` — 12-hour `toLocaleTimeString` reference idiom
- `.planning/phases/139-rehearsal-report-times/139-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — R429-R433
- `CLAUDE.md` — `npm run type-check` vs `-p tsconfig.app.json`; bare `npx vitest run` scoping;
  no-date-library rule

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — milestone-level integration map (one correction applied:
  `buildServiceSnapshot`'s actual file location)
- `.planning/research/PITFALLS.md` Pitfalls 5-8 — timezone/ordering/retroactive-drift/projection-
  threading, re-verified against real line numbers in this pass

### Tertiary (LOW confidence)
- None — every claim in this document is grounded in a direct source read this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, pure reuse of existing idioms
- Architecture: HIGH — every integration point verified by direct file read, one correction
  applied to the inherited milestone research (buildServiceSnapshot's actual location)
- Pitfalls: HIGH — grounded in real file/line citations, cross-checked against actual current
  rule text and store code, not carried over unverified from the milestone pass

**Research date:** 2026-09-09
**Valid until:** 30 days (stable, no external API/version dependency)
