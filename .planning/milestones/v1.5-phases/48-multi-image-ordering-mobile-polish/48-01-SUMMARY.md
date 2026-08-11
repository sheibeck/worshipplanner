---
phase: 48-multi-image-ordering-mobile-polish
plan: 01
subsystem: ui
tags: [vue, intl-collator, localstorage, drag-and-drop, onboarding]

# Dependency graph
requires: []
provides:
  - "Deterministic natural-order sort on the images bucket in classifyFiles/resolveDrop (R098)"
  - "Dismissible Getting Started onboarding panel with per-device localStorage persistence (R103)"
affects: [48-02, 48-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Intl.Collator({ numeric: true, sensitivity: 'base' }) for filename natural-order sorting"
    - "Synchronous localStorage read at setup() (ref initializer, no onMounted/watcher) to avoid first-paint flash — matches CollapsibleSection.vue precedent"

key-files:
  created:
    - src/components/__tests__/GettingStarted.test.ts
  modified:
    - src/components/slides/dropRouting.ts
    - src/components/slides/__tests__/dropRouting.test.ts
    - src/components/GettingStarted.vue

key-decisions:
  - "Sort only the images bucket inside classifyFiles (not resolveDrop, not a copy) per D-098 — decks/videos/audioFiles keep drop order"
  - "GettingStarted dismiss key is flat and unscoped (wp:gettingStartedDismissed), matching CollapsibleSection.vue's precedent for per-device UI chrome rather than org/uid-scoped data"
  - "No un-dismiss UI — confirmed out of scope by 48-CONTEXT.md Deferred Ideas"

patterns-established:
  - "Store mocks in component tests use vi.fn()-returning factories (mockUseXStore.mockReturnValue) rather than raw hoisted primitives, avoiding vi.mock hoisting pitfalls"

requirements-completed: [R098, R103]

coverage:
  - id: D1
    description: "classifyFiles sorts the images bucket into filename natural order via Intl.Collator (numeric, base-sensitivity), fixing the slide10-before-slide2 defect"
    requirement: "R098"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/dropRouting.test.ts#sorts multi-image drops into filename natural order (R098)"
        status: pass
    human_judgment: false
  - id: D2
    description: "resolveDrop surfaces the same natural-order images array to its consumer"
    requirement: "R098"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/dropRouting.test.ts#surfaces the same natural order through resolveDrop.images for a scrambled multi-image drop (R098)"
        status: pass
    human_judgment: false
  - id: D3
    description: "decks/videos/audioFiles bucket order is unaffected by the images sort"
    requirement: "R098"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/dropRouting.test.ts (existing 11 pre-existing cases, all still passing)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Getting Started panel has a dismiss control that hides the panel and persists across reloads via localStorage"
    requirement: "R103"
    verification:
      - kind: unit
        ref: "src/components/__tests__/GettingStarted.test.ts#clicking the dismiss button writes wp:gettingStartedDismissed to localStorage and hides the panel"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dismiss and allDone are independent conditions — either alone hides the panel, and an already-dismissed panel never flashes before hiding"
    requirement: "R103"
    verification:
      - kind: unit
        ref: "src/components/__tests__/GettingStarted.test.ts#an already-dismissed panel hides on first render with no flash (synchronous localStorage read at setup)"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/GettingStarted.test.ts#hides the panel once allDone is true, regardless of the dismiss key"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/GettingStarted.test.ts#dismissed-but-not-allDone hides the panel — the two conditions are independent"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-08
status: complete
---

# Phase 48 Plan 01: Multi-Image Ordering + Dismissible Getting Started Summary

**Intl.Collator natural-order sort closes the slide10-before-slide2 drop defect; a synchronously-seeded localStorage flag makes the Getting Started panel dismissible per-device**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-08T19:27:55-04:00
- **Completed:** 2026-08-08T19:33:24-04:00
- **Tasks:** 2 completed
- **Files modified:** 4 (2 modified source, 1 modified test, 1 new test)

## Accomplishments
- `classifyFiles` now sorts its `images` bucket in place with `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` immediately before returning, so a scrambled multi-image drop (slide2, slide10, slide1) classifies as [slide1, slide2, slide10] instead of the lexicographic [slide1, slide10, slide2] trap — proven at both `classifyFiles` and `resolveDrop` call sites by new tests, with all 11 pre-existing `dropRouting.test.ts` cases still green (decks/videos/audioFiles order untouched).
- `GettingStarted.vue` gained a dismiss `×` control in its header (exact markup/aria-label/data-testid from 48-UI-SPEC § 5) that writes `wp:gettingStartedDismissed` to localStorage and hides the panel; the root `v-if` is now `!allDone && !dismissed`, two independent conditions that compose (either alone hides the panel).
- New `GettingStarted.test.ts` (the file did not exist before this plan) covers: default-visible baseline, dismiss-click behavior, no-flash-on-seeded-dismiss (synchronous `ref` initializer), `allDone`-true hiding regardless of dismiss state, and the dismissed-but-not-allDone independence case.

## Task Commits

Each task was committed atomically:

1. **Task 1: R098 — natural-order sort on the images bucket in classifyFiles** - `0eb4f6d` (feat)
2. **Task 2: R103 — dismissible Getting Started panel with localStorage persistence** - `c9eb070` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/components/slides/dropRouting.ts` - Added the `Intl.Collator` sort on `images` inside `classifyFiles`, tagged `R098`
- `src/components/slides/__tests__/dropRouting.test.ts` - Added scrambled-order natural-sort assertions for both `classifyFiles` and `resolveDrop`
- `src/components/GettingStarted.vue` - Added dismiss button, `dismissed` ref seeded synchronously from `localStorage`, `onDismiss` handler, updated root `v-if`
- `src/components/__tests__/GettingStarted.test.ts` - New file; mocks `@/stores/auth`, `@/stores/songs`, `@/stores/services`, `@/firebase`, and `firebase/firestore`'s `onSnapshot`/`collection` so `allDone` can be driven independently of real Firestore

## Decisions Made
- Sorted only the `images` array in place inside `classifyFiles` (never a copy, never inside `resolveDrop`) per the plan's D-098 locked decision and Pitfall 1 — `resolveDrop` reads `classified.images` from the exact same object reference.
- Used the flat, unscoped `wp:gettingStartedDismissed` localStorage key rather than an org/uid-scoped one, per the locked decision matching `CollapsibleSection.vue`'s existing precedent for per-device UI chrome.
- For the `allDone`-true test case, mocked `firebase/firestore`'s `onSnapshot` to invoke its callback synchronously with a controllable `size`, then `await nextTick()` before asserting — `onMounted`'s Firestore subscription updates a `ref` that only flushes into the DOM on the next reactivity tick, not synchronously within `mount()`.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks verbatim; no bugs, missing functionality, or blocking issues were found that required Rule 1-4 handling.

## Issues Encountered
- Initial `GettingStarted.test.ts` `allDone`-true assertion failed because `memberCount` (set inside the mocked `onSnapshot` callback during `onMounted`) hadn't flushed into the rendered template synchronously at `mount()` time. Resolved by awaiting `nextTick()` after mount before asserting — not a defect in the component, a Vue reactivity-timing detail of the test itself.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- R098 and R103 are both complete and independently verified by unit tests; neither touches any file or type shared with plans 48-02 or 48-03 (per this plan's own scoping rationale).
- Full app suite (`npx vitest run --dir src --exclude '**/rules.test.ts'`) run post-implementation: 2933/2946 passing, at the documented 2-file baseline (`src/storage.rules.test.ts` — Storage emulator cross-service `firestore.exists()` limitation, `src/views/__tests__/RosterView.test.ts` — pre-existing stale assertion). No new failures introduced.
- `npm run type-check` (`vue-tsc --build`) clean.

---
*Phase: 48-multi-image-ordering-mobile-polish*
*Completed: 2026-08-08*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commits (`0eb4f6d`, `c9eb070`) verified in git log.
