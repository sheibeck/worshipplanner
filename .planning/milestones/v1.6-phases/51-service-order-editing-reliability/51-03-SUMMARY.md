---
phase: 51-service-order-editing-reliability
plan: 03
subsystem: database
tags: [firestore, pinia, services-store, stripUndefined, updateDoc]

# Dependency graph
requires:
  - phase: 41-share-links
    provides: maybeRefreshShareLink hook on updateService (preserved unchanged)
  - phase: 51-01/51-02
    provides: R110 section editing plumbing (onSectionChange) that produces section: undefined on a No Section move
provides:
  - "updateService write funnel is undefined-safe: raw undefined is stripped before every Firestore updateDoc"
  - "Moving a service item back to No Section via the dropdown saves without a Firestore 'Unsupported field value: undefined' error"
affects: [service-order-editing, live-plan-autosave, drag-reorder, song-assign-clear]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strip undefined at the single store write funnel (updateService), add FieldValue sentinels (serverTimestamp) AFTER stripping"

key-files:
  created: []
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "Fix at the updateService funnel (not per-call-site) so all live-plan write paths become undefined-safe at once"
  - "Omit the section key (not deleteField) — the whole slots array is replaced each write, so omission reads back as No Section; deleteField cannot target an array element"
  - "assertWritable runs on ORIGINAL data before stripping; serverTimestamp added after stripUndefined per the helper contract"

patterns-established:
  - "Pattern: sanitize plain payload with stripUndefined() then append FieldValue sentinels — never strip a payload that already contains serverTimestamp()"

requirements-completed: [R111]

coverage:
  - id: D1
    description: "updateService strips raw undefined from the slots payload when an item is moved to No Section (the moved slot's section key is absent; no value in the written payload is strictly undefined)"
    requirement: "R111"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#R111: strips raw undefined from the slots payload when an item is moved to \"No Section\""
        status: pass
    human_judgment: false
  - id: D2
    description: "assertWritable draft-lock and maybeRefreshShareLink behavior preserved; null/''/0/false and serverTimestamp() survive stripping"
    requirement: "R111"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#draft-only write guard (R036) + updateService refreshes the payload (R077)"
        status: pass
    human_judgment: false
  - id: D3
    description: "In the running app, moving an item to No Section via the dropdown in a live plan autosaves with no error toast and no page refresh"
    requirement: "R111"
    verification: []
    human_judgment: true
    rationale: "Live-app dropdown interaction + autosave + absence of an error toast is a visual/functional behavior the unit suite cannot exercise; deferred to /gsd-verify-work."

# Metrics
duration: ~15min
completed: 2026-08-11
status: complete
---

# Phase 51 Plan 03: Fix R111 — No Section save error Summary

**`updateService` now runs its payload through `stripUndefined` before `updateDoc`, so moving a service item back to "No Section" (which sets `slot.section = undefined`) saves cleanly instead of throwing Firestore's "Unsupported field value: undefined".**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-11T15:06Z
- **Completed:** 2026-08-11T15:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Repro-test-first: committed a RED store test proving `updateService` forwarded raw `section: undefined` into the captured `updateDoc` payload, then made it GREEN.
- Fixed R111 at the single `updateService` funnel by spreading `...stripUndefined(data)` and appending `updatedAt: serverTimestamp()` after the strip — covering autosave `onSave`, direct drag-reorder writes, and song assign/clear in one change.
- Preserved the draft-lock contract (`assertWritable` still runs on the original data before stripping) and the Phase 41 `maybeRefreshShareLink` call.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED repro (updateService forwards no raw undefined)** - `fea6c1a` (test)
2. **Task 2: GREEN — apply stripUndefined in the updateService funnel** - `42ff9f9` (fix)

## Files Created/Modified
- `src/stores/services.ts` - Imported `stripUndefined`; `updateService` now writes `{ ...stripUndefined(data), updatedAt: serverTimestamp() }`. `assertWritable(id, data)` and `maybeRefreshShareLink(id, data)` unchanged.
- `src/stores/__tests__/services.test.ts` - Added the R111 test asserting the written `updateDoc` payload has no `section` key on the moved slot and no value strictly equal to `undefined` anywhere.

## Decisions Made
- Fixed at the store funnel rather than per call-site so every live-plan write path is undefined-safe at once (autosave, drag write, song assign/clear all funnel through `updateService`; role-override paths call `updateDoc` directly and are intentionally unaffected).
- Omit the `section` key instead of using `deleteField()` — the whole `slots` array is replaced each write, so omission reads back as "No Section", and `deleteField()` cannot target an array element.
- `serverTimestamp()` is a FieldValue sentinel, so it is added AFTER `stripUndefined` per the helper's documented contract.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Verification followed the CLAUDE.md gates.

## Verification

- `npx vitest run src/stores/__tests__/services.test.ts` — 82/82 pass (the RED repro is now GREEN; draft-lock and share-refresh tests intact).
- `npm run type-check` (`vue-tsc --build`) — clean.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — 2992 pass; the only 2 failing files are the documented baseline (`src/storage.rules.test.ts` — Storage-emulator cross-service limitation; `src/views/__tests__/RosterView.test.ts` — stale assertion). No regression introduced.
- Manual dropdown/autosave confirmation in the running app deferred to `/gsd-verify-work` (coverage D3).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R111 closed. Plan 51-04 (remaining phase work) is unblocked.

## Self-Check: PASSED
- FOUND: src/stores/services.ts (modified, committed 42ff9f9)
- FOUND: src/stores/__tests__/services.test.ts (modified, committed fea6c1a)
- FOUND: commit fea6c1a (RED)
- FOUND: commit 42ff9f9 (GREEN)

---
*Phase: 51-service-order-editing-reliability*
*Completed: 2026-08-11*
