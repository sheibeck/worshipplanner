---
phase: 48
slug: multi-image-ordering-mobile-polish
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (app suite) |
| **Quick run command** | `npx vitest run <touched-test-file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60–120 seconds (full app suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched-test-file>`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite green at the documented 2-file baseline
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

> Seeded by plan-phase — the planner/validate-phase fills concrete task rows from the RESEARCH.md
> Validation Architecture section (§ line 604) and the generated PLAN.md task list.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01-01 | 01 | 1 | R098 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `classifyFiles` collation test (slide2 < slide10, numeric not lexicographic) — R098
- [ ] serviceEditorActionBar key tests (Print/Share present in top bar; Delete NOT in top bar) — R101
- [ ] Undo-as-link test (link off primary-action row; Ctrl+Z + snapshot gating preserved) — R102
- [ ] GettingStarted dismiss persistence test (localStorage key; independent of allDone) — R103
- [ ] Extend SlideGrid touch-option test if a mock harness exists (else manual) — R099

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real touch drag-reorder on a phone | R099 | jsdom cannot simulate a real touch gesture sequence | On a real touch device, long-press + drag a slide card; confirm it reorders correctly (no index bug) |
| Slides tab + service edit screen usable at ~375px | R099/R100 | Real viewport/layout judgment | Load both screens at phone width; confirm no horizontal overflow, rail stacks, buttons stack, 44px tap targets reachable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
