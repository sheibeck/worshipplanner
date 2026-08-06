---
phase: 37-powerpoint-server-side-rendering
plan: 06
subsystem: infra
tags: [deploy-handoff, documentation, cloud-run, requirements-traceability]

# Dependency graph
requires:
  - phase: 37-01
    provides: "render-service/ scaffold, Dockerfile, font-policy gate — DEPLOY.md documents its deploy"
  - phase: 37-02
    provides: "render.ts/server.ts, and the STORAGE_BUCKET env var finding transcribed into DEPLOY.md"
  - phase: 37-03
    provides: "renderInvoker.ts and the google-auth-library package-legitimacy checkpoint transcribed into PENDING-VERIFICATION.md item 37.5"
  - phase: 37-04
    provides: "requestPptxRenderHandler / PPTX_RENDER_SERVICE_URL, documented in DEPLOY.md's post-deploy configuration section"
  - phase: 37-05
    provides: "cleanupOrphanRendersHandler / PPTX_RENDER_CLEANUP_ENABLED and renderImportId, both documented and completing R062's automated scope"
provides:
  - "render-service/DEPLOY.md — the complete, self-contained gcloud run deploy handoff (prerequisites, deploy command, every flag explained, both IAM directions, STORAGE_BUCKET, post-deploy config, cleanup toggle, post-deploy verification checklist)"
  - ".planning/PENDING-VERIFICATION.md ## Phase 37 section — six open, unchecked owner to-dos (37.1-37.6)"
  - ".planning/REQUIREMENTS.md R062 marked [~] partial, following the R064 precedent, with the traceability table updated"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deploy-handoff-as-durable-doc: DEPLOY.md lives next to the Dockerfile it deploys rather than being buried in a plan SUMMARY, so the owner can find it without returning to planning documents"

key-files:
  created:
    - render-service/DEPLOY.md
  modified:
    - .planning/PENDING-VERIFICATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "R062 marked [~] partial, not [x] complete — the automated pipeline (render service, bridging function, completeness check, font policy, dry-run cleanup) is fully built and tested, but the service is undeployed (owner instruction: build but do not deploy) and no UI consumes the rendered images yet (37-CONTEXT.md explicitly defers client-side display to a later phase). Followed the R064 precedent format in REQUIREMENTS.md rather than overstating completion."
  - "requirements mark-complete R062 was deliberately NOT run — REQUIREMENTS.md was hand-edited to the [~] partial shape instead, since the mark-complete verb only produces [x]."

requirements-completed: []  # R062 marked [~] partial, not complete -- see key-decisions above

coverage:
  - id: D1
    description: "render-service/DEPLOY.md exists, contains the exact gcloud run deploy command, every flag explained, both IAM directions, and the STORAGE_BUCKET env var (discovered in 37-02, not in the original artifact table)"
    requirement: "R062"
    verification:
      - kind: other
        ref: "grep -c 'gcloud run deploy pptx-render' / 'PPTX_RENDER_SERVICE_URL' / 'roles/run.invoker' render-service/DEPLOY.md — all >=1"
        status: pass
    human_judgment: false
  - id: D2
    description: "PENDING-VERIFICATION.md gains a Phase 37 section (six unchecked items) without disturbing Phases 31-35"
    requirement: "R062"
    verification:
      - kind: other
        ref: "grep -c '^## Phase 3[1-5]' returns 5, grep -c '^## Phase 37' returns 1, grep -c '☐ \\*\\*37\\.' returns 6, git diff --stat shows insertions only (60+/0-)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All three test suites and both type gates are green: render-service (39/39), functions (70/70), app scoped suite (2221/2222, one documented baseline failure), npm run type-check (vue-tsc --build) and npm run build both clean"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "cd render-service && npx vitest run -- 39/39 passed"
        status: pass
      - kind: unit
        ref: "cd functions && npx vitest run -- 70/70 passed"
        status: pass
      - kind: unit
        ref: "npx vitest run src/components src/views src/utils src/stores src/composables -- 2221/2222 passed, 1 documented-baseline failure (RosterView.test.ts)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No-deploy audit: no gcloud, firebase deploy, docker build or docker push was executed anywhere in Phase 37's commits or summaries"
    requirement: "R062"
    verification:
      - kind: other
        ref: "git log --patch across all 37-* commits, grepped for executed invocations (excluding Dockerfile/markdown prose) -- zero matches; all five prior SUMMARYs' own 'Next Phase Readiness' sections independently confirm the same"
        status: pass
    human_judgment: false
  - id: D5
    description: "R062's completion status is recorded honestly — partial, not complete — because the service is undeployed and no UI consumes rendered images yet"
    requirement: "R062"
    verification: []
    human_judgment: true
    rationale: "Whether 'partial' vs 'complete' is the right characterization, and whether the owner is satisfied with what remains undelivered, is an owner judgment call the plan explicitly reserved rather than a test-provable claim."

duration: ~50min
completed: 2026-08-03
status: complete
---

# Phase 37 Plan 06: Deploy Handoff, Owner To-Dos, and the Phase Gate Summary

**Wrote `render-service/DEPLOY.md` (the complete, unexecuted `gcloud run deploy` handoff with both IAM directions and the STORAGE_BUCKET env var), added six unchecked owner to-dos to `PENDING-VERIFICATION.md`, ran the full three-suite gate green, audited the phase for zero executed deploy commands, and marked R062 `[~]` partial rather than overstating completion.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-03T17:39:00Z (approx, first file read)
- **Completed:** 2026-08-03T18:29:00Z
- **Tasks:** 3 (all auto)
- **Files modified:** 1 created (`render-service/DEPLOY.md`), 2 modified (`PENDING-VERIFICATION.md`, `REQUIREMENTS.md`)

## Accomplishments

- `render-service/DEPLOY.md` (199 lines) — the durable owner-run deploy handoff, living next to the Dockerfile it deploys. Opens with a banner that nothing in the repository runs any command in the file. Covers: three prerequisite commands (service account, bucket-scoped `roles/storage.objectAdmin`, API enablement), the full `gcloud run deploy pptx-render` command with every flag explained in a table (including the unvalidated `--memory=2Gi`/`--cpu=2` caveat and why `--concurrency=1` is deliberate), the second IAM direction (`roles/run.invoker` for the functions service account), `STORAGE_BUCKET` as a required env var (37-02's finding, not in the original artifact table), post-deploy configuration of `PPTX_RENDER_SERVICE_URL`, the `PPTX_RENDER_CLEANUP_ENABLED` opt-in-only cleanup toggle tied explicitly to the 2026-07-28 incident, the font-provenance build-time gate, and a post-deploy verification checklist matching 37-VALIDATION.md's Manual-Only table.
- `.planning/PENDING-VERIFICATION.md` gained a `## Phase 37` section (items 37.1-37.6) inserted via a scoped `Edit` anchored on the existing `---` separator — `git diff --stat` confirms 60 insertions, 0 deletions, and all five prior phase sections (31-35) are byte-identical. Item 37.5 transcribes both deferred package-legitimacy checkpoints (37-01's `express`/`@google-cloud/storage`/`@types/*`, 37-03's `google-auth-library`) verbatim from their SUMMARYs, including the note that `google-auth-library`'s `[SUS]` flag is a `too-new` false positive that also fires on this repo's own `firebase-admin`/`firebase-functions`.
- Full phase gate run: `render-service/` 39/39 passing, `npx tsc --noEmit` clean; `functions/` 70/70 passing, `npx tsc --noEmit` clean; app suite (scoped per CLAUDE.md's contamination warning) 2221/2222 passing with the one failure matching the documented `RosterView.test.ts` stale-assertion baseline exactly; `npm run type-check` (`vue-tsc --build`, the form CLAUDE.md requires) exits clean; `npm run build` succeeds.
- No-deploy audit run against `git log --patch` for all sixteen Phase 37 commits and all five prior SUMMARYs: zero executed `gcloud`, `firebase deploy`, `docker build`, or `docker push` invocations. The only matches are Dockerfile comments and `37-RESEARCH.md`/`DEPLOY.md` prose describing the commands, never running them.
- `R062` marked `[~]` partial in `REQUIREMENTS.md`, following the `R064` precedent format exactly (a `[~]` bullet explaining what's delivered vs. not, followed by the original `[ ]` requirement text preserved below it) — not marked complete, because the service is undeployed by owner instruction and no UI consumes the rendered images yet (37-CONTEXT.md explicitly defers that). Traceability table row updated to match.

## Task Commits

Each task was committed atomically:

1. **Task 1: render-service/DEPLOY.md — the exact owner-run handoff** — `faab8eb` (feat)
2. **Task 2: Add the Phase 37 section to PENDING-VERIFICATION.md without disturbing Phases 31-35** — `5136062` (docs)
3. **Task 3: Phase gate — all three suites, both type checks, and the no-deploy audit** — no code changes; gate results recorded in this SUMMARY

**Plan metadata commit:** pending (made after this SUMMARY is written)

## Files Created/Modified

- `render-service/DEPLOY.md` — the deploy handoff (created)
- `.planning/PENDING-VERIFICATION.md` — `## Phase 37` section added (modified, insertions only)
- `.planning/REQUIREMENTS.md` — R062 marked `[~]` partial with explanation; traceability row updated (modified)

## Decisions Made

- **R062: `[~]` partial, not `[x]` complete.** The full automated pipeline — render service, Dockerfile, font policy, bridging function, independent-recount completeness check, dry-run-by-default orphan sweep — is built and tested end to end across 37-01 through 37-05. But the requirement's literal text ("PowerPoint import produces a true visual representation") is not yet true for any real user: the service is undeployed by explicit owner instruction (STATE.md v1.4: BUILD BUT DO NOT DEPLOY), and even once deployed, 37-CONTEXT.md explicitly defers "client-side display rework for rendered images beyond storing and referencing them" — so nothing in the app shows a rendered slide today. Followed the `R064` precedent (structural work complete, reachability/delivery not) rather than mark this complete and overstate it.
- **`requirements mark-complete R062` deliberately not run.** That verb only produces `[x]`. Since the honest status is `[~]`, `REQUIREMENTS.md` was hand-edited directly, mirroring `R064`'s exact section shape (partial-bullet explanation, then the original requirement text preserved below it) and updating the traceability table row to match.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; all three suites and both type gates passed on the first run.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required by this plan. `.env.local` was not touched. The owner's next action, if desired, is reviewing `render-service/DEPLOY.md` and the six items in `PENDING-VERIFICATION.md`'s `## Phase 37` section — both are informational handoffs, not something this run can complete on the owner's behalf.

## No-Deploy Audit Result

**PASSED — no prohibited command was executed anywhere in Phase 37.** Searched `git log --patch` across all sixteen commits under `37-01` through `37-06` (render-service and functions paths) for executed `gcloud `, `docker build`, `docker push`, or `firebase deploy` invocations. Zero matches outside of Dockerfile comments and documentation prose (`37-RESEARCH.md`, `render-service/DEPLOY.md`) describing — never running — these commands. Cross-checked against every prior plan's own "Next Phase Readiness" section (37-01 through 37-05), each of which independently states the same: no GCP resource, service account, IAM binding, Artifact Registry repo, or container image was created.

## Phase Gate Results

| Suite | Result |
|---|---|
| `cd render-service && npx vitest run` | 39/39 passed |
| `cd render-service && npx tsc --noEmit` | exit 0 |
| `cd functions && npx vitest run` | 70/70 passed |
| `cd functions && npx tsc --noEmit` | exit 0 |
| `npx vitest run src/components src/views src/utils src/stores src/composables` (scoped per CLAUDE.md's contamination warning) | 2221/2222 passed — 1 failure, `src/views/__tests__/RosterView.test.ts`, matching the documented stale-assertion baseline exactly |
| `npm run type-check` (`vue-tsc --build` — the form CLAUDE.md requires, not `-p tsconfig.app.json`) | exit 0 |
| `npm run build` | succeeded |

Note: the scoped app-suite command does not include `src/storage.rules.test.ts` (the other documented baseline failure) because that file sits directly under `src/`, outside the five scoped subdirectories — this matches 37-05-SUMMARY's own precedent for the identical scoped command and is not a new gap.

## Next Phase Readiness

- **Phase 37 is complete as an automated deliverable.** `render-service/DEPLOY.md` is the owner's single entry point to deploy; `PENDING-VERIFICATION.md`'s `## Phase 37` section is the owner's single entry point to everything this run genuinely could not verify.
- **R062 remains `[~]` partial** in `REQUIREMENTS.md` until the owner deploys (item 37.4) and a future phase wires the rendered images into the UI (out of scope here, per 37-CONTEXT.md).
- No blockers for subsequent phases — this plan touched no files outside `render-service/DEPLOY.md`, `.planning/PENDING-VERIFICATION.md`, and `.planning/REQUIREMENTS.md`.

---
*Phase: 37-powerpoint-server-side-rendering*
*Completed: 2026-08-03*

## Self-Check: PASSED

`render-service/DEPLOY.md` and this SUMMARY verified present on disk; both task commits
(`faab8eb`, `5136062`) verified present in `git log`.
