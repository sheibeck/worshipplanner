---
phase: 126
slug: my-schedule-volunteer-home
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-06
---

# Phase 126 — Validation Strategy

> Per-phase validation contract. Seeded by plan-phase from 126-RESEARCH.md's Validation Architecture;
> the planner fills the Per-Task Verification Map from the PLANs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (app + rules) |
| **Config file** | `vite.config.ts` (app), `vitest.rules.config.ts` (rules) |
| **Quick run command** | `npx vitest run <file>` |
| **Full suite command** | `npx vitest run` + `npm run test:rules` + `npm run type-check` |
| **Estimated runtime** | ~60–120s app + rules-emulator startup |

---

## Sampling Rate
- After every task commit: `npm run type-check` + touched test file(s)
- After every wave: `npx vitest run`; for the rules `list` arm, `npm run test:rules`
- Before verify: full suite green (baseline exception: `storage.rules.test.ts`)

---

## Per-Task Verification Map

*Planner fills from the PLANs. The constrained-`list` rules test (the KEY RISK) MUST appear as a `test:rules` row.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 01-T1 | 126-01 | 1 | R378/R379 | rules | `npx vitest run --config vitest.rules.config.ts -t "R377"` (existing get arm unbroken after get/list split + index add) | ⬜ pending |
| 01-T2 | 126-01 | 1 | R378/R379 | rules | `npm run test:rules` (constrained collectionGroup list ALLOW cross-org; empty-for-unassigned; DENY unfiltered/other-email/unverified; Draft excluded) — **KEY RISK** | ⬜ pending |
| 01-T3 | 126-01 | 1 | R381 | unit | `npx vitest run src/utils/rehearseAccess.test.ts` (rolesByEmailLower: multi-role, empty-email skip, lowercase key) | ⬜ pending |
| 02-T1 | 126-02 | 1 | R380/R381 | unit | `npx vitest run src/utils/myScheduleGrouping.test.ts` (grouping buckets/nextUpId; countdown boundaries at exactly 7/14 days; readiness three-state) | ⬜ pending |
| 02-T2 | 126-02 | 1 | R381 | unit | `npx vitest run src/utils/roleChipIcon.test.ts` (keyword branches + music fallback → valid StageKindIcon glyphs) | ⬜ pending |
| 03-T1 | 126-03 | 2 | R378 | unit | `npx vitest run src/stores/__tests__/mySchedule.test.ts` (lowercased-email filter; empty-email no-query; error path) | ⬜ pending |
| 03-T2 | 126-03 | 2 | R382 | unit + build | `npx vitest run src/router/__tests__/router.test.ts` (placeholder route resolves) + `npm run build` | ⬜ pending |
| 04-T1 | 126-04 | 3 | R381 | type | `npm run type-check` (ScheduleServiceCard.vue) | ⬜ pending |
| 04-T2 | 126-04 | 3 | R378/R380/R382 | type + build | `npm run type-check` + `npm run build` (MyScheduleView + /my-schedule route + landing) | ⬜ pending |
| 04-T3 | 126-04 | 3 | R378/R383 | unit (component + router) | `npx vitest run src/views/__tests__/MyScheduleView.test.ts src/router/__tests__/router.test.ts` (empty/populated/loading/error + Rehearse target + /my-schedule resolves) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements
- [ ] **Constrained-list rules test** (NON-NEGOTIABLE): prove a magic-link volunteer can `list`
      `collectionGroup('rehearseAccess')` filtered `where('assignedEmailsLower','array-contains', myEmailLower)`
      (ALLOW), and that an unfiltered/other-email list is DENIED — the current suite only tests `get` by id.
- [ ] `firestore.indexes.json` composite index (`assignedEmailsLower` array-contains + `serviceDate` orderBy,
      `queryScope: COLLECTION_GROUP`).
- [ ] Unit stubs for the extended `buildRehearseAccess` (`rolesByEmailLower`) + grouping/countdown/readiness helpers.

*Frameworks all present; Wave 0 items are authored within the phase's plans.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| My Schedule renders a real volunteer's actual assigned services after a live magic-link sign-in | R378–R382 | Needs live sign-in + real locked services + real assignments | Sign in as a rostered volunteer; confirm only their Planned assigned services appear, grouped, with correct roles/readiness/countdown, and Rehearse → navigates |

---

## Validation Sign-Off
- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] The constrained-`list` rules ALLOW/DENY test exists and is green
- [ ] `nyquist_compliant: true` set

**Approval:** pending
