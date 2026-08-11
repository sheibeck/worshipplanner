# Phase 49 PRD — Congregational Reading: Dedicated Reference Slide

## Problem

Today a congregational reading assembles to **N slides for N sections**. The scripture
reference is not a slide of its own — it is rendered as an *eyebrow on the first section
slide* (Phase 47's `isFirstSection` / R097). The owner wants the reference to occupy its
**own dedicated first slide**, exactly like a plain (non-congregational) scripture reference
slide, with the section text slides following it.

Owner framing (2026-08-09):
> "A scripture slide always has a slide of the scripture reference. If we make it
> congregational, we keep that first slide as is and only add additional slides that have the
> scripture text."

## Requirement

**R105** — A congregational reading assembles to **N+1 slides**: slide 1 is the scripture
reference (byte-identical to a plain scripture reference slide: `readingMode: 'normal'`, empty
`text`, no `section`), slides 2..N+1 are the sections. Section slides show **only** the
scripture text and speaker label — the reference eyebrow no longer appears on any section slide.

## Locked decisions (owner, 2026-08-09)

1. **Approach B — assembly-time synthetic leading reference slide.** The reference slide is
   emitted at assembly time in `slideshowAssembler.ts`, in **both** the fallback path and the
   stored-group path. It is **NOT** added as a stored `GroupSlideEntry`.

   *Why not a stored entry (approach A):* `slideGroupMaterializer.ts::derivedIdentityKey`
   returns the constant `'scripture'` for every scripture entry, and
   `carryStoredDerivedEntries` matches fresh vs. stored scripture entries **positionally** by
   that key. Prepending a reference entry (shifting sections from order 0..N-1 to 1..N) would
   misalign the positional carry on the next rebuild, scrambling per-section entry
   ids/attached audio. `sourceSignature` is computed from the slot's reference + sections
   (not from `deriveGroupEntries` output), so a reference entry would not even change the
   signature that gates the DETACHED short-circuit. Approach A is therefore rejected.

2. **Section slides are text-only.** Suppress the reference eyebrow on congregational section
   slides now that the reference has its own slide. The display gate
   (`slideDisplay.ts::showReference`, `PresentationViewer.vue`'s `isFirstSection` v-if) must
   no longer show the reference on a section slide.

3. **Migration:** Congregational readings were never deployed (Phase 47 was deploy-gated), so
   there is no production data to migrate. Even so, the group reconciliation invariants
   (carry/detach/signature) must remain intact — approach B touches none of them, which is the
   point.

## Acceptance criteria

1. For a congregational slot with N sections, `assembleSlideshow` returns N+1 `AssembledSlide`s:
   index 0 is the reference slide (`readingMode: 'normal'`, `text: ''`, no `section`), indices
   1..N are the section slides in order.
2. A **plain** (non-congregational) scripture slot is unchanged: exactly one reference slide.
3. The reference slide's content is byte-identical to the plain scripture reference slide
   (same `reference`, `bookRef`, empty `text`/`verseRange`, `readingMode: 'normal'`).
4. No section slide renders the reference (eyebrow removed) — only scripture text + speaker
   label.
5. The **fallback** path and the **stored-group** path emit the identical slide list for the
   same reading — the existing dual-path parity tests are extended to the N+1 shape and pass.
6. Slide ids are stable and collision-free across recomputes on both paths (the synthetic
   reference slide needs a deterministic id that cannot collide with a section slide id).
7. The reference slide participates in group background/media resolution consistently with the
   section slides (e.g. a group background shows on the reference slide too), without violating
   the "stored `GroupSlideEntry.id` IS the slide id, media keyed on it" invariant (Phase 23
   WR-02) — decide and document how a synthetic, entry-less slide resolves media.
8. `npm run type-check` clean; the app suite passes at the documented baseline with the R097
   tests updated to the new model (dedicated reference slide; no eyebrow on sections).

## Key files (mapped during discovery)

- `src/utils/slideshowAssembler.ts` — both emission paths (`emitFromGroup` stored-path loop
  ~L434-443; SCRIPTURE fallback congregational branch ~L507-525) and `resolveEntryContent`
  scripture case (~L177-228).
- `src/utils/slideGroupMaterializer.ts` — `deriveGroupEntries` (do **not** add a reference
  entry), `sourceSignature`, `derivedIdentityKey`, `carryStoredDerivedEntries`,
  `rebuildScriptureGroup` (leave the reconciliation layer untouched).
- `src/components/slides/slideDisplay.ts` — `showReference` gate (drop the
  `|| slide.isFirstSection` eyebrow-on-section behavior).
- `src/components/PresentationViewer.vue` — `isFirstSection` computed + the reference v-if.
- `src/types/slide.ts` — `ScriptureSlide.isFirstSection` (now vestigial for the eyebrow; decide
  keep-as-dead vs. remove).
- Tests: `src/utils/__tests__/slideshowAssembler.test.ts` (dual-path parity + R097),
  `src/components/__tests__/PresentationViewer.test.ts`,
  `src/components/slides/__tests__/slideDisplay.test.ts`.

## Out of scope

- No editor/UI changes (the CongregationalEditor and group-level entry points are unchanged).
- No change to how sections are authored, parsed, stored, or detached.
- No change to the group-rebuild/carry/signature machinery.
