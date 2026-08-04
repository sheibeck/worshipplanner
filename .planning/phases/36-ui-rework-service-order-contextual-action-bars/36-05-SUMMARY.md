---
phase: 36-ui-rework-service-order-contextual-action-bars
plan: 05
subsystem: ui
tags: [vue, tailwind, service-order, testing, phase-gate]

requires:
  - phase: 36-04
    provides: "Section-band headers with slide count and per-band ＋ Add item chip row; addSlot(kind, vwType?, targetSection?)"
provides:
  - "The bottom-of-list add control rebuilt as a single-state dashed chip row (data-testid=\"add-to-service-palette\"), replacing the Add Element dropdown, its click-away backdrop and its showAddMenu ref"
  - "A dedicated Service Order preservation sweep proving drag-reorder, section-select, remove, the scripture editor, the sermon-context inputs, the teams row, the lock banner and the save-status bar (34-10) all survived the 36-01..36-05 rebuild"
  - "A dedicated locked/viewer sweep proving every write affordance introduced or moved by Phase 36 is absent for a non-editor, while band labels/counts stay visible"
  - "The Phase 36 gate: type-check, full app suite, and production build, run and recorded honestly, including a documented environment-only discrepancy in the mandated test invocation"
affects: []

tech-stack:
  added: []
  patterns:
    - "Single-state (no open/closed) chip row for a bottom-of-list add control — matches the per-band chip row 36-04 already established, both narrowed to the 5 SlotKind values addSlot supports"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "R053/ROADMAP criterion 4 is recorded as satisfied in INTERACTION PATTERN ONLY, not upgraded to a clean pass. ＋ Add slide stays grid-local per 36-UI-SPEC's Finding 2 discretionary call (wireframe-backed); the 'Add music to this group' clause was separately superseded by owner UAT finding F2, already dated and evidenced in REQUIREMENTS.md (R053) and ROADMAP.md. Both corrections were pre-existing before this plan; this plan only re-confirms and does not touch them."
  - "The mandated gate command `npx vitest run --dir src` picked up a third failing file (src/rules.test.ts) in this environment — not a code regression. Diagnosed and documented rather than silently worked around or waved through: see 'Phase Gate Results' below."
  - "The D-14 slot-delete confirmation dialog (Teleport to body) required `teleport: false` in the preservation-sweep's mountView stubs to drive the per-row remove control behaviourally (click Remove, then confirm) rather than merely asserting the trigger button's existence."

requirements-completed: [R067]

coverage:
  - id: D1
    description: "The bottom-of-list add control is rebuilt as a single-state dashed chip row (add-to-service-palette) with exactly 5 chips (palette-add-song/scripture/prayer/message/hymn) in order, each calling addSlot with the same arguments the dropdown entry it replaces used; the dropdown, its click-away backdrop, and showAddMenu are all deleted"
    requirement: "R067"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — describe('ServiceEditorView - add-to-service palette (36-05, R067)'), 11 tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "R067 edge/idempotency: clicking a palette chip twice with no intervening open/close appends exactly two slots; the palette has no open/closed state and its chips are clickable immediately after mount"
    requirement: "R067"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — 'clicking palette-add-prayer twice, with no intervening open/close, appends exactly two slots'; 'the palette chips are queryable and clickable immediately after mount, with no prior interaction'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Service Order preservation sweep: drag-reorder's Sortable config, per-row section-select (behavioural move + reorder), per-row remove (behavioural, through the D-14 confirm dialog), the teams checkbox / sermon topic / sermon passage writes, the scripture slot editor, the lock banner, and 34-10's save-status chrome-strip-at-idle all still work after the rebuild"
    requirement: "R067"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — describe('ServiceEditorView - Service Order preservation sweep (36-05, R067)'), 9 tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "Locked service and viewer: none of add-to-service-palette, section-add-item-*, section-add-menu-* renders, and no Save button renders, while band labels and counts still do"
    requirement: "R067"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — describe('ServiceEditorView - Service Order locked/viewer sweep — write affordances absent, view stays (36-05, R067)'), 2 tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase gate: npm run type-check (vue-tsc --build) zero errors; npm run build succeeds; the app suite's failing-file set matches the documented 2-file baseline (src/storage.rules.test.ts, src/views/__tests__/RosterView.test.ts) once the emulator-dependent, normally-excluded src/rules.test.ts is filtered — see Phase Gate Results for the exact commands and the documented discrepancy in the plan's literally-mandated invocation"
    requirement: "R067"
    verification:
      - kind: other
        ref: "npm run type-check; npm run build; npx vitest run --dir src --exclude '**/rules.test.ts' (2430 passed / 1 failed / 8 skipped, 2 files failed)"
        status: pass
    human_judgment: false

duration: ~65min
completed: 2026-08-04
status: complete
---

# Phase 36 Plan 05: Add-to-Service Palette, the Preservation Sweep, and the Phase Gate Summary

**The bottom-of-list Add Element dropdown is rebuilt as a single-state dashed chip row (5 always-clickable chips, no open/closed state), a dedicated behavioural sweep proves the whole Service Order tab lost nothing across 36-01..36-05, and the phase closes with a clean type-check, a clean build, and the app suite at its documented 2-file baseline — with one environment-only gate-command discrepancy found and disclosed rather than smoothed over.**

## Performance

- **Duration:** ~65 min
- **Completed:** 2026-08-04
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- `ServiceEditorView.vue`'s Add Element trigger button, its click-away backdrop, and its floating dropdown panel are replaced by a single dashed-border row (`data-testid="add-to-service-palette"`) with five always-visible chips (`palette-add-song/scripture/prayer/message/hymn`), each calling the exact same `addSlot(kind, vwType?)` the dropdown entry it replaces called — no third argument, so the bottom palette keeps today's inherit-from-last-slot behaviour, byte-identical to before.
- `showAddMenu` (the dropdown's open-state ref) is deleted, along with the line inside `addSlot` that reset it — both landed in the same commit, confirmed by `grep -v '^\s*//' src/views/ServiceEditorView.vue | grep -c 'showAddMenu'` returning 0.
- Three pre-existing tests that located the add control by its old "Add Element" label/menu-item text are updated to the new `palette-add-*` testids — moved-and-restyled-control edits; `addSlot`'s logic and every argument it receives are unchanged. A new 11-test describe block covers the plan's full acceptance-criteria matrix: chip order/labels, no old-label leakage, no click-away backdrop, exact vw-type/section on a created `SONG` slot (deep-equal minus `id`/`position`), each of the other four kinds, double-add idempotency, no import entry, and viewer/locked absence.
- A dedicated 9-test **Service Order preservation sweep** describe block drives, behaviourally rather than by existence check alone: drag-reorder's Sortable `draggable: '.slot-item'` config; a real section-select move that reorders the array section-major; a per-row remove through the D-14 confirm dialog that actually decreases `localService.slots.length`; the teams checkbox, sermon topic input, and sermon passage `ScriptureInput` all writing to `localService`; the scripture slot's own `ScriptureInput`; the lock banner; and 34-10's `service-save-status-bar` rendering with no chrome classes at idle — re-asserted at phase close, not merely trusted from an earlier plan.
- A second, 2-test **locked/viewer sweep** proves every write affordance introduced or moved across Phase 36 (`add-to-service-palette`, `section-add-item-*`, `section-add-menu-*`, `Save`) is absent for a locked service and for a viewer, while all five band headers/labels/counts stay visible — "removed, not disabled," the pattern this file already uses for every other write control.
- Phase gate run and recorded honestly (see below): `npm run type-check` clean, `npm run build` succeeds, and the app suite's failing-file set matches the documented 2-file baseline once a pre-existing, environment-only gate-command discrepancy is accounted for.

## Task Commits

Each task was committed atomically:

1. **Task 1: The dashed palette row replaces the bottom add-element dropdown** - `8a9259d` (feat)
2. **Task 2: Service Order preservation sweep and the phase gate** - `9e8f48c` (test)

**Plan metadata:** (this commit, following)

## Files Created/Modified

- `src/views/ServiceEditorView.vue` — the Add Element dropdown block replaced by the `add-to-service-palette` chip row; `showAddMenu` ref and its reset line deleted
- `src/views/__tests__/ServiceEditorView.test.ts` — 3 moved-control edits (old-label assertions → palette testids); 3 new describe blocks (`add-to-service palette`, `Service Order preservation sweep`, `Service Order locked/viewer sweep`), 22 new tests total

## Decisions Made

See `key-decisions` in the frontmatter above — summarized:

1. **ROADMAP criterion 4 is recorded as satisfied in interaction pattern only, not upgraded.** `＋ Add slide` stays grid-local (36-UI-SPEC Finding 2's wireframe-backed discretionary call); the "Add music to this group" clause was separately superseded by owner UAT finding F2. Both corrections are pre-existing, dated, and evidenced in `REQUIREMENTS.md` (R053) and `ROADMAP.md` — this plan re-confirms the framing and does not touch either file.
2. **A gate-command discrepancy was found and disclosed, not silently worked around.** See "Phase Gate Results" below.
3. **The D-14 confirm dialog required `teleport: false`** in the preservation sweep's `mountView` stubs to drive the remove control behaviourally end-to-end.

## Phase Gate Results

### `npm run type-check` (the mandated `vue-tsc --build` gate — not the narrower `-p tsconfig.app.json` form)

**Clean. Zero errors.**

### `npm run build`

**Succeeds** (`✓ built in 34.24s`). Standard chunk-size warnings only (`ServiceEditorView` 282KB, `index` 509KB) — pre-existing, unrelated to this plan.

### App suite — run exactly as the plan mandates, then a documented follow-up

**As literally invoked (`npx vitest run --dir src`):** `3 failed | 79 passed (82)` test files, `1 failed | 2430 passed | 98 skipped (2529)` tests. The three failing files: `src/rules.test.ts`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`.

**This is a three-file failing set, not the documented two-file baseline — and it needed investigating rather than reporting flat, because a silent third failure is exactly what this plan's own gate exists to catch.** Investigation, in order:

1. `src/rules.test.ts` failed at `beforeAll`/`afterAll` with `ECONNREFUSED 127.0.0.1:8080` — a live Firestore emulator is required and none is running in this environment (`netstat -an | grep 8080` confirms no listener). This is expected and consistent with CLAUDE.md's own description of `npm run test:rules` needing its own emulator.
2. But `src/rules.test.ts` is supposed to be **excluded** from this run — `vite.config.ts`'s `test.exclude` lists `'src/rules.test.ts'` for exactly this reason (CLAUDE.md: *"npx vitest run — the app suite. Excludes src/rules.test.ts"*). Confirmed: a bare `npx vitest list` (no `--dir`) does correctly exclude it (0 matches).
3. But a bare `npx vitest list` (no `--dir`, no filter arguments at all) **also** picks up `render-service/src/render.test.ts` and fails to even collect it — the same cross-project contamination CLAUDE.md documents for `npx vitest run src/`, except it turns out to reproduce with **zero** positional arguments too, not only the `src/` form CLAUDE.md names. This is why `--dir src` exists as this project's convention.
4. So: `--dir src` avoids the render-service contamination, but has its own side effect — it changes the base path Vitest resolves relative `exclude` globs against, so the pattern `'src/rules.test.ts'` (written relative to the repo root) no longer matches once the root is `src/`. `npx vitest list --dir src` shows `src/rules.test.ts`'s 90 test names present; `npx vitest list` (bare) shows 0. **Both project-documented invocations have a real, independently-reproducible defect in this environment — one leaks a sibling project's incompatible test file in, the other leaks the emulator-dependent rules suite in.**
5. Re-running with an explicit basename-glob exclude that survives the `--dir` path-rebase — `npx vitest run --dir src --exclude '**/rules.test.ts'` — produces exactly the documented baseline: **`2 failed | 79 passed (81)` files, `1 failed | 2430 passed | 8 skipped (2439)` tests**, failing files `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` only. Test/pass counts otherwise match the `--dir src` run exactly (2430 passed either way) — the only difference is the 90 emulator-dependent `rules.test.ts` cases being correctly excluded rather than erroring at `beforeAll`.

**Conclusion: the failing-file set matches the documented 2-file baseline.** The third failure in the literal `--dir src` invocation is an environment/tooling artifact (no Firestore emulator + a `--dir`/relative-exclude-pattern interaction), not a defect introduced by this plan's `ServiceEditorView.vue`/`ServiceEditorView.test.ts` changes. This is disclosed here in full rather than either (a) reporting the literal 3-file result as if it were a real regression this plan owns, or (b) silently re-running with a fix and reporting only the clean number. **Not fixed in code** — `vite.config.ts` is out of this plan's `files_modified` scope and the fix (if one is wanted) is a project-tooling decision, not a Service Order behavior change.

## Preservation Sweep — the four things asserted still hold

1. **34-10's save-status chrome-strip.** `service-save-status-bar` renders for an unlocked editor with `classes()` equal to `[]` at idle — re-asserted directly in this plan's own preservation-sweep describe block, not merely inherited from 36-03's guard.
2. **34-12's R071 no-credentials note.** Not touched by any file this plan modifies (lives in `ContextualActionBar`'s `hint-copy-pc` slot, 36-02/36-03 territory) — its pre-existing describe block passes unmodified in the full run.
3. **The real export/copy visibility.** Not touched by this plan (36-02/36-03 territory) — a viewer and a locked editor still see Export/Copy in the action bar, per the pre-existing (unmodified) tests.
4. **Phase 34's congregational modal.** Not touched by any file this plan modifies — its pre-existing WR-04/34-07 describe blocks pass unmodified.

## Deferred / Deliberately Unresolved — carried forward, not closed by this plan

1. **The Roles tab's action-bar slot.** Still an open DESIGN question (36-UI-SPEC § UI Considerations, `unresolved`) — the bar renders zero items for Roles, which is this codebase's own choice, not a wireframe-confirmed design. Not touched by this plan.
2. **The row-level `⋯` kebab and the assigned-song `Change` link.** Both appear in the wireframe with no drawn behaviour and no current-code equivalent (36-UI-SPEC Finding 4 item 6). Explicitly not implemented across the whole phase — no menu was invented for the kebab, no non-destructive song-swap flow was invented for `Change`.
3. **R069's edge cases.** Only the rendered tab-button order was built (Service Order · Slides · Roles). Deep links to a tab, keyboard tab-cycling order, and persistence of the active tab across reloads are unspecified in every source artifact and were not invented (recorded in 36-03-SUMMARY.md's "Next Phase Readiness," carried forward here unresolved).

## Phase 34's Open Human-Verification Items — untouched, confirmed

`.planning/PENDING-VERIFICATION.md` was not edited by this plan — confirmed by `git status --short` showing no change to that file at any point during execution. Items **34.1** (empirical scripture-split determinism, needs live Anthropic API), **34.3** (the now-reachable congregational-reading feature end to end), **34.4** (background scrim legibility on a real projector), **34.5** (the merged group-media panel reading as one panel), and **34.6** (the org document's actual PC credential fields) all remain **☐ not yet verified** — none marked passed, resolved, or self-approved by this plan, per the standing autonomy grant's explicit limit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The preservation sweep's per-row remove test needed the D-14 confirm dialog driven through, not just the trigger clicked**
- **Found during:** Task 2, writing the "per-row remove control" test
- **Issue:** `removeSlot(index)` opens a Teleport-to-body confirmation dialog (D-14) rather than removing the slot immediately; the test's first draft asserted the wrong post-click state (length unchanged, not decremented) because it never confirmed the dialog.
- **Fix:** Added `teleport: false` to the sweep's `mountView` stub config and a `body()` helper (`new DOMWrapper(document.body)`) matching the existing pattern this file already uses elsewhere for the same dialog; the test now clicks Remove, confirms via the Teleported dialog's own "Remove" button, then asserts the decrement.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** Test passes; full file suite (234 tests) green.
- **Committed in:** `9e8f48c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, test-infrastructure only — no source behavior change)
**Impact on plan:** No scope creep. The gate-command discrepancy documented under "Phase Gate Results" above is a **finding**, not a deviation — no code was changed to work around it; it is disclosed for the record and left to a future tooling decision.

## Issues Encountered

The `npx vitest run --dir src` gate-command discrepancy (see "Phase Gate Results") — investigated fully, root-caused, and disclosed rather than either accepted at face value or silently corrected without explanation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 36 is code-complete.** All five plans (36-01..36-05) landed; `npm run type-check` clean, `npm run build` succeeds, and the app suite matches its documented 2-file baseline exactly (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`).
- **ROADMAP criterion 4** stays recorded as satisfied in interaction pattern only (not visual unification), per the dated corrections already in `REQUIREMENTS.md`/`ROADMAP.md` — no further action needed from this plan.
- **Consider revisiting the `--dir src` / relative-`exclude` interaction** documented above as a project-tooling item (not urgent — the workaround `--exclude '**/rules.test.ts'` is known and documented here) so future phases' gate commands don't need to rediscover it.
- Phase 34's five open human-verification items (`PENDING-VERIFICATION.md` 34.1, 34.3-34.6) remain open, unaffected by this phase, awaiting the owner's return.

---
*Phase: 36-ui-rework-service-order-contextual-action-bars*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 3 referenced files (`ServiceEditorView.vue`, `ServiceEditorView.test.ts`, this SUMMARY) verified present on disk; both task commits (`8a9259d`, `9e8f48c`) verified present in `git log`.
