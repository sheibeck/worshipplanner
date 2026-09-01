---
phase: 103-manual-fallback-when-bible-api-is-off
verified: 2026-08-31T22:30:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_uat_deferred: true
re_verification: false
---

# Phase 103: Manual Fallback When Bible API Is Off — Verification Report

**Phase Goal:** An organization with Bible API disabled has a fully functional, zero-cost path for
scripture selection and congregational readings — a BibleGateway deep-link plus manual paste-in — so
being OFF never breaks the workflow.
**Verified:** 2026-08-31 (post code-review-fix, commits `449a1ae2`..`c66a7d5c`)
**Status:** passed — with visual/browser UAT explicitly deferred to the end-of-milestone batched human
round, per this milestone's stated verification policy. All four ROADMAP success criteria are backed by
passing behavioral (not just presence) tests against the real committed code; no gap requires closure
before shipping.
**Re-verification:** No — initial verification, run after the phase's own code-review + fix cycle
(103-REVIEW.md → 103-REVIEW-FIX.md) was already committed.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When disabled, scripture/congregational UI offers an "Open in BibleGateway" deep-link for the entered reference, any version, reusing the existing link builder (R298) | ✓ VERIFIED | `bibleGatewayLink(ref, version?)` added to `src/utils/scripture.ts:120-124`, delegates to `formatScriptureReference`, `encodeURIComponent`s both reference and version, omits `&version=` when absent — 5 passing unit tests in `scripture.test.ts`. Rendered in both `ScriptureInput.vue:160-171` and `CongregationalEditor.vue:29-40` as a single `target="_blank" rel="noopener"` anchor; `npx vitest run` on both component suites confirms the anchor's href contains `biblegateway.com/passage`, the encoded reference, and `version=`. |
| 2 | When disabled, a user can paste passage text and it becomes the slide/reading content, any version (R299) | ✓ VERIFIED | `ScriptureInput.vue`: paste textarea is `v-model="previewText"`, the exact ref the preview panel renders — test "pasting text into the paste textarea populates the same preview panel the fetched text used" passes. `CongregationalEditor.vue`: `onPasteInput` writes `stripVerseMarkers(pasted)` into `rawPassage` and seeds `text` (`Leader\n<stripped>`), and a subsequent Save emits real parsed sections — test "pasting passage text populates rawPassage + the textarea, and a subsequent Save emits sections parsed from it" passes. |
| 3 | The LLM congregational split still runs on manually pasted text when Bible API is off, subject to the independent AI gate (R299) | ✓ VERIFIED (behavior-dependent — proven, not just present) | `CongregationalEditor.vue`'s "Split with AI" button is gated ONLY on `authStore.isAiEnabled` (line 99) — no `isBibleApiEnabled` condition was added anywhere near it or `onAiSplit`. Two opposing behavioral tests pass: `INDEPENDENCE: Bible off + AI on` (paste → click Split with AI → `splitCongregationalReading` is called with the pasted text and the textarea shows the real split result) and `INDEPENDENCE: Bible off + AI off` (no split button renders; paste still populates the reading). |
| 4 | When disabled for an org, the "Bible Translation" selector is hidden in Settings (R300) | ✓ VERIFIED | `SettingsView.vue:319` — `v-if="authStore.isBibleApiEnabled"` on the card's root div, mirroring the AI Features card gate exactly (line 260). `bibleVersionInput`/`onChangeBibleVersion`/save path untouched. New `describe('SettingsView Bible Translation card visibility (R300)')` block (2 tests) + all 9 pre-existing R090 Bible Translation tests pass with `mockBibleApiEnabled` reset in every `beforeEach`. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

**Note on behavior-dependence:** Truth 3 (and the two data-loss invariants below) are exactly the kind of
state-transition/no-clobber invariants that symbol presence cannot prove. This phase went through its own
code-review cycle (103-REVIEW.md) that found two real, reproduced BLOCKER data-loss bugs in these
invariants (CR-01, CR-02) — and the fix commits (`4c4e2ad1`, `711cf38b`) added dedicated regression tests
that this verification re-ran independently and confirmed passing:

| Invariant | Test | Result |
|---|---|---|
| Pasted `ScriptureInput` text survives a reference-field edit (CR-01) | `CR-01: pasted fallback text is never silently erased` × 3 | PASS |
| "Preview passage" button is hidden (not just a no-op) when API is off (CR-01) | `does not render the "Preview passage" button when the API is off` | PASS |
| Pasted `CongregationalEditor` text does NOT clobber an AI split or a manual edit on the next paste keystroke (CR-02) | `CR-02: editing the paste box after an AI split does NOT discard the split`, `...after a manual edit does NOT discard the manual edit` | PASS |
| Ordinary successive paste keystrokes still re-seed normally (CR-02 regression guard) | `CR-02: successive paste-box keystrokes keep re-seeding...` | PASS |
| Only one "open externally" link renders when off (WR-01) | `renders only ONE "open externally" link when the Bible API is off` | PASS |
| Pasted "any version" text is not falsely stamped with the org's stored version (WR-02) | `WR-02: Save on a purely-pasted reading does not stamp the org-default translationSource` | PASS |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/utils/scripture.ts` | `bibleGatewayLink` deep-link builder | ✓ VERIFIED | Exported, delegates to `formatScriptureReference`, encodes ref+version, omits param when absent (lines 106-124) |
| `src/utils/__tests__/scripture.test.ts` | Unit tests for the builder | ✓ VERIFIED | `describe('bibleGatewayLink')`, 5 cases, all pass |
| `src/views/SettingsView.vue` | Bible Translation card gated on `isBibleApiEnabled` | ✓ VERIFIED | `v-if="authStore.isBibleApiEnabled"` on card root div (line 319); ESV/NLT radios and save logic untouched |
| `src/views/__tests__/SettingsView.test.ts` | Visibility tests | ✓ VERIFIED | New R300 describe block (2 tests) + 9 pre-existing R090 tests all pass |
| `src/components/ScriptureInput.vue` | Disabled-branch fallback UI | ✓ VERIFIED | Intro copy, deep-link anchor, paste textarea, all four CR-01/WR-01 guards present |
| `src/components/__tests__/ScriptureInput.test.ts` | Fallback + regression tests | ✓ VERIFIED | New `describe('Manual fallback when Bible API is off (103-02, R298/R299)')` block + nested `CR-01` block, all pass |
| `src/components/CongregationalEditor.vue` | Disabled-branch fallback UI, AI-gate independence | ✓ VERIFIED | Intro copy, deep-link anchor, paste textarea with `lastPasteSeed` no-clobber guard, split button unmodified |
| `src/components/__tests__/CongregationalEditor.test.ts` | Fallback + independence + CR-02/WR-02 regression tests | ✓ VERIFIED | All new tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `SettingsView.vue` Bible Translation card | `authStore.isBibleApiEnabled` | `v-if` | WIRED | Mirrors `authStore.aiMasterEnabled` gate pattern exactly |
| `bibleGatewayLink` | `formatScriptureReference` | direct call | WIRED | Single canonical formatter, no re-derivation |
| `ScriptureInput.vue` fallback anchor | `scripture.ts::bibleGatewayLink` | `fallbackBibleGatewayLink` computed | WIRED | Uses `currentRef` + `effectiveVersion` (same values driving the rest of the component) |
| `CongregationalEditor.vue` fallback anchor | `scripture.ts::bibleGatewayLink` | `fallbackBibleGatewayLink` computed | WIRED | Uses `props.reference` + `props.bibleVersion ?? authStore.settings.bibleVersion`, matching `autoFetch`'s version resolution |
| `CongregationalEditor.vue` paste path | `onAiSplit` → `splitCongregationalReading` | shared `rawPassage`/`text`/`hasPassageToSplit` state | WIRED, gate-independent | Confirmed by both INDEPENDENCE tests (Bible off + AI on splits; Bible off + AI off shows no button) |
| `ScriptureInput.vue` paste textarea | preview panel | `v-model="previewText"` (shared ref) | WIRED | Same ref the fetched-preview path renders; CR-01 fixes prevent it from being wiped by unrelated interactions |

### Data-Flow Trace

Both editors' pasted content flows through real, unmocked reactive state (not hardcoded/static): the
paste textarea's `v-model`/`@input` writes directly into the same ref/computed chain the fetched-text
path already used (`previewText` in `ScriptureInput.vue`; `rawPassage`/`text` in
`CongregationalEditor.vue`), and `onSave`/`onAiSplit` consume that same state — proven end-to-end by the
paste→Save and paste→Split tests above, not by inspection alone.

### Behavioral Spot-Checks / Automated Gate Re-Run

Independently re-run by this verification (not taken from SUMMARY.md claims):

| Check | Command | Result | Status |
|---|---|---|---|
| Type-check | `npm run type-check` (`vue-tsc --build`) | 0 errors | ✓ PASS |
| Full app suite | `npx vitest run` | 175/177 files, 4802/4829 tests passed, 26 skipped | ✓ PASS (matches documented baseline exactly) |
| Baseline-only failures | — | `src/storage.rules.test.ts` (Storage-emulator cross-service limitation, documented pre-existing defect) + `src/stores/appConfig.test.ts` (pre-existing dot-path payload assertion mismatch) | ✓ Confirmed NOT phase-103 regressions |
| Targeted phase-103 files | `npx vitest run src/utils/__tests__/scripture.test.ts src/views/__tests__/SettingsView.test.ts src/components/__tests__/ScriptureInput.test.ts src/components/__tests__/CongregationalEditor.test.ts` | 4 files, 204/204 tests passed | ✓ PASS |
| Git working tree | `git status --short` | clean, all phase-103 + review-fix commits present (`449a1ae2`..`c66a7d5c`) | ✓ PASS |

No probes apply to this phase (client-only Vue components; no `scripts/*/tests/probe-*.sh` declared or
conventional to this project).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| R298 | 103-01, 103-02 | BibleGateway deep-link, any version | ✓ SATISFIED | `bibleGatewayLink` + wired anchors in both editors, tested |
| R299 | 103-02 | Paste becomes content; LLM split still runs, AI-gate independent | ✓ SATISFIED | Paste→content wiring + INDEPENDENCE tests, both editors |
| R300 | 103-01 | Settings Bible Translation selector hidden when off | ✓ SATISFIED | `v-if="authStore.isBibleApiEnabled"` + visibility tests |

No orphaned requirements — REQUIREMENTS.md traceability table maps R298/R299/R300 to Phase 103 exactly as
declared in both plans' frontmatter.

### Anti-Patterns Found

None. Grepped all four modified source files (`scripture.ts`, `SettingsView.vue`, `ScriptureInput.vue`,
`CongregationalEditor.vue`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` —
zero matches. No stub returns, no hardcoded-empty props feeding the new UI, no `v-html` (pasted text is
bound via `v-model`/`{{ }}` interpolation only, per the phase's own threat-model mitigation T-103-03).

The one deliberately-skipped review finding, **WR-03** (near-verbatim fallback-block duplication across
the two editors), is a maintainability note, not a correctness defect — both blocks are independently
correct and independently tested. Recorded as an accepted, explicitly-reasoned deferral in
103-REVIEW-FIX.md, not a silent gap.

## Human Verification — Deferred to End-of-Milestone Batch (per stated policy)

Per this verification's instructions, browser/visual UAT for this phase is explicitly deferred to a
batched end-of-milestone round rather than run here. The following are the concrete checks for that
round; they are **advisory, not blocking** — every code-level truth they would confirm is already proven
by the passing component tests above.

### 1. BibleGateway deep-link opens the correct passage
**Test:** With an org that has Bible API off, enter a scripture reference (e.g. "Romans 8:1-11") in
either `ScriptureInput` or `CongregationalEditor`, click "Open in BibleGateway".
**Expected:** A new tab opens to BibleGateway showing Romans 8:1-11 in the org's configured version (or
BibleGateway's default if none is set).
**Why human:** Confirms the actual external site renders correctly for a live, human-readable URL —
component tests only assert the constructed `href` string, not that BibleGateway itself resolves it as
expected.

### 2. Paste-in becomes real slide/reading content
**Test:** With Bible API off, paste real passage text copied from BibleGateway into both editors; save a
service and view the resulting slide/reading in the presentation preview.
**Expected:** The exact pasted text appears on the projected slide/congregational reading, matching what
would have appeared via the auto-fetch path when enabled.
**Why human:** Confirms the visual rendering downstream of the tested state (slide typography, line
wrapping, projector output), which is outside this phase's component-test boundary.

### 3. Congregational split with AI on, Bible off
**Test:** With Bible API off and AI on, paste a multi-verse passage into `CongregationalEditor`, click
"Split with AI", visually inspect the resulting Leader/Congregation split for reasonableness.
**Expected:** A sensible, alternating Leader/Congregation reading appears, matching the quality of splits
seen when Bible API is on.
**Why human:** Split quality is an AI-judgment call the mocked-`splitCongregationalReading` unit tests
cannot evaluate — only that the call happens and the result is placed correctly.

### 4. Settings card hide/show round-trips visually
**Test:** Toggle an org's Bible API on/off from the Owner Console, then load that org's Settings page.
**Expected:** The "Bible Translation" card disappears/reappears with its prior ESV/NLT selection intact
when re-shown.
**Why human:** End-to-end round trip through the real Owner Console toggle + real Firestore read, not
just the mocked `authStore` computed the component tests exercise.

## Gaps Summary

None. All four ROADMAP success criteria (and R298/R299/R300) are verified against the actual committed,
post-review-fix code — not SUMMARY.md claims — with passing behavioral tests for every state-transition
invariant the phase's own code review flagged as a data-loss risk. The single independently-re-run gate
result (`npx vitest run`: 175/177 files, 4802/4829 tests, only the two pre-existing documented baseline
failures) matches the fix report's own claim exactly, with no new regressions. The only outstanding item
is browser-based visual UAT, explicitly deferred per this milestone's stated verification policy — not a
gap in the code.

---

_Verified: 2026-08-31_
_Verifier: Claude (gsd-verifier)_
