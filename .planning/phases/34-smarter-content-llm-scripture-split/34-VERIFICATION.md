---
phase: 34-smarter-content-llm-scripture-split
verified: 2026-08-03T04:30:00Z
status: gaps_found
score: 7/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "A scripture item can be split into a leader/congregation congregational reading (ROADMAP Success Criterion 1)"
    status: failed
    reason: >
      CongregationalEditor.vue — the only UI surface for both the manual editor and this phase's new
      "Split with AI" affordance — is mounted nowhere in production. Verified against live source: no
      route references it (src/router/index.ts has no scripture/congregational route), no parent
      component imports it (`grep -rn "import.*CongregationalEditor\|<CongregationalEditor" src` matches
      only its own test file), and no dynamic import exists anywhere. The split logic itself
      (computeBoundaries/SPLIT_SCHEMA/validateSplitResult/splitCongregationalReading/the AI button) is
      fully built, correctly wired internally, and passes 118/118 targeted tests — but there is no path
      by which an actual user reaches either the manual congregational-reading editor or the AI split on
      top of it. The feature exists in the codebase; it is not reachable in the product.
    artifacts:
      - path: "src/components/CongregationalEditor.vue"
        issue: "Component is complete and internally correct (manual path + AI split both work when mounted) but has zero mount points in application code — orphaned relative to the app shell."
    missing:
      - "A route or parent-component mount point for CongregationalEditor.vue (or an equivalent UI entry point reachable from the Service Order / Slides flow)."
      - "An owner decision on the persistence-shape question blocking that mount: re-link the editor's separate ScriptureReading document to the SCRIPTURE slot (the model Phase 30/R047 explicitly rejected), or add congregationalSections onto ScriptureSlot and carry it through slideGroupMaterializer (the direction R047 actually took for the plain reference). This is recorded, open, and correctly NOT self-approved as PENDING-VERIFICATION.md item 34.2."
deferred: []
human_verification:
  - test: "Run the 'Split with AI' affordance against Psalm 136 (repeated congregational refrain) and Psalm 24 (call-and-response shape), each more than once, and compare runs."
    expected: "Every returned section's text matches the ESV source exactly; no split falls mid-sentence; LEADER/CONGREGATION assignment reads as sensible (Psalm 136's refrain lands on CONGREGATION consistently); repeated runs on the same passage give a stable result. A split that validates but varies run-to-run is a usability finding, not a correctness failure — record either way."
    why_human: "No live Anthropic API access exists in this verification environment, and a mocked fixture would give false confidence about exactly the thing under test (real model determinism/quality). Already correctly recorded as open item 34.1 in .planning/PENDING-VERIFICATION.md — not self-approved, not treated as a gate on its own."
---

# Phase 34: Smarter Content — LLM Scripture Split Verification Report

**Phase Goal:** A scripture item can be split into a leader/congregation congregational reading, with
scripture correctness structurally guaranteed.
**Verified:** 2026-08-03
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | ROADMAP SC1 — A scripture item can be split into a leader/congregation congregational reading | ✗ FAILED | `CongregationalEditor.vue` is mounted nowhere in production. No route, no parent import, no dynamic import outside its own test file (confirmed by grep of `src/router/`, `src/views/`, `src/components/` for `CongregationalEditor` usage). The split machinery is real and correct, but no user can reach it. |
| 2 | ROADMAP SC2 — Displayed scripture text is always byte-identical to the ESV source; the model returns only indices/labels, never regenerated words | ✓ VERIFIED | `SPLIT_SCHEMA` (`src/utils/claudeApi.ts:370-389`) has no string-typed property anywhere except `speaker`'s closed `['LEADER','CONGREGATION']` enum, `additionalProperties:false` at both levels — asserted by a schema-walking test (`claudeApi.test.ts` `describe('SPLIT_SCHEMA')`, 4 tests). `sliceAtBoundaries` (`scriptureBoundaries.ts:111-118`) is exactly one `text.slice(...)` call, guarded by both a source-inspection test (`.toString()` regex-scan asserting no `.normalize/.trim/.replace/.toLowerCase` and exactly one `.slice(`) and a behavioral non-ASCII (curly quotes/apostrophe/em dash) round-trip+partition test with strict `===`. `splitCongregationalReading` (`claudeApi.ts:502-538`) builds section `.text` only via `stripVerseMarkers(sliceAtBoundaries(rawText, ...))` — the model's parsed response is never read for text. |
| 3 | ROADMAP SC3 — Splits fall only on clause/verse boundaries, never mid-sentence | ✓ VERIFIED | `computeBoundaries()` (`scriptureBoundaries.ts:41-53`) derives legal positions only from `[N]` verse markers and clause-ending punctuation (`.!?;:`) followed by whitespace — comma deliberately excluded. The model is shown only these positions as choosable indices (`embedBoundaryMarkers`) and `validateSplitResult` rejects any index outside `[0, boundaries.length-1]`. Because the model can only emit integers into a pre-computed legal-position array, a mid-sentence split is structurally unrepresentable, not merely discouraged. |
| 4 | ROADMAP SC4 — If the split call fails, the scripture slide still renders and remains usable; the feature never blocks editing | ✓ VERIFIED | `onAiSplit()` (`CongregationalEditor.vue:243-263`) wraps the call in try/catch; on a `null` result or a thrown error, `sections.value` is left completely untouched (only reassigned on a non-null result) and a single `useToasts` failure toast is pushed. `isSplitting` resets in `finally`. A dedicated regression test confirms the manual speaker-toggle and manual Fetch Passage flow both keep working after a failed AI split, and all 19 pre-existing manual-path tests pass byte-for-byte unmodified (verified via `git diff af027a7 8635896` — zero deletions, pure additions). |
| 5 | A passage yielding fewer than two legal boundaries cannot be split — affordance unavailable, manual path unaffected | ✓ VERIFIED | `hasSplittableBoundaries` returns `boundaries.length >= 3`; `canAiSplit` computed gates the button on it; `splitCongregationalReading` also pre-flight-refuses before any network call. Both layers tested. |
| 6 | (backstop) Source-match equality is the exact JS string with no normalization/trim/folding, including non-ASCII punctuation | ✓ VERIFIED | Confirmed with explicit evidence, not abstained: source-inspection test on `sliceAtBoundaries.toString()` plus a `NON_ASCII_FIXTURE` (curly double quotes U+201C/U+201D, curly apostrophe U+2019, em dash U+2014) round-trip and partition test using strict `===`, both present in `scriptureBoundaries.test.ts`. |
| 7 | Adjacency — section N's end equals section N+1's start; gap and overlap both rejected, not repaired | ✓ VERIFIED | Single equality check `start !== prevEnd → return null` in `validateSplitResult` (`claudeApi.ts:447`); separate rejection tests exist for gap and for overlap. |
| 8 | Ordering — sections stored in ascending boundary order; out-of-order rejected, not re-sorted | ✓ VERIFIED | Same adjacency check makes an out-of-order result non-contiguous and therefore rejected; a companion test explicitly re-sorts the same input in the *test* (not the function) and shows that sorted version would be accepted, proving no re-sort happens inside the function. |

**Score:** 7/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/utils/scriptureBoundaries.ts` | Pure boundary/slice functions | ✓ VERIFIED | Exists, substantive, exports match spec exactly, 23 tests pass. |
| `src/utils/claudeApi.ts` (Congregational Split section) | Schema, validator, call | ✓ VERIFIED | `SplitSection`, `SPLIT_SCHEMA`, `validateSplitResult`, `SPLIT_SYSTEM_PROMPT`, `splitCongregationalReading` all present, substantive, 63 tests pass in file. Pre-existing `getSongSuggestions`/`getScriptureSuggestions` byte-unchanged (confirmed via `git diff`). |
| `src/components/CongregationalEditor.vue` | AI split affordance wired into editor | ⚠️ ORPHANED (app-level) | Internally correct and fully wired to `splitCongregationalReading`/`useToasts`/`sections.value` — but the *component itself* is not imported/routed anywhere in the app outside its own test. Correct code, no reachable mount point. |
| `.planning/PENDING-VERIFICATION.md` (Phase 34 section) | Two open, non-self-approved human items | ✓ VERIFIED | Confirmed present: item 34.1 (empirical determinism, Psalm 136/24) and item 34.2 (reachability/owner data-model decision), both marked `☐` open, neither marked passed or resolved. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `computeBoundaries()` output | prompt-building (`embedBoundaryMarkers`) and `validateSplitResult`/`sliceAtBoundaries` | single local `boundaries` computed once in `splitCongregationalReading` | ✓ WIRED | `claudeApi.ts:506` computes once; the same local is passed to `embedBoundaryMarkers`, `validateSplitResult`, and every `sliceAtBoundaries` call. A boundary-identity test in `claudeApi.test.ts` proves prompt and validator agree on the same highest index. |
| `sliceAtBoundaries()` | `CongregationalSection.text` | `stripVerseMarkers(sliceAtBoundaries(...))` | ✓ WIRED | The only place `.text` is assigned in `splitCongregationalReading`; the model's `parsed_output` is read only for `speaker`/`startBoundary`/`endBoundary`. |
| `onAiSplit()` (component) | `splitCongregationalReading()` (util) | direct `await` call | ✓ WIRED | Confirmed in `CongregationalEditor.vue:247`. |
| `CongregationalEditor.vue` | application (route/parent) | — | ✗ NOT_WIRED | No route, no parent component, no dynamic import outside `CongregationalEditor.test.ts`. This is the root cause of the Truth 1 gap above. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| R064 | 34-01, 34-02, 34-03, 34-04 | Scripture item split into leader/congregation reading, structurally guaranteed, AI additive/non-blocking | ⚠️ **BLOCKED (not honestly Complete)** | `REQUIREMENTS.md` currently marks R064 `[x]` Complete (flipped by 34-04's `requirements mark-complete R064`). The *structural-correctness* half of R064 (SC2-SC4, plus the boundary/schema/validator contract) is genuinely done and well-tested. But R064's own text and ROADMAP SC1 both require that "a scripture item can be split" — that requires an end user to reach the feature, and no one can: `CongregationalEditor.vue` has zero production mount points. Marking R064 Complete overstates delivery; it should read **substantially built, not yet reachable** until the mounting/data-model decision (PENDING-VERIFICATION.md 34.2) is resolved by the owner. This is a documentation-accuracy finding, not a call to revert the requirements-tracking flip — the owner should make that call. |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file this phase modified
(`scriptureBoundaries.ts`, `claudeApi.ts`, `CongregationalEditor.vue`). No stub returns, no hardcoded
empty data flowing to render, no console-log-only handlers.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Boundary/slice/validator unit suite | `npx vitest run src/utils/__tests__/claudeApi.test.ts src/utils/__tests__/scriptureBoundaries.test.ts src/components/__tests__/CongregationalEditor.test.ts` | 3 files, 118/118 passed | ✓ PASS |
| `validateSplitResult` rejection coverage | count of `it(...)` under `describe('validateSplitResult', ...)` | 20 total (1 acceptance + 19 distinct rejection cases) | ✓ PASS — matches 34-02-SUMMARY's claim exactly |
| Pre-existing manual-path tests unmodified (P-03) | `git diff af027a7 8635896 -- src/components/__tests__/CongregationalEditor.test.ts src/components/CongregationalEditor.vue` | 279 insertions / 0 deletions across both files | ✓ PASS — confirms byte-for-byte unmodified, purely additive |
| `sliceAtBoundaries` has no normalization | manual read of `scriptureBoundaries.ts:111-118` + source-inspection test | body is exactly `return text.slice(boundaries[startBoundary], boundaries[endBoundary])` | ✓ PASS |
| `CongregationalEditor.vue` reachable from the app | `grep -rn "import.*CongregationalEditor\|<CongregationalEditor" src`, `grep CongregationalEditor src/router/index.ts` | only `CongregationalEditor.test.ts` imports it; router has no match | ✗ FAIL (confirms the Truth 1 gap) |
| `npm run type-check` | `vue-tsc --build` | clean (per gate evidence, re-confirmed by targeted test run above passing without type errors) | ✓ PASS |

### Human Verification Required (informational — not a blocking gate for this verification)

Two items are already correctly recorded as open in `.planning/PENDING-VERIFICATION.md` and were
**not** self-approved by this verification, per the standing autonomy grant's explicit carve-out
("never record a deferred check as passed"):

1. **Empirical split determinism (34.1).** Run "Split with AI" on Psalm 136 and Psalm 24, more than
   once each, and confirm byte-exact text, no mid-sentence splits, sensible LEADER/CONGREGATION
   assignment, and run-to-run stability. Cannot be checked here — no live Anthropic API access in this
   environment, and a mocked fixture would prove nothing about real model behavior.
2. **The reachability/data-model decision (34.2).** This is the same issue driving the Truth 1 FAILED
   verdict above — recorded here for completeness since PENDING-VERIFICATION.md frames it as an open
   human item, but it is promoted to a hard gap in this report because it is objectively verifiable
   from source (not a matter of judgment) and it directly falsifies ROADMAP Success Criterion 1.

### Gaps Summary

**The structural correctness guarantee that is the actual point of R064 — the reason this phase exists —
is real and well-built.** `SPLIT_SCHEMA` structurally cannot carry scripture words, `sliceAtBoundaries`
is a single unadorned `.slice()` call proven byte-exact against non-ASCII punctuation, boundaries are
computed once and threaded through prompt-building/validation/slicing without recomputation, and
`validateSplitResult` has 19 distinct rejection tests covering every failure mode enumerated in
`34-VALIDATION.md`. The AI-split affordance is wired correctly into the editor, fails safely (toast,
unchanged sections, no thrown errors), and provably does not touch the 19 pre-existing manual-path
tests.

**The one real gap is reachability, and it is exactly the gap the phase's own plans and
PENDING-VERIFICATION.md already flagged honestly.** `CongregationalEditor.vue` — the sole UI surface
for both the manual congregational-reading editor and this phase's new AI split — has no route, no
parent-component import, and no dynamic import anywhere in the application outside its own test file.
A user today cannot reach either the manual editor or the AI split, which means **ROADMAP Success
Criterion 1 ("a scripture item can be split into a leader/congregation congregational reading") is not
actually true for anyone using the product.** This is blocked on an owner-level data-model decision
(re-link the rejected `ScriptureReading` document model, or extend `ScriptureSlot` with
`congregationalSections` and thread it through `slideGroupMaterializer`) that the phase's plans were
correctly instructed not to make unilaterally.

**This looks intentional and well-documented, not sloppy.** To accept the current state (structural
guarantee complete, reachability deliberately deferred to the owner) as satisfying this phase's
verification, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "A scripture item can be split into a leader/congregation congregational reading (ROADMAP SC1)"
    reason: "CongregationalEditor.vue's non-reachability is a pre-existing condition (Phase 30/R047 left it deliberately unmounted) that this phase's plans correctly declined to resolve unilaterally, since it requires an owner decision between two data-model shapes, one of which the owner already rejected once. All of R064's structural substance (SC2-SC4) is complete and tested; only the app-shell mount point is missing."
    accepted_by: "{owner name}"
    accepted_at: "{ISO timestamp}"
```

Without that override, this verification's honest read is: **the phase built the right thing correctly,
but the feature is not yet usable by anyone**, and `REQUIREMENTS.md`'s current `[x]` Complete marking
for R064 overstates what is actually delivered until either the override is accepted or the mount point
is built.

---

*Verified: 2026-08-03*
*Verifier: Claude (gsd-verifier)*
