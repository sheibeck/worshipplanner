---
phase: 109-behavioral-architectural-extraction-comment-convention
plan: 03
subsystem: docs
tags: [comment-convention, codebase-map, src-utils, R318]

requires:
  - phase: 109-behavioral-architectural-extraction-comment-convention
    provides: "109-02's RELOCATION PROTOCOL and the backend subset of the R318 sweep (functions/src/**, firestore.rules, storage.rules)"
provides:
  - "The src/utils/** subset of R318: every Bucket B handoff entry whose source path begins src/utils/ relocated into ARCHITECTURE.md / INTEGRATIONS.md / CONCERNS.md / STACK.md and shrunk to a pointer comment"
affects: [109-04, 109-05]

tech-stack:
  added: []
  patterns:
    - "Utils Behavioral/Integration/Concern/Stack Notes (R318) sections in .planning/codebase/ map docs, mirroring 109-02's Backend Notes pattern with '### src/utils/<file>.ts' subsections"

key-files:
  created: []
  modified:
    - ".planning/codebase/ARCHITECTURE.md"
    - ".planning/codebase/INTEGRATIONS.md"
    - ".planning/codebase/CONCERNS.md"
    - ".planning/codebase/STACK.md"
    - "src/utils/slideGroupMaterializer.ts"
    - "src/utils/slideshowAssembler.ts"
    - "src/utils/slideTypography.ts"
    - "src/utils/slotTypes.ts"
    - "src/utils/scripture.ts"
    - "src/utils/scriptureApi.ts"
    - "src/utils/scriptureBoundaries.ts"
    - "src/utils/congregationalText.ts"
    - "src/utils/importedRenderReconciler.ts"
    - "src/utils/claudeApi.ts"
    - "src/utils/firestoreListener.ts"
    - "src/utils/lastUsed.ts"
    - "src/utils/messaging.ts"
    - "src/utils/messagingRecipients.ts"
    - "src/utils/monitorConfig.ts"
    - "src/utils/nltApi.ts"
    - "src/utils/orgName.ts"
    - "src/utils/pcSongImport.ts"
    - "src/utils/planningCenterApi.ts"
    - "src/utils/pptxUpload.ts"
    - "src/utils/quarterDates.ts"
    - "src/utils/renderedPagePaths.ts"
    - "src/utils/rotationTable.ts"
    - "src/utils/runChannel.ts"
    - "src/utils/scheduler.ts"
    - "src/utils/serviceLockDiff.ts"
    - "src/utils/serviceSlots.ts"
    - "src/utils/shareTokens.ts"
    - "src/utils/songSearch.ts"
    - "src/utils/songSectionOrder.ts"
    - "src/utils/stripUndefined.ts"
    - "src/utils/suggestions.ts"
    - "src/utils/teamRecurrence.ts"
    - "src/utils/stageLayout.ts"

key-decisions:
  - "In-scope handoff count for src/utils/** is 80 entries across 34 files (Task 1: 41 entries in 9 files; Task 2: 39 entries in 25 more files) — every entry relocated, zero kept-inline, zero drops."
  - "Followed the 109-02 map-doc section pattern exactly: a top-level '## Utils <Doc-role> Notes (R318)' section per doc, with '### src/utils/<file>.ts' subsections, appended after 109-02's existing Backend Notes sections."
  - "Safety-critical invariants that code alone cannot convey were kept inline alongside the pointer rather than fully relocated: scriptureBoundaries.ts's sliceAtBoundaries encoding backstop, pptxUpload.ts's PPTX_MAX_BYTES/storage.rules lockstep note, and slideGroupMaterializer.ts's scripture-surplus-suppression 'do not widen' warning (T-109-06/T-109-07 mitigations)."

patterns-established:
  - "Utils comment pointers follow the same '// See .planning/codebase/<DOC>.md (<section>)' form 109-02 established for functions/src/**, extended to src/utils/**."

requirements-completed: [R318]

duration: ~50min
completed: 2026-09-02
status: complete
---

# Phase 109 Plan 03: src/utils Behavioral/Architectural Comment Relocation Summary

**Relocated all 80 Bucket-B "how it works" comment entries from the 34 src/utils/** modules into ARCHITECTURE.md / INTEGRATIONS.md / CONCERNS.md / STACK.md, shrinking each source comment to a `See .planning/codebase/<DOC>.md (<section>)` pointer — zero drops, zero behavior change.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 (2 relocation tasks + 1 verification task)
- **Files modified:** 38 (4 map docs + 34 src/utils modules)

## Accomplishments
- Relocated the 41 in-scope entries for the slide-assembly + scripture engine cluster (slideGroupMaterializer.ts, slideshowAssembler.ts, slideTypography.ts, slotTypes.ts, scripture.ts, scriptureApi.ts, scriptureBoundaries.ts, congregationalText.ts, importedRenderReconciler.ts) into ARCHITECTURE.md / INTEGRATIONS.md / CONCERNS.md / STACK.md, largest single cluster being slideGroupMaterializer.ts's 13 entries covering the survival/carry rebuild engine.
- Relocated the remaining 39 in-scope entries across 25 more utils modules (claudeApi, firestoreListener, lastUsed, messaging, messagingRecipients, monitorConfig, nltApi, orgName, pcSongImport, planningCenterApi, pptxUpload, quarterDates, renderedPagePaths, rotationTable, runChannel, scheduler, serviceLockDiff, serviceSlots, shareTokens, songSearch, songSectionOrder, stripUndefined, suggestions, teamRecurrence, stageLayout).
- Proved zero behavior change: `npm run type-check` (vue-tsc --build) exits 0; `npx vitest run` shows the exact known baseline (only `src/storage.rules.test.ts` failing — Storage-emulator environment limitation, pre-existing) with 4968 passed / 26 skipped and no new failures.
- Confirmed every relocated pointer resolves to real content in its named map doc + `### src/utils/<file>.ts` subsection; git diff over all 38 modified source files is comment-only (no executable line changed), verified by filtering the diff to non-comment `+`/`-` lines (zero hits).

## Task Commits

1. **Task 1: Relocate + shrink the slide-assembly & scripture utils** - `d2e1b874` (docs)
2. **Task 2: Relocate + shrink the remaining src/utils modules** - `126bbb69` (docs)
3. **Task 3: Prove no behavior change + utils completeness count** - verification-only, no code changes; folded into this SUMMARY/state commit.

## Files Created/Modified
- `.planning/codebase/ARCHITECTURE.md` - Added "## Utils Behavioral Notes (R318)" with 20 `### src/utils/<file>.ts` subsections
- `.planning/codebase/INTEGRATIONS.md` - Added "## Utils Integration Notes (R318)" with 6 subsections (scripture.ts, scriptureApi.ts, scriptureBoundaries.ts, slideGroupMaterializer.ts, claudeApi.ts, nltApi.ts)
- `.planning/codebase/CONCERNS.md` - Added "## Utils Concern Notes (R318)" with 3 subsections (slotTypes.ts, pptxUpload.ts, serviceLockDiff.ts)
- `.planning/codebase/STACK.md` - Added "## Utils Stack Notes (R318)" with 7 subsections (slideTypography.ts, slotTypes.ts, messaging.ts, runChannel.ts, serviceSlots.ts, shareTokens.ts, stageLayout.ts)
- 34 `src/utils/**` source files - Multi-paragraph "how it works" comments shrunk to short pointers, per-file counts in the entry reconciliation below

## Entry Reconciliation (no drops)

In-scope handoff entries (108-COMMENT-INVENTORY.md "Phase 109 Handoff" section, every bolded path beginning `src/utils/`): **80**.

| Task | Files | Entries |
|---|---|---|
| Task 1 | slideGroupMaterializer(13), slideshowAssembler(4), slideTypography(3), slotTypes(6), scripture(7), scriptureApi(1), scriptureBoundaries(3), congregationalText(2), importedRenderReconciler(2) | 41 |
| Task 2 | claudeApi(2), firestoreListener(1), lastUsed(1), messaging(1), messagingRecipients(1), monitorConfig(1), nltApi(2), orgName(2), pcSongImport(1), planningCenterApi(1), pptxUpload(4), quarterDates(1), renderedPagePaths(1), rotationTable(1), runChannel(1), scheduler(2), serviceLockDiff(2), serviceSlots(1), shareTokens(3), songSearch(2), songSectionOrder(4), stripUndefined(1), suggestions(1), teamRecurrence(1), stageLayout(1) | 39 |
| **Total relocated + shrunk** | | **80** |
| Kept-inline (dropped from relocation) | | **0** |

Every entry was relocated and shrunk to a pointer — none were classified as "kept inline instead of relocated." Three entries carry a short residual invariant alongside their pointer, because the code alone cannot convey it (see Decisions above): `scriptureBoundaries.ts::sliceAtBoundaries`, `pptxUpload.ts::PPTX_MAX_BYTES`, and `slideGroupMaterializer.ts`'s scripture-surplus-suppression comment. This is compliant with the RELOCATION PROTOCOL's "keep inline only residue code cannot convey" step, not a deviation from full relocation.

Automated pointer count across all 34 files: 81 `See .planning/codebase/` occurrences (one entry — the SCRIPTURE case narration shared between `deriveGroupEntries` and `sourceSignature` in `slideGroupMaterializer.ts` — legitimately cites two different sections, ARCHITECTURE.md and INTEGRATIONS.md, hence 81 > 80).

## Decisions Made
- Mirrored 109-02's exact map-doc section/subsection naming convention (`## Utils <Doc-role> Notes (R318)` / `### src/utils/<file>.ts`) rather than inventing a new layout, for consistency across the whole R318 sweep.
- Where a handoff entry's original line numbers (from the Phase 108 audit) had drifted due to Phase 108's own ADR-pointer shrinks (e.g. `importedRenderReconciler.ts`, `slideGroupMaterializer.ts`), located the comment by its quoted text instead of the stale line range — confirmed correct via `Grep` before editing.
- Handled `importedRenderReconciler.ts` and `slideGroupMaterializer.ts`'s multi-paragraph doc comments (flagged in the plan as carrying the Phase 108 shared-JSDoc-split hazard) with individual, hand-verified `Edit` calls rather than any scripted/regex pass.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 deviations were triggered; this was a comment-only relocation task with no discovered bugs, missing functionality, blocking issues, or architectural changes.

## Issues Encountered
None. The plan's anticipated risk (stale line numbers in the 108-COMMENT-INVENTORY.md handoff, called out for `importedRenderReconciler.ts`) materialized as expected and was resolved by content-based location rather than line-number lookup, as planned.

## Known Stubs

None - this plan is comment/docs-only and touches no UI-rendering code paths.

## Threat Flags

None - no new network endpoints, auth paths, file access patterns, or schema changes were introduced. Comment-only diff.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `src/utils/**` subset of R318 is complete. Combined with 109-02's backend subset, R318 now covers `functions/src/**`, `firestore.rules`, `storage.rules`, and all of `src/utils/**`.
- R318 remains **In Progress** in REQUIREMENTS.md — 109-04 and 109-05 still own the remaining Bucket B subsets (components/composables/stores/types/views, per the handoff's non-`src/utils/`, non-backend entries) and must append to the same four map docs.
- No blockers. The four map docs (`ARCHITECTURE.md`, `INTEGRATIONS.md`, `CONCERNS.md`, `STACK.md`) are ready for 109-04/109-05 to append further `## <Area> Notes (R318)` sections without conflict, since this plan only appended new top-level sections and never edited 109-02's existing content.

---
*Phase: 109-behavioral-architectural-extraction-comment-convention*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: .planning/codebase/ARCHITECTURE.md
- FOUND: .planning/codebase/INTEGRATIONS.md
- FOUND: .planning/codebase/CONCERNS.md
- FOUND: .planning/codebase/STACK.md
- FOUND: src/utils/slideGroupMaterializer.ts
- FOUND: src/utils/claudeApi.ts
- FOUND commit: d2e1b874
- FOUND commit: 126bbb69
