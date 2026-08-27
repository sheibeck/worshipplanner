---
phase: 87-song-rotation-refinements
plan: 01
subsystem: ui
tags: [vue, vitest, songs, scripture-rotation, roles-config]

requires:
  - phase: 86-recurring-team-scheduling
    provides: v2.3 phases 84-86 complete; this plan closes the last three v2.3 requirements
provides:
  - "Editable song Key input in SongSlideOver.vue bound to the primary/first arrangement"
  - "ScriptureRotationTable.vue sourced solely from SCRIPTURE slots (sermon passage excluded)"
  - "Verified-accurate schedulable-roles copy in RolesConfigPanel.vue, locked by a positive+negative test"
affects: []

tech-stack:
  added: []
  patterns:
    - "Writable computed with get/set targeting a resolved array element (primaryArrangementId ?? arrangements[0]) for in-place form edits that flow through an existing save path unchanged"

key-files:
  created:
    - src/components/__tests__/ScriptureRotationTable.test.ts
  modified:
    - src/components/SongSlideOver.vue
    - src/components/__tests__/SongSlideOver.test.ts
    - src/components/ScriptureRotationTable.vue
    - src/components/__tests__/RolesConfigPanel.test.ts

key-decisions:
  - "R249: resolved the target arrangement identically to onSave's own primaryArrangementId ?? arrangements[0] fallback, so no change to onSave was needed — writing into the resolved arrangement object in place is enough."
  - "R256: verify-first per plan — grep found no straggler .vue surface with the deprecated soft-target phrasing, so RolesConfigPanel.vue was left unchanged; only the test was strengthened."

patterns-established:
  - "Verify-first requirement closure: when a plan's action is contingent on a grep gate result, run the gate before touching production code and record a no-op as the correct outcome."

requirements-completed: [R249, R253, R256]

coverage:
  - id: D1
    description: "Always-visible editable Key input in the song drawer, bound to the primary/first arrangement, persists on save; zero-arrangement edge mints a default arrangement instead of crashing"
    requirement: "R249"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#SongSlideOver — key (R249)"
        status: pass
      - kind: unit
        ref: "npm run type-check"
        status: pass
    human_judgment: false
  - id: D2
    description: "Scripture rotation table excludes the sermon passage; only SCRIPTURE slots feed rotationEntries; empty-state copy no longer mentions a sermon passage"
    requirement: "R253"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ScriptureRotationTable.test.ts#ScriptureRotationTable — sermon exclusion (R253)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No .vue UI surface uses the deprecated 'soft planning target' / 'not a hard cap' phrasing for the schedulable-roles default count; verified by grep gate and locked by a positive+negative test"
    requirement: "R256"
    verification:
      - kind: unit
        ref: "src/components/__tests__/RolesConfigPanel.test.ts#R256: the default-count copy is verified accurate and locked against soft-target framing regressing"
        status: pass
      - kind: other
        ref: "grep -rniE 'soft planning target|not a hard cap' src --include='*.vue' (NO-STRAGGLER)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-26
status: complete
---

# Phase 87 Plan 01: Song & Rotation Refinements Summary

**Editable song Key bound to the primary/first arrangement, Scripture rotation excluding the sermon passage, and verified-accurate schedulable-roles copy — closing R249, R253, R256.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-26 (see task commit timestamps)
- **Completed:** 2026-08-26
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added an always-visible editable "Key" text input in `SongSlideOver.vue`, backed by a writable `primaryArrangementKey` computed that resolves `primaryArrangementId ?? arrangements[0]` and edits that arrangement's key in place, persisting through the existing `updateSong`/`addSong` save path with no change to `onSave`. Zero-arrangement songs mint a default arrangement on first key edit rather than crashing.
- Removed the `service.sermonPassage` contribution from `ScriptureRotationTable.vue`'s `rotationEntries`, so only `SCRIPTURE` slots feed the rotation; dropped the now-unused `ScriptureRef` import; fixed the empty-state copy to no longer mention a sermon passage.
- Verified (via `grep -rniE 'soft planning target|not a hard cap' src --include='*.vue'`) that no `.vue` UI surface still uses the deprecated soft-target phrasing for the schedulable-roles default count — none found, so `RolesConfigPanel.vue` was left unchanged. Strengthened `RolesConfigPanel.test.ts` with an R256-scoped test asserting the exact accurate copy plus the existing negative assertions.

## Task Commits

Each task was committed atomically (Tasks 1 and 2 followed TDD RED → GREEN; Task 3 is verify-first, single commit):

1. **Task 1 (R249): Add editable song Key** - `38f27e11` (test — RED) → `5e0811dc` (feat — GREEN)
2. **Task 2 (R253): Exclude sermon passage from rotation** - `1e2cf73a` (test — RED) → `39d20d75` (feat — GREEN)
3. **Task 3 (R256): Verify schedulable-roles copy** - `5fc571bb` (test — verify-first, no production change)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/SongSlideOver.vue` - New always-visible "Key" input + `primaryArrangementKey` writable computed (get/set) targeting the resolved primary/first arrangement's key; existing "Primary key" select (which arrangement is primary) left unchanged.
- `src/components/__tests__/SongSlideOver.test.ts` - New "— key (R249)" describe block: single-arrangement edit, multi-arrangement primary edit, null-`primaryArrangementId` fallback to `arrangements[0]`, and the zero-arrangement mint-a-default-arrangement edge.
- `src/components/ScriptureRotationTable.vue` - Removed the sermon-passage contribution block from `rotationEntries`; dropped unused `ScriptureRef` import; corrected empty-state copy.
- `src/components/__tests__/ScriptureRotationTable.test.ts` - New file: sermon passage excluded while SCRIPTURE slots included; sermon-only service yields the empty state; shared SCRIPTURE passage across two services lists both dates (existing behavior preserved).
- `src/components/__tests__/RolesConfigPanel.test.ts` - New R256-scoped test locking the accurate "auto-fill … each service" copy alongside the existing negative assertions (kept, with their `planner-discipline-allow` markers intact).

## Decisions Made
- R249: resolved the edited arrangement using the exact same fallback logic (`primaryArrangementId ?? arrangements[0]`) that `onSave` already uses, so the new field required zero changes to the save path — only the computed's get/set logic.
- R256: followed the plan's verify-first instruction literally — ran the grep gate before touching any `.vue` file, found no straggler, and made no production change. Only the test file was strengthened, per acceptance criteria.

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their planned `<action>` and `<behavior>` specs; no auto-fixes, no architectural questions, no auth gates.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Client-only Vue changes; nothing to deploy beyond the normal frontend build.

## Next Phase Readiness
- All 10 v2.3 requirements (R247-R256) are now closed across phases 84-87.
- `npm run type-check` clean; all three targeted test files pass (33 tests); scoped multi-file run of the three targeted specs together also passes.
- Phase 87 was the last phase in the v2.3 milestone roadmap — next step is milestone completion/close-out, not a further phase.

---
*Phase: 87-song-rotation-refinements*
*Completed: 2026-08-26*
