# Stack Research

**Domain:** Owner-only super-admin console for a live Vue 3 + Firebase app — Firestore-backed runtime
config for Cloud Functions gen2, custom-claim admin gate, admin UI
**Researched:** 2026-08-20
**Confidence:** HIGH — every recommendation below is either (a) verified against this repo's installed
package manifests / source (`functions/package.json`, `functions/src/index.ts`,
`functions/src/orgMembershipClaims.ts`, `src/stores/auth.ts`, `firestore.rules`), or (b) confirmed against
current npm registry versions and official Firebase documentation fetched this session. No new runtime
dependency is required for any of the three questions in scope — this is a near-zero-new-dependency
milestone by design.

## Recommended Stack

### Core Technologies (already installed — no bump required for this milestone)

| Technology | Installed | Latest (npm, verified 2026-08-20) | Purpose | Why Recommended |
|------------|-----------|-------------------------------------|---------|-----------------|
| `firebase-admin` | `^13.10.0` | `14.3.0` | Reads the Firestore config doc server-side (`getFirestore()`), sets the `superAdmin` custom claim (`getAuth().setCustomUserClaims`) | Already the only thing in this codebase that talks to Firestore/Auth from Functions. `^13.10.0` covers everything this milestone needs (`Firestore#doc().get()`, `Auth#setCustomUserClaims`, `Auth#getUser`) — no capability in v14 this milestone requires. **Do not bump** to v14 as part of this milestone; it's an unrelated major-version risk for zero gain here (same call made in the v1.5 custom-claims research). |
| `firebase-functions` | `^7.2.5` | `7.3.2` | `onCall`/`onSchedule`/`onDocumentWritten` wrappers already used for every v1.8 knob and the org-claim trigger | The existing `^7.2.5` range already resolves to `7.3.2` on a plain `npm install` — nothing to change. No new trigger type is needed: `onDocumentWritten` (already imported, already used by `syncOrgMembershipClaim`) is the right primitive to log/audit config-doc writes; it is **not** used for cache invalidation (see Pattern 1 below — that's a deliberate non-use, not an oversight). |
| `firebase` (client SDK) | `^12.0.0` | `12.18.0` | Admin console reads/writes the config doc via `onSnapshot`/`updateDoc`, exactly like every other Pinia store in this app | Already the app's only Firestore client. The `^12.0.0` range already resolves to `12.18.0`. |

**Net effect: zero `npm install` needed for either `functions/` or the root app to build this milestone.**
Both existing semver ranges already cover the current latest patch/minor; the only "version change" worth
doing is letting a routine `npm install`/`npm update` pick up 7.3.2 / 12.18.0 opportunistically, unrelated
to this feature.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none — plain Admin SDK + a module-scope object)* | — | In-memory config cache with TTL | See Pattern 1. A cache library is unnecessary complexity for caching **one document**. |
| *(none — plain functions)* | — | Admin-form validation (numeric knob bounds, toggle state) | See "What NOT to Use" — matches the app's existing validation style (`SettingsView.vue`'s `Number(...)` + guard, no library) exactly. |

### Development Tools

No new dev tooling. `vitest` (already `^4.1.10` in `functions/`) covers unit-testing the new
`getRuntimeConfig()` cache module and the claim-merge helper, mirroring the existing
`orgMembershipClaims.test.ts` / `backfillOrgClaims.test.ts` pattern (mocked Admin SDK, handler body
exported separately from the trigger/onCall wrapper for testability).

## Installation

```bash
# No new dependencies required for functions/ or the root app.
# Optional, unrelated-to-this-feature housekeeping only:
cd functions && npm install   # picks up firebase-functions 7.3.2 within the existing ^7.2.5 range
npm install                   # root: picks up firebase 12.18.0 within the existing ^12.0.0 range
```

## Q1 — Firestore-as-runtime-config for gen2 Cloud Functions

**Answer: plain Admin SDK `Firestore#doc().get()`, wrapped in a module-scope TTL cache. No library.**

### Pattern 1 (recommended): module-scope object + TTL, NOT trigger-based invalidation

```typescript
// functions/src/runtimeConfig.ts (new file, mirrors readAiProxyLimits's DI-for-testability style)
import { getFirestore } from "firebase-admin/firestore";

export interface RuntimeConfig {
  mediaCleanupEnabled: boolean;
  pptxRenderCleanupEnabled: boolean;
  backgroundCleanupEnabled: boolean;
  pptxSourceCleanupEnabled: boolean;
  // ...retention windows, AI-proxy knobs, messaging knobs — same shape as SEED-001's list
  noReplyFromAddress: string;
}

const DEFAULTS: RuntimeConfig = { /* today's process.env fallback defaults, unchanged */ };
const TTL_MS = 60_000; // 60s: bounds staleness without meaningfully raising read cost

let cached: { value: RuntimeConfig; fetchedAt: number } | null = null;

export async function getRuntimeConfig(
  db = getFirestore(),
  now = () => Date.now(),
): Promise<RuntimeConfig> {
  if (cached && now() - cached.fetchedAt < TTL_MS) {
    return cached.value;
  }
  try {
    const snap = await db.doc("system/runtimeConfig").get();
    const value: RuntimeConfig = { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) };
    cached = { value, fetchedAt: now() };
    return value;
  } catch (err) {
    console.error("[runtimeConfig] read failed, serving last-known/defaults:", err);
    // Fail OPEN to the last good cache if one exists, else DEFAULTS — matches
    // this codebase's existing fail-open posture (AI rate limiter, dry-run
    // cleanup flags all default to the safe/off state already).
    return cached?.value ?? DEFAULTS;
  }
}
```

**Why TTL, not an `onDocumentWritten` trigger flipping a global flag:** the natural-looking design —
have `syncOrgMembershipClaim`-style trigger on `system/runtimeConfig` set some in-memory
"dirty"/"latest" flag that every warm `api`/cron instance reads — **does not work across gen2 Cloud
Functions instances.** Each `onRequest`/`onCall`/`onSchedule` function can scale to N separate Cloud Run
instances/processes; module-scope state persists only *within one instance's own warm invocations*, per
Firebase's own guidance on caching in global scope ([Tips & tricks — Cloud Functions for
Firebase](https://firebase.google.com/docs/functions/tips)). A trigger firing in instance A cannot reach
into instance B's memory. So a trigger-based "push invalidation" would only ever invalidate the one
instance that happened to also be warm and receive the trigger event — every other warm instance keeps
serving stale config until ITS OWN TTL naturally expires anyway. The trigger adds a second, unreliable
invalidation path on top of a TTL path you need regardless — pure complexity for no correctness gain.

**Use `onDocumentWritten` for something else it's actually good at instead:** an audit-log side effect
(who-changed-what-when) when the admin writes the config doc, matching the existing
`syncOrgMembershipClaim` shape 1:1 — but NOT for cache invalidation.

**60s TTL, not a raw per-invocation read:** the pattern above is one Firestore `get()` per warm instance
per 60 seconds, not one read per request. Cost is negligible at this app's scale (Firestore reads are
$0.036/100K beyond the free 50K/day — even the busiest function here, the `api` proxy, is nowhere near
volume where a 60s-TTL'd single-document read matters). A **cold start always reads fresh** (module
state resets), so a brand-new instance never serves data older than the deploy, and updated config
propagates within, worst case, one TTL window on any already-warm instance — acceptable per SEED-001
("takes effect with no redeploy"; it does not require sub-second propagation).

**Reads from the config doc must be safe even when it doesn't exist yet.** `DEFAULTS` above should be the
literal values the codebase's `process.env` fallbacks use today (`readNumericKnob(..., 500)` etc.) — this
makes the Firestore doc purely additive: an org with no doc yet, or a doc missing a field, behaves
exactly as production does today. Never make an absent field mean "0"/"disabled" by accident — mirror the
existing `readNumericKnob` "unset falls back to fallback, not to 0" fix (WR-01, already in this file)
for every new knob.

**Where the read integration points are:** every `process.env.X` read flagged in `functions/src/index.ts`
(lines around 236, 245, 961, 1009, 1037, 1169, 1199, 1387, 1439, 1633, 1667, 2743–2744, plus
`readAiProxyLimits`'s `env` parameter, and `MESSAGE_FROM_ADDRESS`'s `defineString`) becomes a call to
`getRuntimeConfig()` at the top of the relevant handler body, replacing (or falling back to, if you want
a safety net during rollout) the `process.env` read. Because the existing code already threads a
`readAiProxyLimits(env = process.env)` / handler-body-vs-wrapper split for testability, swapping the
source from `process.env` to `await getRuntimeConfig()` is a like-for-like substitution, not a new
architecture.

### What NOT to add for this: `node-cache` (5.1.2), `lru-cache` (11.5.2), Firebase Remote Config

- **`node-cache` / `lru-cache`** — both are general-purpose multi-key eviction caches. This milestone
  caches exactly **one document**. A `{ value, fetchedAt }` object with a `Date.now()` comparison is the
  entire feature; a cache library adds an API surface and a dependency for something 6 lines already
  solve. Reach for one of these only if the config surface grows into many independently-fetched
  documents/keys with different TTLs — not the case here (SEED-001 explicitly scopes this to global
  knobs).
- **Firebase Remote Config** — a real alternative worth naming and rejecting explicitly, since it's
  Firebase's own purpose-built "runtime config without redeploy" product. Rejected because: (1) it's a
  **second config surface** alongside Firestore — the app is Firestore end-to-end already (org settings,
  messaging settings, everything else in `organizations/{orgId}`), and SEED-001 explicitly asks for "an
  admin-only Firestore config doc," not a second system; (2) Remote Config values are flat
  string/number/boolean key-value pairs with no native nested-object modeling (this config has structured
  groups — cleanup flags, retention windows, AI knobs, messaging knobs — that map naturally onto one
  Firestore document's fields but awkwardly onto flat RC parameters); (3) reading RC from a gen2 Cloud
  Function requires the separate `firebase-admin/remote-config` module and its own template-fetch/caching
  API, with real-time propagation to server-side Functions only via 1st-gen-era
  `onConfigUpdated`-style triggers that don't map cleanly to gen2 without extra plumbing; (4) writing to
  RC from the admin console needs either the Firebase Console or the Remote Config REST API/Admin SDK —
  another new client integration, versus reusing the `onSnapshot`/`updateDoc` pattern every other settings
  screen in this app already uses. Firestore wins on architectural consistency with zero new moving parts.

## Q2 — Custom auth claim from an admin action, and the client-side refresh

**Answer: the same `getAuth().setCustomUserClaims` + `getIdTokenResult(user, true)` pair the v1.5
org-membership claim already uses — but with one critical, codebase-specific gotcha this milestone MUST
handle: custom claims are set by full REPLACEMENT, not merge, and this app already has ONE claim-writer
(`syncOrgMembershipClaim`) that will silently wipe a `superAdmin` claim the moment it runs.**

### The mechanism (already proven in this codebase — reuse verbatim)

- **Server side (Admin SDK, unchanged API):** `getAuth().setCustomUserClaims(uid, claims | null)` —
  confirmed signature already verified against the installed `firebase-admin` types in the v1.5 research
  (`base-auth.d.ts:300`), still current at `firebase-admin@14.3.0`. 1000-byte total claims limit still
  applies (well within budget for `{orgId, role, superAdmin}`).
- **Client side (force the token to reflect the new claim):** `getIdTokenResult(user, /* forceRefresh */
  true)` — exactly `src/stores/auth.ts`'s existing `refreshOrgClaim` helper (line ~131). Reuse the same
  primitive; you do not need a new one. A bounded-retry variant (the `CLAIM_REFRESH_MAX_ATTEMPTS` /
  `CLAIM_REFRESH_DELAY_MS` pattern) matters when the claim write and the client refresh race each other —
  for `superAdmin`, that race is rarer (grants are infrequent, admin-initiated, not part of the hot
  sign-up path), so a single forced refresh after the grant call resolves is likely sufficient; add the
  retry loop only if UAT shows the admin's own session doesn't see the new claim immediately after
  granting themselves/another admin.

### The gotcha this milestone MUST design around: claim replacement, not merge

`setCustomUserClaims(uid, claims)` **overwrites the entire custom-claims object** — it does not deep-merge
with whatever claims already exist. This codebase already has exactly one claim writer,
`syncOrgMembershipClaim` (`functions/src/orgMembershipClaims.ts:188`/`191`), which calls
`getAuth().setCustomUserClaims(uid, decision.claims)` where `decision.claims` is `{orgId, role}` **only**
— and `setCustomUserClaims(uid, null)` on delete, which clears everything. The owner (and any future
super-admin) is necessarily also an org member with their own `organizations/{orgId}/members/{uid}` doc.
The first time that member doc is written again for ANY reason after `superAdmin` is granted — a role
change, a re-invite, even the "one-time migration: admin → editor" backfill patch already in
`loadOrgContext` (`src/stores/auth.ts:278`) triggering a Firestore write that re-fires
`syncOrgMembershipClaim` — **the trigger will silently overwrite `{orgId, role, superAdmin}` with
`{orgId, role}`, dropping `superAdmin` with no error, no log line naming the loss, and no user-visible
symptom until the owner is locked out of the admin console.**

**Required fix, in scope for this milestone, not optional hardening:** every claim writer must
read-merge-write, not blind-write. Two call sites need this:
1. **The new super-admin grant path** (whatever writes `superAdmin: true`) must first `getAuth().getUser(uid)`
   to read `customClaims`, merge in `superAdmin`, then write the full merged object — matching
   `decideMembershipClaim`'s own idempotency check (`orgMembershipClaims.ts:138`, which already calls
   `getAuth().getUser(uid)` to compare before writing) as the precedent to follow.
2. **`syncOrgMembershipClaimHandler`** (`orgMembershipClaims.ts:173`) must be changed to preserve any
   existing `superAdmin` key when it recomputes `{orgId, role}` — read the current claims first (same
   `getAuth().getUser(uid)` call it already makes for the idempotency check can be reused/extended to also
   carry `superAdmin` forward into the new claims object) and on the `clear` branch
   (`setCustomUserClaims(uid, null)`), decide explicitly whether losing org membership should also strip
   `superAdmin` (probably not — a super-admin isn't required to belong to any org to administer the app) —
   i.e. `clear` should become "set `{superAdmin}` only" rather than `null`, when a `superAdmin` claim is
   present.

This is the single most important integration finding of this research: **do not treat `superAdmin` as an
independent claim namespace from `{orgId, role}` — they share one JSON object on the token, and every
existing and new writer must merge, not replace.**

### Bootstrapping the first super-admin (chicken-and-egg)

An `onCall` "grant super-admin" Function gated by "caller must already have `superAdmin: true`" cannot
grant the very first super-admin (the owner). Follow the exact precedent already in this codebase:
`functions/src/backfillOrgClaims.ts` is a **Node script, not a deployed Function** (deliberately excluded
from `functions/src/index.ts`'s exports — see its own header comment, "THIS IS A NODE SCRIPT, NOT A
DEPLOYED FUNCTION"), run once by the owner with admin credentials, dry-run by default, `--apply` to write.
Add a sibling one-off script (`functions/src/grantSuperAdmin.ts` or similar) using the same shape — the
owner runs it once, by uid, to bootstrap their own claim; every subsequent grant (adding a second
super-admin) goes through the in-console `onCall` Function once at least one super-admin exists.

### Firestore/Storage rules integration

Add a `isSuperAdmin()` helper to `firestore.rules` alongside the existing `isSignedIn()` / `isOrgMember()`
/ `isOrgEditor()` helpers (`firestore.rules:7-26`), reading the claim the same way those already read
`role`:

```
function isSuperAdmin() {
  return isSignedIn() && request.auth.token.get('superAdmin', false) == true;
}
```

Gate `match /system/runtimeConfig` (or wherever the config doc lives) to `allow read, write: if
isSuperAdmin();` — consistent with the org-scoped rules' `isOrgEditor(orgId)` pattern, just claim-based
instead of `exists()`-based (this doc has no natural per-org membership to check against, and rules'
`request.auth.token.X` reads are the ones that work reliably — unlike the Storage-rules
`firestore.exists()` cross-service call already documented as permanently broken in `CLAUDE.md`, a
**Firestore rule reading its own request's `auth.token` claim has no such limitation**; that pitfall is
specific to Storage rules calling out to Firestore, not to Firestore rules reading the token).

## Q3 — Admin UI

**Answer: the existing Vue 3 + Pinia + Tailwind v4 stack fully covers this. Add nothing.**

- **Forms/validation:** this app has never used a validation library anywhere — `SettingsView.vue`'s
  numeric-knob editing (`reminderDaysBeforeInput`, line ~1245-1252) is a plain `ref` + `Number(...)` cast +
  manual bounds check + revert-on-invalid, no `zod`/`vee-validate`/`yup`/`vuelidate` (confirmed: none of
  these appear anywhere in `package.json` or the codebase). The new admin console's knobs (booleans,
  small integers, one email-ish string) are simpler than that existing screen — reuse its exact pattern:
  local `ref`, cast/guard on save, `updateDoc`/`setDoc` straight to Firestore. Introducing a schema
  validation library for ~15 fields on one admin-only screen would be the first validation library in a
  12.7K-LOC app and inconsistent with every other settings surface (org Settings, messaging config,
  slide typography) already shipped without one.
- **Live sync:** reuse the `onSnapshot` in a Pinia store pattern already established
  (`memberUnsub`/`onSnapshot` in `src/stores/auth.ts:268`) for a new `useAdminConfigStore` (or similar)
  that subscribes to `system/runtimeConfig` — the same shape as every other real-time store in this app.
  VueFire is correctly still out of scope (already rejected app-wide: "VueFire composables don't work
  inside Pinia stores" — Key Decisions table, `PROJECT.md`).
- **Access gate at the route level:** `vue-router` (already `^5.0.3`) navigation guard checking
  `authStore`'s exposed `superAdmin` computed (sourced from the decoded ID token claim, same shape as the
  existing `isEditor` computed at `src/stores/auth.ts:74`) — no new router capability needed.
- **Deletion-toggle safety UI (dry-run count before flip):** no new library — this is a callable-Function
  round trip (`onCall`, already the established pattern for every admin-adjacent action in this codebase)
  that runs the existing cleanup handler's dry-run branch and returns the count synchronously, then a
  confirm step in the UI before the actual `updateDoc` that flips the enable flag. Plain Tailwind
  modal/confirm markup, matching existing modal patterns already in the app (no headless-ui/radix needed —
  none is currently installed and none should be added for one confirm dialog).

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Module-scope TTL cache (plain object) | `node-cache` / `lru-cache` | If the config surface grows to many independently-keyed, independently-expiring documents — not the case for one global config doc |
| Firestore config doc | Firebase Remote Config | If this were a client-facing feature-flag/A-B-test surface needing percentage rollouts, condition targeting, or non-technical marketing-team editing via the Firebase Console UI — not this milestone's shape (owner-only, structured operational knobs, already-Firestore-native app) |
| Custom auth claim (`superAdmin`) | A Firestore `system/admins/{uid}` allowlist doc checked via `exists()` in rules + re-fetched in Functions | If super-admin membership needed to change without any token-refresh propagation delay, or needed to be queryable/listable server-side trivially. Rejected because the milestone explicitly asks to build on the v1.5 custom-claims work, and claims are already the trusted signal `storage.rules` depends on cross-service — a second admin-membership mechanism would fork the pattern this codebase just standardized on |
| Read-merge-write for every claim writer | Two independent claim namespaces via separate Firebase Auth tenants/providers | Massive overkill — a single Firebase project, single Auth instance app; multi-tenant Auth is not warranted for an internal admin flag |
| Plain manual form validation | `zod` (4.4.3 latest) | If server-side (Functions) input validation on a public-facing `onCall`/`onRequest` endpoint becomes warranted — worth it for un-trusted client input, not for an owner-only admin screen editing ~15 known fields. If added later, scope it to Functions-side validation of the config doc shape, not client form validation |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `node-cache` / `lru-cache` for config caching | Caches one document; a library adds API surface + a dependency for a 6-line problem | Module-scope `{ value, fetchedAt }` object + TTL check (Pattern 1 above) |
| Firebase Remote Config for this config surface | Second config system alongside Firestore, flat key-value model fights the structured knob groups, separate SDK/caching/propagation model, separate admin-editing surface (Console or REST) instead of reusing `onSnapshot`/`updateDoc` | Firestore doc, gated by the new `isSuperAdmin()` rule |
| `onDocumentWritten` as the cache-invalidation mechanism | Cannot reach other warm gen2 instances' memory — false sense of "live propagation," adds complexity without closing the actual staleness window | TTL-based re-read (60s), which already bounds staleness correctly and requires no trigger at all |
| `setCustomUserClaims(uid, { superAdmin: true })` written blind, without reading existing claims first | Silently replaces (not merges) the whole claims object — will wipe the `{orgId, role}` claim `storage.rules` and `firestore.rules` already depend on, the instant it runs | Read-merge-write: `getAuth().getUser(uid)` → merge → `setCustomUserClaims(uid, mergedClaims)`, in BOTH the new grant path and the existing `syncOrgMembershipClaimHandler` |
| A new validation library (`zod`, `vee-validate`, `yup`, `vuelidate`) for the admin form | Zero precedent anywhere in this 12.7K-LOC app; every existing settings screen validates inline with plain casts/guards | Match `SettingsView.vue`'s existing `Number(...)` + guard + revert-on-invalid pattern |
| A deployed `onCall` "grant super-admin" Function as the ONLY way to create the first super-admin | Chicken-and-egg: a caller-must-already-be-super-admin gate can never grant the first one | A one-off Node script under `functions/src/`, dry-run-by-default, `--apply` to write, excluded from `index.ts`'s exports — exact shape of the existing `backfillOrgClaims.ts` |
| Bumping `firebase-admin` to v14.x as part of this milestone | No capability this milestone needs is v14-only; it's an unrelated major-version risk bundled into an otherwise low-risk milestone | Stay on the installed `^13.10.0` range |

## Stack Patterns by Variant

**If the config surface later grows beyond one global doc (e.g., per-org overrides of some knobs):**
- Move from a single `system/runtimeConfig` doc to `system/runtimeConfig` (global defaults) +
  `organizations/{orgId}/runtimeConfigOverrides` (sparse, only overridden keys), with `getRuntimeConfig`
  taking an optional `orgId` and merging global defaults under org overrides.
- At that point, revisit whether a real cache library earns its keep (now genuinely multi-key with
  per-org TTLs) — still likely not, since it would be N+1 documents keyed by org, each independently
  small, and a `Map<orgId, {value, fetchedAt}>` is still just as simple as today's single-value cache.

**If cold-start latency on the highest-traffic function (`api`) becomes a measured problem because of the
added `getRuntimeConfig()` await on every cold start:**
- Not expected at this app's scale, but if it materializes, prefetch the config doc in a
  `functions.https.onInit()` hook (per the official Tips & Tricks guidance already fetched this session)
  rather than lazily on first request — keeps the TTL-cache design, just moves the very first fetch earlier
  in the instance lifecycle.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `firebase-admin@^13.10.0` | `firebase-functions@^7.2.5`, Node 22 (`functions/package.json` engines pin) | Already the running production combination; no change needed for any of Q1–Q3 |
| `firebase@^12.0.0` (client) | Vue `^3.5.29`, Pinia `^3.0.4` | Already the running combination; `onSnapshot`/`updateDoc` for the new admin config store need nothing beyond what every other store already imports |
| Custom claims (`request.auth.token.*`) | `firestore.rules` `rules_version = '2'` | Already proven in this file's `isOrgEditor`/`isOrgMember` helpers reading `request.auth.token.email`; a new `isSuperAdmin()` helper reading `request.auth.token.superAdmin` needs no rules-version change |

## Sources

- Direct read of `functions/package.json`, `package.json`, `functions/src/index.ts`,
  `functions/src/orgMembershipClaims.ts`, `functions/src/backfillOrgClaims.ts`, `src/stores/auth.ts`,
  `firestore.rules`, `src/views/SettingsView.vue` (this session) — installed versions, existing env-read
  sites, existing claim-write call sites, existing rules helpers, existing form-validation style.
  Confidence: HIGH (ground truth, not recalled).
- `npm view <pkg> version` against the public npm registry (this session, 2026-08-20) for
  `firebase-admin` (14.3.0), `firebase-functions` (7.3.2), `firebase` (12.18.0), `resend` (6.20.0),
  `zod` (4.4.3), `node-cache` (5.1.2), `lru-cache` (11.5.2), `firebase-functions-test` (3.5.0).
  Confidence: HIGH (live registry query).
- [Tips & tricks — Cloud Functions for Firebase](https://firebase.google.com/docs/functions/tips) —
  official guidance on global-scope caching across warm invocations and `onInit()` for deferred
  expensive initialization; confirms the module-scope-TTL pattern and its cross-instance limitation.
  Confidence: HIGH (official docs, fetched this session).
- [Extend Cloud Firestore with Cloud Functions (2nd gen) — Firebase](https://firebase.google.com/docs/firestore/extend-with-functions-2nd-gen) —
  confirms gen2 `onDocumentWritten` trigger shape (already matches this codebase's own usage in
  `syncOrgMembershipClaim`). Confidence: HIGH (official docs).
- [Firebase Remote Config](https://firebase.google.com/docs/remote-config) — reviewed to make the
  explicit reject-and-explain-why call against it as the config mechanism. Confidence: HIGH (official
  docs).
- `.planning/milestones/v1.5-phases/40-custom-auth-claim-for-org-membership/40-RESEARCH.md` (this
  project's own prior research) — reused its already-verified `setCustomUserClaims` signature
  (`base-auth.d.ts:300`, `object | null`), 1000-byte claims limit, and "claims are Admin-SDK-only, never
  client-writable" framing rather than re-deriving them. Confidence: HIGH (prior in-repo verified
  research, cross-checked against current npm registry state this session).

---
*Stack research for: v1.9 Owner Admin Console — Firestore runtime config, super-admin claim gate, admin UI*
*Researched: 2026-08-20*
