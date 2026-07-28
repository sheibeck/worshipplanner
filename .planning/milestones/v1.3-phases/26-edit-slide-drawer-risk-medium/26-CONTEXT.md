# Phase 26: Edit Slide Drawer - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning
**Milestone:** v1.3 — Slides Tab Rework
**Mode:** Smart discuss (autonomous) — 16 decisions across 4 areas; 3 areas accepted as recommended,
Area 2 simplified by the user

<domain>
## Phase Boundary

Build the **Edit Slide drawer** — the detail panel for the slide selected in Phase 25's grid. It
floats over the page with nothing underneath reflowing (R033), and carries: slide preview, label,
read-only slide text with an "Edit in song" link, slide audio with a scope toggle and loop flag,
operator-only notes, duplicate, and delete.

Phase 26 also **closes cross-phase debt** that Phases 24 and 25 both deferred to it: the
**reconciliation confirm dialog**. Phase 25 ships only a passive, non-blocking banner; until this
phase, a group whose source signature diverged is stuck showing that banner with no way to resolve it.

**Out of scope:** the Service Order tab rename and the removal of Phase 18-23 slide surfaces from it
(Phase 27); the song lyrics editor rework (Phase 28).

### Starting state (verified in the codebase, not assumed)

- `src/components/slides/SlidesTab.vue` already owns the seam: `selectedSlotId` and `selectedSlideId`
  refs, with `selectedSlideId` nulled on group change and cleared when the selected slide disappears
  from the group. Documented in the file's own header comment. Phase 26 consumes this — do not
  redesign it.
- `SlideGrid.vue` renders a passive `pendingReconciliations` banner and deliberately has NO
  apply/reject UI.
- Phase 24/25 store actions available: `replaceGroupSlides` (now with an optional `baseSlides`
  compare-and-swap via `runTransaction`, added by 25-REVIEW-FIX CR-02), `setGroupBedMedia`
  (audio-only), and `ensureGroupMaterialized` in `useSlideshowAssembly`.
- `src/components/SongSlideOver.vue` is the established slide-over pattern in this codebase.

</domain>

<decisions>
## Implementation Decisions

### Drawer mechanics and the Phase 25 seam

- **D-01 — Fixed-position overlay, nothing underneath reflows.** A right-side floating panel, reusing
  `SongSlideOver.vue`'s established pattern. R033 states the no-reflow requirement explicitly; a
  push-content drawer does not satisfy it.
- **D-02 — Live-apply per field, not a staged buffer.** Label, notes, audio scope and loop write
  through the store as they change. The mockup's `Save`/`Cancel` pair is kept only for a field that
  genuinely needs staging; cheap fields autosave. This matches how the rest of the app behaves.
- **D-03 — The drawer follows the selection.** It is a detail panel for `selectedSlideId`. Phase 25
  already nulls that on group change and on slide disappearance, so the drawer inherits correct
  behavior for free. Do NOT close the drawer on every selection change.
- **D-04 — Ship `Duplicate`; defer the mockup's `Tag` and `Details`.** Duplicate is well-defined
  against `replaceGroupSlides`. `Tag` and `Details` appear in the mockup with no defined behavior
  anywhere in the requirements or instructions — deferring beats inventing.

### Reconciliation confirm dialog — *user simplified this area*

- **D-05 — Its own modal, launched from Phase 25's passive banner.** Reconciliation is a GROUP-level
  decision, not a slide-level one, so it does not belong inside the slide drawer.
- **D-06 — No diff view.** *(user override — the recommended answer was a source-vs-group diff.)*
  Warning text plus the two actions is enough. **Accepted trade-off, stated plainly:** the user cannot
  see exactly what they would lose before choosing. The warning copy must therefore be as concrete as
  it can be without a diff — name counts and kinds ("3 slides you added, including 1 with attached
  audio"), following the Phase 24 D-03 delete-warning precedent.
- **D-07 — Two actions: `Apply source changes` / `Dismiss`.**
  > ⚠ **Interpretation flag — correct this if wrong.** The user chose "Apply/Dismiss" over
  > "Apply / Keep my version". The stated trade-off was about dropping the diff, not about nagging, so
  > **`Dismiss` is implemented as DURABLE** — it records the decision so the banner and dialog do not
  > re-prompt for the same unchanged signature on every load. A dismissal that re-asks forever would
  > be worse than the passive banner Phase 25 already ships.
- **D-08 — The song-identity swap reuses this dialog with specific copy**, naming the old and the new
  song. That case is Phase 24's CR-01 blocker (reassigning a song silently blended the old song's
  copyright and orphaned lyric entries into the new group); the confirm gate is what makes it safe.

### Slide audio — scope and loop

- **D-09 — `All slides in this group` writes the GROUP BED** via `setGroupBedMedia`, rather than
  copying the URL onto every slide entry. One source of truth, and the bed already exists.
- **D-10 — Slide beats bed.** Phase 24 D-04's precedence, already implemented, and extended to video
  by 25-REVIEW-FIX WR-01 (a video slide suppresses the bed for its own duration; the bed resumes on
  the next slide without its own audio).
- **D-11 — `Loop until the next slide` is a per-slide flag only.** Phase 24 D-04 is explicit: a group
  bed does not loop.
- **D-12 — No audio control on a video slide.** The video carries its own audio and now suppresses the
  bed, so offering an audio attachment there would create a conflict the model deliberately removed.

### Read-only slide text and "Edit in song"

- **D-13 — Slide text is read-only here.** D002 (single canonical song lyric version; services
  reference live, never copy) and D007. Per-service text overrides are permanently out — Phase 24's
  `<deferred>` records this as a closed question. Do not add an override path.
- **D-14 — "Edit in song" navigates by ROUTE to the song's lyrics editor**, not a deep link into that
  editor's current internals. **Phase 28 is about to rework that editor**, so anything coupled to its
  present structure would break one phase later.
- **D-15 — The link is per slide kind:**
  | Slide kind | Affordance |
  |---|---|
  | lyric / copyright (song) | "Edit in song" → the song's lyrics editor |
  | scripture | "Edit in scripture" → the scripture source |
  | imported / image / video | no link — there is no canonical text to edit |
  | authored text (25-01's widened `text` SourceRef) | **editable inline in the drawer** — it has no canonical source, the drawer IS its home |
- **D-16 — Confirm before navigating away** if the drawer holds unsaved edits, so following the link
  cannot silently discard work.

### Claude's Discretion

Drawer width and responsive behavior, whether `Save`/`Cancel` render at all given D-02's live-apply,
how the durable dismissal in D-07 is persisted (a field on the group vs a signature stamp), the
duplicate-slide id/label convention, preview rendering fidelity inside the drawer, and component
decomposition.

</decisions>

<carried_forward>
## Still cut — do not reintroduce (carried from Phase 25)

The mockup's State 2 screen still shows all of these; they remain cut:

- `UNANCHORED` / orphaned-slides block (25 D-01)
- page-level `⇪ Import` header button (25 D-02)
- `Generate missing slides` (25 D-03)
- `Grid` / `List` view toggle (25 D-09)
- any drag affordance on the plan rail (25 D-06)
- formatted slide rendering — text bodies only (25 D-10)

## Standing milestone decisions that bind this phase

- **D-18 (v1.3):** there is NO bed video. Video is slide-only. Group bed is audio-only.
- **D-19 (v1.3):** no legacy compatibility anywhere in the slide area — no migrations, no deprecation
  shims, no read-time fallbacks. **Exception:** Phase 24 D-01's lazy `ServiceSlot.id` backfill stays
  (services are real production data). Full boundary table in `.planning/STATE.md`.

</carried_forward>

<canonical_refs>
## Canonical References

- `docs/design/slides-tab.dc.html` — **Turn 1, State 2 (`Edit Slide open`)**, from ~line 369, is this
  phase's contract. Cumulative and overwritten per design turn — re-pull before planning.
- `docs/design/README.md` — Design Canvas runtime semantics; `renderVals()` is sample data, not schema.
- `.planning/phases/25-.../25-CONTEXT.md` — D-01..D-19, especially the cut list and D-12's seam.
- `.planning/phases/25-.../25-UI-SPEC.md` — the approved design contract, including its two
  DEVELOPER-APPROVED EXCEPTION blocks (3 font weights + `text-[10px]`; 6px `gap-1.5`) which this phase
  must also honor and must NOT "correct".
- `.planning/phases/24-.../24-CONTEXT.md` — D-02 (materialize structure, text stays a live reference),
  D-03 (delete warning names what is lost), D-04 (audio precedence).
- `.planning/milestones/v1.2-REQUIREMENTS.md` — R033. (There is no `.planning/REQUIREMENTS.md`.)
- `src/components/slides/SlidesTab.vue` — the `selectedSlotId` / `selectedSlideId` seam.
- `src/components/SongSlideOver.vue` — the slide-over pattern to reuse.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SongSlideOver.vue` — the established floating panel; D-01 reuses its pattern.
- `AudioPlayer.vue` — has a `loop` prop (added 24-04) and a `chromeless` mode (Phase 23).
- `SlideGroupMusicControl.vue` (25-06) — the group-bed control; D-09's "all slides in this group"
  should route through the same store action rather than a parallel path.
- `slideDisplay.ts` (25-03/25-04) — shared `slideBodyText`, `slideFooterLabel`, `PendingReconciliation`.

### Established Patterns
- Modals/slide-overs teleport to `<body>`. Testing needs `DOMWrapper` over `document.body` plus
  `enableAutoUnmount(afterEach)`; under `shallowMount`, Teleport is auto-stubbed so
  `stubs: { teleport: false }` is required.
- All slide-group mutations go through `useSlideGroups()` store actions — never
  `ServiceEditorView.vue`'s `localService` deep-watch autosave.
- `replaceGroupSlides` now takes an optional `baseSlides` for compare-and-swap (25-REVIEW-FIX CR-02).
  Any new write path in this phase should pass its read snapshot through, for the same reason.
- Tailwind v4 purges dynamically-built class names — use static, fully-spelled-out class maps.

### Integration Points
- The drawer mounts inside `SlidesTab.vue` against `selectedSlideId`.
- The reconciliation modal launches from `SlideGrid.vue`'s existing passive banner.
- Slide-level writes go through `replaceGroupSlides`; group-bed writes through `setGroupBedMedia`.

</code_context>

<specifics>
## Specific Ideas

- Drawer control labels from the mockup, to use verbatim: `Edit Slide`, `Slide Label`, `Slide Text`,
  `Slide Audio`, `Play this audio for`, `This slide only`, `All slides in this group`,
  `▣ Loop until the next slide`, `Notes`, `Remove`, `Duplicate`, `Delete Slide`.
- Warning copy for both destructive/lossy confirmations should follow Phase 24 D-03's precedent —
  name the count and call out attached media or notes explicitly, e.g.
  "Deleting this slide also removes its attached audio and operator notes."
- The reconciliation warning (D-06, diff-less) must be as concrete as it can be without a diff:
  counts and kinds, not a generic "your changes may be lost".

</specifics>

<deferred>
## Deferred Ideas

- **`Tag` and `Details`** — mockup affordances with no defined behavior (D-04).
- **A source-vs-group diff view** for reconciliation — explicitly traded away by the user for a
  simpler dialog (D-06). Revisit if the diff-less warning proves too vague in real use.
- **Per-service slide text overrides** — permanently out (D002/D007, Phase 24 `<deferred>`).
- **Keyboard slide reordering** — SortableJS provides none; flagged in 25-05, still open.
- **`UNANCHORED` / orphaned slides** — still deferred from Phase 24.

</deferred>
