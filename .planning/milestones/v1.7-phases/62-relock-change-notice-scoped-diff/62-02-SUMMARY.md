---
phase: 62-relock-change-notice-scoped-diff
plan: 02
subsystem: services
tags: [diff, fingerprint, djb2, service-lock, change-notice, pure-util, tdd]

# Dependency graph
requires:
  - phase: 41-share-link-snapshot
    provides: "ServiceSnapshot shape (services.ts:80-95) + buildServiceSnapshot's section-major slot order"
  - phase: 24-slide-groups
    provides: "SlideGroup / GroupSlideEntry / SourceRef types and the slotId-anchored group doc"
  - phase: 62-01
    provides: "functions-local ChangeEntry mirror (string[] teams) this client ChangeEntry parallels"
provides:
  - "src/utils/serviceLockDiff.ts — pure fingerprintSlideGroups(groups, serviceId) => SlideFingerprint"
  - "src/utils/serviceLockDiff.ts — pure diffServiceSnapshots(prev, curr, prevFp, currFp) => ChangeEntry[]"
  - "Exported ChangeEntry + SlideFingerprint types for the 62-03 modal and 62-04 lock hook to import"
affects: [62-03, 62-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency-free DJB2 string hash as a NON-security change-detector (no npm package)"
    - "Pure function in utils/ over passed-in data — type-only imports of store/domain types, zero Firestore/Pinia at runtime"

key-files:
  created:
    - src/utils/serviceLockDiff.ts
    - src/utils/__tests__/serviceLockDiff.test.ts
  modified: []

key-decisions:
  - "type-only `import type { ServiceSnapshot } from '@/stores/services'` keeps the util pure — the import is erased at compile time, so no Pinia/Firestore loads at test time and no local structural mirror was needed"
  - "refKey switches on ref.kind and coalesces optional leaves to '' so a missing field is stable; a default arm guards future SourceRef members"
  - "SONG detection matches by stable slot id; slot add/remove folded inside the pure diff (SONG+ORDER for a SONG slot, ORDER only otherwise)"

patterns-established:
  - "Change-detection hash: sort a COPY of slides by .order, join refKeys, DJB2 — order-independent on input, order-sensitive on .order"
  - "R147 team tagging: broad = current-snapshot groups with personNames.length > 0; ROLE narrow = exactly [changed role's group]"

requirements-completed: [R146, R147]

coverage:
  - id: D1
    description: "fingerprintSlideGroups returns a deterministic { [slotId]: hash } map over each in-service group's ordered sourceRef identities (add/remove/reorder/authored-edit/song-swap sensitive; serviceId-filtered; empty-group stable); limitation A1 documented"
    requirement: R146
    verification:
      - kind: unit
        ref: "src/utils/__tests__/serviceLockDiff.test.ts#fingerprintSlideGroups"
        status: pass
    human_judgment: false
  - id: D2
    description: "diffServiceSnapshots is pure and returns ChangeEntry[] detecting SONG/ORDER/ROLE/NOTES/SLIDES (slot add/remove folded in), returning [] on identical inputs"
    requirement: R146
    verification:
      - kind: unit
        ref: "src/utils/__tests__/serviceLockDiff.test.ts#diffServiceSnapshots"
        status: pass
    human_judgment: false
  - id: D3
    description: "affectedTeams follows R147 exactly — ROLE tags only the changed role's group; SONG/ORDER/NOTES/SLIDES tag broad = current groups with >=1 assigned person"
    requirement: R147
    verification:
      - kind: unit
        ref: "src/utils/__tests__/serviceLockDiff.test.ts#diffServiceSnapshots > detects a ROLE change and tags EXACTLY that role's group (narrow, never broad)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/serviceLockDiff.test.ts#diffServiceSnapshots > tags broad entries (SONG) with only groups that have >=1 assigned person on the CURRENT snapshot"
        status: pass
    human_judgment: false
  - id: D4
    description: "ChangeEntry and SlideFingerprint are exported for 62-03 (modal) and 62-04 (lock hook) to import"
    requirement: R146
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build) — clean"
        status: pass
    human_judgment: false

# Metrics
duration: 8 min
completed: 2026-08-14
status: complete
---

# Phase 62 Plan 02: Pure Service-Lock Diff + Slide Fingerprint Summary

**A pure, dependency-free `serviceLockDiff.ts` — DJB2 `fingerprintSlideGroups` over ordered sourceRef identities and `diffServiceSnapshots` returning typed `ChangeEntry[]` (SONG/ORDER/ROLE/NOTES/SLIDES) with R147 narrow/broad team tagging — proven by 26 mock-free fixture tests.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-14T21:33Z
- **Completed:** 2026-08-14T21:41Z
- **Tasks:** 2 (each TDD: RED test → GREEN feat)
- **Files modified:** 2 (both created)

## Accomplishments
- `fingerprintSlideGroups(groups, serviceId)` — deterministic `{ [slotId]: hash }` map. Sorts a COPY of each in-service group's slides by `.order`, serializes each entry's `sourceRef` identity via a `refKey` switch covering every SourceRef member (lyric/copyright/scripture/imported/text/video), joins, and DJB2-hashes. Order-independent on the input array and pre-sort slides order; order-sensitive on `.order`. Limitation A1 (a live lyric-text edit to an unchanged song is NOT flagged) documented in a module comment.
- `diffServiceSnapshots(prev, curr, prevFp, currFp)` — pure `ChangeEntry[]`. SONG/ORDER matched by stable slot `id` (never index/position); slot add/remove folded in (SONG+ORDER for a SONG slot, ORDER only for a non-SONG slot); ROLE by order-insensitive `personNames` compare; NOTES by string inequality; SLIDES by fingerprint-map diff (null treated as empty map). Identical inputs → `[]`.
- R147 team tagging: `broad` = distinct current-snapshot groups with `personNames.length > 0`; a ROLE entry tags exactly `[cur.group]` and never falls back to broad.
- `ChangeEntry` and `SlideFingerprint` exported for the 62-03 modal and 62-04 lock hook.

## Task Commits

Each task was TDD (RED test → GREEN feat), committed atomically:

1. **Task 1 RED: fingerprint tests** - `d3471da` (test)
2. **Task 1 GREEN: fingerprintSlideGroups + SlideFingerprint** - `475fec0` (feat)
3. **Task 2 RED: diff tests** - `d5eaf65` (test)
4. **Task 2 GREEN: diffServiceSnapshots + ChangeEntry** - `556a4e8` (feat)

_Note: the Task 2 GREEN commit also carries two `diff[0]!` non-null assertions in the test file (see Deviations)._

## Files Created/Modified
- `src/utils/serviceLockDiff.ts` - Pure diff + fingerprint module; exports `ChangeEntry`, `SlideFingerprint`, `fingerprintSlideGroups`, `diffServiceSnapshots`. Type-only imports of `SlideGroup`/`GroupSlideEntry`/`SourceRef`, `RoleGroup`, `ServiceSnapshot`.
- `src/utils/__tests__/serviceLockDiff.test.ts` - 26 plain-fixture tests (no Firestore/Pinia mocking): 10 fingerprint + 16 diff.

## Decisions Made
- Imported `ServiceSnapshot` from `@/stores/services` via `import type` rather than defining a local structural mirror. `import type` is erased at compile time, so the store (and its Pinia/Firestore imports) never loads at runtime or test time — the util stays pure and the tests stay mock-free. This is the lightest option that keeps the diff input shape in lockstep with what `buildServiceSnapshot` persists.
- `refKey` uses an explicit `switch (ref.kind)` with a `default` exhaustiveness guard so a future SourceRef member fails visibly rather than silently hashing to the same value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Non-null assertions on indexed diff entries in the test**
- **Found during:** Task 2 (GREEN)
- **Issue:** `npm run type-check` (vue-tsc --build, which typechecks the test file) flagged `diff[0].affectedTeams` as `TS2532: Object is possibly 'undefined'` in two ROLE/broad assertions — `noUncheckedIndexedAccess` is on.
- **Fix:** Changed `diff[0].affectedTeams` to `diff[0]!.affectedTeams` in the two affected assertions; the preceding `typesOf(diff)` assertions already prove length.
- **Files modified:** src/utils/__tests__/serviceLockDiff.test.ts
- **Verification:** `npm run type-check` clean; 26/26 tests still pass.
- **Committed in:** 556a4e8 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Test-only type-annotation fix required by the project's `vue-tsc --build` gate. No production-code or scope change.

## Issues Encountered
None.

## Gate Results
- `npx vitest run src/utils/__tests__/serviceLockDiff.test.ts` → **26 passed (10 fingerprint + 16 diff)**.
- `npm run type-check` (vue-tsc --build) → **clean** (no output).
- `npx vitest run` (full app suite, ~267s) → **113 passed / 2 failed files** — exactly the CLAUDE.md known-failing baseline (`src/storage.rules.test.ts` env limitation, `src/views/__tests__/RosterView.test.ts` stale assertion). No other file regressed.

## User Setup Required
None - no external service configuration required. The module is pure and needs no `.env.local`.

## Next Phase Readiness
- `ChangeEntry` and `SlideFingerprint` are exported and proven in isolation — 62-03 (modal) and 62-04 (lock hook) can import the contract directly.
- 62-04's lock hook can call `fingerprintSlideGroups` on every lock, replacing the Phase 61 `slideGroupsFingerprint: null` stub, and feed prev/curr snapshots + fingerprints into `diffServiceSnapshots`.
- No blockers.

## Self-Check: PASSED
- `src/utils/serviceLockDiff.ts` — FOUND
- `src/utils/__tests__/serviceLockDiff.test.ts` — FOUND
- Commits `d3471da`, `475fec0`, `d5eaf65`, `556a4e8` — all present in git log

---
*Phase: 62-relock-change-notice-scoped-diff*
*Completed: 2026-08-14*
