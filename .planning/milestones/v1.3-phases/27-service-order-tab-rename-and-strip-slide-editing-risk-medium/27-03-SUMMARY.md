---
phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
plan: 03
subsystem: ui
tags: [vue, vitest, removal, service-editor, slide-editing]

# Dependency graph
requires:
  - phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium
    provides: "27-02's rename of the first tab to 'service-order' (activeTab value this plan's fixtures and view code build on)"
provides:
  - "Service Order tab with no deck-editing surface — the imported-deck editor toggle button and its editor panel are gone from the IMPORTED slot branch"
  - "Service Order tab with no deck-import surface — both section-scoped 'Import PowerPoint' Add Element menu entries and the PptxImportModal usage that backed them are gone"
  - "src/components/ImportedSlideEditor.vue and its test file deleted (D-02, D-19) — the only component this plan orphaned"
affects: [27-04-strip-imported-slide-editor, 27-05-strip-slideshow-preview]

# Tech tracking
tech-stack:
  added: []
  patterns: ["RED/GREEN task pairing for a removal: absence + survival assertions committed first (expected failing), then the view stripped to make them pass, then the orphaned component deleted as a separate follow-up commit"]

key-files:
  created: []
  modified:
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts
    - src/stores/importedSlides.ts

key-decisions:
  - "Removed the IMPORTED slot branch's entire `v-else` half (editor toggle button, expanded editor panel, AND the viewer read-only 'Imported Slides' note that lived in the same mutually-exclusive branch) rather than only the button+panel — the interfaces block's own two-halves framing (heading+empty-state = service structure vs. toggle+panel = slide editing) places the viewer note in the second half since it only rendered as an alternate to the editor toggle for non-editors."
  - "Left ImportedSlot type import, createSlot, and the generic addSlot path (line ~1896, now ~1818) untouched — both still have real call sites after the removal (the empty-state predicate and the has-content check at former line 1920), confirmed by grep before and after the edit."

patterns-established: []

requirements-completed: [R034]

coverage:
  - id: D1
    description: "The Service Order tab offers no way to edit an imported deck's slides — the expand/collapse toggle button and the editor panel behind it are both gone (R034)."
    requirement: R034
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#offers no way to expand or view an imported deck editor"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Service Order tab offers no PowerPoint/image import action — neither Add Element menu entry, nor the import modal they opened, is mounted there any more (R034)."
    requirement: R034
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#offers no PowerPoint/image import action in the Add Element menu, and the modal it opened is gone"
        status: pass
    human_judgment: false
  - id: D3
    description: "An existing imported plan item (with a deck) still renders its heading, and one with no deck still renders its empty-state wording — the branch's service-structure half survives untouched."
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#an existing imported plan item with a deck still renders its heading"
        status: pass
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#an existing imported plan item with no deck still renders its empty-state wording"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Add Element menu's five non-import entries (Song, Scripture Reading, Prayer, Message, Hymn) are untouched by the removal."
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#still offers the five non-import Add Element entries"
        status: pass
    human_judgment: false
  - id: D5
    description: "PptxImportModal.vue and ScriptureSlideEditor.vue both survive on disk — the Slides tab's grid still mounts the import modal for real, and the scripture editor stays mounted on this tab (D-01)."
    verification:
      - kind: unit
        ref: "src/components/slides/__tests__/SlideGrid.test.ts (64 tests, mounts PptxImportModal for real) -- pass"
        status: pass
      - kind: other
        ref: "test -f src/components/PptxImportModal.vue && test -f src/components/ScriptureSlideEditor.vue -> SURVIVORS-INTACT"
        status: pass
    human_judgment: false
  - id: D6
    description: "ImportedSlideEditor.vue and its test file no longer exist on disk, and no file in src refers to them (D-02, D-19)."
    verification:
      - kind: other
        ref: "test ! -f src/components/ImportedSlideEditor.vue && test ! -f src/components/__tests__/ImportedSlideEditor.test.ts -> DELETED; grep -rl ImportedSlideEditor src -> NO-REMAINING-REFERENCES"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build) -- 0 errors; npm run build -- succeeds"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-27
status: complete
---

# Phase 27 Plan 03: Strip Deck Editing and Deck Import from the Service Order Tab Summary

**Removed the Phase 21 imported-deck slide editor and both section-scoped PowerPoint/image import actions (with the modal they opened) from `ServiceEditorView.vue`, then deleted the now-orphaned `ImportedSlideEditor.vue` component and its test file, via a RED/GREEN/delete three-task sequence.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-27T12:03:00Z
- **Completed:** 2026-07-27T12:18:00Z
- **Tasks:** 3 completed (RED, GREEN, delete)
- **Files modified:** 5 (2 modified, 1 modified-comment-only, 2 deleted)

## Accomplishments
- **RED:** Added a new describe block to `ServiceEditorView.test.ts` mounting the view with an IMPORTED-slot fixture (one plan item carrying an `importId`, one without) and asserting: the editor toggle button and editor panel are absent; both import menu entries are absent and the page text never contains "Import PowerPoint"; the imported item's heading and the id-less item's empty-state wording still render; and the Add Element menu's five non-import entries are unaffected. Ran the targeted suite and confirmed exactly the two absence assertions failed (against the pre-removal view) while all 56 pre-existing tests and the 4 new survival/menu assertions passed — committed as the RED gate.
- **GREEN:** Re-located all five interface sites in the (now Phase-27-02-renamed) view before editing: the `PptxImportModal` usage (~line 257), the IMPORTED slot branch's editor-toggle-plus-panel half (~895-924), the two Add Element menu entries (~1004-1005), the two now-unused component imports (~1190, ~1192), and the entire "Imported (PPTX/image) slot state" script section (~1398-1429: modal open flag, modal section ref, expanded-items set, open-modal function, toggle function, import-confirm handler). Removed all five while leaving the branch's heading and empty-state paragraph, the `ImportedSlot` type import, `createSlot`, and the generic add-slot path exactly as they were. Ran the targeted suite (58/58 real tests pass), `npm run type-check` (0 errors), the survivor-file check (`PptxImportModal.vue` + `ScriptureSlideEditor.vue` both present), and the Slides-tab grid suite (`SlideGrid.test.ts`, 64/64 pass, mounts the import modal for real) — committed as the GREEN gate.
- **Delete:** Re-ran the import-graph check against the current tree (post-GREEN): `grep -rl "ImportedSlideEditor" src` returned only the component's own test file and a prose comment in `src/stores/importedSlides.ts` — zero real importers. Deleted `src/components/ImportedSlideEditor.vue` and `src/components/__tests__/ImportedSlideEditor.test.ts`, and reworded the stale comment in `importedSlides.ts` (which named the deleted component as "the edit path") to describe the `stripUndefined` guard by what it does instead, without touching any store code. Confirmed `ScriptureSlideEditor.vue` — imported by the now-deleted component — is still on disk and still imported by `ServiceEditorView.vue` (D-01's edge). `npm run type-check` and `npm run build` both succeed — committed as the third task.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Assert the deck-editing and deck-import surfaces are absent** - `1f26906` (test)
2. **Task 2 (GREEN): Strip the deck editor and both import surfaces from the view** - `b69e374` (feat)
3. **Task 3: Delete the orphaned deck editor and clear its last prose reference** - `4e6217c` (chore)

**Plan metadata:** committed alongside this SUMMARY (see final metadata commit).

## Files Created/Modified
- `src/views/ServiceEditorView.vue` - Removed the `PptxImportModal` usage, the IMPORTED slot branch's editor toggle/panel (and the viewer-only "Imported Slides" note that lived in the same branch half), both import Add Element menu entries, the two now-unused component imports, and the "Imported (PPTX/image) slot state" script section (78 lines removed net)
- `src/views/__tests__/ServiceEditorView.test.ts` - New describe block (`ServiceEditorView - no deck editing or deck import on the Service Order tab (Phase 27-03)`) with 5 tests: two absence assertions, one survival assertion for the deck-bearing item's heading, one survival assertion for the empty-state item, and one for the surviving five-entry Add Element menu
- `src/components/ImportedSlideEditor.vue` - Deleted (orphaned by Task 2's removal, D-02/D-19)
- `src/components/__tests__/ImportedSlideEditor.test.ts` - Deleted alongside its component
- `src/stores/importedSlides.ts` - One stale comment reworded (no code change); no longer names the deleted component

## Decisions Made
- Removed the IMPORTED slot branch's whole `v-else` half — editor toggle button, expanded editor panel, and the viewer-only read-only "Imported Slides" note — rather than stopping at just the button and panel. The plan's interfaces block frames the branch as two halves (heading + empty-state = service structure that stays; toggle + panel = slide editing that leaves); the viewer note only ever rendered as the non-editor alternate to the editor toggle, so it belongs to the leaving half, not the staying one. The always-rendered heading (`<p>Imported Slides</p>`, outside any role branch) already covers "an imported item still shows something" for every role.
- Confirmed via grep, both before and after Task 2's edit, that `ImportedSlot` (the type), `createSlot` (the slot-factory helper), and every other slot kind stayed referenced by call sites the plan's interfaces block named (the empty-state predicate at the surviving branch, and the generic `addSlot`/has-content-check paths) — nothing extra was removed beyond the five listed interface sites.

## Deviations from Plan

None - plan executed exactly as written. The RED test block, the five interface-site removals, and the Task 3 deletion + comment reword all match the plan's `<interfaces>` and `<tasks>` sections; no Rule 1-4 deviation was needed.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 27-04 and 27-05 can now proceed against a view with no deck-editing or deck-import surface left to conflict with — `SlotMediaAttachment` and `SlideshowPreview` (this plan's siblings for removal) are untouched, exactly as scoped.
- `PptxImportModal.vue`, `ScriptureSlideEditor.vue`, the section-assignment `<select>`, the group delete cascade + warning, `expandScriptureEditor`/`handleNavigateToScriptureEditor`, the group-bed audio write path, and autosave are all confirmed unchanged — verified by the full targeted suite (`ServiceEditorView.test.ts` + `SlideGrid.test.ts`, 122/122 real tests pass) plus `npm run type-check` (0 errors) and `npm run build` (succeeds).
- The imported plan item's row (heading + empty-state wording) now renders with no interactive control at all in this tab — appending a deck to it, or viewing/editing its slides, only happens from the Slides tab (Phase 25-07), matching the v1.3 R032 model this plan's prohibitions describe.

---
*Phase: 27-service-order-tab-rename-and-strip-slide-editing-risk-medium*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: src/views/ServiceEditorView.vue
- FOUND: src/views/__tests__/ServiceEditorView.test.ts
- FOUND: src/stores/importedSlides.ts
- FOUND: .planning/phases/27-service-order-tab-rename-and-strip-slide-editing-risk-medium/27-03-SUMMARY.md
- CONFIRMED-DELETED: src/components/ImportedSlideEditor.vue
- CONFIRMED-DELETED: src/components/__tests__/ImportedSlideEditor.test.ts
- FOUND: 1f26906 (test commit)
- FOUND: b69e374 (feat commit)
- FOUND: 4e6217c (chore commit)
