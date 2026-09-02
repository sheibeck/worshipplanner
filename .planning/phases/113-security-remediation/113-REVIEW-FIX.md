---
phase: 113-security-remediation
fixed_at: 2026-09-02T20:36:00Z
review_path: .planning/phases/113-security-remediation/113-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 113: Code Review Fix Report

**Fixed at:** 2026-09-02T20:36:00Z
**Source review:** .planning/phases/113-security-remediation/113-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01 critical, WR-01 warning, IN-01 info)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: SEC-S-01's shareTokens get/list split breaks the deleteService cleanup query, silently leaving public share links live forever after the service is deleted

**Files modified:** `firestore.rules`, `src/stores/services.ts`, `src/rules.test.ts`
**Commit:** `0bceb59c`
**Applied fix:**
- `firestore.rules` — `shareTokens/{token}`'s `allow list: if false;` replaced with
  `allow list: if isSignedIn() && isOrgEditor(resource.data.orgId);`. An org editor can
  now list their own org's tokens; unauthenticated and cross-org callers remain denied
  (Firestore only admits a data-dependent list rule when the query itself carries a
  matching equality filter, which is what makes the next change necessary).
- `src/stores/services.ts` — `deleteService()`'s shareTokens cleanup query gained
  `where('orgId', '==', orgId.value)` alongside the existing `where('serviceId', '==', id)`,
  satisfying the rule's `resource.data.orgId` check.
- `quarterShares`/`serviceShares` were left untouched (`allow list: if false;` unchanged)
  per the fix guidance — confirmed via grep that no app code issues a `getDocs`/collection
  query against either collection (both use direct-keyed `getDoc`/`deleteDoc`), so no
  legitimate `list` op exists there to unblock.
- `src/rules.test.ts` — added 3 tests: an ALLOW for an org editor listing their own org's
  shareTokens with the exact `where('serviceId','==',...) + where('orgId','==',...)` shape
  `deleteService` now issues; a DENY for an authenticated editor of a different org listing
  orgA's shareTokens with the same query shape (cross-org enumeration); a DENY for an
  authenticated user with no org membership issuing an unconstrained collection list. The
  pre-existing unauthenticated-list DENY test (the SEC-S-01 leak proof) was kept unchanged.

**Verification:** `src/stores/__tests__/services.test.ts` (109/109 pass, including the
existing 2+-token deletion test whose `where('serviceId','==',...)` assertion is
unaffected by the added second `where` clause). `npx vitest run --config
vitest.rules.config.ts` against the running emulator: `src/rules.test.ts` 206/206 pass
(3 new); `src/storage.rules.test.ts` fails with the documented Storage-emulator
cross-service `exists()` limitation (CLAUDE.md), not a regression.

### WR-01: revokeRefreshTokens is never called when a member is removed from a non-primary org

**Files modified:** `functions/src/orgMembershipClaims.ts`, `functions/src/orgMembershipClaims.test.ts`
**Commit:** `3891da7d`
**Applied fix:** `syncOrgMembershipClaimHandler`'s `skip` branch now diffs the org keys in
the existing `orgs` claim against the freshly recomputed `desiredOrgs` map *before* writing
the recomputed claim. If any key present in the existing claim is absent from the
recomputed map, that is a genuine membership removal (a role change or an unrelated org's
active-flag flip only ever adds/modifies entries, never drops one), and
`getAuth().revokeRefreshTokens(uid)` fires non-blocking (try/catch, logged) after the claim
write lands — mirroring the primary-org `clear` branch's existing revoke call exactly.
Added two tests: one proving a genuine non-primary-org removal now revokes, one proving a
non-primary-org role change (no key dropped) does NOT revoke — the negative case that keeps
this fix narrowly scoped to actual removals.

**Verification:** `functions/src/orgMembershipClaims.test.ts` 52/52 pass (2 new). Full
functions suite (`cd functions && npm test`) 639/639 pass (18 files), no regressions.

### IN-01: preservesLifecycleFields()'s "create" branch is now dead code

**Files modified:** `firestore.rules`
**Commit:** `dea73713`
**Applied fix:** Removed the unreachable `resource == null ? ... : ...` create-branch
ternary from `preservesLifecycleFields()`, since SEC-ISO-01 removed the only `allow create`
clause on `organizations/{orgId}` that ever invoked it in create context — it is now called
exclusively from `allow update`, where `resource` is guaranteed non-null by Firestore's own
operation semantics. Left a comment explaining why the branch was safe to remove.

**Verification:** `npx vitest run --config vitest.rules.config.ts`: `src/rules.test.ts`
206/206 pass unchanged (the "Org lifecycle field guard" describe block, ~20 tests covering
both the update-path lifecycle guard and the SEC-ISO-01 no-client-create-path assertion,
all still pass).

## Skipped Issues

None — all findings were fixed.

## Gate Results

| Gate | Result |
|---|---|
| `npx vitest run --config vitest.rules.config.ts` (rules suite, emulator on :8080) | `src/rules.test.ts` 206/206 pass; `src/storage.rules.test.ts` fails on the documented Storage-emulator `exists()` cross-service limitation (not a regression, per CLAUDE.md) |
| `npm run type-check` (`vue-tsc --build`) | Exits 0, no errors |
| `npx vitest run` (bare, app suite) | 4976 passed, 27 skipped, 1 file failed (`src/storage.rules.test.ts` — same documented baseline) — matches the documented single-file baseline exactly |
| `cd functions && npm test` | 639/639 pass (18 files) |

No production deploy was performed. All three fixes are committed atomically on
`gsd-reviewfix/113-208966`, fast-forward-merged into `master` by the fixer's worktree
cleanup tail.

---

_Fixed: 2026-09-02T20:36:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
