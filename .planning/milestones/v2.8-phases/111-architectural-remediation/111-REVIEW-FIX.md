---
phase: 111-architectural-remediation
fixed_at: 2026-09-02T13:41:46Z
review_path: .planning/phases/111-architectural-remediation/111-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 111: Code Review Fix Report

**Fixed at:** 2026-09-02T13:41:46Z
**Source review:** .planning/phases/111-architectural-remediation/111-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, IN-01, IN-02)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Epoch guard only covered the final `onSnapshot` assignment

**Files modified:** `src/stores/auth.ts`
**Commit:** `8094cad1`
**Applied fix:** Rewrote `loadOrgContext` to introduce a local `isStale()` helper (`myEpoch !== loadOrgContextEpoch`) and re-checked it immediately after EVERY `await` and before every subsequent shared-state mutation — `memberships.value`, `orgId.value`, `applyOrgSnapshot(...)`'s writes — and before each of the three `resetOrgContext()` early-return branches (activeId===null, org-doc-read-rejected/deactivated catch, isActive===false). The `memberships.value` assignment was restructured to a check-then-assign pattern (resolve `Promise.all(...)` into a local `resolvedMemberships` first, gate on `isStale()`, then assign) so a superseded call can no longer overwrite a newer call's church-picker list either. The original final tail check (right before the `memberUnsub = onSnapshot(...)` assignment) was kept as an additional last line of defense. Updated the module-scope header comment on `loadOrgContextEpoch` to accurately describe the multi-checkpoint guard instead of claiming a single tail check.

### WR-01: `logout()` and the sign-out branch of `onAuthStateChanged` never incremented `loadOrgContextEpoch`

**Files modified:** `src/stores/auth.ts`
**Commit:** `0b590c6e`
**Applied fix:** Added `loadOrgContextEpoch++` as the first statement in `logout()` and as the first statement inside the `firebaseUser === null` (sign-out) branch of the `onAuthStateChanged` listener, before either function's own state resets and `memberUnsub` teardown. This ensures any `loadOrgContext` call still in flight at sign-out time is invalidated at its very next `isStale()` checkpoint and can never attach a fresh `onSnapshot` listener for an already-signed-out session.

### WR-02: `enterOrgAsSuperAdmin()` mutated shared state without touching `loadOrgContextEpoch`

**Files modified:** `src/stores/auth.ts`
**Commit:** `f9268897`
**Applied fix:** `enterOrgAsSuperAdmin` now captures `const myEpoch = ++loadOrgContextEpoch` at entry (before its `resetOrgContext()` call), so any `loadOrgContext` call already in flight is superseded. It also gates its own final writes (`orgId.value`, `viewingAsSuperAdmin.value`, `applyOrgSnapshot(...)`, `userRole.value`) on `myEpoch === loadOrgContextEpoch`, returning `false` if a newer call (another `enterOrgAsSuperAdmin` or `loadOrgContext`) superseded it while its `getDoc` await was in flight. Verified `selectOrg` needed no change — it does not mutate shared refs directly; it funnels entirely through `loadOrgContext`, which already bumps its own epoch on entry.

### IN-01: Unnecessary optional chaining on `router` in AppShell.vue

**Files modified:** `src/components/AppShell.vue`
**Commit:** `b71b0c9a`
**Applied fix:** Changed `router?.push('/owner-console')` to `router.push('/owner-console')` — `router` comes from `useRouter()` and is never null/undefined inside `setup()`.

### IN-02: `onExitSuperAdminView` gave no user-facing feedback on failure

**Files modified:** `src/components/AppShell.vue`
**Commit:** `cadb1839`
**Applied fix:** Wrapped `await authStore.exitSuperAdminView(); router.push(...)` in a `try/catch`. On rejection, logs `console.error('[AppShell] exitSuperAdminView failed:', err)` and surfaces `toasts.push('Could not exit super-admin view. Please try again.')` via the existing `useToasts` store — the same catch+toast pattern already used by `AppSidebar.vue`'s church-switch failure handling. The `finally` block (re-enabling the `exiting` guard) is unchanged.

## Regression Test Strengthening (beyond the 5 findings)

**Files modified:** `src/stores/__tests__/auth.test.ts`
**Commit:** `84f3417c`
**Applied fix:** The two pre-existing ARCH-001 regression tests both resolved concurrent `loadOrgContext` calls to the SAME org and so never exercised CR-01's unguarded branches. Added two new tests to the `loadOrgContext memberUnsub epoch guard` describe block:

1. **"a superseded call resolving to a DIFFERENT (denied/deactivated) org never clobbers a newer call's live org context (CR-01 fix)"** — drives an older call (org-A) whose `activeId` org-doc read is deliberately deferred until a newer call (org-B) has fully completed and attached its live listener, then rejects the older call's read (simulating a denied/deactivated read). Asserts the older call's `resetOrgContext()` branch never runs: `orgId`/`orgName` stay at org-B's values, `deactivatedOrgMessage` stays null, and org-B's live `memberUnsub` is never torn down.
2. **"a loadOrgContext call still in flight when logout() runs attaches no listener afterward (WR-01 fix)"** — defers a sign-in call's very first `await` (the `users/{uid}` read), runs `logout()` to completion while it's still suspended, then lets the stale call resume. Asserts `onSnapshot` is never called.

Both new tests were verified non-tautological: temporarily swapping in the pre-fix `auth.ts` (from commit `5f7d65f6`, the last commit before any of this session's fixes) and re-running them showed both FAIL against the pre-fix code (`orgId` reverted to `null`/`org-A` instead of staying `org-B`; `onSnapshot` called once instead of zero times) — confirming each test actually exercises the bug it targets. The fixed `auth.ts` was restored afterward and the full 117-test `auth.test.ts` suite re-verified green.

## Skipped Issues

None — all findings and the requested test strengthening were applied successfully.

## No-Regression Gate Results

- `npm run type-check` (`vue-tsc --build`) — **exits 0**, no errors in any modified file or elsewhere.
- Bare `npx vitest run` — **183/184 test files pass** (4972 tests passed, 26 skipped). The single failing file is `src/storage.rules.test.ts` (Storage-emulator `firestore.exists()` cross-service limitation — documented pre-existing environment limitation per CLAUDE.md, not a regression). This matches the documented baseline exactly.
- `cd render-service && npm test` — **39/39 tests pass**.
- No production deploy was performed, per constraints.

---

_Fixed: 2026-09-02T13:41:46Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
