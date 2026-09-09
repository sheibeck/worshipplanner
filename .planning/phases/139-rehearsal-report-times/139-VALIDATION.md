---
phase: 139
slug: rehearsal-report-times
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-09
validated: 2026-09-09
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
| 139-01 T1 (D1) | 01 | 0 | R430 | unit | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts` | ✅ green |
| 139-01 T2 (D2/D3) | 01 | 0 | R429/R432 | unit | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts` | ✅ green |
| 139-01 T3 (D4) | 01 | 0 | R433 | unit | `npx vitest run src/stores/__tests__/services.rehearsalProjection.test.ts` | ✅ green |
| 139-02 T1 (CR-02 editor gate) | 02 | 2 | R430/R431 | component | `npx vitest run src/views/__tests__/ServiceEditorView.timesSection.test.ts` | ✅ green |
| 139-02 T2/T3 (display sites) | 02 | 2 | R433 | component | `ScheduleServiceCard.test.ts`, `SettingsView.test.ts` (extended) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Re-run confirmed 2026-09-09: all 4 Wave-0 test files (`rehearsalTimes.test.ts`, `services.rehearsalDefaults.test.ts`,
`services.rehearsalProjection.test.ts`, `ServiceEditorView.timesSection.test.ts`) pass — 28/28 tests green via
`npx vitest run <files>`. `npm run type-check` clean per both SUMMARYs. Full suite baseline unchanged
(`storage.rules.test.ts` only, documented pre-existing failure).

---

## Wave 0 Requirements

- [x] `src/utils/rehearsalTimes.ts` unit test: `sortRehearsals` orders by date then time regardless of input
  order; the 12-hour wall-clock formatter renders the literal entered time (no zone shift) — R430/R433.
  Filled by `src/utils/__tests__/rehearsalTimes.test.ts` (12 tests, incl. timezone-stability across
  UTC/+14/-12 and the CR-01 "Invalid Date" empty-input guard).
- [x] Copy-not-live-bind test (services store): creating a service copies `rehearsalTimeDefaults`/
  `reportTimeDefault` from OrgSettings; a subsequent org-default change does NOT mutate the already-created
  service's stored times — R429/R432.
  Filled by `src/stores/__tests__/services.rehearsalDefaults.test.ts` (4 tests: copy, copy-not-bind,
  fresh-copy-inverse, empty-defaults).
- [x] Projection test (mirror `services.sharePii.test.ts`): the new `rehearsals`/`reportTime` fields appear in
  BOTH `buildServiceSnapshot` (services.ts) and `buildRehearseAccess` (rehearseAccess.ts) — R433 (Pitfall 8).
  Filled by `src/stores/__tests__/services.rehearsalProjection.test.ts` (7 tests: value surfaces, undated
  filter, dated-but-timeless filter (CR-01), sort order, omission-not-empty-array for both empty and
  all-filtered inputs).

Additional coverage beyond the originally-seeded Wave-0 list, closing a plan-review finding (CR-02/WR-01 in
139-REVIEW.md) that the editor's interactive/read-only "Times" v-if split had zero test coverage:
- [x] `src/views/__tests__/ServiceEditorView.timesSection.test.ts` (5 tests) — editor UI renders for an
  editor on a draft (unlocked) service, is suppressed for a non-editor, is suppressed on a locked (planned)
  service even for an editor, inputs carry `:disabled` bound to `!canEditService` as defense-in-depth, and
  add/remove/edit handlers no-op when invoked directly with `canEditService` false.

*All gaps filled; no regenerated tests needed — the phase's existing automated coverage was verified to be
real (re-run 2026-09-09, all green) rather than accepted on the SUMMARY's claim alone.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Times render correctly on dashboard / My Schedule / volunteer view / share page | R433 | Visual/layout judgement across 5 surfaces | Deferred to batched UAT: create a service with 2 rehearsals + a report time, confirm all read-only surfaces show them alongside the date, correctly formatted, chronological |
| Org-defaults settings UX | R429 | Visual/interaction | Deferred to batched UAT: set defaults in Settings, create a new service, confirm rehearsal rows + report time pre-fill |

*Automated unit coverage exists for the data model, sort util, copy-not-bind, and both projections.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-09 — Nyquist audit re-ran all 4 automated test files
(`rehearsalTimes.test.ts`, `services.rehearsalDefaults.test.ts`, `services.rehearsalProjection.test.ts`,
`ServiceEditorView.timesSection.test.ts`); 28/28 tests pass, confirming R429-R433's data-layer, copy
semantics, dual-projection, and editor-authorization behaviors are genuinely covered, not merely claimed.
Remaining gaps (cross-surface visual layout, settings UX interaction) are correctly classified as
Manual-Only / human UAT, not Wave-0 automated gaps — no further test generation required.
