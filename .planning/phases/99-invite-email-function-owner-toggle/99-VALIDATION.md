---
phase: 99
slug: invite-email-function-owner-toggle
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 99 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (root jsdom for `src/`; functions `*.test.ts` collected by the same root run) |
| **Config file** | `vite.config.ts` (excludes `src/rules.test.ts` + `render-service/**`) |
| **Quick run command** | `npx vitest run functions/src` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60–120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run the quick command scoped to the touched files.
- **After every plan wave:** Run `npx vitest run` (bare — the correct single-file baseline is `src/storage.rules.test.ts`).
- **Before `/gsd-verify-work`:** Full suite green except the known `storage.rules.test.ts` baseline.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

*(Filled by the planner/nyquist auditor from PLAN.md tasks. Requirements in scope: R289, R290, R291, R293.)*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 99-01-T1 | 99-01 | 1 | R293 | T-99-08 | `onboarding.emailsEnabled` coerces fail-closed (only literal `true` enables); both mirrors value-identical | unit | `cd functions && npx vitest run src/appConfig.test.ts` + `npx vitest run src/config/__tests__/appConfigDefaults.test.ts` | ❌ extend existing | ⬜ pending |
| 99-01-T2 | 99-01 | 1 | R293 | T-99-07 | Owner Console checkbox saves `onboarding.emailsEnabled` via `saveField`; reverts on failure | component | `npx vitest run src/components/admin/__tests__/OnboardingConfigCard.test.ts src/components/admin/__tests__/ConfigurationTab.test.ts` | ❌ W0 (new) | ⬜ pending |
| 99-02-T1 | 99-02 | 2 | R289/R290/R291/R293 | T-99-01, T-99-03, T-99-06 | Org-editor gate + gmail/non-Google branch + toggle short-circuit; compiles (no circular import / unexported import) | build | `cd functions && npm run build` | n/a (tsc) | ⬜ pending |
| 99-02-T2 | 99-02 | 2 | R289/R290/R291/R293 | T-99-01, T-99-02, T-99-06 | Handler: caller gate, disabled short-circuit, gmail notify (no createUser), non-Google createUser+resetLink, email-already-exists race | unit | `npx vitest run functions/src/inviteOnboarding.test.ts` | ❌ W0 (new) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing vitest infrastructure covers all phase requirements — no new framework install. New test files (function handler, appConfig coerce, client drift-guard update) are created alongside their source per the handler-body-exported-separately pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real email delivery to a non-owner inbox | R289/R290 | Depends on owner-run Resend DNS domain verification; test sender only reaches the Resend account owner | After domain verification + toggle ON, invite a real external address and confirm receipt (milestone-end owner UAT) |
| Owner Console toggle round-trip visible in `appConfig/global` | R293 | UI + live Firestore | In the Owner Console Configuration tab, flip the onboarding-emails toggle and confirm the `(default)` badge/state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
