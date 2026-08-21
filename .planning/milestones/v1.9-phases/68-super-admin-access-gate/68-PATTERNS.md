# Phase 68: Super-Admin Access Gate & Claim-Merge Fix - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 11
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `functions/src/claimsHelpers.ts` | service (utility) | transform (read-merge-write) | `functions/src/orgMembershipClaims.ts` lines 138-142 (read-before-decide) + 186-199 (write sites being replaced) | role-match (extraction, no prior direct analog) |
| `functions/src/orgMembershipClaims.ts` (MODIFY) | service / event-driven trigger | event-driven | itself — refactor of lines 186-199 | exact (self) |
| `functions/src/superAdminClaims.ts` — `syncSuperAdminClaim` | service / event-driven trigger | event-driven | `functions/src/orgMembershipClaims.ts` (whole file, `syncOrgMembershipClaimHandler` + `onDocumentWritten` wrapper) | exact |
| `functions/src/superAdminClaims.ts` — `setSuperAdminClaim` | controller (onCall) | request-response | `functions/src/index.ts` `queueServiceMessageHandler` (~2316-2440) and `parsePptxHandler` (~676-763) | exact |
| `functions/src/bootstrapSuperAdmin.ts` | utility (CLI script) | batch | `functions/src/backfillOrgClaims.ts` (whole file) | exact |
| `functions/src/index.ts` (MODIFY — exports only) | config/route | request-response | itself — existing `export { parsePptx }`/`export { syncOrgMembershipClaim }` style export lines | exact (self) |
| `firestore.rules` (MODIFY) | config (security rules) | request-response | `isOrgMember`/`isOrgEditor` helpers (lines 7-26) + `aiUsage`/`aiRateLimits` top-level deny blocks (lines 442-452) | exact |
| `src/rules.test.ts` (MODIFY) | test | request-response | existing `describe('Cross-org isolation', ...)` / `describe('User profile isolation', ...)` blocks (lines 91-115), `authenticatedContext(uid, claims)` usage | exact |
| `src/stores/auth.ts` (MODIFY) | store (Pinia) | CRUD / event-driven | itself — `refreshOrgClaim` (lines 131-149) and `loadOrgContext` (151+) | exact (self) |
| `src/router/index.ts` (MODIFY) | route (guard) | request-response | itself — `requiresEditor` meta + `beforeEach` branch (lines 6-9, 33, 109-124) | exact (self) |
| `src/components/AppSidebar.vue` (MODIFY) | component (nav) | request-response | itself — `authStore.isEditor`-gated `navItems` push blocks (lines 84-154), esp. the "Admins" entry (140-149) | exact (self) |
| `src/views/OwnerConsoleView.vue` (NEW) | component (view) | CRUD | `src/views/TeamView.vue` (invite/remove roster pattern) + `src/views/SettingsView.vue` (shell/section layout) | role-match |
| `src/stores/admin.ts` (NEW, optional) or local composable | store (Pinia) | CRUD / event-driven | Existing Pinia `onSnapshot` stores (`auth.ts`'s `memberUnsub` pattern) and `TeamView.vue`'s local `onSnapshot`/`deleteDoc` usage | role-match |

## Pattern Assignments

### `functions/src/claimsHelpers.ts` (NEW — service/utility)

**Analog:** `functions/src/orgMembershipClaims.ts`

**Imports pattern:**
```typescript
import { getAuth } from "firebase-admin/auth";
```
(No `initializeApp()` at module scope — mirrors the comment at `orgMembershipClaims.ts` lines 6-10: the deployed runtime's `index.ts` and the CLI's `runBackfillCli` each call `initializeApp()` themselves; a helper module must never do it, or it breaks one of the two callers.)

**Read-before-write precedent** (`orgMembershipClaims.ts` lines 138-142, already reads current claims via `getAuth().getUser(uid)` before deciding):
```typescript
const existingUser = await getAuth().getUser(uid);
const existingClaims = existingUser.customClaims as Partial<OrgMembershipClaim> | undefined;
```
Extend this exact "read current via `getAuth().getUser(uid)`" idiom into the write path itself:
```typescript
export async function mergeAndSetCustomClaims(
  uid: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = (user.customClaims as Record<string, unknown> | undefined) ?? {};
  await getAuth().setCustomUserClaims(uid, { ...current, ...patch });
}

export async function clearClaimKeys(uid: string, keys: readonly string[]): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = { ...((user.customClaims as Record<string, unknown> | undefined) ?? {}) };
  for (const key of keys) delete current[key];
  const hasRemaining = Object.keys(current).length > 0;
  await getAuth().setCustomUserClaims(uid, hasRemaining ? current : null);
}
```

**Error handling:** No try/catch inside the helper itself — callers (`syncOrgMembershipClaimHandler`, `syncSuperAdminClaimHandler`) wrap the call and convert failures into a `{ action: "failed", error: String(err) }` outcome rather than rethrowing (see below). The helper stays a thin, throw-through Admin SDK wrapper, matching how `decideMembershipClaim` itself never swallows errors — only the trigger handler around it does.

---

### `functions/src/orgMembershipClaims.ts` (MODIFY — the two blind writes)

**Exact current code to replace** (lines 186-199):
```typescript
switch (decision.action) {
  case "set":
    await getAuth().setCustomUserClaims(uid, decision.claims);
    return { action: "set" };
  case "clear":
    await getAuth().setCustomUserClaims(uid, null);
    return { action: "clear" };
  case "skip":
    return { action: "skip", reason: decision.reason };
}
```

**Replacement**, routing BOTH branches through the new helper and the already-exported `ORG_CLAIM_KEYS` constant (line 20: `export const ORG_CLAIM_KEYS = ["orgId", "role"] as const;`):
```typescript
switch (decision.action) {
  case "set":
    await mergeAndSetCustomClaims(uid, decision.claims);
    return { action: "set" };
  case "clear":
    await clearClaimKeys(uid, ORG_CLAIM_KEYS);
    return { action: "clear" };
  case "skip":
    return { action: "skip", reason: decision.reason };
}
```
Add `import { mergeAndSetCustomClaims, clearClaimKeys } from "./claimsHelpers";` to the top import block (currently lines 1-3).

**Critical: both branches must change** — Pitfall 1 in RESEARCH.md documents that fixing only the `'set'` branch (line 188) and leaving `'clear'`'s `setCustomUserClaims(uid, null)` (line 191) intact still wipes `superAdmin`, since `null` clears the *entire* claims object regardless of what the `set` branch now does.

**Try/catch-not-rethrow pattern to preserve** (`syncOrgMembershipClaimHandler`, lines 173-200): the whole handler body stays wrapped in try/catch resolving `{ action: "failed", error: String(err) }` — never rethrow out of a Firestore trigger (would cause Cloud Functions retries hammering the Auth API). `superAdminClaims.ts`'s new handler must copy this shape exactly.

---

### `functions/src/superAdminClaims.ts` — `syncSuperAdminClaim` (NEW)

**Analog:** `functions/src/orgMembershipClaims.ts` (whole file — this is a byte-for-byte structural mirror)

**Imports pattern:**
```typescript
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { mergeAndSetCustomClaims, clearClaimKeys } from "./claimsHelpers";
```

**Handler/wrapper split pattern** (mirrors `syncOrgMembershipClaimHandler` at lines 173-213 — testable handler exported separately from the deployed `onDocumentWritten` wrapper, so tests call it directly with a fake event object rather than needing the Firestore emulator):
```typescript
export async function syncSuperAdminClaimHandler(params: {
  uid: string;
  granted: boolean; // true when superAdmins/{uid} exists AFTER this write
}): Promise<SyncSuperAdminClaimOutcome> {
  try {
    if (params.granted) {
      await mergeAndSetCustomClaims(params.uid, { superAdmin: true });
      return { action: "set" };
    }
    await clearClaimKeys(params.uid, SUPER_ADMIN_CLAIM_KEYS);
    return { action: "clear" };
  } catch (err) {
    console.error("[superAdminClaims] syncSuperAdminClaim:", err);
    return { action: "failed", error: String(err) };
  }
}

export const syncSuperAdminClaim = onDocumentWritten("superAdmins/{uid}", async (event) => {
  await syncSuperAdminClaimHandler({
    uid: event.params.uid,
    granted: event.data?.after.exists === true,
  });
});
```
Note the direct parallel to `orgMembershipClaims.ts`'s own wrapper (lines 202-213), which derives `after` from `event.data?.after.exists ? (event.data.after.data() as MemberDocData) : undefined`.

---

### `functions/src/superAdminClaims.ts` — `setSuperAdminClaim` (NEW onCall)

**Analog:** `functions/src/index.ts` `queueServiceMessageHandler` (~2316-2440) and `parsePptxHandler` (~676-763)

**Imports pattern** (matches `index.ts` line 1):
```typescript
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
```

**Auth/caller-recheck pattern** — every onCall handler in this codebase starts with an unauthenticated check, then independently re-verifies the caller's authority server-side rather than trusting a client-declared flag (`parsePptxHandler` line 704: `throw new HttpsError("unauthenticated", "Sign in required.");` then further permission-denied checks at 709-729):
```typescript
if (!request.auth) {
  throw new HttpsError("unauthenticated", "Sign in required.");
}
if (request.auth.token.superAdmin !== true) {
  throw new HttpsError("permission-denied", "You must be a super-admin.");
}
const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
if (!callerDoc.exists) {
  throw new HttpsError("permission-denied", "You must be a super-admin.");
}
```

**Testable-handler / wrapper split** (mirrors `parsePptx = onCall(...)` at line 763 and the queueServiceMessage export): export `setSuperAdminClaimHandler` separately, then `export const setSuperAdminClaim = onCall(setSuperAdminClaimHandler);`

**Error handling pattern:** every rejection branch is an `HttpsError` with a specific code (`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`) — never a bare `Error` or a generic 500. Matches `parsePptxHandler`'s and `queueServiceMessageHandler`'s branches at index.ts lines 704-763 / 2341-2375.

**Revoke propagation:** after `targetRef.delete()`, call `await getAuth().revokeRefreshTokens(targetUid);` — no existing analog in this repo (first use of this Admin SDK primitive), but it is the documented standard primitive per RESEARCH.md §"Don't Hand-Roll" and is required by R179/SC5.

---

### `functions/src/bootstrapSuperAdmin.ts` (NEW)

**Analog:** `functions/src/backfillOrgClaims.ts` (whole file, byte-for-byte structural mirror)

**Imports pattern** (matches `backfillOrgClaims.ts` lines 1-4):
```typescript
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { mergeAndSetCustomClaims } from "./claimsHelpers";
```

**Dry-run-default / --apply-gated pattern** (mirrors `backfillOrgMembershipClaims`'s `apply` option at lines 44-47, 87-90, and the CLI wrapper at 170-204):
```typescript
export interface BootstrapOptions {
  apply: boolean; // false (default): classify/report only, write nothing
}
```
```typescript
// runBootstrapCli() mirrors runBackfillCli() (lines 170-204):
// - resolves target by email -> uid via getAuth().getUserByEmail(email)
// - prints target project id + dry-run banner before doing any work
// - writes superAdmins/{uid} doc AND calls mergeAndSetCustomClaims directly
//   (does not depend on syncSuperAdminClaim trigger being deployed yet —
//   see RESEARCH.md Pitfall 6)
// - wrapped in try/catch, sets process.exitCode = 1 on failure
// - guarded by `if (require.main === module) { void runBootstrapCli(); }`
//   so importing the module for tests never calls initializeApp()
```

**CLI guard pattern** (`backfillOrgClaims.ts` line 202-204, copy verbatim structure):
```typescript
if (require.main === module) {
  void runBootstrapCli();
}
```

**Scale/scope comment style to imitate:** `backfillOrgClaims.ts`'s header comments (lines 6-41) document PURPOSE, "THIS IS A NODE SCRIPT, NOT A DEPLOYED FUNCTION", and SAFETY explicitly — the bootstrap script's own header should carry the equivalent "resolves target by email→uid, writes `superAdmins/{uid}` directly, NOT exported from `index.ts`" framing.

---

### `functions/src/index.ts` (MODIFY — exports only)

**Analog:** itself — existing export lines for `parsePptx`, `syncOrgMembershipClaim`, `queueServiceMessage`, etc.

**Pattern:** Add two new named exports (`syncSuperAdminClaim`, `setSuperAdminClaim`) from `./superAdminClaims`, following the exact style already used for `orgMembershipClaims`'s export. Do **NOT** export anything from `bootstrapSuperAdmin.ts` — mirrors `backfillOrgClaims.ts`'s deliberate exclusion (RESEARCH.md D-12, confirmed: `backfillOrgClaims.ts` is never imported by `index.ts`).

---

### `firestore.rules` (MODIFY)

**Analog:** `isOrgMember`/`isOrgEditor` helper block (lines 7-26) for the helper-function pattern; `aiUsage`/`aiRateLimits` top-level collection blocks (lines 442-452) for the top-level (non-org-nested) collection placement pattern.

**Helper function pattern** (mirrors `isSignedIn()` at lines 7-9 and `isOrgMember(orgId)` at 11-14 — but claim-only, explicitly NOT using `exists()`/`get()` per R178's locked decision and this repo's own `storage.rules` deny-everyone incident):
```
function isSuperAdmin() {
  return request.auth != null && request.auth.token.superAdmin == true;
}
```

**Top-level collection block pattern** (mirrors `match /aiUsage/{docId} { allow read, write: if false; }` at lines 442-444 — same placement style, top-level under `match /databases/{database}/documents`, ABOVE the catch-all at line 455, but `isSuperAdmin()` instead of `false`):
```
match /appConfig/{docId} {
  allow read, write: if isSuperAdmin();
}

match /superAdmins/{uid} {
  allow read, write: if isSuperAdmin();
}
```
Place these new blocks near `aiUsage`/`aiRateLimits` (lines 442-452), before the catch-all `match /{document=**} { allow read, write: if false; }` (lines 455-457) — order doesn't affect evaluation (Firestore evaluates all matching rules, any `allow` wins) but keeps related Admin-SDK-adjacent/owner-gated concerns visually grouped, matching this file's existing organization.

**Naming-collision guard (Pitfall 2):** the `isOrgEditor` helper already normalizes/checks a per-org `role` claim against `['editor', 'admin']` (line 25) — the new `superAdmin` claim is a wholly separate top-level boolean key, never reusing `role` or the string `"admin"`.

---

### `src/rules.test.ts` (MODIFY)

**Analog:** existing `describe('Cross-org isolation', ...)` and `describe('User profile isolation', ...)` blocks (lines 91-115), and the `authenticatedContext(uid, claims)` call shape already used at line ~162 (per RESEARCH.md) for injecting `{ email: '...' }` as the token's claim bag.

**Pattern — genuine ALLOW + DENY, both required** (per CLAUDE.md's rules-first discipline citing the `storage.rules` deny-everyone incident):
```typescript
describe('appConfig / superAdmins — claim-based isSuperAdmin() gate (R178)', () => {
  it('ALLOWS a genuine super-admin to write appConfig/global', async () => {
    const context = testEnv.authenticatedContext('ownerUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(setDoc(doc(db, 'appConfig', 'global'), { anything: true }))
  })

  it('ALLOWS a genuine super-admin to write superAdmins/{uid}', async () => {
    const context = testEnv.authenticatedContext('ownerUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'superAdmins', 'targetUid'), {
        email: 'target@example.com',
        grantedBy: 'ownerUid',
        grantedAt: new Date(),
      }),
    )
  })

  it('DENIES a signed-in non-admin from reading appConfig/global', async () => {
    const context = testEnv.authenticatedContext('userA') // no superAdmin claim
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'appConfig', 'global')))
  })

  it('DENIES an ordinary org editor (orgId/role claim, no superAdmin) from writing superAdmins/{uid}', async () => {
    const context = testEnv.authenticatedContext('editorUid', { orgId: 'orgA', role: 'editor' })
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'superAdmins', 'targetUid'), { email: 'x@example.com' }))
  })
})
```
Add this `describe` block adjacent to the existing `describe('Cross-org isolation', ...)`/`describe('User profile isolation', ...)` blocks (lines 91-115), reusing the module-level `testEnv` set up at line 14.

---

### `src/stores/auth.ts` (MODIFY — surface `isSuperAdmin`)

**Analog:** itself — `refreshOrgClaim` (lines 131-149) and `loadOrgContext` (line 151+), which already call `getIdTokenResult(currentUser, true)` and read `result.claims.orgId`.

**Pattern — extend the SAME token read, no second fetch:**
```typescript
// New ref alongside orgId/orgName/userRole (near line 49-53):
const isSuperAdmin = ref(false)

// Inside refreshOrgClaim's loop (line 138), after the existing read:
const result = await getIdTokenResult(currentUser, true)
isSuperAdmin.value = result.claims.superAdmin === true
if (result.claims.orgId === targetOrgId) {
  return
}
```
Export `isSuperAdmin` (or a `computed`) alongside `orgId` in the store's return object (near line 500's `orgId,`).

**Router-guard force-refresh pattern (Pitfall 4):** since a super-admin grant is rare/manual (not a "just joined" race), CONTEXT.md explicitly says an unconditional forced refresh on every load is unnecessary — force one specifically in the `/owner-console` route guard instead, mirroring `requiresEditor`'s `await authStore.waitForRole()` shape but calling a new `getIdTokenResult(user, true)`-based refresh.

---

### `src/router/index.ts` (MODIFY — route + guard)

**Analog:** itself — `requiresEditor` meta declaration (lines 6-9), the `/admins` route entry (lines 65-70), and the `beforeEach` `requiresEditor` branch (lines 117-124).

**Meta interface extension:**
```typescript
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresEditor?: boolean
    requiresSuperAdmin?: boolean
  }
}
```

**Route entry pattern** (mirrors the `/admins` entry at lines 65-70):
```typescript
{
  path: '/owner-console',
  name: 'owner-console',
  component: () => import('../views/OwnerConsoleView.vue'),
  meta: { requiresAuth: true, requiresSuperAdmin: true },
},
```

**Guard branch pattern** (mirrors `requiresEditor`'s branch at lines 117-124 — force a claim refresh, then redirect if the flag is false):
```typescript
if (to.meta.requiresSuperAdmin) {
  const { useAuthStore } = await import('../stores/auth')
  const authStore = useAuthStore()
  await authStore.refreshSuperAdminClaim() // new store action, forces getIdTokenResult(user, true)
  if (!authStore.isSuperAdmin) {
    return { name: 'dashboard' } // or 'services', matching requiresEditor's redirect-to-safe-default pattern
  }
}
```
Note: `requiresEditor` redirects to `{ name: 'services' }` (line 122) as the "safe default" for a non-editor — the equivalent safe default for a non-super-admin is the app's normal landing page (`dashboard` or `services`), never a hard error.

---

### `src/components/AppSidebar.vue` (MODIFY — gated nav entry)

**Analog:** itself — the `authStore.isEditor`-gated `navItems.push(...)` blocks (lines 84-154), specifically the "Admins" entry (lines 140-149).

**Pattern:**
```typescript
if (authStore.isSuperAdmin) {
  items.push({
    label: 'Owner Console',
    to: '/owner-console',
    separatorBefore: true,
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="..." />
    </svg>`,
  })
}
```
Placed after the existing "Settings" push (final item in `navItems`), matching how "Admins"/"Settings" form the last gated group (Group C, lines 139-154) — the super-admin item is a further-privileged, visually-separated final entry (`separatorBefore: true`, matching the "Schedule" and "Admins" separator convention at lines 121, 144).

---

### `src/views/OwnerConsoleView.vue` (NEW)

**Analogs:** `src/views/TeamView.vue` (invite/remove roster CRUD pattern — email input, `onSnapshot` live list, remove-with-confirm) and `src/views/SettingsView.vue` (page shell/section layout).

**Roster CRUD pattern to reuse from `TeamView.vue`:**
- Email input + validate (`normalizeEmail`/`isValidEmailFormat`, lines 217-222) before calling the privileged action.
- `onSnapshot` live list of members (roster panel lists current `superAdmins/*` docs the same way `TeamView.vue` lists `organizations/{orgId}/members`).
- Remove-with-confirm UX pattern (lines 83, "Remove {{ member... }}?" inline confirm before `deleteDoc`) — reuse for revoke, except revoke here calls the `setSuperAdminClaim` onCall (`grant: false`), not a direct client `deleteDoc` (writes to `superAdmins/*` are rules-gated to `isSuperAdmin()` only via the Admin SDK trigger's source doc — but per the architecture, the onCall itself performs the Firestore write server-side, so the client only invokes the callable, never writes `superAdmins/*` directly).
- No new validation library — plain `Number(...)`/guard style per CONTEXT.md discretion note; `TeamView.vue`'s `isValidEmailFormat` (lines 221-222) is the template for the roster panel's email format check.

**Shell/section layout to reuse from `SettingsView.vue`:** page title + card-sectioned layout, kept "easy to extend" (a slot/section Phase 70 fills in for config-editor panels) — do not build config editing in this file (Pitfall 7 / out-of-scope guard).

**Calling the onCall** (new pattern in this repo's client code — no direct prior analog for `httpsCallable` from the Vue client; follow the standard Firebase JS SDK shape):
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions'
const setSuperAdminClaim = httpsCallable(getFunctions(), 'setSuperAdminClaim')
await setSuperAdminClaim({ targetEmail, grant: true })
```

---

### `src/stores/admin.ts` (NEW, optional) or local composable

**Analog:** `src/stores/auth.ts`'s `onSnapshot`/unsubscribe pattern (module-scope `memberUnsub` at line 32) and `TeamView.vue`'s local `onSnapshot` over the members subcollection.

**Pattern:** a small Pinia store or local composable that `onSnapshot`s the `superAdmins` collection (rules-gated, so only a signed-in super-admin's session can subscribe successfully) and exposes the live roster array to `OwnerConsoleView.vue`. Given CONTEXT.md's "minimal roster" scope, folding this into a local `<script setup>` composable inside `OwnerConsoleView.vue` (matching `TeamView.vue`'s own inline `onSnapshot` rather than a separate store) is the lighter-weight, more consistent choice unless the roster needs to be read from more than one view.

## Shared Patterns

### Claim read-merge-write (the phase's core correctness fix)
**Source:** `functions/src/claimsHelpers.ts` (new), replacing the two blind `setCustomUserClaims` calls at `functions/src/orgMembershipClaims.ts` lines 188 and 191.
**Apply to:** `orgMembershipClaims.ts` (both branches), `superAdminClaims.ts`'s `syncSuperAdminClaimHandler`, `bootstrapSuperAdmin.ts`'s direct-write path. Every future custom-claim writer this app ever adds must also route through it.

### Testable-handler / deployed-wrapper split
**Source:** `functions/src/orgMembershipClaims.ts` (`syncOrgMembershipClaimHandler` vs. `syncOrgMembershipClaim`), `functions/src/index.ts` (`parsePptxHandler` vs. `parsePptx`, `queueServiceMessageHandler` vs. the onCall export).
**Apply to:** `superAdminClaims.ts`'s `syncSuperAdminClaimHandler`/`syncSuperAdminClaim` and `setSuperAdminClaimHandler`/`setSuperAdminClaim` — always export the testable function separately from the `onDocumentWritten`/`onCall` wrapper.

### Try/catch-not-rethrow inside Firestore triggers
**Source:** `functions/src/orgMembershipClaims.ts` lines 178-199 (`try { ... } catch (err) { console.error(...); return { action: "failed", error: String(err) }; }`).
**Apply to:** `superAdminClaims.ts`'s `syncSuperAdminClaimHandler` — never rethrow out of a trigger; a throw causes Cloud Functions retries that hammer the Auth API.

### Independent server-side caller re-check for privileged onCall functions
**Source:** `functions/src/index.ts` `parsePptxHandler`/`queueServiceMessageHandler` — never trust a client-declared authority flag; always re-verify server-side (token claim AND, for this phase, a Firestore doc re-read for defense-in-depth).
**Apply to:** `setSuperAdminClaimHandler`.

### Dry-run-default / `--apply`-gated owner-run script
**Source:** `functions/src/backfillOrgClaims.ts` (whole file).
**Apply to:** `bootstrapSuperAdmin.ts` — same `BootstrapOptions.apply` flag, same `require.main === module` CLI guard, same pre-work project-id + dry-run banner logging.

### Claim-only Firestore rules helper (no `get()`/`exists()`)
**Source:** `firestore.rules` — deliberately NOT following `isOrgEditor`'s `get()`/`exists()` pattern (lines 16-26); instead a pure `request.auth.token.<claim> == true` check, per this repo's documented `storage.rules` deny-everyone incident (CLAUDE.md).
**Apply to:** `isSuperAdmin()` helper and both `appConfig/*`/`superAdmins/*` match blocks.

### `authStore.<role>`-gated router meta + nav entry
**Source:** `src/router/index.ts`'s `requiresEditor` meta/guard + `src/components/AppSidebar.vue`'s `authStore.isEditor`-gated `navItems.push`.
**Apply to:** `requiresSuperAdmin` meta/guard + `authStore.isSuperAdmin`-gated "Owner Console" nav entry — same shape, new flag.

## No Analog Found

None. Every file in this phase has a direct or role-matched analog already in the codebase (per RESEARCH.md's own conclusion: "Every piece of this phase has a byte-for-byte precedent already living in this codebase").

The one genuinely new client-side pattern is invoking a Cloud Function `onCall` from Vue via `httpsCallable` (`firebase/functions`) — this repo's client code has not previously called an onCall directly from a Vue component (prior onCall usage, e.g. `parsePptx`/`queueServiceMessage`, is invoked from elsewhere or via a different integration point). Use the standard Firebase JS SDK `httpsCallable(getFunctions(), 'setSuperAdminClaim')` shape; no project-specific wrapper exists to mirror.

## Metadata

**Analog search scope:** `functions/src/*.ts`, `src/stores/*.ts`, `src/router/*.ts`, `src/components/*.vue`, `src/views/*.vue`, `firestore.rules`, `src/rules.test.ts`
**Files scanned:** `orgMembershipClaims.ts`, `backfillOrgClaims.ts`, `index.ts` (onCall handlers), `auth.ts`, `router/index.ts`, `AppSidebar.vue`, `TeamView.vue`, `SettingsView.vue`, `firestore.rules`, `src/rules.test.ts`
**Pattern extraction date:** 2026-08-20
