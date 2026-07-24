# Phase 14: In-App Quarterly Availability Editor - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 8 (2 new components, 6 modified files)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/types/roster.ts` (extend) | model | CRUD | itself (`PersonQuarterData` interface, lines 38-42) | exact — extend in place |
| `src/stores/quarters.ts` (extend, new `setPersonAvailability`) | service/store | CRUD (targeted Firestore dot-path write) | `applyCsvToQuarter` (same file, lines 117-153) + `assignPerson`/`clearAssignment` dot-path style (lines 189-218) | exact |
| `src/utils/scheduler.ts` (extend fill loop) | utility (pure fn) | transform/batch | itself — the `while` candidate loop (lines 91-117) | exact — extend in place |
| `src/utils/planningCenterApi.ts` (new `fetchPeopleForTeamPositions`) | utility (API client) | request-response (paginated fetch) | `fetchAllPeople` (lines 1020-1062, pagination+429-retry) + `fetchTeamPositions`/`fetchServiceTypeTeams` (lines 106-127, 591-610, request shape) | exact |
| `src/components/AvailabilityDrawer.vue` (new) | component | request-response (controlled view over store state) | `RosterImportModal.vue` (Teleport/Transition overlay shell, lines 1-49, 220-266) + sketch `index.html` `editorHtml()` (lines 335-411) for markup/control shape | role-match (overlay shell) + exact (control markup, from sketch) |
| `src/components/AvailabilityRosterTable.vue` (new) | component | request-response (read-only list + row click emits) | `QuarterGrid.vue` (table markup + helper-fn style, lines 243-278) + sketch `index.html` `rowHtml()`/`renderTable()` (lines 314-332) | role-match + exact (markup, from sketch) |
| `src/components/RosterImportModal.vue` (extend — team/position step) | component | request-response (multi-step modal) | itself — existing `step` state machine (lines 241-266, 293-322) | exact — extend in place |
| `src/components/QuarterGrid.vue` (extend `availableUnassigned`) | component | transform (candidate filter) | itself — `isBlackedOut`/`availableUnassigned` (lines 253-268) | exact — extend in place |
| `src/views/QuarterView.vue` (extend — mount drawer + roster table) | view | request-response (page composition) | itself — existing `VolunteerCsvImportModal` mount + `csvModalOpen` pattern (lines 288-293, 432-437, 305-319) | exact — extend in place |

## Pattern Assignments

### `src/types/roster.ts` (model, CRUD)

**Analog:** itself, `PersonQuarterData` interface

**Current shape** (lines 34-42):
```typescript
/**
 * Quarter-scoped, per-person availability — reset each quarter (D-18),
 * replaced per person on re-import (D-19). NOT standing data.
 */
export interface PersonQuarterData {
  personId: string
  blackoutDates: string[] // expanded YYYY-MM-DD list (D-17 ranges already expanded against serviceDates)
  pairedWith: string[] // Person.id[], bidirectional — must-serve-with pairings (D-09)
}
```

**Extension pattern** (per RESEARCH.md D-05/A1 — quarter-scoped placement):
```typescript
export type FrequencyTier = 'regular' | 'fillin' | 'out'

export interface PersonQuarterData {
  personId: string
  blackoutDates: string[]
  pairedWith: string[]
  frequencyTier: FrequencyTier   // NEW — defaults 'regular', resets each new quarter
  note: string                   // NEW — free-text quarter note (D-03/D-07), never auto-scheduled
}
```
Every read site must default missing fields via `?? 'regular'` / `?? ''` — existing Phase 13 `PersonQuarterData` entries predate these fields (no migration script; lazy-default on read, same convention `blackoutDates.includes()` optional-chaining already uses in `QuarterGrid.vue` line 254).

`Person` (lines 13-27) stays unchanged — `frequencyTargetN` remains the standing 1-in-N cadence, meaningful only when `frequencyTier === 'regular'`.

---

### `src/stores/quarters.ts` (service/store, CRUD — new `setPersonAvailability`)

**Analog:** `applyCsvToQuarter` (same file, lines 117-153) for the bidirectional-pairing-merge pattern; `assignPerson`/`clearAssignment` (lines 189-218) for the targeted-dot-path `updateDoc` convention.

**Imports already present** (lines 1-19) — no new imports needed beyond what's already imported (`updateDoc`, `doc`, `serverTimestamp` all present):
```typescript
import {
  collection, onSnapshot, addDoc, updateDoc, doc, setDoc,
  serverTimestamp, query, orderBy, type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Quarter, RoleSlotConfig, PersonQuarterData, ProposeResult, Role } from '@/types/roster'
```

**Existing add-only bidirectional pairing merge to extend** (lines 134-150):
```typescript
// Bidirectional pairing: a partner not present in `rows` still gets the reciprocal
// pairing merged into their (otherwise untouched) entry.
for (const row of rows) {
  for (const partnerId of row.pairedWith) {
    const partnerEntry = personQuarterData[partnerId] ?? {
      personId: partnerId,
      blackoutDates: [],
      pairedWith: [],
    }
    if (!partnerEntry.pairedWith.includes(row.personId)) {
      personQuarterData[partnerId] = {
        ...partnerEntry,
        pairedWith: [...partnerEntry.pairedWith, row.personId],
      }
    }
  }
}
```
This is add-only. The new `setPersonAvailability` needs an explicit `added`/`removed` diff against the *previous* `pairedWith` (see RESEARCH.md Pattern 3, lines 279-318, for the full worked implementation) — copy the merge *shape* above, extend with a symmetric removal branch.

**Targeted dot-path write convention to follow** (lines 189-203, `assignPerson`):
```typescript
async function assignPerson(
  quarterId: string, date: string, roleId: string, personId: string,
): Promise<void> {
  if (!orgId.value) return
  const quarter = getQuarter(quarterId)
  const existing = quarter.calendar[date]?.[roleId] ?? []
  if (existing.includes(personId)) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), {
    [`calendar.${date}.${roleId}`]: [...existing, personId],
    updatedAt: serverTimestamp(),
  })
}
```
`setPersonAvailability` should follow this exact `updateDoc(doc(...), { [dot.path]: value, updatedAt: serverTimestamp() })` shape, writing `personQuarterData.${personId}` as one whole nested object (safe — only one leader edits one person's drawer at a time) plus `personQuarterData.${partnerId}.pairedWith` dot-paths for reciprocal add/remove on OTHER people's entries (do not touch their `blackoutDates`/`frequencyTier`/`note`).

**`getQuarter` helper already available** (lines 59-63) for reading `previous` pairedWith before diffing.

**Standing-field write-through pattern** (lines 124-126, inside `applyCsvToQuarter`) — for when the drawer's advanced 1-in-N override changes `Person.frequencyTargetN`:
```typescript
if (Object.keys(row.standing).length > 0) {
  await rosterStore.updatePerson(row.personId, row.standing)
}
```

**Registration:** add `setPersonAvailability` to the store's returned object (line ~286, alongside `applyCsvToQuarter`).

---

### `src/utils/scheduler.ts` (utility, transform — two-pass fill loop)

**Analog:** itself — the existing single-pass candidate loop (lines 91-117)

**Imports** (lines 1-7) — add `FrequencyTier` to the type import:
```typescript
import type {
  Person, RoleSlotConfig, PersonQuarterData, QuarterCalendar, ProposeResult,
} from '@/types/roster'
```

**Existing single-pass loop to extend into two-pass** (lines 91-117):
```typescript
for (const { roleId, count } of rolesForDate) {
  calendar[date]![roleId] ??= []
  while (calendar[date]![roleId]!.length < count) {
    const alreadyInRole = new Set(calendar[date]![roleId])
    const candidates = people.filter(
      (p) => p.active && p.roles.includes(roleId) && !isBlackedOut(p.id, date) && !alreadyInRole.has(p.id),
    )
    if (candidates.length === 0) {
      unfilled.push({ date, roleId })
      break
    }
    const scored = candidates
      .map((p) => ({ p, deficit: (dateIndex + 1) / p.frequencyTargetN - (served.get(p.id) ?? 0) }))
      .sort((a, b) => b.deficit - a.deficit || (served.get(a.p.id) ?? 0) - (served.get(b.p.id) ?? 0) || a.p.name.localeCompare(b.p.name))
    const chosen = scored[0]!.p
    assignToRole(roleId, chosen.id)
    propagatePairing(chosen.id, new Set([chosen.id]))
  }
}
```
Add a `tierOf(personId)` helper next to the existing `isBlackedOut`/`partnersOf` closures (lines 32-34):
```typescript
const isBlackedOut = (personId: string, date: string) =>
  pqdById.get(personId)?.blackoutDates.includes(date) ?? false
const partnersOf = (personId: string) => pqdById.get(personId)?.pairedWith ?? []
// NEW:
const tierOf = (personId: string): FrequencyTier => pqdById.get(personId)?.frequencyTier ?? 'regular'
```
Then split `candidates` filtering into a `regular` pass and a `fillin` last-resort pass (see RESEARCH.md Pattern 2, lines 232-273, for the full worked two-pass loop) — `'out'`-tier people are filtered out of both passes unconditionally.

**`propagatePairing`'s partner eligibility check to extend** (lines 64-89) — add an `'out'`-tier partner exclusion alongside the existing blackout check (line 70-73):
```typescript
if (isBlackedOut(partnerId, date)) {
  pairingConflicts.push({ date, personId, partnerId, reason: 'partner blacked out' })
  continue
}
// NEW: same shape, new reason string
if (tierOf(partnerId) === 'out') {
  pairingConflicts.push({ date, personId, partnerId, reason: 'partner out this quarter' })
  continue
}
```

**Test analog:** `src/utils/__tests__/scheduler.test.ts` — existing file already covers `isBlackedOut`/pairing-conflict assertions in this exact shape; add `fillin`/`out`-tier test cases following the existing `describe`/`it` structure.

---

### `src/utils/planningCenterApi.ts` (utility/API client, request-response — new `fetchPeopleForTeamPositions`)

**Analog:** `fetchAllPeople` (lines 1020-1062) for pagination+429-retry; `fetchTeamPositions` (lines 591-610) and `fetchServiceTypeTeams` (lines 106-127) for the request shape this new function slots after.

**Imports/module-level constants already present** (lines 1-20) — reuse directly, no new imports:
```typescript
export const PC_BASE_URL = '/api/planningcenter/services/v2'

function basicAuthHeader(appId: string, secret: string): string {
  return 'Basic ' + btoa(appId + ':' + secret)
}
```

**Existing team-scoped fetch shape to mirror** (`fetchTeamPositions`, lines 591-610):
```typescript
export async function fetchTeamPositions(
  appId: string, secret: string, teamId: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(
    `${PC_BASE_URL}/teams/${teamId}/team_positions?per_page=100`,
    { headers: { Authorization: basicAuthHeader(appId, secret), Accept: 'application/json' } },
  )
  if (!response.ok) return []
  const json = (await response.json()) as { data: Array<{ id: string; attributes: { name: string } }> }
  return json.data.map(p => ({ id: p.id, name: p.attributes.name }))
}
```
`fetchPeopleForTeamPositions` uses the same base URL segment (`/teams/${teamId}/...`) with `person_team_position_assignments?include=person&per_page=100`.

**Existing pagination + 429-retry loop to copy exactly** (`fetchAllPeople`, lines 1020-1062):
```typescript
export async function fetchAllPeople(appId: string, secret: string): Promise<PcPerson[]> {
  const authHeader = basicAuthHeader(appId, secret)
  let url: string | undefined = `${PC_BASE_URL}/people?per_page=100`
  const allPeople: PcPerson[] = []
  while (url) {
    let response: Response
    for (let attempt = 0; ; attempt++) {
      response = await fetch(url, { headers: { Authorization: authHeader, Accept: 'application/json' } })
      if (response.status !== 429 || attempt >= 3) break
      const retryAfter = response.headers.get('Retry-After')
      const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 60_000
      await new Promise((r) => setTimeout(r, waitMs))
    }
    if (!response!.ok) throw new Error(`Failed to fetch people: ${response!.status}`)
    const json = (await response.json()) as { data: PcPerson[]; links: { next?: string; self: string } }
    allPeople.push(...json.data)
    if (json.links.next) {
      url = json.links.next.replace('https://api.planningcenteronline.com/services/v2', PC_BASE_URL)
    } else {
      url = undefined
    }
  }
  return allPeople
}
```
`fetchPeopleForTeamPositions` follows this exact `while (url)` + `links.next` rewrite shape (RESEARCH.md Pattern 4, lines 337-371, has the full worked function using `include=person` to avoid the N+1 per-person email-style fetch `fetchAndMapPeople`, lines 1106-1124, needs — team-position-assignment people do NOT need a separate `fetchPersonEmails` call for the *filtering* step, only if emails are needed downstream).

**Error handling convention:** `throw new Error(...)` on non-ok (matches `fetchAllPeople`/`fetchServiceTypeTeams`), NOT `return []` (that's `fetchTeamPositions`'s softer convention for a secondary/optional list) — match whichever the planner decides is more appropriate; RESEARCH.md's worked example throws.

**Test analog:** `src/utils/__tests__/planningCenterApi.test.ts` — existing file already covers `fetchAllPeople`/`fetchTeamPositions` fetch-mocking + pagination assertions in this shape.

---

### `src/components/AvailabilityDrawer.vue` (new component, request-response)

**Analog:** `src/components/RosterImportModal.vue` for the Teleport/Transition overlay shell (centered modal — must be adapted to a right-drawer per D-01, see sketch below); sketch `.planning/sketches/001-availability-editor/index.html` `editorHtml()` (lines 335-411) for the exact control markup/behavior to port to Vue.

**Overlay shell pattern to adapt** (`RosterImportModal.vue`, lines 1-49):
```vue
<Teleport to="body">
  <Transition enter-active-class="transition-opacity duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="open" class="fixed inset-0 z-40 bg-black/60"></div>
  </Transition>
  <Transition enter-active-class="transition-all duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition-all duration-150 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- centered modal body -->
    </div>
  </Transition>
</Teleport>
```
D-01 requires a **right drawer**, not a centered modal — adapt the Transition wrapper to slide-from-right (`translate-x` enter/leave classes) and position the panel `fixed top-0 right-0 bottom-0 w-full max-w-lg` per the sketch's `.drawer`/`.drawer-scrim` CSS (sketch lines 130-135) instead of `flex items-center justify-center`.

**Script setup props/emit pattern** (`RosterImportModal.vue`, lines 220-234):
```typescript
import { ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; imported: [count: number] }>()
```
`AvailabilityDrawer.vue` should take `quarterId: string` and `personId: string | null` (controlled by `QuarterView.vue`'s `openPersonId` ref) rather than a raw `open: boolean`, and emit `close: []`.

**Reset-on-open watcher pattern** (lines 254-266):
```typescript
watch(
  () => props.open,
  (isOpen) => { if (isOpen) resetToIdle() },
)
```
Adapt: `watch(() => props.personId, (id) => { if (id) loadDraftFor(id) })` — populate a local `draft` ref from `rosterStore.people.find(id)` (standing) + `quartersStore.getQuarter(quarterId).personQuarterData[id] ?? emptyDefault` (quarter-scoped), matching `QuarterGrid.vue`'s existing `?.blackoutDates.includes(date) ?? false` optional-chaining default (line 254) for a person with no entry yet.

**Control markup/behavior to port from the sketch** (`.planning/sketches/001-availability-editor/index.html`):
- Frequency segmented control: `FREQ_ORDER` array (`weekly`/`biweek`/`monthly`/`fillin`/`out`, sketch lines 242-249) rendered as buttons (lines 344-347), each setting both `frequencyTargetN` (when regular) and `frequencyTier` together — ONE UI control, two data fields (RESEARCH.md Open Question 1).
- Sundays-only calendar: iterate `quarter.serviceDates` directly (never a generic date-picker) — sketch's `calHtml()` (lines 390-399) renders one button per date with an `off` class when in `blackoutDates`; `toggleSunday()` (line 424) toggles membership.
- Nth-Sunday chips: sketch's `ordFullySelected()`/`toggleNth()` (lines 404-406, 425-430) — group `serviceDates` by "which Nth Sunday of its month" and toggle the whole group.
- Date-range block: sketch's `applyRange()` (lines 431-433) — filters `serviceDates` between two date-input bounds and adds each to `blackoutDates` (never produces free-text range syntax — do NOT call `expandBlackoutCell`, that stays CSV-only per RESEARCH.md Anti-Patterns).
- Must-serve-with typeahead: sketch's `pairSearch()`/`addPair()`/`removePair()` (lines 436-450) — plain `v-model` + computed filtered list + `v-if` dropdown, no autocomplete library (RESEARCH.md Don't Hand-Roll table).
- Quarter note: plain `<textarea>` bound to `draft.note` (sketch lines 373-376).
- Save handler: `quartersStore.setPersonAvailability(...)` call, mirroring `QuarterGrid.vue`'s scoped-store-action call style (see RESEARCH.md Code Examples, lines 439-456, for the full worked `onSave`).

**Test analog:** No existing drawer component test file — new `src/components/__tests__/AvailabilityDrawer.test.ts`; mirror `src/components/__tests__/CsvImportModal.test.ts` or `ServiceCard.test.ts` for Vue Test Utils mount/emit-assertion conventions used elsewhere in this codebase.

---

### `src/components/AvailabilityRosterTable.vue` (new component, request-response)

**Analog:** `QuarterGrid.vue`'s helper-function style (lines 243-278) for computed candidate/summary helpers; sketch `index.html` `rowHtml()`/`renderTable()`/`tableHead()` (lines 314-332) for the exact table markup/columns.

**Helper-fn style to mirror** (`QuarterGrid.vue`, lines 243-259):
```typescript
function personName(id: string): string {
  return rosterStore.people.find((p) => p.id === id)?.name ?? '(unknown)'
}
function hasRole(person: Person, roleId: string): boolean {
  return person.roles.includes(roleId)
}
```
`AvailabilityRosterTable.vue` needs analogous pure display helpers: `blackoutSummary(person, pqd)`, `freqBadge(person, pqd)`, `statusPill(tier)`, `pairSummary(pqd)` — port directly from the sketch's `blackoutSummary()`/`freqBadge()`/`statusPill()`/`pairChipsHtml()` (sketch lines 280-311), converted from string-concat HTML to Vue template bindings.

**Table columns/row-click dispatch from sketch** (lines 314-332):
```
Volunteer | Roles | Frequency | Unavailable | Pairing | Status | ›
```
Row click emits the person id (sketch's `onRowClick` → `openDrawer(id)`, line 498) — `AvailabilityRosterTable.vue` should `emit('select', personId)`, consumed by `QuarterView.vue` setting `openPersonId.value = personId`.

**Search/filter toolbar** (sketch lines 174-179): `<input class="search">` + 3 filter chips (`All` / `Needs input` / `Out this quarter`) — implement as a local `ref` + `computed` filtered list, no library.

**Test analog:** No existing analog; if a component test is added, mirror `src/components/__tests__/ServiceCard.test.ts`'s list-render assertion style.

---

### `src/components/RosterImportModal.vue` (extend — team/position selection step, D-11)

**Analog:** itself — the existing `Step` union + state-machine pattern (lines 241-266, 293-322)

**Existing step type + state to extend** (lines 241-266):
```typescript
type Step = 'idle' | 'fetching' | 'preview' | 'importing' | 'done' | 'error'
const step = ref<Step>('idle')
const errorMessage = ref('')
const mappedPeople = ref<UpsertPersonInput[]>([])
const preview = ref({ toAdd: 0, toUpdate: 0 })

watch(() => props.open, (isOpen) => { if (isOpen) resetToIdle() })

function resetToIdle() {
  step.value = 'idle'
  errorMessage.value = ''
  mappedPeople.value = []
  preview.value = { toAdd: 0, toUpdate: 0 }
}
```
Add new steps (e.g. `'selectServiceType' | 'selectTeam' | 'selectPositions'`) inserted between `'idle'` and `'fetching'`; extend `resetToIdle()` to also clear the new team/position selection state (per RESEARCH.md's Security Domain note — `selectedPositionIds` must be freshly derived each modal open, never cached across opens).

**Existing fetch-and-transition action to mirror** (`onStartFetch`, lines 293-310):
```typescript
async function onStartFetch() {
  const creds = authStore.pcCredentials
  if (!creds) return
  step.value = 'fetching'
  errorMessage.value = ''
  try {
    const people = await fetchAndMapPeople(creds.appId, creds.secret)
    mappedPeople.value = people
    preview.value = classifyPeople(people, rosterStore.people)
    step.value = 'preview'
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred'
    errorMessage.value = message
    step.value = 'error'
  }
}
```
New team-selection step's fetch handlers (`onSelectServiceType`, `onSelectTeam`) follow this exact try/catch/step-transition shape, calling `fetchServiceTypeTeams`/`fetchTeamPositions` (already imported functions per D-11) instead of `fetchAndMapPeople`. The FINAL fetch (after positions chosen) calls the new `fetchPeopleForTeamPositions` and replaces the current direct `fetchAndMapPeople` call (line 301) — `fetchAndMapPeople`'s whole-directory call is REMOVED from this modal's flow per D-11 (not merely supplemented).

**Existing classify/preview + confirm-import to reuse unchanged** (lines 268-289, 312-322) — `classifyPeople`, `onConfirmImport`, and the final `rosterStore.upsertPeople(mappedPeople.value)` call all stay exactly as-is; only the source of `mappedPeople` changes (position→Role mapping applied when building `UpsertPersonInput[]` from the new fetch).

**Template step-branch pattern to extend** (lines 55-157) — each new step gets a `v-else-if="step === '...'"` block following the exact existing `px-6 py-8` / `px-6 py-12 text-center` container conventions already used for `idle`/`fetching`/`preview`.

---

### `src/components/QuarterGrid.vue` (extend `availableUnassigned`, D-04 Pitfall 3)

**Analog:** itself — `isBlackedOut`/`availableUnassigned` (lines 253-268)

**Current implementation to extend**:
```typescript
function isBlackedOut(personId: string, date: string): boolean {
  return props.quarter.personQuarterData[personId]?.blackoutDates.includes(date) ?? false
}

function hasRole(person: Person, roleId: string): boolean {
  return person.roles.includes(roleId)
}

function availableUnassigned(date: string, roleId: string): Person[] {
  const assigned = new Set(cellPeople(date, roleId))
  return rosterStore.activePeople.filter(
    (p) => hasRole(p, roleId) && !isBlackedOut(p.id, date) && !assigned.has(p.id),
  )
}
```
Add a `tierOf`-style helper matching the scheduler's naming (defaults `?? 'regular'`) and filter it into `availableUnassigned`:
```typescript
function frequencyTierOf(personId: string): FrequencyTier {
  return props.quarter.personQuarterData[personId]?.frequencyTier ?? 'regular'
}

function availableUnassigned(date: string, roleId: string): Person[] {
  const assigned = new Set(cellPeople(date, roleId))
  return rosterStore.activePeople.filter(
    (p) => hasRole(p, roleId) && !isBlackedOut(p.id, date) && !assigned.has(p.id) && frequencyTierOf(p.id) !== 'out',
  )
}
```
`blackedOutToday` (lines 272-277) is a separate list surfaced for a different purpose (showing WHO is blacked out) — leave unchanged; only `availableUnassigned` (the manual-pick candidate list) needs the `'out'` exclusion per RESEARCH.md Pitfall 3.

---

### `src/views/QuarterView.vue` (extend — mount roster table + drawer, D-02)

**Analog:** itself — existing `VolunteerCsvImportModal` mount pattern (lines 288-293, 432-437) and `csvModalOpen` ref convention

**Existing modal-mount pattern to mirror** (lines 288-293, 432-437):
```vue
<VolunteerCsvImportModal
  :open="csvModalOpen"
  :quarter="selectedQuarter"
  @close="csvModalOpen = false"
  @imported="onCsvImported"
/>
```
```typescript
const csvModalOpen = ref(false)
function onCsvImported() {
  csvModalOpen.value = false
}
```
`AvailabilityDrawer.vue`'s mount follows the same pattern but is controlled by `openPersonId` (per RESEARCH.md Pattern 1) rather than a plain boolean:
```vue
<AvailabilityDrawer
  :quarter-id="selectedQuarter?.id ?? null"
  :person-id="openPersonId"
  @close="openPersonId = null"
/>
```
```typescript
const openPersonId = ref<string | null>(null)
```

**Where to add the roster table:** Insert `<AvailabilityRosterTable :quarter="selectedQuarter" @select="openPersonId = $event" />` inside the existing `<template v-if="selectedQuarter">` block (line 107), likely as a new section alongside "Service dates"/"Generate controls" (lines 108-255) — before or after the `QuarterGrid` mount (line 273-279), per D-02's "co-locates availability entry with where scheduling happens."

**Existing imports to extend** (lines 305-314):
```typescript
import AppShell from '@/components/AppShell.vue'
import VolunteerCsvImportModal from '@/components/VolunteerCsvImportModal.vue'
import QuarterGrid from '@/components/QuarterGrid.vue'
import RosterPrintLayout from '@/components/RosterPrintLayout.vue'
// NEW:
import AvailabilityDrawer from '@/components/AvailabilityDrawer.vue'
import AvailabilityRosterTable from '@/components/AvailabilityRosterTable.vue'
```

**Store subscription lifecycle unchanged** (lines 493-507) — both `quartersStore` and `rosterStore` are already subscribed in `initStores()`/`onMounted`; the new components read from these same already-subscribed stores, no new subscription needed.

---

## Shared Patterns

### Firestore dot-path scoped writes (T-13-09-02 convention)
**Source:** `src/stores/quarters.ts` — `assignPerson`/`clearAssignment`/`swapAssignment` (lines 189-234)
**Apply to:** `setPersonAvailability` — always use `updateDoc(doc(...), { [dotPathKey]: value, updatedAt: serverTimestamp() })`, never rewrite the whole `personQuarterData` map via `updateQuarter(quarterId, { personQuarterData: {...} })` (that reintroduces the last-write-wins race this convention was adopted to avoid — see RESEARCH.md Anti-Patterns).
```typescript
await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), {
  [`calendar.${date}.${roleId}`]: [...existing, personId],
  updatedAt: serverTimestamp(),
})
```

### Teleport-based overlay shell
**Source:** `src/components/RosterImportModal.vue` (lines 1-49, 220-266)
**Apply to:** `AvailabilityDrawer.vue` — same `<Teleport to="body">` + backdrop `Transition` + panel `Transition` + `watch(() => props.<controlling-prop>, ...)` reset structure, adapted from centered-modal to right-drawer positioning per the sketch's `.drawer`/`.drawer-scrim` CSS.

### PC API fetch shape (Basic Auth + PC_BASE_URL + throw-on-non-ok)
**Source:** `src/utils/planningCenterApi.ts` — every existing fetch function (e.g. `fetchServiceTypeTeams`, lines 106-127)
**Apply to:** `fetchPeopleForTeamPositions` — identical `Authorization: basicAuthHeader(appId, secret)` header, `${PC_BASE_URL}/...` URL construction, `if (!response.ok) throw new Error(...)` guard.

### Standing vs quarter-scoped field split (Phase 13 D-18)
**Source:** `src/types/roster.ts` (`Person` vs `PersonQuarterData`), enforced by `src/stores/roster.ts::upsertPeople` (lines 142-155, "never include active, never write quarter-scoped data")
**Apply to:** `AvailabilityDrawer.vue`'s save handler — `frequencyTargetN` writes go through `rosterStore.updatePerson` (standing), everything else (`blackoutDates`/`pairedWith`/`frequencyTier`/`note`) goes through `quartersStore.setPersonAvailability` (quarter-scoped). Never conflate the two in one write call.

### Lazy-default optional-chaining for possibly-missing `PersonQuarterData`
**Source:** `src/components/QuarterGrid.vue` line 254 — `props.quarter.personQuarterData[personId]?.blackoutDates.includes(date) ?? false`
**Apply to:** Every new/modified read site touching `frequencyTier`/`note` (scheduler, drawer, roster table, `availableUnassigned`) — default via `?? 'regular'` / `?? ''`, never assume the field exists (pre-migration Phase 13 data lacks it).

## No Analog Found

None — every new/modified file has a direct or role-matched analog already in this codebase (this phase is entirely an extension of Phase 13 patterns per RESEARCH.md's own assessment: "every piece of Phase 14's new infrastructure... is a direct extension of a pattern already proven in this codebase during Phase 13").

## Metadata

**Analog search scope:** `src/types/roster.ts`, `src/stores/quarters.ts`, `src/stores/roster.ts`, `src/utils/scheduler.ts`, `src/utils/planningCenterApi.ts`, `src/utils/volunteerCsv.ts`, `src/utils/quarterDates.ts`, `src/components/RosterImportModal.vue`, `src/components/QuarterGrid.vue`, `src/views/QuarterView.vue`, `.planning/sketches/001-availability-editor/index.html`
**Files scanned:** 11 (all read in full or targeted-range; no re-reads)
**Pattern extraction date:** 2026-07-07
