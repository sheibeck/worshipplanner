---
phase: quick-260805-kzd
plan: 01
subsystem: ui
tags: [vue, presentation, projector, tailwind, vitest, tdd]

# Dependency graph
requires:
  - phase: 35-presentation-correctness-lyric-editor
    provides: PresentationViewer.vue's per-kind slide rendering (lyric/copyright/scripture/text/image/video) and R059's precedent of removing an organizational label from the lyric branch
provides:
  - Scripture reference rendered as body-treatment slide content under data-testid="presentation-scripture-reference", unconditional, above the isCongregational fork
  - TextSlide title label deleted outright from the projected view (TextSlide.title field untouched, still serves the slide grid)
  - Congregational speaker tags (Leader:/Congregation:) restyled to the body treatment, keeping their words and presentation-speaker-{idx} testids
  - Every projected text element (lyric body, scripture reference, scripture passage, speaker tag, text-slide body) unified to text-5xl, proven per kind by assertion
  - A regression test proving an unfetched scripture passage (text: '') still projects its reference as the slide's entire visible content, never blank
affects: [congregational-split (a future phase that will build on the surviving presentation-speaker-{idx} / presentation-congregational-section-{idx} testids)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Projected slide content converges on one class list (text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4]) rather than per-kind label/body size steps"
    - "New testid introduced instead of reusing an existing one when two elements would otherwise collide under wrapper.find() (presentation-scripture-reference vs presentation-body)"

key-files:
  created: []
  modified:
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts
    - .planning/phases/35-presentation-correctness-lyric-editor/35-UI-SPEC.md

key-decisions:
  - "D1: the scripture reference is always-rendering slide content, not a label — deleting it would project a blank slide whenever the passage hasn't been fetched (slideshowAssembler.ts builds scripture slides with text: '')"
  - "D2: the TextSlide title heading is deleted outright, no replacement — the owner explicitly named the blue Message/Prayer heading as unwanted chrome"
  - "D3: congregational speaker tags are restyled now (not deferred) — words and testids survive, only the accent styling is removed, to leave stable anchors for the follow-up congregational-split phase"
  - "The XSS-escaping test's payload was moved from TextSlide.title into TextSlide.body so the proof survives D2 deleting the element it used to render through"
  - "The copyright branch and the congregational section-text span's weight/indent/tone differentiation were deliberately left byte-unchanged, per CONTEXT.md's discretion default"

patterns-established:
  - "When a projected element's testid changes because it converges on another element's treatment, add a NEW testid rather than reusing the target's — reusing would make wrapper.find() silently read the wrong element on multi-match slides"

requirements-completed: [QUICK-260805-kzd]

coverage:
  - id: D1
    description: "Scripture reference renders as body-treatment content (text-gray-100 text-5xl font-normal leading-[1.4], plus mb-8 spacing) under presentation-scripture-reference, unconditionally, above the congregational fork; an empty-passage slide still projects the reference as its entire visible content"
    requirement: "QUICK-260805-kzd"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#D1: a normal-mode ScriptureSlide renders its reference in the same treatment as song lyrics, not an accented label"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#D1: a congregational ScriptureSlide renders its reference in the unified body treatment too, and its speaker tag loses its accent while keeping its words"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#N-1 (D1 regression): an unfetched scripture passage still projects its reference as the entire visible content of the slide, never a blank one"
        status: pass
    human_judgment: true
    rationale: "Automated tests prove the DOM structure and classes, but whether the projected result reads well on an actual projector is the plan's own <human-check> and PLAN.md requires it be recorded as outstanding, never self-approved."
  - id: D2
    description: "A Message/Prayer (TextSlide) slide projects only its body; the title element is deleted outright and the TextSlide.title field is untouched for the slide grid"
    requirement: "QUICK-260805-kzd"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#D2: a TextSlide with a title projects only its body — the title never reaches the projector"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#D2: a TextSlide without a title projects identically to one with a title — same single-paragraph structure"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#a slide with angle-bracket markup renders those characters literally, not as child elements"
        status: pass
    human_judgment: true
    rationale: "The plan's <human-check> requires owner confirmation on the running app that no slide reads as a colored/uppercase heading; that observation cannot be proven by DOM assertions alone and PLAN.md requires it stay outstanding rather than self-approved."
  - id: D3
    description: "Congregational speaker tags (Leader:/Congregation:) render in the unified body treatment, carry an identical class list to each other, and keep their presentation-speaker-{idx} testids and words"
    requirement: "QUICK-260805-kzd"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#a congregational ScriptureSlide with two sections renders Leader/Congregation blocks with an identical, unified class list"
        status: pass
    human_judgment: false
  - id: unified-size
    description: "Every projected text element — lyric body, scripture reference, scripture passage, speaker tag, text-slide body — renders at text-5xl, per kind, deliberately excluding the copyright branch"
    requirement: "QUICK-260805-kzd"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#unified text-5xl size across every projected kind (D1/D2/D3) > a lyric slide body renders at text-5xl"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#unified text-5xl size across every projected kind (D1/D2/D3) > a normal-mode scripture slide renders both its reference and its body at text-5xl"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#unified text-5xl size across every projected kind (D1/D2/D3) > a congregational scripture slide renders both its reference and its speaker tag at text-5xl"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts#unified text-5xl size across every projected kind (D1/D2/D3) > a text slide body renders at text-5xl"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-05
status: complete
---

# Quick Task 260805-kzd: Remove Slide Labels, Unify Slide Text Size Summary

**Deleted the projected Message/Prayer title heading and the scripture-reference label styling from `PresentationViewer.vue`, converging every projected text element — lyric, scripture reference, scripture passage, congregational speaker tag, and text-slide body — on the single `text-5xl` treatment, with a new regression test proving an unfetched scripture passage still projects its reference rather than a blank slide.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-05
- **Tasks:** 3 (RED test rewrite, GREEN component edit, docs supersession + repo-wide grep proof)
- **Files modified:** 3 (`PresentationViewer.vue`, `PresentationViewer.test.ts`, `35-UI-SPEC.md`)

## Accomplishments

- **D1** — The scripture reference (`Romans 8:28-30`, etc.) is no longer a `text-2xl font-semibold` label under `presentation-label`. It is now unconditional body content (`text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4] mb-8`) under a new testid, `data-testid="presentation-scripture-reference"`, sitting above the congregational fork so both scripture sub-branches inherit it. A new regression test (N-1) mounts a scripture slide with `text: ''` (the empty-passage state `slideshowAssembler.ts` produces before a passage is fetched) and proves the reference is still the slide's entire rendered content — never a blank projector screen.
- **D2** — The blue, uppercase `Message` / `Prayer` heading (the `TextSlide.title` label element) is deleted outright from the projected view. `TextSlide.title` itself is untouched on the type and keeps serving the slide grid; it is simply never rendered on the projector. The XSS-escaping regression (which used to route its `<script>` payload through the now-deleted title) was updated to carry that payload through `body` instead, so the proof survives on a live rendering path rather than being silently lost.
- **D3** — The congregational speaker tags (`Leader:` / `Congregation:`) lose their `uppercase tracking-wider` treatment and their `text-indigo-300` / `text-amber-300` accent split, converging on the same body class list. The words and the `presentation-speaker-{idx}` testids are unchanged, preserved deliberately as anchors for the future congregational-split phase.
- Nine pre-existing tests (T-a through T-i) that pinned the removed behaviour were rewritten to assert positive claims about what now renders, rather than a removed testid's absence (which would have gone vacuously true). Four new per-kind `text-5xl` assertions (N-2) prove the unification, excluding the copyright branch by design.
- `35-UI-SPEC.md`'s stale "do not remove them" citation from Phase 35 now carries an additive supersession note pointing at this plan, with the original paragraph left intact for provenance.

## Task Commits

Each task was committed atomically:

1. **Task 1: Flip every pinning test to the new contract (RED)** - `5a6befe` (test)
2. **Task 2: Remove the label elements and unify the slide text treatment (GREEN)** - `aaa60e5` (feat)
3. **Task 3: Close the stale citation and prove the label treatment is gone repo-wide** - `3d36779` (docs)

_This plan's tasks were `tdd="true"` but structured as a single RED-then-GREEN pair across Tasks 1 and 2 (the plan's own task boundary), not per-task RED/GREEN/REFACTOR sub-commits — matching PLAN.md's stated task-level gate sequence._

## Files Created/Modified

- `src/components/PresentationViewer.vue` — scripture reference retestid'd and restyled to body treatment (D1); TextSlide title `<p>` deleted outright (D2); speaker tag `:class` accent binding removed, static class unified (D3); stale hierarchy-signal comment deleted and replaced with a short note
- `src/components/__tests__/PresentationViewer.test.ts` — 9 existing tests rewritten to positive assertions, 5 new tests added (N-1 blank-slide regression + 4 per-kind N-2 size assertions), `markupSlide` fixture's XSS payload moved into `body`
- `.planning/phases/35-presentation-correctness-lyric-editor/35-UI-SPEC.md` — additive supersession blockquote inserted after the paragraph it corrects; original text unchanged

## Decisions Made

All three decisions (D1/D2/D3) were owner-locked in `260805-kzd-CONTEXT.md` prior to execution; no new decisions were required during implementation. See `key-decisions` in the frontmatter above for the rationale behind each.

## Deviations from Plan

None — plan executed exactly as written. All four edit sites matched the plan's interface-context line ranges (with the expected small drift the plan itself warned about), and no test needed adjustment beyond what Task 1 pre-wrote.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Scope Disclosures (required by Task 3, Step 3)

- **The copyright branch's `text-6xl` title / `text-2xl` author lines were deliberately left alone**, per `CONTEXT.md`'s discretion default. A credits card is a different layout from projected reading text, and the owner reported no problem with it — widening scope to touch it would have been unrequested.
- **The congregational section-text span keeps its LEADER/CONGREGATION weight/indent/tone differentiation** (`font-semibold` vs `font-normal pl-8`, `text-gray-100` vs `text-gray-300`). D3 explicitly permits this retention, and its size was already `text-5xl` before this task — it is byte-identical in `git diff`.
- **The congregational-split feature** (per-section editable/deletable slides) that the owner asked about in the same breath as this task is **NOT** part of this work. It is a data-model change (`slideshowAssembler.ts`, `scriptureSplitter.ts`, `src/types/slide.ts`, `SlideCard.vue`, `slideDisplay.ts` — all explicitly out of scope here) awaiting its own planned phase. The `presentation-speaker-{idx}` and `presentation-congregational-section-{idx}` testids were preserved specifically to give that future phase stable anchors.

## Human Verification — outstanding, not passed

Task 2's `<human-check>` requires the owner to view a running service containing (a) a scripture item with no passage fetched yet, (b) a scripture item with verse text, (c) a congregational reading, and (d) a Message and a Prayer item, and confirm:

- the reference-only slide shows its reference and is not blank;
- nothing on any slide reads as a colored or uppercase heading;
- `Leader:` / `Congregation:` still appear;
- every slide's text reads at the same size as a song-lyric slide.

**This has not been performed.** It is recorded here as outstanding per the plan's own instruction never to record a deferred check as passed, and should be added to `.planning/PENDING-VERIFICATION.md` by the orchestrator.

## Verification Evidence

- `npm run type-check` (runs `vue-tsc --build`, per CLAUDE.md): clean at every gate (Task 1, Task 2, Task 3).
- `npx vitest run src/components/__tests__/PresentationViewer.test.ts`: RED after Task 1 (8 expected failures, matching the plan's predicted failure list exactly), GREEN (79/79) after Task 2.
- `npx vitest run --dir src --exclude '**/rules.test.ts'`: run twice (post-Task-2, post-Task-3), both times showing exactly the two known-baseline failing files — `src/storage.rules.test.ts` (needs the Storage emulator) and `src/views/__tests__/RosterView.test.ts` (stale assertion) — and no others. 2426/2435 passing both times.
- Three grep gates (Task 3): `presentation-label` absent from both the component and its test file; `hierarchy signal` absent from the component; `presentation-scripture-reference` appears exactly once in the component.
- `git status --short` after each task matched that task's `<files>` list exactly.

## Next Phase Readiness

- No blockers. The presentation surface is ready for the deferred congregational-split phase, which can build on the surviving `presentation-speaker-{idx}` / `presentation-congregational-section-{idx}` testids without needing to touch this task's work.
- The owner's human-check on the running app remains outstanding and should be scheduled.

---
*Phase: quick-260805-kzd*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: `src/components/PresentationViewer.vue`
- FOUND: `src/components/__tests__/PresentationViewer.test.ts`
- FOUND: `.planning/phases/35-presentation-correctness-lyric-editor/35-UI-SPEC.md`
- FOUND: `.planning/quick/260805-kzd-remove-slide-labels-unify-slide-text-size/260805-kzd-SUMMARY.md`
- FOUND: commit `5a6befe` (Task 1)
- FOUND: commit `aaa60e5` (Task 2)
- FOUND: commit `3d36779` (Task 3)
