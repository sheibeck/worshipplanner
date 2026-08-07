---
phase: 42-powerpoint-rendered-image-display
plan: 06
subsystem: ui

tags: [vue, slides-tab, grid, tailwind, accessibility]

# Dependency graph
requires:
  - phase: 42-03
    provides: "SlideBase.renderState/renderFailureReason fields and the reconciler's pending/failed content shapes"
provides:
  - "RENDER_FAILURE_SENTENCES / RENDER_FAILURE_FALLBACK_SENTENCE / renderFailureSentence — the one sanctioned route from a raw PptxRenderDoc failureReason slug to human prose"
  - "SlideCard.vue's grid tile pending and failed states (slide-card-render-pending / slide-card-render-failed), branch-ordered ahead of the image/body paths"
affects: [42-07, 42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static Record<string, string> lookup with an explicit fallback arm for an open backend value space (mirrors KIND_BADGE_CLASSES/slideActionMenuItems' default arm)"
    - "v-if/v-else-if branch ordering as the structural guarantee that a render-state slide never falls through to drawable content"

key-files:
  created: []
  modified:
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/slides/SlideCard.vue
    - src/components/slides/__tests__/SlideCard.test.ts

key-decisions:
  - "The failure-sentence table implements the UI-SPEC's copywriting contract exactly as approved: two mapped slugs plus a generic fallback. It deliberately does not map incomplete-render (the render trigger's most common failure outcome) — flagged for the owner as a candidate copy improvement rather than changed unilaterally."
  - "The failed tile's red tint is applied to an inner wrapper div that fills the preview box (h-full w-full), not to the preview box's own class list — visually and structurally equivalent containment (never bleeds into the card's outer border), chosen so the box element hosting all four v-if branches and the overlay badges stays untouched."

patterns-established:
  - "renderFailureSentence is documented as the ONLY legal consumer of SlideBase.renderFailureReason — any future rendering of that field must route through it."

requirements-completed: [R080]

coverage:
  - id: D1
    description: "renderFailureSentence maps failureReason slugs to one of exactly three authored sentences, with a fallback arm covering unmapped/future values (including incomplete-render) and hostile input"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#renderFailureSentence"
        status: pass
    human_judgment: false
  - id: D2
    description: "Grid tile shows an explicit pending state (indigo spinner + 'Rendering…') with no image or body element drawn"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#render-pending state (R080)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Grid tile shows an explicit failed state with the mapped failure sentence (never the raw slug) and no image or body element drawn"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#render-failed state (R080)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Overlay badges (content-label, slide-number) remain visible and correctly positioned on pending and failed tiles"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#keeps the content-label and slide-number overlay badges visible"
        status: pass
    human_judgment: true
    rationale: "The plan's must_haves flags exact overlay-badge legibility/positioning as a held-out backstop visual check (42-UI-SPEC.md's one unresolved cell) — the unit test proves presence and text content but not pixel-level layering, which requires human visual verification recorded in .planning/PENDING-VERIFICATION.md via 42-08."
  - id: D5
    description: "A slide with no renderState renders byte-identically to today (object-contain, no object-cover, existing image/body branches unchanged)"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideCard.test.ts#renders no render-state tile for a slide with no renderState"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-08-07
status: complete
---

# Phase 42 Plan 06: Grid Tile Pending/Failed Render States Summary

**Added the grid's two explicit R080 states — an indigo "Rendering…" pending tile and a red "Render failed" tile with a mapped human sentence — plus the one sanctioned `slideDisplay.ts` lookup that turns any `failureReason` slug into one of three authored sentences.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-07T10:22:00Z (approx.)
- **Completed:** 2026-08-07T11:17:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `RENDER_FAILURE_SENTENCES` / `RENDER_FAILURE_FALLBACK_SENTENCE` / `renderFailureSentence` added to `slideDisplay.ts`, following `KIND_BADGE_CLASSES`'s literal-`Record` shape — structurally bounds any backend-supplied `failureReason` to one of three authored sentences, proven over a list of hostile/unexpected inputs (empty string, markup, an unmapped real backend value, SQL-injection-shaped text).
- `SlideCard.vue`'s preview box gained two new branches — `slide-card-render-pending` and `slide-card-render-failed` — inserted as `v-if`/`v-else-if` ahead of the existing `isImage`/body-text branches, so a render-state slide structurally cannot fall through to a broken `<img>` or stale parsed text.
- Both new decorative icons (spinner, warning triangle) carry `aria-hidden="true"`; `object-cover` appears nowhere in the file; overlay badges (content-label, slide-number) stay layered above all four branches.
- 15 new test cases added (7 in `slideDisplay.test.ts`, 8 in `SlideCard.test.ts`) covering the mapping table, the fallback arm, both new tile states, an unmapped-reason case, an absent-reason case, overlay-badge presence in both states, and the unchanged no-`renderState` path.

## Task Commits

Each task was committed atomically:

1. **Task 1: The failure-sentence lookup** - `ee52629` (feat)
2. **Task 2: The grid tile's pending and failed states** - `f2e7866` (feat)

**Plan metadata:** _pending — final commit below_

## Files Created/Modified
- `src/components/slides/slideDisplay.ts` - `RENDER_FAILURE_SENTENCES`, `RENDER_FAILURE_FALLBACK_SENTENCE`, `renderFailureSentence`
- `src/components/slides/__tests__/slideDisplay.test.ts` - `renderFailureSentence` describe block (7 new tests)
- `src/components/slides/SlideCard.vue` - `renderState`/`renderPending`/`renderFailed`/`renderFailureCopy` computeds, two new preview-box branches ordered ahead of `isImage`
- `src/components/slides/__tests__/SlideCard.test.ts` - new pending/failed describe blocks plus a no-`renderState` byte-identical regression test (8 new tests)

## Decisions Made
- The failure-sentence table maps exactly the two slugs the UI-SPEC's copywriting contract names (`missing-render-doc`, `missing-storage-path`); `incomplete-render` — the render trigger's own most common failure outcome (`functions/src/index.ts:411-415`) — is deliberately left unmapped, routing through the generic fallback per the plan's recorded decision. Not changed unilaterally since the UI-SPEC is an approved design contract; flagged as a candidate copy improvement for the owner.
- The failed tile's red tint (`bg-red-950/20 border border-red-900/40`) is applied to the new inner wrapper `div` that fills the preview box, rather than conditionally on the preview box element itself. Both achieve the UI-SPEC's "contained to this tile only, never bleeding into the card's outer border" requirement identically; this form keeps the box element (which also hosts the overlay badges and all four branches) untouched by conditional classing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The grid now has all three R080 states (ready/pending/failed) covered; 42-07 (presenter surface) can proceed using the same `renderFailureSentence` lookup.
- The overlay-badge legibility/positioning check remains a held-out visual verification (42-UI-SPEC.md's one backstop cell) — not marked passed here; to be recorded in `.planning/PENDING-VERIFICATION.md` via 42-08.
- Full test baseline unchanged: `npx vitest run` reports 3 failing files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`, `render-service/src/render.test.ts`), all pre-existing per CLAUDE.md's documented baseline — no new regressions. `npm run type-check` reports 0 errors.

---
*Phase: 42-powerpoint-rendered-image-display*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 4 modified/created source files and both task commit hashes (ee52629, f2e7866) verified present.
