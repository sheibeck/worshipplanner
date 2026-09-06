---
phase: 129-admin-resend-email-copy
verified: 2026-09-06T17:10:00Z
status: human_needed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Email a rostered volunteer their sign-in link from RosterView's drawer and confirm a real email arrives via Resend"
    expected: "The volunteer receives an email (in prod, Resend test-mode only reaches the owner's inbox until DNS domain verification per backlog 999.6) containing a working /volunteer/verify?slug=... sign-in link"
    why_human: "Requires a live Resend send + real inbox check; cannot be verified by unit tests mocking Resend"
  - test: "Click 'Copy sign-in link' in a real browser (secure context) and paste the clipboard contents"
    expected: "The clipboard contains the exact minted sign-in link returned by the callable, and the button label flips to 'Link copied!' for ~2 seconds"
    why_human: "navigator.clipboard requires a real secure-context browser; jsdom/unit tests only prove the code path calls writeText with the right value, not that a real OS clipboard receives it"
---

# Phase 129: Admin Resend — Email & Copy Verification Report

**Phase Goal:** From the Volunteers page, an editor/admin can get a rostered volunteer their sign-in
link — either emailed as a standalone message or copied to the clipboard for their own channel —
reusing the same server-side mint/send core as the self-service request, under one authorization model.
**Verified:** 2026-09-06
**Status:** human_needed (all code-level checks passed; two human-only checks deferred to batched UAT per phase CONTEXT.md, marked PENDING not ACCEPTED)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An authenticated editor/admin can email a rostered volunteer their sign-in link (`mode:'email'` → `{ sent: true }`, via shared core) | ✓ VERIFIED | `functions/src/index.ts:2708-2710` calls `mintAndSendVolunteerLink`; test `ALLOW-1` (index.test.ts:6524) asserts `{ sent: true }`, `mockSend` called once, mint called once with normalized email |
| 2 | An authenticated editor/admin can obtain a rostered volunteer's raw link WITHOUT sending (`mode:'copy'` → `{ link }`, no Resend call) | ✓ VERIFIED | `index.ts:2712-2713` calls `mintVolunteerLink` only; test `ALLOW-2` (index.test.ts:6539) asserts `{ link }` returned, `mockSend` NOT called |
| 3 | Unauthenticated / non-member / non-editor / cross-org caller is denied, no mint or send | ✓ VERIFIED | `index.ts:2663-2687`; tests `DENY-1..4` (index.test.ts:6415-6465) each assert the correct `HttpsError` code and `mockSend` not called |
| 4 | Target not on roster, or roster entry with no email, yields an honest `HttpsError` (not generic success), no mint/send | ✓ VERIFIED | `index.ts:2700-2706`; tests `DENY-5` + "roster entry present but with no email" (index.test.ts:6468, 6481) assert `failed-precondition` and both mint+send NOT called |
| 5 | Exactly one code path mints the link (`mintVolunteerLink`), used by both `copy` and the existing `mintAndSendVolunteerLink` composition (R402) | ✓ VERIFIED | `grep -c 'generateSignInWithEmailLink' functions/src/volunteerLink.ts` = 1; `volunteerLink.ts:73` shows `mintAndSendVolunteerLink` calling `mintVolunteerLink`; `index.ts:2712` shows the copy branch also calling `mintVolunteerLink`; ALLOW-1/2 assert the mint mock called exactly once per invocation |
| 6 | `mintAndSendVolunteerLink` signature/behavior unchanged so Phase 128's `requestVolunteerLinkHandler` still works | ✓ VERIFIED | `MintAndSendVolunteerLinkArgs` unchanged (`volunteerLink.ts:20-29`); full `requestVolunteerLinkHandler` describe block (index.test.ts, DENY-1..DENY-3b, ALLOW-1/2, byte-identical-body test) all pass unchanged — `cd functions && npx vitest run src/index.test.ts src/volunteerLink.test.ts` → 343/343 passed |
| 7 | RosterView drawer shows Email/Copy actions only for a volunteer WITH an email; no-email shows explanatory text instead | ✓ VERIFIED | `RosterView.vue:467-490` (`v-if="editingPerson.email"` / `v-else`); test "hides the Email/Copy buttons and shows the explanatory line for a person with NO email" passes |
| 8 | Copy action writes the returned link to `navigator.clipboard` and flips the button label transiently; Email action shows success/error toast | ✓ VERIFIED | `RosterView.vue:748-773` (`onCopySignInLink`), `:730-746` (`onEmailSignInLink`); RosterView.test.ts tests for both paths pass, including the rejection→error-toast case |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/volunteerLink.ts` | exports `mintVolunteerLink`, sole mint call site | ✓ VERIFIED | Exported at L49; `mintAndSendVolunteerLink` composes it at L73; grep confirms exactly 1 `generateSignInWithEmailLink` occurrence |
| `functions/src/index.ts` | exports `adminVolunteerLink` onCall + handler + typed request/response | ✓ VERIFIED | `AdminVolunteerLinkRequest`/`Response` (L2645-2654), `adminVolunteerLinkHandler` (L2660), `export const adminVolunteerLink = onCall({ secrets: [RESEND_API_KEY] }, ...)` (L2720-2723) — top-level export, single occurrence confirmed by grep |
| `functions/src/index.test.ts` | `describe adminVolunteerLinkHandler` ALLOW/DENY matrix + single-mint-path | ✓ VERIFIED | Nested describe at L6402 with DENY-1..6 + a no-email-roster case + ALLOW-1..3, all passing; mint-exactly-once assertions present in ALLOW-1/2 |
| `src/views/RosterView.vue` | Sign-in Link drawer section + handlers + busy refs | ✓ VERIFIED | Section at L459-491; handlers/state at L701-773 |
| `src/views/__tests__/RosterView.test.ts` | firebase/functions mock + clipboard stub + toast assertions | ✓ VERIFIED | Mocks at L20-28 area; describe block "RosterView — drawer Sign-in Link section (129-02, R400/R401)" at L478 with 5 passing tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `adminVolunteerLinkHandler` 'copy' branch | `mintVolunteerLink` | direct call, no second mint site | ✓ WIRED | `index.ts:2712`; grep confirms no second `generateSignInWithEmailLink` call site introduced in index.ts for this feature (the pre-existing `rehearseLink` mint at `index.ts:2200` is a separate, unrelated Phase-125/R375 feature — scheduled-reminder email rehearse-links — not part of this phase's mint core, and the plan's acceptance criteria scoped the "exactly one occurrence" check to `volunteerLink.ts`, which holds) |
| `export const adminVolunteerLink` | `onCall({ secrets: [RESEND_API_KEY] })` | top-level export | ✓ WIRED | `index.ts:2720-2723`; `grep -c "export const adminVolunteerLink = onCall"` = 1 |
| authz re-check | `members/{uid}` under SUPPLIED orgId | server-resolved orgRef, never trusts client role | ✓ WIRED | `index.ts:2676-2687`; DENY-2/3/4 tests confirm cross-org and non-editor callers fail closed |
| `RosterView.vue` handlers | `adminVolunteerLink` callable | `httpsCallable(functions, 'adminVolunteerLink')({orgId, email, mode})` | ✓ WIRED | `RosterView.vue:735-738, 753-756`; RosterView.test.ts asserts the callable name and args |
| roster gate | `organizations/{orgId}/people` | full-fetch + in-memory case-insensitive email match | ✓ WIRED | `index.ts:2694-2706`; DENY-5 + no-email test confirm honest failure, not silent success |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R400 | 129-01, 129-02 | Editor/admin can email a rostered volunteer their sign-in link | ✓ SATISFIED | `mode:'email'` path (backend ALLOW-1/3, client onEmailSignInLink + tests) |
| R401 | 129-01, 129-02 | Editor/admin can copy a rostered volunteer's sign-in link | ✓ SATISFIED | `mode:'copy'` path (backend ALLOW-2/3, client onCopySignInLink + tests); does not depend on Resend being live |
| R402 | 129-01 | Single mint code path, one authorization model | ✓ SATISFIED | `mintVolunteerLink` sole mint site; roster gate + editor/admin re-check shared by both modes |

No orphaned requirements — R400-R402 are the phase's full requirement set per REQUIREMENTS.md traceability table, all mapped to Phase 129, all covered by plans 01/02.

### Anti-Patterns Found

None. Scanned `functions/src/volunteerLink.ts`, `functions/src/index.ts` (modified regions), and `src/views/RosterView.vue` for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/stub patterns — no unresolved debt markers introduced by this phase. (One incidental line, `index.ts:983`, explicitly reads "it is a tested behaviour, not a TODO" — a comment disclaiming TODO status, not a marker.)

### Behavioral Spot-Checks / Test Execution

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Functions targeted suite | `cd functions && npx vitest run src/index.test.ts src/volunteerLink.test.ts` | 343/343 passed | ✓ PASS |
| Functions full suite | `cd functions && npm test` | 701/701 passed | ✓ PASS |
| App type-check | `npm run type-check` (vue-tsc --build) | clean, no errors | ✓ PASS |
| RosterView view tests | `npx vitest run src/views/__tests__/RosterView.test.ts` | 26/26 passed (5 new Sign-in Link tests) | ✓ PASS |
| Full app suite | `npx vitest run` | 212/213 files passed, 5458/5492 tests passed; only `src/storage.rules.test.ts` (34 tests) failed — matches the documented, pre-existing Storage-emulator-dependent baseline per CLAUDE.md | ✓ PASS (baseline, not a regression) |
| Single mint call site | `grep -c 'generateSignInWithEmailLink' functions/src/volunteerLink.ts` | `1` | ✓ PASS |
| Single callable export | `grep -c "export const adminVolunteerLink = onCall" functions/src/index.ts` | `1` | ✓ PASS |

### Human Verification Required

Per 129-VALIDATION.md's "Manual-Only Verifications" and the phase CONTEXT.md's owner-gated batched UAT deferral, these two items are code-proven but require a human/real-environment check. They are marked **PENDING**, not accepted, consistent with the project's deploy-gate memory ("Gate consent, not extrapolated").

### 1. Real email delivery

**Test:** From RosterView's Add/Edit Volunteer drawer, click "Email sign-in link" for a rostered volunteer with an email, in a deployed/emulated environment with a live `RESEND_API_KEY`.
**Expected:** The volunteer (or, while Resend is in test-mode in prod, the owner's inbox per the standing Resend test-mode caveat) receives an email with subject "Your sign-in link for {org}" containing a working `/volunteer/verify?slug=...` link.
**Why human:** Requires a live Resend API call and a real inbox; unit tests mock `resend.emails.send` and cannot prove delivery.

### 2. Real clipboard copy

**Test:** From the same drawer, click "Copy sign-in link" in a real browser over a secure context (https or localhost), then paste.
**Expected:** The pasted text is the exact minted sign-in link, and the button visibly shows "Link copied!" for ~2 seconds before reverting.
**Why human:** `navigator.clipboard.writeText` needs a real secure-context browser; jsdom unit tests only prove the code calls `writeText` with the correct argument, not that the OS clipboard actually receives it.

### Gaps Summary

No code-level gaps found. All 3 requirements (R400-R402) and all 3 ROADMAP success criteria are backed by passing automated tests at all three artifact-verification levels (exists, substantive, wired), plus a data-flow trace confirming the single mint path is real (not just declared) via exactly-once mock assertions in both ALLOW-1 (email) and ALLOW-2 (copy). Deployment itself is explicitly and correctly deferred (NOT deployed this phase, per CONTEXT.md's owner-gated batched UAT decision) — this is a documented scope boundary, not a gap. The two remaining items are inherently human/real-environment checks (live email delivery, real OS clipboard) that no unit test can substitute for, and are routed to the batched UAT pass as PENDING.

---

_Verified: 2026-09-06_
_Verifier: Claude (gsd-verifier)_
