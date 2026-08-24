---
phase: 83
slug: roles-teams-tab-ux-copy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-24
---

# Phase 83 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Small client-only UI-polish phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **App framework** | vitest 4.0.x (jsdom) — `npx vitest run` |
| **Type gate** | `npm run type-check` (`vue-tsc --build`) |
| **Baseline** | app suite 2-file known-failing baseline (`storage.rules.test.ts`, `RosterView.test.ts` — the latter is pre-existing; do NOT attribute to this phase) |

---

## Sampling Rate

- **After every task commit:** changed test files + `npm run type-check`.
- **Before `/gsd-verify-work`:** `npx vitest run` at baseline, type-check clean.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| _planner fills rows_ | | | R244, R245, R246 | component | `npx vitest run …` | ⬜ pending |

*Coverage the planner must map: R244 → the two `activeTab==='roles'|'teams'` wrapper divs in `RosterView.vue` gain `max-w-4xl` (Volunteers table stays full-width); R245 → the Delete `<button>` in BOTH RolesConfigPanel.vue + TeamsConfigPanel.vue gets the destructive-button class (mirror SettingsView "Clear Credentials" `bg-red-900/20 text-red-400`); inline soft-warn confirm unchanged; R246 → the `RolesConfigPanel.vue:6` copy is corrected to describe the scheduler's real auto-fill behavior (the count is the number auto-filled per service, up to N; manual entry can exceed). A NEW `RolesConfigPanel.test.ts` is created (none exists today); TeamsConfigPanel.test.ts survives the class-only change.*

---

## Wave 0 Requirements

- [ ] Create `src/components/__tests__/RolesConfigPanel.test.ts` (none exists) — asserts the Delete button, the corrected copy, and the panel's basic add/save/delete flow.
- [ ] Extend/confirm `TeamsConfigPanel.test.ts` survives the Delete-button class swap.
- [ ] `RosterView` width wrapper — assert (or at least type-check) the roles/teams tab wrappers are constrained without touching the Volunteers tab.

*Existing vitest infrastructure covers all phase requirements; the only new file is `RolesConfigPanel.test.ts`, scaffolded inside its owning task.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Roles/Teams tabs visually constrained; inputs no longer full-width | R244 | Visual layout | Open Volunteers → Roles and → Teams; confirm the panels are max-w-4xl-constrained and the Volunteers table is still full-width |
| Delete reads as a real destructive button | R245 | Visual | Confirm the Delete affordance looks like the "Clear Credentials" button, not a text link |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
