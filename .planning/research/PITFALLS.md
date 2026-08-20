# Pitfalls Research

**Domain:** Owner super-admin console + Firestore-backed runtime config + live destructive-cleanup toggles, added to a LIVE production Vue 3 + Firebase app (`worship-planner-bc515`)
**Researched:** 2026-08-20
**Confidence:** HIGH — grounded directly in this repo's existing code (`functions/src/index.ts`, `functions/src/orgMembershipClaims.ts`, `firestore.rules`, `storage.rules`, `CLAUDE.md`), not generic Firebase advice. Where a claim is general Firebase/GCP knowledge rather than repo-verified, it is marked MEDIUM inline.

## Critical Pitfalls

### Pitfall 1: A live "enable deletion" toggle fires on the NEXT scheduled cron run before anyone reviews the dry-run

**What goes wrong:**
Today, flipping `BACKGROUND_CLEANUP_ENABLED=true` (etc.) requires editing `functions/.env` and running `firebase deploy --only functions`, a deliberately heavy, hard-to-do-by-accident action with a review step built into the deploy process itself. Once that flag lives in a Firestore doc a super-admin can toggle from a UI, the friction disappears — a single misclick (or a well-intentioned "let's just turn it on") flips a global switch, and the very next scheduled run (`cleanupOrphanBackgrounds` at 05:00 UTC daily, or any of the other three sweeps on their own schedules) deletes real files with no human in the loop between "toggle flipped" and "delete executed." The v1.8 dry-run summaries (`orphanCount`, `deletedBytes`) only ever printed to Cloud Functions logs — nobody reads those before flipping a UI switch the way they would before editing an env var and redeploying.

**Why it happens:**
The whole point of this milestone is removing deploy friction. But removing deploy friction from a *read* config (retention days, rate limits) and removing it from a *delete-enable* flag are not the same risk category — the roadmap will be tempted to build one generic "config panel" UI pattern for all knobs, which erases that distinction by construction.

**How to avoid:**
- The admin UI must **never expose a delete-enable flag as a bare toggle**. Require: (1) a "Preview dry-run" action that runs the sweep's handler in dry-run mode on-demand (not waiting for the next cron) and displays `orphanCount` / `deletedBytes` / `scannedCount` in the UI; (2) the enable toggle is disabled/greyed until a dry-run preview has been run in the current session; (3) a confirmation step that echoes back the actual count ("This will delete approximately 47 files, 812 MB, on the next run at 05:00 UTC — type ENABLE to confirm").
- Consider a **manual on-demand invocation** of each cleanup handler (owner-triggered HTTPS callable, super-admin gated) so the owner can run a real dry-run *right now* instead of waiting for tomorrow's cron before deciding.
- Do not let "enable" take effect until the *next* run, ever — never trigger an immediate deletion pass as a side effect of flipping the toggle. Flipping enable should always mean "the next *scheduled* run will delete," giving a window to disable again before it fires, not "delete starts now."
- Log every enable/disable flip with who/when to a `configAuditLog` (or similar) doc — this is the only way to reconstruct "who turned this on" after the fact, which the current env-var+deploy path gets for free via git blame and deploy history but Firestore does not.

**Warning signs:**
- The admin UI ships a toggle for `*_CLEANUP_ENABLED` with no dry-run count visible on the same screen.
- The toggle takes effect immediately with no "next run at HH:MM UTC" messaging.
- No audit trail of who flipped which flag when.

**Phase to address:**
The phase that builds the cost/cleanup control panel UI — this must be a **hard UI/UX requirement**, not a follow-on polish item. It should ship in the SAME phase as the toggle itself, never as a later hardening pass, because the unsafe version is a fully functional (and shippable-looking) MVP.

---

### Pitfall 2: The song-linked-background protection is weakened because the Firestore config move touches the SAME code path as the reference-tier fail-safes

**What goes wrong:**
`cleanupOrphanBackgroundsHandler` (functions/src/index.ts) currently has two independent fail-safes that force `effectiveDryRun = true` regardless of the enable flag: the **references-incomplete** fail-safe (any unparseable URL or a thrown collectionGroup scan) and the **floor guard** (a reference scan that returns cleanly but with zero entries, despite candidate objects existing). Both exist specifically so a live-enabled sweep never deletes a song-linked background it merely failed to detect as referenced. When this milestone rewires `dryRun = process.env.BACKGROUND_CLEANUP_ENABLED !== "true"` to read from Firestore instead, it is touching the *one line* that gates the whole function — any refactor that also touches `effectiveDryRun = dryRun || !referencesComplete` (e.g. "let's also make `referencesComplete`-forcing configurable," or a well-meaning simplification that collapses the two booleans) can silently drop one of the fail-safes while leaving the enable-flag plumbing looking correct.

**Why it happens:**
The Firestore-config change and the fail-safe logic live in the same function body. A plan/phase whose stated scope is "move the enable flag to Firestore" naturally opens this function, and it is easy to touch more than the flag source while you're in there — especially since the flag *itself* only reads cleanly with a Firestore equivalent of `!== "true"` semantics, which invites "cleaning up" the surrounding boolean logic at the same time.

**How to avoid:**
- Treat `readOrphanBackgroundConfig()` (or whatever the new Firestore-config reader is called) as a **drop-in replacement only for the `process.env.BACKGROUND_CLEANUP_ENABLED` read**, nothing else in the function body. Diff review should show exactly one line changed inside `cleanupOrphanBackgroundsHandler`, plus the new config-read helper — not a refactor of `referencesComplete`/`effectiveDryRun`/`BACKGROUND_PATH_GUARD`.
- Carry forward the existing unit tests for `cleanupOrphanBackgroundsHandler` (references-incomplete forces dry-run, floor-guard forces dry-run, path-guard excludes non-background objects) **unmodified** and add new ones only for the Firestore-config read (missing doc → dry-run, malformed field → dry-run). If any existing test needs to change to pass, that is the signal something in the safety logic moved.
- Do this identically for the other three sweeps (`cleanupExpiredMediaHandler`, `cleanupOrphanRenderHandler`/pptx-render, `cleanupPptxSourcesHandler`) and the `STORAGE_CLEANUP_MAX_DELETES_PER_RUN` blast-radius cap — same "one-line swap only" discipline, since each has its own guard (`MEDIA_PATH_GUARD`, `RENDERED_OBJECT_GUARD`, delete cap never applied to dry-run so the true backlog is always visible).
- Explicitly re-state the owner's hard constraint as a phase acceptance check: "song-linked backgrounds are never deletion candidates because they are referenced at Tier 3 (song lyrics), and this milestone changes nothing about tier detection" — verified by re-running the existing reference-tier tests against the new code path, not just by re-reading the comments.

**Warning signs:**
- A diff to `cleanupOrphanBackgroundsHandler` that touches `referencesComplete`, `effectiveDryRun`, or the floor-guard condition.
- Existing safety-focused unit tests (references-incomplete, floor-guard, path-guard) need modification to pass after the change.
- The PR/phase description says "moved config to Firestore" but the diff is larger than a single read-site swap per function.

**Phase to address:**
The Firestore-backed config panel phase (whichever phase wires `functions/src/index.ts` reads to the new config doc). Verification for this specific pitfall belongs in that phase's test suite, run against `npm run type-check` + `npx vitest run` before considering the phase done — and should be called out explicitly in that phase's plan as a named risk, not left implicit.

---

### Pitfall 3: Per-invocation Firestore config reads land in the hottest, most cost-sensitive path — the `api` proxy — undoing the v1.8 cost work this milestone is meant to make safer

**What goes wrong:**
`readAiProxyLimits()` today reads `process.env` synchronously, at zero cost, on every request to the `api` Cloud Function (the metered Claude/ESV/NLT/PlanningCenter proxy that Phase 65 specifically hardened against cost overrun). If the naive migration makes this an `await db.collection('appConfig').doc('...').get()` call **inside the request handler**, every single proxied request — including the high-volume ESV/NLT/PlanningCenter branches, not just the metered Anthropic one — now pays a Firestore read's latency and cost on top of whatever it already does, and a burst of traffic multiplies Firestore reads 1:1 with requests. The same applies to `checkAndConsumeRateLimit`/`checkAndConsumeOrgEmailQuota`, which already do a Firestore transaction per call for the counters themselves — adding a *second*, separate config-doc read on top compounds it. Crons (`cleanupOrphanBackgrounds` etc.) are lower-frequency (once daily) so a read-per-invocation there is comparatively cheap, but the `api` proxy is invoked per user action and is exactly the surface Phase 65 built rate limits and a `maxInstances` cap to protect.

**Why it happens:**
"Read from Firestore instead of `process.env`" sounds like a one-line change, and functionally it is — but `process.env` reads are free and synchronous while Firestore reads are billed, network-latent, and subject to the same cold/warm-instance quirks as everything else in Cloud Functions v2. The naive migration treats them as equivalent.

**How to avoid:**
- **In-memory cache with a short TTL**, read once per warm instance and refreshed periodically (e.g. 60s TTL), not read on every invocation. Cloud Functions v2 instances stay warm across many invocations, so this converts "N reads for N requests" into "~1 read per 60 seconds per warm instance" — a massive reduction, while still bounding staleness (see Pitfall 4).
- Load the config **once per instance at cold start** as a floor, with the TTL cache refreshing it in the background rather than blocking every request on a fresh read.
- For the `api` proxy specifically: cache the AI-proxy knobs (`maxPerMin`, `maxPerDay`, `allowedModels`, `maxTokensCeiling`) together in one config-doc read, not one read per knob — mirroring the existing `readAiProxyLimits()` shape, which already returns all four as one object.
- Measure: after the change, confirm via Firebase console (Firestore usage) or Cloud Functions logs that read volume on the config collection scales with cache-TTL/instance-count, not with request volume.
- Do NOT add a config read to the messaging/fan-out hot paths (`sendQueuedMessage`, the recipient resolver) without the same caching discipline — these were also part of the v1.8 cost work (`MESSAGE_MAX_RECIPIENTS`, `ORG_MAX_EMAILS_PER_DAY`).

**Warning signs:**
- Any `await` on a Firestore config read that sits directly inside the `onRequest`/`onCall` handler body, without a cache check ahead of it.
- Firestore read counts (visible in Firebase console usage tab) rising proportionally with `api` proxy traffic after deploy.
- The `maxInstances` cap on `api` (currently 10, `AI_PROXY_MAX_INSTANCES`) starts getting hit more often post-migration purely because each request now takes longer (waiting on a config read), not because traffic increased.

**Phase to address:**
The phase that wires Cloud Functions to read from the new `appConfig` doc — this needs an explicit "caching strategy" design decision documented in that phase's PLAN.md, not left to implementation discretion. Should be verified by a quick load-style check (or at minimum a code-review checklist item: "does this read happen once per warm instance or once per request?").

---

### Pitfall 4: Cache staleness means a warm instance never sees the new value — the owner disables a cleanup and it keeps deleting anyway

**What goes wrong:**
This is the flip side of Pitfall 3's fix: once config is cached per-instance with a TTL, a super-admin can flip `BACKGROUND_CLEANUP_ENABLED` to `false` in the Firestore doc, and a Cloud Functions instance that is still warm (and cached the old `true` value) keeps behaving as if it's enabled until its cache TTL expires or the instance recycles. For the scheduled cleanup crons this is lower-risk (each invocation is typically a fresh/cold-ish instance on its own schedule, and the TTL only needs to be shorter than the schedule interval — e.g. much less than 24h for daily crons). But for the `api` proxy under sustained traffic, warm instances can live for extended periods, so a rate-limit or model-allowlist change made in the admin UI might not take effect for all traffic immediately — and more dangerously, a `*_CLEANUP_ENABLED` **disable** (an emergency stop) might not take effect on an already-warm cron instance before its next scheduled invocation completes.

**Why it happens:**
TTL caching (the correct fix for Pitfall 3) inherently trades "always current" for "cheap," and it's easy to pick a TTL that's fine for read latency but wrong for the specific case of an emergency disable of a destructive operation.

**How to avoid:**
- Pick separate TTLs (or separate caching strategies) for **enable/disable flags on destructive operations** versus **tuning knobs** (retention days, rate limits, AI model allow-list). A destructive-enable flag should have a much shorter TTL (or be re-read fresh at the top of every scheduled-function invocation, since crons run once/day and the extra read is cheap there per Pitfall 3's own reasoning) than a high-frequency `api`-proxy knob.
- For the four cleanup crons specifically: since they run once daily (not per-request), **read the enable flag fresh on every invocation with no caching at all** — the cost concern from Pitfall 3 doesn't apply at cron frequency, and correctness (an emergency disable taking effect on the very next run) matters more here than anywhere else in the system.
- For the `api` proxy: cache with a bounded TTL (e.g. 60s) and document that an admin-UI change can take up to that TTL to reach all warm instances — and say so in the UI ("changes take effect within ~60 seconds").
- Provide the owner an obvious way to force-refresh if they need to be certain — either a short TTL that makes waiting acceptable, or (if `maxInstances` is small enough, per current caps of 10/20) accept that a full propagation might require redeploying/restarting, which should NOT be the normal path for a disable.

**Warning signs:**
- Support/owner report of "I turned it off but it still ran."
- No documented TTL or refresh behavior anywhere in the admin UI or the config-read code.
- The same caching code (and TTL) is reused uniformly across destructive-enable flags and tuning knobs, with no differentiation.

**Phase to address:**
Same phase as Pitfall 3 (the Firestore-config-read wiring). The differentiated-TTL design (crons: always fresh; `api` proxy: short TTL) should be a named decision in that phase's plan, and the cleanup-cron "always fresh, no cache" behavior should be verified by a unit test that stubs two different config values across two invocations of the same handler.

---

### Pitfall 5: A missing or malformed `appConfig` doc silently applies the WRONG default for at least one knob category — fail-open vs fail-closed must be chosen per-knob, not globally

**What goes wrong:**
The existing env-var code already has a uniform, deliberate fail-safe idiom for the four cleanup flags: `dryRun = process.env.X_CLEANUP_ENABLED !== "true"` — literally *any* value other than the exact string `"true"` (unset, empty, `"false"`, `"1"`, a typo) means dry-run. This is fail-**closed** (safe) for destructive operations: absence of config = no deletion. But other knobs in the same system are deliberately fail-**open** — the AI rate limiter's own doc comment says "a limiter datastore hiccup never takes AI down" (locked decision), and `readNumericKnob` falls back to sane defaults (20/min, 500/day, 2048 tokens) rather than blocking all AI requests if the value can't be read. If the Firestore migration applies ONE blanket policy to the whole `appConfig` doc read (e.g. "if the doc is missing, throw / block everything" or conversely "if the doc is missing, treat everything as disabled/permissive"), it will get at least one knob category backwards: a missing config doc must never enable deletion, but it also must never silently disable AI (breaking the product) or silently disable the reminder/messaging cron in a way that surprises the owner, versus never silently RE-enabling something the owner explicitly turned off via an env var pre-migration.

**Why it happens:**
"What happens when the config doc doesn't exist yet" is exactly the kind of edge case that's easy to defer past the initial build (it won't exist until someone writes it, and during development it always exists because you just created it) and then discover in production the first time the doc is deleted, malformed by a manual Firestore Console edit, or simply hasn't been created yet on a fresh deploy.

**How to avoid:**
Define and document, per knob, the exact safe default when the config doc/field is missing/malformed — mirroring the table below, then implement a single well-tested `readAppConfig()` helper that returns this exact shape (with defaults baked in) rather than letting each call site improvise:

| Knob category | Safe default when config doc/field is missing | Rationale |
|---|---|---|
| `*_CLEANUP_ENABLED` (4 flags) | **false → dry-run** (fail-closed) | Matches the existing `!== "true"` idiom exactly; absence of proof-of-intent-to-delete must never delete. |
| `SCHEDULED_MESSAGING_CRON_ENABLED` | **false / off** (fail-closed) — matches current default | It already defaults off deliberately (Phase 67); a missing doc reverting to "on" would resurrect the unused daily cross-org scan the owner explicitly gated off, AND unpause schedule-for-later without the owner's awareness. |
| Retention windows (`*_RETENTION_DAYS`, `ORPHAN_RENDER_STALE_HOURS`) | Fall back to the existing hardcoded constants (30 days, 24h, etc.) | These are tuning, not safety gates — matches current `readNumericKnob` fallback behavior. |
| `STORAGE_CLEANUP_MAX_DELETES_PER_RUN` | Fall back to 500 (current default) — **never fall back to "unlimited"** | A missing cap must stay a cap, not become no-cap; an unbounded blast radius on a config-read failure is worse than a wrong-but-bounded one. |
| AI rate limits (`AI_RATELIMIT_MAX_PER_*`, `AI_MAX_TOKENS_CEILING`) | Fall back to current defaults (20/min, 500/day, 2048) — **fail-open on the READ itself** (don't block AI because config-read failed) but the fallback VALUES still cap spend | Preserves the locked "limiter hiccup never takes AI down" decision while keeping a bound. |
| `AI_ALLOWED_MODELS` | Fall back to `["claude-haiku-4-5-20251001"]` (current `DEFAULT_AI_ALLOWED_MODELS`) — **never fall back to "allow all models"** | An empty/missing allow-list must not become permissive; matches current `parsedModels.length > 0 ? parsedModels : DEFAULT_AI_ALLOWED_MODELS` logic. |
| Messaging fan-out caps (`MESSAGE_MAX_RECIPIENTS`, `ORG_MAX_EMAILS_PER_DAY`) | Fall back to current defaults (200, 1000) | Tuning caps, not enable switches — matches current `readNumericKnob` fallback. |
| `GLOBAL_MAX_INSTANCES` / `AI_PROXY_MAX_INSTANCES` | Fall back to current defaults (20, 10) | These are set once via `setGlobalOptions` at module scope (see Pitfall 6) — the fallback must be usable at that scope, not conditional on a Firestore read succeeding. |
| No-reply sender address | Fall back to the current hardcoded/env sender, or **reject send** rather than send from an empty/malformed `From:` | An empty `From:` header is a hard failure at Resend, not a soft one — prefer "queue stays pending, alert" over "send with broken header." |

Write ONE unit test per row above that asserts the exact fallback when the doc is absent, and another set for "doc exists but field is missing/wrong type" (a string where a number is expected, a number where a boolean is expected — see Pitfall 7).

**Warning signs:**
- Any config-read helper with a single generic `try { ... } catch { return defaults }` that returns the SAME kind of default (all permissive, or all restrictive) regardless of which knob failed to read.
- No test coverage for "config doc doesn't exist" as a first-class case (only "config doc has the field set to X").
- The no-reply sender or a cleanup enable flag ever defaulting to something other than what's in the table above.

**Phase to address:**
The Firestore-config-read wiring phase, as a named requirement (a per-knob default table like the one above should appear in that phase's PLAN.md or REQUIREMENTS traceability, not be left to implementer judgment during coding).

---

### Pitfall 6: `setGlobalOptions({ maxInstances })` runs at MODULE LOAD, before any Firestore read is possible — this knob category cannot move to per-request Firestore config the same way the others do

**What goes wrong:**
`GLOBAL_MAX_INSTANCES` and `AI_PROXY_MAX_INSTANCES` are read from `process.env` at **module scope** (`functions/src/index.ts` top level, before any function definition) and passed to `setGlobalOptions({ maxInstances: GLOBAL_MAX_INSTANCES })` and the `api` function's own options object — these are Cloud Functions v2 **deployment-time-adjacent** settings, evaluated once when the function container boots, not per-request. Firestore is not guaranteed to be readable synchronously at module load (and making module load `await` a Firestore call turns every cold start into a network round-trip before the function can even register). If this milestone's roadmap assumes ALL nine-plus knob categories move uniformly into "read from Firestore, cached, done," this specific pair will either (a) get silently left on `functions/.env` (fine, but must be an explicit documented exception, not an oversight discovered later) or (b) someone attempts to make it Firestore-driven and either breaks cold start latency or ends up with a stale value baked in at container boot that a Firestore change never updates until the next cold start/redeploy anyway — which is barely better than the current env-var behavior while adding complexity.

**Why it happens:**
The seed's own list groups "AI proxy knobs" and "messaging/fan-out knobs" together, including `AI_PROXY_MAX_INSTANCES` and `GLOBAL_MAX_INSTANCES` alongside knobs that genuinely are per-request-readable (rate limit thresholds, allowed models). It's easy to assume uniform treatment across the whole list.

**How to avoid:**
Explicitly scope `AI_PROXY_MAX_INSTANCES` and `GLOBAL_MAX_INSTANCES` as **staying on `functions/.env` + redeploy** in this milestone (or, if the admin UI wants to surface them, make clear the UI can only WRITE them to `functions/.env`-equivalent-at-deploy-time via a documented manual step, not achieve true no-redeploy control) — and say so in the requirements/roadmap so it isn't silently dropped or silently mishandled. If true no-redeploy control of instance ceilings is wanted, that's a materially different (and out-of-scope-sized) problem — Cloud Functions v2 doesn't offer a live-reconfigurable maxInstances without a redeploy or `functions:config` mechanism that itself requires a deploy.

**Warning signs:**
- A phase plan that lists "all v1.8 knobs move to Firestore" without calling out `*_MAX_INSTANCES` as an exception.
- An attempt to `await` a Firestore read at module scope in `functions/src/index.ts`, which risks cold-start latency regressions across every function in the file (they all share this one `index.ts` module).

**Phase to address:**
The requirements/scoping phase (this is a scoping decision, not an implementation bug) — should be resolved before the Firestore-config-read phase is planned, so that phase's scope is accurate.

---

### Pitfall 7: Type/validation drift — the admin UI writes a string, Firestore stores whatever Firebase's client SDK serialized, and the Cloud Function expects a number/boolean

**What goes wrong:**
Today, `readNumericKnob` exists specifically because env vars are ALWAYS strings and every numeric knob needs explicit parsing with a documented "must be `Number.isFinite`, else fallback" rule (including a WR-01 fix for the case where an operator's real, intentional `0` — an emergency full-stop — must not be discarded by a falsy-coalescing bug). A Firestore-backed admin UI removes the "everything is a string" universality: a number `<input>` bound to Firestore can write an actual JS number, a checkbox can write an actual boolean, but only if the UI code is careful — a naive form binding (e.g., a plain text input for "AI_RATELIMIT_MAX_PER_MIN") can just as easily write the STRING `"20"` to Firestore, and the reading code, if migrated carelessly, might do `if (config.maxPerMin >= limit)` where `"20" >= 500` is `true` (JS string-vs-number comparison coerces, but not always in the direction you expect, and further arithmetic on a string silently produces `NaN` or string concatenation bugs). The specific WR-01 zero-vs-falsy bug from the env-var era can recur in a NEW form here: a Firestore boolean `false` read via a careless `if (!config.enabled)` pattern is fine, but a Firestore field that's *accidentally missing* versus *explicitly `false`* needs the same explicit-not-implicit handling `readNumericKnob` already gives env vars.

**Why it happens:**
Moving off `process.env` removes the forcing function that made every value a string needing explicit parsing. Developers reasonably assume "now it's just typed data" and skip validation that used to be unavoidable.

**How to avoid:**
- Define a Zod (or equivalent) schema for the `appConfig` doc shape and validate on every read, not just trust the Firestore SDK's return type — Firestore has no server-side schema enforcement, so a malformed write (by a UI bug, a manual Console edit, or a future migration script) can put a string where a number belongs and Firestore will store it happily.
- On validation failure for a specific field, fall back to that field's documented safe default (Pitfall 5's table) and log a warning — never let a bad value propagate as `NaN`/`undefined` into downstream comparisons.
- In the admin UI, use typed form controls (`<input type="number">` bound through a numeric coercion, actual checkboxes/toggles for booleans, not free-text) and write the coerced JS-native type to Firestore, never the raw string from the DOM event.
- Port the existing `readNumericKnob`'s "explicit non-numeric/blank → fallback, but a real parsed `0` is honored" semantics into the Firestore reader, since a real `0` for e.g. `AI_RATELIMIT_MAX_PER_MIN` is a legitimate emergency-stop value someone will eventually want, exactly like today.
- Write unit tests that specifically feed the reader a string-typed number, a missing field, `null`, and a boolean-as-string (`"true"` vs `true`) for each field category, since these are the exact failure shapes a UI bug or manual edit produces.

**Warning signs:**
- No schema/validation layer between `doc.data()` and the values used in comparisons/`setGlobalOptions`/rate-limit checks.
- Admin UI form fields that are plain `<input type="text">` for numeric knobs.
- A test suite that only exercises "field present with correct type," never "field present with wrong type" or "field absent."

**Phase to address:**
Same phase as the Firestore-config-read wiring — the schema/validation layer should be built alongside the reader, not bolted on after a production incident surfaces a type mismatch.

---

### Pitfall 8: Client-only admin gate — a hidden route is not access control

**What goes wrong:**
The obvious, fast way to build "an admin-only page" is a Vue Router guard that checks `auth.user.customClaims.superAdmin` (or similar) client-side and redirects non-admins away. This makes the admin UI *invisible* to non-admins but does **nothing** to stop a non-admin from calling the underlying Cloud Functions or writing directly to the `appConfig` Firestore doc via the browser console or a crafted request — the actual authorization boundary must live in `firestore.rules` (for direct Firestore writes/reads of `appConfig`) and in the Cloud Functions themselves (for any `onCall`/`onRequest` admin action, e.g. "run dry-run now" or "flip enable flag"), not in the Vue app.

**Why it happens:**
This codebase already has a working precedent for exactly this mistake class — the router-guard pattern for editor/viewer RBAC is a legitimate UX nicety, but the REAL enforcement for that is `firestore.rules`' `isOrgEditor`/`isOrgMember` functions (firestore.rules lines ~25, 36, 38, etc.) plus the org-membership custom claim (`orgMembershipClaims.ts`). It's easy to build the admin surface the same way — client-side gate first, "we'll add rules later" — and ship the client gate as if it were sufficient, especially under time pressure, since it visibly "works" (a non-admin genuinely can't see the page).

**How to avoid:**
- Design the super-admin claim and its enforcement points BEFORE building the UI: (1) a `firestore.rules` rule on the `appConfig` doc (and any admin-only collection) that requires `request.auth.token.superAdmin == true` (or equivalent claim check) for read/write — mirroring the existing `isOrgEditor`/`isOrgMember` helper-function pattern already in the file; (2) every admin Cloud Function (enable-flag flip, dry-run trigger, sender config write) independently re-checks the caller's custom claim server-side via `context.auth.token` — never trusts that "only the admin UI calls this" is itself a security boundary, matching this codebase's own stated pattern of "never trust the caller-declared value alone, independently re-verify" (already documented in `orgMembershipClaims.ts` for the org-claim case).
- The Vue router guard is UX-only — build it, but treat it as equivalent to hiding a button, not to enforcing permission.
- Explicitly avoid reusing the string `"admin"` as the super-admin claim's role value or key name — `orgMembershipClaims.ts` already normalizes a legacy per-org `role: "admin"` to `"editor"` (a completely different, weaker meaning). A new super-admin claim using the same word invites confusion between "org admin" (doesn't really exist anymore, means editor) and "app super-admin" (the new, much more powerful thing this milestone adds). Pick a distinct claim key, e.g. `superAdmin: true` as a separate top-level custom-claim field, not a `role` value.

**Warning signs:**
- Any admin write path (Firestore write, Cloud Function call) whose only gate is a Vue route guard or a UI-hidden button.
- A `firestore.rules` diff for this milestone that doesn't add a check on the `appConfig` (or equivalent) path.
- Reuse of the word "admin" as a role/claim value anywhere near the new super-admin logic.

**Phase to address:**
The super-admin access-gate phase, first in the roadmap ordering (this milestone's other capabilities — the config panel, deletion-toggle safety — are meaningless as security boundaries if this phase's enforcement is client-only). `firestore.rules` and function-level checks should ship in the SAME phase as the claim itself, not deferred.

---

### Pitfall 9: Token refresh gap — a newly-granted (or newly-revoked) super-admin's session doesn't reflect it

**What goes wrong:**
Firebase custom claims are embedded in the ID token at the time it's minted/refreshed, not read live from Auth on every request. This repo already has direct experience with this class of bug: `orgMembershipClaims.ts`'s `syncOrgMembershipClaim` sets a claim via `setCustomUserClaims`, but the CLIENT holding a stale ID token doesn't see the new claim until it force-refreshes (`getIdToken(true)`) or the token naturally expires (~1hr) and is silently refreshed by the SDK. For super-admin speciically: (a) a brand-new super-admin who was just granted the claim (by whatever bootstrap mechanism — see Pitfall 10) will hit "access denied" on the admin console until their token refreshes, confusing them into thinking the grant failed; (b) worse, a **revoked** super-admin (someone whose access is pulled because they left, or because of a mistake) can continue acting with old admin privileges against `firestore.rules` for up to the token's remaining lifetime (`setCustomUserClaims(uid, null)` clearing the claim doesn't invalidate an already-issued token) unless the app explicitly force-revokes sessions.

**How to avoid:**
- After granting/revoking the super-admin claim (via whatever the admin-grant Cloud Function or manual process is), the app should prompt the affected user's active session to refresh — if they're online, listen for the claims-changed signal (e.g. the same Firestore doc the claim-sync trigger watches, mirrored into a client `onSnapshot` that calls `getIdToken(true)` when it fires) rather than expecting them to log out/in manually. This repo already has the pattern half-built: `syncOrgMembershipClaim` is a Firestore-triggered function; the super-admin equivalent can follow the exact same shape.
- For REVOCATION specifically, call `getAuth().revokeRefreshTokens(uid)` (Admin SDK) in addition to clearing the claim, and verify the ID token on every admin-sensitive check server-side with `checkRevoked: true` in `verifyIdToken` — Firebase Auth's default client SDK refresh does NOT itself check for revocation; only an explicit `checkRevoked` verification or waiting out the full token lifetime does. Cutting off a revoked super-admin's access **immediately** is the correct default given the blast radius (they could otherwise flip a deletion-enable flag during the gap).
- Document in the admin UI: "It may take a moment for a newly granted admin to see the console — ask them to reload/re-login if they see access denied immediately after being granted."

**Warning signs:**
- No token-refresh mechanism wired to the super-admin claim's change.
- Revocation implemented only as `setCustomUserClaims(uid, null)` with no `revokeRefreshTokens` call.
- Server-side admin checks that call `verifyIdToken` without `checkRevoked: true`.

**Phase to address:**
The super-admin access-gate phase — this is a correctness requirement of the claim system itself, not a follow-on. Should be verified with a manual UAT step: grant, confirm delayed-then-refreshed access; revoke, confirm access is cut off promptly (not just "eventually," given the blast radius of a revoked admin retaining deletion-toggle power).

---

### Pitfall 10: Bootstrapping the FIRST super-admin is a chicken-and-egg problem the admin console itself can't solve

**What goes wrong:**
If "grant super-admin" is itself an admin-console action, nobody can grant the very first super-admin through the UI — there's no admin yet to click the button. A naive fallback ("the first user to sign up is automatically super-admin," or "anyone can self-grant via a hidden endpoint") is a serious security hole if left in place, or a forgotten trap if the mechanism isn't cleanly removed/disabled after bootstrap.

**How to avoid:**
- Bootstrap the first super-admin via a **manual, owner-run, one-time script** (mirroring the existing `backfillOrgClaims.ts` pattern already in this repo — a CLI script using the Admin SDK, run locally with the owner's own credentials/service account, never deployed as a callable function). This matches the standing project rule (CLAUDE.md / Key Decisions) that auth/rules/data-affecting deploys are handed to the owner, not run autonomously — bootstrapping super-admin access is exactly this class of action.
- Hardcode the owner's own UID (or email, resolved to UID at script run time) as the only bootstrap target — never build a generic "grant super-admin to arbitrary UID" script or endpoint that could be reused/discovered later without the same scrutiny.
- Once the owner has super-admin, all SUBSEQENT grants go through the in-console UI (Cloud Function, claim-checked as in Pitfall 8) — the bootstrap script is a one-time tool, not a standing capability, and should be clearly marked as such (e.g., a script under a `scripts/` or `functions/scripts/` directory with a comment stating it's owner-run-once, not part of the deployed function set).

**Warning signs:**
- Any code path that grants super-admin without an existing super-admin's action AND that ships as a deployed, always-available Cloud Function.
- A "first user is admin" auto-grant left active past initial setup.

**Phase to address:**
The super-admin access-gate phase — bootstrap should be explicitly scoped and delivered as a HANDED-TO-OWNER script/instruction, not autonomous code the agent runs itself (per the standing project rule on auth/data-affecting actions).

---

### Pitfall 11: A `firestore.rules` change for `appConfig` that "looks right" but is unverifiable locally the same way the storage.rules incident was

**What goes wrong:**
This repo has a documented, costly precedent (CLAUDE.md): a `storage.rules` rule that gated on a cross-service `firestore.exists()` check looked correct in review, deployed to production, and denied EVERY user — including legitimate members — because `firestore.exists()` is permanently inert in the Storage emulator, so the two failing local tests (the ALLOW cases) were mislabeled as "needs the emulator" instead of "this rule is broken," for an entire milestone. The `appConfig`/super-admin rules for THIS milestone carry the same risk shape if the super-admin check in `firestore.rules` ever needs to read from a DIFFERENT collection than the auth token itself (e.g., checking an `admins/{uid}` Firestore doc instead of `request.auth.token.superAdmin`) — a same-service Firestore-to-Firestore `get()`/`exists()` check (like the existing `isOrgEditor` helper already does, reading `organizations/{orgId}/members/{uid}`) is fine and already proven to work in the Firestore emulator; a check against a claim is even simpler and doesn't need a rules-side document read at all. The risk is specifically choosing to model super-admin status as a Firestore document lookup from within `firestore.rules` and ASSUMING it behaves like the org-membership pattern, without re-verifying against the actual emulator-vs-production distinction that bit this project before.

**How to avoid:**
- Prefer the **custom-claim-only** check for super-admin in `firestore.rules`: `request.auth.token.superAdmin == true` — no Firestore document read needed inside the rule at all, which sidesteps the entire class of emulator-fidelity risk. This is simpler than the org-membership pattern (which needs the Firestore document lookup because org membership is inherently per-document data, not a single global flag) and is directly testable in the Firestore emulator with zero cross-service concerns.
- If any part of the admin config UX ends up needing a Firestore-side lookup (e.g., a per-admin permissions doc for finer-grained scopes beyond a boolean), explicitly test BOTH the allow and deny cases against the running Firestore emulator (not skip/mislabel a failing allow-case as an environment quirk) — and if the same rule needs to be enforced from `storage.rules` too, treat that as the exact pattern already flagged as broken in this repo and route it through a custom claim instead of `firestore.exists()`, per the existing Key Decision: "Org membership on a custom auth claim... a cross-service rule can never be verified locally."
- Run `npm run test:rules` (or `npx vitest run --config vitest.rules.config.ts` against an already-running emulator, per CLAUDE.md's testing note) for BOTH allow and deny cases on the new `appConfig` rule before considering that rule done, and never accept "the deny case passes" alone as sufficient — CLAUDE.md's storage.rules incident is a direct historical example of exactly that shortcut hiding a deny-everyone rule.

**Warning signs:**
- A new `firestore.rules` block for `appConfig`/admin collections that calls `get()`/`exists()` against a document rather than checking `request.auth.token`.
- Rules tests where only deny cases are asserted, or an allow case is skipped/marked "needs emulator."
- Any admin rule that also needs to be mirrored into `storage.rules` (the exact cross-service shape already proven broken in this repo).

**Phase to address:**
The super-admin access-gate phase, specifically the `firestore.rules` design step within it — should be reviewed against this repo's own documented storage.rules incident as a checklist item, not treated as generic Firebase rules-writing.

---

### Pitfall 12: `RESEND_API_KEY` (or any provider secret) leaks onto the client-readable config surface

**What goes wrong:**
The seed and requirements describe a "no-reply sender config" admin feature — configuring the From address. It is a short, easy slip from "let the admin configure sender settings" to "let the admin configure sender settings, including provider credentials," especially if a future iteration wants to support multiple providers or make the Resend API key itself admin-rotatable without a deploy. `RESEND_API_KEY` is currently a Firebase Functions **secret** (`defineSecret("RESEND_API_KEY")`, bound only to `sendQueuedMessage` — "smallest key-holding surface" per the existing R131 comment), never exposed to `functions.env`-style config, and never read by the client. If the `appConfig` doc that the admin UI reads/writes is the SAME doc (or a client-readable Firestore path) that also stores anything credential-shaped, that's a direct secret leak to any authenticated client (or worse, to any client, if `firestore.rules` isn't scoped tightly per Pitfall 8/11) — Firestore documents are trivially readable by anyone with a valid read grant, unlike a Functions secret bound only to specific function invocations.

**How to avoid:**
- The `appConfig` doc stores **only** the non-secret sender fields (From address/display name, Reply-To if applicable) — never an API key, never a webhook signing secret. This matches the existing separation already in this codebase: `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` are both `defineSecret`, bound to specific functions, set via `firebase functions:secrets:set`, and this milestone should not create a new path that duplicates or exposes them elsewhere.
- If the admin UI ever needs to show "is the Resend key configured?" (a status indicator), implement that as a boolean/status Cloud Function response (e.g., "configured: true/false" derived server-side), never by exposing the key or a portion of it to the client.
- Treat any request to make provider secrets admin-editable-without-redeploy as explicitly OUT OF SCOPE for this milestone (consistent with the milestone's own framing — the no-reply sender is about the From address, not credential rotation) unless the owner explicitly asks for it, and even then it belongs in a Secret Manager-backed flow (owner-run `firebase functions:secrets:set`, never a Firestore doc), matching the standing rule that secret-bearing deploys are owner-handled.

**Warning signs:**
- The `appConfig` doc schema includes any field named `*key*`, `*secret*`, `*token*`, or similar.
- An admin UI form for "sender settings" that includes anything beyond address/display-name fields.
- Any Cloud Function response that echoes back a secret value (even partially) to a client, including the admin client.

**Phase to address:**
The no-reply sender config phase — should be scoped explicitly to non-secret fields only in that phase's REQUIREMENTS/PLAN, with the existing `defineSecret` pattern cited as the reason.

---

### Pitfall 13: `.env.local` / `functions/.env` are gitignored and absent in fresh worktrees — the admin console's local dev/testing breaks silently for anyone (including an agent) who doesn't know to copy them

**What goes wrong:**
This is a documented, repo-specific standing issue (CLAUDE.md): a freshly created git worktree has no `.env.local` (Firebase/ESV/Claude/Planning Center secrets) and no `functions/.env` (the current cost/cleanup env knobs this milestone is migrating OFF of, but which will still exist for whichever knobs Pitfall 6 keeps on env vars, plus the Functions secrets). Building/testing the admin console — which necessarily touches Firebase config, Auth custom claims, and Cloud Functions — in a new worktree without these files produces failures that look like admin-console bugs (auth fails to initialize, emulator won't start, build aborts on the `VITE_FIREBASE_*` guard) but are actually just missing environment setup, wasting debugging time chasing a phantom.

**How to avoid:**
- Before starting ANY phase of this milestone in a new worktree, symlink or copy `.env.local` from the main checkout (`C:\projects\worshipplanner\.env.local`) per CLAUDE.md's documented setup step, and confirm `functions/.env` is similarly present if any functions work is planned.
- If this milestone's Firestore-config migration REMOVES reliance on some `functions/.env` keys, update CLAUDE.md's environment-setup section accordingly at the end of the milestone (which keys remain env-only per Pitfall 6, which moved to Firestore and no longer need a local env entry) — stale setup docs are exactly how this class of confusion compounds over milestones.
- When developing/testing the new admin claim locally, remember the Firebase Auth emulator supports setting custom claims directly (or via the Admin SDK against the emulator) — verify the local dev flow for granting/testing super-admin doesn't assume production Auth.

**Warning signs:**
- "Works on my machine" / "fails to build" reports from a fresh worktree that trace back to a missing `.env.local`, not actual code defects.
- CLAUDE.md's environment section left un-updated after this milestone despite changing which knobs live in `functions/.env`.

**Phase to address:**
Not a single implementation phase — a standing discipline for every phase in this milestone that touches Functions or Firebase config locally. Worth a one-line callout in each phase's plan/verification checklist ("confirm `.env.local`/`functions/.env` present before running tests"), and a CLAUDE.md update at milestone close.

---

### Pitfall 14: This milestone's own deploys (rules, functions, secrets) get run autonomously instead of handed to the owner

**What goes wrong:**
This repo has an explicit, repeated standing pattern (visible in PROJECT.md's Key Decisions and the v1.7/v1.8 delivery notes) that data-loss-capable, auth-capable, or rules-capable deploys are handed to the owner rather than run autonomously by an agent — e.g., "Send path is a backend Cloud Function, deploy owner-gated... every such deploy is handed to the owner, not run autonomously," and the standing v1.8 follow-up explicitly calling out that `firestore.rules` deploys and activating storage-deletion flags are OWNER actions. This v1.9 milestone is squarely in that category twice over: it adds a NEW `firestore.rules` change (the super-admin gate) AND it makes deletion-enable flags live-toggleable by design — exactly the kind of change this project's own history says should never ship via an autonomous deploy.

**How to avoid:**
- Scope every phase's deploy step explicitly: code/tests can be committed and verified locally/in CI, but `firebase deploy --only firestore:rules`, any deploy of functions that read the new `appConfig` in a way that changes production behavior for the cleanup crons, and the first-super-admin bootstrap script are all OWNER-RUN actions, called out as such in the phase's plan and NOT executed autonomously.
- This also applies to the moment the config panel goes live: even after code deploys, the FIRST time an owner uses the new UI to flip a real `*_CLEANUP_ENABLED` toggle in production is itself the owner's call to make (consistent with the existing standing follow-up: "activate the storage-deletion flags after reviewing dry-run logs" was already an owner action under the OLD env-var system; it remains one under the new UI).
- Distinguish clearly in the roadmap between "phase code-complete and verified" (agent-executable) and "deployed to production" (owner-executed) — matching the exact phrasing already used for v1.8's Phases 65-67 ("code-complete + verified 2026-08-20; UNDEPLOYED").

**Warning signs:**
- Any phase plan that includes an autonomous `firebase deploy --only firestore:rules` or `firebase deploy --only functions` step without an explicit owner handoff.
- A phase marked "done" that has silently also deployed to production without the owner-gate language this project consistently uses elsewhere.

**Phase to address:**
Every phase in this milestone that touches rules/functions/secrets — this is a cross-cutting process discipline, not a single phase's job, and should be restated in the roadmap's phase-completion criteria for each relevant phase.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Keeping cleanup flags GLOBAL (not per-org) in the Firestore config, per SEED-001's open question | Simpler doc shape, faster to ship, matches today's global env-var behavior | Blocks per-org control once a second org exists; a future multi-org milestone has to redesign the doc shape and every read site | Acceptable for v1.9 — this app is single/few-org today (PROJECT.md: "Team size: 2-3 active planners"); explicitly flag as a known limitation, not silently assume it'll never matter |
| Single flat `appConfig` doc for all knobs (cleanup, AI, messaging, sender) | One read, one cache, simplest mental model | A future security review can't grant narrower rules access per knob category (e.g., "billing viewer" seeing only cost knobs, not deletion flags) without a doc-shape migration | Acceptable given this milestone's own scope note: "granting church access / managing billing... deliberately not fully fleshed out" — a flat doc is fine as a v1.9-only structure if the roadmap doesn't promise per-scope admin roles yet |
| Reusing `readNumericKnob`'s exact fallback semantics for the Firestore reader rather than writing new validation from scratch | Fast, proven-correct (already has the WR-01 zero-vs-falsy fix baked in) | None significant — this is the RIGHT reuse, not really a shortcut | Always acceptable; recommended, not merely tolerated |
| Skipping an audit-log for non-destructive knob changes (retention days, rate limits) while requiring one for enable flags | Less to build | Harder to answer "why did AI rate limits change last Tuesday" later | Acceptable to defer audit logging for TUNING knobs; NOT acceptable to defer it for the four `*_CLEANUP_ENABLED` flags (Pitfall 1) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Firestore as runtime config store | Treating a Firestore read exactly like an env var read (same call shape, same cost/latency assumptions) | Cache with TTL differentiated by knob criticality (Pitfall 3/4); validate with a schema (Pitfall 7) |
| Firebase custom claims | Assuming a claim change is visible to the client/server immediately | Force-refresh on grant via a listened Firestore doc; `revokeRefreshTokens` + `checkRevoked: true` on revoke (Pitfall 9) |
| Firestore + Storage rules together | Reintroducing a cross-service `firestore.exists()` check from `storage.rules`, or modeling super-admin as a Firestore doc lookup inside `firestore.rules` when a custom claim would do | Prefer `request.auth.token.superAdmin == true` — no cross-doc/cross-service lookup needed for a global boolean flag (Pitfall 11) |
| Resend (email provider) | Letting sender-config admin UI scope creep into credential management | Keep `RESEND_API_KEY`/`RESEND_WEBHOOK_SECRET` as `defineSecret`-bound only, never in `appConfig` (Pitfall 12) |
| Cloud Functions v2 `setGlobalOptions`/per-function `maxInstances` | Assuming these can become live-Firestore-driven like other knobs | They're module-load-time settings; keep on env vars this milestone, document the exception (Pitfall 6) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Uncached Firestore config read inside the `api` proxy handler | Firestore read count scales 1:1 with `api` traffic; latency per request rises; `maxInstances` (10) gets hit sooner than before | In-memory TTL cache per warm instance, read once per instance/TTL window, not per request (Pitfall 3) | Immediately under any real traffic — this is not a "breaks at scale" trap, it breaks at the FIRST deploy if built naively |
| No cache on cleanup-cron config reads | Not actually a performance trap (crons run once/day) — but the INVERSE mistake (over-caching a cron's enable flag) is a correctness trap | Crons should read config fresh every invocation (Pitfall 4) — this is the one place where NOT caching is correct |
| One config doc read per knob instead of one read for the whole relevant group | N reads where 1 would do, multiplying Pitfall 3's cost by however many knobs a given function needs | Group knobs into one doc read per functional area (mirrors existing `readAiProxyLimits()` returning all 4 AI knobs from one call site) | Compounds with traffic; same "breaks immediately if naive" profile as Pitfall 3 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Client-only admin route guard with no `firestore.rules`/function-side enforcement | Any authenticated (or unauthenticated, depending on rules default) user can read/write `appConfig` directly, including flipping deletion-enable flags, via devtools or a direct Firestore/Functions call | Enforce via `firestore.rules` custom-claim check + independent server-side claim check in every admin Cloud Function (Pitfall 8) |
| Reusing `"admin"` as the super-admin claim/role name | Collides with the existing (weaker, legacy-normalized) per-org `role: "admin"`→`"editor"` semantics; a bug or code-review slip could conflate the two, granting super-admin-level trust based on org-editor-level data | Use a distinct claim key (e.g., `superAdmin: true`), never reuse `role` for this purpose (Pitfall 8) |
| Revoking super-admin via `setCustomUserClaims(uid, null)` alone | Revoked user retains full admin capability (including flipping live deletion toggles) until their token naturally expires | Also call `revokeRefreshTokens(uid)` and verify with `checkRevoked: true` server-side (Pitfall 9) |
| A generic "grant super-admin" bootstrap left reachable after initial setup | Privilege-escalation path for any future attacker/bug to self-grant super-admin | One-time owner-run script only, never a deployed always-on endpoint (Pitfall 10) |
| Sender-config admin UI scope creep into API keys | Direct secret leak to any client with `appConfig` read access | Keep provider secrets on `defineSecret`, never in Firestore config (Pitfall 12) |
| Autonomous deploy of `firestore.rules`/functions/secrets for this milestone | Live deletion toggles and a new privilege tier reach production without the owner's explicit review, contradicting this project's own standing practice | Every rules/functions/secrets deploy for this milestone is owner-run, not autonomous (Pitfall 14) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Deletion-enable toggle presented as a plain on/off switch, same visual weight as a retention-days number field | Owner (or a future admin) underestimates the consequence of flipping it; muscle memory from tuning knobs bleeds into destructive actions | Visually and interactionally distinct: dry-run preview required first, confirmation step with the real count, distinct styling (Pitfall 1) |
| No indication of "changes take effect within ~X seconds/minutes" for cached config | Admin flips a knob, sees no immediate effect, assumes it failed, flips it again, or escalates confusion | State the propagation delay in the UI itself, differentiated by knob type (Pitfall 4) |
| Newly-granted admin sees "access denied" right after being told they now have access | Confusing, looks like the grant failed | Document the token-refresh gap; ideally auto-refresh via a listened claims-changed signal (Pitfall 9) |
| No audit trail visible in the UI for who changed what/when | Owner (as the accountable party) can't answer "who turned this on" days later, unlike the old env-var+deploy+git-blame trail | Surface a simple audit log view in the admin console itself, not just server-side logging (Pitfall 1) |

## "Looks Done But Isn't" Checklist

- [ ] **Super-admin gate:** Often missing server-side (rules + function) enforcement — verify by attempting an admin write/read as a non-admin authenticated user directly against Firestore/Functions (not through the UI).
- [ ] **Deletion-enable toggle:** Often missing the dry-run-before-enable gate — verify the toggle is genuinely disabled/blocked until a fresh dry-run preview has been run in the session, not just visually discouraged.
- [ ] **Firestore config read in `api` proxy:** Often missing caching — verify with a quick manual load test or log inspection that Firestore reads don't scale 1:1 with request volume.
- [ ] **Song-background protection:** Often "preserved" only by not touching the file, never re-verified — confirm the existing `referencesComplete`/floor-guard unit tests still pass UNCHANGED after the Firestore-config wiring, and that no new test had to be added to cover a regression.
- [ ] **Missing-config-doc handling:** Often untested — verify each knob category against the fail-open/fail-closed table (Pitfall 5) with an actual "doc doesn't exist" test case, not just "field is empty string."
- [ ] **Sender config:** Often creeps into credential fields — verify the `appConfig` schema (or equivalent) contains no key/secret/token-shaped fields.
- [ ] **Revocation:** Often implemented as claim-clear only — verify `revokeRefreshTokens` is called and a revoked admin is denied on their NEXT request, not merely after token expiry.
- [ ] **`*_MAX_INSTANCES` knobs:** Often assumed migrated to Firestore along with everything else — verify the roadmap/plan explicitly scopes these as staying env-var-based (or explicitly re-scopes the whole milestone to solve the module-load-timing problem, which is a much bigger undertaking).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-----------------|
| A destructive toggle was flipped and a cron already ran (Pitfall 1/2) | HIGH | Immediately flip the flag back to disabled (owner action); check Cloud Functions logs for the run's summary (`deletedObjectCount`, `deletedBytes`) to scope the damage; Firebase Storage has no native undelete — recovery depends on whether a bucket-level retention policy / Cloud Storage Object Versioning was enabled beforehand (verify this is ON before this milestone ships, as a mitigating control, not a fix) |
| Config doc missing/malformed causes wrong default in production (Pitfall 5/7) | LOW–MEDIUM | Fix the doc (or the reader's fallback) and it self-heals on next read/cache-expiry — no data loss unless the wrong default happened to be a deletion-enable fail-OPEN, which the safe-default table (Pitfall 5) is designed to prevent from ever occurring |
| Stale cache kept an old value live after an emergency disable (Pitfall 4) | MEDIUM | Redeploy functions to force all instances cold (blunt but immediate), or wait out the TTL if it's short enough to be acceptable; this is exactly why cleanup crons should have NO cache (fresh read every invocation) so this recovery path is never needed for the highest-risk knobs |
| Revoked admin still has valid token (Pitfall 9) | LOW | `revokeRefreshTokens(uid)` immediately if not already done; audit what they did with the residual window via the audit log (Pitfall 1) — this is why the audit log matters even for "just" access issues |
| Secret accidentally written to `appConfig` (Pitfall 12) | HIGH | Rotate the leaked secret immediately (Resend key regeneration, `firebase functions:secrets:set` with new value), delete the field from Firestore, audit who had read access to that doc during the exposure window |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| 1. Live toggle deletes before review | Cost/cleanup control panel phase | UAT: attempt to enable a cleanup flag in the UI without first running a dry-run preview; confirm it's blocked |
| 2. Song-background fail-safes weakened | Firestore-config-read wiring phase | Existing `cleanupOrphanBackgroundsHandler` unit tests (references-incomplete, floor-guard, path-guard) pass UNCHANGED |
| 3. Uncached per-request Firestore reads in hot path | Firestore-config-read wiring phase | Code review: config read is behind a cache check, not directly in the request handler; log/metric check post-deploy |
| 4. Stale warm-instance cache after a change | Firestore-config-read wiring phase | Unit test: two invocations of a cron handler with two different config values return different behavior (no cache); documented TTL for `api` proxy knobs |
| 5. Missing-doc wrong default per knob | Firestore-config-read wiring phase (design table required in PLAN.md) | Unit test per knob category: config doc absent → asserted safe default from the table |
| 6. `maxInstances` can't move to per-request Firestore config | Requirements/scoping (before roadmap) | Roadmap explicitly lists `*_MAX_INSTANCES` as remaining env-var-based, with rationale |
| 7. Type/validation drift (string vs number/boolean) | Firestore-config-read wiring phase | Schema validation (Zod or equivalent) + unit tests for wrong-type and missing-field inputs per knob |
| 8. Client-only admin gate | Super-admin access-gate phase | Attempt admin Firestore write/Function call as non-admin directly (bypassing UI); confirm denied by rules AND function |
| 9. Token refresh gap on grant/revoke | Super-admin access-gate phase | UAT: grant then confirm delayed access; revoke then confirm immediate denial (with `revokeRefreshTokens`) |
| 10. First-super-admin bootstrap | Super-admin access-gate phase | Bootstrap script reviewed as owner-run-once, not a deployed endpoint; no self-grant path exists in deployed code |
| 11. Unverifiable cross-service rules pattern recurrence | Super-admin access-gate phase (`firestore.rules` design) | Rules use `request.auth.token` claim check, not a Firestore doc lookup; both allow AND deny cases pass in the Firestore emulator |
| 12. Secret leak into `appConfig` | No-reply sender config phase | Schema/code review: no key/secret/token fields in the sender config doc; secrets remain `defineSecret`-bound |
| 13. Missing `.env.local`/`functions/.env` in worktrees | Cross-cutting, every phase | Each phase's plan/verification checklist confirms env files present before local test runs |
| 14. Autonomous deploy of rules/functions/secrets | Cross-cutting, every phase | Each phase's completion criteria distinguishes "code-complete + verified" from "deployed" per existing v1.8 phrasing convention; rules/functions/secrets deploys explicitly owner-gated |

## Sources

- Direct repo inspection (HIGH confidence, this-codebase-specific): `functions/src/index.ts` (cleanup handlers, AI proxy limits/rate-limiter, `setGlobalOptions`, secrets), `functions/src/orgMembershipClaims.ts` (custom-claim sync pattern, admin→editor normalization), `firestore.rules` / `storage.rules` (existing RBAC helper functions, `aiUsage`/`aiRateLimits` catch-all deny), `.planning/PROJECT.md` (v1.8 delivery record, Key Decisions, owner-gated-deploy precedent), `.planning/seeds/SEED-001-admin-settings-interface.md` (the full knob list and open design questions this milestone resolves).
- `CLAUDE.md` (this repo's own incident record, HIGH confidence): the `storage.rules`/`firestore.exists()`-inert-in-Storage-emulator incident (2026-08-06) and its fix (custom-claim-based org membership); the `.env.local`/worktree gap; the `npm run type-check` vs `-p tsconfig.app.json` gap (general testing-discipline precedent, not directly cited above but consistent with "verify the real gate, not a narrower proxy for it" theme running through these pitfalls).
- General Firebase/GCP platform behavior (MEDIUM confidence, not repo-verified but well-established platform semantics): Cloud Functions v2 instance warm-reuse and cold-start/module-load timing; Firebase Auth ID token claim propagation and `revokeRefreshTokens`/`checkRevoked` semantics; Firestore lacking server-side schema enforcement.

---
*Pitfalls research for: Owner Admin Console (v1.9) — super-admin gate, Firestore-backed runtime config, live destructive-cleanup toggles, on a live production Firebase app*
*Researched: 2026-08-20*
