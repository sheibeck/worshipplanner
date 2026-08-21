# Phase 74: Organizations — List, Onboard & Admin Assignment - Research

**Researched:** 2026-08-21
**Domain:** Firebase Admin SDK (onCall callables, Firestore transactions, Auth `getUserByEmail`) + Vue 3 admin-console UI (already fully specced in `74-UI-SPEC.md`)
**Confidence:** HIGH

## Summary

This phase is almost entirely a **pattern-replication** exercise, not a technology-discovery one. Every
piece the callables need already exists once in this codebase and needs to be re-composed, never
invented: the super-admin caller-gate (`superAdminClaims.ts`), the `orgNames` create-only uniqueness
registry semantics (`src/utils/orgName.ts`, replicated server-side via a Firestore transaction), the
org/member/invite/inviteLookup document shapes (`src/stores/auth.ts` lines ~377–483), the claim-sync
indirection (`orgMembershipClaims.ts`'s trigger, which the callable must never touch directly), and the
Suggested Template content (`buildSuggestedTemplateEntries()` in `src/utils/slotTypes.ts`, a 9-entry
static list that needs only a data-only port, not the full VW-typing logic). The client UI is fully
specified in `74-UI-SPEC.md` (already checker-ready) and mirrors `ConfigurationTab.vue`'s roster
list/grant-form/inline-confirm idiom column-for-column — this research does not re-derive UI, it
confirms the callable contracts the spec already assumes (`{status: 'added'|'invited'}`,
`{orgId, name, createdAt, memberCount}[]`).

The one genuinely new mechanism this phase introduces is a **get-then-create Firestore transaction**
that replicates `orgNames`' create-only uniqueness under the Admin SDK (which bypasses
`firestore.rules` entirely, so the client-side create-only rule enforces nothing for these callables).
The codebase already has one precedent for get-then-write transactional uniqueness
(`checkAndConsumeRateLimit`/`checkAndConsumeOrgEmailQuota` in `functions/src/index.ts`), which this
research adapts.

**Primary recommendation:** Build one new module `functions/src/orgProvisioning.ts` housing all three
callables plus a small ported `buildSuggestedTemplateEntries()`/`DEFAULT_ORG_SETTINGS` pair, following
`superAdminClaims.ts`'s exact caller-gate shape and `serviceRoles.ts`'s exact client-util-port
precedent. `assignOrgAdmin`'s core is reused as a plain internal async function by
`onboardOrganization` (per the CONTEXT.md discretion note) so the additive `arrayUnion`/invite logic
never forks into two copies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Super-admin caller re-verification | API / Backend (Cloud Functions) | — | Must be server-side and independent of the client-declared token claim (dual check: token + fresh Firestore re-read) — mirrors `setSuperAdminClaimHandler` exactly. |
| `orgNames` uniqueness enforcement | API / Backend (Firestore transaction, Admin SDK) | — | Admin SDK bypasses `firestore.rules`' create-only `orgNames` rule, so uniqueness must be re-implemented server-side inside the callable, not delegated to rules. |
| Org record + `OrgSettings` + seeded template creation | API / Backend | Database / Storage (Firestore doc) | Privileged write; client never writes `organizations/*` directly (R200). |
| First-admin / additional-admin assignment (`members/{uid}` + `orgIds` arrayUnion) | API / Backend | Database / Storage | Privileged write; the additive `arrayUnion` guarantee (R206) must live where it can never be bypassed by a client overwrite. |
| Custom-claim sync (`orgId`/`role`/`orgs`) | API / Backend (existing Firestore trigger, Phase 73) | — | Already owned by `syncOrgMembershipClaim` — this phase's callables must NOT write claims directly; they only write the `members/{uid}` doc the trigger reacts to. |
| Org list + member counts | API / Backend (onCall, Admin SDK read) | — | Keeps `firestore.rules` unchanged (no broadened client read of `organizations/*` across all orgs); member counts computed server-side via `count()` aggregate queries. |
| Organizations tab UI (list/onboard/assign forms) | Frontend Server / Browser (Vue SPA) | — | Pure `httpsCallable` consumer; no direct Firestore writes to privileged collections — already the existing console idiom (`ConfigurationTab.vue`). |

## User Constraints

<user_constraints>
### Locked Decisions

**Server-side: three super-admin-gated onCall callables (R200, R204 — no privileged client writes)**
Mirror `functions/src/superAdminClaims.ts`'s `setSuperAdminClaim` exactly for the caller gate: reject
`!request.auth` (unauthenticated) and `request.auth.token.superAdmin !== true` (permission-denied), AND
independently re-read `superAdmins/{callerUid}` from Firestore (never trust the client-declared flag alone).
Resolve target users via `getAuth().getUserByEmail()`. Put them in a new `functions/src/orgProvisioning.ts`
(+ export from `functions/src/index.ts`). All writes use the Admin SDK (bypasses rules for the privileged
org/members/orgNames writes — which is exactly why the client never needs, and never gets, those write rules).

1. **`onboardOrganization({ name, adminEmail })`** (R197–R202, R199):
   - Validate `name` non-empty; `normalizeOrgName(name)`; **enforce uniqueness in a Firestore transaction** on
     `orgNames/{nameKey}` (create-only: if the doc exists → throw `already-exists` "That church name is taken"
     → R201). The Admin SDK bypasses the create-only rule, so the callable MUST implement the check itself in
     the transaction (get-then-create).
   - Create `organizations/{orgId}` (auto-id) `{ name, createdAt: serverTimestamp(), createdBy: callerUid }`
     and seed default `OrgSettings` with `defaultServiceTemplate` = the Suggested Template (R197/R198). Port
     `buildSuggestedTemplateEntries()` (src/utils/slotTypes.ts) into a small self-contained functions module
     (mirrors the v1.7 `functions/src/serviceRoles.ts` client-util port precedent) so the seeded template is
     byte-identical to what a normally-created org gets. Where the settings live (on the org doc vs a settings
     subdoc) must match how `loadOrgContext`/`OrgSettings` is read today — planner confirms and matches it.
   - **Assign the first admin (R199)** via the shared assignment logic below.
   - **Ordering / no half-created org (R202):** claim the `orgNames` entry (transaction) FIRST so a duplicate
     name is rejected before anything else is created; then batch-write org doc + settings; then run the admin
     assignment. On a mid-flow failure, the orgName is bound to `{orgId}` so a retry with the same name+org is
     idempotent (the name check finds its own claim and proceeds) rather than stranding a nameless/adminless
     org. Planner decides the exact transaction/batch boundaries; the invariant is: a retry after fixing the
     input succeeds without manual cleanup, and a duplicate name never creates a second org.

2. **`assignOrgAdmin({ orgId, email })`** (R203–R206): resolve `email` → uid via `getUserByEmail`.
   - **Existing account:** create `organizations/{orgId}/members/{uid}` `{ role: 'editor', joinedAt,
     displayName, email }` (the existing member-doc shape) AND **append** `orgId` to `users/{uid}.orgIds` with
     `FieldValue.arrayUnion(orgId)` — **NOT** a `set([orgId])` overwrite. This is the R206 additive guarantee:
     RESEARCH from Phase 73 proved the client org-founding/invite paths (`src/stores/auth.ts:426,455`)
     OVERWRITE `orgIds`; this callable must not repeat that, or a user already in another org would lose it.
     The Phase 73 `syncOrgMembershipClaim` trigger fires on the members write and sets the widened `orgs`
     claim automatically — no manual claim write here.
   - **No account (R205):** do NOT create a dangling membership. Instead create the existing invite artifacts
     — `organizations/{orgId}/invites/{email}` `{ role: 'editor', ... }` and the `inviteLookup/{email}` entry —
     so the person is added at editor via the existing invite-acceptance flow (`src/stores/auth.ts`) on their
     first sign-in. The callable returns a clear `{ status: 'invited' }` vs `{ status: 'added' }` so the UI can
     say which happened. (If preferred, return a typed "no account — invited" result rather than an error;
     never a silent failure.)

3. **`listOrganizations()`** (R196): super-admin-gated; Admin SDK reads all `organizations` docs and returns a
   summary array `[{ orgId, name, createdAt, memberCount }]` (memberCount via a members subcollection
   count/aggregate per org). A callable (not a broadened client read rule) keeps `firestore.rules` unchanged
   and computes member counts server-side. One-shot fetch (refetched after onboarding/assignment) — realtime
   is unnecessary for an admin console list.

### Client: Organizations tab UI (fills the Phase 72 placeholder — R196–R206)
- Replace `src/components/admin/OrganizationsTab.vue`'s placeholder with the real surface (still inside the
  already-super-admin-gated `/owner-console`, no new gate):
  - **List (R196):** on mount call `listOrganizations` (httpsCallable); render a table/list — church name, org
    id, created date, member count — with loading/empty/error states matching the console's existing card
    idiom (mirror `OwnerConsoleView`/`ConfigurationTab` styling; dark palette).
  - **Onboard (R197–R202):** an "Onboard a church" form — church name + first-admin email → call
    `onboardOrganization`; on success refresh the list and show a confirmation naming the church + whether the
    admin was added or invited; on failure surface the specific reason (name taken, invalid/failed email)
    inline. Disable/spinner while in flight.
  - **Assign admin (R203–R206):** a per-org "Assign admin" affordance (email input) → call `assignOrgAdmin`;
    surface added-vs-invited and errors clearly.
- The client calls ONLY the three callables with a recipient SELECTOR (name/email) — it never writes
  `organizations/*`, `orgNames/*`, or another org's `members/*` directly (R200/R204).

### Rules (expected: no change)
- No `firestore.rules` / `storage.rules` change is expected — every privileged read/write is an Admin-SDK
  callable, and the assigned admin reads their org through the existing `isOrgMember` (exists(members/uid))
  rule once their membership doc exists. If the planner finds a genuine gap (e.g. an invite-lookup read path),
  it may add a narrowly-scoped rule with emulator ALLOW/DENY proof — but the default is: no rules change.

### Deploy (HAND OVER — v2.0 grant)
- The three new callables ship built + tested + UNDEPLOYED. Hand the owner the exact
  `firebase deploy --only functions:onboardOrganization,functions:assignOrgAdmin,functions:listOrganizations`
  command. No secrets involved. (If any narrowly-scoped rule is added, its deploy is handed over too.)

### Claude's Discretion
- Callable payload/return exact shapes; whether onboarding's admin-assignment reuses `assignOrgAdmin`'s core
  as a shared internal helper (recommended — no drift); table vs card list layout; the exact members-count
  aggregation method (count query vs read); functions file organization. Planner's call within the above.

### Deferred Ideas (OUT OF SCOPE)
- Editing/renaming/suspending/deleting an org; bulk multi-admin management; per-org role changes; member
  removal UI; self-service signup; billing — all out of scope (Future Requirements in REQUIREMENTS.md).
- The pre-existing client `orgIds`-OVERWRITE bug in `src/stores/auth.ts:426,455` (invite-accept/auto-create
  set `orgIds` to a one-element array) — a real latent multi-org limitation surfaced by Phase 73 research. This
  phase does NOT fix the client flow (out of scope); it only ensures the SERVER assignment path is additive
  (`arrayUnion`). Flagged for a future phase if client-side multi-org org-switching is ever wanted.

**UI is already fully specced** — see `.planning/phases/74-organizations-onboard-assign/74-UI-SPEC.md`
(copywriting, component markup, states, colors all locked, checker-pending). This RESEARCH.md does not
re-derive UI decisions; it confirms the exact callable request/response shapes the spec assumes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R196 | Organizations tab lists every org with name + distinguishing detail | `listOrganizations()` — Admin SDK read of all `organizations` docs + per-org `count()` aggregate on `members` (see Pattern 3, Pitfall 5) |
| R197 | Onboard a new org: creates `organizations/{orgId}` with default `OrgSettings` deep-merged from code defaults | Pattern 1 (transaction + batch ordering); ported `DEFAULT_ORG_SETTINGS` object (see Code Examples) |
| R198 | Onboarding seeds `OrgSettings.defaultServiceTemplate` | Ported `buildSuggestedTemplateEntries()` — reduced to a static 9-entry array (see Don't Hand-Roll / Code Examples) |
| R199 | Onboarding assigns first admin at editor tier, same flow | `onboardOrganization` calls the shared `assignAdminCore` helper (Pattern 2) |
| R200 | Onboarding is entirely super-admin-gated callable; client never writes `organizations/*`/`orgNames/*`/`members/*` | Pattern 4 (caller gate, mirrors `setSuperAdminClaimHandler`) |
| R201 | Church-name uniqueness enforced via `orgNames` create-only registry | Pattern 1 (get-then-create transaction) |
| R202 | Failed onboarding step never strands a half-created org; retry succeeds | Pattern 1 ordering + idempotency note; Pitfall 1 |
| R203 | Super-admin assigns a church admin by email → `members/{uid}` at editor role | Pattern 2 (`assignAdminCore`) |
| R204 | Admin assignment is super-admin-gated callable; resolves email, writes membership, claim sync happens via existing trigger | Pattern 4 (caller gate) + confirmed non-interference with `syncOrgMembershipClaim` (Integration Points) |
| R205 | No-account email handled gracefully (invite path, never silent failure/dangling membership) | Pattern 2's `getUserByEmail` catch branch → invite artifacts, not `HttpsError` |
| R206 | Additive assignment — `arrayUnion`, never overwrite; existing memberships preserved | Pattern 2 (`FieldValue.arrayUnion`); Pitfall 2 |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | `^13.10.0` [VERIFIED: functions/package.json] | Admin SDK: `getAuth()`, `getFirestore()`, `FieldValue.arrayUnion`, transactions, `count()` aggregate queries | Already the sole Firestore/Auth client in every existing `functions/src/*.ts` file — no alternative considered. |
| `firebase-functions` | `^7.2.5` [VERIFIED: functions/package.json] | `onCall`, `HttpsError`, `CallableRequest` v2 API | Already used by every existing callable (`setSuperAdminClaim`, `parsePptx`, `queueServiceMessage`). |

No new packages are installed this phase — both libraries are already project dependencies. **Package
Legitimacy Audit is not applicable** (see below).

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `firebase/functions` (client) | already a dep of `src/firebase/index.ts` | `httpsCallable` from the Vue client | Already used identically by `ConfigurationTab.vue`'s `setSuperAdminClaim` call — the exact idiom `74-UI-SPEC.md` assumes. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A Firestore transaction for `orgNames` uniqueness | A plain `create`-style write relying on `firestore.rules`' create-only semantics | Rejected — Admin SDK bypasses `firestore.rules` entirely, so the rule enforces nothing for these callables (this is precisely why R201 calls out re-implementing the check server-side). |
| `count()` aggregate query per org for `memberCount` | Reading every `members` doc per org and counting client-side (`.get()` then `.size`) | `count()` is cheaper (server-side aggregation, no per-doc read cost) and is the documented replacement for the old "read everything to count" anti-pattern; use it unless the emulator proves flaky (see Pitfall 5 fallback). |
| A single cross-collection `collectionGroup('members')` scan for all counts at once | N per-org `count()` queries | `collectionGroup` avoids N round-trips but requires grouping by parent org id in memory (no `GROUP BY` in Firestore) — for the platform's current small org count, N parallel `count()` calls via `Promise.all` is simpler and already has zero precedent to diverge from; `computeOrgsClaimForUid` in `orgMembershipClaims.ts` already documents this collectionGroup-scan/small-scale tradeoff for a different callable and reaches the same "proportionate at current scale" conclusion. |

**Installation:** none — no new packages.

**Version verification:** `firebase-admin@^13.10.0` and `firebase-functions@^7.2.5` are pinned in
`functions/package.json` today and already `npm install`ed in this workspace — confirmed by direct
read, not merely training-data recall.

## Package Legitimacy Audit

**Not applicable this phase.** No new npm packages are introduced — every module (`firebase-admin`,
`firebase-functions`) is already an installed, in-use dependency of `functions/package.json`, verified
by direct file read above. `functions/src/orgProvisioning.ts` and its small ported-template module are
first-party code, not registry packages.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         Organizations tab (Vue, OrganizationsTab.vue)
                                        |
          ┌─────────────────────────────┼─────────────────────────────┐
          |                             |                             |
   listOrganizations()          onboardOrganization()          assignOrgAdmin()
   (httpsCallable, no args)     ({name, adminEmail})            ({orgId, email})
          |                             |                             |
          v                             v                             v
   ┌─────────────────┐   ┌───────────────────────────┐   ┌─────────────────────┐
   │ Caller gate      │   │ Caller gate                │   │ Caller gate          │
   │ (token flag +    │   │ (token flag + Firestore    │   │ (token flag +        │
   │  fresh Firestore │   │  re-read of superAdmins/   │   │  Firestore re-read)  │
   │  re-read)        │   │  {callerUid})               │   │                      │
   └────────┬─────────┘   └──────────────┬─────────────┘   └──────────┬───────────┘
            |                             |                            |
            v                             v                            v
   Admin SDK reads:              1. normalizeOrgName(name)      resolveTargetUid(email)
   organizations/*  +            2. runTransaction:                (getAuth().getUserByEmail)
   per-org count()                  get orgNames/{key}                |
   on members subcoll.              -> exists? throw               ┌──┴──┐
            |                        already-exists            found   not found
            v                        -> else create              |        |
   return [{orgId, name,             orgNames/{key}={orgId}       v        v
   createdAt, memberCount}]       3. batch: create org doc    assignAdminCore()   createInviteArtifacts()
                                     + settings (deep-merged      (members/{uid}    (invites/{email} +
                                     defaults + seeded            + arrayUnion       inviteLookup/{email})
                                     template)                    orgIds)                |
                                  4. assignAdminCore(             |                       |
                                     orgId, adminEmail)           v                       v
                                     (shared with               syncOrgMembershipClaim   {status:'invited'}
                                     assignOrgAdmin)              trigger fires
                                        |                        automatically
                                        v                             |
                                  {status:'added'|'invited',          v
                                   orgId}                       {orgId, role, orgs}
                                                                  claim widened
```

### Recommended Project Structure

```
functions/src/
├── index.ts                    # + export { onboardOrganization, assignOrgAdmin, listOrganizations }
├── orgProvisioning.ts           # NEW — all three onCall handlers + shared assignAdminCore/resolveTargetUid
├── orgProvisioning.test.ts      # NEW — mocked Admin SDK/Auth unit tests (mirrors superAdminClaims.test.ts)
├── orgTemplateSeed.ts            # NEW — ported buildSuggestedTemplateEntries() + DEFAULT_ORG_SETTINGS (data-only, no Firestore)
├── orgTemplateSeed.test.ts       # NEW — pins the ported template byte-identical to the client's
├── superAdminClaims.ts          # UNCHANGED — the caller-gate pattern this phase mirrors
└── orgMembershipClaims.ts       # UNCHANGED — the trigger that reacts to members/{uid} writes; never called directly

src/components/admin/
├── OrganizationsTab.vue         # REPLACED (placeholder -> real UI per 74-UI-SPEC.md)
└── OrganizationsTab.test.ts      # NEW/UPDATED — component mount test
```

### Pattern 1: get-then-create transaction for `orgNames` uniqueness (R201/R202)

**What:** Replicate `claimOrgName`'s create-only semantics under the Admin SDK, which bypasses
`firestore.rules`' `allow create: if isOrgEditor(...); allow update, delete: if false;` guard on
`orgNames/{nameKey}` entirely.

**When to use:** Inside `onboardOrganization`, before any other write.

**Example (adapted from the existing `checkAndConsumeRateLimit` get-then-write transaction shape,
`functions/src/index.ts`):**
```typescript
// Source: functions/src/index.ts's checkAndConsumeRateLimit (existing transaction precedent),
// adapted for a get-then-create uniqueness check instead of get-then-increment.
async function claimOrgNameOrThrow(db: Firestore, nameKey: string, orgId: string): Promise<void> {
  const nameRef = db.collection("orgNames").doc(nameKey);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(nameRef); // ALL reads before ALL writes in a Firestore transaction
    if (snap.exists) {
      const existingOrgId = (snap.data() as { orgId?: string } | undefined)?.orgId;
      // Idempotent retry: if THIS same org already holds the name (a prior partial
      // run claimed it, then failed later), treat as already-claimed, not a collision.
      if (existingOrgId === orgId) return;
      throw new HttpsError("already-exists", "That church name is taken.");
    }
    tx.set(nameRef, { orgId });
  });
}
```

Firestore transactions require ALL `tx.get()` calls before ANY `tx.set()`/`tx.update()`/`tx.create()`
calls within the same transaction body — this is a hard SDK constraint, not a style choice
[CITED: firebase.google.com/docs/firestore/manage-data/transactions]. The idempotent
`existingOrgId === orgId` branch is what makes a retry-after-partial-failure safe: if `orgNames/{key}`
was created by a first attempt but the org/member writes that followed failed, calling
`onboardOrganization` again with the SAME `orgId`... **note:** a fresh call generates a NEW `orgId`
(auto-id), so this idempotency-by-orgId only helps if the planner threads the SAME orgId through a
retry (e.g. client resubmits with a previously-returned `orgId`) or if the whole onboarding sequence is
itself wrapped so a genuinely-failed org id is never reused. **Recommended resolution (planner
decision):** allocate the `organizations/{orgId}` doc ref FIRST (before the transaction), pass its
`.id` into the transaction as the `orgId` to bind — so a retry of the exact same `onboardOrganization`
call (same `name` + same generated `orgId`, if the client is coded to resubmit the SAME request) is
naturally idempotent; a brand-new call with a fresh auto-id is NOT idempotent with a prior failed
attempt (a stray unclaimed `organizations/{orgId}` doc with no matching `orgNames` entry could result
from a batch failure between steps 2 and 3 below) — see Pitfall 1 for the mitigation.

### Pattern 2: additive admin assignment, shared between both callables (R199, R203, R205, R206)

**What:** One internal function both `assignOrgAdmin` and `onboardOrganization`'s "assign first admin"
step call, so the additive `arrayUnion` guarantee and the no-account invite path can never drift into
two implementations.

**When to use:** Any time this phase writes a `members/{uid}` doc.

```typescript
// Source: pattern synthesized from setSuperAdminClaimHandler's getUserByEmail resolution
// (functions/src/superAdminClaims.ts) + src/stores/auth.ts's member/invite doc shapes (lines 377-483).
export type AssignAdminOutcome = { status: "added"; uid: string } | { status: "invited" };

async function assignAdminCore(
  db: Firestore,
  orgId: string,
  email: string,
): Promise<AssignAdminOutcome> {
  const normalizedEmail = email.trim().toLowerCase();

  let targetUid: string | undefined;
  try {
    const targetUser = await getAuth().getUserByEmail(normalizedEmail);
    targetUid = targetUser.uid;
  } catch (err) {
    // R205: getUserByEmail throws auth/user-not-found for a genuinely unknown
    // email [CITED: firebase.google.com Admin Auth API — FirebaseAuthError
    // codes]. Unlike setSuperAdminClaimHandler (which THROWS not-found because
    // granting super-admin to a nonexistent user is meaningless), this path
    // must NOT throw -- it falls through to the invite branch below. Any OTHER
    // error (network, malformed email causing auth/invalid-email, etc.) should
    // still surface as a genuine failure -- do not swallow every error into
    // "invited" silently (R202's "write error surfaces clearly" applies here
    // too). Planner: distinguish (err as {code?:string}).code === 'auth/user-not-found'
    // from other codes; only user-not-found takes the invite branch.
    if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
  }

  if (targetUid === undefined) {
    // R205: no dangling membership. Reuse the EXACT existing invite artifacts
    // src/stores/auth.ts's ensureUserDocument already reads on next sign-in
    // (lines 393-431): organizations/{orgId}/invites/{email} + inviteLookup/{email}.
    const batch = db.batch();
    batch.set(db.collection("organizations").doc(orgId).collection("invites").doc(normalizedEmail), {
      role: "editor",
      invitedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("inviteLookup").doc(normalizedEmail), {
      orgId,
      role: "editor",
    });
    await batch.commit();
    return { status: "invited" };
  }

  // R206: ADDITIVE. arrayUnion, never `set`/`update` with a literal array --
  // src/stores/auth.ts:426,455 OVERWRITE orgIds to a ONE-element array on
  // both its invite-acceptance and auto-create paths (a documented,
  // deliberately-unfixed client bug -- see Deferred Ideas). This callable must
  // not repeat that mistake, or a user already in another org loses it.
  const batch = db.batch();
  batch.set(
    db.collection("organizations").doc(orgId).collection("members").doc(targetUid),
    {
      role: "editor",
      joinedAt: FieldValue.serverTimestamp(),
      displayName: "", // Admin SDK has no access to the target's displayName without
                        // a separate getAuth().getUser(targetUid) call -- consider
                        // fetching it via the SAME getUserByEmail() result above
                        // (UserRecord.displayName) rather than a second Auth call.
      email: normalizedEmail,
    },
  );
  batch.update(db.collection("users").doc(targetUid), {
    orgIds: FieldValue.arrayUnion(orgId),
  });
  await batch.commit();
  // syncOrgMembershipClaim (orgMembershipClaims.ts) fires automatically on the
  // members/{uid} write above and recomputes both the primary {orgId, role}
  // claim (only if this IS the user's orgIds[0] -- i.e. it's their first org)
  // and the widened `orgs` map (always, via computeOrgsClaimForUid's
  // collectionGroup scan) -- this callable does NOT write claims itself.
  return { status: "added", uid: targetUid };
}
```

**`UserRecord.displayName`** (from the SAME `getAuth().getUserByEmail()` call, no extra Auth round
trip) should populate the member doc's `displayName` field to match the shape `src/stores/auth.ts`
writes (`firebaseUser.displayName ?? ''`) — the placeholder above deliberately marks this as a planner
decision point, not a settled answer.

### Pattern 3: `listOrganizations` — Admin SDK read + per-org `count()` aggregate (R196)

```typescript
// Source: firebase.google.com/docs/firestore/query-data/aggregation-queries (Admin SDK section)
// [CITED] — count() aggregate queries run server-side, no per-document read cost.
export interface OrgSummary {
  orgId: string;
  name: string;
  createdAt: unknown;
  memberCount: number;
}

async function listOrganizationsCore(db: Firestore): Promise<OrgSummary[]> {
  const orgsSnap = await db.collection("organizations").get();
  const summaries = await Promise.all(
    orgsSnap.docs.map(async (orgDoc) => {
      const countSnap = await orgDoc.ref.collection("members").count().get();
      const data = orgDoc.data() as { name?: string; createdAt?: unknown };
      return {
        orgId: orgDoc.id,
        name: data.name ?? "(unnamed)",
        createdAt: data.createdAt ?? null,
        memberCount: countSnap.data().count,
      };
    }),
  );
  return summaries;
}
```

`Promise.all` over N orgs, each issuing one `count()` aggregate query, is the recommended approach at
this project's current scale (a handful of orgs pre-v2.0) — mirrors the "proportionate at current
scale, documented scale-out path if it ever matters" posture `orgMembershipClaims.ts`'s
`computeOrgsClaimForUid` already uses for a structurally similar N-scan.

### Pattern 4: the caller gate (R200, R204) — verbatim mirror

```typescript
// Source: functions/src/superAdminClaims.ts's setSuperAdminClaimHandler (lines 106-128), copied
// verbatim into orgProvisioning.ts's three handlers -- do not paraphrase or "simplify" this gate.
if (!request.auth) {
  throw new HttpsError("unauthenticated", "Sign in required.");
}
if (request.auth.token.superAdmin !== true) {
  throw new HttpsError("permission-denied", "You must be a super-admin.");
}
const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
if (!callerDoc.exists) {
  throw new HttpsError("permission-denied", "You must be a super-admin.");
}
```

### Anti-Patterns to Avoid

- **Writing custom claims directly from these callables:** `syncOrgMembershipClaim` (Phase 73) already
  owns claim writes; a callable-side claim write would race the trigger and violate the established
  "source doc is truth, trigger is sole claim writer" indirection this codebase uses everywhere
  (`superAdminClaims.ts`'s own docblock states this explicitly for its own domain).
- **`users/{uid}.orgIds: [orgId]`** (overwrite) instead of `FieldValue.arrayUnion(orgId)` — this is the
  exact R206 violation; the client's own auto-create/invite-accept paths already do this wrong and are
  explicitly NOT being fixed this phase (see Deferred Ideas) — the server callable must not copy them.
- **Reading `members` docs individually to build `memberCount`** instead of `count()` — works but costs
  a full document read per member for a number nobody needs the underlying docs for.
- **Throwing `HttpsError('not-found', ...)` from `assignAdminCore`'s `getUserByEmail` catch** — this is
  correct for `setSuperAdminClaim` (granting super-admin to a phantom user is meaningless) but WRONG
  here: R205 requires a graceful invite path, not a thrown error.

## Runtime State Inventory

**Not applicable — this is a greenfield feature phase**, not a rename/refactor/migration. No existing
strings, doc names, task registrations, secret keys, or build artifacts are being renamed or moved.
Explicitly verified: no `organizations/*`, `members/*`, `orgNames/*`, or `users/*` field names change
shape in this phase — only NEW callables are added that write the SAME existing shapes the client
already produces.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Uniqueness enforcement under a rules-bypassing writer | A custom "check-if-any-org-has-this-name" scan/query | A `get`-then-`set` Firestore transaction on the single `orgNames/{nameKey}` doc | Firestore transactions give atomicity for free; a query-then-write without a transaction has a TOCTOU race between two concurrent onboarding calls for the same name. |
| Member counting | A denormalized counter field maintained by hand on every join/leave | `collection.count().get()` aggregate query | This is a one-shot admin-console read (R196 explicitly says "realtime is unnecessary") — a maintained counter is unnecessary complexity/drift-risk for a value fetched at most a few times per super-admin session. |
| Default service template content | Reinventing a "starter template" from scratch | Port `buildSuggestedTemplateEntries()`'s exact 9-entry output (see Code Examples) | R198 requires the seeded template to produce a service identical to what a normally-onboarded church gets from the SAME suggested-template button; any divergence would be a silent behavioral fork the client-side function already guards against forking twice. |
| Invite-for-no-account | A new "pending admin" doc type / new collection | The EXISTING `organizations/{orgId}/invites/{email}` + `inviteLookup/{email}` pair `src/stores/auth.ts`'s `ensureUserDocument` already reads on next sign-in | R205 explicitly asks to "reuse the app's existing invite path" — building a parallel mechanism would need its own sign-in-time consumer and duplicate logic that already works. |

**Key insight:** every "don't hand-roll" item above already has exactly one canonical implementation
somewhere in this codebase (client-side for uniqueness/invites, `index.ts` for the transaction shape).
The discipline this phase requires is porting/reusing those shapes byte-for-byte, not inventing
parallel ones — a divergence here (e.g. a slightly different `members/{uid}` doc shape) would silently
break `TeamView.vue` or `loadOrgContext`'s existing readers, which assume the shapes documented in
Pattern 2 above.

## Common Pitfalls

### Pitfall 1: A crash between the `orgNames` claim and the org/settings/admin writes strands a
nameless-but-claimed name (or a named-but-adminless org)

**What goes wrong:** `onboardOrganization` claims `orgNames/{key} = {orgId}` in the transaction, then
the function crashes (quota, timeout, deploy restart) before the `organizations/{orgId}` doc batch
commits. The name is now permanently claimed by an `orgId` that has no organization doc — and per
CONTEXT.md's locked ordering, retrying with the SAME church name must succeed without manual cleanup.
**Why it happens:** the transaction and the subsequent batch are two separate atomic units (a Firestore
transaction and a Firestore batch cannot span a Cloud Function invocation boundary safely if the
function itself dies mid-way — this is an accepted limitation of any two-phase write, not a bug in this
design).
**How to avoid:** allocate `organizations/{orgId}`'s doc reference (`db.collection('organizations').doc()`,
which mints an id client-side with no network round trip) BEFORE the transaction, thread that SAME
`orgId` into the `orgNames` claim, and make the retry path idempotent on `orgId` (Pattern 1's
`existingOrgId === orgId` branch). If the planner instead wants full atomicity, note Firestore
transactions CAN include non-`orgNames` writes in the SAME transaction (up to 500 writes per
transaction) — an alternative, arguably simpler design is to do the name-claim AND the org-doc-create
AND the settings write ALL inside ONE transaction (not split into transaction + separate batch), which
eliminates the crash window entirely at the cost of a slightly larger single transaction. **Recommend
the planner choose the single-transaction design** (name claim + org doc + settings all in one
`runTransaction`) over the two-phase transaction+batch split CONTEXT.md sketches, specifically because
it removes this pitfall's failure window rather than merely bounding it. The first-admin assignment
(which involves a `getUserByEmail` Auth API call, not a Firestore op) must stay OUTSIDE that
transaction — Firestore transactions cannot include external network calls inside their retryable body
without risking repeated Auth API hits on transaction contention retries — so the ordering is: (1) one
Firestore transaction = name claim + org doc + settings; (2) `assignAdminCore` runs after, as a
separate step. A failure in step 2 alone is naturally idempotent under Pattern 2 (re-running
`getUserByEmail` + the member-doc `set` is itself idempotent — a `set` on an existing member doc simply
overwrites with the same `role: 'editor'` fields).
**Warning signs:** an `orgNames/{key}` doc whose `orgId` has no matching `organizations/{orgId}` doc —
worth a one-off manual audit query if this is ever suspected in production, though no such state should
be reachable once the single-transaction design above is used.

### Pitfall 2: Forgetting the `arrayUnion` guarantee inside the shared helper, or bypassing the helper
entirely for the onboarding path

**What goes wrong:** if `onboardOrganization`'s "assign the first admin" step is implemented as its OWN
inline write (rather than calling the shared `assignAdminCore`) it can silently drift to a `set` instead
of `arrayUnion` on `orgIds` — exactly the bug this phase exists to NOT repeat. Since a brand-new org's
first admin will, in the overwhelming majority of cases, have `orgIds: []` beforehand, a `set`
vs `arrayUnion` bug would be invisible in every manual test (both produce `orgIds: [orgId]` for a
zero-org user) and would only surface the first time a super-admin assigns an EXISTING multi-org user
as a NEW org's first admin — a rare, easy-to-miss-in-manual-QA scenario.
**Why it happens:** onboarding's own copy-paste temptation ("the first admin, we don't need the
generic path") vs. the correctness-critical general path.
**How to avoid:** literally call `assignAdminCore(db, orgId, adminEmail)` from `onboardOrganization` —
CONTEXT.md's own "Claude's Discretion" section recommends exactly this, "no drift." Write a unit test
that asserts `onboardOrganization` for an admin who ALREADY belongs to another org preserves that
other org's membership (this is the single highest-value test in the whole phase).
**Warning signs:** two near-identical blocks of member-doc-writing code in `orgProvisioning.ts` is
itself the warning sign — if the planner's diff shows this, it is very likely to be wrong.

### Pitfall 3: `Firestore.collection.doc().collection()` id resolution and the account-resolution race
with concurrent onboarding of the SAME church name

**What goes wrong:** two super-admins (or one double-clicking) submit "Grace Church" simultaneously.
Both transactions read `orgNames/{key}` before either has written — Firestore transactions handle this
correctly (one commits, the other retries and sees the just-created doc, then throws `already-exists`)
PROVIDED the read (`tx.get`) and the existence check happen INSIDE the transaction body, not as a
separate `getDoc` before `runTransaction` is called.
**Why it happens:** an easy mistake is to pre-check "does this name exist?" with a plain `.get()`
outside a transaction (for a nicer error message before committing to a slow transaction) and then
still transact the actual write — leaving a race window between the pre-check and the transacted write.
**How to avoid:** Pattern 1's structure — the existence check and the claim happen in the SAME
transaction, no separate pre-check.
**Warning signs:** any code path that calls `orgNamesRef.get()` OUTSIDE `runTransaction` and then later
calls `runTransaction` for the actual write is this pitfall.

### Pitfall 4: `count()` aggregate queries unsupported/flaky in the local Firestore emulator during test
authoring

**What goes wrong:** `count()` aggregate queries were a newer Firestore feature; if `firebase-tools`'
bundled emulator version has any gap in aggregate-query support, `npm run test:rules`-style
emulator-backed tests (not the mocked-Admin-SDK unit tests) could behave unexpectedly.
**Why it happens:** aggregate query emulator support landed after plain query support historically.
**How to avoid:** this project's `firebase-tools` is `15.27.0` [VERIFIED: `npx firebase --version`],
comfortably recent enough that `count()` aggregate queries are supported
[CITED: firebase.google.com/docs/firestore/query-data/aggregation-queries — no minimum-version caveat
listed for current releases]. The planner's unit tests for `listOrganizationsCore` should mock
`collection.count().get()` directly (no emulator dependency) per the Testing section below — this
pitfall is a residual risk only if the planner ALSO writes an emulator-integration test for
`listOrganizations`, which is not required by this phase's Validation Architecture (unit tests with a
mocked Admin SDK are the primary vehicle).
**Warning signs:** an emulator-backed test for `listOrganizations` returning `memberCount: undefined`
or throwing on `.count()` — if this happens, fall back to `.collection('members').get()` then
`.size` for that one query (functionally identical, marginally less efficient, zero risk).

### Pitfall 5: `getUserByEmail`'s error code check is brittle if matched on `.message` instead of `.code`

**What goes wrong:** the Admin Auth SDK's `FirebaseAuthError` for "no such user" is reliably
`err.code === 'auth/user-not-found'`
[CITED: firebase.google.com Admin Auth API error-code reference]. `setSuperAdminClaimHandler`'s
existing code (functions/src/superAdminClaims.ts:148-154) does NOT check the code at all — it treats
ANY thrown error from `getUserByEmail` as not-found. Copying that pattern verbatim into
`assignAdminCore` would silently route a transient Auth API outage into the "no account, invite" path
instead of a genuine failure — swallowing a real error as if it were R205's graceful case.
**Why it happens:** `setSuperAdminClaimHandler` can afford to be sloppy here because BOTH its own
outcomes (not-found error vs. any other error) result in the SAME user-facing behavior (a thrown
`HttpsError`) — there was never a behavioral fork to get wrong. `assignAdminCore` has two DIFFERENT
outcomes (invite vs. rethrow), so the distinction newly matters.
**How to avoid:** explicitly check `(err as {code?: string})?.code === 'auth/user-not-found'` before
taking the invite branch; rethrow (or wrap in a generic `HttpsError('internal', ...)`) for any other
code, satisfying R202's "write error surfaces a clear error" for this path too.
**Warning signs:** a test that mocks `getUserByEmail` to reject with a non-`user-not-found` error (e.g.
a generic network error) and asserts the callable still returns `{status: 'invited'}` — if such a test
exists and passes, the distinction was NOT implemented; the correct test asserts a thrown error in that
case.

## Code Examples

### The ported Suggested Template (R198) — data-only, no `buildSlots`/VW-typing needed

`buildSuggestedTemplateEntries()` in `src/utils/slotTypes.ts` derives from `buildSlots('1-2-2-3')`, but
`ServiceTemplateEntry` only ever carries `{ id, kind, section?, body?, label? }` — never VW typing. For
the `'1-2-2-3'` progression, `buildSlots` produces this FIXED 9-entry sequence (traced from
`src/utils/slotTypes.ts` lines 319-371's `defaultSectionForPosition`/`buildSlots`):

| Position | Kind | Section |
|---|---|---|
| 0 | SONG | worship |
| 1 | SCRIPTURE | worship |
| 2 | SONG | worship |
| 3 | PRAYER | worship |
| 4 | SCRIPTURE | worship |
| 5 | SONG | worship |
| 6 | SONG | worship |
| 7 | MESSAGE | message |
| 8 | SONG | sending |

```typescript
// Source: functions/src/orgTemplateSeed.ts (NEW) — ported from
// src/utils/slotTypes.ts's buildSuggestedTemplateEntries()/buildSlots('1-2-2-3').
// This is a DATA-ONLY port (unlike serviceRoles.ts's algorithmic port): every
// section value below is a FIXED constant for the '1-2-2-3' progression, so no
// defaultSectionForPosition/PROGRESSION_SLOT_TYPES logic needs porting at all --
// just the resulting 9-row table, pinned by a test asserting it matches the
// client's own buildSuggestedTemplateEntries() output (kind+section only; ids
// are fresh crypto.randomUUID() on both sides and are NOT compared).
export interface PortedTemplateEntry {
  id: string;
  kind: "SONG" | "SCRIPTURE" | "PRAYER" | "MESSAGE" | "ANNOUNCEMENTS" | "MISC" | "HYMN" | "IMPORTED";
  section?: "pre-service" | "worship" | "message" | "sending" | "post-service"; // match src/types/service.ts's ServiceSection exactly
}

const SUGGESTED_TEMPLATE_SHAPE: Array<Pick<PortedTemplateEntry, "kind" | "section">> = [
  { kind: "SONG", section: "worship" },
  { kind: "SCRIPTURE", section: "worship" },
  { kind: "SONG", section: "worship" },
  { kind: "PRAYER", section: "worship" },
  { kind: "SCRIPTURE", section: "worship" },
  { kind: "SONG", section: "worship" },
  { kind: "SONG", section: "worship" },
  { kind: "MESSAGE", section: "message" },
  { kind: "SONG", section: "sending" },
];

export function buildSuggestedTemplateEntries(): PortedTemplateEntry[] {
  return SUGGESTED_TEMPLATE_SHAPE.map((entry) => ({ id: crypto.randomUUID(), ...entry }));
}
```

**Planner must confirm `ServiceSection`'s exact string union** (`src/types/service.ts`) before
finalizing this table — this research traced the VALUES from `defaultSectionForPosition`'s literal
return statements (`'worship'`, `'message'`, `'sending'`) but did not exhaustively confirm no OTHER
section value (e.g. `'pre-service'`, added per Phase 21's docblock reference, or `'post-service'`,
added per Phase 29's docblock reference) appears in `buildSlots`'s output — none do, per the traced
source, but the planner's implementation step should re-read `src/types/service.ts`'s
`ServiceSection` type directly rather than trust this transcription alone.

### The seeded `OrgSettings` write (R197)

```typescript
// Source: src/types/organization.ts's DEFAULT_ORG_SETTINGS (ported verbatim, same
// data-only reasoning as the template above -- these are plain object-literal
// defaults with zero Firestore/Auth dependencies, safe to duplicate rather than
// import (functions/ cannot import from src/ -- no @/ alias, separate tsconfig).
const DEFAULT_ORG_SETTINGS_PORT = {
  aiEnabled: true,
  pcEnabled: true,
  vwModeEnabled: true,
  defaultServiceTemplate: [] as PortedTemplateEntry[], // overridden below
  bibleVersion: "NLT" as const,
  slideTypography: { fontFamily: "Inter", fontWeight: 400, fontScale: "md" as const },
  messaging: { enabled: false, lockNotifyDefault: false, reminderEnabled: false, reminderDaysBefore: 7 },
  timezone: "America/Chicago",
};

// Inside onboardOrganization, after the name-claim transaction succeeds:
const settings = { ...DEFAULT_ORG_SETTINGS_PORT, defaultServiceTemplate: buildSuggestedTemplateEntries() };
// organizations/{orgId} = { name, createdAt: FieldValue.serverTimestamp(), createdBy: callerUid, settings }
```

This matches `organizations/{orgId}.settings` — confirmed the storage location by direct read of
`src/types/organization.ts`'s `Organization.settings` field and `auth.ts::loadOrgContext`'s read path
(`orgSnap.data().settings`), NOT a separate settings subdocument.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Client writes `organizations/*`/`members/*` directly, gated only by `firestore.rules` | Admin-SDK-gated onCall callables for privileged cross-org operations | This phase (v2.0) | The FIRST time this codebase writes another org's `members/*` on behalf of a different user — every prior write to `organizations/*`/`members/*` in this codebase (org founding, invite acceptance) has been the acting user writing THEIR OWN membership. This phase's `assignOrgAdmin` is structurally new: a super-admin writing a membership doc for SOMEONE ELSE'S uid. |

**Deprecated/outdated:** nothing in this domain is deprecated — this phase is additive, building on
Phase 73's already-current multi-org claim widening.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `getAuth().getUserByEmail()` rejects with `err.code === 'auth/user-not-found'` specifically (not a different code/shape) for a genuinely unknown email | Pattern 2 / Pitfall 5 | If wrong, the invite-vs-error branch mis-routes; low risk — this is a long-stable, widely-documented Admin Auth error code, and the existing `setSuperAdminClaimHandler` in this same codebase already relies on `getUserByEmail` throwing on not-found (just doesn't discriminate the code), corroborating the throw-on-not-found behavior itself. |
| A2 | `count()` aggregate queries are fully supported by the pinned `firebase-tools@15.27.0` local emulator with no special config | Pitfall 4 | Low risk (recent tooling); if wrong, the fallback (`.get().size`) is a one-line swap with no other design impact. |
| A3 | `ServiceSection`'s string union contains exactly `'pre-service' \| 'worship' \| 'message' \| 'sending' \| 'post-service'` (or a superset/subset thereof) — not independently re-confirmed by reading `src/types/service.ts` directly in this research pass | Code Examples (ported template) | If the union differs, the ported `PortedTemplateEntry['section']` type would mismatch — low risk since only 3 of these 5 values (`worship`/`message`/`sending`) are actually used by the ported table; planner should re-read the type before finalizing. |

**If empty:** N/A — table populated above; all three items are LOW risk with clear low-cost fallbacks,
not blocking to planning.

## Open Questions

1. **Should `onboardOrganization`'s name-claim + org-doc + settings write be ONE transaction, or a
   transaction (name only) followed by a separate batch (org + settings), as CONTEXT.md's prose
   literally sketches?**
   - What we know: CONTEXT.md's decision text says "claim the orgNames entry (transaction) FIRST...
     then batch-write org doc + settings; then run the admin assignment" — describing three sequential
     steps, with only the FIRST as an explicit transaction.
   - What's unclear: whether "transaction FIRST, then batch" was meant as a strict two-phase-commit
     description or just informal ordering language; CONTEXT.md's own invariant ("a retry after fixing
     the input succeeds without manual cleanup, and a duplicate name never creates a second org") is
     satisfiable either way, but a SINGLE transaction covering name+org+settings removes Pitfall 1's
     crash window entirely, which the two-phase description does not.
   - Recommendation: the planner should default to ONE transaction (name claim + org doc + settings,
     all inside `runTransaction`) since Firestore transactions support up to 500 writes and this is
     well under that ceiling, and it strictly dominates the two-phase design on correctness with no
     added complexity. If the planner prefers to literally follow CONTEXT.md's two-step prose instead,
     Pitfall 1's mitigation (thread a pre-allocated `orgId` through both steps, make the retry
     idempotent on that same `orgId`) must be implemented explicitly.

2. **Exact `memberDoc.displayName` source for `assignOrgAdmin`'s existing-account branch.**
   - What we know: `src/stores/auth.ts`'s equivalent client write uses
     `firebaseUser.displayName ?? ''` (the SIGNED-IN user's own displayName at the moment they create
     their membership). The super-admin-driven callable has no "signed-in user" context for the
     TARGET — only whatever `getAuth().getUserByEmail()` or `getAuth().getUser(uid)` returns
     (`UserRecord.displayName`, which may be `undefined` if the target has never set one, e.g. an
     email/password account with no profile name).
   - What's unclear: whether an empty-string `displayName` is acceptable UX (TeamView.vue presumably
     renders SOME fallback for a blank name) or whether the planner should backfill it lazily elsewhere.
   - Recommendation: use `targetUser.displayName ?? ''` from the SAME `getUserByEmail()` call already
     made (no extra Auth round trip) — matches the existing empty-string-fallback convention exactly.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (functions workspace) / Vitest (root, for the Vue component) |
| Config file | `functions/package.json`'s `"test": "vitest run"` (functions); root `vite.config.ts` (component) |
| Quick run command | `cd functions && npx vitest run orgProvisioning.test.ts orgTemplateSeed.test.ts` |
| Full suite command | `cd functions && npm test` (functions); `npx vitest run` (root, includes `OrganizationsTab.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R196 | `listOrganizations` returns `[{orgId,name,createdAt,memberCount}]` for N orgs | unit (mocked Admin SDK) | `npx vitest run orgProvisioning.test.ts -t "listOrganizations"` | ❌ Wave 0 |
| R196 | `OrganizationsTab.vue` renders loading/empty/error/populated table states | component | `npx vitest run OrganizationsTab.test.ts` | ❌ Wave 0 |
| R197 | `onboardOrganization` writes `organizations/{orgId}` with `{name, createdAt, createdBy}` + deep-merged `OrgSettings` | unit | `npx vitest run orgProvisioning.test.ts -t "onboardOrganization"` | ❌ Wave 0 |
| R198 | Seeded `defaultServiceTemplate` matches client's `buildSuggestedTemplateEntries()` shape (kind+section, order) | unit | `npx vitest run orgTemplateSeed.test.ts` | ❌ Wave 0 |
| R199 | Onboarding assigns first admin at editor via the SAME `assignAdminCore` `assignOrgAdmin` uses | unit | `npx vitest run orgProvisioning.test.ts -t "first admin"` | ❌ Wave 0 |
| R200/R204 | Both privileged callables reject `!request.auth`, reject `token.superAdmin !== true`, reject a missing `superAdmins/{callerUid}` doc | unit | `npx vitest run orgProvisioning.test.ts -t "caller gate"` | ❌ Wave 0 |
| R201 | Duplicate `normalizeOrgName` collision throws `already-exists` and creates no org | unit | `npx vitest run orgProvisioning.test.ts -t "duplicate name"` | ❌ Wave 0 |
| R202 | A retry after a name-collision failure with a DIFFERENT (available) name succeeds; a retry of the exact same request is idempotent | unit | `npx vitest run orgProvisioning.test.ts -t "retry"` | ❌ Wave 0 |
| R203 | `assignOrgAdmin` writes `members/{uid}` `{role:'editor', joinedAt, displayName, email}` for an existing account | unit | `npx vitest run orgProvisioning.test.ts -t "assignOrgAdmin existing"` | ❌ Wave 0 |
| R205 | `assignOrgAdmin` for an unknown email writes `invites/{email}` + `inviteLookup/{email}` and returns `{status:'invited'}`, never throws, never writes a `members/*` doc | unit | `npx vitest run orgProvisioning.test.ts -t "no account"` | ❌ Wave 0 |
| R206 | Assigning a SECOND org to a user who already has `orgIds: ['orgA']` results in `orgIds: ['orgA','orgB']` (via `arrayUnion`, mocked and asserted on the exact SDK call args) | unit | `npx vitest run orgProvisioning.test.ts -t "additive"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd functions && npx vitest run orgProvisioning.test.ts orgTemplateSeed.test.ts`
  plus `npx vitest run OrganizationsTab.test.ts` from repo root once the component exists.
- **Per wave merge:** `cd functions && npm test` (full functions suite) + `npx vitest run` (root suite,
  per this repo's CLAUDE.md — bare `npx vitest run` is the correct root command, excludes
  `src/rules.test.ts` and `render-service/**` by design).
- **Phase gate:** both full suites green, plus `npm run type-check` (per CLAUDE.md — the `vue-tsc
  --build` form, not the narrower `-p tsconfig.app.json`), before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `functions/src/orgProvisioning.ts` + `orgProvisioning.test.ts` — does not exist yet, covers
      R196/R197/R199/R200/R201/R202/R203/R204/R205/R206.
- [ ] `functions/src/orgTemplateSeed.ts` + `orgTemplateSeed.test.ts` — does not exist yet, covers R198.
- [ ] `src/components/admin/OrganizationsTab.test.ts` — does not exist yet (the placeholder has no
      test file); covers R196's UI states per `74-UI-SPEC.md`.
- [ ] Framework install: none — Vitest is already configured on both sides (functions + root).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Every callable requires `request.auth` (Firebase ID token) — reject `unauthenticated` otherwise (Pattern 4). |
| V3 Session Management | no | No new session mechanism introduced — reuses Firebase Auth's existing ID-token/refresh-token model unchanged. |
| V4 Access Control | yes | Dual super-admin re-verification (token claim AND fresh Firestore re-read of `superAdmins/{callerUid}`) — defense-in-depth against a stale/forged token claim, mirroring `setSuperAdminClaimHandler`'s existing documented rationale. Additionally: `assignOrgAdmin`'s target `orgId` is caller-supplied but the WRITE authority comes entirely from the super-admin gate, not from any per-org membership check — this is intentional (a super-admin can assign to ANY org by design), but means a compromised super-admin token is a full-platform-admin-assignment primitive; this is the existing accepted risk shape of the `superAdmin` claim (same blast radius as `setSuperAdminClaim` itself). |
| V5 Input Validation | yes | `name` non-empty + `normalizeOrgName`; `email`/`adminEmail` format validation (mirror `ConfigurationTab.vue`'s existing `isValidEmailFormat`) before any Admin SDK call; `orgId` existence is implicitly checked (a `members/{uid}` write under a nonexistent `organizations/{orgId}` succeeds in Firestore — subcollections don't require a parent doc to exist — so the planner should decide whether `assignOrgAdmin` should explicitly reject an `orgId` with no matching `organizations/{orgId}` doc, to avoid silently creating an orphaned membership under a typo'd id; recommended: add this check). |
| V6 Cryptography | no | No cryptographic operations introduced — `crypto.randomUUID()` (template entry ids) is a non-cryptographic uniqueness id generator, same use as the existing client-side `buildSuggestedTemplateEntries()`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via forged/stale custom claim | Elevation of Privilege | Dual caller re-verification (token + fresh Firestore doc read) — Pattern 4, already the codebase's established mitigation for every super-admin-gated callable. |
| TOCTOU race on `orgNames` uniqueness (two concurrent onboards of the same name) | Tampering | Firestore transaction with the existence check INSIDE the transaction (Pattern 1 / Pitfall 3) — never a pre-check `.get()` outside the transaction. |
| Orphaned/dangling membership for a mistyped or nonexistent `orgId` | Tampering / Denial of Service (data integrity) | Explicit `organizations/{orgId}` existence check before writing `members/{uid}` (V5 note above) — not currently called out in CONTEXT.md, flagged here as a planner discretion item. |
| Silent invite-branch masking of a real Auth API failure | Repudiation (a real error looks like a successful "invited" outcome) | Discriminate `err.code === 'auth/user-not-found'` from any other error code before taking the invite branch — Pitfall 5. |
| A user already in another org silently losing that membership on a new-org assignment | Tampering (data-integrity regression) | `FieldValue.arrayUnion`, never `set`/overwrite, on `users/{uid}.orgIds` — Pattern 2 / Pitfall 2, R206's core guarantee. |

## Sources

### Primary (HIGH confidence)
- `functions/src/superAdminClaims.ts` (direct file read) — the caller-gate pattern (Pattern 4) and
  `getUserByEmail` resolution idiom.
- `functions/src/orgMembershipClaims.ts` (direct file read) — confirms the claim-sync trigger's
  existence, scope, and that this phase's callables must not write claims directly.
- `functions/src/index.ts` (direct file read, `checkAndConsumeRateLimit`/`checkAndConsumeOrgEmailQuota`
  sections) — the get-then-write Firestore transaction precedent (Pattern 1).
- `src/stores/auth.ts` (direct file read, lines 370-483) — exact `organizations`/`members`/`invites`/
  `inviteLookup`/`orgIds` write shapes, and the confirmed OVERWRITE bug in the existing client flow
  (R206's motivating contrast).
- `src/utils/orgName.ts` (direct file read) — `normalizeOrgName`/`claimOrgName`'s exact semantics.
- `src/types/organization.ts` (direct file read) — `OrgSettings`, `DEFAULT_ORG_SETTINGS`, confirmed
  storage location (`organizations/{orgId}.settings`, not a subdocument).
- `src/utils/slotTypes.ts` (direct file read, lines 300-459) — `buildSlots`/`buildSuggestedTemplateEntries`
  full derivation, traced to the exact 9-entry `{kind, section}` table ported in Code Examples.
- `functions/src/serviceRoles.ts` (direct file read) — the established client-util-port precedent this
  phase's `orgTemplateSeed.ts` follows.
- `firestore.rules` (direct file read, lines 1-115, 315-410) — confirmed no rules change needed; every
  relevant collection (`organizations`, `members`, `invites`, `inviteLookup`, `orgNames`) already has a
  rule shape the Admin SDK simply bypasses.
- `functions/src/superAdminClaims.test.ts` + `functions/src/index.test.ts` (direct file read) — the
  established Vitest mocking patterns for `getAuth`/`getFirestore`/`runTransaction`/callable handlers.
- `74-CONTEXT.md`, `74-UI-SPEC.md` (direct file read) — the locked decisions and the fully-specced UI
  this research grounds against.

### Secondary (MEDIUM confidence)
- [Summarize data with aggregation queries | Firestore | Firebase](https://firebase.google.com/docs/firestore/query-data/aggregation-queries) — `count()` aggregate query API confirmation (Pattern 3).
- [Transactions and batched writes | Firestore | Firebase](https://firebase.google.com/docs/firestore/manage-data/transactions) — the reads-before-writes transaction constraint (Pattern 1).

### Tertiary (LOW confidence)
- WebSearch-derived confirmation of `auth/user-not-found` as the Admin Auth error code for
  `getUserByEmail` on an unknown address — well-established, widely-documented behavior, but not
  independently cross-checked against the specific `firebase-admin@13.10.0` release notes this session
  (Assumption A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, both libraries already pinned and in active use.
- Architecture: HIGH — every pattern is a direct port/reuse of code already read in this codebase, not
  a novel design.
- Pitfalls: HIGH — pitfalls 1-3, 5 derived from direct tracing of this codebase's own transaction/claim
  patterns and CONTEXT.md's stated invariants, not speculative.

**Research date:** 2026-08-21
**Valid until:** 30 days (stable internal patterns; no fast-moving external dependency)
