# Phase 68: Super-Admin Access Gate & Claim-Merge Fix - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas auto-resolved from research/SUMMARY.md + REQUIREMENTS.md under the v1.9 autonomy grant; recommended answers accepted)

<domain>
## Phase Boundary

Deliver the super-admin access gate end-to-end — a `superAdmin` custom auth claim that is grantable,
claim-merge-safe, and enforced by BOTH the client route and Firestore rules — plus the minimal console
shell that hosts a super-admin roster (grant/revoke). This is the security foundation Phases 69–71 build on.

**In scope (R174–R179):**
- A `superAdmins/{uid}` collection (existence = granted) and a `superAdmin: true` custom claim.
- A shared `mergeAndSetCustomClaims()` helper used by BOTH the new super-admin claim sync AND the existing
  `syncOrgMembershipClaim`, closing the `setCustomUserClaims`-replaces-not-merges live gap.
- An owner-run, dry-run-by-default, `--apply`-gated bootstrap script for the FIRST super-admin.
- A distinctly-named gated route (`/owner-console`) + nav entry + router guard + `isSuperAdmin` store flag.
- Claim-only `isSuperAdmin()` Firestore rules for `appConfig/*` and `superAdmins/*`, with genuine emulator
  ALLOW + DENY tests.
- A minimal in-console super-admin roster: grant/revoke another user (serves R179).

**Out of scope (later phases):** the `appConfig/global` doc CONTENTS + Cloud Functions reading config at
runtime (Phase 69); the config-editor panels + no-reply sender (Phase 70); the cleanup dry-run/confirm
safety flow (Phase 71). This phase writes the RULES for `appConfig/*` but not the doc's managed values.
</domain>

<decisions>
## Implementation Decisions

### Claim model & the merge-safety fix (R174, R175)
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

### Grant / revoke mechanism & propagation (R176, R179)
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

### Client gate & route (R177)
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

### Rules & rules-testing discipline (R178)
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

### Deploy discipline (v1.9 grant)
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
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/orgMembershipClaims.ts` — the v1.5 `syncOrgMembershipClaim` (`onDocumentWritten` over
  `organizations/{orgId}/members/{uid}`) + `decideMembershipClaim`. Direct template for `syncSuperAdminClaim`,
  AND the file that MUST be refactored onto the shared merge helper (this is where the claim-wipe bug lives).
- `functions/src/backfillOrgClaims.ts` — dry-run-by-default, `--apply`-gated, owner-run script; the exact
  shape to mirror for the super-admin bootstrap script.
- `src/stores/auth.ts` — `loadOrgContext` already forces `getIdTokenResult(user, true)` and reads claims;
  extend it to surface `isSuperAdmin`.
- `src/router/index.ts` — existing auth/role route guards to extend with `requiresSuperAdmin`.
- `src/components/AppSidebar.vue` — existing nav; add the gated "Owner Console" entry.
- `src/views/SettingsView.vue` / `TeamView.vue` — form/roster patterns to reuse for the roster panel (no new
  validation library — plain `Number(...)`/guard style).
- `firestore.rules` — existing `isOrgEditor()`/`isOrgMember()` claim idioms to mirror for `isSuperAdmin()`;
  the `role: admin→editor` normalization to avoid colliding with.
- `src/rules.test.ts` + the rules emulator harness — where the ALLOW/DENY tests go.

### Established Patterns
- Custom claims set server-side via Admin SDK `setCustomUserClaims`; client sees them via
  `getIdTokenResult(user, true)`. Claim-based rules helpers over cross-document lookups.
- Pinia stores with `onSnapshot`; scoped Firestore dot-path writes.

### Integration Points
- `functions/src/index.ts` — export the new `syncSuperAdminClaim` + `setSuperAdminClaim` (NOT the bootstrap
  script). Keep the merge-helper refactor to `orgMembershipClaims.ts` behavior-preserving for existing claims.
- Client: new route in `router/index.ts`, nav entry in `AppSidebar.vue`, `isSuperAdmin` in `auth.ts`.
</code_context>

<specifics>
## Specific Ideas

- The merge-safety fix (SC1) is the single highest-priority correctness item and must land in the SAME phase
  as the `superAdmin` claim — it must never exist unpatched, because ordinary org-membership writes happen
  constantly in production and would silently strip a granted `superAdmin`.
- The `isSuperAdmin()` rule must be claim-only — this is explicitly the safer choice given this repo's
  documented `storage.rules`/`firestore.exists()` incident.
</specifics>

<deferred>
## Deferred Ideas

- Config-editor panels + effective-value/provenance display → Phase 70.
- No-reply sender configuration → Phase 70.
- The `appConfig/global` managed values + Cloud Functions reading config at runtime → Phase 69.
- Cleanup dry-run blast-radius preview + confirm-to-flip → Phase 71.
- Full multi-admin management UI (bulk roster, grant audit history) → deferred beyond v1.9 (REQUIREMENTS.md
  Future). This phase's roster is intentionally minimal (grant/revoke one user).
- **Owner infra check (flag at hand-off, not this phase's code):** confirm Cloud Storage Object Versioning /
  bucket retention is enabled as a safety net BEFORE Phase 71's live deletion toggles ship.
</deferred>
