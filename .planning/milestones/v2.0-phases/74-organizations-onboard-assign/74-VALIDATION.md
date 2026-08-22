---
phase: 74
slug: organizations-list-onboard-admin-assignment
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-21
---

# Phase 74 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest — functions unit tests (mocked Admin SDK/Auth) + Vue component mount tests (jsdom, httpsCallable mock) |
| **Config file** | functions vitest config; root vite.config.ts (app suite) |
| **Quick run command** | `cd functions && npx vitest run src/orgProvisioning.test.ts` · `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` |
| **Full suite command** | functions: `cd functions && npx vitest run` · app: `npx vitest run` |
| **Estimated runtime** | ~15s functions; ~60s app suite |

---

## Sampling Rate

- **After every task commit:** Run the relevant test file (callable unit tests or the OrganizationsTab component tests)
- **After every plan wave:** functions suite for callable changes; app suite for UI changes
- **Before `/gsd-verify-work`:** functions + app suites green (app at the documented 2-file baseline)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Seeded from RESEARCH §Validation Architecture; planner refines Task IDs to its wave/plan split.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 74-01-01 | 01 | 1 | R200, R204 | T-74-authz | All three callables reject non-super-admins (unauthenticated + permission-denied) via the dual gate (token flag + fresh `superAdmins/{callerUid}` re-read), mirroring `setSuperAdminClaim` | unit (mocked Admin SDK/Auth) | `cd functions && npx vitest run src/orgProvisioning.test.ts` | ❌ W0 | ⬜ pending |
| 74-01-02 | 01 | 1 | R201, R202 | T-74-dup-org | `orgNames` uniqueness enforced in a get-then-create transaction — a duplicate church name is rejected and NO second org is created; a retry after fixing input succeeds without a stranded half-created org | unit | `cd functions && npx vitest run src/orgProvisioning.test.ts` | ❌ W0 | ⬜ pending |
| 74-01-03 | 01 | 1 | R197, R198, R199 | — | onboardOrganization creates org doc + default OrgSettings + seeded defaultServiceTemplate (byte-identical to buildSuggestedTemplateEntries) + assigns first admin | unit | `cd functions && npx vitest run src/orgProvisioning.test.ts` | ❌ W0 | ⬜ pending |
| 74-01-04 | 01 | 1 | R206 | T-74-org-overwrite | assignAdminCore appends to `users/{uid}.orgIds` via `arrayUnion` (NEVER set/overwrite) — a user already in another org keeps it; shared helper used by BOTH onboarding and assignment (no copy-paste overwrite regression) | unit | `cd functions && npx vitest run src/orgProvisioning.test.ts` | ❌ W0 | ⬜ pending |
| 74-01-05 | 01 | 1 | R203, R205 | — | assignOrgAdmin: existing account → editor membership (added); no account → invite artifacts written and returns `{status:'invited'}` (discriminates `auth/user-not-found`, no dangling membership, no silent failure) | unit | `cd functions && npx vitest run src/orgProvisioning.test.ts` | ❌ W0 | ⬜ pending |
| 74-02-01 | 02 | 2 | R196 | — | Organizations tab lists every org (name/id/created/member count) with loading/empty/error states; calls `listOrganizations` | component (mount + httpsCallable mock) | `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` | ❌ W0 | ⬜ pending |
| 74-02-02 | 02 | 2 | R197–R206 (UI) | — | Onboard form (name+admin email) → onboardOrganization with success/name-taken/invalid-email/added-vs-invited feedback; per-org assign-admin control → assignOrgAdmin with added-vs-invited/error feedback; client never writes org/members/orgNames directly | component | `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New `functions/src/orgProvisioning.test.ts` — caller-gate rejections, orgNames-uniqueness transaction (dup rejected/no-strand), template seeding, additive `arrayUnion` (shared helper), added-vs-invited paths, `auth/user-not-found` discrimination. Mirror `superAdminClaims.test.ts` / `orgMembershipClaims.test.ts` mocked-Admin-SDK harness.
- [ ] New `src/components/admin/__tests__/OrganizationsTab.test.ts` — mount + `httpsCallable` mock (per OwnerConsoleView.test.ts), list/onboard/assign flows + states.

*Existing vitest infrastructure covers all phase requirements — no framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deployed callables actually onboard a real church + admin in production, and a real second-org admin retains access to both orgs | R196–R206 | Requires the owner-gated `firebase deploy --only functions:onboardOrganization,assignOrgAdmin,listOrganizations` + real Auth accounts | Deferred to `/gsd-verify-work 74` — record in PENDING-VERIFICATION.md, never mark passed |
| Real-browser visual confirmation of the Organizations tab (list/onboard/assign) | UI-SPEC | jsdom cannot fully prove live rendering | Deferred to `/gsd-verify-work 74` (human UAT) |

*Automated unit + component tests cover the callable logic and UI flows; only the deployed/production + visual confirmations are manual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-21 (structural Nyquist gates satisfied by the plans; per-task status columns flip to green as tasks land)
