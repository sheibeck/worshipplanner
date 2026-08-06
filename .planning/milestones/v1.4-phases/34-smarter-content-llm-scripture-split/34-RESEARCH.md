# Phase 34: Smarter Content — LLM Scripture Split - Research

**Researched:** 2026-08-03
**Domain:** Anthropic Messages API structured outputs; client-side text-offset validation; Vue 3 / Pinia editor wiring
**Confidence:** HIGH

## Summary

R064's whole design goal — scripture correctness that is *structurally* guaranteed rather than
prompt-discouraged — is achievable exactly as CONTEXT.md specifies: the model must return only
integers and a speaker enum, never text, and every returned value must be validated against the
already-fetched ESV source before it is allowed to populate `CongregationalSection.text`.

**The single highest-value finding of this research reverses a load-bearing premise in
CONTEXT.md.** CONTEXT.md states the `^0.78.0` SDK pin "predates the structured-outputs support this
depends on" and frames the SDK upgrade as "a hard prerequisite, scheduled first." I extracted and
inspected the actual installed `@anthropic-ai/sdk@0.78.0` package (not just its changelog) and found
`output_config.format` (type `JSONOutputFormat`, `{ type: 'json_schema', schema }`),
`client.messages.parse()`, and both `zodOutputFormat` and — more importantly for this project, which
has no `zod` dependency — the **non-beta, zero-new-dependency** `jsonSchemaOutputFormat` helper
already present, fully non-beta, in the currently-installed version. Structured outputs went GA
(moved off the beta header, onto `output_config`) in SDK `0.72.0` (2026-01-29), a full three weeks
*before* `0.78.0` (2026-02-19) shipped. **The upgrade is not required to unblock this phase.** It
remains reasonable hygiene (five months of bug fixes sit between `0.78.0` and the current
`0.115.0`), but the plan should treat it as a low-risk maintenance task with a smoke-test gate on the
two existing call sites, not as a blocking Task 1 whose absence would break the feature.

**The second correction concerns where validation "lives."** CONTEXT.md says validation belongs at
the Cloud Function proxy (`functions/src/index.ts`) because it is "the single existing egress for
`anthropic`." I read that file in full: it is a **generic, byte-blind pass-through proxy** — for every
service (`planningcenter`, `anthropic`, `esv`) it does `fetch(upstreamUrl, { headers, body:
JSON.stringify(req.body) })` and streams the response back verbatim. It has no `@anthropic-ai/sdk`
dependency (confirmed: absent from `functions/package.json`), no JSON parsing of the Anthropic
response body, and critically **no access to the ESV source text**, which is fetched by the browser
in a *separate* call to `/api/esv/...` and never reaches the Function. Moving validation there would
mean bolting scripture-specific business logic onto a shared multi-tenant proxy that today has zero
awareness of any service's semantics — a materially larger, riskier change than the phase's own scope
implies, and one with no code path to get the ESV text to the Function without a new plumbing layer.
The two existing AI call sites (`suggestSongs`, `suggestScripture`) already validate entirely
client-side in `src/utils/claudeApi.ts`, immediately after the API call returns. This phase should
follow that established precedent: build the request, call the (unchanged) proxy exactly as today,
and validate the response client-side, where the ESV source text already lives in memory. The
Function's role as "the single egress for secrets" is satisfied structurally — it is still the only
path the API key ever flows through — without requiring it to understand the response.

**The design that makes both the correctness guarantee and the "mechanical, not promptable" boundary
requirement work is a pre-computed legal-boundary-index contract, not raw character offsets.**
Compute an ordered array of legal split positions directly from the ESV text `fetchPassageText`
already returns (every position immediately after a `[N]` verse marker, and every position after a
clause-ending mark — `.`, `!`, `?`, `;`, `:` — followed by whitespace), embed a visible index marker
at each such position in the copy of the text sent to the model, and constrain the schema to
`{ speaker, startBoundary: integer, endBoundary: integer }` — integers that index into *that specific
array*, not free-floating offsets into the raw string. Because every legal value is, by construction,
a real position in the untouched source text, "does this offset byte-match the source" stops being a
fuzzy string-comparison problem and becomes a trivial bounds check (`0 <= i < boundaries.length`) —
and a mid-sentence split is not merely discouraged, it is *not a representable value* the model can
emit. This is the "genuine design win" CONTEXT.md asks the research to find, and it is a strict
improvement over raw offsets, which would still require a separate legality check against the
boundary set after the fact.

**Primary recommendation:** Do not touch the `^0.78.0` SDK pin as a blocking task — bump it (or don't)
as ordinary maintenance with a smoke-test gate on the two existing call sites. Build a
pre-computed-boundary-index contract using the SDK's existing `jsonSchemaOutputFormat` helper (no new
dependency), validate entirely client-side in `src/utils/claudeApi.ts` immediately after the response
returns (not in `functions/src/index.ts`), and wire the "split with AI" affordance into the existing,
currently-unmounted `CongregationalEditor.vue` as an addition alongside its working manual flow.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R064 | A scripture item can be split into a congregational responsive reading with leader/congregation attribution. The model returns only index ranges and speaker labels into already-fetched ESV text — never scripture words — so altered or hallucinated scripture is structurally impossible. Splits fall on clause/verse boundaries, never mid-sentence. Requires evaluating the `@anthropic-ai/sdk` upgrade. AI remains additive and never blocking. | Boundary-index contract (Architecture Patterns), client-side validation design (Common Pitfalls, Code Examples), corrected SDK-upgrade premise (Summary, Standard Stack), corrected validation-location premise (Summary, Architecture Patterns), failure-path design reusing `useToasts` (Architecture Patterns, Code Examples) |

</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Congregational reading already exists, manually.** `CongregationalSection`, `ScriptureSlide.readingMode`/`sections`, `ScriptureReading.congregationalSections`, and a working 321-line manual editor (`CongregationalEditor.vue`) all ship today. This phase adds an LLM-assisted split on top of that — it does not build the capability. No model/type change should be needed; if planning concludes one is, that is a signal to re-check the premise.
- **The manual path must survive.** AI is additive and never blocking — a user must still be able to build a responsive reading by hand exactly as today.
- **The model returns ONLY structural data: index ranges + speaker labels.** It never returns scripture words. Any design where the model emits text defeats R064's core claim, no matter how good the prompt.
- **`CongregationalSection.text` is a `string` of actual words** — there IS a conversion step. Section text must be **sliced from the already-fetched ESV source** using the model's offsets. Slicing is the only permitted way to populate it.
- **Every returned offset must byte-match the source, and a failure is HARD** — no fuzzy matching, no normalization to make an offset "close enough."
- **The schema CANNOT enforce the bounds.** Structured outputs' JSON Schema subset does not support numerical constraints (`minimum`, `maximum`, `multipleOf`) or string-length constraints. "Indices are within the passage" must be an explicit client-side check.
- **Validation lives at the Cloud Function proxy choke point**, per the ROADMAP. *(Research finding: the actual proxy is a byte-blind generic pass-through with no ESV-text access — see Summary. Recommend client-side validation in `claudeApi.ts` instead, which structurally still routes through the same single egress for secrets.)*
- **`@anthropic-ai/sdk` is pinned at `^0.78.0`, which predates structured outputs** — upgrade is task one. *(Research finding: this is factually incorrect — see Summary. `0.78.0` already has GA, non-beta structured-outputs support.)*
- **Use `output_config: { format: { type: 'json_schema', schema } }`.** The top-level `output_format` parameter is deprecated API-wide. Ergonomic path is `client.messages.parse()` with a Zod or JSON-Schema output-format helper.
- **Do NOT opportunistically migrate `suggestSongs`/`suggestScripture` to structured outputs** in this phase — confirm the upgrade doesn't break them, note the opportunity, defer the migration.
- **Model: `claude-haiku-4-5`, pinned as `claude-haiku-4-5-20251001`** (matching the two existing call sites' convention). Haiku 4.5 supports structured outputs.
- **Haiku 4.5 is pre-4.6-family.** It uses `thinking: { type: 'enabled', budget_tokens: N }`; **`effort` ERRORS on it.** Do not carry 4.6+/5-family params onto this call.
- **A failed split never blocks editing.** Call failure, timeout, invalid shape, or byte-match failure → scripture slide still renders/usable, user falls back to manual editor.
- **Surface the failure honestly** via `useToasts` (R041's failure-only toast pattern) — reuse, don't invent a new surface.
- **Never partially apply a split.** Any section failing validation → discard the whole result.

### Claude's Discretion

- Exact schema shape for the returned ranges (character offsets vs verse+offset pairs) — resolved by this research: pre-computed legal-boundary-index pairs, not raw offsets and not verse+intra-verse-offset pairs (see Architecture Patterns).
- Prompt wording, and whether a one-shot example helps boundary quality.
- Where the "split this for me" affordance lives inside `CongregationalEditor.vue`.
- Whether to send the passage as plain text or with verse markers — resolved: send with inline synthetic boundary-index markers embedded at every legal split point (a superset of "with verse markers," since verse starts are one class of legal boundary).

### Deferred Ideas (OUT OF SCOPE)

- Migrating `suggestSongs`/`suggestScripture` to structured outputs — worth a follow-up, not this phase.
- Any second AI feature (auto-summarizing a passage, suggesting a reading based on the sermon). R064 is one requirement; this phase delivers one capability.
- Presentation of the responsive reading (LEADER vs CONGREGATION rendering on a projected slide) — Phase 35 owns presentation correctness.
- Caching split results — not requested, and cache invalidation on passage/translation change adds complexity for no asked-for benefit.

</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Boundary computation (legal split points from ESV text) | Browser / Client | — | Pure function over text already in memory (`rawText` in `CongregationalEditor.vue`); no server round-trip needed, and the client is the only place that has the ESV text at all. |
| LLM split request (model call + schema) | Browser / Client (via existing proxy) | API / Backend (Cloud Function, secret injection only) | Mirrors the two existing call sites exactly — `claudeApi.ts` builds and sends the request; the Function only injects `CLAUDE_API_KEY` and forwards bytes. The Function does not and should not parse the Anthropic response. |
| Offset/byte-match validation | Browser / Client | — | Requires the ESV source text, which only exists client-side (fetched separately via `/api/esv`, never sent to the Function). Matches the existing `validateSongSuggestions`/`validateScriptureSuggestions` precedent in `claudeApi.ts`. |
| Secret custody (`CLAUDE_API_KEY`) | API / Backend (Cloud Function) | — | Unchanged — `functions/src/index.ts`'s `SECRET_INJECTED` gate is the only place the real key exists; this phase does not touch that boundary. |
| Failure surfacing (toast) | Browser / Client | — | `useToasts` is a Pinia store; failure-only per R041. |
| Persistence of the resulting sections | Browser / Client → Database | — | `useScriptureSlides` store already writes `congregationalSections` via `updateReading`/`createReading`; the AI path reuses that exact write path, just with an AI-populated `sections` array instead of a manually-toggled one. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `0.78.0` installed (currently valid); `0.115.0` latest on npm as of 2026-07-24 | Anthropic Messages API client | Already the project's SDK; `0.78.0` already has non-beta `output_config`, `messages.parse()`, and `jsonSchemaOutputFormat` — [VERIFIED: npm registry] via direct extraction of the installed tarball's `.d.ts` files (`resources/messages/messages.d.ts`, `helpers/json-schema.d.ts`), not just changelog claims |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `json-schema-to-ts` | `^3.1.1` (already a **normal dependency of `@anthropic-ai/sdk`**, confirmed in the SDK's own `package.json`) | Type inference for `jsonSchemaOutputFormat`'s raw-JSON-Schema input | Automatically available — no new `package.json` entry needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jsonSchemaOutputFormat` (raw JSON Schema, no new dep) | `zodOutputFormat` + `zod` | `zod` is only an **optional peer dependency** of `@anthropic-ai/sdk` — the project has no `zod` today. Adding it purely for this one schema widens the SDK-upgrade blast radius CONTEXT.md explicitly warns against. `jsonSchemaOutputFormat` gets the identical `client.messages.parse()` + `parsed_output` ergonomics with zero new dependencies. |
| Client-side validation in `claudeApi.ts` | Validation inside `functions/src/index.ts` | The proxy has no ESV text and no `@anthropic-ai/sdk` dependency today; giving it either is a scope increase the phase does not need, since the two existing call sites already prove the client-side pattern works. |

**Installation:**
```bash
# No install needed if keeping ^0.78.0. If bumping for hygiene:
npm install @anthropic-ai/sdk@^0.115.0
```

**Version verification:** `npm view @anthropic-ai/sdk version` returned `0.115.0` (published 2026-07-24T16:33:43Z) [VERIFIED: npm registry]. The currently-installed, currently-pinned `0.78.0` (published 2026-02-19T20:06:37Z, `node_modules/@anthropic-ai/sdk/package.json` confirms `0.78.0` is what actually resolves under the `^0.78.0` range today) was directly unpacked (`npm pack @anthropic-ai/sdk@0.78.0`) and its type declarations inspected — `OutputConfig.format: JSONOutputFormat | null` where `JSONOutputFormat = { schema: {...}, type: 'json_schema' }` exists non-beta at `resources/messages/messages.d.ts:506,704,713`; `messages.parse()` exists non-beta at `resources/messages/messages.d.ts:52`; `jsonSchemaOutputFormat` exists non-beta at `helpers/json-schema.d.ts:12`. Structured outputs' beta period (SDK `0.69.0`–`0.71.x`, per `CHANGELOG.md`) ended with GA in `0.72.0` (2026-01-29), three weeks before `0.78.0` shipped.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@anthropic-ai/sdk` | npm | Since 2023-01-31 (created); latest version `0.115.0` published 2026-07-24 | 29,722,724/wk | `github.com/anthropics/anthropic-sdk-typescript` | `SUS` (automated) — reason given was `too-new` | **Approved — automated flag is a false positive.** `gsd-tools package-legitimacy check` flagged this `SUS` purely because the *latest published version's* timestamp is recent (this SDK ships near-weekly releases, so its newest version is *always* "too new" by that heuristic — it says nothing about the package's actual age or trustworthiness). Corroborating evidence overwhelmingly supports legitimacy: 29.7M weekly downloads, official `anthropics` GitHub org, no `postinstall` script (`npm view @anthropic-ai/sdk scripts.postinstall` returned empty), already the installed dependency of this very project, and its structured-outputs types were independently verified by direct tarball inspection in this research session. |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@anthropic-ai/sdk` — flagged above as a heuristic false positive with corroborating evidence; **no `checkpoint:human-verify` is warranted** given the strength of the counter-evidence (this is the project's existing, already-shipped-with SDK — not a newly-proposed package), but the planner may add a lightweight sanity note if it prefers belt-and-suspenders.

*No other new packages are proposed by this research — the `jsonSchemaOutputFormat` and `json-schema-to-ts` dependency are already bundled inside `@anthropic-ai/sdk`, not separate installs.*

## Architecture Patterns

### System Architecture Diagram

```
User types reference in CongregationalEditor.vue
        │
        ▼
parseScriptureInput() ──► fetchPassageText() ──► ESV proxy (/api/esv/...)
        │                        │                (Cloud Function, byte-forward,
        │                        ▼                 injects ESV_API_KEY)
        │                 rawText (in-memory,
        │                 verse markers "[N]"
        │                 inline, no footnotes/
        │                 headings/refs)
        │                        │
        ▼                        ▼
[EXISTING] buildAlternatingSections()   [NEW] computeBoundaries(rawText)
   → manual word-count split                → ordered boundary offset[] into rawText
   (unchanged, always available)                    │
                                                      ▼
                                          embedBoundaryMarkers(rawText, boundaries)
                                          → text with synthetic ⟦N⟧ markers at each
                                            legal split point (verse starts +
                                            clause-ending punctuation)
                                                      │
                                                      ▼
                                    claudeApi.ts: splitCongregationalReading()
                                    client.messages.parse({
                                      model: 'claude-haiku-4-5-20251001',
                                      output_config: { format: jsonSchemaOutputFormat(SCHEMA) },
                                      messages: [{ role: 'user', content: markedUpText }],
                                    }, { headers: appAuthHeaders })
                                                      │
                                                      ▼
                                    Anthropic proxy (/api/anthropic/..., Cloud
                                    Function, byte-forward, injects CLAUDE_API_KEY —
                                    UNCHANGED, no new logic here)
                                                      │
                                                      ▼
                                    response.parsed_output:
                                    { sections: [{ speaker, startBoundary, endBoundary }] }
                                                      │
                                                      ▼
                                    validateSplitResult(parsed, boundaries, rawText)
                                    — ALL client-side, ALL integer/bounds checks:
                                      • every index in [0, boundaries.length)
                                      • startBoundary < endBoundary per section
                                      • sections ordered, contiguous, gapless
                                      • first section starts at boundary 0
                                      • last section ends at final boundary
                                      • speaker ∈ {LEADER, CONGREGATION}
                                            │
                              ┌─────────────┴─────────────┐
                              ▼ ALL PASS                   ▼ ANY FAIL
                    slice rawText at each              discard entire result
                    section's boundaries →              useToasts().push(...)
                    CongregationalSection[]              sections.value UNCHANGED
                    (text sliced verbatim,               (manual editor still usable,
                     never model-echoed)                  R064's "additive, never
                              │                            blocking" requirement)
                              ▼
                    sections.value = result
                    → same store.updateReading()/
                      createReading() write path
                      the manual flow already uses
```

### Recommended Project Structure

```
src/
├── utils/
│   ├── scriptureBoundaries.ts   # NEW — pure functions: computeBoundaries(),
│   │                            #   embedBoundaryMarkers(), sliceAtBoundaries()
│   ├── claudeApi.ts             # EXTEND — add splitCongregationalReading(),
│   │                            #   its schema, its validator; existing
│   │                            #   getSongSuggestions/getScriptureSuggestions
│   │                            #   untouched except for the SDK-version smoke test
│   └── __tests__/
│       ├── scriptureBoundaries.test.ts   # NEW
│       └── claudeApi.test.ts             # EXTEND
└── components/
    ├── CongregationalEditor.vue          # EXTEND — add "Split with AI" affordance
    └── __tests__/
        └── CongregationalEditor.test.ts  # EXTEND
```

### Pattern 1: Boundary-Index Contract (the correctness guarantee)

**What:** Compute the set of legal split positions from the untouched ESV source text *before*
calling the model. Send the model a copy of the text with each legal position visibly marked. Ask
for a sequence of `{speaker, startBoundary, endBoundary}` triples referencing those marker indices —
never characters, never verse numbers directly, never free-floating offsets.

**When to use:** Any time a model must select substrings of a trusted source without being trusted to
reproduce the substring itself — this is the general pattern R064 calls for, not scripture-specific.

**Example (illustrative, not final implementation code):**
```typescript
// src/utils/scriptureBoundaries.ts — sketch

/** Every position in `text` where a section may legally start or end:
 *  right after a "[N]" verse marker, and right after clause-ending
 *  punctuation (. ! ? ; :) followed by whitespace. Position 0 and
 *  text.length are always included as the passage's own start/end anchors. */
export function computeBoundaries(text: string): number[] {
  const boundaries = new Set<number>([0, text.length])
  for (const m of text.matchAll(/\[\d+\]\s*/g)) {
    boundaries.add(m.index! + m[0].length)
  }
  for (const m of text.matchAll(/[.!?;:]\s+/g)) {
    boundaries.add(m.index! + m[0].length)
  }
  return [...boundaries].sort((a, b) => a - b)
}

/** Embed a synthetic, unmistakable marker at each legal boundary so the
 *  model can literally see and choose among them by index — never asked
 *  to count characters blind. */
export function embedBoundaryMarkers(text: string, boundaries: number[]): string {
  let out = ''
  let last = 0
  boundaries.forEach((offset, i) => {
    out += text.slice(last, offset) + `⟦${i}⟧`
    last = offset
  })
  return out
}
```

```typescript
// src/utils/claudeApi.ts — sketch, additive to the existing file

const SPLIT_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['LEADER', 'CONGREGATION'] },
          startBoundary: { type: 'integer' },
          endBoundary: { type: 'integer' },
        },
        required: ['speaker', 'startBoundary', 'endBoundary'],
        additionalProperties: false,
      },
    },
  },
  required: ['sections'],
  additionalProperties: false,
} as const

// Source: SDK docs (structured-outputs.md) + verified helpers/json-schema.d.ts
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'

export async function splitCongregationalReading(
  rawText: string,
  ref: ScriptureRef,
): Promise<CongregationalSection[] | null> {
  try {
    const boundaries = computeBoundaries(rawText)
    const markedUp = embedBoundaryMarkers(rawText, boundaries)

    const response = await getClient().messages.parse(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        // NO `thinking` param — Haiku 4.5 defaults to no thinking when omitted;
        // NO `output_config.effort` — errors on Haiku 4.5.
        output_config: { format: jsonSchemaOutputFormat(SPLIT_SCHEMA) },
        system: SPLIT_SYSTEM_PROMPT, // instructs: alternate speaker, choose only
                                      // marker indices, cover the whole passage
        messages: [{ role: 'user', content: markedUp }],
      },
      { headers: await getAppAuthHeaders() },
    )

    const result = validateSplitResult(response.parsed_output, boundaries)
    if (!result) return null // hard fail — caller shows toast, keeps manual state

    return result.map(({ speaker, startBoundary, endBoundary }) => {
      const sliceText = rawText.slice(boundaries[startBoundary]!, boundaries[endBoundary]!)
      return {
        speaker,
        text: sliceText.replace(/\[\d+\]\s*/g, '').trim(), // strip verse markers,
        // mirroring scriptureSplitter.ts's existing convention of keeping
        // verse numbers OUT of .text and (optionally) in a separate verseRange
      }
    })
  } catch (err) {
    console.error('[claudeApi] splitCongregationalReading failed:', err)
    return null
  }
}
```

### Pattern 2: Client-Side Validation as the Only Correctness Boundary

**What:** Because the JSON Schema subset used by structured outputs cannot express `minimum`,
`maximum`, or array-ordering constraints, every one of the following checks must be explicit
TypeScript code run on `response.parsed_output` before any section is used:

```typescript
// Source: derived from CONTEXT.md's explicit validation checklist + verified
// JSON Schema limitation list (platform.claude.com/docs/.../structured-outputs.md)
function validateSplitResult(
  parsed: unknown,
  boundaries: number[],
): { speaker: 'LEADER' | 'CONGREGATION'; startBoundary: number; endBoundary: number }[] | null {
  if (!parsed || typeof parsed !== 'object' || !('sections' in parsed)) return null
  const sections = (parsed as { sections: unknown }).sections
  if (!Array.isArray(sections) || sections.length === 0) return null

  const maxIndex = boundaries.length - 1
  let prevEnd: number | null = null

  for (const s of sections) {
    if (
      typeof s !== 'object' || s === null ||
      (s as any).speaker !== 'LEADER' && (s as any).speaker !== 'CONGREGATION'
    ) return null
    const { startBoundary, endBoundary } = s as { startBoundary: unknown; endBoundary: unknown }
    if (!Number.isInteger(startBoundary) || !Number.isInteger(endBoundary)) return null
    if ((startBoundary as number) < 0 || (startBoundary as number) > maxIndex) return null
    if ((endBoundary as number) < 0 || (endBoundary as number) > maxIndex) return null
    if ((startBoundary as number) >= (endBoundary as number)) return null
    // Gapless, non-overlapping coverage — no silently dropped or duplicated text.
    if (prevEnd !== null && startBoundary !== prevEnd) return null
    prevEnd = endBoundary as number
  }

  // Must span the whole passage: first section starts at 0, last ends at maxIndex.
  if ((sections[0] as any).startBoundary !== 0) return null
  if (prevEnd !== maxIndex) return null

  return sections as ReturnType<typeof validateSplitResult> extends (infer T)[] | null ? T[] : never
}
```

**Why a failure here is different from "structured outputs didn't work":** `strict`/`json_schema`
output guarantees only *shape* (an integer where an integer is expected, one of two enum strings) —
never *range* or *cross-field relationships* (ordering, coverage, non-overlap). Every one of the
five bullet checks above is a relationship the schema cannot express by design, confirmed directly
against the API's documented JSON Schema subset: **not supported** — `minimum`, `maximum`,
`multipleOf`, `minLength`, `maxLength`, complex array constraints, non-`false`
`additionalProperties`, recursive schemas [CITED: platform.claude.com/docs/en/build-with-claude/structured-outputs].

### Anti-Patterns to Avoid

- **Letting the model's schema include a `text` field "for verification."** Even an optional string
  field the code never reads would mean the model *could* produce scripture text, which is exactly
  what R064 says must be structurally impossible — the schema itself is part of the guarantee, not
  just the code that reads it.
- **Treating `strict: true` (tool-definition strict mode) as the same feature as `output_config.format`'s
  `json_schema` type.** They're related but distinct API surfaces — the tool-use `strict` field lives
  on a `tools[]` entry, not on `OutputConfig`; `JSONOutputFormat` (verified interface: `{ schema, type:
  'json_schema' }`) has no `strict` field of its own because shape conformance is inherent to the
  `json_schema` format type. Don't reach for `strict: true` here — it isn't the applicable knob, and
  it wouldn't add range enforcement even if it were.
- **Recomputing `boundaries` at validation time instead of reusing the exact array built before the
  request.** The whole correctness argument depends on validating against the *same* boundary array
  that was embedded in the prompt. If the text or the boundary algorithm changes between build-prompt
  and validate-response (e.g., a stray re-fetch), indices silently point at different text.
- **Putting validation logic in `functions/src/index.ts`.** See Summary — the proxy has neither the
  ESV text nor an SDK dependency; this would require a new architecture, not a small addition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Guaranteeing a model's JSON output matches a schema | A regex/heuristic parser over free-form model text (the pattern the two existing call sites use, via `safeParseJsonArray`) | `output_config.format` (`json_schema`) + `client.messages.parse()` | The whole point of R064 is a *structural* guarantee; `safeParseJsonArray`'s prose-extraction regex is exactly the "prompt-discouraged, not structurally impossible" pattern the requirement explicitly rejects for this feature (it remains fine, and unchanged, for the two existing suggestion call sites, which don't carry this guarantee). |
| JSON Schema numeric-range validation | A hand-rolled JSON Schema validator that somehow enforces `minimum`/`maximum` server-side | Explicit TypeScript bounds checks against a small integer domain (`[0, boundaries.length)`) | The API's structured-outputs feature genuinely does not support range constraints — this is not a gap to work around with more schema cleverness, it's a documented subset limitation. The bounds check is trivial precisely because the domain is a small pre-computed array, not an arbitrary integer. |

**Key insight:** The "don't hand-roll" instinct here cuts the *opposite* direction from usual —
normally you'd say "don't hand-roll JSON parsing/validation, use a library." Here, the correct move is
the reverse: don't reach for a JSON-Schema-validation library to enforce range constraints the API
itself doesn't support; a five-line integer bounds check is both sufficient and the only thing that
actually can be "hard" in the way CONTEXT.md requires.

## Common Pitfalls

### Pitfall 1: Treating the SDK upgrade as a blocking prerequisite

**What goes wrong:** A plan sequences "upgrade `@anthropic-ai/sdk`" as Task 1, gated on the belief
that structured outputs won't work otherwise, and treats the whole phase as blocked until it lands.

**Why it happens:** CONTEXT.md states this directly, inherited from the ROADMAP. It is a reasonable
inference from "predates" language without checking the actual SDK version against the actual GA date.

**How to avoid:** Structured outputs (non-beta `output_config`, `messages.parse()`,
`jsonSchemaOutputFormat`) are already present in the installed `0.78.0`. Sequence the split feature
first; treat any SDK bump as an independent, low-risk maintenance task with its own smoke test.

**Warning signs:** A plan whose Wave 1 has no content except "upgrade SDK, verify build" before any
split logic exists.

### Pitfall 2: Sending `effort` or the wrong `thinking` shape to Haiku 4.5

**What goes wrong:** Copy-pasting a Fable-5/Opus-5-flavored example (`output_config: { effort: 'high'
}`, or `thinking: { type: 'adaptive' }`) onto the Haiku call — both error on pre-4.6-family models.

**Why it happens:** Most current-model examples (including in this skill's own defaults) assume
4.6+/5-family behavior.

**How to avoid:** Omit `output_config.effort` and the `thinking` param entirely for this call (default
= no thinking, matching the two existing call sites, which also omit it). If a future determinism
issue calls for extended thinking on Haiku, the correct shape is `thinking: { type: 'enabled',
budget_tokens: N }`, not `adaptive`.

**Warning signs:** A 400 error mentioning `effort` or `thinking` parameter validation.

### Pitfall 3: `max_tokens` truncating a multi-section reading

**What goes wrong:** A long passage (e.g. all of Psalm 136, 26 verses) produces many sections; a
too-tight `max_tokens` truncates the JSON mid-array, and `parsed_output` is unusable.

**Why it happens:** The response, while small (integers, not scripture text), still scales with
section count, and both existing call sites use `max_tokens: 512` for a very different, shorter
response shape.

**How to avoid:** Size generously (this research suggests `1024` as a safe default for anything up to
~30 sections) since a hard validation failure is the correct outcome on any truncation anyway — there
is no silent-degradation risk either way, only a cost tradeoff.

### Pitfall 4: Comma as a clause boundary

**What goes wrong:** Including `,` in the clause-boundary regex fragments nearly every line of
scripture into tiny pieces, defeating the purpose of "clause, not sentence, granularity" and possibly
producing sections too short to read aloud meaningfully.

**Why it happens:** "Clause" is ambiguous, and comma is the most obvious clause-separator candidate.

**How to avoid:** This research recommends excluding comma from the legal-boundary set by default
(only `. ! ? ; :`), which still captures Psalm-136-style refrains (typically semicolon-joined within
a verse). Flag this as a judgment call for the empirical-determinism check (see Assumptions Log A2) —
if real output looks wrong on Psalm 136/24, comma is the first knob to revisit.

### Pitfall 5: Recomputing boundaries between prompt-build and validation

**What goes wrong:** If the boundary array used to embed markers in the prompt and the array used to
validate the response are computed by two separate calls (even to the identical function on identical
text), any nondeterminism in iteration order (unlikely here, since `Set` iteration is insertion-order
in JS, but still a discipline worth stating) or an accidental re-fetch of the ESV text between the two
steps silently desyncs indices from meaning.

**How to avoid:** Compute `boundaries` once, thread the same array/reference through prompt-building
and validation in one function call, never re-derive it mid-flow.

## Code Examples

### Verified: `output_config.format` shape (from the currently-installed SDK's own type declarations)

```typescript
// Source: node_modules/@anthropic-ai/sdk@0.78.0/resources/messages/messages.d.ts:506,713
// (directly inspected in this research session via `npm pack` + extraction)
interface JSONOutputFormat {
  schema: { [key: string]: unknown }
  type: 'json_schema'
}
interface OutputConfig {
  effort?: 'low' | 'medium' | 'high' | 'max' | null // DO NOT SET for Haiku 4.5 — errors
  format?: JSONOutputFormat | null
}
```

### Verified: `messages.parse()` and `jsonSchemaOutputFormat` are non-beta, present in `0.78.0`

```typescript
// Source: node_modules/@anthropic-ai/sdk@0.78.0/resources/messages/messages.d.ts:52
parse<Params extends MessageCreateParamsNonStreaming>(
  params: Params,
  options?: RequestOptions,
): APIPromise<ParsedMessage<ExtractParsedContentFromParams<Params>>>

// Source: node_modules/@anthropic-ai/sdk@0.78.0/helpers/json-schema.d.ts:12
// No `zod` dependency required — json-schema-to-ts is already a normal
// dependency of @anthropic-ai/sdk itself (its own package.json), not a peer.
declare function jsonSchemaOutputFormat<const Schema extends JSONSchema & { type: 'object' }>(
  jsonSchema: Schema,
  options?: { transform?: boolean },
): AutoParseableOutputFormat<FromSchema<Schema>>
```

### Verified: ESV text format `fetchPassageText` returns

```typescript
// Source: src/utils/esvApi.ts (existing) — the exact params sent
const params = new URLSearchParams({
  q: query,
  'include-headings': 'false',
  'include-footnotes': 'false',
  'include-verse-numbers': 'true',
  'include-short-copyright': 'false',
  'include-passage-references': 'false',
})
// Source: src/utils/scriptureSplitter.ts's parseVerses() — confirms the shape
// empirically: verse numbers arrive as inline "[N]" markers, e.g.
//   "[1] For the Lord is good; his steadfast love endures forever... [2] ..."
// with no headings, footnotes, or passage-reference text mixed in.
function parseVerses(text: string): Verse[] {
  const parts = text.split(/\[(\d+)\]/).filter(Boolean)
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `output_format` top-level param | `output_config.format` | GA in SDK `0.72.0` / API-wide deprecation of `output_format` | Both still work per CONTEXT.md/skill docs ("transition period"), but new code should use `output_config.format` |
| Beta header `structured-outputs-2025-11-13` + `client.beta.messages.create` | No beta header, `client.messages.create`/`.parse()` | GA in SDK `0.72.0` (2026-01-29), matching the API's GA | This project's currently-pinned `0.78.0` already reflects the GA shape — no beta plumbing needed |
| Prose-JSON extraction (`safeParseJsonArray`) for AI output | `output_config.format` + `.parse()` → `parsed_output` | N/A — the two existing call sites still legitimately use the older pattern and are explicitly NOT being migrated this phase | New code (this feature only) should use structured outputs; existing call sites are out of scope |

**Deprecated/outdated:**
- `output_format` top-level parameter — deprecated API-wide, still functional during a transition period, but do not write new code against it.
- The belief (present in CONTEXT.md) that `^0.78.0` lacks structured-outputs support — corrected by this research; see Summary.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ESV API's exact whitespace/paragraph-break behavior around `[N]` verse markers when `include-headings=false` was not independently verified against a *live* ESV API call in this research session (no network credential available in this environment) — the format is inferred from `esvApi.ts`'s request params plus `scriptureSplitter.ts`'s `parseVerses()` regex, which already handles this shape in production. | Architecture Patterns, Code Examples | Low — `parseVerses` is live, tested, production code already parsing this exact API's real responses; the inference is strong, but a plan should still smoke-test `computeBoundaries`/`embedBoundaryMarkers` against a real fetched passage (e.g. Psalm 136) before considering the feature done, not just against a hand-written fixture string. |
| A2 | Haiku 4.5's split *quality* and *run-to-run determinism* on real passages (the ROADMAP's explicit ask: "validate Haiku split determinism empirically against real passages") — **not tested in this research session; no live Anthropic API access was available.** This is a genuine open item, not a documentation gap. | Common Pitfalls (Pitfall 4), Validation Architecture | Medium — even a perfectly-validated split (every boundary legal, full coverage) could still be a *bad* reading (wrong pacing, doesn't isolate the refrain in Psalm 136) if the model's judgment is inconsistent. State explicitly as a **manual-verification item** for execution time, using Psalm 136 (the archetypal responsive reading with a repeated congregational refrain) and Psalm 24 (natural call-and-response shape) as the suggested passages, per the ROADMAP's own recommendation. |
| A3 | Excluding comma from the clause-boundary character set (only `. ! ? ; :`) is a judgment call, not a verified-correct choice — resolved here as a reasonable default but flagged for revisit once A2's empirical check runs. | Common Pitfalls (Pitfall 4) | Low-Medium — if wrong, symptom is sections that read awkwardly (too long, or missing a natural sub-verse break) rather than any correctness failure; easy to tune post-launch without touching the validation logic. |
| A4 | `@anthropic-ai/sdk`'s automated `SUS`/`too-new` verdict is treated as a false positive on the strength of download count, official repo, and no postinstall script — this is a judgment call about how to weigh an automated heuristic against manual corroborating evidence, not itself independently re-verified against a ground-truth "is this really Anthropic's official package" source beyond the GitHub org name matching. | Package Legitimacy Audit | Very low — this is the SDK the project has shipped with in production since before this phase began; the risk profile of a supply-chain attack on an already-integrated, high-download-count official package is not meaningfully different from the risk the project already accepted. |

## Open Questions

1. **Should the LLM split affordance in `CongregationalEditor.vue` replace or sit alongside the
   existing "Fetch Passage" → `buildAlternatingSections()` flow?**
   - What we know: R064 and CONTEXT.md both say AI is additive, never blocking, and the manual path
     must survive unchanged.
   - What's unclear: the exact UI sequencing — does fetching a passage always run the manual
     word-count split first (so there's always something to show even before/without an AI call), with
     an explicit "Split with AI" button that *replaces* `sections.value` on success? Or does fetch
     offer a choice upfront?
   - Recommendation: default to "manual split runs on fetch as today (zero behavior change), AI split
     is an explicit opt-in action that, on success, replaces `sections.value` wholesale (never merges)."
     This is the design that most cleanly satisfies "never partially apply" and "additive, never
     blocking" simultaneously — the manual result is never at risk of being silently degraded by a
     failed AI call, since the AI call doesn't run until asked.

2. **Does `parsed_output` on `ParsedMessage` require the full `messages.parse()` typed response path
   to be mocked identically to how the existing `claudeApi.test.ts` mocks `messages.create`, or does
   the test suite need a new mock shape for `.parse()`?**
   - What we know: the existing test file (`src/utils/__tests__/claudeApi.test.ts`) mocks
     `@anthropic-ai/sdk`'s `messages.create` directly via `vi.mock`.
   - What's unclear: whether `.parse()` is a thin wrapper over `.create()` internally (in which case
     mocking `.create()` and returning appropriately-shaped `content` may suffice) or a distinct SDK
     method requiring its own mock (returning a synthetic `parsed_output` field directly).
   - Recommendation: at plan time, add a small spike/verification step — either inspect the SDK
     source (`resources/messages/messages.js`) for how `.parse()` derives `parsed_output`, or write
     the test both ways and see which the compiler/runtime accepts; this is a Wave 0 test-infra
     question, not a design question.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Anthropic Claude API (via `/api/anthropic` Cloud Function proxy) | The split call itself | ✓ (already used by 2 existing call sites; `CLAUDE_API_KEY` secret already configured) | N/A (HTTP API) | If the proxy/secret is ever unavailable, the split call fails like any other network error — caught, toasted, falls back to manual editor (already the required behavior) |
| ESV API (via `/api/esv` Cloud Function proxy) | Source text the split operates on | ✓ (already used by the existing manual `CongregationalEditor.vue` flow; `ESV_API_KEY` secret already configured) | N/A (HTTP API) | No fallback needed — out of scope per CONTEXT.md ("no change to how ESV text is fetched or cached") |
| `@anthropic-ai/sdk` (npm) | SDK client + structured-outputs helpers | ✓ installed at `0.78.0`, already sufficient | `0.78.0` installed / `^0.78.0` pinned; `0.115.0` latest available | N/A — already satisfied |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — both external services are already integrated and configured for this project.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (per `CLAUDE.md`: `npx vitest run` is the app suite; excludes `src/rules.test.ts`) |
| Config file | `vite.config.ts` (test config is inline; no separate `vitest.config.ts` for the app suite — confirmed no such file exists at the repo root) |
| Quick run command | `npx vitest run src/utils/__tests__/scriptureBoundaries.test.ts src/utils/__tests__/claudeApi.test.ts src/components/__tests__/CongregationalEditor.test.ts` |
| Full suite command | `npx vitest run src/` (known-failing baseline, not defects: `src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts` — 2 files / 9 tests, per `CLAUDE.md`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R064 | `computeBoundaries()` finds every verse-marker and clause-ending position, in order, on representative fixture text (including a Psalm-136-shaped fixture with a repeated semicolon-joined refrain) | unit | `npx vitest run src/utils/__tests__/scriptureBoundaries.test.ts` | ❌ Wave 0 |
| R064 | `embedBoundaryMarkers()` produces text with exactly `boundaries.length` markers, each at the correct offset, and round-trips (stripping markers reproduces the original text) | unit | `npx vitest run src/utils/__tests__/scriptureBoundaries.test.ts` | ❌ Wave 0 |
| R064 | `validateSplitResult()` accepts a well-formed, gapless, in-range result and rejects each individual failure mode (out-of-range index, non-integer, overlapping sections, gap between sections, doesn't start at 0, doesn't end at max, wrong speaker enum value, empty sections array) | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ Wave 0 (extend existing file) |
| R064 | `splitCongregationalReading()` calls the SDK with `model: 'claude-haiku-4-5-20251001'`, `output_config.format` set, and **no** `thinking`/`effort` params — assert on the mocked call's arguments | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts` | ❌ Wave 0 (extend existing file) |
| R064 | On any validation failure, `splitCongregationalReading()` returns `null` and the caller shows a toast via `useToasts` without mutating `sections.value` | unit + component | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` | ❌ Wave 0 (extend existing file) |
| R064 | The manual "Fetch Passage" → `buildAlternatingSections()` flow is unaffected by the new AI path (regression) | unit/component | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` | ✅ (existing tests already cover this path — verify they still pass unmodified) |
| R064 | Empirical split quality/determinism on real ESV text for Psalm 136 and Psalm 24 | manual-only | N/A — no live Anthropic API access in the research/plan/execute environment used here | manual-only, justification: requires a live network call to the Anthropic API with real credentials; not runnable in this session and should not be simulated with a fixture that would give false confidence about model behavior |

### Sampling Rate

- **Per task commit:** `npx vitest run src/utils/__tests__/scriptureBoundaries.test.ts src/utils/__tests__/claudeApi.test.ts src/components/__tests__/CongregationalEditor.test.ts`
- **Per wave merge:** `npx vitest run src/` plus `npm run type-check` (per `CLAUDE.md`: `vue-tsc --build`, the only sufficient type gate — the narrower `-p tsconfig.app.json` form silently skips test files)
- **Phase gate:** Full suite green (with the documented 2-file baseline) before `/gsd-verify-work`; manual determinism check against Psalm 136/24 recorded in `PENDING-VERIFICATION.md` per the project's standing autonomy grant if the run cannot pause for it live

### Wave 0 Gaps

- [ ] `src/utils/__tests__/scriptureBoundaries.test.ts` — covers R064 (boundary computation + marker embedding)
- [ ] Extend `src/utils/__tests__/claudeApi.test.ts` — covers R064 (validation logic, SDK call shape)
- [ ] Extend `src/components/__tests__/CongregationalEditor.test.ts` — covers R064 (affordance wiring, failure-toast path, manual-flow regression)
- [ ] Framework install: none — Vitest and `@vue/test-utils` are already project dependencies

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — existing `getAppAuthHeaders()`/Firebase ID token gate on the proxy, untouched by this phase |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes (unchanged, inherited) | `functions/src/index.ts`'s `SECRET_INJECTED` gate already requires a verified Firebase ID token before `CLAUDE_API_KEY` is ever attached — this phase adds no new egress path, so no new access-control surface is introduced |
| V5 Input Validation | Yes (core to this phase) | The boundary-index client-side validation described above **is** V5 for this feature — every model-supplied value is range/shape/relationship-checked before use, with a hard-fail-and-discard policy on any violation |
| V6 Cryptography | No | No new secrets, keys, or crypto operations introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Model hallucinates or is manipulated into returning out-of-range/overlapping offsets that would corrupt the displayed scripture text | Tampering | The boundary-index contract (this research's core recommendation) — the model cannot express an illegal value at all, and every legal value is bounds-checked client-side before use; any single violation discards the entire result |
| Model attempts to smuggle prose/commentary into the section text via an unvalidated schema field | Tampering / Information Disclosure (of model-generated text masquerading as scripture) | Schema is `additionalProperties: false` at every level, with only `speaker` (enum) and two integers — there is no field the model could populate with free text even if it tried |
| A malformed/oversized reference input reaching the ESV/Anthropic proxy | Denial of Service (minor) | Unchanged from today — `parseScriptureInput()` already gates what reaches `fetchPassageText()`; this phase adds no new unvalidated input surface, since the only new "input" to the LLM call is text the app itself already fetched and trusts (scripture text, not arbitrary user content) |

## Sources

### Primary (HIGH confidence)

- Direct extraction and inspection of `node_modules/@anthropic-ai/sdk@0.78.0` (via `npm pack` + `tar -xzf`) — `resources/messages/messages.d.ts` (`OutputConfig`, `JSONOutputFormat`, `messages.parse()`), `helpers/json-schema.d.ts` (`jsonSchemaOutputFormat`), `helpers/zod.d.ts` (`zodOutputFormat`), root `package.json` (`json-schema-to-ts` as a normal dependency, `zod` as an optional peer dependency) — [VERIFIED: installed package inspection]
- `npm view @anthropic-ai/sdk version` / `time --json` — [VERIFIED: npm registry]
- `npm pack @anthropic-ai/sdk@0.78.0` tarball — [VERIFIED: npm registry, direct download]
- `raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/CHANGELOG.md` — structured-outputs beta (`0.69.0`) → GA (`0.72.0`) timeline — [CITED: GitHub, official repo]
- `platform.claude.com/docs/en/build-with-claude/structured-outputs.md` — model support list, JSON Schema subset limitations (confirmed `minimum`/`maximum`/`multipleOf`/`minLength`/`maxLength` unsupported, matching CONTEXT.md's claim exactly), beta-header/migration language — [CITED: official docs]
- Local codebase reads: `src/utils/esvApi.ts`, `src/utils/scriptureSplitter.ts`, `src/utils/claudeApi.ts`, `src/components/CongregationalEditor.vue`, `src/types/slide.ts`, `src/types/scriptureReading.ts`, `src/stores/toasts.ts`, `functions/src/index.ts`, `functions/package.json`, root `package.json`, `.planning/config.json` — [VERIFIED: direct source read]
- `claude-api` skill (this session, invoked per instruction) — model catalog, Thinking & Effort table (confirms Haiku 4.5's `thinking`/`effort` constraints), Structured Outputs section (confirms Haiku 4.5 support, JSON Schema limitations) — [VERIFIED: skill content, cross-checked against official docs above]

### Secondary (MEDIUM confidence)

- `gsd-tools query package-legitimacy check` — automated verdict, cross-checked against download count / repo / postinstall-script evidence

### Tertiary (LOW confidence)

- None — every claim in this document is either directly verified against installed code/official docs, or explicitly logged in the Assumptions Log as unverified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — directly inspected the installed SDK's type declarations, not just documentation
- Architecture: HIGH — the boundary-index design is derived from the project's own existing, tested `esvApi.ts`/`scriptureSplitter.ts` behavior, and the validation-location correction is derived from directly reading `functions/src/index.ts` in full
- Pitfalls: HIGH for API-shape pitfalls (verified against SDK types and docs); MEDIUM for the clause-boundary judgment call (A3) and split-quality determinism (A2), both explicitly flagged as needing empirical/manual confirmation

**Research date:** 2026-08-03
**Valid until:** 2026-08-17 (14 days — this domain includes a fast-moving SDK with near-weekly releases; re-verify `output_config`/`messages.parse()` shape if planning is delayed past this window)
