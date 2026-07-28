---
phase: 24-slide-group-model-and-migration
plan: 05
subsystem: slideshow-assembly
tags: [typescript, vue3, pinia, composable, reactivity, effect-scope, lazy-migration, reconciliation]

# Dependency graph
requires:
  - phase: 24-02
    provides: "useSlideGroups Pinia store (subscribeGroups/materializeGroupIfMissing/replaceGroupSlides/groupsBySlotId)"
  - phase: 24-03
    provides: "buildInitialGroup/reconcileGroup/sourceSignature pure functions (the materializer this plan's composable calls)"
  - phase: 24-04
    provides: "assembleSlideshow refactored to join stored SlideGroup structure via sourceRef; AssemblyInputs.groupsBySlotId"
provides:
  - "useSlideshowAssembly extended with the slideGroups subscription (riding the existing org watcher), canWrite-gated lazy materialization, and canWrite-gated reconciliation triggering"
  - "UseSlideshowAssemblyOptions.canWrite -- Ref|ComputedRef|boolean, defaults false, gates every group write"
  - "UseSlideshowAssemblyReturn.groupsBySlotId -- re-exposed store getter for 24-06's delete warning"
  - "UseSlideshowAssemblyReturn.pendingReconciliations -- reactive confirm-required list for the Phase 26 dialog"
  - "ServiceEditorView.vue's single call site wired with canWrite: computed(() => authStore.isEditor)"
affects: [24-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synchronous-decision / async-effect split: materializationCandidates and reconciliationOutcomes are plain computed()s that decide WHAT needs a write; the actual async store call happens only inside the watch() callback. An async function body passed directly to watch/watchEffect only tracks reactive reads made before its first await -- reads made after resuming from an await happen outside the effect's tracking window and silently drop dependencies. Keeping the decision phase synchronous (mirroring the pre-existing distinctSongIds -> loadMissingLyrics shape) avoids that pitfall entirely for both new watchers."
    - "Materialization keyed strictly on slot.id via slideGroupsStore.groupsBySlotId.has(slot.id) -- never array index or slot.position, so reindexSlots's every-drag position rewrite can never touch a group (D-01, T-24-05-02)."
    - "Belt-and-braces in-flight guards (materializingSlotIds Set, appliedGroupRefForSlot identity Map) sit ON TOP of the store's deterministic-doc-id + getDoc guard -- they exist to stop THIS composable's own reactive recomputes from re-issuing a write while a prior one is still in flight or against the same unchanged stored group, not to replace the store's own idempotency."
    - "pendingReconciliations backed by a reactive Map keyed by slotId (not an array) -- re-setting the same key on a repeated watcher tick is a no-op-shaped overwrite, dedup by construction rather than by an explicit has()-before-push guard."
    - "effectScope() test-isolation fix: composable tests that call useSlideshowAssembly() directly (no host Vue component) never trigger onUnmounted, so its internal watch()es kept running across tests once a write's call count became observable. Wrapping each test call in its own effectScope and calling .stop() in afterEach disposes those watchers via Vue's scope-based teardown, independent of onUnmounted."

key-files:
  created: []
  modified:
    - src/composables/useSlideshowAssembly.ts
    - src/composables/__tests__/useSlideshowAssembly.test.ts
    - src/views/ServiceEditorView.vue

key-decisions:
  - "Materialization and reconciliation are each driven by a synchronous computed (materializationCandidates / reconciliationOutcomes) whose VALUE a watch() reacts to, rather than a single async watchEffect -- see tech-stack pattern above for why."
  - "A slot whose buildInitialGroup resolves to zero slides (a SONG slot with no song assigned yet) is never a materialization candidate -- D-02's 'groups are always populated' is satisfied by not creating a document at all, exactly as the plan's planner_note specified. The slot's deprecated Phase-22 audioUrl/videoUrl stay on the slot in that window and are picked up automatically once buildInitialGroup runs again after the source resolves."
  - "reconcileGroup's changed&&!needsConfirm branch re-derives freshSignature via sourceSignature(slot, inputs) INSIDE the same synchronous computed that decided to reconcile (not re-derived in the async apply step), so the value passed to replaceGroupSlides is captured atomically with the decision that produced it."
  - "Took the plan's explicit EXTEND path (not a second useSlideGroupAssembly.test.ts) -- all new coverage lives in src/composables/__tests__/useSlideshowAssembly.test.ts, per the planner_note reasoning that useSlideshowAssembly is ServiceEditorView's sole subscription/materialization owner."

requirements-completed: [R028, R030, R018]

coverage:
  - id: D1
    description: "slideGroups subscription rides the existing org watcher (subscribedOrgId guard covers it for free); groupsBySlotId re-exposed as its own live ComputedRef"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts (slideGroups subscription (Task 1) describe block: 3 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lazy materialization: one materializeGroupIfMissing call per slot with a resolving source, keyed strictly on slot.id, carrying the D-05 bed-media migration; a SONG slot with no song produces no call until the song resolves; a slot with an existing group produces no call; canWrite gates every write"
    requirement: "R030"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts (lazy materialization (Task 2) describe block: 8 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reordering a service's slots (rewriting every position, same slot ids) triggers ZERO writes to slideGroups -- the RESEARCH.md Pitfall 2 regression test"
    requirement: "R028"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts (reordering slots after materialization settles issues zero further materialization calls)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reconciliation: an additive song merge and a silent uncustomized-diverged replace both apply via exactly one replaceGroupSlides call; a customized-diverged group writes NOTHING and populates pendingReconciliations instead, deduplicated across a repeated watcher tick; canWrite false issues zero reconciliation writes"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts (reconciliation (Task 3) describe block: 6 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every write (materialize and reconcile) is gated on canWrite, which defaults to false and is supplied from authStore.isEditor at the single ServiceEditorView.vue call site (T-24-05-01, viewer-on-guardless-route mitigation)"
    requirement: "R018"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts (canWrite defaulting to false / explicitly false / canWrite false issues zero reconciliation writes tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-07-25
status: complete
---

# Phase 24 Plan 05: Wire the Reactive Layer -- Subscription, Lazy Materialization, Reconciliation Summary

**Extended `useSlideshowAssembly` to subscribe `slideGroups` on the page's existing single org watcher, lazily materialize a group for every plan slot lacking one (carrying its Phase 22 media onto the bed), and trigger reconciliation when a source changes shape -- all gated on a new `canWrite` option that defaults to `false`, and all proven to write nothing on a reorder.**

## Performance

- **Duration:** 14 min (commit-to-commit; first commit 2026-07-25T23:04:29-04:00, final task commit 2026-07-25T23:17:56-04:00)
- **Started:** 2026-07-25T23:04:29-04:00
- **Completed:** 2026-07-25T23:17:56-04:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `useSlideshowAssembly` now calls `slideGroupsStore.subscribeGroups(id)` inside the SAME `stopOrgWatch` handler that already subscribes `scriptureSlides`/`importedSlides` -- the existing `subscribedOrgId` double-subscribe guard covers it for free, keeping exactly one subscription owner for the whole `ServiceEditorView` page (the 21-06 precedent this plan's coordination note called out).
- New `UseSlideshowAssemblyOptions.canWrite` (`Ref<boolean> | ComputedRef<boolean> | boolean`, defaults `false`) gates every write in Tasks 2 and 3. `ServiceEditorView.vue`'s single call site (line ~1387) now passes `{ canWrite: computed(() => authStore.isEditor) }`, so the guard-less `/services/:id` route can never let a viewer attempt a write Firestore's `isOrgEditor(orgId)` rule would deny anyway.
- `groupsBySlotId` re-exposed from the composable as its own `ComputedRef` (wrapping the store's unwrapped getter, not a one-time snapshot of it) so `ServiceEditorView` can compute the R029 delete warning in 24-06 without a second subscription.
- Lazy materialization: a `materializationCandidates` computed synchronously decides, per slot, whether it lacks a group AND its `buildInitialGroup` resolves to at least one slide; a `watch()` on that computed's value performs the actual `materializeGroupIfMissing` calls, guarded by a local `Set<string>` against re-entrancy. A SONG slot with no song assigned (or unresolved lyrics) produces zero slides and is skipped entirely -- no document, not an empty one -- and materializes the moment its source resolves, carrying the slot's deprecated `audioUrl`/`videoUrl` onto the bed at that point. The slot's own legacy media fields are never cleared or rewritten.
- Reconciliation: a `reconciliationOutcomes` computed dispatches `reconcileGroup` for every slot that HAS a group; `changed && !needsConfirm` results apply via `replaceGroupSlides(orgId, slotId, slides, freshSignature)` (an identity-based guard prevents re-issuing against the same unchanged stored group on a later recompute); `needsConfirm` results write nothing and populate a new `pendingReconciliations` return value (a reactive `Map` keyed by `slotId`, exposed as a `ComputedRef` array) for the Phase 26 confirm dialog to render against later.
- Reordering a service's slots (rewriting every `position`, same slot ids) is proven, by an explicit reset-mocks-then-reorder-then-assert-zero-calls test, to issue ZERO further materialization calls -- both new watchers key exclusively on `slot.id` via `groupsBySlotId.has(slot.id)`/`.get(slot.id)`, never array index or `slot.position`.

## Task Commits

Each task followed RED (failing test) -> GREEN (implementation) TDD gates:

1. **Task 1: Subscribe slideGroups on the existing org watcher, gated for write capability**
   - `abc4a62` (test) -- RED: 3 failing tests (subscribeGroups not called, groupsBySlotId not returned)
   - `2ae7025` (feat) -- GREEN: subscription wiring, canWrite computed, groupsBySlotId return, ServiceEditorView call site
2. **Task 2: Lazy materialization and the D-05 media migration, with zero writes on reorder**
   - `da84fe7` (test) -- RED: 8 new failing tests, plus an `effectScope` test-isolation fix (see Deviations)
   - `bf156d7` (feat) -- GREEN: materializationCandidates computed + materializeCandidates watch
3. **Task 3: Trigger reconciliation, apply the additive result, surface the confirm-required ones**
   - `799fe76` (test) -- RED: 5 new failing tests (verified against a git-apply-reverted composable to guarantee a genuine RED, then reapplied)
   - `7454969` (feat) -- GREEN: reconciliationOutcomes computed + applyReconciliationOutcomes watch, pendingReconciliations return

**Plan metadata:** (this commit, following this summary)

## Files Created/Modified

- `src/composables/useSlideshowAssembly.ts` - extended in place: `canWrite` option, `groupsBySlotId`/`pendingReconciliations` returns, `materializationCandidates`/`reconciliationOutcomes` computeds and their driving `watch()`es, `PendingReconciliation` type
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - extended: `@/stores/slideGroups` mock upgraded from a static stub to a stateful one (mockSubscribeGroups/mockMaterializeGroupIfMissing/mockReplaceGroupSlides tracked separately, `slideGroupsState.groups` mutable), 16 new tests across 3 describe blocks, plus an `effectScope`-based test-isolation fix (see Deviations)
- `src/views/ServiceEditorView.vue` - single call site updated to pass `canWrite: computed(() => authStore.isEditor)` and destructure `groupsBySlotId` (unused until 24-06, per plan instruction to change nothing else in this file)

## Decisions Made

- Both new watchers (materialization, reconciliation) split the "what needs a write" DECISION into a plain synchronous `computed()` and the "do the write" EFFECT into a `watch()` callback, rather than a single `watchEffect` with an async body. An async function's reactive-dependency tracking stops the instant it hits its first `await` -- any reads made after resuming (e.g. a second slot's fields, read after the first slot's `await materializeGroupIfMissing(...)` yields) happen outside Vue's tracking window and would silently fail to re-trigger the effect later. Keeping the decision phase fully synchronous sidesteps this Vue pitfall entirely, mirroring the pre-existing `distinctSongIds` -> `loadMissingLyrics` shape the plan asked this to imitate.
- `reconcileGroup`'s applied branch recomputes `freshSignature` via `sourceSignature(slot, inputs)` inside the SAME synchronous computed that decided to apply, rather than re-deriving it in the async apply step -- keeps the signature passed to `replaceGroupSlides` atomically consistent with the inputs that produced the reconciled slides.
- Removed a stale doc comment on `useSlideGroups()`'s call site claiming `subscribeGroups` wiring was "deferred to 24-05" -- this plan IS 24-05, so it's now wired; the comment was accurate under 24-04 but would have been misleading left in place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test-isolation leak: composable tests never trigger `onUnmounted`, so watchers from earlier tests kept running and polluted later tests' mock call counts**
- **Found during:** Task 2 (the moment materialization's write count became something tests actually assert on)
- **Issue:** Every test in `useSlideshowAssembly.test.ts` calls `useSlideshowAssembly()` directly, not through a mounted Vue component. `onUnmounted(cleanup)` inside the composable therefore never registers ("Vue warn: onUnmounted is called when there is no active component instance"), so the composable's internal `watch()`es from a PRIOR test kept running for the rest of the file. Once a `beforeEach` in a LATER test reset the shared `slideGroupsState.groups` mock array, the PRIOR test's still-alive `materializationCandidates` watcher (which depends on that same shared mock state) refired and issued another (mocked) `materializeGroupIfMissing` call, polluting the CURRENT test's call count. This was latent since 20-03 (scripture/imported subscriptions never had an observable re-trigger effect) but became load-bearing the moment a write's exact call count needed asserting.
- **Fix:** Wrapped every `useSlideshowAssembly()` call in the test file inside its own `effectScope()` (imported the real composable under `useSlideshowAssemblyImpl`, shadowed the name locally so every existing call site needed zero changes) and added an `afterEach` that calls `.stop()` on every scope created during the test that just ran. `effectScope.stop()` disposes every `watch`/`computed` created while that scope was active -- a mechanism entirely independent of `onUnmounted` -- so this fixes the leak without needing to convert any existing test to a full component `mount()`.
- **Files modified:** `src/composables/__tests__/useSlideshowAssembly.test.ts`
- **Commit:** `da84fe7` (Task 2 test commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 -- blocking test-infrastructure bug that would otherwise have made Task 2/3's own new tests flaky or wrong)
**Impact on plan:** Necessary to get truthful pass/fail signal from the new materialization/reconciliation call-count assertions; zero production-code impact (the fix lives entirely in the test file's harness).

## Issues Encountered

None beyond the deviation above. `npx vitest run src/composables/__tests__/useSlideshowAssembly.test.ts` passes 23/23 at every task boundary. `npm run type-check` (vue-tsc --build) exits 0 after every task. A full `npx vitest run src/` sweep reports 3124 passed / 44 failed (18 skipped) across 157 files; every real-source failure is one of the two pre-existing, pre-documented categories in STATE.md (`src/storage.rules.test.ts` -- 8 tests, needs the Storage emulator which is deliberately not started; `src/views/__tests__/RosterView.test.ts` -- 1 test, stale pre-existing string assertion unrelated to this phase) plus the unstable `.gsd/quarantine/worktrees/**` debris (documented as flaky run-to-run in STATE.md). Zero new failures in any real source file.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `groupsBySlotId` and `pendingReconciliations` are both ready for 24-06: the delete-slot handler can read `groupsBySlotId` to compute the R029 "this will delete N customized slides" warning without a second store subscription, and the Phase 26 confirm dialog (out of this milestone's scope but noted for completeness) will render directly against `pendingReconciliations`.
- Exactly one subscription owner and exactly one materialization/reconciliation writer exist for the whole `ServiceEditorView` page, consistent with the 21-06 precedent STATE.md documents.
- No blockers. `npm run type-check` is green; the extended test suite is green; `firestore.rules` untouched (this plan made no rules changes, matching the phase's hard constraint).

---
*Phase: 24-slide-group-model-and-migration*
*Completed: 2026-07-25*

## Self-Check: PASSED

All claimed files found on disk (`src/composables/useSlideshowAssembly.ts`, `src/composables/__tests__/useSlideshowAssembly.test.ts`, `src/views/ServiceEditorView.vue`, this SUMMARY). All claimed commits found in git log (`abc4a62`, `2ae7025`, `da84fe7`, `bf156d7`, `799fe76`, `7454969`, `23debbf`).
