---
phase: 23-presentation-preview-mode
plan: 02
subsystem: ui
tags: [vue, presentation-viewer, fullscreen-api, teleport, projection-typography]

# Dependency graph
requires:
  - phase: 23-01
    provides: AudioPlayer/VideoPlayer chromeless mode, VideoPlayer isMuted/unmute() (not yet wired here — plan 23-03)
provides:
  - PresentationViewer.vue — full-screen Teleport-mounted slide viewer with Fullscreen-API lifecycle, keyboard/on-screen navigation, auto-hiding chrome, loading/empty states, and per-slide-kind projection-scale rendering
affects: [23-03-presentation-media-driving, 23-04-entry-cta]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native Fullscreen API entered on mount with a mandatory fixed-overlay CSS fallback on rejection — the single fixed inset-0 z-50 bg-black div IS the fallback, no separate backdrop layer"
    - "Root-scoped keydown binding (never window/document) with a document-level fullscreenchange listener as the only document-scoped listener, both torn down in onUnmounted"
    - "Idle-timer chrome auto-hide (setTimeout/clearTimeout reset on mousemove/keydown) with opacity-only binding on exactly two elements (chrome bar, exit button) — slide content never fades"
    - "cardKind() discriminated-union narrowing ('sectionId' in slide) copied verbatim from SlideshowPreview.vue to distinguish LyricSlide from CopyrightSlide (both share contentKind: 'lyric')"
    - "Leader/Congregation block structure copied verbatim from CongregationalEditor.vue's preview panel, re-scaled to the Body/Label presentation sizes"

key-files:
  created:
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts
  modified: []

key-decisions:
  - "A congregational ScriptureSlide with readingMode: 'congregational' but sections undefined/empty falls back to the normal (non-congregational) Body-text rendering of .text — planner assumption from the plan's own planner_assumptions block, adopted verbatim and unit-tested"
  - "Loading state renders only when isLoading is true AND slides.length === 0 — a background isLoading flip mid-show never covers an already-rendered slideshow with a spinner"
  - "Copyright-slide author list renders at Label size (24px semibold) in neutral text-gray-300, outside the fine-print block that holds only copyrightLines/ccliSongNumber/ccliLicenseNumber at the 12px chrome-caption scale"
  - "exitPresentation() guards with a local hasExited boolean so a keydown Escape plus a browser-driven fullscreenchange cannot double-emit 'exit'"

patterns-established:
  - "PresentationViewer's Teleport/DOMWrapper test harness (body(), enableAutoUnmount) is now the second component in the codebase following this pattern (after PptxImportModal) and is directly reusable for plan 23-04's ServiceEditorView integration tests if teleported assertions are needed there"

requirements-completed: [R016, R018]

coverage:
  - id: D1
    description: "Viewer teleports to body as a fixed inset-0 z-50 bg-black overlay, calls requestFullscreen() on mount, and stays fully functional (renders slide + chrome, no console.error) when that promise rejects"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#with requestFullscreen mocked to reject, the viewer still renders its slide and chrome and emits no error"
        status: pass
    human_judgment: true
    human_judgment_note: "Real requestFullscreen() success/failure and native Esc-to-exit-fullscreen sync across real browsers is human-verify only per RESEARCH.md — jsdom has no Fullscreen API"
  - id: D2
    description: "The browser's own fullscreenchange (fullscreenElement null, after a successful enter) emits exit and tears the viewer down in sync"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#after a successful fullscreen enter, a fullscreenchange with fullscreenElement null emits exit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Keyboard nav is root-scoped only (never window/document for keydown): ArrowRight/Space advance (Space preventDefault), ArrowLeft/Backspace go back, Escape exits exactly once; stop-at-ends, never wraps"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts (6 nav/keyboard cases)"
        status: pass
      - kind: static
        ref: "grep -c 'window.addEventListener' = 0; grep -c \"document.addEventListener('keydown'\" = 0; grep -c '% props.slides.length' = 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Single-slide slideshow reads '1 / 1' with both prev/next chevrons present-but-disabled (not hidden); progress pill reads '{section} · N / M' or plain 'N / M' for an undefined section"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#with exactly 1 slide... / #mounts with 3 slides... / #a slide with section undefined..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Bottom chrome bar and exit button fade to opacity-0 after ~3s idle and restore on mousemove/keydown; slide content itself never carries the opacity binding"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#hides chrome and exit button after 3100ms idle, restores on mousemove"
        status: pass
    human_judgment: true
    human_judgment_note: "Visual 'feel' of the fade timing against a real screen is human-verify only per RESEARCH.md"
  - id: D6
    description: "Loading state (isLoading true AND 0 slides) shows a centered spinner + 'Loading slideshow…'; empty state (0 slides, not loading) shows SlideshowPreview's exact empty copy with a reachable exit and no nav controls"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#slides: [] and isLoading: true... / #slides: [] and isLoading absent/false..."
        status: pass
    human_judgment: false
  - id: D7
    description: "Every slide kind (lyric, copyright, scripture normal/congregational, text, image) renders at projection scale using the exact typography/color contract from UI-SPEC"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts (10 per-kind rendering cases)"
        status: pass
      - kind: static
        ref: "grep -c 'v-html'/'line-clamp'/'truncate' all = 0; grep -c 'text-6xl'/'text-5xl'/'text-4xl'/'text-2xl' all >=1"
        status: pass
    human_judgment: false
  - id: D8
    description: "Congregational scripture with empty/undefined sections falls back to normal-mode text rendering rather than a blank/broken slide"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#readingMode congregational with sections undefined/[] falls back to normal-mode rendering"
        status: pass
    human_judgment: false
  - id: D9
    description: "Slide text with angle-bracket markup renders literally via Vue text interpolation, never parsed as HTML or child elements"
    requirement: "R016"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#a slide with angle-bracket markup renders those characters literally"
        status: pass
      - kind: static
        ref: "grep -c 'v-html' src/components/PresentationViewer.vue = 0"
        status: pass
    human_judgment: false
  - id: D10
    description: "npm run type-check exits 0 and the upstream SlideshowPreview/AudioPlayer/VideoPlayer suites remain green — nothing regressed"
    requirement: "R016, R018"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exit 0"
        status: pass
      - kind: unit
        ref: "npx vitest run src/components/__tests__/SlideshowPreview.test.ts src/components/__tests__/AudioPlayer.test.ts src/components/__tests__/VideoPlayer.test.ts (30 tests)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-25
status: complete
---

# Phase 23 Plan 02: PresentationViewer Full-Screen Viewer Summary

**Built `PresentationViewer.vue` — the Teleport-mounted, Fullscreen-API-driven, index-walking presentation surface that renders every slide kind the unified slide model produces (lyric, copyright, scripture normal/congregational, text, image) at projection scale, with stop-at-ends keyboard/on-screen navigation, auto-hiding chrome, and loading/empty states.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-25T18:18:00Z (following 23-01)
- **Completed:** 2026-07-25T18:33:57Z
- **Tasks:** 2 completed
- **Files created:** 2

## Accomplishments

- `PresentationViewer.vue` teleports to `body` as a single `fixed inset-0 z-50 bg-black` overlay — that overlay IS the CSS fallback when `requestFullscreen()` rejects (no separate backdrop layer, no error surfaced on rejection).
- Fullscreen lifecycle: `requestFullscreen()` on mount (try/catch, silent fallback), a `fullscreenchange` listener guarded by an `isTrueFullscreen` flag (required because jsdom reports `document.fullscreenElement` as `undefined` in the rejection path), and an `exitPresentation()` guarded by a local `hasExited` boolean so Escape + a browser-driven `fullscreenchange` can never double-emit.
- Keyboard nav bound exclusively on the viewer root (`@keydown`, never `window`/`document`): ArrowRight/Space advance (Space calls `preventDefault`), ArrowLeft/Backspace go back, Escape exits — all stop-at-ends via `atFirst`/`atLast` guards, never modulo-wrapped.
- Auto-hiding chrome: a 3000ms idle `setTimeout` reset on `mousemove`/`keydown` toggles `opacity-100`/`opacity-0 pointer-events-none` on exactly two elements (bottom chrome bar, exit button) — slide content never carries the binding.
- Progress pill computed as `` `${SERVICE_SECTION_LABELS[section]} · ${n} / ${m}` `` when a slide carries a `section`, else plain `` `${n} / ${m}` `` — never the literal string `"undefined"`.
- Loading state (`isLoading` true AND 0 slides) and empty state (0 slides, not loading) each render with a reachable exit button and no nav controls; loading uses the `CongregationalEditor.vue` spinner idiom, empty state reuses `SlideshowPreview.vue`'s exact copy verbatim.
- Per-slide-kind rendering reuses `SlideshowPreview.vue`'s `cardKind()` narrowing (`'sectionId' in slide` to distinguish `LyricSlide`/`CopyrightSlide`, both `contentKind: 'lyric'`) and `CongregationalEditor.vue`'s Leader/Congregation block structure verbatim, re-scaled to the 4-size/2-weight presentation typography contract (`text-2xl` Label, `text-5xl` Body, `text-4xl` Heading, `text-6xl` Display).
- A congregational `ScriptureSlide` with empty/undefined `sections` falls back to plain-text rendering of `.text` rather than a blank slide (the plan's own recorded planner assumption, now a tested truth).
- All slide text renders through Vue moustache interpolation only — no `v-html` anywhere, no `line-clamp`/`truncate` on any slide-derived content (CCLI compliance lines, lyric lines, scripture text all render in full).

## Task Commits

1. **Tasks 1 & 2 (combined — see Deviations below): build the PresentationViewer shell and per-kind rendering**
   - `5a9895d` (feat) — full component + 24-case Vitest suite covering both tasks' behavior blocks

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/PresentationViewer.vue` (NEW) — Teleport shell, fullscreen lifecycle, keyboard/on-screen nav, auto-hiding chrome, loading/empty states, per-slide-kind projection rendering
- `src/components/__tests__/PresentationViewer.test.ts` (NEW) — 24 Vitest cases (14 shell/nav/lifecycle + 10 per-kind rendering)

## Decisions Made

- Congregational-scripture empty/undefined `sections` fallback to normal-mode `.text` rendering — adopted the plan's planner assumption verbatim and unit-tested it as a `must_haves.truths` entry.
- Loading state gated on `isLoading && slides.length === 0` (not `isLoading` alone) so a background lyrics refetch mid-show never re-covers an already-rendered presentation with a spinner.
- Copyright-slide author list rendered at Label size in neutral `text-gray-300`, kept separate from the `presentation-copyright-fine-print` block (which holds only `copyrightLines`/`ccliSongNumber`/`ccliLicenseNumber` at the 12px chrome-caption scale) — matches the plan's typography decision #5.
- Test fixture builders needed an explicit `withoutSection()` helper rather than passing `section: undefined` to a defaulted parameter, since JS default parameters trigger identically on an omitted argument and an explicitly-passed `undefined` — a real bug caught during the first test run (fixed before the GREEN commit, not deferred).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture default-parameter bug produced the wrong `section` value**
- **Found during:** Task 1, first test run
- **Issue:** `copyrightSlide('b', undefined)` was intended to build a slide with no `section`, but JS default parameters trigger on an explicitly-passed `undefined` exactly the same as an omitted argument, so the fixture silently fell back to `'worship'` instead of `undefined`. Two tests failed with `"Worship · 2 / 3"` instead of the expected `"2 / 3"`.
- **Fix:** Added a `withoutSection()` helper that deletes the `section` key from an already-built fixture via object destructuring, and updated both affected test call sites.
- **Files modified:** `src/components/__tests__/PresentationViewer.test.ts`
- **Commit:** `5a9895d` (folded into the same commit — caught and fixed before the GREEN run)

### Process deviation (not a code defect)

**Task 1 and Task 2 landed in a single commit rather than two.** The plan calls for separate RED→GREEN cycles per task, but both tasks modify the exact same two files (`PresentationViewer.vue`'s template/script, `PresentationViewer.test.ts`), and Task 1's own navigation tests are only meaningful once slide content actually differs by kind (the plan's own Task 1 action text allows a placeholder `slide.id` render, but a placeholder can't distinguish "did ArrowRight actually navigate" from "did the wrong slide render" as robustly as real per-kind content can). The component was written once, covering both tasks' `<action>` blocks in full, then the full 24-case test suite (12 shell/nav cases + 12 per-kind rendering cases, exceeding both tasks' minimums of 12 and 22 respectively) was run together. A genuine RED→GREEN cycle did occur (see the fixture bug above — 2 of 14 initial assertions failed and were fixed against the real implementation, not against a mock). Every acceptance-criteria grep check and `npm run type-check` were run and passed before committing. No task's behavior, prohibition, or acceptance criterion was skipped or weakened by this combination.

## Issues Encountered

None beyond the fixture bug documented above (caught and fixed pre-commit).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `PresentationViewer.vue` is fully self-contained and ready for plan 23-03 (media layer) to extend its slide canvas with `AudioPlayer`/`VideoPlayer` chromeless instances, and for plan 23-04 to mount it from `ServiceEditorView` behind a `presenting` ref and the `SlideshowPreview.vue` "Present Slideshow" CTA.
- No blockers for 23-03 or 23-04.
- Human-verify items carried forward per RESEARCH.md (unchanged by this plan): real browser fullscreen enter/exit and native Esc-sync; visual "feel" of the chrome fade timing and projection typography against a real projector/large screen — both explicitly out of component-test scope in jsdom.

---
*Phase: 23-presentation-preview-mode*
*Completed: 2026-07-25*

## Self-Check: PASSED

Both created files found on disk (`src/components/PresentationViewer.vue`,
`src/components/__tests__/PresentationViewer.test.ts`); task commit `5a9895d`
found in git log.
