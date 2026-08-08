---
phase: 46
slug: global-slide-typography
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 46 — Validation Strategy

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
- **Before `/gsd-verify-work`:** Full suite must be green (at the documented 2-file baseline)
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

> Seeded by plan-phase — the planner/validate-phase fills concrete task rows from the RESEARCH.md
> Validation Architecture section (§ line 427) and the generated PLAN.md task list.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 46-01-01 | 01 | 1 | R093 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Font registry test stubs for R093 (weight-snapping, family membership)
- [ ] `document.fonts` jsdom stub extension (reuse `PresentationViewer.test.ts`'s existing
      `Object.defineProperty(document, ...)` pattern per RESEARCH.md) for the R094 font-load gate

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No fallback-font flash mid-service | R094 | jsdom cannot render real fonts or measure a real paint; the flash is a projector-visible timing effect | On a real projector, present a service and confirm the chosen font is resident on the first slide — no visible swap from a fallback |
| Projection legibility of the chosen family/weight/size | R093 | Legibility at projection distance is a human visual judgment | Present with each curated family at each size on a real projector; confirm readability |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
