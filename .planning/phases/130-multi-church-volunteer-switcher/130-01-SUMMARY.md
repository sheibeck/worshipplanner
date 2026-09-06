---
phase: 130-multi-church-volunteer-switcher
plan: 01
subsystem: data
tags: [firestore, pinia, vue3, rehearseAccess, mySchedule]

# Dependency graph
requires:
  - phase: 125-127 (v2.12 rehearseAccess / My Schedule)
    provides: RehearseAccessDoc projection pipeline, mySchedule collectionGroup store
provides:
  - orgName?: string on RehearseAccessDoc, conditionally-spread (absent, never undefined, when empty)
  - orgName param on buildRehearseAccess, threaded through the single writeRehearseAccessDoc choke point
  - markAsPlanned forwards orgName from authStore.orgName
  - resyncRehearseAccessForSong forwards orgName from a batched getDoc(organizations/{orgId}), degrading
    gracefully via a local .catch(() => null) so a denied/failed read never blocks the resync
  - mySchedule.selectedChurch / churches / filteredDocs — pure client-side filter over already-loaded docs
affects: [130-02 (church switcher UI, sidebar church-name label, VolunteerServiceView context)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional-spread to omit an absent optional field from a Firestore setDoc payload (never a literal undefined)"
    - "Map-based distinct-value dedupe, first-occurrence order (mirrors rehearseAccess.ts's distinctSongSlots/ADR-0160)"
    - "Local .catch(() => null) on one promise inside a Promise.all so a single best-effort read failure degrades gracefully without rejecting sibling reads"

key-files:
  created: []
  modified:
    - src/utils/rehearseAccess.ts
    - src/utils/rehearseAccess.test.ts
    - src/stores/services.ts
    - src/stores/__tests__/services.test.ts
    - src/stores/mySchedule.ts
    - src/stores/__tests__/mySchedule.test.ts

key-decisions:
  - "orgName is a required-positional (string | undefined) parameter on buildRehearseAccess/writeRehearseAccessDoc, not a trailing optional — matches the file's existing convention of pairing orgId with its companion value at the same call-site position."
  - "The new org getDoc in resyncRehearseAccessForSong uses a scoped .catch(() => null) inside the Promise.all array (rather than letting a rejection propagate) so a denied/failed org read degrades to 'no orgName' without also aborting the quarters/roles/people/songs reads batched alongside it — this satisfies the threat model's literal 'never blocks the attachment write' requirement, which a bare Promise.all cannot: any one rejection there fails the whole batch."
  - "mySchedule.churches keeps orgName as string | undefined per entry (no fallback baked in) — Plan 02's consumers (dropdown vs. sidebar) apply their own context-specific fallback text, per the plan's explicit instruction."

requirements-completed: [R403, R404, R405]

coverage:
  - id: D1
    description: "orgName threaded through buildRehearseAccess with conditional-spread (present when named, absent — not undefined — when empty)"
    requirement: "R404"
    verification:
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts#orgName equals the passed org name when a non-empty name is given"
        status: pass
      - kind: unit
        ref: "src/utils/rehearseAccess.test.ts#orgName is absent (not undefined) when an empty string or undefined name is given"
        status: pass
    human_judgment: false
  - id: D2
    description: "markAsPlanned forwards orgName from authStore.orgName into the rehearseAccess write, without rolling back the status transition when null"
    requirement: "R404"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#markAsPlanned writes a rehearseAccess doc whose orgName equals authStore.orgName"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#markAsPlanned still succeeds and omits orgName when authStore.orgName is null"
        status: pass
    human_judgment: false
  - id: D3
    description: "resyncRehearseAccessForSong forwards orgName from a batched organizations/{orgId} getDoc, degrading gracefully on a denied/failed read"
    requirement: "R404"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#writes rehearseAccess docs whose orgName equals the org document name, fetched via a batched getDoc"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/services.test.ts#degrades gracefully to no orgName when the org getDoc read fails, without blocking the resync write"
        status: pass
    human_judgment: false
  - id: D4
    description: "mySchedule.churches derives the distinct set of {orgId, orgName} served, first-occurrence order, graceful on missing orgName"
    requirement: "R403"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/mySchedule.test.ts#churches over docs from two distinct orgIds returns two entries, first-occurrence order"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/mySchedule.test.ts#churches over one orgId returns one entry; over zero docs returns []"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/mySchedule.test.ts#a doc whose orgName is absent still yields a churches entry with orgName undefined — no crash"
        status: pass
    human_judgment: false
  - id: D5
    description: "mySchedule.filteredDocs is a pure client-side filter (all docs when null, else orgId match), with stale-selection self-reset on reload; store never imports auth or calls selectOrg"
    requirement: "R403"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/mySchedule.test.ts#filteredDocs returns all docs when selectedChurch is null, else only docs matching the orgId"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/mySchedule.test.ts#a stale selectedChurch that no longer appears among the new docs orgIds is reset to null on reload"
        status: pass
      - kind: unit
        ref: "src/stores/__tests__/mySchedule.test.ts#never imports @/stores/auth or calls selectOrg — filters already-loaded docs only"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-09-06
status: complete
---

# Phase 130 Plan 01: Multi-Church Volunteer Switcher — Data Layer Summary

**Threaded an optional `orgName` field through the rehearseAccess projection (both write paths) and built the mySchedule store's distinct-church derivation + client-side filter backbone.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-06T22:35:31Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- `RehearseAccessDoc.orgName?: string` + `buildRehearseAccess`'s new `orgName` parameter, emitted via conditional-spread so the key is absent (never a literal `undefined`) when the org has no name.
- `writeRehearseAccessDoc`'s single choke point now forwards `orgName`; both `markAsPlanned` (from `authStore.orgName`) and `resyncRehearseAccessForSong` (from a batched `getDoc(organizations/{orgId})`) supply it.
- `mySchedule` store gained `selectedChurch` (session-local, null = all), `churches` (distinct `{orgId, orgName}`, first-occurrence order), and `filteredDocs` (pure in-memory slice) — with automatic reset of a stale `selectedChurch` after a reload drops that org.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add orgName to the rehearseAccess projection** - `dea22523` (feat)
2. **Task 2: Forward orgName through both write paths** - `d86da749` (feat)
3. **Task 3: Distinct-church derivation + client-side filter in mySchedule** - `e0a7d398` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `src/utils/rehearseAccess.ts` - `RehearseAccessDoc.orgName?` + `buildRehearseAccess`'s new `orgName` param, conditional-spread emission.
- `src/utils/rehearseAccess.test.ts` - all 19 existing calls updated for the new positional param; 2 new orgName presence/absence cases.
- `src/stores/services.ts` - `writeRehearseAccessDoc` gains `orgName`; `markAsPlanned` sources it from `authStore.orgName`; `resyncRehearseAccessForSong` sources it from a batched, best-effort `getDoc(organizations/{orgId})`.
- `src/stores/__tests__/services.test.ts` - `mockAuthState.orgName` added; new markAsPlanned orgName-present/orgName-null-degrades tests; new `resyncRehearseAccessForSong orgName` describe block (2 tests) — this function had no direct unit tests before this plan.
- `src/stores/mySchedule.ts` - `selectedChurch`, `churches`, `filteredDocs` computeds/ref, `resetStaleSelection()` helper called from every `loadMySchedule` exit path.
- `src/stores/__tests__/mySchedule.test.ts` - 6 new tests covering distinct derivation (multi/single/zero/orgName-absent), filter behavior, stale-selection reset, and a source-scan regression test asserting no `@/stores/auth` import / no `selectOrg(` call.

## Decisions Made
- `orgName: string | undefined` is a required-positional parameter (not a trailing optional) on `buildRehearseAccess` and `writeRehearseAccessDoc`, positioned immediately after `orgId` per the plan — every existing call site (19 in the test file, 2 in services.ts) was updated to pass it explicitly.
- The new org `getDoc` in `resyncRehearseAccessForSong` uses `.catch(() => null)` scoped to just that one promise inside the `Promise.all`, rather than letting a rejection propagate. A bare `Promise.all` rejects the whole batch on any single rejection, which would have blocked the quarters/roles/people/songs reads too — contradicting the threat model's (T-130-03) explicit "never blocks the attachment write" requirement. This is a plan-instruction clarification, not a scope change: the code is still "inside the existing best-effort try/catch" as instructed, with an additional inner catch to isolate this one read's failure mode.
- `mySchedule.churches` keeps `orgName` as `string | undefined` per entry with no fallback baked in, so Plan 02's UI consumers (switcher dropdown vs. sidebar label) can each apply their own fallback text, per the plan's explicit "leave that to the UI in Wave 2" instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `resyncRehearseAccessForSong`'s new org `getDoc` needed a scoped `.catch()`, not a bare `Promise.all` entry**
- **Found during:** Task 2 (forward orgName through both write paths)
- **Issue:** The plan's action text says to add the `getDoc` "INTO the existing Promise.all" and rely on the surrounding try/catch for best-effort degradation. A literal implementation would have a `getDoc` rejection reject the whole `Promise.all`, aborting the quarters/roles/people/songs reads too — which contradicts the plan's own `<behavior>` clause and the threat model's T-130-03 mitigation text ("a denied/slow read degrades to no orgName and never blocks the attachment write").
- **Fix:** Added a local `.catch(() => null)` on just the `getDoc(...)` promise inside the `Promise.all` array, so only that read's failure is absorbed (resolving to `null` → no `orgName`) while the other reads and the resulting `writeRehearseAccessDoc` calls still proceed normally. The outer try/catch remains as the safety net for any other failure in the function.
- **Files modified:** `src/stores/services.ts`
- **Verification:** New test `degrades gracefully to no orgName when the org getDoc read fails, without blocking the resync write` — asserts the rehearseAccess doc is still written, minus `orgName`, when the org `getDoc` rejects.
- **Committed in:** `d86da749` (Task 2 commit)

**2. [Rule 3 - Blocking] `services.test.ts` needed a new `mockAuthState.orgName` field and a new `resyncRehearseAccessForSong` test block (neither existed)**
- **Found during:** Task 2
- **Issue:** The plan's read_first section implied existing mock helpers for `markAsPlanned` and `resyncRehearseAccessForSong` orgName assertions could be extended, but `mockAuthState` had no `orgName` field, and `resyncRehearseAccessForSong` had zero direct unit tests in this file prior to this plan (confirmed via grep).
- **Fix:** Added `orgName: string | null` to `mockAuthState` (defaulting to `'Grace Church'`, restored after the null-case test), and added a new `resyncRehearseAccessForSong orgName (Phase 130, R404)` describe block with 2 tests covering the happy path and the degrade-gracefully path (RESEARCH pitfall 4's exact concern — a missing `getDoc` mock for the org document would hang/throw rather than assert cleanly; this plan adds that mock explicitly for the new tests).
- **Files modified:** `src/stores/__tests__/services.test.ts`
- **Verification:** `npx vitest run src/stores/__tests__/services.test.ts` — 117 tests pass.
- **Committed in:** `d86da749` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking test-infrastructure/implementation gaps the plan's literal text didn't fully specify)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own stated behavior/threat-model requirements. No scope creep — no new files, no UI work (reserved for Plan 02).

## Issues Encountered
- The regression test asserting "never imports `@/stores/auth` or calls `selectOrg`" initially failed against its own explanatory code comments (which name both strings as anti-patterns to avoid) — a plain substring match found them in the comment, not an import/call. Fixed by using targeted regexes (`from ['"]@\/stores\/auth['"]` and `\bselectOrg\s*\(`) and rewording the comment so it doesn't itself contain a `selectOrg(`-shaped substring.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (church switcher UI, sidebar church-name label, VolunteerServiceView context) can build directly on `mySchedule.selectedChurch` / `churches` / `filteredDocs` and `RehearseAccessDoc.orgName`.
- Existing-doc caveat carries forward unchanged: already-Planned services' `rehearseAccess` docs won't have `orgName` until re-projected (re-lock or a song-file resync) — `churches`/`filteredDocs` already degrade gracefully (orgName `undefined`, no crash), consistent with the deferred one-time-backfill note in CONTEXT.md.
- No blockers.

---
*Phase: 130-multi-church-volunteer-switcher*
*Completed: 2026-09-06*

## Self-Check: PASSED

All 6 modified source/test files confirmed present on disk; all 3 task commits (`dea22523`, `d86da749`, `e0a7d398`) confirmed in `git log`. Targeted test files green: `rehearseAccess.test.ts` (21 tests), `services.test.ts` (117 tests), `mySchedule.test.ts` (12 tests). `npm run type-check` (`vue-tsc --build`) clean.
