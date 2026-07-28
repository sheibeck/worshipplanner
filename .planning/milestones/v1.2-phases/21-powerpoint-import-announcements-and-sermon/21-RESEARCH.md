# Phase 21: PowerPoint Import for Announcements and Sermon - Research

**Researched:** 2026-07-24
**Domain:** Server-side PPTX parsing in a Firebase Cloud Function (Node.js 22), Firebase Storage upload from a Vue 3 client, mapping parsed content onto the existing unified slide model
**Confidence:** MEDIUM-HIGH (codebase architecture findings are direct reads with HIGH confidence; the PPTX-library recommendation is WebSearch/npm-registry verified but carries the `[ASSUMED]` package-provenance tag per protocol — see Package Legitimacy Audit)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D003 — PowerPoint as universal import format.** Support only `.pptx` import; Google Slides and Keynote users export to PowerPoint first. Rationale: one import pipeline instead of three; both tools have built-in PowerPoint export; avoids OAuth complexity (Google Slides API) and undocumented protobuf parsing (Keynote).
- **D004 — Server-side PPTX parsing via Cloud Function.** Parse PowerPoint files in a Firebase Cloud Function, not client-side. Rationale: more reliable extraction, no browser memory constraints, handles edge cases better — "least amount of hassle, most amount of reliability."

### Claude's Discretion

- **Exact PPTX parsing library** — the phase's central open question, resolved by this research (see Standard Stack / Package Legitimacy Audit below).
- Exact slide-mapping heuristic for slides that mix text and images.
- Whether the Cloud Function itself writes the parsed result to Firestore, or returns it to the client for the client to persist (this research recommends client-side write, for consistency with every existing store in this codebase — see Architecture Patterns).

### Deferred Ideas (OUT OF SCOPE)

- Google Slides API direct import (R026, out of scope per D003).
- Native Keynote import (R022, deferred).
- Pixel-accurate PPTX layout reproduction — CONTEXT scopes this to "basic layout," not a rendering-fidelity guarantee.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R010 | PPTX (.pptx) import via Firebase Cloud Function — universal import format; server-side parsing extracts text/images/layout to native slides. | Standard Stack (officeparser) + Architecture Patterns (upload→onCall→parse→map flow) + Code Examples |
| R011 | Announcement slides in Pre-Service section imported from PPTX or images. | Architecture Patterns (slide-model mapping, direct-image-upload path) + new `ImageSlide` type |
| R012 | Sermon slides in Message section imported from PPTX. | Same import pipeline reused with `section: 'message'`; Architecture Patterns |
| R017 (supporting) | Auto-save on all editing surfaces. | Don't Hand-Roll — reuse `useAutoSave` composable, already proven in Phase 18/19/20 |
| R018 (supporting) | Polished, intuitive UX reusing existing app design patterns. | Architecture Patterns — reuse `RosterImportModal.vue`-style step-based modal, `SlideshowPreview.vue` card patterns |
</phase_requirements>

## Summary

This phase adds the first Firebase Storage usage anywhere in this codebase (client SDK `getStorage()` is not yet initialized, `storage.rules` does not exist, and `firebase.json` has no `storage` block) — the plan must budget a small Storage-bootstrap task before any upload code. The recommended PPTX library is **`officeparser`** (npm, MIT, actively maintained, pure JS, buffer-based API — ideal for a Cloud Function with no persistent filesystem), which extracts per-slide text (with formatting/bullet levels) and embedded images (as base64 attachments) from a `.pptx` in one call. It carries a `[SUS]`-verdict flag from the automated legitimacy check because its "publish date" signal is keyed to the latest version bump (5 days old at research time) rather than package age — direct `npm view officeparser time.created` shows the package itself dates to 2019 with ~585K weekly downloads and a real GitHub repo, but per protocol this override does not upgrade the tag to `[VERIFIED]`; the planner must gate the `npm install officeparser` behind a `checkpoint:human-verify` task.

Architecturally, the cleanest fit is a new `SlotKind: 'IMPORTED'` that behaves exactly like the existing `SCRIPTURE` slot: one slot references one persisted "imported deck" document (a new Firestore collection, structurally identical to `scriptureReadings`), and `assembleSlideshow` expands that one slot into N `AssembledSlide`s by iterating the deck's pre-built `(TextSlide | ImageSlide)[]` — mirroring the `reading.slides.forEach(...)` case already in `slideshowAssembler.ts`. `ImageSlide` does not exist yet even though `'image'` is already a legal value in `SlideContentKind` (declared, unimplemented) — this phase must add the interface and a rendering branch in `SlideshowPreview.vue`.

The upload flow is: client uploads the raw `.pptx` to Firebase Storage directly (`uploadBytesResumable`), then calls a new `parsePptx` `onCall` Cloud Function with only the Storage path (never the file bytes — `onCall` payloads are not designed for multi-MB binary bodies). The function downloads the buffer server-side via `firebase-admin/storage`, parses it, uploads any extracted images back to Storage, and returns mapped `(TextSlide|ImageSlide)[]` JSON. The client — not the function — writes the Firestore doc, matching every other store in this codebase (Cloud Functions here are pure proxies/RPCs, never Firestore writers). On any parse failure the function throws a friendly `HttpsError` and the original upload in Storage is never touched, satisfying the CONTEXT error-handling contract; a scheduled cleanup (Phase 22) will eventually reclaim old imports rather than this phase deleting anything.

**Primary recommendation:** Use `officeparser` v7.4.0+ in a new `parsePptx` `onCall` Cloud Function (buffer in, `(TextSlide|ImageSlide)[]` JSON out); add `SlotKind: 'IMPORTED'` + `ImageSlide` to the existing type system and extend `assembleSlideshow`/`SlideshowPreview.vue` exactly the way the `SCRIPTURE` slot kind was added in Phase 19/20 — no new slide model, no new assembly paradigm.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `.pptx` / image file selection & upload | Browser / Client | Database/Storage (Firebase Storage) | Vue file input + `firebase/storage` client SDK; matches D004's "client never parses" boundary — client only moves bytes |
| PPTX parsing (text + image extraction) | API / Backend (Cloud Function) | — | D004 locked decision; `officeparser` runs inside `parsePptx` onCall function |
| Extracted-image persistence | API / Backend (Cloud Function, via `firebase-admin/storage`) | Database/Storage | Function uploads decoded image buffers so it can return stable download URLs in the same response |
| Parsed-slide → native model mapping (AST → `TextSlide`/`ImageSlide`) | API / Backend (Cloud Function) | — | Keeps the "central risk" (fidelity) entirely server-side and unit-testable with real fixture `.pptx` files, per CONTEXT Testing Requirements |
| Imported-deck persistence (Firestore) | Browser / Client (Pinia store) | Database/Storage (Firestore) | Every existing content store (`songLyrics`, `scriptureSlides`) writes from the client after receiving computed content — no precedent for a Cloud Function writing Firestore in this codebase |
| Slot ↔ deck binding, slideshow assembly | Browser / Client (pure `assembleSlideshow` + `useSlideshowAssembly`) | — | Existing Phase 20 engine; extend, don't replace |
| Error surfacing ("couldn't read this file...") | Browser / Client | API/Backend (throws `HttpsError`) | Function throws typed error; client modal renders the friendly copy |
| Access control (org-scoped read/write of uploads) | Database/Storage (`storage.rules`) | API / Backend (function double-checks org membership) | Mirrors `firestore.rules`'s `isOrgMember`/`isOrgEditor` helper pattern |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `officeparser` | `^7.4.0` (added to `functions/package.json`) | Parses `.pptx` buffers into a slide-by-slide AST with text, formatting, bullet levels, and base64 image attachments | Pure JS (no native binaries), dual CJS/ESM (`require`/`import` both exported — compiles cleanly under `functions/tsconfig.json`'s `"module": "commonjs"`), buffer-in API (no filesystem needed, ideal for Cloud Functions), actively maintained (~585K weekly downloads, MIT, real GitHub repo since 2019) `[ASSUMED — package identity from WebSearch; facts below VERIFIED via npm registry tool calls this session]` |
| `firebase/storage` (client) | Bundled in already-installed `firebase@^12.0.0` | Browser-side resumable upload (`uploadBytesResumable`) + download URL retrieval | Already a project dependency; zero new install; official Firebase SDK `[ASSUMED — stable, well-documented API, not re-fetched from docs this session]` |
| `firebase-admin/storage` (functions) | Bundled in already-installed `firebase-admin@^13.10.0` | Server-side bucket read (download uploaded `.pptx`) + write (upload extracted images) | Already a project dependency; zero new install `[ASSUMED]` |
| `firebase-functions/v2/https` `onCall` | Already installed `firebase-functions@^7.2.5` | New `parsePptx` RPC endpoint with automatic Firebase Auth context (`request.auth`) | Matches the v2 `onRequest` pattern already used for `api` in `functions/src/index.ts`; `onCall` is the idiomatic choice for first-party (non-proxy) authenticated app logic vs. `onRequest`'s external-proxy role `[ASSUMED — analogy to existing code + stable, long-unchanged Firebase API surface]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none new | — | — | No additional client packages needed — `firebase/storage` covers upload; no additional server packages needed beyond `officeparser` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `officeparser` | `node-pptx-parser` (npm, 1.0.1, ~15.8K weekly downloads) | Text-only — no image extraction (`README` review found no image API); requires a **file path**, not a buffer (needs `/tmp` writes in the Function, extra I/O); only 6 commits / 4 stars on GitHub — much thinner maintenance signal. Rejected: fails the "images too" requirement (R011/R012) outright. |
| `officeparser` | `pptx2json` (npm, 0.0.10, last published 2024-07, no repo URL on the registry) | Converts to JSON but treats media as opaque binary with no documented extraction ergonomics; no source repo listed — can't audit; stale (single low-version release). Rejected: unverifiable, unmaintained. |
| `officeparser` | `pptx-parser` (npm, 1.1.7-beta.9, published 2022, **still in beta**, no repo URL) | Perpetual beta tag, no repository to inspect, last touched 2022. Rejected: too fragile for a "central risk" phase. |
| `officeparser` | `officegen` (npm, 0.6.5) | **Generation-only** — creates `.pptx`/`.docx`/`.xlsx` files, no parsing API at all. Confirmed via `npm view` description ("Office Open XML Generator"). Rejected outright: wrong tool for this job (matches the CONTEXT hint that this was "likely unfit for parsing"). |
| `officeparser` | Raw OOXML unzip + XML parse (`jszip` + `fast-xml-parser`, hand-rolled) | Full control over shape positions/layout, smaller dependency footprint (no `tesseract.js`/`pdfjs-dist` transitively pulled in) — but requires hand-writing OOXML traversal: text runs split across multiple `<a:r>` elements, style inheritance from slide layouts/masters, relationship-ID → media-file mapping via `.rels` files. This is exactly the "hand-rolled fragile parser" D004 was written to avoid ("least amount of hassle, most amount of reliability"). Rejected as primary; documented here as the fallback path if `officeparser`'s image/text fidelity proves insufficient during Wave 0 fixture testing. |
| `officeparser` | `python-pptx` via subprocess | Cloud Functions Gen 2 for this project is a single Node.js codebase (`functions/` with `"engines": {"node": "22"}`, one `codebase: "default"` entry in `firebase.json`). Running `python-pptx` would require either a second Cloud Functions codebase deployed with the Python runtime (a whole parallel deploy pipeline for one feature) or a custom container — both a large complexity jump versus D004's stated goal. Rejected. |

**Installation:**
```bash
cd functions
npm install officeparser
```

**Version verification:** `npm view officeparser version` → `7.4.0`, last published 2026-07-19 (5 days before this research). `npm view officeparser engines` → `{ node: '>=18.0.0' }`, compatible with the `functions/package.json` `"node": "22"` runtime. `npm view officeparser exports` confirms both `require` (`dist/index.js`) and `import` (`dist/index.mjs`) entrypoints exist, so it compiles cleanly under `functions/tsconfig.json`'s `"module": "commonjs"` + `esModuleInterop: true` without an ESM-interop workaround. `[VERIFIED: npm registry — tool-confirmed facts about the named package; the package-name discovery itself remains ASSUMED per provenance rule]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `officeparser` | npm | Created 2019-04-15 (latest version published 2026-07-19 — 5 days old, which triggers the automated "too-new" heuristic) | 585,059/week | `github.com/harshankur/officeParser` | `[SUS]` (reason: `too-new`, a false positive from using latest-version-publish-date instead of package-creation-date — confirmed via `npm view officeparser time.created`) | **Flagged — planner must add a `checkpoint:human-verify` task before `npm install officeparser`**, per protocol. Reviewer should check: `time.created` (2019), weekly downloads (585K), real repo, MIT license — all support approval, but the formal verdict stays SUS until a human confirms. |
| `node-pptx-parser` | npm | Published 2025-02-17 | 15,837/week | `github.com/Mirza-Glitch/node-pptx-parser` | `[OK]` | Not selected (feature gap — no image extraction, file-path-only API) — not installed, no gate needed. |
| `pptx2json` | npm | Published 2024-07-07 | 15,837/week | none listed | `[SUS]` (`no-repository`) | Not selected — not installed, no gate needed. |
| `pptx-parser` | npm | Published 2021-11-19 (still tagged beta) | 12,703/week | none listed | `[SUS]` (`no-repository`) | Not selected — not installed, no gate needed. |
| `officegen` | npm | Published 2021-03-06 | 19,304/week | `github.com/Ziv-Barber/officegen` | `[OK]` | Not selected (wrong capability — generation, not parsing) — not installed, no gate needed. |
| `pptx-content-extractor` | npm | Published 2025-01-29 | 359/week | `github.com/Paul0908/pptx-content-extractor` | `[SUS]` (`low-downloads`) | Not selected (too little adoption to trust for the phase's "central risk") — not installed, no gate needed. |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]` and being installed:** `officeparser` — planner must insert a `checkpoint:human-verify` task immediately before the `npm install officeparser` step, presenting the human-verified evidence above (age, downloads, repo, license) for a go/no-go decision.

*`officeparser` was discovered via WebSearch (not official docs/Context7), so per the package-name provenance rule it is tagged `[ASSUMED]` for identity regardless of the registry facts confirmed about it. The specific version/download/repo/license facts themselves ARE tool-verified this session (`npm view`, `api.npmjs.org/downloads`).*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── Browser / Vue Client ───────────────────────────┐
│                                                                              │
│  ServiceEditorView.vue                                                     │
│   "Add element" menu ──► PptxImportModal.vue (new, step-based like         │
│                           RosterImportModal.vue: idle → uploading →        │
│                           parsing → preview → confirmed/error)             │
│         │                                                                   │
│         │ 1. user picks .pptx (or image[]) via <input type=file>           │
│         ▼                                                                   │
│  firebase/storage: uploadBytesResumable(file, orgs/{orgId}/pptx-imports/   │
│                     {importId}/source.pptx)  ── progress % shown in modal  │
│         │                                                                   │
│         │ 2. upload complete                                               │
│         ▼                                                                   │
│  httpsCallable(functions, 'parsePptx')({ orgId, importId, storagePath })   │
│         │                                                          ▲        │
└─────────┼──────────────────────────────────────────────────────────┼───────┘
          │ HTTPS (onCall, Firebase Auth ID token auto-attached)      │
          ▼                                                          │ JSON
┌─────────────────────── Firebase Cloud Function (Node 22) ──────────┼───────┐
│  functions/src/index.ts → export const parsePptx = onCall(...)     │       │
│                                                                      │       │
│  a. verify request.auth + org-membership (Firestore get)           │       │
│  b. bucket.file(storagePath).download() → Buffer                   │       │
│  c. officeparser.parseOffice(buffer, { extractAttachments: true,   │       │
│       fileType: 'pptx' }) → AST { content: [ {slide text/children},│       │
│       ...], attachments: [{name, base64, mime}] }                  │       │
│  d. mapAstToSlides(ast) → (TextSlide|ImageSlide)[]  (pure fn,      │       │
│       unit-testable in isolation — the phase's fidelity risk lives │       │
│       entirely in this one function)                               │       │
│  e. for each image attachment referenced by a mapped ImageSlide:   │       │
│       decode base64 → Buffer → bucket.upload to                    │       │
│       orgs/{orgId}/pptx-imports/{importId}/images/{n}.{ext}        │       │
│       → getDownloadURL / signed URL → set ImageSlide.imageUrl      │       │
│  f. SUCCESS → return { slides: SlideContent[] }  ─────────────────►┘       │
│     FAILURE → throw new HttpsError('invalid-argument',                     │
│       "We couldn't read this file — try re-exporting from PowerPoint.")    │
│       (source .pptx in Storage is NEVER deleted, on any path)              │
└──────────────────────────────────────────────────────────────────────────┘
          │ (success path only)
          ▼
┌─────────────────────────── Browser / Vue Client ───────────────────────────┐
│  3. modal shows preview of returned slides; user confirms                  │
│  4. importedSlides store (NEW, mirrors scriptureSlides.ts):                │
│       addDoc(organizations/{orgId}/importedSlides/{importId}, {           │
│         sourceFileName, section, slides, createdAt, updatedAt })          │
│  5. createSlot('IMPORTED', undefined, section) appended to service.slots  │
│       → existing deep-watch auto-save persists the slot (no new path)     │
│  6. useSlideshowAssembly / assembleSlideshow: new AssemblyInputs.          │
│       importedDecksById map; IMPORTED case expands 1 slot → N              │
│       AssembledSlide (mirrors existing SCRIPTURE case exactly)             │
│  7. SlideshowPreview.vue: new cardKind === 'image' branch renders          │
│       <img :src="imageUrl">; 'text' branch already exists and covers      │
│       text-mapped PPTX slides for free                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Direct-image-only path (R011, no PPTX involved):** same modal, a second mode skips steps (2)-(2f) entirely — client uploads each image straight to Storage, builds `ImageSlide[]` client-side (no parsing needed), and proceeds directly to step 3 of the diagram above. No Cloud Function call needed for pure-image imports.

### Recommended Project Structure

```
functions/src/
├── index.ts                 # add `export const parsePptx = onCall(...)` alongside existing `api`
├── pptxParser.ts             # NEW — mapAstToSlides(ast) pure function + officeparser invocation, unit-testable
└── pptxParser.test.ts        # NEW — integration tests against real fixture .pptx files (Wave 0 gap, see Validation Architecture)

src/
├── types/
│   └── slide.ts               # add `ImageSlide` interface + add to `Slide` union
│   └── service.ts             # add `'IMPORTED'` to SlotKind, add `ImportedSlot` interface to ServiceSlot union
│   └── importedDeck.ts        # NEW — mirrors scriptureReading.ts shape
├── stores/
│   └── importedSlides.ts      # NEW — mirrors scriptureSlides.ts (subscribe/create/update/get)
├── utils/
│   ├── slotTypes.ts            # extend slotLabel/createSlot switch for 'IMPORTED'
│   └── slideshowAssembler.ts   # extend AssemblyInputs + assembleSlideshow switch for 'IMPORTED'
├── composables/
│   └── useSlideshowAssembly.ts # wire importedDecksById map alongside scriptureReadingsById
├── components/
│   ├── PptxImportModal.vue     # NEW — step-based modal (idle/uploading/parsing/preview/error)
│   └── SlideshowPreview.vue    # extend cardKind() + add 'image' render branch
└── firebase/
    └── index.ts                # add `export const storage = getStorage(app)` + connectStorageEmulator
```

### Pattern 1: Extend a discriminated-union slot kind (the established Phase 19/20 pattern)

**What:** Adding a new content type to this codebase never introduces a parallel model — it always extends the existing `SlotKind` / `Slide` discriminated unions and the two switch statements that key off them (`assembleSlideshow`, `slotTypes.ts`).
**When to use:** For `IMPORTED` (this phase). Do not invent an `ImportedSlideSlot`-shaped standalone concept.
**Example (the SCRIPTURE precedent this phase should mirror):**
```typescript
// Source: src/utils/slideshowAssembler.ts (this codebase, read directly)
case 'SCRIPTURE': {
  if (!slot.scriptureReadingId) break
  const reading = inputs.scriptureReadingsById.get(slot.scriptureReadingId)
  if (!reading) break
  reading.slides.forEach((innerSlide, localSeq) => {
    const { id: _id, position: _position, ...rest } = innerSlide
    emit(slot, index, rest, slot.scriptureReadingId!, localSeq)
  })
  break
}
// NEW — IMPORTED follows the identical shape:
case 'IMPORTED': {
  if (!slot.importId) break
  const deck = inputs.importedDecksById.get(slot.importId)
  if (!deck) break
  deck.slides.forEach((innerSlide, localSeq) => {
    const { id: _id, position: _position, ...rest } = innerSlide
    emit(slot, index, rest, slot.importId!, localSeq)
  })
  break
}
```

### Pattern 2: `onCall` for first-party RPC vs. `onRequest` for external proxying

**What:** This codebase's only existing Cloud Function (`api` in `functions/src/index.ts`) is an `onRequest` reverse-proxy to third-party APIs (ESV/Anthropic/Planning Center), gated by a manually-forwarded `X-App-Auth` header verified via `getAuth().verifyIdToken()`.
**When to use:** `parsePptx` is not a proxy — it's first-party server logic. Use `https.onCall` (v2), which gives automatic `request.auth` population from the Firebase Auth SDK (no manual header plumbing) and structured error propagation via `HttpsError`.
**Example:**
```typescript
// New pattern for this codebase — onCall, not onRequest.
// Source: pattern inferred from firebase-functions v2 API surface (stable, unchanged
// for several years); NOT re-verified against docs.firebase.google.com this session. [ASSUMED]
import { onCall, HttpsError } from "firebase-functions/v2/https";

export const parsePptx = onCall(
  { memory: "1GiB", timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const { orgId, storagePath } = request.data as { orgId: string; storagePath: string };

    // Never trust a client-supplied path blindly — must match this org's own prefix.
    if (!storagePath.startsWith(`orgs/${orgId}/pptx-imports/`)) {
      throw new HttpsError("permission-denied", "Invalid storage path.");
    }
    // ... verify request.auth.uid is a member of orgId (Firestore get) ...

    try {
      const buffer = await downloadFromStorage(storagePath);
      const slides = await parsePptxBuffer(buffer, orgId, storagePath);
      return { slides };
    } catch (err) {
      console.error("PPTX parse failed:", err);
      throw new HttpsError(
        "invalid-argument",
        "We couldn't read this file — try re-exporting from PowerPoint.",
      );
      // Source file at storagePath is untouched on this path, by design.
    }
  },
);
```

### Pattern 3: `officeparser` buffer-based parse call

**What:** `officeparser` accepts a `Buffer`/`ArrayBuffer`/`Uint8Array` directly — no filesystem write needed, which matters because Cloud Functions Gen2 instances only guarantee writable `/tmp` (ephemeral, memory-backed, counts against function memory).
**Example:**
```typescript
// Source: raw.githubusercontent.com/harshankur/officeParser/master/README.md (fetched this session)
// [CITED: github.com/harshankur/officeParser — exact field names should be re-confirmed
// against the installed version's TypeScript types during Wave 0, since this was read via
// a README summary, not the compiled .d.ts]
import { OfficeParser } from "officeparser";

const ast = await OfficeParser.parseOffice(buffer, {
  extractAttachments: true,   // required for R011/R012 image extraction
  fileType: "pptx",           // required when parsing a Buffer with no filename extension
  ignoreNotes: true,          // speaker notes are not part of the on-screen slide content
});

ast.content.forEach((slide, idx) => {
  // slide.text -> flattened text; slide.children -> per-node text/image/list/table/shape
});
```

### Pattern 4: Firebase Storage resumable upload with progress (client)

**What:** Standard `uploadBytesResumable` + `on('state_changed', ...)` pattern.
**Example:**
```typescript
// [ASSUMED — stable, long-unchanged Firebase Web SDK v9+ modular API;
// not re-fetched from firebase.google.com/docs this session]
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase'

function uploadPptx(orgId: string, importId: string, file: File, onProgress: (pct: number) => void) {
  const storageRef = ref(storage, `orgs/${orgId}/pptx-imports/${importId}/source.pptx`)
  const task = uploadBytesResumable(storageRef, file)
  return new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      reject,
      () => resolve(task.snapshot.ref.fullPath),
    )
  })
}
```

### Anti-Patterns to Avoid

- **Passing raw file bytes through the `onCall` body:** `onCall` (and Cloud Functions HTTP triggers generally) are not designed for multi-MB binary payloads. Always upload to Storage first and pass only the path/reference.
- **A new "imported slide" model parallel to `Slide`:** don't invent an `ImportedSlide` type. This phase's own CONTEXT explicitly calls for mapping onto `TextSlide`/`image` (i.e. the new `ImageSlide`) — D001 (unified slide model) still governs.
- **Cloud Function writing Firestore directly:** breaks the codebase's established convention (every store — `songLyrics`, `scriptureSlides` — writes from the client, Cloud Functions here are pure proxies/RPCs). Keep `parsePptx` a pure request→response function; let the new `importedSlides` Pinia store own the `addDoc`.
- **Deleting the uploaded source file on parse failure (or ever, in this phase):** explicitly forbidden by CONTEXT's error-handling strategy. Deletion is Phase 22's job (2-week retention sweep), not this phase's.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OOXML zip/XML traversal for `.pptx` | A hand-rolled `jszip` + `fast-xml-parser` walker that reads `ppt/slides/slideN.xml`, resolves `r:embed` relationship IDs via `.rels` files, and handles split `<a:r>` text runs | `officeparser` | Text runs are routinely split across multiple XML nodes with inherited formatting from slide layouts/masters; a hand-rolled walker will silently mis-extract text on real-world decks from different PowerPoint versions — exactly the "fidelity" risk CONTEXT calls out as central |
| Resumable file upload with progress | A custom `XMLHttpRequest` wrapper with manual chunking/retry | `uploadBytesResumable` + `.on('state_changed', ...)` | Already provided by the `firebase` package already installed; battle-tested retry/resume semantics |
| Debounced auto-save of imported/edited slides | A new debounce+status composable | `useAutoSave` (`src/composables/useAutoSave.ts`) | Already proven across Phase 18/19/20 editors; R017 is explicitly "auto-save on all editing surfaces," not "auto-save, reinvented per phase" |
| Org-scoped access control for uploaded files | Custom signed-URL minting / auth middleware in the Cloud Function | `storage.rules` mirroring `firestore.rules`'s `isOrgMember`/`isOrgEditor` helpers | Firebase Storage security rules support the same `exists()`/`get()` cross-collection reads as Firestore rules — no reason to duplicate that logic server-side when the rules engine already enforces it at the Storage layer |

**Key insight:** Every "don't hand-roll" item above already has a proven implementation living in this codebase (auto-save) or is a documented Firebase primitive (Storage rules, resumable upload). The only genuinely new piece of hand-written logic this phase should introduce is `mapAstToSlides()` — the officeparser-AST → `(TextSlide|ImageSlide)[]` mapping — because that logic is inherently product-specific (there is no library that maps arbitrary presentation content onto *this app's* slide model).

## Common Pitfalls

### Pitfall 1: Firebase Storage isn't wired into this codebase at all yet
**What goes wrong:** A plan that jumps straight to "upload the file" fails immediately — `src/firebase/index.ts` has no `getStorage()` export, `firebase.json` has no `"storage"` key or storage emulator port, and `storage.rules` doesn't exist as a file.
**Why it happens:** Every other phase in this milestone (18-20) only touched Firestore; Storage has never been exercised.
**How to avoid:** Wave 0 of this phase's plan must add: `export const storage = getStorage(app)` + `connectStorageEmulator` in `src/firebase/index.ts`; a `storage.rules` file; a `"storage": { "rules": "storage.rules" }` block in `firebase.json`; and a `storage: { "port": 9199 }` entry under `emulators`. **This is shared foundation Phase 22 (Media Attachments) will also depend on** — build it generically (org-scoped path prefix, not PPTX-specific) so Phase 22 extends rather than duplicates it.
**Warning signs:** `getStorage is not a function` / `Firebase Storage: Bucket not found` type errors in dev; `firebase emulators:start` not printing a Storage emulator line.

### Pitfall 2: `SlotKind`/`Slide` switch statements aren't all compiler-enforced
**What goes wrong:** Adding `'IMPORTED'` to `SlotKind` will force a compile error in `slotTypes.ts::slotLabel`'s switch (no `default` case — good, TypeScript catches it) and `createSlot`'s switch. But `ServiceEditorView.vue` has multiple PC-export code paths that narrow with `(slot as any).songTitle` / `(slot as any).hymnName` casts (seen at lines ~2193, ~2310-2312) — these bypass exhaustiveness checking and will silently no-op or mis-label an `IMPORTED` slot instead of erroring.
**Why it happens:** The Planning Center export flow predates a fully-typed slot union and uses `as any` escape hatches in a few branches.
**How to avoid:** Grep `ServiceEditorView.vue` for `slot.kind ===` and `(slot as any)` after adding `IMPORTED`; explicitly decide (and test) what PC export does with an `IMPORTED` slot (likely: skip it, same as it likely already skips/mishandles kinds it doesn't special-case).
**Warning signs:** `vue-tsc --build` passes cleanly but PC export silently drops or mislabels imported-slide slots at runtime.

### Pitfall 3: `officeparser`'s image-heavy dependency tree affects Cloud Function cold start
**What goes wrong:** `officeparser`'s hard dependencies include `tesseract.js` (OCR engine, only used when `ocr: true`) and `pdfjs-dist` (only used for PDF), both sizable. These ship in `node_modules` regardless of whether OCR/PDF features are invoked, inflating the Cloud Function's deployed bundle and cold-start time even though this phase never sets `ocr: true`.
**Why it happens:** `officeparser` is a universal office-document parser (docx/xlsx/pdf/odt/etc.), not a `.pptx`-only tool; this phase only needs a slice of its capability.
**How to avoid:** Set `memory: "1GiB"` (not the 256MB default) and a generous `timeoutSeconds` on `parsePptx` to absorb slower cold starts; confirm actual cold-start latency during Wave 0 fixture testing rather than assuming it's negligible. If cold start proves unacceptable, fall back to the hand-rolled `jszip`+`fast-xml-parser` alternative documented above.
**Warning signs:** First invocation after idle consistently exceeds several seconds; deployed function package size noticeably larger than the existing `api` function.

### Pitfall 4: Treating "one PPTX slide in → one native slide out" as a hard guarantee
**What goes wrong:** Real-world decks routinely mix a background image with overlaid text on the same slide, or a text box plus a small logo image. A naive mapper that only checks "does this slide have any image child" will either drop the text or drop the image.
**Why it happens:** This is the exact "PPTX parsing fidelity" risk CONTEXT names as central. There's no library-level solution — it's a product decision about what to prioritize when a slide has mixed content.
**How to avoid:** Pick and document an explicit, simple heuristic during planning (e.g., "if the slide's non-image text content exceeds N characters, emit a `TextSlide`; else if it has ≥1 image, emit an `ImageSlide` per image; else skip"), write it as a pure testable function (`mapAstToSlides`), and test it against 3-4 real fixture decks (text-only, image-only, mixed, corrupted) rather than a single happy-path sample.
**Warning signs:** UAT reveals slides silently missing content type after import; "the sermon slide is blank" bug reports.

### Pitfall 5: Never deleting the failed-import source file, but also never cleaning up succeeded ones
**What goes wrong:** CONTEXT mandates never deleting on failure. It says nothing about deleting on success either — if this phase adds ad-hoc deletion-on-success logic, it risks deleting a file a user still wants to re-open/re-import, or conflicting with Phase 22's future retention sweep.
**Why it happens:** Temptation to "clean up after success" for storage-cost hygiene.
**How to avoid:** This phase does **not** implement any deletion logic at all — uploaded `.pptx` sources and extracted images simply persist in Storage under `orgs/{orgId}/pptx-imports/{importId}/...` until Phase 22's scheduled cleanup function (2-week retention, already researched in `22-RESEARCH.md`) reclaims them. Tag uploaded objects with a `createdAt`/service-date custom metadata field now (even though the cleanup function doesn't exist yet) so Phase 22 can consume it without a follow-up migration.
**Warning signs:** Any `delete()`/`deleteObject()` call appearing in this phase's plan outside of a user-initiated "remove this import" action.

## Code Examples

### Extending the `Slide` union with `ImageSlide`

```typescript
// Source: this codebase, src/types/slide.ts — SlideContentKind already declares 'image'
// (line 9) but no ImageSlide interface exists yet, and 'image' is absent from the
// `Slide` union (line 69). This phase must add both.
export interface ImageSlide extends SlideBase {
  contentKind: 'image'
  imageUrl: string
  altText?: string
}

export type Slide = LyricSlide | CopyrightSlide | ScriptureSlide | TextSlide | ImageSlide
```

### Extending `SlotKind` and `ServiceSlot`

```typescript
// Source: this codebase, src/types/service.ts
export type SlotKind = 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE' | 'HYMN' | 'IMPORTED'

export interface ImportedSlot {
  kind: 'IMPORTED'
  position: number
  importId: string | null
  section?: ServiceSection
}

export type ServiceSlot = SongSlot | ScriptureSlot | NonAssignableSlot | HymnSlot | ImportedSlot
```

### `storage.rules` skeleton (mirrors `firestore.rules`'s org-membership pattern)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /orgs/{orgId}/{allPaths=**} {
      allow read: if request.auth != null
                     && firestore.exists(
                          /databases/(default)/documents/organizations/$(orgId)/members/$(request.auth.uid));
      allow write: if request.auth != null
                      && firestore.exists(
                           /databases/(default)/documents/organizations/$(orgId)/members/$(request.auth.uid))
                      && request.resource.size < 26214400; // 25MB cap on a single upload
    }
  }
}
```
`[ASSUMED — cross-service firestore.exists() call syntax in Storage rules is a stable, documented Firebase feature; not re-fetched from docs this session. Verify exact syntax against current Firebase docs during Wave 0 before deploying.]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `officeparser` is the correct/legitimate package to install (name discovered via WebSearch, not official docs) | Standard Stack, Package Legitimacy Audit | Low-medium — mitigated by the mandatory `checkpoint:human-verify` gate before install; strong corroborating evidence (585K weekly downloads, 2019-era package, real repo) already gathered |
| A2 | `officeparser`'s exact AST field names/shape (`ast.content[].children`, `ast.attachments[].name`, etc.) match what was summarized from its README | Code Examples (Pattern 3) | Medium — a summarized README read could drift from the installed version's actual TS types; mitigated by the explicit recommendation to re-confirm against `node_modules/officeparser/dist/*.d.ts` during Wave 0 before writing production mapping code |
| A3 | `firebase-functions/v2/https` `onCall` accepts the same `{ secrets, memory, timeoutSeconds }` options-object shape already used by this codebase's `onRequest` | Architecture Patterns (Pattern 2) | Low — this is a long-stable, widely-used Firebase API surface; if the option names differ slightly, `vue-tsc`/`tsc` will catch it at compile time before deploy |
| A4 | `firebase/storage`'s `uploadBytesResumable`/`getDownloadURL` API surface is unchanged in the already-installed `firebase@^12.0.0` | Code Examples (Pattern 4) | Low — this API has been stable since the v9 modular SDK; not re-verified against `firebase@12` docs specifically this session |
| A5 | Storage security rules support `firestore.exists()` cross-service reads with the syntax shown | Code Examples (storage.rules skeleton) | Medium — if the syntax is wrong, `storage.rules` deploy will fail loudly (not a silent security hole), but should be verified against current docs before the deploy task, not assumed correct in the plan |

**None of these assumptions concern compliance, retention, or security *policy* decisions** (the security-relevant claims — org-scoping via `isOrgMember`, never-delete-on-failure — are locked CONTEXT decisions, not assumptions).

## Open Questions

1. **Exact mixed-content-slide mapping heuristic (text + image on one PPTX slide).**
   - What we know: `officeparser` returns a `children` array per slide distinguishing image/text/list/table nodes; the app's `Slide` model can only render one `contentKind` per `AssembledSlide`.
   - What's unclear: whether to (a) pick a single dominant content type per slide, (b) emit two `AssembledSlide`s (image then text) for one PPTX slide, or (c) let the user manually split during the preview step.
   - Recommendation: default to (a) for v1 simplicity (documented in Pitfall 4), with the preview step ((c)) as the user's escape hatch to catch mis-mapped slides before they're saved — this reuses the existing "manual override" precedent from Phase 19's scripture slides (`overriddenSlides`).

2. **Does the Cloud Function or the client resolve the download URL for extracted images?**
   - What we know: `firebase-admin/storage`'s `bucket.file(path)` can generate either a long-lived signed URL or rely on `storage.rules` + the client SDK's `getDownloadURL()`.
   - What's unclear: signed URLs (admin-generated) don't respect `storage.rules` and could outlive intended access; client-side `getDownloadURL()` requires the client to already know the exact path (which the function's response would supply anyway).
   - Recommendation: have the function return the Storage **path** (not a URL) for each image; let the client call `getDownloadURL(ref(storage, path))`, which respects `storage.rules` and matches the org-scoped access model everywhere else in this app.

3. **Max upload file size for `.pptx` sources.**
   - What we know: `storage.rules` example above caps a single upload at 25MB; church presentation decks with many embedded images can exceed this.
   - What's unclear: the right ceiling for this church's real-world decks (no data gathered this session).
   - Recommendation: start at 25MB (generous for a slide deck with modest images), surface the friendly "couldn't read this file" error path if `officeparser` chokes on a larger file's decompression limits, and treat the exact number as tunable — flag for discuss-phase / user confirmation if actual sermon decks run larger.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase CLI | `firebase emulators:start`, `firebase deploy`, storage.rules deploy | ✓ | 15.18.0 | — |
| Node.js (functions runtime match) | Cloud Function execution/build | ✓ | v24.11.1 local (functions targets `"node": "22"` in `functions/package.json`, `.nvmrc`/CI should pin 22 for parity) | — |
| npm | package install | ✓ | 11.15.0 | — |
| Firebase Storage emulator | local dev/testing of upload+parse flow without touching prod Storage | ✗ (not configured in `firebase.json` yet) | — | Wave 0 task adds `"storage"` to `firebase.json` `emulators` block; no external tool needed, just config |
| `officeparser` npm package | PPTX parsing in `parsePptx` | ✗ (not yet installed) | target `^7.4.0` | `npm install officeparser` in `functions/` (gated by `checkpoint:human-verify`, see Package Legitimacy Audit) |

**Missing dependencies with no fallback:** none — every gap above is a config/install task, not a hard external blocker.
**Missing dependencies with fallback:** Storage emulator (config-only fix); `officeparser` (install, gated by human verification).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` (already used across `src/`) — **not yet present in `functions/`** |
| Config file | `vitest.config.ts` (root, covers `src/`) — none exists for `functions/` yet (Wave 0 gap) |
| Quick run command | `npm run test:unit` (root, `src/` only) |
| Full suite command | `npm run test:unit && npm run test:rules` (root) — `functions/` has no test command at all today (Wave 0 gap) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R010 | `officeparser` AST → `(TextSlide\|ImageSlide)[]` mapping is correct for text-only, image-only, and mixed fixture decks | unit (pure function) | `cd functions && npx vitest run src/pptxParser.test.ts` | ❌ Wave 0 — needs `functions/vitest.config.ts` + fixture `.pptx` files |
| R010 | `parsePptx` onCall function rejects a corrupted/non-pptx upload with the friendly error and never deletes the source | integration | `cd functions && npx vitest run src/pptxParser.test.ts -t "invalid file"` | ❌ Wave 0 |
| R011 | Announcement (Pre-Service) `IMPORTED` slot expands to `AssembledSlide[]` via `assembleSlideshow` | unit | `npx vitest run src/utils/__tests__/slideshowAssembler.test.ts` | ✅ file exists — extend with new `IMPORTED` cases |
| R011 | Direct image upload (no PPTX) produces the same deck shape | component | `npx vitest run src/components/__tests__/PptxImportModal.test.ts` | ❌ Wave 0 — new component + test |
| R012 | Sermon (Message) `IMPORTED` slot renders as text/image cards in `SlideshowPreview.vue` | component | `npx vitest run src/components/__tests__/SlideshowPreview.test.ts` | ✅ file exists — extend with `'image'` cardKind case |
| R017 (supporting) | Auto-save fires on edits to imported slides | unit (reuse existing pattern) | `npx vitest run src/composables/__tests__/useAutoSave.test.ts` | ✅ already covers the composable generically — new editor component just needs its own wiring test |

### Sampling Rate

- **Per task commit:** `npx vitest run <changed-test-file>` (root for `src/`, `cd functions && npx vitest run <file>` for `functions/`)
- **Per wave merge:** `npm run test:unit` (root) + `cd functions && npx vitest run` (once Wave 0 bootstraps it)
- **Phase gate:** Full suite green (`npm run test:unit`, `npm run test:rules`, `functions/` vitest suite) before `/gsd-verify-work 21`

### Wave 0 Gaps

- [ ] `functions/package.json` — add `vitest` devDependency + a `"test"` script (none exists today; root `vitest.config.ts` only covers `src/`)
- [ ] `functions/vitest.config.ts` — new config (Node environment, not jsdom)
- [ ] Fixture `.pptx` files committed under `functions/src/__fixtures__/` (or similar): (1) text-only deck, (2) image-only deck, (3) mixed text+image deck, (4) an intentionally-corrupted/non-pptx file for the error path — needed for the "real `.pptx` files parsed into native slides" integration tests CONTEXT's Testing Requirements explicitly call for
- [ ] `src/firebase/index.ts` — Storage SDK init (`getStorage`, `connectStorageEmulator`) — blocks any client-side upload test
- [ ] `storage.rules` + `firebase.json` storage emulator config — blocks any Storage-rules test (the existing `@firebase/rules-unit-testing` devDependency already supports Storage rules testing, same package as `src/rules.test.ts` uses for Firestore — no new test-tooling dependency needed, just a new test file, e.g. `src/storage.rules.test.ts`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `onCall`'s automatic `request.auth` (Firebase Auth ID token verification) — same trust boundary as the existing `verifyIdToken()` check in `api`'s `callerIsAuthenticated()` |
| V3 Session Management | no | No new session state introduced; relies entirely on existing Firebase Auth sessions |
| V4 Access Control | yes | Org-membership check inside `parsePptx` (mirrors `isOrgMember`/`isOrgEditor` from `firestore.rules`) + equivalent `storage.rules` enforcement — defense in depth, not rules-only |
| V5 Input Validation | yes | Validate `storagePath` param is prefixed with the caller's own `orgs/{orgId}/` (prevents a malicious client from asking the function to parse/leak another org's file); validate file is actually a `.pptx` (magic-byte/zip-signature check, not just trusting the client's declared `fileType`) |
| V6 Cryptography | no | No new cryptographic operations introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org data leak via client-supplied `storagePath`/`orgId` passed unchecked to `parsePptx` | Tampering / Elevation of Privilege | Server-side prefix check (`storagePath.startsWith(orgs/${orgId}/)`) **plus** an independent org-membership Firestore lookup keyed off `request.auth.uid` — never trust the client-declared `orgId` alone |
| Zip/decompression bomb via a malicious `.pptx` (any zip archive can be crafted to expand to gigabytes) | Denial of Service | `officeparser`'s `decompressionLimits` option (per its documented config surface — `[CITED]`); a hard `memory`/`timeoutSeconds` cap on `parsePptx` acts as a backstop even if the library-level limit is misconfigured; `storage.rules` upload-size cap (25MB in the skeleton above) bounds the input before parsing even starts |
| File claiming to be `.pptx` but isn't (renamed executable, malformed zip, XXE-style crafted OOXML XML) | Tampering / Injection | Validate zip magic bytes (`PK\x03\x04`) before invoking the parser rather than trusting the client `Content-Type`/extension; `@xmldom/xmldom` (officeparser's internal XML dependency) does not resolve external entities by default in modern versions — this is a stable, well-known XML-parser default but was not independently re-verified against the specific pinned version this session `[ASSUMED]` |
| Unauthorized cross-org read of extracted images via a guessed/leaked Storage URL | Information Disclosure | `storage.rules` org-membership read gate (mirrors `firestore.rules`); prefer client-side `getDownloadURL()` (rules-respecting) over admin-generated long-lived signed URLs (see Open Question 2) |
| Unbounded Storage growth from repeatedly-retried failed imports (never-delete-on-failure by design) | Denial of Service (cost) | Accepted risk for this phase per CONTEXT's explicit tradeoff; bounded by Phase 22's future 2-week retention sweep — tag uploaded objects with `createdAt` custom metadata now so that sweep can consume them without a follow-up migration |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `.planning/phases/21-powerpoint-import-announcements-and-sermon/21-CONTEXT.md` — locked decisions D003/D004, error-handling contract, acceptance criteria
- `.planning/ROADMAP.md`, `.planning/milestones/v1.2-REQUIREMENTS.md`, `.planning/STATE.md` — phase requirements, milestone decisions D001-D006
- `functions/src/index.ts`, `functions/package.json` — existing Cloud Function pattern (`onRequest` proxy, secrets via `defineSecret`, Node 22 runtime)
- `src/types/slide.ts`, `src/types/service.ts`, `src/types/scriptureReading.ts` — unified slide model, `SlotKind`/`ServiceSlot` union, the `ScriptureReading` shape this phase's "imported deck" should mirror
- `src/utils/slideshowAssembler.ts`, `src/composables/useSlideshowAssembly.ts`, `src/utils/slotTypes.ts` — the pure assembly engine and reactive wrapper this phase extends, not replaces
- `src/components/SlideshowPreview.vue`, `src/components/ScriptureSlideEditor.vue`, `src/components/RosterImportModal.vue` — existing UI patterns (card-kind rendering, editor header/status, step-based import modal) to reuse
- `src/composables/useAutoSave.ts`, `src/stores/scriptureSlides.ts`, `src/utils/appAuth.ts`, `src/utils/esvApi.ts` — auto-save composable, Firestore store pattern, and the existing client→Cloud-Function auth-header pattern
- `src/firebase/index.ts`, `firestore.rules`, `firebase.json`, `package.json` — confirmed Storage is NOT yet initialized anywhere in this codebase (no `getStorage()`, no `storage.rules`, no storage emulator config)
- `.planning/phases/22-media-attachments-and-storage-lifecycle/22-RESEARCH.md` — corroborates the "Storage not yet connected" finding independently and supplies a draft `storage.rules` shape this phase's skeleton is aligned with
- npm registry (`npm view`, `api.npmjs.org/downloads`) — version/license/repo/downloads/`time.created`/engines/exports for `officeparser`, `node-pptx-parser`, `pptx2json`, `pptx-parser`, `officegen`, `pptx-content-extractor`, `jszip`, `fast-xml-parser`
- `gsd-tools query package-legitimacy check` — SUS/OK verdicts for all seven candidate packages

### Secondary (MEDIUM confidence — WebFetch of official repo README this session)
- `raw.githubusercontent.com/harshankur/officeParser/master/README.md` — `officeparser`'s buffer-based API, AST shape, `extractAttachments` option, PPTX support confirmation (fetched and summarized this session; exact field names flagged for Wave 0 re-verification against the installed package's TS types)
- `github.com/Mirza-Glitch/node-pptx-parser` — confirmed no image-extraction API, file-path-only constructor, thin maintenance signal (fetched this session)

### Tertiary (LOW confidence — WebSearch only, not independently verified)
- General PPTX-parsing-library landscape search results (surfaced the candidate list, cross-checked against npm registry directly rather than trusted as-is)
- `firebase-functions/v2/https` `onCall` options-object shape, `firebase/storage`'s `uploadBytesResumable` API — both training-knowledge/analogy-based, not re-fetched from `firebase.google.com/docs` this session; flagged `[ASSUMED]` throughout and should be spot-checked against current docs during implementation, not blindly trusted

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — `officeparser`'s suitability is well-supported by verified registry facts and a direct README fetch, but package identity remains `[ASSUMED]` per provenance rule and is gated behind a mandatory human-verify checkpoint
- Architecture (slot/slide model extension, upload flow): HIGH — derived entirely from direct reads of this codebase's existing, working precedent (Phase 19/20's SCRIPTURE slot pattern)
- Storage bootstrap findings (nothing exists yet): HIGH — directly confirmed by reading `src/firebase/index.ts`, `firebase.json`, and the absence of `storage.rules`, cross-checked against Phase 22's independent research reaching the same conclusion
- Pitfalls: MEDIUM-HIGH — most are codebase-verified (Storage not wired, `as any` casts in PC export, `SlideContentKind` declaring `'image'` unimplemented); the dependency-weight/cold-start pitfall is a reasoned inference from `officeparser`'s declared dependencies, not a measured benchmark

**Research date:** 2026-07-24
**Valid until:** ~30 days (stable Firebase/Vue platform APIs); re-verify `officeparser`'s exact AST shape against the installed version immediately before writing production mapping code regardless of this date, since that specific claim came from a README summary rather than the compiled type definitions
