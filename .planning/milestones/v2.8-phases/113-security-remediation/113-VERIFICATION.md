---
phase: 113-security-remediation
verified: 2026-09-02T21:20:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 1
overrides_applied: 1
override_note: "Owner accepted (2026-09-02) the single human_needed item — the SEC-ISO-02 Storage ALLOW-case test — as env-deferred (Storage emulator :9199 unreachable all session; same class as the documented storage.rules.test.ts baseline). SEC-ISO-02's primary emulator-independent proof (functions unit test) passes. Recorded as a run-when-emulator-available item, not a code gap."
deployed: "2026-09-02 — hosting + firestore:rules + functions:syncOrgMembershipClaim deployed to worship-planner-bc515 with per-deploy owner confirmation; live SEC-S-01 cross-tenant leak closed in production."
gaps: []
human_verification:
  - test: "Start the Storage emulator (127.0.0.1:9199, e.g. `firebase emulators:start`) and re-run `npx vitest run --config vitest.rules.config.ts src/storage.rules.test.ts`, confirming the new `storage.rules — SEC-ISO-02 revoke blast radius (Phase 113)` describe block's ALLOW-case test passes: 'a REMAINING member of an org still has read/write access after an UNRELATED member of the same org is removed'."
    expected: "The test passes (assertSucceeds on the remaining member's read/write), proving the SEC-ISO-02 revoke's blast radius is scoped to only the removed uid and does not affect surviving org members."
    why_human: "The Storage emulator (127.0.0.1:9199) was unreachable in both the build session and this verification session (ECONNREFUSED). The test is authored and committed but has never executed against a live rules engine. The primary, emulator-independent proof for SEC-ISO-02 (the functions-level unit test asserting `revokeRefreshTokens` is called with exactly the removed uid, and NOT called on unrelated skip/role-change paths) is independently verified and passing (`cd functions && npm test`, 639/639) — this is a secondary confirmation, not evidence the fix itself is unproven, but it has never been observed to actually pass."
---

# Phase 113: Security Remediation Verification Report

**Phase Goal:** Every Critical/High security finding from Phase 112 is fixed (built/tested/committed) or
explicitly deferred; Medium/Low triaged to backlog; each rules/authz fix carries a real ALLOW-case
emulator test (SEC-S-01 also DENY-case); type-check + full suite pass; no new regressions. Deploy is
handled separately by the orchestrator with owner confirmation.

**Verified:** 2026-09-02T21:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SEC-S-01 (Critical): `shareTokens`/`quarterShares`/`serviceShares` deny unauthenticated collection listing, allow get-by-id, with a real DENY-case + ALLOW-case emulator test | ✓ VERIFIED | `firestore.rules:344-445` — all three collections split `get`/`list`. Live `npx vitest run --config vitest.rules.config.ts` run by this verifier: `src/rules.test.ts` 208/208 pass, including `assertFails(getDocs(collection(db,'shareTokens'/'quarterShares'/'serviceShares')))` (:1282, :996, :1139) and preserved `assertSucceeds(getDoc(...))` (:1271, :984, :1131). |
| 2 | SEC-S-01 fix does not break the app's two legitimate `shareTokens` list call sites (`deleteService`, `ensureShareLink`) | ✓ VERIFIED | Both `src/stores/services.ts:521` (`deleteService`) and `:820` (`ensureShareLink`) carry `where('orgId','==', ...)` alongside `where('serviceId','==', ...)`, satisfying `firestore.rules:370`'s `allow list: if isOrgEditor(resource.data.orgId)`. Confirmed directly in source (not just SUMMARY claim) — this was a real regression (CR-01, CR-02) caught by the code-review chain and independently confirmed fixed here. |
| 3 | SEC-ISO-01 (High): legacy client-side `organizations`/`members` self-provisioning is removed; Flow-2 invite acceptance intact and proven ALLOW; founder self-provision proven DENY | ✓ VERIFIED | `firestore.rules:57-178` — no `allow create` on `organizations/{orgId}`; `members/{uid}` `allow create` contains only the Flow-2 invite-acceptance disjunct. `src/rules.test.ts:268` ("DENIES a non-super-admin self-provisioning...") and `:241` ("ALLOWS a user accepting a genuine outstanding invite...") both present and passing in the live run above. `src/stores/auth.ts`'s `ensureUserDocument` has no org-create branch. |
| 4 | SEC-ISO-02 (High): member removal (primary-org "clear" branch) calls `revokeRefreshTokens(uid)`, non-blocking, proven by a functions-level unit test | ✓ VERIFIED | `functions/src/orgMembershipClaims.ts:276-297` — `case "clear"` calls `getAuth().revokeRefreshTokens(uid)` in its own try/catch after the claim write lands. `cd functions && npm test` run by this verifier: 639/639 pass (18 files), including `orgMembershipClaims.test.ts:640-687` asserting `revokeRefreshTokens` called with the removed uid on both clear-branch shapes, and `:690` (WR-02) proving a revoke throw is swallowed and never changes the `{action:"clear"}` outcome. |
| 5 | SEC-ISO-02 blast-radius (Storage-side): a remaining org member's access is unaffected by an unrelated member's removal | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `src/storage.rules.test.ts:415-421` authors the ALLOW-case test exactly as required. Storage emulator (127.0.0.1:9199) unreachable in this verification session (confirmed via direct probe: `ECONNREFUSED`) — same env limitation documented in CLAUDE.md and this session's own build/review sessions. Test is present, committed, correctly scoped, but has never actually executed. See Human Verification. |
| 6 | Medium/Low (11 findings) triaged to ONE consolidated backlog entry; none fixed in code | ✓ VERIFIED | `.planning/ROADMAP.md:757-787` — `### Phase 999.5: v2.8 Security Review — Medium/Low findings (11) (BACKLOG)` names all 11 ids (SEC-A-01, ARCH-018, SEC-R-03, SEC-S-02, SEC-C-01, SEC-ISO-05, SEC-ISO-06, SEC-S-03, SEC-S-04, SEC-C-05, SEC-C-06), points to `112-SECURITY-REVIEW.md`, no per-finding detail duplicated. Confirmed none of these 11 items' underlying code was touched (only the 3 Critical/High files + rules/tests were modified per `git log`). |
| 7 | type-check + full suite pass, no new regressions; no deploy performed by any plan | ✓ VERIFIED | This verifier independently ran: `npm run type-check` — clean, exit 0. `npx vitest run --config vitest.rules.config.ts` — `src/rules.test.ts` 208/208 pass; `src/storage.rules.test.ts` fails only on the documented `ECONNREFUSED 127.0.0.1:9199` env limitation (not a regression). `npx vitest run` (bare app suite) — 4976 passed, 27 skipped, only `src/storage.rules.test.ts` failed (183/184 files pass) — exact match to the documented single-file baseline. `git log 02354c76..HEAD --name-only` shows no `firebase.json`/deploy-related file touched across all 19 phase commits. |

**Score:** 6/6 truths verified (1 present, behavior-unverified — the Storage-emulator-dependent secondary
proof for SEC-ISO-02's blast-radius scoping).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | SEC-S-01 get/list split (org-scoped for shareTokens, flat-deny for quarterShares/serviceShares); SEC-ISO-01 legacy create removed | ✓ VERIFIED | Confirmed lines 57-178, 344-445 directly. |
| `src/rules.test.ts` | DENY-case + ALLOW-case tests for SEC-S-01; founder DENY + Flow-2 ALLOW for SEC-ISO-01; CR-01/CR-02 regression tests | ✓ VERIFIED | All present; live emulator run confirms 208/208 pass. |
| `functions/src/orgMembershipClaims.ts` | `revokeRefreshTokens(uid)` in clear branch (+ WR-01 extension to skip branch on genuine removal) | ✓ VERIFIED | Lines 276-349; confirmed still exported from `functions/src/index.ts:17,2874`. |
| `functions/src/orgMembershipClaims.test.ts` | Unit tests asserting revoke fires with removed uid; swallow-on-failure test | ✓ VERIFIED | `cd functions && npm test` 639/639 pass. |
| `src/storage.rules.test.ts` | Storage ALLOW-case test authored | ✓ VERIFIED (present) / ⚠️ unexecuted | Authored correctly; blocked by unreachable Storage emulator this session too. |
| `.planning/ROADMAP.md` | One consolidated `### Phase 999.x` Medium/Low backlog entry | ✓ VERIFIED | `### Phase 999.5`, all 11 ids present, pointer-only. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `firestore.rules` shareTokens list rule | `src/stores/services.ts` `deleteService`/`ensureShareLink` | `where('orgId','==',...)` equality filter required by `isOrgEditor(resource.data.orgId)` | ✓ WIRED | Both call sites carry the filter; confirmed by direct source read, not SUMMARY claim. |
| `firestore.rules` members/{uid} create | Flow-2 invite acceptance | `exists(.../invites/...)` + role match | ✓ WIRED | Test `src/rules.test.ts:241` passes live. |
| `orgMembershipClaims.ts` clear/skip branches | Firebase Auth Admin SDK | `getAuth().revokeRefreshTokens(uid)` | ✓ WIRED | Confirmed in source; unit-tested with mocked spy assertions. |
| `functions/src/index.ts` | `orgMembershipClaims.ts` | re-export of `syncOrgMembershipClaim` | ✓ WIRED | `index.ts:17,2874`. |
| ROADMAP `999.5` backlog entry | `112-SECURITY-REVIEW.md` | Source pointer, no detail duplication | ✓ WIRED | Confirmed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SEC-S-01 DENY/ALLOW rules tests | `npx vitest run --config vitest.rules.config.ts` | `src/rules.test.ts` 208/208 pass | ✓ PASS |
| SEC-ISO-01 DENY/ALLOW rules tests | (same run) | Founder test DENY + Flow-2 ALLOW both pass | ✓ PASS |
| SEC-ISO-02 functions unit tests (primary proof) | `cd functions && npm test` | 639/639 pass (18 files) | ✓ PASS |
| SEC-ISO-02 Storage ALLOW-case (secondary proof) | `npx vitest run --config vitest.rules.config.ts src/storage.rules.test.ts` (attempted) | `ECONNREFUSED 127.0.0.1:9199` — Storage emulator unreachable | ? SKIP (routed to human verification) |
| Type-check gate | `npm run type-check` | Exit 0, no errors | ✓ PASS |
| Full app-suite regression gate | `npx vitest run` (bare) | 4976 passed, 27 skipped, 1 file failed (`src/storage.rules.test.ts`, documented baseline) | ✓ PASS |
| No deploy performed | `git log 02354c76..HEAD --name-only \| grep -iE "deploy\|firebase.json"` | No matches across 19 commits | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R323 | 113-01, 113-02, 113-03 | Critical/High findings remediated or explicitly deferred; Medium/Low triaged to backlog with recorded rationale | ✓ SATISFIED | All 3 Critical/High findings fixed and tested; 11 Medium/Low consolidated into `999.5`. `.planning/REQUIREMENTS.md:84` marks R323 → Phase 113 → Complete. |

### Anti-Patterns Found

None found in the modified files (`firestore.rules`, `src/rules.test.ts`, `src/stores/services.ts`,
`functions/src/orgMembershipClaims.ts`, `functions/src/orgMembershipClaims.test.ts`,
`src/storage.rules.test.ts`, `.planning/ROADMAP.md`). No TBD/FIXME/XXX debt markers, no stub returns, no
placeholder text. The code-review chain (113-REVIEW.md, 113-REVIEW-2.md) independently caught two real
critical functional regressions (CR-01: `deleteService` cleanup broken by the initial flat `list: false`;
CR-02: `ensureShareLink`'s adoption query left unscoped, breaking share-link creation for essentially
every service) — both were fixed in `113-REVIEW-FIX.md`/`113-REVIEW-FIX-2.md` with dedicated regression
tests, and this verifier independently confirmed the fixed state is what's actually on `master` (not just
what the fix reports claim).

### Human Verification Required

### 1. Storage-side ALLOW-case test for SEC-ISO-02's revoke blast radius

**Test:** Start the Storage emulator (`firebase emulators:start`, port 9199) and run
`npx vitest run --config vitest.rules.config.ts src/storage.rules.test.ts`.
**Expected:** The `storage.rules — SEC-ISO-02 revoke blast radius (Phase 113)` describe block's test — "a
REMAINING member of an org still has read/write access after an UNRELATED member of the same org is
removed" — passes (`assertSucceeds`).
**Why human:** The Storage emulator has been unreachable across the build session, the code-review
session, and this verification session (`ECONNREFUSED 127.0.0.1:9199` every time) — a persistent
environment gap in this workspace, not something a re-run of the same command will resolve without
someone starting the emulator. The test is correctly authored and committed. This does not block the
phase's Critical/High remediation claim: the primary, emulator-independent proof for SEC-ISO-02 (a
functions-level unit test asserting `revokeRefreshTokens` fires with exactly the removed uid, and does
NOT fire on role-change/unrelated-org paths) is independently verified passing in this report.

### Gaps Summary

No gaps. All three Critical/High findings (SEC-S-01, SEC-ISO-01, SEC-ISO-02) have shipped, committed,
tested fixes on `master`, independently confirmed against live source and a live Firestore-rules-emulator
run performed by this verifier (not merely SUMMARY.md's claims). The code-review chain caught two real
regressions this phase would otherwise have shipped silently (CR-01, CR-02 — both broke share-link
creation/cleanup for ordinary org editors) and both are confirmed fixed in the current codebase. The
Medium/Low backlog triage is a genuine single consolidated entry, not stubs. `type-check`, the rules
suite, the functions suite, and the full bare app suite were all independently re-run by this verifier
and are clean at the documented single-file (`storage.rules.test.ts`) baseline. No deploy occurred. The
one open item — the Storage-side secondary ALLOW-case test for SEC-ISO-02 — is a pre-existing,
documented environment limitation (Storage emulator unreachable), not a code or test defect, and is
routed to human verification rather than blocking the phase.

---

_Verified: 2026-09-02T21:20:00Z_
_Verifier: Claude (gsd-verifier)_
