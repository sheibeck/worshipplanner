---
phase: 20-service-sections-and-slide-auto-assembly
plan: 01
subsystem: data-model
tags: [typescript, vue, service-model, slide-model, tdd, vitest]

requires:
  - phase: 18-song-lyric-slides-and-editor
    provides: unified Slide type with content-kind discriminator (LyricSlide, CopyrightSlide)
  - phase: 19-scripture-and-congregational-reading-slides
    provides: ScriptureSlide variant in the Slide union, ScriptureSlot.scriptureReadingId/readingMode
provides:
  - ServiceSection type (four members) + SERVICE_SECTIONS single-source array + SERVICE_SECTION_LABELS
  - Optional section? field on SongSlot, ScriptureSlot, NonAssignableSlot, HymnSlot
  - TextSlide variant added to the unified Slide union
  - AssembledSlide wrapper (slide + slotIndex + slotKind + section + sourceId)
  - AssembledSection grouping shape (section + label + slides)
  - buildSlots() deterministic default section assignment; createSlot() optional section param
affects: [20-02-slide-auto-assembly-engine, 20-03-reactive-assembly-composable, 20-04-section-ui]

tech-stack:
  added: []
  patterns:
    - "Optional per-slot section field (not a Service-level field) — additive, zero-migration seam for legacy Firestore services"
    - "AssembledSlide wraps the unified Slide type rather than forking a parallel slide hierarchy (D001)"

key-files:
  created: []
  modified:
    - src/types/service.ts
    - src/types/slide.ts
    - src/utils/slotTypes.ts
    - src/utils/__tests__/slotTypes.test.ts

key-decisions:
  - "SERVICE_SECTIONS kept as the single source-of-truth array so a future per-church configurable section set is a localized change (carried open question)"
  - "createSlot() omits the section key entirely when not provided (conditional spread) rather than setting section: undefined, preserving the exact legacy object shape"

patterns-established:
  - "Default section assignment lives in a small position->section pure function (defaultSectionForPosition) inside slotTypes.ts, reused by both songSlot/scriptureSlot/nonAssignableSlot builders in buildSlots()"

requirements-completed: [R007]

coverage:
  - id: D1
    description: "ServiceSection type (four members, D005) + SERVICE_SECTIONS + SERVICE_SECTION_LABELS exported from service.ts; optional section field on all four slot variants"
    requirement: "R007"
    verification:
      - kind: unit
        ref: "npm run type-check (whole-project vue-tsc build, zero new errors in src/types/service.ts)"
        status: pass
    human_judgment: false
  - id: D2
    description: "TextSlide added to the unified Slide union; AssembledSlide and AssembledSection wrapper interfaces added without forking the slide model (D001)"
    requirement: "R007"
    verification:
      - kind: unit
        ref: "npm run type-check (whole-project vue-tsc build, zero new errors in src/types/slide.ts)"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildSlots() assigns deterministic default sections (worship 0-6, message 7, sending 8) for both progressions; createSlot() threads an optional section param; reindexSlots() preserves section unchanged"
    requirement: "R007"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#buildSlots — default section assignment (D005)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#createSlot — section parameter"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#reindexSlots — preserves section"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-24
status: complete
---

# Phase 20 Plan 01: Service Sections and Slide-Model Data Foundation Summary

**Additive ServiceSection type (D005, four members) threaded as an optional per-slot field, plus TextSlide/AssembledSlide/AssembledSection extensions to the unified slide model (D001), with deterministic default-section assignment in buildSlots().**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-24T22:20:00Z
- **Completed:** 2026-07-24T22:27:42Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `ServiceSection` type + `SERVICE_SECTIONS` single-source array + `SERVICE_SECTION_LABELS` display map added to `src/types/service.ts`; optional `section?: ServiceSection` field added to `SongSlot`, `ScriptureSlot`, `NonAssignableSlot`, `HymnSlot` — legacy (section-less) service docs still type-check and load unchanged.
- `TextSlide` interface added to the unified `Slide` union (`src/types/slide.ts`); `AssembledSlide` (slide + slotIndex + slotKind + section + sourceId) and `AssembledSection` (section + label + slides) wrapper interfaces added — the assembly engine's future output shape, reusing D001's single `Slide` type rather than forking it.
- `buildSlots()` now assigns deterministic default sections per the M001 template (indices 0-6 -> `worship`, index 7 MESSAGE -> `message`, index 8 sending song -> `sending`) for both `1-2-2-3` and `1-2-3-3` progressions; `createSlot(kind, vwType?, section?)` threads an optional third `section` param, omitting the key entirely when not provided so the legacy object shape is byte-identical; `reindexSlots()` left untouched (its existing spread already preserves `section` unchanged while only rewriting `position`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ServiceSection type and optional section field to all slot variants** - `644543e` (feat)
2. **Task 2: Add TextSlide, AssembledSlide, and AssembledSection to the unified slide model** - `80e4331` (feat)
3. **Task 3: Assign default sections in buildSlots() and thread section through createSlot()** (TDD) - `e46fc0c` (test, RED) then `6a6f5a9` (feat, GREEN)

**Plan metadata:** committed separately (see final commit below)

_Note: Task 3 used the TDD RED/GREEN cycle — test commit added the three new `describe` blocks (all failing against pre-change `slotTypes.ts`), then the feat commit made them pass. No REFACTOR commit needed — the implementation was already minimal (a small pure `defaultSectionForPosition` helper + conditional spread)._

## Files Created/Modified
- `src/types/service.ts` - `ServiceSection`, `SERVICE_SECTIONS`, `SERVICE_SECTION_LABELS`; optional `section?` on all four slot variants
- `src/types/slide.ts` - `TextSlide` added to `Slide` union; `AssembledSlide` and `AssembledSection` interfaces added
- `src/utils/slotTypes.ts` - `createSlot()` gains optional `section` param (conditional spread, key omitted when absent); `buildSlots()` assigns default sections via new `defaultSectionForPosition()` helper; `reindexSlots()` unchanged
- `src/utils/__tests__/slotTypes.test.ts` - 8 new tests: 2 `buildSlots` section-default assertions, 2 `createSlot` section-threading assertions, 1 `reindexSlots` section-preservation assertion (grouped across 3 new `describe` blocks; 36 tests total in file, up from 28)

## Decisions Made
- `SERVICE_SECTIONS` kept as the single source-of-truth array (not duplicated across files) so the carried open question — "are sections configurable per-church?" — remains a localized future change per the plan's `key_links`.
- `createSlot()` omits the `section` key entirely (via `const sectionFields = section ? { section } : {}`) rather than setting `section: undefined` — this preserves the exact legacy object shape (`Object.keys()` parity) rather than merely satisfying `=== undefined` at the type level.

## Deviations from Plan

None — plan executed exactly as written for all three tasks.

### Note on pre-existing, out-of-scope type-check failures

`npm run type-check` exits with code 2 due to ~40 pre-existing `TS2532`/`TS2345`/`TS2322` errors in `src/utils/ccliParser.ts`, `src/utils/__tests__/ccliParser.test.ts`, `src/utils/scriptureSplitter.ts`, and `src/utils/__tests__/scriptureSplitter.test.ts`. Verified via `git stash` that these errors are byte-identical on the pre-Phase-20 baseline commit (`1422012 docs(20): create phase plan`) — none were introduced by this plan. Per the SCOPE BOUNDARY rule this is out of scope (unrelated files, not in this plan's `files_modified` list) and was not fixed; logged to `.planning/phases/20-service-sections-and-slide-auto-assembly/deferred-items.md`. Each task's actual acceptance criterion — "no new errors in the changed files" — was independently verified by diffing `npm run type-check` output filtered to `service.ts`/`slide.ts`/`slotTypes.ts` before and after every task (zero matches both times).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ServiceSection`, `SERVICE_SECTIONS`, `SERVICE_SECTION_LABELS`, and the optional per-slot `section` field are in place and default-populated by `buildSlots()` — Plan 20-02 (assembly engine) can now walk `service.slots` and group by `slot.section`.
- `TextSlide`, `AssembledSlide`, and `AssembledSection` are exported from `src/types/slide.ts` — Plan 20-02 can build the assembly function against these shapes; Plan 20-04 (section UI) can consume `AssembledSection.label`/`SERVICE_SECTION_LABELS` directly.
- Backward compatibility confirmed: legacy services with no `section` field on their slots continue to type-check (optional field) and `reindexSlots()` continues to leave `section` untouched.
- Blocker/concern carried forward: the pre-existing `ccliParser.ts`/`scriptureSplitter.ts` type-check failures mean `npm run type-check` cannot be used as a hard pass/fail gate for the whole project until a future cleanup task addresses them (see deferred-items.md) — subsequent Phase 20 plans should keep using file-scoped diffing the same way this plan did.

---
*Phase: 20-service-sections-and-slide-auto-assembly*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: src/types/service.ts
- FOUND: src/types/slide.ts
- FOUND: src/utils/slotTypes.ts
- FOUND: src/utils/__tests__/slotTypes.test.ts
- FOUND: .planning/phases/20-service-sections-and-slide-auto-assembly/20-01-SUMMARY.md
- FOUND: .planning/phases/20-service-sections-and-slide-auto-assembly/deferred-items.md
- FOUND commit: 644543e
- FOUND commit: 80e4331
- FOUND commit: e46fc0c
- FOUND commit: 6a6f5a9
