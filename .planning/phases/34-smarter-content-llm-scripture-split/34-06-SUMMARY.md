---
phase: 34-smarter-content-llm-scripture-split
plan: 06
subsystem: ui
tags: [vue, typescript, vitest, scripture, congregational-reading, controlled-component]

# Dependency graph
requires:
  - phase: 34-smarter-content-llm-scripture-split (plan 05)
    provides: "ScriptureSlot.congregationalSections and the shared scripture.ts helpers this component's future host (34-07) will call"
provides:
  - "CongregationalEditor.vue as a pure controlled component: props { reference, sections }, emits { update:sections, update:reference, close }"
  - "No store, no auto-save, no save-status of its own — the rejected separate-document persistence model (useScriptureSlides/createReading/updateReading) is fully removed"
  - "Emit-based test suite proving the manual path, the AI-split path, and both prohibitions (no writes on open, no auto-triggered split)"
affects: [34-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled prop/emit component: draftSections/referenceText seeded ONCE at setup from props, never re-synced reactively — caller must key the mount on the record identity (carries forward the WR-04 contract from the old currentReadingId model)"
    - "emitSections() single-helper pattern: exactly one emit path for update:sections, called from the three places that legitimately mutate draftSections"

key-files:
  created: []
  modified:
    - src/components/CongregationalEditor.vue
    - src/components/__tests__/CongregationalEditor.test.ts

key-decisions:
  - "draftSections and referenceText are seeded once at setup and are NOT reactive to later prop changes. This is deliberate (matches the plan and the pre-existing WR-04 contract) — the parent built in 34-07 must mount this component with a :key tied to the slot identity so swapping which item is being edited forces a fresh instance."
  - "rawText stays local-only, never emitted or persisted. Re-opening the editor on a slot that already has sections starts with rawText empty, so AI split requires a fresh Fetch Passage click even when sections already exist. Documented rather than worked around, per the plan's explicit instruction not to persist a second copy of the ESV text."
  - "onFetchPassage emits update:reference before update:sections so a parent applying both writes can never end up with sections attributed to a different passage than the reference fields."

requirements-completed: [R064]

coverage:
  - id: D1
    description: "CongregationalEditor.vue is a pure controlled component: exactly two props (reference, sections), exactly three emits (update:sections, update:reference, close), no Pinia store except toasts, no auto-save, no save-status of its own. The manual path (reference input, Fetch Passage, alternating LEADER/CONGREGATION seeding, per-section speaker toggle, fetch-error surface, preview panel) and the AI split path (gated on hasSplittableBoundaries, wholesale replace on success, untouched-plus-one-toast on null/throw) both survive behaviourally unchanged."
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts (27 tests)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both prohibitions are proven by dedicated tests: mounting with populated props and unmounting emits zero custom events (no write on open), and a successful Fetch Passage never calls the AI split util (no auto-triggered split)."
    requirement: "R064"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#prohibition: mounting with populated props and immediately unmounting emits zero events"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts#prohibition: a successful onFetchPassage does not call the AI split util at all"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 06: CongregationalEditor Persistence Rewrite Summary

**`CongregationalEditor.vue` converted from a self-persisting component (separate `ScriptureReading` Firestore document via `useScriptureSlides`) to a pure controlled prop/emit component — the exact model R047 rejected is now fully gone from this file**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-03T23:45:00Z (approx)
- **Completed:** 2026-08-03T23:51:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `CongregationalEditor.vue` now has exactly two props (`reference: ScriptureRef | null`, `sections: CongregationalSection[]`) and exactly three emits (`update:sections`, `update:reference`, `close`) — no store, no auto-save composable, no shared save-status store, no `SaveStatusIndicator` child.
- `draftSections` (renamed from `sections` to avoid colliding with the new prop) and `referenceText` are seeded once at setup from `props.sections`/`formatScriptureReference(props.reference)` and are deliberately non-reactive to later prop changes, matching the pre-existing WR-04 keyed-mount contract this component already required under the old model.
- A single `emitSections()` helper is the only path to `update:sections`, called from exactly three places: `toggleSpeaker`, the success branch of `onFetchPassage`, and the success branch of `onAiSplit`.
- `onFetchPassage` emits `update:reference` immediately after the fetch resolves and before assigning `draftSections`, so the reference and the sections it produced can never disagree about which passage they belong to once a parent applies both writes.
- The header's `SaveStatusIndicator` was replaced with a close control (`data-testid="congregational-close-btn"`) emitting `close`.
- The test suite (27 tests, up from 24) now asserts against emitted events instead of Firestore writes, and adds both prohibition cases the plan required: mounting with populated props emits zero custom events, and a successful fetch never invokes the AI split util.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the reading-document persistence with a prop/emit contract** - `f11aa11` (feat)
2. **Task 2: Convert the test suite from persistence assertions to emit assertions, keeping every surviving behaviour** - `c3cd959` (test)

**Plan metadata:** (this commit) `docs(34-06): complete CongregationalEditor persistence rewrite plan`

## Files Created/Modified
- `src/components/CongregationalEditor.vue` — persistence layer replaced with a prop/emit contract; `useScriptureSlides`, `useAutoSave`, `useSaveStatus`, `SaveStatusIndicator`, `currentReadingId`, `surfaceId`, the `onMounted` reading load, the `onUnmounted` subscription teardown, and the `defineExpose` test seam are all deleted. `src/stores/scriptureSlides.ts` itself is untouched (still consumed by `useSlideshowAssembly.ts` and `ScriptureSlideEditor.vue`).
- `src/components/__tests__/CongregationalEditor.test.ts` — the scripture-slides store mock, the auto-save mock, and every test that asserted against them (save-status reporting, both E4 backstops, the reading-document load-on-mount case) are deleted. Persistence assertions are replaced with `wrapper.emitted()` assertions; the two prohibition cases are new.

## Decisions Made
- **Once-at-setup seeding, not reactive.** `draftSections`/`referenceText` read `props.sections`/`props.reference` exactly once at component setup. This carries forward the component's pre-existing WR-04 contract (previously keyed on `currentReadingId`) into the new model — whoever mounts this in 34-07 must use a `:key` tied to the slot identity.
- **rawText stays local and unpersisted**, per the plan's explicit instruction. Re-opening the editor on a slot that already has `congregationalSections` starts with an empty `rawText`, so `canAiSplit` is false until Fetch Passage is clicked again — a known, accepted consequence, not a bug.
- **update:reference before update:sections.** The order is load-bearing: a parent (34-07) can safely apply both writes to the same slot object without a race where sections get attached to whatever reference happened to be on the slot a moment earlier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test environment quirk] `wrapper.emitted()` also records raw native DOM events**
- **Found during:** Task 2, writing the "Fetch Passage success emits..." and "shows error message... emits nothing" tests
- **Issue:** `@vue/test-utils` 2.4.6's `wrapper.emitted()` captures every native DOM event dispatched via `.trigger()`/`.setValue()` (e.g. `input`, `change`, `click` bubbling off the reference input and fetch button) in addition to this component's own `defineEmits`-declared events. A literal `Object.keys(wrapper.emitted())` check after any test that both sets the reference input and clicks a button therefore always includes `['input', 'change', 'click', ...]`, which is not a defect in the component — verified with a standalone repro mount that the component itself never calls `emit('input'|'change'|'click')`.
- **Fix:** Added a `customEmittedKeys()` test helper that filters `wrapper.emitted()` down to this component's declared contract (`update:sections`, `update:reference`, `close`) before asserting emission count/order in the two tests that interact with the DOM. Tests that assert zero emissions with NO DOM interaction (bare mount, mount-then-unmount) use the raw `Object.keys(wrapper.emitted())` check unmodified, since no native events fire in those cases.
- **Files modified:** `src/components/__tests__/CongregationalEditor.test.ts`
- **Verification:** All 27 tests pass; the filter change does not weaken any assertion — it still requires the exact custom-event set/order/payload the plan's acceptance criteria specify.
- **Committed in:** `c3cd959` (Task 2 commit)

**2. [Acceptance-criteria wording clarification, not a code deviation] Literal "wrapper.emitted('update:sections') is undefined" after a failed split**
- **Context:** Task 2's acceptance criteria ask for a test asserting `wrapper.emitted('update:sections')` is `undefined` after both a null-result and a thrown AI split. The plan's own "Known, accepted consequence" section establishes that `canAiSplit`/the split control can only become enabled after a successful Fetch Passage, which itself emits `update:sections` once. Reaching the AI-split-failure state therefore always follows at least one prior `update:sections` emission, so `wrapper.emitted('update:sections')` cannot be literally `undefined` at that point without contradicting the plan's own documented constraint.
- **Resolution:** Both failure-path tests instead capture the emission count immediately before the split attempt and assert it is unchanged immediately after — proving the failed split itself adds zero emissions, which is the behavior the literal wording was proving. Documented inline in the test file at the point of first occurrence.
- **Files modified:** `src/components/__tests__/CongregationalEditor.test.ts`
- **Verification:** Both tests (`pushes exactly one verbatim toast...`, `pushes the same toast...`) pass and correctly fail if a stray `update:sections` emission is introduced (manually verified by temporarily adding a spurious `emitSections()` call to the catch branch during review, then reverting it).

---

**Total deviations:** 2 (1 test-environment-quirk workaround, 1 acceptance-criteria interpretation) — both confined to the test file; zero deviations in component behavior.
**Impact on plan:** No scope creep. Both items are test-authoring adaptations required to make the plan's own acceptance criteria executable given `@vue/test-utils`'s actual behavior and the plan's own fetch-before-split constraint.

## Issues Encountered
None beyond the two items documented above.

## Test Deletion Justification

Every test deleted from `CongregationalEditor.test.ts` asserted behavior that genuinely ceases to exist under the new prop/emit contract — none were deleted merely to make a change pass:

| Deleted test | Why it no longer applies |
|---|---|
| `saved data includes readingMode congregational and congregationalSections array` | Asserted a `store.createReading` call; the component no longer calls any store. Replaced by an `update:sections`/`update:reference` emit assertion in the new "Fetch Passage success..." test. |
| `auto-save triggers on section changes via useAutoSave` | `useAutoSave` is deleted from the component entirely — there is no debounced save path left to trigger. |
| `auto-save save function calls updateReading with congregational data` | Same — `doAutoSave`/`store.updateReading` no longer exist. |
| `shows save status indicator for each status, reported into the shared store...` | `SaveStatusIndicator`, `surfaceId`, and the `saveStatus` store usage are all deleted from this component per the plan's explicit instruction (34-07's modal header now owns the single shared indicator). |
| `reports the generic failure sentence on error...` | Same — no save-status reporting left in this component to test. |
| `clears its store entry on unmount, next to the existing composable cleanup call` | No store entry to clear; `onUnmounted` no longer does anything persistence-related. |
| `E4 loading backstop...` | Tested that a fresh instance doesn't inherit a previous instance's save status via `surfaceId`. `surfaceId` no longer exists. |
| `E4 partial backstop...` | Tested the `currentReadingId`/`surfaceId` resolution race via the `defineExpose` seam. Both the race and the seam are deleted — there is no id-resolution timing left to backstop. |
| `cleans up auto-save on unmount` | `cleanupAutoSave` no longer exists. |
| `loads existing reading in edit mode with congregationalSections` | Tested `onMounted` calling `store.getReading`. The component no longer loads anything on mount — sections arrive via the `sections` prop instead. Replaced by the new "mounted with two sections and a reference..." test, which proves the equivalent surviving behavior (pre-filled reference input, rendered sections) via props instead of an async store load. |

No test covering the manual path or the AI-split path (both required to survive byte-for-byte per the plan) was deleted; all were kept and updated only for the new `mountEditor()` prop signature.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CongregationalEditor.vue` is ready for 34-07 to mount: it accepts `reference`/`sections` and emits `update:sections`/`update:reference`/`close`, with no persistence of its own left to conflict with `ServiceEditorView`'s existing autosave.
- The keyed-mount requirement carries forward unchanged from the old WR-04 contract: 34-07 MUST mount this component with a `:key` tied to the slot identity (e.g. slot id/index), or a parent that swaps which scripture item is being edited on a persistent instance will see stale `draftSections`/`referenceText` seeded from the previous slot.
- 34-07's modal header owns the single shared `SaveStatusIndicator` bound to the `service:{serviceId}` surface id — this component intentionally renders none of its own.
- No blockers. `npm run type-check` (`vue-tsc --build`) exits 0; `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` is 27/27 green.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

Both modified files (`src/components/CongregationalEditor.vue`, `src/components/__tests__/CongregationalEditor.test.ts`) verified present on disk; all 2 task commits (`f11aa11`, `c3cd959`) plus the summary commit (`c3586a0`) verified present in git log.
