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
| 79-01/T1 | 79-01 | 1 | R228, R241 | T-79-01 | teams read/write gated by `isOrgEditor` wildcard (no new rule) | unit | `npx vitest run src/stores/__tests__/teams.test.ts` | ❌ created by this task | ⬜ pending |
| 79-01/T2 | 79-01 | 1 | R241 | T-79-01 | church-switch teardown (no stale-team flash) | static | `grep -c "useTeamsStore" src/stores/orgScopedStores.ts` (≥1) | ✅ existing | ⬜ pending |
| 79-02/T1 | 79-02 | 2 | R228, R230 | T-79-02 | `songFilterTag` constrained to a `<select>` over org song tags | component | `npx vitest run src/components/__tests__/TeamsConfigPanel.test.ts` | ❌ created by this task | ⬜ pending |
| 79-02/T2 | 79-02 | 2 | R228 | T-79-01 | teams subscribe on the editor-only Roster surface | integration | `npx vitest run` (baseline unchanged) + `npm run type-check` | ✅ existing (RosterView) | ⬜ pending |
| 79-03/T1 | 79-03 | 2 | R229, R231, R241 | — | client-only form default (`teams=[]`) | component | `npx vitest run src/components/__tests__/NewServiceDialog.test.ts` | ✅ existing (rewritten) | ⬜ pending |
| 79-03/T2 | 79-03 | 2 | R229, R241 | T-79-01 | teams read placed inside the editor-only guard | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ existing (teams mock added) | ⬜ pending |
| 79-03/T3 | 79-03 | 2 | R230, R241 | T-79-02 | union-of-tags client-side narrowing before AI proxy | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts -t "song-tag filter"` + dedup grep (`isOrchestraService`=0) | ✅ existing (new describe) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. Every R228–R231 + R241 maps to at least one automated test: R228→79-01/T1,79-02/T1; R229→79-03/T1,T2; R230→79-02/T1,79-03/T3; R231→79-03/T1; R241→79-01/T1,79-03/T3 (+ dedup grep).*

---

## Wave 0 Requirements

- [ ] `src/stores/__tests__/teams.test.ts` — teams store seed (`seedDefaultTeamsIfEmpty` idempotent, never clobbers existing) + CRUD (R228) — **owned by 79-01/T1**
- [ ] Test for the generic per-team song-tag union filter helper (R230) — **owned by 79-03/T3** (new "song-tag filter" describe in `ServiceEditorView.test.ts`)
- [ ] `NewServiceDialog.test.ts` — add Pinia/teams-store mock (currently deliberately Pinia-free — RESEARCH Pitfall 2) and rewrite the "Task 3 — team side effect" block to assert empty-default, not ordinal auto-select (R231) — **owned by 79-03/T1**
- [ ] `ServiceEditorView.test.ts` — add `@/stores/teams` mock so the org-driven checkboxes resolve (R229; RESEARCH Pitfall 6) — **owned by 79-03/T2**
- [ ] `src/components/__tests__/TeamsConfigPanel.test.ts` — editor UX (draft/save, soft-warn delete-confirm, add-row, aria-labels, song-tag select) (R228) — **owned by 79-02/T1**

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
