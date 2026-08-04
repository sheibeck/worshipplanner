---
phase: 34-smarter-content-llm-scripture-split
plan: 09
subsystem: ui
tags: [vue, presentation, backgrounds, requirements]

# Dependency graph
requires:
  - phase: 33-backgrounds-and-slide-editing
    provides: SlideBase.backgroundImageUrl / backgroundSource, resolveEntryMedia's slide -> group -> song cascade
provides:
  - "R070: a NEW requirement in REQUIREMENTS.md covering background display at presentation time"
  - "PresentationViewer.vue renders the already-resolved background image behind a fixed scrim, never on a video slide"
affects: [35-presentation-correctness, 36-ui-rework]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentation-surface consumers read one already-resolved field and never re-derive an upstream cascade (mirrors R059/R061's read-only relationship to the assembler)"
    - "Negative inline z-index siblings inside an existing stacking-context root, used to insert a background layer with zero changes to sibling markup/classes"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts

key-decisions:
  - "R070 written as a NEW requirement rather than folded under R055/R056 — those requirements only ever described SETTING a background; Phase 33 verified green with display never asked for"
  - "currentBackgroundUrl reads only currentSlide.slide.backgroundImageUrl and returns null whenever currentVideoUrl is truthy — no group/song lookup, no branch on backgroundSource, enforced by a negative grep acceptance criterion"
  - "CSS background-image (not <img>) so a failed load paints nothing and leaves the black canvas and every word intact — no error path to build"
  - "Scrim is a fixed bg-black/50, matching the existing bg-black/60 scrim family in ServiceEditorView.vue's export dialog — no per-image analysis, no user control"

patterns-established:
  - "A media field resolved once upstream by the assembler is consumed as a single value by every downstream renderer — never re-derived, per the two-disagreeing-fields defect class already hit twice (Phase 28 performanceOrder, Phase 33 partial cascade)"

requirements-completed: [R070]

coverage:
  - id: D1
    description: "R070 requirement text, traceability row, and ROADMAP Requirements line added to the planning record before implementation"
    requirement: R070
    verification:
      - kind: other
        ref: "grep -c R070 .planning/REQUIREMENTS.md (4), grep -c R070 .planning/ROADMAP.md (4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A group/slide-sourced resolved background renders on the Present screen behind a fixed scrim, never on a video slide, and never breaks slide text or congregational sections"
    requirement: R070
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#background rendering (R070, UAT F3)"
        status: pass
    human_judgment: true
    rationale: "Whether the 50% scrim opacity reads correctly on a real projector against a real photograph is a perceptual judgment jsdom cannot make (per the plan's own objective) — recorded as a PENDING-VERIFICATION item, not self-approved here."

# Metrics
duration: 25min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 09: Render the resolved background on the Present screen Summary

**Added R070 to REQUIREMENTS.md/ROADMAP.md, then wired `PresentationViewer.vue`'s `currentBackgroundUrl` computed and a scrim layer so a group/slide background set in the Slides tab now appears while presenting — closing owner UAT finding F3.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-03T19:56:00Z
- **Completed:** 2026-08-04T00:00:00Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- Wrote the missing requirement (R070) into `.planning/REQUIREMENTS.md` — unchecked, in the Backgrounds and Media section after R058, with the derivation ("R055/R056 only ever described SETTING a background") stated in the entry itself — plus its Traceability row and the ROADMAP Phase 34 Requirements line
- `grep backgroundImageUrl src/components/PresentationViewer.vue` no longer returns zero matches — the exact defect `34-UAT.md` F3 named is closed
- The viewer consumes the single already-resolved `slide.backgroundImageUrl`/`backgroundSource` cascade with zero re-derivation (verified by a negative grep acceptance criterion covering `groupsBySlotId`/`SongLyrics`/`backgroundSource`)
- Video precedence is enforced in one place: `currentBackgroundUrl` returns `null` whenever `currentVideoUrl` is truthy
- 8 new tests cover: background+scrim rendering, unchanged slide text, absence when no background, video precedence, congregational compatibility, transition add/remove, transition url-swap, and both `backgroundSource` provenance cases — all 72 tests in the file pass, no pre-existing test modified

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the missing requirement into the record before implementing it** - `4d0ead8` (docs)
2. **Task 2: Render the resolved background on the Present screen, behind a scrim, never on a video slide** - `d44ee68` (test, RED) → `e6153e0` (feat, GREEN)

_TDD task: RED commit `d44ee68` added 8 failing tests against the not-yet-existing implementation; GREEN commit `e6153e0` added `currentBackgroundUrl` and the two template layers, turning all 8 green with no REFACTOR commit needed._

## Files Created/Modified
- `.planning/REQUIREMENTS.md` — new R070 entry, its Traceability row, and the updated coverage/phase-summary counts
- `.planning/ROADMAP.md` — Phase 34's Requirements line extended to `R064, R070`; Planning corrections note extended with the F3 requirements-gap sentence
- `src/components/PresentationViewer.vue` — `currentBackgroundUrl` computed; `presentation-background` and `presentation-background-scrim` template layers inserted as Teleport-root siblings with inline negative z-index
- `src/components/__tests__/PresentationViewer.test.ts` — `withBackground()` fixture-extension helper plus a `background rendering (R070, UAT F3)` describe block (8 tests)

## Decisions Made
- R070 recorded as a NEW requirement, not folded under R055/R056 — matches the plan's explicit instruction that this is a requirements gap, not a wiring bug, and the record must say so
- Kept the REQUIREMENTS.md "Coverage" summary line and the "Phase → requirement-count summary" table internally consistent (34→35 total, Phase 34 row now `R064, R070 (2)`) rather than leaving them stale — these are aggregate counts, not individual requirement entries, so updating them does not violate the plan's "no existing requirement's text/checkbox/traceability row altered" constraint
- Used a CSS `background-image` style binding rather than an `<img>` element, per the plan's explicit rationale: a failed load paints nothing rather than needing an error-state UI

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the negative-grep acceptance criteria (no `groupsBySlotId`/`SongLyrics`/`backgroundSource` in the viewer) passed on the first implementation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None — every threat in this plan's `<threat_model>` was `mitigate`d directly by the implementation (see Task 2's acceptance criteria: provenance-only read, negative z-index inside an existing stacking context, CSS background over `<img>`, video-precedence branch) or `accept`ed with existing precedent (the url interpolation pattern already used by `EditSlideDrawer.vue:84`). No new trust boundary was introduced.

## Next Phase Readiness
- `.planning/PENDING-VERIFICATION.md` should record the one open perceptual check this plan could not make in jsdom: whether the 50% scrim reads correctly on a real projector against a real background photograph — that item belongs to 34-08's phase-gate PENDING-VERIFICATION write, not self-approved here.
- 34-10 (UAT F4, sticky save-status bar), 34-11 (UAT F2, merge group music/background panels), and 34-12 (UAT F5, Export to PC diagnosis) remain open in this phase's wave-1/wave-3 plan list.
- No file under `src/utils/`, `src/components/slides/`, or `functions/` was touched; nothing deployed.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all 4 commits (`4d0ead8`, `d44ee68`, `e6153e0`, `b0345c9`) confirmed in git log.
