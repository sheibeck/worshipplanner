---
phase: 67-fan-out-cron-instance-guardrails
fixed_at: 2026-08-20T03:56:00Z
review_path: .planning/phases/67-fan-out-cron-instance-guardrails/67-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 67: Code Review Fix Report

**Fixed at:** 2026-08-20T03:56:00Z
**Source review:** .planning/phases/67-fan-out-cron-instance-guardrails/67-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, IN-01)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Org daily email quota check can overshoot by up to `count - 1`

**Files modified:** `functions/src/index.ts`, `functions/src/index.test.ts`
**Commit:** `ec036990`
**Applied fix:** Changed `checkAndConsumeOrgEmailQuota`'s rejection condition from `dayCount >= limit`
(pre-send count) to `dayCount + count > limit` (projected total), so the daily total can never
exceed `ORG_MAX_EMAILS_PER_DAY`. Updated the function's doc comment to explain the projected-check
rationale. Added two unit tests: one proving a send whose projected total lands exactly on the
ceiling is allowed (and the counter advances to exactly `limit`), and one proving a send whose
projected total would exceed the ceiling is rejected with zero increment even though the pre-send
count was under the limit.

### WR-02: Quota check had no try/catch, diverging from the file's fail-open precedent

**Files modified:** `functions/src/index.ts`, `functions/src/index.test.ts`
**Commit:** `97f1c6cb`
**Applied fix:** Wrapped the `checkAndConsumeOrgEmailQuota` call (in `sendQueuedMessageHandler`) in
try/catch. On a thrown Firestore error, logs a `console.warn` with the message/org/error detail and
proceeds with the send (fails OPEN), matching the documented `checkAndConsumeRateLimit` fail-open
precedent (locked decision, 65-CONTEXT.md) — a cost guardrail must never take mail down or leave a
message stuck in `sending` with no terminal status. Extended `makeSendDb`'s test harness with an
`orgEmailCounterThrows` option that makes the quota transaction's `tx.get()` throw, and added a test
proving the send proceeds to completion (`status: "sent"`, 2 recipients sent) rather than the handler
promise rejecting.

### IN-01: Quota rejection omitted `failureReason` on the message doc

**Files modified:** `functions/src/index.ts`, `functions/src/index.test.ts`
**Commit:** `f410d4ce`
**Applied fix:** Added `failureReason: "over-org-daily-quota"` to the `messageRef.set(...)` call on
the org-quota rejection path, matching the sibling recipient-cap rejection's
`failureReason: "over-recipient-cap"`. Updated the existing "an org at/over ORG_MAX_EMAILS_PER_DAY"
test to assert the new field on the `messageSetSpy` call.

## Skipped Issues

None — all in-scope findings were fixed.

## Gate Results

- `cd functions && npm test` — **364/364 passing** (was 361/361 before this fix pass; +3 new tests
  across the three findings).
- `cd functions && npm run build` — **clean**, no errors.

Both gates were run twice: once inside the isolated fix worktree after each commit, and once more
against the final `master` HEAD (`f410d4ce`) after the worktree's commits were fast-forwarded in,
confirming the same result in the actual working tree.

## Process Note

Mid-run, the first fix (WR-01) was mistakenly applied to the main repo's working tree instead of the
isolated fix worktree. This was caught immediately (before any commit): the stray diff was captured,
applied cleanly onto the worktree, and the main repo's working tree was reverted to clean via
`git checkout --` before any further work. No commit was made against the main repo directly: all
three fix commits (`ec036990`, `97f1c6cb`, `f410d4ce`) were made in the isolated worktree on branch
`gsd-reviewfix/67-63457` and fast-forwarded onto `master` during the normal transactional cleanup
tail. `master` was otherwise untouched throughout.

---

_Fixed: 2026-08-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
