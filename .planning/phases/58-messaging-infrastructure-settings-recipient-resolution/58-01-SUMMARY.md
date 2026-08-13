---
phase: 58-messaging-infrastructure-settings-recipient-resolution
plan: 01
subsystem: infra
tags: [typescript, pinia, firestore, messaging, settings]

requires: []
provides:
  - "OrgSettings.messaging block (enabled/lockNotifyDefault/reminderEnabled/reminderDaysBefore/fromName?/replyTo?) with kill-switch defaulting false"
  - "OrgSettings.timezone (IANA name, default 'America/Chicago')"
  - "Service.messaging? optional per-service override shape (null leaf = inherit org default)"
  - "src/utils/messaging.ts::isMessagingEnabled() — single client choke point"
  - "loadOrgContext deep-merges settings.messaging alongside slideTypography; flat-merges timezone"
affects: [58-04-settings-messaging-card, 58-05-service-messaging-defaults, phase-59-send-path]

tech-stack:
  added: []
  patterns:
    - "Nested OrgSettings leaf + DEFAULT_ORG_SETTINGS default + deep-merge in loadOrgContext (mirrors slideTypography/aiEnabled)"
    - "Single client choke-point gate function mirroring claudeApi.ts::isAiEnabled"

key-files:
  created:
    - src/utils/messaging.ts
    - src/utils/__tests__/messaging.test.ts
  modified:
    - src/types/organization.ts
    - src/types/service.ts
    - src/stores/auth.ts
    - src/stores/__tests__/auth.test.ts

key-decisions:
  - "DEFAULT_ORG_SETTINGS.messaging.enabled defaults false — deliberate deviation from aiEnabled/pcEnabled (default true) per R130's fail-closed requirement, asserted by a dedicated test"
  - "messaging deep-merged in loadOrgContext exactly parallel to slideTypography's WR-01 fix; timezone needs no deep-merge (flat string, outer spread covers it)"
  - "No dual-read/migration for messaging or timezone — brand-new fields with no legacy flat-field precedent"
  - "isMessagingEnabled() kept a thin, honest boolean read (no catch-wrap of the Pinia-instance-missing throw), unlike isAiEnabled's catch-wrapped callers, per 58-PATTERNS.md"

patterns-established:
  - "Per-service optional override field with null-leaf-means-inherit semantics (Service.messaging?), reusable for future per-service settings"

requirements-completed: [R130, R132, R133]

coverage:
  - id: D1
    description: "DEFAULT_ORG_SETTINGS.messaging.enabled defaults false (kill-switch fails closed); lockNotifyDefault/reminderEnabled false; reminderDaysBefore 7"
    requirement: "R130"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messaging.test.ts#DEFAULT_ORG_SETTINGS.messaging (R130)"
        status: pass
    human_judgment: false
  - id: D2
    description: "isMessagingEnabled() reads the auth store's merged settings.messaging.enabled value (single choke point)"
    requirement: "R130"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/messaging.test.ts#isMessagingEnabled (R130 — single choke point)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Service.messaging? optional override shape exists on the Service type and typechecks"
    requirement: "R132"
    verification:
      - kind: unit
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D4
    description: "loadOrgContext deep-merges a partial stored settings.messaging so unset leaves resolve to their own defaults, and resolves the full default object when the key is absent entirely"
    requirement: "R132"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings.messaging + timezone (R130/R132/R133, Phase 58)"
        status: pass
    human_judgment: false
  - id: D5
    description: "OrgSettings.timezone persists a stored value and defaults to 'America/Chicago' when omitted"
    requirement: "R133"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#OrgSettings.messaging + timezone (R130/R132/R133, Phase 58)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-13
status: complete
---

# Phase 58 Plan 1: Messaging Settings Foundation Summary

**Extended `OrgSettings`/`Service` with a fail-closed messaging kill-switch + org timezone, deep-merged both in `loadOrgContext`, and added the single `isMessagingEnabled()` choke point — no send path, UI, or Cloud Function yet.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-13T20:10:29Z
- **Tasks:** 2/2 completed
- **Files modified:** 6 (4 source, 2 test)

## Accomplishments
- `OrgSettings` gained a required `messaging` block (`enabled`, `lockNotifyDefault`, `reminderEnabled`, `reminderDaysBefore`, optional `fromName?`/`replyTo?`) and a top-level `timezone: string`; `DEFAULT_ORG_SETTINGS.messaging.enabled` defaults `false` — the deliberate fail-closed deviation from `aiEnabled`/`pcEnabled` — with `timezone` defaulting `'America/Chicago'`.
- `Service` gained an optional `messaging?` override shape (`lockNotifyEnabled`/`reminderEnabled`/`reminderDaysBefore` as `boolean|null`/`number|null`, plus Admin-SDK-only `reminderSentAt: Timestamp|null`); `null` means "inherit the org default."
- New `src/utils/messaging.ts::isMessagingEnabled()` — the single client choke point every later messaging surface will import, mirroring `claudeApi.ts::isAiEnabled`.
- `auth.ts::loadOrgContext` now deep-merges `settings.messaging` (exactly parallel to the existing `slideTypography` deep-merge) so a partial stored `messaging` object never leaves sibling leaves `undefined`; `timezone` is a flat field already covered by the existing outer `...orgSettings` spread.

## Task Commits

Each task was committed atomically (TDD RED → GREEN per task):

1. **Task 1: Extend OrgSettings/Service types + create isMessagingEnabled choke point**
   - `29393e7` (test) — messaging kill-switch default + choke-point tests
   - `ef65892` (feat) — OrgSettings/Service types + `isMessagingEnabled`
2. **Task 2: Deep-merge messaging + timezone in loadOrgContext**
   - `e5442fe` (test) — loadOrgContext messaging + timezone merge tests
   - `33640f9` (feat) — deep-merge messaging, flat-merge timezone

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

_Note: both tasks are `tdd="true"`; each shipped as a `test(...)` commit followed by a `feat(...)` commit._

## Files Created/Modified
- `src/types/organization.ts` - `OrgSettings.messaging`/`timezone` fields + `DEFAULT_ORG_SETTINGS` defaults
- `src/types/service.ts` - `Service.messaging?` optional per-service override shape
- `src/utils/messaging.ts` - NEW: `isMessagingEnabled()` single choke point
- `src/utils/__tests__/messaging.test.ts` - NEW: default-value + choke-point tests
- `src/stores/auth.ts` - `loadOrgContext` deep-merges `messaging` alongside `slideTypography`
- `src/stores/__tests__/auth.test.ts` - partial/absent-messaging merge tests + timezone default/override tests

## Decisions Made
- `DEFAULT_ORG_SETTINGS.messaging.enabled = false` (fail-closed, R130) — asserted directly by a unit test per the plan's must-haves, distinct from every other toggle in the file which defaults `true`.
- No dual-read/migration introduced for `messaging`/`timezone` (unlike `vwModeEnabled`'s legacy flat-field dual-read) — these are brand-new fields with no prior storage location, so the straight `DEFAULT ?? stored` merge is correct per 58-PATTERNS.md.
- `isMessagingEnabled()` deliberately does NOT catch-wrap the Pinia-instance-missing throw internally, unlike `isAiEnabled`'s network-call sites — kept as a thin, honest boolean read per 58-PATTERNS.md's explicit guidance, since this phase has no "never throw" contract to satisfy yet.

## Deviations from Plan

None - plan executed exactly as written. Types, merge point, and choke point match 58-PATTERNS.md's cited analogs verbatim (field shape, defaults, merge idiom).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The typed `OrgSettings.messaging`/`timezone` shape, the deep-merge point, and `isMessagingEnabled()` are all in place for 58-02 (recipient resolver), 58-04 (Settings Messaging card), and 58-05 (per-service messaging defaults panel) to build on directly.
- `Service.messaging?` is defined but not yet written from any UI — 58-05 will add `setServiceMessagingDefaults` per the `setRoleOverride`/`clearRoleOverride` dot-path pattern already cited in 58-PATTERNS.md.
- No blockers.

---
*Phase: 58-messaging-infrastructure-settings-recipient-resolution*
*Completed: 2026-08-13*

## Self-Check: PASSED

All created files found on disk; all 4 task commit hashes (29393e7, ef65892, e5442fe, 33640f9) found in git log.
