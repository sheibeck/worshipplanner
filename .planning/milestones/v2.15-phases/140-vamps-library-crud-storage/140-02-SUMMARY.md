---
phase: 140-vamps-library-crud-storage
plan: 02
subsystem: security
tags: [firebase-storage, firestore-rules, storage-rules, rules-testing]

requires:
  - phase: 140-01
    provides: "vampFileStoragePath = orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{sanitizedName} — the exact path shape this plan's storage.rules block gates"
provides:
  - "storage.rules vamp-files/ block: member read; editor+audio/mpeg+<52428800 create; update:if false; editor delete"
  - "Catch-all exclusion regexes widened to (song-files|vamp-files) — closes the OR-combination bypass"
  - "src/storage.rules.test.ts vamp-files describe block (8 allow/deny cases, zero expected-local-failure annotations)"
  - "src/rules.test.ts vamps describe block proving the existing generic Firestore catch-all already covers organizations/{orgId}/vamps with ZERO firestore.rules changes"
affects: [140-03-vamps-ui, phase-141-vamp-slide-assignment]

tech-stack:
  added: []
  patterns:
    - "Server-side authority mirrors the shipped song-files/ shape exactly, narrowed from a two-MIME allow-list to a single audio/mpeg equality — the second instance of this codebase's 'permanent, retention-exempt, immutable-per-path media prefix' pattern"

key-files:
  created: []
  modified:
    - storage.rules
    - src/storage.rules.test.ts
    - src/rules.test.ts

key-decisions:
  - "Task 1 (storage.rules block + catch-all widening) landed in a prior, interrupted session as commit cee31f3d — verified byte-for-byte against the plan's spec at the start of this session and left untouched; only Task 2 (the proofs) was executed this session"
  - "Test paths mirror 140-01's real vampFileStoragePath shape (orgs/orgA/vamp-files/{vampId}/{uploadId}/track.mp3) rather than a simplified shape, so the tests exercise exactly what the app writes"
  - "Every vamp-files allow-case follows the file's claim-arm-only convention (authenticatedContext with orgId/role, no members doc seeded) with zero expected-local-failure annotations — storage.rules has been claim-only since Deploy 2 (2026-08-12), so the historical firestore.exists() blind spot does not apply here"

patterns-established: []

requirements-completed: [R435]

coverage:
  - id: D1
    description: "storage.rules has a vamp-files/ block (member read; editor+audio/mpeg+<52428800 create; update:if false; editor delete) reusing the existing claim-only isOrgMember/isOrgEditor helpers, with no firestore.exists()"
    requirement: "R435"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — vamp-files path (R435, Phase 140)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both catch-all exclusion regexes (read + write) widened to (song-files|vamp-files), closing the OR-combination bypass where the permissive <25MB member-write catch-all could otherwise override the vamp-files block's stricter type/size deny"
    requirement: "R435"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#DENIES a small non-MP3 upload from an editor (proves the catch-all cannot OR-override the type gate)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The existing generic Firestore catch-all already grants org-editor CRUD on organizations/{orgId}/vamps and denies cross-org access, with NO new firestore.rules block"
    requirement: "R435"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#Vamps collection — generic catch-all coverage (R435, Phase 140, zero rule change)"
        status: pass
    human_judgment: false

duration: ~35min (Task 2 this session; Task 1 landed in a prior interrupted session)
completed: 2026-09-13
status: complete
---

# Phase 140 Plan 2: Vamps Library Storage Rules & Rules-Test Proofs Summary

**Server-side authority for the Vamps library landed: a `vamp-files/` storage.rules block (editor-gated, audio/mpeg-only, immutable-per-path, mirroring song-files/) plus the mandatory catch-all exclusion widening, proven by 8 new Storage rules-test cases and 2 new Firestore rules-test cases that show the existing generic catch-all already covers the `vamps` collection with zero rule changes.**

## Performance

- **Duration:** ~35 min (this session, Task 2 only — Task 1 was completed and committed in a prior, interrupted session)
- **Tasks:** 2/2 completed
- **Files modified:** 3 (`storage.rules`, `src/storage.rules.test.ts`, `src/rules.test.ts`)

## Accomplishments

- Verified Task 1 (already committed as `cee31f3d` in a prior session) matches the plan's spec exactly: the `vamp-files/` block (member read; editor + `audio/mpeg` + `<52428800` create; `update: if false`; editor delete) and both catch-all exclusion regexes widened to `(song-files|vamp-files)`.
- Added a `vamp-files` describe block to `src/storage.rules.test.ts` with 8 cases: editor MP3 upload allow, viewer read allow, viewer upload deny, oversize deny, wrong-type deny (the catch-all-OR-override regression proof), editor delete allow, viewer delete deny, cross-org deny.
- Added a `vamps` describe block to `src/rules.test.ts` proving the generic Firestore catch-all covers `organizations/{orgId}/vamps` (editor read/write allowed, cross-org read denied) with **zero** `firestore.rules` changes.
- Confirmed `npm run test:rules` is fully green: **310/310 tests pass** across both rules-test files, including all 10 new cases, with zero expected-local-failure annotations.

## Task Commits

1. **Task 1: Add the vamp-files/ storage.rules block + widen the catch-all's two exclusion regexes** — `cee31f3d` (feat) — landed in a prior, interrupted session; verified in this session against the plan's spec, not redone.
2. **Task 2: Prove the vamp-files Storage rule + the zero-change Firestore catch-all coverage for vamps** — `1adfb968` (test)

## Files Created/Modified

- `storage.rules` — (Task 1, prior session) `vamp-files/` match block + widened catch-all exclusion regexes.
- `src/storage.rules.test.ts` — new `vamp-files` describe block (8 cases).
- `src/rules.test.ts` — new `vamps` describe block (2 cases).

## Decisions Made

- Task 1 was verified rather than redone: read the current `storage.rules` and confirmed every clause (read/create/update/delete verbs, size cap, contentType, both catch-all regexes) matches the plan's `<action>` and `<done>` criteria verbatim. No follow-up commit was needed.
- Test object paths use 140-01's real `vampFileStoragePath` shape (`orgs/orgA/vamp-files/{vampId}/{uploadId}/track.mp3`) rather than a flattened test-only shape, so the rules tests exercise exactly the paths the shipped `useVampFileUpload` composable writes.
- No `firestore.rules` changes were made — per the plan and RESEARCH Pitfall 4, the `vamps` collection is proven covered by the existing generic nested-collection catch-all (`match /{collection}/{docId}` under `organizations/{orgId}`), which already requires `isOrgEditor(orgId)` for both read and write on any collection not explicitly excluded.

## Deviations from Plan

None — plan executed exactly as written. Task 1 was pre-existing from a prior interrupted session and verified rather than redone, per the resume instructions.

## Issues Encountered

- **Environment flakiness, not a code defect:** the combined `npm run test:rules` command intermittently hit a mid-suite Firestore-emulator disconnect (`ECONNREFUSED 127.0.0.1:8080`) on the first few attempts, causing unrelated pre-existing tests (`services/{id}/presence`, `slideGroups delete null-safety`) to time out. Root cause was traced to a **leaked zombie Firebase-emulator Java process from a prior, unrelated session** still holding port 8080 and consuming resources — visible via `netstat`/`Get-CimInstance Win32_Process` even though the emulator's own shutdown log claimed a clean exit. After killing the stray process and confirming ports 8080/9199 were free, `npm run test:rules` ran cleanly end-to-end: **310/310 tests passed** (2 files), including every new `vamp-files` and `vamps` case. This was also independently confirmed by running each rules-test file in isolation (43/43 for `storage.rules.test.ts`, 267/267 for `rules.test.ts`) before the final clean combined run. No code change was made to work around this — it was purely a leftover-process cleanup.
- No `firestore.exists()`/cross-service calls were introduced or reintroduced anywhere in `storage.rules` — confirmed both by manual read and by the pre-existing `storage.rules — claim-only membership (Deploy 2, R075 guard)` regression test passing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 140-03 (Vamps UI) can now build against a fully proven, server-side-enforced Vamps library: the `useVampFileUpload` composable's uploads are backed by a real `storage.rules` gate, not merely client-side validation.
- No blockers. `npm run test:rules` is green (310/310); `firestore.rules` was not touched.

---
*Phase: 140-vamps-library-crud-storage*
*Completed: 2026-09-13*

## Self-Check: PASSED

Confirmed `storage.rules`, `src/storage.rules.test.ts`, and `src/rules.test.ts` exist on disk with the expected content. Confirmed commit hashes `cee31f3d` and `1adfb968` are present in `git log`. Confirmed `npm run test:rules` exits 0 with 310/310 tests passing, including all 10 new test cases named in this summary.
