---
phase: 141-vamp-slide-assignment-live-playback
plan: 01
subsystem: ui
tags: [vue, pinia, firestore, tdd, audio]

requires:
  - phase: 140-01
    provides: "Vamp/VampAttachment types, useVampStore (subscribe/vamps/isLoading/orgId)"
  - phase: 140-03
    provides: "VampTable.vue row/search styling this plan's picker rows mirror"
provides:
  - "GroupSlideEntry.vampId?/vampLabel? — additive, display-only vamp assignment fields"
  - "VampPicker.vue — pure props-driven searchable vamp list (sort/filter/disabled-no-MP3/empty/loading/selected states)"
  - "EditSlideDrawer.vue attachVampToSlide/clearVampAssignment/openVampPicker/closeVampPicker/onVampSelected — assign/change/clear a vamp through the existing fresh-base replaceGroupSlides write path"
  - "ServiceEditorView.vue initStores() subscribes useVampStore inside the isEditor gate"
affects: [141-02-suppress-audio, 141-03-run-control-playback, 141-04-delete-warning]

tech-stack:
  added: []
  patterns:
    - "Denormalize-at-assignment (SongSlot.songTitle/songKey precedent) applied to vamp->slide: audioUrl/audioLoop/vampId/vampLabel written in one fresh-base replaceGroupSlides call, presentation pipeline untouched"
    - "Pure props-driven picker component (no store import) — the drawer owns the useVampStore() read and passes vamps/loading/selectedVampId down, emits select up"

key-files:
  created:
    - src/components/VampPicker.vue
    - src/components/__tests__/VampPicker.test.ts
  modified:
    - src/types/slideGroup.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "attachVampToSlide is idempotent: re-selecting the already-assigned vamp (identical audioUrl/audioLoop/vampId/vampLabel) issues no write, only closes the picker"
  - "clearVampAssignment deletes vampId/vampLabel/audioUrl/audioLoop on a shallow copy (never assigns undefined), mirroring the file's existing removeSlideAudio/removeSlideBackground idiom"
  - "vampStale is gated on !vampStore.isLoading to avoid a false stale flash before the first snapshot and to keep the hint off entirely for a viewer whose store never subscribes (accepted narrow gap, RESEARCH Pitfall 2)"
  - "vampStore.subscribe(orgId) sits inside ServiceEditorView's authStore.isEditor gate, not alongside the unconditional songStore/serviceStore subscribes, because vamps is editor-read-gated by firestore.rules' generic catch-all"

patterns-established: []

requirements-completed: [R437]

coverage:
  - id: D1
    description: "GroupSlideEntry gains optional vampId/vampLabel fields; VampPicker.vue renders the UI-SPEC's searchable vamp list (sorted by name, name/key filter, disabled no-MP3 rows with amber tag, loading/empty/no-match states, selected-row highlight) as a pure props-driven component"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampPicker.test.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EditSlideDrawer assigns a vamp (Choose a vamp, including over manual audio), shows the assigned row (Vamp: {label}, Change, Clear, stale hint), is idempotent on re-selecting the same vamp, and Clear removes all four keys in one write with no undefined values"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts#EditSlideDrawer (Phase 141-01 — vamp assignment) (9 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ServiceEditorView subscribes useVampStore for editors only (idempotent on orgId), so the picker is populated when the Slides tab is opened directly; a viewer never subscribes"
    requirement: "R437"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (3 tests, filter '141-01')"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual fidelity of the picker/assigned-row against 141-UI-SPEC.md, and the E1 error backstop (picker never blank on a subscription error), are Manual-Only UAT batched to v2.15 milestone end"
    human_judgment: true
    rationale: "Visual rendering and a live subscription-error scenario require a real browser session; explicitly out of this plan's automated verify per 141-01-PLAN.md's <verification> section and the v2.15 batched-UAT policy in STATE.md."

duration: ~35min
completed: 2026-09-13
status: complete
---

# Phase 141 Plan 1: Vamp Slide Assignment — Client/Editor Foundation Summary

**Two additive GroupSlideEntry fields, a new props-driven VampPicker.vue, and EditSlideDrawer.vue assign/change/clear wiring through the existing fresh-base replaceGroupSlides helper — plus the missing useVampStore subscription in ServiceEditorView's editor gate — deliver R437 end-to-end without touching the presentation pipeline.**

## Performance

- **Duration:** ~35 min (task execution + full-suite/type-check verification)
- **Tasks:** 3 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `src/types/slideGroup.ts` — `GroupSlideEntry.vampId?: string` / `vampLabel?: string`, additive and display-only; `src/types/slide.ts`, `slideshowAssembler.ts`, and `useSlideshowAssembly.ts` untouched.
- `src/components/VampPicker.vue` — pure props-driven picker (`vamps`, `loading?`, `selectedVampId?` props; `select` emit) rendering the 141-UI-SPEC.md §1 searchable list: name/key/tempo rows sorted by name, local name-or-key filter, disabled amber "No MP3" rows for vamps with no attachment, loading/empty/no-match copy, and a selected-row highlight with checkmark.
- `src/components/slides/EditSlideDrawer.vue` — `attachVampToSlide`/`clearVampAssignment`/`openVampPicker`/`closeVampPicker`/`onVampSelected`, all routed through the same `slideGroupsStore.replaceGroupSlides` fresh-base helper `attachSlideAudio`/`removeSlideAudio` already use. The assigned row (`Vamp: {vampLabel}` + Change + Clear + stale hint) replaces the file-name/Remove cluster only while `isVampAssigned`; a "Choose a vamp" affordance appears both in the empty-audio state and beside a manually uploaded file. The loop checkbox stays enabled/checked after assignment.
- `src/views/ServiceEditorView.vue` — `const vampStore = useVampStore()` + `vampStore.subscribe(orgId)` added inside `initStores()`'s existing `authStore.isEditor` block, closing the "picker permanently empty on a direct Slides-tab visit" gap RESEARCH.md flagged.
- Three test files: `VampPicker.test.ts` (new, 9 tests), a new `describe('EditSlideDrawer (Phase 141-01 — vamp assignment)')` block (9 tests) in `EditSlideDrawer.test.ts`, and 3 new `(141-01)` tests in `ServiceEditorView.test.ts`.

## Task Commits

Each task followed the RED -> GREEN TDD cycle with separate commits:

1. **Task 1: GroupSlideEntry.vampId/vampLabel + VampPicker.vue + VampPicker.test.ts**
   - `33ce439f` test(141-01): add failing test for VampPicker (RED)
   - `5df1d2bc` feat(141-01): add GroupSlideEntry.vampId/vampLabel + VampPicker.vue (GREEN)
2. **Task 2: EditSlideDrawer assign/change/clear + stale hint**
   - `be9f8854` test(141-01): add failing test for EditSlideDrawer vamp assignment (RED)
   - `50fff052` feat(141-01): add vamp assign/change/clear to EditSlideDrawer (GREEN)
3. **Task 3: ServiceEditorView.initStores() vamp subscription**
   - `f54b6af8` test(141-01): add failing test for ServiceEditorView vamp subscription (RED)
   - `24a3f0e2` feat(141-01): subscribe useVampStore inside ServiceEditorView's isEditor gate (GREEN)

_Every RED commit was verified to fail before implementation existed — Task 1 via a genuine Vite import-resolution failure (component file didn't exist), Tasks 2 and 3 via temporary reversion of the just-drafted `.vue` implementation to the pre-plan `HEAD` version and re-running the new tests. Every GREEN commit was verified to pass immediately after restoring/committing the implementation._

## Files Created/Modified

- `src/types/slideGroup.ts` — added `vampId?`/`vampLabel?` to `GroupSlideEntry`
- `src/components/VampPicker.vue` — new searchable vamp-picker component
- `src/components/__tests__/VampPicker.test.ts` — 9 tests
- `src/components/slides/EditSlideDrawer.vue` — vamp assign/change/clear + assigned-row template
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` — `@/stores/vamps` mock, `makeVamp` fixture, 9 new tests
- `src/views/ServiceEditorView.vue` — `vampStore.subscribe(orgId)` inside `initStores()`
- `src/views/__tests__/ServiceEditorView.test.ts` — `@/stores/vamps` mock, 3 new `(141-01)` tests

## Decisions Made

- `attachVampToSlide` short-circuits (no write) when the entry already carries the exact same `vampId`/`audioUrl`/`audioLoop`/`vampLabel` as the selected vamp — re-selecting the assigned vamp is a pure UI no-op, matching the plan's idempotency requirement.
- `clearVampAssignment` uses four `delete` statements on a shallow copy (never assigns `undefined`), following the file's own `removeSlideAudio`/`removeSlideBackground` convention rather than relying solely on `replaceGroupSlides`'s `stripUndefined()` backstop.
- `vampStale` is computed as `isVampAssigned && !vampStore.isLoading && !vamps.some(id match)` — the `!isLoading` guard avoids a false-positive stale flash before the first snapshot arrives and keeps the hint silently absent for a viewer (whose store never subscribes), which is an accepted, documented gap rather than a regression.
- `vampStore.subscribe(orgId)` was placed inside the `isEditor` gate in `ServiceEditorView.initStores()`, alongside `rosterStore`/`quartersStore`, per RESEARCH.md Pitfalls 1/2 — `vamps` is read-gated to editors by `firestore.rules`' generic catch-all, so an ungated subscribe would throw permission-denied for viewers.

## Deviations from Plan

None — plan executed exactly as written. All `must_haves.truths` for Task 1/2/3 are demonstrated by the three test files as specified. Two test-authoring adjustments were made during implementation (not plan deviations, just TDD debugging):
- Two `toBe` reference-equality assertions (comparing `props.group.slides`/a passthrough entry against the plain fixture object) were switched to `toEqual`, since Vue wraps mounted props in reactive proxies that break `Object.is` identity even though the underlying data is unchanged — this is standard Vue Test Utils behavior, not a functional issue.
- Two of the three new `(141-01)` tests in `ServiceEditorView.test.ts` initially lacked the `(141-01)` name suffix needed for the plan's `-t "141-01"` filter to select exactly 3 tests; renamed to include it.

## Issues Encountered

None beyond the two test-authoring adjustments noted above, both caught and fixed before the GREEN commits.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 141-02 (`SlideCanvas.vue` `suppressAudio` prop across the 4 output call sites) can proceed independently — it does not depend on anything built in this plan.
- Plan 141-03 (Run control window `AudioPlayer` mount, arm toggle, blocked/unavailable warnings, ♪ badges) can read `GroupSlideEntry.vampId`/`vampLabel` via `useSlideGroups().groupsBySlotId` exactly as RESEARCH.md Pattern 4 specifies — no changes needed here to support it.
- Plan 141-04 (delete-warning affected-service count) is fully independent of this plan.
- No blockers. `npm run type-check` (`vue-tsc --build`) is clean. Full app suite (`npx vitest run`) matches the documented baseline exactly: 237/238 files, 5814 tests passed, only `src/storage.rules.test.ts` failing (Storage-emulator dependent, per CLAUDE.md).
- Manual-Only UAT (141-UI-SPEC.md visual fidelity for the picker/assigned row, and the E1 error backstop) remains batched to v2.15 milestone end per STATE.md's deferred-verification policy — not a blocker for Plans 141-02/03/04.

---
*Phase: 141-vamp-slide-assignment-live-playback*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 8 files (2 created source/test files + 4 modified source files + 1 modified test-suite entry +
this SUMMARY) confirmed present on disk. All 7 commit hashes (33ce439f, 5df1d2bc, be9f8854, 50fff052,
f54b6af8, 24a3f0e2, 5007c0b5) confirmed present in `git log`.
