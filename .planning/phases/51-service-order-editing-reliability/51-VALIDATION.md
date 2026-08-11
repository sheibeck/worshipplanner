---
phase: 51
slug: service-order-editing-reliability
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from 51-RESEARCH.md
> § Validation Architecture. This is a repro-test-FIRST phase: each defect gets a failing (RED) test
> before its fix.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Vue Test Utils + jsdom) |
| **Config file** | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) |
| **Quick run command** | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` (scope to the touched file) |
| **Full suite command** | `npx vitest run --dir src --exclude '**/rules.test.ts'` (or bare `npx vitest run`) |
| **Type gate** | `npm run type-check` (= `vue-tsc --build`; checks test files too — CLAUDE.md) |
| **Estimated runtime** | ~30–60 s scoped; full suite a few min |

---

## Sampling Rate

- **After every task commit:** Run the scoped file command for the file touched.
- **After every plan wave:** Run the full app suite `npx vitest run --dir src --exclude '**/rules.test.ts'` + `npm run type-check`.
- **Before `/gsd-verify-work`:** Full suite green (only the 2 known-baseline files red — `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) + `npm run type-check` clean.
- **Max feedback latency:** ~60 s scoped.

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| R110 | Cross-section drag leaves no phantom in source list — live plan (`ServiceEditorView.vue`) | unit (simulate DOM move + `onEnd`) | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ extend |
| R110 | Cross-section drag leaves no phantom — default template (`ServiceTemplateEditor.vue`) | unit | `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` | ✅ extend |
| R111 | Section→"No Section" save carries no raw `undefined` (`updateService`) | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ extend |
| R112 | Listing renders section-major incl. empty-body items (`ServiceCard.vue`) | unit | `npx vitest run src/components/__tests__/ServiceCard.test.ts` | ✅ extend (7 existing tests) |
| R112 | Share snapshot slots are section-major (`buildServiceSnapshot`) | unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ extend |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/__tests__/ServiceCard.test.ts` — EXISTING file (git-tracked, 159 lines, 7 passing tests); EXTEND it with the R112 listing-order test, preserving all 7 current tests.
- [ ] Extend `ServiceEditorView.test.ts` with a **DOM-mutating** cross-section drag repro — the `sortablejs` mock does NOT move nodes, so the RED test must physically relocate the row between containers before asserting no duplicate `.slot-item` (Pitfall 1).
- [ ] Extend `ServiceTemplateEditor.test.ts` with the same cross-section phantom repro.
- [ ] Extend `services.test.ts` for `updateService` `stripUndefined` (R111) and `buildServiceSnapshot` ordering (R112).
- [ ] No new framework/config install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real OS drag between sections produces no phantom, no refresh needed | R110 | jsdom cannot produce a genuine `DataTransfer` / native SortableJS DOM move | In the running app, drag a Song into Worship in both the default-template editor and a live plan; confirm exactly one item, dropdown shows Worship, no undeletable "No Section" copy |
| Empty Miscellaneous items appear in correct order on the listing + share link without editing | R112 | Requires a real shared service + listing render | Create a service with two blank Miscellaneous items; view the Services listing and open the share link; confirm order matches the edit screen |

---

## Validation Sign-Off

- [ ] Every defect has a RED repro test committed before its fix
- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Full suite green against the 2-file known-failing baseline
- [ ] `npm run type-check` clean
- [ ] `nyquist_compliant: true` set in frontmatter (by validate-phase)

**Approval:** pending
