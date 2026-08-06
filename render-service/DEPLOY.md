# Deploying `pptx-render` to Cloud Run

> ★★ **NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE.** Phase 37 was built under an
> explicit owner instruction — STATE.md v1.4: *"BUILD BUT DO NOT DEPLOY. Write the Cloud Run
> service, Dockerfile, bridging Cloud Function and tests, then STOP and hand the owner the exact
> `gcloud run deploy` command."* Every command below provisions **billable, persistent GCP
> infrastructure**: a Cloud Run service, an Artifact Registry repository (created implicitly by
> the `--source` build), Cloud Build minutes, a dedicated service account, and two IAM policy
> bindings. Running any of it is the owner's decision, not this run's — no plan in this phase
> executed `gcloud`, `docker build`/`push`, or `firebase deploy`.

This file lives next to the `Dockerfile` it deploys so it is easy to find later — it is not a
note buried in a plan SUMMARY.

---

## Prerequisites

> ### ⚠ CORRECTION 2026-08-05 — the bucket name in this file was WRONG
>
> This file said the default bucket is `PROJECT_ID.appspot.com`. **It is not.** The live project's
> bucket, read from the deployed client bundle's `storageBucket` config, is:
>
> ```
> worship-planner-bc515.firebasestorage.app
> ```
>
> `.firebasestorage.app` is the default for Firebase projects created after the October 2024 Storage
> change; `.appspot.com` was the older convention and this doc assumed it. Following this file
> literally would have (a) pointed the IAM binding at a bucket that does not exist, and (b) set
> `STORAGE_BUCKET` to a name `requiredBucketName()` would hand to `@google-cloud/storage`, failing on
> the first real render. Every command below is corrected. **Verify it yourself before running** —
> `firebase apps:sdkconfig WEB --project worship-planner-bc515` prints the authoritative value.
>
> ### Two other facts confirmed against the live project on the same date
>
> - **Functions service account:** `functions/src/` configures none, so gen2 defaults apply →
>   `worship-planner-bc515@appspot.gserviceaccount.com`. (The SA keeps the `appspot.gserviceaccount.com`
>   suffix even though the *bucket* does not — these are unrelated namespaces. Do not "fix" it.)
> - **Region:** functions are deployed in `us-central1`, and Firestore reported `nam5` (a US
>   multi-region that contains us-central1). `--region=us-central1` below is correct.

All three commands below are owner-run and each provisions a real GCP resource. Replace
`PROJECT_ID` with the actual Firebase/GCP project id everywhere it appears.

```bash
# 1. Create a dedicated, least-privilege service account for the render service itself.
#    This identity governs what the RUNNING SERVICE may touch — nothing about who may call it.
gcloud iam service-accounts create pptx-render-sa \
  --display-name="PPTX Render Service" \
  --project=PROJECT_ID

# 2. Grant it Storage access scoped to the project's default bucket ONLY — not a project-wide
#    role. The service needs to read orgs/{orgId}/pptx-imports/{importId}/source.pptx and write
#    .../rendered/*.png, and nothing else in the project.
gcloud storage buckets add-iam-policy-binding gs://PROJECT_ID.firebasestorage.app \
  --member="serviceAccount:pptx-render-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# 3. Enable the required APIs (idempotent if already enabled).
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com eventarc.googleapis.com --project=PROJECT_ID
```

Why bucket-scoped rather than project-wide: `roles/storage.objectAdmin` granted at the bucket
level is the least privilege that still lets the service read the source `.pptx` and write
`rendered/*.png` pages. A project-wide grant would let this container touch every other bucket
in the project for no functional reason.

---

## The deploy command

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
  --set-env-vars=STORAGE_BUCKET=PROJECT_ID.firebasestorage.app \
  --project=PROJECT_ID
```

`--source=./render-service` builds the `Dockerfile` via Cloud Build — no local Docker daemon is
required on the owner's machine.

### Every flag explained

| Flag | Value | Why |
|------|-------|-----|
| `--source=./render-service` | local Dockerfile dir | Builds via Cloud Build rather than requiring a manual `docker build`/`docker push` — still no local Docker daemon needed |
| `--region` | `us-central1` — **confirm this against the project's actual Firestore/Functions region before running**, do not assume it | Co-locating region avoids cross-region latency between the bridging function and the render service |
| `--no-allow-unauthenticated` | set, **never relax** | The core security requirement. This service must NEVER be publicly invocable. Never change this to `allUsers` or `allAuthenticatedUsers` — that would let anyone on the internet (or any Google-authenticated caller) burn CPU/memory on this container and read/write this project's Storage bucket within the SA's grant. |
| `--service-account` | `pptx-render-sa@PROJECT_ID.iam.gserviceaccount.com` | The least-privilege identity created above — Storage only, no Firestore access at all |
| `--memory=2Gi` | starting point, **NOT empirically validated** | LibreOffice is memory-hungry. 2Gi is a reasonable starting point per general LibreOffice-in-container guidance, but this was never validated against a real render because that requires deploying. Watch Cloud Run's memory metrics after the first real decks and adjust. |
| `--cpu=2` | starting point, **NOT empirically validated** | Conversion is CPU-bound; 2 vCPU balances speed against per-render cost, same caveat as memory |
| `--timeout=300` | 5 minutes | Sits above the render code's own internal timeouts (`soffice`: 180s, `pdftoppm`: 120s — `render-service/src/render.ts`'s `SOFFICE_TIMEOUT_MS`/`PDFTOPPM_TIMEOUT_MS`) and well under Cloud Run's platform maximum (3600s) |
| `--concurrency=1` | deliberately serialized | LibreOffice's shared-profile-lock behavior makes concurrent conversions on ONE instance unreliable (a `soffice --headless` process bootstraps a per-profile lock file). Parallelism comes from Cloud Run scaling OUT to more instances, never from raising this value. |
| `--min-instances=0` | scale-to-zero | Low-frequency async workload — one render per PPTX import. No reason to pay for an always-warm instance. |
| `--max-instances=5` | starting cap | Bounds worst-case cost from a burst of imports; raise if real usage patterns justify it |
| `--set-env-vars=STORAGE_BUCKET=...` | the project's default bucket name | See "Required environment variables" below — this is **required**, the container will throw on its first render request without it |
| `--project` | `PROJECT_ID` | Explicit project targeting |

### Required environment variables

| Variable | Set on | Required? | Notes |
|---|---|---|---|
| `STORAGE_BUCKET` | the Cloud Run service (`render-service`) | **Required** | ★ Not in the phase's original artifact table — discovered during 37-02. `@google-cloud/storage`'s `Storage#bucket()` requires an **explicit bucket name argument**; unlike `firebase-admin/storage`'s `getStorage().bucket()` used elsewhere in this repo, the plain client has no admin-app default bucket to fall back on. `render-service/src/render.ts`'s `requiredBucketName()` reads `process.env.STORAGE_BUCKET` and throws a clear error if it is unset — so an unset value fails loudly on the first render, not silently. Set it to the project's default bucket — **`PROJECT_ID.firebasestorage.app`, NOT `.appspot.com`**; see the CORRECTION banner at the top of this file. |
| `PORT` | the Cloud Run service | Provided automatically by Cloud Run | `render-service/src/main.ts` reads `process.env.PORT \|\| 8080`; do not set this manually |
| `PPTX_RENDER_SERVICE_URL` | the **Functions** codebase (`functions/`), not the Cloud Run service | Required for the pipeline to activate | See "Post-deploy configuration" below |
| `PPTX_RENDER_CLEANUP_ENABLED` | the **Functions** codebase (`functions/`) | **Leave unset** | See "The cleanup toggle" below |

---

## The second IAM direction — granting the function permission to call the service

Both IAM directions exist for different reasons: `pptx-render-sa`'s own grant (above) governs
what the **render service itself** may touch in Storage. The binding below governs **who is
allowed to call the render service at all** — a completely separate question.

```bash
# FUNCTIONS_SA is the service account the "requestPptxRender" Cloud Function runs as. By
# default this is PROJECT_ID@appspot.gserviceaccount.com for gen2 functions UNLESS a dedicated
# service account was configured for the functions codebase — confirm the actual value (e.g.
# via `gcloud functions describe requestPptxRender --gen2 --region=... --format="value(serviceConfig.serviceAccountEmail)"`)
# before running this.
gcloud run services add-iam-policy-binding pptx-render \
  --region=us-central1 \
  --member="serviceAccount:FUNCTIONS_SA@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=PROJECT_ID
```

Without this binding, `functions/src/renderInvoker.ts`'s `invokeRenderService` will mint a valid
OIDC ID token and still receive a 403 from Cloud Run — the platform-level IAM check happens
before the request ever reaches this service's application code.

---

## Post-deploy configuration

1. **Record the printed service URL.** `gcloud run deploy` prints the deployed service's URL on
   success. Set it as the `PPTX_RENDER_SERVICE_URL` param for the **functions** codebase — a
   `firebase-functions/params` `defineString` value (`functions/src/index.ts:268`), sourced from
   `functions/.env*` or answered at the deploy prompt, following the exact same params pattern
   already used for `CLAUDE_API_KEY`/`ESV_API_KEY` (`defineSecret`) in that file.

2. **Until `PPTX_RENDER_SERVICE_URL` is set, every render fails closed — by design.**
   `requestPptxRenderHandler` (`functions/src/index.ts:344-356`) checks for an empty/whitespace
   URL before making any network call, and marks the render doc `failed` with
   `failureReason: "render-service-not-configured"`. That is a tested behavior, not a bug or a
   TODO — the pipeline is deliberately safe to leave undeployed indefinitely.

3. **Redeploy `functions/` after setting the param.** The new `requestPptxRenderHandler` and
   `cleanupOrphanRendersHandler` exports do not exist in the deployed functions codebase until
   `functions/` itself is redeployed (`firebase deploy --only functions`). This is a **separate**
   deploy target from Firestore rules. No rules change was made in this phase —
   `firestore.rules`'s catch-all already denies client access to `pptxRenders` — so
   `firebase deploy --only firestore:rules` (backlog item 999.3) is unrelated and this phase does
   not need it.

---

## The cleanup toggle — `PPTX_RENDER_CLEANUP_ENABLED`

**Leave this unset.** `cleanupOrphanRendersHandler` (`functions/src/index.ts:611`) runs daily at
03:00 UTC and defaults to a dry run: with the variable unset, empty, `"false"`, or any other
value including a case typo like `"True"` or `"1"`, it only scans and logs what it WOULD delete,
and deletes nothing. Real deletion requires setting it to the **exact string** `"true"`.

Before ever setting it, read at least one dry-run log and confirm the would-delete list contains
only stale (`pending`/`failed`, older than `ORPHAN_RENDER_STALE_HOURS` = 24h) render records and
their `rendered/` Storage objects — never a `source.pptx`, never anything under `images/`, never
a `ready` render.

This opt-in-required shape mirrors `cleanupExpiredMediaHandler`'s own gate exactly, and exists
specifically because of the **2026-07-28 incident** (`9f1b881`): an earlier cleanup handler's
doc comment claimed dry-run-by-default while the code actually deleted by default on an unset
env var. That inversion is why every new deletion path in this codebase, including this one,
must default to safe and require an explicit, unambiguous opt-in — never the reverse.

---

## What the build will refuse to do

The Docker image build **fails outright** if a Microsoft core-font package (`mscorefonts` /
`msttcorefonts`, or anything matching those name fragments) is ever present in the image —
`render-service/Dockerfile`'s `dpkg -l | grep` assertion runs at `docker build` time. This is a
licensing constraint (never bundle Microsoft fonts — Carlito/Caladea/Liberation only), enforced
as a build-time gate rather than an intention. **If a future base-image or dependency change
ever causes the build to fail with `"FATAL: Microsoft font package detected"`, that is the
licensing gate working correctly, not a defect to work around.**

---

## Post-deploy verification — only a deployed service can answer these

Nothing below can be validated without an actual running container. Each is tracked as an open
item in `.planning/PENDING-VERIFICATION.md`'s `## Phase 37` section (items 37.1–37.3):

- **Real visual fidelity against a real multi-font, multi-slide deck.** A 2-slide fixture proves
  nothing — the ROADMAP is explicit about this. Import a deck with several fonts and several
  slides and compare the rendered images against PowerPoint's own rendering: backgrounds, fonts,
  layout, effects. Static-frame export means transitions/animations are not rendered — that is
  expected, R062 asks for a true visual representation, not motion.
- **Whether font substitution actually happened**, not merely whether the packages were
  installed. Import a deck authored in Calibri and Cambria and confirm the rendered result is
  metrically Carlito/Caladea, not a generic fallback (LibreOffice's own default substitution,
  historically Liberation Sans/Serif for anything unrecognized). `render-service/fontconfig/
  60-metric-compat-aliases.conf` ships the alias mapping for exactly this reason, but it has
  never been exercised against real LibreOffice at render time.
- **Real cost and latency** across several decks — cold starts likely dominate given
  `--min-instances=0`. Revisit `--memory=2Gi`, `--cpu=2`, and `--max-instances=5` against the
  observed numbers.

Do not execute any command in this file, and do not create any GCP resource, until the owner has
reviewed this file and made the deploy decision.
