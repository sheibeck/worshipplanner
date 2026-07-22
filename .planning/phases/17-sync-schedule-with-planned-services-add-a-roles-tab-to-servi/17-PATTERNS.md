# Phase 17: Sync schedule with planned services - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 9 (new/modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/types/service.ts` (add `roleAssignmentOverrides`) | model | CRUD | `src/types/roster.ts` `Quarter.roleOverridesByDate` field | exact (same sparse-override shape precedent) |
| `src/utils/serviceRoles.ts` (new) | utility | transform | `src/stores/quarters.ts` `buildResolveRolesForDate` (lines 281-290) + `QuarterGrid.vue` `cellPeople`/`effectiveCountFor` (lines 282-296) | role-match (pure resolver style) |
| `src/utils/__tests__/serviceRoles.test.ts` (new) | test | transform | `src/stores/__tests__/quarters.test.ts` (existing store test conventions) | role-match |
| `src/stores/services.ts` (add `setRoleOverride`/`clearRoleOverride`, extend `createShareToken`) | store/service | CRUD + event-driven (share write) | `src/stores/quarters.ts` `assignPerson`/`clearAssignment`/`swapAssignment` (lines 347-392) + `finalizeAndShare` (lines 397-484) | exact |
| `src/stores/__tests__/services.test.ts` (extend) | test | CRUD | existing file itself, plus `quarters.test.ts` mocking style | exact |
| `src/views/ServiceEditorView.vue` (add tab bar + Roles tab) | component (view) | request-response | `src/views/QuarterView.vue` tab bar (lines 83-115) + `src/components/QuarterGrid.vue` role-cell/override UI (lines 122-231, 280-379) | exact (tab bar) / role-match (role editing UI) |
| `src/views/ShareView.vue` (add "Who's Serving" section) | component (public view) | request-response | itself (existing structure, lines 1-152) + `QuarterShareView.vue` role rendering conventions | exact |
| `src/router/index.ts` (add memorable service-share route) | route/config | request-response | `quarter-share`/`quarter-memorable-share` routes (lines 84-96) | exact |
| `firestore.rules` (add `serviceShares/{shareId}` block) | config | CRUD | `quarterShares/{shareId}` block (lines 99-113) | exact |
| `src/rules.test.ts` (extend) | test | CRUD | `describe('quarterShares ...')` block (lines 200-333) | exact |

## Pattern Assignments

### `src/types/service.ts` (model)

**Analog:** `src/types/roster.ts` — `Quarter.roleOverridesByDate: Record<string, RoleSlotConfig[]>`

**Current `Service` interface** (`src/types/service.ts` lines 50-65):
```typescript
export interface Service {
  id: string
  date: string
  name: string
  progression: Progression
  teams: string[]
  status: ServiceStatus
  slots: ServiceSlot[]
  sermonPassage: ScriptureRef | null
  sermonTopic?: string
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
  pcExportedAt?: Timestamp | null
  pcPlanId?: string | null
}
```

**Pattern to copy — add exactly one new optional sparse field**, mirroring the shape (not literally the same type) of `Quarter.roleOverridesByDate`:
```typescript
  // roleId -> personId[]; absent key = inherit from schedule, present key = override.
  // Mirrors Quarter.roleOverridesByDate's sparse-override-map precedent (src/types/roster.ts).
  roleAssignmentOverrides?: Record<string, string[]>
```
No other field changes. `ServiceInput = Omit<Service, 'id' | 'createdAt' | 'updatedAt'>` (line 67) needs no change — the new field is optional so it's fine either way.

---

### `src/utils/serviceRoles.ts` (new utility)

**Analog:** `src/stores/quarters.ts::buildResolveRolesForDate` (lines 281-290) for the "sparse override ?? computed default" shape; `QuarterGrid.vue::cellPeople`/`effectiveCountFor` (lines 282-296) for reading `calendar[date][roleId]`.

**Core pattern to copy (sparse-override-over-default)**:
```typescript
// Source: src/stores/quarters.ts, lines 281-290
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

**Cell-read pattern to copy** (`src/components/QuarterGrid.vue`, lines 282-284):
```typescript
function cellPeople(date: string, roleId: string): string[] {
  return props.quarter.calendar[date]?.[roleId] ?? []
}
```

**Recommended new module signature** (per RESEARCH.md's "Seeding Join" design — already fully specified there, verified consistent with the above analogs):
```typescript
export interface ResolvedRoleAssignment {
  roleId: string
  roleName: string
  group: RoleGroup
  scheduledPersonIds: string[]
  overriddenPersonIds: string[] | null
  effectivePersonIds: string[]
}

export function findQuarterForDate(quarters: Quarter[], date: string): Quarter | undefined {
  return quarters.find((q) => q.serviceDates.includes(date))
}

export function resolveServiceRoleAssignments(
  service: Service,
  quarters: Quarter[],
  roles: Role[],
): ResolvedRoleAssignment[] {
  const quarter = findQuarterForDate(quarters, service.date)
  const scheduleForDate = quarter?.calendar[service.date] ?? {}
  return roles
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((role) => {
      const scheduledPersonIds = scheduleForDate[role.id] ?? []
      const overriddenPersonIds = service.roleAssignmentOverrides?.[role.id] ?? null
      return {
        roleId: role.id,
        roleName: role.name,
        group: role.group,
        scheduledPersonIds,
        overriddenPersonIds,
        effectivePersonIds: overriddenPersonIds ?? scheduledPersonIds,
      }
    })
}
```
Import style: pure functions, no store imports (keep testable without Pinia setup) — follows the same "pure function in utils/" convention as `src/utils/quarterDates.ts` and `src/utils/slug.ts`.

---

### `src/utils/__tests__/serviceRoles.test.ts` (new test)

**Analog:** `src/stores/__tests__/services.test.ts` (lines 1-50) and `src/stores/__tests__/quarters.test.ts` for fixture/mock conventions (Quarter/Role/Service fixture object literals). Since `serviceRoles.ts` is pure (no Firestore/Pinia), the test needs NO `vi.mock('firebase/firestore', ...)` — plain Vitest `describe`/`it`/`expect` with inline fixture objects for `Quarter`, `Role`, `Service`.

---

### `src/stores/services.ts` (extend)

**Analog:** `src/stores/quarters.ts` — scoped dot-path writes (`assignPerson`, lines 347-361) and `finalizeAndShare` (lines 397-484).

**Existing `updateService`** (`src/stores/services.ts`, lines 78-84) — REPLACES fields wholesale, do NOT use for override writes:
```typescript
async function updateService(id: string, data: Record<string, unknown>) {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
```

**Scoped dot-path pattern to copy** (`src/stores/quarters.ts::assignPerson`, lines 347-361):
```typescript
async function assignPerson(
  quarterId: string,
  date: string,
  roleId: string,
  personId: string,
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

**Recommended `setRoleOverride`/`clearRoleOverride` — mirror the dot-path shape exactly**:
```typescript
async function setRoleOverride(serviceId: string, roleId: string, personIds: string[]) {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), {
    [`roleAssignmentOverrides.${roleId}`]: personIds,
    updatedAt: serverTimestamp(),
  })
}

async function clearRoleOverride(serviceId: string, roleId: string) {
  if (!orgId.value) return
  await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), {
    [`roleAssignmentOverrides.${roleId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  })
}
```
Note: `deleteField` import needed from `firebase/firestore` (not currently imported in `services.ts` — add to the existing import block, lines 3-15).

**Existing `createShareToken`** (`src/stores/services.ts`, lines 137-176) — the analog for extending the snapshot:
```typescript
async function createShareToken(service: Service, orgIdValue: string): Promise<string> {
  const array = new Uint8Array(18)
  crypto.getRandomValues(array)
  const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')

  const songStore = useSongStore()
  const slotsWithBpm = service.slots.map((slot) => { /* ...BPM resolution... */ })

  await setDoc(doc(db, 'shareTokens', token), {
    serviceId: service.id,
    orgId: orgIdValue,
    serviceSnapshot: {
      date: service.date,
      name: service.name,
      progression: service.progression,
      teams: service.teams,
      slots: slotsWithBpm,
      sermonPassage: service.sermonPassage,
      notes: service.notes,
      status: service.status,
    },
    createdAt: serverTimestamp(),
  })

  return token
}
```

**Name-resolution pattern to copy for `roleAssignments`** (`src/stores/quarters.ts::finalizeAndShare`, lines 408-415 — build a `Map<personId, name>` and resolve ONLY names, never raw `Person` objects — Pitfall 3 / PII guard):
```typescript
const nameById = new Map(rosterStore.people.map((p) => [p.id, p.name]))
const calendarWithNames: Record<string, Record<string, string[]>> = {}
for (const [date, roleMap] of Object.entries(quarter.calendar)) {
  calendarWithNames[date] = {}
  for (const [roleId, personIds] of Object.entries(roleMap)) {
    calendarWithNames[date]![roleId] = personIds.map((id) => nameById.get(id) ?? id)
  }
}
```
Extend `createShareToken`'s snapshot to add (computed via `resolveServiceRoleAssignments` + this name-map pattern):
```typescript
roleAssignments: resolved.map((r) => ({
  roleId: r.roleId,
  roleName: r.roleName,
  group: r.group,
  personNames: r.effectivePersonIds.map((id) => nameById.get(id) ?? id),
})),
```

**Memorable-URL soft-fail wrapper to copy** (`src/stores/quarters.ts::finalizeAndShare`, lines 442-481 — slug claim + `quarterShares/{slug}__q{N}-{year}` write, wrapped in try/catch so the opaque token still succeeds on memorable-URL failure):
```typescript
try {
  const orgRef = doc(db, 'organizations', orgId.value)
  const orgSnap = await getDoc(orgRef)
  const orgData = orgSnap.exists() ? orgSnap.data() : {}
  let slug = orgData.slug as string | undefined
  if (!slug) {
    const derived = deriveSlug((orgData.name as string | undefined) ?? '')
    const base = derived || 'org'
    slug = await claimSlug(base, orgId.value)
    await updateDoc(orgRef, { slug })
  }
  await setDoc(doc(db, 'quarterShares', `${slug}__q${quarter.quarter}-${quarter.year}`), {
    orgId: orgId.value,
    orgSlug: slug,
    quarterSnapshot: { /* ... */ },
    token,
    updatedAt: serverTimestamp(),
  })
} catch (err) {
  console.error('finalizeAndShare: memorable-URL slug/quarterShares write failed — ...', err)
}
```
For `services.ts`, mirror this exactly but write to a NEW `serviceShares` collection with doc ID `${slug}__service-${service.date}` (note: `services.ts` doesn't currently import `getDoc`, `deriveSlug`, or `claimSlug` — add these to its import block).

---

### `src/stores/__tests__/services.test.ts` (extend)

**Analog:** existing file's own mocking convention (`vi.mock('firebase/firestore', ...)`), same pattern `quarters.test.ts` uses for `assignPerson`/`finalizeAndShare` coverage. Add new test cases (not a new file) for: `setRoleOverride` writes only the scoped dot-path key; `clearRoleOverride` uses `deleteField()`; `createShareToken`'s snapshot includes `roleAssignments` with names only (assert no `email`/`phone` keys present in the written payload).

---

### `src/views/ServiceEditorView.vue` (add tab bar + Roles tab)

**Analog:** `src/views/QuarterView.vue` tab bar markup (lines 83-115) — copy verbatim, renaming tab keys:
```html
<!-- Source: src/views/QuarterView.vue, lines 84-115 -->
<div class="flex items-center gap-1 mb-6 border-b border-gray-800 pb-0">
  <button
    type="button"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'schedule'
      ? 'text-indigo-300 border-indigo-500 bg-gray-900'
      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="activeTab = 'schedule'"
  >
    Schedule
  </button>
  <!-- ...additional buttons... -->
</div>
<div v-show="activeTab === 'volunteers'"> ... </div>
```
`const activeTab = ref<'volunteers' | 'schedule' | 'serviceDates'>('schedule')` (line 522) — for `ServiceEditorView.vue` use `const activeTab = ref<'music' | 'roles'>('music')`, defaulting to `'music'` to preserve existing behavior for all current users (no tabs exist there today).

**Role-editing/override UI to copy** — `src/components/QuarterGrid.vue`:
- Cell count/assignment display (line 136): `{{ cellPeople(activeDate, role.id).length }}/{{ effectiveCountFor(activeDate, roleId) }}`
- Eligibility filter for the "assign a different person" control (`availableUnassigned`, lines 369-378):
```typescript
function hasRole(person: Person, roleId: string): boolean {
  return person.roles.includes(roleId)
}
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
Adapt for the Roles tab's override-person-picker: filter `rosterStore.activePeople` by `hasRole(p, roleId)`, optionally still respecting blackout dates for the service's specific date if a quarter is in scope (per RESEARCH.md's recommendation).

**Editor/viewer conditional-rendering convention** — follow the same pattern already used elsewhere in `ServiceEditorView.vue` (e.g. its existing Teams block, editor gets an interactive control, viewer gets a plain read-only list) — gate both the override control's visibility AND, per Pitfall 4, the underlying `quartersStore`/`rosterStore` data subscription behind `authStore.isEditor`.

---

### `src/views/ShareView.vue` (add "Who's Serving" section)

**Analog:** itself — existing structure (lines 1-152), specifically the slot-list rendering block (lines 27-76) and the `onMounted` `getDoc` pattern (lines 136-151):
```typescript
onMounted(async () => {
  const route = useRoute()
  const token = route.params.token as string
  try {
    const snap = await getDoc(doc(db, 'shareTokens', token))
    if (!snap.exists()) {
      notFound.value = true
    } else {
      serviceSnapshot.value = snap.data().serviceSnapshot
    }
  } catch {
    notFound.value = true
  } finally {
    isLoading.value = false
  }
})
```
Extend to also resolve the memorable-route case (mirror `QuarterShareView.vue`'s dual-path `onMounted`, lines 250-266):
```typescript
// Source: src/views/QuarterShareView.vue, lines 250-266
onMounted(async () => {
  const token = route.params.token as string | undefined
  try {
    const snap = token
      ? await getDoc(doc(db, 'shareTokens', token))
      : await getDoc(
          doc(
            db,
            'quarterShares',
            `${route.params.slug as string}__q${route.params.num as string}-${route.params.year as string}`,
          ),
        )
    if (!snap.exists()) {
      notFound.value = true
    } else {
      quarterSnapshot.value = snap.data().quarterSnapshot
    }
  } catch {
    notFound.value = true
  } finally {
    isLoading.value = false
  }
})
```
For `ShareView.vue`, adapt to: `token ? getDoc(shareTokens/token) : getDoc(serviceShares/{slug}__service-{date})`, reading `serviceSnapshot` either way (same doc shape now includes `roleAssignments`).

Add a new "Who's Serving" section rendering `serviceSnapshot.roleAssignments` (array of `{roleId, roleName, group, personNames}`), styled consistent with the existing Notes section block (lines 78-82: `rounded-lg bg-gray-50 p-4` card).

---

### `src/router/index.ts` (add memorable service-share route)

**Analog:** existing quarter-share routes (lines 78-96):
```typescript
{
  path: '/share/:token',
  name: 'share',
  component: () => import('../views/ShareView.vue'),
  // Intentionally no meta.requiresAuth — public route for unauthenticated viewers
},
{
  path: '/quarter-share/:token',
  name: 'quarter-share',
  component: () => import('../views/QuarterShareView.vue'),
},
{
  path: '/:slug/quarter:num([1-4])-:year(\\d{4})',
  name: 'quarter-memorable-share',
  component: () => import('../views/QuarterShareView.vue'),
  // Appended after all static routes: Vue Router ranks static segments above dynamic
  // ones, so this can never shadow /songs, /volunteers, /schedule, etc. (D-19).
},
```
Add, appended in the same position (after all static routes, before/alongside `quarter-memorable-share`):
```typescript
{
  path: '/:slug/service-:date(\\d{4}-\\d{2}-\\d{2})',
  name: 'service-memorable-share',
  component: () => import('../views/ShareView.vue'),
  // Intentionally no meta.requiresAuth — public route for unauthenticated viewers,
  // mirrors quarter-memorable-share.
},
```
Also add `'service-share'` to `RESERVED_SLUGS` in `src/utils/slug.ts` proactively per RESEARCH.md recommendation (even though the opaque route reuses existing `/share/:token`), for consistency with the reserved-word set already guarding `quarter-share`.

---

### `firestore.rules` (add `serviceShares/{shareId}` block)

**Analog:** `quarterShares/{shareId}` block (lines 99-113) — copy verbatim, changing only the collection name:
```
// Memorable-URL quarter shares: public read, org-editor-scoped create/update
// (overwritten in place on every finalize, unlike frozen shareTokens). CR-01: shareId is
// a guessable, deterministic string (`${slug}__q${N}-${year}`), so isSignedIn() alone let
// any authenticated user of ANY org overwrite another org's public share doc. Both create
// and update require the caller to be an editor of the orgId embedded in the doc, and
// update additionally forbids changing orgId (no reassigning a share to a different org).
match /quarterShares/{shareId} {
  allow read: if true;
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```
New block to add (place adjacent to `quarterShares`, before the catch-all at line 115):
```
match /serviceShares/{shareId} {
  allow read: if true;
  allow create: if isOrgEditor(request.resource.data.orgId);
  allow update: if isOrgEditor(resource.data.orgId)
                   && request.resource.data.orgId == resource.data.orgId;
  allow delete: if isOrgEditor(resource.data.orgId);
}
```
No change needed to `shareTokens/{token}` (lines 78-86, already `allow read: if true`) or the `services/{docId}` block (lines 51-54, already `allow read: if isOrgMember(orgId); allow write: if isOrgEditor(orgId);` — covers the new `roleAssignmentOverrides` field with zero rules change).

---

### `src/rules.test.ts` (extend)

**Analog:** `describe('quarterShares — public read, org-editor-scoped create/update (CR-01)', ...)` block (lines 200-333) — copy the entire `describe` block structure, renaming collection/doc-ID references from `quarterShares`/`grace-church__q3-2026` to `serviceShares`/`grace-church__service-2026-08-02`. It covers 12 cases: unauthenticated read (succeeds), owning-org editor create (succeeds), non-member create (fails), cross-org create (fails), owning-org editor update/overwrite (succeeds), non-member update (fails), cross-org update (fails), owning-org editor reassigning orgId on update (fails), unauthenticated write (fails), owning-org editor delete (succeeds), cross-org delete (fails), unauthenticated delete (fails). Uses the file's existing `seedDoc(path, data)` helper (referenced at lines 202, 246, etc.) — reuse as-is, no new helper needed.

## Shared Patterns

### Scoped dot-path writes (never whole-map rewrites)
**Source:** `src/stores/quarters.ts::assignPerson`/`clearAssignment`/`swapAssignment` (lines 347-392)
**Apply to:** `services.ts::setRoleOverride`/`clearRoleOverride` — write only `roleAssignmentOverrides.${roleId}`, never replace the whole map, to avoid two editors' concurrent overrides clobbering each other (Pitfall 1).

### Denormalized public snapshot, names only, never raw Person objects
**Source:** `src/stores/quarters.ts::finalizeAndShare` `nameById` map (lines 408-415); `src/stores/services.ts::createShareToken` (lines 137-176)
**Apply to:** `services.ts`'s extended `createShareToken` — resolve `personId -> name` once via a `Map`, embed only `personNames: string[]` in the `roleAssignments` snapshot, never the full `Person` (avoids leaking email/phone — Pitfall 3, D-24 precedent).

### Soft-fail memorable-URL secondary write
**Source:** `src/stores/quarters.ts::finalizeAndShare`, try/catch around slug resolution + `quarterShares` write (lines 442-481)
**Apply to:** `services.ts`'s new `serviceShares/{slug}__service-{date}` write — wrap in try/catch so a memorable-URL failure never blocks the already-succeeded opaque `shareTokens` write; log and swallow.

### Cryptographic token generation
**Source:** duplicated identically in `src/stores/services.ts::createShareToken` (lines 138-141) and `src/stores/quarters.ts::finalizeAndShare` (lines 402-406)
```typescript
const array = new Uint8Array(18)
crypto.getRandomValues(array)
const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
```
**Apply to:** No new token generator needed — `services.ts::createShareToken` already has this; do not add a third copy.

### Tab bar UI (inline `activeTab` ref + button classes)
**Source:** `src/views/QuarterView.vue` (lines 84-115, `activeTab` ref at line 522)
**Apply to:** `ServiceEditorView.vue`'s new Music/Roles tab bar — copy markup verbatim, do not introduce a new tabs component/library.

### Editor-only write / member-read Firestore rules (existing, no change needed)
**Source:** `firestore.rules` `services/{docId}` block (lines 51-54): `allow read: if isOrgMember(orgId); allow write: if isOrgEditor(orgId);`
**Apply to:** Covers the new `roleAssignmentOverrides` field automatically — no rules change required for the override field itself, only for the new `serviceShares` collection.

### Role eligibility filtering (who CAN fill a role)
**Source:** `src/components/QuarterGrid.vue::hasRole`/`availableUnassigned` (lines 357-378)
**Apply to:** The Roles tab's "assign a different person" override picker in `ServiceEditorView.vue` — reuse `person.roles.includes(roleId)` semantics, don't hand-roll new eligibility logic.

## No Analog Found

None — every file in this phase's scope has a direct or near-direct existing analog (Phases 13/15/16 already established every pattern needed: sparse overrides, scoped dot-path writes, denormalized public snapshots, memorable-URL slug shares, tab bar UI, role-eligibility filtering).

## Metadata

**Analog search scope:** `src/types/`, `src/stores/`, `src/views/`, `src/components/`, `src/router/`, `src/utils/`, `firestore.rules`, `src/rules.test.ts` (all read directly, no graph query needed — RESEARCH.md had already isolated exact file/line targets; this pass verified current line numbers and extracted concrete excerpts)
**Files scanned:** `src/stores/quarters.ts`, `src/stores/services.ts`, `src/types/service.ts`, `firestore.rules`, `src/router/index.ts`, `src/views/QuarterView.vue`, `src/views/ShareView.vue`, `src/views/QuarterShareView.vue`, `src/components/QuarterGrid.vue`, `src/rules.test.ts`
**Pattern extraction date:** 2026-07-22
