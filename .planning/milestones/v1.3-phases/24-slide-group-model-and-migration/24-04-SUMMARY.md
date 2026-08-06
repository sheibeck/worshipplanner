---
phase: 24-slide-group-model-and-migration
plan: 04
subsystem: slideshow-assembly
tags: [typescript, vue3, pinia, slideshow-assembler, audio-precedence, presentation-viewer]

# Dependency graph
requires:
  - phase: 24-01
    provides: "SlideGroup/GroupSlideEntry/SourceRef type contract; required, stable ServiceSlot.id"
  - phase: 24-03
    provides: "deriveGroupEntries/buildInitialGroup/reconcileGroup pure functions (the materializer this plan's assembler joins against)"
provides:
  - "assembleSlideshow(service, inputs) refactored to join stored SlideGroup structure against live canonical content via sourceRef (D-02), with AssemblyInputs.groupsBySlotId as a new required field"
  - "AssembledSlide.groupId/groupSlideId/audioFromBed/videoFromBed — assembly provenance for group-resolved slides"
  - "SlideBase.audioLoop — per-slide-only loop flag, never set on a bed-resolved slide"
  - "AudioPlayer loop prop (native <audio loop> pass-through)"
  - "PresentationViewer currentAudioKey/currentVideoKey group-scoped bed continuity (R030)"
affects: [24-05, 24-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-path assembler: a slot with a materialized SlideGroup joins stored order+sourceRef against live content; a slot with no group yet falls back to the pre-Phase-24 from-scratch derivation, so every commit in this phase keeps the app coherent before 24-05/24-06 wire up reactive subscription and lazy materialization"
    - "Unresolvable sourceRef entries are OMITTED from assembled output (never a placeholder) — the assembled slideshow feeds a live projector; the entry remains stored for a later Slides-grid surfacing"
    - "D-04 two-level audio precedence as a small pure resolveEntryMedia helper: entry.audioUrl wins, else group.bedAudioUrl, else nothing; audioLoop copied ONLY when the entry itself supplied the audio (a bed never loops); video has no per-slide layer and always resolves from bedVideoUrl"
    - "Group-scoped media keys: PresentationViewer's currentAudioKey/currentVideoKey key on groupId+url (not slide id+url) when audioFromBed/videoFromBed is true, so a bed survives slide transitions within its group while per-slide media keeps forcing a fresh child per slide (WR-02, unchanged)"

key-files:
  created: []
  modified:
    - src/utils/slideshowAssembler.ts
    - src/types/slide.ts
    - src/composables/useSlideshowAssembly.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/AudioPlayer.vue
    - src/components/__tests__/AudioPlayer.test.ts
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts

key-decisions:
  - "Task 1 (group join + sourceRef resolution) and Task 2 (D-04 audio/video precedence) were implemented as a single refactor pass over slideshowAssembler.ts and committed together — splitting the two into physically separate diffs would have required writing the media-precedence-less version first and then re-editing the same function bodies a second time with no intermediate verifiable state; both tasks' behaviors are covered by the 44 assembler tests added in that one commit"
  - "Fallback-path slide ids now derive from the slot's stable id (`${slot.id}:${localSeq}`) instead of the slot's array index — required by the plan (a pre-materialization render must not churn Vue keys across recomputes) and verified with an explicit stability test"
  - "sourceIdForRef centralizes AssembledSlide.sourceId derivation for group-resolved slides (songId for lyric/copyright, scriptureReadingId for scripture, importId for imported, null for text) — mirrors the fallback path's existing sourceId semantics exactly"
  - "buildTextContentForSlot factors the PRAYER/MESSAGE/HYMN text-content logic so the group path's generic `text` sourceRef entry can build the correct content by reading the owning slot's kind, since the entry itself carries no fields"

requirements-completed: [R028, R030, R018]

coverage:
  - id: D1
    description: "assembleSlideshow joins a slot's materialized SlideGroup (order-sorted) against live songLyricsById/scriptureReadingsById/importedDecksById via each entry's sourceRef; emitted slide ids equal the stored GroupSlideEntry.id, never recomputed"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts (stored group resolution describe block: 9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A lyric sourceRef resolves live text at assembly time (editing lyrics with an unchanged group changes emitted text); an entry whose source no longer resolves is omitted, and the stored group object is never mutated"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts (live-lyrics-edit test, unresolvable-entry-omitted test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A slot with no materialized group falls back to today's derivation with stable slot-id-based ids (identical across two successive calls); AssembledSlide.groupId/groupSlideId are set only on the group path"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts (fallback stability test, groupId/groupSlideId presence tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-04 two-level audio precedence (entry own audio wins, else group bed), audioLoop copied only from an entry-resolved slide, bedVideoUrl always resolving onto every group entry, and a bed-absent/entry-absent group emitting no audioUrl key at all"
    requirement: "R030"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts (D-04 audio precedence describe block: 7 tests incl. the bed/own/bed adjacency case)"
        status: pass
    human_judgment: false
  - id: D5
    description: "AudioPlayer's new loop prop pass-through and PresentationViewer's group-scoped currentAudioKey/currentVideoKey (bed continuity across a group's slides; per-slide keying and no-groupId slides unchanged from the pre-Phase-24 formula)"
    requirement: "R030"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AudioPlayer.test.ts (2 new loop tests); src/components/__tests__/PresentationViewer.test.ts (6 new bed-continuity/loop/per-slide-isolation tests, full pre-existing 52-test suite unchanged)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The assembler module stays pure (no @/stores, @/firebase, or vue imports)"
    verification:
      - kind: other
        ref: "grep -c \"@/stores\\|@/firebase\\|from 'vue'\" src/utils/slideshowAssembler.ts == 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~23min
completed: 2026-07-25
status: complete
---

# Phase 24 Plan 04: Slideshow Assembler Refactor — Stored Groups, Live Text, Two-Level Audio Summary

**Refactored `assembleSlideshow` in place to join a slot's stored `SlideGroup` structure against live canonical content via `sourceRef` (D-02), resolve D-04's two-level audio/bed-only video precedence as a pure helper, and made `PresentationViewer` key a group bed to the GROUP (not the slide) so it plays across slide transitions — with the Phase 23 `PresentationViewer.test.ts` regression guard fully intact.**

## Performance

- **Duration:** ~23 min (from Plan 24-03's completion at 2026-07-25T22:25:21-04:00 to this plan's final task commit at 2026-07-25T22:45:45-04:00)
- **Started:** 2026-07-25T22:25:21-04:00
- **Completed:** 2026-07-25T22:45:45-04:00
- **Tasks:** 3 (Task 1 and Task 2 committed together — see Decisions Made)
- **Files modified:** 11

## Accomplishments

- `assembleSlideshow` now has two resolution paths per slot: a slot with a materialized group (`inputs.groupsBySlotId`) walks its stored `GroupSlideEntry[]` in `order`, resolving each entry's content live through its `sourceRef` (`lyric`/`copyright`/`scripture`/`imported`/`text`) and emitting with `id: entry.id` — never a recomputed id, preserving Phase 23's WR-02 anti-state-leak contract. A slot with no group yet falls back to today's from-scratch derivation, now with stable `slot.id`-based fallback ids (was slot-array-index-based) so a pre-materialization render cannot churn Vue keys.
- An entry whose `sourceRef` no longer resolves is OMITTED from the assembled output (never a placeholder, since the assembled slideshow feeds a live projector); the stored group is never mutated by assembly.
- D-04's two-level audio precedence and bed-only video resolve through a small pure `resolveEntryMedia` helper: an entry's own `audioUrl` wins, falling back to the group's `bedAudioUrl`; `audioLoop` copies ONLY from an entry-resolved slide (a bed never loops); `bedVideoUrl` lands on every entry (video has no per-slide layer). The old first-emitted-slide-only media rule (`slotsWithMediaAttached`) is deleted from the group path and kept ONLY on the no-group fallback path, so pre-migration services behave exactly as before.
- `AssembledSlide` gains `groupId`/`groupSlideId` (set only on the group path) and `audioFromBed`/`videoFromBed` (assembly provenance); `SlideBase` gains `audioLoop`.
- `useSlideshowAssembly.ts` wires the new required `groupsBySlotId` input from the 24-02 `useSlideGroups` store — the store's real subscription is wired in 24-05, so the map is legitimately empty today and every slot takes the fallback path, keeping the app coherent at every commit.
- `AudioPlayer.vue` gains an optional `loop` prop bound to the native `<audio loop>` attribute; `PresentationViewer.vue` passes `currentSlide.slide.audioLoop` through and changes `currentAudioKey`/`currentVideoKey` to key on the GROUP id (not slide id) when `audioFromBed`/`videoFromBed` is true, so a bed keeps playing across a group's slide transitions while per-slide media (and any pre-migration slide with no `groupId`) keeps forcing a fresh child instance per slide, byte-identical to the pre-Phase-24 formula.

## Task Commits

Each task was committed atomically (Tasks 1 and 2 combined — see Decisions Made):

1. **Task 1 + Task 2: Assembler reads stored groups, resolves live text via sourceRef, and D-04 two-level audio/video precedence** - `26667f8` (feat)
2. **Task 3: AudioPlayer loop pass-through and group-scoped bed keying in PresentationViewer** - `81bcaa5` (feat)

## Files Created/Modified

- `src/utils/slideshowAssembler.ts` - refactored in place: added `AssemblyInputs.groupsBySlotId` (required), `resolveEntryContent`/`resolveEntryMedia`/`sourceIdForRef`/`buildTextContentForSlot` helpers, the group-path/fallback-path split in `assembleSlideshow`
- `src/types/slide.ts` - `SlideBase.audioLoop`; `AssembledSlide.groupId`/`groupSlideId`/`audioFromBed`/`videoFromBed`; updated doc comments
- `src/composables/useSlideshowAssembly.ts` - imports `useSlideGroups`, passes `slideGroupsStore.groupsBySlotId` into `assembleSlideshow`
- `src/utils/__tests__/slideshowAssembler.test.ts` - added `makeSlideGroup`/`makeGroupSlideEntry` builders; two new describe blocks (`stored group resolution`, `D-04 two-level audio precedence`) totaling 18 new tests; existing 26 tests unchanged (now exercising the fallback path)
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - Rule 3 fix: added the new required `groupsBySlotId` field to its local `makeInputs` helper (compile break from Task 1's type change)
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - Rule 3 fix: added a `@/stores/slideGroups` reactive-stub mock (same pattern as the existing scriptureSlides/importedSlides mocks) — unmocked, `useSlideGroups()` throws with no active Pinia in this composable's test suite
- `src/views/__tests__/ServiceEditorView.test.ts` - Rule 3 fix: same `@/stores/slideGroups` mock addition, for the same reason
- `src/components/AudioPlayer.vue` - `loop?: boolean` prop, bound to `<audio :loop="loop">`; updated doc comment
- `src/components/__tests__/AudioPlayer.test.ts` - 2 new tests for the loop attribute
- `src/components/PresentationViewer.vue` - `:loop="currentSlide?.slide.audioLoop"` on the AudioPlayer mount; `currentAudioKey`/`currentVideoKey` group-scoped when bed-resolved; extended WR-02 doc comment
- `src/components/__tests__/PresentationViewer.test.ts` - added `bedAudioSlide`/`bedVideoSlide`/`loopingAudioSlide` fixture builders and 6 new tests (loop pass-through x2, bed-continuity x2, per-slide-isolation x2); full pre-existing 52-test suite passes unchanged

## Decisions Made

- Task 1 (group join + sourceRef resolution) and Task 2 (D-04 audio/video precedence) were written and committed as a single refactor pass over `slideshowAssembler.ts`, rather than two separate diffs. Both tasks modify the same `emitFromGroup`/loop body in the same function; writing Task 1 without Task 2's media resolution would have produced an intermediate state where the group path silently dropped all bed/per-slide audio (a regression against the plan's own must-haves), then required re-editing the identical code a second time. All of Task 1's and Task 2's `acceptance_criteria` are independently covered by the 18 new tests added in the one commit — verified by running `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` before commit (44/44 passing).
- Fallback-path slide ids now derive from the slot's stable `id` (`${slot.id}:${localSeq}`) rather than the slot's array index — required by the plan so a pre-materialization render cannot churn Vue keys across recomputes. Verified by an explicit two-successive-calls stability test. No existing test asserted the old index-derived id format, so this is a pure improvement with zero regression risk.
- `sourceIdForRef` centralizes `AssembledSlide.sourceId` derivation for group-resolved slides, mirroring the fallback path's existing `sourceId` semantics (songId for lyric/copyright, scriptureReadingId for scripture, importId for imported, null for text) so downstream consumers see identical `sourceId` semantics regardless of which path produced a slide.
- `buildTextContentForSlot` factors the PRAYER/MESSAGE/HYMN text-content logic into a shared helper the group path's generic `text`-kind entry calls (an entry carries no fields of its own — content depends entirely on which slot kind owns the group).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `slideGroupMaterializer.test.ts`'s local `makeInputs` helper broke `npm run type-check` after `AssemblyInputs.groupsBySlotId` became required**
- **Found during:** Task 1 (repo-wide type-check after adding the new required field)
- **Issue:** `src/utils/__tests__/slideGroupMaterializer.test.ts` (from Plan 24-03) has its own local `AssemblyInputs` fixture builder that didn't know about the new required field, producing a compile error blocking `npm run type-check`.
- **Fix:** Added `groupsBySlotId: new Map()` to the builder's default return object.
- **Files modified:** `src/utils/__tests__/slideGroupMaterializer.test.ts`
- **Commit:** `26667f8` (Task 1 commit)

**2. [Rule 3 - Blocking] `useSlideshowAssembly.test.ts` and `ServiceEditorView.test.ts` would crash on "no active Pinia" once the composable calls `useSlideGroups()`**
- **Found during:** Task 1 (full-suite verification after wiring the new store call into `useSlideshowAssembly.ts`)
- **Issue:** Neither test file installs a real Pinia instance (both already mock every OTHER store `useSlideshowAssembly` touches — `scriptureSlides`, `importedSlides`, `songs` — via `vi.mock`, exactly because the real Pinia stores throw `getActivePinia() was called but there was no active Pinia` when invoked outside an installed Pinia app). Adding the real `useSlideGroups()` call without an equivalent mock would have broken both suites.
- **Fix:** Added a `vi.mock('@/stores/slideGroups', ...)` reactive-stub in each file, mirroring the existing `scriptureSlides`/`importedSlides` mock pattern exactly (empty `groups`, `groupsBySlotId` as an empty Map, and no-op action stubs).
- **Files modified:** `src/composables/__tests__/useSlideshowAssembly.test.ts`, `src/views/__tests__/ServiceEditorView.test.ts`
- **Commit:** `26667f8` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking compile/test-crash issues caused directly by Task 1's required-field/new-store-call changes, not scope creep)
**Impact on plan:** Necessary to keep `npm run type-check` and the existing test suites green after Task 1's `AssemblyInputs` and `useSlideshowAssembly.ts` changes; no other files needed touching (confirmed via `grep -rln "useSlideshowAssembly" src` that `SlideshowPreview.vue`/`ImportedSlideEditor.vue` only reference it in comments, not as a live import).

## Issues Encountered

None beyond the two deviations above. `npm run type-check` (vue-tsc --build across all three tsconfig references) exits 0. `npx vitest run src/ --exclude '.gsd/**'` reports 1228 passed / 9 failed / 18 skipped across 64 real test files; every one of the 9 failures is pre-existing and pre-documented in STATE.md: 8 in `src/storage.rules.test.ts` (requires the Storage emulator, deliberately not started per this plan's hard constraints — a live user session may hold ports 8080/9199) and 1 in `src/views/__tests__/RosterView.test.ts` ("wraps Roles config in CollapsibleSection", a stale string assertion unrelated to this phase). Zero new failures in any real source file.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `AssemblyInputs.groupsBySlotId`, `AssembledSlide.groupId`/`groupSlideId`/`audioFromBed`/`videoFromBed`, and `SlideBase.audioLoop` are ready for 24-05's reactive composable work (wiring `useSlideGroups().subscribeGroups()` and lazy materialization) — until that lands, every slot takes the fallback path and the app is unchanged from today's behavior.
- `AudioPlayer`'s `loop` prop and `PresentationViewer`'s group-scoped bed keys are ready for real group data the moment 24-05/24-06 start populating `groupsBySlotId` with materialized groups carrying `bedAudioUrl`/per-slide `audioUrl`/`audioLoop`.
- Phase 23's `PresentationViewer.test.ts` regression guard is intact — the full pre-existing 52-test suite passes unchanged alongside the 6 new Phase 24 tests, and Phase 23's outstanding human-verify checkpoint remains unaffected since every key computed falls back to its exact pre-refactor formula for data with no `groupId`.
- No blockers. `npm run type-check` and the targeted test suites are green; the only failing tests repo-wide are the two pre-existing, pre-documented categories (Storage emulator, stale RosterView assertion).

---
*Phase: 24-slide-group-model-and-migration*
*Completed: 2026-07-25*

## Self-Check: PASSED

All claimed files found on disk (`src/utils/slideshowAssembler.ts`, `src/types/slide.ts`, `src/composables/useSlideshowAssembly.ts`, `src/components/AudioPlayer.vue`, `src/components/PresentationViewer.vue`, this SUMMARY). All claimed commits found in git log (`26667f8`, `81bcaa5`).
