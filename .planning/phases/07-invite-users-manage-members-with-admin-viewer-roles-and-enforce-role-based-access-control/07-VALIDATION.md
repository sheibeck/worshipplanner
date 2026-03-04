---
phase: 7
slug: invite-users-manage-members-with-admin-viewer-roles-and-enforce-role-based-access-control
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `vite.config.ts` (unit), `vitest.rules.config.ts` (emulator rules) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npm run test:rules` |
| **Estimated runtime** | ~15 seconds (unit), ~30 seconds (with emulator rules) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npm run test:rules`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | RBAC-04 | unit | `npx vitest run src/stores/__tests__/auth.test.ts` | ✅ extend | ⬜ pending |
| 07-01-02 | 01 | 1 | AUTH-04 | unit | `npx vitest run src/stores/__tests__/auth.test.ts` | ✅ extend | ⬜ pending |
| 07-02-01 | 02 | 1 | RBAC-02 | emulator | `npm run test:rules` | ✅ extend | ⬜ pending |
| 07-02-02 | 02 | 1 | RBAC-03 | emulator | `npm run test:rules` | ✅ extend | ⬜ pending |
| 07-03-01 | 03 | 2 | AUTH-03 | unit | `npx vitest run src/views/__tests__/TeamView.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | RBAC-05 | unit | `npx vitest run src/views/__tests__/TeamView.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-03 | 03 | 2 | RBAC-06 | unit | `npx vitest run src/views/__tests__/TeamView.test.ts` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | RBAC-01 | unit | `npx vitest run src/router/__tests__/router.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/views/__tests__/TeamView.test.ts` — stubs for AUTH-03, RBAC-05, RBAC-06 invite logic
- [ ] `src/rules.test.ts` — extend with viewer read/write scenarios for new role model
- [ ] `src/router/__tests__/router.test.ts` — extend with `requiresEditor` guard tests
- [ ] `src/stores/__tests__/auth.test.ts` — extend with orgId/userRole/isEditor initialization tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Viewer sidebar shows only Services link | RBAC-01 | Visual UI verification | Sign in as viewer, verify only Services nav link visible |
| Org name displays in sidebar | UX | Visual branding check | Sign in as any role, verify org name at top of sidebar |
| Pending invite shows in member table | AUTH-03 | Visual UI verification | Create invite, verify "Pending" badge in table |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
