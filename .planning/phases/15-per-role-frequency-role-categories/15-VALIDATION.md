---
phase: 15
slug: per-role-frequency-role-categories
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run src/utils/scheduler.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/utils/scheduler.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | D-XX | — | N/A | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Planner/nyquist-auditor populates one row per task, mapping each D-01..D-12 decision to a deterministic scheduler unit test or migration test (see RESEARCH.md Validation Architecture).*

---

## Wave 0 Requirements

*Existing infrastructure (vitest + scheduler.test.ts) covers all phase requirements. New co-occurrence and migration logic is TDD-covered in scheduler.test.ts and the store/migration test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-role frequency controls render one row per held role in Edit Volunteer form | D-01 | Vue component visual/interaction | Open Edit Volunteer form, check a role, confirm a cadence dropdown appears for that role |
| Availability drawer shows one tier control per held role | D-06 | Vue component visual/interaction | Open availability drawer for a person, confirm per-role tier controls |
| Manual-grid co-occurrence warning surfaces on illegal combo | D-11 | Vue component visual/interaction | Manually assign a person to TECH + BAND same service, confirm visible warning flag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
