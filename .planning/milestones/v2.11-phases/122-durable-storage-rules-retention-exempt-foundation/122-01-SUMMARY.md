---
phase: 122-durable-storage-rules-retention-exempt-foundation
plan: 01
subsystem: infra
tags: [firebase, storage-rules, security, rules-emulator, vitest]

# Dependency graph
requires: []
provides:
  - "isOrgEditorByClaim/isOrgEditor claim-only editor-tier helper in storage.rules"
  - "Dedicated match /orgs/{orgId}/song-files/{allPaths=**} block: read=isOrgMember, create=isOrgEditor+size+type, update=false, delete=isOrgEditor"
  - "Catch-all song-files/ exclusion (read+write) closing the OR-combination bypass"
  - "8 new rules-emulator allow/deny cases proving R364 type/size and R372 editor-only mutation"
affects: ["122-02 (hardDeleteSong cascade relies on this plan's delete grant)", "123 (Files-tab upload UI will target this rules surface)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit create/update/delete verbs instead of bundled write, so delete (where request.resource is null) gets its own unconditioned grant"
    - "Catch-all exclusion via resource.name.matches('^orgs/[^/]+/song-files/.*') to prevent Storage's OR-combination from bypassing a stricter sibling block"

key-files:
  created: []
  modified:
    - storage.rules
    - src/storage.rules.test.ts

key-decisions:
  - "isOrgEditorByClaim mirrors isOrgMemberByClaim's exact structure (superAdmin outer arm, multi-org/legacy-arm OR, isOrgDeactivatedForCaller wrap) but requires role in ['editor','admin'] instead of merely non-null"
  - "update: if false on song-files/ — attachments are immutable, every re-upload gets a new attachmentId/path, closing an in-place-overwrite bypass of the create-time type check"
  - "Catch-all amended (not left alone) per research: a restrictive sibling block cannot narrow what a permissive co-matching catch-all already grants under Firebase's OR-combination semantics"

patterns-established:
  - "Storage rules editor-tier gating pattern (isOrgEditorByClaim) available for any future editor-only Storage prefix"

requirements-completed: [R364, R372]

coverage:
  - id: D1
    description: "An editor (claim role editor/admin) can upload a PDF or MP3 <50MB to orgs/{orgId}/song-files/ — rules ALLOW it"
    requirement: "R364"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — song-files path (R364, R372, Phase 122) > allows an editor to upload a PDF under the 50MB cap"
        status: pass
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — song-files path (R364, R372, Phase 122) > allows an editor to upload an MP3 under the 50MB cap (proves the audio branch, not just PDF)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A SMALL (<25MB) non-PDF/MP3 file written to song-files/ is DENIED — proves the catch-all cannot OR-override the dedicated block's type gate"
    requirement: "R364"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — song-files path (R364, R372, Phase 122) > DENIES a small non-PDF/MP3 upload from an editor (proves the catch-all cannot OR-override the type gate)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A file >=50MB written to song-files/ is DENIED even for an editor"
    requirement: "R364"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — song-files path (R364, R372, Phase 122) > DENIES an oversize upload even from an editor"
        status: pass
    human_judgment: false
  - id: D4
    description: "Viewer/non-editor upload and delete of a song-files object is DENIED; org member read is ALLOWED"
    requirement: "R372"
    verification:
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — song-files path (R364, R372, Phase 122) > allows a viewer to READ a song-files object (R372: read is member-gated, not editor-gated)"
        status: pass
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — song-files path (R364, R372, Phase 122) > DENIES a viewer from uploading (R372: write is editor-gated)"
        status: pass
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — song-files path (R364, R372, Phase 122) > allows an editor to delete a song-files object"
        status: pass
      - kind: integration
        ref: "src/storage.rules.test.ts#storage.rules — song-files path (R364, R372, Phase 122) > DENIES a viewer from deleting a song-files object"
        status: pass
    human_judgment: false
  - id: D5
    description: "storage.rules contains no cross-service firestore.exists()/get() call anywhere (claim-only membership/role checks); the existing static guard test still passes"
    verification:
      - kind: other
        ref: "Task-1 automated structural gate (node -e ... checking for firestore.exists( and /databases/(default)/documents/ absence)"
        status: pass
      - kind: unit
        ref: "src/storage.rules.test.ts#storage.rules — claim-only membership (Deploy 2, R075 guard) > proves membership on the claim ALONE, with no Firestore fallback re-introduced"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-05
status: complete
---

# Phase 122 Plan 01: Storage Rules — song-files Type/Size/Editor Enforcement Summary

**Amended storage.rules with a claim-only isOrgEditor helper, a dedicated editor-gated song-files/ block (PDF/MP3, <50MB, immutable, editor-only create/delete), and a catch-all exclusion closing the Storage OR-combination bypass — proven by 8 new rules-emulator allow/deny cases.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-05T15:50:00Z (approx)
- **Completed:** 2026-09-05T16:15:10Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Added `isOrgEditorByClaim`/`isOrgEditor` claim-only editor-tier helper to `storage.rules`, mirroring the existing `isOrgMemberByClaim` structure exactly but requiring role in `['editor', 'admin']`.
- Added a dedicated `match /orgs/{orgId}/song-files/{allPaths=**}` block with explicit `read`/`create`/`update`/`delete` verbs (not bundled `write`): read is member-gated, create is editor-gated with a 50MB cap and a PDF/MP3 contentType allowlist, update is permanently denied (immutability), delete is editor-gated with its own unconditioned grant.
- Amended the existing catch-all's `allow read` and `allow write` to exclude `song-files/` paths via `resource.name.matches('^orgs/[^/]+/song-files/.*')` — this is the mandatory fix for Firebase Storage's OR-combination semantics: without it, the catch-all's permissive `isOrgMember && size<25MB` grant would still allow a small non-PDF/MP3 file the dedicated block denies.
- Extended `src/storage.rules.test.ts` with 8 new rules-emulator cases covering editor PDF/MP3 upload-allow, viewer read-allow, viewer write-deny, oversize-deny, and — the load-bearing regression case — a SMALL (well under the catch-all's 25MB cap) wrong-content-type upload deny, which specifically proves the catch-all exclusion (not merely the size cap) is what blocks it. Also editor delete-allow and viewer delete-deny for the new dedicated delete verb.

## Task Commits

1. **Task 1: Amend storage.rules — isOrgEditor claim helper, dedicated song-files/ block, catch-all exclusion (R364, R372)** - `163e7c02` (feat)
2. **Task 2: Extend src/storage.rules.test.ts with song-files allow/deny emulator cases (R364, R372)** - `af558dee` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `storage.rules` - Adds `isOrgEditorByClaim`/`isOrgEditor` helper, the dedicated `song-files/` block, and the catch-all's song-files/ exclusion on read and write.
- `src/storage.rules.test.ts` - Adds `deleteObject` import, `SONG_FILE_UNDER_CAP_BYTES`/`SONG_FILE_OVER_CAP_BYTES` constants, and the `storage.rules — song-files path (R364, R372, Phase 122)` describe block (8 test cases).

## Decisions Made
- `isOrgEditorByClaim` treats `'admin'` as synonymous with `'editor'`, mirroring `firestore.rules`' `isOrgEditor` convention (R348/SEC-ISO-05) rather than inventing a separate admin tier for Storage.
- `update: if false` on the song-files block — since every re-upload path includes a fresh `attachmentId`, in-place overwrite is never a legitimate use case, and denying it closes a bypass of the create-time type check.
- Delete is its own unconditioned verb (`allow delete: if isOrgEditor(orgId)`), not bundled into `write`, because `request.resource` is `null` on delete and referencing `.size`/`.name` on it would hard-error-deny the clause.
- Followed the research's exact recommended rule text (regex string-match on `resource.name`/`request.resource.name`, not indexing into the `{allPaths=**}` capture) rather than inventing an alternative structure.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>` and `<done>` criteria were followed literally against the research's recommended rule text and test block.

## Issues Encountered
- The first `npm run test:rules` run left a stray `java.exe` Firestore-emulator process bound to port 8080 after a benign shutdown-time `NullPointerException` in the emulator's own rules-tools server (unrelated to this plan's rule changes — the first full run still reported 250/250 tests passing). This blocked a subsequent scoped re-run with "port taken." Resolved by `taskkill` on the stray PID, then re-ran the full `npm run test:rules` suite successfully with all 8 new song-files cases passing by name.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `storage.rules`'s `allow delete: if isOrgEditor(orgId)` grant on `song-files/` is now live, which is exactly what plan 122-02's `hardDeleteSong` Storage cascade (R371) needs in production — no further rules work required for that plan.
- Phase 123's Files-tab upload UI can target `orgs/{orgId}/song-files/{attachmentId}/{name}` directly; the server-authoritative type/size/editor gate is proven in the emulator.
- No blockers. The rules-layer half of R364/R372 is complete and independently verified; the retention-exemption test (R370, `functions/src/cleanupSweeps.ts`) and the `SongAttachment` type/schema work (R369) are out of this plan's scope per its frontmatter (`files_modified: [storage.rules, src/storage.rules.test.ts]`) and belong to other plans in this phase.

---
*Phase: 122-durable-storage-rules-retention-exempt-foundation*
*Completed: 2026-09-05*

## Self-Check: PASSED

All created/modified files found on disk (storage.rules, src/storage.rules.test.ts, this SUMMARY.md). Both task commits (163e7c02, af558dee) confirmed present in git log.
