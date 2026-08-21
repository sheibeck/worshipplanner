---
phase: 69-firestore-runtime-config
plan: 01
subsystem: infra
tags: [firebase-functions, firestore, config, ttl-cache, typescript]

# Dependency graph
requires:
  - phase: 68-superadmin-console
    provides: appConfig/global Firestore security rules (super-admin-only read/write)
provides:
  - functions/src/appConfig.ts — AppConfig type, DEFAULT_APP_CONFIG, coerce* fail-safe layer, mergeAppConfig deep-merge, getAppConfig(db,{fresh?}) TTL-cached reader
  - functions/src/appConfig.test.ts — R180/R182/R183/R184 exhaustive unit coverage
affects: [69-02-index-ts-swap, 70-owner-admin-console-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scope {value, fetchedAt} TTL cache (60s) for a single Firestore doc, with a {fresh:true} bypass for cron callers"
    - "Per-knob coerce* fail-open(capped)/fail-closed layer as the input-validation boundary for an admin-editable Firestore config doc"
    - "Hand-written deep-merge over 5 known nested keys rather than a merge library"

key-files:
  created:
    - functions/src/appConfig.ts
    - functions/src/appConfig.test.ts
  modified: []

key-decisions:
  - "sender.fromName is defined in the AppConfig schema for Phase 70 forward-compatibility but stays dormant this phase — no read-site consumes it (per-message display name remains the org name, R159 unchanged); sender.fromAddress IS wired in Plan 02"
  - "coerceConfigNumber rejects negative values in addition to NaN/Infinity/non-numeric — every numeric knob it guards (rate limits, retention windows, caps, recipient/quota) is semantically non-negative, so a negative input is malformed input, not a valid edge case to honor (Rule 1 fix, surfaced while writing the parametrized R184 fail-open-capped tests against the plan's own -1 test case)"
  - "getAppConfig's cache is module-scope only (no onDocumentWritten cache-bust) per RESEARCH's per-instance global-scope argument — documented at the reader"

patterns-established:
  - "Firestore-backed runtime config reader: db: Firestore always an injected first parameter, no module-scope initializeApp()/getFirestore() (mirrors claimsHelpers.ts convention)"

requirements-completed: [R180, R182, R183, R184]

coverage:
  - id: D1
    description: "AppConfig type + DEFAULT_APP_CONFIG holding the exact current env fallback values, grouped by area (cleanup/retention/aiProxy/messaging/sender)"
    requirement: "R180"
    verification:
      - kind: unit
        ref: "functions/src/appConfig.test.ts#DEFAULT_APP_CONFIG shape > carries every documented knob with the exact default values (R180)"
        status: pass
    human_judgment: false
  - id: D2
    description: "mergeAppConfig deep-merge: a missing or partial appConfig/global doc reproduces DEFAULT_APP_CONFIG byte-for-byte, with only explicitly-set keys overriding their sibling defaults"
    requirement: "R182"
    verification:
      - kind: unit
        ref: "functions/src/appConfig.test.ts#getAppConfig: R182 empty doc reproduces defaults"
        status: pass
      - kind: unit
        ref: "functions/src/appConfig.test.ts#getAppConfig: R182 partial doc deep-merge"
        status: pass
    human_judgment: false
  - id: D3
    description: "getAppConfig(db,{fresh?}) module-scope ~60s TTL cache: two calls inside the TTL trigger exactly one Firestore read, {fresh:true} always re-reads, and a call after TTL expiry re-reads"
    requirement: "R183"
    verification:
      - kind: unit
        ref: "functions/src/appConfig.test.ts#getAppConfig: R183 TTL cache"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-knob coerce* fail-open(capped)/fail-closed layer: cleanup + cron enable flags and the AI allow-list fail CLOSED on malformed input; all numeric knobs fail OPEN but capped to their DEFAULT number, never 0/negative/Infinity"
    requirement: "R184"
    verification:
      - kind: unit
        ref: "functions/src/appConfig.test.ts#R184 fail-closed: cleanup + cron flags"
        status: pass
      - kind: unit
        ref: "functions/src/appConfig.test.ts#R184 fail-closed: aiProxy.allowedModels"
        status: pass
      - kind: unit
        ref: "functions/src/appConfig.test.ts#R184 fail open capped: numeric knobs"
        status: pass
    human_judgment: false
  - id: D5
    description: "R181/R183 live no-redeploy and real TTL-staleness behavior are deploy-dependent and cannot be proven by a unit test — deferred to manual UAT per VALIDATION.md's Manual-Only table"
    verification: []
    human_judgment: true
    rationale: "Requires an actual Cloud Functions deploy and a live appConfig/global edit to observe a config change take effect without redeploy — out of scope for this build+test-only plan (v1.9 deploy discipline: no deploys this milestone)."

duration: 22min
completed: 2026-08-20
status: complete
---

# Phase 69 Plan 01: Firestore Runtime Config Reader Summary

**New `functions/src/appConfig.ts` module: a typed, deep-merging, TTL-cached `appConfig/global` reader with a per-knob fail-open(capped)/fail-closed coercion layer, exhaustively unit-tested against the R180/R182/R183/R184 invariants.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-20T17:02:00Z (approx)
- **Completed:** 2026-08-20T17:24:24Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `AppConfig` type + `DEFAULT_APP_CONFIG` mirroring every current env/defineString fallback exactly (media/background/pptx-source 30d, orphan-render 24h, deleteCap 500, AI 20/min-500/day-2048-tokens-[claude-haiku-4-5-20251001], messaging cron off/200 recipients/1000 quota, sender fromAddress `onboarding@resend.dev`)
- Hand-written `mergeAppConfig` deep-merge over the 5 nested groups (`cleanup`, `retention`, `aiProxy`, `messaging`, `sender`) so a partial doc never wipes sibling defaults
- `coerceConfigNumber`/`coercePositiveInt`/`coerceEnableFlag`/`coerceAllowedModels`/`coerceSender` implementing the exact per-knob R184 fail-safe table
- `getAppConfig(db, {fresh?})` with a module-scope `{value, fetchedAt}` 60s-TTL cache, a `{fresh:true}` bypass, and a documented rationale for why TTL (not `onDocumentWritten` cache-busting) is the only cross-instance-correct pattern
- `appConfig.test.ts`: 29 tests covering R180 shape, R182 empty/partial deep-merge, R183 cache-hit/fresh-bypass/TTL-expiry (with asserted Firestore `.get()` call counts via `vi.useFakeTimers()`), and R184 fail-closed + fail-open-capped rows, fully parametrized

## Task Commits

Each task was committed atomically:

1. **Task 1: Create functions/src/appConfig.ts** - `89ba81e8` (feat)
2. **Task 2: Create functions/src/appConfig.test.ts** - `790bdd61` (test) — includes the Rule 1 fix to `coerceConfigNumber` (negative-value rejection) discovered while writing this task's tests

## Files Created/Modified
- `functions/src/appConfig.ts` - AppConfig type, DEFAULT_APP_CONFIG, coerce* helpers, mergeAppConfig, getAppConfig, resetAppConfigCacheForTest
- `functions/src/appConfig.test.ts` - Full R180/R182/R183/R184 unit coverage against a fake Firestore

## Decisions Made
- `sender.fromName` defined in the schema now, wired nowhere this phase (Phase 70 forward-compat placeholder; see key-decisions above)
- `coerceConfigNumber` rejects negative numbers as malformed (Rule 1 fix — see Deviations)
- Test-only cache reset exported as `resetAppConfigCacheForTest` (documented as test-only in-file) rather than reaching into module internals from the test file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `coerceConfigNumber` did not reject negative numbers, contradicting the plan's own R184 fail-open-capped test spec**
- **Found during:** Task 2 (writing the parametrized fail-open-capped numeric tests)
- **Issue:** The plan's Task 2 action explicitly lists `-1` as a malformed value that every numeric knob (not just `deleteCapPerRun`) must resolve to its capped default for. The Task 1 code (following RESEARCH.md's Pattern 3 sketch verbatim) only guarded against `NaN`/`Infinity`/non-numeric — a `-1` rate limit, retention day, or recipient cap would have been honored as-is, silently allowing a negative (nonsensical) value into a live config.
- **Fix:** Added `raw >= 0` to both branches of `coerceConfigNumber` (number and string-parsed paths), so a genuine `0` is still honored (WR-01 zero-vs-falsy is preserved) but any negative value falls back to the default, exactly like `NaN`/`Infinity`.
- **Files modified:** `functions/src/appConfig.ts`
- **Verification:** `appConfig.test.ts`'s parametrized "R184 fail open capped: numeric knobs" block asserts `-1` (alongside `NaN`/`"abc"`/`Infinity`/`null`) resolves to each knob's DEFAULT number, never a negative value; all 9 numeric knobs pass.
- **Committed in:** `790bdd61` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for R184 correctness across every numeric knob, not just `deleteCapPerRun`. No scope creep — same file, same function, tightened per the plan's own explicit test spec.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. No deploy this plan (v1.9 deploy discipline: build + test only).

## Next Phase Readiness
- `functions/src/appConfig.ts` is the config engine that Plan 02 (the 17 `index.ts` read-site swaps) imports directly — `getAppConfig`, `DEFAULT_APP_CONFIG`, and the exported coerce* helpers are all ready for that swap.
- `functions/src/index.ts` is untouched by this plan (as scoped) — the `process.env` read-sites Plan 02 swaps are still live and unaffected.
- Zero new npm dependencies added; `functions/package.json` diff is empty.
- Both required gates green: `cd functions && npm run build` (standalone tsc) and `cd functions && npx vitest run src/appConfig.test.ts` (29/29). Full `cd functions && npm test` also green (428/428, includes the new file). Root `npm run type-check` (vue-tsc --build) also clean.

---
*Phase: 69-firestore-runtime-config*
*Completed: 2026-08-20*

## Self-Check: PASSED
- FOUND: functions/src/appConfig.ts
- FOUND: functions/src/appConfig.test.ts
- FOUND: 89ba81e8
- FOUND: 790bdd61
