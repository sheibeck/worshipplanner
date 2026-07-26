# Phase 25: Slides Tab Shell — Plan Rail and Slide Grid - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning
**Milestone:** v1.3 — Slides Tab Rework
**Mode:** Smart discuss (autonomous) — 16 decisions across 4 areas, all accepted as recommended

<domain>
## Phase Boundary

Add the **Slides tab** to the service editor: a service-plan rail that mirrors plan order, plus a
slide grid for the selected group. This is the first phase of v1.3 that ships UI — Phase 24 built
the `slideGroups` data model, store, materializer and assembler underneath it.

**In scope:** the third tab itself; the plan rail (kind badges, slide counts, group-music
indicators, selection); the slide grid (cards with body/badge/number/label/audio chip,
within-group drag reorder); the group header actions (`＋ Add slide`, `⇪ Import into this group`,
`♪ Music for this group`); the drop target for PPTX / images / video / audio.

**Out of scope:** the Edit Slide drawer (Phase 26 — this phase leaves a clean seam for it), the
Service Order tab rename and the removal of Phase 18–23 slide surfaces from it (Phase 27), and the
song lyrics editor rework (Phase 28).

### Starting state (verified in the codebase, not assumed)

- `src/views/ServiceEditorView.vue` has a two-tab bar: `activeTab = ref<'music' | 'roles'>('music')`
  at line 1182, buttons at lines 402–416, panels at `v-show="activeTab === 'music'"` (line 422) and
  `v-show="activeTab === 'roles'"` (line 1007). This phase adds a third `'slides'` member.
- The tab bar's own styling was borrowed from `ServicesView.vue` (see quick-task `260713-wm9`).
- Phase 24 shipped `useSlideGroups` (`src/stores/slideGroups.ts`) with a `groupsBySlotId` getter, and
  `useSlideshowAssembly` already owns the single org-scoped subscription for this page.
- Reusable components exist: `PptxImportModal.vue` (Phase 21), `AudioPlayer.vue`,
  `ImportedSlideEditor.vue`, `ScriptureSlideEditor.vue`, `SlideshowPreview.vue`.
  `SlotMediaAttachment.vue` was retargeted at the group bed in 24-06.

</domain>

<decisions>
## Implementation Decisions

### Mockup-vs-locked-decision conflicts

The Phase 25 ROADMAP goal prose and `slides-tab.dc.html` both predate Phase 24's discuss. Where
they disagree with Phase 24's locked decisions, **Phase 24 wins**. R031's actual requirement text
asks only for "a plan rail mirroring service order (not draggable) plus a slide grid for the
selected group" — it does not require any of the three cut items.

- **D-01 — No `UNANCHORED` block.** The ROADMAP goal's "UNANCHORED block for orphans" and the
  mockup's `Pre-service loop · 6 slides` / `Orphaned: "Offering" (2) — reassign` rows are **omitted**.
  Phase 24 D-03 made every group belong to a plan item, so orphans cannot exist. Explicitly deferred
  for later revisit (user, 2026-07-25). Do not reintroduce an orphan model to satisfy the prose.
- **D-02 — No page-level `⇪ Import` header button.** Cut by Phase 24 as redundant with the
  per-group "Import into this group" action and the grid drop target; its purpose was never defined.
  "Page-level header actions" in the goal prose therefore means the existing `▶ Present` / `Save`
  header, not a new import entry point.
- **D-03 — No `Generate missing slides` header button.** Obsolete under Phase 24 D-02: groups are
  always populated, so nothing is ever missing.
- **D-04 — Rail note reads "order locked ⇄ Service Order" now.** The mockup says "⇄ Music"; D009
  renames that tab. Write the new name immediately rather than shipping "Music" and renaming it in
  Phase 27. The tab *button* itself is still renamed in Phase 27 — only this note anticipates it.

### Plan rail behaviour and states

- **D-05 — First group in plan order is auto-selected** when the Slides tab opens. Matches the
  mockup's positional framing ("group 3 of 9 · follows plan").
- **D-06 — No drag affordance on the rail at all.** The rail is not draggable and must not look
  draggable; the "order locked ⇄ Service Order" note is the sole explanation. Do not implement a
  draggable-looking rail that rejects the drop.
- **D-07 — Empty service shows a rail empty state pointing at the Service Order tab.** The Slides
  tab stays visible and reachable; it explains that plan items are added on the other tab.
- **D-08 — Zero-slide groups are shown with count `0`**, and their grid renders the empty state plus
  the drop target. Do not hide them from the rail — a `NonAssignableSlot` can legitimately hold none.

### Slide grid — cards and density

- **D-09 — Ship Grid only; defer the `List` view.** The mockup's `Grid`/`List` toggle is unrequired
  scope under R031 ("a slide grid"). Do not build the toggle as a one-option control — omit it.
- **D-10 — Card content is text body + kind badge + slide number + label + audio chip**, matching
  the mockup's `{{ s.body }}` / `{{ s.badge }}` / `{{ s.n }}` / `{{ s.label }}` / `♪ {{ s.audio }}`.
  True formatted-slide visual rendering remains deferred (see `<deferred>`).
- **D-11 — Slides ARE drag-reorderable within their group.** Slide order is user-owned under Phase
  24 D-02; only the *rail* mirrors the plan. This is the one place drag is correct on this tab.
- **D-12 — Clicking a card sets selection state and wires the seam Phase 26 fills.** No dead-end UI
  and no half-built drawer: the selection contract Phase 26 consumes is defined here, and the drawer
  itself lands next phase.

### Drop target and import

- **D-13 — A dedicated drop tile at the end of the grid, plus a whole-grid highlight on dragover.**
  The mockup shows the tile ("Drop PPTX, images, video" / "appends to this group"); the grid-wide
  highlight is added so the drop isn't a pixel hunt.
- **D-14 — Accept PPTX, images, video AND audio.** R032 names audio explicitly. Audio is special:
  it attaches as the **group bed**, it does not append a slide. The mockup's tile copy is extended
  accordingly. **See D-17 — video is NOT symmetrical with audio.**

- **D-17 — Add a real `VideoSlide` type; dropped video appends a slide.** *(added 2026-07-26,
  owner decision, after 25-RESEARCH.md surfaced the gap)*

  **The gap.** Phase 25 research found that the codebase cannot express a video slide.
  `SlideContentKind` (`src/types/slide.ts:9`) lists `'video'` as a string member, but **no
  `VideoSlide` interface exists** — the actual union is
  `Slide = LyricSlide | CopyrightSlide | ScriptureSlide | TextSlide | ImageSlide` (line 100), and
  `ImportedDeck.slides` is `(TextSlide | ImageSlide)[]`. Video today is a **group-bed-only** concept:
  `SlideGroup.bedVideoUrl` (`src/types/slideGroup.ts:43`) exists and `PresentationViewer` already
  renders it. So the UI-SPEC's approved drop-tile copy ("video appends a slide") was unbuildable
  as written.

  **The decision.** Introduce a genuine `VideoSlide` variant rather than degrading video to a bed.
  Dropped video **appends a video slide** to the selected group, symmetrical with images — NOT
  symmetrical with audio (audio remains bed-only per D-14).

  **Acknowledged cost.** This is a data-model change of the kind Phase 24 owned, landing inside a
  `risk:medium` UI phase. The owner was shown this trade-off explicitly and chose it. It ripples into
  at minimum:
  - `src/types/slide.ts` — the `VideoSlide` interface + its place in the `Slide` union
  - `src/types/slideGroup.ts` — `GroupSlideEntry` must be able to carry a video entry
  - `src/utils/slideGroupMaterializer.ts` — derive/reconcile must tolerate video entries
  - `src/utils/slideshowAssembler.ts` — emit video slides into `AssembledSlide`
  - `src/components/PresentationViewer.vue` — render a video SLIDE distinctly from the existing bed
    video (Phase 23 is code-complete with human-verify still outstanding — **do not regress it**)

  `ImportedDeck.slides` is deliberately NOT widened: PPTX decks contain no video, so the deck type
  stays `(TextSlide | ImageSlide)[]`.

  **Planning guidance:** give the type/model work its own plan and wave, landing BEFORE the drop
  target that depends on it. Do not bury it inside a UI plan.

- **D-18 — There is NO bed video. Video is slide-only; only audio can be a group bed.**
  *(user, 2026-07-26, mid-execution of Phase 25 Wave 1 — supersedes part of Phase 24 D-05 and
  narrows D-17)*

  > "We won't ever have a bed video where a video plays over a whole group of slides. We can do that
  > for audio, but a video slide will only ever be a slide and will never play over a group of
  > slides." — user

  **This removes a capability Phase 24 built.** `SlideGroup.bedVideoUrl` and the whole
  `videoFromBed` render path are deleted, not deprecated. The group bed becomes **audio-only**.

  **Legacy data:** a Phase 22 slot-level `videoUrl` is **dropped, not migrated** (user: *"This is
  greenfield work and isn't even in production yet"*). Phase 24 D-05's
  `...(slot.videoUrl ? { bedVideoUrl: slot.videoUrl } : {})` line is removed outright. The
  deprecated `MediaAttachableSlot.videoUrl` field stays readable for type compatibility but nothing
  migrates or renders it. This is the one place where a deliberate data drop is authorized, and it
  is authorized only because nothing is deployed.

  **Surfaces to strip (verified 2026-07-26, 10 source + 5 test files):**
  - `src/types/slideGroup.ts` — remove `bedVideoUrl`
  - `src/types/slide.ts` — remove `SlideBase.videoUrl` (the bed carrier) and `videoFromBed`
  - `src/utils/slideshowAssembler.ts` — remove `videoFromBed` computation and the bed-video branch of `resolveEntryMedia`
  - `src/utils/slideGroupMaterializer.ts` — remove the D-05 slot-video migration line; `hasCustomization` no longer considers bed video
  - `src/stores/slideGroups.ts` — `setGroupBedMedia` becomes audio-only (drop `bedVideoUrl` / `clearVideo`)
  - `src/components/PresentationViewer.vue` — remove the `videoFromBed` bed-video block
  - `src/views/ServiceEditorView.vue` — remove `displaySlotVideoUrl`, the `'attached video'` delete-warning line, and the `bedVideoUrl` write path
  - tests: `PresentationViewer.test.ts` (`bedVideoSlide` helpers), `slideGroups.test.ts`,
    `slideGroupMaterializer.test.ts`, `slideshowAssembler.test.ts`, `ServiceEditorView.test.ts`

  **Consequence for D-17:** `VideoSlide.videoSrc` keeps its distinct field name (it is unambiguous
  and already shipped in 25-01), but the doc-comment rationale about colliding with a bed carrier is
  now obsolete — rewrite it rather than leaving a comment that describes a model that no longer
  exists.

  **Consequence for Phase 23:** `PresentationViewer`'s bed-video path was code-complete with human
  verification still outstanding. That path is now being *removed*, so there is nothing left to
  regress — the earlier "do not regress bed video" acceptance criterion is void and must be replaced
  with "bed video no longer renders anywhere."

  **Sequencing:** removal and video-slide rendering MUST land in the SAME plan. Splitting them would
  leave an intermediate commit in which both media models are live — exactly the dual-model state
  Phase 24 was designed to end.

- **D-19 — No legacy compatibility for ANY slide-related work. Delete it, don't deprecate it.**
  *(user, 2026-07-26, mid-execution of Phase 25 — generalizes D-18)*

  > "There is no need to keep legacy behavior for any work related to adding slides. That work has
  > never been used or seen by anyone yet. So, we don't need to migrate anything or keep any old
  > data." — user

  ### The boundary (read this before deleting anything)

  **GREENFIELD — drop all legacy handling, migrations, fallbacks and deprecated fields:**
  everything introduced from **Phase 18 onward** — slide groups, slide/group media, the slideshow
  assembler, PPTX import, scripture slides, presentation/preview surfaces. None of it has ever been
  deployed or seen by a user.

  **PRODUCTION — legacy handling MUST be preserved:** `Service` and `ServiceSlot` themselves. The
  service planner shipped in **v1.0 (2026-03-05)** and was human-verified against a real Planning
  Center account, so real slot documents exist in the wild. In particular **Phase 24 D-01's
  lazy `ServiceSlot.id` backfill-on-read STAYS** — removing it would break every existing service.

  ### Authorized deletions under D-19

  - Phase 24 **D-05's lazy media migration** (slot `audioUrl`/`videoUrl` → group bed) — delete the
    whole path, not just the video half.
  - The Phase 24 code-review **WR-02 fallback** helpers `displaySlotAudioUrl` / `displaySlotVideoUrl`
    in `ServiceEditorView.vue`, which exist solely to read the deprecated slot-level fields. WR-02
    was a correct fix *given* a legacy model; with no legacy data the fallback is dead code.
  - The deprecated **`MediaAttachableSlot.audioUrl` / `videoUrl`** fields themselves, once nothing
    reads them.
  - Any "tolerate half-migrated documents" branch in the materializer or store.

  ### Rule going forward (Phases 26-28)

  Do not write migration paths, deprecation shims, or read-time fallbacks for slide-area data.
  Change the model directly and update the tests. If a change would need a migration to protect real
  users, that is a signal it has crossed into `Service`/`ServiceSlot` territory — stop and check the
  boundary above rather than assuming greenfield.
- **D-15 — Reuse `PptxImportModal.vue`** from Phase 21 for the PPTX path rather than creating a
  second import implementation.
- **D-16 — Imports append at the END of the selected group** — R032's exact words ("imports and
  media append to the selected group"), not inserted at the current selection point.

### Claude's Discretion

Component decomposition (single `SlidesTab.vue` vs rail/grid/card split), how selection state is
held and shared with the future drawer, grid CSS layout and responsive breakpoints, drag-reorder
library choice (SortableJS is already used for the slot list — reuse is preferred but not
mandated), empty-state copy, and how the drop target distinguishes the four accepted file types.

</decisions>

<canonical_refs>
## Canonical References

- `docs/design/slides-tab.dc.html` — **Turn 1, State 1 (`default`)** is this phase's contract, at
  lines 229–369. State 2 (`Edit Slide open`) belongs to Phase 26. **Cumulative and overwritten per
  design turn — re-pull before planning.**
- `docs/design/README.md` — turn map, Design Canvas runtime semantics, and the known
  mockup-vs-instruction deltas (tab rename; `renderVals()` is sample data, not a schema).
- `.planning/phases/24-slide-group-model-and-migration/24-CONTEXT.md` — D-01..D-05, and the
  `<deferred>` list this phase's D-01..D-03 enforce.
- `.planning/milestones/v1.2-REQUIREMENTS.md` — R031 (primary-user-loop), R032 (core-capability).
- `src/views/ServiceEditorView.vue` — tab bar at 402–416, `activeTab` at 1182.
- `src/stores/slideGroups.ts`, `src/composables/useSlideshowAssembly.ts` — the Phase 24 data layer.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PptxImportModal.vue` — Phase 21's import flow, teleports to `<body>`; reuse per D-15.
- `AudioPlayer.vue` — gained a `loop` prop in 24-04; usable for the group-music indicator preview.
- `SlotMediaAttachment.vue` — retargeted at the group bed in 24-06 (`displaySlotAudioUrl` /
  `displaySlotVideoUrl` helpers); the "Music for this group" control should build on it.
- The `ServicesView.vue` tab-bar styling already cloned into `ServiceEditorView.vue`.

### Established Patterns
- SortableJS drives the existing slot list with `draggable: '.slot-item'` scoping (Phase 20-04).
- Modals teleport to `<body>`; testing them needs `DOMWrapper` over `document.body` plus
  `enableAutoUnmount(afterEach)` (Phase 21) and `stubs: { teleport: false }` under `shallowMount`
  (discovered in 24-06).
- Autosave is a deep watch on `localService` with an 800ms debounce and a saving guard; remote
  snapshots merge only when `autosaveStatus` is idle/saved.

### Integration Points
- `activeTab` union widens `'music' | 'roles'` → `'music' | 'roles' | 'slides'`; a third button and
  a third `v-show` panel.
- Group data comes from `useSlideGroups().groupsBySlotId` keyed by the `ServiceSlot.id` Phase 24
  made required — the rail iterates `localService.slots` in `position` order and looks each up.
- Slide mutations must ride the Phase 24 store actions (`replaceGroupSlides`, `setGroupBedMedia`),
  NOT a new save path and NOT the `localService` deep watch.

</code_context>

<specifics>
## Specific Ideas

- Rail row anatomy from the mockup: `{{ g.kind }}` badge · `{{ g.count }}` · `{{ g.title }}`, with a
  `♪ group music: {{ g.bed }}` line only when a bed exists.
- Grid header from the mockup: title `Song — This Is Our God`, subtitle `group 3 of 9 · follows plan`,
  and the reading-order hint `Plays 1 → 6, left to right then down`. The "follows plan" phrasing is
  the user's mirror-not-duplicate principle stated in the UI itself — keep it.
- Group music control shows the filename and its scope, e.g. `pad_Cmaj_soft.mp3` /
  `plays across all 6 slides`.
- `docs/example.pptx` and `docs/example.mp3` are present in the working tree (untracked) and are
  real user-provided files usable as drop-target fixtures.

</specifics>

<deferred>
## Deferred Ideas

- **`UNANCHORED` / orphaned slides and reassignment** — carried forward from Phase 24's deferral;
  needs an orphan model that D-03 deliberately removed. Revisit as its own phase.
- **`List` view toggle** — the mockup's second view mode, unrequired by R031.
- **Formatted slide rendering on cards** — showing real slide visuals rather than text bodies.
  Long-standing user request (STATE.md, 2026-07-25) still awaiting its own phase.
- **Page-level `⇪ Import` and `Generate missing slides` header buttons** — cut, see D-02/D-03.

</deferred>
