---
phase: 125
slug: passwordless-magic-link-access-scoped-read-isolation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 125 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase; the planner fills the Per-Task Verification Map and Wave 0 from the PLANs, and
> `/gsd-validate-phase` finalizes it. RESEARCH.md carries the Validation Architecture this derives from.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app suite + rules suite) |
| **Config file** | `vite.config.ts` (app), `vitest.rules.config.ts` (Firestore/Storage rules) |
| **Quick run command** | `npx vitest run` (app; 1 known-failing baseline: `src/storage.rules.test.ts`) |
| **Full suite command** | `npx vitest run` + `npm run test:rules` + `npm run type-check` |
| **Estimated runtime** | ~60–120 seconds (app) + rules-emulator startup |

---

## Sampling Rate

- **After every task commit:** Run `npm run type-check` + the touched test file(s)
- **After every plan wave:** Run `npx vitest run` (app) and, for rules changes, `npm run test:rules`
- **Before `/gsd-verify-work`:** Full suite must be green (baseline exceptions per CLAUDE.md)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

*Filled from the PLANs. The R377 rules ALLOW/DENY cases appear as `test:rules` rows (125-01-T1 / 125-01-T2).*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 125-01-T1 | 01 | 1 | R377 | T-125-01..06 | R377 ALLOW/DENY isolation suite: cross-org DENY, Draft DENY, reopened DENY, not-assigned DENY, direct services/{id} DENY, volunteer-write DENY, enumeration DENY, assigned+Planned ALLOW, member ALLOW | rules | `npm run test:rules` | ❌ W0 (extends `src/rules.test.ts`) | ⬜ pending |
| 125-01-T2 | 01 | 1 | R377 | T-125-01..06 | rehearseAccess rule block (email-claim + live parentIsPlanned) + catch-all exclusion | rules | `npm run test:rules` | ✅ (`firestore.rules`) | ⬜ pending |
| 125-02-T1 | 02 | 2 | R377 | T-125-09 | buildRehearseAccess: email lowercasing/dedupe, empty-email skip, PII-safe attachment mapping | unit | `npx vitest run src/utils/rehearseAccess.test.ts` | ❌ W0 (new) | ⬜ pending |
| 125-02-T2 | 02 | 2 | R377 | T-125-08 | lock-time projection write + reopen/delete cleanup (Reopen staleness) | type/unit | `npm run type-check` | ✅ (`src/stores/services.ts`) | ⬜ pending |
| 125-03-T1 | 03 | 1 | R375 | T-125-12 | `{{rehearse_link}}` merge token renders the URL | unit | `cd functions && npm test -- messageTokens` | ✅ (`functions/src/messageTokens.test.ts`) | ⬜ pending |
| 125-03-T2 | 03 | 1 | R375 | T-125-10, T-125-13 | per-recipient server-side link gen inside the send loop's try/catch | build | `cd functions && npm run build` | ✅ (`functions/src/index.ts`) | ⬜ pending |
| 125-04-T1 | 04 | 1 | R374, R376 | T-125-14, T-125-16 | email-link completion + cross-device re-entry; email never from URL param | unit | `npx vitest run src/stores/__tests__/volunteerAuth.test.ts` | ❌ W0 (new) | ⬜ pending |
| 125-04-T2 | 04 | 1 | R374, R376 | T-125-16 | completion + landing views; session survival + explicit sign-out | type | `npm run type-check` | ❌ W0 (new views) | ⬜ pending |
| 125-04-T3 | 04 | 1 | R377 (defense-in-depth) | T-125-15, T-125-17 | isVolunteerRoute org-selection-gate exemption (Pitfall 1) | unit | `npx vitest run src/router/__tests__/router.test.ts` | ✅ (`src/router/__tests__/router.test.ts`) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/rules.test.ts` — add the `describe('Volunteer magic-link scoped read access — R377')` block
      (9 ALLOW/DENY cases; authored in Plan 125-01 Task 1) — extends the existing harness
- [ ] `src/utils/rehearseAccess.test.ts` (new) — projection builder unit tests (Plan 125-02 Task 1)
- [ ] `src/stores/__tests__/volunteerAuth.test.ts` (new) — email-link completion + cross-device unit tests
      (Plan 125-04 Task 1)
- [ ] `src/router/__tests__/router.test.ts` — add the isVolunteerRoute exemption cases (extends existing file,
      Plan 125-04 Task 3)
- [ ] `functions/src/messageTokens.test.ts` — extend for the `{{rehearse_link}}` token (existing file, Plan 125-03 Task 1)
- [ ] Framework install: none — vitest (app), `@firebase/rules-unit-testing` (rules), and the functions test
      runner are all already present

*Frameworks all present; the Wave 0 items above are test authoring within Plans 125-01/02/03/04, not separate scaffolding tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real magic-link email arrives + one-click sign-in end to end | R374, R375 | Requires a live Resend send + real inbox (deferred to batched UAT) | Trigger a reminder/share email to a rostered volunteer; click the link; confirm signed-in landing |

*The R377 isolation guarantee is NOT manual — it must be proven by emulator ALLOW/DENY tests.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
