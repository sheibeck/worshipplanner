---
phase: 37
slug: powerpoint-server-side-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 37 — Validation Strategy

> Seeded from `37-RESEARCH.md` § Validation Architecture.
> **This phase deploys nothing.** Everything below runs locally, with no container built and no cloud
> resource created. See § The deploy boundary.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (existing pin in `functions/package.json`; reuse for `render-service/`) |
| **Config** | `functions/vitest.config.ts` (exists, node env) · `render-service/vitest.config.ts` (**NEW — Wave 0**) |
| **Quick run** | `cd functions && npx vitest run src/index.test.ts` · `cd render-service && npx vitest run src/render.test.ts` |
| **Full suites** | `cd functions && npm test` · `cd render-service && npm test` |
| **App suite** | `npx vitest run src/` — only if `ImportedDeck`'s type/client fields change |
| **Type gate** | `npm run type-check` (**`vue-tsc --build`**) for the app; each backend project has its own `tsc` |

**★ `functions/` is a SEPARATE suite the app's `npx vitest run src/` does NOT cover**, and
`render-service/` will be a third. The phase gate is **all applicable suites green**, not just the app's.

**App-suite baseline that is NOT a defect:** `src/storage.rules.test.ts` +
`src/views/__tests__/RosterView.test.ts` = 9 tests / 2 files.

---

## ★ The deploy boundary — what "verified" can and cannot mean here

STATE.md: **BUILD BUT DO NOT DEPLOY.** No `gcloud`, no `firebase deploy`, no `docker build`/`push`, no
GCP resource creation. That is an owner instruction, and it binds testing too.

| Verifiable now (and must be) | Needs the deployed service (human-verify) |
|---|---|
| The render service's argv to `soffice` / `pdftoppm` (`execFile` **mocked** — never invoke the real binary) | Actual visual fidelity against a real deck |
| **Dockerfile content** — required font packages present, `mscorefonts`/`msttcorefonts` absent | That the built image actually renders |
| The completeness check's ready/failed decisions | Real render latency and cost |
| The orphan-cleanup **dry-run default** | Behaviour under real concurrency / memory pressure |
| The IAM contract's *shape* (`getIdTokenClient` always called with the Cloud Run URL as audience; never an unauthenticated fallback) | That the IAM binding actually authorizes |
| `MEDIA_PATH_GUARD` not matching `rendered/` paths | — |

**"Can't deploy" is not "can't verify."** Every seam in the left column is a real gate.

---

## Per-Task Verification Map

| Task | Req | Wave | Behavior | Command | Exists | Status |
|------|-----|------|----------|---------|--------|--------|
| TBD | R062-1 | 0 | `renderPptxToImages` invokes soffice/pdftoppm with expected args, uploads N pages | `cd render-service && npx vitest run src/render.test.ts` | ❌ W0 | ⬜ |
| TBD | R062-2 | 0 | `parsePptxHandler`'s existing `{slides}` return shape **unchanged** by the additive write | `cd functions && npx vitest run src/index.test.ts` | ❌ W0 (new assertion, existing file) | ⬜ |
| TBD | R062-3 | 0 | Dockerfile contains `fonts-crosextra-*`/`fonts-liberation` and **NOT** `mscorefonts`/`msttcorefonts` | `cd render-service && npx vitest run src/dockerfile.test.ts` | ❌ W0 | ⬜ |
| TBD | R062-4 | 0 | Flips to `ready` **only** when the Storage recount matches; `failed` on mismatch; **never partial-ready** | `cd functions && npx vitest run src/index.test.ts` | ❌ W0 | ⬜ |
| TBD | R062-4 | 0 | Orphan cleanup mirrors `cleanupExpiredMediaHandler`'s fail-safe shape — unset / typo / `"false"` all stay dry-run | `cd functions && npx vitest run src/index.test.ts` | ❌ W0 | ⬜ |
| TBD | — | 0 | IAM: `getIdTokenClient` always called with the Cloud Run URL as audience; **no unauthenticated fallback path** | `cd functions && npx vitest run src/index.test.ts` | ❌ W0 | ⬜ |
| TBD | — | — | `MEDIA_PATH_GUARD` does not match a `rendered/` path | `cd functions && npx vitest run src/index.test.ts` | ✅ trivially true — add a test naming `rendered/` **specifically** (today's names `pptx-imports` generically) | ⬜ |

---

## Wave 0 Requirements

- [ ] `render-service/{package.json,tsconfig.json,vitest.config.ts}` — the project does not exist yet.
- [ ] `render-service/src/render.test.ts` — R062-1. **`execFile` mocked; never invoke real `soffice`.**
- [ ] `render-service/src/dockerfile.test.ts` — R062-3. Plain string/regex assertion against the
      Dockerfile's text. **No Docker daemon.** This is what makes criterion 3 a gate rather than an
      intention, and it would catch a future base-image change bundling `ttf-mscorefonts-installer`.
- [ ] `functions/src/renderInvoker.ts` + its mock seam — required before the handler can be unit-tested
      without a real network call.
- [ ] Extend `functions/src/index.test.ts` — new handlers, mirroring the existing
      `cleanupExpiredMediaHandler` fail-safe describe block.

*Framework install: none — Vitest is already pinned in `functions/`.*

---

## ★ Two correctness traps this phase must not fall into

**1. NEVER derive the expected page count from `parsePptxBuffer`'s `MappedSlide[]` length.** Research
verified the heuristic mapper **skips content-free slides** and **emits multiple entries per
multi-image slide** — its length is structurally decoupled from the deck's real page count. Using it
would make the completeness check silently wrong in both directions. Use LibreOffice/Poppler's own
self-reported page count, then **independently reconfirm via a Storage listing** — mirroring
`parsePptxHandler`'s existing "never trust the caller alone" pattern. A deck must **never** flip to
`ready` on a partial render.

**2. The orphan-cleanup default is a repeat-incident risk.** `cleanupExpiredMedia`'s doc comment once
claimed dry-run-by-default while the code deleted by default on a daily 02:00 UTC schedule — a real
incident, fixed 2026-07-28 (`9f1b881`) by inverting the gate so deletion requires an explicit
`MEDIA_CLEANUP_ENABLED="true"`. **Mirror that shape exactly**, including its three fail-safe regression
guards (unset, empty, `"false"`, and a typo all remain a dry run). Do not invent a new gating idiom.

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| **The service actually renders** | Requires deploying. The whole container is unverifiable here by instruction. | Run the handed-over `gcloud run deploy` command, then import a deck. |
| **Visual fidelity** | Criterion 1 is a judgment about pixels. | Import a **real multi-font, multi-slide deck** — the ROADMAP explicitly warns a 2-slide fixture proves nothing. Compare backgrounds, fonts, layout and effects against PowerPoint's own rendering. |
| **Font substitution actually happened** | Criterion 3's *effect* (not just package presence) needs rendered output. | Use a deck authored in Calibri and Cambria; confirm the rendering is metrically correct via Carlito/Caladea rather than falling back to something wrong. Research flags that fontconfig may need explicit substitution config beyond installing the packages. |
| **Cost and latency** | Cannot be estimated credibly without running it. | Render several real decks; record CPU-seconds and wall time. Cold starts likely dominate. |
| **`google-auth-library` dependency** | New dependency; the package checker flagged it `[SUS]` on a "too-new" heuristic — **it flags this repo's existing `firebase-admin`/`firebase-functions` identically**, so it reads as a false positive from Google's release cadence. Recorded, not hidden. | Owner to confirm they're comfortable adding it. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] **Nothing was deployed, built as a container, or provisioned**
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
