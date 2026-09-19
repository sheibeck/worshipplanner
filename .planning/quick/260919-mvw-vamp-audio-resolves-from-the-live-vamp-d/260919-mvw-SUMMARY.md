---
phase: quick-260919-mvw
plan: 01
subsystem: slideshow-assembly
tags: [vue, firestore, vamps, run-the-service, tdd]

requires:
  - phase: 141-vamp-slide-assignment-live-playback
    provides: R437 denormalized vamp-bed/entry assignment (bedVampId/bedVampLabel, vampId/vampLabel), R440 delete-keeps-Storage-when-assigned
provides:
  - "Vamp audio in Run the Service resolves from the LIVE vamp doc's attachment.downloadUrl, not the stored bedAudioUrl/audioUrl snapshot"
  - "Composable subscribes the vamp store (org-scoped, guarded on the store's own orgId) and passes a vampsById map to the assembler"
  - "vamps store onSnapshot swallows permission-denied for volunteers/viewers"
affects: [run-the-service, songs-vamps-library, rehearse-mode]

tech-stack:
  added: []
  patterns: ["live-resolve-over-stored-snapshot (liveVampAudioUrl helper) for a denormalized display field whose payload (the MP3 URL) must stay live while the label stays denormalized"]

key-files:
  created: []
  modified:
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/composables/useSlideshowAssembly.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/stores/vamps.ts
    - src/stores/__tests__/vamps.test.ts
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "Two-level audio precedence unchanged (entry-own wins over bed); only the URL source per level changed from stored-only to live-vamp-first-then-stored-fallback"
  - "vampsById is passed ONLY to the single assembleSlideshow() call inside the composable, not to the three materializer AssemblyInputs literals — materializers derive structure, not audio"
  - "Vamp store subscribe is guarded on the store's own orgId (not the composable's local subscribedOrgId), matching the pattern that lets ServiceEditorView/SongsView share the same store without stepping on each other's listener"

patterns-established:
  - "liveVampAudioUrl(vampId, inputs) helper in slideshowAssembler.ts: null/empty-safe live lookup with `|| undefined` string-empty collapse, used at all three resolution sites (entry, bed, synthetic reference)"

requirements-completed: [R437, R438, R440]

coverage:
  - id: D1
    description: "A bedVampId-only group (no stored bedAudioUrl) plays the live vamp's MP3 in Run the Service"
    requirement: R437
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#owner repro: bedVampId with no bedAudioUrl resolves the live vamp MP3"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#a bedVampId-only group plays the live vamp MP3 (owner repro)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Replacing a vamp's MP3 (or attaching one after assignment) propagates to every group bed / entry assigned to that vamp, live, with no group write"
    requirement: R437
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#replaced MP3: the live vamp URL wins over a stale stored bedAudioUrl"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#entry-level: the live vamp URL wins over a stale stored entry.audioUrl, entry keeps its own loop flag"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#attaching the MP3 after assignment reaches the assembler live"
        status: pass
    human_judgment: false
  - id: D3
    description: "A deleted vamp (R440) or an absent vampsById map falls back to the stored URLs byte-identically to pre-change output"
    requirement: R440
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#R440 deleted vamp: falls back to the stored bedAudioUrl when the vamp is absent from the map"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#regression: no vampsById key behaves byte-identically to an empty vampsById map, using the stored bedAudioUrl"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#a deleted vamp keeps the stored bed URL (R440)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A volunteer/viewer's denied vamps-store read is silent (no thrown error, no console.error); other listener errors still log"
    requirement: R438
    verification:
      - kind: unit
        ref: "src/stores/__tests__/vamps.test.ts#passes an error handler that swallows permission-denied and logs anything else"
        status: pass
    human_judgment: false
  - id: D5
    description: "Assembler stays pure (no store import), Run-side audio playback test untouched and green, type-check clean"
    verification:
      - kind: unit
        ref: "grep -c 'useVampStore\\|from .@/stores/' src/utils/slideshowAssembler.ts -> 0"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/RunControlView.audio.test.ts (17 tests, unmodified)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-19
status: complete
---

# Quick Task 260919-mvw: Vamp audio resolves from the live vamp doc Summary

**Run the Service now plays a vamp's CURRENT MP3 (attached before or after assignment, or replaced since) by resolving `bedVampId`/`vampId` against a live `vampsById` map at assembly time, with the stored `bedAudioUrl`/`audioUrl` snapshot kept only as the deleted-vamp/no-map fallback.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-19
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `slideshowAssembler.ts` gained an optional `AssemblyInputs.vampsById: ReadonlyMap<string, Vamp>` and a `liveVampAudioUrl` helper; `resolveEntryMedia` and `emitSyntheticReferenceFromGroup` now prefer the live vamp's `attachment.downloadUrl` over the stored URL at both the entry level and the group-bed level, while staying a pure function with no store import.
- `useSlideshowAssembly.ts` subscribes `useVampStore` alongside the other org-scoped stores (guarded on the store's own `orgId`, never torn down per-instance — `resetOrgScopedStores` already owns that), builds a `vampsById` computed from `vampStore.vamps`, and threads it into the single `assembleSlideshow()` call only (not the three materializer inputs).
- `vamps.ts`'s `subscribe` now passes `ignorePermissionDenied('vamps store')` as the `onSnapshot` error handler, so a magic-link volunteer or viewer-role member's denied read stays silent (the assembler falls back to stored URLs) while any other listener error still logs.
- Fixed the owner's local-emulator repro: a vamp assigned to a group bed while it had no MP3, then given an MP3 under Songs > Vamps, now plays in Run the Service with no group re-save.
- ARCHITECTURE.md's `slideshowAssembler.ts` and `useSlideshowAssembly.ts` entries document the new live-resolution rule.

## Task Commits

Each task was committed atomically (TDD RED/GREEN pairs):

1. **Task 1: Assembler resolves vamp audio from the live vamp map** - `363ebd21` (test, RED) then `15fae6e8` (fix, GREEN)
2. **Task 2: Composable subscribes vamps + listener hardening** - `b621c911` (test, RED) then `ae9f6c9b` (fix, GREEN)

_Docs commit (SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md) is made separately by the orchestrator, not this executor._

## Files Created/Modified
- `src/utils/slideshowAssembler.ts` - `AssemblyInputs.vampsById`, `liveVampAudioUrl` helper, `resolveEntryMedia` audio block rewritten, two call sites updated
- `src/utils/__tests__/slideshowAssembler.test.ts` - new describe with 8 cases + `makeVamp` fixture
- `src/composables/useSlideshowAssembly.ts` - `useVampStore` import/instance, guarded subscribe in the org watch, `vampsById` computed, one `assembleSlideshow` input added
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - `@/stores/vamps` stub, `beforeEach` reset, new describe with 4 cases
- `src/stores/vamps.ts` - `ignorePermissionDenied('vamps store')` as `onSnapshot`'s third argument
- `src/stores/__tests__/vamps.test.ts` - one new case asserting the error handler swallows permission-denied and logs anything else
- `.planning/codebase/ARCHITECTURE.md` - one paragraph on the assembler entry, one sentence on the composable entry

## Decisions Made
- Kept the two-level (entry-own-over-bed) audio precedence unchanged — only the URL SOURCE per level changed (live vamp preferred, stored URL as fallback), per the plan's locked design.
- `vampsById` feeds only the reactive `assembledSlideshow` computed, never the three materializer `AssemblyInputs` literals (`materializationCandidates`, `ensureGroupMaterialized`, `rebuildOutcomes`) — those derive stored group STRUCTURE, not audio, and must stay unaffected by a vamp's live attachment state.
- Guarded the vamp-store subscribe on `vampStore.orgId !== id` (the store's own field), not the composable's local `subscribedOrgId` — matches the precedent that lets `ServiceEditorView.vue` and `SongsView.vue` share the same non-idempotent `subscribe()` without any of the three callers re-subscribing on top of another's still-open listener.

## Deviations from Plan

None - plan executed exactly as written. No pre-existing test asserted the old snapshot-only behavior in a way that needed updating (the 260918-nm2 vamp-bed-loop describe already passes no `vampsById`, so it continues to exercise the pure fallback path unchanged).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Manual verification (owner, next local run, not gating per the plan): in the emulator repro, the Scripture Reading slide with "♪ Vamp: Key of C" should now play the MP3 attached after assignment, and replacing the vamp's MP3 under Songs > Vamps should change what Run the Service plays without touching the slide.
- No blockers. `firestore.rules`, `src/types/*.ts`, `src/composables/useRunControl.ts`, and `src/views/__tests__/RunControlView.audio.test.ts` are untouched, confirming no schema/rules change and no Run-side regression risk.

---
*Quick task: 260919-mvw*
*Completed: 2026-09-19*

## Self-Check: PASSED

All 4 commit hashes (363ebd21, 15fae6e8, b621c911, ae9f6c9b) and all 8 listed files (including this SUMMARY.md) confirmed present on disk / in git history.
