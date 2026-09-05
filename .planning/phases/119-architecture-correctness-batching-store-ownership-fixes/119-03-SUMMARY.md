---
phase: 119-architecture-correctness-batching-store-ownership-fixes
plan: 03
subsystem: state-management
tags: [pinia, vue, firestore, onSnapshot, org-switch, lifecycle]

requires:
  - phase: 119-architecture-correctness-batching-store-ownership-fixes plan 02
    provides: R356's store-owned onSnapshot lifecycle pattern (subscribe(orgId)/unsubscribeAll(), as the template these fixes bring ServicesView/the two editors to parity with)
provides:
  - ServicesView's org-switch watcher tears down teamsStore locally (parity with RosterView/DashboardView/TeamView)
  - SongLyricEditor and ScriptureSlideEditor reactively re-subscribe/teardown on props.orgId (and, for SongLyricEditor, props.songId) change while mounted
affects: [phase-120-god-module-decomposition, any future church-switch-while-mounted surface]

tech-stack:
  added: []
  patterns:
    - "Reactive org-prop re-subscribe: watch(() => props.orgId, () => { store.unsubscribeX(); store.subscribeX(props.orgId) }, { immediate: true }) replaces a one-shot onMounted subscribe, so a component that stays mounted across an org switch cannot show stale data (mirrors the church-switch re-subscribe idiom, ADR-0066)."

key-files:
  created: []
  modified:
    - src/views/ServicesView.vue
    - src/views/__tests__/ServicesView.test.ts
    - src/components/SongLyricEditor.vue
    - src/components/__tests__/SongLyricEditor.test.ts
    - src/components/ScriptureSlideEditor.vue
    - src/components/__tests__/ScriptureSlideEditor.test.ts

key-decisions:
  - "ScriptureSlideEditor's subscribeReadings became unconditional (previously gated on props.readingId) so it can be driven by a single watch(() => props.orgId, ..., {immediate:true}); onUnmounted's unsubscribeReadings() was made unconditional to match, so the now-always-active subscription cannot leak on unmount. The readingId-gated one-time getReading fetch stayed in onMounted, unchanged."
  - "SongLyricEditor's stopTeamsSeedWatch-equivalent hoist is not needed here (no seed watch); instead the fix is a straight watch([orgId, songId], ..., {immediate:true}) replacing onMounted, keeping the existing onUnmounted teardown as-is."

patterns-established:
  - "A component whose org-scoped subscription only starts in onMounted is a defense-in-depth gap even when the global resetOrgScopedStores() already tears it down — bring it to parity with the reactive re-subscribe idiom the moment it is touched."

requirements-completed: [R353, R354]

coverage:
  - id: D1
    description: "ServicesView's org-switch watcher calls teamsStore.unsubscribeAll() (and stops any retained teams seed watch) for parity with RosterView/DashboardView/TeamView"
    requirement: R353
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServicesView.test.ts#teamsStore teardown on org switch (R353/ARCH-002) — tears down teamsStore locally on org switch, matching RosterView/DashboardView/TeamView"
        status: pass
    human_judgment: false
  - id: D2
    description: "SongLyricEditor re-subscribes/tears down when props.orgId (or props.songId) changes while mounted, instead of subscribing once at mount"
    requirement: R354
    verification:
      - kind: unit
        ref: "src/components/__tests__/SongLyricEditor.test.ts#re-subscribes when props.orgId changes while mounted (R354/ARCH-003)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ScriptureSlideEditor re-subscribes/tears down when props.orgId changes while mounted, instead of subscribing once at mount"
    requirement: R354
    verification:
      - kind: unit
        ref: "src/components/__tests__/ScriptureSlideEditor.test.ts#re-subscribes when props.orgId changes while mounted (R354/ARCH-003)"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-05
status: complete
---

# Phase 119 Plan 03: Org-Switch Lifecycle Defense-in-Depth (R353/R354) Summary

**ServicesView now tears down teamsStore locally on org switch; SongLyricEditor and ScriptureSlideEditor reactively re-subscribe/teardown on an org-prop change instead of subscribing once at mount — closing the two lifecycle defense-in-depth gaps ARCH-002/ARCH-003 flagged.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 6 (0 created, 6 modified)

## Accomplishments
- `ServicesView.vue`'s org-switch watcher now calls `teamsStore.unsubscribeAll()` alongside `serviceStore.unsubscribeAll()`, and hoists `stopTeamsSeedWatch` to component scope so a retained teams seed watch is stopped+nulled on both org switch and unmount — matching the established RosterView/DashboardView/TeamView idiom (R353/ARCH-002). Purely additive local defense-in-depth; `resetOrgScopedStores()` still runs globally.
- `SongLyricEditor.vue` replaced its one-shot `onMounted(() => songLyricsStore.subscribeLyrics(...))` with `watch([() => props.orgId, () => props.songId], ..., { immediate: true })`, so an org (or song) change while the component stays mounted tears down and re-subscribes (R354/ARCH-003).
- `ScriptureSlideEditor.vue` applied the same idiom to `subscribeReadings`: `watch(() => props.orgId, ..., { immediate: true })` now drives the subscription unconditionally (previously gated on `props.readingId`); the `readingId`-gated one-time `getReading` fetch stayed in `onMounted`, unchanged. `onUnmounted`'s `unsubscribeReadings()` was made unconditional to match the now-always-active subscription.
- One regression test added per surface, proving teardown fires on the relevant prop/org change.

## Task Commits

Each task was committed atomically:

1. **Task 1: ServicesView org-switch watcher tears down teamsStore locally (R353)** - `e1f55846` (fix)
2. **Task 2: Reactive re-subscribe on org-prop change in both editors (R354)** - `ad9b8afe` (fix)

## Files Created/Modified
- `src/views/ServicesView.vue` - hoisted `stopTeamsSeedWatch` to component scope; org-switch watcher and `onUnmounted` now both call `teamsStore.unsubscribeAll()` and stop+null the retained seed watch
- `src/views/__tests__/ServicesView.test.ts` - added `mockTeamsUnsubscribeAll` to the teams store mock; new describe block asserting it fires on org switch
- `src/components/SongLyricEditor.vue` - replaced `onMounted` subscribe with a `watch([orgId, songId], ..., {immediate:true})` teardown/re-subscribe; dropped the now-unused `onMounted` import
- `src/components/__tests__/SongLyricEditor.test.ts` - new test asserting `unsubscribeLyrics` fires and `subscribeLyrics` is called with the new orgId on a `setProps` org change
- `src/components/ScriptureSlideEditor.vue` - `subscribeReadings` now driven by `watch(() => props.orgId, ..., {immediate:true})`, unconditional; `onMounted` keeps only the `readingId`-gated one-time `getReading` fetch; `onUnmounted`'s `unsubscribeReadings()` made unconditional
- `src/components/__tests__/ScriptureSlideEditor.test.ts` - new test asserting `unsubscribeReadings` fires and `subscribeReadings` is called with the new orgId on a `setProps` org change

## Decisions Made
- ScriptureSlideEditor's subscription gate moved from "only if editing an existing reading" to "always, driven by orgId" — required to express it as a single reactive watch per the plan's explicit idiom. Verified behavior-preserving: the component is not currently mounted from any production call site (only its own test file references it), so there is no live call site whose behavior this could regress; the change also makes the component's subscription lifecycle simpler and more consistent with its siblings.
- Kept `onUnmounted`'s teardown unconditional in both editors to match their now-unconditional (or already-unconditional) subscriptions, avoiding a leaked listener on unmount — a correctness follow-through of the main fix (Rule 1/2 territory, not a separate deviation worth its own log entry since it's the direct, necessary counterpart of the task's own instructed change).

## Deviations from Plan
None - plan executed exactly as written (including the ScriptureSlideEditor `onUnmounted` unconditional-teardown follow-through, which the plan's own text implies via "only the subscription becomes reactive" but a reactive-and-unconditional subscription requires unconditional teardown to stay balanced).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R353/R354 close two of the nine ARCH findings scoped to Phase 119; R349-R352/R357 (batching, correctness) are covered by sibling plans in this phase.
- No blockers for Phase 120 (god-module decomposition) — all three touched files (ServicesView.vue, SongLyricEditor.vue, ScriptureSlideEditor.vue) got small, additive lifecycle changes only.

---
*Phase: 119-architecture-correctness-batching-store-ownership-fixes*
*Completed: 2026-09-05*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; both task commit hashes (e1f55846, ad9b8afe) confirmed in `git log`.
