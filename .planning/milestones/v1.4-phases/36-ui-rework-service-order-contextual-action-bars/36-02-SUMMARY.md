---
phase: 36-ui-rework-service-order-contextual-action-bars
plan: 02
subsystem: ui
tags: [vue, tailwind, action-bar, testing, tdd]

requires:
  - phase: 36-01
    provides: SlideDropTarget clickable variant, SlideGrid import-button deletion (parallel wave-1 plan, no file overlap)
provides:
  - "ContextualActionBar.vue — the one shared declarative action-bar component (no state, no store access, no emits)"
  - "buildActionBarItems(tab, ctx) — pure per-tab item builder, zero Vue/Pinia/router imports"
  - "R068's data-level acceptance suite (cartesian-product leak test + table-driven gating matrix)"
affects: [36-03, 36-04, 36-05]

tech-stack:
  added: []
  patterns:
    - "Declarative ActionBarItem[] list + a single renderer component, matching SlideActionMenu.vue's 'renders a list, does not decide what's in it' precedent"
    - "Pure builder function (no framework imports) makes a gating invariant assertable via toEqual on a key array instead of DOM mounts in three places"

key-files:
  created:
    - src/components/actionBarItems.ts
    - src/components/ContextualActionBar.vue
    - src/components/__tests__/ContextualActionBar.test.ts
    - src/views/serviceEditorActionBar.ts
    - src/views/__tests__/serviceEditorActionBar.test.ts
  modified: []

key-decisions:
  - "Preserved the live (ungated) export/copy visibility over 36-UI-SPEC §3's illustrative canEditService-gated version and its E3 edge-state row — both are inaccurate against ServiceEditorView.vue:166/199. A viewer, and an editor on a locked service, keep seeing Export/Copy, exactly as today."
  - "Implemented R071's future hint as a dynamic hint-{key} slot instead of the spec's hint?: string field, so a later plan can carry a live <router-link> without dropping it."
  - "Extended ActionBarIcon with a copy member beyond the spec's union, so the relocated copy-pc button keeps its clipboard glyph."
  - "check icon renders text-green-400 uniformly, a minor color-shade compromise between the two source buttons (export-pc used text-green-500, copy-pc used text-green-400) — not asserted by any acceptance criterion, and does not change any gate or handler."

requirements-completed: [R068]

coverage:
  - id: D1
    description: "ContextualActionBar.vue renders a declarative items[] list: empty list renders zero buttons and no chrome, buttons render in array order with correct testids/disabled/title/tone/icon, disabled items block their onClick, and a hint-{key} slot only renders for a matching key"
    requirement: "R068"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ContextualActionBar.test.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildActionBarItems(tab, ctx) is pure (no Vue/Pinia/router import) and reproduces every relocated control's exact live gate/label/title/disabled/icon expression; the R068 leak invariant (Suggest All Songs / Export to PC / Copy for PC never appear on Slides or Roles) is proven over the full cartesian product of context flags, not three hand-picked cases"
    requirement: "R068"
    verification:
      - kind: unit
        ref: "src/views/__tests__/serviceEditorActionBar.test.ts (26 tests, including the cartesian-product leak test and the table-driven gating matrix)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-03
status: complete
---

# Phase 36 Plan 02: Contextual Action Bar Foundation Summary

**Pure `buildActionBarItems(tab, ctx)` builder plus the one shared `ContextualActionBar.vue` renderer, with R068's leak invariant proven as data over the full cartesian product of context flags rather than as DOM assertions in three places.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-03
- **Tasks:** 2/2
- **Files modified:** 5 (all newly created; no existing file touched)

## Accomplishments
- `src/components/actionBarItems.ts` — the `ActionBarItem`/`ActionBarTone`/`ActionBarIcon` contract, with a `copy` icon extension and a fourth `present` tone beyond 36-UI-SPEC §2's illustrative union
- `src/components/ContextualActionBar.vue` — a declarative, stateless renderer: `items: []` produces zero buttons and no chrome (31-UI-SPEC E5), every `onClick` dispatches the caller's own handler reference, and a dynamic `hint-{key}` slot lets a future plan attach R071's `<router-link>` note without a lossy string field
- `src/views/serviceEditorActionBar.ts` — `buildActionBarItems(tab, ctx)`, a pure function (zero Vue/Pinia/router imports) reproducing every relocated control's exact live gate/label/title/disabled/icon expression
- `src/views/__tests__/serviceEditorActionBar.test.ts` — the R068 acceptance suite: a leak test asserting `suggest-all-songs`/`export-pc`/`copy-pc` never appear on `slides` or `roles` across the full cartesian product of 10 boolean context flags × 3 service statuses (3,072 contexts × 2 tabs), a table-driven gating matrix asserted with `toEqual` (not `toContain`), adjacency/ordering/idempotency/concurrency/handler-identity checks

## Task Commits

Each task was committed atomically, following the plan's TDD instruction (RED then GREEN):

1. **Task 1: The ActionBarItem contract and the shared ContextualActionBar component**
   - `335730c` (test) — failing `ContextualActionBar.test.ts` against a stub component (RED, 9/9 failing)
   - `e5b2f8e` (feat) — full `ContextualActionBar.vue` implementation (GREEN, 9/9 passing)
   - `ee8f672` (fix) — `find().exists()` instead of `get().exists()`, a `vue-tsc --build` TS2339 caught by the type-check gate
2. **Task 2: The pure per-tab item builder and the R068 data-level acceptance suite**
   - `7c1ae70` (test) — failing `serviceEditorActionBar.test.ts` against a stub `buildActionBarItems` that always returns `[]` (RED, 20/26 failing)
   - `e010f41` (feat) — full `buildActionBarItems` implementation (GREEN, 26/26 passing)

**Plan metadata commit:** created after this summary (see below).

## Files Created/Modified
- `src/components/actionBarItems.ts` - `ActionBarItem`/`ActionBarTone`/`ActionBarIcon` types shared by the renderer and the builder
- `src/components/ContextualActionBar.vue` - the one shared, stateless action-bar renderer
- `src/components/__tests__/ContextualActionBar.test.ts` - 9 tests covering chrome, ordering, testids, disabled/click dispatch, title, tone, icon a11y, hint slot
- `src/views/serviceEditorActionBar.ts` - `ActionBarTab`, `ActionBarContext`, `ActionBarHandlers`, `buildActionBarItems`
- `src/views/__tests__/serviceEditorActionBar.test.ts` - 26 tests, the R068 acceptance suite

## Decisions Made
- **Preserved the live ungated export/copy gate over the spec's illustrative code.** `36-UI-SPEC.md` §3's example code and its E3 edge-state row both claim every Service Order action-bar item is `canEditService`-gated. Verified twice against `ServiceEditorView.vue:166` (Export to PC gated on `authStore.hasPcCredentials` alone) and `:199` (Copy for PC is a bare `v-else`) — neither carries `canEditService`, nor does the enclosing header div at `:97`. `buildServiceOrderItems` pushes the export/copy item unconditionally; only `suggest-all-songs` and `save` are gated on `canEditService`. This is asserted directly by two gating-matrix rows (`canEditService: false` → `['export-pc']` / `['copy-pc']`), not merely stated in a comment.
- **`hint-{key}` dynamic slot instead of a `hint?: string` field.** The spec's illustrative `ActionBarItem.hint` is a plain string, which cannot carry R071's live `<router-link>` to Settings. `ContextualActionBar.vue` renders `<slot :name="`hint-${item.key}`" />` after each item's button instead — the parent supplies its own markup (including the link and its testid), verified by this plan's own hint-slot test. `36-02` ships no hint content itself; `36-03` is where `34-12`'s note actually moves.
- **`copy` icon extension.** The spec's `ActionBarIcon` union omits a clipboard glyph even though the live `copy-pc` button renders one; added as a union member rather than dropping the icon.
- **`present` tone as a genuine fourth variant**, not force-fit into `primary`/`default` — asserted directly by a test that checks `present`'s class contains `border-indigo-400/60`/`text-indigo-300` and explicitly does NOT contain `bg-indigo-600`.
- **`check` icon color normalized to `text-green-400`.** The two source buttons used slightly different shades (export-pc: `text-green-500`, copy-pc: `text-green-400`) for the same semantic "success" checkmark; since `ActionBarIcon` is a single shared enum with no per-item color override, one had to be picked. Neither this plan's acceptance criteria nor any prior test asserts icon color, so this is a cosmetic normalization, not a gating or behavior change — flagged here for visibility rather than left silent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `find().exists()` instead of `get().exists()` in the icon a11y test**
- **Found during:** Task 1, running `npm run type-check` after the GREEN commit
- **Issue:** `@vue/test-utils`'s `.get()` already asserts existence and returns a plain `DOMWrapper` with no `.exists()` method; calling `.exists()` on its result is a TS2339 error under `vue-tsc --build` (the project's mandated type gate per CLAUDE.md — `-p tsconfig.app.json` alone would have silently missed this, per CLAUDE.md's own Phase 30 warning).
- **Fix:** Changed the assertion to `presentButton.find('[aria-hidden="true"]').exists()`, which is the correct wrapper method for an existence check.
- **Files modified:** `src/components/__tests__/ContextualActionBar.test.ts`
- **Verification:** `npm run type-check` clean; `ContextualActionBar.test.ts` still 9/9 passing.
- **Committed in:** `ee8f672`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cosmetic/type-safety fix only. No scope creep, no gate or behavior change.

## Issues Encountered
None beyond the one auto-fixed type error above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ContextualActionBar.vue` and `buildActionBarItems` are ready to be wired into `ServiceEditorView.vue` and `SlidesTab.vue` by later 36-xx plans (36-03 onward), which will thread real `canEditService`/`hasPcCredentials`/etc. state into `ActionBarContext` and mount the bar in place of the existing unconditional `v-if` buttons.
- **No existing source file was touched by this plan** — `ServiceEditorView.vue`'s header buttons and `SlidesTab.vue`'s Present wrapper remain exactly as they were; wiring them into the new bar is explicitly out of this plan's scope.
- The R071 hint content itself (the `pc-credentials-missing-note` with its live `<router-link>`) is NOT yet attached anywhere — only the `hint-{key}` slot mechanism exists. A later plan (36-03 per this plan's frontmatter) must supply that content via the slot to avoid regressing `34-12`.
- The `Roles` tab's empty action-bar list remains an open DESIGN question per `36-UI-SPEC.md` § UI Considerations (unresolved) — implemented as "expose nothing," not resolved as "correct."

---
*Phase: 36-ui-rework-service-order-contextual-action-bars*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 5 created files and all 5 referenced commit hashes verified present.
