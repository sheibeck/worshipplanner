---
phase: 112-security-review
plan: 02
subsystem: auth
tags: [firestore, firebase-functions, custom-claims, cloud-functions, route-guards, security-review]

requires:
  - phase: 110-architectural-review
    provides: ARCH-005 (undeployed org-provisioning functions handoff) and ARCH-018 (super-admin isOrgEditor universal-grant residual) — both re-evaluated under a security lens here
provides:
  - Severity-ranked findings for auth/custom-claims (src/stores/auth.ts), route guards (src/router/index.ts), and every Cloud Functions callable/HTTP/trigger handler's authorization
  - ARCH-005 re-assessed with live production evidence (firebase functions:list, read-only) — corrects a stale Phase 110 "UNDEPLOYED" premise; downgraded to Low (resolved)
  - ARCH-018 re-evaluated as a genuine Medium privilege-scope finding with a fix-shape and required ALLOW-case test, not merely re-confirmed as Phase 78-accepted
affects: [112-04-consolidation, 113-remediation]

tech-stack:
  added: []
  patterns: [assertSuperAdminCaller double-check pattern (token claim + independent Firestore re-read), server-side org-membership re-verification on every callable, VERIFY-FIRST webhook signature order]

key-files:
  created:
    - .planning/phases/112-security-review/112-FINDINGS-auth-functions.md
  modified: []

key-decisions:
  - "Ran firebase functions:list (read-only, confirmed against worship-planner-bc515 prod project) as live evidence for ARCH-005 rather than relying solely on stale hand-over notes — found all 7 org-provisioning/deletion functions ARE deployed and match functions/src/index.ts exports 1:1 with zero drift."
  - "Re-scored ARCH-018 independently under a security lens (Medium) rather than deferring to its Phase 78 'accepted' status, per the plan's explicit instruction not to merely echo the architectural note."
  - "Flagged SEC-A-01 (Medium): /api/planningcenter proxy route has zero authentication, unlike its anthropic/esv/nlt siblings, because it injects no server secret — an authz-gap distinct from (and not scored as) a cost/abuse-control finding, which is 112-03's dimension."

requirements-completed: [R322]

coverage:
  - id: D1
    description: "Auth/custom-claims, route guards, and Cloud Functions authorization dimensions reviewed with severity-ranked, concretely-located findings"
    requirement: "R322"
    verification:
      - kind: other
        ref: "112-FINDINGS-auth-functions.md contains ## Critical/High and ## Medium/Low sections referencing functions/src/, src/router, and src/stores/auth.ts; git status --porcelain -- src functions firestore.rules storage.rules is empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "ARCH-005 and ARCH-018 assessed with independent security-lens severities and concrete locations, not merely echoed as accepted architectural notes"
    requirement: "R322"
    verification:
      - kind: other
        ref: "112-FINDINGS-auth-functions.md contains dedicated ARCH-005 and ARCH-018 sections with their own severity calls, concrete locations, and (for ARCH-018) a required-test note"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-02
status: complete
---

# Phase 112 Plan 02: Auth/Custom-Claims + Route Guards + Cloud Functions Authorization Review Summary

**Static security review of auth.ts custom-claims, router guards, and every Cloud Functions handler's server-side authz — surfaced an unauthenticated `/api/planningcenter` proxy route, and used live `firebase functions:list` evidence to overturn Phase 110's stale "undeployed provisioning functions" premise while independently re-scoring the super-admin universal-grant residual (ARCH-018) as a genuine Medium finding.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-02T11:24:00-04:00
- **Completed:** 2026-09-02T12:09:09-04:00
- **Tasks:** 2 completed
- **Files modified:** 1 (findings file only)

## Accomplishments
- Reviewed `src/stores/auth.ts`'s custom-claim handling (claim refresh/retry, `loadOrgContext`,
  `enterOrgAsSuperAdmin`/`exitSuperAdminView`), `src/router/index.ts`'s full route table and
  `beforeEach` guard, and every `functions/src/index.ts` `onCall`/`onRequest`/`onDocumentCreated`/
  `onDocumentWritten`/`onSchedule` export plus `orgProvisioning.ts`, `orgDeletion.ts`,
  `claimsHelpers.ts`, `superAdminClaims.ts`, `orgMembershipClaims.ts`, `bootstrapSuperAdmin.ts`, and
  `inviteOnboarding.ts` for server-side authorization gaps.
- Confirmed every reviewed Cloud Functions callable re-verifies caller identity + org membership/role
  server-side (member-doc read or `superAdmins/{uid}` double-check) rather than trusting a
  client-declared `orgId`/`role`/claim — with one exception: `SEC-A-01`.
- **SEC-A-01 (Medium):** `/api/planningcenter` (`functions/src/index.ts:77-87,496-505`) is reachable
  with zero authentication, unlike the `anthropic`/`esv`/`nlt` sibling routes, because it injects no
  server-held secret — an unauthenticated open relay to Planning Center's API via our deployed
  infrastructure.
- **SEC-A-02 (Low, informational):** confirmed `refreshOrgClaim`'s bounded retry window
  (`src/stores/auth.ts:280-299`) is a latency window only, not a privilege-elevation race — every
  value it reads comes from the server-verified ID token, and no server handler trusts a stale client
  claim (matches ARCH-019's confirmed finding).
- **ARCH-005 re-assessed with live evidence:** ran `firebase functions:list` (read-only) against the
  confirmed-live `worship-planner-bc515` prod project and found all 7 org-provisioning/deletion
  functions (`onboardOrganization`, `assignOrgAdmin`, `listOrganizations`, `setOrgActive`,
  `setOrgAiEnabled`, `setOrgBibleEnabled`, `deleteOrganization`) ARE deployed, matching
  `functions/src/index.ts`'s 23 exports 1:1 with zero drift. This directly contradicts Phase 110's
  "UNDEPLOYED per their own hand-over notes" premise. Downgraded from Medium to **Low (resolved)** —
  the deploy-state uncertainty ARCH-005 flagged is fully resolved, and the authz model (all handlers
  route through `assertSuperAdminCaller`'s double-check pattern) is sound. Not escalated to Phase 113's
  Critical/High scope.
- **ARCH-018 re-evaluated (not merely re-confirmed):** re-scored the super-admin universal
  `isOrgEditor` grant (`firestore.rules:28-43,141-143`) as a genuine **Medium** privilege-scope
  finding under a security lens, rather than deferring to its Phase 78 "accepted" status. Documented
  why the R226 guarantee ("entering a church as super-admin creates no member doc") holds only as
  client-code contract (confirmed by reading `enterOrgAsSuperAdmin` line-by-line: zero Firestore
  writes) where the rules grant is actually much broader than R226's framing implies (covers create/
  update/delete on any org's `members/{uid}`). Provided a fix-shape (scope the super-admin write grant
  to an explicit "acting as editor of org X" signal) and the required ALLOW-case test a Phase 113 fix
  would need.
- Cross-referenced this file's findings against 112-01's `SEC-ISO-01`, `SEC-ISO-02`, and `SEC-ISO-04`
  without re-scoring them, per the phase's disjoint-findings-file convention.

## Task Commits

Each task was committed as a single combined commit since both write to the same findings file:

1. **Task 1 + Task 2: Auth/claims/route-guard/functions review + ARCH-005/ARCH-018 assessment** -
   `57c21875` (docs)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

_Note: this is a review-only plan (no TDD, no source changes) — a single docs commit covers both
tasks' output to the one findings file._

## Files Created/Modified
- `.planning/phases/112-security-review/112-FINDINGS-auth-functions.md` - Severity-ranked findings
  for auth/custom-claims, route guards, and Cloud Functions authorization, including the ARCH-005 and
  ARCH-018 re-assessments and cross-reference notes to 112-01's findings file.

## Decisions Made
- Ran `firebase functions:list` (a read-only listing command, not a deploy) against the confirmed-live
  prod project as evidence-gathering for ARCH-005, since the plan's read_first explicitly asked to
  assess "the deploy state" and the Phase 110 handoff called for exactly this kind of deploy-state
  audit. This produced a materially different (and more useful) answer than static reading alone could
  have: the functions are deployed, not undeployed.
- Kept `SEC-A-01`'s scope narrowly to the authorization gap (no auth check on `/api/planningcenter`)
  rather than scoring its rate-limiting/cost-abuse implications, since cost/abuse controls are
  plan 112-03's assigned dimension — noted as a pointer only.
- Did not re-score `SEC-ISO-01`, `SEC-ISO-02`, or `SEC-ISO-04` from 112-01 even though this session's
  independent reading of `orgProvisioning.ts`/`superAdminClaims.ts`/`orgMembershipClaims.ts`
  corroborated them — added cross-reference notes instead, per the phase's disjoint-findings-file
  convention (each dimension's assessment is authoritative in its own file).

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were met without requiring
any Rule 1-4 deviation (no bugs found requiring an inline fix, no missing critical functionality to
add, no blocking issue, no architectural-change question) — this is a review-only plan that changes no
code, so the deviation-rules machinery for code fixes does not apply; findings are the deliverable.

## Issues Encountered
None. The one notable discovery — that ARCH-005's "undeployed" premise was stale — was resolved within
the plan's own scope (a read-only `firebase functions:list` check) without needing escalation or a
plan change.

## User Setup Required
None - no external service configuration required. This plan changed no code and deployed nothing.

## Next Phase Readiness
- `112-FINDINGS-auth-functions.md` is ready for Plan 04's consolidation into
  `112-SECURITY-REVIEW.md`, alongside 112-01's `112-FINDINGS-rules-isolation.md` and (pending)
  112-03's `112-FINDINGS-share-cost.md`.
- Phase 113's remediation scope from this file: no Critical/High items originate here. `SEC-A-01`
  (Medium) and `ARCH-018` (Medium) are candidates for Phase 113's Medium/Low backlog triage per the
  CONTEXT-locked severity rubric (Critical/High → Phase 113; Medium/Low → backlog).
- `ARCH-005`'s resolution (Low, confirmed deployed + sound) should be carried into Plan 04's
  consolidated report so the corrected, evidence-backed deploy state supersedes Phase 110's stale note
  in any future reference to it.

---
*Phase: 112-security-review*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: .planning/phases/112-security-review/112-FINDINGS-auth-functions.md
- FOUND: .planning/phases/112-security-review/112-02-SUMMARY.md
- FOUND: 57c21875 (commit exists in git log)
