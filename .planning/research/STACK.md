# Stack Research

**Domain:** v1.5 "Settings, Sharing, and Fidelity" — additions to an existing shipped Vue 3 + Firebase app
**Researched:** 2026-08-06
**Confidence:** MEDIUM (mixed — HIGH on npm package facts verified against the live registry, MEDIUM on Context7/official-doc claims, LOW on web-search-only claims such as NLT's terms of use and font metric comparisons; each finding below is tagged)

## Summary Up Front

Four of the five questions need **zero or near-zero new runtime dependencies**. This milestone is overwhelmingly about *wiring the existing stack differently* (a new proxy target, a new rules-testing pattern, new CSS `@font-face` assets, a native `Intl` API) rather than adding libraries. The one place a real new dependency earns its place is font tooling, and even there the recommended path (`@fontsource/*`) needs **no build step at all** — it is pre-built static assets shipped as npm packages.

## Recommended Stack

### Core Technologies — No Changes

| Technology | Version (current) | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vue 3 / Vite / Pinia / Tailwind v4 / Firebase 12 | unchanged (`^3.5.29` / `^7.3.1` / `^3.0.4` / `^4.0.0` / `^12.0.0`) | app runtime | Every v1.5 feature fits inside the existing architecture; nothing here forces a version bump |

### New Integration Points (no new npm packages)

| Addition | Purpose | Why Recommended |
|----------|---------|-----------------|
| `NLT_API_KEY` secret + `nlt: "https://api.nlt.to"` entry in `functions/src/index.ts`'s `PROXY_TARGETS` | Proxy the NLT API through the existing Cloud Function, mirroring `esv` | Reuses the proven proxy pattern exactly — no new server dependency, no new deploy step beyond `firebase functions:secrets:set NLT_API_KEY` |
| Custom-claim mirror on `organizations/{orgId}/members/{uid}` writes, using `firebase-admin`'s `getAuth().setCustomUserClaims()` (already a transitive capability of the installed `firebase-admin@^13.10.0`) | Carry org membership onto the ID token so `storage.rules` can read it without a cross-service Firestore call | `setCustomUserClaims` is a stable Admin SDK method already available through the installed `firebase-admin` version — no version bump needed |
| `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` applied to `classifyFiles`'s `images` bucket in `src/components/slides/dropRouting.ts` | Deterministic natural-sort ordering for multi-image drops (`img2.jpg` before `img10.jpg`) | Native to every JS engine Vite targets — zero bytes added to the bundle, no library to evaluate or maintain |

### Supporting Libraries — Font Self-Hosting (the one real addition)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fontsource/inter` | `5.3.0` | Self-hosted Inter (the Helvetica Neue stand-in — already the milestone decision in PROJECT.md) as static woff2 + CSS, shipped as an npm package | Import once; ship `@fontsource/inter/300.css`, `/400.css`, `/700.css` for Light/Regular/Bold |
| `@fontsource/roboto`, `@fontsource/open-sans`, `@fontsource/montserrat`, `@fontsource/poppins`, `@fontsource/lato`, `@fontsource/merriweather`, `@fontsource/oswald` | `5.3.0` each (verified present on npm registry 2026-08-06) | The remaining curated font families for the settings font picker | Same import pattern — one `@fontsource/<family>/<weight>.css` per weight actually offered in the picker |

**Why `@fontsource` over manually running a subsetting tool:** each `@fontsource/*` package already ships pre-built, pre-subsetted (per-charset, per-weight) `.woff2` files as static files inside `node_modules`, which Vite bundles/copies like any other asset. This satisfies "self-hosted, NOT the runtime Google Fonts API" (the explicit v1.5 decision — a projector with no internet at service time must never make a network request for a font) with **zero build tooling**, because there is nothing to build: importing the CSS is the entire integration. This is the standard, actively-maintained (>2000 packages, one per Google/OFL font family, `deps: none` on the core packages) way to self-host Google/OFL fonts in a Vite/npm project.

### Font Subsetting — Deliberately NOT Needed for the Common Case

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `subset-font` | `2.5.0` (verified on npm 2026-08-06) | WASM (harfbuzz/hb-subset) font subsetter, pure Node — no Python required | ONLY if the owner wants a font that has no `@fontsource` package (e.g., a purchased/custom family not on Google Fonts). Not needed for the curated OFL list above |

**Do NOT reach for `fonttools`/`pyftsubset`.** It is the traditional way to subset fonts, but it is a **Python** CLI tool — this project has no Python toolchain anywhere in its build (`package.json`, `functions/package.json`, `render-service/` are all Node), so adding it would introduce an entirely new language runtime to CI/dev machines for a job `@fontsource` already does. If custom subsetting is ever needed, `subset-font` (Node/WASM) stays inside the existing toolchain.

## Installation

```bash
# Fonts — pick from the curated list; each ships Light(300)/Regular(400)/Bold(700) at minimum
npm install @fontsource/inter @fontsource/roboto @fontsource/open-sans \
  @fontsource/montserrat @fontsource/poppins @fontsource/lato \
  @fontsource/merriweather @fontsource/oswald

# Only if a non-Google/OFL custom font is ever needed later
npm install -D subset-font
```

No `npm install` is needed for the NLT proxy, custom claims, or deterministic ordering work — those are wiring changes inside `functions/src/index.ts`, `storage.rules`/`firestore.rules`, and `dropRouting.ts` respectively.

## Detailed Findings by Question

### 1. NLT Bible API (api.nlt.to) — differs from ESV in a load-bearing way

**Confidence: LOW-MEDIUM** (web search + direct `WebFetch` of the live endpoint, not an official SDK/Context7 doc — verify against the owner's actual key + `/Documentation` page before building)

Verified by fetching `https://api.nlt.to/api/passages?ref=John.1.1&key=TEST&version=NLT` directly:

| Aspect | ESV API v3 (already integrated) | NLT API (api.nlt.to) |
|---|---|---|
| Auth | `Authorization: Token <key>` HTTP header | `key` **query string parameter** (`?key=...`) — cannot be injected as a header |
| Endpoint | `GET /v3/passage/text/?q=<ref>` | `GET /api/passages?ref=<ref>&key=<key>&version=NLT` |
| Response format | **JSON**: `{ passages: string[] }`, already clean plain text | **HTML** always — confirmed live: an `<h2>` heading plus body markup with verse numbers embedded inline. There is no documented parameter to request JSON or plain text, and no toggle for verse-numbers/headings/footnotes the way ESV has `include-verse-numbers`, `include-footnotes`, etc. |
| Rate limits | (existing, unaffected) | Anonymous/no-key: 50 verses/request, 500 requests/day, non-commercial only. Keyed: **up to 500 verses/request** (matches NLT's own copyright-statement cap), 5,000 requests/day. The owner already has a key. |
| Terms of use | (existing) | Quotations in "nonsalable media" — church bulletins, orders of service, and by direct analogy projected slides — only need the initials **"NLT"** appended, not a full copyright block. Quotations over 500 verses or 25% of a book need written approval from Tyndale House Publishers. This is a materially lighter attribution requirement than the app's existing CCLI song-copyright handling, but it still needs a visible "NLT" marker somewhere on scripture slides pulled from this source — mirror the existing copyright-on-first/last-slide pattern used for songs. |

**Integration consequences for the roadmap:**
- The Cloud Function proxy's `SECRET_INJECTED` header-injection pattern (`headers["authorization"] = ...`) does not work as-is for NLT, because the secret is a query parameter, not a header. The `nlt` proxy branch needs to append `?key=<NLT_API_KEY.value()>` to the **upstream URL**, not the headers object — a small, deliberate divergence from the `esv`/`anthropic` branches, not a bug to "fix" into consistency.
- `src/utils/scripture.ts` / a new `nltApi.ts` needs an HTML→plain-text extraction step that `esvApi.ts` never needed. Use the browser-native `DOMParser` (`new DOMParser().parseFromString(html, 'text/html').body.textContent`) to strip markup — no HTML-parsing library needed — but note this alone will NOT cleanly separate verse numbers from verse text (NLT's markup interleaves them with no toggle to suppress), so a regex pass over the parsed DOM (stripping elements matching NLT's verse-number span class, discovered by inspecting a real response) will likely be needed for output parity with the ESV path's clean text. Flag this as a phase-level unknown to resolve against a real fetched sample, not a generic HTML-strip.
- `version=NLT` is the query param default (also documented: `NLTUK`, `NTV`, `KJV` — the app should hardcode `NLT`).

### 2. Firebase Auth Custom Claims — Storage emulator DOES honor them, via a different mechanism than the broken one

**Confidence: MEDIUM** (Context7/official Firebase docs corroborate the size limit and refresh mechanics; the emulator-honoring claim is corroborated by the project's own installed `@firebase/rules-unit-testing@^5.0.0` API surface, verified against its own test file)

- **Mechanism (production):** Admin SDK `getAuth().setCustomUserClaims(uid, claims)` — already reachable via the installed `firebase-admin@^13.10.0`, no version bump. Recommended trigger point: a Firestore `onDocumentWritten`/`onDocumentCreated` handler on `organizations/{orgId}/members/{uid}` (mirroring the existing `parsePptxHandler`/`requestPptxRenderHandler` pattern of exporting a handler function separately from its trigger wrapper for unit-testability) that mirrors membership into a claim shaped like `{ orgId, role }`.
- **Size limit:** custom claims are capped at **1000 bytes total**. Exceeding it throws `auth/claims-too-large`. A single `{ orgId, role }` pair is nowhere near this limit — no design pressure here, but if the app ever needs multi-org membership, storing an array of org IDs would need to stay well under 1000 bytes (likely fine for the foreseeable org count).
- **Client propagation:** claims only land on a client's ID token at the **next token mint** — a natural refresh happens roughly every hour, but a UI action right after claim-setting (e.g., accepting an org invite) needs an explicit `await user.getIdToken(true)` (or `getIdTokenResult(true)`) to force-refresh and pick up the new claim immediately. This is a concrete new call site the invite-acceptance flow in `src/stores/auth.ts` needs to add.
- **Reading in Storage rules:** `request.auth.token.<claimName>` — e.g. `request.auth.token.orgId == orgId`. This is a **direct JWT-claim read**, structurally different from `firestore.exists(...)`, which is a cross-service call.
- **The emulator question — this is the crux of the whole change.** `firestore.exists()` is confirmed permanently inert against the Storage emulator (`firebase-js-sdk#6803`, already documented in this project's CLAUDE.md and reproduced in `src/storage.rules.test.ts`). **Custom claims read via `request.auth.token` do NOT go through that broken cross-service path at all.** The project's own `@firebase/rules-unit-testing` dependency exposes `testEnv.authenticatedContext(uid, tokenOptions)`, where `tokenOptions` is exactly a bag of custom claims baked directly into the mock ID token the test context presents — no real Auth Emulator sign-in, no Admin SDK round-trip, no cross-service Firestore read. Changing `src/storage.rules.test.ts`'s currently-broken calls (`testEnv.authenticatedContext('userA')`, relying on `firestore.exists()`) to `testEnv.authenticatedContext('userA', { orgId: 'orgA' })` against a rule rewritten to check `request.auth.token.orgId == orgId` is the concrete fix that makes the 2 currently-failing allow-case tests pass locally — this is precisely the CLAUDE.md-documented goal ("moving org membership onto a custom auth claim makes the check work in both environments").
- **One separate caveat found in research, not a blocker:** there is a known `firebase-tools-ui` issue where custom claims can fail to appear inside the **Cloud Functions emulator** when using the Auth emulator's own sign-in flow (`firebase/firebase-tools-ui#424`). This affects a different code path (Functions reading `request.auth` at runtime) than `rules-unit-testing`'s `authenticatedContext`, which mints its own test token independent of the Auth emulator's sign-in flow entirely. It's worth a phase-level smoke test, but it does not undermine the rules-unit-testing fix above.

### 3 & 4. Self-Hosted Fonts and the Helvetica Neue Substitute

**Confidence: MEDIUM** (npm registry facts are HIGH confidence — verified live 2026-08-06; licensing and metric-compatibility claims are web-search sourced, LOW-MEDIUM)

- **Licensing:** Google Fonts are distributed under either **SIL OFL 1.1** (Montserrat, Poppins, Lato, Merriweather, Oswald, Nunito, Inter) or **Apache License 2.0** (Roboto, Open Sans). Both explicitly permit bundling/redistributing inside a commercial app; the only OFL restriction is that you cannot sell the raw font *files* as a standalone product, and if you modify-and-redistribute under OFL you must rename. Neither license requires visible in-app attribution, though keeping the license file alongside the font (which `@fontsource` packages already do) is the correct practice.
- **Tooling — recommended:** `@fontsource/*` npm packages (see Recommended Stack above). Zero-build, per-weight, per-charset CSS+woff2 files, already the de facto standard way to self-host these exact fonts in a Vite project.
- **Tooling — only if needed later:** `subset-font` (Node/WASM, no Python) for any font outside the `@fontsource` catalog. **Do not introduce `fonttools`/`pyftsubset`** — it requires Python, a toolchain this project does not otherwise have anywhere (confirmed: `package.json`, `functions/package.json` are both pure Node).
- **Inter as the Helvetica Neue substitute (already decided in PROJECT.md):** confirmed as the standard open-source pick for this exact substitution — shares Helvetica's even color and closed apertures, ships Light(300)/Regular(400)/Bold(700) static weights plus a variable-font build via `@fontsource-variable/inter` if finer weight control is ever wanted. **Caveat surfaced by research and worth flagging to the roadmap:** Inter is explicitly *not metric-compatible* with Helvetica Neue (glyph widths differ) — the metric-compatible alternative is **Nimbus Sans L**, but that distinction matters for print reflow, not for on-screen/projected slide rendering, which is this app's actual use case. No action needed; Inter remains the right call for this milestone.
- **Rounding out the curated 6–8 family list (Light/Regular/Bold all present in each):** Inter (Helvetica Neue stand-in), Roboto, Open Sans, Montserrat, Poppins, Lato, Merriweather (serif — useful for scripture legibility contrast against sans body/lyric text), Oswald (condensed, for display/impact use). All eight confirmed present as `@fontsource/*` packages at version `5.3.0` on the npm registry as of this research date. Final subset for the UI is explicitly deferred to the UI research phase per PROJECT.md — this list is candidates, not a mandate.

### 5. Mobile Layout, Deterministic Ordering, Dismissible Panel — no new dependencies

- **Mobile-responsive Slides tab / service edit screen:** Tailwind CSS v4 (already installed, `^4.0.0`) has full responsive-variant support (`sm:`/`md:`/`lg:` etc.) and is already the app's exclusive styling approach. No new CSS framework, no new breakpoint library. This is a layout/markup change, not a stack change.
- **Deterministic multi-image ordering:** confirmed the actual gap by reading `src/components/slides/dropRouting.ts` — `classifyFiles` preserves whatever order the browser's `DataTransfer` API supplies, with no sort applied. The fix needs no library: `Array.prototype.sort()` with a comparator built from the **native** `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` produces correct natural-order sorting (`img2.jpg` before `img10.jpg`) directly from `file.name`, with zero bytes added to the bundle. Do not reach for `natural-orderby`, `natsort`, or similar npm packages — this is a solved problem in every modern JS engine via `Intl.Collator`.
- **Dismissible dashboard "Getting Started" panel:** a boolean dismissed-flag persisted either to `localStorage` or a small field on the user/org doc, gated with a plain `v-if`. No new library — this is the same pattern class as the app's existing settings toggles (e.g. `vwModeEnabled`), just user-scoped instead of org-scoped, or org-scoped if the owner wants it shared across the team.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@fontsource/*` npm packages for self-hosted fonts | Google Fonts runtime `<link>`/API | **Rejected by the owner already** — a projector with no internet at service time cannot fetch a remote font; this is explicit in PROJECT.md and not up for reconsideration |
| `@fontsource/*` npm packages | Manually downloading `.woff2` from `fonts.google.com` and hand-writing `@font-face` CSS | Only if a specific font is unavailable as an `@fontsource` package — otherwise this is pure maintenance burden (no version pinning, no easy weight/charset selection) for no benefit |
| `subset-font` (Node/WASM) | `fonttools`/`pyftsubset` (Python) | Never for this project unless a Python toolchain is independently justified elsewhere — this app has none today |
| `Intl.Collator` natural sort | `natural-orderby` / `natsort` npm packages | Only if the sort needs to go beyond filename comparison (e.g., locale-aware business rules a native Collator can't express) — not the case here |
| Custom auth claim mirrored via Firestore trigger | Reading org membership fresh from Firestore inside `storage.rules` (status quo) | Never — this is precisely the broken, emulator-untestable pattern the milestone exists to replace |
| Query-param key injection for NLT proxy branch | Reusing the ESV branch's header-injection code path unmodified | Never — NLT's auth is structurally a query param, not a header; forcing header injection would silently fail to authenticate every NLT request |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `fonttools` / `pyftsubset` | Python-only tool; this project's entire build (`package.json`, `functions/package.json`, `render-service/`) is Node — adding Python is a new toolchain for zero net benefit | `@fontsource/*` (no subsetting needed) or `subset-font` (Node/WASM) if a custom font is ever needed |
| Runtime Google Fonts API (`fonts.googleapis.com` `<link>` tags) | Already rejected by the owner in scoping — a projector offline at service time cannot fetch it | `@fontsource/*` self-hosted static assets |
| A new HTML-parsing library (e.g. `cheerio`, `node-html-parser`) for the NLT response | The browser's native `DOMParser` already does this client-side, with zero bundle cost, and the proxy pattern keeps parsing out of the Cloud Function entirely | `new DOMParser().parseFromString(html, 'text/html')` in `src/utils/nltApi.ts` (new file, mirroring `esvApi.ts`) |
| A natural-sort npm package for image ordering | `Intl.Collator({ numeric: true })` is native and already does exactly this | `Intl.Collator` comparator on `file.name` |
| Reusing the ESV proxy branch's header-injection logic unmodified for NLT | NLT authenticates via a query parameter (`key=`), not an `Authorization` header — copying the ESV pattern verbatim would send an unauthenticated request upstream | A small NLT-specific branch in `functions/src/index.ts` that appends `key=<secret>` to the upstream URL |

## Version Compatibility

| Package | Compatible With | Notes |
|-----------|-----------------|-------|
| `@fontsource/*@5.3.0` | Vite `^7.3.1` (installed) | Plain CSS + static asset imports — no Vite plugin required, works with the existing `@tailwindcss/vite` setup unmodified |
| `subset-font@2.5.0` | Node `^20.19.0 \|\| >=22.12.0` (installed engines range) | Pure WASM/JS, no native bindings, no Python — safe in CI and every dev machine already targeted |
| `firebase-admin@^13.10.0` (installed) | `setCustomUserClaims` | Already present — no bump needed for the custom-claims work |
| `@firebase/rules-unit-testing@^5.0.0` (installed) | `authenticatedContext(uid, tokenOptions)` | Already present — no bump needed for the storage.rules test fix |

## Sources

- Direct `WebFetch` of `https://api.nlt.to/api/passages?ref=John.1.1&key=TEST&version=NLT` (live response, 2026-08-06) — confirmed HTML output, confidence LOW-MEDIUM (single manual sample, not the full documented spec)
- `WebFetch`/`WebSearch` of `https://api.nlt.to/Documentation` and `https://api.nlt.to/` — endpoint shape, auth, rate limits, confidence LOW (web search summarization, not a primary-source read of full ToS text)
- `WebSearch`: NLT copyright-statement terms via studylight.org mirror of Tyndale's copyright statement — confidence LOW, should be re-verified against Tyndale's actual current terms before shipping scripture display copy
- `WebSearch`: Firebase custom claims size limit (1000 bytes) and `getIdToken(true)` refresh semantics, cross-referenced against `firebase.google.com/docs/auth/admin/custom-claims` — confidence MEDIUM
- `WebSearch`: Firebase Storage rules `request.auth.token` claim access, `firebase.google.com/docs/storage/security/rules-conditions` — confidence MEDIUM
- `WebSearch`: `@firebase/rules-unit-testing` `authenticatedContext(uid, tokenOptions)` API shape, cross-checked directly against this project's own `src/storage.rules.test.ts` (already imports `@firebase/rules-unit-testing`) — confidence MEDIUM-HIGH (own codebase confirms the API surface exists and is already in use, just without `tokenOptions` populated yet)
- `WebSearch`: `firebase/firebase-js-sdk#6803` (already cited in this project's CLAUDE.md) and `firebase/firebase-tools-ui#424` — confidence MEDIUM (named GitHub issues, cross-checked against project's existing documented understanding)
- npm registry, live `npm view` (2026-08-06): `subset-font@2.5.0`, `@fontsource/inter@5.3.0`, `@fontsource/{roboto,open-sans,montserrat,poppins,lato,merriweather,oswald}@5.3.0` — confidence HIGH (direct registry read)
- `WebSearch`: Google Fonts / SIL OFL 1.1 vs Apache 2.0 licensing terms for self-hosting/redistribution — confidence LOW-MEDIUM (multiple secondary sources agree, no single primary legal source fetched)
- `WebSearch`: Inter vs Helvetica Neue metric-compatibility comparison — confidence LOW (secondary comparison sites, not a font-metrics tool run directly)
- Direct file reads: `functions/src/index.ts` (proxy pattern), `src/utils/esvApi.ts` (ESV integration point), `src/stores/auth.ts` (org context loading), `storage.rules`, `src/storage.rules.test.ts`, `src/components/slides/dropRouting.ts`, `package.json`, `functions/package.json` — confidence HIGH (primary source, this codebase)

---
*Stack research for: WorshipPlanner v1.5 "Settings, Sharing, and Fidelity"*
*Researched: 2026-08-06*
