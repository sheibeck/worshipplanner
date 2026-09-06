---
phase: 125-passwordless-magic-link-access-scoped-read-isolation
plan: 01
subsystem: auth
tags: [firestore-rules, security, tdd, rules-unit-testing, magic-link]

# Dependency graph
requires: []
provides:
  - "organizations/{orgId}/rehearseAccess/{serviceId} Firestore collection contract (doc shape: serviceId, orgId, serviceDate, title, status, assignedEmailsLower[], songs[], updatedAt)"
  - "firestore.rules rehearseAccess read/write rule enforcing R377 at the data layer"
  - "R377 emulator ALLOW/DENY proof suite (src/rules.test.ts) — 9 cases, all green"
affects: [125-02, 125-03, 125-04, "Phase 126 (My Schedule)", "Phase 127 (Rehearse UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Email-claim Firestore rule (request.auth.token.email.lower() in resource.data.get('field', [])) for a non-member authenticated identity — mirrors the existing invites/{email} idiom"
    - "Live parent-status re-check via a same-service sibling get()/exists() inside a rule function (parentIsPlanned()) — not a snapshot flag"
    - "Editor-writable, member/assigned-volunteer-readable collection sibling to services/{docId}, doc id == serviceId"

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts

key-decisions:
  - "rehearseAccess lives directly under organizations/{orgId} (sibling to services/{docId}), doc id == serviceId — not nested under services/{docId} — so the rule can resolve orgId and serviceId purely from the path with no client field trusted."
  - "parentIsPlanned() performs a same-service Firestore get() on the sibling services doc on every read (not a one-time snapshot check) — this is explicitly NOT the forbidden cross-service storage.rules -> firestore.exists() pattern; same-service get()/exists() is already used by isOrgMember/isOrgEditor/slideGroups' parentDraft() in this exact file."
  - "rehearseAccess added to the org-scoped catch-all's write exclusion list for accounting consistency (Pitfall 4), even though the explicit block already grants isOrgEditor write and the effective permission is unchanged."
  - "Editor write to rehearseAccess is a deliberate, documented trust decision: an editor forging another volunteer's assignedEmailsLower entry is within that editor's EXISTING in-org trust boundary, not an R377 violation."
  - "Fixed a test-fixture bug found during Task 2 verification: the plan's literal cross-org DENY fixture (orgB assigned to the SAME email as orgA) cannot produce a DENY under a correct rule, because a volunteer genuinely assigned in two orgs with the same email is legitimately grantable in both — reseeded orgB with a different assignee so the case actually proves path-scoped isolation."

patterns-established:
  - "Any future org-scoped, non-membership-gated Firestore collection should follow the rehearseAccess shape: sibling to services/{docId}, path-derived scoping only, live re-check of any trust-relevant parent state via get(), and an explicit catch-all exclusion decision recorded in a rules comment."

requirements-completed: [R377]

coverage:
  - id: D1
    description: "firestore.rules rehearseAccess match block: parentIsPlanned() live re-check + email-claim read arm (assignedEmailsLower) + isOrgMember read + isOrgEditor write, catch-all exclusion added"
    requirement: "R377"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#Volunteer magic-link scoped read access — R377 (9 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "R377 emulator ALLOW/DENY proof suite covering assigned+Planned ALLOW, cross-org DENY, Draft DENY, Reopened-to-draft DENY (live re-check), not-assigned DENY, direct services/{id} bypass DENY, rehearseAccess write DENY, unfiltered list() enumeration DENY, and org-member positive-control ALLOW"
    requirement: "R377"
    verification:
      - kind: integration
        ref: "npm run test:rules (259/259 pass, self-contained emulator)"
        status: pass
      - kind: integration
        ref: "npx vitest run (baseline unchanged: only src/storage.rules.test.ts fails, Storage-emulator-dependent, unrelated to this plan)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-06
status: complete
---

# Phase 125 Plan 01: R377 Scoped-Read Isolation (Data-Layer Security Gate) Summary

**Firestore `rehearseAccess` collection + rules block enforcing magic-link-volunteer read isolation (own org, Planned, assigned-only), proven by a 9-case emulator ALLOW/DENY suite authored TDD-RED-then-GREEN.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-05T23:31Z (post plan-commit)
- **Completed:** 2026-09-05T23:49Z
- **Tasks:** 2/2
- **Files modified:** 2 (`firestore.rules`, `src/rules.test.ts`)

## Accomplishments
- Authored the R377 `describe('Volunteer magic-link scoped read access — R377')` block in `src/rules.test.ts` BEFORE the rule existed — proved the intended TDD RED state (7 DENY cases green, 2 ALLOW cases red against the pre-Task-2 rules file, both failing at the org-scoped catch-all with no dedicated block).
- Added the `organizations/{orgId}/rehearseAccess/{serviceId}` match block to `firestore.rules`, sibling to `services/{docId}`, with a `parentIsPlanned()` live-status re-check, an email-claim volunteer read arm (`request.auth.token.email.lower() in resource.data.get('assignedEmailsLower', [])`), an `isOrgMember(orgId)` member/editor read arm, and `allow write: if isOrgEditor(orgId)`.
- Added `rehearseAccess` to the org-scoped catch-all's write exclusion list, documenting the "four LOAD-BEARING exclusions" decision explicitly.
- All 9 R377 emulator cases pass GREEN. `npm run test:rules`: 259/259 pass (self-contained, own emulator). `npx vitest run`: baseline unchanged — only `src/storage.rules.test.ts` fails (documented Storage-emulator limitation, unrelated to this plan). No change to `storage.rules`.

## Task Commits

Each task was committed atomically:

1. **Task 1: R377 Firestore-emulator ALLOW/DENY test suite (the security gate)** - `7e0c423a` (test) — TDD RED: 7/9 pass, 2 ALLOW cases red pending the rule.
2. **Task 2: rehearseAccess firestore.rules block + catch-all exclusion (makes the gate green)** - `82f5a59b` (feat) — TDD GREEN: 9/9 pass; also carries the test-fixture bug fix for case (2) found while verifying.

**Plan metadata:** (this commit, following SUMMARY.md write)

_Note: this is a plan-level TDD gate (`type: execute`, task 1 is RED, task 2 is GREEN) — not a per-task `tdd="true"` task, but the same red-then-green discipline was followed and is verifiable in the git log order above._

## Files Created/Modified
- `firestore.rules` - Added `rehearseAccess/{serviceId}` match block (parentIsPlanned(), email-claim read, isOrgEditor write) under `organizations/{orgId}`; added `rehearseAccess` to the catch-all's write exclusion list.
- `src/rules.test.ts` - Added `describe('Volunteer magic-link scoped read access — R377')` with 9 ALLOW/DENY cases and a `seedRehearseFixtures()` helper (4 services across 2 orgs: Planned+assigned, Draft, Reopened-to-draft-with-stale-projection, cross-org).

## Decisions Made
- `rehearseAccess` is a top-level sibling collection under `organizations/{orgId}` (doc id == serviceId), not nested under `services/{docId}` — matches RESEARCH.md Pattern 3 and lets the rule derive both `orgId` and `serviceId` from the path alone.
- `parentIsPlanned()`'s same-service `get()`/`exists()` on the sibling `services/{serviceId}` doc is safe and required for correctness (re-checks LIVE status, closing the "Reopen leaves a stale grant" gap) — explicitly not the forbidden cross-*service* `storage.rules` → `firestore.exists()` pattern banned by CLAUDE.md.
- Editor write to `rehearseAccess` is accepted as within an editor's existing in-org trust boundary (documented in a rule comment), not a new escalation surface requiring a Cloud Function.
- Added `rehearseAccess` to the catch-all's write exclusion for accounting consistency with the other three LOAD-BEARING exclusions, even though the effective permission is unchanged (the explicit block already grants the same `isOrgEditor` write).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a self-contradictory test fixture for the cross-org DENY case**
- **Found during:** Task 2 (`npm run test:rules` verification pass)
- **Issue:** Task 1's fixture (following the plan's literal fixture description) seeded `orgB/rehearseAccess/svcB.assignedEmailsLower` with the SAME email (`dana@example.com`) as `orgA/rehearseAccess/svc1`. Once the correct rule was in place, this made case (2) ("DENY volunteer reads orgB/rehearseAccess/svcB — cross-org") fail as an ALLOW, because the volunteer genuinely IS assigned in orgB per that fixture data — a correct rule grants that read; per-document array membership, not "which org did this volunteer come from," is the actual security boundary (T-125-01's real property: "an attacker's own valid token can never satisfy ANOTHER org's array" — i.e. one they are not actually listed in).
- **Fix:** Reseeded `orgB/rehearseAccess/svcB.assignedEmailsLower` with a different assignee (`other-org-volunteer@example.com`) so the volunteer is genuinely NOT listed there, making the DENY assertion correctly prove path-scoped cross-org isolation rather than accidentally testing a scenario where ALLOW is the correct outcome.
- **Files modified:** `src/rules.test.ts`
- **Verification:** `npx vitest run --config vitest.rules.config.ts -t "R377"` — all 9 cases pass; full `npm run test:rules` — 259/259 pass.
- **Committed in:** `82f5a59b` (Task 2 commit, alongside the rule)

---

**Total deviations:** 1 auto-fixed (1 bug fix in test fixture data)
**Impact on plan:** No scope creep — the rule matches the plan/patterns exactly; only the test's own seed data needed correction to make the DENY assertion actually test what it claimed to test.

## Issues Encountered
- `npm run test:rules` initially failed with "port taken" (a stale, orphaned Firestore-emulator Java process from a prior interrupted run was still bound to 127.0.0.1:8080). Per CLAUDE.md guidance for this exact situation, ran `npx vitest run --config vitest.rules.config.ts` directly against the already-running Firestore emulator to prove all 9 R377 cases green first, then killed the orphaned process and confirmed the full self-contained `npm run test:rules` (259/259) and `npx vitest run` (baseline unchanged) both pass cleanly.

## User Setup Required
None - no external service configuration required (this plan touches only `firestore.rules` and its test suite; the Firebase console email-link provider / authorized-domain prerequisites belong to a later plan in this phase, per 125-RESEARCH.md).

## Next Phase Readiness
- The `organizations/{orgId}/rehearseAccess/{serviceId}` collection contract (doc shape, rule, and its 9-case proof suite) is now the authoritative, tested boundary for every downstream volunteer read surface.
- Plan 02 (the projection builder + editor-side lock-time write) can now write against a rule that is already proven correct — no further rules changes should be needed for the read/write shape established here.
- Plans 03/04 (client auth flow, router separation) build UI/session layers on top of this data-layer guarantee; router-level exemptions remain explicitly defense-in-depth, not the enforced boundary.
- No blockers. `storage.rules` is untouched and confirmed unchanged (git diff empty for that file across both task commits).

---
*Phase: 125-passwordless-magic-link-access-scoped-read-isolation*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: firestore.rules
- FOUND: src/rules.test.ts
- FOUND: .planning/phases/125-passwordless-magic-link-access-scoped-read-isolation/125-01-SUMMARY.md
- FOUND commit: 7e0c423a
- FOUND commit: 82f5a59b
