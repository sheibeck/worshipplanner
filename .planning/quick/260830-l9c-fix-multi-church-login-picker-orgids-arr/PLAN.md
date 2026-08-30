---
phase: quick-260830-l9c-fix-multi-church-login-picker-orgids-arr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/stores/auth.ts
  - src/stores/__tests__/auth.test.ts
  - src/utils/firestoreListener.ts
  - src/utils/__tests__/firestoreListener.test.ts
  - src/views/TeamView.vue
  - src/components/GettingStarted.vue
  - src/stores/appConfig.ts
  - src/components/admin/ConfigurationTab.vue
autonomous: true
requirements:
  - QUICK-260830-L9C-MULTI-CHURCH-PICKER-AND-SIGNOUT
must_haves:
  truths:
    - "Accepting a second church invite ADDS the new org to users/{uid}.orgIds instead of replacing the array, and the original org stays at index 0 (primary)."
    - "The login church-picker (SelectChurchView) lists EVERY org the user belongs to, sourced from the UNION of the authoritative custom-claim `orgs` map and users/{uid}.orgIds — so an account whose orgIds was already clobbered self-heals with no manual Firestore repair."
    - "A user whose orgIds lists one org but whose claim lists two is routed to the picker (needsOrgSelection true), not auto-entered into the single orgIds entry."
    - "Signing out tears down all org-scoped store listeners BEFORE the token is revoked, so no store listener fails a Firestore rule during signOut."
    - "Snapshot listeners that can outlive token revocation (TeamView members/invites, GettingStarted member count) no longer surface 'Uncaught Error in snapshot listener' on sign-out; permission-denied is swallowed, any other error is still logged."
    - "The full app suite (bare `npx vitest run`) still shows exactly one failing file — src/storage.rules.test.ts (Storage-emulator baseline) — and `npm run type-check` is clean."
  artifacts:
    - src/utils/firestoreListener.ts
    - src/utils/__tests__/firestoreListener.test.ts
  key_links:
    - "ensureUserDocument invite-accept batch.update(userRef, { orgIds: arrayUnion(inviteOrgId) }) -> preserves orgIds[0] primary that functions/src/orgMembershipClaims.ts decideMembershipClaim reads as primaryOrgId."
    - "loadOrgContext union: getIdTokenResult(user,false).claims.orgs keys ∪ userData.orgIds -> drives BOTH the memberships list SelectChurchView renders AND the activeId resolution that decides picker-vs-auto-enter."
    - "logout(): await import('./orgScopedStores').resetOrgScopedStores() runs before signOut(auth) — same dynamic-import pattern selectOrg/enterOrgAsSuperAdmin/exitSuperAdminView already use."
    - "ignorePermissionDenied(context) -> onSnapshot onError slot in TeamView.vue + GettingStarted.vue; isPermissionDenied(err) guard wraps the existing console.error in appConfig.ts + ConfigurationTab.vue."
---

# Quick Task: Fix multi-church login picker (orgIds overwrite) and permission-denied on sign-out

**Date:** 2026-08-30
**Quick task id:** 260830-l9c
**Type:** Client-store bug fix (`src/stores/auth.ts`) + a small shared listener-error helper. No firestore.rules / Cloud Functions / deploy changes. Worktrees DISABLED — sequential on `master`, `.env.local` present, tests run locally.
**Executor model:** sonnet

## Problem

Two independent, fully-diagnosed production bugs:

**Bug 1 — the multi-church login picker only shows 1 of N churches.** `SelectChurchView.vue` renders
`authStore.memberships`. `loadOrgContext` (`src/stores/auth.ts`) builds `memberships` SOLELY from
`users/{uid}.orgIds` (line 480: `const ids: string[] = userData?.orgIds ?? []`). But the
invite-acceptance path (`ensureUserDocument`, line 749) writes
`batch.update(userRef, { orgIds: [inviteOrgId] })` — a REPLACE. Accepting a second church's invite
clobbers `orgIds` down to a single element, so the picker can never show more than one church even
though the member docs and the server-side custom claim list all orgs. The Cloud Function
(`functions/src/orgMembershipClaims.ts`, `computeOrgsClaimForUid`) already derives the FULL multi-org
set from a `collectionGroup('members')` scan and writes it into the `orgs` custom claim; its own
docblock (line 112) calls `orgIds` "structurally overwrite-broken".

**Bug 2 — sign-out logs `permission-denied` / "Uncaught Error in snapshot listener".** `logout()`
(line 808) tears down only the auth `memberUnsub`, then calls `signOut(auth)`. It does NOT call
`resetOrgScopedStores()`, so ~11 org-scoped store listeners are still attached when the token is
revoked and fail their Firestore rules. Separately, several component listeners that only unsubscribe
on view unmount (which happens AFTER the router redirects to `/login`) pass no `onError` handler, so
Firestore logs "Uncaught Error in snapshot listener". Works on localhost only because the emulator's
rules are permissive.

## Scope decisions (resolved)

### Decision 1b — Self-heal the picker from the authoritative claim: **YES (ship it).**

Change `loadOrgContext` to build its org-id set from the UNION of `getIdTokenResult(user).claims.orgs`
keys AND `users/{uid}.orgIds`, then keep the existing per-org `getDoc` loop for name/active.

**Rationale.** (1a) alone fixes only FUTURE invites; every already-clobbered account (the owner's
included) would stay broken until a manual Firestore data repair — which is explicitly out of scope.
The `orgs` claim already lists every org for affected users (computed server-side on every membership
write), so unioning it into the picker source SELF-HEALS current production accounts with zero data
surgery. Verified against `functions/src/orgMembershipClaims.ts`: the claim key is `orgs`
(`ORGS_CLAIM_KEY = "orgs"`), a map keyed by orgId → `'editor' | 'viewer'`, written via
`mergeAndSetCustomClaims(uid, { ...claims, orgs: desiredOrgs, ... })`. `getIdTokenResult` is already
imported and used in `auth.ts` (`refreshOrgClaim` / `refreshSuperAdminClaim`).

**The union must drive BOTH memberships AND activeId.** This is the non-obvious part. If the union fed
only the `memberships` list but `activeId` still came from `orgIds` alone, a clobbered user
(`orgIds: ['org-2']`, claim `{org-1, org-2}`) would resolve `activeId` from the single-element
`orgIds` (`ids.length === 1 ? ids[0]`) and auto-enter org-2 — the picker (`needsOrgSelection`) never
shows because `orgId` is non-null. So the fix replaces the single `ids` source at the TOP of
`loadOrgContext`; every downstream use (`ids.map`, `ids.includes(remembered)`,
`ids.length === 1 ? ids[0]`) then reads the union.

**Cost (stated explicitly).** Building the union needs the decoded token BEFORE `activeId` is chosen,
so it adds ONE cheap unforced `getIdTokenResult(user, false)` read at the top of `loadOrgContext`
(no forced network refresh; does not touch the existing forced `refreshOrgClaim(activeId)` that runs
later). That extra read shifts the exact-call-count assertions in the delicate R075 claim-refresh test
suite by one leading call and disrupts its `mockResolvedValueOnce` sequencing. The retry LOGIC is
untouched — only the test mock setup shifts. Task 2 gives the exact per-test recipe so this is
mechanical, not exploratory. This is the only reason (1b) is more than a two-line change; it is worth
it to avoid manual production data repair.

**Bonus (not a requirement):** with (1b) shipped, the owner's separate manual orgIds data-repair
becomes UNNECESSARY.

### Decision 2b — onError suppression set: **minimal-but-complete = the two "uncaught" component listeners + a quiet guard on the two already-handled super-admin listeners; NOT the 11 store listeners.**

Verified by reading each listener:

- **TeamView.vue** `membersUnsub` (line 378) and `invitesUnsub` (line 385): NO `onError`. Reachable by
  ordinary editors. These are the real "Uncaught Error in snapshot listener" offenders. **MUST fix.**
- **GettingStarted.vue** `unsub` (line 122): NO `onError`. On the dashboard, hit by every user on
  logout. Real uncaught offender. **MUST fix.**
- **appConfig.ts** `subscribe()` onSnapshot (line 25) and **ConfigurationTab.vue** `superAdminsUnsub`
  (line 292): BOTH already pass an `onError` that logs-and-continues, so neither produces an *uncaught*
  error. They do `console.error` a benign `permission-denied` during a super-admin's logout (the owner
  IS the super-admin, and the report names bare `permission-denied` logs as a symptom). **Include a
  one-line guard** that suppresses ONLY the `console.error` on `permission-denied`, leaving their
  `loaded`/`loadError` state-setting exactly as-is (zero behavior change for genuine errors).
- **The 11 org-scoped store listeners** (`orgScopedStores.ts`): **EXCLUDED.** After (2a) they are torn
  down before `signOut`, so they are no longer in the token-revocation window. Adding `onError` to all
  11 would be touching-everything for a symptom that (2a) already removes. Declined deliberately.
- **The auth `memberUnsub`** (line 563): **EXCLUDED.** `logout()` already unsubscribes it (line 823)
  before `signOut` (line 825), and the onAuthStateChanged null-branch tears it down too — it is not
  live at revocation time. No `onError` needed for the reported path.

Error-code check uses the modular Firestore error shape: `onSnapshot`'s onError receives a
`FirestoreError` whose `.code` is `'permission-denied'`. The helper narrows defensively from `unknown`
(`(err as { code?: string })?.code`), matching the codebase's existing `firebaseErr?.code` idiom, so
it works whether the real SDK or a plain test object is passed.

## Tasks (ordered, atomic — one commit each)

Tasks 1–3 all edit `src/stores/auth.ts`; apply them in order (sequential, single checkout).

---

### Task 1 — Bug 1a: invite-accept APPENDS orgIds via `arrayUnion`

**File:** `src/stores/auth.ts`

**Change:**
1. Add `arrayUnion` to the existing `firebase/firestore` import block (lines 14–23, which already
   imports `doc, setDoc, getDoc, writeBatch, serverTimestamp, onSnapshot, updateDoc, type Unsubscribe`).
2. Line 749: change `batch.update(userRef, { orgIds: [inviteOrgId] })` to
   `batch.update(userRef, { orgIds: arrayUnion(inviteOrgId) })`.

**Why the primary org is preserved:** `functions/src/orgMembershipClaims.ts` `decideMembershipClaim`
reads `primaryOrgId = orgIds[0]` (line 255). `arrayUnion` appends a new value to the END of the array
and never reorders existing elements, so a user's original first org stays at index 0 and remains the
primary. No other code depends on `orgIds` being single-element (verified: the only readers are
`loadOrgContext`'s membership loop and the Cloud Function's `orgIds[0]` primary derivation).

**Test additions (`src/stores/__tests__/auth.test.ts`):**
- Add `arrayUnion: vi.fn((v) => ({ __arrayUnion: v }))` to the `firebase/firestore` mock (lines 36–57;
  it is not currently mocked and the import will fail without it).
- Make the `writeBatch` mock return a STABLE object with a persistent `update` spy (today it returns a
  fresh object per call, so args cannot be asserted), then in the existing
  "consumes a pending invite and joins the invited org" test (or a sibling) assert the `update` spy was
  called with `userRef` and `{ orgIds: { __arrayUnion: 'org-1' } }` — proving append, not replace.

**Verify:**
- `npx vitest run src/stores/__tests__/auth.test.ts` — the invite-append assertion passes.
- `npm run type-check` clean.

**Done:** Accepting an invite issues `arrayUnion(inviteOrgId)`; the original primary stays at index 0.

---

### Task 2 — Bug 1b: self-heal the picker from `claims.orgs` ∪ `orgIds`

**File:** `src/stores/auth.ts` (`loadOrgContext`, around lines 472–512)

**Change:** at the top of `loadOrgContext`, after `const userData = ...` and
`const orgIds: string[] = userData?.orgIds ?? []` (rename the current `ids` binding to `orgIds`):
1. Read the authoritative claim without forcing a refresh:
   `const currentUser = user.value` — guard with `if (currentUser)`; inside a `try/catch`, call
   `const tokenResult = await getIdTokenResult(currentUser, false)` and read
   `const claimOrgs = (tokenResult.claims.orgs ?? {}) as Record<string, unknown>`. On any error, log
   with prefix `'[auth] loadOrgContext claim read:'` and fall back to an empty claim set (never throw —
   a failed claim read must still let orgIds-only login proceed).
2. Build the union, orgIds first (so the primary/index-0 org leads the picker), then claim-only orgs,
   deduped: `const ids = [...orgIds, ...Object.keys(claimOrgs).filter((id) => !orgIds.includes(id))]`.
3. Leave everything below unchanged — `ids.map(...)` (memberships), `readRememberedOrg`/`ids.includes`,
   and `ids.length === 1 ? ids[0]! : null` (activeId) now all read the union.

This does NOT reorder or replace the existing forced `refreshOrgClaim(activeId, ...)` call (line 526);
that still runs after `activeId` is known and keeps its just-joined retry semantics.

**Test additions (`src/stores/__tests__/auth.test.ts`):**

New self-heal test — the headline behavior:
- Fixture: `users/test-uid` → `{ orgIds: ['org-2'] }` (clobbered); org-1 and org-2 org docs both
  readable (`{ name: 'Org One' }` / `{ name: 'Org Two' }`); `getIdTokenResult` →
  `{ claims: { orgs: { 'org-1': 'editor', 'org-2': 'editor' } } }`.
- Assert `store.memberships` equals `[{ id: 'org-2', name: 'Org Two', active: true }, { id: 'org-1', name: 'Org One', active: true }]`
  (orgIds-first ordering), `store.orgId` is null, and `store.needsOrgSelection` / `requiresOrgSelection`
  are true. (activeId is null here because the union has length 2, so `refreshOrgClaim` does not run —
  `getIdTokenResult` is called exactly once, the top unforced read.)

R075 suite updates — the extra top read adds ONE leading `getIdTokenResult` call and consumes the FIRST
value of each `mockResolvedValueOnce` chain. Apply exactly (describe block "org claim refresh (R075 / P-01)"):
- "performs the forced refresh exactly once on the ordinary (already-a-member) load": now 1 unforced +
  1 forced. Change `toHaveBeenCalledTimes(1)` → `toHaveBeenCalledTimes(2)`. KEEP the existing
  `toHaveBeenCalledWith(mockUser, true)` (the forced call still happens).
- "performs no forced refresh when the user belongs to no organization": the top unforced read now runs
  once even for empty orgIds. Replace `expect(getIdTokenResult).not.toHaveBeenCalled()` with
  `expect(getIdTokenResult).toHaveBeenCalledWith(mockUser, false)` and
  `expect(getIdTokenResult).not.toHaveBeenCalledWith(mockUser, true)` (still no FORCED refresh). Update
  the test title to "performs no FORCED refresh …" for accuracy.
- "just-joined, claim present on the first refresh": PREPEND a leading value for the top read —
  chain becomes `.mockResolvedValueOnce({ claims: {} }).mockResolvedValueOnce({ claims: { orgId: 'org-1' } })`
  and assert `toHaveBeenCalledTimes(2)`.
- "just-joined, claim absent then present on the third attempt": PREPEND one `{ claims: {} }` for the
  top read (chain = top `{}`, forced `{}`, forced `{}`, forced `{ orgId: 'org-1' }`); assert
  `toHaveBeenCalledTimes(4)`; keep the timer advance at `CLAIM_REFRESH_DELAY_MS * 2`.
- "just-joined, claim never arrives": mock is persistent `mockResolvedValue({ claims: {} })` (unchanged);
  total calls become `CLAIM_REFRESH_MAX_ATTEMPTS + 1` — change the assertion to
  `toHaveBeenCalledTimes(CLAIM_REFRESH_MAX_ATTEMPTS + 1)`.
- "just-joined, claim present but for a different org": persistent
  `mockResolvedValue({ claims: { orgId: 'some-other-org' } })` (unchanged); change the assertion to
  `toHaveBeenCalledTimes(CLAIM_REFRESH_MAX_ATTEMPTS + 1)`.
- "a throwing refresh is logged and swallowed": the `mockRejectedValueOnce` is now consumed by the TOP
  read (caught by its `try/catch`), so update the assertion prefix from `'[auth] refreshOrgClaim:'` to
  `'[auth] loadOrgContext claim read:'`. Keep the assertions that `store.orgId === 'org-1'` and
  `store.orgName === 'Test Org'` (org context still populates from the orgIds path).

Existing non-R075 loadOrgContext tests are unaffected: the default `getIdTokenResult` mock returns
`{ claims: {} }`, so `claimOrgs` is empty and the union equals `orgIds` — `mockMultiOrg`,
deactivation, vwMode, settings, etc. all keep their current expected values.

**Verify:**
- `npx vitest run src/stores/__tests__/auth.test.ts` — self-heal test passes and all R075 tests pass
  with the updated counts.
- `npm run type-check` clean.

**Done:** A clobbered account (orgIds shorter than the claim) lands on the picker showing every org;
no manual Firestore repair needed.

---

### Task 3 — Bug 2a: `logout()` tears down org-scoped stores BEFORE `signOut`

**File:** `src/stores/auth.ts` (`logout`, lines 808–826)

**Change:** immediately BEFORE `await signOut(auth)` (line 825), add:
`const { resetOrgScopedStores } = await import('./orgScopedStores')` then `resetOrgScopedStores()`.
Use the exact dynamic-import pattern already used by `selectOrg` (line 632), `enterOrgAsSuperAdmin`
(line 662), and `exitSuperAdminView` (line 689) — this avoids the auth↔store import cycle and is a
proven-safe Pinia call inside an auth action. Leave the existing inline field resets and
`memberUnsub?.()` in place.

**Test additions (`src/stores/__tests__/auth.test.ts`):**
- Add a module mock near the other `vi.mock` calls: `vi.mock('../orgScopedStores', () => ({ resetOrgScopedStores: vi.fn() }))`.
  (This also makes the existing `selectOrg`/`enterOrgAsSuperAdmin`/`exitSuperAdminView` tests use a
  no-op spy instead of the real teardown — harmless; they assert org state, not teardown.)
- New test in the `logout` describe block: import the mocked `resetOrgScopedStores` and `signOut`; after
  `await store.logout()`, assert `resetOrgScopedStores` was called, and that it ran BEFORE `signOut` via
  `expect(vi.mocked(resetOrgScopedStores).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(signOut).mock.invocationCallOrder[0])`.

**Verify:**
- `npx vitest run src/stores/__tests__/auth.test.ts` — ordering test passes; existing logout tests still pass.
- `npm run type-check` clean.

**Done:** On logout, all 11 org-scoped listeners are unsubscribed before the token is revoked.

---

### Task 4 — Bug 2b: shared listener-error helper + wire into logout-surviving listeners

**New file:** `src/utils/firestoreListener.ts`
- `export function isPermissionDenied(err: unknown): boolean` — returns true when
  `(err as { code?: string } | null)?.code === 'permission-denied'`.
- `export function ignorePermissionDenied(context: string): (err: unknown) => void` — returns an
  onSnapshot error callback that returns silently when `isPermissionDenied(err)` is true, otherwise
  `console.error(\`[\${context}] snapshot listener error:\`, err)`. Typing the param as `unknown` still
  satisfies the `onSnapshot` onError slot (which expects `(FirestoreError) => void`) by contravariance.

**Wire the FULL callback into the two uncaught offenders:**
- `src/views/TeamView.vue`: import `ignorePermissionDenied`; add it as the 3rd argument to BOTH
  `onSnapshot` calls — `ignorePermissionDenied('TeamView members')` (line 378) and
  `ignorePermissionDenied('TeamView invites')` (line 385).
- `src/components/GettingStarted.vue`: import `ignorePermissionDenied`; add
  `ignorePermissionDenied('GettingStarted memberCount')` as the 3rd argument to the `onSnapshot` call
  (line 122).

**Quiet-guard the two already-handled super-admin listeners (suppress only the console.error, keep state):**
- `src/stores/appConfig.ts`: import `isPermissionDenied`; in the existing `onError` (lines 32–37) wrap
  ONLY the `console.error('[appConfig store] subscription error:', err)` line in
  `if (!isPermissionDenied(err)) { ... }`. Leave `loadError.value = 'Load error'` and
  `loaded.value = true` unchanged.
- `src/components/admin/ConfigurationTab.vue`: import `isPermissionDenied`; in the `superAdminsUnsub`
  `onError` (lines 301–304) wrap ONLY the `console.error('[ConfigurationTab] roster subscription error:', err)`
  line in `if (!isPermissionDenied(err)) { ... }`. Leave `loaded.value = true` unchanged.

**New test file:** `src/utils/__tests__/firestoreListener.test.ts`
- `isPermissionDenied({ code: 'permission-denied' })` → true; `{ code: 'unavailable' }` → false;
  `null` / `undefined` / `{}` → false.
- `ignorePermissionDenied('ctx')(<permission-denied error>)` does NOT throw and does NOT call
  `console.error` (spy on `console.error`).
- `ignorePermissionDenied('ctx')(<error with code 'unavailable'>)` calls `console.error` once with a
  message containing `ctx`.

**Verify:**
- `npx vitest run src/utils/__tests__/firestoreListener.test.ts` passes.
- `npm run type-check` clean (helper types, new imports in the four wired files).

**Done:** Sign-out no longer produces "Uncaught Error in snapshot listener"; benign `permission-denied`
is swallowed on the four at-risk listeners while genuine errors still log.

## Test additions (summary)

| Behavior | Test location | Assertion |
|----------|---------------|-----------|
| 1a invite-accept appends | `src/stores/__tests__/auth.test.ts` | `batch.update` called with `{ orgIds: arrayUnion('org-1') }`, not `['org-1']` |
| 1b picker unions claim orgs | `src/stores/__tests__/auth.test.ts` | clobbered `orgIds:['org-2']` + claim `{org-1,org-2}` → memberships lists both, `needsOrgSelection` true |
| 1b R075 interaction | `src/stores/__tests__/auth.test.ts` | 7 exact-count / sequence / prefix updates per Task 2 recipe |
| 2a teardown before signOut | `src/stores/__tests__/auth.test.ts` | `resetOrgScopedStores` invocationCallOrder < `signOut` invocationCallOrder |
| 2b helper swallows permission-denied | `src/utils/__tests__/firestoreListener.test.ts` | permission-denied → no console.error, no throw; other codes → logged |

## Final verification gates

Run from the main checkout (`.env.local` present):

1. `npm run type-check` — MUST be clean (this runs `vue-tsc --build`, which also typechecks the test
   files; the `-p tsconfig.app.json` form is NOT sufficient evidence).
2. `npx vitest run` — bare command only. MUST show exactly ONE failing file:
   `src/storage.rules.test.ts` (Storage-emulator env limitation, the known baseline). Do NOT add
   `--dir src`, do NOT run `src/rules.test.ts` or `render-service/**`. Any other failing file is a
   regression to fix before finishing.

## Commit plan (atomic, direct to master)

- `fix(260830-l9c): append orgIds via arrayUnion on invite accept` (Task 1)
- `fix(260830-l9c): source login picker from claim orgs ∪ orgIds (self-heal)` (Task 2)
- `fix(260830-l9c): reset org-scoped stores before signOut` (Task 3)
- `fix(260830-l9c): swallow permission-denied in logout-surviving snapshot listeners` (Task 4)

## Output

Create `.planning/quick/260830-l9c-fix-multi-church-login-picker-orgids-arr/SUMMARY.md` when done.
