---
phase: 24-slide-group-model-and-migration
plan: 02
subsystem: data-model
tags: [typescript, firestore, vue3, pinia, slide-groups, deterministic-id, stripUndefined]

# Dependency graph
requires:
  - phase: 24-01
    provides: "SlideGroup/GroupSlideEntry/SourceRef/SlideGroupInput type contract; required, stable ServiceSlot.id"
provides:
  - "useSlideGroups Pinia store — the ONLY module in the phase that talks to Firestore about groups"
  - "materializeGroupIfMissing(orgId, input): deterministic-id, idempotent-by-construction create carrying the D-05 bed-media migration atomically"
  - "deleteGroup(orgId, slotId) — the R029 cascade-delete target for 24-06's slot-delete handler"
  - "setGroupBedMedia(orgId, slotId, patch) — scoped bed-field write with deleteField() clear sentinel, skeleton-create fallback"
  - "replaceGroupSlides(orgId, slotId, slides, sourceSignature?) — reconciliation apply half"
  - "groupsBySlotId computed Map<string, SlideGroup> — the map 24-04's assembler refactor consumes"
affects: [24-03, 24-04, 24-05, 24-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic Firestore doc id (doc id = slot.id) + getDoc-then-setDoc guard, never addDoc, to make lazy first-materialization race-safe across two tabs (RESEARCH.md Pattern 1)"
    - "Scoped dot-path-style field writes (setGroupBedMedia touches only the bed field + updatedAt) instead of whole-document rewrites, mirroring services.ts::setRoleOverride"
    - "Explicit clearAudio/clearVideo boolean flags (not 'undefined means clear') because stripUndefined() strips undefined before it reaches Firestore — deleteField() is the only real field-removal sentinel"
    - "Skeleton-document fallback: a scoped write action that targets a not-yet-materialized group creates a minimal valid document instead of throwing"

key-files:
  created:
    - src/stores/slideGroups.ts
    - src/stores/__tests__/slideGroups.test.ts
  modified: []

key-decisions:
  - "materializeGroupIfMissing writes id, slotId, serviceId AND slides (plus stamped timestamps) in one setDoc — no addDoc anywhere in the store (verified via grep -c \"addDoc\" == 0, with doc-comment wording deliberately avoiding the literal substring so the check stays honest)"
  - "setGroupBedMedia's skeleton-create branch includes id: slotId alongside slotId for consistency with SlideGroup's own id===slotId invariant, even though the plan's acceptance criteria only required slides: []"
  - "RESEARCH.md Open Question 1 resolved and documented as a doc comment on replaceGroupSlides: audioScope: 'group' is persisted by the Phase 26 UI as a direct write to the parent group's bedAudioUrl via setGroupBedMedia, with the entry's own audioUrl cleared — the assembler never interprets the stored audioScope value itself"

requirements-completed: [R028, R030, R018]

coverage:
  - id: D1
    description: "slideGroups store subscription lifecycle (subscribeGroups/unsubscribeGroups) and groupsBySlotId getter mirror importedSlides.ts's structural convention"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts (initial state, subscribeGroups, unsubscribeGroups, groupsBySlotId describe blocks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "materializeGroupIfMissing is idempotent by construction (deterministic slot-id doc path, getDoc guard, single setDoc, never addDoc) and carries the D-05 Phase-22 bed-media migration atomically"
    requirement: "R030"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts (materializeGroupIfMissing describe block: 5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real two-tab race against a live Firestore backend produces exactly one document per slot with no clobbered customization"
    verification: []
    human_judgment: true
    rationale: "Authored as a 'backstop' truth in 24-02-PLAN.md's must_haves — provable only against a real backend with two browser tabs, not a mocked unit test. Listed as a manual-verification row in 24-VALIDATION.md."
  - id: D4
    description: "deleteGroup, setGroupBedMedia (scoped write + deleteField() clear + skeleton-create fallback), and replaceGroupSlides are scoped writes, not whole-document rewrites"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts (deleteGroup, setGroupBedMedia, replaceGroupSlides describe blocks: 7 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "firestore.rules unmodified — the new collection is covered by the existing isOrgEditor(orgId) single-segment catch-all"
    verification:
      - kind: other
        ref: "git diff --stat firestore.rules (empty)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-07-25
status: complete
---

# Phase 24 Plan 02: Slide Group Firestore Store Summary

**Built the `useSlideGroups` Pinia store — subscription lifecycle plus deterministic-id materialize/delete/bed-media/slide-replace actions — as the single module through which every later Phase 24 plan touches `organizations/{orgId}/slideGroups`.**

## Performance

- **Duration:** 17 min (commit-to-commit; first commit 2026-07-25T21:50:14-04:00, final task commit 2026-07-25T22:06:52-04:00)
- **Started:** 2026-07-25T21:50:14-04:00
- **Completed:** 2026-07-25T22:06:52-04:00
- **Tasks:** 3
- **Files modified:** 2 (1 created source file, 1 created test file)

## Accomplishments

- `src/stores/slideGroups.ts` created as `defineStore('slideGroups', () => { ... })`, structurally mirroring `src/stores/importedSlides.ts`: `groups`/`isLoading` state, module-scoped `unsubscribeFn`, `subscribeGroups(orgId)` querying `organizations/{orgId}/slideGroups` ordered by `updatedAt` desc, `unsubscribeGroups()` resetting state exactly like every other content store.
- `groupsBySlotId` computed `Map<string, SlideGroup>` added — the exact shape 24-04's assembler refactor is documented to consume.
- `materializeGroupIfMissing(orgId, input)` implemented: resolves the doc ref as `doc(db, 'organizations', orgId, 'slideGroups', input.slotId)`, `getDoc`-guards existence, and on absence performs exactly one `setDoc` carrying `stripUndefined(input)` plus stamped `createdAt`/`updatedAt` — the D-05 bed-media migration (`bedAudioUrl`/`bedVideoUrl`) rides in the SAME write, so a group can never exist half-migrated. Never uses `addDoc` anywhere (verified `grep -c "addDoc" src/stores/slideGroups.ts` == 0).
- `deleteGroup`, `setGroupBedMedia`, and `replaceGroupSlides` added as scoped, non-whole-document writes: `deleteGroup` is a plain `deleteDoc` with no defensive existence guard (Firestore no-ops on a missing doc); `setGroupBedMedia` writes only the requested bed field(s) plus `updatedAt` via explicit `clearAudio`/`clearVideo` flags mapped to `deleteField()`, falling back to a skeleton `setDoc` (`slides: []` + supplied bed field) when the group hasn't materialized yet; `replaceGroupSlides` writes only `slides`/`sourceSignature`/`updatedAt`.
- `src/stores/__tests__/slideGroups.test.ts` created using `scriptureSlides.test.ts`'s exact mocking convention (mocked `firebase/firestore` functions, mocked `@/firebase`'s `db`, captured `snapshotCallback`, `triggerSnapshot` helper) — 20 tests, all passing.

## Task Commits

Each task followed RED (failing test) → GREEN (implementation) TDD gates:

1. **Task 1: subscription lifecycle and groupsBySlotId getter**
   - `246c8d4` (test) — RED: failing tests for subscribe/unsubscribe/groupsBySlotId (module didn't exist)
   - `a929309` (feat) — GREEN: store implementation, 8/8 tests passing
2. **Task 2: materializeGroupIfMissing with D-05 media migration**
   - `1bc0112` (test) — RED: 5 new failing tests (`materializeGroupIfMissing is not a function`)
   - `d85a6fb` (feat) — GREEN: implementation, 13/13 tests passing
3. **Task 3: deleteGroup, setGroupBedMedia, replaceGroupSlides**
   - `b346251` (test) — RED: 7 new failing tests
   - `8527fb7` (feat) — GREEN: implementation, 20/20 tests passing

**Plan metadata:** (this commit, following this summary)

## Files Created/Modified

- `src/stores/slideGroups.ts` - NEW: `useSlideGroups` Pinia store — `groups`, `isLoading`, `groupsBySlotId`, `subscribeGroups`, `unsubscribeGroups`, `materializeGroupIfMissing`, `deleteGroup`, `setGroupBedMedia`, `replaceGroupSlides`
- `src/stores/__tests__/slideGroups.test.ts` - NEW: 20 tests covering every behavior in the plan's `must_haves.truths` and each task's `acceptance_criteria`

## Decisions Made

- `materializeGroupIfMissing`'s doc comments deliberately avoid the literal substring `addDoc` (writing "the random-auto-id create function" instead) so the plan's `grep -c "addDoc" src/stores/slideGroups.ts` == 0 acceptance check stays a genuine zero-usage guarantee, not an artifact of comment wording happening to dodge a naive grep.
- `setGroupBedMedia`'s skeleton-create branch stamps `id: slotId` alongside `slotId` (matching `SlideGroup.id === SlideGroup.slotId`, the D-01 invariant documented in `src/types/slideGroup.ts`), even though the plan's literal acceptance criterion only named `slides: []`.
- RESEARCH.md Open Question 1 (whether `audioScope: 'group'` writes directly to `bedAudioUrl` or is computed at assembly time) is resolved and stated as a doc comment on `replaceGroupSlides`: it writes directly via `setGroupBedMedia`, and the stored `audioScope` field exists purely for UI round-tripping — the assembler never reads it for precedence.

## Deviations from Plan

None - plan executed exactly as written. All five `must_haves.truths` are covered by automated tests except the explicitly-marked `backstop` truth (real two-tab race against a live Firestore backend), which is out of scope for a mocked unit test and is tracked as a manual verification item (coverage `D3` above, `human_judgment: true`).

## Issues Encountered

None. `npx vitest run src/stores/__tests__/slideGroups.test.ts` passes 20/20 at every task boundary; `npm run type-check` exits 0 after the final task; `git diff --stat firestore.rules` is empty, confirming the phase's hard constraint (no rules changes) held.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useSlideGroups` is ready for 24-03 (pure derive/reconcile functions) to call `materializeGroupIfMissing`/`replaceGroupSlides` from a reactive composable layer, and for 24-04's assembler refactor to consume `groupsBySlotId`.
- `deleteGroup` is ready for 24-06's slot-delete handler to call as the R029 cascade target.
- `setGroupBedMedia` is ready for the Phase 26 UI's audio-scope toggle to call when a `GroupSlideEntry`'s `audioScope` is set to `'group'`.
- No blockers. `npm run type-check` is green; the new test file is green; `firestore.rules` is untouched.

---
*Phase: 24-slide-group-model-and-migration*
*Completed: 2026-07-25*

## Self-Check: PASSED

All claimed files found on disk (`src/stores/slideGroups.ts`, `src/stores/__tests__/slideGroups.test.ts`, this SUMMARY). All claimed commits found in git log (`246c8d4`, `a929309`, `1bc0112`, `d85a6fb`, `b346251`, `8527fb7`).
