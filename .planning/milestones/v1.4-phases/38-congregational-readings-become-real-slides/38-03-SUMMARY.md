---
phase: 38-congregational-readings-become-real-slides
plan: 03
subsystem: slides
tags: [vue, typescript, slide-groups, scripture, congregational-reading, edit-slide-drawer]

# Dependency graph
requires:
  - phase: 38-01
    provides: the two-state scripture group mechanism — SourceRef's scripture member widened with speaker/text/verseRange, congregationalSectionFromRef/congregationalSectionsFromSlot as the ONE congregational-ness predicate, and one assembled ScriptureSlide per section
  - phase: 38-02
    provides: ScriptureSlide.section (singular), and the presentation-speaker/presentation-congregational-section testid anchors this plan's drawer control mirrors
provides:
  - "speakerDisplayName (src/components/slides/slideDisplay.ts) — the ONE producer of the natural-case 'Leader'/'Congregation' words, read by the eyebrow, the footer and the drawer's speaker control"
  - "slideContentLabel/slideFooterLabel section-aware for a Congregational-state scripture slide — LEADER/CONGREGATION eyebrows and a reference-plus-speaker footer distinguish N section cards from one reading"
  - "EditSlideDrawer.vue edits a section entry's words (debounced, writes sourceRef.text) and speaker (immediate write, matches onLoopToggle's shape) — both gated to congregationalSectionFromRef, both leaving every sibling entry byte-identical"
  - "A Reference-state scripture entry is completely unchanged: read-only block, caption, route-out button to the congregational-reading editor"
affects: [38-04, SlideGrid.vue, PresentationViewer.vue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "congregationalSectionFromRef as the SINGLE predicate consulted at every decision point in EditSlideDrawer.vue's scripture branch (template split, writeField's body-flush branch, the seed/resync/input-handler trio, the speaker control's render/write) — no second inline speaker check anywhere in the component"
    - "Immediate (non-debounced) two-value writes mirror onLoopToggle's shape: re-check canMutate inside the handler, read props.group.slides fresh as the base, map only the selected entry, await the store call"

key-files:
  created: []
  modified:
    - src/components/slides/slideDisplay.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/slideDisplay.test.ts
    - src/components/slides/__tests__/EditSlideDrawer.test.ts

key-decisions:
  - "slideActionMenuItems needed NO change — confirmed by reading, the existing `kind === 'scripture'` branch already returns duplicate+delete under canMutate regardless of whether `speaker` is set, so deletion of a single section slide was already reachable before this plan. Added a standing guard test (a scripture SECTION entry) rather than new menu logic."
  - "The editable scripture passage field's exact test-id is data-testid=\"drawer-slide-text-editable-scripture\" — distinct from the text-kind's drawer-slide-text-editable, so 38-04 can target it unambiguously."
  - "The speaker toggle's test-ids: data-testid=\"drawer-speaker-toggle\" (interactive, mutation allowed), data-testid=\"drawer-speaker-readonly\" (plain text, mutation disallowed), data-testid=\"drawer-speaker-row\" (the wrapping row, absent entirely for a Reference-state entry)."
  - "Footer separator for a section slide chosen as \"·\" (the same middot EditSlideDrawer.vue's own contextText already uses, e.g. 'Title · slide 3 of 6'), producing 'John 3:16 · Leader' — no new separator convention introduced."
  - "The speaker flip is deliberately NOT routed through the debounced body-write machinery: it's a discrete two-value choice, not a stream of keystrokes, and sharing the debounce could lose a flip to a pending flush for a different field. Modeled instead on onLoopToggle's existing immediate-write shape."
  - "bodySeed() is a new small helper (not present before this plan) centralizing 'what words does this entry's body field seed from' — a text-kind entry's own body, a Congregational-state section's own text, or '' otherwise — used by both resetLocalFields and the external-change resync watcher so the two never drift on the seeding rule."

requirements-completed: [R072]

coverage:
  - id: D1
    description: "A Congregational-state section slide's card names its speaker (LEADER/CONGREGATION eyebrow, reference-plus-speaker footer) — a Reference-state slide is unchanged"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#slideContentLabel > names the speaker in the eyebrow for a LEADER or CONGREGATION section slide, and keeps SCRIPTURE for a Reference-state slide"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/slideDisplay.test.ts#slideFooterLabel > names the reference AND the readable speaker name for a section slide"
        status: pass
    human_judgment: false
  - id: D2
    description: "Opening the drawer on a section entry with mutation allowed renders an editable passage field seeded with that section's stored words; typing and flushing writes only that entry, leaving every sibling byte-identical (id, order, speaker included), passing sourceSignature through unchanged"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#Phase 38-03 Task 2 > writes only the edited entry's stored words after the debounce, leaving every sibling entry byte-identical — id, order and speaker included"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#Phase 38-03 Task 2 > passes the group's stored sourceSignature through unchanged on the write"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Reference-state scripture entry's drawer view is completely unchanged — read-only block, caption, and the route out to the congregational-reading editor, with no editable field appearing"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#Phase 38-03 Task 2 > renders the existing read-only block and the existing route out for a Reference-state entry — no editable scripture field appears"
        status: pass
    human_judgment: false
  - id: D4
    description: "A section entry's speaker can be flipped independently of its words — id, order, words, notes and audio unchanged, every sibling byte-identical, sourceSignature passed through unchanged; no speaker control renders for a Reference-state entry or when mutation is disallowed; the flip updates the drawer's own display without reopening"
    requirement: "R072"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#Phase 38-03 Task 3 > activating it writes only that entry's speaker flipped — id, order, words, notes and audio unchanged, every sibling byte-identical"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#Phase 38-03 Task 3 > renders no speaker control at all for a Reference-state scripture entry"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#Phase 38-03 Task 3 > updates what the drawer displays immediately after a flip, without the drawer being reopened"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both binding gates (npm run type-check via vue-tsc --build, and the full app suite) pass with no failures outside the documented two-file baseline"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
      - kind: unit
        ref: "npx vitest run --dir src --exclude '**/rules.test.ts' (2484 tests, 2475 passed, 9 failed — all in src/storage.rules.test.ts and src/views/__tests__/RosterView.test.ts)"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-05
status: complete
---

# Phase 38 Plan 03: Section Slides Are Independently Editable Summary

**A Congregational-state section slide now names its speaker on its card, and the Edit Slide drawer edits that section's words and flips its speaker independently of every sibling — both writes gated to the single `congregationalSectionFromRef` predicate, leaving a Reference-state scripture slide completely untouched.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-05
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `speakerDisplayName` (`slideDisplay.ts`) is the new single producer of the natural-case `Leader`/`Congregation` words — `slideContentLabel`'s eyebrow (uppercased), `slideFooterLabel`'s footer, and `EditSlideDrawer.vue`'s speaker control all read through it.
- `slideContentLabel`'s scripture case names the speaker in the eyebrow (`LEADER`/`CONGREGATION`) for a Congregational-state section slide; a Reference-state slide keeps `SCRIPTURE` unchanged — N section cards from one reading are now told apart at a glance.
- `slideFooterLabel`'s scripture case names the reference AND the speaker (`John 3:16 · Leader`) for a section slide; a Reference-state slide keeps the bare reference.
- Confirmed by reading (not assumed): `slideActionMenuItems` already offered duplicate+delete for every scripture-kind entry, section or not — no change needed there. Added a standing guard test on a section entry so a later menu change can't quietly remove deletion.
- `EditSlideDrawer.vue`'s Slide Text scripture branch now splits on `congregationalSectionFromRef(props.entry.sourceRef)` — a Congregational-state section entry gets an editable multi-line passage field (`data-testid="drawer-slide-text-editable-scripture"`) bound to the existing debounced `localBody`/`writeField` machinery, which now branches its flush target between `sourceRef.body` (text-kind) and `sourceRef.text` (scripture section), guarded by the same predicate. A Reference-state entry is byte-for-byte unchanged: read-only block, caption, and the route-out button to the congregational-reading editor.
- A speaker toggle (`data-testid="drawer-speaker-toggle"` / `drawer-speaker-readonly`) sits above the passage field, matching the projected slide's speaker-above-passage order. `onSpeakerToggle` mirrors `onLoopToggle`'s immediate-write shape (re-check `canMutate` inside the handler, fresh `props.group.slides` base, map only the selected entry, awaited store call) and is deliberately NOT debounced. Every write in both tasks passes the group's stored `sourceSignature` through unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: The slide card names its speaker** - `ae009b0` (feat)
2. **Task 2: The drawer edits one section's words** - `1d72745` (feat)
3. **Task 3: The drawer flips a section between Leader and Congregation** - `cbbf9d3` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/slides/slideDisplay.ts` - `speakerDisplayName` helper; `slideContentLabel`/`slideFooterLabel` section-aware for scripture; rewrote the stale "future phase" comment in `slideBodyText`
- `src/components/slides/EditSlideDrawer.vue` - Scripture branch splits on `congregationalSectionFromRef`; `writeField`'s body flush, `bodySeed` (new helper), the external-change resync watcher and the `localBody` input handler all widened to admit a section entry; new speaker toggle + `onSpeakerToggle`; rewrote the stale "read-only for every kind except text" template comment and `scripturePassageText`'s stale "future Phase 34" doc comment
- `src/components/slides/__tests__/slideDisplay.test.ts` - Speaker-aware `slideContentLabel`/`slideFooterLabel`/`slideBodyText` cases, `speakerDisplayName` direct test, section-entry menu-items guard
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` - `makeScriptureSectionFixtures` fixture builder; Task 2's editable-field/write/sourceSignature/re-seed/no-clobber cases; Task 3's speaker-control/flip-write/sourceSignature/no-control/live-update cases

## Decisions Made

- **`slideActionMenuItems` needed no change** — confirmed by reading before writing anything, per the plan's explicit instruction not to build what already exists.
- **Test-id for the editable scripture passage field:** `drawer-slide-text-editable-scripture` (distinct from the text-kind's `drawer-slide-text-editable`) — recorded here since 38-04 references it.
- **Test-ids for the speaker control:** `drawer-speaker-toggle` (interactive), `drawer-speaker-readonly` (plain text), `drawer-speaker-row` (the wrapping row, absent entirely for a Reference-state entry — not merely emptied).
- **Footer separator:** `·` (the same middot the drawer's own `contextText` already uses), producing `John 3:16 · Leader` — no new separator convention introduced.
- **Speaker flip is not debounced**, by design — a discrete two-value choice sharing the debounced `body` machinery risked losing a flip to a pending flush for a different field. Modeled on the existing `onLoopToggle` immediate-write shape instead.
- **`bodySeed()`** is a new small helper centralizing "what words does this entry's body field seed from" (text-kind's own `body`, a section's own `text`, or `''` otherwise), used identically by `resetLocalFields` and the external-change resync watcher so the two can't drift on the seeding rule.

## Deviations from Plan

None — plan executed exactly as written. `slideActionMenuItems` was read and confirmed unchanged rather than modified, exactly as the plan's action text anticipated as the likely finding.

## Issues Encountered

One inline TypeScript literal-widening fix during Task 3: `const nextSpeaker = section.speaker === 'LEADER' ? 'CONGREGATION' : 'LEADER'` inferred as `string` (a known TS ternary-widening gotcha, not caught by editor tooling) rather than the `'LEADER' | 'CONGREGATION'` literal union `SourceRef` requires. Fixed with an explicit type annotation (`const nextSpeaker: 'LEADER' | 'CONGREGATION' = ...`). Caught immediately by `npm run type-check`; no behavior was ever wrong, only the type inference.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Roadmap criterion 3 (edit a section slide without altering its siblings) and the user-facing half of criterion 4 (delete one on its own — already reachable, confirmed not newly built) are both delivered. A Reference-state scripture slide's drawer experience is provably unchanged (dedicated test coverage, not just an absence of new failures).

38-04 (the "make it congregational" affordance, presumably) can rely on:
- `data-testid="drawer-slide-text-editable-scripture"` as the stable anchor for the editable passage field.
- `congregationalSectionFromRef` as the one predicate this drawer (and 38-01/38-02) already consult — no new discriminator should be invented.
- `speakerDisplayName` (`slideDisplay.ts`) as the one source of the `Leader`/`Congregation` display words.

No blockers. `npm run type-check` (vue-tsc --build) is clean; the full app suite
(`npx vitest run --dir src --exclude '**/rules.test.ts'`) shows 2475/2484 passing, with the 9 failures
confined to the documented two-file baseline (`src/storage.rules.test.ts`,
`src/views/__tests__/RosterView.test.ts`) — unchanged from before this plan.

---
*Phase: 38-congregational-readings-become-real-slides*
*Completed: 2026-08-05*

## Self-Check: PASSED

All 4 modified source and test files confirmed present on disk; all 3 task commits
(`ae009b0`, `1d72745`, `cbbf9d3`) confirmed present in `git log`.
