---
phase: 64-composer-refinements
plan: 01
subsystem: messaging
tags: [messaging, labels, roles, composer, relock, vitest]

# Dependency graph
requires:
  - phase: 58-messaging-foundation
    provides: MESSAGING_TEAM_LABELS constant and resolveRecipients (the messaging label remap this plan retires)
provides:
  - MESSAGING_TEAM_LABELS now reads the raw RoleGroup names (Band/Vocals/Tech/Other), mirroring Volunteer Roles
  - Composer Send-To team chips and ReLockNotifyPrompt team tags re-label automatically from the single constant
affects: [64-03, messaging, composer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MESSAGING_TEAM_LABELS stays its own independent literal — groupLabels is deliberately NOT imported (two UIs may describe the same enum with copied-verbatim strings, not a shared import)"

key-files:
  created: []
  modified:
    - src/utils/messagingRecipients.ts
    - src/utils/__tests__/messagingRecipients.test.ts
    - src/components/__tests__/MessageComposer.test.ts
    - src/components/__tests__/ReLockNotifyPrompt.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Landed the constant change and its four dependent test-assertion updates in ONE commit so the app suite never goes red mid-change (R151, per plan objective)"
  - "Baked in the plan's CORRECTION vs 64-RESEARCH.md: ServiceEditorView.test.ts:1780 is a SERVICE SECTION header, not a messaging label — left untouched; only the vi.mock at :97 was updated"

patterns-established:
  - "Display-label remap edits propagate to all messaging surfaces via the single MESSAGING_TEAM_LABELS constant — no per-component markup change"

requirements-completed: [R151]

coverage:
  - id: D1
    description: "MESSAGING_TEAM_LABELS reads band:'Band', tech:'Tech', vocals:'Vocals', other:'Other' (raw RoleGroup names, replacing the v1.7 band->'Worship' / other->'Hosts' remap)"
    requirement: "R151"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#maps every RoleGroup to its own messaging-surface label, independent of RolesConfigPanel groupLabels"
        status: pass
    human_judgment: false
  - id: D2
    description: "Composer Send-To team chips re-label from the constant: band chip contains 'Band', other chip contains 'Other', band chip matches /Band·1/"
    requirement: "R151"
    verification:
      - kind: unit
        ref: "src/components/__tests__/MessageComposer.test.ts#per-team chips display their reachable count as \"{label} · {count}\""
        status: pass
    human_judgment: false
  - id: D3
    description: "ReLockNotifyPrompt band-derived team tags re-label to 'Band'; tech tag still 'Tech'"
    requirement: "R151"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ReLockNotifyPrompt.test.ts (change-row team-chip assertions)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Manual: composer Send-To chips and re-lock prompt team tags visually read Band / Vocals / Tech / Other in the running app"
    requirement: "R151"
    verification: []
    human_judgment: true
    rationale: "Visual/functional confirmation of the rendered labels in the live composer and re-lock prompt; deferred to owner at /gsd-verify-work 64 (verification_deferred_human)"

# Metrics
duration: 7min
completed: 2026-08-16
status: complete
---

# Phase 64 Plan 01: R151 Team Labels Summary

**Retired the v1.7 messaging label remap — MESSAGING_TEAM_LABELS now reads the raw RoleGroup names Band/Vocals/Tech/Other, so the composer Send-To chips and ReLockNotifyPrompt team tags mirror Volunteer Roles.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-16T01:23:18Z
- **Completed:** 2026-08-16T01:31:09Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Changed `MESSAGING_TEAM_LABELS` (`src/utils/messagingRecipients.ts:17-22`): `band:'Worship'->'Band'`, `other:'Hosts'->'Other'`; `tech`/`vocals` unchanged. The constant stays its own independent literal — `RolesConfigPanel`'s `groupLabels` was NOT imported (the four RHS strings were copied verbatim).
- Updated the four hard-coded old-label assertions this necessarily breaks, in the same commit, so both messaging surfaces re-label with zero markup change: `messagingRecipients.test.ts` object equals, `MessageComposer.test.ts` band/other chip text + `/Band·1/` regex, `ReLockNotifyPrompt.test.ts` change-row `Band` assertions, and the `ServiceEditorView.test.ts:97` `vi.mock` re-export.
- Left every unrelated 'Worship' string untouched — verified `ServiceEditorView.test.ts:1780` (the Pre-Service·Worship·Message·Sending·Post-Service section header), the drag-order comments, and the "Worship Song" Planning Center export title all remain.

## Task Commits

Each task was committed atomically:

1. **Task 1: Relabel MESSAGING_TEAM_LABELS to Band/Vocals/Tech/Other + update the four assertions it breaks (R151)** - `73cfc3da` (feat)

_Landed as a single commit (constant + its four dependent test edits together) per the plan objective so the app suite never goes red mid-change._

## Files Created/Modified
- `src/utils/messagingRecipients.ts` - `MESSAGING_TEAM_LABELS` values changed to Band/Vocals/Tech/Other; independence comment (:11-16) preserved
- `src/utils/__tests__/messagingRecipients.test.ts` - `toEqual` object updated to Band/Other
- `src/components/__tests__/MessageComposer.test.ts` - band/other chip `toContain` + `/Band·1/` regex + comment updated
- `src/components/__tests__/ReLockNotifyPrompt.test.ts` - change-row-0 / change-row-1 `Band` assertions + comments updated
- `src/views/__tests__/ServiceEditorView.test.ts` - `vi.mock` re-export literal (:97) updated; section-header assertion (:1780) intentionally left as-is

## Decisions Made
- Single commit for the constant + four test edits (plan objective: app suite never goes red mid-change).
- Baked in the plan's correction vs 64-RESEARCH.md: `ServiceEditorView.test.ts:1780` is a service-section header, not a messaging label — untouched; only the `:97` mock was updated.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification Results
- **Scoped gate:** `npx vitest run` over the four affected files — **4 files passed, 372 tests passed** (0 failed).
- **Type-check:** `npm run type-check` (`vue-tsc --build`) — **clean**, no errors (typechecks test files per CLAUDE.md).
- **Full app suite:** `npx vitest run` — **2 failed | 114 passed (116 files)**, matching exactly the documented 2-file known-failing baseline (`src/storage.rules.test.ts` — Storage-emulator cross-service limitation; `src/views/__tests__/RosterView.test.ts` — stale assertion). No NEW failing file introduced by this change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R151 (SC1) satisfied at the code/test level; the composer and re-lock team labels now mirror Volunteer Roles.
- Manual visual confirmation deferred to owner at `/gsd-verify-work 64` (recorded as human_judgment / verification_deferred_human, not marked passed here).
- 64-03 (Wave 2) may now safely add composer-behavior tests to `MessageComposer.test.ts` — this plan touched only the label assertions there.

## Self-Check: PASSED
- `src/utils/messagingRecipients.ts` MESSAGING_TEAM_LABELS reads Band/Tech/Vocals/Other — CONFIRMED
- Commit `73cfc3da` present in git log — CONFIRMED
- No `Worship`/`Hosts` strings remain in the three edited component/util test files; `ServiceEditorView.test.ts:1780` section header untouched — CONFIRMED

---
*Phase: 64-composer-refinements*
*Completed: 2026-08-16*
