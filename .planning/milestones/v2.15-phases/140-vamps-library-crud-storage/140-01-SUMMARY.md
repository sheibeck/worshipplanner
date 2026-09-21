---
phase: 140-vamps-library-crud-storage
plan: 01
subsystem: data
tags: [vue, pinia, firestore, firebase-storage, tdd]

requires: []
provides:
  - "Vamp/VampAttachment/UpsertVampInput types (src/types/vamp.ts)"
  - "VAMP_KEYS 12-entry key constant (src/constants/keys.ts)"
  - "vampFiles.ts path/validation helper (VAMP_FILE_MAX_BYTES, VAMP_FILE_ALLOWED_MIME, vampFileStoragePath)"
  - "useVampStore — org-scoped CRUD + best-effort Storage-cascade delete + name/key search"
  - "useVampStore().unsubscribeAll() registered in resetOrgScopedStores() (church-switch teardown)"
  - "useVampFileUpload — single-file resumable MP3 upload composable with best-effort duration capture"
affects: [140-02-storage-rules, 140-03-vamps-ui, phase-141-vamp-slide-assignment]

tech-stack:
  added: []
  patterns:
    - "Org-scoped Pinia store mirroring songs.ts's subscribe/unsubscribeAll/CRUD shape, narrowed to a flat single-attachment doc"
    - "Per-upload uploadId Storage path segment for replace-safety under an immutable storage.rules update:false gate"
    - "Best-effort, non-blocking client-side metadata capture (audio duration) via a throwaway <audio> element racing a short timeout"

key-files:
  created:
    - src/types/vamp.ts
    - src/utils/vampFiles.ts
    - src/stores/vamps.ts
    - src/composables/useVampFileUpload.ts
    - src/utils/__tests__/vampFiles.test.ts
    - src/stores/__tests__/vamps.test.ts
    - src/stores/__tests__/orgScopedStores.test.ts
    - src/composables/__tests__/useVampFileUpload.test.ts
  modified:
    - src/constants/keys.ts
    - src/stores/orgScopedStores.ts

key-decisions:
  - "Single-step hard delete (deleteVamp) — no soft-delete/hidden/restore, matching the design's single Delete-vamp button with no restore affordance"
  - "VAMP_KEYS is a new, separate 12-entry constant (not a reuse/slice of MAJOR_KEYS' 14) — one enharmonic spelling per pitch class"
  - "Attachment writes are a plain updateVamp(id, { attachment }) — never arrayUnion/runTransaction — because a vamp has exactly one attachment slot, not an array"
  - "Storage path includes a mandatory per-upload uploadId segment (orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{name}) so an MP3 replace always lands on a fresh path under Plan 140-02's immutable update:false rule"
  - "Duration capture (durationSec) is optional, best-effort, and never blocks the upload — omitted entirely (never written as undefined) when extraction fails or the timeout elapses"

patterns-established:
  - "Vamp = Song/SongAttachment collapsed to a single flat doc — the second instance of the 'small keyed media library' shape in this codebase"

requirements-completed: [R435, R436]

coverage:
  - id: D1
    description: "useVampStore().addVamp/updateVamp/deleteVamp read+write organizations/{orgId}/vamps, and deleteVamp best-effort deletes the vamp's MP3 from Storage before removing the doc"
    requirement: "R435"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/vamps.test.ts#addVamp/updateVamp/deleteVamp"
        status: pass
    human_judgment: false
  - id: D2
    description: "A church switch tears the vamps listener down via resetOrgScopedStores() → useVampStore().unsubscribeAll(), preventing Church-A vamps from surviving a sidebar switch to Church B"
    requirement: "R435"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/orgScopedStores.test.ts#tears down every org-scoped store, including the vamps listener"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every MP3 upload (including a replace) writes to a fresh Storage path via a per-upload uploadId segment, never colliding with the immutable storage.rules update:false gate"
    requirement: "R435"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/vampFiles.test.ts#returns different paths for different uploadIds"
        status: pass
      - kind: unit
        ref: "src/composables/__tests__/useVampFileUpload.test.ts#two uploads for the same vamp use different uploadId path segments (replace-safety)"
        status: pass
    human_judgment: false
  - id: D4
    description: "vampFileStoragePath places files under orgs/{orgId}/vamp-files/... (sibling of song-files/, outside media/), structurally exempt from every retention sweep"
    requirement: "R435"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/vampFiles.test.ts#builds a path with the uploadId segment and a sanitized filename"
        status: pass
    human_judgment: false
  - id: D5
    description: "filteredVamps filters the vamp list by name OR key (case-insensitive substring) — the data half of R436's searchable table"
    requirement: "R436"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/vamps.test.ts#filteredVamps"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-10
status: complete
---

# Phase 140 Plan 1: Vamps Library Client/Data Foundation Summary

**Vamp type, VAMP_KEYS (12-entry), vampFileStoragePath (per-upload-id replace-safe), useVampStore (org-scoped CRUD + Storage-cascade delete + church-switch teardown), and useVampFileUpload (single-file resumable MP3 upload with best-effort duration capture) — all narrowing mirrors of the shipped v2.11 Song attachment pattern.**

## Performance

- **Duration:** ~45 min (task execution) + ~7 min full-suite verification
- **Started:** 2026-09-10T08:36:00Z (approx, first RED test run)
- **Completed:** 2026-09-10T09:24:00Z (approx, full suite baseline confirmed)
- **Tasks:** 3 completed
- **Files modified:** 10 (6 created, 2 modified for implementation; 4 test files created)

## Accomplishments

- `src/types/vamp.ts` — `Vamp`/`VampAttachment`/`UpsertVampInput`, no `hidden` field (single-step hard delete)
- `VAMP_KEYS` added to `src/constants/keys.ts` — the design's exact closed 12-entry key set
- `src/utils/vampFiles.ts` — `VAMP_FILE_MAX_BYTES`, `VAMP_FILE_ALLOWED_MIME`, `vampFileStoragePath(orgId, vampId, uploadId, name)` reusing the canonical `sanitizeFileName`
- `src/stores/vamps.ts` — `useVampStore`: org-scoped subscribe/unsubscribe, `addVamp` (returns new doc id), `updateVamp` (plain write, incl. the single attachment slot), `deleteVamp` (single-step hard delete with best-effort Storage cascade), `filteredVamps` (name/key search)
- `src/stores/orgScopedStores.ts` — `useVampStore().unsubscribeAll()` registered in `resetOrgScopedStores()`, closing the cross-org-listener-leak threat (T-140-12)
- `src/composables/useVampFileUpload.ts` — single-file MP3-only resumable upload, fresh per-upload path, plain `updateVamp` persist, best-effort non-blocking duration capture

## Task Commits

Each task followed the RED → GREEN TDD cycle with separate commits:

1. **Task 1: Vamp type + VAMP_KEYS + vampFiles path/validation helper**
   - `1e015abc` test(140-01): add failing test for Vamp type/VAMP_KEYS/vampFiles path helper (RED)
   - `5aab233a` feat(140-01): add Vamp type, VAMP_KEYS constant, vampFiles path helper (GREEN)
2. **Task 2: useVampStore + orgScopedStores church-switch teardown**
   - `c7033eea` test(140-01): add failing tests for useVampStore + orgScopedStores teardown (RED)
   - `d81caf10` feat(140-01): add useVampStore + register church-switch teardown (GREEN)
3. **Task 3: useVampFileUpload**
   - `9b86b019` test(140-01): add failing test for useVampFileUpload (RED)
   - `53a6658d` feat(140-01): add useVampFileUpload — single-file MP3 upload composable (GREEN)

_Every RED commit was verified to fail before implementation existed (import-resolution failure or assertion failure), and every GREEN commit was verified to pass immediately after — confirmed via direct temporary removal of the not-yet-committed implementation files for Task 1, and via genuinely-missing-module import errors for Tasks 2 and 3._

## Files Created/Modified

- `src/types/vamp.ts` — `Vamp`/`VampAttachment`/`UpsertVampInput`
- `src/constants/keys.ts` — added `VAMP_KEYS`
- `src/utils/vampFiles.ts` — Storage path helper + constants
- `src/stores/vamps.ts` — `useVampStore`
- `src/stores/orgScopedStores.ts` — added vamps teardown registration
- `src/composables/useVampFileUpload.ts` — upload composable
- `src/utils/__tests__/vampFiles.test.ts`, `src/stores/__tests__/vamps.test.ts`, `src/stores/__tests__/orgScopedStores.test.ts` (new file), `src/composables/__tests__/useVampFileUpload.test.ts`

## Decisions Made

- Single-step hard delete for `deleteVamp` (Assumption A3 from RESEARCH.md, confirmed by the plan's locked decision) — simpler store, matches the design's single "Delete vamp" button.
- `VAMP_KEYS` is a wholly separate 12-entry constant, not derived from `MAJOR_KEYS` (14 entries, both enharmonic spellings).
- Attachment persistence uses a plain `updateVamp(id, { attachment })` write — no `arrayUnion`/`runTransaction`, since a vamp has exactly one attachment slot.
- Storage path always includes a per-upload `uploadId` segment (`orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{name}`) so a replace never collides with Plan 140-02's immutable `update: if false` rule.
- Duration capture uses a throwaway `<audio>` element racing a 300ms `loadedmetadata` timeout; any failure (including jsdom's lack of a real audio pipeline) simply omits `durationSec` rather than blocking or failing the upload.

## Deviations from Plan

None — plan executed exactly as written. All `must_haves.truths` are demonstrated by the four test files as specified.

## Issues Encountered

- The first `npx vitest run` (full app suite, default `forks` pool) hit a transient `[vitest-pool]: Failed to start forks worker` timeout on an isolated run of `useVampFileUpload.test.ts` (unrelated to this plan's code — a `--pool=threads` retry passed immediately, and a subsequent default-pool retry also passed cleanly, confirming it was a one-off environment/resource blip, not a real test issue). The final full-suite verification run (`npx vitest run`, default pool) completed successfully in ~429s: 234/235 test files passed, 5772/5806 tests passed, with the single failing file being the pre-existing documented baseline `src/storage.rules.test.ts` (Storage-emulator dependent — CLAUDE.md). No new regressions.
- `npm run type-check` (`vue-tsc --build`) initially flagged a `TS2322` in `vamps.test.ts` — a fake `createdAt: { seconds, nanoseconds }` object assigned directly to a typed `attachment` field didn't satisfy the real `Timestamp` interface. Fixed with an `as any` cast on that one test fixture, matching the existing convention already used in `songs.test.ts` for the identical pattern (Rule 1 — trivial test-only type fix, not a production code issue).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 140-02 (storage.rules) can now write its `vamp-files/` block and rules tests against the shipped `vampFileStoragePath` shape (`orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{name}`).
- Plan 140-03 (Vamps UI — `VampTable.vue`/`VampSlideOver.vue`/`SongsView.vue` tab bar) has a complete, tested `useVampStore`/`useVampFileUpload`/`VAMP_KEYS` surface to build against.
- No blockers. `npm run type-check` is clean; the full app suite matches the documented baseline exactly (only `src/storage.rules.test.ts`, Storage-emulator dependent, fails).

---
*Phase: 140-vamps-library-crud-storage*
*Completed: 2026-09-10*

## Self-Check: PASSED

All 9 created files (8 source/test files + this SUMMARY) confirmed present on disk. All 6 task commit
hashes (1e015abc, 5aab233a, c7033eea, d81caf10, 9b86b019, 53a6658d) confirmed present in git log.
