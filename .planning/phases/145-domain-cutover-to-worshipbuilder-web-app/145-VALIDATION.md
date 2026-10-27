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
> Source: `145-RESEARCH.md` § Validation Architecture, revised for CONTEXT "Amendment 2 — owner scope cut 2026-10-27"
> (plain Hosting redirect, R452 descoped, no open-tab handling).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (jsdom default) + functions vitest (node) |
| **Config file** | `vite.config.ts` (root `test:` block); `functions/vitest.config.ts` |
| **Quick run command** | `npx vitest run src/__tests__` |
| **Functions gate** | `cd functions && npx vitest run` + `cd functions && npx tsc --noEmit` (functions tests are never gated through the root runner) |
| **Full suite command** | `npx vitest run` (baseline: only `src/storage.rules.test.ts` fails) + `npm run type-check` + the functions gate |
| **Estimated runtime** | < 30 s quick · ~14 min root full |

---

## Sampling Rate

- **After every task commit:** quick run command (or the functions gate for functions tasks)
- **Before every task commit:** staging gate `! git diff --cached --name-only | grep -qE '^(\.planning/graphs/|dist-legacy/|functions/lib/|functions/\.env$)'` exits 0; explicit-path staging only
- **After every plan wave:** root `npx vitest run` + `npm run type-check` (+ the functions gate when `params.ts` changes)
- **Before `/gsd-verify-work`:** full root suite at baseline, type-check clean, functions gate green, `npm run build` still passes the Firebase env guard, cumulative staging gate over `c59dab23..HEAD` exits 0
- **Max feedback latency:** 30 s (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 145-01-T1 | 01 | 1 | R448/R451 | T-145-01, T-145-04, T-145-05, T-145-09 | Two targeted hosting blocks; legacy = exactly two 302 regex redirects to the constant new origin that never match `/__`; no legacy rewrite/predeploy/headers; `legacy-site/` one static page | unit (JSON shape + redirect model) | `npx vitest run src/__tests__/firebaseHostingTargets.test.ts src/__tests__/firebaseHostingHeaders.test.ts` | ❌ W0 / ♻️ adapt | ⬜ pending |
| 145-02-T1 | 02 | 1 | R449 | T-145-03, T-145-07 | New default base URL; one-slash links for every builder family | unit (functions) | `cd functions && npx vitest run src/params.test.ts src/adminEmail.test.ts src/inviteOnboarding.test.ts src/volunteerLink.test.ts src/index.test.ts && npx tsc --noEmit` | ❌ W0 / ✅ | ⬜ pending |
| 145-02-T2 | 02 | 1 | R449/R450 | T-145-02, T-145-06, T-145-08 | CORS lists exact five origins, no wildcard; no old-domain literal in shipped code | unit (JSON + source scan) | `npx vitest run src/__tests__/storageCors.test.ts src/__tests__/legacyOriginLiterals.test.ts` | ❌ W0 | ⬜ pending |
| 145-03-T1 | 03 | 2 | R453 (+R448/R450/R451 apply steps) | T-145-25, T-145-26, T-145-27, T-145-28 | Runbook order, per-step commands, owner-confirmed, quiet CRLF-tolerant env checks, Step 6 redirect + `/__/` curls, no settings-carry material | unit (string) | `npx vitest run src/__tests__/cutoverRunbook.test.ts` | ❌ W0 | ⬜ pending |
| 145-03-T2 | 03 | 2 | R448/R451 (docs) | T-145-29 | ADR-0247 resolves every pointer; INTEGRATIONS.md names `hosting:app` / `hosting:legacy` | grep | `grep -rhoE 'docs/adr/0247-[a-z0-9-]+\.md' src functions/src \| sort -u` | ❌ W0 | ⬜ pending |

R452 has no row: descoped by the owner on 2026-10-27 (CONTEXT Amendment 2).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/firebaseHostingTargets.test.ts` (145-01), `src/__tests__/{legacyOriginLiterals,storageCors}.test.ts` (145-02), `src/__tests__/cutoverRunbook.test.ts` (145-03)
- [ ] `functions/src/params.test.ts` + one-slash cases in `adminEmail`/`inviteOnboarding`/`volunteerLink`/`index` tests (145-02)
- [ ] Adapt `src/__tests__/firebaseHostingHeaders.test.ts` (`loadHostingBlock('app')`) — file contains a NUL byte; edit carefully (145-01)
- Framework install: none.

---

## Manual-Only Verifications

Batched to the v2.16 milestone-end owner UAT (PENDING, not owner-accepted) — all need the production cutover.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google + password + magic-link sign-in on the new domain | R450/R451 | Real OAuth / email flows | Runbook Step 5 (after the functions deploy), before the redirect deploy |
| Production redirect keeps path + query; `/__/auth/handler` and `/__/firebase/init.json` still 200 on the old firebaseapp.com | R451 | Production Hosting behavior (docs silent on query strings; emulator-verified only) | Runbook Step 6 curls right after `hosting:legacy`; record the `?y=a%2Fb` result |
| Old bookmark / share link (with #section) lands on the same page at the new domain | R451 | Real browser redirect | Open an old bookmark and an old share link |
| Run computer re-set (church, monitor setup, video key color) + Window management / Automatic Fullscreen re-grant | R453 | Per-origin browser state and permissions | On each Run computer after cutover (runbook Step 7) |
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
