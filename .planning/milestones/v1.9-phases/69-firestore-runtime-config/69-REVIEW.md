---
phase: 69-firestore-runtime-config
reviewed: 2026-08-20T19:17:41Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - functions/src/appConfig.ts
  - functions/src/index.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 69: Code Review Report

**Reviewed:** 2026-08-20T19:17:41Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed `functions/src/appConfig.ts` (new) and the 17 read-site swap in `functions/src/index.ts` against
R180-R185/R190. Verified with `cd functions && npm run build` (clean) and `cd functions && npm test`
(416/416 passing, including the new 29-test `appConfig.test.ts`).

**What's solid:**
- **Deep-merge / R182 invariant**: `mergeAppConfig` correctly reproduces `DEFAULT_APP_CONFIG` for a missing
  or empty doc, and a partial doc (e.g. `{cleanup: {mediaEnabled: true}}`) leaves every sibling default
  intact — verified by direct test and by tracing `coerceCleanup`/`coerceRetention`/`coerceAiProxy`/
  `coerceMessaging`/`coerceSender`, each of which independently defaults every field it owns rather than
  relying on a shallow spread.
- **Per-knob fail-closed knobs**: all four `cleanup.*Enabled` flags, `messaging.scheduledCronEnabled`, and
  `aiProxy.allowedModels` use `coerceEnableFlag` (`raw === true`, strict) / `coerceAllowedModels`
  (non-array/empty/malformed → the restrictive one-model default). A malformed or adversarial
  `appConfig/global` doc cannot widen any of these — it can only narrow/break them. Confirmed both by
  reading the coercion code and by the parametrized `appConfig.test.ts` cases (`"true"` string, `1`, `null`
  all resolve to `false`/the restrictive list).
- **Per-knob fail-open-capped knobs**: `coerceConfigNumber` rejects non-finite, negative, non-numeric,
  blank, and wrong-type input and falls back to the numeric default — never `0`/`Infinity`/negative — while
  correctly honoring a genuine operator-supplied `0` (the documented WR-01 zero-vs-falsy discipline).
  `deleteCapPerRun` additionally requires a positive integer via `coercePositiveInt`; `0`/`-1`/`1.5` all
  fall back to `500`. Verified by the `NaN/"abc"/-1/Infinity/null` parametrized test sweep across every
  numeric knob.
- **Caching routing (R183)**: exactly 7 call sites. The two hot paths — `api` (index.ts:552) and
  `sendQueuedMessageHandler` (index.ts:2657) — use the cached form (no `{fresh:true}`). All five cron/gate
  paths — `cleanupExpiredMediaHandler` (1041), `cleanupOrphanRendersHandler` (1206),
  `cleanupOrphanBackgroundsHandler` (1449), `cleanupPptxSourcesHandler` (1678), and
  `runScheduledMessagingCron` (2002, which gates both `sendScheduledRemindersHandler` and
  `dispatchDueScheduledMessagesHandler` — neither of which does its own separate config read) — all pass
  `{fresh: true}`. No cron reads the cached form. TTL-hit/fresh-bypass/TTL-expiry are each covered by a
  passing unit test using `vi.useFakeTimers()`.
- **R190 preserved**: `cleanupOrphanBackgroundsHandler`'s swap is exactly the documented one-line change
  (`const dryRun = !config.cleanup.backgroundEnabled;`, index.ts:1453). The `referencesComplete` three-tier
  scan, the floor guard (`referencedPaths.size === 0 && candidates.length > 0`), and
  `effectiveDryRun = dryRun || !referencesComplete` are byte-identical to the pre-swap logic.
- **`MESSAGE_FROM_ADDRESS` removal**: the `defineString` declaration is fully gone (only comments referencing
  the old name remain, for context); `sendQueuedMessageHandler` reads `config.sender.fromAddress` exclusively
  (index.ts:2848), with no competing fallback. `bareEmailAddress` correctly peels any pre-existing
  `<...>` wrapper so re-applying the org display name can't nest brackets. No secret material entered
  `appConfig/global` — `sender` carries only `fromName`/`fromAddress`, and `RESEND_API_KEY` stays a Secret
  Manager secret untouched by this phase. `sender.fromName` is defined but deliberately dormant this phase,
  matching the CONTEXT.md-locked decision (no read-site consumes it).
- `readNumericKnob` is untouched and still gates the two deploy-time-excluded knobs
  (`AI_PROXY_MAX_INSTANCES`, `GLOBAL_MAX_INSTANCES`) via `process.env` at module scope — the only two
  remaining `process.env.` references in `index.ts`, confirming the swap is complete for all 13 managed
  knobs.

## Warnings

### WR-01: Unconditional, unguarded `getAppConfig()` call makes `esv`/`nlt`/`planningcenter` proxy routes newly dependent on a Firestore read that has nothing to do with them

**File:** `functions/src/index.ts:552`
**Issue:** In the `api` handler, `const config = await getAppConfig(getFirestore());` runs unconditionally,
*before* the `if (service === "anthropic")` branch at line 554, and it is not wrapped in a `try/catch`. Prior
to this phase, `readAiProxyLimits()` was a synchronous, side-effect-free `process.env` read that could not
fail — calling it unconditionally for every service was harmless. It is now an `await`ed Firestore read that
can throw (permission error, quota, transient outage, or a malformed `appConfig/global` write that somehow
causes the SDK to reject). Because the call sits ahead of the service-type branch and has no local
`try/catch`, a failure here takes down the entire `/api` proxy for **every** service — including
`esv`/`nlt`/`planningcenter`, which have zero relationship to AI cost controls and previously had zero
Firestore dependency at all.

This directly contradicts the fail-open posture the same file establishes 15 lines later for the rate
limiter: `// Fail OPEN: the limiter is a cost guardrail, not a security control ... a Firestore hiccup must
never take AI down.` (index.ts:579-581). That guardrail-must-not-take-down-traffic philosophy was applied to
`checkAndConsumeRateLimit` but not to the new `getAppConfig()` call that sits right above it, even though
both are reads of the same class (a cost-guardrail config source, not a security boundary).

**Concrete failure scenario:** `appConfig/global`'s Firestore read throws (e.g. a transient Admin SDK
error, or the collection is temporarily unavailable). Every in-flight `/api/esv/...`, `/api/nlt/...`, and
`/api/planningcenter/...` request — none of which need `aiLimits` — now fails too, instead of only the
`anthropic` branch degrading.

**Fix:** Either move the `getAppConfig()` call inside the `if (service === "anthropic")` block (so
non-anthropic services never pay this new dependency at all), or wrap it in the same fail-open pattern
already used for the rate limiter just below it:
```typescript
let config: AppConfig = DEFAULT_APP_CONFIG;
if (service === "anthropic") {
  try {
    config = await getAppConfig(getFirestore());
  } catch (configErr) {
    console.warn("[api] appConfig read failed; failing open to defaults:", {
      message: configErr instanceof Error ? configErr.message : String(configErr),
    });
  }
  const aiLimits = readAiProxyLimits(config);
  // ...
}
```

## Info

### IN-01: Same unguarded-`getAppConfig()` pattern in `sendQueuedMessageHandler`, lower severity

**File:** `functions/src/index.ts:2657`
**Issue:** `const config = await getAppConfig(db);` runs before the idempotency-claim transaction, with no
local `try/catch`. Unlike the `api` proxy case (WR-01), this handler already has an unavoidable Firestore
dependency immediately afterward (the `runTransaction` claim), so this isn't a *new* dependency class — but
if `getAppConfig()` throws, the message is never claimed (`status` stays `'queued'`), and
`sendQueuedMessage`'s `onDocumentCreated` trigger is registered with no `retry` option, so Cloud Functions
will not automatically retry the invocation. The message would sit stuck in `'queued'` until manually
reprocessed. Worth the same fail-open wrap as WR-01 for consistency, though the blast radius (one message,
not all proxy traffic) is much smaller.
**Fix:** Wrap in `try/catch`, falling back to `DEFAULT_APP_CONFIG` on failure (mirrors WR-01's suggested fix).

### IN-02: `coerceConfigNumber` has no upper bound — a very large `deleteCapPerRun`/retention value is honored as-is

**File:** `functions/src/appConfig.ts:110-121`
**Issue:** Per R184's design, numeric knobs are "fail open but capped" only in the sense that a *malformed*
value falls back to the safe default — there is no ceiling on a *well-formed* value. A super-admin (the only
writer, per Phase 68 rules) setting `deleteCapPerRun: 999999999` or `retention.mediaDays: 0` is honored
verbatim. This is very likely intentional (an authorized admin has legitimate reason to raise or lower these
knobs), and it is not a "widen authority" gap in the sense the fail-safe table cares about (rules already
restrict who can write the doc), so this is not classified as a defect — flagged only as a documentation gap:
neither `appConfig.ts` nor the fail-safe table note that these numeric knobs are otherwise unbounded, which
the Phase 70 admin-console UI (input min/max) will need to know about when it builds the edit form.
**Fix:** No code change required for this phase; consider a one-line note in `appConfig.ts`'s coercion
comments and/or the Phase 70 SPEC that these are fail-*safe*, not fail-*bounded* — the console form should
apply its own sane input ranges.

---

_Reviewed: 2026-08-20T19:17:41Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
