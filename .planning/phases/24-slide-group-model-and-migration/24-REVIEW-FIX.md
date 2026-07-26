---
phase: 24-slide-group-model-and-migration
fixed_at: 2026-07-26T04:59:27Z
review_path: .planning/phases/24-slide-group-model-and-migration/24-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-07-26T04:59:27Z
**Source review:** .planning/phases/24-slide-group-model-and-migration/24-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01 Critical, WR-01 Warning, WR-02 Warning — the IN-01 Info finding was in scope only as required regression coverage for CR-01, per task instructions, not as a standalone fix)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: Reassigning a SONG slot's song corrupts the slide group with blended content from the old and new song

**Files modified:** `src/utils/slideGroupMaterializer.ts`, `src/utils/__tests__/slideGroupMaterializer.test.ts`, `src/composables/__tests__/useSlideshowAssembly.test.ts`
**Commit:** `69f8fa2`
**Applied fix:** Followed the design guidance (reuse the existing `sourceSignature`/confirm-gate mechanism rather than inventing a new one — a `songId` change is a source-identity change, not a section-level edit). `reconcileSongGroup` now detects a full song-identity swap FIRST, before any additive-merge logic runs: it collects the set of `songId` values referenced by the group's stored `lyric`/`copyright` entries and compares it against the slot's current `songId`. If they differ:
- An uncustomized group (`hasCustomization(group) === false`) replaces wholesale via `deriveGroupEntries(slot, inputs)` — nothing user-authored to lose, so no confirm gate, matching the existing scripture/imported uncustomized-diverged behavior.
- A customized group returns `needsConfirm: true`, leaves the stored `slides` untouched, and supplies `proposed`/`loss` for the (existing, not-yet-built) Phase 26 confirm dialog — exactly the shape `reconcileUnstableIdGroup` already produces for scripture/imported groups.

`reconcileSongGroup`'s return type widened from the old ad-hoc `{ slides, changed }` shape to the shared `ReconcileResult` shape (`needsConfirm`/`changed`/`slides`/`proposed?`/`loss?`), and `reconcileGroup`'s SONG dispatch branch now forwards the whole result instead of discarding `needsConfirm` (the review's "also add a reconcileGroup dispatch update" note). The existing same-song additive-merge path (insert new sections, keep still-resolving entries by value, retain vanished-section entries) is completely unchanged and still runs for every same-song reconciliation.

Added the missing regression coverage (the IN-01 gap this task pulled into CR-01's fix, per instructions):
- `slideGroupMaterializer.test.ts`: a new `describe('song identity swap (CR-01)')` block with 3 tests — uncustomized-swap wholesale replace (asserts zero stale `song-1`-referencing entries survive), customized-swap `needsConfirm: true` with stored slides untouched and a `loss` summary, and the exact CR-01 reproduction (no retained-but-unresolvable entry referencing the old song). Also added one test in the `reconcileGroup dispatcher` block asserting `needsConfirm` surfaces through the dispatcher for a customized song swap.
- `useSlideshowAssembly.test.ts`: 2 new tests in the `reconciliation (Task 3)` block — an uncustomized song swap issues exactly one `replaceGroupSlides` call whose slides reference only the new song, and a customized song swap issues zero writes and populates `pendingReconciliations`.

All 37 pre-existing `slideGroupMaterializer.test.ts` tests and all 23 pre-existing `useSlideshowAssembly.test.ts` tests still pass unmodified (41 and 25 total respectively after the additions). `npm run type-check` and `npm run build` both exit 0.

### WR-01: `setGroupBedMedia`'s skeleton-create path can race `materializeGroupIfMissing` and drop the freshly-derived slide list

**Files modified:** `src/stores/slideGroups.ts`, `src/stores/__tests__/slideGroups.test.ts`
**Commit:** `aae8407`
**Applied fix:** Applied the review's suggested fix as-is — the skeleton-create `setDoc` call in `setGroupBedMedia` now passes `{ merge: true }` as its third argument. This makes a concurrently-landing `materializeGroupIfMissing` write's fully-populated `slides` field survive rather than being clobbered back to `[]` by this skeleton's non-merge overwrite, per the review's own note that "losing a bed-media write instead of losing derived structure is comparatively harmless." Added one new test asserting the skeleton-create `setDoc` call is invoked with `{ merge: true }`. All 20 pre-existing `slideGroups.test.ts` tests still pass unmodified (21 total after the addition).

### WR-02: `SlotMediaAttachment`'s bound value is blind to legacy slot media until the group first materializes

**Files modified:** `src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `b4d1220`
**Applied fix:** Added `displaySlotAudioUrl(slot)`/`displaySlotVideoUrl(slot)` helper functions that read the materialized group's bed field first and fall back to the slot's own deprecated `audioUrl`/`videoUrl` (`MediaAttachableSlot`) when no group exists yet, matching the exact precedence the review's suggested fix described (group value first, slot legacy value second). The `SlotMediaAttachment`'s `:audioUrl`/`:videoUrl` bindings in the template now call these helpers instead of reading `groupsBySlotId.get(slot.id)?.bedAudioUrl`/`bedVideoUrl` directly. Added 2 new tests: one confirming the fallback to the slot's legacy fields when no group has materialized, and one confirming the group bed still takes precedence when both a group and a legacy slot field are present (regression guard for the existing "the control displays urls from the group bed, not the deprecated slot fields" test, which continues to pass unmodified). All pre-existing `ServiceEditorView.test.ts` real-source tests still pass (39 total after the additions).

## Skipped Issues

None — all 3 in-scope findings were fixed.

## Verification Performed

- `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` — 41/41 pass.
- `npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts` — 25/25 pass.
- `npx vitest run src/stores/__tests__/slideGroups.test.ts` — 21/21 pass.
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — 39/39 pass on the real source file (2 quarantine-worktree duplicates fail with pre-existing, unrelated Pinia/vnode errors — part of the documented baseline, not touched).
- `npx vitest run src/` (full sweep) — 10 failing files, and all 10 are exactly the pre-existing documented baseline (8 `.gsd/quarantine/worktrees/**` stale duplicates, `src/storage.rules.test.ts` requiring the Storage emulator, `src/views/__tests__/RosterView.test.ts`'s stale pre-existing "Roles config" assertion). Zero new failures introduced by these fixes.
- `npm run type-check` — exits 0, no errors.
- `npm run build` — exits 0, production bundle produced successfully.

## Logic-Complexity Note

CR-01's fix changes reconciliation dispatch logic (a confirm-gate branch added ahead of an existing additive-merge branch) rather than a pure syntax-level change. All three fixes are backed by passing unit tests that directly exercise the new behavior (song-identity-swap wholesale replace, song-identity-swap confirm gate, race-safe merge write, and legacy-field fallback), and `npm run type-check`/`npm run build` both stayed green — but per this task's own design guidance, CR-01 is a genuine logic/behavior change to a data-integrity-critical path (the Phase 26 confirm dialog itself does not exist yet, so the `needsConfirm: true` branch's `proposed`/`loss` output is currently consumed by nothing — it only prevents a silent write). Recommend a human skim of `reconcileSongGroup`'s new identity-swap branch in `src/utils/slideGroupMaterializer.ts` before this ships, given it touches the exact code path CR-01 flagged as reachable through the ordinary "pick a different song for this slot" workflow.

---

_Fixed: 2026-07-26T04:59:27Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
