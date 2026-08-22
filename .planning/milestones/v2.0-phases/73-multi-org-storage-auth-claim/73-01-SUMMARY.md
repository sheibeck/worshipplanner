---
phase: 73-multi-org-storage-auth-claim
plan: 01
subsystem: auth
tags: [firebase-custom-claims, cloud-functions, firestore, collectionGroup, multi-org]

# Dependency graph
requires:
  - phase: 40-org-membership-claim
    provides: decideMembershipClaim, buildOrgMembershipClaim, ORG_CLAIM_KEYS, syncOrgMembershipClaimHandler, backfillOrgClaims.ts (shared decision function, D-11 no-drift pattern)
  - phase: 68-super-admin
    provides: mergeAndSetCustomClaims / clearClaimKeys (claimsHelpers.ts, R175 merge-preserving claim writers)
provides:
  - "buildOrgsMapClaim: shared, no-drift role-normalizing builder for the additive orgs map"
  - "resolveOrgId: exported structural guard (organizations/{orgId}/members/{uid} shape check)"
  - "computeOrgsClaimForUid: unfiltered collectionGroup('members') scan filtered to doc.id === uid, the ONLY authoritative multi-org read source"
  - "syncOrgMembershipClaimHandler widened to write an additive orgs map on every members write (primary or non-primary, create/update/delete)"
affects: [73-02-storage-rules, 73-03-backfill, 74-organizations-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive claim widening: primary { orgId, role } left byte-unchanged; a new orgs map added alongside via the same merge-preserving write path"
    - "Recompute-from-survivors, never from users/{uid}.orgIds (proven structurally overwrite-broken, not merely stale)"
    - "Stateful Auth test fake to genuinely prove sequential clearClaimKeys -> mergeAndSetCustomClaims write composition"

key-files:
  created: []
  modified:
    - functions/src/orgMembershipClaims.ts
    - functions/src/orgMembershipClaims.test.ts

key-decisions:
  - "orgs value encoding is the full normalized role string ('editor'|'viewer'), matching the primary role normalization -- locked in 73-CONTEXT.md as the shared contract with plan 73-02's storage.rules"
  - "decideMembershipClaim's signature and return contract are left completely unchanged this wave -- the orgs recompute lives entirely in the handler + a new shared buildOrgsMapClaim/computeOrgsClaimForUid pair, so the untouched backfill (73-03) and its exact-match tests stay green"
  - "Primary-membership delete uses TWO sequential merge-preserving writes (clearClaimKeys then mergeAndSetCustomClaims) rather than one combined raw setCustomUserClaims call, per critical constraint 5 (\"all writes via mergeAndSetCustomClaims/clearClaimKeys\") -- costs one extra Admin SDK call on the delete path but keeps every write routed through the shared, already-tested merge-preserving helpers"
  - "A non-primary-org skip (not-primary-org/already-current) still recomputes and compares orgs, writing only if it actually changed -- this is what makes a second-org join/leave update orgs even though decideMembershipClaim never fires a primary decision for it"

requirements-completed: [R207, R208]

coverage:
  - id: D1
    description: "The claim carries an additive orgs map for every org a user belongs to, alongside the unchanged primary orgId/role, on any members write (primary or non-primary)"
    requirement: "R207"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#create, primary org: single write carries { orgId, role, orgs }, setCustomUserClaims called once"
        status: pass
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#non-primary org JOIN: orgs gains orgB AND keeps orgA, primary orgId/role are unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "A membership delete recomputes orgs from the surviving member docs so a removed org no longer appears in orgs"
    requirement: "R208"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#delete-staleness: a survivors snapshot that no longer contains the removed org's member doc does not carry that org"
        status: pass
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#primary-org DELETE while the user still belongs to a second org: orgId/role cleared, orgs recomputed STILL contains the second org (highest-risk case, R208)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A primary-org membership delete clears orgId/role but preserves a still-valid second-org entry in orgs -- the primary-clear and orgs-recompute are independent"
    requirement: "R208"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#primary-org DELETE while the user still belongs to a second org: orgId/role cleared, orgs recomputed STILL contains the second org (highest-risk case, R208)"
        status: pass
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#primary-org DELETE when the user belongs to no other org: orgId/role cleared, orgs becomes {}"
        status: pass
    human_judgment: false
  - id: D4
    description: "A pre-existing superAdmin claim survives every widened claim write, in both the set direction and the primary-delete direction"
    requirement: "R208"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#preserves superAdmin (direction A): a widened create/update on an account with superAdmin:true leaves it intact"
        status: pass
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#preserves superAdmin (direction B): a primary-org delete clears orgId/role, recomputes orgs, and leaves superAdmin:true intact (SC1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The orgs scan is proven to read live organizations/*/members/{uid} documents via collectionGroup, and NEVER users/{uid}.orgIds"
    requirement: "R207"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#NEVER reads users/{uid}.orgIds -- the users collection is never queried by the orgs scan"
        status: pass
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#filters a collectionGroup('members') scan to only the target uid's orgs -- a second uid's docs are excluded"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-08-21
status: complete
---

# Phase 73 Plan 01: Multi-Org Claim Writer Widening Summary

**Widened `syncOrgMembershipClaimHandler` to recompute an additive `orgs: {orgId: role}` claim map from a live `collectionGroup('members')` scan on every membership write, proving both the delete-recompute and primary-clear-independence correctness traps with a stateful Auth test fake.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-21
- **Tasks:** 2
- **Files modified:** 2 (`functions/src/orgMembershipClaims.ts`, `functions/src/orgMembershipClaims.test.ts`)

## Accomplishments
- Added `buildOrgsMapClaim` (shared, no-drift role-normalizing builder), `resolveOrgId` (exported structural guard), and `computeOrgsClaimForUid` (unfiltered `collectionGroup('members')` scan filtered client-side to `doc.id === uid`) — the primitives that make `orgs` computable from the only authoritative source, live membership documents, never the structurally overwrite-broken `users/{uid}.orgIds`.
- Widened `syncOrgMembershipClaimHandler` so `orgs` is recomputed on every write — primary or non-primary, create/update/delete — while `decideMembershipClaim`'s primary-org decision logic, signature, and return contract stay byte-unchanged (keeps plan 73-03's backfill and its exact-match tests green this wave).
- Proved the phase's two sharpest correctness risks with genuine tests, not assertions-by-construction: a primary-org delete recomputes `orgs` from survivors (a removed org disappears) AND independently preserves a still-valid second org — using a stateful Auth fake so the two sequential `clearClaimKeys` → `mergeAndSetCustomClaims` writes compose exactly as the real Admin SDK would.
- Proved `superAdmin` survives both a widened create/update and a primary-membership delete, asserting on the actual written claim objects (not merely that a call happened).

## Task Commits

1. **Task 1: Add the shared orgs-map builder + surviving-members scan** - `77b8e44e` (feat)
2. **Task 2: Widen syncOrgMembershipClaimHandler to recompute orgs on every write** - `bbad6d52` (feat)

_Both tasks were TDD: behavior tests were written and run alongside each implementation step within the same commit, per the plan's `tdd="true"` task markers._

## Files Created/Modified
- `functions/src/orgMembershipClaims.ts` — added `ORGS_CLAIM_KEY`, `OrgMembershipClaims` type, `buildOrgsMapClaim`, exported `resolveOrgId`, `computeOrgsClaimForUid`, `orgsMapsEqual`; rewrote `syncOrgMembershipClaimHandler`'s set/clear/skip branches to merge the recomputed `orgs` map into the fewest Admin SDK writes each case allows; updated the module docblock to describe the widened multi-org behavior instead of the retired single-primary-org limitation.
- `functions/src/orgMembershipClaims.test.ts` — added `fakeMemberDoc`, combined `mockFirestore` (collection + collectionGroup), and `statefulAuth` test helpers (mirroring `backfillOrgClaims.test.ts`'s established shapes); added `buildOrgsMapClaim`/`resolveOrgId`/`computeOrgsClaimForUid` describe blocks; extended `syncOrgMembershipClaimHandler`'s describe block with join, delete-recompute, primary-clear-keeps-second-org, idempotency, and superAdmin-preservation (both directions) cases; updated pre-existing assertions to include the new `orgs` key in written claim objects.

## Decisions Made
- Kept the primary-clear write path as two sequential calls through the shared `clearClaimKeys`/`mergeAndSetCustomClaims` helpers (rather than one combined raw `setCustomUserClaims`), per critical constraint 5's requirement that all writes route through those two functions — RESEARCH Pattern 3 confirmed either shape is correct; this plan chose the shape that keeps every write inside the already-tested merge-preserving primitives.
- `decideMembershipClaim` was left completely untouched (signature, body, return contract) — the `orgs` recompute is entirely additive, living in the handler plus the new shared builder/scan pair, so plan 73-03's backfill (which imports `decideMembershipClaim` directly) needs zero changes to keep working.
- Chose to compare `orgs` maps treating an absent `orgs` key (`undefined`, i.e. a legacy pre-widening token) as equivalent to `{}` for the skip/idempotency comparison — avoids a spurious write for a legacy claim belonging to a user with zero surviving memberships.

## Deviations from Plan

None - plan executed exactly as written. All five `must_haves.truths` and both `key_links` requiring `orgs` sourced exclusively from `collectionGroup('members')` (never `users/{uid}.orgIds`) are implemented and proven by dedicated tests.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This plan ships built and tested but UNDEPLOYED, per the phase's "hand over" deploy grant — the deploy runbook update and actual `firebase deploy` commands are handled by a later plan in this phase.

## Next Phase Readiness

- The widened claim writer is ready for plan 73-02 (`storage.rules`' `orgs`-map arm) to authorize against — the `orgs` claim key name (`orgs`) and value encoding (full role string) are locked and match what 73-CONTEXT.md's shared contract specifies.
- Plan 73-03's backfill can now extend to add `orgs` for existing users, reusing `buildOrgsMapClaim` (exported specifically for that reuse, per the plan's action text) with zero risk of decision-logic drift from this trigger.
- `cd functions && npx vitest run src/orgMembershipClaims.test.ts` (37/37 pass), `cd functions && npx vitest run src/backfillOrgClaims.test.ts` (12/12 pass, confirms `decideMembershipClaim`'s contract is unchanged), `cd functions && npm run build` (clean), and root `npm run type-check` (clean, `vue-tsc --build` form) all gate-checked green before this summary was written.

---
*Phase: 73-multi-org-storage-auth-claim*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `functions/src/orgMembershipClaims.ts`
- FOUND: `functions/src/orgMembershipClaims.test.ts`
- FOUND: `.planning/phases/73-multi-org-storage-auth-claim/73-01-SUMMARY.md`
- FOUND: commit `77b8e44e`
- FOUND: commit `bbad6d52`
