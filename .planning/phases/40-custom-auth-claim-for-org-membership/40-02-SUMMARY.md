---
phase: 40-custom-auth-claim-for-org-membership
plan: 02
subsystem: auth
tags: [firebase, functions, custom-claims, firestore-trigger, vitest]

# Dependency graph
requires:
  - phase: 40-custom-auth-claim-for-org-membership (plan 01)
    provides: "Dual-read storage.rules reading request.auth.token.orgId / request.auth.token.role"
provides:
  - "functions/src/orgMembershipClaims.ts: buildOrgMembershipClaim, ORG_CLAIM_KEYS, decideMembershipClaim (shared decision function), syncOrgMembershipClaimHandler, syncOrgMembershipClaim (onDocumentWritten trigger)"
  - "syncOrgMembershipClaim exported from functions/src/index.ts, part of the deployable function surface (undeployed)"
  - "decideMembershipClaim's discriminated-union decision shape ({action:'set',claims}|{action:'clear'}|{action:'skip',reason}) for plan 40-04's backfill to import and reuse"
affects: [40-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single onDocumentWritten trigger covering create/update/delete via event.data.before/after.exists, mirroring requestPptxRenderHandler/requestPptxRender's exported-handler-for-testability shape"
    - "Independent re-derivation of the authorization-relevant value (primary org) from Firestore rather than trusting the event's path param, mirroring parsePptxHandler's never-trust-the-caller pattern"
    - "Handler resolves a failure outcome instead of throwing, so a Firestore trigger error cannot trigger unbounded Cloud Functions retries"

key-files:
  created:
    - functions/src/orgMembershipClaims.ts
    - functions/src/orgMembershipClaims.test.ts
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "decideMembershipClaim groups both 'user doc missing' and 'orgIds empty' under the single skip reason 'no-user-doc', per the plan's explicit action-step wording ('If the document does not exist, or its orgIds is absent or empty, return skip/no-user-doc')."
  - "syncOrgMembershipClaimHandler's SyncOrgMembershipClaimOutcome adds a fourth 'failed' action beyond decideMembershipClaim's three-way union, carrying the stringified error -- this is the outcome a rejecting getAuth().getUser() (or any other thrown error) resolves to, never a throw out of the handler."
  - "The trigger wrapper's SyncOrgMembershipClaimParams keeps a `before` field for interface parity with the event.data.before/after shape used elsewhere in this codebase, but the handler body never destructures or reads it -- decideMembershipClaim only ever needs `after?.role` (undefined signals a delete). No noUnusedLocals violation results because the unread property is never extracted from the params object."

requirements-completed: [R074, R075]

coverage:
  - id: D1
    description: "A create of organizations/{orgId}/members/{uid} where orgId equals the user's orgIds[0] results in setCustomUserClaims(uid, { orgId, role }) exactly once"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > create, primary org: calls setCustomUserClaims exactly once with { orgId, role }"
        status: pass
    human_judgment: false
  - id: D2
    description: "A role change on the primary membership doc results in a fresh setCustomUserClaims call carrying the new role"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > role change: writes a fresh claim carrying the new role"
        status: pass
    human_judgment: false
  - id: D3
    description: "A legacy role: 'admin' value is normalised to 'editor' in the written claim, never 'admin'"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > legacy admin: the claim written carries 'editor', never 'admin'"
        status: pass
    human_judgment: false
  - id: D4
    description: "A delete of the primary membership doc results in setCustomUserClaims(uid, null) -- all custom claims cleared -- exactly once"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > delete, primary org: calls setCustomUserClaims exactly once with null as the second argument"
        status: pass
    human_judgment: false
  - id: D5
    description: "A write or delete on a members doc whose orgId is NOT the user's orgIds[0] results in setCustomUserClaims never being called -- the primary claim survives a non-primary-org membership removal"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > non-primary org write: setCustomUserClaims is NOT called at all"
        status: pass
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > non-primary org DELETE: setCustomUserClaims is NOT called -- the primary claim survives"
        status: pass
    human_judgment: false
  - id: D6
    description: "A write for a uid with no users/{uid} document, or with an empty orgIds array, results in no claims call and no thrown error"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > missing user document: no claims call, no throw"
        status: pass
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > empty orgIds: no claims call, no throw"
        status: pass
    human_judgment: false
  - id: D7
    description: "An already-current claim produces no redundant setCustomUserClaims call (idempotent no-op)"
    requirement: "R075"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > already current: no redundant setCustomUserClaims call"
        status: pass
    human_judgment: false
  - id: D8
    description: "A getAuth().getUser() rejection (e.g. a deleted auth user) resolves with a failure outcome and is logged -- it never throws out of the trigger"
    requirement: "R074"
    verification:
      - kind: unit
        ref: "functions/src/orgMembershipClaims.test.ts#syncOrgMembershipClaimHandler > auth lookup failure: getUser rejecting resolves with a failure outcome, does not throw out of the handler"
        status: pass
    human_judgment: false
  - id: D9
    description: "syncOrgMembershipClaim is exported from functions/src/index.ts, part of the deployable function surface, with no existing export/handler/constant modified"
    requirement: "R074"
    verification:
      - kind: other
        ref: "git diff functions/src/index.ts (base 19cc9fc..HEAD) shows only added lines"
        status: pass
      - kind: unit
        ref: "cd functions && npm run test -- 91 passed (91), no regression in index.test.ts, pptxParser.test.ts, or renderInvoker.test.ts"
        status: pass
    human_judgment: false
  - id: D10
    description: "The claim's production behaviour behind storage.rules (the new claim being correctly readable in a real ID token, and the owner's actual invite-acceptance flow) -- genuinely requires the owner's deploy 1"
    verification: []
    human_judgment: true
    rationale: "This plan is explicitly built-and-tested-never-deployed per the phase's hard scope fence. The trigger's logic is proven against mocked Admin SDK seams; whether Cloud Functions' actual deployment/IAM/propagation behaves identically is deferred to the owner's post-deploy-1 verification recorded in .planning/PENDING-VERIFICATION.md (per plan 40-04's DEPLOY-ORG-CLAIMS.md runbook)."

# Metrics
duration: ~8min
completed: 2026-08-06
status: complete
---

# Phase 40 Plan 02: Claims-Setting Cloud Function Summary

**Single `onDocumentWritten` trigger (`syncOrgMembershipClaim`) that computes and sets the `{ orgId, role }` custom auth claim from `organizations/{orgId}/members/{uid}` writes, sharing its decision logic (`decideMembershipClaim`) for plan 40-04's backfill to reuse — built and unit-tested, never deployed.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-06T22:51:13Z (baseline: prior plan 40-01's completion commit)
- **Completed:** 2026-08-06T22:57:15Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `functions/src/orgMembershipClaims.ts` exports `buildOrgMembershipClaim`, `ORG_CLAIM_KEYS`, `decideMembershipClaim`, `syncOrgMembershipClaimHandler`, and `syncOrgMembershipClaim` — mirroring `requestPptxRenderHandler`/`requestPptxRender`'s exported-handler-for-testability pattern.
- `decideMembershipClaim` independently re-derives the user's primary org from `users/{uid}.orgIds[0]` via Firestore on every call, never trusting the event's `orgId` param alone (T-40-05 mitigation, same discipline as `parsePptxHandler`'s independent membership re-check).
- One trigger covers all three lifecycle events via `event.data.before/after.exists`: create/update sets `{ orgId, role }`, delete of the primary membership clears via `setCustomUserClaims(uid, null)`.
- A write or delete on a non-primary-org membership doc is a structural no-op — `setCustomUserClaims` is never called, proven by an exact zero-call-count assertion in both the write and delete cases.
- Legacy `role: 'admin'` is normalised to `'editor'` in `buildOrgMembershipClaim`, matching what `loadOrgContext` already shows the user.
- Idempotent: an already-current claim (matching on both `orgId` and `role`) produces no redundant `setCustomUserClaims` call.
- The handler wraps its entire body in try/catch and resolves a `{ action: 'failed', error }` outcome instead of rethrowing — proven against a rejecting `getAuth().getUser()` — so a transient Auth API failure cannot trigger a Cloud Functions retry storm (T-40-08).
- `syncOrgMembershipClaim` is re-exported by name from `functions/src/index.ts`, alongside a section comment recording the claim contract, lifecycle coverage, and the no-separate-invite-path insight. Only the trigger is exported — `decideMembershipClaim`, `buildOrgMembershipClaim`, and `syncOrgMembershipClaimHandler` remain reachable only via direct module import in tests.
- The multi-org known-limitation comment (D-01/D-04) is present directly above `decideMembershipClaim`: the claim carries the user's PRIMARY org only, and non-primary orgs stay covered by `storage.rules`' Firestore-membership arm alone.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared claim-decision module, the trigger handler, and its unit tests** - `06dda18` (feat)
2. **Task 2: Export the trigger from functions/src/index.ts without disturbing existing exports** - `3868052` (feat)

## Files Created/Modified

- `functions/src/orgMembershipClaims.ts` - The shared claim-decision module: `buildOrgMembershipClaim`, `ORG_CLAIM_KEYS`, `decideMembershipClaim`, `syncOrgMembershipClaimHandler`, `syncOrgMembershipClaim`. No module-scope `initializeApp()` call.
- `functions/src/orgMembershipClaims.test.ts` - Unit tests covering every case in the plan's `<behavior>` list against mocked `firebase-admin/auth`, `firebase-admin/firestore`, and `firebase-functions/v2/firestore` seams, mirroring `index.test.ts`'s mocking pattern.
- `functions/src/index.ts` - Adds one import and one `export { syncOrgMembershipClaim }` re-export with a section comment; no existing export, handler, or constant modified (git diff shows only added lines).
- `functions/src/index.test.ts` - Added `onDocumentWritten` to the existing `firebase-functions/v2/firestore` mock (see Deviations below).

## Decisions Made

- Grouped "user doc missing" and "orgIds empty" under one skip reason (`no-user-doc`) rather than a fourth reason value — the plan's action-step text explicitly describes both conditions as producing the same `no-user-doc` outcome.
- Added a fourth `SyncOrgMembershipClaimOutcome` variant (`{ action: 'failed', error }`) beyond `decideMembershipClaim`'s three-way union, since the plan's behavior list requires the handler (not the decision function) to resolve a failure outcome on a thrown error rather than propagating it.
- Kept `before` in `SyncOrgMembershipClaimParams`'s type for interface parity with the trigger's `event.data.before/after` unpacking, but never destructure it in the handler body — `decideMembershipClaim` only needs `after?.role`. This avoids an unused-variable situation without weakening the interface contract plan 40-04 might rely on.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `onDocumentWritten` to `index.test.ts`'s existing mock**
- **Found during:** Task 2 (exporting `syncOrgMembershipClaim` from `functions/src/index.ts`)
- **Issue:** `functions/src/index.test.ts` imports `./index`, and `./index.ts` now transitively imports `./orgMembershipClaims`, which calls `onDocumentWritten` from `firebase-functions/v2/firestore` at module scope. `index.test.ts`'s existing mock of that module only returned `onDocumentCreated`, so the whole `index.test.ts` suite failed to even load with `"No 'onDocumentWritten' export is defined on the ... mock"` — exactly the risk the plan's own `<read_first>` note for Task 2 flagged ("any new module-scope side effect in index.ts must be neutralisable by the existing mocks or the whole functions suite breaks").
- **Fix:** Added `onDocumentWritten: vi.fn((_path, handler) => handler)` to the existing `vi.mock("firebase-functions/v2/firestore", ...)` block in `functions/src/index.test.ts`, with a comment noting this suite only neutralizes the module-scope call — the trigger's actual behavior is covered separately in `orgMembershipClaims.test.ts`.
- **Files modified:** `functions/src/index.test.ts`
- **Verification:** `cd functions && npm run test` — 91 passed (91), all four test files green, no regression in `index.test.ts`'s 43 existing assertions.
- **Committed in:** `3868052` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The plan's acceptance criterion "`git diff --name-only` lists exactly `functions/src/orgMembershipClaims.ts`, `functions/src/orgMembershipClaims.test.ts`, `functions/src/index.ts`" is technically widened by this fix to also include `functions/src/index.test.ts` — a necessary consequence of `index.ts` gaining a new module-scope import, not scope creep. `functions/src/index.ts`'s own diff (the acceptance criterion that matters for "no existing export/handler/constant modified") is unaffected and shows only added lines, as required.

## Issues Encountered

None beyond the deviation above. `npx tsc --noEmit` exited 0 on the first attempt for both tasks — `strict` and `noUnusedLocals` were satisfied without needing any type-narrowing rework.

## User Setup Required

None - no external service configuration required. No deploy command was run at any point in this plan; `git diff functions/package.json functions/package-lock.json` is empty (no dependency added or bumped), and `firestore.rules`/`storage.rules` were not touched.

## Next Phase Readiness

- Plan 40-04's backfill script can import `decideMembershipClaim` directly from `functions/src/orgMembershipClaims.ts` and reuse its exact three-way decision shape (`{ action: 'set', claims }` | `{ action: 'clear' }` | `{ action: 'skip', reason }`) — the two implementations cannot drift, per DISC-02.
- `syncOrgMembershipClaim` is part of the deployable function surface (undeployed), ready for the owner's deploy 1 alongside `storage.rules`' dual-read from plan 40-01.
- The whole `functions/` suite is green at 91/91, and `npx tsc --noEmit` exits 0.
- No blockers. `functions/DEPLOY-ORG-CLAIMS.md` (plan 40-04, not yet written) is the next artifact that will document the two-deploy sequence, the T-40-04 stale-grant acceptance, and the invite-acceptance race (research Open Question 1) for the owner.

---
*Phase: 40-custom-auth-claim-for-org-membership*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: functions/src/orgMembershipClaims.ts
- FOUND: functions/src/orgMembershipClaims.test.ts
- FOUND: .planning/phases/40-custom-auth-claim-for-org-membership/40-02-SUMMARY.md
- FOUND: 06dda18 (feat(40-02): add shared org-membership claim decision module and trigger)
- FOUND: 3868052 (feat(40-02): export syncOrgMembershipClaim from functions/src/index.ts)
