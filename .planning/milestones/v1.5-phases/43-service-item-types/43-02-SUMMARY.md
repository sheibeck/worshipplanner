---
phase: 43-service-item-types
plan: 02
subsystem: api
tags: [typescript, vitest, planning-center, exhaustive-dispatch, vue-tsc]

# Dependency graph
requires:
  - phase: 43-01
    provides: "SlotKind widened with ANNOUNCEMENTS/MISC; NonAssignableSlot.body?: string; every kind-dispatch site closed"
provides:
  - "addSlotAsItem's if-chain has an explicit, named branch for every SlotKind member — SONG, HYMN, SCRIPTURE, PRAYER, ANNOUNCEMENTS, MISC, MESSAGE, IMPORTED — with no implicit-else fallthrough"
  - "A never-typed exhaustiveness backstop after the chain, bound on slot.kind, that turns a future unhandled SlotKind into a vue-tsc compile error"
  - "bodyDescription() helper: whitespace-aware presence check, verbatim untrimmed pass-through, shared by MESSAGE/ANNOUNCEMENTS/MISC"
  - "MESSAGE branch prefers body over the pre-existing sermonPassage fallback, does not replace it"
  - "11 new tests in planningCenterApi.test.ts proving E-10, E-14, E-17, E-18, E-19, E-20"
affects: [43-03, 43-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exhaustiveness backstop must bind on the discriminant property (slot.kind), not the whole object, when multiple union members share one interface with a multi-literal discriminant — TypeScript's control-flow narrowing does not collapse a shared object type to never from sequential if-return checks on one property, only the property's own literal-union type narrows to never that way"
    - "Multiple sequential addSlotAsItem calls in one test need independent vi.mocked(fetch).mockResolvedValueOnce(...) Response instances, not a single shared defaultFetchResponse() — Response.json() is single-use per call and reusing one Response across two awaited fetches throws 'Body is unusable: Body has already been read'"

key-files:
  created: []
  modified:
    - src/utils/planningCenterApi.ts
    - src/utils/__tests__/planningCenterApi.test.ts

key-decisions:
  - "Exhaustiveness backstop binds on slot.kind (const unhandledKind: never = slot.kind), not on slot itself, contrary to the plan's literal 'initialised from slot' wording — verified by a minimal repro that TypeScript does NOT narrow a shared-interface union member (NonAssignableSlot, whose kind is 'PRAYER'|'MESSAGE'|'ANNOUNCEMENTS'|'MISC') to never via sequential if-return checks the way it narrows single-member discriminated union types. slot.kind DOES narrow to never correctly since it is a flat string-literal union. Chose this form under the plan's explicitly granted discretion between a never assignment, a helper, and a default-case throw (43-CONTEXT.md)."
  - "bodyDescription(body) is a module-level, non-exported helper (matching the file's existing basicAuthHeader/fetchPersonEmails convention) rather than inlined three times — the whitespace-aware presence rule (trimmed-length check, untrimmed return) is identical across MESSAGE/ANNOUNCEMENTS/MISC and a single implementation makes the E-18/E-19 contract auditable in one place."
  - "ANNOUNCEMENTS and MISC branches pass length through (the plan's explicit instruction), even though the pre-existing PRAYER branch they otherwise mirror does not accept length — not a deviation from the plan, which named this exactly."
patterns-established:
  - "Text-kind description derivation (bodyDescription) is the canonical whitespace-aware-presence + verbatim-value pattern for any future free-text field reaching a third-party API description/notes attribute"

requirements-completed: [R085]

coverage:
  - id: D1
    description: "Every SlotKind member has an explicit, named branch in addSlotAsItem; the implicit-else MESSAGE fallback is gone"
    requirement: "R085"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exits 0; git diff shows SONG/HYMN/SCRIPTURE/PRAYER branch bodies unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "A never-typed exhaustiveness backstop follows the chain, referenced in a thrown message, so a future SlotKind member is a vue-tsc compile error"
    requirement: "R085"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build) exits 0 with the backstop present; minimal repro confirmed the slot-vs-slot.kind narrowing distinction that makes this compile"
        status: pass
    human_judgment: false
  - id: D3
    description: "ANNOUNCEMENTS exports as a regular item titled Announcements, never Message; MISC exports as Miscellaneous, never Message"
    requirement: "R085"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/planningCenterApi.test.ts#maps ANNOUNCEMENTS slot to a regular item titled \"Announcements\", never \"Message\""
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/planningCenterApi.test.ts#maps MISC slot to a regular item titled \"Miscellaneous\", never \"Message\""
        status: pass
    human_judgment: false
  - id: D4
    description: "Probe edges E-10, E-14, E-17, E-18, E-19, E-20 each proven by a named, passing test"
    requirement: "R085"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/planningCenterApi.test.ts#R085 — every SlotKind branch is explicit (Phase 43 Plan 02) (E-10/E-14/E-17/E-18/E-19/E-20 named tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "MESSAGE keeps its sermonPassage fallback and prefers body when set; SONG/HYMN/SCRIPTURE/PRAYER export byte-identically to before this phase"
    requirement: "R085"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/planningCenterApi.test.ts#addSlotAsItem (99 pre-existing tests, unmodified, all passing) plus 'a MESSAGE slot with both body and sermonPassage prefers body'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Live Planning Center round-trip: a real export produces three distinctly-titled items, none labelled Message"
    verification: []
    human_judgment: true
    rationale: "Requires live Planning Center credentials and a real API round-trip; the unit suite proves the outbound request shape against a mocked fetch, not that Planning Center actually creates three distinctly-titled items when given that shape. Recorded as a deferred owner check in .planning/PENDING-VERIFICATION.md § Phase 43 § Plan 43-02."

duration: 22min
completed: 2026-08-07
status: complete
---

# Phase 43 Plan 02: Close the addSlotAsItem Silent-Fallthrough Trap Summary

**Converted `addSlotAsItem`'s unguarded if-chain — whose implicit final `else` labelled every unhandled `SlotKind` "Message" — into an exhaustive, compiler-guarded dispatch with an explicit branch per kind and a `never`-typed backstop that fails `vue-tsc --build` if a future kind is ever left unhandled.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-08-07T17:54:00Z (approx.)
- **Completed:** 2026-08-07T18:16:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `addSlotAsItem` (`src/utils/planningCenterApi.ts`) now tests `slot.kind` explicitly for every one of the eight `SlotKind` members: SONG, HYMN, SCRIPTURE, PRAYER (byte-identical to before), plus new explicit ANNOUNCEMENTS (`Announcements`, `itemType: 'regular'`), MISC (`Miscellaneous`, `itemType: 'regular'`), an explicit `if (slot.kind === 'MESSAGE')` replacing the bare-comment implicit else, and IMPORTED (returns `''`, defensive against the caller's parameter type not narrowing).
- A `never`-typed exhaustiveness backstop (`const unhandledKind: never = slot.kind; throw new Error(...)`) follows the chain. Verified by minimal repro (see Decisions) that binding on `slot.kind` — not `slot` — is the form that actually compiles, given `NonAssignableSlot`'s shared 4-literal `kind` union.
- New `bodyDescription()` helper gives MESSAGE/ANNOUNCEMENTS/MISC one shared, whitespace-aware description rule: a trimmed-length check decides presence (E-18), but the original untrimmed string is what's returned (E-19).
- 11 new tests added to the existing `addSlotAsItem` describe block, covering all six probe edges this plan owns (E-10, E-14, E-17, E-18, E-19, E-20) plus explicit not-Message inequality assertions for both new kinds. All 99 pre-existing tests in the file pass unmodified (110 total).
- `npm run type-check` (`vue-tsc --build`) exits 0. Full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`) shows the documented 2-failing-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) — unchanged, no new failing file.

## Task Commits

1. **Task 1: Make every export branch explicit and add the exhaustiveness backstop** - `97e5639` (feat)
2. **Task 2: R085 per-branch export test suite** - `e9c7ec5` (test)

## Files Created/Modified

- `src/utils/planningCenterApi.ts` — `bodyDescription()` helper added; `addSlotAsItem` gains explicit ANNOUNCEMENTS/MISC/MESSAGE/IMPORTED branches and a `never`-typed exhaustiveness backstop; SONG/HYMN/SCRIPTURE/PRAYER branch bodies unchanged (verified by `git diff`)
- `src/utils/__tests__/planningCenterApi.test.ts` — `ImportedSlot` added to the type import; new `describe('R085 — every SlotKind branch is explicit (Phase 43 Plan 02)')` block with 11 tests nested inside the existing `addSlotAsItem` suite

## Decisions Made

- **Exhaustiveness backstop binds on `slot.kind`, not `slot`.** The plan's `<action>` text says "a binding annotated as the `never` type and initialised from `slot`," but a minimal TypeScript repro (`interface Multi { kind: 'B'|'C'|'D' }` alongside `interface Only { kind: 'A' }`, sequential `if (u.kind === X) return` checks, then `const n: never = u`) confirms `tsc` reports `TS2322: Type 'Multi' is not assignable to type 'never'` even after every literal of `Multi['kind']` has been excluded — TypeScript's control-flow narrowing collapses the *discriminant property's* type to `never` in that pattern, but does not collapse the *whole shared object type* to `never`, because `Multi` (here, `NonAssignableSlot`) is one interface serving four `SlotKind` literals (PRAYER/MESSAGE/ANNOUNCEMENTS/MISC) rather than four separate interfaces. Binding on `u.kind`/`slot.kind` instead compiles cleanly, because that property genuinely is `never` at that point. This was exercised live against the actual file before settling: the literal-`slot` form produced `TS2322: Type 'NonAssignableSlot' is not assignable to type 'never'` twice under `vue-tsc --build`; the `slot.kind` form produces zero errors. Chosen under 43-CONTEXT.md's explicitly granted discretion among a `never` assignment, a helper function, or a default-case throw.
- **`bodyDescription()` as a shared, non-exported module-level helper** rather than three inline copies — matches the file's existing convention (`basicAuthHeader`, `fetchPersonEmails`) and keeps the E-18/E-19 whitespace-vs-verbatim contract in one auditable place.
- **ANNOUNCEMENTS/MISC pass `length` through**, per the plan's explicit instruction, even though the PRAYER branch they otherwise mirror in shape does not accept `length` — this was the plan's stated intent, not an addition invented during execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Exhaustiveness backstop rewritten to bind on `slot.kind` instead of `slot`**
- **Found during:** Task 1 verification (`npm run type-check`)
- **Issue:** The plan's literal instruction ("a binding annotated as the `never` type and initialised from `slot`") does not compile: `const unhandledSlot: never = slot` produced `TS2322: Type 'NonAssignableSlot' is not assignable to type 'never'` under `vue-tsc --build`, because `NonAssignableSlot` is a single interface shared by four `SlotKind` literals (PRAYER/MESSAGE/ANNOUNCEMENTS/MISC) and TypeScript's control-flow narrowing does not collapse that shared object type to `never` from four sequential if-return checks on its `kind` property.
- **Fix:** Bound the `never` assignment on `slot.kind` (the discriminant property, whose own literal-union type genuinely does narrow to `never`) instead of on `slot` itself, and read the unhandled kind back off that binding in the thrown message. Confirmed compiling with a minimal isolated repro before and after, then confirmed against the real file.
- **Files modified:** src/utils/planningCenterApi.ts
- **Verification:** `npm run type-check` (`vue-tsc --build`) exits 0.
- **Committed in:** `97e5639` (Task 1 commit)

**2. [Rule 3 - Blocking] Multi-call tests needed independent mock Response instances**
- **Found during:** Task 2 (writing the E-17 and E-20 tests, which each call `addSlotAsItem` twice)
- **Issue:** `defaultFetchResponse()` sets `vi.mocked(fetch).mockResolvedValue(...)` to a single shared `Response` object. `Response.json()` can only be read once; the second `addSlotAsItem` call in each of these two tests threw `TypeError: Body is unusable: Body has already been read`.
- **Fix:** Replaced `defaultFetchResponse()` with two chained `mockResolvedValueOnce(...)` calls, each constructing its own fresh `Response`, in the E-17 and E-20 tests only.
- **Files modified:** src/utils/__tests__/planningCenterApi.test.ts
- **Verification:** Targeted test file run: 110/110 passing.
- **Committed in:** `e9c7ec5` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both were necessary for the plan's own acceptance criteria (`npm run type-check` exits 0; the targeted test file passes) to be satisfiable at all. No scope creep — the plan's stated intent (an exhaustive, compiler-guarded dispatch; a comprehensive test suite for the six owned probe edges) is fully realized; only the literal mechanics of two implementation details changed.

## Issues Encountered

None beyond the two deviations above, both resolved inline during the affected task.

## User Setup Required

None - no external service configuration required.

**Deferred owner verification added to `.planning/PENDING-VERIFICATION.md` § Phase 43 § Plan 43-02:** a real Planning Center export against live credentials, confirming three distinctly-titled items (`Announcements`, `Miscellaneous`, `Message`) appear in the actual Planning Center plan — the unit suite proves the outbound request shape, not the round trip.

## Next Phase Readiness

- `addSlotAsItem`'s dispatch is now the compiler-guarded pattern Phase 44 needs: any future `SlotKind` widening will fail `vue-tsc --build` at the exhaustiveness backstop instead of silently mislabeling an item, closing the exact trap this phase exists for.
- `npm run type-check` is 0 errors; the full app suite baseline is unchanged (2 pre-existing failing files, `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` — the render-service Vitest-version-mismatch file is out of `--dir src` scope and not part of this run).
- Accepted, recorded consequences (not defects) carried forward per the plan's threat model: T-43-04 (newlines in `body` will not render as line breaks in Planning Center's HTML display — `body` is passed verbatim by design) and T-43-10 (`ServiceEditorView.vue`'s failure-label catch block still uses raw `slot.kind` for ANNOUNCEMENTS/MISC, a cosmetic gap in a different file with no requirement covering it).
- No blockers for plan 03 (palette + editor UI, R083/R084) or plan 04 (print/share surfaces).

---
*Phase: 43-service-item-types*
*Completed: 2026-08-07*

## Self-Check: PASSED

Both modified source files present on disk (`src/utils/planningCenterApi.ts`, `src/utils/__tests__/planningCenterApi.test.ts`); both task commits (`97e5639`, `e9c7ec5`) found in git history.
