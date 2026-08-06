# Phase 20: Service Sections and Slide Auto-Assembly — Context

**Gathered:** 2026-07-24
**Status:** Ready for planning (research complete; not yet planned)

> Synthesized from the M001 milestone context (`M001-CONTEXT.md`, `M001-ROADMAP.md`) and the ported `20-RESEARCH.md`. This is the active next phase. Requirement IDs (R005/R006/R007/R018) and decision IDs (D001, D005) originate in the M001 milestone.

<domain>
## Phase Boundary

Give worship services a formalized section structure and make the presentation slideshow assemble itself from the service order.

- **Formalized service sections** — four named default sections: **Pre-Service, Worship, Message, Sending** (decision D005). They give non-technical volunteers a clear template to start from rather than a blank canvas, and make auto-assembly deterministic.
- **Service-driven slideshow auto-assembly** — an engine that walks the service's ordered slots and collects slides from all sources (song lyrics from Phase 18, scripture readings from Phase 19) into a single ordered slideshow (R005).
- **Auto-reorder** — when the user reorders, adds, or removes service elements, the assembled slideshow updates automatically with no manual re-sync step (R006).
- **No breakage of existing services** — services today are a flat `slots[]` array with position-based ordering and no section concept. The section layer must be **additive** (an optional `section` field) so existing Firestore services keep rendering with zero migration.

This phase does NOT build the full-screen presentation/preview experience — that is Phase 23 (S06). Phase 20 delivers at most an inline preview panel showing the assembled result.
</domain>

<dependencies>
## Depends On

- **Phase 18 — Song Lyric Slides and Editor** (S01). Provides the unified `Slide` type with a content-kind discriminator, per-song lyric slide sequences in the catalog, `performanceOrder` on the Song doc, and the `useAutoSave` 800ms-debounce composable. The assembly engine consumes song lyric slides as live catalog references.
- **Phase 19 — Scripture and Congregational Reading Slides** (S02). Provides `ScriptureSlide` in the `Slide` union, the scripture-slides Pinia store, and the `ScriptureSlot.scriptureReadingId` / `readingMode` binding fields. The assembly engine consumes scripture slides by looking up the reading ID.

Downstream consumers: **Phase 21** (PPTX import) and **Phase 23** (presentation preview) both build on the section model and the assembled-slideshow output produced here.
</dependencies>

<requirements>
## Requirements

- **R005** (primary-user-loop) — Service-driven slide auto-assembly from service order. **The core deliverable.** The assembly engine maps ordered slots → an ordered slide array.
- **R006** (primary-user-loop) — Auto-reorder slides when service elements change order. Delivered reactively: a slot reorder re-runs assembly and the slideshow follows, with no manual intervention.
- **R007** (core-capability) — Formalized service sections. Delivered as an additive optional `section` field on slots, with sensible defaults assigned in `buildSlots()`.
- **R018** (quality-attribute, supporting) — Polished, intuitive editor UX. Section headers, dividers, and the inline slideshow preview must follow the existing dark-first Tailwind patterns and the SortableJS slot-list interaction.
</requirements>

<decisions>
## Governing Decisions (from M001)

- **D005 — Formalized service sections.** Four named service sections (Pre-Service, Worship, Message, Sending) are the default structure. Rationale: gives lay users a clear template rather than a blank canvas and makes slide auto-assembly deterministic. Alternative rejected: fully freeform service order (more flexible but harder for non-technical users to start with).
- **D001 — Unified slide data model.** A single slide type with a content-kind field (lyric, scripture, image, video, text) rather than distinct types per content kind. The assembly engine produces `AssembledSlide` wrappers over this one unified `Slide` type, keeping reordering and the user mental model simple ("one slide is one slide").
</decisions>

<acceptance>
## Acceptance Criteria

From M001-CONTEXT (the "S03:" acceptance line):

> A service has four named sections. Adding songs/scripture/etc. to sections auto-assembles the slideshow. Reordering elements reorders slides. Existing services are not broken.

Concretely, the phase is complete when:
- A service exposes the four named sections (Pre-Service / Worship / Message / Sending).
- Adding songs and scripture to the service causes the slideshow to auto-assemble from the service order.
- Reordering service elements reorders the assembled slides automatically.
- Existing (legacy, section-less) services continue to render and edit correctly with no migration.
</acceptance>

<boundary>
## Boundary — Produces / Consumes (from M001-ROADMAP)

**Produces (→ Phase 21 / S04):**
- Service section model (Pre-Service, Worship, Message, Sending)
- Slideshow assembly engine that accepts any slide source
- Service element → slide section binding

**Produces (→ Phase 23 / S06):**
- Assembled slideshow (ordered array of slides from all sources)
- Service-to-slideshow binding that auto-updates on reorder

**Consumes (from Phase 18 / S01 and Phase 19 / S02):**
- Song lyric slides from Phase 18 (live catalog references, via `performanceOrder`)
- Scripture slides from Phase 19 (via `scriptureReadingId`)
- The unified slide model and CRUD operations from Phase 18
</boundary>

<open_questions>
## Open Question (carried into planning)

- **Are sections configurable per-church, or fixed?** For v1 the model is **fixed** at the four default sections (D005). It can be made configurable per-church later. Planning should keep the section set defined in one place so a future per-church override is a localized change, not a rewrite.
</open_questions>

<prior_art>
## Prior Art / Existing Code

Grounding for the planner — the relevant existing code this phase evolves (all verified present in the repo):

- `src/types/service.ts` — Service model with ordered slots (`SongSlot`, `ScriptureSlot`, `NonAssignableSlot`, `HymnSlot`), `position` field, slot kinds. No section concept exists yet; the `ServiceSection` type and optional `section` field land here.
- `src/utils/slotTypes.ts` — Slot factory (`createSlot`), `reindexSlots()` (position-only, unchanged by this phase), `buildSlots()` progression-based templates (where default section assignments are added), `slotLabel()`.
- `src/stores/services.ts` — Pinia store for service CRUD. `createService()` calls `buildSlots()`; `updateService()` already accepts arbitrary partial updates. No structural change needed.
- `src/views/ServiceEditorView.vue` — Service editor with slot management (~2468 lines); currently a flat `v-for` over slots with SortableJS drag-and-drop. Largest UI change: section headers/dividers plus the inline slideshow preview panel.
- `src/types/slide.ts` — The unified `Slide` union (`LyricSlide | CopyrightSlide | ScriptureSlide`). Home for the new `AssembledSlide` wrapper (and possibly a `TextSlide` variant).
- `src/stores/songLyrics.ts` — Consumer: assembly reads current lyrics + `performanceOrder` to build per-song lyric slide sequences.
- `src/stores/scriptureSlides.ts` — Consumer: assembly reads scripture readings by `scriptureReadingId` to get pre-split `ScriptureSlide[]`.

New files anticipated (per research): `src/utils/slideshowAssembler.ts` (pure assembly function), `src/composables/useSlideshowAssembly.ts` (reactive wrapper), `src/components/SlideshowPreview.vue` (inline preview).

**Key constraint:** the `section` field must be optional and every code path must handle `section === undefined` (legacy services). No Firestore migration — `firestore.rules` already permits arbitrary fields on service docs.
</prior_art>

---

*Phase: 20-service-sections-and-slide-auto-assembly*
*Context synthesized 2026-07-24 from M001-CONTEXT.md, M001-ROADMAP.md, and 20-RESEARCH.md*
