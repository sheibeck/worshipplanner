---
phase: 35-presentation-correctness-lyric-editor
plan: 03
subsystem: ui
tags: [vue3, vitest, ccli-parser, lyric-editor, form-gating]

# Dependency graph
requires:
  - phase: 28
    provides: parseCCLIPaste / normalizeParsedSections and LyricPasteDialog.vue's original save path
provides:
  - LyricPasteRegion.vue — the chrome-less, multi-root inline successor to LyricPasteDialog.vue
  - The R065 copyright gate (canConfirm's copyright-or-override clause) and its always-available override checkbox
  - The E4 save-rejection backstop (pasteSaveError, no silent failure)
  - LyricPasteRegion.test.ts — 16 tests covering all 13 original LyricPasteDialog behaviors plus 5 new R065/backstop tests
affects: [35-04, SongLyricEditor.vue, SongLyricEditor.test.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-root Vue 3 SFC (two sibling roots via fragments) used to host a paste-mode header and body in one file while keeping data-flow (rawText) co-located with the unsaved-changes guard."
    - "Firestore-write catch/finally pattern (set error flag, keep user input, always reset isSaving) as the backstop for silent-save-failure classes (mirrors R041 elsewhere in this codebase)."

key-files:
  created:
    - src/components/LyricPasteRegion.vue
    - src/components/__tests__/LyricPasteRegion.test.ts
  modified: []

key-decisions:
  - "File-fate: LyricPasteRegion.vue is a separate child component (not inlined into SongLyricEditor.vue), renamed from LyricPasteDialog.vue, mounted with no Teleport/backdrop/fixed positioning. This was the lower-churn option from 35-RESEARCH.md's Open Question 2, and keeps the test file mounting one component directly — the reason the 9 parsing/save tests were movable rather than rewritable."
  - "Component is multi-root: lyrics-paste-header and paste-region render as two sibling roots via Vue 3 fragments, because the back-link's unsaved-changes guard reads rawText, which lives in this file."
  - "Emit names close/saved carried over unchanged from LyricPasteDialog.vue — a deliberate churn-avoidance choice since 3 of the 9 migrated tests assert on those names."
  - "canConfirm = parsed.sections.length > 0 && (!!parsed.copyright.ccliSongNumber || overrideCopyright) && !isSaving — exactly three clauses, verified by grep. A fourth clause would be the P-02 violation this plan exists to prevent."
  - "Test-count correction carried from the plan: LyricPasteDialog.test.ts has 13 it blocks, not 14 as 35-RESEARCH.md stated. Split is 9 moved verbatim / 2 reshaped-in-place / 2 reshaped-and-handed-to-plan-04."
  - "R065 and R066 are governed by 35-UI-SPEC.md's approved contract (checker-approved 6/6), not by probe-derived edge coverage — both were classified 'unclassified' by the specless edge probe (#1110) and therefore stay flagged/UNRESOLVED rather than auto-backstopped. If the UI-SPEC contract is wrong, this plan is wrong; there is no probe row to fall back on."

patterns-established:
  - "Save-rejection backstop: catch sets an error ref and returns without emitting the success event or clearing user input; finally still resets the in-flight flag. Reusable pattern for any Firestore-write UI in this codebase lacking a catch branch today."

requirements-completed: [R065, R066]

coverage:
  - id: D1
    description: "LyricPasteRegion.vue renders 35-UI-SPEC.md §4's markup/copy with zero modal chrome (no Teleport, backdrop, fixed/z-50 positioning, max-h-[85vh], or md:flex-row split)."
    requirement: "R066"
    verification:
      - kind: unit
        ref: "grep -cE 'Teleport|max-h-\\[85vh\\]|z-50|md:flex-row' src/components/LyricPasteRegion.vue == 0"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#renders textarea and replace-lyrics button"
        status: pass
    human_judgment: false
  - id: D2
    description: "R065 gate: a paste with detected sections but no CCLI number blocks Replace lyrics via the copyright-warning card."
    requirement: "R065"
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#shows the copyright warning and disables replace lyrics when no CCLI number is detected"
        status: pass
    human_judgment: false
  - id: D3
    description: "P-02: the override checkbox alone, with no other field touched, unblocks Replace lyrics and a subsequent click calls saveLyrics."
    requirement: "R065"
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#unblocks and saves when the override checkbox alone is checked, with no other field touched"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero-section paste shows the no-sections notice; the override checkbox never renders in that state (not reachable)."
    requirement: "R065"
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#shows the no-sections warning and keeps replace lyrics disabled, with no reachable override for zero sections"
        status: pass
    human_judgment: false
  - id: D5
    description: "E4 error backstop: a rejected saveLyrics call surfaces paste-save-error, keeps the pasted text in the textarea, and does not emit saved."
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#shows a save error and keeps the pasted text when saveLyrics rejects"
        status: pass
    human_judgment: false
  - id: D6
    description: "Parsing/save logic (parseCCLIPaste, normalizeParsedSections, saveLyrics call shape, D006/D-02 pooling) carried over byte-identical from LyricPasteDialog.vue — the 9 verbatim-moved tests pass unmodified in assertion content."
    verification:
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#calls saveLyrics with sections and performanceOrder together, with no song-store write"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/LyricPasteRegion.test.ts#pools a repeated section marker into one section with two order entries"
        status: pass
      - kind: other
        ref: "git diff --name-only HEAD -- src/utils/ccliParser.ts src/utils/songSectionOrder.ts (empty)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The visual/interaction feel of the inline paste region matches the wireframe (Turn 3) — a subjective compare against the design mockup, not settleable by jsdom assertions."
    verification: []
    human_judgment: true
    rationale: "35-VALIDATION.md's Manual-Only Verifications table lists this as human-judgment work ('Compare against Turn 3 of the wireframe'). This plan's automated tests cover state transitions and gating logic exhaustively but cannot judge visual fidelity."

# Metrics
duration: 45min
completed: 2026-08-03
status: complete
---

# Phase 35 Plan 03: Inline Lyric Paste Region Summary

**Built LyricPasteRegion.vue — a chrome-less, multi-root successor to the Teleported LyricPasteDialog.vue — with an R065 copyright-missing warning that blocks the save unless an always-available override checkbox is checked, plus a save-rejection backstop; migrated and extended LyricPasteDialog.test.ts's 13-test suite into 16 tests with zero coverage loss.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 2 (both new)

## Accomplishments

- `LyricPasteRegion.vue` created: two sibling roots (`lyrics-paste-header`, `paste-region`), transcribed verbatim from 35-UI-SPEC.md §4's markup/copy, with no `Teleport`, backdrop, `fixed`/`z-50` positioning, `max-h-[85vh]`, or `md:flex-row` split.
- R065's gate implemented exactly as specified: `canConfirm = parsed.sections.length > 0 && (!!parsed.copyright.ccliSongNumber || overrideCopyright) && !isSaving` — three clauses, no fourth. The override checkbox carries no `:disabled` binding and renders whenever the warning card does, so it is always reachable and never conditional on any other field (P-02).
- `onConfirm` gained a `catch` branch (the dialog's original `try/finally` had none): a rejected `saveLyrics` call now sets `pasteSaveError`, leaves `rawText` intact, and skips the `saved` emit — the E4 error backstop, closing the exact "invisible save failure" class R041 exists to prevent elsewhere in this codebase.
- Parsing (`parseCCLIPaste`) and save (`normalizeParsedSections`, `songLyricsStore.saveLyrics`) logic carried over byte-identical — confirmed by an empty `git diff` against `src/utils/ccliParser.ts` and `src/utils/songSectionOrder.ts`.
- `LyricPasteRegion.test.ts` created with 16 passing tests: 9 moved verbatim from `LyricPasteDialog.test.ts` (selector swap only), 2 reshaped against the new summary-line/chip markup, 5 new (R065 warning+disable, P-02 override-alone-unblocks, zero-section no-reachable-override, save-rejection backstop, singular/plural wording). Rows 12-13 of the original file (open/closed render, reopen-reset) were intentionally NOT ported — those are host-driven mount/unmount mechanisms that belong in plan 04's `SongLyricEditor.test.ts`.

## Disposition of all 13 original `LyricPasteDialog.test.ts` tests

| # | Original test | Disposition | New home |
|---|---|---|---|
| 1 | `:84` disables confirm when textarea is empty | **MOVE verbatim** | `LyricPasteRegion.test.ts` |
| 2 | `:100` enables confirm when sections are parsed | **MOVE verbatim** | `LyricPasteRegion.test.ts` |
| 3 | `:116` shows warning when paste has no sections | **MOVE verbatim** | `LyricPasteRegion.test.ts` |
| 4 | `:125` calls saveLyrics with sections+performanceOrder, no song-store write | **MOVE verbatim** (assertion byte-identical) | `LyricPasteRegion.test.ts` |
| 5 | `:146` pools repeated section marker into one section, two order entries | **MOVE verbatim** (assertion byte-identical) | `LyricPasteRegion.test.ts` |
| 6 | `:163` emits saved after successful confirm | **MOVE verbatim** | `LyricPasteRegion.test.ts` |
| 7 | `:173` prompts discard on cancel when textarea has content | **MOVE verbatim** | `LyricPasteRegion.test.ts` |
| 8 | `:186` emits close on cancel when textarea is empty | **MOVE verbatim** | `LyricPasteRegion.test.ts` |
| 9 | `:78` renders textarea and confirm button when open | **MOVE**, retitled (dropped "when open" — no `open` prop anymore) | `LyricPasteRegion.test.ts` |
| 10 | `:90` shows parsed preview when text is pasted | **RESHAPE** — title/lyric-line assertions dropped (that markup no longer exists per UI-SPEC §4); Verse 1/Chorus substrings and a new "2 sections" summary-line + chip-count assertion added | `LyricPasteRegion.test.ts` |
| 11 | `:108` shows copyright info in preview | **RESHAPE** — copyright preview block assertions replaced with a summary-line "copyright" substring + absence of the warning card | `LyricPasteRegion.test.ts` |
| 12 | `:73` renders nothing when closed | **RESHAPE, moved to plan 04** — open/closed is now the host's `v-if`, asserted in `SongLyricEditor.test.ts` | plan 04 |
| 13 | `:193` resets textarea when reopened | **RESHAPE, moved to plan 04** — reopening is a host-driven unmount/remount, asserted in `SongLyricEditor.test.ts` | plan 04 |

**Nothing was lost.** `LyricPasteDialog.test.ts` and `LyricPasteDialog.vue` remain untouched and green in this wave (intentional — plan 04 deletes both together with the modal). The 9 moved tests survive assertion-for-assertion; a `diff` against the original file's `expect(mockSaveLyrics)...` lines shows only additions (the new P-02 test's extra assertion), no removals.

## Task Commits

1. **Task 1: Build LyricPasteRegion.vue — the inline paste surface with the R065 copyright gate** - `da38be8` (feat)
2. **Task 2: Migrate LyricPasteDialog's coverage to LyricPasteRegion.test.ts and add the R065 gate tests** - `c002cc3` (test)

## Files Created/Modified

- `src/components/LyricPasteRegion.vue` — new multi-root component: paste-mode header + body, R065 gate, save-error backstop.
- `src/components/__tests__/LyricPasteRegion.test.ts` — new test file, 16 passing tests.

## Decisions Made

See `key-decisions` in frontmatter. Summary: separate child component (not inlined), multi-root for the header/body split, emit names unchanged, three-clause `canConfirm`, and both R065/R066 are governed by the UI-SPEC's approved contract rather than probe-derived edge coverage (both were flagged `unclassified` per #1110 and remain explicitly UNRESOLVED-by-probe, resolved instead by the checker-approved spec).

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria and behaviors from Task 1 and Task 2 were implemented as specified; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

None.

## Known Stubs

None. Every rendered element is wired to real state (`rawText`, `parsed`, `overrideCopyright`, `pasteSaveError`) with no hardcoded empty/placeholder data flowing to the UI.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers (T-35-09 through T-35-13, T-35-SC) — no new surface was introduced beyond what those entries account for.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `LyricPasteRegion.vue` exists standalone with props `songId`, `orgId`, `currentSectionCount` and emits `close`/`saved` — ready for plan 04 to mount behind a `v-if="pasteMode"` inside `SongLyricEditor.vue`.
- Plan 04 must: (1) host `LyricPasteRegion` in `SongLyricEditor.vue` in place of `LyricPasteDialog`'s `Paste lyrics`-triggered modal, wiring `pasteMode`; (2) delete `LyricPasteDialog.vue` and `LyricPasteDialog.test.ts`; (3) add the two host-driven mechanism tests handed off above (rows 12-13: open/closed via `v-if`, reopen-reset via unmount/remount) to `SongLyricEditor.test.ts`; (4) retire the `confirm-btn` data-testid along with the deleted dialog.
- `npm run type-check` and `npx vitest run src/` both pass clean against the established baseline (`src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`, 9 tests / 2 files) — 2257 passing overall, up from ~2241 before this plan (+16 new tests, 0 removed).

---
*Phase: 35-presentation-correctness-lyric-editor*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: src/components/LyricPasteRegion.vue
- FOUND: src/components/__tests__/LyricPasteRegion.test.ts
- FOUND: da38be8 (Task 1 commit)
- FOUND: c002cc3 (Task 2 commit)
