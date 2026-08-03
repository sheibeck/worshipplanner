# Phase 34: Smarter Content — LLM Scripture Split - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey areas proposed with recommendations and auto-accepted under
the STATE.md standing autonomy grant of 2026-07-30. Accepted answers are Claude's recommendations, not
owner statements — reversible defaults.

<domain>
## Phase Boundary

A scripture item can be split into a leader/congregation responsive reading **by the model**, with
scripture correctness *structurally* guaranteed: the model returns only index ranges and speaker
labels into already-fetched ESV text, never scripture words. Requirement: **R064** (single-requirement
phase).

**In scope:** the `@anthropic-ai/sdk` upgrade; the split call and its strict schema; byte-match
validation of every returned offset against the source; clause/verse boundary enforcement; the
non-blocking failure path; wiring the assist into the existing congregational editor.

**Out of scope:** any change to how ESV text is fetched or cached; the presentation/rendering of a
congregational reading (Phase 35 owns presentation correctness); any second AI feature.

</domain>

<decisions>
## Implementation Decisions

### ★★ A FALSE ROADMAP PREMISE — congregational reading ALREADY EXISTS

**Success criterion 1 — "A scripture item can be split into a leader/congregation congregational
reading" — is already true today, manually.** Verified against live source 2026-08-03:

| Already shipped | Where |
|---|---|
| `CongregationalSection { speaker: 'LEADER' \| 'CONGREGATION'; text: string; verseRange?: string }` | `src/types/slide.ts:70-74` |
| `ScriptureSlide.readingMode: 'normal' \| 'congregational'` + `sections?: CongregationalSection[]` | `src/types/slide.ts:83-84` |
| `readingMode?: 'normal' \| 'congregational'` on the slot | `src/types/service.ts:67` |
| `ScriptureReading` with `congregationalSections?` | `src/types/scriptureReading.ts:10-12` |
| **A working manual editor** (321 lines, reference input + ESV fetch) | `src/components/CongregationalEditor.vue` |

**⚠ CORRECTED 2026-08-03 BY PLANNING — the sentence below overstated it.** `CongregationalEditor.vue`
is mounted **nowhere**: no route, no parent component, no dynamic import outside its own test. The
editor *works when mounted*, but **no user can reach it**, so success criterion 1 is **not** already
true — the model and the editor exist; the path to them does not. Mounting it is blocked on a
data-model question that is the **owner's call**: the editor persists `congregationalSections` to a
separate `ScriptureReading` document, while **R047's delivered shape made the SCRIPTURE slot the
source of truth and explicitly rejected linking a reading document to the slot** (`3da5fe4`
superseded by `5c531b1`). `ScriptureSlot` has `readingMode` but no `congregationalSections`, so
sections written today reach no slide. Resolving it means either re-linking the rejected document
model, or moving `congregationalSections` onto the slot and through `slideGroupMaterializer`.
Recorded as an open human-check in `.planning/PENDING-VERIFICATION.md` — **never self-approve it.**

**All of R064's substance — the boundary contract, the schema, the validator, the call shape, the
failure path — is correct and complete under either outcome**, which is why the phase is planned and
built in full rather than blocked.

**Therefore this phase does NOT build congregational reading. It adds an LLM-assisted split on top of
a capability that already exists in the model layer and has a working (if currently unreachable)
manual editor.** That is a materially smaller and differently-shaped phase
than the ROADMAP's success criteria imply, and the plan must say so rather than re-implementing the
model. This is the same class of finding as Phase 27's two false premises and Phase 33's stale
wireframes — record it, don't work around it silently.

**The manual path must survive.** The AI is additive and never blocking (R064's own words); a user
must still be able to build a responsive reading by hand exactly as they can today.

### The Correctness Guarantee — the point of the whole phase

- **The model returns ONLY structural data: index ranges + speaker labels.** It never returns
  scripture words. This is what makes altered or hallucinated scripture *structurally impossible*
  rather than prompt-discouraged, and it is R064's core claim. Any design where the model emits text
  defeats the requirement, no matter how good the prompt.
- **`CongregationalSection.text` is a `string` of actual words** (`src/types/slide.ts:72`) — so there
  IS a conversion step. The section text must be **sliced from the already-fetched ESV source** using
  the model's offsets. Slicing is the only permitted way to populate it.
- **Every returned offset must byte-match the source, and a failure is HARD.** The ROADMAP is explicit:
  *"treat any offset that fails to byte-match the source as a hard validation failure with fallback,
  never a silent near-match."* No fuzzy matching, no normalization to make an offset "close enough."
- **★ The schema CANNOT enforce the bounds.** Structured outputs' JSON Schema subset does **not**
  support numerical constraints (`minimum`, `maximum`, `multipleOf`) or string-length constraints —
  confirmed from the `claude-api` skill. So "indices are within the passage" must be an **explicit
  client-side check**, not a schema guarantee. Do not assume `strict: true` covers it; it covers
  *shape*, not *range*. This is the single most likely way to build something that looks correct and
  is not.
- **Validation lives at the Cloud Function proxy choke point** (`functions/src/index.ts` — the single
  existing egress for `anthropic`), per the ROADMAP.

### ★★ CORRECTED 2026-08-03 BY RESEARCH — two more false premises, both in R064 itself

Research verified both of these against live artifacts, not docs. **They supersede what this section
originally said, and they change the plan.**

**1. The SDK upgrade is NOT a blocking prerequisite — R064's own text is wrong.** R064 states the
`^0.78.0` pin *"predates the structured-outputs support this depends on."* It does not. The researcher
extracted the actually-installed `@anthropic-ai/sdk@0.78.0` tarball and read its `.d.ts` files
directly: `output_config.format` (`JSONOutputFormat`), `client.messages.parse()`, and the
`jsonSchemaOutputFormat` helper are **all already present and non-beta**. Structured outputs went GA in
SDK **0.72.0** (2026-01-29) — three weeks *before* 0.78.0 shipped. An upgrade is reasonable hygiene;
it is **not** a prerequisite and must not be scheduled as a blocking first task.
*Bonus:* `jsonSchemaOutputFormat` needs no `zod` (this project has none) because `json-schema-to-ts`
is a normal dependency of the SDK, not a peer dependency.

**2. Validation CANNOT live at the Cloud Function proxy.** The ROADMAP says to validate *"at the
existing single Cloud Function proxy choke point."* That is unimplementable as written:
`functions/src/index.ts` is a **generic byte-blind pass-through** (`fetch` + forward), has no
`@anthropic-ai/sdk` dependency, and — decisively — **never sees the ESV source text**, which the
browser fetches separately. A proxy that cannot see the source cannot byte-match against it.
**Validation stays client-side in `src/utils/claudeApi.ts`**, matching the existing
`suggestSongs`/`suggestScripture` pattern.

**A better contract than R064 asks for.** Research designed **boundary indices, not raw character
offsets**: pre-compute the legal split positions from the untouched ESV text, and constrain the
model's schema to integer indices *into that array*. This makes byte-match a trivial bounds check and
makes **mid-sentence splits structurally unrepresentable** rather than merely validated-against —
strictly stronger than R064's requirement. Prefer it.

### The SDK Upgrade — hygiene, not a prerequisite (see the correction above)

- **`@anthropic-ai/sdk` is pinned at `^0.78.0`** (`package.json:20`), which **already supports
  structured outputs**. Upgrading is optional cleanliness, not a gate.
- **Use `output_config: { format: { type: 'json_schema', schema } }`.** The top-level `output_format`
  parameter is deprecated API-wide. For a TypeScript project the ergonomic path is
  `client.messages.parse()` with `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`.
- **Verify the upgrade does not break the two existing call sites** — `suggestSongs` and
  `suggestScripture` in `src/utils/claudeApi.ts` (~`:227` and `:303`), both of which currently parse
  JSON out of prose with `max_tokens: 512`. Do NOT opportunistically migrate them to structured
  outputs in this phase; that is a separate improvement and would widen the blast radius of the
  upgrade. Confirm they still work, and note the opportunity.

### Model Choice

- **Haiku-tier — `claude-haiku-4-5`**, per the ROADMAP's explicit note (*"Haiku-tier, consistent with
  the app's existing cost-efficient-model precedent"*). Recorded here because Claude's own default is
  Opus and it does not downgrade for cost on its own initiative: **this is an owner-recorded project
  decision, not a silent cost downgrade.** Haiku 4.5 does support structured outputs.
- **The app already pins the dated ID `claude-haiku-4-5-20251001`** at both existing call sites. Match
  that convention rather than introducing the bare alias alongside it — consistency beats correctness
  of style here, and a mixed convention is a future trap.
- **★ Haiku 4.5 is a pre-4.6-family model.** It uses `thinking: { type: 'enabled', budget_tokens: N }`,
  and **`effort` ERRORS on it**. Do not carry 4.6+/5-family parameters (`effort`, adaptive thinking)
  onto this call. Thinking is very likely unnecessary for a structural split at all.

### Failure Behavior (success criterion 4)

- **A failed split never blocks editing.** If the call fails, times out, returns an invalid shape, or
  fails byte-match validation, the scripture slide still renders and stays usable, and the user falls
  back to the existing manual editor.
- **Surface the failure honestly** — a user who asked for a split and got nothing must be told, not
  left to wonder. Reuse Phase 32's toast (`useToasts`) for the failure rather than inventing a
  surface; that is exactly the R041 pattern.
- **Never partially apply a split.** If any section fails validation, discard the whole result. A
  half-applied reading with one wrong range is worse than no reading.

### Claude's Discretion

- Exact schema shape for the returned ranges (character offsets vs verse+offset pairs) — resolve
  during research against what actually makes byte-match validation simplest and least ambiguous.
- Prompt wording, and whether a one-shot example helps boundary quality.
- Where the "split this for me" affordance lives inside `CongregationalEditor.vue`.
- Whether to send the passage as plain text or with verse markers.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/components/CongregationalEditor.vue`** (321 lines) — the existing manual editor. Has
  `data-testid="reference-input"` and `data-testid="fetch-btn"`, an ESV fetch path, and (as of Phase 32)
  a `SaveStatusIndicator` in its header. This is where the assist belongs.
- **`src/utils/claudeApi.ts`** — the existing client, lazy singleton, two call sites, both
  `claude-haiku-4-5-20251001` / `max_tokens: 512`, both parsing JSON out of prose today.
- **`src/utils/esvApi.ts`** — the already-fetched-text source. The split operates on its output.
- **`src/stores/toasts.ts` / `useToasts`** — Phase 32's failure surface (R041).

### Established Patterns
- Vue 3 `<script setup>`, Pinia, Tailwind, `data-testid`, Vitest + `@vue/test-utils` with real Pinia
  (`setActivePinia(createPinia())`) and `enableAutoUnmount(afterEach)` — both load-bearing since Phase 32/33.

### Integration Points
- **`functions/src/index.ts`** — the single Claude egress proxy. `SECRET_INJECTED` covers `anthropic`
  and `esv`; `anthropic-version` defaults to `2023-06-01`. **Validation belongs here.**
- **`package.json:20`** — the `^0.78.0` pin to upgrade.
- **`src/types/slide.ts:70-84`** — `CongregationalSection` and `ScriptureSlide`; already correct, so
  the phase should need **no model change at all**. If planning concludes a model change is needed,
  that is a signal to re-check the premise, not to change the model.

</code_context>

<specifics>
## Specific Ideas

- The ROADMAP's research flag is unusually specific and should be honoured: *"re-verify the current
  `@anthropic-ai/sdk` version and `output_config.format` call shape at implementation time (consult the
  `claude-api` skill again, details may have drifted); validate Haiku split determinism empirically
  against real passages."* The skill was consulted on 2026-08-03 and its findings are recorded above.
  **The empirical determinism check has NOT been done** and is a real research task — a split that
  varies run-to-run on the same passage is a usability problem even when every offset validates.
- Good test passages for the determinism check: Psalm 136 (the archetypal responsive reading, with a
  repeated congregational refrain) and Psalm 24, which has a natural call-and-response shape.

</specifics>

<deferred>
## Deferred Ideas

- **Migrating `suggestSongs` / `suggestScripture` to structured outputs.** Both would benefit — they
  currently parse JSON out of prose and instruct the model "no markdown, no code fences" — but doing
  it here widens the SDK upgrade's blast radius. Worth a follow-up.
- **Any second AI feature** (auto-summarizing a passage, suggesting a reading based on the sermon).
  R064 is one requirement; this phase delivers one capability.
- **Presentation of the responsive reading** — how LEADER vs CONGREGATION renders on a projected
  slide. Phase 35 owns presentation correctness.
- **Caching split results.** Not requested, and a cache would need invalidating whenever the passage
  or translation changes.

</deferred>
