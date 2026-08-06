---
phase: 40-custom-auth-claim-for-org-membership
reviewed: 2026-08-06T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - storage.rules
  - src/storage.rules.test.ts
  - functions/src/orgMembershipClaims.ts
  - functions/src/orgMembershipClaims.test.ts
  - functions/src/index.ts
  - functions/src/index.test.ts
  - functions/src/backfillOrgClaims.ts
  - functions/src/backfillOrgClaims.test.ts
  - functions/DEPLOY-ORG-CLAIMS.md
  - src/stores/auth.ts
  - src/stores/__tests__/auth.test.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
status: findings
resolutions:
  WR-01: fixed (commit de26270)
  WR-02: fixed (commit 3c9eb47)
  WR-03: deferred -- out of scope (firestore.rules, deploy-gated, R074)
  WR-04: deferred -- not actionable (emulator limitation, firebase-js-sdk#6803)
  IN-01: fixed (commit 965a720)
---

# Phase 40: Custom Auth Claim for Org Membership - Code Review Report

**Reviewed:** 2026-08-06
**Depth:** standard
**Files Reviewed:** 11
**Status:** findings

## Summary

This phase's core security mechanism — the dual-read `storage.rules` OR, claim-first ordering, the
`decideMembershipClaim`/`syncOrgMembershipClaim` trigger, and the bounded claim-refresh retry in
`auth.ts` — is sound. I traced the specific failure modes called out for this review and did not find
a way for the claim arm to admit anyone the pre-existing Firestore arm would have denied:

- **Ordering:** `isOrgMemberByClaim(orgId) || isOrgMemberByFirestore(orgId)` — claim first, confirmed
  in `storage.rules:51`. `||` short-circuits, so this is load-bearing exactly as documented.
- **Type coercion / null handling:** a missing `request.auth.token.orgId`/`.role` degrades to `null`
  in the rules CEL evaluator (not a throw), and `null == orgId` is simply `false` — covered by a real
  emulator test (`denies a caller whose claim carries an orgId but no role`,
  `src/storage.rules.test.ts:136-144`).
- **Stale-claim-on-removal:** `decideMembershipClaim` correctly clears via
  `setCustomUserClaims(uid, null)` on delete of the PRIMARY membership, and correctly leaves the claim
  untouched on delete of a NON-primary membership (`functions/src/orgMembershipClaims.ts:90-104`, both
  branches unit-tested at `orgMembershipClaims.test.ts:107-123` and `:230-243`).
- **Backfill safety:** dry-run is genuinely the default (`BackfillOptions.apply` gates the only
  `setCustomUserClaims` call site, `backfillOrgClaims.ts:114-117`), a partial run cannot corrupt state
  beyond what a future trigger write would already correct (per-account try/catch,
  `backfillOrgClaims.ts:110-138`), and idempotency is proven statefully across two real calls to the
  same fake Auth (`backfillOrgClaims.test.ts:139-164`), not merely asserted by construction.
- **`auth.ts` retry:** the ordinary path performs exactly one forced refresh with no delay
  (`CLAIM_REFRESH_MAX_ATTEMPTS`-gated on `awaitClaim`, `auth.ts:132-146`), never throws
  (`refreshOrgClaim`'s try/catch swallows and logs), and this is pinned by a call-count assertion, not
  a "a refresh happened" assertion (`auth.test.ts:486-494`).

I still found four items worth fixing or tracking, none of which are exploitable purely within this
phase's own code, but two touch the exact "is this claim trustworthy" and "is this test non-vacuous"
questions this review was asked to press hardest on. No source files were modified — this review is
read-only.

## Warnings

> **RESOLVED (commit `de26270`).** `DecideMembershipClaimParams` now carries an explicit
> `documentExists: boolean` alongside `role`. `decideMembershipClaim` only clears on
> `documentExists === false` (a genuine delete); a document that exists but has no `role`
> now takes a new defensive `skip/missing-role` branch instead of `clear`. Propagated to
> `syncOrgMembershipClaimHandler` (`documentExists: after !== undefined`) and to
> `backfillOrgClaims.ts`'s call site (`documentExists: true`, since a query result document
> by definition exists). Regression tests added at both the `decideMembershipClaim` level
> (new `MembershipClaimSkipReason` value `"missing-role"`) and the
> `syncOrgMembershipClaimHandler` level (a malformed `after: {}` create/update no longer
> triggers `setCustomUserClaims(uid, null)`). `functions/` suite: 105/105 passing;
> `npm run type-check` clean.

### WR-01: `role: undefined` is overloaded to mean both "document deleted" and "document has no role field"

**File:** `functions/src/orgMembershipClaims.ts:97-104` (consumed via `syncOrgMembershipClaimHandler:150-153`)
**Issue:** `decideMembershipClaim` receives `role: string | undefined` and treats `role === undefined`
as proof the membership document was deleted, unconditionally clearing the user's claim
(`setCustomUserClaims(uid, null)`). But the trigger derives `role` as `after?.role`
(`orgMembershipClaims.ts:174-183`), so the exact same `undefined` value results whether `after` itself
is `undefined` (a genuine delete) **or** `after` exists but simply lacks a `role` key (a malformed
create/update — e.g. a manual Firestore Console edit, or a future code path that writes a
members/{uid} document without `role`). In the latter case a still-valid membership gets its claim
wiped even though the document was never deleted. Every current app write path always sets `role`, so
this is not reachable today, but the function signature makes it structurally impossible to
distinguish the two cases if that ever changes, and there is no test pinning the distinction (only the
genuine-delete case, `before: {...}, after: undefined`, is tested at `orgMembershipClaims.test.ts:199-213`).
**Fix:** Thread the real create/update/delete signal through explicitly instead of overloading `role`,
e.g. change `DecideMembershipClaimParams` to carry `documentExists: boolean` alongside `role: string | undefined`,
and only take the `clear` branch when `documentExists === false`. A document that exists but has no
`role` should instead be a defensive `skip` (with a distinct reason, e.g. `"missing-role"`), not a
silent clear.

> **RESOLVED (commit `3c9eb47`).** The CLI wrapper body was extracted into an exported
> `runBackfillCli()` and wrapped in try/catch. Any top-level failure (e.g. the unguarded
> `collectionGroup('members').get()` rejecting on bad credentials or the wrong project) now
> logs `"[backfillOrgClaims] aborted before processing any account -- top-level failure:"`
> plus the error, and sets `process.exitCode = 1`, mirroring the per-account failure
> reporting `backfillOrgMembershipClaims` already had. The extraction also made this path
> independently unit-testable (no `require.main === module` gate needed for the test) --
> a new regression test simulates a Firestore query rejection and asserts the diagnostic
> message and exit code. `functions/` suite: 105/105 passing; `npm run type-check` clean.

### WR-02: Backfill CLI wrapper has no top-level error handling — a Firestore query failure becomes an unhandled rejection instead of the script's own diagnostic path

**File:** `functions/src/backfillOrgClaims.ts:96` and `:157-181`
**Issue:** `backfillOrgMembershipClaims`'s per-account work is wrapped in `try`/`catch`
(`:110-138`), but the initial `await getFirestore().collectionGroup("members").get()` at line 96 is
not — if it rejects (bad/expired credentials, wrong project, network failure, permission error), the
rejection propagates out of `backfillOrgMembershipClaims` and out of the CLI wrapper's
`void (async () => { ... })()` IIFE (`:157-181`) with no `.catch()`. There is no
`process.exitCode = 1` set for this path and none of the script's own "target project" / dry-run
banner context is repeated alongside the failure — the owner sees Node's raw unhandled-rejection
output instead of the tool's designed failure reporting. This is exactly the class of failure most
likely on a first real run (wrong `GOOGLE_APPLICATION_CREDENTIALS`, wrong project selected).
**Fix:** Wrap the CLI wrapper's body in try/catch (or add `.catch()` to the IIFE) and set
`process.exitCode = 1` with a clear "backfill aborted before processing any account" message on any
top-level rejection, mirroring the per-account failure reporting already present.

> **DEFERRED -- explicitly out of scope for this fix pass.** `firestore.rules` is out of
> scope for Phase 40 by requirement R074, and `firestore.rules` changes are deploy-gated to
> the owner. Not touched. The underlying gap is being surfaced to the owner separately as a
> decision (track as a future `firestore.rules` hardening item, e.g. requiring the creating
> org to already exist in the user's `orgIds`, or gating `members/{uid}` create on an
> invite-consumption flag). A reader of this review should not interpret the absence of a
> code change here as an oversight.

### WR-03: The new claim mechanism inherits — and extends the persistence window of — a pre-existing firestore.rules self-service membership gap

**File:** `firestore.rules:36-40` (unmodified, out of scope for this phase) interacting with
`functions/src/orgMembershipClaims.ts:72-117` and `storage.rules:27-31`
**Issue:** This is not a defect introduced by this phase's code, and `firestore.rules` is correctly
out of scope per R074 — flagged only because "what matters most" item 4 explicitly asks whether the
Firestore document `role` comes from is client-writable in a way that lets a user escalate their own
claim. It is, in a broader sense than role-escalation-within-an-org: `firestore.rules`'s
`match /members/{uid} { allow create: if isSignedIn() && request.auth.uid == uid; }` lets **any**
signed-in user self-create `organizations/{orgId}/members/{their-own-uid}` for **any** `orgId` — not
just an org they already belong to — with an unrestricted `role` value, no invite or editor
authorization required. Combined with `users/{uid}` being fully client-writable
(`firestore.rules:22-23`, no field restriction on `orgIds`), a user can already grant themselves
Storage access to an arbitrary org today via the pre-existing Firestore-fallback arm alone
(`firestore.exists()` only checks doc existence, not role) — this predates and is unaffected by this
phase. What this phase changes is the *revocation latency* of that same forged-membership path once an
admin notices and deletes the bogus doc: the old Firestore-only check re-validates on every single
Storage request, so deleting the forged doc revokes access instantly; the new claim arm caches
`{orgId, role}` in the ID token for up to its natural 1-hour lifetime, so a user who self-granted a
claim before the doc was deleted keeps claim-based access for up to an hour afterward (the trigger does
clear the claim promptly on delete — `orgMembershipClaims.ts:102-104` — but, per the phase's own
documented "Stale claim after membership removal" limitation, that only affects *future* token mints,
not an already-cached token). This is a narrow, real widening of an existing gap's blast radius, not a
new hole.
**Fix:** No action required inside this phase (firestore.rules is explicitly out of scope). Recommend
tracking the underlying `members/{uid}` `allow create` gap as a separate firestore.rules hardening item
(e.g. requiring the creating org to already exist in the user's `orgIds`, or gating create on an
invite-consumption flag) so the claim mechanism's revocation-latency tradeoff isn't compounding an
open self-service privilege hole.

> **DEFERRED -- not actionable as a code fix.** The Firestore-fallback ALLOW arm cannot have
> a running emulator test; this is a structural limitation of the Storage emulator
> ([firebase-js-sdk#6803](https://github.com/firebase/firebase-js-sdk/issues/6803)), not an
> oversight. It is already honestly disclosed in-repo via the structural source-text
> assertion plus the manual "existing member can still upload" check in
> `functions/DEPLOY-ORG-CLAIMS.md`'s deploy runbook. Writing a behavioural test for it would
> produce a guaranteed-failing test, which is worse than the current honest disclosure.
> Recommend (unchanged from the original finding) making the manual runbook check a
> required, logged verification step rather than prose alone -- left for the owner /
> runbook maintenance, not this fix pass.

### WR-04: The Firestore-fallback arm's ALLOW behavior has no test that actually runs against the rule — only a static source-text assertion

**File:** `src/storage.rules.test.ts:198-246`, cross-referenced against `40-CONTEXT.md`'s "Both arms of
the OR are tested separately" locked decision and `functions/DEPLOY-ORG-CLAIMS.md:282-292`
**Issue:** Not a defect — this is structurally forced by `firebase-js-sdk#6803` (the emulator's
`firestore.exists()` is inert), and the team has been unusually careful to document it rather than
paper over it (this is precisely the discipline CLAUDE.md's incident retrospective calls for). Flagging
anyway because the letter of the locked decision ("Both arms of the OR are tested separately —
claim-present and claim-absent") is only partially met: the claim-present arm has real
`assertSucceeds` coverage against the running emulator (`storage.rules.test.ts:70-87, 150-156`); the
claim-absent (Firestore-fallback) arm's ALLOW case has **no** running test anywhere in this suite — it
is proven only by (a) a regex assertion that the rule's *source text* still contains
`firestore.exists(...)` OR-joined rather than AND-joined (`storage.rules.test.ts:211-245`), and (b) a
one-time manual production check the owner is instructed to perform during Step 1 of the deploy runbook
(`DEPLOY-ORG-CLAIMS.md:91-97`). If that manual check is ever skipped on a future re-deploy of this
rule, there is no automated signal that the fallback arm still behaviorally allows a legitimate
pre-claim member — the exact "test explained away as an environment quirk" pattern CLAUDE.md's
incident postmortem warns about, here explicitly acknowledged rather than mislabeled, but still a real
coverage gap.
**Fix:** No code fix available (this is an emulator limitation, not a bug). Recommend making the manual
"existing member can still upload" check in `DEPLOY-ORG-CLAIMS.md` Step 1 a **required, logged**
verification step (e.g. captured in the runbook as a checklist item with a place to record the
timestamp/observer) rather than prose alone, and/or adding a periodic production smoke test that
exercises a real upload through a real pre-claim (or claim-cleared) account, so the fallback arm's
correctness is re-verified on a cadence rather than resting solely on this phase's one-time manual
check.

## Info

> **RESOLVED (commit `965a720`).** Removed `before` from `SyncOrgMembershipClaimParams` and
> from the `onDocumentWritten` wrapper's construction of the params object, rather than
> adding an unused-field comment -- preferring dead-parameter removal per the fix guidance.
> All call sites (production trigger wrapper and every test in
> `orgMembershipClaims.test.ts`) updated accordingly. `functions/` suite: 105/105 passing;
> `npm run type-check` clean.

### IN-01: `SyncOrgMembershipClaimParams.before` is threaded through but never read

**File:** `functions/src/orgMembershipClaims.ts:123-130, 147-153, 171-185`
**Issue:** The `onDocumentWritten` wrapper computes `before` from `event.data?.before` and passes it
into `syncOrgMembershipClaimHandler`, whose `SyncOrgMembershipClaimParams` interface declares it — but
the handler body only destructures `{ orgId, uid, after }` and never reads `before`. This is harmless
(no functional impact; `decideMembershipClaim` doesn't need it since idempotency is determined by
comparing the computed claim against `getAuth().getUser(uid)`'s *current* claim, not against the
Firestore before-state) but it's dead plumbing that could mislead a future reader into thinking
create/update/delete are being distinguished by diffing `before`/`after` when they aren't.
**Fix:** Either drop `before` from `SyncOrgMembershipClaimParams` and the wrapper's construction of it,
or add a one-line comment at the destructure site noting it's intentionally unused (mirrors the
existing practice elsewhere in this file of explaining non-obvious omissions).

---

_Reviewed: 2026-08-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
