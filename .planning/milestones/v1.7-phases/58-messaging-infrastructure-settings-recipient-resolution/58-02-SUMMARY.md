---
phase: 58-messaging-infrastructure-settings-recipient-resolution
plan: 02
subsystem: infra
tags: [typescript, messaging, roster, pure-function]

requires:
  - phase: 58-01
    provides: "OrgSettings.messaging block + isMessagingEnabled() choke point (unrelated but same phase; this plan is independent)"
provides:
  - "resolveRecipients(service, quarters, roles, people, selection) — the single pure recipient resolver every later messaging surface (Phase 59 composer, Phase 61 auto-sends, Phase 62 re-lock notice) reuses"
  - "MESSAGING_TEAM_LABELS — standalone RoleGroup -> messaging-team-label constant (band->Worship, tech->Tech, vocals->Vocals, other->Hosts)"
  - "RecipientCandidate / RecipientSelection exported types"
affects: [phase-59-composer, phase-61-auto-sends, phase-62-re-lock-notice]

tech-stack:
  added: []
  patterns:
    - "Pure utils/ resolver wrapping an existing pure resolver (resolveServiceRoleAssignments), zero Firestore/Pinia imports, unit-tested with zero mocking — mirrors src/utils/serviceRoles.ts"
    - "Dedup by domain-object id (Map/Set keyed on person.id), never on a derived/normalized string like lowercased email"

key-files:
  created:
    - src/utils/messagingRecipients.ts
    - src/utils/__tests__/messagingRecipients.test.ts
  modified: []

key-decisions:
  - "Resolved 58-RESEARCH.md Open Question 1 / Assumption A3: a role assignment pointing at a stale/deleted personId is silently skipped and does NOT count toward unreachableCount (conservative, literal reading of the locked spec — unreachable is defined only in terms of an existing Person with email === '')"
  - "MESSAGING_TEAM_LABELS defined as its own standalone constant, not imported/repurposed from RolesConfigPanel.vue's groupLabels — two UIs are allowed to describe the same RoleGroup enum differently"
  - "Dedup key is person.id via a Set/Map, never a lowercased email string, per 58-RESEARCH.md's Don't Hand-Roll table"

patterns-established:
  - "Pure recipient-selection resolver pattern: filter assignments by team/everyone -> collect ids into a Set (inherent dedup) -> map through a people-by-id Map -> split reachable/unreachable by a domain rule. Reusable for any future 'who does this apply to' resolution over role assignments."

requirements-completed: [R134, R135]

coverage:
  - id: D1
    description: "selection.teams filters to only people whose assigned role.group matches; includeEveryone ignores teams and resolves every assigned role"
    requirement: "R134"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#Test A (team filter)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#Test B (includeEveryone ignores teams)"
        status: pass
    human_judgment: false
  - id: D2
    description: "individualPersonIds are always included even when not on any selected team"
    requirement: "R134"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#Test C (individuals always included)"
        status: pass
    human_judgment: false
  - id: D3
    description: "dedup by person id — a person assigned to two matching roles appears exactly once in reachable"
    requirement: "R135"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#Test D (dedup by person id)"
        status: pass
    human_judgment: false
  - id: D4
    description: "a matched person with email === '' is excluded from reachable and increments unreachableCount by 1; distinct from an unfilled role (0 recipients, no warning) and a stale/deleted personId (silently skipped, no warning)"
    requirement: "R135"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#Test E (empty-email assignee)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#Test F (unfilled role)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#Test G (stale personId silently skipped)"
        status: pass
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#Test H (stale vs unreachable distinguished in the same call)"
        status: pass
    human_judgment: false
  - id: D5
    description: "MESSAGING_TEAM_LABELS maps band->Worship, tech->Tech, vocals->Vocals, other->Hosts as its own standalone constant"
    requirement: "R134"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messagingRecipients.test.ts#MESSAGING_TEAM_LABELS maps every RoleGroup..."
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-13
status: complete
---

# Phase 58 Plan 02: Pure Recipient Resolver Summary

**`resolveRecipients` — a pure resolver wrapping `resolveServiceRoleAssignments` that turns a team/individual/everyone selection into a person-id-deduped reachable list plus an unreachable count, with `MESSAGING_TEAM_LABELS` as the messaging surfaces' own RoleGroup label map.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-13T16:12:00Z
- **Completed:** 2026-08-13T16:37:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (both new)

## Accomplishments
- `src/utils/messagingRecipients.ts` — new pure module (`resolveRecipients`, `MESSAGING_TEAM_LABELS`, `RecipientCandidate`, `RecipientSelection`), zero Firestore/Pinia/store imports, same purity contract as `src/utils/serviceRoles.ts`
- Dedup-by-person-id semantics proven distinct from three related-but-different zero-recipient cases: unfilled role (no warning), empty-email assignee (counted unreachable), stale/deleted personId (silently skipped, no warning)
- 9 unit tests, zero mocking, covering every behavior bullet in the plan plus a combined case (Test H) proving stale-skip and empty-email-unreachable can never be conflated in the same resolver call

## Task Commits

Task was executed as a plan-level TDD gate per frontmatter (`type` implicitly `tdd="true"` on the task):

1. **Task 1 RED: add failing test for resolveRecipients** - `0f9a218` (test)
2. **Task 1 GREEN: implement resolveRecipients pure recipient resolver** - `d9ef425` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: No REFACTOR commit — implementation matched the locked RESEARCH.md Code Example verbatim, no cleanup needed after GREEN._

## Files Created/Modified
- `src/utils/messagingRecipients.ts` - New pure resolver: `resolveRecipients()`, `MESSAGING_TEAM_LABELS`, `RecipientCandidate`, `RecipientSelection`
- `src/utils/__tests__/messagingRecipients.test.ts` - New unit test suite, 9 tests, zero mocking

## Decisions Made
- Resolved 58-RESEARCH.md's Open Question 1 (Assumption A3) in favor of the conservative/literal reading: a stale/deleted `personId` referenced by a role assignment is silently skipped, not counted toward `unreachableCount` — that counter is defined only for an existing `Person` record with `email === ''`.
- `MESSAGING_TEAM_LABELS` implemented as its own standalone constant (not imported from `RolesConfigPanel.vue`) per the hard constraint and 58-CONTEXT.md.
- Dedup uses a `Set<string>` of matched person ids (never a lowercased-email `Set`), matching the plan's `key_links` requirement and 58-RESEARCH.md's Don't Hand-Roll guidance.

## Deviations from Plan

None - plan executed exactly as written. The implementation is a verbatim match of the `resolveRecipients` code example already fully specified in 58-RESEARCH.md Pattern 5, as instructed by the plan's `<action>` block.

## Issues Encountered

None. TDD RED phase was executed literally: the implementation file was temporarily moved aside so the newly written test genuinely failed on module resolution (`Failed to resolve import "@/utils/messagingRecipients"`) before being restored for the GREEN commit — this avoided writing a test that "passed on first run" against an already-present implementation.

## User Setup Required

None - no external service configuration required. This module has zero Firestore/Pinia/network dependencies and is not yet called by any UI component (composer is Phase 59).

## Next Phase Readiness
- `resolveRecipients` and `MESSAGING_TEAM_LABELS` are ready for Phase 59's composer to import directly — no further resolver work needed.
- Phase 59 will also need a server-side (Cloud Functions) port of this same algorithm for send-time re-resolution (explicitly deferred, per 58-RESEARCH.md's Deferred Ideas) — that is new work in Phase 59, not a gap in this plan.
- No blockers.

---
*Phase: 58-messaging-infrastructure-settings-recipient-resolution*
*Completed: 2026-08-13*

## Self-Check: PASSED

- FOUND: src/utils/messagingRecipients.ts
- FOUND: src/utils/__tests__/messagingRecipients.test.ts
- FOUND: 0f9a218 (test commit)
- FOUND: d9ef425 (feat commit)
