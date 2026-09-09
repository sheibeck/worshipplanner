---
phase: 134-editor-presence
plan: 01
subsystem: security
tags: [firestore-rules, firebase, presence, org-scoping, sec-s-01-guard]

# Dependency graph
requires:
  - phase: 133-services-page-ux-alignment
    provides: the confirmations subcollection's org-scoped get/list-split + field-allowlist rule idiom, mirrored here
provides:
  - "src/utils/presence.ts — PresenceDoc type, isPresenceStale() helper, PRESENCE_HEARTBEAT_MS/PRESENCE_STALE_TTL_MS constants"
  - "firestore.rules organizations/{orgId}/services/{docId}/presence/{presenceId} match block — org-scoped get/list-split read, own-doc-only field-allowlisted write/delete"
  - "src/rules.test.ts presence describe block — 12 ALLOW/DENY cases proving no cross-org read/list/write leak and no other-user write/delete"
affects: [134-02-presence-composable, 134-03-presence-cleanup-cron, 135-dashboard-presence-rollup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presence subcollection nested inside services/{docId} so orgId+serviceId are path-derived, never client fields (structurally impossible cross-tenant access)"
    - "get/list-split read rule (allow get, list: if isOrgMember(orgId)) — the SEC-S-01 replay guard, lets tests assert both arms independently"
    - "Own-doc-only write idiom: presenceId == request.auth.uid && request.resource.data.uid == request.auth.uid, plus keys().hasOnly([...]) field allowlist"

key-files:
  created:
    - src/utils/presence.ts
  modified:
    - firestore.rules
    - src/rules.test.ts

key-decisions:
  - "PRESENCE_HEARTBEAT_MS = 30000, PRESENCE_STALE_TTL_MS = 60000 — within the research-recommended 25-30s/45-60s range, matching v1.8 cost-hardening discipline"
  - "isPresenceStale treats null/NaN lastSeenMs as always stale (fail-safe default for a doc with no observed heartbeat)"

patterns-established:
  - "Pure schema module in src/utils/ with zero Firestore/Pinia runtime imports (type-only) mirrors confirmations.ts/serviceRoles.ts convention"

requirements-completed: [R423]

coverage:
  - id: D1
    description: "src/utils/presence.ts exports PresenceDoc, isPresenceStale, PRESENCE_HEARTBEAT_MS, PRESENCE_STALE_TTL_MS as a pure module"
    requirement: "R423"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build, clean)"
        status: pass
    human_judgment: false
  - id: D2
    description: "firestore.rules presence match block: org-scoped get/list-split read, own-doc-only field-allowlisted write/delete"
    requirement: "R423"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#services/{id}/presence — org-scoped heartbeat (R423), 12 cases (4 ALLOW, 8 DENY)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cross-org get, list, and write are all DENIED (SEC-S-01 replay guard) — no cross-tenant presence leak"
    requirement: "R423"
    verification:
      - kind: integration
        ref: "src/rules.test.ts#(8) DENY cross-org get, #(9) DENY cross-org list, #(10) DENY cross-org write"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-07
status: complete
---

# Phase 134 Plan 01: Presence Schema & Org-Scoped Rules Summary

**Org-scoped `organizations/{orgId}/services/{serviceId}/presence/{uid}` subcollection with a get/list-split read rule, own-doc-only field-allowlisted write/delete rule, a pure `PresenceDoc`/`isPresenceStale` schema module, and 12 passing ALLOW/DENY rules tests proving no SEC-S-01-style cross-tenant leak.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-07T18:55:00Z (approx)
- **Completed:** 2026-09-07T19:21:31Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `src/utils/presence.ts`: pure `PresenceDoc` type (uid/displayName/lastSeen), `isPresenceStale()` helper, and `PRESENCE_HEARTBEAT_MS`/`PRESENCE_STALE_TTL_MS` constants — the schema Plan 02's composable will consume.
- `firestore.rules`: new `match /presence/{presenceId}` block nested inside `match /services/{docId}` — org-scoped `allow get, list: if isOrgMember(orgId)` read (never unscoped `isSignedIn()`/`if true`), own-doc-only `create, update` gated on `presenceId == request.auth.uid && request.resource.data.uid == request.auth.uid` with a `hasOnly(['uid', 'displayName', 'lastSeen'])` field allowlist, and own-doc-only `delete`.
- `src/rules.test.ts`: new `describe('services/{id}/presence — org-scoped heartbeat (R423)')` block with all 12 plan-enumerated ALLOW/DENY cases, all passing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Presence schema module + org-scoped firestore.rules block** - `a2815735` (feat)
2. **Task 2: Presence rules ALLOW/DENY test block** - `923ce7fe` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/utils/presence.ts` - PresenceDoc type, isPresenceStale() helper, PRESENCE_HEARTBEAT_MS/PRESENCE_STALE_TTL_MS constants
- `firestore.rules` - presence match block nested in services/{docId}: org-scoped get/list-split read, own-doc-only write/delete with field allowlist
- `src/rules.test.ts` - presence describe block (12 ALLOW/DENY cases); added `serverTimestamp` to the top-level firebase/firestore import

## Decisions Made
- Heartbeat 30000ms / staleness 60000ms chosen from the research-recommended range (25-30s heartbeat, 45-60s staleness) per Claude's Discretion in 134-CONTEXT.md.
- `isPresenceStale` treats a null/NaN `lastSeenMs` as always-stale — a fail-safe default for "no heartbeat observed yet."

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm run test:rules` reported "Port 8080 is not open... could not start Firestore Emulator" because an emulator was already running from a prior session. Per CLAUDE.md, used `npx vitest run --config vitest.rules.config.ts` directly against the running emulator instead. All 12 new presence cases passed (263 passed, 35 skipped total). The only failing file was `src/storage.rules.test.ts` (Storage emulator not started in this session — the documented, unrelated baseline failure), not a regression from this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (composable) can now import `PresenceDoc`, `isPresenceStale`, `PRESENCE_HEARTBEAT_MS`, `PRESENCE_STALE_TTL_MS` from `src/utils/presence.ts` and read/write live against the org-scoped rules landed here.
- Plan 03 (cleanup cron) writes via Admin SDK, which bypasses these client rules entirely — no dependency on this plan's rule shape beyond the doc schema.
- No blockers.

---
*Phase: 134-editor-presence*
*Completed: 2026-09-07*

## Self-Check: PASSED
- FOUND: src/utils/presence.ts
- FOUND: .planning/phases/134-editor-presence/134-01-SUMMARY.md
- FOUND commit: a2815735
- FOUND commit: 923ce7fe
