---
phase: 114-multi-monitor-assignment-rework
plan: 01
subsystem: infra
tags: [monitor-config, localstorage, window-management-api, persistence]

# Dependency graph
requires: []
provides:
  - "computeFingerprints(screens) — v2 identity (label:WxH) + stable sorted-position disambiguation index"
  - "computeFingerprint(screen, allScreens?) — backward-compatible single-screen overload"
  - "matchMapping(saved, live) — delta-aware MatchResultV2 (matched | partial{kept,newScreens} | no-mapping)"
  - "MonitorAssignment.nickname?: string — validated by isValidMapping (NICKNAME_MAX_LENGTH)"
  - "MONITOR_CONFIG_STORAGE_KEY bumped to wp:runMonitorConfig:v2 (v1 data invisible)"
  - "SCREEN_QUERY_PARAM='screen' — opener->popup fingerprint hand-off contract"
affects: [114-02-monitor-setup-view, 114-03-run-control, 114-04-output-window]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Identity/disambiguation-index fingerprint split: identityKey(label:WxH) groups screens, sorted-position index disambiguates identical-model duplicates"
    - "Delta-aware match result (matched/partial/no-mapping) replacing binary matched/needs-reprompt"

key-files:
  created: []
  modified:
    - src/utils/monitorConfig.ts
    - src/utils/__tests__/monitorConfig.test.ts
    - src/views/MonitorSetupView.vue
    - .planning/codebase/ARCHITECTURE.md

key-decisions:
  - "Identity fingerprint drops left/top/isPrimary entirely (CONTEXT.md decision) — those are the macOS-volatile fields that caused both roles-don't-stick and false-reprompt bugs"
  - "computeFingerprint kept as a single-screen overload (optional allScreens param) rather than removed, to avoid churn at Wave 2 call sites that only migrate in Plans 02-04"
  - "matchMapping returns 'no-mapping' only when saved.assignments is empty; any non-empty saved mapping against a completely different live layout still returns 'partial' with kept=[] rather than a distinct status"

patterns-established:
  - "Pattern 1 (RESEARCH.md): fingerprint v2 identity/index split"
  - "Pattern 2 (RESEARCH.md): delta-aware matchMapping"

requirements-completed: [R326, R328, R338]

coverage:
  - id: D1
    description: "v2 fingerprint identity is position/isPrimary-invariant with a stable sorted-position disambiguation index for identical-model monitors"
    requirement: "R326"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts#computeFingerprint / computeFingerprints"
        status: pass
    human_judgment: false
  - id: D2
    description: "matchMapping is delta-aware — keeps matched assignments and reports only the newScreens delta on a partial layout change, instead of invalidating the whole mapping"
    requirement: "R326"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts#matchMapping (partial add/remove cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An unchanged live layout matches a saved mapping exactly (status 'matched'), producing no false reprompt"
    requirement: "R328"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts#matchMapping (matched case)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-monitor nickname persists on the assignment record, round-trips through save/load, and is validated as untrusted input (non-string/over-length rejected to null)"
    requirement: "R338"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts#saveMapping / loadMapping (nickname cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Storage key bumped to v2; a v1-key payload is invisible to v2 loadMapping (clean one-time reconfigure, no migration)"
    requirement: "R326"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/monitorConfig.test.ts#saveMapping / loadMapping (v1-key invisible case)"
        status: pass
    human_judgment: false

# Metrics
duration: 27min
completed: 2026-09-03
status: complete
---

# Phase 114 Plan 01: Monitor Config v2 Rework Summary

**Reworked the pure `monitorConfig.ts` persistence module — v2 fingerprint identity that drops the macOS-volatile `left`/`top`/`isPrimary` fields, a delta-aware `matchMapping` that keeps matched assignments instead of wiping the whole mapping, per-monitor nicknames, and a v1→v2 storage-key bump.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-09-03T11:36:05Z
- **Completed:** 2026-09-03T12:03:00Z (approx)
- **Tasks:** 3 completed
- **Files modified:** 4 (3 source/test, 1 docs)

## Accomplishments
- `computeFingerprints(screens)` groups screens by `label:WxH` identity, sorts each group by ascending `(left, top)`, and assigns a stable 0-based disambiguation index — position/isPrimary drift between macOS re-detects no longer changes a monitor's identity.
- `matchMapping` returns `MatchResultV2` (`matched | partial{kept, newScreens} | no-mapping`) — a monitor being added or removed keeps the still-matching assignments and surfaces only the delta, instead of the old bidirectional-set-equality all-or-nothing check.
- `MonitorAssignment.nickname?: string` persists on the same assignment record and round-trips through save/load/match; `isValidMapping` rejects a non-string or over-`NICKNAME_MAX_LENGTH` (60) nickname on read.
- `MONITOR_CONFIG_STORAGE_KEY` bumped `v1` → `v2`; a v1 payload is invisible to v2 `loadMapping` (clean one-time reconfigure, no in-place migration, per CONTEXT.md decision).
- `SCREEN_QUERY_PARAM = 'screen'` exported — the opener→popup fingerprint hand-off contract Plans 03/04 will consume.
- `.planning/codebase/ARCHITECTURE.md`'s `src/utils/monitorConfig.ts` note rewritten to describe the v2 fingerprint + delta-match + nickname contract, replacing the stale bidirectional-set-equality description.

## Task Commits

Each task was committed atomically:

1. **Task 1: v2 fingerprint — stable identity + sorted-position disambiguation index** - `db249fd3` (feat)
2. **Task 2: delta-aware matchMapping + storage-key bump + SCREEN_QUERY_PARAM** - `3317773c` (feat)
3. **Task 3: nickname data model + isValidMapping hardening (V5) + docs note** - `b3f65b66` (feat)

_All three tasks were `tdd="true"`; each commit bundles the source change and its corresponding test rewrite/extension together (RED+GREEN combined per-task, not split into separate test/feat commits) since the plan's `<action>` blocks specified source and test changes as one atomic unit per task._

## Files Created/Modified
- `src/utils/monitorConfig.ts` - v2 fingerprint (identityKey + computeFingerprints + backward-compatible computeFingerprint overload), MatchResultV2 + delta-aware matchMapping, MONITOR_CONFIG_STORAGE_KEY bumped to v2, SCREEN_QUERY_PARAM, MonitorAssignment.nickname + NICKNAME_MAX_LENGTH + hardened isValidMapping
- `src/utils/__tests__/monitorConfig.test.ts` - rewrote computeFingerprint block for position/primary-invariance, added computeFingerprints describe block, rewrote matchMapping describe block for matched/partial(add+remove)/no-mapping, added v1-key-invisible test, added SCREEN_QUERY_PARAM test, added nickname round-trip/reject tests
- `src/views/MonitorSetupView.vue` - fixed `screenSetKey`'s `screens.map(computeFingerprint)` (passed the function directly to `Array.map`, whose implicit `index` arg collided with the new optional `allScreens` param) to `screens.map((s) => computeFingerprint(s))`
- `.planning/codebase/ARCHITECTURE.md` - rewrote the `src/utils/monitorConfig.ts` behavioral note to the v2 contract

## Decisions Made
- Identity fingerprint drops `left`/`top`/`isPrimary` entirely rather than "softening" them (e.g. rounding/tolerance bands) — CONTEXT.md's decision was explicit that these fields are the volatile root cause, and the RESEARCH.md anti-pattern list explicitly warns against re-adding them "for safety."
- Kept a backward-compatible single-argument `computeFingerprint(screen)` overload (treated as its own lone group, `#0`) rather than requiring every call site to migrate in this plan — minimizes Wave 1 blast radius; Wave 2 plans (02-04) will pass the live `allScreens` array where correct disambiguation across multiple same-identity screens matters.
- `matchMapping`'s `'no-mapping'` status is reserved strictly for an empty `saved.assignments` array (first-run / nothing-saved-yet case); a saved mapping compared against a completely different live layout returns `'partial'` with `kept: []`, not a separate "everything changed" status — this keeps the caller's UI logic uniform (always iterate `kept` + `newScreens`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a type-check break in MonitorSetupView.vue caused by computeFingerprint's new optional parameter**
- **Found during:** Task 1 (v2 fingerprint signature change)
- **Issue:** `MonitorSetupView.vue`'s `screenSetKey` called `screens.map(computeFingerprint)`, passing the function directly as the `Array.map` callback. `Array.map`'s callback signature is `(value, index, array)`, and `computeFingerprint`'s new second parameter (`allScreens?: ScreenLike[]`) collided with `map`'s numeric `index` argument, breaking `npm run type-check` (`vue-tsc --build`, which checks `.vue` files too).
- **Fix:** Changed the call site to `screens.map((s) => computeFingerprint(s))`, an explicit single-argument wrapper.
- **Files modified:** `src/views/MonitorSetupView.vue`
- **Verification:** `npm run type-check` clean after the fix; confirmed no other call site in `src/` passes `computeFingerprint` directly as a callback (`useRunControl.ts`, test files, and `MonitorCard.test.ts` all call it explicitly with one or two arguments).
- **Committed in:** `db249fd3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the type-check gate green per CLAUDE.md; a one-line, surgical fix scoped exactly to the compile break this task's signature change caused. No scope creep — `MonitorSetupView.vue`'s actual rework (per-monitor selector, N-card state) is Plan 02's job, untouched here.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. This is a pure, framework-free localStorage module with no new dependencies.

## Next Phase Readiness

- `computeFingerprints`, the delta-aware `matchMapping`, `MonitorAssignment.nickname`, and `SCREEN_QUERY_PARAM` are all in place and unit-tested — Wave 2 plans (02 MonitorSetupView, 03 useRunControl, 04 useOutputWindow) can now consume the v2 contract.
- Full app test suite verified green at the documented baseline: 183/184 files pass; the sole failure (`src/storage.rules.test.ts`) is the pre-existing Storage-emulator `firestore.exists()` cross-service limitation documented in CLAUDE.md, unrelated to this plan.
- `npm run type-check` (`vue-tsc --build`) clean.
- No blockers for Wave 2.

---
*Phase: 114-multi-monitor-assignment-rework*
*Completed: 2026-09-03*
