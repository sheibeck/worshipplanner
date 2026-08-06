---
phase: 36-ui-rework-service-order-contextual-action-bars
plan: 03
subsystem: ui
tags: [vue, tailwind, action-bar, testing, tdd, service-editor]

requires:
  - phase: 36-02
    provides: "ContextualActionBar.vue, buildActionBarItems(tab, ctx), ActionBarItem contract"
provides:
  - "ServiceEditorView's header renders a single per-tab ContextualActionBar instead of four unconditional buttons (R068, ROADMAP criterion 2)"
  - "▶ Present relocated from SlidesTab's own header into ServiceEditorView's page header, immediately left of Save (design 1a, ROADMAP criterion 3)"
  - "SlidesTab.canPresent / SlidesTab.onPresentClick exposed for a parent-level ref to drive"
  - "Tab strip reordered to Service Order · Slides · Roles (R069, ROADMAP criterion 5)"
affects: [36-04, 36-05]

tech-stack:
  added: []
  patterns:
    - "Template ref into a child's defineExpose surface (slidesTabRef) as the seam for a page-level control to drive a child component's condition/emit without duplicating either"
    - "shallowMount test infrastructure: unstub a newly-introduced real child component (`ContextualActionBar: false`) globally across every mountView in a large pre-existing test file, rather than rewriting each assertion's selector"

key-files:
  created: []
  modified:
    - src/components/slides/SlidesTab.vue
    - src/components/slides/__tests__/SlidesTab.test.ts
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "SlidesTab exposes canPresent/onPresentClick rather than the header reimplementing the present-start-index computation — the header's onPresent handler is a zero-argument arrow with no logic, calling slidesTabRef.onPresentClick(), which still emits `present` into the view's existing @present=\"onPresent\" listener. R061's index math stays in exactly one place."
  - "Preserved the live (ungated) export/copy visibility over 36-UI-SPEC §3's illustrative canEditService-gated version, per 36-02's recorded divergence — a viewer and a locked editor still see the export-or-copy control in the relocated bar, verified by two dedicated mounted tests."
  - "Test infrastructure: every one of the 24 pre-existing mountView() stub configs in ServiceEditorView.test.ts got `ContextualActionBar: false` added (a single replace_all edit, since `AppShell: { template: ... }` was byte-identical across all 24). This was necessary because Suggest/Export/Copy/Save/Present now render inside a real child component under shallowMount's default auto-stub, not as literal template elements. Every pre-existing testid/text assertion in the file continued to pass with zero selector rewrites — confirming the plan's own prediction that a real regression, not a needed test update, would be the only reason any of them broke."
  - "The mounted Present-relocation proof (new describe block) uses a purpose-built SlidesTab stub (canPresent: true, onPresentClick emits a fixed start index) rather than driving the real useSlideshowAssembly pipeline through Firestore-backed mocks. That pipeline's own correctness (R061 index math) is already fully proven by SlidesTab.test.ts's real-component suite (36-03 Task 1) and by 36-02's data-level suite; this block is testing the HEADER's wiring only."
  - "Roles-tab test forces `previousService` directly on the mounted vm (bypassing the real autosave debounce flow) so the Undo button's own v-if has something to gate on — a targeted setup shortcut, not a behavior change to the Undo button itself."

requirements-completed: [R068, R069]

coverage:
  - id: D1
    description: "SlidesTab renders no Present button of its own; canPresent and onPresentClick are exposed via defineExpose alongside the four pre-existing members, with the condition/emit/payload unchanged from before the move"
    requirement: "R068"
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlidesTab.test.ts (58 tests, including the Present-relocation describe block and every R061 presentStartIndex test now driven through the exposed API)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ServiceEditorView's header mounts <ContextualActionBar :items=\"activeActionItems\"> in place of the four unconditional Suggest/Export/Copy/Save buttons; the R071 no-credentials note travels into the bar's hint-copy-pc slot verbatim (same testid, gate, copy, router-link); Present renders in the header only on the Slides tab, immediately before Save, and opens PresentationViewer via slidesTabRef.onPresentClick()"
    requirement: "R068"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts (197 tests, including the new 'contextual action bar wiring (36-03, R068)' describe block: per-tab matrix, viewer/locked-editor export-or-copy preservation, the Present relocation + click-to-viewer path, a named 34-10 regression guard, and cross-tab idempotency)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Tab strip renders Service Order · Slides · Roles for an editor and Service Order · Slides for a viewer; the activeTab literal union and the two v-show panel wrappers are unchanged; no role=\"tablist\" semantics introduced"
    requirement: "R069"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts ('renders three tab buttons in order Service Order, Slides, Roles', 'viewer: the Slides button is present while the Roles button is not', grep assertions on the activeTab union and role=\"tablist\")"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-04
status: complete
---

# Phase 36 Plan 03: Wiring the Contextual Action Bar into the Page Header Summary

**`ServiceEditorView`'s header now renders one per-tab `ContextualActionBar` (built by 36-02) instead of four unconditional buttons, `▶ Present` relocates from `SlidesTab` into that header via a `slidesTabRef`/`defineExpose` seam, and the tab strip reorders to Service Order · Slides · Roles — with the pre-phase export/copy gate, R071's note, and 34-10's chrome-strip all verified byte-for-byte intact.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-04
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments
- `SlidesTab.vue` no longer renders its own Present button; `canPresent` and `onPresentClick` are exposed alongside the four pre-existing members, with a comment recording that the button moved but the condition/emit stayed
- `ServiceEditorView.vue`'s header imports `ContextualActionBar`/`buildActionBarItems`, adds a `slidesTabRef` template ref bound on `<SlidesTab>`, and computes `activeActionItems` from the view's own existing state — deleting the four hand-written Suggest/Export/Copy/Save button blocks and moving the R071 credentials-note span verbatim into the bar's `hint-copy-pc` slot
- Tab strip reordered to Service Order · Slides · Roles (R069) — a pure reposition of the three existing buttons; the two `v-show` panels stay in their original DOM order and the `activeTab` union is untouched
- 197 tests in `ServiceEditorView.test.ts` (up from 187 pre-plan) and 58 in `SlidesTab.test.ts` all pass, plus the full 4-file plan-scoped run (290 tests) and the project-wide suite (2483 passing, the same 9-test/2-file pre-existing baseline failing: `storage.rules.test.ts` needs the Storage emulator, `RosterView.test.ts` has a stale assertion)
- `npm run type-check` (the mandated `vue-tsc --build` gate, not the narrower `-p tsconfig.app.json` form) and `npm run build` both clean

## Task Commits

Each task was committed atomically:

1. **Task 1: SlidesTab exposes canPresent/onPresentClick and drops its local Present wrapper** - `7685844` (feat)
2. **Task 2: ServiceEditorView's header renders the per-tab ContextualActionBar** - `391a8a8` (feat)
3. **Task 3: Reorder the tab strip to Service Order · Slides · Roles (R069)** - `a4351f1` (feat)

**Plan metadata:** committed after this summary (see below).

_Note: none of these tasks used the RED/GREEN TDD cycle as separate commits — Task 1 and 2 are marked `tdd="true"` in the plan but the underlying behavior (moving existing, already-tested logic) was verified test-first within a single commit per task, consistent with how the deletions/relocations were scoped._

## Files Created/Modified
- `src/components/slides/SlidesTab.vue` - deleted the local Present CTA wrapper; exposed `canPresent`/`onPresentClick`
- `src/components/slides/__tests__/SlidesTab.test.ts` - every Present assertion re-targeted at the exposed API instead of a DOM click on the deleted CTA
- `src/views/ServiceEditorView.vue` - mounted `ContextualActionBar` in the header, added `slidesTabRef` + `activeActionItems`, reordered the tab strip
- `src/views/__tests__/ServiceEditorView.test.ts` - unstubbed `ContextualActionBar` across all 24 pre-existing `mountView` helpers, added a 10-test per-tab mounted-proof describe block, updated the two tab-order assertions

## Decisions Made
See `key-decisions` in the frontmatter above — summarized: (1) route Present through the exposed `onPresentClick` rather than duplicating index math in the header; (2) keep the live ungated export/copy visibility, not the spec's illustrative gated version; (3) unstub `ContextualActionBar` globally across the test file's mount helpers rather than rewrite assertions; (4) test the Present relocation's header wiring against a purpose-built `SlidesTab` stub rather than the real `useSlideshowAssembly` pipeline, since that pipeline's own correctness is proven elsewhere; (5) force `previousService` directly for the Roles-tab Undo-button assertion rather than driving the full autosave flow.

## Test Edit Classification (test_edit_discipline)

Every existing test assertion touched by this plan is classified below. **Zero are behaviour-change edits.**

### `SlidesTab.test.ts` — MOVED-CONTROL (8 assertions/describe-blocks)
1. `renders the Present button` → `renders no Present button of its own` — asserts absence instead of presence of the deleted CTA; same underlying fact (the control moved).
2. `disables the Present button when there are no assembled slides...` → `canPresent is false with no assembled slides, and true once there are` — same condition, now read from the exposed boolean instead of a `disabled` DOM attribute.
3. `emits present exactly once when clicked while enabled` → `onPresentClick() emits present exactly once` — same emit/payload, now invoked via the exposed method instead of `.trigger('click')`.
4. The `presentStartIndex` describe block's shared `presentPayload()` helper — now calls `onPresentClick()` instead of clicking the deleted CTA; the SIX tests built on top of it (`a selected slide resolves...`, `a slide at its group's first or last position...`, `a slot selected with no slide within it...`, `nothing selected resolves to 0`, `a stale selectedSlideId falls back...`, `groups with differing slide counts...`) keep their exact same expected values — R061's index math is untouched.
5. `clicking present-slideshow-cta emits present with the computed start index...` → `calling onPresentClick() emits present with the computed start index...` — same payload assertion (`[3]`), different trigger mechanism.
6. `D-08: Present stays enabled while locked...` → `D-08: canPresent stays true while locked...` — same underlying fact (serviceLocked never fed the condition either way); reads the exposed boolean instead of a DOM `disabled` attribute since the CTA no longer renders here.

### `ServiceEditorView.test.ts` — MOVED-CONTROL / infrastructure (26 sites)
1. **24 `mountView()` stub configs** — each got `ContextualActionBar: false` added. This is a test-infrastructure change (shallowMount's auto-stub configuration), not a selector rewrite: every pre-existing testid/text assertion in the file (copy-pc-btn, export-pc-btn, the R071 note, Suggest All Songs, Save, mark-planned-btn, etc.) passed **unmodified** once this config change landed, confirming the plan's own prediction.
2. `renders three tab buttons, the third reading Slides` → `renders three tab buttons in order Service Order, Slides, Roles` — same three buttons, same gates, same click behaviour; only the expected DOM order changed (R069).
3. `the first tab button still reads Service Order` — the `.filter()` call's literal array was updated to `['Service Order', 'Slides', 'Roles']` for documentation accuracy; functionally a no-op since `.filter` preserves DOM order regardless of the filter array's own element order, and the assertion (`firstTabBtn.text() === 'Service Order'`) is unchanged.

### New coverage (not edits — net-new tests)
- `SlidesTab.test.ts`: 2 new tests (`exposes the four pre-existing members alongside the two new ones`, `the rail and grid still render`).
- `ServiceEditorView.test.ts`: a new 10-test describe block, `ServiceEditorView - contextual action bar wiring (36-03, R068)`, covering the plan's full acceptance-criteria matrix (per-tab gating, viewer/locked-editor export-or-copy preservation, the Present relocation and its click-to-`PresentationViewer` path, a named 34-10 regression guard, and cross-tab idempotency).

**Total: 0 behaviour-change edits.** Every edited assertion is moved-control; every new test is net-new coverage for this plan's own deliverables.

## The Four Things That Must Survive — verified

1. **34-10's save-status chrome-strip.** Not touched by any edit in this plan (the block sits between the header and the tab strip, untouched code). A NEW named regression guard was added (`34-10 guard: the save-status bar stays mounted at idle with no chrome classes and a mounted SaveStatusIndicator`) in addition to the pre-existing 34-10 describe block, both passing.
2. **34-12's no-credentials note.** Moved verbatim into the bar's `hint-copy-pc` slot — same `data-testid="pc-credentials-missing-note"`, same `canEditService && !hasPcCredentials` gate, same copy, same live `<router-link>`. All 6 pre-existing tests in the "Planning Center credentials-missing note" describe block pass unmodified; the new describe block adds two more mounted assertions (draft-no-credentials shows the note with a working link, credentialed-planned does not).
3. **The real export/copy visibility.** `buildServiceOrderItems` (36-02) pushes the export/copy item unconditionally, gating only `suggest-all-songs`/`save` on `canEditService` — preserved verbatim, not narrowed to the spec's illustrative `canEditService`-gated version. Two new mounted tests assert a viewer and a locked (`planned`) editor both still see the export-or-copy control.
4. **Phase 34's congregational modal.** Not touched by any file this plan modifies (`CongregationalEditor.vue`, its mount point at `ServiceEditorView.vue:570`-area, and its keying were never in this plan's `<files_modified>` list). The pre-existing WR-04/34-07 describe blocks (untouched by this plan) continue to pass at 197/197.

## Deviations from Plan

None - plan executed exactly as written. The `ContextualActionBar: false` stub-config addition across 24 mount helpers was anticipated by the plan's own instruction ("if any of them fails, treat that as a real regression, not as a selector to update") — the config change was necessary groundwork to keep those assertions reachable in the DOM under `shallowMount`, not a workaround for a failure.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ContextualActionBar`/`buildActionBarItems` (36-02) are now consumed by the one real call site this milestone's action-bar work targets; 36-04/36-05 (per ROADMAP) can proceed against this header shape.
- R053 (drop-zone-as-import + moving Add-slide/Add-music into the action bar, per STATE.md's routing note) has NOT been addressed by this plan — the action bar currently carries only the Service Order/Slides items this plan's `buildActionBarItems` builds; a future plan extending the bar with Add-slide/Add-music affordances should re-check `serviceEditorActionBar.ts`'s `ActionBarContext`/`ActionBarHandlers` shape before adding fields.
- The Roles tab's empty action-bar list remains an open DESIGN question per `36-UI-SPEC.md § UI Considerations` (unresolved, carried from 36-02) — this plan proves it renders zero buttons and no empty box, not that "zero buttons" is the final design answer.
- ★ R069 EDGE, deliberately left unresolved (per this plan's own frontmatter `assumptions`): only the rendered order of the three tab buttons was built. Deep links to a tab, keyboard tab-cycling order, and persistence of the active tab across reloads are unspecified in every source artifact and were not invented here.

---
*Phase: 36-ui-rework-service-order-contextual-action-bars*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 3 commit hashes (7685844, 391a8a8, a4351f1) and all files referenced (SlidesTab.vue, ServiceEditorView.vue, and their test files) verified present.
