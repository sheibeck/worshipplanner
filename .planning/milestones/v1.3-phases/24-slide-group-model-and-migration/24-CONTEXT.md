# Phase 24: Slide Group Model and Migration - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Milestone:** v1.3 — Slides Tab Rework

<domain>
## Phase Boundary

Give service plan items a stable identity, and introduce a persisted **slide group** layer anchored
to them. A group's order and membership mirror the service plan; its structure, media and audio are
independent of it. Replace Phase 22's slot-level media with group-level and per-slide audio.
Migrate existing services without data loss.

**This phase ships no UI.** It is the data model, the store, the migration, and the assembly change
that Phases 25–27 build on. The `ui-plan-gate` correctly reports `frontend: false`.

### Starting state (verified in the codebase, not assumed)

- `ServiceSlot` is `SongSlot | ScriptureSlot | NonAssignableSlot | HymnSlot | ImportedSlot`. Every
  variant carries `position: number` and `section?: ServiceSection`. **No variant has an `id`.**
  Slots are identified by array index and `position` only.
- Every variant extends `MediaAttachableSlot { audioUrl?, videoUrl? }` — the Phase 22 media model.
- **No slides are persisted per service.** `assembleSlideshow(service, inputs)` in
  `src/utils/slideshowAssembler.ts` derives every slide live from the song's canonical lyrics, the
  `scriptureSlides` store, and the `importedSlides` store. `AssembledSlide` / `AssembledSection`
  are transient assembly output, not storage.
- The assembler copies slot media onto only the FIRST emitted slide per slot.

</domain>

<decisions>
## Implementation Decisions

- **D-01 — `ServiceSlot` gets a stable `id`** Add `id: string` to every `ServiceSlot` variant, lazily backfilled on read; slide groups anchor to `slotId` rather than to `position` or a content key. Locked.
- **D-02 — Materialize group structure; keep text a live reference** The group (which slides exist, their order, audio, labels, notes) is persisted per service; song and scripture TEXT is never copied and continues to resolve live from the canonical record. Locked.
- **D-03 — Deleting a plan item deletes its slide group, behind a confirm** No orphans and no unanchored bucket; the delete is gated by a warning naming what will be lost. Locked.
- **D-04 — Audio precedence: slide beats group** Per-slide audio overrides the group bed for that slide and the bed resumes afterwards; `loop` is a per-slide flag only. Claude's discretion, stated.
- **D-05 — Phase 22 media migrates lazily** Slot `audioUrl`/`videoUrl` move onto the group bed on read, idempotently; the legacy fields stay readable but deprecated. Claude's discretion, stated.

The full rationale for each follows.

### D-01 — `ServiceSlot` gets a stable `id` *(locked)*

Add `id: string` to `ServiceSlot`, lazily backfilled when an existing service is read. Slide groups
anchor to `slotId`.

**Why not position:** reordering rewrites `position`, so a drag on the Service Order tab would
silently re-point groups at the wrong items. **Why not a content key** (kind + songId/importId):
breaks when the same song appears twice in one service, and follows the wrong thing when a slot's
song is swapped.

This touches every slot-writing path once. It is the only option under which drag-reorder cannot
mis-bind a group.

### D-02 — Materialize group structure; keep text a live reference *(locked)*

A slide group **is persisted per service** — which slides exist, their order, their audio, labels
and notes. Song and scripture **text is NOT copied**; it continues to render live from the canonical
song / scripture record, exactly as `assembleSlideshow` does today.

This is the reconciliation of two things the user said together: "always materialize" AND "if a
song's lyrics change… it would reflect in the slides since they are read-only for songs." Both hold
because slide text is read-only in the Slides tab (D007) — there is no editable text to diverge, so
nothing about the text needs copying. What needs storing is only what the user can actually change.

**Consequences:**
- Editing a song's lyrics still updates every service referencing it. D002 and D007 both survive.
- There is **no "Generate missing slides" button** — groups are always populated, nothing is ever
  missing. (The mockup's header button is cut; see `<deferred>`.)
- A group must reconcile when its underlying source changes shape — e.g. a song gains a verse after
  the group was materialized. Reconciliation strategy is a planning decision, but the rule is:
  never silently drop a user's added slide, audio, label or note.

### D-03 — Deleting a plan item deletes its slide group, behind a confirm *(locked)*

No orphans, no unanchored bucket. Removing a slot on the Service Order tab removes its group.

The delete must be gated by an explicit warning that **names what will be lost** (slide count, and
whether any attached audio/video or operator notes are among it) and requires confirmation. A silent
cascade is not acceptable — this is the failure-visibility half of R029.

**Why:** the user found the orphaned/unanchored model confusing and chose to revisit it later.
Because every group now belongs to a plan item, the mockup's `UNANCHORED` block has no remaining
purpose and is cut entirely — including its deliberate "Pre-service loop" case, which is expressible
as an ordinary Pre-Service plan item.

### D-04 — Audio precedence: slide beats group *(Claude's discretion, stated)*

Two audio layers exist: a **group bed** that plays across the group, and **per-slide audio** with a
scope toggle (`this slide only` / `all slides in this group`) and a `loop until next slide` flag.

Precedence: per-slide audio wins over the group bed for that slide; the bed resumes on the next
slide that has no audio of its own. `loop` is a per-slide flag only — a group bed does not loop.

This was not asked; it is stated so the planner does not have to invent it. Overridable.

### D-05 — Phase 22 media migrates lazily *(Claude's discretion, stated)*

`MediaAttachableSlot.audioUrl` / `videoUrl` move onto the group as its bed. Migration happens on
read, not as a one-time script: a service loaded without groups gets them constructed, and any slot
media found is carried onto the new group's bed. The old fields stay tolerated (readable) but
deprecated, so a half-migrated Firestore never breaks.

Risk is genuinely low — this model shipped in Phase 22 and was never deployed, so the population of
affected documents is small or empty. The lazy path is chosen anyway because it cannot fail halfway.

### Claude's Discretion

Store shape, Firestore collection layout vs embedding groups in the service document, group/slide id
generation, the reconciliation algorithm for D-02, and how `slideshowAssembler` is refactored to
read groups instead of deriving from scratch.

</decisions>

<canonical_refs>
## Canonical References

- `docs/design/slides-tab.dc.html` — the design contract for the whole milestone. **Cumulative and
  overwritten per design turn — re-pull before planning each phase.** Turn 1 = Slides tab (two
  states), Turn 2 = song lyrics editor (2a/2b).
- `docs/design/README.md` — turn map, Design Canvas runtime semantics, and the mockup-vs-instruction
  deltas.
- `src/types/service.ts` — `ServiceSlot` union, `MediaAttachableSlot`, `Service`, `SERVICE_SECTIONS`.
- `src/types/slide.ts` — `Slide` union, `SlideContentKind`, `AssembledSlide`, `AssembledSection`.
- `src/utils/slideshowAssembler.ts` — `assembleSlideshow(service, inputs)`, the current derivation.
- `src/composables/useSlideshowAssembly.ts` — returns `assembledSections`, `assembledSlideshow`.
- `src/components/SlotMediaAttachment.vue` — the Phase 22 slot-media UI this phase's model retires.
- `.planning/STATE.md` — milestone decisions D001–D009 and the v1.2 → v1.3 handoff note.

</canonical_refs>

<code_context>
## Existing Code Insights

- Slides are derived, never stored — so this phase introduces persistence where there was none. That
  is the bulk of the risk.
- `slideshowAssembler` already owns the "media lands on the first slide of the slot" rule; that rule
  is replaced by D-04's precedence, not extended.
- Phase 20 established `SERVICE_SECTIONS` as a single source-of-truth array and `createSlot()` that
  omits `section` entirely rather than writing `section: undefined` — preserve that byte-shape
  discipline when adding `id`.
- Phase 23's `PresentationViewer` consumes `assembledSlideshow` (the flat array). Any change to
  assembly output shape must keep that consumer working — Phase 23 is code-complete but its human
  verification is still outstanding, so breaking it would invalidate a pending checkpoint.
- Autosave rides a deep watch on `localService` in `ServiceEditorView`; group mutations must either
  ride that same path or declare their own, not silently create a second save path.

</code_context>

<specifics>
## Specific Ideas

- Warning copy on delete must name the count and call out attached media/notes explicitly, e.g.
  "Deleting 'This Is Our God' also deletes its 6 slides, including 1 attached audio file."
- Group bed and per-slide audio are distinct fields, not one field with a scope enum on the group —
  the scope toggle belongs to the slide.

</specifics>

<deferred>
## Deferred Ideas

- **Orphaned / unanchored slides and reassignment** — the mockup's `UNANCHORED` block, the
  "Orphaned: 'Offering' (2) — reassign" affordance, and any notion of a slide group surviving its
  plan item. Explicitly revisited later (user, 2026-07-25).
- **"Generate missing slides" header button** — obsolete under D-02.
- **Page-level "⇪ Import" header button** — cut as redundant with the per-group "Import into this
  group" action and the grid drop target. Its purpose was never defined.
- **Per-service slide text overrides** — permanently out; D002 + D007 keep text canonical.

</deferred>
