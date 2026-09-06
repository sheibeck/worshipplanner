---
phase: 125-passwordless-magic-link-access-scoped-read-isolation
plan: 02
subsystem: auth
tags: [firestore, projection, services-store, magic-link, rehearse-access]

# Dependency graph
requires:
  - phase: 125-01
    provides: "organizations/{orgId}/rehearseAccess/{serviceId} Firestore collection contract + rule enforcing R377"
provides:
  - "buildRehearseAccess() pure projection builder (src/utils/rehearseAccess.ts) producing the RehearseAccessDoc schema"
  - "Lock-time write of the rehearseAccess projection in markAsPlanned, keeping the R377 read path populated"
  - "Reopen-time and delete-time revocation of the rehearseAccess projection, closing the Reopen-staleness gap at the client layer"
affects: [125-03, 125-04, "Phase 126 (My Schedule)", "Phase 127 (Rehearse UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure projection builder in src/utils/ (mirrors buildServiceSnapshot) — no I/O, conditional-spread for optional fields so Firestore never receives a literal undefined"
    - "Lock-time client write inside a dedicated try/catch that never rolls back an already-succeeded status transition (mirrors recomputeLastUsedFor's soft-fail convention)"
    - "Existence-guarded revoke-first cleanup in deleteService (mirrors the serviceShareLinks precedent)"

key-files:
  created:
    - src/utils/rehearseAccess.ts
    - src/utils/rehearseAccess.test.ts
  modified:
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts

key-decisions:
  - "assignedEmailsLower is derived via resolveServiceRoleAssignments -> effectivePersonIds -> Person.email, using the exact lowercase/empty-skip logic messagingRecipients.ts's resolveRecipients already uses — 'assigned' is deliberately identical to 'who gets the reminder email,' not a separately-derived concept."
  - "songs are deduped by songId in first-slot-occurrence order (mirrors ADR-0160's dedupe-via-Set precedent in songIdsInService), each carrying an optional keyOrArrangement taken from that first slot's songKey — a song scheduled twice with two different keys is out of scope for v1 (matches how lastUsedAt recompute already treats repeated songId slots as one unit)."
  - "buildRehearseAccess takes already-loaded data (service, quarters, roles, people, songs) as plain arguments rather than reading stores itself, keeping it a pure, store-free function testable without any Pinia/Firestore setup — the store functions (markAsPlanned) are the sole caller that resolves useRosterStore()/useQuartersStore()/useSongStore() and passes their state in."
  - "Fixed a stale test assertion ('status-only transitions ... do NOT refresh the share payload') that asserted setDoc was never called during markAsPlanned/reopenService at all — now that markAsPlanned legitimately calls setDoc for the NEW rehearseAccess doc, the assertion is rescoped to shareTokens-path writes specifically, which is what it always intended to guard against (the public share payload refresh, not this projection)."

patterns-established:
  - "Any future lock-time projection collection should follow this shape: a pure builder in src/utils/ taking already-resolved data, written inside its own try/catch at the status-transition call site (never blocking the transition itself), with symmetric revoke-on-reopen and existence-guarded revoke-on-delete."

requirements-completed: [R377]

coverage:
  - id: D1
    description: "buildRehearseAccess() pure projection builder producing the schema-matching, normalized, PII-safe RehearseAccessDoc (mixed-case email normalization, empty-email skip, attachment field allowlist, no notes/private-field leak)"
    requirement: "R377"
    verification:
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts (6 tests, all passing)"
        status: pass
    human_judgment: false
  - id: D2
    description: "markAsPlanned writes the rehearseAccess projection at lock time via buildRehearseAccess + setDoc with a server updatedAt, inside a try/catch that never rolls back the status transition"
    requirement: "R377"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts (110 tests, all passing) + npm run type-check (clean)"
        status: pass
    human_judgment: false
  - id: D3
    description: "reopenService deletes the rehearseAccess projection on planned/exported->draft (belt-and-suspenders with the rule's live parentIsPlanned() re-check); deleteService revokes it as an existence-guarded revoke-first step"
    requirement: "R377"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts (110 tests, all passing)"
        status: pass
      - kind: integration
        ref: "npx vitest run --config vitest.rules.config.ts -t \"R377\" (9/9 R377 emulator cases still green — schema contract from Plan 125-01 held)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-06
status: complete
---

# Phase 125 Plan 02: rehearseAccess Projection Builder + Lock-Lifecycle Wiring Summary

**Pure `buildRehearseAccess()` builder (PII-safe, schema-matching the 125-01 rule contract) wired into markAsPlanned/reopenService/deleteService so the R377 read path is populated at lock time and revoked on reopen/delete.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-06T00:23Z (post plan-commit)
- **Completed:** 2026-09-06T00:38Z
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Added `src/utils/rehearseAccess.ts` — a pure, store-free `buildRehearseAccess()` builder producing exactly the `RehearseAccessDoc` schema Plan 125-01's `firestore.rules` block enforces (`serviceId`, `orgId`, `serviceDate`, `title`, `status`, `assignedEmailsLower[]`, `songs[]`), with 6 unit tests covering mixed-case email normalization, empty-email skip, the attachment field allowlist (only `id`/`name`/`kind`/`downloadUrl`/`href` survive), and the no-notes/no-private-field guarantee.
- Wired the projection into the service lock lifecycle in `src/stores/services.ts`: `markAsPlanned` writes it via `setDoc` (server `updatedAt`) inside its own try/catch that never rolls back the already-succeeded status transition; `reopenService` deletes it on the planned/exported→draft flip; `deleteService` revokes it as an existence-guarded revoke-first step (mirrors the `serviceShareLinks` precedent).
- Confirmed the R377 emulator suite from Plan 125-01 is still fully green against this plan's write shape (`npx vitest run --config vitest.rules.config.ts -t "R377"`, 9/9 pass) — the schema contract held with no rules changes needed.
- Found and fixed one stale pre-existing test assertion in `services.test.ts` that broke under the new (correct) `setDoc` call — see Deviations.

## Task Commits

Each task was committed atomically:

1. **Task 1: buildRehearseAccess pure projection builder + unit tests** - `9775643d` (feat)
2. **Task 2: Wire rehearseAccess lifecycle into markAsPlanned/reopenService/deleteService** - `3e2ff1e7` (feat) — also carries the test-fix deviation below.

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/utils/rehearseAccess.ts` - New. `buildRehearseAccess()`, `RehearseAccessDoc`, `RehearseSong`, `RehearseAttachment`.
- `src/utils/rehearseAccess.test.ts` - New. 6 unit tests for the builder.
- `src/stores/services.ts` - `markAsPlanned` writes the projection; `reopenService` deletes it; `deleteService` revokes it (existence-guarded).
- `src/stores/__tests__/services.test.ts` - Rescoped one assertion (see Deviations) to keep testing what it always intended to guard.

## Decisions Made
- `assignedEmailsLower` reuses `resolveServiceRoleAssignments` + the exact lowercase/empty-email-skip logic `messagingRecipients.ts`'s `resolveRecipients` already applies — "assigned" and "who gets the reminder email" are deliberately the same set, per 125-RESEARCH.md's framing.
- Songs are deduped by `songId` in first-slot-occurrence order (mirrors `songIdsInService`'s `ADR-0160` dedupe-via-Set precedent), with `keyOrArrangement` taken from that first occurrence's `songKey`.
- `buildRehearseAccess` is a pure function taking already-resolved data as arguments (no store reads inside it) — `markAsPlanned` is the sole caller responsible for pulling `useRosterStore()`/`useQuartersStore()`/`useSongStore()` state and passing it in, keeping the builder unit-testable with zero Pinia/Firestore setup (matches `buildServiceSnapshot`'s idiom).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rescoped a stale test assertion broken by the new (correct) setDoc call**
- **Found during:** Task 2 (`npx vitest run` full-suite verification pass)
- **Issue:** `services.test.ts`'s `'status-only transitions (markAsPlanned, reopenService) do NOT refresh the share payload'` test asserted `expect(setDoc).not.toHaveBeenCalled()` for the whole `markAsPlanned`/`reopenService` call — a blanket assertion that was only true because, before this plan, neither function called `setDoc` for anything. Task 2 correctly adds a `setDoc` call to `markAsPlanned` for the NEW `rehearseAccess` projection — a completely different write than the public share-payload refresh this test actually exists to guard against, but the assertion's literal wording broke.
- **Fix:** Rescoped the assertion to filter `setDoc` calls by `path.startsWith('shareTokens')`, so the test still proves what it always intended (no share-payload refresh on a status-only transition) without forbidding the new, correct `rehearseAccess` write.
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Verification:** `npx vitest run src/stores/__tests__/services.test.ts` — 110/110 pass (was 1 failing before the fix).
- **Committed in:** `3e2ff1e7` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in a pre-existing test assertion)
**Impact on plan:** No scope creep — the store/builder code matches the plan exactly; only a test assertion that encoded a now-outdated "no setDoc at all" invariant needed narrowing to what it actually tests.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required (this plan touches only application code and its own test suite; Firebase console prerequisites belong to earlier/later plans in this phase per 125-RESEARCH.md).

## Next Phase Readiness
- The R377 read path is now populated end-to-end from the editor side: locking a service produces a schema-correct, normalized, PII-safe `rehearseAccess` projection; reopening or deleting the service removes it.
- `npm run type-check` is clean. `npx vitest run` (full app suite): no new failures beyond the pre-existing `src/storage.rules.test.ts` baseline (Storage-emulator-dependent, documented in CLAUDE.md, unrelated to this plan).
- `npx vitest run --config vitest.rules.config.ts -t "R377"` — all 9 R377 emulator cases still pass against a running Firestore emulator, confirming Plan 125-01's rule and this plan's write shape agree exactly.
- Plans 03/04 (client auth flow, router separation) and Phases 126-127 (My Schedule, Rehearse UI) can now rely on a populated, correctly-lifecycled `rehearseAccess` collection — no further projection-shape work should be needed.
- No blockers.

---
*Phase: 125-passwordless-magic-link-access-scoped-read-isolation*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/utils/rehearseAccess.ts
- FOUND: src/utils/rehearseAccess.test.ts
- FOUND: src/stores/services.ts
- FOUND: .planning/phases/125-passwordless-magic-link-access-scoped-read-isolation/125-02-SUMMARY.md
- FOUND commit: 9775643d
- FOUND commit: 3e2ff1e7
