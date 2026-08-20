# Architecture Research: v1.9 Owner Admin Console

**Domain:** Owner-only super-admin console integrated into an existing Vue 3 + Firebase (Firestore/Auth/Functions) app
**Researched:** 2026-08-20
**Confidence:** HIGH for codebase-derived findings (read directly from `functions/src/index.ts`, `src/stores/auth.ts`, `firestore.rules`, `storage.rules`, `src/router/index.ts`, `src/components/AppSidebar.vue`); MEDIUM for general Firebase best-practice patterns (web search, official docs + community sources, not independently re-verified against this project's exact Node 22 / firebase-functions v7 / firebase-admin v13 versions)

## System Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Client (Vue 3 + Pinia)                                                    │
│  ┌───────────────┐   ┌──────────────────┐   ┌───────────────────────────┐ │
│  │ auth.ts store │   │ router/index.ts  │   │ AppSidebar.vue             │ │
│  │ +isSuperAdmin │◄──┤ +requiresSuperAdm│◄──┤ +gated "Owner Console" nav │ │
│  └───────┬───────┘   └──────────────────┘   └───────────────────────────┘ │
│          │ getIdTokenResult().claims.superAdmin                            │
│          ▼                                                                 │
│  ┌────────────────────────┐   ┌─────────────────────────────────────────┐ │
│  │ NEW: AdminView.vue     │──►│ NEW: stores/admin.ts (Pinia)             │ │
│  │ (owner console shell)  │   │ onSnapshot(appConfig/global)             │ │
│  │ config panels, sender, │   │ onSnapshot(superAdmins) roster           │ │
│  │ dry-run preview modal  │   │ calls previewCleanupDryRun / setSuperAdmin│ │
│  └────────────────────────┘   └───────────────┬───────────────────────────┘│
└────────────────────────────────────────────────┼──────────────────────────┘
                                                   │ direct Firestore read/write
                                                   │ (rules-gated) + onCall
┌──────────────────────────────────────────────────▼────────────────────────┐
│  Firestore                                                                 │
│  organizations/{orgId}/...   (existing, per-org RBAC — unchanged)          │
│  NEW appConfig/global        (super-admin only; mirrors OrgSettings idiom) │
│  NEW superAdmins/{uid}       (super-admin only; source-of-truth roster)    │
│  aiUsage, aiRateLimits, orgEmailCounters (existing, Admin-SDK-only)        │
└───────────────┬─────────────────────────────────────┬─────────────────────┘
                 │ onDocumentWritten                    │ read (cached, TTL)
┌────────────────▼──────────────┐   ┌───────────────────▼────────────────────┐
│ MODIFIED orgMembershipClaims.ts│   │ NEW superAdminClaims.ts                │
│ syncOrgMembershipClaim         │   │ syncSuperAdminClaim (mirrors it)       │
│ (must MERGE claims, not replace)│  │ setSuperAdminClaim (onCall, gated)     │
└────────────────┬───────────────┘   └───────────────┬─────────────────────┘
                 │ shared                              │ shared
                 └──────────────► NEW claimsHelpers.ts ◄┘
                     mergeAndSetCustomClaims(uid, patch)

┌──────────────────────────────────────────────────────────────────────────┐
│  Cloud Functions (functions/src/index.ts) — MODIFIED read sites          │
│  api (onRequest)            — readAiProxyLimits() → config.aiProxy.*     │
│  cleanupExpiredMedia (cron) — process.env.MEDIA_CLEANUP_ENABLED → config │
│  cleanupOrphanRenders (cron)— process.env.PPTX_RENDER_CLEANUP_ENABLED    │
│  cleanupOrphanBackgrounds   — process.env.BACKGROUND_CLEANUP_ENABLED     │
│  cleanupPptxSources (cron)  — process.env.PPTX_SOURCE_CLEANUP_ENABLED    │
│  sendScheduledReminders     — env.SCHEDULED_MESSAGING_CRON_ENABLED       │
│  sendQueuedMessage          — MESSAGE_MAX_RECIPIENTS/ORG_MAX_EMAILS_PER_DAY,│
│                                 MESSAGE_FROM_ADDRESS → config.sender.*   │
│                              all read through NEW getAppConfig(db)       │
│                              (functions/src/appConfig.ts, per-instance   │
│                              cache with TTL)                             │
│  NEW previewCleanupDryRun (onCall) — reuses the 4 existing exported      │
│      handler bodies with dryRun forced true, returns summary to console │
└──────────────────────────────────────────────────────────────────────────┘
```

**What stays untouched:** per-org RBAC (`organizations/{orgId}/members`, `isOrgMember`/`isOrgEditor`), the `orgId`/`role` custom claim shape and `storage.rules`' claim-only membership check, the messaging send pipeline's internal logic, the PPTX render pipeline, and every existing onCall/onSchedule *signature*. This milestone is additive plumbing (a new claim, a new config doc, new rules, a new UI) plus mechanical read-site swaps inside functions already reading `process.env` — it does not restructure the app's existing store/router/rules architecture, it extends the same idioms already in use (org-scoped settings doc → global config doc; `isOrgEditor` claim/rules pattern → `isSuperAdmin` claim/rules pattern; `syncOrgMembershipClaim` trigger → `syncSuperAdminClaim` trigger).

## 1. Config-doc data model, defaults, and the read/cache seam

### Shape: `appConfig/global`

Top-level singleton doc (not nested under `organizations/{orgId}` — these are cross-org, owner-level controls, mirroring where `aiUsage`/`aiRateLimits`/`orgEmailCounters` already live today). Grouped by the same knob families SEED-001 enumerates:

```typescript
// functions/src/appConfig.ts (NEW — shared by every Cloud Function)
export interface AppConfig {
  cleanup: {
    mediaCleanupEnabled: boolean;
    pptxRenderCleanupEnabled: boolean;
    backgroundCleanupEnabled: boolean;
    pptxSourceCleanupEnabled: boolean;
    mediaRetentionDays: number;
    orphanRenderStaleHours: number;
    backgroundRetentionDays: number;
    pptxSourceRetentionDays: number;
    maxDeletesPerRun: number;
  };
  aiProxy: {
    maxPerMin: number;
    maxPerDay: number;
    allowedModels: string[];
    maxTokensCeiling: number;
    // maxInstances is DELIBERATELY excluded — see the maxInstances note below.
  };
  messaging: {
    scheduledMessagingCronEnabled: boolean;
    messageMaxRecipients: number;
    orgMaxEmailsPerDay: number;
  };
  sender: {
    fromAddress: string; // e.g. "Worship Planner <noreply@yourdomain.com>"
  };
}
```

### Defaults strategy — reuse the exact numbers already hardcoded as env fallbacks

Every knob already has a code-level default today, expressed via `readNumericKnob(process.env.X, DEFAULT)` or a literal (`RETENTION_DAYS = 30`, `DEFAULT_AI_ALLOWED_MODELS`, `500` for the delete cap, `200`/`1000` for messaging). Define one `DEFAULT_APP_CONFIG: AppConfig` constant in `appConfig.ts` using those SAME numbers, and merge it with whatever the doc actually contains, field-by-field — the identical idiom `src/stores/auth.ts`'s `loadOrgContext` already uses for `DEFAULT_ORG_SETTINGS` (`{ ...DEFAULT_APP_CONFIG, ...docData, cleanup: {...DEFAULT_APP_CONFIG.cleanup, ...docData.cleanup}, ... }`, deep-merged per nested group exactly like `slideTypography`/`messaging` are deep-merged today, not a shallow spread). This is why an **empty or entirely-missing `appConfig/global` doc is safe on day one**: deploying this milestone with zero writes to the doc reproduces today's env-derived behavior byte-for-byte, so the swap from `process.env` to Firestore is a no-behavior-change deploy in isolation, and only *becomes* live once the owner actually opens the console and changes a value.

### Read path: `getAppConfig()` — per-instance cache with TTL, not a listener

```typescript
let cached: { value: AppConfig; fetchedAtMs: number } | null = null;
const CONFIG_CACHE_TTL_MS = 60_000; // tunable; see rationale below

export async function getAppConfig(
  db: Firestore,
  now: number = Date.now(),
): Promise<AppConfig> {
  if (cached && now - cached.fetchedAtMs < CONFIG_CACHE_TTL_MS) {
    return cached.value;
  }
  const snap = await db.collection("appConfig").doc("global").get();
  const value = mergeAppConfig(snap.exists ? (snap.data() as Partial<AppConfig>) : {});
  cached = { value, fetchedAtMs: now };
  return value;
}
```

### Invalidation approach — compared, and the recommendation is TTL, not a trigger and not a live listener

| Approach | Correctness across warm instances | Complexity | Fit for hot `api` onCall/onRequest | Fit for daily `onSchedule` crons |
|---|---|---|---|---|
| **Short TTL (recommended)** | Bounded staleness (≤ TTL) on every instance, including newly cold-started ones (cache starts empty, first call always fetches fresh) | Low — one `if` before the existing Firestore call sites | **Best fit.** An owner's emergency stop (mirrors the existing `AI_RATELIMIT_MAX_PER_MIN=0` "full-stop" pattern in `readNumericKnob`'s own doc comment) takes effect within one TTL window on every instance, warm or cold | Good enough, but see below — crons should just skip the cache entirely |
| `onDocumentWritten` cache-bust (module-scope flag clear) | **Broken as a sole mechanism.** Cloud Functions v2 instances are independent processes/containers; a write-triggered function running in its own instance cannot reach into another instance's module-scope variable. It only clears the cache of whichever instance happens to run the *trigger* itself, not the `api`/`sendQueuedMessage` instances actually serving traffic | Medium (a second exported function + wiring) | Marginal benefit on top of TTL, not a replacement for it | Not needed — see below |
| Realtime `onSnapshot` listener kept alive per instance | Correct for *that* instance once the first snapshot arrives, but a fresh/cold-started instance can still receive its first request before the listener's first snapshot resolves — so an initial awaited `get()` is still required regardless, which is most of what TTL already buys you | Higher — listener lifecycle, error/reconnect handling, and Cloud Functions v2 does not guarantee your process stays warm long enough to make persistent listeners worth the overhead for a table this rarely written | Overkill for owner-tunable knobs (not a sub-second latency requirement) | Overkill |

**Recommendation:** TTL cache (30–60s) for the hot paths (`api`, `sendQueuedMessage`, and any future onCall/onRequest reader), **no cache at all — read fresh every invocation** for the four `onSchedule` cleanup crons and `sendScheduledReminders`. Crons run once daily; the cost of one extra Firestore read per run is negligible next to the correctness requirement that a cleanup sweep must never act on a config value staler than "whatever the owner most recently saved" — especially given the song-linked-background hard constraint (below). Treat `onDocumentWritten`-based invalidation as optional defense-in-depth *layered on top of* TTL later, never as a substitute for it, since it cannot reach concurrent sibling instances.

**Song-linked-background guarantee, made explicit for this seam:** `cleanupOrphanBackgroundsHandler`'s 3-tier reference detection and its two fail-safes (`referencesComplete` + floor-guard) are pure logic unrelated to the config source — swapping `process.env.BACKGROUND_CLEANUP_ENABLED` for `config.cleanup.backgroundCleanupEnabled` changes nothing about *how* a background is judged orphaned, only *where the enable flag comes from*. The existing safety net is preserved automatically as long as the swap is mechanical (same gate shape: `dryRun = config.cleanup.backgroundCleanupEnabled !== true`, still fail-safe on any falsy/missing value). This should be a unit-test assertion in the phase that does the swap, not just an inference.

### The `maxInstances` limitation — flag for roadmap, not silently absorbed

`AI_PROXY_MAX_INSTANCES` (bound to `api`'s `onRequest({ maxInstances: ... })`) and `GLOBAL_MAX_INSTANCES` (bound to `setGlobalOptions({ maxInstances: ... })`, called once at module load before the first function definition) are **Cloud Functions v2 deploy-time configuration**, not values read per-invocation — they are baked into the function's build/deploy artifact and cannot be changed by writing to Firestore without a redeploy, structurally, regardless of how `getAppConfig()` is wired. SEED-001 lists both under "AI proxy knobs" / "fan-out knobs" as candidates to lift into the live config doc; **that specific claim cannot be fully delivered for these two knobs.** Recommendation: keep `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` as `process.env`-configured exactly as today (no functional change), but surface their *current effective value* read-only in the admin console (a cheap onCall or a small `deployConfig` doc written once at deploy time, not user-editable) with a "requires redeploy to change" label, so the console is honest about what it can and cannot control live. The Cloud Run `render-service`'s own `--max-instances=3`/`--concurrency=1` flags (a separate deployable, `render-service/DEPLOY.md`) are even further outside this seam — deploy-time `gcloud` flags on a different service entirely, not in scope for `appConfig` at all.

## 2. The super-admin claim

### Reuse the trigger-sync architecture; do NOT reuse the claim keys

`orgMembershipClaims.ts` already establishes the pattern this milestone should mirror: a Firestore doc is the source of truth, an `onDocumentWritten` trigger syncs it into a custom claim via a pure, independently-testable `decide*` function shared with a one-off bootstrap script. Reuse that *shape* for super-admin — a new top-level `superAdmins/{uid}` collection (existence = granted, mirroring how `organizations/{orgId}/members/{uid}` existence = org membership) plus a new `syncSuperAdminClaim` trigger and a shared `decideSuperAdminClaim` function.

**Do NOT put `superAdmin` inside the existing `{orgId, role}` claim object.** `ORG_CLAIM_KEYS` (`orgId`, `role`) is a locked 2-key shape read directly by `storage.rules`' `isOrgMemberByClaim`; conflating a cross-org "am I the owner" bit into an org-scoped claim muddies both.

### The load-bearing hazard this milestone must fix, not just avoid

`getAuth().setCustomUserClaims(uid, claims)` **replaces the entire custom-claims object** — it is not a merge. `syncOrgMembershipClaimHandler` today calls it as `getAuth().setCustomUserClaims(uid, decision.claims)` with `decision.claims` being *only* `{orgId, role}`. Once a `superAdmin: true` claim exists on a user, **any subsequent write to that same user's `organizations/{orgId}/members/{uid}` doc — a role change, a re-invite, literally any membership write — silently wipes their `superAdmin` claim**, because the sync trigger overwrites the whole claims object with just the two org keys. This is not a hypothetical: the owner's own membership doc will be touched by ordinary product usage over time. Symmetrically, a naive new `setSuperAdminClaim` onCall that calls `setCustomUserClaims(uid, {superAdmin: true})` would wipe that user's `orgId`/`role` claim the moment it's granted, breaking their own org access until the next `loadOrgContext` re-sync.

**Fix (must ship in the same phase as the new claim, not later):** a shared `functions/src/claimsHelpers.ts` exporting `mergeAndSetCustomClaims(uid, patch)` that reads the user's *current* claims via `getAuth().getUser(uid)`, spreads them, applies `patch`, and writes the merged object. Both `syncOrgMembershipClaimHandler` (**modified**) and the new `syncSuperAdminClaimHandler` (**new**) must route through it instead of calling `setCustomUserClaims` directly.

### Where the claim is set

- **Bootstrap (the very first owner):** a one-off Admin-SDK script mirroring the existing `40-04` org-claim backfill script precedent — run locally with a service account, writes `superAdmins/{ownerUid}` directly (or calls `mergeAndSetCustomClaims` directly), bypassing rules via the Admin SDK. Chicken-and-egg is unavoidable for the first grant; every subsequent grant goes through the gated onCall.
- **Steady state:** a `setSuperAdminClaim` onCall guarded by `request.auth.token.superAdmin === true` (the caller's own already-verified ID token claim — onCall already verifies the token signature server-side, so no extra re-verification round-trip is needed, unlike `verifyAppCaller`'s manual `verifyIdToken` for the `onRequest`-based proxy). Writes/deletes the target's `superAdmins/{targetUid}` doc; the `syncSuperAdminClaim` trigger does the actual claim write, keeping one single writer of custom claims per concern (mirrors the existing "source doc → trigger → claim" indirection, never a direct claim write from the onCall itself).

### Client-side surfacing

- `src/stores/auth.ts` (**modified**): add `isSuperAdmin = ref(false)`, and read `result.claims.superAdmin === true` off the **same** `getIdTokenResult` call `refreshOrgClaim` already makes in `loadOrgContext` — no second token fetch needed, just read one more field off the existing result. Unlike org-claim refresh, a super-admin grant is a rare, manual, owner-initiated event, not a "just joined" race, so an unconditional forced refresh on every session load is unnecessary; instead, force one `getIdTokenResult(user, true)` specifically in the new admin route's guard (below) so a just-granted user doesn't have to sign out/in to see the console — mirrors `refreshOrgClaim`'s `awaitClaim` bounded-retry idea but scoped to the one place it's actually needed.
- `src/router/index.ts` (**modified**): add `requiresSuperAdmin?: boolean` to `RouteMeta`, a new route (see naming note below), and a guard branch mirroring `requiresEditor`'s shape — `waitForSuperAdmin()` + a forced claim refresh + redirect when false.
- `src/components/AppSidebar.vue` (**modified**): a new nav entry in the existing `navItems` computed, gated on `authStore.isSuperAdmin`, following the identical `if (authStore.isEditor) { ... }` pattern already used for every other entry.

**Naming collision to avoid:** the route `/admins` and nav label "Admins" are already taken by the existing per-org `TeamView.vue` (editor/viewer team management). Name the new surface distinctly — e.g. route `owner-console` at `/owner-console`, nav label "Owner Console" — so neither users nor future contributors confuse per-org team admin with the cross-org super-admin console.

## 3. Security rules

### `appConfig/*` and `superAdmins/*` — claim-based, not `get()`-based

Both new collections are top-level (not nested under `organizations/{orgId}`), same placement rationale already documented in `firestore.rules` for `aiUsage`/`aiRateLimits`: the catch-all `match /{document=**} { allow read, write: if false; }` denies them by default, and a claim check needs no cross-document read (cheaper and simpler than `isOrgEditor`'s `get()`-based role lookup, which exists only because org role isn't itself a claim value in the same request).

```
function isSuperAdmin() {
  return request.auth != null && request.auth.token.superAdmin == true;
}

match /appConfig/{docId} {
  allow read, write: if isSuperAdmin();
}

match /superAdmins/{uid} {
  allow read, write: if isSuperAdmin();
}
```

Cloud Functions read/write both via the Admin SDK regardless (bypasses rules entirely, same as every existing Admin-SDK-owned collection) — these rules exist solely to gate the **admin console's direct client-SDK access** (the console reads `appConfig/global` via `onSnapshot` and writes it via `setDoc`/`updateDoc` directly, no onCall wrapper needed for ordinary config edits, mirroring how `SettingsView.vue` already writes `organizations/{orgId}` fields directly today) and to gate a super-admin's own read of the roster.

### Rules-testing discipline (per CLAUDE.md's storage.rules lesson)

Every new rule needs a **genuine ALLOW-case** emulator test, not only DENY cases — the exact defect CLAUDE.md documents (`storage.rules`' deny-everyone bug survived a milestone because only DENY cases were proven) must not recur here. In `src/rules.test.ts`, use `@firebase/rules-unit-testing`'s `authenticatedContext(uid, { superAdmin: true })` to construct a genuinely-super-admin auth context and prove a real read AND a real write of `appConfig/global` and `superAdmins/{uid}` both succeed — alongside DENY cases for a signed-in non-admin and an org editor (who must NOT incidentally pass through the unrelated `/{collection}/{docId}` org-scoped wildcard, though that wildcard is scoped under `organizations/{orgId}` and structurally cannot reach a top-level collection, so this is a lower-risk boundary than the pptxRenders/services exclusions were).

Since `appConfig`/`superAdmins` are pure Firestore constructs with no Storage-rules counterpart, the specific `firestore.exists()`-is-inert-in-the-Storage-emulator trap does not apply directly here (there is no cross-service check in either new rule — `request.auth.token.superAdmin` is read directly off the token, exactly the claim-only pattern `storage.rules` had to migrate *to* after that incident). The broader lesson — an environment-limitation label can silently hide a real defect — still applies to *how* these tests are graded: a passing ALLOW-case test against the real emulator is required evidence, not an assumption.

## 4. New vs. modified components

| Component | New / Modified | Notes |
|---|---|---|
| `functions/src/claimsHelpers.ts` | **New** | `mergeAndSetCustomClaims(uid, patch)` — shared merge-then-write, closes the claim-wipe hazard |
| `functions/src/orgMembershipClaims.ts` | **Modified** | `syncOrgMembershipClaimHandler` switches from `setCustomUserClaims` (replace) to `mergeAndSetCustomClaims` (merge) |
| `functions/src/superAdminClaims.ts` | **New** | `decideSuperAdminClaim`, `syncSuperAdminClaimHandler` + `syncSuperAdminClaim` (`onDocumentWritten` on `superAdmins/{uid}`), `setSuperAdminClaim` (`onCall`, gated on caller's own `superAdmin` claim) |
| `functions/scripts/bootstrap-super-admin.ts` (or similar) | **New** | One-off Admin-SDK script, mirrors the existing `40-04` org-claim backfill precedent; grants the first owner |
| `functions/src/appConfig.ts` | **New** | `AppConfig` type, `DEFAULT_APP_CONFIG`, `mergeAppConfig`, `getAppConfig(db)` — per-instance TTL cache |
| `functions/src/index.ts` | **Modified** | Every v1.8 knob read-site (`readAiProxyLimits`, the four cleanup handlers' `process.env.*_ENABLED`/`*_RETENTION_DAYS`, `readDeleteCap`, `runScheduledMessagingCron`'s env gate, `sendQueuedMessage`'s `MESSAGE_MAX_RECIPIENTS`/`ORG_MAX_EMAILS_PER_DAY`/`MESSAGE_FROM_ADDRESS`) swapped to read through `getAppConfig()`. `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` explicitly **excluded** (deploy-time limitation, see §1) |
| `functions/src/index.ts` — `previewCleanupDryRun` | **New** (additive export in the same file, or a new `functions/src/dryRunPreview.ts`) | `onCall`, gated `isSuperAdmin`; invokes the same 4 already-exported handler bodies (`cleanupExpiredMediaHandler`, `cleanupOrphanRendersHandler`, `cleanupOrphanBackgroundsHandler`, `cleanupPptxSourcesHandler`) with dry-run **forced true regardless of the live config**, returns the summary synchronously |
| `src/stores/auth.ts` | **Modified** | `isSuperAdmin` ref, read off the existing `getIdTokenResult` call; no new token fetch on ordinary session load |
| `src/router/index.ts` | **Modified** | `requiresSuperAdmin` meta key, new `owner-console` route, guard branch (forces one claim refresh before redirecting) |
| `src/components/AppSidebar.vue` | **Modified** | New nav entry, gated `authStore.isSuperAdmin`, distinctly labeled from the existing "Admins" (TeamView) entry |
| `src/stores/admin.ts` | **New** (Pinia) | `onSnapshot(appConfig/global)`, `onSnapshot(superAdmins)` roster, calls `previewCleanupDryRun`/`setSuperAdminClaim` |
| `src/views/AdminView.vue` (or `OwnerConsoleView.vue`) | **New** | Console shell — routed at `/owner-console` |
| `src/components/admin/*` (config panels, sender form, dry-run preview modal, roster manager) | **New** | Subcomponents of the console |
| `firestore.rules` | **Modified** | `isSuperAdmin()` helper + `appConfig/*` + `superAdmins/*` match blocks (purely additive at the top level, same placement precedent as `aiUsage`/`aiRateLimits`) |
| `src/rules.test.ts` | **Modified** | New `describe` blocks — genuine ALLOW-case + DENY-case coverage for both new collections |

## 5. Suggested build order (dependency-ordered)

**A — Claim & gate (foundation)**
1. `claimsHelpers.ts` (`mergeAndSetCustomClaims`)
2. `superAdminClaims.ts` (decide/sync/onCall) **shipped together with** the `orgMembershipClaims.ts` merge fix — do not let the new claim type exist even one phase without the fix, since ordinary org-membership writes happen constantly and would otherwise silently de-admin the owner
3. Bootstrap script; owner runs it once, locally, against production (mirrors the existing org-claim backfill runbook precedent)
4. `auth.ts` `isSuperAdmin` + router guard + nav entry — safe to ship even before the console has real content (route can 404/placeholder); proves the gate end-to-end early

**B — Config doc + rules**
5. `appConfig.ts` (type, defaults, cached reader) — unit-testable against a fake Firestore, no dependency on A beyond "a super-admin exists to eventually use it"
6. `firestore.rules`: `isSuperAdmin()` + `appConfig/*` + `superAdmins/*`, plus the genuine ALLOW-case `rules.test.ts` coverage — must land before the console (phase D) is given direct client-SDK read/write access to `appConfig/global`

**C — Functions read config (swap the levers)**
7. Cleanup handlers' four `*_ENABLED`/retention/`maxDeletesPerRun` reads → `config.cleanup.*` (mechanical, per-handler; each already reads at call-time via small `readX()` helpers, so this is a source swap, not a control-flow change) — assert the song-linked-background fail-safes are unaffected
8. AI proxy's `readAiProxyLimits()` → `config.aiProxy.*` (excluding `maxInstances`, per §1)
9. `runScheduledMessagingCron` + `sendQueuedMessage`'s `MESSAGE_MAX_RECIPIENTS`/`ORG_MAX_EMAILS_PER_DAY` → `config.messaging.*`
10. `MESSAGE_FROM_ADDRESS` → `config.sender.fromAddress` (drop or demote the `defineString` to a last-resort default only)

Each swap depends only on B (the doc + rules existing) and is independently a no-behavior-change deploy while `appConfig/global` is empty (§1's defaults-merge guarantee) — safe to ship ahead of the UI.

**D — Admin UI**
11. `stores/admin.ts`
12. `AdminView.vue` console shell + per-knob-group panels wired to the store, writing `appConfig/global` directly (client SDK, rules-gated)
13. Super-admin roster management UI (`setSuperAdminClaim` onCall)

Depends on A (to reach the gated route) and B (rules must already permit the console's direct reads/writes); should land **after** C so a toggle flipped in the UI has an observable effect during UAT, though it is technically buildable in parallel with C.

**E — Deletion-toggle safety (dry-run preview)**
14. `previewCleanupDryRun` onCall — reuses the phase-C-swapped handler bodies with dry-run forced true independent of the live config value
15. UI: the confirm-then-preview flow gating any `*_CLEANUP_ENABLED` flip in the console behind a fresh preview call

Depends on C (handlers must already be config-driven so the preview and the live toggle read the same source of truth) and D (console shell to host the modal).

**No-reply sender** is delivered inside C.10 (functions side) + D.12 (console form) — it does not need its own phase.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calling `setCustomUserClaims` without merging existing claims
**What people do:** write a new claim-setting path (or "fix" an existing one) with `setCustomUserClaims(uid, newClaimsOnly)`.
**Why it's wrong:** it replaces the *entire* claims object; any other claim on that user (here, specifically `orgId`/`role` vs. `superAdmin`) silently disappears the next time either sync path fires.
**Instead:** every claim write goes through `mergeAndSetCustomClaims`, which reads current claims first.

### Anti-Pattern 2: Treating Cloud Functions v2 `maxInstances`/`setGlobalOptions` as runtime-readable
**What people do:** assume "move it to Firestore" universally removes the redeploy requirement for every env-derived knob.
**Why it's wrong:** function-level and project-level `maxInstances` are deploy-time build configuration, evaluated once when the function is deployed/instantiated, not per-invocation.
**Instead:** exclude `AI_PROXY_MAX_INSTANCES`/`GLOBAL_MAX_INSTANCES` (and the Cloud Run render-service's own `--max-instances` flag) from the "live, no-redeploy" claim; surface them read-only with a "requires redeploy" label if shown in the console at all.

### Anti-Pattern 3: Letting the dry-run "preview" call actually delete
**What people do:** reuse a handler for both "preview" and "live run" by passing the CURRENT config's enable flag through unchanged.
**Why it's wrong:** a UI or wiring bug in the preview path could trigger a real delete under the "preview" label — exactly the blast-radius the deletion-toggle-safety requirement exists to prevent.
**Instead:** `previewCleanupDryRun` must force `dryRun = true` unconditionally, never derive it from the live `appConfig` value.

### Anti-Pattern 4: Gating a new admin collection with a cross-document `get()`/`exists()` check when a claim suffices
**What people do:** copy `isOrgEditor`'s `get(...).data.role in [...]` shape reflexively for every new gated collection.
**Why it's wrong:** it's strictly more expensive (extra billed read) and, per this project's own storage.rules incident, cross-service/cross-document rule checks are exactly the pattern that produced an undetectable deny-everyone bug — a direct claim read is both cheaper and safer.
**Instead:** `isSuperAdmin()` reads `request.auth.token.superAdmin` directly, no `get()` call, mirroring `storage.rules`' post-incident `isOrgMemberByClaim`.

## Integration Points

| Boundary | Communication | Notes |
|---|---|---|
| Owner console (client) ↔ `appConfig/global` | Direct Firestore SDK (`onSnapshot`/`setDoc`), rules-gated | No onCall wrapper needed for ordinary config edits — matches `SettingsView.vue`'s existing direct-write pattern for org settings |
| Owner console ↔ super-admin grant/revoke | `setSuperAdminClaim` onCall | Privileged write to a *different user's* claim; must go through Admin SDK, not a direct client write to `superAdmins/{targetUid}` from an arbitrary super-admin's session (rules alone would permit it, but centralizing in the onCall keeps one auditable write path and one place to add logging later) |
| Cloud Functions ↔ `appConfig/global` | Admin SDK, cached via `getAppConfig()` | TTL for hot paths, uncached for daily crons (§1) |
| `syncOrgMembershipClaim` ↔ `syncSuperAdminClaim` | Shared `claimsHelpers.ts` | The only two writers of custom claims in the codebase after this milestone; both must route through the merge helper |
| Owner console ↔ cleanup dry-run preview | `previewCleanupDryRun` onCall | Read-only w.r.t. Storage/Firestore state; reuses existing exported handler bodies, never mutates |

## Sources

- Direct codebase reads (HIGH confidence): `functions/src/index.ts`, `functions/src/orgMembershipClaims.ts`, `src/stores/auth.ts`, `firestore.rules`, `storage.rules`, `src/router/index.ts`, `src/components/AppSidebar.vue`, `functions/package.json`, `.planning/PROJECT.md`, `.planning/seeds/SEED-001-admin-settings-interface.md`
- [Control Access with Custom Claims and Security Rules | Firebase Authentication](https://firebase.google.com/docs/auth/admin/custom-claims) — official docs, custom-claims 1000-byte limit and role-claim guidance (MEDIUM→HIGH, official source)
- [How to Set Up Firebase Auth with Custom Claims for Role-Based Access Control](https://oneuptime.com/blog/post/2026-02-17-how-to-set-up-firebase-auth-with-custom-claims-for-role-based-access-control-in-gcp/view) (MEDIUM, community source, corroborates official docs)
- General search results on Cloud Functions v2 per-instance/module-scope caching and `onDocumentWritten`-based invalidation, and `minInstances` warm-instance behavior (LOW/MEDIUM — general web search, not independently re-verified against this project's exact dependency versions; used only to corroborate a design already reasoned from this project's own existing `readNumericKnob`/handler-export patterns, not as the primary basis for the recommendation)

---
*Architecture research for: v1.9 Owner Admin Console*
*Researched: 2026-08-20*
