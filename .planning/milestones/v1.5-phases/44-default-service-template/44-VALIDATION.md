---
phase: 44
slug: default-service-template
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from 44-RESEARCH.md § Validation Architecture. The per-task map is filled by the planner / validate-phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (Vue 3 + @vue/test-utils, jsdom) |
| **Config file** | vite.config.ts (app suite excludes `src/rules.test.ts`) |
| **Quick run command** | `npx vitest run --dir src --exclude '**/rules.test.ts' <changed test files>` |
| **Full suite command** | `npx vitest run --dir src --exclude '**/rules.test.ts'` |
| **Type gate** | `npm run type-check` (vue-tsc --build — typechecks tests too; the authoritative gate per CLAUDE.md) |
| **Estimated runtime** | ~70s full suite |

---

## Sampling Rate

- **After every task commit:** Run the quick run command over the task's touched test files.
- **After every plan wave:** Run the full suite command.
- **Before `/gsd-verify-work`:** Full suite must be at the documented 2-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) with no new failing file, and `npm run type-check` at 0.
- **Max feedback latency:** ~70 seconds (full suite).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner fills per plan/task)_ | | | R086 / R087 | — | | unit | `npx vitest run --dir src ...` | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure (vitest + vue-tsc) covers all phase requirements — no framework install needed.
- NOTE (from RESEARCH): `src/stores/__tests__/services.test.ts`'s existing `createService` tests hard-assert the old unconditional `buildSlots('1-2-2-3')` 9-slot behavior with no authStore mock — they must be **rewritten** to the new empty-by-default contract, not merely patched.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hands-on feel of the Settings template editor (add/reorder/section/remove/reset), and that a new blank service is built from the template | R086 / R087 | Real drag-and-drop + browser reload can't be fully asserted in jsdom | Owner check — recorded to PENDING-VERIFICATION.md § Phase 44 at verify time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 70s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
