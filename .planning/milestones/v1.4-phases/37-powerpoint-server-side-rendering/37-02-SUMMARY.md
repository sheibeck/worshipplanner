---
phase: 37-powerpoint-server-side-rendering
plan: 02
subsystem: infra
tags: [libreoffice, poppler, express, google-cloud-storage, vitest, cloud-run]

# Dependency graph
requires:
  - phase: 37-01
    provides: "render-service/ scaffold (package.json, tsconfig, vitest.config, Dockerfile, font-policy gate) and the placeholder.ts flagged for deletion once real source lands"
provides:
  - "render-service/src/render.ts — renderPptxToImages: soffice -> pdftoppm orchestration, independent org-prefix guard, numeric page ordering, 4-digit zero-padded destination naming"
  - "render-service/src/server.ts + main.ts — the Cloud Run service's single POST /render route, socket-free and directly unit-testable, plus the one module that binds a port"
  - "39 total render-service tests (15 dockerfile + 15 render + 9 server), all passing, execFile fully mocked"
affects: [37-03, 37-04, 37-05, 37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() for module-scope-side-effect mocks: render.ts calls `new Storage()` at import time, so render.test.ts's execFile/fs/Storage mocks must be constructed via vi.hoisted() rather than plain top-level consts, or the vi.mock factories hit a TDZ ReferenceError"
    - "Env-var reads deferred to inside the request handler (requiredBucketName()), never at module scope, so tests can set process.env per-case without needing to re-import the module"
    - "Numeric-parse-then-sort ordering: never trust readdir() output order or Array.prototype.sort() on filename strings for anything that must preserve document page order"

key-files:
  created:
    - render-service/src/render.ts
    - render-service/src/render.test.ts
    - render-service/src/server.ts
    - render-service/src/main.ts
    - render-service/src/server.test.ts
  modified: []

key-decisions:
  - "Added requiredBucketName() reading process.env.STORAGE_BUCKET lazily inside renderPptxToImages, not as a module-scope const — the plain @google-cloud/storage client's Storage#bucket() requires an explicit bucket name argument (unlike firebase-admin's getStorage().bucket(), which resolves an app-configured default with no argument). This is a new required container env var not listed in 37-01/37-02's original artifact table; documented here for 37-06's DEPLOY.md."
  - "renderedObjectName/pageNumberFromOutputName are the single source of truth for page ordering — the upload loop sorts NUMERICALLY on the parsed page number, never Array.prototype.sort() on the filename string and never array index, closing the exact bug in 37-RESEARCH.md's own reviewable sketch (which used `.sort()` and `${destPrefix}${i}.png`)."

patterns-established:
  - "createApp(render = renderPptxToImages) dependency-injects the render function so server.test.ts never imports the real render.ts module or its Storage/child_process side effects — only render.test.ts touches those mocks."

requirements-completed: [R062]

coverage:
  - id: D1
    description: "renderPptxToImages downloads the source deck, runs soffice then pdftoppm (execFile mocked, real binaries never invoked), and uploads one PNG per page under orgs/{orgId}/pptx-imports/{importId}/rendered/"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "render-service/src/render.test.ts — 'soffice/pdftoppm argv' describe block, cases 3/4 + the 'never actually invoked' exactly-twice assertion"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rendered image ordering is derived from the renderer's own numeric page numbering (pageNumberFromOutputName), never from Storage/readdir listing order or array index, and destination names are 4-digit zero-padded so a Storage listing sorts identically to render order"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "render-service/src/render.test.ts — case 5 (12-page lexically-hostile input: page-10.png before page-2.png), case 6 (pdftoppm's own padding), case 9 (destination prefix)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A zero-page render throws rather than reporting success"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "render-service/src/render.test.ts — case 8"
        status: pass
    human_judgment: false
  - id: D4
    description: "The render service independently re-checks storagePath sits under the caller's own orgs/{orgId}/pptx-imports/ prefix, even though Cloud Run IAM already authenticated the caller"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "render-service/src/render.test.ts — cases 1/2 (wrong prefix, cross-org), plus the PPTX_IMPORT_PATH_GUARD unit tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "soffice runs with a per-request-unique UserInstallation profile under the request's own mkdtemp directory, both external commands carry explicit timeouts, and the working directory is always cleaned up (including on failure)"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "render-service/src/render.test.ts — case 3 (profile path + 180000ms timeout), case 4 (120000ms timeout), case 10 (rm called even when soffice rejects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The single POST /render route validates its body, maps outcomes to 200/400/500, and never leaks the underlying error message/stack in a 500 response"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "render-service/src/server.test.ts — 9 tests, including the 500-body-does-not-contain-error-text assertion"
        status: pass
    human_judgment: false
  - id: D7
    description: "Fidelity of a real rendered slide against a real multi-font source deck (requires an actual container build + soffice/pdftoppm execution) — deliberately out of reach this run"
    verification: []
    human_judgment: true
    rationale: "The hard constraint for this plan is BUILD BUT DO NOT DEPLOY: execFile is mocked in every test and the real soffice/pdftoppm binaries are never invoked. Visual fidelity can only be confirmed once the owner deploys the container (37-06 hands off the exact gcloud run deploy command); 37-RESEARCH.md's own Open Question 1 already flags this as unverifiable without deploying."

duration: 32min
completed: 2026-08-03
status: complete
---

# Phase 37 Plan 02: Render Service (soffice/pdftoppm orchestration + POST /render route) Summary

**LibreOffice→PDF→PNG render pipeline with a numeric (never lexical) page-ordering guarantee and a single validated `/render` route, all proven by 39 mocked tests — no container built, no real `soffice`/`pdftoppm` invoked, nothing deployed.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-08-03T16:04:25Z (immediately after 37-01 completed)
- **Completed:** 2026-08-03T16:36:29Z
- **Tasks:** 3 (all auto)
- **Files modified:** 5 created (render.ts, render.test.ts, server.ts, main.ts, server.test.ts), 1 deleted (placeholder.ts)

## Accomplishments

- `render-service/src/render.ts` — `renderPptxToImages` downloads the source `.pptx`, converts it with `soffice --headless` (per-request-unique `UserInstallation` profile inside its own `mkdtemp` working directory, `180_000ms` timeout), rasterizes with `pdftoppm -png -r 150` (`120_000ms` timeout), and uploads each page to `orgs/{orgId}/pptx-imports/{importId}/rendered/`. `execFile` is wrapped via `promisify` at module scope specifically so tests can mock `node:child_process` wholesale.
- ★ **The ordering bug is fixed and load-bearing-tested.** `pageNumberFromOutputName` parses the page number numerically out of pdftoppm's own output filename (handling both its narrow and wide zero-padding); the upload loop sorts on that parsed integer, never on `Array.prototype.sort()` of the filename string and never on array index. `renderedObjectName` writes 4-digit zero-padded destinations (`page-0001.png` … `page-0012.png`) so a Storage listing sorts identically to render order. This directly corrects 37-RESEARCH.md's own reviewable sketch, which used a plain `.sort()` and named destinations `${i}.png` by array index — exactly the bug that corrupts at ten-plus slides (`page-1, page-10, page-2`).
- `PPTX_IMPORT_PATH_GUARD` independently re-checks `storagePath` sits under the caller's own `orgs/{orgId}/pptx-imports/` prefix, mirroring `functions/src/index.ts`'s established guard pattern — Cloud Run IAM authenticates WHO called, this checks WHAT they asked to read.
- A zero-page render throws (`"render produced no pages"`) rather than returning `{ renderedCount: 0 }` as a success, so the bridging function's completeness check can never mistake an empty render for a complete one.
- `render-service/src/server.ts` — `validateRenderBody`/`handleRenderRequest`/`createApp` are all socket-free, directly unit-testable functions (no `supertest`, no bound port). `createApp` never calls `listen()`. 500 responses return a generic `{ error: "render failed" }` body and never leak the underlying error's message/stack — verified by a test that asserts the JSON-stringified payload does not contain a planted secret-looking string from the thrown error.
- `render-service/src/main.ts` — the sole module that binds a port (`process.env.PORT || 8080`), matching the Dockerfile's `CMD ["node", "lib/main.js"]`. Confirmed by compiling with `tsc` and checking `lib/main.js` exists, then removing the generated `lib/` directory.
- Deleted `render-service/src/placeholder.ts` (37-01's `TS18003` workaround) now that real, non-test source files exist in `src/`.
- **39 render-service tests total, all passing:** 15 (dockerfile, from 37-01, unchanged) + 15 (render.ts) + 9 (server.ts). `functions/` remains at 42/42 passing, unaffected — this plan touched nothing under `functions/`.

## Task Commits

Each task was committed atomically:

1. **Task 1: render.ts — soffice/pdftoppm orchestration with numeric page ordering and zero-padded destinations** — `f7b3bd0` (feat)
2. **Task 2: render.test.ts — argv, guard, ordering and zero-page assertions with execFile mocked** — `846eaec` (test)
3. **Task 3: server.ts, main.ts and server.test.ts — the single POST /render route** — `3b0c13f` (feat)

**Plan metadata commit:** pending (this commit, made after this SUMMARY is written)

## Files Created/Modified

- `render-service/src/render.ts` — `renderPptxToImages`, `RenderRequest`, `RenderResult`, `PPTX_IMPORT_PATH_GUARD`, `renderedPrefix`, `renderedObjectName`, `pageNumberFromOutputName`, `RENDER_DPI` (150), `SOFFICE_TIMEOUT_MS` (180000), `PDFTOPPM_TIMEOUT_MS` (120000), `RENDERED_PAGE_PAD` (4)
- `render-service/src/render.test.ts` — 15 tests across 5 describe blocks (path guard, argv, ordering, cleanup/return-shape, unit-level helper tests)
- `render-service/src/server.ts` — `BadRequestError`, `validateRenderBody`, `handleRenderRequest`, `createApp`
- `render-service/src/main.ts` — container entrypoint
- `render-service/src/server.test.ts` — 9 tests against `validateRenderBody`/`handleRenderRequest` with a stub render function
- `render-service/src/placeholder.ts` — deleted (no longer needed)

## Decisions Made

- **`STORAGE_BUCKET` env var added, read lazily inside the handler.** `@google-cloud/storage`'s `Storage#bucket()` requires an explicit bucket-name argument (the plain client has no admin-app default bucket to fall back on, unlike `firebase-admin/storage`'s `getStorage().bucket()`). Discovered as a Rule 3 blocking-issue fix while writing Task 1 (`tsc` rejected a zero-arg `bucket()` call). Reading it at module scope also broke testability (the value would be frozen before any test's `beforeEach` could set `process.env.STORAGE_BUCKET`), so `requiredBucketName()` reads it fresh inside `renderPptxToImages` and throws a clear error if unset. **This is a new required container env var not in 37-01/37-02's original artifact table — flagging for 37-06's `DEPLOY.md`.**
- **Ordering fix genuinely verified, not just green by construction.** Per Task 2's acceptance criteria, `RENDERED_PAGE_PAD` was temporarily changed from `4` to `1`, the suite was re-run (4 tests failed: the lexical-hostile ordering test, the pdftoppm-padding test, the non-page-files test, and the `renderedObjectName` unit test — see below for the actual failure output), then the constant was restored to `4` and the full suite (39/39) confirmed green again. This confirms the ordering gate is load-bearing, not trivially passing.
- **`vi.hoisted()` required for the render.test.ts mocks.** `render.ts` calls `new Storage()` at module scope (evaluated the instant the module is imported, before any `beforeEach` runs), so the `vi.mock("@google-cloud/storage", ...)` factory must close over already-initialized mock functions. Plain top-level `const` declarations hit a temporal-dead-zone `ReferenceError` because ES module imports (which trigger the mocked-module factory) all execute before any of the file's own top-level statements. Wrapping the shared mocks in `vi.hoisted(() => {...})` resolved this.

## Deliberate-Failure Confirmation (Task 2 acceptance criterion)

Per the plan's explicit instruction, confirmed the ordering test is load-bearing rather than trivially green:

1. Changed `RENDERED_PAGE_PAD` from `4` to `1` in `render.ts`.
2. Re-ran `npx vitest run src/render.test.ts` — **4 of 15 tests failed**:
   - `case 5: lexically-hostile 12-page input uploads in ascending numeric page order with 4-digit zero-padded destinations` (destinations were `page-1.png` … `page-12.png`, not zero-padded)
   - `case 6: pdftoppm's OWN zero-padded output ... produces the identical 12 destinations`
   - `case 7: non-page files in the working directory are ignored ...` (destination mismatch: `page-1.png` vs expected `page-0001.png`)
   - `renderedObjectName zero-pads to RENDERED_PAGE_PAD digits` (unit test asserting `RENDERED_PAGE_PAD === 4`)
3. Restored `RENDERED_PAGE_PAD` to `4`.
4. Re-ran the suite — all 15 tests passed again, and the full `npx vitest run` (39 tests across all 3 files) passed.

This confirms case 5 specifically would catch a regression that reintroduces the lexical-sort ordering bug, not just a cosmetically different but equally-passing assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `STORAGE_BUCKET` env var / `requiredBucketName()` — `Storage#bucket()` requires an explicit name**
- **Found during:** Task 1's verification step (`npx tsc --noEmit`)
- **Issue:** `TS2554: Expected 1-2 arguments, but got 0` on `storage.bucket()`. 37-RESEARCH.md's own reviewable sketch called `storage.bucket()` with zero arguments (copying the `firebase-admin/storage` convention this codebase uses elsewhere), but the plain `@google-cloud/storage` client's `Storage#bucket(name: string, options?)` has no default-bucket overload — a bucket name is mandatory.
- **Fix:** Added `requiredBucketName()`, reading `process.env.STORAGE_BUCKET` lazily (inside `renderPptxToImages`, not at module scope) and throwing a clear error if unset.
- **Files modified:** `render-service/src/render.ts`
- **Verification:** `cd render-service && npx tsc --noEmit` exits 0; all 15 `render.test.ts` tests set `process.env.STORAGE_BUCKET = "test-bucket"` in `beforeEach` and pass.
- **Committed in:** `f7b3bd0` (Task 1 commit; the lazy-read refinement landed in `846eaec`, Task 2's commit, once the module-scope-freeze problem surfaced while writing tests)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking compile/testability issue, not present in the plan's own text but necessitated by the actual `@google-cloud/storage` API surface, which differs from `firebase-admin/storage`'s).
**Impact on plan:** Adds one new required container env var (`STORAGE_BUCKET`) not listed in the phase's original "Artifacts this phase produces" table. No scope creep beyond what's needed for `render.ts` to compile and be testable — flagged here explicitly for 37-06's `DEPLOY.md` to include in the `gcloud run deploy --set-env-vars` list.

## Issues Encountered

- Two test-portability fixes made while authoring `render.test.ts` on this Windows development machine: (a) the `UserInstallation` profile-path assertion was changed from a substring-match on the mocked working directory (which used forward slashes, colliding with `path.join`'s backslash output on Windows) to a substring-match on `"lo-profile"` instead; (b) the `pdftoppm` source-path assertion now builds its expected argument via `path.join(WORK_DIR, "source.pdf")` (same `node:path` module the implementation uses) rather than a hand-rolled slash-replacement. Neither changes what is being tested — both still assert the exact same argv shape — this is purely making the assertions platform-agnostic.

## User Setup Required

None — no external service configuration required this run. `.env.local` was not touched. (37-06's `DEPLOY.md` will need to document `STORAGE_BUCKET` as a required Cloud Run env var at actual deploy time — see Deviations above.)

## Threat Flags

None beyond what this plan's own `<threat_model>` already covers (T-37-04 through T-37-08, all mitigated and tested as described in `coverage` above). The new `STORAGE_BUCKET` env var is configuration, not new attack surface — it does not change what paths the service can read/write (still gated by `PPTX_IMPORT_PATH_GUARD` and the `rendered/` destination prefix).

## Next Phase Readiness

- **Confirmed: nothing was deployed or built as a container this run.** No `gcloud`, `docker build`, `docker push`, or `firebase deploy` command was executed. `git log` for this plan's three commits shows only file authoring, `npx tsc --noEmit`, and `npx vitest run` invocations.
- **Confirmed: the real `soffice`/`pdftoppm` binaries were never invoked.** Every test mocks `node:child_process`'s `execFile`; one test in `render.test.ts` (`"real soffice/pdftoppm are never actually invoked"`) structurally asserts the mock was called exactly twice per successful run, and this suite runs cleanly on this Windows development machine, which has neither LibreOffice nor Poppler installed.
- **The 12-page ordering test genuinely pins the fix** — see "Deliberate-Failure Confirmation" above: removing the zero-padding fails 4 of 15 tests, restoring it passes all 15.
- **Wave 3 needs:** 37-01's scaffold + this plan's `render.ts`/`server.ts`/`main.ts` together give Wave 3 (37-04, if it depends on this) a complete, type-clean, fully-tested `render-service/` it can reference from the bridging function's invocation contract (`RenderRequest`/`RenderResult` shapes, the `/render` route's request/response contract). Note the **new `STORAGE_BUCKET` env var requirement** for the eventual `gcloud run deploy --set-env-vars` command (37-06 owns assembling that).
- **R062 requirement status intentionally left untouched.** Per this plan's explicit instruction, `requirements mark-complete R062` was NOT run — R062 remains `[ ]` in `.planning/REQUIREMENTS.md` with its existing "In Progress" note; 37-06 owns marking it complete.

---
*Phase: 37-powerpoint-server-side-rendering*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 5 created files verified present on disk; `placeholder.ts` confirmed deleted; all three task commits (`f7b3bd0`, `846eaec`, `3b0c13f`) verified present in `git log`.
