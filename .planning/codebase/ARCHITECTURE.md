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

---

*Architecture analysis: 2026-07-16*
