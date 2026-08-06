---
phase: 30-slides-mirror-the-plan-hard-lock-reconciliation-removed
plan: 02
subsystem: slides-engine
tags: [vue, pinia, firebase, vitest, slides, engine]

# Dependency graph
requires: ["30-01"]
provides:
  - "rebuildSongGroup/rebuildScriptureGroup/rebuildImportedGroup/rebuildGroup — one unconditional, idempotent rebuild per slot kind, two-field {changed, slides} result"
  - "survivingEntries/derivedIdentityKey/carryStoredDerivedEntries — the generalized non-derivable-entry-survival + positional-carry machinery shared by all three group kinds"
  - "deriveGroupEntries's SCRIPTURE case narrowed to exactly ONE reference-only entry (R047); SourceRef.scripture.innerSlideId made optional"
  - "slideshowAssembler.ts resolves scripture content (both the stored-group path and the no-group fallback) from the reading's displayReference only, never the passage text"
  - "useSlideshowAssembly.ts rewired onto rebuildGroup with one unconditional decide/write loop — no pending-update state of any kind"
  - "SlideGroup.dismissedSignature removed from the type (stored values left in Firestore, no backfill)"
affects: [30-03, 30-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generalized survive-and-carry: a module-private derivedIdentityKey() gives each unstable-id source kind a content-stable identity (kind alone for scripture, importId+innerSlideId for imported), and carryStoredDerivedEntries() reuses 28-03's positional-consumption + 26-09's array-per-key fix generically across kinds rather than only for SONG lyric sections."

key-files:
  created: []
  modified:
    - src/utils/slideshowAssembler.ts
    - src/components/slides/slideDisplay.ts
    - src/utils/slideGroupMaterializer.ts
    - src/types/slideGroup.ts
    - src/composables/useSlideshowAssembly.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/utils/__tests__/slideGroupMaterializer.test.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
  deleted: []

key-decisions:
  - "Implemented the generalized carry mechanism EXACTLY as 30-CONTEXT.md/30-PATTERNS.md specified: positional consumption per occurrence of a derived-identity key, with per-key surplus emitted once after the key's LAST occurrence — reusing the shape verbatim rather than reinventing a scripture/imported-specific merge."
  - "A same-scriptureReadingId passage edit is a NO-OP at the materializer level (changed: false) — ScriptureSlideEditor.vue updates the reading document in place, so the stored sourceRef never changes; the new reference is resolved LIVE by Task 1's assembler change, not written here. Only a genuine reading-id SWAP (or a legacy stored entry whose shape no longer matches fresh derivation) produces a structural change. Verified against the actual editor code before writing tests, since the plan's prose read as if every passage edit rebuilt the entry."

patterns-established:
  - "derivedIdentityKey / carryStoredDerivedEntries as the generic non-SONG counterpart to the SONG additive merge's by-sectionId positional consumption — future unstable-id kinds should extend derivedIdentityKey rather than hand-roll a new merge."

requirements-completed: [R046, R047, R048]

coverage:
  - id: D1
    description: "A scripture group derives exactly ONE reference-only entry (no text), on both the stored-group resolution path and the no-group fallback path"
    requirement: R047
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#assembleSlideshow — scripture resolution / assembleSlideshow — stored group resolution (D-02, R028)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#deriveGroupEntries — SCRIPTURE"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hand-added video/authored-text entries survive a source change on SONG, SCRIPTURE and IMPORTED groups alike, with no confirm gate remaining anywhere"
    requirement: R046
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#D-17 / T-30-02-01 — hand-added video and authored-text entries survive every rebuild path"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#D-17 / T-30-02-01 — dropped video survives an unconditional rebuild (end-to-end)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every rebuild path is idempotent — re-running it over its own output is byte-identical — asserted directly for N=M, N<M and N>M on the song additive path, and for the song-swap, scripture and imported paths"
    requirement: R046
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#occurrence-aware repeat merge (D-02, Plan 28-03) / T-30-02 — cross-cutting survival and idempotence"
        status: pass
    human_judgment: false
  - id: D4
    description: "A rebuild never empties a group as a side effect of a loading race (source not yet resolvable), for all three kinds"
    requirement: R046
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideGroupMaterializer.test.ts#rebuildSongGroup (T-30-02-04) / rebuildScriptureGroup (T-30-02-04) / rebuildImportedGroup (T-30-02-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The composable's return carries no pending-updates value of any kind, and a song swap writes immediately with the new song's entries"
    requirement: R048
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts#unconditional rebuild-and-write (R046 — no confirm state)"
        status: pass
      - kind: other
        ref: "grep -rn \"dismissedSignature|hasCustomization|computeLoss|needsConfirm\" src/ -> zero hits"
        status: pass
    human_judgment: false
  - id: D6
    description: "Type-check is green and the full-suite failing-file set has not grown beyond the documented pre-existing baseline (12 files)"
    requirement: R048
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build), zero errors"
        status: pass
      - kind: unit
        ref: "npx vitest run (full suite): 12 failed files / 155 passed (167), 36 failed tests / 3584 passed / 18 skipped (3638) — exactly the documented baseline, zero new failures"
        status: pass
    human_judgment: false

duration: 3h 15min
completed: 2026-07-29
status: complete
---

# Phase 30 Plan 02: Unconditional, Idempotent Rebuild with Universal Survival Summary

**Replaced the three-branch confirm-gated slide-group reconciler with one unconditional, idempotent rebuild per slot kind, generalizing SONG's hand-added-slide survival to SCRIPTURE and IMPORTED groups in the same commit that deleted the confirm gate, and narrowed scripture derivation to a single reference-only slide.**

## Performance

- **Duration:** ~3h 15min
- **Tasks:** 3 completed
- **Files modified:** 9 (5 source, 4 test)

## Accomplishments
- `resolveEntryContent`'s scripture case and `assembleSlideshow`'s no-group SCRIPTURE fallback both resolve reference-only content directly from `ScriptureReading.displayReference`/`reference`, ignoring any legacy `innerSlideId` — a scripture slot never emits passage text, and the two paths agree so a slot's slide count never visibly flips when its group materializes
- `slideBodyText` returns the reference alone (no trailing blank line) when a scripture slide's text is empty
- `slideGroupMaterializer.ts`'s `hasCustomization`, `computeLoss`, the six-field confirm result type, and `reconcileUnstableIdGroup` are deleted; `isNonDerivableEntry` is kept verbatim and reused by a new `survivingEntries`/`derivedIdentityKey`/`carryStoredDerivedEntries` trio that generalizes 28-03's positional-consumption fix and 26-09's array-per-key fix from SONG-only to all three group kinds
- `rebuildSongGroup`/`rebuildScriptureGroup`/`rebuildImportedGroup`/`rebuildGroup` replace the `reconcile*` family, each returning `{ changed, slides }` and writing unconditionally; every path guards against an empty fresh derivation (source not yet loaded) by returning the group untouched rather than blanking it
- `deriveGroupEntries`'s SCRIPTURE case narrowed to exactly one entry per reading (R047); `SourceRef`'s scripture member's `innerSlideId` is now optional (kept in the union for Phase 34's congregational widening)
- `useSlideshowAssembly.ts`'s confirm orchestration (`PendingReconciliation`, the pending-updates Map, the durable-decline branch, the song-title resolver) is deleted outright; the composable now runs one decide/write loop keyed purely on `result.changed`, still passing the group's pre-rebuild slides as `replaceGroupSlides`'s compare-and-swap base
- `SlideGroup.dismissedSignature` removed from the type; stored Firestore values are left in place per CONTEXT.md's explicit leave-vs-backfill decision, with the reasoning recorded in a comment near `sourceSignature`
- Full grep for `dismissedSignature|hasCustomization|computeLoss|needsConfirm` across `src/` returns zero hits; type-check is green; the full test suite's failing-file set (12 files) matches the documented pre-existing baseline exactly, with zero new failures

## Task Commits

1. **Task 1: Scripture slides resolve to the passage reference only** - `fdd106e` (feat)
2. **Task 2: Unconditional, idempotent rebuild with universal non-derivable-entry survival** - `6303dde` (feat)
3. **Task 3: One unconditional decide/write loop in the assembly composable** - `e2b5dd2` (feat)
4. **Follow-up: tidy stray reconcile-vocabulary test descriptions** - `06b6e12` (docs)

**Plan metadata:** pending (docs: complete plan, this commit)

## Files Created/Modified
- `src/utils/slideshowAssembler.ts` - `resolveEntryContent`'s `'scripture'` case and `assembleSlideshow`'s no-group SCRIPTURE fallback both narrowed to reference-only content resolved from the reading directly
- `src/components/slides/slideDisplay.ts` - `slideBodyText`'s scripture case returns the reference alone when text is empty
- `src/utils/slideGroupMaterializer.ts` - the reconcile→rebuild engine rewrite (see Accomplishments); `deriveGroupEntries`'s SCRIPTURE case narrowed to one entry
- `src/types/slideGroup.ts` - `SourceRef`'s scripture `innerSlideId` made optional; `dismissedSignature` field removed; `sourceSignature`'s doc comment updated to note it is now a stored change-detector only, consulted by nothing
- `src/composables/useSlideshowAssembly.ts` - rewired onto `rebuildGroup`'s two-field result; confirm orchestration deleted; `useSongStore` import dropped (only consumer was the deleted song-title resolver)
- `src/utils/__tests__/slideshowAssembler.test.ts` - scripture-resolution describe blocks updated to the one-entry reference-only shape; the mixed-service section-metadata test's expected slide count adjusted
- `src/components/slides/__tests__/slideDisplay.test.ts` - added the empty-text `slideBodyText` assertion
- `src/utils/__tests__/slideGroupMaterializer.test.ts` - `hasCustomization`/song-identity-swap-confirm describes deleted outright; `reconcileSongGroup`/`reconcileScriptureGroup`/`reconcileImportedGroup`/`reconcileGroup dispatcher` describes renamed and rewritten to the rebuild vocabulary with confirm-shaped assertions stripped; the 26-09 and 28-03 regression-guard describes kept with only their result-shape reads changed; a new `T-30-02` describe added for cross-cutting survival + idempotence coverage
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - `PendingReconciliation widening`, `durable decline suppression`, and `CR-03` describes deleted outright; the `reconciliation (Task 3)` and `D-17` describes renamed and rewritten to assert immediate unconditional writes with no confirm state, widened to cover a scripture reading swap and an imported re-import end-to-end

## Decisions Made
- Followed 30-PATTERNS.md's positional-consumption precedent verbatim when writing the generalized `carryStoredDerivedEntries` — same occurrence-count-then-surplus shape as `rebuildSongGroup`'s lyric merge, keyed by a new `derivedIdentityKey` abstraction instead of `sectionId`
- Verified against `ScriptureSlideEditor.vue`'s actual implementation (it calls `store.updateReading` on the SAME reading document for a passage edit) before writing the "passage change" tests — a same-reading-id edit is a structural no-op for the materializer (`changed: false`); only a reading-id swap or a legacy-shaped stored entry produces a rebuild. This corrected an initial assumption that any passage edit would trigger a write

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing `vitest/no-conditional-expect` lint errors in code touched by this plan**
- **Found during:** Task 2, scoping `npx eslint` to the changed test file
- **Issue:** Two `for...if...expect(...)` loops in `slideGroupMaterializer.test.ts` (one in code I rewrote for the song-identity-swap describe, one in the untouched-but-renamed-call-site "repeated section" describe) triggered `vitest/no-conditional-expect`
- **Fix:** Rewrote both to filter first, then assert unconditionally over the filtered set (`.filter(...).every(...)` / a plain `for` loop with no `if`)
- **Files modified:** `src/utils/__tests__/slideGroupMaterializer.test.ts`
- **Commit:** `6303dde`

**2. [Rule 1 - Bug] Two composable tests broken by Task 1's scripture-reference-only change**
- **Found during:** Task 3, running the full `useSlideshowAssembly.test.ts` file
- **Issue:** `derives scriptureReadingsById from the scriptureSlides store...` asserted the fallback path emits the inner slide's passage `text`, which Task 1 correctly narrowed to an empty string; a new CR-02 test asserted `toBe` object identity on `replaceGroupSlides`'s 5th argument, which fails because `slideGroupsState` is Vue-`reactive()` and returns a Proxy, not the original array reference
- **Fix:** Updated the first assertion to check `{ text: '', reference: 'John 3' }`; changed `toBe` to `toEqual` (deep equality) for the CR-02 test
- **Files modified:** `src/composables/__tests__/useSlideshowAssembly.test.ts`
- **Commit:** `e2b5dd2`

**3. [Rule 1 - Bug] Two stray "reconcile" identifiers left in test descriptions after the rename**
- **Found during:** post-Task-3 grep sweep for leftover `reconcileGroup`/reconciliation vocabulary
- **Issue:** One `it()` description in `slideGroupMaterializer.test.ts` and one section-header comment in `useSlideshowAssembly.test.ts` still named the deleted `reconcileGroup` function / described the old confirm-surfacing behavior
- **Fix:** Renamed both to the rebuild vocabulary; no behavioral change
- **Files modified:** `src/utils/__tests__/slideGroupMaterializer.test.ts`, `src/composables/__tests__/useSlideshowAssembly.test.ts`
- **Commit:** `06b6e12`

None of these required Rule 4 (architectural) escalation — all were within-file corrections to code and tests this plan's tasks already owned.

## Known Stubs

None — no stub patterns introduced. Scripture text remains deliberately empty per R047 (Phase 34 populates it via the congregational reading feature), documented in code and tests as an intentional deferral, not an oversight.

## Threat Flags

None — every threat register item from the plan's `<threat_model>` (T-30-02-01 through T-30-02-05) was addressed as designed; no new security-relevant surface was introduced beyond what the plan anticipated.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The pure engine (`slideGroupMaterializer.ts`) and the composable (`useSlideshowAssembly.ts`) now carry zero confirm-shaped state — 30-03/30-04 can proceed with the hard-lock/read-only work and the final removal-proof gate without any remaining reconcile-vocabulary surface to coordinate around
- `src/stores/slideGroups.ts` is confirmed untouched by this plan (`git diff --name-only` does not list it) — its `replaceGroupSlides` concurrent-write transaction merge is exactly as it was, now load-bearing on every write path instead of just the additive one
- No blockers for 30-03 or 30-04

---
*Phase: 30-slides-mirror-the-plan-hard-lock-reconciliation-removed*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: `src/utils/slideshowAssembler.ts`
- FOUND: `src/components/slides/slideDisplay.ts`
- FOUND: `src/utils/slideGroupMaterializer.ts`
- FOUND: `src/types/slideGroup.ts`
- FOUND: `src/composables/useSlideshowAssembly.ts`
- FOUND: `.planning/phases/30-slides-mirror-the-plan-hard-lock-reconciliation-removed/30-02-SUMMARY.md`
- FOUND: commit `fdd106e` (feat, Task 1)
- FOUND: commit `6303dde` (feat, Task 2)
- FOUND: commit `e2b5dd2` (feat, Task 3)
- FOUND: commit `06b6e12` (docs, tidy)
