---
phase: 52
slug: default-service-template
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 52 — Validation Strategy

> Seeded from 52-RESEARCH.md § Validation Architecture. Repro-test-first where a behavior reverses
> (R115) or is added (R116); component/host tests for the relocation (R113) and rename (R114).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @vue/test-utils (`mount`; `DOMWrapper` over `document.body` for teleported panels) |
| **Config file** | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) |
| **Quick run command** | scope to the touched file, e.g. `npx vitest run src/utils/__tests__/slotTypes.test.ts` |
| **Full suite command** | `npx vitest run --dir src --exclude '**/rules.test.ts'` (or bare `npx vitest run`) |
| **Type gate** | `npm run type-check` (= `vue-tsc --build`; checks test files — CLAUDE.md) |

**Known-failing baseline (do NOT chase — exactly 2 files):** `src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`. This phase touches neither; the baseline must remain exactly 2.

---

## Per-Requirement Verification Map

| Req | Behavior | Type | Command | File |
|-----|----------|------|---------|------|
| R113 | Services card GONE from Settings (no open-template button, no `template-summary`) | component | `npx vitest run src/views/__tests__/SettingsView.test.ts` | ✅ edit (delete/relocate describe @439-518) |
| R113 | Cog on Services page exists, editor-gated, opens `service-template-editor` | component | `npx vitest run src/views/__tests__/ServicesView.test.ts` | ❌ Wave 0 (NEW file) |
| R114 | Seed button reads "Suggested Template"; no VW gate; `template-reset` testid kept | component | `npx vitest run src/components/settings/__tests__/ServiceTemplateEditor.test.ts` | ✅ edit |
| R114 | "Suggested Template" seeds the 1-2-2-3-derived entries into the draft | component | same | ✅ extend |
| R115 | Empty/unset template → new service seeded from suggested preset (NOT 0 slots) | store unit | `npx vitest run src/stores/__tests__/services.test.ts` | ✅ **reverse** the @489 empty→0 test |
| R115 | Non-empty template still verbatim; VW types applied when vwModeEnabled | store unit | same | ✅ @508/@536 stay valid |
| R115 | `buildSlotsFromTemplate([], true)` still returns `[]` (PURITY preserved) | util unit | `npx vitest run src/utils/__tests__/slotTypes.test.ts` | ✅ @798 must stay green |
| R115 | `buildSuggestedTemplateEntries()` returns 1-2-2-3 entry shape, fresh ids | util unit | same | ❌ Wave 0 (new export) |
| R116 | `createSlot('MISC',…,body)` sets body; bodyless call still OMITS body | util unit | same | ✅ extend (@643/@656 "omits body" MUST stay green) |
| R116 | `buildSlotsFromTemplate` threads `entry.body` into the MISC slot | util unit | same | ❌ Wave 0 (new assertion) |
| R116 | `ServiceTemplateEntry` accepts `body?: string` | type gate | `npm run type-check` | ✅ compile-time |
| R116 | MISC template row renders a `template-item-body` textarea bound to `entry.body` | component | `ServiceTemplateEditor.test.ts` | ❌ Wave 0 (new assertion) |

---

## Wave 0 Requirements

- [ ] `src/views/__tests__/ServicesView.test.ts` — NEW file (cog exists + editor-gated + opens `service-template-editor`; R113 host side).
- [ ] `src/utils/__tests__/slotTypes.test.ts` — add `buildSuggestedTemplateEntries()` coverage (R115) + createSlot body-threading + buildSlotsFromTemplate body-threading (R116); EXTEND around the existing purity/omits-body tests, do NOT reverse them.
- [ ] `src/stores/__tests__/services.test.ts` — reverse the @489 empty→0-slots test to empty→suggested-slots (R115).
- [ ] `src/views/__tests__/SettingsView.test.ts` — delete/relocate the `Services card` describe block (@439-518) (R113).
- [ ] `src/components/settings/__tests__/ServiceTemplateEditor.test.ts` — update seed-button label (R114) + add MISC `template-item-body` textarea assertion (R116).
- [ ] Framework install: none.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cog on the Services page opens the template editor; it is gone from Settings | R113 | Real navigation/layout | In the app, open the Services page, click the cog → the template slide-out opens; confirm the Settings page no longer has a Services template card |
| Creating a brand-new service (with NO customized template) starts from the Suggested Template, not blank | R115 | Requires a real create against Firestore | As a church with an unset template, create a new service; confirm it opens pre-populated with the suggested order (not empty) |
| A Miscellaneous item's pre-filled body carries into a created service | R116 | End-to-end template→create | Add a MISC item with body text in the template, save, create a new service; confirm the MISC item carries the body |

---

## Validation Sign-Off

- [ ] Reversed/added behaviors have a test asserting the NEW truth (RED where it reverses)
- [ ] Existing purity (@798) and omits-body (@643/@656) tests stay green — extended around, never reversed
- [ ] Full app suite green at the exactly-2-file baseline; `npm run type-check` clean
- [ ] `nyquist_compliant: true` set by validate-phase

**Approval:** pending
