---
phase: 68
slug: super-admin-access-gate
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 68 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 68-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (functions)** | vitest `^4.1.10` — `functions/package.json` `"test": "vitest run"` |
| **Framework (rules)** | vitest `^4.0.18` (root) + `@firebase/rules-unit-testing` via `vitest.rules.config.ts` |
| **Framework (app/client)** | vitest `^4.0.18` (root); `vite.config.ts` excludes `rules.test.ts` + `render-service/**` |
| **Quick run (functions)** | `cd functions && npx vitest run claimsHelpers.test.ts superAdminClaims.test.ts` |
| **Quick run (rules)** | `npx vitest run --config vitest.rules.config.ts` (emulator already running; `npm run test:rules` errors "port taken" if one is up — per CLAUDE.md) |
| **Full suite** | `cd functions && npm test` · rules suite · `npx vitest run` (app) · `npm run type-check` |
| **Type gate** | `npm run type-check` (the `vue-tsc --build` form — checks test files too, per CLAUDE.md) |
| **Estimated runtime** | functions unit ~5–15s; rules emulator ~20–40s |

---

## Sampling Rate

- **After every task commit:** the relevant quick-run command from the map below (functions unit tests are fast; rules-emulator tests need the emulator already running).
- **After every plan wave:** `cd functions && npm test` + `npx vitest run --config vitest.rules.config.ts` + `npm run type-check`.
- **Before `/gsd-verify-work`:** full suite green — app-suite baseline stays the documented 2 known-failing files (`storage.rules.test.ts`, `RosterView.test.ts`), neither of which this phase touches.
- **Max feedback latency:** ~40s (rules emulator run).

---

## Per-Task Verification Map

> Task IDs assigned by the planner; this seed maps each requirement to its automated command. The planner/executor fills the Task ID + Wave columns.

| Req | Behavior | Test Type | Automated Command | File | Status |
|-----|----------|-----------|-------------------|------|--------|
| R174 | Writing `superAdmins/{uid}` → `superAdmin: true` claim | unit | `cd functions && npx vitest run superAdminClaims.test.ts -t "sets the claim"` | ❌ W0 | ⬜ pending |
| R175-A | Org-membership clear preserves `superAdmin` | unit (regression, extends existing) | `cd functions && npx vitest run orgMembershipClaims.test.ts -t "preserves superAdmin"` | ❌ W0 | ⬜ pending |
| R175-B | Super-admin revoke preserves `{orgId, role}` | unit (regression) | `cd functions && npx vitest run superAdminClaims.test.ts -t "preserves orgId/role"` | ❌ W0 | ⬜ pending |
| R175-helper | `mergeAndSetCustomClaims`/`clearClaimKeys` in isolation | unit | `cd functions && npx vitest run claimsHelpers.test.ts` | ❌ W0 | ⬜ pending |
| R176 | Bootstrap dry-run writes nothing; `--apply` writes doc + claim | unit + manual | `cd functions && npx vitest run bootstrapSuperAdmin.test.ts` (dry-run automatable; real `--apply` is owner-run) | ❌ W0 | ⬜ pending |
| R177 | Non-super-admin redirected from `/owner-console`; super-admin reaches it | manual UAT | no router-guard unit precedent in repo → manual-only | manual | ⬜ pending |
| R178-ALLOW | Genuine super-admin reads/writes `appConfig/global` + `superAdmins/{uid}` | rules emulator | `npx vitest run --config vitest.rules.config.ts -t "ALLOWS a genuine super-admin"` | ❌ W0 | ⬜ pending |
| R178-DENY | Non-admin + org-editor (role claim only) denied on both collections | rules emulator | `npx vitest run --config vitest.rules.config.ts -t "DENIES"` | ❌ W0 | ⬜ pending |
| R179-grant | `setSuperAdminClaim` grants; rejects non-admin caller | unit | `cd functions && npx vitest run superAdminClaims.test.ts -t "setSuperAdminClaimHandler"` | ❌ W0 | ⬜ pending |
| R179-revoke | Revoke calls `revokeRefreshTokens`; target denied on next check | unit (mock) + manual UAT (timing) | `cd functions && npx vitest run superAdminClaims.test.ts -t "revoke"` (mock-verifies call); real session-cutoff timing manual | mock ❌ W0; timing manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `functions/src/claimsHelpers.test.ts` — new; `mergeAndSetCustomClaims`/`clearClaimKeys` in isolation (mock `firebase-admin/auth` per `orgMembershipClaims.test.ts`'s `mockAuth()` helper).
- [ ] `functions/src/superAdminClaims.test.ts` — new; `syncSuperAdminClaimHandler` + `setSuperAdminClaimHandler` (mirrors `orgMembershipClaims.test.ts` + `fakeRequest()` from `functions/src/index.test.ts`).
- [ ] `functions/src/bootstrapSuperAdmin.test.ts` — new; mirrors `backfillOrgClaims.test.ts` dry-run/apply shape.
- [ ] Extend `functions/src/orgMembershipClaims.test.ts` — add the SC1 regression (org-clear preserves `superAdmin`) to the EXISTING file (it tests the modified handler there).
- [ ] New `describe` blocks in `src/rules.test.ts` — genuine ALLOW + DENY for `appConfig/*` and `superAdmins/*`; no new emulator config (existing `vitest.rules.config.ts`/`beforeAll` reads `firestore.rules` fresh).
- [ ] Framework install: none — vitest + `@firebase/rules-unit-testing` already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Non-super-admin redirected from `/owner-console`, super-admin reaches it | R177 | No router-guard unit-test precedent in repo; needs a real signed-in session | Sign in as a super-admin → nav shows "Owner Console", route loads; sign in as ordinary user → nav entry absent, direct `/owner-console` redirects home. Deferred to `/gsd-verify-work 68`. |
| Real revoke session-cutoff timing | R179-revoke | The mock proves `revokeRefreshTokens` is called; actual ≤1hr propagation window is a live-Firebase behavior (Open Q1) | After deploy, revoke a test super-admin, confirm they lose `appConfig` write on next token refresh. Deferred to `/gsd-verify-work 68`. |
| Bootstrap `--apply` against production | R176 | Owner-run once; grants the first super-admin — cannot run in CI | Owner runs `node …/bootstrapSuperAdmin --email <owner> --apply` after deploy (hand-over). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (R177 real-route + R179 timing are manual-only, disclosed above — not silently skipped)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter (by validate-phase)

**Approval:** pending
