---
phase: 129-admin-resend-email-copy
reviewed: 2026-09-06T20:58:56Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - functions/src/volunteerLink.ts
  - functions/src/index.ts
  - functions/src/index.test.ts
  - src/views/RosterView.vue
  - src/views/__tests__/RosterView.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 129: Code Review Report

**Reviewed:** 2026-09-06T20:58:56Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the `adminVolunteerLink` authenticated callable, the `mintVolunteerLink` extraction from Phase 128's shared core, and the RosterView "Sign-in Link" client affordance.

**Authorization is correct.** `adminVolunteerLinkHandler` (functions/src/index.ts:2660-2714) requires `request.auth`, re-reads `organizations/{orgId}/members/{request.auth.uid}` from Firestore (never trusting the client-declared orgId), and rejects any role other than `"editor"`/`"admin"`. Cross-org is correctly denied: an editor of org A supplying org B's `orgId` looks up `members` under org B, where no doc exists for that uid, so `permission-denied` fires before any roster read. This exactly mirrors the established `queueServiceMessageHandler` re-check pattern (index.ts:1713-1721), and the test matrix (index.test.ts:6415-6521, DENY-1 through DENY-6) exercises unauthenticated, non-member, viewer-role, and cross-org cases plus admin-role parity — all pass.

**Refactor is safe.** `git show 0402ce97` confirms the `mintVolunteerLink` extraction is a byte-identical hoist of the existing `generateSignInWithEmailLink` call and `actionCodeSettings` construction out of `mintAndSendVolunteerLink` — no logic changed, only composed differently. `mintAndSendVolunteerLink`'s signature, send behavior, and the Phase 128 enumeration-safety machinery (generic response, timing pad, dedicated rate-limit collections) are completely untouched by this phase; `requestVolunteerLinkHandler` does not call any new code path.

**Roster gate + normalization are correct** and appropriately honest-error (not enumeration-constrained) for this authenticated-editor path, exactly as intended.

**Copy-mode link exposure** is properly scoped to an authorized editor only, and the client never logs the raw link (only `console.error(err)` on failure, which cannot contain the link since the link isn't captured on a rejected promise).

Two gaps are worth fixing before this ships further: an inconsistency with the codebase's established cost-guardrail convention for editor-triggered Resend sends, and a silent no-feedback failure mode in the client's copy-link path.

## Warnings

### WR-01: `adminVolunteerLink`'s `mode:"email"` send has no rate limit or quota, unlike every other Resend-sending path in this codebase

**Outcome: FIXED** (commit `7ef9e547`, branch `gsd-reviewfix/129-291391`, fast-forwarded onto `master`). Layered the existing `checkAndConsumeOrgEmailQuota` / `volunteerLinkOrgCounters` mechanism (Phase 128) onto the `mode:"email"` branch — over-limit throws an honest `resource-exhausted` error, no mint/send; `mode:"copy"` is unaffected (mint-only, never consumes the quota); a Firestore transaction failure fails open, mirroring `queueServiceMessageHandler`'s guardrail idiom. Proved with 3 new tests in `functions/src/index.test.ts` (`adminVolunteerLinkHandler` describe block): over-limit email → `resource-exhausted`, no mint/send; copy mode unaffected by an exhausted quota; throttle fails open on a Firestore transaction throw. `cd functions && npx vitest run src/index.test.ts` — 342/342 passed. `cd functions && npm test` — 704/704 passed (19 files). `npm run type-check` — clean.

**File:** `functions/src/index.ts:2708-2710`
**Issue:** Every other authenticated, editor-triggered function that spends the shared `RESEND_API_KEY` layers a per-uid rate limit and/or a per-org daily quota on top of its role check — `queueServiceMessageHandler` checks `msgEnqueueOrgCounters` (index.ts:1759-1775) before even reaching its per-uid enqueue-rate ceiling, and the public `requestVolunteerLinkHandler` layers both a per-(orgId,email) limiter and a `VOLUNTEER_LINK_MAX_PER_ORG_PER_DAY` throttle (index.ts:2516-2567). `adminVolunteerLinkHandler`'s `mode:"email"` branch has none of this: a single compromised or malicious editor account can call it in a tight loop against the same (or every) rostered email, each iteration minting a real Firebase sign-in link and sending a real Resend email, with no ceiling before the org's actual daily Resend budget is exhausted (potentially starving the org's other transactional email — reminders, invites — for the rest of the day) or a volunteer is spammed. The phase's own threat-model comment (index.ts:2634-2643) documents the impersonation tradeoff (T-129-03) but is silent on cost/spam abuse via repeated `mode:"email"` calls, and no such control exists elsewhere in this handler.
**Fix:** Layer the same `checkAndConsumeOrgEmailQuota(db, orgId, 1, config.messaging.orgDailyEmailQuota, Date.now(), "orgEmailCounters")` check (or a dedicated `adminVolunteerLinkOrgCounters` collection, matching this phase's own "dedicated collection" convention) before the `mode === "email"` send, mirroring `queueServiceMessageHandler`'s org-quota-before-send ordering:
```typescript
if (mode === "email") {
  const config = await getAppConfig(db);
  const quota = await checkAndConsumeOrgEmailQuota(
    db, orgId, 1, config.messaging.orgDailyEmailQuota, Date.now(), "orgEmailCounters",
  );
  if (!quota.allowed) {
    throw new HttpsError("resource-exhausted", "This organization has reached its daily email limit.");
  }
  await mintAndSendVolunteerLink({ db, to: emailLower, orgName, slug });
  return { sent: true };
}
```
(A `resource-exhausted` honest error is fine here — this path is not enumeration-constrained, unlike the public callable.)

### WR-02: `onCopySignInLink` silently no-ops when `data.link` is falsy or `navigator.clipboard` is unavailable

**Outcome: FIXED** (commit `c68e5b61`, branch `gsd-reviewfix/129-291391`, fast-forwarded onto `master`). Added an `else` branch that sets `linkCopyError.value = "Couldn't copy — try again"` (with the same 3s auto-clear as the existing catch block) whenever `data.link` is falsy or `navigator.clipboard` is unavailable, exactly as suggested. Proved with 2 new tests in `src/views/__tests__/RosterView.test.ts`: a resolved response with no `link`, and a resolved response with a `link` but `navigator.clipboard` stubbed to `undefined` — both surface the error label. `npx vitest run src/views/__tests__/RosterView.test.ts` — 28/28 passed. `npm run type-check` — clean.

**File:** `src/views/RosterView.vue:748-773`
**Issue:** The success path is gated by `if (data.link && navigator.clipboard) { ... }` (line 757) with no `else` branch. If the callable resolves successfully but `navigator.clipboard` is undefined (a real, reachable case: non-secure/`http://` context, an older browser, or a browser where Clipboard-API permission was denied without throwing), the function falls through to `finally { copyingLink.value = false }` having done nothing — no toast, no `linkCopyError`, no `linkCopied`. The button simply reverts from "Copying…" back to "Copy sign-in link" with zero user-visible feedback, even though a real Firebase sign-in link was minted server-side. An admin clicking repeatedly gets no signal that anything is wrong and has no path to actually deliver the link. The test suite does not exercise this branch either — `src/views/__tests__/RosterView.test.ts` only covers the happy path (line 515) and a callable *rejection* (implicitly, via the analogous email-mode test at line 552; there is no copy-mode rejection or clipboard-unavailable test at all).
**Fix:** Treat a missing link or missing Clipboard API as a failure, not a silent no-op:
```typescript
if (data.link && navigator.clipboard) {
  await navigator.clipboard.writeText(data.link)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
} else {
  linkCopyError.value = "Couldn't copy — try again"
  setTimeout(() => { linkCopyError.value = null }, 3000)
}
```
Add a corresponding test asserting the error label appears when `navigator.clipboard` is stubbed out or `data.link` is omitted from the mocked response.

## Info

### IN-01: Generic error toast on `mode:"email"` failure suggests a fallback ("use Copy … instead") that would fail identically for authorization-driven failures

**File:** `src/views/RosterView.vue:740-742`
**Issue:** On any `adminVolunteerLink` rejection (network error, Resend outage, or — if the caller's role changed between page load and click — a `permission-denied`), the toast always reads "Could not send the sign-in link to {name}. Try again, or use Copy sign-in link instead." For a `permission-denied` case specifically, "use Copy … instead" is misleading — the copy button calls the exact same authorization-gated callable and would fail the same way. This is a minor UX polish item, not a functional defect (the underlying authz gate documented in Requirement 1 is sound either way).
**Fix:** Optional: inspect the error's `code` (Firebase callable errors surface `.code`) and tailor the message, or drop the "use Copy instead" suggestion for non-network error codes.

### IN-02: `AdminVolunteerLinkRequest`/`Response` shapes are hand-duplicated on the client with no shared source of truth

**File:** `src/views/RosterView.vue:706-714`
**Issue:** The comment at line 702-705 correctly explains *why* (functions/src is a separate tsconfig project), and this mirrors an existing codebase pattern, so it is not a new defect — but it is worth flagging as a standing maintenance risk: if `functions/src/index.ts`'s `AdminVolunteerLinkRequest`/`AdminVolunteerLinkResponse` shapes ever change (e.g., a new required field), nothing will force this client copy to be updated in lockstep; a mismatch would only surface at runtime via a callable rejection, not a type error.
**Fix:** No action required for this phase (consistent with established precedent). If this duplication pattern recurs for future callables, consider a small shared `.d.ts` published from `functions/src` for the client to import as types-only (no runtime coupling), eliminating the drift risk.

---

_Reviewed: 2026-09-06T20:58:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
