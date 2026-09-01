---
phase: 105-presentation-blackout-inline-black-slide
plan: 02
subsystem: ui
tags: [vue, slide-rendering, lyric-editor, tailwind]

# Dependency graph
requires:
  - phase: 105-01
    provides: "LyricSection.kind?: 'lyric'|'blackout', BlackoutSlide/SlideContentKind, addSection(..., 'BLACKOUT'), buildSectionRows numbering exclusion, slideContentLabel/slideBodyText/slideFooterLabel blackout copy"
provides:
  - "SlideCanvas.vue blackout render branch — a text-free presentation-blackout marker, currentBackgroundUrl forced null for blackout (T-105-03), audio unconditional on kind"
  - "SongLyricEditor.vue 'Black Slide' add-chip (add-section-chip-blackout) and blackout row chrome (swatch/caption collapsed, calm placeholder expanded, incl. repeat)"
  - "SlideCard.vue blackout preview pane (bg-black, centered 'Solid black' caption)"
affects: [105-03-render-and-runcontrol]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A per-kind render branch that renders NOTHING (an aria-hidden marker element only) so the parent's existing bg-black shows through — the 'free by construction' pattern ARCHITECTURE.md prescribed for blackout across every SlideCanvas-consuming surface"
    - "isBlackout(row)/isBlackout computed predicates reading section.kind / slide.contentKind, gating template branches in-place rather than duplicating row/card markup"

key-files:
  created: []
  modified:
    - src/components/slides/SlideCanvas.vue
    - src/components/slides/__tests__/SlideCanvas.test.ts
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/SongLyricEditor.test.ts
    - src/components/slides/SlideCard.vue
    - src/components/slides/__tests__/SlideCard.test.ts

key-decisions:
  - "currentBackgroundUrl checks contentKind === 'blackout' FIRST, ahead of suppressBackground/video — a blackout slide never paints a background image/scrim regardless of a stale/crafted backgroundImageUrl (T-105-03), proven by a withBackground() fixture test."
  - "The blackout render branch emits an aria-hidden marker element (presentation-blackout) with NO text/content — the parent root's own bg-black (Audience/Confidence/PresentationViewer all already paint one) is the entire visible result, matching ARCHITECTURE.md's 'render NOTHING' instruction."
  - "Audio/video blocks stay unconditional on slideKind — a bed track under a black interlude slide is intended per UI-SPEC, verified by a blackout+audioUrl fixture asserting presentation-audio still mounts."
  - "SongLyricEditor's expanded-repeat branch for a blackout row renders the SAME calm placeholder panel as a non-repeat expanded blackout row (not the generic row-shared-text box), so a duplicated blackout row never shows an empty-looking shared-text panel."

requirements-completed: [R302, R303, R304]

coverage:
  - id: D1
    description: "SlideCanvas renders a blackout slide as pure solid black: a presentation-blackout marker, no presentation-body, no presentation-background/scrim even with a resolved backgroundImageUrl, and audio still mounts when audioUrl is present"
    requirement: R303
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCanvas.test.ts#blackout: renders presentation-blackout with NO body/background/scrim"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCanvas.test.ts#blackout: still mounts presentation-audio when audioUrl is present"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Song Lyrics editor's add-section row shows a 7th 'Black Slide' chip; clicking it inserts a first-class blackout row (kind:'blackout', lines:[]), auto-expanded, persisting through autosave with no new service section"
    requirement: R302
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#the add row shows a 7th \"Black Slide\" chip after the six quick-add chips"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#clicking the Black Slide chip inserts a blackout row (kind blackout, lines []), auto-expanded, with NO new service section"
        status: pass
    human_judgment: false
  - id: D3
    description: "A blackout row shows distinct non-empty chrome (black swatch + 'Solid black — no text or image' caption + 'no text' collapsed; a calm 'renders solid black' placeholder panel expanded, including for a repeated blackout row) and NO textarea/split UI"
    requirement: R302
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#a collapsed blackout row shows the black swatch + caption and \"no text\", no lyric preview"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#an expanded blackout row shows the calm placeholder panel, no textarea, no split UI"
        status: pass
    human_judgment: false
  - id: D4
    description: "Drag-reorder, Duplicate, and Remove work on a blackout row via the existing pure helpers/confirm dialog, and inserting a blackout between lyric rows does not renumber them (R304)"
    requirement: R304
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#Duplicate and Remove work on a blackout row via the existing controls"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#inserting a blackout between two lyric rows does not renumber them (R304)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The read-only Slides-tab card shows BLACKOUT content label, centered 'Solid black' body caption, 'Black Slide' footer, and a bg-black preview pane for a blackout slide only"
    requirement: R303
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#shows BLACKOUT / Solid black / Black Slide labels"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#renders a bg-black preview pane (in place of the default bg-gray-950/40)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-01
status: complete
---

# Phase 105 Plan 02: Blackout Rendering + Authoring UI Summary

**A per-kind SlideCanvas branch that renders nothing (parent's black shows through, background/scrim forced null), a 7th "Black Slide" add-chip + distinct-chrome row in the Song Lyrics editor, and a bg-black SlideCard preview — all consuming Plan 01's `contentKind: 'blackout'` directly.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-01T02:29:00Z (approx.)
- **Completed:** 2026-09-01T02:39:00Z (approx.)
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments
- `SlideCanvas.vue` gained a `slideKind === 'blackout'` template branch rendering a `data-testid="presentation-blackout"` `aria-hidden` marker with no content, and `currentBackgroundUrl` now short-circuits to `null` for a blackout slide ahead of `suppressBackground`/video checks — so no background image or scrim ever paints regardless of a stale/crafted `backgroundImageUrl` (T-105-03). Audio/video wiring is untouched (unconditional on kind), so a bed track still plays under a black interlude. This is consumed by Audience, Confidence, and the in-app preview by construction (all three mount `SlideCanvas`).
- `SongLyricEditor.vue` gained a 7th `Black Slide` add-chip (`add-section-chip-blackout`, styled identically to the six `ADD_SECTION_KINDS` chips) calling `onAddSection('BLACKOUT')`, plus a `isBlackout(row)` predicate gating three template swaps: the collapsed preview/line-count (black swatch + "Solid black — no text or image" caption / "no text"), the expanded body (a calm `bg-black` placeholder panel instead of the textarea+split block), and the expanded-repeat body (the same calm placeholder instead of the generic empty-looking `row-shared-text` box). Drag/Duplicate/Remove are untouched — a blackout row is first-class for all of them.
- `SlideCard.vue` gained an `isBlackout` computed swapping the preview pane's `bg-gray-950/40` for `bg-black` and centering the existing `slide-card-body` caption (already resolving to `'Solid black'` via the 105-01 display helper) instead of the left-aligned, top-padded, line-clamped lyric layout. `contentLabel`/`footerLabel` already resolved to `BLACKOUT`/`Black Slide` — no extra binding needed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Render a blackout slide as pure black in SlideCanvas** - `07210f2b` (feat)
2. **Task 2: Insert black slide + blackout row in the Song Lyrics editor** - `7b4e4b03` (feat)
3. **Task 3: Blackout preview in the read-only Slides-tab card** - `a9d1ddd3` (feat)

_No separate RED/GREEN/REFACTOR commits — Tasks 1 and 3 (`tdd="true"`) had their tests and implementation authored together and verified passing before commit, consistent with how 105-01 and other TDD-flagged plans in this codebase have committed._

## Files Created/Modified
- `src/components/slides/SlideCanvas.vue` - blackout branch (`presentation-blackout` marker) in the per-kind `v-else-if` chain; `currentBackgroundUrl` forced null for blackout; `CardKind` widened
- `src/components/slides/__tests__/SlideCanvas.test.ts` - `blackoutSlide()` fixture builder + 2 new tests (no body/background/scrim; audio still mounts)
- `src/components/SongLyricEditor.vue` - `Black Slide` add-chip; `isBlackout(row)` helper; collapsed-row swatch/caption/no-text branch; expanded calm-placeholder branch (non-repeat and repeat)
- `src/components/__tests__/SongLyricEditor.test.ts` - updated the existing 6-chip assertion to 7; new `describe('blackout (Black Slide) row')` block (6 tests: chip presence, insert+autosave shape, collapsed chrome, expanded placeholder, duplicate/remove, no-renumbering)
- `src/components/slides/SlideCard.vue` - `isBlackout` computed; conditional preview-pane background class; centered body-caption branch for blackout
- `src/components/slides/__tests__/SlideCard.test.ts` - new `describe('blackout')` block (3 tests: labels, bg-black pane, non-blackout pane unaffected)

## Decisions Made
- `currentBackgroundUrl`'s blackout check is placed FIRST in the computed (ahead of `suppressBackground` and the video check) — the threat model's T-105-03 mitigation is structural, not incidental: a blackout slide can never paint a background no matter what other flags/fields it happens to carry.
- The blackout branch in `SlideCanvas.vue` renders a marker element rather than truly nothing, so a test can assert the branch was taken without asserting on absence-of-everything; the marker itself has no visible content (`aria-hidden`, empty), so it does not violate "renders NOTHING" visually.
- Kept `onAddSection`'s existing signature (`kind: string`) — `'BLACKOUT'` flows through unchanged since 105-01 already special-cased it inside `addSection`; no new prop/emit was needed on the editor side.
- The expanded-REPEAT blackout branch was added as its own `v-else-if` (not folded into the existing repeat's `row-shared-text` branch) so a duplicated blackout row's placeholder text/styling stays byte-identical to a non-repeat expanded blackout row, per the plan's explicit instruction that a repeat "never reads as broken."

## Deviations from Plan

None — plan executed exactly as written. One pre-existing test (`the add row renders the six quick-add chips...`) needed its expected chip list extended from six to seven entries, which is the direct, expected consequence of Task 2's chip addition rather than a deviation — updated in the same commit as the feature it tests.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three render/authoring surfaces named in the plan (`SlideCanvas.vue`, `SongLyricEditor.vue`, `SlideCard.vue`) are done, unit-tested, and type-clean.
- Print/export (`ServicePrintLayout.vue`) requires no change per the plan's verification note — it renders section/song/scripture references only, never slide bodies, confirmed unchanged in this plan (no edit made to that file).
- `npm run type-check` (vue-tsc --build, typechecks tests) is clean. The three scoped test files (`SlideCanvas.test.ts`, `SongLyricEditor.test.ts`, `SlideCard.test.ts`) total 144 passing tests. A full `npx vitest run` shows exactly the two pre-existing baseline failures called out in CLAUDE.md (`src/storage.rules.test.ts`, `src/stores/appConfig.test.ts`) — no new failures introduced.
- 105-03 (per git log, already executed in this same session on a separate plan track — "Go to black" → Audience-only, R305) is independent of this plan's file set; no coordination needed between them.

---
*Phase: 105-presentation-blackout-inline-black-slide*
*Completed: 2026-09-01*

## Self-Check: PASSED

All 6 modified files verified present on disk; all 3 task commit hashes (07210f2b, 7b4e4b03, a9d1ddd3) verified present in git history.
