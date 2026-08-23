---
phase: 78-super-admin-enter-any-church
plan: 01
subsystem: auth
tags: [firestore-rules, storage-rules, security, super-admin, custom-claims]

# Dependency graph
requires:
  - phase: 76-org-lifecycle-deactivation
    provides: isOrgActive() lifecycle gate + preservesLifecycleFields() guard, and the narrow (membership-gated) isSuperAdmin() OR-exemptions this phase generalizes
  - phase: 77-org-deletion
    provides: the unconditional `allow delete: if false;` on organizations/{orgId} that this phase confirms stays untouched
  - phase: 68-super-admin-claim
    provides: the isSuperAdmin() / request.auth.token.superAdmin claim-only gate (Firestore) and the superAdmin token claim (Storage) this phase composes into isOrgMember/isOrgEditor/isOrgMemberByClaim
provides:
  - "A super-admin with NO membership document can read and write any organization's Firestore content, including a deactivated org"
  - "A super-admin with NO membership claim can read and write any organization's Storage objects, including a deactivated org"
  - "Lifecycle fields (active/deactivatedAt/deactivatedBy/reactivatedAt/reactivatedBy) on organizations/{orgId} are now Admin-SDK-only for literally every client, super-admins included -- the composition hazard the isOrgEditor widening would otherwise have reopened is closed in the same commit"
affects: [78-02 (client enterOrgAsSuperAdmin/exitSuperAdminView flow), any future phase touching firestore.rules isOrgMember/isOrgEditor or storage.rules isOrgMemberByClaim]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Super-admin OR-arm placed OUTERMOST (in front of the exists()/claim check), not merely into a sub-clause -- replaces the membership requirement entirely rather than waiving one inner condition of it"
    - "When widening a shared helper's OR-composition, audit every OTHER caller with its own narrower `|| isSuperAdmin()` exemption in the same commit -- a caller that was safe because the widened helper used to require genuine membership can become an unconditional bypass once that helper no longer does"

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts
    - storage.rules
    - src/storage.rules.test.ts

key-decisions:
  - "OR isSuperAdmin()/token.superAdmin==true in FRONT of the whole membership check in isOrgMember/isOrgEditor/isOrgMemberByClaim, replacing the exists()/claim requirement entirely for a super-admin rather than waiving only the deactivation sub-clause (Pattern 1/3, 78-RESEARCH.md)"
  - "Deleted the `|| isSuperAdmin()` disjunct from organizations/{orgId}'s allow update lifecycle guard in the SAME commit as the isOrgEditor widening -- landing them separately would have reopened the CR-01/T-76-10 lifecycle-field bypass for the window between commits (Pitfall 2)"
  - "Fixed a Pitfall-2 regression the tightening surfaced in a pre-existing test: 'ALLOWS a super-admin WITH a genuine membership doc to write a deactivated org' used a non-merged setDoc that implicitly stripped the stored `active` field, tripping the newly-tightened guard. Switched to updateDoc (a partial merge) to preserve the test's actual intent (writing a non-lifecycle field to a deactivated org) without incidentally exercising the lifecycle guard."

requirements-completed: [R225]

coverage:
  - id: D1
    description: "A super-admin with no membership doc can read and write any organization's Firestore content (isOrgMember/isOrgEditor super-admin arm)"
    requirement: "R225"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#Super-admin content access without a membership doc (R225, Phase 78)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A super-admin with no membership doc can enter a deactivated org's Firestore content (deactivation exemption extended to no-membership-doc case)"
    requirement: "R225"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#ALLOWS a super-admin with NO membership doc to enter a DEACTIVATED org (Phase 76 exemption extended)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A non-member, non-super-admin caller is denied Firestore org-doc read (R225 negative case) and an ordinary member's access is unaffected"
    requirement: "R225"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#DENIES a non-member, non-super-admin from reading organizations/{orgId} -- R225 negative case"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#DOES NOT REGRESS an ordinary member of that same org"
        status: pass
    human_judgment: false
  - id: D4
    description: "Org-doc lifecycle-guard composition fix: a super-admin's client SDK still cannot write active/deactivatedAt/deactivatedBy/reactivatedAt/reactivatedBy directly (must use setOrgActive)"
    requirement: "R225"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#CRITICAL -- DENIES a super-admin from writing a lifecycle field directly (must use setOrgActive)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase 77's org-doc delete DENY stays absolute for super-admins too -- no regression from the isOrgEditor widening"
    requirement: "R225"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#DENIES a super-admin using the client SDK from deleting organizations/{orgId} -- no exemption (pre-existing, re-run unmodified)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A super-admin with no membership claim can read and write any organization's Storage objects, including on a deactivated org, without any orgId/orgs/role claim entry"
    requirement: "R225"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#Super-admin Storage access without a membership claim (R225, Phase 78)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A non-member, non-super-admin caller with no claims at all is denied Storage access (R225 negative case)"
    requirement: "R225"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#DENIES a non-member, non-super-admin caller (no claims at all) -- R225 negative case"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-08-23
status: complete
---

# Phase 78 Plan 01: Super-Admin Enter-Any-Church — Rules Arm + Lifecycle-Guard Tightening Summary

**OR'd `isSuperAdmin()`/`token.superAdmin` in front of the membership checks in both rules files (not into a sub-clause) so a super-admin can read/write any org with zero membership doc/claim, and closed the resulting lifecycle-field composition hazard in the org-doc `allow update` rule in the same commit.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-23T04:53:44Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (firestore.rules, src/rules.test.ts, storage.rules, src/storage.rules.test.ts)

## Accomplishments

- `isOrgMember(orgId)`/`isOrgEditor(orgId)` (firestore.rules) now grant a super-admin full content read/write on ANY org — including a deactivated one — with zero membership document, by placing `isSuperAdmin()` as the outermost OR arm (short-circuiting the billed `exists()` read for the super-admin path).
- Deleted the `|| isSuperAdmin()` disjunct from `organizations/{orgId}`'s `allow update` rule in the SAME commit as the `isOrgEditor` widening — this is the security-critical composition fix: without it, the widening alone would have turned that disjunct into an unconditional super-admin lifecycle-field bypass (the CR-01/T-76-10 class of bug). `allow update: if isOrgEditor(orgId) && preservesLifecycleFields();` is now unconditional for everyone, super-admins included.
- `isOrgMemberByClaim(orgId)` (storage.rules) mirrors the same shape: `request.auth.token.superAdmin == true` ORed in front of the whole membership-and-deactivation clause, so a super-admin's Storage access no longer requires any `orgId`/`orgs`/`role` claim entry, on any org, active or deactivated.
- `allow delete: if false;` (Phase 77) left byte-for-byte untouched; its existing DENY test re-run unmodified and still passes.
- Post-diff grep of `firestore.rules` for `isSuperAdmin()` surfaces exactly the 4 intended call sites (`isOrgMember`, `isOrgEditor`, `appConfig`, `superAdmins`) with zero on the org-doc `allow update` line, matching the plan's acceptance criterion exactly.
- New R225 emulator describe blocks added to both `src/rules.test.ts` (6 tests) and `src/storage.rules.test.ts` (4 tests), covering ALLOW (no membership doc/claim, including on a deactivated org), DENY (non-member/non-super-admin), regression (ordinary member unaffected), and the CRITICAL lifecycle-field-write DENY.

## Task Commits

Each task was committed atomically:

1. **Task 1: firestore.rules — super-admin content arm (R225) + lifecycle-guard composition fix** - `fbcd8765` (feat)
2. **Task 2: storage.rules — super-admin Storage arm (R225)** - `8f7660aa` (feat)

**Plan metadata:** this SUMMARY commit (docs: complete plan)

## Files Created/Modified

- `firestore.rules` — `isOrgMember`/`isOrgEditor` restructured with the outer `isSuperAdmin()` OR arm; `organizations/{orgId}`'s `allow update` lost its `|| isSuperAdmin()` disjunct
- `src/rules.test.ts` — new `describe('Super-admin content access without a membership doc (R225, Phase 78)', ...)` block (6 tests); one pre-existing test (`ALLOWS a super-admin WITH a genuine membership doc to write a deactivated org`) fixed to use `updateDoc` instead of `setDoc` (see Deviations)
- `storage.rules` — `isOrgMemberByClaim` restructured with the outer `superAdmin` claim OR arm around the whole membership-and-deactivation clause
- `src/storage.rules.test.ts` — new `describe('Super-admin Storage access without a membership claim (R225, Phase 78)', ...)` block (4 tests)

## Decisions Made

- The super-admin arm is placed OUTERMOST in both files (Pattern 1/3), replacing the membership requirement entirely for a super-admin, not merely waiving the deactivation sub-clause — this is what makes "zero membership doc/claim" access possible and is R225's explicit requirement.
- The org-doc lifecycle-guard's `|| isSuperAdmin()` disjunct was deleted, not preserved, in the same commit as the widening (Pitfall 2) — landing these as separate commits would have left a real, exploitable window where any super-admin could client-write `active`/`deactivatedAt`/`deactivatedBy`/`reactivatedAt`/`reactivatedBy` directly, bypassing `setOrgActive`'s claim fan-out and `revokeRefreshTokens`.
- `isOrgActive(orgId)`'s own body was left completely untouched (per plan) — it carries no super-admin awareness by design; the super-admin arm lives one level up in its callers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a Pitfall-2 regression in a pre-existing Phase 76 test surfaced by the lifecycle-guard tightening**
- **Found during:** Task 1 verification (full `src/rules.test.ts` suite run after the rules diff)
- **Issue:** `isOrgActive — deactivation gate (R213, Phase 76)`'s `'ALLOWS a super-admin WITH a genuine membership doc to write a deactivated org'` test used a non-merged `setDoc(doc(db, 'organizations', 'orgA'), { name: '...', updatedAt: ... })`, which fully REPLACES the document — implicitly stripping the previously-stored `active: false` field (it's absent from the replacement payload). Before this plan's tightening, the org-doc `allow update` rule's `|| isSuperAdmin()` disjunct masked this: any super-admin write passed regardless of lifecycle-field changes. Once that disjunct was correctly deleted (the plan's own security-critical requirement), this test's incidental `active`-field-stripping tripped `preservesLifecycleFields()`'s diff check and the test started failing with `PERMISSION_DENIED`.
- **Fix:** Changed `setDoc` to `updateDoc` in that one test. `updateDoc` performs a partial merge, so the stored `active: false` field is left untouched and only `name`/`updatedAt` are diffed — preserving the test's actual intent (proving a super-admin can write a non-lifecycle field to a deactivated org via the `isOrgActive()` bypass) without incidentally exercising the lifecycle guard the test was never meant to probe.
- **Files modified:** `src/rules.test.ts`
- **Verification:** Full `src/rules.test.ts` suite (187 tests) passes after the fix; re-ran the full suite twice more (once after Task 2, once combined with `src/storage.rules.test.ts`) with all 213 tests green.
- **Committed in:** `fbcd8765` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary correctness fix directly caused by the plan's own required security tightening (exactly the Pitfall 2 hazard the plan's own threat model named in advance). No scope creep — the fix touches only the one test's write call, not the rule or its intent.

## Issues Encountered

None beyond the deviation above.

## Gate Results

1. **`npm run type-check`** (`vue-tsc --build`) — clean, no errors.
2. **Rules-emulator suite** (`npx vitest run --config vitest.rules.config.ts` against the already-running emulator, port-taken confirmed the emulator was up):
   - `src/rules.test.ts`: **187/187 passed** (includes all 6 new R225 tests + the existing lifecycle-guard tests (T-76-10/T-76-06) + the existing Phase 77 delete-DENY tests — all re-run unmodified and still passing).
   - `src/storage.rules.test.ts`: **26/26 passed** (includes all 4 new R225 tests; the two pre-existing "org member" ALLOW-case tests documented in CLAUDE.md as an environment-defect risk did NOT fail here — this repo's `storage.rules` has been claim-only since the Deploy 2 migration, so no cross-service `firestore.exists()` lookup is in play for those tests).
   - Combined run: **213/213 passed**.
3. **`npx vitest run`** (app suite, bare command per CLAUDE.md) — **2 failing files, exactly the documented baseline, no new regressions**: `src/storage.rules.test.ts` (whole-file connection-timeout failures — no live Storage emulator wired into this bare app-suite run) and `src/views/__tests__/RosterView.test.ts` (pre-existing stale assertion). 4092/4118 tests passed; the 26 failing tests are fully accounted for by those two known-failing files.
4. No `functions/` changes made this phase — the `cd functions && npm run build` gate was not applicable.

## User Setup Required

None — no external service configuration required.

## Hand-Over: Rules Deployment

**Not deployed.** Per this plan's grant, changes are committed to `firestore.rules`/`storage.rules` in the repo but require an explicit owner-run deploy:

```
firebase deploy --only firestore:rules,storage
```

Run this once the owner has reviewed the diff (and, if desired, `78-02`'s client-side `enterOrgAsSuperAdmin`/`exitSuperAdminView` flow, which depends on these rules being live to actually grant the super-admin cross-tenant access it calls into).

## Next Phase Readiness

- The rules-layer security boundary for R225 is complete, tested, and ready for deploy — `78-02` (client `enterOrgAsSuperAdmin`/`exitSuperAdminView`, router-guard fix, "Enter church" UI, banner) can proceed against these rules with confidence that the boundary is correct and does not regress Phase 76/77's guards.
- T-78-03 (the `members/{uid}` `allow write` includes `create`, so R226's "no member doc" guarantee is a client-code contract, not a rules invariant) remains an accepted, documented residual risk per the plan's threat model — no action taken here, flagged for a future hardening phase.
- No blockers for `78-02`.

---
*Phase: 78-super-admin-enter-any-church*
*Completed: 2026-08-23*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`firestore.rules`, `storage.rules`, `src/rules.test.ts`, `src/storage.rules.test.ts`, this SUMMARY.md); both task commit hashes (`fbcd8765`, `8f7660aa`) confirmed present in `git log`.
