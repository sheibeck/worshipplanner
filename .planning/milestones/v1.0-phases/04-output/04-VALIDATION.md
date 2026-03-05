---
phase: 4
slug: output
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured in `vite.config.ts`, test environment: jsdom) |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | OUT-01 | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | Wave 0 | ⬜ pending |
| 04-01-02 | 01 | 1 | OUT-01 | unit | `npx vitest run src/components/__tests__/ServicePrintLayout.test.ts` | Wave 0 | ⬜ pending |
| 04-02-01 | 02 | 1 | OUT-02 | unit | `npx vitest run src/stores/__tests__/services.test.ts` | Extend existing | ⬜ pending |
| 04-02-02 | 02 | 1 | OUT-02 | unit | `npx vitest run src/views/__tests__/ShareView.test.ts` | Wave 0 | ⬜ pending |
| 04-02-03 | 02 | 1 | OUT-02 | unit | `npx vitest run src/router/__tests__/router.test.ts` | Extend existing | ⬜ pending |
| 04-03-01 | 03 | 1 | OUT-03 | unit | `npx vitest run src/utils/__tests__/planningCenterExport.test.ts` | Wave 0 | ⬜ pending |
| 04-03-02 | 03 | 1 | OUT-03 | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/planningCenterExport.test.ts` — stubs for OUT-03 text formatter
- [ ] `src/components/__tests__/ServicePrintLayout.test.ts` — stubs for OUT-01 print layout rendering
- [ ] `src/views/__tests__/ShareView.test.ts` — stubs for OUT-02 share view rendering
- [ ] `src/views/__tests__/ServiceEditorView.test.ts` — stubs for OUT-01 print trigger, OUT-02 share button, OUT-03 copy button

*Existing infrastructure covers framework install — Vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Print layout renders correctly on paper (no cut-off, correct page breaks) | OUT-01 | CSS `@media print` rendering requires real browser print preview | Open service, click Print, verify in browser print preview dialog |
| Share link renders on mobile phone | OUT-02 | Mobile viewport rendering requires real device/emulator | Open share URL on phone, verify full plan readable without login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
