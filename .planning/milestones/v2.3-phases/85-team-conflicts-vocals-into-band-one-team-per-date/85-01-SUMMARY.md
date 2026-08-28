---
phase: 85-team-conflicts-vocals-into-band-one-team-per-date
plan: 01
subsystem: scheduling
tags: [vue3, pinia, typescript, firestore, scheduler]

# Dependency graph
requires:
  - phase: 15-volunteer-role-scheduling
    provides: the original evaluateGroupCombo/isGroupCompatible/proposeQuarterSchedule group-combo rule this plan rewrites
provides:
  - Narrowed RoleGroup union ('band' | 'tech' | 'other') with a Role.vocal flag replacing the standalone 'vocals' team identity
  - Rewritten evaluateGroupCombo/isGroupCompatible/proposeQuarterSchedule group-combo rule (Band<->Tech mutually exclusive, Other combines freely, ≤1 Band instrument with Vocals exempt)
  - Read-time-only compat shim in roster.ts coercing legacy group:'vocals' docs to band+vocal (no Firestore write migration)
  - buildIsVocal projection in quarters.ts wired into proposeQuarterSchedule in production
  - RolesConfigPanel.vue UI: no standalone Vocals group option; "Vocal role (can sing & play)" checkbox under Band
affects: [86-recurring-team-scheduling, 87-song-and-rotation-refinements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared pure rule (evaluateGroupCombo) threaded through every role-selection path (main loop, propagatePairing, QuarterGrid warn badge) via roleGroupOf + isVocal predicates"
    - "Read-time-only compat shim at the Firestore onSnapshot boundary — legacy data coerced on read, never re-written, keeping downstream consumers ignorant of the historical shape"

key-files:
  created: []
  modified:
    - src/types/roster.ts
    - src/utils/scheduler.ts
    - src/utils/__tests__/scheduler.test.ts
    - src/stores/roster.ts
    - src/stores/quarters.ts
    - src/components/QuarterGrid.vue
    - src/components/RolesConfigPanel.vue
    - src/views/RosterView.vue
    - src/components/AvailabilityRosterTable.vue
    - src/utils/messagingRecipients.ts
    - src/stores/__tests__/roster.test.ts
    - src/components/__tests__/QuarterGrid.test.ts
    - src/components/__tests__/RolesConfigPanel.test.ts
    - src/utils/__tests__/messagingRecipients.test.ts
    - src/utils/__tests__/serviceLockDiff.test.ts
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/views/__tests__/RosterView.test.ts
    - src/components/__tests__/AvailabilityDrawer.test.ts
    - src/components/__tests__/ReLockNotifyPrompt.test.ts
    - src/components/__tests__/MessageComposer.test.ts

key-decisions:
  - "Vocals folds into Band for exclusivity purposes but is exempt from the one-Band-instrument cap — 'sing and play' is legal, two instruments is not"
  - "Other now combines freely with Band or Tech (relaxes the old TECH-exclusive-of-all rule) — only Band<->Tech is mutually exclusive"
  - "Legacy group:'vocals' docs are coerced band+vocal at read time only; no Firestore write migration in this phase"
  - "ReLockNotifyPrompt.test.ts's zero-reachable fixture uses 'other' (not a literal 'band' swap) to preserve the original zero-reachable test intent, since the shared roles/roleAssignmentOverrides fixture already assigns someone to 'band'"

requirements-completed: [R250, R251, R252]

coverage:
  - id: D1
    description: "Vocals is modeled as a Band role with a vocal flag — RoleGroup has no 'vocals' member, DEFAULT_ROLES vocals entry is band+vocal, legacy stored 'vocals' roles read back as band+vocal with no Firestore write"
    requirement: "R250"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/roster.test.ts#read-time vocals compat shim (R250 — no write migration)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#group Band<->Tech exclusivity via vocals"
        status: pass
    human_judgment: false
  - id: D2
    description: "The auto-scheduler hard-blocks placing one person on a Band role and a Tech role on the same date; the manual grid warns (does not block) on the same combo"
    requirement: "R251"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#group Band<->Tech exclusivity (and vice versa)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/QuarterGrid.test.ts#shows a group conflict marker on both cells when the same person holds a TECH role and a BAND role"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vocals is the sole multi-person exception, and a person may hold one Band instrument plus Vocals (sing and play) without tripping the rule; two instruments is still blocked"
    requirement: "R252"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#group vocals multi-person / group allowed combo: 1 Band instrument + Vocals"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#group cardinality: two Band instrument roles blocked"
        status: pass
    human_judgment: false
  - id: D4
    description: "Other combines freely with Band or Tech (relaxed rule) — Roles UI has no standalone Vocals group option, offers a Band-only vocal checkbox instead"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/scheduler.test.ts#group relaxation: TECH + OTHER / BAND + OTHER allowed"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/RolesConfigPanel.test.ts#R250: the group select has no standalone Vocals option"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-26
status: complete
---

# Phase 85 Plan 01: Team Conflicts — Vocals into Band & One-Team-Per-Date Summary

**Narrowed RoleGroup to band/tech/other, rewrote the shared evaluateGroupCombo rule (Band<->Tech exclusive, Other combines freely, ≤1 Band instrument with Vocals exempt), and added a read-time-only compat shim for legacy vocals data.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-26T20:10:27Z
- **Completed:** 2026-08-26T20:40:03Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments
- `RoleGroup` narrowed to `'band' | 'tech' | 'other'`; `Role.vocal?: boolean` added; `DEFAULT_ROLES` vocals entry is now `group: 'band', vocal: true`
- Rewrote `evaluateGroupCombo`/`isGroupCompatible`/`proposeQuarterSchedule` in `scheduler.ts` to accept an `isVocal` predicate: Band and Tech are mutually exclusive, Other combines freely with either, and at most one non-vocal Band role (instrument) is allowed per person per date — Vocals is exempt
- `roster.ts` no longer writes the reverse `band -> vocals` migration; a pure read-time shim coerces any legacy `group: 'vocals'` doc to `{ group: 'band', vocal: true }` on every snapshot, with zero Firestore writes
- `quarters.ts` gained `buildIsVocal`, wired into `proposeQuarterSchedule` in production alongside the existing `buildRoleGroupOf`
- `QuarterGrid.vue`'s warn badge and `RolesConfigPanel.vue`'s Roles UI both dropped the standalone Vocals group; the panel now offers a "Vocal role (can sing & play)" checkbox under Band
- Migrated every `group: 'vocals'` test fixture across the codebase (9 test files) to the new band+vocal shape, plus one downstream regression (`MessageComposer.test.ts`, not in the plan's file list) surfaced by the full `npx vitest run` gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Model change + rewrite the shared group-combo rule + scheduler unit tests** - `e92bbf46` (feat)
2. **Task 2: Compat shim, projection wiring, and remove 'vocals' from every consumer map + UI** - `4dc6a026` (feat)
3. **Task 3: Migrate every group:'vocals' test fixture; add shim/warn/removed-option tests; full gate** - `4545f63c` (test)

**Plan metadata:** (this commit, docs: complete plan — see final commit below)

## Files Created/Modified
- `src/types/roster.ts` - Narrowed `RoleGroup`; added `Role.vocal`; DEFAULT_ROLES vocals is band+vocal
- `src/utils/scheduler.ts` - Rewrote the group-combo rule with the `isVocal` predicate threaded through all three consumers
- `src/utils/__tests__/scheduler.test.ts` - New `makeIsVocal` helper; migrated + added group-combo test cases
- `src/stores/roster.ts` - Removed the reverse write migration; added the read-time compat shim
- `src/stores/quarters.ts` - Added and wired `buildIsVocal`
- `src/components/QuarterGrid.vue` - Dropped 'vocals' from maps; threaded `isVocal` into the warn badge
- `src/components/RolesConfigPanel.vue` - Removed the Vocals group option; added the vocal checkbox
- `src/views/RosterView.vue`, `src/components/AvailabilityRosterTable.vue`, `src/utils/messagingRecipients.ts` - Dropped dead `'vocals'` RoleGroup map entries
- 9 test files - Migrated `group: 'vocals'` fixtures to `group: 'band', vocal: true` (or, for `MessageComposer.test.ts`, dropped the now-nonexistent vocals team-chip assertions)

## Decisions Made
- Vocals folds into Band for exclusivity but stays exempt from the one-instrument cap (owner-locked semantics)
- Other now combines freely with Band or Tech — the deliberate relaxation of the old TECH-exclusive-of-everything rule
- No Firestore write migration for legacy `group: 'vocals'` data — coerced at read time only, matching the CONTEXT.md decision
- `ReLockNotifyPrompt.test.ts`'s zero-reachable fixture was pointed at `'other'` rather than a literal `'vocals'->'band'` swap, since the file's shared `roles`/`roleAssignmentOverrides` fixtures already assign someone to `'band'` — a literal swap would have silently changed the test's reachable count from 0 to 1 and broken three downstream assertions that specifically exercise the zero-reachable path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `id` property order bug in the roster.ts read-time compat shim**
- **Found during:** Task 2 verification (`npm run type-check`)
- **Issue:** The first draft of the shim wrote `{ id: d.id, ...data }`, which TypeScript flagged (`TS2783`) because the later spread of `data` (typed as `Role`, which includes `id`) silently overwrote the explicit `id: d.id`.
- **Fix:** Reordered to `{ ...data, id: d.id }` so the doc id always wins.
- **Files modified:** `src/stores/roster.ts`
- **Verification:** `npm run type-check` clean
- **Committed in:** `4dc6a026` (Task 2 commit)

**2. [Rule 1 - Bug] `MessageComposer.test.ts` — downstream regression from the RoleGroup narrowing (not in the plan's file list)**
- **Found during:** Task 3's full-gate `npx vitest run` (the plan's own files list did not enumerate this file)
- **Issue:** `MessageComposer.vue` derives its team chips dynamically from `Object.keys(MESSAGING_TEAM_LABELS)`, so dropping `'vocals'` from that map (a Task 2 change) correctly removed the vocals chip in production — but `MessageComposer.test.ts` still asserted `team-chip-vocals` exists and reaches 0 people, which is now nonsensical (there is no vocals chip to reach anyone).
- **Fix:** Updated the two affected assertions to expect exactly three team chips (Band/Tech/Other) and removed the vocals-specific per-chip-count assertion. No component code changed — `MessageComposer.vue` was already correct by construction.
- **Files modified:** `src/components/__tests__/MessageComposer.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/MessageComposer.test.ts` — 29/29 pass; full-suite re-run confirms no new failures
- **Committed in:** `4545f63c` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes were necessary for correctness (a type error and a genuinely broken test assertion). No scope creep — the second fix is exactly the "fix EVERY straggler" instruction in this plan's execution context, applied to a file the plan's own enumeration missed.

## Issues Encountered
- The full `npx vitest run` (593s, 149 files) surfaced the `MessageComposer.test.ts` straggler described above; the scoped per-file type-check and targeted test runs during Task 2/3 did not catch it because it is a runtime assertion failure, not a type error.

## User Setup Required
None - no external service configuration required. All changes are client-only (Vue + local Firestore reads); no rules/functions/deploy involved.

## Next Phase Readiness
- Phase 86 (Recurring Team Scheduling) and Phase 87 (Song & Rotation Refinements) both build on the roster/roles surfaces this plan touched (`RolesConfigPanel.vue`, `RoleGroup`) — no blockers; the narrowed union and vocal flag are stable, tested, and match the CONTEXT.md-locked semantics.
- Full gate confirmed green: `npm run type-check` clean, `npx vitest run` shows no failures beyond the documented 2-file baseline (`src/storage.rules.test.ts` — Storage emulator limitation, `src/views/__tests__/RosterView.test.ts` — pre-existing stale "Roles config" CollapsibleSection assertion, unrelated to this phase).

---
*Phase: 85-team-conflicts-vocals-into-band-one-team-per-date*
*Completed: 2026-08-26*

## Self-Check: PASSED

All 20 files listed in Files Created/Modified verified present on disk; all 3 task commit hashes
(`e92bbf46`, `4dc6a026`, `4545f63c`) verified present in `git log`.
