---
phase: 68-super-admin-access-gate
plan: 02
subsystem: auth
tags: [firebase-admin, custom-claims, cloud-functions, onCall, vitest]

# Dependency graph
requires: ["68-01: claimsHelpers.ts (mergeAndSetCustomClaims, clearClaimKeys)"]
provides:
  - "functions/src/superAdminClaims.ts: syncSuperAdminClaim (onDocumentWritten superAdmins/{uid}) — the sole superAdmin claim writer, routed through claimsHelpers"
  - "functions/src/superAdminClaims.ts: setSuperAdminClaim (onCall) — the privileged in-console grant/revoke path with defense-in-depth caller re-check"
  - "functions/src/bootstrapSuperAdmin.ts: dry-run-default, --apply-gated owner-run script for the FIRST super-admin grant"
  - "index.ts exports syncSuperAdminClaim + setSuperAdminClaim (undeployed until owner runs firebase deploy)"
affects: [68-03, 68-04, 68-05, OwnerConsoleView, firestore.rules isSuperAdmin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-doc -> trigger -> claim indirection (superAdmins/{uid} existence) mirroring syncOrgMembershipClaim, reusing claimsHelpers for both grant (merge) and revoke (scoped clear)"
    - "Privileged onCall defense-in-depth: re-verify caller BOTH via request.auth.token.<claim> AND an independent Firestore re-read of the source-of-truth doc — never trust a single signal"
    - "Target resolution exclusively via getAuth().getUserByEmail() — never a client-supplied uid"
    - "revokeRefreshTokens(uid) as the standard Admin SDK primitive for force-expiring existing sessions on revoke"
    - "Bootstrap script writes both the source doc AND calls the merge helper directly (bypassing the trigger) so the very first grant does not depend on deploy ordering"

key-files:
  created:
    - functions/src/superAdminClaims.ts
    - functions/src/superAdminClaims.test.ts
    - functions/src/bootstrapSuperAdmin.ts
    - functions/src/bootstrapSuperAdmin.test.ts
  modified:
    - functions/src/index.ts

key-decisions:
  - "setSuperAdminClaimHandler never sets the claim itself — it only writes/deletes superAdmins/{targetUid}; syncSuperAdminClaim (the trigger) remains the sole claim writer, exactly mirroring the existing org-membership indirection"
  - "bootstrapSuperAdmin.ts is the one exception to 'trigger is the sole writer': it calls mergeAndSetCustomClaims directly IN ADDITION to writing the doc, specifically so the first grant works even before syncSuperAdminClaim is deployed (T-68-06 / Pitfall 6)"
  - "Single --apply gate for bootstrapSuperAdmin.ts (no extra confirm flag) — kept consistent with backfillOrgClaims.ts's established convention per CONTEXT.md Open Question 2"

patterns-established:
  - "Every future privileged onCall that grants/revokes an authority claim should re-check the caller both via token AND a fresh Firestore doc read, and resolve any target exclusively by server-verified identity (email→uid), never a client-supplied id"

requirements-completed: [R174, R175, R176, R179]

coverage:
  - id: D1
    description: "R174 — granting (writing superAdmins/{uid}) results in mergeAndSetCustomClaims(uid, { superAdmin: true }); with existing { orgId, role } present the org keys survive the merge"
    requirement: "R174"
    verification:
      - kind: unit
        ref: "functions/src/superAdminClaims.test.ts#syncSuperAdminClaimHandler (grant tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "R175-B / SC1 direction B — revoking a user with { orgId, role, superAdmin: true } clears only superAdmin, preserving { orgId, role }"
    requirement: "R175"
    verification:
      - kind: unit
        ref: "functions/src/superAdminClaims.test.ts#\"R175-B (SC1 direction B): revoke...preserves orgId/role\""
        status: pass
    human_judgment: false
  - id: D3
    description: "R179 — setSuperAdminClaimHandler rejects unauthenticated callers, callers whose token lacks superAdmin, and callers whose superAdmins/{callerUid} doc is absent even with a valid token claim (defense-in-depth); resolves the target only via getUserByEmail; grant writes the 3-field doc; revoke deletes the doc AND calls revokeRefreshTokens(targetUid)"
    requirement: "R179"
    verification:
      - kind: unit
        ref: "functions/src/superAdminClaims.test.ts#setSuperAdminClaimHandler (9 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "R176 — bootstrapSuperAdmin dry-run (apply false) writes nothing; --apply (apply true) writes superAdmins/{uid} AND calls mergeAndSetCustomClaims directly for the resolved uid, independent of the trigger"
    requirement: "R176"
    verification:
      - kind: unit
        ref: "functions/src/bootstrapSuperAdmin.test.ts#bootstrapSuperAdmin (3 tests) + runBootstrapCli (3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "index.ts exports syncSuperAdminClaim + setSuperAdminClaim only; bootstrapSuperAdmin is never imported or exported from index.ts"
    verification:
      - kind: other
        ref: "grep confirms only a comment reference to bootstrapSuperAdmin in index.ts; no import/export statement"
        status: pass
    human_judgment: false
  - id: D6
    description: "Whole functions test suite green, functions' own tsc build clean, and root type-check (vue-tsc --build) clean"
    verification:
      - kind: unit
        ref: "cd functions && npm test (397/397 passed)"
        status: pass
      - kind: other
        ref: "cd functions && npm run build (tsc, exit 0); npm run type-check (vue-tsc --build, exit 0)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-20
status: complete
---

# Phase 68 Plan 02: Super-Admin Claim Sync, Grant/Revoke onCall & Bootstrap Summary

**`superAdmin` custom claim now flows end-to-end on the Functions side — a claim-merge-safe `syncSuperAdminClaim` trigger, a defense-in-depth `setSuperAdminClaim` onCall for in-console grant/revoke, and a dry-run-default `bootstrapSuperAdmin.ts` script for the chicken-and-egg first grant — all routed through Plan 01's shared `claimsHelpers`.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-08-20
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- New `functions/src/superAdminClaims.ts`:
  - `syncSuperAdminClaimHandler`/`syncSuperAdminClaim` (`onDocumentWritten("superAdmins/{uid}")`) — grant merges `{ superAdmin: true }` via `mergeAndSetCustomClaims`; revoke clears only the `superAdmin` key via `clearClaimKeys`, preserving any `{ orgId, role }`; never rethrows (returns `{ action: "failed", error }` on any thrown error).
  - `setSuperAdminClaimHandler`/`setSuperAdminClaim` (`onCall`) — re-verifies the caller is a super-admin BOTH via `request.auth.token.superAdmin` AND a fresh Firestore re-read of `superAdmins/{callerUid}`; resolves the target exclusively via `getAuth().getUserByEmail()`; grant writes `superAdmins/{targetUid}` (`email`, `grantedBy`, `grantedAt`); revoke deletes the doc then calls `getAuth().revokeRefreshTokens(targetUid)`. Every rejection branch is a specific `HttpsError` code (`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`).
- New `functions/src/bootstrapSuperAdmin.ts` — mirrors `backfillOrgClaims.ts`'s dry-run-default/`--apply`-gated/`require.main === module` shape. Resolves the target by email→uid, and on `--apply` writes `superAdmins/{uid}` AND calls `mergeAndSetCustomClaims` directly (not solely via the trigger), so the very first grant lands regardless of whether `syncSuperAdminClaim` has been deployed yet.
- `functions/src/index.ts` now exports `syncSuperAdminClaim` + `setSuperAdminClaim` only — `bootstrapSuperAdmin` is deliberately never imported or exported (it is a script, not a deployed Function).
- 19 new unit tests across the two test files (13 in `superAdminClaims.test.ts`, 6 in `bootstrapSuperAdmin.test.ts`), all passing.

## Task Commits

Each task was committed atomically:

1. **Task 1: superAdminClaims.ts — sync trigger + privileged onCall + tests + index exports** - `cf5a7d3f` (feat)
2. **Task 2: bootstrapSuperAdmin.ts owner-run first-super-admin script + test** - `6583eef8` (feat)

**Plan metadata:** commit created below (docs: complete plan)

## Files Created/Modified
- `functions/src/superAdminClaims.ts` - `syncSuperAdminClaim` trigger + `setSuperAdminClaim` onCall, both with testable handlers split from their deployed wrappers
- `functions/src/superAdminClaims.test.ts` - 13 tests: R174 grant/merge, R175-B revoke-preserves-org, R179 caller-recheck rejections + grant/revoke writes + `revokeRefreshTokens` call
- `functions/src/bootstrapSuperAdmin.ts` - dry-run-default, `--apply`-gated script writing the doc + claim directly
- `functions/src/bootstrapSuperAdmin.test.ts` - 6 tests: dry-run writes nothing, `--apply` writes doc + claim, org-claim-preserving merge, CLI missing-email/failure/dry-run paths
- `functions/src/index.ts` - added `syncSuperAdminClaim` + `setSuperAdminClaim` imports and named re-exports, following the exact `syncOrgMembershipClaim` export style

## Decisions Made
- `setSuperAdminClaimHandler` never calls `mergeAndSetCustomClaims`/`clearClaimKeys` itself — it only writes/deletes the `superAdmins/{targetUid}` source document; `syncSuperAdminClaim` remains the sole claim writer, keeping the source-doc→trigger→claim indirection consistent with `orgMembershipClaims.ts`.
- `bootstrapSuperAdmin.ts` is the deliberate exception: it calls `mergeAndSetCustomClaims` directly in addition to writing the doc, because the chicken-and-egg first grant cannot depend on the trigger being deployed yet (T-68-06).
- Kept a single `--apply` gate for the bootstrap script (no additional confirm flag), matching `backfillOrgClaims.ts`'s established convention per CONTEXT.md's Open Question 2 resolution.

## Deviations from Plan
None — plan executed exactly as written. `orgMembershipClaims.ts` was already routed through `claimsHelpers.ts` and `superAdmin`-preservation was already covered by Plan 01's regression test, so no additional changes to that file were needed here.

## Issues Encountered
None.

## Auth Gates
None encountered — no CLI login or external credential setup was required for this plan (build + test only, no deploy).

## User Setup Required
None for this plan's automated portion. Deferred to the owner (per v1.9 deploy discipline and the Plan 05 runbook):
- `firebase deploy --only functions:syncSuperAdminClaim,functions:setSuperAdminClaim` to ship the trigger and onCall.
- Running `node lib/bootstrapSuperAdmin.js --email <owner-email> --apply` (after `npm run build`) once, to grant the very first super-admin.
- Manual UAT of the real revoke session-cutoff timing (the ≤1hr token-lifetime propagation window is live-Firebase behavior) — deferred to `/gsd-verify-work 68` per the plan's verification section. The unit test only proves `revokeRefreshTokens` is called.

## Next Phase Readiness
- `superAdminClaims.ts` and `bootstrapSuperAdmin.ts` are ready for the `firestore.rules` `isSuperAdmin()` gate (R178) and the client-side owner console (R177) work in the other Wave-2/3 plans (68-03/68-04) to build against.
- No blockers. All four requirements this plan targets (R174, R175, R176, R179) are proven by unit tests; `cd functions && npm test`, `cd functions && npm run build`, and root `npm run type-check` are all green.

---
*Phase: 68-super-admin-access-gate*
*Completed: 2026-08-20*

## Self-Check: PASSED

All created files confirmed present on disk (`functions/src/superAdminClaims.ts`, `functions/src/superAdminClaims.test.ts`, `functions/src/bootstrapSuperAdmin.ts`, `functions/src/bootstrapSuperAdmin.test.ts`); both task commit hashes (`cf5a7d3f`, `6583eef8`) confirmed in `git log`.
