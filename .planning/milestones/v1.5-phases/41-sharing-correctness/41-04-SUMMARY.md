---
phase: 41-sharing-correctness
plan: 04
subsystem: sharing
tags: [firestore, share-tokens, pinia, autosave, refresh-hook]

# Dependency graph
requires:
  - phase: 41-sharing-correctness
    provides: "Plan 03's buildServiceSnapshot, writeSharePayload, ensureShareLink, shareLinkCache in src/stores/services.ts"
provides:
  - "src/stores/services.ts — maybeRefreshShareLink(id, overrides?): Promise<void>, hooked into updateService, setRoleOverride and clearRoleOverride"
  - "A previously-shared service's public payload (shareTokens/{token} and serviceShares/{slug}...) now follows the current plan and role overrides automatically, on every save"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Refresh-on-write hook pattern: a soft-fail (WR-06) internal function called after a write lands, using a per-session Map<string, string|false> cache to short-circuit both the write and the read once a service is known unshared"
    - "Local pre-write-state merge (overrides argument) to defeat test-double staleness when onSnapshot never fires under a mocked SDK"

key-files:
  created: []
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "maybeRefreshShareLink calls writeSharePayload only, never ensureShareLink — structurally incapable of taking the adopt-or-create branch, so an ordinary edit to a never-shared service can never publish it"
  - "Only three write paths are hooked (updateService, setRoleOverride, clearRoleOverride); markAsPlanned/reopenService (status-only, ShareView never renders status), deleteService (deleteDoc, not a refresh trigger) and createService (nothing to refresh) are deliberately excluded and documented in-code"
  - "On any refresh error, the service is marked false in shareLinkCache for the remainder of the session (T-41-13) rather than retried on every keystroke — a page reload clears the cache"
  - "setRoleOverride/clearRoleOverride build the next roleAssignmentOverrides map locally (not read back from Firestore) because maybeRefreshShareLink's overrides argument must be a real JS object, not a Firestore dot-path key or deleteField() sentinel"

patterns-established:
  - "Testing WR-06 soft-fail across two independent store actions requires two SEPARATE Pinia instances, not a shared one across both assertions — after the first failure, shareLinkCache caches false for that service and a second refresh attempt on the same store instance short-circuits before calling setDoc or console.error again (the T-41-13 guard working as designed, not a test bug)"

requirements-completed: [R077]

coverage:
  - id: D1
    description: "updateService, setRoleOverride and clearRoleOverride refresh the shared payload with the NEW data after their write lands, so a previously-shared service's public view follows the plan and role overrides without a second Share press"
    requirement: "R077"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > updateService refreshes the payload with the new data (ROADMAP criterion 2)"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > setRoleOverride refreshes the payload with the new override (R077)"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > clearRoleOverride refreshes the payload back to the schedule, with no sentinel leaking through"
        status: pass
    human_judgment: false
  - id: D2
    description: "The refresh writes ONLY to shareTokens/{token} and serviceShares/{shareId} and never back to organizations/{orgId}/services/{docId} — proven as the absence of a write-back, not merely the presence of the forward writes"
    requirement: "R077"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > T-41-02: the only services write is the user's own save"
        status: pass
    human_judgment: false
  - id: D3
    description: "The PII guard (personNames only, no email/phone/pcPersonId) holds on the REFRESH path, not only the create path"
    requirement: "R077"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > T-41-03: the PII guard holds on the REFRESH path (ROADMAP criterion 5)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Empty-slots/empty-roster, idempotency and single-write-atomicity edges all behave: an empty service writes a valid empty snapshot without throwing; two consecutive refreshes with no intervening change write identical serviceSnapshot content; exactly one setDoc targets each of shareTokens and serviceShares per refresh"
    requirement: "R077"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > empty-service edge"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > idempotency edge"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > single-write / atomicity edge"
        status: pass
    human_judgment: false
  - id: D5
    description: "An unshared service pays at most one Firestore lookup per session and is never published by an ordinary edit — the negative cache short-circuits every subsequent refresh attempt, and the refresh never reaches ensureShareLink's create/transaction branch"
    requirement: "R077"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > an unshared service pays nothing per write"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > an ordinary edit never creates a share link"
        status: pass
    human_judgment: false
  - id: D6
    description: "A failed refresh is logged and swallowed (WR-06) — updateService and setRoleOverride both still resolve when the refresh's write rejects, so a share problem never fails the user's save"
    requirement: "R077"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > soft-fail (WR-06): a rejected refresh write still lets updateService resolve, and logs console.error"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > soft-fail (WR-06): a rejected refresh write still lets setRoleOverride resolve, and logs console.error"
        status: pass
    human_judgment: false
  - id: D7
    description: "markAsPlanned and reopenService are status-only transitions that deliberately do NOT trigger a refresh, locking in the exclusion so a future 'cover every write for consistency' change turns a test red instead of quietly widening the write surface"
    requirement: "R077"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#share-link auto-refresh (R077) > status-only transitions (markAsPlanned, reopenService) do NOT refresh the share payload"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-07
status: complete
---

# Phase 41 Plan 04: Auto-Refresh the Shared Payload on Every Service Edit Summary

**`maybeRefreshShareLink(id, overrides?)` hooked into `updateService`, `setRoleOverride` and `clearRoleOverride` so a previously-shared service's public snapshot — including role overrides — stays current after every save, with zero write-back to the service document, a soft-fail that never breaks the user's save, and a per-session cache so an unshared service costs nothing extra.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-07
- **Tasks:** 2
- **Files modified:** 2 (`src/stores/services.ts`, `src/stores/__tests__/services.test.ts`)

## Accomplishments
- `maybeRefreshShareLink(id, overrides = {})`: resolves the existing `serviceShareLinks/{id}` token (cached after first lookup), merges the caller's `overrides` over the local pre-write service state (needed because the test suite's mocked SDK never fires `onSnapshot`), and calls `writeSharePayload` — never `ensureShareLink` — so the refresh path is structurally incapable of publishing a never-shared service.
- Wired into exactly three write paths: `updateService` (which also covers `assignSongToSlot`, `clearSongFromSlot`, the editor's autosave and slot reorder — all route through it), `setRoleOverride`, and `clearRoleOverride`. `markAsPlanned`, `reopenService`, `deleteService` and `createService` are deliberately NOT hooked, with the reasoning recorded in-code.
- `setRoleOverride`/`clearRoleOverride` each build a local `roleAssignmentOverrides` map (their existing map plus the new value, or with the cleared key genuinely deleted — never the `deleteField()` sentinel) to pass as the hook's `overrides` argument.
- WR-06 soft-fail: the entire hook body is one try/catch; on error, `console.error` is called and the service is marked `false` in `shareLinkCache` for the rest of the session (T-41-13) so a pre-deploy denial produces one logged failure per service, not one per keystroke.
- 13 new tests in `describe('share-link auto-refresh (R077)', ...)`: refresh-with-new-data for all three write paths, T-41-02 no-write-back, T-41-03 PII guard on the refresh path, empty-service/idempotency/single-write-atomicity edges, unshared-service-pays-nothing, ordinary-edit-never-creates-a-link, WR-06 soft-fail (split into two independent cases — see Decisions), and status-only-transitions-do-not-refresh. 64 baseline + 13 new = 77, 0 failing.
- Source-level acceptance checks all hold exactly as specified: `grep -c 'maybeRefreshShareLink'` = 4 (1 definition + 3 call sites); the three call sites are inside `updateService`/`setRoleOverride`/`clearRoleOverride` and none inside `markAsPlanned`/`reopenService`/`deleteService`; the definition references `writeSharePayload` and zero references to `ensureShareLink`; `grep -c 'console.error'` increased by exactly 1 (1 -> 2); `orderBy(` stays at 1 and `limit(` stays at 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add maybeRefreshShareLink and wire it into updateService, setRoleOverride and clearRoleOverride** - `6a35fbc` (feat)
2. **Task 2: Prove the refresh follows the plan and the overrides, writes back nowhere, and keeps the PII guard** - `6628341` (test)

## Files Created/Modified
- `src/stores/services.ts` - Added `maybeRefreshShareLink(id, overrides?): Promise<void>` below `ensureShareLink`; hooked into `updateService` (after its `updateDoc`), `setRoleOverride` and `clearRoleOverride` (each after their own scoped `updateDoc`, building a local merged override map first).
- `src/stores/__tests__/services.test.ts` - New `describe('share-link auto-refresh (R077)', ...)` block, 13 cases.

## Decisions Made
- Split the WR-06 soft-fail test into two independent `it()`s, each with its own fresh Pinia instance (`setActivePinia(createPinia())`), rather than one test proving both `updateService` and `setRoleOverride` resolve after a rejected write. Reason: after the first refresh failure, `shareLinkCache` deliberately caches `false` for that service (T-41-13) — a second refresh attempt on the SAME store instance would short-circuit before ever calling `setDoc` or `console.error` again, which is correct production behavior but would make a shared-store version of the test pass or fail for the wrong reason.
- Renamed the refresh hook's `console.error` prefix from a literal `maybeRefreshShareLink:` to `services.ts share-link auto-refresh:` so the acceptance criterion's `grep -c 'maybeRefreshShareLink'` count (expected 4: definition + 3 call sites) is not inflated by the error string itself, while still satisfying the house convention of "a prefix naming this module and this operation."
- `writeSharePayload`'s existing WR-06 catch (from Plan 03) was left untouched; `maybeRefreshShareLink` has its own separate try/catch one level up, so a rejected `writeSharePayload` call (either its primary `shareTokens` write or its already-soft-failed `serviceShares` write) is caught once, correctly, without double-logging.

## Deviations from Plan

None - plan executed exactly as written. All source-level acceptance criteria (grep counts, call-site locations, `writeSharePayload`-not-`ensureShareLink`) hold exactly as specified.

## Issues Encountered

None beyond the WR-06 test-isolation nuance documented above under Decisions Made (caught before it caused a false pass, not a defect that shipped).

**Environment observation, not a defect in this plan's scope:** the phase-gate `npm run test:rules` hit "port taken" because an emulator was already running (per CLAUDE.md's documented fallback), so `npx vitest run --config vitest.rules.config.ts` was used directly against it instead. Against that emulator session, `src/storage.rules.test.ts` passed all 14 cases (0 failing) rather than the 2 documented allow-case failures — this is a more-complete pass, not a regression, and is outside `storage.rules`/`storage.rules.test.ts`'s ownership (neither file was touched by this plan; `git diff --name-only` from phase start confirms `storage.rules` was never touched across all of Phase 41). Most likely explanation: Phase 40's custom-claims work (recent commits `4466460`/`88c045a`/`bda074d`) already resolved the underlying `firestore.exists()`-in-Storage-emulator limitation in this emulator session. Not investigated further — out of this plan's file scope.

## User Setup Required

None - no external service configuration required. This plan's code, like Plan 01-03's, is inert against production Firestore until the owner runs `firebase deploy --only firestore:rules` (Plan 01's loosened `shareTokens` update rule and new `serviceShareLinks` block) — until then every refresh in production is denied server-side, logged by the soft-fail catch, and swallowed. Saves keep working. This is expected and already recorded in `.planning/PENDING-VERIFICATION.md` by Plan 01.

**Owner deploy handoff (restated, unchanged from Plan 01):** `firebase deploy --only firestore:rules`, which must land before or with any hosting deploy of Phase 41's app code, because until it does every refresh is denied in production.

## Next Phase Readiness

Phase 41 (Sharing Correctness) is now code-complete across all 4 plans:
- Plan 01: `firestore.rules` loosened for `shareTokens`, new `serviceShareLinks` CRUD block — undeployed.
- Plan 02: `mintShareToken`/`pickAdoptableToken`/`shareTokenCreatedAtMillis` pure utilities.
- Plan 03: `ensureShareLink` resolves ONE stable token per service (steady-state / adopt / mint), `buildServiceSnapshot`/`writeSharePayload` extracted, `createShareToken` retained as a thin wrapper.
- Plan 04 (this plan): the refresh-on-edit hook closing R077's remaining half.

Both suites and the type-check gate are green together against the documented baseline (`git diff --name-only` from phase start lists exactly `firestore.rules`, `src/rules.test.ts`, `src/utils/shareTokens.ts`, `src/utils/__tests__/shareTokens.test.ts`, `src/stores/services.ts`, `src/stores/__tests__/services.test.ts`, and the expected `.planning/` docs — no view, component, or `storage.rules` file was touched). `firebase deploy` appears nowhere in this phase's command history. The only remaining action is the owner's rules deploy.

---
*Phase: 41-sharing-correctness*
*Completed: 2026-08-07*

## Self-Check: PASSED

- FOUND: src/stores/services.ts
- FOUND: src/stores/__tests__/services.test.ts
- FOUND: .planning/phases/41-sharing-correctness/41-04-SUMMARY.md
- FOUND: 6a35fbc
- FOUND: 6628341
