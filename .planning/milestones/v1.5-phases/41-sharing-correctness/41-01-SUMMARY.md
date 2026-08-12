---
phase: 41-sharing-correctness
plan: 01
subsystem: auth
tags: [firestore-rules, security-rules, firebase-emulator, vitest, sharing]

# Dependency graph
requires:
  - phase: 40.1-close-the-self-service-membership-hole
    provides: "the org-editor/isOrgEditor idiom and the emulator-backed rules-testing discipline (108/108) this plan extends"
provides:
  - "shareTokens' allow update loosened from unconditional if false to the org-scoped isOrgEditor idiom (R077 unblocked)"
  - "new serviceShareLinks/{serviceId} collection with full org-editor CRUD, orgId immutable on update, no public read"
  - "the null-resource-tolerant read clause that lets ensureShareLink's first-ever read (Plans 03/04) resolve a not-yet-created link doc without PERMISSION_DENIED"
  - "20 new/replaced emulator-backed rules tests (6 shareTokens + 14 serviceShareLinks), both with genuine ALLOW cases"
affects: [41-02-share-token-identity-and-storage-rework, 41-03-auto-refresh-on-service-change, 41-04-backfill-adoption-for-already-circulated-links]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Org-scoped update with immutable orgId (CR-01 idiom) applied to a 4th and 5th match block: isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId"
    - "Null-resource-tolerant absence read: isSignedIn() && (resource == null || isOrgEditor(resource.data.orgId)) — lets a get() against a nonexistent doc resolve to a not-found snapshot instead of erroring/denying"

key-files:
  created: []
  modified:
    - firestore.rules
    - src/rules.test.ts
    - .planning/PENDING-VERIFICATION.md

key-decisions:
  - "serviceShareLinks read clause deliberately deviates from 41-PATTERNS.md's proposed bare isOrgEditor(resource.data.orgId) — that form errors (and therefore denies) on a nonexistent document because resource is null, which would brick ensureShareLink's very first Firestore call. Added an explicit resource == null branch instead, per the plan's own Task 1 instructions."
  - "deleteService is not touched to revoke shareTokens/serviceShares/serviceShareLinks on service deletion — recorded as out-of-scope in .planning/PENDING-VERIFICATION.md with rationale, not silently inherited."
  - "Task 1's literal verify command (npx firebase emulators:exec ...) was not run because a Firestore emulator was already active on port 8080 (would fail 'port taken'); the CLAUDE.md-documented fallback (npx vitest run --config vitest.rules.config.ts against the running emulator) was used instead for every verification in this plan, which also proves the rules parse (initializeTestEnvironment uploads them fresh each run)."

patterns-established:
  - "Absence-tolerant read rule for internal (non-public) index collections that a client must be able to probe before the target document exists."

requirements-completed: [R076, R077]

coverage:
  - id: D1
    description: "shareTokens' update clause loosened from unconditional denial to org-scoped isOrgEditor with orgId-immutable guard, unblocking R077's in-place refresh"
    requirement: R077
    verification:
      - kind: integration
        ref: "src/rules.test.ts#ALLOW (ROADMAP criterion 3) — an editor of the owning org can refresh a shareTokens doc in place"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#DENY (T-41-04) — an editor of a DIFFERENT org cannot update orgA's shareTokens doc (cross-org overwrite)"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#DENY (T-41-05) — an editor of the owning org cannot reassign a shareTokens doc to a different orgId"
        status: pass
    human_judgment: false
  - id: D2
    description: "New serviceShareLinks/{serviceId} collection: org-editor-scoped CRUD, orgId immutable on update, no public read, absence-tolerant read"
    requirement: R076
    verification:
      - kind: integration
        ref: "src/rules.test.ts#ALLOW, load-bearing (T-41-09) — an org editor reads a serviceShareLinks doc that was NEVER seeded, and gets a clean not-found snapshot rather than PERMISSION_DENIED"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#DENY (T-41-06) — an unauthenticated caller cannot read an existing serviceShareLinks doc"
        status: pass
      - kind: integration
        ref: "src/rules.test.ts#ALLOW — an editor of orgA overwrites the seeded serviceShareLinks doc with orgId unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "Owner deploy handoff and deleteService scope decision recorded in .planning/PENDING-VERIFICATION.md"
    verification: []
    human_judgment: true
    rationale: "Deploying firestore.rules and deciding whether to build future share-revocation-on-delete are owner calls, not something a test can pass/fail."

duration: 11min
completed: 2026-08-07
status: complete
---

# Phase 41 Plan 01: Sharing Correctness — Rules Authorization Summary

**Loosened `shareTokens`' unconditional update denial to the org-scoped `isOrgEditor` idiom and added a new absence-tolerant `serviceShareLinks/{serviceId}` CRUD block, proven by 20 new/replaced emulator-backed tests including two load-bearing genuine ALLOW cases.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-07T06:04:27Z
- **Completed:** 2026-08-07T06:14:37Z
- **Tasks:** 3
- **Files modified:** 3 (`firestore.rules`, `src/rules.test.ts`, `.planning/PENDING-VERIFICATION.md`)

## Accomplishments

- `shareTokens/{token}`'s `allow update` clause changed from unconditional `if false` to
  `isOrgEditor(resource.data.orgId) && request.resource.data.orgId == resource.data.orgId` — the
  identical org-scoped, `orgId`-immutable idiom already proven for `quarterShares`/`serviceShares`.
  This is the single change that unblocks R077's in-place refresh; `shareTokens` documents were
  previously permanently frozen after creation.
- New `serviceShareLinks/{serviceId}` match block: org-editor-scoped `create`/`update`/`delete`
  identical in shape to `serviceShares`, but with **no public read** (an internal index, never
  linked to anyone) and a read clause that tolerates a null `resource` — `isSignedIn() &&
  (resource == null || isOrgEditor(resource.data.orgId))`. Without the null branch, a `get()` against
  a not-yet-created link document errors on the dereference and an erroring rule denies, which would
  make `ensureShareLink`'s very first Firestore call (Plans 03/04) return `PERMISSION_DENIED` instead
  of a clean not-found snapshot — bricking the entire adopt-or-create flow.
- 20 tests added/replaced in `src/rules.test.ts`, all executed against the real Firestore emulator
  (not mocked): 6 replacing the single stale `shareTokens` "update stays false" assertion (1 ALLOW +
  5 DENY covering cross-org overwrite T-41-04, no-membership, orgId reassignment T-41-05,
  unauthenticated, and viewer-role T-41-08), and 14 new for `serviceShareLinks` (4 read including the
  load-bearing absent-document case, 4 create, 3 update, 3 delete).
- `.planning/PENDING-VERIFICATION.md` carries the owner deploy handoff (`firebase deploy --only
  firestore:rules`, with the ordering constraint against any hosting deploy of this phase's app code)
  and the `deleteService` share-revocation scope decision (out of scope, four-point rationale).
- `firestore.rules` is modified, parsed successfully by the running emulator on every test run, and
  **not deployed**.

## Task Commits

1. **Task 1: Loosen the shareTokens update clause, add the serviceShareLinks block, and record the owner handoff** - `505ef5e` (feat)
2. **Task 2: Replace the stale shareTokens update assertion with allow + deny cases against the real emulator** - `873a4c5` (test)
3. **Task 3: Add the serviceShareLinks rules describe block, including the absence-read allow case** - `2a36c38` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates)

## Files Created/Modified

- `firestore.rules` - `shareTokens` update clause loosened; new `serviceShareLinks/{serviceId}` block added (read/create/update/delete)
- `src/rules.test.ts` - stale `shareTokens` update test replaced with 6 allow/deny cases; new 14-case `serviceShareLinks` describe block added
- `.planning/PENDING-VERIFICATION.md` - Phase 41 section: owner deploy handoff + `deleteService` scope decision

## Decisions Made

- **Rejected 41-PATTERNS.md's proposed `serviceShareLinks` read clause verbatim.** PATTERNS.md (and
  41-RESEARCH.md's Code Examples) proposed a bare `allow read: if isOrgEditor(resource.data.orgId)`.
  Per the plan's own Task 1 instructions, this is wrong: `resource` is null on a `get` against a
  document that does not exist, the dereference errors, and an erroring rule denies — so the client
  would see `PERMISSION_DENIED` on `ensureShareLink`'s very first call instead of a not-found
  snapshot. Implemented the plan's corrected version instead:
  `isSignedIn() && (resource == null || isOrgEditor(resource.data.orgId))`, proven by a dedicated
  test that asserts both `assertSucceeds` AND `snap.exists() === false`.
- **`deleteService` share revocation left untouched.** Recorded as out-of-scope in
  `.planning/PENDING-VERIFICATION.md` per the plan's explicit instruction (Standing Constraint 6 /
  Task 1 Entry 2) — none of R076/R077/R078 covers delete, it's pre-existing behavior (not a
  regression this phase introduces), and the `allow delete` clauses on all three collections are
  already in place for a future phase to implement revocation without another rules change.
- **Task 1's literal verify command not run as written.** The plan's automated verify step
  (`npx firebase emulators:exec --only firestore ...`) would fail with "port taken" because a
  Firestore emulator was already running on 8080. Per CLAUDE.md's documented fallback and Hard
  Constraint 3, used `npx vitest run --config vitest.rules.config.ts` against the running emulator
  for every verification step in this plan — this also proves the rules parse, since
  `initializeTestEnvironment` uploads `firestore.rules` fresh on each test run and the suite would
  fail loudly on a syntax error.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing critical functionality, or blocking issues were encountered that required
Rule 1/2/3 fixes.

### Acceptance-criteria arithmetic note (not a functional deviation)

Two of Task 2's literal source-assertion greps undercount relative to their stated thresholds, for a
reason unrelated to test coverage:

- `grep -c "shareTokens', 'tok-abc'" src/rules.test.ts` increased by 5 (95→10, pre-edit baseline was
  5), not "at least 6" as the acceptance criterion predicted. The removed stale test itself matched
  this pattern once (`setDoc(doc(db, 'shareTokens', 'tok-abc'), ...)`), so replacing 1 matching line
  with 6 new `updateDoc(doc(db, 'shareTokens', 'tok-abc'), ...)` calls nets +5, not +6. All six
  required cases (1 ALLOW + 5 DENY) are present and pass; this is a counting-heuristic mismatch in
  the plan's acceptance criteria, not missing coverage.
- `grep -c "serviceShareLinks'" firestore.rules` (Task 3) returns 0 because Firestore rules `match`
  paths are not quoted string literals (`match /serviceShareLinks/{serviceId}` has no trailing
  quote) — the grep pattern assumed a quoted form that doesn't apply to rules syntax. The block's
  actual presence is independently confirmed: `grep -c 'match /serviceShareLinks/{serviceId}'
  firestore.rules` → `1`, and `grep -c serviceShareLinks src/rules.test.ts` → `39`.

Both are documentation-arithmetic artifacts of the acceptance criteria, not functional gaps. Full
behavioral coverage (every listed ALLOW/DENY case, by name, in verbose reporter output) is confirmed
independently below.

### Observed baseline discrepancy (out of scope, noted for the record)

`src/storage.rules.test.ts` reported **13/13 passing** (0 failures) throughout this plan's runs,
rather than CLAUDE.md's documented "2 known allow-case failures." Per Standing Constraint 3, this
file and its rule are explicitly untouched by this plan. The count did not change across any of the
three task commits (13/13 before and after), satisfying the plan's actual requirement ("that count
must not change"). The discrepancy from CLAUDE.md's older note is most plausibly explained by Phase
40's custom-auth-claim work already having moved `storage.rules`' membership check off the
emulator-inert `firestore.exists()` cross-service call — but confirming that root cause is outside
this plan's scope and is not asserted here as fact.

---

**Total deviations:** 0 auto-fixed. 2 documentation-arithmetic notes and 1 pre-existing-baseline
observation, none affecting scope or correctness.
**Impact on plan:** None — plan executed as specified; every listed ALLOW/DENY case is present and
passing.

## Issues Encountered

None beyond the documented port conflict (an emulator was already running), handled per CLAUDE.md's
documented fallback command rather than as a blocker.

## User Setup Required

None required to continue development. **Deployment is required before this phase's app code
(Plans 02-04) can function against production/staging** — see `.planning/PENDING-VERIFICATION.md` §
Phase 41 for the exact command (`firebase deploy --only firestore:rules`) and the ordering
constraint. Per the v1.5 standing autonomy grant, this deploy remains the owner's step and was not
run.

## Next Phase Readiness

`firestore.rules` and its emulator-backed test suite are ready for Plans 02-04 (share-token identity
rework, auto-refresh, backfill/adoption) to build against: `serviceShareLinks/{serviceId}` exists as
an authorized collection with the exact absence-tolerant read `ensureShareLink` needs for its very
first call, and `shareTokens` accepts an org-editor's in-place update. Full rules suite (127 tests
across `src/rules.test.ts` + `src/storage.rules.test.ts`) is green. `npm run type-check` is clean.
No blockers for Wave 1's remaining store-side work.

---
*Phase: 41-sharing-correctness*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: firestore.rules
- FOUND: src/rules.test.ts
- FOUND: .planning/PENDING-VERIFICATION.md
- FOUND: .planning/phases/41-sharing-correctness/41-01-SUMMARY.md
- FOUND commit: 505ef5e (Task 1)
- FOUND commit: 873a4c5 (Task 2)
- FOUND commit: 2a36c38 (Task 3)
