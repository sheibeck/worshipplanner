---
phase: 109-behavioral-architectural-extraction-comment-convention
plan: 04
subsystem: docs
tags: [comments, r318, vue-components, composables, run-mode, slides, stage]

requires:
  - phase: 109-behavioral-architectural-extraction-comment-convention (plan 03)
    provides: "The four codebase map docs (ARCHITECTURE/INTEGRATIONS/CONCERNS/STACK.md) with an established '### <source-file>' relocation-subsection pattern, extended here to src/components/** and src/composables/**."
provides:
  - "R318 component + composable subset: 85 in-scope Bucket B handoff entries (55 src/components/**, 30 src/composables/**) relocated into the codebase map docs and shrunk to `See .planning/codebase/<DOC>.md (<section>)` pointers"
  - "New '## Component & Composable Behavioral/Integration/Concern/Stack Notes (R318)' sections in all four map docs"
affects: [109-05, future-comment-audits]

tech-stack:
  added: []
  patterns:
    - "Component/composable comment relocation mirrors 109-02/03's '### <source-file>' subsection convention, added under a new '## Component & Composable ... Notes (R318)' heading per doc"

key-files:
  modified:
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/CONCERNS.md
    - .planning/codebase/STACK.md
    - src/components/ContextualActionBar.vue
    - src/components/MiscLabelBadge.vue
    - src/components/PptxImportModal.vue
    - src/components/SongLyricEditor.vue
    - src/components/SongSlotPicker.vue
    - src/components/SongTable.vue
    - src/components/actionBarItems.ts
    - src/components/admin/CleanupEnableConfirmDialog.vue
    - src/components/admin/DeactivateOrgConfirmDialog.vue
    - src/components/run/RunFilmstrip.vue
    - src/components/run/RunHeader.vue
    - src/components/run/RunPreviewPair.vue
    - src/components/run/RunRail.vue
    - src/components/run/RunTransportBar.vue
    - src/components/run/RunDisplaysPanel.vue
    - src/components/settings/ServiceTemplateEditor.vue
    - src/components/slides/BackgroundControl.vue
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/SlideCanvas.vue
    - src/components/slides/SlideGrid.vue
    - src/components/slides/SlideGroupMusicControl.vue
    - src/components/slides/SlidesTab.vue
    - src/components/slides/SlotLoopControl.vue
    - src/components/slides/dropRouting.ts
    - src/components/slides/slideDisplay.ts
    - src/components/slides/SlideCard.vue
    - src/components/slides/SlideDropTarget.vue
    - src/components/stage/StageKindIcon.vue
    - src/components/stage/StageLayoutEditor.vue
    - src/components/stage/StageLayoutPrintDocument.vue
    - src/components/stage/StageMarkerChip.vue
    - src/components/stage/StageRoom.vue
    - src/components/stage/StageLayoutView.vue
    - src/composables/useAutoSave.ts
    - src/composables/useBackgroundUpload.ts
    - src/composables/useLoopTimer.ts
    - src/composables/useOutputWindow.ts
    - src/composables/useRunControl.ts
    - src/composables/useRunTimers.ts
    - src/composables/useSlideshowAssembly.ts
    - src/composables/useUnsavedGuard.ts
    - src/composables/useMediaUpload.ts

key-decisions:
  - "Added a small extra relocation not required by the literal handoff line-ranges (e.g. SlidesTab.vue's onEditCongregational, SlideGrid.vue's second gridRenderNonce declaration comment) where a near-duplicate 'how it works' paragraph sat adjacent to an in-scope entry — relocating both avoided leaving stray long-form narration beside a shrunk pointer."
  - "useUnsavedGuard.ts's module doc (baseline snapshot + confirm-before-discard usage example) is kept inline, not relocated — it is a short JSDoc/usage-pattern comment (permitted by CONVENTIONS.md's general Comments section), not multi-paragraph architectural narration."
  - "Corrected a handoff line-number drift: 108-COMMENT-INVENTORY.md's cited ranges no longer matched current file line numbers in several files (intervening 108-02 ADR-pointer edits shifted lines) — every entry was re-located by content search (grep for the entry's distinctive phrase) rather than trusted verbatim, and one entry (SlidesTab.vue's R036 serviceLocked-prop paragraph, originally cited as :137-148) was initially missed on the first pass and caught + relocated in a follow-up commit before Task 3's reconciliation count."

requirements-completed: []

coverage: []

duration: 14min
completed: 2026-09-02
status: complete
---

# Phase 109 Plan 04: Component & Composable Behavioral Comment Relocation Summary

**Relocated all 85 in-scope Bucket B "how it works" comments from `src/components/**` and `src/composables/**` into the four `.planning/codebase/` map docs (new "Component & Composable ... Notes (R318)" sections), shrinking each source comment to a `See .planning/codebase/<DOC>.md (<section>)` pointer — zero drops, zero behavior change.**

## Performance

- **Duration:** 14 min (wall-clock task execution; excludes the ~8 min `npx vitest run` verification wait)
- **Started:** 2026-09-02T00:44:19-04:00
- **Completed:** 2026-09-02T00:57:49-04:00
- **Tasks:** 3
- **Files modified:** 46 (4 map docs + 33 component files + 9 composable files)

## Accomplishments

- Relocated every in-scope `src/components/**` Bucket B entry (55 entries across 33 files, plus one entry missed on the first pass and caught before reconciliation) into ARCHITECTURE.md / INTEGRATIONS.md / CONCERNS.md / STACK.md, replacing each source comment with a short map-doc pointer.
- Relocated every in-scope `src/composables/**` Bucket B entry (30 entries across 9 files) the same way; `useUnsavedGuard.ts`'s short usage-doc JSDoc explicitly kept inline (not architectural narration) and recorded as a "kept inline" decision.
- Confirmed `SongLyricEditor.vue` (added to this plan's scope by a plan revision) was relocated, not dropped — its "Drag reorder (D-01)" comment now points at STACK.md.
- Left `useSlideshowAssembly.ts`'s `console.warn()` string literal untouched (it is not a comment, per the 108-02-SUMMARY.md lesson cited in this plan's context).
- Proved zero behavior change: `npm run type-check` (`vue-tsc --build`) exits 0; `npx vitest run` shows the same single known-failing file (`src/storage.rules.test.ts`, Storage-emulator-dependent per CLAUDE.md) as the pre-edit baseline, with 4968 passing / 26 skipped — no new failures.

## Task Commits

Each task was committed atomically (split into sub-batches for reviewability per the plan's action note):

1. **Task 1a: top-level components** — `a0b5436f` (refactor) — ContextualActionBar, MiscLabelBadge, PptxImportModal, SongLyricEditor, SongSlotPicker, SongTable, actionBarItems.ts
2. **Task 1b: admin/run/settings components** — `d2d5004a` (refactor) — CleanupEnableConfirmDialog, DeactivateOrgConfirmDialog, Run* (Filmstrip/Header/PreviewPair/Rail/TransportBar/DisplaysPanel), ServiceTemplateEditor
3. **Task 1c: slides/ components** — `738007a9` (refactor) — BackgroundControl, EditSlideDrawer, SlideCanvas, SlideCard, SlideDropTarget, SlideGrid, SlideGroupMusicControl, SlidesTab, SlotLoopControl, dropRouting.ts, slideDisplay.ts
4. **Task 1d: stage/ components** — `cdb9384f` (refactor) — StageKindIcon, StageLayoutEditor, StageLayoutPrintDocument, StageMarkerChip, StageRoom, StageLayoutView (completes Task 1)
5. **Task 2: composables** — `1de94f73` (refactor) — useAutoSave, useBackgroundUpload, useLoopTimer, useOutputWindow, useRunControl, useRunTimers, useSlideshowAssembly, useMediaUpload (useUnsavedGuard kept inline)
6. **Fix: missed SlidesTab.vue entry** — `227d27b4` (refactor) — caught during Task 3's entry-count reconciliation; relocated the R036 `serviceLocked` prop comment that was missed in Task 1c
7. **Task 3: verification** — no code changes; `npm run type-check` and `npx vitest run` both confirmed clean against baseline (see Deviations)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.planning/codebase/ARCHITECTURE.md` — new "## Component & Composable Behavioral Notes (R318)" section, ~32 subsections
- `.planning/codebase/INTEGRATIONS.md` — new "## Component & Composable Integration Notes (R318)" section, 4 subsections
- `.planning/codebase/CONCERNS.md` — new "## Component & Composable Concern Notes (R318)" section, 5 subsections
- `.planning/codebase/STACK.md` — new "## Component & Composable Stack Notes (R318)" section, 7 subsections
- 33 `src/components/**` files — comments shrunk to map-doc pointers (see key-files above for the full list)
- 9 `src/composables/**` files — comments shrunk to map-doc pointers (`useUnsavedGuard.ts` kept its short doc inline)

## Decisions Made

- See `key-decisions` in frontmatter: (1) a couple of adjacent near-duplicate comments were relocated alongside their in-scope neighbor rather than left as stray long-form narration; (2) `useUnsavedGuard.ts`'s usage-doc JSDoc was kept inline as legitimate short documentation, not R318 narration; (3) handoff line ranges had drifted since 108-COMMENT-INVENTORY.md was written (108-02's ADR-pointer edits shifted line numbers in several files) — every entry was re-located by content search rather than trusted by line number, catching one entry (SlidesTab.vue's R036 paragraph) that the first pass missed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected own line-drift error during self-verification**
- **Found during:** Task 3 (entry-count reconciliation)
- **Issue:** While cross-checking the relocated/kept-inline count against the handoff's 85 in-scope entries, `SlidesTab.vue`'s R036 `serviceLocked`-prop paragraph (originally cited at `:137-148` in the stale line numbering) had not been relocated in the Task 1c pass — an off-by-one grouping error while working through SlidesTab.vue's four cited entries.
- **Fix:** Located the comment by content search, relocated its narration into ARCHITECTURE.md's `SlidesTab.vue` subsection, and shrunk the source to a pointer.
- **Files modified:** `.planning/codebase/ARCHITECTURE.md`, `src/components/slides/SlidesTab.vue`
- **Verification:** Re-ran the entry-count reconciliation; confirmed no other misses via `grep -h "^### src/"` across all four map docs against the plan's 41-file scope list.
- **Committed in:** `227d27b4`

---

**Total deviations:** 1 auto-fixed (1 bug — self-caught omission)
**Impact on plan:** No scope creep; the fix completes exactly the plan's stated scope with zero drops.

## Issues Encountered

- Several handoff-cited `file:line` ranges in `108-COMMENT-INVENTORY.md` no longer matched current file contents, because 108-02's Bucket-A ADR-pointer shrink (and other intervening edits) shifted line numbers in the same files after the 108 inventory was captured. Resolved by locating each entry via `grep` for its distinctive opening phrase rather than trusting the cited line range, per this plan's context note about the file drift risk.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- R318 is now fully covered for `src/components/**` and `src/composables/**`; combined with 109-02 (backend) and 109-03 (utils), the only remaining R318 scope is whatever 109-05 targets.
- The four map docs now carry a consistent `## <Tree> ... Notes (R318)` / `### <source-file>` structure across backend, utils, and components/composables — 109-05 should follow the same pattern for its own file tree.
- No blockers.

---
*Phase: 109-behavioral-architectural-extraction-comment-convention*
*Completed: 2026-09-02*

## Self-Check: PASSED

All created/modified artifacts (4 map docs, 2 spot-checked source files) confirmed present on disk;
all 7 commit hashes confirmed present in `git log --oneline --all`.
