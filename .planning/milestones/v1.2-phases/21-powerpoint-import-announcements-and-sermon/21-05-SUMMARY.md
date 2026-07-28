---
phase: 21-powerpoint-import-announcements-and-sermon
plan: 05
subsystem: ui
tags: [vue, firebase-storage, firebase-functions, httpsCallable, vitest, pptx, upload]

# Dependency graph
requires:
  - phase: 21-powerpoint-import-announcements-and-sermon (21-01)
    provides: ImageSlide/TextSlide/ImportedDeck types, importedSlides Pinia store (createDeck)
  - phase: 21-powerpoint-import-announcements-and-sermon (21-02)
    provides: storage/functions clients exported from src/firebase/index.ts, storage.rules org gate
  - phase: 21-powerpoint-import-announcements-and-sermon (21-04)
    provides: "parsePptx onCall Cloud Function -- ({ orgId, importId, storagePath }) -> { slides: (MappedTextSlide|MappedImageSlide)[] }"
provides:
  - "src/utils/pptxUpload.ts -- generateImportId, uploadPptx (resumable + progress), uploadImage, resolveImageUrl client helpers"
  - "src/components/PptxImportModal.vue -- step-based import modal (idle/uploading/parsing/preview/confirming/error) driving both the .pptx-via-parsePptx mode and the direct image-only mode"
  - "src/components/__tests__/PptxImportModal.test.ts -- 4-test Vitest suite proving the PPTX happy path, the image-only path, and the error/retry path"
affects: [21-06 (ImportedSlideEditor + ServiceEditorView wiring consumes PptxImportModal's confirmed event and the pptxUpload helpers), 22 (retention sweep consumes the createdAt custom metadata written by pptxUpload)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side httpsCallable('parsePptx') invocation passes ONLY { orgId, importId, storagePath } -- file bytes never cross the onCall body, matching 21-RESEARCH's anti-pattern warning."
    - "Vue Test Utils Teleport testing pattern: query teleported modal content via `new DOMWrapper(document.body)` + `enableAutoUnmount(afterEach)`, since `mount()`'s own wrapper only contains teleport start/end comments once content is teleported to <body>."

key-files:
  created:
    - src/utils/pptxUpload.ts
    - src/components/PptxImportModal.vue
    - src/components/__tests__/PptxImportModal.test.ts
  modified: []

key-decisions:
  - "generateImportId() (crypto.randomUUID, mirroring src/utils/csvImport.ts's per-arrangement id convention) scopes the Storage path only, for one upload session. It is intentionally distinct from the Firestore-assigned id importedSlides.createDeck() returns on confirm -- the two ids serve different lifetimes (a transient upload session vs. a persisted deck) and conflating them would force the deck's permanent id to be chosen before the deck's content is even known."
  - "uploadImage uses a single-shot uploadBytes (not uploadBytesResumable) since the image-only mode does not report per-file progress in the UI -- only the overall uploaded-count fraction, computed client-side per completed file."
  - "The friendly copy ('We couldn't read this file — try re-exporting from PowerPoint.') is shown for ANY failure in either mode (upload OR parse), not just parse failures -- the client cannot distinguish a corrupt file from a transient network error, and both are equally unactionable to the end user."
  - "lastRetry re-invokes the entire failed import function (re-upload + re-parse) rather than resuming mid-flight, mirroring RosterImportModal's established lastRetry pattern exactly."

patterns-established:
  - "Modal components using <Teleport to=\"body\"> must be tested via a document.body DOMWrapper + enableAutoUnmount, not wrapper.find() directly -- this is the first component test in the codebase covering a Teleport-based modal (RosterImportModal/CsvImportModal/PcImportModal had none before this plan)."

requirements-completed: [R010, R011, R012, R018]

coverage:
  - id: D1
    description: "pptxUpload.ts exports generateImportId, uploadPptx (resumable upload to orgs/{orgId}/pptx-imports/{importId}/source.pptx with progress callback + createdAt metadata), uploadImage (single-shot upload under images/{index}.{ext} with createdAt metadata), and resolveImageUrl (getDownloadURL wrapper)."
    requirement: "R010"
    verification:
      - kind: unit
        ref: "npx vue-tsc --build (type-check, 0 errors) -- no dedicated unit test file per plan scope; behavior is exercised indirectly through PptxImportModal.test.ts's mocked calls"
        status: pass
    human_judgment: false
  - id: D2
    description: "PptxImportModal drives a step machine (idle/uploading/parsing/preview/confirming/error) across two modes: PPTX (upload -> httpsCallable('parsePptx') with only the storage path -> map+resolve image URLs -> preview) and image-only (upload each image client-side -> build ImageSlide[] -> preview, no function call)."
    requirement: "R010"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PptxImportModal.test.ts#PPTX happy path: idle -> uploading -> parsing -> preview, then confirm persists and emits"
        status: pass
      - kind: unit
        ref: "src/components/__tests__/PptxImportModal.test.ts#image-only path builds a preview and confirms without invoking parsePptx"
        status: pass
    human_judgment: false
  - id: D3
    description: "On confirm, the modal persists the deck via importedSlides.createDeck(orgId, { sourceFileName, section, slides }) and emits confirmed({ importId, section }) -- the new Firestore-assigned importId, not the transient upload-session id. Cancel emits cancel without creating a deck."
    requirement: "R011"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PptxImportModal.test.ts#PPTX happy path (confirm assertions) and #cancel emits cancel without creating a deck"
        status: pass
    human_judgment: false
  - id: D4
    description: "Any upload/parse failure transitions to the error step showing the friendly copy with a working retry that re-invokes the failed import; no client-side Storage delete is ever issued on any path."
    requirement: "R012"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PptxImportModal.test.ts#a rejected parse transitions to the error step with the friendly copy, offers retry, and never deletes the source"
        status: pass
    human_judgment: true
    rationale: "Full end-to-end verification (a real .pptx upload against the emulator, a real parsePptx round trip, and visual confirmation of the preview/progress UI) is deferred to 21-06's human-verify checkpoint, which drives the complete upload -> parse -> preview -> confirm flow through the running app with ImportedSlideEditor/ServiceEditorView wired in. This plan's own scope (the modal + upload util in isolation) is proven end-to-end at the mocked component-test level only."

# Metrics
duration: ~25min
completed: 2026-07-25
status: complete
---

# Phase 21 Plan 05: Client upload util + step-based PptxImportModal Summary

**pptxUpload.ts (resumable .pptx upload + direct image upload + getDownloadURL resolution) and PptxImportModal.vue (idle/uploading/parsing/preview/confirming/error step machine) delivering both the parsePptx-backed PPTX import flow and the client-only image-only import flow, proven by a 4-test Vitest suite using Vue Test Utils' Teleport testing pattern.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-25T11:51:00-04:00 (approx, first commit landed shortly after)
- **Completed:** 2026-07-25T12:03:00-04:00 (last task commit)
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 3 (all created)

## Accomplishments
- `src/utils/pptxUpload.ts` — `generateImportId()` (crypto.randomUUID, matching the codebase's existing client-id convention), `uploadPptx()` (resumable upload to `orgs/{orgId}/pptx-imports/{importId}/source.pptx` via `uploadBytesResumable`, reporting percent-complete through a callback on every `state_changed` snapshot, `createdAt` custom metadata), `uploadImage()` (single-shot `uploadBytes` under `images/{index}.{ext}` with `createdAt` metadata), and `resolveImageUrl()` (`getDownloadURL` wrapper so image display stays `storage.rules`-governed). Rejects/propagates errors rather than swallowing them.
- `src/components/PptxImportModal.vue` — a step-based modal (`idle → uploading → parsing → preview → confirming → error`) mirroring `RosterImportModal.vue`'s established UX pattern, accepting `orgId` and `section` (`ServiceSection`) props. PPTX mode uploads first, then calls `httpsCallable(functions, 'parsePptx')({ orgId, importId, storagePath })` — passing only the Storage path, never file bytes — maps the returned `(MappedTextSlide|MappedImageSlide)[]` onto `(TextSlide|ImageSlide)[]` (assigning fresh `id`/`position` client-side, since the function's mapped shapes carry neither), and resolves each image slide's path to a display URL. Image-only mode uploads each picked image directly and builds `ImageSlide[]` entirely client-side, skipping the Cloud Function call altogether. The preview step renders both slide kinds; confirm calls `importedSlides.createDeck(orgId, { sourceFileName, section, slides })` and emits `confirmed({ importId, section })` with the store's newly-assigned id; cancel emits `cancel` without persisting anything. The error step shows the friendly copy ("We couldn't read this file — try re-exporting from PowerPoint.") with a retry that re-invokes the failed import function; no delete call exists anywhere in the component.
- `src/components/__tests__/PptxImportModal.test.ts` — 4 Vitest tests: the PPTX happy path (asserting the step sequence, that `parsePptx` receives only a storage path, and that confirm persists + emits), the image-only path (asserting no `parsePptx` call), the error/retry path (asserting the friendly copy, working retry, and zero Storage-delete calls), and a cancel-path test. Established this codebase's first pattern for testing a `<Teleport to="body">` modal component (`DOMWrapper` over `document.body` + `enableAutoUnmount`), since none of the three existing Teleport-based modals (`RosterImportModal`, `CsvImportModal`, `PcImportModal`) had prior test coverage to follow.
- `npx vue-tsc --build` stays at 0 errors (confirmed both before and after all three tasks). `npx vitest run src/components/__tests__/PptxImportModal.test.ts` is 4/4 green. `npx eslint` on all three new files reports 0 errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: Storage upload helpers for .pptx and images** - `e46a9c4` (feat)
2. **Task 2: PptxImportModal step-based modal (pptx and image-only modes)** - `04caabf` (feat)
3. **Task 3: Component tests for the import modal** - `7925de4` (test)

**Plan metadata:** (this commit, following STATE/ROADMAP update)

## Files Created/Modified
- `src/utils/pptxUpload.ts` - `generateImportId`, `uploadPptx`, `uploadImage`, `resolveImageUrl` (new file)
- `src/components/PptxImportModal.vue` - step-based import modal, PPTX + image-only modes (new file)
- `src/components/__tests__/PptxImportModal.test.ts` - 4-test Vitest suite (new file)

## Decisions Made
- **`generateImportId()` is deliberately distinct from the Firestore-assigned deck id.** The client-generated UUID scopes only the Storage path for one upload session (before any deck exists to have an id); `importedSlides.createDeck()`'s own auto-generated Firestore id becomes the deck's real, permanent `importId` on confirm. Conflating the two would force choosing the deck's permanent identity before its content (slides) is even known.
- **`uploadImage` uses single-shot `uploadBytes`, not `uploadBytesResumable`.** The image-only mode's UI only needs an overall "N of M uploaded" progress signal (computed client-side after each file completes), not fine-grained per-file byte progress — resumable upload's added complexity wasn't justified for typically-small image files.
- **One friendly-error copy for all failure modes.** Both an upload failure (network) and a parse failure (corrupt/unsupported file) show the identical CONTEXT-mandated copy, since the client has no reliable way to distinguish the two causes and neither is actionable differently by the end user.
- **`lastRetry` re-runs the whole failed import function** (mirroring `RosterImportModal`'s existing pattern) rather than attempting to resume mid-upload or mid-parse — simpler and matches the only precedent in this codebase for a step-machine modal's retry semantics.

## Deviations from Plan

None - plan executed exactly as written. One implementation detail not explicit in the plan text was resolved by direct inspection of `functions/src/pptxParser.ts` (per the plan's own `read_first` guidance pointing at 21-04): the Cloud Function's `MappedTextSlide`/`MappedImageSlide` response shapes carry no `id`/`position` fields (only `contentKind` + content fields), so the modal assigns `id: crypto.randomUUID()` and `position: index` client-side when building the final `(TextSlide|ImageSlide)[]` array — consistent with `SlideBase` requiring both fields and with 21-04-SUMMARY.md's explicit note that "21-05's client-side store can persist these directly without field remapping" (referring to the content fields, not the missing base fields).

## Issues Encountered
- Vue Test Utils does not surface `<Teleport to="body">` content through the mounted component's own wrapper (`wrapper.find()` only sees teleport start/end comment markers) — this surfaced as all four tests initially failing with "Cannot call element/trigger on an empty DOMWrapper." Resolved by switching every element query to `new DOMWrapper(document.body)` (VTU's documented Teleport testing pattern) and adding `enableAutoUnmount(afterEach)` so each test's teleported DOM is cleaned out of the shared `document.body` before the next test mounts (otherwise stale nodes from earlier tests would satisfy later `find()` calls and mask real failures). This is a genuinely new pattern for this codebase — none of the three existing Teleport-based modals had a test file to establish it first.
- A handful of `vi.fn((..._args: unknown[]) => ...)` mock declarations initially tripped `@typescript-eslint/no-unused-vars` (the rest param was declared but the mock body ignored it) and separately tripped `TS2556` (spreading `unknown[]` into a zero-arg mock's call signature). Both resolved together by typing the mocks via `vi.fn<(...args: unknown[]) => ReturnType>(implementation)` — the generic type parameter declares the permissive call signature callers/spreads need, while the actual implementation function declares no parameters at all (valid in TS: a callback accepting fewer params than its declared type is compatible), eliminating the unused-var flag entirely.

## User Setup Required
None - no external service configuration required. The mandatory `.env.local` (per `CLAUDE.md`) was already present in this working tree (main checkout, not a fresh worktree); this plan ran as a sequential executor with no worktree isolation.

## Next Phase Readiness
- `PptxImportModal.vue` is ready for 21-06 to mount from `ServiceEditorView`'s "Add element" menu, passing `orgId` and the target `section` (`'pre-service'` for announcements, `'message'` for sermon, per this phase's CONTEXT). 21-06 should listen for `@confirmed="{ importId, section }"` to append a `createSlot('IMPORTED', undefined, section)` slot referencing that `importId` to `service.slots` (the modal deliberately never touches `service.slots` itself, per this plan's `key_links` constraint) and `@cancel` to simply close the modal without side effects.
- `pptxUpload.ts`'s four exports (`generateImportId`, `uploadPptx`, `uploadImage`, `resolveImageUrl`) are stable, type-checked, and already exercised indirectly through the modal's mocked test coverage — no further changes anticipated for 21-06.
- Manual/emulator end-to-end validation (a real `.pptx` file through the running app, real Storage/Functions round trip, visual confirmation of progress/preview UI) is explicitly deferred to 21-06's human-verify checkpoint, per this plan's own `<verification>` section — consistent with 21-04's identical deferral for the Cloud Function side.
- No blockers. `npx vue-tsc --build` remains at 0 errors project-wide (confirmed unchanged before/after this plan's three tasks).

---
*Phase: 21-powerpoint-import-announcements-and-sermon*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: src/utils/pptxUpload.ts, src/components/PptxImportModal.vue, src/components/__tests__/PptxImportModal.test.ts (all exist on disk)
- FOUND: e46a9c4, 04caabf, 7925de4 (all present in `git log --oneline`)
