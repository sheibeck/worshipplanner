---
phase: 146
slug: spec-standard
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-06
---

# Phase 146 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (jsdom env; the check doesn't use the DOM) |
| **Config file** | `vite.config.ts` (`test` block) |
| **Quick run command** | `npx vitest run src/__tests__/specCoverage.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Type gate** | `npm run type-check` |
| **Estimated runtime** | quick ~10 seconds; full ~310 seconds; type gate ~65 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/specCoverage.test.ts`
- **After every plan wave:** Run the quick command plus `npm run type-check`
- **Before `/gsd-verify-work`:** bare `npx vitest run` shows only the `src/storage.rules.test.ts` baseline failure, and `npm run type-check` is clean
- **Max feedback latency:** 10 seconds for the quick command

---

## Per-Task Verification Map

Filled in by the plans. Requirement-level map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| R454 | Template parses clean and has every required section | unit (reads template) | `npx vitest run src/__tests__/specCoverage.test.ts -t R454` | ❌ W0 | ⬜ pending |
| R455 | `CLAUDE.md` and `PROJECT.md` carry the same rule sentence; the `PROJECT.md` section sits outside milestone blocks | repo check | same file, `-t R455` | ❌ W0 | ⬜ pending |
| R456 | IDs are literal, strictly formatted, unique across specs, and retired IDs aren't reused | unit (inline strings) | same file, `-t R456` | ❌ W0 | ⬜ pending |
| R457 | An uncited criterion fails and names its ID; fully cited passes; template ignored; all four test locations read; `functions/lib` and `node_modules` ignored; skipped tests, comments and strings not counted; real repo clean | unit + temp-dir + real run | same file, `-t R457` | ❌ W0 | ⬜ pending |
| R458 | `workflow.tdd_mode` is true; `CLAUDE.md` states the test-first split | repo check | same file, `-t R458` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/specCoverage.test.ts` — all five requirement groups, titles citing `R454`..`R458`, with no `AC-` tokens in titles
- [ ] `src/__tests__/specCoverage.ts` — pure logic, RED test first
- [ ] `docs/specs/TEMPLATE.md`

No framework install is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A new spec can be started by copying the template | R454 | Usability of a document | Copy `docs/specs/TEMPLATE.md`, fill it in, and confirm the check reads it (Phase 147 does this for real) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
