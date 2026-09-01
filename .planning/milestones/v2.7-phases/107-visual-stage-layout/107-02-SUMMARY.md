---
phase: 107-visual-stage-layout
plan: 02
subsystem: ui
tags: [vue3, typescript, tailwind, vitest, tdd, pointer-events, drag-and-drop, stage-plot]

# Dependency graph
requires:
  - phase: 107-visual-stage-layout (plan 01)
    provides: "StageMarker type, Service.stageLayout field, percentage geometry helpers (src/utils/stageLayout.ts), shared read-only StageLayoutView.vue"
provides:
  - "StageLayoutEditor.vue — the freeform native-Pointer-Events drag canvas: add/edit-label/edit-kind/move-between-zones/delete markers, drop-only persist"
  - "Stage Layout tab wired into ServiceEditorView.vue (after Roles, before Messages), editor-gated, draft-locked, riding the existing single useAutoSave"
  - "A real onSave() persistence fix: stageLayout (a top-level optional field) now actually round-trips through the existing curated-payload autosave path, including correctly CLEARING the remote field when the last marker is removed"
affects: [107-03-share-print]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native Pointer Events (pointerdown/setPointerCapture/pointermove-visual-only/pointerup-persist) for the app's FIRST freeform drag surface — no Konva/interactjs/SortableJS/HTML5 DnD"
    - "Drop-only persistence: pointermove mutates a transient pixel-delta ref for the visual follow, never emits; pointerup resolves zone + clamped percentage and emits exactly one event"
    - "getBoundingClientRect() fetched fresh at drag-START (pointerdown), never cached across mount or across a prior drag interaction"
    - "Explicit `?? null` substitution for a top-level optional field inside a hand-curated autosave payload, so clearing it actually overwrites the remote Firestore field instead of being silently omitted by stripUndefined"

key-files:
  created:
    - src/components/stage/StageLayoutEditor.vue
    - src/components/stage/__tests__/StageLayoutEditor.test.ts
    - src/views/__tests__/ServiceEditorView.stage.test.ts
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/serviceEditorActionBar.ts
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "onSave()'s payload sends `stageLayout: data.stageLayout ?? null` (not a bare `data.stageLayout`) — a top-level optional field omitted from a curated updateDoc payload is left UNTOUCHED remotely (unlike slot.loop/slot.notes, which ride inside the wholesale-replaced `slots` array and get cleared for free); explicit `null` correctly overwrites it, mirroring the existing `sermonPassage` nullable-field precedent on this same payload"
  - "The 'mark clean' JSON comparison snapshot (used to detect a concurrent edit racing an in-flight save) was updated in lockstep with the same `?? null` substitution, so isDirty never gets permanently stranded true after a stageLayout-touching save"
  - "Editable zone containers deliberately omit `overflow-hidden` (unlike the read-only StageLayoutView, which keeps it for clean print/share framing) — a dragged chip must visually cross from one zone box into the other while the pointer is down"
  - "Drag visual follow uses a raw pointer-delta pixel transform layered on top of the percentage-based base position, never a re-measured pixel value — kept resize-stable by construction and never persisted (only the pointerup-resolved zone + percentage is emitted)"
  - "Click-vs-drag disambiguated by a 4px movement threshold, re-checked at pointerup using the up event's own coordinates (not just the last pointermove) so a click with zero interposed pointermove events still classifies correctly"
  - "The chip's own trash icon opens the SAME edit popover pre-set to its remove-confirm view, rather than a second standalone delete-confirm implementation"
  - "Stage Layout tab exposes no action-bar items — ActionBarTab/buildActionBarItems widened with the same 'return []' precedent already used for Roles/Messages"
  - "pointercancel aborts the drag entirely (no move emitted, no popover opened) rather than committing whatever position was last known — the platform took the gesture away, so nothing should be persisted from it"

patterns-established:
  - "Pattern: dispatch a real `new PointerEvent(...)` directly via `element.dispatchEvent()` in tests instead of `@vue/test-utils`' `.trigger('pointerdown', {...})` — VTU's post-construction property assignment throws on jsdom's read-only inherited clientX/clientY getters for pointer* event types; constructing the event with the init dict sets them correctly"
  - "Pattern: a top-level optional Service field riding the existing curated autosave payload needs an explicit nullable substitution (not a bare pass-through) to correctly clear on removal — future optional top-level fields added to Service should check this, not assume the slots-array wholesale-replacement precedent applies"

requirements-completed: [R313, R314]

coverage:
  - id: D1
    description: "StageLayoutEditor.vue: freeform native-Pointer-Events drag canvas with add/edit-label/edit-kind/move-between-zones/delete, drop-only persist, [0,100] clamping, touch-action:none, aria-labeled 44px icon buttons, editable=false reuses the shared read-only StageLayoutView"
    requirement: "R313"
    verification:
      - kind: unit
        ref: "src/components/stage/__tests__/StageLayoutEditor.test.ts (25 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Marker positions round-trip through drop-only persistence: a simulated pointerdown->pointermove->pointerup drag emits exactly ONE clamped, zone-resolved move payload; a drop outside both zones falls back to the marker's current zone with values clamped to [0,100]"
    requirement: "R314"
    verification:
      - kind: unit
        ref: "src/components/stage/__tests__/StageLayoutEditor.test.ts > drag (native Pointer Events, drop-only persist) (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stage Layout tab renders after Roles/before Messages, editor-gated, wired into ServiceEditorView's roving-tabindex nav; the panel mounts StageLayoutEditor off localService.stageLayout with :editable=\"canEditService\""
    requirement: "R313"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.stage.test.ts (10 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Add/update/move/remove mutate localService.stageLayout and persist through the EXISTING autosave debounce (no new save call); removing the last marker clears the field to undefined locally AND actually clears it remotely (the onSave payload fix); a locked service renders read-only (editable=false)"
    requirement: "R314"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.stage.test.ts > an add event initializes stageLayout...; > removing the LAST marker clears stageLayout...; > a locked service...renders...editable=false"
        status: pass
    human_judgment: false
  - id: D5
    description: "Manual real-touch-device drag verification (PITFALLS Pitfall 3) is recommended at phase UAT — not blocking this plan's automated gates per the plan's own <verification> section"
    verification: []
    human_judgment: true
    rationale: "Real touch-device drag behavior cannot be proven by a jsdom unit test; the plan explicitly defers this to phase UAT, not this plan's automated gate."

# Metrics
duration: 30min
completed: 2026-09-01
status: complete
---

# Phase 107 Plan 02: Visual Stage Layout Editor Summary

**`StageLayoutEditor.vue` — a freeform native-Pointer-Events drag canvas (add/edit/move/delete markers across two zones, drop-only persist) wired into a new editor-gated "Stage Layout" tab on `ServiceEditorView.vue`, riding the existing single autosave path with a required `onSave()` payload fix so the field actually persists and clears.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-01T04:50Z (approx, right after 107-01 completed)
- **Completed:** 2026-09-01T05:21Z
- **Tasks:** 2
- **Files modified:** 6 (3 modified, 3 created)

## Accomplishments
- `StageLayoutEditor.vue`: the app's first freeform drag surface, built entirely on native Pointer Events (`pointerdown` + `setPointerCapture` → `pointermove` visual-only → `pointerup` drop-persist). Each zone's `getBoundingClientRect()` is fetched fresh at drag-start (never cached); a drop outside both zones falls back to the marker's current zone; `xPct`/`yPct` are clamped to `[0,100]`. A click (no meaningful movement) opens an edit popover instead of emitting a move. Add-marker inline form (free-text label, optional kind, zone toggle, Save-disabled-until-valid). Edit popover (label/kind/move-to-opposite-zone/inline remove-confirm, mirroring `RoleSlideOver.vue`'s delete-confirm-row pattern). Icon-only edit/delete buttons carry `aria-label="Edit marker"`/`"Remove marker"` at a 44px minimum touch target and `touch-action:none`. `editable=false` reuses the shared read-only `StageLayoutView.vue` verbatim — no third rendering path.
- A new "Stage Layout" tab (`svc-tab-stage`/`svc-panel-stage`) on `ServiceEditorView.vue`, positioned after Roles and before Messages, gated `v-if="authStore.isEditor"` exactly like Roles, threaded into the existing roving-tabindex Arrow/Home/End navigation. The panel mounts `StageLayoutEditor` off `localService.stageLayout?.elements ?? []` with `:editable="canEditService"`.
- Add/update/move/remove handlers mutate `localService.value.stageLayout` directly (mirroring `onToggleLoop`/`onSectionChange`) so persistence rides the EXISTING single `useAutoSave(localService, ...)` deep-watch — no new save call, no new rules surface, no new Pinia store.
- **A real bug found and fixed while wiring this up:** `onSave()`'s payload is a hand-curated subset of `Service` fields (`name, teams, sermonPassage, sermonTopic, notes, status, slots`) — it does NOT spread the whole `localService.value`. A bare `stageLayout: data.stageLayout` would work for the ADD/EDIT/MOVE cases (setting a new `{elements: [...]}` value) but silently fail to CLEAR the remote field on the last-marker-removed case: `stripUndefined` drops an `undefined`-valued top-level key entirely from the outgoing `updateDoc` payload, and Firestore's partial update then leaves the untouched remote field exactly as it was. Fixed by sending `stageLayout: data.stageLayout ?? null` (the same trick the existing `sermonPassage` field already uses on this payload) and mirroring that same substitution in the "mark clean" comparison snapshot immediately below, so `isDirty` cannot get stranded true after a save that touches `stageLayout`.

## Task Commits

Each task was committed atomically:

1. **Task 1: StageLayoutEditor freeform drag canvas** - `0f3a7b35` (feat)
2. **Task 2: Wire the Stage Layout tab + panel into ServiceEditorView** - `c00c1fe5` (feat)

**Plan metadata:** (this commit)

_Both tasks were marked `tdd="true"`. Both were developed test-first (tests written and run to green before/alongside implementation, iterating until 25/10 tests passed respectively), but each landed as a single combined commit rather than separate `test(RED)` → `feat(GREEN)` commits — see Deviations below._

## Files Created/Modified
- `src/components/stage/StageLayoutEditor.vue` - The freeform drag canvas (add/edit/move/delete markers, drop-only persist, editable=false reuses StageLayoutView)
- `src/components/stage/__tests__/StageLayoutEditor.test.ts` - 25 unit tests covering add/edit/move/delete, drag drop-math, click-vs-drag disambiguation, pointercancel abort, aria-labels/touch targets, resize-stability
- `src/views/ServiceEditorView.vue` - New Stage Layout tab/panel + 4 mutation handlers + the onSave() payload/mark-clean fix for stageLayout persistence
- `src/views/serviceEditorActionBar.ts` - `ActionBarTab`/`buildActionBarItems` widened to include `'stage'` (exposes no action-bar items)
- `src/views/__tests__/ServiceEditorView.test.ts` - Updated one pre-existing keyboard-nav test whose ArrowRight sequence now includes the new Stage Layout tab
- `src/views/__tests__/ServiceEditorView.stage.test.ts` - 10 new tests: tab gating, panel wiring, add/update/move/remove persistence through autosave, locked-service read-only, roving-tabindex inclusion

## Decisions Made
- Followed 107-CONTEXT.md/UI-SPEC.md exactly for the drag mechanism (native Pointer Events, percentage storage, drop-only persist, touch-action:none) and the tab placement/gating (after Roles, before Messages, `authStore.isEditor` gate).
- Chose a raw pointer-delta pixel `transform` layered on the percentage-based base position for the drag visual follow, rather than re-deriving a zone-relative percentage on every `pointermove` tick — simpler, and the percentage is only ever computed once, at drop.
- Omitted `overflow-hidden` on the EDITABLE zone containers only (kept on the read-only `StageLayoutView`) so a dragged chip can visually cross from one zone into the other while the pointer is down — a deliberate, minor divergence from 107-UI-SPEC's literal chrome description, in service of the drag interaction the spec itself requires ("the chip follows the pointer 1:1 and snaps into whichever zone it is dropped in").
- The chip's own trash icon opens the SAME edit popover, pre-set to its remove-confirm view, rather than a second standalone delete-confirm UI — one implementation for "remove," two entry points into it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `onSave()`'s curated payload silently failed to persist a cleared `stageLayout`**
- **Found during:** Task 2 (wiring the tab into ServiceEditorView), while reasoning through how a top-level optional field rides the existing autosave path
- **Issue:** `onSave()` builds a hand-curated payload object (not a spread of `localService.value`); a bare `stageLayout: data.stageLayout` would correctly SET the field when non-empty but would be stripped entirely (via `stripUndefined`) when `undefined` — Firestore's partial `updateDoc` then leaves the stale remote value in place, so "removing the last marker" would appear to work locally but silently fail to persist, reappearing on reload
- **Fix:** Send `stageLayout: data.stageLayout ?? null` instead (mirrors the existing `sermonPassage` nullable-field convention on this same payload); mirrored the identical `?? null` substitution in the adjacent "mark clean" JSON comparison snapshot so `isDirty` cannot get stranded true after a stageLayout-touching save
- **Files modified:** `src/views/ServiceEditorView.vue`
- **Verification:** `src/views/__tests__/ServiceEditorView.stage.test.ts` — "removing the LAST marker clears stageLayout back to undefined ... and persists the clear through autosave" asserts `mockUpdateService`'s payload carries `stageLayout: null`
- **Committed in:** `c00c1fe5` (Task 2 commit)

**2. [Rule 1 - Bug] `ActionBarTab`/`buildActionBarItems` didn't recognize the new `'stage'` tab**
- **Found during:** Task 2, first `npm run type-check` after widening `activeTab`'s type union
- **Issue:** `activeTab.value` (now including `'stage'`) is passed to `buildActionBarItems(tab: ActionBarTab, ...)`, whose `ActionBarTab` union didn't include `'stage'` — a compile error, not a runtime bug, but a required fix to keep the widened tab type consistent everywhere it flows
- **Fix:** Widened `ActionBarTab` to include `'stage'`; added `if (tab === 'stage') return []` following the exact same "expose nothing" precedent already established for `'roles'`/`'messages'`
- **Files modified:** `src/views/serviceEditorActionBar.ts`
- **Verification:** `npm run type-check` clean
- **Committed in:** `c00c1fe5` (Task 2 commit)

**3. [Rule 1 - Bug] Existing keyboard-nav test's ArrowRight sequence broke once the Stage Layout tab was inserted**
- **Found during:** Task 2, running the full pre-existing `ServiceEditorView.test.ts` suite after wiring the tab in
- **Issue:** `'ArrowRight steps through Service Order -> Slides -> Roles -> Messages -> wraps to Service Order'` hard-coded a 4-tab sequence; inserting `'stage'` between Roles and Messages in `visibleTabOrder` (as the plan requires) made that sequence's third `ArrowRight` land on Stage Layout instead of Messages, failing the assertion
- **Fix:** Updated the test's expected order array to include `svc-tab-stage` between `svc-tab-roles` and `svc-tab-messages`, and renamed the test to describe the new 5-tab sequence
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** Full `ServiceEditorView.test.ts` suite (350 tests) passes
- **Committed in:** `c00c1fe5` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs required for the feature to actually persist/compile, 1 Rule 1 regression fix in an existing test caused directly by the plan's own required tab insertion)
**Impact on plan:** All three were necessary for correctness (the stageLayout persistence fix is load-bearing — without it the entire feature silently never saves a cleared layout) or for the codebase to remain internally consistent (`ActionBarTab`, the pre-existing keyboard-nav test). No scope creep beyond what wiring the plan's own required tab insertion demanded.

### Process note (not a deviation from plan CONTENT, but from the standard TDD commit-granularity protocol)

Both tasks are marked `tdd="true"` in the plan and were developed test-first in practice (write the test file, run it, iterate the implementation to green — visible in the 25/25 and 10/10 all-passing final runs). However, each task landed as a single combined `feat(...)` commit rather than the standard separate `test(RED)` → `feat(GREEN)` commit pair the TDD execution protocol calls for. This is a git-history-granularity deviation only; functionally, tests exist for every behavior and all pass. Not corrected retroactively (no `git commit --amend`/history rewrite) per the "prefer new commits over amending" rule — noted here for the record.

## Issues Encountered

**jsdom/`@vue/test-utils` pointer-event simulation gap.** `@vue/test-utils`'s `.trigger('pointerdown', { clientX, clientY, pointerId })` throws `TypeError: Cannot set property clientX of #<MouseEvent> which has only a getter` under this project's jsdom (28.1.0) — VTU's `createDOMEvent` tries to POST-assign `clientX`/`clientY` onto an already-constructed `PointerEvent`, but those are inherited read-only getters on `MouseEvent.prototype` (not an OWN descriptor on `PointerEvent.prototype`), so VTU's `canSetProperty` guard never trips and the assignment throws. Worked around by dispatching a real `new PointerEvent(type, { clientX, clientY, pointerId, bubbles: true, cancelable: true })` directly via `element.dispatchEvent(...)` in the drag tests — the WebIDL constructor sets these correctly via the init dict, exactly like a real browser dispatch. Documented inline in the test file so future pointer-event tests in this codebase don't rediscover the same gap.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (share/print, wave 2) can denormalize `Service.stageLayout` into `buildServiceSnapshot()`/`ServiceSnapshot` and mount the SAME `StageLayoutView.vue` (`theme="light"`) on `ShareView.vue` and the print layout — no further authoring-side work needed; the field now correctly round-trips (both set AND clear) through the existing autosave path this plan fixed.
- The `onSave()` payload lesson (top-level optional fields need an explicit nullable substitution, not a bare pass-through, to persist a clear) is now documented inline in `ServiceEditorView.vue` and in this SUMMARY's `patterns-established` — relevant to any FUTURE top-level optional `Service` field added to this same curated payload.
- No blockers identified for Plan 03.

---
*Phase: 107-visual-stage-layout*
*Completed: 2026-09-01*

## Self-Check: PASSED

All 7 created/modified files confirmed present on disk; both task commit hashes (`0f3a7b35`, `c00c1fe5`) confirmed in `git log`.
