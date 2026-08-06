---
phase: 30-slides-mirror-the-plan-hard-lock-reconciliation-removed
plan: 03
subsystem: slides-engine
tags: [vue, vitest, slides, ui]

# Dependency graph
requires:
  - phase: "30-01"
    provides: "reconcile*/confirm vocabulary removed; ReconcileConfirmModal deleted"
  - phase: "30-02"
    provides: "unconditional idempotent rebuild per group kind; scripture derivation narrowed to a single reference-only entry"
provides:
  - "EditSlideDrawer.vue: isSongGroup/canMutate gating computed — every slide mutation control (label, notes, editable body, audio scope/attach/remove, Duplicate/Delete footer) absent for a SONG plan item, never merely disabled"
  - "SlideGrid.vue: isSongGroup gating — Add slide/Import buttons absent, drag-reorder disabled, drop dispatch narrowed to audio-only for a song group, with a visible refusal notice for any other dropped file class"
  - "A retained read-only affordance triad on both components: hidden controls + a muted informational notice/badge + the existing Edit in song link"
  - "scripturePassageText falls back to the slide's reference when resolved text is empty (R047 ripple from 30-02's narrowing)"
affects: ["30-04"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "R054 read-only gating: a single isSongGroup computed derived from an EXISTING prop (planItem in the drawer, selectedSlot in the grid) feeding a canMutate/gating computed consumed by plain v-if — no new prop threaded, no new gating mechanism, matching every other read-only lock already in this codebase."
    - "Read-only affordance triad (absence + muted notice + redirect link) as the pattern for any future locked-surface UI in the Slides tab."

key-files:
  created: []
  modified:
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/__tests__/SlideGrid.test.ts
  deleted: []

key-decisions:
  - "Task 1 repointed EditSlideDrawer.test.ts's mountDrawer() SONG default to MESSAGE, alone, before any production change — confirmed by PATTERNS.md's pre-planning analysis that this was a one-line default change plus one context-line-test fixup (not a 92-call-site rewrite). Verified: only 1 test needed an explicit override."
  - "The drawer's audio scope/attach/remove controls (per-slide audio) ARE gated for a song group — CONTEXT.md's 'still accepts group-level media' applies to the GROUP's bed audio (SlideGroupMusicControl in SlideGrid.vue), not to a slide's own audio-scope choice, which is a slide-level mutation like any other."
  - "The song-group drop refusal in SlideGrid.vue reuses the existing rejectionNotice/timeout mechanism with a new song-specific message, rather than adding a second notice UI — parameterized showRejectionNotice(message) to keep the genuine unsupported-file-type message and the song-lock message on one mechanism."
  - "Added a quiet read-only badge to SlideGrid.vue's header for parity with the drawer's notice (plan's 'optionally, for parity' discretion) — muted Tailwind idiom, own test id, gated the same as the notice."

patterns-established:
  - "isSongGroup/canMutate as the R054 gating pair — any future Slides-tab surface that needs the same lock should read planItem/selectedSlot's kind directly rather than inventing a new prop or directive."

requirements-completed: [R054]

coverage:
  - id: D1
    description: "With a SONG plan item selected, the Slides tab drawer offers no way to create, edit, delete, duplicate or reorder that group's slides — every mutation control absent from the DOM, not disabled"
    requirement: R054
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#EditSlideDrawer (R054 — song groups are read-only)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A song group still shows a visible read-only notice plus the retained Edit in song link, for both a lyric entry and a copyright entry"
    requirement: R054
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#EditSlideDrawer (R054 — song groups are read-only) — shows the read-only notice / still offers the Edit in song link"
        status: pass
    human_judgment: false
  - id: D3
    description: "The slide grid removes Add slide/Import and drag-reorder for a song group, while cards remain selectable and every non-song group is unaffected"
    requirement: R054
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#R054 — song groups are read-only"
        status: pass
    human_judgment: false
  - id: D4
    description: "A song group still accepts group-level bed audio (control and drop), and refuses a deck/image/video drop with a visible notice instead of silently ignoring or appending it"
    requirement: R054
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts#R054 — song groups are read-only — audio drop / video drop / deck drop / music control"
        status: pass
    human_judgment: false
  - id: D5
    description: "A scripture entry's slide-text block shows the passage reference rather than a blank block, now that resolved scripture text is always empty (R047 ripple)"
    requirement: R047
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#EditSlideDrawer (R054 — song groups are read-only) — a scripture entry's slide-text block shows the passage reference when the resolved text is empty (R047 ripple)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Type-check is green and the full-suite failing-file set has not grown beyond the documented baseline"
    requirement: R054
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build), zero errors"
        status: pass
      - kind: unit
        ref: "npx vitest run (full suite): 12 failed files / 155 passed (167) — matches 30-02-SUMMARY.md's documented baseline exactly; 3605 passed / 34 failed / 18 skipped tests (3657 total, +19 for this plan's new coverage), zero new failing files"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-07-29
status: complete
---

# Phase 30 Plan 03: Song Groups Are Read-Only in the Slides Tab Summary

**Song groups in the Slides tab now expose zero slide create/update/delete/reorder affordances — controls are absent from the DOM, not disabled — while retaining group-level bed audio and the existing Edit in song link, plus a new muted read-only notice on both the drawer and the grid.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-29T05:04:02Z
- **Completed:** 2026-07-29T05:24:27Z
- **Tasks:** 3 completed
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments
- `EditSlideDrawer.vue` gains `isSongGroup`/`canMutate` computed properties, read from the existing `planItem` prop (no new prop threaded); every mutation control — label input, notes textarea, editable slide-text textarea, audio scope choice, audio remove, audio attach, and the Duplicate/Delete Slide footer — is now gated on `canMutate` instead of `isEditor` alone, so a SONG plan item renders none of them
- The two "Edit in song" links and "Edit in scripture" stay gated on `isEditor` alone (CONTEXT.md's explicit retained affordance), and a new muted `data-testid="drawer-song-readonly-notice"` names the Song Lyrics screen as the place to edit
- `scripturePassageText` falls back to the slide's `reference` when its resolved `text` is empty (always, per 30-02's narrowing) — a scripture slide's Slide Text block now shows the passage reference instead of going blank
- `SlideGrid.vue` gains a matching `isSongGroup` computed read from `selectedSlot`; the Add slide and Import header buttons are absent (not disabled) for a song group, `canReorder` is false so no Sortable instance is ever created for it, and `onFilesDropped` branches on `isSongGroup` to route only a resolved audio file through `attachDroppedAudio` — a deck, image, or video drop appends nothing and surfaces a visible refusal notice via the existing `rejectionNotice` mechanism (parameterized to carry a song-specific message)
- `SlideGroupMusicControl` (group-level bed audio) and the drop tile itself are untouched — a song group still attaches/removes its shared music by control and by audio drop, exactly as CONTEXT.md requires
- A quiet read-only badge (`slide-grid-song-readonly-badge`) mirrors the drawer's notice in the grid header, for parity
- The Task 1 test-fixture landmine was defused exactly as PATTERNS.md predicted: `mountDrawer()`'s SONG default repointed to MESSAGE in its own commit, suite green before any production change, with only 1 test (of 95) needing an explicit SONG override

## Task Commits

1. **Task 1: Repoint the drawer test fixture off SONG, before touching the component** - `12388c3` (test)
2. **Task 2: Lock the Edit Slide drawer for song groups, and show why** - `fe52d17` (feat)
3. **Task 3: Lock the slide grid for song groups without blocking group media** - `0728ed7` (feat)

**Plan metadata:** pending (docs: complete plan, this commit)

## Files Created/Modified
- `src/components/slides/EditSlideDrawer.vue` - `isSongGroup`/`canMutate` gating computed; every mutation control template `v-if` swapped to `canMutate`; new read-only notice block; `scripturePassageText` reference fallback
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` - `mountDrawer()`'s hardcoded SONG default repointed to MESSAGE (Task 1); one context-line test given an explicit SONG override; new `R054 — song groups are read-only` describe block (11 tests) covering control absence, retained links/notice, viewer behavior, the non-song contrast case, and the scripture reference fallback
- `src/components/slides/SlideGrid.vue` - `isSongGroup` computed; Add slide/Import buttons gated; `canReorder` gated; `onFilesDropped` branches on song-group status; `showRejectionNotice` parameterized to carry a song-specific message; new read-only header badge
- `src/components/slides/__tests__/SlideGrid.test.ts` - new `R054 — song groups are read-only` describe block (8 tests) covering both header buttons, card selectability, `reorderable=false`, audio-drop success, video/deck-drop refusal with notice, and the retained group music control
- `.planning/phases/30-slides-mirror-the-plan-hard-lock-reconciliation-removed/deferred-items.md` - logged a pre-existing, unrelated `vitest/no-conditional-expect` lint finding in `SlideGrid.test.ts` (out of this task's scope)

## Decisions Made
- Confirmed via `git show HEAD:...` diffing that the pre-existing `vitest/no-conditional-expect` lint errors surfaced when scoping `npx eslint` to `SlideGrid.test.ts` predate this plan's changes — logged to `deferred-items.md` rather than fixed, per the Scope Boundary (issues not directly caused by the current task's changes)
- Gated the drawer's per-slide audio scope/attach/remove controls for song groups (they are slide-level mutations, distinct from the group's own bed audio which stays open via `SlideGroupMusicControl`)
- Reused the existing `rejectionNotice` mechanism in `SlideGrid.vue` for the song-group drop refusal rather than adding a second notice UI, parameterizing `showRejectionNotice` to accept a message

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their described actions; the fixture-repoint risk called out in the plan's landmine section resolved exactly as PATTERNS.md predicted (one-line default change, one context-line test fixup, zero production churn from the test change).

## Known Stubs

None — no stub patterns introduced. The read-only notice and badge are fully wired UI, not placeholders.

## Threat Flags

None — every threat register item from the plan's `<threat_model>` (T-30-03-01 through T-30-03-03, T-30-30-SC) was addressed as designed:
- T-30-03-01 (UI-only lock, accepted residual): no Firestore rule change made, matching the plan's explicit scope boundary
- T-30-03-02 (drop dispatcher write narrowing): mitigated — `onFilesDropped` branches per file class for a song group, asserted by paired audio-succeeds/video-refused tests
- T-30-03-03 (over-broad gating hiding bed audio): mitigated — `SlideGroupMusicControl` and the Edit in song link asserted present for song groups in both new describe blocks

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Song groups are fully locked in the Slides tab; the reconciliation subsystem (removed in 30-01/30-02) and the read-only lock (this plan) are both complete, leaving 30-04 free to do the final removal-proof gate (grep sweep for reconcile/confirm vocabulary) with no remaining coordination surface
- No blockers for 30-04

---
*Phase: 30-slides-mirror-the-plan-hard-lock-reconciliation-removed*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: `src/components/slides/EditSlideDrawer.vue`
- FOUND: `src/components/slides/__tests__/EditSlideDrawer.test.ts`
- FOUND: `src/components/slides/SlideGrid.vue`
- FOUND: `src/components/slides/__tests__/SlideGrid.test.ts`
- FOUND: `.planning/phases/30-slides-mirror-the-plan-hard-lock-reconciliation-removed/deferred-items.md`
- FOUND: commit `12388c3` (test, Task 1)
- FOUND: commit `fe52d17` (feat, Task 2)
- FOUND: commit `0728ed7` (feat, Task 3)
