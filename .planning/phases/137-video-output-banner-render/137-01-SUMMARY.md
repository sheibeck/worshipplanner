---
phase: 137-video-output-banner-render
plan: 01
subsystem: ui
tags: [vue, service-editor, slides, video-output, autosave]

# Dependency graph
requires:
  - phase: 136-video-output-monitor-config
    provides: The Video output role + shared FullscreenSlideOutput.vue render this schema field will branch on in Plan 02
provides:
  - "MediaAttachableSlot.videoOutput?: { mode: 'banner' | 'fullscreen' } schema field (additive, no migration)"
  - "SlotVideoOutputControl.vue — per-item Banner/Full-screen pill toggle, mirrors SlotLoopControl's prop/emit contract"
  - "SlideGrid -> SlidesTab -> ServiceEditorView relay + onSlotVideoOutputChange persistence riding the existing useAutoSave"
affects: [137-02-PLAN.md (reads slot.videoOutput.mode for the banner render)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-item optional slot field authored via a small sibling control (SlotLoopControl precedent) whose change rides the single useAutoSave deep-watch — no new save path"
    - "A group-media-panel control gated on presence/editor status only (not slot kind), unlike loop's isLoopableSlot kind gate"

key-files:
  created:
    - src/components/slides/SlotVideoOutputControl.vue
    - src/components/slides/__tests__/SlotVideoOutputControl.test.ts
  modified:
    - src/types/service.ts
    - src/components/slides/SlideGrid.vue
    - src/components/slides/SlidesTab.vue
    - src/views/ServiceEditorView.vue
    - src/components/slides/__tests__/SlideGrid.test.ts

key-decisions:
  - "videoOutput shown for EVERY slot kind (no isLoopableSlot-style kind gate) per 137-UI-SPEC.md's explicit scope decision"
  - "Locked service renders the control read-only (editable=false) rather than hiding it, so the current setting stays visible"

patterns-established:
  - "SlotVideoOutputControl.vue: two-segment role=radiogroup pill toggle for a pure either/or per-item choice, distinct from SlotLoopControl's checkbox+select shape"

requirements-completed: [R425]

coverage:
  - id: D1
    description: "MediaAttachableSlot carries optional videoOutput?: { mode: 'banner' | 'fullscreen' }, additive/no-migration"
    requirement: R425
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build, includes test files)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SlotVideoOutputControl.vue renders Full-screen active by default, Banner active when mode='banner', emits change only on a real change and only when editable"
    requirement: R425
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlotVideoOutputControl.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Control renders in SlideGrid's group-media-panel for every slot kind (including non-loopable kinds like SONG), relays video-output-change through SlidesTab to ServiceEditorView.onSlotVideoOutputChange, which persists slot.videoOutput via the existing autosave with no new save call"
    requirement: R425
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts (describe 'SlideGrid — per-item Video output Banner/Full-screen (R425, Phase 137)', 4 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual rendering/UAT of the toggle in the running app (pill styling, focus rings, wrap behavior)"
    verification: []
    human_judgment: true
    rationale: "Deferred UAT mode (autonomous execution) — visual/interaction checkpoint not run against a live browser this session; code-level behavior is fully unit-tested."

duration: 14min
completed: 2026-09-07
status: complete
---

# Phase 137 Plan 01: Video Output Banner/Full-screen Authoring Summary

**Added the optional `videoOutput` field to `MediaAttachableSlot` plus a new `SlotVideoOutputControl.vue` pill toggle, wired through SlideGrid → SlidesTab → ServiceEditorView so an editor's Banner/Full-screen choice persists via the existing autosave with no new save path (R425).**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-09-07T20:54:00-04:00 (plan commit) → first task commit 21:00:44
- **Completed:** 2026-09-07T21:07:49-04:00
- **Tasks:** 2 completed
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `MediaAttachableSlot.videoOutput?: { mode: 'banner' | 'fullscreen' }` — additive sibling of `loop`, absent = full-screen default, no migration needed
- `SlotVideoOutputControl.vue` — a two-segment `role="radiogroup"` pill toggle mirroring `SlotLoopControl.vue`'s prop/emit contract (`{ slot, editable }` → `change`), with a "Video output only" scope caption
- Full relay chain wired: `SlideGrid` mounts the control for **every** slot kind (no `isLoopableSlot`-style gate, per the UI-SPEC's explicit scope decision) and emits `video-output-change` → `SlidesTab` relays unchanged → `ServiceEditorView.onSlotVideoOutputChange` persists `slot.videoOutput`, riding the single existing `useAutoSave` deep-watch (no new save call)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the videoOutput schema field and build SlotVideoOutputControl.vue** - `424f6a29` (feat)
2. **Task 2: Wire the control into SlideGrid, relay through SlidesTab, persist in ServiceEditorView** - `0c82e49d` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/types/service.ts` - added `MediaAttachableSlot.videoOutput?: { mode: 'banner' | 'fullscreen' }`
- `src/components/slides/SlotVideoOutputControl.vue` - new Banner/Full-screen pill toggle component
- `src/components/slides/__tests__/SlotVideoOutputControl.test.ts` - 7 tests covering default state, active-segment rendering, emit shape, no-op cases, locked/disabled behavior
- `src/components/slides/SlideGrid.vue` - mounts `SlotVideoOutputControl` in the group-media-panel for every slot kind, `showVideoOutputControl` computed, `video-output-change` emit declared and relayed
- `src/components/slides/SlidesTab.vue` - declares and relays the `video-output-change` emit
- `src/views/ServiceEditorView.vue` - binds `@video-output-change="onSlotVideoOutputChange"`, new handler mirrors `onSlotLoopChange` (guards `canEditService`/`localService`/`slot`, assigns `slot.videoOutput`)
- `src/components/slides/__tests__/SlideGrid.test.ts` - new describe block: control renders for a non-loopable kind (SONG), hidden for a viewer, read-only-but-visible when locked, emits `video-output-change` with the slot array index on Banner pick

## Decisions Made
- Followed 137-UI-SPEC.md's explicit scope decision: unlike `loop` (MISC/ANNOUNCEMENTS only), `videoOutput` has no kind restriction — the control shows for every slot kind including SONG/SCRIPTURE.
- Locked service renders the control visible-but-non-interactive (`editable="!serviceLocked"`), matching the UI-SPEC's "a planner should still see the current setting" requirement, rather than hiding the control entirely (which is what `canLoopSlot` does for Loop).

## Deviations from Plan

None - plan executed exactly as written. The task-level `<action>` and `<behavior>` specs in 137-01-PLAN.md were followed verbatim, including exact prop/emit shapes, testids, and copy ("Video output only").

## Issues Encountered

None.

## Deferred UAT

Per autonomous-execution mode (UAT deferred), the human-visual checkpoint for the toggle's rendered appearance (pill styling, focus rings, wrap behavior in the live app) was not performed this session. Code-level behavior — default state, active-segment rendering, emit shape, no-op semantics, locked/disabled rendering — is fully covered by the 7 new `SlotVideoOutputControl.test.ts` tests and the 4 new `SlideGrid.test.ts` tests (149 total assertions across both files, all passing). This deviation is not tracked in v2.14-DEFERRED-VERIFICATION.md per this plan's autonomous_deferred_uat_mode instruction.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The `slot.videoOutput?.mode` field and its exact shape (`{ mode: 'banner' | 'fullscreen' }`) are locked in and type-checked — Plan 02 (the banner render in `FullscreenSlideOutput.vue`) can resolve `localService.slots[currentSlide.slotIndex]?.videoOutput?.mode` exactly as ARCHITECTURE.md's documented resolution path expects.
- `npm run type-check` (vue-tsc --build, includes test files) is clean.
- `npx vitest run src/components/slides/__tests__/SlotVideoOutputControl.test.ts src/components/slides/__tests__/SlideGrid.test.ts` — 152 tests pass (7 + 145).
- No blockers for Plan 02.

---
*Phase: 137-video-output-banner-render*
*Completed: 2026-09-07*

## Self-Check: PASSED

- FOUND: src/types/service.ts
- FOUND: src/components/slides/SlotVideoOutputControl.vue
- FOUND: src/components/slides/__tests__/SlotVideoOutputControl.test.ts
- FOUND: src/components/slides/SlideGrid.vue
- FOUND: src/components/slides/SlidesTab.vue
- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/components/slides/__tests__/SlideGrid.test.ts
- FOUND commit: 424f6a29
- FOUND commit: 0c82e49d
- Full app suite (`npx vitest run`): 223 passed / 1 failed (src/storage.rules.test.ts, known Storage-emulator baseline failure) / 5641 tests passed, 35 skipped — no regressions.
- `npm run type-check` (vue-tsc --build): clean.
