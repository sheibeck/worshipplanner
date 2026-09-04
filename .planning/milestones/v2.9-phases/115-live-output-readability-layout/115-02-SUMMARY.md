---
phase: 115-live-output-readability-layout
plan: 02
subsystem: frontend
tags: [run-screen, filmstrip, layout, ui-polish, run-control]

# Dependency graph
requires: []
provides:
  - "deriveNextItemLabel(rows, currentSlotIndex) — pure helper in useRunControl.ts returning the title of the rail row after the active item, or null at end of service / pre-live / not-found"
  - "nextItemLabel — computed exposed from useRunControl, threaded into RunFilmstrip via RunControlView"
  - "RunFilmstrip.vue optional nextItemLabel prop + always-rendered run-filmstrip-endcap naming the next item (or end-of-service)"
  - "RunFilmstrip thumbs at w-48 (192px), THUMB_WIDTH kept in sync so the 1280x720 reference-stage transform still exactly fills the thumb"
  - "RunFilmstrip forced-visible scrollbar (overflow-x: scroll + non-overlay ::-webkit-scrollbar) + a pointer-events-none right-edge fade"
  - "RunPreviewPair even-split On-screen/Next-up grid (was a dominant lg:col-span-2-of-3 program pane)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure derivation over the shared RailRow[] rail model (deriveNextItemLabel mirrors the existing rail findIndex pattern used by positionLabel), kept module-level/exported so it is unit-testable without mounting the composable"
    - "Reference-stage width and its Tailwind thumb-width class kept explicitly in sync via a code comment cross-reference, since Tailwind's arbitrary-width class and the JS constant have no compile-time link"

key-files:
  created:
    - src/composables/__tests__/useRunControl.nextItemLabel.test.ts
  modified:
    - src/composables/useRunControl.ts
    - src/views/RunControlView.vue
    - src/components/run/RunFilmstrip.vue
    - src/components/run/__tests__/RunFilmstrip.test.ts
    - src/components/run/RunPreviewPair.vue
    - src/components/run/__tests__/RunPreviewPair.test.ts

key-decisions:
  - "deriveNextItemLabel placed as a module-level exported function (not nested inside useRunControl), matching the existing windowNameFor/urlForAssignment pattern — lets the test import and exercise it with plain RailRow[] arrays, no composable mount/mocking needed"
  - "RunPreviewPair moved from a 3-column grid (On-screen lg:col-span-2 / Next-up lg:col-span-1, a 2:1 split) to a 2-column even-split grid (lg:grid-cols-2, both panes default span-1) — simplest, most legible way to satisfy 'no longer the dominant 2/3 share'; exact ratio is explicitly Claude's-discretion per CONTEXT.md and tunable later during the batched hardware UAT"
  - "End-of-item cap copy is 'End of item' / 'Next: {title}' vs 'End of service' — plain text interpolation only ({{ }}), never v-html, per the plan's threat model (T-115-02)"
  - "Edge-fade div is pointer-events-none and purely decorative (a CSS gradient), so it never intercepts a thumb click at the right edge of the strip"

patterns-established:
  - "Rail-derived next-item label as the single source for any future 'what's coming up' UI (avoids each consumer recomputing its own rail-position lookup)"

requirements-completed: [R330, R331, R332]

coverage:
  - id: D1
    description: "deriveNextItemLabel returns the next row's title when a middle item is active; returns null at end-of-service (last item active), pre-live (currentSlotIndex null), and when the active slotIndex isn't found in rows"
    requirement: "R331"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useRunControl.nextItemLabel.test.ts (4 tests: middle-active, last-active->null, null-index->null, not-found->null)"
        status: pass
    human_judgment: false
  - id: D2
    description: "RunFilmstrip renders an always-present end cap naming the next item (interpolated) when nextItemLabel is set, and an end-of-service message with no injected next-name when it is null; thumbs carry the enlarged w-48 class; the existing array-index click-to-jump contract is unchanged"
    requirement: "R330, R331"
    verification:
      - kind: unit
        ref: "src/components/run/__tests__/RunFilmstrip.test.ts (7 tests: original emit contract + w-48 width + end-cap present/absent cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "RunPreviewPair no longer gives the On-screen pane the dominant lg:col-span-2 share; the blackout mirror and both under-current/under-next slots are unaffected"
    requirement: "R330"
    verification:
      - kind: unit
        ref: "src/components/run/__tests__/RunPreviewPair.test.ts (3 tests: reduced-share assertion + existing blackout-mirror cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The filmstrip scrollbar is forced visible (overflow-x: scroll + non-overlay ::-webkit-scrollbar) with an edge fade — visually verifiable only on real macOS hardware, deferred to the batched milestone-end UAT per plan"
    requirement: "R332"
    verification:
      - kind: manual
        ref: ".planning/v2.9-DEFERRED-VERIFICATION.md (batched hardware UAT, owner's real church Mac)"
        status: deferred
    human_judgment: true
---

# Phase 115 Plan 02: Run-Screen Readability — Next-Item Cap, Larger Thumbs, Even-Split Panes Summary

**Made the live Run/control screen readable at a glance: the On-screen (program) preview pane no longer dominates the layout (moved from a 2/3-share 3-column grid to an even 2-column split with Next-up), the in-item filmstrip thumbnails are 1.5x larger (w-32→w-48) while staying WYSIWYG via the same reference-stage scaling, the filmstrip always ends with a cap naming the next service item (or end-of-service), and the filmstrip's horizontal scrollbar is forced always-visible with a subtle edge fade so it survives macOS's overlay auto-hide.**

## Performance

- **Duration:** ~45 min (including a slow full-suite baseline verification run on this machine — 5037 tests, ~330s)
- **Completed:** 2026-09-04
- **Tasks:** 3 completed (all `type="auto"`; Task 1 was `tdd="true"`)
- **Files modified:** 7 (1 new test file, 6 modified: 3 source, 3 test)

## Accomplishments

- `deriveNextItemLabel(rows, currentSlotIndex)` — a pure, module-level exported helper in `useRunControl.ts` that finds the rail row whose `index === currentSlotIndex` and returns the *next* row's title, or `null` at end-of-service, pre-live, or when the active slot isn't found. Placed alongside the existing `windowNameFor`/`urlForAssignment` exported-pure-function pattern so it's testable with plain `RailRow[]` arrays — no composable mount needed.
- `nextItemLabel` computed added to `useRunControl`'s return object (next to `railRows`), reactively re-deriving as `railRows`/`currentSlotIndex` change. `RunControlView.vue` destructures it and binds `:nextItemLabel="nextItemLabel"` on `RunFilmstrip`.
- `RunFilmstrip.vue`: thumb width `w-32` (128px) → `w-48` (192px); `THUMB_WIDTH` constant moved from 128→192 in lockstep so `thumbStageStyle`'s `scale = THUMB_WIDTH / REFERENCE_WIDTH` still exactly fills the enlarged thumb box (no re-wrap, no letterbox). The old static `"Next item →"` span was replaced with an always-rendered `data-testid="run-filmstrip-endcap"` element reading `"End of item" / "Next: {{ nextItemLabel }}"` when present, or `"End of service"` when null — the next item's name renders via `{{ }}` text interpolation only (auto-escaped, never `v-html`), per the plan's threat model.
- `RunFilmstrip.vue` scroll container: `.filmstrip-scroll` now sets `overflow-x: scroll` (was `overflow-x-auto` on the template) plus `-webkit-appearance: none` on the `::-webkit-scrollbar` pseudo-element, opting the strip out of macOS's overlay auto-hide bar. A `pointer-events-none` `.filmstrip-edge-fade` gradient div sits over the right edge as a decorative "more content" cue and never intercepts thumb clicks.
- `RunPreviewPair.vue`: the outer grid moved from `grid-cols-1 lg:grid-cols-3` (On-screen `lg:col-span-2`, Next-up `lg:col-span-1` — a 2:1 dominant-program split) to `grid-cols-1 lg:grid-cols-2` (both panes default to a single, equal column) — an even split so the On-screen pane no longer crowds the filmstrip beneath it. Both panes keep their `aspect-video` scale-to-fit stages, the green/amber/blackout framing, and the `#under-current`/`#under-next` named slots exactly as before.
- Added `data-testid="run-current-pane"` / `data-testid="run-next-pane"` to the two pane wrapper divs so the reduced-share assertion in the test suite doesn't depend on fragile class-string matching elsewhere in the tree.

## Task Commits

Each task was committed atomically:

1. **Task 1: next-item label — pure deriveNextItemLabel + nextItemLabel computed + RunControlView wiring** - `db151b53` (feat)
2. **Task 2: RunFilmstrip — larger thumbs (R330), next-item end cap (R331), always-visible scrollbar + edge fade (R332)** - `934ae6ad` (feat)
3. **Task 3: RunPreviewPair — smaller On-screen pane (R330)** - `9a4493e2` (feat)

## Files Created/Modified

- `src/composables/useRunControl.ts` (modified) — exported `deriveNextItemLabel`; added `nextItemLabel` computed and return value.
- `src/composables/__tests__/useRunControl.nextItemLabel.test.ts` (new) — 4 unit tests over plain `RailRow[]` arrays covering every `deriveNextItemLabel` behavior bullet.
- `src/views/RunControlView.vue` (modified) — destructures `nextItemLabel`, binds it on `RunFilmstrip`; refreshed two stale comments describing the old column-share layout.
- `src/components/run/RunFilmstrip.vue` (modified) — `nextItemLabel` prop, `w-48` thumbs + synced `THUMB_WIDTH`, always-rendered end cap, forced-visible scrollbar + edge fade.
- `src/components/run/__tests__/RunFilmstrip.test.ts` (modified) — added 3 tests (enlarged-width assertion, end-cap-with-name, end-cap-end-of-service) alongside the existing array-index emit contract test.
- `src/components/run/RunPreviewPair.vue` (modified) — even-split grid, `data-testid`s on both pane wrappers, refreshed comments.
- `src/components/run/__tests__/RunPreviewPair.test.ts` (modified) — added the reduced-share assertion alongside the existing blackout-mirror tests.

## Decisions Made

- `deriveNextItemLabel` is module-level and exported (not nested inside `useRunControl`'s closure) so it can be unit-tested directly with hand-built `RailRow[]` fixtures — no composable mounting, no `useServiceAssembly`/router mocking required.
- RunPreviewPair's even 2-column split (rather than a milder 3:2 or 1:1-in-a-3-col grid) was chosen as the simplest, most legible way to satisfy "no longer the dominant 2/3 share" — the plan and CONTEXT.md both flag the exact ratio as Claude's discretion, tunable later during the batched milestone-end hardware UAT on the owner's real church Mac + projector.
- The end-cap and edge-fade exact styling (copy wording, gradient color/width) are likewise Claude's-discretion per CONTEXT.md, consistent with the existing run-component visual language (dark backgrounds, gray-400/500 text, dashed borders for empty/placeholder states).

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria and behavior bullets are covered by passing tests.

## Issues Encountered

The first attempt to run the plan's combined verification command concurrently with a separately-launched full-suite baseline run hit `[vitest-pool-runner]: Timeout waiting for worker to respond` — a resource-contention artifact from running two vitest processes at once on this machine, not a real test failure (each of the three target files had already passed individually moments before, and `npm run type-check` was clean throughout). Re-verified via the full-suite baseline run alone: 185/186 files passed, 5037/5037 non-skipped tests passed, the sole failure being the documented `src/storage.rules.test.ts` (Storage-emulator environment limitation, per CLAUDE.md) — exactly the expected baseline, no new regressions.

## User Setup Required

None — pure client-side layout/CSS + a pure derivation over already-live rail state. No new dependencies, no network/storage surface, no external service configuration.

## Known Stubs

None.

## Threat Flags

None beyond the plan's own threat register (T-115-02, already mitigated: the next-item name renders via `{{ }}` interpolation only, no `v-html`).

## Next Phase Readiness

- R330/R331/R332 are fully implemented and unit-tested. The exact pane ratio, thumbnail px, end-cap copy, and edge-fade styling remain subject to the batched hardware UAT on the owner's real church Mac + projector (per CONTEXT.md: readability is judged at projection distance) — this plan ships sensible, tested defaults per the plan's own verification section.
- This plan is independent of Plans 01/03 (the R329 auto-fit engine work) — different files, same Wave 1 — so Wave 2's SlideCanvas/output-view integration (Plan 03) is unaffected by and does not depend on this plan's changes.
- Full-suite baseline verified unchanged: 185/186 test files pass (only the documented `storage.rules.test.ts` Storage-emulator limitation fails), 5037 tests pass, `npm run type-check` clean.

## Self-Check: PASSED

All 7 created/modified source and test files verified present on disk; all 3 task commits (`db151b53`, `934ae6ad`, `9a4493e2`) verified present in git log.
