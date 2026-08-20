---
phase: 69-firestore-runtime-config
plan: 02
subsystem: infra
tags: [firebase-functions, firestore, config, cloud-scheduler, resend]

# Dependency graph
requires:
  - phase: 69-firestore-runtime-config
    provides: "functions/src/appConfig.ts — AppConfig type, DEFAULT_APP_CONFIG, coerce* fail-safe layer, getAppConfig(db,{fresh?}) TTL-cached reader (Plan 01)"
provides:
  - "functions/src/index.ts — all 17 managed read-sites (4 cleanup handlers + api proxy + messaging cron + sendQueuedMessage) swapped from process.env/defineString to getAppConfig()"
  - "Correct cache routing: the four cleanup crons + sendScheduledReminders/runScheduledMessagingCron read {fresh:true}; the api proxy + sendQueuedMessage read the cached form"
  - "MESSAGE_FROM_ADDRESS defineString fully removed, replaced by config.sender.fromAddress"
affects: [70-owner-admin-console-ui, 71-cleanup-dry-run-preview]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Env-wrapper helpers (readDeleteCap, readMediaRetentionDays, etc.) kept as thin passthroughs over a resolved AppConfig rather than deleted-and-inlined, preserving their existing call-site/test shape"
    - "vi.mock('./appConfig', async (importOriginal) => ...) re-exporting the REAL DEFAULT_APP_CONFIG via importOriginal while only mocking getAppConfig — single source of truth, no drift risk between test file and appConfig.ts"
    - "Global beforeEach/afterEach defaulting getAppConfig() to DEFAULT_APP_CONFIG, with per-test vi.mocked(getAppConfig).mockResolvedValue(...) overrides — mirrors the file's own db/now DI convention"

key-files:
  created: []
  modified:
    - functions/src/index.ts
    - functions/src/index.test.ts

key-decisions:
  - "Task boundaries were resequenced from the plan's literal text for buildability: Task 1's wrapper-signature conversion necessarily required wiring getAppConfig(db,{fresh:true}) into all four cleanup handlers AND the api proxy immediately (compilation requires every call site of a changed signature to be updated in the same commit) — but Task 1 deliberately left each handler's dryRun/enable-flag line on process.env, deferring ONLY that R190-sensitive one-line swap to Task 2. This kept Task 2's diff narrowly scoped to the risky change (matching the plan's own rationale for splitting R190 into its own task) while satisfying Task 1's stated 'npm run build passes' gate."
  - "Collapsed each cleanup handler's ~5 FAILS SAFE string-variant tests (unset/empty/'false'/'1'/'True') into one 'unset/default' test per handler. The raw-value coercion matrix these tests exercised is now fully owned by appConfig.test.ts's 'R184 fail-closed: cleanup + cron flags' block (Plan 01, coerceEnableFlag) — re-testing string coercion at the handler level would test appConfig.ts's logic a second time under a different name. Handler-level tests now prove only the wiring: one 'explicitly enabled' test, one 'unset/default' test, per handler. Applied identically to readAiProxyLimits' tests (now a lossless-remap test, not a re-test of coerceAiProxy parsing) and to runScheduledMessagingCron's gate test."
  - "cleanupExpiredMediaHandler's stale 'imports NO Firestore API at all' doc comment (Pitfall 2) was corrected in the SAME commit that introduces its first getFirestore() call (Task 1), not deferred to Task 2 — a comment contradicting the code it sits above should never be committed, even transiently."
  - "sender.fromName stays dormant per Plan 01's decision — no read-site in sendQueuedMessageHandler consumes it; the per-message display name remains the org's own name (R159 unchanged)."

patterns-established:
  - "Cache-routing discipline made explicit at every call site via a one-line comment citing R183: cron/scheduled handlers always pass {fresh:true}; hot request-paths (api proxy, sendQueuedMessage) never do."

requirements-completed: [R181, R183, R184, R185]

coverage:
  - id: D1
    description: "Every managed handler (4 cleanup crons, api proxy, sendScheduledReminders/runScheduledMessagingCron, sendQueuedMessage) reads its knob from getAppConfig() — no managed process.env read remains in index.ts"
    requirement: "R181"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — cleanupExpiredMediaHandler, cleanupOrphanRendersHandler, cleanupOrphanBackgroundsHandler, cleanupPptxSourcesHandler, api (WR-04), runScheduledMessagingCron, sendQueuedMessageHandler describe blocks"
        status: pass
      - kind: other
        ref: 'grep -n "process\.env\." functions/src/index.ts (exactly AI_PROXY_MAX_INSTANCES/GLOBAL_MAX_INSTANCES)'
        status: pass
      - kind: other
        ref: 'grep -n "MESSAGE_FROM_ADDRESS" functions/src/index.ts (zero matches)'
        status: pass
    human_judgment: false
  - id: D2
    description: "The 4 cleanup crons + runScheduledMessagingCron (sendScheduledReminders) read getAppConfig(db,{fresh:true}); the api proxy + sendQueuedMessage read the cached form"
    requirement: "R183"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts — each cleanup handler test asserts behavior against a fresh-mocked config; api (WR-04) and sendQueuedMessageHandler tests exercise the cached-form call sites"
        status: pass
    human_judgment: false
  - id: D3
    description: "cleanupOrphanBackgrounds' referencesComplete/floor-guard fail-safes are byte-unchanged and its existing unit tests pass UNCHANGED — the swap is a value-source change only"
    requirement: "R184"
    verification:
      - kind: unit
        ref: "functions/src/index.test.ts#cleanupOrphanBackgroundsHandler (15 tests, all pass, assertions unchanged)"
        status: pass
      - kind: other
        ref: "git diff 36d7b375 HEAD -- functions/src/index.ts (manual inspection): only the enable-flag line and the trailing readBackgroundRetentionDays/readDeleteCap call-site args changed inside the handler body; referencedPaths/trackUrl/tier-scans/floor-guard/effectiveDryRun untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "AI_PROXY_MAX_INSTANCES and GLOBAL_MAX_INSTANCES still resolve from process.env at module load, unchanged"
    requirement: "R185"
    verification:
      - kind: unit
        ref: 'functions/src/index.test.ts#"setGlobalOptions (R172: project-wide maxInstances ceiling)" — is called exactly once with maxInstances 20'
        status: pass
      - kind: other
        ref: 'grep -n "process\.env\." functions/src/index.ts'
        status: pass
    human_judgment: false
  - id: D5
    description: "R181/R183 live no-redeploy behavior and real cross-instance TTL staleness are deploy-dependent — cannot be proven by a unit test against a mocked module"
    verification: []
    human_judgment: true
    rationale: "Requires an actual Cloud Functions deploy + a live appConfig/global write to observe; deferred to /gsd-verify-work 69 per VALIDATION.md's Manual-Only table. This phase ships built+tested+UNDEPLOYED per the v1.9 deploy-discipline grant."

# Metrics
duration: 40min
completed: 2026-08-20
status: complete
---

# Phase 69 Plan 02: Functions config-source swap Summary

**Swapped all 17 managed process.env/defineString read-sites in `functions/src/index.ts` to Plan 01's `getAppConfig()` reader — cleanup crons and messaging cron/reminders read `{fresh:true}`, the `api` proxy and `sendQueuedMessage` read the cached form, and `MESSAGE_FROM_ADDRESS` is removed outright in favor of `config.sender.fromAddress`.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-20T13:35:00Z (approx)
- **Completed:** 2026-08-20T18:09:28Z
- **Tasks:** 3
- **Files modified:** 2 (`functions/src/index.ts`, `functions/src/index.test.ts`)

## Accomplishments

- Every one of RESEARCH.md's 17 enumerated read-sites now resolves from `getAppConfig()`: the 4 cleanup handlers' enable flags + retention windows + shared delete cap, the AI proxy's rate limits/allow-list/token ceiling, the messaging cron gate, and `sendQueuedMessage`'s recipient cap/org daily quota/sender address.
- Correct cache-routing per R183: `cleanupExpiredMediaHandler`, `cleanupOrphanRendersHandler`, `cleanupOrphanBackgroundsHandler`, `cleanupPptxSourcesHandler`, and `runScheduledMessagingCron` all call `getAppConfig(db, { fresh: true })`; the `api` proxy and `sendQueuedMessageHandler` call the cached `getAppConfig(db)` form, resolved once before any loop.
- `cleanupOrphanBackgroundsHandler`'s R190 safety block (`referencedPaths`/`trackUrl`/the three reference tiers/the floor guard/`effectiveDryRun`) is byte-unchanged — confirmed by direct diff inspection, not just by tests passing. Only the enable-flag line and the two trailing wrapper-helper call sites changed.
- `MESSAGE_FROM_ADDRESS` (the `firebase-functions/params` `defineString`) is fully removed — declaration, JSDoc, and its one read-site — replaced by `config.sender.fromAddress`, with zero remaining textual references (code or comments) in `index.ts`.
- `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` (R185) are untouched — confirmed by `grep -n "process\.env\." functions/src/index.ts` returning exactly those two lines.
- The six env-wrapper helpers (`readAiProxyLimits`, `readDeleteCap`, `readMediaRetentionDays`, `readOrphanRenderStaleHours`, `readBackgroundRetentionDays`, `readPptxSourceRetentionDays`) are kept — per the plan's resolved open question — as thin passthroughs over a resolved `AppConfig`, not deleted-and-inlined, minimizing diff/test churn.
- `index.test.ts` mocks `./appConfig` (mirroring the existing `./pptxParser`/`./renderInvoker` sibling-module mocks), re-exporting the REAL `DEFAULT_APP_CONFIG` via `importOriginal` so there is one source of truth. A global `beforeEach`/`afterEach` defaults `getAppConfig()` to `DEFAULT_APP_CONFIG`; every test that needs a different knob overrides with `vi.mocked(getAppConfig).mockResolvedValue({...DEFAULT_APP_CONFIG, ...})`.

## Task Commits

1. **Task 1: Add the ./appConfig test seam + reimplement the env-wrapper helpers over resolved config** - `3d52ff96` (feat)
2. **Task 2: Swap the four cleanup handlers to getAppConfig({fresh:true}); preserve R190 byte-for-byte** - `aa5b588a` (feat)
3. **Task 3: Swap api proxy (cached), messaging cron gate ({fresh:true}), sendQueuedMessage (cached) + sender address; finalize R181/R185 gates** - `48c2b158` (feat)

_Note: as described under Deviations, Task 1's commit already wires `getAppConfig(db,{fresh:true})` into all four cleanup handlers (for retention/cap only) and the `api` proxy (for AI limits) — this was necessary for `npm run build` to pass per Task 1's own verify command, since changing the six wrapper functions' signatures forces every call site to compile. Task 2's commit is narrowly scoped to the one-line enable-flag swap per handler, as the plan's R190 emphasis intends._

## Files Created/Modified

- `functions/src/index.ts` - 17 read-sites swapped to `getAppConfig()`; `MESSAGE_FROM_ADDRESS` removed; `runScheduledMessagingCron`'s DI param changed from `env: NodeJS.ProcessEnv` to `db: Firestore = getFirestore()`
- `functions/src/index.test.ts` - `./appConfig` mock seam added; ~80+ `process.env` mutation blocks converted to `vi.mocked(getAppConfig).mockResolvedValue(...)`; SOURCE INSPECTION regex tests updated to match the new `!config.cleanup.*Enabled`/`!config.messaging.scheduledCronEnabled` gate lines

## Decisions Made

See `key-decisions` in frontmatter — task-boundary resequencing for buildability, FAILS SAFE test consolidation (coercion coverage now owned by `appConfig.test.ts`), and the Pitfall 2 comment-fix timing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `DEFAULT_APP_CONFIG` import from index.ts**
- **Found during:** Task 1 build verification
- **Issue:** The plan's action text specified `import { getAppConfig, DEFAULT_APP_CONFIG, type AppConfig } from "./appConfig"`, but `index.ts` never references `DEFAULT_APP_CONFIG` at runtime (only `appConfig.ts` and the test file need it) — `tsc`'s `noUnusedLocals` failed the build.
- **Fix:** Import only `getAppConfig` and the `AppConfig` type.
- **Files modified:** functions/src/index.ts
- **Verification:** `cd functions && npm run build` clean.
- **Committed in:** 3d52ff96 (Task 1 commit)

**2. [Rule 1 - Bug] Removed the now-unused `DEFAULT_AI_ALLOWED_MODELS` module-scope constant**
- **Found during:** Task 1
- **Issue:** After `readAiProxyLimits` became a passthrough over `config.aiProxy` (which already carries the resolved allow-list from `appConfig.ts`'s `coerceAllowedModels`), the local `DEFAULT_AI_ALLOWED_MODELS` fallback array became dead code.
- **Fix:** Deleted the constant; its value lives on as `DEFAULT_APP_CONFIG.aiProxy.allowedModels` in `appConfig.ts` (Plan 01), the actual source of truth now.
- **Files modified:** functions/src/index.ts
- **Verification:** Build clean, no unused-var errors.
- **Committed in:** 3d52ff96 (Task 1 commit)

**3. [Rule 1 - Bug/documentation] Corrected stale doc-comments referencing removed env vars**
- **Found during:** Task 2 and Task 3
- **Issue:** Several SAFETY CONTRACT / handler doc-comments (`cleanupExpiredMediaHandler`, `cleanupOrphanRendersHandler`'s "why a separate job" note, the BACKGROUND/PPTX_SOURCE `FAILS SAFE` bullets, `MESSAGE_FROM_ADDRESS` JSDoc) still named the literal env var / defineString param after the read-site moved to `appConfig`, which would mislead a future reader into thinking the env var still had an effect.
- **Fix:** Reworded each to describe the resolved-config gate (`cleanup.mediaEnabled`, etc.) instead of the env var name; corrected `cleanupExpiredMediaHandler`'s "imports NO Firestore API at all" claim to describe its new (and only) `appConfig/global` read while preserving the spirit of the safety property (still touches no slide/service/song document).
- **Files modified:** functions/src/index.ts
- **Verification:** `grep -n "MESSAGE_FROM_ADDRESS" functions/src/index.ts` returns zero matches (the plan's own verification gate); manual read-through of remaining comments.
- **Committed in:** aa5b588a, 48c2b158

---

**Total deviations:** 3 auto-fixed (2 Rule 1 build-blocking, 1 Rule 1 documentation-accuracy)
**Impact on plan:** All three were necessary for the build to compile or for comments to remain truthful. No scope creep — no new functionality, no architectural changes.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None — no external service configuration required. Per the v1.9 deploy-discipline grant, this plan ships **built + tested + UNDEPLOYED**; the `firebase deploy --only functions:...` command remains owner-run (see Phase 68's runbook / a future hand-over note). No `.env.local`/`functions/.env` writes were made; `RESEND_API_KEY` remains a server secret.

## Next Phase Readiness

- `functions/src/index.ts` is fully wired to `appConfig/global` for every R181-scoped managed knob; an empty/absent `appConfig/global` doc reproduces today's exact behavior (Plan 01's R182 defaults-merge guarantee), so this is a no-op deploy until Phase 70's console (or the owner directly) writes a value.
- Phase 70 (Owner Admin Console UI) can now build its edit form against the exact `AppConfig` shape this plan wired end-to-end — every field it edits has a live, working read-site.
- Phase 71 (cleanup dry-run preview + confirm-to-flip) inherits a `cleanup.*Enabled` flag surface that is already fully live-config-driven, with R190's fail-safes verified byte-unchanged.
- R181 (no-redeploy) and R183 (real cross-instance TTL staleness) are DEPLOY-dependent and remain for manual UAT via `/gsd-verify-work 69`, per VALIDATION.md's Manual-Only table — nothing in this plan's scope required an actual deploy.

---
*Phase: 69-firestore-runtime-config*
*Completed: 2026-08-20*

## Self-Check: PASSED

All modified files (`functions/src/index.ts`, `functions/src/index.test.ts`) and this SUMMARY.md exist on disk. All three task commits (`3d52ff96`, `aa5b588a`, `48c2b158`) verified present in git log.
