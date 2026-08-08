---
phase: 45-esv-nlt-bible-version-selection
verified: 2026-08-08T06:10:17Z
status: human_needed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Deploy the NLT Cloud Function branch and set the NLT_API_KEY secret (firebase functions:secrets:set NLT_API_KEY, then firebase deploy --only functions), deploying it in the SAME session as the NLT-default frontend build."
    expected: "A church set to NLT fetches a real passage through the deployed proxy, receives clean [N]-bracketed verse text, and the presented/projected slide shows the (NLT) suffix."
    why_human: "Deploy execution is owner-gated by the standing v1.5 NO-DEPLOYS autonomy grant — the phase intentionally ships the function undeployed and cannot self-verify a live round trip."
  - test: "After the deploy above, confirm an already-existing ESV-sourced slide elsewhere in the same (or another) service still shows (ESV) unchanged after the org's bibleVersion setting is flipped to NLT."
    expected: "The pre-existing slide's text and (ESV) attribution are unaffected by the setting change — R092 holds in the live app, not just in the unit suite's mocked assembler/materializer."
    why_human: "Requires a live Firestore-backed service and a real setting flip in the deployed app; the unit suite proves the invariant at the data-layer/helper level (named tests) but not end-to-end in production."
  - test: "Visually confirm the trailing (ESV)/(NLT) suffix is not clipped at 48px (text-5xl) projector display size on a long scripture passage, in both normal-mode and congregational-mode PresentationViewer paragraphs."
    expected: "The suffix remains visible, not cut off by the container edge."
    why_human: "jsdom cannot prove visual clipping/overflow; this is an explicit UI-SPEC backstop, not asserted by the unit suite."
  - test: "Visually confirm the new 'Bible Translation' Settings card matches its sibling AI/Planning Center/Vertical Worship toggle cards, and that the choice persists across a page reload."
    expected: "Consistent visual language; selection survives reload."
    why_human: "jsdom unit tests prove markup/class presence and store mutation, not rendered visual fidelity across a real reload."
---

# Phase 45: ESV/NLT Bible Version Selection Verification Report

**Phase Goal:** A church chooses its scripture source — ESV or NLT — with correct attribution everywhere scripture appears, and changing the setting never retroactively alters scripture already on a slide.
**Verified:** 2026-08-08T06:10:17Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | In Settings, a church can choose ESV or NLT as the source for scripture passages (SC1) | VERIFIED | `src/views/SettingsView.vue:295-343` renders a "Bible Translation" card with an ESV/NLT radio bound to `bibleVersionInput`, editor-gated, saving via dot-path `updateDoc({ 'settings.bibleVersion': newValue })` + store mirror-write (`onChangeBibleVersion`, lines 768-796). `OrgSettings.bibleVersion: 'ESV' \| 'NLT'` typed in `src/types/organization.ts:76`. `SettingsView.test.ts` "Bible Translation card (R090)" — 8/8 passing, confirmed by direct run. |
| 2 | A church that never opens the setting resolves to NLT (owner-locked default) through the single existing `loadOrgContext` merge | VERIFIED | `DEFAULT_ORG_SETTINGS.bibleVersion: 'NLT'` (`src/types/organization.ts:132`); no edit made to `auth.ts` — confirmed the existing `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings, ... }` spread already carries it. `auth.test.ts` "OrgSettings.bibleVersion (R090)" — 3/3 passing (absent→NLT, stored-ESV-wins, DEFAULT constant), confirmed by direct run. |
| 3 | Every scripture display/projected slide carries its translation's required attribution — "(ESV)"/"(NLT)" — built once and shared by both the scripture-slide and congregational-reading paths (SC2) | VERIFIED | Single helper `scriptureAttribution(version)` in `src/utils/scripture.ts:256-258` returns `` `(${version})` ``. Consumed at both render sites: `PresentationViewer.vue:618-619` (`scriptureAttributionSuffix`, used at lines 203 and 212 for both congregational-section and normal-mode paragraphs) and `slideDisplay.ts:204` (`slideBodyText()` scripture case). No second inline `(${version})` string found anywhere in the touched files (grep confirms only these two call sites plus the helper definition). Tests: `PresentationViewer.test.ts` "scripture attribution suffix (45-04, R091/R092)" (6 tests) + `slideDisplay.test.ts` updated/added cases — all passing. |
| 4 | A reference-only (empty-text) scripture slide shows no attribution suffix | VERIFIED | `scriptureAttributionSuffix(text, slide)` returns `''` when `text` is falsy (`PresentationViewer.vue:619`); `slideBodyText()`'s scripture case only appends when `slide.text` is non-empty (`slideDisplay.ts:199-204`). Asserted by tests in both suites. |
| 5 | Changing the translation setting never retroactively alters scripture on slides that already exist, because each slide records a per-slide translation-source field set at creation (SC3) | VERIFIED | `resolveTranslationSource(slide)` (`src/utils/scripture.ts:272-274`) returns `slide.translationSource ?? 'ESV'` and imports nothing from `authStore`/`OrgSettings` — confirmed by direct source read (no such import in `scripture.ts`). `translationSource` stamped exactly once at fetch time in `CongregationalEditor.vue` (`lastFetchedVersion` ref, lines 191-236, 273-278) and threaded pass-through (never re-derived) through `slideGroupMaterializer.ts`'s `deriveGroupEntries` and `slideshowAssembler.ts`'s `resolveEntryContent`. Two NAMED invariant tests independently re-run and passing: `slideshowAssembler.test.ts:706` (field-less assembled slide resolves to ESV, assembler never given a setting) and `slideGroupMaterializer.test.ts:475-516` (sourceSignature identical across ESV/NLT-stamped sections; a materializer rebuild never overwrites a stored translationSource and returns the stored slides reference-equal, `changed:false`). |
| 6 | A church set to NLT actually fetches scripture through the NLT source (fetch routing + working proxy) (part of SC1/SC4) | VERIFIED (routing) / DEPLOY-GATED (live proxy) | `CongregationalEditor.vue:234` and `ScriptureInput.vue:350-353` route to `fetchNltPassageText` vs `fetchPassageText` by `authStore.settings.bibleVersion`, confirmed by direct source read and by the passing `CongregationalEditor.test.ts`/`ScriptureInput.test.ts` routing suites. The NLT Cloud Function proxy branch itself (`functions/src/index.ts`) is built, unit-tested (115/115 `functions` tests passing, confirmed by direct run) and **ships intentionally undeployed** per the standing v1.5 NO-DEPLOYS grant — `git log` confirms no `firestore.rules`/`storage.rules`/deploy-config changes in this phase. A live round trip cannot be verified until the owner deploys; routed to human verification below. |
| 7 | The NLT proxy is built and tested against a real sample fetched with the owner's key, ships undeployed, with the exact deploy command handed to the owner (SC4) | VERIFIED | `.planning/phases/45-esv-nlt-bible-version-selection/45-RESEARCH.md` documents a live fetch against `https://api.nlt.to/api/passages` using the owner's real `NLT_API_KEY` during the research session (6 fetches: single verse, multi-verse, Beatitudes, Psalm 23, two auth-probes) — confirmed by direct read. `src/utils/__tests__/nltApi.test.ts`'s fixtures are drawn from those verified real (redacted) shapes, not invented HTML. `.planning/PENDING-VERIFICATION.md` § "Phase 45" carries the exact owner commands (`firebase functions:secrets:set NLT_API_KEY`, `firebase deploy --only functions`) plus the deploy-coupling warning — confirmed by direct read. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/index.ts` | NLT proxy branch: `PROXY_TARGETS.nlt`, `SECRET_INJECTED` membership, `NLT_API_KEY` secret, `buildUpstreamUrl` query-param key injection, `redactUrl` for safe error logging | VERIFIED | Confirmed present and wired via grep + read; `cd functions && npm test` 115/115 passing (re-run this session). |
| `functions/src/index.test.ts` | Coverage of `buildUpstreamUrl`, `PROXY_TARGETS`/`SECRET_INJECTED` membership, `redactUrl` | VERIFIED | Present; tests pass. |
| `src/utils/nltApi.ts` | `fetchNltPassageText` + `stripNltHtml`, DOMParser strip, `[N]` bracket reformat, dual empty-body guard | VERIFIED | Present, matches plan behavior exactly by source read; 12/12 tests passing (re-run this session, includes the WR-01 post-strip-empty fix). |
| `src/types/organization.ts` | `OrgSettings.bibleVersion` + `DEFAULT_ORG_SETTINGS.bibleVersion: 'NLT'` | VERIFIED | Confirmed by grep/read. |
| `src/views/SettingsView.vue` | Bible Translation card | VERIFIED | Confirmed by grep/read; matches sibling card pattern. |
| `src/types/slide.ts`, `src/types/slideGroup.ts` | Optional `translationSource` field on `ScriptureSlide`, `CongregationalSection`, `SourceRef`'s scripture variant | VERIFIED | Confirmed present; type-check clean. |
| `src/utils/scripture.ts` | `scriptureAttribution()`, `resolveTranslationSource()` | VERIFIED | Confirmed by read; setting-blind by construction (no authStore import). |
| `src/utils/slideGroupMaterializer.ts`, `src/utils/slideshowAssembler.ts` | Pass-through threading, no re-derivation | VERIFIED | Confirmed by read + named invariant tests passing. |
| `src/components/CongregationalEditor.vue` | Fetch routing + stamp-once | VERIFIED | Confirmed by read; 38/38 tests passing. |
| `src/components/ScriptureInput.vue` | Preview fetch routing, no stamping | VERIFIED | Confirmed by read; 32/32 tests passing. |
| `src/components/PresentationViewer.vue` | Attribution suffix at both paragraphs | VERIFIED | Confirmed by read; 92/92 tests passing. |
| `src/components/slides/slideDisplay.ts` | Attribution suffix in `slideBodyText()` | VERIFIED | Confirmed by read; 69/69 tests passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `nltApi.ts` output `[N] text` | `scriptureSplitter.ts::parseVerses` | `/\[(\d+)\]/` regex | WIRED | Contract-survival tests in `nltApi.test.ts` pass `splitPassage()` output through and assert verse-boundary-aligned slides. |
| proxy `nlt` branch | `SECRET_INJECTED` x-app-auth gate | Set membership | WIRED | `SECRET_INJECTED = new Set(["anthropic", "esv", "nlt"])` confirmed by grep; membership test passing. |
| `DEFAULT_ORG_SETTINGS.bibleVersion='NLT'` | `authStore.settings.bibleVersion` | `loadOrgContext` spread merge | WIRED | Confirmed no `auth.ts` edit was needed/made; `auth.test.ts` proves absent→NLT resolution. |
| radio `@change` | `updateDoc('settings.bibleVersion')` + mirror-write | `onChangeBibleVersion` | WIRED | Confirmed by read + passing tests (single dot-path key write, not whole-settings write). |
| `CongregationalSection.translationSource` | `SourceRef.translationSource` | `deriveGroupEntries` SCRIPTURE branch | WIRED | Confirmed by read + passing passthrough tests. |
| `SourceRef.translationSource` | `ScriptureSlide.translationSource` | `resolveEntryContent` | WIRED | Confirmed by read + assembler tests. |
| `authStore.settings.bibleVersion` | `fetchNltPassageText`/`fetchPassageText` | routing at fetch time | WIRED | Confirmed at both `CongregationalEditor.vue` and `ScriptureInput.vue` call sites. |
| `resolveTranslationSource(slide)` | `scriptureAttribution(...)` | render sites | WIRED | Confirmed at `PresentationViewer.vue` and `slideDisplay.ts`. |

### Behavioral Spot-Checks / Test Re-Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase-touched unit suite (10 files) | `npx vitest run <10 phase-touched test files>` | 604/604 passing | PASS |
| Functions test suite | `cd functions && npm test` | 115/115 passing (5 files) | PASS |
| Type-check (vue-tsc --build, per CLAUDE.md — includes test files) | `npm run type-check` | exits 0, 0 errors | PASS |
| Named R092 invariant (assembler) | grep + read `slideshowAssembler.test.ts:706` | field-less slide resolves to 'ESV', assembler never receives a setting arg | PASS |
| Named R092 invariant (materializer) | grep + read `slideGroupMaterializer.test.ts:474-517` | sourceSignature identical ESV vs NLT stamp; rebuild returns stored slides reference-equal (`changed:false`), stamp not overwritten | PASS |
| Deploy discipline (no rules/deploy-config touched) | `git log --oneline -- firestore.rules storage.rules firebase.json` | Last touch Phase 42 (`c58bd40`), nothing in Phase 45's commit range | PASS |
| Debt-marker scan on 13 touched files | grep `TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER` | 1 hit, a comment explicitly clarifying something is *not* a TODO — no unresolved marker | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R090 | 45-01, 45-02, 45-04 | A church can choose ESV or NLT as the source for scripture passages, in Settings | SATISFIED (routing/storage/UI) — NLT proxy DEPLOY-GATED | Settings card + default + routing all verified in code; live NLT fetch requires owner deploy (human_needed item). |
| R091 | 45-03, 45-04 | Scripture text carries its required translation attribution wherever displayed/projected | SATISFIED | Single shared helper, both render sites verified. |
| R092 | 45-03, 45-04 | Changing the translation setting does not retroactively alter scripture on existing slides | SATISFIED | Field-less fallback + no-authStore-import guarantee + named invariant tests, independently re-run and passing. |

No orphaned requirements — `.planning/REQUIREMENTS.md`'s traceability table maps R090/R091/R092 to Phase 45 exactly matching the three PLAN frontmatter `requirements:` declarations (45-01: R090; 45-02: R090; 45-03: R091,R092; 45-04: R090,R091,R092).

### Anti-Patterns Found

None blocking. One informational comment (`functions/src/index.ts:424`, "...it is a tested behaviour, not a TODO") is self-referential clarification, not a debt marker.

The code-review cycle (45-REVIEW.md, standard depth, 13 files) found 0 Critical, 2 Warning, 3 Info. All 4 in-scope findings (WR-01, WR-02, IN-01, IN-02) were fixed and independently re-verified present in source this session (post-strip empty-body guard in `nltApi.ts`, `redactUrl()` in `functions/src/index.ts`, error rewrap in `fetchNltPassageText`, conditional secret read). IN-03 (no end-to-end `onRequest` handler test) was explicitly and correctly scoped out as a pre-existing gap shared with the `esv`/`anthropic` branches, not phase-introduced.

### Human Verification Required

See frontmatter `human_verification`. Summary: the NLT Cloud Function ships deploy-gated by design (standing v1.5 NO-DEPLOYS autonomy grant) — a live NLT fetch/attribution round trip and a live cross-service R092 flip check cannot be verified without the owner's deploy step. Two additional deferred UI checks (attribution overflow at 48px, Settings card visual parity + reload persistence) are jsdom-unprovable per the phase's own UI-SPEC. All four items are already correctly recorded in `.planning/PENDING-VERIFICATION.md` § Phase 45 by the executor, not newly discovered here.

### Gaps Summary

No gaps. All 7 derived observable truths (covering all 4 ROADMAP success criteria) are VERIFIED against the actual codebase — not merely claimed in SUMMARY.md. Independently re-run test suites (604 app-suite tests across the 10 phase-touched files + 115 functions tests) all pass; type-check is clean; the named R092 invariant tests were read and confirmed to assert the actual invariant (not just presence); `git log` confirms no rules/deploy-config drift. Overall status is `human_needed` rather than `passed` solely because SC4's proxy is intentionally undeployed per the standing autonomy grant — this is the expected, correctly-documented end state for this phase, not a defect.

---

*Verified: 2026-08-08T06:10:17Z*
*Verifier: Claude (gsd-verifier)*
