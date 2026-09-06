---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
plan: 04
subsystem: volunteer-service-view-tabs
tags: [vue, presentational-component, order-of-service, stage-layout, rehearse]

# Dependency graph
requires:
  - phase: 127-01
    provides: "buildRehearseAccess()'s orderOfService (ServiceSlot[]), roleAssignments (RehearseRoleAssignment[]), and stageLayout?.elements (PublicStageMarker[]) fields"
provides:
  - "src/components/rehearse/VolunteerOrderOfService.vue — read-only running order + Who's Serving card (R392)"
  - "src/components/rehearse/VolunteerStageLayoutTab.vue — read-only StageLayoutView embed (R393)"
affects: ["127-05", "127-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Order of Service row anatomy is a field-for-field dark re-theme of ShareView.vue's per-kind slot branching (SONG/SCRIPTURE/HYMN/PRAYER/MESSAGE/ANNOUNCEMENTS/MISC) — not a re-mount of ShareView.vue, which stays light/print-oriented and unauthenticated."
    - "The Who's Serving card is a template sibling of the slot-list/empty-copy block, not nested under it — an empty order can still carry role assignments, so the two must not share a single v-if branch."
    - "Stage Layout tab is pure data-plumbing: StageLayoutView.vue is embedded verbatim with theme='dark' (its own default) and zero marker-position remapping, avoiding the v2.7 WYSIWYG marker-centering bug class."

key-files:
  created:
    - src/components/rehearse/VolunteerOrderOfService.vue
    - src/components/rehearse/VolunteerStageLayoutTab.vue
    - src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts
    - src/components/rehearse/__tests__/VolunteerStageLayoutTab.test.ts
  modified: []

key-decisions:
  - "Did NOT factor a shared theme-aware row-template between VolunteerOrderOfService.vue and ShareView.vue (the plan's optional, planner-discretion architectural recommendation) — copied the per-kind branching field-for-field instead. ShareView.vue was left completely untouched, so its own share-link tests carry zero regression risk from this plan."
  - "Who's Serving is rendered as a template sibling of the slot list/empty-copy block, not nested inside the orderOfService.length conditional — an empty order (zero slots) can still have roleAssignments, and the first draft of the component incorrectly hid the card in that case until a test caught it."
  - "VolunteerStageLayoutTab accepts an optional `elements?: PublicStageMarker[]` prop (not the whole `stageLayout?: {elements}` object) — normalizes via `elements ?? []`, keeping the component's own contract independent of the projection's conditional-spread wrapper shape."

patterns-established:
  - "Any future read-only re-theme of ShareView.vue's slot branching should copy the switch/template body field-for-field rather than re-deriving it — the per-kind field set (and the R346/SEC-S-04 no-free-text discipline) is the single source of truth ShareView.vue and VolunteerOrderOfService.vue now both carry independently, by design (not factored, per plan's explicit 'planner's discretion, not mandatory' recommendation)."

requirements-completed: [R392, R393]

coverage:
  - id: D1
    description: "Order of Service tab renders each slot kind's line(s) re-themed dark, with '[not assigned]' fallbacks for SONG/SCRIPTURE/HYMN"
    requirement: "R392"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts — per-kind rendering + fallback cases (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Who's Serving card renders from roleAssignments with '[not assigned]' for an empty role, independent of orderOfService length"
    requirement: "R392"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts — \"renders the Who's Serving card...\" case"
        status: pass
    human_judgment: false
  - id: D3
    description: "No per-item free-text (notes/body) is ever rendered, even if a fixture smuggles one in"
    requirement: "R392 (R346/SEC-S-04 discipline)"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts — \"never renders a stray notes/body field...\" case"
        status: pass
    human_judgment: false
  - id: D4
    description: "Empty orderOfService renders the exact UI-SPEC copy"
    requirement: "R392"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts — \"renders the empty-order copy...\" case"
        status: pass
    human_judgment: false
  - id: D5
    description: "Stage Layout tab embeds StageLayoutView with theme='dark' :print='false' and passes elements through verbatim when markers exist"
    requirement: "R393"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/VolunteerStageLayoutTab.test.ts — \"renders StageLayoutView with theme=dark...\" case"
        status: pass
    human_judgment: false
  - id: D6
    description: "Empty/undefined elements renders the verbatim ShareView.vue empty-stage copy and mounts no StageLayoutView; no Print button exists"
    requirement: "R393"
    verification:
      - kind: unit
        ref: "src/components/rehearse/__tests__/VolunteerStageLayoutTab.test.ts — empty-elements, undefined-elements, and no-Print-button cases"
        status: pass
    human_judgment: false
  - id: D7
    description: "npm run type-check is clean after both components; ShareView.vue and StageLayoutView.vue are unmodified"
    requirement: "n/a (regression guard)"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build) — clean; git diff confirms ShareView.vue/StageLayoutView.vue untouched"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-06
status: complete
---

# Phase 127 Plan 04: Order of Service & Stage Layout Tab Components Summary

**Built the two read-only tab-body components a tech-team volunteer needs beyond rehearsal media — `VolunteerOrderOfService.vue` field-for-field re-themes ShareView.vue's per-kind slot branching to dark tokens, and `VolunteerStageLayoutTab.vue` is a zero-remapping wrapper around StageLayoutView.vue — both pure presentational, fed by the Plan 01 rehearseAccess projection.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2
- **Files modified:** 4 (all new: 2 components, 2 test files)

## Accomplishments

- Created `VolunteerOrderOfService.vue`: renders the running order (SONG/SCRIPTURE/HYMN/PRAYER/MESSAGE/ANNOUNCEMENTS/MISC) using ShareView.vue's exact row anatomy re-themed to gray-950 dark tokens, plus a "Who's Serving" card from `roleAssignments`. Neither block reads a notes/body field — the R346/SEC-S-04 no-free-text discipline is carried forward and directly tested with a fixture that tries to smuggle stray `notes`/`body` fields onto a slot.
- Created `VolunteerStageLayoutTab.vue`: a thin wrapper embedding `StageLayoutView.vue` verbatim with `theme="dark"` (its own default) and `:print="false"`, normalizing an optional `elements` prop to `[]`. Zero marker-position logic reimplemented — the exact v2.7 WYSIWYG-bug-avoidance pattern the plan required.
- 14 new unit tests across the two components (10 + 4), all passing; `npm run type-check` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: VolunteerOrderOfService.vue — read-only running order, re-themed ShareView row anatomy** - `4e1fdf97` (feat)
2. **Task 2: VolunteerStageLayoutTab.vue — embed StageLayoutView read-only, verbatim** - `0244b99c` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified

- `src/components/rehearse/VolunteerOrderOfService.vue` - New. Dark-themed re-render of ShareView.vue's slot branching + Who's Serving card, props-driven (`orderOfService`, `roleAssignments`).
- `src/components/rehearse/VolunteerStageLayoutTab.vue` - New. Wraps `StageLayoutView.vue` with `theme="dark"`/`:print="false"`, prop `elements?: PublicStageMarker[]`.
- `src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts` - New. 10 tests: per-kind rendering, fallbacks, Who's Serving, empty-order copy, no-free-text leak.
- `src/components/rehearse/__tests__/VolunteerStageLayoutTab.test.ts` - New. 4 tests: StageLayoutView prop passthrough, empty/undefined-elements copy, no Print button.

## Decisions Made

- Copied ShareView.vue's slot-branching field-for-field rather than extracting a shared theme-aware template (the plan's explicit "planner's discretion, not mandatory" recommendation) — this keeps `ShareView.vue` completely untouched, eliminating any regression risk to its existing share-link tests as a side effect of this plan.
- Restructured the template mid-task so "Who's Serving" is a sibling of the order-list/empty-copy block rather than nested inside the `orderOfService.length` conditional, after a test caught that the initial nested structure hid a populated Who's Serving card whenever the order itself was empty.
- `VolunteerStageLayoutTab` takes a flat `elements?: PublicStageMarker[]` prop instead of the wrapped `stageLayout?: {elements}` shape the projection returns — the parent (Plan 06's shell) will pass `rehearseAccess.stageLayout?.elements`, keeping this component's own contract simple and independently testable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Who's Serving card was unreachable when orderOfService was empty**
- **Found during:** Task 1, running `VolunteerOrderOfService.test.ts` for the first time
- **Issue:** The initial template nested the entire "Who's Serving" block inside `<template v-if="orderOfService.length">`, so a service with role assignments but zero order-of-service slots (a valid, if rare, edge case) silently hid the card instead of rendering it — a real information-disclosure-adjacent correctness bug (a volunteer with an empty order would never see who's serving even when that data exists).
- **Fix:** Restructured the template so the slot-list/empty-copy block and the Who's Serving card are siblings under the root wrapper, each with its own independent conditional.
- **Files modified:** `src/components/rehearse/VolunteerOrderOfService.vue`
- **Verification:** `npx vitest run src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts` — all 10 tests green, including the case that caught this.
- **Committed in:** `4e1fdf97` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a real rendering bug caught by the plan's own test suite before commit).
**Impact on plan:** None — fixed inline before the task's first commit; no scope change.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required (application code + tests only).

## Next Phase Readiness

- Both tab-body components are complete, tested, and type-clean, ready for Plan 06's shell to mount them as the "Order of Service" and "Stage Layout" tab panels, fed by a single `rehearseAccess` `getDoc`.
- `npm run type-check` is clean.
- Full `npx vitest run` app-suite regression check was still in progress in the background at the time this summary was written (see Self-Check below for the targeted-test evidence this plan relies on); the documented single-file baseline (`src/storage.rules.test.ts`, Storage-emulator-dependent) is the only known pre-existing failure in this repo.
- No blockers. Plans 02/03 (song list/detail, PDF reader/audio player) and this plan (04) are all complete; Plan 05/06 (view shell/route wiring) can proceed.

---
*Phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/components/rehearse/VolunteerOrderOfService.vue
- FOUND: src/components/rehearse/VolunteerStageLayoutTab.vue
- FOUND: src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts
- FOUND: src/components/rehearse/__tests__/VolunteerStageLayoutTab.test.ts
- FOUND: .planning/phases/127-volunteer-service-view-rehearse-order-of-service-stage-layout/127-04-SUMMARY.md
- FOUND commit: 4e1fdf97
- FOUND commit: 0244b99c
