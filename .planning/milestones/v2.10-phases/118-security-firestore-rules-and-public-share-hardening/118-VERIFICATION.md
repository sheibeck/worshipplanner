---
phase: 118-security-firestore-rules-and-public-share-hardening
verified: 2026-09-05T02:36:38Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 118: Security — Firestore Rules & Public Share Hardening Verification Report

**Phase Goal:** Every remaining rules-level and public-share-page security gap is closed —
provenance-field forgery, the super-admin universal members-write grant, registry enumeration,
PII on the share page, guessable share ids, and the admin/editor role-semantics ambiguity —
each proven by a passing rules test.
**Verified:** 2026-09-05
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An org editor can no longer overwrite `createdBy`/`createdAt` on a draft `services/{docId}` update; ordinary draft edits still succeed (R341) | ✓ VERIFIED | `firestore.rules:209-214` adds `!keys().hasAny(['createdBy','createdAt'])` to the draft-update branch. `src/rules.test.ts:2004-2022` — 3 new cases: DENY (change createdBy), DENY (forge-by-add), ALLOW (untouched createdBy). All 3 pass in a live emulator run. |
| 2 | Super-admin members-write is either constrained, or documented+pinned with a test proving the accepted invariant (R342) | ✓ VERIFIED | Locked low-risk branch taken: `firestore.rules:154-157` documents the super-admin `isOrgEditor` disjunct grants members/{uid} write, framed as a client-code contract not a rules invariant. `src/rules.test.ts:814-824` — ALLOW test (`setDoc` on `organizations/orgA/members/someUid` as super-admin) passes. |
| 3 | Unauthenticated collection query on `orgSlugs`/`orgNames` fails while `getDoc`-by-id succeeds (R343) | ✓ VERIFIED | `firestore.rules:411-412, 427-428` split `allow get: if true` / `allow list: if false`. `src/rules.test.ts:973-977` (orgSlugs) and `:1024-1028` (orgNames) — both `assertFails(getDocs(collection(...)))`; pre-existing `getDoc`-by-id ALLOW cases (:929, :986) still pass. |
| 4 | Free-text notes/slot-body filtered/gated before rendering on public ShareView/QuarterShareView (R346), incl. WR-01 stage-marker note | ✓ VERIFIED | `buildServiceSnapshot` allowlist-shapes every slot kind (services.ts:130-196, per-slot switch with a WR-02 default arm) dropping `notes`/`body` unconditionally; `toPublicServiceSnapshot()` (services.ts:298-320) strips service-level `notes` AND (post-review fix, commit `150c7a44`) per-marker stage-layout `note` at the one public-write choke point (`writeSharePayload`, both `shareTokens` and `serviceShares`). `ShareView.vue` render gate removes the free-text paragraph/Notes section entirely (protects legacy docs) and `serviceSnapshot` is now typed `PublicServiceSnapshot` (WR-03 fix, commit `1def3516`), not `any`. Tests: `services.sharePii.test.ts` (5/5 pass, incl. the WR-01 stage-marker case) + `ShareView.test.ts` (20/20 pass, incl. a legacy-doc PII-marker non-render case). QuarterShareView confirmed sound/untouched (names-only, no free-text render path). |
| 5 | Memorable share ids gain a token OR risk re-accepted in writing with reasoning (R347) | ✓ VERIFIED | Locked low-risk branch taken (no id-format change — breaking deployed links was ruled out). Written re-acceptance rationale recorded in `118-02-SUMMARY.md` ("R347 re-acceptance" section) plus short in-code comments at both id-construction sites: `services.ts:892` (serviceShares) and `quarters.ts:416` (quarterShares). Id strings confirmed byte-identical; `services.test.ts`/`quarters.test.ts` regression suites pass. |
| 6 | admin vs editor: real tested capability difference OR documented-synonymous with a warning (R348) | ✓ VERIFIED | Locked low-risk branch taken: `firestore.rules:40-44` documents `'admin'` as intentionally synonymous with `'editor'` today, with an explicit warning against a future admin-gate silently inheriting the self-escalation path. `src/rules.test.ts:833-841` — synonymity test (admin-role member succeeds on an editor-gated write) pins the invariant. |
| 7 | `npm run test:rules` passes with every new ALLOW/DENY case green | ✓ VERIFIED | Ran `npm run test:rules` fresh (killed a leaked emulator process on port 8080 first, per CLAUDE.md guidance) — **242/242 tests passed, 2/2 test files passed** (`src/rules.test.ts` 215 tests + `src/storage.rules.test.ts` 27 tests), zero failures. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | R341/R342/R343/R348 rules changes | ✓ VERIFIED | All four changes present and correctly scoped; read the full file, confirmed no unintended grant narrowing. |
| `src/rules.test.ts` | New R341/R342/R343/R348 test cases | ✓ VERIFIED | All 7 new cases present, read in full, confirmed to assert exactly what the plan/must_haves specify. |
| `src/stores/services.ts` | Allowlist projection + `toPublicServiceSnapshot` + R347 comment | ✓ VERIFIED | Per-slot allowlist switch (with WR-02 default-arm fix), `PublicServiceSnapshot`/`PublicStageMarker` types, `toPublicServiceSnapshot()` strips service-level notes + per-marker stage note (WR-01 fix), R347 comment at id site. |
| `src/views/ShareView.vue` | Render-side gate for legacy docs | ✓ VERIFIED | Free-text paragraph/Notes section removed; `serviceSnapshot` typed as `PublicServiceSnapshot \| null` (WR-03 fix), not `any`. |
| `src/stores/__tests__/services.sharePii.test.ts` | Unit test proving PII absence | ✓ VERIFIED | 5 tests (per-slot, service-level notes, structured-field preservation, stage-marker note, no-op-when-no-markers), all pass. |
| `src/views/__tests__/ShareView.test.ts` | Component test proving non-render | ✓ VERIFIED | 20 tests including a legacy-doc PII-marker non-render case, all pass. |
| `src/stores/quarters.ts` | R347 comment at id site | ✓ VERIFIED | Comment present at `quarterShares` id construction (:416); no functional change. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `services/{docId}` draft-update branch 1 | `keys()`/`affectedKeys()` helper | provenance-diff guard | ✓ WIRED | `!keys().hasAny(['createdBy','createdAt'])` added to branch 1 exactly as the plan specified; mirrors `preservesCreatedBy()`. |
| `orgSlugs`/`orgNames` get/list split | SEC-S-01 idiom (`quarterShares`/`serviceShares`) | pattern reuse | ✓ WIRED | Identical `allow get: if true; allow list: if false;` shape applied verbatim. |
| `writeSharePayload` | `toPublicServiceSnapshot(buildServiceSnapshot(...))` | single choke point for both `shareTokens` and `serviceShares` writes | ✓ WIRED | Confirmed via grep: both `setDoc` calls (services.ts:871, :898) consume the same `serviceSnapshot` variable built once at :869 through `toPublicServiceSnapshot`. Code review (118-REVIEW.md) independently traced and confirmed this is the *only* writer of a public service snapshot. |
| `ShareView.vue` render gate | `PublicServiceSnapshot` type | compiler-enforced gate | ✓ WIRED | `ref<PublicServiceSnapshot \| null>(null)` (post-WR-03-fix) — a future re-add of `slot.notes`/`marker.note` in the template now fails `npm run type-check` rather than silently rendering. |
| R342 members-write ALLOW test | `isOrgEditor` super-admin disjunct (:38) | pinning test | ✓ WIRED | Test creates a super-admin context with no membership doc and asserts `setDoc` on `members/{uid}` succeeds — exercises the exact disjunct. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R341 | 118-01 | Draft provenance-forgery guard | ✓ SATISFIED | Rules change + 3 passing tests. |
| R342 | 118-01 | Super-admin members-write documented+pinned | ✓ SATISFIED | Rules comment + 1 passing ALLOW test. |
| R343 | 118-01 | orgSlugs/orgNames get/list split | ✓ SATISFIED | Rules change + 2 passing DENY tests (getDoc ALLOW unaffected). |
| R346 | 118-02 | Public share PII filtering | ✓ SATISFIED | Allowlist projection + render gate + WR-01 stage-marker follow-up fix, all test-proven. |
| R347 | 118-02 | Guessable share-id re-acceptance | ✓ SATISFIED | Written re-acceptance (SUMMARY + code comments), no id-format change. |
| R348 | 118-01 | admin/editor synonymity documented | ✓ SATISFIED | Rules comment + 1 passing synonymity test. |

All six requirements traced to concrete code changes and concrete passing tests. `REQUIREMENTS.md`'s traceability table already marks R341-R348 as Complete for Phase 118, consistent with this evidence.

### Anti-Patterns Found

None blocking. Code review (118-REVIEW.md, deep depth) found 0 Critical, 3 Warning (WR-01/02/03), 2 Info (IN-01/02). All 3 Warnings have been fixed in follow-up commits verified in this pass:
- WR-01 (stage-marker `note` PII leak) — fixed, commit `150c7a44`, test-proven.
- WR-02 (missing `default` arm on the per-slot switch, would throw `undefined` into a Firestore write) — fixed, commit `b73fbc8c`.
- WR-03 (`ShareView`'s `serviceSnapshot` typed `any`, defeating compiler enforcement of the render gate) — fixed, commit `1def3516`.

The 2 Info items (IN-01: R341 doesn't gate `allow create`'s createdBy, currently defensive-only since no create path writes it; IN-02: R342/R348 pin-tests lean on `isOrgActive`'s default-true behavior without asserting it explicitly) are non-blocking, low-severity, and explicitly noted by the reviewer as optional/no-action-required.

### Test Suite Results (independently re-run by this verifier, not taken from SUMMARY claims)

- **`npm run test:rules`** (fresh run, leaked emulator on port 8080 killed first): **242/242 tests passed, 2/2 files passed** (`src/rules.test.ts` 215 + `src/storage.rules.test.ts` 27). Zero failures — exceeds the documented baseline (CLAUDE.md's storage.rules.test.ts caveat describes a *possible* 2-test failure under certain SDK/emulator combinations; this run, with a genuinely fresh Storage emulator, passed all 27).
- **`npx vitest run`** (full app suite, run twice independently for consistency): **186/187 files passed, 5082/5109 tests passed, 27 skipped**, both runs identical. The sole failing file, `src/storage.rules.test.ts`, fails only because the jsdom app-suite run has no Storage emulator reachable at all (`ECONNREFUSED 9199`) — this is the documented CLAUDE.md baseline (that suite requires the Storage emulator and is excluded from meaningful jsdom-suite execution), not a regression introduced by this phase.
- **Targeted re-run** of `src/stores/__tests__/services.sharePii.test.ts` + `src/views/__tests__/ShareView.test.ts` in isolation (clean environment, no CPU contention): 25/25 pass.
- **`npm run type-check`** (`vue-tsc --build`, typechecks test files too): clean, no errors.

## Gaps Summary

None. All 7 ROADMAP success criteria are independently verified against the current codebase state
(not SUMMARY claims): the two real rules fixes (R341, R343) are wired and test-proven; the two
accepted-and-documented residuals (R342, R348) are pinned by passing tests with no grant narrowed;
the public-share PII fix (R346) is verified end-to-end including the post-review WR-01 stage-marker
follow-up fix; the share-id re-acceptance (R347) is written down with no functional change; and the
full rules suite is 100% green. Both plans' SUMMARY self-checks were independently re-verified by
re-running every claimed test suite from a clean state rather than trusting the SUMMARY narrative.

---

_Verified: 2026-09-05_
_Verifier: Claude (gsd-verifier)_
