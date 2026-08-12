---
phase: 55-preview-export-polish
plan: 01
subsystem: slides-preview
tags: [scripture, presentation, render-only, R124]
requires: []
provides:
  - "Scripture slides render with no auto-appended (ESV)/(NLT) version at both preview render sites"
affects:
  - src/components/slides/slideDisplay.ts
  - src/components/PresentationViewer.vue
tech-stack:
  added: []
  patterns:
    - "Render-only behavior change: presentation output edited while provenance data/helpers left intact"
key-files:
  created: []
  modified:
    - src/components/slides/slideDisplay.ts
    - src/components/PresentationViewer.vue
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/__tests__/PresentationViewer.test.ts
decisions:
  - "R124 implemented as render-only: scripture.ts (scriptureAttribution/resolveTranslationSource/translationSource) untouched so R092 capture-once immutability and scripture.test.ts stay green"
  - "Manual version entry needs no new code — slide text is user-editable, so typing (ESV) into a slide still renders"
metrics:
  duration: ~15m
  completed: 2026-08-11
  tasks: 2
  files_changed: 4
status: complete
---

# Phase 55 Plan 01: R124 — No Auto-Appended Bible Version on Scripture Slides Summary

Removed the render-time `(ESV)`/`(NLT)` suffix from scripture slides at the two confirmed render sites (`slideBodyText` and `PresentationViewer`), leaving all provenance machinery intact — a purely render-only change verified by an unchanged, still-green `scripture.test.ts`.

## What Was Built

**Task 1 (RED, test-first):** Re-pointed every suffix-asserting test in `slideDisplay.test.ts` and `PresentationViewer.test.ts` to assert the version suffix is ABSENT, adding explicit `not.toContain('(ESV)')` / `not.toContain('(NLT)')` guards. The reference-only-no-text case was kept verbatim as a regression anchor. Running the two files against the still-present suffix produced the expected 14 failures (RED); `scripture.test.ts` was not modified.

**Task 2 (GREEN):** Removed the auto-append at both render sites:
- `slideDisplay.ts` — dropped the ` ${scriptureAttribution(resolveTranslationSource(slide))}` suffix from the `slideBodyText` scripture branch (returns `${reference}\n${text}` or just `text`); removed the now-dead `scriptureAttribution` / `resolveTranslationSource` named imports, keeping `formatScriptureReference` / `scriptureRefFromSlot`.
- `PresentationViewer.vue` — deleted the `scriptureAttributionSuffix` function, dropped both template interpolations (congregational-section paragraph and normal-mode passage paragraph), and removed the dead `@/utils/scripture` import.

`src/utils/scripture.ts` was NOT touched — the helpers and per-slide `translationSource` field still exist and still return the version suffix, proving the change is render-only and preserving R092.

## How to Verify

- `npm run type-check` (vue-tsc --build) — clean, no TS6133 unused-import errors.
- `npx vitest run src/components/slides/__tests__/slideDisplay.test.ts src/components/__tests__/PresentationViewer.test.ts src/utils/__tests__/scripture.test.ts` — 250 passed. `scripture.test.ts` green (provenance preserved).
- Broad `npx vitest run --dir src --exclude '**/rules.test.ts'` — 3059 passed; only the known 2-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) fails, unchanged by this plan.
- Manual (deferred to owner per v1.6 autonomy grant): present a service with a scripture slide, confirm no auto version suffix appears; type "(ESV)" into slide text and confirm it shows.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface

No new security-relevant surface. The plan's single accepted threat (T-55-01, XSS via now-user-typable version text) is unchanged: slide text renders via Vue `{{ }}` mustache interpolation (auto-escaped, never `v-html`), and the existing PresentationViewer test proves no markup executes. R124 removes render output; it adds no new sink.

## Self-Check: PASSED

- FOUND: src/components/slides/slideDisplay.ts (suffix removed, dead imports removed)
- FOUND: src/components/PresentationViewer.vue (function + calls + import removed)
- FOUND commit fe6a54c (Task 1 RED tests)
- FOUND commit c3b1b36 (Task 2 GREEN implementation)
