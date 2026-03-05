---
phase: 8
slug: planning-center-api-export-for-published-service-plans
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 8 — Validation Strategy

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
| TBD | TBD | TBD | SC-1: Export button replaces Copy for PC | unit + integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-2: Creates PC plan with sermon scripture title | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-3: Songs/hymns as Song items | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-4: Scriptures as Items with text | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-5: Success/failure feedback | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SC-6: PC credentials in settings | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — stubs for PC API client (create plan, add items, validate credentials)
- [ ] `src/views/__tests__/SettingsView.test.ts` — stubs for PC credentials UI
- [ ] Live API connectivity test — verify CORS behavior with real PC credentials (determines proxy architecture)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CORS behavior in production | Architecture | Cannot test CORS headers without deploying or real browser request to PC API | 1. Deploy to staging 2. Open browser devtools 3. Trigger export 4. Check for CORS errors |
| PC plan appears correctly | SC-2, SC-3, SC-4 | Must verify in actual Planning Center UI | 1. Export a service 2. Open PC 3. Verify plan title, songs, items |
| Credential masking | SC-6 | Visual verification | 1. Save credentials 2. Verify dots shown 3. Verify can't read back |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
