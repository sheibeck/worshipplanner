---
phase: 133-volunteer-responsibility-confirmation
plan: 01
subsystem: security
tags: [firestore-rules, firestore, security-rules, rules-emulator, pure-utils, rehearseAccess]

requires:
  - phase: 125-rehearse-mode-security-core
    provides: the rehearseAccess projection + parentIsPlanned()/exists()-guarded-sibling-get() rule idiom this plan's confirmations rule reuses verbatim
provides:
  - "src/utils/confirmations.ts — ConfirmationStatus/ConfirmationDoc types, confirmationKey(), computeValidConfirmationKeys() (the R412 valid-key backbone)"
  - "roleIdsByEmailLower + roleAssignmentsByEmailLower on RehearseAccessDoc/buildRehearseAccess"
  - "organizations/{orgId}/services/{serviceId}/confirmations/{roleId}_{emailLower} write rule in firestore.rules"
  - "12 ALLOW/DENY rules tests proving the write rule fails closed on every enumerated attack vector"
affects: [133-02, 133-03, 133-04, 133-05]

tech-stack:
  added: []
  patterns:
    - "subcollection-per-actor rule block nested under services/{docId} (mirrors messages/lockSnapshots) — never extend the parent doc's lock-gated update rule for a new class of writer"
    - "exists()-guarded-FIRST sibling get() on a projection doc, reused verbatim from rehearseAccess's parentIsPlanned()"
    - "flat Record<emailLower,string[]> rules-check field paired with a Record<emailLower,{roleId,roleName}[]> client-render field, built in the same loop"

key-files:
  created:
    - src/utils/confirmations.ts
    - src/utils/__tests__/confirmations.test.ts
  modified:
    - src/utils/rehearseAccess.ts
    - src/utils/rehearseAccess.test.ts
    - firestore.rules
    - src/rules.test.ts

key-decisions:
  - "confirmations is its own subcollection nested under services/{docId} (like messages/lockSnapshots), NOT a field on the locked rehearseAccess doc or on services/{serviceId} itself — adds zero new arms to the single most security-sensitive rule in the schema"
  - "identity key is roleId+emailLower (never personId) — mirrors rehearseAccess's own PII-safe, email-keyed volunteer identity boundary"
  - "roleIdsByEmailLower/roleAssignmentsByEmailLower marked optional on RehearseAccessDoc (additive-only schema growth, absent on pre-Phase-133 docs until relocked) rather than required, to avoid breaking 4 unrelated test fixtures that construct RehearseAccessDoc literals directly"
  - "volunteer create/update arm pins status to 'confirmed' only; 'needsReconfirmation' is editor-arm-only (relock reconciliation), proven by test 10"

patterns-established:
  - "New volunteer-writable subcollections under services/{docId} get their own match block reusing isAssignedVolunteer()-style helpers scoped to email+role identity — never inherit a sibling projection's editor-only write arm"

requirements-completed: [R410, R412]

coverage:
  - id: D1
    description: "confirmations.ts pure model (ConfirmationStatus, ConfirmationDoc, confirmationKey, computeValidConfirmationKeys) + rehearseAccess roleIdsByEmailLower/roleAssignmentsByEmailLower projection fields"
    requirement: R412
    verification:
      - kind: unit
        ref: "src/utils/__tests__/confirmations.test.ts (6 tests)"
        status: pass
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts (23 tests, incl. 2 new Phase 133 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "confirmations subcollection write rule in firestore.rules — volunteer scoped create/update/delete, editor unrestricted, zero new surface on services/{docId}"
    requirement: R410
    verification:
      - kind: integration
        ref: "src/rules.test.ts — describe('Volunteer confirmation scoped write — R410') (12 tests, via `npm run test:rules`)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-09-07
status: complete
---

# Phase 133 Plan 01: Confirmation Security Foundation Summary

**New `confirmations` Firestore subcollection + scoped volunteer write rule, keyed on `roleId_emailLower` and checked against a new `roleIdsByEmailLower` sibling projection field — proven by 12 ALLOW/DENY rules tests.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-07T12:41Z
- **Completed:** 2026-09-07T12:56Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `src/utils/confirmations.ts`: the pure data model every downstream Phase 133 plan imports — `ConfirmationStatus`, `ConfirmationDoc`, `confirmationKey()`, and `computeValidConfirmationKeys()` (the exact valid-key set a relock reconciliation diffs stored `'confirmed'` docs against, per R412).
- `RehearseAccessDoc`/`buildRehearseAccess` gained `roleIdsByEmailLower` (the RULES-check field, flat `Record<emailLower, roleId[]>`) and `roleAssignmentsByEmailLower` (the CLIENT-render field, `Record<emailLower, {roleId,roleName}[]>`), built inside the same assignment loop that already builds `rolesByEmailLower`, with identical empty-email-skip/lowercase-key discipline.
- A new `confirmations/{roleId}_{emailLower}` match block in `firestore.rules`, nested under `services/{docId}` exactly like `messages`/`lockSnapshots`: volunteer create/update requires own-email, own-roleId (checked via a sibling `get()` on `rehearseAccess`, exists()-guarded first), doc-id/field-shape match, and `status == 'confirmed'`; org-editor arm is unrestricted (the relock-reconciliation path); delete is a caller-owns-the-doc-only un-confirm.
- 12 new ALLOW/DENY tests in `src/rules.test.ts` proving self-escalation, role-forgery, cross-service, cross-tenant, Draft-parent, parent-doc-mutation, and unverified-email writes all DENY, while assigned-volunteer confirm/un-confirm and org-editor reconciliation writes/reads ALLOW.

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirmation pure model + rehearseAccess projection fields** - `18e77d2b` (feat)
2. **Task 2: confirmations subcollection rule in firestore.rules** - `344d204d` (feat)
3. **Task 3: 12 ALLOW/DENY rules tests for confirmations** - `c7c1a0d9` (test)
4. **Deviation fix: optional projection fields (type-check)** - `4351d0f5` (fix)

**Plan metadata:** committed as part of this SUMMARY (see below).

## Files Created/Modified
- `src/utils/confirmations.ts` - pure model: `ConfirmationStatus`, `ConfirmationDoc`, `confirmationKey()`, `computeValidConfirmationKeys()`
- `src/utils/__tests__/confirmations.test.ts` - unit coverage for both pure helpers, incl. empty-email skip and an override-changes-the-valid-set case
- `src/utils/rehearseAccess.ts` - `roleIdsByEmailLower`/`roleAssignmentsByEmailLower` added to `RehearseAccessDoc` + `buildRehearseAccess`
- `src/utils/rehearseAccess.test.ts` - 2 new cases (multi-role dedup + empty-email skip) for the new fields, updated the "schema fields only" key-list assertion
- `firestore.rules` - new `confirmations/{confirmationId}` match block nested under `services/{docId}`
- `src/rules.test.ts` - new `describe('Volunteer confirmation scoped write — R410')` block, 12 tests

## Decisions Made
- Confirmations live in their own subcollection under `services/{docId}` (not on `rehearseAccess`, not on `services/{serviceId}` itself) — per 133-RESEARCH.md's analysis, both alternatives would either get silently erased on every relock (`rehearseAccess`'s full-document `setDoc`) or require a fourth arm on the schema's single most security-sensitive `update` rule.
- Identity is `roleId + emailLower`, never `personId` — mirrors the existing PII-safe volunteer-identity boundary `rehearseAccess.assignedEmailsLower`/`rolesByEmailLower` already established.
- `roleIdsByEmailLower`/`roleAssignmentsByEmailLower` are optional fields on `RehearseAccessDoc` (see Deviations) — additive-only schema growth, matching this codebase's established no-migration convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made `roleIdsByEmailLower`/`roleAssignmentsByEmailLower` optional on `RehearseAccessDoc`**
- **Found during:** Post-Task-3 verification (`npm run type-check`)
- **Issue:** The plan's task action described the two new fields without an explicit `?`, and I initially added them as required. `vue-tsc --build` then failed on 4 UNRELATED test files (`src/utils/myScheduleGrouping.test.ts`, `src/composables/__tests__/useVolunteerServiceDoc.test.ts`, `src/views/__tests__/MyScheduleView.test.ts`, `src/views/__tests__/VolunteerServiceView.test.ts`) that construct `RehearseAccessDoc` fixtures directly, none of which are in this plan's `files_modified` list.
- **Fix:** Marked both fields optional (`roleIdsByEmailLower?:`, `roleAssignmentsByEmailLower?:`) on `RehearseAccessDoc`. This is explicitly licensed by 133-RESEARCH.md's own "Runtime State Inventory" section: "Every new field ... is additive-optional, matching this codebase's established no-migration convention for schema growth." `buildRehearseAccess` still always populates both fields; only the TYPE now permits legacy/hand-built fixtures to omit them.
- **Files modified:** `src/utils/rehearseAccess.ts`
- **Verification:** `npm run type-check` clean; `npx vitest run src/utils/__tests__/confirmations.test.ts src/utils/rehearseAccess.test.ts` still green (29/29)
- **Committed in:** `4351d0f5`

---

**Total deviations:** 1 auto-fixed (1 bug/type-check fix)
**Impact on plan:** Scoped entirely to the type declaration in this plan's own `rehearseAccess.ts` file; no unrelated test fixtures were touched. No scope creep.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Verification Run

- `npx vitest run src/utils/__tests__/confirmations.test.ts src/utils/rehearseAccess.test.ts` — 2 files, 29 tests, all pass
- `npm run test:rules` (own emulator, no conflict detected on port 8080) — 2 files, **283 tests, all pass**, including all 12 new `Volunteer confirmation scoped write — R410` cases
- `npm run type-check` (`vue-tsc --build`, per CLAUDE.md — not the narrower `-p tsconfig.app.json` form) — clean, zero errors
- `npx vitest run` (full app suite, no `--dir`) — 214 files, **5540 passed / 35 skipped**, exactly the documented baseline: only `src/storage.rules.test.ts` fails (Storage-emulator `firestore.exists()` cross-service limitation, CLAUDE.md-documented, not a regression)

## Next Phase Readiness
- `confirmations.ts`'s exported names/shapes (`ConfirmationDoc`, `confirmationKey`, `computeValidConfirmationKeys`) and the two new `RehearseAccessDoc` projection fields are the exact vocabulary Plans 133-02 through 133-05 (the "I've got it" UI, planner live status, relock reconciliation, and R413 messaging filter) depend on.
- The firestore.rules write rule and its 12 tests are the security gate every subsequent plan's client write path must satisfy — no further rules changes anticipated for R410/R412 in this phase.
- No blockers identified for Plan 02.

## Self-Check: PASSED

All 7 claimed files found on disk; all 4 claimed commit hashes found in git log.

---
*Phase: 133-volunteer-responsibility-confirmation*
*Completed: 2026-09-07*
