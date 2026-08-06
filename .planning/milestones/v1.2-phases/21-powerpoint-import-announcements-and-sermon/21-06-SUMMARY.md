---
phase: 21-powerpoint-import-announcements-and-sermon
plan: 06
subsystem: ui
tags: [vue, pinia, auto-save, service-editor, pptx, slots]

# Dependency graph
requires:
  - phase: 21-powerpoint-import-announcements-and-sermon (21-01)
    provides: ImageSlide/TextSlide/ImportedDeck types, IMPORTED SlotKind/ImportedSlot, importedSlides Pinia store, assembleSlideshow IMPORTED case
  - phase: 21-powerpoint-import-announcements-and-sermon (21-05)
    provides: "PptxImportModal.vue -- emits confirmed({ importId, section }) after persisting the deck via importedSlides.createDeck; pptxUpload.ts client helpers"
  - phase: 20-service-sections-and-slide-auto-assembly
    provides: ServiceEditorView's section grouping, SortableJS reorder (MEM008), SCRIPTURE slot expand/collapse precedent
provides:
  - "src/components/ImportedSlideEditor.vue -- per-deck editor (orgId+importId props) with editable text-slide body/title and image-slide alt-text, auto-saving via useAutoSave -> importedSlides.updateDeck"
  - "ServiceEditorView.vue add-element menu entries opening PptxImportModal scoped to pre-service (announcements) or message (sermon)"
  - "ServiceEditorView.vue IMPORTED slot creation on modal confirm (createSlot + reindexSlots), IMPORTED slot rendering with expand/collapse mounting ImportedSlideEditor"
  - "isSlotPopulated/elementLabel IMPORTED cases; PC-export IMPORTED-skip in the no-template export loop (RESEARCH Pitfall 2)"
affects: [22 (retention sweep and any further imported-deck lifecycle work)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ImportedSlideEditor deliberately omits store subscribeDecks/unsubscribeDecks (unlike ScriptureSlideEditor's subscribeReadings/unsubscribeReadings) -- useSlideshowAssembly already owns a single org-scoped importedSlides subscription for the whole ServiceEditorView page; a per-editor unsubscribe would tear that down and silently break the live Slideshow Preview after closing the panel."
    - "IMPORTED slots are excluded from PC export by early `continue` in the no-template slot loop, and are already excluded from the existing-plan branch because that branch only ever touches the SONG/HYMN and SCRIPTURE filtered buckets -- neither path reaches the (slot as any) narrowing that would otherwise mislabel it."

key-files:
  created:
    - src/components/ImportedSlideEditor.vue
    - src/components/__tests__/ImportedSlideEditor.test.ts
  modified:
    - src/views/ServiceEditorView.vue

key-decisions:
  - "ImportedSlideEditor's importId prop is optional (mirroring ScriptureSlideEditor's readingId?), but in practice ServiceEditorView only ever mounts it once a slot's importId is already set (createSlot('IMPORTED', ...) followed immediately by assigning the modal's emitted importId) -- there is no 'empty IMPORTED slot needs a deck created' path analogous to SCRIPTURE's empty-reference state."
  - "PptxImportModal is mounted once per ServiceEditorView instance (not per-slot), with a single showImportModal/importModalSection pair toggled by which add-element menu button was clicked -- mirrors how the modal was designed in 21-05 (orgId + section props, no slot awareness)."

patterns-established: []

requirements-completed: [R011, R012, R017, R018]

coverage:
  - id: D1
    description: "ImportedSlideEditor.vue loads a deck by orgId+importId and renders editable text-slide bodies/titles and image-slide alt-text; edits auto-save via useAutoSave -> importedSlides.updateDeck; no save fires on initial load."
    requirement: "R017"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ImportedSlideEditor.test.ts (9 tests: load+render, text/image editing, auto-save wiring + updateDeck call, no-save-on-load, status indicator, cleanup, no-importId empty state)"
        status: pass
      - kind: unit
        ref: "npx vue-tsc --build (0 errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ServiceEditorView add-element menu offers announcement (pre-service) and sermon (message) imports opening PptxImportModal; confirmed event creates an IMPORTED slot bound to the emitted importId via createSlot+reindexSlots; an expanded IMPORTED slot renders ImportedSlideEditor; isSlotPopulated/elementLabel handle IMPORTED; PC-export skips IMPORTED rather than mislabeling it."
    requirement: "R011"
    verification:
      - kind: unit
        ref: "npx vitest run src/utils/__tests__/slotTypes.test.ts src/utils/__tests__/slideshowAssembler.test.ts (126 tests, unchanged and green)"
        status: pass
      - kind: unit
        ref: "npx vue-tsc --build (0 errors)"
        status: pass
    human_judgment: false
  - id: D3
    description: "End-to-end PPTX/image import flow against the running emulators: sermon .pptx lands in Message, announcement .pptx/images land in Pre-Service, imported slides edit with auto-save persisting on reload, a corrupted file shows the friendly error with retry, and the uploaded source .pptx persists in Storage after both success and failure (never deleted)."
    requirement: "R012"
    verification: []
    human_judgment: true
    rationale: "Requires a real .pptx upload against the Firestore/Storage/Functions emulators, a real parsePptx round trip, and visual confirmation of the modal/preview/editor UI and Storage emulator object persistence -- none of which can be proven by a mocked component test. This is 21-06's blocking checkpoint (Task 3), returned to the user PENDING, not self-approved."

# Metrics
duration: ~35min
completed: 2026-07-25
status: complete
---

# Phase 21 Plan 06: ImportedSlideEditor + ServiceEditorView wiring Summary

**ImportedSlideEditor (per-deck auto-saving editor for text/image slides) plus ServiceEditorView's add-element-menu-to-IMPORTED-slot wiring, closing the PPTX/image import path for announcements (Pre-Service) and sermon (Message); the phase-closing end-to-end verification is a pending human-verify checkpoint.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-25T12:05:00-04:00 (approx)
- **Completed:** 2026-07-25T12:40:00-04:00 (last task commit, prior to this SUMMARY)
- **Tasks:** 2 of 3 (`type="auto"`) completed and committed; Task 3 (`checkpoint:human-verify`) reached and returned PENDING, not self-approved
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `src/components/ImportedSlideEditor.vue` — loads an `ImportedDeck` by `orgId`+`importId` via `importedSlides.getDeck`, renders each slide as a card (text slides: editable optional title + multiline body; image slides: the resolved image plus an editable alt-text field), and auto-saves edits through `useAutoSave` calling `importedSlides.updateDeck(orgId, importId, { slides })`. Mirrors `ScriptureSlideEditor`'s header/status-indicator markup and local-slides pattern, but intentionally skips `subscribeDecks`/`unsubscribeDecks` to avoid tearing down the org-level subscription `useSlideshowAssembly` already owns for the Slideshow Preview.
- `src/components/__tests__/ImportedSlideEditor.test.ts` — 9-test Vitest suite: deck load + render, editable text body, editable image alt-text (with resolved `<img src>`), auto-save fires and calls `updateDeck` with the edited slide, image alt-text local-state update, no save on initial load, save-status indicator for all three states, cleanup on unmount, and the no-`importId` empty state.
- `src/views/ServiceEditorView.vue` — two new add-element menu entries ("Import PowerPoint / Images (Announcements)" and "Import PowerPoint (Sermon)") open `PptxImportModal` with a fixed `section` prop (`pre-service` / `message`); the modal is mounted once per view with `showImportModal`/`importModalSection` state. On `confirmed({ importId, section })`, a new `IMPORTED` slot is appended via `createSlot('IMPORTED', undefined, section)` with `importId` set, then `reindexSlots` runs — the existing deep-watch auto-save persists it, no new persistence path was added. `cancel` just closes the modal. A new IMPORTED template branch renders an expand/collapse toggle (mirroring the SCRIPTURE panel) that mounts `ImportedSlideEditor` for the slot's `importId` when expanded. `isSlotPopulated` and `elementLabel` gained IMPORTED cases.
- PC-export (Pitfall 2 check): the `existing plan` export branch already only ever iterates the SONG/HYMN and SCRIPTURE filtered buckets, so IMPORTED slots were already excluded there without any change. The `no template / new plan` branch iterates every slot directly, so an explicit `if (slot.kind === 'IMPORTED') continue` was added before the `addSlotAsItem` call — without it, an IMPORTED slot would have silently fallen through to `addSlotAsItem`'s default branch and been exported as a mislabeled "Message" PC item. Both decisions are recorded in code comments.
- `npx vue-tsc --build` stays at 0 errors (confirmed both before and after both tasks). `npx vitest run src/components/__tests__/ImportedSlideEditor.test.ts src/utils/__tests__/slotTypes.test.ts src/utils/__tests__/slideshowAssembler.test.ts` is 135/135 green. `npx eslint` on all three changed files reports the identical 15 pre-existing errors as the pre-21-06 baseline (confirmed via `git stash` diff) — zero new lint errors introduced.

## Task Commits

Each task was committed atomically:

1. **Task 1: ImportedSlideEditor with auto-save** - `c7b29c5` (feat)
2. **Task 2: Wire import into ServiceEditorView** - `1cf7237` (feat)
3. **Deferred-items log (discovered during Task 2 verification)** - `0493703` (docs)

**Task 3 (checkpoint:human-verify): PENDING** — returned to the orchestrator, not self-approved. See "Checkpoint: End-to-end verification" below.

**Plan metadata:** (this commit, following STATE/ROADMAP update)

## Files Created/Modified
- `src/components/ImportedSlideEditor.vue` - editable, auto-saving imported-deck editor (new file)
- `src/components/__tests__/ImportedSlideEditor.test.ts` - 9-test Vitest suite (new file)
- `src/views/ServiceEditorView.vue` - add-element menu entries, PptxImportModal mount, IMPORTED slot creation/rendering, isSlotPopulated/elementLabel IMPORTED cases, PC-export IMPORTED skip

## Decisions Made
- **ImportedSlideEditor omits store subscribeDecks/unsubscribeDecks.** `useSlideshowAssembly` already subscribes the `importedSlides` store at the org level for the whole `ServiceEditorView` page (feeding the Slideshow Preview). Mirroring `ScriptureSlideEditor`'s subscribe-on-mount/unsubscribe-on-unmount pattern exactly would have called `unsubscribeDecks()` on every panel close, tearing down that shared org-level listener and breaking live preview updates. Since `ImportedSlideEditor` only ever needs a one-shot `getDeck` fetch (not a live subscription of its own), the safer choice was to omit the subscribe/unsubscribe calls entirely rather than copy a footgun into new code.
- **`importId` is an optional prop**, matching `ScriptureSlideEditor`'s `readingId?` precedent, even though in this codebase's actual flow an `IMPORTED` slot always has its `importId` set at creation time (unlike `SCRIPTURE`, which starts empty and gets a reading assigned later). The optional-prop shape keeps the component's contract consistent with its sibling editor and defensively handles an unpopulated slot without crashing.
- **PC-export IMPORTED handling split across two code paths**, both already covered without further `(slot as any)` narrowing: the existing-plan branch needed no change (it never iterates raw slots, only the pre-filtered song/scripture buckets); the no-template/new-plan branch needed an explicit early skip, added with a comment recording the Pitfall-2 rationale.

## Deviations from Plan

### Auto-fixed Issues

None — both `type="auto"` tasks were implemented exactly per plan text; no Rule 1/2/3 auto-fixes were needed on the newly-written code.

### Logged, not fixed (out of scope)

**1. Pre-existing `src/views/__tests__/ServiceEditorView.test.ts` Pinia failure**
- **Found during:** Task 2 verification (an extra sanity check beyond the plan's own `<verify>` command, which only targets `slotTypes.test.ts`/`slideshowAssembler.test.ts`)
- **Issue:** All suites in this test file fail at mount with `getActivePinia() was called but there was no active Pinia`, thrown from `useSlideshowAssembly` when it calls `useImportedSlides()` — a regression from 21-01 (which added the unconditional `useImportedSlides()` call to `useSlideshowAssembly.ts` and updated `useSlideshowAssembly.test.ts`'s own mocks accordingly, but never touched `ServiceEditorView.test.ts`).
- **Verified pre-existing:** Reproduced identically via `git stash` on `src/views/ServiceEditorView.vue` alone (reverting only this plan's Task 2 edits) against the pre-21-06 baseline.
- **Scope decision:** `ServiceEditorView.test.ts` is not in 21-06's `files_modified`; per the scope-boundary rule, out-of-scope pre-existing failures are logged, not fixed. Logged to `.planning/phases/21-powerpoint-import-announcements-and-sermon/deferred-items.md` (commit `0493703`) with a suggested fix (add the `@/stores/importedSlides` mock stub already established in `useSlideshowAssembly.test.ts`).

---

**Total deviations:** 0 auto-fixed; 1 pre-existing issue logged (out of scope, not caused by this plan)
**Impact on plan:** None — the logged issue does not affect this plan's own deliverables or their verification (both target tests, `slotTypes.test.ts`/`slideshowAssembler.test.ts`, remain green; `ImportedSlideEditor.test.ts` is a standalone component test that does not mount `ServiceEditorView`).

## Issues Encountered
None beyond the deferred item above.

## User Setup Required
None — no external service configuration required. `.env.local` was already present in this working tree (main checkout, sequential executor, no worktree isolation per CLAUDE.md).

## Checkpoint: End-to-end verification (Task 3) — PENDING

**Status: awaiting human verification. NOT self-approved.**

The full PPTX/image import path is wired end to end and ready for manual verification against the running emulators + dev server:

1. Start emulators (auth, firestore, functions, storage) and run the app against them, signed in as an org editor, with `.env.local` present (per `CLAUDE.md`).
2. Open a service → add-element menu → **"Import PowerPoint (Sermon)"** → upload a real (or fixture) sermon `.pptx`. Confirm upload progress → parsed slide preview → on confirm, an IMPORTED slot appears in the **Message** section and its slides show in the Slideshow Preview.
3. Add-element menu → **"Import PowerPoint / Images (Announcements)"** → import a `.pptx` AND separately select one or more images. Confirm both produce an IMPORTED deck in the **Pre-Service** section, images rendering as image cards.
4. Expand an imported slot, edit a text slide's body; confirm the auto-save indicator cycles pending → saving → saved and the edit persists on reload.
5. Import a deliberately corrupted/non-pptx file; confirm the friendly error ("We couldn't read this file — try re-exporting from PowerPoint.") shows with a working retry.
6. In the Storage emulator UI, confirm the uploaded source `.pptx` object under `orgs/{orgId}/pptx-imports/{importId}/source.pptx` STILL EXISTS after both a successful import and a failed one (never deleted).

**Resume signal:** Reply "approved" if all six checks pass, or describe what failed (which step, observed vs. expected) and this plan will be revisited.

## Next Phase Readiness
- Once the Task 3 checkpoint is approved, Phase 21's full PPTX/image import feature (types → Storage/Functions → parser → upload/modal → editor/wiring) is complete: R010, R011, R012, R017, R018 all close.
- No code blockers. `npx vue-tsc --build` remains at 0 errors project-wide.
- One pre-existing, out-of-scope issue logged for future cleanup: `ServiceEditorView.test.ts` needs an `importedSlides` store mock (see `deferred-items.md`).

---
*Phase: 21-powerpoint-import-announcements-and-sermon*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: src/components/ImportedSlideEditor.vue, src/components/__tests__/ImportedSlideEditor.test.ts, src/views/ServiceEditorView.vue, .planning/phases/21-powerpoint-import-announcements-and-sermon/deferred-items.md (all exist on disk)
- FOUND: c7b29c5, 1cf7237, 0493703 (all present in `git log --oneline`)
