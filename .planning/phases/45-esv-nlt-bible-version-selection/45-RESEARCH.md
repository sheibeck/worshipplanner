# Phase 45: ESV/NLT Bible Version Selection - Research

**Researched:** 2026-08-07
**Domain:** Bible-translation source selection (NLT HTML proxy + ESV JSON proxy), per-slide translation provenance, shared attribution
**Confidence:** HIGH — the phase's one LOW-MEDIUM-confidence unknown (NLT's real response shape) was resolved by live fetch against the owner's key during this research session; every other claim is grounded in read source.

## Summary

R090-R092 add a church-level `bibleVersion` choice (`OrgSettings.bibleVersion: 'ESV' | 'NLT'`, default
**`NLT`** per the owner's locked override), a shared `(ESV)`/`(NLT)` attribution suffix, and a per-slide
`translationSource` field that makes "changing the setting never rewrites an existing slide" true by
construction rather than by convention.

The NLT API was fetched live six times against `https://api.nlt.to/api/passages` with the owner's real
key during this session (`NLT_API_KEY`, confirmed present, never printed). It returns **HTML**, status
200, with a stable, well-formed structure: a `<verse_export vn="N">` custom element per verse (the `vn`
attribute is the single most reliable place to read the verse number — more reliable than parsing the
rendered `<span class="vn">` text), footnote markers/bodies nested under `.a-tn`/`.tn` that must be
stripped, and heading elements (`.bk_ch_vs_header`, `.chapter-number`, `.subhead`) that must also be
stripped to match the ESV branch's `include-headings: false` / `include-footnotes: false` behavior.

The single most load-bearing finding, not visible from the requirement text or CONTEXT.md, is buried in
`src/utils/scriptureSplitter.ts`: the ESV-sourced passage text is expected in the literal format
`[16] For God so loved the world...` — square-bracketed verse numbers, one space, then text — because
`parseVerses()` splits on the regex `/\[(\d+)\]/` to build per-verse slides for both the scripture-slide
splitter and the congregational-reading alternator. **The NLT client's HTML-stripping step must
reproduce this exact bracket convention**, or NLT-sourced congregational readings silently lose
verse-level split granularity and fall back to word-count sentence splitting — a correctness bug with no
compiler or type signal, only a UX degradation the owner would discover live. This is now documented and
testable; it was not previously written down anywhere.

A second finding materially narrows the phase's actual code-touch surface versus what CONTEXT.md's
"both paths" framing implies: tracing `resolveEntryContent` (`slideshowAssembler.ts`) shows that a
**Reference-state** (non-congregational) SCRIPTURE slide is *always* assembled with `text: ''` — the
projected slide shows only the reference, never passage body text, by design (R047). Only the
**Congregational** path (`CongregationalEditor.vue` → `ScriptureSlot.congregationalSections` →
`SourceRef` → `ScriptureSlide.section.text`) ever carries real, attributable scripture words today. A
second component, `ScriptureSlideEditor.vue` (with its own `ScriptureReading` Firestore document type),
appears to fetch and split full passage text but is **dead code** — not imported by
`ServiceEditorView.vue` or any other live component, reachable only from its own test file. The plan
should route ESV/NLT selection through `CongregationalEditor.vue` (persisted, attributed text) and
`ScriptureInput.vue` (live reference-preview only, never persisted) — not `ScriptureSlideEditor.vue`.

**Primary recommendation:** Thread `translationSource: 'ESV' | 'NLT'` through the *existing*
`CongregationalSection` shape (not a new parallel structure) — `CongregationalEditor.vue` stamps it once
at fetch time from `authStore.settings.bibleVersion`, and it survives unchanged through
`ScriptureSlot.congregationalSections` → `SourceRef` → `ScriptureSlide.translationSource` with no
re-derivation at read time. Build the NLT proxy as a fourth branch in the existing generic
`functions/src/index.ts` reverse-proxy (`PROXY_TARGETS`/`SECRET_INJECTED`), injecting the `key` as a
**query parameter appended to the outbound URL** — architecturally different from the ESV branch's
header injection, since the current proxy only rewrites `headers`, never the URL.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 — Settings choice & storage**
- Settings UI: a new "Scripture" / "Bible Version" section in `SettingsView.vue` with an ESV/NLT choice
  control (segmented control or radio), gated to org editors like every sibling Settings control.
- Storage: ONE new field `bibleVersion: 'ESV' | 'NLT'` on `OrgSettings` (`src/types/organization.ts`) +
  ONE entry in `DEFAULT_ORG_SETTINGS`, merged through the SINGLE existing `auth.ts::loadOrgContext`
  merge point. No second defaults-merge point (same contract Phases 39/44 follow).
- **⚠ OVERRIDE (owner, 2026-08-07) — default = `'NLT'`, NOT `'ESV'`.** The recommended default was ESV
  (preserve current behavior); the owner chose **NLT** as the house default. A church that never opens
  the setting fetches NEW scripture from NLT.
  - **⚠ DEPLOY-COUPLING IMPLICATION (must honor in plan + PENDING-VERIFICATION):** the NLT proxy ships
    **undeployed**. A default of NLT therefore means **new scripture fetching does not work until the
    owner deploys the NLT Cloud Function**. The frontend (defaulting to NLT) and the `functions` NLT
    branch MUST be deployed **together** — if the frontend ships with an NLT default but the function is
    not yet deployed, every new scripture fetch fails. This must be stated in the handoff to the owner
    and recorded in PENDING-VERIFICATION.md § Phase 45. (Existing slides are unaffected — see Area 3.)

**Area 2 — Attribution (R091)**
- Format: initials only — `(ESV)` / `(NLT)`. Non-saleable media (projected slides, bulletins) need only
  the initials, not a full copyright notice.
- Build once, shared: a single pure helper (e.g. `scriptureAttribution(version)`) used by BOTH the
  existing scripture-slide path and the new congregational-reading path — one implementation, not two.
- Placement: appended to the displayed/projected scripture text.

**Area 3 — Per-slide translation source (R092)**
- Field: a per-slide `translationSource: 'ESV' | 'NLT'`, stamped **at slide creation** from the church's
  current `bibleVersion` setting.
- Existing field-less slides → `'ESV'` at read time. Slides created before this phase have no
  `translationSource` field; they resolve to `'ESV'` (ESV was the only source before this phase). This
  stability IS the R092 "never retroactively alter" guarantee.
  - Interaction with the Area-1 NLT default: the NLT default governs only NEW slides going forward;
    every pre-existing slide stays ESV via this field-less fallback. The two are not in conflict.
- Which slides carry it: scripture slides AND congregational-reading slides.

**Area 4 — NLT proxy (LOCKED by R090)**
- Auth via a `key` **query parameter** (not a header — the ESV branch's header injection cannot be
  reused verbatim).
- New branch in `functions/src/index.ts` + a new `src/utils/nltApi.ts` client with a **native
  DOMParser** HTML-stripping step (NLT returns HTML, not JSON; no new dependency).
- Tested against a real sample fetched with the owner's `NLT_API_KEY` — the response shape was
  LOW-MEDIUM confidence and had to be verified against a real fetch, not assumed. **Done in this
  research session — see "NLT API — Verified Real Response Shape" below.**
- Ships built, tested, and UNDEPLOYED, with the exact `firebase deploy --only functions` command handed
  to the owner (per the standing v1.5 autonomy grant — NO DEPLOYS).

### Claude's Discretion
- Exact Settings control widget (segmented vs radio), the attribution helper's file placement, the
  `translationSource` field's exact TS location on the slide types, and the `nltApi.ts` internal parse
  structure — all at the planner/executor's discretion within the decisions above.

### Deferred Ideas (OUT OF SCOPE)
- Bulk re-fetch / re-translate of existing slides — explicitly out of scope (would violate R092).
- Additional translations beyond ESV/NLT — not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R090 | A church can choose ESV or NLT as the source for scripture passages, in Settings. | `OrgSettings.bibleVersion` pattern (§ Standard Stack, § Architecture Patterns), verified real NLT response shape and proxy query-param auth (§ NLT API), the two live call sites that need routing (`ScriptureInput.vue`, `CongregationalEditor.vue`) vs. the one dead one to skip (`ScriptureSlideEditor.vue`) (§ Common Pitfalls). |
| R091 | Scripture text carries its required translation attribution wherever it is displayed or projected. | `scriptureAttribution()` shared-helper design (§ Architecture Patterns, § Code Examples), exact render sites (`PresentationViewer.vue`, `slideDisplay.ts::slideBodyText`) traced to source line numbers, and the finding that only the congregational path currently carries attributable text (§ Common Pitfalls, § Open Questions). |
| R092 | Changing the translation setting does not retroactively alter scripture on slides that already exist. | Exact field-threading path traced end-to-end: `CongregationalSection.translationSource` → `SourceRef` → `ScriptureSlide.translationSource`, stamped once at `CongregationalEditor.vue` fetch time, never re-derived by `sourceSignature`/materializer rebuilds (§ Architecture Patterns, § Code Examples). `resolveTranslationSource()` field-less fallback to `'ESV'` for pre-phase slides. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bible version choice storage | API / Backend (Firestore) | Browser (Settings UI) | `OrgSettings.bibleVersion` persists org-wide; the Settings radio is a thin read/write view over it, matching the AI/PC toggle precedent. |
| ESV passage fetch | API / Backend (Cloud Function proxy) | Browser (`esvApi.ts` client) | Existing pattern — API key never ships to the browser; proxy injects the `Authorization` header server-side. |
| NLT passage fetch | API / Backend (Cloud Function proxy) | Browser (`nltApi.ts` client + DOMParser strip) | Same secret-injection requirement as ESV, but auth is a query param the proxy must append to the outbound URL, not a header. HTML→text stripping happens client-side (DOMParser is a browser API; the Cloud Function is Node and has no DOM). |
| Attribution suffix | Browser (render sites) | — | Pure, stateless string formatting (`scriptureAttribution(version)`) consumed at render time by `PresentationViewer.vue` and `slideDisplay.ts` — no backend involvement. |
| Per-slide `translationSource` | API / Backend (Firestore, `SlideGroup`/`ScriptureSlot` documents) | Browser (stamp-at-creation call site) | Written once by the browser at fetch time, then persisted; every later read (including the settings-change-never-alters-existing-slide guarantee) is a passive Firestore read, never recomputed from the org's current setting. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `fetch` | Node 22 built-in (already used) | ESV/NLT proxy calls in `functions/src/index.ts` | Already the mechanism for the ESV/Claude/PC proxy branches — no new dependency. |
| Native `DOMParser` | Browser built-in | Parse NLT's HTML response into strippable DOM in `src/utils/nltApi.ts` | Locked by CONTEXT.md Area 4 — "no new dependency." Already how a browser bundle would handle this; confirmed unnecessary to add `jsdom`/`cheerio` since parsing happens client-side, not in the Cloud Function. |

No new npm packages are introduced by this phase — the DOMParser step and the query-param proxy branch
both use platform/runtime built-ins already present in the toolchain.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `DOMParser` string stripping | Regex-strip the HTML tags directly | Rejected — CONTEXT.md explicitly locks native DOMParser; regex HTML stripping is also the classic footgun for nested tags (the `.a-tn`/`.tn` footnote nesting inside `<verse_export>` would be fragile to strip correctly with regex, trivial with `.remove()` on a parsed element). |
| Query-param key injection in the proxy | Have the Cloud Function's NLT branch be its own separate `onRequest` export (not a `PROXY_TARGETS` branch) | Rejected — the generic proxy pattern (`api` function, `PROXY_TARGETS`/`SECRET_INJECTED`) already exists and is the established pattern for ESV/Claude/PC; a fourth branch is a smaller diff and keeps one auth gate (`x-app-auth`) for all three secret-injected services. |

**Installation:** none — no new packages.

## Package Legitimacy Audit

Not applicable. This phase introduces zero new npm dependencies in either `functions/` or the frontend
— `DOMParser` and `fetch` are both platform built-ins already used by sibling code in this exact file
(`functions/src/index.ts`'s existing ESV/Claude/PC branches).

## NLT API — Verified Real Response Shape

**Fetched live during this research session** against `https://api.nlt.to/api/passages`, using the
owner's real `NLT_API_KEY` from `.env.local` (confirmed present, 36 characters, never printed — every
snippet below has the key redacted to `<owner-key>`). Six fetches: a single verse, a multi-verse range,
a passage with section headings (Beatitudes), a Psalm (poetry formatting + superscription), a
colon-vs-period ref-separator check, and two auth-probe fetches (missing key, garbage key).

### Request shape (confirmed working)
```
GET https://api.nlt.to/api/passages?ref=John+3:16-18&version=NLT&key=<owner-key>
```
- `ref` accepts the exact same `"Book Chapter:VerseStart-VerseEnd"` string the app already builds via
  both existing `formatQuery()` implementations (`ScriptureSlideEditor.vue:174-183`,
  `CongregationalEditor.vue:277+`) — **no ref-format translation needed between the ESV and NLT
  clients.** Both colon (`John 3:16-18`) and period (`John 3.16-18`) separators work; use colon to match
  the existing convention.
- `version=NLT` is required and literal — sending `version=ESV` against this host returns HTTP 200 with
  an **empty body** (see Error Shape below), not a redirect or a helpful error.

### Response shape
- **HTTP 200**, `content-type: text/html; charset=utf-8`, `content-encoding: br` (Brotli — already
  transparently decompressed by both Node's `fetch` in the Cloud Function and any browser `fetch`; no
  special handling needed, confirmed by measuring decompressed byte length matches the printed text).
- Body is a full HTML document. All content lives under `<div id="bibletext"><section>...</section></div>`.

Actual redacted sample (`John 3:16`, single verse):
```html
<!DOCTYPE html><html lang="en-US">
<head><title>NLT API</title>
<link rel="stylesheet" href="https://api.nlt.to/content/nlt-api-css?vers=1.04"/>
</head>
<body>
<div id="bibletext" class=" NLT NLT BibleText section"><section><h2 class="bk_ch_vs_header">John 3:16, NLT</h2><verse_export orig="john_3_16" bk="john" ch="3" vn="16">
<p class="body"><span class="vn">16</span><span class="red">&#8220;For this is how God loved the world: He gave<a class="a-tn">*</a><span class="tn"><span class="tn-ref">3:16</span> Or <em>For God loved the world so much that he gave.</em></span> his one and only Son, so that everyone who believes in him will not perish but have eternal life.</span> </verse_export></section></div></body></html>
```

Multi-verse (`John 3:16-18`) — confirms one `<verse_export>` per verse, back-to-back, no separator needed:
```html
<div id="bibletext" ...><section><h2 class="bk_ch_vs_header">John 3:16-18, NLT</h2><verse_export orig="john_3_16" bk="john" ch="3" vn="16">
<p class="body"><span class="vn">16</span>...</verse_export><verse_export orig="john_3_17" bk="john" ch="3" vn="17"><span class="vn">17</span>...<p>
</verse_export><verse_export orig="john_3_18" bk="john" ch="3" vn="18">
<p class="body"><span class="vn">18</span>...</verse_export></section></div>
```

Heading/subheading case (`Matthew 5:1-12`, the Beatitudes) — confirms nested chapter/section headings
that must be stripped, AND confirms poetry-formatted verses can carry multiple `<p>` children inside one
`<verse_export>`:
```html
<verse_export orig="matt_5_1" bk="matt" ch="5" vn="1">
<h2 class="chapter-number"><span class="cw">Matthew</span> <span class="cw_ch">5</span></h2>
<h3 class="subhead">The Sermon on the Mount</h3>
<p class="body-ch-hd"><span class="vn">1</span>One day as he saw the crowds gathering...</verse_export>
...
<verse_export orig="matt_5_3" bk="matt" ch="5" vn="3">
<h3 class="subhead">The Beatitudes</h3>
<p class="poet1-vn-hd"><span class="vn">3</span><span class="red">"God blesses those who are poor...</span></p>
<p class="poet2"><span class="red">for the Kingdom of Heaven is theirs.</span></p>
</verse_export>
```

Psalm case (`Psalm 23`) — confirms a psalm superscription (`<p class="psa-title">A psalm of David.</p>`)
lives *inside* verse 1's `<verse_export>`, ahead of the actual verse text — see Open Questions for the
strip-or-keep call:
```html
<verse_export orig="psal_23_1" bk="psal" ch="23" vn="1">
<h3 class="chapter-number"><span class="cw">Psalm</span> <span class="cw_ch">23</span></h3>
<h4 class="subhead">The <span class="subhead-sc">Lord</span> Is My Shepherd</h4>
<p class="psa-title">A psalm of David.</p>
<p class="poet1-vn-sp"><span class="vn">1</span>The <span class="sc">Lord</span> is my shepherd;</p>
<p class="poet2">I have all that I need.</p>
</verse_export>
```

### Element inventory — strip vs. keep

| Selector | What it is | Strip or keep | Why |
|----------|-----------|----------------|-----|
| `verse_export` (custom element, `vn` attribute) | One verse's wrapper | **Keep the element, read `vn` attribute** | The single most reliable per-verse boundary and verse-number source — more reliable than parsing `.vn` span text, which can be absent from mid-verse continuation fragments. Custom/unknown tag names parse fine under `DOMParser`/`querySelectorAll` — treated as generic elements, matched by tag name like any other. |
| `.bk_ch_vs_header` | Top-of-passage "Book Chapter:Verse, NLT" banner | **Strip** | Redundant with the app's own reference display; ESV parity (`include-passage-references: false`). |
| `.chapter-number` | Mid-passage "Matthew 5" chapter banner (appears at the start of a chapter within a range) | **Strip** | Not scripture text; ESV parity (`include-headings: false`). |
| `.subhead` | Editorial section headings ("The Beatitudes", "The Lord Is My Shepherd") | **Strip** | Not scripture text; ESV parity (`include-headings: false`). |
| `.vn` (span, verse number as rendered) | Visible verse-number glyph | **Ignore — read `verse_export`'s `vn` attribute instead** | Avoids the no-space-before-following-text problem (`<span class="vn">16</span>` is directly abutted to the next text node in the raw HTML with no separating space) and avoids re-deriving what the parent element attribute already gives cleanly. |
| `.a-tn` (footnote marker, e.g. `*`) | Footnote reference glyph | **Strip** | Would otherwise leak a bare `*` into slide text. |
| `.tn` (footnote body, nested immediately after `.a-tn`) | Full footnote text (e.g. "Or *For God loved the world so much...*") | **Strip** | Would otherwise leak footnote prose into the middle of verse text — this is the single largest correctness risk in the raw HTML; footnotes are NOT wrapped in their own top-level container, they are nested *inline inside the verse's own paragraph*, immediately following the word they annotate. |
| `.red` (red-letter/words-of-Jesus wrapper) | Semantic styling only | **Keep contents, ignore the wrapper** | No text to strip — `.textContent` naturally includes it. |
| `.sc` (small-caps, e.g. rendering "LORD") | Semantic styling only | **Keep contents, ignore the wrapper** | Same — `.textContent` naturally includes "Lord". |
| `.psa-title` (Psalm superscription, e.g. "A psalm of David.") | Editorial superscription, lives *inside* verse 1's `<verse_export>` | **Flagged — see Open Questions** | `[ASSUMED — LOW]` Recommend stripping alongside headings (it is editorial framing, not scripture words, and if kept it silently prepends onto verse 1's own text); not independently verified against a real ESV Psalm 23 sample in this session (no ESV network fetch was performed — only NLT). |
| `<p>` line-break structure (poetry `poet1`/`poet2` classes) | Poetic line stanzas | **Keep, normalize whitespace** | Source HTML already contains literal newlines between sibling `<p>` tags; collapsing internal whitespace and preserving verse-to-verse joins with a single space is sufficient — matching ESV's own flat single-line-per-verse convention that `scriptureSplitter.ts` already assumes. |

### Error shape (no key, garbage key, bad ref/version — all probed live)

**The `key` query parameter is not actually validated by this endpoint.** Probed with no `key` param at
all, and with an obviously garbage string (`totally-bogus-key-xyz-123`) — both returned **HTTP 200 with
the identical, correct passage body** as the real key. `[VERIFIED: live fetch, this session]` This does
not change the plan — R090 explicitly locks sending the key as a query param, and the Cloud Function
must still inject the real server-held secret rather than trust a client-supplied one (SSRF/quota-theft
prevention, same reasoning as the ESV/Claude branches: the point of the proxy is to keep the key off the
client bundle, not merely to make requests succeed). But it does mean: **do not build any test or
acceptance criterion that asserts "an invalid key produces an error"** — that assertion would be false
against the real API. Document this in code comments so a future maintainer doesn't "fix" a proxy bug
that isn't one.

**A bad `ref` or wrong `version` param returns HTTP 200 with an empty body (`Content-Length: 0`), not a
JSON error, not a 4xx.** `[VERIFIED: live fetch, this session]` `nltApi.ts` MUST treat an empty/whitespace
response body as a fetch failure explicitly — checking only `response.ok` is insufficient, since NLT
always returns 200. This mirrors `esvApi.ts`'s own gap (it checks `response.ok` and separately guards
`data.passages[0]?.trim() ?? ''`) but is a harder requirement for NLT since there is no structured error
payload to fall back on at all.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────┐
                    │   SettingsView.vue       │
                    │  Bible Translation card   │
                    │  (ESV/NLT radio, R090)   │
                    └────────────┬─────────────┘
                                 │ updateDoc('settings.bibleVersion')
                                 ▼
                    ┌─────────────────────────┐
                    │  organizations/{orgId}   │
                    │  .settings.bibleVersion   │
                    └────────────┬─────────────┘
                                 │ read via authStore.settings.bibleVersion
                                 ▼
        ┌────────────────────────────────────────────┐
        │      CongregationalEditor.vue (live)         │
        │  onFetchPassage() / AI-split / alternating    │
        │  routes to esvApi.ts OR nltApi.ts by setting  │
        └───────┬───────────────────────────┬──────────┘
                │ ESV branch                 │ NLT branch
                ▼                            ▼
     ┌─────────────────────┐      ┌─────────────────────────┐
     │  src/utils/esvApi.ts │      │  src/utils/nltApi.ts      │
     │  fetch → JSON parse   │      │  fetch → DOMParser strip  │
     └──────────┬───────────┘      │  → "[N] text" reformat    │
                │                  └──────────┬───────────────┘
                │  /api/esv/...               │  /api/nlt/...
                ▼                              ▼
     ┌────────────────────────────────────────────────────┐
     │         functions/src/index.ts  `api` proxy          │
     │  PROXY_TARGETS: esv/claude/pc/nlt                     │
     │  SECRET_INJECTED gate (x-app-auth required)            │
     │  esv: inject Authorization header                      │
     │  nlt: inject ?key= query param on outbound URL (NEW)   │
     └───────────┬───────────────────────────┬───────────────┘
                 ▼                            ▼
        api.esv.org (JSON)          api.nlt.to (HTML)

  ── after fetch, back in CongregationalEditor.vue ──
     splitPassage(text, ref) → per-verse "[N] text" split
     → CongregationalSection[] { speaker, text, verseRange,
                                   translationSource }  ◄── stamped HERE, once
     → emit('update:sections') → ScriptureSlot.congregationalSections

  ── at assembly/materialization time (no re-fetch, no re-derive) ──
     deriveGroupEntries (SCRIPTURE case) spreads translationSource
       into SourceRef { kind:'scripture', speaker, text, translationSource }
     resolveEntryContent (slideshowAssembler.ts) reads it back onto
       the final ScriptureSlide.translationSource

  ── at render time ──
     PresentationViewer.vue  /  slideDisplay.ts::slideBodyText()
       → scriptureAttribution(resolveTranslationSource(slide))
       → appends " (ESV)" / " (NLT)" to already-rendered text
       → field-less pre-phase slides: resolveTranslationSource() → 'ESV'
```

### Recommended File Touch List

```
src/types/organization.ts        # + bibleVersion field + DEFAULT_ORG_SETTINGS entry ('NLT')
src/types/slide.ts                # + CongregationalSection.translationSource?, ScriptureSlide.translationSource?
src/types/slideGroup.ts           # + SourceRef 'scripture' variant: translationSource?
src/utils/scripture.ts            # + scriptureAttribution(), resolveTranslationSource(); congregationalSectionFromRef passthrough
src/utils/nltApi.ts               # NEW — fetch + DOMParser strip + "[N] text" reformat (mirrors esvApi.ts shape)
src/utils/slideGroupMaterializer.ts  # deriveGroupEntries SCRIPTURE branch: spread translationSource into sourceRef
src/utils/slideshowAssembler.ts   # resolveEntryContent + fallback branch: read translationSource onto ScriptureSlide
src/components/CongregationalEditor.vue  # stamp translationSource on all 3 seeding routes; route esvApi/nltApi by setting
src/components/ScriptureInput.vue # route esvApi/nltApi by setting (preview only — no translationSource needed, nothing persisted)
src/components/PresentationViewer.vue    # append attribution suffix at both scripture render sites
src/components/slides/slideDisplay.ts    # slideBodyText() scripture case: append attribution when slide.text non-empty
src/views/SettingsView.vue        # + Bible Translation card (radio, save-on-change, mirrors AI/PC toggle handlers)
functions/src/index.ts            # + NLT_API_KEY secret, PROXY_TARGETS.nlt, SECRET_INJECTED.add('nlt'), query-param injection branch
```

**Explicitly NOT touched** (dead code — confirmed unreachable from any live component):
`src/components/ScriptureSlideEditor.vue`, its store/type (`useScriptureSlides`? — verify store file name),
and `src/types/scriptureReading.ts`'s `ScriptureReading` document type. See Common Pitfalls.

### Pattern 1: Proxy query-param secret injection (NEW — no existing precedent in this codebase)

**What:** The existing `functions/src/index.ts` `api` handler only rewrites request *headers* before
forwarding (`headers["authorization"] = ...`). NLT's auth is a query parameter on the URL itself, which
today's code never touches — `upstreamUrl` is built once as a `const` and passed straight to `fetch()`.

**When to use:** Any upstream API whose secret travels in the query string rather than a header.

**Example (sketch — planner/executor finalizes exact variable naming):**
```typescript
// functions/src/index.ts — inside the api onRequest handler, after headers are built
const PROXY_TARGETS: Record<string, string> = {
  planningcenter: "https://api.planningcenteronline.com",
  anthropic: "https://api.anthropic.com",
  esv: "https://api.esv.org",
  nlt: "https://api.nlt.to",          // NEW
};
const SECRET_INJECTED = new Set(["anthropic", "esv", "nlt"]); // NEW: "nlt" added

// upstreamUrl must become mutable (`let`, not `const`) to support this branch
let upstreamUrl = `${target}${upstreamPath}`;

if (service === "esv") {
  headers["authorization"] = `Token ${ESV_API_KEY.value()}`;
} else if (service === "nlt") {
  // NLT auth is a query param, not a header — cannot reuse the header-injection
  // branch above verbatim. Verified live 2026-08-07: the API does not actually
  // reject a missing/garbage key (still returns 200 with correct content), but
  // the server-held secret must be injected here regardless — the whole point
  // of this proxy is keeping NLT_API_KEY out of the client bundle, independent
  // of whether the upstream enforces it.
  const nltUrl = new URL(upstreamUrl);
  nltUrl.searchParams.set("key", NLT_API_KEY.value());
  upstreamUrl = nltUrl.toString();
}
```

### Pattern 2: `nltApi.ts` client — DOMParser strip + ESV-bracket-format reformat

**What:** Mirrors `esvApi.ts`'s shape (one exported async function, routed through the app-auth proxy)
but parses HTML instead of JSON, and must emit the exact `[N] text` bracket convention
`scriptureSplitter.ts::parseVerses` depends on.

**Example (sketch, source: this session's live NLT fetches, cross-referenced against
`src/utils/scriptureSplitter.ts:29-41` and `src/utils/esvApi.ts`):**
```typescript
// src/utils/nltApi.ts
import { getAppAuthHeaders } from '@/utils/appAuth'

export async function fetchNltPassageText(query: string): Promise<string> {
  const params = new URLSearchParams({ ref: query, version: 'NLT' })

  const response = await fetch(`/api/nlt/api/passages?${params.toString()}`, {
    headers: await getAppAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch passage')
  }

  const html = await response.text()
  // NLT returns HTTP 200 with an EMPTY body for a bad ref/version — verified
  // live this session. response.ok alone is not sufficient here, unlike esvApi.ts.
  if (!html.trim()) {
    throw new Error('Failed to fetch passage')
  }

  return stripNltHtml(html)
}

function stripNltHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const root = doc.querySelector('#bibletext')
  if (!root) throw new Error('Unexpected NLT response shape')

  // Footnote markers + footnote bodies are nested INSIDE the verse's own
  // paragraph, immediately after the annotated word — must strip both
  // together or footnote prose leaks into verse text.
  root.querySelectorAll('.tn, .a-tn').forEach((el) => el.remove())
  // Headings — ESV parity (include-headings: false)
  root.querySelectorAll('.bk_ch_vs_header, .chapter-number, .subhead').forEach((el) => el.remove())

  // Read the verse number from verse_export's own `vn` attribute — more
  // reliable than the rendered .vn span, and avoids the no-space-before-text
  // concatenation bug that reading .vn's textContent directly would hit.
  const verses = Array.from(root.querySelectorAll('verse_export'))
  return verses
    .map((v) => {
      const vn = v.getAttribute('vn')
      const text = (v.textContent ?? '').replace(/\s+/g, ' ').trim()
      // "[16] text" — the exact bracket format scriptureSplitter.ts::parseVerses
      // requires (regex /\[(\d+)\]/). This is the load-bearing convention;
      // see Common Pitfalls.
      return vn ? `[${vn}] ${text}` : text
    })
    .filter(Boolean)
    .join(' ')
}
```

### Pattern 3: Shared attribution + translation-source resolution (one pair of helpers, `src/utils/scripture.ts`)

```typescript
// src/utils/scripture.ts — proposed additions

/** R091: initials-only attribution, shared by every render site. */
export function scriptureAttribution(version: 'ESV' | 'NLT'): string {
  return `(${version})`
}

/**
 * R092: the ONE field-less-fallback decision point. A slide with no
 * translationSource predates this phase, when ESV was the only source —
 * resolves to 'ESV', never to the org's CURRENT bibleVersion setting. This
 * function must never read authStore/OrgSettings — reading the current
 * setting here would silently violate "never retroactively alters."
 */
export function resolveTranslationSource(
  slide: { translationSource?: 'ESV' | 'NLT' },
): 'ESV' | 'NLT' {
  return slide.translationSource ?? 'ESV'
}
```

Render-site usage sketch (`PresentationViewer.vue`, `presentation-congregational-section` — the ONE
site that carries real attributable text today, see Common Pitfalls):
```vue
<p data-testid="presentation-congregational-section" class="text-gray-100 whitespace-pre-line text-5xl font-normal leading-[1.4]">
  {{ section.text }} {{ scriptureAttribution(resolveTranslationSource(currentSlide.slide as ScriptureSlide)) }}
</p>
```

`slideDisplay.ts::slideBodyText()` scripture case (line 185-191 today):
```typescript
case 'scripture':
  if (!slide.text) return slide.reference
  return `${slide.reference}\n${slide.text} ${scriptureAttribution(resolveTranslationSource(slide))}`
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML tag stripping | A hand-rolled regex tag-stripper | Native `DOMParser` + `.remove()` / `.querySelectorAll()` | Regex HTML parsing breaks on the exact nested-footnote shape NLT actually returns (`.tn` nested inside the verse paragraph, not a sibling); `DOMParser` handles arbitrary nesting correctly and is already the locked decision. |
| Verse-number extraction | Parsing the rendered `<span class="vn">16</span>` text and inferring boundaries from whitespace | Read `verse_export`'s own `vn` attribute | The attribute is present on every verse_export in every sample fetched this session, including poetry-formatted (multi-`<p>`) verses where the span's surrounding whitespace is inconsistent. |
| A second attribution string builder for the congregational path | A copy of `(${version})` inline in `CongregationalEditor.vue` or `PresentationViewer.vue` | The one shared `scriptureAttribution()` helper (CONTEXT.md Area 2, locked) | Explicit "build once, shared" instruction — a second implementation is the exact anti-pattern the decision calls out. |
| Fallback-to-current-setting for old slides | `slide.translationSource ?? authStore.settings.bibleVersion` | `slide.translationSource ?? 'ESV'` (hardcoded) | The former silently violates R092 the moment a church changes its setting — every pre-phase slide would flip attribution/behavior retroactively. This is the single most important line in the whole phase to get right; get it backwards and the failure is silent (no type error, no test failure unless a test explicitly asserts old-setting-vs-new-setting divergence). |

**Key insight:** every piece of "don't hand-roll" guidance here is really the same principle stated four
ways — this phase's correctness depends on stamping translation provenance exactly once, at the moment
of fetch, and never re-deriving it from anything that can change later (org settings, current DOM
state, or a fresh regex match against old HTML).

## Common Pitfalls

### Pitfall 1: Missing the `[N]` bracket-format contract breaks NLT congregational splitting silently
**What goes wrong:** If `nltApi.ts` returns clean prose text without the `[16] text` bracket convention,
`scriptureSplitter.ts::parseVerses()`'s regex (`/\[(\d+)\]/`) finds zero matches, so `splitPassage()`
falls through to `splitBySentences()` — a ~50-word sentence-grouping heuristic with NO verse-level
granularity. `CongregationalEditor.vue`'s alternating-assignment and manual-divide-by-verse UX both
depend on verse boundaries; losing them doesn't throw, doesn't fail a type check, and doesn't fail an
existing test (no existing test exercises NLT text through this path, since NLT is brand new). It would
only surface as "the divider feels broken for NLT but fine for ESV" during real use.
**Why it happens:** This dependency exists nowhere in writing before this research — it is implicit in
`scriptureSplitter.ts`'s regex and the ESV API's own (undocumented-in-this-codebase) verse-numbering
convention. CONTEXT.md and the UI-SPEC never mention it.
**How to avoid:** `nltApi.ts` must emit `[N] text` per verse (see Code Examples Pattern 2). Add a test
asserting `splitPassage(await fetchNltPassageText('John 3:16-18'), ref).length === 3` (or equivalent) —
proving verse-level splitting survives the NLT path, not just that text comes back non-empty.
**Warning signs:** A congregational reading built from an NLT passage produces one giant section instead
of one section per verse-ish chunk; `hasSplittableBoundaries` / `computeBoundaries` (AI-split gating, R096)
may also silently degrade since those likely consume the same bracketed format — verify during planning.

### Pitfall 2: `ScriptureSlideEditor.vue` is dead code — don't spend a task wiring it up
**What goes wrong:** CONTEXT.md's "Reusable Assets" section names `src/utils/esvApi.ts` as "the
existing ESV client" without noting that one of its three call sites
(`src/components/ScriptureSlideEditor.vue`) is not reachable from any live view.
**Why it happens:** `ServiceEditorView.vue` imports `CongregationalEditor.vue` only — confirmed by grep,
`ScriptureSlideEditor` appears solely in its own test file and in an unrelated comment in
`SongLyricEditor.vue` comparing capture-once patterns. This tracks with the 2026-08-05 commit history:
the 3-dot menu's "Edit in scripture" item was relabeled "Set up congregational reading" and now opens
`CongregationalEditor.vue` exclusively (34-07 decision, documented in `slideDisplay.ts`).
**How to avoid:** Route ESV/NLT selection through `CongregationalEditor.vue` and `ScriptureInput.vue`
only. If the planner wants defensive consistency, updating `ScriptureSlideEditor.vue`'s import is
low-cost, but it should not be treated as a requirement-bearing task — nothing reaches it.
**Warning signs:** A task described as "update the scripture slide editor to support NLT" without
first confirming which of the two/three editor components is actually mounted.

### Pitfall 3: The "Reference-state" scripture slide never carries body text — attribution has nothing to attribute there today
**What goes wrong:** UI-SPEC and CONTEXT.md describe R091 attribution as reaching "the existing
scripture-slide path AND the new congregational-reading path" as if symmetric. Tracing
`resolveEntryContent` (`slideshowAssembler.ts:196-217`) and the no-group fallback
(`slideshowAssembler.ts:481-494`) shows the Reference-state (non-congregational) branch hardcodes
`text: ''` unconditionally — the projected slide shows only the reference string, never passage words.
**Why it happens:** R047 ("the slot's OWN reference fields are the slide's source... no separate reading
document to fetch first") deliberately removed body-text fetching from the non-congregational path in an
earlier phase. The UI-SPEC's own "Does NOT apply to" caveat already half-acknowledges this ("a
reference-only slide with empty passage text... there is no quoted scripture text on that slide to
attribute") but frames it as an edge case rather than the *only* case that currently exists for that
branch.
**How to avoid:** Write the attribution/translationSource plumbing generically enough to cover both
states (cheap, and future-proofs against a later phase re-adding body text to Reference-state slides),
but do not scope a task around fetching/persisting Reference-state body text — that would be new scope
beyond R090-092, not implied by them. Confirm this reading with the planner/owner if it changes the
phase's understood surface area.
**Warning signs:** A task that tries to make a Reference-state SCRIPTURE slot fetch and store passage
text where none is stored today — that is new functionality, not attribution plumbing.

### Pitfall 4: NLT's `key` query param is not actually enforced by the upstream API
**What goes wrong:** A test or acceptance criterion written as "the proxy rejects an invalid NLT key"
would fail against the real API — verified live this session that a missing or garbage key still
returns HTTP 200 with correct content.
**Why it happens:** Undocumented API behavior, only discoverable by a real fetch (which is exactly why
CONTEXT.md required one before finalizing the stripping logic).
**How to avoid:** Still inject the real secret server-side (the proxy's job is keeping the key out of
the client bundle, independent of whether NLT enforces it — same reasoning that already applies to the
ESV/Claude branches). Do not write a test asserting upstream rejection of a bad key.
**Warning signs:** A `checkpoint:human-verify` or automated test phrased around "confirm invalid key is
rejected" — reframe as "confirm the real secret never appears in a client-visible request."

### Pitfall 5: NLT returns HTTP 200 with an empty body on a bad ref — `response.ok` is not a sufficient failure check
**What goes wrong:** Copying `esvApi.ts`'s `if (!response.ok) throw ...` pattern verbatim into
`nltApi.ts` and stopping there would let a malformed/unrecognized reference silently produce an empty
passage that then fails deeper in `splitPassage()` (an empty-text `trimmed` guard returns `[]`) with a
generic, unhelpful failure mode instead of a clear "could not load passage" error at the fetch layer.
**Why it happens:** ESV's JSON API returns a structured `{ passages: [] }` for most failure cases which
`esvApi.ts` doesn't even need to special-case; NLT returns no structure at all for its failure case.
**How to avoid:** Explicitly check `!html.trim()` after `response.text()` and throw the same
"Failed to fetch passage" error `esvApi.ts` throws on `!response.ok`, so both clients present a uniform
failure contract to `ScriptureInput.vue`/`CongregationalEditor.vue`'s shared `catch` blocks.
**Warning signs:** A "fetch failed" UI state that never triggers for a bad NLT reference, or triggers
with a confusing downstream error instead of the existing `fetchError.value = true` / `previewError`
messaging.

### Pitfall 6: The Cloud Function's `upstreamUrl` is a `const` today — the NLT branch needs it mutable
**What goes wrong:** A naive attempt to inject the query-param key by mutating `req.originalUrl` or
re-declaring `upstreamUrl` inline without changing its declaration from `const` to `let` (or
restructuring into a small pure function) fails to compile / requires a slightly larger diff than the
header-injection branches needed.
**Why it happens:** `functions/src/index.ts:86-87` declares `const upstreamPath` / `const upstreamUrl`
before any of the `service === "..."` branching runs; every existing secret-injected service (`esv`,
`anthropic`) only needed to mutate the `headers` object, never the URL itself.
**How to avoid:** Either change the declaration to `let upstreamUrl` and reassign inside the `nlt`
branch (Pattern 1 above), or extract a small pure `buildUpstreamUrl(service, upstreamUrl, secret)`
helper that both is easy to unit test in isolation (no existing precedent tests the `api` handler at
all — see Validation Architecture) and keeps the branch-specific logic out of the main handler body.
**Warning signs:** A TypeScript error on reassigning a `const`, or (worse) a plan that quietly changes
behavior for the `esv`/`anthropic` branches while restructuring this function.

### Pitfall 7: Deploy-coupling — an NLT-default frontend shipped before the function is deployed breaks new scripture fetches
**What goes wrong:** Per the locked CONTEXT.md override, `bibleVersion` defaults to `'NLT'`. If the
frontend (which reads that default) ships to production before the owner runs
`firebase deploy --only functions` for the new NLT branch, every church that hasn't explicitly chosen
ESV gets a broken "Fetch" button in `CongregationalEditor.vue`/`ScriptureInput.vue` — a 404 or CORS-ish
failure against `/api/nlt/...`, which doesn't exist server-side yet.
**Why it happens:** This is a genuine architectural consequence of the owner's default choice, not a
bug — but it must be surfaced loudly, since v1.5's standing autonomy grant means this phase's code ships
built-but-undeployed like every other v1.5 deployable, and the frontend half (which the emulator can't
gate) is NOT separately deploy-gated by Firebase Hosting rules.
**How to avoid:** The plan's owner-handoff section (and `PENDING-VERIFICATION.md` § Phase 45) must state
explicitly, in the imperative: deploy the NLT Cloud Function branch and the frontend build in the SAME
session, not the frontend first. If the org's actual production frontend deploy is decoupled from this
phase's own "ships built/undeployed," the handoff must say so precisely rather than implying "it's fine,
it's all undeployed" — the emulator can prove the function branch works, but cannot prove the two halves
deploy together, because that is a human process guarantee, not a code guarantee.
**Warning signs:** A verification checklist that only checks "the function works in the emulator" without
a matching item "confirm the deploy handoff instructs both halves together."

## Code Examples

Verified patterns from source read during this session (file:line citations throughout).

### ESV client shape to mirror (`src/utils/esvApi.ts`, read in full)
```typescript
import { getAppAuthHeaders } from '@/utils/appAuth'

export async function fetchPassageText(query: string): Promise<string> {
  const params = new URLSearchParams({
    q: query,
    'include-headings': 'false',
    'include-footnotes': 'false',
    'include-verse-numbers': 'true',
    'include-short-copyright': 'false',
    'include-passage-references': 'false',
  })
  const response = await fetch(`/api/esv/v3/passage/text/?${params.toString()}`, {
    headers: await getAppAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch passage')
  const data = (await response.json()) as { passages: string[] }
  return data.passages[0]?.trim() ?? ''
}
```
Note `'include-verse-numbers': 'true'` — this is what produces ESV's `[16]` bracket convention that
`scriptureSplitter.ts` depends on. `nltApi.ts` has no equivalent query param to set (NLT always includes
verse structure via `verse_export`/`vn`); the bracket format must be constructed by `nltApi.ts` itself.

### Verse-parsing contract (`src/utils/scriptureSplitter.ts:29-41`, the load-bearing dependency)
```typescript
function parseVerses(text: string): Verse[] {
  const parts = text.split(/\[(\d+)\]/).filter(Boolean)
  const verses: Verse[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const num = parseInt(parts[i]!, 10)
    const content = parts[i + 1]?.trim() ?? ''
    if (!isNaN(num) && content) {
      verses.push({ number: num, text: content })
    }
  }
  return verses
}
```
Confirmed by the existing test fixture (`src/utils/__tests__/scriptureSplitter.test.ts:85`):
`'[1] First verse words here. [2] Second verse words here. [3] Third verse words here.'`

### Existing settings-toggle save handler to mirror for the Bible Version control (`SettingsView.vue:656-676`)
```typescript
async function onToggleAiEnabled() {
  if (!authStore.orgId || !authStore.isEditor) return
  const newValue = aiEnabledInput.value
  aiSaveError.value = null
  try {
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.aiEnabled': newValue })
    authStore.settings.aiEnabled = newValue
    aiSavedFeedback.value = true
    setTimeout(() => { aiSavedFeedback.value = false }, 2000)
  } catch (err) {
    aiSaveError.value = 'Failed to save. Please try again.'
    aiEnabledInput.value = !newValue
  }
}
```
The Bible Version handler follows this exact shape: `updateDoc(..., { 'settings.bibleVersion': newValue })`,
`authStore.settings.bibleVersion = newValue`, same 2000ms feedback timer, same revert-on-catch.

### `DEFAULT_ORG_SETTINGS` extension point (`src/types/organization.ts:113-118`)
```typescript
export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  aiEnabled: true,
  pcEnabled: true,
  vwModeEnabled: true,
  defaultServiceTemplate: [],
  bibleVersion: 'NLT', // NEW — owner's locked override, not the "preserve current behavior" ESV default
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single hardcoded scripture source (ESV, via `esvApi.ts`) | Church-configurable ESV/NLT via `OrgSettings.bibleVersion` | This phase | Every live fetch call site (`ScriptureInput.vue`, `CongregationalEditor.vue`) must branch on the setting instead of importing `esvApi.ts` unconditionally. |
| No per-slide translation provenance | `translationSource` stamped once at fetch time, threaded through `CongregationalSection` → `SourceRef` → `ScriptureSlide` | This phase | Enables R092's guarantee without a migration — the field-less fallback (`?? 'ESV'`) is itself the "old data" handling, matching the exact pattern `vwModeEnabled ?? true` already established in Phase 16.1/39. |

No deprecated/outdated findings — the ESV integration itself is current and unaffected by this phase
except for gaining a sibling branch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Strip `.psa-title` (Psalm superscription, e.g. "A psalm of David.") the same way headings are stripped, rather than keeping it as part of verse 1's text. | NLT API § Element inventory | If wrong, a Psalm's verse 1 slide/section would silently prepend "A psalm of David." onto the actual verse-1 words for NLT passages only (ESV parity would then be broken specifically for Psalms). Low blast radius (Psalms are a minority of congregational-reading use), but worth a planner decision rather than silent inheritance of this research's default. Not independently verified against a real ESV Psalm sample in this session — only the NLT side was fetched. |
| A2 | The `functions/src/index.ts` `api` onRequest handler has zero existing unit tests (confirmed by grep across `functions/src/index.test.ts` — no `esv`/`proxy`/`PROXY_TARGETS` matches), so there is no existing test-shape precedent to mirror for the NLT branch; recommend extracting a small pure `buildUpstreamUrl()`-style helper for testability. | Common Pitfalls (Pitfall 6), Validation Architecture | If a different testing approach is expected (e.g., `firebase-functions-test` invoking the full `onRequest` handler), the plan's Wave 0 test-infrastructure task would need to build that harness instead — larger scope than a pure-function extraction. |
| A3 | Only `ScriptureInput.vue` (preview, ephemeral) and `CongregationalEditor.vue` (persisted, attributed) are live consumers of `fetchPassageText` that need ESV/NLT routing; `ScriptureSlideEditor.vue` is dead code out of scope. | Common Pitfalls (Pitfall 2), Architecture Patterns (file touch list) | If `ScriptureSlideEditor.vue` is reachable via some route this research missed (e.g., a feature flag, an unlinked-but-live drawer), skipping it would leave a hidden ESV-only path. Grep-verified via import graph (`ServiceEditorView.vue`, `SongLyricEditor.vue`), not a router audit — low risk but not exhaustive. |
| A4 | Reference-state (non-congregational) SCRIPTURE slides never carry body text today, so R091 attribution has nothing to attach to on that path in practice, even though CONTEXT.md's wording implies symmetry with the congregational path. | Common Pitfalls (Pitfall 3) | If this reading is wrong (e.g., some other code path DOES populate `ScriptureSlide.text` for a Reference-state slide that this research didn't trace), attribution would be silently missing there. Grounded directly in `slideshowAssembler.ts:196-217` and `:481-494` reading `text: ''` unconditionally in that branch — HIGH confidence this is correct as read, but flagged since it narrows CONTEXT.md's stated scope. |

## Open Questions

1. **Should the Psalm superscription (`.psa-title`) be stripped or kept?**
   - What we know: it lives inside verse 1's `<verse_export>`, ahead of the actual verse text; NLT's
     own markup does not distinguish it from a heading via any shared class name with `.subhead`.
   - What's unclear: whether ESV's own passage-text API includes an equivalent superscription inline
     with verse 1 (would establish the parity target) — not checked this session (no ESV fetch was
     performed; only NLT).
   - Recommendation: strip it by default (Assumption A1), consistent with every other heading-shaped
     element; cheap to reverse if the owner's real-use testing (Psalms are common in worship contexts)
     surfaces it as wanted.

2. **Does `ScriptureSlideEditor.vue` need to be updated for defensive consistency, or left ESV-only?**
   - What we know: it is unreachable from any live view (Pitfall 2).
   - What's unclear: whether the planner considers "leave orphaned code inconsistent" acceptable, or
     wants a one-line defensive update for future-proofing.
   - Recommendation: leave it untouched — updating dead code is speculative scope this phase's
     requirements don't ask for; note it in the plan's notes so a future phase reviving this component
     knows it needs an NLT branch too.

3. **Does the AI-split boundary detector (`hasSplittableBoundaries`/`computeBoundaries`, R096) also
   depend on the `[N]` bracket convention?**
   - What we know: `CongregationalEditor.vue:238` gates `canAiSplit` on
     `hasSplittableBoundaries(computeBoundaries(rawText.value))`, where `rawText.value` is the raw
     fetched text (pre-split) — the same string `nltApi.ts` must format.
   - What's unclear: this research did not open `computeBoundaries`'s implementation to confirm it
     shares `parseVerses`'s regex or uses an independent heuristic.
   - Recommendation: the planner/executor should grep `computeBoundaries` before finalizing `nltApi.ts`'s
     output format — if it has its own verse-detection logic, it may impose a second (hopefully
     identical) format requirement worth confirming rather than assuming.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `NLT_API_KEY` in `.env.local` | Live fetch verification (this research session) and future local/emulator testing | ✓ | 36-char key, confirmed present, value never printed | — |
| `api.nlt.to` reachability | NLT proxy branch, live fetch verification | ✓ | Confirmed reachable, Cloudflare-fronted, six successful fetches this session | — |
| `NLT_API_KEY` as a Firebase Functions secret (`firebase functions:secrets:set NLT_API_KEY`) | The deployed Cloud Function (owner's step, undeployed during this phase) | ✗ (not yet set — expected, since this is the owner's deploy step) | — | None needed during this phase; the plan's owner-handoff must include the `firebase functions:secrets:set NLT_API_KEY` step alongside `firebase deploy --only functions`. |

**Missing dependencies with no fallback:** none blocking phase execution — the only "missing" item
(the deployed secret) is intentionally the owner's deploy-time step, not a phase-execution blocker.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend: root config via `npx vitest run --dir src --exclude '**/rules.test.ts'`; functions: `vitest run` in `functions/`, per `functions/package.json`'s `"test": "vitest run"`) |
| Config file | Root `vite.config.ts` (frontend); no dedicated `functions/vitest.config.ts` observed — confirm during planning whether `functions/` uses its own config or root passthrough |
| Quick run command | `npx vitest run src/utils/__tests__/nltApi.test.ts src/utils/__tests__/scriptureSplitter.test.ts` (once the new test file exists) |
| Full suite command | `npx vitest run --dir src --exclude '**/rules.test.ts'` (frontend) + `cd functions && npm test` (functions) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R090 | Church selects ESV/NLT in Settings; setting persists and resolves with a sensible default | unit | `npx vitest run src/views/__tests__/SettingsView.test.ts` | ✅ (existing file, needs new test cases) |
| R090 | `nltApi.ts` correctly strips HTML and reformats to bracket-verse convention against realistic fixture HTML (captured from this session's live samples) | unit | `npx vitest run src/utils/__tests__/nltApi.test.ts` | ❌ Wave 0 — new file, use the redacted samples in this document as fixtures |
| R090 | NLT proxy branch injects the secret as a query param, not a header, and never leaks the client's own request to trust a client-supplied key | unit | `cd functions && npx vitest run src/index.test.ts` (or a new focused file, e.g. `functions/src/apiProxy.test.ts`, if the handler is extracted into a testable pure function per Pitfall 6) | ❌ Wave 0 — no existing proxy-handler test precedent at all (verified: zero `esv`/`PROXY_TARGETS` matches in `functions/src/index.test.ts`) |
| R091 | `scriptureAttribution()` produces `(ESV)`/`(NLT)` exactly, and the two render sites (`PresentationViewer.vue`, `slideDisplay.ts::slideBodyText`) append it correctly only when text is non-empty | unit | `npx vitest run src/utils/__tests__/scripture.test.ts src/components/__tests__/PresentationViewer.test.ts src/components/slides/__tests__/slideDisplay.test.ts` | Partial — `scripture.ts` has no dedicated test file today (grep found none); `PresentationViewer.test.ts` and `slideDisplay.test.ts` exist and need new cases |
| R092 | `resolveTranslationSource()` returns `'ESV'` for a field-less slide, and the stamped value survives a materializer rebuild unchanged even after the org's `bibleVersion` setting changes | unit | `npx vitest run src/utils/__tests__/slideGroupMaterializer.test.ts src/utils/__tests__/slideshowAssembler.test.ts` | ✅ (existing files, need new test cases proving the "setting changes, stored value doesn't" invariant explicitly) |

### Sampling Rate
- **Per task commit:** the quick run command scoped to the file(s) just touched
- **Per wave merge:** `npx vitest run --dir src --exclude '**/rules.test.ts'` (frontend) + `cd functions && npm test`
- **Phase gate:** full suite green (both frontend and functions) before `/gsd-verify-work`, plus
  `npm run type-check` (the `vue-tsc --build` form per CLAUDE.md — NOT `-p tsconfig.app.json`)

### Wave 0 Gaps
- [ ] `src/utils/__tests__/nltApi.test.ts` — new file; fixture HTML should be drawn from this document's
      redacted live samples (single verse, multi-verse, heading case, Psalm case) rather than invented,
      since these are the only NLT-response shapes independently confirmed real this session
- [ ] A test/assertion proving the NLT→bracket-format contract survives into `scriptureSplitter.ts`'s
      `parseVerses()` — either inside `nltApi.test.ts` or as a new case in `scriptureSplitter.test.ts`
      (Pitfall 1)
- [ ] `functions/src/index.test.ts` (or a new file) — no existing proxy-handler test precedent; Wave 0
      should decide whether to extract the URL/key-injection logic into a pure testable function
      (recommended, Assumption A2) before writing the NLT branch's tests
- [ ] A test proving R092's core invariant explicitly: changing `OrgSettings.bibleVersion` does NOT
      change `sourceSignature()`'s output for an already-materialized congregational group, and does NOT
      change any existing `ScriptureSlide.translationSource` — this is the requirement's actual claim
      and deserves a named test, not just incidental coverage from other assertions

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth surface — the existing `x-app-auth` Firebase ID token gate on `SECRET_INJECTED` services already covers the new `nlt` branch by adding it to the same `Set`. |
| V4 Access Control | Yes | `organizations/{orgId}` write already gated `allow write: if isOrgEditor(orgId)` (`firestore.rules:27-31`) — covers `settings.bibleVersion` writes with no rules change needed (see below). |
| V5 Input Validation | Yes | `nltApi.ts` must not trust the upstream HTML blindly — the empty-body-on-bad-ref case (Pitfall 5) is itself an input-validation gap in the upstream API that the client must compensate for. |
| V6 Cryptography | No | No new crypto surface — `NLT_API_KEY` uses the exact same Google Secret Manager mechanism (`defineSecret`) already proven for `ESV_API_KEY`/`CLAUDE_API_KEY`. |

### Firestore Rules — no change needed (verified against `firestore.rules`)

Both new persistence surfaces this phase introduces are already covered by existing rules, with no new
`firestore.rules` clause required:
- `OrgSettings.bibleVersion` lives under `organizations/{orgId}`, whose `allow write: if isOrgEditor(orgId)`
  rule (`firestore.rules:27-31`) already governs the entire `settings` map generically — Phase 39/44
  already wrote `aiEnabled`/`pcEnabled`/`defaultServiceTemplate` through this exact same rule with no
  per-field rule addition, and `bibleVersion` follows the identical shape.
- `ScriptureSlide.translationSource` / `SourceRef.translationSource` live inside `SlideGroup` documents
  and `ServiceSlot.congregationalSections` (nested inside `services/{docId}`), both already covered by
  existing service/slide-group write rules with no per-field gating — matching how `speaker`/`text`/
  `verseRange` on the same `SourceRef` shape need no dedicated rule today.

**This means Phase 45 is NOT rules-gated for deploy purposes** — unlike Phase 40/41/42, there is no
`firestore.rules`/`storage.rules` change bundled into this phase's owner deploy. The ONLY owner deploy
action for this phase is `firebase deploy --only functions` (plus the `NLT_API_KEY` secret set) and the
frontend build — confirmed by reading the actual rule structure, not assumed.

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-supplied `key` overriding the server's own NLT secret in the proxied request | Spoofing / Elevation of Privilege (quota theft) | The proxy must always overwrite/set the `key` param server-side after building `upstreamUrl` from the client's request, exactly as the `esv`/`anthropic` branches already overwrite `headers["authorization"]`/`headers["x-api-key"]` — never trust a client-supplied `key` value in the incoming query string. |
| Open-relay abuse of the new `nlt` proxy target by an unauthenticated caller | Denial of Service (quota exhaustion) | Already covered — adding `"nlt"` to the existing `SECRET_INJECTED` Set requires the same `x-app-auth` Firebase ID token check every other secret-injected branch already enforces. |

## Sources

### Primary (HIGH confidence)
- Live fetch, `https://api.nlt.to/api/passages` — six requests, this session, using the owner's real
  `NLT_API_KEY` from `.env.local` (confirmed present, never printed; key redacted to `<owner-key>` in
  every sample retained in this document)
- `src/utils/esvApi.ts` (full file read)
- `src/utils/scripture.ts` (full file read)
- `src/utils/scriptureSplitter.ts` (full file read)
- `src/utils/slideGroupMaterializer.ts` (`deriveGroupEntries`, `rebuildScriptureGroup`, `sourceSignature` — read in full)
- `src/utils/slideshowAssembler.ts` (`resolveEntryContent`, fallback branch, `AssemblyInputs` — read)
- `src/types/organization.ts`, `src/types/slide.ts`, `src/types/service.ts`, `src/types/scriptureReading.ts`, `src/types/slideGroup.ts` (all read)
- `src/components/CongregationalEditor.vue`, `src/components/ScriptureInput.vue`, `src/components/ScriptureSlideEditor.vue` (fetch/split call sites read)
- `src/components/PresentationViewer.vue` (scripture render branch, lines 147-222, read)
- `src/components/slides/slideDisplay.ts` (`slideBodyText`, read)
- `src/views/SettingsView.vue` (`onToggleAiEnabled`/`onTogglePcEnabled` handlers, read)
- `functions/src/index.ts` (the `api` proxy handler, lines 1-130, read in full)
- `firestore.rules` (organizations/members block, read)
- `.planning/phases/45-esv-nlt-bible-version-selection/45-CONTEXT.md`, `45-UI-SPEC.md`
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` (v1.5 sections)

### Secondary (MEDIUM confidence)
- None — every claim in this document is either grounded in a live fetch performed this session or in
  source code read directly; no web search was needed since the entire unknown (NLT's response shape)
  was resolved by direct API access.

### Tertiary (LOW confidence)
- Assumption A1 (Psalm superscription strip-or-keep) — flagged explicitly in the Assumptions Log, not
  independently verified against an ESV parity sample.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, both DOMParser and fetch already used in this exact codebase
- NLT response shape: HIGH — resolved by six live fetches against the real API this session (was LOW-MEDIUM per R090's own confidence note before this research)
- Architecture (field-threading path for R092): HIGH — traced end-to-end through actual source (`CongregationalSection` → `SourceRef` → `ScriptureSlide`), not inferred
- Pitfalls: HIGH — five of seven pitfalls are grounded in either live-fetch evidence or direct source reads; the bracket-format dependency (Pitfall 1) was not previously documented anywhere and is the single highest-value discovery of this research
- Scope narrowing (dead-code exclusion, Reference-state text-emptiness): MEDIUM-HIGH — grounded in grep/read evidence, flagged as Assumptions A3/A4 for planner confirmation rather than asserted as unchallengeable fact

**Research date:** 2026-08-07
**Valid until:** NLT API shape — revalidate if `api.nlt.to` returns a different structure at
implementation time (unlikely short-term, but the API is undocumented/unversioned from what this
session could observe — no version header beyond the CSS asset's `?vers=1.04` query string). Everything
else (codebase architecture) is valid until the relevant files are next touched by another phase.
