---
phase: 79
slug: dedup-configurable-teams
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-23
---

# Phase 79 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.x (jsdom) |
| **Config file** | `vite.config.ts` (excludes `src/rules.test.ts`, `render-service/**`) |
| **Quick run command** | `npx vitest run <changed test files>` |
| **Full suite command** | `npx vitest run` (2-file known-failing baseline: `storage.rules.test.ts`, `RosterView.test.ts`) |
| **Type gate** | `npm run type-check` (`vue-tsc --build` — checks tests too) |
| **Estimated runtime** | ~60–120 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the changed test files + `npm run type-check`
- **After every plan wave:** Run `npx vitest run` (expect the 2-file baseline, nothing new failing)
- **Before `/gsd-verify-work`:** Full suite green at baseline + type-check clean
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner fills per-task rows_ | | | R228–R231, R241 | — | N/A (no threat model this phase) | unit | `npx vitest run …` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. The planner MUST map each of R228–R231 + R241 to at least one automated unit test.*

---

## Wave 0 Requirements

- [ ] `src/stores/__tests__/teams.test.ts` — teams store seed (`seedDefaultTeamsIfEmpty` idempotent, never clobbers existing) + CRUD (R228)
- [ ] Test for the generic per-team song-tag union filter helper (R230)
- [ ] `NewServiceDialog.test.ts` — add Pinia/teams-store mock (currently deliberately Pinia-free — RESEARCH Pitfall 2) and rewrite the "Task 3 — team side effect" block to assert empty-default, not ordinal auto-select (R231)
- [ ] `ServiceEditorView.test.ts` — add `@/stores/teams` mock so the org-driven checkboxes resolve (R229; RESEARCH note)

*Existing vitest infrastructure otherwise covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Teams editor visual parity with Roles panel; add/rename/delete round-trip in the live app | R228 | Visual/interaction fidelity | Open Volunteers → Teams; add/rename/delete a team; confirm it drives the service-plan checkboxes |
| A church configuring different teams sees a different service-plan checkbox list | R229 | Cross-tenant behavior needs two real orgs | Two orgs, two team lists, confirm isolation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
