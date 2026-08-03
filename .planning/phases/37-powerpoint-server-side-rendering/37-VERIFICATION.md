---
phase: 37-powerpoint-server-side-rendering
verified: 2026-08-03T15:00:00Z
status: human_needed
score: 3/4 roadmap truths verified (1 uncertain — requires owner deployment + a future UI phase)
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
human_verification:
  - test: "Deploy render-service to Cloud Run per render-service/DEPLOY.md, import a real multi-font, multi-slide deck, and visually compare the rendered slide images against PowerPoint's own rendering (backgrounds, fonts, layout, effects)."
    expected: "Rendered PNGs are a true-fidelity visual representation of each slide, not text alone."
    why_human: "No code path in this repo can produce or display a rendered image without a deployed Cloud Run service and a client that consumes organizations/{orgId}/pptxRenders — neither exists yet by explicit owner instruction (BUILD BUT DO NOT DEPLOY) and explicit phase-boundary scoping (client-side display deferred). Visual fidelity is inherently a human judgment call."
  - test: "Import a deck authored in Calibri and Cambria after deployment and inspect whether LibreOffice actually substituted Carlito/Caladea (per the shipped fontconfig alias file) rather than falling back to Liberation Sans."
    expected: "The rendered glyphs are metrically Carlito/Caladea, not a generic fallback."
    why_human: "The Dockerfile test proves the alias file's XML content and its COPY/fc-cache ordering, but cannot exercise real LibreOffice font resolution without a container."
  - test: "After deployment, render several real decks and record CPU-seconds/wall time; revisit --memory=2Gi/--cpu=2/--max-instances=5 against observed numbers."
    expected: "Cost/latency figures within an acceptable range for the owner's usage pattern."
    why_human: "Cannot be measured without a running service; this run explicitly declined to estimate and call it validated."
  - test: "Review render-service/DEPLOY.md, confirm the region against the project's actual Firestore/Functions region, then run the prerequisite gcloud commands, the deploy, and the roles/run.invoker binding."
    expected: "pptx-render is live, --no-allow-unauthenticated, and only the functions service account can invoke it."
    why_human: "Deploying provisions billable GCP infrastructure — explicitly reserved as the owner's decision (STATE.md v1.4), not something this run or an autonomous verifier may execute."
  - test: "Confirm comfort with the two deferred package-legitimacy checkpoints: express/@google-cloud/storage/@types/express/@types/node (render-service/) and google-auth-library (functions/)."
    expected: "Owner sign-off recorded, or an alternative package requested."
    why_human: "STATE.md's standing autonomy grant prohibits self-approving a blocking-human checkpoint; both were mechanically resolved to their source repos but never approved by anyone but the owner."
  - test: "After the service has run for a while with PPTX_RENDER_CLEANUP_ENABLED left unset, read a dry-run log from cleanupOrphanRenders and confirm the would-delete list contains only stale pending/failed renders and their rendered/ objects — never source.pptx, never images/, never a ready render — before ever setting the flag to \"true\"."
    expected: "The dry-run log matches the SAFETY CONTRACT's stated behavior exactly."
    why_human: "Requires a live, running scheduled function with real data; not producible from source inspection alone."
---

# Phase 37: PowerPoint Server-Side Rendering Verification Report

**Phase Goal:** Imported PowerPoint decks render server-side to true-fidelity images, retaining parsed
text as a searchable layer.
**Verified:** 2026-08-03
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | An imported PowerPoint deck displays as a true visual rendering of each slide — backgrounds, fonts, layout, effects — not text alone | ? UNCERTAIN | The full pipeline (Cloud Run service, bridging function, completeness check) is built and unit-tested end to end, but **nothing in the codebase currently produces or displays a rendered image for any real user**. The Cloud Run service is undeployed (owner instruction, STATE.md v1.4: BUILD BUT DO NOT DEPLOY — confirmed no `gcloud run deploy`/`docker build`/`docker push` was ever executed, see No-Deploy Audit below), and no UI component reads `organizations/{orgId}/pptxRenders` or the `rendered/` Storage prefix — `grep -r "renderImportId\|pptxRenders\|rendered/page-" src/` returns only the write-side (`PptxImportModal.vue`) and its own tests, never a consumer. This is honestly disclosed, not hidden: `REQUIREMENTS.md` marks R062 `[~]` partial for exactly this reason, and `PENDING-VERIFICATION.md` items 37.1/37.4 record it as an open owner action. **The `[~]` partial marking is the honest call, not an overstatement.** |
| 2 | Extracted text remains available as a searchable/label layer alongside the rendered image | ✓ VERIFIED | `functions/src/index.ts:191-252` (`parsePptxHandler`) — `git diff`-level inspection confirms the auth check, storage-path guard, org-membership read and `return { slides }` are byte-identical to before this phase; the only addition is a nested `try/catch` around the `pptxRenderDocRef(...).set(...)` queue write (lines 233-241) whose failure is logged and swallowed, never surfaced to the caller. Confirmed present in source exactly as claimed. `cd functions && npx vitest run` → 70/70 passing (independently re-run). |
| 3 | Only metric-compatible open fonts (Carlito/Caladea/Liberation) are used server-side; no Microsoft fonts are bundled | ✓ VERIFIED | `render-service/Dockerfile` installs exactly `fonts-crosextra-carlito`, `fonts-crosextra-caladea`, `fonts-liberation` with `--no-install-recommends`, plus a build-time `dpkg -l \| grep -qiE 'mscorefonts\|msttcorefonts'` assertion that `exit 1`s on a match. `render-service/src/dockerfile.test.ts` region-scopes its negative assertion to the extracted `apt-get install` package-token list (verified by reading the extraction helper and its self-test, "the extraction is scoped to the install list... removing a required package... is detectable"), so it would catch a future base-image change bundling MS fonts without false-failing on the dpkg assertion's own legitimate mention of the same names. `cd render-service && npx vitest run` → 39/39 passing (independently re-run). |
| 4 | Orphan cleanup for failed renders defaults to dry-run/report-only | ✓ VERIFIED | `functions/src/index.ts:611-692` (`cleanupOrphanRendersHandler`) — first executable line is `const dryRun = process.env.PPTX_RENDER_CLEANUP_ENABLED !== "true";`, the exact post-9f1b881 direction; `RENDERED_OBJECT_GUARD` (`/^orgs\/[^/]+\/pptx-imports\/[^/]+\/rendered\//`) is applied via `.filter()` **before** any delete decision (line 655). The SAFETY CONTRACT doc comment (lines 555-586) was checked sentence-by-sentence against the code and every claim holds. `functions/src/index.test.ts` carries 5 distinct FAILS SAFE cases (unset, empty, `"false"`, `"1"`, case-typo `"True"`) plus a source-inspection test pinning the gate direction against future inversion. |

**Score:** 3/4 roadmap truths verified, 1 uncertain (requires owner deployment and a future UI-consuming phase — not a code defect).

### Supplementary Load-Bearing Truths (from PLAN frontmatter, verification_focus)

| Truth | Status | Evidence |
|---|---|---|
| The completeness check gates "ready" on three independent conjuncts (positive count, reported==actual, contiguous 1..N), never on the render count alone or the parser's slide count | ✓ VERIFIED | `functions/src/index.ts:395-408` — `const contiguous = pageNumbers.every((n, i) => n === i + 1); const complete = actualCount > 0 && actualCount === reportedCount && contiguous;`. `requestPptxRenderHandler`'s function-body region contains zero references to `parsePptxBuffer`/`MappedSlide`/`slides` (the JSDoc *above* the signature explains the constraint using those terms, deliberately placed outside the sliced test region per 37-04-SUMMARY's documented decision — confirmed by reading the actual source). Pages 1,2,4 vs. reported 3 would fail the contiguity conjunct, not just the count conjunct — closing the exact trap the task called out. |
| Page ordering/naming is numeric-parse-then-sort, never `.sort()` on filenames or array index, with 4-digit zero-padding | ✓ VERIFIED | `render-service/src/render.ts:150-159` sorts by `pageNumberFromOutputName`-derived integer; `renderedObjectName` (line 77-79) pads to `RENDERED_PAGE_PAD=4`. `render.test.ts` case 5 exercises a deliberately lexically-hostile 12-page input order and asserts ascending zero-padded destinations. |
| `MEDIA_PATH_GUARD` is untouched — the `rendered/` prefix needs zero changes to `cleanupExpiredMedia` | ✓ VERIFIED | `functions/src/index.ts:476` — `export const MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//;`, identical pattern to the pre-phase baseline (only its line number shifted due to new code above it). A regression test asserts it does not match `.../rendered/page-0001.png`, and a behavioural test proves `cleanupExpiredMediaHandler` never deletes a 60-day-old `rendered/` object even with deletion enabled. |
| `render-service/DEPLOY.md` is the complete owner-run handoff | ✓ VERIFIED | Read in full: opens with a no-commands-executed banner; documents both IAM directions (`pptx-render-sa`'s `roles/storage.objectAdmin` and the reverse `roles/run.invoker` grant), region, `--memory=2Gi`/`--cpu=2` explicitly flagged unvalidated, `--concurrency=1` rationale, `--timeout=300`, and env vars including `STORAGE_BUCKET` (a finding surfaced mid-phase, correctly folded in) and `PPTX_RENDER_CLEANUP_ENABLED` (documented "leave unset"). |
| The two package-legitimacy checkpoints are recorded DEFERRED, never approved, and Phases 31-35 are untouched | ✓ VERIFIED | `PENDING-VERIFICATION.md` — `grep -c '^## Phase 3[1-5]'` returns 5 (all prior sections present, byte-identical per the plan's own insertion-only `git diff` claim), `## Phase 37` section exists with items 37.1-37.6 all unchecked (`☐`), and item 37.5 transcribes both checkpoints' actual disposition rather than claiming approval. |
| `invokeRenderService` has no unauthenticated fallback | ✓ VERIFIED | `functions/src/renderInvoker.ts` — throws immediately on an empty/whitespace `renderServiceUrl` before any network call; the only egress is `client.request(...)` on the object returned by `GoogleAuth#getIdTokenClient`. No `fetch(` or bare HTTP client call exists in the file. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `render-service/Dockerfile` | Two-stage LibreOffice+Poppler+open-fonts container def | ✓ VERIFIED | Present, two `FROM` lines, `COPY --from=builder`, font policy + provenance assertion confirmed by direct read |
| `render-service/src/dockerfile.test.ts` | Region-scoped font-policy gate | ✓ VERIFIED | 15 assertions, region-scoped extraction confirmed correct |
| `render-service/src/render.ts` | soffice/pdftoppm orchestration, guard, ordering | ✓ VERIFIED | All exports present and match plan contract exactly |
| `render-service/src/server.ts`, `main.ts` | POST /render route, entrypoint | ✓ VERIFIED (not independently re-read in full, but 39/39 render-service tests pass including server.test.ts) |
| `functions/src/renderInvoker.ts` | IAM-authenticated invocation seam | ✓ VERIFIED | Read in full; no-fallback contract confirmed |
| `functions/src/index.ts` additions | Queue write, completeness check, cleanup handler | ✓ VERIFIED | Read in full for all three additions |
| `src/types/importedDeck.ts` — `renderImportId` | Deck↔render bridge field | ✓ VERIFIED | `renderImportId?: string` present |
| `src/components/PptxImportModal.vue` — renderImportId wiring | Set on PPTX path, null on image path, reset on cancel | ✓ VERIFIED | 5 usage sites confirmed matching claimed behavior |
| `render-service/DEPLOY.md` | Complete deploy handoff | ✓ VERIFIED | Read in full, all required content present |
| `.planning/PENDING-VERIFICATION.md` Phase 37 section | 6 open items | ✓ VERIFIED | Read in full, matches claims |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `parsePptxHandler` | `organizations/{orgId}/pptxRenders/{importId}` | additive `.set()` inside nested try/catch | ✓ WIRED | Confirmed in source |
| `requestPptxRenderHandler` | `functions/src/renderInvoker.ts invokeRenderService` | awaited call inside try/catch | ✓ WIRED | Confirmed in source |
| `requestPptxRenderHandler` | Cloud Storage `rendered/` prefix | independent `getFiles({ prefix })` recount | ✓ WIRED | Confirmed in source, prefix matches `render-service`'s upload destination exactly |
| `cleanupOrphanRendersHandler` | `organizations/{orgId}/pptxRenders` | `collectionGroup("pptxRenders")` scan | ✓ WIRED | Confirmed in source |
| `PptxImportModal.vue` | `ImportedDeck.renderImportId` | conditional spread into `createDeck` payload | ✓ WIRED | Confirmed in source |
| Rendered images / `pptxRenders` collection | Any UI component | — | ✗ NOT WIRED | **By design, deferred.** No component in `src/` reads either — confirmed by grep. This is the substance of Truth 1's UNCERTAIN status, not a defect: 37-CONTEXT.md explicitly scopes "client-side display rework" out of this phase. |

### Behavioral Spot-Checks / Test Suite Re-Run

| Suite | Command | Result | Status |
|---|---|---|---|
| render-service | `cd render-service && npx vitest run` | 39/39 passed (independently re-run by this verifier) | ✓ PASS |
| functions | `cd functions && npx vitest run` | 70/70 passed (independently re-run by this verifier) | ✓ PASS |
| app (scoped) | per orchestrator's gate evidence | 2221/2222 (1 documented `RosterView.test.ts` baseline) | ✓ PASS (trusted from orchestrator's independently-run gate) |
| `npm run type-check` / `npm run build` | per orchestrator's gate evidence | clean | ✓ PASS (trusted from orchestrator's independently-run gate) |

### No-Deploy Audit (independently re-verified)

`git log -p` across all `render-service`/`functions/src/index.ts`/`functions/src/renderInvoker.ts` history was
grepped for added lines containing `gcloud `, `docker build`, `docker push`, or `firebase deploy`. Every
match is either inside `render-service/DEPLOY.md`'s documentation prose or `render-service/Dockerfile`'s
comments describing when a real `docker build` would run — never an executed invocation. **PASSED**,
consistent with the orchestrator's independent audit.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| R062 | 37-01 through 37-06 | PowerPoint server-side rendering | Correctly marked `[~]` partial in `REQUIREMENTS.md` | The automated pipeline is fully built and tested; deployment and UI consumption are the explicitly-scoped, owner-authorized remainder. Traceability table row updated accordingly. |

No orphaned requirements found for this phase.

### Anti-Patterns Found

None. Swept `render-service/src`, `functions/src/index.ts`, `functions/src/renderInvoker.ts`,
`src/components/PptxImportModal.vue`, `src/types/importedDeck.ts`, `render-service/Dockerfile`, and
`render-service/DEPLOY.md` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers. Zero blocking or
warning-level hits (one incidental match — `functions/src/index.ts:343`'s comment "a tested behaviour,
not a TODO" — is documentation prose, not a debt marker).

### Human Verification Required

See the `human_verification` list in the frontmatter above (six items, mirroring
`PENDING-VERIFICATION.md`'s Phase 37 items 37.1–37.6 exactly). All six are already honestly recorded as
open, unchecked owner to-dos in the planning record — this verification confirms that record is accurate
and that none of the six has been silently self-approved.

### Gaps Summary

No coding gaps were found. Every artifact claimed by the six plan SUMMARYs was independently read and
confirmed present, substantive, and correctly wired; the two sharpest correctness traps (the completeness
check's parser-count trap and contiguity conjunct, and the cleanup handler's dry-run gate direction) were
verified directly in source, not merely trusted from the SUMMARYs' own deliberate-failure narrations. Both
independently-re-run test suites (render-service 39/39, functions 70/70) pass. The no-deploy prohibition
holds under direct `git log` inspection.

The phase goal — "Imported PowerPoint decks render server-side to true-fidelity images, retaining parsed
text as a searchable layer" — is **not yet observably true for any real user**, and that is the correct,
honest state given two facts this run did not control: (1) an explicit owner instruction to build but not
deploy the Cloud Run service, and (2) 37-CONTEXT.md's explicit phase-boundary decision to defer
client-side display of rendered images to a later phase (no such phase currently exists in ROADMAP.md —
Phase 36 is UI Rework for service ordering, unrelated). This is why `status: human_needed` rather than
`gaps_found`: there is no code defect to close via `/gsd-plan-phase --gaps`, only owner decisions
(deploy, sign off on new dependencies, review a dry-run log) that no autonomous run may make on the
owner's behalf. `passed` would misrepresent the state of the goal, per STATE.md's standing autonomy grant
("never record a deferred check as passed") — hence this is not marked passed despite the very high
quality and completeness of the underlying automated work.

---

*Verified: 2026-08-03*
*Verifier: Claude (gsd-verifier)*
