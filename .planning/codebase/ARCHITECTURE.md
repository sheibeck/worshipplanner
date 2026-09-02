<!-- refreshed: 2026-07-16 -->
# Architecture

**Analysis Date:** 2026-07-16

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Vue 3 SPA (Vite)                                   │
│                    `src/App.vue` + `src/main.ts`                             │
├─────────────────┬────────────────────────┬────────────────────┬──────────────┤
│    Views        │    Components          │    Stores (Pinia)  │  Utilities   │
│  `src/views/`   │  `src/components/`     │   `src/stores/`    │ `src/utils/` │
│                 │                        │                    │              │
│ • LoginView     │ • AppShell             │ • auth.ts          │ • API clients│
│ • DashboardView │ • ServiceCard          │ • songs.ts         │ • Formatters │
│ • ServiceEditor │ • SongTable            │ • services.ts      │ • Validators │
│ • SongsView     │ • ArrangementAccordion │ • quarters.ts      │ • Helpers    │
│ • RosterView    │ • AvailabilityDrawer   │ • roster.ts        │              │
│ • QuarterView   │ • RosterImportModal    │                    │              │
└─────────────────┴────────────────────────┴────────────────────┴──────────────┘
         │                    │                       │                │
         └────────────────────┴───────────────────────┴────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
         ▼                                         ▼
┌────────────────────────────────┐    ┌───────────────────────────────┐
│  Firebase Firestore            │    │  Cloud Functions (Reverse     │
│  (Real-time Subscriptions)     │    │  Proxy with Auth)             │
│                                │    │                               │
│ • users/{uid}                  │    │ `functions/src/index.ts`      │
│ • organizations/{orgId}        │    │                               │
│ • organizations/{orgId}/songs  │    │ Routes:                       │
│ • organizations/{orgId}/services
│ • organizations/{orgId}/roster │    │ • /api/anthropic (Claude)     │
│ • shareTokens/{token}          │    │ • /api/esv (Bible text)       │
│ • firestore.rules              │    │ • /api/planningcenter (PC)    │
└────────────────────────────────┘    └───────────────────────────────┘
         │                                         │
         └─────────────────────┬───────────────────┘
                               │
          ┌────────────────────┴─────────────────────┐
          │                                          │
          ▼                                          ▼
    ┌─────────────┐                        ┌──────────────────┐
    │ Firebase    │                        │ External APIs    │
    │ Auth        │                        │                  │
    └─────────────┘                        │ • Anthropic      │
                                          │ • ESV (Bible)    │
                                          │ • Planning Center│
                                          └──────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Views** | Page-level components rendering routes; contain major feature areas | `src/views/*.vue` |
| **Components** | Reusable UI building blocks (modals, tables, sidebars, cards) | `src/components/*.vue` |
| **Stores (Pinia)** | Centralized state management with Firestore subscriptions | `src/stores/*.ts` |
| **Router** | URL routing with auth/role guards | `src/router/index.ts` |
| **Firebase** | Real-time database (Firestore), authentication, Cloud Functions | `src/firebase/index.ts` |
| **Utils** | API clients, import/export, business logic helpers | `src/utils/*.ts` |
| **Types** | Shared TypeScript interfaces for domain models | `src/types/*.ts` |
| **Composables** | Reusable Vue 3 composition functions (e.g., unsaved changes guard) | `src/composables/*.ts` |

## Pattern Overview

**Overall:** Vue 3 SPA with Pinia state management, real-time Firestore subscriptions, Firebase Authentication, and Cloud Functions as a reverse proxy for paid APIs (Anthropic, ESV Bible).

**Key Characteristics:**
- **Real-time sync:** All collections use `onSnapshot` subscriptions in stores to keep UI in sync with Firestore
- **Auth-first architecture:** Route guards check Firebase Auth + Pinia auth store for roles before rendering
- **Org-scoped data:** Everything is namespaced under `organizations/{orgId}` — data is never shared across orgs
- **Soft deletes:** Songs, services, and roster members use `hidden: true` instead of deletion
- **Server-held secrets:** Sensitive API keys live in Cloud Functions; client never sees them
- **Vertical Worship methodology:** Song categorization (1=Call to Worship, 2=Intimate, 3=Ascription) gates song selection

## Layers

**View Layer:**
- Purpose: Route-mapped page components that compose lower-layer components and subscribe to stores
- Location: `src/views/`
- Contains: `.vue` SFC files like `ServiceEditorView.vue`, `SongsView.vue`, `DashboardView.vue`
- Depends on: Router, components, stores, utilities
- Used by: Vue Router

**Component Layer:**
- Purpose: Reusable UI blocks (modals, tables, sidebars, accordions) composed in views
- Location: `src/components/`
- Contains: `.vue` SFC files implementing buttons, cards, import dialogs, roster tables, etc.
- Depends on: Stores (read-only for most components), utils, types
- Used by: Views and other components

**Store Layer:**
- Purpose: Pinia stores managing application state with real-time Firestore subscriptions
- Location: `src/stores/`
- Contains: TypeScript composition API stores with `onSnapshot` listeners
- Depends on: Firebase Firestore SDK, types, utilities
- Used by: Views, components, and other stores

**Data Access Layer:**
- Purpose: Direct Firebase Firestore API integration (done inline in stores, not abstracted)
- Located in: Store methods calling `collection()`, `onSnapshot()`, `updateDoc()`, etc.
- Patterns: Async methods with `serverTimestamp()`, `writeBatch()` for consistency
- Enforced by: `firestore.rules` (Firestore security rules)

**Utility Layer:**
- Purpose: Business logic helpers, external API clients, import/export formatters
- Location: `src/utils/`
- Contains: `planningCenterApi.ts`, `claudeApi.ts`, `pcSongImport.ts`, `scheduler.ts`, etc.
- Depends on: Types, Firebase (via stores)
- Used by: Views, components, stores

**Type Layer:**
- Purpose: Shared TypeScript domain models (Song, Service, Arrangement, etc.)
- Location: `src/types/`
- Contains: Interfaces for `service.ts`, `song.ts`, `roster.ts`
- Used by: All layers

## Data Flow

### Primary Request Path: Creating/Editing a Service

1. User navigates to `/services/:id` → `ServiceEditorView.vue` mounts (`src/views/ServiceEditorView.vue`)
2. View reads from `useServiceStore()` which has an active `onSnapshot` subscription
3. Firestore listener (`src/stores/services.ts:35`) pushes service doc to `services.value`
4. View binds UI to service state and listens for user input
5. User edits a slot → View calls `serviceStore.assignSongToSlot(serviceId, slotIndex, song)` (`src/stores/services.ts:91`)
6. Store updates local state: `updateService(serviceId, { slots: updatedSlots })` (`src/stores/services.ts:78`)
7. Store writes to Firestore: `updateDoc(doc(db, 'organizations', orgId, 'services', id), ...)`
8. Firestore listener fires → all subscribed clients receive updated doc
9. View reactively updates

### Song Import Path: Planning Center → Firestore

1. User opens `SettingsView.vue` and clicks "Import from Planning Center"
2. View displays `PcImportModal.vue` (`src/components/PcImportModal.vue`)
3. User provides Planning Center credentials
4. Modal calls `planningCenterApi.fetchSongs()` (`src/utils/planningCenterApi.ts`) via `/api/planningcenter` proxy
5. `pcSongImport.ts` transforms PC song JSON into `UpsertSongInput` format
6. Store calls `useSongStore().upsertSongs(songs)` → batches writes to Firestore
7. Firestore listener fires → all clients see new songs in `filteredSongs` computed

### Authentication Flow

1. User loads app → `App.vue` checks `authStore.isReady` (initially false)
2. App shows loading spinner while auth initializes
3. `authStore` has an `onAuthStateChanged` listener (set up in `auth.ts`) that:
   - Catches Firebase Auth user or null
   - Calls `loadOrgContext(uid)` to fetch org/role from Firestore
   - Sets `isReady = true` once org context is loaded
4. App renders routing + guards check `requiresAuth` and `requiresEditor` meta
5. Router guard calls `getCurrentUser()` which returns Firebase Auth user promise
6. If `requiresEditor`, guard waits for `authStore.waitForRole()` (D-15 gating on VW mode)

**State Management:**
- Pinia stores maintain refs for reactive state (`songs`, `services`, `isLoading`, etc.)
- Firestore `onSnapshot` listeners automatically update these refs
- Computed properties filter/transform state (e.g., `filteredSongs` based on search + tag filters)
- User preferences (tag filters, column visibility) are persisted to localStorage, scoped by `${orgId}:${uid}`

## Key Abstractions

**ServiceSlot (Polymorphic slot model):**
- Purpose: Represents any item in a service order (song, scripture, prayer, message, hymn)
- Examples: `src/types/service.ts` defines `SongSlot`, `ScriptureSlot`, `NonAssignableSlot`, `HymnSlot`
- Pattern: Discriminated union on `kind: 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE' | 'HYMN'`
- Created by: `buildSlots(progression)` in `src/utils/slotTypes.ts` based on service progression template

**VWType (Vertical Worship categorization):**
- Purpose: Categorize songs by their liturgical function in worship (D-15, D-16)
- Values: `1 = 'Call to Worship'`, `2 = 'Intimate'`, `3 = 'Ascription'`
- Labels: `VW_TYPE_LABELS` in `src/types/song.ts`
- Used in: Song filtering in `filteredSongs`, slot assignment requirements in `SongSlot.requiredVwType`
- Gated by: `authStore.vwModeEnabled` toggle (church-level setting)

**Progression (Service template):**
- Purpose: Define the standard order of slots for a service
- Values: `'1-2-2-3'` or `'1-2-3-3'` (song VW-type sequence)
- Mapping: `PROGRESSION_SLOT_TYPES` in `src/utils/slotTypes.ts` maps progression → slot positions to VW types
- Applied in: `ServiceEditorView` to dynamically require VW types when assigning songs

**ShareToken (Public share model):**
- Purpose: Create a shareable link for read-only service viewing
- Structure: Random 36-char hex token stored in Firestore `shareTokens/{token}`
- Contains: Immutable snapshot of service (date, name, songs, progression, scripture)
- Routes: `/share/{token}` (old format) or `/{slug}/quarter{N}-{YYYY}` (memorable format)

## Entry Points

**App Initialization:**
- Location: `src/main.ts`
- Triggers: Browser loads `/index.html`
- Responsibilities: Creates Vue app, registers Pinia, mounts router, attaches to `#app`

**Root Component:**
- Location: `src/App.vue`
- Triggers: After app mount
- Responsibilities: Shows loading spinner while `authStore.isReady`, then renders `<RouterView />`

**Router:**
- Location: `src/router/index.ts`
- Triggers: Navigation or direct URL entry
- Responsibilities: Defines all routes, beforeEach guards check auth/role before rendering

**Store Initialization:**
- Location: `src/stores/*.ts`
- Triggers: First component imports store with `useXStore()`
- Responsibilities: Set up Firestore subscriptions, initialize state, expose mutations/queries

## Architectural Constraints

- **Org-scoped data access:** All Firestore reads/writes prefixed with `organizations/{orgId}`. No user data outside this scope. Enforced by security rules in `firestore.rules`.
- **Single-org per user (for now):** `authStore.orgId` holds the first org from user's `orgIds` array. Multi-org support not yet implemented.
- **Real-time subscriptions in stores:** Views must not call Firestore directly. Use stores' `subscribe(orgId)` then read from state.
- **Unsubscribe on logout:** Router guards and auth store call `unsubscribeAll()` on stores when user logs out to prevent orphaned listeners.
- **No cross-store direct writes:** If store A needs to update data owned by store B (e.g., services updating song `lastUsedAt`), it calls `storeB.updateX()` via import, not Firestore directly.
- **Firestore client-side validation:** Models enforce constraints via TypeScript types; server-side validation in `firestore.rules`.
- **Server-held API secrets:** Anthropic and ESV API keys never reach the browser. Cloud Function proxy (`functions/src/index.ts`) verifies Firebase ID token and injects secrets.

## Anti-Patterns

### Direct Firestore Calls in Components

**What happens:** Components import `db` and call `getDoc()` / `updateDoc()` directly, bypassing stores.

**Why it's wrong:** Breaks the store-as-single-source-of-truth pattern; multiple instances of same data exist in memory; unsubscribe logic is missed on logout; testing becomes harder.

**Do this instead:** Route all Firestore access through stores. If a view needs different data, add a store subscription. Example:
```typescript
// In src/stores/roster.ts, add a new subscription method:
export const useRosterStore = defineStore('roster', () => {
  function subscribeToTeam(teamId: string) {
    // Set up onSnapshot for that team
  }
})

// In view:
onMounted(() => {
  rosterStore.subscribeToTeam(props.teamId)
})
```

### Mutating Firestore Data Without Store

**What happens:** A component calls `updateDoc()` directly after a user action.

**Why it's wrong:** UI is not guaranteed to sync with Firestore listener (race condition); Pinia state gets out of sync with server truth.

**Do this instead:** Call a store method that updates both Firestore and local state atomically:
```typescript
// In store:
async function updateRoster(rosterId: string, data: Partial<Roster>) {
  await updateDoc(doc(db, 'organizations', orgId.value, 'rosters', rosterId), data)
  // Listener fire automatically; no need to manually update local state
}
```

### Hardcoded Org IDs

**What happens:** Code assumes a known org ID instead of reading from `authStore.orgId`.

**Why it's wrong:** Multi-org support becomes impossible; tests fail; switching orgs requires code changes.

**Do this instead:** Always read `orgId` from auth store at runtime:
```typescript
const authStore = useAuthStore()
const orgId = authStore.orgId // or pass as parameter
if (!orgId) throw new Error('No org context')
```

### Missing Unsubscribe on Route Change

**What happens:** A view subscribes to Firestore but doesn't unsubscribe when leaving the route.

**Why it's wrong:** Listeners accumulate; memory leaks occur; stale data may be synced into new routes.

**Do this instead:** Store the unsubscribe function and call it in `onBeforeUnmount()` or route guard:
```typescript
const unsubscribe = ref<Unsubscribe | null>(null)
onMounted(() => {
  unsubscribe.value = onSnapshot(q, (snap) => { ... })
})
onBeforeUnmount(() => {
  unsubscribe.value?.()
})
```

## Error Handling

**Strategy:** Optimistic UI updates with fallback to last known state on Firestore failure.

**Patterns:**
- Try-catch in async store methods; log to console (dev), optionally show toast (prod)
- Firebase throws on auth failure, network timeout, permission denied → caught as standard Error
- Firestore listener errors (permission denied) emit as listener error callback
- Unhandled rejections bubble to window error handler

## Cross-Cutting Concerns

**Logging:** Console.log for dev debugging (no centralized logger yet). Error details logged to browser console.

**Validation:** Client-side type checking via TypeScript; server-side via `firestore.rules` security rules. No custom validators.

**Authentication:** Firebase Auth handles sign-in/sign-out. Router guards check `getCurrentUser()` promise. Roles fetched from Firestore and cached in `authStore.userRole`.

## Backend Behavioral Notes (R318)

Behavioral/architectural "how it works" narration relocated out of backend source comments
(`functions/src/**`, `firestore.rules`, `storage.rules`) per the Phase 109 comment convention
(CONVENTIONS.md § Comment Convention). Grouped by source file; each entry cites the file:line
range at the time of relocation (109-02).

### firestore.rules

**`isOrgActive(orgId)` (org lifecycle gate, Phase 76 R213):** `active` is absent on every org
created before this phase and must read as active (default-true, backward-compatible) — only an
EXPLICIT `active: false` denies. A live `get()` (not a claim) is used because `firestore.rules`,
unlike `storage.rules`, CAN read a sibling document — no propagation lag on this side
(76-RESEARCH.md). `isOrgActive` itself carries no super-admin awareness; the super-admin arm
lives one level up, in `isOrgMember`/`isOrgEditor` (Phase 78, R225). It is `exists()`-guarded
FIRST: an unguarded `get(...).data` on a non-existent `organizations/{orgId}` doc throws
(Firestore treats the error as DENY, not false), and the test suite has long-established
`members/{uid}`-doc-only fixtures that never seed the parent org doc — a missing org doc must
read as active (same default-true posture as a present doc with no `active` field), not silently
deny every one of those call sites.

**`isOrgMember(orgId)` — super-admin arm (Phase 78 R225):** checked FIRST, before the `exists()`
cross-document read, both for correctness (no membership doc will ever exist for a super-admin
entering a church they don't belong to) and for cost (Firestore rules short-circuit `&&`/`||`, so
this skips the billed `exists()` read entirely on the super-admin path). Deliberately unconditional
on `isOrgActive()` too — a super-admin can enter a DEACTIVATED org for support (same posture
Phase 76 already granted a super-admin WITH a membership doc; R225 extends it to one without).
The old inner `|| isSuperAdmin()` that used to sit beside `isOrgActive()` was removed as dead code
— this outer arm already subsumes it.

**`isOrgEditor(orgId)` — super-admin arm (Phase 78 R225):** same outer-arm shape as `isOrgMember`
above — a super-admin is granted editor-tier access on ANY org with zero membership doc,
replacing the `exists()`+role check entirely (not merely waiving `isOrgActive()`). The old inner
`|| isSuperAdmin()` was removed as dead code for the same reason. This makes `isOrgEditor(orgId)`
true for EVERY super-admin on EVERY org — see the org-doc `allow update` rule, which had to drop
its own `|| isSuperAdmin()` disjunct as a direct consequence.

**`isSuperAdmin()` (Phase 68 R178):** deliberately CLAIM-ONLY — NO `get()`/`exists()`
cross-document lookup — unlike `isOrgMember`/`isOrgEditor`. This repo has a documented production
incident (CLAUDE.md, 2026-08-06) where a cross-document/cross-service rules lookup produced a
deny-everyone outage on `storage.rules`; `isSuperAdmin()` avoids that fragility class entirely by
reading only the request's own auth token. `superAdmin` is a wholly separate top-level boolean
claim — it never reuses `role` or the string `"admin"` from `isOrgEditor`'s per-org role
normalization, so an org `'editor'`/`'admin'` role claim can never satisfy this check
(naming-collision guard, proven in `src/rules.test.ts`).

**`organizations/{orgId}/members/{uid}` block (IN-02, 78-REVIEW.md / T-78-03 accepted residual):**
Phase 78's super-admin arm makes `isOrgEditor(orgId)` true for EVERY super-admin on EVERY org (see
above), which means `allow write` here legally permits a super-admin's client SDK to `create` its
own membership doc for any org. R226 ("entering a church as a super-admin creates NO member doc")
therefore holds only as a CLIENT-CODE contract — `enterOrgAsSuperAdmin` (`src/stores/auth.ts`)
deliberately calls no `setDoc`/`writeBatch` — not as a rules invariant. This is deliberately
accepted, not a functional gap: it matches the phase's documented posture that a super-admin is
fully trusted, and the residual is tracked in both 78-01-PLAN.md's and 78-02-PLAN.md's threat
models. Do NOT "fix" this by narrowing `isOrgEditor` here — the super-admin arm is placed exactly
where it is for the reasons above.

**`slideGroups/{groupId}` `allow delete` (2026-08-12, third recurrence of the "Null value error"):**
`resource == null` MUST be the first operand and MUST stay first. A slot whose slideGroup was
never materialized (never carried slides) is deleted by `confirmSlotDelete` → `deleteGroup` →
`deleteDoc` against a NON-EXISTENT doc, so `resource` is null. Every branch reads
`resource.data.…`; without this guard the first one (`resource.data.keys()`) dereferences null →
"Null value error" → the rule ERRORS → DENY, so the delete is refused and `confirmSlotDelete`
aborts, leaving the slot in place. Same load-bearing pattern as `serviceShareLinks`'s
`resource == null` guard (T-41-09) below. It stays behind `isOrgEditor(orgId)`, so org isolation
is preserved — only an editor of THIS org may delete a non-existent doc under it, and deleting a
non-existent doc is a harmless no-op. A present-but-null `serviceId` is an orphan too: without
that second guard the OR would evaluate `parentGone`/`parentDraft(null)`, and `svcPath(null)`
raises a "Null value error" → the delete is denied and the group is wedged undeletable; it is
reached only when the key is present (the `hasAll` clause short-circuits the absent case first),
so that dot-access is null-safe. The two prior fixes to this line guarded the group document's
FIELD shapes but never the document not existing.

**`/{collection}/{docId}` wildcard (all other nested collections — editors only):** ★
`collection != 'services'`, `collection != 'slideGroups'` AND `collection != 'pptxRenders'` are
all LOAD-BEARING — do not remove any of the three. `{collection}` is a single-segment wildcard, so
this rule also matches `/organizations/{orgId}/services/{docId}`, and Firestore rules are
OR-evaluated: a broader rule that grants access wins over a narrower one that denies. Without the
`services` exclusion the status guard in the `/services` block is a complete NO-OP — an editor's
write to a planned or exported service would succeed through THIS rule even if the `/services`
block reads literally `allow write: if false` (verified against the Firestore emulator,
31-RESEARCH.md, probe A1/A2). Because the exclusion removes the backstop, the `/services` block
must itself grant read, create, update AND delete — it does. The `pptxRenders` exclusion (Phase
42, T-42-01) is the same mechanism a third time: without it, the read-only
`match /pptxRenders/{importId}` block grants no protection against writes, because THIS wildcard
independently grants write to any org editor on any single-segment nested collection, `pptxRenders`
included — an org editor could otherwise forge `status: 'ready'` and an arbitrary `renderedCount`
(threat T-37-15 — `functions/src/index.ts` names it the one outcome the render service "must never
be able to produce"). Proven RED (write succeeding) then GREEN (write denied) against the real
emulator in `src/rules.test.ts`'s `pptxRenders` describe block. Only `write` is excluded for
`services`/`slideGroups`; `read` still falls through here harmlessly for those two, since both
blocks grant read to any org member (strictly broader than `isOrgEditor`). The `slideGroups`
exclusion had to land in the SAME commit as the `/slideGroups` block: before that block existed,
this wildcard was the only rule granting write to slide groups, so excluding it alone would have
denied every slide-group write — including the load-time materialization that runs on DRAFT
services.

**`serviceShareLinks/{serviceId}` `allow read` (T-41-09):** the `resource == null` branch is
load-bearing, not decorative. On a `get`/`getDoc` against a document that does not yet exist,
`resource` is null; dereferencing `resource.data.orgId` in a bare `isOrgEditor(resource.data.orgId)`
clause ERRORS, and an erroring rule DENIES — so the caller would see PERMISSION_DENIED instead of
a clean not-found snapshot. `ensureShareLink`'s very first Firestore operation is exactly that
read on a not-yet-created link doc, and it recurs inside `runTransaction`, so without this branch
the entire adopt-or-create flow is unreachable on its first call. Accepted low-severity residual
(T-41-09, ASVS L1): a signed-in non-member can distinguish "absent" from "denied" for a serviceId
they already know. `serviceId` is an unguessable Firestore auto-ID and is org-private, and no
document content leaks — do not close this by removing the null branch.

### storage.rules

**File-level org-scoped access control (top of file):** mirrors `firestore.rules`' `isOrgMember`
pattern. The generic `orgs/{orgId}` prefix is intentional (not PPTX-specific) so Phase 22's media
attachments and any future Storage-backed feature can reuse this same rule. v1.5 claim migration
(Phase 40) is COMPLETE (Deploy 2, 2026-08-12): membership is proven SOLELY by the custom auth
claim — the pre-existing cross-service `firestore.exists()` fallback arm has been removed. The
claim arm is emulator-verifiable, whereas `firestore.exists()` is inert in the Storage emulator
(firebase-js-sdk#6803) — the exact defect that once let a deny-everyone rule reach production
undetected for a milestone (see CLAUDE.md). Before the fallback was removed, every user was
confirmed single-org (backfill dry-run + mandatory pre-check) and all live tokens were soaked so
they carry the claim (full runbook: `functions/DEPLOY-ORG-CLAIMS.md`). v2.0 multi-org claim
widening (Phase 73): the claim now ALSO carries a full `orgs: {[orgId]: role}` map alongside the
unchanged primary `orgId`/`role` keys (see `functions/src/orgMembershipClaims.ts`).
`isOrgMemberByClaim` checks the requested orgId against the full `orgs` map first, ORed with the
still-present legacy primary-only arm — old/not-yet-backfilled tokens keep working on their
primary org with no access gap while the backfill (`functions/src/backfillOrgClaims.ts`) rolls out.

### functions/src/index.ts

**Forwarded headers (`FORWARDED_HEADERS`):** `x-api-key` and `authorization` for secret-injected
services are overwritten further down the `api` handler, never trusted from the client.

**`requestPptxRenderHandler` — the ready gate (T-37-13):** status flips to `"ready"` only when
THREE independent signals agree, never on the render service's self-report alone (mirrors
`parsePptxHandler`'s own "never trust the caller alone" pattern — an independent org-membership
re-check). The three conjuncts, all required: (1) `actualCount > 0` — the empty-render guard, a
deck that rendered nothing must be `"failed"`, never `"ready"` (its parsed text layer stays usable
either way); (2) `actualCount === reportedCount` — the self-report cross-check; (3) `contiguous` —
catches the partial render that count alone misses (pages 1, 2 and 4 uploaded against a reported
count of 3 would otherwise pass the count check). The independent recount itself only counts
objects whose final path segment matches `RENDERED_OBJECT_NAME`, so a stray upload (e.g. a
thumbnail) can never inflate the count.

**Shared cleanup-sweep safety knob, `readDeleteCap` (66-01 T-66-01-02):** bounds how many objects
a SINGLE LIVE cleanup run may delete. The first LIVE enablement of
`MEDIA_CLEANUP_ENABLED`/`PPTX_RENDER_CLEANUP_ENABLED` (and any future sweep built on this same
helper) may hit a large accumulated backlog; without a cap that first run could fan out an
unbounded number of deletes/cost in one shot. Both sweeps are idempotent-by-age, so anything left
uncapped this run is picked up by the next daily invocation — capping never leaves an object stuck
past its retention window, only spreads its deletion over more runs. Dry-run summaries are NEVER
capped: the owner needs the true backlog count/bytes before flipping the enable flag, not a
truncated one. (R181/R184: this is a thin passthrough over a resolved `AppConfig` rather than a
direct `process.env` read — see `appConfig.ts`'s `coercePositiveInt`.)

**`cleanupExpiredMedia` (R015: 2-week Storage retention) — safety contract (22-03 threat model
T-22-03-01..05):** `MEDIA_PATH_GUARD` is applied to every candidate BEFORE any delete decision —
only objects under `orgs/{orgId}/media/` are ever eligible; `pptx-imports` and every other Storage
path are structurally excluded, even when old. `getFiles()` is scoped with prefix `"orgs/"` —
never the bucket root — as a second, independent bound on the blast radius. Age is keyed on the
object's native GCS `timeCreated` (server-set at upload time), NEVER on client-settable custom
metadata — a user cannot backdate metadata to force-expire another org's media early. R181: the
handler now reads `appConfig/global` via the Admin SDK (its first-ever Firestore read) for its
enable flag/retention/cap; it still touches NO slide documents, slot metadata, or slide text —
`appConfig/global` is the only doc it ever reads. FAILS SAFE: deletion requires an explicit opt-in
(`cleanup.mediaEnabled=true`); unset/false/malformed runs as a dry-run that scans and logs what
WOULD be deleted and deletes nothing. History: this originally shipped in 22-03 gated on
`MEDIA_CLEANUP_DRY_RUN === "true"`, which meant an UNSET env var produced LIVE deletion while the
comment claimed the opposite — a destructive daily scheduled job must default to safe, so the gate
was inverted to an explicit enable (`MEDIA_CLEANUP_DRY_RUN` is no longer read at all). Idempotent
by age: deletion eligibility depends only on an object's own `timeCreated` vs "now", never on
prior-run state, so a partially-failed run is safely retried by the next daily invocation; per-file
deletes are each wrapped in try/catch so one failure never aborts the whole run.

**`cleanupOrphanRenders` (R062: dry-run-by-default orphan sweep):** a second, SEPARATE scheduled
job from `cleanupExpiredMedia`. Not folded into that handler because it must read the
`pptxRenders` queue (Firestore) — historically something `cleanupExpiredMedia` never touched at
all; as of R181 both handlers also read `appConfig/global`, but neither ever reads
slide/service/song content docs. Safety contract: FAILS SAFE — real deletion requires an explicit
opt-in, `cleanup.pptxRenderEnabled=true`; unset/false/malformed runs as a dry-run (same gate shape
and direction as `cleanupExpiredMedia`'s post-incident fix — the 2026-07-28 incident, commit
9f1b881, was precisely an inverted gate whose doc comment claimed the opposite default from what
the code implemented; this comment describes only the default the code actually implements).
`RENDERED_OBJECT_GUARD` is applied to every listed Storage object BEFORE any delete decision —
only objects under `orgs/{orgId}/pptx-imports/{importId}/rendered/` are ever eligible; a deck's
`source.pptx` and its extracted `images/` are structurally unreachable through this guard, no
matter how stale the render doc is. Only `pptxRenders` docs whose status is `"pending"` or
`"failed"` and whose `createdAt` is older than `ORPHAN_RENDER_STALE_HOURS` are ever candidates —
a `"ready"` render is never a candidate (excluded by the status filter), and an in-flight
`"pending"` render younger than the staleness window is skipped; a doc with an unreadable
`createdAt` is skipped rather than treated as old (fail safe, matching
`cleanupExpiredMediaHandler`'s own NaN handling of an unparseable `timeCreated`). Age is keyed on
the server-set Firestore `createdAt` timestamp, never on client-settable input. Per-object deletes
are each wrapped in their own try/catch so one failure never aborts the run; the render doc's own
delete is likewise wrapped so a doc-delete failure cannot abort the scan of remaining candidates.
Runs on its own daily schedule, 03:00 UTC — deliberately one hour after `cleanupExpiredMedia`'s
02:00 UTC, so the two sweeps never overlap.

**`cleanupOrphanBackgrounds` (R167: orphan+age background sweep, Phase 66-02):** a NEW sweep,
never shipped before this phase. Backgrounds (`orgs/{orgId}/backgrounds/{backgroundId}/{fileName}`,
written by `src/composables/useBackgroundUpload.ts`) are structurally exempt from
`cleanupExpiredMediaHandler`'s `MEDIA_PATH_GUARD` and were never pruned at all until now. Safety
contract (T-66-02-01/T-66-02-03/T-66-02-05): this is ORPHAN+AGE, deliberately NEVER pure age — a
background is only a deletion candidate once it is BOTH (a) unreferenced by any live document at
ANY of three tiers, AND (b) older than `BACKGROUND_RETENTION_DAYS`; a 90-day-old background still
set on an active slide is never eligible regardless of age. The three reference tiers, all
enumerated via plain `collectionGroup()` scans (no composite index required): (1) Group tier —
`organizations/{orgId}/slideGroups/{slotId}.backgroundImageUrl`; (2) Slide tier — the SAME doc's
embedded `slides[]` array, each entry's `backgroundImageUrl` (an array field, not a subcollection);
(3) Song tier — `organizations/{orgId}/songs/{songId}/lyrics/{lyricsId}.backgroundImageUrl`.
References are stored as full Firebase download URLs; `extractBackgroundObjectPath()` recovers the
exact object name from the `/o/{path}` segment (URL-decoded) so it can be compared 1:1 against
`file.name` from the bucket listing. REFERENCES-INCOMPLETE FAIL-SAFE: if any non-empty
`backgroundImageUrl` cannot be parsed to an object path, or either `collectionGroup` scan throws,
`referencesComplete` is set to false and the ENTIRE run is forced to dry-run — it deletes NOTHING
that run regardless of `BACKGROUND_CLEANUP_ENABLED`. The sweep never deletes when it cannot prove
an object is unreferenced; under-deletion is always preferred over deleting a live background.
FLOOR GUARD (beyond the throw/parse-failure fail-safe): a reference scan that returns silently
EMPTY — no throw, no unparseable URL, just zero docs/zero references — must never be trusted as
"nothing anywhere is referenced". If there are background objects to consider at all
(`candidates.length > 0`) but the reference Set ended up with zero entries, references are ALSO
treated as incomplete and the run stays dry-run — this closes the gap the throw/parse-failure
fail-safe alone doesn't cover: a scan that "succeeds" against the wrong collection, an empty
project, or a permissions issue that silently returns no docs. `BACKGROUND_PATH_GUARD` is applied
to every candidate BEFORE any delete decision, mirroring `MEDIA_PATH_GUARD`/
`RENDERED_OBJECT_GUARD` — only objects under `orgs/{orgId}/backgrounds/` are ever eligible. Runs
on its own daily schedule, 05:00 UTC — after media (02:00), orphan-renders (03:00), and reminders
(04:00), so the sweeps never overlap.

**`previewCleanupDryRun` (R188/R190: on-demand blast-radius preview):** a super-admin-only
`onCall` that gives the Owner Console a truthful, on-demand "what would this cleanup delete right
now" count for any of the four `*_CLEANUP_ENABLED` sweeps, WITHOUT ever deleting anything and
WITHOUT depending on the sweep's stored enable flag — the server half of the safe-flip flow this
phase adds in front of those flags (R189 is the client confirm-to-flip UI, a separate plan).
Safety contract: reuses the SAME scan/reference-detection code the real cron uses — dispatches to
the four handlers with `{ forceDryRun: true }` rather than forking a second scan-and-count
implementation, so the preview can never under/over-count relative to what a live run would
actually do (71-RESEARCH.md explicitly rejected a forked pure function as strictly higher risk for
zero benefit). `forceDryRun` structurally short-circuits each handler's dry-run branch to true
BEFORE any delete branch is reached, independent of the live `cleanup.*Enabled` config value; the
belt-and-suspenders `if (!s.dryRun) throw` is a defense-in-depth assertion of that guarantee, not
the guarantee itself. Caller re-verification mirrors `setSuperAdminClaimHandler` exactly: two
independent server-side checks (the ID-token `superAdmin` claim AND a fresh `superAdmins/{uid}`
Firestore read) — a client-declared authority flag is never trusted.

**`sendScheduledReminders` daily reminder cron (61-02: R145/R133/SC3/SC4):** the R145 reminder
engine — a daily `onSchedule` cron that auto-enqueues the shared service link to everyone assigned
N days before a service, reckoned in the org's LOCAL timezone (R133), exactly once (SC4). It
mirrors `cleanupOrphanRendersHandler` exactly: a broad
`collectionGroup('services').where('status','in',['planned','exported'])` scan (NEVER `'draft'`,
so a draft is structurally unreachable — SC4), the org id recovered from the parent chain (never a
client field), a per-item try/catch so one bad service never aborts the daily run, the handler
body exported separately from the wrapper for direct unit test, and its own 04:00 UTC slot
(offset from `cleanupExpiredMedia`'s 02:00 and `cleanupOrphanRenders`' 03:00 so the three daily
sweeps never overlap). It enqueues via the SHARED `createQueuedMessage()` shaper, so a
cron-created reminder is byte-identical to a human send at the `sendQueuedMessage` trigger. It
holds NO secret — only `sendQueuedMessage` binds `RESEND_API_KEY` (R131 smallest key-holding
surface).

**Scheduled-messaging cron orchestrator (`runScheduledMessagingCron`):** TWO sweeps share ONE
daily invocation (one Cloud Scheduler job, one deploy): the reminder sweep (R145) and the
schedule-for-later dispatch sweep (R141, 61-03), each in its OWN try/catch so a failure in one
never aborts the other. R170: the body used to live directly in the `onSchedule` callback; it is
now extracted into this EXPORTED orchestrator exclusively so a config gate can sit at its very
top, before EITHER sweep — and therefore before the first `collectionGroup` call either sweep
makes. Default OFF (unset, false, or malformed — the same fail-CLOSED idiom as the cleanup enable
flags, R181/R184): gating the WHOLE function off is the lowest-cost option and kills BOTH the
reminder `collectionGroup('services')` scan AND the schedule-for-later
`collectionGroup('messages')` scan — zero cross-org reads when disabled. DISCLOSED behavior
change: gating the whole function off also disables `dispatchDueScheduledMessagesHandler`, i.e.
the composer's "schedule for later" send. To restore either, flip
`messaging.scheduledCronEnabled=true` in `appConfig/global` — no redeploy needed, takes effect on
the very next scheduled run.

**`dispatchDueScheduledMessagesHandler` (61-03: R141 schedule-for-later):** the Phase 59
carryover — actually SEND user-scheduled messages. The composer (59-02) writes a
`status:'scheduled'` messages doc (`createQueuedMessage`) that `sendQueuedMessage`, an
`onDocumentCreated` trigger, leaves inert by design. Flipping that existing doc's status to
`'queued'` would NOT re-fire the create trigger (the whole trap), so this sweep CREATES A FRESH
`'queued'` doc instead — a genuine `onDocumentCreated`. Finds due user-scheduled messages and
dispatches each by (1) transactionally claiming the ORIGINAL `scheduled`→`dispatched` transition
(only if still `'scheduled'` — the idempotency guard that makes an at-least-once cron retry a
no-op) and (2) creating a FRESH `status:'queued'` doc via the shared `createQueuedMessage` shaper
so `onDocumentCreated` fires `sendQueuedMessage` exactly as for a human send. The scan is a
single-field equality `collectionGroup('messages').where('status','==','scheduled')` — the SAME
no-index class as the reminder scan; due-ness (`scheduledFor <= now`) is filtered in CODE, not the
query, so no composite index is introduced.

**`queueServiceMessage` send-path enqueue (59-02: R131/R137/R141):** the thin enqueue half of the
send path, mirroring the `parsePptxHandler` → pptxRenders queue → `requestPptxRender` triad: an
`onCall` Function whose handler body is exported separately from the wrapper for direct unit
testing. It re-authorizes the caller server-side (editor-tier of the PATH-derived org, never the
client-declared orgId), re-reads the org messaging kill-switch, validates the request, and writes
ONE `messages/{id}` doc via the shared `createQueuedMessage()` shaper. It resolves no recipients
and sends nothing — the 59-03 trigger does that, and is the only Function that holds
`RESEND_API_KEY`.

**`createQueuedMessage` — the single canonical `messages/{id}` doc-shaper:** pure, no Firestore
I/O (mirrors `pptxRenderDocRef`'s "one canonical shape so the callable and the trigger cannot
drift", and `buildServiceSnapshot`'s pure field-assembly). Factored out precisely so
`queueServiceMessage` and Phase 61's cron produce an IDENTICAL shape (R141). Status is
`'scheduled'` when a `scheduledFor` instant is present, else `'queued'` (send-now).
Optional/absent leaves are normalized to `null` (`scheduledFor`, `changeDiff`, `sentAt`) rather
than left `undefined` — Firestore rejects `undefined`.

**`queueServiceMessageHandler` (59-02 threat model T-59-02a..e):** exported separately from the
`onCall` wrapper (the `parsePptxHandler`/`parsePptx` precedent) so tests invoke it directly with a
fake `CallableRequest`. Requires Firebase Auth. Independently re-reads
`organizations/{orgId}/members/{uid}` and requires the member's role ∈ `['editor','admin']` — a
viewer or a wrong-org caller is rejected; the client-declared orgId is used ONLY to scope the
Firestore path, membership and role are re-verified for THAT path (mirrors `parsePptxHandler`'s
membership re-check and `firestore.rules`' `isOrgEditor`). Re-reads the org messaging kill-switch
(`settings.messaging.enabled`) server-side and rejects when off — the composer's disabled entry
point is convenience, this is the boundary. Validates the type enum (R137) and `scheduledFor`
sanity before any write. Writes exactly ONE `messages/{id}` doc via the shared
`createQueuedMessage` shaper and returns its id; resolves NO recipients and sends nothing (the
59-03 trigger does that). Holds NO secret.

**`recordBounce` — idempotently record a hard bounce against an addressed recipient:** runs ONE
transaction that reads the recipient status AND the message's current count BEFORE any write
(mirrors `sendQueuedMessageHandler`'s transition-guarded claim). Only on the not-bounced →
bounced transition does it set `status:'bounced'` + `bounceReason` + `bouncedAt` and write
`deliveryCounts.bounced` as a LITERAL `prev+1` (NOT `FieldValue.increment`). A duplicate
at-least-once delivery finds status already `'bounced'` and no-ops, so the count never
double-counts. The dot-path `'deliveryCounts.bounced'` merges into the existing `{sent,failed}`
leaf; a missing leaf is treated as 0, so older docs need no migration.

**`syncOrgMembershipClaim` re-export (R074/R075: the claim `storage.rules` reads):** sets the
`{ orgId, role }` custom auth claim that `storage.rules`' dual-read `isOrgMemberByClaim(orgId)`
arm reads as `request.auth.token.orgId`/`request.auth.token.role`. One `onDocumentWritten` trigger
on `organizations/{orgId}/members/{uid}` covers create, role change and delete. Invite acceptance
(`ensureUserDocument`'s batch `.set()` on this same document) flows through this trigger too, so
no separate invite-specific code path is needed. Implementation lives in `./orgMembershipClaims`
so its shared decision logic (`decideMembershipClaim`) can be imported by the backfill script
without duplicating it. Only the deployed trigger is re-exported here — `decideMembershipClaim`,
`buildOrgMembershipClaim` and `syncOrgMembershipClaimHandler` are intentionally NOT part of this
module's exports, mirroring how `requestPptxRenderHandler` is reachable only via a direct module
import in tests.

**`superAdminClaims` re-export (68-02: `syncSuperAdminClaim` trigger + `setSuperAdminClaim`
onCall, R174/R175-B/R176/R179):** implementation lives in `./superAdminClaims` so its testable
handlers (`syncSuperAdminClaimHandler`, `setSuperAdminClaimHandler`) can be imported directly by
tests without going through the deployed wrappers. Only the two deployed Functions are re-exported
here — the handlers are intentionally NOT part of this module's exports, mirroring
`syncOrgMembershipClaim`. `bootstrapSuperAdmin.ts` (the owner-run first-grant script) is
deliberately NOT imported or exported here — it is a Node script, not a deployed Function.

**`orgProvisioning` re-export (Phase 74: `onboardOrganization`/`assignOrgAdmin`/
`listOrganizations`, R196-R206; Phase 76: `setOrgActive`, R212-R214):** implementation lives in
`./orgProvisioning` so its testable handlers can be imported directly by tests without going
through the deployed wrappers. The deployed Functions are re-exported here so Firebase discovers
them from the entry point — mirrors `syncOrgMembershipClaim`/`setSuperAdminClaim`. Shipped
built+tested+UNDEPLOYED per 74-01-PLAN.md's/76-01-PLAN.md's hand-over deploy notes
(`setOrgAiEnabled` added Phase 82, R242-R243; `setOrgBibleEnabled` added Phase 101, R295 — a
callable not re-exported here is silently missed by `firebase deploy`, see
`functions-must-reexport-from-index.md`).

### functions/src/appConfig.ts

**Module overview (R180-R184: Firestore-backed runtime config):** deliberately does NOT call
`initializeApp()`/`getFirestore()` at module scope — mirrors `claimsHelpers.ts`'s convention.
`getAppConfig(db)` always takes an injected Firestore instance as its first parameter so both the
deployed runtime (which initializes the Admin SDK itself) and unit tests (a fake db) can call it
identically. `appConfig/global` is a single admin-only Firestore doc (Phase 68 rules gate WHO may
write it to super-admins; the Admin SDK bypasses rules to read it here). Its shape mirrors the
v1.8 `process.env`/`defineString` knobs, grouped by area. A missing or partial doc is deep-merged
onto `DEFAULT_APP_CONFIG` (R182) so today's behavior is reproduced byte-for-byte until an operator
explicitly writes a value. The `coerce*` layer is the input-validation boundary: the Phase 68
rules enforce WHO writes `appConfig/global`; this layer enforces WHAT shape is trusted once read
back, per-knob, per the R184 fail-open/fail-closed table (see CONTEXT.md/RESEARCH.md for the full
rationale per knob).

**`DEFAULT_APP_CONFIG`:** holds the EXACT current env/`defineString` fallback values (R182 source
of truth) — every field cites its origin read-site in `index.ts` so a future diff of that file's
defaults can be checked against this constant. Phase 70 (R186): `src/config/appConfigDefaults.ts`
is a DELIBERATE CLIENT-SIDE DUPLICATE of this interface + constant (`src/` cannot import
`functions/` — separate build targets). If you change a default value here, mirror the change
there too, or the Owner Console's (default) badge will show a stale value —
`src/config/__tests__/appConfigDefaults.test.ts`'s drift-guard snapshot test will fail if the two
fall out of sync.

**`getAppConfig` caching (R183):** asymmetric by design — hot request-path callers (the `api`
proxy, `sendQueuedMessage`) use the default cached form (a module-scope `{ value, fetchedAt }` TTL
cache, refreshed every ~60s); cron callers (the cleanup handlers, `sendScheduledReminders`) MUST
pass `{ fresh: true }` to always re-read. WHY a TTL and not an `onDocumentWritten` cache-bust: a
Cloud Functions v2 instance's global scope is per-instance-process memory. A trigger firing on
`appConfig/global`'s update runs as its own invocation, routed to whichever instance the platform
happens to pick — it cannot reach into a sibling warm instance's in-memory cache to clear it. A
cache-bust design is therefore correct for at most one of N warm instances, leaving every other
one serving a stale value until it independently re-reads. A TTL is the only pattern that is
correct regardless of instance count.

### functions/src/backfillLastUsed.ts

**`backfillLastUsedForOrg` body:** reads all `organizations/{orgId}/services` and
`organizations/{orgId}/songs` docs ONCE (see SCALE note, INTEGRATIONS.md § this file), then for
each song computes `MAX(locked service date)` via the mirrored `computeLastUsedDate` and applies
the conservative write rule — `maxDate === null` (no locked service contains the song) → SKIP,
never write; `maxDate !== null` and the song's existing `lastUsedAt` already equals the computed
Timestamp → SKIP (idempotent, already-current); otherwise → WRITE (only when `apply`)
`lastUsedAt` to `Timestamp.fromMillis(serviceDateToMillis(maxDate))` — always counts as processed,
even in a dry run, so the summary reflects the INTENDED change.

**CLI wrapper (`runBackfillCli`):** guarded so importing this module (as
`backfillLastUsed.test.ts` does) never calls `initializeApp()` or touches a live project — only
running it directly does (mirrors `backfillOrgClaims.ts`'s identical guard). Usage (after
`npm run build` from `functions/`): `node lib/backfillLastUsed.js` (dry run, sole org),
`--apply` (writes for real), `--org berean` (explicit org). Credentials resolve from
`GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default login`. The whole body is
wrapped in try/catch, mirroring `backfillOrgClaims.ts`'s `runBackfillCli` — a rejection before any
song is processed (bad/expired credentials, wrong project, multi-org abort, network failure)
produces a readable diagnostic and a non-zero exit code instead of an unhandled rejection.

### functions/src/backfillOrgClaims.ts

**Module overview (R074/R075: give the two existing users the claim):** PURPOSE —
`syncOrgMembershipClaim` (`./orgMembershipClaims.ts`) only fires on FUTURE writes to
`organizations/{orgId}/members/{uid}`. Members whose document was already in place before that
trigger was deployed have never had it rewritten, so without this backfill they carry no claim
until something touches their member doc again. WIDENED (73-03-PLAN.md, R210): this script also
backfills the additive `orgs` map (73-01-PLAN.md, R207) for every existing user, not just the
primary `{ orgId, role }` claim — the trigger's per-write orgs recompute
(`computeOrgsClaimForUid`) only ever runs on a FUTURE membership write, exactly the same gap the
original backfill closed for the primary claim; this backfill closes it for `orgs` too, from a
single grouped scan, and writes through `mergeAndSetCustomClaims` rather than a bare
`setCustomUserClaims` so a superAdmin grant (Phase 68) is never wiped by a backfill run
(R208/T-73-01). THIS IS A NODE SCRIPT, NOT A DEPLOYED FUNCTION (D-12) — run by the owner with
admin credentials, deliberately NOT exported from `functions/src/index.ts`. SCALE (D-10):
population is 2 active users + 1 never-accepted invite (owner, 2026-08-06) — no cursor, no
pagination, no batching, no rate limiting, no resume-from-offset; a single
`collectionGroup('members').get()` is correct and complete at this size — do not add scale
machinery here. SINGLE SCAN, GROUPED BY UID IN MEMORY (73-RESEARCH.md Pattern 4): the ONE
`collectionGroup('members').get()` is grouped by uid in memory into a per-uid membership list —
deliberately NOT the trigger's per-write `computeOrgsClaimForUid` (`orgMembershipClaims.ts`),
which does its OWN fresh `collectionGroup('members').get()` scan (correct for a single uid on a
single write, but would turn this backfill into an O(n) re-scan if called from inside this loop —
exactly the anti-pattern 73-RESEARCH.md warns against). SHARED DECISION LOGIC (DISC-02, T-40-05,
D-11): imports `decideMembershipClaim`, `buildOrgsMapClaim`, and `resolveOrgId` from
`./orgMembershipClaims` rather than reimplementing primary-org resolution, role normalisation, the
orgs-map shape, or the structural members-doc guard — a second implementation would drift from
the trigger and could write a disagreeing claim to production. SAFETY (D-13/D-14, T-40-10): dry
run is the default; nothing is written to Auth unless `--apply` is passed; the CLI wrapper prints
the resolved project id and a dry-run banner before doing any work. THE NEVER-ACCEPTED INVITE: a
pending invite lives at `organizations/{orgId}/invites/{email}` and `inviteLookup/{email}` — it
has NO `organizations/{orgId}/members/{uid}` document, so it is structurally never visited by this
script; its claim is set by the trigger at the moment the invite is accepted
(`src/stores/auth.ts`'s `ensureUserDocument`/`loadOrgContext`), not by this backfill.

**`backfillOrgMembershipClaims`:** iterates every `organizations/*/members/*` document ONCE,
grouped by uid in memory, and for each uid reconciles ONE Admin SDK write carrying the PRIMARY
`{ orgId, role }` claim (via `decideMembershipClaim` on the user's primary-org membership,
unchanged primary logic, D-11) and the additive `orgs` map (via `buildOrgsMapClaim` applied to
this uid's in-memory group — no second scan, no second "what orgs" implementation). Idempotent by
skip-if-already-matching (D-11, extended to `orgs`): re-running after an interruption is always
safe — every already-current account (primary keys AND orgs both matching) is reported as
skipped, not re-written, and there is no cursor state that could itself go stale. Writes via
`mergeAndSetCustomClaims` (R208/T-73-01), never a bare `setCustomUserClaims` — a bare replace
would silently wipe an unrelated claim (e.g. Phase 68's `superAdmin:true`) the moment this
backfill next ran for that uid.

### functions/src/inviteOnboarding.ts

**`isGoogleEmail` domain-suffix classifier (99-CONTEXT.md's leaning default):** for the invitee-
type branch. Normalize FIRST (`.trim().toLowerCase()`) before calling — mirrors
`resolveAdminTarget`'s `normalizedEmail` discipline. `googlemail.com` is a real, still-valid Gmail
alias domain (older/UK-registered accounts) and must be checked alongside `gmail.com`. A custom
Google Workspace domain (e.g. `bob@somechurch.org`) is deliberately NOT detected here — it takes
the non-Google branch, whose set-password email also offers a Google sign-in fallback line so
that user is never stranded.

### functions/src/orgMembershipClaims.ts

**Module overview (R074/R075: the claim `storage.rules` reads):** deliberately does NOT call
`initializeApp()` at module scope — `functions/src/index.ts` already does that for the deployed
runtime, and the backfill script does it for the owner-run CLI runtime; calling it here would
break one of the two callers. The claim this module computes is consumed directly by
`storage.rules`' `isOrgMemberByClaim(orgId)` helper as `request.auth.token.orgId`/
`request.auth.token.role`. The two readable top-level key names (`ORG_CLAIM_KEYS`) are
byte-for-byte what that rule reads — changing either name here without updating `storage.rules`
would silently break the claim arm while every test on both sides kept passing.

**`resolveOrgId` structural guard:** in the spirit of `index.ts`'s `MEDIA_PATH_GUARD` — mirrors
`backfillOrgClaims.ts`'s `resolveOrgId` byte-for-byte (D-11: one guard shared by the trigger and
the backfill). A `members` document is only ever a real membership candidate when it is a child of
an `organizations/{orgId}` document. `collectionGroup('members')` matches ANY subcollection
literally named `members` anywhere in the database, so this guard is applied to every candidate
before it can affect a claim. Returns the org id on success, `undefined` when the guard fails.

**`computeOrgsClaimForUid`:** recomputes the full `orgs` map for `uid` from the SURVIVING
`organizations/*/members/{uid}` documents — NEVER from `users/{uid}.orgIds`. 73-RESEARCH.md
Pattern 1 proves `orgIds` is structurally overwrite-broken: both the invite-acceptance and
org-auto-create paths in `src/stores/auth.ts` RESET it to a single-element array rather than
appending, so it can never list a second org, and it is also never updated on a client-side
member deletion — a live collectionGroup scan of the actual membership documents is the only
authoritative source for "which orgs does this uid currently belong to". This runs an UNFILTERED
`collectionGroup('members')` scan, filtered client-side to `doc.id === uid` — Firestore
collection-group queries cannot filter by document-ID equality across differing parent paths
(73-RESEARCH.md Pattern 2), so this is the correct query shape, not a missed optimisation; it is
proportionate at this project's current scale (a handful of users per org) — if a future cost
audit finds the per-write full scan material, the documented scale-out path is a denormalised
`uid` field on every member doc plus a collection-group field-override index (do not build that
speculatively). Firestore's default read/query mode is strongly consistent, so calling this
immediately after the SAME event's own triggering write has committed is race-free — a delete just
committed by this very trigger is guaranteed to already be absent from this scan.

**`orgsMapsEqual`:** shallow-equal for two `orgs` maps. `undefined` (no `orgs` claim key at all —
a legacy pre-widening token) is treated as equivalent to `{}` (a freshly-computed empty map for a
user with zero surviving memberships), so a legacy claim for a user with no memberships correctly
compares as "already current" rather than triggering a spurious write. Exported (IN-01,
73-REVIEW.md) so `backfillOrgClaims.ts` imports this SAME implementation rather than maintaining
its own verbatim copy — the two signatures had already started to drift (this one accepts
`undefined` for `current`, the old backfill copy required a non-optional `Record`), which is
exactly the kind of divergence a shared helper (mirroring `buildOrgsMapClaim`/`resolveOrgId`'s
existing pattern) prevents.

### functions/src/orgProvisioning.ts

**Module overview (Phase 74, R196-R206: the owner-console org-provisioning callables):**
deliberately does NOT call `initializeApp()` at module scope — mirrors
`superAdminClaims.ts`/`orgMembershipClaims.ts`: `functions/src/index.ts` already does that for the
deployed runtime; calling it here would break that caller. All three callables are gated by the
SAME dual super-admin caller check (`assertSuperAdminCaller`) that `setSuperAdminClaimHandler`
established: reject an unauthenticated caller, reject a caller whose ID-token claim lacks
`superAdmin`, AND independently re-read `superAdmins/{callerUid}` from Firestore — never trust a
client-declared authority flag alone. Neither callable ever writes a custom claim itself — the
`members/{uid}` write is what fires `syncOrgMembershipClaim` (`orgMembershipClaims.ts`), which is
the SOLE claim writer for org membership, mirroring the source-doc → trigger → claim indirection
already established elsewhere in this codebase.

**`assertSuperAdminCaller` (the single caller-gate helper, R200/R204):** applied verbatim by all
three handlers — mirrors `setSuperAdminClaimHandler` exactly. Factoring it into one function keeps
the dual re-verification from drifting between handlers. Returns the verified caller uid.
Exported (Phase 77, R216) so `deleteOrganizationHandler` (`orgDeletion.ts`) reuses this SAME gate
verbatim rather than forking a second implementation (T-77-01).

**`onboardOrganizationHandler` — R202 ATOMICITY:** `resolveAdminTarget` (the ONLY Auth network
call) runs BEFORE any Firestore write, then ALL writes happen inside ONE `runTransaction` — the
single read is `tx.get(orgNames/{nameKey})` first (all `tx.get` calls must precede all tx writes,
a hard Firestore constraint); if that doc exists, throw `already-exists` before any write.
Otherwise every write — orgNames claim, `organizations/{orgId}` + seeded settings, AND the
first-admin membership/invite via `writeAdminAssignment` — is enqueued on that SAME transaction.
There is NO post-commit admin-assignment step, so a transient failure (an aborted transaction, or
a non-`user-not-found` error from `resolveAdminTarget` before it) commits nothing, and a clean
same-name retry succeeds without manual cleanup.

**`assignOrgAdminHandler` — Orphan guard (T-74-06):** rejects a typo'd/nonexistent `orgId` BEFORE
any write, so no orphaned membership is ever created under an id with no matching org. Reuses the
EXACT same `writeAdminAssignment` helper `onboardOrganization` uses — here the `writer` is a
`WriteBatch` (there, a `Transaction`) — so the R206 additive `arrayUnion` guarantee never forks
into two implementations.

### functions/src/orgTemplateSeed.ts

**Module overview (Phase 74, R197/R198):** pure, data-only ported seed content for a newly
onboarded org — the Suggested Template (`buildSuggestedTemplateEntries()`) and the default
`OrgSettings` literal. `functions/` is a standalone TypeScript project (its own tsconfig,
`include: ["src"]`, no `@/` alias) — it cannot import from the client `src/` tree, so this file is
a DUPLICATE of the pure client helpers, kept in lockstep with `src/utils/slotTypes.ts`
(`buildSuggestedTemplateEntries`/`buildSlots('1-2-2-3')`) and `src/types/organization.ts`
(`DEFAULT_ORG_SETTINGS`), following the same precedent as `functions/src/serviceRoles.ts` (which
hand-mirrors `src/utils/serviceRoles.ts`). A drift here would seed a new org's default
template/settings differently from a normally-created org's. There is NO VW-typing/`buildSlots`
logic to port: for the fixed `'1-2-2-3'` progression, `buildSlots` reduces to a FIXED 9-entry
`{kind, section}` sequence (traced directly from `src/utils/slotTypes.ts`'s `buildSlots`/
`defaultSectionForPosition`) — only that resulting static table is ported, not the progression
machinery that produced it. Kept PURE — no Firestore/Auth access anywhere in this module; the
caller (`orgProvisioning.ts`'s `onboardOrganizationHandler`) writes the returned objects into the
org document itself.

### functions/src/pptxParser.ts

**Module overview (PPTX → native slide mapping, Phase 21, R010/R011/R012):** `functions/` is a
standalone TypeScript project (its own tsconfig, cannot import from `src/`), so the slide shapes
in this file are hand-mirrored from the app's canonical types rather than imported. Keep field
names identical to `src/types/slide.ts`'s `TextSlide { contentKind: 'text', title?, body }` and
`ImageSlide { contentKind: 'image', imageUrl, altText? }` — if those app-side shapes change,
update `MappedTextSlide`/`MappedImageSlide` here too.

### functions/src/serviceRoles.ts

**Module overview (server-side recipient resolver, Phase 59, R131/R139):** `functions/` is a
standalone TypeScript project (its own tsconfig with `include:["src"]`, no `@/` alias — it cannot
import from the client `src/` tree), so this file is a DUPLICATE of the pure client resolvers
rather than an import, following the same precedent as `functions/src/pptxParser.ts` (which
hand-mirrors the app slide types). Ported verbatim from `src/utils/serviceRoles.ts`
(`findQuarterForDate`, `resolveServiceRoleAssignments`) and `src/utils/messagingRecipients.ts`
(the reachability split of `resolveRecipients`). The port is PURE (types only, no Firestore):
59-03's `sendQueuedMessageHandler` Admin-SDK-loads the service/quarters/roles/people arrays in the
CALLER and feeds them through these functions. Keep the resolve body in lockstep with the client
originals — a drift would make the server send list disagree with the composer's "Reaches N"
estimate. The ONLY behavioral addition over the client resolver is per-recipient `roleNames`
(`resolveMessageRecipients`), which the send trigger needs to render `{{their_roles}}` correctly
for each recipient (R139). Phase 85 (R250): the client narrowed `RoleGroup` to
`"band" | "tech" | "other"` and folded vocals into Band via a `vocal` flag, with a read-time
compat shim (`src/stores/roster.ts`) coercing any legacy `group: 'vocals'` doc to
`{ group: 'band', vocal: true }`. This file's `RoleGroup` is narrowed to match, and the equivalent
coercion is applied where roles are Admin-SDK-loaded (`functions/src/index.ts`,
`sendQueuedMessageHandler`) — the ONE read boundary on the server side, mirroring the client's ONE
read boundary in `roster.ts`'s `onSnapshot`.

**`resolveMessageRecipients`:** resolves a `{ teams, individualPersonIds, includeEveryone }`
selection into deduped (by person id), reachability-split recipient lists with per-recipient
`roleNames` — server-side enrichment of the client `resolveRecipients` split. `includeEveryone`
matches every assigned role regardless of group. A person assigned to two matching roles/teams is
deduped to one entry and accumulates BOTH role names (in resolve order) onto `roleNames`. A
matched person with `email === ''` is excluded from `reachable` and increments
`unreachableCount`. An unfilled role (`effectivePersonIds === []`) contributes 0 recipients and
does NOT change `unreachableCount`. A matched personId absent from `people` (stale/deleted) is
silently skipped and does NOT increment `unreachableCount`. `individualPersonIds` are always
included; a person matched ONLY as an individual carries `roleNames === []` (no team role accrues
to them). PURE: the caller (59-03 `sendQueuedMessageHandler`) resolves `assignments` via
`resolveServiceRoleAssignments` and loads `people` from Firestore, then feeds both arrays here —
no Firestore access inside this function.

### functions/src/superAdminClaims.ts

**Module overview (R174/R175-B/R176/R179: the owner-console access gate):** deliberately does NOT
call `initializeApp()` at module scope — mirrors `orgMembershipClaims.ts`: `functions/src/index.ts`
already does that for the deployed runtime, and `bootstrapSuperAdmin.ts`'s `runBootstrapCli` does
it for the owner-run CLI runtime; calling it here would break one of those two callers.
`superAdmins/{uid}` document existence IS the source of truth (68-CONTEXT.md "Claim model"): the
`syncSuperAdminClaim` trigger is the SOLE writer of the `superAdmin` claim, mirroring the existing
source-doc → trigger → claim indirection already established by `orgMembershipClaims.ts`.
`setSuperAdminClaimHandler` (the `onCall`) never sets the claim itself — it only writes/deletes the
source document and lets the trigger react.

**`syncSuperAdminClaimHandler`:** exported separately from the `onDocumentWritten` wrapper —
mirrors `syncOrgMembershipClaimHandler`/`syncOrgMembershipClaim`. Every write routes through
`claimsHelpers` (R175): a grant MERGES `{ superAdmin: true }` onto the user's existing claims
(preserving `{ orgId, role }` if present — SC1 direction B in reverse), and a revoke clears ONLY
the `superAdmin` key, preserving `{ orgId, role }` (SC1 direction B). The whole body is wrapped in
try/catch and resolves with a failure outcome rather than rethrowing — a throw out of a Firestore
trigger causes Cloud Functions retries that would hammer the Auth API (mirrors T-40-08's fix in
`orgMembershipClaims.ts`).

**`setSuperAdminClaimHandler`:** exported separately from the `onCall` wrapper — mirrors
`parsePptxHandler`/`parsePptx` and `queueServiceMessageHandler`/`queueServiceMessage`. Security
contract (T-68-03, defense-in-depth): the CALLER's authority is re-verified server-side TWO
independent ways — the caller's own ID-token claim (`request.auth.token.superAdmin`) AND a fresh
Firestore re-read of `superAdmins/{callerUid}` — never trusting a client-declared authority flag.
The TARGET is resolved exclusively via `getAuth().getUserByEmail()`, never a client-supplied uid,
so a caller can never point this at an arbitrary uid they merely guessed.

---

*Architecture analysis: 2026-07-16*
