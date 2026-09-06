---
phase: 126-my-schedule-volunteer-home
plan: 03
subsystem: auth
tags: [pinia, firestore, collection-group-query, vue-router, volunteer]

# Dependency graph
requires:
  - phase: 126-01
    provides: "The constrained collectionGroup('rehearseAccess') list rule requiring BOTH where('status','==','planned') AND where('assignedEmailsLower','array-contains', ownEmailLower); rolesByEmailLower on RehearseAccessDoc"
provides:
  - "src/stores/mySchedule.ts — a thin Pinia store issuing the Plan-01-proven constrained collectionGroup query, scoped to the signed-in identity, with loading/error/empty state and per-doc orgId resolved from the Firestore path"
  - "/volunteer/service/:serviceId — a build-safe placeholder route + VolunteerServicePlaceholderView.vue for the Phase 127 Rehearse target"
affects: ["126-04", "Phase 127 (Rehearse UI)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A collectionGroup query result's orgId is resolved from ref.parent.parent.id (the Firestore path), never trusted from the doc's own data field, since the query spans multiple orgs"
    - "Never lazy-import() a not-yet-built future-phase component in a route — register a real, minimal placeholder this phase and let the future phase swap only the import target (path/name/meta stay stable)"

key-files:
  created:
    - src/stores/mySchedule.ts
    - src/stores/__tests__/mySchedule.test.ts
    - src/views/VolunteerServicePlaceholderView.vue
  modified:
    - src/router/index.ts
    - src/router/__tests__/router.test.ts

key-decisions:
  - "The store's query includes BOTH where('status','==','planned') and where('assignedEmailsLower','array-contains', myEmailLower) per 126-01's required-filter contract — omitting either causes Firestore to deny the whole request, not silently filter results."
  - "The array-contains filter value is read ONLY from auth.currentUser.email (lowercased) — the store accepts no email argument or client-suppliable field, so even a compromised caller cannot request another volunteer's schedule (T-126-03 defense-in-depth on top of the Plan-01 rule)."
  - "VolunteerServicePlaceholderView.vue is a REAL, minimal component (static message + router-link back to /my-schedule) authored this plan, not a stub import() target — proven by a green npm run build."

patterns-established:
  - "Any future collectionGroup query result needs to resolve orgId (or any cross-org scoping field) from the document's own Firestore ref path, not from resource data, when the query spans multiple orgs."
  - "A route pointing at a not-yet-built future-phase view gets a real placeholder component this phase; the future phase's contract is to change ONLY the component import, keeping path/name/meta stable."

requirements-completed: [R378, R382]

coverage:
  - id: D1
    description: "mySchedule store's loadMySchedule() runs the constrained collectionGroup query (status=='planned' AND assignedEmailsLower array-contains lowercased signed-in email, ordered by serviceDate), maps each result to its data plus orgId from ref.parent.parent.id, and exposes docs/isLoading/error reactively"
    requirement: "R378"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/mySchedule.test.ts — 6 cases (lowercasing+status filter, empty-email no-query, empty-string-email no-query, orgId mapping, error path, isLoading in-flight), npx vitest run src/stores/__tests__/mySchedule.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The array-contains filter value is derived only from auth.currentUser.email, never a client-suppliable argument — verified by the store's function signature (loadMySchedule takes no email parameter) and the mocked-auth test asserting the exact where() args"
    requirement: "R378"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/mySchedule.test.ts — 'builds the array-contains filter from a lowercased signed-in email...' case"
        status: pass
    human_judgment: false
  - id: D3
    description: "/volunteer/service/:serviceId resolves to a real Phase-126 placeholder view (VolunteerServicePlaceholderView.vue), not a lazy import() of a nonexistent Phase-127 file, and the production build stays green with the route registered"
    requirement: "R382"
    verification:
      - kind: unit
        ref: "src/router/__tests__/router.test.ts — 'resolves to the volunteer-service placeholder route (no \"no match\")', npx vitest run src/router/__tests__/router.test.ts"
        status: pass
      - kind: other
        ref: "npm run build — VolunteerServicePlaceholderView-*.js chunk emitted, build exits 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production readiness of the mySchedule query depends on the 126-01 COLLECTION_GROUP index being deployed (firebase deploy --only firestore:indexes) — an owner action outside this execution environment's reach, already flagged in 126-01-SUMMARY.md"
    verification: []
    human_judgment: true
    rationale: "Production index/rules deploy is an owner action; this plan's own scope (store + route) is fully verified by the emulator-independent unit tests and the build gate above."

duration: 25min
completed: 2026-09-06
status: complete
---

# Phase 126 Plan 03: mySchedule store + Rehearse placeholder route Summary

**A thin, tested Pinia store issuing the Plan-01-proven constrained `collectionGroup('rehearseAccess')` query scoped to the signed-in volunteer's lowercased email, plus a build-safe `/volunteer/service/:serviceId` placeholder route for Phase 127's not-yet-built Rehearse view.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-06T03:28Z
- **Completed:** 2026-09-06T03:53Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments
- `src/stores/mySchedule.ts`: a Pinia store exposing `docs`/`isLoading`/`error` and an async `loadMySchedule()` that runs `query(collectionGroup(db,'rehearseAccess'), where('status','==','planned'), where('assignedEmailsLower','array-contains', myEmailLower), orderBy('serviceDate','asc'))` — carrying forward BOTH required filters from 126-01's contract (the collection-group list rule denies the whole request if either is missing, not just filters results).
- The array-contains value is always `auth.currentUser.email.toLowerCase()` — the store accepts no email argument, so the filter can never be pointed at another volunteer's inbox (T-126-03 defense-in-depth).
- An absent or empty signed-in email short-circuits to `docs=[]`/`isLoading=false`/`error=null` without ever calling `getDocs` — proven by two dedicated test cases (null `currentUser`, empty-string email).
- Each result doc is mapped to its `data()` plus `orgId` resolved from `d.ref.parent.parent.id` — the doc's own Firestore path, not a trusted field on the document, since results span multiple orgs.
- A rejected `getDocs` call sets `error` to a truthy message and leaves `docs` empty, without rethrowing to the caller.
- `src/router/index.ts`: added `/volunteer/service/:serviceId` -> `VolunteerServicePlaceholderView.vue`, `meta: { requiresAuth: true, isVolunteerRoute: true }`, with an inline comment stating Phase 127 replaces only the component import.
- `src/views/VolunteerServicePlaceholderView.vue`: a real, minimal component (dark shell idiom copied from `VolunteerLinkCompleteView.vue`) — a static "coming soon" message and a `router-link` back to `/my-schedule` (a route Plan 04 registers later this phase). No data fetch.
- `npm run build` verified green with the new route registered (emits a `VolunteerServicePlaceholderView-*.js` chunk) — proves no `import()` targets a nonexistent Phase-127 file.
- Full verification: `npx vitest run src/stores/__tests__/mySchedule.test.ts src/router/__tests__/router.test.ts` (22/22 pass), `npm run type-check` clean, full app suite `npx vitest run` (5303 passed, 35 skipped, exactly the one documented `storage.rules.test.ts` baseline failure — no regressions).

## Task Commits

Each task was committed atomically:

1. **Task 1: mySchedule store — the constrained collectionGroup query** - `2b4230f0` (feat)
2. **Task 2: Build-safe placeholder route + view for the Phase 127 Rehearse target** - `007392a2` (feat)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/stores/mySchedule.ts` (NEW) - Pinia store with `docs`/`isLoading`/`error` and `loadMySchedule()` running the constrained collectionGroup query.
- `src/stores/__tests__/mySchedule.test.ts` (NEW) - 6 unit tests: lowercasing + required status filter, empty-email/empty-string-email no-query short-circuits, orgId mapping from `ref.parent.parent.id`, error path, isLoading in-flight timing.
- `src/router/index.ts` - Added the `/volunteer/service/:serviceId` route entry (with a Phase-127-handoff comment) alongside the existing volunteer routes.
- `src/views/VolunteerServicePlaceholderView.vue` (NEW) - Build-safe placeholder view for the Phase 127 Rehearse target.
- `src/router/__tests__/router.test.ts` - Added the placeholder route to the test harness and a resolution assertion.

## Decisions Made
- The store's query includes `where('status','==','planned')` in addition to `where('assignedEmailsLower','array-contains', myEmailLower)` — the plan's Task 1 `<action>` prose only mentioned the latter, but 126-01-SUMMARY.md's "Downstream requirement for Plan 03" explicitly required both filters (the collection-group list rule denies outright otherwise). Followed the REQUIRED CONTRACT over the narrower task prose — see `<critical_reminders>` in this plan's invocation and 126-01-SUMMARY.md's frontmatter `key-decisions`.
- `VolunteerServicePlaceholderView.vue` deliberately has no data fetch or spinner state (per the plan's `<action>`) — it is a pure static placeholder, matching the phase's build-safety goal rather than trying to preview Phase 127's real UI.

## Deviations from Plan

None — plan executed exactly as written, including the REQUIRED-CONTRACT status filter carried forward from 126-01 (which the plan's own `<critical_reminders>` called out explicitly, so this is not an unplanned deviation).

## Issues Encountered

An initial `vi.mock('@/firebase', ...)` factory referencing a `const mockAuth` declared just above it threw `ReferenceError: Cannot access 'mockAuth' before initialization` — vitest's mock-hoisting only special-cases simple `mock`-prefixed declarations reliably when built via `vi.hoisted()`. Fixed by wrapping the mutable auth mock in `vi.hoisted(() => ({ currentUser: null }))`. No plan or production-code impact; test-file-only fix, verified by the full 6/6 green run.

## User Setup Required

None new this plan — the 126-01 COLLECTION_GROUP index/rules deploy requirement (already documented in `126-01-SUMMARY.md`'s "User Setup Required" section) remains the only outstanding external-service action for My Schedule to work in production; this plan's store and route are otherwise fully client-side/emulator-independent to verify.

## Next Phase Readiness
- Plan 04 (the My Schedule view + card, `/my-schedule` route, post-sign-in landing redirect) can now consume `useMyScheduleStore()`'s `docs`/`isLoading`/`error`/`loadMySchedule()` directly, plus Plan 02's grouping/readiness helpers, to render the volunteer's schedule.
- The `/volunteer/service/:serviceId` route and its placeholder component are stable — Phase 127 needs to change only the `component: () => import(...)` target, not the path, name, or meta.
- No blockers for Plan 04.

---
*Phase: 126-my-schedule-volunteer-home*
*Completed: 2026-09-06*
