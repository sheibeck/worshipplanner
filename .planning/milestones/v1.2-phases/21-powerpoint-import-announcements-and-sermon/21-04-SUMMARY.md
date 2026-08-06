---
phase: 21-powerpoint-import-announcements-and-sermon
plan: 04
subsystem: api
tags: [firebase-functions, onCall, officeparser, cloud-storage, vitest, pptx]

# Dependency graph
requires:
  - phase: 21-powerpoint-import-announcements-and-sermon (21-03)
    provides: functions/ Vitest harness (Node env), officeparser@^7.4.0 installed, fixture decks (mixed.pptx, corrupted.pptx, not-a-pptx.txt)
provides:
  - "parsePptx onCall Cloud Function (functions/src/index.ts) -- secured RPC that downloads a .pptx by Storage path, parses it, uploads extracted images, and returns mapped slides"
  - "mapAstToSlides + parsePptxBuffer (functions/src/pptxParser.ts) -- pure mixed-content heuristic and buffer-validation/parse/upload pipeline"
  - "15-test Vitest suite (functions/src/pptxParser.test.ts) covering the mapping heuristic, image upload path, and auth/path/membership/error guards"
affects: [21-05 (PptxImportModal + pptxUpload util calls this function via httpsCallable), 21-06 (ImportedSlideEditor / end-to-end UAT), 22 (retention sweep consumes the createdAt custom metadata written here)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onCall (not onRequest) for first-party authenticated RPC logic, alongside the existing onRequest proxy pattern in functions/src/index.ts"
    - "Handler body exported separately from the onCall wrapper (parsePptxHandler vs. parsePptx) so tests can call it directly with a fake CallableRequest, without a full Firebase Functions test harness"
    - "functions/ mirrors src/types/slide.ts's TextSlide/ImageSlide field names by hand (contentKind, body, imageUrl, altText) rather than importing, since functions/ is a standalone TS project"

key-files:
  created:
    - functions/src/pptxParser.ts
    - functions/src/pptxParser.test.ts
  modified:
    - functions/src/index.ts

key-decisions:
  - "Chose TEXT_DOMINANT_THRESHOLD = 40 characters of flattened non-image text as the mixed-content heuristic cutoff, calibrated against the real mixed.pptx fixture deck: short captions/titles run well under 40 chars, genuine body/bullet content reliably exceeds it."
  - "mapAstToSlides accepts an async ImagePathResolver callback rather than doing Storage I/O itself, keeping the mapping function pure/unit-testable while still allowing the real caller (parsePptxBuffer) to upload images before resolving each path."
  - "Real mixed.pptx fixture legitimately produces zero ImageSlides under the heuristic (every image on every slide co-occurs with substantial body text), so the image-upload path is exercised deterministically via a mocked officeparser AST rather than depending on this specific fixture's content mix."
  - "parsePptxHandler is exported as a plain async function separate from the onCall-wrapped parsePptx export, enabling direct unit testing of the auth/path/membership/error logic without firebase-functions-test."

patterns-established:
  - "Pattern: Cloud Function tests mock firebase-admin/app, /auth, /firestore, /storage and firebase-functions/params at the top of the test file so importing index.ts never touches a real Firebase project, Secret Manager, or bucket."

requirements-completed: [R010, R011, R012]

coverage:
  - id: D1
    description: "mapAstToSlides is a pure, tested function mapping an officeparser AST to ordered (text|image) native slide objects using a documented 40-char text-dominant heuristic; text-only, image-only, mixed, empty, and multi-slide order-preservation cases all pass."
    requirement: "R010"
    verification:
      - kind: unit
        ref: "functions/src/pptxParser.test.ts#mapAstToSlides (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "parsePptxBuffer validates the ZIP magic-byte signature before invoking officeparser, parses with attachment extraction/pptx fileType/notes ignored/OCR off, uploads extracted images to orgs/{orgId}/pptx-imports/{importId}/images/{n}.{ext} with createdAt custom metadata, and returns Storage paths (not signed URLs) for ImageSlide.imageUrl -- with no delete/deleteObject call anywhere."
    requirement: "R010"
    verification:
      - kind: unit
        ref: "functions/src/pptxParser.test.ts#parsePptxBuffer (5 tests, incl. corrupted.pptx/not-a-pptx.txt fixtures + real mixed.pptx end-to-end parse + mocked-AST image-upload assertion)"
        status: pass
    human_judgment: false
  - id: D3
    description: "parsePptx onCall exports a secured RPC (1GiB/120s) rejecting missing auth, a storagePath outside the caller's own orgs/{orgId}/pptx-imports/ prefix, and a non-member caller (independent Firestore organizations/{orgId}/members/{uid} check); on parse failure it throws a friendly invalid-argument HttpsError and never deletes the source; a valid member request over the real mixed.pptx fixture returns a non-empty slides array."
    requirement: "R011"
    verification:
      - kind: unit
        ref: "functions/src/pptxParser.test.ts#parsePptxHandler (parsePptx onCall) (5 tests: unauthenticated, bad-prefix, non-member, corrupted-download friendly error, happy-path over mixed.pptx)"
        status: pass
    human_judgment: true
    rationale: "Full end-to-end verification (real Firebase Auth token, real org membership doc, real Storage upload/download against the emulator, and visual confirmation that the source .pptx survives both success and failure in the actual bucket) is deferred to 21-06's human-verify checkpoint, which drives the complete upload -> parse -> preview flow through the running app. This plan's own scope is proven end-to-end at the unit/mocked-integration level only."

# Metrics
duration: ~23min
completed: 2026-07-25
status: complete
---

# Phase 21 Plan 04: parsePptx onCall Function + mapAstToSlides Mapping Summary

**Secured `parsePptx` onCall Cloud Function plus a pure `mapAstToSlides` mixed-content heuristic (40-char text-dominance threshold) that turns a real officeparser AST from the `mixed.pptx` fixture into native text/image slides, with org-membership re-verification, path validation, and a never-delete-on-failure guarantee proven by a 15-test Vitest suite.**

## Performance

- **Duration:** ~23 min (task work; excludes upstream research/context reading)
- **Started:** 2026-07-25T11:16:53-04:00 (approx, first commit landed 11:28:30)
- **Completed:** 2026-07-25T11:39:43-04:00 (last task commit)
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `mapAstToSlides` (`functions/src/pptxParser.ts`) implements and documents an explicit mixed-content heuristic: a slide's flattened non-image text must exceed 40 characters to win as a `TextSlide` (title taken from the first heading child, if any); otherwise a slide with image children maps to one `ImageSlide` per image via an injectable async resolver; a slide with neither is skipped. AST order is preserved end to end.
- `parsePptxBuffer` validates the leading ZIP magic bytes (`PK`) before ever invoking `officeparser` (rejecting corrupted/mis-declared files immediately), parses with `extractAttachments: true, fileType: 'pptx', ignoreNotes: true` and OCR never enabled, and uploads each extracted image to `orgs/{orgId}/pptx-imports/{importId}/images/{n}.{ext}` with `createdAt` custom metadata for Phase 22's future retention sweep. `ImageSlide.imageUrl` always holds the Storage **path**, never a signed URL.
- `parsePptx` (`functions/src/index.ts`) is a new `onCall` v2 export (1GiB memory, 120s timeout) alongside the existing `onRequest` proxy `api`. It rejects missing auth, a `storagePath` outside the caller's own `orgs/{orgId}/pptx-imports/` prefix, and a caller who fails an independent Firestore `organizations/{orgId}/members/{uid}` membership check -- defense in depth beyond `storage.rules`, never trusting the client-declared `orgId` alone. On any parse failure it throws a friendly `invalid-argument` `HttpsError` ("We couldn't read this file -- try re-exporting from PowerPoint.") and never deletes the source object, on any path.
- 15 Vitest tests across `mapAstToSlides` (5), `parsePptxBuffer` (5), and `parsePptxHandler` (5) all pass, including two real end-to-end parses of the genuine `mixed.pptx` fixture, the two error-path fixtures (`corrupted.pptx`, `not-a-pptx.txt`), and a mocked-AST test that deterministically proves the image-upload/metadata path since `mixed.pptx` itself never triggers an `ImageSlide` under the heuristic.
- `cd functions && npx vitest run` is fully green (15/15) and `npm run build` (`tsc`) compiles cleanly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement mapAstToSlides with an explicit mixed-content heuristic** - `944d6eb` (feat)
2. **Task 2: Implement parsePptxBuffer — validate, parse via officeparser, extract and upload images** - `18a9ae4` (feat)
3. **Task 3: Export the parsePptx onCall function and cover the auth/path/error paths** - `622417a` (feat)

**Plan metadata:** (this commit, following STATE/ROADMAP update)

## Files Created/Modified
- `functions/src/pptxParser.ts` - `mapAstToSlides` (pure heuristic mapping), `parsePptxBuffer` (validate/parse/upload), `PptxParseError`, mirrored `MappedTextSlide`/`MappedImageSlide` shapes
- `functions/src/pptxParser.test.ts` - 15-test Vitest suite: `mapAstToSlides` unit tests, `parsePptxBuffer` tests (mocking `firebase-admin/storage`), `parsePptxHandler` tests (mocking `firebase-admin/app`/`auth`/`firestore` and `firebase-functions/params`)
- `functions/src/index.ts` - added `parsePptxHandler` + `parsePptx` onCall export alongside the existing `api` onRequest export

## Decisions Made
- **40-character text-dominant threshold**, chosen against the real `mixed.pptx` fixture deck rather than an arbitrary guess -- observed short captions/titles run well under this value while genuine body/bullet content reliably exceeds it. Documented directly in a code comment on `TEXT_DOMINANT_THRESHOLD`.
- **Async `ImagePathResolver` seam**: `mapAstToSlides` stays "pure" in the sense of never calling `officeparser` or Storage directly, but accepts an async resolver so the real image-upload side effect lives entirely in `parsePptxBuffer`'s closure, not the mapping function itself.
- **Image-upload path tested via a mocked officeparser AST**, not solely the real `mixed.pptx` fixture, because that specific real deck's images always co-occur with substantial slide text and therefore never survive the dominance heuristic as standalone `ImageSlide`s -- a legitimate heuristic outcome, not a bug, but one that would leave the upload/metadata code path unverified without a synthetic case.
- **`parsePptxHandler` exported separately from the `onCall`-wrapped `parsePptx`** so the auth/path/membership/error logic is directly unit-testable with a fake `CallableRequest`, avoiding a dependency on `firebase-functions-test` (not installed, would have been a new devDependency for one plan).

## Deviations from Plan

None - plan executed exactly as written. The plan's own read_first guidance already anticipated needing to re-confirm officeparser's exact AST field names against the installed version's compiled types rather than trusting the README summary in 21-RESEARCH.md; this was done via direct inspection of `node_modules/officeparser/dist/types.d.ts` and a live parse of the real `mixed.pptx` fixture before writing `mapAstToSlides`, confirming: slide nodes carry no own `.text` (only `.children`), image nodes are always direct children of a slide with `metadata.attachmentName`/`altText`, and `ast.attachments[]` entries carry `{ data (base64), mimeType, name, extension }` -- all matching the plan's expectations, with the one refinement that officeparser's config option is `fileType` (confirmed present in the installed version, matching 21-RESEARCH.md Pattern 3 exactly).

## Issues Encountered
- TypeScript's "weak type" detection initially rejected passing the real `OfficeParserAST` (whose per-node `metadata` field is a large discriminated union like `SlideMetadata | ImageMetadata | ...`) into `mapAstToSlides`'s intentionally loose, test-friendly `MinimalOfficeAst` parameter type, because the two metadata shapes share no properties in common for some node types. Resolved with a documented, narrow `as unknown as MinimalOfficeAst` cast at the single production call site inside `parsePptxBuffer` (the fields the function actually reads -- `type`/`text`/`children`/`metadata.attachmentName`/`metadata.altText` -- are all genuinely present on the real AST at runtime, confirmed via a live parse of `mixed.pptx` during implementation).
- The real `mixed.pptx` fixture never produces an `ImageSlide` under the 40-char heuristic (every image-bearing slide in that deck also carries substantial body text). This is documented in both the source comment and the test suite, and compensated for by testing the image-upload/metadata path against a deterministic mocked `officeparser` AST instead.

## User Setup Required
None - no external service configuration required. (Firebase project credentials, Storage bucket, and Firestore are the existing project's own infra; nothing new to provision for this plan. The mandatory `.env.local` per `CLAUDE.md` was already present in this working tree, not a fresh worktree.)

## Next Phase Readiness
- `parsePptx` is ready for 21-05's `PptxImportModal`/`pptxUpload` util to call via `httpsCallable(functions, 'parsePptx')({ orgId, importId, storagePath })`.
- The response shape `{ slides: (MappedTextSlide | MappedImageSlide)[] }` matches `src/types/slide.ts`'s `TextSlide`/`ImageSlide` field names exactly (`contentKind`, `title?`, `body`; `contentKind`, `imageUrl`, `altText?`) -- 21-05's client-side store can persist these directly without field remapping.
- Extracted image `imageUrl` values are Storage **paths** (e.g. `orgs/{orgId}/pptx-imports/{importId}/images/0.png`), consistent with 21-RESEARCH.md Open Question 2's recommendation -- 21-05's client must resolve them via `getDownloadURL(ref(storage, path))` under `storage.rules`' org gate, not treat them as ready-to-use URLs directly.
- Uploaded images already carry `createdAt` custom metadata, so Phase 22's retention sweep can consume them without a follow-up migration.
- Blocker/follow-up carried from 21-03: `text-only.pptx` and `image-only.pptx` fixtures are still deferred (human-export needed) -- not a blocker for this plan (covered via synthetic AST unit tests + the mocked-AST image-upload test), but 21-06's end-to-end human-verify checkpoint would benefit from having them if edge-case decks surface issues during manual UAT.

---
*Phase: 21-powerpoint-import-announcements-and-sermon*
*Completed: 2026-07-25*

## Self-Check: PASSED

All created/modified files verified present on disk; all three task commit hashes (`944d6eb`, `18a9ae4`, `622417a`) verified in `git log --oneline --all`.
