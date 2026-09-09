---
phase: 139
slug: rehearsal-report-times
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-09
---

# Phase 139 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom) |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npx vitest run` (baseline = 1 known-failing file: `storage.rules.test.ts`) |
| **Estimated runtime** | ~30–60 seconds |

Type-check gate: `npm run type-check` (vue-tsc --build), NOT `-p tsconfig.app.json`.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <changed file>`
- **After every plan wave:** `npx vitest run` (expect only the `storage.rules.test.ts` baseline failure)
- **Before verify:** full suite green except the documented baseline
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| _seeded by planner_ | — | — | R429–R433 | unit | `npx vitest run` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/rehearsalTimes.ts` unit test: `sortRehearsals` orders by date then time regardless of input
  order; the 12-hour wall-clock formatter renders the literal entered time (no zone shift) — R430/R433.
- [ ] Copy-not-live-bind test (services store): creating a service copies `rehearsalTimeDefaults`/
  `reportTimeDefault` from OrgSettings; a subsequent org-default change does NOT mutate the already-created
  service's stored times — R429/R432.
- [ ] Projection test (mirror `services.sharePii.test.ts`): the new `rehearsals`/`reportTime` fields appear in
  BOTH `buildServiceSnapshot` (services.ts) and `buildRehearseAccess` (rehearseAccess.ts) — R433 (Pitfall 8).

*Final list finalized by the planner's per-task verify maps.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Times render correctly on dashboard / My Schedule / volunteer view / share page | R433 | Visual/layout judgement across 5 surfaces | Deferred to batched UAT: create a service with 2 rehearsals + a report time, confirm all read-only surfaces show them alongside the date, correctly formatted, chronological |
| Org-defaults settings UX | R429 | Visual/interaction | Deferred to batched UAT: set defaults in Settings, create a new service, confirm rehearsal rows + report time pre-fill |

*Automated unit coverage exists for the data model, sort util, copy-not-bind, and both projections.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
