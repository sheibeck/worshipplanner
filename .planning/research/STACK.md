# Stack Research

**Domain:** Brownfield additions to a shipped Vue 3 + Firebase worship-planning app (v1.4 "Service and Slides")
**Researched:** 2026-07-28
**Confidence:** HIGH for versions (verified via npm registry and Context7/skill-cached docs, 2026-07-28); MEDIUM for PPTX-rendering cost/latency figures (grounded in vendor docs and well-established LibreOffice/Cloud Run operating characteristics, not independently benchmarked against this app's actual deck corpus)

This file covers **only the five new v1.4 capabilities**. It does not re-litigate the existing stack (Vue 3, Pinia+`onSnapshot`, Tailwind v4, Firebase Gen-2 Functions, SortableJS, Claude Haiku) — see PROJECT.md's Key Decisions table for that. Every recommendation below integrates into that existing stack rather than proposing to replace any part of it.

---

## 1. Server-side PowerPoint → image rendering

### Recommended approach: self-hosted headless LibreOffice + Poppler, on a **dedicated Cloud Run service**, invoked **asynchronously** from the existing Cloud Function

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|------------------|
| LibreOffice (`libreoffice-impress` + core) | Debian `bookworm`/`trixie` package, any current 24.x/25.x build | PPTX → PDF conversion, one PDF page per slide | The only tool that reads real PPTX layout (masters, themes, embedded charts, effects) with fidelity close to PowerPoint itself — Aspose/CloudConvert/Gotenberg all use it (or an equivalent) under the hood anyway. **MPL 2.0** — free for commercial SaaS use, no per-seat or per-conversion fee, no vendor account |
| Poppler `pdftoppm` (`poppler-utils`) | Debian package, current stable | Rasterizes each PDF page to a PNG at chosen DPI | LibreOffice's own `--convert-to png` only exports slide 1 — you need PDF as the intermediate format, then split it into one PNG per page. `pdftoppm` is the standard, fast, MIT/GPL-licensed tool for this and is already used for large-scale document pipelines |
| `fonts-crosextra-carlito`, `fonts-crosextra-caladea` | Debian packages | Metric-compatible substitutes for Calibri/Cambria | **Do not install `ttf-mscorefonts-installer` or copy real Microsoft fonts into the image** — those are proprietary and not licensed for redistribution inside a hosted SaaS container. Carlito/Caladea (Google/Red Hat, SIL Open Font License) match Calibri/Cambria's character widths line-for-line, so wrapping and slide layout stay correct even though glyph shapes differ slightly |
| `fonts-liberation` | Debian package | Metric-compatible Arial/Times New Roman/Courier New substitutes | Same licensing rationale as above — covers the other common Office defaults |
| Cloud Run (Gen 2) — a **standalone service**, not a Firebase Function | — | Hosts the LibreOffice + Poppler container | See "Custom container vs. Firebase Functions Gen 2" below — this is the one piece that cannot be a normal `firebase deploy --only functions` deployment |

### What NOT to add

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| **Gotenberg** (Docker image, MIT) | A legitimate, well-maintained option (65M+ pulls, wraps the same LibreOffice under the hood) — but it converts office docs *to PDF only*. You'd still need a second hop (Poppler) to get per-slide PNGs, and now you're operating two services (Gotenberg + your rasterizer) instead of one. For a single-format (PPTX-only) need, a single custom container running `soffice` + `pdftoppm` directly is less operational surface for the same result. Reconsider Gotenberg only if a future milestone needs to convert other office formats (DOCX, XLSX) too — its broader format coverage would then start paying for itself | One custom Cloud Run container with `soffice` + `pdftoppm` |
| **unoconv** | A thin Python wrapper around the same LibreOffice UNO API — unmaintained for years, no meaningful advantage over calling `soffice --headless` directly, and it's one more moving part with its own dependency/version drift risk | Shell out to `soffice`/`pdftoppm` directly, or Gotenberg if format coverage grows |
| **CloudConvert** | A real, working per-conversion cloud API (~$0.008/conversion-minute, ~$8/mo minimum plan) — but it means church slide decks (which may contain copyrighted worship graphics/photos of congregants) leave your infrastructure to a third-party vendor, plus API-key management alongside the ESV/Claude/Planning Center keys already in `.env.local`, plus a recurring bill for a workload that's essentially free to self-host at this volume | Self-hosted LibreOffice on Cloud Run — near-$0 at "a few dozen decks a month" (see Pricing below) |
| **Aspose.Slides Cloud** | Best-in-class fidelity and a real PNG-per-slide export in one call, and its pay-per-call pricing (~$0.007–0.02/call, free tier of 150 calls/mo) is genuinely cheap at this volume — but it's a commercial SaaS dependency with its own account/API-key/rate-limit surface, and its on-prem SDK licenses run $1,000–3,000+/yr if ever needed off the cloud tier. Not wrong, just an unnecessary vendor relationship for a self-hostable, free alternative that already fits this app's existing Cloud Functions architecture | Same — self-hosted LibreOffice |
| **Syncfusion** | Cloud pricing is opaque/hard to quote from public sources, and its primary offering is an on-prem .NET/JS SDK ($450–1,400+/yr per Vendr data) — a licensing model and language ecosystem (.NET-centric tooling) that doesn't fit this Node.js Cloud Functions codebase | Same — self-hosted LibreOffice |
| **A pure-Node PPTX renderer** (e.g. building slide layout from the PPTX XML by hand) | No pure-Node library renders arbitrary PPTX with real fidelity — backgrounds, WordArt, SmartArt, embedded charts, and font metrics require an actual layout engine. Anything claiming to do this in pure JS is doing text/shape extraction (which is what `pptxParser.ts` already does), not rendering | LibreOffice (above) |

### Custom container vs. Firebase Functions Gen 2 — confirmed answer

**Yes, a custom container is required, and it changes the deployment path.** Firebase Cloud Functions Gen 2 does run on Cloud Run under the hood, but `firebase deploy --only functions` builds your function via **Google Cloud buildpacks**, not an arbitrary `Dockerfile` — buildpacks auto-detect a Node/Python source tree and produce a container for you; there is no supported way to `apt-get install libreoffice-impress poppler-utils` into that build. This means:

1. **The LibreOffice/Poppler service must be deployed as a separate, plain Cloud Run service** (`gcloud run deploy --source .` with your own `Dockerfile`, or Cloud Build → Artifact Registry → `gcloud run deploy --image`), living in the same GCP project as the Firebase project (Firebase projects *are* GCP projects, so this is one project, two deployment surfaces — not a new project or a new vendor).
2. **Keep the existing `parsePptx` Cloud Function as the auth/gatekeeper**, exactly as it already is (`request.auth` + independent `organizations/{orgId}/members/{uid}` check, storage-path gating on `orgs/{orgId}/pptx-imports/`). Add a **second Cloud Function** (still a normal buildpacks-built Gen-2 function, no container needed there) that, after `parsePptx` finishes text extraction, does a **service-to-service authenticated call** to the Cloud Run render service (Google-signed ID token via the Cloud Run Invoker IAM role — not a public endpoint) to kick off rendering. This reuses the exact auth pattern already proven in this codebase rather than inventing a new one.
3. Do not expose the Cloud Run render service publicly or call it directly from the browser — keep it as an internal, IAM-gated service the Function talks to, matching every other write path in this app going through Firestore/Storage security rules or Function-level auth checks.

### Container image, cold start, memory/CPU

- **Base image:** `node:22-slim` or `node:22-bookworm-slim` (matches the existing Functions runtime pin, `functions/package.json` → `engines.node: "22"`), with `apt-get install -y libreoffice-impress poppler-utils fonts-crosextra-carlito fonts-crosextra-caladea fonts-liberation` layered on top. Expect a **~700MB–1.2GB image** — LibreOffice is not small, and this is the correct tradeoff for fidelity.
- **Cold start:** LibreOffice's own process startup (loading its profile, fonts, filters) typically adds **several seconds on top of** Cloud Run's own cold-start latency — this is real and is the primary reason to run this asynchronously rather than have a user wait on it inline (see Sync vs. Async below).
- **Memory/CPU:** Start at **2 GiB RAM / 1–2 vCPU**, `concurrency: 1` per instance. The `concurrency: 1` setting isn't just a safety margin — headless LibreOffice's per-user-profile lock (`-env:UserInstallation=file:///tmp/lo-<uuid>`) makes concurrent conversions on a *shared* instance a documented source of corruption/deadlock; one conversion per instance avoids that class of bug entirely rather than requiring careful profile-directory isolation code.
- **`minInstances: 0`** is the right call at this volume (see Pricing) — the near-zero traffic doesn't justify paying to keep an instance warm.

### Per-conversion latency for a ~30-slide deck

Expect **on the order of tens of seconds to low minutes** for a real 30-slide deck with images/charts on a cold instance (LibreOffice startup + PDF conversion + 30 `pdftoppm` rasterization passes + 30 Storage uploads), settling to well under that on a warm instance. This is squarely in "background job," not "synchronous request-response," territory — see below.

### Pricing at low volume (a few dozen decks/month)

Cloud Run's free tier (per project, per month) is **180,000 vCPU-seconds, 360,000 GiB-seconds, and 2,000,000 requests**. Even a generous estimate — 30 decks/month × 60 seconds of 2-vCPU compute each — is ~3,600 vCPU-seconds, under 2% of the free tier. **This workload is effectively free to self-host.** That's the strongest practical argument for self-hosting over any of the per-call/per-minute vendor APIs above, none of which can go below their subscription floor even at near-zero usage.

### Licensing recap (the three things that kill this in practice)

1. **LibreOffice itself:** MPL 2.0 — unrestricted commercial SaaS use, no fee, no attribution requirement beyond what MPL already requires for the (unmodified) binary you're shipping.
2. **Fonts:** never bundle real Microsoft fonts (`ttf-mscorefonts-installer` fetches genuine MS font files under an EULA not written for redistribution in a hosted product) — use Carlito/Caladea/Liberation, which are open-licensed and metric-compatible.
3. **Cold-start/fidelity risk, not a legal risk, but the practical failure mode:** font *substitution* happens silently — LibreOffice swaps a missing font with no error. Surface which fonts a deck used that weren't available server-side (already flagged in PITFALLS.md Pitfall 6) so "renders like the original" carries an honest caveat rather than a silent visual drift.

### Synchronous-with-long-timeout vs. async background job — **recommendation: async**

ARCHITECTURE.md flagged this as undecided. Given the cold-start and per-deck latency figures above (tens of seconds to low minutes, on an intermittently-cold service), **treat this as a background job, not a synchronous request the user's browser waits on**:

- Trigger the render Function on the **Storage `onObjectFinalized` event** for the uploaded `.pptx` (or immediately after `parsePptx`'s text extraction completes, whichever the phase plan prefers) rather than from a client-awaited `onCall`.
- Track progress on the `ImportedDeck` Firestore document with a status field (`pending` → `rendering` → `ready`/`failed`), only flipping to `ready` once **every expected slide image is confirmed uploaded** (a completeness check, not just "the function returned 200") — this directly addresses the orphaned-partial-render failure mode PITFALLS.md Pitfall 6 calls out.
- The client subscribes to that status via the **same `onSnapshot` pattern already used everywhere else in this app** (Pinia stores + Firestore listeners) — no new client-side data-fetching pattern needed, just a new field to watch.
- This also sidesteps Cloud Functions Gen-2's default timeout entirely — no need to raise it to its maximum (up to 60 minutes) and have a user's browser tab sit on a spinner that long; the UI can show "Rendering…" and move on.

---

## 2. LLM-assisted congregational reading splits

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|------------------|
| `@anthropic-ai/sdk` | **upgrade from the currently-pinned `^0.78.0` to current (`^0.115.x` as of this research; re-check `npm view @anthropic-ai/sdk version` at implementation time)** | Anthropic API client | The pinned version is ~18 months behind. Structured-outputs support (`output_config.format`, `client.messages.parse()`) — the feature this task needs for a deterministic, schema-shaped response — was added well after 0.78.0. Upgrading is a prerequisite, not optional, for this feature |
| `claude-haiku-4-5` (model ID) | current | Splits a scripture passage into leader/congregation reading parts | Matches this app's own existing, stated decision ("cost-efficient haiku model" — PROJECT.md Key Decisions) and PITFALLS.md's own analysis: this is a bounded structural-labeling task (assign each clause/verse to a speaker), not open-ended generation, which is exactly Haiku's strong suit. **Do not default to Opus/Sonnet for this** — reserve a bigger model only if Haiku's split quality proves inadequate on real passages during evaluation |
| `output_config: { format: { type: "json_schema", schema: {...} } }` (Messages API structured outputs) | GA, no beta header, supported on Haiku 4.5 | Constrains the model's response to a fixed schema | This is the mechanism that makes the split deterministic and *safe*: the schema should describe **verse/clause indices and a speaker label only** (`{ verse: number, clauseStart: number, clauseEnd: number, speaker: "leader" | "congregation" }[]`) — never a `text` field the model fills in. The app then slices the **already-fetched, known-correct ESV passage string** using those indices to build the displayed slides. This makes hallucinated/reworded scripture text **structurally impossible** — the model can mis-assign a speaker, but it literally cannot alter a character of what's displayed, because the displayed text never originates from model output |

### Integration point

Route through the **existing single Cloud Function proxy** (`/api/anthropic`, already used by `src/utils/claudeApi.ts` for song/scripture suggestions) rather than adding a second proxy path. Add a new exported function alongside `getSongSuggestions`/`getScriptureSuggestions` in `claudeApi.ts` — same lazy-singleton client, same try/catch-and-fall-back-to-null pattern already established there, so the "AI is additive, never blocking" principle (an existing Key Decision) is inherited for free rather than re-implemented.

### What NOT to do

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Prompt-engineered "respond ONLY with valid JSON" + regex/`safeParseJsonArray` extraction (the pattern the existing `getSongSuggestions`/`getScriptureSuggestions` use today) | Works for suggestions where an occasional malformed response just means "no suggestion shown" — unacceptable here, where correctness of *displayed scripture text* is the whole point. Free-text JSON is not schema-validated, so a subtly malformed or creatively-reworded response could slip through `safeParseJsonArray`'s regex extraction undetected | `output_config.format` (structured outputs) with strict schema validation — reject and fall back on any validation failure, never attempt a "close enough" parse for this feature specifically |
| Letting the model re-type or "repeat" the passage text in its response, even inside a JSON field | This is the single highest-risk mistake for this feature — translation drift, mis-transcription, or the model "smoothing" phrasing are all indistinguishable from success until someone reads it against the source ESV text live in front of a congregation | Model output is *indices/spans into the original string only*; the app slices the original |
| A bigger/more expensive model "to be safe" | This is a structural-labeling task with a small, well-scoped output (assign N verses to two speakers) — added model size buys nothing here and contradicts the app's own stated cost-efficiency principle | `claude-haiku-4-5`, escalate only if evaluation shows real quality gaps |
| Regenerating the split on every view | Same passage + same split algorithm version should produce a stable result — cache the split per passage (e.g. on the `ScriptureSlideEditor`'s associated Firestore doc) and only re-call the API on an explicit user "re-split" action, consistent with the deterministic, non-churning UX this task needs |

---

## 3. Background images on slides

**No new libraries needed.** This is additive to infrastructure that already exists — the gap is data-model fields and a resolution/upload flow, not new tooling.

| Technology | Version | Purpose | Why / When to Use |
|------------|---------|---------|---------------------|
| Existing Firebase Storage + existing media-attachment upload flow | already in place | Storing background images | Same upload path already used for slide media/audio (`src/components/slides/**`) — add a `backgroundImageUrl?: string` field at three levels (`SongLyrics`, `SlideGroup`, `GroupSlideEntry`) per ARCHITECTURE.md §7's already-worked-out precedence model (slide overrides group overrides song) — no new upload UI pattern to invent |
| **Firebase Extension: `storage-resize-images`** (official, `firebase/extensions`) | latest published version at install time (`firebase ext:install storage-resize-images`) | Auto-generates a resized/optimized copy on upload | The right tool for "optimize/resize at upload" — install-and-configure, zero custom Cloud Function code, supports JPEG/PNG/WebP/AVIF output, preserves `Cache-Control`/content metadata automatically, and (critically) writes the resized copy into the **same bucket** so it inherits this app's existing Storage-lifecycle patterns rather than needing a new one. Configure it to target a size matched to presentation resolution (e.g. 1920×1080, or a couple of tiers for different device pixel ratios) so slides don't ship multi-megabyte originals to a projector browser tab |
| Plain CSS (`background-image` + `object-fit: cover`, or an `<img>` behind a positioned text layer) | — | Rendering the background behind slide text at presentation resolution | No library warranted — this is exactly what CSS backgrounds are for. The only real design work is a **text-contrast safeguard**: apply a semi-transparent scrim (a `background: rgba(0,0,0,0.35–0.5)` overlay, or a `text-shadow`/backdrop-blur band behind the text block) between the background image and the text layer so arbitrary user-uploaded photos never make copy illegible — this is a UI-SPEC/design concern for the relevant phase, not a stack concern, but flag it now so it isn't dropped |

### What NOT to add

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| A client-side image-resizing library (e.g. `browser-image-compression`, `pica`) | Adds a bundle-size cost and a second place resizing logic can drift from the server-side extension's behavior | `storage-resize-images` extension — resize server-side, once, consistently |
| A custom Cloud Function reimplementing what the extension already does | Firebase's own extension is maintained, handles metadata copying and multiple output sizes/formats declaratively, and needs zero custom code to install | The extension |

---

## 4. Toast / save-status system

### Recommendation: **hand-roll both**, on top of the Pinia `useSaveStatus` aggregator ARCHITECTURE.md §6 already specifies — no toast library

| What | Why a library is *not* warranted here |
|------|------------------------------------------|
| Persistent inline "Saving… / Saved HH:MM" indicator | This is not a toast at all — it's a small, permanently-mounted status chip anchored to content, reading a Pinia store. No toast/notification library models this UX pattern (they're all built around transient, stacked, auto-dismissing popups) — it's a ~30-line Vue component (a `<span>`/`<div>` with a computed label + Tailwind classes matching the existing dark theme), not a library-shaped problem |
| Failure-only toast | A single notification *kind*, triggered from one place (the same save-status aggregator, on a `status: 'error'` transition) — this is a handful of lines: a `<Teleport to="body">`'d fixed-position container, a small array of active toasts in the aggregator/store, a 4–6s auto-dismiss timer, and a dismiss button. Reaching for a library to solve "show one dismissable box occasionally" adds a dependency, its own theming override work (fighting the library's default look to match this app's gray-950/900 dark palette and the Claude Design wireframes already governing this milestone's visual language), and API surface (stacking rules, positioning config, animation config) this app will never use |

### Library survey (for the record — why each was passed over)

| Library | Version | Verdict |
|---------|---------|---------|
| `vue-toastification` | 1.7.14 (npm) | **Do not use.** Last published **2022-05-23** — over 3.5 years stale as of this research, no evidence of Vue 3.5+/Tailwind v4-era maintenance. Adopting an unmaintained UI dependency for a one-shot need is a worse long-term bet than 30 lines of owned code |
| `vue-sonner` | 2.0.9 (npm) | Actively maintained (last publish 2025-10), small, Vue-3-native, and would work fine — genuinely the best *library* option if one were needed. Still not warranted: it's built for multi-toast stacking/promise-chaining/rich variants this app doesn't need, and its default visual style would need full override work to match the existing dark theme and the Claude Design wireframes, which is roughly the same amount of work as writing the component directly against Tailwind v4 utility classes already in use everywhere else in this codebase |
| `reka-ui` (Toast primitive) | 2.10.1 (npm) | Very actively maintained (last publish within the last month), and its Toast primitive is genuinely accessible (Radix-derived, full keyboard/AT support) — but it's a large general-purpose headless-component library. Pulling in a whole new UI-primitives dependency for one component when this app has no other reka-ui usage is disproportionate. Worth reconsidering **only if** a later phase in this milestone or a future one needs several more accessible primitives (dialogs, popovers, comboboxes) at once — evaluate as a batch, not per-component |

### Accessibility requirements (apply regardless of hand-rolled vs. library)

- The persistent save-status text must live in an `aria-live="polite"` region so a screen-reader user hears "Saved 2:41" without it interrupting whatever they're doing — `polite`, not `assertive`, since this is routine status, not an alert.
- The failure toast is the one case that warrants `aria-live="assertive"` (or `role="alert"`, which implies assertive) — a save failure is exactly the kind of interruption-worthy event `assertive` exists for.
- Both regions should exist in the DOM at all times (not conditionally rendered in/out), with only their *text content* changing — conditionally mounting/unmounting an `aria-live` region is a common bug that causes some screen readers to miss the first announcement after mount.

---

## 5. Drag-and-drop — stay on SortableJS

Per the milestone constraint, this section answers narrowly: current-ness of the pin, whether a wrapper library is worth adopting, and the best additive keyboard-accessible layer. **No migration is proposed or implied anywhere below.**

| Question | Answer |
|----------|--------|
| Is `sortablejs@1.15.7` current? | **Yes.** `npm view sortablejs version` returns `1.15.7` as of this research (last published 2026-02-11) — the app's existing pin is already the latest release. No action needed on the SortableJS version itself; ARCHITECTURE.md §1 already identified the real defects as three specific bugs in how `ServiceEditorView.vue`'s `onEnd` handler uses the library, not a version or library problem |
| Is `vuedraggable`/`vue-draggable-plus` in use or worth adopting over raw SortableJS? | **Not in use today, and not worth adopting here.** See below |
| Best keyboard-accessible reordering option, as an additive layer | **Hand-rolled up/down move buttons + a single `aria-live="polite"` announcement region — no new dependency** |

### Why not `vuedraggable` / `vue-draggable-plus`

| Library | Version | Why not |
|---------|---------|---------|
| `vuedraggable` | 4.1.0 (npm, Vue-3-only rewrite — confirmed `peerDependencies: {"vue": "^3.0.1"}`) | It wraps SortableJS internally, and its bundled internal version is **`sortablejs@1.14.0`** (per its own `package.json` dependency) — older than the app's own direct `1.15.7` pin. Adopting it would either (a) let npm dedupe to a single SortableJS version and hope the two call sites' assumptions about `evt.oldIndex`/`oldDraggableIndex` semantics don't drift across that gap, or (b) end up with two SortableJS copies in the bundle. Neither is an improvement over the raw library this codebase already understands deeply (ARCHITECTURE.md's bug analysis reads SortableJS's actual source, line-referenced) |
| `vue-draggable-plus` | 0.6.1 (npm) | A newer, framework-agnostic-flavored wrapper with its own API surface to learn — but it does not solve anything ARCHITECTURE.md's root-cause analysis didn't already solve: the bugs are in *this app's* `onEnd` handler (wrong index fields, an incomplete DOM revert, an unstable `v-for` key), not in SortableJS's API surface. A wrapper library changes how you *call* SortableJS; it does not change whether your reorder logic reads `oldIndex` vs `oldDraggableIndex` correctly. Since the fix is already fully scoped against the raw library (ARCHITECTURE.md §1, points 1–6), swapping libraries mid-fix would mean re-deriving that same analysis against a new API for zero behavioral gain |

**Net:** the correct action here is applying ARCHITECTURE.md's already-completed root-cause fix (`evt.oldDraggableIndex`/`newDraggableIndex`, per-section `Sortable.create()` containers, `slot.id` as the `v-for` key, `onMove` returning `false` across section boundaries) to the existing `sortablejs@1.15.7` pin — not a library swap.

### Keyboard-accessible reordering — the additive layer

SortableJS is pointer/touch-only by design; it has no keyboard interaction model. The milestone correctly scopes this as *additive*, not a SortableJS replacement, and the well-established pattern for exactly this gap (see e.g. the "Dragon Drop" pattern documented by Smashing Magazine, and the same up/down-button approach independently adopted by numerous accessible sortable-list implementations) is:

1. **Add "Move up" / "Move down" buttons** to each reorderable row (Service Order slots, Slide Grid cards) — rendered alongside the existing drag handle, not replacing it. These buttons call the **exact same reorder function** the drag handler calls (the pure `reindexSlots`/array-splice logic ARCHITECTURE.md and PITFALLS.md both flag as already unit-testable in isolation from the DOM) — so there is no second, divergent reorder code path to maintain.
2. **Disable/hide the "up" control on the first item and the "down" control on the last item** *within its section* (CSS/`:disabled`, not full removal — removal shifts other elements' tab order unpredictably).
3. **Announce every move via a shared `aria-live="polite"` region** (the same one from §4 can plausibly be reused, or a sibling one scoped to the list) — e.g. "Call to Worship song moved to position 2 of 4 in Worship section." This is the piece a visible-only up/down button pair does *not* solve on its own — a sighted mouse user sees the list reorder; a screen-reader user needs the equivalent told to them.
4. **No new dependency.** This is achievable entirely with the existing Vue 3 + Tailwind v4 stack and the reorder logic ARCHITECTURE.md already identified as the correct fix target. A framework-agnostic accessible-DnD library (e.g. Atlassian's `@atlaskit/pragmatic-drag-and-drop`, actively maintained, real keyboard+AT support) exists and was evaluated, but running it **alongside** SortableJS for the same lists means two independent reorder engines that must agree on final order and both write through the same Firestore document — a coordination problem with no upside over the buttons-plus-announcements pattern above, which reuses the single already-correct reorder function from either trigger source.

---

## Installation

```bash
# Frontend — Claude API SDK upgrade (capability 2)
npm install @anthropic-ai/sdk@latest

# No other new frontend dependencies for v1.4's new capabilities.
# (Backgrounds, toast/save-status, and keyboard-accessible reordering are
#  built on the existing stack — see "What NOT to add" in each section.)

# Firebase Extension (capability 3) — installed via the Firebase CLI, not npm
firebase ext:install storage-resize-images

# functions/ — no new production dependencies for PPTX rendering (capability 1):
# LibreOffice + Poppler are OS packages baked into a custom Cloud Run container
# image (Dockerfile), not npm packages. If you choose to write the Cloud Run
# service in Node, it needs no new npm packages beyond what functions/
# already has (fs, child_process, @google-cloud/storage are already available
# in this ecosystem) — the render logic is a thin wrapper shelling out to
# `soffice` and `pdftoppm`.
```

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|--------------------------|
| PPTX → image rendering | Self-hosted LibreOffice + Poppler on a dedicated Cloud Run service | Aspose.Slides Cloud | If the team later wants zero self-hosted infra to maintain and is comfortable with a per-call vendor dependency + sending church slide content to a third party — the pricing works fine even then, it's a maintenance-tradeoff decision, not a cost one |
| PPTX → image rendering | Same | Gotenberg | If a future milestone needs to convert additional office formats beyond PPTX (DOCX, XLSX) — Gotenberg's broader format coverage starts paying for the extra service-hop complexity at that point |
| Scripture split model | `claude-haiku-4-5` | `claude-sonnet-5` | Only if real-passage evaluation during implementation shows Haiku's leader/congregation splits are unreliable on complex dialogue-heavy passages — escalate one tier, don't jump straight to Opus |
| Save-status / toast | Hand-rolled component + `aria-live` regions | `vue-sonner` | If a later milestone needs richer toast behavior (stacked notifications, promise-based loading→success→error chains, swipe-to-dismiss) across many more call sites than just save-failure — at that point the library's feature set starts earning its dependency cost |
| Keyboard-accessible reorder | Up/down buttons + `aria-live` announcements, reusing the existing reorder function | `@atlaskit/pragmatic-drag-and-drop` | If a future milestone wants to replace *all* of the app's drag interaction (not just add a keyboard path) with a more modern, actively-maintained, framework-agnostic engine — that's a real SortableJS migration decision this milestone explicitly rules out |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `ttf-mscorefonts-installer` / bundled real Microsoft fonts in the render container | Not licensed for redistribution in a hosted commercial SaaS product | Carlito/Caladea/Liberation (open, metric-compatible substitutes) |
| `unoconv` | Unmaintained wrapper adding a dependency layer with no functional benefit over calling `soffice` directly | Direct `soffice --headless --convert-to pdf` + `pdftoppm` |
| Prompt-engineered free-text JSON parsing (`safeParseJsonArray`-style) for the scripture-split feature specifically | Not schema-validated; the one feature in this milestone where output correctness is non-negotiable | `output_config.format` structured outputs, indices/spans only, never re-typed text |
| `vue-toastification` | Unmaintained since 2022 | Hand-rolled toast component (§4) |
| `vuedraggable` / `vue-draggable-plus` as a wrapper over the existing SortableJS pin | Bundles an older/duplicate SortableJS and adds an API-translation layer over a library whose bugs are already root-caused against its raw API | Apply ARCHITECTURE.md's fix directly to `sortablejs@1.15.7` |
| A second, parallel accessible-DnD library run alongside SortableJS for the same lists | Two reorder engines racing to write the same Firestore document is a new class of bug, not a fix | Up/down buttons calling the same reorder function (§5) |
| A client-side image resize library for backgrounds | Duplicates what the `storage-resize-images` Firebase Extension already does server-side, consistently | The extension (§3) |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@anthropic-ai/sdk@^0.115.x` | Node 22 (existing `functions/package.json` engines pin) | No known breaking runtime requirement beyond Node ≥18; re-verify `client.messages.parse()` / `output_config` are present in whatever exact version is current at implementation time via `npm view @anthropic-ai/sdk versions` |
| `sortablejs@1.15.7` | Vue 3.x (existing app pin) | Unchanged from today — this research confirms the pin, it does not change it |
| `storage-resize-images` extension | Firebase Storage (existing) | Writes resized copies into the **same bucket/paths convention** — verify its configured output prefix doesn't collide with `cleanupExpiredMedia`'s `orgs/{orgId}/media/` regex guard (PITFALLS.md's media-cleanup incident precedent) the same way the PPTX-render output must avoid it |
| LibreOffice / Poppler container | Cloud Run Gen 2, same GCP project as the Firebase project | Not compatible with Firebase's `functions` buildpacks deploy path — must be deployed via `gcloud run deploy`, invoked from a normal Gen-2 Function via service-to-service auth |

## Sources

- `npm view <package> version` / `versions` / `time.modified` — live npm registry, run 2026-07-28 (`sortablejs`, `vuedraggable`, `vue-draggable-plus`, `vue-toastification`, `vue-sonner`, `reka-ui`, `@anthropic-ai/sdk`)
- `claude-api` skill (bundled reference, this session, cached 2026-06-24 pricing table) — current model IDs/pricing (`claude-haiku-4-5`), structured-outputs (`output_config.format`) guidance, migration notes
- WebSearch: Gotenberg (official docs + Docker Hub listing, MIT license, LibreOffice-backed), Firebase Cloud Functions Gen 2 / Cloud Run buildpacks-vs-custom-container behavior, LibreOffice headless Docker concurrency/profile-isolation guidance, CloudConvert/Aspose/Syncfusion public pricing pages, Firebase `storage-resize-images` extension documentation, accessible drag-and-drop patterns (Smashing Magazine "Dragon Drop," `@atlaskit/pragmatic-drag-and-drop`) — all fetched 2026-07-28, confidence MEDIUM (vendor/community docs, not independently load-tested against this app's own deck corpus or traffic)
- Direct repository inspection: `C:\projects\worshipplanner\src\utils\claudeApi.ts` (existing Claude proxy pattern, current free-text JSON parsing this feature should NOT replicate), `functions/package.json` (Node 22 runtime pin), `package.json` (existing `@anthropic-ai/sdk@^0.78.0` pin) — confirms integration points against the real codebase, not assumed
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` (this session's sibling research) — cited directly wherever this file builds on their findings; no contradiction introduced

---
*Stack research for: WorshipPlanner v1.4 "Service and Slides" — new capabilities only*
*Researched: 2026-07-28*
