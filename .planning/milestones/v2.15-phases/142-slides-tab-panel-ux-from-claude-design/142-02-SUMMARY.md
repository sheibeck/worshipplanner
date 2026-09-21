---
phase: 142-slides-tab-panel-ux-from-claude-design
plan: 02
subsystem: ui
tags: [vue, audio, vamps, segmented-control, popover, tdd]

# Dependency graph
requires:
  - phase: 142-01
    provides: "setGroupBedMedia's no-MP3-vamp write branch (deleteField()s a stale bedAudioUrl) — makes the state this plan renders actually reachable in Firestore"
provides:
  - "VampPicker allowUnattached prop: a no-MP3 vamp row renders enabled (clickable, amber 'No MP3' tag) when the host opts in; default stays disabled for EditSlideDrawer"
  - "AudioPlayer loadedmetadata emit: carries the element's finite duration (omits Infinity/NaN) for a host to render a track length"
  - "SlideGroupMusicControl rebuilt around an audioTab derivation (None/Track/Vamp) replacing the v-if=\"audioUrl\" gate that made the no-MP3-vamp state unrenderable (RESEARCH.md Pitfall 2/Finding 5); inline VampPicker replaces VampPickerSlideOver at this call site; new close emit; slideCount prop removed"
affects: [142-03, 142-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-tab-from-data pattern: audioTab is a computed from bedVampId/audioUrl presence, with a transient selectedTab ref override that resets on prop change — avoids storing UI state that could drift from the write-owning parent's data"
    - "allowUnattached-style opt-in prop on a shared picker component to serve two call sites (group slot vs. per-slide drawer) with different selectability rules for the same row shape"

key-files:
  created: []
  modified:
    - src/components/VampPicker.vue
    - src/components/__tests__/VampPicker.test.ts
    - src/components/AudioPlayer.vue
    - src/components/__tests__/AudioPlayer.test.ts
    - src/components/slides/SlideGroupMusicControl.vue
    - src/components/slides/__tests__/SlideGroupMusicControl.test.ts
    - src/components/slides/__tests__/SlideGrid.test.ts
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "isVampBed redefined as !!bedVampId (was !!audioUrl && !!bedVampId) — RESEARCH.md Finding 5 identified this as load-bearing, not cosmetic: the old definition made a no-MP3 vamp bed indistinguishable from 'nothing assigned' for tab-selection purposes"
  - "Used three literal <button> elements for the None/Track/Vamp tabs instead of the UI-SPEC snippet's v-for over a tabs array — the plan's acceptance grep requires a literal 'data-testid=\"group-music-audio-tab-' string match, which a dynamic :data-testid binding does not produce; behavior, testids, and copy are otherwise byte-identical to the spec"
  - "AudioPlayer is mounted whenever audioUrl is truthy, independent of which tab is currently showing — a Track-tab preview started before switching to Vamp keeps playing, and loadedmetadata can still be learned regardless of active tab"

patterns-established:
  - "Rule 1 test-assertion narrowing for chrome legitimately introduced by a UI-SPEC restyle (this phase's second instance of the pattern Plan 01 established for SlotVideoOutputControl's tiles): exclude the new element's own testid from a 'zero descendants carry this chrome' assertion rather than loosening the invariant itself"

requirements-completed: [R032, R437]

coverage:
  - id: D1
    description: "VampPicker allowUnattached=true renders a no-MP3 vamp as a clickable enabled row keeping the amber 'No MP3' tag (not the tempo span); selectedVampId still applies the selected styling/checkmark; default (prop absent) is unchanged, and EditSlideDrawer.vue's call site has a zero-line diff"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampPicker.test.ts#allowUnattached: true renders all rows enabled, including a no-MP3 vamp"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VampPicker.test.ts#allowUnattached: true — the no-MP3 row shows the amber No MP3 tag (not tempo) and emits select on click"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VampPicker.test.ts#allowUnattached: true — selectedVampId on the no-MP3 row keeps the selected classes/checkmark and the No MP3 tag"
        status: pass
    human_judgment: false
  - id: D2
    description: "AudioPlayer emits loadedmetadata with the element's finite duration; Infinity/NaN emit nothing; pre-existing AudioPlayer and Run-control audio tests remain green"
    requirement: "R032"
    verification:
      - kind: unit
        ref: "src/components/__tests__/AudioPlayer.test.ts#emits loadedmetadata with the finite duration once the element reports it"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/AudioPlayer.test.ts#emits nothing on loadedmetadata when duration is Infinity or NaN"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/RunControlView.audio.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "SlideGroupMusicControl renders all four audio states (none / track / vamp+MP3 / vamp-no-MP3) from the audioTab derivation — the no-MP3-vamp state now shows the Vamp tab + amber warning instead of the old empty-state 'Add' buttons"
    requirement: "R032"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupMusicControl.test.ts#SlideGroupMusicControl — audioTab derivation (142)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Inline VampPicker (fill, allow-unattached) replaces VampPickerSlideOver at the group call site; select emits attach-vamp, cancel emits the new close emit; the control stays emit-only (no store import)"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupMusicControl.test.ts#SlideGroupMusicControl — Vamp tab"
        status: pass
    human_judgment: false
  - id: D5
    description: "Track row shows a duration once AudioPlayer's loadedmetadata fires, formatted m:ss; a subsequent audioUrl change clears it; Replace/Remove work; viewer mode hides Replace/Remove but keeps filename/preview"
    requirement: "R032"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupMusicControl.test.ts#SlideGroupMusicControl — Track tab"
        status: pass
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGroupMusicControl.test.ts#SlideGroupMusicControl — viewer / flush"
        status: pass
    human_judgment: false
  - id: D6
    description: "SlideGrid.test.ts stays green through the interim (three touch-ups for the retired slideCount prop / add-button testid, plus a fourth Rule-1 narrowing of the pre-existing 34-11 zero-chrome assertion for the new audio-tabs/track-row elements)"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Visual/interactive verification of the None/Track/Vamp tab popover body in the browser (colors, focus order, the amber warning's real-render contrast) is a real-render judgment call, not something the unit suite proves"
    verification: []
    human_judgment: true
    rationale: "Unit tests assert DOM structure/classes/emits/derivation logic, not rendered visual fidelity — deferred to this milestone's batched UAT, same convention as 142-01"

# Metrics
duration: 16min
completed: 2026-09-19
status: complete
---

# Phase 142 Plan 02: VampPicker allowUnattached + AudioPlayer loadedmetadata + SlideGroupMusicControl one-slot rework Summary

**Rebuilt the group strip's audio half as one slot with a derived None/Track/Vamp tab, closing the render gap where a no-MP3 vamp bed silently looked like "nothing assigned" instead of showing the Vamp tab with its amber warning.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-19T05:35:00Z (approx.)
- **Completed:** 2026-09-19T05:51:07Z
- **Tasks:** 3
- **Files modified:** 8 (all 8 planned; no unplanned files)

## Accomplishments
- `VampPicker.vue` gained an `allowUnattached` prop: a no-MP3 vamp row now renders as a fully enabled, clickable `vamp-picker-row` (keeping its amber "No MP3" tag in place of the tempo span) when the host opts in — the per-slide drawer's call site is unaffected (verified with a zero-line diff)
- `AudioPlayer.vue` gained a `loadedmetadata` emit carrying the element's finite duration, letting a host show a track length once the browser actually knows it
- `SlideGroupMusicControl.vue` was rebuilt around an `audioTab` derivation (`'vamp'` whenever `bedVampId` is set, regardless of `audioUrl`; else `'track'` or `'none'`) that replaces the old `v-if="audioUrl"` gate RESEARCH.md's Pitfall 2/Finding 5 identified as unable to render the no-MP3-vamp state — that state now correctly shows the Vamp tab active with the "⚠ No MP3 attached yet — band plays it live." warning, never the old empty-state "+ Add" buttons
- Vamp picking moved inline into the popover body (`VampPicker fill allow-unattached`), replacing `VampPickerSlideOver` at this call site only; a new `close` emit lets the eventual host popover (Plan 03) close itself on cancel
- The Track row now shows a duration once `AudioPlayer`'s `loadedmetadata` fires, plus `Replace`/`Remove` controls; viewer mode disables the tabs and hides Replace/Remove while keeping the filename/preview/vamp-label readable

## Task Commits

Each task was committed atomically:

1. **Task 1: VampPicker — allowUnattached prop** - `7b1f9ed2` (feat)
2. **Task 2: AudioPlayer — loadedmetadata emit** - `6e86a919` (feat)
3. **Task 3: SlideGroupMusicControl — one-slot rework + suite rewrite + interim touch-ups** - `b11fa519` (feat)

_All three tasks were `tdd="true"`; each commit bundles its tests and implementation together, matching Plan 01's precedent since the RED/GREEN split was per-behavior within one task, not a separate test-then-feat commit pair._

## Files Created/Modified
- `src/components/VampPicker.vue` - `allowUnattached?: boolean` prop; enabled-row condition now `vamp.attachment?.downloadUrl || allowUnattached`; no-MP3 enabled row shows the amber "No MP3" tag instead of tempo
- `src/components/__tests__/VampPicker.test.ts` - 3 new tests for the `allowUnattached` behavior; all 12 pre-existing tests untouched
- `src/components/AudioPlayer.vue` - `loadedmetadata: [durationSeconds: number]` emit wired to the native `<audio>` element's `loadedmetadata` event, gated on `Number.isFinite`
- `src/components/__tests__/AudioPlayer.test.ts` - 2 new tests (finite duration emits; Infinity/NaN emit nothing)
- `src/components/slides/SlideGroupMusicControl.vue` - full template/script rework: `audioTab` derivation, `selectedTab` ref, `setAudioTab`, `duration`/`formatDuration`/`onLoadedMetadata`, `isVampBed` redefined, `slideCount` prop and `VampPickerSlideOver` removed, `close` emit added
- `src/components/slides/__tests__/SlideGroupMusicControl.test.ts` - both old describe blocks replaced with 5 new ones (derivation, None, Track, Vamp, viewer/flush) covering every `<behavior>` bullet — 22 tests total
- `src/components/slides/__tests__/SlideGrid.test.ts` - 3 planned interim touch-ups + 1 Rule-1 auto-fix (see Deviations)
- `.planning/codebase/ARCHITECTURE.md` - appended the Phase 142 one-audio-slot paragraph to the existing `SlideGroupMusicControl.vue` entry

## Decisions Made
- `isVampBed` redefined as `!!bedVampId` (dropping the `audioUrl &&` term) per RESEARCH.md Finding 5 — this is the actual fix for the render gap, not just the template gate change.
- Wrote the three tab buttons as literal markup instead of a `v-for` over a `tabs` array: the plan's own acceptance criteria greps for the literal string `data-testid="group-music-audio-tab-`, which a `:data-testid="'group-music-audio-tab-' + t.id"` dynamic binding (as the UI-SPEC snippet shows it) would not produce. Behavior, copy, and the three testids are otherwise byte-identical to the spec.
- Added a `data-testid="group-music-audio-tabs"` testid to the tablist wrapper div (not specified in UI-SPEC, which shows no testid there) — needed as the anchor for the Rule-1 test narrowing below; it does not appear in the plan's retired-testid list so it does not conflict with any acceptance check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Narrowed the pre-existing 34-11 "merged panel" zero-chrome assertion for two elements this phase's UI-SPEC restyle legitimately introduces**
- **Found during:** Task 3 verification run against `SlideGrid.test.ts`
- **Issue:** The 34-11 "renders ONE bordered/background box for the merged panel" test asserted zero `.border-gray-800` descendants and zero `.bg-gray-900` descendants (outside the video-output tiles Plan 01 already carved out) within the group-media panel. UI-SPEC §5's None/Track/Vamp tablist intentionally carries `border-gray-800` as its own pill-bar chrome, and the Track row intentionally carries `bg-gray-900` as its own row chrome — both are per-control visual design from this phase, not a second panel box re-appearing.
- **Fix:** Added `data-testid="group-music-audio-tabs"` to the tablist wrapper and extended the existing exclusion filters (the same pattern Plan 01 established for `slot-video-output-*`) to exclude that testid from the `.border-gray-800` check and `group-music-track-row` from the `.bg-gray-900` check. The rest of the test (panel-level chrome assertions, the "neither control paints its own border/bg" check) is untouched.
- **Files modified:** `src/components/slides/SlideGroupMusicControl.vue`, `src/components/slides/__tests__/SlideGrid.test.ts`
- **Verification:** `npx vitest run src/components/slides/__tests__/SlideGroupMusicControl.test.ts src/components/slides/__tests__/SlideGrid.test.ts src/components/__tests__/VampPicker.test.ts` — 388/388 pass (combined with the plan's other verify targets)
- **Committed in:** `b11fa519` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test assertion narrowed to match a deliberate, UI-SPEC-locked visual change, same precedent Plan 01 set)
**Impact on plan:** No scope creep — the fix stays inside the two files Task 3 already owns (`SlideGroupMusicControl.vue`, `SlideGrid.test.ts`), and only touches the one assertion the new tab-bar/track-row chrome collided with. This is a fourth `SlideGrid.test.ts` touch beyond the plan's three named interim edits, but it is a direct, mechanical consequence of Task 3's own change (not independent scope), same category as Plan 01's precedent.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `VampPicker`'s `allowUnattached` prop, `AudioPlayer`'s `loadedmetadata` emit, and `SlideGroupMusicControl`'s full one-slot rework are all finished, independently tested pieces — Plan 03's `SlideGroupSetupStrip.vue` can mount `SlideGroupMusicControl` directly inside its Audio popover with no further changes to this component.
- `npm run type-check` (vue-tsc --build) is clean.
- `SlideGrid.test.ts` stays green through the interim per the plan's design; Plan 04 is expected to migrate its group-media assertions off the now-legacy testids entirely (the "142 interim" comments mark exactly which four to revisit).
- No blockers for Plan 03 (`SlideGroupSetupStrip.vue`) or Plan 04 (`SlideGrid.vue` integration + `SlideGrid.test.ts` migration).

## Self-Check: PASSED

All 8 modified files confirmed present on disk; all 3 commit hashes (`7b1f9ed2`, `6e86a919`, `b11fa519`) confirmed in `git log`.

---
*Phase: 142-slides-tab-panel-ux-from-claude-design*
*Completed: 2026-09-19*
