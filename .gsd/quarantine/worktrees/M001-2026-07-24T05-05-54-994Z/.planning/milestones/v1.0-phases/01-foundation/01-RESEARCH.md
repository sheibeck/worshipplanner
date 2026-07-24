# Phase 1: Foundation - Research

**Researched:** 2026-03-03
**Domain:** Firebase Authentication (Google OAuth + email/password), Firestore data model, Firestore security rules, Vue 3 + Pinia app shell, Vue Router 4 protected routes
**Confidence:** HIGH (core stack is well-documented; specific patterns verified against official sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Google-first layout: large "Sign in with Google" button prominently displayed, smaller "or use email" link/form below
- No separate registration page — accounts auto-created on first sign-in (Google or email)
- Minimal branding: clean page with "WorshipPlanner" title and sign-in options, no hero imagery
- Include "Forgot password?" flow — Firebase Auth handles the reset email
- Sidebar navigation: persistent left sidebar with nav links, collapses to hamburger menu on mobile
- Getting started checklist as the empty dashboard state: step-by-step onboarding (1. Import songs, 2. Set up first service, etc.) with steps checking off as completed
- Clean & professional visual tone — minimal, muted colors, whitespace-heavy, tool-focused (think Linear/Notion)
- Light theme only for Phase 1; dark mode deferred (can be added later without major rework)
- Scaffold all Firestore collections up front (users, organizations, songs, services, tasks, events) — even if empty. Future phases populate them.
- Multi-tenant from day one: top-level `organizations` collection, all church data (songs, services, etc.) nested under the org ID. Users belong to one or more orgs.
- Strict security rules from day one: deny by default, only authenticated users with org membership can read/write their org's data
- `signInWithPopup` (not `signInWithRedirect`) — redirect is broken in Chrome M115+, Firefox 109+, Safari 16.1+
- Use `onSnapshot` directly in Pinia stores; do not use VueFire composables in stores
- Vue 3 + Firebase stack confirmed; non-negotiable constraints

### Claude's Discretion
- Exact color palette and typography choices within "clean & professional" direction
- Loading states and error handling patterns
- Sidebar nav items and iconography
- Getting started checklist step details and completion tracking implementation
- Firebase project configuration and environment setup

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in with Google OAuth | `signInWithPopup` + `GoogleAuthProvider`; Pinia auth store with `onAuthStateChanged`; Vue Router `beforeEach` guard with `getCurrentUser()` helper |
| AUTH-02 | User can sign in with email and password | `createUserWithEmailAndPassword` (auto-creates on first sign-in); `signInWithEmailAndPassword`; `sendPasswordResetEmail` for "Forgot password?" flow |
</phase_requirements>

---

## Summary

Phase 1 establishes the Firebase + Vue 3 project from scratch: scaffolding the app with Vite, wiring up Firebase Authentication (Google OAuth + email/password), building the Pinia auth store, protecting routes via Vue Router navigation guards, and laying out the Firestore data model with strict security rules.

The standard stack is well-established: `firebase` v12 (modular SDK), Vue 3 with `<script setup>`, Pinia for state, Vue Router 4, and Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no PostCSS config required). Firebase Local Emulator Suite handles all local development for both Auth and Firestore.

The critical architectural pitfall in this phase is the **auth-ready race condition**: on page refresh, `getAuth().currentUser` is `null` until `onAuthStateChanged` fires. The fix is wrapping `onAuthStateChanged` in a Promise (`getCurrentUser()`) and `await`-ing it in every route guard. Getting this wrong causes intermittent "flash to login" bugs that are hard to reproduce.

**Primary recommendation:** Build the Pinia `useAuthStore` first (with `isReady` flag), then wire the router guard to await it, then build UI. This order prevents the race condition from ever appearing.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` | 12.10.0 | Auth + Firestore SDK | Modular tree-shakeable API; latest stable as of 2026-02-27 |
| `vue` | 3.x (latest) | Frontend framework | Project constraint — non-negotiable |
| `pinia` | 2.x | State management | Official Vue 3 store; replaces Vuex |
| `vue-router` | 4.x | Client-side routing | Official Vue 3 router |
| `tailwindcss` | 4.x | Utility CSS | v4 Vite plugin eliminates PostCSS config |
| `@tailwindcss/vite` | 4.x | Vite integration | Required for Tailwind v4 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `firebase-tools` | 15.x | CLI — emulator, deploy | Local dev and CI/CD |
| `vitest` | 2.x | Unit testing | Included in `create-vue` scaffold |
| `@vitejs/plugin-vue` | latest | Vue SFC transform | Included in `create-vue` scaffold |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tailwindcss/vite` plugin | PostCSS config | PostCSS is the old approach; v4 plugin is faster and simpler |
| `signInWithPopup` | `signInWithRedirect` | Redirect is broken in Chrome M115+, Firefox 109+, Safari 16.1+ — locked decision |
| Pinia + `onSnapshot` directly | VueFire composables in stores | VueFire composables are designed for component `setup()` context; using them inside Pinia stores causes lifecycle issues — locked decision |

**Installation:**
```bash
# Scaffold project
npm create vue@latest worship-planner
# (select: TypeScript, Vue Router, Pinia, Vitest, ESLint, Prettier)

# Firebase
npm install firebase

# Tailwind v4
npm install tailwindcss @tailwindcss/vite

# Firebase CLI (globally)
npm install -g firebase-tools
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── firebase/
│   ├── index.ts         # initializeApp, getAuth, getFirestore exports
│   └── emulator.ts      # connectAuthEmulator / connectFirestoreEmulator (dev only)
├── stores/
│   ├── auth.ts          # useAuthStore — user, isReady, signIn/Out actions
│   └── (future stores per phase)
├── router/
│   └── index.ts         # createRouter + beforeEach guard
├── views/
│   ├── LoginView.vue    # Sign-in page (Google + email/password)
│   └── DashboardView.vue # Protected — app shell + getting started checklist
├── components/
│   ├── AppSidebar.vue   # Persistent sidebar, collapses to hamburger on mobile
│   ├── AppShell.vue     # Layout wrapper: sidebar + <router-view>
│   └── GettingStarted.vue # Checklist component for empty dashboard
├── assets/
│   └── main.css         # @import "tailwindcss"
└── main.ts              # createApp, pinia, router, mount
```

### Pattern 1: Firebase Initialization Module
**What:** Centralized `src/firebase/index.ts` exports app, auth, and db singletons. Emulator connections happen in a separate `emulator.ts` file imported conditionally.
**When to use:** Always — prevents re-initialization and keeps Firebase config in one place.
**Example:**
```typescript
// src/firebase/index.ts
// Source: https://firebase.google.com/docs/web/setup
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Connect to emulators in development
// Source: https://firebase.google.com/docs/emulator-suite/connect_firestore
if (import.meta.env.DEV) {
  const { connectAuthEmulator } = await import('firebase/auth')
  const { connectFirestoreEmulator } = await import('firebase/firestore')
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
```

Note: Use `import.meta.env.DEV` (Vite-specific), not `process.env.NODE_ENV`. Call `connectAuthEmulator` and `connectFirestoreEmulator` BEFORE any auth/Firestore operations.

### Pattern 2: Pinia Auth Store with `isReady` Flag
**What:** The auth store tracks the current user AND an `isReady` boolean that flips to `true` once `onAuthStateChanged` fires for the first time. The router guard awaits `isReady` before evaluating authentication.
**When to use:** Always — this is the fix for the race condition between Firebase async auth resolution and Vue Router synchronous guards.
**Example:**
```typescript
// src/stores/auth.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth } from '@/firebase'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isReady = ref(false)

  // One-time listener: resolves auth state on app boot
  const _unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    user.value = firebaseUser
    isReady.value = true
  })

  const isAuthenticated = computed(() => !!user.value)

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    // onAuthStateChanged will update user automatically
    return result.user
  }

  async function loginWithEmail(email: string, password: string) {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return result.user
  }

  async function registerWithEmail(email: string, password: string) {
    // Auto-creates account on first sign-in (locked decision)
    const result = await createUserWithEmailAndPassword(auth, email, password)
    return result.user
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  async function logout() {
    await signOut(auth)
  }

  return { user, isReady, isAuthenticated, loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, logout }
})
```

### Pattern 3: Router Navigation Guard — `getCurrentUser()` Helper
**What:** The `beforeEach` guard awaits a Promise that resolves once `onAuthStateChanged` fires, guaranteeing the user state is known before any redirect decision is made.
**When to use:** As the single global guard on the router instance.
**Example:**
```typescript
// src/router/index.ts
// Source: https://gaute.dev/dev-blog/vue-router-firebase-auth
import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'

function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe()  // listen only once — critical
        resolve(user)
      },
      reject
    )
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('@/views/LoginView.vue') },
    {
      path: '/',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    // Additional protected routes: all use meta: { requiresAuth: true }
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth && !(await getCurrentUser())) {
    return '/login'
  }
})

export default router
```

### Pattern 4: Firestore Data Model — Multi-Tenant from Day One
**What:** Top-level `organizations` collection owns all church data. Users have a subcollection in the org document that tracks membership. All other collections (songs, services, etc.) are subcollections under `organizations/{orgId}`.
**When to use:** From Phase 1 — scaffold all collections even if empty. Future phases populate them.

**Firestore collection layout:**
```
/users/{uid}
  - email: string
  - displayName: string
  - photoURL: string
  - orgIds: string[]        # list of org IDs user belongs to (for client-side queries)
  - createdAt: Timestamp

/organizations/{orgId}
  - name: string            # e.g. "First Baptist Worship"
  - createdAt: Timestamp
  - createdBy: string       # uid
  /members/{uid}            # subcollection: membership documents
    - role: "admin" | "planner"
    - joinedAt: Timestamp
  /songs/{songId}           # Phase 2 populates
  /services/{serviceId}     # Phase 3 populates
  /tasks/{taskId}           # Phase 5 populates
  /events/{eventId}         # Phase 5 populates
```

**Why this structure:**
- Security rules can use `exists(/organizations/{orgId}/members/{request.auth.uid})` — a single read per rule evaluation, cached on repeated calls
- No N+1 fan-out: to check "is this user a member?" the rule reads ONE document
- `users/{uid}.orgIds` is a client-side convenience field for listing orgs without querying all organizations

### Pattern 5: Firestore Security Rules — Deny by Default + Org Membership
**What:** Rules explicitly deny everything except what is granted. Org membership check uses `exists()` on the members subcollection.
**When to use:** Apply from day one — retrofitting security rules later is error-prone.
**Example:**
```
// firestore.rules
// Source: https://firebase.google.com/docs/firestore/security/rules-conditions
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOrgMember(orgId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
    }

    function isOrgAdmin(orgId) {
      return isSignedIn() &&
        get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role == 'admin';
    }

    // Users can only read/write their own profile
    match /users/{uid} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }

    // Organizations: only members can read; only admins can update org doc
    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId);

      // Members subcollection
      match /members/{uid} {
        allow read: if isOrgMember(orgId);
        allow write: if isOrgAdmin(orgId);
      }

      // All nested collections (songs, services, tasks, events) — Phase 2+ populates
      match /{collection}/{docId} {
        allow read: if isOrgMember(orgId);
        allow write: if isOrgMember(orgId);
      }
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Note: `exists()` is cheaper than `get()` — use it for membership checks since you only need a boolean. `get()` is needed only when you must read the document's data (e.g., checking role).

### Anti-Patterns to Avoid
- **Using `getAuth().currentUser` directly in router guards:** This is `null` on page refresh until `onAuthStateChanged` resolves. Always use the `getCurrentUser()` Promise wrapper.
- **Initializing Firebase multiple times:** Only call `initializeApp()` once. Export the singleton from `src/firebase/index.ts`.
- **Calling `connectFirestoreEmulator()` after any Firestore operation:** Must be called before the first read/write. Do it at module initialization time.
- **Using `signInWithRedirect`:** Broken in Chrome M115+, Firefox 109+, Safari 16.1+. Use `signInWithPopup` (locked decision).
- **VueFire composables inside Pinia store actions:** VueFire's `useCollection` / `useDocument` are Vue composables that depend on component lifecycle context. They cannot be called from Pinia store setup functions safely (locked decision: use `onSnapshot` directly).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google OAuth flow | Custom OAuth redirect/callback | `signInWithPopup(auth, new GoogleAuthProvider())` | Handles PKCE, token refresh, cross-origin, popup lifetime |
| Password reset emails | Custom email service | `sendPasswordResetEmail(auth, email)` | Firebase manages templates, delivery, expiry |
| Email/password account creation | Custom user table | `createUserWithEmailAndPassword` | Handles hashing, uniqueness, rate limiting |
| Auth state persistence | LocalStorage/cookie management | Firebase Auth SDK (`onAuthStateChanged`) | Manages token refresh, expiry, secure storage |
| Firestore security | Application-layer auth checks | Firestore Security Rules | Rules run server-side; app-layer checks are not the security boundary |
| Real-time user session sync | WebSocket/polling | `onAuthStateChanged` listener | Firebase handles this natively |

**Key insight:** Firebase Auth handles the entire authentication lifecycle. The only code you write is calling functions and listening to state. Building custom alternatives introduces security bugs and maintenance burden.

---

## Common Pitfalls

### Pitfall 1: Auth-Ready Race Condition
**What goes wrong:** On page refresh, `getAuth().currentUser` returns `null` even for authenticated users. A router guard checking `currentUser` directly redirects the user to `/login` on every refresh.
**Why it happens:** Firebase Auth resolves auth state asynchronously (reads from localStorage/IndexedDB). The router guard runs synchronously before this resolution completes.
**How to avoid:** Use the `getCurrentUser()` Promise wrapper that wraps `onAuthStateChanged` and resolves after the first auth state emission.
**Warning signs:** "Logged-out users get flashed to login briefly then redirected back" or "authenticated users always get sent to /login on refresh."

### Pitfall 2: Firestore Emulator Port Conflict with Vite
**What goes wrong:** Vite's dev server and Firestore emulator both try to use port 8080. One of them fails to start.
**Why it happens:** The Firestore emulator defaults to port 8080. Vite also defaults to 8080 when its default port 5173 is taken.
**How to avoid:** Start `firebase emulators:start` before `npm run dev`. If conflict persists, change the Firestore emulator port in `firebase.json` to 8081 and update `connectFirestoreEmulator(db, '127.0.0.1', 8081)`.
**Warning signs:** `EADDRINUSE` errors on startup.

### Pitfall 3: `connectAuthEmulator` / `connectFirestoreEmulator` After First Operation
**What goes wrong:** Calling the connect functions after any Firestore or Auth operation has already been made silently fails or throws.
**Why it happens:** Firebase SDKs establish connections lazily on first use; the emulator override must happen before that.
**How to avoid:** Call both `connectAuthEmulator` and `connectFirestoreEmulator` at module load time in `src/firebase/index.ts`, guarded by `import.meta.env.DEV`.
**Warning signs:** App talks to production Firestore during local development; `firebase-tools` CLI shows no connections from the app.

### Pitfall 4: Security Rules That Allow Too Much
**What goes wrong:** A wildcard rule like `allow read, write: if request.auth != null` is added "temporarily" and never tightened. Any authenticated user can read any org's data.
**Why it happens:** Developers reach for the simplest working rule to get past a 403 during development.
**How to avoid:** Write the deny-by-default + org membership rules in Wave 0. Test with the emulator: verify a user in org A cannot read org B's data.
**Warning signs:** Security rules test suite passes with only one org; cross-org access is never tested.

### Pitfall 5: Forgetting `signOut` Cleanup for `onSnapshot` Listeners
**What goes wrong:** After sign-out, active `onSnapshot` listeners from the Pinia store fire against Firestore with the now-invalid auth token, causing "permission denied" console errors (or worse, state leaking between sessions).
**Why it happens:** `onSnapshot` listeners started by the signed-in user continue after `signOut()` is called.
**How to avoid:** Store the unsubscribe function returned by `onSnapshot()` in the Pinia store state. Call all unsubscribers in the `logout()` action before calling `signOut(auth)`.
**Warning signs:** Console shows Firestore permission errors immediately after logout.

### Pitfall 6: Email/Password "Registration" UX
**What goes wrong:** Calling `createUserWithEmailAndPassword` when the user tries to "sign in" with a new email (or vice versa) leads to confusing "email already in use" / "no user found" errors displayed to the user.
**Why it happens:** Firebase has separate functions for create and sign-in. The "auto-create on first sign-in" UX requires the app to catch `auth/user-not-found` and then call `createUserWithEmailAndPassword`.
**How to avoid:** Implement email sign-in as: try `signInWithEmailAndPassword`; if `auth/user-not-found`, call `createUserWithEmailAndPassword`. Display clear error messages for `auth/wrong-password`.
**Warning signs:** Users reporting "I created an account but can't log in" errors.

---

## Code Examples

Verified patterns from official sources and documented community patterns.

### Google Sign-In (signInWithPopup)
```typescript
// Source: https://firebase.google.com/docs/auth/web/start
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

const auth = getAuth()
const provider = new GoogleAuthProvider()

async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider)
    return result.user  // User object available immediately
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      // User dismissed the popup — not an error, just return null
      return null
    }
    throw error
  }
}
```

### Email Sign-In with Auto-Create
```typescript
// Pattern: try sign in, create account if user doesn't exist
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'

async function signInWithEmail(auth: Auth, email: string, password: string) {
  try {
    return await signInWithEmailAndPassword(auth, email, password)
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return await createUserWithEmailAndPassword(auth, email, password)
    }
    throw error
  }
}
```

### onSnapshot in Pinia Store with Cleanup
```typescript
// Pattern: store unsubscribe, call in logout
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/firebase'
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore'

export const useOrgStore = defineStore('org', () => {
  const _listeners: Unsubscribe[] = []

  function startListening(orgId: string) {
    const unsub = onSnapshot(
      collection(db, 'organizations', orgId, 'songs'),
      (snapshot) => {
        // update reactive state
      }
    )
    _listeners.push(unsub)
  }

  function cleanup() {
    _listeners.forEach(unsub => unsub())
    _listeners.length = 0
  }

  return { startListening, cleanup }
})
```

### Tailwind CSS v4 + Vite Setup
```typescript
// vite.config.ts
// Source: https://tailwindcss.com/docs/guides/vite
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
})
```

```css
/* src/assets/main.css */
@import "tailwindcss";
```

### Firebase Emulator Connection (Vite env)
```typescript
// Source: https://firebase.google.com/docs/emulator-suite/connect_firestore
// Use import.meta.env.DEV (Vite's built-in), not process.env.NODE_ENV
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
```

### firebase.json for Emulator Suite
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `firebase/compat` namespace API | Modular tree-shakeable imports from `firebase/auth`, `firebase/firestore` | Firebase v9 (2021) | Smaller bundles; different import style |
| `signInWithRedirect` | `signInWithPopup` | Chrome M115 / mid-2023 | Redirect broken in major browsers due to 3rd-party cookie restrictions |
| PostCSS config for Tailwind | `@tailwindcss/vite` plugin (no PostCSS needed) | Tailwind v4 (2025) | Simpler setup; faster builds |
| VueFire 2.x (Vue 2) | VueFire 3.x (Vue 3) with modular Firebase | 2022-2023 | VueFire composables for components; direct `onSnapshot` for stores |
| `vue.config.js` + Vue CLI | `vite.config.ts` + `create-vue` | 2021-present | Vite is now the official Vue toolchain |
| `process.env.NODE_ENV` | `import.meta.env.DEV` / `import.meta.env.VITE_*` | Vite adoption | Vite uses ES module env vars; `process.env` not available by default |

**Deprecated/outdated:**
- `firebase/compat/*` imports: marked as temporary bridge; will be removed in a future major version. Do not use for new projects.
- `Vue CLI` / `vue.config.js`: replaced by Vite + `create-vue`. Do not scaffold with `@vue/cli`.
- Tailwind v3 `tailwind.config.js` + `postcss.config.js`: v4 eliminates both files when using the Vite plugin.

---

## Open Questions

1. **Firebase project already created or new?**
   - What we know: Stack is confirmed (Firebase), but no `firebase.json` exists in the repo yet.
   - What's unclear: Whether a Firebase project has been created in the Firebase Console, and what the `VITE_FIREBASE_*` env var values are.
   - Recommendation: Wave 0 task should include "Create Firebase project and add `.env.local` with credentials." Document that `.env.local` is git-ignored and provide a `.env.local.example` template.

2. **How does a new church org get created?**
   - What we know: The data model requires an `organizations/{orgId}` document and a `members/{uid}` subdocument before any protected routes work.
   - What's unclear: Phase 1 success criteria only requires sign-in. The org provisioning flow (who creates the org, when) is not specified.
   - Recommendation: For Phase 1, auto-create a default organization for each new user on first sign-in (a Cloud Firestore write in the auth store after login). This unblocks Phase 2+ without needing an org-creation UI. Document this as a simplification to be revisited in Phase 5 (collaboration).

3. **Getting started checklist completion tracking — Firestore or localStorage?**
   - What we know: Checklist tracks steps like "Import songs, Set up first service." These correspond to actions in future phases.
   - What's unclear: Whether completion state lives in Firestore (survives device changes) or localStorage (simpler, no write cost).
   - Recommendation: Firestore. Store in `users/{uid}` as a `onboardingSteps` map. This is consistent with the multi-device use case (worship planners use laptops + tablets) and costs negligible reads.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (bundled with `create-vue` scaffold) |
| Config file | `vitest.config.ts` (generated by `create-vue`) |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Google OAuth initiates `signInWithPopup` with `GoogleAuthProvider` | unit | `npx vitest run src/stores/auth.test.ts -t "loginWithGoogle"` | ❌ Wave 0 |
| AUTH-01 | Authenticated user stays authenticated across page refreshes | unit | `npx vitest run src/stores/auth.test.ts -t "isReady"` | ❌ Wave 0 |
| AUTH-01 | Unauthenticated user redirected to `/login` by router guard | unit | `npx vitest run src/router/router.test.ts -t "requiresAuth"` | ❌ Wave 0 |
| AUTH-02 | Email + password sign-in calls `signInWithEmailAndPassword` | unit | `npx vitest run src/stores/auth.test.ts -t "loginWithEmail"` | ❌ Wave 0 |
| AUTH-02 | New email auto-creates account via `createUserWithEmailAndPassword` | unit | `npx vitest run src/stores/auth.test.ts -t "registerWithEmail"` | ❌ Wave 0 |
| AUTH-02 | "Forgot password?" calls `sendPasswordResetEmail` | unit | `npx vitest run src/stores/auth.test.ts -t "resetPassword"` | ❌ Wave 0 |
| (infra) | Firestore rules: unauthenticated caller cannot read org data | manual / emulator | `firebase emulators:exec "npx vitest run src/rules.test.ts"` | ❌ Wave 0 |
| (infra) | Firestore rules: org member can read their org; cannot read another org | manual / emulator | same as above | ❌ Wave 0 |

Note: Firebase emulator rule tests use `@firebase/rules-unit-testing`. This is a separate test file from component/store tests. It runs against the local emulator.

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual browser smoke test (sign in with Google, sign in with email, refresh stays signed in, unauthenticated access redirects)

### Wave 0 Gaps
- [ ] `src/stores/auth.test.ts` — unit tests for auth store actions (covers AUTH-01, AUTH-02); mock `firebase/auth` with `vi.mock`
- [ ] `src/router/router.test.ts` — navigation guard tests; mock `getCurrentUser()` helper
- [ ] `src/rules.test.ts` — Firestore security rules tests using `@firebase/rules-unit-testing` against local emulator
- [ ] `vitest.config.ts` — generated by `create-vue`; verify it exists after scaffold
- [ ] Framework install: included in `create-vue` scaffold — no additional install needed

---

## Sources

### Primary (HIGH confidence)
- [Firebase Auth Web Setup](https://firebase.google.com/docs/auth/web/start) — Auth function signatures, modular SDK syntax
- [Firebase JS SDK Release Notes](https://firebase.google.com/support/release-notes/js) — Confirmed v12.10.0 as latest (2026-02-27)
- [Connect Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore) — `connectFirestoreEmulator` API
- [Connect Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth) — `connectAuthEmulator` API
- [Firestore Security Rules Conditions](https://firebase.google.com/docs/firestore/security/rules-conditions) — `exists()`, `get()` patterns
- [Tailwind CSS Vite Guide](https://tailwindcss.com/docs/guides/vite) — v4 Vite plugin installation steps
- [Vue Router Navigation Guards](https://router.vuejs.org/guide/advanced/navigation-guards.html) — `beforeEach` async pattern

### Secondary (MEDIUM confidence)
- [gaute.dev: Vue Router + Firebase Auth](https://gaute.dev/dev-blog/vue-router-firebase-auth) — `getCurrentUser()` Promise wrapper pattern (verified against Firebase onAuthStateChanged docs)
- [Pinia Testing Docs](https://pinia.vuejs.org/cookbook/testing.html) — `setActivePinia(createPinia())` pattern for store unit tests
- [makerkit.dev: Firestore Security Rules Guide](https://makerkit.dev/blog/tutorials/in-depth-guide-firestore-security-rules) — org membership check pattern using `exists()`
- [create-vue GitHub](https://github.com/vuejs/create-vue) — scaffold command and included options (TypeScript, Router, Pinia, Vitest)

### Tertiary (LOW confidence)
- WebSearch findings about Pinia + Firebase community patterns — multiple sources agree but not verified against single authoritative doc

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against official release notes and npmjs
- Architecture: HIGH — patterns derived from Firebase official docs and well-established Vue 3 community patterns
- Firestore security rules: HIGH — pattern verified against official Firebase rules documentation
- Tailwind v4 setup: HIGH — verified directly from official tailwindcss.com docs
- Pitfalls: HIGH — `signInWithRedirect` breakage is a known documented issue (confirmed in STATE.md); race condition is documented in Firebase/Vue community extensively

**Research date:** 2026-03-03
**Valid until:** 2026-06-03 (90 days — Firebase SDK versions update frequently; check npm before installing)
