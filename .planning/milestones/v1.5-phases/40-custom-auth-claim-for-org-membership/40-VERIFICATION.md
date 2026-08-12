---
phase: 40-custom-auth-claim-for-org-membership
verified: 2026-08-06T23:55:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 40: Custom Auth Claim for Org Membership Verification Report

**Phase Goal:** Storage-rules membership checks are provably correct in both the Storage emulator and
production, via a custom auth claim that never locks out or under-authorizes an existing member.
**Verified:** 2026-08-06
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Firestore-triggered Cloud Function mirroring `requestPptxRender` computes and sets a `{orgId, role}` claim from `organizations/{orgId}/members/{uid}` writes — built and tested, never deployed | ✓ VERIFIED | `functions/src/orgMembershipClaims.ts` exports `syncOrgMembershipClaim` (`onDocumentWritten`), `decideMembershipClaim`, `buildOrgMembershipClaim`. Re-exported from `functions/src/index.ts` (`syncOrgMembershipClaimHandler`/`decideMembershipClaim` deliberately NOT re-exported). `cd functions && npm run test` → **105/105 passing** (measured independently). No `firebase deploy`/`gcloud` anywhere in `git log 0e40f9c^..HEAD` for this phase's commit range. |
| 2 | `storage.rules` dual-reads claim OR Firestore, ships with a passing ALLOW-case test against the real Storage emulator; the two previously-failing allow-cases now pass | ✓ VERIFIED | `storage.rules:27-52` — `isOrgMember(orgId) = isOrgMemberByClaim(orgId) \|\| isOrgMemberByFirestore(orgId)`, claim evaluated first (source-read, confirmed). Ran `npx vitest run --config vitest.rules.config.ts` independently → **103 passed (103), 0 failed** (matches claimed after-state). Both baseline-failing tests confirmed present with **byte-identical titles** at `src/storage.rules.test.ts:70` and `:150`, neither seeds a `members` document (`seedMembershipDoc` absent from both), both authenticate via `authenticatedContext('userA', { orgId: 'orgA', role: ... })` — the claim arm alone is what's proven, not a fallback pass. |
| 3 | A pre-claim member still passes on the Firestore branch; a user in no org is denied on both branches — proven by tests covering both arms of the OR, not just one | ✓ VERIFIED (with disclosed structural-only proof for one arm) | Claim arm allow/deny: behaviorally proven (7+ tests: valid claim allow, viewer-role allow, mismatched-org claim deny, no-role deny, no-claim-no-doc deny on both org and media paths). Firestore-fallback arm ALLOW case: **cannot** be behaviorally proven in the Storage emulator (`firestore.exists()` is inert per firebase-js-sdk#6803) — proven instead by the static source-assertion test `keeps the Firestore-membership fallback ORed, never ANDed, into the membership check` (`storage.rules.test.ts:211-245`), which asserts the predicate is present and disjunctively (not conjunctively) joined. This gap is honestly disclosed in `40-01-SUMMARY.md`, the code review (WR-04), and `functions/DEPLOY-ORG-CLAIMS.md` Step 1's mandatory manual check — never mislabeled as behaviorally proven. Judged adequate per task framing: the split is the best achievable given the documented emulator limitation, and it is disclosed rather than papered over. |
| 4 | The idempotent backfill and the exact two-deploy sequence are written and handed to the owner; reaching this state IS the goal, neither deploy runs during this phase | ✓ VERIFIED | `functions/src/backfillOrgClaims.ts` exports `backfillOrgMembershipClaims`, imports `decideMembershipClaim` from `./orgMembershipClaims` (confirmed, no reimplementation), dry-run-by-default (`apply` gate on the only `setCustomUserClaims` call site), no pagination/batching/cursor (confirmed absent). `functions/DEPLOY-ORG-CLAIMS.md` exists: banner disclaiming any command was run, both `firebase deploy` commands verbatim and matching `firebase.json` targets, all 4 steps with observe/rollback, the mandatory 1-hour soak with explicit "do not skip" instruction, the mandatory multi-org pre-check before deploy 2, the deploy-1-guard-test tripwire named by exact title, and all 4 residual risks (multi-org, stale claim, invite race with exact `CLAIM_REFRESH_MAX_ATTEMPTS=4`/`DELAY_MS=1500` constants, unprovable-fallback). `git log` confirms no deploy command executed in this phase's commit range. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `storage.rules` | Dual-read `isOrgMember`, claim-first, size caps unchanged | ✓ VERIFIED | Confirmed by direct read: helper functions present, `||` ordering claim-first, 26214400/52428800 caps untouched, `firestore.rules` untouched (git log shows last touch at commit `8052062`, Phase 31 — not this phase). |
| `src/storage.rules.test.ts` | Non-vacuous test matrix, 2 headline allow-cases + new R075 deny-cases + structural guard | ✓ VERIFIED | 13 tests, all pass; titles match baseline byte-for-byte; allow-cases claim-only (no seeded doc); deny-cases give a valid claim so denial is attributable to the intended conjunct, not vacuous membership failure. |
| `functions/src/orgMembershipClaims.ts` | Shared decision module + trigger, no module-scope `initializeApp()` | ✓ VERIFIED | Read directly: `buildOrgMembershipClaim`, `ORG_CLAIM_KEYS`, `decideMembershipClaim`, `syncOrgMembershipClaimHandler`, `syncOrgMembershipClaim` all present. No `initializeApp()` call in the module. WR-01 fix confirmed present (`documentExists` boolean disambiguates delete vs. missing-role). |
| `functions/src/orgMembershipClaims.test.ts` | Covers create/update/delete/non-primary/missing-doc/idempotent/auth-failure | ✓ VERIFIED | Part of the 105/105 functions suite pass. |
| `functions/src/backfillOrgClaims.ts` | Idempotent, dry-run-default, imports shared decision fn | ✓ VERIFIED | Read directly: imports `decideMembershipClaim`, dry-run gated on `--apply`, `resolveOrgId` structural guard mirrors `MEDIA_PATH_GUARD`, no scale machinery. WR-02 fix confirmed present (`runBackfillCli` wraps the whole body in try/catch, sets `process.exitCode = 1` on top-level failure). Not exported from `functions/src/index.ts` (confirmed absent). |
| `functions/src/backfillOrgClaims.test.ts` | Covers apply/dry-run/idempotency/pending-invite/missing-doc/non-primary/per-uid-failure/structural-guard | ✓ VERIFIED | Part of the 105/105 functions suite pass. |
| `functions/DEPLOY-ORG-CLAIMS.md` | Two-deploy sequence, soak, pre-check, rollback, residual risks | ✓ VERIFIED | Read directly in full — matches every acceptance criterion in 40-04-PLAN.md Task 2 (see Success Criterion 4 evidence above). |
| `src/stores/auth.ts` | Forced refresh on org-context load, bounded retry on just-joined path | ✓ VERIFIED | `refreshOrgClaim`, `CLAIM_REFRESH_MAX_ATTEMPTS`/`CLAIM_REFRESH_DELAY_MS` exports, `membershipCreated` threading all present in source at the lines referenced by the summary. |
| `src/stores/__tests__/auth.test.ts` | Ordinary/just-joined/wrong-org/throwing/no-org cases | ✓ VERIFIED | Part of the app-suite pass (no regression beyond documented baseline, confirmed below). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `storage.rules` claim arm | `functions/src/orgMembershipClaims.ts` | Shared claim keys `orgId`/`role` | ✓ WIRED | `storage.rules` reads `request.auth.token.orgId`/`.role`; `buildOrgMembershipClaim` writes exactly `{ orgId, role }` — byte-for-byte match confirmed by direct read of both files. |
| `functions/src/backfillOrgClaims.ts` | `functions/src/orgMembershipClaims.ts` | `import { decideMembershipClaim }` | ✓ WIRED | Confirmed by direct read: `import { decideMembershipClaim } from "./orgMembershipClaims";` at line 4; no second implementation of primary-org resolution found in `backfillOrgClaims.ts`. |
| `src/stores/auth.ts` `loadOrgContext` | claim propagation | `getIdTokenResult(user, true)` forced refresh | ✓ WIRED | Confirmed present and gated correctly: 1 call on ordinary path, up to 4 on just-joined path, per source read and the passing auth-store test suite. |
| `functions/src/index.ts` | `syncOrgMembershipClaim` deployable surface | named re-export | ✓ WIRED | Confirmed: only `syncOrgMembershipClaim` re-exported, not the handler/decision internals — matches the deploy-surface intent. |

### Behavioral Spot-Checks (independently re-run, not trusted from SUMMARY)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rules suite (live Firestore+Storage emulators, confirmed up: 4000/8080/9199) | `npx vitest run --config vitest.rules.config.ts` | `Test Files 2 passed (2)` / `Tests 103 passed (103)` | ✓ PASS — matches claimed after-state exactly |
| Functions suite | `cd functions && npm run test` | `Test Files 5 passed (5)` / `Tests 105 passed (105)` | ✓ PASS — matches claimed 105/105 |
| Type gate | `npm run type-check` (the `vue-tsc --build` form) | exit code 0 | ✓ PASS |
| App suite (documented CLAUDE.md baseline check) | `npx vitest run --dir src --exclude '**/rules.test.ts'` | `Test Files 2 failed \| 83 passed (85)` / `Tests 13 failed \| 2558 passed (2571)` — failing files are exactly `src/storage.rules.test.ts` (needs `vitest.rules.config.ts`'s sequential/dual-emulator setup, not this bare invocation — documented CLAUDE.md limitation) and `src/views/__tests__/RosterView.test.ts` (pre-existing stale assertion, unrelated to this phase) | ✓ PASS — identical to the documented pre-existing baseline (also matches 40-03-SUMMARY.md's independently-recorded figure of 2558/2571), confirming no regression was introduced by this phase |
| No deploy occurred | `git log 0e40f9c^..HEAD -- functions/ storage.rules src/storage.rules.test.ts src/stores/auth.ts` and `git log --all --oneline \| grep -i deploy` | No `firebase deploy`/`gcloud` command found anywhere in phase 40's commit history | ✓ PASS |
| `firestore.rules` untouched | `git log --oneline -5 -- firestore.rules` | Last touched at `8052062` (Phase 31), not in phase 40's range | ✓ PASS |
| No dependency added | `git diff --stat 79fa67d d99f361 -- functions/package.json functions/package-lock.json package.json package-lock.json` | Empty diff | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R074 | 40-01, 40-02, 40-04 | Authenticated member can read/write org Storage path, proven by an automated allow-case test that actually runs | ✓ SATISFIED | Both headline allow-case tests pass against a live emulator; claim arm behaviorally proven. |
| R075 | 40-01, 40-02, 40-03, 40-04 | Rollout never locks out an existing member; a user in no org is denied | ✓ SATISFIED | OR-never-AND enforced by source (guard test), forced refresh + bounded retry closes the invite-acceptance race, backfill is idempotent and safe against the pending-invite case, runbook enforces the soak and multi-org pre-check before removing the fallback. |

REQUIREMENTS.md's own Traceability table already marks both R074 and R075 "Complete," consistent with this evidence.

### Anti-Patterns Found

None blocking. Searched modified files for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/placeholder patterns — none found in `storage.rules`, `functions/src/orgMembershipClaims.ts`, `functions/src/backfillOrgClaims.ts`, or `src/stores/auth.ts`. The code review (`40-REVIEW.md`) already ran a deeper adversarial pass (STRIDE-informed) and found 0 Critical, 4 Warning, 1 Info — 3 of 5 fixed in follow-up commits (`de26270` WR-01, `3c9eb47` WR-02, `965a720` IN-01), 2 deferred with explicit, non-silent rationale:
- **WR-03** (pre-existing `firestore.rules` self-service membership gap, extends revocation latency from instant to ≤1h) — genuinely out of scope for this phase (R074's scope fence; `firestore.rules` deploy-gated). See Security Consideration below.
- **WR-04** (Firestore-fallback ALLOW arm has no running test, only a structural source assertion) — not fixable, structural emulator limitation (firebase-js-sdk#6803), already the most honest disclosure achievable; corresponds to Success Criterion 3's documented split.

### Security Consideration (flagged, not a phase-40 defect — recorded per task instructions)

The code review's WR-03 finding is real and worth the owner's attention before running deploy 2: a
**pre-existing** `firestore.rules:36-40` gap lets any signed-in user self-create a membership document
in any org (no invite or editor authorization required). This predates Phase 40 and is unaffected by
its code — `firestore.rules` is correctly out of scope per R074. What Phase 40 changes is the
**revocation latency** of that same pre-existing gap: today the Firestore-only check re-validates on
every Storage request, so deleting a forged membership doc revokes access instantly. After deploy 2
removes the fallback, a forged claim survives in an already-issued token for up to its natural 1-hour
lifetime even after the forged doc is deleted. This is a narrow widening of an existing gap's blast
radius, not a new hole, and `functions/DEPLOY-ORG-CLAIMS.md` already names the escalation path
(`revokeRefreshTokens(uid)`) for an immediate lockout if ever needed. The owner should weigh this before
running deploy 2 — closing the underlying `firestore.rules` self-service gap is recommended future work,
not something this phase can or should fix.

### Human Verification Required

None required to close **this phase**. Every truth in the four ROADMAP success criteria is either
behaviorally proven against a live emulator or, where the emulator is structurally incapable
(firebase-js-sdk#6803), proven by an honest structural source assertion plus a required manual step
already written into the owner-facing runbook. Per this phase's explicit design (ROADMAP criterion 4:
"reaching this state IS the phase goal; neither deploy runs during this phase"), the deploy-time manual
checks (existing-member-can-still-upload after deploy 1, the real invite-acceptance flow, the multi-org
pre-check, deploy 2 confirmation) are the owner's **next milestone action**, not a checkpoint this
phase's own completion depends on — they are already fully specified with what to observe and how to
roll back in `functions/DEPLOY-ORG-CLAIMS.md`.

**One minor documentation note (non-blocking):** several plan SUMMARYs state their deferred owner-checks
should be "recorded in `.planning/PENDING-VERIFICATION.md`," but that file (as of this verification) has
no `## Phase 40` section — its last entry is Phase 39. This does not block the phase goal (the actual
checklist content lives fully in `functions/DEPLOY-ORG-CLAIMS.md`, which is the authoritative, discoverable
artifact per the plan's own placement rationale), but the owner may want a `## Phase 40` cross-reference
added to `PENDING-VERIFICATION.md` pointing at `functions/DEPLOY-ORG-CLAIMS.md` for consistency with how
Phase 39 was recorded there.

### Gaps Summary

None. All four ROADMAP success criteria are met with codebase evidence independently re-verified
(not merely trusted from SUMMARY.md): both headline allow-case tests pass against a live Storage
emulator with byte-identical titles and no membership-doc seeding; the claim-first `||` ordering is
confirmed in `storage.rules` source; the Cloud Function and backfill share `decideMembershipClaim`
with no drift risk; the two-deploy runbook is complete and precise; and no deploy command was executed
anywhere in this phase's git history. The one structural (not behavioral) proof for the Firestore-fallback
ALLOW arm is a genuine, disclosed limitation of the Storage emulator — not a gap introduced by this
phase's work, and it is honestly labeled everywhere it appears (source comments, SUMMARY, code review,
runbook) rather than mislabeled as fully proven.

---

_Verified: 2026-08-06T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
