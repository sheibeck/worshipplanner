---
phase: 82-per-org-ai-enablement
fixed_at: 2026-08-24T18:54:05Z
review_path: .planning/phases/82-per-org-ai-enablement/82-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 82: Code Review Fix Report

**Fixed at:** 2026-08-24T18:54:05Z
**Source review:** .planning/phases/82-per-org-ai-enablement/82-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical, 2 Warning, 1 Info)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: The AI-proxy enablement gate is skipped (fail-open) for any caller whose token lacks an `orgId` claim

**Files modified:** `functions/src/index.ts`, `functions/src/index.test.ts`
**Commit:** `ad4f71d2`
**Applied fix:** Restructured the `if (callerOrgId) { ...enablement check... }` wrapper into a fail-closed shape: `if (!callerOrgId) { deny 403; return }` followed by the (already fail-closed) `checkOrgAiEnablement` call unconditionally. An authenticated caller whose token carries no `orgId` claim (org-less user, or a super-admin who entered an org with no synced membership doc) is now denied with `403 { error: "AI features require an organization." }` instead of silently bypassing the org-enablement check. Added a regression test (`CR-01 (82-REVIEW): a caller whose token has NO orgId claim is denied 403...`) to the WR-04 describe block in `functions/src/index.test.ts`, asserting 403, no `fetch` call, and no `getFirestore` call (confirmed no Firestore read precedes this gate in the request path). `cd functions && npx vitest run src/index.test.ts` — 277/277 passed. `cd functions && npm run build` — clean.

### WR-01: `firestore.rules`'s lifecycle guard protects `aiMasterEnabled` but not its own audit-trail siblings

**Files modified:** `firestore.rules`, `src/rules.test.ts`
**Commit:** `e6f68d41`
**Applied fix:** Extended `lifecycleFields()` to include `aiEnabledAt`, `aiEnabledBy`, `aiDisabledAt`, `aiDisabledBy` alongside the existing `aiMasterEnabled` entry, closing the same T-76-06 audit-forgery class already closed for `active`'s siblings. Added two DENY tests to `src/rules.test.ts` proving an ordinary editor can no longer forge `aiEnabledAt`/`aiEnabledBy` or `aiDisabledAt`/`aiDisabledBy` directly via `updateDoc`. Gate: `npx vitest run --config vitest.rules.config.ts` against the already-running emulator — `src/rules.test.ts` 198/198 passed (the only suite failure was the pre-existing known-baseline `src/storage.rules.test.ts`, unrelated to this change — see CLAUDE.md).

### WR-02: AI-feature affordances outside SettingsView still gate on `settings.aiEnabled` alone, not the master gate

**Files modified:** `src/stores/auth.ts`, `src/stores/__tests__/auth.test.ts`, `src/components/SongSlotPicker.vue`, `src/components/ScriptureInput.vue`, `src/components/CongregationalEditor.vue`, `src/views/ServiceEditorView.vue`, `src/components/__tests__/SongSlotPicker.test.ts`, `src/components/__tests__/ScriptureInput.test.ts`, `src/components/__tests__/CongregationalEditor.test.ts`, `src/views/__tests__/ServiceEditorView.test.ts`
**Commit:** `d632a904`
**Applied fix:** Added a single shared `isAiEnabled` computed to the auth store (`aiMasterEnabled.value && settings.value.aiEnabled`), mirroring `claudeApi.ts`'s existing two-gate `isAiEnabled()` exactly. Switched all four cited UI sites from the bare `authStore.settings.aiEnabled` read to `authStore.isAiEnabled`: `SongSlotPicker.vue`'s AI Picks panel, `ScriptureInput.vue`'s AI Scripture Search block, `CongregationalEditor.vue`'s AI split button, and `ServiceEditorView.vue`'s `aiEnabled` prop feeding `buildActionBarItems`'s ✉ "Suggest all" action-bar item. Left `claudeApi.ts`'s own `isAiEnabled()` untouched (it was already correctly two-gated per the review; a first pass delegated it to the new store computed but was reverted after discovering it would require re-mocking `authStore.isAiEnabled` across `claudeApi.test.ts`'s three `aiEnabled` describe blocks for no behavior change — out of scope for this finding). Added/extended tests: new `isAiEnabled` describe block in `auth.test.ts` (3 cases: master-off, settings-off, both-on); new negative "master gate off, settings on" test in each of `CongregationalEditor.test.ts` and `SongSlotPicker.test.ts` and `ScriptureInput.test.ts`; existing positive-path tests in `CongregationalEditor.test.ts` and `SongSlotPicker.test.ts` updated to also set `authStore.aiMasterEnabled = true` (the real Pinia store's `aiMasterEnabled` ref defaults to `false` — off-by-default per R242 — so tests using the real store needed the master gate explicitly enabled to keep their prior "AI on" assumption); `ServiceEditorView.test.ts`'s mocked `authStore` shape extended with `isAiEnabled: true`. Gate: `npx vitest run` for the 4 affected component/view files + `auth.test.ts` — 402 + 101 = 503/503 passed. `npm run type-check` (full `vue-tsc --build`) — clean. Full app suite (`npx vitest run`) — 4256/4283 passed; all 27 failures confined to the pre-existing known baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) — no new failures.

### IN-01: `setOrgAiEnabledHandler` leaves stale audit fields from the opposite transition

**Files modified:** `functions/src/orgProvisioning.ts`, `functions/src/orgProvisioning.test.ts`
**Commit:** `84b2b61a`
**Applied fix:** ENABLE now also writes `aiDisabledAt: FieldValue.delete()` / `aiDisabledBy: FieldValue.delete()` in the same merge; DISABLE now also writes `aiEnabledAt: FieldValue.delete()` / `aiEnabledBy: FieldValue.delete()`. Prevents a stale opposite-transition audit pair from being misread as "still disabled by X" (or vice versa) after a later re-toggle. Added a `delete: vi.fn(() => "DELETE_SENTINEL")` case to the module's `FieldValue` mock and updated the three existing exact-payload `toHaveBeenCalledWith` assertions (ENABLE, DISABLE, and the DISABLE edge-case re-force test) to include the new delete-sentinel keys. Gate: `cd functions && npx vitest run src/orgProvisioning.test.ts` — 62/62 passed. `cd functions && npm run build` — clean.

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-08-24T18:54:05Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
