---
phase: 147
slug: default-rehearsal-day-and-time
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Estimated runtime** | quick ~15 seconds; full ~360 seconds; type gate ~65 seconds |

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

Filled in by the plans. Requirement-level map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| R459 | Select, save, rollback, editor gate | component | `npx vitest run src/views/__tests__/SettingsView.test.ts` | ✅ edit | ⬜ pending |
| R459 | Stored day survives load; missing reads none | store | `npx vitest run src/stores/__tests__/auth.test.ts` | ✅ edit | ⬜ pending |
| R460 | Weekday maths, boundaries, timezone | unit | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts` | ✅ edit | ⬜ pending |
| R460, R461 | Auto-add and its guards in `createService` | store | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts` | ✅ edit | ⬜ pending |
| R462 | Move, sticky edit, collisions, date saved, marker survives, Undo | unit + view | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts src/views/__tests__/ServiceEditorView.timesSection.test.ts` | ✅ edit | ⬜ pending |
| R462 | Old page removed, token link kept, two services on one date, cold-cache old date | store | `npx vitest run src/stores/__tests__/services.publicDocs.test.ts` | ❌ W0 | ⬜ pending |
| R463 | Defaults never touch existing services | store + view | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts` | ✅ edit | ⬜ pending |
| R464 | Add-form default date | component | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts` | ✅ edit | ⬜ pending |
| R465 | Projections narrowed, payloads clean, display unchanged | store + unit + component | `npx vitest run src/stores/__tests__/services.rehearsalProjection.test.ts src/utils/rehearseAccess.test.ts` | ✅ edit | ⬜ pending |
| R465 | Written and rewritten share documents carry no marker | store | `npx vitest run src/stores/__tests__/services.publicDocs.test.ts` | ❌ W0 | ⬜ pending |
| R465 | ADR-0249 and pointers | doc guard | `npx vitest run src/__tests__/defaultRehearsalAdr.test.ts` | ❌ W0 | ⬜ pending |
| R457 (pilot) | Every criterion cited | check | `npx vitest run src/__tests__/specCoverage.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `docs/specs/default-rehearsal.md` — the spec, committed before any test or code
- [ ] `src/__tests__/defaultRehearsalAdr.test.ts` — doc guard, failing before the ADR exists
- [ ] `src/stores/__tests__/services.publicDocs.test.ts` — in-memory document store for what the store really writes and
  removes, created by 147-03 Task 1
- [ ] Mock updates for the new settings field in `SettingsView.test.ts` and `ServiceEditorView.timesSection.test.ts`
- [ ] A timezone helper with an offset canary, because a shell `TZ=` prefix is silently ignored in Git Bash here

No framework install is needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Select fits the card at mobile width | R459 | Visual check (UI-SPEC backstop) | Open Settings at phone width and confirm the select stays inside the card |
| Changing a date in the real app survives a reload, and the old public page is gone | R462 | Real Firestore and share page | In the local emulator, move a service, reload, then open the old and new public pages |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
