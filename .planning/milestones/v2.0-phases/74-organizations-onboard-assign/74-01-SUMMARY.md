---
phase: 74-organizations-onboard-assign
plan: 01
subsystem: api
tags: [firebase-functions, firebase-admin, firestore-transaction, onCall, super-admin]

# Dependency graph
requires:
  - phase: 73-organizations-multi-org-claims
    provides: syncOrgMembershipClaim trigger that auto-widens the {orgId,role,orgs} claim when organizations/{orgId}/members/{uid} is written
  - phase: 68-owner-console-super-admin
    provides: the setSuperAdminClaimHandler caller-gate pattern and superAdmins/{uid} source-of-truth doc mirrored verbatim here
provides:
  - "onboardOrganization onCall callable: atomically creates organizations/{orgId} + seeded OrgSettings + orgNames uniqueness claim + first admin membership/invite in ONE Firestore transaction"
  - "assignOrgAdmin onCall callable: adds/invites an additional editor admin to an existing org via an additive arrayUnion write"
  - "listOrganizations onCall callable: server-computed org summaries with member counts via count() aggregate"
  - "resolveAdminTarget + writeAdminAssignment shared helpers (functions/src/orgProvisioning.ts) -- the single place the R206 additive arrayUnion guarantee lives"
  - "functions/src/orgTemplateSeed.ts: ported buildSuggestedTemplateEntries()/buildDefaultOrgSettings() data-only seed module"
affects: [74-02-organizations-tab-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-transaction onboarding: the orgNames uniqueness check, org doc, seeded settings, AND the first-admin write are ALL enqueued on one runTransaction -- no post-commit step can strand an admin-less org (R202)"
    - "Pre-write Auth resolution: resolveAdminTarget (the only network/Auth call) runs BEFORE any Firestore write in both onboarding and assignment, so a rethrown transient error creates nothing"
    - "Shared write-only helper via a structural AdminWriter interface (just .set) so the same writeAdminAssignment function is reused across a Transaction (onboarding) and a WriteBatch (assignOrgAdmin) without any Transaction|WriteBatch union-type friction"

key-files:
  created:
    - functions/src/orgTemplateSeed.ts
    - functions/src/orgTemplateSeed.test.ts
    - functions/src/orgProvisioning.ts
    - functions/src/orgProvisioning.test.ts
  modified:
    - functions/src/index.ts

key-decisions:
  - "AdminWriter structural interface (just a .set method) instead of a Transaction | WriteBatch union type -- avoids relying on TS unifying the two SDK types' overloaded generic set() signatures, while still letting writeAdminAssignment be called identically from a transaction and a batch"
  - "orgId minted via db.collection('organizations').doc() (fresh auto-id, no network round trip) BEFORE the transaction starts, then threaded into the SAME transaction for the org doc, orgNames claim, and first-admin write"
  - "listOrganizations uses N parallel count() aggregate queries via Promise.all (one per org) rather than a denormalized counter or a collectionGroup scan -- matches 74-RESEARCH.md's 'proportionate at current scale' recommendation"

requirements-completed: [R196, R197, R198, R199, R200, R201, R202, R203, R204, R205, R206]

coverage:
  - id: D1
    description: "Every callable rejects an unauthenticated caller, a caller whose token lacks superAdmin, and a caller with no superAdmins/{callerUid} doc"
    requirement: "R200/R204"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#caller gate (9 tests across all three handlers)"
        status: pass
    human_judgment: false
  - id: D2
    description: "onboardOrganization atomically writes organizations/{orgId} (name/createdAt/createdBy + deep-merged OrgSettings with the 9-entry seeded template) AND the first editor member in ONE Firestore transaction -- no post-commit step"
    requirement: "R197/R198/R199"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#onboardOrganizationHandler > R202 (single atomic commit): orgNames + org + settings + first-admin all write via the SAME transaction, batch is never used"
        status: pass
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#onboardOrganizationHandler > R197/R198/R199: org doc settings carry the 9-entry seeded template; first admin is added at editor"
        status: pass
      - kind: unit
        ref: "functions/src/orgTemplateSeed.test.ts (6 tests pinning the 9-entry {kind,section} sequence)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A duplicate normalizeOrgName collision throws already-exists and creates no second org"
    requirement: "R201"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#onboardOrganizationHandler > R201: a duplicate name throws already-exists and writes nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "A transient onboarding failure (non-user-not-found Auth error before the transaction) commits nothing, so a clean same-name retry succeeds without manual cleanup"
    requirement: "R202"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#onboardOrganizationHandler > R202 (no-strand): a non-user-not-found Auth error throws before the transaction ever runs"
        status: pass
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#onboardOrganizationHandler > R202 (clean retry): the SAME name succeeds on a follow-up call once the transient error clears"
        status: pass
    human_judgment: false
  - id: D5
    description: "Assigning an org to a user who already belongs to another org is additive (FieldValue.arrayUnion), never an overwrite, on both the onboarding and assignOrgAdmin write paths"
    requirement: "R206"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#onboardOrganizationHandler > R206: an admin already in another org keeps it"
        status: pass
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#assignOrgAdminHandler > R206: additive arrayUnion (not an overwrite) for a user already in another org"
        status: pass
    human_judgment: false
  - id: D6
    description: "assignOrgAdmin for an unknown email writes invites/{email} + inviteLookup/{email} and returns {status:'invited'}, never a members write, never a silent failure; discriminates auth/user-not-found from other Auth error codes"
    requirement: "R205"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#assignOrgAdminHandler > R205: an unknown email invites instead of creating a membership, never throws"
        status: pass
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#assignOrgAdminHandler > T-74-05: a non-user-not-found Auth error throws instead of silently inviting"
        status: pass
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#onboardOrganizationHandler > R205: an unknown admin email invites instead of writing a members doc"
        status: pass
    human_judgment: false
  - id: D7
    description: "assignOrgAdmin for an existing account writes members/{uid} at editor and returns {status:'added'}; a nonexistent orgId is rejected before any write (orphan guard)"
    requirement: "R203"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#assignOrgAdminHandler > R203: an existing account is added at editor via the batch, returns {status:'added', uid}"
        status: pass
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#assignOrgAdminHandler > T-74-06 (orphan guard): a nonexistent orgId throws not-found and writes nothing"
        status: pass
    human_judgment: false
  - id: D8
    description: "listOrganizations returns [{orgId,name,createdAt,memberCount}] with server-computed member counts via count() aggregate queries"
    requirement: "R196"
    verification:
      - kind: unit
        ref: "functions/src/orgProvisioning.test.ts#listOrganizationsHandler (2 tests: N orgs + empty collection)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-21
status: complete
---

# Phase 74 Plan 01: Org-Provisioning Callables Summary

**Three super-admin-gated onCall callables (`onboardOrganization`, `assignOrgAdmin`, `listOrganizations`) with a single-transaction onboarding flow that atomically creates an org, seeds its settings/template, and assigns its first admin -- no post-commit step can strand an admin-less org.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-21T16:24:00Z (approx, first plan read)
- **Completed:** 2026-08-21T16:34:34Z
- **Tasks:** 3/3 completed
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `functions/src/orgTemplateSeed.ts` -- a pure, data-only port of the client's 9-entry Suggested Template (`buildSuggestedTemplateEntries`) and `DEFAULT_ORG_SETTINGS`, pinned byte-identical by `orgTemplateSeed.test.ts`.
- `functions/src/orgProvisioning.ts` -- `onboardOrganization`, `assignOrgAdmin`, `listOrganizations`, all behind the dual super-admin caller gate (token claim + fresh Firestore re-read of `superAdmins/{callerUid}`), mirroring `superAdminClaims.ts` verbatim.
- R202 atomicity delivered by construction: `resolveAdminTarget` (the only Auth network call) runs before any write; the orgNames uniqueness check, org doc + seeded settings, and the first-admin membership/invite all enqueue on ONE `runTransaction` -- a transient failure or a duplicate-name collision commits nothing, so a clean retry needs no manual cleanup.
- R206 additive guarantee centralized in one `writeAdminAssignment` helper reused by both callables (a `Transaction` from onboarding, a `WriteBatch` from `assignOrgAdmin`) via a minimal structural `AdminWriter` interface -- `users/{uid}.orgIds` is always `FieldValue.arrayUnion(orgId)` in a merge-set, never an overwrite.
- `functions/src/index.ts` wired with the three new onCall exports.
- 25 new unit tests in `orgProvisioning.test.ts` plus 6 in `orgTemplateSeed.test.ts` covering every requirement's per-task verification map; full functions suite (483 tests) and root `vue-tsc --build` type-check both stay green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Port the suggested-template + default-settings seed** - `4e3bc68c` (feat)
2. **Task 2: Implement the three callables + shared helpers + export wiring** - `38d9dfc0` (feat)
3. **Task 3: Comprehensive mocked-Admin-SDK unit tests** - `a73bb560` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `functions/src/orgTemplateSeed.ts` - pure ported `buildSuggestedTemplateEntries()`/`buildDefaultOrgSettings()`, no Firestore/Auth access
- `functions/src/orgTemplateSeed.test.ts` - pins the 9-entry `{kind,section}` sequence + default settings shape
- `functions/src/orgProvisioning.ts` - the three callables, `assertSuperAdminCaller`, `resolveAdminTarget`, `writeAdminAssignment`, `normalizeOrgName`/`deriveSlug` ports
- `functions/src/orgProvisioning.test.ts` - 25 tests: caller gate, duplicate-name, atomic retry (no-strand + single-commit), additive arrayUnion, no-account invite, auth-error discrimination, orphan guard, list
- `functions/src/index.ts` - added `import { onboardOrganization, assignOrgAdmin, listOrganizations } from "./orgProvisioning"` and the matching export block

## Decisions Made
- Chose a structural `AdminWriter` interface (`{ set(ref, data, options?) }`) over a `Transaction | WriteBatch` union type for `writeAdminAssignment`'s `writer` parameter -- confirmed via a clean `tsc` build that both SDK types satisfy it structurally, avoiding any risk of the union's overloaded generic `set()` signatures failing to unify.
- Followed the plan's revised single-transaction design (not RESEARCH.md's original transaction-then-batch two-phase sketch) exactly as the critical constraints specified -- this is the whole reason the plan was revised for R202.
- `listOrganizations` uses `Promise.all` over N per-org `count()` aggregate queries, matching 74-RESEARCH.md Pattern 3's "proportionate at current scale" recommendation over a denormalized counter or a `collectionGroup` scan.

## Deviations from Plan

None - plan executed exactly as written. The critical constraints (dual caller gate, R202 single-transaction atomicity, shared `writeAdminAssignment` helper, `resolveAdminTarget`'s error-code discrimination, R198 template seed, callable contracts, no rules/auth.ts changes) were all followed verbatim; no Rule 1-4 deviations were needed.

## Issues Encountered
None.

## User Setup Required

None for this plan's code -- but the three callables are **HAND-OVER, UNDEPLOYED**. Once the owner is ready to make them live, run:

```
firebase deploy --only functions:onboardOrganization,functions:assignOrgAdmin,functions:listOrganizations
```

No secrets involved; no `firestore.rules`/`storage.rules` change accompanies this deploy (the Admin SDK bypasses rules for these privileged writes, per the plan's critical constraints).

## Next Phase Readiness
Wave 2 (74-02, the Organizations tab UI) can now consume these three callable contracts as fixed: `onboardOrganization({name, adminEmail}) -> {status:'added'|'invited', orgId, name}`, `assignOrgAdmin({orgId, email}) -> {status:'added'|'invited', uid?}`, `listOrganizations() -> {organizations: [{orgId,name,createdAt,memberCount}]}`. No blockers -- the server surface for Phase 74 is complete, tested, and undeployed pending the owner's `firebase deploy` above.

---
*Phase: 74-organizations-onboard-assign*
*Completed: 2026-08-21*

## Self-Check: PASSED

All created files and task commit hashes verified present on disk / in git log.
