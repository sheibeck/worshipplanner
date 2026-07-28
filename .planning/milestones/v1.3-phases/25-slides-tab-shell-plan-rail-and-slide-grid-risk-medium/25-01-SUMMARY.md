---
phase: 25
plan: 01
subsystem: slides-data-model
tags: [slide-model, video-slide, reconciliation, slideshow-assembler, d-17]
dependency-graph:
  requires: []
  provides:
    - VideoSlide interface (src/types/slide.ts)
    - SourceRef video and authored-text members (src/types/slideGroup.ts)
    - slideshowAssembler video/authored-text resolution
    - slideGroupMaterializer non-derivable-entry retention gate
  affects:
    - src/components/PresentationViewer.vue (future plan renders VideoSlide distinctly from bed video)
    - Every later Phase 25 plan that touches video or "＋ Add slide" (drop target, group header actions)
tech-stack:
  added: []
  patterns:
    - "Own-source field named distinctly from the shared bed-media carrier field (videoSrc vs videoUrl) to prevent a spread-order clobber"
    - "Non-derivable-entry predicate (isNonDerivableEntry) as the single gate hasCustomization/computeLoss consult"
key-files:
  created: []
  modified:
    - src/types/slide.ts
    - src/types/slideGroup.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/slideGroupMaterializer.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
decisions:
  - "VideoSlide's own-source field is named videoSrc (not videoUrl) — SlideBase.videoUrl is the group-BED carrier resolveEntryMedia fills from group.bedVideoUrl, and emitFromGroup conditionally spreads that carrier over resolved content; reusing the name would let a bed clobber a video slide's own footage"
  - "SourceRef gains a sixth 'video' member carrying videoSrc + optional originalFileName and no canonical record — a dropped video has no document behind it, so the storage URL IS the reference"
  - "SourceRef's 'text' member widened with optional title/body so a user-authored blank slide has somewhere to store its own words; an authored ref with a body but no title is valid, and a ref with no authored body falls through unchanged to the slot-derived fallback"
  - "isNonDerivableEntry (video kind, or text kind with authored title/body) is the single predicate hasCustomization and computeLoss consult — this is the deletion-prevention gate for D-17 ripple"
  - "reconcileSongGroup carries any entry whose sourceRef is neither lyric nor copyright through the merge by value, positioned after the retained-but-unresolvable lyric run and before the trailing copyright entry"
  - "deriveGroupEntries is NOT taught about video — no slot kind derives one; video entries only ever arrive by user action (a drop, in a later plan)"
  - "ImportedDeck.slides stays (TextSlide | ImageSlide)[] — not widened, per D-17"
metrics:
  duration: ~35min
  completed: 2026-07-26
status: complete
---

# Phase 25 Plan 01: VideoSlide Type, Authored-Text SourceRef, and Reconciliation Retention Summary

VideoSlide is a genuine type in the `Slide` union with its own `videoSrc` field (kept distinct from
`SlideBase.videoUrl`'s bed-carrier role); the slideshow assembler resolves both video and
user-authored-text `SourceRef` entries; and reconciliation across all three group kinds (song,
scripture, imported) now carries a user-appended video or authored-text entry through by value
instead of silently deleting it.

## What Was Built

**Task 1 — `VideoSlide` type, `video`/authored-`text` source refs, assembler resolution**
(`faa2f98`)

- `src/types/slide.ts`: added `VideoSlide extends SlideBase` (`contentKind: 'video'`, required
  `videoSrc: string`, optional `originalFileName?: string`) to the `Slide` union. The interface's doc
  comment states explicitly why `videoSrc` is not `videoUrl` — `SlideBase.videoUrl` is the group-BED
  carrier `resolveEntryMedia` fills from `group.bedVideoUrl`, and `emitFromGroup`'s conditional spread
  would let a bed silently overwrite a video slide's own footage if the two fields shared a name.
  `src/types/importedDeck.ts` was deliberately left untouched — verified via `git diff --stat` (empty).
- `src/types/slideGroup.ts`: `SourceRef` gained a sixth `video` member (`videoSrc` +
  optional `originalFileName`, no canonical record — the storage URL IS the reference) and the
  existing `text` member was widened with optional `title`/`body` for user-authored blank slides.
  Both new fields are optional so every entry written before this change stays valid unchanged.
- `src/utils/slideshowAssembler.ts`: `sourceIdForRef` returns `null` for `video` (same
  no-canonical-record convention as `text`). `resolveEntryContent` gained a `video` case building a
  `VideoSlide` content shape (omitting `originalFileName` when absent, matching the codebase's
  conditional-spread discipline) and an authored-`text` branch that wins over the slot-derived
  fallback whenever `ref.body !== undefined` (a body with no title is valid). `resolveEntryMedia`'s
  stale "video has no per-slide layer" comment was replaced with an accurate description of the
  bed-vs-slide-video coexistence.

**Task 2 — Reconciliation carries user-appended entries instead of deleting them** (`aca3ed9`)

- Added `isNonDerivableEntry(entry)` — true for a `video`-kind entry (always, since no slot kind
  derives one) or a `text`-kind entry carrying authored `title`/`body`. This is the single predicate
  `hasCustomization` and `computeLoss` now both consult.
- `hasCustomization` treats a non-derivable entry as customization, so `reconcileUnstableIdGroup`
  (the shared scripture/imported reconciler) routes a diverged group holding one to the confirm path
  instead of a silent wholesale replace.
- `computeLoss` counts non-derivable entries toward `customizedEntries`, so a confirm dialog's loss
  count can never read zero while a video entry is at stake.
- `reconcileSongGroup` collects every stored entry whose `sourceRef.kind` is neither `lyric` nor
  `copyright` and carries each through by value (renumbering only `order`), positioned after the
  retained-but-unresolvable lyric run and before the trailing copyright entry — the same position
  convention that run already used.
- `deriveGroupEntries` was NOT taught about video, per the plan's prohibition — no slot kind derives
  one; video entries only ever arrive by a future drop-handling plan.

**Task 3 — Composable-level guard (test-only, no production code)** (`229698a`)

- Extended `src/composables/__tests__/useSlideshowAssembly.test.ts` with a new
  `describe('D-17 — dropped video survives reconciliation (25-01 Task 3)')` block:
  - A song group holding a video entry keeps that entry (id, own source intact) in the slide list
    passed to `replaceGroupSlides` after a lyric change triggers reconciliation.
  - A customized scripture group holding a video entry with a diverged source issues zero writes,
    surfaces exactly one `pendingReconciliations` entry, and `assembledSlideshow` still contains the
    video slide (asserted via `contentKind === 'video'` and matching `id`) while reconciliation is
    pending.
  - Both tests wrap the composable invocation in the file's existing `effectScope()` pattern and
    assert on what the mocked store received (call args, `pendingReconciliations.value`), not on
    internal composable state.

## Deviations from Plan

None — plan executed exactly as written, including the explicit prohibitions (no video in
`deriveGroupEntries`, `ImportedDeck.slides` untouched, `id`-minting scheme untouched, no
`bedVideoUrl` shortcut).

## Verification

- `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts src/utils/__tests__/slideGroupMaterializer.test.ts src/composables/__tests__/useSlideshowAssembly.test.ts` — 121 tests, all pass.
- `npx vitest run src/utils/ src/composables/` — 55 files / 1416 tests, all pass, no new failing files.
- `npm run type-check` — 0 errors (`vue-tsc --build`).
- `npm run build` — succeeded (`vite build`, 22.84s).
- `git diff --stat src/types/importedDeck.ts` — empty (deck type not widened).
- `git diff --stat firestore.rules storage.rules` — empty (no rules change needed).
- Full-suite `npx vitest run src/` was launched to confirm the failing-file-set does not exceed the
  10-file baseline (8 quarantined worktree duplicates + `storage.rules.test.ts` + `RosterView.test.ts`);
  see the follow-up note below.

## Known Stubs

None. This plan ships type/model/pure-utility code only — no UI, no data flowing to a rendering
surface yet. `PresentationViewer.vue`'s video-SLIDE-distinct-from-bed-video rendering is explicitly
out of scope for this plan (D-17 ripple list item for a later plan in this phase).

## Threat Flags

None beyond the plan's own `<threat_model>` register (T-25-01-01 through T-25-01-05, all already
disposed as `mitigate`/`accept` in the plan itself — this plan's implementation satisfies T-25-01-01,
T-25-01-02, T-25-01-03 and T-25-01-04 via the mechanisms described above).

## Self-Check: PASSED

- `src/types/slide.ts` — FOUND, `VideoSlide` interface present.
- `src/types/slideGroup.ts` — FOUND, `video`/widened-`text` `SourceRef` members present.
- `src/utils/slideshowAssembler.ts` — FOUND, video/authored-text resolution present.
- `src/utils/slideGroupMaterializer.ts` — FOUND, `isNonDerivableEntry` + carry-through present.
- Commit `faa2f98` — FOUND in `git log --oneline --all`.
- Commit `aca3ed9` — FOUND in `git log --oneline --all`.
- Commit `229698a` — FOUND in `git log --oneline --all`.
