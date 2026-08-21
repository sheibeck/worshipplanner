# Phase 73: Multi-Org Storage Auth Claim - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (backend infra phase; grey areas auto-decided per the v2.0 standing autonomy grant — reasonable defaults chosen and stated, grounded in a direct read of the current claim-writer, `storage.rules`, `firestore.rules`, the client claim reader, and the existing backfill)

<domain>
## Phase Boundary

Widen the org-membership custom auth claim so it carries **all** of a user's organizations and their per-org
roles (not just the primary org), update `storage.rules` to authorize against that full set, and ship an
idempotent owner-run backfill — closing backlog **999.5** BEFORE Phase 74 assigns any admin into a second
org. Requirements R207–R211.

**Explicitly NOT in this phase:** the Organizations tab UI, org onboarding, or admin-assignment callables
(all Phase 74). This phase is the auth-claim + rules + backfill substrate those depend on. No client-app
behavior change is intended for today's single-org users.
</domain>

<decisions>
## Implementation Decisions

### Claim shape — ADDITIVE, not a replacement (R207, R211)
- Keep writing the existing top-level `{ orgId, role }` primary-org claim **unchanged**, AND add a new
  `orgs` map claim: `orgs: { [orgId]: 'editor' | 'viewer' }` carrying every org the user belongs to with its
  role. Rationale grounded in the codebase:
  - `storage.rules` is the only rule surface that reads the claim (its `isOrgMemberByClaim`); it gets a new
    arm that checks `request.auth.token.orgs[orgId] != null`.
  - `firestore.rules` membership (`isOrgMember`) uses `exists(.../members/$(uid))` — a Firestore document
    lookup, NOT the claim — so it is **unaffected** and must not be touched for membership. (R207's "shape
    both rules can read" is satisfied trivially: firestore.rules doesn't need the claim; storage.rules reads
    the new map.)
  - `src/stores/auth.ts` reads `claims.orgId` / `claims.role` for the **active** org context and its
    membership-propagation wait loop; keeping the primary keys means the client keeps working with **zero**
    change (R211 backward-compat for live single-org sessions).
- **Backward-compat arm in storage.rules (R211):** `isOrgMemberByClaim(orgId)` returns true if EITHER the new
  `orgs[orgId] != null` OR the legacy `orgId == orgId && role != null`. Old tokens (pre-backfill, carrying
  only the primary keys) keep Storage access to their primary org during rollout; new/backfilled tokens get
  all their orgs. No access gap while claims migrate.
- **Byte-size:** custom claims cap at ~1000 bytes; an `orgs` map keyed by orgId (28-char ids) with short role
  strings comfortably holds the realistic handful of orgs per user. The planner should note the cap and, if a
  pathological many-org user is a concern, prefer storing role as a short code — but do not prematurely
  optimize; a plain `{orgId: role}` map is the default.

### Claim-writer widening (R208) — `functions/src/orgMembershipClaims.ts`
- Extend the single shared decision path (`decideMembershipClaim` / `buildOrgMembershipClaim` /
  `syncOrgMembershipClaimHandler`) so that on any `organizations/{orgId}/members/{uid}` write it **recomputes
  the full multi-org set** for the user, not just the primary org. Derive the set by enumerating the user's
  memberships — join `users/{uid}.orgIds` (the authoritative membership list, already the source for the
  primary) with each `organizations/{orgId}/members/{uid}.role`, OR a `collectionGroup('members')` query
  keyed by the uid (planner/researcher picks the cleaner read; the backfill already uses collectionGroup —
  reuse that idiom for consistency).
- Keep computing the **primary** `{ orgId, role }` exactly as today (`orgIds[0]`) so the primary keys stay
  correct; add the `orgs` map alongside.
- **Preserve `superAdmin` (R208/R175):** write via the existing shared `mergeAndSetCustomClaims`
  (`claimsHelpers.ts`) so widening never wipes `superAdmin`, and a `superAdmin` grant never wipes `orgs`. The
  clear path (genuine primary-membership delete) must clear the primary keys AND recompute `orgs` from the
  remaining memberships (not blanket-clear the whole claim) — extend `clearClaimKeys`/the clear branch
  accordingly.
- **Delete-staleness caveat (must be handled, from the existing code comment):** the client `TeamView`
  `deleteDoc` does not update `users/{uid}.orgIds`, so on a membership delete `orgIds` may transiently include
  the just-removed org. The researcher/planner must decide the correct recompute source on delete so a
  removed org does NOT linger in `orgs` (e.g. derive `orgs` from the actual surviving `members` docs via
  collectionGroup, which reflects the delete, rather than from the possibly-stale `orgIds`). This is the
  sharpest correctness risk in the phase — call it out in the plan with a test.

### storage.rules (R209)
- Add the `orgs`-map arm to `isOrgMemberByClaim` (keeping the legacy arm for R211). Update the module comment
  (currently documents the single-primary-org "KNOWN LIMITATION") to reflect the widening.
- **Prove with genuine emulator tests:** a multi-org user (claim `orgs` carries orgA + orgB) is ALLOWED to
  read/write Storage under BOTH `orgs/orgA/**` and `orgs/orgB/**`; a user whose `orgs` lacks orgC is DENIED
  under `orgs/orgC/**` (cross-org DENY). Also keep a legacy-claim ALLOW case (only `orgId`/`role` set) proving
  R211 backward-compat, and keep the existing "claim-only membership (no firestore.exists fallback)" guard
  intact — do NOT reintroduce a cross-service `firestore.exists()` (inert in the Storage emulator; that is the
  documented deny-everyone hazard).

### Backfill (R210) — extend/mirror `functions/src/backfillOrgClaims.ts`
- Idempotent, **dry-run by default**, `--apply`-gated, owner-run Node script (same shape as the existing
  `backfillOrgClaims.ts` / `bootstrapSuperAdmin.ts`) that recomputes the widened claim (adds `orgs`,
  preserves primary + `superAdmin`) for every existing user via `collectionGroup('members')`. Skip-if-already
  -matching for idempotency. It shares the same decision logic as the trigger (extend `decideMembershipClaim`
  or a shared builder) so the two can never drift — the established D-11 pattern.

### Deploy (HAND OVER — v2.0 grant)
- Everything ships **built + tested + UNDEPLOYED**. Hand the owner: the exact
  `firebase deploy --only functions:syncOrgMembershipClaim` (the widened trigger) and
  `firebase deploy --only storage` (the rules) commands, plus the backfill's dry-run→`--apply` invocation and
  the recommended run order (deploy the widened writer first so new writes carry `orgs`, run the backfill to
  populate existing users, then deploy the storage.rules that authorizes against `orgs`). Preserve the
  soak/token-refresh guidance from `functions/DEPLOY-ORG-CLAIMS.md`. No secrets move.

### Claude's Discretion
- Exact read strategy for enumerating a user's orgs (orgIds-join vs collectionGroup), the precise `orgs` value
  encoding (full role string vs short code), and test-file organization — planner/researcher's call within the
  decisions above.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/orgMembershipClaims.ts` — the claim-writer to widen: `buildOrgMembershipClaim`,
  `decideMembershipClaim` (currently reads `users/{uid}.orgIds[0]` = primary only; its own comment documents
  the single-org "KNOWN LIMITATION" this phase closes), `syncOrgMembershipClaimHandler`, and the
  `onDocumentWritten('organizations/{orgId}/members/{uid}')` trigger.
- `functions/src/claimsHelpers.ts` — `mergeAndSetCustomClaims(uid, claims)` and `clearClaimKeys(uid, keys)`
  (R175 merge-preserving helpers; superAdmin preservation rides on these).
- `functions/src/backfillOrgClaims.ts` (+ `.test.ts`) — the dry-run/`--apply` backfill to extend/mirror;
  uses `collectionGroup('members')`; shares decision logic with the trigger.
- `storage.rules` — `isOrgMemberByClaim(orgId)` (lines ~28-32) reads `token.orgId`/`token.role`; the single
  rule surface to change. `src/storage.rules.test.ts` — the emulator test suite (note the known
  Storage-emulator `firestore.exists()` limitation causing 2 baseline failures unrelated to this claim arm).
- `functions/DEPLOY-ORG-CLAIMS.md` — the owner-run deploy runbook to update.

### Established Patterns
- Shared decision function used by both trigger and backfill (no-drift), dry-run/`--apply` owner-run scripts,
  merge-preserving custom-claim writes, emulator ALLOW+DENY rule tests.

### Integration Points
- `functions/src/orgMembershipClaims.ts` (+ test), `functions/src/backfillOrgClaims.ts` (+ test),
  `storage.rules`, `src/storage.rules.test.ts`, `functions/DEPLOY-ORG-CLAIMS.md`.
- **Do NOT change** `firestore.rules` membership (`isOrgMember` = `exists(members/uid)`, claim-independent) or
  `src/stores/auth.ts` (keeps reading the unchanged primary `orgId`/`role`).
</code_context>

<specifics>
## Specific Ideas

- The additive shape (`orgs` map alongside the untouched primary `orgId`/`role`) is what makes R211
  backward-compat true by construction and keeps the client + firestore.rules untouched.
- The delete-recompute-staleness case (`users.orgIds` stale on a client `deleteDoc`) is the one genuine
  correctness trap — the widening must recompute `orgs` from the surviving membership docs, and a test must
  prove a removed org disappears from `orgs`.
- Deploy order matters: widened writer → backfill → storage.rules (documented for the owner).
</specifics>

<deferred>
## Deferred Ideas

- Organizations tab UI, org onboarding, and admin assignment → **Phase 74** (which depends on this widened
  claim being in place).
- Retiring the legacy primary `orgId`/`role` claim keys once every session is backfilled → a future cleanup,
  out of scope now (keeping them is harmless and preserves client compatibility).
</deferred>
