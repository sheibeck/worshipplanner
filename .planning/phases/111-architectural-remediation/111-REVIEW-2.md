---
phase: 111-architectural-remediation
reviewed: 2026-09-02T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/stores/auth.ts
  - src/components/AppShell.vue
  - src/stores/__tests__/auth.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 111: Code Review Report (Re-Review)

**Reviewed:** 2026-09-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Re-reviewed the fix for `111-REVIEW.md`'s CR-01/WR-01/WR-02/IN-01/IN-02 findings (commits
8094cad1, 0b590c6e, f9268897, b71b0c9a, cadb1839, 84f3417c). Traced every `await` in
`loadOrgContext` against every subsequent write to `memberships`, `orgId`, `applyOrgSnapshot`'s
fields, and each of the three `resetOrgContext()` early-return branches, and ran the full
`auth.test.ts` suite (117 tests, all passing).

**All five findings from the prior review are genuinely closed:**

- **CR-01 (BLOCKER) — CLOSED.** `isStale()` is now re-checked immediately before every
  shared-state mutation and before each of the three `resetOrgContext()` branches
  (`auth.ts:430, 442, 485, 503, 508, 517, 533, 538, 552, 567`), with no unguarded await→mutation
  window remaining. The new regression test at `auth.test.ts:2042` ("a superseded call resolving
  to a DIFFERENT (denied/deactivated) org never clobbers a newer call's live org context")
  reproduces exactly the scenario the prior review described (older call's `resetOrgContext()`
  resolving after a newer call has already attached its listener) and is a genuine, non-tautological
  test — it fails against the pre-fix code (the catch branch's `resetOrgContext()` was
  unconditional) and passes now.
- **WR-01 — CLOSED.** `logout()` (`auth.ts:834`) and the sign-out branch of `onAuthStateChanged`
  (`auth.ts:619`) both increment `loadOrgContextEpoch` as their first action, before any other
  reset. The new regression test at `auth.test.ts:2126` ("a loadOrgContext call still in flight
  when logout() runs attaches no listener afterward") confirms a call suspended before `logout()`
  runs can no longer attach a listener afterward.
- **WR-02 — CLOSED.** `enterOrgAsSuperAdmin` (`auth.ts:663-694`) now captures its own `myEpoch`
  and bumps `loadOrgContextEpoch` at entry, then re-checks it (`auth.ts:688`) immediately before
  writing `orgId.value`/`viewingAsSuperAdmin.value`/`applyOrgSnapshot`/`userRole.value`. A
  `loadOrgContext` call already in flight is correctly superseded.
- **IN-01 — CLOSED.** `AppShell.vue:90` now calls `router.push('/owner-console')` with no
  optional chaining.
- **IN-02 — CLOSED.** `onExitSuperAdminView` (`AppShell.vue:83-101`) now wraps the await in
  `try/catch`, logs, and surfaces `toasts.push(...)` on failure.

No false-supersede issue was found: the epoch capture (`myEpoch = ++loadOrgContextEpoch`) always
reflects the truly-latest call at the moment it starts, and only a call that started *after* the
current one can ever make `isStale()` return true for it — a legitimate, non-superseded call is
never incorrectly dropped. The two ARCH-001 tests that predate this fix ("interleaved second
loadOrgContext" and "normal, non-overlapping church switch") still pass, confirming the hardened
guard does not regress the church-switch re-subscribe path.

Two residual gaps were found during this re-review, in code adjacent to (but not named by) the
prior review's findings — both are narrower in blast radius than CR-01 and neither leaves
`memberUnsub` un-torn-down or reintroduces the exact bug the prior review flagged, so both are
classified as Warnings rather than a new Blocker.

## Warnings

### WR-03: `exitSuperAdminView`'s own `resetOrgContext()` call runs without any epoch bump/check, unlike `enterOrgAsSuperAdmin`

**File:** `src/stores/auth.ts:698-717`
**Issue:** `enterOrgAsSuperAdmin` was fixed to capture `myEpoch = ++loadOrgContextEpoch` *before*
calling `resetOrgContext()`, so that call runs under a freshly-bumped epoch that supersedes any
older in-flight `loadOrgContext`. `exitSuperAdminView` calls `resetOrgContext()` (line 702) with
no epoch bump beforehand at all:

```ts
async function exitSuperAdminView(): Promise<void> {
  if (viewingAsSuperAdmin.value === null) return
  resetOrgContext()   // <-- unconditional; no ++loadOrgContextEpoch first
  const { resetOrgScopedStores } = await import('./orgScopedStores')
  resetOrgScopedStores()
  if (user.value) {
    await loadOrgContext(user.value.uid, false)   // this nested call IS epoch-guarded
  }
}
```

If a `loadOrgContext` call is concurrently in flight and has *already* attached its `memberUnsub`
listener (using a later epoch than whatever the counter was when the super-admin session began)
by the moment a user clicks "Exit to owner console," this `resetOrgContext()` unconditionally
tears that live listener down and clears `orgId`/`orgName`/`settings` — the same class of bug
CR-01 fixed for `loadOrgContext`'s own branches, but here for `exitSuperAdminView`'s call site.
The subsequent `loadOrgContext(...)` call at the end does correctly re-load, so the window is
self-healing once that call completes, but there is a real interval during which a legitimate,
already-loaded org context is wiped by a stale exit action. The header comment's claim that
"defense-in-depth ... protects ALL callers ... via exitSuperAdminView" is technically accurate
(it describes the *nested* `loadOrgContext` call, which is guarded) but does not cover this
earlier `resetOrgContext()` call, which is not.

**Fix:** Bump the epoch in `exitSuperAdminView` before its own `resetOrgContext()` call, matching
`enterOrgAsSuperAdmin`'s pattern:

```ts
async function exitSuperAdminView(): Promise<void> {
  if (viewingAsSuperAdmin.value === null) return
  loadOrgContextEpoch++ // invalidate any loadOrgContext call already in flight
  resetOrgContext()
  ...
}
```

### WR-04: `resetOrgScopedStores()` calls in `enterOrgAsSuperAdmin`/`selectOrg`/`exitSuperAdminView`/`logout` are not epoch-guarded

**File:** `src/stores/auth.ts:649-650, 678-679, 706-707, 856-857`
**Issue:** Each of these four call sites does `const { resetOrgScopedStores } = await import(...)`
then invokes it unconditionally, with no `isStale()`/epoch check either before the dynamic
`import()` await or before calling the function it resolves to. Only the *auth-store* state
(`orgId`, `memberships`, `applyOrgSnapshot`'s writes, `memberUnsub`) is epoch-protected by this
fix; the org-scoped Pinia stores (services/songs/roster, etc.) it resets are not. If call A
(superseded) is suspended on the dynamic import while call B (newer) starts, finishes, and its
watchers begin repopulating the org-scoped stores for B's org, A resuming and calling
`resetOrgScopedStores()` will wipe that freshly-loading data. Because `resetOrgScopedStores()`
does not itself change `orgId`, the per-view `watch(() => authStore.orgId, ...)` re-subscribe
pattern (`church-switch-resubscribe-fix`) will not necessarily re-fire to repopulate them, so the
wipe is not obviously self-healing. The window is narrow (requires two of these calls to overlap,
which the UI-level guards — `switchingId`, `enteringOrgId`, `exiting` — largely prevent for
same-widget double-clicks) but is not prevented for cross-path races (e.g. an
`enterOrgAsSuperAdmin` call racing against a still-settling initial `onAuthStateChanged` load).
**Fix:** Capture `myEpoch` in each of these four functions before the dynamic import, and check
`isStale()` immediately before calling `resetOrgScopedStores()` (and again before each subsequent
shared-state write), the same way `loadOrgContext` now does for its own mutation points.

## Info

### IN-03: WR-02's fix has no dedicated overlapping-call regression test

**File:** `src/stores/__tests__/auth.test.ts`
**Issue:** CR-01 and WR-01 each got a new, non-tautological regression test that fails against
the pre-fix code (`auth.test.ts:2042` and `:2126`). `WR-02` (the `enterOrgAsSuperAdmin` epoch
integration) has no equivalent — the existing `enterOrgAsSuperAdmin` describe block
(`auth.test.ts:1799-1954`) exercises success/failure/no-membership-doc behavior but never drives
an overlapping in-flight `loadOrgContext` call against `enterOrgAsSuperAdmin` to prove the epoch
bump actually supersedes it. The fix was verified correct by code inspection in this re-review,
but nothing in the suite would catch a future regression to this specific integration point.
**Fix:** Add a test mirroring `auth.test.ts:2126`'s shape — start a `loadOrgContext` call, suspend
it on its first `await`, call `enterOrgAsSuperAdmin` to completion, then let the suspended call
resume and assert it never overwrites `orgId`/`viewingAsSuperAdmin`/`settings` and never attaches
a `memberUnsub` listener.

---

_Reviewed: 2026-09-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
