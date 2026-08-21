# Phase 68: Super-Admin Access Gate & Claim-Merge Fix - Research

**Researched:** 2026-08-20
**Domain:** Firebase custom-claims auth gate + claim-merge correctness + Firestore rules, on a live production Vue 3/Firebase app
**Confidence:** HIGH (codebase-derived findings, direct source reads); MEDIUM (token-revocation platform semantics, cited from official docs but not yet exercised in this repo)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Claim model & the merge-safety fix (R174, R175)**
- `superAdmins/{uid}` is the source of truth; document existence = granted. Fields: `{ email, grantedBy,
  grantedAt }` (email for display/audit; grantedBy = granting super-admin's uid).
- The claim is an additive boolean `superAdmin: true` on the SAME custom-claims object that already carries
  `{ orgId, role }` — never a separate replace.
- **One shared `mergeAndSetCustomClaims(uid, patch)` helper** (new `functions/src/claimsHelpers.ts`): reads
  current claims via `getAuth().getUser(uid)`, shallow-merges the patch, writes back. BOTH the new
  `syncSuperAdminClaim` trigger AND the existing `syncOrgMembershipClaimHandler` in
  `orgMembershipClaims.ts` MUST route through it. This is a REQUIRED fix in THIS phase, not later hardening —
  today's blind `setCustomUserClaims({orgId, role})` would wipe `superAdmin` on the next membership write.
- **Claim survival:** when a user's LAST org membership is removed, the org-sync clear-path must clear only
  the `{ orgId, role }` keys and PRESERVE `superAdmin` (a super-admin need not belong to any org). Likewise a
  super-admin revoke clears only `superAdmin` and preserves `{ orgId, role }`. (Resolves SUMMARY.md open Q.)
- Regression coverage: a test proving org-membership churn does not strip `superAdmin`, and vice versa
  (SC1, both directions).

**Grant / revoke mechanism & propagation (R176, R179)**
- **Bootstrap (first super-admin):** an owner-run Node script mirroring `functions/src/backfillOrgClaims.ts`
  — dry-run by default, `--apply`-gated, resolves the target by email→uid, writes `superAdmins/{uid}`.
  EXCLUDED from `functions/src/index.ts` deployed exports (it's a script, not a Function). No pre-existing
  super-admin required (chicken-and-egg). Owner runs it; hand over the exact command.
- **In-console grant/revoke:** a `setSuperAdminClaim` `onCall` guarded so the CALLER must already be a
  super-admin (server-side re-check of the caller's claim/`superAdmins/{callerUid}`); it writes or deletes
  `superAdmins/{targetUid}` (target resolved by email). A `syncSuperAdminClaim` `onDocumentWritten` trigger
  over `superAdmins/{uid}` then sets/clears the claim via the merge helper — mirroring `syncOrgMembershipClaim`.
- **Propagation:** a grant takes effect on the target's next ID-token refresh (`getIdTokenResult(user, true)`
  on next app load / hourly auto-refresh) — same model v1.5 already uses for org claims. A REVOKE also calls
  `revokeRefreshTokens(uid)` so existing sessions are force-expired at their next check (SC5 "loses access on
  next token refresh"). No real-time push channel in v1.
- The current signed-in super-admin who just granted themselves via the bootstrap must force a token refresh
  (reuse the existing `loadOrgContext` `getIdTokenResult(user, true)` path) to see `superAdmin`.

**Client gate & route (R177)**
- Route path **`/owner-console`**, title **"Owner Console"** — deliberately NOT `/admins` (owned by the
  per-org `TeamView.vue`). Distinct nav entry, rendered only when `authStore.isSuperAdmin`.
- `isSuperAdmin` is a computed/ref in the auth store, read from the decoded `getIdTokenResult` claims
  (alongside the existing org-claim read) — no extra Firestore round-trip.
- Router guard `meta.requiresSuperAdmin`; a non-super-admin hitting the route is redirected client-side to
  the app home. (Client gate is convenience; the REAL enforcement is the Firestore rules below + the onCall
  caller re-check — never trust the client gate alone.)
- **Phase-68 UI is intentionally minimal:** the route + shell + a super-admin roster panel (list current
  super-admins, grant by email, revoke). The config-editor panels are Phase 70 — keep the shell easy to
  extend (a slot/section layout Phase 70 fills in), but do not build config editing here.

**Rules & rules-testing discipline (R178)**
- New rules helper `isSuperAdmin()` = **claim-only**: `request.auth != null && request.auth.token.superAdmin
  == true`. NO cross-document `get()`/`exists()` (cheaper, and avoids the exact fragility class behind the
  CLAUDE.md `storage.rules` deny-everyone incident + the Storage-emulator `firestore.exists()`-inert trap).
- `appConfig/{doc}` and `superAdmins/{uid}`: read AND write allowed only when `isSuperAdmin()`. (Cloud
  Functions use the Admin SDK, which bypasses rules — so the trigger/onCall still work.)
- Naming-collision guard: the existing rules normalize `role: "admin" → "editor"`; the new `superAdmin`
  claim must not collide with or be confused for that per-org role.
- **Genuine ALLOW + DENY emulator tests** for both collections (a real super-admin token allowed to
  write `appConfig/global` and `superAdmins/*`; a non-super-admin and an ordinary org editor denied) — per
  CLAUDE.md's rules-first discipline (a deny-only suite is what let a deny-everyone rule ship once).

**Deploy discipline (v1.9 grant)**
- Everything ships **built + tested + UNDEPLOYED**. The `firestore.rules` change, the `syncSuperAdminClaim`
  trigger, the `setSuperAdminClaim` onCall, and the bootstrap script are ALL owner-run/owner-deployed — this
  is auth + rules, squarely in the hand-over category. Hand over the exact `firebase deploy --only
  firestore:rules` / `firebase deploy --only functions:syncSuperAdminClaim,functions:setSuperAdminClaim`
  commands + the bootstrap invocation. No `.env.local` / `functions/.env` writes.

### Claude's Discretion
- Exact file/module names (`claimsHelpers.ts`, `superAdminClaims.ts`, `bootstrapSuperAdmin.ts`), the console
  shell component name (e.g. `OwnerConsoleView.vue`), and the roster panel's exact markup — follow existing
  codebase conventions (`orgMembershipClaims.ts`, `backfillOrgClaims.ts`, `SettingsView.vue`, `TeamView.vue`,
  `router/index.ts`, `AppSidebar.vue`).
- The `superAdmins/{uid}` field set beyond the three named above, if the roster UI needs more for display.

### Deferred Ideas (OUT OF SCOPE)
- Config-editor panels + effective-value/provenance display → Phase 70.
- No-reply sender configuration → Phase 70.
- The `appConfig/global` managed values + Cloud Functions reading config at runtime → Phase 69.
- Cleanup dry-run blast-radius preview + confirm-to-flip flow → Phase 71.
- Full multi-admin management UI (bulk roster, grant audit history) → deferred beyond v1.9 (REQUIREMENTS.md
  Future). This phase's roster is intentionally minimal (grant/revoke one user).
- **Owner infra check (flag at hand-off, not this phase's code):** confirm Cloud Storage Object Versioning /
  bucket retention is enabled as a safety net BEFORE Phase 71's live deletion toggles ship.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R174 | Grant reflected as `superAdmin: true` custom claim via `superAdmins/{uid}` record | §2 claim model + `syncSuperAdminClaim` design (Code Examples §2) |
| R175 | One shared merge-and-set helper closes the claim-wipe gap, both directions | §1 the exact bug quoted from `orgMembershipClaims.ts:188/191`, `claimsHelpers.ts` design (Code Examples §1) |
| R176 | Owner-run dry-run/`--apply` bootstrap script, no pre-existing super-admin required | §3, mirrors `backfillOrgClaims.ts` (read in full) — Code Examples §5 |
| R177 | Gated route `/owner-console`, distinctly named, client-side redirect | §4 client wiring, mirrors `router/index.ts`'s `requiresEditor` guard shape |
| R178 | Claim-only `isSuperAdmin()` rules for `appConfig/*` + `superAdmins/*`, genuine ALLOW+DENY tests | §5 rules design + Validation Architecture (rules test map) |
| R179 | Grant/revoke another user from console; revoke effective on next token refresh | §3 `setSuperAdminClaim` onCall + token-revocation research (§6) |
</phase_requirements>

## Summary

This phase's shape is already fully fixed by 68-CONTEXT.md — the job here is to ground every piece in the
actual, currently-deployed code so the plan can write exact diffs, not descriptions. Two files carry the
load-bearing risk: `functions/src/orgMembershipClaims.ts:188` (`await getAuth().setCustomUserClaims(uid,
decision.claims)`) and `:191` (`await getAuth().setCustomUserClaims(uid, null)`) are the two blind writes
that will silently strip a future `superAdmin` claim the moment any org-membership document is next
touched — and `:191`'s `null` argument is the more dangerous of the two, because it clears the ENTIRE custom
claims object, not just `{orgId, role}`. Both call sites must be rewritten to route through a new
`functions/src/claimsHelpers.ts` that reads current claims via `getAuth().getUser(uid)`, merges/clears only
the caller's named keys, and writes back — mirroring the read-before-write pattern `decideMembershipClaim`
already uses to check idempotency (`orgMembershipClaims.ts:138-142`), just applied to the write path instead
of only the decision path.

The new `superAdminClaims.ts` mirrors `orgMembershipClaims.ts`'s trigger-sync shape byte-for-byte
(`onDocumentWritten` over a top-level collection, a testable handler exported separately from the wrapper,
try/catch-not-rethrow so a Firestore trigger failure never becomes an Auth-API-hammering retry loop) and
`setSuperAdminClaim` mirrors `queueServiceMessageHandler`'s `onCall` shape (`CallableRequest<T>`, `HttpsError`
for every rejection branch, an independent server-side re-check of the caller's authority that never trusts
the client-declared value alone). The bootstrap script mirrors `backfillOrgClaims.ts` — dry-run-default,
`--apply`-gated, a CLI wrapper guarded by `require.main === module` so importing the module for tests never
touches a live project — with one twist this phase must decide explicitly: the very first grant cannot rely
on the deployed `syncSuperAdminClaim` trigger having already run (deploy-ordering risk), so the recommended
design has the bootstrap script call `mergeAndSetCustomClaims` directly in addition to writing the
`superAdmins/{uid}` doc, exactly as `backfillOrgClaims.ts` calls `decideMembershipClaim`/`setCustomUserClaims`
directly rather than waiting on the trigger.

The Firestore rule is the simplest piece and the one this repo has the strongest documented incentive to get
right the safe way: `isSuperAdmin()` reads `request.auth.token.superAdmin == true` directly off the token,
with zero `get()`/`exists()` calls — deliberately avoiding the exact rule shape (`isOrgEditor`'s cross-document
`get()`, and worse, `storage.rules`' now-fixed cross-service `firestore.exists()`) that produced this
project's own documented deny-everyone production incident (CLAUDE.md, 2026-08-06). `src/rules.test.ts`
already has the exact API needed to construct a genuinely-super-admin auth context —
`testEnv.authenticatedContext(uid, { email: '...' })`'s second argument is the token's claim bag, already
exercised in this file for `email`; the identical call shape with `{ superAdmin: true }` produces
`request.auth.token.superAdmin === true` inside the rule, with no new test infrastructure required.

**Primary recommendation:** Implement `claimsHelpers.ts` first (it's the correctness fix that must exist
before the new claim type does), refactor `orgMembershipClaims.ts`'s two write call sites onto it with unit
tests proving both directions of claim survival, then build `superAdminClaims.ts` + rules + bootstrap script +
client wiring in that order — each step independently testable, matching the dependency order ARCHITECTURE.md
and PITFALLS.md both independently converged on.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Claim merge correctness (`mergeAndSetCustomClaims`) | API / Backend (Cloud Functions, Admin SDK) | — | Only the Admin SDK can read/write custom claims; must be shared by both claim writers to prevent drift |
| Super-admin grant/revoke record (`superAdmins/{uid}`) | Database / Storage (Firestore) | API / Backend (trigger) | Source-of-truth doc; the Firestore write is the event that drives the claim sync trigger |
| Claim sync (`syncSuperAdminClaim`) | API / Backend (Cloud Functions, `onDocumentWritten`) | — | Mirrors `syncOrgMembershipClaim`; Admin-SDK-only, bypasses rules by design |
| Grant/revoke action (`setSuperAdminClaim`) | API / Backend (Cloud Functions, `onCall`) | — | Privileged cross-user write; must independently re-verify caller authority server-side, never trust the client |
| Bootstrap (first super-admin) | API / Backend (one-off Node script, NOT deployed) | — | Chicken-and-egg — cannot go through the onCall gate before any super-admin exists; owner-run locally |
| Route gate (`/owner-console`, `requiresSuperAdmin`) | Frontend Server / Client (Vue Router guard) | — | UX convenience only — hides the route, does NOT enforce access (Pitfall 8) |
| `isSuperAdmin` claim surfacing | Browser / Client (Pinia `auth.ts` store) | — | Reads the already-fetched `getIdTokenResult` claims; no extra round-trip |
| `appConfig/*` and `superAdmins/*` rules enforcement | Database / Storage (`firestore.rules`) | — | The REAL security boundary — gates direct client-SDK reads/writes independent of the UI/route |
| Roster panel (list/grant/revoke UI) | Browser / Client (new Vue component + Pinia store) | API / Backend (`setSuperAdminClaim` onCall) | Minimal UI reusing `TeamView.vue`'s form patterns; calls the onCall for privileged writes |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | `^13.10.0` (installed, verified `functions/package.json`) | `getAuth().getUser/setCustomUserClaims/revokeRefreshTokens`, `getFirestore()` | Already the only Auth/Firestore touchpoint in Functions; no version bump needed |
| `firebase-functions` | `^7.2.5` (installed) | `onDocumentWritten`, `onCall`, `HttpsError` | Already used identically by `syncOrgMembershipClaim`/`queueServiceMessage` |
| `firebase` (client SDK) | `^12.0.0` (installed, root `package.json`) | `getIdTokenResult(user, true)`, `onSnapshot` | Already the sole client Firebase SDK; `auth.ts` already calls `getIdTokenResult` |
| `vue-router` | `^5.0.3` (installed) | `RouteMeta`, `beforeEach` guard | Already the sole router; `requiresEditor` is the direct template for `requiresSuperAdmin` |

No new runtime dependency is required. `[VERIFIED: functions/package.json, package.json — read directly this session]`.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@firebase/rules-unit-testing` | already a devDependency (used by `src/rules.test.ts`) | `authenticatedContext(uid, tokenClaims)` | Rules ALLOW/DENY tests for `appConfig`/`superAdmins` |
| `vitest` | `^4.1.10` (functions) / `^4.0.18` (root) | Unit tests for `claimsHelpers`/`superAdminClaims`/bootstrap script | Matches existing `orgMembershipClaims.test.ts`/`backfillOrgClaims.test.ts` mocking pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claim-only `isSuperAdmin()` rule | A Firestore-doc-lookup rule (`get(/databases/.../superAdmins/$(uid))`) | Rejected — strictly more expensive (extra billed read) AND reintroduces the cross-document-check fragility class that produced this repo's documented `storage.rules` incident. Locked decision (CONTEXT.md), not open. |
| Shared `mergeAndSetCustomClaims` | Two independent read-merge-write implementations, one per claim writer | Rejected — exactly the drift risk `decideMembershipClaim`'s own doc comment already warns against ("A second implementation... could drift from the trigger"); one helper, two callers, per CONTEXT.md decision |
| Force-refresh via listened Firestore doc (real-time push) | Passive: user reloads/re-logs-in to see a grant | CONTEXT.md explicitly defers real-time push to a later version ("No real-time push channel in v1") — Phase 68 relies on the existing bounded-retry `loadOrgContext` pattern, applied at the `/owner-console` route guard |

**Installation:** None — zero new packages.

**Version verification:** All four core libraries confirmed installed via direct read of `functions/package.json` and root `package.json` this session — no `npm view` registry call needed since nothing new is being added. `[VERIFIED: functions/package.json, package.json]`

## Package Legitimacy Audit

**No external packages are installed by this phase.** Every capability (custom claims, Firestore
triggers/onCall, rules-unit-testing, client `getIdTokenResult`) is already provided by dependencies already
present in `functions/package.json` and the root `package.json`, verified by direct file read this session.
The Package Legitimacy Gate protocol therefore does not apply — there is no `npm install` step in this
phase's plan.

**Packages removed due to [SLOP] verdict:** none (no packages introduced).
**Packages flagged as suspicious [SUS]:** none (no packages introduced).

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Browser / Client (Vue 3 + Pinia)                                          │
│                                                                            │
│  auth.ts store            router/index.ts           AppSidebar.vue        │
│  +isSuperAdmin ref    ───► +requiresSuperAdmin  ───► +"Owner Console"      │
│  reads getIdTokenResult    guard: force-refresh       nav entry, gated on │
│  .claims.superAdmin        then redirect if false     authStore.isSuperAdmin│
│         │                                                                  │
│         ▼                                                                  │
│  OwnerConsoleView.vue (new, minimal shell)                                │
│  └─ roster panel: list superAdmins, grant-by-email, revoke                │
│         │ calls setSuperAdminClaim(onCall)   │ onSnapshot(superAdmins)    │
└─────────┼─────────────────────────────────────┼───────────────────────────┘
          │ verified ID token (Admin SDK checks) │ direct read, rules-gated
          ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Cloud Functions (Admin SDK — bypasses rules entirely)                     │
│                                                                            │
│  setSuperAdminClaim (onCall)                                              │
│   1. request.auth.token.superAdmin === true?  else HttpsError             │
│   2. re-read superAdmins/{callerUid} exists?  else HttpsError (defense-   │
│      in-depth: claim could theoretically be stale/forged pre-revoke)      │
│   3. resolve targetEmail -> uid via getAuth().getUserByEmail()            │
│   4. grant: superAdmins/{targetUid}.set({email, grantedBy, grantedAt})    │
│      revoke: superAdmins/{targetUid}.delete()                             │
│                    │ Firestore write triggers ▼                           │
│                                                                            │
│  syncSuperAdminClaim (onDocumentWritten superAdmins/{uid})                │
│   doc exists after write?                                                 │
│     yes -> mergeAndSetCustomClaims(uid, { superAdmin: true })             │
│     no  -> clearClaimKeys(uid, ['superAdmin'])                            │
│            + on revoke path, caller also calls revokeRefreshTokens(uid)   │
│                    │ shared merge/clear logic ▼                           │
│                                                                            │
│  claimsHelpers.ts                                                         │
│   mergeAndSetCustomClaims(uid, patch)   — read current, shallow-merge,    │
│   clearClaimKeys(uid, keys)             — read current, delete named keys,│
│                                            write back (or null if empty)  │
│                    ▲ same helper, also used by:                          │
│                                                                            │
│  syncOrgMembershipClaim (onDocumentWritten organizations/{orgId}/         │
│  members/{uid}) — MODIFIED: routes its 'set' and 'clear' branches         │
│  through claimsHelpers instead of calling setCustomUserClaims directly    │
└──────────────────────────────────────────────────────────────────────────┘
          ▲ owner-run once, locally, before any onCall grant can happen
┌──────────────────────────────────────────────────────────────────────────┐
│ bootstrapSuperAdmin.ts (Node script, NOT deployed, NOT in index.ts)       │
│  dry-run default; --apply writes superAdmins/{uid} + calls                │
│  mergeAndSetCustomClaims directly (does not depend on the trigger having  │
│  already been deployed — see Pitfall 10 / bootstrap ordering below)      │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Firestore (rules-gated for client SDK access; Admin SDK bypasses always) │
│  appConfig/{doc}     — isSuperAdmin() only, read+write (RULES ONLY this  │
│                         phase — no doc contents written, that's Phase 69)│
│  superAdmins/{uid}   — isSuperAdmin() only, read+write                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
functions/src/
├── claimsHelpers.ts          # NEW — mergeAndSetCustomClaims, clearClaimKeys
├── orgMembershipClaims.ts    # MODIFIED — set/clear branches route through claimsHelpers
├── superAdminClaims.ts       # NEW — decideSuperAdminClaim (if needed), syncSuperAdminClaimHandler
│                              #        + syncSuperAdminClaim trigger, setSuperAdminClaimHandler
│                              #        + setSuperAdminClaim onCall
├── bootstrapSuperAdmin.ts    # NEW — owner-run CLI script, mirrors backfillOrgClaims.ts
│                              #        NOT exported from index.ts
├── index.ts                  # MODIFIED — export syncSuperAdminClaim, setSuperAdminClaim
└── DEPLOY-SUPER-ADMIN.md     # NEW — owner-handoff runbook, mirrors DEPLOY-ORG-CLAIMS.md

src/
├── stores/auth.ts            # MODIFIED — isSuperAdmin ref
├── router/index.ts           # MODIFIED — requiresSuperAdmin meta + owner-console route + guard branch
├── components/AppSidebar.vue # MODIFIED — gated "Owner Console" nav entry
├── views/OwnerConsoleView.vue# NEW — console shell + roster panel
└── stores/admin.ts           # NEW (or folded into a small local composable) — onSnapshot(superAdmins),
                               #     calls setSuperAdminClaim

firestore.rules               # MODIFIED — isSuperAdmin() helper + appConfig/* + superAdmins/* blocks
src/rules.test.ts             # MODIFIED — new describe blocks, genuine ALLOW + DENY for both collections
```

### Pattern 1: Shared read-merge-write claim helper
**What:** A single function both claim writers call, never a direct `setCustomUserClaims`.
**When to use:** Every future custom-claim writer this app ever adds must route through it — not just this
phase's two.
**Example:**
```typescript
// functions/src/claimsHelpers.ts (NEW)
// Source: mirrors the read-then-decide pattern already in orgMembershipClaims.ts's
// decideMembershipClaim (lines 138-142: `getAuth().getUser(uid)` then compare), applied
// to the WRITE path instead of only the idempotency check.
import { getAuth } from "firebase-admin/auth";

/**
 * Reads the user's CURRENT custom claims, shallow-merges `patch` on top, and writes the
 * result back. This is the single fix for the hazard documented in orgMembershipClaims.ts:
 * a bare `setCustomUserClaims(uid, {orgId, role})` REPLACES the whole claims object and
 * would silently strip `superAdmin` (or any other future claim) the next time it runs.
 */
export async function mergeAndSetCustomClaims(
  uid: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = (user.customClaims as Record<string, unknown> | undefined) ?? {};
  await getAuth().setCustomUserClaims(uid, { ...current, ...patch });
}

/**
 * The counterpart to mergeAndSetCustomClaims for a SCOPED clear: removes only the named
 * keys, preserving every other claim. This is what fixes orgMembershipClaims.ts:191's
 * `setCustomUserClaims(uid, null)` — that call wipes the ENTIRE claims object (not just
 * {orgId, role}), which would strip `superAdmin` off a super-admin whose last org
 * membership is removed. Firebase's Admin SDK requires `null` (not `{}`) to fully clear
 * claims, so this only passes `null` when nothing remains after the delete.
 */
export async function clearClaimKeys(uid: string, keys: readonly string[]): Promise<void> {
  const user = await getAuth().getUser(uid);
  const current = { ...((user.customClaims as Record<string, unknown> | undefined) ?? {}) };
  for (const key of keys) delete current[key];
  const hasRemaining = Object.keys(current).length > 0;
  await getAuth().setCustomUserClaims(uid, hasRemaining ? current : null);
}
```

### Pattern 2: The two exact call sites this phase MUST change
**What:** `orgMembershipClaims.ts`'s existing blind writes, quoted verbatim from the file read this session.
**When to use:** This is not optional refactoring — R175 requires exactly this fix, in this phase.
```typescript
// functions/src/orgMembershipClaims.ts — CURRENT (the bug), lines 186-192:
switch (decision.action) {
  case "set":
    await getAuth().setCustomUserClaims(uid, decision.claims);   // <-- REPLACES whole object
    return { action: "set" };
  case "clear":
    await getAuth().setCustomUserClaims(uid, null);               // <-- WIPES superAdmin too
    return { action: "clear" };
  case "skip":
    return { action: "skip", reason: decision.reason };
}

// MODIFIED — routes through the shared helper, imports ORG_CLAIM_KEYS (already exported,
// line 20: `export const ORG_CLAIM_KEYS = ["orgId", "role"] as const;`) to scope the clear:
switch (decision.action) {
  case "set":
    await mergeAndSetCustomClaims(uid, decision.claims);
    return { action: "set" };
  case "clear":
    await clearClaimKeys(uid, ORG_CLAIM_KEYS);
    return { action: "clear" };
  case "skip":
    return { action: "skip", reason: decision.reason };
}
```

### Pattern 3: `syncSuperAdminClaim` — mirrors `syncOrgMembershipClaim` exactly
**What:** Trigger over the new `superAdmins/{uid}` collection, testable handler separated from the wrapper.
**Example:**
```typescript
// functions/src/superAdminClaims.ts (NEW)
// Source: mirrors functions/src/orgMembershipClaims.ts's syncOrgMembershipClaimHandler /
// syncOrgMembershipClaim split (handler exported separately so tests call it directly with
// a fake event, wrapper is the deployed onDocumentWritten).
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { mergeAndSetCustomClaims, clearClaimKeys } from "./claimsHelpers";

export const SUPER_ADMIN_CLAIM_KEYS = ["superAdmin"] as const;

export type SyncSuperAdminClaimOutcome =
  | { action: "set" }
  | { action: "clear" }
  | { action: "failed"; error: string };

export async function syncSuperAdminClaimHandler(params: {
  uid: string;
  granted: boolean; // true when the superAdmins/{uid} doc exists AFTER this write
}): Promise<SyncSuperAdminClaimOutcome> {
  try {
    if (params.granted) {
      await mergeAndSetCustomClaims(params.uid, { superAdmin: true });
      return { action: "set" };
    }
    await clearClaimKeys(params.uid, SUPER_ADMIN_CLAIM_KEYS);
    return { action: "clear" };
  } catch (err) {
    // Never rethrow out of a Firestore trigger — mirrors orgMembershipClaims.ts's
    // documented rationale (T-40-08): a throw here causes Cloud Functions retries
    // that hammer the Auth API.
    console.error("[superAdminClaims] syncSuperAdminClaim:", err);
    return { action: "failed", error: String(err) };
  }
}

export const syncSuperAdminClaim = onDocumentWritten(
  "superAdmins/{uid}",
  async (event) => {
    await syncSuperAdminClaimHandler({
      uid: event.params.uid,
      granted: event.data?.after.exists === true,
    });
  },
);
```

### Pattern 4: `setSuperAdminClaim` onCall — mirrors `queueServiceMessageHandler`'s security contract
**What:** Caller re-check server-side, target resolved server-side, never a direct claim write from the
onCall itself (the trigger above is the sole claim writer for this concern — mirrors the existing
"source doc → trigger → claim" indirection).
**Example:**
```typescript
// functions/src/superAdminClaims.ts (continued)
// Source: mirrors queueServiceMessageHandler's contract (functions/src/index.ts:2337-2435):
// requires request.auth, independently re-verifies caller authority server-side (never
// trusts a client-declared "I am an admin" flag), validates input, and does exactly ONE
// well-defined write.
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export interface SetSuperAdminClaimRequest {
  targetEmail: string;
  grant: boolean; // true = grant, false = revoke
}

export async function setSuperAdminClaimHandler(
  request: CallableRequest<SetSuperAdminClaimRequest>,
): Promise<{ ok: true }> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  // Caller re-check: the token claim alone (fast, matches isSuperAdmin() in rules) PLUS
  // an independent Firestore re-read of superAdmins/{callerUid} (defense-in-depth per
  // CONTEXT.md — catches a stale-but-not-yet-expired token for a since-revoked caller,
  // narrowing but not eliminating the up-to-1-hour token-lifetime window; see §6 below).
  if (request.auth.token.superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }

  const { targetEmail, grant } = request.data ?? ({} as SetSuperAdminClaimRequest);
  if (!targetEmail) {
    throw new HttpsError("invalid-argument", "targetEmail is required.");
  }

  let targetUid: string;
  try {
    const targetUser = await getAuth().getUserByEmail(targetEmail);
    targetUid = targetUser.uid;
  } catch {
    throw new HttpsError("not-found", `No account found for ${targetEmail}.`);
  }

  const targetRef = getFirestore().collection("superAdmins").doc(targetUid);
  if (grant) {
    await targetRef.set({
      email: targetEmail,
      grantedBy: request.auth.uid,
      grantedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await targetRef.delete();
    // R179 — revoke must be effective immediately, not just on natural token expiry.
    // See §6: revokeRefreshTokens invalidates existing sessions; the caller's NEXT
    // verifyIdToken(idToken, /* checkRevoked */ true) call rejects the old token.
    await getAuth().revokeRefreshTokens(targetUid);
  }
  return { ok: true };
}

export const setSuperAdminClaim = onCall(setSuperAdminClaimHandler);
```

### Pattern 5: Client-side surfacing — extend `loadOrgContext`'s existing claim read
**What:** Read `superAdmin` off the SAME `getIdTokenResult` call `refreshOrgClaim` already makes — no
second token fetch.
**Example:**
```typescript
// src/stores/auth.ts — MODIFIED
// Source: refreshOrgClaim already calls getIdTokenResult(currentUser, true) at line 138
// and reads result.claims.orgId. Add a sibling ref updated from the same result object.
const isSuperAdmin = ref(false)

// Inside refreshOrgClaim's loop (or a small new function called once per session load,
// since a super-admin grant is rare/manual, not a "just joined" race — CONTEXT.md
// explicitly says an unconditional forced refresh on every load is unnecessary; force one
// specifically in the /owner-console route guard instead, mirrored on refreshOrgClaim's
// existing awaitClaim shape):
const result = await getIdTokenResult(currentUser, true)
isSuperAdmin.value = result.claims.superAdmin === true
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Merging custom claims | A per-call-site inline `{...current, ...patch}` at each of the (now three) write sites | One shared `mergeAndSetCustomClaims`/`clearClaimKeys` in `claimsHelpers.ts` | Exactly the drift risk `decideMembershipClaim`'s own comment warns against; CONTEXT.md locks this as one helper |
| Caller-authority re-check for a privileged onCall | Trusting `request.auth.token.superAdmin` alone | ALSO re-read `superAdmins/{callerUid}` from Firestore (defense-in-depth) | Mirrors this repo's own stated pattern ("never trust the caller-declared value alone, independently re-verify" — `orgMembershipClaims.ts` comment) |
| Session invalidation on revoke | A bespoke "logout the user" push mechanism | `getAuth().revokeRefreshTokens(uid)` + `checkRevoked: true` on the next server-side `verifyIdToken` | Standard Admin SDK primitive for exactly this; documented at `firebase.google.com/docs/auth/admin/manage-sessions` |
| Rules-side super-admin check | A `get()`/`exists()` Firestore doc lookup inside `firestore.rules` | Claim-only `request.auth.token.superAdmin == true` | This repo's own documented `storage.rules` deny-everyone incident is the direct cautionary precedent (CLAUDE.md) — cross-document/cross-service rule checks are the exact fragility class to avoid |
| Rules ALLOW-case test scaffolding | New test-environment setup | `testEnv.authenticatedContext(uid, { superAdmin: true })` — same API `src/rules.test.ts` already uses for `{ email: '...' }` | No new test infra; the claim-injection mechanism is already proven in this file |

**Key insight:** Every piece of this phase has a byte-for-byte precedent already living in this codebase
(`orgMembershipClaims.ts`, `backfillOrgClaims.ts`, `queueServiceMessageHandler`, `isOrgEditor`,
`authenticatedContext`). The risk in this phase is not "what pattern to invent" — it's "faithfully copy the
existing pattern's SAFETY properties, not just its call shape," specifically the read-before-write for claims
and the independent server-side re-check for the onCall.

## Common Pitfalls

### Pitfall 1: Fixing only ONE of the two blind writes in `orgMembershipClaims.ts`
**What goes wrong:** A plan that swaps the `'set'` branch (`decision.claims`) to `mergeAndSetCustomClaims`
but leaves the `'clear'` branch's `setCustomUserClaims(uid, null)` untouched still wipes `superAdmin` the
moment a user's last org membership is removed — `null` clears the WHOLE claims object regardless of what
patch shape the `set` branch now uses.
**Why it happens:** The `'set'` branch is the more visible/obvious fix (it's the one that "adds" a claim
merge); the `'clear'` branch looks like it's "supposed to" clear everything, so it's easy to leave alone.
**How to avoid:** Both branches must change — `'set'` → `mergeAndSetCustomClaims`, `'clear'` → `clearClaimKeys(uid, ORG_CLAIM_KEYS)`. Write the regression test for BOTH directions explicitly (SC1 in CONTEXT.md): grant super-admin, then remove the user's last org membership, assert `superAdmin` survives; and the reverse, grant org membership, then revoke super-admin, assert `{orgId, role}` survives.
**Warning signs:** A diff to `orgMembershipClaims.ts` that only touches line 188, not line 191.

### Pitfall 2: Naming the super-admin claim key/value in a way that collides with the existing `role` claim
**What goes wrong:** `orgMembershipClaims.ts` already normalizes a legacy `role: "admin"` to `"editor"`
(line 41). Reusing `"admin"` as any part of the super-admin claim's key or value invites exactly the
confusion `firestore.rules`' comment already warns about between "org admin" (doesn't really exist, means
editor) and "app super-admin" (this phase's much more powerful new thing).
**How to avoid:** `superAdmin: true` as its own top-level boolean claim key, never reusing `role`.
CONTEXT.md already locks this; verify it stays true in the actual diff.
**Warning signs:** Any code path checking `claims.role === 'admin'` as a proxy for super-admin status.

### Pitfall 3: Client-only route guard treated as the real security boundary
**What goes wrong:** `router/index.ts`'s `requiresSuperAdmin` guard makes the `/owner-console` route
invisible to non-admins but does nothing to stop a direct Firestore write to `appConfig`/`superAdmins` or a
direct call to `setSuperAdminClaim` from devtools.
**How to avoid:** The `firestore.rules` `isSuperAdmin()` block and `setSuperAdminClaimHandler`'s own
`request.auth.token.superAdmin !== true` check are the REAL boundary. Both must exist and be tested
independently of the UI — attempt an admin Firestore write/onCall call as a non-admin authenticated user
directly (not through the route) as part of verification.
**Warning signs:** A phase "done" with a working-looking UI but no rules-emulator ALLOW/DENY test and no
onCall permission-denied unit test.

### Pitfall 4: Token-refresh gap on grant — newly-granted admin sees "access denied"
**What goes wrong:** `getIdTokenResult` claims are baked into the ID token at mint time; a just-granted
super-admin's already-open session doesn't see `superAdmin: true` until it force-refreshes. CONTEXT.md
already resolves this (force refresh via the `/owner-console` route guard, reusing `loadOrgContext`'s
`getIdTokenResult(user, true)` pattern) — the pitfall is skipping this and leaving the newly-granted user
to discover the gap by trial and error.
**How to avoid:** The router guard's `requiresSuperAdmin` branch must force one `getIdTokenResult(user,
true)` before deciding to redirect, exactly mirroring `requiresEditor`'s existing `await
authStore.waitForRole()` shape but for the super-admin claim.
**Warning signs:** A UAT script that grants super-admin then immediately navigates without reloading, and
the redirect fires even though the grant succeeded.

### Pitfall 5: Revoke implemented as claim-clear only, with no `revokeRefreshTokens`
**What goes wrong:** `syncSuperAdminClaimHandler`'s clear branch removes the claim from FUTURE tokens, but
the target's CURRENT session (already holding a valid, unexpired ID token with `superAdmin: true` baked in)
keeps working for up to the token's remaining ~1-hour lifetime unless the session is explicitly revoked.
**How to avoid:** `setSuperAdminClaimHandler`'s revoke branch calls `getAuth().revokeRefreshTokens(targetUid)`
in addition to deleting the `superAdmins/{targetUid}` doc (Code Examples Pattern 4 above already does this).
Note the platform nuance from §6 below: `revokeRefreshTokens` alone does not invalidate an already-issued ID
token for reads that don't pass `checkRevoked: true` — this phase's own server-side checks (the onCall
re-check, `isSuperAdmin()` rules) read the TOKEN claim directly, which is unaffected by
`revokeRefreshTokens` until that specific token expires or is checked with `checkRevoked`. Document this as
a residual, bounded (≤1hr) window in the phase's plan rather than silently treating revocation as
instantaneous everywhere.
**Warning signs:** A UAT that revokes then immediately re-tests with a FRESH token fetch (which would show
denial correctly) rather than testing against the OLD, still-valid token (which is the actual risk window).

### Pitfall 6: Bootstrap script assumes the trigger is already deployed
**What goes wrong:** If `bootstrapSuperAdmin.ts` only writes `superAdmins/{uid}` and relies on the deployed
`syncSuperAdminClaim` trigger to translate that into a claim, but the owner runs the bootstrap BEFORE (or in
the same breath as) deploying functions, the Firestore write happens with no live trigger to react to it —
the doc exists but the claim never lands, and the owner has no super-admin claim to bootstrap the console
with.
**How to avoid:** Either (a) sequence the owner-handoff runbook so functions+rules deploy strictly before
the bootstrap script runs (mirrors `DEPLOY-ORG-CLAIMS.md`'s Step 1-then-Step 2 ordering), AND/OR (b) have
the bootstrap script call `mergeAndSetCustomClaims` directly (not just write the doc), so the very first
grant does not depend on trigger-deployment timing at all — this is the recommended design (see Code
Examples Pattern 3 note, and the DEPLOY runbook below).
**Warning signs:** The owner reports "I ran the bootstrap script and it said success, but I still can't see
the console."

### Pitfall 7: `appConfig/*` rules written broader than "rules only, no content" scope
**What goes wrong:** This phase's rules for `appConfig/{docId}` are locked (CONTEXT.md: "This phase writes
the RULES for `appConfig/*` but not the doc's managed values"). A plan that also writes a starter
`appConfig/global` document, a `DEFAULT_APP_CONFIG` type, or wires any Cloud Function to read it would be
scope creep into Phase 69's territory and duplicate work when Phase 69 defines the actual schema.
**How to avoid:** The `firestore.rules` diff for `appConfig/{docId}` is exactly the same shape as
`superAdmins/{uid}` — a bare `isSuperAdmin()` gate, no schema validation (nothing to validate yet, since no
doc exists). Do not create `functions/src/appConfig.ts` in this phase.
**Warning signs:** A `functions/src/appConfig.ts` file or an `appConfig/global` Firestore write appearing in
this phase's diff.

## Code Examples

Additional verified patterns, beyond Architecture Patterns §1-5 above:

### Firestore rules — `isSuperAdmin()` + both new match blocks
```
// Source: mirrors this repo's existing isOrgMember/isOrgEditor placement (firestore.rules,
// top-level helper functions section) and the aiUsage/aiRateLimits top-level-collection
// deny-by-default precedent (firestore.rules:442-452) — appConfig/superAdmins get the SAME
// placement (top-level, not nested under organizations/{orgId}), but ALLOW instead of deny,
// gated on the new claim-only helper.
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
Both blocks land ABOVE the catch-all `match /{document=**} { allow read, write: if false; }`
(firestore.rules:455-457) — order does not matter for Firestore rules (all matching rules are evaluated,
any `allow` wins), but placing them near the other top-level Admin-SDK-adjacent collections
(`aiUsage`/`aiRateLimits`) keeps related concerns visually grouped, matching this file's existing
organization.

### Rules test — genuine ALLOW case (the one this repo's own incident history says not to skip)
```typescript
// src/rules.test.ts — NEW describe block
// Source: authenticatedContext(uid, tokenClaims) is the SAME API already used at line 162
// (`testEnv.authenticatedContext('attacker', { email: 'attacker@example.com' })`) — the
// second argument becomes additional custom claims on the constructed auth context's
// token, so { superAdmin: true } produces request.auth.token.superAdmin === true inside
// the rule, no new test-environment setup required.
describe('appConfig / superAdmins — claim-based isSuperAdmin() gate (R178)', () => {
  it('ALLOWS a genuine super-admin to write appConfig/global', async () => {
    const context = testEnv.authenticatedContext('ownerUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(setDoc(doc(db, 'appConfig', 'global'), { anything: true }))
  })

  it('ALLOWS a genuine super-admin to write superAdmins/{uid}', async () => {
    const context = testEnv.authenticatedContext('ownerUid', { superAdmin: true })
    const db = context.firestore()
    await assertSucceeds(
      setDoc(doc(db, 'superAdmins', 'targetUid'), {
        email: 'target@example.com',
        grantedBy: 'ownerUid',
        grantedAt: new Date(),
      }),
    )
  })

  it('DENIES a signed-in non-admin from reading appConfig/global', async () => {
    const context = testEnv.authenticatedContext('userA') // no superAdmin claim
    const db = context.firestore()
    await assertFails(getDoc(doc(db, 'appConfig', 'global')))
  })

  it('DENIES an ordinary org editor (orgId/role claim, no superAdmin) from writing superAdmins/{uid}', async () => {
    // Naming-collision guard (CONTEXT.md): an org 'editor' role claim must NOT satisfy
    // isSuperAdmin() — proves the two claim namespaces are genuinely independent.
    const context = testEnv.authenticatedContext('editorUid', { orgId: 'orgA', role: 'editor' })
    const db = context.firestore()
    await assertFails(setDoc(doc(db, 'superAdmins', 'targetUid'), { email: 'x@example.com' }))
  })
})
```

### `functions/src/index.test.ts`-style unit test for the onCall's caller re-check
```typescript
// Source: mirrors functions/src/index.test.ts's fakeRequest()/CallableRequest pattern
// (used for parsePptxHandler and queueServiceMessageHandler, both read this session).
function fakeRequest(
  overrides: Partial<CallableRequest<SetSuperAdminClaimRequest>> = {},
): CallableRequest<SetSuperAdminClaimRequest> {
  return {
    auth: { uid: 'callerUid', token: { superAdmin: true } },
    data: { targetEmail: 'target@example.com', grant: true },
    ...overrides,
  } as unknown as CallableRequest<SetSuperAdminClaimRequest>
}

it('rejects a caller whose token lacks the superAdmin claim', async () => {
  await expect(
    setSuperAdminClaimHandler(fakeRequest({ auth: { uid: 'x', token: {} } as never })),
  ).rejects.toMatchObject({ code: 'permission-denied' })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Every custom-claim write in this repo calls `setCustomUserClaims` directly (`orgMembershipClaims.ts`) | Every custom-claim write routes through `claimsHelpers.ts`'s merge/clear helpers | This phase (2026-08-20) | Closes the claim-wipe hazard for good — any THIRD future claim type this app ever adds inherits the safety automatically by using the same helper |
| Admin gating exists only for per-org roles (`isOrgEditor`) | A second, orthogonal, cross-org claim tier (`isSuperAdmin`) | This phase | First app-wide (non-org-scoped) authorization concept in the codebase — establishes the pattern Phases 69-71 build on |

**Deprecated/outdated:** none — this phase introduces new capability rather than replacing an existing one.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `testEnv.authenticatedContext(uid, tokenClaims)`'s second argument merges arbitrary custom claims (not just `email`) into `request.auth.token` inside the rules-emulator context | Code Examples — Rules test | LOW — this is the exact same call shape already proven working for `email` in this file (`src/rules.test.ts:162`), and is documented `@firebase/rules-unit-testing` behavior; if wrong, the ALLOW-case tests would fail immediately during development, not silently ship broken (self-correcting) |
| A2 | The bootstrap script should call `mergeAndSetCustomClaims` directly (not rely solely on the deployed trigger) to avoid a deploy-ordering gap for the very first grant | Pitfall 6, Code Examples note | MEDIUM — if the plan instead relies purely on trigger-deployment-then-bootstrap ordering (mirroring `backfillOrgClaims.ts`'s reliance on the ALREADY-deployed `syncOrgMembershipClaim` at the time it ran), the risk is fully mitigated by strict runbook ordering instead; either design is safe if the runbook enforces the right sequence, but the direct-call design is more robust to a mis-ordered manual deploy |
| A3 | `revokeRefreshTokens` + `checkRevoked: true` invalidates a target's session on their NEXT server-side-verified request, but does not retroactively invalidate an already-issued token being read for its EMBEDDED claims without an explicit `checkRevoked` check | Pitfall 5, §6 | MEDIUM — this is CITED from official Firebase docs (`firebase.google.com/docs/auth/admin/manage-sessions`, fetched this session) but the exact interaction with this repo's specific onCall/rules code (which reads `request.auth.token.*` directly, not via an explicit `verifyIdToken(..., true)` call) has not been independently re-verified against a live Firebase project this session — if the platform behaves differently than documented, the "≤1hr residual window" framing in Pitfall 5 could be wrong in either direction |

## Open Questions (RESOLVED)

1. **(RESOLVED)** **Does `onCall`'s built-in auth verification already imply `checkRevoked` semantics, or does `setSuperAdminClaimHandler` need an EXPLICIT `getAuth().verifyIdToken(idToken, true)` call to fully close the revoke-window from Pitfall 5?** — RESOLVED: accept the documented ≤1hr residual window as the phase's stated behavior (matches CONTEXT.md "revocation takes effect on the target's next token refresh"); recorded in `68-05-PLAN.md`'s runbook and deferred to manual UAT per `68-VALIDATION.md`. Not a blocker.
   - What we know: `onCall` verifies the ID token's signature and expiry server-side automatically (this repo's own `queueServiceMessageHandler` comment: "onCall already verifies the token signature server-side, so no extra re-verification round-trip is needed" — ARCHITECTURE.md §2). Official docs (§6 below) show `checkRevoked` as an explicit second argument to `verifyIdToken`, called manually.
   - What's unclear: whether Cloud Functions v2's `onCall` wrapper passes `checkRevoked: true` internally, or only checks signature+expiry (not revocation) by default.
   - Recommendation: treat this as MEDIUM confidence and either (a) accept the documented ≤1hr residual window as the phase's stated behavior (matches CONTEXT.md's own framing: "revocation takes effect on the target's next token refresh"), which is likely already the intended design, or (b) have the plan verify this explicitly against the Firebase emulator/a real revoke-then-call test during execution, not assume it silently.

2. **(RESOLVED)** **Should `bootstrapSuperAdmin.ts` require `--apply` a SECOND time (a `--confirm-owner` style flag) given it grants the single most powerful claim in the app?** — RESOLVED: keep the single `--apply` gate for consistency with `backfillOrgClaims.ts` (recorded as considered-and-rejected in `68-02-PLAN.md` Task 2). Not a blocker.
   - What we know: `backfillOrgClaims.ts`'s single `--apply` gate was judged sufficient for a claim scoped to one org.
   - What's unclear: whether the super-admin bootstrap — which is app-wide, not org-scoped — warrants an extra confirmation step beyond the existing dry-run-default/`--apply` pattern.
   - Recommendation: CONTEXT.md does not ask for anything beyond the existing `backfillOrgClaims.ts` shape ("mirrors `backfillOrgClaims.ts`"); keep the single `--apply` gate for consistency, but the plan should note this as a considered-and-rejected extra-friction option rather than an oversight.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Auth Emulator | Local dev/test of custom claims | Not probed this session (no local emulator process check run) | — | Rules-emulator tests (`src/rules.test.ts`) can construct authenticated contexts with arbitrary claims WITHOUT a live Auth emulator (rules-unit-testing fabricates the token) — sufficient for R178's rules tests. Unit tests for `claimsHelpers`/`superAdminClaims` mock `firebase-admin/auth` entirely (per `orgMembershipClaims.test.ts`'s established pattern), so no live emulator is needed for those either. |
| `.env.local` / `functions/.env` | Any local Functions build/test in a fresh worktree | Not probed — CLAUDE.md documents this as a standing requirement in every worktree | — | Symlink/copy from `C:\projects\worshipplanner\.env.local` per CLAUDE.md's documented setup step before running any local test in this phase |
| Firestore emulator (port 8080) | `src/rules.test.ts` via `npm run test:rules` or `vitest.rules.config.ts` against a running emulator | Not probed this session | — | None needed beyond starting `firebase emulators:start` per CLAUDE.md's documented two-suite discipline |

**Missing dependencies with no fallback:** none identified — every dependency this phase needs is either
already-installed npm packages (verified) or standard local dev tooling this repo's CLAUDE.md already
documents the setup for.

**Missing dependencies with fallback:** none beyond the standard emulator/`.env.local` setup steps already
documented project-wide.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (functions) | vitest `^4.1.10`, config: `functions/package.json`'s `"test": "vitest run"` |
| Framework (rules) | vitest `^4.0.18` (root) + `@firebase/rules-unit-testing`, config: `vitest.rules.config.ts` |
| Framework (app/client) | vitest `^4.0.18` (root), default `vite.config.ts` excludes `rules.test.ts`/`render-service/**` |
| Quick run command (functions) | `cd functions && npx vitest run claimsHelpers.test.ts superAdminClaims.test.ts` |
| Quick run command (rules) | `npx vitest run --config vitest.rules.config.ts` (with an emulator already running — per CLAUDE.md, `npm run test:rules` fails "port taken" if one is) |
| Full suite command | `cd functions && npm test` + `npm run test:rules` (or the already-running-emulator form) + `npx vitest run` (app) + `npm run type-check` |
| Type gate | `npm run type-check` (the `vue-tsc --build` form — checks test files too, per CLAUDE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R174 | Writing `superAdmins/{uid}` results in `superAdmin: true` claim | unit | `cd functions && npx vitest run superAdminClaims.test.ts -t "sets the claim"` | ❌ Wave 0 |
| R175 (direction A) | Org-membership clear preserves `superAdmin` | unit (regression) | `cd functions && npx vitest run orgMembershipClaims.test.ts -t "preserves superAdmin"` | ❌ Wave 0 — extends existing `orgMembershipClaims.test.ts` |
| R175 (direction B) | Super-admin revoke preserves `{orgId, role}` | unit (regression) | `cd functions && npx vitest run superAdminClaims.test.ts -t "preserves orgId/role"` | ❌ Wave 0 |
| R175 (helper itself) | `mergeAndSetCustomClaims`/`clearClaimKeys` merge/clear correctly in isolation | unit | `cd functions && npx vitest run claimsHelpers.test.ts` | ❌ Wave 0 |
| R176 | Bootstrap script dry-run writes nothing; `--apply` writes doc + claim | unit + manual | `cd functions && npx vitest run bootstrapSuperAdmin.test.ts` (dry-run assertion is automatable per `backfillOrgClaims.test.ts`'s pattern; the real `--apply` run against production is owner-executed, not testable in CI) | ❌ Wave 0 |
| R177 | Non-super-admin redirected from `/owner-console`; super-admin reaches it | component/e2e-ish | Manual UAT (this repo has no existing router-guard unit test precedent to extend — `router/index.ts` has no `.test.ts` file found) | manual-only |
| R178 (ALLOW) | Genuine super-admin can read/write `appConfig/global` and `superAdmins/{uid}` | rules emulator | `npx vitest run --config vitest.rules.config.ts -t "ALLOWS a genuine super-admin"` | ❌ Wave 0 — new describe block in `src/rules.test.ts` |
| R178 (DENY) | Non-admin and org-editor (role claim only) denied on both collections | rules emulator | `npx vitest run --config vitest.rules.config.ts -t "DENIES"` | ❌ Wave 0 — same describe block |
| R179 (grant) | `setSuperAdminClaim` onCall grants correctly, rejects non-admin caller | unit | `cd functions && npx vitest run superAdminClaims.test.ts -t "setSuperAdminClaimHandler"` | ❌ Wave 0 |
| R179 (revoke propagation) | Revoke calls `revokeRefreshTokens`; target denied on next check | unit (mock) + manual UAT for real propagation timing | `cd functions && npx vitest run superAdminClaims.test.ts -t "revoke"` (mock-verifies the call happens); manual UAT for actual session-cutoff timing per Open Question 1 | mock: ❌ Wave 0; timing: manual-only |

### Sampling Rate
- **Per task commit:** the relevant quick-run command from the table above (functions unit tests are fast;
  rules-emulator tests require the emulator already running per CLAUDE.md's documented gotcha).
- **Per wave merge:** `cd functions && npm test` + `npx vitest run --config vitest.rules.config.ts` (rules)
  + `npm run type-check`.
- **Phase gate:** full suite green (functions + rules + app `npx vitest run` + type-check) before
  `/gsd-verify-work` — app-suite baseline stays the documented 2 known-failing files
  (`storage.rules.test.ts`, `RosterView.test.ts`), neither of which this phase touches.

### Wave 0 Gaps
- [ ] `functions/src/claimsHelpers.test.ts` — new, covers `mergeAndSetCustomClaims`/`clearClaimKeys` in
      isolation (mock `firebase-admin/auth` per `orgMembershipClaims.test.ts`'s established `mockAuth()`
      helper pattern, read in full this session).
- [ ] `functions/src/superAdminClaims.test.ts` — new, covers `syncSuperAdminClaimHandler` and
      `setSuperAdminClaimHandler` (mirrors `orgMembershipClaims.test.ts` + the `fakeRequest()` pattern from
      `functions/src/index.test.ts`).
- [ ] `functions/src/bootstrapSuperAdmin.test.ts` — new, mirrors `backfillOrgClaims.test.ts`'s dry-run/apply
      assertion shape.
- [ ] Extend `functions/src/orgMembershipClaims.test.ts` — add the SC1 regression case (org-clear preserves
      `superAdmin`) to the EXISTING file rather than a new one, since it's testing the modified handler in
      that file.
- [ ] New `describe` blocks in `src/rules.test.ts` — no new file, no new emulator config (existing
      `vitest.rules.config.ts`/`beforeAll` setup already reads `firestore.rules` fresh each run).
- [ ] Framework install: none — vitest and `@firebase/rules-unit-testing` are both already present.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth custom claims (`superAdmin: true`), verified server-side via `onCall`'s built-in token verification + this phase's own explicit `request.auth.token.superAdmin` re-check |
| V3 Session Management | yes | `revokeRefreshTokens(uid)` on revoke; `checkRevoked` semantics (§6) — see Open Question 1 for the exact propagation-timing verification needed |
| V4 Access Control | yes | `firestore.rules`' `isSuperAdmin()` claim-only gate; `setSuperAdminClaimHandler`'s independent caller re-check (never trust client-declared authority) |
| V5 Input Validation | yes | `setSuperAdminClaimHandler` validates `targetEmail` presence and resolves via `getAuth().getUserByEmail` (server-side, not client-trusted uid) |
| V6 Cryptography | no | No new cryptographic primitive introduced this phase — custom claims are signed as part of the existing Firebase-issued ID token, no separate signing/verification code written here |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Claim replacement wiping an unrelated claim (this phase's core hazard) | Tampering / Elevation of Privilege (indirect — an attacker exploiting the RACE, not the write itself, though the practical effect is privilege LOSS not gain) | Shared `mergeAndSetCustomClaims`/`clearClaimKeys` helper, both writers route through it (R175) |
| Client-only route guard mistaken for real access control | Elevation of Privilege | `firestore.rules` claim-based gate + independent server-side re-check in every admin `onCall` (Pitfall 3) |
| Stale/self-granted "first super-admin" path left reachable post-bootstrap | Elevation of Privilege | Bootstrap is a NON-deployed, owner-run-once script (`bootstrapSuperAdmin.ts`, not exported from `index.ts`); no code path grants super-admin without either the bootstrap script OR an existing super-admin's `onCall` action |
| Reusing `"admin"`/`role` semantics for the super-admin claim | Spoofing (a weaker per-org claim mistaken for the stronger app-wide one) | Distinct claim key `superAdmin` (boolean), never overlapping `orgId`/`role`'s namespace (Pitfall 2) |
| Cross-document `get()`/`exists()` rules check reintroducing the `storage.rules` fragility class | Denial of Service (deny-everyone) or Elevation of Privilege (if the check silently passes instead of denying) | Claim-only `isSuperAdmin()`, zero rules-side Firestore reads (locked decision, CONTEXT.md) |
| Revoked super-admin's still-valid token used to flip a future destructive toggle (Phase 71 concern, but the SESSION-cutoff mechanism is THIS phase's job) | Elevation of Privilege / Tampering | `revokeRefreshTokens` on revoke; document the residual ≤1hr window explicitly rather than silently promising instant cutoff (Pitfall 5, Open Question 1) |

## Sources

### Primary (HIGH confidence)
- Direct repo reads this session: `functions/src/orgMembershipClaims.ts` (full file, quoted verbatim),
  `functions/src/backfillOrgClaims.ts` (full file), `functions/src/index.ts` (grep + `queueServiceMessageHandler`
  section, lines 2166-2440, full read), `functions/DEPLOY-ORG-CLAIMS.md` (full file), `src/stores/auth.ts`
  (full file), `src/router/index.ts` (full file), `src/components/AppSidebar.vue` (full file),
  `firestore.rules` (full file), `src/rules.test.ts` (structure + first 55 lines + grep for
  `authenticatedContext` call shapes), `functions/src/orgMembershipClaims.test.ts` (first 100 lines,
  mocking pattern), `functions/package.json`, `package.json`, `.planning/phases/68-super-admin-access-gate/68-CONTEXT.md`,
  `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (v1.9 autonomy grant + deploy discipline sections)
- `.planning/research/SUMMARY.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`
  (milestone-level research, read in full this session)

### Secondary (MEDIUM confidence)
- [Manage User Sessions | Firebase Authentication](https://firebase.google.com/docs/auth/admin/manage-sessions)
  — `[CITED: firebase.google.com/docs/auth/admin/manage-sessions]`, fetched via WebFetch this session for the
  exact `revokeRefreshTokens`/`verifyIdToken(idToken, true)` Node.js code examples and the 1-hour ID-token
  lifespan / "revocation enforced only when checkRevoked passed" behavior (Code Examples §6, Pitfall 5,
  Assumptions Log A3, Open Question 1)

### Tertiary (LOW confidence)
- None used directly in this research — the milestone-level PITFALLS.md/ARCHITECTURE.md already filtered
  general web-search corroboration down to what's cited above as Secondary.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified installed via direct `package.json` reads this session, zero new dependencies
- Architecture: HIGH — every pattern (claims-merge, trigger-sync, onCall caller-recheck, rules claim-check, rules-test claim-injection) is a byte-for-byte precedent already read from this repo's own source this session
- Pitfalls: HIGH for codebase-derived pitfalls (1-4, 6-7, grounded in the exact files read); MEDIUM for Pitfall 5's exact token-revocation propagation timing (grounded in official docs, not yet exercised against this repo's specific onCall/rules code)

**Research date:** 2026-08-20
**Valid until:** 30 days (stable Firebase Admin SDK/Functions APIs; re-verify if `firebase-admin`/`firebase-functions` are bumped past `^13.10.0`/`^7.2.5` before this phase executes)
