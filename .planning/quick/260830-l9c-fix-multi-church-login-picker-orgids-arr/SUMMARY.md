---
quick_id: 260830-l9c
slug: fix-multi-church-login-picker-orgids-arr
date: 2026-08-30
status: complete
scope: client-only (src/stores/auth.ts + a new shared listener-error helper)
deploy: firebase deploy --only hosting (owner-run)
gates:
  type_check: pass (vue-tsc --build)
  auth_test_suite: 104/104
  firestoreListener_test_suite: 7/7
  full_app_suite: exactly 1 failing file (src/storage.rules.test.ts — Storage-emulator baseline, unchanged), all other 171 files green
---

# Summary — Fix multi-church login picker (orgIds overwrite) and permission-denied on sign-out

Fixed two independent, fully-diagnosed production bugs in `src/stores/auth.ts`: (1) the
multi-church login picker only ever showed one church because invite-acceptance REPLACED
`users/{uid}.orgIds` instead of appending, and (2) sign-out logged `permission-denied` /
"Uncaught Error in snapshot listener" because org-scoped store listeners and two component
listeners were still attached when the auth token was revoked. Client-only — no
firestore.rules/Cloud Functions/deploy changes, no worktrees (sequential on `master`).

## Task Commits

1. **Task 1: Bug 1a — invite-accept APPENDS orgIds via `arrayUnion`** — `94488be5`
   (`fix(260830-l9c): append orgIds via arrayUnion on invite accept`)
2. **Task 2: Bug 1b — self-heal the picker from `claims.orgs` union `orgIds`** — `33f4e18f`
   (`fix(260830-l9c): source login picker from claim orgs union orgIds (self-heal)`)
3. **Task 3: Bug 2a — `logout()` resets org-scoped stores before `signOut`** — `338f550c`
   (`fix(260830-l9c): reset org-scoped stores before signOut`)
4. **Task 4: Bug 2b — shared listener-error helper + wire into logout-surviving listeners** — `b4611708`
   (`fix(260830-l9c): swallow permission-denied in logout-surviving snapshot listeners`)

## Files Created/Modified

- `src/stores/auth.ts` — three changes across Tasks 1-3:
  - `ensureUserDocument`'s invite-acceptance batch now writes
    `batch.update(userRef, { orgIds: arrayUnion(inviteOrgId) })` instead of
    `{ orgIds: [inviteOrgId] }` — appends, never replaces, so a user's original primary org
    (`orgIds[0]`, which `functions/src/orgMembershipClaims.ts`'s `decideMembershipClaim` reads)
    survives a second church's invite.
  - `loadOrgContext` now reads the authoritative `orgs` custom claim
    (`getIdTokenResult(user, false)` — unforced, cheap) at the top of the function and unions
    its keys with `users/{uid}.orgIds`, orgIds first (preserves primary-org-leads-the-picker
    ordering), deduped. Every downstream use (`memberships` build, `readRememberedOrg`/
    `ids.includes`, `activeId` resolution) reads this union, so a clobbered account (`orgIds`
    shorter than the claim) self-heals with zero manual Firestore repair and correctly routes
    to the picker instead of auto-entering the stale single-element `orgIds`.
  - `logout()` now calls `const { resetOrgScopedStores } = await import('./orgScopedStores')`
    then `resetOrgScopedStores()` immediately before `await signOut(auth)`, using the same
    dynamic-import pattern `selectOrg`/`enterOrgAsSuperAdmin`/`exitSuperAdminView` already use —
    all 11 org-scoped store listeners are torn down before the token is revoked.
- `src/stores/__tests__/auth.test.ts` — extensive additions/updates:
  - `arrayUnion` added to the `firebase/firestore` mock; `writeBatch`'s mock now returns a
    STABLE object with a persistent `mockBatchUpdate` spy (was a fresh object per call) so
    `batch.update` args are assertable. New test asserts the invite-accept path calls
    `mockBatchUpdate` with `{ orgIds: { __arrayUnion: 'org-1' } }`, proving append not replace.
  - New self-heal test: a clobbered `orgIds: ['org-2']` fixture with claim
    `{ orgs: { 'org-1': 'editor', 'org-2': 'editor' } }` asserts `memberships` lists both
    (orgIds-first ordering), `orgId` is null, and `needsOrgSelection`/`requiresOrgSelection`
    are true.
  - The 7-test "org claim refresh (R075 / P-01)" recipe from PLAN.md Task 2 applied exactly:
    call-count assertions shifted by the one new leading unforced read, one test title
    corrected to "performs no FORCED refresh...", and the throwing-refresh test's assertion
    prefix moved from `'[auth] refreshOrgClaim:'` to `'[auth] loadOrgContext claim read:'`.
  - **Beyond the plan's explicit recipe** (Rule 1 — the same top-read shift silently broke
    these too, since they also chain `getIdTokenResult` mocks): 4 additional tests outside the
    R075 describe block — one in "deactivated org login-block" (`a super-admin whose own read
    of a deactivated org succeeds is NOT blocked`) and three in `isSuperAdmin (R177)`
    (`becomes true when...`, `resets to false on logout`, `resets to false when
    onAuthStateChanged fires with no user`) — each got a leading `mockResolvedValueOnce({
    claims: {} })` prepended so the intended `superAdmin: true` value still lands on the
    FORCED `refreshOrgClaim` call rather than being silently consumed by the new top read.
    Without this fix these 4 tests would have failed after Task 2 landed. A 5th similar test
    (`stays false when the refreshed token has no superAdmin claim`) was left unchanged — its
    assertion (`isSuperAdmin` false) holds regardless of which call consumes the mocked value,
    so no fix was needed there.
  - New `vi.mock('../orgScopedStores', ...)` with a `resetOrgScopedStores: vi.fn()` spy; new
    `logout` describe-block test asserts it was called and that its
    `invocationCallOrder` precedes `signOut`'s.
- `src/utils/firestoreListener.ts` — **new**. `isPermissionDenied(err)` narrows `unknown` to
  check `.code === 'permission-denied'`; `ignorePermissionDenied(context)` returns an
  `onSnapshot` error callback that swallows exactly that code and `console.error`s everything
  else with a `[context]` prefix.
- `src/utils/__tests__/firestoreListener.test.ts` — **new**, 7 tests covering both functions
  (permission-denied true/false across several shapes; the returned handler's throw/no-throw
  and console.error call behavior for each code).
- `src/views/TeamView.vue` — `membersUnsub`/`invitesUnsub` `onSnapshot` calls gained
  `ignorePermissionDenied('TeamView members')` / `ignorePermissionDenied('TeamView invites')`
  as their 3rd argument (previously no `onError` at all — the real "Uncaught Error" offender,
  reachable by ordinary editors).
- `src/components/GettingStarted.vue` — its member-count `onSnapshot` gained
  `ignorePermissionDenied('GettingStarted memberCount')` (previously no `onError` — hit by
  every user on the dashboard at logout).
- `src/stores/appConfig.ts` — `subscribe()`'s existing `onError` now wraps ONLY its
  `console.error('[appConfig store] subscription error:', err)` line in
  `if (!isPermissionDenied(err))`; `loadError.value`/`loaded.value` state-setting is
  unchanged.
- `src/components/admin/ConfigurationTab.vue` — `superAdminsUnsub`'s existing `onError`
  gets the same quiet-guard treatment around its `console.error` call; `loaded.value = true`
  unchanged.

## Decisions Made

- **Self-heal via claim union (Decision 1b), not a manual data-repair-only fix (1a alone).**
  1a alone only fixes FUTURE invites; every already-clobbered account (including the owner's)
  would stay broken until a manual Firestore repair — explicitly out of scope. Unioning the
  authoritative `orgs` claim into the picker source self-heals current production accounts
  with zero data surgery, at the cost of one extra unforced `getIdTokenResult` read per
  org-context load.
- **The union feeds BOTH `memberships` and `activeId`**, not just the picker list — otherwise a
  clobbered user (`orgIds: ['org-2']`, claim `{org-1, org-2}`) would still auto-enter org-2 via
  the single-element `orgIds` `activeId` shortcut, and the picker would never show.
- **onError suppression scope (Decision 2b) — minimal-but-complete.** Only the two genuinely
  uncaught component listeners (TeamView, GettingStarted) got the full `ignorePermissionDenied`
  callback; the two already-handled super-admin listeners (appConfig, ConfigurationTab) got a
  narrower quiet-guard around just their `console.error` line, preserving their existing
  state-setting exactly. The 11 org-scoped store listeners and the auth `memberUnsub` were
  deliberately excluded — after Task 3, they're torn down before `signOut` and no longer live
  in the token-revocation window.
- **Extended the R075 mock-recipe fix to 4 tests outside its describe block** (see Files
  section above) rather than leaving them to fail — this is the same mechanical
  leading-value-shift the plan's recipe already established for the R075 suite, just applied
  to sibling tests the plan's text didn't explicitly enumerate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Four additional tests outside the R075 describe block needed the same
leading-mock-value fix the plan's Task 2 recipe applied to the R075 suite.**
- **Found during:** Task 2 verification (`npx vitest run src/stores/__tests__/auth.test.ts`
  after applying only the plan's explicitly-listed R075 changes).
- **Issue:** The new unconditional top-of-`loadOrgContext` unforced `getIdTokenResult` read
  consumes the first queued `mockResolvedValueOnce` value in any test that sets one — including
  tests outside the R075 block that set a `superAdmin: true` claim expecting it to land on the
  FORCED `refreshOrgClaim` call. Without a fix, the intended claim value was silently consumed
  by the new top read instead, leaving `isSuperAdmin` (or the deactivation-exemption check that
  reads it) at its stale/default value.
- **Fix:** Prepended a leading `mockResolvedValueOnce({ claims: {} })` to each affected test's
  `getIdTokenResult` mock chain, mirroring the exact pattern the plan's own recipe used for the
  R075 "just-joined, claim present on the first refresh" test.
- **Files modified:** `src/stores/__tests__/auth.test.ts`
  (`a super-admin whose own read of a deactivated org succeeds is NOT blocked`,
  `becomes true when the refreshed token carries claims.superAdmin === true`,
  `resets to false on logout`, `resets to false when onAuthStateChanged fires with no user
  (sign-out event)`).
- **Commit:** `33f4e18f` (folded into Task 2's commit, same root cause).

No other deviations — Tasks 1, 3, and 4 executed exactly as written, including the exact
per-test R075 recipe from PLAN.md Task 2.

## Gates

- `npx vitest run src/stores/__tests__/auth.test.ts` — 104/104 passing (after Task 3: was 102
  after Task 1, 103 after Task 2's self-heal test, 104 after Task 3's ordering test).
- `npx vitest run src/utils/__tests__/firestoreListener.test.ts` — 7/7 passing.
- `npx vitest run src/views/__tests__/TeamView.test.ts src/components/__tests__/GettingStarted.test.ts src/components/admin/__tests__/ConfigurationTab.test.ts` —
  25/25 passing (no regressions from the new `onSnapshot` 3rd-argument / quiet-guard wiring).
- `npm run type-check` (`vue-tsc --build`, full form per CLAUDE.md) — clean, run after every
  task.
- Bare `npx vitest run` (full app suite, final gate) — 4688 passed / 25 failed / 4713 total
  across 172 files; **exactly one failing file**, `src/storage.rules.test.ts` (all 25 failures
  are 5-second connection timeouts to a Storage emulator that was not running — the documented
  Storage-emulator baseline, unrelated to this change and explicitly out of scope to fix). No
  new failures introduced.

## Outstanding

- **Owner redeploy:** `firebase deploy --only hosting` (client-only; no functions/rules changes
  in scope). No production Firestore data repair is needed — Task 2's self-heal makes the
  owner's previously-clobbered account (and any other affected account) resolve correctly on
  next login with no manual intervention.

## Self-Check: PASSED

All created/modified files verified present on disk (`src/stores/auth.ts`,
`src/stores/__tests__/auth.test.ts`, `src/utils/firestoreListener.ts`,
`src/utils/__tests__/firestoreListener.test.ts`, `src/views/TeamView.vue`,
`src/components/GettingStarted.vue`, `src/stores/appConfig.ts`,
`src/components/admin/ConfigurationTab.vue`); all four task commits (`94488be5`, `33f4e18f`,
`338f550c`, `b4611708`) verified present in git history via `git log --oneline`.
