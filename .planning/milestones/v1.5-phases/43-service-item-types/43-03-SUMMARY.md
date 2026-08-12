---
phase: 43-service-item-types
plan: 03
subsystem: ui
tags: [vue, vitest, palette, editor, service-item-types, tdd]

# Dependency graph
requires:
  - phase: 43-01
    provides: "SlotKind widened with ANNOUNCEMENTS/MISC; NonAssignableSlot.body?: string; every kind-dispatch site closed"
  - phase: 43-02
    provides: "addSlotAsItem exhaustive per-kind dispatch; bodyDescription() whitespace-aware presence rule"
provides:
  - "Both palette rows (bottom add-to-service and per-section inline) offer Announcements and Miscellaneous and no longer offer Hymn; HYMN type/factory/label/render branch untouched — retired from the palette, not the type"
  - "One shared body <textarea> (data-testid slot-body-input) serves MESSAGE, ANNOUNCEMENTS and MISC through the file's :value/@input idiom on NonAssignableSlot.body"
  - "Message link inputs and open-link anchor deleted from markup; linkUrl/linkLabel remain in the type and in Firestore (no migration, no stored value touched)"
  - "bodyPlaceholder helper (static three-kind lookup); elementLabel ANNOUNCEMENTS/MISC cases; isSlotPopulated MESSAGE/ANNOUNCEMENTS/MISC arm split to a body check (kept consistent, still dead code per IN-01)"
  - "Editor-coverage test suite in ServiceEditorView.test.ts proving E-02, E-06, E-09, E-11, E-12, E-16 and UI-05/UI-06"
affects: [43-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One slot-content branch keyed on a three-kind test (MESSAGE/ANNOUNCEMENTS/MISC) replacing three near-identical copies — the shared body editor is the canonical shape for future free-text SlotKinds"
    - "Palette rows stay enumerated as literal markup rather than a loop over SlotKind — this is what makes a palette-only retirement (drop the Hymn chip, keep the HYMN type) possible without a data migration"

key-files:
  created:
    - .planning/phases/43-service-item-types/43-03-SUMMARY.md
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Hymn retired from BOTH palette rows by deleting the chip <button> elements outright (no v-if=false, no commemorative comment) — the HYMN SlotKind, createSlot factory, slotLabel and slot-content render branch are all left intact, so a stored HYMN slot remains fully constructible and renderable. This is the palette-only retirement the plan scoped; the render/print/present/export half of R084 belongs to plan 04."
  - "isSlotPopulated's combined MESSAGE-or-PRAYER arm was split (PRAYER keeps the link check; MESSAGE/ANNOUNCEMENTS/MISC use a trimmed body check) for consistency only — it remains known dead code (declared and never called since Phase 12-05, IN-01 in 27-REVIEW.md) and was NOT wired to anything."
  - "The export-failure label built from raw slot.kind (~line 3426) was deliberately left unchanged — a failed Announcements export reports its raw union string rather than its display name. Cosmetic, covered by no requirement, already recorded as accepted threat T-43-10 in 43-02-PLAN.md."

patterns-established:
  - "Shared free-text slot editor: one v-else-if branch serving multiple text SlotKinds, label from slotLabel(), placeholder from a static kind-keyed lookup typed to only the kinds it serves, empty state matching the HYMN/IMPORTED em-dash convention"

requirements-completed: [R081, R082, R083]
requirements-partial:
  - id: R084
    note: "Easy half only — Hymn palette absence proven by explicit negative assertion, and stored HYMN slot count/ids/order/positions unchanged after mount (E-16). The hard half — a stored HYMN slot still renders, prints, presents and exports after the chip is gone — is plan 04's job and is NOT claimed here."

coverage:
  - id: D1
    description: "Both palette rows offer Announcements and Miscellaneous, neither offers Hymn"
    requirement: "R081, R082"
    verification:
      - kind: other
        ref: "grep -c palette-add-hymn / section-add-hymn = 0; palette-add-announcements / palette-add-misc / section-add-announcements / section-add-misc = 1"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — palette renders six chips with explicit negative assertion that the Hymn palette testid is absent"
        status: pass
    human_judgment: false
  - id: D2
    description: "One shared textarea serves MESSAGE/ANNOUNCEMENTS/MISC via NonAssignableSlot.body; typing writes verbatim to that slot only"
    requirement: "R083"
    verification:
      - kind: other
        ref: "grep -c slot-body-input = 1 (one textarea, not three copies); bodyPlaceholder = 2 (definition + single binding)"
        status: pass
      - kind: unit
        ref: "ServiceEditorView.test.ts — E-11 body round-trip (leading/trailing space, newline, multi-byte, emoji, toBe); E-09 two adjacent MESSAGE slots each own their textarea"
        status: pass
    human_judgment: false
  - id: D3
    description: "Message URL control removed from markup while linkUrl/linkLabel survive in type and storage; removal proven scoped to Message"
    requirement: "R083"
    verification:
      - kind: other
        ref: "grep -c v-html = 0 (body reaches DOM only via interpolation/:value); grep -c linkUrl in src/types/service.ts = 1 (type field survives)"
        status: pass
      - kind: unit
        ref: "ServiceEditorView.test.ts — Message row has no url input / open-link anchor (DOM absence); paired Prayer row still DOES; E-11 second half: stored linkUrl/linkLabel intact after mount, body not populated from linkUrl"
        status: pass
    human_judgment: false
  - id: D4
    description: "Empty body is a normal state (empty-state element, no error) for ANNOUNCEMENTS and MISC independently"
    requirement: "R081, R082, R083"
    verification:
      - kind: unit
        ref: "ServiceEditorView.test.ts — E-02 (ANNOUNCEMENTS) and E-06 (MISC) whitespace-only body renders empty state, no error/warning element; editor arm shows textarea with placeholder and empty value"
        status: pass
    human_judgment: false
  - id: D5
    description: "R084 easy half — removing the Hymn chip renumbered nothing; a stored HYMN slot's count/ids/order/positions are unchanged after mount"
    requirement: "R084"
    verification:
      - kind: unit
        ref: "ServiceEditorView.test.ts — E-12 (ids/positions/order identical after mount) and E-16 (HYMN-containing fixture: count/ids/order/positions unchanged, HYMN slot still renders its content row)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Hands-on feel of the new palette and shared body editor with a real service"
    verification: []
    human_judgment: true
    rationale: "The unit suite proves palette membership, body round-trip, URL absence and ordering stability against a mounted component, not that the textarea feels right or that long pasted announcement text wraps and grows as intended in a real browser. Recorded as a deferred owner check in .planning/PENDING-VERIFICATION.md § Phase 43 § Plan 43-03."

duration: interrupted-then-resumed
completed: 2026-08-07
status: complete
---

# Phase 43 Plan 03: Shared Body Editor for Message, Announcements and Miscellaneous Summary

**Gave the planner the editor surface for the new item kinds: two new palette chips (Announcements, Miscellaneous) added to both palette rows, the Hymn chip retired from the palette (but not the type), one shared body `<textarea>` serving Message/Announcements/Miscellaneous, and the Message URL control removed from the markup while its `linkUrl`/`linkLabel` type fields and stored values remain untouched.**

## Resumption Note

This plan's execution was interrupted by a power loss after all three tasks' work was written and green, but before the final commit and this SUMMARY. On resume (2026-08-07, model switched to Opus 4.8), the state was reconstructed from git history and the working tree: Tasks 1 and 2 were already committed (`e6bfa98`, `9baf3d6`); Task 3's completed test work sat uncommitted in `ServiceEditorView.test.ts` (335 lines, all 254 tests passing). Task 3 was committed as `9f78b6f` and every acceptance criterion re-verified — `npm run type-check` exits 0, all acceptance greps match, and all six probe edges are present — before this SUMMARY was written. No work was lost or redone; the crash landed in the gap between "green" and "committed."

## Accomplishments

- Both palette rows — the bottom `add-to-service-palette` and the per-section inline chip row — now offer **Announcements** (`palette-add-announcements` / `section-add-announcements-{key}`) and **Miscellaneous** (`palette-add-misc` / `section-add-misc-{key}`) chips, using each row's own verbatim static class string and testid convention. The **Hymn** chip was deleted from both rows entirely (no `v-if="false"`, no commemorative comment). The HYMN `SlotKind`, its `createSlot` factory, `slotLabel()` and its slot-content render branch are all untouched — HYMN is retired from the palette, not from the type.
- One shared slot-content branch, keyed on a three-kind test (MESSAGE/ANNOUNCEMENTS/MISC), replaces the former Message-only branch. It carries a single `<textarea>` (`slot-body-input`) bound to `NonAssignableSlot.body` via the file's `:value`/`@input` idiom, a `slotLabel()`-derived heading, a `bodyPlaceholder`-driven placeholder, a read-only viewer arm (`slot-body-text`, whitespace-preserved) and an italic empty-state arm (`slot-body-empty`) matching the HYMN/IMPORTED em-dash convention. An empty `body` renders as the empty state, never as an error.
- The Message link `<input>` elements, the editor open-link anchor and the viewer read-only link block were deleted from the markup. `linkUrl`/`linkLabel` remain in `NonAssignableSlot`, remain in Firestore, and the PRAYER branch keeps its own link UI byte-identical — no migration, no stored value read, copied or cleared.
- `bodyPlaceholder` (a static three-kind lookup typed to only the kinds it serves), two `elementLabel()` cases (singular "announcement" / "miscellaneous item"), and a split of `isSlotPopulated`'s MESSAGE/PRAYER arm (PRAYER keeps its link check; the three text kinds use a trimmed `body` check) were added. `isSlotPopulated` remains dead code (IN-01) and was kept consistent, not revived.
- Task 3 (TDD) added an editor-coverage suite to `ServiceEditorView.test.ts`: the exactly-five-chips test was updated in place to six chips plus an explicit negative assertion that the Hymn palette testid is absent, and a new describe block traces each of the six owned probe edges (E-02, E-06, E-09, E-11, E-12, E-16) plus UI-05 (repeat clicks) and UI-06 (`elementLabel` copy) to named tests. The Message URL removal is proven scoped by a paired Prayer-row assertion; stored `linkUrl` survival is asserted on the data.
- `npm run type-check` (`vue-tsc --build`) exits 0. `ServiceEditorView.test.ts` runs 254/254 green.

## Task Commits

1. **Task 1: Retire the Hymn chip; add Announcements and Miscellaneous to both palette rows** — `e6bfa98` (feat)
2. **Task 2: One shared body editor; remove the Message URL control** — `9baf3d6` (feat)
3. **Task 3: Editor coverage — palette membership, body round-trip, URL absence, stored-link survival** — `9f78b6f` (test)

## Files Created/Modified

- `src/views/ServiceEditorView.vue` — two new chips in each palette row, Hymn chips deleted; the Message-only slot-content branch widened to a shared MESSAGE/ANNOUNCEMENTS/MISC branch with a single `<textarea>`; Message link inputs/anchor deleted; `bodyPlaceholder` helper, two `elementLabel` cases, `isSlotPopulated` arm split. PRAYER and HYMN branches verified unchanged by `git diff`.
- `src/views/__tests__/ServiceEditorView.test.ts` — exactly-five-chips test updated to six-with-negative; new describe block covering E-02/E-06/E-09/E-11/E-12/E-16 and UI-05/UI-06.

## Decisions Made

- **Palette-only Hymn retirement.** Chip `<button>` elements deleted outright from both rows; the HYMN type, factory, label and render branch left fully intact so a stored HYMN slot stays constructible and renderable. The render/print/present/export half of R084 is explicitly deferred to plan 04, not claimed here.
- **`isSlotPopulated` arm split for consistency only.** Kept coherent with the UI's new body-based rule but remains dead code (IN-01, unreachable since Phase 12-05) and was not wired to anything.
- **Export-failure label left on raw `slot.kind`.** A failed Announcements export reports its raw union string, not its display name — cosmetic, covered by no requirement, already accepted as T-43-10 in 43-02-PLAN.md.

## Deviations from Plan

None. All three tasks were implemented as written; every acceptance criterion in the plan verifies pass (greps, six probe edges, `type-check` 0, targeted vitest 254/254). The only departure from an ordinary run was the crash-and-resume described above, which changed no plan content.

## Issues Encountered

The session running this plan was lost to a power failure between Task 3 going green and its commit. Recovered on resume with no lost or redone work — see Resumption Note.

## User Setup Required

None — no external service configuration required.

**Deferred owner verification added to `.planning/PENDING-VERIFICATION.md` § Phase 43 § Plan 43-03:** a hands-on pass on the new palette and shared body editor with a real service — that Announcements/Miscellaneous items add and type as expected, that the Message box is now a plain text area with no URL control, and that long pasted body text wraps and grows downward rather than scrolling the row sideways.

## Next Phase Readiness

- The add-item palette Phase 44's default-template editor consumes is now finalized: Song, Scripture, Prayer, Message, Announcements, Miscellaneous — no Hymn.
- Plan 04 inherits the deferred hard half of R084: prove a stored HYMN slot still renders, prints, presents and exports correctly now that the palette no longer offers it.
- `npm run type-check` is 0 errors; `ServiceEditorView.test.ts` is 254/254; the full-app failing-file baseline is unchanged (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`).

---
*Phase: 43-service-item-types*
*Completed: 2026-08-07 (interrupted 2026-08-07, resumed and closed same day)*

## Self-Check: PASSED

Both modified source files present on disk (`src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`); all three task commits (`e6bfa98`, `9baf3d6`, `9f78b6f`) found in git history; `type-check` exits 0; targeted vitest 254/254.
