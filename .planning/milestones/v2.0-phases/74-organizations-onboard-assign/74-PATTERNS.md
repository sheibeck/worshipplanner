# Phase 74: Organizations — List, Onboard & Admin Assignment - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 6 (3 new functions + tests, 1 changed component + test, 1 new small ported module)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `functions/src/orgProvisioning.ts` (`onboardOrganization`, `assignOrgAdmin`, `listOrganizations`) | service/onCall callable | request-response (privileged write) | `functions/src/superAdminClaims.ts` (`setSuperAdminClaimHandler`/`setSuperAdminClaim`) | exact |
| `functions/src/orgProvisioning.test.ts` | test | request-response handler unit test | `functions/src/superAdminClaims.test.ts` | exact |
| `functions/src/index.ts` (export wiring only — 3 new lines, no new logic) | route/registration | request-response | `functions/src/index.ts:17-18,3324` (`syncOrgMembershipClaim`/`setSuperAdminClaim` import + `export {}` block) | exact |
| `functions/src/suggestedTemplate.ts` (ported `buildSuggestedTemplateEntries`) | utility (ported) | transform | `functions/src/serviceRoles.ts` | exact |
| `src/components/admin/OrganizationsTab.vue` | component | CRUD (list + 2 forms) via onCall | `src/components/admin/ConfigurationTab.vue` (roster table + grant form + httpsCallable idiom, lines 1-95, 131-314) | exact |
| `src/components/admin/OrganizationsTab.test.ts` | test | component mount + httpsCallable-mock | `src/views/__tests__/OwnerConsoleView.test.ts` | role-match (mount/mock harness; OrganizationsTab has no tab-strip/router logic to mirror, only the mocking seams) |

## Pattern Assignments

### `functions/src/orgProvisioning.ts` (onCall callables, request-response)

**Analog:** `functions/src/superAdminClaims.ts`

**Imports pattern** (lines 1-5):
```typescript
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
```
Do **not** call `initializeApp()` at module scope — `functions/src/index.ts` already does that (superAdminClaims.ts lines 9-13 explain why). `orgProvisioning.ts` should carry the identical comment.

**Caller-gate pattern (dual check)** — mirror `setSuperAdminClaimHandler` (superAdminClaims.ts:106-133) verbatim for all three new callables:
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
This is the exact re-check pattern CONTEXT.md §Decisions mandates ("reject `!request.auth`... AND independently re-read `superAdmins/{callerUid}`").

**Target resolution pattern** — mirror lines 147-154 (`getUserByEmail`, wrapped, `not-found` HttpsError on failure):
```typescript
let targetUid: string;
try {
  const targetUser = await getAuth().getUserByEmail(targetEmail);
  targetUid = targetUser.uid;
} catch (err) {
  console.error("[orgProvisioning] <fn>: getUserByEmail failed:", err);
  throw new HttpsError("not-found", `No user found for email "${targetEmail}".`);
}
```
For `assignOrgAdmin`'s "no account" branch (R205), this same catch is the fork point: instead of rethrowing `not-found`, fall through to the invite-artifact write and return `{ status: "invited" }` — see the invite shape below.

**Boolean/string strict-typing pattern (WR-01, superAdminClaims.ts:143-145)** — apply the same "reject on wrong type, never fall through to a truthy branch" discipline to `onboardOrganization`'s `name`/`adminEmail` and `assignOrgAdmin`'s `orgId`/`email`:
```typescript
if (typeof targetEmail !== "string" || targetEmail.trim() === "") {
  throw new HttpsError("invalid-argument", "targetEmail is required.");
}
```

**Testable-handler-separated-from-wrapper pattern** (superAdminClaims.ts:106-177):
```typescript
export async function onboardOrganizationHandler(
  request: CallableRequest<OnboardOrganizationRequest>,
): Promise<OnboardOrganizationResponse> { /* ... */ }
export const onboardOrganization = onCall(onboardOrganizationHandler);
```
Apply identically to `assignOrgAdminHandler`/`assignOrgAdmin` and `listOrganizationsHandler`/`listOrganizations`.

**Create-only uniqueness-in-a-transaction pattern** — the callable runs under the Admin SDK, which bypasses `orgNames`' create-only *rule*, so `onboardOrganization` must replicate `src/utils/orgName.ts`'s `normalizeOrgName`/`claimOrgName` semantics itself, transactionally (get-then-create inside `db.runTransaction`), per CONTEXT.md. There is no existing functions-side transaction analog for a *uniqueness claim* specifically, but `index.ts`'s `checkAndConsumeRateLimit` (index.ts:343-373) is the closest local precedent for the transaction shape itself (get inside `tx`, decide, `tx.set`):
```typescript
return db.runTransaction(async (tx) => {
  const nameRef = db.collection("orgNames").doc(nameKey);
  const nameSnap = await tx.get(nameRef);
  if (nameSnap.exists && nameSnap.data()?.orgId !== orgId) {
    throw new HttpsError("already-exists", "That church name is taken.");
  }
  tx.set(nameRef, { orgId });
  // ... org doc write inside same transaction, per R202 ordering ...
});
```
Note: `orgName.ts`'s `normalizeOrgName` (src/utils/orgName.ts:16-25) is a **pure function with no Firestore/client imports** — it can be ported byte-for-byte into `functions/src/orgProvisioning.ts` (or a small shared `orgNameShared.ts`) exactly as `serviceRoles.ts` ports `src/utils/serviceRoles.ts`'s pure resolvers (see below); do not reimplement its slug-fallback logic differently.

**Additive `arrayUnion` write pattern (R206)** — the org/member/orgIds shapes to replicate come from `src/stores/auth.ts:440-456` (org-create) and `:417-423` (member doc), but the callable must diverge on `orgIds`:
```typescript
// organizations/{orgId} (auth.ts:440-444 shape)
await orgRef.set({ name, createdAt: FieldValue.serverTimestamp(), createdBy: request.auth.uid });

// organizations/{orgId}/members/{uid} (auth.ts:417-423/446-452 shape)
await memberRef.set({
  role: "editor",
  joinedAt: FieldValue.serverTimestamp(),
  displayName: targetUser.displayName ?? "",
  email: targetUser.email ?? "",
});

// users/{uid}.orgIds — MUST be arrayUnion, NOT auth.ts's overwrite (auth.ts:426,455 do `orgIds: [x]`)
await userRef.set({ orgIds: FieldValue.arrayUnion(orgId) }, { merge: true });
```
`syncOrgMembershipClaim` (orgMembershipClaims.ts:389-400) fires automatically on the members write — the callable must **not** touch custom claims itself, matching CONTEXT.md's "no manual claim write here."

**Invite-artifact write pattern (R205, no-account branch)** — mirror `src/stores/auth.ts`'s invite *read* shape in reverse (invites/{email} + inviteLookup/{email}), matching what auth.ts:399-423 later consumes on accept:
```typescript
const inviteRef = db.collection("organizations").doc(orgId).collection("invites").doc(email);
const lookupRef = db.collection("inviteLookup").doc(email);
const batch = db.batch();
batch.set(inviteRef, { role: "editor", invitedAt: FieldValue.serverTimestamp(), invitedBy: request.auth.uid });
batch.set(lookupRef, { orgId, role: "editor" });
await batch.commit();
return { status: "invited" };
```

**Error handling pattern** — every thrown error inside a handler is an `HttpsError` with a specific code (`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `already-exists`); unexpected errors are `console.error`-logged with a `[orgProvisioning] <fn>:` prefix before rethrow/convert, mirroring superAdminClaims.ts:152-153 and index.ts:768-774 (`parsePptxHandler`'s catch-log-rethrow-as-HttpsError shape).

**`listOrganizations` — member-count aggregation**: no existing functions-side `getCountFromServer`/aggregate-query precedent exists in this codebase (searched `functions/src/index.ts` for `getCountFromServer`/`.count(`, none found). Planner's discretion per CONTEXT.md ("count query vs read"); the closest structural precedent for "read all docs under organizations/{orgId}, tally" is `computeOrgsClaimForUid` (orgMembershipClaims.ts:126-137, a `collectionGroup` scan) — but that scans one collectionGroup for one uid, not per-org members counts, so treat it as a *shape* reference only, not a drop-in.

---

### `functions/src/orgProvisioning.test.ts`

**Analog:** `functions/src/superAdminClaims.test.ts`

**Mocking seams** (superAdminClaims.test.ts:15-29):
```typescript
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ getUserByEmail: vi.fn(), getUser: vi.fn(), /* ... */ })),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(),
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP_SENTINEL"), arrayUnion: vi.fn((v) => ({ __arrayUnion: v })) },
}));
```
(Add `FieldValue.arrayUnion` to the mock — superAdminClaims.test.ts's mock doesn't need it, but `assignOrgAdmin`'s orgIds write does; verify the exact mock call in tests, per R206's load-bearing correctness point.)

**Fake-Firestore-collection helper pattern** (superAdminClaims.test.ts:60-76, `mockFirestore`): build a per-collection `docSpy`/`collectionSpy` returning canned `get`/`set`/`delete`, and for transactions add a `runTransaction: vi.fn((fn) => fn(txMock))` seam — no existing test mocks `runTransaction` in this file; the closest transaction-mock precedent to check before inventing one is `functions/src/index.test.ts`'s coverage of `checkAndConsumeRateLimit` (same `db.runTransaction` shape as index.ts:354).

**Fake `CallableRequest` builder pattern** (superAdminClaims.test.ts:156-170, `fakeRequest`):
```typescript
function fakeRequest(overrides: { auth?: {...} | null; data?: Partial<Req> } = {}): CallableRequest<Req> {
  const auth = overrides.auth === undefined ? { uid: CALLER_UID, token: { superAdmin: true } } : overrides.auth;
  return { auth: auth === null ? undefined : { uid: auth.uid, token: auth.token ?? {} }, data: { ...defaults, ...overrides.data } } as unknown as CallableRequest<Req>;
}
```

**Assertion style**: `rejects.toMatchObject({ code: "unauthenticated" })` for gate failures (superAdminClaims.test.ts:176-178); `toHaveBeenCalledWith(...)` on the mocked write for shape assertions (lines 95-97, 107-112). For R206, write a dedicated test asserting `arrayUnion` (not a `set([orgId])` overwrite) is what's called on `users/{uid}` — this is the single highest-value assertion in the new test file per CONTEXT.md's own framing.

---

### `functions/src/suggestedTemplate.ts` (ported `buildSuggestedTemplateEntries`)

**Analog:** `functions/src/serviceRoles.ts` (whole file — the porting precedent)

**Porting rationale docblock** (serviceRoles.ts:1-21) — copy this pattern of top-of-file comment explaining *why* it's a duplicate, not an import:
```typescript
/**
 * `functions/` is a standalone TypeScript project (its own tsconfig with
 * include:["src"], no `@/` alias — it cannot import from the client `src/` tree),
 * so this file is a DUPLICATE of the pure client resolver rather than an import,
 * following the same precedent as functions/src/serviceRoles.ts (which hand-mirrors
 * src/utils/serviceRoles.ts). Ported verbatim from:
 *   src/utils/slotTypes.ts -> buildSuggestedTemplateEntries
 * Keep this in lockstep with the client original — a drift would seed a new
 * org's default template differently from a normally-created org's.
 */
```

**Minimal hand-mirrored domain types** (serviceRoles.ts:23-49): declare only the fields the ported function touches — mirror `ServiceTemplateEntry`'s shape (`{ id, kind, section? }`) from `src/types/organization.ts:15-28`, not the full client type tree. The source function (`src/utils/slotTypes.ts:453-459`) depends on `buildSlots('1-2-2-3')` — that dependency chain (`buildSlots` → the `1-2-2-3` progression preset) must be ported too, or reduced to the exact 7-entry literal array it produces today (verify via `slotTypes.test.ts:798`'s pin before doing either — do not let the seeded template drift from what a normally-created org gets, per CONTEXT.md).

**Purity constraint**: like `resolveServiceRoleAssignments`/`resolveMessageRecipients` (serviceRoles.ts:91-183), the ported function must stay **pure** — no Firestore access inside it. `orgProvisioning.ts`'s `onboardOrganization` handler calls it and writes the result into the settings write itself.

---

### `src/components/admin/OrganizationsTab.vue`

**Analog:** `src/components/admin/ConfigurationTab.vue` (roster table + grant form + httpsCallable idiom)

**Imports pattern** (ConfigurationTab.vue:131-137):
```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
```
(OrganizationsTab needs no Firestore `onSnapshot` import — `listOrganizations` is a one-shot callable per CONTEXT.md, not a realtime subscription, so omit `collection`/`onSnapshot`/`db` entirely — a deliberate divergence from ConfigurationTab's roster subscription.)

**One-shot callable-driven list pattern** — adapt ConfigurationTab's `onSnapshot`-driven `superAdmins` ref (lines 164-166, 290-303) to a `httpsCallable`-driven fetch instead:
```typescript
const orgs = ref<OrgSummary[]>([])
const loaded = ref(false)
const loadError = ref<string | null>(null)

async function refreshOrgs() {
  loadError.value = null
  try {
    const listOrganizations = httpsCallable<void, { organizations: OrgSummary[] }>(functions, 'listOrganizations')
    const result = await listOrganizations()
    orgs.value = result.data.organizations
  } catch (err) {
    console.error('[OrganizationsTab] listOrganizations error:', err)
    loadError.value = friendlyCallableError(err)
  } finally {
    loaded.value = true
  }
}
onMounted(refreshOrgs)
```

**Table markup pattern** (ConfigurationTab.vue:38-92) — copy the `<table>`/`<thead>`/`<tbody v-for>`/empty-state (`v-if="list.length === 0"`) structure verbatim, swapping columns to church name / org id / created date / member count.

**Grant-form-as-onboard-form pattern** (ConfigurationTab.vue:11-30, 242-269 `onGrant`) — the "Onboard a church" form (name + admin email inputs, disabled/spinner button, inline error/success feedback) copies this shape directly, calling `onboardOrganization` instead of `setSuperAdminClaim`, then calling `refreshOrgs()` on success (CONTEXT.md: "on success refresh the list").

**Per-row inline-confirm action pattern** (ConfigurationTab.vue:56-79, the revoke confirm/cancel toggle) — reusable shape for the per-org "Assign admin" affordance, though CONTEXT.md specifies an email **input** per org rather than a binary confirm, so this is a structural (not literal) borrow: an inline `<input>` + submit/cancel toggled by a `assigningOrgId === org.orgId` ref, mirroring `confirmingRevokeUid === admin.uid` (line 58) but with a text field inside the toggled block instead of static confirm text.

**`friendlyCallableError` helper** (ConfigurationTab.vue:228-238) — copy directly (checks `err.code` for `permission-denied`/`not-found`, falls back to `err.message`); add a branch for `already-exists` → "That church name is taken." (R201) since `onboardOrganization` throws that code.

**Status feedback (added vs invited, R205)**: no existing analog for a status-branching success message; build directly from the callable's typed `{ status: 'added' | 'invited' }` response, e.g. `` `${adminEmail} was ${result.data.status === 'invited' ? 'invited' : 'added'} as admin.` ``.

---

### `src/components/admin/OrganizationsTab.test.ts`

**Analog:** `src/views/__tests__/OwnerConsoleView.test.ts`

**Mount/mock harness** (OwnerConsoleView.test.ts:11-111):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
enableAutoUnmount(afterEach)

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: { ok: true } }))),
}))
vi.mock('@/firebase', () => ({ db: {}, functions: {} }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isSuperAdmin: true, user: { uid: 'owner-uid', email: 'owner@example.com' } }),
}))
```
Since `OrganizationsTab.vue` has no realtime `onSnapshot` subscription (per the one-shot design above), the test needs a **simpler** mock than OwnerConsoleView.test.ts's `snapshotCallbacks`-keyed `onSnapshot` harness (lines 59-91): mock `httpsCallable` per-callable-name instead, e.g.
```typescript
const mockListOrganizations = vi.fn(() => Promise.resolve({ data: { organizations: [] } }))
const mockOnboardOrganization = vi.fn(() => Promise.resolve({ data: { status: 'added' } }))
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'listOrganizations') return mockListOrganizations
    if (name === 'onboardOrganization') return mockOnboardOrganization
    if (name === 'assignOrgAdmin') return mockAssignOrgAdmin
    throw new Error(`unexpected callable ${name}`)
  }),
}))
```
This name-keyed dispatch is a direct extension of OwnerConsoleView.test.ts:93-95's single-callable mock, not a new pattern — just widened to disambiguate three callable names instead of one.

**`beforeEach` pinia reset + `flushPromises` after mount** (OwnerConsoleView.test.ts:127-130 and its `mount(...)` + `await flushPromises()` calls elsewhere in the file) — copy directly; no router mock is needed (OrganizationsTab, unlike OwnerConsoleView, has no `useRoute`/`useRouter` tab-query logic).

---

## Shared Patterns

### Super-admin onCall caller gate
**Source:** `functions/src/superAdminClaims.ts:106-133` (`setSuperAdminClaimHandler`)
**Apply to:** All three callables in `orgProvisioning.ts`
```typescript
if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
if (request.auth.token.superAdmin !== true) throw new HttpsError("permission-denied", "You must be a super-admin.");
const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
if (!callerDoc.exists) throw new HttpsError("permission-denied", "You must be a super-admin.");
```

### Testable-handler / onCall-wrapper split
**Source:** `functions/src/superAdminClaims.ts:106-177`, `functions/src/index.ts:715-781` (parsePptxHandler/parsePptx)
**Apply to:** All three new callables — export the handler function separately from the `onCall(...)` binding so tests invoke the handler directly without the Functions test harness.

### httpsCallable client idiom + friendly error mapping
**Source:** `src/components/admin/ConfigurationTab.vue:220-238`
**Apply to:** `OrganizationsTab.vue`'s three callable invocations (list/onboard/assign)
```typescript
function friendlyCallableError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  if (code.includes('permission-denied')) return 'You do not have permission to perform this action.'
  if (code.includes('not-found')) return 'No user was found with that email address.'
  const message = (err as { message?: string })?.message
  return message || 'Something went wrong. Please try again.'
}
```
Extend with `already-exists` → "That church name is taken." for `onboardOrganization`.

### Console card/table dark-palette styling
**Source:** `src/components/admin/ConfigurationTab.vue:1-95` (Tailwind classes: `bg-gray-900 border border-gray-800`, `text-gray-300`/`text-gray-400`/`text-gray-500`, `bg-indigo-600 hover:bg-indigo-500`, `divide-y divide-gray-800`)
**Apply to:** Every new element in `OrganizationsTab.vue` — match class-for-class, not just visually.

### Org/member/invite Firestore doc shapes
**Source:** `src/stores/auth.ts:399-478`
**Apply to:** `orgProvisioning.ts`'s writes — `organizations/{orgId}` (`name`, `createdAt`, `createdBy`), `organizations/{orgId}/members/{uid}` (`role`, `joinedAt`, `displayName`, `email`), `organizations/{orgId}/invites/{email}` + `inviteLookup/{email}`. **Deviation required by R206:** `users/{uid}.orgIds` must be `FieldValue.arrayUnion(orgId)`, never `auth.ts`'s `orgIds: [x]` overwrite (auth.ts:426, 455).

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Per-org member-count aggregation in `listOrganizations` | service (Firestore read) | batch/aggregate | No existing functions-side `getCountFromServer`/aggregate-query or per-org tally precedent; nearest structural reference is `computeOrgsClaimForUid`'s `collectionGroup` scan (`orgMembershipClaims.ts:126-137`), but it solves a different query shape (all orgs for one uid, not per-org counts). Planner/implementer discretion per CONTEXT.md. |
| `db.runTransaction` mock in a *test* file | test harness | n/a | No existing functions test mocks `runTransaction`; `superAdminClaims.test.ts`'s `mockFirestore` (lines 60-76) mocks only `doc().get/set/delete`, not `runTransaction`. The new test file must invent this seam — check `functions/src/index.test.ts` first for any `checkAndConsumeRateLimit` coverage before inventing from scratch. |

## Metadata

**Analog search scope:** `functions/src/*.ts`, `functions/src/*.test.ts`, `src/components/admin/*.vue`, `src/views/OwnerConsoleView.vue`, `src/views/__tests__/*.test.ts`, `src/stores/auth.ts`, `src/utils/orgName.ts`, `src/utils/slotTypes.ts`, `src/types/organization.ts`
**Files scanned:** 12 read in full/targeted sections; `functions/src/index.ts` scanned to line 1226 (export-wiring section confirmed at lines 17-18, 3311, 3324) plus targeted grep across the whole file
**Pattern extraction date:** 2026-08-21
