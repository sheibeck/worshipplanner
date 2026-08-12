---
phase: 55
slug: preview-export-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 55 — Validation Strategy

> Seeded from 55-RESEARCH.md § Validation Architecture. R124 re-points existing suffix-asserting tests
> to assert ABSENCE (render-only change; provenance helper stays green). R125 adds an export-spinner
> test. R126 adds Roboto to the registry + loader (npm install is a Wave-0 step).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 + @vue/test-utils (jsdom); vue-tsc type gate |
| **Config file** | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) |
| **Quick run command** | scope to the touched file(s) |
| **Full suite command** | `npx vitest run --dir src --exclude '**/rules.test.ts'` (or bare `npx vitest run`) |
| **Type gate** | `npm run type-check` (= `vue-tsc --build`; flags now-dead imports after R124) |

**Known-failing baseline (exactly 2, not regressions):** `src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`.

---

## Per-Requirement Verification Map

| Req | Behavior | Type | File |
|-----|----------|------|------|
| R124 | `slideBodyText` no longer appends `(ESV)`/`(NLT)` | unit | `src/components/slides/__tests__/slideDisplay.test.ts` (re-point) |
| R124 | Presenter renders no attribution suffix | component | `src/components/__tests__/PresentationViewer.test.ts` (re-point) |
| R124 | Provenance helpers untouched (`scriptureAttribution`/`resolveTranslationSource` still return `(ESV)`/`(NLT)`) | unit | `src/utils/__tests__/scripture.test.ts:523-534` — MUST stay green, NO edit (proof R124 is render-only) |
| R125 | Spinner shows while `isExporting`, absent otherwise; Confirm button disabled during export | component | `src/views/__tests__/ServiceEditorView.test.ts` (add) |
| R126 | Registry has six families incl. Roboto `[300,400,500,600,700]`, OFL-1.1 | unit | `src/config/__tests__/slideFonts.test.ts` (count 5→6 + Roboto) |
| R126 | Loader map resolves Roboto | unit | `src/utils/__tests__/slideTypography.test.ts` (add) |

### R124 — existing suffix tests to re-point to ABSENCE
- `slideDisplay.test.ts`: `:358-366`, `:369-378`, `:395-405`, `:409-419`, `:424-432` (drop ` (ESV)`/` (NLT)`); `:381-389` (reference-only, no suffix) stays as a regression anchor. Add `not.toContain('(ESV)')`/`not.toContain('(NLT)')` guards.
- `PresentationViewer.test.ts`: `:653-655`, `:721-722`, the `describe('scripture attribution suffix …')` block `:738-809`, `:831`, `:855`, `:1865` — assert neither `(ESV)` nor `(NLT)` appears.
- `scripture.test.ts:523-534` — do NOT change (helper preserved).

---

## Wave 0 Requirements

- [ ] **`npm install @fontsource/roboto@^5.3.0`** — build-dependency add; MUST run before the R126 loader test resolves and before build. First R126 step.
- [ ] `slideFonts.test.ts` — update "exactly five" (`:5-9`) → six keys incl. `'Roboto'`; existing license/weight-ramp loops auto-cover it.
- [ ] `slideTypography.test.ts` — add `FONT_CSS_LOADERS['Roboto']` present / `loadFontCss('Roboto',400)` resolves.
- [ ] `ServiceEditorView.test.ts` — add the `export-spinner` renders-when-`isExporting` + Confirm-disabled test.
- [ ] Re-point the R124 suffix tests (above).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scripture slides show no `(ESV)`/`(NLT)` when presenting; it can be typed in manually | R124 | Real projection | Present a service with a scripture slide; confirm no auto version suffix; type "(ESV)" into the slide text and confirm it shows |
| The Planning Center export shows a spinner while running | R125 | Real PC export round-trip | Trigger a PC export; confirm the Confirm Export button shows a spinner and is disabled until it completes |
| Roboto is selectable in the typography picker and renders on slides | R126 | Real font pick + projector | In Slide Typography settings, pick Roboto; confirm slides render in Roboto and Inter is still available |

---

## Package Legitimacy (R126)

`@fontsource/roboto@5.3.0` — OFL-1.1 (in-tarball LICENSE; relicensed from Apache-2.0 at 5.2.0), full
100–900 weight ramp incl. 600, canonical repo, ~1.26M downloads/wk, null postinstall. The legitimacy
scanner's `SUS`/`too-new` flag is the **same fontsource-lockstep false positive Phase 46 documented** →
approve and defer a one-line owner sign-off to PENDING-VERIFICATION § Phase 55.

---

## Validation Sign-Off

- [ ] R124 suffix tests re-pointed to ABSENCE; `scripture.test.ts` provenance test stays green (render-only proof)
- [ ] R125 spinner test added; R126 registry six-families + loader tests added
- [ ] `@fontsource/roboto` installed and pinned; no dead imports (type-check clean)
- [ ] Full app suite green at the exactly-2-file baseline
- [ ] `nyquist_compliant: true` set by validate-phase

**Approval:** pending
