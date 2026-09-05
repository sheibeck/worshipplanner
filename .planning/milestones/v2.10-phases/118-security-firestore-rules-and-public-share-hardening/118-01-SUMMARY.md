---
phase: 118-security-firestore-rules-and-public-share-hardening
plan: 01
subsystem: security
tags: [firestore, firebase-rules, rules-unit-testing, security-review]

# Dependency graph
requires:
  - phase: 112-security-review
    provides: the v2.8 security review findings register (R341, R342, R343, R348)
provides:
  - "R341 real fix: services/{docId} draft-update branch 1 now denies any write whose affectedKeys include createdBy/createdAt"
  - "R343 real fix: orgSlugs/orgNames get/list split closes unauthenticated collection enumeration"
  - "R342 documented + pinned: super-admin members/{uid} universal write is an accepted, tested residual"
  - "R348 documented + pinned: admin/editor role synonymity is an accepted, tested residual with a future-divergence tripwire"
affects: [118-02-public-share-hardening, future-admin-role-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provenance-diff guard via the existing keys()/affectedKeys() idiom, reused verbatim for a second field pair"
    - "get/list split (allow get: if true; allow list: if false;) applied to a third/fourth collection pair, same SEC-S-01 shape"

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts

key-decisions:
  - "R341 protects exactly createdBy/createdAt, not pcExportedAt/pcPlanId (those have their own legitimate export branch)"
  - "R343 uses a flat `list: if false` (not scoped) — confirmed via source read that claimSlug/claimOrgName never list/query these collections"
  - "R342/R348 took the locked low-risk CONTEXT branch: document + pin, do not narrow isOrgEditor"

requirements-completed: [R341, R342, R343, R348]

coverage:
  - id: D1
    description: "An org editor can no longer forge createdBy/createdAt on a draft services/{docId} update; an ordinary draft edit still succeeds"
    requirement: R341
    verification:
      - kind: integration
        ref: "src/rules.test.ts#Service draft lock (R036/R037) > ordinary editing > an editor cannot change createdBy on a draft service (R341)"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#Service draft lock (R036/R037) > ordinary editing > an editor cannot forge createdBy onto a draft service that has none (R341)"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#Service draft lock (R036/R037) > ordinary editing > an ordinary draft edit that leaves createdBy untouched still succeeds (R341)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unauthenticated getDocs on orgSlugs and orgNames fail; getDoc-by-id on each still succeeds"
    requirement: R343
    verification:
      - kind: integration
        ref: "src/rules.test.ts#orgSlugs > denies unauthenticated collection listing of orgSlugs (R343)"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#orgNames > denies unauthenticated collection listing of orgNames (R343)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A super-admin CAN write members/{uid} by rule — accepted boundary documented in-rule and pinned by a passing test"
    requirement: R342
    verification:
      - kind: integration
        ref: "src/rules.test.ts#Super-admin content access without a membership doc (R225, Phase 78) > ALLOWS a super-admin to write an org member doc directly (R342 accepted residual)"
        status: pass
    human_judgment: false
  - id: D4
    description: "role:'admin' is proven functionally identical to role:'editor' today, with an in-rule warning against a future admin-gate inheriting the self-escalation path"
    requirement: R348
    verification:
      - kind: integration
        ref: "src/rules.test.ts#admin/editor role synonymity (R348) > an admin-role member is treated exactly as an editor on an editor-gated write"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-09-05
status: complete
---

# Phase 118 Plan 01: Firestore Rules Hardening Summary

**Two real firestore.rules fixes (draft-provenance forgery, orgSlugs/orgNames enumeration) plus two documented-and-pinned accepted residuals (super-admin members-write, admin/editor synonymity), all four regression-proven in the emulator rules suite.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-05T00:52Z
- **Completed:** 2026-09-05T01:03Z
- **Tasks:** 3
- **Files modified:** 2 (`firestore.rules`, `src/rules.test.ts`)

## Accomplishments
- R341 (SEC-R-03): the `services/{docId}` draft-update branch 1 now denies any write whose `affectedKeys()` include `createdBy` or `createdAt`, mirroring the existing `preservesCreatedBy()` idiom. Confirmed via source read (`services.ts:410-480`, `632-712`) that no live draft write path ever emits those fields, so the guard has zero blast radius on real usage.
- R343 (SEC-ISO-06 residual): `orgSlugs/{slug}` and `orgNames/{nameKey}` split their unsplit `allow read: if true` into `allow get: if true` + `allow list: if false`, mirroring the SEC-S-01 fix already proven on `quarterShares`/`serviceShares`. `claimSlug`/`claimOrgName` only ever `getDoc()` by known id, so the flat deny closes enumeration with no legitimate-path risk.
- R342 (ARCH-018/SEC-ISO-04, accepted): the `members/{uid}` write-rule comment now states plainly that a super-admin CAN write any org's members/{uid} by rule via `isOrgEditor`'s super-admin disjunct, and that the "no member doc" guarantee is a client-code contract, not a rules invariant. Pinned by an ALLOW test.
- R348 (SEC-ISO-05, accepted): `isOrgEditor`'s role check now carries an in-rule warning that `'admin'` is intentionally synonymous with `'editor'` today, and a future admin-specific gate must not silently inherit the editor self-escalation path. Pinned by a synonymity test.
- Full `npm run test:rules` run: 242/242 tests passed across both `src/rules.test.ts` (215 tests) and `src/storage.rules.test.ts` (27 tests) — zero failures, including the storage.rules ALLOW cases CLAUDE.md documents as a known Storage-emulator baseline failure (see Issues Encountered below).

## Task Commits

Each task was committed atomically:

1. **Task 1: R341 — provenance-field-diff guard on the services draft-update branch** - `34d668ab` (fix)
2. **Task 2: R343 — orgSlugs/orgNames get/list split closes unauthenticated enumeration** - `facd0fa6` (fix)
3. **Task 3: R342 + R348 — document and pin the two accepted residuals** - `362592c6` (docs)

_No plan-metadata commit yet — this SUMMARY/STATE/ROADMAP commit follows._

## Files Created/Modified
- `firestore.rules` - services draft-update provenance guard (R341); orgSlugs/orgNames get/list split (R343); members/{uid} and isOrgEditor role-check comments (R342, R348)
- `src/rules.test.ts` - 3 new R341 cases, 2 new R343 cases, 1 new R342 case, 1 new R348 case (7 total new tests)

## Decisions Made
- R341 protects exactly `createdBy`/`createdAt` per the locked CONTEXT decision — `pcExportedAt`/`pcPlanId` are untouched since they have their own legitimate export branch (branch 2).
- R343 uses a flat `list: if false` rather than a scoped list, per the plan's explicit direction — a repo-wide check confirmed zero legitimate list/query usage on these collections.
- R342/R348 took the locked low-risk CONTEXT branch (document + pin) rather than narrowing `isOrgEditor`, per the explicit in-rule and CONTEXT warnings against doing so.

## Deviations from Plan

None - plan executed exactly as written. Every task's `<action>` was implemented as specified; no Rule 1-4 auto-fixes or architectural questions arose.

## Issues Encountered
- The rules emulator port (8080) was left bound by a stale Java rules-tools process (`NullPointerException` on shutdown) after the first `npm run test:rules` invocation, causing a subsequent `npm run test:rules` to fail with "port taken." Per the plan's explicit fallback instruction, ran `npx vitest run --config vitest.rules.config.ts` directly against the leaked-but-live emulator for Tasks 1-2's incremental verification, then killed the leaked process (PID) before the final full `npm run test:rules` run for this plan's overall verification. Not a code defect — a known emulator-shutdown quirk, not touched by this plan's scope.
- **Observation (not acted on):** the final full `npm run test:rules` run passed 242/242 tests with zero failures, including the two `src/storage.rules.test.ts` ALLOW cases (`allows an org member to write and read an object under their org path`, and the media-path equivalent) that CLAUDE.md documents as a known, accepted Storage-emulator baseline failure (`firestore.exists()` inert cross-service in the Storage emulator, firebase-js-sdk#6803). This plan touches only `firestore.rules`/`src/rules.test.ts` and did not modify `storage.rules` or `src/storage.rules.test.ts` — the change in behavior (if durable) is most likely a firebase-tools/SDK version drift since CLAUDE.md was last updated, not anything introduced here. Flagging for awareness; CLAUDE.md's baseline documentation is left unchanged since confirming durability is out of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `firestore.rules` and `src/rules.test.ts` are in a clean, fully-green state for plan 118-02 (public share hardening, R346/R347) to build on without inherited rules-suite risk.
- The observation above (storage.rules.test.ts passing in full) is worth a quick confirmation the next time anyone touches `storage.rules` or the CLAUDE.md testing section, but is not a blocker.

---
*Phase: 118-security-firestore-rules-and-public-share-hardening*
*Completed: 2026-09-05*

## Self-Check: PASSED
