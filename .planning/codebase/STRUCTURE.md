# Codebase Structure

**Analysis Date:** 2026-07-16

## Directory Layout

```
worshipplanner-6e2629ea/
├── src/                           # Vue 3 SPA source code
│   ├── main.ts                    # Entry point: create app, register Pinia, mount router
│   ├── App.vue                    # Root component: auth guard, loading state, router outlet
│   ├── assets/                    # Static assets (CSS, images)
│   │   └── main.css               # Tailwind CSS imports
│   ├── components/                # Reusable UI components
│   │   ├── __tests__/             # Component unit tests
│   │   ├── AppShell.vue           # Layout wrapper (header, sidebar, main content)
│   │   ├── AppSidebar.vue         # Navigation sidebar
│   │   ├── ServiceCard.vue        # Service preview card
│   │   ├── SongTable.vue          # Sortable songs library table
│   │   ├── SongSlideOver.vue      # Drawer for editing song details
│   │   ├── SongSlotPicker.vue     # Modal to assign songs to service slots
│   │   ├── ArrangementAccordion.vue # Collapsible song arrangements list
│   │   ├── QuarterGrid.vue        # Quarterly schedule grid view
│   │   ├── RosterImportModal.vue  # CSV import for volunteers
│   │   ├── PcImportModal.vue      # Planning Center import dialog
│   │   ├── AvailabilityDrawer.vue # Volunteer availability editor
│   │   ├── AvailabilityRosterTable.vue # Volunteer × service matrix
│   │   ├── RolesConfigPanel.vue   # Team role configuration
│   │   ├── CsvImportModal.vue     # Generic CSV import handler
│   │   ├── ScriptureInput.vue     # Bible verse reference editor
│   │   ├── ScriptureRotationTable.vue # Scripture reading scheduler
│   │   ├── RotationTable.vue      # Volunteer role rotation view
│   │   ├── TagFilterChecklist.vue # Song tag filter UI
│   │   ├── SongFilters.vue        # Song search/filter header
│   │   ├── GettingStarted.vue     # Onboarding checklist
│   │   ├── NewServiceDialog.vue   # Create service dialog
│   │   └── BatchQuickAssign.vue   # Bulk song assignment
│   ├── views/                     # Route-mapped page components
│   │   ├── __tests__/             # View integration tests
│   │   ├── LoginView.vue          # Sign in / sign up page
│   │   ├── DashboardView.vue      # Home page: next service, volunteer coverage
│   │   ├── ServiceEditorView.vue  # Service detail editor (103KB — largest view)
│   │   ├── ServicesView.vue       # List of all services
│   │   ├── SongsView.vue          # Song library management
│   │   ├── RosterView.vue         # Volunteer roster
│   │   ├── QuarterView.vue        # Quarterly planning grid
│   │   ├── SettingsView.vue       # Church settings, imports, integrations
│   │   ├── TeamView.vue           # Team member / admin management
│   │   ├── ShareView.vue          # Public read-only service share (via token)
│   │   └── QuarterShareView.vue   # Public read-only quarterly share
│   ├── stores/                    # Pinia state management
│   │   ├── __tests__/             # Store unit tests
│   │   ├── auth.ts                # Auth state, org context, role, PC credentials
│   │   ├── songs.ts               # Songs library, filtering, search
│   │   ├── services.ts            # Services collection, CRUD, slot assignment
│   │   ├── quarters.ts            # Quarterly schedule state
│   │   └── roster.ts              # Volunteer roster, availability, roles
│   ├── router/                    # Vue Router configuration
│   │   ├── __tests__/             # Router guard tests
│   │   └── index.ts               # Route definitions, auth guards, role checks
│   ├── firebase/                  # Firebase configuration
│   │   └── index.ts               # Initialize Firebase app, auth, Firestore
│   ├── types/                     # Shared TypeScript interfaces
│   │   ├── service.ts             # Service, ServiceSlot, Progression, SlotKind types
│   │   ├── song.ts                # Song, Arrangement, VWType, UpsertSongInput
│   │   └── roster.ts              # Person, Team, Availability, Role types
│   ├── utils/                     # Business logic, API clients, helpers
│   │   ├── __tests__/             # Utility function tests
│   │   ├── appAuth.ts             # Firebase Auth helper (signOut, getCurrentUser)
│   │   ├── planningCenterApi.ts   # PC API wrapper: songs, plans, services
│   │   ├── pcSongImport.ts        # Transform PC songs → app Song model
│   │   ├── claudeApi.ts           # Claude API client for AI song suggestions
│   │   ├── esvApi.ts              # ESV Bible API client for scripture lookups
│   │   ├── csvImport.ts           # Generic CSV parser utilities
│   │   ├── volunteerCsv.ts        # CSV ↔ roster transformation
│   │   ├── planningCenterExport.ts # Format service for PC export
│   │   ├── slotTypes.ts           # buildSlots, createSlot, reindexSlots, PROGRESSION_SLOT_TYPES
│   │   ├── songSearch.ts          # songMatchesQuery filtering logic
│   │   ├── scheduler.ts           # Schedule assignment algorithms
│   │   ├── scripture.ts           # Parse / format bible references
│   │   ├── quarterDates.ts        # Quarter boundary calculations
│   │   ├── slug.ts                # Generate memorable URL slugs
│   │   ├── suggestions.ts         # AI-powered suggestions helpers
│   │   └── rotationTable.ts       # Rotation table helpers
│   ├── composables/               # Reusable Vue 3 Composition Functions
│   │   └── useUnsavedGuard.ts     # Dirty-check & confirm-discard for forms
│   ├── rules.test.ts              # Firestore security rules unit tests
│   └── env.d.ts                   # TypeScript env type declarations
├── functions/                     # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts               # API reverse proxy (Anthropic, ESV, Planning Center)
│   ├── package.json               # Cloud Functions dependencies
│   ├── tsconfig.json              # Cloud Functions TypeScript config
│   └── package-lock.json
├── public/                        # Static assets served as-is
│   └── favicon.ico
├── vite.config.ts                 # Vite build config: Vue plugin, Tailwind, alias, dev proxy
├── vitest.rules.config.ts         # Vitest config for firestore.rules tests
├── tsconfig.json                  # Root TypeScript config
├── tsconfig.app.json              # App-specific TypeScript config
├── tsconfig.node.json             # Node tools TypeScript config
├── tsconfig.vitest.json           # Test TypeScript config
├── eslint.config.ts               # ESLint config (oxlint + eslint-plugin-vue)
├── index.html                     # HTML entry point
├── .firebaserc                    # Firebase project alias
├── firebase.json                  # Firebase hosting & functions config
├── firestore.rules                # Firestore security rules
├── firestore.indexes.json         # Firestore composite indexes
├── package.json                   # App dependencies, build scripts
├── package-lock.json
├── .env.local.example             # Example environment variables
├── CLAUDE.md                      # Project instructions for Claude
├── .gitignore                     # Git ignore rules
└── docs/                          # Documentation (if any)
```

## Directory Purposes

**`src/`:**
- Purpose: All Vue 3 application code
- Contains: Views, components, stores, routing, utilities, types, composables
- Key files: `main.ts` (entry), `App.vue` (root), `router/index.ts` (routing)

**`src/components/`:**
- Purpose: Reusable, presentational Vue components
- Contains: Modal dialogs, tables, sidebars, cards, form inputs
- Pattern: Self-contained `.vue` files with scoped Tailwind CSS
- Naming: PascalCase, descriptive names (e.g., `SongSlotPicker.vue`, `AvailabilityDrawer.vue`)

**`src/views/`:**
- Purpose: Route-mapped, page-level components
- Contains: One component per route + layout composition
- Pattern: Import route-specific components; compose with `AppShell` layout
- Naming: `*View.vue` suffix (e.g., `ServiceEditorView.vue`)
- Subscriptions: Each view initializes its store subscriptions on mount

**`src/stores/`:**
- Purpose: Pinia stores managing application state with Firestore subscriptions
- Contains: One store per domain (auth, songs, services, quarters, roster)
- Pattern: Composition API with refs/computed/functions; `onSnapshot` listeners
- Exports: Store instance via `useXStore()` function
- Responsibilities: Subscribe to Firestore, maintain reactive state, expose mutations

**`src/router/`:**
- Purpose: Vue Router configuration and route guards
- Contains: Route definitions, auth guard logic, role-based access control
- Entry point: `src/router/index.ts` (imported in `main.ts`)
- Guards: `beforeEach` checks `requiresAuth`, `requiresEditor` meta flags

**`src/firebase/`:**
- Purpose: Firebase SDK initialization and configuration
- Contains: `initializeApp()`, Firebase auth/Firestore instances
- Exports: `app`, `auth`, `db` singletons
- Emulator: Enabled via `VITE_USE_EMULATORS=true` env var

**`src/types/`:**
- Purpose: Shared TypeScript domain models
- Contains: Interfaces for `Service`, `Song`, `Arrangement`, `Person`, `Team`, `Progression`, `VWType`
- Pattern: Exported as type-only (no runtime code)
- Imported by: Views, components, stores, utils

**`src/utils/`:**
- Purpose: Business logic, external API clients, transformers, validators
- Contains: Planning Center API wrapper, CSV parsers, scheduling algorithms, string formatters
- Pattern: Exported functions/classes (no default exports)
- Usage: Called by views/components/stores for side effects or data transformation

**`src/composables/`:**
- Purpose: Reusable Vue 3 Composition Functions
- Contains: Logic that can be composed into multiple components
- Pattern: Exported functions returning reactive state/methods
- Example: `useUnsavedGuard()` for form dirty checks

**`src/assets/`:**
- Purpose: Static resources (CSS, images, icons)
- Contains: Tailwind CSS imports, global styles
- Note: Images/icons committed to repo or linked from CDN

**`src/__tests__/`** (at various levels):
- Purpose: Unit and integration tests for components, stores, views, utilities
- Pattern: Co-located `__tests__` dirs next to source files
- Framework: Vitest + Vue Test Utils for components; Vitest for logic
- Naming: `*.test.ts` or `*.spec.ts`

**`functions/`:**
- Purpose: Firebase Cloud Functions (backend services)
- Contains: Reverse proxy API (`functions/src/index.ts`)
- Responsibility: Inject server-held API keys (Anthropic, ESV), verify Firebase ID tokens
- Deployed to: Google Cloud Functions (via `firebase deploy`)

**`public/`:**
- Purpose: Static files served as-is by Vite dev server and Hosting
- Contains: `favicon.ico` and any public assets
- Deployment: Copied to `dist/` during build, served from Firebase Hosting root

## Key File Locations

**Entry Points:**
- `src/main.ts` — App initialization (create Vue app, Pinia, router)
- `index.html` — HTML shell (mounts app at `#app`)
- `src/router/index.ts` — Route definitions and guards

**Configuration:**
- `vite.config.ts` — Build config, dev proxy, test setup
- `tsconfig.json` — TypeScript root config
- `eslint.config.ts` — Linting rules
- `.firebaserc` — Firebase project mapping
- `firebase.json` — Firebase Hosting and Functions config
- `firestore.rules` — Firestore security rules
- `.env.local.example` — Example env vars (local dev, Firestore emulator)

**Core Logic:**
- `src/stores/auth.ts` — Authentication, org context, user role
- `src/stores/songs.ts` — Songs library with Firestore subscription
- `src/stores/services.ts` — Service CRUD, song slot assignments
- `src/stores/quarters.ts` — Quarterly schedule management
- `src/stores/roster.ts` — Volunteer roster, availability, team roles
- `src/router/index.ts` — Route guards, role-based redirects

**Testing:**
- `src/**/__tests__/` — Unit tests for components, stores, views
- `src/rules.test.ts` — Firestore security rules tests (uses Firebase emulator)
- `vitest.rules.config.ts` — Vitest config for rules tests

## Naming Conventions

**Files:**
- Components: `PascalCase.vue` (e.g., `AppShell.vue`, `SongTable.vue`)
- Views: `*View.vue` suffix (e.g., `ServiceEditorView.vue`)
- Stores: `lowercase.ts` (e.g., `auth.ts`, `songs.ts`)
- Utils: `camelCase.ts` (e.g., `planningCenterApi.ts`, `slotTypes.ts`)
- Tests: `*.test.ts` or `*.spec.ts`

**Directories:**
- Features: `lowercase` plural (e.g., `components/`, `utils/`, `stores/`)
- Test dirs: `__tests__` (co-located with source)

**Functions & Variables:**
- Composables: `useXxx` prefix (e.g., `useAuthStore`, `useUnsavedGuard`)
- Store exports: `useXStore` function (e.g., `useAuthStore()`, `useSongStore()`)
- Computed: Descriptive names reflecting the computed value (e.g., `filteredSongs`, `isEditor`)
- Refs: Clear intent (e.g., `searchQuery`, `isLoading`, `selectedSongId`)

**Types:**
- Interfaces: PascalCase (e.g., `Service`, `Song`, `Arrangement`)
- Union types: PascalCase (e.g., `Progression`, `ServiceSlot`, `VWType`)
- Constants: UPPER_SNAKE_CASE (e.g., `PROGRESSION_SLOT_TYPES`, `VW_TYPE_LABELS`)

## Where to Add New Code

**New Feature (e.g., new page or major section):**
1. **Router:** Add route to `src/router/index.ts` (lazy-loaded import)
2. **View:** Create `src/views/YourFeatureView.vue` (compose components + stores)
3. **Store (if needed):** Create `src/stores/yourFeature.ts` with `onSnapshot` subscription
4. **Components:** Create reusable UI blocks in `src/components/` (e.g., `YourFeatureTable.vue`, `YourFeatureModal.vue`)
5. **Types (if needed):** Add interfaces to `src/types/yourFeature.ts`
6. **Utils (if needed):** Add helpers to `src/utils/` (e.g., `yourFeatureHelpers.ts`, or extend existing util files)
7. **Tests:** Create `src/views/__tests__/YourFeatureView.test.ts` and `src/components/__tests__/YourFeatureModal.test.ts`

**New Component/Modal (Reusable UI):**
1. Create `src/components/YourComponentName.vue`
2. Import in parent view/component
3. If component needs store data: access via `useXStore()` inside component
4. Add unit test to `src/components/__tests__/YourComponentName.test.ts`

**New Store (New domain/entity):**
1. Create `src/stores/yourDomain.ts`
2. Use composition API pattern: `export const useYourDomainStore = defineStore('yourDomain', () => { ... })`
3. Set up `onSnapshot` subscription for Firestore collection
4. Export refs for state, computed for derived state, functions for mutations
5. Call `unsubscribeAll()` on logout (handled in router guard)
6. Add unit tests to `src/stores/__tests__/yourDomain.test.ts`

**New Utility/Helper:**
1. Create or extend file in `src/utils/`
2. Name: descriptive, lowercase.ts (e.g., `yourFeatureHelpers.ts`, `yourApiClient.ts`)
3. Export functions only (no default export)
4. Add unit tests to `src/utils/__tests__/yourFeature.test.ts`

**New API Integration:**
1. If calling external API: Create client in `src/utils/yourApiClient.ts`
2. Use Vite dev proxy for dev (configured in `vite.config.ts`)
3. Use Cloud Functions proxy for prod (call `/api/yourService/...` → `functions/src/index.ts` routes it)
4. For server-held secrets (API keys): Add to Cloud Functions, verify Firebase ID token, inject in proxy

**New Type/Interface:**
1. Add to appropriate file in `src/types/` (e.g., `service.ts`, `song.ts`, `roster.ts`)
2. Or create new type file if domain-specific (e.g., `src/types/yourFeature.ts`)
3. Export as type-only: `export type YourType = ...`
4. Import in stores/components/utils as needed

## Special Directories

**`src/__tests__/` and `src/*//__tests__/`:**
- Purpose: Co-located unit tests
- Generated: No (committed to git)
- Committed: Yes
- Framework: Vitest + Vue Test Utils
- Run: `npm run test:unit` (all tests), `npm run test:unit -- --watch` (watch mode)

**`src/rules.test.ts`:**
- Purpose: Firestore security rules validation tests
- Generated: No
- Committed: Yes
- Framework: Vitest + `@firebase/rules-unit-testing`
- Run: `npm run test:rules` (uses Firebase emulator)
- Note: Separate config file `vitest.rules.config.ts` because of emulator dependency

**`dist/`:**
- Purpose: Built app (generated)
- Generated: Yes (`npm run build`)
- Committed: No (in `.gitignore`)
- Deployment: Contents uploaded to Firebase Hosting

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (`npm install`)
- Committed: No (in `.gitignore`)

**`.planning/codebase/`:**
- Purpose: GSD codebase documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: No (maintained by GSD mapping agent)
- Committed: Yes

---

*Structure analysis: 2026-07-16*
