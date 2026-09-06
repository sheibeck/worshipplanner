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
| TBD | — | 0 | R378/R379 | rules | `npm run test:rules` (constrained collectionGroup list ALLOW; unfiltered list DENY) | ⬜ pending |
| TBD | — | — | R378–R383 | unit | `npx vitest run` (buildRehearseAccess rolesByEmailLower; grouping/countdown/readiness pure fns) | ⬜ pending |

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
