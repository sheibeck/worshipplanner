---
phase: 42-powerpoint-rendered-image-display
plan: 02
subsystem: slides
tags: [firestore, onSnapshot, pinia, storage-path, vitest-mocks]

# Dependency graph
requires:
  - phase: 42-01
    provides: firestore.rules pptxRenders read (org-member) block and the generic-wildcard write exclusion, so this plan's live listener can read a render document without needing an editor role
provides:
  - PptxRenderDoc client type (status/renderedCount/failureReason projection, storagePath deliberately omitted)
  - Deterministic rendered-page Storage-path builder (renderedPrefixFor/renderedObjectName/renderedPagePath), 1-based/4-padded, matching functions/src/index.ts and render-service/src/render.ts byte-for-byte
  - usePptxRenders Pinia store — a dynamic set of live per-renderImportId onSnapshot listeners with correct open/close lifecycle
  - Wave 0 test mocks (vi.mock('@/stores/pptxRenders'), vi.mock('@/utils/pptxUpload')) in useSlideshowAssembly.test.ts, unblocking every later IMPORTED-with-render test
affects: [42-03, 42-04, 42-05, 42-06, 42-07, 42-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic set of live per-document onSnapshot listeners, diffed by id membership against a Map<id, Unsubscribe> — genuinely new in this codebase (42-PATTERNS.md 'No Analog Found'); every prior store either subscribes to one whole-collection query or does a one-shot per-id fetch"
    - "Client-side type as a consumed-fields projection of a server document, deliberately omitting a trust-sensitive field so reading it is a compile error rather than a code-review question (T-42-05)"

key-files:
  created:
    - src/types/pptxRender.ts
    - src/utils/renderedPagePaths.ts
    - src/utils/__tests__/renderedPagePaths.test.ts
    - src/stores/pptxRenders.ts
    - src/stores/__tests__/pptxRenders.test.ts
  modified:
    - src/composables/__tests__/useSlideshowAssembly.test.ts

key-decisions:
  - "PptxRenderDoc omits the server document's storagePath field entirely (T-42-05) — the only sanctioned producer of a rendered-page path is renderedPagePath(orgId, renderImportId, pageNumber), built from ids the client already trusts."
  - "One onSnapshot listener per distinct renderImportId (42-RESEARCH.md Assumption A2, D-20), not a single where(documentId(), 'in', [...]) query — imported decks per service are typically 1-3, and the per-id shape has a trivially correct teardown story. Recorded as the default; the in-query is a documented future optimization if listener count ever becomes a measured problem."
  - "Absence from rendersByImportId is the sole representation of 'no render document yet' — never a synthesized placeholder object, and a departed id's cached state is deleted the moment its listener is torn down (T-42-07 stale-render guard)."
  - "Component-suite finding (Task 3, Wave 0 Q3): SlideCard.vue (imageSrc, line 150) and PresentationViewer.vue (image branch, line 184) both consume an already-resolved imageUrl off the assembled slide and never call Storage — so SlideCard.test.ts and PresentationViewer.test.ts need no resolveImageUrl/getDownloadURL mock. URL resolution is useSlideshowAssembly's job alone; later plans 42-06/42-07 should not re-litigate this."

patterns-established:
  - "Store-private listener pool (Map<id, Unsubscribe>) never exposed on the returned store surface — only the resulting reactive data and lifecycle actions (syncSubscriptions, unsubscribeAll) are public."
  - "Test harness for N independent per-id onSnapshot listeners: mock doc()/onSnapshot() keyed by the doc ref's own id (last path segment), with per-id Maps for both the snapshot callback and the Unsubscribe spy, rather than the single shared-callback shape a whole-collection store test uses."

requirements-completed: [R079, R080]

coverage:
  - id: D1
    description: "Client render-document type (PptxRenderDoc) mirrors only the fields the client consumes and omits the trust-sensitive storagePath field"
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/renderedPagePaths.test.ts (type usage) + grep -c 'storagePath' src/types/pptxRender.ts == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rendered-page Storage-path builder is 1-based, 4-padded, and resolves both the first and last page of a multi-page deck correctly"
    requirement: R079
    verification:
      - kind: unit
        ref: "src/utils/__tests__/renderedPagePaths.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "usePptxRenders store opens exactly one live listener per distinct renderImportId and closes departed ones, with absence representing 'no render document'"
    requirement: R080
    verification:
      - kind: unit
        ref: "src/stores/__tests__/pptxRenders.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "useSlideshowAssembly.test.ts carries module-scope mocks for the new store and resolveImageUrl, unblocking later IMPORTED-with-render tests, with no regression to the existing 41-test suite"
    verification:
      - kind: unit
        ref: "src/composables/__tests__/useSlideshowAssembly.test.ts (41 tests, unchanged count)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-07
status: complete
---

# Phase 42 Plan 02: Render-Status Data Layer Summary

**Client PptxRenderDoc type, a byte-identical rendered-page Storage-path builder, and a Pinia store managing a dynamic set of live per-renderImportId Firestore listeners — the phase's one genuinely new design (no prior codebase analog).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-07T06:01:00-04:00
- **Completed:** 2026-08-07T06:08:42-04:00
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `src/types/pptxRender.ts` and `src/utils/renderedPagePaths.ts`: the client-side render-document type and the 1-based/4-padded Storage-path convention, both hand-synced to the two server-side originals (`functions/src/index.ts`, `render-service/src/render.ts`) with file:line cross-references, proven against the first AND last page of a 12-page deck.
- `src/stores/pptxRenders.ts`: `usePptxRenders`, a Pinia store holding one live `onSnapshot` per distinct `renderImportId`, diffed against the incoming id set on every `syncSubscriptions` call — opening only newly-referenced ids, closing only departed ones, leaving unchanged ids untouched, and representing an absent render document by absence from the map rather than a placeholder.
- `src/composables/__tests__/useSlideshowAssembly.test.ts`: Wave 0 mock scaffolding for `@/stores/pptxRenders` and `@/utils/pptxUpload`'s `resolveImageUrl`, plus the recorded finding that neither `SlideCard.test.ts` nor `PresentationViewer.test.ts` needs a Storage-resolution mock.

## Task Commits

Each task was committed atomically:

1. **Task 1: Client render-document type and the deterministic rendered-page path convention** - `51c7c2a` (feat)
2. **Task 2: The pptxRenders store — a dynamic set of live per-importId listeners** - `1a34eca` (feat)
3. **Task 3: Wave 0 test scaffolding — mock the new store and the URL resolver in the composable suite** - `721f4a6` (test)

**Plan metadata:** committed separately by the state-update step.

## Files Created/Modified
- `src/types/pptxRender.ts` - `PptxRenderStatus`/`PptxRenderDoc`, a consumed-fields projection omitting `storagePath`
- `src/utils/renderedPagePaths.ts` - `RENDERED_PAGE_PAD`, `renderedPrefixFor`, `renderedObjectName`, `renderedPagePath`
- `src/utils/__tests__/renderedPagePaths.test.ts` - first/last-page and object-name-regex coverage (9 tests)
- `src/stores/pptxRenders.ts` - `usePptxRenders`: `rendersByImportId`, `syncSubscriptions`, `unsubscribeAll`
- `src/stores/__tests__/pptxRenders.test.ts` - listener open/close lifecycle, leak guard, absence representation, org switch/null teardown, idempotent `unsubscribeAll` (10 tests)
- `src/composables/__tests__/useSlideshowAssembly.test.ts` - added two module-scope `vi.mock` blocks (pptxRenders store stub, `resolveImageUrl` spy); no new test cases, same 41-test count

## Decisions Made
- `PptxRenderDoc` intentionally omits `storagePath` (T-42-05) — see `key-decisions` in frontmatter.
- One listener per `renderImportId` rather than an `in`-query batch subscription (D-20/A2) — see `key-decisions`.
- Absence-as-representation for "no render document yet" (T-42-07 stale-render guard) — see `key-decisions`.
- Component-suite mock finding recorded for 42-06/42-07 to consume without re-investigating — see `key-decisions`.

## Deviations from Plan

None — plan executed exactly as written. All `must_haves`, artifacts, and acceptance criteria were met without needing an architectural change, a scope addition, or an auto-fix.

## Issues Encountered

None during implementation. The one process note: the plan's own `<verification>` section documents a 3-file failing baseline for bare `npx vitest run` (`render-service/src/render.test.ts`, `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`); the full-suite run at wave-merge time reproduced exactly that 3-file set with no new failures, confirming no regression from this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The render-status data layer (type, path convention, store) is in place for 42-03 onward to wire into `useSlideshowAssembly`, `slideGroupMaterializer.ts`, and `slideshowAssembler.ts`.
- The Wave 0 composable-test mocks mean every later IMPORTED-with-render test can fail only for the right reason.
- The component-suite mock question (Wave 0 Q3) is answered and recorded — no action needed in 42-06/42-07 beyond citing this SUMMARY.
- No blockers.

---
*Phase: 42-powerpoint-rendered-image-display*
*Completed: 2026-08-07*

## Self-Check: PASSED

All 6 files created/modified confirmed present on disk; all 3 task commit hashes (`51c7c2a`, `1a34eca`, `721f4a6`) confirmed in git history.
