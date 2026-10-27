---
phase: 145
slug: domain-cutover-to-worshipbuilder-web-app
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-27
---

# Phase 145 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `145-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (jsdom default; per-file `// @vitest-environment node` allowed) + functions vitest |
| **Config file** | `vite.config.ts` (root `test:` block); `functions/vitest.config.ts` |
| **Quick run command** | `npx vitest run src/originHandoff src/__tests__` |
| **Full suite command** | `npx vitest run` (baseline: only `src/storage.rules.test.ts` fails) + `npm run type-check` + `cd functions && npx vitest run` |
| **Estimated runtime** | < 30 s quick · ~14 min root full |

---

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** root `npx vitest run` + `npm run type-check` (+ functions suite when `params.ts` changes)
- **Before `/gsd-verify-work`:** full root suite at baseline, type-check clean, functions green, `npm run build:legacy` produces `dist-legacy/index.html`, `npm run build` still passes the Firebase env guard
- **Max feedback latency:** 30 s (quick)

---

## Per-Task Verification Map

Requirement-level map (task IDs filled once PLAN.md files exist).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | R448 | — | Two hosting targets; legacy has only `/api/**` + `**` rewrites | unit (JSON shape) | `npx vitest run src/__tests__/firebaseHostingTargets.test.ts src/__tests__/firebaseHostingHeaders.test.ts` | ❌ W0 / ♻️ adapt | ⬜ pending |
| TBD | TBD | TBD | R449 | — | No old-domain literal in shipped code; new default base URL | unit (source scan) | `npx vitest run src/__tests__/legacyOriginLiterals.test.ts` + `cd functions && npx vitest run` | ❌ W0 / ✅ | ⬜ pending |
| TBD | TBD | TBD | R450 | — | CORS lists exact origins, no wildcard | unit (JSON) | `npx vitest run src/__tests__/storageCors.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R451 | — | Redirect host is constant; `//evil` cannot change it | unit + build | `npx vitest run src/originHandoff/__tests__/bridge.test.ts src/originHandoff/__tests__/legacyBuild.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R452 | — | Allowlist + per-key validation, fill-if-absent, size caps, no auth state, fragment-only | unit (jsdom) | `npx vitest run src/originHandoff/__tests__/allowlist.test.ts src/originHandoff/__tests__/apply.test.ts src/originHandoff/__tests__/mainOrder.test.ts src/utils/__tests__/monitorConfig.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| TBD | TBD | TBD | R453 | — | Runbook marks every production step owner-confirmed | unit (string) | `npx vitest run src/__tests__/cutoverRunbook.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/originHandoff/__tests__/{allowlist,apply,bridge,legacyBuild,mainOrder}.test.ts`
- [ ] `src/__tests__/{firebaseHostingTargets,legacyOriginLiterals,storageCors,cutoverRunbook}.test.ts`
- [ ] Adapt `src/__tests__/firebaseHostingHeaders.test.ts` (`loadFirebaseConfig` returns the `app` block; add `legacy` assertions) — file contains a NUL byte; edit carefully
- [ ] Export `isValidMapping`, `isValidVideoKeyColor` from `src/utils/monitorConfig.ts`
- Framework install: none.

---

## Manual-Only Verifications

Batched to the v2.16 milestone-end owner UAT (PENDING, not owner-accepted) — all need the production cutover.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google + password + magic-link sign-in on the new domain | R450/R451 | Real OAuth / email flows | Runbook smoke step, before the bridge deploy |
| Old URL → same page on new domain, with saved setup carried | R451/R452 | Real cross-origin browser state | From a Run computer with monitor config: open an old bookmark |
| Window-placement / Automatic Fullscreen re-grant | R453 | Per-origin browser permission | On each Run computer after cutover |
| Storage download Save-dialog on the new domain | R450 | Real bucket CORS | Download a song file attachment |
| Runbook followed end to end; rollback understood | R453 | Owner process | Cutover day |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
