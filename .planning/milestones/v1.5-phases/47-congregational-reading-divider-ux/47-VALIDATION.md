---
phase: 47
slug: congregational-reading-divider-ux
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 47 — Validation Strategy

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
> Validation Architecture section (§ line 632) and the generated PLAN.md task list.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | R095 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Boundary-indexed divider model test stubs (gap-click insert/remove → CongregationalSection[])
- [ ] Three-seed tests (AI / Alternate / splitPerVerse-Blank all produce the same shape)
- [ ] ALL-role render tests (editor chip, presenter 3-way label/colour, grid label)
- [ ] R097 first-slide-reference vs later-slide-speaker-label tests

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Divider editing feels right on a real reading | R095 | Interaction feel (gap targeting, chip tapping) is a human judgment | Hand-divide Psalm 136 (refrain) and Psalm 24 (call/response); confirm placing/removing dividers and 3-way labeling is low-friction |
| Projected 3-role legibility | R097 | Distinguishing Leader/Congregation/All at projection distance is a visual judgment | Present a hand-divided reading; confirm the first slide shows the reference, later slides show only the speaker label, and all three roles read distinctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
