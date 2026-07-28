# Architecture Research

**Domain:** Collaborative church worship service planning web app (Vue 3 + Firebase)
**Researched:** 2026-03-03
**Confidence:** MEDIUM-HIGH (core Vue 3 + Firestore patterns are HIGH; domain-specific Firestore schema is reasoned from first principles with MEDIUM confidence)

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                          Vue 3 SPA (Browser)                        │
├─────────────────────┬──────────────────┬───────────────────────────┤
│      Pages/Views    │    Components     │      Layouts              │
│  ServicesView       │  ServiceEditor    │  AppLayout                │
│  SongsView          │  SongCard         │  AuthLayout               │
│  TasksView          │  SuggestionPanel  │                           │
│  AuthView           │  ServicePrint     │                           │
├─────────────────────┴──────────────────┴───────────────────────────┤
│                      Pinia Stores (Global State)                    │
│  authStore  │  songsStore  │  servicesStore  │  tasksStore          │
├─────────────────────────────────────────────────────────────────────┤
│                   Composables (Business Logic Layer)                │
│  useAuth    │  useSongSuggestions  │  useCsvImport  │  usePrint    │
│  useSongs   │  useServiceOrder     │  useTeamFilter │              │
├─────────────────────────────────────────────────────────────────────┤
│                     Firebase SDK (Service Layer)                    │
│         Firestore          │         Auth                           │
│   onSnapshot, getDocs,     │   signInWithGoogle,                   │
│   setDoc, addDoc, batch    │   signInWithEmailAndPassword          │
└────────────────────────────┴───────────────────────────────────────┘
                              │
                 ┌────────────▼────────────┐
                 │      Firebase Cloud      │
                 │  Firestore  │  Auth      │
                 │  (NoSQL DB) │  (OAuth)   │
                 └─────────────────────────┘
```

### Component Responsibilities

| Component Layer | Responsibility | Communicates With |
|-----------------|----------------|-------------------|
| Pages/Views | Route-level containers, compose feature components | Pinia stores (read via storeToRefs), router |
| Feature Components | Encapsulate a UI slice (e.g. ServiceEditor) | Parent page props, emit events up, read stores |
| UI Components | Stateless display (SongCard, TaskRow, etc.) | Props in / events out only |
| Pinia Stores | Global reactive state + write actions to Firestore | Firebase SDK, other stores (no circular imports) |
| Composables | Reusable domain logic that is not global state | Pinia stores, Firebase SDK, browser APIs |
| Firebase SDK | Firestore queries, Auth state | Firebase Cloud (remote) |

---

## Recommended Project Structure

```
src/
├── main.ts                  # App bootstrap, Firebase init, Pinia, Router mount
├── firebase.ts              # Firebase app + Firestore + Auth exports (singleton)
│
├── router/
│   └── index.ts             # Vue Router routes with auth guards
│
├── stores/                  # Pinia stores — one per domain
│   ├── auth.store.ts        # Current user, sign in/out, role
│   ├── songs.store.ts       # Song stable list, CRUD, CSV import state
│   ├── services.store.ts    # Weekly service plans CRUD
│   └── tasks.store.ts       # Recurring task checklist state
│
├── composables/             # Reusable logic — no global state
│   ├── useSongSuggestions.ts  # Smart suggestion algorithm (category, usage history, team filter)
│   ├── useTeamFilter.ts       # Filter songs by active team configuration
│   ├── useServiceOrder.ts     # Service order slot management (1-2-2-3 / 1-2-3-3 progression)
│   ├── useCsvImport.ts        # PapaParse CSV → Song schema mapping + validation
│   ├── usePrint.ts            # Print / PDF generation for order of service
│   └── useShareLink.ts        # Generate shareable service plan links
│
├── features/                # Domain-aligned feature modules
│   ├── songs/
│   │   ├── SongsView.vue         # Song stable page
│   │   ├── SongEditModal.vue     # Add / edit song form
│   │   ├── SongCard.vue          # Single song display
│   │   ├── SongFilters.vue       # Category / team / tag filter UI
│   │   └── CsvImportWizard.vue   # Multi-step CSV import flow
│   │
│   ├── services/
│   │   ├── ServicesView.vue      # Week-by-week calendar overview
│   │   ├── ServiceEditor.vue     # Main service planning workspace
│   │   ├── ServiceSlot.vue       # Single slot in service order
│   │   ├── SuggestionPanel.vue   # Smart song suggestions sidebar
│   │   ├── ServicePrint.vue      # Print-optimized service order view
│   │   └── ShareModal.vue        # Share / export dialog
│   │
│   ├── tasks/
│   │   ├── TasksView.vue         # Task dashboard
│   │   ├── TaskGroup.vue         # Tasks grouped by category
│   │   └── TaskRow.vue           # Single task with checkbox + assignee
│   │
│   └── auth/
│       ├── LoginView.vue         # Google + email/password login
│       └── InviteAccept.vue      # Accept team invitation
│
├── layouts/
│   ├── AppLayout.vue         # Authenticated shell (nav, sidebar)
│   └── AuthLayout.vue        # Unauthenticated centered layout
│
└── shared/
    ├── components/           # Truly generic UI (Button, Modal, Badge, etc.)
    ├── types/                # TypeScript interfaces (Song, ServicePlan, Task, User)
    └── utils/                # Pure functions (date formatting, slug generation)
```

### Structure Rationale

- **features/:** Groups all files for a domain (view + components) together so you can find everything related to services without hunting across directories. Avoids the "component soup" of a flat `components/` directory.
- **stores/:** Kept flat at root (not inside features/) because stores are shared global state — songs store is read by the services feature for suggestions.
- **composables/:** Algorithm and logic extracted here keeps stores thin and testable. `useSongSuggestions` is pure enough to unit test without Firebase.
- **firebase.ts singleton:** Initialize Firebase once, export `db` and `auth`. Never initialize per-component.

---

## Firestore Data Model

### Collections Architecture

```
/organizations/{orgId}                   ← Root: one per church
  /songs/{songId}                        ← Song stable
  /services/{serviceId}                  ← Weekly service plans
    /slots/{slotId}                      ← (optional subcollection if slots get complex)
  /tasks/{taskId}                        ← Recurring task definitions
  /usageHistory/{weekId}                 ← Song usage per week (for suggestion engine)
  /members/{userId}                      ← Org membership + role

/users/{userId}                          ← Root: user profile + org references
```

### Document Schemas

**`/organizations/{orgId}`**
```typescript
{
  name: string               // "First Baptist Worship"
  createdAt: Timestamp
  teamConfigurations: {      // Embedded — small, rarely changes
    choir: boolean
    orchestra: boolean
  }
}
```

**`/organizations/{orgId}/songs/{songId}`**
```typescript
{
  title: string
  ccliNumber: string
  themes: string[]
  notes: string
  tags: string[]             // e.g. ["choir", "orchestra", "acoustic"]
  verticalCategory: 1 | 2 | 3   // Call to Worship | Intimate | Ascription
  arrangements: {            // Embedded array (max 5 per song per PC export)
    name: string
    bpm: number
    lengthSeconds: number
    keys: string[]
    notes: string
    tags: string[]           // e.g. ["orchestra", "choir"]
  }[]
  lastScheduledDate: Timestamp | null
  importedFrom: 'csv' | 'manual'
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**`/organizations/{orgId}/services/{serviceId}`**
```typescript
{
  serviceDate: Timestamp     // The Sunday date
  theme: string              // Optional planning note
  status: 'draft' | 'final' | 'complete'
  teamsActive: string[]      // ["choir", "orchestra"] — drives song filtering
  progression: '1-2-2-3' | '1-2-3-3'
  slots: {                   // Embedded array — always read together, max ~10 slots
    order: number
    type: 'song' | 'scripture' | 'prayer' | 'message' | 'sending_song'
    songId: string | null    // Reference to songs collection
    songTitle: string        // Denormalized — avoids join for print/display
    songArrangement: string  // Which arrangement to use
    songKey: string
    scriptureRef: string | null   // e.g. "Psalm 23:1-6"
    notes: string
  }[]
  createdBy: string          // userId
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**`/organizations/{orgId}/usageHistory/{weekId}`**
```typescript
// weekId = ISO week string, e.g. "2026-W10"
{
  weekStartDate: Timestamp
  serviceId: string          // Reference back to services collection
  songIds: string[]          // All songs used this week
}
```
Usage: query last 4-8 `usageHistory` docs ordered by weekStartDate desc. The suggestion engine cross-references this list to downrank recently-played songs.

**`/organizations/{orgId}/tasks/{taskId}`**
```typescript
{
  title: string
  category: 'administrative' | 'communication' | 'rehearsal' | 'technical' | 'physical' | 'service'
  recurrence: 'weekly' | 'monthly' | 'seasonal' | 'one-time'
  weekOffset: number         // Relative to service date (e.g. -12 = 12 days before)
  assigneeUserId: string | null
  assigneeName: string       // Denormalized for display
  notes: string
  completedWeeks: string[]   // ISO week strings where this task was checked off
}
```

**`/organizations/{orgId}/members/{userId}`**
```typescript
{
  userId: string
  displayName: string
  email: string
  role: 'admin' | 'planner' | 'viewer'
  joinedAt: Timestamp
}
```

**`/users/{userId}`**
```typescript
{
  displayName: string
  email: string
  photoURL: string
  orgIds: string[]           // List of orgs user belongs to
  lastActiveOrgId: string
  createdAt: Timestamp
}
```

### Why This Schema

| Decision | Rationale |
|----------|-----------|
| Embed slots inside service document | Slots are always read with the service, never queried independently. Embedding eliminates N+1 reads. Max ~10 slots stays well under 1MB document limit. |
| Embed arrangements inside song document | PC exports max 5 arrangements. Always read together. Embedding avoids subcollection overhead for tiny data. |
| Denormalize songTitle in service slots | Prevents fetching all songs just to render a service plan or print it. Title rarely changes after import. |
| usageHistory as separate root subcollection | Usage history grows unboundedly (1 doc/week). Keeping it separate lets the suggestion engine query just history docs without loading full service plans. |
| members subcollection (not array in org doc) | Member lists grow. Arrays in documents can't be queried efficiently. Subcollection supports security rules scoping per member. |
| orgId as root document (not user subcollection) | Orgs exist independently of any single user. Future multi-admin support works naturally. |

---

## Data Flow

### Service Planning Flow (Core Workflow)

```
User opens ServicesView
    ↓
servicesStore.fetchServices() → Firestore query /organizations/{orgId}/services
    ↓
User opens ServiceEditor for a week
    ↓
songsStore.songs (already loaded) + servicesStore.currentService
    ↓
useSongSuggestions(slot.verticalCategory, teamsActive, recentUsageHistory)
    ↓ computes ranked suggestions
SuggestionPanel displays ranked songs
    ↓
User selects song → ServiceEditor emits 'song-selected'
    ↓
servicesStore.updateSlot(serviceId, slotIndex, songData)
    ↓
Firestore setDoc (update service document)
    ↓
Real-time listener triggers → servicesStore.currentService updates → UI reflects change
```

### Song Suggestion Algorithm Flow

```
Input:
  - slot.verticalCategory (1 | 2 | 3)
  - teamsActive (string[])
  - recentWeeks (usageHistory docs, last 8 weeks)

Algorithm:
  1. Filter songsStore.songs by verticalCategory === slot.verticalCategory
  2. Filter by arrangement tags matching all teamsActive
  3. Score each song:
     - Base score: 100
     - Used last 2 weeks: -80 (strong downrank)
     - Used weeks 3-8: -20 (mild downrank)
     - Never used: +10 (slight boost)
  4. Sort by score desc, shuffle ties
  5. Return top 10

Output: ranked song list displayed in SuggestionPanel
```

### CSV Import Flow

```
User selects CSV file
    ↓
useCsvImport.parseFile(file) → PapaParse → raw rows[]
    ↓
mapColumns(rows) → Song[] (validate required fields, coerce types)
    ↓
CsvImportWizard shows preview (user can fix category mappings)
    ↓
User confirms → songsStore.importSongs(mappedSongs)
    ↓
Firestore batch write (max 500/batch — split if needed)
    ↓
songsStore.songs reactive ref updates → SongsView re-renders
```

### Auth + Organization Init Flow

```
App starts → authStore.init()
    ↓
Firebase onAuthStateChanged listener
    ↓
  [No user] → router.push('/login')
  [User found] → load /users/{uid}
    ↓
    Check orgIds → load /organizations/{orgId}/members/{uid}
    ↓
    Set authStore.currentOrg, authStore.role
    ↓
    Unblock router → navigate to intended route
```

### State Management

```
Pinia Stores
    ↓ (reactive refs)
Pages/Views ←→ Actions → Firebase SDK → Firestore
    ↓ (storeToRefs)              ↓
Feature Components         onSnapshot triggers
    ↓ (props)                    ↓
UI Components          Store state auto-updates
                              ↓
                       Components re-render
```

---

## Architectural Patterns

### Pattern 1: Thin Stores, Fat Composables

**What:** Pinia stores handle Firestore CRUD and hold reactive state. Business logic (suggestion algorithm, CSV parsing, print formatting) lives in composables — not stores.

**When to use:** When logic is complex enough to test independently, or reused across multiple views.

**Trade-offs:** Slightly more files, but stores stay readable. Logic is unit-testable without Firebase mocking.

**Example:**
```typescript
// stores/services.store.ts — thin, focused on data
export const useServicesStore = defineStore('services', () => {
  const services = ref<ServicePlan[]>([])
  const currentService = ref<ServicePlan | null>(null)

  async function updateSlot(serviceId: string, slotIndex: number, data: Partial<ServiceSlot>) {
    const ref = doc(db, 'organizations', orgId, 'services', serviceId)
    await updateDoc(ref, { [`slots.${slotIndex}`]: data })
  }

  return { services, currentService, updateSlot }
})

// composables/useSongSuggestions.ts — business logic extracted
export function useSongSuggestions(
  category: Ref<VerticalCategory>,
  teamsActive: Ref<string[]>,
  recentHistory: Ref<UsageHistory[]>
) {
  return computed(() => {
    const songs = useSongsStore().songs
    return rankSongs(songs, category.value, teamsActive.value, recentHistory.value)
  })
}
```

### Pattern 2: Firestore onSnapshot in Stores (not VueFire composables in stores)

**What:** Use Firebase SDK's `onSnapshot` directly in Pinia store `init` actions. Store the unsubscribe function and call it on auth sign-out.

**When to use:** Always for the core collections (songs, services). VueFire `useCollection` in Pinia stores has known issues with reactivity and requires injectable context constraints.

**Trade-offs:** A small amount of boilerplate vs. VueFire's magic. Boilerplate is worth it for reliability and explicit control.

**Example:**
```typescript
// stores/songs.store.ts
export const useSongsStore = defineStore('songs', () => {
  const songs = ref<Song[]>([])
  let unsubscribe: (() => void) | null = null

  function startListening(orgId: string) {
    const q = collection(db, 'organizations', orgId, 'songs')
    unsubscribe = onSnapshot(q, (snapshot) => {
      songs.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Song))
    })
  }

  function stopListening() {
    unsubscribe?.()
    unsubscribe = null
  }

  return { songs, startListening, stopListening }
})
```

### Pattern 3: Org-Scoped Security Rules

**What:** All data lives under `/organizations/{orgId}`. Security rules check that the requesting user's UID exists in `/organizations/{orgId}/members/{uid}`.

**When to use:** Always — enforced at Firestore level, not just UI.

**Trade-offs:** Every read requires a get() call on the member doc in rules. For a 2-3 planner team this is negligible.

**Example:**
```javascript
// firestore.rules
function isMember(orgId) {
  return exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
}

function isAdmin(orgId) {
  return get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid))
    .data.role == 'admin';
}

match /organizations/{orgId}/songs/{songId} {
  allow read: if isMember(orgId);
  allow write: if isMember(orgId);  // All planners can edit songs
}

match /organizations/{orgId}/services/{serviceId} {
  allow read: if isMember(orgId);
  allow write: if isMember(orgId);
}

match /organizations/{orgId}/members/{memberId} {
  allow read: if isMember(orgId);
  allow write: if isAdmin(orgId);  // Only admins manage membership
}
```

### Pattern 4: Denormalize for Print/Export

**What:** Store `songTitle` and `scriptureRef` directly in service slots alongside the `songId` reference. Do not perform joins at print time.

**When to use:** Whenever data must render without secondary Firestore reads — print views, share links, exports.

**Trade-offs:** Title stored in two places. If song is renamed, service slots won't auto-update. For a worship app this is acceptable — song titles are stable, and historical plans should reflect what was planned.

---

## Anti-Patterns

### Anti-Pattern 1: Lazy Song Loading Per-Slot

**What people do:** Fetch song details inside ServiceEditor as each slot renders — one Firestore read per slot.

**Why it's wrong:** Creates 5-10 parallel Firestore reads per page load. On mobile church Wi-Fi this causes jitter and slot-by-slot rendering.

**Do this instead:** Load the entire song stable once at app init via `songsStore.startListening()`. Songs are cached in Pinia; slots just reference song IDs. Total songs typically 50-200, well within Firestore limits.

### Anti-Pattern 2: Storing Task Completion as a Separate Collection

**What people do:** Create a `taskCompletions` collection with one document per completion event (taskId + week + userId).

**Why it's wrong:** Creates unbounded collection growth and requires complex queries to check if a task is done for a given week.

**Do this instead:** Store `completedWeeks: string[]` directly on the task document. For a small team doing 52 weeks/year, this array stays tiny. Query is just `task.completedWeeks.includes(currentWeek)`.

### Anti-Pattern 3: Vue Router Guards That Block Before Auth Resolves

**What people do:** Put auth checks in `beforeEach` that synchronously check `authStore.user`, which is null at app startup before Firebase resolves.

**Why it's wrong:** Causes flash-to-login or incorrect redirects on first load.

**Do this instead:** Implement an `authReady` promise in the auth store that resolves after `onAuthStateChanged` fires once. Router guard awaits `authReady` before checking user state.

```typescript
// stores/auth.store.ts
const authReady = new Promise<void>(resolve => {
  const unsub = onAuthStateChanged(auth, (user) => {
    currentUser.value = user
    resolve()
    unsub()
  })
})

// router/index.ts
router.beforeEach(async (to) => {
  await authStore.authReady
  if (to.meta.requiresAuth && !authStore.currentUser) {
    return '/login'
  }
})
```

### Anti-Pattern 4: Subcollection for Service Slots

**What people do:** Store each slot as a document in `/services/{serviceId}/slots/{slotId}`.

**Why it's wrong:** Requires 5-10 additional Firestore reads per service, or a collectionGroup query. Slots are never queried independently of the service.

**Do this instead:** Embed slots as an array in the service document. 10 slots of ~300 bytes each = ~3KB per service, far under the 1MB document limit.

### Anti-Pattern 5: No Org Scoping (Single Global Collection)

**What people do:** Put songs in `/songs/{songId}` globally, using a `churchId` field for filtering.

**Why it's wrong:** Firestore security rules must allow anyone to read the collection, then filter by field. This leaks other churches' song data to any authenticated user.

**Do this instead:** Use `/organizations/{orgId}/songs/` with security rules scoped to org membership. Proper isolation from day one.

---

## Build Order (Dependencies)

The component dependency graph determines safe build order:

```
Phase 1: Foundation (no dependencies)
  firebase.ts (singleton)
  authStore + LoginView + router guards
  AppLayout + AuthLayout
  shared/types (Song, ServicePlan, Task, User interfaces)

Phase 2: Song Stable (depends on Phase 1)
  songsStore (Firestore listener)
  SongsView + SongCard + SongEditModal
  useCsvImport + CsvImportWizard

Phase 3: Service Planning (depends on Phase 2 — needs songs loaded)
  servicesStore
  useServiceOrder (slot management)
  ServicesView (week overview)
  ServiceEditor (main workspace)

Phase 4: Smart Suggestions (depends on Phase 3)
  usageHistory writes (on service finalize)
  useSongSuggestions algorithm
  SuggestionPanel

Phase 5: Team Configuration (depends on Phase 2 + 3)
  useTeamFilter composable
  Team configuration UI on ServiceEditor
  Filter wired into useSongSuggestions

Phase 6: Collaboration (depends on Phase 1)
  members subcollection CRUD
  Invite flow + InviteAccept
  Role-based UI guards (admin-only actions)

Phase 7: Output (depends on Phase 3)
  usePrint + ServicePrint view
  useShareLink + ShareModal
  Export to Planning Center format
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Firebase Auth | Firebase SDK `onAuthStateChanged`, `signInWithPopup` | Initialize once in `authStore.init()` |
| Firestore | Firebase SDK `onSnapshot`, `setDoc`, `addDoc`, `batch` | Never raw in components — always via stores |
| Planning Center | CSV export only — no API | User exports CSV from PC, imports into app |
| Browser Print | `window.print()` + CSS print media queries | `ServicePrint.vue` is print-only view |
| Share Links | URL query params or short hash encoding service plan ID | Firebase Dynamic Links or just deep URL to service |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Page → Store | `storeToRefs()` for reactive read, store actions for write | Never mutate store state directly in pages |
| Store → Firestore | Firebase SDK only, never VueFire in stores | Avoids injectable context issues |
| Components → Composables | Direct import, called in `<script setup>` | Composables own their own reactive state |
| ServiceEditor → SuggestionPanel | Props (slot context), emit (song-selected) | Panel is a pure UI component |
| Songs → Services | songsStore read in ServiceEditor and useSongSuggestions | One-directional: song stable feeds service planning |

---

## Scaling Considerations

This app targets 2-3 planners at one church. The architecture is intentionally simple. Scale considerations are documented as guardrails, not immediate concerns.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 planners (current target) | Single org, real-time listeners on all collections are fine. No pagination needed. |
| 10-100 planners (unlikely for v1) | Add query pagination to ServicesView (load by quarter). Consider caching song suggestions client-side. |
| Multi-church SaaS (future possibility) | Architecture already supports it — orgId scoping is in place. Add org switcher to AppLayout. |

**First bottleneck:** Firestore read costs if suggestion engine makes repeated reads for usage history. Prevention: load all 8 weeks of usage history once per session, cache in Pinia.

**Second bottleneck:** Large song stable (200+ songs) in single real-time listener. Not a concern until 500+ songs. If it becomes one, add query filtering by category.

---

## Sources

- [VueFire Realtime Data Guide](https://vuefire.vuejs.org/guide/realtime-data.html) — composable patterns, Pinia caveats (MEDIUM confidence)
- [Firebase Firestore — Secure data access for users and groups](https://firebase.google.com/docs/firestore/solutions/role-based-access) — RBAC pattern (HIGH confidence)
- [Firebase Firestore — Choose a data structure](https://firebase.google.com/docs/firestore/manage-data/structure-data) — subcollection vs embedded tradeoffs (HIGH confidence)
- [Pinia Introduction](https://pinia.vuejs.org/introduction.html) — one store per domain pattern (HIGH confidence)
- [VueFire + Pinia known issues](https://github.com/vuejs/vuefire/discussions/1453) — why to use onSnapshot directly in stores (MEDIUM confidence)
- [Vue 3 feature-based folder structure](https://vueschool.io/articles/vuejs-tutorials/how-to-structure-a-large-scale-vue-js-application/) — feature module organization (MEDIUM confidence)
- [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices) — document size, write limits (HIGH confidence)
- [vue-papa-parse](https://www.npmjs.com/package/vue-papa-parse) — CSV import with PapaParse in Vue 3 (MEDIUM confidence)

---

*Architecture research for: WorshipPlanner (Vue 3 + Firebase church worship service planning app)*
*Researched: 2026-03-03*
