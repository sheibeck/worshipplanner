---
phase: 28-song-lyrics-editor-rework-risk-low
plan: 06
subsystem: songs
tags: [vue, vitest, testing, requirements-verification]

# Dependency graph
requires:
  - phase: 28-song-lyrics-editor-rework-risk-low
    provides: "28-01's pure pool/order helpers, 28-02's single order source, 28-03's occurrence-aware reconciliation, and 28-04/28-05's rebuilt single-scroll-region editor with drag/duplicate/remove/add — all proven together here rather than re-implemented"
provides:
  - "src/components/__tests__/SongLyricsTab.r035.test.ts — R035's acceptance block, asserting (as counts, not inspection) exactly one scroll surface and exactly one list over the MOUNTED SongSlideOver+SongLyricEditor subtree, the list-is-the-order property in both directions including a repeat, the Edit-in-song link round trip, D006's CCLI paste/normalise, and D002/D007's live-reference resolution through assembleSlideshow"
  - "The CCLI copyright display restored (read-only, inside the single scroll region) after 28-04 dropped it without an authorizing decision"
  - "The phase gate for the final phase of v1.3: type-check 0, production build succeeds, full unit run's failing FILE SET unchanged from the 10-file baseline (recorded by name below)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "R035's acceptance block mounts the PARENT (SongSlideOver) with the CHILD (SongLyricEditor) both real — no stubbing of either — because the nested-scrollbar defect only appears once panel and editor are mounted together; per-component tests (28-04/28-05) proved each half separately, this file proves the composed whole."
    - "Constraint checks in the same acceptance file stay UNIT-focused rather than re-running a second full integration: songEditLink's pure builder/parser round-trips directly; ccliParser + normalizeParsedSections run directly on a raw-paste fixture; assembleSlideshow resolves a two-entry group (same section referenced twice) directly against two lyrics-document versions."

key-files:
  created:
    - src/components/__tests__/SongLyricsTab.r035.test.ts
  modified:
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/SongLyricEditor.test.ts

key-decisions:
  - "Restored the CCLI copyright display 28-04 dropped without an authorizing decision (added task, not in the original plan file). R035 only requires one scroll surface and one list; it says nothing about copyright display, and the drop removed the only place an editor could verify the CCLI data that appears on the presented copyright slide before a service runs. Recovered verbatim from git history (commit d2169a7's pre-change version) and placed inside the single lyrics-scroll-region so R035's one-scroll-surface property still holds. Display only — not editable, and CopyrightSlide's own emission path (slideshowAssembler.ts / slideGroupMaterializer.ts) was left untouched, since that path already resolves currentLyrics.copyright live and was never affected by the drop."
  - "R035's acceptance test avoids re-testing what 28-04/28-05's suites already prove structurally (row numbering, per-row edit propagation, duplicate/remove semantics) and instead asserts the two REQUIREMENT-LEVEL counts (one scroll surface, one list) plus the four hard-constraint round trips, kept as unit-focused checks per the plan's explicit instruction not to build a second full integration suite."
  - "The 'edit resolves live through slide entries' constraint check uses assembleSlideshow directly (same fixture pattern as slideshowAssembler.test.ts's existing 'stored group resolution' describe block) rather than mounting a Slides tab UI — the constraint is about the PURE resolution function's behavior (D002/D007), which is exactly what that function is for."
  - "SongSlideOver.test.ts needed no change for Task 2's file-list slot — its existing assertions (non-scrolling Lyrics tab panel, editor mount, no second-list regression guard, initialTab round trip) already stayed consistent with the final shape of the tab; left untouched, as the task's own text permits."

requirements-completed: [R035, R018]

coverage:
  - id: D1
    description: "R035's two structural conditions (no nested scrollbar, exactly one list) are asserted as counts over the MOUNTED SongSlideOver+SongLyricEditor subtree, not inspected in isolation."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricsTab.r035.test.ts#R035: mounting the Lyrics tab (panel + editor together) yields exactly one element declaring vertical-overflow scrolling"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricsTab.r035.test.ts#R035: the tab renders exactly one ordered row container — no duplicated Available-Sections / Performance-Order lists"
        status: pass
    human_judgment: false
  - id: D2
    description: "The single list IS the slide order in both directions: rendered sequence equals the stored order element-for-element including a repeat, and a reorder changes the saved order."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricsTab.r035.test.ts#the rendered row sequence, top to bottom, equals the stored order element for element — including a repeat at each of its positions"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricsTab.r035.test.ts#reordering the list changes what is saved as the order — the list IS the order, not a view onto it"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase 26's Edit-in-song link still lands: buildSongEditLink/parseSongEditRequest round-trips to the same song id and lyrics tab, and SongSlideOver opens on Lyrics with the editor showing when handed that tab."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricsTab.r035.test.ts#a link built for a song's lyrics parses back to the same song id and the lyrics tab; handing that tab to the slide-over opens it on the Lyrics tab showing the editor"
        status: pass
    human_judgment: false
  - id: D4
    description: "D006 survives: a CCLI paste with section markers still parses into sections, and a paste naming the same section twice normalises to one pooled section referenced twice."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricsTab.r035.test.ts#a CCLI paste with section markers still parses into sections, and a paste naming the same section twice normalises to one pooled section referenced twice"
        status: pass
    human_judgment: false
  - id: D5
    description: "D002/D007 hold: editing a section referenced twice and resolving the slide entries that reference it (assembleSlideshow) produces the edited words for both entries, with no group rewrite."
    requirement: "R035"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricsTab.r035.test.ts#editing a section referenced twice and resolving the slide entries that reference it produces the edited words for both entries"
        status: pass
    human_judgment: false
  - id: D6
    description: "The CCLI copyright display, dropped in 28-04 without an authorizing decision, is restored as read-only content inside the single scroll region, with a test asserting it renders when ccliSongNumber is present and is absent when it is not."
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#shows the copyright display, inside the single scroll region, when ccliSongNumber is present"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#hides the copyright display when ccliSongNumber is absent"
        status: pass
    human_judgment: false
  - id: D7
    description: "The phase leaves the tree green: type-check 0, production build succeeds, and the full unit run's failing FILE SET is unchanged from the 10-file baseline."
    requirement: "R035"
    verification:
      - kind: other
        ref: "npm run type-check (0 errors); npm run build (succeeds); npx vitest run src/ (10 failed files, matching the documented baseline set — recorded by name in this SUMMARY's Phase Gate Results section)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Leftover sweep: no importer of the deleted PerformanceOrderBuilder component, no reference to the removed Song.performanceOrder field, no remaining caller of the removed songLyricsStore.updatePerformanceOrder action."
    verification:
      - kind: other
        ref: "grep sweep across src/ — zero matches for PerformanceOrderBuilder imports, Song.performanceOrder, and updatePerformanceOrder (see this SUMMARY's Leftover Sweep section)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-07-27
status: complete
---

# Phase 28 Plan 06: R035 acceptance block, restored copyright display, and the phase gate Summary

**Proved R035 by assertion (not inspection) with a new acceptance-block test file mounting the panel and editor together, restored the CCLI copyright display 28-04 dropped without a decision authorizing it, and closed the final phase of v1.3 with a green tree — type-check 0, build succeeding, and the full suite's failing file set unchanged from the 10-file baseline.**

## Performance

- **Duration:** ~55 min (added task + 2 plan tasks + phase-gate verification, including a ~10min full-suite run)
- **Completed:** 2026-07-27
- **Tasks:** 3 (1 added task + 2 plan tasks)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Added task — restored the CCLI copyright display.** 28-04 (commit `d2169a7`) removed the editor's read-only CCLI copyright block with no decision authorizing it — the plan's own Decisions Made section only cited "not part of option 2a's design," but R035 never mentions copyright display and dropping it removed the sole place an editor could verify CCLI data before it reaches the presented copyright slide. Recovered the original markup (title, authors, copyright lines, CCLI Song #, CCLI License #) from git history and placed it as read-only content inside the single `lyrics-scroll-region`, preserving R035's one-scroll-surface property. Added two tests: renders when `ccliSongNumber` is present, absent when it is not.
- **Task 1 — the R035 acceptance block.** Created `src/components/__tests__/SongLyricsTab.r035.test.ts`, mounting `SongSlideOver` with `SongLyricEditor` real (not stubbed) on the Lyrics tab — the nested-scrollbar defect R035 names only appears once both are mounted together, which no prior 28-04/28-05 test proved. Asserts, as counts with requirement-naming failure messages: exactly one element declaring vertical-overflow scrolling, and exactly one ordered row container. Asserts the list-IS-the-order property in both directions (rendered sequence equals stored order including a repeat at its exact position; a drag-reorder changes the saved order). Re-checks all four hard constraints from `28-CONTEXT.md` as focused unit-level round trips within the same file: the Edit-in-song link (`buildSongEditLink` → `parseSongEditRequest` → `SongSlideOver`'s `initialTab`), D006 (a raw CCLI paste fixture through `parseCCLIPaste` + `normalizeParsedSections`, proving a twice-named section pools to one section referenced twice), and D002/D007/Phase 26-09 (`assembleSlideshow` resolving a two-entry group referencing the same section, before and after an edit, with the stored group entries unchanged — live reference, not a copy).
- **Task 2 — phase gate.** `npm run type-check` — 0 errors. `npm run build` — succeeds (confirmed `.env.local` present so the Firebase-config build guard doesn't misattribute a config gap as a code failure). Full `npx vitest run src/` — 10 failed FILES, exactly matching the documented baseline (recorded by name below); 156/166 files passing; 3576 tests passing (45 failing, all inside the 10 baseline files; 18 skipped). Leftover sweep across `src/` found zero remaining references to the deleted `PerformanceOrderBuilder` component (import sites), the removed `Song.performanceOrder` field, or the removed `songLyricsStore.updatePerformanceOrder` action — nothing to fix. `SongSlideOver.test.ts` (listed in the plan's file list as a home for a possible small consistency fix) needed no change — its existing non-scrolling-panel, single-editor-mount, and `initialTab` round-trip assertions already matched the tab's final shape.

## Task Commits

1. **Added task: restore the CCLI copyright display dropped in 28-04** - `78645a0` (fix)
2. **Task 1: The R035 acceptance block** - `49f0cb0` (test)
3. **Task 2: Phase gate and goal-backward check** - no code commit (sweep clean, `SongSlideOver.test.ts` unchanged); this SUMMARY and STATE/ROADMAP updates are the task's output, committed as the plan's final metadata commit.

## Files Created/Modified

- `src/components/__tests__/SongLyricsTab.r035.test.ts` — R035's acceptance block (7 tests): the two structural counts, the list-is-order property in both directions, and the four hard-constraint round trips.
- `src/components/SongLyricEditor.vue` — Restored the read-only CCLI copyright display (`data-testid="copyright-display"`) inside `lyrics-scroll-region`, after the closing note.
- `src/components/__tests__/SongLyricEditor.test.ts` — Added two tests for the restored copyright display (present when `ccliSongNumber` set; absent when not).

## Decisions Made

- **Restored the copyright display without a new design decision.** The 28-04 drop cited option 2a's design not depicting it, but R035's scope is one-scroll/one-list — copyright display sits outside that scope entirely, and its absence had no decision record beyond "not part of 2a's design." Treated as a Rule 2 (missing critical functionality) restoration per the phase's added-task instruction: the CCLI data being invisible during editing is a real licensing-verification gap, not a design simplification.
- **The acceptance block mounts parent+child together, unstubbed.** Established codebase precedent (`ServiceEditorView.test.ts`, `EditSlideDrawer.test.ts`) uses `DOMWrapper(document.body)` + `enableAutoUnmount(afterEach)` for teleported content; this file follows that pattern for `SongSlideOver`'s outer `Teleport` rather than the `stubs: { Teleport: { template: ... } }` in-place-render convention 28-04/28-05's component-level tests use, because those tests deliberately isolate one component while this one deliberately composes two.
- **Constraint checks stay unit-focused, not a second full integration.** Per the plan's explicit interfaces guidance — CCLI parsing/normalising and slide-entry resolution are exercised as direct function calls against fixtures (mirroring `ccliParser.test.ts` / `slideshowAssembler.test.ts`'s own conventions) rather than driven through additional UI interaction, since the pure functions are exactly what those constraints are about.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Restored the CCLI copyright display dropped in 28-04**
- **Found during:** Added task (assigned before Task 1, per this plan's orchestration instructions — not discovered mid-execution)
- **Issue:** 28-04 removed the editor's only read-only display of CCLI copyright/licensing data, with no decision in `28-CONTEXT.md` authorizing the removal.
- **Fix:** Restored the original markup as read-only content inside the single scroll region; added presence/absence tests.
- **Files modified:** `src/components/SongLyricEditor.vue`, `src/components/__tests__/SongLyricEditor.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/SongLyricEditor.test.ts` — 45/45 pass. `npm run type-check` — 0 errors.
- **Committed in:** `78645a0`

---

**Total deviations:** 1 auto-fixed (1 missing critical), assigned by the orchestrating prompt rather than discovered independently.
**Impact on plan:** Restores a licensing-verification affordance without expanding R035's own scope or touching the CopyrightSlide emission path. No scope creep beyond the explicitly assigned restoration.

## Issues Encountered

None. Both the added task and Task 1's acceptance block passed on first write — the underlying behavior (28-01 through 28-05) was already correct; this plan's job was proving it, not building it.

## Phase Gate Results

- `npm run type-check` — **0 errors**.
- `npm run build` — **succeeds** (`.env.local` confirmed present).
- `npx vitest run src/` — **10 failed FILES**, 156/166 files passing, 3576/3639 tests passing (45 failed, 18 skipped). The failing file set, by name, unchanged from the documented baseline:
  1. `.gsd/quarantine/worktrees/M001-2026-07-24T05-05-54-994Z/src/views/__tests__/ServiceEditorView.test.ts`
  2. `.gsd/quarantine/worktrees/M001-2026-07-24T21-17-32-997Z/src/views/__tests__/ServiceEditorView.test.ts`
  3. `.gsd/quarantine/worktrees/M001-2026-07-24T05-05-54-994Z/src/rules.test.ts`
  4. `.gsd/quarantine/worktrees/M001-2026-07-24T21-17-32-997Z/src/rules.test.ts`
  5. `.gsd/quarantine/worktrees/M001-2026-07-24T05-05-54-994Z/src/stores/__tests__/services.test.ts`
  6. `.gsd/quarantine/worktrees/M001-2026-07-24T21-17-32-997Z/src/stores/__tests__/services.test.ts`
  7. `.gsd/quarantine/worktrees/M001-2026-07-24T05-05-54-994Z/src/views/__tests__/RosterView.test.ts`
  8. `.gsd/quarantine/worktrees/M001-2026-07-24T21-17-32-997Z/src/views/__tests__/RosterView.test.ts`
  9. `src/storage.rules.test.ts` (needs the Firebase emulator, deliberately not run)
  10. `src/views/__tests__/RosterView.test.ts` (pre-existing stale assertion, unrelated to this phase)

  All 8 quarantine-directory failures are `crypto.randomUUID is not a function` / stale-fixture errors in frozen worktree snapshots — no file outside this exact set failed. The Phase 18 `PerformanceOrderBuilder.test.ts` suite, deleted in 28-02, legitimately lowered the passing test count from earlier phases; that is not a regression.

## Leftover Sweep

- `grep -rn "PerformanceOrderBuilder" src/ --include="*.vue" --include="*.ts"` — one match, a comment in `SongSlideOver.test.ts` documenting the deletion (no import, no reference to the component itself).
- `grep -rn "\.performanceOrder\b" src/types/song.ts src/stores/songs.ts` — no matches; the field was fully removed in 28-02.
- `grep -rn "updatePerformanceOrder" src/` — no matches; the store action was fully removed in 28-02.
- Nothing to fix.

## Goal-Backward Check — every must-have across 28-01 through 28-06

| # | Must-have (source plan) | Status | Evidence |
|---|---|---|---|
| 1 | Pool + order model with pure helpers (`buildSectionRows`, `normalizeLyricOrder`, `moveRow`/`duplicateRow`/`removeRow`/`addSection`, `normalizeParsedSections`), no store/Vue imports | Met | 28-01: `songSectionOrder.ts`, purity grep clean, 35/35 tests pass. Reused unmodified through 28-06. |
| 2 | `SongLyrics.performanceOrder` is the ONE order source — `Song.performanceOrder` and the three-tier precedence chain deleted, `PerformanceOrderBuilder.vue` deleted, paste dialog performs one write | Met | 28-02: field/action/component deleted; 28-06's leftover sweep confirms zero remaining references. |
| 3 | `reconcileSongGroup` consumes repeats occurrence-aware (no 4→8→16 compounding), idempotent across passes, Phase 26-09's duplicate-survival preserved | Met | 28-03: positional consumption + surplus-at-last-occurrence rule; two-pass idempotence tests; 26-09 regression test unmodified and green. |
| 4 | Single scroll region (editor owns the ONLY scroll container in the Lyrics tab); history moved behind editor's own control | Met | 28-04 component-level; **28-06 R035 test proves it at the composed panel+editor level** (1 scroll container in the mounted subtree). |
| 5 | The row list IS the order: numbered 1..N, repeats linked and read-only with one edit point per section, autosave writes sections+order together | Met | 28-04: row derivation, D-02 cross-row propagation, single-call autosave. **28-06 R035 test additionally proves the composed rendered sequence equals stored order including a repeat, and a reorder changes the saved order.** |
| 6 | Always-on drag reorder by handle (no mode to enter first), Duplicate/Remove per row, Add-section chips, closing-note count tracks all mutations | Met | 28-05: SortableJS handle-scoped drag (same config as slot list/slide grid); D-02-safe duplicate/remove; five-chip add row. |
| 7 | R035's two conditions asserted as counts, not eyeballed, over the MOUNTED tab subtree | Met | 28-06 Task 1: `SongLyricsTab.r035.test.ts`, both counts asserted with requirement-naming failure messages. |
| 8 | Phase 26's Edit-in-song link still lands | Met | 28-04's `SongSlideOver.test.ts#opening tab` suite (component-level) + **28-06's end-to-end round trip through the real link builder/parser into the real `initialTab` prop**. |
| 9 | D006 (CCLI paste + section-marker parsing, repeats pool to one section) survives | Met | 28-02's `LyricPasteDialog.test.ts` + **28-06's direct `parseCCLIPaste`/`normalizeParsedSections` round trip on a fresh two-Chorus fixture**. |
| 10 | D002/D007 (single canonical lyric, live reference — never copied) holds through the rework | Met | 28-03's live-reference test + **28-06's `assembleSlideshow` before/after-edit resolution for a twice-referenced section, group entries unchanged**. |
| 11 | The CCLI copyright display is available to verify licensing data while editing | Met (restored 28-06) | Dropped without authorization in 28-04; restored in 28-06's added task, inside the single scroll region, with presence/absence tests. |
| 12 | Tree stays green: type-check 0, build succeeds, failing file set stable at the 10-file baseline | Met | 28-06 Task 2's Phase Gate Results section above. |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

This is the final phase of milestone v1.3 (Slides Tab Rework). No downstream Phase 28 plan depends on this one. The milestone's human-verify batch (Phases 20-23, 25-27, and this phase's items below) is the next gate before the milestone can be marked complete.

### Outstanding human-verify items (queued for the milestone's batch, verbatim from this plan)

Open a song's Lyrics tab and confirm one scrollbar and one list; drag a section by its handle and confirm it moves and stays moved; expand a section, edit a word, and confirm a repeated occurrence of that section shows the change too; duplicate a section and confirm the new row reads as a linked repeat; remove one occurrence of a repeated section and confirm the other keeps its words; add a section from the quick-add chips and type into it; paste a CCLI song whose text names the chorus more than once and confirm it arrives as one chorus referenced several times; open version history from the editor header and restore an earlier version; follow the Edit-in-song link from the Slides tab's Edit Slide drawer and confirm it lands on this editor; and finally open a service that uses that song and confirm the Slides tab shows the edited words in the order the list now has.

**Additional item from this plan's added task:** open a song with a CCLI number set and confirm the copyright block (title, authors, copyright lines, CCLI Song #, CCLI License #) renders read-only inside the Lyrics tab's single scroll region, below the section list.

No blockers identified.

---
*Phase: 28-song-lyrics-editor-rework-risk-low*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/components/__tests__/SongLyricsTab.r035.test.ts
- FOUND: src/components/SongLyricEditor.vue
- FOUND: src/components/__tests__/SongLyricEditor.test.ts
- FOUND: .planning/phases/28-song-lyrics-editor-rework-risk-low/28-06-SUMMARY.md
- FOUND: commit 78645a0 (added task — restore CCLI copyright display)
- FOUND: commit 49f0cb0 (Task 1 — R035 acceptance block)
