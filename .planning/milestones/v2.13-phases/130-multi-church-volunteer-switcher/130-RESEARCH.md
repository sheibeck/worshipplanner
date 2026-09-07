# Phase 130: Multi-Church Volunteer Switcher - Research

**Researched:** 2026-09-06
**Domain:** Internal codebase extension (Vue 3 + Pinia + Firestore) — no new external libraries
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **`orgName` on the projection:** add `orgName` to the `rehearseAccess` projection so a zero-membership
  volunteer can label churches WITHOUT reading `organizations/{orgId}` (which membership rules forbid).
  Add it in `src/utils/rehearseAccess.ts` `buildRehearseAccess` (+ its `RehearseAccessDoc` type), and
  ensure it's written by BOTH write paths that call it: `markAsPlanned` and `resyncRehearseAccessForSong`
  (src/stores/services.ts). `buildRehearseAccess` currently receives `orgId` but not the org name — pass
  the org name through from the caller (authStore.orgName at write time).
  - **Existing-doc caveat (like the readiness resync):** already-Planned services' `rehearseAccess` docs
    won't have `orgName` until re-projected (re-lock, or a song-file change triggers the resync). My
    Schedule must DEGRADE GRACEFULLY when `orgName` is absent (fall back to a neutral label, never crash).
    Flag a possible one-time backfill for the batched UAT.
- **My Schedule church switcher/filter (R403/R404/R405):** the `mySchedule` store already aggregates the
  volunteer's `rehearseAccess` docs across every church (collectionGroup by email). Derive the DISTINCT
  churches (orgId → orgName) from those docs. Add a volunteer-local `selectedChurch` filter (default: all,
  or the only church). Show the switcher/filter ONLY when the volunteer has >1 distinct church (R405: a
  single-church volunteer sees no switcher — unchanged). It is a FILTER over already-loaded docs, NOT a
  data-scope switch — it is DISTINCT from AppSidebar's admin membership switcher and MUST NEVER call
  `selectOrg` / touch `authStore` org context (volunteers have zero memberships).
- **Selected church carries into the volunteer service view (R404):** when a volunteer opens a service from
  a filtered My Schedule, the church context (name) is consistent.
- **Volunteer sidebar church-name label (LIVE-UAT ADDITION, owner 2026-09-06):** when signed in as a
  volunteer (zero membership — only the "My Schedule" nav item shows), the church name must appear in the
  AppSidebar org-name slot, JUST LIKE it does for an admin (AppSidebar.vue:16-27 shows `authStore.orgName`).
  For a volunteer that slot is currently empty (no membership → no `orgName`). Source it from the
  volunteer's `mySchedule` context: the SELECTED church (multi) or the ONLY church (single). Must not
  disturb the admin path (which keeps using `authStore.orgName`).

### Claude's Discretion

- Fallback label text when `orgName` is absent on an older/un-resynced projection doc (e.g. "Your church").
- Whether to persist the volunteer's selected church for the session (e.g. `localStorage`) — optional,
  nice-to-have per the owner.
- Whether `ScheduleServiceCard` shows a per-card church badge when the "All churches" filter is active
  (not explicitly required by R403–R405, but improves the multi-church "All" view).
- Exact sidebar label shown for a multi-church volunteer who has not yet picked a specific church (the
  filter defaults to "all"). See Open Questions below — this repo does not yet have a precedent for this
  exact state.

### Deferred Ideas (OUT OF SCOPE)

- One-time backfill of `orgName` onto existing `rehearseAccess` docs (surface for batched UAT; not required
  for the feature to work on newly-locked/re-synced services).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R403 | A volunteer serving at >1 church sees a church switcher/filter on My Schedule, distinct from the admin membership switcher, never calls `selectOrg` | See "Distinct-Church Derivation + Filter" pattern below — client-side filter over `mySchedule.docs`, new `selectedChurchId` ref, gated on `distinctChurches.length > 1` |
| R404 | The switcher labels each church by name sourced from a new `orgName` field on the `rehearseAccess` projection (no org-doc read); selected-church context carries into the volunteer service view | See "orgName on the Projection" (both write paths) + "Carrying Context into VolunteerServiceView" below |
| R405 | A single-church volunteer sees no switcher — unchanged experience | `distinctChurches.length <= 1` gate; verified via existing `mySchedule.test.ts` / new `MyScheduleView.test.ts` cases |
</phase_requirements>

## Summary

This phase is a pure internal-codebase extension — no new npm packages, no new Firestore rules, no new
endpoints. It threads one new field (`orgName`) through an existing, well-understood projection pipeline
(`buildRehearseAccess` → `rehearseAccess/{serviceId}` → `mySchedule` collectionGroup aggregation → My
Schedule UI), then adds a client-side-only filter on top of already-authorized data. The two write paths
that call `buildRehearseAccess` (`markAsPlanned` in the service editor and `resyncRehearseAccessForSong`
on the Songs page) resolve the org name from two different sources — `authStore.orgName` (already loaded,
free) for the former, and a fresh `getDoc(organizations/{orgId})` (confirmed allowed for any org member,
including the editor who owns a Songs-page attachment edit) for the latter, since that resync path
deliberately avoids the org-scoped Pinia stores.

The switcher itself must NOT reuse `AppSidebar`'s existing multi-org admin switcher (`hasSwitcher` /
`selectOrg`) — that mechanism re-subscribes org-scoped stores via `authStore.selectOrg()`, which assumes a
`memberships` array a volunteer will never have (volunteers hold zero organization memberships; their
Firestore access is entirely via the `assignedEmailsLower` array-contains rule arm). The correct pattern is
a `computed`-derived distinct-church list and a local `ref<string | null>` filter inside `mySchedule.ts`,
filtering the store's own already-loaded `docs` array — zero additional Firestore reads.

The trickiest design decision is not technical but UX: what does the `AppSidebar` org-name slot show for a
multi-church volunteer who has NOT picked a specific church (filter defaults to "all")? The owner's
decision text says "the SELECTED church (multi) or the ONLY church (single)" — this implies the sidebar
has nothing to show until a selection is made in the multi-church, no-selection state. Recommendation:
render a neutral plural label ("Multiple churches") in that one gap state, matching the existing
"Super Admin · not in a church" fallback-text convention already in `AppSidebar.vue`.

**Primary recommendation:** Add `orgName?: string` to `RehearseAccessDoc` (optional — old docs won't have
it), thread it through both write paths, derive `distinctChurches` + add a `selectedChurchId` ref +
`filteredDocs` computed to `mySchedule.ts`, gate the switcher UI in `MyScheduleView.vue` on
`distinctChurches.length > 1`, and extend `AppSidebar.vue`'s existing `v-if="authStore.orgName || ..."`
block with a new volunteer-only branch reading from `useMyScheduleStore()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `orgName` projection (write) | API/Backend equivalent — client-side store action (`services.ts`), no Cloud Function | Database/Storage (Firestore write) | This codebase writes Firestore directly from authenticated client stores for editor-owned collections (no Cloud Function boundary for `rehearseAccess`); matches the existing `writeRehearseAccessDoc` pattern exactly. |
| Distinct-church derivation + filter | Frontend Server-equivalent — Pinia store (`mySchedule.ts`) | Browser/Client (Vue reactivity consumes it) | Derivation is pure computed state over already-loaded docs; belongs in the store per this codebase's existing "derived state lives in the store, formatting lives in the view" convention (see `groupMySchedule`/`readinessOf` in `myScheduleGrouping.ts`, consumed by `MyScheduleView.vue`). |
| Switcher UI | Browser / Client | — | `MyScheduleView.vue` template, mirrors the existing "This week / Later this month / Past" grouped-render pattern. |
| Sidebar church-name label | Browser / Client | Frontend Server-equivalent (Pinia store read) | `AppSidebar.vue` is a pure presentational component reading two stores (`authStore`, now also `mySchedule` store) — no new tier boundary crossed. |
| Volunteer service view context | Browser / Client | Database/Storage (`getDoc` re-check, unchanged) | `useVolunteerServiceDoc.ts`'s existing fresh-`getDoc` flow already returns the full `RehearseAccessDoc`, which will now include `orgName` for free — no new read path needed. |

## Standard Stack

No new libraries. This phase extends existing project code only:

| Concern | Existing Tool | Notes |
|---------|---------------|-------|
| Reactive store state | Pinia (Composition API stores, `defineStore` with `ref`/`computed`) | Same pattern as `mySchedule.ts` today |
| Firestore reads/writes | `firebase/firestore` (`getDoc`, `setDoc`, `collectionGroup`) | Same SDK calls already in `services.ts` / `mySchedule.ts` |
| Component testing | Vitest + `@vue/test-utils`, module-scope `vi.mock('@/stores/...')` getter pattern | Same pattern as `AppSidebar.test.ts` / `mySchedule.test.ts` |

**No installation required.** No `Package Legitimacy Audit` section is produced — this phase does not
introduce any external package.

## Architecture Patterns

### System Architecture Diagram

```
[Editor locks service]              [Editor edits song attachment on Songs page]
        |                                          |
        v                                          v
  markAsPlanned()                     resyncRehearseAccessForSong(songId)
  (services.ts)                       (services.ts — direct getDocs, no
        |                              org-scoped stores subscribed here)
        | authStore.orgName                        |
        | (already loaded,                         | NEW: getDoc(organizations/{orgId})
        |  zero extra reads)                        |      .then(d => d.data().name)
        v                                          v
        +-------------------+   +-------------------+
                            |   |
                            v   v
                writeRehearseAccessDoc(service, org, orgName, ...)
                            |
                            v
              buildRehearseAccess(...) NOW returns
              RehearseAccessDoc { ..., orgName? }
                            |
                            v
        setDoc organizations/{orgId}/rehearseAccess/{serviceId}
                            |
                            v
        [Volunteer signs in — zero org memberships]
                            |
                            v
        mySchedule.loadMySchedule()
        collectionGroup('rehearseAccess')
          .where(status=='planned')
          .where(assignedEmailsLower array-contains myEmailLower)
                            |
                            v
              mySchedule.docs: MyScheduleDoc[]   (each now carries orgName?)
                            |
              +-------------+--------------------+
              |                                   |
              v                                   v
   distinctChurches computed              filteredDocs computed
   (dedupe by orgId, pick first            (all docs, or docs whose
    non-null orgName per orgId)             orgId === selectedChurchId)
              |                                   |
              v                                   v
   MyScheduleView.vue switcher UI        groupMySchedule(filteredDocs)
   (rendered only if                     -> This week / Later / Past
    distinctChurches.length > 1)                  |
              |                                   v
              v                        ScheduleServiceCard -> router-link
   selectedChurchId ref (mySchedule     -> /volunteer/service/:serviceId
   store) <---------------------------- (user clicks a card)
              |                                   |
              v                                   v
   AppSidebar.vue reads mySchedule       useVolunteerServiceDoc.ts
   store: shows selected/only            (unchanged — fresh getDoc already
   church name in the org-name slot      returns the full doc, orgName
   (only when authStore.orgName          included for free)
   is absent — volunteer session)                 |
                                                    v
                                        VolunteerServiceView.vue
                                        (doc.orgName available for
                                        header display — R404 "carries")
```

### Recommended Project Structure

No new files/folders. Edits land in:
```
src/
├── utils/
│   ├── rehearseAccess.ts        # RehearseAccessDoc.orgName + buildRehearseAccess param
│   └── rehearseAccess.test.ts   # extend for orgName presence/absence
├── stores/
│   ├── services.ts              # writeRehearseAccessDoc, markAsPlanned, resyncRehearseAccessForSong
│   ├── services.test.ts         # extend: orgName threaded on both write paths
│   ├── mySchedule.ts            # distinctChurches, selectedChurchId, filteredDocs
│   └── __tests__/mySchedule.test.ts  # extend for derivation + filter
├── views/
│   ├── MyScheduleView.vue       # switcher UI, gated on distinctChurches.length > 1
│   └── __tests__/MyScheduleView.test.ts (new, or extend if one exists)
├── components/
│   ├── AppSidebar.vue           # volunteer church-name branch
│   └── __tests__/AppSidebar.test.ts  # extend for volunteer/zero-membership case
└── views/
    └── VolunteerServiceView.vue # optional: surface doc.orgName near title
```

### Pattern 1: Optional field with graceful two-sided degradation

**What:** `orgName` is added as an OPTIONAL field (`orgName?: string`) on `RehearseAccessDoc`, not a
required one. Every reader must treat its absence as a normal, expected state (older docs, pre-resync),
never an error.

**When to use:** Any time a new field is added to a frozen-at-write-time Firestore projection that already
has documents in production before the schema change ships (same category of change as R381's
`rolesByEmailLower` or R385/R386's `bpm` — both landed as additive, optional fields on this exact doc type
in earlier phases; follow their precedent, don't re-derive a new pattern).

**Example:**
```typescript
// Source: src/utils/rehearseAccess.ts (existing precedent — bpm resolution,
// optional stageLayout) extended for orgName
export interface RehearseAccessDoc {
  serviceId: string
  orgId: string
  orgName?: string   // NEW — absent on pre-Phase-130 docs; never assume present
  // ...
}

// Consumer-side degradation (mySchedule.ts distinctChurches derivation):
const label = doc.orgName ?? 'Your church'   // never blank, never throw
```

### Pattern 2: Client-side filter over already-authorized data (NOT a re-subscribe)

**What:** The multi-church switcher filters an array already fully loaded into the Pinia store. It does
NOT trigger a new Firestore query, does NOT call `authStore.selectOrg()`, and does NOT touch
`resetOrgScopedStores()`.

**When to use:** Any UI-only scoping of data the client already legitimately holds — contrast with
`AppSidebar.vue`'s admin church switcher, which is a genuine **data-scope switch** (it re-subscribes an
entirely different set of org-scoped collections via `selectOrg()`).

**Example:**
```typescript
// Source: pattern extends src/stores/mySchedule.ts (existing store)
const selectedChurchId = ref<string | null>(null)  // null = "all" or single-church default

const distinctChurches = computed(() => {
  const byId = new Map<string, string | undefined>()
  for (const d of docs.value) {
    if (!byId.has(d.orgId) || (!byId.get(d.orgId) && d.orgName)) {
      byId.set(d.orgId, d.orgName)
    }
  }
  return [...byId.entries()].map(([orgId, orgName]) => ({ orgId, orgName: orgName ?? 'Your church' }))
})

const filteredDocs = computed(() => {
  if (!selectedChurchId.value) return docs.value
  return docs.value.filter((d) => d.orgId === selectedChurchId.value)
})
```

### Pattern 3: Store-to-store read in a presentational component (AppSidebar)

**What:** `AppSidebar.vue` already reads exactly one store (`authStore`) for its org-name slot. This phase
adds a SECOND store read (`useMyScheduleStore()`), gated so it only ever affects the branch where
`authStore.orgName` is falsy (i.e., a volunteer session) — the admin path is byte-for-byte unchanged.

**When to use:** When a presentational component needs to source the same UI slot from different stores
depending on session type, without those stores knowing about each other.

**Example:**
```typescript
// Source: pattern extends src/components/AppSidebar.vue
import { useMyScheduleStore } from '@/stores/mySchedule'
const mySchedule = useMyScheduleStore()

// Only consulted when authStore.orgName is null (admin path untouched) —
// mirrors the owner's "SELECTED church (multi) or the ONLY church (single)" rule.
const volunteerChurchName = computed(() => {
  if (authStore.orgName) return null // admin path — never overridden
  const churches = mySchedule.distinctChurches
  if (churches.length === 1) return churches[0]!.orgName
  if (churches.length > 1 && mySchedule.selectedChurchId) {
    return churches.find((c) => c.orgId === mySchedule.selectedChurchId)?.orgName ?? null
  }
  return churches.length > 1 ? 'Multiple churches' : null
})
```
```html
<!-- Source: extends AppSidebar.vue:16-29's existing v-if block -->
<div v-if="authStore.orgName || authStore.superAdminOutsideOwnChurch || volunteerChurchName" ...>
  <template v-if="authStore.orgName">...</template>
  <template v-else-if="volunteerChurchName">
    <p class="text-xs text-gray-500 truncate">{{ volunteerChurchName }}</p>
  </template>
  <p v-else>Super Admin · not in a church</p>
</div>
```

### Pattern 4: Reading the org name in a store-free resync path

**What:** `resyncRehearseAccessForSong` deliberately avoids the org-scoped Pinia stores (it runs from the
Songs page, where `rosterStore`/`quartersStore` are not subscribed) and instead does direct `getDocs`
reads. The org name must be fetched the same way — a direct `getDoc(organizations/{orgId})` — NOT via
`authStore.orgName` (which may be stale/absent if this resync ever runs from a context where the auth
store's org context differs from `orgId.value`, though today they're the same).

**Example:**
```typescript
// Source: extends src/stores/services.ts resyncRehearseAccessForSong
// firestore.rules confirms: `match /organizations/{orgId} { allow read: if isOrgMember(orgId); }`
// — the editor triggering this resync IS an org member, so this getDoc succeeds.
const orgSnap = await getDoc(doc(db, 'organizations', org))
const orgName = (orgSnap.data()?.name as string | undefined) ?? undefined
await Promise.all(affected.map((svc) => writeRehearseAccessDoc(svc, org, orgName, quarters, roles, people, songs)))
```

### Anti-Patterns to Avoid

- **Reusing `AppSidebar`'s `hasSwitcher`/`selectOrg` machinery for volunteers:** that mechanism assumes
  `authStore.memberships` is populated and calls `resetOrgScopedStores()` — both wrong for a
  zero-membership volunteer session. Build a separate, store-local filter instead (Pattern 2).
- **Reading `organizations/{orgId}` from a volunteer session:** `firestore.rules` gates that doc on
  `isOrgMember(orgId)` — a magic-link volunteer is never a member and this read will always be denied.
  This is exactly why `orgName` must live on the `rehearseAccess` projection itself.
- **Treating a missing `orgName` as an error state:** it is an expected, common state for any doc
  written before this phase ships and not yet re-projected. Never `throw`/console.error on absence —
  fall back silently (Pattern 1).
- **Auto-selecting a "current" church for AppSidebar without owner sign-off:** the owner's decision text
  is specific ("SELECTED church (multi) or the ONLY church (single)") — do not invent an auto-selected
  default (e.g., soonest upcoming service's church) without flagging it, since that silently picks a
  church the volunteer didn't choose. See Open Questions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distinct-value dedupe from an array of docs | A hand-rolled loop with an object accumulator and manual `hasOwnProperty` checks | `Map<orgId, orgName>` (Pattern 2 above) | Matches this codebase's existing dedupe idiom (`distinctSongSlots` in `rehearseAccess.ts` uses a `Set`); a `Map` is the direct analog for key→value dedupe and is already used elsewhere in the codebase (`peopleById`, `songsById`, `nameById` in the same file). |
| Session-scoped UI selection state | A new Vuex-style global "current selection" singleton, or route query params | A plain Pinia `ref` inside the existing `mySchedule` store | The store instance is already the correct scope (torn down/reset on sign-out like every other store); no new state-management pattern needed. |

**Key insight:** This phase adds zero new architectural concepts to the codebase — every pattern used
(optional projection field, store-derived computed list, local filter ref, store-to-store presentational
read) already has a direct precedent in `rehearseAccess.ts`, `myScheduleGrouping.ts`, or `AppSidebar.vue`
itself. The main risk is not "what pattern to use" but "don't let the volunteer filter mechanism blur with
the admin membership-switch mechanism" — they must stay structurally separate even though they render in
the same sidebar slot.

## Runtime State Inventory

> Not applicable — this is not a rename/refactor/migration phase. Skipped per the trigger condition.

However, one related "existing data" caveat carries the same shape as a migration concern and is called
out explicitly per the owner's decision text:

- **Stored data:** Existing `organizations/{orgId}/rehearseAccess/{serviceId}` docs for services already
  in `Planned` status will NOT have `orgName` until one of: (a) the service is Reopened and re-locked
  (`markAsPlanned` runs again), or (b) a song attached to that service has its files edited (triggering
  `resyncRehearseAccessForSong`). **Action required:** code must degrade gracefully (Pattern 1); a
  one-time backfill script is explicitly DEFERRED (see `<deferred>` in CONTEXT.md) — do not build one in
  this phase. Document this caveat in the phase's UAT notes so the owner can decide whether to force a
  backfill later.

## Common Pitfalls

### Pitfall 1: Confusing `mySchedule`'s `selectedChurchId` with `authStore.orgId`

**What goes wrong:** A future maintainer (or an eager implementation) reads `authStore.orgId` inside the
switcher filter logic, assuming it reflects "the current church" — for a volunteer, `authStore.orgId` is
always `null` (zero memberships). The filter MUST key off the store-local `selectedChurchId`, never
`authStore`.
**Why it happens:** Every other "current org" concept in this codebase lives on `authStore` (`orgId`,
`orgName`, `orgSlug`) — it's the path of least resistance to reach for the same pattern here.
**How to avoid:** Keep `selectedChurchId` and `distinctChurches` entirely inside `mySchedule.ts`; never
import `useAuthStore` into that store.
**Warning signs:** Any new code inside `mySchedule.ts` importing `@/stores/auth`.

### Pitfall 2: Assuming `orgName` is present on every doc in `distinctChurches`

**What goes wrong:** A church with ONLY pre-Phase-130 (un-resynced) docs produces a `distinctChurches`
entry with `orgName: undefined`. If the switcher UI doesn't apply the same fallback label used elsewhere,
the volunteer sees a blank menu item — indistinguishable from a rendering bug.
**Why it happens:** Easy to test only against freshly-locked (post-Phase-130) fixture docs during
development, since those always have `orgName` populated.
**How to avoid:** Apply the `?? 'Your church'` (or equivalent) fallback ONCE, inside the `distinctChurches`
computed itself (Pattern 2), so every consumer (switcher UI, sidebar) automatically inherits it — don't
repeat the fallback logic at each call site.
**Warning signs:** A unit test fixture where every doc has `orgName` set; add at least one test case with
`orgName` deliberately omitted.

### Pitfall 3: Two distinct orgIds silently collapsing under the same fallback label

**What goes wrong:** If a volunteer serves at TWO churches and BOTH have un-resynced docs, `distinctChurches`
produces two entries that are both literally "Your church" — visually indistinguishable in the switcher.
**Why it happens:** The fallback label is necessarily generic since there's no name to show.
**How to avoid:** This is an acceptable, known degradation (not a bug) per the owner's explicit
"degrade gracefully" instruction — but the plan should surface it as a documented limitation, not silently
accept indistinguishable menu rows without at least a `data-testid` disambiguator (e.g., `orgId` as a
`title` attribute) so it's debuggable, and should reference the deferred backfill as the eventual fix.
**Warning signs:** A UAT session where a real multi-church volunteer with only legacy docs can't tell the
two switcher rows apart.

### Pitfall 4: Writing `orgName` but forgetting `resyncRehearseAccessForSong`'s own test mocks

**What goes wrong:** `resyncRehearseAccessForSong`'s existing tests mock `getDocs` for
quarters/roles/people/songs but not a `getDoc` for the org document — adding the new `getDoc` call without
updating that test's Firestore mock setup causes the new code path to hang or throw inside the test
(`getDoc is not a function` or an unresolved promise), not a clean assertion failure.
**Why it happens:** The two Firestore mock helpers in `services.test.ts` (`getDocs` collection mocks) are
easy to extend for another collection but easy to forget the new *document* (`getDoc`) read is a different
mocked function entirely.
**How to avoid:** When extending `services.test.ts`, add a `mockGetDoc` (or extend the existing one if
`getDoc` is already mocked elsewhere in that file for `markAsPlanned`'s own fallback path) returning
`{ exists: () => true, data: () => ({ name: 'Test Church' }) }`.
**Warning signs:** A new test hangs (timeout) rather than failing immediately.

## Code Examples

### orgName threaded through `buildRehearseAccess`

```typescript
// Source: extends src/utils/rehearseAccess.ts (existing function signature/shape)
export function buildRehearseAccess(
  service: Service,
  orgId: string,
  orgName: string | undefined,   // NEW param — undefined is a valid, expected value
  quarters: Quarter[],
  roles: Role[],
  people: Person[],
  songs: Song[],
): RehearseAccessDoc {
  // ... existing body unchanged ...
  return {
    serviceId: service.id,
    orgId,
    ...(orgName ? { orgName } : {}),   // conditional-spread — mirrors this file's
                                        // existing stageLayout omission pattern
                                        // (never a literal `orgName: undefined`)
    // ... existing fields ...
  }
}
```

### markAsPlanned — orgName from authStore (already loaded)

```typescript
// Source: extends src/stores/services.ts markAsPlanned
const authStore = useAuthStore()
await writeRehearseAccessDoc(
  { ...service, status: 'planned' },
  orgId.value,
  authStore.orgName ?? undefined,   // authStore is the source of truth here —
                                     // this store already imports/uses org context
                                     // elsewhere in this file (check existing imports)
  quartersStore.quarters,
  rosterStore.roles,
  rosterStore.people,
  songStore.songs,
)
```

### resyncRehearseAccessForSong — orgName from a direct getDoc

```typescript
// Source: extends src/stores/services.ts resyncRehearseAccessForSong
const orgSnap = await getDoc(doc(db, 'organizations', org))
const orgName = (orgSnap.data()?.name as string | undefined) ?? undefined
// fetch this ALONGSIDE the existing Promise.all for quarters/roles/people/songs
// to avoid adding a serial round-trip:
const [orgSnap2, quartersSnap, rolesSnap, peopleSnap, songsSnap] = await Promise.all([
  getDoc(doc(db, 'organizations', org)),
  getDocs(collection(db, 'organizations', org, 'quarters')),
  getDocs(collection(db, 'organizations', org, 'roles')),
  getDocs(collection(db, 'organizations', org, 'people')),
  getDocs(collection(db, 'organizations', org, 'songs')),
])
```

## State of the Art

Not applicable — no external ecosystem shift is involved. This is an internal schema/UI extension to
existing v2.12-era code (Phase 125/126/127) shipped within the last two weeks; no library versions to
verify, no deprecations to track.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `resyncRehearseAccessForSong`'s calling editor always has `isOrgMember(orgId)` true for the org whose song they're editing (so the new `getDoc(organizations/{orgId})` will not be denied) | Pattern 4 / Code Examples | If wrong, the resync's org-name enrichment silently fails (caught by the existing try/catch, degrading to the same "no orgName" state as an un-resynced doc) — not a functional break, but confirmed HIGH confidence via direct `firestore.rules` read (`allow read: if isOrgMember(orgId);`), not training-data guess. |
| A2 | The right default sidebar label for a multi-church volunteer with NO church selected yet is a neutral "Multiple churches" string | Pattern 3 / Open Questions | Low risk (cosmetic) — if the owner prefers a different treatment (e.g., auto-select the soonest-upcoming church's name), it's a one-line change to `volunteerChurchName`'s fallback branch. |

## Open Questions

1. **What should `selectedChurchId` default to for a multi-church volunteer who has never made a
   selection?**
   - What we know: CONTEXT.md says the switcher's own default is "all" (no filter applied to the
     schedule list) — this is unambiguous for R403/R404's filtering behavior.
   - What's unclear: what the AppSidebar org-name slot shows in that exact "all, no selection" state,
     since there's no single church name to display.
   - Recommendation: render "Multiple churches" (Pattern 3) as a safe, non-committal default; ship this
     and let it surface during UAT if the owner wants something more specific (e.g., auto-selecting the
     church of the soonest upcoming service).

2. **Should `ScheduleServiceCard` show a per-card church badge when "All churches" is selected?**
   - What we know: not explicitly required by R403/R404/R405 (those only require a switcher/filter to
     exist and label churches by name).
   - What's unclear: whether an "All churches" view listing services from 2+ churches with no visual
     distinction is confusing enough to need a per-card label.
   - Recommendation: Claude's discretion per CONTEXT.md — low-cost addition (`orgName` prop threaded
     through from `MyScheduleView.vue`'s existing card-render loop), consider adding if the "All" view
     otherwise looks ambiguous, but not required for correctness.

## Environment Availability

> Skipped — no external dependencies. This phase touches only already-configured Firebase SDK calls and
> the existing Vitest/Vue toolchain, all already verified present in this repo.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (root config) + `@vue/test-utils` for component mounts |
| Config file | `vite.config.ts` (root suite excludes `src/rules.test.ts` and `render-service/**`) |
| Quick run command | `npx vitest run src/utils/rehearseAccess.test.ts src/stores/__tests__/mySchedule.test.ts src/stores/__tests__/services.test.ts src/components/__tests__/AppSidebar.test.ts` |
| Full suite command | `npx vitest run` (baseline: exactly 1 known-failing file, `src/storage.rules.test.ts` — see CLAUDE.md) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R403 | Switcher renders only when `distinctChurches.length > 1`; filter never calls `selectOrg`/touches `authStore` | unit + component | `npx vitest run src/stores/__tests__/mySchedule.test.ts src/views/__tests__/MyScheduleView.test.ts` | mySchedule.test.ts ✅ / MyScheduleView.test.ts ✅ (both exist — extend with switcher-gate cases) |
| R404 | `orgName` present on `RehearseAccessDoc` after `markAsPlanned`; present after `resyncRehearseAccessForSong`; switcher labels use it; `VolunteerServiceView`/sidebar reflect the selected church | unit | `npx vitest run src/utils/rehearseAccess.test.ts src/stores/__tests__/services.test.ts` | rehearseAccess.test.ts ✅ / services.test.ts ✅ (extend both) |
| R404 (sidebar) | AppSidebar shows the volunteer's church name (single or selected) in the org-name slot without disturbing the admin `authStore.orgName` branch | component | `npx vitest run src/components/__tests__/AppSidebar.test.ts` | ✅ (extend) |
| R405 | Single-church (0 or 1 distinct org) volunteer sees no switcher, unchanged card list | unit + component | `npx vitest run src/stores/__tests__/mySchedule.test.ts` | ✅ (extend) |
| R404 (graceful fallback) | A `rehearseAccess` doc with `orgName` absent does not crash the switcher, sidebar, or `distinctChurches` derivation | unit | `npx vitest run src/stores/__tests__/mySchedule.test.ts` | ✅ (extend — add a fixture without `orgName`) |

### Sampling Rate

- **Per task commit:** the scoped Quick run command above (4-file targeted run, <10s)
- **Per wave merge:** `npx vitest run` (full app suite) + `npm run type-check` (per CLAUDE.md — the
  `vue-tsc --build` gate, NOT `-p tsconfig.app.json`, since new optional fields/props touch both `src/`
  and its test files)
- **Phase gate:** Full suite green (baseline: only `src/storage.rules.test.ts` failing) before
  `/gsd-verify-work`

### Wave 0 Gaps

None — `src/views/__tests__/MyScheduleView.test.ts`, `src/stores/__tests__/mySchedule.test.ts`,
`src/utils/rehearseAccess.test.ts`, `src/stores/__tests__/services.test.ts`, and
`src/components/__tests__/AppSidebar.test.ts` all already exist (confirmed via Glob this session) and
follow consistent mocking conventions the planner can extend directly — no new test file or fixture
framework is needed for this phase.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (unchanged) | This phase adds no new sign-in path; reuses v2.12's existing magic-link session. |
| V3 Session Management | No (unchanged) | No session/token changes. |
| V4 Access Control | Yes — but NO code change required | `firestore.rules`' `rehearseAccess/{serviceId}` `allow get`/`allow list`/`allow write` arms already grant/scope exactly what this phase needs (whole-document read to an assigned, verified volunteer; editor-only write). Confirmed by direct rule read: no field-level restriction exists, so adding `orgName` to the payload needs zero rule changes. |
| V5 Input Validation | No new input surface | The switcher is a pure client-side filter over server-authorized data; `selectedChurchId` is only ever set from `distinctChurches` values already present in the volunteer's own authorized `docs` — never from a route param, query string, or other externally-suppliable input. |
| V6 Cryptography | N/A | No crypto involved. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client trusts a filter value from an untrusted source (e.g., a `?church=` query param) to scope which docs render | Tampering / Information Disclosure | NOT applicable here if implemented per Pattern 2 — `selectedChurchId` must only ever be set via clicking a `distinctChurches` entry (derived from the volunteer's own already-authorized docs), never read from `route.query` or any other externally-suppliable source. This is a plan-time constraint, not a runtime gate, since the filter never reaches a Firestore query — it only slices an in-memory array the volunteer is already authorized to see in full. |
| Cross-org data leakage via a shared client-side store | Information Disclosure | Not a new risk — `mySchedule.docs` already legitimately contains every org's rehearseAccess doc the volunteer is assigned to (that's the whole point of the collectionGroup query); this phase does not widen that set, it only adds a display/filter layer on top of data already delivered to the client. |

**Security note (light):** `orgName` is non-sensitive — church names are already public via the
`orgSlugs` registry used by the Phase 128 self-service page (`/{church-slug}/volunteer`). Adding it to a
projection an assigned volunteer can already fully read introduces no new data exposure. The filter is
100% client-side over already-authorized documents; there is no new Firestore query, no new Cloud
Function, and no new Firestore rule. No threat-model or rate-limit/enumeration test matrix is warranted
for this phase (contrast with Phase 128's R397, which IS security-critical because it's a public
unauthenticated endpoint — this phase has no such surface).

## Sources

### Primary (HIGH confidence)
- `src/utils/rehearseAccess.ts` (read in full) — `buildRehearseAccess`, `RehearseAccessDoc` shape, existing
  optional-field conventions (`stageLayout`, `bpm`).
- `src/stores/services.ts` (read `writeRehearseAccessDoc`, `markAsPlanned`, `resyncRehearseAccessForSong`
  in full) — both write-path call sites and their existing data sources.
- `src/stores/mySchedule.ts` (read in full) — `MyScheduleDoc` type, `loadMySchedule` query shape.
- `src/components/AppSidebar.vue` (read in full) — org-name slot markup (L16-29), admin switcher
  (`hasSwitcher`/`handleSwitch`/`selectOrg`) as the explicit anti-pattern to avoid reusing.
- `src/composables/useVolunteerServiceDoc.ts` (read in full) — confirms `doc.orgName` will be available
  for free once the field exists on `RehearseAccessDoc`.
- `firestore.rules` (read `organizations/{orgId}` allow-read rule and `rehearseAccess/{serviceId}` full
  block) — confirms (a) an org member can `getDoc` the org document (needed by
  `resyncRehearseAccessForSong`), and (b) no field-level write restriction exists on `rehearseAccess`, so
  adding `orgName` needs no rule change.
- `src/stores/auth.ts` (read `memberships`, `orgName`, `resetOrgContext`, `applyOrgSnapshot`) — confirms
  `memberships` defaults to `[]` and `orgName`/`orgId` default to `null` for a zero-membership volunteer
  session.
- `src/stores/__tests__/mySchedule.test.ts` and `src/components/__tests__/AppSidebar.test.ts` (read in
  part) — existing mock patterns the plan's new tests should mirror.
- `.planning/phases/130-multi-church-volunteer-switcher/130-CONTEXT.md`,
  `.planning/REQUIREMENTS.md` (R403–R405) — owner-settled scope and decisions.
- `CLAUDE.md` — type-check gate and test-suite baseline conventions applied in Validation Architecture.

### Secondary (MEDIUM confidence)
- None — all findings for this phase were verified directly against the codebase/rules; no external
  documentation lookup was required (no new library/framework involved).

### Tertiary (LOW confidence)
- None.

## Project Constraints (from CLAUDE.md)

- **Type-check gate:** use `npm run type-check` (`vue-tsc --build`, which also typechecks test files), NOT
  `vue-tsc --noEmit -p tsconfig.app.json` — the latter silently skips test files and has previously let
  real `TS2339` errors ship undetected for two phases.
- **Test suite baseline:** a bare `npx vitest run` should show exactly ONE failing file
  (`src/storage.rules.test.ts`, a documented Storage-emulator `firestore.exists()` limitation, not a
  regression). Do not use `--dir src` (bypasses `vite.config.ts`'s excludes and pulls in
  `src/rules.test.ts`, which needs a running Firestore emulator).
- **`.env.local` requirement:** if this phase's work happens in a fresh git worktree, symlink/copy
  `.env.local` from the main checkout before running the emulator, tests, or a build.
- **Comment convention:** keep inline comments short; put rationale in ADRs and behavior narration in map
  docs (`.planning/codebase/CONVENTIONS.md`).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every pattern verified directly against existing source files.
- Architecture: HIGH — every write path, read path, and rule was read in full this session (not assumed).
- Pitfalls: HIGH — derived from direct comparison against this codebase's own prior projection-field
  additions (`rolesByEmailLower` R381, `bpm` R385/R386, `stageLayout` R393) and their own review notes.

**Research date:** 2026-09-06
**Valid until:** No expiry driver (internal codebase research, not a fast-moving external dependency) —
revalidate only if `rehearseAccess.ts`, `mySchedule.ts`, or `AppSidebar.vue` change again before Phase 130
is planned/executed.
