---
phase: 115-live-output-readability-layout
plan: 05
subsystem: frontend
tags: [slide-typography, css-custom-properties, settings-ui, r329]

# Dependency graph
requires:
  - phase: 115-live-output-readability-layout
    provides: "115-03's SlideCanvas/output-window migration off --slide-font-scale to the measured --slide-fit-scale, and 115-04's fixed-base editor surfaces (SlideCard/EditSlideDrawer) — the last two non-Plan-05 readers of the variable"
provides:
  - "src/utils/slideTypography.ts with SCALE_MAP, DEFAULT_SCALE, the fontScale field, and the --slide-font-scale CSS var fully removed; cssVarsFor/defaultCssVars emit only --slide-font-family + --slide-font-weight"
  - "src/types/organization.ts's OrgSettings.slideTypography (type + DEFAULT_ORG_SETTINGS) with no fontScale field"
  - "src/views/SettingsView.vue's Slide Typography card with no Size control — family + weight remain, saving exactly two leaf dot-paths"
  - "Every test fixture across 9 test files (SettingsView + 8 sweep files) with no fontScale mock literal, so the whole app type-checks after the OrgSettings type change"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deleting a settings leaf field: remove from the pure-function model first (slideTypography.ts), then the type/defaults (organization.ts), then the UI reader (SettingsView.vue), then sweep every test mock that spells out the literal — in that order, so each step's own test file proves the prior step correct before the type change ripples into unrelated fixtures."

key-files:
  created: []
  modified:
    - src/utils/slideTypography.ts
    - src/utils/__tests__/slideTypography.test.ts
    - .planning/codebase/ARCHITECTURE.md
    - src/types/organization.ts
    - src/views/SettingsView.vue
    - src/views/__tests__/SettingsView.test.ts
    - src/composables/__tests__/useOutputWindow.test.ts
    - src/views/__tests__/RunControlView.test.ts
    - src/views/__tests__/AudienceOutputView.test.ts
    - src/views/__tests__/ConfidenceOutputView.test.ts
    - src/components/__tests__/PresentationViewer.test.ts
    - src/components/slides/__tests__/SlideGrid.test.ts
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - src/stores/__tests__/auth.test.ts

key-decisions:
  - "Ran Task 3's sweep as a single mechanical node one-liner across all 8 files first (stripping the exact `, fontScale: 'md' }` literal suffix everywhere it appeared), then hand-fixed the handful of non-mechanical spots (PresentationViewer.test.ts's local mock type declaration, auth.test.ts's DEFAULT_ORG_SETTINGS.slideTypography.fontScale read + its 'three leaf keys' comment) — faster and less error-prone than editing each of the ~12 occurrences individually, and the mechanical pass was verified by a full grep sweep afterward."
  - "SettingsView.test.ts's 'saves family/weight/size as three leaf dot-paths' test was redriven through the weight <select> (400→600) instead of the removed Size radios, since the save action and its key-count assertion needed a still-existing control to exercise; the revert-on-write-reject and viewer-disabled cases were redriven the same way."
  - "Kept the historical --slide-font-scale mentions in SlideCanvas.vue and useSlideAutoFit.ts (prose comments explaining what auto-fit replaced) and in ARCHITECTURE.md's RunPreviewPair note (narrating a past owner-UAT fix) — these are backward-looking rationale, not live code references to the removed variable, so removing them would erase useful history without changing behavior."

requirements-completed: [R329]

coverage:
  - id: D1
    description: "slideTypography.ts's SlideTypographySettings/SlideTypographyCssVars carry only fontFamily/fontWeight and --slide-font-family/--slide-font-weight; SCALE_MAP and DEFAULT_SCALE no longer exist; cssVarsFor computes only the two vars and still defensively falls back to Inter/400 on invalid family/weight"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideTypography.test.ts (12 tests: cssVarsFor two-key output for valid selections, Inter/400 fallback for undefined/tampered input, FONT_LOAD_TIMEOUT_MS, FONT_CSS_LOADERS, snapWeight, waitForSlideFont)"
        status: pass
    human_judgment: false
  - id: D2
    description: "OrgSettings.slideTypography (type + DEFAULT_ORG_SETTINGS) has no fontScale field; a pre-existing org document that still stores slideTypography.fontScale loads without error (silently ignored, no migration)"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#deep-merges a partial stored slideTypography — missing leaf fields fall back to their own defaults (asserts fontFamily/fontWeight resolution with no fontScale field involved)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SettingsView.vue's Slide Typography card renders Font family + Weight controls and the live Preview with NO Size radios; saveSlideTypography writes exactly two leaf dot-paths (family, weight); viewer-disabled and family-change snap-to-400 behavior unchanged"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SettingsView.test.ts (44 tests, including the rewritten 'renders...no Size control', 'saves family/weight as two leaf dot-paths', revert-on-reject, and viewer-disabled cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No test file in the codebase constructs a slideTypography object with a fontScale property or declares a local mock type with fontScale (except SettingsView.test.ts's intentional absence-assertions); vue-tsc --build reports zero errors across src + tests; the app suite passes at the documented one-file baseline"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "npx vitest run of the 8 swept files (636 tests) + full npx vitest run (185/186 files, 5038/5038 tests, only src/storage.rules.test.ts fails — documented Storage-emulator baseline)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) — zero errors"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-04
status: complete
---

# Phase 115 Plan 05: Retire the Manual Slide-Font-Size Model Summary

**Removed the discrete `--slide-font-scale` sm/md/lg multiplier end to end — `SCALE_MAP`, the `fontScale` field, the Settings Size radios, and every test mock that spelled it out — completing R329's auto-fit-owns-text-size decision now that every render site (SlideCanvas/output in Plan 03, editor surfaces in Plan 04) had already migrated off it.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-04T02:04Z (approx)
- **Completed:** 2026-09-04T02:15Z (approx)
- **Tasks:** 3 completed
- **Files modified:** 14 (2 source model files, 1 map doc, 2 source UI files, 9 test files)

## Accomplishments
- `slideTypography.ts` no longer exports or uses `SCALE_MAP`, `DEFAULT_SCALE`, `fontScale`, or `--slide-font-scale`; `cssVarsFor`/`defaultCssVars` compute and return exactly `--slide-font-family` + `--slide-font-weight`, still defensively falling back to Inter/400 on any invalid family/weight. `slideTypography.test.ts`'s SCALE_MAP describe block and every `--slide-font-scale` assertion are gone; the cssVarsFor cases now assert the two-key output. ARCHITECTURE.md's slideTypography Behavioral Note updated to match, with a pointer to Plan 03's auto-fit note.
- `organization.ts`'s `OrgSettings.slideTypography` type and `DEFAULT_ORG_SETTINGS.slideTypography` both drop `fontScale`; the adjacent "Medium = identity scale" comment is replaced with a note that size is now auto-fit-owned.
- `SettingsView.vue`'s Slide Typography card no longer renders the Size radio group (`slide-font-scale-sm/md/lg`); the `slideFontScaleInput` ref, its reads in `saveSlideTypography` (now a two-leaf `updateDoc` write: family + weight), its line in the settings-reload watch, and the preview style's `fontSize: calc(1rem * var(--slide-font-scale))` are all removed. Family + weight controls, the Saved!/error feedback, and the live Preview (now family/weight only) are unchanged. The card's intro copy updated from "font, weight, and size" to "font and weight... Text size fits each slide automatically."
- `SettingsView.test.ts`: `mockSlideTypography`'s type narrowed to `{ fontFamily, fontWeight }`; the heading test now asserts the three Size radio testids are ABSENT; the save test asserts exactly two leaf dot-paths (driven through the weight `<select>` since the Size radios no longer exist) and explicitly asserts no `fontScale` leaf; the revert-on-write-reject and viewer-disabled cases redriven through the weight select. 44/44 tests pass.
- Swept `fontScale` out of the remaining 8 test files (`useOutputWindow`, `RunControlView`, `AudienceOutputView`, `ConfidenceOutputView`, `PresentationViewer`, `SlideGrid`, `EditSlideDrawer` test fixtures + `auth.test.ts`'s deep-merge and default-settings assertions), including narrowing `PresentationViewer.test.ts`'s local `mockSlideTypography` type declaration. This was the mandatory step making the `OrgSettings` type change (Task 2) type-clean — every literal that spelled out `fontScale` was otherwise a `vue-tsc` excess-property error even though each file's own `vitest run` stayed green.
- Full verification: `npm run type-check` (vue-tsc --build, checks test files too) is clean — zero errors. `npx vitest run` (full suite): 185/186 files pass, 5038/5038 tests pass, only `src/storage.rules.test.ts` fails (documented Storage-emulator environment limitation, unrelated to this plan) — no regressions from the documented baseline.

## Task Commits

Each task was committed atomically:

1. **Task 1: slideTypography model — remove SCALE_MAP + fontScale + --slide-font-scale (family/weight only)** - `544a35a0` (refactor)
2. **Task 2: organization type/defaults + SettingsView — remove the Size control** - `bdc83a34` (refactor)
3. **Task 3: fontScale mock sweep — make the whole suite type-clean** - `154db314` (test)

## Files Created/Modified
- `src/utils/slideTypography.ts` - removed `SCALE_MAP`, `DEFAULT_SCALE`, the `fontScale` field, and the `--slide-font-scale` var; `cssVarsFor`/`defaultCssVars` now compute only family + weight.
- `src/utils/__tests__/slideTypography.test.ts` - removed the SCALE_MAP describe block and all `--slide-font-scale` assertions; cssVarsFor cases assert the two-key output.
- `.planning/codebase/ARCHITECTURE.md` - updated the `src/utils/slideTypography.ts` Behavioral Note to describe the two-var `cssVarsFor` and point to Plan 03's auto-fit note for text size.
- `src/types/organization.ts` - `OrgSettings.slideTypography` (type + `DEFAULT_ORG_SETTINGS`) drops `fontScale`.
- `src/views/SettingsView.vue` - removed the Size radio block, `slideFontScaleInput` ref, its save/watch/revert reads, and the preview's scale-based `fontSize`; intro copy updated.
- `src/views/__tests__/SettingsView.test.ts` - narrowed `mockSlideTypography`'s type; rewrote the heading/save/revert/viewer-disabled tests to assert the Size control's absence and drive saves through the weight select.
- `src/composables/__tests__/useOutputWindow.test.ts`, `src/views/__tests__/RunControlView.test.ts`, `src/views/__tests__/AudienceOutputView.test.ts`, `src/views/__tests__/ConfidenceOutputView.test.ts`, `src/components/slides/__tests__/SlideGrid.test.ts`, `src/components/slides/__tests__/EditSlideDrawer.test.ts` - dropped the `fontScale` property from their `slideTypography` mock literals.
- `src/components/__tests__/PresentationViewer.test.ts` - narrowed the local `mockSlideTypography` type declaration and dropped `fontScale` from its literals.
- `src/stores/__tests__/auth.test.ts` - removed the `DEFAULT_ORG_SETTINGS.slideTypography.fontScale` read and its round-trip assertion; updated the adjacent "three leaf keys" comment to "both leaf keys."

## Decisions Made
- The Task 3 sweep was run as one mechanical string-replace across all 8 files (stripping the exact `, fontScale: 'md' }` suffix), then the remaining non-mechanical spots (a type declaration, a `DEFAULT_ORG_SETTINGS` read, a stale comment) were hand-fixed and verified with a full `grep -rn fontScale` sweep — faster and less error-prone than 12 separate manual edits.
- SettingsView.test.ts's save/revert/viewer-disabled tests, which previously exercised the removed Size radios, were redriven through the still-existing weight `<select>` (400→600) rather than dropped, preserving coverage of the save action's key-count and error-revert behavior.
- Historical `--slide-font-scale` mentions in prose comments (SlideCanvas.vue, useSlideAutoFit.ts, ARCHITECTURE.md's RunPreviewPair note) were left as-is — they narrate what auto-fit replaced, not live references to the removed variable.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' behavior bullets, acceptance criteria, and the plan-level verification commands pass as specified.

## Issues Encountered

None.

## User Setup Required

None — pure client-side type/model/UI removal + test sweep, no new dependencies, no Firestore migration (a pre-existing org's stored `fontScale` is silently ignored on read, per the plan's threat register T-115-06).

## Next Phase Readiness

- R329 is now fully complete: auto-fit (Plans 01/03) owns text size everywhere, the manual Size control and its underlying model are gone, and font family + weight remain fully configurable.
- Phase 115 (Live-Output Readability & Layout) is code-complete across all 5 plans. Real-hardware WYSIWYG verification (owner's Mac + projector) remains deferred to the batched v2.9 milestone-end UAT per `.planning/v2.9-DEFERRED-VERIFICATION.md`.
- Verified green: `npm run type-check` clean; `npx vitest run` at the documented one-file baseline (`src/storage.rules.test.ts` only).

---
*Phase: 115-live-output-readability-layout*
*Completed: 2026-09-04*

## Self-Check: PASSED

All 14 files listed under "Files Created/Modified" and this SUMMARY.md exist on disk; all three task commit hashes (`544a35a0`, `bdc83a34`, `154db314`) confirmed present in `git log`.
