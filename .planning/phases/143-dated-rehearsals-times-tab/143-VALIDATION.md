---
phase: 143
slug: dated-rehearsals-times-tab
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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

Requirement-level map (task IDs are filled in once PLAN.md files exist).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | R441 | — | Undated row cannot be created; parent handlers re-check `canEditService` and reject clearing a non-empty date/time | component + view | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts src/views/__tests__/ServiceEditorView.timesSection.test.ts` | ❌ W0 / ♻️ rewrite | ⬜ pending |
| TBD | TBD | TBD | R442 | — | N/A | unit + component | `npx vitest run src/stores/__tests__/services.rehearsalDefaults.test.ts src/components/__tests__/ServiceTimesPanel.test.ts -t "default"` | ♻️ rewrite / ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | R443 | — | Undated rows never reach read-only/public surfaces or projections | component + unit | `npx vitest run src/components/__tests__/ServiceTimesPanel.test.ts -t "legacy" src/stores/__tests__/services.rehearsalProjection.test.ts` | ❌ W0 / ✅ | ⬜ pending |
| TBD | TBD | TBD | R444 | — | Read-only for viewers/locked; Times tab exposes no action-bar items | view + unit | `npx vitest run src/views/__tests__/ServiceEditorView.stage.test.ts src/views/__tests__/ServiceEditorView.test.ts src/views/__tests__/serviceEditorActionBar.test.ts` | ♻️ update | ⬜ pending |
| TBD | TBD | TBD | R445 | — | N/A | unit + review gate | `npx vitest run src/utils/__tests__/rehearsalTimes.test.ts src/stores/__tests__/services.rehearsalProjection.test.ts` + empty `git diff --stat` on display surfaces | ✅ / ♻️ add cases | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/ServiceTimesPanel.test.ts` — R441/R442/R443/R444 panel behavior (`mount`, `attachTo: document.body` for focus, `vi.useFakeTimers()` for the 4 s revert message)
- [ ] `src/views/__tests__/ServiceEditorView.timesSection.test.ts` — rewrite for Times tab / dot / header removal / handler invariants
- [ ] `formatRehearsalDateShort` cases in `src/utils/__tests__/rehearsalTimes.test.ts`
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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
