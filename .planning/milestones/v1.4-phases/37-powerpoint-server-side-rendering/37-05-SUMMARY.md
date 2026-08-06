---
phase: 37-powerpoint-server-side-rendering
plan: 05
subsystem: api
tags: [firebase-functions, firestore, cloud-storage, onSchedule, importedDeck, vue]

# Dependency graph
requires:
  - phase: 37-04
    provides: "requestPptxRenderHandler's RenderOutcome/failureReason vocabulary and renderedPrefixFor/RENDERED_OBJECT_NAME for listing the rendered/ prefix"
provides:
  - "functions/src/index.ts -- cleanupOrphanRendersHandler, cleanupOrphanRenders (onSchedule, 03:00 UTC), ORPHAN_RENDER_STALE_HOURS, RENDERED_OBJECT_GUARD, OrphanCleanupSummary"
  - "src/types/importedDeck.ts -- ImportedDeck.renderImportId?: string, linking a confirmed deck to its organizations/{orgId}/pptxRenders/{importId} record"
  - "src/components/PptxImportModal.vue wired to persist renderImportId on the PPTX path only, never on image-only imports"
affects: [37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Second independent onSchedule job (03:00 UTC) reading Firestore, deliberately not folded into cleanupExpiredMedia (02:00 UTC, zero Firestore access) -- mirrors the exported-handler-plus-thin-wrapper split used by every prior handler in this file"
    - "Fail-safe dry-run gate: process.env.<FLAG> !== \"true\", the exact post-9f1b881 direction, pinned by both behavioral tests and a source-inspection test that greps the handler body for the literal comparison"
    - "Firestore where(\"status\", \"in\", [...]) status filter simulated with real in-memory filtering in the test mock (not just a stub), so a 'ready' doc test proves it is excluded by the query itself, not by an in-memory guard the handler doesn't have"

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts
    - src/types/importedDeck.ts
    - src/components/PptxImportModal.vue
    - src/components/__tests__/PptxImportModal.test.ts

key-decisions:
  - "RENDERED_OBJECT_GUARD applied via Array.filter before any delete decision, rather than an explicit for-loop continue -- functionally identical guard-first ordering to MEDIA_PATH_GUARD's, more concise. Test 8 (source.pptx / images/ / rendered/ all present) proves the ordering behaviorally regardless of implementation style."
  - "The render doc's own delete is wrapped in its own try/catch (not explicitly required by the plan text, but a direct application of the same partial-failure-tolerance principle the plan does require for object deletes) -- a doc-delete failure can no longer abort the scan of remaining candidates."
  - "PptxImportModal.vue explicitly sets renderImportId.value = null at the top of importImages() (Rule 2), not just relying on resetToIdle()'s reset -- because onCancel() never calls resetToIdle() itself (it only emits 'cancel'; resetToIdle only runs via the watch(props.open) reopen cycle). Without the explicit clear, a cancelled-mid-preview PPTX import could leak its id onto an image-only import running in the same mounted modal instance without an intervening close/reopen. Test 3 (Task 3) exercises exactly this sequence and required a wrapper.setProps({open:false}) / setProps({open:true}) reopen step to reach the image-file-input at all, since it lives only in the idle-step template block."

requirements-completed: []  # R062 intentionally NOT marked complete -- 37-06 owns it per this plan's explicit constraint.

coverage:
  - id: D1
    description: "cleanupOrphanRendersHandler defaults to a dry run (process.env.PPTX_RENDER_CLEANUP_ENABLED !== \"true\"); unset, empty, \"false\", \"1\" and a case typo (\"True\") all leave it a dry run with zero deletes"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts -- cleanupOrphanRendersHandler: 'FAILS SAFE' x4 cases (unset, empty, \"false\", \"1\"/\"True\")"
        status: pass
    human_judgment: false
  - id: D2
    description: "The dry-run gate direction is pinned at the source level -- a source-inspection test fails if the comparison is ever inverted"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts -- 'SOURCE INSPECTION: the dry-run gate direction is pinned...' -- confirmed to fail when !== was temporarily changed to ===, then reverted"
        status: pass
    human_judgment: false
  - id: D3
    description: "RENDERED_OBJECT_GUARD is applied to every listed object before any delete decision; source.pptx and images/ at the same importId are structurally unreachable even with the gate enabled"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts -- 'never deletes outside the rendered/ prefix...' -- confirmed to fail when the guard filter was temporarily removed, then reverted"
        status: pass
    human_judgment: false
  - id: D4
    description: "cleanupExpiredMedia receives zero changes -- separate schedule (03:00 vs 02:00), separate handler, no shared code path"
    requirement: "R062"
    verification:
      - kind: other
        ref: "git diff functions/src/index.ts across all three task commits -- purely additive (0 deletions) each time"
        status: pass
    human_judgment: false
  - id: D5
    description: "A ready render and a fresh (<24h) pending render are never orphan-cleanup candidates"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts -- 'never touches a ready render...' and 'never touches a fresh pending render...'"
        status: pass
    human_judgment: false
  - id: D6
    description: "renderImportId links a confirmed ImportedDeck to its render record, present (and equal to the Storage upload id) only on the PPTX path, absent entirely on image-only imports and never leaked across a cancelled-PPTX-then-image sequence"
    requirement: "R062"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PptxImportModal.test.ts -- 'persists renderImportId...', 'image-only imports never carry...', 'cancelling a PPTX import at preview, then running an image import...'"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-08-03
status: complete
---

# Phase 37 Plan 05: The Orphan Sweep and the renderImportId Bridge Summary

**A second, separate `cleanupOrphanRendersHandler` scheduled job (03:00 UTC) that defaults to dry-run exactly like the post-incident `cleanupExpiredMedia` gate, plus `ImportedDeck.renderImportId` wiring `PptxImportModal.vue`'s Storage import id onto the confirmed deck.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 (all auto)
- **Files modified:** 5 (`functions/src/index.ts`, `functions/src/index.test.ts`, `src/types/importedDeck.ts`, `src/components/PptxImportModal.vue`, `src/components/__tests__/PptxImportModal.test.ts`)

## Accomplishments

- `functions/src/index.ts` -- `cleanupOrphanRendersHandler` + `cleanupOrphanRenders` (`onSchedule`, `every day 03:00 UTC` -- one hour after `cleanupExpiredMedia`'s 02:00 so the two sweeps never overlap), `ORPHAN_RENDER_STALE_HOURS = 24`, `RENDERED_OBJECT_GUARD` (`/^orgs\/[^/]+\/pptx-imports\/[^/]+\/rendered\//`), `OrphanCleanupSummary`. The exported-handler-plus-thin-wrapper split mirrors every prior handler in the file.
- **The dry-run gate is character-for-character the same shape as line ~492's `cleanupExpiredMediaHandler` gate:** `const dryRun = process.env.PPTX_RENDER_CLEANUP_ENABLED !== "true";`. Unset, empty, `"false"`, `"1"`, and a case typo (`"True"`) all stay a dry run.
- **The scan:** `collectionGroup("pptxRenders").where("status", "in", ["pending", "failed"]).get()` across all orgs; org id recovered from `doc.ref.parent.parent?.id` (skipped, not guessed, if missing); age keyed on the server-set `createdAt` Firestore timestamp via `.toMillis()`, with an unreadable/missing timestamp failing safe (skipped, never treated as old). Only docs stale beyond `ORPHAN_RENDER_STALE_HOURS` are candidates.
- **The guard-before-delete ordering:** for each stale candidate, `bucket.getFiles({ prefix: renderedPrefixFor(orgId, importId) })` lists objects, then `RENDERED_OBJECT_GUARD` filters them *before* any delete decision -- `source.pptx` and `images/` at the same `importId` are structurally unreachable no matter how stale the render doc is.
- Dry-run mode counts what would be deleted (`deletedObjectCount`/`deletedDocCount`) and deletes nothing; live mode deletes each admitted object in its own try/catch (partial-failure tolerance, mirroring `cleanupExpiredMediaHandler`), then deletes the render doc (also try/catch-wrapped, so a doc-delete failure can't abort the scan of remaining candidates).
- SAFETY CONTRACT doc comment above the handler states only what the code implements: the gate direction and its opt-in requirement, the guard's unreachability guarantee, which statuses/ages are candidates, the timestamp source, partial-failure tolerance, and the deliberate 03:00/02:00 schedule offset.
- 15 new tests in `functions/src/index.test.ts`: 3 `RENDERED_OBJECT_GUARD` regex regressions (mirroring the existing `MEDIA_PATH_GUARD` describe block) and 12 in a `cleanupOrphanRendersHandler` describe block -- enabled-deletes-both, four distinct fail-safe cases, ready-excluded-by-the-query-itself, fresh-pending-skipped, guard-before-delete (source.pptx + images/ + rendered/ all present, only the last deleted), unreadable-`createdAt`-skipped, partial-failure tolerance, and a source-inspection test pinning the gate expression.
- `src/types/importedDeck.ts` -- `ImportedDeck.renderImportId?: string`, documented as the Storage-side import id (`crypto.randomUUID()`), deliberately distinct from `ImportedDeck.id` (Firestore's `addDoc()`-assigned id).
- `src/components/PptxImportModal.vue` -- a component-level `renderImportId = ref<string | null>(null)`, set in `importPptx` immediately after `generateImportId()` (the same id used for the Storage upload path and the `parsePptx` call), explicitly cleared to `null` at the top of `importImages` and in `resetToIdle()`. `onConfirm`'s `createDeck` payload conditionally spreads `renderImportId` only when non-null, keeping the image-only payload byte-identical to before this change.
- 3 new tests in `PptxImportModal.test.ts`: equality (not UUID-shape) between the id passed to `uploadPptx` and the `createDeck` payload's `renderImportId`; absence of the `renderImportId` key entirely on an image-only payload; and no leak across a cancel-mid-preview-then-image-import sequence in the same mounted modal instance.

## Task Commits

Each task was committed atomically:

1. **Task 1: cleanupOrphanRendersHandler -- dry-run by default, path-guarded, on its own schedule** -- `c7d1a7a` (feat)
2. **Task 2: The fail-safe regression suite, mirroring the 9f1b881 test shape** -- `1068a04` (test)
3. **Task 3: renderImportId -- link the confirmed deck to its render record** -- `e159783` (feat)

**Plan metadata commit:** pending (made after this SUMMARY is written)

## Files Created/Modified

- `functions/src/index.ts` -- added `cleanupOrphanRendersHandler`, `cleanupOrphanRenders`, `ORPHAN_RENDER_STALE_HOURS`, `RENDERED_OBJECT_GUARD`, `OrphanCleanupSummary`. Purely additive across all task commits (`git diff --stat` shows 0 deletions); `cleanupExpiredMediaHandler`, `cleanupExpiredMedia`, `MEDIA_PATH_GUARD`, `RETENTION_DAYS` byte-for-byte unchanged.
- `functions/src/index.test.ts` -- new `RENDERED_OBJECT_GUARD` describe block (3 tests) and `cleanupOrphanRendersHandler` describe block (12 tests); import list extended with the four new exports.
- `src/types/importedDeck.ts` -- added `renderImportId?: string` with a comment naming both identifiers and why they differ.
- `src/components/PptxImportModal.vue` -- added the `renderImportId` ref, its set/clear sites, and the conditional spread into `createDeck`'s payload. No other behavior changed.
- `src/components/__tests__/PptxImportModal.test.ts` -- 3 new tests (see Accomplishments).

## Decisions Made

See `key-decisions` in the frontmatter for the two decisions with rationale: the `Array.filter`-based guard application (functionally equivalent to an explicit continue-loop) and the explicit `renderImportId.value = null` at the top of `importImages` (Rule 2 -- a correctness requirement `onCancel()`'s lack of its own state reset would otherwise leave unmet).

## Deliberate-Failure Confirmations (Task 2 acceptance criteria)

Per the plan's explicit instruction, confirmed the two sharpest gates are load-bearing:

**Gate inversion:** Changed `!==` to `===` in `const dryRun = process.env.PPTX_RENDER_CLEANUP_ENABLED !== "true";`. Ran `npx vitest run src/index.test.ts -t "SOURCE INSPECTION"` -- **failed**, as expected (`expected "..." to match /const dryRun = ... !== "true";/`). Reverted with `sed`; re-ran the full suite -- 70/70 passing, `git diff --stat functions/src/index.ts` showed no changes before the Task 2 commit.

**RENDERED_OBJECT_GUARD removal:** Changed `const eligibleFiles = files.filter((file) => RENDERED_OBJECT_GUARD.test(file.name));` to `const eligibleFiles = files;`. Ran `npx vitest run src/index.test.ts -t "never deletes outside the rendered"` -- **failed**, as expected (`sourceFile.delete` and `imageFile.delete` were called; the test asserts they never should be). Reverted; re-ran the full suite -- 70/70 passing again.

Both confirmations prove the tests would catch a real regression of exactly the shape each is guarding against, not just pass by construction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Explicit `renderImportId.value = null` at the top of `importImages`, not just relying on `resetToIdle()`**
- **Found during:** Task 3, while writing the "cancel a PPTX import, then run an image import" test
- **Issue:** `onCancel()` only emits `'cancel'` -- it never calls `resetToIdle()` itself. `resetToIdle()` only runs via the `watch(props.open)` reopen cycle. In a single mounted modal instance where a PPTX import reaches `preview`, is cancelled, and an image import is started on the *same* instance without an intervening close/reopen, `renderImportId` would still hold the earlier PPTX-path value with no explicit clear on the image path.
- **Fix:** Added an explicit `renderImportId.value = null` at the top of `importImages`, so image-only imports can never carry a leftover value regardless of what happened earlier in the same modal session.
- **Files modified:** `src/components/PptxImportModal.vue`
- **Verification:** New test "cancelling a PPTX import at preview, then running an image import, never leaks the id onto the image payload" passes; asserts `createDeckPayload` has no `renderImportId` key.
- **Committed in:** `e159783` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 -- a correctness requirement the plan's own worked example implicitly needed once the actual `onCancel` control flow was traced).
**Impact on plan:** One added line, no scope creep. Directly required for the exact leak scenario the plan called out by name.

## Issues Encountered

**Test-authoring correction (not a deviation, no code change):** two of the three new `PptxImportModal.test.ts` tests initially failed for reasons unrelated to `renderImportId` itself: (1) the confirm button is `:disabled="previewSlides.length === 0"`, so a mocked `parsePptx` response with an empty `slides` array left the button inert -- fixed by giving the mock at least one slide; (2) the image-file-input only renders in the modal's `idle`-step template block, so reaching it after a cancel-at-preview required simulating a real close/reopen (`wrapper.setProps({ open: false })` then `{ open: true }`) to trigger the `watch(props.open)`-driven `resetToIdle()`, rather than assuming the input was reachable from `preview` directly. Both were test-construction fixes, not production-code changes.

## User Setup Required

None -- no external service configuration required. `.env.local` was not touched.

## Next Phase Readiness

- `functions/` suite: 70/70 passing (`cd functions && npx vitest run`); `cd functions && npx tsc --noEmit` exits 0.
- `render-service/` suite: 39/39 passing (`cd render-service && npx vitest run`), unaffected -- confirmed directly, not via the known-contaminated root-level invocation (CLAUDE.md / 37-04-SUMMARY.md's logged issue).
- App suite (scoped run, `npx vitest run src/components src/views src/utils src/stores src/composables`): 2221/2222 passing, 1 failure -- `src/views/__tests__/RosterView.test.ts` (documented stale-assertion baseline). `PptxImportModal.test.ts` fully green within this run.
- `npm run type-check` (`vue-tsc --build`) exits 0.
- **Confirmed: nothing was deployed or built as a container this run.** No `gcloud`, `docker build/push`, or `firebase deploy` command was executed. No GCP resource, service account, IAM binding, or Artifact Registry repo was created.
- **`git diff` confirms `cleanupExpiredMediaHandler`, `MEDIA_PATH_GUARD`, and `RETENTION_DAYS` are byte-for-byte unchanged** across all three of this plan's task commits.
- **37-06 needs:** the completed R062 criterion set (dry-run-by-default orphan sweep + the `renderImportId` bridge) as the last piece before it can run `requirements mark-complete R062` and write the phase-level report/`DEPLOY.md`. `ORPHAN_RENDER_STALE_HOURS`, `RENDERED_OBJECT_GUARD`, and `OrphanCleanupSummary` are exported and available if 37-06's report needs to describe or reference the sweep's tunables.
- **R062 requirement status intentionally left untouched** per this plan's explicit instruction -- `requirements mark-complete R062` was NOT run; R062 remains `[ ]` in `.planning/REQUIREMENTS.md` with its "In progress" note.

---
*Phase: 37-powerpoint-server-side-rendering*
*Completed: 2026-08-03*

## Self-Check: PASSED

All modified files verified present on disk (`functions/src/index.ts`, `functions/src/index.test.ts`,
`src/types/importedDeck.ts`, `src/components/PptxImportModal.vue`,
`src/components/__tests__/PptxImportModal.test.ts`, this SUMMARY); all three task commits
(`c7d1a7a`, `1068a04`, `e159783`) verified present in `git log`.
