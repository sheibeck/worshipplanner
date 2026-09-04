---
phase: 114
slug: multi-monitor-assignment-rework
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-02
---

# Phase 114 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom) |
| **Config file** | vite.config.ts (root) |
| **Quick run command** | `npx vitest run src/utils/__tests__/monitorConfig.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant scoped `npx vitest run <file>`
- **After every plan wave:** Run `npx vitest run` (bare — the documented 1-file baseline: only `storage.rules.test.ts` fails)
- **Before `/gsd-verify-work`:** Full suite must be at the documented baseline; `npm run type-check` clean
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

*Seeded by plan-phase; the per-task map is completed by `/gsd-validate-phase` after PLAN.md tasks exist.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | R324–R328, R338 | — | N/A | unit | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing vitest infrastructure covers the pure-model and composable requirements
(`monitorConfig.test.ts`, `useOutputWindow.test.ts`, `MonitorSetupView.test.ts` all exist).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Output windows land on their assigned physical displays; roles stick on a real 3-monitor setup | R326, R327 | Real multi-display Chrome/macOS hardware (Window Management API + `requestFullscreen({screen})`) cannot be exercised in jsdom | Owner runs on the church Mac + projector (3 monitors): assign roles incl. 2 Audience, save, reopen (no false reprompt), Go-live, confirm each window fullscreens on its assigned screen |

*Automated tests cover fingerprint stability, delta-match, repeated-role assignment, nickname round-trip, and per-assignment window-open wiring (mocked); the cross-screen fullscreen placement is the batched-UAT item.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
