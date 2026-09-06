---
phase: 125-passwordless-magic-link-access-scoped-read-isolation
fixed_at: 2026-09-06T05:25:00Z
review_path: .planning/phases/125-passwordless-magic-link-access-scoped-read-isolation/125-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 125: Code Review Fix Report

**Fixed at:** 2026-09-06T05:25:00Z
**Source review:** .planning/phases/125-passwordless-magic-link-access-scoped-read-isolation/125-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical, 4 warnings, 1 optional info item taken)
- Fixed: 6
- Skipped: 0

All fixes were applied inside an isolated git worktree, verified against the running
Firestore emulator (rules), vitest (app + functions), and `vue-tsc --build` / `tsc`
type-checks, then fast-forwarded onto `master`.

## Fixed Issues

### CR-01: `rehearseAccess`'s email-claim check can be forged via the pre-existing password auto-register flow

**Files modified:** `firestore.rules`, `src/rules.test.ts`
**Commit:** f4aed51b
**Applied fix:** Added `&& request.auth.token.email_verified == true` to the volunteer
arm of the `rehearseAccess` read rule. `loginWithEmail()` in `src/stores/auth.ts`
silently auto-creates an unverified password account for any typed email, so an
email claim alone was forgeable; `signInWithEmailLink`/Google sign-in both set
`email_verified: true`, so the legitimate magic-link flow is unaffected.

Added 2 regression tests to the R377 describe block in `src/rules.test.ts`:
asserting `assertFails` for an email-claim match with `email_verified: false`
and with `email_verified` unset, and updated the existing ALLOW case to set
`email_verified: true` (matching real magic-link semantics). Ran the full R377
suite (11 tests) and the full `src/rules.test.ts` file (226 tests) against the
running Firestore emulator — all pass.

Note: IN-03 (the identical pre-existing trust gap in `invites/{email}` and
`inviteLookup/{email}`) was flagged by the reviewer as "worth folding into the
same remediation pass" but is OUT of the requested fix scope (Critical +
Warnings + optional IN-01 only) — left unfixed per instructions. See "Not
Fixed" below.

### WR-01: `markAsPlanned`'s `rehearseAccess` write silently skipped on a local-cache miss

**Files modified:** `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`
**Commit:** 44fda8dd
**Applied fix:** `markAsPlanned` now falls back to a direct `getDoc()` when the
service isn't found in the local `onSnapshot` cache, rather than silently skipping
the `rehearseAccess` projection write. If even the direct read comes back empty,
a clear `console.error` is logged. Also threaded the (possibly-fetched) service
into `buildLastUsedSnapshot` via a new optional `fallbackService` parameter so the
`lastUsedAt` recompute stays correct in the cache-miss case too.

Added 2 new tests: one proving the `rehearseAccess` `setDoc` call still fires when
`services.value` is empty (cache miss) and `getDoc` returns the service, and one
proving a clear error is logged (and no write attempted) when the service is
missing from both cache and Firestore. Ran `services.test.ts` — 112 tests pass.

### WR-02: Signed-in volunteer revisiting `/login` misrouted to `/select-church`

**Files modified:** `src/router/index.ts`, `src/router/__tests__/router.test.ts`
**Commit:** 8c1b081a
**Applied fix:** The `to.name === 'login'` bounce-back now checks
`!authStore.isSuperAdmin` before the existing `isChurchlessSuperAdmin`/`select-church`
branch: a signed-in, zero-membership, non-super-admin session (a magic-link
volunteer) is routed to `volunteer-home` instead of the (empty) church picker.
Super-admin destinations (owner-console / select-church for a deactivated single
org) are unaffected.

Widened the router test harness's mirrored `/login` guard to match production
(it previously always returned `dashboard` unconditionally) and added 3 new
tests: volunteer → `/volunteer`, churchless super-admin → `/owner-console`,
and a super-admin with a deactivated single org → `/select-church`. Ran
`router.test.ts` — 15 tests pass.

### WR-03: "Remember this email" input not lowercased before storing

**Files modified:** `src/views/VolunteerSignInView.vue`
**Commit:** e9787d65
**Applied fix:** `rememberEmail.value.trim().toLowerCase()`, matching every other
email-claim normalization in this feature. No existing test file covers this
view's script (none existed pre-phase either); verified via `vue-tsc --build`
(clean) and a Tier-1 re-read confirming the change and surrounding code intact.

### WR-04: No test proves `generateSignInWithEmailLink` rejection isolates per-recipient (T-125-13)

**Files modified:** `functions/src/index.test.ts`
**Commit:** 5dc927a7
**Applied fix:** Added a test that rejects `generateSignInWithEmailLink` for one
recipient (bob) and asserts: that recipient is marked `'failed'` with **no**
Resend `send` call ever made for them (the throw happens before the send call),
the other recipient (alice) still sends normally, and the message rolls up to
`'partial'`. Ran the full `functions/src/index.test.ts` suite — 310 tests pass.

### IN-01 (optional, taken): sequential per-token substitution reinjection footgun

**Files modified:** `functions/src/messageTokens.ts`, `functions/src/messageTokens.test.ts`
**Commit:** ff3302bf
**Applied fix:** Rewrote `renderMessageTokens` to resolve every token in a single
regex pass over the ORIGINAL template via a lookup map, replacing the six
cascading `.replace()` calls. A substituted value (e.g. a roster name or song
title) can no longer be re-scanned for `{{...}}` markers by a later pass — this
was assessed as low-risk (pure function, fully covered by existing 19 tests plus
2 new ones) and taken per the task's "apply if low-risk" guidance.

Added 2 regression tests proving the reinjection footgun is closed in both
directions (a name containing `{{rehearse_link}}`, and a song title containing
`{{name}}`). Ran `messageTokens.test.ts` (21 tests) and the full functions suite
(668 tests) — all pass. `tsc` build clean.

## Not Fixed (out of requested scope)

### IN-02: `rehearseAccess` write rule has no field/shape validation

Not in the requested fix scope (Critical + Warnings + optional IN-01 only).
Reviewer rated this defense-in-depth only (write is already fully
`isOrgEditor`-gated) — left for a future pass if `rehearseAccess`'s shape
becomes load-bearing for more than the current read rule.

### IN-03: Pre-existing `token.email` trust gap in `invites/{email}` and `inviteLookup/{email}`

Not in the requested fix scope. Shares CR-01's root cause but is pre-existing
(outside this phase's diff) and narrower in blast radius (both require a
trusted editor to have already created a matching invite/lookup doc at that
exact email). The reviewer suggested folding it into the same remediation pass
but it was not included in the task's explicit scope — flagging here so it
isn't lost.

## Verification Summary

- `npx vitest run --config vitest.rules.config.ts src/rules.test.ts` (against the
  running Firestore emulator on :8080): **226/226 pass**, including the new
  email_verified DENY/ALLOW cases.
- `npm run type-check` (`vue-tsc --build`): **clean**, run after every app-side
  change.
- `cd functions && npx vitest run`: **668/668 pass**, including the new WR-04
  and IN-01 tests.
- `cd functions && npm run build` (`tsc`): **clean**.
- `npx vitest run` (full app suite, bare — the CLAUDE.md-documented default):
  **5268 passed, 35 skipped, 1 file failed** — `src/storage.rules.test.ts`
  only, with `ECONNREFUSED 127.0.0.1:9199` (no Storage emulator running in this
  session). This exactly matches the documented known-failing baseline in
  CLAUDE.md and is unrelated to any change in this fix pass.
- No cross-service `firestore.exists()` was introduced anywhere (storage.rules
  was not touched). No existing DENY case was weakened — all pre-existing R377
  DENY cases still pass unchanged.

---

_Fixed: 2026-09-06T05:25:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
