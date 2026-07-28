---
phase: 8
slug: planning-center-api-export-for-published-service-plans
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-04
---

# Phase 8 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-T1 | 08-01 | 1 | SC-2, SC-3, SC-4: PC API client (plan title, items, slot mapping) | unit (TDD) | `npx vitest run src/utils/__tests__/planningCenterApi.test.ts` | Created in task | pending |
| 08-01-T2 | 08-01 | 1 | SC-6: Service type extension + proxy | regression | `npx vitest run` | Existing | pending |
| 08-02-T1 | 08-02 | 1 | SC-6: Auth store PC credential state | regression | `npx vitest run` | Existing | pending |
| 08-02-T2 | 08-02 | 1 | SC-6: Settings UI for PC credentials | regression | `npx vitest run` | Existing | pending |
| 08-03-T1 | 08-03 | 2 | SC-1, SC-2, SC-3, SC-4, SC-5: Export flow wiring | regression | `npx vitest run` | Existing | pending |
| 08-03-T2 | 08-03 | 2 | SC-1 through SC-6: End-to-end human verify | manual | Human verification | n/a | pending |

*Status: pending -- green -- red -- flaky*

---

## Wave 0 Requirements

- [x] `src/utils/__tests__/planningCenterApi.test.ts` -- created as part of 08-01-T1 (TDD task writes tests first)
- [x] Existing test infrastructure covers all other phase requirements (regression tests)
- [x] No separate Wave 0 plan needed -- TDD task in 08-01 creates test file before implementation

*Existing infrastructure covers all phase requirements beyond the new test file created in 08-01-T1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CORS behavior in production | Architecture | Cannot test CORS headers without deploying or real browser request to PC API | 1. Deploy to staging 2. Open browser devtools 3. Trigger export 4. Check for CORS errors |
| PC plan appears correctly | SC-2, SC-3, SC-4 | Must verify in actual Planning Center UI | 1. Export a service 2. Open PC 3. Verify plan title, songs, items, MESSAGE description |
| Credential masking | SC-6 | Visual verification | 1. Save credentials 2. Verify dots shown 3. Verify can't read back |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
