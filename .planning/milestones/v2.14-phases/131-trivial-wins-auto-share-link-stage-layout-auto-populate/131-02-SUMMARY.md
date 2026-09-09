---
phase: 131-trivial-wins-auto-share-link-stage-layout-auto-populate
plan: 02
subsystem: services
tags: [firestore, share-links, emulator-seed, vue, pinia]

# Dependency graph
requires: []
provides:
  - "markAsPlanned fail-closed ensureShareLink self-heal (R421 safety net)"
  - "seeded emulator service carries a real shareTokens/serviceShareLinks token pair"
affects: [131-01, volunteer-messaging, share-view, emulator-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed side-write sibling pattern inside markAsPlanned's `if (service)` block (mirrors the existing rehearseAccess catch)"
    - "Deterministic sha256-derived 36-hex token for idempotent dev-seed data (no crypto randomness needed for a script that must be identical on re-run)"

key-files:
  created: []
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts
    - functions/seed-emulator-data.mjs

key-decisions:
  - "Kept createService's creation-time mint verbatim per the owner's 2026-09-07 resolved scope; markAsPlanned's ensureShareLink call is a pure addition, not a replacement."
  - "Used ensureShareLink (idempotent), never maybeRefreshShareLink (refresh-only by contract), for the self-heal."
  - "Seed token is deterministic (sha256(serviceId).slice(0,36)) rather than random, so re-seeding the emulator overwrites the same shareTokens/serviceShareLinks docs instead of accumulating orphans."
  - "Seed serviceSnapshot follows the plan's explicit public-field list (name/date/progression/slots/sermonPassage/sermonTopic) rather than the full ServiceSnapshot TS shape — the seed script is a standalone .mjs (functions cannot import the client src/ tree) so it does not type-check against ServiceSnapshot."

requirements-completed: [R421]

coverage:
  - id: D1
    description: "markAsPlanned self-heals a tokenless service via a fail-closed ensureShareLink call, sibling to the existing rehearseAccess side-write; createService's creation-time mint is retained unchanged."
    requirement: "R421"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#R421: markAsPlanned self-heals a tokenless service by minting a share link"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#auto-generates a share link at creation so every service has one (owner UAT 2026-08-17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A lock/reopen/relock cycle yields exactly one share token — no duplicate mint on repeat markAsPlanned calls."
    requirement: "R421"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#R421: a lock/reopen/relock cycle yields exactly one share token (idempotent self-heal)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A share-link self-heal failure inside markAsPlanned is fail-closed — logged, swallowed, and never blocks the already-succeeded status transition."
    requirement: "R421"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#R421: a share-link self-heal failure inside markAsPlanned does not block the status transition"
        status: pass
    human_judgment: false
  - id: D4
    description: "functions/seed-emulator-data.mjs mints a deterministic real share token (serviceShareLinks identity doc + shareTokens payload doc) for the seeded service, so emulator test data matches real UI-created data."
    requirement: "R421"
    verification:
      - kind: other
        ref: "node --check functions/seed-emulator-data.mjs && grep -q serviceShareLinks functions/seed-emulator-data.mjs && grep -q shareTokens functions/seed-emulator-data.mjs"
        status: pass
    human_judgment: true
    rationale: "The seed script requires the local Firebase emulators running to execute end-to-end (Admin SDK write); this plan verified it statically (parses cleanly, writes are present, idempotent-by-construction via deterministic ids). An owner or future session running `node functions/seed-emulator-data.mjs` against live emulators is the natural full confirmation."

# Metrics
duration: 20min
completed: 2026-09-07
status: complete
---

# Phase 131 Plan 2: Trivial Wins — Auto Share-Link Summary

**Fail-closed `ensureShareLink` self-heal added to `markAsPlanned` (createService's mint kept unchanged), plus a deterministic share-token pair minted in the emulator seed script, so no service — real or seeded — is ever missing its share link without a manual click.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-07T13:16:07Z
- **Completed:** 2026-09-07T13:32:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `markAsPlanned` now calls `ensureShareLink({ ...service, status: 'planned' }, orgId.value)` in its own fail-closed try/catch, sibling to the existing `rehearseAccess` projection write — any tokenless service self-heals a share link at the Planned/lock transition, with no manual "Share Link" click.
- `createService`'s 2026-08-17 creation-time mint is untouched — new services still get a link at creation, so the `{{service_link}}` volunteer-messaging fix is not regressed.
- The relock cycle (lock → reopen → relock) is provably idempotent — `ensureShareLink`'s identity-doc check means no second token is ever minted.
- `functions/seed-emulator-data.mjs` now writes a `serviceShareLinks/{serviceId}` identity doc and a `shareTokens/{token}` doc for the seeded service, using a deterministic sha256-derived 36-hex token so re-seeding overwrites the same docs (no orphan tokens). This closes the actual root cause of the owner's reported symptom — seeded test data now matches real UI-created data.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the fail-closed ensureShareLink self-heal to markAsPlanned (keep createService mint) and update tests** - `9c4720db` (feat)
2. **Task 2: Mint a real share token for the seeded service in functions/seed-emulator-data.mjs** - `8276125e` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/stores/services.ts` - `markAsPlanned` gains a fail-closed `ensureShareLink` self-heal call inside its existing `if (service)` block; `createService`'s mint is unchanged (documented inline as deliberately kept).
- `src/stores/__tests__/services.test.ts` - Flipped the "status-only transitions do NOT refresh the share payload" test's `markAsPlanned` half (it now DOES refresh; `reopenService` still does not) and renamed it; added three new `R421` tests (self-heal mints for a tokenless service, relock cycle stays at one token, a mint failure doesn't block the status transition). The two `createService` share-link tests at ~649/669 were left untouched — the mint they cover is unchanged.
- `functions/seed-emulator-data.mjs` - Added a `deterministicShareToken()` helper (sha256 of the service doc id, sliced to 36 hex chars) and, right after the seeded service's `.set()`, writes to `serviceShareLinks/{serviceId}` and `shareTokens/{token}` mirroring `ensureShareLink()`/`writeSharePayload()`'s doc shapes with a public-fields-only `serviceSnapshot` (no `notes`).

## Decisions Made
- Kept `createService`'s mint verbatim (owner's resolved scope, 2026-09-07) — `markAsPlanned`'s call is purely additive, a safety net, not a replacement.
- Used `ensureShareLink` (idempotent — identity-doc read first), never `maybeRefreshShareLink` (refresh-only by contract), for the self-heal generation path.
- Seed token is deterministic (`sha256(serviceId).slice(0,36)`), not random, preserving the seed script's existing idempotency guarantee (fixed doc ids + `.set()` everywhere).
- The seed's inline `serviceSnapshot` follows the plan's explicit public-field list (`name`, `date`, `progression`, `slots`, `sermonPassage`, `sermonTopic`) rather than importing/mirroring the full `ServiceSnapshot` TS type — the seed script is a standalone `.mjs` that functions cannot use to import the client `src/` tree (documented in the file's own header), so it was never going to type-check against that interface either way.

## Deviations from Plan

None - plan executed exactly as written. The two `createService` share-link tests at services.test.ts ~649/669 were left unchanged as instructed (the mint they cover was never touched).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. The seed script fix takes effect the next time someone runs `node functions/seed-emulator-data.mjs` against a running local emulator (not run as part of this plan — no live emulator was started).

## Next Phase Readiness
- `src/stores/__tests__/services.test.ts` — 120/120 tests pass (`npx vitest run src/stores/__tests__/services.test.ts`).
- `npm run type-check` (`vue-tsc --build`, the authoritative gate per CLAUDE.md) — clean.
- Full app suite (`npx vitest run`) — 212/213 files, 5518/5552 tests pass; the sole failing file is `src/storage.rules.test.ts`, the documented, Storage-emulator-dependent baseline (unrelated to this plan). No new failures introduced.
- `node --check functions/seed-emulator-data.mjs` — parses cleanly; `serviceShareLinks` and `shareTokens` writes present.
- R421 is fully resolved by this plan. Plan 131-01 (Stage Layout auto-populate, R420) runs independently in the same phase (wave 1, no dependency on this plan).

---
*Phase: 131-trivial-wins-auto-share-link-stage-layout-auto-populate*
*Completed: 2026-09-07*

## Self-Check: PASSED

- FOUND: src/stores/services.ts
- FOUND: src/stores/__tests__/services.test.ts
- FOUND: functions/seed-emulator-data.mjs
- FOUND: .planning/phases/131-trivial-wins-auto-share-link-stage-layout-auto-populate/131-02-SUMMARY.md
- FOUND commit: 9c4720db
- FOUND commit: 8276125e
