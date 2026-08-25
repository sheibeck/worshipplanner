---
phase: 82-per-org-ai-enablement
reviewed: 2026-08-24T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - firestore.rules
  - functions/src/orgProvisioning.ts
  - functions/src/index.ts
  - src/types/organization.ts
  - src/stores/auth.ts
  - src/utils/claudeApi.ts
  - src/views/SettingsView.vue
  - src/components/admin/OrganizationsTab.vue
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 82: Code Review Report

**Reviewed:** 2026-08-24T00:00:00Z
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed all six Phase 82 commits (82-01 backend: firestore.rules, orgProvisioning.ts's
`setOrgAiEnabled`, index.ts's AI-proxy gate; 82-02 client: Organization type, auth store,
claudeApi.ts's two-gate `isAiEnabled()`, SettingsView.vue's card hide, OrganizationsTab.vue's
toggle) against their individual parents, plus the functions bundled with them
(`assertSuperAdminCaller`, `resolveOrgId`, `verifyAppCaller`) to trace the full trust chain from
an HTTP request through to the Anthropic upstream fetch.

The rules guard, the callable's caller-gate/validation/short-circuit logic, and the two-gate
client-side `isAiEnabled()` are all correctly built and match their design intent almost exactly
as documented. However, the server-side enforcement point — the one piece explicitly billed as
"the security control" in the commit message and code comments — has a real fail-*open* branch:
when the caller's ID token carries no `orgId` custom claim, the entire per-org AI-enablement
check is skipped, not denied. This is a pre-existing, legitimately reachable state
(`resolveOrgId`'s own doc comment: "an otherwise-valid caller with no org (yet)"; also true for a
super-admin who has entered an org without a synced membership doc, R226) and no test in the
suite exercises it through the `api` handler — every WR-04 wiring test hardcodes
`orgId: "org1"` on the mocked token. This is the standout finding below.

Two further issues degrade the phase's stated intent without being outright security bypasses:
the `firestore.rules` guard protects `aiMasterEnabled` itself but not the parallel audit-trail
fields the callable writes alongside it, and several AI-affordance UI surfaces outside
SettingsView.vue still gate on the church-level `settings.aiEnabled` alone, not the two-gate
check `claudeApi.ts` was hardened with.

Note: per `.planning/PENDING-VERIFICATION.md`, the backend (firestore.rules,
`setOrgAiEnabled`, the proxy gate) ships **UNDEPLOYED** with this phase — the CR-01 finding
below must be fixed before that deploy happens, not after.

## Critical Issues

### CR-01: The AI-proxy enablement gate is skipped (fail-open) for any caller whose token lacks an `orgId` claim

**File:** `functions/src/index.ts:621-628`
**Issue:**

```ts
const callerOrgId = resolveOrgId(decodedCaller!);
if (callerOrgId) {
  const enablementVerdict = await checkOrgAiEnablement(getFirestore(), callerOrgId);
  if (!enablementVerdict.ok) {
    res.status(enablementVerdict.status).json(enablementVerdict.error);
    return;
  }
}
```

`checkOrgAiEnablement` itself is correctly fail-closed (denies on a Firestore read error, denies
when `aiMasterEnabled` is false/absent — see `functions/src/index.ts:362-385` and its unit tests
at `functions/src/index.test.ts:4048-4113`). But the call is wrapped in `if (callerOrgId)`, and
`resolveOrgId` (`functions/src/index.ts:183-186`) returns `null` — not an error — whenever the
decoded ID token has no `orgId` custom claim. When that happens, the `if` body (the entire
enablement check) is never entered, and execution falls straight through to
appConfig/rate-limit/`enforceModelAndTokens` and the billed Anthropic `fetch`. This is a silent
**skip**, not a deny — the opposite of "fail closed."

This is not a hypothetical edge case:
- `resolveOrgId`'s own doc comment (`functions/src/index.ts:176-182`) states the null case is a
  legitimate, expected state: "an otherwise-valid caller with no org (yet) still gets a uid-only
  usage ledger entry instead of a failed request" — i.e. this proxy has always accepted org-less
  authenticated callers, and Phase 82 did not change that.
- A super-admin who has entered an org without ever creating a membership doc (documented as an
  accepted, intentional posture at `firestore.rules:220-233`, "R226 ... entering a church as a
  super-admin creates NO member doc") never gets an `orgId` claim synced for that org either
  (`syncOrgMembershipClaim` fires off membership *doc* writes), so a super-admin viewing an org
  with AI explicitly disabled can still drive the full-cost Anthropic proxy through this gap.
- Any authenticated Firebase user in the project who simply hasn't joined/created an org yet (or
  whose claim hasn't synced since signup) can call `/api/anthropic/...` and bypass the org gate
  entirely, regardless of any org's `aiMasterEnabled` state.

No test proves the intended behavior for this branch: `functions/src/index.test.ts:4268`'s
`verifyIdToken` mock for the entire "WR-04: anthropic branch end-to-end wiring" describe block
hardcodes `{ uid: "uid1", orgId: "org1" }` on every test, so the `if (callerOrgId)` false branch
is never exercised end-to-end. The dedicated `checkOrgAiEnablement` unit tests
(`functions/src/index.test.ts:4048-4113`) only test the function directly with an `orgId`
argument already supplied — they cannot catch a bug in the *caller's* decision of whether to
invoke it at all.

**Fix:** Treat an unresolvable org context as a denial, not a skip — this is a paid, gated
resource and an ambiguous caller should never reach it:

```ts
const callerOrgId = resolveOrgId(decodedCaller!);
if (!callerOrgId) {
  res.status(403).json({ error: "AI features require an organization." });
  return;
}
const enablementVerdict = await checkOrgAiEnablement(getFirestore(), callerOrgId);
if (!enablementVerdict.ok) {
  res.status(enablementVerdict.status).json(enablementVerdict.error);
  return;
}
```

Add a regression test to the WR-04 describe block with `verifyIdToken` resolving to a token
with no `orgId` claim, asserting a 403/denial and that `fetch` is never called.

## Warnings

### WR-01: `firestore.rules`'s lifecycle guard protects `aiMasterEnabled` but not its own audit-trail siblings

**File:** `firestore.rules:127-128`
**Issue:** `lifecycleFields()` is:

```
return ['active', 'deactivatedAt', 'deactivatedBy', 'reactivatedAt', 'reactivatedBy', 'aiMasterEnabled'];
```

Note that for `active`, all four of its audit siblings (`deactivatedAt`, `deactivatedBy`,
`reactivatedAt`, `reactivatedBy`) are listed alongside it — exactly the pattern the surrounding
comment (`firestore.rules:96-112`) says exists specifically to stop an ordinary editor from
forging the audit trail (T-76-06). `setOrgAiEnabledHandler` writes four analogous audit fields
(`functions/src/orgProvisioning.ts:701-719`: `aiEnabledAt`, `aiEnabledBy` on enable;
`aiDisabledAt`, `aiDisabledBy` on disable), but none of the four are added to `lifecycleFields()`.
The actual gate value (`aiMasterEnabled`) is correctly protected, so an ordinary editor cannot
flip AI on/off this way — but they *can* still `updateDoc(orgRef, { aiDisabledBy: '<uid of
choice>', aiDisabledAt: <forged timestamp> })` directly from the client, corrupting the
provenance trail this feature explicitly exists to preserve. `src/rules.test.ts` (lines 591-742)
tests the `aiMasterEnabled` DENY cases but has no equivalent test for the audit fields, so this
gap is untested as well as unguarded.

**Fix:** Extend the array:

```
return ['active', 'deactivatedAt', 'deactivatedBy', 'reactivatedAt', 'reactivatedBy',
        'aiMasterEnabled', 'aiEnabledAt', 'aiEnabledBy', 'aiDisabledAt', 'aiDisabledBy'];
```

### WR-02: AI-feature affordances outside SettingsView still gate on `settings.aiEnabled` alone, not the master gate

**File:** `src/components/SongSlotPicker.vue:58`, `src/components/ScriptureInput.vue:4`,
`src/components/CongregationalEditor.vue:61`, `src/views/ServiceEditorView.vue:2546` (feeds
`src/views/serviceEditorActionBar.ts:267`)
**Issue:** `claudeApi.ts`'s `isAiEnabled()` was deliberately hardened to an AND of both gates
(`src/utils/claudeApi.ts:69-76`: `authStore.aiMasterEnabled && authStore.settings.aiEnabled`),
and `SettingsView.vue`'s AI Features card is correctly `v-if="authStore.aiMasterEnabled"`
(`src/views/SettingsView.vue:260`). But every other place in the app that decides whether to
*show* an AI affordance checks `authStore.settings.aiEnabled` directly, never
`authStore.aiMasterEnabled`:

- `SongSlotPicker.vue:58` — `v-if="authStore.settings.aiEnabled && ..."` (song suggestions panel)
- `ScriptureInput.vue:4` — `v-if="showAiSuggest && authStore.settings.aiEnabled"`
- `CongregationalEditor.vue:61` — `v-if="authStore.settings.aiEnabled"` (AI split button)
- `ServiceEditorView.vue:2546` — passes `aiEnabled: authStore.settings.aiEnabled` into
  `buildActionBarItems`, which gates the ✉ "Suggest all" action-bar item on it
  (`serviceEditorActionBar.ts:267`)

Both `aiMasterEnabled` and `settings` are documented as loaded once per org-context switch, not
live-synced (`src/stores/auth.ts:124-131`, "Pitfall 2, 82-RESEARCH.md"). Between a super-admin
disabling AI for an org and the affected client's next org-context refresh, or in the
write-ordering race `orgProvisioning.ts`'s own comment calls out ("if it somehow drifted back on
... a concurrent settings save"), `aiMasterEnabled` and `settings.aiEnabled` can genuinely
disagree — and every one of these four sites will keep showing the AI affordance regardless,
where clicking it silently no-ops (the underlying `claudeApi.ts` functions correctly return
`null` via `isAiEnabled()`). This contradicts the phase's own stated intent
(`SettingsView.vue`'s comment: "the church's own AI panel is not rendered at all, not merely
disabled") — that treatment was applied only to the Settings card, not to the AI affordances a
user actually interacts with day to day.

**Fix:** Expose the two-gate result from a single place (e.g. an `authStore.isAiEnabled`
computed mirroring `claudeApi.ts`'s `isAiEnabled()`) and use it at all four sites instead of the
bare `settings.aiEnabled` read.

## Info

### IN-01: `setOrgAiEnabledHandler` leaves stale audit fields from the opposite transition

**File:** `functions/src/orgProvisioning.ts:701-719`
**Issue:** The ENABLE branch writes `aiEnabledAt`/`aiEnabledBy` but never clears a prior
`aiDisabledAt`/`aiDisabledBy` from an earlier disable, and vice versa for the DISABLE branch. Not
a security issue (the last-write audit fields are still correct for the *current* transition),
but a super-admin later inspecting the doc could reasonably read a stale `aiDisabledBy` as
meaning "still disabled by X" when the doc is actually re-enabled.
**Fix:** On ENABLE, also clear `aiDisabledAt`/`aiDisabledBy` (e.g. `FieldValue.delete()`); on
DISABLE, clear `aiEnabledAt`/`aiEnabledBy` similarly.

---

_Reviewed: 2026-08-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
