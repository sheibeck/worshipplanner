# Phase 35: Presentation Correctness & Lyric Editor - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey areas proposed with recommendations and auto-accepted under
the STATE.md standing autonomy grant. Accepted answers are Claude's recommendations, not owner
statements — reversible defaults.

<domain>
## Phase Boundary

Two unrelated clusters that share a phase. **Presentation correctness:** organizational labels never
leak into a presented or previewed slideshow, copyright is visible on the first *and* last slide of
every song group, and presenting starts where the user is looking. **Lyric editor:** pasting lyrics
warns when copyright is missing, and happens inline rather than in a modal.

Requirements: **R059** (no label leak), **R060** (copyright first and last), **R061** (present starts
at the highlighted group/slide), **R065** (paste warns on missing copyright), **R066** (paste is
inline, per the wireframes).

**In scope:** `PresentationViewer.vue`'s render of `sectionLabel`; verifying/(if needed)fixing the
copyright emission on both assembler paths; the present-start index; converting
`LyricPasteDialog.vue` from a modal to an inline region and adding the missing-copyright warning.

**Out of scope:** the Service Order rebuild and the contextual action bar (**R067/R068, Phase 36**) —
this phase reads Turn 3 only for the paste-lyrics treatment; Phase 34's unreachable congregational
editor (a separate recorded gap); PPTX rendering (Phase 37).

</domain>

<decisions>
## Implementation Decisions

### ★ The design source is now available — re-pulled 2026-08-03

`docs/design/slides-tab.dc.html` was refreshed via `DesignSync` (49 KB → 93 KB) and now carries
**Turn 3 — Service Order tab**, which includes the **`Paste lyrics`** affordance and the
**`No copyright information found`** warning. **That is the wireframe for R065 and R066** — follow it
rather than inventing the treatment. Re-pull command is documented in `docs/design/README.md`.

Turn 3 also covers the Service Order rebuild, but that is **R067/Phase 36** — do not start it here.

### Presentation Correctness (R059, R060, R061)

- **R059 is a render fix, not a model change.** The leak is exactly one line:
  `PresentationViewer.vue:53` renders `(currentSlide.slide as LyricSlide).sectionLabel`. **Stop
  rendering it there; keep the field.** `sectionLabel` is load-bearing for the slide grid
  (`slideDisplay.ts:95` and `:143`), and R059's own words — labels "exist only to organize slides
  within a group" — describe precisely that surviving use. Deleting the field would break the grid to
  fix the presentation.
- **R060 may already be satisfied — verify before implementing.** `slideshowAssembler.ts` emits
  `copyrightContent` **before** the section loop (~`:379`) and **again after** it (~`:392`) on the
  fallback path. `src/types/slideGroup.ts`'s own comment says the same of the materialized path
  ("`assembleSlideshow` emits a copyright slide BEFORE and AFTER a song's lyric sections, so a song
  group needs two entries that carry no `sectionId`"). **Research must confirm BOTH paths.** If both
  already do it, R060 needs a *test*, not an implementation — and implementing it anyway would emit
  duplicate copyright slides.
- **★ Never justify first-and-last as a CCLI mandate.** R060 is explicit: it **exceeds** the
  documented legal minimum (the convention is at least once per song, typically the last slide) and is
  a deliberate safety margin for mid-deck starts and songs cut short. CCLI's primary license text was
  never successfully retrieved. **No UI copy, code comment, or SUMMARY may say CCLI requires this.**
  Say "safety margin."
- **R061: when no slide is highlighted, start at that group's first slide** — R061's literal wording —
  **not** slide 0 of the whole deck. The Present CTA lives on the Slides tab (Phase 27 D-05) and
  `ServiceEditorView` owns the actual start; `SlidesTab.vue` already tracks `selectedSlotId` and
  `selectedSlideId`, so the data exists and only needs threading.

### Inline Paste (R065, R066)

- **Convert `LyricPasteDialog.vue` in place**, keeping its CCLI parsing logic — that parsing is tested
  and R065 builds directly on it. Do not write a second parser.
- **Follow Turn 3's wireframe for placement and treatment.** It shows `Paste lyrics` inline with the
  `No copyright information found` warning; that is the specified design.
- **R065 advises, it never blocks.** "Warns rather than accepting silently" — the paste still
  succeeds and the user is told. Blocking a paste because a song has no CCLI number would be a worse
  failure than the silence it replaces.
- **One paste path only.** The modal does not survive as a fallback — two paste surfaces is exactly
  the ambiguity R066 removes.

### Scope Discipline

- **Does not touch the Service Order tab.** Turn 3 covers it; that is Phase 36.
- **Does not touch Phase 34's unreachable `CongregationalEditor.vue`** — separate recorded gap
  (`/gsd-plan-phase 34 --gaps`).
- **★ An open question the plan must answer rather than decide by omission:** Phase 33 stored
  `backgroundImageUrl` at three levels, and Phase 33's research confirmed `PresentationViewer.vue`
  renders **no** background layer — correct at the time, since 33 scoped presentation out. But this
  phase is *named* "Presentation Correctness." **Decide deliberately whether rendering backgrounds
  belongs here or in a later phase, and record the decision.** Do not let it be settled by nobody
  noticing. Recommendation: **out of scope** — none of R059/R060/R061/R065/R066 mentions backgrounds,
  and widening a correctness phase into a rendering feature invites regressions. But say so
  explicitly.

### Claude's Discretion

- Exact inline-paste markup within Turn 3's constraints, and where the warning sits relative to it.
- Whether the R059 fix is a `v-if` or removing the element outright.
- How the start index is threaded from `SlidesTab` through `ServiceEditorView` to `PresentationViewer`.

</decisions>

<code_context>
## Existing Code Insights

### Integration Points
- **`src/components/PresentationViewer.vue:53`** — the R059 leak, verbatim:
  `{{ (currentSlide.slide as LyricSlide).sectionLabel }}`.
- **`src/utils/slideshowAssembler.ts`** — `buildCopyrightSlideContent` (`:56`), the copyright emissions
  at ~`:379` and ~`:392`, and `sectionLabel: section.label` at `:127` and `:387`.
- **`src/components/slides/slideDisplay.ts:95,143`** — the *legitimate* `sectionLabel` consumers (grid
  organization). These must keep working.
- **`src/components/slides/SlidesTab.vue`** — `selectedSlotId` / `selectedSlideId` (`:187`), and the
  Present CTA (`:3-21`, D-05/Phase 27-05) whose request `ServiceEditorView` owns (`:178`).
- **`src/components/LyricPasteDialog.vue`** (211 lines) — mounted as a modal at
  `SongLyricEditor.vue:252`, imported at `:281`.
- **`src/types/slide.ts:56`** — `sectionLabel: string` on `LyricSlide`.

### Established Patterns
Vue 3 `<script setup>`, Pinia, Tailwind, `data-testid`, Vitest + `@vue/test-utils` with real Pinia
(`setActivePinia(createPinia())`) and `enableAutoUnmount(afterEach)` — both load-bearing since Phase
32/33. `SongLyricEditor.vue` also carries a Phase 32 `SaveStatusIndicator` and a Phase 33 song-level
`BackgroundControl` in its header — place the inline paste region without disturbing either.

</code_context>

<specifics>
## Specific Ideas

- The ROADMAP's research flag: *"standard pattern for R059/R061 (presentation-layer read of
  already-assembled data); see Notes for R060's documentation-language caveat."* R059 and R061 are
  genuinely shallow — the risk in this phase is concentrated in R060 (don't duplicate slides, don't
  mis-cite CCLI) and R066 (don't lose tested parsing logic during the modal→inline conversion).
- **Pull CCLI's actual primary license text if it can be retrieved.** R060 says it "should be pulled
  before this criterion is treated as final." If retrieval fails again, say so plainly rather than
  quietly proceeding — that is the second time it will have failed, and it is worth the owner knowing.

</specifics>

<deferred>
## Deferred Ideas

- **Rendering slide backgrounds in the presentation viewer** — Phase 33 stored them; nothing renders
  them. Recommended out of scope here (see the decision above), but recorded so it is not lost.
- **The Service Order rebuild and contextual action bar** — R067/R068, Phase 36. Turn 3 now provides
  the rebuild's wireframe; the action bar still has none.
- **Phase 34's reachability gap** — `/gsd-plan-phase 34 --gaps`.
- **Anything about how copyright is *worded*** beyond first-and-last placement. R060 is a placement
  requirement; the copy itself is not in scope.

</deferred>
