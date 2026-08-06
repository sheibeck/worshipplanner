---
phase: 39-org-settings-infrastructure-feature-toggles
verified: 2026-08-06T21:30:00Z
status: human_needed
score: 4/4 must-haves verified (automated); 5 backstop items outstanding (insufficient_spec — deferred, not failed)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "39.03-1 (starred, highest risk) — Credential retention across a real off → reload → on cycle. Enter Planning Center credentials in Settings, toggle the integration off, RELOAD THE PAGE, toggle it back on."
    expected: "The identical masked credential display returns unchanged. A unit test proves the handler never calls onClearPcCredentials/setPcCredentials and never writes pcAppId/pcSecret; only a real Firestore round-trip plus a page reload proves the value actually survives."
    why_human: "jsdom cannot perform a real Firestore read/write round-trip or a page reload."
  - test: "39.03-2 — AI feature list does not wrap past 2 lines at a standard desktop viewport (Settings → AI Features)."
    expected: "No item in the three-item feature list wraps beyond two lines."
    why_human: "Visual line-wrap judgment cannot be asserted in jsdom."
  - test: "39.03-3 — Defaults on a genuinely pre-v1.5 organization document. Open Settings against a real org document created before v1.5 (not a fixture)."
    expected: "Both 'Enable AI features' and 'Enable Planning Center integration' checkboxes render CHECKED, both feature sets are visible, never a blank or indeterminate checkbox."
    why_human: "Only a real legacy Firestore document (not a test fixture) proves the deployed read path; this is ROADMAP success criterion 1's literal claim."
  - test: "39.03-4 — vwModeEnabled migration does not silently re-enable a deliberately-off church. Against a real org document with flat vwModeEnabled: false and no settings key, open Settings, then save any toggle."
    expected: "The Vertical Worship toggle renders UNCHECKED, and saving any toggle backfills settings.vwModeEnabled: false (never true)."
    why_human: "There is no error, log, or failing test if this regresses — 'the eye is the only detector' per the plan's own framing. Only a real document exercises the deployed read+write path."
  - test: "39.06-1 — Congregational editor button-row reflow. With AI off, open a congregational reading editor."
    expected: "The button row shows two buttons (not three), reads as visually balanced, and hand-dividing a reading works identically with the AI button absent."
    why_human: "Visual balance/reflow judgment cannot be asserted in jsdom; the functional half is already proven by an automated test (CongregationalEditor.test.ts)."
---

# Phase 39: Org Settings Infrastructure & Feature Toggles Verification Report

**Phase Goal:** A church's org-level settings persist safely on every existing org document, and a church can turn AI and Planning Center integrations off entirely.
**Verified:** 2026-08-06
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A typed `OrgSettings` shape with a single defaults-merge point means a pre-v1.5 org document loads without error and shows correct defaults on every screen | ✓ VERIFIED (automated) | `src/types/organization.ts` exports `Organization`, `OrgSettings`, `DEFAULT_ORG_SETTINGS` (all 3 fields default `true`). Single merge point at `src/stores/auth.ts:121-144` (`loadOrgContext`). 6 passing unit tests in `auth.test.ts` `describe('OrgSettings (R073)')` cover: full-default resolution, partial-key fallback, nested-over-flat precedence, no-silent-flip regression (now asserting **both** `store.vwModeEnabled` and `store.settings.vwModeEnabled`, closing code-review finding CR-01), no-write-on-read, and reset-on-no-org/logout. Ran `npx vitest run src/stores/__tests__/auth.test.ts -t "OrgSettings"` myself: 6 passed. **Real pre-v1.5 document check is a deferred backstop (39.03-3)** — see Human Verification. |
| 2 | In Settings, AI can be turned off; every AI entry point disappears; a direct call into `claudeApi.ts` with the toggle off issues no network request — proven at the module entry point, not a `v-if` | ✓ VERIFIED (automated) | `claudeApi.ts` gates exactly `getSongSuggestions`, `getScriptureSuggestions`, `splitCongregationalReading` (confirmed `grep -c isAiEnabled` = 4: 1 definition + 3 call sites). Guard sits inside each `try` block (code-review finding WR-03 fixed). Tests mock `@anthropic-ai/sdk` (`mockCreate`/`mockParse`), never `fetch` — confirmed by reading the mock setup. Ran `npx vitest run src/utils/__tests__/claudeApi.test.ts -t "aiEnabled"` myself: 4 passed. All 4 AI UI surfaces confirmed gated in source: `SongSlotPicker.vue:64`, `ScriptureInput.vue:4`, `CongregationalEditor.vue:46`, and a 5th surface the phase's own code review caught and fixed — "Suggest All Songs" in `serviceEditorActionBar.ts:175-176` (WR-01). Exhaustively grepped every call site of the three gated functions and every consumer of `authStore.settings.aiEnabled` — no 6th ungated entry point found. |
| 3 | In Settings, Planning Center can be turned off; features hide without altering already-imported roster data or already-exported service status | ✓ VERIFIED (automated) | All 6 enumerated PC surfaces gated: export action-bar item (`serviceEditorActionBar.ts:116`, composed on existing credentials gate), export dialog invocation (`ServiceEditorView.vue:3088`, belt-and-suspenders), set-up hint row (`ServiceEditorView.vue:201`), roster import ×2 (`RosterView.vue:14,75`), song import (`SongsView.vue:43`), credentials block (`SettingsView.vue:99`, `v-if="pcEnabledInput"`, display-only). `onTogglePcEnabled` (`SettingsView.vue:637-657`) never calls `onClearPcCredentials`/`setPcCredentials` and writes only `settings.pcEnabled`. Ran `npx vitest run src/views/__tests__/serviceEditorActionBar.test.ts -t "pcEnabled"` myself: 3 passed. **Real reload-survival check is a deferred backstop (39.03-1, starred as highest risk)** — see Human Verification. |
| 4 | Turning AI off never alters slide content an AI split already generated | ✓ VERIFIED (automated, positive proof) | `CongregationalEditor.test.ts:574-596` mounts over a pre-populated split with AI off and asserts section text is byte-identical (`toContain(SAMPLE_SECTIONS[0]!.text)` etc.), `mockSplitCongregationalReading` was never called, AND a hand edit (speaker toggle) still applies and emits correctly. This is a genuine behavioral proof, not merely a presence check. Ran `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` myself: 30/30 passed. |

**Score:** 4/4 ROADMAP truths verified by automated evidence. 5 UI-SPEC backstop truths (`verification: backstop`) remain outstanding — deferred per the v1.5 standing autonomy grant, not failed, not silently passed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/organization.ts` | `Organization`, `OrgSettings`, `DEFAULT_ORG_SETTINGS` | ✓ VERIFIED | Read directly; all 3 exports present, all defaults `true`, legacy flat `vwModeEnabled` documented not dropped |
| `src/stores/auth.ts` | `settings` ref, single merge point, dual-read, 3 reset sites, exported | ✓ VERIFIED | `settings` declared line 56, merged lines 121-144, reset at lines 106/188/333, exported line 369 |
| `src/utils/claudeApi.ts` | private `isAiEnabled()` guard, 3-of-7 gating | ✓ VERIFIED | `isAiEnabled()` at line 69, called at lines 202/326/556 (inside `try`), private (no `export`) |
| `src/views/SettingsView.vue` | AI Features section, PC toggle, dot-path writes | ✓ VERIFIED | `onToggleAiEnabled`/`onTogglePcEnabled`/`onToggleVwMode` all write `settings.<field>` dot-path keys; credential handler never invoked from the PC toggle handler |
| `src/views/serviceEditorActionBar.ts` | `pcEnabled`/`aiEnabled` composed gates | ✓ VERIFIED | Both fields required on `ActionBarContext`, composed onto existing gates (not competing checks) |
| `src/views/RosterView.vue`, `src/views/SongsView.vue` | import triggers gated | ✓ VERIFIED | `settings.pcEnabled` gates both RosterView occurrences and the SongsView trigger |
| `src/components/SongSlotPicker.vue`, `ScriptureInput.vue`, `CongregationalEditor.vue` | AI affordances gated | ✓ VERIFIED | All three compose `authStore.settings.aiEnabled` onto pre-existing conditions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `loadOrgContext` | `authStore.settings` / `authStore.vwModeEnabled` | single `resolvedVwModeEnabled` computed once, applied to both | ✓ WIRED | Code-review CR-01 fix confirmed in source: both fields assigned from the same variable, cannot disagree — hand-traced all 4 input shapes |
| `claudeApi.ts` exports | `authStore.settings.aiEnabled` | `isAiEnabled()` called inside each gated export's `try` | ✓ WIRED | Guard never throws out of a gated export (WR-03 fix); confirmed via `claudeApi.test.ts`'s `WR-03` describe block |
| `serviceEditorActionBar.ts` | `authStore.settings.{aiEnabled,pcEnabled}` | threaded from `ServiceEditorView.vue`'s `activeActionItems` computed | ✓ WIRED | `ServiceEditorView.vue:2081,2083` — both fields required (compiler-enforced), no missed call site |
| `SettingsView.vue`'s PC toggle | `authStore.settings.pcEnabled` write | dot-path `updateDoc` + local mirror, never touching credentials | ✓ WIRED | Confirmed no `onClearPcCredentials`/`setPcCredentials` call anywhere in `onTogglePcEnabled` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run type-check` (the `vue-tsc --build` form, covers test files) | `npm run type-check` | exit 0, zero errors | ✓ PASS |
| Full app suite matches documented 2-file baseline | `npx vitest run --dir src --exclude '**/rules.test.ts'` | 2 files failed (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), 9 tests failed, 2547 passed, 83/85 files passed — exactly the documented baseline, zero new failures | ✓ PASS |
| R073 targeted test | `npx vitest run src/stores/__tests__/auth.test.ts -t "OrgSettings"` | 6 passed | ✓ PASS |
| R088 targeted test | `npx vitest run src/utils/__tests__/claudeApi.test.ts -t "aiEnabled"` | 4 passed | ✓ PASS |
| R089 targeted test | `npx vitest run src/views/__tests__/serviceEditorActionBar.test.ts -t "pcEnabled"` | 3 passed | ✓ PASS |
| Congregational editor AI-off content-preservation test | `npx vitest run src/components/__tests__/CongregationalEditor.test.ts` | 30/30 passed | ✓ PASS |
| ScriptureInput, RosterView, SongsView, ServiceEditorView combined | `npx vitest run src/components/__tests__/ScriptureInput.test.ts src/views/__tests__/RosterView.test.ts src/views/__tests__/SongsView.test.ts src/views/__tests__/ServiceEditorView.test.ts` | 286/287 passed — 1 failure is the documented pre-existing `RosterView.test.ts` stale assertion | ✓ PASS |
| SettingsView dot-path/credential-retention tests | `npx vitest run src/views/__tests__/SettingsView.test.ts` | 9/9 passed | ✓ PASS |

All commands were re-run independently during this verification, not accepted from SUMMARY.md claims.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R073 | 39-02, 39-03 | Every setting persists per org, resolves to sensible defaults on a pre-v1.5 doc | ✓ SATISFIED (automated) + backstops 39.03-3/39.03-4 outstanding | `OrgSettings`/`DEFAULT_ORG_SETTINGS`/single merge point confirmed in source and tests; real pre-v1.5-document proof deferred |
| R088 | 39-04 | AI can be turned off; toggle enforced at `claudeApi.ts` entry point, not UI only | ✓ SATISFIED (automated) + backstops 39.03-2/39.06-1 outstanding | 3-of-7 gating, SDK-mock-based test, all 4 AI surfaces gated (including the review-caught 5th); visual checks deferred |
| R089 | 39-03, 39-05 | PC can be turned off; hides features without altering roster/export data | ✓ SATISFIED (automated) + backstop 39.03-1 outstanding | All 6 surfaces gated, credential-retention proven at handler level; real reload-survival proof deferred (highest-risk item) |

No orphaned requirements — R073/R088/R089 are the only ones mapped to Phase 39 in REQUIREMENTS.md's Traceability table, and all three appear in every plan's `requirements` frontmatter.

### Anti-Patterns Found

None. Grepped every file this phase modified for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and "coming soon"/"not yet implemented" style copy — zero matches across all 11 core source files (`organization.ts`, `auth.ts`, `claudeApi.ts`, `SettingsView.vue`, `serviceEditorActionBar.ts`, `ServiceEditorView.vue`, `RosterView.vue`, `SongsView.vue`, `SongSlotPicker.vue`, `ScriptureInput.vue`, `CongregationalEditor.vue`).

### Code Review Findings (context, not re-litigated)

The phase's own `39-REVIEW.md` found 1 Critical (CR-01: `settings.vwModeEnabled` skipped the dual-read migration) and 3 Warnings (WR-01: "Suggest All Songs" was an ungated 5th AI entry point; WR-02: missing integration-level test for `ServiceEditorView.vue`'s `pcEnabled` composition; WR-03: guard positioned outside `try`, risking an unhandled rejection instead of the documented `null`). All 4 were fixed in one commit each and iteration-2 re-verified clean. This verification independently re-confirmed all 4 fixes are present in the current source (not merely claimed in the review) — see Observable Truths table above, each citing the specific line/behavior that closes the corresponding finding.

### Human Verification Required

Five backstop checks from `39-UI-SPEC.md` § UI Considerations require a real browser, a real Firestore round-trip, or a real pre-v1.5 organization document — none provable in jsdom. All five are already correctly recorded as **DEFERRED** (not passed) in `.planning/PENDING-VERIFICATION.md` under "Phase 39 — Org Settings Infrastructure & Feature Toggles," each with an unchecked box and full steps. See the `human_verification` list in this report's frontmatter for the condensed version. The highest-risk item is **39.03-1** (Planning Center credential retention across a real reload) — starred in `PENDING-VERIFICATION.md` as the one check that could silently destroy user data if the retention guarantee were implemented wrongly; automated evidence proves the handler-level guarantee but not the Firestore round-trip.

### Gaps Summary

No gaps found. Every ROADMAP success criterion has genuine automated evidence (not merely presence/wiring — criterion 4 in particular has a positive content-preservation test, and criterion 2's "not a `v-if`" requirement is met by SDK-mock assertions at the module entry point). The phase's own code review caught and fixed one real functional gap (a 5th ungated AI entry point) before this verification ran; this verification independently re-confirmed the fix rather than trusting the review's word. The only open items are the 5 UI-SPEC backstop checks, which are legitimately un-provable outside a real browser/Firestore session and are honestly disclosed as deferred rather than fabricated as passed — this is the correct outcome under the v1.5 standing autonomy grant, not a defect in the phase.

---

_Verified: 2026-08-06_
_Verifier: Claude (gsd-verifier)_
