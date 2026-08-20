# Phase 69: Firestore Runtime Config - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas auto-resolved from research/SUMMARY.md + REQUIREMENTS.md under the v1.9 autonomy grant; recommended answers accepted)

<domain>
## Phase Boundary

Move every v1.8 cost/cleanup/messaging knob out of `process.env` and into one admin-only Firestore doc
(`appConfig/global`) that the Cloud Functions read at RUNTIME with safe, per-knob fail-open/closed defaults —
so changing a value takes effect with **no redeploy**. This is the config engine under the Phase 70 UI.

**In scope (R180–R185):**
- Define `appConfig/global`'s shape (mirrors the env knobs) + `DEFAULT_APP_CONFIG` (exact current env
  fallbacks) + a `getAppConfig()` reader with the correct caching per call-site.
- Swap every managed `process.env.X` read-site in `functions/src/` to read from `getAppConfig()`.
- Per-knob fail-open/closed on a missing/malformed value.
- Exclude the `*_MAX_INSTANCES` / render-service caps (deploy-time; not live).
- The no-reply sender ADDRESS read-side (functions) — the Resend send path reads the From from config.

**Out of scope (later/earlier phases):** the `appConfig/*` Firestore RULES already shipped in Phase 68
(68-03) — do NOT re-add them, just rely on them. The admin console UI that EDITS the config, the
effective-value/provenance display, and the no-reply sender FORM are Phase 70. The dry-run cleanup preview +
confirm-to-flip is Phase 71. `superAdmin` claim/gate is Phase 68 (done).
</domain>

<decisions>
## Implementation Decisions

### Config document (R180, R182)
- One singleton doc **`appConfig/global`** (top-level collection, sibling of `aiUsage`/`aiRateLimits`).
  Rules already gate it to super-admins only (Phase 68 68-03).
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

### The reader + caching (R181, R183)
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

### Per-knob fail-safe defaults (R184)
- On a missing/malformed value, resolve PER KNOB, never one blanket policy:
  - **Fail CLOSED (restrictive):** the four cleanup enable flags → treat as OFF/dry-run; the AI model
    allow-list → the restrictive default list (never "allow all models"); the messaging cron flag → OFF.
  - **Fail OPEN but capped:** the AI rate limits → fall back to the capped default numbers (never unlimited);
    retention windows / deleteCap / recipient cap / org quota → the default numbers.
- Type coercion is defensive (mirror the existing `readNumericKnob` zero-vs-falsy handling) — a string,
  NaN, negative, or wrong-type value falls back to the default, not to `0`/`undefined`.

### Excluded knobs (R185)
- `AI_PROXY_MAX_INSTANCES`, `GLOBAL_MAX_INSTANCES`, and the Cloud Run render-service caps are Cloud Functions
  v2 **deploy-time** settings read at module load — they CANNOT be live-config. They STAY `process.env` /
  deploy-time. They are NOT part of `appConfig/global`. (Phase 70 may surface them read-only, labeled
  "requires redeploy" — not this phase.)

### The functions swap (R181, R190-preserving)
- Replace each managed `process.env.X` read in `functions/src/index.ts` (and any helper like
  `readAiProxyLimits`/`readNumericKnob` call-sites) with a value from `getAppConfig()`:
  the four cleanup enable/retention/cap reads, the AI proxy limits, the messaging recipient/quota/cron reads,
  and the Resend From address.
- **`cleanupOrphanBackgroundsHandler` swap is a ONE-LINE change to the enable-flag read only** — the
  `referencesComplete` / floor-guard fail-safes and the song-linked-background protection are NOT touched;
  its existing unit tests must pass UNCHANGED (this is R190's guarantee, verified hard in Phase 71).
- Each swap is behavior-preserving while `appConfig/global` is empty (the defaults-merge guarantee), so this
  phase's deploy is a no-op change until the owner (or Phase 70 UI) writes a value.

### Deploy discipline (v1.9 grant)
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
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/index.ts` — all the current `process.env` read-sites: the `api` proxy limits
  (`readAiProxyLimits`), the four cleanup handlers (`cleanupExpiredMedia`, `cleanupOrphanRenders`,
  `cleanupOrphanBackgrounds`, `cleanupPptxSources`) with their `*_CLEANUP_ENABLED` + retention + `readDeleteCap`
  reads, `sendScheduledReminders` gate, the Resend send-loop caps + `MESSAGE_FROM_ADDRESS`.
- `readNumericKnob` / `readAiProxyLimits` / `readDeleteCap` — the existing env-read helpers whose call-sites
  move to `getAppConfig()`; their defensive parsing (zero-vs-falsy) is the model for the per-knob coercion.
- `cleanupOrphanBackgroundsHandler` — the 3-tier `referencesComplete` + floor-guard fail-safes that must
  survive the swap untouched (the song-linked-background guarantee, R190).
- `functions/src/appConfig.ts` (NEW) — no analog for a cached runtime-config reader; closest is the DI-for-
  testability shape of `readAiProxyLimits`.
- `functions/DEPLOY-SUPER-ADMIN.md` — the owner-hand-over runbook shape to mirror/extend for the functions
  redeploy.

### Established Patterns
- Admin SDK Firestore reads in functions; env-var config with code defaults; defensive numeric parsing.
- Functions have their OWN standalone `tsc` build (`cd functions && npm run build`) that the root
  `vue-tsc --build` does NOT cover — Phase 68 hit a real TS error only that build caught. RUN IT as a gate.

### Integration Points
- Every managed `process.env.X` site in `functions/src/index.ts` → `getAppConfig()`.
- The `appConfig/global` doc is read by functions (Admin SDK, bypasses rules) and written by the Phase 70
  console (client, gated by the Phase 68 rules).
</code_context>

<specifics>
## Specific Ideas

- The defaults-merge guarantee (R182) is the safety spine: an absent/partial `appConfig/global` must never
  change behavior. Prove it with a test asserting the merged config equals the current env-default behavior
  for an empty doc.
- The caching asymmetry (R183) is the single most important design call: TTL on hot paths, fresh on crons.
  A uniform policy is wrong in one direction or the other. Document it at the reader.
- Do not weaken any cleanup safety while swapping its enable flag — the swap is a value-source change only.
</specifics>

<deferred>
## Deferred Ideas
- The admin console UI that edits `appConfig/global`, effective-value display, provenance stamp surfacing,
  and the no-reply sender FORM → Phase 70.
- The dry-run cleanup blast-radius preview + confirm-to-flip → Phase 71.
- Surfacing the read-only `*_MAX_INSTANCES` / render-service caps in the console → Phase 70 (optional).
- The `appConfig/*` Firestore rules → already shipped in Phase 68 (68-03); not re-touched here.
</deferred>
