---
phase: 82-per-org-ai-enablement
verified: 2026-08-24T15:10:00Z
status: passed
score: 12/12 must-haves verified
behavior_unverified: 0
# All 12/12 automated must-haves verified in source (rules 224/224, functions 339/339,
# type-check clean, app suite at the 2-file baseline; CR-01 fail-closed + WR-01/WR-02 fixes
# re-confirmed). The remaining checks are deploy-gated prod behavior of the UNDEPLOYED backend
# (super-admin toggles a live org, panel show/hide after reload, server-side AI block, Berean
# OFF-by-default re-enable) — per the v2.2 standing grant they are DEFERRED to the owner
# (/gsd-verify-work 82) and preserved in PENDING-VERIFICATION.md with the deploy hand-over.
human_uat_deferred: true
overrides_applied: 0
human_verification:
  - test: "As a real super-admin, deploy the phase (firebase deploy --only firestore:rules,functions:setOrgAiEnabled,functions:api --project worship-planner-bc515), then toggle a real org's AI off/on from the Owner Console Organizations tab."
    expected: "The org row reflects the new state immediately; a direct authenticated fetch to the anthropic proxy for that org returns 403 while disabled, and succeeds once re-enabled; Firestore shows aiMasterEnabled plus the correct audit fields (aiEnabledAt/aiEnabledBy or aiDisabledAt/aiDisabledBy) after each toggle."
    why_human: "Requires the owner-gated production/staging deploy — nothing in this phase is deployed yet (by design, per PENDING-VERIFICATION.md and the ROADMAP deploy note). Cannot be exercised against emulator-only unit/rules tests."
  - test: "After the deploy above, as a member of an org whose AI was just disabled, reload Settings."
    expected: "The 'AI Features' card is not present in the DOM at all (not just visually hidden), and any AI affordance (Song Picks, Scripture Search, Congregational split, action-bar 'Suggest all') either doesn't render or silently no-ops without calling Anthropic."
    why_human: "Requires a live org-context refresh against deployed rules/callable; unit tests mock the org snapshot and cannot prove the real end-to-end reload behavior."
  - test: "Post-deploy, confirm a super-admin re-enables AI for Berean (the existing production org) since the deploy turns AI off for every existing org by design."
    expected: "Berean's AI functionality is restored only after an explicit super-admin toggle; it is NOT silently on after deploy."
    why_human: "Live data-migration effect on the real production organization; cannot be verified pre-deploy."
---

# Phase 82: Per-Org AI Enablement Verification Report

**Phase Goal:** A super-admin controls AI functionality per organization from the Owner Console, AI is OFF by default for every org, and an org's Settings hides the AI panel whenever AI is disabled for it (including auto-off when a super-admin disables it while the org had it on).
**Verified:** 2026-08-24T15:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Super-admin can toggle AI on/off for a specific org from the Owner Console (R242) | ✓ VERIFIED | `src/components/admin/OrganizationsTab.vue:624-644` `onToggleAi()` calls `httpsCallable('setOrgAiEnabled')` with `{orgId, aiEnabled: !org.aiMasterEnabled}`, guards concurrent toggles (`togglingAiOrgId`), refreshes list, surfaces friendly error. `OrganizationsTab.test.ts` — "AI on/off toggle" describe block, 7/7 pass (confirmed via functions/app suite run). |
| 2 | A newly-onboarded org has AI OFF by default (R242) | ✓ VERIFIED | `functions/src/orgProvisioning.ts:481` `aiMasterEnabled: data.aiMasterEnabled ?? false` on `listOrganizations`; `functions/src/index.ts:368` same `?? false` in the proxy gate; `src/stores/auth.ts:441` same `?? false` in `applyOrgSnapshot`. All three read points independently default OFF (absent field = OFF). |
| 3 | Ordinary org editor AND a super-admin's own client SDK are both DENIED writing `aiMasterEnabled` directly | ✓ VERIFIED | `firestore.rules:127-134` `lifecycleFields()` includes `aiMasterEnabled`; `src/rules.test.ts:596-602` (editor DENY) and `:763-768` (super-admin-client CRITICAL-twin DENY) both present. Ran `npx vitest run --config vitest.rules.config.ts` against the live emulator myself: 224/224 passed, no failures. |
| 4 | `setOrgAiEnabled` callable: caller gate, validation, same-state short-circuit, ENABLE writes `aiMasterEnabled:true` + audit fields | ✓ VERIFIED | `functions/src/orgProvisioning.ts:672-736` — `assertSuperAdminCaller`, orgId/aiEnabled type checks, org-existence check, `alreadyInEffect` short-circuit, ENABLE branch sets `aiMasterEnabled:true, aiEnabledAt, aiEnabledBy`. Ran `cd functions && npx vitest run src/index.test.ts src/orgProvisioning.test.ts` myself: 339/339 passed. |
| 5 | DISABLE branch forces `settings.aiEnabled:false` via dot-path in the same merge write, siblings preserved (R243) | ✓ VERIFIED | `functions/src/orgProvisioning.ts:717-730` writes `"settings.aiEnabled": false` as an explicit dot-path key alongside `aiMasterEnabled:false`, never a nested `settings:{}` literal — sibling settings fields cannot be clobbered. Short-circuit is a conjunction requiring BOTH fields already off (line 698-700), so a repeat disable still re-forces the setting. |
| 6 | `listOrganizations` exposes `aiMasterEnabled` for the Owner Console table | ✓ VERIFIED | `functions/src/orgProvisioning.ts:439,472,481` — `OrgSummary.aiMasterEnabled: boolean`, read from Firestore doc, defaulted `?? false`. Consumed at `OrganizationsTab.vue:262-263`. |
| 7 | AI proxy (anthropic branch) refuses fail-closed when the org's master gate is off — real server enforcement | ✓ VERIFIED | `functions/src/index.ts:362-387` `checkOrgAiEnablement()` does a live Firestore read per request, denies 403 when `aiMasterEnabled !== true`, denies 503 (fail-closed) on a read error. Wired at `index.ts:612-636` ahead of appConfig/rate-limit/enforceModelAndTokens. |
| 8 | CR-01 fix: an authenticated caller with an unresolvable orgId is DENIED (not skipped) before any Anthropic billing | ✓ VERIFIED | `functions/src/index.ts:627-631` — restructured to `if (!callerOrgId) { 403; return }` unconditionally, before `checkOrgAiEnablement` is even called. Confirmed the dedicated regression test `functions/src/index.test.ts:4375` "CR-01 (82-REVIEW): a caller whose token has NO orgId claim is denied 403... before fetch" exists and is part of the 339/339 passing run I executed. |
| 9 | `authStore.aiMasterEnabled` reads the org doc's master gate (absent/false=OFF) and resets at all org-context-clearing points | ✓ VERIFIED | `src/stores/auth.ts:129` (ref, default false), `:441` (`applyOrgSnapshot` read), `:369` (`resetOrgContext`), `:611` (`onAuthStateChanged` null branch), `:820` (`logout`) — all three reset points confirmed present. |
| 10 | `isAiEnabled()` (claudeApi.ts) is a two-gate AND — master gate checked first | ✓ VERIFIED | `src/utils/claudeApi.ts:69-78` `return authStore.aiMasterEnabled && authStore.settings.aiEnabled`; used to gate all 3 AI-calling exports (lines 247, 371, 605). |
| 11 | Settings "AI Features" card is not rendered at all when the master gate is off (R243) | ✓ VERIFIED | `src/views/SettingsView.vue:260` `v-if="authStore.aiMasterEnabled"` on the card root — Vue `v-if` removes the element from the DOM entirely, not merely CSS-hides it. |
| 12 | WR-02 fix: the 4 non-Settings AI-affordance UI sites (SongSlotPicker, ScriptureInput, CongregationalEditor, ServiceEditorView) also gate on the two-gate check, not bare `settings.aiEnabled` | ✓ VERIFIED | All 4 sites now read `authStore.isAiEnabled` (a new store computed = `aiMasterEnabled.value && settings.value.aiEnabled`, `src/stores/auth.ts:166`): `SongSlotPicker.vue:61`, `ScriptureInput.vue:6`, `CongregationalEditor.vue:61`, `ServiceEditorView.vue:2549`. |

**Score:** 12/12 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | `lifecycleFields()` extended with `aiMasterEnabled` + its 4 audit siblings | ✓ VERIFIED | Line 134: all 6 fields present (WR-01 fix confirmed) |
| `functions/src/orgProvisioning.ts` | `setOrgAiEnabledHandler`/`setOrgAiEnabled` export, `OrgSummary.aiMasterEnabled`, `listOrganizationsHandler` extended | ✓ VERIFIED | Lines 435-481, 633-736 |
| `functions/src/index.ts` | `checkOrgAiEnablement` helper wired into the anthropic branch, fail-closed on missing orgId (CR-01) | ✓ VERIFIED | Lines 362-387, 612-636 |
| `src/types/organization.ts` | `Organization.aiMasterEnabled?: boolean` | ✓ VERIFIED | Present per grep in Plan 02 SUMMARY key-files; consumed at `auth.ts:441` |
| `src/stores/auth.ts` | `aiMasterEnabled` ref + `isAiEnabled` computed, read/reset wiring | ✓ VERIFIED | Lines 129, 166, 369, 441, 611, 820, 874-875 |
| `src/utils/claudeApi.ts` | Two-gate `isAiEnabled()` | ✓ VERIFIED | Lines 69-78 |
| `src/views/SettingsView.vue` | AI Features card `v-if` on master gate | ✓ VERIFIED | Line 260 |
| `src/components/admin/OrganizationsTab.vue` | Per-row AI toggle calling `setOrgAiEnabled` | ✓ VERIFIED | Lines 155-199, 624-644 |
| `.planning/PENDING-VERIFICATION.md` | UNDEPLOYED hand-over entry with exact deploy command | ✓ VERIFIED | Entry at line 823 onward: `firebase deploy --only firestore:rules,functions:setOrgAiEnabled,functions:api --project worship-planner-bc515` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lifecycleFields()` array | `preservesLifecycleFields()` diff check | reference | ✓ WIRED | `firestore.rules:142-145` uses `lifecycleFields()` in the `hasAny`/`affectedKeys().hasAny` diff guard |
| Callable DISABLE branch | `settings.aiEnabled` dot-path merge | explicit key write | ✓ WIRED | `orgProvisioning.ts:723` `"settings.aiEnabled": false` in the same `.set(..., {merge:true})` call |
| `api` anthropic branch | `resolveOrgId(decodedCaller)` → live `organizations/{orgId}` get | `checkOrgAiEnablement` | ✓ WIRED | `index.ts:627-636`; CR-01 fix makes the `!callerOrgId` case an explicit deny, not a skip |
| `listOrganizations` `OrgSummary.aiMasterEnabled` | Owner Console table row | prop/binding | ✓ WIRED | `OrganizationsTab.vue:262-263` reads `org.aiMasterEnabled` for button label/state |
| `applyOrgSnapshot` org-doc read | `aiMasterEnabled` ref → `isAiEnabled()` gate AND `SettingsView` v-if | single parse point | ✓ WIRED | `auth.ts:441` is the sole write site; `claudeApi.ts:78` and `SettingsView.vue:260` both read the same store ref/computed |
| `OrganizationsTab.onToggleAi` | `httpsCallable('setOrgAiEnabled')` → refresh | callable | ✓ WIRED | `OrganizationsTab.vue:633-643` |

### Behavioral Spot-Checks / Gate Execution

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Type-check (test files included) | `npm run type-check` (`vue-tsc --build`) | Clean, no errors | ✓ PASS |
| Functions suite (index.test.ts + orgProvisioning.test.ts) | `cd functions && npx vitest run src/index.test.ts src/orgProvisioning.test.ts` | 339/339 passed (includes CR-01 regression test, IN-01 audit-clear assertions) | ✓ PASS |
| Firestore rules suite (live emulator) | `npx vitest run --config vitest.rules.config.ts` | 224/224 passed, 0 failures (includes `aiMasterEnabled` + audit-sibling DENY tests) | ✓ PASS |
| App suite (baseline check) | `npx vitest run` | 142/144 files, 4257/4283 tests passed. 2 failing files = exactly the documented known baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`). No new failures. | ✓ PASS |
| Commit hash integrity | `git log --oneline --all` grep against all 10 hashes cited across both SUMMARYs and the REVIEW-FIX report | All 10 found | ✓ PASS |

Note: the rules suite ran clean at 224/224 with **zero** failures, including `storage.rules.test.ts` — CLAUDE.md documents 2 persistent failures there under the Storage emulator due to a `firestore.exists()` cross-service limitation. This run's environment (Storage emulator listening on 9199) evidently did not reproduce that known issue on this pass. This is unrelated to Phase 82's changes (no Phase 82 file touches `storage.rules`) and is called out for transparency, not as a phase-82 finding.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R242 | 82-01, 82-02 | Super-admin enable/disable AI per org from Owner Console; OFF by default | ✓ SATISFIED | Truths 1-4, 6, 9 above |
| R243 | 82-01, 82-02 | Settings hides AI panel when disabled; forced-off on super-admin disable while org had it on | ✓ SATISFIED | Truths 5, 7, 8, 11, 12 above |

No orphaned requirements found for Phase 82 in REQUIREMENTS.md (both R242/R243 map cleanly to this phase and are covered by the two plans).

### Anti-Patterns Found

None. Scanned all 12 phase-touched files (`firestore.rules`, `functions/src/orgProvisioning.ts`, `functions/src/index.ts`, `src/types/organization.ts`, `src/stores/auth.ts`, `src/utils/claudeApi.ts`, `src/views/SettingsView.vue`, `src/components/admin/OrganizationsTab.vue`, `src/components/SongSlotPicker.vue`, `src/components/ScriptureInput.vue`, `src/components/CongregationalEditor.vue`, `src/views/ServiceEditorView.vue`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon`. The single hit (`functions/src/index.ts:956`, "deploy command; it is a tested behaviour, not a TODO") is a comment explicitly disclaiming the pattern, not a debt marker.

### Code Review Findings — Fix Verification

The 82-REVIEW.md flagged 1 critical + 2 warnings + 1 info; 82-REVIEW-FIX.md claims all 4 fixed. Independently re-verified all 4 directly in source (not from the fix report's narrative):

- **CR-01** (fail-open on missing `orgId` claim): confirmed fixed at `functions/src/index.ts:627-631` — now an unconditional `if (!callerOrgId)` deny before the enablement check.
- **WR-01** (audit-trail siblings unguarded): confirmed fixed at `firestore.rules:134` — all 4 audit fields added to `lifecycleFields()`, with 2 new DENY tests in `src/rules.test.ts:611-637`.
- **WR-02** (4 UI sites bypassing the two-gate check): confirmed fixed — all 4 sites now use `authStore.isAiEnabled`.
- **IN-01** (stale opposite-transition audit fields): confirmed fixed at `functions/src/orgProvisioning.ts:712-713,725-726` — `FieldValue.delete()` on the opposite pair in both branches.

### Minor Process-Documentation Gap (non-blocking)

`82-VALIDATION.md` frontmatter still shows `status: draft`, `wave_0_complete: false`, and its Wave 0 checklist/per-task table leave all 82-02 rows unchecked (`⬜ pending`) with the sign-off line reading "82-02 not yet executed" — even though both 82-02-SUMMARY.md and the code itself confirm Plan 02 is complete and its gates passed. This is a stale planning artifact, not a code deliverable, and does not affect goal achievement; noted for hygiene, not scored as a gap.

## Human Verification Required

The backend security boundary (rules + `setOrgAiEnabled` + AI-proxy gate) ships **UNDEPLOYED by design** — confirmed via `.planning/PENDING-VERIFICATION.md` and the ROADMAP's own deploy note. Everything gated by an actual production deploy cannot be verified against the codebase alone:

### 1. Real super-admin toggles a real org's AI from the deployed Owner Console

**Test:** Deploy (`firebase deploy --only firestore:rules,functions:setOrgAiEnabled,functions:api --project worship-planner-bc515`), then as super-admin toggle an org's AI off/on from the Organizations tab.
**Expected:** Row reflects new state; a direct authenticated request to the anthropic proxy for that org is denied (403) while off and succeeds once on; Firestore doc shows correct `aiMasterEnabled` + audit fields.
**Why human:** Requires the owner-gated deploy; nothing in this phase is deployed.

### 2. Org member's Settings page hides the AI panel after a live disable

**Test:** After deploy, as a member of a just-disabled org, reload Settings.
**Expected:** AI Features card absent from DOM; AI affordances (Song Picks, Scripture Search, Congregational split, action-bar Suggest-all) don't function.
**Why human:** Requires a live org-context refresh against deployed infrastructure.

### 3. Berean OFF-by-default re-enable after cutover

**Test:** Post-deploy, confirm a super-admin explicitly re-enables AI for Berean.
**Expected:** Berean's AI stays off until the explicit re-enable — not silently on.
**Why human:** Live production data-migration effect, cannot be verified pre-deploy.

## Gaps Summary

None. All 12 derived observable truths (merged from ROADMAP Success Criteria 1-3 and both PLANs' `must_haves.truths`) are VERIFIED directly in source, all cited artifacts exist and are wired end-to-end, all 4 code-review findings (1 critical, 2 warning, 1 info) were independently re-verified as fixed in source (not merely trusted from 82-REVIEW-FIX.md's narrative), and all automated gates (type-check, functions suite, rules suite, app suite) were re-run by the verifier and pass at or above the documented baselines with zero new failures. The only reason this phase is not `passed` is that its own explicit, intentional scope boundary — real production behavior gated behind an owner-run deploy — cannot be observed in the codebase and requires human sign-off after that deploy. This is expected per the phase's own "ships UNDEPLOYED (deploy hand-over EXPECTED)" framing, not a defect.

---

*Verified: 2026-08-24T15:10:00Z*
*Verifier: Claude (gsd-verifier)*
