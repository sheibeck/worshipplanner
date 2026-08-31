---
phase: 102-gated-scripture-fetch-dispatcher
verified: 2026-08-31T21:00:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 102: Gated Scripture Fetch Dispatcher Verification Report

**Phase Goal:** Every ESV/NLT scripture fetch — client and server — passes through one per-org gate, so a disabled org makes zero proxy requests while an enabled org's experience is unchanged.
**Verified:** 2026-08-31
**Status:** passed
**Re-verification:** No — initial verification

This is a post-code-review-fix verification: 102-REVIEW.md found 1 critical + 3 warning + 1 info issue (the critical one being a real, live, ungated bypass at `planningCenterApi.ts`), and 102-REVIEW-FIX.md claims all 5 were fixed. This report independently re-inspects the actual committed code (not the SUMMARY/REVIEW-FIX narrative) to confirm those fixes are real and complete, and independently re-ran every gate rather than trusting the documented numbers.

## Goal Achievement

### Observable Truths (mapped 1:1 to ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When Bible API is enabled, ESV/NLT preview + LLM-assisted congregational auto-fetch work exactly as before — no regression (R296) | VERIFIED | `src/utils/scriptureApi.ts` relocates (does not reimplement) the pre-existing `version === 'NLT' ? ... : ...` dispatch; all pre-existing behavioral tests in `ScriptureInput.test.ts` (40 tests), `CongregationalEditor.test.ts` (18 tests), `ScriptureSlideEditor.test.ts` (21 tests), and `planningCenterApi.test.ts` (127 tests) pass unchanged with the enabled-baseline mock/store defaults. Independently re-run: all 5 files green, 212/212 tests. |
| 2 | `src/utils/scriptureApi.ts` is the ONLY path used to fetch scripture text — no component/util calls `esvApi.ts`/`nltApi.ts` directly (R297) | VERIFIED | Whole-`src/` grep for `from '@/utils/esvApi'` / `from '@/utils/nltApi'` (production imports only) returns exactly one hit: `src/utils/scriptureApi.ts` itself. All other matches are test files mocking the modules to assert non-invocation, plus `nltApi.ts`'s own unit test. All four production call sites confirmed routed through the dispatcher by direct code read: `ScriptureInput.vue:208`, `CongregationalEditor.vue:158`, `planningCenterApi.ts:7`, `ScriptureSlideEditor.vue:85`. The REVIEW's CR-01 (planningCenterApi bypass) and WR-01 (ScriptureSlideEditor bypass) findings are genuinely fixed, not just narrated — verified by reading the actual diffed code, not the SUMMARY. |
| 3 | When disabled, the app makes no ESV/NLT proxy request and scripture UI degrades gracefully (no throw/error) (R297) | VERIFIED | `scriptureApi.ts` gates on `authStore.isBibleApiEnabled` FIRST and returns `{status:'disabled'}` before any fetch call — confirmed by direct code read. All four call sites branch on `'disabled'` as a silent no-op (no error state set, no throw): `ScriptureInput.vue` (fetchPreview/togglePreview), `CongregationalEditor.vue` (autoFetch), `planningCenterApi.ts` (falls back to stored text or omits description), `ScriptureSlideEditor.vue` (no slides created, no fetch-error shown). WR-02's defensive `catch` was independently confirmed restored in all three Vue-component call sites (`ScriptureInput.vue:409,506`; `CongregationalEditor.vue:259`) and in `planningCenterApi.ts` (pre-existing try/catch retained), closing the unhandled-rejection regression the review flagged. Each disabled path is exercised by a dedicated spy-asserted test (dispatcher: 2 cases; ScriptureInput: fetchPreview + togglePreview; CongregationalEditor: 1 case; ScriptureSlideEditor: 1 case; planningCenterApi: 2 cases) — all independently re-run and passing. |
| 4 | The server `api` proxy's esv AND nlt branches independently enforce the same per-org gate via `checkOrgBibleEnablement`, default-OFF/fail-closed, org resolved from the verified token (R297) | VERIFIED | Direct read of `functions/src/index.ts:391-419` (checkOrgBibleEnablement, 1:1 mirror of checkOrgAiEnablement — live `organizations/{orgId}.bibleApiEnabled` read, default `?? false`, 403 deny, 503 fail-closed on read error) and `:732-751` (wiring: `if (service === "esv" \|\| service === "nlt")` block placed after the anthropic block and BEFORE the shared `fetch(upstreamUrl, ...)` at `:754`, org resolved via `resolveOrgId(decodedCaller!)` from the verified ID-token claim, org-less caller rejected 403 before any Firestore read). WR-03's handler-level tests (added post-review) were run directly: `it("WR-03 ... a disabled org (bibleApiEnabled:false) is denied 403 on esv before fetch")`, `it("WR-03 ... a caller whose token has NO orgId claim is denied 403 ... before fetch")`, `it("WR-03 ... an org-doc read error fails CLOSED with 503 ... before fetch")` — all 3 drive the actual `api(req, res)` handler (not just the extracted gate function) and assert `fetchMock` was never called. This closes the review's WR-03 gap (previously only the extracted function was unit-tested, not the wiring itself). Deploy is intentionally NOT executed this phase (explicit plan constraint, owner-gated milestone-end batch) — this does not affect the SC's wording, which is about code-level enforcement, not deployment status. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/scriptureApi.ts` | Single client dispatcher, gates on `authStore.isBibleApiEnabled`, discriminated result type | VERIFIED | Exists, substantive (60 lines, real gate + dispatch logic, not a stub), wired (imported by all 4 production call sites) |
| `src/utils/__tests__/scriptureApi.test.ts` | Unit tests covering all dispatcher behaviors | VERIFIED | 6 tests, all cases from the plan's behavior block covered, independently re-run and passing |
| `functions/src/index.ts` (`checkOrgBibleEnablement`) | Server gate mirroring `checkOrgAiEnablement` | VERIFIED | Exists at line 403, 1:1 structural mirror confirmed by direct read, wired into esv/nlt branches at line 746 |
| `functions/src/index.test.ts` | Gate unit tests + handler-level wiring tests | VERIFIED | 6-case `checkOrgBibleEnablement` describe block + 3 WR-03 handler-level tests, all independently re-run and passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ScriptureInput.vue` | `scriptureApi.fetchScriptureText` | `fetchPassageByOrgSetting` wrapper, used in `fetchPreview`/`togglePreview` | WIRED | Confirmed by direct code read; no `esvApi`/`nltApi` import remains |
| `CongregationalEditor.vue` | `scriptureApi.fetchScriptureText` | direct call in `autoFetch` | WIRED | Confirmed by direct code read; no `esvApi`/`nltApi` import remains |
| `planningCenterApi.ts` (`addSlotAsItem`) | `scriptureApi.fetchScriptureText` | direct call in SCRIPTURE-slot branch | WIRED | Post-review fix (CR-01) confirmed live in the committed code, not just claimed |
| `ScriptureSlideEditor.vue` | `scriptureApi.fetchScriptureText` | direct call in `onFetchPassage` | WIRED | Post-review fix (WR-01) confirmed live in the committed code; component itself is unmounted anywhere in the app today (dead code) but the bypass is closed pre-emptively |
| `api` onRequest handler (esv/nlt branches) | `checkOrgBibleEnablement` | `resolveOrgId` → gate call → reject before `fetch()` | WIRED | Confirmed by direct code read: gate call precedes the shared upstream fetch by ~3 lines; three handler-level tests (WR-03) exercise this exact ordering |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Dispatcher disabled-gate + enabled ESV/NLT routing | `npx vitest run src/utils/__tests__/scriptureApi.test.ts` | 6/6 passed | PASS |
| All 4 production call sites' enabled/disabled branches | `npx vitest run src/components/__tests__/ScriptureInput.test.ts src/components/__tests__/CongregationalEditor.test.ts src/components/__tests__/ScriptureSlideEditor.test.ts src/utils/__tests__/planningCenterApi.test.ts` | 5 files / 212 tests passed | PASS |
| Server handler denies disabled org / org-less caller / Firestore read error on esv, before `fetch` | `cd functions && npx vitest run src/index.test.ts -t "WR-03"` | 3 WR-03(102-REVIEW) tests passed (plus 3 unrelated pre-existing WR-03 tests matched by the same substring) | PASS |
| `checkOrgBibleEnablement` 6-case gate function | `cd functions && npx vitest run src/index.test.ts -t "checkOrgBibleEnablement"` | 6/6 passed | PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` conventional probes and none are declared in the PLANs.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R296 | 102-01 | No regression when Bible API enabled | SATISFIED | All pre-existing behavioral tests across 4 call sites pass unchanged |
| R297 | 102-01, 102-02 | Single dispatcher choke point + graceful no-op when disabled + server defense-in-depth | SATISFIED | Whole-`src/` grep confirms single choke point; disabled-branch tests at all 4 sites; server handler-level tests confirm independent enforcement |

No orphaned requirements — REQUIREMENTS.md maps only R296/R297 to Phase 102, both covered.

### Independently Re-Run Gates

- `npm run type-check` (root, `vue-tsc --build`) — clean, zero errors.
- `npx vitest run` (root, bare command per CLAUDE.md) — **175/177 test files passed, 4776/4803 tests passed, 26 skipped.** The 2 failing files are exactly the documented pre-existing baselines: `src/storage.rules.test.ts` (Storage-emulator `firestore.exists()` cross-service limitation, unrelated to scripture fetching) and `src/stores/appConfig.test.ts` (pre-existing dot-path-payload assertion drift, unrelated to scripture fetching). No new failures introduced by this phase — matches the SUMMARY's claimed baseline exactly.
- `cd functions && npm run build && npm test` — build clean; **636/636 tests passed (18 files)**, matching the SUMMARY's claim exactly (627 baseline + 9 new: 6 `checkOrgBibleEnablement` cases + 3 WR-03 handler tests).

### Anti-Patterns Found

None. Grepped all phase-touched files (`scriptureApi.ts`, `ScriptureInput.vue`, `CongregationalEditor.vue`, `ScriptureSlideEditor.vue`, `planningCenterApi.ts`, `functions/src/index.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` — one match in `functions/src/index.ts` is a comment explicitly *negating* a TODO ("it is a tested behaviour, not a TODO"), not a debt marker.

### Human Verification Required

None. Per the task's human-verification policy, this phase introduces no new visible UI (enabled path is an unchanged passthrough; disabled path is a silent no-op with no UI at all — Phase 103 adds the visible fallback). Every truth in this phase is a deterministic client/server logic behavior (a gate check + branch, a fetch-or-not, an HTTP status before/after a mocked fetch call) rather than a visual/UX judgment call, and each is exercised by tests that mount the real Vue components and drive real events (ScriptureInput.test.ts, CongregationalEditor.test.ts, ScriptureSlideEditor.test.ts) or drive the actual server handler function (WR-03 tests) — not merely asserting on isolated pure functions. No item required routing to human/visual UAT.

### Gaps Summary

No gaps. This phase reached `passed` only after a code-review-fix round closed one critical (CR-01: a live, actively-used, ungated bypass in `planningCenterApi.ts`'s "push to Planning Center" flow) and three warning-level findings (WR-01: latent bypass in `ScriptureSlideEditor.vue`; WR-02: dropped defensive catch; WR-03: missing handler-level test coverage) plus one info-level gap (IN-01: untested `togglePreview` disabled branch). This verification independently re-inspected the actual committed code for each of those five fixes (not the REVIEW-FIX.md narrative) and confirmed each is genuinely present and functioning, then independently re-ran every automated gate rather than trusting the documented pass counts. All numbers matched the SUMMARY/REVIEW-FIX claims exactly.

One process note worth flagging for awareness (not a gap): the phase's own initial scoping (102-CONTEXT.md, both PLANs' `must_haves`) named only `ScriptureInput.vue` and `CongregationalEditor.vue` as in-scope call sites — the two additional live/latent bypasses (`planningCenterApi.ts`, `ScriptureSlideEditor.vue`) were caught only by the code-review's whole-`src/` grep, not by the original plans. The fix round closed the gap correctly, but it's a reminder that "route the two named components" and "no component anywhere calls esvApi/nltApi directly" are different claims, and only a whole-codebase grep catches the difference — which is exactly what ROADMAP Success Criterion #2's wording (and this verification's instructions) called for.

---

_Verified: 2026-08-31_
_Verifier: Claude (gsd-verifier)_
