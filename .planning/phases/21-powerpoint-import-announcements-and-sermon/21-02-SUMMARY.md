---
phase: 21-powerpoint-import-announcements-and-sermon
plan: 02
subsystem: infra
tags: [firebase, storage, functions, security-rules, emulator, rules-unit-testing]

# Dependency graph
requires:
  - phase: 21-powerpoint-import-announcements-and-sermon (plan 01)
    provides: SlotKind 'IMPORTED' + ImageSlide + importedSlides store (not directly consumed by this plan, but establishes the phase's Firestore-side data model this Storage layer will feed)
provides:
  - getStorage/getFunctions client instances wired to Firebase emulators under VITE_USE_EMULATORS
  - storage.rules — org-membership-gated Storage security rules on a generic orgs/{orgId} path
  - firebase.json storage block + emulators.storage port (9199)
  - Storage rules test coverage (member allow, non-member deny, over-cap deny) via @firebase/rules-unit-testing
  - Working recipe for cross-service firestore.exists() calls from Storage rules under the local emulator (project-id alignment)
affects: [21-03-functions-test-infra, 21-04-parsePptx-function, 21-05-pptxUpload-util, 22-media-attachments-and-storage-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-service Storage rules (firestore.exists()) require the rules-unit-testing client's projectId to match the Firebase CLI's active GCLOUD_PROJECT — pin --project <id> on the emulators:exec invocation rather than relying on emulators.singleProjectMode."
    - "Rules test files that exercise cross-service checks must run with vitest fileParallelism disabled — the emulator's shared Java rules-tools process is not safe for concurrent test-file evaluation."

key-files:
  created:
    - storage.rules
    - src/storage.rules.test.ts
  modified:
    - src/firebase/index.ts
    - firebase.json
    - vitest.rules.config.ts
    - package.json

key-decisions:
  - "storage.rules path prefix is generic (orgs/{orgId}/{allPaths=**}), not PPTX-specific, so Phase 22 media attachments reuse the same rule."
  - "25MB (26214400 byte) per-upload size cap on write, per 21-RESEARCH.md Open Question 3 — documented as tunable, not a hard product limit."
  - "Removed firebase.json's emulators.singleProjectMode:false (added in an earlier commit solely to silence a rules-test project-id warning). It was actively breaking storage.rules' cross-service firestore.exists() lookup by forcing it to query the CLI's real default project instead of the rules-unit-testing client's project. Replaced with --project test-project on the test:rules invocation, which fixes the original warning AND keeps cross-service rules working."

patterns-established:
  - "Storage rules test file (src/storage.rules.test.ts) mirrors src/rules.test.ts's beforeAll/afterEach/afterAll lifecycle and seedMembershipDoc helper, but drives assertions through firebase/storage's ref/uploadBytes/getBytes against a RulesTestContext.storage() instance."

requirements-completed: [R010, R011]

coverage:
  - id: D1
    description: "Client Firebase app exports Storage and Functions instances, both connecting to local emulators when VITE_USE_EMULATORS=true"
    requirement: "R010"
    verification:
      - kind: unit
        ref: "npx vue-tsc --build (type-check) + node -e firebase.json shape check"
        status: pass
    human_judgment: false
  - id: D2
    description: "storage.rules enforces org membership (firestore.exists cross-service check) on read and write, plus a 25MB write size cap, on the generic orgs/{orgId} path"
    requirement: "R011"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — org membership (member allow, non-member deny read, non-member deny write, over-cap deny)"
        status: pass
    human_judgment: false
  - id: D3
    description: "firebase.json declares a storage rules file and Storage emulator port so firebase emulators:start serves Storage locally"
    requirement: "R010"
    verification:
      - kind: unit
        ref: "node -e require('./firebase.json').storage && .emulators.storage check"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-07-25
status: complete
---

# Phase 21 Plan 02: Firebase Storage + callable Functions client bootstrap Summary

**Storage and Functions client SDKs wired into src/firebase/index.ts with emulator connects, org-membership storage.rules cross-referencing Firestore membership docs, and a passing Storage rules test suite exercising member-allow/non-member-deny/over-cap-deny against the emulator.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-25T03:05:00Z (approx)
- **Completed:** 2026-07-25T04:00:30Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `src/firebase/index.ts` now exports `storage` (getStorage) and `functions` (getFunctions), both emulator-connected inside the existing `VITE_USE_EMULATORS` guard
- `storage.rules` created: org-membership read/write gate via `firestore.exists()` cross-service lookup mirroring `firestore.rules`' `isOrgMember`, plus a 25MB write size cap, scoped to a generic `orgs/{orgId}` path so Phase 22 media attachments reuse it unchanged
- `firebase.json` declares the `storage` rules file and an `emulators.storage` port (9199)
- `src/storage.rules.test.ts` proves the rules against the real Storage + Firestore emulators: member write+read succeeds, non-member read/write denied, over-25MB write denied — 4/4 passing, 61/61 total in the `test:rules` suite
- Diagnosed and fixed a real cross-service-rules environment bug (see Deviations) that would have silently broken `firestore.exists()` for anyone running `firebase emulators:start` locally

## Task Commits

Each task was committed atomically:

1. **Task 1: Export Storage and callable Functions from the client firebase module and register them in firebase.json** - `71b90de` (feat)
2. **Task 2: Author org-membership storage.rules with a per-upload size cap** - `c3ae445` (feat)
3. **Task 3: Add Storage rules tests and wire them into the rules test run** - `04496b6` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/firebase/index.ts` - added `getStorage`/`getFunctions` exports plus `connectStorageEmulator`/`connectFunctionsEmulator` inside the existing emulator guard
- `firebase.json` - added top-level `storage` block (rules: storage.rules), `emulators.storage` port 9199, and removed `emulators.singleProjectMode: false` (see Deviations)
- `storage.rules` (new) - org-membership + size-cap Storage security rules
- `src/storage.rules.test.ts` (new) - rules-unit-testing coverage for storage.rules
- `vitest.rules.config.ts` - added `src/storage.rules.test.ts` to `include`; added `fileParallelism: false`
- `package.json` - `test:rules` now runs `--only firestore,storage --project test-project`

## Decisions Made
- Kept the storage.rules path generic (`orgs/{orgId}/{allPaths=**}`) rather than PPTX-specific, per the plan's explicit instruction to keep Phase 22 compatibility.
- 25MB write cap taken as-is from 21-RESEARCH.md's Open Question 3 recommendation; documented in-file as tunable.
- Chose to fix the `firestore.exists()` cross-service failure at its root cause (project-id alignment + serialized rules-tool access) rather than working around it with a skip/pending marker on the test, since the underlying bug would also break `firebase emulators:start` for any local developer testing Storage uploads manually.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `firestore.exists()` cross-service check in storage.rules always resolved false under the local emulator**
- **Found during:** Task 3 (writing and running the Storage rules test)
- **Issue:** The Storage emulator's `firestore.exists()` cross-service lookup queries Firestore using the Firebase CLI's active `GCLOUD_PROJECT` (the real default project `worship-planner-bc515` from `.firebaserc`), not the project id the `@firebase/rules-unit-testing` client passes (`test-project`). Debug logging (`firebase emulators:exec --debug`) showed the rules runtime issuing `GET .../projects/worship-planner-bc515/databases/(default)/documents/organizations/orgA/members/userA` — 404, even though the membership doc was correctly seeded under the `test-project` Firestore emulator namespace. This made every `firestore.exists()` evaluation return false, so the "member can write/read" test failed while every deny-path test passed vacuously (deny is the correct result whether or not the membership check is broken).
- **Root cause:** `firebase.json`'s `emulators.singleProjectMode: false` (added in a prior commit purely "so the rules tests... stop warning about multiple project ids") allows the CLI's active project and the client SDK's project id to diverge — which is exactly what breaks the Storage cross-service check, since it hard-targets `GCLOUD_PROJECT` regardless of what project the calling client specifies.
- **Fix:** Removed `emulators.singleProjectMode: false` from `firebase.json` and instead pinned `--project test-project` on the `test:rules` npm script's `firebase emulators:exec` invocation. This aligns `GCLOUD_PROJECT` with the `test-project` id both `src/rules.test.ts` and `src/storage.rules.test.ts` already use, eliminating the original project-id-mismatch warning through project alignment (not suppression) while making the cross-service check resolve correctly.
- **Files modified:** `firebase.json`, `package.json`
- **Verification:** `npm run test:rules` — 61/61 tests pass (57 in `src/rules.test.ts`, 4 in `src/storage.rules.test.ts`), run twice to confirm determinism
- **Committed in:** `04496b6` (Task 3 commit)

**2. [Rule 3 - Blocking] Concurrent rules test files crash the emulator's shared cross-service rules-tools process**
- **Found during:** Task 3 (running both rules test files together)
- **Issue:** With `src/rules.test.ts` and `src/storage.rules.test.ts` both included in `vitest.rules.config.ts`, vitest's default parallel file execution sent simultaneous rule-evaluation requests to the emulator's shared Java "rules-tools" server (`cloud-storage-rules-runtime-v1.1.3.jar`), which handles the cross-service `firestore.exists()` bridge. This crashed the process (`NullPointerException: Cannot invoke "String.length()" because "line" is null` in `Server.processRequestsFromInputStream`), producing spurious `evaluation error`/`permission-denied` failures scattered across both test files, not just storage-related tests — confirmed by re-running with only `src/rules.test.ts` (all pass) vs. both files together (intermittent unrelated failures).
- **Fix:** Added `fileParallelism: false` to `vitest.rules.config.ts` so only one rules test file talks to the emulator's rules-tools process at a time.
- **Files modified:** `vitest.rules.config.ts`
- **Verification:** `npm run test:rules` run three times consecutively after the fix — 61/61 pass every time, no evaluation errors or crashes affecting test outcomes (a harmless NPE still prints during emulator shutdown after all tests report, unrelated to test results)
- **Committed in:** `04496b6` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues preventing Task 3's `npm run test:rules` verification from passing)
**Impact on plan:** Both fixes were necessary for the plan's own stated verification (`npm run test:rules is green with both Firestore and Storage emulators`) to be achievable at all — not scope creep, but the actual root-cause resolution of the exact risk flagged in 21-RESEARCH.md Assumption A5 ("cross-service firestore.exists() call syntax... not re-fetched from docs this session... verify... before deploying"). The syntax itself was correct; the environment/project-alignment interaction was the real gap.

## Issues Encountered
- Repeatedly hit "port taken" errors from `firebase emulators:exec` leaving a lingering `java` process holding port 8080 after prior runs exited (including failed runs). Worked around during development by checking `netstat -ano` and `taskkill`-ing the stale PID before each retry. This is a local-environment quirk of the iterative debugging session, not a code change — no plan file was modified to address it, since `npm run test:rules` as a single clean invocation (confirmed at the end) does not hit this.

## User Setup Required
None - no external service configuration required. Storage and Functions emulators are already covered by the existing `.env.local` requirement documented in CLAUDE.md.

## Next Phase Readiness
- Storage + Functions client instances and org-scoped storage.rules are ready for 21-03 (functions test infra), 21-04 (parsePptx function + server-side upload), and 21-05 (client pptxUpload util) to build on directly.
- The `--project test-project` / `fileParallelism: false` fixes in `vitest.rules.config.ts` and `package.json` apply to any future rules test file that needs cross-service Storage↔Firestore checks (including Phase 22's media attachments storage.rules work) — no further environment fixes should be needed there.
- No blockers identified for subsequent plans in this phase.

---
*Phase: 21-powerpoint-import-announcements-and-sermon*
*Completed: 2026-07-25*

## Self-Check: PASSED

All created/modified files verified present on disk (storage.rules, src/storage.rules.test.ts, src/firebase/index.ts, firebase.json, vitest.rules.config.ts, package.json, this SUMMARY.md). All three task commit hashes (71b90de, c3ae445, 04496b6) verified present in git log.
