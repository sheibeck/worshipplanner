---
phase: 17
slug: sync-schedule-with-planned-services-add-a-roles-tab-to-servi
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-22
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 17-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 (unit/component) + `@firebase/rules-unit-testing` (Firestore rules) |
| **Config file** | `vitest.config.ts` (unit/component), `vitest.rules.config.ts` (rules, via `firebase emulators:exec`) |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npm run test:unit` (unit/component) + `npm run test:rules` (rules against local emulator) |
| **Estimated runtime** | ~30–90 seconds (unit) + emulator startup for rules |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file>`
- **After every plan wave:** Run `npm run test:unit`
- **Before `/gsd-verify-work`:** `npm run test:unit` AND `npm run test:rules` both green
- **Max feedback latency:** ~90 seconds (unit); rules run at wave/phase gates

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01 resolver | 01 | 1 | CR-02 | — | resolve scheduled people for a date from the matching quarter; empty result when no quarter covers date | unit | `npx vitest run src/utils/__tests__/serviceRoles.test.ts` | ❌ W0 (new util+test) | ⬜ pending |
| 17-01 effective | 01 | 1 | CR-03 | — | effective = override when present, else schedule; never mutates Quarter | unit | `npx vitest run src/utils/__tests__/serviceRoles.test.ts` | ❌ W0 | ⬜ pending |
| 17-03 scoped-write | 03 | 2 | CR-03 | T-17-03-04 | `setRoleOverride` writes ONLY `roleAssignmentOverrides.${roleId}` dot-path (no whole-map clobber); clear uses `deleteField()` | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ❌ new cases | ⬜ pending |
| 17-03 snapshot | 03 | 2 | CR-04 | T-17-03-01 | `createShareToken` snapshot includes names-only `roleAssignments` (no email/phone/pcPersonId) | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ❌ new cases | ⬜ pending |
| 17-02 rules | 02 | 1 | CR-04, CR-05 | T-17-02-01/02 | `serviceShares/{id}` public read; create/update requires `isOrgEditor(orgId)`; cross-org overwrite denied | rules | `npm run test:rules` | ❌ new `describe('serviceShares')` | ⬜ pending |
| 17-02 regression | 02 | 1 | CR-05 | — | non-editor cannot read org roles/quarters/people (regression guard) | rules | `npm run test:rules` | ✅ likely existing catch-all | ⬜ pending |
| 17-04 roles-tab | 04 | 3 | CR-01, CR-05 | — | Roles tab renders role list; override control + data gated behind `authStore.isEditor` | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ❌ new cases | ⬜ pending |
| 17-05 public-read | 05 | 3 | CR-04, CR-05 | T-17-05-01 | ShareView dual-path read exposes only names-only snapshot; imports no roster/auth/quarters store | component | `npx vitest run src/views/__tests__/ShareView.test.ts` | ❌ new cases | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/serviceRoles.ts` + `src/utils/__tests__/serviceRoles.test.ts` — new pure-function module and its TDD suite (`findQuarterForDate`, `resolveServiceRoleAssignments`)
- [ ] Extend `src/rules.test.ts` with a `describe('serviceShares')` block mirroring the existing `quarterShares` coverage pattern
- [ ] Framework install: none — Vitest, `@firebase/rules-unit-testing`, and the Firestore emulator are already configured (`npm run test:rules`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Public share link renders "Who's Serving" to an unauthenticated visitor | CR-04 | Requires a live Firestore deploy of the new `serviceShares` public-read rule | Deploy rules, open `/{slug}/service-{date}` in a logged-out browser, confirm role→names render and no editor controls appear |
| Firestore rules live-deploy checkpoint | CR-04, CR-05 | Emulator tests pass locally; production rules must be deployed and confirmed | 17-02 blocking checkpoint: `firebase deploy --only firestore:rules`, then verify public read works and cross-org write is denied |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (serviceRoles util + serviceShares rules test)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s (unit)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
