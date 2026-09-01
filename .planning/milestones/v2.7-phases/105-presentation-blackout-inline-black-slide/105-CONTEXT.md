# Phase 105: Presentation Blackout & Inline Black Slide - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, auto-optimized from v2.7 research ARCHITECTURE/PITFALLS + owner decisions)

<domain>
## Phase Boundary

Two related but structurally independent presentation improvements: (1) an **inline black (blackout)
slide** authorable inside a song's slide sequence to mark an instrumental/interlude — a real black
screen, not a new blank service section; and (2) scoping the runtime **"Go to black"** control so it
blacks out **only the Audience output**, leaving the Confidence monitor visible. In scope: R302, R303,
R304, R305. Out of scope: looping/auto-advance (Phase 106), any rehearsal/storage work.
</domain>

<decisions>
## Implementation Decisions

### Inline black slide (R302, R303, R304)
- **Data model: an additive `kind`/`contentKind` on the lyric slide model — NOT an empty `LyricSection`,
  and NOT a change to the `SourceRef` union.** Research (PITFALLS/ARCHITECTURE) is explicit: this app's
  lyric model is a pooled-section reference system with position-derived numbering (`songSectionOrder.ts`);
  an empty section would corrupt numbering/pooling/export. Give the black slide its own content kind
  (e.g. `LyricSection.kind?: 'lyric' | 'blackout'`, default `'lyric'`) so it is unambiguously a blackout,
  carries no lyric text/background, and is skipped by section-numbering logic.
- **Authoring:** from the Song Lyrics editor, a user inserts a black slide *between* existing lyric slides
  (an "Insert black slide" affordance in the same list that IS the slide order). It must slot in like any
  other slide for reorder/duplicate/delete. It does NOT create or require a new service section (R302).
- **Rendering (R303):** the assembler (`slideshowAssembler.ts`) emits a normal `AssembledSlide` flagged
  as blackout via a one-line branch in the ~3 places research identified; because Audience / Confidence /
  in-app preview / print+export all iterate `AssembledSlide` generically, a blackout slide renders as a
  full black screen — no lyric text, no background image, no organizational labels — everywhere, and
  participates in normal next/prev navigation for free. Confirm print/export path shows solid black too.
- **Integrity (R304):** adding/moving/duplicating/deleting a black slide must leave song **section
  numbering** (position-derived), the **split-section-as-one-unit** duplicate/number behavior, and the
  **slide↔service-order mirroring** intact. A black slide is a real slide in the order but is invisible to
  section-numbering (it is not a lyric section). Duplicating a split section that contains a black slide
  copies it as part of the unit.

### "Go to black" → Audience only (R305)
- **Do NOT change the runChannel wire protocol.** The blackout state continues to broadcast over the
  existing single-writer BroadcastChannel from the control screen; the fix is purely on the consumer side:
  **`ConfidenceOutputView.vue` stops rendering the blackout overlay** (it keeps showing current/upcoming),
  while `AudienceOutputView.vue` continues to honor blackout. Smallest isolated Run-flow diff.
- **Distinguish two "black" concepts cleanly:** the authored **blackout slide** (content — shows black on
  BOTH outputs because it is a slide in the deck) is different from the runtime **"Go to black" control**
  (a live operator blackout — now Audience-only). Do not conflate them; the confidence monitor shows the
  real current slide even during a runtime "Go to black", but WILL show black when the current slide is an
  authored blackout slide. Make this distinction explicit in code + tests so a future reader doesn't
  "helpfully" re-black the confidence monitor.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/slideshowAssembler.ts` — assembles `AssembledSlide[]`; the one-line blackout branch lands here.
- `src/types/slide.ts`, `src/utils/songLyrics.ts`, `src/utils/songSectionOrder.ts` — the lyric/slide model
  and the position-derived section numbering that must stay intact.
- The Song Lyrics editor component (the single-list slide editor) — where "Insert black slide" is added.
- `src/views/AudienceOutputView.vue`, `src/views/ConfidenceOutputView.vue` — the two outputs; the R305 fix
  is in ConfidenceOutputView (stop honoring the runtime blackout overlay).
- `src/composables/useRunControl.ts`, `src/utils/runChannel.ts` — Run control + the blackout broadcast
  (no protocol change).
- The in-app slideshow **preview** and the **print/export** path — must render blackout slides as solid black.

### Established Patterns
- Slides mirror the service order as the single source of truth; song groups are read-only in the Slides
  tab and edited only from the Song Lyrics editor (blackout authoring lives in that editor).
- Additive, optional, no-migration data-model changes (matches every prior milestone).
- Run outputs iterate a generic `AssembledSlide` list; keep the blackout a property of the assembled slide.

### Integration Points
- Assembler branch → consumed by all four render surfaces (audience/confidence/preview/print).
- ConfidenceOutputView blackout-overlay suppression (R305).
</code_context>

<specifics>
## Specific Ideas

- Owner intent (verbatim): a black slide for a "long section or interlude where you aren't singing", built
  into the lyric editor "without introducing a new blank section." And: "Go to black" should "only make the
  Audience view black. Right now it also does the confidence monitor."
</specifics>

<deferred>
## Deferred Ideas

- Looping / auto-advance of slides — Phase 106.
- Any per-slide transition/fade styling for the blackout — keep it an instant solid black for v2.7.
</deferred>
