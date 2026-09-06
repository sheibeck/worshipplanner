# Phase 126: My Schedule — Volunteer Home - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 12
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/utils/rehearseAccess.ts` (EDIT — add `rolesByEmailLower`) | utility | transform | `functions/src/serviceRoles.ts` (`roleNamesByPerson` map) | exact |
| `firestore.rules` (EDIT — add constrained `list` arm to `rehearseAccess`) | config/security | request-response | `firestore.rules:412-450` `shareTokens` get/list split | exact |
| `firestore.indexes.json` (EDIT — add COLLECTION_GROUP index) | config | batch | `firestore.indexes.json` existing `fieldOverrides` entry (`recipients`/`providerMessageId`) | role-match (only existing index-shaped entry in the file) |
| `src/rules.test.ts` (EDIT — add R378 constrained-list describe block) | test | request-response | `src/rules.test.ts:2702-2828` R377 `describe` block | exact |
| `src/stores/mySchedule.ts` (NEW) | store | CRUD (read-only query) | `src/utils/rehearseAccess.ts` + `src/stores/services.ts` `markAsPlanned` call-site (query construction convention) | role-match |
| `src/utils/myScheduleGrouping.ts` (NEW) | utility | transform | `src/views/ServicesView.vue:229-271` (`todayStr`/upcoming/past date-string idiom) | exact |
| `src/utils/myScheduleGrouping.test.ts` (NEW) | test | transform | `src/utils/rehearseAccess.test.ts` (pure-function unit-test shape) | role-match |
| `src/utils/rehearseAccess.test.ts` (EDIT — extend for `rolesByEmailLower`) | test | transform | same file, existing tests | exact |
| `src/views/MyScheduleView.vue` (NEW) | component/view | request-response | `src/views/ServicesView.vue` (tab-less variant) + `src/views/VolunteerSignInView.vue` (dark shell, user chip) | role-match |
| `src/views/__tests__/MyScheduleView.test.ts` (NEW) | test | request-response | existing `src/views/__tests__/*.test.ts` component-test shape | role-match |
| `src/views/VolunteerServicePlaceholderView.vue` (NEW) | component/view | request-response | `src/views/VolunteerLinkCompleteView.vue` (dark shell + spinner-or-message idiom) | exact |
| `src/router/index.ts` (EDIT — add `/my-schedule` + `/volunteer/service/:serviceId` routes) | route | request-response | `src/router/index.ts:154-172` (`volunteer-verify`/`volunteer-home` route entries) | exact |
| Card sub-component (e.g. `src/components/ScheduleServiceCard.vue`, NEW, optional split) | component | request-response | `src/components/ServiceCard.vue` (whole-card-is-one-router-link pattern) | role-match |
| Role-chip icon mapping (`src/utils/roleChipIcon.ts`, NEW) | utility | transform | `src/components/stage/StageKindIcon.vue` (glyph name inventory to target) | role-match |

## Pattern Assignments

### `src/utils/rehearseAccess.ts` (utility, transform) — EDIT

**Analog:** `functions/src/serviceRoles.ts` lines 118-164 (`resolveMessageRecipients`'s `roleNamesByPerson` map), consumed by this same file already (`resolveServiceRoleAssignments` import at line 10).

**Existing schema to extend** (`src/utils/rehearseAccess.ts:30-38`):
```typescript
export interface RehearseAccessDoc {
  serviceId: string
  orgId: string
  serviceDate: string
  title: string
  status: string
  assignedEmailsLower: string[]
  songs: RehearseSong[]
}
```

**Map-building pattern to port** (`functions/src/serviceRoles.ts:124-144`):
```typescript
const roleNamesByPerson = new Map<string, string[]>();
const ensure = (pid: string): string[] => {
  let names = roleNamesByPerson.get(pid);
  if (!names) { names = []; roleNamesByPerson.set(pid, names); }
  return names;
};
for (const a of assignments) {
  for (const pid of a.effectivePersonIds) {
    const names = ensure(pid);
    if (!names.includes(a.roleName)) names.push(a.roleName);
  }
}
```

**Apply as** (mirrors the existing `assignedEmailsLower` loop right below it at `rehearseAccess.ts:79-84`, keyed by lowercased email instead of personId):
```typescript
const rolesByEmailLower: Record<string, string[]> = {}
for (const a of assignments) {
  for (const pid of a.effectivePersonIds) {
    const person = peopleById.get(pid)
    if (!person || person.email === '') continue
    const emailLower = person.email.toLowerCase()
    ;(rolesByEmailLower[emailLower] ??= []).push(a.roleName)
  }
}
```
Add `rolesByEmailLower: Record<string, string[]>` to `RehearseAccessDoc` and to the object returned at the bottom of `buildRehearseAccess` (currently lines 106-114).

---

### `firestore.rules` (security config) — EDIT: constrained `list` arm on `rehearseAccess`

**Analog:** `firestore.rules:412-450`, the `shareTokens` get/list split — the exact "equality filter on any field a list rule reads from resource.data" idiom this phase must replicate for `array-contains`.

**Existing `rehearseAccess` match block to extend** (`firestore.rules:277-313`):
```javascript
match /rehearseAccess/{serviceId} {
  function parentIsPlanned() {
    return exists(/databases/$(database)/documents/organizations/$(orgId)/services/$(serviceId))
      && get(/databases/$(database)/documents/organizations/$(orgId)/services/$(serviceId))
           .data.get('status', 'draft') != 'draft';
  }

  allow read: if isOrgMember(orgId)
    || (
      isSignedIn()
      && request.auth.token.email != null
      && request.auth.token.email_verified == true
      && parentIsPlanned()
      && request.auth.token.email.lower() in resource.data.get('assignedEmailsLower', [])
    );

  allow write: if isOrgEditor(orgId);
}
```
NOTE: `allow read` covers `get` only implicitly for a doc-path rule; a `collectionGroup` query needs an explicit `allow list` (Firestore does not grant `list` from a bare `allow read` when the request is a collection-group query — confirm during planning/implementation whether `read` already covers `list` for this rule shape, or an explicit `allow list:` clause mirroring `shareTokens`'s split is required). Model the split exactly on:
```javascript
// shareTokens' inline rationale comment, firestore.rules:430-432, to copy verbatim in spirit:
// "every call site is required to add where('field','==',value) to its query so this
// resource.data check is satisfiable (Firestore requires an equality filter on any field
// a list rule reads from resource.data)."
allow list: if isOrgMember(orgId)
  || (
    isSignedIn()
    && request.auth.token.email != null
    && request.auth.token.email_verified == true
    && parentIsPlanned()
    && request.auth.token.email.lower() in resource.data.get('assignedEmailsLower', [])
  );
```
The existing unfiltered-list DENY test is `src/rules.test.ts:2816-2820` — do not assume it proves the constrained case (Research Pitfall 1).

---

### `firestore.indexes.json` (config) — EDIT: add COLLECTION_GROUP composite index

**Analog:** the file's only existing shaped entry (its `fieldOverrides` block) — confirms the file's real, currently-empty `indexes: []` array is where the new entry belongs:
```json
{
  "indexes": [],
  "fieldOverrides": [ /* existing, unrelated to this phase */ ]
}
```

**Add** (per RESEARCH Pattern 2, cross-checked against `cloud.google.com/firestore/docs/query-data/indexing` — verify `arrayConfig: "CONTAINS"` key name at deploy time per Assumption A4):
```json
{
  "indexes": [
    {
      "collectionGroup": "rehearseAccess",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "assignedEmailsLower", "arrayConfig": "CONTAINS" },
        { "fieldPath": "serviceDate", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": [ /* unchanged */ ]
}
```

---

### `src/rules.test.ts` (test) — EDIT: add R378 constrained-list `describe` block

**Analog:** `src/rules.test.ts:2695-2828`, the entire R377 `describe('Volunteer magic-link scoped read access — R377', ...)` block — same fixture-seeding style, same `testEnv.authenticatedContext(uid, { email, email_verified })` idiom.

**Imports already present** (`src/rules.test.ts:4-9`, no new imports needed beyond what's already imported):
```typescript
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, writeBatch, getDocs, collection, query, where } from 'firebase/firestore'
```
`collectionGroup` and `orderBy` are NOT yet imported in this file — add both to the existing `firebase/firestore` import line.

**Existing seed helper to extend with a second org** (`src/rules.test.ts:2703-2732`, `seedRehearseFixtures()`):
```typescript
await seedDoc('organizations/orgA/services/svc1', { status: 'planned' })
await seedDoc('organizations/orgA/rehearseAccess/svc1', {
  serviceId: 'svc1', orgId: 'orgA', assignedEmailsLower: ['dana@example.com'],
})
```
Add a second org (e.g. `orgB/svcOrgB`) with the same email assigned, to prove cross-org `collectionGroup` aggregation (RESEARCH Code Examples' test skeleton).

**Existing unfiltered-list DENY test to keep as-is, and NOT treat as sufficient** (`src/rules.test.ts:2816-2820`):
```typescript
it('(8) DENY — a volunteer cannot run an unfiltered list() over rehearseAccess (enumeration)', async () => {
  await seedRehearseFixtures()
  const db = testEnv.authenticatedContext('volUid', { email: 'Dana@Example.com' }).firestore()
  await assertFails(getDocs(collection(db, 'organizations', 'orgA', 'rehearseAccess')))
})
```
New tests go in a new `describe` block per RESEARCH's Code Examples section (ALLOW constrained cross-org list; empty snapshot for unassigned email; DENY for a Draft-service doc reached via the list path).

---

### `src/stores/mySchedule.ts` (store) — NEW

**Analog (query construction/auth-current-user idiom):** `src/utils/rehearseAccess.ts` (the `assignedEmailsLower` lowercase-and-skip-empty convention) + the general Pinia-store-with-`getDocs` convention used across `src/stores/*.ts`.

**Core query pattern** (from RESEARCH Pattern 1, grounded in `firestore.rules:277-313`):
```typescript
import { collectionGroup, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db, auth } from '@/firebase'

const myEmailLower = auth.currentUser!.email!.toLowerCase() // Pitfall 2: always .toLowerCase()
const q = query(
  collectionGroup(db, 'rehearseAccess'),
  where('assignedEmailsLower', 'array-contains', myEmailLower),
  orderBy('serviceDate', 'asc'),
)
const snap = await getDocs(q)
```

---

### `src/utils/myScheduleGrouping.ts` (utility, transform) — NEW

**Analog:** `src/views/ServicesView.vue:229-249`, the plain browser-local date-string idiom (zero-padded, no date library) — the codebase convention this phase must match per Research Pitfall 4/Don't Hand-Roll.

**Pattern to copy verbatim (extend, don't replace):**
```typescript
// Source: src/views/ServicesView.vue:229-235
const todayStr = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})
// Source: src/views/ServicesView.vue:238-249 — upcoming/past split convention
const upcomingServices = computed(() =>
  serviceStore.services.filter((s) => s.date >= todayStr.value).sort((a, b) => a.date.localeCompare(b.date)),
)
const pastServices = computed(() =>
  serviceStore.services.filter((s) => s.date < todayStr.value).sort((a, b) => b.date.localeCompare(a.date)),
)
```
Extend into `groupMySchedule`/`todayYmd`/`endOfThisWeekYmd`/`readinessOf` exactly as specified in RESEARCH.md's Pattern 3 and Code Examples sections (already fully worked out there — copy those function bodies directly).

---

### `src/views/MyScheduleView.vue` (view) — NEW

**Analogs:**
1. `src/views/ServicesView.vue:1-100` — loading state (`text-sm text-gray-400 py-8 text-center`, "Loading services..."), section-header pattern (`text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3`), empty-state shell (`rounded-lg border border-dashed border-gray-700 py-10 text-center`).
2. `src/views/VolunteerSignInView.vue:1-140` — dark full-page shell (`min-h-screen bg-gray-950`), user-chip avatar formula (`w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-medium text-white`), `displayLabel`/`initials` computeds, `handleSignOut` calling `volunteerAuth.signOut()`.

**Loading state to copy** (`src/views/ServicesView.vue:73-75`):
```html
<div v-if="serviceStore.isLoading" class="text-sm text-gray-400 py-8 text-center">
  Loading services...
</div>
```
Adapt copy to "Loading your schedule…" per UI-SPEC §10.

**Empty-state shell to copy** (`src/views/ServicesView.vue:84-94`):
```html
<div v-if="upcomingServices.length === 0" class="rounded-lg border border-dashed border-gray-700 py-10 text-center">
  <p class="text-sm text-gray-400 mb-3">No upcoming services. Create your first service to get started.</p>
  <button ...>New Service</button>
</div>
```
Adapt to UI-SPEC §8's copy/CTA ("No services on your schedule yet" / "Check a different email").

**Avatar/greeting-name extraction — reuse `displayLabel`'s pattern but NOT its output** (`src/views/VolunteerSignInView.vue:105-118`, and Research Pitfall 5): `displayLabel` returns `"Dana R."`, not a bare first name. For the greeting, extract `name.split(/\s+/)[0]` directly instead of reusing `displayLabel`'s return value; keep `displayLabel`/`initials` verbatim for the user-chip label (top bar), where "Dana R." is the correct amount of detail.

**Sign-out call to reuse verbatim** (`src/views/VolunteerSignInView.vue:125-132`):
```typescript
async function handleSignOut(): Promise<void> {
  isSigningOut.value = true
  try {
    await volunteerAuth.signOut()
  } finally {
    isSigningOut.value = false
  }
}
```

---

### `src/views/VolunteerServicePlaceholderView.vue` (view) — NEW

**Analog:** `src/views/VolunteerLinkCompleteView.vue:1-17` — dark shell + spinner-or-message idiom.

**Shell + spinner to reuse (adapt, not a spinner state — a static message state):**
```html
<div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-semibold text-white tracking-tight">Worship Planner</h1>
      <p class="text-sm text-gray-400 mt-1">Rehearse view coming soon</p>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5">
      <p class="text-sm text-gray-400">This service's Rehearse view is coming soon.</p>
      <router-link to="/my-schedule" class="text-sm text-indigo-400 hover:text-indigo-300">Back to My Schedule</router-link>
    </div>
  </div>
</div>
```
Spinner SVG, if a loading phase is added later, reuse verbatim from `VolunteerLinkCompleteView.vue:12-14`.

---

### `src/router/index.ts` (route config) — EDIT

**Analog:** `src/router/index.ts:154-172`, the `volunteer-verify`/`volunteer-home` route entries — exact shape and `meta.isVolunteerRoute` idiom to replicate.

```typescript
// Copy shape verbatim from src/router/index.ts:163-172
{
  path: '/my-schedule',
  name: 'my-schedule',
  component: () => import('../views/MyScheduleView.vue'),
  meta: { requiresAuth: true, isVolunteerRoute: true },
},
{
  // Phase 126: minimal placeholder. Phase 127 REPLACES this import target
  // only — path/name/meta stay stable (RESEARCH Pattern 4).
  path: '/volunteer/service/:serviceId',
  name: 'volunteer-service',
  component: () => import('../views/VolunteerServicePlaceholderView.vue'),
  meta: { requiresAuth: true, isVolunteerRoute: true },
},
```
Also update the `volunteer-home` redirect target (`src/router/index.ts:278`, `isVolunteerRoute` exemption at line 216) if My Schedule should replace `volunteer-home` as the post-sign-in landing — confirm during planning whether `/volunteer` itself redirects to `/my-schedule` once assigned, or `/my-schedule` is a new separate destination.

---

### Card component (`ServiceCard`-style split, optional) — analog only

**Analog:** `src/components/ServiceCard.vue:1-4,39` — the "whole card is one `<router-link>`, action buttons live OUTSIDE it with `@click.stop`" pattern:
```html
<router-link :to="'/services/' + service.id" class="block flex-1 min-h-0 px-3 py-2.5">
  <!-- card body -->
</router-link>
<div class="shrink-0 flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-800/50">
  <button @click.stop="onShare">...</button>
</div>
```
UI-SPEC §4 explicitly wants the **entire card** (including the visible "Rehearse →" label) as ONE link, not a nested button — so unlike `ServiceCard.vue`'s footer-buttons-outside-the-link pattern, My Schedule's card wraps everything in a single `<router-link>`/`<a>` per the UI-SPEC's own anatomy note ("never a link nested inside a link/button"). Use `ServiceCard.vue` only for the "literal path string navigation + one router-link" convention, not for its outside-the-link action-footer structure.

---

### `src/utils/roleChipIcon.ts` (utility, transform) — NEW

**Analog:** `src/components/stage/StageKindIcon.vue:1-60` — the glyph-name inventory this new keyword-matcher must target (`mic-stage`, `mic`, `users`, `guitar`, `piano`, `drum`, ...), reused as the icon COMPONENT as-is; only the keyword-to-glyph-name mapping function is new.
```html
<!-- StageKindIcon.vue usage (existing component, reuse unmodified) -->
<StageKindIcon :name="roleChipIcon(role.name)" class="h-3.5 w-3.5 text-gray-400" />
```
New file just returns a glyph-name string per UI-SPEC's Icon Inventory keyword table (`"guitar"`/`"bass"`→`guitar`, `"key"`/`"piano"`→`piano`, `"drum"`→`drum`, `"vocal"`/`"vox"`/`"sing"`→`mic`, `"strings"`/`"violin"`→`strings`, `"sound"`/`"tech"`→`speaker`, else→`music`).

## Shared Patterns

### Browser-local date math (no date library)
**Source:** `src/views/ServicesView.vue:229-249`
**Apply to:** `src/utils/myScheduleGrouping.ts`, any countdown/grouping logic in `MyScheduleView.vue`
```typescript
const y = now.getFullYear()
const m = String(now.getMonth() + 1).padStart(2, '0')
const d = String(now.getDate()).padStart(2, '0')
return `${y}-${m}-${d}`
```
Never introduce `dayjs`/`date-fns`/`luxon` — confirmed zero date-library dependency in `src/` today.

### Volunteer route registration (`meta.isVolunteerRoute`)
**Source:** `src/router/index.ts:154-172`
**Apply to:** both new routes (`/my-schedule`, `/volunteer/service/:serviceId`)
```typescript
meta: { requiresAuth: true, isVolunteerRoute: true }
```
This meta flag exempts a zero-membership volunteer session from the org-selection redirect gate (`src/router/index.ts:216`).

### Lowercased-email normalization, on every side
**Source:** `src/utils/rehearseAccess.ts:79-84` (write side), `firestore.rules:305` (rule side), `VolunteerSignInView.vue:138` (client-remember side)
**Apply to:** the `mySchedule.ts` store's query-filter construction — always `.toLowerCase()` on `auth.currentUser.email` before using it as an `array-contains` value (Research Pitfall 2).

### Build-safe forward routing to an unbuilt future phase's component
**Source:** `src/router/index.ts` conventions + CONTEXT.md's explicit constraint
**Apply to:** the `/volunteer/service/:serviceId` route — register a REAL route pointed at a real (minimal) placeholder component this phase; never a lazy `import()` targeting a Phase-127 file that doesn't exist on disk yet.

### Dark volunteer-surface shell
**Source:** `src/views/VolunteerSignInView.vue:1-9`, `src/views/VolunteerLinkCompleteView.vue:1-9`
**Apply to:** `MyScheduleView.vue`, `VolunteerServicePlaceholderView.vue`
```html
<div class="min-h-screen bg-gray-950 ...">
  <div class="... max-w-sm">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-semibold text-white tracking-tight">Worship Planner</h1>
      <p class="text-sm text-gray-400 mt-1">...</p>
    </div>
    <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5">...</div>
  </div>
</div>
```
(My Schedule itself is wider — UI-SPEC's `max-w-[1060px]` container — but the color/border/shadow tokens are identical to this shell.)

## No Analog Found

None — every file in this phase has at least a role-match analog already in the codebase. The one genuinely novel mechanism (a constrained `collectionGroup` `list` query against an existing rule) has no *passing-test* precedent yet, but has a directly-applicable *pattern* precedent (`shareTokens`' get/list split) — tracked as the phase's Wave-0 risk in RESEARCH.md, not as a missing analog.

## Metadata

**Analog search scope:** `src/`, `functions/src/`, `firestore.rules`, `firestore.indexes.json`, `src/rules.test.ts`, `.planning/phases/125-*`
**Files scanned:** `src/utils/rehearseAccess.ts`, `functions/src/serviceRoles.ts`, `firestore.rules` (rehearseAccess + shareTokens blocks), `firestore.indexes.json`, `src/rules.test.ts` (R377 block), `src/views/ServicesView.vue`, `src/components/ServiceCard.vue`, `src/views/VolunteerSignInView.vue`, `src/views/VolunteerLinkCompleteView.vue`, `src/router/index.ts`, `src/components/stage/StageKindIcon.vue`
**Pattern extraction date:** 2026-09-06
