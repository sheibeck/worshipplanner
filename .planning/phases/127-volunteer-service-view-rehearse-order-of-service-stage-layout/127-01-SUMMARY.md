---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
plan: 01
subsystem: rehearse-access-projection
tags: [firestore, projection, services-store, rehearse-access, pii-allowlist]

# Dependency graph
requires:
  - phase: 125-02
    provides: "buildRehearseAccess() pure projection builder (src/utils/rehearseAccess.ts) + lock-time write/reopen-delete lifecycle"
  - phase: 126
    provides: "My Schedule store/route that will resolve orgId for the standalone volunteer service view"
provides:
  - "src/utils/serviceProjection.ts — shared, store-free per-kind slot allowlist (mapSlotAllowlist/mapOrderedSlots) and stage-marker allowlist (mapStageMarkerAllowlist/mapStageMarkers), called by BOTH buildServiceSnapshot and buildRehearseAccess"
  - "RehearseAccessDoc extended with orderOfService (ServiceSlot[]), roleAssignments (RehearseRoleAssignment[]), stageLayout? ({elements: PublicStageMarker[]}), and RehearseSong.bpm"
  - "Confirmation (not a rules change) that firestore.rules' get arm on rehearseAccess/{serviceId} already grants the whole extended document to an assigned, email_verified volunteer"
affects: ["127-02", "127-03", "127-04", "127-05", "127-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared, store-free allowlist helper in src/utils/ (serviceProjection.ts) called by two different builders (one store-coupled, one pure) so a PII-safe field-allowlist can never drift between the public share-link path and a new internal projection path — the caller supplies a resolver callback for anything that needs store data (SONG bpm), the helper itself never imports Pinia/Firestore."
    - "A shared marker-allowlist function returns the PublicStageMarker shape (note stripped) unconditionally; the one caller that still needs `note` on its own return (buildServiceSnapshot, for the org-internal re-lock diff) re-attaches it on top of the shared function's output rather than the helper taking an 'include note' flag — keeps the shared function's contract (\"this is the public-safe shape\") unambiguous."

key-files:
  created:
    - src/utils/serviceProjection.ts
  modified:
    - src/utils/rehearseAccess.ts
    - src/utils/rehearseAccess.test.ts
    - src/stores/services.ts
    - src/utils/myScheduleGrouping.test.ts
    - src/views/__tests__/MyScheduleView.test.ts

key-decisions:
  - "orderOfService/roleAssignments are REQUIRED (non-optional) fields on RehearseAccessDoc — an empty array is the valid zero-slot/zero-assignment representation, matching the existing songs[]/assignedEmailsLower convention on the same doc. stageLayout stays OPTIONAL and is conditionally spread (never a literal undefined), matching buildServiceSnapshot's existing stageLayout?.length omission pattern exactly."
  - "Only the per-kind slot switch and the stage-marker map were extracted into the shared serviceProjection.ts helper — roleAssignments was intentionally NOT extracted into a shared function. Both buildServiceSnapshot and buildRehearseAccess already compute roleAssignments from resolveServiceRoleAssignments() + a local nameById Map with the identical 4-field shape ({roleId, roleName, group, personNames}); this is a simple field-pick with no notes/free-text to strip, so the drift risk a shared helper protects against for slots/stage-markers doesn't apply here, and the plan's own key_links only names the slot and stage-marker allowlists as the shared surface."
  - "bpm resolution for buildRehearseAccess's orderOfService and songs[] both go through the already-loaded songsById map (no useSongStore) — buildServiceSnapshot's equivalent resolution stays store-coupled (useSongStore() inside the callback it passes to the shared slot mapper) since it is NOT a pure function and already reads three other Pinia stores."
  - "RehearseSong.bpm is now ALWAYS present (number or null), including on the IN-02 missing-catalog-song stub (bpm: null) — the must-have requires bpm resolve gracefully for every song entry, not merely the ones with a live catalog match."

patterns-established:
  - "Any future PII-safe projection extension that needs the same slot/stage-marker allowlist buildServiceSnapshot already enforces should import mapOrderedSlots/mapStageMarkers from src/utils/serviceProjection.ts rather than writing a third copy of the switch/map body."

requirements-completed: []

coverage:
  - id: D1
    description: "orderOfService carries the EXACT per-kind allowlist buildServiceSnapshot enforces (SONG/SCRIPTURE/HYMN/IMPORTED/PRAYER/MESSAGE/ANNOUNCEMENTS/MISC + the defensive default stand-in for an out-of-union runtime kind), section-ordered, with zero per-slot notes/body reaching the array"
    requirement: "R392 (data foundation only — UI consumption lands in 127-04)"
    verification:
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts (18 tests, all passing) — 'orderOfService lists every slot kind...' and 'a slot with a runtime kind outside the compile-time union...' cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "roleAssignments carries roleId/roleName/group/personNames only — no personId, no email"
    requirement: "R392 (data foundation only)"
    verification:
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts — 'roleAssignments carries names-only...' case"
        status: pass
    human_judgment: false
  - id: D3
    description: "stageLayout is absent (key not present) for zero markers, and note-stripped/clamped for present markers"
    requirement: "R393 (data foundation only — UI consumption lands in 127-04)"
    verification:
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts — 'stageLayout is absent...' and 'stageLayout strips the free-text marker note...' cases"
        status: pass
    human_judgment: false
  - id: D4
    description: "bpm resolves via arrangement-matching-songKey, falls back to the first arrangement, else null — for every song entry including the missing-catalog-song stub"
    requirement: "R385/R386 (data foundation only — UI consumption lands in 127-02)"
    verification:
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts — 'resolves bpm to the arrangement matching the slot key...' and the updated IN-02 stub case"
        status: pass
    human_judgment: false
  - id: D5
    description: "buildServiceSnapshot's output is byte-identical after the shared-helper extraction — no public share-link regression"
    requirement: "n/a (regression guard)"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts (112 tests), services.stageLayout.test.ts (9 tests), services.sharePii.test.ts (5 tests) — all 126 passing unchanged"
        status: pass
    human_judgment: false
  - id: D6
    description: "No firestore.rules change is needed — the existing get arm still grants the whole extended rehearseAccess document to an assigned, email_verified volunteer"
    requirement: "R377 (regression guard)"
    verification:
      - kind: integration
        ref: "npx vitest run --config vitest.rules.config.ts -t \"R377\" (12/12 emulator cases green, against a live Firestore emulator); firestore.rules file untouched by this plan (git diff confirms zero changes)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-06
status: complete
---

# Phase 127 Plan 01: rehearseAccess Projection Extension (Data Foundation) Summary

**Extended `buildRehearseAccess` with `orderOfService`/`roleAssignments`/`stageLayout`/`bpm` by extracting `buildServiceSnapshot`'s per-kind slot and stage-marker PII allowlists into a shared, store-free `src/utils/serviceProjection.ts` module both builders now call — no second hand-rolled allowlist, zero `firestore.rules` change, `buildServiceSnapshot`'s output byte-identical.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Created `src/utils/serviceProjection.ts`: a pure, store-free module exporting `mapSlotAllowlist`/`mapOrderedSlots` (the exact per-kind switch body from `buildServiceSnapshot`, including the defensive `{id,kind,position}` stand-in for an out-of-union runtime slot kind) and `mapStageMarkerAllowlist`/`mapStageMarkers` (the stage-marker field-allowlist returning the `PublicStageMarker` shape, note always stripped).
- Refactored `buildServiceSnapshot` (`src/stores/services.ts`) to call these shared helpers — its own return still re-attaches `note` on top of the shared stage-marker allowlist (needed by the org-internal `lockSnapshots/current` re-lock diff), keeping its output byte-identical to before the refactor. Verified via the full `services.test.ts`/`services.stageLayout.test.ts`/`services.sharePii.test.ts` suites (126 tests, all green, unchanged).
- Extended `RehearseAccessDoc` (`src/utils/rehearseAccess.ts`) with `orderOfService: ServiceSlot[]`, `roleAssignments: RehearseRoleAssignment[]`, `stageLayout?: { elements: PublicStageMarker[] }`, and `RehearseSong.bpm?: number | null`. All three new arrays/objects are built from the SAME allowlist `buildServiceSnapshot` enforces (via the shared `serviceProjection.ts` helpers) or the same name-only pattern already established for `songs[]`/`assignedEmailsLower` on this doc.
- Extended `src/utils/rehearseAccess.test.ts` from 12 to 18 tests: updated the exact-key-set assertion and the IN-02 stub's exact-object assertion for the new fields, and added 6 new cases proving no free-text leak (per-slot notes/body, stage-marker note), no personId/email leak on `roleAssignments`, the runtime-unknown-slot-kind defensive stand-in, and bpm's three-way resolution (match / fallback / null).
- Confirmed (Task 2) that `markAsPlanned`'s lock-time write needs zero code change — its existing `{ ...rehearseAccess, updatedAt: serverTimestamp() }` spread already carries whatever `buildRehearseAccess` returns, and `stageLayout`'s conditional spread keeps the key absent (never a literal `undefined`) for a zero-marker service. Added an in-file comment documenting this and that `firestore.rules`' `get` arm on `rehearseAccess/{serviceId}` already grants the whole document (confirmed by direct rule read AND by re-running the R377 emulator suite — 12/12 green — against the extended doc). No `firestore.rules` file was touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared PII-safe allowlist helper and extend buildRehearseAccess with orderOfService, roleAssignments, stageLayout, and bpm** - `75f2218d` (feat)
2. **Task 2: Confirm lock-time write persists the new fields and no firestore.rules change is required** - `374eb030` (docs)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/utils/serviceProjection.ts` - New. `mapSlotAllowlist`/`mapOrderedSlots`, `mapStageMarkerAllowlist`/`mapStageMarkers` — the single shared, store-free PII-safe allowlist both projection builders call.
- `src/utils/rehearseAccess.ts` - `RehearseSong.bpm`; `RehearseAccessDoc.orderOfService`/`.roleAssignments`/`.stageLayout?`; new `RehearseRoleAssignment` interface.
- `src/utils/rehearseAccess.test.ts` - Extended 12 → 18 tests: updated key-set/IN-02 assertions for the new fields, added 6 new no-leak/defensive/bpm-resolution cases.
- `src/stores/services.ts` - `buildServiceSnapshot` refactored to call the shared helpers (byte-identical output); `markAsPlanned`'s rehearseAccess write site documents the schema growth + confirms no rules change needed.
- `src/utils/myScheduleGrouping.test.ts` - Deviation fix: added the two new required `RehearseAccessDoc` fields to the fixture builder.
- `src/views/__tests__/MyScheduleView.test.ts` - Deviation fix: same fixture-builder fix as above.

## Decisions Made
- `orderOfService`/`roleAssignments` are required (non-optional) fields; `stageLayout` stays optional with a conditional spread, mirroring `buildServiceSnapshot`'s own `stageLayout?.length`-gated omission exactly.
- `roleAssignments` was intentionally NOT factored into `serviceProjection.ts` — it's a simple 4-field pick with no free-text to strip (unlike the slot/stage-marker allowlists), and the plan's own `key_links` only names those two as the shared surface.
- `RehearseSong.bpm` is always present (never omitted), including `null` on the IN-02 missing-catalog-song stub, so the meta-line join downstream can graceful-omit a genuinely-null value rather than encounter an undefined key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Fixed two Phase 126 test fixtures broken by RehearseAccessDoc's new required fields**
- **Found during:** `npm run type-check` (the CLAUDE.md-mandated full gate, which type-checks test files)
- **Issue:** `src/utils/myScheduleGrouping.test.ts` and `src/views/__tests__/MyScheduleView.test.ts` each have a local `makeDoc()`/fixture builder that constructs a `RehearseAccessDoc`/`MyScheduleDoc`-shaped object without the new `orderOfService`/`roleAssignments` fields, now required by the type extension this plan makes.
- **Fix:** Added `orderOfService: []` and `roleAssignments: []` to both fixture builders — an empty array is a legitimate default for these test suites, which don't exercise Order of Service/Who's Serving rendering.
- **Files modified:** `src/utils/myScheduleGrouping.test.ts`, `src/views/__tests__/MyScheduleView.test.ts`
- **Verification:** `npm run type-check` clean; both files' suites still pass in the full `npx vitest run` run (5322/5357 tests passing, only the documented `storage.rules.test.ts` baseline failing).
- **Committed in:** `75f2218d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — a blocking type-check failure in two pre-existing test fixtures, caused directly by this plan's legitimate type extension).
**Impact on plan:** No scope creep — the fix is a mechanical 2-line addition to each fixture builder's default object, not new logic.

### Requirement-tracking note (not a deviation, a deliberate omission)

This plan's frontmatter lists `requirements: [R385, R386, R392, R393]`, but **none were marked complete in `REQUIREMENTS.md`**. All four are UI-facing requirements (Rehearse tab rendering, Order of Service tab, Stage Layout tab) whose user-visible behavior is delivered by `127-02`/`127-03`/`127-04` (wave 2, which this plan's data foundation unblocks) — `127-02`'s and `127-04`'s own frontmatter list the same requirement IDs, and `ROADMAP.md`'s phase-127 plan bullets attribute them the same way. Marking these complete after only the data-foundation plan (127-01, which ships no volunteer-visible UI) would falsely show a checked box in `REQUIREMENTS.md`'s traceability table while a volunteer still sees nothing. Leaving them unchecked until the plan that actually delivers the rendering (127-02/127-04) is a deliberate accuracy call, not an oversight.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None — no external service configuration required (application code + tests only; no Firebase console changes, no new environment variables).

## Next Phase Readiness
- `RehearseAccessDoc` now carries everything Plans 02–06 need to render the Rehearse/Order of Service/Stage Layout tabs from a single `getDoc` — no further projection-shape work should be needed for the rest of Phase 127.
- `npm run type-check` is clean. `npx vitest run` (full app suite): 201/202 files, 5322/5357 tests passing — the sole failing file is the pre-existing, documented `src/storage.rules.test.ts` baseline (Storage-emulator-dependent, unrelated to this plan).
- `npx vitest run --config vitest.rules.config.ts -t "R377"` — all 12 R377 emulator cases pass against a running Firestore emulator, confirming the extended doc needs zero `firestore.rules` change.
- Plans 02 (Rehearse song list/detail), 03 (PDF reader/audio player), 04 (Order of Service/Stage Layout tabs), and 05/06 (view shell/route) can now consume the extended `RehearseAccessDoc` type with no further store/util changes.
- No blockers.

---
*Phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/utils/serviceProjection.ts
- FOUND: src/utils/rehearseAccess.ts
- FOUND: src/utils/rehearseAccess.test.ts
- FOUND: src/stores/services.ts
- FOUND: src/utils/myScheduleGrouping.test.ts
- FOUND: src/views/__tests__/MyScheduleView.test.ts
- FOUND: .planning/phases/127-volunteer-service-view-rehearse-order-of-service-stage-layout/127-01-SUMMARY.md
- FOUND commit: 75f2218d
- FOUND commit: 374eb030
