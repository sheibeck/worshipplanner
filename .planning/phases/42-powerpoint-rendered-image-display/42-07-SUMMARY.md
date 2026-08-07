---
phase: 42-powerpoint-rendered-image-display
plan: 07
subsystem: ui

tags: [vue, presenter, presentation-viewer, tailwind, accessibility]

# Dependency graph
requires:
  - phase: 42-03
    provides: "SlideBase.renderState/renderFailureReason fields"
  - phase: 42-06
    provides: "renderFailureSentence — the one sanctioned route from a raw failureReason slug to human prose"
provides:
  - "PresentationViewer.vue's presenter-surface pending and failed states (presentation-render-pending / presentation-render-failed), branch-ordered ahead of the per-kind chain, with the never-skip navigation guarantee proven by test"
affects: [42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "v-if/v-else-if branch ordering as the structural guarantee that a render-state slide never falls through to drawable content (same pattern as 42-06's SlideCard.vue)"
    - "Amber, not red, for a congregation-facing failure state — reuses the component's existing videoMutedPlaying soft-caution vocabulary (bg-amber-900/40-family) rather than introducing a new alarm register"

key-files:
  created: []
  modified:
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts

key-decisions:
  - "The failed state's icon uses h-8 w-8 text-amber-300 (a small icon per the UI-SPEC's wording) rather than reusing the pending state's h-10 w-10 spinner size — both are decorative, aria-hidden, and paired with a heading of the identical text-4xl font-semibold size/weight, so 'never visually louder' is satisfied at the text level, which is what a congregation actually reads; the icon itself is not the size the spec's 'same size and layout' language is protecting."
  - "hasSlides/currentSlide/atFirst/atLast/progressLabel were read, not modified — confirmed both by a targeted git diff grep (no change to their declarations) and by three new navigation test cases that drive prev/next across pending, failed and all-pending decks."

patterns-established:
  - "currentRenderState / currentRenderFailureSentence are the presenter's own copies of the same shape SlideCard.vue's renderPending/renderFailed/renderFailureCopy computeds already established in 42-06 — both surfaces read through the same renderFailureSentence function, never a second lookup."

requirements-completed: [R080]

coverage:
  - id: D1
    description: "A pending current slide renders presentation-render-pending with the rendering heading and neither presentation-image nor presentation-body"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#render-pending and render-failed canvas states (R080/D-15) > a pending current slide renders presentation-render-pending..."
        status: pass
    human_judgment: false
  - id: D2
    description: "A failed current slide renders presentation-render-failed with the mapped caption and neither presentation-image nor presentation-body; an unmapped renderFailureReason never reaches the DOM"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#render-pending and render-failed canvas states (R080/D-15) > a failed current slide renders... / a failed slide with an unmapped renderFailureReason..."
        status: pass
    human_judgment: false
  - id: D3
    description: "The pending and failed headings share the same text-4xl font-semibold size/weight — failed is never visually louder"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#render-pending and render-failed canvas states (R080/D-15) > the pending and failed headings share the same..."
        status: pass
    human_judgment: false
  - id: D4
    description: "A slide with no renderState and contentKind image renders presentation-image byte-identically to today"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#render-pending and render-failed canvas states (R080/D-15) > a slide with no renderState..."
        status: pass
    human_judgment: false
  - id: D5
    description: "The presenter never skips a pending or failed slide: it is counted in progressLabel's n/m, reached by next (not jumped over), and re-reached by prev — proven for pending, for failed, and for an all-pending deck (which must never fall into the empty state)"
    requirement: "R080"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#never skips a pending or failed slide (R080/D-15)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The 'looks like it did in PowerPoint' visual-fidelity check, and the presenter's actual on-screen dignified-vs-alarming register, are jsdom-unreachable and remain a deferred manual check"
    requirement: "R080"
    verification: []
    human_judgment: true
    rationale: "42-07-PLAN.md's own <verification> section names this as deferred to 42-08, never marked passed — jsdom has no rendering, so the amber-vs-red visual register and pillarboxing behavior can only be confirmed by eye against a real deck."

duration: 40min
completed: 2026-08-07
status: complete
---

# Phase 42 Plan 07: Presenter Pending/Failed Render States Summary

**Added the presenter's two explicit R080 states — an indigo "This slide is still rendering." pending block and an amber "This slide couldn't be rendered." failed block with the same mapped caption the grid uses — and proved by test that neither state removes a slide from `props.slides`, `hasSlides`, `atFirst`, `atLast` or the `n / m` progress count.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-07T10:48:00Z (approx.)
- **Completed:** 2026-08-07T11:28:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `currentRenderState` (`'pending' | 'failed' | null`) and `currentRenderFailureSentence` computeds added to `PresentationViewer.vue`, the latter routed through `renderFailureSentence` imported from `./slides/slideDisplay` (42-06) — the presenter never has its own second copy of the failure-slug mapping.
- Two new branches — `presentation-render-pending` and `presentation-render-failed` — inserted as the FIRST entries of the `presentation-slide` canvas's branch chain (`v-if`/`v-else-if`), with the existing `slideKind === 'lyric'` branch demoted to `v-else-if`. Ordering is the structural guarantee: a render-state slide cannot fall through to a broken `<img>` or stale parsed text.
- Failed state uses `amber-300` (not red) per the UI-SPEC's recorded discretionary decision — reusing the same soft-caution vocabulary the component's existing `videoMutedPlaying` chip already established. Both headings share `text-4xl font-semibold text-gray-100`; failed is never visually louder than pending.
- Both decorative icons (spinner, warning) carry `aria-hidden="true"` (`aria-hidden="true"` count in the file went from 0 to 2, matching the acceptance criterion).
- `hasSlides`, `currentSlide`, `atFirst`, `atLast`, `progressLabel`, the prev/next handlers, and the bottom chrome bindings are all unchanged — verified both by `git diff` inspection and by 3 new navigation test cases (Task 2).
- 8 new test cases: 5 for Task 1 (pending absence-of-image/body, failed with mapped caption, unmapped-reason fallback with a raw-slug absence assertion, same-size headings, no-renderState byte-identical regression) and 3 for Task 2 (pending in the middle position never skipped by next/prev, failed in the same position, an all-pending three-slide deck that must never reach `presentation-empty-state`).

## Task Commits

Each task was committed atomically:

1. **Task 1: The presenter's pending and failed canvas states** - `28bbb70` (feat)
2. **Task 2: Prove the presenter never skips a pending or failed slide** - `015a4b1` (test)

**Plan metadata:** _pending — final commit below_

## Files Created/Modified
- `src/components/PresentationViewer.vue` - `currentRenderState`/`currentRenderFailureSentence` computeds, two new canvas branches ordered ahead of the per-kind chain, `renderFailureSentence` import
- `src/components/__tests__/PresentationViewer.test.ts` - `withRenderState` fixture helper, "render-pending and render-failed canvas states (R080/D-15)" describe block (5 tests), "never skips a pending or failed slide (R080/D-15)" describe block (3 tests)

## Decisions Made
- The failed state's icon is `h-8 w-8` (smaller than the pending spinner's `h-10 w-10`) per the UI-SPEC's "small `amber-300` icon" wording — the "never visually louder" guarantee is enforced at the heading level (identical `text-4xl font-semibold` on both states), which is what a congregation actually reads; the icon's own size is not what the spec's "same size and layout family" language is protecting against.
- `withRenderState` composes with the existing `withoutSection` fixture helper in the navigation tests — `imageSlide`'s default `section: 'pre-service'` would otherwise prefix the progress pill (`"Pre-Service · 1 / 3"`), which is unrelated noise for assertions specifically about the `n / m` count.

## Deviations from Plan

None — plan executed exactly as written. The one implementation choice not fully pinned by the plan (failed-icon size) is recorded above as a decision, not a deviation, since the UI-SPEC's own wording ("a small icon") left it underspecified rather than contradicted.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both R080 surfaces (grid from 42-06, presenter from this plan) now share the one `renderFailureSentence` lookup — a future backend `failureReason` addition needs no client change beyond that one function.
- The "looks like it did in PowerPoint" visual-fidelity check and the amber-vs-red on-screen register remain jsdom-unreachable, deferred to 42-08 per this plan's own `<verification>` section — never marked passed here.
- Full test baseline unchanged: `npx vitest run --dir src --exclude '**/rules.test.ts'` reports 2 failing files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), both pre-existing per CLAUDE.md's documented baseline — 2704 passing, no new regressions. `npm run type-check` reports 0 errors.

---
*Phase: 42-powerpoint-rendered-image-display*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 2 modified source files and both task commit hashes (28bbb70, 015a4b1) verified present.
