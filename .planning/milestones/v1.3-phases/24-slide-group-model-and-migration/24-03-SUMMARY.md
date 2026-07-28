---
phase: 24-slide-group-model-and-migration
plan: 03
subsystem: data-model
tags: [typescript, slide-groups, pure-function, reconciliation, ccli, scripture-splitter]

# Dependency graph
requires:
  - phase: 24-01
    provides: "SlideGroup/GroupSlideEntry/SourceRef/SlideGroupInput type contract; required, stable ServiceSlot.id"
  - phase: 24-02
    provides: "useSlideGroups Pinia store (materializeGroupIfMissing/replaceGroupSlides consume this plan's pure functions)"
provides:
  - "deriveGroupEntries(slot, inputs) — the ONLY GroupSlideEntry.id minting site, reproducing assembleSlideshow's per-kind emission order exactly"
  - "sourceSignature(slot, inputs) — count-prefixed joined-text change-detection proxy"
  - "buildInitialGroup(slot, serviceId, inputs) — performs the D-05 slot->bed media migration"
  - "hasCustomization(group) — gates every reconciliation confirm"
  - "reconcileSongGroup(group, slot, inputs) — additive-only merge by sourceRef.sectionId"
  - "reconcileScriptureGroup / reconcileImportedGroup(group, slot, inputs) — signature-detected, confirm-gated reconciliation"
  - "reconcileGroup(group, slot, inputs) — single dispatch entry point across all five slot kinds"
affects: [24-04, 24-05, 24-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three kind-specific reconciliation functions instead of one generic diff (RESEARCH.md Pattern 3) — song diffs by content-stable sectionId; scripture/imported diff by a signature+customization gate since their inner ids are positional or per-import-random"
    - "Additive-only merge: KEEP stored entries by value for still-resolving keys (spread + renumbered order only), INSERT new entries for newly-resolving keys, RETAIN (never delete) entries whose key stopped resolving"
    - "Confirm-gate three-branch shape: signature-unchanged = no-op, diverged+uncustomized = silent replace, diverged+customized = needsConfirm with stored slides untouched plus a proposed list and loss summary"

key-files:
  created:
    - src/utils/slideGroupMaterializer.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
  modified: []

key-decisions:
  - "sourceSignature is computed for ALL slot kinds (including SONG) for storage parity across group documents, even though song reconciliation never reads it — only scripture/imported reconciliation actually gates on it"
  - "reconcileSongGroup's retained-but-unresolvable entries are appended after the resolvable run (in their original stored relative order) rather than interleaved positionally with resolvable entries — satisfies 'kept at their existing relative position' without a full LCS-style merge, which RESEARCH.md explicitly warns against building"
  - "reconcileSongGroup's copyright-entry handling: reuses the stored leading/trailing entries by identity when >=2 exist; mints a fresh non-duplicate entry for a missing side rather than reusing a single stored copyright entry for both leading and trailing (which would create a duplicate id)"
  - "reconcileGroup returns a single ReconcileResult shape for every slot kind (SONG's needsConfirm is always false) so 24-05's composable has one call site regardless of kind"

patterns-established:
  - "Kept entries during reconciliation are re-created via object spread ({ ...stored, order: newOrder }) rather than mutated in place — preserves label/notes/audioUrl byte-for-byte while still allowing order renumbering, and keeps the source stored array untouched"

requirements-completed: [R028, R030, R018]

coverage:
  - id: D1
    description: "deriveGroupEntries reproduces assembleSlideshow's exact per-kind emission order (SONG copyright/lyric.../copyright, SCRIPTURE per-inner-slide, IMPORTED per-deck-slide, PRAYER/MESSAGE/HYMN single text) and mints the only GroupSlideEntry.id"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts (deriveGroupEntries — SONG/SCRIPTURE/IMPORTED/PRAYER-MESSAGE-HYMN describe blocks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildInitialGroup performs the D-05 migration: copies slot.audioUrl/videoUrl onto bedAudioUrl/bedVideoUrl via conditional spread (omitted entirely when absent), and never clears/rewrites the deprecated slot fields"
    requirement: "R030"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts (buildInitialGroup describe block: 3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "reconcileSongGroup is additive-only: new sections insert, still-resolving entries are kept by value (label/notes/audioUrl untouched), vanished-section entries are retained not deleted, and the two copyright entries are never duplicated (Pitfall-4 regression covered)"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts (reconcileSongGroup describe block: 7 tests, including the Pitfall-4 label/audio survival regression)"
        status: pass
    human_judgment: false
  - id: D4
    description: "reconcileScriptureGroup/reconcileImportedGroup never diff by inner-slide id; they compare sourceSignature and gate on hasCustomization, returning needsConfirm+proposed+loss for a diverged customized group and a silent replace for a diverged uncustomized one"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts (reconcileScriptureGroup: 4 tests; reconcileImportedGroup: 1 test covering in-sync/uncustomized/customized in one assertion chain)"
        status: pass
    human_judgment: false
  - id: D5
    description: "reconcileGroup dispatches on slot.kind to the correct reconciler for all five slot kinds, giving 24-05's composable a single entry point"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts (reconcileGroup dispatcher describe block: 3 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The module is pure — no @/stores, @/firebase, or vue imports"
    verification:
      - kind: other
        ref: "grep -c \"@/stores\\|@/firebase\\|from 'vue'\\|from \\\"vue\\\"\" src/utils/slideGroupMaterializer.ts == 0"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-07-25
status: complete
---

# Phase 24 Plan 03: Slide-Group Materializer & Reconciler Summary

**Pure `slideGroupMaterializer.ts` module deriving a slide group's initial structure from its slot's source and reconciling stored groups against later source changes — additive-only for songs (diff by content-stable `sectionId`), signature-detected and confirm-gated for scripture/imported decks (whose inner ids are positional or per-import-random) — enforcing D-02's never-silently-drop-user-work rule.**

## Performance

- **Duration:** 8 min (commit-to-commit; first commit 2026-07-25T22:15:57-04:00, final task commit 2026-07-25T22:23:12-04:00)
- **Started:** 2026-07-25T22:15:57-04:00
- **Completed:** 2026-07-25T22:23:12-04:00
- **Tasks:** 3
- **Files modified:** 2 (1 created source file, 1 created test file)

## Accomplishments

- `deriveGroupEntries(slot, inputs)` derives a `GroupSlideEntry[]` per slot kind, reproducing `assembleSlideshow`'s current emission order exactly (SONG: copyright/lyric.../copyright; SCRIPTURE/IMPORTED: one entry per inner slide; PRAYER/MESSAGE/HYMN: one `text` entry). It is the ONLY site that mints `GroupSlideEntry.id` via `crypto.randomUUID()`.
- `sourceSignature(slot, inputs)` computes a cheap count-prefixed joined-text/image-url proxy per RESEARCH.md Open Question 3 — no new hash utility introduced.
- `buildInitialGroup(slot, serviceId, inputs)` performs the D-05 migration, copying the slot's deprecated `audioUrl`/`videoUrl` onto `bedAudioUrl`/`bedVideoUrl` via conditional spread (matching `createSlot()`'s omit-when-absent discipline) without ever clearing the deprecated slot fields.
- `hasCustomization(group)` gates every reconciliation confirm.
- `reconcileSongGroup(group, slot, inputs)` merges additively by `sourceRef.sectionId`: inserts newly-resolving sections, keeps still-resolving stored entries by value (only `order` renumbered — label/notes/audioUrl survive byte-identical), retains vanished-section entries rather than deleting them, and never duplicates the leading/trailing `copyright` entries. The Pitfall-4 regression (a labeled entry surviving reconciliation triggered by an unrelated new verse) is covered.
- `reconcileScriptureGroup`/`reconcileImportedGroup` share a three-branch shape gated on `sourceSignature` + `hasCustomization`: unchanged signature is a no-op; diverged-but-uncustomized silently replaces (nothing to lose); diverged-and-customized returns the stored slides untouched plus `needsConfirm: true`, a `proposed` list, and a `loss` summary. Neither diffs by inner-slide id — documented inline citing `scriptureSplitter.ts`'s positional ids and `PptxImportModal.vue`'s per-import random ids.
- `reconcileGroup(group, slot, inputs)` dispatches on `slot.kind`, giving 24-05's composable a single call site across all five slot kinds.
- `src/utils/__tests__/slideGroupMaterializer.test.ts` created with 37 pure input/output tests (no mocking), copying `slideshowAssembler.test.ts`'s builder-function convention.

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation) TDD gates:

1. **Task 1: Derive a group's initial structure from its slot's source**
   - `689530f` (test) — RED: 23 failing tests (module didn't exist)
   - `aacae90` (feat) — GREEN: `deriveGroupEntries`/`sourceSignature`/`buildInitialGroup`/`hasCustomization`, 23/23 passing
2. **Task 2: Song reconciliation — additive-only merge by sectionId**
   - `6814466` (test) — RED: 6 new failing tests (`reconcileSongGroup` undefined)
   - `8c4f005` (feat) — GREEN: `reconcileSongGroup` implementation, 29/29 passing
3. **Task 3: Scripture and imported reconciliation — signature-detected, confirm-gated**
   - `c63078f` (test) — RED: 8 new failing tests (`reconcileScriptureGroup`/`reconcileImportedGroup`/`reconcileGroup` undefined)
   - `1d42597` (feat) — GREEN: implementation, 37/37 passing

**Plan metadata:** (this commit, following this summary)

## Files Created/Modified

- `src/utils/slideGroupMaterializer.ts` - NEW: `deriveGroupEntries`, `sourceSignature`, `buildInitialGroup`, `hasCustomization`, `reconcileSongGroup`, `ReconcileResult`, `reconcileScriptureGroup`, `reconcileImportedGroup`, `reconcileGroup`
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - NEW: 37 tests covering every `must_haves.truths` and each task's `acceptance_criteria`

## Decisions Made

- `sourceSignature` computes a value for SONG slots too (not just scripture/imported), for storage parity across every group document, even though song reconciliation diffs by `sectionId` and never reads the stored signature.
- Retained-but-unresolvable song-lyric entries are appended after the resolvable run (in their own original relative order) rather than interleaved positionally among resolvable entries — this satisfies the plan's "kept at their existing relative position" requirement without building a generic LCS-style merge, which RESEARCH.md's "Don't Hand-Roll" section explicitly warns against.
- When a stored song group has fewer than two `copyright` entries (a malformed/legacy edge case), a missing leading or trailing entry is minted fresh rather than reusing the single stored entry for both positions — reusing would create a duplicate `id` across two `GroupSlideEntry` objects, violating the "every derived entry has a distinct id" invariant.
- `reconcileGroup` normalizes every kind (including SONG, which never confirm-gates) into the same `ReconcileResult` shape (`needsConfirm`/`changed`/`slides`/`proposed?`/`loss?`) so 24-05's composable can call one function regardless of slot kind.

## Deviations from Plan

None - plan executed exactly as written. All `must_haves.truths` and every task's `acceptance_criteria` are covered by the 37 automated tests; no architectural changes, blocking issues, or missing-critical-functionality gaps were found.

## Issues Encountered

None. `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts` passes 37/37 at every task boundary; `npm run type-check` (vue-tsc --build across all three tsconfig references) exits 0; `grep -c "@/stores\|@/firebase\|from 'vue'\|from \"vue\""` on the new source file is 0, confirming the plan's purity acceptance criterion. A full `npx vitest run src/utils/` sweep (50 test files including quarantine debris) reports all 1316 tests passing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `deriveGroupEntries`, `buildInitialGroup`, `hasCustomization`, and `reconcileGroup` are ready for 24-04's assembler refactor (which resolves LIVE text from `sourceRef` against `AssemblyInputs`) and for 24-05's reactive composable (which calls `reconcileGroup` per slot and writes the result via 24-02's `useSlideGroups` store actions).
- The `ReconcileResult.proposed`/`loss` fields are ready for the Phase 26 confirm dialog to render "what would be lost" copy.
- No blockers. `npm run type-check` and the new test suite are both green; `src/stores/slideGroups.ts` (24-02) was not touched, per this plan's coordination note.

---
*Phase: 24-slide-group-model-and-migration*
*Completed: 2026-07-25*

## Self-Check: PASSED

All claimed files found on disk (`src/utils/slideGroupMaterializer.ts`, `src/utils/__tests__/slideGroupMaterializer.test.ts`, this SUMMARY). All claimed commits found in git log (`689530f`, `aacae90`, `6814466`, `8c4f005`, `c63078f`, `1d42597`).
