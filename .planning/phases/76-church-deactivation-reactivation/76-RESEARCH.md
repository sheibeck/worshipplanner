# Phase 76: Church Deactivation & Reactivation - Research

**Researched:** 2026-08-22
**Domain:** Firebase custom-auth-claims, `firestore.rules`/`storage.rules` cross-service enforcement, super-admin-gated Cloud Functions callables
**Confidence:** HIGH (grounded directly in this repo's own Phase 40/68/73/74 code and CLAUDE.md's documented `firestore.exists()`/`firestore.get()`-inert-in-Storage defect)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status model (SC1):** Persist on `organizations/{orgId}`: `active: false` + `deactivatedAt`
(serverTimestamp) + `deactivatedBy` (caller uid). ABSENT or `active: true` == active (backward-compatible:
every existing org has no `active` field and must read as active). Reactivate sets `active: true` (and may
clear/keep `deactivatedAt` for history — keep as `reactivatedAt` provenance; don't delete the audit trail).

**Callable (SC1, R212):** A super-admin-gated callable flips the status — reuse the `orgProvisioning.ts`
pattern: `assertSuperAdminCaller` first (re-verifies `superAdmin` claim + re-reads
`superAdmins/{callerUid}`), then writes the org status. Prefer ONE callable `setOrgActive({ orgId, active })`
(or a deactivate/reactivate pair — planner's choice) so the client never writes another org's status
directly. The callable must ALSO perform whatever claim/side-effect the Storage-enforcement mechanism
requires (see research question) so deactivation takes effect for Storage, and reactivation fully reverses
it with no manual per-user fix-up (SC4/R214).

**Client login-block (SC2, R213):** In `src/stores/auth.ts` org-load (`loadOrgContext`/`ensureUserDocument`
/ the church picker), a member whose active/selected org is deactivated is NOT entered — surfaced as a
clear "This church is deactivated — contact your administrator" message, never a blank app or silent
failure. For a multi-org user, a deactivated org should be visibly unavailable in the picker
(disabled/labeled), not silently dropped. A super-admin is exempt (they can still enter a deactivated org
— SC "fully accessible to a super-admin").

**firestore.rules (SC3, R213):** Add an `isOrgActive(orgId)` helper =
`get(/organizations/$(orgId)).data.get('active', true) == true` (cross-document `get()` is valid in
firestore.rules; default-true so legacy orgs stay active). AND it into org-scoped member/editor access,
EXEMPTING super-admins: effectively `isOrgMember(orgId) && (isOrgActive(orgId) || isSuperAdmin())` (and the
editor equivalent). `isSuperAdmin()` already exists (v1.9, claim-based) — no Phase 78 dependency for the
exemption. Must not regress the existing rules; carry genuine emulator ALLOW (active-org member, and
super-admin on a deactivated org) + DENY (deactivated-org member) tests.

### Claude's Discretion

- One `setOrgActive` callable vs. a deactivate/reactivate pair; exact deactivated-message copy; whether the
  picker greys out vs. hides a deactivated org (prefer greyed-out + labeled so the user understands why).
- This research recommends: ONE `setOrgActive({orgId, active})` callable (simpler surface, less
  duplicated caller-verification code); greyed-out + labeled picker rows (per the stated preference).

### Deferred Ideas (OUT OF SCOPE)

- Auto-purge / scheduled deletion of long-deactivated orgs; a soft-trash restore window — future scope.
- Notifying a deactivated org's members by email — out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R212 | A super-admin can deactivate an organization from the Organizations tab, persisting a deactivated status on the org record via a super-admin-gated server callable — the client never flips another org's status directly. | `setOrgActive` callable design (Code Examples), reusing `assertSuperAdminCaller`; the `active`/`deactivatedAt`/`deactivatedBy` write shape (Architecture Patterns / Code Examples) |
| R213 | While an org is deactivated, all of its members are blocked from using it — enforced both in the client sign-in/org-load flow AND by `firestore.rules`/`storage.rules` — surfaced as a clear message, never a silent failure or blank app. | The full three-layer enforcement design: `firestore.rules` `isOrgActive()` (Pattern 3), `storage.rules` `deactivatedOrgs` claim guard (Pattern 2, the central research-question answer), and the `loadOrgContext` client block (Code Examples); Common Pitfalls 1/2/4 cover the correctness/propagation nuances |
| R214 | A super-admin can reactivate a deactivated organization, restoring its members' normal access on their next load. | The reactivate branch of `setOrgActive` (Code Examples) — clears `deactivatedOrgs[orgId]` via read-compute-write (Pitfall 3), no `revokeRefreshTokens` on reactivate, no manual per-user step required |
</phase_requirements>

## Summary

The phase adds one boolean lifecycle flag (`active`) to `organizations/{orgId}` and must deny every
ordinary member's access the instant it flips false — enforced independently in three places: the client
(`src/stores/auth.ts`), `firestore.rules` (which CAN read the flag live via `get()`), and `storage.rules`
(which CANNOT — `firestore.get()`/`exists()` is inert in the Storage emulator/service per
firebase-js-sdk#6803, the exact defect that once shipped a deny-everyone rule to production undetected,
per CLAUDE.md). `firestore.rules` enforcement is a straightforward live-read `isOrgActive()` helper
(CONTEXT.md's decision — confirmed sound below). `storage.rules` enforcement is the phase's one genuinely
open, security-critical design question, because it can only ever check the custom auth claim, and that
claim must therefore be updated by the deactivate/reactivate callable itself.

**This research recommends Option 2 — an additive `deactivatedOrgs` claim map, NOT excluding deactivated
orgs from the existing `orgs`/legacy claim (Option 1).** Option 2 requires exactly one new `storage.rules`
guard function and zero changes to the already-shipped, already-tested Phase 73 claim-computation code
(`computeOrgsClaimForUid`, `buildOrgsMapClaim`, `decideMembershipClaim`) — it is pure *net-new* claim
surface, so it cannot regress multi-org Storage access, which Option 1 risks by changing what every
future membership write computes for `orgs`, forever, on every org, not just deactivated ones. Option 2
also closes the legacy single-org claim arm's bypass in the SAME one-line guard, because the guard wraps
the entire existing `isOrgMemberByClaim` OR-expression (both arms) rather than needing to teach
`decideMembershipClaim` a new "is my primary org active" branch.

**Primary recommendation:** Add `deactivatedOrgs: Record<string, true>` as a new, independent custom-claim
key. The `setOrgActive` callable fans out to every member of the toggled org and merges/clears this ONE
key via the existing `mergeAndSetCustomClaims` pattern — never touching `orgs` or the legacy `orgId/role`
keys. `storage.rules`' `isOrgMemberByClaim` gets one new `&&` clause:
`(!isOrgDeactivatedForCaller(orgId) || request.auth.token.superAdmin == true)`. `firestore.rules` gets the
CONTEXT.md-locked `isOrgActive()` live-read helper, ANDed with an `isSuperAdmin()` OR-exemption into
`isOrgMember`/`isOrgEditor` directly (not scattered per call site), so every existing org-scoped rule
inherits deactivation-awareness for free.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persist deactivated status (`active`, audit fields) | API / Backend (Cloud Functions `setOrgActive`) | Database (Firestore doc) | Client never writes org status directly (R212) |
| Storage-access denial for deactivated org members | Database / Storage rules (`storage.rules` claim check) | API / Backend (claim fan-out writer) | `storage.rules` is the sole enforcement surface; the claim is written server-side |
| Firestore-access denial for deactivated org members | Database / Storage rules (`firestore.rules` live `get()`) | — | Firestore rules can read the org doc directly — no claim indirection needed |
| Client sign-in/org-load block + picker labeling | Frontend Server / Client (`src/stores/auth.ts`, Vue router) | — | First layer of defense; UX message, not the security boundary |
| Super-admin exemption | Database / Storage rules (claim + live-read checks) | — | `isSuperAdmin()` claim already exists (v1.9); no new mechanism needed |
| Onboarding UI control (Deactivate/Reactivate button) | Frontend Server / Client (`OrganizationsTab.vue`) | API / Backend (callable) | UI triggers the callable; never writes Firestore itself |

## Standard Stack

This phase adds **no new npm dependencies**. Everything is built on already-installed, already-used
libraries:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | (pinned in `functions/package.json`, unchanged) | `getAuth().setCustomUserClaims`/`getAuth().revokeRefreshTokens`, Admin SDK Firestore writes | Already the sole claim-writer in this codebase (Phase 40/68/73) |
| `firebase-functions` v2 (`onCall`, `HttpsError`) | (pinned, unchanged) | The `setOrgActive` callable | Identical shape to `onboardOrganization`/`assignOrgAdmin`/`setSuperAdminClaim` |
| `vitest` | `^4.1.10` (functions), root pinned separately | Unit tests for the handler + claim helpers | Already the project's test runner in both packages |

**Package Legitimacy Audit:** Not applicable — this phase installs no new packages. `npm view` / registry
verification is skipped per the Package Legitimacy Gate's own scope (no packages to check).

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────┐
                         │  OrganizationsTab.vue        │
                         │  (Deactivate / Reactivate)   │
                         └───────────────┬───────────────┘
                                          │ httpsCallable('setOrgActive', {orgId, active})
                                          ▼
                         ┌─────────────────────────────────────────────┐
                         │  setOrgActive (functions/src/orgProvisioning.ts) │
                         │  1. assertSuperAdminCaller (re-verify claim+doc) │
                         │  2. write organizations/{orgId}.active + audit   │
                         │     fields (deactivatedAt/By or reactivatedAt/By)│
                         │  3. query organizations/{orgId}/members          │
                         │  4. fan out per member (Promise.allSettled):     │
                         │       - deactivate: merge deactivatedOrgs[orgId] │
                         │         = true  +  revokeRefreshTokens(uid)      │
                         │       - reactivate: delete deactivatedOrgs[orgId]│
                         │         (no revoke — don't force re-login)       │
                         └───────────────┬─────────────────┬───────────────┘
                                          │                 │
                          Firestore write │                 │ Admin SDK claim write
                                          ▼                 ▼
                    organizations/{orgId}            each member's ID token
                    { active, deactivatedAt, ... }   custom claims: + deactivatedOrgs

──────────────────────────── enforcement (independent of each other) ────────────────────────────

  CLIENT (src/stores/auth.ts)          firestore.rules                    storage.rules
  loadOrgContext reads org.active      isOrgActive(orgId) =               isOrgMemberByClaim(orgId) =
  → blocks entry, shows message,       get(org doc).active default true   (orgs-map arm OR legacy arm)
  → picker greys out deactivated org   ANDed into isOrgMember/isOrgEditor  AND (!deactivatedOrgs[orgId]
  → super-admin exempt via             OR isSuperAdmin()                     OR superAdmin==true)
    isSuperAdmin.value (already        (live read — no propagation lag)   (claim-based — up to ~1h
    populated by refreshOrgClaim)                                          propagation lag; client
                                                                            block is the immediate layer)
```

### Recommended Project Structure

No new files. Extend existing modules:

```
functions/src/
├── orgProvisioning.ts        # + setOrgActive callable (mirrors onboardOrganization/assignOrgAdmin)
├── orgMembershipClaims.ts    # + DEACTIVATED_ORGS_CLAIM_KEY constant (co-located with ORGS_CLAIM_KEY)
├── claimsHelpers.ts          # + a small nested-map patch helper OR inline logic in orgProvisioning.ts
├── orgProvisioning.test.ts   # + setOrgActive tests
firestore.rules               # + isOrgActive(), composed into isOrgMember/isOrgEditor
storage.rules                 # + isOrgDeactivatedForCaller(), composed into isOrgMemberByClaim
src/
├── stores/auth.ts            # loadOrgContext: read org.active, block entry, extend memberships shape
├── components/admin/OrganizationsTab.vue  # + Deactivate/Reactivate control per row
src/rules.test.ts             # + isOrgActive ALLOW/DENY + super-admin-exemption tests
src/storage.rules.test.ts     # + deactivatedOrgs DENY + super-admin-exemption + legacy-arm tests
```

### Pattern 1: One additive claim key, zero touches to existing claim-computation code

**What:** `deactivatedOrgs: Record<string, true>` lives alongside (never replacing or filtering) the
existing `orgs` map and legacy `orgId`/`role` keys. `computeOrgsClaimForUid`, `buildOrgsMapClaim`, and
`decideMembershipClaim` (`functions/src/orgMembershipClaims.ts`) are **not modified at all** by this phase.
**When to use:** Whenever a new access-denial signal needs to compose with an existing, already-tested
multi-arm claim check, and the denial is driven by an out-of-band admin action (not an ordinary
membership-doc write) — exactly this phase's shape.
**Example:**
```typescript
// Source: functions/src/orgMembershipClaims.ts (existing pattern this phase extends, not modifies)
export const ORGS_CLAIM_KEY = "orgs";
// NEW — co-located the same way, same file, same export style:
export const DEACTIVATED_ORGS_CLAIM_KEY = "deactivatedOrgs";
export type DeactivatedOrgsClaim = Record<string, true>;
```

### Pattern 2: Rule-text guard wraps the WHOLE existing OR-expression, not each arm separately

**What:** `storage.rules`' `isOrgMemberByClaim` already ORs a multi-org arm and a legacy arm
(Phase 73, R209/R211). The new deactivation guard must be ANDed onto the *result* of that OR, not
duplicated inside each arm — otherwise a legacy-token holder could bypass the deny by matching only the
untouched arm.
**When to use:** Any time a new deny-condition must apply uniformly across multiple pre-existing
alternative-grant arms.
**Example:**
```javascript
// Source: storage.rules (recommended shape — see "Code Examples" below for the full block)
function isOrgDeactivatedForCaller(orgId) {
  return request.auth.token.deactivatedOrgs != null
    && request.auth.token.deactivatedOrgs[orgId] == true;
}

function isOrgMemberByClaim(orgId) {
  return request.auth != null
    && (
      (request.auth.token.orgs != null && request.auth.token.orgs[orgId] != null)
      || (request.auth.token.orgId == orgId && request.auth.token.role != null)
    )
    && (!isOrgDeactivatedForCaller(orgId) || request.auth.token.superAdmin == true);
}
```

### Pattern 3: firestore.rules gate lives INSIDE the shared helpers, not at each call site

**What:** `isOrgMember(orgId)`/`isOrgEditor(orgId)` are called from ~15 different `match` blocks in
`firestore.rules` (services, slideGroups, songs, invites, the generic `{collection}` wildcard, etc.).
Embedding the `isOrgActive(orgId) || isSuperAdmin()` check ONCE inside these two shared helpers means
every one of those call sites inherits deactivation-awareness automatically — mirroring how
`isOrgEditor` already embeds its own `role`-check without every call site repeating it.
**When to use:** Any cross-cutting access rule that must apply to an already-widely-reused helper.
**Example:**
```javascript
// Source: firestore.rules (recommended shape)
function isOrgActive(orgId) {
  return get(/databases/$(database)/documents/organizations/$(orgId)).data.get('active', true) == true;
}

function isOrgMember(orgId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
    (isOrgActive(orgId) || isSuperAdmin());
}

function isOrgEditor(orgId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('role', '') in ['editor', 'admin'] &&
    (isOrgActive(orgId) || isSuperAdmin());
}
```
**IMPORTANT scope boundary:** this exemption ONLY waives the *active* check — `isOrgMember`'s `exists()`
membership-doc requirement is untouched. A super-admin who is **not** a genuine member of the org is
still denied by `firestore.rules` today (no membership doc = `exists()` fails regardless of
`isSuperAdmin()`). Full "enter any church without a membership doc" is Phase 78's explicit deliverable
(R225) — Phase 76's exemption only means *"a super-admin who happens to already be a genuine member of
this org is not blocked by deactivation, unlike an ordinary member."* Do not conflate the two; see Open
Questions below.

### Anti-Patterns to Avoid

- **Excluding deactivated orgs from `computeOrgsClaimForUid`/`buildOrgsMapClaim` (Option 1):** this adds
  an org-active read to the hot path of *every* membership-doc write for *every* org (active or not),
  forever — not just deactivation events — and risks regressing the already-shipped, already-tested
  Phase 73 multi-org claim logic for an unrelated feature. Rejected; see Metadata/decision rationale below.
- **Checking `firestore.exists()`/`firestore.get()` from `storage.rules`:** documented dead end in this
  repo (CLAUDE.md, firebase-js-sdk#6803) — it silently evaluates to `false` in the Storage
  emulator/service even for a document proven to exist, which is exactly how a deny-everyone rule once
  reached production undetected. Never reintroduce this.
- **Adding the deactivation guard to only ONE of the two `isOrgMemberByClaim` OR-arms:** leaves the other
  arm (legacy or multi-org) as an unguarded bypass. The guard must wrap the whole OR-expression's result.
- **Treating `revokeRefreshTokens` as an immediate access cutoff:** it does not invalidate an
  already-issued, unexpired ID token against `firestore.rules`/`storage.rules` evaluation (neither rules
  engine calls `verifyIdToken(idToken, { checkRevoked: true })`). Its only effect is to make the member's
  *next* token refresh fail, forcing re-authentication. See "Token-propagation reality" below — do not
  claim it closes the ≤1h window.
- **Silently dropping a deactivated org from the multi-org picker:** CONTEXT.md explicitly requires it
  stay visible but disabled/labeled — a silently-vanishing org reads as data loss, not a lifecycle state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Super-admin caller re-verification | A new ad hoc claim check | `assertSuperAdminCaller` (`orgProvisioning.ts:85-97`) | Already dual-checks claim + Firestore doc; reused verbatim by `onboardOrganization`/`assignOrgAdmin`/`listOrganizations` |
| Custom-claim merge safety | A bare `getAuth().setCustomUserClaims(uid, patch)` | `mergeAndSetCustomClaims`/`mergeSetAndClearCustomClaims` (`claimsHelpers.ts`) | A bare call REPLACES the whole claims object, silently wiping `superAdmin`, `orgs`, or the legacy `orgId/role` keys — the exact hazard R175 was built to close |
| Forcing a stale claim to refresh on the client | A custom polling loop | `refreshOrgClaim`/`getIdTokenResult(user, true)` (`src/stores/auth.ts:219-238`) | Already implements the bounded-retry pattern (`CLAIM_REFRESH_MAX_ATTEMPTS`/`CLAIM_REFRESH_DELAY_MS`) for exactly this "just changed server-side, force a fresh token" need |

**Key insight:** every piece of machinery this phase needs (super-admin gate, claim-merge safety,
claim-refresh-on-client) already exists in this codebase from Phases 40/68/73/74. The only genuinely new
code is the `active` field, the `deactivatedOrgs` claim key, the fan-out loop, and the two rule-file
guards.

## Common Pitfalls

### Pitfall 1: The legacy single-org claim arm is an unconditional OR, not an AND
**What goes wrong:** If the deactivation guard is added only to the `orgs`-map arm of
`isOrgMemberByClaim`, a member whose token still carries the pre-widening/not-yet-backfilled legacy
`orgId`/`role` shape bypasses the deny entirely, because the two arms are OR'd (see `storage.rules`'s own
comment: "unconditionally ORed (never ANDed) with the new arm above").
**Why it happens:** The legacy arm exists specifically for backward compatibility during the Phase 73
rollout and was deliberately never gated on anything but `orgId == orgId && role != null`.
**How to avoid:** Wrap the ENTIRE `isOrgMemberByClaim` OR-expression's result with the new guard (Pattern
2 above), not each arm individually.
**Warning signs:** A DENY test passes for a multi-org-claim user but an equivalent legacy-shape-claim
user still gets ALLOW.

### Pitfall 2: `revokeRefreshTokens` is not an access-revocation primitive for rules-evaluated requests
**What goes wrong:** Assuming `revokeRefreshTokens(uid)` immediately blocks a deactivated member's
in-flight Storage requests.
**Why it happens:** `firestore.rules`/`storage.rules` evaluate the ID token's signature and expiry only —
neither rules engine performs the `checkRevoked: true` server-side lookup that `verifyIdToken` supports.
Revocation only prevents *future* token refreshes from succeeding.
**How to avoid:** Document the real behavior (see "Token-propagation reality" below) instead of treating
revocation as closing the window; rely on the client login-block for the *fast* layer and accept the
bounded (≤1h) claim-propagation lag for Storage as the documented, deliberate trade-off — exactly the
posture `setSuperAdminClaimHandler` already documents for its own demote-and-revoke path.
**Warning signs:** A security review or STRIDE pass claims "Storage access is revoked immediately" —
that claim is false and must be corrected before sign-off.

### Pitfall 3: Deleting a nested claim-map entry needs read-compute-write, not a shallow merge
**What goes wrong:** Calling `mergeAndSetCustomClaims(uid, { deactivatedOrgs: {} })` on reactivate wipes
*every* org's deactivated-flag for that user, not just the one being reactivated, if they happen to be a
member of more than one deactivated org.
**Why it happens:** `mergeAndSetCustomClaims`'s merge is shallow (top-level keys only) — passing a new
`deactivatedOrgs` value REPLACES the whole nested object rather than patching one key inside it.
**How to avoid:** Read the current `deactivatedOrgs` map, delete only the one `orgId` key in memory, then
write the resulting object back in a single `setCustomUserClaims` call — the same "read once, mutate in
memory, one atomic write" shape `mergeSetAndClearCustomClaims` already established to close the Phase 73
TOCTOU hazard (73-REVIEW.md WR-01). Add a small new helper (or inline this in the callable) rather than
composing the two generic helpers, since neither currently supports a nested-key delete.
**Warning signs:** Reactivating org A silently re-grants Storage access to still-deactivated org B for a
user who belongs to both.

### Pitfall 4: A partial fan-out failure must never mask the Firestore-side denial
**What goes wrong:** Treating the whole `setOrgActive` call as failed if one member's claim write throws
(e.g., `auth/claims-too-large`, a deleted Firebase Auth user, a transient Admin API error), leaving the
org's `active` field un-set and the super-admin unable to complete a simple toggle.
**Why it happens:** The claim fan-out and the Firestore status write are two different systems with two
different failure modes; conflating them makes the whole operation as fragile as its flakiest sub-step.
**How to avoid:** Commit the `organizations/{orgId}.active` write FIRST (this is the authoritative,
immediately-enforced-by-`firestore.rules` source of truth), then fan out claims with
`Promise.allSettled`, collecting per-member failures into a response summary — mirroring
`backfillOrgClaims.ts`'s per-account try/catch + summary shape. `firestore.rules`'s live `get()` denies
correctly for EVERY member regardless of fan-out outcome; only that specific straggling member's Storage
claim lags, and calling `setOrgActive` again (same target state) is a safe, idempotent retry.
**Warning signs:** A single unresolvable Auth-API edge case (e.g., a since-deleted user's leftover
member doc) blocks deactivating an otherwise-healthy org.

## Code Examples

### The `setOrgActive` callable (functions/src/orgProvisioning.ts)

```typescript
// Source: pattern mirrors onboardOrganizationHandler/assignOrgAdminHandler in this same file,
// plus setSuperAdminClaimHandler's revoke-on-demote precedent (functions/src/superAdminClaims.ts:164-171)

export interface SetOrgActiveRequest {
  orgId: string;
  active: boolean;
}

export interface SetOrgActiveResponse {
  orgId: string;
  active: boolean;
  memberCount: number;
  claimFailures: number; // R213/R214 resilience — see Pitfall 4
}

export async function setOrgActiveHandler(
  request: CallableRequest<SetOrgActiveRequest>,
): Promise<SetOrgActiveResponse> {
  const callerUid = await assertSuperAdminCaller(request);
  const { orgId, active } = request.data ?? ({} as SetOrgActiveRequest);
  if (typeof orgId !== "string" || orgId.trim() === "") {
    throw new HttpsError("invalid-argument", "orgId is required.");
  }
  if (typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "active (boolean) is required.");
  }

  const db = getFirestore();
  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `No organization found for id "${orgId}".`);
  }

  // 1. The authoritative write — firestore.rules' isOrgActive() reads this LIVE,
  // so this alone already fully enforces R213 for Firestore regardless of the
  // claim fan-out's outcome below (Pitfall 4).
  await orgRef.set(
    active
      ? { active: true, reactivatedAt: FieldValue.serverTimestamp(), reactivatedBy: callerUid }
      : { active: false, deactivatedAt: FieldValue.serverTimestamp(), deactivatedBy: callerUid },
    { merge: true },
  );

  // 2. Scoped fan-out — organizations/{orgId}/members ONLY, never the global
  // collectionGroup('members') scan computeOrgsClaimForUid uses. This never
  // touches orgs/orgId/role — purely additive deactivatedOrgs key (Pattern 1).
  const membersSnap = await orgRef.collection("members").get();
  const results = await Promise.allSettled(
    membersSnap.docs.map(async (memberDoc) => {
      const uid = memberDoc.id;
      if (active) {
        await clearDeactivatedOrgEntry(uid, orgId); // Pitfall 3 — read-compute-write
      } else {
        await mergeAndSetCustomClaims(uid, {
          deactivatedOrgs: { ...(await readDeactivatedOrgs(uid)), [orgId]: true },
        });
        await getAuth().revokeRefreshTokens(uid); // bounded-exposure, not instant-cutoff — see Pitfall 2
      }
    }),
  );
  const claimFailures = results.filter((r) => r.status === "rejected").length;

  return { orgId, active, memberCount: membersSnap.size, claimFailures };
}

export const setOrgActive = onCall(setOrgActiveHandler);
```

### `storage.rules` — full recommended diff shape

```javascript
// Source: storage.rules (extends the existing isOrgMemberByClaim, phase 40/73)
function isOrgDeactivatedForCaller(orgId) {
  return request.auth.token.deactivatedOrgs != null
    && request.auth.token.deactivatedOrgs[orgId] == true;
}

function isOrgMemberByClaim(orgId) {
  return request.auth != null
    && (
      (request.auth.token.orgs != null && request.auth.token.orgs[orgId] != null)
      || (request.auth.token.orgId == orgId && request.auth.token.role != null)
    )
    && (!isOrgDeactivatedForCaller(orgId) || request.auth.token.superAdmin == true);
}
```

### `firestore.rules` — full recommended diff shape

```javascript
// Source: firestore.rules (extends isOrgMember/isOrgEditor, composes with existing isSuperAdmin())
function isOrgActive(orgId) {
  return get(/databases/$(database)/documents/organizations/$(orgId)).data.get('active', true) == true;
}

function isOrgMember(orgId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
    (isOrgActive(orgId) || isSuperAdmin());
}

function isOrgEditor(orgId) {
  return isSignedIn() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('role', '') in ['editor', 'admin'] &&
    (isOrgActive(orgId) || isSuperAdmin());
}
```

### Client login-block — `src/stores/auth.ts` `loadOrgContext` extension

```typescript
// Source: extends the existing orgSnap read at loadOrgContext (src/stores/auth.ts:315-402)
// memberships now carries {id, name, active} — extend the Promise.all mapper (line 271-281)
// to also read `active` alongside `name`, defaulting missing field to true.

if (orgSnap.exists()) {
  const orgData = orgSnap.data()
  const isActive = (orgData.active as boolean | undefined) ?? true
  if (!isActive && !isSuperAdmin.value) {
    // R213 — clear org context exactly like the "no org" branch above, but with
    // a DISTINCT reason so the router/view can render "this church is
    // deactivated" instead of the generic "you have no church" empty state.
    memberUnsub?.()
    memberUnsub = null
    orgId.value = null
    orgName.value = null
    orgSlug.value = null
    userRole.value = null
    deactivatedOrgMessage.value = 'This church is deactivated — contact your administrator.'
    return
  }
  // ...existing orgName/orgSlug/settings population unchanged...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single-org `{orgId, role}` claim, Storage-membership-only | Multi-org `orgs` map + legacy arm, both claim-only | Phase 73 (2026-08-21) | This phase's guard must compose with BOTH arms, not just one |
| No org lifecycle state | `organizations/{orgId}.active` (this phase) | Phase 76 | First org-level boolean the rules must gate on beyond membership |

**Deprecated/outdated:** none — this phase is additive to a codebase whose claim architecture is only one
phase old (Phase 73, shipped code-complete 2026-08-21).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `revokeRefreshTokens` triggers the Firebase JS SDK's next silent token-refresh cycle to fail and sign the user out client-side, rather than merely blocking a future explicit re-login | Common Pitfalls / Code Examples | If the SDK instead keeps retrying silently without surfacing a signed-out state, the "bounded exposure" claim for Storage is weaker than documented — verify against the live Firebase Auth JS SDK behavior during implementation, not just training knowledge |
| A2 | The `~1000-byte` custom-claims cap (already documented in this repo, `claimsHelpers.ts:372-380`/73-REVIEW.md WR-02) has enough headroom for one more small map key (`deactivatedOrgs`) on top of `orgs`/`orgId`/`role`/`superAdmin` for this app's realistic per-user org count | Pattern 1 | A user in many orgs, several simultaneously deactivated, could approach the cap sooner than expected — not a concern at this project's documented scale (a handful of users per org), but should be sanity-checked if org count per user ever grows |

**If this table is empty:** N/A — two assumptions above need light verification but do not block planning; both are training-knowledge-level claims about Firebase SDK/Auth internals, not this repo's own code (which was read directly, not assumed).

## Open Questions

1. **Does "fully accessible to a super-admin" (Phase 76 goal prose) require a super-admin WITHOUT a
   membership doc to access a deactivated org's Storage/Firestore data?**
   - What we know: CONTEXT.md's locked `firestore.rules` decision and this research's `storage.rules`
     recommendation both exempt super-admins ONLY from the *active* check — `isOrgMember`'s `exists()`
     membership-doc requirement is untouched by this phase, and `isOrgMemberByClaim`'s membership arms are
     untouched too. A super-admin who is not a genuine member of the org gets no NEW access from Phase 76.
   - What's unclear: whether the phase's success criteria are satisfied by this narrower reading, or
     whether the owner expects any super-admin to be able to enter and inspect a deactivated org
     immediately, before Phase 78 ships.
   - Recommendation: treat Phase 76's exemption as scoped to "a super-admin who already has a membership
     doc is not additionally blocked by deactivation" — this matches ROADMAP.md's own Phase 78 framing
     ("Phase 78 is sequenced after Phase 76 so the super-admin arm composes cleanly on top of the
     deactivation-aware rules"), which implies the blanket no-membership-doc arm is deliberately Phase
     78's deliverable (R225), not Phase 76's. Flag this scoping explicitly to the user/planner rather than
     silently deciding it.

2. **Should `setOrgActive` guard against re-running the SAME target state (no-op deactivate-when-already-
   deactivated)?**
   - What we know: re-running the fan-out is idempotent (merges are safe to repeat) and this is
     recommended above as the resilience story for Pitfall 4's partial-failure retry case.
   - What's unclear: whether re-writing `deactivatedAt`/`deactivatedBy` on every redundant call is
     acceptable (it overwrites the original deactivation timestamp/actor with the retry's), or whether the
     audit trail should freeze on first transition only.
   - Recommendation: the planner should decide whether to add an early-return guard
     (`if (orgSnap.data()?.active === active) return early with the ALREADY-current state, skipping the
     audit-field rewrite but still safe to re-run for a genuine incomplete-fan-out retry — this is a
     product-polish decision, not a security one.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Cloud Functions build/test | ✓ | v22.23.2 | — |
| npm | dependency install/build/test | ✓ | 10.9.8 | — |
| firebase-tools (via `npx`) | emulator, `test:rules`, rules/functions deploy | ✓ | 15.27.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all required tooling is present in this environment,
matching CLAUDE.md's documented toolchain.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (root: pinned per `vite.config.ts`; `functions/`: `vitest ^4.1.10` per `functions/package.json`) |
| Config file | root `vite.config.ts` (excludes `src/rules.test.ts` and `render-service/**`); `vitest.rules.config.ts` (rules suite); `functions/vitest.config.ts` (or default) for functions unit tests |
| Quick run command | `npx vitest run` (app suite, 2-file baseline per CLAUDE.md) · `cd functions && npm test` (functions unit tests) |
| Full suite command | `npm run test:rules` (rules, via `firebase emulators:exec` — fails "port taken" if an emulator is already running; in that case run `npx vitest run --config vitest.rules.config.ts` directly against the running one) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R212 | `setOrgActive` persists `active`/`deactivatedAt`/`deactivatedBy`; rejects non-super-admin caller | unit | `cd functions && npx vitest run orgProvisioning.test.ts -t "setOrgActive"` | ❌ Wave 0 — new describe block in existing file |
| R212 | Client never writes org status directly (only via callable) | unit | `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` (or equivalent) | ❌ Wave 0 — extend/create component test |
| R213 | `firestore.rules` DENY for a non-super-admin member of a deactivated org; ALLOW for legacy/active org | rules emulator | `npx vitest run --config vitest.rules.config.ts -t "isOrgActive"` | ❌ Wave 0 — new describe block in `src/rules.test.ts` |
| R213 | `storage.rules` DENY for a member whose claim carries `deactivatedOrgs[orgId]`, across BOTH the multi-org and legacy arms; ALLOW for super-admin-with-membership | rules emulator | `npx vitest run --config vitest.rules.config.ts -t "deactivatedOrgs"` (or the storage-rules equivalent runner) | ❌ Wave 0 — new describe block in `src/storage.rules.test.ts` |
| R213 | Client shows a distinguishable "this church is deactivated" message, not a blank app | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "deactivated"` | ❌ Wave 0 — new test in the auth store's existing test file (confirm exact path/existence before planning) |
| R214 | Reactivation restores access — claim entry cleared, no residual `deactivatedOrgs[orgId]` for any member, no manual per-user step | unit + rules emulator | `cd functions && npx vitest run orgProvisioning.test.ts -t "reactivate"` + rules-emulator ALLOW re-check | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd functions && npm test` (functions changes) or `npx vitest run` (client changes) — whichever package the task touched.
- **Per wave merge:** full `npm run test:rules` (or the direct `vitest.rules.config.ts` run against an already-running emulator) PLUS `cd functions && npm test`.
- **Phase gate:** both suites green (functions unit + rules emulator) plus `npm run type-check` before `/gsd-verify-work`, per CLAUDE.md's `vue-tsc --build` gate.

### Wave 0 Gaps
- [ ] Confirm the exact test file for `src/stores/auth.ts` coverage (find or create `src/stores/__tests__/auth.test.ts`) — verify its existence before the planner assumes a path.
- [ ] `functions/src/orgProvisioning.test.ts` — extend with a `setOrgActive` describe block (file exists, extend only).
- [ ] `src/rules.test.ts` — extend with an `isOrgActive` / deactivation describe block (file exists, extend only).
- [ ] `src/storage.rules.test.ts` — extend with a `deactivatedOrgs` describe block (file exists, extend only).
- [ ] No new test framework install needed — both suites are already wired.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — Firebase Auth session model untouched |
| V3 Session Management | yes | `revokeRefreshTokens` forces re-authentication on next refresh cycle for deactivated members (bounded exposure documented, not instant) |
| V4 Access Control | yes | The core of this phase — `firestore.rules`/`storage.rules` independent, rules-enforced deny (not client-trust-only) |
| V5 Input Validation | yes | `setOrgActive` validates `orgId`/`active` types before any write (mirrors `assertValidEmailFormat`'s posture in the same file) |
| V6 Cryptography | no | No new crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client bypasses the sign-in block by calling Firestore/Storage SDK directly | Elevation of Privilege | `firestore.rules`/`storage.rules` independently deny — the client check is UX only, never the security boundary (this phase's whole design point) |
| A forged/stale token retains access after deactivation | Elevation of Privilege / Tampering | Documented, bounded (≤1h) claim-propagation window; `revokeRefreshTokens` bounds it to at most one token lifetime, not zero — this residual must be explicitly accepted, not silently ignored, in the phase's threat model |
| A super-admin grant/revoke races a deactivate/reactivate for the same uid | Tampering (claim clobber) | `mergeAndSetCustomClaims`/`mergeSetAndClearCustomClaims` preserve unrelated keys; the SAME residual concurrent-write race already documented in `claimsHelpers.ts:23-43` (accepted, not newly introduced by this phase) applies here too — do not attempt to "fix" it as part of this phase, it is a pre-existing accepted risk |
| Legacy-claim-shape bypass of the new deny (Pitfall 1) | Elevation of Privilege | Guard wraps the WHOLE `isOrgMemberByClaim` OR-expression, not one arm — proven by a dedicated legacy-arm DENY test |

## Sources

### Primary (HIGH confidence — read directly from this repository)
- `CLAUDE.md` — the `firestore.exists()`/`firestore.get()`-inert-in-Storage-emulator section (firebase-js-sdk#6803), and its 2026-08-06 production-incident narrative
- `storage.rules` — the existing `isOrgMemberByClaim` multi-org + legacy arm shape (Phase 40/73)
- `firestore.rules` — `isOrgMember`, `isOrgEditor`, `isSuperAdmin` helpers
- `functions/src/orgMembershipClaims.ts` — `computeOrgsClaimForUid`, `buildOrgsMapClaim`,
  `decideMembershipClaim`, `syncOrgMembershipClaimHandler`
- `functions/src/claimsHelpers.ts` — `mergeAndSetCustomClaims`, `clearClaimKeys`,
  `mergeSetAndClearCustomClaims`, the documented concurrent-write-race residual
- `functions/src/backfillOrgClaims.ts` — the per-account try/catch + summary pattern this phase's
  fan-out mirrors
- `functions/src/orgProvisioning.ts` — `assertSuperAdminCaller`, `onboardOrganizationHandler`,
  `assignOrgAdminHandler`, `listOrganizationsHandler` (the callable pattern this phase extends)
- `functions/src/superAdminClaims.ts` — `setSuperAdminClaimHandler`'s revoke-on-demote precedent and its
  documented ≤1h propagation-window caveat
- `src/stores/auth.ts` — `loadOrgContext`, `refreshOrgClaim`, `ensureUserDocument`, `memberships`
- `src/components/admin/OrganizationsTab.vue` — the existing Organizations-row UI pattern (onboard/assign)
- `src/rules.test.ts`, `src/storage.rules.test.ts` — existing emulator-test conventions this phase extends
- `.planning/phases/76-church-deactivation-reactivation/76-CONTEXT.md` — the locked decisions this
  research is scoped by
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — R212-R214, Phase 76-78 sequencing

### Secondary (MEDIUM confidence)
- None — no external web/docs sources were needed; this research was answerable entirely from the
  repository's own code and its own documented incident history.

### Tertiary (LOW confidence)
- Assumption A1 (Firebase JS SDK's exact client-side behavior on a failed silent token refresh after
  `revokeRefreshTokens`) — training-knowledge-level claim about SDK internals, not verified against a live
  SDK run in this session. See Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every primitive used is already in this codebase
- Architecture (Option 2 recommendation): HIGH — derived directly from reading the actual claim-computation
  code and reasoning through the legacy-arm bypass risk that Option 1 would reintroduce; not a guess
- Pitfalls: HIGH — three of four pitfalls are drawn directly from this repo's own documented incident
  history (CLAUDE.md's Storage-rules defect) and review artifacts (73-REVIEW.md's WR-01/WR-02); the
  `revokeRefreshTokens` propagation-lag claim mirrors `superAdminClaims.ts`'s own documented posture

**Research date:** 2026-08-22
**Valid until:** 30 days (stable internal architecture; not dependent on any external library release cadence)
