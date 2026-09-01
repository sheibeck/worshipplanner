---
phase: 102-gated-scripture-fetch-dispatcher
reviewed: 2026-08-31T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - src/utils/scriptureApi.ts
  - src/utils/__tests__/scriptureApi.test.ts
  - src/components/ScriptureInput.vue
  - src/components/__tests__/ScriptureInput.test.ts
  - src/components/CongregationalEditor.vue
  - src/components/__tests__/CongregationalEditor.test.ts
  - functions/src/index.ts
  - functions/src/index.test.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
fixed_at: 2026-08-31T20:00:00Z
fix_report: 102-REVIEW-FIX.md
findings_resolved:
  - CR-01
  - WR-01
  - WR-02
  - WR-03
  - IN-01
post_fix_status: all_fixed
---

# Phase 102: Code Review Report

**Reviewed:** 2026-08-31
**Depth:** deep (cross-file, whole-`src/` grep for bypasses; functions build/tests + root type-check executed)
**Files Reviewed:** 8 (diff `d59320d8~1..b0b651e7`)
**Status:** issues_found

## Summary

The two named consumers (`ScriptureInput.vue`, `CongregationalEditor.vue`) are correctly and cleanly routed through the new `src/utils/scriptureApi.ts` dispatcher, the gate (`authStore.isBibleApiEnabled`) runs strictly before any network call with a non-throwing `'disabled'` result, and the enabled path is a faithful passthrough — all pre-existing tests for both components stay green. The server-side half (`checkOrgBibleEnablement`) is a correct 1:1 mirror of `checkOrgAiEnablement`: it live-reads `organizations/{orgId}`, defaults OFF on an absent field/doc, fails closed (503) on a read error, resolves the org from the verified ID-token claim (never a client-supplied value), and is wired to gate **both** the `esv` and `nlt` proxy branches before the shared upstream `fetch`. The `anthropic` branch, rate limiter, ledger, and quota logic are untouched (confirmed by diff and by `functions/src/index.test.ts`'s existing anthropic describe blocks still passing). `functions build`, `npm run type-check`, and all touched test files were run directly and pass exactly as claimed.

However, the phase's central claim — "a single scripture-fetch choke point... every ESV/NLT fetch... passes through one gate" — is not actually true of the codebase as a whole. A whole-`src/` grep for `esvApi`/`nltApi` (not just the two named components) turns up a **live, reachable production call site that still imports and calls `fetchPassageText`/`fetchNltPassageText` directly**, entirely bypassing `scriptureApi.ts` and its gate. That is this review's one BLOCKER. Three further WARNINGs cover a second (currently-dead-code) bypass, a defensive-catch regression introduced by the branch-on-`status` refactor, and a test-coverage gap on the server's new wiring.

## Critical Issues

### CR-01: `planningCenterApi.ts`'s SCRIPTURE branch still calls `fetchPassageText`/`fetchNltPassageText` directly — a live, ungated bypass of the Phase 102 choke point

**File:** `src/utils/planningCenterApi.ts:7-8, 993-998`
**Issue:** `addSlotAsItem` (the function that builds a Planning Center plan item for each service slot when a user pushes a service to Planning Center) has its own inline ESV/NLT version dispatch for `SCRIPTURE` slots, unchanged by this phase:

```ts
import { fetchPassageText } from '@/utils/esvApi'
import { fetchNltPassageText } from '@/utils/nltApi'
...
const effectiveVersion = (slot as ScriptureSlot).bibleVersion ?? bibleVersion
try {
  description =
    effectiveVersion === 'NLT'
      ? await fetchNltPassageText(refText)
      : await fetchPassageText(refText)
} catch {
  // silently ignore scripture fetch errors (ESV or NLT)
}
```

This is a real, actively-used production path (`addSlotAsItem` is called from the "push service to Planning Center" flow for every slot, including `SCRIPTURE`), not a test file or dead code. It never checks `authStore.isBibleApiEnabled` and never goes through `scriptureApi.fetchScriptureText`. Consequences:
- **R297 violation today:** the phase's own server-side gate (`checkOrgBibleEnablement`) is explicitly **not deployed this phase** (deploy deferred to owner-gated milestone end, per both PLANs' "Deploy note"). Until that deploy happens, this call site has **zero enforcement, client or server** — a disabled org's user can still pull full ESV/NLT passage text merely by pushing a service containing a Scripture slot to Planning Center. This is exactly the "app makes zero proxy calls when disabled" guarantee the phase exists to establish, and it is false for this path.
- **R297 violation even after the server deploy:** a disabled org still triggers a live network round-trip to `/api/esv` or `/api/nlt` (now correctly 403'd server-side), caught by the bare `catch { }` and silently swallowed — the plan item is created with no description and no error surfaced to the user. That is a real proxy call the phase's threat model (T-102-01) explicitly calls "medium" severity and claims is "verified by the disabled-branch spy assertions in all three suites" — it isn't; this fourth call site was never touched or tested.
- The 102-CONTEXT.md scoping decision ("the two components... Neither may call...") named only `ScriptureInput.vue`/`CongregationalEditor.vue` as in-scope, but the phase's stated *objective* and R297's actual text are about the whole app, and this review's task explicitly asked to check "anywhere else in src/" — this is exactly that gap.

**Fix:** Route this call site through the dispatcher too, and give the caller a way to handle `'disabled'` (e.g., omit the description rather than attempt-and-swallow):
```ts
import { fetchScriptureText } from '@/utils/scriptureApi'
...
const result = await fetchScriptureText(refText, effectiveVersion)
description = result.status === 'ok' ? result.text : undefined
```
If this is deliberately deferred to a later phase, the phase's completion claim and threat-model disposition should say so explicitly rather than asserting a single choke point that does not yet exist; either way, before the server gate is deployed this is a live client-cost/UX gap worth closing now.

## Warnings

### WR-01: `ScriptureSlideEditor.vue` also imports `esvApi` directly, ESV-only, bypassing the dispatcher (currently unreached, but a latent bypass)

**File:** `src/components/ScriptureSlideEditor.vue:85, 137`
**Issue:** `ScriptureSlideEditor.vue` (a "Scripture Slides" editor UI, distinct from `CongregationalEditor.vue`) imports `fetchPassageText` from `@/utils/esvApi` directly and calls it in `onFetchPassage`, with no NLT branch at all (pre-existing gap, not introduced by this phase) and no `isBibleApiEnabled` gate. A grep of the whole `src/` tree for any import of this component (outside its own test and a stale doc-comment reference in `SongLyricEditor.vue`) finds none — it does not appear to be mounted by any parent view today, so the immediate blast radius is low. But it is still an incomplete migration relative to the phase's "single choke point" claim: if this component is wired into a view in a future phase without anyone re-auditing it, it will silently reintroduce an ungated ESV proxy call.
**Fix:** Either route it through `scriptureApi.fetchScriptureText` now for consistency (cheap, since the pattern is established), or if it is confirmed dead, remove it — but don't leave a second direct-`esvApi` call site sitting in `src/components/` while the phase's completion claim says there is exactly one choke point.

### WR-02: The refactor silently dropped the generic `catch` in both components' fetch handlers, narrowing error handling to only what the dispatcher itself can produce

**File:** `src/components/ScriptureInput.vue:399-411, 487-500`; `src/components/CongregationalEditor.vue:245-262`
**Issue:** Before this phase, `fetchPreview`, `togglePreview`, and `autoFetch` each wrapped their fetch + post-processing in `try { ... } catch { setError() } finally { ... }` — any exception anywhere in the try block (including from post-fetch processing like `stripVerseMarkers`) was caught and surfaced as the existing error state. The refactor replaced the `catch` clause with an `else if (result.status === 'error')` branch and kept only `try { ... } finally { ... }` — there is now **no catch clause at all**. This works today only because `scriptureApi.fetchScriptureText` is documented to never throw (all fetch errors are already mapped to `{status:'error'}` inside its own try/catch). But:
- The dispatcher's gate check (`useAuthStore()` / `authStore.isBibleApiEnabled`) runs **before** its own try/catch, so any exception there would propagate unhandled all the way to the component with no catch to stop it.
- In `CongregationalEditor.vue`, `stripVerseMarkers(result.text)` and the subsequent state writes now run with **no catch protecting them** — previously a throw here would have set `fetchError.value = true`; now it becomes an unhandled promise rejection instead of the documented `fetchError` UX.
- This is a fragility/robustness regression, not (currently) an observed functional bug — `stripVerseMarkers` is a simple non-throwing regex today, and `useAuthStore()` will not throw in the app's real runtime. But it silently changes the components' error-handling contract from "anything in here degrades gracefully" to "trust the dispatcher never throws," with no test covering the removed safety net.
**Fix:** Restore a defensive `catch` alongside the `status` branching, e.g.:
```ts
try {
  const result = await fetchPassageByOrgSetting(query)
  if (result.status === 'ok') { ... }
  else if (result.status === 'error') { previewError.value = '...' }
} catch {
  previewError.value = 'Could not load passage. Check your connection and try again.'
} finally {
  previewLoading.value = false
}
```

### WR-03: No end-to-end handler-level test proves the `api` proxy actually denies esv/nlt for a disabled org — only the extracted gate function is unit-tested in isolation

**File:** `functions/src/index.test.ts` (compare the `checkOrgAiEnablement`-wired anthropic tests at ~4409-4465 to the new Bible-gate tests at ~4116-4189)
**Issue:** The anthropic branch has three dedicated **end-to-end** tests driving the actual `api` handler: disabled-org 403 (`R242/R243`), Firestore-read-error 503, and org-less-caller 403 (`CR-01`). The esv/nlt branch has none of these at the handler level — `checkOrgBibleEnablement` itself is thoroughly unit-tested (six cases, mirroring the anthropic describe block), and the *enabled* esv path is proven end-to-end (`WR-01`), but there is no test that drives `api(req, res)` with `service: "esv"` (or `"nlt"`) and `bibleApiEnabled: false` / an org-less token / a Firestore read error and asserts the actual handler returns 403/503 **before** `fetchMock` is called. The plan's own must-haves list this exact scenario ("The api proxy's /api/esv and /api/nlt branches reject a fetch when the caller's org has bibleApiEnabled !== true... independent of the client dispatcher") as a `truths` entry, and it is only indirectly evidenced (manual code reading confirms the wiring is correct today), not proven by a test that would catch a future regression — e.g., an accidental reordering of the new `if (service === "esv" || service === "nlt")` block relative to the `fetch` call, or a typo in the condition, would not be caught by any existing test.
**Fix:** Add 2-3 handler-level tests mirroring the anthropic block's structure, e.g. `service: "esv"` + `bibleApiEnabled: false` → `res.status(403)` and `fetchMock` never called; org-less caller on `esv` → 403 before fetch; Firestore read error on `esv` → 503 before fetch.

## Info

### IN-01: `togglePreview`'s disabled-branch is untested (relies on shared-implementation inference from `fetchPreview`'s test)

**File:** `src/components/__tests__/ScriptureInput.test.ts:690-708`
**Issue:** The new disabled-gate test drives only the reference-preview button (`fetchPreview`); the AI-suggestion expanded preview (`togglePreview`), which shares the same `fetchPassageByOrgSetting` call and the same three-way `status` branch, has no dedicated disabled-case assertion. Both call sites are simple enough that this is low risk, but it is a real gap against the plan's own "component tests that the disabled branch no-ops without error" success criterion, which doesn't distinguish the two call sites.
**Fix:** Add one more test exercising `togglePreview` with `mockBibleApiEnabled = false`, asserting neither fetch mock is called and `aiPreviewError` stays false — mirrors the existing `fetchPreview` disabled test almost verbatim.

## Fix Status (post-review)

All 5 findings (CR-01, WR-01, WR-02, WR-03, IN-01) were fixed and committed atomically. See `102-REVIEW-FIX.md` for the full per-finding report, files touched, and commit hashes. Summary:

- **CR-01 (fixed):** `planningCenterApi.ts`'s SCRIPTURE branch now routes through `scriptureApi.fetchScriptureText`; a `'disabled'` verdict falls back to the slot's own `congregationalSections` text or omits the description, never hitting the proxy.
- **WR-01 (fixed):** `ScriptureSlideEditor.vue` now routes through the dispatcher too (still ESV-only — a pre-existing, out-of-scope gap); it remains unmounted anywhere in the app today, so this closes the latent-bypass risk before it's ever wired in.
- **WR-02 (fixed):** a defensive `catch` was restored in `ScriptureInput.vue`'s `fetchPreview`/`togglePreview` and `CongregationalEditor.vue`'s `autoFetch`, alongside the existing `status` branching.
- **WR-03 (fixed):** added handler-level `api()` tests proving the esv branch denies a disabled org / org-less caller / Firestore read error before `fetch`, mirroring the anthropic branch's existing handler tests.
- **IN-01 (fixed):** added a dedicated `togglePreview` disabled-branch test.

Post-fix, a whole-`src/` grep confirms `esvApi`/`nltApi` are imported ONLY by `scriptureApi.ts` (the dispatcher) and by test files that mock them to assert non-invocation — the "single choke point" claim now holds for the whole codebase, not just the two originally-scoped components. `npm run type-check`, `functions` build/test, and the bare app `vitest run` (175/177 files green, the 2 documented pre-existing baselines unaffected) all pass.

---

_Reviewed: 2026-08-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Fixed: 2026-08-31 (see 102-REVIEW-FIX.md)_
