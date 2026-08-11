---
phase: 45-esv-nlt-bible-version-selection
plan: 04
subsystem: scripture
tags: [vue, vitest, scripture, esv, nlt, attribution, translation-provenance]

# Dependency graph
requires:
  - "src/utils/nltApi.ts: fetchNltPassageText(query) (45-01)"
  - "authStore.settings.bibleVersion: 'ESV' | 'NLT' (45-02)"
  - "src/types/slide.ts: translationSource? on ScriptureSlide/CongregationalSection + src/utils/scripture.ts: scriptureAttribution()/resolveTranslationSource() (45-03)"
provides:
  - "CongregationalEditor.vue: onFetchPassage() routes esvApi/nltApi by authStore.settings.bibleVersion, captured once at fetch time into a local + lastFetchedVersion ref; all three seeding routes (alternating-assignment, AI-split) stamp translationSource from that captured value, never a live re-read"
  - "ScriptureInput.vue: fetchPassageByOrgSetting(query) shared helper routes both preview call sites (fetchPreview, togglePreview's AI-suggestion preview) by the same setting — preview-only, no stamping/persistence"
  - "PresentationViewer.vue: scriptureAttributionSuffix(text, slide) helper appends the shared (ESV)/(NLT) suffix to both presentation-body and presentation-congregational-section paragraphs"
  - "slideDisplay.ts::slideBodyText(): scripture case appends the same suffix when slide.text is non-empty"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stamp-once-at-fetch: a version captured into a local const/ref at the single fetch call site, threaded into every value that call site produces, never re-read from the live setting downstream (extends 45-03's field-less-fallback pattern to the write side)"
    - "One shared render-time helper (scriptureAttributionSuffix in PresentationViewer.vue, mirroring slideDisplay.ts's inline use of the same scripture.ts helpers) consumed by both DOM sites so no second '(${version})' string exists anywhere"

key-files:
  created: []
  modified:
    - src/components/CongregationalEditor.vue
    - src/components/__tests__/CongregationalEditor.test.ts
    - src/components/ScriptureInput.vue
    - src/components/__tests__/ScriptureInput.test.ts
    - src/components/PresentationViewer.vue
    - src/components/__tests__/PresentationViewer.test.ts
    - src/components/slides/slideDisplay.ts
    - src/components/slides/__tests__/slideDisplay.test.ts
    - .planning/PENDING-VERIFICATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "AI-split-produced sections are stamped from lastFetchedVersion (captured at the ORIGINAL fetch that produced rawText), not a fresh read of authStore.settings.bibleVersion at split time — because onAiSplit transforms already-fetched text rather than re-fetching, and the church's setting could have changed in between. Verified with a dedicated test that flips the setting between fetch and split-click."
  - "ScriptureInput.vue routes BOTH preview fetch call sites (the reference-preview panel's fetchPreview() AND the AI-suggestion expanded preview in togglePreview()) through one shared fetchPassageByOrgSetting() helper — the plan's prose named 'the preview fetch' singular, but leaving the second call site ESV-only while the church has chosen NLT would be an inconsistent, silently-wrong preview (Rule 2: missing critical functionality for correctness/consistency)."
  - "PresentationViewer.vue's suffix logic lives in one exported-from-script helper function (scriptureAttributionSuffix), not inlined twice in the template — mirrors the plan's 'one shared helper, two consumers' instruction one level up from scripture.ts's own helpers, since the template needs the empty-text guard applied identically at both sites."
  - "A pre-existing test-harness race was discovered (not introduced by this plan): the real Pinia auth store registers a Firebase onAuthStateChanged listener at store setup that resets settings.value to DEFAULT_ORG_SETTINGS on a microtask shortly after store creation. Tests that mutate authStore.settings synchronously before/at mount and read the mutation back across an async gap (multiple await ticks) can lose the mutation to this reset. Fixed by mutating the setting only after an initial `await flushPromises()` post-mount in CongregationalEditor.test.ts's new routing tests; documented inline so a future test author doesn't rediscover it via a flaky failure."

requirements-completed: [R091, R092]

coverage:
  - id: D1
    description: "CongregationalEditor.vue routes esvApi/nltApi by authStore.settings.bibleVersion at fetch time; all three seeding routes (alternating, AI-split) stamp translationSource once; a post-fetch setting change never restamps; NLT failure surfaces the same fetchError contract"
    requirement: "R090, R092"
    verification:
      - kind: unit
        ref: "src/components/__tests__/CongregationalEditor.test.ts — 'ESV/NLT routing + translationSource stamping (45-04)' (7 tests) + updated AI-split assertion"
        status: pass
    human_judgment: false
  - id: D2
    description: "ScriptureInput.vue preview fetch (both call sites) routes by the church setting, no stamping/persistence, shared failure contract preserved"
    requirement: "R090"
    verification:
      - kind: unit
        ref: "src/components/__tests__/ScriptureInput.test.ts — 'ESV/NLT preview routing (45-04, R090)' (4 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PresentationViewer.vue appends the shared (ESV)/(NLT) suffix to both the normal-mode and congregational-mode scripture paragraphs, per-section (not per-reading), omits it for reference-only slides, and never relies on the live org setting; slideBodyText() does the same"
    requirement: "R091, R092"
    verification:
      - kind: unit
        ref: "src/components/__tests__/PresentationViewer.test.ts — 'scripture attribution suffix (45-04, R091/R092)' (6 tests) + updated pre-existing exact-match assertions; src/components/slides/__tests__/slideDisplay.test.ts — updated scripture-case tests + new NLT/field-less cases"
        status: pass
    human_judgment: false
  - id: D4
    description: "Attribution/provenance driven by resolveTranslationSource(slide) only — never authStore/OrgSettings — text interpolation only, no v-html"
    verification:
      - kind: unit
        ref: "PresentationViewer.test.ts 'v-html' test (asserts no executed <b> markup) + field-less->(ESV) tests across both render sites"
        status: pass
    human_judgment: false
  - id: D5
    description: "Overflow backstop at 48px display size (45-UI-SPEC.md) and the full post-deploy live round trip"
    verification: []
    human_judgment: true
    rationale: "jsdom cannot prove visual clipping or a real deployed NLT fetch — recorded as deferred owner human-verify items in PENDING-VERIFICATION.md § Phase 45, non-blocking per the standing v1.5 grant"

# Metrics
duration: ~50min
completed: 2026-08-08
status: complete
---

# Phase 45 Plan 04: Consumption Wiring — Fetch Routing, Stamp-Once, Attribution Summary

**Closes R091 and R092 end to end: `CongregationalEditor.vue`/`ScriptureInput.vue` route ESV/NLT scripture fetches by the church's `bibleVersion` setting, `CongregationalEditor.vue` stamps `translationSource` exactly once at fetch time (never restamped by a later setting change or a subsequent AI split), and both scripture render sites (`PresentationViewer.vue`, `slideDisplay.ts::slideBodyText()`) append the one shared `(ESV)`/`(NLT)` attribution suffix, driven entirely by each slide's own resolved provenance.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-08
- **Tasks:** 3 (each TDD-shaped: implementation + tests together, run to green before commit)
- **Files modified:** 8 source/test files + 2 tracking docs (PENDING-VERIFICATION.md, REQUIREMENTS.md)

## Accomplishments

- **Task 1 — `CongregationalEditor.vue`:** `onFetchPassage()` captures `authStore.settings.bibleVersion` into a local `version` const at the top of the fetch, routes to `fetchNltPassageText` (NLT) or `fetchPassageText` (ESV, unchanged import), and stamps that captured value onto every `CongregationalSection` `buildAlternatingSections()` produces. A new `lastFetchedVersion` ref records the same captured value so `onAiSplit()` — which transforms the already-fetched `rawText` rather than re-fetching — stamps its AI-split-produced sections from that captured value too, never from a fresh read of the live setting. `ScriptureSlideEditor.vue` (dead code) untouched. 7 new tests plus one updated pre-existing AI-split assertion; 38/38 tests pass.
- **Task 2 — `ScriptureInput.vue`:** a new shared `fetchPassageByOrgSetting(query)` helper routes to the correct client by the same setting, used by BOTH the reference-preview panel (`fetchPreview()`) and the AI-suggestion expanded preview (`togglePreview()`) — no stamping, nothing persisted, matching the plan's "preview only" framing while keeping both preview surfaces consistent with the church's actual choice. 4 new tests; 32/32 pass.
- **Task 3 — Attribution at both render sites:** `PresentationViewer.vue` gained a `scriptureAttributionSuffix(text, slide)` helper consumed by both the `presentation-body` (normal-mode) and `presentation-congregational-section` (congregational-mode) paragraphs; `slideDisplay.ts::slideBodyText()`'s scripture case appends the same `scriptureAttribution(resolveTranslationSource(slide))` pattern when `slide.text` is non-empty. Both sites correctly omit the suffix for a reference-only (empty-text) slide, show `(NLT)` for a stamped NLT slide, and fall back to `(ESV)` for a field-less pre-phase slide — proving no dependency on the live org setting. Text interpolation only; a dedicated test proves no markup executes even when section text contains HTML-looking characters. 6 new PresentationViewer tests + 2 new slideDisplay tests, plus updated exact-match assertions across both pre-existing suites; 92/92 and 69/69 pass respectively.

## Task Commits

1. **Task 1: CongregationalEditor.vue routing + stamp-once** — `5b7e4e0` (feat)
2. **Task 2: ScriptureInput.vue preview routing** — `740f9d6` (feat)
3. **Task 3: attribution suffix at both render sites** — `bcae76f` (feat)

## Files Created/Modified

- `src/components/CongregationalEditor.vue` — import `fetchNltPassageText`; `lastFetchedVersion` ref; `buildAlternatingSections` takes a `translationSource` param and stamps it; `onFetchPassage` captures + routes; `onAiSplit` stamps from `lastFetchedVersion`
- `src/components/__tests__/CongregationalEditor.test.ts` — `mockFetchNltPassageText` mock + default resolved value; new `ESV/NLT routing + translationSource stamping (45-04)` describe block (7 tests); updated 2 pre-existing tests (ESV-fail test now explicit-ESV, AI-split success assertion includes the stamp)
- `src/components/ScriptureInput.vue` — import `fetchNltPassageText`; new `fetchPassageByOrgSetting()` helper used by `fetchPreview()` and `togglePreview()`
- `src/components/__tests__/ScriptureInput.test.ts` — `fetchNltPassageText` mock; `mockBibleVersion` getter on the mocked auth store; `beforeEach(vi.clearAllMocks())`; new `ESV/NLT preview routing (45-04, R090)` describe block (4 tests)
- `src/components/PresentationViewer.vue` — import `scriptureAttribution`/`resolveTranslationSource`; new `scriptureAttributionSuffix()` helper; both scripture paragraphs append it
- `src/components/__tests__/PresentationViewer.test.ts` — new `scripture attribution suffix (45-04, R091/R092)` describe block (6 tests); updated 5 pre-existing exact-match text assertions to include the `(ESV)` suffix
- `src/components/slides/slideDisplay.ts` — import `scriptureAttribution`/`resolveTranslationSource`; scripture case of `slideBodyText()` appends the suffix when `slide.text` is non-empty
- `src/components/slides/__tests__/slideDisplay.test.ts` — updated 2 pre-existing scripture-case tests; added an NLT-stamped case
- `.planning/PENDING-VERIFICATION.md` — new "Plan 45-04" subsection under Phase 45: overflow-backstop check + post-deploy live round-trip check; updated 45-01's item 4 wording now that attribution has shipped
- `.planning/REQUIREMENTS.md` — R091 and R092 marked complete (checkbox + traceability table)

## Decisions Made

- **AI-split stamping source:** `lastFetchedVersion` (captured at the original fetch), not a live setting re-read at split time — proven by a test that flips the setting between fetch and split-click and asserts the split's stamped sections still carry the ORIGINAL fetch's version.
- **Both `ScriptureInput.vue` preview call sites routed**, not just the primary one — Rule 2 (missing critical functionality): leaving the AI-suggestion preview ESV-only while the church chose NLT would silently misrepresent which source that preview actually reflects.
- **One shared `scriptureAttributionSuffix()` helper in `PresentationViewer.vue`**, consumed at both DOM sites, rather than inlining the empty-text-guard + helper-call twice in the template.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test-harness race: authStore.settings resets to defaults on a microtask after mount, silently discarding a synchronous test mutation read back across an async gap**
- **Found during:** Task 1, writing the `bibleVersion=ESV routes fetch to esvApi` test — the mutation `useAuthStore().settings.bibleVersion = 'ESV'` set immediately before/after `mountEditor()` was being silently overwritten before the async click handler read it, causing the test to observe the NLT branch called instead of ESV.
- **Root cause:** `src/stores/auth.ts` registers a real Firebase `onAuthStateChanged` listener at store setup; in this jsdom test environment (no signed-in user), that listener resolves on a microtask/short delay after store creation and resets `settings.value` to `{...DEFAULT_ORG_SETTINGS}` via the same reset path `loadOrgContext` uses for a signed-out user. Pre-existing `aiEnabled` mutation tests in the same file never hit this because they read the mutated value SYNCHRONOUSLY at mount (template `v-if`), before the listener's callback has a chance to run; this plan's new tests read the setting much later, inside an async click handler reached only after several `await` ticks (`setValue`, `trigger('click')`), which gives the listener's callback time to fire first.
- **Fix:** In every new `CongregationalEditor.test.ts` test that mutates `bibleVersion` and then triggers an async fetch, the mutation now happens AFTER an initial `await flushPromises()` following mount, letting the store's own async reset settle before the test's own mutation is applied. Documented inline with a comment so a future test author does not have to rediscover this via a flaky failure.
- **Files modified:** src/components/__tests__/CongregationalEditor.test.ts
- **Verification:** All 7 new routing/stamping tests pass consistently, including when run in isolation via `-t`.
- **Committed in:** 5b7e4e0 (Task 1 commit)
- **Scope note:** This is a pre-existing property of `src/stores/auth.ts`'s setup-time `onAuthStateChanged` registration, not something this plan's production code introduced or altered — no production file was changed to work around it, only the test's mutation timing.

---

**Total deviations:** 1 auto-fixed (1 bug workaround in test code, Rule 1). No architectural changes; no scope creep beyond the plan's own file list plus the two ScriptureInput.vue preview call sites (both already existed, both use the identical `fetchPassageText` signature).

## Issues Encountered

None beyond the race condition documented above, which was fully resolved within Task 1's own test file before that task's commit.

## Verification Results

- `npx vitest run src/components/__tests__/CongregationalEditor.test.ts src/components/__tests__/ScriptureInput.test.ts src/components/__tests__/PresentationViewer.test.ts src/components/slides/__tests__/slideDisplay.test.ts` — 231/231 passing (4 files).
- `npm run type-check` (`vue-tsc --build`) — clean, 0 errors.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` (full app suite, foreground) — 2 failed files (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), both the documented pre-existing baseline — no new failing file introduced. 2862 passed, 13 skipped, 1 failed test.
- `cd functions && npm test` — 112/112 passing.

## Known Stubs

None — every task fully wires its data path; no hardcoded empty/placeholder values were introduced.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registered (T-45-41 through T-45-44, T-45-SC) — this plan's implementation directly satisfies those mitigations (resolveTranslationSource-driven attribution never reads the live setting; stamp captured once at fetch and threaded through AI-split via `lastFetchedVersion`, never re-derived; both render sites share one helper; text interpolation only, no v-html; no new dependencies).

## User Setup Required

None new from this plan specifically. The existing Phase 45 deploy-gated handoff (NLT Cloud Function secret + deploy, from Plan 45-01) is unchanged and still required before NLT fetching works in production — see `.planning/PENDING-VERIFICATION.md` § Phase 45. Two new deferred human-verify items recorded there under "Plan 45-04": the 48px overflow backstop for the attribution suffix, and the full post-deploy live round trip (fetch a real NLT passage, confirm `(NLT)` renders, confirm an existing ESV slide is unaffected by the setting flip).

## Next Phase Readiness

- Phase 45 (ESV/NLT Bible Version Selection) is now code-complete: all 4 plans (45-01 through 45-04) delivered. R090, R091 and R092 are all marked complete in `REQUIREMENTS.md`.
- The one remaining item for this phase is the owner's own deploy step (NLT Cloud Function, secret set) plus the deferred live/visual checks recorded in `PENDING-VERIFICATION.md` § Phase 45 — both non-blocking per the standing v1.5 autonomy grant.
- No blockers for the next phase in the milestone.

---
*Phase: 45-esv-nlt-bible-version-selection*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: src/components/CongregationalEditor.vue
- FOUND: src/components/__tests__/CongregationalEditor.test.ts
- FOUND: src/components/ScriptureInput.vue
- FOUND: src/components/__tests__/ScriptureInput.test.ts
- FOUND: src/components/PresentationViewer.vue
- FOUND: src/components/__tests__/PresentationViewer.test.ts
- FOUND: src/components/slides/slideDisplay.ts
- FOUND: src/components/slides/__tests__/slideDisplay.test.ts
- FOUND: .planning/PENDING-VERIFICATION.md
- FOUND: .planning/REQUIREMENTS.md
- FOUND commit: 5b7e4e0 (feat: Task 1 — CongregationalEditor routing + stamp-once)
- FOUND commit: 740f9d6 (feat: Task 2 — ScriptureInput preview routing)
- FOUND commit: bcae76f (feat: Task 3 — attribution suffix at both render sites)
