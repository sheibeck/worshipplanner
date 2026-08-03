---
phase: 37-powerpoint-server-side-rendering
plan: 03
subsystem: api
tags: [firebase-functions, firestore, google-auth-library, cloud-run, iam, service-to-service-auth]

# Dependency graph
requires:
  - phase: 37-01
    provides: "render-service/ scaffold (not consumed by this plan's code, but establishes the sibling-project convention this plan's Cloud Run URL points at)"
provides:
  - "functions/src/renderInvoker.ts — invokeRenderService, the single mockable seam that mints an OIDC ID token (audience = exact Cloud Run URL) and POSTs to /render, with no unauthenticated fallback path"
  - "functions/src/index.ts — PptxRenderStatus, PptxRenderDoc, pptxRenderDocRef (canonical path builder for organizations/{orgId}/pptxRenders/{importId})"
  - "parsePptxHandler additive queue write: on successful parse, writes one pending render doc in its own nested try/catch that can never fail the call"
affects: [37-04, 37-05, 37-06]

# Tech tracking
tech-stack:
  added: ["google-auth-library@^11.0.0"]
  patterns:
    - "Firestore-doc-as-queue: a fast onCall writes a durable doc instead of awaiting slow work; a later trigger (37-04) picks it up"
    - "Nested try/catch around a non-critical additive write, distinct from the handler's outer error-to-HttpsError catch, so a queue-write failure never masquerades as a parse failure"
    - "IAM contract isolated into one mockable module (renderInvoker.ts) rather than mocking google-auth-library directly in every caller's test"

key-files:
  created:
    - functions/src/renderInvoker.ts
    - functions/src/renderInvoker.test.ts
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts
    - functions/package.json
    - functions/package-lock.json

key-decisions:
  - "google-auth-library package-legitimacy checkpoint recorded as DEFERRED, never self-approved, per STATE.md's standing autonomy grant"
  - "Queue write placed after parsePptxBuffer succeeds but still inside the handler's own try block, wrapped in a second nested try/catch -- verified by temporarily removing the nested try/catch, observing the regression test fail, then restoring it"

requirements-completed: [R062]

coverage:
  - id: D1
    description: "invokeRenderService always calls getIdTokenClient with the exact Cloud Run service URL as audience, and has no path that reaches globalThis.fetch or any bare HTTP client"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/renderInvoker.test.ts — 'invokeRenderService' describe block (7 tests, including a source-inspection test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "parsePptxHandler's { slides } return shape and existing auth/path-guard/org-membership behaviour are byte-for-byte unchanged; the only addition is one Firestore write"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — 'parsePptxHandler' describe block (9 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A pptxRenders queue-write failure never fails the parse -- the parsed text layer stays usable even if the render can never be queued"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#case 3: a queue-write failure does not fail the parse -- still resolves { slides }, throws nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "google-auth-library package legitimacy checkpoint -- resolved source repo recorded and confirmed to match 37-RESEARCH.md's audit"
    requirement: "R062"
    verification: []
    human_judgment: true
    rationale: "STATE.md's standing autonomy grant requires this checkpoint be deferred and disclosed, never self-approved -- an owner decision, not something a test can pass on the owner's behalf."

duration: 15min
completed: 2026-08-03
status: complete
---

# Phase 37 Plan 03: Render Invoker and Queue Write Summary

**Added `renderInvoker.ts` (IAM-authenticated Cloud Run invocation seam with zero unauthenticated fallback) and one additive, failure-swallowing Firestore queue write in `parsePptxHandler`, with 16 new regression tests proving nothing else about the existing handler moved.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-03T12:09:00-04:00 (approx)
- **Completed:** 2026-08-03T12:18:31-04:00
- **Tasks:** 3 (1 checkpoint deferred, 2 auto)
- **Files modified:** 2 created, 4 modified

## Accomplishments
- `functions/src/renderInvoker.ts` — `invokeRenderService` mints an OIDC ID token via `GoogleAuth#getIdTokenClient(renderServiceUrl)` (audience is the bare Cloud Run URL, never the `/render` path), then POSTs `{orgId, importId, storagePath}` with a 240s timeout via the authenticated client's own `request()`. An empty/whitespace `renderServiceUrl` throws before any network call — there is no degrade-to-unauthenticated-fetch path, proven by 7 tests including a source-inspection test that greps the stripped-of-comments source for `fetch(` and `require("http"/"https")`.
- `functions/src/index.ts` — exported `PptxRenderStatus`, `PptxRenderDoc`, and `pptxRenderDocRef(orgId, importId)` as the single canonical path builder for `organizations/{orgId}/pptxRenders/{importId}`, shared going forward by 37-04's trigger and 37-05's cleanup handler.
- `parsePptxHandler` now writes one `{status: "pending", storagePath, createdAt: serverTimestamp()}` doc after a successful parse, inside its own nested `try`/`catch` distinct from the handler's outer catch — a queue-write failure is logged and swallowed, never surfacing to the caller. Confirmed this is load-bearing, not decorative: temporarily removed the nested try/catch, re-ran the test suite, watched the case-3 regression test fail with the outer handler's `invalid-argument` error, then restored the try/catch and re-verified all 42 tests pass.
- 9 new tests in `functions/src/index.test.ts` cover: return-shape regression (exactly `{ slides }`, no extra keys), exactly-one queue write with the right fields, queue-write failure not failing the parse, no render doc on a parse failure, all three pre-existing guards (unauthenticated / out-of-org-prefix storagePath / non-member uid) still intact, and two tests (one behavioral, one source-inspection) pinning that `invokeRenderService` is never called or referenced from this `onCall` path.
- `google-auth-library` added as a direct dependency at `^11.0.0` (was already present transitively at `10.6.1` via `firebase-admin`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate for google-auth-library** — checkpoint, no commit (mechanical `npm view` checks only; disposition recorded below, not code)
2. **Task 2: renderInvoker.ts — the ID-token seam, and its no-unauthenticated-fallback contract** — `e969329` (feat)
3. **Task 3: Queue the render from parsePptxHandler with one additive, non-throwing Firestore write** — `e6f4adc` (feat)

**Plan metadata commit:** pending (made after this SUMMARY is written)

## Files Created/Modified
- `functions/src/renderInvoker.ts` — `invokeRenderService`, `InvokeRenderServiceArgs`, `RenderServiceResponse`, `RENDER_REQUEST_TIMEOUT_MS`
- `functions/src/renderInvoker.test.ts` — 7 tests: `getIdTokenClient` call shape, `client.request` payload/timeout, `renderedCount` passthrough, empty-URL rejection, whitespace-URL rejection, fetch-never-called, source-inspection no-bare-HTTP-client
- `functions/src/index.ts` — `PptxRenderStatus`, `PptxRenderDoc`, `pptxRenderDocRef`, and the additive nested-try/catch queue write inside `parsePptxHandler`; extended the handler's existing security-contract doc comment
- `functions/src/index.test.ts` — new `parsePptxHandler` describe block (9 tests) with a fake Firestore builder (`collection().doc().collection().doc()` → `get`/`set` spies), `./pptxParser` and `./renderInvoker` mocked
- `functions/package.json`, `functions/package-lock.json` — `google-auth-library@^11.0.0` added as a direct dependency

## Decisions Made
- **google-auth-library checkpoint disposition: DEFERRED, not owner-approved.** Per STATE.md's `★★ STANDING AUTONOMY GRANT`, this `gate="blocking-human"` checkpoint was never self-approved. Mechanical `npm view` checks were run first (see table below) and `npm install` proceeded only after recording them, per Task 1's own `<action>` instructions.
- **Nested try/catch is structural, not decorative.** Verified empirically (removed → test fails → restored → test passes again) rather than merely asserted, per the plan's acceptance criteria.
- **`pptxRenderDocRef` exported as a shared helper now**, even though only `parsePptxHandler` calls it in this plan, specifically so 37-04's trigger and 37-05's cleanup handler build the identical Firestore path rather than each re-deriving it.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the code worked as designed on the first implementation pass (only test-authoring issues were hit and fixed before any commit: a `vi.fn()` arrow-function constructor mock needed converting to a `function` mock for `new GoogleAuth()`, and `import.meta.url` needed swapping for `__dirname` to match `functions/`'s CommonJS `tsconfig.json` — both fixed before the Task 2 commit, neither is a deviation from the plan's design).

## Package Legitimacy Checkpoint — Task 1 (DEFERRED, not owner-approved)

Ran the mechanical `npm view` checks before `npm install`, as instructed:

| Package | Resolved source repository | Latest version | Published | Matches 37-RESEARCH.md's audit? |
|---|---|---|---|---|
| `google-auth-library` | `github.com/googleapis/google-cloud-node` (directory `core/packages/google-auth-library-nodejs`) | `11.0.0` | 4 days before this run, by `google-wombot` (Google's official npm bot) | Yes — flagged `[SUS]`/`too-new` purely on release-cadence heuristic; same heuristic fires identically on this repo's already-shipping `firebase-admin`/`firebase-functions`, so this reads as a false positive from Google's fast Node-client release cadence, not a real risk signal. 77.5M weekly downloads, official `googleapis` GitHub org. |

**Disposition: DEFERRED under STATE.md's `★★ STANDING AUTONOMY GRANT`.** Not owner-approved. Per this plan's own `<resume-signal>` text, this item is recorded here for 37-06 to transcribe into `.planning/PENDING-VERIFICATION.md` as item 37.5 (this plan does not write that file directly).

## Issues Encountered
None beyond the two test-authoring fixes documented under Deviations (not deviations from the plan's design — both were mechanical test-syntax corrections made before any commit).

## User Setup Required
None — no external service configuration required. `.env.local` was not touched. `PPTX_RENDER_SERVICE_URL` (the `defineString` param that will supply `renderInvoker`'s `renderServiceUrl` argument at runtime) is 37-04's responsibility, not this plan's.

## Threat Flags

None. All new surface (npm registry install of `google-auth-library`, the new Firestore write path) is already covered by this plan's own `<threat_model>` (T-37-SC, T-37-09, T-37-10, T-37-11, T-37-12), each with a stated mitigation implemented in this plan.

## Next Phase Readiness

- `functions/` suite: 42/42 tests passing (`cd functions && npx vitest run`), `cd functions && npx tsc --noEmit` exits 0.
- `render-service/` suite (37-01's scaffold, untouched by this plan): 15/15 tests passing, unaffected.
- App suite (`npx vitest run src/`): 2284/2293 passing — the 9 failures across 2 files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) match CLAUDE.md's documented pre-existing baseline exactly; no new failures introduced.
- `git status` confirms `firestore.rules` unmodified — this plan needed and made zero rules changes, as the plan's own artifact spec required.
- **37-04 needs:** `PPTX_RENDER_SERVICE_URL` (`defineString` param, empty default) and the `onDocumentCreated` trigger (`requestPptxRenderHandler`) that consumes `invokeRenderService` + `pptxRenderDocRef`, invokes the render, independently recounts Storage, and flips status to `ready`/`failed`.
- **37-06 needs to transcribe** this SUMMARY's Package Legitimacy Checkpoint table into `.planning/PENDING-VERIFICATION.md` as item 37.5, per the plan's own resume-signal instructions.
- **Confirmed: nothing was deployed or built as a container this run.** No `gcloud`, `docker build`, `docker push`, or `firebase deploy` command was executed at any point in this plan's execution. `git log` for this plan's two feature commits shows only `npm install`, file authoring, and `npx vitest run` / `npx tsc --noEmit` invocations. `docker build` was not run (render-service is unaffected by this plan and was not touched).

---
*Phase: 37-powerpoint-server-side-rendering*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 4 created/modified source files verified present on disk; both task commits (`e969329`, `e6f4adc`) verified present in `git log`.
