---
phase: 138-field-fixes-church-picker-deep-link-service-update-email-lin
verified: 2026-09-09T19:12:00Z
status: human_needed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "As a multi-church member, right-click a nav link (or open a deep link) into a genuinely new browser tab"
    expected: "The new tab lands on the intended page, not /select-church — the active org is restored from the uid-scoped localStorage fallback"
    why_human: "jsdom cannot model a genuinely-new browser tab's empty sessionStorage vs. a shared localStorage tier; this is the one gap unit coverage cannot close (documented in 138-VALIDATION.md's Manual-Only Verifications table)"
---

# Phase 138: Field Fixes — Church-Picker Deep-Link & Service-Update Email Link Verification Report

**Phase Goal:** Multi-church users reliably land on their intended page from a new tab or deep link, and every
service-update email reliably includes a working link to the plan.
**Verified:** 2026-09-09T19:12:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New-tab/deep-link restore for a still-member (R428, ROADMAP SC1) | ✓ VERIFIED | `auth.ts:79-97` `readRememberedOrg` falls through to the `wp.selectedOrg.persist` localStorage tier only when sessionStorage is empty, with identical `{uid,orgId}` validation on both branches; named test `-t "new tab"` passes (1/1, auth.test.ts) |
| 2 | Sign-out clears every storage tier (R428, ROADMAP SC2) | ✓ VERIFIED | `clearRememberedOrg()` (auth.ts:114-125) removes both `wp.selectedOrg` and `wp.selectedOrg.persist`, each independently try/catched; is the sole logout call site (auth.ts:920, before any await); named test `-t "clears both"` passes (1/1) |
| 3 | Stale/removed-membership org not honored (R428, ROADMAP SC3) | ✓ VERIFIED | `loadOrgContext`'s `remembered && ids.includes(remembered) ? remembered : ...` guard (auth.ts:552-554) is byte-for-byte unchanged (confirmed via git diff / code review); gates whichever tier answered; named test `-t "stale"` passes (5/5, includes the new stale-non-member case) |
| 4 | Single-church user unaffected (regression, plan-01 addition) | ✓ VERIFIED | `ids.length === 1` fallback path untouched; named test "a single-org user goes straight in (no selection required)" passes |
| 5 | Every update/re-lock email carries a working link with no prior share token (R434, ROADMAP SC4) | ✓ VERIFIED | `onSend()` (ReLockNotifyPrompt.vue:310-331) appends `View the full plan: {{service_link}}` only when `ensureShareLink` resolves a non-empty (trimmed) token; the `{{service_link}}` literal matches exactly what `messageTokens.ts:56` substitutes server-side; named test `-t "service_link"` passes |
| 6 | ensureShareLink awaited before send, soft-fail non-blocking | ✓ VERIFIED | `onSend()` wraps `await servicesStore.ensureShareLink(props.service, props.orgId)` in its own try/catch, logging on rejection without aborting the surrounding send flow — mirrors `markAsPlanned`'s soft-fail pattern (services.ts:735-740); named test `-t "ensureShareLink"` passes (3/3, includes rejection-does-not-block) |
| 7 | Graceful omission when no link resolves (Pitfall 9) | ✓ VERIFIED | `shareToken.trim() ? [...] : bodyText.value` (ReLockNotifyPrompt.vue:329-331) — empty token sends the unmodified diff body, never a dangling label; named test `-t "omit"` passes |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/stores/auth.ts` | Two-tier (sessionStorage + uid-scoped localStorage) remembered-org helpers | ✓ VERIFIED | `SELECTED_ORG_LOCAL_KEY = 'wp.selectedOrg.persist'` added; all three helpers (read/remember/clear) extended exactly as specified |
| `src/stores/__tests__/auth.test.ts` | `localStorage.clear()` in beforeEach + 3 new tests | ✓ VERIFIED | Line 257 `localStorage.clear()` present; 3 named tests present and passing |
| `src/components/ReLockNotifyPrompt.vue` | services-store import, ensure-link precondition, conditional plan-link line | ✓ VERIFIED | `useServiceStore` imported (line 186), `servicesStore.ensureShareLink` awaited in `onSend`, body conditionally includes the token line |
| `src/components/__tests__/ReLockNotifyPrompt.test.ts` | `vi.mock('@/stores/services', ...)` seam + 3 new tests | ✓ VERIFIED | Seam added; 3 named tests present and passing |
| `src/views/__tests__/ServiceEditorView.test.ts` | Regression fix for a TDZ/mock-hoisting break this phase's new import surfaced | ✓ VERIFIED | `vi.hoisted()` fix (63fc1799) + WR-01 mock-gap fix (`ensureShareLink` stub added, c35858b6); 349/349 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `readRememberedOrg`'s localStorage branch | `loadOrgContext`'s `ids.includes(remembered)` guard | Both tiers return through the same function/return type; the guard is unchanged | ✓ WIRED | Confirmed via git diff (auth.ts:519-527-equivalent region untouched) and direct read at auth.ts:552-554 |
| `clearRememberedOrg` | `logout()` | Single call site, folded into the function body | ✓ WIRED | auth.ts:920, synchronous, before any await (no partial-clear window per code review) |
| `ReLockNotifyPrompt.vue`'s `{{service_link}}` literal | `functions/src/messageTokens.ts` `service_link` token → `ctx.serviceLink` | Exact string match | ✓ WIRED | Confirmed via grep: `messageTokens.ts:56` substitutes `service_link`; `index.ts:1990` `resolveServiceLink` supplies `ctx.serviceLink` |
| `ensureShareLink`'s minted token | Server's `resolveServiceLink` at send time | Both read/write the same `shareTokens/{token}` collection | ✓ WIRED | Traced by code review (138-REVIEW.md) against `services.ts:1159-1231` and `functions/src/index.ts:1990-2012`; not independently re-traced line-by-line here but corroborated by the passing `functions/messageTokens.test.ts` regression suite (21/21) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| New-tab restore from localStorage fallback | `npx vitest run src/stores/__tests__/auth.test.ts -t "new tab"` | 1/1 pass | ✓ PASS |
| Sign-out clears both tiers | `npx vitest run src/stores/__tests__/auth.test.ts -t "clears both"` | 1/1 pass | ✓ PASS |
| Stale non-member org rejected | `npx vitest run src/stores/__tests__/auth.test.ts -t "stale"` | 5/5 pass | ✓ PASS |
| Single-org regression unaffected | `npx vitest run src/stores/__tests__/auth.test.ts -t "a single-org user goes straight in"` | 1/1 pass | ✓ PASS |
| Plan-link token appears in sent body | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts -t "service_link"` | 1/1 pass | ✓ PASS |
| ensureShareLink called before send / rejection non-blocking | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts -t "ensureShareLink"` | 3/3 pass | ✓ PASS |
| Graceful omission when link is empty | `npx vitest run src/components/__tests__/ReLockNotifyPrompt.test.ts -t "omit"` | 1/1 pass | ✓ PASS |
| Server-side `{{service_link}}` substitution regression | `cd functions && npx vitest run messageTokens.test.ts` | 21/21 pass | ✓ PASS |
| Full touched-file regression (auth + ReLockNotifyPrompt + ServiceEditorView) | `npx vitest run src/stores/__tests__/auth.test.ts src/components/__tests__/ReLockNotifyPrompt.test.ts src/views/__tests__/ServiceEditorView.test.ts` | 498/498 pass | ✓ PASS |
| Type-check gate | `npm run type-check` (vue-tsc --build) | clean, no errors | ✓ PASS |
| Full bare-suite regression gate | `npx vitest run` | 225/226 files pass, 5708/5742 tests pass; only failing file is `src/storage.rules.test.ts` (34 tests) | ✓ PASS (matches documented baseline exactly) |

The full bare `npx vitest run` was executed independently by this verification (run in the background, completed): **225/226 files pass, 5708/5742 tests pass** — the only failing file is `src/storage.rules.test.ts` (34 tests, all `Test timed out in 5000ms` on the Storage-emulator-dependent suite). This matches the documented pre-existing environment-limitation baseline exactly (per CLAUDE.md) and confirms no regression anywhere in the codebase from this phase's changes, consistent with the fully-green targeted run reproduced above and with both plan SUMMARYs' independently-reported results.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| R428 | 138-01-PLAN.md | Multi-church new-tab/deep-link restore, stale-membership guard, sign-out cleanup | ✓ SATISFIED | Truths 1-4 above; REQUIREMENTS.md marks `[x]` and Traceability table marks "Complete" |
| R434 | 138-02-PLAN.md | Every service-update/re-lock email carries a working plan link, self-healed before send | ✓ SATISFIED | Truths 5-7 above; REQUIREMENTS.md marks `[x]` and Traceability table marks "Complete" |

No orphaned requirements: REQUIREMENTS.md's Traceability table maps only R428 and R434 to Phase 138, and both are declared in the two plans' frontmatter `requirements:` fields — full match, no gap either direction.

### Anti-Patterns Found

None. Scanned all five phase-touched files (`src/stores/auth.ts`, `src/stores/__tests__/auth.test.ts`, `src/components/ReLockNotifyPrompt.vue`, `src/components/__tests__/ReLockNotifyPrompt.test.ts`, `src/views/__tests__/ServiceEditorView.test.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` — zero matches.

### Code Review Findings Closed

`138-REVIEW.md` (deep review, 2026-09-09) found 0 critical, 1 warning (WR-01: `ServiceEditorView.test.ts`'s shared services-store mock omitted `ensureShareLink`, which could mask a future real bug behind the component's soft-fail catch), 1 info (IN-01: `shareLink` variable name was misleading — it holds a token, not a URL). Commit `c35858b6` ("fix(138): address code-review WR-01/IN-01") closes both:
- `shareLink` renamed to `shareToken` throughout `onSend()` (ReLockNotifyPrompt.vue).
- `ensureShareLink: vi.fn(() => Promise.resolve(''))` added to `ServiceEditorView.test.ts`'s services-store mock, with a comment explaining why (WR-01 reference).

Verified directly against `git show c35858b6` — both fixes are present exactly as described, and the full 349-test `ServiceEditorView.test.ts` file plus the 149 combined auth/ReLockNotifyPrompt tests still pass after the fix.

### Human Verification Required

### 1. Real-browser new-tab / deep-link restore

**Test:** As a multi-church member, right-click a nav link (or paste a deep link) into a genuinely new browser tab.
**Expected:** The new tab lands on the intended page immediately, not `/select-church` — the active org is restored from the `wp.selectedOrg.persist` localStorage fallback.
**Why human:** jsdom cannot model the isolation between a genuinely-new tab's empty `sessionStorage` and a shared `localStorage` — this is explicitly called out as the one manual-only verification in `138-VALIDATION.md`. All supporting logic (storage helpers, stale-membership guard, sign-out cleanup) has full automated unit coverage and passes.

**Note (not a blocking gate):** End-to-end email delivery of the plan link (R434) was not independently re-verified by sending a real email in this pass. It is backed by: (a) unit tests proving the client conditionally appends the exact `{{service_link}}` literal, (b) the passing `functions/messageTokens.test.ts` regression suite proving server-side substitution of that literal, and (c) this being an extension of an already-shipped, already-production-proven substitution path (`LOCK_BODY` and `MessageComposer` already use the identical mechanism). Both plan SUMMARYs flag this as `human_judgment: true` for the record, but the wiring evidence is strong enough that this verification does not treat it as a required additional gate beyond the new-tab item above.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria and all 7 merged must-have truths (from both plan frontmatters) are verified against the actual `git HEAD` (`c35858b6`) source, with passing named unit tests for every truth, a clean `npm run type-check`, a clean full bare-suite regression run (225/226 files, matching the documented baseline exactly), zero anti-patterns, and full requirements traceability. The phase's own code review found two non-blocking issues, both of which were fixed in a follow-up commit and independently re-confirmed here. The single remaining item is the real-browser new-tab confirmation, which is inherently outside jsdom's reach and was correctly deferred to human UAT by the plan/validation strategy rather than skipped.

---

*Verified: 2026-09-09T19:12:00Z*
*Verifier: Claude (gsd-verifier)*
