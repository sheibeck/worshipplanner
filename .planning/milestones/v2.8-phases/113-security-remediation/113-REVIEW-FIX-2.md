---
phase: 113-security-remediation
fixed_at: 2026-09-02T21:01:55Z
review_path: .planning/phases/113-security-remediation/113-REVIEW-2.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 113: Code Review Fix Report (Re-Review 2)

**Fixed at:** 2026-09-02T21:01:55Z
**Source review:** .planning/phases/113-security-remediation/113-REVIEW-2.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (CR-02 critical, IN-02 info)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### CR-02: `ensureShareLink()`'s adoption query on `shareTokens` was not org-scoped, and now fails under the CR-01 list rule — breaks the primary share-link creation path

**Files modified:** `src/stores/services.ts`, `firestore.rules`, `src/rules.test.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** `93d418bf`
**Applied fix:** Added `where('orgId', '==', orgIdValue)` to `ensureShareLink()`'s adoption query
(`src/stores/services.ts:814`), mirroring the pattern already applied to `deleteService()`. Confirmed
`orgIdValue` is populated at both call sites — the auto-link fired from `createService()`
(`services.ts:316`, passes `orgId.value`) and the manual Share button path via `createShareToken()`
(`services.ts:874`, passes through its own `orgIdValue` param) — so neither path can hit this query with
an empty orgId. Also confirmed via `pickAdoptableToken` (`src/utils/shareTokens.ts:74`) that the JS-side
adoption logic already filters candidates to the caller's own org, so the added server-side filter changes
nothing about which token gets adopted — it only makes the query satisfiable under the CR-01 list rule.

Updated the stale `firestore.rules` comment (introduced by the CR-01 fix) that incorrectly claimed
`deleteService()` was "the ONE legitimate list this collection needs" — it now documents both call sites
and points to CR-02 for the second one, so this class of gap (an overlooked second call site with the
same query shape) is less likely to recur silently.

**Shape-check across the codebase for other unscoped `shareTokens` list/getDocs sites (per the fix
instructions):**

| Call site | Scoping status |
|---|---|
| `src/stores/services.ts:521` `deleteService()` | Already scoped (fixed in the original CR-01 pass; `where('serviceId','==',id)` + `where('orgId','==',orgId.value)`) |
| `src/stores/services.ts:814` `ensureShareLink()` adoption query | **Fixed this pass** — added `where('orgId','==',orgIdValue)` |
| `functions/src/index.ts:2415` `resolveServiceShareUrl()`-style helper (`db.collection("shareTokens").where("serviceId","==",serviceId).get()`) | **Not scoped, and does not need to be.** This file imports `firebase-admin/firestore` (confirmed at `functions/src/index.ts:6-13`) — the Admin SDK bypasses Firestore Security Rules entirely, so the org-gated `allow list` rule never applies to it and it cannot hit `permission-denied`. Left unchanged. |
| `src/stores/quarters.ts` | Only a comment mentioning `shareTokens` plus direct `getDoc`/`setDoc`/`deleteDoc` calls by known doc id — no `list`/`getDocs`/`query` call at all. Not applicable. |
| `src/utils/shareTokens.ts`, `src/utils/__tests__/shareTokens.test.ts`, `src/stores/__tests__/quarters.test.ts`, `src/views/QuarterShareView.vue`, `src/views/ShareView.vue` | Grepped — no `list`/`getDocs`/`query` call sites on `shareTokens` in any of these; only type/test/component references to tokens already resolved elsewhere. |

Confirmed exhaustive via `grep -rn "collection(.*shareTokens\|getDocs.*shareTokens\|query(.*shareTokens"`
across `src/` and `functions/` — no other call sites exist beyond the two client-side ones and the one
Admin SDK one listed above.

**Regression tests added** (`src/rules.test.ts`, in the `shareTokens` describe block):
- `DENIES (CR-02) the old unscoped shareTokens list shape ensureShareLink used to issue (serviceId only, no orgId filter)` — proves the bug: a bare `where('serviceId','==',...)` query is rejected outright under the org-gated rule, regardless of the caller's role.
- `ALLOWS (CR-02) the fixed ensureShareLink adoption query shape (serviceId + own-org orgId filter)` — proves the fix: the same query with the added `orgId` filter succeeds for an org editor listing their own org's tokens.

Also strengthened the existing unit test `the adoption query is equality-only (no composite index)`
(`src/stores/__tests__/services.test.ts`) with an added assertion that `where` was called with
`('orgId', '==', 'org-1')`, so a future regression that drops the filter fails this mocked unit test too,
not just the rules-level one.

### IN-02: Redundant `isSignedIn()` in the new `shareTokens` list rule

**File:** `firestore.rules:367` (pre-fix line)
**Commit:** `005a21d9`
**Applied fix:** Verified `isOrgEditor(orgId)` (`firestore.rules:28-43`) opens with
`isSignedIn() && (...)`, so it is provably equivalent to false for any unauthenticated caller — the
outer `isSignedIn() &&` wrapper on the `shareTokens` list rule was dead weight, not a behavior
difference. Dropped it for consistency with every other `isOrgEditor`-gated rule in the file
(`orgSlugs`, `orgNames`, `serviceShareLinks` create/update/delete, etc.), which all call `isOrgEditor(...)`
bare. Re-ran the full `shareTokens` rules-test block (21 tests) after the change to confirm no
allow/deny behavior shifted.

## Skipped Issues

None — all findings were fixed.

## Gate Results

All gates run from the isolated fix worktree, against the codebase state after both commits.

- **`npx vitest run --config vitest.rules.config.ts`** (against the already-running emulator on :8080,
  since `npm run test:rules` correctly refused with "port taken"): **208 passed, 27 skipped, 0 failed**
  in `src/rules.test.ts` (includes both new CR-02 tests). `src/storage.rules.test.ts` failed with
  `ECONNREFUSED 127.0.0.1:9199` — no Storage emulator was running in this session; this is the
  documented Storage-emulator-dependent baseline file per CLAUDE.md, not a regression from this fix.
- **`npm run type-check`** (`vue-tsc --build`, typechecks test files too per CLAUDE.md's gate
  guidance): **exit 0, no errors.**
- **`cd functions && npm test`**: **639 passed (18 test files), 0 failed.**
- **`npx vitest run`** (bare app suite, full baseline check): **4976 passed, 27 skipped, 1 file
  failed** — `src/storage.rules.test.ts` only, same documented baseline as above (Storage emulator not
  up in this session). All 183 other test files passed, including `src/stores/__tests__/services.test.ts`
  (109/109) with the new orgId-filter assertion.

No regressions introduced by either fix. The only failing file across every gate is the
pre-existing, environment-dependent `storage.rules.test.ts` baseline documented in CLAUDE.md.

---

_Fixed: 2026-09-02T21:01:55Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
