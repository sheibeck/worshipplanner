---
phase: 58-messaging-infrastructure-settings-recipient-resolution
plan: 03
subsystem: infra
tags: [firestore-rules, security-rules, emulator-testing, firebase]

# Dependency graph
requires:
  - phase: 58-messaging-infrastructure-settings-recipient-resolution
    provides: "58-01/58-02 established the messaging settings and pure recipient-resolution logic this rules layer will eventually gate writes for"
provides:
  - "Deny-by-default firestore.rules for services/{id}/messages, services/{id}/messages/{id}/recipients, and services/{id}/lockSnapshots"
  - "Emulator-proven ALLOW + deny cases for all three new nested collections in src/rules.test.ts"
affects: [59-messaging-composer, 61-service-locking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-segment-deep nested collections under match /services/{docId} fall through to default-deny automatically — no wildcard-exclusion entry needed (mirrors songs/{id}/lyrics/{id})"
    - "Admin-SDK-only fields (message status transitions, recipients) are enforced with allow update, delete: if false / allow write: if false, never by client-side gating alone"

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts

key-decisions:
  - "Followed 58-RESEARCH.md's exact rules-block code example verbatim (messages/recipients/lockSnapshots nesting, tier assignments) — no deviation needed"
  - "Rules ship built/tested/UNDEPLOYED per the v1.7 deploy-gated grant; owner must run the deploy command manually (see User Setup Required below)"

patterns-established:
  - "New nested collection under services/{docId}: read isOrgMember, write isOrgEditor, with explicit if false on any Admin-SDK-only fields — test every case against the FULL nested path, never a sibling path, to catch misplacement (Pitfall 3 in 58-RESEARCH.md)"

requirements-completed: [R130, R132]

coverage:
  - id: D1
    description: "services/{id}/messages, .../recipients, and services/{id}/lockSnapshots are deny-by-default with explicit isOrgMember/isOrgEditor allow blocks nested inside match /services/{docId}"
    requirement: "R130"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#'services/{id}/messages nested collection (R130)' and 'services/{id}/messages/{id}/recipients nested collection (R130) — Admin-SDK-only' describe blocks — npm run test:rules"
        status: pass
    human_judgment: false
  - id: D2
    description: "lockSnapshots is deny-by-default with member read / editor write, proving the per-service lock-snapshot surface R132 depends on"
    requirement: "R132"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#'services/{id}/lockSnapshots nested collection (R132)' describe block — npm run test:rules"
        status: pass
    human_judgment: false
  - id: D3
    description: "The emulator suite includes genuine ALLOW-cases (editor creates messages, member reads messages, viewer reads messages, member reads recipients, editor writes lockSnapshots, member reads lockSnapshots) that pass against the real firestore.rules text, not only deny-cases"
    verification:
      - kind: integration
        ref: "src/rules.test.ts — 6 new ALLOW-case tests, RED against pre-Task-2 rules, GREEN after Task 2 (npm run test:rules)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rules ship built/tested/UNDEPLOYED; the exact firebase deploy --only firestore:rules command is handed to the owner"
    verification: []
    human_judgment: true
    rationale: "Deploying to production Firebase is an owner-only action per the v1.7 deploy-gated grant; no automated verification applies to a deliberately-not-executed deploy step."

# Metrics
duration: 20min
completed: 2026-08-13
status: complete
---

# Phase 58 Plan 03: Firestore rules for messages/recipients/lockSnapshots Summary

**Deny-by-default `firestore.rules` for `services/{id}/messages`, `.../recipients`, and `services/{id}/lockSnapshots`, proven by 6 new genuine ALLOW-cases plus Admin-SDK-only and cross-org DENY-cases against the real emulator — ships undeployed per the v1.7 gate.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2 (`firestore.rules`, `src/rules.test.ts`)

## Accomplishments
- Added `match /messages/{messageId}` (member read, editor create, update/delete Admin-SDK-only `if false`) nested inside `match /services/{docId}`, with `match /recipients/{recipientId}` nested one level deeper (member read, write `if false`, Admin-SDK-only).
- Added `match /lockSnapshots/{snapshotId}` (member read, editor write — the one new collection a client legitimately writes) alongside it.
- Added a full RED→GREEN emulator test cycle in `src/rules.test.ts`: Task 1 added ALLOW + deny cases that ran RED for the 6 ALLOW-cases and GREEN for all deny-cases (proving the collections were genuinely default-denied beforehand); Task 2's rules addition turned the ALLOW-cases GREEN with no regression in any of the 157 pre-existing deny-cases.
- Confirmed via `npm run test:rules` (full clean run with both firestore and storage emulators): **163/163 tests passed**, exit code 0.

## Task Commits

1. **Task 1: Add emulator ALLOW + deny test cases (test-first, RED)** — `07549c0` (test)
2. **Task 2: Add nested deny-by-default rules blocks (GREEN)** — `a40d21a` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/rules.test.ts` — 3 new `describe` blocks: `services/{id}/messages nested collection (R130)`, `services/{id}/messages/{id}/recipients nested collection (R130) — Admin-SDK-only`, `services/{id}/lockSnapshots nested collection (R132)`. Every test targets the full nested path `organizations/{orgId}/services/{serviceId}/...`, never a sibling path.
- `firestore.rules` — 3 new nested `match` blocks inside `match /services/{docId}` (before its closing brace): `messages/{messageId}`, `messages/{messageId}/recipients/{recipientId}`, `lockSnapshots/{snapshotId}`. No changes to the generic wildcard exclusion list — these paths are deep enough to fall through to default-deny automatically.

## Decisions Made
- Followed 58-RESEARCH.md's exact rules-block code example and test shape verbatim — no deviation from the researched design was needed.
- Used role `'member'` (not `'viewer'`) for the plain isOrgMember-only ALLOW-case seeds, matching the file's existing convention (`isOrgMember` only checks doc existence, any role value satisfies it); used `'viewer'` explicitly for the DENY-cases where the plan called out viewer-tier denial, matching the file's existing viewer-vs-editor test convention elsewhere.

## Deviations from Plan

None - plan executed exactly as written. The rules blocks match 58-RESEARCH.md's code example verbatim, and the test cases cover every required case from the plan's task description (genuine ALLOW for editor-creates-messages, member-reads-messages, editor-writes-lockSnapshots, member-reads-lockSnapshots, member-reads-recipients; DENY for viewer-creates-messages, editor-updates/deletes-messages, any-client-writes-recipients, viewer-writes-lockSnapshots, cross-org read/write on lockSnapshots).

## Issues Encountered
- The rules emulator's Java process (`FirebaseRulesTooling`) threw a benign `NullPointerException` during shutdown on two separate `npm run test:rules` invocations, leaving a stray listener on port 8080 (and once on 9199) that blocked the next `npm run test:rules` run with "port taken." Not a rule defect — resolved by killing the stray process (`taskkill`) and either re-running `npm run test:rules` fresh or falling back to `npx vitest run --config vitest.rules.config.ts` against the still-running emulator, exactly as CLAUDE.md's documented port-conflict workaround describes. The final clean run (both firestore and storage emulators, fresh start) passed 163/163 with exit code 0.

## User Setup Required

**External services require manual configuration.**

The `firestore.rules` changes in this plan are **DEPLOY-GATED** per the v1.7 standing autonomy grant — they ship built, tested (163/163 passing against the real emulator), and committed, but **NOT deployed to production**. No client code writes `messages`/`recipients`/`lockSnapshots` yet (Phase 59+), so leaving them undeployed blocks nothing in Phase 58.

**Action required before Phase 59's messaging composer relies on this enforcement:**
```
firebase deploy --only firestore:rules
```
Run this from the owner's terminal in the main checkout (`C:\projects\worshipplanner`). This is the exact and only command needed — it publishes the new `messages`/`recipients`/`lockSnapshots` blocks alongside all existing rules (no partial/scoped deploy option is used, since Firestore rules deploy as one document).

## Next Phase Readiness
- The server-side enforcement layer for `messages`/`recipients`/`lockSnapshots` is complete and proven — Phase 59 (messaging composer/send) and Phase 61 (service locking) can build client writes against these paths with confidence the rules already gate them correctly once deployed.
- No blockers. The one open item is the owner's manual `firebase deploy --only firestore:rules` step, tracked above and not required until a future phase's client code actually needs the enforcement live in production.

---
*Phase: 58-messaging-infrastructure-settings-recipient-resolution*
*Completed: 2026-08-13*

## Self-Check: PASSED
- FOUND: firestore.rules
- FOUND: src/rules.test.ts
- FOUND: .planning/phases/58-messaging-infrastructure-settings-recipient-resolution/58-03-SUMMARY.md
- FOUND: 07549c0 (Task 1 commit)
- FOUND: a40d21a (Task 2 commit)
