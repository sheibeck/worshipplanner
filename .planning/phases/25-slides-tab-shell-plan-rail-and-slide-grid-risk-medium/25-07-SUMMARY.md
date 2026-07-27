---
phase: 25-slides-tab-shell-plan-rail-and-slide-grid-risk-medium
plan: 07
subsystem: slides-tab
tags: [vue, drag-and-drop, pptx-import, slide-group, video-slide, group-bed, dropRouting, ui-spec]

requires:
  - phase: 25-01
    provides: "VideoSlide type + widened video/authored-text SourceRef members that make a dropped-video group entry representable at all"
  - phase: 25-05
    provides: "ensureGroupMaterialized -- every append path in this plan resolves the group through it first, using its RETURNED entries rather than re-reading the (lagging) groupsBySlotId prop"
  - phase: 25-06
    provides: "The group-bed write path (setGroupBedMedia, no materialization needed) this plan's audio-drop branch reuses verbatim"
provides:
  - "PptxImportModal.vue: importPptxFile/importImageFiles, an additive defineExpose entry point for an externally-supplied File, re-entry-guarded"
  - "src/components/slides/dropRouting.ts: pure classifyFiles + resolveDrop, the actual filter on the native drop path (no accept-attribute filtering exists on a real OS drop)"
  - "src/components/slides/SlideDropTarget.vue: the always-last drop tile, never inside SortableJS's draggable set"
  - "SlideGrid.vue: grid-wide dragover highlight, the group header's Import action + its OWN PptxImportModal instance, and the four accepted-kind persistence paths"
affects: [ServiceEditorView (untouched, verified by empty git diff --stat), Phase 26 (Edit Slide drawer opens against the same selection seam, unaffected by this plan)]

tech-stack:
  added: []
  patterns:
    - "A native HTML5 drop delivers raw File objects with NO accept-attribute filtering at all -- dropRouting.ts IS the filter, not a convenience; both drop entry points (the tile's emit, the grid container's native drop) route through the exact same resolveDrop + dispatch function so they cannot diverge"
    - "PPTX classified by file-name extension (OS drops often supply an empty or generic MIME type for .pptx); image/video/audio classified by MIME prefix, using the SAME prefixes useMediaUpload validates against"
    - "Resolution order for a multi-kind drop: first audio wins the bed, every video appends in drop order, a PPTX beats images for the one modal-backed import, everything left over (extra audio, PPTX-shadowed images, anything unsupported) is reported in one rejection notice rather than silently dropped"
    - "The grid mounts its OWN PptxImportModal instance with its OWN confirmed handler -- never ServiceEditorView's, whose handler creates a brand-new IMPORTED plan item (exactly what D-16 forbids here); D-15's reuse prohibition is against a second IMPLEMENTATION, and mounting a second instance of the same component still satisfies it"
    - "A dropped deck/image opens the grid's own modal, awaits nextTick() so the modal's reset-on-open watcher runs first, THEN calls its Task-1 entry point -- calling the entry point in the same tick as opening would let the reset clobber the just-started import"
    - "Video and audio drops upload via one shared useMediaUpload() instance (sequential within a single drop, never concurrent) and never call ensureGroupMaterialized for the audio branch, mirroring 25-06's finding that setGroupBedMedia's own merging skeleton-create already covers an unmaterialized group"
key-files:
  created:
    - src/components/slides/dropRouting.ts
    - src/components/slides/__tests__/dropRouting.test.ts
    - src/components/slides/SlideDropTarget.vue
    - src/components/slides/__tests__/SlideDropTarget.test.ts
  modified:
    - src/components/PptxImportModal.vue
    - src/components/__tests__/PptxImportModal.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

decisions:
  - "PptxImportModal exposes TWO functions (importPptxFile, importImageFiles) rather than one dispatching function -- each calls straight into the existing importPptx/importImages, and the caller (SlideGrid) already knows which kind resolveDrop selected, so a second internal dispatch layer would be redundant"
  - "dropRouting.ts splits classification (classifyFiles: five buckets, exactly one file in each) from resolution (resolveDrop: applies the documented multi-kind precedence and reports skipped files) as two separate exported functions -- classification is the cheaper, narrower thing to unit-test directly, and resolution composes it rather than re-deriving it"
  - "Video and audio appends never route through a second useMediaUpload() instance each -- ONE shared instance is used for both branches since a single drop handles them sequentially (video then audio), never concurrently, so there is no shared-state race"
  - "The video append path batches ALL of a drop's videos into ONE replaceGroupSlides call after every upload in that drop has resolved (not one write per video) -- a failed upload partway through a multi-video drop therefore appends nothing from that drop, the same all-or-nothing guarantee the single-video failure test asserts"
  - "importSection falls back to SERVICE_SECTIONS[0] (not a hardcoded 'pre-service' literal) when the selected plan item carries no section of its own, keeping the fallback anchored to the same single source of truth the rest of the codebase already uses"
  - "The rejection notice reuses ONE message (UNSUPPORTED_FILE_MESSAGE) for every 'skipped' reason (extra audio, PPTX-shadowed images, truly unsupported files) rather than authoring per-reason copy -- the UI-SPEC only approves the one rejected-file string, and the plan's own action text groups all three under 'reported in the inline notice'"

metrics:
  duration: ~2.5h
  completed: 2026-07-26
status: complete
---

# Phase 25 Plan 07: Drop Target, Group Import Action, and the Four Persistence Paths Summary

The slide grid now accepts a PPTX, an image, a video, or an audio file dropped anywhere on it (plus an explicit "Import into this group" action), and routes each of the four kinds to the right destination: PPTX/image append via the reused `PptxImportModal.vue`, video appends its own slide (D-17's payoff), and audio sets the group's music bed and appends nothing (D-14/D-18) — completing R032, the phase's headline capability.

## What Was Built

**Task 1 — Additive drop-zone entry point on `PptxImportModal.vue`** (`3c1a41e`)

- `PptxImportModal.vue` gained `defineExpose({ importPptxFile, importImageFiles })`. Both call straight into the pre-existing `importPptx`/`importImages` functions — no new upload/parse/preview/confirm logic was added, satisfying D-15 with a second CALLER, not a second implementation.
- Guarded against re-entry: while the modal is in its `uploading`/`parsing`/`confirming` step, both entry points return without starting anything, since this is a single-batch state machine and a second concurrent import would corrupt its preview state.
- Every pre-existing test in `PptxImportModal.test.ts` passes with its assertions unmodified; four new tests cover the entry point's happy paths, the re-entry guard, and that the modal's own `<input>` elements still work.

**Task 2 — Drop routing module and the always-last drop tile** (`1541a4c`, wiring completed alongside Task 3 in `a6c5fca`)

- `src/components/slides/dropRouting.ts`: `classifyFiles` partitions a raw `File[]` into five buckets (`decks`/`images`/`videos`/`audioFiles`/`rejected`) — a PPTX is classified by its file-name extension (checked BEFORE any MIME check, since an OS drop often supplies an empty or generic MIME type for `.pptx`), the other three by MIME prefix using the same prefixes `useMediaUpload` validates against. `resolveDrop` layers the documented multi-kind resolution order on top: the first audio file wins the bed, every video appends (in drop order), a PPTX beats images for the one modal-backed import, and everything left over (extra decks/audio, PPTX-shadowed images, anything unsupported) is collected into `skipped` for the caller to report rather than silently drop.
- `src/components/slides/SlideDropTarget.vue`: the tile itself, using the UI-SPEC's exact copy. Deliberately does NOT carry the `.slide-card` class SortableJS is scoped to, so it never shifts a reorder's old/new index math. Performs no upload or routing decision of its own — it only emits the raw dropped file list upward.
- `SlideGrid.vue` mounts the tile as the LAST grid item unconditionally: inside the cards container after the last card when populated, and directly below the empty-state copy at zero slides (D-08/D-13). A whole-grid dragover highlight (`border-indigo-500/50 bg-indigo-950/10`) is applied on `dragenter`/`dragover` when the drag carries files (checked via `dataTransfer.types.includes('Files')`, since `.files` is empty until drop fires), guarded by a depth counter — not a boolean — against the constant child-element `dragleave` events that fire while the pointer moves across cards inside the container. Both drop entry points (the tile's `drop` emit and the container's native `drop` event) route through one `onFilesDropped` dispatcher built on `resolveDrop`, so they cannot diverge.
- An inline rejection notice (the UI-SPEC's exact copy) renders whenever `resolveDrop` reports anything skipped, clearing itself after 4 seconds (and on unmount, avoiding a leaked timer).

**Task 3 — The four persistence paths and the group import action** (`a6c5fca`)

- The group header gained an `⇪ Import into this group` action (editor-only, neutral bordered button matching `＋ Add slide`'s treatment) that opens the grid's OWN `PptxImportModal` instance in its idle state. This is a SEPARATE instance and handler from `ServiceEditorView`'s — that handler creates a brand-new `IMPORTED` plan item, exactly the behavior D-16 forbids here; `git diff --stat src/views/ServiceEditorView.vue` stays empty, confirmed.
- The modal's `confirmed` handler (`onImportConfirmed`) implements Pattern 4: reads the created deck via `useImportedSlides().getDeck`, resolves the selected group through `ensureGroupMaterialized`, mints one `GroupSlideEntry` per inner slide (`sourceRef: { kind: 'imported', importId, innerSlideId }`) with orders continuing from the group's current highest, and appends them via `replaceGroupSlides` with the existing entries preserved and the stored source signature passed through unchanged. No slot factory or reindexer is ever called on this path.
- A dropped PPTX or image opens the same modal and hands it the file via Task 1's exposed entry point, awaiting `nextTick()` between opening and calling the entry point so the modal's reset-on-open watcher runs first (otherwise it would clobber the just-started import).
- Video drop (D-17's payoff): uploads via `useMediaUpload`, then appends one `GroupSlideEntry` per video (`sourceRef: { kind: 'video', videoSrc, originalFileName }`) — NOT the group bed, the one place 25-RESEARCH.md's now-stale recommendation must not be followed. All of a single drop's videos are batched into ONE `replaceGroupSlides` call after every upload resolves, so a failed upload partway through appends nothing from that drop.
- Audio drop: uploads via the same composable, then writes the selected group's bed through `setGroupBedMedia` (D-14/D-18) and appends nothing. No materialization call is needed here, mirroring 25-06's finding that the store's own merging skeleton-create already covers an unmaterialized group.
- Upload progress/error feedback reuses `useMediaUpload`'s own reactive `progress`/`error`/`isUploading` verbatim — no new copy was authored.

## Deviations from Plan

None — the plan executed as written across all three tasks, including its explicit prohibitions: no dropped video routed to a bed (`git grep -n "bedVideoUrl" src/` returns nothing), `ServiceEditorView.vue`'s existing import handler untouched, no second PPTX/image import implementation, no `DataTransfer` synthesis, and no `firestore.rules`/`storage.rules` changes.

## Verification

- `npx vitest run src/components/slides/ src/components/__tests__/PptxImportModal.test.ts` — 9 files, 174 tests, all pass.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 46 tests, all pass (the two `.gsd/quarantine/worktrees/**` copies fail as documented pre-existing baseline, unrelated to this plan).
- `npx vitest run src/` — 10 failed test FILES (exactly the documented baseline: 8 under `.gsd/quarantine/worktrees/**`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`); 155 passed files, 3313 passed tests. The failing-file set did not grow.
- `npm run type-check` — 0 errors (`vue-tsc --build`).
- `npm run build` — succeeded (`vite build`).
- `git diff --stat src/views/ServiceEditorView.vue` — empty (no view change was needed).
- `git diff --stat storage.rules firestore.rules` — empty.
- `git grep -n "bedVideoUrl" src/` — no matches (D-18 stays enforced).

## Known Stubs

None. Every path this plan adds is wired to the real store actions (`replaceGroupSlides`, `setGroupBedMedia`) and the real reused `PptxImportModal`/`useMediaUpload`; nothing renders a placeholder value.

## Threat Flags

None beyond the plan's own `<threat_model>` register (T-25-07-01 through T-25-07-08 and T-25-07-SC, all disposed `mitigate`/`accept` in the plan). This plan's implementation satisfies each `mitigate` disposition via the mechanisms described above (routing-module-classifies-before-upload for DoS, the grid's own confirmed handler + an explicit no-slot-factory/no-reindex/no-service-store-update test for the plan-desync threat, the video-vs-bed test pair for the stale-research threat, editor gating on the tile/import-action/all drop handlers for the elevation-of-privilege threat, `ensureGroupMaterialized`'s returned-entries contract for the stale-read threat, the re-entry guard for the concurrent-import threat, and the resolution-order's `skipped` reporting for the silent-drop threat).

<human-check>
Deferred to the project's batch human-verify (STATE.md Deferred Verification), NOT a blocking
checkpoint. jsdom cannot produce a genuine OS `DataTransfer` carrying real `File` payloads, so the
whole drop gesture is manual by nature (carried from `25-VALIDATION.md` § Manual-Only
Verifications):

1. Drag `docs/example.pptx` from the desktop onto the grid and confirm its slides append to the
   selected group and that no new plan item appears in the rail.
2. Drag `docs/example.mp3` onto the grid and confirm it becomes the group's music rather than a
   slide.
3. Drag a real video file onto the grid and confirm it appends a video slide, then Present and
   confirm it plays.
4. Drag an unsupported file and confirm the rejection message appears and nothing uploads.
5. Confirm the whole-grid highlight appears while dragging anywhere over the grid, not only over
   the tile.
</human-check>

## Self-Check: PASSED

- FOUND: `src/components/PptxImportModal.vue` (modified — `importPptxFile`/`importImageFiles` exposed)
- FOUND: `src/components/slides/dropRouting.ts`
- FOUND: `src/components/slides/SlideDropTarget.vue`
- FOUND: `src/components/slides/SlideGrid.vue` (modified — drop tile, grid-wide highlight, import action, four persistence paths)
- FOUND commit `3c1a41e` (Task 1 — additive entry point)
- FOUND commit `1541a4c` (Task 2 — dropRouting.ts + SlideDropTarget.vue)
- FOUND commit `a6c5fca` (Task 2 wiring + Task 3 — grid integration and the four persistence paths)
