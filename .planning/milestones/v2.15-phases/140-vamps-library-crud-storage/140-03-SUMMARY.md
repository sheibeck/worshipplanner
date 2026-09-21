---
phase: 140-vamps-library-crud-storage
plan: 03
subsystem: ui
tags: [vue, pinia, tdd, tailwind]

requires:
  - phase: 140-01
    provides: "Vamp/VampAttachment types, VAMP_KEYS, useVampStore (subscribe/unsubscribeAll/addVamp/updateVamp/deleteVamp/filteredVamps/searchQuery), useVampFileUpload (addFile)"
  - phase: 140-02
    provides: "storage.rules vamp-files/ block — the server-side authority the MP3 drop-zone's client-side accept hint defers to"
provides:
  - "VampTable.vue — flat one-vamp-per-row table (Vamp/Key/Tempo/Audio), name-or-key search box, amber 'No MP3 attached' state, 'N vamps · M with audio' sub-head, empty-library state"
  - "VampSlideOver.vue — slide-out editor: Name, 12-chip VAMP_KEYS picker, Tempo, MP3 attach(drop-zone)/play/remove, create->edit transition after addVamp, single-step Delete-vamp inline-confirm"
  - "SongsView.vue Songs | Vamps tab bar with count badges, a vampStore church-switch watch, and a 'New Vamp' toolbar affordance"
affects: [phase-141-vamp-slide-assignment]

tech-stack:
  added: []
  patterns:
    - "Narrowed mirror of SongTable.vue/SongSlideOver.vue/SongFilesTab.vue, mapped to the app's dark gray-950 language per 140-DESIGN-NOTES.md's reuse map"
    - "Page-level v-show tab bar (not a route) toggling two sibling regions, each with its own store subscription watch registered alongside (not replacing) the other"

key-files:
  created:
    - src/components/VampTable.vue
    - src/components/VampSlideOver.vue
    - src/components/__tests__/VampTable.test.ts
    - src/components/__tests__/VampSlideOver.test.ts
  modified:
    - src/views/SongsView.vue
    - src/views/__tests__/SongsView.test.ts

key-decisions:
  - "VampTable renders rows from useVampStore().filteredVamps directly (store owns the name-or-key filter) while the sub-head/empty-state counts derive from the `vamps` prop passed in by SongsView (the same filtered array in real usage, since SongsView passes vampStore.filteredVamps as the prop) — mirrors SongsView's own convention of showing a filtered count in its subtitle."
  - "VampSlideOver's create->edit transition does NOT emit 'saved' on the first Save of a new vamp — only on Save of an already-persisted vamp. Emitting 'saved' on create would let the parent's Songs-slide-over-style '@saved=\"open=false\"' wiring close the drawer before the MP3 could be attached, so the create path stays silent and simply switches internal state (via a local `localId` ref) into edit mode for the new id."
  - "The Vamps tab wraps the existing Songs content in v-show (not v-if) so SongTable's internal sort/scroll state and the Hidden Songs panel toggle survive a tab switch, matching the plan's 'v-show to preserve its state' option."
  - "MP3 attach/play/remove UI is gated entirely by whether an id exists (isCreateMode) — a brand-new, not-yet-saved vamp shows 'Save this vamp to attach an MP3' instead of a dropzone, since useVampFileUpload.addFile requires a vampId."

patterns-established: []

requirements-completed: [R435, R436]

coverage:
  - id: D1
    description: "VampTable renders one row per vamp (Vamp/Key/Tempo/Audio), an em-dash for a tempo-less vamp, an amber 'No MP3 attached' state for a null attachment, and the fileName for a present one"
    requirement: "R436"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampTable.test.ts#renders one row per vamp with name/key/tempo, and an em-dash for a tempo-less vamp"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VampTable.test.ts#renders \"No MP3 attached\" for a vamp with a null attachment, and the fileName for one with an attachment"
        status: pass
    human_judgment: false
  - id: D2
    description: "The search box two-way binds to useVampStore().searchQuery and rows render from filteredVamps (store owns the filter, not a parallel local one); clicking a row emits select"
    requirement: "R436"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampTable.test.ts#typing in the search input sets the store searchQuery"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VampTable.test.ts#clicking a row emits select with that vamp"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 'N vamps · M with audio' sub-head and an empty-library state with an 'Add Vamp' affordance (emits add)"
    requirement: "R436"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampTable.test.ts#shows a sub-head with the total vamp count and the count with audio"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/VampTable.test.ts#shows the empty-library state and emits add when no vamps exist"
        status: pass
    human_judgment: false
  - id: D4
    description: "VampSlideOver renders exactly the 12 VAMP_KEYS as clickable chips (closed picker, not free-typed), and clicking one selects it"
    requirement: "R435"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampSlideOver.test.ts#renders exactly the 12 VAMP_KEYS chips, and clicking one marks it selected"
        status: pass
    human_judgment: false
  - id: D5
    description: "The MP3 section shows a dashed drop-zone with no attachment, and the fileName + a play control with one"
    requirement: "R435"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampSlideOver.test.ts#renders the dashed drop-zone when there is no attachment, and the fileName + a play control when there is one"
        status: pass
    human_judgment: false
  - id: D6
    description: "Saving a NEW vamp calls addVamp, captures the returned id, and keeps the drawer open in edit mode (does not emit close/saved) so the MP3 can attach to the just-created vamp"
    requirement: "R435"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampSlideOver.test.ts#Save on a new vamp calls addVamp and keeps the drawer open (does not emit close or saved)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Delete-vamp button is a single-step inline-confirm; confirming calls deleteVamp then emits deleted (no soft-delete/restore)"
    requirement: "R435"
    verification:
      - kind: unit
        ref: "src/components/__tests__/VampSlideOver.test.ts#the Delete-vamp button reveals a confirm card, and confirming calls deleteVamp then emits deleted"
        status: pass
    human_judgment: false
  - id: D8
    description: "SongsView.vue shows a Songs | Vamps tab bar (page title stays 'Songs', both tabs count-badged); the Vamps tab renders VampTable; a vampStore watch subscribes on the current org (church-switch safety)"
    requirement: "R436"
    verification:
      - kind: unit
        ref: "src/views/__tests__/SongsView.test.ts#Songs | Vamps tab bar (140-03) renders the tab bar with the Songs tab active by default"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/SongsView.test.ts#Songs | Vamps tab bar (140-03) switching to the Vamps tab shows the Vamps region (VampTable) and keeps the page title \"Songs\""
        status: pass
      - kind: unit
        ref: "src/views/__tests__/SongsView.test.ts#Songs | Vamps tab bar (140-03) subscribes the vampStore to the current org on mount (church-switch safety)"
        status: pass
    human_judgment: false
  - id: D9
    description: "The Nocturne->gray-950 visual rendering of the tab/table/editor, and a real deployed MP3 upload+play+download, are Manual-Only UAT (batched to milestone end per STATE.md's v2.15 deferred-verification policy)"
    human_judgment: true
    rationale: "Visual fidelity and a real Storage-backed upload/playback round-trip require a live browser + deployed environment; this is explicitly out of this plan's automated verify per 140-03-PLAN.md's <verification> section and STATE.md's v2.15 batched-UAT policy."

duration: ~90min
completed: 2026-09-13
status: complete
---

# Phase 140 Plan 3: Vamps Library UI (Tab Bar, Table, Slide-Over) Summary

**VampTable.vue (flat searchable Vamp/Key/Tempo/Audio table) and VampSlideOver.vue (12-chip key picker + MP3 attach/play/remove + create->edit transition + single-step delete), wired into a new Songs | Vamps tab bar in SongsView.vue with its own church-switch-safe org watch — all narrowed mirrors of the shipped v2.11 Song table/editor.**

## Performance

- **Duration:** ~90 min (task execution + full-suite/type-check verification)
- **Tasks:** 3 completed
- **Files modified:** 6 (2 created components, 2 created test files, 2 modified files)

## Accomplishments

- `src/components/VampTable.vue` — flat one-vamp-per-row table (Vamp/Key/Tempo/Audio), a name-or-key search box bound to `useVampStore().searchQuery`/`filteredVamps`, an amber "No MP3 attached" state, a "N vamps · M with audio" sub-head, and an empty-library state with an "Add Vamp" affordance.
- `src/components/VampSlideOver.vue` — single flat-form drawer (no in-drawer tabs): Name, a closed 12-chip `VAMP_KEYS` picker, optional Tempo, an MP3 section (dashed drop-zone -> play/pause + filename + meta + remove), a create->edit transition after `addVamp` that keeps the drawer open for the new id, and a single-step Delete-vamp inline-confirm calling `deleteVamp`.
- `src/views/SongsView.vue` — a page-level `Songs | Vamps` tab bar (title stays "Songs", both tabs count-badged), the existing Songs content wrapped in `v-show` (unchanged behavior/subscription), a new Vamps region rendering `VampTable`/`VampSlideOver`, a "New Vamp" toolbar button replacing the Songs toolbar when the Vamps tab is active, and a second `authStore.orgId` watch that subscribes/unsubscribes `vampStore` alongside the existing `songStore` watch.
- `src/components/__tests__/VampTable.test.ts` (6 tests) and `src/components/__tests__/VampSlideOver.test.ts` (4 tests) — new TDD component tests.
- `src/views/__tests__/SongsView.test.ts` — added a `@/stores/vamps` mock, `VampTable`/`VampSlideOver` stubs, and 3 new tab-bar assertions; all 8 tests (5 pre-existing + 3 new) pass.

## Task Commits

Tasks 1 and 2 followed the RED -> GREEN TDD cycle with separate commits; Task 3 (non-TDD, `type="auto"`) is a single commit:

1. **Task 1: VampTable.vue**
   - `20404a56` test(140-03): add failing test for VampTable (RED)
   - `fbc9d336` feat(140-03): add VampTable — flat searchable one-vamp-per-row table (GREEN)
2. **Task 2: VampSlideOver.vue**
   - `14eb5acc` test(140-03): add failing test for VampSlideOver (RED)
   - `ac8cfd38` feat(140-03): add VampSlideOver — slide-out editor with chip key picker + MP3 (GREEN)
3. **Task 3: Songs | Vamps tab bar + vampStore church-switch watch**
   - `8f87a492` feat(140-03): add Songs | Vamps tab bar + vampStore church-switch watch

_Every RED commit was verified to fail before the implementation file existed (temporarily removed the not-yet-committed `.vue` file and confirmed a Vite import-resolution failure), and every GREEN commit was verified to pass immediately after restoring it._

## Files Created/Modified

- `src/components/VampTable.vue` — flat searchable Vamp table
- `src/components/VampSlideOver.vue` — slide-out CRUD editor
- `src/components/__tests__/VampTable.test.ts` — 6 tests
- `src/components/__tests__/VampSlideOver.test.ts` — 4 tests
- `src/views/SongsView.vue` — Songs | Vamps tab bar + vampStore watch
- `src/views/__tests__/SongsView.test.ts` — `@/stores/vamps` mock, child stubs, 3 new tab-bar tests

## Decisions Made

- VampTable's rows come from `useVampStore().filteredVamps` (per plan — the store owns the name-or-key filter), while the sub-head total/empty-state check use the `vamps` prop (which SongsView passes as `vampStore.filteredVamps`, so in real usage they're the same array) — this mirrors SongsView's own subtitle convention of showing a filtered, not raw, count.
- VampSlideOver's create-save path deliberately does **not** emit `saved` — only an update-save does. This is the mechanism that keeps the drawer open after creating a new vamp (per the plan's must-have) without requiring SongsView's `@saved` wiring to special-case create vs. update.
- The MP3 section is fully gated on `isCreateMode` (i.e., whether an id exists yet): a not-yet-saved vamp shows "Save this vamp to attach an MP3" instead of a drop-zone, since `useVampFileUpload().addFile` requires a `vampId`.
- The Songs tab's existing content (SongBrowser, SongTable, Hidden Songs panel) is wrapped in `v-show`, not `v-if`, per the plan's parenthetical option — preserves SongTable's internal sort/scroll/selection state across a tab switch.

## Deviations from Plan

None — plan executed exactly as written. All five `must_haves.truths` are demonstrated by the two new component test files and the updated `SongsView.test.ts`.

## Issues Encountered

- **TDD/reactivity ordering bug (self-caught, fixed before any commit):** the first `VampSlideOver.vue` draft declared `playing`/`audioErrored` refs *after* the `watch(() => props.open, ..., { immediate: true })` block that reads them, causing a `ReferenceError: Cannot access 'playing' before initialization` at every mount (all 4 tests failed). Moved both ref declarations above the watch. Caught by running the test suite before committing — no production impact since this was fixed prior to the GREEN commit.
- **Teleport unreachable in test DOM (self-caught, fixed before any commit):** `VampSlideOver.vue`'s `<Teleport to="body">` meant `wrapper.find`/`.get` couldn't reach its content by default. Fixed by adding `global: { stubs: { Teleport: { template: '<div><slot /></div>' } } }` to the test's mount helper — the exact convention already used by `SongSlideOver.test.ts`.
- **v-show vs. `.exists()` in a new SongsView test (self-caught):** an initial `expect(...vamp-table-stub...).exists()).toBe(false)` assertion failed because `v-show` keeps the element in the DOM (hidden via `display:none`) rather than removing it. Corrected to `.isVisible()`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 140 (Vamps Library — CRUD & Storage) is now fully built across all three plans: 140-01 (client/data foundation), 140-02 (storage rules + rules-test proofs), 140-03 (this plan, the UI).
- Phase 141 (vamp-to-slide assignment, live playback, arm-audio, Audience-only audibility — R437–R440) can build directly against `useVampStore`, `Vamp`/`VampAttachment`, and the shipped `VampTable`/`VampSlideOver` UI.
- Manual-Only UAT (the Nocturne->gray-950 visual rendering of the tab/table/editor, and a real deployed MP3 upload+play+download) remains batched to milestone end per STATE.md's v2.15 deferred-verification policy — not a blocker for this plan or Phase 141 starting.
- No blockers. `npm run type-check` is clean; the full app suite (`npx vitest run`) matches the documented baseline exactly — 236/237 files, 5784 tests passed, only `src/storage.rules.test.ts` failing (Storage-emulator dependent, per CLAUDE.md).

---
*Phase: 140-vamps-library-crud-storage*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 7 files (2 created components, 2 created test files, 2 modified files, this SUMMARY) confirmed present
on disk. All 5 task commit hashes (20404a56, fbc9d336, 14eb5acc, ac8cfd38, 8f87a492) confirmed present in
`git log`.
