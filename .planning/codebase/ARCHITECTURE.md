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
- **Sanctioned exception (ARCH-020/R360):** `claudeApi.ts` (`isAiEnabled`), `messaging.ts`
  (`isMessagingEnabled`), and `scriptureApi.ts` each call `useAuthStore()` directly to read a
  read-only boolean settings gate, inverting the utils-called-by-stores direction above. This is
  accepted as-is rather than refactored to a pass-in parameter: the reads are read-only (never a
  mutation), carry no correctness or data-integrity risk, and cannot cause a circular-import
  failure — Pinia stores are legitimately callable from anywhere once `createPinia()` is installed.

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

## Utils Behavioral Notes (R318)

### src/utils/congregationalText.ts

**Module overview:** pure, testable text<->sections conversion for the `---`-delimited
congregational-reading editor (supersedes Phase 47's click-between-verses divider model per owner
feedback: the divider UX was unintuitive). The editor is a plain textarea. Slides are separated by
a line containing only `---`; within each slide the speaker (Leader / Congregation / All) may sit
on its own first line above that slide's text. This module is the single source of truth for that
grammar in both directions.

**`parseCongregationalText`:** chunks are split on lines that are exactly `---`. An empty
(whitespace-only) chunk is skipped. The first non-empty line of a chunk, if it (case-insensitively)
reads `leader`, `congregation`, or `all`, is consumed as the speaker and the remaining lines become
the section text. Otherwise the whole chunk is the text and the speaker defaults to LEADER. A lone
speaker label with no following text is skipped (not a slide). `translationSource` is stamped only
when the arg is provided (R092).

### src/utils/importedRenderReconciler.ts

**`importedEntryContent`'s `'ready'` case (R108, Phase 50 part 2 — CONSUME the page):** an imported
deck's slides can be manually added into ANOTHER slot's group (e.g. a Prayer group, alongside
auto-generated slides). Such a hand-added entry keeps the deck's PARSED-slide id as its
`innerSlideId` — the synthetic `rendered-page-N` identity is only ever minted by the IMPORTED-slot
materializer, never for an entry dropped into a non-imported group. Resolution order, strictly
extending the ec217aa positional stopgap: (1) a synthetic `rendered-page-N` identity (the
materializer's own entries) resolves by N, unconditional on `renderedPage`; (2) else a supplied
`renderedPage` (the 50-03 render-stable reference recorded on a hand-added entry's `sourceRef` at
add-time) resolves directly — this is what makes a MULTI-IMAGE deck (parsed-slide count !=
rendered-page count) work, closing the gap the ec217aa positional resolver could not; (3) else, when
parsed/rendered counts match 1:1 (the common single-image-per-slide deck), fall back to the ec217aa
positional resolver: map the entry to its page by its position in `deck.slides` — kept in place for
legacy entries added before 50-03 recorded `renderedPage` (fallback, no migration); (4) else — a
multi-image deck with no `renderedPage` (a legacy entry that has never worked) — leave it pending
rather than risk pairing to the wrong page.

**`importedSourceSignature`:** cheap change-detection proxy for the IMPORTED slot kind, mirroring
`slideGroupMaterializer.ts`'s `sourceSignature` contract for every other slot kind. Encoded with the
ASCII control-character separators the SCRIPTURE branch there already uses and justifies (`\x1e`
between fields, `\x1f` between joined texts) — NOT the pre-existing IMPORTED branch's
`` `${texts.length}:${texts.join('|')}` `` form, which this function deliberately replaces rather
than inherits, because PPTX slide text can itself contain both `|` and `:`, so two decks whose
slide boundaries differ only in WHERE a literal pipe falls could produce an identical joined
string. Neither `\x1e` nor `\x1f` can occur in PPTX-parsed text (both are invalid XML 1.0
characters) nor in a Storage path, so no field value can forge a field boundary. This encoding
change is inert for stored data: nothing reads an IMPORTED signature back — only
`rebuildScriptureGroup` reads a stored signature — so no group is rebuilt merely because the
encoding changed. Fields, in order: mode, then the resolved `renderedCount` (empty string when the
mode isn't `ready`), then the parsed slide count, then the joined parsed texts. Including `mode`
keeps `pending`/`failed`/`ready` distinguishable even when `deck.slides` is unchanged across all
three.

### src/utils/scripture.ts

**`congregationalSectionsFromSlot` (R064/D1):** the ONE congregational-ness predicate on the SLOT
side — which sections seed a Reference -> Congregational conversion (`deriveGroupEntries` SCRIPTURE
case) and, once seeded, which sections a rebuild diffs the stored signature against
(`sourceSignature` SCRIPTURE case). Deliberately ignores `ScriptureSlot.readingMode` — that field is
declared but written by no code today, and gating on both it and the sections array would create
two fields that can disagree. The single rule, matching `PresentationViewer`'s `isCongregational`
computed: sections present and non-empty means congregational. Pure passthrough — no copying,
sorting, filtering, mapping, slicing or string transformation of any kind, because section text is
projected verbatim to a congregation. Returns the slot's OWN array by reference when non-empty
(never a copy); returns `[]` — never `undefined`, never the stored array with elements removed —
for a slot with no sections or an empty sections array.

**`congregationalSectionFromRef` (R064/D1):** the mirror predicate on the ENTRY side — the ONLY
place any consumer decides whether a stored `GroupSlideEntry` is a congregational section slide
(`resolveEntryContent`'s scripture case, and `rebuildScriptureGroup`'s cleared-reference branch).
`speaker` present is the discriminator — a Reference-state entry and a legacy pre-Phase-38 entry
both have no `speaker`, so both correctly return `null` here regardless of any
`scriptureReadingId`/`innerSlideId` they still carry.

**`scriptureSlotAfterReferenceChange`:** writes a new reference onto a `ScriptureSlot` and owns ONE
additional rule: a stored congregational reading is never carried onto a passage it was not derived
from. Section text is projected verbatim to a congregation, so leaving one passage's words attached
to a slot that now reads a different reference would project scripture under the wrong heading — a
correctness failure the assembler cannot detect, because by then the sections look perfectly valid.
Clearing on a reference change is the only clearing rule; no other slot mutation clears sections,
because the reference is the only thing that changes which passage a stored reading belongs to.
Uses the canonical `formatScriptureReference` formatter on both sides (one canonical formatter, not
a second inline copy of the book/chapter/verse comparison).

### src/utils/scriptureBoundaries.ts

**`embedBoundaryMarkers`:** produces a model-facing copy of `text` with a `⟦i⟧` marker inserted
immediately before the character at `boundaries[i]`, for every boundary. The untouched `text`
remains the only slicing source — this output is for display to the model only, never fed back
into `sliceAtBoundaries`. Returns `null` — a hard refusal — when `text` already contains either
marker delimiter, since an ambiguous marker set would let the model index into text the caller did
not mean.

### src/utils/slideGroupMaterializer.ts

**`deriveGroupEntries`:** derives a slide group's structure from its slot's canonical source.
Reproduces `assembleSlideshow`'s CURRENT per-kind emission order exactly — a group derived today
must produce a slideshow byte-identical to what the pre-group assembler produced. Slide TEXT is
never read or stored here (D-02) for every kind EXCEPT the SCRIPTURE Congregational state (Phase
38, D1/D2): there, `sourceRef` mints the section's own `speaker`/`text` directly, because a
converted section slide has no live source left to resolve against. Every entry this returns is
NEW, so every id here is freshly minted.

**`deriveGroupEntries`'s SCRIPTURE case (R047/D1):** no reference means no slides, exactly as
before. Once a reference exists, the group has exactly two possible shapes — never a mix — decided
by `congregationalSectionsFromSlot`, R064's ONE congregational-ness predicate: Reference state
(default, unchanged) is no sections, so ONE reference-only entry derived from the slot's OWN
reference fields; `derivedIdentityKey` treats the ref KIND alone as this group's identity, which is
what lets a passage change carry the stored entry's id/audio forward through
`carryStoredDerivedEntries` instead of minting a fresh id and silently dropping attached audio.
Congregational state (D1, opt-in) is sections present, so ONE entry PER SECTION — the same
one-entry-per-fragment shape the IMPORTED case uses — each carrying that section's own
`speaker`/`text`/`verseRange`.

**`isSlotDerivableRef`:** true when an entry's `sourceRef` is something THIS SLOT's own derivation
could have produced — i.e. the entry is source-derived and the rebuild owns it. Everything else on
the group is user work. Keying off the SLOT rather than the ref kind alone is the whole point
(BL-01, Phase 30 review) — the predicate this replaced returned "non-derivable" only for `video`
and authored-`text`, which meant an imported deck or a set of dropped images the user appended into
a SCRIPTURE or IMPORTED group was in neither the carried list nor the surviving list, and the first
unconditional rebuild destroyed it silently. SONG deliberately answers on ref KIND alone, not on
`songId`: a full song-identity swap is detected and handled by `rebuildSongGroup` itself, which
rebuilds from the new song's derivation — matching `songId` here would classify the OLD song's
lyric/copyright entries as user work and splice the entire previous song back into the swapped
group.

**`survivingEntries`:** the one place any rebuild path decides what a user added by hand — every
stored entry this slot's own derivation could not have produced, in stored order. Every
`rebuild*Group` function splices this back into its fresh derivation so a song swap, a passage
change, or a deck re-import can never silently drop a dropped video, a hand-authored slide, or a
deck the user imported into the group (T-30-02-01, BL-01). The IMPORTED case still DROPS an entry
whose `importId` matches the slot but whose `innerSlideId` the current deck no longer contains —
that is the intended re-import behaviour, and it stays inside `carryStoredDerivedEntries`; this
function only ever rescues refs a FOREIGN source produced.

**`derivedIdentityKey`:** the content-stable identity a stored entry of an unstable-id kind
(scripture, imported) is matched against by `carryStoredDerivedEntries`. Returns `null` for kinds
that either have their own dedicated identity scheme (`lyric`/`copyright` diff by `sectionId` in
`rebuildSongGroup`) or are never derived at all (`text`, `video`). Scripture returns the constant
`'scripture'` regardless of any `innerSlideId` the ref still carries: R047 narrows a
REFERENCE-state scripture group to exactly ONE derived entry, so the ref's KIND alone is its
identity; Phase 38 (D1) widens the Congregational state to N derived entries but every one still
returns this SAME constant key, which is what lets `carryStoredDerivedEntries` match N fresh
section entries against N stored ones positionally, and, on a DESTROY back to the Reference state,
is exactly what makes the surplus suppression collapse the group to one entry instead of stranding
the other N-1. Imported entries key on `importId` AND `innerSlideId` together — a deck has no
reference-only collapse, so each inner slide keeps its own identity.

**`orderedByStoredPosition` (BL-02, Phase 30 review):** re-sorts a rebuilt slide list into the
group's STORED order — the stored order is the USER's: `SlideGrid.vue` offers drag-reorder on
every non-song group, and the drop paths append at a user-chosen position. Before this,
`rebuildUnstableIdGroup` rebuilt the array from `fresh` and concatenated survivors after it, so the
derivation's order always won — a drag-reorder committed successfully and was then reverted by the
very next rebuild. Every entry that already exists in the group sorts by its stored index. A newly
derived entry has no stored index, so it is anchored to the nearest carried entry that does have
one — just after the closest preceding one, or just before the closest following one, or ahead of
the whole group when NO derived entry has a stored index at all (the re-import case: a re-import
mints entirely fresh `innerSlideId`s, so the whole fresh deck block lands where the previous
deck's block was rather than behind an entry the user appended after it). Anchor fractions are
strictly increasing and stay inside `(0, 1)`, so an anchored entry can never sort past its stored
neighbour, and idempotent by construction: after one pass every entry has a stored index equal to
its own position. NOT used by `rebuildSongGroup` — a song's slide order is dictated by the lyrics
document's `performanceOrder`, and a song group is read-only in the Slides tab (R054).

**`carryStoredDerivedEntries`:** generalized survival+carry for the two unstable-id source kinds
(scripture, imported deck) — the exact positional-consumption-plus-last-occurrence-surplus shape
`rebuildSongGroup`'s additive merge already uses for lyric sections, generalized here so idempotence
is provable on EVERY rebuild path (T-30-02-02). `fresh` is this pass's freshly DERIVED entries. A
stored entry whose `derivedIdentityKey` appears one or more times in `fresh` is CARRIED forward
positionally: occurrence `i` of a key in `fresh` consumes the `i`-th stored entry for that key —
keeping the stored entry's id/label/notes/audio/loop, but taking the FRESH entry's `sourceRef` so a
changed passage or a re-import renders through the SAME slide. Any stored entries beyond a key's
occurrence count in `fresh` are that key's surplus and are emitted once, immediately after the
key's LAST occurrence — EXCEPT for scripture, whose surplus is ALWAYS discarded rather than
emitted, in EVERY state, because `derivedIdentityKey` keys every scripture ref on the same
constant (HI-01: otherwise a pre-5c531b1 group stabilised at N identical reference slides and never
converged, and a Congregational RE-SPLIT would grow instead of replace). A stored entry whose key
never appears in `fresh` at all (an obsolete imported `innerSlideId` a re-import no longer
produces) is DROPPED.

**`carryStoredDerivedEntries`'s surplus-suppression comment (R047, HI-01):** surplus is meaningful
only for kinds with real fresh-side multiplicity. `derivedIdentityKey` returns the constant
`'scripture'` for every scripture ref regardless of state, so a group written before 5c531b1 (one
entry per split passage fragment) had N stored entries under that one key, and re-emitting
`stored[1..N-1]` on every pass would never converge. Suppressing surplus for scripture is what
makes a Reference-state rebuild converge to exactly ONE reference-only slide. Phase 38 (D1): the
SAME suppression applies unconditionally in the Congregational state too — `fresh` there can
legitimately have N>1 entries (one per section), and a re-split that shrinks the section count
relies on this exact suppression to discard the now-stale stored entries beyond the new count
rather than re-emitting them as "surplus." In every case the first stored entry at each position is
still carried, so its id, label, notes and audio come forward.

**`rebuildSongGroup`'s lyric-entry merge comment (Phase 26-09 Task 1 + Plan 28-03, D-02):** stored
lyric entries are indexed as an ARRAY per sectionId, never collapsed to a single entry, and
consumed POSITIONALLY rather than re-emitted wholesale. Why an array (26-09): the panel's Duplicate
action can create a SECOND stored entry referencing the SAME sectionId — a map keyed
one-entry-per-section would silently swallow a copy the next time this song's sections changed.
Why positional consumption (D-02): once a section can be REFERENCED more than once in the order (a
repeated chorus), re-emitting the WHOLE array on every occurrence multiplies entries on every
reconciliation pass (2 stored entries × 2 occurrences → 4, then 8, then 16). Occurrence `i` of a
section now consumes stored entry `i`; any stored entries beyond the section's occurrence count are
surplus and are emitted once, immediately after the section's LAST occurrence.

**`rebuildUnstableIdGroup`:** unconditional rebuild for the two unstable-id source kinds (scripture,
imported deck). Derives fresh; if the derivation is empty (source not yet loaded), returns the
group untouched with `changed: false` (T-30-02-04) — never blanking a group as a side effect of a
loading race. Otherwise the new slides are `carryStoredDerivedEntries`'s carried derived entries
plus the group's surviving user-added entries, re-sorted into the group's STORED order by
`orderedByStoredPosition` and renumbered. This function deliberately does not gate on the stored
`sourceSignature` — the carry helper makes this path idempotent on its own. Phase 38 (D1) gave
`sourceSignature` a real reader: `rebuildScriptureGroup` consults it BEFORE ever calling this
function, as the one durable marker of "already materialized from this reading" (detached,
Congregational) vs "not yet" (delegate here).

**`rebuildScriptureGroup`:** scripture inner slide ids are purely positional
(`id: \`scripture-${position}\``, minted in `scriptureSplitter.ts::buildSlide`) and are reassigned
wholesale by every re-split of the passage — there is no content-stable key to diff a single inner
slide against. R047 sidesteps this for the Reference state: a scripture group derives exactly ONE
reference-only entry, so `derivedIdentityKey` treats the ref kind alone as identity. D1 adds a
second state: once a scripture group has been materialized from the slot's CURRENT congregational
reading, it is DETACHED — freely editable, and no longer re-derived on every rebuild pass. Two
states, decided in order: (1) DETACHED — the slot has sections AND the group's stored
`sourceSignature` already equals `sourceSignature(slot, inputs)` — return the stored slides
untouched, `changed: false`, unconditionally, even if every section has been deleted; (2) NOT YET
MATERIALIZED — the slot has sections but the signature does not match (first conversion, a
re-split, or an existing pre-Phase-34 service) — delegate to `rebuildUnstableIdGroup`; (3) CLEARED
REFERENCE — the slot has no sections AND no reference at all, AND the group still holds at least
one section entry — empty the group of its derived section entries, retaining only
`survivingEntries`'s user work; a group with NO section entries and an absent reference falls
through unchanged (the loading-race guard already handles it); (4) otherwise (Reference state
throughout, or a DESTROY) — delegate to `rebuildUnstableIdGroup` unchanged, whose carry/collapse
machinery turns N stored section entries into exactly ONE payload-free entry.

### src/utils/slideshowAssembler.ts

**`AssemblyInputs.pptxRendersByImportId` (Phase 42, R079/R080):** render-status documents, keyed by
`ImportedDeck.renderImportId` — NOT by `ImportedDeck.id`/`ImportedSlot.importId`, which is what the
sibling `importedDecksById` is keyed by. The two identifiers are deliberately distinct
(`src/types/importedDeck.ts`); conflating them shows one deck's render status under another deck's
identity (T-42-07). OPTIONAL — an absent map is the legitimate "no render data loaded" state, and
for a deck with no `renderImportId` this must behave byte-identically to the parsed-text-only path
regardless of whether this map is present.

**`AssemblyInputs.renderedImageUrlsByImportId` (Phase 42, R079/R080):** resolved rendered-page
download URLs, keyed by `ImportedDeck.renderImportId` (same keying caveat as `pptxRendersByImportId`
above). Array index `i` holds the URL for page `i + 1` — the single 1-based↔0-based boundary in the
whole phase; every other consumer goes through `renderedPageNumberFromIdentity` instead of touching
this index directly. OPTIONAL for the same "no render data loaded yet" reason.

**`buildScriptureReferenceContent` (R105, Phase 49):** the SINGLE producer of reference-only
scripture slide content — a plain scripture reference slide AND the dedicated leading reference
slide of a congregational reading are byte-identical by construction (AC3). Called from all THREE
reference-slide sites: `resolveEntryContent`'s `section === null` branch, the SCRIPTURE fallback's
`sections.length === 0` branch, and the synthetic leading-slide emission on both assembly paths.
`readingMode: 'normal'`, empty `text`/`verseRange`, and NO `section` field — exactly the plain
reference-slide shape.

**`resolveEntryContent`'s scripture case (D1/D2):** `congregationalSectionFromRef` is the ONE place
this function decides which of the group's two states `entry` belongs to — `null` (a Reference
entry) reproduces today's shape exactly (empty text/verseRange, readingMode 'normal', no `section`
key), while a section (a Congregational entry, D2) uses the entry's OWN stored words, with
readingMode 'congregational' and the singular `section` field; each assembled slide carries exactly
one section (38-02). R105 (Phase 49): the reference eyebrow no longer lives on the first section
slide — it has its own dedicated leading slide emitted at assembly time, so `isFirstSection` no
longer exists on the type.

### src/utils/slideTypography.ts

**Module overview (46-RESEARCH.md Pattern 1-3):** pure, independently-testable slide-typography
helpers — the single implementation all three render sites (`PresentationViewer.vue`, the Slides
grid, the Edit Slide drawer preview), the Settings "Slide Typography" card preview, and the
app-init font-load gate (R094) share; no consumer computes CSS variables or re-derives the
font-load gate on its own.

**`cssVarsFor`:** computes the two `--slide-font-*` CSS custom properties from a stored (or
possibly undefined/tampered) `slideTypography` value. DEFENSIVELY falls back to Inter/400 —
never partially — when the family key is unknown or the weight is not reachable for that family
(via `snapWeight`) (T-46-03, ASVS V5): the value written into `--slide-font-family` and,
downstream, into a `document.fonts.load()` template string is therefore always drawn from the
curated `SLIDE_FONTS` set, never free text. R329 (Phase 115 Plan 05): the old discrete
`--slide-font-scale` sm/md/lg multiplier (`SCALE_MAP`) is removed — text size is now owned
entirely by SlideCanvas's per-slide auto-fit (`--slide-fit-scale`, Plan 03).

### src/utils/slotTypes.ts

**`groupBySection` (D005):** groups any section-bearing collection into `SERVICE_SECTIONS`-ordered
buckets, plus a trailing `legacy` bucket for members whose section is absent or not a recognized
`SERVICE_SECTIONS` member. Total and stable: every input item lands in exactly one bucket, in its
original relative order within that bucket. Generic on purpose: the editor view groups `{ slot,
index }` pairs for rendering while a reorder handler groups bare `ServiceSlot`s for persistence, and
both must use the identical bucketing rule. Every `SERVICE_SECTIONS` key is initialized to an empty
array up front (R043), so the "adding a fifth section" story is free — this function iterates
`SERVICE_SECTIONS` and never names a section as a string literal. `legacy` mirrors the trailing
"Ungrouped" bucket `useSlideshowAssembly.ts`'s `assembledSections` already ships for section-less
slides. A section value present but outside `SERVICE_SECTIONS` (production data corruption, or a
stale value from a since-removed section) also routes to `legacy` rather than being silently
dropped (T-29-03).

**`orderSlotsBySection`:** composition of `groupBySection` + `flattenBySection` over `slot.section`
— the one source of truth for "what order are the slots in," shared by the rendered grouping and
the array that gets persisted, so the two can never disagree. Identity-preserving: when the
section-major result is element-for-element reference-equal to the input, returns the ORIGINAL
`slots` array rather than the freshly-built one — a fresh array reference in an autosave-watched
view manufactures a false `isDirty`. Does NOT call `reindexSlots` — ordering and
position-renumbering are separate concerns; callers compose
`reindexSlots(orderSlotsBySection(slots))`.

**`defaultSectionForPosition` (D005):** default position -> section mapping for the M001
progression template. There is no default Pre-Service slot in the template (announcements arrive
in Phase 21) — positions 0-6 are 'worship', 7 (MESSAGE) is 'message', 8 (sending song) is
'sending'. Intentionally position-keyed, not section-count-keyed: it contains no arithmetic over
`SERVICE_SECTIONS.length` and no "last section" derivation, so widening `SERVICE_SECTIONS` (Phase
29 adds Post-Service) does not change which default section a template slot gets.

**`buildSlotsFromTemplate` (R086/R087):** builds a new service's `ServiceSlot[]` from the church's
stored `defaultServiceTemplate`. Composes `progressionVwTypeSequence`, `createSlot`, and
`reindexSlots`. VW typing is computed HERE, at creation, and never read back from the template: a
running `songOrdinal` counter (starting at 0) increments only on `SONG` entries, indexing
`sequence[songOrdinal % sequence.length]` — the modulo-cycle choice for templates with more than 5
SONG entries is a deliberate discretionary decision; the alternative considered and rejected was
clamping to the sequence's last value instead of cycling. When `vwModeEnabled` is false, `vwType`
is left `undefined` so `createSlot`'s own `?? 2` default applies. An entry whose `kind` is not a
recognized `SlotKind` is skipped (T-44-03 defensive guard). An empty `entries` array returns `[]` —
this function is NEVER a vehicle for reinstating `buildSlots()` as a fallback; under R115,
`services.ts::createService` resolves that fallback at the call site, not inside this function
(pinned by `slotTypes.test.ts:798`). An entry's optional `body` (R116) is threaded through to
`createSlot` for body-bearing kinds; a bodyless entry leaves the created slot's `body` key absent.

### src/utils/claudeApi.ts

**`SPLIT_SCHEMA`:** the structural contract the model is allowed to speak — nothing else. This
schema's field set is itself part of R064's guarantee: there is no field here the model could
populate with scripture words, not even an optional one the code never reads. Adding any
string-typed property beyond `speaker`'s closed enum would mean the model *could* emit text,
defeating the structural guarantee no matter how good the prompt. Structured outputs' JSON Schema
subset has no `minimum`, `maximum`, or `multipleOf` — this schema proves SHAPE only; every bounds,
ordering, adjacency and coverage check lives in `validateSplitResult` in plain TypeScript, because
the schema is structurally incapable of expressing them. Do not reach for `strict: true` here —
that field belongs to tool definitions, not to `OutputConfig`, and would not add range enforcement
even if it applied.

### src/utils/firestoreListener.ts

**Module overview (Bug 2b, quick 260830-l9c):** shared onSnapshot error-handling helper. A handful
of Firestore snapshot listeners only unsubscribe on view unmount, which happens AFTER the router
redirects to `/login` on sign-out. In that window the auth token has already been revoked (Bug 2a
tears down the ORG-SCOPED store listeners first, but these component-owned listeners are separate),
so Firestore rejects the read with `permission-denied`. With no `onError` handler, that surfaces as
"Uncaught Error in snapshot listener" — benign, but noisy. `ignorePermissionDenied` swallows exactly
that one error code and still logs anything else.

### src/utils/lastUsed.ts

**Module overview (R247/R248, Phase 84):** canonical last-used-date derivation. Pure and
framework-free — NO firebase, NO vue imports — so this module can be copied verbatim into
`functions/src/backfillLastUsed.ts`; the functions package cannot import from `src/` (separate
tsconfig/build, a different `Timestamp` class), so `computeLastUsedDate` and `serviceDateToMillis`
are MIRRORED there rather than shared by import, and both sides carry their own unit tests so drift
breaks a test instead of silently diverging. Semantics: a service counts toward a song's
`lastUsedAt` ONLY when it is LOCKED (`status !== 'draft'`) — draft services never contribute. The
value is `MAX(service.date)` over every locked service that contains the song in a SONG slot.
`null` means "no locked service contains this song" — a valid, intentional result, never an error;
it must not be conflated with "song is in no service at all."

### src/utils/messagingRecipients.ts

**`resolveRecipients`:** resolves a `{ teams, individualPersonIds, includeEveryone }` selection into
deduped (by person id), reachability-split recipient lists. Wraps the already-pure
`resolveServiceRoleAssignments` — the only recipient-resolution algorithm any later messaging phase
consumes. `includeEveryone` resolves every assigned role regardless of group; a person assigned to
two matching roles/teams is deduped and appears once; a matched person with `email === ''` is
excluded from `reachable` and increments `unreachableCount`; an unfilled role contributes 0
recipients and does NOT change `unreachableCount`; a matched personId absent from `people`
(stale/deleted) is silently skipped and does NOT increment `unreachableCount`.

### src/utils/monitorConfig.ts

**Fingerprint v2 (R326/R328):** identity is `label:WxH` only — `left`, `top`, and `isPrimary` are
deliberately excluded because macOS re-detects report them with drift/reordering, which was the
root cause of both "roles don't stick on 3 monitors" and the false "monitors changed" reprompt.
`computeFingerprints(screens)` groups by that identity, sorts each group by ascending `(left, top)`,
and appends a stable 0-based disambiguation index (`identity#0`, `identity#1`, ...) so two
identical-model monitors still get distinct fingerprints. `computeFingerprint(screen, allScreens?)`
is a single-screen convenience wrapper; without `allScreens` it treats the screen as a lone group
(`#0`).

**`matchMapping` (R326/R328):** delta-aware, NOT bidirectional set-equality. Returns `'no-mapping'`
when the saved mapping has no assignments; `'matched'` when every saved fingerprint is still live
AND no live screen is unknown to the mapping (unchanged layout — silent reuse, no reprompt);
otherwise `'partial'` with `kept` (the saved assignments whose fingerprints are still live) and
`newScreens` (the live screens whose fingerprints are new to the mapping). A monitor being
added/removed keeps the still-matching assignments and surfaces only the delta, instead of
invalidating the whole mapping on any single change. Does not open windows or prompt itself — the
caller owns that.

**Nicknames (R338):** `MonitorAssignment.nickname` is an optional user-entered string that travels
with its assignment through save/load/match (same record, no separate lookup). `isValidMapping`
rejects a non-string or over-`NICKNAME_MAX_LENGTH` nickname on read (T-114-01 — untrusted-
localStorage-read guard, mirroring the existing fingerprint/role validation).

### src/utils/orgName.ts

**`normalizeOrgName`:** normalize an organization display name into a stable, Firestore-doc-id-safe
uniqueness KEY (for the `orgNames/{key}` registry). Case- and whitespace-insensitive so "Grace
Church", "grace  church" and " Grace Church " collide as the same name. Firestore doc IDs may not
be empty, `.`, `..`, or contain `/`. `/` is folded to a space; a name with no usable characters
falls back to its slug (always `[a-z0-9-]`), and `''` only if even that is empty — callers treat
`''` as "nothing to claim".

**`claimOrgName`:** claim a unique org name via a create-only write against `orgNames/{nameKey}`,
mirroring `claimSlug`'s `orgSlugs` pattern (the rule denies any overwrite, so a create against an
existing doc fails permission-denied). Returns `true` when the name is now this org's (freshly
claimed, OR already claimed by this same org — idempotent). Returns `false` when another org holds
it. Unlike `claimSlug`, this does NOT auto-suffix — a NAME collision is surfaced to the caller
(reject), per owner decision.

### src/utils/pcSongImport.ts

**`partitionPcSongs`:** splits mapped PC songs into "new" (not yet in the library) and
"already-imported" (matches an existing song) based on the shared triple-key matching rule:
`pcSongId` (exact) OR `ccliNumber` (exact, non-empty) OR `title` (case-insensitive). Pure — no side
effects, no store access. Centralizes matching logic previously duplicated in `PcImportModal`'s
`classifySongs` and in `importFromPc`'s inline counting.

### src/utils/planningCenterApi.ts

**`addSlotAsItem`'s exhaustiveness backstop (R085):** binds on `slot.kind` rather than `slot`
itself: PRAYER/ANNOUNCEMENTS/MISC/MESSAGE all share the single `NonAssignableSlot` interface (one
object type, a 4-literal `kind` union), and TypeScript's control-flow narrowing does not collapse a
shared object type to `never` from sequential `if`-return checks on one of its properties — only the
discriminant's own literal-union type narrows to `never` that way. If a future `SlotKind` member is
ever added without a branch above, `slot.kind` stops being assignable to `never` and
`npm run type-check` fails AT THAT LINE — a compile error, not a silent relabel of the new kind as
"Message." This is the one dispatch site in the codebase where that protection has to be written by
hand.

### src/utils/pptxUpload.ts

**`PPTX_MAX_BYTES`:** 25MB — the SAME ceiling `storage.rules` enforces on the generic
`orgs/{orgId}/{allPaths=**}` match (`request.resource.size < 26214400`), which is the match
`pptx-imports/` falls into. ★ These two numbers must stay in lockstep — if you raise one, raise the
other. Why this exists (2026-08-06): the PPTX path had NO client-side size check at all, while
`useBackgroundUpload` (10MB) and `useMediaUpload` (50MB) both had one. An over-cap deck therefore
failed at the Storage rule with `storage/unauthorized` — a *permission* error, verbatim identical to
the one a genuine auth failure produces. During a real production incident that ambiguity cost
hours. The rule still enforces the cap server-side — this constant is UX, not security; its whole
job is making the client-side failure say what actually happened.

**`PptxFileTooLargeError`:** thrown when a file exceeds `PPTX_MAX_BYTES`. A distinct class rather
than a bare `Error` because `PptxImportModal.vue`'s catch block replaces every failure with one
generic "we couldn't read this file" message — without something to branch on, the specific size
message would be swallowed and the user would be told to re-export from PowerPoint.

**`isPptxFileTooLarge`:** narrows an unknown caught value to a too-large error, by NAME rather than
`instanceof`. Callers live in components whose tests `vi.mock` this module with a full-replacement
factory — under such a mock the exported class binding is `undefined`, and `err instanceof
undefined` throws a TypeError, so an `instanceof` check would convert every unrelated upload
failure into a crash inside the very catch block meant to handle it. Name matching also survives
the class being duplicated across bundle chunks or JS realms.

### src/utils/quarterDates.ts

**`nextFreeSunday` (R038/D-12/D-13):** the nearest FUTURE Sunday that does not already have a plan.
Walks FORWARD only from `from` (D-12), skipping every Sunday present in `takenDates`, bounded at
`maxWeeks` (D-13 ~52). On exhaustion it returns the plain next Sunday so the field is never blank.
★ Sunday convention — deliberately STRICTLY FORWARD, and deliberately NOT the same as
`generateSundaysInQuarter`'s advance rule: that one yields TODAY when today is a Sunday; this one
yields the FOLLOWING Sunday, matching the `nextSunday()` `NewServiceDialog.vue` used before R038. Do
not "unify" these without re-reading D-13; `quarterDates.test.ts` pins this with a Sunday `from`.

### src/utils/renderedPagePaths.ts

**Module overview (Phase 42, R079/R080):** client-side rendered-page Storage-path convention.
Copied verbatim from the two server-side originals — there is no importable package boundary
between `functions/`/`render-service/` and `src/`, so this is a hand-synced third copy. Keep in
sync with `functions/src/index.ts` (`renderedPrefixFor`, `RENDERED_OBJECT_NAME`) and
`render-service/src/render.ts` (`RENDERED_PAGE_PAD`, `renderedPrefix`, `renderedObjectName`). Page
numbering is 1-based — there is no page 0, matching the contiguity check
`functions/src/index.ts` runs against the server's own recount. Do NOT re-implement
`getDownloadURL` here — `src/utils/pptxUpload.ts::resolveImageUrl` is the one canonical wrapper;
this module only builds the PATH that wrapper resolves.

### src/utils/rotationTable.ts

**`computeRotationTable`:** computes a rotation table from an array of services. For each song that
appears in at least one service, returns an entry with the song's ID, title, and the ISO date
strings of services where it appears. A song appearing in multiple slots within the same service is
counted once per service (not once per slot). Pure function — no Firestore reads, operates entirely
on in-memory data.

### src/utils/scheduler.ts

**`evaluateGroupCombo` (D-10):** pure group co-occurrence rule, derived purely from group + the
multi-role flag, NOT configurable. Rewritten for R259 — the flag generalizes from vocals-only to any
role in any group: filter the person's roleIds down to the NON-multi-role ones first, then apply the
existing rule to just that remainder — Band and Tech are mutually exclusive on the non-multi
remainder; Other combines freely with either; at most one non-multi Band-group role (the
one-instrument cap) per person per date. A multi-role role NEVER causes a conflict — it may co-occur
with anything, crossing Band/Tech/Other (R259), a deliberate behavior change from the Phase-85 rule.
Exported so `QuarterGrid.vue` (D-11) can reuse the exact same evaluation for its manual-grid warning
badge.

**Auto-scheduling candidate filter:** only 'regular'-tier people are auto-scheduled. 'fillin'-tier is
manual-only — the coordinator fills those gaps by hand (there is intentionally NO last-resort fillin
auto-fill), and 'out'-tier is excluded for the whole quarter. A regular candidate stays eligible only
while still BEHIND their even-spread cadence pace (withinCadence): "1-in-N" means once every N
dates, so a monthly (n=4) person is only eligible on ~every 4th date and lands evenly across the
whole quarter instead of being front-loaded into the first few weeks and then dropped. When nobody
is behind their pace, the slot is left BLANK (pushed to `unfilled`) rather than over-serving
someone: hard caps win over full coverage.

### src/utils/serviceLockDiff.ts

**`diffServiceSnapshots`:** PURE diff of two locked `ServiceSnapshot`s plus their two slide
fingerprint maps. Returns the typed `ChangeEntry[]` (SONG/ORDER/ROLE/NOTES/SLIDES) with R147
affected-teams tagging: ROLE narrow (exactly the changed role's group), SONG/ORDER/NOTES/SLIDES
broad (every current group with an assigned person). Two identical snapshots with identical
fingerprints return `[]` — the empty-diff branch 62-04's lock hook uses to overwrite
`lockSnapshots/current` silently. Both `slots` arrays are ALREADY section-major (`buildServiceSnapshot`
calls `orderSlotsBySection`) — this function must NOT re-sort them; ORDER is detected on the shipped
ordering as-is. Matching is by stable `slot.id`, never by array index or `position`, both of which
a drag-reorder rewrites.

### src/utils/shareTokens.ts

**`shareTokenCreatedAtMillis`:** coerces any timestamp shape a `shareTokens` document can actually
carry in this codebase into milliseconds, without ever throwing and without ever returning `NaN` (a
`NaN` leaking into a comparator would silently destroy sort order, so every branch returns `0`
instead). Recognised shapes, in the order checked: an object exposing a callable `toMillis` (a
server-resolved Firestore `Timestamp`); an object with a numeric `seconds` (the shape
`services.test.ts`'s `serverTimestamp` mock produces, and the shape a raw REST read gives); a
`Date`; a finite number; anything else (including a locally-pending `serverTimestamp()` that has
not yet round-tripped from the server, which reads back as `null`) — `0`.

**`pickAdoptableToken`:** selects which already-circulated `shareTokens` document to adopt for a
service, or `null` when there is nothing adoptable (the caller mints instead). Three steps, in
order: (1) filter to candidates whose `orgId` is a string strictly equal to `orgId` (T-41-07) — the
producing Firestore query filters on `serviceId` only, so its result set is NOT org-scoped; (2) sort
a COPY of the filtered array over a total order — newest `createdAt` first, tiebroken by the
lexicographically greatest document id (Firestore query iteration order is not a guarantee, so
relying on "whichever came back first" would make adoption nondeterministic); (3) return the first
element's `id`, or `null` when the filtered list is empty.

### src/utils/songSearch.ts

**`songMatchesQuery`:** multi-term AND search over a song's metadata. Supports field-scoped prefixes
(`type:`, `key:`, `tag:`, `theme:`, `team:`, with optional space after the colon) whose value may
contain multiple words (e.g. `tag:christmas eve`), natural two-word phrases (`Type 1`, `Key A`), and
the original bare full-field substring match for any remaining text. Every extracted term (field-
scoped span or bare word) must match (AND). `team:` is aliased to a plain tag match (D-06).
`vwModeEnabled` (default `true`) gates the `type:` prefix — when `false`, `type:` matches nothing,
hiding VW-type search app-wide when VW mode is off (D-16); only the `type:` prefix is gated.

**`filterSongsByTags` (D-08/D-09/D-10, R240):** filters a song list by the shared per-tag Show/Hide
include/exclude sets. Both sets empty returns `songs` unchanged. Exclude always wins: a song
carrying any excluded theme or tag is removed, even if it also carries an included one. When
include is non-empty, only songs carrying an included theme OR tag (across both fields) survive.
`themes`/`tags` are treated as empty arrays when undefined (legacy docs) — this never throws. Lifted
byte-for-byte from the two prior duplicated call sites (`stores/songs.ts`'s `filteredSongs`,
`SongSlotPicker.vue`'s `tagFilteredSongs`).

### src/utils/songSectionOrder.ts

**Module overview:** PURE module — imports only types from `@/types/songLyrics`. No Vue, no store,
no Firestore. Mirrors the purity contract of `slideshowAssembler.ts`. Establishes the section-order
model Phase 28's editor is built on: `sections` is an unordered POOL (each id unique), and
`performanceOrder` is THE ordered list of section-id references that IS the slide order (D-01/D-03).
A repeated id in the order is a REFERENCE to the same pooled section, not a copy (D-02).

**`sliceSectionIntoSlides` (R117):** slices a section's `lines` into consecutive slide line-groups at
its `slideBreaks`. This is the SINGLE definition of what a split means — both assembler paths and
the editor split affordance consume this one helper. Read-tolerant: keeps only integer break indices
`k` with `1 <= k < lines.length`, sorts ascending and de-duplicates. An absent, empty or
fully-invalid break set yields exactly one group equal to `section.lines`. Never throws, never
mutates its argument.

**`normalizeLyricOrder`:** enforces the pool/order invariants over a (sections, order) pair — the
pool is de-duplicated by id keeping the first occurrence; order ids with no pooled section are
dropped; if the surviving order is empty while the pool is not, the order is seeded from the pool's
stored sequence; pooled sections referenced zero times are dropped. This runs on the WRITE path —
the editor normalises what it holds and lets its existing dirty-check decide whether to persist. It
is deliberately not a read-time fallback (D-19 forbids that). Returns a value-equal result for
input that already satisfies the invariants. Never mutates its arguments.

**`normalizeParsedSections`:** normalises freshly-parsed CCLI sections into the pool/order model —
the ONLY collision guard over `ccliParser.ts`'s unguarded `slugify(label)` ids (that parser mints
ids with no uniqueness check across four mint sites, so two `Chorus` markers in one paste arrive as
two `LyricSection` objects both carrying id `chorus`). Resolution: an id not yet pooled is pooled
and appended to the order; an id already pooled whose incoming lines are empty or value-equal
(after trimming) is a REPEAT MARKER — append the pooled id again, add nothing to the pool (D-02); an
id already pooled whose incoming lines differ and are non-empty gets a freshly minted id. The
returned pair already satisfies the pool/order invariants — feeding it to `normalizeLyricOrder`
changes nothing. Never mutates its argument.

### src/utils/stripUndefined.ts

**`stripUndefined`:** recursively removes properties whose value is `undefined` so the result is
safe to write to Firestore, which rejects any `undefined` field value at any depth with
"Unsupported field value: undefined (found in document ...)". Arrays are mapped element-wise. Only
PLAIN objects are recursed into; `Date` instances, class instances, and Firestore `FieldValue`
sentinels (e.g. `serverTimestamp()`) are returned untouched — callers should add FieldValue
sentinels AFTER stripping the plain payload. `null`, `0`, `''`, and `false` are preserved — only
`undefined` is dropped.

### src/utils/suggestions.ts

**`rankSongsForSlot`:** returns songs ranked for a given slot. Every song is always eligible — there
is no hard team filter (D-03). Service team scheduling is a soft nudge only: for each scheduled team
whose name matches (case-insensitively) one of the song's `tags`, the song's score gets an additive
bonus (D-04) — data-driven, no hardcoded team list. The VW type is accepted for API compatibility
(caller passes slot type) but no longer influences the score (D-10) — songs are ranked purely by
rotation/recency plus the team-tag bonus. Pure function — no side effects, easily testable.

### src/utils/teamRecurrence.ts

**Module overview (R254/R255, Phase 86):** Nth-Sunday-of-month recurrence matching. Pure and
framework-free — NO firebase, NO vue imports. Date parsing mirrors the UTC-stable convention
established in `src/utils/lastUsed.ts` (`serviceDateToMillis`): split the "YYYY-MM-DD" string on
'-' and treat the parts as a UTC calendar date, rather than constructing a `Date` that resolves
"local midnight" against whichever timezone the running process defaults to — without this, the
same date string could compute a different ordinal depending on the host's timezone. Scope note:
only the Nth-occurrence-of-the-month pattern is supported; "every N weeks" was considered and
dropped for this phase.

## Component & Composable Behavioral Notes (R318)

Behavioral/architectural "how it works" narration relocated out of `src/components/**` and
`src/composables/**` source comments per the Phase 109 comment convention (CONVENTIONS.md §
Comment Convention). Each entry cites the file:line range at the time of relocation (109-04).

### src/components/ContextualActionBar.vue

**Module overview (36-02, R068):** the one shared action bar. Owns no state, no store access, and
no emits — `items` is a fully-computed declarative list produced by `buildActionBarItems`
(`src/views/serviceEditorActionBar.ts`) and every `onClick` is the caller's own handler reference,
dispatched verbatim. Matches `SlideActionMenu.vue`'s "renders a list, does not decide what's in it"
precedent, going one step further by owning no open/closed state either — a button row has none to
own. The empty-list case (`items: []`, e.g. the Roles tab) needs no `v-if` gate: the container
carries no border/background/padding/margin, so an empty row contributes no visible box (unlike
`SaveStatusIndicator.vue`, whose own chrome renders even at idle). `Save`'s padding normalizes here
from its old `px-4 py-2` to this bar's declared `px-3 py-2` (36-UI-SPEC § Spacing Scale) — the one
relocated control this phase restyles; `＋ Add slide` (`SlideGrid.vue`) stays grid-local with its
own pre-existing `px-2.5 py-1.5` per that spec's exceptions note.

### src/components/MiscLabelBadge.vue

**Module overview (2026-08-12 owner request):** inline-editable MISC label pill, replacing the
separate MISC "label" input added in Phase 56 (R127) — the colored badge pill IS the editable
surface; click it (or its pencil) to rename a Miscellaneous item directly. Shared by both the live
service editor (`ServiceEditorView.vue`) and the Edit-Template editor (`ServiceTemplateEditor.vue`)
so the two can never drift (the Phase-57 `kindBadgeClass` lesson). Display shows `modelValue`
(trimmed) or the placeholder ("Miscellaneous"), uppercased by the badge's own CSS — the STORED
value keeps its real casing. Plain text only: `:value`/`v-model` bindings plus interpolation
auto-escape; never `v-html`.

### src/components/PptxImportModal.vue

**External drop-zone entry point (25-07 Task 1, D-15):** lets an external drop zone (the Slides
tab's grid-wide/tile drop handling) hand this modal an already-picked File without touching its own
`<input>` elements or synthesizing a DataTransfer + fake change event. Both exposed functions call
straight into the existing `importPptx`/`importImages` functions — no new upload/parse/preview/
confirm logic is added, so this remains the app's single PPTX/image import implementation with a
second caller (D-15), not a second implementation. Guarded against re-entry: this modal is a
single-batch state machine, and a second concurrent import while one is already uploading/parsing/
confirming would corrupt its preview state — the guard silently no-ops instead.

### src/components/SongSlotPicker.vue

**`tagFilteredSongs`:** visible songs filtered by the shared store tag-filter state (D-09/D-10:
independent per-tag Show/Hide sets — exclusion always wins; include set OR-combines when
non-empty). R240: delegates to the same shared `filterSongsByTags()` used by `SongBrowser`'s own
`filteredSongs` computed (with the same `visibleSongs`/`tagFilterInclude`/`tagFilterExclude`
inputs), so this is provably identical to the shared shell's slot value. Kept as a script-level
computed (rather than read from the slot scope) because `suggestions`/`searchResults` feed the
IntersectionObserver load-more machinery (`visibleCount`, `hasMore`, `loadMore`), which runs
outside the template's render/slot context and needs synchronous script access.

### src/components/SongTable.vue

**Tags/Themes display note:** on this listing, Tags/Themes are display-only plus click-to-filter
(`filterByPill`). All add/edit/remove of tags and themes happens on the edit screen
(`SongSlideOver.vue`) — including the removedThemes tracking (D-14) recorded there on save, which
lets a removed theme survive a Planning Center re-import without resurfacing.

### src/components/actionBarItems.ts

**Module overview (36-02, R068):** the `ActionBarItem` contract — the declarative shape
`ContextualActionBar.vue` renders and `buildActionBarItems` (`src/views/serviceEditorActionBar.ts`)
produces. Kept in its own module, separate from the component file, so a pure per-tab builder can
import just the types without pulling in any Vue runtime code. `ActionBarIcon` originally gained a
`copy` member over 36-UI-SPEC §2's illustrative union for the `copy-pc` button's clipboard glyph
(flagged spec extension) — removed along with the `Copy for PC` button itself per direct owner
feedback ("let's get rid of the Copy for PC button all together, it's not useful at all"); an
organization with no Planning Center credentials now has no export affordance in the action bar at
all, only the credentials-missing note pointing at Settings — the owner's explicit, accepted
consequence; do not add a replacement affordance. `ActionBarTone` originally gained a fourth
`present` member per 36-UI-SPEC §2's prose (outlined indigo), distinct from `primary` (filled
indigo), so Present and Save would never collapse into one visual treatment — removed per direct
owner feedback ("Update the Present Button so that it matches the other buttons... it's so visually
different"); `buildPresentItem` now omits `tone` entirely, falling back to `default` like every
other non-Save button. Present and Save stay visually distinguishable anyway (`primary` filled
indigo vs `default` gray) — just not via the spec's dedicated outlined-indigo treatment. Do not
re-add this member to "restore" the spec; the owner asked for the opposite of what §2 specified.

### src/components/admin/CleanupEnableConfirmDialog.vue

**Module overview (Phase 71-02, R189/R190):** confirm-to-flip modal for the Owner Console's Cleanup
card. Structural shell (Teleport + backdrop/panel Transition) is copied from
`src/components/NewServiceDialog.vue`; the hand-rolled focus trap is new to this codebase (no prior
precedent), per 71-UI-SPEC.md. R190 hard block: when `referencesComplete === false` (only ever
passed for the backgrounds type — the other three types never send this prop), the Confirm button
is not rendered as a clickable element at all — a separate, permanently-disabled `<button disabled>`
with no `@click` handler is rendered in its place. There is no code path that can wire a click
handler to that element; this is what makes the hard block structural rather than just visually
disabled.

### src/components/admin/DeactivateOrgConfirmDialog.vue

**Module overview (quick task 260824):** reversible-lifecycle confirm dialog for deactivating a
church. Structural shell (Teleport + backdrop/panel Transition, hand-rolled focus trap,
focus-on-open/close, `confirming` guard on every dismissal path) is copied verbatim from
`DeleteOrgConfirmDialog.vue` (Phase 77-02), which establishes this shell for the admin org-list
dialogs. Deliberate divergence: no type-to-confirm text input. Deleting an org is irreversible, so
`DeleteOrgConfirmDialog` gates its Delete button on an exact name match as a slip-proof safeguard;
deactivating is reversible (a super-admin can reactivate at any time), so a single Confirm/Cancel
pair with plain consequence copy is proportionate.

### src/components/run/RunFilmstrip.vue

**Module overview (R282, 97-05):** the in-item "Slides in this item" click-to-jump filmstrip,
extracted as a PURE presentational child. It does NOT compute which slides belong to the active
item — the parent (97-08) supplies the already-filtered `slides` and a PARALLEL `indices` array
(`indices[i]` is `slides[i]`'s array index in `assembledSlideshow`). The click contract is the whole
point: `@jump` emits `indices[i]`, the GLOBAL array index, so the parent maps it straight to
`postIndex`; emitting the local loop index `i` would jump to the wrong slide (T-97-05-01). Renders
each thumb as a scaled non-interactive `SlideCanvas`; the current slide gets the green live frame.
Owner UAT: each thumb renders a true mini-slide by laying `SlideCanvas` out at the 1280×720
reference stage (where fonts are proportionally correct) and scaling the WHOLE stage down to the
thumb, so text and layout shrink together (same technique as `RunPreviewPair`) — rendering directly
at the tiny thumb width wrapped every word into a stacked mess.

### src/components/run/RunHeader.vue

**Module overview (R277):** the State-B live header. PURE presentation: props-in / emits-out, no
channel, no store, no timer logic — the parent (`RunControlView`, wired in 97-09) owns all state and
passes the `live` flag plus the clock/elapsed strings from `useRunTimers`. Owner fix #4: the live
status is GREEN only when truly live, and a muted/amber "Not open" otherwise — never a pre-live red.
Owner fix #7: a REHEARSAL is a distinct third state — YELLOW "Rehearsing" (never green) with an "End
Rehearsal" exit label — so green unambiguously means the outputs are really live. All three states
are driven by the `live`/`rehearsing` props the parent sets, never derived from any output-status
machine here: green "Live" when `live && !rehearsing`, amber "Rehearsing" when `rehearsing`, muted
"Not open" otherwise. The Nocturne Run-scoped palette (97-UI-SPEC) is applied via local CSS custom
properties on the root only — this does not retheme the app.

### src/components/run/RunPreviewPair.vue

**Module overview (R276 owner fix #2/#4, 97-05):** the program + next-up preview pair, extracted as
a PURE display child. Both panes render the real `SlideCanvas` with `:interactive="false"`; the
previews own no navigation (the transport/rail posts index changes), so there is deliberately no
emit and no run-take / run-push-live control here — that keeps the single-selection contract intact.
The live frame is GREEN when `live` is true. Owner UAT fix (Next-up font too big): `SlideCanvas` has
no font-size prop — its text is sized in fixed projector px, scaled only by `--slide-font-scale`, so
scaling a box-sized canvas by 0.8 still left the font enormous in the small preview box. Instead each
canvas renders at a fixed `REFERENCE_WIDTH × REFERENCE_HEIGHT` (1280×720, 16:9) stage — where the
projector-sized fonts are proportionally correct — and the whole stage is CSS `transform: scale(f)`-ed
down to fit its pane, with `f = paneWidth / REFERENCE_WIDTH`, `transform-origin: top left`, and the
pane `overflow-hidden`. Font and layout shrink together and each preview reads as a true mini-slide.
A ResizeObserver per pane keeps `f` correct across layout/resize; both panes and the stage are 16:9,
so the scaled stage fills its pane exactly (no letterboxing).

### src/components/run/RunRail.vue

**Module overview (R276, R262/R263):** the order-of-service rail, extracted as PURE presentation
from `RunControlView.vue` (its markup plus the Phase 95 `captureActiveRow`/`watch(index)`
auto-scroll in `useRunControl.ts`). The parent (97-09) owns all state and navigation: it supplies
`rows` (`RailRow[]` from `useRunControl`), the current `activeIndex` (a slotIndex, or null pre-live),
and — for the active item only — its `expandedSlides`. Every interaction is emitted as intent
(`@jump` / `@jump-slide`); the parent maps those to `jumpToSlot` / `postIndex`. No store, channel, or
side-effects here. The rail testids (`rail-item`, `rail-item-empty`, `run-rail-empty`) and the
has-slides-vs-empty branching are reproduced exactly so the wired-view control suite
(`RunControlView.test.ts` rail tests) stays green.

### src/components/run/RunTransportBar.vue

**Module overview (R276):** the State-B bottom transport bar. PURE presentation: props-in /
emits-out, no channel, no store. Previous/Next emit intent; the parent (97-09) posts the actual
navigation immediately — single-selection: nav posts on click, there is no take/stage step, so this
bar introduces no run-take / run-push-live testid, which the control's single-selection test asserts
are absent. The Nocturne Run-scoped palette (97-UI-SPEC) is applied via local CSS custom properties
only.

### src/components/settings/ServiceTemplateEditor.vue

**The six creatable kinds:** a closed set, never derived from the `SlotKind` union (which also
contains HYMN, palette-retired in Phase 43/R084, and IMPORTED, which has no pre-creation meaning).
Kept only as the palette's click targets in the template; this array is not iterated to build the
markup, matching the "verbatim, not derived" requirement for this list.

### src/components/slides/BackgroundControl.vue

**Module overview (R055/R057, Phase 33 Plan 03):** shared, presentational background-image control,
mounted at both the group level (`SlideGrid.vue`, 33-08) and the song level (`SongLyricEditor.vue`,
33-06) — a mechanical sibling of `SlideGroupMusicControl.vue`: emit-only, no Firestore write of its
own, `isEditor`-gated add/remove, and a failed upload emits NOTHING so it can never clear or
overwrite an existing attachment. `addLabel` is threaded as its own prop (additive divergence from
33-UI-SPEC §6's stated prop list) because the Copywriting Contract gives the two call sites
different add-affordance text ("+ Add background for this group" vs "+ Add background for this
song"). `inheritedFrom` is populated ONLY by the group-level call site, and only for a SONG group
whose own background is empty while the song's is set — every non-SONG group and the song-level call
site pass `undefined` (the song is the least specific level; nothing below it to inherit from);
renders the inherited thumbnail and the "inherited from the song" copywriting line. The add/override
affordance is not offered while inherited (owner request): a song-sourced background is managed at
the song level, so a group-level override is suppressed to avoid confusion. There is no confirmation
dialog for Remove at any level — a plain, unconfirmed clear, matching `SlideGroupMusicControl.vue`'s
own contract verbatim. Owner follow-up (side-by-side group media panel): `hideCaption` drops this
control's own caption line so `SlideGrid.vue` can place the group caption on its own full-width line
below both add-buttons rather than stacked above only this one — it deliberately does NOT suppress
the `inheritedFrom` block, a different affordance that belongs with the control it describes.

### src/components/slides/EditSlideDrawer.vue

**Lifecycle lock prop (R036):** kept DISTINCT from `isEditor` because this drawer is the one surface
that must tell the two apart — a viewer and a locked editor need different read-only copy
(31-UI-SPEC § 6). Composed into `canMutate`, which is why the entire Phase 30 read-only rendering
comes for free rather than needing a parallel mechanism. The drawer still OPENS when locked: it is
the only surface showing a slide at size, plus its context line and what audio covers it; blocking
it would remove a VIEW affordance in the name of a WRITE lock.

**`scripturePassageText`:** for `scripture`-kind entries the UI-SPEC calls for the passage text
alone, not `slideBodyText`'s reference-prefixed form (the reference is already shown in the context
line above). R047 ripple (30-03-PLAN.md): a Reference-state scripture slide always resolves with
empty `text` — falling back to the slide's own `reference` keeps this block from going blank. A
Congregational-state section slide (Phase 38) carries text and shows it unchanged; this computed is
also read by the section entry's own read-only fallback further down.

**`canMutateBackground`:** deliberately NOT `canMutate` — omits the song-group exclusion.
`canMutate` (`isEditor && !serviceLocked && !isSongGroup && !isPendingRender`) governs
label/notes/audio/duplicate/delete, all of which R054 keeps song-slide-canonical. A per-slide
background is a genuinely new, independent property R054's "canonical, edited only from Song
Lyrics" rule was never written to cover — 33-CONTEXT.md explicitly states a song group's reduced
menu still offers background-setting. This is the ONE mutation gate in this drawer that omits
`isSongGroup` — do not "fix" it to match the surrounding pattern. It does still compose
`!isPendingRender` (R236): a background attached to a not-yet-rendered slide is exactly the kind of
customization the locked pending-render copy warns would be lost.

**`lowerLevelBackgroundLabel` (Phase 33 UI-audit fix, previously a known, scoped gap documented in
33-07-SUMMARY.md):** this drawer still receives no `song` document, so the GROUP branch keeps
reading `props.group.backgroundImageUrl` directly (a raw field read, not a re-derivation of
resolution precedence). The SONG branch is provable WITHOUT threading a song document or a second
resolver: `groupAssembledSlides` (populated by `SlidesTab.vue` from the SAME `assembledSlideshow`
prop it already filters for position/total) is this slide's own group, already resolved — a sibling
entry with `backgroundSource === 'song'` proves the song has one, mirroring how `SlideGrid.vue`'s
`songBackgroundForInheritedDisplay` scans its own group's assembled cards for the same signal. Known
limitation, shared with that precedent: if EVERY slide in the group has its own override, a
song-level background one level further down stays invisible to this caption — narrower than a
silent wrong-level claim (the caption simply doesn't render), and accepted because the group-level
control already surfaces this exact case via its own `inheritedFrom` prop.

**`onDuplicate` (Phase 26-09 Task 2):** mints a FRESH id for the copy (D-04) — never the original's,
and never derived from label/source/position: `PresentationViewer.vue` keys its per-slide
`AudioPlayer`/`VideoPlayer` on this id (invariant 2, `src/types/slideGroup.ts`), so two entries
sharing one id would collide there. `base` is read FRESH from `props.group.slides` at the moment
this runs (never a snapshot from mount), matching every other write this drawer makes. The copy is
inserted directly after the original and every entry's `order` is renumbered contiguous, following
the same discipline `SlideGrid.vue`'s own append (`onAddSlide`) uses. The selection moves to the
copy only AFTER the write succeeds (T-26-09-04) — emitting `duplicate` eagerly, before the write
lands, would leave the panel pointed at an entry that was never actually created if the write is
rejected.

**Delete path (Phase 26-09 Task 3):** filters the entry out and renumbers the rest contiguous,
writing through the same fresh-base helper every other write in this drawer uses. The group's
shared bed music (`setGroupBedMedia`) is never called here — a slide delete touches only `slides`,
never the group's own `bedAudioUrl`.

**Menu-dispatched delete (P-01):** the delete key sets the EXISTING `showDeleteConfirm` state and
never calls the delete action directly — a menu puts destruction one click closer than the drawer
did, and it must not also make it quieter. The existing inline confirm (which names whether attached
audio and operator notes go with the slide, `deleteConfirmBody`, unchanged) stays byte-unchanged and
remains unavoidable. T-33-15: re-checks `canMutate` before acting on either key, so a dispatched
action cannot bypass the editor / not-locked / not-a-song-group composition even if the menu that
sent it were wrong. `pending-action-consumed` is emitted once per handled nonce regardless of
whether `canMutate` permitted the action, so the parent never gets stuck holding a request this
drawer correctly refused, while the actual mutation only ever happens when permitted.

### src/components/slides/SlideCanvas.vue

**`currentBackgroundUrl` (R070, UAT F3):** the slide → group → song background cascade was already
resolved upstream, once, by the assembler; this reads only the single winning value already sitting
on the current slide. It takes no map of groups by slot id, performs no song-document lookup, and
never branches on which tier supplied the value. Phase 105 (R303): a blackout slide is checked FIRST
of all — it never paints a background image or scrim no matter what (stale/crafted)
`backgroundImageUrl` it happens to carry (T-105-03). Phase 90/94: `suppressBackground` forces this
null regardless of the slide's own resolved value — checked next, ahead of the R070
video-suppresses-background rule, since a confidence monitor wants black-only no matter what the
slide carries.

**Text size (R329, Phase 115 Plan 03) — per-slide auto-fit, not a discrete multiplier:** the
scoped font-size rules read `var(--slide-fit-scale)`, a value measured per slide by
`useSlideAutoFit` (grow-to-fill, shrink-to-avoid-overflow, capped at `MAX_FIT_SCALE`) against
SlideCanvas's own canonical 1280×720 frame — not the old discrete `--slide-font-scale` sm/md/lg
multiplier (SlideCanvas no longer reads that variable at all; its emission survives only for the
editor surfaces until Plan 05). Because every consumer — the Audience/Confidence outputs
(via `useContainScale`'s canonical stage) and the Run-screen previews/thumbnails
(`RunPreviewPair`'s existing 1280×720 reference stage) — renders SlideCanvas at that same
reference size, the fit computed once is identical everywhere: the previews stay a true WYSIWYG
mirror of the projector. In jsdom/no-layout environments the fit degrades to
`DEFAULT_FIT_SCALE` (1), matching the old `md` identity default, so no existing render test
depends on real measured pixels.

### src/components/slides/SlideGrid.vue

**`canMutateGroup`/`canWriteGroupMedia`:** the two composed gates (★ R036) this component uses
everywhere, both folding the lifecycle lock into the existing R054 seam rather than running beside
it. `canMutateGroup` governs create/import/reorder of the group's SLIDES and deliberately omits
`isSongGroup` for `canWriteGroupMedia` — the drop tile and the group-bed music control stay
available on a SONG group (audio-only there, exactly what 30-03 shipped: "lock the slide grid for
song groups without blocking group media"). Every corresponding HANDLER re-checks the same
computed — 30-VERIFICATION I-01 found six of seven mutation entry points guarded by a template
`v-if` alone, and a lifecycle lock layered over that alone inherits its fragility.

**`appendToGroup` append contract (R050):** the one append contract every write path routes
through — sorts a copy of `entries` by `order`, concatenates `additions` in the order given, then
renumbers every element to its array index, so array order and `order` are the same statement
afterward. This is the exact normalization the reorder handler's `onEnd` already performs; this
helper makes it the component's one contract instead of a behavior only the reorder path had —
closing the divergence where `entries`' array order and `order`-field values disagree (e.g. after a
prior reorder or reconciliation), which is the mechanism behind "a new slide lands second-to-last"
for a group with no copyright entries (see 29-04-SUMMARY.md for the investigation of the second,
unrelated candidate mechanism).

**Reorder failure handling (T-29-13):** surfaces the failure inline and forces the card list to
rebuild from props (via `gridRenderNonce`) — the DOM revert this used to lean on is gone, and
`props.assembledSlideshow` changes no prop on a rejected write, so nothing re-renders on its own.

### src/components/slides/SlideGroupMusicControl.vue

**Module overview (Phase 25 Task 1, R032):** group-level audio bed control, scoped to the SELECTED
GROUP rather than a service slot, and audio-only per D-14 (group music is never a slide; dropped
video is a slide, that path is 25-07's). This is the sole surviving attach/remove surface for
group-bed audio — the Service Order tab's per-slot equivalent was removed in Phase 27-04. Emit-only:
uploads through `useMediaUpload` and emits the resulting URL via `attach`, or emits `remove` for a
plain, unconfirmed clear; performs NO Firestore write itself — `SlideGrid.vue` (Task 2) intercepts
both events and calls the slideGroups store's scoped bed write. A failed upload sets the composable's
reactive `error` and emits NOTHING — it can never clear an existing group bed attachment
(T-25-06-03).

### src/components/slides/SlidesTab.vue

**`serviceLocked` prop (★ R036):** the lifecycle lock, threaded DISTINCT from `isEditor` rather than
folded into it upstream. Passing `canEditService` as `is-editor` would lock everything in one line,
but it would also make it impossible for `EditSlideDrawer` to tell "you are a viewer" from "the
service is locked" — and 31-UI-SPEC § 6 requires different read-only copy for each. Every downstream
gate composes the two (`isEditor && !serviceLocked`); the drawer additionally branches on
`serviceLocked` alone for its notice. Defaulted `false` so existing fixtures that mount this
component without the prop keep behaving exactly as they did.

**`canPresent`:** whether there is anything assembled to present — the same condition
`SlideshowPreview`'s own `canPresent` (aliased to `hasAnySlides`, Phase 23-04) used, restated
directly against `assembledSlideshow` rather than reintroducing the `AssembledSection[]` grouping
that only existed to render the removed preview list. Phase 36-03 (design 1a): the `▶ Present`
button this gates now renders in `ServiceEditorView`'s page header, immediately left of Save,
instead of inside this tab — this component still owns the condition and the `present` emit;
exposed (with `onPresentClick`) so the header can drive both from a `slidesTabRef`.

**`pendingDrawerAction` (Phase 33-09):** a menu-dispatched Duplicate/Delete request, relayed
verbatim into the drawer's own `pendingAction` prop (33-07's seam). Keyed on a monotonically
incrementing nonce (never the `key` alone) so the same key dispatched twice in a row still fires the
drawer's watcher the second time. P-01: this component never calls a delete/duplicate store action
itself — it only ever sets this pending request, which the drawer turns into its own existing write
paths (the inline delete confirm, the duplicate write). No longer set true on every selection
(Phase 33-09, R051) — that was the coupling this plan exists to break; `drawerOpen` is set true only
by `onMenuAction`'s edit key and the post-duplicate follow-selection handler, and cleared only by the
drawer's own `close` emit or by the selection itself disappearing.

**`onEditCongregational`:** the group-level "Make this / Modify congregational reading" button
(`SlideGrid`'s `edit-congregational` emit) — a more discoverable route to the SAME editor the 3-dot
menu's `edit-in-scripture` opens, taking the exact same path: honour the open drawer's unsaved-edit
guard, close the drawer (two editing surfaces must not stack on one entry), then relay via
`requestEditInScripture`, which uses the selected plan item's array index — the group this button
belongs to.

**`presentStartIndex` (R061):** the (group, slide) → flat-deck-index mapping `present` hands to
`PresentationViewer`. Ladder: a selected SLIDE resolves to its own flat index; failing that, the
selected GROUP's first slide; failing that, 0. Each rung falls through to the next on a miss — this
is what makes a stale selection degrade quietly instead of throwing or landing on an unrelated
slide. Resolved via `findIndex` only: `selectedSlideId` is an assembled slide's string `id`, never a
position (35-RESEARCH.md Anti-Patterns).

### src/components/slides/SlotLoopControl.vue

**Module overview (R306/R307, Phase 106):** per-item Run auto-advance/loop authoring control.
Relocated (owner 2026-09-01) out of the Service Order slot rows into the Slide editor: loop is a
presentation concern, never a plan concern, and it must never apply to Song items — so it is only
ever rendered in `SlideGrid` for a MISC or ANNOUNCEMENTS plan item (that gate lives in `SlideGrid`,
not here). This component owns the whole checkbox/preset/custom-seconds UI and its logic, and emits
ONE `change` with the resulting loop object; the parent chain (`SlideGrid` → `SlidesTab` →
`ServiceEditorView`) persists it onto `slot.loop` through the existing autosave path — no new save
call, no rules surface. `enabled: false` (not an absent object) is the "off" state, exactly as the
field's own contract defines.

### src/components/slides/dropRouting.ts

**Module overview (25-07 Task 2, R018/R032):** pure module partitioning a native drop's raw
`File[]` into the four accepted kinds (PPTX deck, image, video, audio) plus a rejected bucket. A
native HTML5 drop delivers raw `File` objects with NO filtering whatsoever — the file input's
`accept` attribute never runs on this path — so this module IS the filter: every drop (the tile's
and the whole-grid container's) must route through `resolveDrop` before any upload begins. A PPTX is
classified by its file-NAME extension rather than its MIME type, since an OS drag often supplies an
empty or generic MIME type for `.pptx` (verified: `application/octet-stream`, or `''`) — MIME-sniffing
alone would misclassify it as rejected. Images/video/audio are classified by MIME prefix, using the
SAME prefixes `useMediaUpload` validates against (`audio/*`, `video/*`) so this module and that
composable's own server-mirroring validation can never disagree.

**`resolveDrop`'s multi-kind resolution order (25-07 Task 2, D-14 discretion):** the first audio
file becomes the group's music; every video file appends a slide, in drop order; for the two
modal-backed kinds, a PPTX takes precedence and the first one is imported, otherwise every image is
imported as one deck. Anything left over — extra audio files, images skipped because a PPTX won, and
anything unsupported — is collected into `skipped` so the caller can report it rather than silently
drop it.

### src/components/slides/slideDisplay.ts

**`KIND_BADGE_CLASSES`/`RENDER_FAILURE_SENTENCES`:** static, fully-spelled-out literal maps (per
25-UI-SPEC.md's Color § "Kind badge color map" and 42-UI-SPEC.md's copywriting-contract table).
Tailwind v4 silently purges any class name built by string interpolation (e.g. `` `bg-${kind}-900` ``)
from the production bundle — this codebase has shipped that exact bug twice already (`SongBadge.vue`,
`TeamTagPill.vue`) — so every badge-class value is a complete, literal string. The backend's
`failureReason` slug space is open (`functions/src/index.ts` can add a new reason without a client
deploy), so `RENDER_FAILURE_SENTENCES` is deliberately NOT exhaustive; `renderFailureSentence` is the
ONE sanctioned route from a render document's raw `failureReason` slug to the DOM
(`SlideBase.renderFailureReason`'s own doc comment names this function as its only legal consumer) —
never render `failureReason` any other way. Its fallback arm is written out explicitly rather than
left to exhaustiveness (the same defensive posture `slideActionMenuItems`'s `default` arm takes),
closing off T-42-04 structurally: whatever string a tampered render document carries, including
markup, the return value is always one of exactly three authored sentences, and the input string
itself never appears in the output.

**`speakerDisplayName` (Phase 38-03, widened Phase 47 R095):** readable, natural-case speaker name
for a congregational section's `speaker` enum value (`'LEADER'` → `'Leader'`, `'CONGREGATION'` →
`'Congregation'`, `'ALL'` → `'All'`). This module already exists so the rail and the grid never fork
the kind-badge vocabulary; the three speaker words are exactly that kind of vocabulary, so this is
the ONE producer of them — `slideContentLabel`'s eyebrow, `slideFooterLabel`'s footer, and
`EditSlideDrawer.vue`'s speaker control all read through this rather than re-deriving the spelling.

**`deleteSlideConfirmBody` (26-UI-SPEC.md § "Duplicate and Delete Slide", Phase 24 D-03
precedent):** the four wordings, reproduced verbatim, branching on whether THIS entry (never the
group) has its own attached audio and/or operator notes. `entry.audioUrl` is the entry's OWN
per-slide audio, distinct from the group's shared bed music (`SlideGroup.bedAudioUrl`) — deleting a
slide never touches the bed, and this wording must never imply otherwise by naming media that
belongs to the group instead of the slide.

**`MENU_ITEM_LABELS['edit-in-scripture']` relabeling history:** 34-07 (owner UAT F1) changed this key
to open the congregational-reading editor in place (a modal over the Slides tab), not a navigation
away from it — `'edit-in-song'` stays `'nav'` in `menuItemToneFor` because IT still routes to the
song editor. Relabelled again 2026-08-05 (owner): "Edit scripture text" promised something the
destination does not offer — what opens is the modal titled "Congregational Reading" (enter a
reference, Fetch, AI-split, toggle each section's speaker); there is deliberately NO free-text
scripture override anywhere in it (34-07: the owner was shown the D-13/D-15 shadow-copy tension and
declined it), so a label promising text editing described a feature that does not and will not exist
here. Kept as an action phrase because every sibling label here is one ('Edit details', 'Duplicate',
'Delete Slide') — accepted as slightly odd on a reading that already exists, because the modal's own
heading names the state correctly once open and the previous label was actively wrong on every
visit.

**`slideActionMenuItems` (R063):** pure per-kind 3-dot slide action menu item list. Synchronous, no
store/composable reads — item order is fixed and identical across kinds for shared items:
edit-details, then the navigation item (where one exists), then duplicate, then delete. Deliberate
divergence from 33-UI-SPEC.md §3's stated 4-parameter signature: the fourth parameter
`canMutateBackground` is NOT threaded through, since nothing in §3's table branches on it and per §11
"Edit details" is unconditional (the drawer it opens is a view affordance too) — background-mutation
gating lives entirely inside `EditSlideDrawer.vue`'s own `canMutateBackground` computed. D2
(260805-bvo, owner authority, superseding 33-UI-SPEC.md §3 row 3a/§4): the Hymn carve-out that used
to withhold a second edit affordance from a HYMN group's auto-derived pristine text slide is REVERSED
— owner verbatim: "This only non-editable thing should be Song. Everything else can be editable.
Hymns are a special thing for now only." Every `text` entry now returns the same menu regardless of
whether its body is defined or which plan item kind it belongs to, including a HYMN group's
auto-derived slide, which can now diverge from its Service Order Hymn fields when edited here — the
owner accepts that divergence as temporary (T-bvo-03); R054/P-03 is NOT dropped by this reversal.
`planItemKind` is UNCONSULTED by every branch (kept in R063's signature rather than removed, since
this repo's ESLint `args: 'after-used'` rule does not flag it followed by a used parameter). The
`default` arm returns the single most conservative item (`edit-details` only) for an unrecognized
`sourceRef.kind`, never the most permissive. Prohibition P-03 is structural: `lyric`/`copyright`
entries are always inside a SONG group (R054) and their rows never include `duplicate`/`delete`
under any argument combination, not even when `canMutate` is true — both branches return immediately
after pushing their two fixed items, so `canMutate` is never consulted for them; D2 does not touch
this.

### src/components/stage/StageKindIcon.vue

**Module overview (Phase 107 redesign):** inline-SVG glyph for a stage-marker kind. The app has no
icon-font dependency and renders icons as inline SVGs by convention, so the imported design's
Phosphor web font is intentionally NOT used — each `icon` name from `STAGE_KIND_META` maps to a
hand-authored 24×24 stroke glyph here. One component, reused by the palette chip, the marker tile
(editor + read-only view), and the inspector drawer, so there is exactly one place a kind's glyph is
defined. Pure/presentational (no store, no Firebase) so it is safe on the public ShareView via
`StageLayoutView`. Colour comes from `currentColor`.

### src/components/stage/StageLayoutEditor.vue

**Module overview (R313/R314, Phase 107), redesigned to the single-room "Nocturne" diagram:** the
AUTHORING half of the visual stage layout — a left PALETTE of typed chips, one continuous room
CANVAS (`StageRoom`), and — for editing a marker — the app's existing right-hand slide-over pattern
(matching `RoleSlideOver`/`TeamSlideOver`: a Teleport modal with a backdrop and a buffered
Save/Cancel form). Click a chip to drop a marker, drag it where it stands, click it to edit its
label/assigned person/type/note. Placement is FREE (never snapped to a grid): pointerup resolves the
exact clamped `xPct`/`yPct` within the single room rect and derives the stored `zone` from that
position. Still native Pointer Events (never Konva/interactjs/HTML5-DnD, which is mouse-only and
dead on touch). The parent owns `elements`; this component NEVER mutates the prop array — every
change round-trips through an emit (add/update/remove/move) so the parent's single autosave path
stays the one source of truth. A marker can be named by picking a PERSON already serving this
service (via `assignablePeople`, resolved from the service's role assignments) OR by a free-text
LABEL — the label stays editable for a spot with no matching assigned person (a guest, a spare,
gear). The kind's TYPE is always shown on the tile alongside the label, so a tile reads as both a
name and a type. When `editable` is false (locked service) this renders the SAME shared read-only
`StageLayoutView` used by share/print — no third rendering path.

### src/components/stage/StageLayoutPrintDocument.vue

**Module overview (quick task 2026-09-01):** the tech team's printable STAGE LAYOUT sheet — hidden
on screen, shown only when printing, and printed LANDSCAPE + BLACK AND WHITE (see
`ServiceEditorView.printStageLayout`, which injects the `@page { size: landscape }` rule and toggles
this doc in over the normal service print). It pairs the high-contrast outline diagram with a large,
legible list of every marker grouped by placement, so a tech setting up the stage can read it at a
glance. Available whether the service is a draft or locked/planned — printing is read-only.
Pure/presentational (props only) — safe to render from the read-only, possibly-locked editor.

### src/components/stage/StageMarkerChip.vue

**Module overview (Phase 107 redesign):** a single stage-marker tile — a rounded icon tile with the
kind glyph, the label beneath it, plus the type, an assigned person, and a tech note. Purely
PRESENTATIONAL and single-root, so both callers drive it by fallthrough: `StageLayoutEditor`
positions it (`:style`), marks it interactive, and attaches the native pointer handlers for drag plus
the click-to-select; `StageLayoutView` (read-only: locked editor/share/print) just positions it — no
handlers, not interactive. No store/Firebase import — safe on the public ShareView. `print` mode
renders a larger, high-contrast BLACK-AND-WHITE tile for the tech team's printed sheet (bigger
legible type, black text, a white tile with a black outline). The label is bound via Vue text
interpolation ONLY, so a label containing markup renders as literal text (XSS-safe, R315).

### src/components/stage/StageRoom.vue

**Module overview (Phase 107 redesign):** the stage-room BACKDROP — one continuous room drawn the
way it reads when you stand in it: the platform is a shape at the top, the audience sits below, and
"off stage" is the floor in the side wings. Shared verbatim by the read-only `StageLayoutView`
(locked editor/share/print) and the live `StageLayoutEditor`, so the diagram is defined in exactly
ONE place and can never drift between authoring and the printed/shared plot. Pure/presentational: no
store, no Firebase — safe on the public ShareView. Markers are projected in through the default
slot, absolutely positioned by the caller over this same rect. The root element is exposed as
`roomEl` so the editor can read its bounding rect for drop math (drag never measures a marker, only
this room, keeping placement resize-stable — R314). `print` mode renders a high-contrast
BLACK-AND-WHITE plot for the tech team's printed sheet: the stage platform is an OUTLINE (a line, not
a filled shape) so it costs no ink and reads clearly, labels are larger and black, and the audience
seats become hollow outlines.

### src/composables/useAutoSave.ts

**Module overview:** reusable auto-save composable extracted from `ServiceEditorView`'s pattern.
Watches a reactive source with a deep watcher, debounces changes, and calls `saveFn` after the
debounce period elapses. An inflight guard prevents concurrent saves — if a save is already running
when the timer fires, the save is rescheduled. The first trigger from the watcher is suppressed
(initialized guard) so the initial load of data does not trigger a save. Status is one of five
values: `'idle' | 'pending' | 'saving' | 'saved' | 'error'`. A rejected `saveFn` is contained on both
the debounced path and `flush()` and surfaces as the `'error'` status rather than an unhandled
rejection — it is never left stranded at `'saving'`; the handling is generic, it only sets the
status, it does not inspect or discriminate the failure. The `'saved'` state is terminal — it
persists until the next pending transition, it does not fade back to `'idle'` on its own.

### src/composables/useBackgroundUpload.ts

**`BACKGROUND_MAX_BYTES` (R055/R057, Phase 33 Plan 03):** a client-side pre-validation figure that
sits well under the authoritative server-side cap for this prefix. `orgs/{orgId}/backgrounds/**`
does NOT match `storage.rules`' dedicated `orgs/{orgId}/media/{allPaths=**}` block (that block's
50MB cap belongs to `useMediaUpload`, not this one) — it falls through to the generic
`orgs/{orgId}/{allPaths=**}` catch-all, which caps at 25MB. 10MB is well under that, so no
`storage.rules` change is needed or in scope for this phase (33-RESEARCH.md § Research Question 1).

### src/composables/useLoopTimer.ts

**Module overview (Phase 106, R306/R308):** the single-active-timer primitive behind per-item Run
loop playback. Owns EXACTLY ONE interval id. `arm()` ALWAYS `disarm()`s first, so there is never
more than one live timer no matter how many times `arm()` is called in a row (the T-106-03
leak/duplicate-timer mitigation) — this also means arming resets the clock, which is exactly what
makes a manual nav mid-interval (`useRunControl`'s `postIndex` → `reconcileLoop` → `arm`) restart the
interval from the new position instead of fighting a stale tick. `disarm()` clears and nulls the id
and is idempotent (safe to call when already disarmed). `onUnmounted(disarm)` is registered on the
calling instance so a plain route-away/unmount can never leak a ticking interval even if the caller
(`useRunControl.ts`) forgets to disarm explicitly on every exit path — defense-in-depth alongside its
own `confirmExit`/`endServiceTeardown` disarms. Must be called from inside a component `setup()` (it
calls `onUnmounted`).

### src/composables/useOutputWindow.ts

**Automatic Fullscreen content setting (Chrome 126+ — the zero-click primary):** Chrome's
"Automatic Fullscreen" content setting (a one-time per-computer allow, or the
`AutomaticFullscreenAllowedForUrls` enterprise policy) lets an allowed origin call
`Element.requestFullscreen()` without a user gesture. This is the correct fix for the multi-display
problem: gesture-based fullscreen (capability delegation, the control button, a per-window tap) can
only fullscreen ONE window per gesture — the browser consumes the transient activation on the first
`requestFullscreen`, so the second display never gets it. With the content setting granted, each
output window self-fullscreens on load INDEPENDENTLY (no shared gesture), so both displays go
fullscreen with zero clicks. The control already opened and positioned each window on its assigned
monitor (`window.open` left/top/width/height), so a plain `requestFullscreen()` fullscreens on the
monitor the window is already on — no `getScreenDetails()` needed. When the setting is not granted
(or the permission descriptor is unsupported / `query()` throws), `attemptAutoFullscreen()` does
nothing — the existing fallbacks remain: the `wp-fullscreen-delegate` capability-delegation listener,
the opener-side delegation + control "Fullscreen displays" button, and the one-tap-anywhere overlay
in each output view. Best-effort: where the browser honors the setting, each output self-fullscreens
on mount with no gesture; where it does NOT — proven on the owner's Chrome 151 and Edge even with a
correct machine-wide policy (`chrome://policy` showed OK) — the permission query reports `'granted'`
but `requestFullscreen` still rejects "not granted"; this is a silent no-op, and the per-display "Go
fullscreen" buttons on the control's Displays panel (gesture-delegated, one click per display) are
the reliable path. Never throws.

### src/composables/useRunControl.ts

**Output-window orchestration (R261/R266):** the Go live gesture opens BOTH standalone output
windows and (when the live monitors match a saved mapping) places each on its assigned screen. This
runs ONLY from the run-go-live-btn click — NEVER `onMounted`. `window.open` (pop-up blocker) and
`requestFullscreen({ screen })` require a live transient activation traceable to a gesture task;
after the Run click's `router.push` + the lazy route-chunk `import()` + the async auth/org
`beforeEach` guard + the mount tick, Chrome/Edge no longer honor that activation on mount, so an
`onMounted` open would silently open ZERO windows on a cold first Run while claiming success. The
operator clicks Go live on the control screen to supply a FRESH, live activation for both
`window.open` and `requestFullscreen`. HANDSHAKE (95-03): the channel is the single writer from
mount and `postIndex` drives state whether or not a display is open; when Go live opens a window it
posts hello and the control's `onHello` (`resendCurrent`) resends the current index — so the operator
may click Go live at ANY time (even after navigating several slides) and the freshly-opened output
syncs to the live slide.

**Per-display fullscreen (owner UAT):** bound to a "Go fullscreen" button on each card in the
control's Displays panel. The automatic no-gesture path is unreliable across browsers (proven on
Chrome 151 + Edge with a correct machine-wide policy), so fullscreen is driven by an explicit
operator click — one per display, all in one place at the booth, so nobody chases the mouse across
monitors that may not even be visible. Runs synchronously in the button's click handler, so the
click's transient activation is delegated to the already-open, already-loaded output window, which
then `requestFullscreen()`s reliably (no load-race to eat the gesture). No-op if the window is
closed. Generalizes to any future output role (e.g. Live Stream).

**Per-item loop timer (R306/R308, Phase 106):** the SINGLE loop timer lives HERE — never in an
output window (`AudienceOutputView`/`ConfidenceOutputView` stay receive-only, see the Anti-Patterns
section above). Every advance routes through `postIndex()` (the single writer), so the loop and
manual nav can never fight or double-drive the output windows (T-106-04). `reconcileLoop()` is the
ONE place that decides arm vs. disarm, called from `postIndex` (after posting — manual nav AND every
loop tick itself), `postBlackout` ("Go to black" pauses/resumes the loop per 106-CONTEXT.md), and
`watch(currentSlotIndex)` (item change) / `watch(live)` (go-live/rehearse arms, End Service/End
Rehearsal disarms).

**`openManage` (owner fix #5):** opens the monitor-setup screen in a NEW TAB so the running control
(index/seq/channel plus any open outputs) survives — mirrors the reassign banner's new-tab rule.
Deliberately NO `'noopener'`: `noopener` severs the opener relationship, and the HTML spec only
copies the opener's `sessionStorage` — which carries a multi-church user's picked active org — to the
child when that relationship is preserved. With `noopener` the fresh tab had no active-org, so the
router guard bounced it to `/select-church`; a plain `window.open` (like the run/output windows
already use) lets the new tab inherit `sessionStorage` and load monitor-setup.

### src/composables/useRunTimers.ts

**Module overview (R281):** the Run screen's wall clock plus elapsed-since-go-live timer. A SINGLE
~1s `setInterval`, created in `onMounted` and cleared in `onUnmounted` (mirroring
`RunControlView`'s `stopRecoveryWatchers` clearInterval + null-the-id discipline), drives both a
short wall-time `clock` string and an `elapsed` (M:SS / H:MM:SS) string measured from the go-live
origin. `startElapsed()` is idempotent: only the FIRST call (the first go-live OR the first rehearse)
records the origin; later calls are no-ops. `resetElapsed()` clears the origin so `elapsed` reads
'00:00' again. All formatting is padStart-based — no `Array.prototype.at` (absent from the TS lib
target; see CLAUDE.md). Fake-timer friendly: `advanceTimersByTime` drives both the clock and the
elapsed count, so a mount/unmount harness can prove the interval self-clears.

### src/composables/useSlideshowAssembly.ts

**Module overview:** reactive wrapper over the pure `assembleSlideshow` engine (20-02), delivering
R006 — reorder/add/remove a service element and the assembled slideshow follows with no manual
re-sync. Builds the content maps `assembleSlideshow` needs from live Pinia stores
(`scriptureReadingsById` from the scriptureSlides store) and maintains its own `songLyricsById` map
by loading the current (newest) lyrics doc for every distinct songId referenced by a SONG slot (the
songLyrics store itself only ever subscribes to a single song at a time, so it cannot be reused
directly here). A song's slide order is read from that lyrics document's `performanceOrder` field
alone (R035/D-03) — there is no second order source and no precedence chain.

**`LyricsSubscriber`:** opens a LIVE subscription to a song's current (newest) lyrics document.
`onUpdate` fires with the newest doc (or `null` when none exists) on the initial snapshot AND on
every subsequent edit, so a reworded lyric or a verse added/removed/reordered propagates to the
assembled slideshow with no composable remount — independently of `canWrite`, so a locked/viewer
session sees content edits live. Injectable for tests.

**`ensureGroupMaterialized` (25-05 Task 1):** resolves to `{ entries, sourceSignature }` for
`slotId`'s group, creating it first if it does not exist yet — including when the derived input has
ZERO slides, unlike the automatic `materializeCandidates` watcher (that skip implements Phase 24
D-02's "groups are always populated" rule for AUTOMATIC materialization; this function only ever
runs because a user just asked to put something into this plan item, R032). Resolves `undefined`
when it cannot act (no service, no org, no such slot, the caller cannot write, or the slot's delete
is in flight). Concurrent calls for the SAME slot are deduped through `ensureInFlight` so at most one
create is issued and every caller resolves the same result — also participates in the shared
`materializingSlotIds` guard so the automatic watcher cannot fire a second create for a slot this
function is already materializing (belt and braces on top of the store's deterministic doc id, which
already makes the worst case of the reverse race a harmless overwrite rather than two divergent
documents).

**`suppressMaterialization` (ME-04, R045 membership):** marks `slotId` as having a delete in flight
and returns the release; call it in a `finally`. `confirmSlotDelete` awaits the group cascade BEFORE
splicing the slot, so a failed delete never leaves the slot removed locally while its group lingers —
but Firestore applies a delete to its LOCAL cache and raises `onSnapshot` immediately, whereas
`deleteDoc` resolves only on server ack, so for the length of that ack the slot is still in
`service.slots` with no group, exactly the shape `materializationCandidates` treats as "materialize
me": the watcher re-created the document the cascade had just deleted, and the slot was then spliced
out with no second cascade, orphaning the group document indefinitely. A held slot is skipped by
BOTH the automatic candidate watcher and `ensureGroupMaterialized`.

**`drainGroupWrites` (HI-01):** resolves once no group write issued by this composable is still in
flight. Both apply loops run fire-and-forget from `{ immediate: true }` watchers, so without this
there is no way for a caller to know a write is outstanding — and `onMarkAsPlanned` flipped the
service's status straight through that window, leaving the write to be denied on arrival by the
`/slideGroups` rule while the user saw a normal transition. Never rejects: individual failures are
already contained and logged at the point of the write — this is a barrier, not an error channel.

**`distinctRenderImportIds`'s imported-entry collection (part 2):** `imported` ENTRIES living inside
ANY slot's slide group. A PPTX deck's rendered slides can be added straight into a non-IMPORTED
slot's group (e.g. a Prayer or Scripture group), where the render linkage lives on the entry's deck
(`sourceRef.importId` → `ImportedDeck.id` → `renderImportId`), NOT on an IMPORTED slot and NOT on the
group's own `renderImportId` (which stays null for a non-imported slot). Without collecting these,
the render doc is never subscribed, its `ready` status is never seen, and every such entry hangs on
the "Rendering" spinner permanently even after the render has completed — a real production defect
(a deck imported into a Prayer group's slides).

**`assemblyGroupsBySlotId`:** the group map the assembler renders from. For an EDITABLE session
(`canWrite`) this is the store's map UNCHANGED — the rebuild loop persists any regenerated group, so
the stored group is authoritative and behavior is identical to before. For a LOCKED/viewer session
(`!canWrite`), a SONG group gone stale against its song's current verse structure (`songGroupIsStale`)
is OMITTED, so the assembler falls through to its live no-group derivation path (`performanceOrder`),
reflowing an added/removed/reordered verse IN MEMORY. Nothing is persisted here: this override only
feeds `assembledSlideshow` (read/render), never the write paths (`materializationCandidates` /
`rebuildOutcomes` / `ensureGroupMaterialized` all read the store map directly and stay gated on
`canWrite`), so a locked session still writes nothing to `/slideGroups`.

**`materializationCandidates` (Task 2: lazy materialization, zero writes on reorder):** a fully
SYNCHRONOUS computed that decides WHAT needs materializing. This matters: an async function body
passed to `watch`/`watchEffect` only tracks reactive reads made before its first `await` — reads made
after resuming from an await happen outside the effect's tracking window, silently dropping
dependencies. Keeping the decision synchronous (mirroring `distinctSongIds`'s shape) and only
performing the actual (async) writes in the watch callback avoids that pitfall entirely.

## Store & Config Behavioral Notes (R318)

### src/config/appConfigDefaults.ts

**`mergeAppConfig`:** a client-side mirror of `functions/src/appConfig.ts`'s `mergeAppConfig` —
deliberately a PER-GROUP merge (not a naive recursive deep-merge or a generic deep-merge library),
so a doc that sets only e.g. `cleanup.mediaEnabled` never wipes sibling `cleanup.*` defaults
(R182/R186). This mirror does not need the server copy's full fail-open/fail-closed `coerce*`
discipline (the field components' own min/max/required validation already blocks obviously-bad
saves before they reach Firestore) — it only needs to be forgiving of a partial/absent doc,
matching R182's guarantee that an absent `appConfig/global` doc resolves to `DEFAULT_APP_CONFIG`.

### src/stores/appConfig.ts

**Module overview (Phase 70, R186/R187):** Pinia store over the single `appConfig/global`
Firestore doc. Mirrors `src/stores/auth.ts`'s onSnapshot/Unsubscribe lifecycle and the roster
subscription shape (subscribe()/unsubscribe() as explicit actions called from a component's
onMounted/onUnmounted, not module-scope side effects — keeps the store mockable/testable without a
component mount).

**`saveField` write discipline (R182):** every `appConfig/global` write MUST use
`setDoc(..., {merge:true})`, NEVER `updateDoc` — R182 made an absent doc a valid, expected state
(e.g. a fresh deploy that has never been saved through this console); `updateDoc` throws not-found
against a document that has never been created. CRITICAL (bug fix 2026-08-31):
`setDoc(..., {merge:true})` treats a KEY that contains dots as a LITERAL field name, NOT a nested
path — only `updateDoc` interprets `a.b` as nesting. Writing `{ 'onboarding.emailsEnabled': true }`
therefore created a flat field literally named `"onboarding.emailsEnabled"`, which `mergeAppConfig`
(reading the NESTED `onboarding.emailsEnabled`) never saw — so every Owner Console toggle silently
failed to persist (the value reverted to its default on reload). `buildNestedField` expands the
dot-path into a nested object instead; setDoc merge deep-merges the leaf, leaving sibling keys
untouched, and the read side round-trips correctly.

### src/stores/auth.ts

**`memberships`:** the organizations the signed-in user belongs to (`{id, name, active, role}`) —
the source the login church-picker AND (Phase 104, R311/R312) the sidebar church switcher render
when a user belongs to more than one. Populated by `loadOrgContext`. `active` defaults to `true`
for a readable org doc with no `active` field (legacy orgs); a caught read failure (deactivation OR
a stale/orphaned membership) conservatively defaults to `false` (R213/T-76-08). `role` (Phase 104,
R311) is resolved per-entry from the `orgs` custom claim (`claimOrgs[id]`, read in
`loadOrgContext`) — `'editor'` only when the claim explicitly says so, `'viewer'` otherwise,
INCLUDING an org present in `orgIds` but not yet caught up in the claim (never crashes or drops the
entry — same never-blank-the-list posture as name/active).

**`refreshOrgClaim` (R075 D-06/D-07 / P-01):** forces the custom `orgId`/`role` claim (set by
`functions/src/orgMembershipClaims.ts`'s `syncOrgMembershipClaim` trigger) onto the active session's
ID token so a member does not wait out a full 1-hour token lifetime for it to propagate.
`getIdTokenResult` is used (rather than `getIdToken`) because it returns the decoded `claims`
object, which is what lets the retry loop know when to stop. `awaitClaim` scopes the retry (P-01)
to the just-created-membership window only: `false` loops at most once with no delay (the ordinary,
already-a-member path — latency must stay unchanged), `true` loops up to `CLAIM_REFRESH_MAX_ATTEMPTS`
times spaced `CLAIM_REFRESH_DELAY_MS` apart, stopping the instant `claims.orgId` strictly equals
`targetOrgId` (a claim naming a different org never satisfies the wait). Known limitation (D-01/D-04,
documented not accidental): the claim only ever carries the user's PRIMARY org (`orgIds[0]`). For a
multi-org user, a non-primary org load passes a `targetOrgId` the claim will never carry — that load
is, and stays, served by the Firestore-membership arm of the dual-read alone; that is expected, not a
bug in this retry. Never throws: a failed or exhausted refresh is not a failed sign-in —
`storage.rules`' Firestore-membership arm still grants access while the claim is missing, so
`loadOrgContext` must still resolve either way.

**`vwModeEnabled` dual-read (R073):** nested `settings` value first, then the legacy flat field,
then the hardcoded default. This is live production data — do NOT collapse this to
`orgSettings.vwModeEnabled ?? true`, which would silently turn Vertical Worship back ON for a church
that deliberately turned it off via the flat field. No read-triggered backfill is performed; the
backfill is write-triggered, delivered by the Settings toggle's save handler switching its write
target to the `settings.vwModeEnabled` dot-path. Computed once and applied to BOTH
`settings.value.vwModeEnabled` and the standalone `vwModeEnabled` ref so they can never disagree.

**`loadOrgContext` orgIds self-heal (Bug 1b, quick 260830-l9c):** self-heals a clobbered `orgIds`
array from the authoritative `orgs` custom claim. `functions/src/orgMembershipClaims.ts` computes
the FULL multi-org set server-side (`collectionGroup('members')` scan) on every membership write,
so an account whose client-side `orgIds` was already clobbered down to a single element (the
pre-1a REPLACE bug) still has every org listed in its claim — unioning it in here means the picker
self-heals with no manual Firestore repair. Read WITHOUT forcing a network refresh (the separate
forced `refreshOrgClaim(activeId, ...)` still runs once `activeId` is known) so this stays cheap on
the ordinary already-a-member path. Never throws: a failed claim read must still let an
orgIds-only login proceed.

**`loadOrgContext` membership-list build:** builds the membership list (`{id, name, active}`) the
church picker renders. Each org doc is read individually and guarded: an org the user has an
`orgIds` entry for but can't cleanly read (e.g. a stale/orphaned id with no member doc, or —
post-76-01 — a deactivated org's own member being denied) falls back to its id and `active: false`
instead of rejecting the whole list, so one bad membership never blanks or breaks the picker
(R213/T-76-08).

### src/stores/quarters.ts

**`setPersonAvailability` (D-03/D-05/D-06):** single-person quarter-data save from the availability
drawer. Writes ONLY the scoped `personQuarterData.${id}` dot-path — never the whole
`personQuarterData` map — so concurrent edits to other people's entries aren't clobbered
(T-14-03-01). Pairing is ONE-WAY (directional): `pairedWith` on this person is the list of people
THEY must serve with (the scheduler pulls those partners in when this person is scheduled — see
`propagatePairing` in `scheduler.ts`, which follows each person's OWN `pairedWith`). This save
therefore touches only this person's entry: no reciprocal write is mirrored onto a partner, so
"Nolan must serve with Tim" does not imply "Tim must serve with Nolan". Removing a partner here
likewise only edits this person's list, leaving the partner's own record untouched.

### src/stores/services.ts

**`ServiceLockedError` (R036 draft-only write guard, enforcement layer 2 of 3):** thrown by the
store's draft-only write guard. The guard is defence-in-depth, NOT the primary enforcement: the
Firestore rule added in 31-01 is what actually stops a determined client. This exists so a
client-side bug — a control that should have been removed when the service locked, or a handler
that forgot its early return — surfaces as a named local error naming R036 and the stored status,
instead of an opaque `FirebaseError: Missing or insufficient permissions` from a round trip. It
THROWS rather than silently returning (`createService`'s precedent, not `updateService`'s
`if (!orgId.value) return`) deliberately. A swallowed write is indistinguishable from a successful
one to the caller, which is precisely the "it didn't save" defect class this milestone exists to
close. This is not a new failure mode for any caller: since 31-01 these same writes already
rejected at the rules layer — the guard only makes the rejection immediate and legible.

**`ServiceSnapshot.stageLayout` (R315, Phase 107):** read-only public projection of
`Service.stageLayout`. Mirrors `roleAssignments`'s PII-safe-projection precedent: an explicit
per-field map, never a raw spread, so a future non-display `StageMarker` field cannot silently leak
to the public page. There is no PII here (a marker is only planner free text), but the explicit
shape still guards against scope creep. OPTIONAL and only ever present when the service has at
least one marker — see `buildServiceSnapshot`'s conditional spread. Absent (never `undefined`),
matching the `roleAssignments?.length` omit convention `ShareView.vue` already relies on for its own
optional sections.

**`buildServiceSnapshot` stage layout projection (T-107-01):** maps to EXACTLY the 6 display fields
— id, label, kind, zone, xPct, yPct — never a raw spread of the source marker, so a future
non-display `StageMarker` field cannot silently reach the public page. `kind` is optional on
`StageMarker` itself; the conditional spread keeps it absent (not `undefined`) on a marker that
never set one. IN-03: every UI-driven write path already clamps xPct/yPct to [0,100] before it
reaches `Service.stageLayout`, so this is unreachable through the app's own UI — but this
projection is the last line of defense before an unauthenticated public page renders these values,
so defensively re-clamp here too. A stored value that reached this field by some other path (bulk
import, manual Firestore edit, a future caller bug) can then never push a marker off-canvas on
ShareView. `note` is planner-authored tech instruction (non-PII free text, e.g. "XLR run from stage
left") and belongs on the printed/shared plot the tech team reads; the conditional spread keeps the
key ABSENT (never `note: undefined`) on a marker that never set one, same discipline as `kind` and
the whole projection's absent-not-undefined contract.

**R036 draft-only write guard (`assertWritable`/`storedStatusOf`/`isExportWrite`/`isReopenWrite`):**
the three shapes mirror `firestore.rules`' `/services` `allow update` clause one-for-one. They
deliberately do NOT invent a fourth policy: any divergence would either refuse a write the server
accepts (a phantom lock) or wave through one the server denies (an opaque round-trip failure).
Rule 1: `storedStatus() == 'draft'` → ordinary editing. Rule 2: `planned` → `exported` carrying
export evidence → D-09. Rule 3: → `draft`, touching only status → R037 reopen. `updateService`
appends `updatedAt` itself, so the caller-supplied key sets checked here are the rules'
`affectedKeys()` minus `updatedAt`. `storedStatusOf`'s `?? 'draft'` matches the rule's own
`resource.data.get('status','draft')` so legacy documents with no status field agree across both
layers.

**R247 (84-01) lastUsedAt recompute on lock/unlock:** a song's `lastUsedAt` reflects
`MAX(service.date)` over the LOCKED (non-draft) services it's in — never the wall-clock moment it
was assigned to a draft (see `src/utils/lastUsed.ts` for the canonical derivation and rationale).
`buildLastUsedSnapshot` builds the pure snapshot `computeLastUsedDate` consumes, with the ONE
service that triggered the recompute forced to its post-transition status — the Firestore status
write lands asynchronously through `onSnapshot`, so `services.value` at call time can still report
the OLD status; the override makes the recompute deterministic and timing-independent instead of
racing the snapshot listener. `recomputeLastUsedFor` derives, for each affected songId,
`MAX(locked service date)` via the canonical `computeLastUsedDate` and writes it through
`songStore.updateSong`. A non-null date becomes a `Timestamp` at local midnight (the same parse
convention the 84-02 backfill mirrors); no remaining locked service writes `lastUsedAt: null` — an
intentional blank, since the song IS in a service, just none currently locked.

**R037 status transitions (`markAsPlanned`/`reopenService`):** D-02: explicit, named actions — one
per legal transition — replacing the deleted `toggleStatus` cycle. There is deliberately NO generic
status setter: a `setStatus(id, s)` would re-admit hand-setting `exported` without an export, which
is exactly the defect D-03 closes. `exported` is reachable ONLY through the export write. Both
throw on refusal; the caller must AWAIT them and only then reflect the new status in the UI — a
status that flips before the write lands is the "it didn't save" defect class this milestone exists
to close. `reopenService` — the payload is `status` + `updatedAt` and NOTHING ELSE: the rule's
`keys().hasOnly(['status','updatedAt'])` reads `affectedKeys()`, so adding `pcExportedAt`/`pcPlanId`
— even to re-write their existing values — can surface in that diff and get the whole write denied.
D-11 keeps both fields precisely by NOT touching them: the Planning Center plan stays linked, so a
re-export updates it instead of creating a duplicate, and D-04's evidence gate still fires on a
second reopen.

**`writeSharePayload` (R076/R078, 41-03):** the `shareTokens/{token}` payload write plus the
soft-fail memorable-URL `serviceShares/{slug}__service-{date}` write. Runs on EVERY
`ensureShareLink` path, including adoption, so a link already emailed to a congregation starts
showing current data immediately rather than waiting for the next edit. This is an unconditional
full-document `setDoc`, not a partial update — deliberately. That makes the write idempotent and
self-healing (a token document that was deleted is recreated rather than silently failing).
`shareTokens` is a payload surface, not the authoritative creation record — that lives on
`serviceShareLinks/{serviceId}` — so re-stamping `createdAt` is harmless and keeps the live token
sorting first if adoption ever runs again. The token is used VERBATIM as the document id: no
case-folding, no whitespace trimming, no Unicode normalization — `ShareView.vue` resolves
`/share/:token` using the route parameter verbatim as the document id, and any asymmetry here
breaks every adopted mixed-case legacy token.

**`ensureShareLink` (R076/R078):** resolves THE one stable token for a service: reading the
`serviceShareLinks/{serviceId}` identity doc if it exists, else adopting the most recent compatible
already-circulated `shareTokens` document, else minting a fresh one — then always writing the
current payload in place. `createShareToken` is a thin wrapper around this; both are exposed on the
store so a future caller can distinguish "resolve the link" from "share and get the token", though
today they're the same operation.

### src/stores/songLyrics.ts

**`setSongBackground` (R057):** sets or clears the song-level background image — the least specific
tier of the slide/group/song cascade `resolveEntryMedia` resolves. Writes exactly one field (plus
`updatedAt`) against the same lyrics document `updateCurrentLyrics` already targets; never touches
`sections`/`performanceOrder`. A dedicated single-purpose action rather than a call through
`updateCurrentLyrics` — that action is the autosave path and is typed as a partial of the document;
threading a deletion sentinel through it would widen its type for one caller. `null` clears the
field via an explicit `deleteField()` sentinel rather than an undefined value — same reason
`setGroupBedMedia` documents for itself in `slideGroups.ts`: an undefined value would be stripped
before the intent ever reached Firestore, so a clear would silently become a no-op.

### src/stores/toasts.ts

**Module overview (R309/R310):** the app-wide dismissible-message store, generalized in place from
the original narrow failure-toast store (R041). Every item — transient or sticky — gets a working
manual-dismiss (`dismiss()`); a sticky item ALSO clears when its owning view calls `clearSticky()`
once the condition it was warning about resolves. The auto-dismiss timer is armed HERE, inside the
store, not inside `ToastHost.vue` — a toast raised by a surface that unmounts a moment later must
still self-dismiss; if the timer lived in the component it would die with it and the toast would be
stranded on screen forever.

## Type & View Behavioral Notes (R318)

### src/types/organization.ts

**`ServiceTemplateEntry` (R086/R087):** a single entry in a church's default service template.
Carries the item's type, its section, and — for body-bearing kinds (MISC and the other
NonAssignable kinds the live editor treats the same way) — an optional recurring `body` text
(R116, e.g. "canned music", "more announcement slides"). It never carries chosen content (no
`songId` or scripture reference) and never a computed Vertical Worship type — VW typing is derived
fresh at service-creation time by `buildSlotsFromTemplate` (`src/utils/slotTypes.ts`) and is never
stored here. Array order in `OrgSettings.defaultServiceTemplate` IS the creation/display order —
there is no `position` field (Assumption A3).

**`OrgSettings` (R073):** church-level settings stored on `organizations/{orgId}.settings`. This
shape is nested rather than flat because eight settings arrive across five v1.5 phases (this
phase's `aiEnabled`/`pcEnabled`, plus one field each from Phase 44's default service template,
Phase 45's Bible version, and Phase 46's slide typography) — nesting isolates all of them from the
org document's identity fields (`name`, `slug`, `pcAppId`, `pcSecret`) instead of polluting the
document's top level one field at a time. Every member is REQUIRED, not optional. Optionality lives
at the one Firestore-read boundary — `auth.ts::loadOrgContext`, which narrows the document's
(possibly absent, possibly partial) `settings` field through `Partial<OrgSettings>` and merges it
under `DEFAULT_ORG_SETTINGS`. Because that merge happens exactly once, every consumer downstream of
the auth store reads `authStore.settings.<field>` as a plain boolean — no consumer anywhere writes
its own `?? default` fallback. Phases 44, 45 and 46 each extend this contract by adding one field
here plus one default in `DEFAULT_ORG_SETTINGS` — nothing else; they must never introduce a second
defaults-merge point.

**`OrgSettings.defaultServiceTemplate` (R086/R087):** entries carry `{ id, kind, section, body? }` —
never a chosen song/scripture and never a computed VW type, which is derived fresh at
service-creation time; `body?` carries recurring MISC text for body-bearing kinds (R116). An
empty/unset array does NOT produce an empty service: per R115 (which supersedes the owner's
2026-08-07 EMPTY override), `createService` seeds a new service from the Suggested Template
(`buildSuggestedTemplateEntries()`, the 1-2-2-3-derived preset) when this array is empty. The
fallback is resolved at the `createService` call site — `buildSlotsFromTemplate` stays pure
(`[]` → `[]`).

### src/types/pptxRender.ts

**Module overview (Phase 42, R079/R080):** client-side render-status type for
`organizations/{orgId}/pptxRenders/{importId}`. This is a CONSUMED-FIELDS PROJECTION of the server
document defined in `functions/src/index.ts`, not a wire mirror. It deliberately OMITS the server
document's `storagePath` field: a render document is server-written today but was writable by any
org editor until 42-01's rules fix landed (T-42-01), and display code has no legitimate reason to
build an image source from a render-document field at all — the sole sanctioned producer of a
rendered-page Storage path is `renderedPagePath` (`src/utils/renderedPagePaths.ts`), built only
from ids the client already trusts (orgId, renderImportId, pageNumber). Omitting the member here
turns "read a path off this document" into a compile error instead of a code-review question
(T-42-05). Keep this in sync by hand with `functions/src/index.ts` (`PptxRenderStatus`/
`PptxRenderDoc`) — there is no importable package boundary between `functions/` and `src/`.

### src/types/service.ts

**`MediaAttachableSlot.notes` (R122, Phase 54):** slot-level free-text notes — plain text only, a
planner jots who leads / who sings which parts beside the item's selector. Lives on the shared base
so `slot.notes` is reachable cast-free on all five slot kinds. OPTIONAL and schemaless: absent on
every slot written before this field existed, so no migration is required; an emptied value is set
back to `undefined` and dropped by `stripUndefined` before the Firestore write (Phase 51), so a raw
`undefined` never reaches the document. NOT to be confused with the SEPARATE required top-level
`Service.notes` — that is a service-level field on a different object.

**`MediaAttachableSlot.loop` (R306/R307, Phase 106):** per-item Run auto-advance/loop
configuration. Lives on the shared base so `slot.loop` is reachable cast-free on all five slot
kinds, exactly like `notes`. OPTIONAL and non-destructive: absent on every slot written before this
field existed (no migration); absent OR `enabled: false` both mean "current (non-looping) behavior"
— there is no third state. When the whole `loop` object is set back to `undefined` it is dropped by
`stripUndefined` before the Firestore write, same lifecycle as `notes`. `intervalSeconds` is
SECONDS, not milliseconds (default 10) — this is the approved 106-UI-SPEC.md contract and matches
the v2.7 ARCHITECTURE research (`intervalSeconds: number // default 10`). An earlier
106-CONTEXT.md draft phrase ("intervalMs") is superseded by this approved field name/unit.

**`StageMarker` (R313/R314/R315, Phase 107):** `label` is free text and the source of truth (an
owner may label a marker for a one-off speaker's mic); `kind` is an OPTIONAL light visual accent
only — never a required constrained picker (107-CONTEXT.md). `zone` places the marker in exactly
one of the two stage regions. `xPct`/`yPct` are percentages (0-100) of that zone's box, NOT pixels
— this is what makes a saved position resize-stable and reload-exact (R314): a viewport resize
simply recomputes pixel placement from the same stored percentage, with no refetch or recalculation
step.

### src/types/slide.ts

**Module overview:** unified `Slide` type with `contentKind` discriminator. S01 defines `'lyric'`
only; later slices add `'scripture'`, `'imported'`, `'text'`, `'image'`, and `'video'`. Phase 105
(R302/R303) adds `'blackout'` — additive, no other kind's shape changes — a first-class slide kind
that renders solid black with no text/background on every render surface
(Audience/Confidence/preview/print), backing an authored inline black slide inside a song's slide
sequence (105-CONTEXT.md).

**`SlideBase.audioUrl` (Phase 22 R013/R014, refactored Phase 24 D-04):** render carrier for
attached audio. For a slide resolved from a stored `SlideGroup` entry, `audioUrl` is filled by
two-level precedence — the entry's OWN audio first, falling back to the group's `bedAudioUrl`. The
bed is audio-only (D-18) — video is slide-only and never has a bed carrier. For a slot with no
materialized group yet, this is simply unset — there is no legacy slot-level media fallback (D-19:
the slide area has never shipped). Never persisted standalone on the (ephemeral, regenerated)
assembled slide.

**`SlideBase.renderState` (Phase 42, R079/R080):** render-state discriminator for a slide sourced
from a PPTX deck whose server-side render (`organizations/{orgId}/pptxRenders/{importId}`) has not
yet produced a usable page for it. This field's PRESENCE is the discriminator every consumer must
branch on FIRST, ahead of `contentKind` — a slide carrying `renderState` never carries drawable
content (`SlideCard.vue`/`PresentationViewer.vue` render pending/failed chrome instead of the
normal `contentKind: 'image'` `<img>` path). Set only by
`src/utils/importedRenderReconciler.ts`'s `importedEntryContent`; absent on every slide from every
other content path (lyric, scripture, text, video, or a rendered-ready image with a resolved URL).

**`SlideBase.renderFailureReason`:** the raw machine slug copied unchanged off the render
document's own `failureReason` (e.g. `'incomplete-render'`, `'render-service-error'`). Present only
alongside `renderState: 'failed'`. Never rendered directly — it MUST route through the
failure-sentence lookup 42-06 introduces (`slideDisplay.ts`), whose fallback arm exists precisely so
an unmapped slug never surfaces to a congregation as raw text (T-42-04). This field carries the
untranslated slug on purpose, named so that displaying it verbatim looks obviously wrong at the
call site.

**`BlackoutSlide` (R302/R303, 105-CONTEXT.md):** an authored inline black interlude. Carries NO
fields of its own beyond `SlideBase` — no text, no label, no background — because it renders as a
full solid-black screen on every surface (Audience/Confidence/preview/print) with nothing to draw.
Resolved from a `LyricSection` whose `kind` is `'blackout'` (`src/utils/songSectionOrder.ts`,
`src/utils/slideshowAssembler.ts`) — a blackout slide still carries `audioUrl`/`audioLoop`/
`backgroundImageUrl` inherited fields structurally (`SlideBase`), but the assembler never populates
`backgroundImageUrl`/`backgroundSource` for one (rendering is a 105-02 concern; this type only
shapes the data).

### src/types/slideGroup.ts

**`SlideGroup.sourceSignature`:** opaque signature of the source content this group was last
rebuilt against. Phase 30 deleted the confirm-gated reconciler that used to compare against it, but
Phase 38 (D1) gives it a new reader: `rebuildScriptureGroup` consults it as the ONE durable marker
distinguishing "this group was already materialized from the slot's CURRENT reading" (detached,
freely editable) from "not yet" (still slot-derived). Every other rebuild path still treats it as a
stored change-detector only, written for storage parity and not read back.

**`SourceRef` discriminated union:** the `copyright` member is a planner addition to research's
four-member shape: `assembleSlideshow` emits a copyright slide BEFORE and AFTER a song's lyric
sections, so a song group needs two entries that carry no `sectionId`. Encoding them as
`kind: 'copyright'` keeps song reconciliation's diff-by-`sectionId` from ever seeing a section-less
entry. The `video` member (D-17) is unlike every other member: it references no canonical record —
a dropped video has no document behind it, the storage URL itself IS the reference, carried on
`videoSrc` (same field name as `VideoSlide`'s own-source field); video is slide-only (D-18), so
there is nothing for this field to collide with. The `text` member is widened with optional
authored `title`/`body` (D-17 ripple) so a user-added blank slide (`＋ Add slide` on a
SONG/SCRIPTURE/IMPORTED group) has somewhere to store its own words. `scripture` (Phase 38, D1/D2)
is either of TWO shapes — a scripture group has exactly two states, never a mix: REFERENCE
(default, Phase 30's hard lock, unchanged) carries NO payload at all (R047) — content comes from
the owning SCRIPTURE slot's own reference fields, resolved live at render time; CONGREGATIONAL
(opt-in, D1) carries `speaker` — its PRESENCE is the discriminator — plus that section's own `text`
and, when the section has one, `verseRange`; this entry's words are the GROUP's, not the slot's
(D2), since converting to congregational deliberately detaches the group from slot-driven
re-derivation. Both `scriptureReadingId` and `innerSlideId` stay in the union as OPTIONAL legacy
fields — every entry written before Phase 38 stays readable (both fields are ignored on read).
Phase 42 (R079/R080): the `imported` member's `innerSlideId` carries EITHER a parsed
`deck.slides[i].id` OR the synthetic `rendered-page-N` identity `src/utils/importedRenderReconciler.ts`
mints for a ready-state rendered page. R108 (Phase 50, part 1 of 2): the `imported` member also
carries an optional `renderedPage` — the render-stable 1-based page this entry maps to, recorded at
add-time (`SlideGrid.vue::onImportConfirmed`) from the deck slide's own `sourcePage`. It supersedes
the interim positional resolver (`src/utils/importedRenderReconciler.ts`, commit ec217aa) that fails
whenever parsed-slide count != rendered-page count (a multi-image deck). `renderedPage` deliberately
does NOT participate in `derivedIdentityKey` — it is provenance, not identity.

### src/types/songLyrics.ts

**`LyricSection` (module overview):** a single section of song lyrics (e.g. Verse 1, Chorus). A
member of the canonical POOL (`SongLyrics.sections` / `ParsedCCLI.sections`) — each `id` appears at
most once across a document's pool. A section shown more than once in the slide order is a
REFERENCE to this same pooled entry, not a copy (D-02): edit its `lines` once and every occurrence
in `SongLyrics.performanceOrder` reflects the edit. See `src/utils/songSectionOrder.ts` for the pure
helpers that derive rows from and safely mutate the pool/order pair.

**`LyricSection.kind` (Phase 105, R302/R303/R304):** absent means `'lyric'` — every section
persisted before this phase, and every section minted by the normal `addSection` path, carries no
`kind` field at all (additive, no migration). `'blackout'` marks an inline black interlude slide
with no lyric text — minted only via `addSection(..., 'BLACKOUT')`
(`src/utils/songSectionOrder.ts`), always with empty `lines`. `buildSectionRows` excludes a blackout
section from per-kind position numbering (R304), and `slideshowAssembler.ts` resolves it to a
`BlackoutSlide` (`src/types/slide.ts`) instead of lyric content.

### src/views/ServiceEditorView.vue

**`deleteServiceConfirmBody` (D-15):** delete stays available at every status, but must not stay
un-warned. The reasoning that justifies NO friction on Reopen runs the opposite way here: reopening
is reversible, deleting is not. Delete is the only irreversible action in this view, and for a
service carrying export evidence it silently orphans a live Planning Center plan and destroys the
audit trail D-11 exists to preserve. Warning is the mitigation; locking is not — forcing a Reopen
just to delete adds friction with no safety gain and strands the "created by mistake" case behind
two extra steps. Uses the same `hasPcExportEvidence` computed as the reopen dialog; no new dialog,
no rules change (the rule's `allow delete` is deliberately unconditional).

**`handleNavigateToScriptureEditor`:** handles the "Set up congregational reading" request
(relabelled from "Edit scripture text" on 2026-08-05 — see `slideDisplay.ts`) relayed up through
SlidesTab's `navigate-to-scripture-editor` event (T-26-03-01: the index is validated against the
current plan item list and its kind before touching any state, so an unhonourable request — out of
range, or naming a non-scripture plan item — is a no-op). REVISED 34-07 (owner UAT F1): the relay is
REUSED, the handler body is REPLACED. R047 had deleted the panel this relay used to reveal, which is
why it degraded to a tab-switch-plus-scroll. The owner's finding restored a real destination: the
scripture slide's edit route now opens the congregational-reading editor as a modal over the Slides
tab where the request originated — dragging the user off to the Service Order tab to reach it was
the disorientation that made the feature read as absent.

**`isLocked` (R036/R037 lifecycle lock seams):** widened the retired `isExportedLocked`
(`=== 'exported'`) to `!== 'draft'`. `isExportedLocked` is DELETED as of 31-04: it fired only at
`exported` and never at `planned`, which is half of R036, and leaving a similarly-named computed
alongside this one invites a future edit to reach for the wrong one. The per-line migration off it
was a five-class job (31-UI-SPEC § gate migration) — a blind find-and-replace inverts three of the
classes.

**`slotsBySection` (D005/R007/R043/R044, R005/R006 live slideshow assembly):** `{ slot, index }`
pairs (index = the slot's ABSOLUTE position in `localService.slots`) grouped into
`SERVICE_SECTIONS`-ordered buckets plus a trailing `legacy`/ungrouped bucket, per `groupBySection`
(29-02). The ABSOLUTE index is what every existing per-slot handler in the template (onClearSong,
removeSlot, onSectionChange, aiDraftSongs, the scripture panel, slotLabel,
`data-testid="slot-{index}"`) already keys on — grouping for render never renumbers it to a
per-section ordinal.

**`canWriteSlideGroups` (R036):** whether this session may write slide-group documents at all. This
is NOT only a UI concern, and narrowing it is not optional. The `/slideGroups` Firestore rule
rejects every write whose parent service is not draft. `useSlideshowAssembly`'s materialization
watcher runs with `{ immediate: true }` — it writes on service LOAD, with no user action — as does
`rebuildOutcomes`. Leaving this as bare `isEditor` would therefore make every locked service throw
permission-denied the moment it opens, which is a worse failure than the one the lock fixes.
Suppressing the write is the right shape rather than carving an exception into the rule: the rules
layer cannot distinguish a load-time materialization from a user edit, so the exception would have
to be "allow any write", i.e. no lock. A service still loading has no status yet; `?? 'draft'`
matches the rule's own `resource.data.get('status','draft')` default so the two layers agree, and it
avoids wedging materialization behind a transient null.

**`buildActionBarItems` wiring (36-03, R068):** the page-header's per-tab action list, replacing the
four unconditional buttons that used to render regardless of `activeTab`. Threads the view's OWN
existing state into `buildActionBarItems` (36-02); `handlers` passes EXISTING functions by
reference, except `onPresent`, which contains no logic of its own — it only calls the exposed
`SlidesTab.onPresentClick()`, which still does the actual emitting. `@present="onPresent"` on the
`<SlidesTab>` element still receives that emit and still owns opening `PresentationViewer` at the
computed start index. Routing through the emit (not calling the view's own `onPresent` directly)
keeps the start-index computation in the one place that owns it.

**`handleAutosaveFailure` (BL-02):** a rejected autosave must leave the view USABLE, never stranded
at 'saving'. `useAutoSave`'s own catch is generic; this writes the definitive `useSaveStatus` entry
itself: `ServiceLockedError` can never succeed while locked, so revert to `originalService` and
report 'idle' (nothing to retry); anything else may land on retry, so the edit is KEPT and the entry
reports 'error'. `lifecycleError` (not the shared status bar) is the surface — 31-04's bar/banner
slots are gone/present at exactly the right statuses.

**`sectionSlideCount` (36-04, UI-SPEC §9):** per-band assembled-slide count for a section-band
header's "{n} slides" caption. Deliberately mirrors `SlidePlanRail.vue`'s own per-row derivation —
filtering `assembledSlideshow` by `AssembledSlide.slotIndex` — rather than reading
`group.slides.length` off a `SlideGroup` document, because an unmaterialized group reads zero
slides there while the grid (and this count) show the full fallback-path group. Takes the band's
own `entries` (the same `{ slot, index }[]` shape `slotSectionGroups` already produces) rather than
a bare `ServiceSection` key — same output as UI-SPEC §9's illustrative
`sectionSlideCount(group.key)`, without re-deriving the section-to-slots mapping
`slotSectionGroups` already computed. Builds one `Set` of the band's indices and filters once,
rather than calling `.filter` per entry.

**`slotToScriptureRef` (ME-02):** the canonical primitive, not a private four-field variant. This
used to require book + chapter + verseStart + verseEnd, while `scriptureRefFromSlot` — the rule
R047 derives the SLIDE from — requires only book + chapter. A whole-chapter reading ("Psalms 103")
or a single verse ("Romans 8:28", where `parseScriptureInput` leaves `verseEnd` null) therefore
projected a correct slide while this row handed `null` to `ScriptureInput`: the input rendered
empty, the read-only lines rendered "Scripture — Empty", and "Edit in scripture" scrolled to a
blank field.

**`onMarkAsPlanned`'s deleted `bumpScheduledSongsLastUsed` (R247, 84-01):** `lastUsedAt` for a
service's scheduled songs is now recomputed by `serviceStore.markAsPlanned` itself (lock-gated
`MAX(locked service date)`, see `src/utils/lastUsed.ts`), not by a view-level `serverTimestamp()`
stamp. A `bumpScheduledSongsLastUsed` helper used to run here immediately after the transition and
re-stamp every scheduled song with wall-clock `now()` — unconditionally clobbering the store's
correct recompute on every single "Mark as Planned" click, and silently reproducing the root-cause
bug 84-01 exists to fix (the service date was never being used). Deleted rather than delegated: the
store already owns this write, and a second write path racing/overwriting the first is exactly the
hazard, not a redundancy worth preserving. The follow-up recompute inside `onMarkAsPlanned` (after
`serviceStore.markAsPlanned` resolves) deliberately performs NO second write — a view-level re-stamp
would clobber the store's correct value with wall-clock time on every click.

**`onSave` (31-PATTERNS § 4a row 24, BL-02):** 31-04-SUMMARY recorded the decision to leave this
ungated because "the store guard already refuses it" — but this phase made that refusal a THROW, so
an ungated `onSave` is not a harmless no-op, it is a rejected promise. Refusing here, like every
other mutation entry point in this file, is what makes the rejection unreachable rather than merely
caught. `canEditService`, not `isLocked`: a viewer is refused by the same line. This cannot break
`onMarkAsPlanned`'s flush — that awaits `onSave()` while the service is still locally draft, before
`applyTransitionLocally`.

---

*Architecture analysis: 2026-07-16*
