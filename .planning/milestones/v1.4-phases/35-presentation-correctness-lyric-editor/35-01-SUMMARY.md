---
phase: 35-presentation-correctness-lyric-editor
plan: 01
subsystem: ui
tags: [vue3, vitest, presentation, slides]

# Dependency graph
requires: []
provides:
  - "R059: PresentationViewer.vue no longer renders LyricSlide.sectionLabel on a projected slide"
  - "R061: SlidesTab.vue computes a presentStartIndex (selected slide → selected group's first slide → 0) and carries it on the widened present emit"
  - "R061: PresentationViewer.vue accepts an optional initialIndex prop, clamped with the existing length-change-watcher formula, seeding currentIndex at mount"
  - "R061: ServiceEditorView.vue threads SlidesTab's present payload into PresentationViewer via a presentStartIndex ref and onPresent(startIndex) handler"
affects: [35-02, 35-03, 35-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Selection → flat-deck-index resolution via findIndex only, never parseInt/Number on an id string"
    - "Mount-time prop seeding a ref directly (not routed through the slide-change lifecycle function goToIndex())"

key-files:
  created: []
  modified:
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts
    - src/views/ServiceEditorView.vue

key-decisions:
  - "R059 was a one-block template deletion; the LyricSlide.sectionLabel field and both slideDisplay.ts grid consumers (:95, :143) were left untouched, confirmed by grep counts."
  - "R061's presentStartIndex is NOT added to SlidesTab's defineExpose — the present emit's payload is its entire public surface, matching the plan's explicit instruction; tests assert via wrapper.emitted('present') rather than reading the computed directly."
  - "PresentationViewer's initialIndex seed reuses the length-change watcher's clamp formula verbatim and is not routed through goToIndex(), since there is no outgoing slide to pause at mount."

patterns-established:
  - "presentStartIndex fallback ladder: selected slide's own flat index → selected group's first slide → 0, each rung falling through on a miss so a stale selection degrades quietly instead of throwing."

requirements-completed: [R059, R061]

coverage:
  - id: D1
    description: "A projected lyric slide renders lyrics only — no organizational sectionLabel; scripture references and text-slide titles still render via the same presentation-label testid, untouched."
    requirement: "R059"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#R059: a LyricSlide renders no sectionLabel in presentation-label, and lines joined by newline in presentation-body"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#R059: a LyricSlide with an empty-string sectionLabel still renders no presentation-label element"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#a normal-mode ScriptureSlide renders reference in presentation-label and the FULL text in presentation-body"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#a TextSlide with a title renders it in presentation-label and body in presentation-body"
        status: pass
    human_judgment: false
  - id: D2
    description: "SlidesTab computes presentStartIndex (selected slide → selected group's first slide → 0, via findIndex only) and carries it as the present emit's payload."
    requirement: "R061"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts#presentStartIndex — present starts where you were looking (R061) (7 tests: selected slide, group-boundary slides, slot-only selection, nothing selected, stale-selection fallback ladder, differing group sizes, CTA-click payload)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PresentationViewer accepts an optional initialIndex prop, clamped identically to the existing length-change watcher, seeding currentIndex at mount; ServiceEditorView threads SlidesTab's present payload through to it."
    requirement: "R061"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#initialIndex — presenting starts where you were looking (R061) (6 tests: mid-deck seed, omitted-prop default, positive clamp, negative clamp, empty-deck safety, identical chrome mid-deck)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-08-03
status: complete
---

# Phase 35 Plan 01: Presentation Correctness — Lyric Label Removal & Present Start Index Summary

**Deleted the lyric-slide `sectionLabel` render in `PresentationViewer.vue` (R059) and threaded a `SlidesTab` → `ServiceEditorView` → `PresentationViewer` start-index chain so Present opens on the highlighted slide/group instead of always slide 0 (R061).**

## Performance

- **Duration:** 14 min (09:21:25 → 09:35:03)
- **Started:** 2026-08-03T09:21:25-04:00
- **Completed:** 2026-08-03T09:35:03-04:00
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments
- A congregation-facing lyric slide no longer shows the organizational label (`VERSE 1`, etc.) — confirmed by a source grep count of `presentation-label` occurrences in `PresentationViewer.vue` dropping from 3 to exactly 2 (the scripture reference and text-slide title, both untouched).
- `SlidesTab.vue` now computes a `presentStartIndex` from whatever is selected (slide, group, or nothing) and carries it as the `present` emit's payload — resolved via `findIndex` only, never by treating a slide id as a numeric position.
- `PresentationViewer.vue` accepts an optional `initialIndex` prop, seeded through the same clamp formula the existing length-change watcher already used, so pressing Present mid-deck opens the viewer directly on the slide the user was looking at.

## Confirmed occurrence counts (per the plan's own required reporting)

- `grep -c 'presentation-label' src/components/PresentationViewer.vue` → **2** (scripture branch's reference, text branch's title; the lyric branch's is gone).
- `grep -c 'sectionLabel' src/components/PresentationViewer.vue` → **0**.
- `grep -c 'sectionLabel' src/types/slide.ts` → **1** (the model field, untouched).
- `grep -c 'sectionLabel' src/components/slides/slideDisplay.ts` → **2** (both grid consumers, untouched).

## The seven `presentStartIndex` cases and their asserted indices

Fixture: three slots mapped to groups of differing slide counts (1, 4, 2 slides), flat deck order `[g0-0(0), g1-0(1), g1-1(2), g1-2(3), g1-3(4), g2-0(5), g2-1(6)]`.

| # | Case | Asserted index |
|---|------|-----------------|
| 1 | A selected slide (`g1-2`) resolves to its own flat index | `3` |
| 2 | Selected slide at a group's first (`g1-0`) / last (`g1-3`) position — no off-by-one | `1` / `4` |
| 3 | A slot selected, no slide within it — resolves to that group's first assembled slide | `1` |
| 4 | Nothing selected at all (no slots exist) | `0` |
| 5 | Stale `selectedSlideId`, group still valid → falls back to the group's first slide; group also gone → falls to `0` | `1` then `0` |
| 6 | Differing group sizes (1-slide group `g0-0`; 2-slide group's second slide `g2-1`) each map correctly | `0` / `6` |
| 7 | Clicking `present-slideshow-cta` emits `present` carrying the computed index as its sole payload | `3` (asserted via `wrapper.emitted('present')`) |

No copyright-emission code was added anywhere in this plan — R060 is out of this plan's scope (assigned to a sibling plan per the phase's wave structure), and nothing here touches `slideshowAssembler.ts` or `slideGroupMaterializer.ts`. R060's placement is not described as a licensing requirement anywhere in this plan's changes or this summary.

## Task Commits

Each task was committed atomically:

1. **Task 1: R059 — stop rendering the organizational label on a presented lyric slide** - `4221f9c` (feat)
2. **Task 2: R061 — compute the present start index in SlidesTab and carry it on the emit** - `d18d8f4` (feat)
3. **Task 3: R061 — thread the start index through ServiceEditorView into PresentationViewer** - `bc44c22` (feat)

_No TDD RED/GREEN/REFACTOR split — this plan's `tdd="true"` tasks were executed with tests and implementation committed together per task, matching the plan's own single-commit-per-task structure._

## Files Created/Modified
- `src/components/PresentationViewer.vue` - deleted the lyric branch's `presentation-label` block; added optional `initialIndex` prop seeding `currentIndex` at mount via the existing clamp formula
- `src/components/__tests__/PresentationViewer.test.ts` - inverted the sanctioned R059 assertion, added an empty-label case, fixed three navigation tests that used the removed label text as a slide-identity fingerprint, added a 6-test `initialIndex` describe block
- `src/components/slides/SlidesTab.vue` - added `presentStartIndex` computed and `onPresentClick()`; widened the `present` emit to carry the index
- `src/components/slides/__tests__/SlidesTab.test.ts` - added a 7-test `presentStartIndex` describe block; pre-existing Present-CTA/lock tests are byte-identical (additions-only diff, confirmed via `git diff`)
- `src/views/ServiceEditorView.vue` - added `presentStartIndex` ref and `onPresent(startIndex)` handler; bound `:initial-index` on `PresentationViewer`; changed `@present="presenting = true"` to `@present="onPresent"`

## Decisions Made
- Kept `presentStartIndex` off `SlidesTab`'s `defineExpose` as the plan directed; all seven new tests assert through `wrapper.emitted('present')` rather than reading the computed off the instance.
- Reused `PresentationViewer.vue`'s existing length-change-watcher clamp formula verbatim for the `initialIndex` seed rather than writing a second clamp expression, so the two agree by construction.
- Did not route the `initialIndex` seed through `goToIndex()` — that function's pause/reset/play lifecycle is for a slide change while already mounted; at mount there is no outgoing slide to pause.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug fallout from the sanctioned R059 change] Fixed three pre-existing tests that used the removed label text as a slide-identity fingerprint**
- **Found during:** Task 1 (R059 deletion)
- **Issue:** Three pre-existing tests unrelated to `presentation-label` itself (`'mounts with 3 slides...'`, `'ArrowLeft and Backspace go back'`, `'ArrowRight at the last index does not change...'`) asserted `slideText()).toContain('Verse 1')` purely as a proxy for "the lyric slide is currently showing" during navigation assertions — not testing the label. Deleting the label's render broke these three tests as a direct, unavoidable consequence of the correct R059 implementation; they were not anticipated by the plan's acceptance criteria (which described the diff as confined to the two `sectionLabel`-titled tests).
- **Fix:** Replaced the `'Verse 1'` fingerprint in these three tests with `'Amazing grace, how sweet the sound'` (the lyric body text, which the deletion leaves untouched) — an equally reliable slide-identity check that survives the label removal.
- **Files modified:** `src/components/__tests__/PresentationViewer.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/PresentationViewer.test.ts` — all 58 tests pass (before this fix: 55 passed, 3 failed with exactly this mismatch)
- **Committed in:** `4221f9c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fallout, Rule 1)
**Impact on plan:** Necessary to keep the suite green after the sanctioned R059 deletion; no scope creep — no test's assertion target changed, only the fingerprint text used to detect which slide is showing.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness

- `PresentationViewer.vue` and `SlidesTab.vue` are now stable for sibling plans 35-02/35-03/35-04, which do not touch these two files' R059/R061 surfaces (confirmed: this plan's full blast radius across all three task commits is exactly the five files declared in its `files_modified` frontmatter — `PresentationViewer.vue`, `PresentationViewer.test.ts`, `SlidesTab.vue`, `SlidesTab.test.ts`, `ServiceEditorView.vue` — nothing else).
- Full verification passed: `npm run type-check` (`vue-tsc --build`) exits 0; `npx vitest run src/` shows 2224 passed / 9 failed across 78 passed / 2 failed files, matching the documented non-defect baseline (`src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`, 9 tests / 2 files) exactly — no new regressions.
- `grep -rEin 'ccli (requires|mandates|requirement)|licen[cs]e requires' src/` returns 0 matches (P-01, confirmed).
- No blockers for Wave 2 (plans depending on this wave's completion).

## Self-Check: PASSED

All 5 declared files exist on disk; all 3 task commits (`4221f9c`, `d18d8f4`, `bc44c22`) are present in `git log --oneline --all`.

---
*Phase: 35-presentation-correctness-lyric-editor*
*Completed: 2026-08-03*
