---
phase: 24-slide-group-model-and-migration
plan: 06
subsystem: ui
tags: [vue3, pinia, service-editor, slide-groups, delete-cascade, media-attachment, vitest, vue-test-utils]

# Dependency graph
requires:
  - phase: 24-01
    provides: "Required, stable ServiceSlot.id; backfillSlotIds(service, reference?) reference-stable legacy migration"
  - phase: 24-02
    provides: "useSlideGroups Pinia store — deleteGroup(orgId, slotId), setGroupBedMedia(orgId, slotId, patch)"
  - phase: 24-05
    provides: "useSlideshowAssembly's re-exposed groupsBySlotId ComputedRef; canWrite-gated subscription/materialization"
provides:
  - "ServiceEditorView's load watcher backfills slot ids into BOTH localService and originalService identically on legacy load, and reuses local ids across repeated still-id-less remote snapshots"
  - "confirmSlotDelete cascades a remove-element delete to its anchored slide group (deleteGroup awaited BEFORE the splice), with a delete-confirm body that names the true slide count and whichever attached artefacts (bed audio/video, per-slide audio, operator notes) the live group actually has (R029)"
  - "onSlotBedAudioChange/onSlotBedVideoChange write the Service Order tab's media control through slideGroups' setGroupBedMedia (with explicit clear flags), and its displayed urls read the group bed via groupsBySlotId — closing RESEARCH.md Pitfall 1"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shallowMount's default `shallow` behavior auto-stubs <Teleport> (discarding its children) unless `stubs: { teleport: false }` is set explicitly — required to assert against any Teleported dialog under shallowMount"
    - "A synchronous-mock test store (services array resolved before mount, not via async onSnapshot) makes the autosave watcher's `autosaveInitialized` guard consume the FIRST post-mount mutation instead of the load event itself, since the load watcher's `{ immediate: true }` fires before the autosave watcher is even created — tests exercising the very-first real edit after load need one throwaway edit to absorb that guard first"
    - "A deferred (resolve-controlled) mock promise proves write-then-splice ordering: assert the pre-splice DOM state while the mock promise is still pending, then resolve it and assert the post-splice state"

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "hoisted the services-store mock's updateService from an inline per-mount vi.fn() to a module-level named spy (mockUpdateService) so tests can inspect autosave payloads — every prior instance created a fresh, uninspectable mock per mount"
  - "converted the @/stores/slideGroups mock from a static empty stub to a stateful/reactive one (mockSlideGroupsState.groups + a live groupsBySlotId getter), mirroring useSlideshowAssembly.test.ts's pattern, so Task 2/3 tests can control which groups exist and assert on deleteGroup/setGroupBedMedia calls"
  - "added enableAutoUnmount(afterEach) to this test file — no prior test ever unmounted its wrapper, leaving a live 800ms autosave timer running in the background that could fire during a LATER test's own wait window and pollute the shared updateService spy (Rule 3, discovered while verifying Task 1's own new call-count assertions)"
  - "confirmSlotDelete's remove-element branch surfaces a failed group delete via console.error + leaving the slot in place (mirrors the existing onToggleRoleOverride optimistic-rollback pattern), not a new user-facing error banner — matching T-24-06-02's mitigation"
  - "delete-confirm body wording is Claude's discretion (D-03/CONTEXT.md specified only the shape: name the element, the true slide count, and genuinely-present attached artefacts) — no exact copy was locked by the plan"

requirements-completed: [R029, R028, R030, R018]

coverage:
  - id: D1
    description: "Loading a legacy service backfills slot ids into localService and originalService identically (isDirty stays false, no autosave fires); a repeated still-id-less remote snapshot reuses the local ids instead of minting fresh ones"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — 'slot id backfill on load (Phase 24-06 Task 1)' describe block (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Deleting a plan item deletes its anchored slide group (deleteGroup awaited before the splice); a failed delete leaves the slot in place; the confirm names the true slide count and genuinely-present attached media/notes, or the absence of both, for every edge case (no group, shared-song adjacency, middle-slot reindex)"
    requirement: "R029"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — 'slot delete cascades to its group (Phase 24-06 Task 2, R029)' describe block (10 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Service Order tab's per-slot media control writes through slideGroups.setGroupBedMedia (explicit clear flags, never an undefined url) instead of mutating localService.slots[index], and displays the group bed rather than the deprecated slot fields — closing RESEARCH.md Pitfall 1"
    requirement: "R030"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts — 'slot media control retargeted at the group bed (Phase 24-06 Task 3)' describe block (6 tests); src/components/__tests__/SlotMediaAttachment.test.ts (5 tests, unchanged/untouched); src/components/__tests__/PresentationViewer.test.ts (58 tests, Phase 23 regression guard)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Repo-wide npm run type-check and npm run build both exit 0; no new test failures across the full unit suite beyond the pre-existing, pre-documented 10-file baseline"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "npm run type-check; npm run build; npx vitest run src/ (3152 passed / 36 failed / 18 skipped across 157 files — the 10 failing files are exactly the documented baseline: 8 .gsd/quarantine/worktrees/** stale copies, src/storage.rules.test.ts (needs emulator), src/views/__tests__/RosterView.test.ts (stale pre-existing assertion))"
        status: pass
    human_judgment: false
  - id: D5
    description: "Real Firestore round-trip, real pre-Phase-24 media migration, and delete-confirm copy against real data — deferred to the project's batch human-verify per 24-VALIDATION.md § Manual-Only Verifications, not a blocking checkpoint in this plan"
    verification: []
    human_judgment: true
    rationale: "Requires a live Firestore backend, two browser tabs, and a real pre-Phase-24 service carrying slot media — explicitly deferred to STATE.md's Deferred Verification batch per this plan's own <human-check> section, not provable in a mocked unit test."

# Metrics
duration: 26min
completed: 2026-07-26
status: complete
---

# Phase 24 Plan 06: Service Editor Backfill, Delete Cascade, and Media Retarget Summary

**`ServiceEditorView`'s load watcher backfills legacy slot ids invisibly, `confirmSlotDelete` cascades a remove-element delete to its slide group behind a warning that names the true slide count and attached media, and the slot media control now writes/reads the group bed instead of the deprecated per-slot fields — closing this phase's only Pitfall-1 gap and its only view-level R029 requirement.**

## Performance

- **Duration:** 26 min (commit-to-commit; first commit 2026-07-25T23:54:41-04:00, final task commit 2026-07-26T00:20:54-04:00)
- **Started:** 2026-07-25T23:54:41-04:00
- **Completed:** 2026-07-26T00:20:54-04:00
- **Tasks:** 3 (each TDD: RED test commit → GREEN feat commit)
- **Files modified:** 2 (`src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`)

## Accomplishments

- **Task 1 — Backfill slot ids on load (D-01/R028):** the load watcher's initial-load branch runs `found` through `backfillSlotIds` once and clones the SAME backfilled value into both `localService` and `originalService`, so `isDirty` stays false and no autosave fires after a legacy load. The remote-merge branch passes the current `localService` as the `backfillSlotIds` reference, so an already-known id is reused (not re-minted) across repeated still-id-less remote snapshots — proven by mounting with a reactive mock services array, mutating it in place to simulate a second stale snapshot, and asserting the ids captured in two successive real saves are identical.
- **Task 2 — Delete cascade with a loss-naming warning (D-03/R029):** `confirmSlotDelete`'s remove-element branch resolves the slot's own id BEFORE `performRemoveSlot`, awaits `slideGroupsStore.deleteGroup(orgId, slotId)` first, and only then splices — a failed delete leaves the slot in place (console.error, no silent local/remote divergence). `deleteConfirmBody` now composes the warning from the live group (`groupsBySlotId.get(slotId)`): the true `slides.length`, plus bed audio, bed video, per-slide audio, and operator notes only when genuinely present; a slot with no group names zero slides and makes no attached-media claim. The clear-song branch is untouched — it empties a SONG slot's assignment, not a remove-element delete, so no group is deleted.
- **Task 3 — Retarget the media control at the group bed (R030/Pitfall 1):** `onSlotAudioUrlChange`/`onSlotVideoUrlChange` renamed to `onSlotBedAudioChange`/`onSlotBedVideoChange` and retargeted at `slideGroupsStore.setGroupBedMedia`, passing the explicit `clearAudio`/`clearVideo` flag when the emitted url is absent (never an undefined bed field, since `stripUndefined()` would erase that intent before Firestore saw it). The `SlotMediaAttachment` mount's `:audioUrl`/`:videoUrl` bindings now read `groupsBySlotId.get(slot.id)?.bedAudioUrl`/`bedVideoUrl` instead of the slot's own deprecated fields, so an attachment made in one session is still shown after a reload. `SlotMediaAttachment.vue` itself is unchanged (confirmed its own 5-test suite and the Phase 23 `PresentationViewer.test.ts` 58-test regression guard both stay green).
- Discovered and fixed a genuine test-infrastructure gap (Rule 3, blocking): `ServiceEditorView.test.ts` never unmounted any wrapper, leaving live 800ms autosave timers and Sortable instances running across tests; added `enableAutoUnmount(afterEach)`. Also discovered `shallowMount`'s default `shallow` behavior auto-stubs `<Teleport>` (discarding its children) unless explicitly opted out via `stubs: { teleport: false }` — without this, the slot-delete confirm dialog (Teleported to `document.body`) never rendered in tests.

## Task Commits

Each task followed RED (failing test) → GREEN (implementation) TDD gates:

1. **Task 1: Backfill slot ids inside the existing load watcher**
   - `f359118` (test) — RED: 2 of 4 new tests genuinely fail without the implementation (the other 2 are non-regression invariants that hold either way); also fixes the enableAutoUnmount/mockUpdateService test-infra gap
   - `d3ef9fd` (feat) — GREEN: `backfillSlotIds` wired into both load-watcher branches
2. **Task 2: Delete cascade with a warning that names what will be lost (R029)**
   - `ad683c6` (test) — RED: 7 of 10 new tests genuinely fail without the implementation; converts the `@/stores/slideGroups` mock to a stateful/reactive one
   - `3685291` (feat) — GREEN: `confirmSlotDelete` cascade + `deleteConfirmBody` loss-naming copy
3. **Task 3: Retarget the slot media control at the group bed**
   - `928e778` (test) — RED: all 6 new tests genuinely fail without the implementation
   - `20e097a` (feat) — GREEN: `onSlotBedAudioChange`/`onSlotBedVideoChange` + group-bed display bindings

**Plan metadata:** (this commit, following this summary)

## Files Created/Modified

- `src/views/ServiceEditorView.vue` — load watcher backfills slot ids on both branches; `deleteConfirmBody` composes the R029 loss-naming warning from the live group; `confirmSlotDelete` cascades a remove-element delete to `slideGroupsStore.deleteGroup`; `onSlotBedAudioChange`/`onSlotBedVideoChange` (renamed from `onSlotAudioUrlChange`/`onSlotVideoUrlChange`) write `setGroupBedMedia`; `SlotMediaAttachment`'s bindings read the group bed; new `useSlideGroups()` import/instance
- `src/views/__tests__/ServiceEditorView.test.ts` — `@/stores/slideGroups` mock converted to a stateful/reactive stub; `enableAutoUnmount(afterEach)` added; `mockUpdateService` hoisted to a named, inspectable spy; three new describe blocks (Task 1: 4 tests, Task 2: 10 tests, Task 3: 6 tests)

## Decisions Made

- Hoisted the services-store mock's `updateService` to a module-level named spy so tests can inspect what the autosave path actually persisted — every prior test in this file received a fresh, uninspectable `vi.fn()` per mount.
- Converted the `@/stores/slideGroups` mock from a static empty stub to a stateful/reactive one (mirroring `useSlideshowAssembly.test.ts`'s established pattern), so this plan's tests can control which groups exist per test and assert on `deleteGroup`/`setGroupBedMedia` call arguments.
- Added `enableAutoUnmount(afterEach)` to this test file (Rule 3, blocking): no prior test ever unmounted its wrapper, so a real 800ms autosave timer left running from an earlier test could fire during a later test's own wait window and pollute the shared `updateService` spy — this was discovered while verifying Task 1's own new call-count assertions, not a pre-existing failure this plan needed to work around.
- `confirmSlotDelete`'s failure path surfaces a failed group delete via `console.error` + leaving the slot in place, mirroring the existing `onToggleRoleOverride` optimistic-rollback pattern rather than introducing a new user-facing error banner class — matches T-24-06-02's mitigation without adding UI surface the plan didn't ask for.
- The delete-confirm body's exact wording is Claude's discretion (D-03/CONTEXT.md specified only the shape — name the element, the true slide count, and genuinely-present attached artefacts — not exact copy).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ServiceEditorView.test.ts` never unmounted any wrapper, leaking live autosave timers across tests**
- **Found during:** Task 1 (writing the first tests that actually wait out the 800ms autosave debounce to assert on `updateService`'s call count)
- **Issue:** No test in this file called `wrapper.unmount()`, and no global auto-unmount was configured. A test that mutates `localService` without waiting the full debounce leaves a real `setTimeout`-driven autosave in flight in a component instance that outlives the test. Once `updateService` was hoisted to a shared spy (needed to inspect payloads), a leaked timer firing during a LATER test's own wait window polluted that test's call count — surfaced as an unexpectedly-called `mockUpdateService` with a payload from an unrelated earlier test.
- **Fix:** Added `enableAutoUnmount(afterEach)` from `@vue/test-utils` (same pattern already established in `PresentationViewer.test.ts`/`PptxImportModal.test.ts`), which triggers `ServiceEditorView`'s existing `onUnmounted` cleanup (`clearTimeout(autosaveTimer)`, `sortableInstance?.destroy()`) after every test.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** Re-ran the full file after the fix — all 4 Task 1 tests (previously flaky/contaminated) passed deterministically across multiple runs.
- **Committed in:** `f359118` (Task 1 RED commit)

**2. [Rule 3 - Blocking] `shallowMount` silently discards `<Teleport>` content by default**
- **Found during:** Task 2 (writing tests against the slot-delete confirm dialog, which renders via `<Teleport to="body">`)
- **Issue:** Vue Test Utils' `shallowMount` treats Vue's built-in `Teleport` component as any other stubbable component under its default `shallow` mode — it replaces Teleport's children with an empty stub tag unless the caller explicitly opts out. Every assertion against the Teleported dialog (heading text, confirm/cancel buttons, `deleteConfirmBody` copy) silently found nothing, even though the component's reactive state (`showSlotDeleteConfirm`) was confirmed correct via direct instrumentation.
- **Fix:** Added `stubs: { teleport: false }` to this describe block's `mountView()` config, opting the real Teleport content back in (matches the existing documented pattern in `PptxImportModal.test.ts` for `mount()`, which doesn't hit this because it isn't shallow — this is the first `shallowMount`-based suite in the codebase to need a Teleported dialog).
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** All 10 Task 2 tests pass with real Teleported dialog content asserted against `document.body`.
- **Committed in:** `ad683c6` (Task 2 RED commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking test-infrastructure issues that would otherwise have made this plan's own new assertions unverifiable or flaky)
**Impact on plan:** Both fixes live entirely in the test file; zero production-code impact. No scope creep — confirmed neither fix touches any test outside this file, and both were required specifically to get a truthful pass/fail signal from this plan's own new tests.

## Issues Encountered

None beyond the two deviations above. `npm run type-check` (vue-tsc --build across all three tsconfig references) exits 0. `npm run build` exits 0. `npx vitest run src/` reports 3152 passed / 36 failed / 18 skipped across 157 files — every one of the 10 failing files is exactly the pre-existing, pre-documented baseline (8 `.gsd/quarantine/worktrees/**` stale duplicates, `src/storage.rules.test.ts` requiring the Storage emulator, `src/views/__tests__/RosterView.test.ts`'s stale pre-existing assertion). Zero new failures in any real source file. `git diff --stat firestore.rules` is empty — no rules change was needed or made.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 24 (Slide Group Model and Migration) is now fully code-complete across all 6 plans: the type contract and stable slot ids (24-01), the Firestore store (24-02), pure derive/reconcile functions (24-03), the assembler refactor (24-04), the reactive subscription/materialization/reconciliation layer (24-05), and this plan's view-level backfill/delete-cascade/media-retarget (24-06).
- The three deferred manual-only verifications from this plan (real Firestore two-tab round-trip, real pre-Phase-24 media migration, delete-confirm copy against real data) join the project's existing Deferred Verification batch (STATE.md), alongside Phase 20-23's outstanding human-verify checkpoints.
- No blockers. `npm run type-check`, `npm run build`, and the targeted test suites are all green; the repo-wide unit suite shows zero new failures beyond the documented baseline.

---
*Phase: 24-slide-group-model-and-migration*
*Completed: 2026-07-26*

## Self-Check: PASSED

All claimed files found on disk (`src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts`, this SUMMARY). All claimed commits found in git log (`f359118`, `d3ef9fd`, `ad683c6`, `3685291`, `928e778`, `20e097a`).
