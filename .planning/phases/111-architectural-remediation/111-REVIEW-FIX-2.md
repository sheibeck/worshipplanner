---
phase: 111-architectural-remediation
fixed_at: 2026-09-02T14:22:39Z
review_path: .planning/phases/111-architectural-remediation/111-REVIEW-2.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 111: Code Review Fix Report (Re-Review Fix Pass, Final)

**Fixed at:** 2026-09-02T14:22:39Z
**Source review:** .planning/phases/111-architectural-remediation/111-REVIEW-2.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-03, WR-04, IN-03 — the two Warning residuals + one Info item from the
  ARCH-001 epoch-guard re-review)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-03: `exitSuperAdminView`'s own `resetOrgContext()` call runs without any epoch bump/check

**Files modified:** `src/stores/auth.ts`
**Commit:** 5237b280
**Applied fix:** Added `loadOrgContextEpoch++` at the top of `exitSuperAdminView`, immediately
before its `resetOrgContext()` call and before the "IN-01" viewingAsSuperAdmin-already-null-safe
comment, mirroring the exact idiom `enterOrgAsSuperAdmin` already used. A `loadOrgContext` call
already in flight (possibly already holding a live `memberUnsub` listener) is now superseded by
this bump, so its own `isStale()` checkpoints catch it instead of racing this function's
`resetOrgContext()` teardown.

### WR-04: `resetOrgScopedStores()` calls in `enterOrgAsSuperAdmin`/`selectOrg`/`exitSuperAdminView`/`logout` are not epoch-guarded

**Files modified:** `src/stores/auth.ts`
**Commit:** 18f2af72
**Applied fix:** All four call sites had a `const { resetOrgScopedStores } = await import(...)`
dynamic import — a real `await` point — followed by an unconditional call. Fixed by capturing
`myEpoch` before that await in every one of the four functions (three already captured `myEpoch`
for other reasons — `enterOrgAsSuperAdmin` from the prior WR-02 fix, `exitSuperAdminView` from
this pass's WR-03 fix, `logout` from the prior WR-01 fix; `selectOrg` needed a brand-new capture,
since it previously had no epoch bump of its own and relied entirely on `loadOrgContext`'s
internal guard) and re-checking `myEpoch !== loadOrgContextEpoch` immediately after the import
resolves, before calling `resetOrgScopedStores()`:
- `selectOrg`: bails (returns) entirely if stale — the trailing `loadOrgContext` call is also
  skipped, since it's meaningless to load org context for a superseded selection.
- `enterOrgAsSuperAdmin`: returns `false` if stale, consistent with its existing `Promise<boolean>`
  contract and its own later `if (myEpoch !== loadOrgContextEpoch) return false` checkpoint.
- `exitSuperAdminView`: bails entirely (not just the `resetOrgScopedStores()` call) if stale, so a
  superseded exit doesn't proceed to its own trailing `loadOrgContext()` call either — letting it
  run would re-bump the epoch and incorrectly reclaim "newest" status out from under whatever
  actually superseded this exit.
- `logout`: skips `resetOrgScopedStores()` if stale but **always** still calls `signOut(auth)`
  afterward — sign-out itself must remain reliable even in this narrow race window; only the
  org-scoped store wipe is skipped when superseded.

### IN-03: WR-02's fix has no dedicated overlapping-call regression test

**Files modified:** `src/stores/__tests__/auth.test.ts`
**Commit:** c1b01c21
**Applied fix:** Added
`'a loadOrgContext call still in flight when enterOrgAsSuperAdmin runs never overwrites its result (WR-02 fix)'`
to the `loadOrgContext memberUnsub epoch guard (ARCH-001, Phase 111)` describe block, mirroring the
existing WR-01 regression test's shape: suspends `loadOrgContext` (fired via the initial sign-in)
on its very first await (`users/test-uid`), runs `enterOrgAsSuperAdmin('church-x')` to full
completion while it's still suspended, then resumes the stale call and asserts `orgId`,
`viewingAsSuperAdmin`, and `orgName` still reflect `enterOrgAsSuperAdmin`'s result and that
`onSnapshot` was never called. **Verified non-tautological**: temporarily reverted WR-02's epoch
bump/check in `enterOrgAsSuperAdmin` (in the worktree, never committed) and re-ran this test in
isolation — it failed (`expected null to be 'church-x'`), confirming it genuinely exercises the
WR-02 integration rather than passing vacuously. Reverted back to the fixed code before committing.

## Skipped Issues

None — all three in-scope findings were fixed.

## Gate Results

Run in an isolated worktree (`gsd-reviewfix/111-*`), then fast-forwarded onto `master`.

- **`npm run type-check`** — exits 0 (`vue-tsc --build`, includes test files). Clean.
- **`npx vitest run`** (bare, no `--dir`) — 183/184 files passed, 4973/4999 tests passed (26
  skipped), **1 failing file: `src/storage.rules.test.ts` only** — this is the documented
  Storage-emulator-dependent baseline (CLAUDE.md), not a regression from these fixes.
- **`cd render-service && npm test`** — 39/39 tests passed.
- **`src/stores/__tests__/auth.test.ts`** specifically — 118/118 passed (117 pre-existing + the 1
  new IN-03 regression test), confirming the constraint of keeping all existing auth tests green
  while adding coverage.

No production deploy was performed (build/test/commit only, per instructions).

---

_Fixed: 2026-09-02T14:22:39Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
