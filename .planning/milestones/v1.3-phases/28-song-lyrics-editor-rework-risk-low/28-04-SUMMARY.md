---
phase: 28-song-lyrics-editor-rework-risk-low
plan: 04
subsystem: songs
tags: [vue, pinia, vitest, tailwind]

# Dependency graph
requires:
  - phase: 28-song-lyrics-editor-rework-risk-low
    provides: "28-01's pure pool/order helpers (buildSectionRows, normalizeLyricOrder) rendered through here without re-implementing ordering logic; 28-02's single order source (SongLyrics.performanceOrder) as the only thing this editor reads/writes"
provides:
  - "SongLyricEditor.vue rebuilt as option 2a's single ordered section-card list: one scroll region, rows numbered 1..N, collapsible, repeats rendered as linked read-only rows with no second edit point"
  - "SongSlideOver.vue's Lyrics tab is a non-scrolling flex column mounting only the editor — version history moved from a third stacked block into the editor's own History disclosure"
  - "Autosave writes sections and performanceOrder together in one updateCurrentLyrics call; a load-time repair (normalizeLyricOrder healing a stale reference) is persisted through that same path, an already-normalised document produces no write"
affects: [28-05, 28-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static, fully-spelled-out Tailwind class maps selected via a small function (ROW_CARD_CLASSES/LABEL_CHIP_CLASSES + rowCardClass()), mirroring SongSlideOver.vue's existing vwTypeClasses pattern — avoids Tailwind v4 purging runtime-built class strings"
    - "Reactive pool/order editable state, deep-copied from a normalizeLyricOrder seed, with rows derived via a computed over buildSectionRows keyed on rowKey (never sectionId, since a repeat shares a section id across two rows)"

key-files:
  created: []
  modified:
    - src/components/SongLyricEditor.vue
    - src/components/SongSlideOver.vue
    - src/components/__tests__/SongLyricEditor.test.ts
    - src/components/__tests__/SongSlideOver.test.ts

key-decisions:
  - "Split the rewrite into two true TDD passes matching the plan's two tasks: Task 1 built the shell (header/scroll-region/history disclosure) with a `section-rows` placeholder and a stubbed autosave path; Task 2 replaced the placeholder with the real buildSectionRows-derived row list, the real pool/order editable state, and the real dirty check. Both passes ran RED (tests written and confirmed failing) before GREEN (implementation)."
  - "Dropped the CCLI copyright display block that the pre-rework editor rendered (title/authors/copyright lines/CCLI numbers). It is not part of option 2a's design (docs/design/slides-tab.dc.html Turn 2) and the plan's interfaces block does not list it among what 2a draws. Out of scope for this rewrite; not restored."
  - "Load-time repair is persisted by calling the same doAutoSave() function the debounced autosave uses, directly from the seeding watcher, gated on the same isDirty check — rather than relying on useAutoSave's own watcher (whose first-invocation-suppression guard, unchanged from the pre-existing composable, would otherwise silently swallow a load-time repair). This satisfies the plan's requirement without modifying useAutoSave.ts, which is shared with other editors."
  - "'Save Version' now snapshots the live editableState (pool + order) instead of the stale loaded document, since editing now happens against editableState rather than a flat per-index array."

requirements-completed: [R035, R018]

coverage:
  - id: D1
    description: "The Lyrics tab has exactly one scrolling element; the editor's header and closing note live outside/inside it correctly, and SongSlideOver's own Lyrics-tab panel contributes zero scroll containers of its own."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#has exactly one scrolling element, and the header and closing note live outside it"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts#renders the Lyrics tab as a non-scrolling flex column with no scroll wrapper of its own"
        status: pass
    human_judgment: false
  - id: D2
    description: "The row list IS the slide order: rows render in performanceOrder sequence, numbered 1..N, with a repeat marked, naming the row position it follows, and carrying the linked marker."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#renders rows in order, numbered 1..N, with the repeat marked and naming the position it follows"
        status: pass
    human_judgment: false
  - id: D3
    description: "A collapsed row summarises its section (label, words preview, line count); an expand/collapse control toggles between that summary and an editable multi-line field."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#a collapsed row shows its label, a words preview, and its line count"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#expanding a row reveals an editable field; collapsing returns the one-line summary"
        status: pass
    human_judgment: false
  - id: D4
    description: "Editing a section referenced twice (D-02) updates the words shown by both its ordinary row and its repeat row; the repeat row's expanded view is read-only with no second edit point."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#editing a section that appears twice changes the words shown by BOTH rows (D-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Autosave writes sections and performanceOrder together in one call (T-28-12); a load-time repair from normalizeLyricOrder is persisted through that same path, and an already-normalised document produces no write on open."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#after an edit settles, the lyrics document is updated once with sections and performanceOrder together"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#drops a stray order entry with no pooled section, and persists the repair via the same autosave path"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#a document already satisfying the pool/order invariants triggers no write on open"
        status: pass
    human_judgment: false
  - id: D6
    description: "Version history moved from a third stacked block below the editor into the editor's own History control: hidden until activated, reveals the version list on activation, restoring a version calls the store's revert action, and Save Version lives inside that panel."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#history list is not rendered until activated, and activating it reveals the list"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#choosing to restore a version from the history panel calls the store revert action"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#the \"Save Version\" action lives inside the history panel and calls saveLyrics"
        status: pass
    human_judgment: false
  - id: D7
    description: "Phase 26's Edit-in-song link still opens SongSlideOver on the Lyrics tab, and the Details tab is unaffected by the rewrite."
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongSlideOver.test.ts — 'SongSlideOver — opening tab (initialTab prop)' describe block (unchanged, still 7/7 pass); 'SongSlideOver — save' describe block (unchanged, still 4/4 pass)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-07-28
status: complete
---

# Phase 28 Plan 04: Single-scroll-region editor with a numbered, collapsible section row list Summary

**Rebuilt `SongLyricEditor.vue` as option 2a's one-list surface — a single `overflow-y-auto` region holding numbered, collapsible section-card rows derived from 28-01's `buildSectionRows`/`normalizeLyricOrder`, repeats rendered as linked read-only rows, and autosave now writing `sections`+`performanceOrder` together in one call — while `SongSlideOver.vue`'s Lyrics tab dropped its own scroll wrapper and moved version history behind the editor's own History control.**

## Performance

- **Duration:** ~35 min (implementation + TDD cycles); full-suite verification run added ~15 min of wall-clock wait
- **Completed:** 2026-07-28
- **Tasks:** 2
- **Files modified:** 2 components, 2 test files (no files created or deleted)

## Accomplishments

- **Task 1 — one scroll region, header outside it:** `SongSlideOver.vue`'s Lyrics tab panel changed from a scrolling `overflow-y-auto` block holding both the editor and a separately-mounted `LyricVersionHistory` into a non-scrolling `flex-1 min-h-0 flex-col` mounting only `SongLyricEditor`. `SongLyricEditor.vue`'s own shell was rebuilt: a non-scrolling header (title, "this order is the slide order" note, autosave status, `Paste lyrics`/`History` buttons) sits outside a single `lyrics-scroll-region` element — the only element in the whole Lyrics tab declaring vertical overflow. Version history and its revert handler moved out of `SongSlideOver.vue` entirely and into a hidden-until-activated History disclosure inside the editor, with `Save Version` moved into that same panel.
- **Task 2 — the ordered row list:** A reactive `editableState` (pool of sections + `performanceOrder`) is seeded on load by running the document through 28-01's `normalizeLyricOrder` and deep-copying the result, so the component never mutates store state. Rows are derived with a computed calling `buildSectionRows`, keyed on `rowKey` (not `sectionId`, since a repeat shares a section id with its origin row). Ordinary rows collapse to a one-line label/preview/line-count summary and expand to a monospace textarea bound to the pooled section's `lines`; repeat rows render muted with a repeat glyph, name the row position they follow, carry a `linked` marker, and expand to read-only shared text with no second edit point. Editing writes to the pooled section once, so both an ordinary row and its repeat update from a single edit (D-02) — proven by a cross-row propagation test, not just an internal-state assertion.
- Autosave (`useAutoSave`) now writes `sections` and `performanceOrder` together in one `updateCurrentLyrics` call (T-28-12). A load-time repair (e.g. a stray `performanceOrder` entry with no pooled section) is persisted through that same `doAutoSave` path, gated on the same `isDirty` check that governs regular edits; an already-normalised document produces no write on open.
- Row and label-chip styling select from static, fully-spelled-out class maps (`ROW_CARD_CLASSES`, `LABEL_CHIP_CLASSES`) via a small function, mirroring `SongSlideOver.vue`'s existing `vwTypeClasses` pattern — no class names assembled from runtime fragments, per the Tailwind v4 purge constraint that has shipped as a bug twice in this codebase.
- Dropped the pre-rework editor's CCLI copyright display block (title/authors/copyright lines/CCLI numbers) — not part of option 2a's design and not listed in the plan's interfaces block. Documented as an intentional scope decision below, not a regression.

## Task Commits

Each task followed RED → GREEN (TDD):

1. **Task 1: One scroll surface — the tab panel stops scrolling and the editor owns the region**
   - `43d525c` (test) — failing tests for the single-scroll-region shell
   - `d2169a7` (feat) — implementation: 28/28 tests pass, type-check 0
2. **Task 2: The ordered row list — numbering, collapse, repeats, and one edit point per section**
   - `3266f98` (test) — failing tests for the row list/edit/autosave behavior
   - `b14d0f2` (feat) — implementation: 36/36 tests pass, type-check 0

## Files Created/Modified

- `src/components/SongLyricEditor.vue` — Rebuilt: non-scrolling header, single `lyrics-scroll-region`, history disclosure (Save Version + `LyricVersionHistory`), and the numbered/collapsible/repeat-aware row list rendered via `buildSectionRows` over a `normalizeLyricOrder`-seeded reactive pool/order state. Autosave writes `sections`+`performanceOrder` together; a load-time repair is persisted via the same path.
- `src/components/SongSlideOver.vue` — Lyrics tab panel is now a non-scrolling `flex-1 min-h-0 flex-col` mounting only `SongLyricEditor`. `LyricVersionHistory` import/usage and the `onRevertVersion` handler removed (moved into the editor); the now-unused `songLyrics` store import/instance removed. Tab bar, `initialTab` prop/watch (Phase 26's link contract), and the Details tab are untouched.
- `src/components/__tests__/SongLyricEditor.test.ts` — Rewritten against the new shell and row-list contract: header actions, single-scroll-region assertion, history disclosure/revert/save-version, row numbering/ordering/repeat-marking, collapsed-row summary, expand/collapse toggling, D-02 cross-row propagation, closing-note count, single-call autosave, load-time repair persistence, and no-write-when-clean.
- `src/components/__tests__/SongSlideOver.test.ts` — Removed the now-unused `songLyrics`/`LyricVersionHistory` mocks (version history moved into the stubbed-out editor); added a regression test asserting the Lyrics tab panel itself declares no vertical-overflow class (SongSlideOver's own contribution to the "exactly one scroll region" property is zero, verified compositionally with the real editor's own single-scroll-region test).

## Decisions Made

- **Two true TDD passes, matching the plan's two tasks.** Task 1 built the shell with an honest placeholder for the row list (`section-rows` empty container, a no-op `doAutoSave`, `isDirty` always `false`) — exactly what the plan's action text describes ("for now it holds a placeholder container the row list will render into"). Task 2 replaced that placeholder wholesale with the real pool/order state and row derivation. Both tasks had their tests written and confirmed RED before the corresponding GREEN implementation commit.
- **Dropped the CCLI copyright display.** The pre-rework editor rendered title/authors/copyright lines/CCLI numbers below the section list. Option 2a's mockup (`docs/design/slides-tab.dc.html`, Turn 2) does not draw this, and the plan's interfaces block enumerates exactly what 2a draws without mentioning it. Treated as in-scope simplification per the plan's literal rewrite instruction rather than a regression to fix; noted here for visibility rather than silently dropped.
- **Load-time repair persisted via a direct `doAutoSave()` call, not via `useAutoSave`'s own watcher.** `useAutoSave` suppresses its watcher's first invocation (an existing, unmodified guard shared by other editors) — which would otherwise swallow a repair detected on the very first load. The seeding watcher explicitly checks `isDirty` after seeding and calls `doAutoSave()` directly when needed, using the identical write shape (`sections`+`performanceOrder` together) the regular autosave path uses. `useAutoSave.ts` itself was not touched, since it's shared infrastructure outside this plan's file list.
- **`Save Version` now snapshots `editableState`, not the stale loaded document** — necessary because editing happens against the reactive pool/order state introduced in Task 2, not a flat per-index array as before.

## Deviations from Plan

None beyond the copyright-display scope decision documented above (not a Rule 1-3 auto-fix; a literal-rewrite scope call, documented for visibility). No architectural changes, no Rule 4 escalations, no auth gates encountered.

## Issues Encountered

None. Both TDD cycles ran clean RED→GREEN with no fix-attempt loops.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **28-05** (drag-to-reorder, Duplicate/Remove, Add section) can attach SortableJS to the `.drag-handle` element already rendered on every row (currently inert), and fill the reserved control-group space for `Duplicate`/`Remove` — the row markup, `rowKey`-based `:key` binding, and the `moveRow`/`duplicateRow`/`removeRow`/`addSection` helpers from 28-01 are ready to wire in without restructuring the row template.
- **28-06** (R035 acceptance block and the phase gate) can rely on: exactly one scroll region in the Lyrics tab (verified structurally, not just visually); the row sequence equalling `performanceOrder` element-for-element; and D-02's single-edit-point-per-section guarantee — all covered by the tests this plan added.
- Full `npx vitest run src/` — 10 failed FILES (unchanged from the documented baseline; all 8 failures under `.gsd/quarantine/` plus the pre-existing `src/storage.rules.test.ts` and `src/views/__tests__/RosterView.test.ts` failures, none related to this plan's files), 155/165 files passing, 3550/3607 tests passing. `npm run type-check` — 0 errors. `npm run build` — succeeds.
- No blockers identified.

---
*Phase: 28-song-lyrics-editor-rework-risk-low*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: src/components/SongLyricEditor.vue
- FOUND: src/components/SongSlideOver.vue
- FOUND: src/components/__tests__/SongLyricEditor.test.ts
- FOUND: src/components/__tests__/SongSlideOver.test.ts
- FOUND: .planning/phases/28-song-lyrics-editor-rework-risk-low/28-04-SUMMARY.md
- FOUND: commit 43d525c (Task 1 test)
- FOUND: commit d2169a7 (Task 1 feat)
- FOUND: commit 3266f98 (Task 2 test)
- FOUND: commit b14d0f2 (Task 2 feat)
