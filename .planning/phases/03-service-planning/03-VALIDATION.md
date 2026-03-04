---
phase: 3
slug: service-planning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `vite.config.ts` (test section: `environment: 'jsdom'`, excludes `src/rules.test.ts`) |
| **Quick run command** | `npx vitest run --reporter=verbose src/stores/__tests__/services.test.ts src/utils/suggestions.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose src/stores/__tests__/services.test.ts src/utils/suggestions.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PLAN-01 | unit (store) | `npx vitest run src/stores/__tests__/services.test.ts -t "createService"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PLAN-02 | unit (store) | `npx vitest run src/stores/__tests__/services.test.ts -t "progression"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PLAN-03 | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "slotTypes"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | PLAN-04, PLAN-05 | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "team filter"` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | PLAN-06 | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "ranking"` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | PLAN-07 | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "manual override"` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | PLAN-08 | unit (store) | `npx vitest run src/stores/__tests__/services.test.ts -t "lastUsedAt"` | ❌ W0 | ⬜ pending |
| 03-02-05 | 02 | 1 | PLAN-09 | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "recency penalty"` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 1 | SCRI-01, SCRI-02 | unit (store) | `npx vitest run src/stores/__tests__/services.test.ts -t "scripture"` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 1 | SCRI-03 | unit (util) | `npx vitest run src/utils/esv.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 1 | SCRI-04 | component | `npx vitest run src/components/__tests__/ScriptureSlot.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | CAL-01 | component | `npx vitest run src/components/__tests__/ServiceCard.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 2 | CAL-02, CAL-03 | unit (computed) | `npx vitest run src/utils/rotationTable.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/__tests__/services.test.ts` — stubs for PLAN-01, PLAN-02, PLAN-04, PLAN-08, SCRI-01, SCRI-02
- [ ] `src/utils/suggestions.test.ts` — stubs for PLAN-03, PLAN-05, PLAN-06, PLAN-07, PLAN-09
- [ ] `src/utils/esv.test.ts` — stubs for SCRI-03
- [ ] `src/components/__tests__/ServiceCard.test.ts` — stubs for CAL-01
- [ ] `src/utils/rotationTable.test.ts` — stubs for CAL-02, CAL-03
- [ ] `src/components/__tests__/ScriptureSlot.test.ts` — stubs for SCRI-04
- [ ] Framework install: none required — Vitest + jsdom + @vue/test-utils already installed

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark mode visual consistency | All | Visual styling judgment | Inspect service editor, services list, and rotation table in browser — verify gray-950/900/800 palette matches Phase 1/2 |
| ESV.org link opens correctly | SCRI-03 | External URL navigation | Click ESV link on a scripture slot — verify correct passage opens in new tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
