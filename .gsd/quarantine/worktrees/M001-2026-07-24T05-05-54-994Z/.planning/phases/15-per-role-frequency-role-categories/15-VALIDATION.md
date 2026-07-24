---
phase: 15
slug: per-role-frequency-role-categories
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-08
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run src/utils/__tests__/scheduler.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Type gate** | `npm run type-check` (vue-tsc --build — critical for the RoleGroup exhaustive-Record pitfall) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run the touched test file (see per-task command below)
- **After every plan wave:** Run `npx vitest run` + `npm run type-check`
- **Before `/gsd:verify-work`:** Full suite + type-check must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | D-04, D-05, D-08, D-09 | T-15-01-01 | Additive optional fields; legacy docs never throw | unit | `npx vitest run src/utils/__tests__/scheduler.test.ts src/stores/__tests__/roster.test.ts` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | D-08, D-09 | T-15-01-02 | Type change + all exhaustive maps land atomically (build green) | type | `npm run type-check` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | D-10, D-11, D-12, D-05, D-07 | T-15-02-01 | Failing tests for both assignment paths incl. propagatePairing landmine | unit (RED) | `npx vitest run src/utils/__tests__/scheduler.test.ts` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | D-10, D-11, D-12, D-05 | T-15-02-01, T-15-02-02 | Shared group helper in eligible() AND propagatePairing(); per-role deficit | unit (GREEN) | `npx vitest run src/utils/__tests__/scheduler.test.ts` | ✅ | ⬜ pending |
| 15-03-01 | 03 | 2 | D-03, D-09 | T-15-03-01, T-15-03-02 | Guarded idempotent per-doc migration; no sibling clobber | unit | `npx vitest run src/stores/__tests__/roster.test.ts` | ✅ | ⬜ pending |
| 15-03-02 | 03 | 2 | D-02, D-04, D-07 | T-15-03-03 | roleFrequencies persist + CSV graceful degrade; validated N | unit | `npx vitest run src/stores/__tests__/roster.test.ts src/utils/__tests__/volunteerCsv.test.ts` | ✅ | ⬜ pending |
| 15-04-01 | 04 | 3 | D-12 | T-15-04-02, T-15-04-03 | roleGroupOf wired; end-to-end TECH exclusivity in proposal | unit | `npx vitest run src/stores/__tests__/quarters.test.ts` | ✅ | ⬜ pending |
| 15-04-02 | 04 | 3 | D-05 | T-15-04-01 | roleTiers scoped `personQuarterData.<id>` write; no sibling clobber | unit | `npx vitest run src/stores/__tests__/quarters.test.ts` | ✅ | ⬜ pending |
| 15-05-01 | 05 | 3 | D-01, D-02 | T-15-05-01, T-15-05-02 | One cadence control per held role; N=4 default; tuning preserved | component | `npx vitest run src/views/__tests__/RosterView.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 15-05-02 | 05 | 3 | D-01 | T-15-05-01 | Deterministic per-role frequency sort | component | `npx vitest run src/views/__tests__/RosterView.test.ts` | ❌ W0 (new file) | ⬜ pending |
| 15-05-03 | 05 | 3 | D-01, D-02 | — | Human-verify: per-role cadence renders/persists | manual | human-check (see Manual-Only) | N/A | ⬜ pending |
| 15-06-01 | 06 | 4 | D-05, D-06 | T-15-06-01 | One tier control per held role; roleTiers persisted | component | `npx vitest run src/components/__tests__/AvailabilityDrawer.test.ts` | ✅ | ⬜ pending |
| 15-06-02 | 06 | 4 | D-11 | T-15-06-02 | Live group-conflict warning reuses evaluateGroupCombo; non-blocking | component | `npx vitest run src/components/__tests__/QuarterGrid.test.ts` | ✅ | ⬜ pending |
| 15-06-03 | 06 | 4 | D-06, D-11 | — | Human-verify: drawer tiers + grid warning behavior | manual | human-check (see Manual-Only) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/views/__tests__/RosterView.test.ts` — does NOT exist; created in plan 15-05 (task 1) to cover D-01/D-02 per-role frequency form rendering. Mirror the mount+pinia harness in `src/components/__tests__/AvailabilityDrawer.test.ts`.
- [ ] New `scheduler.test.ts` cases for D-10/D-12 group exclusivity + cardinality covering BOTH the main `eligible()` loop AND the `propagatePairing` path (plan 15-02 task 1 — the confirmed Pitfall-2 landmine).
- [ ] CSV compatibility: covered by extending existing `src/utils/__tests__/volunteerCsv.test.ts` (parser-unchanged assertion) + `src/stores/__tests__/roster.test.ts` (graceful-degrade synthesis) in plan 15-03; no dedicated VolunteerCsvImportModal test file needed.
- [ ] Framework install: none — Vitest/@vue/test-utils already fully configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Plan | Why Manual | Test Instructions |
|----------|-------------|------|------------|-------------------|
| Per-role frequency controls render one row per held role in Edit Volunteer form | D-01 | 15-05 | Vue component visual/interaction | Open Edit Volunteer form for a 2+-role person; check a role; confirm a cadence dropdown appears and prior tuning is preserved |
| Availability drawer shows one tier control per held role | D-06 | 15-06 | Vue component visual/interaction | Open availability drawer; confirm per-role tier controls; set Tech 'Out' + Band 'Monthly'; save/reopen; confirm independent persistence |
| Manual-grid co-occurrence warning surfaces on illegal combo without blocking | D-11 | 15-06 | Vue component visual/interaction | Manually assign a person to TECH + BAND same service; confirm visible "Group conflict" badge AND the assignment is not removed; confirm 1 BAND + 1 VOCALS shows no warning |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (manual tasks are human-verify checkpoints paired with component tests)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (RosterView.test.ts + new scheduler cases)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-populated; ready for execution
