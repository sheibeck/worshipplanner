# Phase 37: PowerPoint Server-Side Rendering - Research

**Researched:** 2026-08-03
**Domain:** Async server-side document rendering (LibreOffice + Poppler on Cloud Run), service-to-service
GCP IAM, Firebase Cloud Functions v2 bridging
**Confidence:** MEDIUM — the bridging-function logic, completeness check, path guards, and dry-run default
are HIGH confidence (testable, verified against live source). The Dockerfile/container internals, exact
render fidelity, and cost/latency are MEDIUM-to-LOW — genuinely unverifiable without building and
deploying, which this research run is prohibited from doing (see the deploy prohibition in
`37-CONTEXT.md`, restated below).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**★★ THE DEPLOY PROHIBITION — an owner instruction, not a preference.** STATE.md v1.4 standing decision:
*"Phase 37 (PPTX rendering): BUILD BUT DO NOT DEPLOY. Write the Cloud Run service, Dockerfile, bridging
Cloud Function and tests, then STOP and hand the owner the exact `gcloud run deploy` command. Deploying
provisions billable infrastructure — it is the owner's call, not the run's."* Concretely forbidden:
`gcloud` anything, `firebase deploy` (any target), `docker build`/`docker push`, creating any GCP
resource/service-account/IAM-binding/Artifact-Registry repo. The deliverable is reviewable source (service
+ Dockerfile + bridging function), tests for every seam testable without a container, and the exact
`gcloud run deploy` command with every flag explained.

- A standalone Cloud Run service with a custom Dockerfile (LibreOffice + Poppler) — Firebase Functions
  buildpacks cannot install these.
- A bridging Cloud Function invokes it asynchronously over service-to-service IAM auth; `parsePptx`
  (existing `onCall`) must not be made to block on rendering.
- ★ The deck flips to "ready" ONLY after a completeness check confirms every expected image is uploaded —
  confirm the count, not just the absence of an error.
- Fonts: Carlito / Caladea / Liberation only. Never bundle Microsoft fonts (licensing, not preference).
- ★ Any new deletion path defaults to DRY-RUN, requiring an explicit opt-in env var, mirroring
  `functions/src/index.ts:257`'s `const dryRun = process.env.MEDIA_CLEANUP_ENABLED !== "true"` exactly.
  This codebase already had a real incident from the inverse default (fixed 2026-07-28, `9f1b881`).
- A partial or failed render leaves the deck un-ready and the text layer fully usable — a render failure
  must never lose the already-working parsed text.
- Images land under `orgs/{orgId}/pptx-imports/{importId}/rendered/` — sibling to `images/`. Verified:
  `MEDIA_PATH_GUARD` does not match it, so it is structurally exempt from `cleanupExpiredMedia` with zero
  changes to that function.
- Cost and latency cannot be validated without deploying — say so plainly rather than estimating and
  calling it validated. A 2-slide fixture proves nothing about fidelity or cost.

### Claude's Discretion

- Base image choice and how LibreOffice/Poppler are installed within the no-MS-fonts constraint.
- The bridging function's trigger shape (Firestore trigger vs. an explicit call from `parsePptx`).
- Image format and resolution, and whether one file per slide or a sprite.
- How the expected-image count is derived and where it is stored for the completeness check.

### Deferred Ideas (OUT OF SCOPE)

- The actual deployment — `gcloud run deploy`, service account creation, IAM bindings, Artifact Registry.
  Handed to the owner as an explicit command with prerequisites.
- Cost and latency validation with a real multi-font, multi-slide deck — requires the deployed service.
- Client-side display rework for rendered images beyond storing and referencing them.
- Re-rendering existing imports (no backfill).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R062 | PowerPoint import produces a true visual representation of each slide — backgrounds, fonts, layout, effects — not text alone. Rendered server-side to images via a standalone Cloud Run service (LibreOffice + Poppler, custom Dockerfile), invoked asynchronously. Extracted text retained as a searchable layer. Images land under `orgs/{orgId}/pptx-imports/{importId}/rendered/`. Only metric-compatible open fonts. Orphan cleanup defaults to dry-run. | Dockerfile sketch + font policy (Standard Stack, Code Examples); async bridge design + completeness check (Architecture Patterns, Pitfall 1); path-guard exemption verified (Don't Hand-Roll / Pitfall 3); dry-run default mirrored from `cleanupExpiredMedia` (Code Examples, Common Pitfalls); orphan cleanup design (Architecture Patterns); `gcloud run deploy` handoff command (Environment Availability / Metadata) |
</phase_requirements>

## Summary

R062 layers true-fidelity image rendering onto the existing PPTX import path without touching it.
`parsePptxHandler`/`parsePptxBuffer` stay exactly as they are — the text/image heuristic mapper
(`mapAstToSlides`) is not rewritten, and its output count is deliberately **never** used as the expected
render-page count (see Pitfall 1, the sharpest correctness question in this phase). Rendering is a fully
separate, decoupled pipeline: a new lightweight Firestore doc queues the render request, a Firestore-
triggered Cloud Function invokes a private Cloud Run service over ID-token auth, the Cloud Run service
does the actual LibreOffice→PDF→PNG conversion and uploads pages directly to Storage, and the triggering
function performs its own independent Storage listing to confirm every expected page landed before
flipping status to "ready" — mirroring the codebase's existing "never trust the caller alone, re-verify
independently" pattern from `parsePptxHandler`'s org-membership check.

A second, **load-bearing but non-obvious** finding: the Storage `importId` used in
`orgs/{orgId}/pptx-imports/{importId}/...` (client-generated via `crypto.randomUUID()`) and the Firestore
document id of the eventual `ImportedDeck` (auto-assigned by `addDoc()` on confirm) are **two different,
currently-unlinked identifiers** — verified by reading `PptxImportModal.vue`, `importedSlides.ts`, and
`importedDeck.ts`. Nothing today persists the Storage `importId` onto the confirmed deck. Any design that
tries to look up "the render for this deck" starting from the deck's own Firestore id will fail unless
this link is added. The plan must budget one small additive field for it.

**Primary recommendation:** Trigger rendering from a new `organizations/{orgId}/pptxRenders/{importId}`
Firestore doc, written by `parsePptxHandler` itself (which already holds both `orgId` and the Storage
`importId`) immediately after a successful parse — NOT from the confirmed `ImportedDeck` doc, and NOT as
a blocking call inside the existing `onCall`. A new `onDocumentCreated` trigger function does the slow
work (invoke Cloud Run, await its response, independently recount Storage, flip status). Persist the
Storage `importId` onto `ImportedDeck` at confirm time (`renderImportId?: string`) so a future UI can join
a deck to its render status — that join is the only client-side change this phase needs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PPTX text/image extraction (existing, unchanged) | API / Backend (`functions/`, `parsePptxHandler`) | — | Already-shipped Cloud Function; out of scope to modify (CONTEXT: "Not rewritten by this phase") |
| Render-request queuing | API / Backend (`functions/`, additive write in `parsePptxHandler`) | Database / Storage (new Firestore doc) | A durable queue entry, not a direct synchronous call — decouples the fast user-facing `onCall` from the slow render |
| True-fidelity slide rendering (LibreOffice + Poppler) | Specialized Backend Worker (standalone Cloud Run service, own Dockerfile) | — | Firebase Functions buildpacks cannot install LibreOffice/Poppler (R062, verified: no APT/system-package install hook exists in the Cloud Functions buildpack contract) |
| Render-request bridging + completeness check | API / Backend (`functions/`, new `onDocumentCreated` trigger) | — | Owns the IAM-authenticated call to Cloud Run and the independent Storage recount; must live where Admin SDK Firestore/Storage access already exists |
| Rendered image storage | Database / Storage (Cloud Storage, `rendered/` prefix) | — | Sibling to the existing `images/` prefix; structurally exempt from `cleanupExpiredMedia` |
| Font policy enforcement | Build / Container (Dockerfile, `render-service/`) | — | Enforced at image-build time (apt package selection) and asserted at build time (Pitfall 2), not at runtime |
| Orphan-render cleanup | API / Backend (`functions/`, new scheduled function) | Database / Storage | Mirrors `cleanupExpiredMedia`'s shape but is a **separate** function — CONTEXT is explicit that `cleanupExpiredMedia` itself gets zero changes |
| Service-to-service auth (Function → Cloud Run) | API / Backend boundary | GCP IAM (platform-enforced, not app code) | ID-token audience + `roles/run.invoker`; the actual access decision is made by the Cloud Run platform before the request reaches application code, not by anything this phase writes |
| Client display of rendered images | Browser / Client | — | **Out of scope this phase** beyond storing/referencing the Storage paths — no UI consumption is built |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| LibreOffice (`libreoffice-impress` + deps) | Debian bookworm's packaged version (not independently pinned — apt resolves it) | `.pptx` → `.pdf` conversion, preserving layout/fonts/effects | The only widely-used FOSS engine that renders OOXML decks with real layout fidelity; this is what every "convert PPTX to PDF headless" service in the ecosystem uses under the hood `[CITED: oneuptime.com/blog/2026-02-08-how-to-run-libreoffice-in-docker-for-document-conversion]` |
| Poppler (`poppler-utils`, specifically `pdftoppm`) | Debian bookworm's packaged version | `.pdf` → per-page `.png` rasterization | Standard, fast, dependency-light PDF rasterizer; ships one file per page by construction, which is exactly the per-slide-image shape R062 needs `[CITED: manpages.debian.org/testing/poppler-utils/pdftoppm.1.en.html]` |
| `google-auth-library` | `^11.0.0` (npm view confirmed 2026-08-03) `[ASSUMED — package name from training/WebSearch, registry existence confirmed but not via Context7/official docs this session]` | Mints the OIDC ID token the bridging function sends to the private Cloud Run service | Google's own official Node auth client; `GoogleAuth#getIdTokenClient(audience)` is the documented, supported way to call a private Cloud Run service from another Google-managed identity `[CITED: docs.cloud.google.com/run/docs/authenticating/service-to-service]` |
| `@google-cloud/storage` | `^7.21.0` (npm view confirmed 2026-08-03) `[ASSUMED — same provenance caveat as above]` | Cloud Run service's own Storage read (source `.pptx`) / write (`rendered/*.png`) | Official Google client, functionally equivalent to the `firebase-admin/storage` wrapper `functions/` already uses, but the render service is a plain Node service, not a Firebase Function, so it uses the underlying client library directly rather than the Admin SDK |
| `express` | `^5.2.1` (npm view confirmed 2026-08-03) `[ASSUMED — same provenance caveat]` | Minimal HTTP server for the Cloud Run service's single `/render` route | Cloud Run services are "any container that listens on `$PORT`"; Express is the path-of-least-friction HTTP framework already familiar from this ecosystem, not a new paradigm |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fonts-crosextra-carlito` (apt) | Debian bookworm packaged | Metric-compatible Calibri substitute | Always — required by R062 |
| `fonts-crosextra-caladea` (apt) | Debian bookworm packaged | Metric-compatible Cambria substitute | Always — required by R062 |
| `fonts-liberation` (apt) | Debian bookworm packaged | Metric-compatible Arial/Times New Roman/Courier New substitutes | Always — required by R062 |
| `vitest` | `^4.1.10` (matches `functions/package.json`, already installed) | Test runner for both `functions/` and the new `render-service/` | Reuse the exact version already pinned in `functions/` for consistency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LibreOffice headless | A hosted conversion API (CloudConvert, Aspose Cloud, etc.) | Adds a third-party billing relationship and a network dependency outside GCP; R062 and the ROADMAP explicitly mandate LibreOffice+Poppler on a custom Cloud Run Dockerfile, so this is not a live option |
| Cloud Run (HTTP request/response) | Cloud Run Jobs, or a Pub/Sub-triggered Cloud Run service | Cloud Run Jobs have no HTTP endpoint (harder to invoke synchronously-within-the-trigger, needs the Jobs API instead of a simple authenticated fetch); a request/response Cloud Run **service** is simpler to invoke from a Cloud Function via `google-auth-library` and is what CONTEXT's "service-to-service IAM auth" language directly describes |
| Firestore-doc-as-queue (recommended) | Cloud Tasks / Pub/Sub | Firestore-doc-as-queue reuses infrastructure (Firestore, Admin SDK, existing test patterns) already in this codebase with zero new GCP products to provision; Cloud Tasks/Pub/Sub would work equally well but add a new service to the deploy handoff list for no functional gain at this scale (one render per import, not a high-throughput queue) |
| `@google-cloud/storage` in the render service | `firebase-admin/storage` | The render service is NOT a Firebase Function (it's a plain container), so pulling in the full `firebase-admin` SDK (which bootstraps a Firebase App) is unnecessary weight; the plain `@google-cloud/storage` client is the correct-layer choice |

**Installation:**
```bash
# functions/ (existing project) — one new dependency for the bridging function
cd functions && npm install google-auth-library@^11.0.0

# render-service/ (new project, does NOT exist yet — created by this phase)
mkdir render-service && cd render-service
npm init -y
npm install express@^5.2.1 @google-cloud/storage@^7.21.0
npm install -D typescript vitest@^4.1.10
```

**Version verification:** `npm view google-auth-library version` → `11.0.0` (published 2026-07-30);
`npm view @google-cloud/storage version` → `7.21.0` (published 2026-06-08); `npm view express version` →
`5.2.1` (published 2025-12-01). All confirmed against the live npm registry 2026-08-03. LibreOffice/Poppler
versions are NOT independently pinned — they resolve to whatever `apt-get install` on the chosen Debian
base image provides at build time; this is normal for system-package-based Dockerfiles but means the
exact LibreOffice version is unknown until the image is actually built (deferred — deploy prohibition).

## Package Legitimacy Audit

| Package | Registry | Age (latest ver.) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `google-auth-library` | npm | 4 days (11.0.0, 2026-07-30) | 77.5M/wk | github.com/googleapis/google-cloud-node | SUS (`too-new`) | Flagged — planner must add `checkpoint:human-verify` before install |
| `@google-cloud/storage` | npm | ~2 months (7.21.0, 2026-06-08) | 15.5M/wk | github.com/googleapis/google-cloud-node | OK | Approved |
| `express` | npm | ~8 months (5.2.1, 2025-12-01) | 128.3M/wk | github.com/expressjs/express | OK | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `google-auth-library` — flagged purely on the `too-new` heuristic
(latest version published 4 days before this research). **Context that matters:** running the same checker
against this repo's own already-installed, already-shipping dependencies `firebase-admin` (latest
2026-07-16) and `firebase-functions` (latest 2026-07-28) produces the identical `SUS`/`too-new` verdict —
Google's release cadence for its Node client libraries is simply fast, and "latest published within two
weeks" is normal for this vendor, not a hallucination signal. The package is the correct, well-known,
officially-maintained client for exactly this use case (77M weekly downloads, official `googleapis` GitHub
org). Per protocol this stays tagged SUS and the planner must still gate its install behind a
`checkpoint:human-verify` task — but the human check should be fast (`npm view google-auth-library repository`
+ eyeball the GitHub org), not a deep investigation.

*`google-auth-library`, `@google-cloud/storage`, and `express` were all identified from training
knowledge/WebSearch, not from Context7 or another authoritative source this session — registry existence
alone does not upgrade them past `[ASSUMED]` per the provenance rule. Gate each behind
`checkpoint:human-verify` regardless of the table verdict above.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────┐   upload .pptx    ┌──────────────────────────┐
│   Browser    │ ────────────────▶│ Storage: orgs/{orgId}/    │
│ (PptxImport  │                   │ pptx-imports/{importId}/  │
│  Modal.vue)  │                   │ source.pptx (unchanged)   │
└──────┬───────┘                   └──────────────┬────────────┘
       │ onCall("parsePptx")                       │
       ▼                                            │ download
┌─────────────────────────────────────────────┐    │
│ parsePptxHandler (EXISTING, unchanged logic) │────┘
│  - auth + org-membership check               │
│  - parsePptxBuffer() -> MappedSlide[]        │
│  - uploads extracted images to images/       │
│  - ★NEW: writes one Firestore doc            │
│    organizations/{orgId}/pptxRenders/        │
│    {importId} = {status:'pending', ...}      │
└──────────────────┬────────────────────────────┘
                    │ returns {slides} to browser (FAST — unchanged latency)
                    │
                    │ (separately, async) Firestore onCreate fires
                    ▼
┌───────────────────────────────────────────────────┐
│ requestPptxRenderHandler (NEW, onDocumentCreated)  │
│  1. build ID token, audience = Cloud Run URL       │
│  2. POST {orgId, importId, storagePath} to /render │
│  3. AWAIT response (may take tens of seconds)      │
│  4. bucket.getFiles(prefix=".../rendered/") --     │
│     INDEPENDENT recount, never trust step 3 alone  │
│  5. if actualCount === reportedCount: status=ready │
│     else: status=failed (text layer stays usable)  │
└───────────────────┬─────────────────────────────────┘
        ID-token authenticated HTTPS POST (roles/run.invoker)
                    ▼
┌───────────────────────────────────────────────────┐
│ Cloud Run service "pptx-render" (NEW, private,     │
│ --no-allow-unauthenticated, custom Dockerfile)     │
│  1. download source.pptx from Storage              │
│  2. soffice --headless --convert-to pdf            │
│     (-env:UserInstallation -> /tmp, per-request)   │
│  3. pdftoppm -png -r 150 -> page-1.png..page-N.png │
│  4. upload each page to Storage under rendered/    │
│  5. respond {renderedCount: N}                     │
└─────────────────────────────────────────────────────┘
                    │ direct Storage writes (own SA, no Firestore access)
                    ▼
         orgs/{orgId}/pptx-imports/{importId}/rendered/{0..N-1}.png

(separately, on user "Confirm Import"): ImportedDeck doc created with
`renderImportId` = the same Storage importId, so a future UI can later
join deck -> pptxRenders/{renderImportId} to display the images (deferred).

(separately, daily): cleanupOrphanRendersHandler (NEW, onSchedule, dry-run
by default via PPTX_RENDER_CLEANUP_ENABLED) scans pptxRenders docs stuck
'pending'/'failed' beyond a staleness window + their rendered/ objects.
```

A reader can trace the primary path top-to-bottom: browser upload → existing parse (unchanged, fast) →
new queue doc → new trigger function → private Cloud Run service → Storage → independent recount →
status flip. The user-facing `onCall` never waits on any of the LibreOffice work.

### Recommended Project Structure

```
functions/                          # EXISTING — Cloud Functions project, unchanged shape
├── src/
│   ├── index.ts                    # + one additive write in parsePptxHandler
│   │                                #   + new requestPptxRenderHandler/onDocumentCreated export
│   │                                #   + new cleanupOrphanRendersHandler/onSchedule export
│   ├── index.test.ts                # + tests for both new handlers
│   ├── pptxParser.ts                # UNCHANGED
│   └── renderInvoker.ts             # NEW — thin wrapper around google-auth-library's
│                                     #   getIdTokenClient, isolated so it can be mocked
│                                     #   in requestPptxRenderHandler's tests
render-service/                     # NEW — standalone deployable, NOT a Firebase Function
├── Dockerfile                      # LibreOffice + Poppler + fonts, custom build
├── package.json                    # own deps: express, @google-cloud/storage
├── tsconfig.json
├── vitest.config.ts                # mirrors functions/vitest.config.ts (node env)
└── src/
    ├── server.ts                   # Express app, single POST /render route
    ├── render.ts                   # soffice + pdftoppm orchestration (execFile calls)
    └── render.test.ts              # tests the route/validation logic with execFile mocked
```

Keeping `render-service/` OUT of `functions/` is deliberate: `firebase.json`'s `functions` config points
at `functions/` as the deploy source for buildpack-based Cloud Functions — nesting a custom-Dockerfile
Cloud Run service inside that tree risks `firebase deploy --only functions` attempting to build it via
buildpacks, which is exactly the capability gap R062 exists because of.

### Pattern 1: Firestore-doc-as-queue for async work behind a fast `onCall`

**What:** A Cloud Function that must respond quickly (`parsePptx`, currently `timeoutSeconds: 120`) writes
a small Firestore doc describing work to be done, rather than performing that work inline. A separate
`onDocumentCreated` trigger picks it up and does the slow part on its own time budget.
**When to use:** Any time a user-facing `onCall`'s response must not block on work whose duration is
unpredictable or minutes-long (exactly R062's constraint: "far too slow for a synchronous callable").
**Example:**
```typescript
// functions/src/index.ts — additive to the END of parsePptxHandler's try block,
// AFTER the existing `const slides = await parsePptxBuffer(...)` line and BEFORE
// `return { slides }`. Does not change parsePptxHandler's return shape or timing
// in any way a caller can observe beyond one extra Firestore write (~tens of ms).
await getFirestore()
  .collection("organizations").doc(orgId)
  .collection("pptxRenders").doc(importId)
  .set({
    status: "pending",
    storagePath,
    createdAt: FieldValue.serverTimestamp(),
  });
```

### Pattern 2: Independent recount before flipping a "ready" flag

**What:** Never trust a downstream service's self-reported success count. After it responds, re-derive
the ground truth independently (here: list the actual Storage objects) and only flip status if the two
agree.
**When to use:** Any completeness gate where a partial success must never look identical to a full
success — exactly R062's "★ The deck flips to ready ONLY after a completeness check confirms every
expected image is uploaded."
**Example:**
```typescript
// functions/src/index.ts — inside requestPptxRenderHandler, after awaiting the
// Cloud Run response. Mirrors parsePptxHandler's own "never trust the client-
// declared orgId alone, independently re-verify" pattern (see :172-181 above).
const renderResult = await invokeRenderService({ orgId, importId, storagePath });
const prefix = `orgs/${orgId}/pptx-imports/${importId}/rendered/`;
const [uploaded] = await getStorage().bucket().getFiles({ prefix });

const complete = uploaded.length > 0 && uploaded.length === renderResult.renderedCount;
await renderDocRef.set(
  complete
    ? { status: "ready", renderedCount: uploaded.length, updatedAt: FieldValue.serverTimestamp() }
    : { status: "failed", renderedCount: uploaded.length, updatedAt: FieldValue.serverTimestamp() },
  { merge: true },
);
```

### Anti-Patterns to Avoid

- **Using `MappedSlide[].length` (parsePptxBuffer's output) as the expected rendered-page count.** The
  text/image heuristic mapper SKIPS slides with neither substantial text nor images, and emits MULTIPLE
  entries for a single slide with several images — its length is not, and was never intended to be, the
  original deck's page count. See Pitfall 1.
- **Awaiting the Cloud Run render call inside `parsePptxHandler`'s own `onCall` response path.** This
  directly violates the CONTEXT constraint ("must not be made to block on rendering") and would push
  `parsePptx`'s effective latency from ~seconds to potentially over a minute, on the interactive upload
  path the user is actively watching a spinner for.
- **Trusting the Cloud Run service's self-reported `renderedCount` without an independent Storage
  listing.** A response can be lost/truncated/lie about a partial write; the codebase's own established
  pattern (parsePptxHandler's independent org-membership re-check) is to never trust a single source for
  a security- or correctness-critical decision.
- **Folding orphan-render cleanup into `cleanupExpiredMedia`.** CONTEXT is explicit that function must get
  **zero changes** — its entire safety argument ("structurally incapable of touching Firestore",
  path-guard-first) depends on staying untouched. A second, purpose-built scheduled function is correct.
- **Putting `render-service/` inside `functions/`.** Firebase's functions deploy path uses buildpacks;
  co-locating a custom-Dockerfile deployable there risks accidental buildpack pickup and muddles which
  `npm install` / `tsconfig` governs which files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PPTX → image rendering fidelity | A custom OOXML layout/rendering engine | LibreOffice (`soffice --convert-to pdf`) + Poppler (`pdftoppm`) | Reproducing PowerPoint's layout engine (masters, themes, effects, embedded media positioning) is a multi-year undertaking; LibreOffice already does this and is what R062 mandates |
| Service-to-service authentication | Hand-rolled shared-secret headers, custom JWT signing | `google-auth-library`'s `GoogleAuth#getIdTokenClient(audience)` + Cloud Run's `roles/run.invoker` IAM | GCP's ID-token mechanism is platform-verified before the request even reaches application code — a hand-rolled header check is both weaker (app code must get every case right) and redundant (the platform already gates it) |
| Detecting "is this a Microsoft font" at build time | A manual eyeballed list checked by a human before every deploy | A build-time `dpkg -l | grep` assertion in the Dockerfile that fails the build if `mscorefonts`/`msttcorefonts` packages are present | R062 criterion 3 needs an assertion, not an intention — this is the cheapest testable gate that catches a future base-image change bundling MS fonts transitively |
| Path-scoping for a new destructive/status-flipping path | A bespoke ad-hoc guard per new function | The same `^orgs\/[^/]+\/pptx-imports\/[^/]+\/` regex-guard style already established at `functions/src/index.ts:168` and `:241` | One well-tested pattern, reused, is safer than a fresh regex per feature |

**Key insight:** every non-trivial piece of this phase (rendering fidelity, cross-service auth,
font-provenance assertion) already has a standard, battle-tested mechanism in the GCP/LibreOffice
ecosystem. The actual engineering work in this phase is **composition and defense-in-depth wiring**
(independent recount, fail-safe cleanup default, decoupled queue), not building any of those primitives
from scratch.

## Runtime State Inventory

Not applicable — this is a greenfield addition (new Cloud Run service, new Firestore collection, new
Storage prefix), not a rename/refactor/migration phase. No existing stored data, live service config, or
OS-registered state needs to change.

## Common Pitfalls

### Pitfall 1: Treating the parser's slide count as the render's expected page count

**What goes wrong:** A "completeness check" implemented as `renderedImages.length === MappedSlide[].length`
will falsely report failure (or worse, falsely report success) on any deck where the heuristic text/image
mapper's output count differs from the deck's actual page count — which is common, not an edge case.
**Why it happens:** `mapAstToSlides` (verified: `functions/src/pptxParser.ts:86-135`) SKIPS slides with no
substantial text and no images entirely (line 131: "Neither substantial text nor images — skip this slide
entirely"), and emits ONE `MappedImageSlide` PER IMAGE on a multi-image slide (lines 115-128) — so a
6-slide deck with one text-only title slide and one 3-image collage slide produces `MappedSlide[].length`
of 4 (1 text + 3 images... minus the skipped slide), while LibreOffice+Poppler will render exactly 6 pages
(one per actual PPTX slide, always 1:1, regardless of content).
**How to avoid:** Decouple the two counts entirely. The render pipeline's "expected count" comes from
LibreOffice/Poppler's own output (the number of `.png` files `pdftoppm` actually produced), self-reported
by the Cloud Run service and then INDEPENDENTLY reconfirmed via a Storage listing by the bridging function
(Pattern 2 above). `parsePptxBuffer`'s output is never consulted for this purpose.
**Warning signs:** A completeness-check test that constructs its expected count from a `MappedSlide[]`
fixture rather than from a hardcoded/mocked render-service response is testing the wrong invariant.

### Pitfall 2: Assuming font packages alone guarantee Calibri/Cambria substitution

**What goes wrong:** Installing `fonts-crosextra-carlito`/`fonts-crosextra-caladea` makes the font FILES
available to the system, but LibreOffice's own substitution table (or a fontconfig alias) is what actually
maps a document's declared "Calibri" font-family name to the installed "Carlito" glyphs at render time.
Skipping that step can silently fall back to LibreOffice's own generic default substitution (historically
Liberation Sans/Serif for anything unrecognized), which is visually different from Carlito/Caladea even
though it is still technically "not a Microsoft font."
**Why it happens:** `[CITED: bertvv.github.io/cheat-sheets/LibreOffice.html, wiki.debian.org/SubstitutingCalibriAndCambriaFonts]`
— font *availability* and font *substitution mapping* are two separate configuration surfaces.
**How to avoid:** In addition to `apt-get install fonts-crosextra-carlito fonts-crosextra-caladea
fonts-liberation`, either (a) ship a fontconfig alias XML mapping Calibri→Carlito / Cambria→Caladea under
`/etc/fonts/conf.d/`, or (b) set LibreOffice's own registrymodifications.xcu substitution table
programmatically at container build time. This must be verified by a human at first real render (cannot be
proven without building the container) — flagged as a human-verify item.
**Warning signs:** A rendered slide's headline font visually looks like Liberation Sans instead of Carlito
despite both packages being installed.

### Pitfall 3: LibreOffice's `UserInstallation` profile on a shared/read-only path

**What goes wrong:** `soffice --headless` bootstraps a user profile on first launch; if that profile
directory is not writable (or is shared across concurrent invocations), conversion fails with errors like
"source file could not be loaded" or hangs on a stale lock file.
**Why it happens:** `[LOW confidence, ASSUMED from general LibreOffice-in-container community reports —
not confirmed against an official LibreOffice doc this session]` — LibreOffice's default profile location
assumes a normal writable `$HOME`; containers frequently run with a minimal or non-writable filesystem
outside specific paths. Cloud Run specifically guarantees `/tmp` as writable (backed by memory, and
counted against the container's memory limit) `[CITED: general Cloud Run/Docker tmpfs behavior, see
Sources]`, which is why `/tmp` is the correct target, not an assumption of "somewhere writable."
**How to avoid:** Always pass `-env:UserInstallation=file:///tmp/lo-profile-<unique>` explicitly, generate
a fresh, per-request-unique profile directory (do not reuse one across concurrent requests — LibreOffice's
own lock file makes concurrent use of one profile unreliable), and set `HOME=/tmp` in the container
environment as a second layer of safety. Set Cloud Run `--concurrency=1` so each container instance
handles exactly one render at a time — this sidesteps the shared-profile-lock class of failure entirely
rather than trying to make concurrent LibreOffice invocations safe.
**Warning signs:** Intermittent render failures under load that don't reproduce on a fresh/cold container.

### Pitfall 4: Reproducing the `MEDIA_CLEANUP_DRY_RUN`/`MEDIA_CLEANUP_ENABLED` inversion incident

**What goes wrong:** A destructive scheduled cleanup ships with its doc comment claiming dry-run-by-default
while the code actually deletes by default (or a stray legacy env var name is silently ignored, defeating
an operator's intended safety toggle).
**Why it happens:** This is not hypothetical — it already happened in this exact codebase
(`functions/src/index.ts:223-227`'s history comment, fixed 2026-07-28 in `9f1b881`). The original shape
gated on `MEDIA_CLEANUP_DRY_RUN === "true"`, so an UNSET env var (the default in every environment until
someone explicitly sets it) meant LIVE deletion on a daily schedule.
**How to avoid:** Any new deletion path (the orphan-render cleanup this phase adds) must gate the SAME
direction as the fixed code: `const dryRun = process.env.PPTX_RENDER_CLEANUP_ENABLED !== "true"` — an
explicit opt-in required for real deletion, everything else (unset, `"false"`, a typo) is safe. Write the
exact regression-test shape `functions/src/index.test.ts` already has for `cleanupExpiredMediaHandler`
("FAILS SAFE: ... even for an expired file", "a stray ...=false does not enable deletion", "a non-'true'
value does not enable deletion") against the new handler, not just a happy-path test.
**Warning signs:** A cleanup handler test suite that only tests the "enabled" path and never asserts the
default/unset/typo'd-value behavior.

### Pitfall 5: A maliciously crafted `.pptx` hanging or OOM-killing the render container (zip bomb / decompression bomb)

**What goes wrong:** A `.pptx` is a ZIP archive; a specially crafted one can decompress to an enormous size,
or contain deeply nested/recursive embedded objects that make LibreOffice's conversion pathologically slow
or memory-hungry, tying up (or crashing) the container.
**Why it happens:** LibreOffice was not designed as a hardened, adversarial-input-safe sandbox; this class
of attack is a documented general risk for any server-side Office-document-processing pipeline.
`[ASSUMED — general document-processing security knowledge, not verified against a LibreOffice-specific
CVE database this session]`.
**How to avoid:** Bound the blast radius at the platform level rather than trying to detect malicious
content in application code: a per-request execution timeout on the `soffice`/`pdftoppm` `execFile` calls
(kill the process if it exceeds e.g. 3 minutes), Cloud Run's own request `--timeout`, and a firm
`--memory` ceiling so a runaway conversion gets OOM-killed rather than starving the host. The existing
25MB Storage upload cap (`storage.rules`, `request.resource.size < 26214400`) already bounds the INPUT
file size before it ever reaches this pipeline — worth noting explicitly as an existing mitigation this
phase inherits for free.
**Warning signs:** A render that never completes and never times out; a Cloud Run instance repeatedly
OOM-restarting on the same import.

## Code Examples

### Dockerfile (reviewable sketch — NOT built or deployed this run, per the deploy prohibition)

```dockerfile
# render-service/Dockerfile
FROM node:22-bookworm-slim

# LibreOffice's Impress component covers PPTX->PDF export; poppler-utils gives
# pdftoppm. Only metric-compatible OPEN fonts — never ttf-mscorefonts-installer /
# msttcorefonts (R062 criterion 3, licensing).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-impress \
      poppler-utils \
      fonts-crosextra-carlito \
      fonts-crosextra-caladea \
      fonts-liberation \
      fontconfig \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

# ★ Testable font-provenance assertion (criterion 3): fail the BUILD if a future
# base-image or transitive-dependency change ever pulls in Microsoft core fonts.
# This is the "assertion, not an intention" the phase requires -- it runs at
# `docker build` time, catching drift before an image is ever pushed.
RUN if dpkg -l 2>/dev/null | grep -qiE 'mscorefonts|msttcorefonts'; then \
      echo "FATAL: Microsoft font package detected -- licensing violation" >&2; \
      exit 1; \
    fi

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Cloud Run's writable path is /tmp (memory-backed, counts against --memory).
# LibreOffice's profile MUST live under a writable, per-request-unique path --
# never the default $HOME, which is not guaranteed writable in this image.
ENV HOME=/tmp
ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "lib/server.js"]
```

### Render service HTTP handler (reviewable sketch)

```typescript
// render-service/src/render.ts
// Source: composed from CITED patterns above (LibreOffice headless conversion,
// pdftoppm per-page rasterization) -- no single official doc covers this whole
// pipeline end to end, so this is a synthesis, not a verbatim copy.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Storage } from "@google-cloud/storage";

const run = promisify(execFile);
const storage = new Storage();

export interface RenderRequest {
  orgId: string;
  importId: string;
  storagePath: string;
}

export interface RenderResult {
  renderedCount: number;
}

// Defense in depth -- mirrors parsePptxHandler's own guard (functions/src/index.ts:168).
// Cloud Run's own IAM already restricts WHO can call this endpoint; this restricts
// WHAT they can ask it to read, independent of that platform-level check.
const PPTX_IMPORT_PATH_GUARD = /^orgs\/[^/]+\/pptx-imports\/[^/]+\//;

export async function renderPptxToImages(req: RenderRequest): Promise<RenderResult> {
  const { orgId, importId, storagePath } = req;
  if (!storagePath.startsWith(`orgs/${orgId}/pptx-imports/`) || !PPTX_IMPORT_PATH_GUARD.test(storagePath)) {
    throw new Error("storagePath outside caller org prefix");
  }

  const bucket = storage.bucket();
  const workDir = await mkdtemp(path.join(os.tmpdir(), "pptx-"));
  const profileDir = path.join(workDir, "lo-profile");
  const pptxPath = path.join(workDir, "source.pptx");

  try {
    await bucket.file(storagePath).download({ destination: pptxPath });

    await run("soffice", [
      "--headless", "--norestore", "--nolockcheck", "--nodefault",
      `-env:UserInstallation=file://${profileDir}`,
      "--convert-to", "pdf", "--outdir", workDir, pptxPath,
    ], { timeout: 180_000 });

    const pdfPath = path.join(workDir, "source.pdf");
    const pagePrefix = path.join(workDir, "page");
    // 150 DPI: Poppler's own documented default; a reasonable starting point for
    // slide-projection-scale fidelity, NOT independently validated against a real
    // multi-font deck this session (that requires the deployed service).
    await run("pdftoppm", ["-png", "-r", "150", pdfPath, pagePrefix], { timeout: 120_000 });

    const pages = (await readdir(workDir))
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    const destPrefix = `orgs/${orgId}/pptx-imports/${importId}/rendered/`;
    await Promise.all(
      pages.map((file, i) =>
        bucket.upload(path.join(workDir, file), {
          destination: `${destPrefix}${i}.png`,
          metadata: { metadata: { createdAt: new Date().toISOString() } },
        }),
      ),
    );

    return { renderedCount: pages.length };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
```

### Bridging function's Cloud Run invocation (reviewable sketch)

```typescript
// functions/src/renderInvoker.ts -- isolated so requestPptxRenderHandler's own
// test can mock this single function rather than mocking google-auth-library
// directly in every test.
import { GoogleAuth } from "google-auth-library";

// Set via a non-secret Firebase Functions param (defineString), NOT defineSecret
// -- this is a public-ish service URL, not a credential. Populated by the owner
// after the human-run `gcloud run deploy` (see Metadata section) reports the URL.
export interface InvokeRenderServiceArgs {
  orgId: string;
  importId: string;
  storagePath: string;
  renderServiceUrl: string;
}

export async function invokeRenderService(
  args: InvokeRenderServiceArgs,
): Promise<{ renderedCount: number }> {
  const auth = new GoogleAuth();
  // Audience MUST equal the exact Cloud Run service URL -- Cloud Run validates
  // the ID token's `aud` claim against its own URL before the request reaches
  // application code at all (source.cited.above).
  const client = await auth.getIdTokenClient(args.renderServiceUrl);
  const res = await client.request<{ renderedCount: number }>({
    url: `${args.renderServiceUrl}/render`,
    method: "POST",
    data: { orgId: args.orgId, importId: args.importId, storagePath: args.storagePath },
    timeout: 240_000,
  });
  return res.data;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| PPTX import shows only extracted text/images (heuristic mapping, no visual fidelity) | Text extraction unchanged, PLUS a true rendered image per slide via LibreOffice+Poppler | This phase (37) | Slides that rely on backgrounds/layout/effects (e.g. announcement decks with branded templates) become recognizable instead of reduced to bare text |
| Cloud Functions v1 `functions.config()` for non-secret runtime config | `firebase-functions/params` (`defineString`/`defineSecret`) | Already the pattern this codebase uses for `CLAUDE_API_KEY`/`ESV_API_KEY` (`defineSecret`) | The render service's URL should use `defineString`, not a legacy `functions.config()` call, for consistency with the existing secrets pattern in `functions/src/index.ts:14-15` |

**Deprecated/outdated:**
- `functions.config()` (Firebase CLI-managed runtime config) is deprecated GCP-wide in favor of
  `firebase-functions/params` — this codebase already exclusively uses the params pattern, so this phase
  should not introduce the older one.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `google-auth-library`, `@google-cloud/storage`, and `express` are the correct/expected package names for their respective roles | Standard Stack, Package Legitimacy Audit | Low — all three independently confirmed to exist on the npm registry with large download counts and official/well-known source repos; risk is a subtly wrong version pin, not a wrong package |
| A2 | LibreOffice's `-env:UserInstallation` + a per-request-unique `/tmp` profile directory resolves the "source file could not be loaded" class of container failure | Pitfall 3, Code Examples | Medium — this is synthesized from general community reports, not a single authoritative LibreOffice doc; must be confirmed by a human at first real container build/render (cannot be proven without building, which this run cannot do) |
| A3 | 150 DPI via `pdftoppm -r 150` gives adequate on-screen/projected fidelity for a rendered slide | Code Examples | Medium — Poppler's own documented default, but not validated against a real multi-font, multi-slide test deck (explicitly deferred per CONTEXT — "cost and latency cannot be validated without deploying") |
| A4 | Installing `fonts-crosextra-carlito`/`fonts-crosextra-caladea`/`fonts-liberation` alone is sufficient WITHOUT an explicit fontconfig/LibreOffice substitution-table step | Pitfall 2 | Medium — if LibreOffice's own default substitution already prefers these packages once installed (plausible, but not confirmed this session), the extra substitution-table step may be unnecessary; if it's actually required and skipped, rendered fonts will look wrong despite "the right packages" being installed |
| A5 | A Firestore-doc-as-queue (rather than an explicit call from `parsePptx`) is the better trigger shape for this phase | Architecture Patterns, Summary | Low-Medium — this is Claude's Discretion per CONTEXT.md, not a locked decision; the planner/owner may prefer the simpler "call directly from parsePptx without awaiting" shape despite its wasted-render-on-abandoned-preview tradeoff |
| A6 | `renderImportId` is an acceptable field name to add to `ImportedDeck` for joining a confirmed deck to its render-status doc | Summary, Pitfall 1 context | Low — purely a naming choice; any reasonably named additive optional field satisfies the same purpose |

**If this table is empty:** N/A — see entries above; all should be confirmed or explicitly accepted by the
planner/owner before being treated as locked.

## Open Questions

1. **Does LibreOffice's headless PDF export actually preserve PowerPoint-specific effects (transitions,
   animations-as-static-frame, SmartArt) at acceptable fidelity for THIS project's real decks?**
   - What we know: LibreOffice Impress is the standard FOSS tool for this and handles static layout/fonts/
     backgrounds well; it does NOT render slide transitions/animations (a PDF/PNG export is inherently a
     static single frame per slide, which is fine — R062 asks for a "true visual representation," not
     motion).
   - What's unclear: fidelity on this project's actual announcement/sermon decks (fonts, embedded media
     placeholders, complex layouts) is unverified — the ROADMAP itself flags needing "a real multi-font,
     multi-slide test deck," and CONTEXT says a 2-slide fixture proves nothing.
   - Recommendation: treat this as a human-verify item once the container is actually built and deployed
     (post-handoff) — cannot be resolved by this research run under the deploy prohibition.

2. **Should rendering be triggered on EVERY successful parse (my recommendation) or only on confirmed
   imports?**
   - What we know: Triggering on parse wastes render compute/storage for previews the user abandons (a
     real, non-trivial fraction of imports, given the existing UI has a full preview→confirm→cancel flow);
     triggering only on confirm requires threading the Storage `importId` through to the confirmed
     `ImportedDeck` doc (Pitfall 1's identifier-mismatch finding) as a new field, and delays "true-fidelity
     available" until after the user has already committed based on the text/image preview alone.
   - What's unclear: which tradeoff the owner actually wants — this is explicitly listed under CONTEXT's
     "Claude's Discretion," not locked.
   - Recommendation: the plan should record this as an explicit decision point (likely resolved at
     `/gsd-discuss-phase` or by the planner adopting this research's default), not silently pick one.

3. **What image format/resolution should `rendered/*.png` files be, and is one-file-per-slide the right
   shape (vs. a sprite sheet)?**
   - What we know: CONTEXT leaves this to Claude's Discretion; PNG (from `pdftoppm -png`) is the natural
     Poppler output; one-file-per-slide matches the existing `images/{index}.{ext}` convention already
     used for the extracted-image slides.
   - What's unclear: whether a sprite sheet would meaningfully reduce Storage-list/download overhead for a
     large deck — likely not worth the added complexity at this scale (a deck is tens of slides, not
     thousands).
   - Recommendation: one PNG per slide, matching the existing convention — this research's default choice,
     reflected in the code examples above.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `render-service/`, `functions/` | ✓ | v24.11.1 (local dev machine; Cloud Run image will use `node:22-bookworm-slim` per `functions/package.json`'s `engines.node: "22"` convention) | — |
| `google-auth-library` | Bridging function's ID-token minting | ✗ (not yet installed in `functions/package.json`) | latest `11.0.0` | Must be added — see Package Legitimacy Audit for the human-verify gate |
| `@google-cloud/storage`, `express` | `render-service/` (does not exist yet) | ✗ (project doesn't exist yet) | `7.21.0`, `5.2.1` | Must be scaffolded — see Recommended Project Structure |
| Docker daemon | Building/testing the container image | Not checked — **building is explicitly prohibited this run** regardless of availability | — | N/A — deferred to the owner per the deploy prohibition |
| `gcloud` CLI | Deploying the Cloud Run service | Not checked — **use is explicitly prohibited this run** | — | N/A — deferred to the owner; exact command below |
| LibreOffice / Poppler locally | Testing render fidelity outside the container | Not checked and not needed — all render-service tests mock `execFile`, never invoke real `soffice`/`pdftoppm` | — | N/A |

**Missing dependencies with no fallback:** none that block THIS phase's testable work — the container
build/deploy tools are deliberately out of reach by owner instruction, not by environment limitation.

**Missing dependencies with fallback:** `google-auth-library`, `@google-cloud/storage`, `express` all need
a plain `npm install` — no fallback needed, just execution.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (existing pin in `functions/package.json`; recommend the same pin for the new `render-service/`) |
| Config file | `functions/vitest.config.ts` (existing, node environment); `render-service/vitest.config.ts` (NEW — Wave 0, mirror the existing file's shape) |
| Quick run command | `cd functions && npx vitest run src/index.test.ts` — `cd render-service && npx vitest run src/render.test.ts` |
| Full suite command | `cd functions && npm test` (== `vitest run`) — `cd render-service && npm test` (once scaffolded) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R062-1 (true visual rendering) | `renderPptxToImages` invokes `soffice`/`pdftoppm` with the expected args and uploads N pages | unit (execFile mocked) | `cd render-service && npx vitest run src/render.test.ts` | ❌ Wave 0 |
| R062-1 (fidelity, cannot fully automate) | Real rendered output visually matches source deck | manual-only | — (human-verify against a real multi-font deck post-deploy) | N/A — deferred, documented in Open Question 1 |
| R062-2 (text retained alongside image) | `parsePptxHandler`'s existing `{slides}` return shape is unchanged by the additive `pptxRenders` write | unit (regression) | `cd functions && npx vitest run src/index.test.ts` | ❌ Wave 0 (new assertion, existing file) |
| R062-3 (no MS fonts, metric-compatible only) | Dockerfile text contains the required `fonts-crosextra-*`/`fonts-liberation` packages and does NOT contain `mscorefonts`/`msttcorefonts` | unit (string assertion against Dockerfile content) | `cd render-service && npx vitest run src/dockerfile.test.ts` | ❌ Wave 0 |
| R062-4 (completeness check gates "ready") | `requestPptxRenderHandler` flips to `ready` only when Storage recount matches reported count; `failed` on mismatch/error, never partial-ready | unit | `cd functions && npx vitest run src/index.test.ts` | ❌ Wave 0 |
| R062-4 (orphan cleanup defaults to dry-run) | `cleanupOrphanRendersHandler` mirrors `cleanupExpiredMediaHandler`'s fail-safe test shape exactly (unset/typo/false env var all stay dry-run) | unit | `cd functions && npx vitest run src/index.test.ts` | ❌ Wave 0 |
| Path guard (structural exemption) | `MEDIA_PATH_GUARD` does not match `rendered/` paths (regression, no code change needed — already true) | unit | `cd functions && npx vitest run src/index.test.ts` | ✅ trivially, but add an explicit regression test naming `rendered/` specifically (today's test only names `pptx-imports` generically) |
| IAM contract shape | `invokeRenderService` always calls `getIdTokenClient` with the configured Cloud Run URL as audience; never falls back to an unauthenticated fetch | unit (`google-auth-library` mocked) | `cd functions && npx vitest run src/index.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant quick-run command above (`functions/` or `render-service/` depending on
  what changed).
- **Per wave merge:** both suites' full run (`cd functions && npm test`, `cd render-service && npm test`),
  plus root `npx vitest run src/` (if `ImportedDeck`'s type/client fields changed) and `npm run type-check`
  (per `CLAUDE.md` — `vue-tsc --build`, not the narrower `-p tsconfig.app.json` form).
- **Phase gate:** full suite green across BOTH `functions/` and `render-service/` before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `render-service/package.json`, `tsconfig.json`, `vitest.config.ts` — the project doesn't exist yet;
  scaffold before any render-service test can run
- [ ] `render-service/src/render.test.ts` — covers R062-1 (execFile mocked, never invokes real soffice)
- [ ] `render-service/src/dockerfile.test.ts` — covers R062-3 (plain string/regex assertion against the
  Dockerfile's text content, no Docker daemon needed)
- [ ] `functions/src/renderInvoker.ts` + its mock seam — needed before `requestPptxRenderHandler` can be
  unit tested without a real network call
- [ ] Extend `functions/src/index.test.ts` with the new handlers' describe blocks (mirrors the existing
  `cleanupExpiredMediaHandler` fail-safe test shape for the new orphan-cleanup handler)
- [ ] Framework install: none beyond what Standard Stack's Installation block already lists — Vitest is
  already vendored via `functions/`'s existing devDependency pin, reused as-is for `render-service/`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No (no new end-user auth surface — the existing Firebase Auth gate on `parsePptx` is unchanged) | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes | Service-to-service: Cloud Run `--no-allow-unauthenticated` + `roles/run.invoker` scoped ONLY to the bridging function's service account (never `allUsers`/`allAuthenticatedUsers`); storage-path prefix guard re-verified independently in the render service, mirroring `parsePptxHandler`'s existing pattern |
| V5 Input Validation | Yes | `PPTX_IMPORT_PATH_GUARD` regex re-check in the render service (never trust the caller's `storagePath` blindly, even though the caller is IAM-authenticated); Storage's existing 25MB upload cap bounds the render pipeline's input size for free |
| V6 Cryptography | Partial | Never hand-roll the ID-token issuance/verification — `google-auth-library` + Cloud Run's platform-level IAM check IS the correct mechanism; application code only needs to supply the correct audience, not implement any crypto itself |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Unauthenticated invocation of the private render endpoint | Spoofing | `--no-allow-unauthenticated` + `roles/run.invoker` restricted to one specific service account (never a broad/public grant) |
| `storagePath` manipulated to point outside the caller's org prefix | Tampering | Independent regex re-check in the render service (defense in depth — even though the platform already authenticated the CALLER, it never validated the PAYLOAD) |
| Malicious/adversarial `.pptx` causing resource exhaustion (zip bomb, pathological embedded content) | Denial of Service | Per-process execution timeout on `soffice`/`pdftoppm`, Cloud Run request `--timeout`, a firm `--memory` ceiling, and the existing 25MB Storage upload cap on the INPUT file (inherited for free from `storage.rules`) |
| A render silently reported as complete when it is actually partial | Tampering / Repudiation (of the completeness guarantee) | Independent Storage recount before flipping `status: 'ready'` (Pattern 2) — never trust a single self-reported count |
| Destructive orphan-cleanup accidentally defaulting to live-delete | Tampering (of legitimate data) | Explicit opt-in env var (`PPTX_RENDER_CLEANUP_ENABLED === "true"`), mirroring the already-fixed `MEDIA_CLEANUP_ENABLED` pattern exactly, with the same fail-safe regression test shape |

## Sources

### Primary (HIGH confidence)
- `functions/src/index.ts`, `functions/src/index.test.ts`, `functions/src/pptxParser.ts` — read directly,
  ground truth for the existing `parsePptx`/`cleanupExpiredMedia` patterns this phase extends
- `src/components/PptxImportModal.vue`, `src/stores/importedSlides.ts`, `src/types/importedDeck.ts`,
  `src/utils/pptxUpload.ts` — read directly, ground truth for the Storage-`importId`-vs-Firestore-doc-id
  finding (Pitfall 1 / Summary)
- `storage.rules`, `firebase.json`, `functions/package.json`, `functions/vitest.config.ts`,
  `functions/tsconfig.json` — read directly, ground truth for existing size caps, project shape, and test
  tooling to mirror

### Secondary (MEDIUM confidence)
- `docs.cloud.google.com/run/docs/authenticating/service-to-service` — service-to-service ID-token
  audience/IAM contract, fetched directly via WebFetch
- `docs.cloud.google.com/sdk/gcloud/reference/run/deploy` — `gcloud run deploy` flag reference, fetched
  directly via WebFetch
- `manpages.debian.org/testing/poppler-utils/pdftoppm.1.en.html`, `wiki.debian.org/SubstitutingCalibriAndCambriaFonts`
  — WebSearch-surfaced, cross-checked against official Debian project domains

### Tertiary (LOW confidence)
- General community posts on LibreOffice-in-Docker headless conversion (oneuptime.com, various Medium/
  GitHub project READMEs) — corroborate the `-env:UserInstallation` / writable-profile pitfall but are not
  an authoritative LibreOffice project source; flagged in the Assumptions Log (A2) for human verification
  once the container can actually be built
- `npm view <package> version`/`time` registry lookups for `google-auth-library`, `@google-cloud/storage`,
  `express` — confirm registry existence and version currency, but per the package-name provenance rule
  these stay `[ASSUMED]` since the package names themselves came from WebSearch/training data, not
  Context7 or an official doc this session

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — LibreOffice+Poppler are the unambiguous correct choice (mandated by R062
  itself); the exact npm packages for the Node-side glue are common/well-known but unverified via an
  authoritative source this session
- Architecture: HIGH — the async decouple pattern, independent-recount completeness check, and
  identifier-mismatch finding are all derived directly from reading this codebase's own existing,
  already-tested patterns, not from external speculation
- Pitfalls: MEDIUM — the parser-count mismatch (Pitfall 1) and dry-run-default (Pitfall 4) are HIGH
  confidence (verified against live source); the LibreOffice-container-specific pitfalls (2, 3, 5) are
  LOW-MEDIUM, genuinely unverifiable without building the container, which this run cannot do

**Research date:** 2026-08-03
**Valid until:** ~14 days for the GCP/IAM/gcloud-flag claims (fast-moving product surface); the
architecture/pitfall findings derived from THIS codebase's own source remain valid until that source
changes

---

## The exact `gcloud run deploy` handoff command (for the owner, NOT to be run this session)

**Prerequisites (all owner-run, all provision billable/persistent GCP resources):**

```bash
# 1. Create a dedicated, least-privilege service account for the render service itself.
gcloud iam service-accounts create pptx-render-sa \
  --display-name="PPTX Render Service" \
  --project=PROJECT_ID

# 2. Grant it Storage access scoped to the project's default bucket only (read source
#    .pptx, write rendered/*.png) -- NOT a project-wide role.
gcloud storage buckets add-iam-policy-binding gs://PROJECT_ID.appspot.com \
  --member="serviceAccount:pptx-render-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# 3. Enable the required APIs (idempotent if already enabled).
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com eventarc.googleapis.com --project=PROJECT_ID
```

**Deploy the service** (builds the Dockerfile in `render-service/` via Cloud Build, since `--source` is
used rather than a pre-built `--image`):

```bash
gcloud run deploy pptx-render \
  --source=./render-service \
  --region=us-central1 \
  --no-allow-unauthenticated \
  --service-account=pptx-render-sa@PROJECT_ID.iam.gserviceaccount.com \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --concurrency=1 \
  --min-instances=0 \
  --max-instances=5 \
  --project=PROJECT_ID
```

| Flag | Value | Why |
|------|-------|-----|
| `--source=./render-service` | local Dockerfile dir | Builds via Cloud Build rather than requiring a manual `docker build`/`docker push` (still no local Docker daemon needed by the owner) |
| `--region` | `us-central1` (match the existing Firebase project's region — confirm against the project's actual Firestore/Functions region before running) | Co-locating region avoids cross-region latency between the bridging function and the render service |
| `--no-allow-unauthenticated` | set | The core security requirement — this service must NEVER be publicly invocable; only the bridging function's service account may call it |
| `--service-account` | `pptx-render-sa@...` | Least-privilege identity (Storage only, no Firestore access at all — see Architecture Patterns) |
| `--memory=2Gi` | starting point, **not empirically validated** | LibreOffice is memory-hungry; 2Gi is a reasonable starting point per general LibreOffice-in-container guidance, but CONTEXT is explicit this cannot be validated without deploying — the owner should watch Cloud Run's memory metrics after the first real decks and adjust |
| `--cpu=2` | starting point | Conversion is CPU-bound; 2 vCPU balances speed against per-render cost |
| `--timeout=300` | 5 minutes | Generous headroom over the render code's own internal 180s+120s (soffice+pdftoppm) timeouts, well under Cloud Run's 3600s platform max |
| `--concurrency=1` | **deliberately serialized** | LibreOffice's shared-profile-lock behavior (Pitfall 3) makes concurrent conversions on one instance unreliable; parallelism comes from Cloud Run scaling OUT (more instances), not up |
| `--min-instances=0` | scale-to-zero | This is a low-frequency, async workload (one render per PPTX import) — no reason to pay for an always-warm instance |
| `--max-instances=5` | starting cap | Bounds worst-case cost from a burst of imports; raise if real usage patterns justify it |

**After deploy — grant the bridging function permission to invoke it** (the OTHER direction of IAM, the
one CONTEXT explicitly asks to have "every flag explained"):

```bash
# FUNCTIONS_SA is the service account the "requestPptxRender" Cloud Function runs as
# -- by default this is PROJECT_ID@appspot.gserviceaccount.com for gen2 functions
# unless a dedicated SA was configured; confirm the actual value before running.
gcloud run services add-iam-policy-binding pptx-render \
  --region=us-central1 \
  --member="serviceAccount:FUNCTIONS_SA@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=PROJECT_ID
```

**Finally**, record the deployed service's URL (printed by the `deploy` command) as the bridging
function's `renderServiceUrl` param (via `firebase-functions/params`' `defineString`, following the same
pattern already used for `defineSecret` in `functions/src/index.ts:14-15`) and redeploy `functions/`
(`firebase deploy --only functions` — itself already deferred per backlog 999.3's separate rules-deploy
item, but functions deploy is a distinct target from rules deploy).
