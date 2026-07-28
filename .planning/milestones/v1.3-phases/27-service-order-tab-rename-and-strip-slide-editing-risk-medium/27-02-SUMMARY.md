---
phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
plan: 02
subsystem: ui
tags: [vue, vitest, rename, service-editor, tabs]

# Dependency graph
requires:
  - phase: 25-slides-tab-shell-plan-rail-and-slide-grid
    provides: "The three-tab bar (Music/Roles/Slides) and the activeTab union this plan renames"
  - phase: 26-edit-slide-drawer-risk-medium
    provides: "handleNavigateToScriptureEditor, whose tab assignment this plan renames in place"
provides:
  - "First tab renamed from Music to Service Order — visible label, internal activeTab union value, and default"
  - "data-testid=\"service-order-panel\" stable test seam on the first tab panel for 27-03..27-05 to probe"
affects: [27-03-strip-import-controls, 27-04-strip-imported-slide-editor, 27-05-strip-slideshow-preview]

# Tech tracking
tech-stack:
  added: []
  patterns: ["RED/GREEN task pairing for a rename: test file updated and committed first (expected failing), then the view file renamed to make it pass"]

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Renamed only ServiceEditorView.vue's activeTab union ('music' | 'roles' | 'slides' -> 'service-order' | 'roles' | 'slides') and its five in-file call sites; QuarterView.vue, RosterView.vue, ServicesView.vue and SongSlideOver.vue each declare their own unrelated activeTab ref and were deliberately left untouched (verified via a zero-diff gate)."
  - "Renamed the test-file variable musicBtn to serviceOrderBtn (not required by the plan's interfaces list, but left as stale vocabulary would have contradicted D-03's 'no stale vocabulary' intent) — this is the only edit beyond the plan's literal interfaces list."
  - "Also retitled two test titles the interfaces section flagged as naming the old tab colloquially ('...hides the music panel', '...still opens on Music') even though the task's action prose described only two Slides-tab/Edit-in-scripture titles — treated the interfaces list as authoritative since it explicitly names all four site line numbers."

patterns-established:
  - "data-testid seam pattern: added as a test-only attribute with zero behavioral impact, specifically to decouple future panel-visibility assertions from probing the slideshow-preview component being removed in 27-05."

requirements-completed: [R034, R018]

coverage:
  - id: D1
    description: "First tab button reads exactly 'Service Order' (two words, title case) and clicking it still shows the order-of-service panel (D-03, D009)."
    requirement: R034
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the first tab button still reads Service Order"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#renders three tab buttons, the third reading Slides"
        status: pass
    human_judgment: false
  - id: D2
    description: "activeTab union and default renamed to 'service-order' | 'roles' | 'slides', page still opens on the first tab by default."
    requirement: R034
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the default active tab is unchanged (still opens on Service Order)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) -- 0 errors"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase 26's handleNavigateToScriptureEditor still lands on the renamed first tab with the requested passage editor open."
    requirement: R018
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#switches to the Service Order tab and expands the requested scripture plan item's editor"
        status: pass
    human_judgment: false
  - id: D4
    description: "QuarterView.vue, RosterView.vue, ServicesView.vue and SongSlideOver.vue (each with their own unrelated activeTab ref) are byte-for-byte unchanged."
    verification:
      - kind: other
        ref: "git diff --name-only -- src/views/QuarterView.vue src/views/RosterView.vue src/views/ServicesView.vue src/components/SongSlideOver.vue -> empty (UNRELATED-VIEWS-CLEAN)"
        status: pass
    human_judgment: false
  - id: D5
    description: "First tab panel carries a stable data-testid=\"service-order-panel\" seam for later plans to probe."
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#the first tab panel is reachable by a stable data-testid seam (27-02)"
        status: pass
    human_judgment: false
  - id: D6
    description: "No surviving 'music' activeTab literal in ServiceEditorView.vue outside comments."
    verification:
      - kind: other
        ref: "grep -v comment-lines src/views/ServiceEditorView.vue | grep -c \"'music'\" -> 0 (NO-STALE-TAB-VALUE)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-27
status: complete
---

# Phase 27 Plan 02: Service Order Tab Rename Summary

**Renamed the service editor's first tab from "Music" to "Service Order" (label, activeTab union, and every in-file call site including Phase 26's scripture relay) via a RED/GREEN test-then-implementation pair, leaving the four unrelated views' identically-named activeTab refs untouched.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-27T11:56:00Z
- **Completed:** 2026-07-27T12:21:00Z
- **Tasks:** 2 completed (RED, GREEN)
- **Files modified:** 2

## Accomplishments
- Re-located all interface sites in the 2847-line `ServiceEditorView.vue` before editing (line numbers had drifted only slightly from the plan's approximate estimates): the tab-bar intro comment (~397), the first tab button's active-class test/click handler/label (~402-407), the Slides-tab button's stale future-tense comment (~420-424), the first tab panel's `v-show` test (~437), the `activeTab` union declaration and default (~1222), and Phase 26's `handleNavigateToScriptureEditor` assignment (~1377).
- **RED:** Updated `ServiceEditorView.test.ts` to expect the new "Service Order" label everywhere the old "Music" label was asserted (the three-element tab-label array/filter, a button lookup, the dedicated first-tab-label test and title, and the "hides the music panel"/"opens on Music"/"switches to the Music tab" test titles), and added a new test asserting the first tab panel is reachable via `[data-testid="service-order-panel"]` and visible on initial render. Ran the targeted suite and confirmed exactly 4 failures, all label/seam mismatches with no mount errors (the file's other 49 tests passed unchanged) — committed as the RED gate.
- **GREEN:** Renamed the first tab button's label to "Service Order", the `activeTab` union's first member and default value to `'service-order'`, all five in-file comparisons/assignments of the old value, added the `data-testid="service-order-panel"` seam, and refreshed the two stale prose comments. Ran the targeted suite: all 53 tests now pass. Confirmed `npm run type-check` (vue-tsc --build) reports 0 errors, `npm run build` succeeds, the four unrelated views (`QuarterView.vue`, `RosterView.vue`, `ServicesView.vue`, `SongSlideOver.vue`) show zero diff, and a grep for `'music'` outside comments in the renamed file returns 0 matches — committed as the GREEN gate.
- Verified the tab bar still renders three buttons; Roles remains editor-only (`v-if="authStore.isEditor"`, untouched) and Slides remains viewer-visible (untouched).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Turn the tab-label and panel-seam assertions red** - `625c7ff` (test)
2. **Task 2 (GREEN): Rename the first tab, its value and its vocabulary** - `3354269` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final metadata commit).

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - First tab label/value renamed ('music' → 'service-order'), five call sites updated, `data-testid="service-order-panel"` seam added, two stale comments refreshed
- `src/views/__tests__/ServiceEditorView.test.ts` - Tab-label assertions and test titles updated to "Service Order"; new panel-seam test added; `musicBtn` variable renamed to `serviceOrderBtn`

## Decisions Made
- Only `ServiceEditorView.vue`'s `activeTab` union was renamed. The four other files (`QuarterView.vue`, `RosterView.vue`, `ServicesView.vue`, `SongSlideOver.vue`) each declare their own independent `activeTab` ref with the same name but unrelated values/purpose — a project-wide find-replace would have corrupted them. Verified untouched via `git diff --name-only` gate.
- Renamed the test file's `musicBtn` variable to `serviceOrderBtn` and retitled all four test titles that named the old tab colloquially (not just the two the task's prose action singled out) — the plan's own `<interfaces>` section listed all four line-number sites (~1292, ~1307, ~1373-1376, ~1409) as places naming the old first tab, so all four were treated as in-scope to avoid leaving stale vocabulary in the test suite, consistent with D-03's intent.
- Did not touch the Roles tab's `v-if="authStore.isEditor"` guard or the Slides tab's viewer-visible behavior — both were explicitly out of scope per the plan's prohibitions, and the existing viewer test (Slides present, Roles absent) was left in place unchanged to catch any accidental drop.

## Deviations from Plan

None - plan executed exactly as written. The only additions beyond the plan's literal `<interfaces>` line list (retitling all four "old tab by name" test titles rather than only two, and renaming the `musicBtn` variable) are within the plan's own stated intent ("leaving no stale vocabulary behind") and did not require any Rule 1-4 deviation — they are the same rename applied consistently within the single file the plan already scoped.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 27-03 through 27-05 (later plans, not in this session) can now use `[data-testid="service-order-panel"]` to assert first-tab-panel visibility instead of probing the `SlideshowPreview` component that 27-05 removes.
- The first tab's internal identity (`'service-order'`) is stable for any later plan that needs to branch on `activeTab.value`.
- Phase 26's "Edit in scripture" relay continues to work unchanged — it now lands on `'service-order'` instead of `'music'`, verified by the existing (retitled) Edit-in-scripture plumbing test.
- No slide-editing surfaces were touched in this plan (out of scope, per prohibitions) — `ScriptureSlideEditor`, the section-assignment `<select>`, `SlideshowPreview`, `ImportedSlideEditor`, and `SlotMediaAttachment` all remain exactly as they were, ready for 27-03 through 27-05 to strip per D-01/D-02/D-04/D-05.

---
*Phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND: 625c7ff (test commit)
- FOUND: 3354269 (feat commit)
