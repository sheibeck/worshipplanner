---
phase: 67-fan-out-cron-instance-guardrails
reviewed: 2026-08-20T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - functions/src/index.ts
  - functions/src/index.test.ts
  - render-service/DEPLOY.md
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: fixed
fix_report: 67-REVIEW-FIX.md
---

# Phase 67: Code Review Report

**Reviewed:** 2026-08-20
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed commits `7b8a314c` (R170), `f592ad24` (R171), `a1a3c9a9` (R172) against
`functions/src/index.ts` + `functions/src/index.test.ts`, and `6b12c6ab` (R173, doc-only)
against `render-service/DEPLOY.md`.

**R170** (gate `sendScheduledReminders` off by default): the extraction into
`runScheduledMessagingCron` is faithful — both sweeps, their independent try/catch blocks, and
their error-swallowing behavior are moved verbatim, byte-for-byte identical in control flow to
the pre-extraction `onSchedule` callback. The `SCHEDULED_MESSAGING_CRON_ENABLED !== "true"` gate
is genuinely the first statement in the function, before any Firestore/`getFirestore()` call in
either sweep. No regression found here.

**R172** (`setGlobalOptions({ maxInstances: 20 })`): confirmed called once, at module scope,
strictly before the first function definition (`api` at line 467), so it correctly seeds the
default for every function declared after it (including `messageWebhook`, which had no
per-function option). `api`'s own `maxInstances: AI_PROXY_MAX_INSTANCES` (10) is untouched and
correctly overrides the new default for that one function. No conflicting or unintentionally
clobbered per-function ceiling found.

**R171** (recipient cap + org daily quota): the recipient cap is correctly a hard reject (never
truncates, zero sends, checked before `new Resend(...)`). The daily quota counter is
transactionally atomic per org/day and is not double-counted on retry, because it sits behind the
handler's existing `queued`→`sending` idempotency claim (a retried at-least-once invocation is
turned away by that claim before it ever reaches the quota check). Two real issues found in this
guardrail's logic and error-handling — see Warnings below — plus one minor field-consistency gap.

R173 (`render-service/DEPLOY.md`) is doc-only and clean; no findings.

## Warnings

> **Fixed 2026-08-20** — see `67-REVIEW-FIX.md` for full detail. Summary below each finding.

### WR-01: Org daily email quota check can be exceeded by up to `count - 1` because it compares the pre-send count to the limit, not the post-send total

**Status: fixed** — commit `ec036990`. Changed the check to `dayCount + count > limit` (projected
total, not pre-send count). Added tests: an exact-ceiling send is allowed and increments to
exactly `limit`; a send whose projected total would exceed the ceiling is rejected with zero
increment even though the pre-send count was under the limit.

**File:** `functions/src/index.ts:410-417`
**Issue:** `checkAndConsumeOrgEmailQuota` rejects only when the *current* counter is already
`>= limit`:

```ts
if (dayCount >= limit) {
  return { allowed: false, scope: "day" as const };
}
tx.set(dayRef, { count: dayCount + count, expireAt: ... });
return { allowed: true };
```

This check-then-increment-by-1 pattern is copied from `checkAndConsumeRateLimit` (line
347-377), where it is correct because that function always increments by exactly 1 — the counter
can reach `limit` exactly but never overshoot it. Here `count` is the recipient count of the
message about to send (up to `MESSAGE_MAX_RECIPIENTS`, default 200), so the same comparison lets
a single accepted send push the counter well past `limit`.

Concrete scenario with the default `ORG_MAX_EMAILS_PER_DAY = 1000`: an org has sent 999 emails
today (`dayCount = 999`). A message with 200 recipients arrives. `999 >= 1000` is false, so the
send is allowed *in full* — zero truncation — and the counter becomes `1199`. The org is now 199
emails over its configured daily quota, and the guardrail's own log line
(`sendQueuedMessage: skipped ... at/over ORG_MAX_EMAILS_PER_DAY`) never fires for the send that
caused the overshoot, only for the *next* one.

**Fix:** compare the projected total, not just the current count:
```ts
if (dayCount + count > limit) {
  return { allowed: false, scope: "day" as const };
}
```
(This does mean a single very large message could be rejected even when the org has quota
remaining but not enough for that whole batch — but that is the correct, disclosed behavior for
a hard per-message cap, and `MESSAGE_MAX_RECIPIENTS` already bounds how large one message's
`count` can be.)

### WR-02: `checkAndConsumeOrgEmailQuota` is called with no try/catch, diverging from this file's own established fail-open precedent for cost guardrails, and leaves the message stuck past its idempotency claim

**Status: fixed** — commit `97f1c6cb`. Chose option (a) from the Fix section: wrapped the quota
check in try/catch and fail OPEN (log a warning, proceed with the send) on a thrown Firestore
error, matching `checkAndConsumeRateLimit`'s documented precedent. Added a test proving a
quota-check throw results in the send proceeding to completion (`status: "sent"`), not an
unhandled rejection.

**File:** `functions/src/index.ts:2703`
**Issue:** `checkAndConsumeOrgEmailQuota`'s own doc comment (`functions/src/index.ts:391-394`)
says "Deliberately does NOT catch its own Firestore errors — the caller
(`sendQueuedMessageHandler`) decides the fail policy." In practice the caller does not decide
anything — the call is bare:

```ts
const quota = await checkAndConsumeOrgEmailQuota(db, orgId, sendList.length, ORG_MAX_EMAILS_PER_DAY);
```

Compare this to the *only* other consumer of the identical pattern in this file,
`checkAndConsumeRateLimit`, whose caller explicitly wraps the call and fails open with a
documented rationale (`functions/src/index.ts:550-569`: `// Fail OPEN: the limiter is a cost
guardrail, not a security control (locked decision, 65-CONTEXT.md)`). `sendQueuedMessageHandler`
has no equivalent try/catch and no equivalent documented decision — a thrown Firestore error
(transient outage, transaction contention exhausted, permission error) propagates unhandled out
of `sendQueuedMessageHandler`, which is invoked directly (also with no try/catch) from the
`onDocumentCreated` trigger at `functions/src/index.ts:2814-2819`.

This matters specifically here (more than for the untouched reads earlier in the function) because
by this point the message doc has already been flipped `queued` → `sending` by the idempotency
claim transaction (`functions/src/index.ts:2574-2581|2579`), and a retried at-least-once trigger
invocation will see `status !== "queued"` and return `not-claimed` without sending or recording
any failure. The only mitigation is a client-side heuristic
(`src/components/ServiceMessageHistory.vue:206-221`) that relabels a `queued`/`sending` message
older than 5 minutes as "Failed to send" in the UI — the Firestore doc itself never receives a
terminal `failed` status or a `failureReason` for this path, so there is no way to distinguish
"stuck on a transient quota-check Firestore error" from any other stuck-send cause after the
fact.

**Fix:** either (a) wrap the quota check in try/catch and fail open exactly like the AI rate
limiter, with the same explicit logged rationale, or (b) if fail-closed is the intended choice for
this guardrail (arguably defensible, since it protects against runaway spend rather than just
UX), catch the error and explicitly write `status: "failed"` / a `failureReason` so the message
reaches a terminal, diagnosable state instead of relying on the UI's stuck-message age heuristic.
Either way the current silent divergence from the file's own "locked decision" precedent should be
a deliberate, documented choice, not an omission.

## Info

### IN-01: Org-quota rejection does not set `failureReason` on the message doc, unlike the recipient-cap rejection

**Status: fixed** — commit `f410d4ce`. Added `failureReason: "over-org-daily-quota"` to the
`messageRef.set(...)` call on the quota-rejection path. Updated the existing test to assert the
field.

**File:** `functions/src/index.ts:2705-2707`
**Issue:** The recipient-cap rejection persists a reason on the document:
```ts
{ status: "failed", sentAt: ..., deliveryCounts: { sent: 0, failed: 0 }, failureReason: "over-recipient-cap" }
```
but the org-quota rejection a few lines below omits the field entirely:
```ts
{ status: "failed", sentAt: ..., deliveryCounts: { sent: 0, failed: 0 } }
```
even though the function's own return value distinguishes the two cases via `skippedReason:
"over-org-daily-quota"`. No current UI reads `failureReason` off a message doc (only the
`console.error` line carries the reason today), so this has no live functional impact, but it is
an easy win for future debuggability/UI parity — the codebase already has a `failureReason`
convention read by the client for PPTX renders (`src/types/pptxRender.ts:24`,
`src/utils/importedRenderReconciler.ts`).
**Fix:** add `failureReason: "over-org-daily-quota"` to the `messageRef.set(...)` call at
`functions/src/index.ts:2705-2707` for consistency with the recipient-cap path.

---

_Reviewed: 2026-08-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
