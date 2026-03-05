---
phase: 01-foundation
plan: 01
subsystem: auth
tags: [vue3, firebase, firestore, pinia, vitest, tailwind, typescript, emulator]

# Dependency graph
requires: []
provides:
  - Vue 3 + TypeScript project scaffold with Vite and Tailwind CSS v4
  - Firebase singleton (app, auth, db) with emulator support in DEV mode
  - Pinia auth store with Google sign-in, email sign-in (auto-create), password reset, logout
  - ensureUserDocument: auto-creates user profile and default org on first sign-in
  - Vue Router with beforeEach guard protecting authenticated routes
  - Firestore security rules with deny-by-default and org membership enforcement
  - 22 passing unit tests (auth store + router guard)
  - 12 passing security rules tests against Firestore emulator
affects: ["02-ui", "03-service-planning", "04-output", "05-collaboration"]

# Tech tracking
tech-stack:
  added:
    - firebase@12
    - "@firebase/rules-unit-testing@5"
    - "@tailwindcss/vite@4"
    - tailwindcss@4
    - pinia@3
    - vue-router@5
    - vitest@4
    - vue-tsc@3
    - firebase-tools@15 (global, for emulator)
    - OpenJDK 21 (for Firestore emulator)
  patterns:
    - Firebase singletons exported from src/firebase/index.ts
    - Pinia stores use setup syntax (defineStore + ref/computed)
    - Router guard uses getCurrentUser() wrapping onAuthStateChanged
    - TDD: tests committed before implementation
    - Security rules tests run via firebase emulators:exec with separate vitest config

key-files:
  created:
    - src/firebase/index.ts
    - src/stores/auth.ts
    - src/router/index.ts
    - src/views/LoginView.vue
    - src/views/DashboardView.vue
    - firestore.rules
    - src/rules.test.ts
    - src/stores/__tests__/auth.test.ts
    - src/router/__tests__/router.test.ts
    - vitest.rules.config.ts
    - .env.local.example
    - firebase.json
    - firestore.indexes.json
    - .firebaserc
  modified:
    - vite.config.ts
    - src/main.ts
    - src/App.vue
    - src/assets/main.css
    - package.json

key-decisions:
  - "Firebase v12 used (with @firebase/rules-unit-testing v5) — firebase 11 incompatible with rules-unit-testing 3"
  - "loginWithEmail auto-creates account on auth/user-not-found AND auth/invalid-credential (Firebase 9+ returns invalid-credential for missing users)"
  - "vitest.rules.config.ts created as separate config — emulator tests excluded from standard jsdom test run"
  - "ensureUserDocument uses writeBatch for atomic org+membership creation on first sign-in"
  - "signInWithPopup used over signInWithRedirect per research decision (broken in Chrome M115+)"
  - "Firestore rules allow create on /organizations/{orgId} for authenticated users if createdBy == uid"

patterns-established:
  - "Firebase singletons pattern: import from @/firebase, never re-initialize"
  - "Auth store setup syntax: defineStore('auth', () => { ... })"
  - "Router getCurrentUser(): wraps onAuthStateChanged in Promise, resolves once, then unsubscribes"
  - "TDD pattern: test commit (test:) before implementation commit (feat:)"
  - "Emulator test separation: vitest.rules.config.ts for emulator tests, vite.config.ts for unit tests"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 47min
completed: 2026-03-04
---

# Phase 01 Plan 01: Foundation Infrastructure Summary

**Vue 3 + Firebase project scaffolded with Pinia auth store (Google + email auto-create), router auth guard, Firestore deny-by-default security rules, and 34 passing tests (22 unit + 12 emulator)**

## Performance

- **Duration:** 47 min
- **Started:** 2026-03-04T01:22:02Z
- **Completed:** 2026-03-04T02:09:00Z
- **Tasks:** 3 (+ 2 TDD RED commits)
- **Files created/modified:** 30

## Accomplishments
- Full Vue 3 + TypeScript project scaffold with Tailwind CSS v4 via @tailwindcss/vite
- Firebase v12 singleton with auth+Firestore emulator auto-connection in DEV mode
- Pinia auth store with Google sign-in (popup), email sign-in with auto-account-creation, password reset, logout, and ensureUserDocument (auto-creates org + admin membership on first login)
- Vue Router with beforeEach guard that redirects unauthenticated users and bounces authenticated users away from /login
- Firestore security rules: deny-by-default catch-all, org membership checks (isOrgMember, isOrgAdmin), user profile isolation, and create-only org creation
- 22 unit tests pass (16 auth store behaviors + 6 router guard behaviors)
- 12 security rules tests pass against live Firestore emulator

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Vue 3 project** - `70ac97f` (feat)
2. **Task 2: Auth store tests (RED)** - `2193367` (test)
3. **Task 2: Auth store + router implementation (GREEN)** - `b11264c` (feat)
4. **Task 3: Security rules tests (RED)** - `1f4dbae` (test)
5. **Task 3: Security rules tests pass (GREEN)** - `fc9ae4a` (feat)

_Note: TDD tasks have separate test → impl commits_

## Files Created/Modified

**Core application files:**
- `src/firebase/index.ts` - Firebase app/auth/db singletons with emulator support
- `src/stores/auth.ts` - Pinia auth store with all sign-in methods and ensureUserDocument
- `src/router/index.ts` - Vue Router with getCurrentUser helper and beforeEach auth guard
- `src/views/LoginView.vue` - Login view placeholder (full UI in Plan 02)
- `src/views/DashboardView.vue` - Dashboard view placeholder (full UI in Plan 02)
- `src/App.vue` - Minimal shell with RouterView only
- `src/main.ts` - App setup with Pinia and Router
- `src/assets/main.css` - Tailwind CSS import

**Firebase configuration:**
- `firestore.rules` - Deny-by-default rules with isOrgMember, isOrgAdmin helpers
- `firebase.json` - Emulator ports (auth:9099, firestore:8080, ui:4000)
- `firestore.indexes.json` - Empty indexes file
- `.firebaserc` - Project ID placeholder
- `.env.local.example` - All required VITE_FIREBASE_* env vars

**Test files:**
- `src/stores/__tests__/auth.test.ts` - 16 auth store unit tests
- `src/router/__tests__/router.test.ts` - 6 router guard unit tests
- `src/rules.test.ts` - 12 Firestore security rules emulator tests
- `vitest.rules.config.ts` - Separate vitest config for emulator tests

**Build configuration:**
- `package.json` - All dependencies (firebase@12, tailwind@4, rules-unit-testing@5)
- `vite.config.ts` - Vue + Tailwind plugins, @ alias, vitest jsdom config
- `tsconfig.json/app.json/node.json/vitest.json` - TypeScript configurations

## Decisions Made

- **Firebase v12**: Upgraded from v11 to v12 for compatibility with `@firebase/rules-unit-testing@5` (v3 only supports firebase@10, v5 requires firebase@12)
- **auto-create on auth/invalid-credential**: Firebase 9+ returns `auth/invalid-credential` instead of `auth/user-not-found` for non-existent emails — both error codes trigger auto-creation
- **Separate vitest config for emulator tests**: `vitest.rules.config.ts` excludes these from standard `npm run test:unit` since they require the emulator; run via `firebase emulators:exec`
- **Firestore create-only org rule**: Allows authenticated users to create their own org on first sign-in without a Cloud Function, as long as `createdBy == request.auth.uid`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created separate vitest.rules.config.ts for emulator tests**
- **Found during:** Task 3 (security rules tests)
- **Issue:** Standard vitest run with `exclude: ['src/rules.test.ts']` in vite.config.ts caused `firebase emulators:exec "npx vitest run src/rules.test.ts"` to fail with "No test files found" — the exclude list prevented explicit file targeting
- **Fix:** Created `vitest.rules.config.ts` with `include: ['src/rules.test.ts']` and `environment: 'node'`
- **Files modified:** vitest.rules.config.ts (created), package.json (test:rules script)
- **Verification:** All 12 security rules tests pass via `firebase emulators:exec "npx vitest run --config vitest.rules.config.ts"`
- **Committed in:** fc9ae4a

**2. [Rule 1 - Bug] Added auth/invalid-credential handling to loginWithEmail**
- **Found during:** Task 2 (auth store implementation)
- **Issue:** Plan only specified handling `auth/user-not-found`, but Firebase 9+ returns `auth/invalid-credential` for non-existent users — auto-create wouldn't trigger for many users
- **Fix:** Added `auth/invalid-credential` to the auto-create catch block alongside `auth/user-not-found`
- **Files modified:** src/stores/auth.ts, src/stores/__tests__/auth.test.ts
- **Verification:** Test "also auto-creates account on auth/invalid-credential" passes
- **Committed in:** b11264c

**3. [Rule 2 - Missing] Added measurementId to Firebase config**
- **Found during:** Task 1 (scaffold) — user's environment auto-added analytics
- **Issue:** Editor/linter added analytics import with measurementId; keeping for completeness
- **Fix:** Added `VITE_FIREBASE_MEASUREMENT_ID` to env config and .env.local.example
- **Files modified:** src/firebase/index.ts, .env.local.example
- **Committed in:** fc9ae4a

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug fix, 1 missing field)
**Impact on plan:** All auto-fixes necessary for correctness or test infrastructure. No scope creep.

## Issues Encountered

- **Node package manager race condition**: Concurrent background npm installs (firebase, tailwind) created corrupt node_modules — resolved by removing node_modules and doing a single clean install with all dependencies in package.json
- **Firebase CLI not on PATH**: Firebase installed globally but not in bash PATH on Windows — resolved by using full path to firebase.js node module
- **Java not installed**: Firestore emulator requires Java — resolved by installing OpenJDK 21 via winget; needed to set PATH manually in bash session

## User Setup Required

Before running the development server or production build:
1. Copy `.env.local.example` to `.env.local`
2. Fill in your Firebase project credentials from the Firebase Console
3. For local development, start the emulator: `firebase emulators:start --only auth,firestore`
4. The emulator auto-connects when `VITE_NODE_ENV=development`

## Next Phase Readiness

- Project infrastructure fully ready for Plan 02 (Login page + App shell UI)
- `LoginView.vue` and `DashboardView.vue` exist as empty placeholders — Plan 02 fills them in
- Auth store exports all required actions (`loginWithGoogle`, `loginWithEmail`, etc.)
- Router guard will protect `DashboardView` and any future routes with `meta.requiresAuth: true`
- Firestore rules ready for org-scoped data access in Plans 02+

---
*Phase: 01-foundation*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: src/firebase/index.ts
- FOUND: src/stores/auth.ts
- FOUND: src/router/index.ts
- FOUND: firestore.rules
- FOUND: src/rules.test.ts
- FOUND: .planning/phases/01-foundation/01-01-SUMMARY.md
- FOUND commit 70ac97f (Task 1: Scaffold)
- FOUND commit b11264c (Task 2: Auth store + router)
- FOUND commit fc9ae4a (Task 3: Security rules tests)
