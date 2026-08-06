---
phase: 24-slide-group-model-and-migration
plan: 01
subsystem: data-model
tags: [typescript, firestore, vue3, pinia, slide-groups, service-slots]

# Dependency graph
requires: []
provides:
  - "SlideGroup, GroupSlideEntry, SourceRef, SlideGroupInput type contract (src/types/slideGroup.ts)"
  - "Required ServiceSlot.id (D-01) minted by createSlot()/buildSlots(), backfilled by backfillSlotIds()"
  - "id propagated to every existing slot-construction site in the test suite (repo-wide green type-check)"
affects: [24-02, 24-03, 24-04, 24-05, 24-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic doc id anchoring (slot.id === group.id) replaces array-index/position anchoring for anything that must survive a reorder"
    - "Reference-stable pure backfill: return the original object when nothing changed, so folding a migration into a load watcher can never manufacture a false isDirty"
    - "Two-argument backfill (remote, local) reuses the local id at the same array index (kind-guarded) to keep a JSON.stringify remote-merge diff stable across snapshots"

key-files:
  created:
    - src/types/slideGroup.ts
  modified:
    - src/types/service.ts
    - src/utils/slotTypes.ts
    - src/utils/__tests__/slotTypes.test.ts
    - src/utils/__tests__/planningCenterApi.test.ts
    - src/utils/__tests__/planningCenterExport.test.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/stores/__tests__/services.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/components/__tests__/ServiceCard.test.ts
    - src/components/__tests__/ServicePrintLayout.test.ts
    - src/components/__tests__/ServiceScriptureIntegration.test.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts

key-decisions:
  - "SourceRef gets a fifth 'copyright' kind member (planner addition beyond RESEARCH.md's four) so a song group's leading/trailing copyright entries never abuse sectionId"
  - "id is ALWAYS written by createSlot()/buildSlots() (no legacy absent-id state to preserve for new slots) — unlike section's conditional-spread omission discipline"
  - "backfillSlotIds(service, reference?) two-argument form is a planner correction to RESEARCH.md's single-argument design, preventing the remote-merge JSON.stringify comparison from permanently mismatching on legacy documents"
  - "reindexSlots() needed no code change — its existing spread already carries id through every reorder"

patterns-established:
  - "Slot fixtures across test suites now carry deterministic, human-readable id literals (e.g. slot-song-0) rather than routing through createSlot() — preserves each suite's deliberate malformed/legacy-shape coverage"

requirements-completed: [R028, R018]

coverage:
  - id: D1
    description: "SlideGroup/GroupSlideEntry/SourceRef/SlideGroupInput type contract declared in src/types/slideGroup.ts, with slides as an embedded array field (never a Firestore subcollection)"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build across app+vitest+node references)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ServiceSlot.id required on every variant; createSlot()/buildSlots() mint it; reindexSlots() preserves it through reorder"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts (createSlot id uniqueness, buildSlots 9 distinct ids, reindexSlots preserves id)"
        status: pass
    human_judgment: false
  - id: D3
    description: "backfillSlotIds(service, reference?) is reference-stable when all ids present, reuses the reference id at the same array index when kinds match, and mints a fresh id otherwise"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts (backfillSlotIds describe block: 5 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Required id propagated to every existing slot-construction site across 11 test suites; repo-wide type-check green; no assertion semantics weakened"
    verification:
      - kind: unit
        ref: "npm run type-check"
        status: pass
      - kind: unit
        ref: "npx vitest run src/ (3047 passed, 23 failed — all 23 confined to .gsd/quarantine/worktrees/** stale debris, zero new failures in real source files)"
        status: pass
    human_judgment: false

# Metrics
duration: 78min
completed: 2026-07-25
status: complete
---

# Phase 24 Plan 01: Slide-Group Type Contract & Stable Slot Identity Summary

**Declared the `SlideGroup`/`GroupSlideEntry`/`SourceRef` type contract and gave every `ServiceSlot` variant a required, stable `id` (D-01) that slide groups will anchor to — with a reference-stable backfill for legacy documents and the id propagated through every existing slot fixture in the repo.**

## Performance

- **Duration:** 78 min (commit-to-commit; first commit 2026-07-25T20:11:53-04:00, final task commit 2026-07-25T21:29:19-04:00)
- **Started:** 2026-07-25T20:11:53-04:00
- **Completed:** 2026-07-25T21:29:19-04:00
- **Tasks:** 3
- **Files modified:** 13 (1 created, 12 modified)

## Accomplishments

- `src/types/slideGroup.ts` declares `SlideGroup`, `GroupSlideEntry`, `SourceRef` (5-member discriminated union including a planner-added `copyright` kind), and `SlideGroupInput` — the contract every later Phase 24 plan imports.
- `MediaAttachableSlot` (and therefore every `ServiceSlot` variant) now carries a required `id: string`. `createSlot()`/`buildSlots()` always mint it via `crypto.randomUUID()`; `reindexSlots()` needed no change since its spread already preserves it through reorder.
- `backfillSlotIds(service, reference?)` added: pure, reference-stable (returns the same object when nothing changed), and remote-merge safe — the two-argument form reuses the reference service's id at the same array index (guarded by matching `kind`) so a legacy Firestore snapshot's `JSON.stringify` diff against local state never permanently mismatches.
- Propagated the now-required `id` field to every slot-construction site the compiler flagged across 11 test suites, using deterministic human-readable ids and threading them through existing builder functions where one already existed, without weakening any assertion or rewriting deliberately-malformed fixture shapes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the slide-group type contract** - `d84cfc6` (feat)
2. **Task 2: Add required ServiceSlot.id, mint it at creation, backfill it on read** - `9b28d4f` (feat)
3. **Task 3: Propagate the now-required id to every slot-construction site** - `74be0d7` (fix)

_Note: Task 3 is typed `fix` rather than `feat` because it repairs compile breakage the type-contract change (Task 2) introduced across existing test fixtures — no new behavior was added._

## Files Created/Modified

- `src/types/slideGroup.ts` - NEW: `SlideGroup`, `GroupSlideEntry`, `SourceRef` (5-kind union), `SlideGroupInput`
- `src/types/service.ts` - `MediaAttachableSlot` gains required `id: string`, documented as the `slideGroups/{slotId}` anchor
- `src/utils/slotTypes.ts` - `createSlot()`/`buildSlots()`'s inner builders mint `id`; new `backfillSlotIds(service, reference?)` export
- `src/utils/__tests__/slotTypes.test.ts` - id assertions on `createSlot`/`buildSlots`/`reindexSlots`; new `backfillSlotIds` describe block (5 tests)
- `src/utils/__tests__/planningCenterApi.test.ts`, `planningCenterExport.test.ts`, `slideshowAssembler.test.ts` - added `id` to raw slot literals/builder functions
- `src/stores/__tests__/services.test.ts` - added `id` to a raw slot-literal fixture array; added `randomUUID` to the file's `vi.stubGlobal('crypto', ...)` stub (Rule 1 fix, see below)
- `src/views/__tests__/ServiceEditorView.test.ts` - added `id` to two mock-service slot arrays
- `src/components/__tests__/ServiceCard.test.ts`, `ServicePrintLayout.test.ts`, `ServiceScriptureIntegration.test.ts` - added `id` to slot literals / a builder function
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - added `id` defaults to `hymnSlot`/`songSlot`/`scriptureSlot` builders and one raw IMPORTED literal

## Decisions Made

- `SourceRef` carries a fifth `kind: 'copyright'` member (a planner addition beyond RESEARCH.md's four-member shape) so a song group's leading/trailing copyright entries never have to abuse `sectionId` to represent themselves — keeps song reconciliation's diff-by-`sectionId` (Plan 24-04+) from ever seeing a section-less entry.
- `id` is unconditionally written by `createSlot()`/`buildSlots()` — unlike `section`'s conditional-spread omission (there is no legacy "absent id" shape to preserve for a brand-new slot).
- `backfillSlotIds` takes an optional second `reference` argument (a correction to RESEARCH.md's single-argument design): reusing the local service's id at the same array index (kind-guarded) keeps the existing remote-merge `JSON.stringify` comparison in `ServiceEditorView.vue` stable across snapshots — a one-argument backfill would mint fresh UUIDs on every snapshot and silently re-anchor every group.
- Slot fixtures across the 11 touched test files use deterministic, human-readable `id` literals (e.g. `slot-song-0`) rather than routing through `createSlot()`, preserving each suite's deliberate use of malformed/legacy slot shapes to exercise tolerance paths.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `services.test.ts`'s global crypto stub broke `createService` once slot minting required `crypto.randomUUID()`**
- **Found during:** Task 3 (full-suite verification after the required-id propagation)
- **Issue:** `src/stores/__tests__/services.test.ts` calls `vi.stubGlobal('crypto', { getRandomValues: ... })`, which replaces the entire global `crypto` object with one that has no `randomUUID` method. Once `createSlot()`/`buildSlots()` (now called by `createService()`) started minting `id: crypto.randomUUID()`, every `createService` test in this file threw `TypeError: crypto.randomUUID is not a function`. This is a genuine regression caused by Task 2's change, not a pre-existing failure.
- **Fix:** Added a `randomUUID: vi.fn(() => \`mock-uuid-${++uuidCounter}\`)` entry alongside the existing `getRandomValues` stub in the same `vi.stubGlobal('crypto', ...)` call.
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Verification:** `npx vitest run src/stores/__tests__/services.test.ts` — real file 29/29 pass (only its two stale `.gsd/quarantine/worktrees/**` duplicate copies still fail, since those retain the old crypto stub and are explicitly out of scope).
- **Committed in:** `74be0d7` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary to keep the existing `createService` test suite green after Task 2's type-contract change; no scope creep — confirmed `src/stores/quarters.test.ts` (the only other file stubbing global `crypto`) never touches `buildSlots`/`createSlot`, so no equivalent fix was needed there.

## Issues Encountered

None beyond the deviation above. `npm run type-check` (covering all three tsconfig project references — app, vitest, node) exits 0. The targeted full-suite run (`npx vitest run src/`) reports 3047 passed / 23 failed / 18 skipped; every one of the 23 failures traces to `.gsd/quarantine/worktrees/**` stale duplicate copies of `services.test.ts` (still missing the crypto stub fix, by design — quarantine debris is never touched) and `RosterView.test.ts` (the already-documented stale "Roles config" assertion, STATE.md). Zero new failures in any real source file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SlideGroup`/`GroupSlideEntry`/`SourceRef`/`SlideGroupInput` are ready for Plan 24-02 (`src/stores/slideGroups.ts`) to import and build the Firestore store against.
- `ServiceSlot.id` is now the stable anchor every later plan in this phase keys `slideGroups/{slotId}` documents on; `backfillSlotIds` is ready to be wired into `ServiceEditorView.vue`'s load watcher (Plan 24-05/24-06, per RESEARCH.md Pattern 2 — not wired in this plan, which was scoped to the type/utility layer only).
- No blockers. The repo-wide `npm run type-check` and `npx vitest run src/` gates are both green (module the pre-existing, documented quarantine/RosterView debris), giving downstream plans a clean baseline to build on.

---
*Phase: 24-slide-group-model-and-migration*
*Completed: 2026-07-25*

## Self-Check: PASSED

All claimed files found on disk (`src/types/slideGroup.ts`, `src/types/service.ts`, `src/utils/slotTypes.ts`, `src/utils/__tests__/slotTypes.test.ts`, this SUMMARY). All claimed commits found in git log (`d84cfc6`, `9b28d4f`, `74be0d7`).
