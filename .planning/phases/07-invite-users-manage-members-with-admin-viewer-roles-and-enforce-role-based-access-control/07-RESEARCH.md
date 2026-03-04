# Phase 7: Invite Users, Manage Members, and Enforce RBAC - Research

**Researched:** 2026-03-04
**Domain:** Firestore RBAC, invite flow, Pinia auth store enrichment, Vue Router role guards, Vue UI composition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Invitation flow:**
- Editor invites by entering an email address — system creates an invite record in Firestore
- Role (editor or viewer) is selected at invite time — no default-then-upgrade flow
- No email is sent — the editor tells the person verbally to sign up; the app matches them by email on sign-in
- When the invited person signs in (Google or email/password), if their email matches a pending invite, they auto-join the org with the assigned role — no accept/decline prompt
- Pending invites appear in the member table with a "Pending" status badge

**Role model — Firebase-style Editor/Viewer:**
- Two roles: **Editor** and **Viewer**
- Editor: full CRUD access to all features (songs, services, AI, print/share/export) plus team management (invite, change roles, remove members). Any Editor can manage the team — no special "owner" concept
- Viewer: can ONLY access the Services list and view individual service plan details — read-only. No access to Song Library, Rotation tables, Dashboard, or any other pages
- The org creator's initial role is Editor (replaces the current 'admin' role in the members subcollection)

**Viewer UI treatment:**
- Viewers only see the Services nav link in the sidebar — Dashboard, Songs, and Team links are hidden
- Within the services list and service detail view, all edit controls are hidden (no Add/Edit/Delete buttons, no save, no AI suggest)
- Viewers CAN use read-oriented output actions on services they're viewing: print, share links, export
- No disabled/grayed buttons — clean experience showing only what they can access

**Member management UI:**
- New "Team" sidebar nav link alongside Dashboard, Songs, Services — dedicated /team route (visible only to Editors)
- Simple table layout for member list: name, email, role badge (Editor/Viewer), joined date, and actions (change role, remove)
- Inline invite form at top of page: email input + role dropdown + "Invite" button, right above the member table
- Editor can change a member's role (editor/viewer toggle) AND remove them entirely
- Removed users lose access but can be re-invited

**Onboarding for invited users:**
- Invited users skip the auto-create-org flow — they join the invited org directly instead of creating an orphan org
- The GettingStarted checklist adapts for viewers: shows relevant steps like "View upcoming services" instead of editor steps like "Import songs" or "Invite team"
- Organization name displayed at the top of the sidebar (e.g., "Grace Community Church") — makes the workspace identity clear

### Claude's Discretion
- How to centralize orgId and userRole in the auth store (currently fetched ad-hoc in each view)
- Firestore invite document schema and collection structure
- Exact Firestore security rules updates — editors get full CRUD, viewers get read on services only
- How to handle edge cases: last editor can't remove themselves, invite for email already a member, etc.
- Member table action button styling and confirmation dialogs
- Router guard implementation for role-based route access (viewers blocked from /songs, /dashboard, /team)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 7 adds multi-user collaboration to WorshipPlanner: an invite-by-email system backed by Firestore, two roles (Editor/Viewer), and enforcement of those roles at the Firestore rules layer, router guard layer, and UI layer. The implementation touches six interconnected areas: auth store enrichment, Firestore invite collection, `ensureUserDocument` invite-matching logic, Firestore security rules rewrite, router guard role awareness, and UI gating in sidebar/views/components.

The overall approach leverages deeply established project patterns: Firestore-based data (no backend functions), Pinia stores with `onSnapshot`, the existing `isOrgAdmin` / `isOrgMember` Firestore helper function pattern, and the SongTable-style table UI. The key new concept is a top-level `invites` subcollection under `organizations/{orgId}` — keyed by invitee email — that `ensureUserDocument` queries at sign-in time via an email-indexed lookup.

The most important architectural decision is centralizing `orgId`, `userRole`, and `isEditor` into the auth store. Every other change in this phase — router guards, sidebar conditional rendering, view UI toggling, GettingStarted adaptation — depends on these three values being reactively available in a single place.

**Primary recommendation:** Enrich the auth store first (Wave 1), then implement the invite/member Firestore layer (Wave 2), then apply UI enforcement (Wave 3). This sequencing ensures each layer has its dependency before it's needed.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firebase Firestore | ^12.0.0 | Invite doc storage, member management, RBAC rules | Project uses Firebase exclusively; no alternatives |
| Pinia | ^3.0.4 | Auth store enrichment (orgId, userRole, isEditor) | Established store pattern throughout project |
| Vue Router | ^5.0.3 | Role-aware route guards, /team route | Established project router |
| Vue 3 | ^3.5.29 | Component conditional rendering (`v-if isEditor`) | Project framework |
| @firebase/rules-unit-testing | ^5.0.0 | Emulator-based Firestore rules tests | Already in project devDeps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| firebase/firestore query() | ^12.0.0 | Email-indexed invite lookup at sign-in | Finding pending invite for a given email |
| writeBatch | ^12.0.0 | Atomic member join (delete invite + set member + update user) | Invite acceptance must be atomic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Top-level invites subcollection | invites as root collection | Subcollection under org keeps data co-located and rules simpler |
| Email-keyed invite doc | Random ID + email index | Email as doc ID allows O(1) lookup at sign-in with no query |
| Centralized auth store | Per-view getDoc calls | Per-view calls = N reads per page load; store = 1 read on auth |

**Installation:** No new packages needed. All required libraries are already in the project.

---

## Architecture Patterns

### Recommended Project Structure — New Files

```
src/
├── stores/
│   └── auth.ts               # Enrich with orgId, userRole, isEditor, orgName
├── views/
│   └── TeamView.vue          # New /team route — member table + invite form
├── components/
│   └── MemberTable.vue       # Table component (mirrors SongTable pattern)
```

Firestore shape (new):
```
organizations/{orgId}/
  invites/{inviteeEmail}/     # Doc ID = email (lowercase), enables O(1) lookup
    role: 'editor' | 'viewer'
    invitedBy: uid
    invitedAt: Timestamp
    status: 'pending'         # Always 'pending' while unaccepted
  members/{uid}/
    role: 'editor' | 'viewer' # 'admin' replaced by 'editor'
    joinedAt: Timestamp
    displayName: string       # Denormalized for member table display
    email: string             # Denormalized for member table display
```

### Pattern 1: Auth Store Enrichment — Reactive orgId/userRole/isEditor

**What:** On auth state change (after `ensureUserDocument` runs), load `users/{uid}` to get `orgIds[0]`, then `onSnapshot` the member doc to get live `role`. Expose `orgId`, `userRole`, `isEditor`, `orgName` as store state.

**When to use:** All views, components, and router guards — they read from `authStore.isEditor` / `authStore.orgId` directly.

**Why onSnapshot for role (not getDoc):** If an Editor changes another member's role, that member's reactive `userRole` updates immediately without requiring re-login. This is consistent with the project's established `onSnapshot` pattern in song/service stores.

```typescript
// Source: established pattern in stores/songs.ts and stores/services.ts
// In auth store, after ensureUserDocument resolves:
const orgId = ref<string | null>(null)
const userRole = ref<'editor' | 'viewer' | null>(null)
const orgName = ref<string | null>(null)
const isEditor = computed(() => userRole.value === 'editor')

let memberUnsub: Unsubscribe | null = null

async function loadOrgContext(uid: string): Promise<void> {
  const userSnap = await getDoc(doc(db, 'users', uid))
  const ids: string[] = userSnap.data()?.orgIds ?? []
  if (!ids[0]) return
  orgId.value = ids[0]

  // Load org name
  const orgSnap = await getDoc(doc(db, 'organizations', ids[0]))
  orgName.value = orgSnap.data()?.name ?? null

  // Live role subscription
  memberUnsub?.()
  memberUnsub = onSnapshot(
    doc(db, 'organizations', ids[0], 'members', uid),
    (snap) => { userRole.value = snap.exists() ? snap.data().role : null }
  )
}
```

### Pattern 2: Email-Keyed Invite Doc — O(1) Lookup at Sign-In

**What:** Invite document ID is `inviteeEmail.toLowerCase()` — no query required at sign-in, just a single `getDoc`.

**When to use:** Inside `ensureUserDocument` at sign-in time, before the new-org creation branch.

```typescript
// In ensureUserDocument, before the hasOrg check:
// Check for pending invites across all orgs (requires invite doc at known path)
// Strategy: store invite under organizations/{orgId}/invites/{email}
// But we don't know orgId at sign-in time without a query.
// SOLUTION: Also store a root-level lookup: inviteLookup/{email} => { orgId, role }
// This allows O(1) lookup without scanning all orgs.
```

**Important:** Because the user doesn't know which orgId to query at sign-in, a thin root-level lookup doc is needed:

```
inviteLookup/{normalizedEmail}/
  orgId: string
  role: 'editor' | 'viewer'
  invitedAt: Timestamp
```

When the invite is created, write to BOTH `organizations/{orgId}/invites/{email}` (for the Team page display) AND `inviteLookup/{email}` (for sign-in lookup). When accepted, delete both.

**Alternative that avoids the dual-write:** Query all organizations where the user's email has a pending invite. This requires a collection-group query on `invites` with `where('email', '==', ...)`. However, collection-group queries require a Firestore index and security rule `match /{path=**}/invites/{email}`. The dual-write approach is simpler and avoids index setup.

**Recommended:** Use `inviteLookup/{normalizedEmail}` as the sign-in lookup. Simpler rules, no index, matches the `shareTokens` collection pattern already in the project.

### Pattern 3: Router Guard Role Enforcement

**What:** Extend the existing `beforeEach` guard to check `authStore.isEditor` for editor-only routes.

**When to use:** Routes `/` (dashboard), `/songs`, `/team` — redirect viewers to `/services`.

```typescript
// Source: established pattern in router/index.ts
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const user = await getCurrentUser()
    if (!user) return { name: 'login' }
  }
  if (to.meta.requiresEditor) {
    // authStore must be initialized — use a ready-check
    const authStore = useAuthStore()
    if (!authStore.isEditor) return { name: 'services' }
  }
  // ... existing login redirect logic
})
```

**Timing concern:** The router guard runs before Vue mounts, so `authStore.isReady` and `authStore.userRole` might not be populated yet. The solution is to await the auth store's ready state in the guard, similar to how `getCurrentUser()` already awaits the Firebase auth state.

Add `waitForRole()` helper to auth store:
```typescript
function waitForRole(): Promise<void> {
  return new Promise((resolve) => {
    if (userRole.value !== null || !isAuthenticated.value) { resolve(); return }
    const unwatch = watch(userRole, () => { unwatch(); resolve() }, { immediate: true })
  })
}
```

### Pattern 4: Atomic Invite Acceptance in `ensureUserDocument`

**What:** When a pending invite is found at sign-in, use `writeBatch` to atomically:
1. Delete `inviteLookup/{email}`
2. Delete `organizations/{orgId}/invites/{email}`
3. Set `organizations/{orgId}/members/{uid}` with role + denormalized display info
4. Update `users/{uid}.orgIds` to include the orgId

**Why atomic:** Partial failure would leave the user in a broken state (e.g., invite deleted but member doc not created).

```typescript
// In ensureUserDocument, before the hasOrg creation branch:
const email = firebaseUser.email?.toLowerCase()
if (email) {
  const lookupSnap = await getDoc(doc(db, 'inviteLookup', email))
  if (lookupSnap.exists()) {
    const { orgId: inviteOrgId, role } = lookupSnap.data()
    const batch = writeBatch(db)
    batch.delete(doc(db, 'inviteLookup', email))
    batch.delete(doc(db, 'organizations', inviteOrgId, 'invites', email))
    batch.set(doc(db, 'organizations', inviteOrgId, 'members', firebaseUser.uid), {
      role,
      joinedAt: serverTimestamp(),
      displayName: firebaseUser.displayName ?? '',
      email: firebaseUser.email ?? '',
    })
    batch.update(userRef, { orgIds: [inviteOrgId] })
    await batch.commit()
    return  // Skip new-org creation
  }
}
// Existing new-org creation logic follows...
```

### Pattern 5: Firestore Security Rules — Editor/Viewer Split

**What:** Replace the wildcard write rule that allows all members to write with a role-based split: editors get full CRUD, viewers get read-only on services and service-related subcollections only.

**Current problematic rule:**
```
match /{collection}/{docId} {
  allow read, write: if isOrgMember(orgId);  // Viewers could write!
}
```

**New rules structure:**

```javascript
function isOrgEditor(orgId) {
  return isSignedIn() &&
    get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role == 'editor';
}

function isOrgViewer(orgId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role == 'viewer';
}

match /organizations/{orgId} {
  allow read: if isOrgMember(orgId);
  allow write: if isOrgEditor(orgId);
  allow create: if isSignedIn() && request.resource.data.createdBy == request.auth.uid;

  match /members/{uid} {
    allow read: if isOrgMember(orgId);
    allow write: if isOrgEditor(orgId);
    allow create: if isSignedIn() && request.auth.uid == uid;
  }

  match /invites/{email} {
    allow read: if isOrgEditor(orgId);      // Only editors see invite list
    allow write: if isOrgEditor(orgId);     // Only editors create invites
    allow delete: if isOrgEditor(orgId) || request.auth.token.email == email;
  }

  match /services/{docId} {
    allow read: if isOrgMember(orgId);      // Viewers can read services
    allow write: if isOrgEditor(orgId);     // Only editors write
  }

  match /services/{serviceId}/{subcoll}/{subId} {
    allow read: if isOrgMember(orgId);
    allow write: if isOrgEditor(orgId);
  }

  // Songs, tasks, etc. — editors only
  match /{collection}/{docId} {
    allow read: if isOrgEditor(orgId);
    allow write: if isOrgEditor(orgId);
  }
}

// inviteLookup — public write for batch acceptance, protected read
match /inviteLookup/{email} {
  allow read: if isSignedIn() && request.auth.token.email == email;
  allow create: if isSignedIn();           // Editors create via batch
  allow delete: if isSignedIn() && request.auth.token.email == email;
}
```

**Note on `isOrgMember`:** Keep the existing function as a helper. It only checks existence, not role. Use `isOrgEditor` for write rules.

### Anti-Patterns to Avoid

- **Storing role only in auth store (not Firestore rules):** The UI is gating, but Firestore rules MUST enforce — a motivated viewer could call Firestore SDK directly from browser console.
- **Querying invites by email at sign-in with a collection-group query:** Requires configuring a Firestore index and more complex rules. The `inviteLookup` lookup doc is faster and simpler.
- **Blocking viewers with `display:none` only:** Use `v-if` (DOM removal), not `v-show` (CSS hide). This prevents screen reader / dev tools inspection.
- **Creating a new org for an invited user before checking invites:** The invite check MUST happen before the `hasOrg` branch in `ensureUserDocument`. Current code checks `hasOrg` and creates org if false — invited users have no org yet, so they'd incorrectly get a new one.
- **Using `isOrgAdmin` for the new rules:** The 'admin' role is being replaced by 'editor'. All existing member docs with `role: 'admin'` must be migrated to `role: 'editor'`, OR the rules must temporarily accept both. Safer to migrate the existing creator's member doc at startup (one-time migration in `ensureUserDocument`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-doc write on invite acceptance | Sequential individual writes | `writeBatch` | Partial failure leaves broken state |
| Role enforcement at data layer | Client-side check only | Firestore security rules | Client can be bypassed; rules are server-enforced |
| Email normalization | Custom casing logic | `.toLowerCase()` before all email comparisons and doc IDs | Firestore doc IDs are case-sensitive; inconsistent casing breaks lookup |
| Invite doc ID generation | UUID or random ID | Email as doc ID | Enables O(1) getDoc without query at sign-in |
| Role reactivity | Polling or re-login | `onSnapshot` on member doc | Instant role change reflection without page reload |

**Key insight:** The invite flow's power comes from using email as the doc ID — it eliminates the need for any Firestore query at sign-in, keeping the auth flow fast and the rules simple.

---

## Common Pitfalls

### Pitfall 1: Org Creator Still Has 'admin' Role in members Subcollection

**What goes wrong:** Existing creator member docs have `role: 'admin'`. New Firestore rules check for `role == 'editor'`. The creator loses all write access after the rules deploy.

**Why it happens:** The role rename from admin → editor is a breaking schema change. Existing data is not auto-migrated.

**How to avoid:** In `ensureUserDocument`, after fetching the member doc, check if role is 'admin' and update it to 'editor'. This is a lazy migration that runs once per existing user on next sign-in. Alternatively, deploy rules that accept BOTH 'admin' and 'editor' during a brief transition window, then migrate.

**Recommended approach:**
```typescript
// In ensureUserDocument, after setting member doc on org creation:
// AND when loading existing member doc:
if (memberData?.role === 'admin') {
  await updateDoc(memberRef, { role: 'editor' })
}
```

**Warning signs:** After Phase 7 deploy, existing users report "permission denied" on song saves or service edits.

### Pitfall 2: Router Guard Reads Stale Role Before Auth Store Loads

**What goes wrong:** User navigates to `/` immediately after sign-in. The router guard checks `authStore.isEditor` before `loadOrgContext` has resolved. `userRole` is `null`, `isEditor` is `false`, viewer is redirected to `/services` even if they're an editor.

**Why it happens:** Auth store loads asynchronously (Firebase auth state, then getDoc for user, then onSnapshot for member). The router guard fires synchronously.

**How to avoid:** Add a `waitForRole()` promise to the auth store that resolves once `userRole` is non-null (or auth is confirmed not authenticated). The router guard awaits this before checking role.

**Warning signs:** Editors are incorrectly redirected to `/services` on first load.

### Pitfall 3: Invite Email Case Mismatch

**What goes wrong:** Editor invites `John@example.com`. John signs in with Google which reports `john@example.com`. `getDoc(doc(db, 'inviteLookup', 'John@example.com'))` misses the doc.

**Why it happens:** Firestore doc IDs are case-sensitive. Email is typed by a human and returned by OAuth providers in lowercase.

**How to avoid:** Normalize ALL email values to `.toLowerCase()` before using as Firestore doc IDs and before all comparisons. Apply normalization at invite creation AND at sign-in lookup.

**Warning signs:** Invites not being matched despite the invited user signing in with the correct email address.

### Pitfall 4: Last Editor Removing Themselves

**What goes wrong:** The last editor removes themselves from the org. No one can invite new members or recover the org.

**Why it happens:** No "last editor" guard on the remove action.

**How to avoid:** Before executing a remove member write, count current editors. If current count === 1 and the target is the current user, show an error and block the action. This check happens client-side (fast UX) backed by a Firestore rule (enforced check):

```typescript
// Client-side guard
const editorCount = members.value.filter(m => m.role === 'editor').length
if (editorCount === 1 && targetUid === authStore.user?.uid) {
  // Show error: "You are the only editor. Transfer editor role before removing yourself."
  return
}
```

**Warning signs:** Org becomes inaccessible because no editors remain.

### Pitfall 5: Inviting an Existing Member

**What goes wrong:** Editor invites an email that already belongs to an active member. The invite is created and the invite table shows "Pending" for someone already in the org.

**Why it happens:** No validation against existing members before writing the invite doc.

**How to avoid:** Before creating the invite, check if any existing member has a matching email. Members have denormalized `email` field in their docs — query or filter the in-memory member list.

**Warning signs:** Duplicate "pending" entry for an existing member.

### Pitfall 6: Viewer Accessing Services Store Data via Browser Console

**What goes wrong:** A clever viewer inspects the Firestore SDK in browser console and reads song or dashboard data directly.

**Why it happens:** Without Firestore rules enforcement, client-side `v-if` is cosmetic only.

**How to avoid:** Firestore security rules are the enforcement layer. The rule `allow read: if isOrgEditor(orgId)` on the `/{collection}/{docId}` catch-all prevents viewers from reading songs, regardless of UI state.

---

## Code Examples

Verified patterns from existing project code:

### Auth Store Enrichment Pattern (based on songs.ts / services.ts orgId pattern)

```typescript
// src/stores/auth.ts additions
// Source: mirrors songs.ts subscribe() pattern
const orgId = ref<string | null>(null)
const orgName = ref<string | null>(null)
const userRole = ref<'editor' | 'viewer' | null>(null)
const isEditor = computed(() => userRole.value === 'editor')

let memberUnsub: Unsubscribe | null = null

async function loadOrgContext(uid: string): Promise<void> {
  const userSnap = await getDoc(doc(db, 'users', uid))
  const ids: string[] = userSnap.data()?.orgIds ?? []
  if (!ids[0]) { orgId.value = null; userRole.value = null; return }

  orgId.value = ids[0]
  const orgSnap = await getDoc(doc(db, 'organizations', ids[0]))
  orgName.value = orgSnap.data()?.name ?? null

  memberUnsub?.()
  memberUnsub = onSnapshot(
    doc(db, 'organizations', ids[0], 'members', uid),
    (snap) => {
      userRole.value = snap.exists() ? snap.data().role : null
    }
  )
}

// Call loadOrgContext from onAuthStateChanged after ensureUserDocument:
onAuthStateChanged(auth, async (firebaseUser) => {
  user.value = firebaseUser
  if (firebaseUser) {
    await ensureUserDocument(firebaseUser)
    await loadOrgContext(firebaseUser.uid)
  } else {
    orgId.value = null
    userRole.value = null
    orgName.value = null
    memberUnsub?.()
  }
  isReady.value = true
})
```

### Invite Creation (in TeamView.vue)

```typescript
// Normalized email as doc ID — O(1) sign-in lookup
const normalizedEmail = inviteEmail.value.trim().toLowerCase()

// Guard: already a member?
if (members.value.some(m => m.email.toLowerCase() === normalizedEmail)) {
  error.value = 'This person is already a member.'
  return
}

const batch = writeBatch(db)
const orgInviteRef = doc(db, 'organizations', authStore.orgId!, 'invites', normalizedEmail)
const lookupRef = doc(db, 'inviteLookup', normalizedEmail)

batch.set(orgInviteRef, {
  role: selectedRole.value,
  invitedBy: authStore.user!.uid,
  invitedAt: serverTimestamp(),
  email: normalizedEmail,
  status: 'pending',
})
batch.set(lookupRef, {
  orgId: authStore.orgId,
  role: selectedRole.value,
  invitedAt: serverTimestamp(),
})
await batch.commit()
```

### Router Guard (in router/index.ts)

```typescript
// Route meta addition
{
  path: '/',
  name: 'dashboard',
  meta: { requiresAuth: true, requiresEditor: true },
  ...
},
{
  path: '/songs',
  meta: { requiresAuth: true, requiresEditor: true },
  ...
},
{
  path: '/team',
  name: 'team',
  meta: { requiresAuth: true, requiresEditor: true },
  component: () => import('../views/TeamView.vue'),
},
{
  path: '/services',
  meta: { requiresAuth: true },  // Both roles allowed
  ...
},

// Guard:
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const user = await getCurrentUser()
    if (!user) return { name: 'login' }
  }
  if (to.meta.requiresEditor) {
    const authStore = useAuthStore()
    await authStore.waitForRole()
    if (!authStore.isEditor) return { name: 'services' }
  }
  if (to.name === 'login') {
    const user = await getCurrentUser()
    if (user) return { name: 'dashboard' }
  }
})
```

### Sidebar Conditional Rendering (AppSidebar.vue)

```typescript
// navItems becomes computed, filtered by role
const navItems = computed(() => {
  const base = [
    // Dashboard — editor only
    ...(authStore.isEditor ? [{ label: 'Dashboard', to: '/', icon: '...' }] : []),
    // Songs — editor only
    ...(authStore.isEditor ? [{ label: 'Songs', to: '/songs', icon: '...' }] : []),
    // Services — all roles
    { label: 'Services', to: '/services', icon: '...' },
    // Team — editor only
    ...(authStore.isEditor ? [{ label: 'Team', to: '/team', icon: '...' }] : []),
  ]
  return base
})
```

### ServiceEditorView.vue — Conditional Edit Controls

```vue
<!-- Example: hide Save/Autosave controls for viewers -->
<template v-if="authStore.isEditor">
  <button @click="onSave">Save</button>
</template>

<!-- Viewers see output actions only -->
<div class="flex gap-2">
  <button @click="handlePrint">Print</button>
  <button @click="handleShare">Share Link</button>
  <button @click="handleExport">Export</button>
</div>
```

### MemberTable pattern (mirrors SongTable.vue structure)

```vue
<!-- Dark mode table: rounded-lg border border-gray-800 overflow-hidden -->
<div class="rounded-lg border border-gray-800 overflow-hidden">
  <table class="w-full text-sm">
    <thead class="bg-gray-800/50 border-b border-gray-700">
      <tr>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
        <th>Email</th>
        <th>Role</th>
        <th>Joined</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-800">
      <tr v-for="member in allMembers" :key="member.uid || member.email">
        <!-- Pending invite row -->
        <td v-if="member.status === 'pending'" colspan="2" class="px-4 py-3 text-gray-400">
          {{ member.email }}
          <span class="ml-2 px-1.5 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded">Pending</span>
        </td>
        <!-- Active member row -->
        ...
      </tr>
    </tbody>
  </table>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `role: 'admin'` in members subcollection | `role: 'editor'` | Phase 7 | All existing member docs need migration |
| Per-view `getDoc(users/{uid})` for orgId | Centralized `authStore.orgId` | Phase 7 | Eliminates N redundant reads, enables reactive role checks |
| No invite system | Firestore-based email-match invite | Phase 7 | Multi-user without email service |
| Router guard only checks auth (signed in/out) | Router guard checks auth + role | Phase 7 | Viewers auto-redirected from editor-only routes |
| All members can write via `isOrgMember` wildcard | Writers must be `isOrgEditor` | Phase 7 | Server-enforced RBAC |

**Deprecated/outdated:**
- `isOrgAdmin` Firestore rule helper: rename to `isOrgEditor`, update check to `role == 'editor'`. Keep `isOrgMember` as the membership existence check.
- `role: 'admin'` in member docs: replaced by `role: 'editor'`. Must migrate existing docs.
- Ad-hoc `getDoc(doc(db, 'users', user.uid))` in DashboardView and other views: replaced by `authStore.orgId` reactive ref.

---

## Open Questions

1. **Should the org creator's name appear at the top of the sidebar for the creator too, or only for invited viewers?**
   - What we know: CONTEXT.md says "Organization name displayed at the top of the sidebar" — framing suggests it helps invited users know which org they joined.
   - What's unclear: Whether it should show for the org creator (who named the org themselves).
   - Recommendation: Show for all roles — adds workspace identity and prepares for potential multi-org support. The creator named their org; seeing it confirmed is useful.

2. **How should an invited viewer handle the GettingStarted checklist steps referencing features they can't access?**
   - What we know: CONTEXT.md says "The GettingStarted checklist adapts for viewers: shows relevant steps like 'View upcoming services'."
   - What's unclear: Whether viewers even see the Dashboard (they don't — router guard redirects them to /services).
   - Recommendation: Move GettingStarted into ServicesView or remove it entirely for viewers. Since viewers can't access Dashboard (where GettingStarted lives), the widget naturally doesn't appear. Only need to ensure the "Share with your team" step wires to /team with `v-if authStore.isEditor` on that step. This simplifies the viewer adaptation — the dashboard is editor-only, so GettingStarted is editor-only by default.

3. **Role change for a currently-signed-in user: does `onSnapshot` update propagate immediately?**
   - What we know: `onSnapshot` on the member doc is reactive. When the role field changes in Firestore, the listener fires with the new value.
   - What's unclear: If a viewer's role is upgraded to editor while they're on /services, does their UI update and do they get access to Dashboard/Songs immediately?
   - Recommendation: Yes — `userRole` ref updates reactively, `isEditor` computed updates, sidebar re-renders showing new links. However, `requiresEditor` route meta is only checked on navigation. The user would need to navigate to /songs/dashboard to trigger the guard. This is acceptable behavior — role upgrade takes effect on next navigation.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vite.config.ts` (unit), `vitest.rules.config.ts` (emulator rules) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && npm run test:rules` (requires Firebase emulator) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-03 | Editor can invite team member by email | unit | `npx vitest run src/views/__tests__/TeamView.test.ts -x` | Wave 0 |
| AUTH-04 | Invited user auto-joins org on sign-in | unit | `npx vitest run src/stores/__tests__/auth.test.ts -x` | Exists (extend) |
| RBAC-01 | Viewer blocked from /songs, /dashboard, /team by router guard | unit | `npx vitest run src/router/__tests__/router.test.ts -x` | Exists (extend) |
| RBAC-02 | Firestore rules: viewer cannot write songs | emulator | `npm run test:rules` | Exists (extend) |
| RBAC-03 | Firestore rules: viewer can read services | emulator | `npm run test:rules` | Exists (extend) |
| RBAC-04 | Auth store exposes orgId, userRole, isEditor reactively | unit | `npx vitest run src/stores/__tests__/auth.test.ts -x` | Exists (extend) |
| RBAC-05 | Last editor cannot remove themselves | unit | `npx vitest run src/views/__tests__/TeamView.test.ts -x` | Wave 0 |
| RBAC-06 | Invite for existing member is rejected | unit | `npx vitest run src/views/__tests__/TeamView.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && npm run test:rules`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/views/__tests__/TeamView.test.ts` — covers AUTH-03, RBAC-05, RBAC-06 invite logic
- [ ] `src/rules.test.ts` — extend with viewer read/write scenarios for new role model (file exists, needs new describe blocks)
- [ ] `src/router/__tests__/router.test.ts` — extend with `requiresEditor` guard tests (file exists, needs new tests)
- [ ] `src/stores/__tests__/auth.test.ts` — extend with orgId/userRole/isEditor initialization tests (file exists, needs new tests)

---

## Sources

### Primary (HIGH confidence)
- Existing project source code — `src/stores/auth.ts`, `firestore.rules`, `src/router/index.ts`, `src/stores/songs.ts` — all patterns verified by direct code read
- `src/rules.test.ts` — test infrastructure confirmed working, @firebase/rules-unit-testing v5 in use
- `package.json` — confirmed exact versions: Firebase ^12.0.0, Pinia ^3.0.4, Vue Router ^5.0.3, Vitest ^4.0.18

### Secondary (MEDIUM confidence)
- `07-CONTEXT.md` — all implementation decisions are locked user decisions, not research findings; treated as requirements
- `STATE.md` accumulated decisions — confirm established patterns (onSnapshot in stores, inline SVG icons, dark mode palette, writeBatch atomicity)

### Tertiary (LOW confidence)
- None — all findings are grounded in the existing codebase directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries required; all existing project dependencies cover the need
- Architecture: HIGH — all patterns mirror existing code in the project; no external library research needed
- Pitfalls: HIGH — identified from direct code analysis (existing `role: 'admin'` migration, async guard timing, email normalization) and standard Firebase RBAC knowledge
- Firestore rules: HIGH — verified against existing `firestore.rules` and `rules.test.ts`

**Research date:** 2026-03-04
**Valid until:** 2026-09-04 (stable Firebase SDK; rules syntax doesn't change frequently)
