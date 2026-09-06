---
phase: 129-admin-resend-email-copy
fixed_at: 2026-09-06T21:50:00Z
review_path: .planning/phases/129-admin-resend-email-copy/129-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 129: Code Review Fix Report

**Fixed at:** 2026-09-06T21:50:00Z
**Source review:** .planning/phases/129-admin-resend-email-copy/129-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (both Warning-tier; Info findings IN-01/IN-02 were out of scope per the task's explicit fix list)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `adminVolunteerLink`'s `mode:"email"` send had no rate limit or quota

**Files modified:** `functions/src/index.ts`, `functions/src/index.test.ts`
**Commit:** `7ef9e547` (`fix(129): WR-01 add per-org daily quota to adminVolunteerLink's email send`, on branch `gsd-reviewfix/129-291391`, fast-forwarded onto `master`)
**Applied fix:** Layered the existing `checkAndConsumeOrgEmailQuota` / `volunteerLinkOrgCounters` mechanism (Phase 128) onto the `mode:"email"` branch of `adminVolunteerLinkHandler`, reusing the same collection and `VOLUNTEER_LINK_MAX_PER_ORG_PER_DAY` limit as the public `requestVolunteerLink` path rather than inventing a new one. Over-limit throws an honest `resource-exhausted` HttpsError ("Daily volunteer-link email limit reached for this church.") — correct for this authenticated, non-enumeration-sensitive path. `mode:"copy"` is untouched by this change (mint-only, never sends, never consumes the quota). A Firestore transaction failure inside the quota check fails OPEN (logs a warning, still sends), mirroring `queueServiceMessageHandler`'s established guardrail-not-security-control idiom elsewhere in the same file.

Added 3 tests to the `adminVolunteerLinkHandler` describe block in `functions/src/index.test.ts`:
- over-limit `mode:"email"` → `resource-exhausted`, no mint/send
- `mode:"copy"` unaffected by an exhausted email quota (still mints)
- the throttle fails open when its Firestore transaction throws (send still succeeds)

**Test evidence:**
- `cd functions && npx vitest run src/index.test.ts` → 342/342 passed (1 file), including the 3 new tests and Phase 128's existing `requestVolunteerLinkHandler` WR-01 tests unaffected.
- `cd functions && npm test` → 704/704 passed (19 files).
- `npm run type-check` → clean (`vue-tsc --build`).

### WR-02: `onCopySignInLink` silently no-oped when `data.link` was falsy or `navigator.clipboard` was unavailable

**Files modified:** `src/views/RosterView.vue`, `src/views/__tests__/RosterView.test.ts`
**Commit:** `c68e5b61` (`fix(129): WR-02 surface an error state when copy-mode has nothing to copy`, on branch `gsd-reviewfix/129-291391`, fast-forwarded onto `master`)
**Applied fix:** Added an `else` branch to `onCopySignInLink` that sets `linkCopyError.value = "Couldn't copy — try again"` (with the same 3-second auto-clear `setTimeout` the existing `catch` block already uses) whenever the callable resolves but `data.link` is falsy or `navigator.clipboard` is unavailable — exactly the fix suggested in the review, applied as-is since the current source matched the review's cited context.

Added 2 tests to the `RosterView — drawer Sign-in Link section` describe block:
- a resolved callable response with no `link` → the error label appears, clipboard is never called
- a resolved callable response with a `link` but `navigator.clipboard` stubbed to `undefined` → the error label appears

**Test evidence:**
- `npx vitest run src/views/__tests__/RosterView.test.ts` → 28/28 passed (1 file), including the 2 new tests.
- `npm run type-check` → clean.

## Skipped Issues

None — both in-scope findings were fixed.

## Additional verification (beyond the two in-scope findings)

- `npx vitest run` (full app suite, root) → 5462 passed, 35 skipped, 1 known-failing file (`src/storage.rules.test.ts`, Storage-emulator `ECONNREFUSED` — CLAUDE.md's documented pre-existing baseline, unrelated to this fix). No new regressions introduced by either fix.

## Merge status — RESOLVED, both fixes are on `master`

While this fixer worked in its isolated worktree, the foreground session advanced `master` with an unrelated commit (`e91f8d1d`, "fix(128): volunteer sign-in recovery affordances (UAT)"), so the worktree's branch and `master` diverged and the cleanup tail's `git merge --ff-only` correctly refused to silently merge or rewrite history. `e91f8d1d` touched only `src/stores/volunteerAuth.ts`, `src/stores/__tests__/volunteerAuth.test.ts`, `src/views/VolunteerRequestView.vue`, `src/views/__tests__/VolunteerRequestView.test.ts` — zero file overlap with this fixer's changes — so a `git merge --no-ff` of `gsd-reviewfix/129-291391` into `master` was completed as a follow-up, producing merge commit `586b8c4a` with no conflicts. The temp branch was then deleted (`git branch -d`). `master` now contains, in order: `e91f8d1d` → `7ef9e547` (WR-01) → `c68e5b61` (WR-02) → `586b8c4a` (merge).

---

_Fixed: 2026-09-06T21:50:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
