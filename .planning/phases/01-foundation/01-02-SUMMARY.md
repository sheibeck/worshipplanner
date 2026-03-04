---
phase: 01-foundation
plan: 02
subsystem: ui
tags: [vue3, tailwind, pinia, vue-router, typescript, firebase, login, dashboard, sidebar]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Pinia auth store (loginWithGoogle, loginWithEmail, resetPassword, logout, isReady), Vue Router with auth guard, Firebase singletons"
provides:
  - LoginView with Google sign-in (popup), email/password sign-in, forgot password inline flow, friendly error messages
  - AppShell layout wrapper with sidebar + content area, mobile hamburger toggle
  - AppSidebar with nav items (Dashboard/Songs/Services/Tasks), user avatar/initials, sign out, active route highlighting
  - DashboardView wrapped in AppShell with welcome greeting
  - GettingStarted 4-step onboarding checklist (step 1 auto-checked)
  - App.vue loading spinner preventing flash-of-login-page on auth state init
affects: ["02-songs", "03-service-planning", "04-output", "05-collaboration"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline SVG icons pattern: heroicons-style 20x20 SVGs inline in template, no icon library"
    - "AppShell wrapper pattern: DashboardView imports AppShell and wraps its template content"
    - "Auth-ready guard in App.vue: v-if='!authStore.isReady' loading spinner prevents flash to login"

key-files:
  created:
    - src/components/AppShell.vue
    - src/components/AppSidebar.vue
    - src/components/GettingStarted.vue
  modified:
    - src/views/LoginView.vue
    - src/views/DashboardView.vue
    - src/App.vue

key-decisions:
  - "AppShell wrapper pattern: DashboardView wraps its content in <AppShell> directly, rather than App.vue switching between layouts — simpler, consistent with future route additions"
  - "Inline SVG for all icons: Google G, heroicons-style nav icons, checkmarks — no icon library dependency"
  - "Mobile sidebar uses fixed overlay with translate-x transition — avoids layout shift on desktop"
  - "GettingStarted step completion is hardcoded for Phase 1 — dynamic tracking deferred to when features exist"

patterns-established:
  - "AppShell wrapper: authenticated views import and wrap with <AppShell> in their own template"
  - "Inline SVG icons: v-html binding with SVG string in data array for nav items"
  - "Auth loading guard: App.vue v-if on authStore.isReady prevents FOUC to login page"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 01 Plan 02: UI Shell Summary

**Login page (Google-first + email/password), app shell with collapsible sidebar nav, and dashboard with 4-step onboarding checklist — complete Phase 1 authentication UX**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T02:13:30Z
- **Completed:** 2026-03-04T02:17:59Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint — awaiting user)
- **Files created/modified:** 6

## Accomplishments
- LoginView with prominent Google sign-in button, secondary email/password form, inline forgot-password flow, loading states, Firebase error code mapping, and router redirect after sign-in
- AppShell layout with sidebar + main content slot, mobile hamburger button and overlay backdrop, desktop persistent sidebar
- AppSidebar with 4 nav items (Dashboard/Songs/Services/Tasks) using inline SVG heroicons, user avatar with computed initials, truncated email display, sign out action
- DashboardView wrapped in AppShell with welcome greeting using displayName or email prefix
- GettingStarted 4-step checklist: step 1 always checked (user is signed in), steps 2-4 with descriptions and arrow-link navigation
- App.vue loading spinner while authStore.isReady is false, preventing flash-of-login-page on page refresh
- Build succeeds (Vite), all 22 unit tests still pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Build LoginView, AppShell, AppSidebar, DashboardView with GettingStarted** - `881b13e` (feat)
2. **Task 2: Human verify checkpoint** - awaiting human verification

## Files Created/Modified

**Created:**
- `src/components/AppShell.vue` - Flex layout with sidebar + slot, mobile hamburger toggle and backdrop
- `src/components/AppSidebar.vue` - Persistent sidebar with nav links, user info, sign out button, mobile overlay
- `src/components/GettingStarted.vue` - 4-step onboarding checklist card with step states

**Modified:**
- `src/views/LoginView.vue` - Full login page: Google button, email/password form, forgot password inline flow
- `src/views/DashboardView.vue` - Protected dashboard wrapping AppShell + GettingStarted
- `src/App.vue` - Auth-ready loading guard with spinner

## Decisions Made

- **AppShell wrapper pattern**: DashboardView wraps in `<AppShell>` directly in its own template. This is simpler than App.vue conditionally rendering layouts, and will extend cleanly when future route pages are added in later phases.
- **Inline SVG icons**: All icons (Google G, nav icons, checkmarks, arrows) are inline SVG in template. Avoids icon library dependency as specified.
- **Mobile sidebar**: Fixed position overlay with CSS translate-x transition. Desktop sidebar is `static` (no position:fixed) so it doesn't need z-index management.
- **GettingStarted hardcoded**: Step completion state is static for Phase 1 (step 1 always checked). Dynamic tracking deferred per plan spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript possibly-undefined errors in AppSidebar userInitials computed**
- **Found during:** Task 1 — vue-tsc type check
- **Issue:** `parts[0][0]` and `parts[1][0]` caused TS2532 "Object is possibly 'undefined'" — array indexing is not type-safe
- **Fix:** Added null guards (`parts[0] && parts[1]`) and used `.charAt(0)` instead of index access
- **Files modified:** src/components/AppSidebar.vue
- **Verification:** `npx vue-tsc --noEmit` produces no errors from AppSidebar.vue
- **Committed in:** 881b13e (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** TypeScript correctness fix only. No behavior change, no scope creep.

## Issues Encountered

- **Pre-existing vue-tsc errors in rules.test.ts and vite.config.ts**: These errors exist from Plan 01 (separate vitest config files, emulator test separation). They are out of scope for this plan and not caused by Plan 02 changes. Build (`vite build`) succeeds cleanly.

## User Setup Required

**External services require manual configuration before Task 2 verification:**

Prerequisites for human verification:
1. Copy `.env.local.example` to `.env.local` and fill in Firebase project credentials
2. Ensure Firebase project has Google and Email/Password sign-in providers enabled
3. Install firebase-tools globally if not installed: `npm install -g firebase-tools`

For local testing with emulators:
1. Run `firebase emulators:start` in one terminal
2. Run `npm run dev` in another terminal
3. Visit http://localhost:5173

## Next Phase Readiness

- All Phase 1 UI components built and verified via build
- Awaiting human verification of the complete auth flow (Task 2 checkpoint)
- Once verified, Phase 2 (song library) can begin — AppSidebar already has the Songs nav link scaffolded
- AppShell and AppSidebar are ready to accommodate new routes from future phases

---
*Phase: 01-foundation*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: src/views/LoginView.vue
- FOUND: src/views/DashboardView.vue
- FOUND: src/components/AppShell.vue
- FOUND: src/components/AppSidebar.vue
- FOUND: src/components/GettingStarted.vue
- FOUND: src/App.vue
- FOUND commit 881b13e (Task 1: Build UI components)
