# Phase 17: Sync schedule with planned services - Research

**Researched:** 2026-07-22
**Domain:** Integration of two existing subsystems (Service planning + Quarterly volunteer scheduling) inside a single-tenant-per-org Vue 3 + Pinia + Firestore app
**Confidence:** HIGH (all findings are direct reads of this codebase; no external ecosystem research was needed — this phase is pure internal integration, not new-library adoption)

> No CONTEXT.md exists for this phase yet (discuss-phase has not run). No `<user_constraints>` section is emitted. No `.planning/REQUIREMENTS.md` exists project-wide; ROADMAP.md lists this phase's requirements as `TBD`. A candidate requirement/decision list derived from the phase description is provided under "Candidate Requirement Areas" for planner traceability — these are NOT locked decisions, just this researcher's scoping of the phase description into checkable units.

## Summary

This phase wires together two subsystems that today share nothing but a date string: **Services** (`organizations/{orgId}/services/{id}`, music/logistics only — `src/types/service.ts`, `src/stores/services.ts`) and **Quarters** (`organizations/{orgId}/quarters/{id}`, the volunteer roster's dates × roles calendar — `src/types/roster.ts`, `src/stores/quarters.ts`). There is currently **no code path anywhere that reads a Quarter to inform a Service, or vice versa** — a grep/graph search confirms zero cross-references between `src/stores/services.ts` and `src/stores/quarters.ts` or between `ServiceEditorView.vue` and `RosterView.vue`/`QuarterView.vue`/`QuarterGrid.vue`.

The join key is the plain `YYYY-MM-DD` date string: `Service.date` (a scalar field) vs. `Quarter.serviceDates: string[]` (membership array) plus `Quarter.calendar: Record<date, Record<roleId, personId[]>>` (the actual assignments). Resolving "who serves on this service's date" means: (1) find the Quarter whose `serviceDates` array contains the service's date, (2) read `quarter.calendar[date]` for `roleId -> personId[]`, (3) resolve role metadata via `rosterStore.roles` and person names via `rosterStore.people`. **No such resolver function exists today** — it must be built new (recommend a pure function in a new `src/utils/serviceRoles.ts`, mirroring the existing `buildResolveRolesForDate` / `buildRoleGroupOf` helper style already in `quarters.ts`).

The two existing public-share features (`src/views/ShareView.vue` for a single service via opaque `shareTokens/{token}`, and `src/views/QuarterShareView.vue` for a whole quarter via both opaque `shareTokens/{token}` AND memorable `quarterShares/{slug}__q{N}-{year}`) are architecturally identical: both snapshot pre-resolved, denormalized data into a public Firestore doc at share-time so the unauthenticated route never needs roster/org access. This exact pattern should be reused/extended for a per-service share that also carries role assignments.

**Primary recommendation:** Do NOT snapshot/copy the quarterly schedule into the Service document. Instead, add a single new **optional, sparse override field** to `Service` — `roleAssignmentOverrides?: Record<string, string[]>` (roleId -> personId[], present key = override, absent key = inherit from schedule) — and compute the "effective" per-role assignment at render/share time as `overrides[roleId] ?? liveScheduleAssignments[roleId] ?? []`. This mirrors the exact pattern the codebase already uses for `Quarter.roleOverridesByDate` (a sparse per-date override map layered on top of a computed default). It requires zero migration, never mutates the Quarter/schedule, and — unlike a copy-on-seed snapshot — automatically reflects later schedule edits for every role the service hasn't explicitly overridden, with no separate "re-sync" action needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve roles-for-date from schedule (the "seeding join") | Frontend Server (Vue store/util, client-side) | Database (Firestore read of Quarter doc) | No backend/Cloud Functions exist in this project (pure Firebase client-SDK app); all joins happen client-side in Pinia stores, same as every other cross-store read in this codebase (e.g. `services.ts`'s `createShareToken` already cross-reads `songStore.songs`) |
| Per-service role override storage | Database (Firestore `services/{id}` doc field) | — | Overrides are per-service state; belongs on the Service doc, not the Quarter doc, so the schedule is never mutated (explicit phase requirement) |
| Roles tab UI (list roles, show assigned person, override control) | Browser / Client (Vue component) | — | Same tier as every other tab/slot editor in `ServiceEditorView.vue` |
| Public shared service link (read) | Browser / Client (public Vue route + direct Firestore `getDoc`) | Database (public-read Firestore collection) | Identical architecture to existing `ShareView.vue`/`QuarterShareView.vue` — no server component, `getDoc` runs directly from the unauthenticated browser session against a rules-gated public-read collection |
| Editor-only write enforcement | Database (Firestore security rules) | Browser / Client (route `meta.requiresEditor` + `authStore.isEditor` UI gating) | Same dual-layer pattern already used for Services/Songs/Roster (`firestore.rules` is the actual enforcement boundary; UI gating is defense-in-depth/UX only) |

## Standard Stack

No new external packages are required for this phase — it is a pure integration of existing in-repo subsystems using the app's current stack.

### Core (existing, reused — no version changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5.29 [VERIFIED: package.json] | UI framework | Already the app framework |
| pinia | ^3.0.4 [VERIFIED: package.json] | Store (services/quarters/roster stores) | Already the app's state layer |
| firebase | ^12.0.0 [VERIFIED: package.json] | Firestore SDK (client) | Already the app's persistence layer |
| vue-router | ^5.0.3 [VERIFIED: package.json] | Public/private routing incl. memorable share URLs | Already used for `/quarter-share/:token` and `/:slug/quarter:num-:year` |
| vitest | ^4.0.18 [VERIFIED: package.json] | Unit tests (stores/components) + `@firebase/rules-unit-testing` rules tests | Already the app's test runner; `vitest.rules.config.ts` + `src/rules.test.ts` already exercise `firestore.rules` against a local emulator |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sparse override field on Service doc | Separate `roleOverrides` subcollection per service | More Firestore reads/writes for a rarely-large map; the sparse-field approach matches the existing `roleOverridesByDate` precedent in `quarters.ts` and needs no new collection/rule |
| Live join at render time | Copy-on-seed snapshot with a dirty/"needs re-sync" flag | Snapshot avoids a cross-store read on every render but reintroduces staleness questions (what if the schedule changes after seeding?) that the live-join design avoids entirely; the live-join costs one extra `quartersStore.quarters` lookup, which is already fully subscribed client-side in every screen that would show this tab |

**Installation:** None — no new packages.

**Version verification:** Versions above are read directly from this repo's `package.json` [VERIFIED: package.json] — not fetched from the npm registry, since no new packages are being added and the existing lockfile already pins these.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new external packages. No `npm view` / registry check was needed. If a future planner discovers a need for a new dependency (e.g. a diffing library), route it back through this gate before use.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │  Firestore (per-org)                        │
                        │                                              │
                        │  organizations/{orgId}/services/{id}         │
                        │    date, slots[] (music), teams,             │
                        │    status, ...                               │
                        │    + NEW: roleAssignmentOverrides?           │
                        │      Record<roleId, personId[]>              │
                        │                                              │
                        │  organizations/{orgId}/quarters/{id}         │
                        │    serviceDates: string[]                    │
                        │    calendar: Record<date,                    │
                        │      Record<roleId, personId[]>>             │
                        │    roleOverridesByDate                       │
                        │                                              │
                        │  organizations/{orgId}/roles/{id}            │
                        │    name, group, defaultCount, order           │
                        │                                              │
                        │  organizations/{orgId}/people/{id}           │
                        │    name, roles: roleId[], active             │
                        └───────────────┬──────────────────────────────┘
                                        │ onSnapshot (subscribed on org load)
                                        ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  Pinia stores (client, src/stores/)                           │
        │                                                                 │
        │  servicesStore.services[]      quartersStore.quarters[]        │
        │  rosterStore.roles[] / people[]                                │
        │                                                                 │
        │  NEW: findQuarterForDate(date) -> Quarter | undefined          │
        │       resolveScheduleAssignments(quarter, date, roles)          │
        │         -> Array<{ role, personIds, personNames }>             │
        │       resolveEffectiveAssignments(service, quarter, ...)        │
        │         -> overrides[roleId] ?? scheduleAssignments[roleId]     │
        └───────────────────────────────┬────────────────────────────────┘
                                        │
                                        ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  ServiceEditorView.vue (authenticated, /services/:id)          │
        │                                                                 │
        │  [Music flow — existing]   [NEW: Roles tab]                    │
        │  Teams / Sermon / Slots    - list roles for this date           │
        │                            - show effective assigned person(s)  │
        │                            - override control per role          │
        │                              (editor-only; writes               │
        │                               service.roleAssignmentOverrides)  │
        └───────────────────────────────┬────────────────────────────────┘
                                        │ onShare() (extended)
                                        ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  Public share write (editor-triggered, authenticated)          │
        │                                                                 │
        │  shareTokens/{token}.serviceSnapshot                            │
        │    += roleAssignments: [{roleId, roleName, group, names[]}]     │
        │                                                                 │
        │  NEW: serviceShares/{slug}__service-{date}                      │
        │    same serviceSnapshot shape (memorable URL, mirrors           │
        │    quarterShares/{slug}__q{N}-{year})                          │
        └───────────────────────────────┬────────────────────────────────┘
                                        │ getDoc (no auth)
                                        ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  ShareView.vue (public, /share/:token)                         │
        │  NEW route: /:slug/service-:date (public, mirrors               │
        │             /:slug/quarter:num-:year)                          │
        │                                                                 │
        │  Renders music (existing) + "Who's Serving" role list (NEW)     │
        │  — reads ONLY the pre-resolved snapshot, no roster/org access   │
        └───────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── types/
│   └── service.ts          # ADD: roleAssignmentOverrides?: Record<string, string[]> on Service
├── utils/
│   └── serviceRoles.ts     # NEW: findQuarterForDate, resolveScheduleAssignments,
│                            #      resolveEffectiveAssignments (pure functions, TDD candidate)
├── stores/
│   └── services.ts         # ADD: setRoleOverride(serviceId, roleId, personIds), clearRoleOverride(...);
│                            #      extend createShareToken to include roleAssignments +
│                            #      write serviceShares/{slug}__service-{date}
├── views/
│   ├── ServiceEditorView.vue  # ADD: tab bar (reuse QuarterView.vue's activeTab pattern) +
│                                #      "Roles" tab body
│   └── ShareView.vue          # ADD: "Who's Serving" section rendering serviceSnapshot.roleAssignments
├── router/
│   └── index.ts             # ADD: /:slug/service-:date(\d{4}-\d{2}-\d{2}) route (public,
│                              #      appended after static routes, same as quarter-memorable-share)
└── firestore.rules          # ADD: match /serviceShares/{shareId} block mirroring
                               #      /quarterShares/{shareId} exactly
```

### Pattern 1: Sparse override map layered on a computed default
**What:** A Firestore field that is *absent* by default and, when a specific key is written, means "override this one entry"; the read path always computes `override ?? computedDefault`.
**When to use:** Any "per-instance exception to a broader schedule/template" — exactly this phase's override requirement.
**Example (existing precedent in this codebase):**
```typescript
// Source: src/stores/quarters.ts (buildResolveRolesForDate, lines 281-290)
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
Recommend the exact same shape for the new `roleAssignmentOverrides` on `Service`: `service.roleAssignmentOverrides?.[roleId] ?? scheduleAssignments[roleId] ?? []`.

### Pattern 2: Scoped Firestore dot-path writes (never whole-map rewrites)
**What:** Every mutating function in `quarters.ts` (`assignPerson`, `clearAssignment`, `swapAssignment`, `setPersonAvailability`) writes only `calendar.${date}.${roleId}` or `personQuarterData.${personId}` via Firestore's dot-path `updateDoc`, never replacing the whole map — explicitly to avoid clobbering concurrent edits to *other* dates/people/roles (documented inline, e.g. lines 345-346, 215-220).
**When to use:** The new `setRoleOverride(serviceId, roleId, personIds)` MUST follow this same rule: write only `roleAssignmentOverrides.${roleId}`, never the whole `roleAssignmentOverrides` object — otherwise two editors overriding different roles on the same service concurrently would clobber each other, exactly the bug this codebase has repeatedly guarded against (see `assignPerson`'s comment block).
**Example:**
```typescript
// Source: src/stores/quarters.ts, assignPerson (lines 347-361) — pattern to mirror
async function assignPerson(quarterId: string, date: string, roleId: string, personId: string) {
  await updateDoc(doc(db, 'organizations', orgId.value, 'quarters', quarterId), {
    [`calendar.${date}.${roleId}`]: [...existing, personId],
    updatedAt: serverTimestamp(),
  })
}
```

### Pattern 3: Denormalized public snapshot at share-time, never live roster access from the public route
**What:** `finalizeAndShare` (quarters.ts, lines 397-484) and `createShareToken` (services.ts, lines 137-176) both resolve all IDs to display names/values *before* writing the public doc, so `ShareView.vue`/`QuarterShareView.vue` need only `getDoc` on the public doc — never a roster/org read, never auth.
**When to use:** Exactly the model to extend for a service's role assignments in the public link — resolve `personId -> name` once, at share-write time, into the snapshot.
**Example:**
```typescript
// Source: src/stores/quarters.ts, finalizeAndShare (lines 408-415)
const nameById = new Map(rosterStore.people.map((p) => [p.id, p.name]))
const calendarWithNames: Record<string, Record<string, string[]>> = {}
for (const [date, roleMap] of Object.entries(quarter.calendar)) {
  calendarWithNames[date] = {}
  for (const [roleId, personIds] of Object.entries(roleMap)) {
    calendarWithNames[date]![roleId] = personIds.map((id) => nameById.get(id) ?? id)
  }
}
```

### Pattern 4: Memorable-URL slug resolution + soft-fail secondary write
**What:** `finalizeAndShare` resolves (or claims, on first use) the org's `slug` via `deriveSlug`/`claimSlug` (`src/utils/slug.ts`), then writes a deterministic-ID doc `quarterShares/{slug}__q{N}-{year}` — and wraps this ENTIRE memorable-URL step in try/catch so a failure never surfaces as a hard error to the caller (the opaque token share has already succeeded by that point).
**When to use:** The new per-service memorable share write must follow this exact soft-fail wrapping.
**Example:**
```typescript
// Source: src/stores/quarters.ts, finalizeAndShare (lines 442-481) — soft-fail wrapper to mirror
try {
  const orgRef = doc(db, 'organizations', orgId.value)
  const orgSnap = await getDoc(orgRef)
  let slug = orgSnap.exists() ? (orgSnap.data().slug as string | undefined) : undefined
  if (!slug) {
    slug = await claimSlug(deriveSlug(orgData.name ?? '') || 'org', orgId.value)
    await updateDoc(orgRef, { slug })
  }
  await setDoc(doc(db, 'quarterShares', `${slug}__q${quarter.quarter}-${quarter.year}`), { /* snapshot */ })
} catch (err) {
  console.error('memorable-URL step failed — opaque share link already succeeded', err)
}
```

### Anti-Patterns to Avoid
- **Whole-object override rewrite:** Never write `{ roleAssignmentOverrides: newWholeMap }` — always the scoped dot-path `roleAssignmentOverrides.${roleId}`, per Pattern 2.
- **Snapshotting the schedule into the Service on first tab view:** Would require an explicit "stale/re-sync" UX and duplicate data that can drift silently. The live-join design (Pattern 1) avoids this class of bug entirely.
- **Public route reading `organizations/{orgId}/quarters` or `/roles` or `/people` directly:** These collections fall under Firestore's `match /{collection}/{docId}` catch-all bucket, which is **editor-only read** (`firestore.rules` lines 61-64) — an unauthenticated public share route can never read them directly. All public data must go through a denormalized snapshot doc (Pattern 3), exactly like the existing two share features.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug derivation / uniqueness claim for a memorable org URL | A new slug generator | `deriveSlug` + `claimSlug` (`src/utils/slug.ts`) — already handles reserved-word collision, numeric-suffix retry, and permission-denied races | Already built, tested, and the exact mechanism `quarterShares` relies on; a second implementation would drift |
| Cryptographic share token generation | `Math.random()`-based token | The existing `Uint8Array(18)` + `crypto.getRandomValues` 36-char hex pattern, duplicated identically in both `services.ts::createShareToken` and `quarters.ts::finalizeAndShare` | 144-bit entropy, already proven; this phase's extension to `createShareToken` should reuse the *same* function, not add a third copy |
| Role/person eligibility filtering (who CAN fill a role) | New "which people have this role" logic | `hasRole(person, roleId)` / `person.roles.includes(roleId)` pattern already used throughout `QuarterGrid.vue`'s `availableUnassigned()` (lines 369-378) | The override control's "assign a different person" dropdown needs the identical eligibility semantics already implemented and tested for the schedule editor |
| Tab UI state/markup | A new tabs component/library | The existing inline `activeTab` ref + button-class pattern used identically in `QuarterView.vue` (lines 84-115) and `ServicesView.vue` (referenced in that file's own comment "mirrors ServicesView.vue") | Third occurrence of the same simple pattern — a shared `<TabBar>` component might even be worth extracting, but at minimum copy the existing markup, don't invent a new tab mechanism |

**Key insight:** Every piece of infrastructure this phase needs (slugs, tokens, override-map pattern, denormalized public snapshots, scoped dot-path writes, role-eligibility filtering, tab UI) already has one working, in-repo implementation from Phases 13/15/16. This phase is near-purely **compositional** — the risk is drifting from these established patterns, not inventing new ones.

## Data Model Reference (current state)

### Service (`src/types/service.ts`, lines 50-67) — no Roles field today
```typescript
export interface Service {
  id: string
  date: string              // YYYY-MM-DD — THE JOIN KEY into Quarter.serviceDates
  name: string
  progression: Progression
  teams: string[]
  status: ServiceStatus      // 'draft' | 'planned' | 'exported'
  slots: ServiceSlot[]       // music only — SONG/SCRIPTURE/PRAYER/MESSAGE/HYMN
  sermonPassage: ScriptureRef | null
  sermonTopic?: string
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
  pcExportedAt?: Timestamp | null
  pcPlanId?: string | null
  // PROPOSED ADDITION (this phase):
  // roleAssignmentOverrides?: Record<string, string[]>  // roleId -> personId[]
}
```
[VERIFIED: src/types/service.ts]

### Quarter / Role / Person (`src/types/roster.ts`)
```typescript
export type RoleGroup = 'band' | 'tech' | 'vocals' | 'other'
export interface Role { id: string; name: string; group: RoleGroup; defaultCount: number; order: number }
export interface Person { id: string; name: string; active: boolean; roles: string[]; /* ...email/phone/pcPersonId */ }

// calendar[date][roleId] = personId[]  (multi-person-per-role, multi-role-per-person)
export type QuarterCalendar = Record<string, Record<string, string[]>>

export interface Quarter {
  id: string
  serviceDates: string[]                        // generated Sundays + manual add/remove
  roleOverridesByDate: Record<string, RoleSlotConfig[]>   // per-date role-COUNT overrides (not people)
  calendar: QuarterCalendar                     // THE assignments — generated + manually edited
  status: 'draft' | 'finalized'
  // ...personQuarterData, shareToken, etc.
}
```
[VERIFIED: src/types/roster.ts]

**No existing code resolves "roles + assigned people for one specific date" as a first-class query.** The closest existing logic is `QuarterGrid.vue`'s `cellPeople(date, roleId)` (returns `quarter.calendar[date]?.[roleId] ?? []`, line 282-284) and `effectiveCountFor(date, roleId)` (line 290-296, resolves count from `roleOverridesByDate` or `role.defaultCount`) — both operate INSIDE the Quarter/Schedule screens, keyed on a Quarter already in scope. A NEW resolver is needed that starts from a bare `date` string (no Quarter in scope yet) and searches `quartersStore.quarters` for the one whose `serviceDates` includes it:

```typescript
// NEW — recommended addition, e.g. src/utils/serviceRoles.ts
function findQuarterForDate(quarters: Quarter[], date: string): Quarter | undefined {
  return quarters.find((q) => q.serviceDates.includes(date))
}
```

**Edge case (flagged, not resolved by existing code):** `serviceDates` are per-quarter and de-duplication across quarters is NOT enforced anywhere in `quartersStore` — two quarters could theoretically both list the same date if a user manually adds it via `addServiceDate` (line 149-153) to more than one quarter. `findQuarterForDate` above returns the FIRST match; there is no code today that prevents or detects the ambiguous case. See Open Questions.

## The Seeding Join (recommended design)

```typescript
// NEW — pure function, TDD candidate
interface ResolvedRoleAssignment {
  roleId: string
  roleName: string
  group: RoleGroup
  scheduledPersonIds: string[]   // from quarter.calendar[date][roleId], [] if no quarter/no entry
  overriddenPersonIds: string[] | null   // service.roleAssignmentOverrides?.[roleId] ?? null
  effectivePersonIds: string[]   // overriddenPersonIds ?? scheduledPersonIds
}

function resolveServiceRoleAssignments(
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

This is the single function the Roles tab, the public share writer, and (optionally) `ServicePrintLayout.vue` would all consume.

## Override Model — Comparison and Recommendation

| Option | Storage | Re-seed vs. frozen | Which roles overridden? | Verdict |
|--------|---------|---------------------|--------------------------|---------|
| **(a) Sparse override map on Service, live join for the rest** (RECOMMENDED) | `service.roleAssignmentOverrides?: Record<roleId, personId[]>` | N/A — never a snapshot; non-overridden roles ALWAYS reflect the current schedule live | `overriddenPersonIds !== null` on the resolved struct above | Matches existing `roleOverridesByDate` precedent; zero migration; zero staleness bugs; minimal new state |
| (b) Copy-on-seed snapshot with dirty flags | `service.seededRoleAssignments: Record<roleId, personId[]>` written once when the tab is first opened/saved, plus a per-role `overridden: boolean` flag | Requires an explicit "Re-sync from schedule" action per role or per service; must detect and surface "schedule changed since seed" | Track via the flag | More moving parts, more state to keep consistent, and a new UX decision (when/how to prompt re-sync) with no existing precedent in this codebase to reuse |
| (c) Separate `serviceRoleOverrides` collection | New subcollection `organizations/{orgId}/services/{id}/roleOverrides/{roleId}` | Same live-join semantics as (a) | Doc existence = overridden | Functionally equivalent to (a) but costs a Firestore subcollection read (extra `onSnapshot`/`getDocs`) for no benefit over a single sparse map field, given override counts per service are small (≤ number of roles, currently 8 defaults) |

**Recommendation: Option (a).** It is a direct extension of a pattern this codebase already trusts (`roleOverridesByDate`), needs no migration (new field is optional/absent on every existing Service doc), and by design the schedule is **never mutated** — satisfying the phase's explicit constraint with the least new surface area. What happens when the schedule changes after a service already has some overrides: non-overridden roles instantly reflect the change (live join); overridden roles stay pinned until an editor explicitly clears the override (a "Reset to schedule" per-role action, analogous to `QuarterGrid.vue`'s "Clear" button). Which roles were overridden vs. inherited is directly and cheaply knowable from whether `service.roleAssignmentOverrides?.[roleId]` is present — no extra bookkeeping field needed.

## Assumption-Delta Note (4b) — ADD-ALONGSIDE, not PROMOTE

**Recommendation: ADD-ALONGSIDE.** Do not merge `Service` and `Quarter`/schedule into one combined document/collection. Keep:
- `Service` = music + logistics + (new) sparse role-assignment overrides — same collection, same document shape, one new optional field.
- `Quarter`/`calendar` = the volunteer schedule, completely unowned by Services, read-only from the Service's perspective.

This preserves the existing tier boundary (Songs/Services = music planning; Roster/Quarters = people scheduling) that Phases 13-16 built and that Firestore rules already encode as separate collections with separate read/write semantics (`services` allows viewer-read/editor-write; `quarters`/`roles`/`people` fall into the editor-only catch-all — see Auth/Permissions section below). A combined-model PROMOTE would force a data migration of every existing Service doc and would blur a boundary the last four phases deliberately reinforced (see ROADMAP.md Phase 15/16 goals). The "net result: a planned service carries both music AND people" from the phase description is satisfied at the **read/display** layer (the Roles tab shows both), not by physically merging the two documents.

## Shared Service Link (public read) — end-to-end study of the existing pattern

### Existing quarterly schedule share (Phase 16) — the pattern to mirror
- **Routes** (`src/router/index.ts`, lines 84-96):
  - Opaque: `/quarter-share/:token` -> `QuarterShareView.vue`, no `meta.requiresAuth`.
  - Memorable: `/:slug/quarter:num([1-4])-:year(\d{4})` -> same component, appended AFTER all static routes with an inline comment noting Vue Router ranks static path segments above dynamic ones so this can never shadow `/songs`, `/volunteers`, etc.
- **Write path** (`src/stores/quarters.ts::finalizeAndShare`, lines 397-484): generates a 36-char hex token via `crypto.getRandomValues`; resolves person IDs to names ONCE into `calendarWithNames`; writes BOTH `shareTokens/{token}` (opaque, frozen — `allow update: if false` in rules) AND `quarterShares/{slug}__q{N}-{year}` (memorable, overwritable in place on every re-share). The memorable-URL slug resolution/claim is wrapped in try/catch — a failure there does not fail the whole share action.
- **Public read path** (`QuarterShareView.vue`, `onMounted`, lines 250-272): `token ? getDoc(shareTokens/token) : getDoc(quarterShares/{slug}__q{num}-{year})`, reading ONLY `snap.data().quarterSnapshot` — no roster/auth store import anywhere in this component (verified: only imports are `vue`, `vue-router`, `firebase/firestore`, `db`, `QuarterShareMatrix.vue`, `useIsMobile`).
- **Firestore rules** (`firestore.rules` lines 78-113):
  ```
  match /shareTokens/{token} {
    allow read: if true;
    allow create: if isSignedIn();
    allow update: if false;
    allow delete: if isOrgEditor(resource.data.orgId);
  }
  match /quarterShares/{shareId} {
    allow read: if true;
    allow create: if isOrgEditor(request.resource.data.orgId);
    allow update: if isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId;
    allow delete: if isOrgEditor(resource.data.orgId);
  }
  ```
- **Church slug resolution**: `Organization.slug` field, derived via `deriveSlug(orgName)` and claimed exclusively via `claimSlug(base, orgId)` (`src/utils/slug.ts`), both pure/tested helpers with a `RESERVED_SLUGS` set (`songs, roster, volunteers, schedule, services, team, admins, settings, login, share, quarter-share, public`) checked before any claim.

### Existing per-service share (Phase 3/4) — narrower, needs extension
- **Route**: `/share/:token` -> `ShareView.vue`, opaque only — **no memorable URL exists for services today**.
- **Write path** (`src/stores/services.ts::createShareToken`, lines 137-176): same token-generation pattern; resolves BPM per song slot from `songStore`; writes `shareTokens/{token}` with `serviceSnapshot` = `{ date, name, progression, teams, slots (with bpm), sermonPassage, notes, status }` — **no people/roles data at all today**.
- **Public read path** (`ShareView.vue`, lines 136-151): identical `getDoc(shareTokens/token)` pattern, renders `serviceSnapshot.slots`.
- **Trigger UI**: `ServiceEditorView.vue::onShare()` (line 2072-2092) calls `serviceStore.createShareToken(...)`, copies `${origin}/share/${token}` to clipboard.

### What must be built for the per-service Roles share
1. Extend `createShareToken`'s `serviceSnapshot` to include a `roleAssignments: Array<{ roleId; roleName; group; personNames: string[] }>` field, computed via `resolveServiceRoleAssignments` (above) and person-name resolution, exactly mirroring `finalizeAndShare`'s `nameById` map pattern. This is a **non-breaking addition** to the existing `shareTokens/{token}` doc shape — no rules change needed (already `allow read: if true`).
2. Add a **new memorable route and collection** to mirror the quarterly pattern 1:1: route `/:slug/service-:date(\d{4}-\d{2}-\d{2})` -> new/extended `ShareView.vue` (or a small variant), collection `serviceShares/{slug}__service-{date}` with the exact same `orgId`/`orgSlug`/`serviceSnapshot` shape and rules block as `quarterShares` (create/update scoped to `isOrgEditor(request.resource.data.orgId)`, read `if true`).
3. Add `'service-share'` (or whatever static segment prefix is chosen) to `RESERVED_SLUGS` if a new static top-level route is introduced (not needed if the memorable route is purely `/:slug/service-:date` with no separate opaque route prefix — but IS needed if e.g. `/service-share/:token` is added, mirroring `/quarter-share/:token`). **Recommend**: add `'service-share'` proactively for consistency even if the opaque route reuses `/share/:token`.
4. `Service`'s date is already unique-ish per org by convention (one service per Sunday) but **this is not enforced anywhere in code** (no uniqueness check found in `NewServiceDialog.vue` or `services.ts::createService`) — the memorable URL scheme `{slug}__service-{date}` assumes at most one service per date per org. See Open Questions.

## UI — The Roles Tab

`ServiceEditorView.vue` currently has **no tab structure at all** — it is one long scrolling page (Teams -> Sermon Context -> dynamic slot list -> Add Element -> Print/Share/Delete). This is unlike `QuarterView.vue` and `RosterView.vue`, which both already have tabs (added in quick-task `260713-wm9`). Recommend introducing a tab bar to `ServiceEditorView.vue` for the first time, reusing `QuarterView.vue`'s exact markup:

```html
<!-- Source: src/views/QuarterView.vue, lines 83-115 — pattern to copy -->
<div class="flex items-center gap-1 mb-6 border-b border-gray-800 pb-0">
  <button type="button" class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'music' ? 'text-indigo-300 border-indigo-500 bg-gray-900' : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="activeTab = 'music'">Music</button>
  <button type="button" class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'roles' ? 'text-indigo-300 border-indigo-500 bg-gray-900' : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="activeTab = 'roles'">Roles</button>
</div>
<div v-show="activeTab === 'music'"> <!-- existing Teams/Sermon/Slots content --> </div>
<div v-show="activeTab === 'roles'"> <!-- NEW Roles tab --> </div>
```
`const activeTab = ref<'music' | 'roles'>('music')` — default to Music to preserve current behavior for all existing users/screenshots/tests.

**Roles tab content — reuse `QuarterGrid.vue`'s per-role editing pattern** (lines 122-195, the row-drawer's role section): for each `ResolvedRoleAssignment`, show role name, effective assigned person name(s) (from `rosterStore.people`), a "Clear" + "Swap with…" control when overridden, and an "Override…" select populated from people who `hasRole(person, roleId)` (mirroring `QuarterGrid.vue::availableUnassigned`, adapted since blackout-date filtering is quarter-scoped and may not directly apply to a single already-scheduled date — recommend still respecting blackout dates for the service's date if the quarter data is available, so an override can't silently assign someone who told the leader they're unavailable that Sunday).

For a viewer (non-editor), the Roles tab should be read-only, following the exact `authStore.isEditor` conditional-rendering convention used throughout `ServiceEditorView.vue` (e.g. lines 393-425 Teams block: editor gets checkboxes, viewer gets a plain text list).

**No quarter/schedule for this date:** if `findQuarterForDate` returns `undefined` (no quarter covers this Sunday, or none has been generated yet), the Roles tab must render a clear empty/informational state (e.g. "No schedule found for this date — assign roles manually" with all roles showing 0 scheduled, override-only).

## Auth/Permissions & Firestore Rules

**Current rules** (`firestore.rules`, verified above):
- `organizations/{orgId}/services/{docId}`: `allow read: if isOrgMember(orgId); allow write: if isOrgEditor(orgId);` — **viewers can already read services**. Writing the new `roleAssignmentOverrides` field falls under this same existing rule (editor-only write, member read) — **no rules change needed for the override field itself**.
- `organizations/{orgId}/roles/{docId}`, `organizations/{orgId}/quarters/{docId}`, `organizations/{orgId}/people/{docId}`: none of these are explicitly named in `firestore.rules`; they fall into the catch-all `match /organizations/{orgId}/{collection}/{docId} { allow read, write: if isOrgEditor(orgId); }` (lines 61-64) — **editor-only READ**. This means: **a viewer opening the Roles tab in-app cannot read `roles`/`quarters`/`people` today.** This is an important gap: if viewers are meant to see the Roles tab in-app (not just via the public share link), this phase must either (a) restrict the Roles tab to editors only in-app (viewers only see it via the public share link), or (b) add explicit viewer-read rules for `roles`/`people`/`quarters` — which CLAUDE.md's Phase 16.2 removal note explicitly flags as an out-of-scope "feature, not hardening" that was deliberately NOT wanted as of 2026-07-13. **Recommend option (a)**: gate the in-app Roles tab's data behind `authStore.isEditor` (consistent with the removed-Phase-16.2 decision), and let non-editors see who's serving exclusively via the new public share link (which needs no rules change at all, since it reads only the denormalized snapshot doc).
- New `serviceShares/{shareId}` collection: add a rules block identical to `quarterShares` (public read; create/update scoped to `isOrgEditor(request.resource.data.orgId)`; delete scoped to `isOrgEditor(resource.data.orgId)`).
- `shareTokens/{token}`: no rule change needed — already `allow read: if true`, and this phase only adds a field to the existing snapshot payload, not a new access pattern.

**Test coverage for rules changes**: `src/rules.test.ts` + `vitest.rules.config.ts` + `npm run test:rules` (runs `firebase emulators:exec ... --only firestore`) already exercises `firestore.rules` against a live Firestore emulator using `@firebase/rules-unit-testing`. New tests for `serviceShares` should follow the exact `describe`/`assertSucceeds`/`assertFails` pattern already used for `quarterShares` in that file (not read in full here, but the file's existing structure for `shareTokens`/`orgSlugs` — lines 1-80 — is directly copyable).

## Common Pitfalls

### Pitfall 1: Whole-object override write clobbering concurrent edits
**What goes wrong:** Writing `updateService(id, { roleAssignmentOverrides: newWholeMap })` after reading the current map client-side races with another editor's override write to a different role, silently dropping their change.
**Why it happens:** `updateService` performs a plain `updateDoc` (services.ts, lines 78-84) with whatever object is passed — it has no built-in merge semantics beyond Firestore's default (which REPLACES the field wholesale, not deep-merges).
**How to avoid:** Always write the scoped dot-path key, e.g. `updateDoc(doc(...), { [\`roleAssignmentOverrides.${roleId}\`]: personIds })`, exactly as `assignPerson`/`clearAssignment`/`swapAssignment` do in `quarters.ts`.
**Warning signs:** Two editors' overrides on the same service intermittently "disappearing" — the classic symptom this codebase has already fixed multiple times for the Quarter calendar (see `T-13-09-02` decision in STATE.md).

### Pitfall 2: Assuming one service per date, one quarter per date
**What goes wrong:** `findQuarterForDate` and any memorable-URL doc-ID scheme (`{slug}__service-{date}`) assume at-most-one Service and at-most-one Quarter cover a given date. Neither is enforced in code today.
**Why it happens:** No uniqueness constraint exists on `Service.date` (checked: no dedup logic in `NewServiceDialog.vue`/`services.ts::createService`) nor on cross-quarter `serviceDates` membership.
**How to avoid:** Either add a soft duplicate-date warning in the UI (out of scope unless the planner chooses to address it), or explicitly document/accept "first match wins" and surface a warning if multiple Services or Quarters are found for the same date. At minimum, this phase's resolver functions should have deterministic, tested tie-breaking (e.g. "most recently created quarter/service wins") rather than silently picking array order.
**Warning signs:** A service showing role assignments that don't match the schedule the leader expects, with no error — because a stale, older quarter or duplicate service is winning the match.

### Pitfall 3: Public share leaking PII beyond names
**What goes wrong:** Naively passing raw `Person` objects (which include `email`/`phone`/`pcPersonId`) into the public snapshot instead of just `.name`.
**Why it happens:** Copy-paste from a component that has the full `Person` object in scope (e.g. `rosterStore.people`).
**How to avoid:** Follow `finalizeAndShare`'s exact pattern — build a `Map<personId, name>` and map ONLY names into the snapshot, never the whole Person object. This is explicitly called out as a deliberate D-24 decision in STATE.md ("QuarterShareView reads ONLY the self-contained quarterSnapshot... so the public route cannot touch org-scoped PII").
**Warning signs:** Any public snapshot doc containing an `email` or `phone` field — grep for this in code review before shipping.

### Pitfall 4: Viewer-facing Roles tab silently failing to load due to rules
**What goes wrong:** If the in-app Roles tab is shown to non-editor viewers and tries to read `organizations/{orgId}/quarters`/`roles`/`people`, Firestore rules will deny the read (editor-only catch-all), and depending on how the store subscription is wired, this could either throw visibly or silently show empty data.
**Why it happens:** `rosterStore.subscribe`/`quartersStore.subscribe` are almost certainly only called from editor-gated routes today (`/volunteers`, `/schedule` both have `meta.requiresEditor: true`) — `/services/:id` does NOT have `requiresEditor`, so a viewer landing there would trigger a first-time subscribe to editor-only collections.
**How to avoid:** Gate the Roles tab's data-fetching (not just its UI) behind `authStore.isEditor`, per the Auth/Permissions recommendation above.
**Warning signs:** Console permission-denied errors in the browser when a non-editor account opens a service's Roles tab.

## Code Examples

Already covered inline above (Patterns 1-4, Data Model Reference, Seeding Join). All sourced from this repo:
- `src/stores/quarters.ts` (lines 281-543)
- `src/stores/services.ts` (full file, 192 lines)
- `src/types/roster.ts` / `src/types/service.ts` (full files)
- `src/components/QuarterGrid.vue` (lines 1-420, role-cell + row-drawer logic)
- `src/views/QuarterShareView.vue` / `src/views/ShareView.vue` (full files)
- `src/utils/slug.ts` (full file)
- `firestore.rules` (full file)
- `src/router/index.ts` (full file)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Per-person standing serve frequency | Per-(person, role) quarter-scoped `roleFrequency`/`roleTiers` | Phase 15 | Not directly relevant to this phase's join logic, but explains why `PersonQuarterData` looks the way it does — do not resurrect a per-person-only frequency read |
| Service share = music only | (this phase) Service share = music + roles | Phase 17 (in progress) | This IS the state-of-the-art change this research supports |
| Quarter share = opaque token only | Quarter share = opaque token + memorable `/{slug}/quarterN-YYYY` URL | Phase 16 | Direct precedent this phase's per-service memorable URL should mirror |

**Deprecated/outdated:** none identified specific to this phase's scope.

## Candidate Requirement Areas

> No formal REQUIREMENTS.md exists and ROADMAP.md lists this phase's requirements as TBD. These are this researcher's decomposition of the phase description into checkable units for planner traceability — NOT locked decisions. `/gsd-discuss-phase 17` should confirm/adjust before planning locks scope.

| # | Area | Research Support |
|---|------|-------------------|
| CR-01 | Roles tab appears on a service plan, listing each configured role | `rosterStore.roles` (existing, `src/stores/roster.ts`) + new tab UI (ServiceEditorView.vue pattern from QuarterView.vue) |
| CR-02 | Each role shows the person(s) scheduled for that role on the service's date, seeded from the quarterly schedule | New `resolveServiceRoleAssignments` (Seeding Join section) reading `quartersStore.quarters` + `Quarter.calendar` |
| CR-03 | Each role assignment can be overridden per-service without mutating the schedule | New `Service.roleAssignmentOverrides` sparse field + scoped dot-path writes (Override Model section) |
| CR-04 | A public shared service link shows who is serving (mirrors Phase 16 quarter share) | Extend `shareTokens` snapshot + new `serviceShares/{slug}__service-{date}` + new route + new rules block (Shared Service Link section) |
| CR-05 | Editor-only writes; appropriate read access for the public link and in-app viewers | Existing `isOrgEditor`/`isOrgMember` rules helpers; Roles-tab data-fetch gated to editors in-app per Pitfall 4 |

## Open Questions

1. **What happens when two quarters both list the same service date (manually added), or two services share the same date?**
   - What we know: Neither uniqueness constraint is enforced in code today (`addServiceDate` has no cross-quarter dedup check; `createService`/`NewServiceDialog.vue` has no same-date dedup check).
   - What's unclear: Whether this is an accepted, rare edge case to leave as "first match wins," or whether the planner should add a guard (e.g. warn on quarter creation if a date already exists in another quarter; warn on service creation if a service already exists for that date).
   - Recommendation: Flag to `/gsd-discuss-phase 17`; default to deterministic "prefer the quarter with `status: 'finalized'`, else the most-recently-created" tie-break, and same-date service creation is out of scope to newly restrict (pre-existing behavior, not a regression this phase introduces).

2. **Should the in-app Roles tab be visible to non-editor viewers at all, and if so, via what read-access change?**
   - What we know: Firestore rules currently make `roles`/`quarters`/`people` editor-only-read; CLAUDE.md's Phase 16.2 removal note explicitly rejected expanding viewer read access to Schedule/Volunteers as an unwanted feature just 9 days before this phase was added.
   - What's unclear: Whether the intent for THIS phase is different (a scoped, roles-tab-only read) versus the rejected general expansion.
   - Recommendation: Default to editor-only in-app Roles tab (per Pitfall 4); viewers get the read-only info via the NEW public share link instead — this satisfies "anyone with the link can see who is serving" without reopening the Phase 16.2 decision. Confirm in discuss-phase.

3. **Exact URL scheme for the memorable per-service share link.**
   - What we know: The quarter's scheme is `/{slug}/quarter{N}-{year}` (date-range based, since quarters aren't single-date). Services are single-date.
   - What's unclear: Exact preferred path shape — options include `/{slug}/service-{date}` (e.g. `/gracechurch/service-2026-08-02`), or something more human like `/{slug}/{date}` bare (risk: could collide with a future non-numeric static route more easily than a prefixed segment).
   - Recommendation: `/{slug}/service-{date}` (prefixed) is safer for router-priority reasoning and mirrors the `quarter{N}-{year}` prefix convention; confirm exact wording in discuss-phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` (unit/component tests), `vitest.rules.config.ts` (Firestore rules, requires `firebase emulators:exec`) |
| Quick run command | `npm run test:unit -- src/stores/__tests__/services.test.ts src/stores/__tests__/quarters.test.ts` |
| Full suite command | `npm run test:unit` (component/store/util tests) + `npm run test:rules` (Firestore rules against local emulator) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| CR-02 | `resolveServiceRoleAssignments` correctly resolves scheduled people for a date from the matching quarter's calendar | unit | `npx vitest run src/utils/__tests__/serviceRoles.test.ts` | ❌ Wave 0 — new util + test file |
| CR-02 | Returns empty/graceful result when no quarter covers the date | unit | same file | ❌ Wave 0 |
| CR-03 | `setRoleOverride` writes ONLY the scoped `roleAssignmentOverrides.${roleId}` dot-path, leaving other roles' overrides untouched | unit (store, mocked firestore, mirrors `src/stores/__tests__/quarters.test.ts` style) | `npx vitest run src/stores/__tests__/services.test.ts` | ❌ new test cases in existing file |
| CR-03 | Effective assignment = override when present, else schedule | unit | `src/utils/__tests__/serviceRoles.test.ts` | ❌ Wave 0 |
| CR-04 | `createShareToken`'s snapshot includes `roleAssignments` with resolved names only (no email/phone) | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ❌ new test cases |
| CR-04 | `serviceShares/{shareId}` rules: public read allowed; create/update requires `isOrgEditor` of the embedded orgId; cross-org overwrite denied | rules | `npm run test:rules` (extend `src/rules.test.ts`) | ❌ new `describe` block |
| CR-05 | Non-editor cannot read `organizations/{orgId}/roles`/`quarters`/`people` (existing behavior — regression guard) | rules | `npm run test:rules` | ✅ likely already covered by existing catch-all tests in `src/rules.test.ts` — verify during planning |
| CR-01/UI | Roles tab renders, shows role list, override control appears for editors only | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ❌ new test cases in existing file |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run <changed test file>`
- **Per wave merge:** `npm run test:unit` (full unit/component suite)
- **Phase gate:** `npm run test:unit` AND `npm run test:rules` both green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/utils/serviceRoles.ts` + `src/utils/__tests__/serviceRoles.test.ts` — new pure-function module and its TDD suite (findQuarterForDate, resolveServiceRoleAssignments)
- [ ] Extend `src/rules.test.ts` with a `describe('serviceShares')` block mirroring the existing `quarterShares` coverage pattern (not read line-by-line in this research pass — locate and copy during planning)
- [ ] Framework install: none — Vitest, `@firebase/rules-unit-testing`, and the Firestore emulator are already configured and used by `npm run test:rules`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No (public read routes are intentionally unauthenticated by design, same as existing share links) | Firebase Auth (existing) governs the authenticated app; public share routes are deliberately anonymous |
| V3 Session Management | No new surface | Firebase Auth session handling (existing, unchanged) |
| V4 Access Control | Yes | Firestore security rules (`isOrgMember`/`isOrgEditor` helper functions) — new `serviceShares` rule block must scope create/update to `isOrgEditor(request.resource.data.orgId)` exactly like `quarterShares`, to prevent cross-org overwrite of another org's public share doc (the doc ID is a guessable, deterministic string, same risk class already documented inline as "CR-01" in `firestore.rules` for `quarterShares`) |
| V5 Input Validation | Yes | `roleId`/`personId` values written into `roleAssignmentOverrides` should be validated client-side against `rosterStore.roles`/`rosterStore.people` before write (defense-in-depth; rules do not currently validate the internal shape of nested maps, only top-level collection access) |
| V6 Cryptography | Yes (token generation only) | Reuse existing `crypto.getRandomValues(new Uint8Array(18))` 36-hex-char token pattern (144-bit entropy) — do not hand-roll a new generator |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-org overwrite of a guessable memorable-share doc ID (`{slug}__service-{date}`) | Tampering | `allow create/update: if isOrgEditor(request.resource.data.orgId)` + forbid changing `orgId` on update, exactly as `quarterShares` rules already do |
| PII leakage in public share snapshot (email/phone via role assignment) | Information Disclosure | Snapshot only `person.name`, never the full `Person` object, per Pattern 3 / Pitfall 3 |
| Concurrent-editor override clobber (whole-map write race) | — (data integrity, not classic STRIDE, but a real bug class this codebase has fixed repeatedly) | Scoped Firestore dot-path writes only, per Pattern 2 / Pitfall 1 |
| Non-editor read of editor-only roster/schedule data via a route missing `requiresEditor` | Elevation of Privilege | Gate Roles-tab data subscription behind `authStore.isEditor`, not just UI rendering, per Pitfall 4 |

## Sources

### Primary (HIGH confidence — direct codebase reads, this session)
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\types\service.ts` — Service/slot types
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\types\roster.ts` — Role/Person/Quarter/PersonQuarterData types
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\stores\services.ts` — createService/updateService/createShareToken
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\stores\quarters.ts` — full store, all mutation functions, finalizeAndShare, deleteQuarter
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\stores\roster.ts` — people/roles CRUD, activePeople
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\views\ShareView.vue` — existing per-service public share
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\views\QuarterShareView.vue` — existing quarter public share (opaque + memorable)
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\views\ServiceEditorView.vue` (both read passes, lines 1-1186 and onShare at 2072-2092) — no tabs currently; onShare implementation
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\views\QuarterView.vue` (lines 75-125) — tab bar markup pattern
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\components\QuarterGrid.vue` (lines 1-420) — role-cell rendering, availableUnassigned, effectiveCountFor
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\utils\slug.ts` — deriveSlug/claimSlug/RESERVED_SLUGS
- `C:\projects\.hoj-wt\worshipplanner-62d59075\firestore.rules` — full ruleset
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\router\index.ts` — full route table
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\rules.test.ts` (lines 1-80) — Firestore rules test harness pattern
- `C:\projects\.hoj-wt\worshipplanner-62d59075\src\stores\__tests__\services.test.ts` (lines 1-50) — store test mocking convention
- `C:\projects\.hoj-wt\worshipplanner-62d59075\vite.config.ts`, `package.json` — stack versions
- `C:\projects\.hoj-wt\worshipplanner-62d59075\.planning\ROADMAP.md`, `.planning\STATE.md`, `.\CLAUDE.md` — phase history, prior decisions (D-24 PII note, Phase 16.2 removal rationale)

### Secondary (MEDIUM confidence)
- None — no web/docs lookups were performed (no ecosystem question required one; all providers were also unavailable per `init.phase-op` output: `brave_search: false, firecrawl: false, exa_search: false`).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, versions read directly from `package.json`
- Architecture / data model / existing share patterns: HIGH — every claim traced to a specific file and line range in this repo
- Override model recommendation: HIGH confidence in the recommendation being consistent with existing precedent; MEDIUM on whether the user will agree with "live join" vs. "snapshot" without discuss-phase confirmation (flagged as Open Question territory, not a hard unknown)
- Public share URL scheme exact wording: MEDIUM — the mechanism is HIGH confidence (mirror quarterShares exactly), the exact path string is a recommendation pending confirmation (Open Question 3)
- Auth/permissions gap (viewer read access to roles/quarters/people): HIGH confidence this gap exists today; MEDIUM on the phase's exact intended resolution (flagged as Open Question 2, directly informed by CLAUDE.md's Phase 16.2 removal history)

**Research date:** 2026-07-22
**Valid until:** 30 days (stable, internal-only findings; re-verify if Phase 16.2-adjacent rules work or a REQUIREMENTS.md/CONTEXT.md is introduced in the meantime)
