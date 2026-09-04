---
phase: 115-live-output-readability-layout
plan: 04
subsystem: frontend
tags: [slide-typography, css-custom-properties, slide-editor, r329]

# Dependency graph
requires:
  - phase: 115-live-output-readability-layout
    provides: "115-01's auto-fit engine (not consumed here — this plan only stops the two editor surfaces reading the old discrete multiplier; auto-fit itself is a Plan 03 concern for output/previews)"
provides:
  - "SlideCard.vue's Slides-grid card body renders at a fixed 13px base — no longer scaled by --slide-font-scale"
  - "EditSlideDrawer.vue's preview renders at a fixed 13px base — no longer scaled by --slide-font-scale"
  - "The last two non-SlideCanvas literal readers of --slide-font-scale are gone, clearing the way for Plan 05 to delete the variable + SCALE_MAP model without stranding a calc() on an undefined value"
affects: [115-05-remove-slide-font-scale]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed-base editor mini-render: SlideCard/EditSlideDrawer keep their own fixed 13px preview size rather than adopting the projector auto-fit (deliberate CONTEXT.md scope line — auto-fit targets output + Run previews/thumbnails only)"

key-files:
  created: []
  modified:
    - src/components/slides/SlideCard.vue
    - src/components/slides/__tests__/SlideCard.test.ts
    - src/components/slides/EditSlideDrawer.vue

key-decisions:
  - "Dropped the two --slide-font-scale-specific assertions in SlideCard.test.ts entirely (rather than asserting computed CSS via getComputedStyle) — jsdom/vue-test-utils does not reliably apply Vue SFC scoped <style> rules through getComputedStyle, so a computed-size assertion would be a false-positive-prone test; the plan's own action text offered this as the simpler sanctioned alternative ('or simply drop the scale-specific case and keep the family/weight coverage')"
  - "Left the --slide-font-scale EMISSION untouched in both cssVarsFor (source) and the typographyStyle prop plumbing — only the two scoped CSS rules that READ the variable via calc() were changed to a plain 13px; Plan 05 owns removing the emission"
  - "EditSlideDrawer.test.ts required no changes — no existing assertion in that file depended on --slide-font-scale, confirmed by grep before editing"

requirements-completed: [R329]

coverage:
  - id: D1
    description: "SlideCard's Slides-grid card body renders at a fixed 13px base font-size, no longer multiplied by var(--slide-font-scale); font-weight and family inheritance unchanged"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#slide-font CSS variables (46-04, R093) — family/weight coverage passes with no --slide-font-scale assertion"
        status: pass
    human_judgment: false
  - id: D2
    description: "EditSlideDrawer's preview renders at a fixed 13px base font-size, no longer multiplied by var(--slide-font-scale); font-weight and family inheritance unchanged"
    requirement: "R329"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts (172 tests, no regression)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Neither editor surface references var(--slide-font-scale) in its scoped CSS any longer — Plan 05 can delete the variable's emission without stranding a calc() on an undefined value"
    requirement: "R329"
    verification:
      - kind: other
        ref: "grep -n 'slide-font-scale' src/components/slides/SlideCard.vue src/components/slides/EditSlideDrawer.vue → no matches in the scoped <style> blocks"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-09-04
status: complete
---

# Phase 115 Plan 04: Editor Surfaces — Fixed-Base Font Size Summary

**Migrated SlideCard.vue and EditSlideDrawer.vue off the discrete `--slide-font-scale` multiplier to a fixed 13px base, removing the last two non-SlideCanvas readers of that variable so Plan 05 can delete it cleanly.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-04T05:00Z (approx)
- **Completed:** 2026-09-04T05:22:39Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 source, 1 test)

## Accomplishments
- `SlideCard.vue`'s scoped `[data-testid='slide-card-body']` font-size changed from `calc(13px * var(--slide-font-scale))` to a plain `13px`; `font-weight: var(--slide-font-weight)` and the family inheritance (via `typographyStyle`) are untouched.
- `EditSlideDrawer.vue`'s scoped `[data-testid='drawer-preview-text']` font-size changed the same way; the drawer's `cssVarsFor` emission (which still SETS `--slide-font-scale` for now) is deliberately left alone — this task only stops READING it.
- `SlideCard.test.ts`'s two `--slide-font-scale`-specific assertions (default-scale-1 and non-default-1.25 cases) were removed; the surrounding family/weight coverage (`--slide-font-family`, `--slide-font-weight: 400/600`) is preserved and still passes.
- `EditSlideDrawer.test.ts` needed no changes — grepped first and confirmed no existing assertion depended on the variable.
- Full verification: `npm run type-check` (vue-tsc --build) clean; `npx vitest run` shows 185/186 files passing with the single documented baseline failure (`src/storage.rules.test.ts`, Storage-emulator environment limitation) — no new regressions (5037 passed, 27 skipped).

## Task Commits

Each task was committed atomically:

1. **Task 1: SlideCard — fixed-base card body font-size (drop the --slide-font-scale multiplier)** - `ccdf113a` (feat)
2. **Task 2: EditSlideDrawer — fixed-base preview font-size (drop the --slide-font-scale multiplier)** - `39a0db9e` (feat)

## Files Created/Modified
- `src/components/slides/SlideCard.vue` - scoped card-body font-size is now a fixed `13px`; comment updated to note the manual multiplier is retired.
- `src/components/slides/__tests__/SlideCard.test.ts` - dropped the two `--slide-font-scale` assertions; kept family/weight coverage.
- `src/components/slides/EditSlideDrawer.vue` - scoped preview font-size is now a fixed `13px`; comment updated the same way.

## Decisions Made
- Dropped the scale-specific test assertions rather than asserting `getComputedStyle` font-size — verified experimentally that jsdom does not apply Vue SFC scoped `<style>` through `getComputedStyle` in this test harness (a real attempt returned `''`), so a computed-size assertion would be unreliable; the plan explicitly sanctioned dropping the case as the simpler alternative.
- Left the `--slide-font-scale` variable's EMISSION (in `cssVarsFor` and the `typographyStyle`/`previewTypographyStyle` props) fully intact in both files — this plan only removes the two `calc()` READERS, per the plan's explicit scope boundary with Plan 05.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>` blocks precisely, including the plan's own guidance to drop rather than rewrite the test assertions in Task 1, and the "no changes needed" outcome anticipated by Task 2's conditional wording ("if one exists, update it").

## Issues Encountered

None.

## User Setup Required

None — CSS-only editor changes, no new dependencies or external service configuration.

## Next Phase Readiness

- The two editor surfaces (SlideCard grid thumbnails, EditSlideDrawer preview) no longer reference `var(--slide-font-scale)` anywhere in their scoped styles.
- Combined with Plan 03 (SlideCanvas/output migration, separate wave) and this plan, all non-SlideCanvas-internal readers of the discrete scale multiplier are now migrated — Plan 05 can proceed to delete `SCALE_MAP`, `cssVarsFor`'s `--slide-font-scale` emission, the `fontScale` field on `slideTypography`, and the Settings UI's Size radios without stranding any reader on an undefined CSS variable.
- Verified green: `npm run type-check` clean; `npx vitest run` at the documented single-file baseline (`src/storage.rules.test.ts` only).

---
*Phase: 115-live-output-readability-layout*
*Completed: 2026-09-04*

## Self-Check: PASSED

All created/modified files confirmed on disk (SlideCard.vue, EditSlideDrawer.vue, SlideCard.test.ts, this SUMMARY.md); both task commit hashes (`ccdf113a`, `39a0db9e`) confirmed present in `git log`.
