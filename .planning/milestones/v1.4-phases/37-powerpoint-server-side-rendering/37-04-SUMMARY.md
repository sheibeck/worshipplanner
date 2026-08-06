---
phase: 37-powerpoint-server-side-rendering
plan: 04
subsystem: api
tags: [firebase-functions, firestore, cloud-storage, onDocumentCreated, completeness-check]

# Dependency graph
requires:
  - phase: 37-03
    provides: "invokeRenderService (the IAM-authenticated Cloud Run seam), pptxRenderDocRef/PptxRenderDoc/PptxRenderStatus (the queue doc this plan's trigger consumes)"
  - phase: 37-02
    provides: "render-service's renderedPrefix/renderedObjectName naming contract (orgs/{orgId}/pptx-imports/{importId}/rendered/page-NNNN.png, 4-digit zero-padded) that this plan's independent Storage recount must match exactly"
provides:
  - "functions/src/index.ts — PPTX_RENDER_SERVICE_URL (defineString, empty default), renderedPrefixFor, RENDERED_OBJECT_NAME, RenderOutcome, requestPptxRenderHandler, requestPptxRender (onDocumentCreated trigger)"
  - "The completeness check: status flips to ready ONLY when the renderer's self-reported count, an independent Storage getFiles() recount, and a contiguous 1..N page-number sequence all agree"
  - "11 tests in a new requestPptxRenderHandler describe block, plus a regex + behavioural MEDIA_PATH_GUARD regression naming the rendered/ path specifically"
affects: [37-05, 37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-conjunct completeness gate (positive-count guard, reported-vs-actual equality, contiguity) rather than count-only agreement -- closes the exact partial-render trap a naive count check would miss"
    - "Exported-handler-plus-thin-onDocumentCreated-wrapper split, mirroring parsePptxHandler/parsePptx and cleanupExpiredMediaHandler/cleanupExpiredMedia so the trigger body is directly unit-testable"
    - "defineString's mocked value() reads a per-test module-level variable (fakeRenderServiceUrl) so each test case can set/clear the render service URL independently without re-importing the module"

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts
    - functions/src/pptxParser.test.ts

key-decisions:
  - "The 'never reference parsePptxBuffer/MappedSlide' constraint's explanatory comment is placed in the JSDoc ABOVE the function signature, not inside the sliced handler-body region Task 2's source-inspection test checks -- mirrors parsePptxHandler's own pre-signature security-contract comment (case 6b's existing pattern), so the trap-1 explanation can use those exact terms without breaking the regex it is itself pinning."
  - "pptxParser.test.ts's firebase-functions/params mock needed defineString added (Rule 1 fix) -- it imports parsePptxHandler from ./index, and index.ts now calls defineString at module scope for PPTX_RENDER_SERVICE_URL, so importing index.ts without that mock export throws before any of pptxParser.test.ts's own tests can run."

requirements-completed: []  # R062 intentionally NOT marked complete -- 37-06 owns it per this plan's explicit constraint.

coverage:
  - id: D1
    description: "requestPptxRenderHandler flips status to ready only when the renderer's reported count, an independent Storage recount, and a contiguous 1..N page sequence all agree; every disagreement resolves to failed with a distinguishable failureReason"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — 'requestPptxRenderHandler' describe block, cases 1, 2, 3, 4, 6, 7, 8, 9, 10, 11 (11 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The completeness check never derives the expected page count from parsePptxBuffer's MappedSlide[] length (trap 1) -- pinned by both a behavioural test (renderer reports 6, the slide-count heuristic would read 4, outcome is still ready) and a source-inspection assertion over the handler's exact body region"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — case 5: '★ trap 1 -- the parser's slide count is never consulted'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The contiguity conjunct is load-bearing, not decorative -- a page-number gap (pages 1, 2, 4 against a reported count of 3) fails even though the count matches"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — case 4: '★ failed on a page-number gap even when the counts match'"
        status: pass
    human_judgment: false
  - id: D4
    description: "An unconfigured PPTX_RENDER_SERVICE_URL marks the render failed with an explicit reason and never invokes anything -- it has no branch that can reach ready"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — case 6: 'unconfigured service URL never invokes the render service and cannot reach ready'"
        status: pass
    human_judgment: false
  - id: D5
    description: "MEDIA_PATH_GUARD does not match a rendered/ path (regex regression naming the exact new path), and cleanupExpiredMediaHandler never deletes a rendered/ page even 60 days old with cleanup explicitly enabled -- the guard rejects it before the age check is reached"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — 'MEDIA_PATH_GUARD' case 'R062: does not match the new rendered/ path shape', and 'cleanupExpiredMediaHandler' case 'R062: never deletes a rendered/ page...'"
        status: pass
    human_judgment: false

duration: ~55min (task work) + verification/investigation pass
completed: 2026-08-03
status: complete
---

# Phase 37 Plan 04: The Completeness Check Summary

**`requestPptxRenderHandler` gates a deck's ready flip on three independent agreements — a positive Storage recount, a reported-vs-actual equality, and a contiguous 1..N page sequence — never on the render service's self-report alone and never on the parser's structurally-decoupled slide count, proven by 11 new tests plus two deliberate-failure confirmations that show the gate's two sharpest conjuncts are genuinely load-bearing.**

## Performance

- **Duration:** ~55 min of implementation/test-authoring, plus a verification pass investigating an unrelated root-workspace test-contamination discovery (documented, not fixed)
- **Started:** ~2026-08-03T16:19:00Z (immediately after 37-03)
- **Completed:** 2026-08-03T17:53:00Z
- **Tasks:** 3 (all auto)
- **Files modified:** 3 (`functions/src/index.ts`, `functions/src/index.test.ts`, `functions/src/pptxParser.test.ts`)

## Accomplishments

- `functions/src/index.ts` — `PPTX_RENDER_SERVICE_URL` (`defineString`, empty default), `renderedPrefixFor`, `RENDERED_OBJECT_NAME` (`/^page-(\d{4})\.png$/`, matching `render-service/src/render.ts`'s `renderedObjectName` exactly), `RenderOutcome`, `requestPptxRenderHandler`, and the `requestPptxRender` `onDocumentCreated` trigger wrapping it — the same exported-handler-plus-thin-wrapper split `parsePptxHandler`/`parsePptx` and `cleanupExpiredMediaHandler`/`cleanupExpiredMedia` already use.
- **The completeness gate is exactly three conjuncts:** `actualCount > 0 && actualCount === reportedCount && contiguous`. `actualCount` and `contiguous` come from an **independent** `getStorage().bucket().getFiles({ prefix: renderedPrefixFor(orgId, importId) })` listing — never from the render service's response alone — mirroring `parsePptxHandler`'s own "never trust the caller alone" org-membership re-check pattern. Only object basenames matching `RENDERED_OBJECT_NAME` are counted, so a stray upload (e.g. a thumbnail) can never inflate the count.
- **Trap 1 is structurally closed, not just documented:** `requestPptxRenderHandler`'s body (the exact region from its `export async function` signature to the `requestPptxRender` trigger's `export const`) contains zero references to `parsePptxBuffer`, `MappedSlide`, or `slides` — confirmed by source-inspection in case 5, which pairs it with a behavioural test where the parser's heuristic count would read 4 while the renderer reports 6 real objects, and the outcome is still `ready`.
- Every failure path writes a distinguishable `failureReason` (`missing-render-doc`, `missing-storage-path`, `render-service-not-configured`, `render-service-error`, `incomplete-render`) via a merge write, so a later investigation can distinguish causes without re-deriving them.
- Unconfigured `PPTX_RENDER_SERVICE_URL` returns before `invokeRenderService` is ever called — there is no code path from an empty URL to `ready`.
- 11 new tests in a `requestPptxRenderHandler` describe block in `functions/src/index.test.ts`, covering: full agreement (case 1), count mismatch (case 2), zero-page render with an untouched-`storagePath` assertion (case 3), the page-gap-despite-matching-counts trap (case 4), the parser-count trap with source inspection (case 5), unconfigured URL (case 6), invoker rejection (case 7), stray-object rejection (case 8), exact-prefix assertion (case 9), missing render doc (case 10), and order-independent zero-padded recount across a deliberately hostile 12-page listing order (case 11).
- `MEDIA_PATH_GUARD` regression suite extended with a test that literally contains `/rendered/page-0001.png` and asserts the guard does not match it, plus a behavioural companion proving `cleanupExpiredMediaHandler` never deletes a 60-day-old `rendered/` page even with `MEDIA_CLEANUP_ENABLED="true"` — the guard rejects it before the age check is reached. `cleanupExpiredMediaHandler`, `MEDIA_PATH_GUARD`, and `RETENTION_DAYS` themselves are byte-for-byte unchanged (`git diff` confirms zero lines touched in that section across all three task commits).
- `functions/` suite: 55/55 passing (`cd functions && npx vitest run`). `cd functions && npx tsc --noEmit` exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: requestPptxRenderHandler — invoke, independently recount, and gate the ready flip** — `6dcf3e7` (feat)
2. **Task 2: The completeness-check suite — ready only on full agreement, failed on every partial outcome** — `b61ead1` (test)
3. **Task 3: MEDIA_PATH_GUARD regression naming rendered/ specifically, and the functions suite gate** — `d952a8a` (test)

**Plan metadata commit:** pending (made after this SUMMARY is written)

## Files Created/Modified

- `functions/src/index.ts` — added `PPTX_RENDER_SERVICE_URL`, `renderedPrefixFor`, `RENDERED_OBJECT_NAME`, `RenderOutcome`, `requestPptxRenderHandler`, `requestPptxRender`; imported `onDocumentCreated` and `defineString`; imported `invokeRenderService` from `./renderInvoker`. `cleanupExpiredMediaHandler`, `MEDIA_PATH_GUARD`, `RETENTION_DAYS`, `parsePptxHandler`, `parsePptx`, and the `api` proxy are unchanged (`git diff` confirms).
- `functions/src/index.test.ts` — new `requestPptxRenderHandler` describe block (11 tests), one new `MEDIA_PATH_GUARD` regex regression, one new behavioural `cleanupExpiredMediaHandler` regression, and `defineString`/`onDocumentCreated` added to the file's mocks.
- `functions/src/pptxParser.test.ts` — one-line fix: added `defineString` to its own `firebase-functions/params` mock (see Deviations).

## Decisions Made

- **The trap-1 explanatory comment sits above the function signature, not inside the tested body region.** Task 1's action instructed adding a comment "at the top of the handler" explaining why `parsePptxBuffer`/`MappedSlide` must never be referenced — but that explanation necessarily uses those exact terms. Placing it in the JSDoc immediately preceding `export async function requestPptxRenderHandler(` (rather than inside the function body) keeps it outside the region Task 2's source-inspection test slices, exactly mirroring how `parsePptxHandler`'s own pre-signature security-contract comment is excluded from case 6b's existing `invokeRenderService`-absence check. Confirmed by directly running the slice-and-match logic in a one-off Node script before writing the test.
- **`pptxParser.test.ts` needed a one-line mock fix.** It imports `parsePptxHandler` from `./index`, and `index.ts` now calls `defineString(...)` at module scope. Without `defineString` in that file's own `firebase-functions/params` mock, importing `./index` threw immediately and failed the entire suite with 0 tests collected. Rule 1 (bug caused by this plan's own change) — fixed inline, verified the full `functions/` suite passes (55/55) afterward.

## Deliberate-Failure Confirmations (Task 2 acceptance criteria)

Per the plan's explicit instruction, confirmed the two sharpest gates are load-bearing, not trivially green:

**Case 4 (contiguity conjunct):** Changed `const complete = actualCount > 0 && actualCount === reportedCount && contiguous;` to drop the `&& contiguous` conjunct. Re-ran `npx vitest run src/index.test.ts -t "case 4"` — **failed**: `expected 'ready' to be 'failed'` (the page-1/2/4-against-reported-3 case now incorrectly resolved to `ready`). Reverted the conjunct. Re-ran the full suite — 55/55 passing again.

**Case 5 (parser-count substitution):** Changed `reportedCount = response.renderedCount;` to a hardcoded `reportedCount = 4;` — simulating a bug where the expected count is derived from a parser heuristic (`MappedSlide[].length`) instead of the render service's own report. Re-ran `npx vitest run src/index.test.ts -t "case 5"` — **failed**: `expected { status: 'failed', ... } to deeply equal { status: 'ready', renderedCount: 6 }` (six real objects existed and the renderer genuinely reported 6, but the substituted `reportedCount = 4` produced a false mismatch). Reverted the substitution. Re-ran the full suite — 55/55 passing again, `git diff functions/src/index.ts` confirmed clean before the Task 3 commit.

Both confirmations prove the tests would catch a real regression of exactly the shape this phase is guarding against, not just pass by construction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `pptxParser.test.ts`'s `firebase-functions/params` mock was missing `defineString`**
- **Found during:** Task 3's full-suite gate run (`cd functions && npx vitest run`)
- **Issue:** `pptxParser.test.ts` imports `parsePptxHandler` from `./index`, and `index.ts` now calls `defineString("PPTX_RENDER_SERVICE_URL", ...)` at module scope (added in Task 1). The file's own `vi.mock("firebase-functions/params", ...)` only provided `defineSecret`, so importing `./index` threw `[vitest] No "defineString" export is defined on the mock` before any of that file's own tests could run — a suite-level failure (0 tests collected), not a single test failure.
- **Fix:** Added `defineString: vi.fn(() => ({ value: () => "" }))` to `pptxParser.test.ts`'s existing `firebase-functions/params` mock.
- **Files modified:** `functions/src/pptxParser.test.ts`
- **Verification:** `cd functions && npx vitest run` — all 3 test files (`renderInvoker.test.ts`, `pptxParser.test.ts`, `index.test.ts`) pass, 55/55 tests.
- **Committed in:** `d952a8a` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a bug in a sibling test file directly caused by this plan's own module-scope addition to `index.ts`, not present before Task 1).
**Impact on plan:** One-line fix, no scope creep. Necessary for the `functions/` suite to run at all after Task 1's change.

## Issues Encountered

**Out-of-scope discovery (logged, not fixed):** while verifying the app suite baseline per this plan's `<constraints>`, running the bare root command `npx vitest run src/` (rather than each workspace's own `cd <dir> && npx vitest run`) was found to pick up `render-service/src/render.test.ts` via Vitest's substring-matching positional filter — and that file fails outright (`No "default" export is defined on the "node:child_process" mock`) when transformed under the root workspace's older Vitest (`v4.0.18`, vs. `render-service/`'s own pinned `v4.1.10`) and `jsdom` environment instead of `render-service`'s own `vitest.config.ts`. This is **not** a regression from this plan — `render-service/` and root `vite.config.ts` were not touched, and `cd render-service && npx vitest run` passes 39/39 directly. Full detail and a suggested (unactioned) fix are recorded in `.planning/phases/37-powerpoint-server-side-rendering/deferred-items.md`. The app suite's actual non-defect baseline (`src/storage.rules.test.ts` + `src/views/__tests__/RosterView.test.ts`, 9 tests / 2 files) is confirmed unaffected — no new app-suite failures introduced by this plan.

## User Setup Required

None — no external service configuration required. `.env.local` was not touched. `PPTX_RENDER_SERVICE_URL` remains at its empty default; 37-06 will document the actual deploy-time value in `render-service/DEPLOY.md`.

## Next Phase Readiness

- `functions/` suite: 55/55 tests passing (`cd functions && npx vitest run`), `cd functions && npx tsc --noEmit` exits 0.
- `render-service/` suite (37-01/37-02's scaffold, untouched by this plan): 39/39 passing, unaffected — confirmed via `cd render-service && npx vitest run` directly (not the contaminated root-level invocation; see Issues Encountered above).
- App suite non-defect baseline confirmed unchanged: `src/storage.rules.test.ts` (8 failures, needs Storage emulator) + `src/views/__tests__/RosterView.test.ts` (1 failure, stale assertion) = 9/2315, matching CLAUDE.md's documented baseline exactly.
- `git diff` confirms `cleanupExpiredMediaHandler`, `MEDIA_PATH_GUARD`, `RETENTION_DAYS`, and the `api` proxy are byte-for-byte unchanged across all three of this plan's task commits.
- **Confirmed: nothing was deployed or built as a container this run.** No `gcloud`, `docker build`, `docker push`, or `firebase deploy` command was executed at any point. No GCP resource, service account, IAM binding, or Artifact Registry repo was created.
- **37-05 needs:** `requestPptxRenderHandler`'s `RenderOutcome`/`failureReason` vocabulary (`missing-render-doc`, `missing-storage-path`, `render-service-not-configured`, `render-service-error`, `incomplete-render`) as the set of terminal states an orphan-cleanup pass over stuck `pending` docs would need to distinguish from. `RENDERED_OBJECT_NAME` and `renderedPrefixFor` are exported and reusable if 37-05's `cleanupOrphanRendersHandler` needs to list the same `rendered/` prefix.
- **37-06 needs to transcribe** this SUMMARY's out-of-scope discovery (root-level Vitest workspace contamination, `deferred-items.md`) into any final phase report, alongside the still-outstanding `google-auth-library` package-legitimacy checkpoint (37-03) and the `STORAGE_BUCKET` env var requirement (37-02) already flagged for `DEPLOY.md`.
- **R062 requirement status intentionally left untouched** per this plan's explicit instruction — `requirements mark-complete R062` was NOT run; R062 remains `[ ]` in `.planning/REQUIREMENTS.md`. 37-06 owns marking it complete.

---
*Phase: 37-powerpoint-server-side-rendering*
*Completed: 2026-08-03*

## Self-Check: PASSED

All modified/created files verified present on disk (`functions/src/index.ts`, `functions/src/index.test.ts`,
`functions/src/pptxParser.test.ts`, this SUMMARY, `deferred-items.md`); all three task commits
(`6dcf3e7`, `b61ead1`, `d952a8a`) verified present in `git log`.
