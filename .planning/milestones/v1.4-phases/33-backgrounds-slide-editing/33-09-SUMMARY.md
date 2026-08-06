---
phase: 33-backgrounds-slide-editing
plan: 09
subsystem: ui
tags: [vue3, vue-router, slide-editing, slide-action-menu, select-edit-decoupling]

# Dependency graph
requires:
  - phase: 33-backgrounds-slide-editing
    provides: "33-02's slideActionMenuItems/MenuItem/MenuItemKey (slideDisplay.ts); 33-05's SlideCard.vue menu props/emits; 33-07's EditSlideDrawer.vue mode prop and pendingAction/pending-action-consumed seam; 33-08's SlideGrid.vue openMenuEntryId ownership and menu-action emit"
provides:
  - "SlidesTab.vue onSelectSlide reduced to selection only — R051's select-to-edit coupling is broken; selection itself (plan rail accent, drawer entry resolution, dangling-selection cleanup) is unaffected"
  - "SlidesTab.vue onMenuAction(slideId, key) — the single dispatcher for all six MenuItemKey values: edit-details/edit-lyrics open the drawer in the matching mode, edit-in-song/edit-in-scripture navigate without opening the drawer, duplicate/delete open the drawer in details mode and set a pendingAction (never call a store action directly)"
  - "EditSlideDrawer.vue with its three in-body 'Edit in song'/'Edit in scripture' link buttons, their handlers, and the edit-in-scripture emit removed — those actions are menu-only now"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onMenuAction always selects the acted-on entry first (selectedSlideId.value = slideId), THEN dispatches on the key — the drawer's entry resolution and the song-navigation lookup both depend on the selection already being current, even for a card that was not previously selected"
    - "duplicate/delete keys open the drawer (details mode) and set a pendingAction rather than writing directly — the drawer's own 33-07 pendingAction watcher is the one and only place a menu-dispatched delete/duplicate actually mutates, preserving the existing inline delete confirm (P-01)"

key-files:
  created: []
  modified:
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts
    - src/components/slides/EditSlideDrawer.vue
    - src/components/slides/__tests__/EditSlideDrawer.test.ts

key-decisions:
  - "Followed 33-09-PLAN.md's explicit Task 2 action text over 33-08-SUMMARY.md's 'Next Phase Readiness' handoff note, which said duplicate/delete should 'call the existing store actions directly (no drawer)'. The PLAN (this plan, the authoritative execution artifact) is unambiguous — Task 2's action text, its acceptance criteria, and its P-01 threat mitigation (T-33-22) all state duplicate/delete open the drawer in details mode and set a pendingAction, which the drawer's EXISTING 33-07 seam turns into the inline delete confirm or the duplicate write. Calling a store action directly from SlidesTab.vue would also require importing the slideGroups store into a component whose own file header states it 'reads no store and calls no composable' — a bigger structural change the plan never asked for. The 33-08 handoff note appears to be a stale/imprecise restatement; this plan's own text governs."
  - "The song-navigation route is built from the SELECTED ENTRY's own sourceRef.songId (ref.kind === 'lyric' | 'copyright'), not from ServiceSlot.songId, preserving the EXACT prior behaviour of the removed onEditInSong handler ('unchanged in behaviour' per the plan's own action text) rather than reading the threat model's looser phrase ('the selected plan item's own song id') as a literal property-path instruction."
  - "Region-scoped gate for the deleted drawerOpen.value = true line (R051): rather than a file-wide grep — which would fail against the two OTHER correct sites still setting it true (selectSlideById, and this plan's own new menu dispatcher) — the gate is behavioural: a named SlidesTab.test.ts case emits select from the grid and asserts the drawer's open prop stays false while entry still resolves."
  - "Two SlidesTab.test.ts cases whose premise was 'select reopens the drawer' were rewritten to drive the drawer open via the exposed selectSlideById function instead of a plain select emit, so Task 1 could be verified and committed standalone without depending on Task 2's not-yet-existing menu-action handler."

requirements-completed: [R051, R052]

coverage:
  - id: D1
    description: "Selecting a slide card no longer opens the Edit Slide drawer; selection itself (plan rail accent, drawer entry/assembled-slide resolution, dangling-selection watcher) is fully unaffected. The post-duplicate follow-selection path (selectSlideById) still opens the drawer."
    requirement: "R051"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts — 'Edit Slide drawer wiring (Phase 26-05 Task 2)' describe block, region-scoped select-opens-nothing case plus the unchanged post-duplicate/close/dangling-selection cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "onMenuAction dispatches all six MenuItemKey values from one handler: edit-details/edit-lyrics select the entry and open the drawer in the matching mode (switching modes on the same entry leaves it open); edit-in-song builds the song route from the selected entry's own sourceRef.songId (lyrics tab for lyric-kind, details tab for copyright-kind) without opening the drawer; edit-in-scripture relays through the existing requestEditInScripture without opening the drawer; duplicate/delete select the entry, open the drawer in details mode, and set a pendingAction with an incrementing nonce — never calling a store action directly. A menu action on a not-yet-selected card selects it first."
    requirement: "R052"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts — 'Menu dispatch (Phase 33-09 Task 2 — onMenuAction, the single dispatcher for all six keys)' describe block (12 cases, all matching -t \"menu\")"
        status: pass
    human_judgment: false
  - id: D3
    description: "EditSlideDrawer.vue's three in-body navigation link buttons (lyric/copyright 'Edit in song', scripture 'Edit in scripture'), their onEditInSong/onEditInScripture handlers, cancelPendingWrites, the edit-in-scripture emit, and the buildSongEditLink/SongEditTab/useRouter imports are all removed together — superseded by the menu items. Every read-only text/caption/copyright-block rendering is unaffected; the drawer's own pendingAction seam (33-07) and the tab's navigate-to-scripture-editor relay are unaffected."
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/EditSlideDrawer.test.ts — 'Phase 33-09 Task 3' describe block (5 cases) plus the two inverted R054 song-group cases"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-03
status: complete
---

# Phase 33 Plan 09: Select/edit decoupling + the menu as single dispatcher Summary

**`SlidesTab.vue`'s `onSelectSlide` is reduced to a one-line selection-only handler (R051's entire fix), and a new `onMenuAction` dispatches all six 3-dot menu keys from one place — the two edit keys open `EditSlideDrawer` in the matching mode, the two navigation keys route/relay without opening it, and Duplicate/Delete open the drawer and hand off to its EXISTING 33-07 `pendingAction` seam rather than mutating anything themselves.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-03T05:35:00Z
- **Tasks:** 3/3
- **Files modified:** 4 (0 created)

## Accomplishments

- **Task 1 — decouple select from edit (R051).** Deleted the single `drawerOpen.value = true` line inside `SlidesTab.vue`'s `onSelectSlide` — the entire coupling R051 exists to break. The selection assignment on the line above it, and the two OTHER write sites that legitimately still set `drawerOpen` true (`selectSlideById`, the post-duplicate follow-selection handler; and Task 2's new menu dispatcher), were left untouched. Updated the `drawerOpen` ref's own doc comment and the file-header comment to describe the new "menu keys and post-duplicate only" contract, preserving the still-true D-03 "follows the selection" reasoning verbatim. Inverted `SlidesTab.test.ts`'s grid-`select`-opens-the-drawer assertions to the region-scoped behavioural gate the plan specifies (`select` emits → `open` stays `false`, `entry` still resolves) and rewrote the two cases whose premise ("select reopens the drawer") no longer holds, driving them through the exposed `selectSlideById` instead so Task 1 verified standalone.
- **Task 2 — `onMenuAction`, the single dispatcher (R052).** Added `drawerMode` (`'details' | 'lyrics'`, default `'details'`), a nonce-keyed `pendingDrawerAction` bound to the drawer's 33-07 `pendingAction` prop, and `onMenuAction(slideId, key)` bound to `SlideGrid`'s `menu-action` emit. The handler ALWAYS selects the acted-on entry first (a menu action implies its own card), then dispatches: `edit-details`/`edit-lyrics` set `drawerMode` and open the drawer; `edit-in-song` builds the song route via `buildSongEditLink` off the SELECTED ENTRY's own `sourceRef.songId` (lyrics tab for a lyric-kind entry, details tab for copyright) — unchanged in behaviour from the removed link button, never opening the drawer; `edit-in-scripture` calls the existing `requestEditInScripture()` relay, never opening the drawer; `duplicate`/`delete` open the drawer in details mode and set `pendingDrawerAction` with a fresh incrementing nonce — this component calls no delete/duplicate store action itself (it has no store import at all), relying entirely on the drawer's own existing write paths (P-01). 12 new `SlidesTab.test.ts` cases, all matching `-t "menu"`.
- **Task 3 — remove the drawer's duplicated navigation affordance.** Removed, in one commit, `EditSlideDrawer.vue`'s three in-body link buttons (lyric/copyright `drawer-edit-in-song-link`, scripture `drawer-edit-in-scripture-link`), their `onEditInSong`/`onEditInScripture` handlers, `cancelPendingWrites` (its only two callers), the `edit-in-scripture` emit declaration, and the `buildSongEditLink`/`SongEditTab`/`useRouter` imports and `router` instance — together with `SlidesTab.vue`'s now-nonexistent `@edit-in-scripture` listener binding on the drawer mount (`requestEditInScripture` itself is unchanged, now called directly from `onMenuAction`). Every read-only text/caption/copyright-block rendering these branches sat beside is untouched. Rewrote `EditSlideDrawer.test.ts`'s "routes away, guarded" describe block into a "the removed links" block asserting absence for every kind/permission combination plus continued rendering of the read-only content; inverted the two R054 song-group "still offers the Edit in song link" cases to assert absence; deleted the drawer-emit scripture-relay case in `SlidesTab.test.ts` (superseded by Task 2's menu-key case).

## Task Commits

Each task was committed atomically:

1. **Task 1: Decouple select from edit** — `d8a5141` (fix)
2. **Task 2: onMenuAction — the single dispatcher for all six keys** — `ce05b58` (feat)
3. **Task 3: Remove the drawer's duplicated navigation affordance** — `958201f` (refactor)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/components/slides/SlidesTab.vue` — `onSelectSlide` reduced to selection only; `drawerMode`, `pendingDrawerAction`, `pendingActionNonce`, `onPendingActionConsumed`, `onMenuAction`; `useRouter`/`buildSongEditLink`/`SongEditTab`/`MenuItemKey` imports; template gains `@menu-action="onMenuAction"` on the grid and `:mode`/`:pending-action`/`@pending-action-consumed` on the drawer; the now-defunct `@edit-in-scripture` listener removed
- `src/components/slides/__tests__/SlidesTab.test.ts` — grid-select assertions inverted to the region-scoped gate; two cases rewritten around `selectSlideById`; new `vue-router` mock; new "Menu dispatch" describe block (12 cases); the superseded drawer-emit scripture-relay case deleted
- `src/components/slides/EditSlideDrawer.vue` — three link buttons, `onEditInSong`/`onEditInScripture`/`cancelPendingWrites`, the `edit-in-scripture` emit, and the `buildSongEditLink`/`SongEditTab`/`useRouter` imports/instance all removed; template/header comments updated to describe the relocated navigation
- `src/components/slides/__tests__/EditSlideDrawer.test.ts` — "routes away, guarded" describe block rewritten into an absence/read-only-content block; two R054 song-group cases inverted; the now-unused `vue-router` mock removed

## Decisions Made

- **Followed the PLAN's explicit Task 2 text over 33-08-SUMMARY.md's handoff note.** 33-08's "Next Phase Readiness" section said duplicate/delete should "call the existing store actions directly (no drawer)" — this directly contradicts 33-09-PLAN.md's own Task 2 action text, its acceptance criteria (`pendingAction` prop assertions), and its T-33-22 threat mitigation (P-01: "the dispatcher sets a pending action... No delete action is called from this component at all"). Implemented per the PLAN, which is this executor's authoritative artifact; the handoff note is stale/imprecise on this one point.
- **Song-navigation route built from the selected ENTRY's `sourceRef.songId`**, not `ServiceSlot.songId` — preserves the exact prior behaviour of the removed `onEditInSong` handler, per the plan's explicit "unchanged in behaviour" instruction, rather than reading the threat model's looser "selected plan item's own song id" phrasing as a literal property path (both values are practically identical for a materialized SONG group, but the entry's own field is the behaviourally-identical source).
- **Region-scoped gate, not a file-wide grep**, for the deleted `drawerOpen.value = true` line — per the plan's own explicit instruction, since the same line legitimately recurs at two other write sites in the same file.

## Deviations from Plan

None — plan executed exactly as written. The one apparent conflict (33-08-SUMMARY.md's handoff note vs. this plan's own Task 2 text) was resolved in favor of this plan's literal instructions, as documented above under Decisions Made; it is a discrepancy between artifacts, not a deviation from THIS plan.

## Issues Encountered

None.

## Known Gap (documented, not silently dropped)

**The unsaved-edit confirmation ("Discard unsaved changes?") that previously guarded the two removed link buttons is not ported to the menu path.** Before this plan, clicking "Edit in song"/"Edit in scripture" inside the drawer while a debounced Label/Notes/Body write was still pending prompted a confirm dialog and explicitly cancelled the pending write before navigating (`unsavedGuard.confirmDiscard()` + `cancelPendingWrites()`). The plan's Task 2 action text scopes the relocated logic to route CONSTRUCTION only ("unchanged in behaviour" refers to the song/scripture tab-selection logic, not this guard), and does not instruct porting the confirm-discard step to `SlidesTab.vue`. Since navigating via either menu key still triggers a real route change (for song) or a same-page relay (for scripture) that can unmount the drawer, the existing `onUnmounted` best-effort flush (`void flushAll()`) still fires and the debounced write is very unlikely to be lost in practice — but the explicit "Are you sure?" prompt before leaving with an unsaved, still-debouncing edit is gone. This is a UX regression, not a data-loss regression, and is out of this plan's stated scope; flagged here rather than silently dropped, and added as PENDING-VERIFICATION.md item 33.6's neighbor consideration for whoever next touches this seam.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

This is the LAST plan of Phase 33. No further plans in this phase consume this plan's output.

- `npm run type-check` (`vue-tsc --build`) exits 0.
- `npx vitest run src/components/slides` — 424 tests / 11 files, all passing (up from 33-08's baseline; +14 net new tests: 12 menu-dispatch cases plus 2 net from the routes-away rewrite, minus the deleted scripture-relay case and the collapsed routes-away block).
- **Phase gate — full suite:** `npx vitest run src/` — 2 failed files / 9 failed tests / 2118 passed, exactly the documented non-defect baseline (`src/storage.rules.test.ts` needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` has a stale assertion). Zero regressions from this plan or this phase.
- `npm run build` succeeds (`vite build`, 13.9s, no new warnings beyond the pre-existing `auth.ts` dynamic/static dual-import notice).
- PENDING-VERIFICATION.md gained a `## Phase 33` section (6 items: menu keyboard nav with a real screen reader, menu-vs-drag non-interference, inheritance legibility across all three background levels, the per-type menu item list against owner intent, drag without opening the menu, and song/scripture navigation working with a different slide's drawer open) — none were self-approved.
- No blockers for phase completion.

---
*Phase: 33-backgrounds-slide-editing*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: src/components/slides/SlidesTab.vue
- FOUND: src/components/slides/__tests__/SlidesTab.test.ts
- FOUND: src/components/slides/EditSlideDrawer.vue
- FOUND: src/components/slides/__tests__/EditSlideDrawer.test.ts
- FOUND: .planning/phases/33-backgrounds-slide-editing/33-09-SUMMARY.md
- FOUND: .planning/PENDING-VERIFICATION.md
- FOUND: d8a5141 (git log)
- FOUND: ce05b58 (git log)
- FOUND: 958201f (git log)
