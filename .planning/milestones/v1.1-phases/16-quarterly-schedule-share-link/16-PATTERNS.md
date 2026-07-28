# Phase 16: Quarterly Schedule Share Link — Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 22
**Analogs found:** 22 / 22 (all in-place-modify files use themselves + a cited sibling pattern; all new files map to an existing analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/types/roster.ts` | model | transform (data-model relocation) | itself (modify in place) | exact |
| `src/utils/scheduler.ts` | utility | batch/pure-transform | itself (modify in place) | exact |
| `src/utils/__tests__/scheduler.test.ts` | test | batch | itself (rewrite factories) | exact |
| `src/utils/slug.ts` (NEW) | utility | transform | `src/stores/quarters.ts::finalizeAndShare` token-generation block (lines 328-333) | role-match |
| `src/utils/__tests__/slug.test.ts` (NEW) | test | batch | `src/utils/__tests__/quarterDates.test.ts` (pure-fn unit test shape) | role-match |
| `src/stores/quarters.ts` | store | CRUD + event-driven (Firestore) | itself (modify in place) | exact |
| `src/stores/roster.ts` | store | CRUD | itself (modify in place) | exact |
| `src/router/index.ts` | route config | request-response | itself (modify in place) — new route mirrors `/quarter-share/:token` | exact |
| `src/router/__tests__/router.test.ts` | test | request-response | itself (extend) | exact |
| `src/views/QuarterShareView.vue` | view (public) | request-response, read-only | itself (modify in place) | exact |
| `src/views/__tests__/QuarterShareView.test.ts` (NEW) | test | request-response | `src/views/__tests__/ShareView.test.ts` (public snapshot-view test harness) | exact |
| `src/components/QuarterShareMatrix.vue` (NEW) | component (presentational) | transform, read-only | `src/components/QuarterGrid.vue` (table orientation) + `QuarterShareView.vue` (light theme, snapshot read) | role-match (composite) |
| `src/components/CollapsibleSection.vue` (NEW) | component (shared) | event-driven (UI state) | `src/components/ArrangementAccordion.vue` (chevron/expand pattern) | role-match |
| `src/components/__tests__/CollapsibleSection.test.ts` (NEW) | test | event-driven | `src/components/__tests__/AvailabilityDrawer.test.ts` (component interaction test shape) | role-match |
| `src/components/AvailabilityDrawer.vue` | component (slide-out editor) | CRUD | itself (modify in place) | exact |
| `src/components/AvailabilityRosterTable.vue` | component (table) | CRUD (read + badge derivation) | itself (modify in place) | exact |
| `src/components/QuarterGrid.vue` | component (matrix editor) | CRUD | itself (modify in place) + `AvailabilityDrawer.vue` (Teleport slide-out to graft on) | exact + role-match |
| `src/views/QuarterView.vue` | view | CRUD + UI composition | itself (modify in place) + `src/components/VolunteerCsvImportModal.vue` (modal Teleport pattern for "Add quarter") | exact + role-match |
| `src/views/RosterView.vue` | view | CRUD | itself (modify in place) | exact |
| `src/views/SettingsView.vue` | view | CRUD (form + save) | itself (modify in place) — org name field is the exact template for the new slug field | exact |
| `firestore.rules` | config (security rules) | access-control | `shareTokens/{token}` rule block (lines 77-82) | exact |
| `src/rules.test.ts` | test | access-control | itself (extend, add `describe` blocks) | exact |
| `src/views/SongsView.vue` (reference only, not modified) | — | request-response (URL query sync) | n/a — source of the `router.replace({query})` pattern reused in `QuarterShareView.vue` | exact |

---

## Pattern Assignments

### `src/types/roster.ts` (model, data-model relocation)

**Analog:** itself — current shape (read in full, lines 1-108).

**Current split to replace** (D-04/D-05 — see `16-RESEARCH.md` Pattern 1 for the exact target shape):
```typescript
// Person (STANDING) — lines 13-32 — REMOVE frequencyTargetN (line 24) and roleFrequencies (line 28)
export interface Person {
  id: string
  name: string
  email: string
  phone: string
  active: boolean
  roles: string[]
  frequencyTargetN: number        // REMOVE — D-04
  roleFrequencies?: Record<string, number>  // REMOVE — D-04
  pcPersonId: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

// PersonQuarterData (QUARTER-SCOPED) — lines 47-59 — REPLACE frequencyTier/roleTiers
// with a single roleFrequency: Record<roleId, RoleFrequencyEntry> field (D-05):
export interface PersonQuarterData {
  personId: string
  blackoutDates: string[]
  pairedWith: string[]
  frequencyTier?: FrequencyTier      // REPLACE
  roleTiers?: Record<string, FrequencyTier>  // REPLACE
  note?: string
}
```
Target new field (from RESEARCH.md, authoritative — do not re-derive):
```typescript
export interface RoleFrequencyEntry {
  tier: FrequencyTier
  n: number
}
export interface PersonQuarterData {
  personId: string
  blackoutDates: string[]
  pairedWith: string[]
  roleFrequency?: Record<string, RoleFrequencyEntry>
  note?: string
}
```
**Do not migrate old data** (D-04 — greenfield, orphaned fields on existing docs are acceptable).

---

### `src/utils/scheduler.ts` (utility, pure algorithm)

**Analog:** itself — `propagatePairing` (lines 143-184), `tierOf` (lines 91-92), per-role deficit scoring (lines 210-233).

**Existing gate chain to extend** (D-01/D-02/D-03 — add remaining-cadence-budget filter here, per RESEARCH Pattern 2):
```typescript
// lines 162-180 — existing filter chain propagatePairing already has:
const notOutTier = roleMatchesByName.filter((r) => tierOf(partnerId, r.roleId) !== 'out')
if (notOutTier.length === 0) {
  pairingConflicts.push({ date, personId, partnerId, reason: 'partner out this quarter' })
  continue
}
const eligibleRoles = notOutTier.filter((r) =>
  isGroupCompatible(rolesHeldThisDate(partnerId), r.roleId, roleGroupOf),
)
if (eligibleRoles.length === 0) {
  pairingConflicts.push({ date, personId, partnerId, reason: 'group rule violation for partner today' })
  continue
}
const withCapacity = eligibleRoles.find((r) => (calendar[date]![r.roleId]?.length ?? 0) < r.count)
const target = withCapacity ?? eligibleRoles[0]!
assignToRole(target.roleId, partnerId)
propagatePairing(partnerId, visited)
```
Insert the new cadence-budget filter (D-02, silent skip per D-03 — no `pairingConflicts` push) between the `eligibleRoles` computation and `assignToRole`, per RESEARCH Pattern 2's `roleBudget`/`withinCadence` code. `tierOf` (line 91-92) and the cadence lookup (line 214: `p.roleFrequencies?.[roleId] ?? p.frequencyTargetN`) both need repointing to `pqdById.get(personId)?.roleFrequency?.[roleId]`.

**Shared helper to keep intact:** `isGroupCompatible`/`evaluateGroupCombo` (lines 20-53) — do not duplicate this logic in the new gate; call the existing exported helper.

---

### `src/utils/slug.ts` (NEW utility)

**Analog:** `src/stores/quarters.ts::finalizeAndShare` token-generation block.

**Imports pattern** (no store/Vue imports needed — pure function, mirrors `src/utils/quarterDates.ts`'s framework-free style):
```typescript
// no imports required for deriveSlug(); claimSlug() will need:
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
```

**Random-token generation precedent** (`src/stores/quarters.ts` lines 328-333 — reuse the crypto-random pattern style, though slugs are deterministic from org name, not random):
```typescript
const array = new Uint8Array(18)
crypto.getRandomValues(array)
const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
```

**Create-only claim write precedent** (`finalizeAndShare` uses `setDoc` against a fixed-id doc path, `src/stores/quarters.ts` line 344):
```typescript
await setDoc(doc(db, 'shareTokens', token), { orgId: orgId.value, quarterId, quarterSnapshot: {...}, createdAt: serverTimestamp() })
```
Follow this same `setDoc(doc(db, 'orgSlugs', candidate), { orgId })` shape for `claimSlug()`, catching permission-denied (existing doc → Firestore rules deny the "update") to retry with a numeric suffix, per RESEARCH Pattern 3.

**Error handling pattern:** no try/catch inside `deriveSlug` (pure regex transform, cannot throw); `claimSlug` should catch the Firestore permission-denied error specifically (not a blanket catch) — mirrors `QuarterShareView.vue`'s `onMounted` try/catch/finally shape (lines 113-124) for the retry-loop's per-attempt catch.

---

### `src/stores/quarters.ts` (store, CRUD + Firestore)

**Analog:** itself.

**New-quarter seeding insertion point** (`createQuarter`, lines 81-97) — D-06 seeding logic (RESEARCH "Code Examples" section has the exact `findPriorQuarter`/`quarterKey` helpers to add above this function and thread through):
```typescript
async function createQuarter(year: number, quarter: 1 | 2 | 3 | 4, label: string): Promise<string> {
  if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
  const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'quarters'), {
    label, year, quarter,
    serviceDates: generateSundaysInQuarter(year, quarter),
    roleOverridesByDate: {},
    personQuarterData: {},   // ← D-06: populate from findPriorQuarter(...) instead of {}
    calendar: {},
    status: 'draft',
    shareToken: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}
```

**Scoped dot-path write pattern** (`setPersonAvailability`, lines 169-228) — the exact convention any new per-role-frequency write must follow: never replace the whole `personQuarterData` map, only `personQuarterData.${personId}` or a deeper dot-path:
```typescript
const updates: Record<string, unknown> = {
  [`personQuarterData.${personId}`]: { personId, ...data },
  updatedAt: serverTimestamp(),
}
// ...bidirectional pairing add/remove writes scoped to personQuarterData.${partnerId}.pairedWith only
await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), updates)
```
`data.roleTiers` (line 180) becomes `data.roleFrequency: Record<string, RoleFrequencyEntry>` per D-05.

**`finalizeAndShare` overwrite-in-place pitfall (RESEARCH Pitfall 2):** the existing function (lines 324-359) mints a brand-new token/doc on every call — the new `quarterShares/{slug}__q{N}-{year}` doc must instead be **overwritten via `setDoc`** with a stable doc ID on every finalize call (not accumulated like `shareTokens`). Add this as a second `setDoc` call inside `finalizeAndShare`, reusing the exact `calendarWithNames` denormalization already built (lines 336-342) — do not duplicate that name-resolution logic.
```typescript
// existing shareTokens write (line 344) — keep as-is, then ADD:
await setDoc(doc(db, 'quarterShares', `${orgSlug}__q${quarter.quarter}-${quarter.year}`), {
  orgSlug, quarterSnapshot: { label: quarter.label, serviceDates: quarter.serviceDates, roles: ..., calendar: calendarWithNames },
  token, updatedAt: serverTimestamp(),
})
```

---

### `src/stores/roster.ts` (store, CRUD)

**Analog:** itself. Not fully read this session (out of the file-count budget), but confirmed via `RosterView.vue` reads and RESEARCH.md (verified lines 59-74 hold a `roleFrequencies` migration block, plus frequency synthesis in `addPerson`/`updatePerson`/`upsertPeople`) that these must be deleted per D-04/D-07. Follow the store's existing `updateDoc`/dot-path convention already visible in `quarters.ts` (same project convention — Firestore writes go through `updateDoc(doc(db, 'organizations', orgId, ...))`, never a raw `setDoc` overwrite of unrelated fields).

---

### `src/router/index.ts` (route config)

**Analog:** itself — existing public-route pattern for `/quarter-share/:token` (lines 83-88).

**Public route pattern to copy exactly** (no `meta.requiresAuth`):
```typescript
{
  path: '/quarter-share/:token',
  name: 'quarter-share',
  component: () => import('../views/QuarterShareView.vue'),
  // Intentionally no meta.requiresAuth — public route for unauthenticated viewers (D-24)
},
```
New route to add (RESEARCH Pattern 3, D-19 — reserved-slug guard enforced at slug-claim time, NOT here):
```typescript
{
  path: '/:slug/quarter:num([1-4])-:year(\\d{4})',
  name: 'quarter-memorable-share',
  component: () => import('../views/QuarterShareView.vue'),
},
```
**Route order note:** append after existing routes — Vue Router ranks by specificity (static beats dynamic), so this dynamic `/:slug/...` route can never shadow `/songs`, `/roster`, `/schedule`, etc. regardless of array position (confirmed via router.vuejs.org, cited in RESEARCH.md).

---

### `src/views/QuarterShareView.vue` (public view, read-only)

**Analog:** itself (full file read, 127 lines).

**Imports pattern** (lines 55-59):
```typescript
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
```

**Snapshot-fetch pattern** (lines 110-125) — extend the token branch with a slug/quarter-param branch reading from `quarterShares/{slug}__q{N}-{year}` instead, same try/catch/finally shape:
```typescript
onMounted(async () => {
  const route = useRoute()
  const token = route.params.token as string
  try {
    const snap = await getDoc(doc(db, 'shareTokens', token))
    if (!snap.exists()) { notFound.value = true }
    else { quarterSnapshot.value = snap.data().quarterSnapshot }
  } catch { notFound.value = true }
  finally { isLoading.value = false }
})
```

**Read-only, no roster/auth access** — this component today imports nothing from `@/stores/*`; the matrix/name-filter additions must preserve that (D-24) — everything derives from the already-fetched `quarterSnapshot` ref.

**URL query-sync pattern to adopt (D-16)** — from `src/views/SongsView.vue` lines 291-296:
```typescript
if (route.query.import === 'true') {
  importModalOpen.value = true
  router.replace({ query: { ...route.query, import: undefined } })
}
// Apply the same shape for view+name (RESEARCH.md "Code Examples"):
watch([viewMode, nameFilter], ([view, name]) => {
  router.replace({ query: { ...route.query, view, name: name || undefined } })
})
```

**Name-filter typeahead pattern to reuse (D-15)** — from `AvailabilityDrawer.vue`'s "Must serve with" control (lines 179-201, light-theme-adapted):
```vue
<input v-model="pairQuery" type="text" @focus="pairMenuOpen = true" @blur="onPairBlur" />
<div v-if="pairMenuOpen && pairCandidates.length > 0" class="absolute ...">
  <div v-for="candidate in pairCandidates" :key="candidate.id" @mousedown.prevent="addPair(candidate.id)">
    {{ candidate.name }}
  </div>
</div>
```
```typescript
function onPairBlur() {
  window.setTimeout(() => { pairMenuOpen.value = false }, 150)
}
```
Candidates for the share page come from the snapshot's own resolved names (dedupe across `calendar[date][roleId]` entries), not `rosterStore.people` (no roster access on this public page).

**Error/empty-state copy — keep verbatim** (already matches UI-SPEC contract):
```vue
<p class="text-gray-700 text-base mb-2">This shared schedule is no longer available or the link is invalid.</p>
<p class="text-gray-400 text-sm">Please ask your worship leader to share the schedule again.</p>
```

---

### `src/components/QuarterShareMatrix.vue` (NEW component)

**Analog:** `src/components/QuarterGrid.vue` for table orientation (roles-across-top `<th>`, dates-down `<tr>` — already the exact shape needed, verified lines 4-19) + `QuarterShareView.vue` for the light-theme, snapshot-only, no-store-import convention.

**Table skeleton to adapt** (from `QuarterGrid.vue` lines 1-29, strip interactivity, invert theme):
```vue
<table class="w-full text-sm border-collapse">
  <thead>
    <tr>
      <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
      <th v-for="role in sortedRoles" :key="role.id" class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        {{ role.name }}
      </th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="date in filteredDates" :key="date" class="hover:bg-gray-50">
      <td class="px-2 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{{ formatDateLabel(date) }}</td>
      <td v-for="role in sortedRoles" :key="role.id" class="px-2 py-2 text-gray-800">
        {{ peopleFor(date, role.id).join(', ') || '—' }}
      </td>
    </tr>
  </tbody>
</table>
```
**Multi-person cell rendering:** comma-separated via `.join(', ')` — exactly matching `QuarterShareView.vue`'s existing list-view rendering (line 37: `{{ peopleFor(date, role.id).join(', ') }}`), per A3/D-A3 discretion resolution. No badges, no `@click`, no hover-expand — read-only per D-24.

**Role grouping to reuse** — `QuarterShareView.vue`'s own `GROUP_ORDER`/`sortedRoles` computed (lines 85-92) is the exact pattern (band/tech/other, not `QuarterGrid`'s 4-group band/vocals/tech/other — confirm against snapshot's role shape which only carries `{id, name, group}`).

---

### `src/components/CollapsibleSection.vue` (NEW shared component)

**Analog:** `src/components/ArrangementAccordion.vue` (chevron affordance + `v-if` body toggle).

**Chevron + toggle pattern to extract** (lines 1-20, 152-166):
```vue
<div class="flex items-center justify-between gap-3 px-4 py-3 bg-gray-800 cursor-pointer select-none" @click="isOpen = !isOpen">
  <div class="flex items-center gap-2 min-w-0">
    <svg class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150" :class="isOpen ? 'rotate-90' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
    </svg>
    <span class="text-sm font-medium text-gray-100 truncate">{{ title }}</span>
  </div>
</div>
<div v-if="isOpen" class="bg-gray-800 border-t border-gray-700 px-4 py-4 space-y-4">
  <slot />
</div>
```
```typescript
import { ref } from 'vue'
const isOpen = ref(false) // ArrangementAccordion starts closed — CollapsibleSection must default OPEN (D-17)
```

**New behavior not in the source pattern (must add):** localStorage persistence, keyed per UI-SPEC (`localStorage['schedule.section.{id}']` / `localStorage['roster.section.{id}']` = `'open'|'closed'`), default state **expanded** (D-17 — opposite of `ArrangementAccordion`'s default-closed). Header padding declared at `p-4` (16px, not the source's implicit `px-4 py-3` ≈ 12px vertical) and title weight 600 semibold per UI-SPEC typography contract — do not carry over 700/bold.

**Props shape (new, no existing analog for the `<slot />`-based reusable wrapper):**
```typescript
defineProps<{ title: string; storageKey: string }>()
```

---

### `src/components/AvailabilityDrawer.vue` (modify in place)

**Analog:** itself (full file read, 550 lines).

**Sections to remove (R-08, D-04/D-07):**
- Date-range picker (lines 118-145: `rangeStart`/`rangeEnd`/`applyRange` inputs and the "Block Sundays in range" button) — keep only the Nth-Sunday quick-toggle (lines 104-117) and the per-Sunday grid (lines 146-165).
- The standing `frequencyTargetN` write on save (lines 537-541) — deleted entirely; frequency becomes fully quarter-scoped.

**Section to unify (D-05):** the per-role tier buttons (lines 58-97, `FREQ_PRESETS`/`selectRoleTierPreset`) already have the right shape (5 presets: weekly/biweek/monthly/fillin/out) — extend `selectRoleTierPreset` to write `{tier, n}` into `draft.roleFrequency[roleId]` in one write instead of the current two-step (`draft.roleTiers[roleId] = tier` + separate standing write):
```typescript
// current (lines 398-401) — extend to write {tier, n} in one shot:
function selectRoleTierPreset(roleId: string, key: FreqPresetKey) {
  const preset = FREQ_PRESETS.find((p) => p.key === key)!
  draft.roleFrequency[roleId] = { tier: preset.tier, n: preset.n }  // was: draft.roleTiers[roleId] = preset.tier
}
```

**Save pattern to keep, payload to change** (lines 525-544 `onSave`) — still routes exclusively through `quartersStore.setPersonAvailability`, just with `roleFrequency` replacing `frequencyTier`/`roleTiers`, and the `rosterStore.updatePerson` standing-write branch (lines 539-541) deleted:
```typescript
await quartersStore.setPersonAvailability(props.quarterId, props.personId, {
  blackoutDates: draft.blackoutDates,
  pairedWith: draft.pairedWith,
  roleFrequency: draft.roleFrequency,  // was: frequencyTier + roleTiers
  note: draft.note,
})
```

**Roles-editing addition (D-09)** — this drawer has no roles checklist today; add one following `RosterView.vue`'s roles-checkbox pattern (see below), writing through `rosterStore.upsertPeople`/`updatePerson`, same as the roster screen.

**Teleport/Transition slide-out markup (lines 1-31)** — this is the exact pattern `QuarterGrid.vue`'s new slide-out (R-14) must copy verbatim (backdrop `fixed inset-0 z-40 bg-black/60` + panel `fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-gray-900 border-l border-gray-700 shadow-2xl`), per UI-SPEC "Component-Specific Notes."

---

### `src/components/AvailabilityRosterTable.vue` (modify in place)

**Analog:** itself. Read-site audit (confirmed via grep, not full read this session — file already scoped precisely in RESEARCH.md):
```typescript
// lines ~133-168 — tierOf/aggregateTier/allRolesOut currently read pqd.roleTiers/frequencyTier:
function tierOf(personId: string, roleId: string): FrequencyTier {
  const pqd = ... // reads pqd?.roleTiers?.[roleId] ?? pqd?.frequencyTier ?? 'regular'
}
// lines ~221-237 — freqLabel/freqBadge currently fall back to person.frequencyTargetN:
function freqBadge(person: Person): string {
  if (allRolesOut(person)) return '—'
  // ...falls back to freqLabel(person.frequencyTargetN)
}
```
Repoint all of these to read `pqd?.roleFrequency?.[roleId]?.tier`/`?.n` instead — same function names/shapes, new field source. This is the direct sibling of `QuarterGrid.vue`'s own `tierOf` (line 306-309), which needs the identical repoint — keep both repointed consistently since they must never drift (per RESEARCH "Don't Hand-Roll" table entry on `roleFrequency` being the single source).

---

### `src/components/QuarterGrid.vue` (modify in place — R-13/R-14)

**Analog:** itself (full file read, 393 lines) for the matrix table + cell logic to keep; `AvailabilityDrawer.vue` for the slide-out markup to graft on.

**Whole-cell click target — likely already satisfied (R-13, verify not implement):**
```vue
<!-- lines 30-76 — outer button already wraps the FULL cell (pills + badges) -->
<button type="button" class="w-full text-left rounded-md p-1 ..." @click="toggleCell(date, role.id)">
  ...
  <span role="button" @click.stop="onClear(date, role.id, personId)">&times;</span>  <!-- only this has click.stop -->
</button>
```
This markup already meets R-13's acceptance criteria per RESEARCH A6 — write a regression test confirming it rather than restructuring.

**Expand-underneath row to REPLACE with slide-out (R-14, lines 81-184):** the current `<tr v-if="expandedCell">` inline row (current-assignments list, add-person select, gap-filling panel) must move into a `Teleport to="body"` slide-out panel using `AvailabilityDrawer.vue`'s exact markup (lines 1-31 of that file) — same z-40 backdrop / z-50 panel / transition classes. The panel's *content* (current assignments, swap dropdown, add-person select, gap-filling blacked-out/available lists — lines 87-182) transfers over unchanged, just re-hosted inside the Teleport instead of the `<tr>`.

**`tierOf` repoint (line 306-309)** — same repoint as `AvailabilityRosterTable.vue` above, to `roleFrequency[roleId]?.tier`.

**State/actions to keep verbatim** — `quartersStore.assignPerson`/`clearAssignment`/`swapAssignment` calls (lines 371-391) are unaffected by the slide-out UI change; only the container markup around them changes.

---

### `src/views/QuarterView.vue` (modify in place — R-09/R-10/R-11)

**Analog:** itself for the 3 cards to wrap; `src/components/VolunteerCsvImportModal.vue` for the new "Add quarter" modal's Teleport structure.

**Quarter-switcher/create card to split (D-13, lines 63-105):** currently one card mixing the `<select>` (lines 66-73) with year/quarter/"New quarter" inputs (lines 76-103). Split into (a) the `<select>` staying as a lightweight "Quarter" dropdown, and (b) a separate secondary **"+ Add quarter"** button (`border-gray-700 bg-gray-800`, per UI-SPEC copy contract) that opens a small modal — reuse `VolunteerCsvImportModal.vue`'s Teleport/backdrop/centered-modal shape (lines 1-33 of that file) rather than `AvailabilityDrawer`'s right-slide-out shape (this is a small centered form, not an edit-drawer):
```vue
<!-- VolunteerCsvImportModal.vue lines 28-33 — centered modal container to copy -->
<div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="onClose">
  <div class="w-full max-w-3xl max-h-[90vh] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col">
```
Shrink `max-w-3xl` down for the small "Add a new quarter" form (UI-SPEC calls it a "small modal/inline form" — year input, quarter select, create button, title "Add a new quarter", CTA "Create quarter", cancel "Don't create").

**Existing modal-wiring pattern to copy for the new modal** (lines 294-299, 449-454):
```vue
<VolunteerCsvImportModal :open="csvModalOpen" :quarter="selectedQuarter" @close="csvModalOpen = false" @imported="onCsvImported" />
```
```typescript
const csvModalOpen = ref(false)
function onCsvImported() { csvModalOpen.value = false }
```
Follow this exact `:open` prop / `@close` emit convention for the new `AddQuarterModal` (or inline `v-if` block, if not extracted to its own SFC).

**Collapsible-section wrapping (R-11, D-17):** the three existing `rounded-lg border border-gray-800 bg-gray-900 p-5 mb-6` cards — "Volunteer Availability" (lines 109-112), "Service dates" (lines 115-...), "Generate controls" (further down, not shown in this excerpt but confirmed to exist by RESEARCH) — each wraps in the new `CollapsibleSection.vue` with a `storageKey` like `schedule.section.volunteerAvailability`. `QuarterGrid` itself (the primary focal point per UI-SPEC) stays outside any `CollapsibleSection`, always visible.

**Share-URL construction pattern (existing, unaffected by this phase's routing addition but relevant context for D-19's slug-guard placement):**
```typescript
// lines 471-472, 480-486
shareUrl.value = quarter?.shareToken ? `${window.location.origin}/quarter-share/${quarter.shareToken}` : null
// onFinalizeAndShare: shareUrl.value = `${window.location.origin}/quarter-share/${token}`
```

---

### `src/views/RosterView.vue` (modify in place — D-07)

**Analog:** itself (grep-verified line ranges — not fully read this session, precise excerpts below from grep hits).

**Section to DELETE entirely (D-04/D-07):**
```vue
<!-- line 326 -->
<label class="block text-xs font-medium text-gray-400 mb-2">Serve frequency by role</label>
<!-- line 335 -->
v-model.number="formRoleFrequencies[role.id]"
```
```typescript
// lines 436-484 — formRoleFrequencies ref, sync watcher, load-on-edit fallback chain, save payload:
const formRoleFrequencies = ref<Record<string, number>>({})
// ...heldRolesSorted watcher keeping formRoleFrequencies in sync (lines 444-457)
// ...loadPerson: formFrequencyN.value = person.frequencyTargetN; formRoleFrequencies.value = ...
// line 502-503 — save payload:
frequencyTargetN: formFrequencyN.value,
roleFrequencies: formRoleFrequencies.value,
```
```typescript
// lines 561-585 — sort-by-frequency column, also DELETE:
function minRoleFrequency(person: Person): number {
  return Math.min(...Object.values(person.roleFrequencies ?? {}), person.frequencyTargetN)
}
```
**Section to KEEP unchanged:** the roles checklist itself (the checkbox list driving `person.roles`) — this remains, and per D-09 the exact same `rosterStore.upsertPeople`/`updatePerson` write path this form already uses becomes the template for `QuarterView.vue`'s new cross-screen roles editor.

---

### `src/views/SettingsView.vue` (modify in place — D-18, R-02)

**Analog:** itself — the existing "Organization Name" field (lines 14-37, 149-208) is the exact template for the new "Share URL slug" field (same section, same save-button/disabled/feedback pattern).

**Field + save pattern to copy verbatim, retarget to slug:**
```vue
<div>
  <label class="block text-xs text-gray-400 mb-1">Organization Name</label>
  <input v-model="editName" type="text" class="w-full sm:w-80 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500" @keydown.enter="onSave" />
</div>
<div class="mt-3 flex items-center gap-3">
  <button type="button" @click="onSave" :disabled="isSaveDisabled" class="... bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 ...">
    {{ isSaving ? 'Saving...' : savedFeedback ? 'Saved!' : 'Save' }}
  </button>
</div>
<p v-if="saveError" class="text-red-400 text-sm mt-2">{{ saveError }}</p>
```
```typescript
// onSave (lines 186-208) — same async/try/catch/finally shape, updateDoc against organizations/{orgId}:
async function onSave() {
  if (isSaveDisabled.value) return
  if (!authStore.orgId) return
  saveError.value = null
  isSaving.value = true
  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { slug: newSlug })
    savedFeedback.value = true
    setTimeout(() => { savedFeedback.value = false }, 2000)
  } catch (err) {
    saveError.value = 'That URL is already taken — try a different one.'  // UI-SPEC copy, per collision case
  } finally {
    isSaving.value = false
  }
}
```
New save path must call `claimSlug()` from `src/utils/slug.ts` (the `orgSlugs` create-only claim), not a raw `updateDoc`, to enforce uniqueness — the `updateDoc(organizations/{orgId})` write for the display field happens only after the claim succeeds. Helper text per UI-SPEC: `"yourapp.com/{slug}/quarter1-2026 — used in every quarterly share link"`.

---

### `firestore.rules` (config, security rules)

**Analog:** the existing `shareTokens` rule block (lines 77-82) — exact posture to mirror for both new collections (RESEARCH Assumption A1, flagged but recommended to match):
```
// Share tokens: public read (anyone with token URL), authenticated create only
match /shareTokens/{token} {
  allow read: if true;
  allow create: if isSignedIn();
  allow update, delete: if false;
}
```
New rules to add (RESEARCH Pattern 3, exact text — `orgSlugs` is create-once/no-update since reassignment abandons rather than reclaims a slug; `quarterShares` allows update because it's overwritten-in-place per finalize, unlike `shareTokens`):
```
match /orgSlugs/{slug} {
  allow read: if true;
  allow create: if isSignedIn();
  allow update, delete: if false;
}
match /quarterShares/{shareId} {
  allow read: if true;
  allow create, update: if isSignedIn();
  allow delete: if false;
}
```
**Placement:** insert both blocks near `shareTokens` (before the catch-all `match /{document=**}` at line 85), not inside the `organizations/{orgId}` match block — these are top-level public collections, same tier as `shareTokens`.

---

## Shared Patterns

### Teleport-to-body slide-out / modal chrome
**Source:** `src/components/AvailabilityDrawer.vue` (lines 1-31, right-slide-out) and `src/components/VolunteerCsvImportModal.vue` (lines 1-33, centered modal)
**Apply to:** `QuarterGrid.vue`'s new group-cell slide-out (right-slide-out variant — reuse `AvailabilityDrawer`'s exact classes) and `QuarterView.vue`'s new "Add quarter" modal (centered variant — reuse `VolunteerCsvImportModal`'s exact classes). Do not invent a third visual language for either (UI-SPEC explicit constraint).
```vue
<Teleport to="body">
  <Transition enter-active-class="transition-opacity duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="open" class="fixed inset-0 z-40 bg-black/60" @click="onClose"></div>
  </Transition>
  <!-- right-slide-out: fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-gray-900 border-l border-gray-700 shadow-2xl -->
  <!-- centered modal: fixed inset-0 z-50 flex items-center justify-center p-4 -->
</Teleport>
```

### Firestore scoped dot-path writes (never whole-map replace)
**Source:** `src/stores/quarters.ts::setPersonAvailability` (lines 169-228), `assignPerson`/`clearAssignment`/`swapAssignment` (lines 274-319)
**Apply to:** any new write to `PersonQuarterData.roleFrequency`, and the new `quarterShares`/`orgSlugs` writes — always scope the Firestore field path to the smallest touched subtree (`personQuarterData.${personId}`, `calendar.${date}.${roleId}`), never `updateDoc(..., { personQuarterData: wholeMap })`.

### Public read-only page — no store imports (D-24)
**Source:** `src/views/QuarterShareView.vue` (verified: imports only `vue`, `vue-router`, `firebase/firestore`, `@/firebase` — zero `@/stores/*` imports)
**Apply to:** `QuarterShareView.vue`'s extensions (matrix, filter) and the new `QuarterShareMatrix.vue` — both must derive 100% of their data from the already-fetched `quarterSnapshot` ref, never touch `rosterStore`/`quartersStore`/`authStore`.

### URL query-param persistence via `router.replace`
**Source:** `src/views/SongsView.vue` (lines 291-296)
**Apply to:** `QuarterShareView.vue`'s view-mode + name-filter persistence (D-16) — spread existing `route.query`, never blow away unrelated params, and use `router.replace` (not `push`) so filter keystrokes don't pollute browser history.

### Typeahead dropdown (text input + absolute-positioned filtered list)
**Source:** `src/components/AvailabilityDrawer.vue` "Must serve with" control (lines 179-201)
**Apply to:** `QuarterShareView.vue`'s name filter (D-15) — same `@focus`/`@blur` with `window.setTimeout(150)` debounce structure, adapted to light theme per UI-SPEC.

### Static Tailwind class maps (purge safety)
**Source:** `src/components/QuarterGrid.vue` `groupHeaderBg`/`GROUP_ORDER` (lines 208-215), `AvailabilityDrawer.vue` `PRESET_ON_CLASS`/`PRESET_OFF_CLASS` (lines 289-296)
**Apply to:** any new dynamic-class UI in this phase (matrix cells, `CollapsibleSection` chevrons, view-toggle active state) — always a `Record<key, string>` literal, never a dynamically-constructed class string (Tailwind v4 purge requirement, called out explicitly in RESEARCH standard-stack notes and UI-SPEC).

---

## No Analog Found

None — every file in scope has at least a role-match analog. The two lowest-confidence mappings are:

| File | Role | Data Flow | Reason for lower confidence |
|------|------|-----------|-------------------------------|
| `src/utils/slug.ts` | utility | transform | No existing "derive + claim-with-retry" utility exists in this codebase; composited from `finalizeAndShare`'s random-token pattern + the create-only rules semantics rather than a single direct analog. Follow RESEARCH.md Pattern 3's code exactly (it is the authoritative design, already vetted). |
| `src/components/QuarterShareMatrix.vue` | component | transform, read-only | New component with no single existing analog; composited from `QuarterGrid.vue` (orientation) + `QuarterShareView.vue` (theme/data-access convention). Two source files must both be honored simultaneously — flagged so the planner doesn't treat either as the sole source of truth. |

## Metadata

**Analog search scope:** `src/components/`, `src/views/`, `src/stores/`, `src/utils/`, `src/router/`, `src/types/`, `firestore.rules`, plus test-file siblings in each directory's `__tests__/`.
**Files scanned (full or targeted reads this session):** `16-CONTEXT.md`, `16-RESEARCH.md`, `16-UI-SPEC.md`, `AvailabilityDrawer.vue`, `QuarterGrid.vue`, `QuarterShareView.vue`, `quarters.ts` (store), `router/index.ts`, `ArrangementAccordion.vue`, `types/roster.ts`, `scheduler.ts`, `firestore.rules`, `SettingsView.vue`, `SongsView.vue` (grep), `RosterView.vue` (grep), `QuarterView.vue` (partial read + grep), `stores/auth.ts` (grep), `rules.test.ts` (grep), `AvailabilityRosterTable.vue` (grep), `VolunteerCsvImportModal.vue` (partial), `ShareView.test.ts` (partial), directory listing of `__tests__/`.
**Pattern extraction date:** 2026-07-10
