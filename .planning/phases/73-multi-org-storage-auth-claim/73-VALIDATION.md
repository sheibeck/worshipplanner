---
phase: 73
slug: multi-org-storage-auth-claim
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-21
---

# Phase 73 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (functions unit tests, mocked Admin SDK) + Firebase emulator rules suite |
| **Config file** | functions vitest config; `vitest.rules.config.ts` for storage.rules |
| **Quick run command** | `cd functions && npx vitest run src/orgMembershipClaims.test.ts src/backfillOrgClaims.test.ts` |
| **Full suite command** | functions: `cd functions && npx vitest run` · rules: `npm run test:rules` (or, if an emulator is already up, `npx vitest run --config vitest.rules.config.ts`) |
| **Estimated runtime** | ~15s functions unit; ~30-60s rules emulator |

---

## Sampling Rate

- **After every task commit:** Run the relevant functions unit test file(s)
- **After every plan wave:** Run the functions suite; run the rules suite for any storage.rules change
- **Before `/gsd-verify-work`:** functions suite green; storage.rules multi-org ALLOW/DENY tests green under the emulator
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Seeded from RESEARCH §Validation Architecture; planner refines Task IDs to its wave/plan split.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 73-01-01 | 01 | 1 | R207 | — | Claim carries an additive `orgs: {orgId: role}` map for ALL a user's orgs alongside the unchanged primary `orgId`/`role` | unit (mocked Admin SDK) | `cd functions && npx vitest run src/orgMembershipClaims.test.ts` | ❌ W0 | ⬜ pending |
| 73-01-02 | 01 | 1 | R208 | T-73-claim-wipe | Widen recomputes the full set on any members write via `collectionGroup('members')` (NOT `users.orgIds`, which is overwrite-broken); routes through `mergeAndSetCustomClaims` so `superAdmin` survives; a primary-membership delete clears primary keys but recomputes `orgs` from surviving members (never blanket-clears a still-valid second-org membership) | unit (mocked Admin SDK) | `cd functions && npx vitest run src/orgMembershipClaims.test.ts` | ❌ W0 | ⬜ pending |
| 73-02-01 | 02 | 2 | R209 | T-73-cross-org | `storage.rules` isOrgMemberByClaim allows a multi-org user on BOTH their org paths and DENIES a non-member org path — genuine emulator ALLOW + cross-org DENY | rules (emulator) | `npm run test:rules` (storage) | ❌ W0 | ⬜ pending |
| 73-02-02 | 02 | 2 | R211 | — | Legacy single-org claim (`orgId`/`role` only, no `orgs`) still ALLOWS its primary org — backward-compat arm proven; existing no-firestore.exists guard intact | rules (emulator) | `npm run test:rules` (storage) | ❌ W0 | ⬜ pending |
| 73-03-01 | 03 | 3 | R210 | T-73-claim-wipe | Idempotent, dry-run-by-default, `--apply`-gated backfill adds `orgs` for all users (grouped by uid from one collectionGroup scan), skip-if-matching, via `mergeAndSetCustomClaims` (superAdmin preserved) | unit (mocked Admin SDK) | `cd functions && npx vitest run src/backfillOrgClaims.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New assertions in `functions/src/orgMembershipClaims.test.ts` — multi-org `orgs` map built; delete recompute drops the removed org (delete-staleness); superAdmin preserved through widen; primary-clear does not wipe a surviving second org.
- [ ] New multi-org ALLOW + cross-org DENY + legacy-claim ALLOW cases in `src/storage.rules.test.ts` using `testEnv.authenticatedContext(uid, claims)` to mint the `orgs`-map claim.
- [ ] New assertions in `functions/src/backfillOrgClaims.test.ts` — idempotent add of `orgs`, skip-if-matching, superAdmin preserved (backfill switched to `mergeAndSetCustomClaims`).

*Existing functions-vitest + rules-emulator infrastructure covers all phase requirements — no framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deployed widened writer + backfill + storage.rules actually grant a real multi-org user Storage access to both orgs in production | R207–R211 | Requires the owner-gated deploy sequence (widened writer → backfill → storage.rules) + real tokens; UNDEPLOYED this phase | Deferred to `/gsd-verify-work 73` + the owner deploy runbook — record in PENDING-VERIFICATION.md, never mark passed |

*All in-repo behaviors have automated verification (unit + emulator); only the production deploy confirmation is manual/owner-gated.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
