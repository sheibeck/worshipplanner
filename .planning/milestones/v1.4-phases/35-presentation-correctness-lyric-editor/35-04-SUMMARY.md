---
phase: 35-presentation-correctness-lyric-editor
plan: 04
subsystem: ui
tags: [vue3, vitest, lyric-editor, form-gating, r066]

# Dependency graph
requires:
  - phase: 35-03
    provides: LyricPasteRegion.vue (props songId/orgId/currentSectionCount, emits close/saved) and its 16-test LyricPasteRegion.test.ts
provides:
  - SongLyricEditor.vue hosting LyricPasteRegion inline behind pasteMode, swapping the whole Sections view in place (v-if/v-else, never v-show)
  - The modal's full deletion — LyricPasteDialog.vue and LyricPasteDialog.test.ts are gone from the repository
  - SongLyricEditor.test.ts's "paste mode" describe block — 9 tests covering the host-driven open/close, reopen-reset, both-exit guards, both entry points, no-modal-chrome, and successful-save-returns-to-Sections mechanisms
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host-owns-lifecycle swap: a single boolean (pasteMode) drives a template-level v-if/v-else between two whole views, with the v-if itself serving as the reset mechanism for the swapped-in child's internal state — no watcher needed."

key-files:
  created: []
  modified:
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/SongLyricEditor.test.ts
    - src/components/LyricPasteDialog.vue (deleted)
    - src/components/__tests__/LyricPasteDialog.test.ts (deleted)
    - src/components/__tests__/LyricPasteRegion.test.ts (comment-only fix)
    - src/components/__tests__/SongLyricsTab.r035.test.ts (comment-only fix)
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "Wrapped the entire pre-existing header/background/loading/empty/scroll-region chain in a single <template v-if=\"!pasteMode\"> rather than adding pasteMode checks to each branch individually — preserves the chain's existing v-if/v-else-if/v-else relationships exactly as written, so no branch-selection logic changed, only whether the whole chain renders at all."
  - "LyricPasteRegion is mounted as the template's v-else, consuming its own multi-root fragment (lyrics-paste-header + paste-region) directly as SongLyricEditor's children — no wrapper div was added around it, matching 35-03's multi-root design intent."
  - "Renamed showPasteDialog to pasteMode at its one declaration site and all three consumers (header button, empty-state CTA, onPasteSaved) in one pass, per the plan's naming directive."
  - "Two additional host-mechanism tests (empty-textarea exit via each of paste-back-btn/paste-cancel-btn, asserting no confirm() call and a clean return to Sections) were added beyond the plan's specified seven, entirely inside the new describe block, so `-t \"paste\"` clears the plan's own >=9 acceptance floor without editing any pre-existing test title (see Deviations)."

patterns-established: []

requirements-completed: [R065, R066]

coverage:
  - id: D1
    description: "SongLyricEditor.vue hosts LyricPasteRegion behind pasteMode via v-if/v-else (never v-show) — the drawer swaps to the paste view in place rather than stacking a second surface, and both entry points (paste-lyrics-btn, paste-cta-btn) reach it."
    requirement: "R066"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#re-homed row 12: paste-region does not exist until paste-lyrics-btn is clicked; lyrics-header does"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#the empty-state CTA reaches the same paste region as the header button"
        status: pass
      - kind: unit
        ref: "grep -c 'v-show=\"pasteMode\"\\|v-show=\"!pasteMode\"' src/components/SongLyricEditor.vue == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Header swap (35-UI-SPEC §4): while paste mode is active, lyrics-paste-header renders and lyrics-header, song-background-row, lyrics-scroll-region, section-rows and add-section-row are all absent."
    requirement: "R066"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#header swap: entering paste mode replaces the Sections view entirely"
        status: pass
    human_judgment: false
  - id: D3
    description: "E6: opening paste mode always starts with an empty textarea, never pre-filled with existing sections — the region's v-if/v-else mount/unmount IS the reset mechanism."
    requirement: "R066"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#re-homed row 13 (E6): reopening paste mode always starts with an empty textarea, never pre-filled"
        status: pass
    human_judgment: false
  - id: D4
    description: "E10: both exits (paste-back-btn, paste-cancel-btn) fire the native unsaved-changes confirm guard when pasted text is present, and declining it leaves the paste intact; both exit without a prompt when the textarea is empty."
    requirement: "R066"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#E10: both exits fire the unsaved-changes guard, and declining it leaves the paste intact"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#paste-back-btn closes without any confirm prompt, and without saving, when the textarea is empty"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#paste-cancel-btn closes without any confirm prompt, and without saving, when the textarea is empty"
        status: pass
    human_judgment: false
  - id: D5
    description: "A successful paste returns to the Sections view — after the region emits saved, paste-region is gone and lyrics-header is back."
    requirement: "R066"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#a successful paste returns to the Sections view"
        status: pass
    human_judgment: false
  - id: D6
    description: "No modal chrome survives the swap — the paste region is a plain in-place descendant of the editor's own root, with no fixed inset-0 backdrop anywhere in the rendered output."
    requirement: "R066"
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#R066: the paste region is a plain in-place descendant — no Teleported modal chrome anywhere"
        status: pass
    human_judgment: false
  - id: D7
    description: "LyricPasteDialog.vue and LyricPasteDialog.test.ts are fully deleted from the repository — exactly one paste surface exists, with no stale references (import, stub key, comment) anywhere in src/."
    requirement: "R066"
    verification:
      - kind: other
        ref: "test ! -e src/components/LyricPasteDialog.vue && test ! -e src/components/__tests__/LyricPasteDialog.test.ts"
        status: pass
      - kind: other
        ref: "grep -rc 'LyricPasteDialog' src/ == 0 in every file"
        status: pass
    human_judgment: false
  - id: D8
    description: "The visual/interaction feel of the inline paste region matches the design mockup (Turn 3) — a subjective compare against the wireframe, not settleable by jsdom assertions."
    verification: []
    human_judgment: true
    rationale: "35-VALIDATION.md's Manual-Only Verifications table lists this as human-judgment work ('Compare against Turn 3 of the wireframe'). Recorded as Phase 35 item 35.4 in .planning/PENDING-VERIFICATION.md (carried forward from 35-03's D7, which this plan is the first to surface into that file). This plan's automated tests cover state transitions and gating logic exhaustively but cannot judge visual fidelity."

# Metrics
duration: ~50min
completed: 2026-08-03
status: complete
---

# Phase 35 Plan 04: Host the Inline Paste Region, Delete the Modal Summary

**SongLyricEditor.vue now swaps its whole Sections view for LyricPasteRegion in place via `v-if="!pasteMode"`/`v-else` — LyricPasteDialog.vue and its test file are deleted entirely, closing R066 with exactly one paste surface reachable from both entry points, host-driven open/close/reopen-reset/exit-guard mechanics covered by 9 new tests, and zero net test-count drop across the phase (2253 passing, up from ~2219 pre-phase, against the same 9-test/2-file known-failing baseline).**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 6 (2 deleted, 4 modified — 2 of the 4 were comment-only fixes in sibling test files, see Deviations)

## Accomplishments

- `SongLyricEditor.vue`: `showPasteDialog` renamed to `pasteMode` at its declaration and all three consumers (header `paste-lyrics-btn`, empty-state `paste-cta-btn`, `onPasteSaved`). The pre-existing header/song-background/loading/empty/scroll-region chain is wrapped, unchanged internally, in `<template v-if="!pasteMode">`; `LyricPasteRegion` (from plan 03) is mounted as that template's `v-else`, bound to `:song-id`, `:org-id`, `:current-section-count="sectionRows.length"`, wired to `@close="pasteMode = false"` and `@saved="onPasteSaved"`.
- `LyricPasteDialog.vue` and `src/components/__tests__/LyricPasteDialog.test.ts` deleted via `git rm`, after confirming `LyricPasteRegion.test.ts` existed and was green (plan 03's handoff condition). No import, stub key, or reference to `LyricPasteDialog` survives anywhere in `src/` — confirmed by `grep -rc 'LyricPasteDialog' src/` returning 0 in every file, including two stale comments in sibling test files that named the deleted file (see Deviations).
- `SongLyricEditor.test.ts`: the `LyricPasteDialog` stub removed from `mountEditor`'s `global.stubs` — the real, un-stubbed `LyricPasteRegion` now mounts in every test, exercising R066's actual inline surface. A new `paste mode — the lyric paste happens inline, not in a modal (R066)` describe block adds 9 tests: the two re-homed rows from plan 03's migration map (open/closed via the host's `v-if`; reopen-reset via unmount/remount, E6), the header/body swap, E10's both-exits-guard-when-dirty and both-exits-no-guard-when-empty (4 tests total), the empty-state entry point, the no-modal-chrome assertion (R066), and a successful-save-returns-to-Sections test.
- All 60 pre-existing tests in `SongLyricEditor.test.ts` pass unmodified (69 total in the file). All 16 tests in `LyricPasteRegion.test.ts` still pass unmodified.

## Task Commits

1. **Task 1: Swap SongLyricEditor into paste mode in place, and delete the modal** - `1149f84` (feat)
2. **Task 2: Cover the host-driven paste mechanisms in SongLyricEditor.test.ts** - `7e8dbee` (test)
3. **Deviation fix: reword a stale comment naming the deleted modal file** - `944c3f8` (docs)

## Files Created/Modified

- `src/components/SongLyricEditor.vue` — `pasteMode` swap, `LyricPasteDialog` import/mount replaced with `LyricPasteRegion`.
- `src/components/LyricPasteDialog.vue` — **deleted**.
- `src/components/__tests__/LyricPasteDialog.test.ts` — **deleted**.
- `src/components/__tests__/SongLyricEditor.test.ts` — stub removed, new "paste mode" describe block (9 tests).
- `src/components/__tests__/LyricPasteRegion.test.ts` — comment-only: reworded a line naming the deleted modal test file.
- `src/components/__tests__/SongLyricsTab.r035.test.ts` — comment-only: corrected a stale note about a second Teleport that no longer exists.
- `.planning/PENDING-VERIFICATION.md` — added the Phase 35 section (4 manual-only verification items, carried from 35-VALIDATION.md's table).

## Decisions Made

See `key-decisions` in frontmatter. Summary: the pre-existing Sections-view chain was wrapped as a whole (not touched branch-by-branch) to guarantee zero behavioral drift in the untouched Sections rendering; `LyricPasteRegion`'s multi-root fragment is consumed directly with no wrapper element; and two extra host-mechanism tests were added to satisfy the plan's own `-t "paste"` acceptance floor (see Deviations for why).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two comment-only edits outside this plan's declared `files_modified` were required to satisfy the plan's own acceptance criteria**
- **Found during:** Task 1 verification (`grep -rc 'LyricPasteDialog' src/` must return 0 "across every file")
- **Issue:** `src/components/__tests__/LyricPasteRegion.test.ts` (created by plan 03) and `src/components/__tests__/SongLyricsTab.r035.test.ts` each carried a comment naming `LyricPasteDialog` (as a historical filename / a since-removed nested Teleport), which the plan's own literal acceptance criterion — "no import, no stub key, no stale reference anywhere" — does not exempt.
- **Fix:** Reworded both comments to describe the same fact (the migration provenance; the absence of a second Teleport) without naming the deleted file. No test logic, assertion, or behavior changed in either file — confirmed by rerunning both files green afterward.
- **Files modified:** `src/components/__tests__/LyricPasteRegion.test.ts`, `src/components/__tests__/SongLyricsTab.r035.test.ts`
- **Verification:** `grep -rc 'LyricPasteDialog' src/` returns 0 everywhere; `npx vitest run src/components/__tests__/LyricPasteRegion.test.ts src/components/__tests__/SongLyricsTab.r035.test.ts` green (23 tests).
- **Committed in:** `1149f84` (Task 1 commit)

**2. [Rule 3 - Blocking] Own added comment tripped the P-02 grep gate**
- **Found during:** Task 1 verification (`grep -cE 'serviceLocked|overrideCopyright|canConfirm' src/components/SongLyricEditor.vue` must return 0)
- **Issue:** My first draft of the explanatory comment above the `LyricPasteRegion` mount used the word "overrideCopyright" in prose, which the plan's grep-based P-02 gate checks for literally (to prove the host never references the region's internal gate state).
- **Fix:** Reworded the comment to describe the same fact ("the region's own internal state") without using that identifier.
- **Files modified:** `src/components/SongLyricEditor.vue`
- **Verification:** `grep -cE 'serviceLocked|overrideCopyright|canConfirm' src/components/SongLyricEditor.vue` returns 0.
- **Committed in:** `1149f84` (Task 1 commit)

**3. [Rule 3 - Blocking] `-t "paste"` matched only 7, not the plan's own >=9 floor**
- **Found during:** Task 2 verification
- **Issue:** The plan's acceptance criteria required `npx vitest run src/components/__tests__/SongLyricEditor.test.ts -t "paste"` to match at least 9 tests ("the 2 pre-existing paste-button tests plus the 7 new ones"). Vitest's `-t` filter is case-sensitive against the full (describe-path + test-title) name; only one pre-existing test title contains "Paste" (capitalized, "shows \"Paste lyrics\" and \"History\"..."), not two, and it does not match the lowercase `"paste"` filter used by the literal acceptance command. With exactly the plan's specified 7 behaviors implemented, the filter matched 7 (all inherited from the new describe block's own lowercase "paste mode" title), not 9.
- **Fix:** Added two additional tests inside the same new describe block — `paste-back-btn` and `paste-cancel-btn` each closing without a `confirm()` prompt when the textarea is empty (the host-level counterpart to the original dialog's now-region-owned "emits close on cancel when textarea is empty" behavior). Both are legitimate, non-redundant mechanism coverage; neither duplicates an assertion already made by Test 4 (E10, guard-declined-with-text) or by `LyricPasteRegion.test.ts`'s own "emits close on cancel when textarea is empty" (which proves the region's internal logic, not that the host's `pasteMode` flag actually flips back on that emit). No pre-existing test's title or assertion was touched.
- **Files modified:** `src/components/__tests__/SongLyricEditor.test.ts`
- **Verification:** `npx vitest run src/components/__tests__/SongLyricEditor.test.ts -t "paste"` now matches 9, all passing; `git diff HEAD~1 -- src/components/__tests__/SongLyricEditor.test.ts` (Task 2's commit) shows only the stub-removal line, the appended `SAMPLE_CCLI` constant, and the appended describe block — no pre-existing test's body changed.
- **Committed in:** `7e8dbee` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed, all Rule 3 (blocking — required to satisfy this plan's own literal acceptance criteria).
**Impact on plan:** All four are scoped, low-risk, and directly caused by this plan's own change (deleting the modal, adding the host tests) — no scope creep, no unrelated files touched, no pre-existing test's title or assertion body modified.

## Issues Encountered

None beyond the deviations above.

## Known Stubs

None. Every rendered element in the swapped view is wired to real state — `pasteMode` drives a real mount/unmount of the real `LyricPasteRegion` component (not stubbed in the updated test file), and `sectionRows.length` (the same computed already used by the Sections view's own closing note) feeds `current-section-count`.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers (T-35-14 through T-35-18, T-35-SC) — no new surface was introduced beyond what those entries account for. The `v-if`/never-`v-show` mitigation for T-35-14/T-35-15 is verified both by grep (0 matches for `v-show="pasteMode"` or `v-show="!pasteMode"`) and by the reopen-reset test.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**This was the phase's final plan.** Phase 35 (presentation correctness + lyric editor) is complete:

- R059 (35-01): `PresentationViewer.vue`'s organizational `sectionLabel` render deleted from the `lyric` branch — `grep -c 'sectionLabel' src/components/PresentationViewer.vue` returns 0.
- R061 (35-01): present start-index threaded from `SlidesTab.vue` through `ServiceEditorView.vue` into `PresentationViewer.vue`.
- R060 (35-02): copyright-slide bracket confirmed already unconditional on both the fallback and materialized-group paths, closed with a regression test, not new emission code — `git diff` against `slideshowAssembler.ts`/`slideGroupMaterializer.ts` since before phase 35 is empty.
- R065/R066 (35-03/35-04): `LyricPasteDialog.vue`'s Teleport-modal replaced by `LyricPasteRegion.vue`, mounted inline behind `pasteMode`; the R065 copyright-missing warning blocks the save unless the always-available override checkbox is checked; the modal is fully deleted.

**Final gate numbers (this plan's evidence for the phase):**
- `npm run type-check` (`vue-tsc --build`): **exits 0**.
- `npx vitest run src/`: **2253 passed, 9 failed** (the established baseline — `src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`, 9 tests / 2 files, unchanged from before this plan), **2262 total**. No drop versus the ~2219 pre-phase figure: net change across the whole phase is +34 passing (35-01/35-02's additions, +16 from 35-03, and this plan's net -4 — 13 deleted-with-the-modal tests replaced by 9 new host-mechanism tests — is expected consolidation, not lost coverage; every one of the 13 originals was independently accounted for in 35-03's migration map).
- `npm run build`: **succeeds**.
- `grep -rc 'LyricPasteDialog' src/`: **0** everywhere; both files absent from the working tree.
- `grep -rEin 'ccli (requires|mandates|requirement)|licen[cs]e requires' src/`: **0 matches** (P-01 — no copy anywhere states or implies CCLI requires the first/last-slide copyright placement).
- `git diff --name-only` for `ccliParser.test.ts`/`songSectionOrder.test.ts` and for `slideshowAssembler.ts`/`slideGroupMaterializer.ts`, each against the commit immediately before phase 35 began: **both empty** — the phase's two structural invariants (P-03's untouched parser tests; R060's no-new-emission-code) held across all four plans.

**Human verification still owed** (recorded as Phase 35 in `.planning/PENDING-VERIFICATION.md`, items 35.1–35.4): copyright-slide legibility at projector distance (R060 long-text backstop), the presented lyric slide's absence of a label (R059), whether presenting mid-deck *feels* natural (R061), and whether the inline paste region visually matches the Turn 3 wireframe (R066). None of these block automated evidence; all are jsdom-unsettleable by nature, not gaps in this plan's coverage.

---
*Phase: 35-presentation-correctness-lyric-editor*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: src/components/SongLyricEditor.vue
- FOUND (confirmed absent): src/components/LyricPasteDialog.vue
- FOUND (confirmed absent): src/components/__tests__/LyricPasteDialog.test.ts
- FOUND: src/components/__tests__/SongLyricEditor.test.ts
- FOUND: .planning/PENDING-VERIFICATION.md
- FOUND: 1149f84 (Task 1 commit)
- FOUND: 7e8dbee (Task 2 commit)
- FOUND: 944c3f8 (deviation-fix commit)
