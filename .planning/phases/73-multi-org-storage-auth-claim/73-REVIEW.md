---
phase: 73-multi-org-storage-auth-claim
reviewed: 2026-08-21T19:24:38Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - functions/src/orgMembershipClaims.ts
  - functions/src/orgMembershipClaims.test.ts
  - storage.rules
  - src/storage.rules.test.ts
  - functions/src/backfillOrgClaims.ts
  - functions/src/backfillOrgClaims.test.ts
  - functions/DEPLOY-ORG-CLAIMS.md
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 73: Code Review Report

**Reviewed:** 2026-08-21T19:24:38Z
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the multi-org widening of the Storage custom-claim (`functions/src/orgMembershipClaims.ts`),
the corresponding `storage.rules` `orgs`-map arm, and the widened backfill
(`functions/src/backfillOrgClaims.ts`), plus their test files and the rollout runbook, at `deep` depth —
including cross-file tracing into `functions/src/claimsHelpers.ts`, `firestore.rules`, and
`storage.rules` to chase the review's specific security questions (superAdmin preservation, claim
injection, delete-staleness).

No BLOCKER-level findings. The design holds up well against every angle the review focus called out:

- **`orgs` recompute source (focus #1):** `computeOrgsClaimForUid` reads `collectionGroup('members')`
  filtered client-side to `doc.id === uid`, guarded by `resolveOrgId` (rejects any `members` subcollection
  not nested under `organizations/{orgId}`). It never reads `users/{uid}.orgIds` — confirmed both by
  reading the code and by the dedicated test `"NEVER reads users/{uid}.orgIds"`
  (`functions/src/orgMembershipClaims.test.ts:220-227`), which asserts the `users` collection is never
  queried by the scan.
- **Delete-staleness / primary-clear independence (focus #2):** `syncOrgMembershipClaimHandler`'s `clear`
  branch (`functions/src/orgMembershipClaims.ts:330-344`) issues `clearClaimKeys(uid, ORG_CLAIM_KEYS)`
  then a separate `mergeAndSetCustomClaims(uid, { orgs: desiredOrgs })`, where `desiredOrgs` was computed
  from a fresh `collectionGroup` scan taken *after* the triggering delete had already committed (Firestore
  queries are strongly consistent, so the scan is guaranteed to reflect the delete). The
  `orgMembershipClaims.test.ts` "highest-risk case" test (lines 541-566) proves a surviving second org's
  claim entry is not wiped by a primary-org delete. See WR-01 below for a narrower ordering concern within
  this same branch.
- **`superAdmin` preservation (focus #3):** every claim write in this diff goes through
  `mergeAndSetCustomClaims` / `clearClaimKeys` (`functions/src/claimsHelpers.ts`); grepping
  `functions/src` confirms the only bare `getAuth().setCustomUserClaims(...)` calls in the codebase live
  inside `claimsHelpers.ts` itself. Both directions are test-covered (`orgMembershipClaims.test.ts:583-621`,
  `backfillOrgClaims.test.ts:170-186`).
- **`storage.rules` arm (focus #4):** `orgs != null` is checked before indexing
  (`storage.rules:41`), the new arm is `||`-combined (never `&&`) with the unchanged legacy arm, no
  `firestore.exists()` was reintroduced, and `request.auth != null` still gates the whole function so
  deny-by-default is preserved. Traced the claim-injection angle into `firestore.rules`: `users/{uid}` is
  fully client-writable (`allow read, write: if isSignedIn() && request.auth.uid == uid`), so a client
  *can* set `orgIds` on their own profile to any value — but `computeOrgsClaimForUid` never reads
  `orgIds`, and the primary-claim `orgId`/`role` path (`decideMembershipClaim`) only ever fires from a
  genuine Firestore write to `organizations/{orgId}/members/{uid}`, which is independently gated by
  `firestore.rules` (`isOrgEditor(orgId)` or the tightly-scoped invite-acceptance/org-creation `create`
  rule) — an attacker cannot forge a membership write to an org they don't already have real access to, so
  spoofing `orgIds` cannot escalate Storage access to another org.
- **Backfill (focus #5):** idempotency (skip-if-matching) is extended correctly to `orgs`
  (`orgsMapsEqual` in both files), dry-run genuinely never calls `setCustomUserClaims`
  (`backfillOrgClaims.test.ts:215-224`), and the single scan is grouped by uid in memory with no
  cross-uid contamination (`backfillOrgClaims.ts:172-190`, proven by the multi-org single-write test at
  `backfillOrgClaims.test.ts:147-168`).
- **Claim size (focus #6):** the ~1000-byte limit is acknowledged in `73-CONTEXT.md`/`73-RESEARCH.md` as
  an accepted, deliberately-not-optimized risk at current org-count scale. See WR-02 below for how it
  actually fails at runtime, which isn't spelled out in the source.

Both remaining issues are WARNING-level, not BLOCKER — see below. Functions unit tests
(`orgMembershipClaims.test.ts`, `backfillOrgClaims.test.ts`, 52 tests) and `tsc --noEmit` were run clean
against the current tree as part of this review.

## Warnings

### WR-01: Non-atomic clear+merge in the delete branch opens a brief window where a removed member's `orgs` claim still lists the org they just left

**File:** `functions/src/orgMembershipClaims.ts:330-344`
**Issue:** The `clear` branch issues two sequential Admin SDK writes: `clearClaimKeys(uid, ORG_CLAIM_KEYS)`
(removes `orgId`/`role`, but leaves the *old* `orgs` value — including the just-removed org — untouched),
followed by `mergeAndSetCustomClaims(uid, { orgs: desiredOrgs })` (writes the recomputed, correct `orgs`
map). Between these two `await`s, if the removed user's client force-refreshes its ID token (e.g.
`getIdToken(true)`, or a token naturally rotates in that instant), the minted token would carry:
- no `orgId`/`role` (legacy arm now correctly denies), **but**
- the *stale* `orgs` map, which still contains an entry for the org whose membership document was just
  deleted — so `storage.rules`' new `orgs[orgId] != null` arm would still authorize Storage
  reads/writes to the org the user was just removed from, until the second write lands.

This is a narrow, self-limiting window (milliseconds, closes automatically when the handler's second
`await` resolves) and requires the removed user to refresh their token at almost the exact instant their
own membership document is deleted — but it is a genuine TOCTOU gap in exactly the scenario this phase's
review focus asked to look for ("any ordering/race where a delete could leave a stale org in `orgs`").
**Fix:** Read current claims once, compute the fully-merged result (drop `ORG_CLAIM_KEYS`, set `orgs` to
the recomputed survivors, keep everything else) in memory, and issue a single `setCustomUserClaims` call
— e.g. add a `mergeSetAndClearCustomClaims(uid, { set: { orgs: desiredOrgs }, clear: ORG_CLAIM_KEYS })`
helper to `claimsHelpers.ts` so the clear branch becomes one atomic write instead of two:
```ts
// claimsHelpers.ts
export async function mergeSetAndClearCustomClaims(
  uid: string,
  opts: { set?: Record<string, unknown>; clear?: readonly string[] },
): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = { ...((user.customClaims as Record<string, unknown> | undefined) ?? {}) };
  for (const key of opts.clear ?? []) delete current[key];
  Object.assign(current, opts.set ?? {});
  const hasRemaining = Object.keys(current).length > 0;
  await getAuth().setCustomUserClaims(uid, hasRemaining ? current : null);
}
```

### WR-02: No explicit handling or signal for the ~1000-byte custom-claims size limit

**File:** `functions/src/orgMembershipClaims.ts:328,342,358`; `functions/src/backfillOrgClaims.ts:222,248`
**Issue:** `73-CONTEXT.md`/`73-RESEARCH.md` correctly identify that Firebase custom claims cap at ~1000
bytes total and that `setCustomUserClaims` throws `auth/claims-too-large` past that limit, and
deliberately defer mitigation as low-risk at current scale ("a handful of orgs per user"). In the
implementation, every write that could hit this limit is wrapped only in the handler's generic
`try { ... } catch (err) { console.error(...); return { action: "failed", ... } }`
(`syncOrgMembershipClaimHandler`, lines 304-365) or the backfill's generic per-uid `catch`
(`backfillOrgClaims.ts:253-256`). If a user's org count ever grows enough to exceed the byte cap, **every
subsequent claim write for that uid — including legitimate new-org grants — silently fails** with no
distinct signal beyond a `console.error` line; there is no metric, alert, or user-facing indication that
the user's Storage access is now permanently out of sync with their actual memberships. This is a
fail-closed (deny, not grant) failure mode, so it is not a security hole, but it is a silent availability
regression with no operational visibility.
**Fix:** At minimum, detect `err.code === 'auth/claims-too-large'` (or message-match, since the Admin SDK
error code is stable) and log a distinguishable, greppable line (e.g.
`console.error("[orgMembershipClaims] CLAIM SIZE LIMIT EXCEEDED for", uid, ...)`) so this failure mode is
distinguishable from a generic Auth API hiccup in logs/alerting, rather than being indistinguishable from
any other transient failure.

## Info

### IN-01: `orgsMapsEqual` is duplicated verbatim across two files

**File:** `functions/src/orgMembershipClaims.ts:267-276`, `functions/src/backfillOrgClaims.ts:104-112`
**Issue:** Both modules define a private, structurally-identical shallow-equality helper for `orgs` maps.
The duplication is explicitly justified in `backfillOrgClaims.ts`'s comment (keeping the file surface
exactly what `73-03-PLAN.md` declared, and noting both operate on the same shared `buildOrgsMapClaim`
output so there's "no risk of drift on what an orgs map should contain — only on whether two of them are
equal"). That reasoning holds today, but the two signatures already differ subtly (one treats
`undefined` as `{}`, the other requires a non-optional `Record`), so a future edit to one copy's edge-case
handling (e.g. how `null`/`undefined` roles are compared) could silently diverge from the other.
**Fix:** Low priority given the explicit rationale — if either copy is touched again, consider promoting
it to a shared exported helper (mirroring `buildOrgsMapClaim`/`resolveOrgId`'s existing shared-helper
pattern) rather than editing the two copies independently.

### IN-02: Role values are never validated against the known role set before entering the `orgs` claim

**File:** `functions/src/orgMembershipClaims.ts:70-79` (`buildOrgsMapClaim`)
**Issue:** `buildOrgsMapClaim` only special-cases `role === undefined` (skip) and `role === "admin"`
(normalize to `"editor"`); any other string — including an empty string `""`, a typo, or a role value from
a future feature — passes through unchanged via `role as OrgMembershipRole`. `storage.rules`' new arm
grants access whenever `orgs[orgId] != null`, so any non-`undefined`/non-`null` role value (e.g. `""`)
would be treated as valid membership. This pattern is inherited unchanged from the pre-existing
`buildOrgMembershipClaim` (same cast, same lack of validation), but phase 73 widens its blast radius from
one org's claim to every org in a user's `orgs` map.
**Fix:** Not a regression introduced by this phase, so not blocking, but worth tightening opportunistically:
validate `role` against the two known values (`'editor' | 'viewer'`, post-`admin`-normalization) and skip
(rather than pass through) anything else, matching the existing `missing-role` skip philosophy for
ambiguous input.

---

_Reviewed: 2026-08-21T19:24:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
