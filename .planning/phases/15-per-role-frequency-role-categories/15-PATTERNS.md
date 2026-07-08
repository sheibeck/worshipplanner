# Phase 15: Per-Role Frequency & Role-Category Co-occurrence Rules - Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 12 (all modified-in-place; no new files this phase)
**Analogs found:** 12 / 12 (every file this phase touches is its own best analog — this is a same-file evolution phase, not a new-file phase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `src/types/roster.ts` | model (type definitions) | CRUD (schema shape) | itself — `PersonQuarterData.frequencyTier?` optional-with-default field (line 46-47) is the in-file precedent for `Person.frequencyTargetN` → per-role map | exact (self-precedent) |
| `src/utils/scheduler.ts` | service (pure business logic) | transform (batch, deterministic) | itself — `tierOf()` (line 37) tolerant-default pattern + `eligible()` predicate (line 102-110) is the insertion point for the new group-check predicate | exact (self-precedent) |
| `src/utils/__tests__/scheduler.test.ts` | test | transform | itself — `makePerson`/`makePQD`/`makeResolver` factory pattern (lines 6-35) | exact (self-precedent) |
| `src/stores/roster.ts` | store (Pinia + Firestore) | CRUD + event-driven (onSnapshot) | `src/stores/auth.ts` lines 109-124 (opportunistic patch-on-read migration) | role-match (different store, same migration shape) |
| `src/stores/quarters.ts` | store (Pinia + Firestore) | CRUD (dot-path scoped writes) | itself — `setPersonAvailability` (line 168-204) dot-path write pattern | exact (self-precedent) |
| `src/views/RosterView.vue` | component (form/view) | request-response (form submit → store write) | itself — Edit Volunteer form single frequency `<select>` (lines 325-333) + roles checklist (lines 334-348) | exact (self-precedent) |
| `src/components/AvailabilityDrawer.vue` | component (drawer/form) | request-response | itself — `FREQ_PRESETS`/`draft.frequencyTier` per-quarter tier control (lines 53-86) | exact (self-precedent) |
| `src/components/QuarterGrid.vue` | component (grid/table) | CRUD (manual grid edit) | itself — `cellIsUnfilled`/`cellHasConflict` warning-badge pattern (lines 228-241, 54-66) | exact (self-precedent) |
| `src/components/RolesConfigPanel.vue` | component (config panel) | CRUD | itself — `groupOrder`/`groupLabels`/`groupBadgeClasses` + hardcoded `<option>` group dropdown (lines 81-88, 114-129) | exact (self-precedent) |
| `src/utils/volunteerCsv.ts` | utility (pure parse functions) | transform (CSV row → domain shape) | itself — `frequencyLabelToN`/`nToFrequencyLabel` (lines 41-70) | exact (self-precedent) |
| `src/components/AvailabilityRosterTable.vue` | component (table) | CRUD | itself — `ROLE_CHIP_CLASS`/`STATUS_PILL_CLASS` `Record<RoleGroup,…>` maps + `quarterDataFor` tolerant-default (lines 111-124, 132-147) | exact (self-precedent) |
| `src/stores/__tests__/roster.test.ts` | test | event-driven (mocked onSnapshot) | itself — `snapshotCallbacks`/mocked `firebase/firestore` harness (lines 4-41) | exact (self-precedent) |

**Note on "exact (self-precedent)":** This phase is a data-model evolution of already-shipped Phase 13/14 code, not new-feature scaffolding. Every touched file already contains the shape of pattern it needs to extend (tolerant-optional fields, dot-path writes, `Record<RoleGroup,...>` maps, per-quarter tier controls). The one genuinely cross-file borrow is the migration mechanism (`roster.ts` copying `auth.ts`'s admin→editor precedent) — detailed below.

## Pattern Assignments

### `src/types/roster.ts` (model, CRUD schema)

**Analog:** itself (in-file precedent) — `PersonQuarterData.frequencyTier?: FrequencyTier` (D-04/D-05 Phase 14)

**Current RoleGroup + Role + Person shape** (lines 3-27):
```typescript
export type RoleGroup = 'band' | 'tech' | 'other'

export interface Role {
  id: string
  name: string
  group: RoleGroup
  defaultCount: number
  order: number
}

export interface Person {
  id: string
  name: string
  email: string
  phone: string
  active: boolean
  roles: string[]
  frequencyTargetN: number    // <- becomes per-role map + fallback (D-04)
  pcPersonId: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Existing tolerant-optional-with-default precedent to mirror** (lines 42-50):
```typescript
export interface PersonQuarterData {
  personId: string
  blackoutDates: string[]
  pairedWith: string[]
  /** Quarter-scoped (D-05/A1) — resets each new quarter. Optional; defaults to 'regular' when absent. */
  frequencyTier?: FrequencyTier
  /** Free-text quarter note (D-03/D-07) — never auto-scheduled. Optional; defaults to '' when absent. */
  note?: string
}
```
Apply the identical `field?: T` + comment-documented default convention for:
- `Person.roleFrequencies?: Record<string, number>` (per-role cadence; keep `frequencyTargetN` as the retained fallback/default value, per RESEARCH primary recommendation)
- `PersonQuarterData.roleTiers?: Record<string, FrequencyTier>` (per-role tier; keep `frequencyTier?` as retained fallback)

**DEFAULT_ROLES reseed** (lines 89-98) — extend `RoleGroup` union to add `'vocals'`, reclassify the seeded `vocals` role:
```typescript
export const DEFAULT_ROLES: Array<Omit<Role, 'id'>> = [
  { name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
  { name: 'drums', group: 'band', defaultCount: 1, order: 1 },
  { name: 'vocals', group: 'band', defaultCount: 1, order: 2 },  // <- group: 'vocals' after D-08/D-09
  { name: 'bass', group: 'band', defaultCount: 1, order: 3 },
  { name: 'sound', group: 'tech', defaultCount: 1, order: 4 },
  { name: 'livestream', group: 'tech', defaultCount: 1, order: 5 },
  { name: 'projection', group: 'tech', defaultCount: 1, order: 6 },
  { name: 'scripture reader', group: 'other', defaultCount: 1, order: 7 },
]
```

**UpsertPersonInput** (lines 78-85) needs a matching optional field added (`roleFrequencies?: Record<string, number>`) alongside `frequencyTargetN?`.

---

### `src/utils/scheduler.ts` (service, deterministic transform)

**Analog:** itself — `tierOf()` tolerant-default + `eligible()` filter + `propagatePairing()`

**Tolerant-default pattern to mirror one key level deeper** (line 37):
```typescript
// undefined = pre-migration data (or no PQD entry at all) — treat as 'regular' (D-05)
const tierOf = (personId: string): FrequencyTier => pqdById.get(personId)?.frequencyTier ?? 'regular'
```
D-05 analog: `tierOf(personId, roleId)` should read `pqdById.get(personId)?.roleTiers?.[roleId] ?? pqdById.get(personId)?.frequencyTier ?? 'regular'` (per-role tier, falling back to the legacy per-person tier, falling back to `'regular'`).

**`eligible()` predicate — insertion point for D-12 group check** (lines 98-119):
```typescript
for (const { roleId, count } of rolesForDate) {
  calendar[date]![roleId] ??= []
  while (calendar[date]![roleId]!.length < count) {
    const alreadyInRole = new Set(calendar[date]![roleId])
    const eligible = (tier: FrequencyTier) =>
      people.filter(
        (p) =>
          p.active &&
          p.roles.includes(roleId) &&
          !isBlackedOut(p.id, date) &&
          !alreadyInRole.has(p.id) &&
          tierOf(p.id) === tier,
      )
    // ... regular/fillin pass, scoring, chosen = scored[0].p
    assignToRole(roleId, chosen.id)
    propagatePairing(chosen.id, new Set([chosen.id]))
  }
}
```
The new `roleId`-to-`group` predicate must be added inside `eligible`'s filter (needs the new `roleGroupOf: (roleId: string) => RoleGroup` parameter threaded into `proposeQuarterSchedule`'s signature per RESEARCH Pitfall 1 — `resolveRolesForDate` currently returns `RoleSlotConfig[]` = `{roleId, count}`, no group).

**`propagatePairing` — the CONFIRMED LANDMINE, must apply the SAME predicate** (lines 67-96):
```typescript
const propagatePairing = (personId: string, visited: Set<string>) => {
  for (const partnerId of partnersOf(personId)) {
    if (visited.has(partnerId)) continue
    visited.add(partnerId)
    const alreadyToday = Object.values(calendar[date] ?? {}).some((ids) => ids.includes(partnerId))
    if (alreadyToday) continue
    if (isBlackedOut(partnerId, date)) { pairingConflicts.push(...); continue }
    if (tierOf(partnerId) === 'out') { pairingConflicts.push(...); continue }
    const partner = people.find((p) => p.id === partnerId)
    if (!partner) continue
    // Own roles only (D-09) — prefer a role with remaining template capacity, else overflow first eligible role
    const eligibleRoles = rolesForDate.filter((r) => partner.roles.includes(r.roleId))
    const withCapacity = eligibleRoles.find((r) => (calendar[date]![r.roleId]?.length ?? 0) < r.count)
    const target = withCapacity ?? eligibleRoles[0]
    if (!target) { pairingConflicts.push(...); continue }
    assignToRole(target.roleId, partnerId)
    propagatePairing(partnerId, visited)
  }
}
```
**This is a second, independent role-selection path.** It filters `eligibleRoles` by `partner.roles.includes(r.roleId)` only — zero group-awareness. D-12's group-exclusivity/cardinality check MUST be extracted into a single shared helper (e.g. `isGroupCompatible(personId, roleId, date)`) and applied to BOTH the `eligible()` filter predicate above AND `propagatePairing`'s `eligibleRoles` filter (or `withCapacity`/`target` selection). Skipping this second application silently breaks D-11's "auto-propose never creates an illegal combo" guarantee for anyone with a pairing — confirmed, not hypothetical (RESEARCH Pitfall 2).

**Deficit-scoring caution** (line 127) — currently a single aggregate `served` Map<personId, number>:
```typescript
deficit:
  tierOf(p.id) === 'regular'
    ? (dateIndex + 1) / p.frequencyTargetN - (served.get(p.id) ?? 0)
    : 0,
```
Because frequency becomes per-(person, role), this mixes one role's cadence against a cross-role total served count. RESEARCH recommends tracking `served` per (person, role) internally while keeping the external `ProposeResult.servedCounts: Record<personId, number>` shape unchanged (nothing in the codebase reads it externally beyond scheduler.ts/its tests).

**Signature change required:**
```typescript
export function proposeQuarterSchedule(
  people: Person[],
  serviceDates: string[],
  resolveRolesForDate: (date: string) => RoleSlotConfig[],
  personQuarterData: PersonQuarterData[],
  existingCalendar?: QuarterCalendar,
  // NEW param — RESEARCH Pitfall 1: caller (quarters.ts) builds this from rosterStore.roles
  roleGroupOf?: (roleId: string) => RoleGroup,
): ProposeResult
```

---

### `src/utils/__tests__/scheduler.test.ts` (test, deterministic factory pattern)

**Analog:** itself — `makePerson`/`makePQD`/`makeResolver` (lines 6-35)

**Factory pattern to extend** (lines 6-19):
```typescript
function makePerson(overrides: Partial<Person> & { id: string }): Person {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    email: overrides.email ?? `${overrides.id}@example.com`,
    phone: overrides.phone ?? '',
    active: overrides.active ?? true,
    roles: overrides.roles ?? [],
    frequencyTargetN: overrides.frequencyTargetN ?? 1,
    pcPersonId: overrides.pcPersonId ?? null,
    createdAt: overrides.createdAt ?? ({} as any),
    updatedAt: overrides.updatedAt ?? ({} as any),
  }
}

function makePQD(overrides: Partial<PersonQuarterData> & { personId: string }): PersonQuarterData {
  return {
    personId: overrides.personId,
    blackoutDates: overrides.blackoutDates ?? [],
    pairedWith: overrides.pairedWith ?? [],
    ...(overrides.frequencyTier !== undefined ? { frequencyTier: overrides.frequencyTier } : {}),
    ...(overrides.note !== undefined ? { note: overrides.note } : {}),
  }
}

function makeResolver(defaultRoles: RoleSlotConfig[], overrides?: Record<string, RoleSlotConfig[]>) {
  return (date: string): RoleSlotConfig[] => overrides?.[date] ?? defaultRoles
}
```
Extend `makePerson` with `roleFrequencies` default, `makePQD` with `roleTiers` default (same conditional-spread pattern as `frequencyTier`), and add a `makeRoleGroupOf(map: Record<string,RoleGroup>)` helper mirroring `makeResolver`'s shape for the new `roleGroupOf` scheduler param.

**Required NEW test cases (Wave 0 gap, RESEARCH Validation Architecture):**
- TECH exclusivity: a person already on a TECH role that date is ineligible for any BAND/VOCALS/OTHER role that date, and vice versa.
- Cardinality cap: a person already holding 1 BAND role that date is ineligible for a second BAND role; same for VOCALS. OTHER uncapped.
- **The Pitfall 2 case — a required Wave 0/1 test:** two paired people where the pulled-in partner's only role-eligible option would violate group exclusivity/cap — assert `propagatePairing` respects the same predicate (either produces a `pairingConflicts` entry or picks a compliant role, never an illegal one).

Existing test style to mirror exactly (blackout/pairing/tier test shape, lines 122-165, 242-277):
```typescript
it('pairing: when person A is scheduled, paired partner B is also assigned that date in one of B\'s own eligible roles (D-09)', () => {
  const people = [
    makePerson({ id: 'a', roles: ['guitar'], frequencyTargetN: 1 }),
    makePerson({ id: 'b', roles: ['vocals'], frequencyTargetN: 1 }),
  ]
  const dates = ['2026-01-04']
  const resolver = makeResolver([{ roleId: 'guitar', count: 1 }, { roleId: 'vocals', count: 1 }])
  const pqd = [
    makePQD({ personId: 'a', pairedWith: ['b'] }),
    makePQD({ personId: 'b', pairedWith: ['a'] }),
  ]
  const result = proposeQuarterSchedule(people, dates, resolver, pqd)
  expect(result.calendar['2026-01-04']?.['guitar']).toContain('a')
  expect(result.calendar['2026-01-04']?.['vocals']).toContain('b')
})
```

---

### `src/stores/roster.ts` (store, CRUD + migration)

**Analog:** `src/stores/auth.ts` lines 109-124 (opportunistic patch-on-read migration — the ONLY migration precedent in this codebase)

**Migration pattern to copy exactly:**
```typescript
// Source: src/stores/auth.ts lines 109-124 (existing code)
memberUnsub = onSnapshot(
  doc(db, 'organizations', ids[0]!, 'members', uid),
  async (snap) => {
    if (!snap.exists()) { userRole.value = null; return }
    const data = snap.data()
    const role = data.role as string

    // One-time migration: admin → editor + backfill missing fields
    const patch: Record<string, unknown> = {}
    if (role === 'admin') patch.role = 'editor'
    if (!data.email && user.value?.email) {
      patch.email = user.value!.email ?? ''
      patch.displayName = user.value!.displayName ?? ''
    }
    if (Object.keys(patch).length > 0) {
      await updateDoc(snap.ref, patch)
      if (role === 'admin') return // next snapshot sets userRole
    }
    userRole.value = (role === 'admin' ? 'editor' : role) as 'editor' | 'viewer'
  },
)
```

**Target insertion point — `roster.ts`'s people `onSnapshot`** (lines 55-58):
```typescript
unsubscribePeopleFn = onSnapshot(peopleQuery, (snap) => {
  people.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Person)
  isLoading.value = false
})
```
D-03 migration analog (per-doc, guarded, idempotent): for each snapshot doc with no `roleFrequencies` field at all, `updateDoc` a patch: `roleFrequencies: Object.fromEntries(person.roles.map(r => [r, person.frequencyTargetN]))`. Guard so the write only fires when the field is truly absent (idempotent — matches `if (Object.keys(patch).length > 0)` guard above).

**Target insertion point — `roster.ts`'s roles `onSnapshot`** (lines 65-67):
```typescript
unsubscribeRolesFn = onSnapshot(rolesQuery, (snap) => {
  roles.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Role)
})
```
D-09 migration analog: for each snapshot doc where `role.name.toLowerCase() === 'vocals' && role.group === 'band'`, `updateDoc` a patch `{ group: 'vocals' }`.

**Existing dot-path/merge write convention to mirror for `upsertPeople`** (lines 161-166 — roles are MERGED, never replaced):
```typescript
if (incoming.roles !== undefined) {
  updateData.roles = Array.from(new Set([...(existing.roles ?? []), ...incoming.roles]))
}
if (incoming.frequencyTargetN !== undefined) updateData.frequencyTargetN = incoming.frequencyTargetN
```
CSV import degrade-gracefully analog (Pitfall 4): when `incoming.roleFrequencies` isn't supplied by the caller, apply the row's single `frequencyTargetN` to every role in `incoming.roles` as the initial per-role value — same shape as D-03's migration, applied at import time instead of read time.

---

### `src/stores/quarters.ts` (store, dot-path scoped writes)

**Analog:** itself — `setPersonAvailability` (lines 168-204)

**Dot-path write pattern to extend for per-role tier** (lines 179-182):
```typescript
const updates: Record<string, unknown> = {
  [`personQuarterData.${personId}`]: { personId, ...data },
  updatedAt: serverTimestamp(),
}
```
The `data` object passed in (`{ blackoutDates, pairedWith, frequencyTier, note }`) needs a `roleTiers: Record<string, FrequencyTier>` field added — written wholesale within the already-scoped `personQuarterData.${personId}` dot-path (still scoped per-person, just a richer value at that path — consistent with T-13-09-02/T-14-03-01 concurrency safety, since other people's entries are untouched).

**`buildResolveRolesForDate` — needs to also emit the roleId→group map for scheduler.ts's new param** (lines 206-215):
```typescript
function buildResolveRolesForDate(
  quarter: Quarter,
  roles: Role[],
): (date: string) => RoleSlotConfig[] {
  const defaultConfig = roles
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((r) => ({ roleId: r.id, count: r.defaultCount }))
  return (date: string) => quarter.roleOverridesByDate[date] ?? defaultConfig
}
```
Add a sibling `buildRoleGroupOf(roles: Role[]): (roleId: string) => RoleGroup` (a simple `Map` lookup, default `'other'` for unknown roleIds per RESEARCH Pitfall 1's suggested safe default), called from `generateProposal` (lines 217-236) and passed as the new final arg to `proposeQuarterSchedule`.

---

### `src/views/RosterView.vue` (component, Edit Volunteer form)

**Analog:** itself — single frequency `<select>` (lines 325-333) + roles checklist (lines 334-348)

**Current single-select to replace with per-role rows (D-01):**
```html
<div>
  <label class="block text-xs font-medium text-gray-400 mb-1">Serve frequency</label>
  <select
    v-model.number="formFrequencyN"
    class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
  >
    <option v-for="n in [1, 2, 4]" :key="n" :value="n">{{ nToFrequencyLabel(n) }}</option>
  </select>
</div>
<div>
  <label class="block text-xs font-medium text-gray-400 mb-2">Roles</label>
  <div class="flex flex-wrap gap-x-4 gap-y-2">
    <label v-for="role in rosterStore.rolesSorted" :key="role.id" class="inline-flex items-center gap-1.5 text-sm text-gray-300">
      <input type="checkbox" :value="role.id" v-model="formRoles" class="..." />
      {{ role.name }}
    </label>
  </div>
</div>
```
D-01 replaces this with: iterate `formRoles` (checked roles) and render one `<select>` row per held role — reuse the exact `<select>`+`nToFrequencyLabel` markup/options above, keyed by `roleId`, backed by a `formRoleFrequencies: Record<string, number>` reactive object (default `4` per D-02, mirrors `formFrequencyN.value = 4` default at line 419/427).

**Save handler to extend** (lines 447-461):
```typescript
async function onSaveVolunteer() {
  const input = {
    name: formName.value.trim(),
    email: formEmail.value.trim(),
    phone: formPhone.value.trim(),
    roles: formRoles.value,
    frequencyTargetN: formFrequencyN.value,
  }
  if (editingPersonId.value) {
    await rosterStore.updatePerson(editingPersonId.value, input)
  } else {
    await rosterStore.addPerson(input)
  }
  closeForm()
}
```
Add `roleFrequencies: formRoleFrequencies.value` to `input`.

**`onEditPerson` load — D-03 one-time migration surfaces here too** (lines 432-440):
```typescript
function onEditPerson(person: Person) {
  editingPersonId.value = person.id
  formName.value = person.name
  formEmail.value = person.email
  formPhone.value = person.phone
  formFrequencyN.value = person.frequencyTargetN
  formRoles.value = [...person.roles]
  formOpen.value = true
}
```
When populating `formRoleFrequencies` from `person.roleFrequencies`, default any held role missing an entry to `person.frequencyTargetN` (not the hardcoded `4`) — this is the D-03 "copy existing frequencyTargetN onto currently-held roles" migration expressed at read time in the UI, complementing (not replacing) the store-level patch-on-read in `roster.ts`.

**`Record<RoleGroup,...>` exhaustive map that needs `'vocals'` added** (lines 474-478):
```typescript
const groupBadgeClasses: Record<RoleGroup, string> = {
  band: 'bg-blue-900/50 text-blue-300 border-blue-800',
  tech: 'bg-purple-900/50 text-purple-300 border-purple-800',
  other: 'bg-gray-800 text-gray-400 border-gray-700',
}
```
Add `vocals: '<distinct static Tailwind color>'` — pick a color not already used by band/tech/other (e.g. `bg-pink-900/50 text-pink-300 border-pink-800`), following the static-literal-class convention (never string interpolation — Tailwind v4 purge safety).

**`frequency` sort key needs per-role reconciliation** (line 525):
```typescript
} else {
  cmp = a.frequencyTargetN - b.frequencyTargetN
}
```
Planner's discretion on exact tie-break (e.g. average/min across `roleFrequencies`, or keep sorting by the retained `frequencyTargetN` fallback) — flag as an explicit decision point, not silently left as-is if `frequencyTargetN` becomes purely a fallback.

---

### `src/components/AvailabilityDrawer.vue` (component, per-quarter tier control)

**Analog:** itself — `FREQ_PRESETS`/`draft.frequencyTier` (lines 53-86, 266-297, 349-374)

**Current single-tier-control section to replace with one row per held role (D-06):**
```html
<section>
  <h3 class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Serve frequency ...</h3>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="preset in FREQ_PRESETS"
      :key="preset.key"
      ...
      :data-active="activePresetKey === preset.key"
      @click="selectPreset(preset.key)"
    >{{ preset.label }}</button>
  </div>
  ...
</section>
```
```typescript
const FREQ_PRESETS: Array<{ key: FreqPresetKey; label: string; n: number; tier: FrequencyTier }> = [
  { key: 'weekly', label: 'Every week', n: 1, tier: 'regular' },
  { key: 'biweek', label: 'Twice a month', n: 2, tier: 'regular' },
  { key: 'monthly', label: 'Monthly', n: 4, tier: 'regular' },
  { key: 'fillin', label: 'As-needed (fill-in)', n: 0, tier: 'fillin' },
  { key: 'out', label: 'Out this quarter', n: 0, tier: 'out' },
]
```
D-06 wraps this exact preset-button block in a `v-for` over the person's held roles, backed by a `draft.roleTiers: Record<string, FrequencyTier>` reactive field (parallel structure to `draft.frequencyTier`, same default `'regular'`).

**`loadDraft`/`onSave` to extend** (lines 322-339, 492-510) — mirrors the exact standing-vs-quarter split already coded here:
```typescript
function loadDraft(personId: string) {
  const person = rosterStore.people.find((p) => p.id === personId)
  const pqd = quarter.value?.personQuarterData[personId]
  draft.frequencyTargetN = person?.frequencyTargetN ?? 4
  draft.frequencyTier = pqd?.frequencyTier ?? 'regular'
  ...
}
async function onSave() {
  await quartersStore.setPersonAvailability(props.quarterId, props.personId, {
    blackoutDates: draft.blackoutDates,
    pairedWith: draft.pairedWith,
    frequencyTier: draft.frequencyTier,
    note: draft.note,
  })
  if (draft.frequencyTargetN !== loadedFrequencyTargetN.value) {
    await rosterStore.updatePerson(props.personId, { frequencyTargetN: draft.frequencyTargetN })
  }
  emit('close')
}
```
Extend `loadDraft` to populate `draft.roleTiers` from `pqd?.roleTiers` (default `'regular'` per role) and `onSave`'s `setPersonAvailability` call to include `roleTiers: draft.roleTiers`.

---

### `src/components/QuarterGrid.vue` (component, manual grid warning surface)

**Analog:** itself — `cellIsUnfilled`/`cellHasConflict` (lines 228-241) + warning badge markup (lines 54-66)

**Existing report-don't-force warning pattern to mirror exactly (D-11):**
```typescript
function isInUnfilledList(date: string, roleId: string): boolean {
  return props.lastProposeResult?.unfilled.some((u) => u.date === date && u.roleId === roleId) ?? false
}
function cellIsUnfilled(date: string, roleId: string): boolean {
  return cellPeople(date, roleId).length < effectiveCountFor(date, roleId) || isInUnfilledList(date, roleId)
}
function cellHasConflict(date: string, roleId: string): boolean {
  const conflicts = props.lastProposeResult?.pairingConflicts.filter((c) => c.date === date) ?? []
  if (conflicts.length === 0) return false
  const assigned = cellPeople(date, roleId)
  return assigned.some((id) => conflicts.some((c) => c.personId === id || c.partnerId === id))
}
```
```html
<span v-if="cellIsUnfilled(date, role.id)" class="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/50 text-red-400">Unfilled</span>
<span v-if="cellHasConflict(date, role.id)" class="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/50 text-amber-300">Pairing conflict</span>
```
D-11 adds a third badge, e.g. `cellHasGroupViolation(date, roleId)` — a NEW live-computed function reading `props.quarter.calendar` + `props.roles` directly (does NOT depend on `ProposeResult`, per RESEARCH's architecture diagram — this must work for pre-existing/historical calendars too, not just fresh proposals). For each assigned personId in the cell, check whether that person's OTHER same-date assignments (across all roles/cells that date) violate TECH-exclusivity or the 1-BAND/1-VOCALS cap; render a third `<span>` styled distinctly (e.g. `bg-orange-900/40 border-orange-700/50 text-orange-300`, a color not already used by Unfilled/red or Pairing-conflict/amber).

**`Record<RoleGroup,...>` + `GROUP_ORDER` needing `'vocals'`** (lines 198-204):
```typescript
const groupHeaderBg: Record<RoleGroup, string> = {
  band: 'bg-blue-900/50',
  tech: 'bg-purple-900/50',
  other: 'bg-gray-800',
} as const
const GROUP_ORDER: RoleGroup[] = ['band', 'tech', 'other']
```
Add `vocals: 'bg-pink-900/50'` (or whichever color chosen for consistency with RosterView.vue's badge) and insert `'vocals'` into `GROUP_ORDER` at the desired display position (likely right after `'band'`, per the user's "1 instrument + vocals" mental model in CONTEXT.md Specific Ideas).

**Existing group-independent eligibility helper to extend for the warning check** (lines 253-279, `availableUnassigned`) — this is where a shared `isGroupCompatible`-style helper (mirroring scheduler.ts's) could also be reused/duplicated for the live warning computation, since QuarterGrid.vue cannot import scheduler.ts's internal closures (they're not exported) — the planner should decide whether to export a standalone pure helper from scheduler.ts for both consumers, or keep two small independent implementations (Vue component vs pure scheduler function) given they check the same rule but from different data shapes (`Quarter.calendar` vs the scheduler's in-progress `calendar` build).

---

### `src/components/RolesConfigPanel.vue` (component, roles config UI)

**Analog:** itself — `groupOrder`/`groupLabels`/`groupBadgeClasses` + hardcoded `<select>` `<option>`s (D-09 re-classification UI)

**Exhaustive Record maps + hardcoded option list needing `'vocals'`** (lines 114-129, 81-88):
```typescript
const groupOrder: RoleGroup[] = ['band', 'tech', 'other']
const groupLabels: Record<RoleGroup, string> = { band: 'Band', tech: 'Tech', other: 'Other' }
const groupBadgeClasses: Record<RoleGroup, string> = {
  band: 'bg-blue-900/50 text-blue-300 border-blue-800',
  tech: 'bg-purple-900/50 text-purple-300 border-purple-800',
  other: 'bg-gray-800 text-gray-400 border-gray-700',
}
```
```html
<select v-model="newRoleGroup" class="...">
  <option value="band">Band</option>
  <option value="tech">Tech</option>
  <option value="other">Other</option>
</select>
```
Add `vocals: 'Vocals'` to `groupLabels`, `vocals: '<consistent color>'` to `groupBadgeClasses`, `'vocals'` to `groupOrder` (position it near `'band'` per the co-occurrence mental model), and a fourth `<option value="vocals">Vocals</option>`. This is also THE UI where a leader re-classifies any role's group post-migration (D-09) — no new mechanism needed, `updateRole` (roster.ts lines 235-241, already wired via `onSaveRole` line 160-167) already supports changing `group` on any existing role.

**`groupedRoles` computed to extend** (lines 125-129):
```typescript
const groupedRoles = computed(() => ({
  band: rosterStore.roles.filter((r) => r.group === 'band'),
  tech: rosterStore.roles.filter((r) => r.group === 'tech'),
  other: rosterStore.roles.filter((r) => r.group === 'other'),
}))
```
Add `vocals: rosterStore.roles.filter((r) => r.group === 'vocals')`.

---

### `src/utils/volunteerCsv.ts` (utility, pure CSV parse)

**Analog:** itself — `frequencyLabelToN`/`nToFrequencyLabel` (lines 41-70), reused unchanged

**No CSV schema change (Pitfall 4 — confirmed by CONTEXT.md's "degrade gracefully" allowance).** `parseVolunteerCsvRow` (lines 106-140) keeps its single `Frequency` column → `frequencyTargetN` mapping exactly as-is:
```typescript
const frequencyRaw = row['Frequency']?.trim() ?? ''
const frequencyTargetN = frequencyLabelToN(frequencyRaw)
```
The per-role application (`frequencyTargetN` applied to every role in that row's `rolesRaw`) happens at the CALLER layer (`VolunteerCsvImportModal.vue` → `rosterStore.upsertPeople`/`applyCsvToQuarter`), not inside this pure-parse module. `frequencyLabelToN`/`nToFrequencyLabel` are reused UNCHANGED for each new per-role `<select>` in `RosterView.vue`/`AvailabilityDrawer.vue` (same function, called once per role instead of once per person).

---

### `src/components/AvailabilityRosterTable.vue` (component, status table)

**Analog:** itself — `ROLE_CHIP_CLASS`/`STATUS_PILL_CLASS`/`STATUS_LABEL` `Record<RoleGroup|FrequencyTier,...>` maps + `quarterDataFor` tolerant-default

**`Record<RoleGroup,...>` needing `'vocals'`** (lines 111-115):
```typescript
const ROLE_CHIP_CLASS: Record<RoleGroup, string> = {
  band: 'text-blue-300 bg-blue-900/40 border border-blue-700/50',
  tech: 'text-purple-300 bg-purple-900/40 border border-purple-700/50',
  other: 'text-gray-300 bg-gray-800 border border-gray-700',
}
```
Add `vocals: '<consistent color>'`.

**Tolerant-default read pattern to mirror for per-role tier lookups** (lines 132-147):
```typescript
function quarterDataFor(personId: string): {
  blackoutDates: string[]
  pairedWith: string[]
  frequencyTier: FrequencyTier
  note: string
} {
  const pqd = props.quarter?.personQuarterData[personId]
  return {
    blackoutDates: pqd?.blackoutDates ?? [],
    pairedWith: pqd?.pairedWith ?? [],
    frequencyTier: pqd?.frequencyTier ?? 'regular',
    note: pqd?.note ?? '',
  }
}
```
This table currently displays ONE aggregate status/frequency badge per person (`freqBadge`, `statusLabel`, lines 183-208). Since tier/frequency become per-role, the planner must decide whether this summary table shows (a) a single "worst-case" or "primary role" status, or (b) per-role chips like `RosterView.vue`'s roles column — likely out of D-01..D-12's explicit scope (no CONTEXT.md decision addresses this table directly) but flagged here since it's a `RoleGroup`-Record-keyed file (Pitfall 3) that will fail to compile without the `'vocals'` addition regardless.

---

### `src/stores/__tests__/roster.test.ts` (test, mocked Firestore harness)

**Analog:** itself — `snapshotCallbacks` mock harness (lines 1-41)

**Mock harness pattern to reuse for D-03/D-09 migration test cases:**
```typescript
// Track onSnapshot callbacks per collection path so people/roles subscriptions
// can be triggered independently.
type SnapshotDoc = { id: string; data: () => Record<string, unknown> }
type SnapshotCallback = (snap: { docs: SnapshotDoc[] }) => void
const snapshotCallbacks: Record<string, SnapshotCallback> = {}
const mockUnsubscribe = vi.fn()

vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    onSnapshot: vi.fn((queryRef, callback) => {
      const path = (queryRef as { path?: string }).path ?? 'unknown'
      snapshotCallbacks[path] = callback
      return mockUnsubscribe
    }),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    writeBatch: vi.fn(() => ({ set: vi.fn(), update: vi.fn(), commit: vi.fn(() => Promise.resolve()) })),
    query: vi.fn((ref) => ref),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
  }
})
vi.mock('@/firebase', () => ({ auth: {}, db: {} }))
```
D-03 test: invoke `snapshotCallbacks['organizations/org-1/people']` with a mock doc snapshot where the person has `roles: ['guitar','vocals']`, `frequencyTargetN: 2`, and NO `roleFrequencies` field — assert `updateDoc` is called with `{ roleFrequencies: { guitar: 2, vocals: 2 } }`. D-09 test: invoke the roles snapshot callback with a role doc `{ name: 'vocals', group: 'band' }` — assert `updateDoc` patches `{ group: 'vocals' }`. Both mirror the exact `vi.mocked(updateDoc).mock.calls[0]!` assertion style already used throughout this file (e.g. lines 219, 241, 260, 275).

## Shared Patterns

### Tolerant optional-with-default (applies to ALL per-role field reads)
**Source:** `src/utils/scheduler.ts` line 37 (`tierOf`), `src/components/AvailabilityRosterTable.vue` lines 132-147 (`quarterDataFor`)
**Apply to:** `Person.roleFrequencies`, `PersonQuarterData.roleTiers` — every read site defaults via `?? fallback`, never assumes migration has completed.
```typescript
const tierOf = (personId: string): FrequencyTier => pqdById.get(personId)?.frequencyTier ?? 'regular'
```

### Opportunistic patch-on-read migration (D-03/D-09)
**Source:** `src/stores/auth.ts` lines 109-124 (admin→editor precedent — the ONLY migration mechanism in this codebase)
**Apply to:** `src/stores/roster.ts`'s people and roles `onSnapshot` handlers.
```typescript
const patch: Record<string, unknown> = {}
if (role === 'admin') patch.role = 'editor'
if (Object.keys(patch).length > 0) {
  await updateDoc(snap.ref, patch)
}
```
Do NOT build a batch-migration script/CLI — no Admin SDK, no service-account, no scripts/ directory exists anywhere in this repo (RESEARCH "Don't Hand-Roll").

### Firestore dot-path scoped writes (never whole-map rewrites)
**Source:** `src/stores/quarters.ts` `setPersonAvailability` (lines 179-182) and `assignPerson` (lines 250-253)
**Apply to:** any new per-role field write (`roleFrequencies.${roleId}`, or the whole scoped `personQuarterData.${personId}` object including its new `roleTiers` sub-map).
```typescript
await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), {
  [`calendar.${date}.${roleId}`]: [...existing, personId],
  updatedAt: serverTimestamp(),
})
```

### Static-literal Tailwind class maps (never dynamic string interpolation)
**Source:** every `Record<RoleGroup, string>` site — `RosterView.vue` `groupBadgeClasses`, `QuarterGrid.vue` `groupHeaderBg`, `RolesConfigPanel.vue` `groupBadgeClasses`/`groupLabels`, `AvailabilityRosterTable.vue` `ROLE_CHIP_CLASS`
**Apply to:** every one of these 4 maps needs a `vocals:` entry added with a distinct static Tailwind color literal (not computed/interpolated) — this is also the built-in TypeScript exhaustiveness check: `vue-tsc --build` (the project's `type-check` script) will fail to compile any of these files until `'vocals'` is added, so treat compile success as a completion gate, not just a nice-to-have.

### Shared group-exclusivity/cardinality predicate (THE confirmed landmine)
**Source:** `src/utils/scheduler.ts` — `eligible()` (lines 102-110) and `propagatePairing()` (lines 67-96) are two independent role-selection code paths today.
**Apply to:** BOTH must call the same new predicate (e.g. `isGroupCompatible(personId, roleId, alreadyAssignedThisDate, roleGroupOf)`). Do not add the D-12 check only to `eligible()` — `propagatePairing`'s `eligibleRoles = rolesForDate.filter((r) => partner.roles.includes(r.roleId))` / `withCapacity ?? eligibleRoles[0]` selection has zero visibility into what group(s) the partner already holds that date and will silently produce illegal combos otherwise. This is CONFIRMED by direct code reading (RESEARCH Pitfall 2), not speculative.

## No Analog Found

None. Every file this phase touches already exists and contains the shape of the pattern it needs to extend — this is a same-file data-model evolution phase (Phase 13/14 → Phase 15), not new-file scaffolding. The `VolunteerCsvImportModal.vue`/`VolunteerCsvImportModal.test.ts` component-test gap noted in RESEARCH's Wave 0 Gaps is a testing-coverage decision for the planner, not a missing-analog problem (the component itself already exists and needs no new pattern — only possibly a new test file using Vue Test Utils conventions already established elsewhere in the repo, e.g. `AvailabilityDrawer.test.ts`).

## Metadata

**Analog search scope:** `src/types/`, `src/utils/`, `src/utils/__tests__/`, `src/stores/`, `src/stores/__tests__/`, `src/views/`, `src/components/` — all 12 files named in CONTEXT.md canonical refs + RESEARCH.md architecture section, read directly this session.
**Files scanned:** 12 primary + 1 test-harness precedent (`auth.ts`) + 1 test file precedent (`roster.test.ts` mock harness) = 13 total file reads (no re-reads; all reads were single-pass since every file is under 600 lines).
**Pattern extraction date:** 2026-07-08
