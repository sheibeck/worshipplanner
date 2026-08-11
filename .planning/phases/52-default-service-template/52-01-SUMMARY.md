---
phase: 52-default-service-template
plan: 01
subsystem: services
tags: [vue, typescript, pinia, slot-template, firestore]

# Dependency graph
requires:
  - phase: 44-default-service-template (v1.5, archived)
    provides: buildSlotsFromTemplate / createSlot / progressionVwTypeSequence / ServiceTemplateEntry
  - phase: 43 (v1.5, archived)
    provides: NonAssignableSlot.body? field on MISC/ANNOUNCEMENTS/MESSAGE slots
provides:
  - "buildSuggestedTemplateEntries() — single shared 1-2-2-3-derived suggested-template preset (exported from slotTypes.ts)"
  - "ServiceTemplateEntry.body?: string — optional recurring body text on template entries"
  - "createSlot 4th optional body param, guarded-spread into MESSAGE/ANNOUNCEMENTS/MISC arms"
  - "buildSlotsFromTemplate threads entry.body through to createSlot (stays pure [] -> [])"
  - "createService seeds a new service from the Suggested Template when defaultServiceTemplate is empty (R115 reversal)"
affects: [52-02 (template editor button + MISC body textarea consumes buildSuggestedTemplateEntries and ServiceTemplateEntry.body), 52-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Effective-template resolution at the store call site (stored.length>0 ? stored : suggested) keeps the pure util pure"
    - "Guarded-spread optional field (...(body ? { body } : {})) preserves the absent-key legacy shape"
    - "One centralized preset helper shared by both the createService fallback and the editor's Suggested Template button — content can never fork"

key-files:
  created: []
  modified:
    - src/types/organization.ts
    - src/utils/slotTypes.ts
    - src/stores/services.ts
    - src/utils/__tests__/slotTypes.test.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "R115 empty->suggested fallback resolved at the createService call site, NOT inside buildSlotsFromTemplate — the util's []->[] purity contract (slotTypes.test.ts:798) stays green"
  - "body threaded via createSlot's 4th param with a ...(body ? {body} : {}) guarded spread so bodyless calls keep 'body' in slot === false (slotTypes.test.ts:643/656)"
  - "buildSuggestedTemplateEntries() derived from buildSlots('1-2-2-3') with fresh crypto.randomUUID ids per call — one definition, shared with plan 52-02's editor button"

patterns-established:
  - "Caller-decides fallback: the store resolves which template applies; the util is a pure transform"
  - "Optional-field guarded spread to preserve absent-key backward-compatible shape"

requirements-completed: [R115, R116]

coverage:
  - id: D1
    description: "Creating a new service with an empty/unset defaultServiceTemplate seeds 9 slots from the Suggested Template in the SONG/SCRIPTURE/SONG/PRAYER/SCRIPTURE/SONG/SONG/MESSAGE/SONG order (R115, supersedes v1.5 Phase 44 criterion #2)"
    requirement: "R115"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#an empty/unset defaultServiceTemplate produces a new service seeded from the Suggested Template (9 slots, 1-2-2-3-derived order)"
        status: pass
    human_judgment: false
  - id: D2
    description: "With Vertical Worship mode on, the suggested template's 5 SONG slots receive requiredVwType [1,2,2,3,3] at creation (R115 criterion 3)"
    requirement: "R115"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#empty template AND vwModeEnabled ON: the 5 suggested SONG slots receive requiredVwType [1,2,2,3,3] in order"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#buildSlotsFromTemplate(buildSuggestedTemplateEntries(), true) yields 5 SONG slots with requiredVwType [1,2,2,3,3]"
        status: pass
    human_judgment: false
  - id: D3
    description: "A non-empty stored template is still used verbatim (kind/section/order unchanged from v1.5)"
    requirement: "R115"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#a non-empty template produces slots matching kind/section/order exactly"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildSlotsFromTemplate([], true) still returns [] — the util stays pure; the fallback is the caller's decision (R115)"
    requirement: "R115"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#empty template → zero slots"
        status: pass
    human_judgment: false
  - id: D5
    description: "ServiceTemplateEntry gains optional body?: string; a template MISC entry carrying body text produces a service MISC slot with that body; a bodyless entry keeps the 'body' key absent (R116)"
    requirement: "R116"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#an entry { kind: MISC, body } threads body into the built slot"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#an entry { kind: MISC } with no body yields a slot where the body key is absent"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#createSlot(MISC) returns kind, a non-empty id, position 0, and omits body entirely"
        status: pass
    human_judgment: false
  - id: D6
    description: "createSlot('MISC'/'ANNOUNCEMENTS', ..., body) sets slot.body; bodyless calls omit the body key entirely (R116, existing shape preserved)"
    requirement: "R116"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#createSlot(MISC, undefined, undefined, body) sets slot.body to the passed text"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#createSlot(ANNOUNCEMENTS, undefined, undefined, body) sets slot.body to the passed text"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-08-11
status: complete
---

# Phase 52 Plan 01: Default Service Template — Core Data Path Summary

**Reversed the v1.5 empty-by-default creation path so every new service now seeds from a single shared `buildSuggestedTemplateEntries()` preset, and threaded an optional `ServiceTemplateEntry.body` through `buildSlotsFromTemplate` → `createSlot` while keeping the util pure.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-08-11T16:10:53Z
- **Completed:** 2026-08-11T16:24:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- R115: `createService` now resolves an effective template at the call site (`stored.length > 0 ? stored : buildSuggestedTemplateEntries()`), so an empty/unset `defaultServiceTemplate` produces a 9-slot Suggested-Template service (SONG/SCRIPTURE/SONG/PRAYER/SCRIPTURE/SONG/SONG/MESSAGE/SONG) instead of 0 slots — with VW types [1,2,2,3,3] applied to the 5 SONG slots when `vwModeEnabled`.
- R116: `ServiceTemplateEntry` gained `body?: string`, threaded through `buildSlotsFromTemplate` → a new 4th `body` param on `createSlot`, spread only into the MESSAGE/ANNOUNCEMENTS/MISC arms via `...(body ? { body } : {})`.
- Introduced the single shared `buildSuggestedTemplateEntries()` export (derived from `buildSlots('1-2-2-3')`, fresh ids per call) — the same preset plan 52-02's editor button will consume, so the suggested content can never fork into two copies.
- Preserved all three critical guards: `buildSlotsFromTemplate([], true) → []` purity (@798), bodyless-call absent-body shape (@643/@656), and `createSlot`'s exhaustive default-free `switch` (vue-tsc --build clean).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reverse and extend the unit tests (RED-first)** - `b9daf30` (test)
2. **Task 2: Add body to the type; add buildSuggestedTemplateEntries + thread body through slotTypes** - `e7effd2` (feat)
3. **Task 3: Resolve the effective template at createService (empty → suggested)** - `f484c88` (feat)

_Note: Task 1 is the RED commit for the two TDD tasks that follow it; Tasks 2–3 are the GREEN implementation commits._

## Files Created/Modified
- `src/types/organization.ts` - Added `ServiceTemplateEntry.body?: string`; reversed the stale empty-default JSDoc on `defaultServiceTemplate` to describe the R115 suggested fallback.
- `src/utils/slotTypes.ts` - Added `buildSuggestedTemplateEntries()`; added `createSlot` 4th `body` param with guarded spread into MESSAGE/ANNOUNCEMENTS/MISC; `buildSlotsFromTemplate` now passes `entry.body`; fixed the stale purity docstring parenthetical.
- `src/stores/services.ts` - `createService` resolves the effective template (empty → suggested) and imports `buildSuggestedTemplateEntries`; reversed the stale EMPTY-override comment block.
- `src/utils/__tests__/slotTypes.test.ts` - Added `buildSuggestedTemplateEntries` describe, `createSlot` body-param tests, and `buildSlotsFromTemplate` body-threading tests (purity @798 and omits-body @643/@656 left untouched).
- `src/stores/__tests__/services.test.ts` - Reversed the empty→0-slots test to empty→9 suggested slots; added an empty-template + VW-on test asserting SONG `requiredVwType` [1,2,2,3,3]; renamed the describe header.

## Decisions Made
None beyond what the plan specified — the plan's locked decisions (caller-decides fallback, guarded-spread body, one shared preset) were followed exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The full app-suite run finished with exactly the 2-file known-failing baseline (`src/storage.rules.test.ts` — Storage-emulator cross-service limitation, 12 failing this session with no emulator up; `src/views/__tests__/RosterView.test.ts` — stale assertion). This plan touches neither file; no regression was introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 52-02 can now import `buildSuggestedTemplateEntries()` for the "Suggested Template" button's `applyReset`, and bind the MISC body `<textarea>` against `ServiceTemplateEntry.body`.
- `createSlot`'s body-bearing set is MESSAGE/ANNOUNCEMENTS/MISC (mirrors the live editor); plan 52-02's UI need only expose MISC (and optionally ANNOUNCEMENTS) — the data path already supports all three.

## Self-Check: PASSED
- `src/types/organization.ts`, `src/utils/slotTypes.ts`, `src/stores/services.ts`, and both test files: modified and present.
- Commits `b9daf30`, `e7effd2`, `f484c88`: present in git log.

---
*Phase: 52-default-service-template*
*Completed: 2026-08-11*
