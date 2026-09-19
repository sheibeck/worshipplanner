---
phase: 142-slides-tab-panel-ux-from-claude-design
plan: 01
subsystem: ui
tags: [vue, pinia, firestore, popover, background, video-output, tdd]

# Dependency graph
requires: []
provides:
  - "setGroupBedMedia third patch branch: a no-MP3 vamp assigned to an existing slideGroups doc writes bedVampId/bedVampLabel and deleteField()s any stale bedAudioUrl"
  - "BackgroundControl variant='chip-popover' branch (142-UI-SPEC.md §4): None/recents/upload tiles, drop-to-upload, inherited-from-song explainer — additive, panel variant untouched"
  - "SlotVideoOutputControl Display tiles (142-UI-SPEC.md §3) with a dynamic sizeHint caption per mode; emit contract and testids unchanged"
affects: [142-02, 142-03, 142-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BackgroundControl variant prop split — additive branch keeps the default/panel path byte-identical for an untouched call site (SongLyricEditor.vue)"
    - "Shared uploadFile() extraction so input-change and drag/drop both funnel through one upload+emit path"

key-files:
  created: []
  modified:
    - src/stores/slideGroups.ts
    - src/stores/__tests__/slideGroups.test.ts
    - src/utils/__tests__/slideshowAssembler.test.ts
    - src/components/slides/BackgroundControl.vue
    - src/components/slides/__tests__/BackgroundControl.test.ts
    - src/components/slides/SlotVideoOutputControl.vue
    - src/components/slides/__tests__/SlotVideoOutputControl.test.ts
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "setGroupBedMedia's new branch is keyed on patch.bedVampId presence (not bedAudioUrl), placed after the existing bedAudioUrl branch, and explicitly deleteField()s bedAudioUrl so a stale Track/prior-vamp URL never lingers under a no-MP3 vamp's amber chip"
  - "BackgroundControl's swatches computed guarantees the current imageUrl is always a visible tile (prepended when absent from recents) so the highlight rule (CONTEXT.md) is always satisfiable"
  - "Narrowed one pre-existing SlideGrid.test.ts assertion (34-11 'merged panel' — zero bg-gray-900 descendants) to exclude the video-output tiles' own testids, since the new UI-SPEC §3 tile design legitimately gives the inactive Display tile its own background fill; the BackgroundControl/MusicControl 'flush' invariant it also covers is untouched"

patterns-established:
  - "Additive variant prop on a shared control (BackgroundControl) to serve two visually distinct call sites without touching the untouched one's tests or DOM"

requirements-completed: [R032, R055, R425, R437]

coverage:
  - id: D1
    description: "setGroupBedMedia writes a no-MP3 vamp (bedVampId/bedVampLabel) against an EXISTING group doc and deletes any stale bedAudioUrl; a URL-bearing patch still takes the existing branch; the setDoc/fresh-doc path is unchanged"
    requirement: "R425"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/slideGroups.test.ts#setGroupBedMedia — no-MP3 vamp against an existing doc (Phase 142)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live playback (slideshowAssembler) resolves no audioUrl/audioLoop for a group with bedVampId set and no bedAudioUrl — no throw"
    requirement: "R425"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideshowAssembler.test.ts#bedVampId with no bedAudioUrl resolves no audio and no loop (142 — live playback tolerates a no-MP3 vamp bed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "BackgroundControl variant='chip-popover' renders None/recent/upload tiles, current-URL highlight, drop-to-upload, and the inherited-from-song explainer; the default panel variant is unchanged"
    requirement: "R032"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/BackgroundControl.test.ts#BackgroundControl — variant=\"chip-popover\" (Phase 142)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SlotVideoOutputControl renders Full-screen/Banner as thumbnail tiles with a dynamic sizeHint caption per mode; the videoOutput.mode write and testids are unchanged"
    requirement: "R055"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlotVideoOutputControl.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual/interactive verification of the new Background and Display tile popovers in the browser (colors, spacing, drop affordance, focus states) is a real-render judgment call, not something the unit suite proves"
    verification: []
    human_judgment: true
    rationale: "Unit tests assert DOM structure/classes/emits, not rendered visual fidelity or drag-and-drop feel in a real browser — deferred to this milestone's batched UAT per STATE.md's existing v2.15 deferred-verification convention"

# Metrics
duration: 15min
completed: 2026-09-19
status: complete
---

# Phase 142 Plan 01: Store fix + BackgroundControl chip-popover + SlotVideoOutputControl tiles Summary

**Fixed the no-MP3-vamp write bug in `setGroupBedMedia`, added an additive `chip-popover` variant to `BackgroundControl`, and restyled `SlotVideoOutputControl` into UI-SPEC §3's thumbnail tiles — the three independently-testable leaf pieces every later Phase 142 plan composes.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-09-19T05:20:00Z (approx.)
- **Completed:** 2026-09-19T05:35:32Z
- **Tasks:** 3
- **Files modified:** 8 (7 planned + 1 deviation)

## Accomplishments
- `setGroupBedMedia`'s `existing.exists()` branch now has a third patch path keyed on `patch.bedVampId`, so assigning a vamp with no MP3 to an already-existing group document actually writes `bedVampId`/`bedVampLabel` and clears any stale `bedAudioUrl` via `deleteField()` — previously this silently no-opped (the one real logic bug in the phase, per RESEARCH.md Pitfall 1/Finding 4)
- `BackgroundControl.vue` gained an additive `variant="chip-popover"` branch rendering UI-SPEC §4's None/recent-thumbnail/upload tile row, drop-to-upload, and the inherited-from-song explainer, while the default `panel` variant (used by `SongLyricEditor.vue`) stays byte-identical
- `SlotVideoOutputControl.vue`'s two-segment pill toggle became UI-SPEC §3's Full-screen/Banner thumbnail tiles with a `sizeHint` computed that swaps the caption copy per mode; `select()`/`mode`/`change` emit contract unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: setGroupBedMedia — third patch branch + regression tests** - `f8b6983d` (fix)
2. **Task 2: BackgroundControl — chip-popover variant** - `8cff6f64` (feat)
3. **Task 3: SlotVideoOutputControl — Display tiles + dynamic caption** - `1a694329` (feat)

_All three tasks were `tdd="true"`; each commit bundles its tests and implementation together since the plan's RED/GREEN split was per-behavior within one task, not a separate test-then-feat commit pair._

## Files Created/Modified
- `src/stores/slideGroups.ts` - new `else if (patch.bedVampId)` branch in `setGroupBedMedia`'s existing-doc path
- `src/stores/__tests__/slideGroups.test.ts` - 4 new tests: existing-doc no-MP3-vamp write, no-prior-media case, URL-still-wins branch ordering, fresh-doc/setDoc path unchanged
- `src/utils/__tests__/slideshowAssembler.test.ts` - 1 new test: `bedVampId` with no `bedAudioUrl` resolves no audio/loop
- `src/components/slides/BackgroundControl.vue` - new `variant`/`recents` props, `chip-popover` template branch, `isDragOver`/`swatches`/`selectNone`/`selectRecent`/`onDrop`/`uploadFile`
- `src/components/slides/__tests__/BackgroundControl.test.ts` - 12 new tests covering the chip-popover branch's full `<behavior>` list
- `src/components/slides/SlotVideoOutputControl.vue` - template replaced with §3 tile markup; `sizeHint` computed added
- `src/components/slides/__tests__/SlotVideoOutputControl.test.ts` - static caption test replaced with fullscreen/banner hint tests + active-tile/aria-label test
- `src/components/slides/__tests__/SlideGrid.test.ts` - one assertion narrowed (see Deviations)

## Decisions Made
- The no-MP3 vamp branch explicitly `deleteField()`s `bedAudioUrl` rather than omitting the key — an `updateDoc` merge that just doesn't touch `bedAudioUrl` would leave a stale Track/prior-vamp URL playing under the new vamp's amber "no MP3" chip, which RESEARCH.md flagged as worse than doing nothing.
- `BackgroundControl`'s `swatches` computed always includes the current `imageUrl` as a tile (prepending it when absent from `recents`, capped to 4) — the "currently-set one is highlighted" rule from CONTEXT.md is otherwise unsatisfiable.
- Drop-to-upload and file-input upload share one `uploadFile()` function so there is exactly one upload path (`useBackgroundUpload` referenced once for import, once for the call — acceptance criteria's expected grep count of 2 doesn't hold because a pre-existing, unrelated doc-comment on the `orgId` prop also mentions the string "useBackgroundUpload"; the actual code path is unchanged/singular).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed a pre-existing SlideGrid.test.ts assertion the new tile design broke**
- **Found during:** Task 3 (SlotVideoOutputControl Display tiles) verification run against `SlideGrid.test.ts`
- **Issue:** The 34-11 "merged panel" test asserted zero `.bg-gray-900` classes among the group-media panel's descendants (pinning the OLD "both controls render flush, only the panel itself has chrome" invariant). UI-SPEC §3's tile design intentionally gives the inactive Display tile its own `bg-gray-900` fill as part of the per-tile visual — this is a deliberate design change from this phase, not a regression.
- **Fix:** Narrowed the `.bg-gray-900` assertion to exclude descendants whose `data-testid` starts with `slot-video-output-`, leaving the `.border-gray-800` check and the `BackgroundControl`/`SlideGroupMusicControl`-specific "flush" checks (which the phase does not change in this plan) fully intact.
- **Files modified:** `src/components/slides/__tests__/SlideGrid.test.ts`
- **Verification:** `npx vitest run src/components/slides/__tests__/SlotVideoOutputControl.test.ts src/components/slides/__tests__/SlideGrid.test.ts` — 161/161 pass
- **Committed in:** `1a694329` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test assertion updated to match a deliberate, UI-SPEC-locked visual change)
**Impact on plan:** No scope creep — the panel's own restyle (SlideGrid.vue, SlideGroupSetupStrip.vue) is Plan 03/04's work and untouched here; only the one assertion that happened to observe SlotVideoOutputControl's new per-tile chrome was updated.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The store write path, `BackgroundControl`'s chip-popover body, and `SlotVideoOutputControl`'s tiles are all finished, independently tested pieces — Plan 03's `SlideGroupSetupStrip.vue` can compose them directly instead of stubs.
- `npm run type-check` (vue-tsc --build) is clean.
- No blockers for Plan 02 (VampPicker/AudioPlayer/SlideGroupMusicControl rework) or Plan 03 (the new strip component).

## Self-Check: PASSED

All 8 modified/created files confirmed present on disk; all 4 commit hashes (`f8b6983d`, `8cff6f64`, `1a694329`, `e07761d2`) confirmed in `git log`.

---
*Phase: 142-slides-tab-panel-ux-from-claude-design*
*Completed: 2026-09-19*
