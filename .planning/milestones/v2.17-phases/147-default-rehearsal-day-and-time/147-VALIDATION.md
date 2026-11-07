---
phase: 147
slug: default-rehearsal-day-and-time
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-11-06
---

# Phase 147 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18, jsdom, `@vue/test-utils` |
| **Config file** | `vite.config.ts` (excludes `src/rules.test.ts` and `render-service/**`) |
| **Quick run command** | `npx vitest run <the plan's test files>` |
| **Full suite command** | `npx vitest run` |
| **Type gate** | `npm run type-check` |
| **Measured runtime** | scoped files 6-12 seconds, except `ServiceEditorView.timesSection.test.ts` at about 26; full 357 seconds; type gate ~65 seconds |

---

## Sampling Rate

- **After every task commit:** the scoped command for the files touched.
- **After every plan wave:** the scoped files for the wave, `npm run type-check`, and the residual list of uncited
  criteria, compared with the expected count. `npx vitest run` is red on purpose until the last citation lands.
- **Before `/gsd-verify-work`:** bare `npx vitest run` shows only the `src/storage.rules.test.ts` baseline failure,
  `src/__tests__/specCoverage.test.ts` passes, and `npm run type-check` is clean.
- **Max feedback latency:** 15 seconds for the quick command.

---

## Per-Task Verification Map

Requirement-level map. Each count is the tests that passed in the 2026-11-07 run and cite one of the requirement's criteria:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| R459 | Select, save, rollback, editor gate, church switch, no write before Save | component | `npx vitest run src/views/__tests__/SettingsView.test.ts src/views/__tests__/SettingsView.defaultsWrites.test.ts` | ✅ | ✅ green (14) |
| R459 | Stored day survives load; missing reads none | store | `npx vitest run src/stores/__tests__/auth.test.ts` | ✅ | ✅ green (3) |
| R460 | Weekday maths, boundaries, timezone | unit | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts` | ✅ | ✅ green (8) |
| R460, R461 | Auto-add and its guards in `createService` | store | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts` | ✅ | ✅ green (14) |
| R462 | Marker, move, sticky edit, collisions, date saved, marker survives, Undo | store + unit + view | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts src/utils/__tests__/rehearsalTimes.test.ts src/views/__tests__/ServiceEditorView.timesSection.test.ts` | ✅ | ✅ green (28) |
| R462 | Old page removed, token link kept, two services on one date, cold-cache old date | store | `npx vitest run src/stores/__tests__/services.publicDocs.test.ts` | ✅ | ✅ green (12) |
| R463 | Defaults never touch existing services | store + view | `npx vitest run src/views/__tests__/SettingsView.test.ts src/views/__tests__/SettingsView.defaultsWrites.test.ts src/stores/__tests__/services.publicDocs.test.ts src/views/__tests__/ServiceEditorView.timesSection.test.ts` | ✅ | ✅ green (4) |
| R464 | Add-form default date | component + view | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts src/views/__tests__/ServiceEditorView.timesSection.test.ts` | ✅ | ✅ green (10) |
| R465 | Projections narrowed, display unchanged | store + component | `npx vitest run src/stores/__tests__/services.rehearsalProjection.test.ts src/components/__tests__/ServiceTimesPanel.test.ts src/components/__tests__/ServiceCard.test.ts src/views/__tests__/DashboardView.rehearsalTimes.test.ts` | ✅ | ✅ green (5) |
| R465 | Written and rewritten share documents carry no marker | store | `npx vitest run src/stores/__tests__/services.publicDocs.test.ts` | ✅ | ✅ green (2) |
| R465 | ADR-0249 and pointers | doc guard | `npx vitest run src/__tests__/defaultRehearsalAdr.test.ts` | ✅ | ✅ green (1) |
| R457 (pilot) | Every criterion cited | check | `npx vitest run src/__tests__/specCoverage.test.ts` | ✅ | ✅ green (69 of 69 cited) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `docs/specs/default-rehearsal.md` — the spec, committed before any test or code
- [x] `src/__tests__/defaultRehearsalAdr.test.ts` — doc guard, failing before the ADR exists
- [x] `src/stores/__tests__/services.publicDocs.test.ts` — in-memory document store for what the store really writes and
  removes, created by 147-03 Task 1
- [x] Mock updates for the new settings field in `SettingsView.test.ts` and `ServiceEditorView.timesSection.test.ts`
- [x] A timezone helper with an offset canary, because a shell `TZ=` prefix is silently ignored in Git Bash here

No framework install is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Select fits the card at mobile width | R459 | Visual check (UI-SPEC backstop) | Open Settings at phone width and confirm the select stays inside the card |
| Changing a date in the real app survives a reload, and the old public page is gone | R462 | Real Firestore and share page | In the local emulator, move a service, reload, then open the old and new public pages |
| Choosing None saves and survives a reload | R459 | Tests only mock this write | In the local emulator, choose a day, save and reload, then choose None, save and reload |

The owner passed all three in the local emulator on 2026-11-06 (`147-UAT.md` tests 1 to 3).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (11 of 11)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 15s: not met by one file. 10 of the 11 scoped commands took 6-12 seconds, and `ServiceEditorView.timesSection.test.ts` takes about 26. This is speed, not coverage
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-07, by automated audit. The owner's checks are in `147-UAT.md`.

## Validation Audit 2026-11-07

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

- **Full run:** 255 of 256 files passed, and only the `src/storage.rules.test.ts` baseline failed. 6442 tests passed and 43 were skipped, none of them citing a criterion. `npm run type-check` is clean.
- **Stronger than the spec check:** the spec check reads test source, so it can't show a test ran. This audit read vitest's per-test JSON report. Each of the 69 criteria has at least one test that ran and passed, and no citing test failed or was skipped. 46 criteria rest on exactly one test.
- **Map corrected:** the seeded commands didn't all run the tests that prove their requirement. R463's command listed a file with none of its citing tests. R459 lacked `SettingsView.defaultsWrites.test.ts`, R464 lacked the editor test, and R465 lacked the display tests. No coverage was missing.
- **Not run:** `npm run test:rules`. No rules file changed in this phase and no criterion cites that suite.
