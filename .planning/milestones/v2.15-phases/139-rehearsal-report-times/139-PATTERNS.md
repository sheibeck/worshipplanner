# Phase 139: Rehearsal & Report Times - Pattern Map

**Mapped:** 2026-09-09
**Files analyzed:** 11 (1 new, 10 modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/utils/rehearsalTimes.ts` (NEW) | utility | transform | `src/composables/useRunTimers.ts` (`formatClock`) + the 5-way duplicated `date.split('-').map(Number)` idiom (e.g. `src/components/ServiceCard.vue:123-126`) | role-match (formatter) / exact (date idiom) |
| `src/types/service.ts` | model | CRUD | same file's existing `stageLayout?`/`messaging?` additive-optional-field style | exact |
| `src/types/organization.ts` | model | CRUD | same file's `bibleVersion`/`timezone` flat-field style in `OrgSettings`/`DEFAULT_ORG_SETTINGS` | exact |
| `src/stores/services.ts` (`createService`) | service | CRUD | same function's existing `authStore.settings.defaultServiceTemplate` read (line 452) | exact |
| `src/stores/services.ts` (`buildServiceSnapshot`) | service | transform | same function's existing conditional-spread of `stageLayout` (~line 205) | exact |
| `src/utils/rehearseAccess.ts` (`buildRehearseAccess`) | utility | transform | same function's existing `serviceDate: service.date` field + conditional-spread siblings | exact |
| `src/views/SettingsView.vue` | component | request-response | same file's "Messaging" section (h2 + inputs + `updateOrgSettings` save handler, lines 424-1217) | exact |
| `src/views/ServiceEditorView.vue` | component | request-response | same file's existing date-picker header block (lines 37-92) + `canEditService` gate (line 2203) | exact |
| `src/components/ServiceCard.vue` | component | transform (display) | same file's own `parsedDate`/`formattedDate` computed (lines 123-140) | exact |
| `src/components/ScheduleServiceCard.vue` | component | transform (display) | same file's own `parsedDate` computed (lines 117-126) — also the file with the TODO this phase closes | exact |
| `src/views/MyScheduleView.vue` (3 call sites) | component | request-response | same file's existing `<ScheduleServiceCard>` prop-passing at the other 2 (of 3) call sites | exact |
| `src/views/ShareView.vue` | component | transform (display) | same file's `formattedDate` computed off `serviceSnapshot.value.date` (lines 181-194) | exact |
| `src/views/VolunteerServiceView.vue` | component | transform (display) | same file's `formattedDate` off `doc.serviceDate` (lines 46, 218-222) | exact |
| `src/utils/__tests__/rehearsalTimes.test.ts` (NEW) | test | transform | `src/stores/__tests__/services.sharePii.test.ts` (mock scaffold + assertion style) | role-match |
| `src/stores/__tests__/services.rehearsalDefaults.test.ts` (NEW) | test | CRUD | `src/stores/__tests__/services.sharePii.test.ts` (full mock scaffold: `firebase/firestore`, `@/firebase`, `@/stores/songs`\|`roster`\|`quarters`, `await import('../services')`) | exact |
| `src/stores/__tests__/services.rehearsalProjection.test.ts` (NEW) | test | transform | `src/stores/__tests__/services.sharePii.test.ts` (same scaffold, dual-builder assertion pattern) | exact |

## Pattern Assignments

### `src/utils/rehearsalTimes.ts` (NEW utility, transform)

**Analogs:** `src/composables/useRunTimers.ts:47-50` (time formatter) + the duplicated date-parse idiom at `src/components/ServiceCard.vue:123-126` / `src/components/ScheduleServiceCard.vue:115-120`.

**Date-parse idiom to copy** (`ServiceCard.vue:123-126`):
```typescript
const parsedDate = computed(() => {
  const [year, month, day] = props.service.date.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day)
})
```

**Time formatter idiom to copy** (`useRunTimers.ts:47-50`):
```typescript
/** A short wall time, e.g. "9:05 AM". */
function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
```

**Composed pattern for the new file** (per RESEARCH.md's verified design — this is the code to write, not an excerpt of existing code):
```typescript
export interface Rehearsal {
  id: string
  date: string // 'YYYY-MM-DD', may be '' (undated, editor-only)
  time: string // 'HH:mm'
}

export function sortRehearsals(rehearsals: Rehearsal[]): Rehearsal[] {
  return [...rehearsals].sort((a, b) => {
    if (a.date === '' && b.date === '') return a.time.localeCompare(b.time)
    if (a.date === '') return 1
    if (b.date === '') return -1
    return a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  })
}

/** Format an 'HH:mm' string as 12-hour wall-clock text, e.g. "8:00 AM".
 *  Never parse date+time as a combined ISO string (timezone-ambiguous) —
 *  construct a throwaway local Date purely to borrow toLocaleTimeString. */
export function formatWallClockTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
```

**Do not** add a 6th hand-rolled date-split copy anywhere; every display site should import from this one file.

---

### `src/types/service.ts` (model, CRUD)

**Analog:** same file's own `stageLayoutAutoSeeded?`/`messaging?` JSDoc-with-rationale additive-field style (verified lines 219-270, RESEARCH.md §1).

**Pattern to copy** — append after existing fields, same doc-comment convention:
```typescript
rehearsals?: { id: string; date: string; time: string }[]
reportTime?: string
```
Mint `id` with `crypto.randomUUID()` at add-time (matches existing 17-file idiom, e.g. `StageMarker.id`-adjacent code in `slotTypes.ts`).

---

### `src/types/organization.ts` (model, CRUD)

**Analog:** same file's `bibleVersion`/`timezone` flat fields in `OrgSettings` (verified lines 26-178, RESEARCH.md §2).

**Pattern to copy:**
```typescript
// OrgSettings interface, alongside `timezone`:
rehearsalTimeDefaults: string[]
reportTimeDefault: string

// DEFAULT_ORG_SETTINGS, alongside `timezone: 'America/Chicago'`:
rehearsalTimeDefaults: [],
reportTimeDefault: '',
```
**No deep-merge needed in `applyOrgSnapshot`** (`src/stores/auth.ts:399-411`) — these are flat, unlike `slideTypography`/`messaging`. The outer shallow `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings }` spread already covers them.

---

### `src/stores/services.ts` — `createService` (service, CRUD)

**Analog:** same function's existing `authStore.settings.defaultServiceTemplate` read at line 452.

**Pattern to copy** (`services.ts:440-494`, `CreateServiceInput` at 46-50):
```typescript
const authStore = useAuthStore()
const stored = authStore.settings.defaultServiceTemplate // EXISTING precedent, line 452

const rehearsals = authStore.settings.rehearsalTimeDefaults.map((time) => ({
  id: crypto.randomUUID(),
  date: '', // planner dates each rehearsal — org default cannot know a future service's date
  time,
}))
const reportTime = authStore.settings.reportTimeDefault

const ref = await addDoc(collection(db, 'organizations', orgId.value, 'services'), {
  ...data,
  progression: '1-2-2-3',
  slots,
  status: 'draft',
  rehearsals,
  reportTime,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})
```
**Also add to the parallel `created: Service` object** built at lines 478-487 for the `ensureShareLink(created, ...)` call — a second, sibling construction of the just-created service that must carry the same fields.

**`updateService`** (lines 603-621) needs no change — it's a generic `Record<string, unknown>` patch already calling `maybeRefreshShareLink` unconditionally; the "Times" editor UI just calls `updateService(id, { rehearsals, reportTime })` like any other field.

---

### `src/stores/services.ts` — `buildServiceSnapshot` (service, transform)

**Analog:** same function's existing conditional-spread of `stageLayout` (~line 205), which omits empty arrays rather than writing `[]`.

**Pattern to copy** (`ServiceSnapshot` interface lines 90-114, function 123-207):
```typescript
export interface ServiceSnapshot {
  date: string
  rehearsals?: { id: string; date: string; time: string }[]
  reportTime?: string
  name: string
  // ...unchanged
}

export function buildServiceSnapshot(service: Service): ServiceSnapshot {
  const datedRehearsals = (service.rehearsals ?? []).filter((r) => r.date !== '')
  return {
    date: service.date,
    ...(datedRehearsals.length > 0 ? { rehearsals: sortRehearsals(datedRehearsals) } : {}),
    ...(service.reportTime ? { reportTime: service.reportTime } : {}),
    name: service.name,
    // ...unchanged
  }
}
```
Not PII — no strip needed in `toPublicServiceSnapshot` (lines 237-251); treat like `date`, not like `notes`.

---

### `src/utils/rehearseAccess.ts` — `buildRehearseAccess` (utility, transform)

**Analog:** same function's `serviceDate: service.date` field (line 63/288) — identical treatment.

**Pattern to copy** (`RehearseAccessDoc` interface lines 55-107, function 131-278):
```typescript
export interface RehearseAccessDoc {
  serviceId: string
  orgId: string
  orgName?: string
  serviceDate: string
  rehearsals?: { id: string; date: string; time: string }[]
  reportTime?: string
  title: string
  // ...unchanged
}

export function buildRehearseAccess(service: Service, ...): RehearseAccessDoc {
  const datedRehearsals = (service.rehearsals ?? []).filter((r) => r.date !== '')
  return {
    serviceId: service.id,
    orgId,
    ...(orgName ? { orgName } : {}),
    serviceDate: service.date,
    ...(datedRehearsals.length > 0 ? { rehearsals: sortRehearsals(datedRehearsals) } : {}),
    ...(service.reportTime ? { reportTime: service.reportTime } : {}),
    title: service.name,
    // ...unchanged
  }
}
```
`rehearseAccess.ts` is store-free/pure — import `sortRehearsals` from `src/utils/rehearsalTimes.ts`, not a store.

**Load-bearing:** edit `Service` type + BOTH builders as one atomic task — the single most likely omission per RESEARCH.md Pitfall 2. Write the projection test (mirrors `services.sharePii.test.ts`'s scaffold) asserting both builders surface the fields, and that an undated rehearsal is filtered.

---

### `src/views/SettingsView.vue` — "Rehearsal & Report Defaults" section (component, request-response)

**Analog:** the existing "Messaging" section (`SettingsView.vue:424-1217`) — h2 label, form inputs, a save handler calling `updateOrgSettings` + local mirror-write + "Saved!"/error feedback.

**Structural pattern to copy:**
```vue
<h2 class="text-sm font-semibold text-gray-300 mb-3">Messaging</h2>
...
<input type="checkbox" v-model="lockNotifyDefaultInput" @change="onToggleLockNotifyDefault" />
...
<p v-if="reminderDaysBeforeSavedFeedback" class="text-green-400 text-sm mt-2">Saved!</p>
```

**Save handler pattern to copy** (`SettingsView.vue:1152-1168`):
```typescript
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
    rehearsalTimeDefaultsInput.value = previous // revert on failure
  }
}
```
Dot-path write via `updateOrgSettings` (`src/stores/auth.ts:447-469`) — call exactly as the Messaging section does; no store changes needed.

---

### `src/views/ServiceEditorView.vue` — "Times" subsection (component, request-response)

**Analog:** same file's existing date-picker header block (lines 37-92) and `canEditService` gate (line 2203).

**Pattern to copy:** the date control is a hidden `<input type="date">` triggered via `showPicker()`, bound to `localService.value.date`, writing through `onDateChange` → debounced autosave → `updateService`. Mirror this exactly for `localService.value.rehearsals`/`.reportTime`:
- `<input type="date">` + `<input type="time">` per rehearsal row (add/edit/remove list).
- Single `<input type="time">` for `reportTime`.
- Same `canEditService` computed already gating the date picker (`v-else` branch, line 52) — reuse verbatim, no new gating logic.
- Same debounced-autosave → `updateService(id, { rehearsals, reportTime })` path — no new save mechanism.

---

### `src/components/ServiceCard.vue` (component, display transform)

**Analog:** same file's own `parsedDate`/`formattedDate` computed (lines 123-140) — this file is itself the analog for the new `rehearsalTimes.ts` util, and now also the site that must import and use it.

**Excerpt** (lines 123-140):
```typescript
const parsedDate = computed(() => {
  const [year, month, day] = props.service.date.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day)
})

const formattedDate = computed(() => {
  const d = parsedDate.value
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  if (d.getFullYear() !== new Date().getFullYear()) options.year = 'numeric'
  return d.toLocaleDateString('en-US', options)
})
```
Add a sibling computed reading `sortRehearsals(props.service.rehearsals ?? [])` and `formatWallClockTime(props.service.reportTime)`, rendered next to `formattedDate`.

---

### `src/components/ScheduleServiceCard.vue` (component, display transform)

**Analog:** same file's own `parsedDate` computed (lines 117-126) — also the file carrying the TODO this phase closes (line ~40-41, per CONTEXT.md).

**Excerpt** (lines 103-126):
```typescript
const props = defineProps<{
  serviceId: string
  title: string
  serviceDate: string
  songs: RehearseSong[]
  roles: string[]
  isNextUp: boolean
  isPast: boolean
}>()

// Local-midnight parse, matching ServiceCard.vue's own ymd-string convention
const parsedDate = computed(() => {
  const [y, m, d] = props.serviceDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d)
})
```
**Add two new optional props**: `reportTime?: string`, `rehearsals?: { id: string; date: string; time: string }[]`. Render via the new `rehearsalTimes.ts` helpers, following the same computed style as `monthLabel`/`dayNumber`/`weekdayLabel` above.

---

### `src/views/MyScheduleView.vue` (3 `<ScheduleServiceCard>` call sites) (component, request-response)

**Analog:** the file's own existing prop-passing at the other call sites (lines 59-73, 83-97, 124-134 — This Week / Later This Month / Past).

**Pattern:** add `:report-time="doc.reportTime"` and `:rehearsals="doc.rehearsals"` to **all 3** call sites — `doc` is a `MyScheduleDoc = RehearseAccessDoc & { orgId }` (`src/stores/mySchedule.ts:23`), which already carries the fields once `buildRehearseAccess` is updated. Missing even one of the 3 leaves that bucket silently blank (RESEARCH.md Pitfall 4) — grep for `<ScheduleServiceCard` before considering the task done.

---

### `src/views/ShareView.vue` (component, display transform)

**Analog:** same file's `formattedDate` computed off `serviceSnapshot.value.date` (lines 181-194).

**Pattern:** add a sibling computed reading `serviceSnapshot.value.rehearsals`/`.reportTime` (already sorted/filtered by `buildServiceSnapshot`) through the new `formatWallClockTime` helper, rendered next to `formattedDate`. `serviceSnapshot` is the frozen `ServiceSnapshot` fed by `buildServiceSnapshot` — no store read here, purely projection-fed.

---

### `src/views/VolunteerServiceView.vue` (component, display transform)

**Analog:** same file's `formattedDate` off `doc.serviceDate` (lines 46, 218-222), fed by `useVolunteerServiceDoc` → the same `RehearseAccessDoc`.

**Pattern:** identical to `ScheduleServiceCard.vue`/`ShareView.vue` — add computed(s) reading `doc.rehearsals`/`.reportTime` through the shared formatter.

---

### Test files (NEW)

**Analog for all three:** `src/stores/__tests__/services.sharePii.test.ts` (full file read, lines 1-60+ shown below) — this is the mock scaffold and assertion style to copy exactly.

**Mock scaffold to copy verbatim** (lines 1-54):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Service } from '@/types/service'

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(), doc: vi.fn(), onSnapshot: vi.fn(), addDoc: vi.fn(),
  updateDoc: vi.fn(), deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(),
  setDoc: vi.fn(), deleteField: vi.fn(), query: vi.fn(), orderBy: vi.fn(),
  where: vi.fn(), limit: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(),
  Timestamp: { fromMillis: vi.fn() },
}))

vi.mock('@/firebase', () => ({ auth: {}, db: {} }))

vi.mock('@/stores/songs', () => ({ useSongStore: vi.fn(() => ({ songs: [] })) }))
vi.mock('@/stores/roster', () => ({ useRosterStore: vi.fn(() => ({ people: [], roles: [] })) }))
vi.mock('@/stores/quarters', () => ({ useQuartersStore: vi.fn(() => ({ quarters: [] })) }))

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'service-1',
    // ...defaults, then overrides
  }
}
```
For `services.rehearsalProjection.test.ts`, additionally `await import('../services')` (or `../rehearseAccess`) inside each test/`beforeEach`, per this file's existing pattern, then assert `buildServiceSnapshot(service).rehearsals`/`.reportTime` and `buildRehearseAccess(service, ...).rehearsals`/`.reportTime` both surface a known value, and that a `date: ''` rehearsal is filtered.

For `services.rehearsalDefaults.test.ts`, use the same scaffold plus a call to `updateOrgSettings`-equivalent state mutation, asserting an already-created service's stored `rehearsals`/`reportTime` are unchanged (copy-not-live-bind).

For `rehearsalTimes.test.ts` (pure util, no store), no mock scaffold needed — plain `describe`/`it` against `sortRehearsals`/`formatWallClockTime`, including a timezone-stability assertion per RESEARCH.md Pitfall 3.

## Shared Patterns

### Additive-optional-field style on `Service`/`OrgSettings`
**Source:** `src/types/service.ts` (`stageLayout?`/`messaging?`), `src/types/organization.ts` (`bibleVersion`/`timezone`)
**Apply to:** `rehearsals?`/`reportTime?` on `Service`; `rehearsalTimeDefaults`/`reportTimeDefault` on `OrgSettings`
JSDoc-with-rationale comment above each new field explaining why it's optional/absent-means-no-migration.

### Copy-not-live-bind at creation
**Source:** `src/stores/services.ts:452` (`authStore.settings.defaultServiceTemplate` read inside `createService`)
**Apply to:** `createService`'s new `rehearsals`/`reportTime` synthesis — read org defaults once at creation, never at display time.

### Dual hand-maintained projection builders
**Source:** `src/stores/services.ts` (`buildServiceSnapshot`) + `src/utils/rehearseAccess.ts` (`buildRehearseAccess`)
**Apply to:** every new `Service` field that must reach ShareView/My Schedule/VolunteerServiceView — treat both builders as one atomic edit, verified by a projection test mirroring `services.sharePii.test.ts`.

### Settings-defaults save-handler shape
**Source:** `src/views/SettingsView.vue:1152-1168` (Messaging section)
**Apply to:** the new "Rehearsal & Report Defaults" section — `updateOrgSettings` dot-path write + local revert-on-failure + timed "Saved!" feedback.

### Debounced-autosave editor field
**Source:** `src/views/ServiceEditorView.vue:37-92` (date picker) + `canEditService` gate at line 2203
**Apply to:** the new "Times" subsection's rehearsal-row add/edit/remove inputs and report-time input.

### Shared date-parse / time-format helpers (new, to stop future duplication)
**Source:** `src/components/ServiceCard.vue:123-126` (date-parse idiom, previously duplicated 5x) + `src/composables/useRunTimers.ts:47-50` (`formatClock` time-format idiom)
**Apply to:** `src/utils/rehearsalTimes.ts` — every display site should import `sortRehearsals`/`formatWallClockTime` from here rather than hand-rolling a 6th copy.

## No Analog Found

None — every file in scope has a direct, same-role-and-flow analog already in the codebase (this phase is pure additive-schema work with established precedents for every piece, per RESEARCH.md's Summary).

## Metadata

**Analog search scope:** `src/types/`, `src/stores/`, `src/utils/`, `src/views/`, `src/components/`, `src/composables/`, `src/stores/__tests__/`
**Files scanned:** 11 target files + 5 analog files read/confirmed this session (`ServiceCard.vue`, `ScheduleServiceCard.vue`, `useRunTimers.ts`, `services.sharePii.test.ts`, plus RESEARCH.md's already-verified reads of `service.ts`, `organization.ts`, `auth.ts`, `services.ts`, `rehearseAccess.ts`, `SettingsView.vue`, `ServiceEditorView.vue`, `ShareView.vue`, `DashboardView.vue`, `MyScheduleView.vue`, `VolunteerServiceView.vue`, `mySchedule.ts`, `firestore.rules`)
**Pattern extraction date:** 2026-09-09
