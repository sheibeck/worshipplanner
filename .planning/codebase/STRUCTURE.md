# Codebase Structure

**Analysis Date:** 2026-07-15

## Directory Layout

```
worshipplanner-ea415a6b/                          # Project root
├── .planning/                                    # GSD planning documents
│   ├── codebase/                                 # This directory (ARCHITECTURE.md, STRUCTURE.md, etc.)
│   ├── graphs/                                   # Knowledge graph (auto-built by /gsd-graphify)
│   ├── phases/                                   # Phase workstreams
│   └── quick/                                    # Quick tasks
├── docs/                                         # External documentation
├── functions/                                    # Firebase Cloud Functions (backend proxy)
│   ├── src/
│   │   └── index.ts                              # Express-like API proxy (anthropic, esv, planningcenter)
│   ├── package.json
│   ├── tsconfig.json
│   └── lib/ (build output, not committed)
├── public/                                       # Static assets served by Vite
│   └── index.html                                # Entry HTML file (mounts #app)
├── src/                                          # Frontend application
│   ├── assets/
│   │   └── main.css                              # Global Tailwind CSS
│   ├── components/                               # Reusable Vue components
│   │   ├── __tests__/                            # Component unit tests
│   │   ├── AppShell.vue                          # Main layout wrapper
│   │   ├── AppSidebar.vue                        # Navigation sidebar
│   │   ├── PcImportModal.vue                     # Planning Center import dialog
│   │   ├── CsvImportModal.vue                    # CSV import dialog
│   │   ├── RosterImportModal.vue                 # Volunteer roster import
│   │   ├── NewServiceDialog.vue                  # Create new service
│   │   ├── QuarterGrid.vue                       # Quarterly schedule grid (largest component)
│   │   ├── SongTable.vue                         # Song library table
│   │   ├── SongSlideOver.vue                     # Song detail drawer
│   │   ├── SongFilters.vue                       # Song search & filter controls
│   │   ├── AvailabilityDrawer.vue                # Volunteer availability editor
│   │   ├── AvailabilityRosterTable.vue           # Volunteer rotation table
│   │   ├── ScriptureInput.vue                    # Bible passage lookup & input
│   │   ├── ServiceCard.vue                       # Service preview card
│   │   ├── ArrangementAccordion.vue              # Song arrangement details
│   │   ├── RotationTable.vue                     # Weekly rotation view
│   │   ├── RolesConfigPanel.vue                  # Role management
│   │   ├── BatchQuickAssign.vue                  # Bulk volunteer assign
│   │   ├── CsvImportModal.vue                    # CSV parser UI
│   │   ├── RosterPrintLayout.vue                 # Roster print template
│   │   ├── ServicePrintLayout.vue                # Service print template
│   │   └── [other utility components]
│   ├── composables/                              # Reusable Vue composition functions
│   │   └── useUnsavedGuard.ts                    # Dirty-check + discard confirmation
│   ├── firebase/
│   │   └── index.ts                              # Firebase SDK init (auth, firestore, emulator config)
│   ├── router/
│   │   ├── __tests__/                            # Router unit tests
│   │   └── index.ts                              # Vue Router config; auth guards; route definitions
│   ├── stores/                                   # Pinia state management (Firestore real-time)
│   │   ├── __tests__/                            # Store unit tests
│   │   ├── auth.ts                               # Auth state + org/role info
│   │   ├── songs.ts                              # Song catalog + filtering
│   │   ├── services.ts                           # Service/worship plan documents
│   │   ├── quarters.ts                           # Quarterly schedules + schedule generation
│   │   └── roster.ts                             # Volunteers, roles, availability
│   ├── types/                                    # TypeScript type definitions
│   │   ├── song.ts                               # Song, Arrangement, VWType
│   │   ├── service.ts                            # Service, ServiceSlot (discriminated union)
│   │   └── roster.ts                             # Person, Role, Quarter, RoleFrequencyEntry, etc.
│   ├── utils/                                    # Pure business logic utilities
│   │   ├── __tests__/                            # Utility unit tests
│   │   ├── scheduler.ts                          # Fair-share volunteer scheduler (pure function)
│   │   ├── planningCenterApi.ts                  # Planning Center API client
│   │   ├── pcSongImport.ts                       # Import songs from Planning Center
│   │   ├── songSearch.ts                         # Text search over song catalog
│   │   ├── csvImport.ts                          # CSV parse & map to songs/people
│   │   ├── claudeApi.ts                          # Claude AI integration (via proxy)
│   │   ├── esvApi.ts                             # ESV Bible API client (via proxy)
│   │   ├── planningCenterExport.ts               # Export service plan to Planning Center
│   │   ├── scripture.ts                          # Bible reference parsing & formatting
│   │   ├── quarterDates.ts                       # Generate quarter Sunday dates
│   │   ├── slug.ts                               # Share URL slug generation
│   │   ├── slotTypes.ts                          # Build service slots by VW progression
│   │   ├── rotationTable.ts                      # Format rotation table data
│   │   ├── suggestions.ts                        # Claude AI suggestions parsing
│   │   ├── appAuth.ts                            # Auth header helpers
│   │   └── volunteerCsv.ts                       # Volunteer CSV export format
│   ├── views/                                    # Page/view components (top-level routes)
│   │   ├── __tests__/                            # View unit tests
│   │   ├── LoginView.vue                         # /login — Firebase auth UI
│   │   ├── DashboardView.vue                     # / — Dashboard summary
│   │   ├── SongsView.vue                         # /songs — Song library (search, import, edit)
│   │   ├── RosterView.vue                        # /volunteers — Volunteer roster management
│   │   ├── QuarterView.vue                       # /schedule — Quarterly schedule editor
│   │   ├── ServicesView.vue                      # /services — List of service plans
│   │   ├── ServiceEditorView.vue                 # /services/:id — Service editor (largest view, 103 KB)
│   │   ├── SettingsView.vue                      # /settings — App configuration (VW mode, PC credentials)
│   │   ├── TeamView.vue                          # /admins — Team member management
│   │   ├── ShareView.vue                         # /share/:token — Public service share link
│   │   ├── QuarterShareView.vue                  # /quarter-share/:token & /:slug/quarter{N}-{YYYY} — Public schedule
│   │   └── __tests__/
│   ├── App.vue                                   # Root component (auth loading spinner + RouterView)
│   ├── main.ts                                   # Entry point (Vue app creation, Pinia, Router setup)
│   └── rules.test.ts                             # Firestore security rules unit tests (special test config)
├── .env.example                                  # Example environment variables (never commit .env)
├── .env.local (NOT COMMITTED)                    # Local development secrets (VITE_FIREBASE_*, CLAUDE_API_KEY, ESV_API_KEY)
├── .env.production (POSSIBLY COMMITTED)          # Production config (only public vars, VITE_* prefix)
├── eslint.config.ts                              # ESLint configuration
├── vite.config.ts                                # Vite + Vue + Tailwind build config; dev API proxies
├── vitest.config.ts (generated from vite.config.ts) # Vitest configuration
├── vitest.rules.config.ts                        # Special test config for Firestore rules testing
├── tsconfig.json                                 # Base TypeScript config
├── tsconfig.app.json                             # App-specific TypeScript config (strict mode)
├── tsconfig.node.json                            # Build tools TypeScript config
├── tsconfig.vitest.json                          # Vitest TypeScript config
├── package.json                                  # Frontend dependencies & scripts
├── package-lock.json                             # Dependency lock file
├── .gitignore                                    # Git ignore rules (excludes .env, dist, node_modules)
├── CLAUDE.md                                     # This project's Claude instructions
├── firebase.json                                 # Firebase hosting & functions config
├── firestore.rules                               # Firestore security rules (deployed separately)
└── README.md (if exists)                         # Project documentation
```

## Directory Purposes

**`src/components/`**
- Purpose: Reusable Vue Single File Components — modals, tables, forms, layout wrappers
- Contains: Vue SFC files + optional scoped CSS (Tailwind)
- Key files:
  - `AppShell.vue`, `AppSidebar.vue` - Main layout wrapper & navigation
  - Modal dialogs: `PcImportModal.vue`, `CsvImportModal.vue`, `NewServiceDialog.vue`, `RosterImportModal.vue`
  - Tables: `SongTable.vue`, `AvailabilityRosterTable.vue`, `QuarterGrid.vue`, `RotationTable.vue`
  - Forms: `ScriptureInput.vue`, `SongFilters.vue`, `AvailabilityDrawer.vue`, `RolesConfigPanel.vue`

**`src/composables/`**
- Purpose: Reusable Vue composition functions (shared logic between components/views)
- Contains: Functions that return reactive state + methods (following Vue 3 Composition API)
- Currently: Only `useUnsavedGuard.ts` (form dirty detection)
- Future: Could add `useServiceForm`, `useQuarterData`, etc.

**`src/stores/`**
- Purpose: Pinia state stores — centralized reactive state synced with Firestore
- Contains: 5 stores (auth, songs, services, quarters, roster)
- Pattern: Each store has `subscribe(orgId)` that sets up `onSnapshot` listeners
- Firestore structure: Most collections nested under `/organizations/{orgId}/`

**`src/types/`**
- Purpose: TypeScript type definitions shared across codebase
- Contains: 3 main files (song.ts, service.ts, roster.ts) defining domain models
- Exports: Discriminated unions (ServiceSlot), enums (VWType), interfaces (Person, Quarter, etc.)

**`src/utils/`**
- Purpose: Pure business logic utilities — no framework imports, no side effects, fully testable
- Contains: 15+ utilities for scheduling, API integration, search, import/export
- Key utilities:
  - `scheduler.ts` - Deterministic volunteer scheduling with constraints
  - `planningCenterApi.ts` - Planning Center API client (services, songs, people)
  - `pcSongImport.ts` - Merge Planning Center songs into local catalog
  - `songSearch.ts` - Text search over songs
  - `claudeApi.ts` - Claude AI integration
  - `csvImport.ts` - CSV parsing for batch imports

**`src/views/`**
- Purpose: Page/view components — top-level containers for each route
- Contains: Large Vue SFC files (typically 200-1000 lines), each representing a page
- Route mapping:
  - `/login` → `LoginView.vue`
  - `/` → `DashboardView.vue`
  - `/songs` → `SongsView.vue`
  - `/volunteers` → `RosterView.vue`
  - `/schedule` → `QuarterView.vue`
  - `/services` → `ServicesView.vue`
  - `/services/:id` → `ServiceEditorView.vue`

**`src/router/`**
- Purpose: Vue Router configuration + auth guards
- Contains: `index.ts` (route definitions, guards, getCurrentUser helper)
- Route meta: `requiresAuth`, `requiresEditor` control access

**`src/firebase/`**
- Purpose: Firebase SDK initialization
- Contains: `index.ts` (initializeApp, getAuth, getFirestore, emulator config)
- Exports: Module-level singletons `app`, `auth`, `db`

**`functions/src/`**
- Purpose: Firebase Cloud Functions — secure API proxy
- Contains: Express-like request handler
- Routes: `/api/anthropic/`, `/api/esv/`, `/api/planningcenter/`
- Security: Verifies Firebase ID token for secret-bearing routes; injects server-held keys

**`src/assets/`**
- Purpose: Global styles & static assets
- Contains: `main.css` (Tailwind @import)

**`.env` & `.env.local`**
- Purpose: Environment variables (never committed)
- Examples:
  - `VITE_FIREBASE_API_KEY` - Firebase public config (safe to expose)
  - `CLAUDE_API_KEY` - Server-held, never in browser (Cloud Function injects)
  - `ESV_API_KEY` - Server-held, never in browser (Cloud Function injects)

## Key File Locations

**Entry Points:**
- `public/index.html` - HTML entry point (mounts Vue to `#app`)
- `src/main.ts` - JavaScript entry point (creates Vue app, installs plugins)
- `src/router/index.ts` - Route definitions & auth guards

**Configuration:**
- `vite.config.ts` - Build config, dev proxies, Vue + Tailwind setup
- `tsconfig.app.json` - TypeScript strict mode
- `eslint.config.ts` - Linting rules
- `.env.example` - Example environment template
- `firebase.json` - Firebase hosting & functions deployment config
- `firestore.rules` - Firestore security rules (deployed separately)

**Core Logic:**
- `src/utils/scheduler.ts` - Volunteer scheduling algorithm
- `src/utils/planningCenterApi.ts` - Planning Center integration
- `src/stores/auth.ts` - Auth state & org initialization
- `src/types/service.ts` - Service & slot type definitions

**Testing:**
- `src/components/__tests__/` - Component unit tests (Vitest + Vue Test Utils)
- `src/stores/__tests__/` - Store unit tests
- `src/utils/__tests__/` - Utility unit tests
- `src/rules.test.ts` - Firestore rules tests (special config via `vitest.rules.config.ts`)

## Naming Conventions

**Files:**
- Vue components: PascalCase + `.vue` (e.g., `SongTable.vue`, `PcImportModal.vue`)
- Utilities: camelCase + `.ts` (e.g., `scheduler.ts`, `songSearch.ts`)
- Stores: camelCase + `.ts` (e.g., `songs.ts`, `quarters.ts`)
- Types: camelCase + `.ts` (e.g., `song.ts`, `service.ts`)
- Test files: match source file name + `.test.ts` or `.spec.ts` (e.g., `SongBadge.test.ts`)

**Directories:**
- Lowercase plural for feature folders (e.g., `components`, `stores`, `views`, `utils`)
- Test folders: `__tests__` (follows Vue conventions)

**Vue Component Props & Events:**
- Props: camelCase (e.g., `types`, `modelValue`, `isLoading`)
- Events: camelCase with `@` in templates (e.g., `@click`, `@update:modelValue`)
- Method names: camelCase (e.g., `onClickSave`, `handleSubmit`)

**TypeScript:**
- Interfaces: PascalCase (e.g., `Song`, `Service`, `Person`, `Quarter`)
- Types (unions, aliases): PascalCase (e.g., `ServiceSlot`, `VWType`, `FrequencyTier`)
- Constants: UPPER_CASE (e.g., `VW_TYPE_LABELS`, `DEFAULT_ROLES`, `PC_BASE_URL`)
- Functions: camelCase (e.g., `proposeQuarterSchedule`, `fetchServiceTypes`)

**Stores (Pinia):**
- Store name: camelCase (e.g., `songs`, `quarters`, `auth`)
- Store file: camelCase + `Store` suffix (e.g., `songsStore.ts`, but defined as `useSongsStore()`)
- State variables: camelCase (e.g., `songs.value`, `isLoading.value`)
- Getters: camelCase, computed (e.g., `filteredSongs`, `isAuthenticated`)
- Actions: camelCase, verb-first (e.g., `createService`, `updateSong`, `generateProposal`)

## Where to Add New Code

**New Feature:**
1. **Primary code:** Add Vue components to `src/components/` and views to `src/views/`
2. **State:** Add Pinia store to `src/stores/` if feature needs shared state across views
3. **Business logic:** Add utilities to `src/utils/` for pure functions (scheduling, search, etc.)
4. **Types:** Add interfaces to `src/types/` for domain models
5. **Routes:** Add route to `src/router/index.ts` with appropriate auth guards
6. **Tests:** Add `*.test.ts` files co-located with source (e.g., `src/components/__tests__/MyComponent.test.ts`)

**New Component/Module:**
- Implementation: `src/components/MyComponent.vue` (single file component)
- Test: `src/components/__tests__/MyComponent.test.ts` (co-located with source)
- Export: Import in view or parent component as needed; no barrel file (index.ts) currently used

**Reusable Utility Function:**
- Location: `src/utils/myUtility.ts`
- Convention: Pure function (no framework imports, no side effects)
- Test: `src/utils/__tests__/myUtility.test.ts`
- Import: Any component/store can `import { myFunction } from '@/utils/myUtility'`

**New Pinia Store:**
- Location: `src/stores/myDomain.ts`
- Pattern: Use `defineStore('myDomain', () => { ... })` (composition API)
- Subscribe to Firestore: `onSnapshot(collection(...), (snap) => { state.value = snap.docs.map(...) })`
- Access: `const store = useMyDomainStore()` in components/views
- Test: `src/stores/__tests__/myDomain.test.ts`

**New External API Integration:**
- Client code: `src/utils/myApiClient.ts` (fetch calls, auth headers)
- Proxy route: Add to `functions/src/index.ts` if secrets needed (e.g., `/api/myservice/`)
- Dev proxy: Add to `vite.config.ts` `server.proxy` if developing locally
- Usage: Utilities call client functions; views/stores call utilities

**External API that requires server-held secrets:**
1. Add secret to Firebase Secret Manager: `firebase functions:secrets:set MY_API_KEY`
2. Add to `functions/src/index.ts`:
   ```typescript
   const MY_API_KEY = defineSecret("MY_API_KEY");
   // ... in handler:
   if (service === "myservice") {
     headers["authorization"] = `Bearer ${MY_API_KEY.value()}`;
   }
   ```
3. Create client at `src/utils/myApiClient.ts` that calls `/api/myservice/...`
4. Use in utilities/stores/views as normal

## Special Directories

**`.planning/`**
- Purpose: GSD planning & analysis artifacts
- Generated: By GSD tools (`/gsd-map-codebase`, `/gsd-graphify`, etc.)
- Committed: Yes; tracked in git for project history

**`functions/lib/` (build output)**
- Purpose: Compiled JavaScript output of Cloud Functions
- Generated: By `npm run build` in `functions/` directory
- Committed: No; generated from `functions/src/`

**`node_modules/`**
- Purpose: Package dependencies
- Generated: By `npm install`
- Committed: No; only `package-lock.json` committed

**`dist/` or `.next/` (build output)**
- Purpose: Final bundled application
- Generated: By `npm run build`
- Committed: No; generated from `src/`

---

*Structure analysis: 2026-07-15*
