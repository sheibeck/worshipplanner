# Phase 90: SlideCanvas Extraction - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous run (discuss skipped; distilled from `.planning/research/` — ARCHITECTURE.md, PITFALLS.md, SUMMARY.md)

<domain>
## Phase Boundary

Extract `src/components/PresentationViewer.vue`'s per-slide rendering into a reusable `SlideCanvas.vue`
with **zero behavior change**. This is a pure enabling refactor — no new user-facing capability — that
establishes the single rendering source of truth the three downstream Run/Audience/Confidence windows
(Phases 93–95) compose instead of forking. Maps to no v2.4 requirement by design.

IN SCOPE: create `SlideCanvas.vue` holding the per-`slideKind` render logic (lyrics, scripture,
image, video, copyright) + media playback; refactor `PresentationViewer.vue` to compose it at its one
existing call site; keep `PresentationViewer.vue`'s chrome (exit button, nav bar, fullscreen, keyboard,
font-load gate) exactly where it is.

OUT OF SCOPE: any Run/Audience/Confidence window, BroadcastChannel, monitor config, new props beyond
those needed for extraction. Do NOT change `slideshowAssembler.ts` or `useSlideshowAssembly.ts`.
</domain>

<decisions>
## Implementation Decisions

### From research (ARCHITECTURE.md "reuse, don't fork")
- New component location: `src/components/slides/SlideCanvas.vue` (create the `slides/` subfolder if it
  does not exist; match the closest existing convention the pattern-mapper finds).
- Props (minimum viable for this phase): `slide` (the `AssembledSlide` to render), `suppressBackground`
  (boolean — when true, ignore `currentBackgroundUrl` and render a black background; consumed by the
  confidence monitor in Phase 94, but the prop lands here so extraction is complete), `interactive`
  (boolean — whether the canvas responds to its own click/hover chrome; `PresentationViewer.vue`'s
  existing behavior is the `interactive=true`/default case).
- `SlideCanvas.vue` owns ONLY rendering + media (video/audio) playback lifecycle. It must preserve the
  existing `goToIndex` pause-reset-play instant-swap media invariant (T-23-08) — do not restructure it.
- `PresentationViewer.vue` keeps: the exit button, the auto-hiding `presentation-chrome` bar, keyboard
  handling (`handleKeydown`), the fullscreen logic, `initialIndex`/R061 jump, and the
  `slideTypography.ts` font-load gate. It now renders `<SlideCanvas :slide=... />` where the inline
  slide markup used to be.

### Claude's Discretion
All remaining implementation choices are at Claude's discretion — use the ROADMAP goal, success
criteria, the research files, and existing codebase conventions. The overriding constraint is
**zero observable behavior change** at `PresentationViewer.vue`'s existing call site.
</decisions>

<code_context>
## Existing Code Insights (from research — verify during plan-phase)

- `src/components/PresentationViewer.vue` — a large (~600-line) single file that inlines chrome +
  per-`slideKind` slide rendering + media playback. Has an existing test file with `data-testid`
  markers that MUST keep passing unchanged (this is success criterion 2).
- `src/utils/slideshowAssembler.ts` — pure `service → AssembledSlide[]`; leave untouched.
- `src/types/slide.ts` — `AssembledSlide` carries `slotIndex`, `section`, `groupId`, background fields.
- `src/utils/slideTypography.ts` — font-load gate; stays owned by `PresentationViewer.vue`.
- Media lifecycle invariant T-23-08 (documented in `PresentationViewer.vue`): pause/reset before index
  write, then play — assumes an instant slide swap. Preserve exactly.
</code_context>

<specifics>
## Specific Ideas / Verification

- The refactor is verified primarily by the EXISTING `PresentationViewer.vue` test suite passing
  unmodified (its `data-testid` markers are the behavior contract).
- Respect the two documented test baselines in `CLAUDE.md`: use `npm run type-check` (vue-tsc --build,
  typechecks tests too) as the type gate, and a bare `npx vitest run` for the app suite (known baseline:
  `src/storage.rules.test.ts` only — an environment limitation, not a regression). Do not chase the
  storage.rules baseline failure.
- Add focused unit tests for `SlideCanvas.vue` covering each slide content type it renders.
</specifics>

<deferred>
## Deferred Ideas

- `suppressBackground` is wired as a prop here but only EXERCISED by the confidence monitor in Phase 94.
- Any window/multi-monitor/BroadcastChannel concern → Phases 91–96.
</deferred>
