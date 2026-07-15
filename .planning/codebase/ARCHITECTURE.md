# Architecture

**Analysis Date:** 2026-07-15

## System Overview

Worship Planner is a web application for planning church worship services and managing volunteer schedules. It integrates with Planning Center for importing songs and volunteers, uses Claude AI for schedule suggestions, and manages quarterly volunteer rotations.

```text
┌─────────────────────────────────────────────────────────────┐
│                      View Layer                              │
│  LoginView, DashboardView, SongsView, RosterView,           │
│  QuarterView, ServicesView, ServiceEditorView, etc.         │
│  `src/views/`                                               │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Component Layer (UI Components)                 │
│  AppShell, AppSidebar, Modal dialogs, Tables, Forms         │
│  `src/components/`                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│         State Management Layer (Pinia Stores)               │
│  auth, songs, services, quarters, roster                    │
│  `src/stores/` — Real-time Firestore subscriptions          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│           Business Logic / Utilities Layer                   │
│  scheduler, planningCenterApi, songSearch, etc.             │
│  `src/utils/` — Pure functions, no side effects             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Backend Integration Layer                       │
│  Firebase Auth, Firestore, Cloud Functions Proxy            │
│  Planning Center, Claude API, ESV Bible API                 │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Views | Page containers; orchestrate stores & components | `src/views/*.vue` |
| Pinia Stores | State management; real-time Firestore sync | `src/stores/*.ts` |
| Components | Reusable UI elements (modals, tables, forms) | `src/components/*.vue` |
| Composables | Reusable logic (unsaved guard, hooks) | `src/composables/*.ts` |
| Utilities | Pure business logic (scheduling, imports, search) | `src/utils/*.ts` |
| Router | Page routing & auth guards | `src/router/index.ts` |
| Firebase | Auth & Firestore client initialization | `src/firebase/index.ts` |
| Cloud Functions | Secure API proxy for external services | `functions/src/index.ts` |

## Pattern Overview

**Overall:** Vue 3 + Pinia + Firebase SPA with real-time Firestore synchronization

**Key Characteristics:**
- **Reactive state:** Pinia stores maintain real-time Firestore collections via `onSnapshot` listeners
- **Pure utilities:** Business logic (scheduling, search, validation) isolated as pure functions in `src/utils/`
- **Component composition:** Modular components + layout shells (AppShell, AppSidebar)
- **Secure API proxy:** Cloud Function routes external API calls, injects server-held secrets (Claude, ESV keys)
- **Route-based auth:** Vue Router guards enforce authentication and role-based access (editor vs. viewer)

## Layers

**View Layer:**
- Purpose: Page containers that render a specific feature (songs, schedule, services, roster, etc.)
- Location: `src/views/`
- Contains: Vue SFC files, each one a top-level page
- Depends on: Pinia stores, Router, components, utilities
- Used by: Router (dynamic import in route config)
- Examples:
  - `QuarterView.vue` - Quarterly volunteer schedule editor (includes QuarterGrid component)
  - `ServiceEditorView.vue` - Service/plan editor (103 KB — largest view; complex form state)
  - `RosterView.vue` - Volunteer roster management
  - `SongsView.vue` - Song library search & management

**Component Layer:**
- Purpose: Reusable UI elements (modals, tables, forms, cards, sidebars)
- Location: `src/components/`
- Contains: Vue SFC files with limited scope (typically render/event emit only)
- Depends on: Pinia stores (for data), utilities (rarely; mostly for type definitions)
- Used by: Views and other components
- Examples:
  - Modal dialogs: `PcImportModal.vue`, `CsvImportModal.vue`, `RosterImportModal.vue`, `NewServiceDialog.vue`
  - Tables/grids: `QuarterGrid.vue`, `SongTable.vue`, `RotationTable.vue`, `AvailabilityRosterTable.vue`
  - Forms/inputs: `ScriptureInput.vue`, `SongFilters.vue`, `AvailabilityDrawer.vue`
  - Layout: `AppShell.vue`, `AppSidebar.vue`

**State Management Layer (Pinia Stores):**
- Purpose: Centralized, reactive state synchronized with Firestore in real-time
- Location: `src/stores/`
- Contains: 5 stores managing different data domains
  - `auth.ts` - User authentication, organization, role, Planning Center credentials
  - `songs.ts` - Song catalog with filtering (VW type, key, tags)
  - `services.ts` - Service/worship plan documents
  - `quarters.ts` - Quarterly volunteer schedules; calls `proposeQuarterSchedule` to generate
  - `roster.ts` - People, roles, and per-person volunteer metadata
- Pattern: Each store uses `onSnapshot(collection(...), (snap) => { state.value = snap.docs.map(...) })`
- Firestore structure: `/organizations/{orgId}/songs`, `/organizations/{orgId}/services`, etc.

**Business Logic / Utilities Layer:**
- Purpose: Pure, deterministic functions for domain logic
- Location: `src/utils/`
- Contains:
  - `scheduler.ts` - Deterministic fair-share quarterly volunteer scheduling (with blackout, pairing, frequency constraints)
  - `planningCenterApi.ts` - Planning Center API client (fetch service types, templates, songs, people)
  - `pcSongImport.ts` - Logic to merge Planning Center songs into local catalog
  - `songSearch.ts` - Text search over songs by title, themes, tags
  - `csvImport.ts` - Parse CSV and map to song/person/roster updates
  - `esvApi.ts` - ESV Bible API client for scripture lookups
  - `claudeApi.ts` - Claude AI integration for schedule suggestions
  - `scripture.ts` - Scripture reference parsing & formatting
  - `quarterDates.ts` - Generate Sundays, apply date additions/removals
- Key property: No framework imports, no Firestore writes, fully testable

**API Integration Layer:**
- Firebase Auth (`src/firebase/index.ts`) - Client initialization; connects to emulator in dev
- Firebase Firestore - Real-time document listeners in stores
- Cloud Functions proxy (`functions/src/index.ts`) - Secure gateway:
  - Proxies `/api/anthropic/` → Anthropic API (injects `CLAUDE_API_KEY`)
  - Proxies `/api/esv/` → ESV Bible API (injects `ESV_API_KEY`)
  - Proxies `/api/planningcenter/` → Planning Center API (no injection; uses client-provided Basic Auth)
  - Verifies Firebase ID token for secret-bearing routes before allowing access

## Data Flow

### Primary Request Path (User Action → Firestore Update)

1. User clicks button or submits form in a View (`src/views/*.vue`)
2. View calls a Pinia store action (e.g., `await serviceStore.updateService(id, data)`)
3. Store action calls Firestore SDK (`updateDoc`, `addDoc`, `setDoc`, etc.)
4. Firestore updates document; `onSnapshot` listener in the same store fires
5. Store state updates reactively; all components reading that state re-render

**Example:** Adding a new service
- User opens `ServicesView.vue` (displays list of services via `serviceStore.services`)
- User clicks "+ New Service" → `NewServiceDialog.vue` renders
- User submits form → `serviceStore.createService({ name, date, teams })` called
- Store calls `addDoc(collection(db, 'organizations', orgId, 'services'), serviceData)`
- Firestore fires `onSnapshot` listener; store updates `services.value`
- `ServicesView` re-renders with new service

### Quarterly Schedule Generation (Complex Flow)

1. User opens `QuarterView.vue`; selects a quarter from dropdown
2. User clicks "Generate Schedule" button
3. View calls `quarterStore.generateProposal(quarterId)`
4. Store retrieves data from Firestore and calls pure `proposeQuarterSchedule` utility
5. Utility returns `{ calendar, servedCounts, unfilled, pairingConflicts }`
6. Store writes calendar back to Firestore
7. `onSnapshot` listener fires; UI updates with new assignments
8. View renders `QuarterGrid.vue` component showing assignments

**State Management:**
- Quarterly calendar state persists in Firestore (`Quarter.calendar` document field)
- Per-person quarter-scoped data (blackouts, pairings, role frequency) in `Quarter.personQuarterData`
- Ephemeral in-memory state (`lastRegenerate`) highlights changed dates after regeneration

### External API Integration (Secure Proxy Flow)

**Planning Center Song Import:**
1. User clicks "Import from Planning Center" in `SongsView.vue` → `PcImportModal.vue` opens
2. Modal fetches service types: `GET /api/planningcenter/v2/service_types` (via `planningCenterApi.ts`)
3. Vite dev proxy or Cloud Function proxy forwards request to Planning Center
4. Response returned; user selects service type & plan template
5. Modal calls `proposeNewSongsFromTemplate(pcSongList, ...)` utility
6. Utility returns new song objects (merged with existing catalog)
7. Modal calls `songStore.upsertSongs(newSongs)` to write Firestore

**Claude AI Suggestions:**
1. User fills service plan in `ServiceEditorView.vue` → clicks "Suggest Arrangements"
2. View calls `suggestSongArrangements(serviceSummary)` utility → builds prompt
3. Utility calls `/api/anthropic/v1/messages` with POST body
4. Cloud Function verifies Firebase ID token in `x-app-auth` header
5. Cloud Function injects `CLAUDE_API_KEY` into request headers
6. Request forwarded to `https://api.anthropic.com`; response returned
7. Utility parses Claude's response; View renders suggestions

## Key Abstractions

**VW (Vertical Worship) Model:**
- Purpose: Represents the worship progression structure (Call to Worship → Intimate → Ascription)
- Examples: Types defined in `src/types/song.ts` (VWType = 1 | 2 | 3); service templates structure slots by progression
- Pattern: Songs carry `vwTypes: VWType[]`; services have slots requiring specific types

**Slot System:**
- Purpose: Flexible service structure (songs, scripture, prayers, messages, hymns)
- Examples: `ServiceSlot` discriminated union: `SongSlot | ScriptureSlot | NonAssignableSlot | HymnSlot` in `src/types/service.ts`
- Pattern: Service has `.slots: ServiceSlot[]` (position-ordered); slots filled in editor

**Quarterly Scheduler:**
- Purpose: Fair-share volunteer assignment with constraints
- Examples: `proposeQuarterSchedule(people, serviceDates, resolveRolesForDate, personQuarterData)`
- Pattern: Pure function; returns `{ calendar, unfilled, pairingConflicts }` deterministically

**Tag & Theme System:**
- Purpose: Flexible song categorization (themes from Planning Center, user-defined tags)
- Examples: Song has `.themes` (built-in categories) and `.tags` (user tags); Songs table filterable by both
- Pattern: `tagFilterInclude` / `tagFilterExclude` in song store; OR-combines include, exclude always wins

## Entry Points

**Web Application:**
- Location: `src/main.ts`
- Triggers: Browser loads HTML bundle
- Responsibilities:
  1. Import global CSS (`src/assets/main.css`)
  2. Create Vue app instance
  3. Install Pinia store plugin
  4. Install Vue Router
  5. Mount to `#app` in DOM

**Router Navigation:**
- Location: `src/router/index.ts`
- Triggers: User navigates to a route or page loads
- Responsibilities:
  1. `beforeEach` guard checks `meta.requiresAuth` → verifies Firebase user
  2. `beforeEach` guard checks `meta.requiresEditor` → verifies `authStore.isEditor` role
  3. Redirects to `/login` if not authenticated; redirects to `/services` (viewer home) if not editor

**Auth Initialization:**
- Location: `useAuthStore()` in `src/stores/auth.ts`
- Triggers: First component mount using auth store
- Responsibilities:
  1. Sets up `onAuthStateChanged(auth, (user) => { authStore.user = user; authStore.isReady = true })`
  2. Fetches organization document from Firestore (user's org membership)
  3. Sets `authStore.isReady = true` after user & org loaded → `App.vue` stops showing loading spinner

## Architectural Constraints

- **Threading:** Single-threaded event loop (browser + Node.js). Firebase SDK handles network I/O non-blocking.
- **Global state:** Firestore auth object (`src/firebase/auth`) and DB connection (`src/firebase/db`) are module-level singletons. Firestore listeners are stored on each store as `unsubscribeFn` to manage subscription lifecycle.
- **Circular imports:** None detected. Import hierarchy is clean: views → stores/components → utils → types.
- **Real-time consistency:** Firestore listeners (`onSnapshot`) are the single source of truth. No optimistic updates; all state mutations flow through Firestore.
- **Offline mode:** Not implemented. App assumes internet connectivity; Firestore writes fail silently if offline.
- **Secrets handling:** API keys (Claude, ESV) never shipped to browser. Injected server-side by Cloud Function proxy (verified Firebase auth token required for secret-bearing routes).

## Anti-Patterns

### Stale Filter State After Feature Toggle

**What happens:** User disables "VW Mode" in settings; song list still has VW-type filter selected, silently filtering list
**Why it's wrong:** User sees empty list; doesn't understand why songs disappeared
**Do this instead:** In `src/stores/songs.ts`, filter computation explicitly gates filters on `authStore.vwModeEnabled`:
```typescript
const matchesVwType =
  !authStore.vwModeEnabled ||  // If VW mode off, skip this filter entirely
  filterVwType.value === null ||
  (filterVwType.value === 'uncategorized' ? ...)
```
(Already implemented correctly in the codebase — see `src/stores/songs.ts` line 62-67.)

### Client-Side API Key Exposure

**What happens:** Hardcoding API keys in component props or config files
**Why it's wrong:** Keys leak in browser network tab, git history, etc. — security incident
**Do this instead:** Use Cloud Function proxy (`functions/src/index.ts`). Client sends `x-app-auth` (Firebase ID token); proxy verifies it, injects secret server-side, forwards to upstream API.
(Already implemented correctly.)

### Synchronous Blocking on Async Firestore Calls

**What happens:** Waiting for Firestore to finish via `await` in tight loops during large imports
**Why it's wrong:** Blocks UI; poor UX for batch operations (1000+ song imports)
**Do this instead:** Use `writeBatch()` for groups of <500 writes; show progress spinner; chunk large imports across multiple batches.
(Already implemented in `src/utils/pcSongImport.ts` — uses batch writes.)

## Error Handling

**Strategy:** Try/catch at API boundary (fetch calls); graceful degradation downstream

**Patterns:**
- API client functions (e.g., `planningCenterApi.fetchServiceTypes`) throw on HTTP error; caller decides whether to bubble or show toast
- Firestore listener errors logged to console but don't crash app (Firestore auto-reconnects)
- Vue Router auth guards catch promise rejection from `getCurrentUser()` and redirect to login
- Form submission: catch + show user-facing error toast (e.g., "Invalid Planning Center credentials")

## Cross-Cutting Concerns

**Logging:** `console.error()` for errors; no centralized logging system (could add Sentry/Firebase Analytics in future)

**Validation:**
- UI validation: Reactive form state + computed flags (e.g., `isDirty` in `useUnsavedGuard`)
- API validation: Firestore security rules enforce document structure; client assumes success
- Business logic validation: `isGroupCompatible()`, `evaluateGroupCombo()` check volunteer constraints before assignment

**Authentication:**
- Firebase Auth (Google OAuth, email/password)
- Organization membership verified by checking Firestore org document
- Role (editor vs. viewer) fetched from org document; cached in `authStore.userRole`
- Router guards enforce `meta.requiresAuth` and `meta.requiresEditor`

---

*Architecture analysis: 2026-07-15*
