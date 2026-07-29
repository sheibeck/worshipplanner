# Deferred Items — Phase 30

Out-of-scope discoveries logged during execution, per the executor's Scope Boundary
(do not fix; do not re-run builds hoping they resolve themselves).

## 30-03: pre-existing `vitest/no-conditional-expect` lint errors in SlideGrid.test.ts

Found during: 30-03 Task 3, scoping `npx eslint` to the changed test file.

`src/components/slides/__tests__/SlideGrid.test.ts` has three pre-existing
`vitest/no-conditional-expect` errors (lines 421, 923, 924 as of this plan's HEAD), all
inside `for...if...expect(...)` loops unrelated to the R054 read-only work this plan adds.
Verified pre-existing by linting `git show HEAD:...SlideGrid.test.ts` before any edit in
this plan — the same three errors reproduce on the untouched original file.

Not fixed here: none of the three affected tests were touched by 30-03's Task 3 (they sit
in the pre-existing "add-slide control" and "video drop" describes), and the Scope
Boundary excludes issues not directly caused by the current task's changes.

---

## 30 code review (30-REVIEW.md): LOW findings deferred, not fixed

Recorded during the `--fix` pass over 30-REVIEW.md. BL-01, BL-02, HI-01, HI-02, ME-01
through ME-05 and LO-04 were fixed; the four below were explicitly deferred so they are
recorded rather than lost. Each is a dead-code / stale-comment cleanup with no user-facing
defect behind it.

### LO-01: `AssemblyInputs.scriptureReadingsById` has no reader — the scriptureSlides subscription is a permanent Firestore listener with zero consumers.

`src/utils/slideshowAssembler.ts:41`; `src/composables/useSlideshowAssembly.ts:18, 137,
145-151, 207, 241, 324, 365`. After `5c531b1` neither `assembleSlideshow` nor
`slideGroupMaterializer` reads the field, yet the composable still calls
`scriptureStore.subscribeReadings(id)` and rebuilds the map in four places. Remove the
field, the four construction sites and the subscription — or gate the subscription behind
an explicit opt-in if Phase 34 will need it.

### LO-02: `AssembledSlide.sourceId` has no consumer; `sourceIdForRef`'s legacy scripture read keeps a dead field alive.

`src/utils/slideshowAssembler.ts:85-103, 267, 294`; `src/types/slide.ts:125`. The scripture
branch returns `ref.scriptureReadingId ?? null` "so an old entry's sourceId does not change
shape underneath a consumer", but there is no consumer of `AssembledSlide.sourceId` outside
the assembler that sets it. Return `null` unconditionally, or delete the field.

### LO-03: `rebuildSongGroup` silently drops any copyright entry that is neither first nor last.

`src/utils/slideGroupMaterializer.ts:431-434, 489-494, 496-500` (pre-fix line numbers).
`storedCopyrightEntries` keeps only `[0]` and `[length-1]`; `otherEntries` excludes
`copyright` and `storedLyricEntries` never contains it. A group holding three or more
copyright entries — reachable through the drawer's Duplicate before R054 locked song groups
— loses the middle ones on the next rebuild, with no confirm. Unreachable for NEW data;
wants an explicit retain-or-document decision rather than silent loss.

### LO-05: `sourceSignature` is permanently stale for scripture groups while its doc comment claims otherwise.

`src/types/slideGroup.ts:42-50`; `src/utils/slideGroupMaterializer.ts:122-128`;
`src/composables/useSlideshowAssembly.ts:374-382`. `rebuildUnstableIdGroup` ignores the
signature, and a scripture passage edit produces no structural change, so
`rebuildScriptureGroup` returns `changed: false`, `applyRebuildOutcomes` never runs and
`freshSignature` is never written — the stored value keeps naming the PREVIOUS passage
indefinitely. Either stop writing it, or correct the comment to "written opportunistically
on structural change only; may lag the current source."
