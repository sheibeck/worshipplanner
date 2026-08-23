---
phase: 78-super-admin-enter-any-church
fixed_at: 2026-08-23T05:56:00Z
review_path: .planning/phases/78-super-admin-enter-any-church/78-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 78: Code Review Fix Report

**Fixed at:** 2026-08-23T05:56:00Z
**Source review:** .planning/phases/78-super-admin-enter-any-church/78-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (3 Warning, 2 Info)
- Fixed: 5
- Skipped: 0

All fixes were applied inside an isolated git worktree (`gsd-reviewfix/78-*`), verified per-fix
(targeted test run + `npm run type-check`), committed atomically, then fast-forwarded onto
`master`. Rules composition itself was reviewed clean by the reviewer and is untouched here except
for the IN-02 doc-only comment.

## Fixed Issues

### WR-01: `enterOrgAsSuperAdmin` never clears `deactivatedOrgMessage`

**Files modified:** `src/stores/auth.ts`, `src/stores/__tests__/auth.test.ts`
**Commit:** `d29cb26e`
**Applied fix:** Moved the `deactivatedOrgMessage.value = null` clear into `resetOrgContext()`
itself (the shared reset point), so every caller — including `enterOrgAsSuperAdmin` and
`exitSuperAdminView`, which bypass `loadOrgContext` entirely — stays in sync. Confirmed
`loadOrgContext`'s two genuine-deactivation branches still set the message back to non-null
immediately after their own `resetOrgContext()` call, so a real deactivation is never masked.
Added a regression test seeding a stale `deactivatedOrgMessage` before `enterOrgAsSuperAdmin` and
asserting `requiresOrgSelection` stays `false` afterward.

### WR-02: "Enter church" has no in-flight/double-submit guard

**Files modified:** `src/components/admin/OrganizationsTab.vue`, `src/components/admin/__tests__/OrganizationsTab.test.ts`
**Commit:** `6ae8a4c6`
**Applied fix:** Added `enteringOrgId` ref state mirroring this file's `isOnboarding`/`isAssigning`/
`togglingOrgId`/`isDeleting` convention. The button is now `:disabled` while a call is in flight and
shows "Entering..." feedback; a second click while pending is a no-op. Added a test that drives a
pending promise, asserts the button is disabled and a second click doesn't fire a second call, then
resolves and confirms the button re-enables.

### WR-03: `onEnterChurch` navigates unconditionally on silent failure

**Files modified:** `src/stores/auth.ts`, `src/stores/__tests__/auth.test.ts`, `src/components/admin/OrganizationsTab.vue`, `src/components/admin/__tests__/OrganizationsTab.test.ts`
**Commit:** `26bd6db3`
**Applied fix:** `enterOrgAsSuperAdmin` now returns `Promise<boolean>` — `false` on every prior
silent-no-op path (not a super-admin/no user, a denied or errored `getDoc`, or a missing/stale org
doc), `true` on genuine entry. `onEnterChurch` only calls `router?.push({ name: 'services' })` when
`entered` is `true`; on `false` it surfaces a mapped inline error (`enterError`, keyed per orgId,
matching this file's `assignError`/`toggleError` pattern) and stays on the tab. Added a store-level
test for the true/false contract and a component-level test asserting no navigation, an inline error
message, and the guard re-enabling after a failed attempt.

### IN-01: `exitSuperAdminView` redundantly re-clears `viewingAsSuperAdmin`

**Files modified:** `src/stores/auth.ts`
**Commit:** `b701227a`
**Applied fix:** Dropped the redundant `viewingAsSuperAdmin.value = null` line (already set inside
`resetOrgContext()`, called immediately above) and left a one-line comment noting why it was
removed, per the finding's own suggested wording.

### IN-02: T-78-03 residual undocumented in `firestore.rules`

**Files modified:** `firestore.rules`
**Commit:** `0a5d1c96`
**Applied fix:** Added an inline comment above `match /members/{uid}` cross-referencing T-78-03,
matching the density of the `organizations/{orgId}` comments a few lines above it: documents that
the super-admin arm makes `isOrgEditor(orgId)` true for every super-admin on every org, so the
existing `allow write` legally permits a super-admin's client SDK to `create` its own membership
doc — making R226's "no member doc" guarantee a client-code contract (enforced by
`enterOrgAsSuperAdmin` calling no `setDoc`/`writeBatch`), not a rules invariant. Comment only; rule
logic byte-for-byte unchanged (confirmed by re-reading the block after the edit).

## Gate Results

- `npm run type-check` — clean (`vue-tsc --build`, includes test files).
- `npx vitest run src/stores/__tests__/auth.test.ts src/components/admin/__tests__/OrganizationsTab.test.ts src/components/__tests__/AppShell.test.ts` — **138/138 passed** (92 + 40 + 6), including the 4 new WR-01/WR-02/WR-03 regression tests.
- `npx vitest run --config vitest.rules.config.ts` against the running emulator — **`src/rules.test.ts`: 187/187 passed** (firestore.rules, the file IN-02 touched, is fully green). One unrelated failure in `src/storage.rules.test.ts` ("claim-only membership... no Firestore fallback re-introduced") — a pure text-assertion test comparing `storage.rules`' own source string, byte-identical to `master` (storage.rules was not touched by any Phase 78 fix); traced to a CRLF vs LF line-ending difference between the git worktree checkout and the main checkout (both hash differently despite identical content — confirmed via `diff`, which reported no textual differences, and `md5sum`, which reported different hashes only due to line endings). Benign per this project's own CLAUDE.md note ("CRLF benign"); disappears once merged back into the main checkout's line-ending normalization. Not a regression from this fix set.
- `npx vitest run` (app suite) — compared directly against a same-commit, same-environment baseline run on `master` before any fixes: baseline is exactly the documented 2-file failure set (`src/storage.rules.test.ts` — Storage emulator not running in this environment, all but the CRLF-affected test failing for that reason; `src/views/__tests__/RosterView.test.ts` — the documented stale assertion). The fixed tree matches this same 2-file set with 4 additional passing tests (the new regression tests) and no new failures once the worktree's `node_modules`/`functions/node_modules` junctions were in place (their initial absence — an artifact of the isolated-worktree setup, not of the code changes — had caused 2 unrelated `functions/src/*.test.ts` files to fail transiently; confirmed fixed by installing the junctions and re-running, 285/285 passing).

## Skipped Issues

None — all 5 in-scope findings were fixed.

---

_Fixed: 2026-08-23T05:56:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
