# Phase 30: Slides Mirror the Plan — Hard Lock & Reconciliation Removed - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Slide-group order and membership are hard-locked to the service order. The reconcile/confirm review
flow is deleted entirely and replaced by one unconditional rebuild path. Song groups become read-only
in the Slides tab.

**Requirements:** R045, R046, R047, R048, R054.

**In scope:** `slideGroupMaterializer.ts`, `useSlideshowAssembly.ts`, `slideGroups.ts`,
`slideGroup.ts`, `SlideGrid.vue`, `SlidesTab.vue`, `slideDisplay.ts`, `ServiceEditorView.vue`,
`ReconcileConfirmModal.vue` (deleted), and their tests.

**Out of scope:** background images (Phase 33), the 3-dot menu and split drawers (Phase 33), LLM
congregational splitting (Phase 34), CCLI/copyright placement (Phase 35), the save-status indicator
(Phase 32).

</domain>

<decisions>
## Implementation Decisions

### "Always mirror" semantics

- **Source-derived slides rebuild; hand-added slides survive, appended after.** The rebuild replaces
  only what came from the source. This honors Phase 24 D-02 ("never silently drop a user's added
  slide") without needing a dialog — which is what makes deleting the confirm gate safe.
- **Any change to the service item's source triggers a rebuild** — song swap, scripture passage
  change, deck re-import, or a service-order move. Reactive, not manual.
- **Both order AND membership are locked.** Group sequence follows service-order sequence, and a group
  exists for exactly the service items that exist. Deleting a service item deletes its group.
- **The passive "diverged" banner is removed entirely.** With auto-mirroring there is no divergence
  state left to communicate.

### Deleting the subsystem

- **Leave stored `dismissedSignature` values in Firestore; remove the field from the type**
  (`src/types/slideGroup.ts:57`). Per D-19 the slide area is greenfield — never deployed, never seen by
  a user — so the stored values are meaningless residue. A cleanup write against every group document
  to delete a field nothing reads is risk for no benefit. **This is the explicit leave-vs-backfill
  decision the ROADMAP required; it is recorded here rather than made by omission.**
- **Delete the reconciliation tests outright — no `describe.skip`.** A skipped suite passes vacuously
  and reads as coverage. `ReconcileConfirmModal.test.ts` goes entirely, with the component.
- **KEEP the `replaceGroupSlides` concurrent-write transaction merge.** It is a generic conflict guard,
  unrelated to the confirm UX, and it matters *more* once every write becomes unconditional.
- **Prove removal by grep + type-check.** Zero occurrences across `src/` of `reconcileSongGroup`,
  `dismissedSignature`, `ReconcileResult`, `needsConfirm`, `dismissReconciliation` — including dynamic
  imports and template/string references a symbol search alone would miss.

### Song groups read-only (R054) and scripture defaults (R047)

- **A song group blocks ALL slide CRUD and reorder** in the Slides tab — no add, edit, delete,
  duplicate, or drag within the group. The group still participates in service-order sequence (which it
  does not control) and still accepts group-level media.
- **The user gets the existing "Edit in song" link** (Phase 26's `songEditLink.ts`) plus a visible
  read-only affordance, so it reads as deliberate rather than broken.
- **★ A scripture slide defaults to ONE slide showing the passage REFERENCE ONLY** — e.g.
  "Psalm 103:1–5" — **not the scripture text.** Full scripture text is added only through the
  congregational reading feature (R064, Phase 34).

  > *"Just one slide for scripture that has the passage reference only. Full scripture can be added in
  > congregational follow-up."* — owner, 2026-07-28

  This keeps Phase 34 purely additive instead of a rewrite of this phase, and removes any
  "what if the passage is long" question — there is no long text to fit. R047's wording in
  REQUIREMENTS.md was tightened to match, because "one slide carrying the passage" was ambiguous
  between reference and text.
- **A passage change replaces the slide's content outright.** The slide is source-derived; a changed
  passage means the old reference is simply wrong. Users must not be silently hand-editing scripture.

### Rebuild mechanics and proving the lock

- **Groups stay PERSISTED and are rebuilt deterministically on every service-order write** — not
  derived on read. Groups carry state the service order does not (group media, backgrounds, hand-added
  slides), which a pure derive-on-read would destroy.
- **Rebuild MUST be idempotent, and that must be asserted.** Running it twice is byte-identical. The
  v1.3 compounding bug (2→4→8→16 slide duplication) came from a non-idempotent rebuild on the additive
  path — the path with no confirm gate. After this phase, *every* path is that path.
- **Prove the lock with a property test**: for any permutation of the service order, group sequence
  equals slot sequence. Not example-based — the bug class is "some particular arrangement desyncs."
- **One human-verify item:** swap a song on a real service and confirm the slides update with no
  prompt. That is the exact user-reported symptom behind R046.

### Claude's Discretion

- The visual treatment of the read-only affordance on song groups (follow UI-SPEC once written).
- Whether the rebuild lives in `slideGroupMaterializer.ts` or moves up into `useSlideshowAssembly.ts`.
- How hand-added slides are distinguished from source-derived ones in the model (a flag, provenance
  field, or positional convention) — pick whatever survives the idempotence assertion most simply.

</decisions>

<code_context>
## Existing Code Insights

### Consumer surface (verified by grep, 2026-07-28)

**Source (6 files):**
- `src/utils/slideGroupMaterializer.ts` — `reconcileSongGroup`, the three-branch logic
- `src/composables/useSlideshowAssembly.ts` — the confirm orchestration; `needsConfirm` branches at
  lines ~391, 421, 454, 481-498; `pendingReconciliationsMap`; `songSwap` old/new title resolution
- `src/stores/slideGroups.ts` — `dismissReconciliation` writes at line ~225 via a scoped `updateDoc`
  carrying only `dismissedSignature` + `updatedAt`
- `src/types/slideGroup.ts:57` — `dismissedSignature?: string`
- `src/components/slides/SlideGrid.vue`
- `src/components/slides/ReconcileConfirmModal.vue` — deleted entirely

**Tests (4 files):** `ReconcileConfirmModal.test.ts` (delete entirely),
`useSlideshowAssembly.test.ts`, `slideGroups.test.ts`, `slideGroupMaterializer.test.ts`.

`SlidesTab.vue`, `slideDisplay.ts` and `ServiceEditorView.vue` are named in the ROADMAP's 9-file
inventory but did not surface in the symbol grep — confirm during planning whether they hold
string/template references or are simply stale entries in the inventory.

### Prior-art warnings from this codebase

- **The v1.3 compounding bug (28-03):** `reconcileSongGroup` pushed the WHOLE `storedBySectionId` array
  on every occurrence of a section id, so a twice-referenced chorus compounded 2→4→8→16 — on the
  *additive* path, which has no confirm gate. Fixed by consuming stored entries positionally. After
  this phase every path is the additive path, so idempotence is load-bearing.
- **26-09's Map-keying defect:** `reconcileSongGroup` once indexed stored lyric entries into a `Map`
  keyed by `sectionId`, silently dropping duplicated entries. Fixed before `Duplicate` shipped.

Both are the same failure class: a rebuild that is not order- and multiplicity-preserving.

### Phase 29 carry-over (just completed)

- `src/utils/slotTypes.ts` gained `groupBySection` / `flattenBySection` / `orderSlotsBySection`; the
  slots array is now section-major at every mutation site. Service-order sequence is therefore a
  reliable input to group ordering — which it was not before Phase 29.
- `ServiceSlot.id` is stable and is what anchors slide groups.
- A fifth `'post-service'` section exists; groups must handle it with no special-casing.

</code_context>

<specifics>
## Specific Ideas

- Owner: *"When I take an existing song in the service order and change it to a different song I get a
  review on the Slides tab. When I review and accept those changes, the slides don't actually update to
  the new song."*
- Owner: *"Do we even need to review? I don't think so. We should always honor the service order and
  the order of its items in our slide list."*
- Owner: *"I had scripture, song, song. I then moved the scripture between the two songs, but the
  slides tab still showed scripture, song, song."*
- Owner: *"Song groups in the Slides tab should not be editable. Don't [allow] CRUD operations on these
  group items at all. They should only be editable from the Song Lyrics screen... this makes it so
  someone can't mess with songs."*

</specifics>

<deferred>
## Deferred Ideas

- **Background images** at group/slide/song level — Phase 33 (R055-R057).
- **The 3-dot menu and split Edit details / Edit lyrics drawers** — Phase 33 (R051, R052).
- **LLM congregational reading splits** — Phase 34 (R064). This phase deliberately leaves scripture
  slides as reference-only so Phase 34 is additive.
- **CCLI/copyright placement on first and last slide** — Phase 35 (R060).
- **Marking the Slides tab to signal "a change needs your attention"** — the owner raised this, but
  auto-mirroring removes the need: there is no pending user action left to advertise. Recorded here so
  the idea is not silently dropped; revisit only if auto-mirroring proves insufficient in practice.

</deferred>
