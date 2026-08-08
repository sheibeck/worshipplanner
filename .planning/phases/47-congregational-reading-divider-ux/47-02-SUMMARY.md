---
phase: 47-congregational-reading-divider-ux
plan: 02
subsystem: ui
tags: [vue, congregational-reading, scripture-divider, chip, tailwind]

requires:
  - phase: 47-01
    provides: "CongregationalSection.speaker ALL union, splitPerVerse utility, widened AI split schema/validator"
provides:
  - "CongregationalEditor.vue boundary-indexed internal draft model"
  - "Three equally-weighted seeds (Split with AI / Alternate Leader-Congregation / Start Blank)"
  - "Click-between-verses gap-+ divider insert/remove"
  - "3-way Leader/Congregation/All segmented chip per segment"
  - "hasManuallyEdited re-seed confirm"
  - "alignSegmentsToBoundaries text-to-boundary mapping helper"
affects: [47-03, presentation-viewer, slide-display]

tech-stack:
  added: []
  patterns:
    - "Boundary-indexed draft ({speaker, startBoundary, endBoundary}[]) computed once per fetch, never recomputed mid-edit"
    - "Text-to-boundary alignment by byte-exact string match walk (alignSegmentsToBoundaries), used uniformly by all three seeds"
    - "Dual render path: boundary-indexed draft (post-fetch) vs. legacy mountedSections (pre-fetch, already-persisted sections) unified via a displaySegments computed for the read-only preview"

key-files:
  created: []
  modified:
    - src/components/CongregationalEditor.vue
    - src/components/__tests__/CongregationalEditor.test.ts

key-decisions:
  - "AI seed's return type (CongregationalSection[]) was NOT widened to pre-slice indices (RESEARCH Open Question 1's alternative path taken instead) — the editor maps the AI's text-bearing result back into boundary indices via alignSegmentsToBoundaries, keeping claudeApi.ts's stable, heavily-invariant-commented contract untouched"
  - "Divider gap-+ and remove testids are boundary-index-suffixed (divider-insert-{i}, divider-remove-{i}) rather than segment-index-suffixed, since multiple gaps can exist within one segment and the boundary index is the only unique, stable identifier"
  - "Reopening an editor with already-persisted sections and no fetch this session (mountedSections) supports only the 3-way chip, not the divider UI — same limitation the pre-47-02 component had (no rawText/boundaries exist to divide against)"

requirements-completed: [R095, R096]

coverage:
  - id: D1
    description: "Fetch renders one undivided Leader block with a neutral 'Choose a starting point' seed row (AI/Alternate/Blank); no seed auto-commits"
    requirement: "R096"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#renders one undivided Leader block and a \"Choose a starting point\" row with all three seeds (AI on)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AI-off: Split with AI is absent while Alternate/Blank remain fully functional (never a degraded path)"
    requirement: "R096"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#AI-off: ai-split-btn is absent while the other two seeds remain present and fully functional"
        status: pass
    human_judgment: false
  - id: D3
    description: "Start Blank produces one segment per verse, all Leader; Alternate reproduces alternating Leader/Congregation; both boundary-aligned"
    requirement: "R096"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#produces one segment per verse, all Leader, and does not call splitPassage"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#reproduces alternating Leader/Congregation from splitPassage grouping, boundary-aligned"
        status: pass
    human_judgment: false
  - id: D4
    description: "AI seed maps its text-bearing result into the boundary-indexed draft; the resulting segment stays re-divisible via gap-+"
    requirement: "R096"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#maps the AI result into the boundary-indexed draft, and the resulting segment is sub-dividable"
        status: pass
    human_judgment: false
  - id: D5
    description: "Gap-+ insert splits one segment into two (new segment inherits parent speaker); divider-remove merges two segments keeping the upper speaker; no text lost"
    requirement: "R095"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#clicking a gap-+ inserts a divider, splitting one segment into two that together reconstruct the original text"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#clicking an existing divider removes it, merging the neighbours and keeping the UPPER segment speaker"
        status: pass
    human_judgment: false
  - id: D6
    description: "3-way Leader/Congregation/All chip sets each segment independently; non-adjacent segments (Psalm 136 refrain) can share a label with a different role in between"
    requirement: "R095"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#the 3-way chip sets each segment independently — a non-adjacent refrain (Psalm 136) shares a label with a different role in between"
        status: pass
    human_judgment: false
  - id: D7
    description: "Re-seed confirm shown only after a manual edit; first seed on a fresh/unedited draft applies immediately; replace/cancel both behave correctly"
    requirement: "R096"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#applies the FIRST seed on a freshly-fetched, never-edited draft with no confirm"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#shows a confirm on re-seeding after a manual edit; cancel leaves the draft untouched"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#confirming replace applies the new seed"
        status: pass
    human_judgment: false
  - id: D8
    description: "translationSource stamped once at fetch (R092) survives a settings change plus a seed plus a subsequent divider edit"
    requirement: "R096"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#R092: a settings change AFTER fetch does not restamp — survives a seed AND a subsequent divider edit"
        status: pass
    human_judgment: false
  - id: D9
    description: "Touch discoverability of the gap-+/divider-remove affordance at phone width (opacity-40 below md, hover/focus-reveal at md+, 44x44 hit area)"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC backstop row — explicitly deferred to manual /gsd-verify-work; cannot be proven by a DOM assertion alone (no real viewport/hover simulation in jsdom)"

duration: ~45min
completed: 2026-08-08
status: complete
---

# Phase 47 Plan 02: CongregationalEditor Divider UX Rework Summary

**Reworked `CongregationalEditor.vue` from fetch-auto-splits-then-binary-toggle into a boundary-indexed hand-divide editor with three equal seeds (AI/Alternate/Blank), click-between-verses gap-+ dividers, a 3-way Leader/Congregation/All chip, and a re-seed confirm — all three seeds resolve to the same draft shape via a byte-exact text-to-boundary alignment helper.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Internal boundary-indexed draft (`{speaker, startBoundary, endBoundary}[]`) computed once per fetch from `computeBoundaries(rawText)`, never recomputed mid-edit — `CongregationalSection[]` is a pure derived projection via `sliceAtBoundaries`/`stripVerseMarkers`/`verseRangeForSlice`.
- Three equally-weighted, neutral-styled seeds — Split with AI (gated by `authStore.settings.aiEnabled`), Alternate Leader/Congregation, Start Blank — replacing the old auto-split-on-fetch + separate AI opt-in. Fetch now renders one undivided Leader block; the user picks a seed.
- `alignSegmentsToBoundaries`: a single generic helper that maps any seed's `{speaker, text}[]` result onto boundary indices by walking forward and matching byte-exact stripped slice text. Used uniformly by AI, Alternate, and Blank, so an AI-seeded segment stays exactly as re-divisible as a hand-built one (RESEARCH Pitfall 2's fix).
- Click-between-verses divider editing: gap-`+` insert (new segment inherits the parent's speaker) and divider-remove (merges two segments, keeping the upper's speaker) — both snapped only to `computeBoundaries` legal break points.
- 3-way `speaker-chip-{idx}-{leader|congregation|all}` segmented control per segment, replacing the old binary toggle — any segment independently takes any role, supporting non-adjacent shared labels (Psalm 136 refrain) with no special affordance.
- `hasManuallyEdited`-gated re-seed confirm ("Replace your dividers?") — the first seed on a fresh/unedited draft applies immediately; any subsequent seed pick after a hand edit requires explicit confirm/cancel.
- LEADER chip/preview recoloured from indigo to sky-300/sky-900/50 so the editor's preview WYSIWYG-matches the presenter; ALL uses violet-300/violet-900/50; indigo is now reserved for Fetch Passage, focus rings, and the gap-`+` hover state only.
- Preserved the legacy "mounted with already-persisted sections, no fetch this session" display path (3-way chip works, no divider UI, since there is no `rawText`/`boundaries` to divide against) — same limitation the pre-47-02 component had.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — write the failing editor tests** - `95d7731` (test)
2. **Task 2: Rework CongregationalEditor.vue** - `e1148d6` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/CongregationalEditor.vue` - Full rework: boundary-indexed draft, three seeds, gap-+ divider insert/remove, 3-way chip, re-seed confirm, indigo→sky LEADER recolour.
- `src/components/__tests__/CongregationalEditor.test.ts` - Rewritten (not appended) to lock the new contract: 28 cases covering seeds, AI-off gating, divider insert/remove, non-adjacent chip labeling, re-seed confirm, and translationSource persistence across a settings change + seed + divider edit.

## Decisions Made

- Kept `claudeApi.ts::splitCongregationalReading`'s existing `CongregationalSection[] | null` return contract untouched (RESEARCH's Open Question 1 flagged two options); the editor performs the boundary re-location itself via `alignSegmentsToBoundaries`, per the plan's explicit constraint not to refactor `claudeApi.ts` internals.
- Divider testids are boundary-index-suffixed (`divider-insert-{i}`, `divider-remove-{i}`) rather than segment-index-suffixed, since a single segment can contain multiple interior gaps and the boundary index is the only stable, unique identifier for each one.
- `EditSlideDrawer.vue`'s binary speaker toggle (RESEARCH Pitfall 5 / Assumption A3) was left untouched — out of this plan's file list (`CongregationalEditor.vue` + its test only); tracked as a known gap for plan 03 or a follow-up, not silently ignored.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed as separate commits (test → feat), matching the Wave 0 red / Task 2 green structure the plan specified.

## Issues Encountered

- One test (`AI-off: ai-split-btn is absent...`) initially failed because `useAuthStore().settings.aiEnabled = false` was set before `mountEditor()` — the store's own async `onAuthStateChanged` listener resets `settings` to defaults on a microtask after mount, silently overwriting a pre-mount mutation (an existing, already-documented race in this test file's other ESV-routing tests). Fixed by moving the mutation to after `await flushPromises()`, matching the file's own established precedent — not a defect in the component.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (presenter/grid ALL-role rendering, R097) can proceed: `CongregationalEditor.vue` now emits sections whose `speaker` may be `'LEADER' | 'CONGREGATION' | 'ALL'`, matching the widened type from 47-01.
- `EditSlideDrawer.vue`'s binary speaker toggle (RESEARCH Pitfall 5) remains an open, documented gap — will silently misbehave (ALL → LEADER, skipping CONGREGATION) on an ALL-labeled slide once such data exists. Not in this plan's file list; flag for plan 03 or a follow-up decision.
- Manual/deferred per plan: touch discoverability of the gap-+/divider-remove affordance at phone width (backstop, D9 above), and hand-dividing Psalm 136/Psalm 24 for UX friction (VALIDATION.md Manual-Only) — both recorded here for `/gsd-verify-work`, not blocking.

---
*Phase: 47-congregational-reading-divider-ux*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: src/components/CongregationalEditor.vue
- FOUND: src/components/__tests__/CongregationalEditor.test.ts
- FOUND commit: 95d7731 (test(47-02): rewrite CongregationalEditor tests for 3 seeds, divider, 3-way chip)
- FOUND commit: e1148d6 (feat(47-02): rework CongregationalEditor into a hand-divide 3-seed editor)
