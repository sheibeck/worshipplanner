# Phase 69: Firestore Runtime Config - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4 (all role-match or better; no true "same role" analog exists for `appConfig.ts` itself since it is the first Firestore-backed runtime-config reader in the repo)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `functions/src/appConfig.ts` (NEW) | service/utility (config reader + cache) | request-response (read-through cache over Firestore) | `functions/src/index.ts` — `readAiProxyLimits`/`readNumericKnob`/`readDeleteCap` (defensive parsing) + `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` (module-scope value pattern) | role-match (parsing discipline exact; caching has no prior analog in-repo) |
| `functions/src/appConfig.test.ts` (NEW) | test (unit) | transform/validation | `functions/src/index.test.ts` — the `readNumericKnob`/`readDeleteCap`/`readAiProxyLimits` `describe()` blocks | role-match |
| `functions/src/index.ts` (MODIFIED, 17 read-sites) | controller/handler (`onSchedule`/`onRequest`/`onDocumentCreated`) | CRUD (cleanup deletes) + request-response (`api` proxy) + event-driven (`sendQueuedMessage`) | itself — pattern is internal consistency with the surrounding handler code that is NOT touched (R190) | exact (same file, narrow line-level swaps) |
| `functions/src/index.test.ts` (MODIFIED, ~80+ `it()` blocks) | test (unit) | transform/validation | itself — `vi.mock("./pptxParser", …)` / `vi.mock("./renderInvoker", …)` sibling-module mock pattern (lines 132-140) | exact |

## Pattern Assignments

### `functions/src/appConfig.ts` (NEW — service/utility)

**Analog 1 — defensive numeric coercion:** `functions/src/index.ts:193-207` (`readNumericKnob`)

```typescript
/**
 * WR-01 fix: parses an env-var numeric knob so an operator's explicit `0`
 * (e.g. an emergency full-stop on `AI_RATELIMIT_MAX_PER_MIN=0`) is honored
 * rather than discarded. `Number(x) || fallback` treats a genuinely-parsed
 * `0` as falsy and silently replaces it with the default -- the opposite of
 * the caller's intent. Only an unset, blank/whitespace-only, or non-numeric
 * value falls back to `fallback`.
 */
export function readNumericKnob(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}
```

`readNumericKnob` is `string | undefined` typed (env-var shaped). The new `appConfig.ts` coercion
helpers must accept `unknown` (Firestore-typed: could be a JS `number`, a stray `string`, `null`, or
absent) — RESEARCH.md's Pattern 3 (`coerceConfigNumber`) is the adapted version of this exact function
and should be copied verbatim as the starting point:

```typescript
export function coerceConfigNumber(raw: unknown, fallback: number): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : fallback;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback; // undefined, null, boolean, object, array -- all fall back
}
```

**Analog 2 — positive-int extra guard:** `functions/src/index.ts:961-964` (`readDeleteCap`)

```typescript
export function readDeleteCap(): number {
  const raw = readNumericKnob(process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN, 500);
  return Number.isInteger(raw) && raw > 0 ? raw : 500;
}
```
Copy the `Number.isInteger(raw) && raw > 0 ? raw : fallback` guard verbatim into
`appConfig.ts`'s `coercePositiveInt` for `deleteCapPerRun`.

**Analog 3 — allow-list fallback (fail-closed):** `functions/src/index.ts:209-226` (`readAiProxyLimits`)

```typescript
export function readAiProxyLimits(env: NodeJS.ProcessEnv = process.env): AiProxyLimits {
  const maxPerMin = readNumericKnob(env.AI_RATELIMIT_MAX_PER_MIN, 20);
  const maxPerDay = readNumericKnob(env.AI_RATELIMIT_MAX_PER_DAY, 500);
  const maxTokensCeiling = readNumericKnob(env.AI_MAX_TOKENS_CEILING, 2048);
  const rawModels = env.AI_ALLOWED_MODELS;
  const parsedModels = rawModels
    ? rawModels.split(",").map((m) => m.trim()).filter((m) => m.length > 0)
    : [];
  return {
    maxPerMin,
    maxPerDay,
    allowedModels: parsedModels.length > 0 ? parsedModels : DEFAULT_AI_ALLOWED_MODELS,
    maxTokensCeiling,
  };
}
```
The `parsedModels.length > 0 ? parsedModels : DEFAULT` fallback shape is the model for
`coerceAllowedModels` (array typed, filter empty/whitespace entries, fall back to the restrictive
default on empty/non-array). Note `DEFAULT_AI_ALLOWED_MODELS` (index.ts:191) is the exact source-of-truth
value (`["claude-haiku-4-5-20251001"]`) that becomes `DEFAULT_APP_CONFIG.aiProxy.allowedModels`.

**Analog 4 — module-scope value/cache pattern:** `functions/src/index.ts:237-247`
(`AI_PROXY_MAX_INSTANCES`, `GLOBAL_MAX_INSTANCES`)

```typescript
const AI_PROXY_MAX_INSTANCES = readNumericKnob(process.env.AI_PROXY_MAX_INSTANCES, 10);
const GLOBAL_MAX_INSTANCES = readNumericKnob(process.env.GLOBAL_MAX_INSTANCES, 20);
setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES });
```
This is a module-scope **constant** (computed once, at module load — the opposite of what
`appConfig.ts` needs), so it is only a partial analog: it demonstrates the "read once into
module scope" idiom this file already uses, but it is a one-shot, not a TTL-refreshed value.
There is no existing TTL-cache analog in this repo — `appConfig.ts`'s `{ value, fetchedAt }`
module-scope cache with `Date.now() - fetchedAt < TTL_MS` is new territory; copy RESEARCH.md's
Pattern 1 sketch (already vetted against Firebase's documented per-instance global-scope
semantics) rather than inventing a different shape.

**No-Firestore-`initializeApp()` convention:** mirror `functions/src/claimsHelpers.ts`'s convention
(cited in RESEARCH.md Sources) — new helper modules do not call `initializeApp()`/`getFirestore()` at
module scope; `getAppConfig(db, opts)` takes an injected `Firestore` instance as its first parameter
(testability + consistency with `runScheduledMessagingCron(db: Firestore = getFirestore())`'s existing
DI convention at index.ts:1986, RESEARCH.md's own cited example).

---

### `functions/src/appConfig.test.ts` (NEW — unit test)

**Analog:** the existing `readNumericKnob`/`readDeleteCap`/`readAiProxyLimits` `describe()` blocks in
`functions/src/index.test.ts` (imported by name — see RESEARCH.md's Pitfall 3 for the import list at
index.test.ts:16-47). Structure: one `describe()` per exported function, `it()` blocks that set the raw
input (string/number/undefined/malformed) and assert the coerced output, plus dedicated blocks for:
- R182 empty-doc-equals-defaults (`expect(await getAppConfig(fakeDb)).toEqual(DEFAULT_APP_CONFIG)`)
- R182 partial-doc-deep-merge (set one nested key, assert siblings keep defaults)
- R183 TTL cache hit / fresh bypass / TTL expiry (mock `Date.now`, assert Firestore `.get()` call count)
- R184 fail-closed / fail-open-capped, parametrized per the Per-Knob table in RESEARCH.md

---

### `functions/src/index.ts` (MODIFIED — 17 read-sites)

**Analog / governing constraint:** itself. The swap is narrow and line-level; the surrounding handler
code is the "pattern to preserve," not a pattern to copy from elsewhere.

**The R190 one-line swap — `cleanupOrphanBackgroundsHandler`, index.ts:1437-1521:**

Current enable-flag read (line 1440, INSIDE the fail-safe doc-comment block at 1438-1440):
```typescript
export async function cleanupOrphanBackgroundsHandler(): Promise<OrphanBackgroundSummary> {
  // Fail safe: only an explicit opt-in enables real deletion. Anything else --
  // unset, empty, "false", a typo -- leaves this a dry run.
  const dryRun = process.env.BACKGROUND_CLEANUP_ENABLED !== "true";

  const db = getFirestore();
  const referencedPaths = new Set<string>();
  let referencesComplete = true;
  ...
```
Required swap (per RESEARCH.md's Code Examples "Cleanup handler swap"):
```typescript
export async function cleanupOrphanBackgroundsHandler(): Promise<OrphanBackgroundSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in enables real deletion. Anything else --
  // unset, empty, malformed -- leaves this a dry run.
  const dryRun = !config.cleanup.backgroundEnabled;

  const referencedPaths = new Set<string>();
  let referencesComplete = true;
  ...
```
Everything from `referencedPaths`/`referencesComplete` (line 1443) through the floor guard (line
1499-1503: `if (referencedPaths.size === 0 && candidates.length > 0) { referencesComplete = false; }`)
and `effectiveDryRun = dryRun || !referencesComplete` (line 1505) is UNCHANGED — this is the exact
scope boundary R190 protects. Only the `getFirestore()` call moves earlier (it already existed at line
1442; reuse the same `db` binding for `getAppConfig`, do not call `getFirestore()` twice) and the
`process.env.BACKGROUND_CLEANUP_ENABLED !== "true"` literal becomes `!config.cleanup.backgroundEnabled`.

**Hot-path cached read (`api` proxy), index.ts:553:**
```typescript
// BEFORE
const aiLimits = readAiProxyLimits();
// AFTER
const config = await getAppConfig(getFirestore());
const aiLimits = config.aiProxy;
```

**Cron gate swap (`runScheduledMessagingCron`), index.ts:1986** — convert the existing `env:
NodeJS.ProcessEnv = process.env` DI param to `db: Firestore = getFirestore()` (mirrors the file's own
existing DI convention already used for `now: Date = new Date()` elsewhere), then:
```typescript
export async function runScheduledMessagingCron(db: Firestore = getFirestore()): Promise<void> {
  const config = await getAppConfig(db, { fresh: true });
  if (!config.messaging.scheduledCronEnabled) { ... }
```

**Other 3 cleanup handlers (`cleanupExpiredMediaHandler`, `cleanupOrphanRendersHandler`,
`cleanupPptxSourcesHandler`)** follow the identical one-line-enable-flag-plus-`{fresh:true}` shape as
the R190 example above; retention-day reads (`readMediaRetentionDays()` etc., e.g. index.ts:1009-1010)
and `readDeleteCap()` (index.ts:961-964) calls are replaced by `config.retention.*Days` /
`config.deleteCapPerRun` from the SAME resolved `config` object (call `getAppConfig` once per handler
invocation, not once per knob).

**`sendQueuedMessageHandler` (recipient/quota caps + sender address), index.ts:2744-2745 and 2822:**
call `getAppConfig()` ONCE at the top of the handler, before any per-recipient loop (RESEARCH.md's
explicit Anti-Pattern warning — do not call inside the loop). `MESSAGE_FROM_ADDRESS.value()` (a
`defineString`, index.ts:2487) is REPLACED outright by `config.sender.fromAddress`, not layered
alongside it.

**Post-swap regression check:** `grep process.env. functions/src/index.ts` — the only remaining hits
should be `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` (module scope, R185-excluded) and inside
`readNumericKnob`'s own signature if kept as a still-exported pure function.

---

### `functions/src/index.test.ts` (MODIFIED — env-var mutation to config-mock)

**Analog — sibling-module mock pattern, index.test.ts:132-140:**
```typescript
vi.mock("./pptxParser", () => ({
  parsePptxBuffer: vi.fn(),
}));
// parsePptxHandler must never reach this seam directly (case 6, "never
// blocks on rendering"): it queues a Firestore doc for a separate trigger
// (37-04) to pick up, and never imports/calls invokeRenderService itself.
vi.mock("./renderInvoker", () => ({
  invokeRenderService: vi.fn(),
}));
```
Apply the identical shape to `./appConfig`:
```typescript
vi.mock("./appConfig", () => ({
  getAppConfig: vi.fn(),
}));
```
Then, per RESEARCH.md's recommendation (A2), each converted `it()`/`beforeEach()` sets
`vi.mocked(getAppConfig).mockResolvedValue(<a resolved AppConfig object, built by spreading
DEFAULT_APP_CONFIG with test-specific overrides>)` instead of mutating `process.env.X`.

**Analog — the env-var mutation pattern being replaced, index.test.ts:1405-1414 (background cleanup
`describe` block):**
```typescript
afterEach(() => {
  vi.mocked(getFirestore).mockReset();
  vi.mocked(getStorage).mockReset();
  delete process.env.BACKGROUND_CLEANUP_ENABLED;
  delete process.env.STORAGE_CLEANUP_MAX_DELETES_PER_RUN;
  delete process.env.BACKGROUND_RETENTION_DAYS;
});

it("R167: deletes an aged unreferenced background when explicitly enabled, ...", async () => {
  process.env.BACKGROUND_CLEANUP_ENABLED = "true";
  ...
```
Converted shape (assertions/business-logic setup — `mockBackgroundDb`, file fixtures — UNCHANGED):
```typescript
afterEach(() => {
  vi.mocked(getFirestore).mockReset();
  vi.mocked(getStorage).mockReset();
  vi.mocked(getAppConfig).mockReset();
});

it("R167: deletes an aged unreferenced background when explicitly enabled, ...", async () => {
  vi.mocked(getAppConfig).mockResolvedValue({
    ...DEFAULT_APP_CONFIG,
    cleanup: { ...DEFAULT_APP_CONFIG.cleanup, backgroundEnabled: true },
  });
  ...
```
Apply this same before/after conversion to every `it()` across the 4 cleanup `describe()` blocks, the
`api` proxy tests, and the `sendQueuedMessage` tests (~80+ blocks per RESEARCH.md's blast-radius
estimate) — convert ALL of them in the same pass; a partial conversion produces a half-migrated file
where some tests pass for the wrong reason (RESEARCH.md's Pitfall 1).

## Shared Patterns

### Defensive coercion (numeric)
**Source:** `functions/src/index.ts:193-207` (`readNumericKnob`)
**Apply to:** every numeric field in `appConfig.ts`'s `coerce*` helpers (rate limits, retention windows,
delete cap, recipient/quota caps, `maxTokensCeiling`) — adapt from `string | undefined` input to
`unknown` input per RESEARCH.md's `coerceConfigNumber`.

### Fail-closed boolean/array coercion
**Source:** `functions/src/index.ts:209-226` (`readAiProxyLimits`'s allow-list fallback) +
`functions/src/index.ts:1438-1440` (`cleanupOrphanBackgroundsHandler`'s enable-flag fail-safe comment
style — copy the comment discipline, not just the code, onto every cleanup/messaging-cron boolean coerce
function)
**Apply to:** `coerceEnableFlag` (all 4 cleanup flags + `messaging.scheduledCronEnabled`),
`coerceAllowedModels`.

### Firestore DI convention (no module-scope `initializeApp()`)
**Source:** `functions/src/claimsHelpers.ts` (per RESEARCH.md Sources) + existing `db: Firestore`/`now:
Date` injected-default parameter convention (`runScheduledMessagingCron`, other handlers)
**Apply to:** `getAppConfig(db: Firestore, opts)` — `db` is always a caller-supplied parameter, never
resolved via a module-scope `getFirestore()` call inside `appConfig.ts` itself.

### Sibling-module `vi.mock` in index.test.ts
**Source:** `functions/src/index.test.ts:132-140` (`./pptxParser`, `./renderInvoker`)
**Apply to:** `vi.mock("./appConfig", () => ({ getAppConfig: vi.fn() }))` — the single mechanism that
converts ~80+ env-var-mutation tests to config-mock tests without touching each test's fake-`db`
builder.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `functions/src/appConfig.ts`'s TTL-cache mechanism specifically (`{ value, fetchedAt }` + `Date.now() - fetchedAt < TTL_MS`) | service/utility | read-through cache | No existing module in this repo implements a time-based cache-refresh; `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` are the closest module-scope-value idiom but are one-shot (module load), not TTL-refreshed. Use RESEARCH.md's Pattern 1 code sketch directly — it has already been validated against official Firebase per-instance global-scope docs. |

## Metadata

**Analog search scope:** `functions/src/index.ts` (3,124 lines — read via targeted `Grep`+`Read` at the
17 enumerated read-sites, no full-file load), `functions/src/index.test.ts` (mock-pattern + one
converted-`describe()` sample), `functions/src/claimsHelpers.ts` (cited, not re-read — already verified
by RESEARCH.md's Sources section for the no-module-scope-`initializeApp()` convention)
**Files scanned:** 2 source files, both already fully characterized by 69-RESEARCH.md's read-site table
**Pattern extraction date:** 2026-08-20
