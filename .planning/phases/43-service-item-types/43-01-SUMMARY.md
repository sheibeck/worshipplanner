---
phase: 43-service-item-types
plan: 01
subsystem: types
tags: [typescript, vue-tsc, exhaustive-switch, slot-kind]

# Dependency graph
requires: []
provides:
  - "SlotKind widened with 'ANNOUNCEMENTS' and 'MISC' (eight members total; 'HYMN' untouched)"
  - "NonAssignableSlot.kind widened to 'PRAYER' | 'MESSAGE' | 'ANNOUNCEMENTS' | 'MISC'"
  - "NonAssignableSlot.body?: string — the one shared optional free-text field for MESSAGE/ANNOUNCEMENTS/MISC"
  - "Every kind-dispatch site in slotTypes.ts, slideDisplay.ts, ServiceCard.vue, slideGroupMaterializer.ts and slideshowAssembler.ts closed with an explicit ANNOUNCEMENTS/MISC case"
  - "ANNOUNCEMENTS and MISC constructible, labelable, badge-able, and materialize exactly one text slide"
affects: [43-02, 43-03, 43-04, 44-default-service-template]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exhaustive switch(slot.kind) is the compiler-enforced worklist generator — widen the union first, let vue-tsc --build enumerate every site that needs a new case"
    - "Compiler-silent dispatch sites (a function whose declared/inferred return type already includes undefined, or a statement switch with no default) must be found and closed BY HAND — the compiler will never flag them"

key-files:
  created: []
  modified:
    - src/types/service.ts
    - src/utils/slotTypes.ts
    - src/components/slides/slideDisplay.ts
    - src/components/ServiceCard.vue
    - src/utils/slideGroupMaterializer.ts
    - src/utils/slideshowAssembler.ts
    - src/utils/__tests__/slotTypes.test.ts
    - src/components/slides/__tests__/slideDisplay.test.ts

key-decisions:
  - "One shared optional body?: string on NonAssignableSlot, not four per-kind fields — matches TextSlide.body's name, no migration needed since it's optional"
  - "ANNOUNCEMENTS/MISC reuse PRAYER's neutral gray badge family (bg-gray-800/text-gray-400/border-gray-700) rather than a new colour token"
  - "The congregation-facing PROJECTED slide for ANNOUNCEMENTS/MISC shows slotLabel(slot) as both title and body, never slot.body — recorded in PENDING-VERIFICATION.md as a deferred owner check, since sourceSignature() returning undefined for text-backed kinds means a body-derived projected slide would have no change-detection signal"
  - "slideGroupMaterializer.ts's sourceSignature() switch is compiler-silent (its string | undefined return type lets a missing case fall through unflagged) — treated as a third by-hand-closed site alongside slideshowAssembler.ts's two documented ones, since the plan's acceptance criteria require all four switch sites in that file to carry explicit ANNOUNCEMENTS/MISC cases regardless of what the compiler flags"
  - "ServiceCard.vue's slotPrefix/slotName/slotHasContent/slotTextClass deliberately left unchanged — they are if-chains with graceful generic fallbacks; neither the requirement nor the compiler asks for a change"

patterns-established:
  - "New NonAssignableSlot kinds join the existing text-group grouped fall-through arm (case 'PRAYER': case 'MESSAGE': ...) at every dispatch site rather than getting a separate arm — they are structurally identical to PRAYER/MESSAGE"

requirements-completed: [R081, R082, R084]

coverage:
  - id: D1
    description: "SlotKind widened with ANNOUNCEMENTS and MISC; NonAssignableSlot carries body?: string; HYMN and ServiceSlot union untouched"
    requirement: "R081"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#ANNOUNCEMENTS and MISC (43-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "createSlot('ANNOUNCEMENTS')/createSlot('MISC') return a NonAssignableSlot with non-empty id, position 0, and body absent (not empty string)"
    requirement: "R081"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#createSlot(ANNOUNCEMENTS) returns kind, a non-empty id, position 0, and omits body entirely"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#createSlot(MISC) returns kind, a non-empty id, position 0, and omits body entirely"
        status: pass
    human_judgment: false
  - id: D3
    description: "slotLabel() returns 'Announcements'/'Miscellaneous' for the two new kinds; six pre-existing labels unchanged"
    requirement: "R082"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#slotLabel returns Announcements for ANNOUNCEMENTS and Miscellaneous for MISC"
        status: pass
    human_judgment: false
  - id: D4
    description: "Probe edges E-01/E-03/E-04/E-05/E-07/E-08 (adjacency, verbatim encoding round-trip, ordering) proven by named tests"
    requirement: "R082"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#E-01/E-03/E-04/E-05/E-07/E-08 tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "HYMN survives at the type layer unchanged — createSlot('HYMN') and slotLabel(HYMN) byte-identical, palette removal deferred to plan 03"
    requirement: "R084"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slotTypes.test.ts#HYMN survives at the type layer"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every kind-dispatch site (compiler-caught and the three compiler-silent ones) closed with an explicit case, zero new default arms; npm run type-check exits 0"
    requirement: "R081"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D7
    description: "ANNOUNCEMENTS/MISC materialize exactly one text slide (join the PRAYER/MESSAGE/HYMN text group in slideGroupMaterializer.ts and slideshowAssembler.ts, both compiler-silent sites closed)"
    requirement: "R081"
    verification:
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' (full suite, baseline failing-file set unchanged)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The projected-slide decision (kind label, not body) is disclosed to the owner as a deferred check"
    verification: []
    human_judgment: true
    rationale: "Content-presentation decision explicitly deferred to the owner per this plan's Task 2 — recorded in .planning/PENDING-VERIFICATION.md § Phase 43 for confirmation, not something an automated test can approve on the owner's behalf."

duration: 9min
completed: 2026-08-07
status: complete
---

# Phase 43 Plan 01: Widen SlotKind and Close Every Kind-Dispatch Site Summary

**Widened `SlotKind` with `ANNOUNCEMENTS`/`MISC` and one shared optional `NonAssignableSlot.body?: string` field, then used `npm run type-check`'s compiler-surfaced worklist (plus three compiler-silent sites found by hand) to close every `switch (slot.kind)` in the codebase with an explicit case — zero new `default` arms.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-08-07T13:51:19-04:00
- **Completed:** 2026-08-07T13:59:55-04:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `SlotKind` now has eight members (`'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE' | 'ANNOUNCEMENTS' | 'MISC' | 'HYMN' | 'IMPORTED'`); `HymnSlot` and the `ServiceSlot` union are byte-identical to before.
- `NonAssignableSlot.kind` widened to four kinds; one new optional field `body?: string` added, doc-commented as the shared free-text field for MESSAGE/ANNOUNCEMENTS/MISC, matching `TextSlide.body`'s name, optional so no migration is needed.
- Task 1's captured `npm run type-check` (`vue-tsc --build`) worklist, verbatim (sorted unique file list): `src/components/ServiceCard.vue`, `src/components/slides/slideDisplay.ts`, `src/utils/slideGroupMaterializer.ts`, `src/utils/slotTypes.ts`.
- Task 2 closed every site on that worklist plus three compiler-silent sites found by hand: `slideGroupMaterializer.ts`'s `sourceSignature()` (its `string | undefined` return type lets a missing case pass silently) and `slideshowAssembler.ts`'s `buildTextContentForSlot()` (`default: return undefined`) and its fallback-assembly statement switch (no default at all). `npm run type-check` exits 0; `git diff` introduces zero new `default:` arms in any modified `switch (slot.kind)`.
- Task 3 added 6 new `createSlot`/`slotLabel` tests plus 6 probe-edge tests (E-01, E-03, E-04, E-05, E-07, E-08) to `slotTypes.test.ts`, extended `slideDisplay.test.ts`'s `ALL_KINDS` with both new members, and added `slotDisplayTitle` coverage for both. Full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`) shows 2 failing files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) — the documented pre-existing baseline, unchanged.

## Task Commits

1. **Task 1: Widen SlotKind and NonAssignableSlot, add the shared body field, and capture the compiler worklist** - `9a5bdc6` (feat)
2. **Task 2: Close every compiler-surfaced kind-dispatch site, plus the two (in practice three) the compiler cannot see** - `fbc0542` (feat)
3. **Task 3: Unit coverage for the two new kinds at the type, factory and label layer** - `28963fa` (test)

## Files Created/Modified

- `src/types/service.ts` — `SlotKind` widened, `NonAssignableSlot.kind` widened, `body?: string` added
- `src/utils/slotTypes.ts` — `slotLabel()` and `createSlot()` gain explicit ANNOUNCEMENTS/MISC cases
- `src/components/slides/slideDisplay.ts` — `KIND_BADGE_CLASSES` gains both keys (literal strings, PRAYER's neutral gray family); `slotDisplayTitle()` joins the PRAYER/MESSAGE/IMPORTED grouped arm
- `src/components/ServiceCard.vue` — local `slotLabel()` gains both cases
- `src/utils/slideGroupMaterializer.ts` — all four `switch (slot.kind)` sites (`deriveGroupEntries`, `sourceSignature`, `isSlotDerivableRef`, `rebuildGroup`) extend the PRAYER/MESSAGE/HYMN text-group arm
- `src/utils/slideshowAssembler.ts` — `buildTextContentForSlot()` and the fallback-assembly statement switch both extended; both emit `slotLabel(slot)` as title and body, never `slot.body`
- `src/utils/__tests__/slotTypes.test.ts` — new `describe('ANNOUNCEMENTS and MISC (43-01)')` block
- `src/components/slides/__tests__/slideDisplay.test.ts` — `ALL_KINDS` extended; `slotDisplayTitle` coverage added

## Decisions Made

- **One shared `body?: string`, not per-kind fields** — matches `TextSlide.body`'s naming precedent, optional avoids any migration.
- **ANNOUNCEMENTS/MISC reuse PRAYER's badge colour family** — no new Tailwind colour token introduced.
- **Projected slide shows the kind label, never `slot.body`** — recorded as a deferred owner-facing decision in `.planning/PENDING-VERIFICATION.md § Phase 43`, for two reasons: (1) projecting raw planner notes to a congregation is a content decision no requirement in this phase authorizes, and (2) `sourceSignature()` returns `undefined` for every text-backed kind, so a `body`-derived projected slide would have no change-detection signal and a `body` edit would leave a stale materialized group behind. Team-facing print/share surfaces (plan 04) DO render `body`.
- **`slideGroupMaterializer.ts`'s `sourceSignature()` treated as a third compiler-silent site** — the plan's `read_first` named only the two `slideshowAssembler.ts` sites as compiler-silent, but `sourceSignature`'s declared `string | undefined` return type means a missing case there also passes `npm run type-check` silently. Closed it by hand anyway, since the plan's own acceptance criteria require all four `slideGroupMaterializer.ts` switch sites to carry explicit `ANNOUNCEMENTS`/`MISC` cases.
- **`ServiceCard.vue`'s `slotPrefix`/`slotName`/`slotHasContent`/`slotTextClass` deliberately left unchanged** — per the plan's explicit instruction, these are if-chains with graceful generic fallbacks; neither requirement nor compiler asks for a change.

## Deviations from Plan

None — plan executed exactly as written. The one departure from the plan's literal text (treating `sourceSignature()` as a third by-hand site rather than only the two named `slideshowAssembler.ts` sites) is not a deviation from intent: the plan's own Task 2 acceptance criteria already required all four `slideGroupMaterializer.ts` switch sites to carry explicit cases, so this is following the acceptance criteria over an incomplete `read_first` gloss, not adding scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The type contract Phase 44's default template editor depends on is now finalized: `SlotKind` is its final eight-member shape for this milestone, `NonAssignableSlot.body` is the one field plans 02-04 will all read/write.
- `npm run type-check` is 0 errors and the full app suite baseline is unchanged — plans 02, 03 and 04 can proceed against a clean compiler state.
- One deferred owner check added to `.planning/PENDING-VERIFICATION.md § Phase 43`: confirm the projected-slide-shows-label-not-body decision.
- No blockers for plan 02 (Planning Center export, R085) or plan 03 (palette + editor UI, R083/R084).

---
*Phase: 43-service-item-types*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 8 modified source files present on disk; all 3 task commits (`9a5bdc6`, `fbc0542`, `28963fa`) found in git history.
