---
phase: 54-service-item-enhancements
plan: 02
subsystem: ui
tags: [vue, service-editor, notes, responsive, tailwind, autosave, stripUndefined]

# Dependency graph
requires:
  - phase: 51-service-order-editing-reliability
    provides: stripUndefined on the services.ts write path (drops raw undefined at slot depth)
  - phase: 43-service-item-types
    provides: the MediaAttachableSlot base + NonAssignableSlot body/read-only editor pattern
  - phase: 48-mobile-layout-polish
    provides: the QuarterView flex flex-col sm:flex-row responsive recipe
provides:
  - Slot-level MediaAttachableSlot.notes?: string (schemaless, additive, reaches all 5 slot kinds cast-free)
  - One shared plain-text notes input beside every item's selector in ServiceEditorView, responsive (side-by-side desktop / stacked mobile)
  - Read-only slot-notes-text viewer variant (text-interpolated, no v-html)
affects: [service-editor, presentation, template]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-seam shared control: one input written ONCE inside the :891 content wrapper covers every slot kind (zero per-kind duplication)"
    - "Optional field on the shared slot base = cast-free access on every union member"

key-files:
  created: []
  modified:
    - src/types/service.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "notes? on the base MediaAttachableSlot (not per-kind) — reachable cast-free on all 5 kinds, distinct from the required top-level Service.notes"
  - "Fixed-width notes column (sm:w-64 flex-shrink-0) keeps the selector dominant (RESEARCH A1)"
  - "Bind = value || undefined so an emptied notes is dropped by stripUndefined, never persisting raw undefined or ''"

patterns-established:
  - "Slot-level free-text affordance: base-field + one shared two-column responsive wrapper in the item row"

requirements-completed: [R122]

coverage:
  - id: D1
    description: "notes?: string added to the base MediaAttachableSlot, reachable cast-free on all 5 slot kinds, distinct from top-level Service.notes"
    requirement: R122
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build) — clean; slot.notes accessed with no cast in ServiceEditorView.vue"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every slot kind renders exactly one plain-text slot-notes-input beside its selector"
    requirement: R122
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#renders exactly one slot-notes-input per slot, across every item kind"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selector and notes sit in a flex flex-col sm:flex-row responsive wrapper (side-by-side desktop / stacked mobile) via the QuarterView recipe"
    requirement: R122
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#wraps selector and notes in a flex flex-col sm:flex-row responsive container"
        status: pass
    human_judgment: false
  - id: D4
    description: "Editing notes updates slot.notes through the existing autosave path; clearing to empty yields undefined and is stripped (never raw undefined)"
    requirement: R122
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#typing into slot-notes-input sets slot.notes; clearing it to empty yields undefined"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#R122: strips an undefined slot.notes and round-trips a defined one through the slots payload"
        status: pass
    human_judgment: false
  - id: D5
    description: "A locked/viewer service renders notes as read-only slot-notes-text (text interpolation only, never v-html, no input)"
    requirement: R122
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#a locked/viewer service renders slot-notes-text (not an input) for a slot carrying notes"
        status: pass
    human_judgment: false
  - id: D6
    description: "On the live service edit screen, notes sits beside the selector on desktop and stacks below on a narrow viewport, consistent across song/scripture/message items"
    verification: []
    human_judgment: true
    rationale: "Responsive visual layout across real breakpoints is a human-visual judgment (54-VALIDATION.md); deferred per the v1.6 standing autonomy grant."

# Metrics
duration: 40min
completed: 2026-08-11
status: complete
---

# Phase 54 Plan 02: Service Item Notes Field (R122) Summary

**A plain-text `slot.notes` field on the shared MediaAttachableSlot base, surfaced as one shared input beside every item's selector in a `flex flex-col sm:flex-row` two-column layout, riding the existing autosave + stripUndefined path.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-11T19:33:00Z
- **Completed:** 2026-08-11T20:10:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `notes?: string` to the base `MediaAttachableSlot` — one additive, schemaless, migration-free field reaching all 5 slot kinds (SONG/SCRIPTURE/NonAssignable/HYMN/IMPORTED) cast-free, kept distinct from the required top-level `Service.notes`.
- Wrapped the `:891` content div in a two-column responsive flex (QuarterView recipe): the existing per-kind selector chain in the left column, ONE shared `slot-notes-input` written once for every kind in the right column — side-by-side on desktop, stacked on mobile.
- Wired notes through the existing autosave path with `= value || undefined`, so an emptied value is dropped by Phase 51's `stripUndefined` and never persists a raw `undefined` (proven by a store test).
- Added a read-only `slot-notes-text` viewer variant (text interpolation only, no `v-html`) for locked/viewer services.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Add `notes?` to slot base + RED tests** - `91c8fb1` (test)
2. **Task 2: GREEN — one shared notes input in a two-column responsive wrapper** - `8311b88` (feat)

**Plan metadata:** committed with this SUMMARY (docs)

## Files Created/Modified
- `src/types/service.ts` - Added `notes?: string` to the base `MediaAttachableSlot` with a doc note distinguishing it from `Service.notes`.
- `src/views/ServiceEditorView.vue` - Two-column responsive wrapper inside the `:891` content div; one shared `slot-notes-input` (editor) + `slot-notes-text` (viewer), cast-free `slot.notes`.
- `src/views/__tests__/ServiceEditorView.test.ts` - New R122 describe: input-per-kind, responsive-class, edit-updates-slot / clear-to-undefined, viewer read-only + escaping.
- `src/stores/__tests__/services.test.ts` - R122 updateService test: undefined slot.notes stripped, defined value round-trips.

## Decisions Made
- **notes? on the shared base, not per-kind.** Reaches all 5 union members cast-free (unlike `body`, which is cast `as NonAssignableSlot`), and matches the RESEARCH-verified seam.
- **Fixed-width notes column (`sm:w-64 flex-shrink-0`).** Keeps the selector dominant (RESEARCH assumption A1); full width when stacked below `sm`.
- **`= value || undefined` on input.** Honors the additive/optional model and lets `stripUndefined` drop an emptied value, rather than persisting `''`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Both TDD tasks landed cleanly; RED failed exactly as designed, GREEN passed on first implementation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R122 is code-complete and covered by unit/type tests. The one human-visual check (D6: responsive layout across real breakpoints, consistency across item kinds) is DEFERRED per the v1.6 standing autonomy grant — record in `.planning/PENDING-VERIFICATION.md`, verify via `/gsd-verify-work 54`.
- Phase 54 is complete once this plan (R122) and 54-01 (R123) are both verified.

## Verification
- `npx vitest run src/views/__tests__/ServiceEditorView.test.ts src/stores/__tests__/services.test.ts` — 350/350 pass.
- `npm run type-check` (vue-tsc --build) — clean; `slot.notes` cast-free.
- Broad gate `npx vitest run --dir src --exclude '**/rules.test.ts'` — 3059 pass; only the exact 2-file baseline red (`src/storage.rules.test.ts` env limitation, `src/views/__tests__/RosterView.test.ts` stale assertion). No regression.

## Self-Check: PASSED

Both task commits (`91c8fb1`, `8311b88`) exist in history; all 4 modified source/test files and this SUMMARY exist on disk.

---
*Phase: 54-service-item-enhancements*
*Completed: 2026-08-11*
