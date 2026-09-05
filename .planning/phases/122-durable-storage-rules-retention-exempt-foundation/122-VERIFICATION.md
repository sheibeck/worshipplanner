---
phase: 122-durable-storage-rules-retention-exempt-foundation
verified: 2026-09-05T16:50:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 122: Durable Storage, Rules & Retention-Exempt Foundation Verification Report

**Phase Goal:** Song attachments have a permanent, org-scoped, permission-correct home in Firestore and
Storage — proven exempt from every automated cleanup sweep — before any upload UI exists. Requirements:
R364, R369, R370, R371, R372.

**Verified:** 2026-09-05T16:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R364 — storage.rules denies non-PDF/MP3 and >50MB writes to song-files/; catch-all no longer grants a weak bypass | ✓ VERIFIED | `storage.rules:107-120` dedicated `match /orgs/{orgId}/song-files/{allPaths=**}` block gates `create` on `isOrgEditor(orgId) && size<52428800 && contentType in ['application/pdf','audio/mpeg']`; catch-all (`storage.rules:122-138`) excludes `song-files/` via `resource.name.matches('^orgs/[^/]+/song-files/.*')` on both read and write. Emulator test "DENIES a small non-PDF/MP3 upload from an editor (proves the catch-all cannot OR-override the type gate)" passed live (250/250 rules suite, fresh emulator run). |
| 2 | R369 — attachments? is additive/optional on Song; path helper yields orgs/{orgId}/song-files/... outside media/ | ✓ VERIFIED | `src/types/song.ts:67` `attachments?: SongAttachment[]`; `src/utils/songFiles.ts:17-19` `songFileStoragePath()` returns `orgs/${orgId}/song-files/${attachmentId}/${sanitized}`; unit test asserts `.not.toContain('/media/')` and exact path shape — 6/6 tests pass. `npm run type-check` (vue-tsc --build, includes test files) clean. |
| 3 | R370 — song-files/ matches NONE of the four cleanup guards, for .pdf and .mp3 | ✓ VERIFIED | `functions/src/index.test.ts:1439-1455` `it.each` over PDF+MP3 song-files paths asserts `false` against `MEDIA_PATH_GUARD`, `RENDERED_OBJECT_GUARD`, `BACKGROUND_PATH_GUARD`, `PPTX_SOURCE_GUARD` — ran live, 2/2 passed. Comment-only R370 exemption notes present beside each guard in `functions/src/cleanupSweeps.ts` (lines 55, 188, 364, 577), no regex/logic change. Full functions suite ran green: 662/662 tests, 18/18 files. |
| 4 | R371 — hardDeleteSong cascades Storage deletes best-effort (never soft deleteSong); no service op / sweep can orphan attachments | ✓ VERIFIED | `src/stores/songs.ts:322-355`: cascade loop (`for (const attachment of song.attachments ?? [])`, skips no-storagePath, try/catch around `deleteObject`) runs BEFORE the Firestore doc/lyrics delete inside `hardDeleteSong`; `deleteSong` (soft delete, line 305-311) has no Storage call. 4 dedicated store tests (per-attachment delete, partial-failure tolerance, link-kind skip, soft-delete non-cascade) present and part of the 191-passing-file app-suite run. R370's guard-exclusion (truth 3) independently proves no sweep can reach the same prefix. |
| 5 | R372 — rules-layer editor-only mutation (isOrgEditor claim-only); viewer/member write+delete denied, member read allowed | ✓ VERIFIED | `storage.rules:110,119` create/delete gated on `isOrgEditor`; read gated on `isOrgMember` (line 108). Emulator tests: viewer upload DENY, viewer delete DENY, editor delete ALLOW, viewer read ALLOW — all passed live. Static "claim-only membership" guard test confirms no `firestore.exists()`/cross-service call was reintroduced. Known caveat recorded, not a gap: the viewer-read-only Files UI is unreachable in the live app today (`/songs` is `requiresEditor`; `firestore.rules` gates `songs/{songId}` on whole-doc `isOrgEditor`) — this phase's deliverable is the rules-layer enforcement, which is fully proven; the UI-reachability aspect is N/A this milestone per the plan's own documented scope. |

**Score:** 5/5 truths verified (0 present-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `storage.rules` | isOrgEditorByClaim/isOrgEditor helper, dedicated song-files/ block, catch-all exclusion | ✓ VERIFIED | Present, substantive, matches plan exactly (lines 51-79 helper, 99-120 dedicated block, 122-138 catch-all exclusion). No `firestore.exists(`/`/databases/(default)/documents/` anywhere. |
| `src/storage.rules.test.ts` | song-files describe block, 8 allow/deny cases | ✓ VERIFIED | `describe('storage.rules — song-files path (R364, R372, Phase 122)')` at line 406, 8 `it()` cases; all passed live against a fresh emulator (250/250 total rules suite). |
| `src/types/song.ts` | SongAttachment types + optional Song.attachments? | ✓ VERIFIED | Lines 23-45 (types), line 67 (optional field). type-check clean. |
| `src/utils/songFiles.ts` + test | Constants + path helper | ✓ VERIFIED | Created, exports match plan exactly; 6/6 unit tests pass. |
| `functions/src/cleanupSweeps.ts` | Comment-only exemption notes at 4 guards | ✓ VERIFIED | 4 `// R370: ...` one-line comments, no logic change (functions suite unchanged at 662/662). |
| `functions/src/index.test.ts` | Retention-exemption describe block | ✓ VERIFIED | Present at line 1439, ran green (2/2 via `it.each`). |
| `src/stores/songs.ts` hardDeleteSong cascade | Best-effort Storage cascade | ✓ VERIFIED | Lines 322-355; imports `deleteObject`/`storageRef` and `storage` correctly (lines 17-18). |
| `src/stores/__tests__/songs.test.ts` | Cascade coverage | ✓ VERIFIED | New describe block "hardDeleteSong — Storage attachment cascade (R371)" with 4 tests; `firebase/storage` mocked; part of the passing app suite. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Catch-all write/read exclusion | Dedicated song-files/ block | `resource.name.matches('^orgs/[^/]+/song-files/.*')` | ✓ WIRED | Live emulator test proves the small-wrong-type file is denied — the exclusion is load-bearing and functioning, not merely present. |
| `isOrgEditorByClaim` | song-files create/delete verbs | `isOrgEditor(orgId)` calls | ✓ WIRED | Editor allow / viewer deny emulator tests both pass. |
| `hardDeleteSong` | Storage `deleteObject` | `song.attachments ?? []` loop before Firestore delete | ✓ WIRED | Store test asserts `deleteObject` called once per storagePath attachment, and Firestore delete still commits after a rejected `deleteObject`. |
| Four cleanup guards | song-files/ prefix | Regex non-match | ✓ WIRED (verified as non-match, by design) | `it.each` test proves structural exemption for both file types. |

### Behavioral Spot-Checks / Gate Runs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type gate | `npm run type-check` | Clean, no errors | ✓ PASS |
| App suite | `npx vitest run` | 191/192 files, 5140/5175 tests passed, 35 skipped; only `src/storage.rules.test.ts` failed (documented Storage-emulator-not-running baseline at time of that specific parallel run) | ✓ PASS (matches documented baseline) |
| Rules suite (fresh emulators) | `npm run test:rules` | 250/250 tests passed across 2 files, including the full 8-case song-files block | ✓ PASS |
| Functions suite | `cd functions && npx vitest run` | 662/662 tests, 18/18 files passed | ✓ PASS |
| Functions retention-exemption (scoped) | `cd functions && npx vitest run -t "retention exemption"` | 2/2 passed | ✓ PASS |

Note: a stray `java.exe` Firestore-emulator process (left over from a prior session, matching the exact
issue documented in 122-01-SUMMARY.md) was occupying port 8080 and blocking `npm run test:rules` with
"port taken." It was killed (`taskkill`) and the full rules suite was then run fresh end-to-end by this
verifier, independent of any SUMMARY claim, with all 250 tests — including all 8 song-files cases —
passing live.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R364 | 122-01 | PDF/MP3 ≤50MB, server-authoritative | ✓ SATISFIED | storage.rules dedicated block + catch-all exclusion + emulator tests |
| R369 | 122-02 | Additive schema, org-scoped prefix outside media/ | ✓ SATISFIED | src/types/song.ts, src/utils/songFiles.ts |
| R370 | 122-02 | Exempt from every retention sweep | ✓ SATISFIED | functions/src/index.test.ts locking test |
| R371 | 122-02 (relies on 122-01's delete grant) | No orphaning; permanent survival | ✓ SATISFIED | hardDeleteSong cascade + R370 guard exclusion |
| R372 | 122-01 | Editor-only mutation at rules layer | ✓ SATISFIED | storage.rules isOrgEditor gate + emulator tests (viewer-facing UI reachability explicitly N/A this milestone, per plan's documented scope) |

REQUIREMENTS.md itself already marks all five as `[x]` / "Complete" mapped to Phase 122 — this verification
independently confirms that status against the actual code and a live test run, not merely the document.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across all 9 phase-touched files returned no matches.
No empty-implementation or hardcoded-empty-data patterns found in the reviewed logic (the rules file's
`allow update: if false` and empty-array-not-found paths are intentional, documented behavior, not stubs).

### Human Verification Required

None. This is a backend/rules/data phase with no UI; all success criteria are automatically verifiable via
type-check, unit tests, and the rules emulator. The R372 viewer-read-only-UI caveat is explicitly recorded
as N/A-in-this-app per the phase's own scope (no upload/Files UI exists yet — that's Phase 123+), not a
deferred human-UAT item.

### Gaps Summary

No gaps. All 5 must-have truths verified against live code and live test runs (not SUMMARY claims): the
rules-layer type/size/editor gates are proven by a freshly-executed 250-test rules-emulator suite (run by
this verifier after clearing a stray leftover emulator process), the additive schema and path helper are
proven by type-check + unit tests, the retention-exemption lock is proven by a freshly-executed functions
suite (662/662), and the hardDeleteSong cascade is proven by store-level unit tests within a freshly-executed
app suite that sits exactly at the documented single-file baseline.

---

_Verified: 2026-09-05T16:50:00Z_
_Verifier: Claude (gsd-verifier)_
