---
phase: 45-esv-nlt-bible-version-selection
reviewed: 2026-08-08T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - functions/src/index.ts
  - src/utils/nltApi.ts
  - src/types/organization.ts
  - src/views/SettingsView.vue
  - src/types/slide.ts
  - src/types/slideGroup.ts
  - src/utils/scripture.ts
  - src/utils/slideGroupMaterializer.ts
  - src/utils/slideshowAssembler.ts
  - src/components/CongregationalEditor.vue
  - src/components/ScriptureInput.vue
  - src/components/PresentationViewer.vue
  - src/components/slides/slideDisplay.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-08-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase adds an NLT proxy branch to `functions/src/index.ts`, a DOMParser-based
`nltApi.ts` client, `OrgSettings.bibleVersion`, per-slide `translationSource`
stamping, and shared attribution helpers in `scripture.ts`. The implementation is
unusually defensive and the accompanying test suites are extensive: `npm run
type-check` is clean, and every touched-file test suite I ran (`nltApi.test.ts`,
`scripture.test.ts`, `CongregationalEditor.test.ts`, `PresentationViewer.test.ts`,
`ScriptureInput.test.ts`, `SettingsView.test.ts`, `functions/src/index.test.ts`)
passes — 322 tests total, 0 failures.

I specifically verified, by direct code reading and by running the relevant tests,
every item called out in the review brief:

- **Client-key spoofing (T-45-11):** `buildUpstreamUrl` unconditionally calls
  `searchParams.set('key', secretValue)` for the `nlt` service, overwriting any
  client-supplied `key` — confirmed by both source inspection and the
  `"T-45-11: OVERWRITES a client-supplied key..."` test.
- **HTML injection:** `stripNltHtml` extracts only `.textContent` after removing
  footnote/heading elements; no `innerHTML` write and no `v-html` anywhere in the
  reviewed Vue files. `PresentationViewer.test.ts` has an explicit test proving
  angle-bracket text renders literally, not as child elements.
- **`[N]` bracket convention:** verified against `vn` attribute extraction, with a
  round-trip test through `splitPassage`/`parseVerses` proving verse-level
  granularity survives.
- **Empty-body guard:** `fetchNltPassageText` checks `!html.trim()` on the raw
  HTTP-200 body before stripping — this is the exact "HTTP 200 + empty body"
  failure mode documented in 45-RESEARCH.md, and it's correctly caught. (See WR-01
  below for a related gap in the *post-strip* case.)
- **R092 immutability:** `resolveTranslationSource` is `slide.translationSource ??
  'ESV'`, imports nothing from `authStore`/`organization.ts`, and this is enforced
  by a source-inspection test (`.toString()` regex check) in addition to a
  behavioral one. Both render sites (`slideDisplay.ts`'s `slideBodyText` and
  `PresentationViewer.vue`'s `scriptureAttributionSuffix`) read the per-slide field
  only.
- **Fetch routing:** `CongregationalEditor.vue` and `ScriptureInput.vue` both read
  `authStore.settings.bibleVersion` at fetch time and route to `fetchNltPassageText`
  vs `fetchPassageText` accordingly; `CongregationalEditor` additionally captures
  the version once into `lastFetchedVersion` so a later AI-split reuses the
  originally-fetched version, not a live re-read.
- **Deploy discipline:** `git log`/`git show --stat` on the phase's commit
  (`298c4be`) touches only `functions/src/index.ts` — no `firestore.rules`,
  `storage.rules`, or deploy-config changes.

No Critical/blocker-level defects were found. Two Warnings are worth fixing before
this ships to reduce residual risk in edge cases the current test suite doesn't
cover.

## Warnings

### WR-01: The empty-body guard only checks the raw HTML, not the post-strip result

**File:** `src/utils/nltApi.ts:31-41`
**Issue:** `fetchNltPassageText` guards against NLT's documented "HTTP 200 with an
empty body" failure mode by checking `!html.trim()` on the *raw* response text
before calling `stripNltHtml`. But `stripNltHtml` can independently produce an
empty string even when the raw HTML is non-empty: if the `#bibletext` root exists
but contains zero `<verse_export>` elements (a plausible shape for some
edge-case reference, or a future NLT markup change), `verses` is `[]`,
`.map().filter(Boolean).join(' ')` returns `''`, and this empty string is returned
to the caller with no error thrown. `CongregationalEditor.vue`'s `onFetchPassage`
would then treat this as a *successful* fetch — it emits `update:reference` and
builds `draftSections` from an empty string via `splitPassage`/`buildAlternatingSections` — silently producing a reading with no
passage text and no error surfaced to the user, rather than hitting the
`fetchError.value = true` path the "empty body" guard exists to trigger.
**Fix:**
```ts
const html = await response.text()
if (!html.trim()) {
  throw new Error('Failed to fetch passage')
}

const stripped = stripNltHtml(html)
if (!stripped.trim()) {
  throw new Error('Failed to fetch passage')
}
return stripped
```
Add a fixture test (e.g. an HTML with `#bibletext` present but no `verse_export`
children) to `nltApi.test.ts` proving this path throws rather than resolving to
`''`.

### WR-02: The secret-bearing outbound URL has no redaction boundary before it reaches `fetch()`/error logging

**File:** `functions/src/index.ts:131,154-172`
**Issue:** For the `nlt` service, `NLT_API_KEY` is injected directly into the
outbound URL's query string (`buildUpstreamUrl`) — this is correct and
necessary given NLT's API design (the code comment explains this well), and today
nothing in the reviewed code logs `upstreamUrl` directly. However, `upstreamUrl`
(carrying the live secret) is passed straight into `fetch()`, and any failure
falls into a blanket `console.error("Proxy error:", err)` with no guarantee that
`err` (or a future `cause`/stack-trace field on it) never embeds the request URL.
Because the key lives in a URL rather than a header, it is one accidental
`console.log(upstreamUrl)` / one Node/undici version bump away from landing in
Cloud Logging — a risk that doesn't exist for the `esv`/`anthropic` branches,
where secrets only ever live in `headers`, never in a loggable string. There's no
structural guard (e.g., a redaction helper, or logging only `upstream.status` +
`service` on error) preventing this.
**Fix:**
```ts
} catch (err) {
  console.error("Proxy error:", { service, status: (err as { status?: number })?.status, message: err instanceof Error ? err.message : String(err) });
  res.status(502).json({ error: "Upstream request failed" });
}
```
Or, simpler: log `service` and a generic message only, never `err` (or any value
derived from `upstreamUrl`) verbatim. This is defense-in-depth, not a proven
current leak — no test or code path today logs the key — but it's the kind of gap
that's cheap to close now and expensive to notice later.

## Info

### IN-01: `stripNltHtml`'s "no `#bibletext` root" error breaks the file's own documented failure-contract parity

**File:** `src/utils/nltApi.ts:76-78`
**Issue:** The file's header doc comment promises "same `Error('Failed to fetch
passage')` failure contract" as `esvApi.ts`, "so both clients present a uniform
failure mode to their shared callers." But `stripNltHtml` throws `Error('Unexpected
NLT response shape')` when `#bibletext` is missing, and this throw is **not**
caught/rewrapped by `fetchNltPassageText` — a shape-mismatch response surfaces a
different error message than the documented contract. In practice this is masked
because every caller (`CongregationalEditor.vue`, `ScriptureInput.vue`) catches
generically and shows the same UI regardless of message, so there's no observable
behavior bug — just a doc/implementation mismatch worth tidying.
**Fix:** Either wrap the `stripNltHtml` call in `fetchNltPassageText` with a
try/catch that rethrows `Error('Failed to fetch passage')`, or amend the header
comment to note this one exception to the "uniform failure mode" claim.

### IN-02: `NLT_API_KEY.value()` is read unconditionally for every proxied request

**File:** `functions/src/index.ts:131`
**Issue:** `buildUpstreamUrl(service, builtUpstreamUrl, NLT_API_KEY.value())` calls
`.value()` on the NLT secret for every request through `api`, including
`anthropic`/`esv`/`planningcenter` calls that never use it — `buildUpstreamUrl`
only consumes the third argument when `service === 'nlt'`. Harmless today (secret
values are cheap to read from the injected env), but it's a minor smell: a reader
skimming this line might wonder why an unrelated secret is being touched on every
request.
**Fix:** Not required, but for clarity: `service === 'nlt' ? NLT_API_KEY.value() : ''`
at the call site, or move the `.value()` call inside `buildUpstreamUrl`'s `nlt`
branch (would require passing the secret object instead of its resolved value).

### IN-03: No end-to-end test of the `api` handler's NLT auth-gate + key-overwrite integration

**File:** `functions/src/index.test.ts:959-1011`
**Issue:** The NLT proxy suite tests `buildUpstreamUrl` and the `PROXY_TARGETS`/
`SECRET_INJECTED` membership tables in isolation, per the file's own comment
("the `api` onRequest handler itself has no existing test harness"). This means
the actual runtime composition — an unauthenticated request to `/api/nlt/...`
really does get a 401 before `buildUpstreamUrl` ever runs, and a valid request
really does have `x-app-auth` stripped and the key injected in the same code path
— is exercised only by manual/live verification (per 45-RESEARCH.md), not by an
automated test. This is a pre-existing gap (shared with the `esv`/`anthropic`
branches, which have the same lack of handler-level coverage) rather than
something newly introduced by this phase, so it's Info rather than Warning.
**Fix:** Out of scope for this phase per its own documented assumption (A2); worth
a follow-up ticket to add a lightweight `onRequest` test harness (e.g. via
`supertest` against the exported handler) covering the 401 gate + secret-injection
integration for all three `SECRET_INJECTED` services at once.

---

_Reviewed: 2026-08-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
