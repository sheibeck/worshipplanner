---
phase: 80-security-data-integrity-hardening
plan: 01
subsystem: database
tags: [firestore-rules, security-rules, authorization, immutability, emulator-tests]

# Dependency graph
requires: []
provides:
  - "inviteLookup create gated to isOrgEditor(request.resource.data.orgId) — closes the self-invite privilege-forgery vector (R232)"
  - "organizations/{orgId} createdBy immutable on update via a new preservesCreatedBy() sibling helper (R233)"
  - "Undeployed-rules deploy hand-over recorded in .planning/PENDING-VERIFICATION.md"
affects: [80-02, 80-03, future-phases-touching-firestore.rules]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling diff().affectedKeys() immutability helper, scoped to update-only, kept separate from a shared create/update field-presence array"
    - "Org-scoped create-gate mirroring: isOrgEditor(request.resource.data.orgId) reused verbatim from orgSlugs/orgNames"

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "preservesCreatedBy() is a NEW sibling helper, not folded into lifecycleFields()'s array — that array is also consulted on CREATE to assert absence, but createdBy is required on create; folding would deny every legitimate org-create."
  - "Two pre-existing rules-suite regressions ('allows editor to write org doc' and 'editor can write to org doc (update name)') used a full-overwrite setDoc with no merge, which drops createdBy from the payload — now correctly DENIED by the new guard. Both switched to updateDoc (ordinary partial edit), documented inline as a deliberate, necessary adjustment, not a scope reduction."
  - "Rules ship BUILT + TESTED + UNDEPLOYED per the standing v1.5+ deploy discipline; exact firebase deploy --only firestore:rules hand-over recorded in PENDING-VERIFICATION.md."

patterns-established:
  - "When adding a diff().affectedKeys() immutability guard, always check the FULL rules suite (not just -t-scoped test names) for other full-overwrite setDoc tests on the same doc that would newly trip the guard — this plan found one instance in-scope (from the plan) and one out-of-scope (caught only by the full-suite run)."

requirements-completed: [R232, R233]

coverage:
  - id: D1
    description: "inviteLookup create is gated to isOrgEditor(request.resource.data.orgId): ALLOW for the target-org editor, DENY for a non-editor, DENY for a mismatched-orgId payload (the self-invite-forgery case)"
    requirement: R232
    verification:
      - kind: integration
        ref: "src/rules.test.ts#inviteLookup create — R232 target-org-editor gate"
        status: pass
    human_judgment: false
  - id: D2
    description: "The invite -> first-login acceptance flow (real writeBatch: delete inviteLookup, delete invite, create member) still succeeds under the new create rule — re-confirmed, not assumed"
    requirement: R232
    verification:
      - kind: integration
        ref: "src/rules.test.ts#Members create — R104 self-service membership hole (Test B/D)"
        status: pass
    human_judgment: false
  - id: D3
    description: "organizations/{orgId} createdBy cannot be changed via updateDoc by an editor (DENY); an ordinary edit leaving createdBy unchanged still succeeds (ALLOW)"
    requirement: R233
    verification:
      - kind: integration
        ref: "src/rules.test.ts#Editor vs viewer write permissions (DENIES an editor changing createdBy via updateDoc / ALLOWS an editor to make an ordinary edit that leaves createdBy unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full rules-suite regression: 218/218 green (192 rules.test.ts + 26 storage.rules.test.ts), incl. both pre-existing org-write regressions adjusted for the new immutability guard, and founder-creates-own-org (Test C)"
    verification:
      - kind: integration
        ref: "npx vitest run --config vitest.rules.config.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Type gate clean (vue-tsc --build) and full app suite at the documented 2-file known-failing baseline, no new regressions"
    verification:
      - kind: unit
        ref: "npm run type-check"
        status: pass
      - kind: unit
        ref: "npx vitest run (4148 passed, 26 failed across exactly storage.rules.test.ts + RosterView.test.ts)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Rules ship UNDEPLOYED; the exact firebase deploy --only firestore:rules hand-over is recorded for the owner"
    requirement: R232, R233
    verification: []
    human_judgment: true
    rationale: "Deploying and confirming production behavior requires the owner to run firebase deploy and perform a live-session check — no automated test can do this safely from within the plan."

duration: 22min
completed: 2026-08-24
status: complete
---

# Phase 80 Plan 01: firestore.rules Hardening (R232 inviteLookup create gate + R233 createdBy immutability) Summary

**Closed two server-side Firestore rules gaps — the inviteLookup self-invite privilege-forgery vector and the mutable org createdBy provenance field — both mirroring idioms already live in the same rules file, shipped BUILT + TESTED + UNDEPLOYED.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-24T04:45:58Z
- **Completed:** 2026-08-24T05:07:33Z
- **Tasks:** 3 completed
- **Files modified:** 3 (`firestore.rules`, `src/rules.test.ts`, `.planning/PENDING-VERIFICATION.md`)

## Accomplishments
- R232: `inviteLookup/{email}`'s `allow create` now requires `isOrgEditor(request.resource.data.orgId)`, closing the self-invite privilege-forgery vector; `allow read`/`allow delete` untouched, no client code change.
- R233: added a new sibling `preservesCreatedBy()` helper (the `diff().affectedKeys()` idiom, scoped to update-only) and composed it into `organizations/{orgId}`'s `allow update`, making `createdBy` immutable after creation without disturbing the `allow create` requirement or the existing `preservesLifecycleFields()` guard.
- Added 5 new emulator ALLOW/DENY test cases (3 for R232, 2 for R233), re-confirmed the invite→first-login acceptance regressions (Test B/D) and founder-creates-own-org (Test C) all stay green, and found + fixed a SECOND pre-existing regression the plan hadn't explicitly named (a duplicate full-overwrite `setDoc` in a different describe block) via the full rules-suite run.
- Recorded the exact `firebase deploy --only firestore:rules` hand-over in `.planning/PENDING-VERIFICATION.md`, including which behaviors go live only post-deploy and the two owner-side manual verifications.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate inviteLookup create to the target-org editor (R232)** - `04dba036` (feat)
2. **Task 2: Make org createdBy immutable on update (R233)** - `da94ac16` (feat)
3. **Task 3: Record the undeployed rules deploy hand-over** - `45f85071` (docs)
4. **Deviation fix: second createdBy-dropping regression (Editor/Viewer RBAC block)** - `7969593c` (fix)

## Files Created/Modified
- `firestore.rules` - `inviteLookup` create clause gated to the target-org editor (R232); new `preservesCreatedBy()` sibling helper composed into `organizations/{orgId}`'s `allow update` (R233)
- `src/rules.test.ts` - new `describe('inviteLookup create — R232 target-org-editor gate')` block (3 cases); new createdBy DENY/ALLOW cases in `describe('Editor vs viewer write permissions')`; two pre-existing full-overwrite `setDoc` regressions (one named by the plan, one found via the full-suite run) switched to `updateDoc`
- `.planning/PENDING-VERIFICATION.md` - new Phase 80 entry with the exact `firebase deploy --only firestore:rules` command, post-deploy-only behaviors, and the two manual verifications; C2's "still open" R232/R233 findings marked FIXED and cross-referenced

## Decisions Made
- `preservesCreatedBy()` is a dedicated sibling helper, not folded into `lifecycleFields()`'s shared array — that array is also read on CREATE to assert those keys are ABSENT, while `createdBy` is REQUIRED on create; a shared list would deny every legitimate org-create (80-RESEARCH.md Pitfall 2, avoided as designed).
- Both createdBy-dropping full-overwrite `setDoc` regressions were switched to `updateDoc` rather than adding `createdBy` back into their payloads — `updateDoc` is the representative real-app path (TeamView/Settings edits are partial updates), so this keeps the tests proving what they're meant to prove (an ordinary edit succeeds) rather than merely appeasing the new guard.
- No client code changes were made or needed for R232 — `TeamView.vue`'s `onInvite()` already writes `orgId` onto the `inviteLookup` payload in the same batch as the invite doc.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a second, plan-unnamed createdBy-dropping regression**
- **Found during:** Task 2 verification (full rules-suite run, not the `-t`-scoped quick check)
- **Issue:** `src/rules.test.ts`'s `describe('Editor/Viewer RBAC')` block contains `it('editor can write to org doc (update name)')`, a second instance of the same full-overwrite `setDoc` pattern the plan explicitly flagged for the sibling `'allows editor to write org doc'` test in `describe('Editor vs viewer write permissions')`. The plan's instructions named only one instance; this one was structurally identical and newly failed once R233's `preservesCreatedBy()` guard went live, because the setDoc payload omits `createdBy`.
- **Fix:** Switched the test from `setDoc` to `updateDoc`, matching the fix already applied to its sibling — an ordinary partial edit that leaves `createdBy` unchanged.
- **Files modified:** `src/rules.test.ts`
- **Verification:** Full rules suite re-run: 218/218 green (192 `rules.test.ts` + 26 `storage.rules.test.ts`); `npm run type-check` clean.
- **Committed in:** `7969593c`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/regression)
**Impact on plan:** Necessary for correctness under the new immutability guard; no scope creep — this is the exact class of adjustment the plan anticipated for its named sibling test, just a second instance the plan's task-level verify command (`-t "createdBy|write org doc"`) didn't happen to match by name.

## Issues Encountered
None beyond the deviation above. The Firestore emulator was already running locally (port 8080) throughout this plan, so all rules-suite runs used `npx vitest run --config vitest.rules.config.ts` directly against it rather than `npm run test:rules` (which starts its own emulator and would have hit "port taken").

## User Setup Required

**External services require manual configuration.** No `.env.local` or secret changes. The rules change itself requires an owner-run deploy — see `.planning/PENDING-VERIFICATION.md`'s new "Phase 80" entry for the full hand-over. In short:

```
firebase deploy --only firestore:rules
```

Both the R232 self-invite create gate and the R233 createdBy immutability guard are enforced in production **only** after this command runs. Post-deploy, the owner should confirm:
1. A forged `inviteLookup` create as a signed-in non-editor of the target org is denied.
2. An editor's attempt to rewrite an org's `createdBy` via a direct client write is denied.

## Next Phase Readiness
`firestore.rules` and `src/rules.test.ts` are in a clean, fully-green state (218/218) for Plans 80-02/80-03, which are client-only and do not touch this file. No blockers.

---
*Phase: 80-security-data-integrity-hardening*
*Completed: 2026-08-24*

## Self-Check: PASSED

All claimed files exist (`firestore.rules`, `src/rules.test.ts`, `.planning/PENDING-VERIFICATION.md`, this SUMMARY) and all 4 commit hashes (`04dba036`, `da94ac16`, `45f85071`, `7969593c`) are present in git history.
