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
| 145-01-T1 | 01 | 1 | R448/R451 | T-145-01, T-145-04, T-145-05 | Two targeted hosting blocks; legacy has only `/api/**` + `**` rewrites, no `/__` source, `/bridge-assets/**`-only immutable | unit (JSON shape) | `npx vitest run src/__tests__/firebaseHostingTargets.test.ts src/__tests__/firebaseHostingHeaders.test.ts` | ❌ W0 / ♻️ adapt | ⬜ pending |
| 145-01-T2 | 01 | 1 | R449 | T-145-03, T-145-07 | New default base URL; one-slash links for every builder family | unit | `cd functions && npx vitest run src/params.test.ts src/adminEmail.test.ts src/inviteOnboarding.test.ts src/volunteerLink.test.ts src/index.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 145-01-T3 | 01 | 1 | R449/R450 | T-145-02, T-145-06, T-145-08 | CORS lists exact five origins, no wildcard; no old-domain literal in shipped code | unit (JSON + source scan) | `npx vitest run src/__tests__/storageCors.test.ts src/__tests__/legacyOriginLiterals.test.ts` | ❌ W0 | ⬜ pending |
| 145-02-T1 | 02 | 1 | R452 | T-145-10, T-145-11, T-145-12, T-145-14 | Allowlist + denylist + per-key validate-and-rebuild; codec rejects malformed | unit | `npx vitest run src/originHandoff/__tests__/allowlist.test.ts src/originHandoff/__tests__/codec.test.ts src/utils/__tests__/monitorConfig.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| 145-02-T2 | 02 | 1 | R452 | T-145-13, T-145-16, T-145-17, T-145-19 | Fill-if-absent, caps, strip + hash restore, no re-import on reload | unit (jsdom) | `npx vitest run src/originHandoff/__tests__/apply.test.ts src/originHandoff/__tests__/bootstrap.test.ts` | ❌ W0 | ⬜ pending |
| 145-02-T3 | 02 | 1 | R452 | T-145-18 | Bootstrap is main.ts's first import; one keyed notice when consumed | unit (source order + store) | `npx vitest run src/originHandoff/__tests__/mainOrder.test.ts && npm run build` | ❌ W0 | ⬜ pending |
| 145-03-T1 | 03 | 2 | R451/R452 | T-145-20, T-145-21, T-145-22 | Redirect host is constant; `//evil` cannot change it; fragment-only allowlisted payload; flag once | unit | `npx vitest run src/originHandoff/__tests__/bridge.test.ts` | ❌ W0 | ⬜ pending |
| 145-03-T2 | 03 | 2 | R451 | T-145-23, T-145-24 | Bridge bundle has no Vue/Pinia/Firebase, noscript link, bridge-assets dir; dist-legacy ignored | build integration | `npx vitest run src/originHandoff/__tests__/legacyBuild.test.ts && npm run build:legacy` | ❌ W0 | ⬜ pending |
| 145-03-T3 | 03 | 2 | R453 (+R448/R450 docs) | T-145-25, T-145-26, T-145-27 | Runbook order, per-step commands, owner-confirmed, status-only env checks | unit (string) | `npx vitest run src/__tests__/cutoverRunbook.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/originHandoff/__tests__/{allowlist,codec,apply,bootstrap,mainOrder}.test.ts` (145-02) and `{bridge,legacyBuild}.test.ts` (145-03)
- [ ] `src/__tests__/{firebaseHostingTargets,legacyOriginLiterals,storageCors}.test.ts` (145-01) and `cutoverRunbook.test.ts` (145-03)
- [ ] `functions/src/params.test.ts` + one-slash cases in `adminEmail`/`inviteOnboarding`/`volunteerLink`/`index` tests (145-01)
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
