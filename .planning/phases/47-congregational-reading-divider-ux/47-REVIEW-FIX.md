---
phase: 47-congregational-reading-divider-ux
fixed_at: 2026-08-08T22:33:03Z
review_path: .planning/phases/47-congregational-reading-divider-ux/47-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 47: Code Review Fix Report

**Fixed at:** 2026-08-08T22:33:03Z
**Source review:** .planning/phases/47-congregational-reading-divider-ux/47-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical, 3 warning, 2 info — `fix_scope: all`, since both info items
  were assessed as trivial/low-risk per the task constraints)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: In-flight "Split with AI" request has no lock, generation check, or button-disable

**Files modified:** `src/components/CongregationalEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`
**Commit:** `f81adf0`
**Commit status:** fixed
**Applied fix:** Added a generation token (`seedGeneration`, bumped on every fetch and every AI-seed
dispatch) plus a `rawText` equality check, both re-verified after the `await` before applying an AI
result. A re-fetch that happens while the request is in flight now causes the stale result to be
discarded outright (both checks fail). A hand-edit (divider insert/remove or chip change) made while
the request is in flight is detected via the existing `hasManuallyEdited` flag and routed through a
new `pendingAiResult` ref into the existing re-seed confirm UI, instead of silently overwriting the
edit — confirming applies the already-fetched result directly (no second network call). Fetch,
Alternate, and Blank are also disabled (and dimmed) in the template while `isSplitting` or
`isFetching` is true, closing off the competing-seed pathway through the UI entirely. Adapted from
the review's suggested code with two changes: (a) the deferred-apply case stores the actual result
via `pendingAiResult` rather than re-running `performSeed('ai')` on confirm (which would have
re-issued a needless second network call), and (b) the toast/text constants and control names were
matched to the actual current source rather than the illustrative snippet.
**Tests added:** 4 new cases — competing-control disabling while `isSplitting`; a mid-flight hand
edit deferring the resolved result behind the confirm and applying it without a second network call
on confirm; and cancelling that confirm discards the deferred result while preserving the hand edit.

### WR-01: Boundary-alignment can silently mislabel a segment's verse range by swallowing the next verse's marker

**Files modified:** `src/utils/scriptureBoundaries.ts`, `src/utils/__tests__/scriptureBoundaries.test.ts`, `src/components/CongregationalEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`
**Commit:** `25d34ab`
**Commit status:** fixed: requires human verification (logic change to a core alignment/labeling path)
**Applied fix:** Added `verseRangeForBoundaryRange(text, boundaries, startBoundary, endBoundary)` to
`scriptureBoundaries.ts` (option (b) from the review's fix suggestion) — it attributes a verse to a
segment only when that verse's own marker boundary index falls strictly before the segment's
`endBoundary`, which correctly excludes a marker that is only present because the segment's raw span
had nowhere legal to end except at the next verse's own start. `CongregationalEditor.vue`'s
`congregationalSections` computed now calls this instead of the raw-text-scanning
`verseRangeForSlice` (which is left in place, still used by `claudeApi.ts`, with a new doc-comment
caution pointing at this exact edge case for any future caller).
**Tests added:** 4 new unit tests on `verseRangeForBoundaryRange` directly (including a sanity check
proving `verseRangeForSlice` over-reports on the identical slice, demonstrating this is a real
regression the new function fixes), plus 1 component-level test seeding a run-on-verse fixture
through the "Start Blank" path and asserting the emitted `verseRange`s are `'1'`/`'2'`, not `'1-2'`.

### WR-02: No detection/telemetry when the boundary-alignment search fails to find an honest match

**Files modified:** `src/components/CongregationalEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`
**Commit:** `8535ffc`
**Commit status:** fixed: requires human verification (logic change to a core alignment path — new
failure/abort branch that did not previously exist)
**Applied fix:** `alignSegmentsToBoundaries` now validates the candidate slice against `segment.text`
at every step, including the final candidate at `maxIndex` (previously unchecked — the loop could
exit at `end < maxIndex` false without ever confirming a match there). On any failure it logs a
`console.error` diagnostic and returns `null` for the whole batch rather than a partial/wrong result.
Its signature changed from `DraftSection[]` to `DraftSection[] | null`. All three callers
(Alternate/Blank/AI seeds) were routed through a new shared `applyAlignedDraft` helper that treats
`null` exactly like the existing AI-split failure contract: the draft is left completely untouched
and a toast (`SEED_ALIGN_FAILURE_TEXT`) is the only visible effect.
**Tests added:** 1 new test — an AI result whose text can never match any boundary is rejected
(toast shown, draft/emission count unchanged) rather than silently emitting a wrong boundary.

### WR-03: `insertDivider`/`removeDivider` shift every subsequent segment's `:key="idx"`

**Files modified:** `src/components/CongregationalEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`
**Commit:** `e287398`
**Commit status:** fixed
**Applied fix:** `DraftSection` gained a stable `id: string` field, minted via `crypto.randomUUID()`
at every point a segment is created (fetch's initial one-Leader-block, every entry produced by
`alignSegmentsToBoundaries`, and `insertDivider`'s two halves). `insertDivider` keeps the original
segment's id on the upper (unchanged-start) half and mints a new id for the lower half; `removeDivider`
keeps the upper segment's id on the merged result, mirroring the existing "keeps the upper segment's
speaker" convention for both operations. The boundary-indexed `v-for` now keys on `section.id`. The
legacy `mountedSections` path (which never splices — only `setSpeaker` relabels in place) got a
parallel `mountedSectionIds` array minted once at mount, since `CongregationalSection` itself carries
no id field and widening that shared type was out of scope for this fix.
**Tests added:** 1 new regression test asserting a segment untouched by an earlier divider insert
keeps the SAME underlying DOM node (`.element` identity) across the reindex. Verified this test fails
under the pre-fix `:key="idx"` implementation (temporarily reverted, ran, confirmed red, restored)
before finalizing it as a genuine regression test.

### IN-01: `seed-alternate-btn`/`seed-blank-btn` carry no loading affordance while an unrelated AI request is in flight

**Files modified:** none beyond CR-01's own changes
**Commit:** `f81adf0` (same commit as CR-01 — no separate commit needed)
**Commit status:** fixed
**Applied fix:** Resolved as a side effect of CR-01's fix: both buttons are now `:disabled` and
visually dimmed while `isSplitting || isFetching`, exactly as the review predicted.

### IN-02: `congregationalSectionFromRef` silently drops `translationSource`

**Files modified:** `src/utils/scripture.ts`, `src/utils/__tests__/scripture.test.ts`
**Commit:** `b8dd29e`
**Commit status:** fixed
**Applied fix:** Added a conditional spread of `ref.translationSource` onto the returned
`CongregationalSection`, matching the existing `verseRange` conditional-spread convention in the same
function. Purely additive — the key is only appended when the ref actually carries a
`translationSource`, so no existing caller's output shape changes.
**Tests added:** 2 new tests — a ref carrying `translationSource` reconstructs a section carrying it,
and a ref with no `translationSource` reconstructs a section with no such key at all (matching the
existing `verseRange` test pair's pattern).

## Skipped Issues

None — all 6 in-scope findings were fixed.

## Verification

- `npm run type-check` (the `vue-tsc --build` form, per CLAUDE.md): clean after every commit.
- Targeted suites (`CongregationalEditor.test.ts`, `scriptureBoundaries.test.ts`, `scripture.test.ts`,
  `claudeApi.test.ts`, `slideGroupMaterializer.test.ts`, `EditSlideDrawer.test.ts`,
  `congregationalDetachment.test.ts`): all green after each fix, including 11 new/updated test cases
  added across the fixes above.
- Full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`, per CLAUDE.md): 2926
  passed, 13 failed — all 13 failures are in the two files CLAUDE.md documents as the pre-existing
  known-failing baseline (`src/storage.rules.test.ts`, requires the Storage emulator; and
  `src/views/__tests__/RosterView.test.ts`, a stale assertion unrelated to this phase). No new
  failures were introduced by any of the 5 fix commits.
- `47-REVIEW.md` was updated in place: frontmatter `status` set to `clean`, and each finding heading
  annotated `**RESOLVED**` with its commit hash, cross-linking back to this report.

---

_Fixed: 2026-08-08T22:33:03Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
