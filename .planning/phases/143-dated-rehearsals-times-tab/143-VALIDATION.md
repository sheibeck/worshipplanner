---
phase: 143
slug: dated-rehearsals-times-tab
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: true) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-10-27
---

# Phase 143 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `143-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 + @vue/test-utils (jsdom) |
| **Config file** | `vite.config.ts` (`test:` block; excludes `src/rules.test.ts` and `render-service/**`) |
| **Quick run command** | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts src/utils/__tests__/rehearsalTimes.test.ts src/stores/__tests__/services.rehearsalDefaults.test.ts src/stores/__tests__/services.rehearsalProjection.test.ts src/views/__tests__/serviceEditorActionBar.test.ts` |
| **View-level command** | `npx vitest run src/views/__tests__/ServiceEditorView.timesSection.test.ts src/views/__tests__/ServiceEditorView.stage.test.ts src/views/__tests__/ServiceEditorView.test.ts` |
| **Full suite command** | `npx vitest run` (bare; baseline = only `src/storage.rules.test.ts` fails) + `npm run type-check` |
| **Estimated runtime** | ~20 s quick · ~90 s view-level · several minutes full |

---

## Sampling Rate

- **After every task commit:** quick run command (+ `npx vue-tsc --noEmit -p tsconfig.app.json` as inner loop only)
- **After every plan wave:** quick + view-level commands + `npm run type-check`
- **Before `/gsd-verify-work`:** bare `npx vitest run` at the 1-file baseline **and** `npm run type-check` green
- **Max feedback latency:** ~90 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 143-01-01 | 01 | 1 | R442 | T-143 (plan 01) | Defaults never mutate existing services | unit | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts src/views/__tests__/SettingsView.test.ts` | ✅ | ✅ green |
| 143-01-02 | 01 | 1 | R442/R443 | — | N/A (ADR + index) | doc check | `test -f docs/adr/0245-…md && grep -c "ADR-0245" docs/adr/README.md` | ✅ | ✅ green |
| 143-01-03 | 01 | 1 | R445 | — | Undated rows never reach read surfaces | component | `npx vitest run src/components/__tests__/ServiceCard.test.ts src/views/__tests__/ShareView.test.ts src/views/__tests__/VolunteerServiceView.test.ts src/views/__tests__/MyScheduleView.test.ts src/views/__tests__/DashboardView.rehearsalTimes.test.ts` | ✅ | ✅ green |
| 143-02-01 | 02 | 1 | R444 | — | Malformed date renders "" not "Invalid Date" | unit | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts` | ✅ | ✅ green |
| 143-02-02 | 02 | 1 | R441/R442/R443/R444 | T-143-09 | Undated row cannot be created; clear/malformed edit reverts, emits nothing; text interpolation only | component | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts` | ✅ | ✅ green |
| 143-02-03 | 02 | 1 | R444 | — | N/A (ARCHITECTURE note) | doc check | `grep -c "### src/components/ServiceTimesPanel.vue" .planning/codebase/ARCHITECTURE.md` | ✅ | ✅ green |
| 143-03-01 | 03 | 2 | R444 | — | Times tab exposes no action-bar items | unit | `npx vitest run src/views/__tests__/serviceEditorActionBar.test.ts` | ✅ | ✅ green |
| 143-03-02 | 03 | 2 | R441/R443/R444 | — | RED-first view tests (assertion failures only) | view | `npx vitest run src/views/__tests__/ServiceEditorView.timesSection.test.ts` | ✅ | ✅ green (post-GREEN) |
| 143-03-03 | 03 | 2 | R441/R443/R444 | T-143-09 | canEditService gates (R036) never relaxed; format-guarded handlers | view | `npx vitest run src/views/__tests__/ServiceEditorView.timesSection.test.ts src/views/__tests__/ServiceEditorView.stage.test.ts src/views/__tests__/ServiceEditorView.test.ts` | ✅ | ✅ green |
| review-fix | — | — | R441/R442 | WR-01/WR-02 | Shared YMD_RE/HM_RE; deduped defaults | component | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts src/views/__tests__/SettingsView.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Phase gate (verifier, 2026-10-27, post review fixes): bare `npx vitest run` = 242 files pass / 1 baseline fail (`src/storage.rules.test.ts`), 6055 tests; `npm run type-check` exit 0.

---

## Wave 0 Requirements

- [x] `src/components/__tests__/ServiceTimesPanel.test.ts` — R441/R442/R443/R444 panel behavior (`mount`, `attachTo: document.body` for focus, `vi.useFakeTimers()` for the 4 s revert message)
- [x] `src/views/__tests__/ServiceEditorView.timesSection.test.ts` — rewrite for Times tab / dot / header removal / handler invariants
- [x] `formatRehearsalDateShort` cases in `src/utils/__tests__/rehearsalTimes.test.ts`
- Framework install: none — existing infrastructure covers the phase.

---

## Manual-Only Verifications

Batched to the v2.16 milestone-end human UAT (PENDING, not owner-accepted).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-browser revert feel when clearing a dated row's date/time | R441 | Native date/time input clear behavior differs per browser (A1 assumed) | In Chrome + Safari, clear a dated rehearsal's date → value snaps back, amber status message shows ~4 s |
| 6th tab reachable on a 360 px screen | R444 | Overflow scroll is layout, not jsdom-testable (UI-SPEC backstop) | Phone-width editor: scroll the tab strip, tap Times, panel shows |
| Amber marker/dot contrast on gray-950 | R443 | Visual | Open a v2.15 service with an undated row: dot visible on tab, marker legible |
| Mobile stacking < 640 px | R444 | Layout | Phone width: rows and add form stack, inputs full width |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s (targeted commands)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-27 (validate-phase audit; manual-only items batched to the v2.16 milestone-end owner UAT, PENDING)

## Validation Audit 2026-10-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
