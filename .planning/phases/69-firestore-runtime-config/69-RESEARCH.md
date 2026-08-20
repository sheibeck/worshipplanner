# Phase 69: Firestore Runtime Config - Research

**Researched:** 2026-08-20
**Domain:** Cloud Functions v2 runtime configuration — Firestore-backed config doc replacing `process.env`/`defineString` knobs, with per-knob fail-safe defaults and asymmetric caching
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Config document (R180, R182)**
- One singleton doc **`appConfig/global`** (top-level collection, sibling of `aiUsage`/`aiRateLimits`). Rules
  already gate it to super-admins only (Phase 68 68-03).
- **Shape mirrors the env knobs, grouped by area** (nested objects), e.g.:
  - `cleanup`: `{ mediaEnabled, pptxRenderEnabled, backgroundEnabled, pptxSourceEnabled }` (booleans),
    `retention`: `{ mediaDays, orphanRenderStaleHours, backgroundDays, pptxSourceDays }` (numbers),
    `deleteCapPerRun` (number).
  - `aiProxy`: `{ rateLimitPerMin, rateLimitPerDay, allowedModels (string[]), maxTokensCeiling }`.
  - `messaging`: `{ scheduledCronEnabled (bool), maxRecipients, orgDailyEmailQuota }`.
  - `sender`: `{ fromName, fromAddress }` (non-secret only — the Resend KEY never lives here).
  - Plus provenance `updatedBy` (uid) + `updatedAt` (timestamp) — written by the Phase 70 save path, read
    here harmlessly if present.
- **`DEFAULT_APP_CONFIG`** holds the EXACT current env fallback values (media 30d, orphan-render 24h,
  background 30d, pptx-source 30d, deleteCap 500, ai 20/min, 500/day, allowedModels
  [`claude-haiku-4-5-20251001`], maxTokens 2048, messaging cron OFF, maxRecipients 200, orgDailyQuota 1000).
  A missing/empty doc is **deep-merged onto the defaults**, so it reproduces today's behavior byte-for-byte
  (R182). Every field is independently optional — a partial doc fills only the keys it sets.

**The reader + caching (R181, R183)**
- One shared `getAppConfig(db, { fresh?: boolean })` helper (new `functions/src/appConfig.ts`).
- **Hot paths** (`api` proxy, `sendQueuedMessage`) call the cached form: a module-scope
  `{ value, fetchedAt }` object with a **~60s TTL** re-read (NOT an `onDocumentWritten` cache-bust — a
  trigger can't reach sibling warm instances; a TTL re-read is the only cross-instance-correct pattern and
  is simpler). One extra Firestore read per ~60s per warm instance — negligible, and it protects the v1.8
  hot-path cost work.
- **Cron paths** (the four daily cleanup crons + `sendScheduledReminders`) call `getAppConfig(db, {fresh:
  true})` — a fresh read every invocation (an extra read once/run is trivially cheap, and correctness for an
  emergency disable / the song-background guarantee matters more than a cached stale value). So a flag
  flipped off takes effect on the very NEXT scheduled run.

**Per-knob fail-safe defaults (R184)**
- On a missing/malformed value, resolve PER KNOB, never one blanket policy:
  - **Fail CLOSED (restrictive):** the four cleanup enable flags → treat as OFF/dry-run; the AI model
    allow-list → the restrictive default list (never "allow all models"); the messaging cron flag → OFF.
  - **Fail OPEN but capped:** the AI rate limits → fall back to the capped default numbers (never unlimited);
    retention windows / deleteCap / recipient cap / org quota → the default numbers.
- Type coercion is defensive (mirror the existing `readNumericKnob` zero-vs-falsy handling) — a string,
  NaN, negative, or wrong-type value falls back to the default, not to `0`/`undefined`.

**Excluded knobs (R185)**
- `AI_PROXY_MAX_INSTANCES`, `GLOBAL_MAX_INSTANCES`, and the Cloud Run render-service caps are Cloud Functions
  v2 **deploy-time** settings read at module load — they CANNOT be live-config. They STAY `process.env` /
  deploy-time. They are NOT part of `appConfig/global`. (Phase 70 may surface them read-only, labeled
  "requires redeploy" — not this phase.)

**The functions swap (R181, R190-preserving)**
- Replace each managed `process.env.X` read in `functions/src/index.ts` (and any helper like
  `readAiProxyLimits`/`readNumericKnob` call-sites) with a value from `getAppConfig()`:
  the four cleanup enable/retention/cap reads, the AI proxy limits, the messaging recipient/quota/cron reads,
  and the Resend From address.
- **`cleanupOrphanBackgroundsHandler` swap is a ONE-LINE change to the enable-flag read only** — the
  `referencesComplete` / floor-guard fail-safes and the song-linked-background protection are NOT touched;
  its existing unit tests must pass UNCHANGED (this is R190's guarantee, verified hard in Phase 71).
- Each swap is behavior-preserving while `appConfig/global` is empty (the defaults-merge guarantee), so this
  phase's deploy is a no-op change until the owner (or Phase 70 UI) writes a value.

**Deploy discipline (v1.9 grant)**
- The functions change ships **built + tested + UNDEPLOYED**; the `firebase deploy --only functions:…`
  command is handed to the owner (add to / reference the Phase 68 runbook or a new hand-over note). Even
  though an empty-doc deploy is behavior-neutral, all deploys this milestone are owner-run. No
  `.env.local`/`functions/.env` writes; the `RESEND_API_KEY` stays a server secret, never in `appConfig`.

### Claude's Discretion
- Exact field names within `appConfig/global` (camelCase grouping above is the intent; match repo
  conventions), the `appConfig.ts` module's internal structure, TTL constant (60s is fine; 30–60s all safe),
  and whether the fresh-read is a `{fresh:true}` option or a separate `getAppConfigFresh()` export.
- Whether to add a light schema/validation layer in `getAppConfig` beyond the per-knob coercion (keep it
  proportional — no new validation library, mirror `readNumericKnob`).

### Deferred Ideas (OUT OF SCOPE)
- The admin console UI that edits `appConfig/global`, effective-value display, provenance stamp surfacing,
  and the no-reply sender FORM → Phase 70.
- The dry-run cleanup blast-radius preview + confirm-to-flip → Phase 71.
- Surfacing the read-only `*_MAX_INSTANCES` / render-service caps in the console → Phase 70 (optional).
- The `appConfig/*` Firestore rules → already shipped in Phase 68 (68-03); not re-touched here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R180 | The v1.8 levers are stored in an admin-only `appConfig/global` Firestore doc: the four `*_CLEANUP_ENABLED` flags, retention windows, delete cap, AI-proxy knobs, and messaging knobs. | See "Standard Stack" `AppConfig` shape table and "The exact env-fallback default values" table — every field enumerated with its current default and source read-site. |
| R181 | Cloud Functions read each managed value from `appConfig/global` at runtime; a console change takes effect without a redeploy. | See "Every managed `process.env`/`defineString` read-site" table + "`getAppConfig` design" — confirms which reads move and why a redeploy is no longer required for those knobs (contrast with R185's exclusions). |
| R182 | A missing/empty doc reproduces today's exact behavior — defaults deep-merged. | See "`DEFAULT_APP_CONFIG` + deep-merge" and Validation Architecture's `R182` row (the empty-doc-equals-today invariant test). |
| R183 | TTL cache on hot paths (`api`, `sendQueuedMessage`); fresh reads on the crons + `sendScheduledReminders`. | See "Caching design" — cites Firebase's own docs on per-instance global scope to justify why TTL, not `onDocumentWritten` cache-busting, is correct; Validation Architecture's cron-fresh-vs-hot-cached test. |
| R184 | Per-knob fail-open/fail-closed defaults, never one blanket policy. | See "Per-knob fail-open/fail-closed table" — every knob classified, with the existing `readNumericKnob`/`readDeleteCap` coercion precedent to mirror. |
| R185 | `*_MAX_INSTANCES` / render-service caps stay deploy-time, not live-editable. | See "Excluded knobs" — cites `firebase-functions` Params-API research confirming `defineString`/module-load values are deploy-time-resolved, and explains structurally why `setGlobalOptions`/`maxInstances` cannot become a runtime read. |
</phase_requirements>

## Summary

This phase is a mechanical-but-precise config-source swap inside a single file, `functions/src/index.ts`
(3,124 lines), plus one new module, `functions/src/appConfig.ts`. There are **exactly 13 managed knobs**
across 4 cleanup handlers, 1 AI-proxy limiter, 1 messaging cron gate, 2 messaging send-loop caps, and 1
sender address — every one already has a documented default and an existing defensive-parsing helper
(`readNumericKnob`) to reuse the discipline of, not the call site of. Two knobs are structurally excluded
(`AI_PROXY_MAX_INSTANCES`, `GLOBAL_MAX_INSTANCES`) because they are Cloud Functions v2 **deploy-time**
settings evaluated once at module load via `setGlobalOptions`/`onRequest({maxInstances})`, before any
per-invocation Firestore read is even architecturally meaningful — confirmed against official Firebase docs
this session, not assumed.

The single highest-risk element is **test-suite blast radius, not the swap logic itself.** `functions/src/index.test.ts`
currently drives dozens of cleanup/proxy/send tests by mutating `process.env.X` directly in `beforeEach`/`afterEach`.
Every one of those tests needs its setup mechanism changed to inject a resolved config object instead of an
env var — the assertions and business logic (referencesComplete, floor-guard, dry-run-never-capped, etc.)
do not change, but ~80+ individual `it()` blocks touch this seam. The research below recommends mocking the
new `./appConfig` module the same way `./pptxParser`/`./renderInvoker` are already mocked in this file
(swap-in a resolved `AppConfig` object per test), rather than wiring a Firestore-doc mock into every existing
fake-`db` builder — this is the lower-total-diff option and keeps the merge/coercion logic itself covered by
a dedicated, focused `appConfig.test.ts`.

The second-highest-risk element is `MESSAGE_FROM_ADDRESS`: it is **not** a `process.env` read today — it is
a `firebase-functions/params` `defineString`, which this session's research confirms is deploy-time-resolved
(the CLI bakes its value into the deployed instance's `process.env.<PARAM_NAME>` at deploy time; `.value()`
at runtime just reads that already-fixed value). It therefore cannot become live-editable by simply "reading
it later" — the read-site at `MESSAGE_FROM_ADDRESS.value()` must be replaced outright by
`config.sender.fromAddress`, not supplemented.

**Primary recommendation:** Build `functions/src/appConfig.ts` as a single `AppConfig` type +
`DEFAULT_APP_CONFIG` constant + a deep-merge `getAppConfig(db, {fresh?})` reader with a module-scope
`{value, fetchedAt}` 60s-TTL cache; give it its own exhaustive unit-test file covering the R182 invariant and
every R184 fail-safe row; then do the 13 read-site swaps in `index.ts` as narrow, single-purpose edits, each
verified against its existing test block (converted from env-var to config-object injection) plus one new
"reads from config, not env" regression test per site.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `appConfig/global` document storage | Database / Storage (Firestore) | — | Already exists as a rules-gated collection (Phase 68); this phase only defines/reads its shape, no rules change |
| Config read + defaults-merge + coercion | API / Backend (Cloud Functions, `appConfig.ts`) | — | Admin SDK bypasses rules; this is server-only logic, never exposed to the browser |
| Per-request/per-invocation cache (TTL vs fresh) | API / Backend (Cloud Functions, module scope) | — | Cache lifetime is bound to a single warm Cloud Run instance's process memory — a backend-only concept, no client analog |
| Cleanup enable flags + retention + delete cap | API / Backend (`onSchedule` handlers) | — | Storage-deletion decisions must be server-side, gated by the config read |
| AI proxy rate limits / model allow-list / token ceiling | API / Backend (`api` onRequest handler) | — | Enforced server-side on the request already authenticated by `verifyAppCaller` |
| Messaging cron gate + recipient/quota caps | API / Backend (`onSchedule`/`onDocumentCreated` handlers) | — | Send-path guardrails, no client involvement |
| No-reply sender address (read-side only, this phase) | API / Backend (`sendQueuedMessageHandler`) | — | The EDIT form and effective-value display are Phase 70 (Frontend); this phase only swaps the functions-side read |
| `*_MAX_INSTANCES` / render-service caps | API / Backend (deploy-time, `setGlobalOptions`/CLI flags) | — | Structurally excluded — Cloud Functions v2 control-plane scaling settings, resolved before any per-invocation code runs |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | `^13.10.0` (installed; verified via `functions/package.json`) [VERIFIED: functions/package.json] | `getFirestore()` reads for `appConfig/global` | Already the only Firestore/Auth touchpoint in Functions — zero new dependency |
| `firebase-functions` | `^7.2.5` (installed) [VERIFIED: functions/package.json] | `onSchedule`/`onRequest`/`onDocumentCreated` wrappers, unchanged this phase | Already in use; `onDocumentWritten` considered for cache-busting and explicitly rejected (see Architecture Patterns) |

### Supporting

None — no new runtime dependency is required. `.planning/research/SUMMARY.md` (v1.9 milestone research,
2026-08-20) independently verified this same conclusion via live `npm view` queries against `zod`,
`node-cache`, and `lru-cache`, and rejected all three as unnecessary for caching exactly one document.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `{value, fetchedAt}` TTL cache | `node-cache` / `lru-cache` | Rejected — caching a single document does not need an eviction policy or key-space management; adds a dependency for zero benefit |
| `getAppConfig(db, {fresh})` TTL/fresh split | `onDocumentWritten` cache-bust (clear a module var on write) | Rejected — a Cloud Functions v2 instance's global scope is per-instance-process memory (confirmed against Firebase's own docs, see Architecture Patterns); a trigger firing in one instance cannot reach another warm instance's variable, so cache-busting is provably incomplete for a fan-out of >1 instance |
| Deep-merge via small hand-written helper | `lodash.merge` / `deepmerge` npm package | Rejected — the merge is exactly 5 known nested object keys (`cleanup`, `retention`, `aiProxy`, `messaging`, `sender`), a ~15-line function suffices, and the codebase has zero existing lodash dependency to piggyback on |
| Firestore-backed `appConfig/global` | Firebase Remote Config | Rejected in `.planning/research/SUMMARY.md` — a second, architecturally inconsistent config surface; not revisited here |

**Installation:** None required — no `npm install` for this phase.

## Package Legitimacy Audit

**Not applicable — no external packages are introduced in this phase.** Every capability (Firestore reads,
TTL caching, deep-merge, defensive coercion) is covered by `firebase-admin`/`firebase-functions`, both
already installed and already used identically elsewhere in `functions/src/index.ts`. Confirmed directly
against `functions/package.json` [VERIFIED: functions/package.json] and cross-checked against
`.planning/research/SUMMARY.md`'s independent live-registry verification for this same milestone.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │   appConfig/global (Firestore) │
                         │   (Phase 68 rules: super-admin  │
                         │    read/write only; Admin SDK   │
                         │    bypasses rules to read)       │
                         └───────────────┬─────────────────┘
                                         │ db.collection('appConfig').doc('global').get()
                                         ▼
                         ┌─────────────────────────────────────┐
                         │  functions/src/appConfig.ts (NEW)      │
                         │  getAppConfig(db, { fresh? })          │
                         │                                         │
                         │  ┌─────────────┐   TTL check (60s)      │
                         │  │ module-scope│──────┐                 │
                         │  │ {value,     │      │ stale or fresh: │
                         │  │  fetchedAt} │◄─────┘ true → re-read  │
                         │  └─────────────┘                        │
                         │       │                                 │
                         │       ▼                                 │
                         │  deepMerge(DEFAULT_APP_CONFIG, docData)  │
                         │       │                                 │
                         │       ▼                                 │
                         │  per-field defensive coercion            │
                         │  (fail-closed / fail-open-capped table)  │
                         └───────────────┬───────────────────────┘
                                         │ resolved AppConfig
                    ┌────────────────────┼──────────────────────────────┐
                    ▼ (cached, {fresh:false})               ▼ (fresh, {fresh:true})
        ┌───────────────────────┐               ┌───────────────────────────────┐
        │ HOT PATHS               │               │ CRON PATHS                     │
        │ - api (onRequest)       │               │ - cleanupExpiredMedia           │
        │   → readAiProxyLimits   │               │ - cleanupOrphanRenders          │
        │ - sendQueuedMessage     │               │ - cleanupOrphanBackgrounds      │
        │   (onDocumentCreated)   │               │   ★ ONE-LINE enable-flag swap  │
        │   → recipient/quota cap │               │     only — referencesComplete/  │
        │   → sender.fromAddress  │               │     floor-guard UNTOUCHED       │
        └───────────────────────┘               │ - cleanupPptxSources            │
                                                  │ - sendScheduledReminders +      │
                                                  │   dispatchDueScheduledMessages  │
                                                  │   (via runScheduledMessagingCron)│
                                                  └───────────────────────────────┘

        EXCLUDED (never reach appConfig; stay process.env, deploy-time):
        ┌────────────────────────────────────────────────────────────┐
        │ AI_PROXY_MAX_INSTANCES → onRequest({maxInstances})            │
        │ GLOBAL_MAX_INSTANCES  → setGlobalOptions({maxInstances})      │
        │   both evaluated ONCE at module load, before ANY Firestore    │
        │   read is architecturally reachable — resolved at deploy      │
        │   time by the Cloud Functions v2 / Cloud Run control plane.   │
        │ render-service caps  → gcloud run deploy --max-instances flag │
        │   (a wholly separate Cloud Run service, no Functions code     │
        │   reads it at all)                                             │
        └────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
functions/src/
├── appConfig.ts          # NEW — AppConfig type, DEFAULT_APP_CONFIG, getAppConfig(db, {fresh?})
├── appConfig.test.ts      # NEW — merge/coercion/cache unit tests (R182, R183, R184 owned here)
├── index.ts               # MODIFIED — 13 read-sites swapped to getAppConfig() calls
└── index.test.ts          # MODIFIED — cleanup/proxy/send test setup converted env→config-mock
```

### Pattern 1: Module-scope TTL cache, not trigger-based invalidation

**What:** A plain object at module scope in `appConfig.ts` — `{ value: AppConfig | null, fetchedAt: number }`
— checked against `Date.now() - fetchedAt < TTL_MS` on every cached call; a `{fresh:true}` call always
re-reads regardless of cache state.

**When to use:** Every hot-path call site (`api`, `sendQueuedMessage`) uses the cached form; every
cron/scheduled call site uses `{fresh:true}`.

**Why not `onDocumentWritten` cache invalidation:** Firebase's own documentation on Cloud Functions v2 global
scope states global variables are created "once per function instance, and share it across all function
invocations reaching the given instance" [CITED: firebase.google.com/docs/functions/tips]. A Cloud Functions
v2 deployment can — and under load, will — run multiple concurrent instances, each its own OS process with
its own memory. An `onDocumentWritten` trigger firing on `appConfig/global`'s update runs as its OWN
invocation, on whichever instance the platform happens to route it to; it has no mechanism to reach into a
sibling instance's in-memory `{value, fetchedAt}` variable and clear it. A cache-bust design would therefore
work only for however many of N warm instances the bust invocation happens to share a process with (at most
one), leaving every other warm instance serving a stale value until IT independently re-reads. A TTL is the
only pattern that is correct regardless of instance count. Confidence: HIGH — this is a direct architectural
consequence of documented per-instance global scope, not a speculative claim.

**Example:**
```typescript
// functions/src/appConfig.ts (new file, no analog in this repo — closest precedent is
// readAiProxyLimits' env: NodeJS.ProcessEnv = process.env DI pattern)
import type { Firestore } from "firebase-admin/firestore";

const CONFIG_DOC_PATH = ["appConfig", "global"] as const;
const TTL_MS = 60_000; // 60s — CONTEXT.md's own suggested number; 30-60s all safe per Claude's Discretion

let cache: { value: AppConfig; fetchedAt: number } | null = null;

export async function getAppConfig(
  db: Firestore,
  opts: { fresh?: boolean } = {},
): Promise<AppConfig> {
  const now = Date.now();
  if (!opts.fresh && cache && now - cache.fetchedAt < TTL_MS) {
    return cache.value;
  }
  const snap = await db.collection(CONFIG_DOC_PATH[0]).doc(CONFIG_DOC_PATH[1]).get();
  const raw = snap.exists ? (snap.data() as Partial<AppConfig> | undefined) : undefined;
  const resolved = mergeAppConfig(raw);
  cache = { value: resolved, fetchedAt: now };
  return resolved;
}
```

### Pattern 2: Deep-merge defaults, never shallow Object.assign

**What:** `DEFAULT_APP_CONFIG` is deep-merged with any partial Firestore doc data, one nested key at a time
(`cleanup`, `retention`, `aiProxy`, `messaging`, `sender`), so a doc that sets only `cleanup.mediaEnabled`
does not wipe the sibling `cleanup.pptxRenderEnabled`/`backgroundEnabled`/`pptxSourceEnabled` defaults.

**When to use:** Every call inside `mergeAppConfig`/`getAppConfig` — this is the single mechanism that makes
R182 ("a missing or empty doc reproduces today's exact behavior") true for a *partial* doc too, not only a
fully-absent one.

**Example:**
```typescript
export interface AppConfig {
  cleanup: {
    mediaEnabled: boolean;
    pptxRenderEnabled: boolean;
    backgroundEnabled: boolean;
    pptxSourceEnabled: boolean;
  };
  retention: {
    mediaDays: number;
    orphanRenderStaleHours: number;
    backgroundDays: number;
    pptxSourceDays: number;
  };
  deleteCapPerRun: number;
  aiProxy: {
    rateLimitPerMin: number;
    rateLimitPerDay: number;
    allowedModels: string[];
    maxTokensCeiling: number;
  };
  messaging: {
    scheduledCronEnabled: boolean;
    maxRecipients: number;
    orgDailyEmailQuota: number;
  };
  sender: {
    fromName: string;
    fromAddress: string;
  };
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  cleanup: {
    mediaEnabled: false,          // MEDIA_CLEANUP_ENABLED unset today == dry-run
    pptxRenderEnabled: false,     // PPTX_RENDER_CLEANUP_ENABLED unset today == dry-run
    backgroundEnabled: false,     // BACKGROUND_CLEANUP_ENABLED unset today == dry-run
    pptxSourceEnabled: false,     // PPTX_SOURCE_CLEANUP_ENABLED unset today == dry-run
  },
  retention: {
    mediaDays: 30,                // RETENTION_DAYS constant, index.ts:1000
    orphanRenderStaleHours: 24,   // ORPHAN_RENDER_STALE_HOURS constant, index.ts:1161
    backgroundDays: 30,           // BACKGROUND_RETENTION_DAYS constant, index.ts:1379
    pptxSourceDays: 30,           // PPTX_SOURCE_RETENTION_DAYS constant, index.ts:1625
  },
  deleteCapPerRun: 500,           // readDeleteCap() fallback, index.ts:962
  aiProxy: {
    rateLimitPerMin: 20,          // readAiProxyLimits fallback, index.ts:210
    rateLimitPerDay: 500,         // readAiProxyLimits fallback, index.ts:211
    allowedModels: ["claude-haiku-4-5-20251001"], // DEFAULT_AI_ALLOWED_MODELS, index.ts:191
    maxTokensCeiling: 2048,       // readAiProxyLimits fallback, index.ts:212
  },
  messaging: {
    scheduledCronEnabled: false,  // SCHEDULED_MESSAGING_CRON_ENABLED unset today == off, index.ts:1986
    maxRecipients: 200,           // MESSAGE_MAX_RECIPIENTS fallback, index.ts:2744
    orgDailyEmailQuota: 1000,     // ORG_MAX_EMAILS_PER_DAY fallback, index.ts:2745
  },
  sender: {
    fromName: "",                 // NEW field — no existing global override exists today (see Open Questions)
    fromAddress: "onboarding@resend.dev", // MESSAGE_FROM_ADDRESS defineString default, index.ts:2488
  },
};

function mergeAppConfig(partial: Partial<AppConfig> | undefined): AppConfig {
  const p = partial ?? {};
  return {
    cleanup: { ...DEFAULT_APP_CONFIG.cleanup, ...coerceCleanup(p.cleanup) },
    retention: { ...DEFAULT_APP_CONFIG.retention, ...coerceRetention(p.retention) },
    deleteCapPerRun: coercePositiveInt(p.deleteCapPerRun, DEFAULT_APP_CONFIG.deleteCapPerRun),
    aiProxy: { ...DEFAULT_APP_CONFIG.aiProxy, ...coerceAiProxy(p.aiProxy) },
    messaging: { ...DEFAULT_APP_CONFIG.messaging, ...coerceMessaging(p.messaging) },
    sender: { ...DEFAULT_APP_CONFIG.sender, ...coerceSender(p.sender) },
  };
}
```
*(The `coerce*` helpers apply the fail-open/fail-closed table below — sketched in "Code Examples".)*

### Pattern 3: Defensive numeric coercion — mirror `readNumericKnob`'s zero-vs-falsy fix, adapted for `unknown`

**What:** `readNumericKnob(raw: string | undefined, fallback)` exists today specifically to fix a documented
bug (WR-01, cited in-file) where `Number(x) || fallback` silently discarded an operator's genuine `0`. That
same discipline — a real, in-range value is honored even if falsy; only `undefined`/non-numeric/blank falls
back — must be reproduced for Firestore-typed input, which is `unknown` (could be a JS `number`, a stray
`string`, `null`, or absent) rather than always-a-string like `process.env`.

**When to use:** Every numeric field in `coerce*` (rate limits, retention windows, delete cap, recipient/quota
caps, `maxTokensCeiling`).

**Example:**
```typescript
/** Mirrors readNumericKnob's zero-vs-falsy discipline (index.ts's documented WR-01 fix),
 * adapted for a Firestore field typed `unknown` instead of always-a-string env var. */
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
  return fallback; // undefined, null, boolean, object, array — all fall back
}

/** deleteCapPerRun additionally requires a POSITIVE integer, mirroring readDeleteCap()'s
 * `Number.isInteger(raw) && raw > 0 ? raw : 500` extra guard beyond plain readNumericKnob. */
function coercePositiveInt(raw: unknown, fallback: number): number {
  const n = coerceConfigNumber(raw, fallback);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Fail-CLOSED boolean coercion for cleanup/messaging-cron flags: only a literal
 * `true` enables; anything else (missing, "true" string, 1, null) resolves to false —
 * mirrors the existing `process.env.X !== "true"` dry-run gate direction exactly. */
function coerceEnableFlag(raw: unknown): boolean {
  return raw === true;
}

/** Fail-CLOSED allow-list coercion: an empty/non-array/malformed value falls back to
 * the restrictive default list — mirrors readAiProxyLimits' existing
 * `parsedModels.length > 0 ? parsedModels : DEFAULT_AI_ALLOWED_MODELS` fallback. */
function coerceAllowedModels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_APP_CONFIG.aiProxy.allowedModels;
  const models = raw.filter((m): m is string => typeof m === "string" && m.trim().length > 0);
  return models.length > 0 ? models : DEFAULT_APP_CONFIG.aiProxy.allowedModels;
}
```

### Pattern 4: `defineString` is deploy-time — cannot be "read later" to become live

**What:** `MESSAGE_FROM_ADDRESS = defineString("MESSAGE_FROM_ADDRESS", {default: "onboarding@resend.dev"})`
(index.ts:2487) is a `firebase-functions/params` construct, not a `process.env` read. This session's research
confirms `defineString` values are resolved **both at deploy time (CLI parameter resolution) and at
runtime via `.value()`**, but the runtime value is the one baked in during that specific deploy — it cannot
change without a new `firebase deploy` [CITED: firebase.google.com/docs/functions/config-env]. The read-site
at index.ts:2822 (`bareEmailAddress(MESSAGE_FROM_ADDRESS.value())`) must therefore be **replaced outright**
by `bareEmailAddress(config.sender.fromAddress)`, not layered alongside the `defineString` param — leaving
both would create two competing sources of truth for the same value, with the `defineString` one silently
winning if the swap is done incompletely (e.g., left as a fallback inside `coerceSender`).

**When to use:** The one `sendQueuedMessageHandler` read-site. `SERVICE_SHARE_BASE_URL` and
`PPTX_RENDER_SERVICE_URL` (the other two `defineString`s in this file) are explicitly OUT of scope per
CONTEXT.md — leave them untouched.

### Anti-Patterns to Avoid

- **Reading `getAppConfig()` per-recipient inside the `sendQueuedMessage` send loop:** call it ONCE at the
  top of `sendQueuedMessageHandler`, before the loop — the loop can iterate hundreds of recipients
  (`MESSAGE_MAX_RECIPIENTS` default 200), and a cached-with-TTL call is still a network round-trip on a
  cache miss; calling it inside the loop risks N Firestore reads instead of 1.
- **Reusing the cached form inside a cron:** even though the TTL cache would "work" if a cron happened to
  share a warm instance with a recent `api` call, that is incidental and non-deterministic — crons must
  always pass `{fresh: true}` explicitly, never rely on an accidentally-warm cache.
- **Treating `sender.fromName` as already wired to the send path:** the current code never reads a
  *configurable* display name — it always uses the org's own name (`orgSnap.data().name`, sanitized via
  `fromDisplayName`). Storing `sender.fromName` in `appConfig/global` without deciding whether/how it
  overrides the per-org name is a scope trap — see Open Questions.
- **Removing `readNumericKnob`/`readDeleteCap`/`readMediaRetentionDays`/etc. as dead code:** these are
  directly imported and unit-tested by name in `index.test.ts` (see the import list at lines 16-47). Deleting
  them breaks ~10+ unrelated `describe()` blocks. Keep them (their fallback constants ARE
  `DEFAULT_APP_CONFIG`'s source of truth) or replace them 1:1 with equivalent focused tests — never a silent
  removal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config caching | A generic cache library (`node-cache`/`lru-cache`) | The existing `{value, fetchedAt}` module-scope pattern this file already implicitly uses for `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` module-load values | One document, one TTL — a caching library's key-space/eviction machinery solves a problem this doesn't have |
| Deep-merge | `lodash.merge`/`deepmerge` npm package | A ~15-line hand-written merge over 5 known nested keys | The shape is fixed and small; a generic recursive merge adds surface area (array-merge semantics, prototype-pollution guards) this doesn't need |
| Numeric/boolean coercion | A schema-validation library (`zod`/`joi`) | `coerceConfigNumber`/`coerceEnableFlag`/`coerceAllowedModels` mirroring `readNumericKnob` | `.planning/research/SUMMARY.md` already evaluated and rejected `zod` for this exact milestone's form validation — the same reasoning (proportionality, zero existing precedent in this codebase) applies here |

**Key insight:** Every "don't hand-roll" instinct here points the OTHER direction from usual — this is a
case where the proportional answer is to hand-roll a small, testable module, because the problem (cache one
doc, merge 5 objects, coerce ~13 typed fields) is genuinely small and the codebase's own `readNumericKnob`
precedent already proves the hand-rolled-and-unit-tested pattern works well at this scale.

## Every Managed Read-Site — Enumerated Precisely

| # | Read-site (file:line) | Env var / param today | Current default | Moves to |
|---|------------------------|------------------------|------------------|----------|
| 1 | `readAiProxyLimits()`, index.ts:210 | `AI_RATELIMIT_MAX_PER_MIN` | 20 | `config.aiProxy.rateLimitPerMin` |
| 2 | `readAiProxyLimits()`, index.ts:211 | `AI_RATELIMIT_MAX_PER_DAY` | 500 | `config.aiProxy.rateLimitPerDay` |
| 3 | `readAiProxyLimits()`, index.ts:212 | `AI_MAX_TOKENS_CEILING` | 2048 | `config.aiProxy.maxTokensCeiling` |
| 4 | `readAiProxyLimits()`, index.ts:213-219 | `AI_ALLOWED_MODELS` (comma-split) | `["claude-haiku-4-5-20251001"]` | `config.aiProxy.allowedModels` |
| 5 | `cleanupExpiredMediaHandler`, index.ts:1038 | `MEDIA_CLEANUP_ENABLED !== "true"` | dry-run (false) | `!config.cleanup.mediaEnabled` |
| 6 | `readMediaRetentionDays()`, index.ts:1010 | `MEDIA_RETENTION_DAYS` | 30 | `config.retention.mediaDays` |
| 7 | `cleanupOrphanRendersHandler`, index.ts:1200 | `PPTX_RENDER_CLEANUP_ENABLED !== "true"` | dry-run (false) | `!config.cleanup.pptxRenderEnabled` |
| 8 | `readOrphanRenderStaleHours()`, index.ts:1170 | `ORPHAN_RENDER_STALE_HOURS` | 24 | `config.retention.orphanRenderStaleHours` |
| 9 | `cleanupOrphanBackgroundsHandler`, index.ts:1440 | `BACKGROUND_CLEANUP_ENABLED !== "true"` | dry-run (false) | `!config.cleanup.backgroundEnabled` — **the ONE-LINE swap, R190** |
| 10 | `readBackgroundRetentionDays()`, index.ts:1388 | `BACKGROUND_RETENTION_DAYS` | 30 | `config.retention.backgroundDays` |
| 11 | `cleanupPptxSourcesHandler`, index.ts:1668 | `PPTX_SOURCE_CLEANUP_ENABLED !== "true"` | dry-run (false) | `!config.cleanup.pptxSourceEnabled` |
| 12 | `readPptxSourceRetentionDays()`, index.ts:1634 | `PPTX_SOURCE_RETENTION_DAYS` | 30 | `config.retention.pptxSourceDays` |
| 13 | `readDeleteCap()`, index.ts:962 (shared by all 4 cleanup handlers) | `STORAGE_CLEANUP_MAX_DELETES_PER_RUN` | 500 | `config.deleteCapPerRun` |
| 14 | `runScheduledMessagingCron()`, index.ts:1986 | `SCHEDULED_MESSAGING_CRON_ENABLED !== "true"` | off (false) — gates BOTH `sendScheduledRemindersHandler` and `dispatchDueScheduledMessagesHandler` | `!config.messaging.scheduledCronEnabled` |
| 15 | `sendQueuedMessageHandler`, index.ts:2744 | `MESSAGE_MAX_RECIPIENTS` | 200 | `config.messaging.maxRecipients` |
| 16 | `sendQueuedMessageHandler`, index.ts:2745 | `ORG_MAX_EMAILS_PER_DAY` | 1000 | `config.messaging.orgDailyEmailQuota` |
| 17 | `sendQueuedMessageHandler`, index.ts:2822 | `MESSAGE_FROM_ADDRESS.value()` (a `defineString` param, NOT `process.env`) | `"onboarding@resend.dev"` | `config.sender.fromAddress` |

**MUST NOT move (deploy-time, R185):**

| Read-site | Env var | Why excluded |
|-----------|---------|---------------|
| index.ts:237 (module scope) | `AI_PROXY_MAX_INSTANCES` (default 10) | `onRequest({maxInstances: AI_PROXY_MAX_INSTANCES})` — Cloud Functions v2 evaluates this ONCE, at module load, before the function is even deployed to serve traffic |
| index.ts:246-247 (module scope) | `GLOBAL_MAX_INSTANCES` (default 20) | `setGlobalOptions({maxInstances: GLOBAL_MAX_INSTANCES})` — a project-wide scaling default applied at the SAME module-load moment, before the first exported function definition |
| `render-service/DEPLOY.md`'s `gcloud run deploy --max-instances=3 --concurrency=1` | N/A (a CLI flag, not an env var) | A wholly separate Cloud Run service outside this Functions codebase; no `functions/src/` code reads it at all |
| index.ts:2467-2469 (`SERVICE_SHARE_BASE_URL`) | `defineString`, default `https://worship-planner-bc515.web.app` | Out of scope per CONTEXT.md — not a v1.8 cost/cleanup/messaging knob, and not listed in the "in scope" bullet |
| index.ts:778-780 (`PPTX_RENDER_SERVICE_URL`) | `defineString`, default `""` | Out of scope per CONTEXT.md — same reasoning; unrelated to this milestone's cost/cleanup/messaging surface |

## Per-Knob Fail-Open/Fail-Closed Table (R184)

| Knob | Missing/malformed resolves to | Direction | Rationale |
|------|-------------------------------|-----------|-----------|
| `cleanup.mediaEnabled` | `false` (dry-run) | **Fail CLOSED** | A cleanup toggle silently defaulting to "on" would delete data nobody explicitly approved |
| `cleanup.pptxRenderEnabled` | `false` (dry-run) | **Fail CLOSED** | Same |
| `cleanup.backgroundEnabled` | `false` (dry-run) | **Fail CLOSED** | Same — and this is R190's floor: even with the flag somehow true, `referencesComplete`/floor-guard independently force dry-run on an incomplete reference scan |
| `cleanup.pptxSourceEnabled` | `false` (dry-run) | **Fail CLOSED** | Same |
| `aiProxy.allowedModels` | restrictive default `["claude-haiku-4-5-20251001"]` | **Fail CLOSED** | Never "allow all models" — an empty/malformed allow-list must not become an open proxy |
| `messaging.scheduledCronEnabled` | `false` (off) | **Fail CLOSED** | Matches today's `SCHEDULED_MESSAGING_CRON_ENABLED` default-off gate (v1.8 grant); an unconfigured value should not silently resume a cross-org scan |
| `aiProxy.rateLimitPerMin` | `20` | **Fail OPEN, capped** | The limiter is a cost guardrail, not a security control (65-CONTEXT.md's own locked decision) — a malformed value must not become unlimited (`Infinity`), but blocking all AI use on a config typo is disproportionate |
| `aiProxy.rateLimitPerDay` | `500` | **Fail OPEN, capped** | Same |
| `aiProxy.maxTokensCeiling` | `2048` | **Fail OPEN, capped** | Same |
| `retention.mediaDays` | `30` | **Fail OPEN, capped** | A malformed retention window should fall back to a known-safe number, not block the cron |
| `retention.orphanRenderStaleHours` | `24` | **Fail OPEN, capped** | Same |
| `retention.backgroundDays` | `30` | **Fail OPEN, capped** | Same |
| `retention.pptxSourceDays` | `30` | **Fail OPEN, capped** | Same |
| `deleteCapPerRun` | `500` | **Fail OPEN, capped** | A missing/non-positive cap must never resolve to "unbounded deletes" — `coercePositiveInt` rejects zero/negative/non-integer, matching `readDeleteCap()`'s existing extra guard |
| `messaging.maxRecipients` | `200` | **Fail OPEN, capped** | Same reasoning as rate limits — a cost/abuse guardrail, not a security boundary |
| `messaging.orgDailyEmailQuota` | `1000` | **Fail OPEN, capped** | Same |
| `sender.fromAddress` | `"onboarding@resend.dev"` | Fail to safe default | Not a security control; an invalid/missing address should not crash the send path — falls back to Resend's zero-setup test sender, matching today's `defineString` default |
| `sender.fromName` | `""` | Fail to safe default | Empty string → `fromDisplayName("")` already yields `""`, which `sendQueuedMessageHandler` already handles (bare address, no display name wrapper) |

## Common Pitfalls

### Pitfall 1: Converting the test suite's env-var mutation pattern incompletely
**What goes wrong:** `index.test.ts` has ~80+ `it()` blocks across the 4 cleanup handlers, the `api` proxy,
and `sendQueuedMessage` that set/delete `process.env.X` in `beforeEach`/`afterEach`. If only SOME are
converted to inject config instead, the handler code will silently read `process.env` in some code paths and
`getAppConfig()` in others (a half-migrated file), and the unconverted tests will pass for the wrong reason
(the env var still being read somewhere) while masking a real defect.
**Why it happens:** The swap touches every cleanup handler + the proxy + the send handler — a large,
repetitive diff that's easy to do partially across several plan tasks.
**How to avoid:** Grep for `process.env.` in `index.ts` after the swap — the ONLY remaining hits should be
`AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` (module scope) and inside `readNumericKnob`/`readDeleteCap`'s
own signatures if those are kept as pure functions still callable with a raw string (for their own,
still-valid unit tests). Every OTHER `process.env.X` reference across the 13 read-sites above must be gone.
**Warning signs:** A test still setting `process.env.MEDIA_CLEANUP_ENABLED = "true"` and passing — check
whether the handler under test actually reads `getAppConfig()` now, or whether the test is a false-positive
because BOTH the old and new paths coincidentally produce the same result during the migration.

### Pitfall 2: Adding a new `getFirestore()` dependency to a handler that previously had none
**What goes wrong:** `cleanupExpiredMediaHandler` today imports NO Firestore API at all (a documented safety
property: "this handler imports NO Firestore API at all. It is structurally incapable of touching slide
documents..."). Adding `getAppConfig(db)` to it introduces a Firestore call where there was none — this is
intentional and required for R181, but it is a genuine behavior change to that handler's dependency surface,
and its EXISTING doc-comment claim ("imports no Firestore API at all") becomes stale and must be updated, not
silently left contradicting the new code.
**Why it happens:** Of the 4 cleanup handlers, only `cleanupExpiredMediaHandler` currently has zero Firestore
usage — the other three (`cleanupOrphanRenders`, `cleanupOrphanBackgrounds`, `cleanupPptxSources`) already
call `getFirestore()` for their own reasons, so adding a `getAppConfig()` call to them is not a new
dependency class, only a new call.
**How to avoid:** Update the doc-comment at the top of `cleanupExpiredMediaHandler` to reflect that it now
reads `appConfig/global` via Admin SDK (bypasses rules) — but still touches NO slide/service/song documents,
preserving the SPIRIT of the original safety claim while correcting its letter.
**Warning signs:** A stale comment claiming "no Firestore" sitting directly above a `getFirestore()` call.

### Pitfall 3: `readNumericKnob`/`readDeleteCap`/etc. losing their standalone unit-test coverage
**What goes wrong:** These functions are directly imported and tested by name in `index.test.ts`. If the
swap converts them from "reads `process.env`" to "takes a resolved config value as a parameter" (a
reasonable refactor), their EXISTING tests (which set `process.env.X` and call the function with no
arguments) will fail to compile/pass, and it's tempting to just delete those tests rather than adapt them.
**Why it happens:** Time pressure + the tests LOOK redundant with the new `appConfig.test.ts` coverage.
**How to avoid:** Either (a) keep `readNumericKnob` unchanged (it's a pure, generic string-parser with no
Firestore dependency — reusable inside `appConfig.ts`'s coercion helpers as-is) and only retire the
env-specific wrapper functions (`readMediaRetentionDays`, `readDeleteCap`, etc.) that read `process.env`
directly, converting THEIR tests to test `appConfig.ts`'s equivalent coercion function instead with a
1:1 mapping — or (b) keep the wrapper functions exported as thin deprecated re-exports for backward test
compatibility. Document the choice in the plan; don't let it fall out implicitly.
**Warning signs:** A shrinking `describe()` count in `index.test.ts` with no corresponding growth in
`appConfig.test.ts`.

### Pitfall 4: `sender.fromName` stored but never read (silent dead config field)
**What goes wrong:** CONTEXT.md's shape locks `sender: { fromName, fromAddress }`, but the CURRENT
`sendQueuedMessageHandler` code always derives the display name from the ORG's own name
(`orgSnap.data().name`, sanitized via `fromDisplayName`), never from a global override. If `appConfig.ts`
defines `sender.fromName` but no read-site in `index.ts` ever consumes it, a super-admin editing it in the
Phase 70 console will observe zero effect — a silently broken setting.
**Why it happens:** CONTEXT.md's "in scope" bullet explicitly says "the Resend From ADDRESS (functions) —
the Resend send path reads the From from config" (singular "address"), while the shape section lists both
fields. The two are not obviously reconciled.
**How to avoid:** Flagged as an Open Question below — the planner must explicitly decide whether Phase 69
wires `sender.fromName` into the send path (as an override of, or fallback alongside, `orgName`) or whether
the field is defined now (for schema stability) but deliberately unread until a later phase. Either is
defensible; leaving it undecided is not.
**Warning signs:** A `coerceSender` helper that computes `fromName` but no caller in `index.ts` ever accesses
`config.sender.fromName`.

## Code Examples

### Cleanup handler swap (the R190 one-line pattern)

```typescript
// BEFORE (index.ts:1440, cleanupOrphanBackgroundsHandler)
const dryRun = process.env.BACKGROUND_CLEANUP_ENABLED !== "true";

// AFTER — the ONLY line inside cleanupOrphanBackgroundsHandler that changes.
// Everything below it (referencedPaths, referencesComplete, the floor guard,
// the three-tier reference scan, BACKGROUND_PATH_GUARD) is untouched.
const db = getFirestore();
const config = await getAppConfig(db, { fresh: true });
const dryRun = !config.cleanup.backgroundEnabled;
```

### Hot-path cached read inside the `api` proxy

```typescript
// BEFORE (index.ts:553)
const aiLimits = readAiProxyLimits();

// AFTER — cached form, no {fresh:true}. getFirestore() is already called
// later in this same handler (checkAndConsumeRateLimit/writeUsageLedger), so
// no NEW Firestore dependency is introduced, only an additional cached read.
const config = await getAppConfig(getFirestore());
const aiLimits = config.aiProxy;
```

### Cron gate swap

```typescript
// BEFORE (index.ts:1986)
export async function runScheduledMessagingCron(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (env.SCHEDULED_MESSAGING_CRON_ENABLED !== "true") { ... }

// AFTER — db becomes the injectable seam for tests (mirrors the existing
// `now: Date = new Date()` DI convention this file already uses for
// sendScheduledRemindersHandler/dispatchDueScheduledMessagesHandler).
export async function runScheduledMessagingCron(
  db: Firestore = getFirestore(),
): Promise<void> {
  const config = await getAppConfig(db, { fresh: true });
  if (!config.messaging.scheduledCronEnabled) { ... }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `process.env.X` + `readNumericKnob`/`readDeleteCap` string-parsing, requires `functions/.env` edit + redeploy per change | `appConfig/global` Firestore doc + `getAppConfig()` typed reads, edited live (Phase 70 UI) | This phase (v1.9, 2026-08-20) | A cost/cleanup/messaging lever change no longer needs a Cloud Functions redeploy — the single biggest friction reduction of this milestone |
| `defineString("MESSAGE_FROM_ADDRESS", {...})` deploy-baked param | `config.sender.fromAddress`, a live Firestore-backed value | This phase | The no-reply sender address becomes editable without a redeploy — table stakes for R191 (Phase 70) |

**Deprecated/outdated:**
- The `MEDIA_CLEANUP_DRY_RUN` env var: already fully retired per the 22-03 incident fix documented in-file
  (`process.env.MEDIA_CLEANUP_DRY_RUN` is read nowhere; a stray test still `delete`s it defensively). No
  action needed this phase — noted only so it is not mistaken for a live knob during the swap.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sender.fromName` should be DEFINED in the `AppConfig` schema now (for Phase 70 forward-compatibility) but its WIRING into the send path's display-name resolution is an open decision for the planner, not resolved by this research | Pitfall 4 / Open Questions | If the planner assumes it's already wired, Phase 70's form will silently do nothing when the super-admin edits it; if the planner assumes it's fully out of scope, the field may be omitted from the schema and Phase 70 needs an unplanned schema migration |
| A2 | Mocking the `./appConfig` module (like `./pptxParser`/`./renderInvoker`) is lower-total-diff than wiring a Firestore-doc mock into every existing fake-`db` builder across ~80 test cases | Summary / Pattern discussion | If the planner chooses the Firestore-mock-everywhere approach instead, more files touch more test setup blocks than strictly necessary — a productivity risk, not a correctness one |
| A3 | Keeping `readNumericKnob` as a still-exported pure function (reused inside `appConfig.ts`'s coercion) rather than retiring it entirely | Pitfall 3 | If the planner retires it, several existing unit tests (`readNumericKnob` described directly) need conversion or removal, expanding the diff beyond the minimal swap |

**If this table is empty:** N/A — see rows above. Every other technical claim in this document (Firebase
global-scope-per-instance behavior, `defineString` deploy-time resolution, the exact default values, the
exact read-sites) was verified directly against this repo's source or against official Firebase
documentation this session.

## Open Questions

1. **Does `sender.fromName` override the per-org display name, or is it purely a Phase-70-forward field this
   phase defines but does not wire?**
   - What we know: today's send path ALWAYS uses the org's own `name` field (sanitized via
     `fromDisplayName`), never a global override; CONTEXT.md's shape lists `fromName` alongside `fromAddress`
     but the "in scope" bullet only names "the Resend From ADDRESS."
   - What's unclear: whether a super-admin-set `fromName` should REPLACE the org name globally (all orgs get
     the same display name — plausible for a single/few-org app today) or whether it stays unread until a
     future per-org-override phase.
   - Recommendation: define the field in the schema now (schema stability for Phase 70), but treat wiring it
     into `sendQueuedMessageHandler`'s display-name resolution as IN scope for this phase too — since the
     alternative (defined-but-dead field) is a worse footgun than doing the small additional wiring now. If
     the planner disagrees, it must be an explicit, stated decision, not a silent omission.

2. **Should the four `read*RetentionDays`/`readDeleteCap`/`readOrphanRenderStaleHours` wrapper functions be
   retired outright or kept as thin deprecated re-exports?**
   - What we know: they are directly imported and unit-tested by name in `index.test.ts`; `readNumericKnob`
     itself is generic and reusable inside the new coercion layer.
   - What's unclear: whether the plan should spend a task converting their existing tests 1:1 into
     `appConfig.test.ts`, or keep the wrappers (now delegating to `DEFAULT_APP_CONFIG` constants) purely to
     avoid touching that test surface.
   - Recommendation: retire the env-reading wrappers and convert their tests 1:1 (cleaner end-state, no dead
     code) — but call this out explicitly in the plan as a deliberate test-file diff, not a byproduct.

## Environment Availability

Skipped — this phase has no new external dependency (no new npm package, no new external service, no new
CLI tool). `firebase-admin`/`firebase-functions` are already installed and already exercised by the existing
test suite; `functions/.env.local`'s absence in a fresh worktree affects `functions:secrets`-backed values
(`RESEND_API_KEY`, `CLAUDE_API_KEY`, etc.), none of which this phase touches or requires locally — `vitest run`
inside `functions/` mocks every Firebase Admin/Functions import (see `functions/src/index.test.ts:85-149`),
so this phase's tests run without any live credentials.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (functions-standalone, pinned in `functions/package.json`) [VERIFIED: functions/package.json] |
| Config file | `functions/vitest.config.ts` (implicit default — no explicit config file found; `npm test` runs `vitest run` from `functions/`) |
| Quick run command | `cd functions && npx vitest run src/appConfig.test.ts` (new file, fast inner loop) |
| Full suite command | `cd functions && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| R180 | `AppConfig` shape covers every documented knob | unit | `cd functions && npx vitest run src/appConfig.test.ts -t "shape"` | ❌ Wave 0 (`appConfig.test.ts` new) |
| R181 | A handler reads its value from `appConfig/global` (via `getAppConfig`), not `process.env` | unit | `cd functions && npx vitest run src/index.test.ts -t "reads from config"` | ❌ Wave 0 (new assertions inside existing `describe()` blocks per handler) |
| R182 | Empty/missing doc → `getAppConfig()` result deep-equals `DEFAULT_APP_CONFIG` | unit | `cd functions && npx vitest run src/appConfig.test.ts -t "empty doc reproduces defaults"` | ❌ Wave 0 |
| R182 | Partial doc → only the set keys change, siblings keep defaults | unit | `cd functions && npx vitest run src/appConfig.test.ts -t "partial doc deep-merge"` | ❌ Wave 0 |
| R183 | Two cached calls within TTL → exactly ONE Firestore read | unit | `cd functions && npx vitest run src/appConfig.test.ts -t "TTL cache hit"` | ❌ Wave 0 |
| R183 | A `{fresh:true}` call always re-reads, even with a warm cache | unit | `cd functions && npx vitest run src/appConfig.test.ts -t "fresh bypasses cache"` | ❌ Wave 0 |
| R183 | Cache expires after TTL and re-fetches | unit | `cd functions && npx vitest run src/appConfig.test.ts -t "TTL expiry"` | ❌ Wave 0 |
| R184 | Each fail-closed knob resolves to its restrictive default on malformed input | unit (parametrized) | `cd functions && npx vitest run src/appConfig.test.ts -t "fail closed"` | ❌ Wave 0 |
| R184 | Each fail-open-capped knob resolves to its capped numeric default, never `0`/`Infinity`, on malformed input | unit (parametrized) | `cd functions && npx vitest run src/appConfig.test.ts -t "fail open capped"` | ❌ Wave 0 |
| R185 | `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` still resolve from `process.env` unchanged after the swap | unit (existing, regression) | `cd functions && npx vitest run src/index.test.ts -t "setGlobalOptions"` | ✅ existing test, must still pass |
| R190 (preserved, verified hard in Phase 71) | `cleanupOrphanBackgroundsHandler`'s `referencesComplete`/floor-guard tests still pass after the enable-flag swap | unit (existing, converted setup) | `cd functions && npx vitest run src/index.test.ts -t "cleanupOrphanBackgroundsHandler"` | ✅ existing tests, setup mechanism converted env→config-mock, assertions unchanged |

### Sampling Rate
- **Per task commit:** `cd functions && npx vitest run src/appConfig.test.ts` (or the specific handler file touched)
- **Per wave merge:** `cd functions && npm test` (full functions suite) AND `cd functions && npm run build` (the standalone `tsc` build — REQUIRED per CLAUDE.md, the root `vue-tsc --build` does not cover `functions/`)
- **Phase gate:** `cd functions && npm test` green + `cd functions && npm run build` clean, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `functions/src/appConfig.ts` — the module under test does not exist yet
- [ ] `functions/src/appConfig.test.ts` — covers R180, R182, R183, R184 (all net-new)
- [ ] `functions/src/index.test.ts` — MODIFIED (not new): every cleanup/proxy/send test block's `beforeEach`/`afterEach` env-var mutation converted to a config-object injection; no new file needed, existing file's setup mechanism changes

*(No new test framework install needed — `vitest` is already the functions-standalone runner.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Unchanged this phase — the super-admin claim gate on `appConfig/global` writes was Phase 68's scope, not touched here |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes (read-only, indirectly) | `appConfig/global`'s Firestore rules already restrict client read/write to `isSuperAdmin()` (Phase 68 68-03, verified present at `firestore.rules:473-475`); this phase's functions read via the Admin SDK, which bypasses rules by design (server-trusted context) — no NEW access-control surface is introduced |
| V5 Input Validation | Yes | The `coerce*` functions in `appConfig.ts` ARE the input-validation boundary for this phase — every field independently defends against a wrong type, `NaN`, negative, or malformed value, per the fail-open/fail-closed table above. This is a defense-in-depth layer: the DATA WRITER (Phase 70's form, or a hand-edited doc) is untrusted even though it is gated by rules, because rules enforce WHO can write, not WHAT shape they write |
| V6 Cryptography | No | No secret material is introduced or handled — `RESEND_API_KEY` explicitly stays out of `appConfig/global` per CONTEXT.md and the v1.9 grant |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A malformed/adversarial `appConfig/global` doc (e.g. a compromised super-admin account, or a Phase-70 UI bug writing a bad shape) disables ALL AI-model restrictions | Elevation of Privilege | `coerceAllowedModels` fails CLOSED to the restrictive default list on any non-array/empty/malformed value — an attacker who can write SOME value to the doc still cannot widen the model allow-list past what a code deploy would set, only narrow/break it |
| A malformed doc sets `deleteCapPerRun` to `0`, `-1`, or a non-integer, intending to bypass the blast-radius cap and delete unboundedly in one run | Tampering | `coercePositiveInt` rejects non-positive/non-integer values and falls back to `500`, mirroring the existing `readDeleteCap()` guard — this is defense-in-depth ON TOP OF the Phase 68 rules gate, not a replacement for it |
| A stale TTL-cached config value serves an already-revoked/disabled cleanup flag for up to 60s on a hot path (not applicable to cleanup — cleanup only ever reads `{fresh:true}` per R183; this row documents why the design deliberately routes destructive paths through the fresh read) | Repudiation / Tampering (near-miss, mitigated by design) | R183's own asymmetric-caching requirement — cleanup crons NEVER use the cached form, closing this exact window by construction |

## Sources

### Primary (HIGH confidence)
- Direct repo inspection: `functions/src/index.ts` (all 17 read-sites enumerated above, line-referenced), `functions/src/index.test.ts` (env-var test-mutation pattern, mock structure for `getFirestore`/`defineString`), `functions/src/claimsHelpers.ts` (the "no module-scope `initializeApp()`" convention new helper modules follow), `firestore.rules:468-475` (confirms `appConfig/*` already gated to `isSuperAdmin()`, Phase 68), `functions/package.json` (installed versions), `.planning/phases/69-firestore-runtime-config/69-CONTEXT.md`, `.planning/REQUIREMENTS.md` (R180-R185), `.planning/STATE.md` (v1.9 deploy-discipline grant), `CLAUDE.md` (functions-standalone build gate requirement)
- [Tips & tricks | Cloud Functions for Firebase](https://firebase.google.com/docs/functions/tips) — confirms global-scope variables are created once per function INSTANCE and shared across invocations reaching that instance only, the direct evidentiary basis for the TTL-not-cache-bust design decision
- [Configure your environment | Cloud Functions for Firebase](https://firebase.google.com/docs/functions/config-env) — confirms `firebase-functions/params` (`defineString`) values are resolved at deploy time, the basis for the `MESSAGE_FROM_ADDRESS` migration analysis

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` (this milestone's own prior research pass, 2026-08-20) — corroborates the "no new npm dependency needed" conclusion via its own independent live `npm view` verification of `zod`/`node-cache`/`lru-cache`

### Tertiary (LOW confidence)
- None used as load-bearing evidence in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly against `functions/package.json`; zero new dependencies is corroborated by an independent prior research pass
- Architecture: HIGH — the TTL-vs-cache-bust design decision is grounded in official Firebase documentation, not inference; every read-site is line-referenced against the real file, not recalled from training data
- Pitfalls: HIGH — grounded in direct inspection of the existing 3,124-line file and its existing test suite's actual structure, not general Cloud Functions folklore

**Research date:** 2026-08-20
**Valid until:** 30 days (stable domain — Cloud Functions v2 Params/global-scope semantics and this repo's own code are both slow-moving; re-verify if `firebase-functions` is bumped past `^7.2.5` before this phase executes)
