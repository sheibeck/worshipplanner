---
phase: 106-per-item-loop-playback
plan: 01
subsystem: ui
tags: [vue, typescript, service-editor, autosave]

# Dependency graph
requires: []
provides:
  - "MediaAttachableSlot.loop?: { enabled, intervalSeconds } — additive, absent-safe, no migration"
  - "Per-item Loop checkbox + interval control (preset dropdown + custom seconds) in the Service Order item editor"
  - "loopPresetFor(slot) round-trip mapping (intervalSeconds -> preset string or 'custom')"
affects: [106-per-item-loop-playback/106-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Slot field mutation via localService.value.slots[index] under the existing single useAutoSave(localService, ...) deep-watch (mirrors onSectionChange) — no new save path."
    - "Reassign-not-mutate for reactive fields consumed by a derived v-if/select binding: writing a NEW object reference (not an in-place field write) when the incoming value may equal the current value, so Vue's fine-grained reactivity reliably re-triggers dependent template branches."
    - "Mount-scoped Set<string> keyed on slot.id for an ephemeral 'operator explicitly chose X' UI override that must not affect the persisted round-trip contract (mirrors openRowMenuId precedent)."

key-files:
  created: []
  modified:
    - src/types/service.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "intervalSeconds (seconds) is the authoritative field name/unit per 106-UI-SPEC.md and v2.7 ARCHITECTURE research, superseding an early 106-CONTEXT.md 'intervalMs' draft phrasing."
  - "loop lives on the shared MediaAttachableSlot base (like notes?) so it is cast-free on all five slot kinds, rather than a separate named interface."
  - "Added a mount-scoped explicitCustomLoopSlotIds override (Rule 2) so selecting 'Custom…' from the dropdown reliably reveals the seconds input even when the current intervalSeconds already equals a preset (e.g. the 10s default right after checking Loop) — loopPresetFor's pure intervalSeconds mapping alone cannot represent that transient UI intent, and the reload/round-trip contract is unaffected since the override never persists."

patterns-established:
  - "Loop-field handlers (onToggleLoop/loopPresetFor/onLoopPresetChange/onLoopCustomBlur) all read/write localService.value.slots[index] directly — the pattern Plan 02's Run-timer consumer should also expect (it reads slot.loop, does not need to mutate the editor's UI state)."

requirements-completed: [R307]
# R306 is intentionally NOT listed as complete here: R306's own text ("during Run, that item's
# slides auto-advance and loop back to the item's first slide") describes Run-time behavior this
# plan does not implement. This plan ships R306's authoring half only (the checkbox + persisted
# slot.loop model) — REQUIREMENTS.md keeps R306 Pending until 106-02 lands the Run-time timer.

coverage:
  - id: D1
    description: "MediaAttachableSlot gains an optional loop?: { enabled, intervalSeconds } field, absent-safe on all five slot kinds with no migration."
    requirement: "R306"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A per-item Loop checkbox renders in the Service Order editor (editor-only, draft-locked); checking it defaults intervalSeconds to 10 and reveals the preset dropdown."
    requirement: "R307"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Service Order — per-item loop authoring (R306/R307) > renders the loop row and checkbox for a slot, with the interval control hidden until Loop is checked"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Service Order — per-item loop authoring (R306/R307) > checking the checkbox sets slot.loop = { enabled: true, intervalSeconds: 10 } and reveals the preset dropdown (R307 default 10s)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Selecting a preset sets intervalSeconds to that value; selecting Custom reveals the seconds input pre-filled with the current value."
    requirement: "R307"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Service Order — per-item loop authoring (R306/R307) > selecting a preset sets intervalSeconds to that value; selecting Custom reveals the seconds input pre-filled with the current value"
        status: pass
    human_judgment: false
  - id: D4
    description: "loopPresetFor round-trips a saved custom interval (e.g. 45s) back to 'Custom…' with the number field pre-filled, never snapping to a nearest preset."
    requirement: "R307"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Service Order — per-item loop authoring (R306/R307) > loopPresetFor round-trips: a slot seeded with intervalSeconds 45 renders the preset as Custom with the number field showing 45 (never snaps to 30 or 60)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A custom interval below 1, above 3600, empty, or non-numeric is clamped silently to the nearest valid 1-3600 value on blur; no invalid intervalSeconds is ever persisted."
    requirement: "R307"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Service Order — per-item loop authoring (R306/R307) > entering %s into the custom seconds field and blurring clamps to %i (R307 persistence) (5 cases: 0, -5, '', 'not-a-number', 9999)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Unchecking Loop sets enabled false but retains intervalSeconds so re-checking restores the last interval."
    requirement: "R307"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#Service Order — per-item loop authoring (R306/R307) > unchecking Loop sets enabled false but retains intervalSeconds so re-checking restores it"
        status: pass
    human_judgment: false
  - id: D7
    description: "No regression to the existing Service Order editor test suite; the loop field persists solely through the existing useAutoSave(localService, ...) deep-watch with no new save call or rules surface."
    verification:
      - kind: unit
        ref: "npx vitest run src/views/__tests__/ServiceEditorView.test.ts (350/350 passing, 340 pre-existing + 10 new)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-01
status: complete
---

# Phase 106 Plan 01: Per-item loop authoring — field + UI Summary

**Additive `MediaAttachableSlot.loop?: { enabled, intervalSeconds }` (default 10s) plus a Loop checkbox / "Every" preset-or-custom interval control in the Service Order item editor, persisted through the existing autosave path with no new save call or migration.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-01T03:20:00-04:00 (approx.)
- **Completed:** 2026-09-01T03:38:43-04:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `MediaAttachableSlot.loop?: { enabled: boolean; intervalSeconds: number }` added to the shared slot base — cast-free on all five slot kinds, absent on every existing fixture with no migration.
- The Loop checkbox row (`slot-loop-row`/`slot-loop-checkbox`/`slot-loop-preset`/`slot-loop-custom-seconds`) inserted into `ServiceEditorView.vue` verbatim per 106-UI-SPEC.md's approved markup, editor-only (`v-if="canEditService"`), placed between the per-kind content block and the consolidated notes field.
- Four handlers (`onToggleLoop`, `loopPresetFor`, `onLoopPresetChange`, `onLoopCustomBlur`) mutate `localService.value.slots[index]` directly, riding the existing single `useAutoSave(localService, ...)` deep-watch — no new save call, no new Firestore rules surface.
- Scoped test coverage: 10 new cases in a `describe('Service Order — per-item loop authoring (R306/R307)')` block, covering initial-hidden interval, default-10 on check, preset selection, Custom round-trip at 45s, five clamp-on-blur cases (0, -5, empty, non-numeric, 9999), and uncheck-retains-interval.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the additive optional loop config field to the service slot type** - `4374154a` (feat)
2. **Task 2: Render the Loop checkbox + interval control in the Service Order item editor** - `f39d3f9b` (feat)
3. **Task 3: Scoped authoring tests for the loop checkbox, interval persistence, and clamp** - `d60c7c84` (test) — also carries the two Rule 1/Rule 2 fixes below

_No separate plan-metadata commit was made prior to this summary; STATE.md/ROADMAP.md/REQUIREMENTS.md updates land in the final docs commit per the executor workflow._

## Files Created/Modified
- `src/types/service.ts` - Added `MediaAttachableSlot.loop?: { enabled, intervalSeconds }` with full lifecycle doc comment (optional, no migration, `stripUndefined` semantics, seconds-not-ms field-name decision).
- `src/views/ServiceEditorView.vue` - Loop checkbox/interval row markup (verbatim from 106-UI-SPEC.md) plus `onToggleLoop`/`loopPresetFor`/`onLoopPresetChange`/`onLoopCustomBlur` handlers and the `explicitCustomLoopSlotIds` UI-only override Set; added `reactive` to the existing `vue` import.
- `src/views/__tests__/ServiceEditorView.test.ts` - New `describe('Service Order — per-item loop authoring (R306/R307)')` block (10 cases) mirroring the existing R122 notes-field test harness pattern.

## Decisions Made
- **`intervalSeconds` (seconds) is authoritative**, per the plan's explicit instruction overriding 106-CONTEXT.md's early "intervalMs" phrasing — matches 106-UI-SPEC.md and the v2.7 ARCHITECTURE research doc.
- **`loop` lives on `MediaAttachableSlot`** (the shared base), not a per-kind interface or a separately named type — mirrors `notes?`'s precedent exactly, keeping it cast-free everywhere.
- **Mutation pattern mirrors `onSectionChange`**: every handler reads `localService.value.slots[index]`, guards on `canEditService.value`, and writes back in place — zero new save calls, zero new rules surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `onLoopPresetChange` mutated `slot.loop` fields in place, which silently no-ops under Vue's reactivity when the incoming value equals the current value**
- **Found during:** Task 3 (writing/running the "selecting a preset... selecting Custom reveals..." and clamp tests)
- **Issue:** Selecting `'custom'` from the preset dropdown while `slot.loop.enabled` was already `true` (the common case) performed an in-place field write that Vue's fine-grained reactivity treats as a no-op (`Object.is` equality on the same boolean), so the render effect never re-ran and the derived `v-if`/`:value` bindings driving the preset select and custom-seconds input never re-evaluated — the custom input silently failed to reveal itself.
- **Fix:** `onLoopPresetChange` now always assigns a brand-new `{ enabled, intervalSeconds }` object to `slot.loop` (rather than writing individual fields), guaranteeing the reactive dependency on `slot.loop` is invalidated and the template re-renders every time, regardless of whether any leaf value actually changed.
- **Files modified:** `src/views/ServiceEditorView.vue`
- **Verification:** `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — the affected cases now pass.
- **Committed in:** `d60c7c84` (Task 3 commit)

**2. [Rule 2 - Missing Critical] `loopPresetFor`'s pure derivation made "selecting Custom reveals the number input" unreachable for the most common starting state**
- **Found during:** Task 3, same test investigation as above
- **Issue:** `loopPresetFor(slot)` is (by design, per the plan) a pure function of `slot.loop.intervalSeconds` — correct for the reload/round-trip case (a persisted 45s value must re-derive to "Custom…"). But because it is pure, explicitly picking "Custom…" from the dropdown while the current interval already equals one of the six presets (true immediately after checking Loop, which defaults to 10s — a preset — or after picking any preset) had zero visible effect: the very next render re-derived back to the matching preset, and the custom input never appeared. This silently broke the plan's own required behavior ("selecting Custom reveals the number input") for the single most common operator flow (check Loop → want to type a number other than a listed preset).
- **Fix:** Added `explicitCustomLoopSlotIds`, a mount-scoped `reactive(Set<string>)` keyed on `slot.id` (mirroring the existing `openRowMenuId` precedent), set when the operator picks `'custom'` and cleared when they pick a numeric preset or uncheck Loop. `loopPresetFor` checks this override before falling back to its pure `intervalSeconds` mapping. The override is UI-only and never persisted, so a fresh mount/reload still derives purely from `intervalSeconds` — the round-trip contract for a saved 45s value is unchanged.
- **Files modified:** `src/views/ServiceEditorView.vue`
- **Verification:** `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` — all 10 new loop-authoring cases pass, plus the pre-existing 340 cases remain green.
- **Committed in:** `d60c7c84` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical functionality)
**Impact on plan:** Both fixes were necessary for the plan's own stated behavior ("selecting Custom reveals the number input") to actually work in the browser, not merely in a favorable test ordering. No scope creep — no Run-screen/timer code was touched (that remains Plan 02's scope).

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `MediaAttachableSlot.loop` is persisted and round-trips correctly; Plan 02 (the Run-time auto-advance timer) can read `slot.loop?.enabled`/`intervalSeconds` directly with no further data-model changes.
- No Run-rail indicator or Run-screen behavior was added here (explicitly out of scope per the plan) — Plan 02 owns arming/disarming the loop timer and any optional Run-rail "Loop" badge.
- `npm run type-check` and the full `ServiceEditorView.test.ts` suite (350 tests) are green.

---
*Phase: 106-per-item-loop-playback*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: src/types/service.ts
- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND: .planning/phases/106-per-item-loop-playback/106-01-SUMMARY.md
- FOUND commit: 4374154a
- FOUND commit: f39d3f9b
- FOUND commit: d60c7c84
