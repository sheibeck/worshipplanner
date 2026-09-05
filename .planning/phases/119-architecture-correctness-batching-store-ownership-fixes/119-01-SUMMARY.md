---
phase: 119-architecture-correctness-batching-store-ownership-fixes
plan: 01
subsystem: stores
tags: [firestore, writeBatch, pinia, vue, robustness]

# Dependency graph
requires:
  - phase: 110-architectural-review
    provides: ARCH-011/ARCH-014/ARCH-009 findings this plan closes
provides:
  - Per-item failure isolation in services.ts's recomputeLastUsedFor (R349/ARCH-011)
  - Batched, per-song-reported upsertSongs with PcImportModal UI feedback (R350/ARCH-014)
  - Single shared lyricsQuery for songLyrics store + useSlideshowAssembly composable (R351/ARCH-009)
affects: [119-02, 119-03, 119-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-item try/catch inside a batch-recompute loop, with failed ids logged once after the loop, instead of one bug-store-wide try/catch"
    - "writeBatch chunking (<=499 ops) with per-chunk try/catch around commit(), returning a { added, updated, failed } summary instead of throwing"
    - "One exported query-builder function (lyricsQuery) as the single source of truth for a Firestore query built from two call sites"

key-files:
  created:
    - src/components/__tests__/PcImportModal.test.ts
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts
    - src/stores/songs.ts
    - src/stores/__tests__/songs.test.ts
    - src/components/PcImportModal.vue
    - src/composables/useSlideshowAssembly.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/stores/songLyrics.ts
    - src/stores/__tests__/songLyrics.test.ts

key-decisions:
  - "upsertSongs now returns UpsertSongsSummary { added, updated, failed } instead of void — PcImportModal is the only real caller (importFromPc's dead-code inline type is self-contained and unaffected)"
  - "PcImportModal's onDoneClose 'imported' count now reflects the real post-import summary (added + updated), not the pre-import preview counts, since a partial failure can now make them diverge"
  - "defaultLyricsSubscriber keeps taking the newest doc via snap.docs[0] client-side rather than re-adding limit(1), since the shared lyricsQuery has no limit and both queries share the same orderBy('createdAt','desc')"

patterns-established:
  - "Any future store method that recomputes/iterates over multiple independent Firestore writes should isolate per-item try/catch rather than one bulk try/catch, mirroring recomputeLastUsedFor"

requirements-completed: [R349, R350, R351]

coverage:
  - id: D1
    description: "recomputeLastUsedFor isolates a per-song updateSong failure — the rest of affectedSongIds still get written, and the failed id(s) are logged"
    requirement: "R349"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#R349: a mid-loop updateSong rejection for one song does not prevent the others from being written; the failed id is logged"
        status: pass
    human_judgment: false
  - id: D2
    description: "upsertSongs chunks writes into <=499-op writeBatch batches, isolates a failing chunk's commit, and returns a per-song added/updated/failed summary"
    requirement: "R350"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/songs.test.ts#upsertSongs — batch chunking + per-chunk failure isolation (R350)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PcImportModal's 'done' step surfaces the real added/updated/failed counts (and failed titles) from upsertSongs' summary, routing to 'error' only on a thrown/non-recoverable failure"
    requirement: "R350"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PcImportModal.test.ts (all 7 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "songLyricsStore.subscribeLyrics and useSlideshowAssembly's defaultLyricsSubscriber both build their query from one shared lyricsQuery(orgId, songId), with no limit(1) drift; newest-createdAt-wins is preserved"
    requirement: "R351"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/songLyrics.test.ts#lyricsQuery (shared query builder)"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#defaultLyricsSubscriber shares songLyricsStore.lyricsQuery (R351/ARCH-009)"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-05
status: complete
---

# Phase 119 Plan 01: Architecture — Correctness, Batching & Store-Ownership Fixes Summary

**Per-item failure isolation in the lastUsedAt recompute, writeBatch-chunked + per-song-reported Planning Center import, and a single shared lyrics query eliminating a limit(1) drift.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-09-05T03:19:37Z
- **Tasks:** 3
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments
- `recomputeLastUsedFor` (src/stores/services.ts) now wraps each song's `updateSong` call in its own try/catch, so one song's rejected write no longer aborts the recompute for every other song in the same lock/unlock transition; failed song ids are logged once after the loop.
- `upsertSongs` (src/stores/songs.ts) now stages writes via `writeBatch` in chunks of <=499 combined ops (mirroring the sibling `importSongs`), with each chunk's `commit()` isolated in its own try/catch, and returns a `{ added, updated, failed }` summary instead of `void`.
- `PcImportModal.vue`'s 'done' step now shows the real added/updated/failed counts (and failed titles) from that summary, and its emitted `imported` count reflects what was actually written — instead of always trusting the pre-import preview.
- `songLyrics.ts` exports one shared `lyricsQuery(orgId, songId)` (no `limit`); both `subscribeLyrics` and `useSlideshowAssembly`'s `defaultLyricsSubscriber` now build their listener from it, eliminating the `limit(1)` that previously existed only in the composable. Newest-createdAt-wins is preserved via client-side `docs[0]`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-item failure isolation in recomputeLastUsedFor (R349)** - `82fa41a5` (fix)
2. **Task 2: Batch + per-song-reported Planning Center import (R350)** - `11d5866c` (fix)
3. **Task 3: Single source of truth for the lyrics query (R351)** - `998ac9be` (fix)

_No TDD gate — plan tasks are `type="auto" tdd="true"` per-task RED/GREEN cycles folded into each single commit above (tests + implementation land together per task, per the plan's `<verify>` gate running both together)._

## Files Created/Modified
- `src/stores/services.ts` - `recomputeLastUsedFor` per-song try/catch + failed-id logging (R349)
- `src/stores/__tests__/services.test.ts` - regression test for R349 isolation; a pre-existing type error in the new test's mock signature was also fixed (see Deviations)
- `src/stores/songs.ts` - `upsertSongs` rewritten to chunk writes via `writeBatch`, isolate per-chunk failures, and return `UpsertSongsSummary` (R350)
- `src/stores/__tests__/songs.test.ts` - existing `upsertSongs` tests migrated from `addDoc`/`updateDoc` assertions to `mockBatchOps` (matching the `hardDeleteSong` precedent); new chunking + failure-isolation tests
- `src/components/PcImportModal.vue` - consumes `upsertSongs`' summary on the 'done' step; added `data-testid` hooks for testability
- `src/components/__tests__/PcImportModal.test.ts` - new component test suite (7 tests) covering the full idle→preview→confirm→done flow, failure surfacing, newOnly toggling, and the error-step routing rule
- `src/composables/useSlideshowAssembly.ts` - `defaultLyricsSubscriber` now calls the shared `lyricsQuery`; removed now-unused `collection`/`query`/`orderBy`/`limit`/`db` imports (R351)
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - new describe block proving the default subscriber routes through `lyricsQuery` and preserves newest-wins via `docs[0]`
- `src/stores/songLyrics.ts` - exports `lyricsQuery(orgId, songId)`; `subscribeLyrics` now calls it (R351)
- `src/stores/__tests__/songLyrics.test.ts` - regression tests for `lyricsQuery`'s shape and `subscribeLyrics`'s routing through it

## Decisions Made
- `upsertSongs`'s return type change (`void` → `UpsertSongsSummary`) only affects the real caller (`PcImportModal.vue`); `src/utils/pcSongImport.ts`'s dead-code `importFromPc` function has its own self-contained inline `store` parameter type and is never called anywhere in the codebase, so it required no changes and type-checks unaffected.
- `PcImportModal`'s emitted `imported` count and 'done'-step wording now derive from the real `upsertSongs` summary (added/updated/failed) rather than the pre-import preview counts, since a partial batch failure can now make the two diverge — this is a deliberate, small behavior improvement within R350's scope (surfacing real outcomes), not a new feature.
- `defaultLyricsSubscriber` keeps its `snap.docs[0]` newest-wins resolution rather than re-adding a `limit(1)` on the shared query, since Firestore's ordering guarantees the two are byte-identical and the shared query intentionally carries no `limit`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a type error in services.test.ts's new R349 test**
- **Found during:** Overall verification (`npm run type-check`, run after all three tasks)
- **Issue:** The R349 regression test's `mockUpdateSong.mockImplementation((songId: unknown) => ...)` required a non-optional argument, which vue-tsc rejected against `mockUpdateSong`'s declared `vi.fn(() => Promise.resolve())` type (`() => Promise<void>`, callable with 0 args).
- **Fix:** Made the parameter optional (`songId?: unknown`) so the implementation is structurally compatible with a 0-arg call signature.
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Verification:** `npm run type-check` clean; `npx vitest run src/stores/__tests__/services.test.ts` still green (110 tests)
- **Committed in:** `998ac9be` (bundled with the Task 3 commit, since it was only caught by the final overall gate)

---

**Total deviations:** 1 auto-fixed (1 blocking type fix)
**Impact on plan:** No scope creep — a test-only type annotation fix caught by the plan's mandated `npm run type-check` gate (which typechecks test files, unlike the narrower `-p tsconfig.app.json` form per CLAUDE.md).

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three R349/R350/R351 findings are closed; app suite stays at its documented baseline (only `src/storage.rules.test.ts`, a known Storage-emulator environment limitation, fails on a bare `npx vitest run`).
- `npm run type-check` (`vue-tsc --build`) is clean across src and test files.
- No blockers for 119-02/119-03/119-04, which touch different files (services.ts's other call sites, songs.ts's other functions, and separate components per their own plans).

---
*Phase: 119-architecture-correctness-batching-store-ownership-fixes*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all three task commit hashes (82fa41a5, 11d5866c, 998ac9be) confirmed in `git log --all`.
