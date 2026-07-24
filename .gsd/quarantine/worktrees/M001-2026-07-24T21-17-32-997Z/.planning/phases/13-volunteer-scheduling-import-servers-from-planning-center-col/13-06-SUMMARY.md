---
phase: 13-volunteer-scheduling-import-servers-from-planning-center-col
plan: 06
subsystem: database
tags: [pinia, firestore, dot-path-update, tdd, vitest, scheduler-bridge, share-token]

# Dependency graph
requires:
  - phase: 13-01
    provides: "src/types/roster.ts type contract (Quarter, RoleSlotConfig, PersonQuarterData, ProposeResult); src/utils/quarterDates.ts (generateSundaysInQuarter, applyDateAdditionsRemovals)"
  - phase: 13-02
    provides: "src/utils/scheduler.ts proposeQuarterSchedule pure function"
  - phase: 13-05
    provides: "src/stores/roster.ts useRosterStore (activePeople, roles, people, updatePerson)"
provides:
  - "useQuartersStore — quarter lifecycle (create/dates/role-overrides), per-person CSV apply (D-19), propose→persist bridge (regenerate/fillGaps), scoped per-cell grid edits (D-22), finalize + public share token (D-24, no PC push per D-21)"
affects: ["13-08 (roster/CSV import UI)", "13-09 (schedule grid UI)", "13-10 (share/print view)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Firestore dot-path field updates (`calendar.${date}.${roleId}`) for scoped nested-map cell edits that never disturb sibling cells"
    - "Store-level bridge pattern: pure util (proposeQuarterSchedule) injected with store-read inputs, result persisted via updateDoc — same shape as scheduler.ts's own injectable design"
    - "Bidirectional relationship merge on a per-person replace map: partner ids not present in the incoming batch still get their reciprocal field merged (not replaced) into an existing-or-fresh entry"

key-files:
  created:
    - src/stores/quarters.ts
    - src/stores/__tests__/quarters.test.ts
  modified: []

key-decisions:
  - "Cell edits (assignPerson/clearAssignment/swapAssignment) use Firestore dot-path field keys directly in updateDoc rather than read-modify-write of the whole calendar object, so concurrent edits to different cells never clobber each other and match the plan's 'scoped updateDoc' requirement literally"
  - "Bidirectional pairing merge in applyCsvToQuarter only ever adds the reciprocal id to a partner's pairedWith array (creating a fresh empty-blackout entry if the partner has none yet) — it never touches blackoutDates for a partner absent from the CSV rows, preserving D-19's 'absent people untouched' guarantee for every field except pairedWith"
  - "generateProposal reads roles from useRosterStore().roles (not a passed parameter) to build buildResolveRolesForDate, matching the roster store's existing subscribe-then-read convention used throughout the app"

patterns-established:
  - "Pure-scheduler bridge pattern: quarters.ts calls proposeQuarterSchedule with store-derived arguments and persists only the returned calendar, keeping the deterministic algorithm itself untouched by store/Firestore concerns"

requirements-completed: [D-01, D-02, D-18, D-19, D-21, D-22, D-24]

# Metrics
duration: 12min
completed: 2026-07-07
---

# Phase 13 Plan 06: Quarters Store (Lifecycle, CSV Apply, Scheduler Bridge, Cell Edits, Share) Summary

**`useQuartersStore` orchestrates the full quarter lifecycle — Sunday generation, per-person CSV replace (D-19), a propose→persist bridge to the pure scheduler in both regenerate and fill-gaps modes, Firestore dot-path scoped grid-cell edits (D-22), and a crypto-random public share token with a name-resolved denormalized snapshot (D-24) — with zero Planning Center writes (D-21).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-07T21:33:00Z (approx)
- **Completed:** 2026-07-07T21:45:00Z (approx)
- **Tasks:** 3 completed (each as a TDD RED→GREEN pair)
- **Files modified:** 2 (both created)

## Accomplishments
- `useQuartersStore` streams `organizations/{orgId}/quarters` (orderBy createdAt desc); `createQuarter` writes serviceDates via `generateSundaysInQuarter` with every quarter-scoped map (`roleOverridesByDate`, `personQuarterData`, `calendar`) starting empty and `status: 'draft'` (D-01)
- `addServiceDate`/`removeServiceDate` delegate to `applyDateAdditionsRemovals` for sorted, de-duplicated one-off date changes; `setRoleOverrideForDate` merges into `roleOverridesByDate` without touching other dates (D-02)
- `applyCsvToQuarter` replaces ONLY the CSV-present people's `personQuarterData` entries wholesale, upserts their standing fields through `useRosterStore().updatePerson`, and applies `serveWith` pairings bidirectionally — a partner absent from the CSV batch still receives the reciprocal `pairedWith` entry while every other field of their (or an absent third person's) entry stays untouched (D-19, D-18/Pitfall 3)
- `buildResolveRolesForDate` returns the per-date override when present, else a `role.order`-sorted default template built from the live roster's role list
- `generateProposal('regenerate' | 'fillGaps')` bridges to `proposeQuarterSchedule`, passing `existingCalendar: undefined` for regenerate and the quarter's current `calendar` for fillGaps, then persists only the returned calendar
- `assignPerson`/`clearAssignment`/`swapAssignment` write Firestore dot-path fields (`calendar.{date}.{roleId}`) so each edit touches exactly one cell (D-22)
- `finalizeAndShare` generates an 18-byte `crypto.getRandomValues` hex token (36 chars, same generator as `services.ts`), writes `shareTokens/{token}` with a `quarterSnapshot` that resolves person ids to NAMES only (no emails/phones/blackouts — T-13-06-02), sets the quarter to `status: 'finalized'` with the token, and performs zero Planning Center writes (D-21, D-24)

## Task Commits

Each task was committed atomically via the TDD RED→GREEN cycle:

1. **Task 1: Quarter lifecycle — create/dates/role-overrides**
   - `8646272` (test, RED — module `../quarters` did not exist)
   - `2101ef7` (feat, GREEN — 9/9 lifecycle tests passing)
2. **Task 2: CSV apply (per-person replace) + propose→persist + cell edits**
   - `1ad2b2d` (test, RED — 9 new tests failing on missing functions)
   - `db7e74c` (feat, GREEN — 18/18 tests passing)
3. **Task 3: Finalize + public share token (no PC push)**
   - `fbbd281` (test, RED — 3 new tests failing on missing `finalizeAndShare`)
   - `5c0a662` (feat, GREEN — 22/22 tests passing)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/stores/quarters.ts` - `useQuartersStore`: subscribe/unsubscribeAll, createQuarter, addServiceDate/removeServiceDate, setRoleOverrideForDate, applyCsvToQuarter, buildResolveRolesForDate, generateProposal, assignPerson/clearAssignment/swapAssignment, finalizeAndShare; exports `ResolvedCsvPerson` input type
- `src/stores/__tests__/quarters.test.ts` - 22-test suite (Firestore mock pattern mirroring `roster.test.ts`, plus a mocked `@/utils/scheduler` and `@/stores/roster` for isolating the bridge/upsert call-argument assertions) covering lifecycle, per-person replace + bidirectional pairing, override resolution, propose bridge (regenerate vs fillGaps), scoped cell edits, and the share-token flow including a source-scan for zero Planning Center write calls

## Decisions Made
- Cell edits use Firestore dot-path keys (`calendar.${date}.${roleId}`) directly in the `updateDoc` payload instead of a read-modify-write of the entire `calendar` map — this is both more literally "scoped" per the plan's acceptance criteria and safer under concurrent edits to different cells
- The bidirectional pairing merge in `applyCsvToQuarter` creates a fresh `{ personId, blackoutDates: [], pairedWith: [] }` entry for a partner with no prior `personQuarterData` record, then adds the reciprocal id — this only ever adds to `pairedWith`, never overwrites a partner's existing blackout dates, keeping D-19's "absent people untouched" guarantee intact for every field except the pairing itself
- `generateProposal` reads `roles` from `useRosterStore()` rather than accepting it as a parameter, matching the interfaces-block signature (`generateProposal(quarterId, mode)`) and the store's existing subscribe-then-read convention

## Deviations from Plan

None — plan executed exactly as written. One small in-scope test-infrastructure fix was needed:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a Windows-incompatible file URL in the D-21 source-scan test**
- **Found during:** Task 3 (writing the "never calls Planning Center write functions" test)
- **Issue:** `fs.readFileSync(new URL('../quarters.ts', import.meta.url), 'utf-8')` threw `TypeError: The URL must be of scheme file` on this Windows/Vitest environment because `import.meta.url` resolution combined with a relative `URL` constructor produced a path that Node's `fs` URL handling rejected on this platform/Vitest version combination.
- **Fix:** Replaced with `path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '../quarters.ts')` to normalize the Windows drive-letter path before passing a plain string to `readFileSync`.
- **Files modified:** `src/stores/__tests__/quarters.test.ts`
- **Verification:** Test passes standalone and as part of the full 22-test suite; grep-based acceptance criteria (`grep -c "planningCenterApi\|addTeamToPlan\|createPlan\|createItem" src/stores/quarters.ts == 0`) independently confirms the same zero-count result.
- **Committed in:** `fbbd281` (Task 3 RED commit — the fix was applied before the file was first run, so it's folded into the same commit as the rest of the test additions)

---

**Total deviations:** 1 auto-fixed (1 blocking test-environment fix, no production-code or scope impact)
**Impact on plan:** No scope creep — this was a test-file portability fix required to make the plan's own D-21 acceptance criterion executable on this platform.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `useQuartersStore` is ready for Plan 08 (roster/CSV import UI) to call `applyCsvToQuarter` with UI-resolved `ResolvedCsvPerson[]` rows, and for Plan 09 (schedule grid UI) to call `generateProposal`, `assignPerson`/`clearAssignment`/`swapAssignment`, and render `unfilled`/`pairingConflicts` from the returned `ProposeResult`
- Plan 10 (share/print view) can read `shareTokens/{token}` directly — the `quarterSnapshot` is fully self-contained (label, serviceDates, roles, calendar with names) and requires no roster store access
- No blockers — `npx vue-tsc --build` clean; `npx vitest run src/stores/__tests__/quarters.test.ts` 22/22 green; full related-suite run (quarters + roster + scheduler + quarterDates) 66/66 green with no regressions

---
*Phase: 13-volunteer-scheduling-import-servers-from-planning-center-col*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: src/stores/quarters.ts
- FOUND: src/stores/__tests__/quarters.test.ts
- FOUND commit: 8646272 (test, Task 1 RED)
- FOUND commit: 2101ef7 (feat, Task 1 GREEN)
- FOUND commit: 1ad2b2d (test, Task 2 RED)
- FOUND commit: db7e74c (feat, Task 2 GREEN)
- FOUND commit: fbbd281 (test, Task 3 RED)
- FOUND commit: 5c0a662 (feat, Task 3 GREEN)
