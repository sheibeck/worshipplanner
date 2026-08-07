---
phase: 44-default-service-template
plan: 01
subsystem: services
tags: [pinia, firestore, vue3, typescript, vitest, service-template, vertical-worship]

# Dependency graph
requires:
  - phase: 39-org-settings-infrastructure-and-feature-toggles
    provides: "OrgSettings interface, DEFAULT_ORG_SETTINGS, and auth.ts::loadOrgContext's single defaults-merge point"
  - phase: 43-service-item-types
    provides: "Finalized SlotKind palette (ANNOUNCEMENTS/MISC, HYMN retired from add-item palette) that template entries reference"
provides:
  - "ServiceTemplateEntry type + OrgSettings.defaultServiceTemplate field (default [])"
  - "buildSlotsFromTemplate() + progressionVwTypeSequence() helpers in slotTypes.ts"
  - "createService rerouted from unconditional buildSlots('1-2-2-3') to template-driven, empty-by-default slot construction"
affects: [44-02-settings-template-editor, service-creation, org-settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordinal (not positional) walk of PROGRESSION_SLOT_TYPES via progressionVwTypeSequence — required whenever VW typing must apply to an arbitrary-shape slot list, not just buildSlots()'s fixed 9-slot layout"
    - "Cross-store read (useAuthStore()) inside a Pinia action body, mirroring the existing useSongStore() precedent in services.ts"

key-files:
  created: []
  modified:
    - src/types/organization.ts
    - src/utils/slotTypes.ts
    - src/utils/__tests__/slotTypes.test.ts
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "Empty/unset defaultServiceTemplate produces an EMPTY new service (0 slots) — buildSlots() is never called from createService, per the owner's 2026-08-07 override superseding R087's original 'buildSlots() becomes the fallback' clause"
  - "VW-type ordinal mapping cycles via modulo for templates with more SONG entries than the 5-element canonical sequence (Assumption A1 / Open Question 1 in 44-RESEARCH.md) — the alternative considered was clamp-to-last, documented in code comments as the rejected alternative"
  - "An entry whose kind is not a recognized SlotKind is skipped (defensive guard, T-44-03) rather than passed into createSlot's exhaustive switch"

patterns-established:
  - "buildSlotsFromTemplate composes createSlot/reindexSlots exactly as buildSlots does — no parallel slot-construction logic"

requirements-completed: [R086, R087]

coverage:
  - id: D1
    description: "OrgSettings.defaultServiceTemplate field (ServiceTemplateEntry[], default []) merged through the single existing loadOrgContext defaults point"
    requirement: "R086"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build) — clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildSlotsFromTemplate computes VW types at creation by ordinal SONG index (not array position), cycling via modulo for templates with more than 5 songs, and never stores VW types back on the template"
    requirement: "R087"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#buildSlotsFromTemplate (44-01) — 7 tests covering empty/ordinal/mixed-kind/modulo-cycle/VW-off/position-contiguity/unknown-kind-skip"
        status: pass
    human_judgment: false
  - id: D3
    description: "createService reads authStore.settings.defaultServiceTemplate and .vwModeEnabled; an empty/unset template produces an EMPTY new service (owner override 2026-08-07), never buildSlots()'s 1-2-3 shape"
    requirement: "R087"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#createService (44-01 — template-driven, empty-by-default) — 6 tests"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-07
status: complete
---

# Phase 44 Plan 01: Default Service Template Engine Summary

**`buildSlotsFromTemplate()` builds a new service's slots from `OrgSettings.defaultServiceTemplate`, computing Vertical Worship types at creation by walking SONG entries as an ordinal sequence (not array position) into `PROGRESSION_SLOT_TYPES`, with an empty/unset template deliberately producing a zero-slot service instead of the old automatic 1-2-3 default.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-07T21:22:00Z
- **Completed:** 2026-08-07T22:07:04Z
- **Tasks:** 3 (Task 2 and 3 followed the RED/GREEN TDD cycle)
- **Files modified:** 5

## Accomplishments
- `ServiceTemplateEntry` (`{ id, kind, section? }`) added to `src/types/organization.ts`, plus `OrgSettings.defaultServiceTemplate: ServiceTemplateEntry[]` and its `DEFAULT_ORG_SETTINGS` default of `[]` — merged through the single existing `loadOrgContext` defaults point, no second merge point introduced.
- `progressionVwTypeSequence(progression)` and `buildSlotsFromTemplate(entries, vwModeEnabled, progression?)` added to `src/utils/slotTypes.ts`, fixing the position-vs-ordinal bug that would have silently produced `undefined` VW types for any template not matching `buildSlots()`'s fixed 9-slot shape (44-RESEARCH.md Pitfall #2).
- `createService` in `src/stores/services.ts` rerouted from the unconditional `buildSlots('1-2-2-3')` to `buildSlotsFromTemplate(authStore.settings.defaultServiceTemplate, authStore.settings.vwModeEnabled)`, reading the auth store inside the action body (mirroring the existing `useSongStore()` in-action pattern). An empty template now produces a genuinely empty service — the owner's 2026-08-07 override, not the pre-existing 1-2-3 default.
- Rewrote the `createService` test suite in `services.test.ts` to the new empty-by-default contract, adding a `vi.mock('@/stores/auth', ...)` (no prior art in this file) with a mutable `reactive` `mockAuthState.settings`.

## Task Commits

Each task was committed atomically (Tasks 2 and 3 are TDD — test/RED then feat/GREEN):

1. **Task 1: Add ServiceTemplateEntry type + defaultServiceTemplate settings field** - `372e8b3` (feat)
2. **Task 2: buildSlotsFromTemplate + ordinal VW-type mapping in slotTypes.ts**
   - RED: `46a0961` (test)
   - GREEN: `e6de849` (feat)
3. **Task 3: Reroute createService to the template + rewrite its test suite**
   - RED: `2c0cc87` (test)
   - GREEN: `045b1c6` (feat)

_No metadata/final commit is included in this list — it is created in a subsequent step._

## Files Created/Modified
- `src/types/organization.ts` - `ServiceTemplateEntry` interface, `OrgSettings.defaultServiceTemplate` field, `DEFAULT_ORG_SETTINGS.defaultServiceTemplate: []`
- `src/utils/slotTypes.ts` - `progressionVwTypeSequence()`, `buildSlotsFromTemplate()`, `KNOWN_SLOT_KINDS` guard
- `src/utils/__tests__/slotTypes.test.ts` - new `progressionVwTypeSequence` and `buildSlotsFromTemplate` describe blocks (9 new tests)
- `src/stores/services.ts` - `createService` rerouted to `buildSlotsFromTemplate`; `buildSlots` import removed (no longer used in this file), `useAuthStore` import added
- `src/stores/__tests__/services.test.ts` - `vi.mock('@/stores/auth', ...)` + mutable `mockAuthState`, rewritten `createService` describe block (6 tests covering the new contract), `beforeEach` reset for the mock

## Decisions Made
- Empty/unset `defaultServiceTemplate` produces an EMPTY new service (0 slots) — `buildSlots()` is never called from `createService`. This is the owner's 2026-08-07 override, explicitly superseding R087's original "`buildSlots()` becomes the fallback" clause. `buildSlots()` remains available only for the editor's future "Reset to 1-2-3 default" preset (44-02).
- VW-type ordinal mapping cycles via modulo for templates with more `SONG` entries than the 5-element canonical sequence (`sequence[songOrdinal % sequence.length]`) — a discretionary choice per 44-RESEARCH.md's Open Question 1 / Assumption A1, pinned by a 7-song unit test and documented in `slotTypes.ts`'s JSDoc alongside the rejected clamp-to-last alternative.
- An entry whose `kind` is not a recognized `SlotKind` is skipped in `buildSlotsFromTemplate` (T-44-03 defensive guard) rather than passed into `createSlot`'s exhaustive switch, which would otherwise produce an undefined-kind slot from tampered/corrupt Firestore data.

## Deviations from Plan

None — plan executed exactly as written. The plan's `must_haves`, `key_links`, and threat-model dispositions (T-44-01 through T-44-03) are all satisfied as specified; no `firestore.rules`/`storage.rules` changes were made (out of scope, confirmed by 44-RESEARCH.md Pitfall #5).

## Issues Encountered

None. `npm run type-check` (vue-tsc --build) passed clean after every task. The pre-existing `ServiceEditorView.test.ts` modification flagged in the initial git status snapshot turned out to be stale (already committed in Phase 43's `9f78b6f`) — no action was needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The "engine" (data model + `buildSlotsFromTemplate` + rerouted `createService`) is complete and fully tested. Plan 44-02 can now build the Settings "Services" template editor UI on top of `authStore.settings.defaultServiceTemplate` with no further changes needed to this plan's surface.
- **Disclosed implication carried forward from CONTEXT.md:** every existing church (none has a configured template yet) will get an EMPTY new service instead of the previous automatic 1-2-3 default, until it configures a template via 44-02's editor or clicks "Reset to 1-2-3 default." This is a live-visible behavior change the moment this plan's code path is reached in production — owner accepted this knowingly per the 2026-08-07 override.
- **Human verification deferred, per the standing v1.5 autonomy grant** (STATE.md ★★): a live click-through of "create a new blank service with no template configured and confirm it has zero slots" has not been performed by the owner. Recorded in `.planning/PENDING-VERIFICATION.md` § Phase 44.

---
*Phase: 44-default-service-template*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 5 modified files verified present on disk; all 5 task commit hashes (372e8b3, 46a0961,
e6de849, 2c0cc87, 045b1c6) verified present in git log.
