# Phase 37: PowerPoint Server-Side Rendering - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey areas proposed with recommendations and auto-accepted under
the STATE.md standing autonomy grant. Accepted answers are Claude's recommendations, not owner
statements — reversible defaults. **The deploy prohibition below is NOT one of these: it is a direct
owner instruction and is not reversible by this run.**

<domain>
## Phase Boundary

Imported PowerPoint decks render server-side to true-fidelity images, with the already-extracted text
retained as a searchable layer alongside them. Single requirement: **R062**.

**In scope:** a standalone Cloud Run service (custom Dockerfile, LibreOffice + Poppler); a bridging
Cloud Function invoking it asynchronously over service-to-service IAM; the completeness check that
gates the deck's "ready" flip; storage under `orgs/{orgId}/pptx-imports/{importId}/rendered/`; the
font policy; any orphan-cleanup path for failed renders; and tests for every seam that can be tested
without a container.

**Out of scope:** rewriting `pptxParser.ts` (criterion 2 keeps the text layer *alongside* the image —
this is additive); any change to `cleanupExpiredMedia` (the `rendered/` prefix was chosen precisely so
that function needs zero changes); client-side display rework beyond storing and referencing the
images (Phase 33 owns backgrounds, Phase 35 owns presentation); Phase 36 and Phase 34's open gap.

</domain>

<decisions>
## Implementation Decisions

### ★★ THE DEPLOY PROHIBITION — an owner instruction, not a preference

**STATE.md, v1.4 standing decisions:** *"Phase 37 (PPTX rendering): **BUILD BUT DO NOT DEPLOY.** Write
the Cloud Run service, Dockerfile, bridging Cloud Function and tests, then STOP and hand the owner the
exact `gcloud run deploy` command. Deploying provisions billable infrastructure — it is the owner's
call, not the run's."*

**Concretely, this run must NOT:**

| Forbidden | Why |
|---|---|
| `gcloud` anything — `run deploy`, `builds submit`, `artifacts`, `iam`, project config | Provisions billable infrastructure |
| `firebase deploy` (any target, including `--only functions`) | Same, plus rules are separately deferred (backlog 999.3) |
| `docker build` / `docker push` | Needs a daemon, pulls a large LibreOffice base image, and proves little a Dockerfile review does not |
| Creating **any** GCP resource, service account, IAM binding, or Artifact Registry repo | Owner's call |

**The deliverable is therefore:** reviewable source (service + Dockerfile + bridging function),
tests for every seam testable without a container, and **the exact `gcloud run deploy` command with
every flag explained and every prerequisite listed** — service account, IAM roles, Artifact Registry,
region, memory/CPU (LibreOffice is memory-hungry), timeout, and concurrency.

**What CAN and SHOULD still be verified without deploying:** the bridging function's logic, the
completeness check, the storage-path guards, the font-policy assertion, the dry-run default, and the
*shape* of the IAM contract. Test the seams; leave the container itself to human verification. Do not
treat "can't deploy" as "can't verify anything."

### Render Pipeline

- **A standalone Cloud Run service with a custom Dockerfile** (LibreOffice + Poppler). Firebase
  Functions buildpacks cannot install these — R062 and the ROADMAP both say so explicitly.
- **A bridging Cloud Function invokes it asynchronously over service-to-service IAM auth.** Rendering
  a deck is far too slow for a synchronous callable; the existing `parsePptx` is `onCall` and must not
  be made to block on rendering.
- **★ The deck flips to "ready" ONLY after a completeness check confirms every expected image is
  uploaded.** A partially-rendered deck that presents on a Sunday morning is the failure this guards.
  Confirm the count, not just the absence of an error.
- **Fonts: Carlito / Caladea / Liberation only** — metric-compatible open substitutes for
  Calibri / Cambria / Arial-Times-Courier. **Never bundle Microsoft fonts** (criterion 3, and a
  licensing matter, not just a preference).

### Failure Handling & Cleanup

- **★ Any new deletion path defaults to DRY-RUN, requiring an explicit opt-in env var**, mirroring
  `functions/src/index.ts:257`'s `const dryRun = process.env.MEDIA_CLEANUP_ENABLED !== "true"` exactly.
  **This codebase has already had a real incident from the inverse default** — `cleanupExpiredMedia`'s
  doc comment claimed dry-run-by-default while the code deleted by default on a daily 02:00 UTC
  schedule (fixed 2026-07-28, `9f1b881`). Do not reproduce that shape. Include fail-safe regression
  tests as that fix did.
- **A partial or failed render leaves the deck un-ready and the text layer fully usable.** Rendering is
  an enhancement over the parsed text that already works — a render failure must never lose it.
- **Images land under `orgs/{orgId}/pptx-imports/{importId}/rendered/`** — sibling to `images/`.
  Verified: `MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//` (`functions/src/index.ts:241`) does not match
  it, so it is structurally exempt from `cleanupExpiredMedia` **with zero changes to that function**.
- **Cost and latency cannot be validated without deploying.** Say so plainly rather than estimating
  and calling it validated. The ROADMAP is explicit that this needs *"a real multi-font, multi-slide
  test deck"* — **a 2-slide fixture proves nothing** about either fidelity or cost.

### Claude's Discretion

- Base image choice and how LibreOffice/Poppler are installed within the no-MS-fonts constraint.
- The bridging function's trigger shape (Firestore trigger vs. an explicit call from `parsePptx`).
- Image format and resolution, and whether one file per slide or a sprite.
- How the expected-image count is derived and where it is stored for the completeness check.

</decisions>

<code_context>
## Existing Code Insights

### Integration Points
- **`functions/src/index.ts`** — `parsePptxHandler` / `parsePptx` (`onCall`, `:152`/`:199`), with a
  storage-path guard requiring the `orgs/${orgId}/pptx-imports/` prefix (`:168`). This is where the
  render invocation hooks in.
- **`functions/src/pptxParser.ts`** — `parsePptxBuffer(buffer, orgId, importId)` returning
  `MappedSlide[]`. **Not rewritten by this phase** — the text layer it produces is what criterion 2
  keeps alongside the rendered image.
- **`functions/src/index.ts:241`** — `MEDIA_PATH_GUARD`. **Do not touch.**
- **`functions/src/index.ts:257`** — the dry-run default to mirror.
- **`functions/` has its own `package.json`, `tsconfig.json` and `vitest.config.ts`** — a separate test
  suite from the app's. `npx vitest run src/` does **not** cover it.

### Established Patterns
Cloud Functions v2 (`onCall`), TypeScript, explicit auth/org checks before any storage access,
fail-safe env-var gating for destructive operations, and regression tests that pin the *safe*
default (the `9f1b881` precedent).

</code_context>

<specifics>
## Specific Ideas

- The ROADMAP's own framing is the sharpest guidance: this is the *"highest-uncertainty item in the
  milestone"*, deliberately scheduled last *"so an overrun or cut cannot disturb the other 33
  requirements."* If something here proves intractable, **cutting it is an acceptable outcome and
  disturbs nothing** — that is why it is last. Prefer an honest partial with a clear handoff over a
  speculative whole.
- **Test the completeness check hard.** It is the one piece of logic that stands between a failed
  render and a broken Sunday service, and it is fully testable without a container.

</specifics>

<deferred>
## Deferred Ideas

- **The actual deployment** — `gcloud run deploy`, service account creation, IAM bindings, Artifact
  Registry. Handed to the owner as an explicit command with prerequisites. Also relevant:
  `firebase deploy --only firestore:rules` is separately deferred (backlog 999.3) and must run before
  v1.4 ships.
- **Cost and latency validation** with a real multi-font, multi-slide deck — requires the deployed
  service.
- **Client-side display rework** for rendered images beyond storing and referencing them.
- **Re-rendering existing imports.** Nothing says previously-imported decks must be backfilled; a
  backfill is its own migration with its own cost profile.

</deferred>
