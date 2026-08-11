---
phase: 54
slug: service-item-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 54 — Validation Strategy

> Seeded from 54-RESEARCH.md § Validation Architecture. R123 is a one-branch materializer change with
> backward-compat + hand-add-survival tests; R122 is a per-item notes input + responsive wrapper +
> autosave round-trip.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @vue/test-utils (jsdom); vue-tsc ^3.2.5 type gate |
| **Config file** | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) |
| **Quick run command** | scope to the touched file (e.g. `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts`) |
| **Full suite command** | `npx vitest run --dir src --exclude '**/rules.test.ts'` (or bare `npx vitest run`) |
| **Type gate** | `npm run type-check` (= `vue-tsc --build`; checks tests — CLAUDE.md) |

**Known-failing baseline (exactly 2, not regressions):** `src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`. No Firestore/Storage rules touched this phase.

---

## Per-Requirement Verification Map

| Req | Behavior | Type | File |
|-----|----------|------|------|
| R123 | `deriveGroupEntries(MISC)` returns `[]` | unit | `src/utils/__tests__/slideGroupMaterializer.test.ts` (extend) |
| R123 | ANNOUNCEMENTS/PRAYER/MESSAGE/HYMN still derive one `{kind:'text'}` entry (regression) | unit | same |
| R123 | `rebuildGroup(MISC)` no-op → hand-added slide (`{kind:'text',title:'New slide',body:''}`) survives | unit | same |
| R123 | `rebuildGroup(MISC)` on an existing group with only the auto text entry returns `changed:false` (blank slide persists — BWC) | unit | same |
| R122 | Notes input renders beside the selector for each kind (`data-testid="slot-notes-input"`) | component | `src/views/__tests__/ServiceEditorView.test.ts` (extend) |
| R122 | Editing notes flows to autosave; emptied notes does not persist raw `undefined` | component/store | `src/stores/__tests__/services.test.ts` (extend — `stripUndefined` drops `slots[].notes`) |
| R122 | Responsive wrapper classes present (`flex flex-col sm:flex-row`) | component | ServiceEditorView test |
| R122 | `notes?` on all 5 slot kinds | type | `npm run type-check` (build-covered) |

---

## Wave 0 Requirements

- [ ] `slideGroupMaterializer.test.ts` — add a `deriveGroupEntries — MISC` describe (returns `[]`) + hand-add-survival + auto-slide-persists rebuild tests (R123).
- [ ] `ServiceEditorView.test.ts` — add notes-input-per-kind + responsive-class + autosave-wiring assertions (R122), mirroring the 11 existing `slot-*` testid assertions.
- [ ] `services.test.ts` — add slot-level `notes` round-trip + `undefined`-stripped assertion (R122 persistence).
- [ ] Framework install: none.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Notes field sits beside the selector on desktop, stacks on a phone | R122 | Real responsive layout | On the service edit screen, resize/narrow the viewport; confirm the notes input is side-by-side on desktop and below the selector on mobile, consistent across song/scripture/message items |
| A new Miscellaneous item shows no slides; a slide can still be added | R123 | Real slide grid + add path | Add a Miscellaneous item; open the Slides tab; confirm it has no slides; add one and confirm it appears and persists |

---

## Validation Sign-Off

- [ ] R123 MISC-no-derived-slide + hand-add survival + BWC (existing blank slide persists) all tested
- [ ] R122 notes input per kind + responsive classes + autosave round-trip (undefined stripped) tested
- [ ] Full app suite green at the exactly-2-file baseline; `npm run type-check` clean; switch stays exhaustive
- [ ] `nyquist_compliant: true` set by validate-phase

**Approval:** pending
