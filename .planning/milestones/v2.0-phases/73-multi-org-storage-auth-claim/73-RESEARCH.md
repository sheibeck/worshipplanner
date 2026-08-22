# Phase 73: Multi-Org Storage Auth Claim - Research

**Researched:** 2026-08-21
**Domain:** Firebase custom auth claims, Storage security rules, Cloud Firestore triggers, owner-run backfill scripts
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Claim shape — ADDITIVE, not a replacement (R207, R211)**
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

**Claim-writer widening (R208) — `functions/src/orgMembershipClaims.ts`**
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

**storage.rules (R209)**
- Add the `orgs`-map arm to `isOrgMemberByClaim` (keeping the legacy arm for R211). Update the module comment
  (currently documents the single-primary-org "KNOWN LIMITATION") to reflect the widening.
- **Prove with genuine emulator tests:** a multi-org user (claim `orgs` carries orgA + orgB) is ALLOWED to
  read/write Storage under BOTH `orgs/orgA/**` and `orgs/orgB/**`; a user whose `orgs` lacks orgC is DENIED
  under `orgs/orgC/**` (cross-org DENY). Also keep a legacy-claim ALLOW case (only `orgId`/`role` set) proving
  R211 backward-compat, and keep the existing "claim-only membership (no firestore.exists fallback)" guard
  intact — do NOT reintroduce a cross-service `firestore.exists()` (inert in the Storage emulator; that is the
  documented deny-everyone hazard).

**Backfill (R210) — extend/mirror `functions/src/backfillOrgClaims.ts`**
- Idempotent, **dry-run by default**, `--apply`-gated, owner-run Node script (same shape as the existing
  `backfillOrgClaims.ts` / `bootstrapSuperAdmin.ts`) that recomputes the widened claim (adds `orgs`,
  preserves primary + `superAdmin`) for every existing user via `collectionGroup('members')`. Skip-if-already
  -matching for idempotency. It shares the same decision logic as the trigger (extend `decideMembershipClaim`
  or a shared builder) so the two can never drift — the established D-11 pattern.

**Deploy (HAND OVER — v2.0 grant)**
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

### Deferred Ideas (OUT OF SCOPE)
- Organizations tab UI, org onboarding, and admin assignment → **Phase 74** (which depends on this widened
  claim being in place).
- Retiring the legacy primary `orgId`/`role` claim keys once every session is backfilled → a future cleanup,
  out of scope now (keeping them is harmless and preserves client compatibility).

### Explicitly NOT in this phase (Phase Boundary, from CONTEXT.md)
The Organizations tab UI, org onboarding, or admin-assignment callables (all Phase 74). This phase is the
auth-claim + rules + backfill substrate those depend on. No client-app behavior change is intended for
today's single-org users. **Do NOT change** `firestore.rules` membership (`isOrgMember` =
`exists(members/uid)`, claim-independent) or `src/stores/auth.ts` (keeps reading the unchanged primary
`orgId`/`role`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| R207 | The org-membership custom auth claim carries all of a user's organizations and their per-org roles (not just the primary org), in a shape both `firestore.rules` and `storage.rules` can read. | Standard Stack size math (Architectural Responsibility Map confirms `firestore.rules` needs no claim at all); Pattern 1/Code Examples give the exact `orgs` map shape and write path |
| R208 | The claim-writer that recomputes the claim on any `members/*` write derives the full multi-org set from the user's memberships and preserves the `superAdmin` claim via the shared merge helper (R175) — widening the claim never wipes super-admin, and vice-versa. | Pattern 1 (recompute source — proves `orgIds` is unsound for this, not just "possibly stale"), Pattern 2 (why an unfiltered collectionGroup scan is the correct query shape), Pattern 3 (merge-not-replace write path), Pitfalls 1–2, Validation Architecture test map |
| R209 | `storage.rules`' `isOrgMemberByClaim` checks the requested `orgId` against the full multi-org claim set, so a user in multiple orgs retains Storage read/write on every org — proven by genuine multi-org ALLOW and cross-org DENY emulator tests. | Code Examples (`isOrgMemberByClaim` widened rule + emulator claim-minting), Pitfall 4 (null-guard ordering), Security Domain threat table |
| R210 | An idempotent, dry-run-by-default, owner-run backfill recomputes the widened claim for all existing users, mirroring `backfillOrgClaims.ts`, so current users get the new claim shape without a manual per-user step. | Pattern 4 (group-by-uid-once backfill efficiency), Open Question 2 (mergeAndSetCustomClaims switch), Validation Architecture test map |
| R211 | The widened claim shape is backward-compatible during rollout — existing single-org sessions keep working before the backfill runs (old/new shapes both tolerated by the rules), so there is no Storage-access gap while the claim is being migrated. | Code Examples (legacy-arm rule + legacy-claim ALLOW test), Runtime State Inventory (canonical question answered), Architecture diagram (legacy arm shown alongside new arm) |
</phase_requirements>

## Summary

This phase widens the existing single-primary-org `{orgId, role}` custom auth claim (built in Phase 40) to
also carry a full `orgs: {[orgId]: role}` map, so `storage.rules` can authorize a multi-org user on every
org they belong to, not just their primary. The codebase already contains every pattern this phase needs —
`mergeAndSetCustomClaims`/`clearClaimKeys` (R175 merge-preserving claim writers), a single shared
`decideMembershipClaim` decision function used by both the live trigger and the owner-run backfill, and a
`collectionGroup('members')` enumeration idiom already proven in `backfillOrgClaims.ts`. This is a
well-bounded, self-analog phase: extend four files in place (`orgMembershipClaims.ts`,
`backfillOrgClaims.ts`, `storage.rules`, `src/storage.rules.test.ts`) plus their tests and the deploy
runbook. No new npm package is introduced.

The single sharpest correctness risk in this phase is **not** the one CONTEXT.md names first (delete
staleness) — investigation in this research surfaced a **second, worse staleness bug in the same
family**: `src/stores/auth.ts`'s invite-acceptance and org-auto-create paths both **overwrite**
`users/{uid}.orgIds` to a fresh one-element array (`orgIds: [inviteOrgId]` / `orgIds: [newOrgId]`) rather
than appending to it. This means `orgIds` is not merely stale-on-delete — it is **structurally incapable
of ever listing more than one org**, even for a user who legitimately joins a second org while keeping
their first. `orgIds` therefore cannot be used as any part of the multi-org recompute, not even as a
starting candidate list. The only authoritative source for "which orgs does this uid currently belong to"
is a direct read of the actual `organizations/*/members/{uid}` documents — this research confirms (via
Google's own docs) that a Firestore `collectionGroup` query **cannot** filter by document ID equality
across different parent paths without already knowing the full path, so the correct, in-scope
implementation is an unfiltered `collectionGroup('members').get()` scan filtered client-side to
`doc.id === uid`, reusing the exact `resolveOrgId` structural guard `backfillOrgClaims.ts` already has.
Firestore's query model is strongly consistent by default, so a trigger reading this collection group
immediately after its own triggering write commits is safe — no eventual-consistency race to guard
against.

**Primary recommendation:** Widen the claim additively (`orgs` map alongside the untouched primary
`orgId`/`role`), recompute `orgs` on every `members/*` write via an unfiltered
`collectionGroup('members')` scan filtered to the written uid (never via `users/{uid}.orgIds`, which is
proven unreliable for both delete AND join events), route every write through
`mergeAndSetCustomClaims`, add an `orgs[orgId] != null` OR arm to `storage.rules`' `isOrgMemberByClaim`
alongside the untouched legacy arm, and extend `backfillOrgClaims.ts` to add `orgs` idempotently by
grouping its already-fetched `collectionGroup('members')` snapshot by uid in memory (avoiding N redundant
re-scans for an N-org user).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-org claim computation (recompute `orgs` on every membership write) | API / Backend (Cloud Function trigger) | Database / Storage (Firestore read source) | `syncOrgMembershipClaim` is a Firestore-triggered Cloud Function; it is the sole writer of the claim, per the existing R175 shared-helper pattern |
| Multi-org Storage authorization | Database / Storage (Storage security rules) | — | `storage.rules` is evaluated entirely inside the Storage service; it can only read `request.auth.token`, never call out to Firestore (that cross-service call is the documented, now-removed hazard) |
| Firestore membership authorization | Database / Storage (Firestore security rules) | — | `firestore.rules`' `isOrgMember` uses `exists(members/uid)` directly against Firestore — unaffected by this phase, explicitly out of scope |
| Claim backfill for existing users | API / Backend (owner-run Node CLI script, Admin SDK) | — | Not a deployed function; a one-off script sharing the trigger's decision logic, run with elevated Admin credentials outside the request path |
| Active-org context (client) | Browser / Client (`src/stores/auth.ts`) | — | Reads only the unchanged primary `claims.orgId`/`claims.role`; explicitly out of scope, zero client change |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | `^13.10.0` (already pinned, `functions/package.json`) [VERIFIED: functions/package.json] | Server-side claim reads/writes (`getAuth().setCustomUserClaims`), Firestore Admin SDK reads (`collectionGroup`) | Already the sole Admin SDK in this codebase; no reason to introduce anything else for this phase |
| `firebase-functions` | `^7.2.5` (already pinned) [VERIFIED: functions/package.json] | `onDocumentWritten` Firestore trigger (v2) | Already used by `syncOrgMembershipClaim`; no change needed |
| `@firebase/rules-unit-testing` | already a devDependency (root `package.json`) [VERIFIED: existing `src/storage.rules.test.ts` imports it] | Emulator-backed ALLOW/DENY tests for `storage.rules` | Existing pattern this phase extends, not replaces |

No new package is required. This phase is a pure extension of existing, already-approved dependencies.

### Supporting

None — no new supporting library is needed for this phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Unfiltered `collectionGroup('members')` scan, filtered client-side by `doc.id === uid` | A redundant `uid` field on every member doc + `collectionGroup('members').where('uid', '==', uid)` with a collection-group field-override index | The filtered-query approach is the textbook Firestore scale-out pattern, but it requires (a) a schema change to every member-doc write site (`TeamView.vue`, `auth.ts`'s invite-accept/org-create paths, and Phase 74's not-yet-built onboarding/assignment callables), (b) a `firestore.indexes.json` `fieldOverrides` entry with `queryScope: COLLECTION_GROUP`, and (c) a data migration to add the field to every existing member doc. All three are out of this phase's stated boundary (CONTEXT.md forbids touching `src/stores/auth.ts`; touching `TeamView.vue`'s member-doc shape is likewise out of scope). Defer to a future phase if platform growth (Phase 74 onboards "every church on the platform") makes the unfiltered scan's read cost a real concern — flagged in Open Questions below. |
| `orgIds`-based candidate list, cross-checked against live `members` docs | Trust `users/{uid}.orgIds` as an authoritative or even a candidate list | Investigation in this research (not merely CONTEXT.md's delete-staleness note) proved `orgIds` is **overwritten**, not appended, on both invite-acceptance and org-auto-create (`src/stores/auth.ts:426,455`) — it can never even list a second org, regardless of delete/join ordering. Any design that reads `orgIds` for anything beyond the existing unchanged "primary org" computation is unsound. |

**Installation:** none — no `npm install` needed this phase.

**Version verification:** `firebase-admin` and `firebase-functions` versions above were read directly from
`functions/package.json` in this repo (not re-fetched from the registry) since they are pre-existing,
already-installed dependencies this phase does not touch. `@firebase/rules-unit-testing`'s exact pinned
version was not independently re-verified (out of scope — used read-only, unchanged).

## Package Legitimacy Audit

**Not applicable — this phase introduces no new npm packages.** Every dependency it touches
(`firebase-admin`, `firebase-functions`, `@firebase/rules-unit-testing`) is a pre-existing, already-vetted
dependency from Phase 40 and earlier. No `gsd-tools query package-legitimacy check` run was needed.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │  organizations/{orgId}/members/{uid} write   │
                         │  (create / update / delete — any org,        │
                         │   primary or non-primary)                    │
                         └───────────────────┬───────────────────────────┘
                                              │ onDocumentWritten trigger
                                              ▼
                         ┌─────────────────────────────────────────────┐
                         │  syncOrgMembershipClaim (Cloud Function)      │
                         │  functions/src/orgMembershipClaims.ts         │
                         │                                                │
                         │  1. Primary decision (UNCHANGED):             │
                         │     read users/{uid}.orgIds[0] → set/clear/   │
                         │     skip the top-level {orgId, role} keys     │
                         │                                                │
                         │  2. NEW — orgs-map decision (every write,     │
                         │     regardless of primary/non-primary):       │
                         │     collectionGroup('members').get()          │
                         │     → filter docs where doc.id === uid        │
                         │     → resolveOrgId() structural guard         │
                         │     → build { [orgId]: normalizedRole }       │
                         │     (NEVER reads users/{uid}.orgIds — proven  │
                         │     unreliable for join AND delete events)    │
                         │                                                │
                         │  3. Merge both decisions into ONE patch,      │
                         │     write via mergeAndSetCustomClaims /       │
                         │     clearClaimKeys (claimsHelpers.ts) —       │
                         │     preserves superAdmin (R175/R208)          │
                         └───────────────────┬───────────────────────────┘
                                              │ setCustomUserClaims
                                              ▼
                         ┌─────────────────────────────────────────────┐
                         │  Firebase Auth — user's ID token custom claims│
                         │  { orgId, role, orgs: {...}, superAdmin? }    │
                         └───────────────────┬───────────────────────────┘
                                              │ token minted / refreshed
                                              ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │                                                                   │
        ▼                                                                   ▼
┌───────────────────────┐                              ┌───────────────────────────────┐
│  storage.rules          │                              │  src/stores/auth.ts (UNCHANGED)│
│  isOrgMemberByClaim(id)  │                              │  reads claims.orgId/claims.role│
│                          │                              │  for the ACTIVE org only —     │
│  orgs[orgId] != null     │  ← NEW arm (R209)             │  zero change (R211 by          │
│    OR                    │                              │  construction)                 │
│  orgId==id && role!=null │  ← legacy arm (R211 compat)   │                                 │
└───────────────────────┘                              └───────────────────────────────┘

        ┌─────────────────────────────────────────────────────────────────┐
        │  backfillOrgClaims.ts (owner-run, offline, dry-run/--apply)       │
        │  ONE collectionGroup('members').get() fetch → group docs by uid  │
        │  in memory → per uid, call the SAME decision logic as the        │
        │  trigger (imports decideMembershipClaim — D-11 no-drift) →       │
        │  mergeAndSetCustomClaims, skip-if-already-matching (idempotent)  │
        └─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new files or directories — this phase extends four existing files in place:

```
functions/src/
├── orgMembershipClaims.ts       # widen: decideMembershipClaim + syncOrgMembershipClaimHandler
├── orgMembershipClaims.test.ts  # extend: multi-org set, delete-recompute, join-recompute, superAdmin
├── claimsHelpers.ts             # UNCHANGED — reuse mergeAndSetCustomClaims/clearClaimKeys as-is
├── backfillOrgClaims.ts         # extend: group-by-uid orgs recompute, mergeAndSetCustomClaims
└── backfillOrgClaims.test.ts    # extend: multi-org backfill, idempotency across two runs

storage.rules                    # widen: isOrgMemberByClaim OR arm + module comment
src/storage.rules.test.ts        # extend: multi-org ALLOW, cross-org DENY, legacy-claim ALLOW
functions/DEPLOY-ORG-CLAIMS.md   # append: widened-claim deploy order + backfill invocation
```

### Pattern 1: Recompute the `orgs` map from live membership docs, never from `orgIds`

**What:** On every `organizations/{orgId}/members/{uid}` write (create, update, OR delete — not just the
primary org), independently re-derive the user's full current org set by scanning
`collectionGroup('members')` and filtering to `doc.id === uid`, applying the same structural guard
`backfillOrgClaims.ts` already has. Never read `users/{uid}.orgIds` for this purpose.

**When to use:** Any time the claim needs to reflect "every org this user currently belongs to" — both the
live trigger (per-write) and the backfill (once per uid, batched from its own existing snapshot).

**Why `orgIds` cannot be trusted (verified against this repo, not merely CONTEXT.md's note):**
- **Delete staleness (documented in-code, `orgMembershipClaims.ts:115-119`):** `TeamView.vue`'s
  `deleteDoc` on a member removal does not update `users/{uid}.orgIds` — a removed org lingers in
  `orgIds` after deletion.
- **Join/overwrite staleness (newly found this research, `src/stores/auth.ts:426,455`):**
  ```typescript
  // invite acceptance — OVERWRITES orgIds, does not append:
  batch.update(userRef, { orgIds: [inviteOrgId] })
  // auto-create-org-if-none — same overwrite pattern:
  batch.update(userRef, { orgIds: [newOrgId] })
  ```
  `orgIds` is therefore never longer than one element in the current codebase, regardless of how many
  real memberships a user has accumulated. It is not a partial/stale list — it is structurally incapable
  of representing "belongs to 2+ orgs" at all. This is the strongest possible argument for CONTEXT.md's
  instruction to derive `orgs` from the actual `members` documents, not from `orgIds`.

**Example:**
```typescript
// Source: pattern derived from functions/src/backfillOrgClaims.ts:71-109 (in-repo, existing code)
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

function resolveOrgId(memberDoc: QueryDocumentSnapshot): string | undefined {
  const orgDoc = memberDoc.ref.parent.parent;
  if (!orgDoc) return undefined;
  if (orgDoc.parent.id !== "organizations") return undefined;
  return orgDoc.id;
}

async function computeOrgsClaimForUid(uid: string): Promise<Record<string, OrgMembershipRole>> {
  const snapshot = await getFirestore().collectionGroup("members").get();
  const orgs: Record<string, OrgMembershipRole> = {};
  for (const memberDoc of snapshot.docs) {
    if (memberDoc.id !== uid) continue;
    const orgId = resolveOrgId(memberDoc);
    if (orgId === undefined) continue;
    const role = (memberDoc.data() as { role?: string } | undefined)?.role;
    if (role === undefined) continue;
    orgs[orgId] = role === "admin" ? "editor" : (role as OrgMembershipRole);
  }
  return orgs;
}
```
This runs *after* the triggering write has committed (Cloud Firestore `onDocumentWritten` fires
post-commit), and Firestore's default read/query mode is **strongly consistent** [CITED:
docs.cloud.google.com/firestore/native/docs/understand-reads-writes-scale] — so a delete just committed by
this same trigger's own event is guaranteed to already be absent from this scan. No eventual-consistency
race to guard against.

### Pattern 2: Collection-group document-ID filtering does NOT work across parents — verified negative

**What:** `getFirestore().collectionGroup('members').where(FieldPath.documentId(), '==', uid)` cannot be
used to filter a collection-group query to a specific leaf document ID unless the FULL document path
(including the unknown parent org ID) is supplied as the value. This is a documented Firestore limitation,
not a workaround gap [CITED: github.com/firebase/firebase-admin-node#1966; cloud.google.com Firestore
collection-group-query docs].

**When to use:** This confirms the correct implementation is an **unfiltered** `collectionGroup('members')`
fetch with client-side filtering by `doc.id === uid` — exactly the pattern `backfillOrgClaims.ts` already
uses for its own full-population scan. This is proportionate at this project's documented current scale
(2–3 active users as of Phase 40's DEPLOY-ORG-CLAIMS.md; Phase 74 will grow this, tracked as an Open
Question below).

**Anti-pattern to avoid:** Do not attempt `where(FieldPath.documentId(), '==', uid)` on a
`collectionGroup` query expecting it to match regardless of parent org — it will silently return zero
results (or require constructing full paths you don't have, defeating the purpose).

### Pattern 3: Merge, never replace or blanket-clear, when writing to the claim

**What:** Every write this phase adds must route through `claimsHelpers.ts`'s existing
`mergeAndSetCustomClaims(uid, patch)` (a shallow merge on top of the CURRENT claims) or
`clearClaimKeys(uid, keys)` (deletes only the named keys). Never call
`getAuth().setCustomUserClaims(uid, someObject)` directly with a full replacement object, and never pass
`null` unless every claim key is genuinely gone.

**When to use:** All three call sites this phase touches: the trigger's set branch (extend the merged
patch to include `orgs`), the trigger's clear branch (clear `orgId`/`role` on a primary-membership delete
while still separately merging a recomputed `orgs` value — the primary clearing and the orgs recompute are
independent operations that must not conflate), and the backfill's write call (currently a bare
`setCustomUserClaims(uid, decision.claims)` at `backfillOrgClaims.ts:116` — **this call site must switch
to `mergeAndSetCustomClaims`** once the claim it writes can coexist with a `superAdmin` grant, otherwise
the backfill would silently wipe a super-admin's claim the first time it processes their account).

**Example — combining primary + orgs into one Admin SDK call, minimizing race window and API calls:**
```typescript
// Source: pattern extending functions/src/claimsHelpers.ts's existing mergeAndSetCustomClaims/clearClaimKeys
// (both already imported by orgMembershipClaims.ts)
switch (decision.action) {
  case "set": {
    // decision.claims now includes { orgId, role, orgs } — ONE merge call carries all three,
    // same mechanism, zero new call sites, still preserves superAdmin.
    await mergeAndSetCustomClaims(uid, { ...decision.claims });
    break;
  }
  case "clear-primary-keep-orgs": {
    // Primary membership deleted, but the user still belongs to other orgs (orgs is non-empty).
    // Two independent effects in ONE getUser()->setCustomUserClaims() round trip:
    // delete orgId/role, but overwrite orgs with the freshly recomputed (possibly non-empty) map.
    const user = await getAuth().getUser(uid);
    const current = { ...((user.customClaims as Record<string, unknown>) ?? {}) };
    delete current.orgId;
    delete current.role;
    current.orgs = decision.orgs; // {} is valid too, but see the "orgs empty" case below
    await getAuth().setCustomUserClaims(uid, current);
    break;
  }
}
```
Combining reduces both cost (fewer Admin SDK calls per write) and the documented residual same-uid race
window already called out in `claimsHelpers.ts`'s own "KNOWN LIMITATION" comment (concurrent
`syncOrgMembershipClaim`/`syncSuperAdminClaim` firing for the same uid) — every extra sequential
`getUser`→`setCustomUserClaims` round trip widens that window, however slightly. This is a recommended
refinement, not a hard requirement of the phase's correctness — the planner may choose two sequential
calls (simpler, mirrors existing code shape more closely) if preferred; either is correct as long as both
routes merge rather than replace.

### Pattern 4: Backfill groups its own single fetch by uid — avoid N redundant re-scans

**What:** `backfillOrgClaims.ts` already fetches `collectionGroup('members')` exactly once at the top of
`backfillOrgMembershipClaims` (line 96). Its existing per-doc loop processes one membership doc at a time.
Naively calling a per-uid `computeOrgsClaimForUid` helper (Pattern 1 above) inside that same loop would
re-run a full collection scan once per membership doc — for a user in 3 orgs, that is 3 redundant
identical scans producing the same result.

**When to use:** The backfill only. Group `snapshot.docs` by `uid` (via `resolveOrgId` + `doc.id`) once,
in memory, before the per-uid decision loop — reusing the SAME single fetch already at line 96. This
keeps the backfill's cost at exactly one Firestore read operation regardless of how many orgs any given
user belongs to.

**Anti-pattern to avoid:** Calling the trigger's live per-write `computeOrgsClaimForUid` helper from
inside the backfill's per-membership-doc loop — correct in isolation, but wasteful (and, if the two
decision paths ever diverge to fix that waste independently, reintroduces the D-11 drift risk CONTEXT.md
explicitly warns against). Prefer grouping the backfill's own snapshot instead.

### Anti-Patterns to Avoid

- **Reading `users/{uid}.orgIds` for the `orgs` map, in any form** — proven unreliable for both delete
  and join events in this exact codebase (see Pattern 1). Not merely "the sharpest risk" as CONTEXT.md
  frames it — it is actively wrong today, independent of this phase's changes.
- **Reintroducing a cross-service `firestore.exists()` read into `storage.rules`** — this is the exact,
  documented (`CLAUDE.md`, `storage.rules` module comment) production incident this project has already
  suffered once. `firestore.exists()` is inert in the Storage emulator, so a regression here would be
  emulator-invisible until it reaches production. `src/storage.rules.test.ts`'s existing static-assertion
  guard test must keep passing unchanged.
- **A bare `setCustomUserClaims(uid, decision.claims)` replacement call anywhere** — silently wipes
  `superAdmin` (or any future unrelated claim) the moment it coexists with this write path. Every write
  site must route through `mergeAndSetCustomClaims`/`clearClaimKeys`.
- **A second, independent implementation of "what orgs does this user belong to"** — the whole point of
  D-11 (shared `decideMembershipClaim`) is that trigger and backfill can never drift. Extend the one
  function/helper; do not duplicate the collectionGroup-scan logic in `backfillOrgClaims.ts` separately
  from `orgMembershipClaims.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Merge-preserving custom claim writes | A bespoke read-modify-write wrapper around `setCustomUserClaims` | `claimsHelpers.ts`'s existing `mergeAndSetCustomClaims`/`clearClaimKeys` | Already built, already tested, already the R175 fix for exactly this hazard class — a second implementation would reopen the same bug it closed |
| Deciding what a user's claim should be | A second decision function inside `backfillOrgClaims.ts` | Extend the shared `decideMembershipClaim` in `orgMembershipClaims.ts` and import it | D-11 no-drift pattern already established in this exact codebase for exactly this reason |
| Multi-org membership enumeration | A denormalized `orgIds` array kept in sync by hand | Direct `organizations/*/members/{uid}` document reads via `collectionGroup` | This research proves `orgIds` is unmaintainable as a multi-value list under the current write paths — building more logic on top of it (e.g. "fix" it to append) is itself out of this phase's scope and would touch `src/stores/auth.ts`, which CONTEXT.md forbids |

**Key insight:** every primitive this phase needs already exists in this codebase from Phase 40 and Phase
68's R175 fix. The engineering risk here is not missing tooling — it is correctness of the *recompute
source*, which this research resolves definitively against `orgIds` and in favor of live `members`
document reads.

## Runtime State Inventory

This phase widens an existing runtime claim shape and ships a backfill — the canonical rename/migration
questions apply.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Firebase Auth custom claims on every existing user's account (`{orgId, role}`, optionally `superAdmin: true`) — the widened shape adds `orgs` alongside, never replacing | Data migration: the owner-run backfill (R210) adds `orgs` to every existing account; no code-only fix suffices since claims are server-stored, not derived at read time |
| Live service config | None — no external service (n8n, Datadog, etc.) holds this claim; it lives entirely inside Firebase Auth, which this phase's own tooling (trigger + backfill) fully controls | None |
| OS-registered state | None | None — verified, this phase touches no OS-level registration |
| Secrets/env vars | None — no secret or env var references the claim shape by name | None |
| Build artifacts | None — `functions/lib/` (the `tsc` build output the backfill CLI runs from) is regenerated by `npm run build` before every backfill invocation per the existing runbook; no stale-artifact risk beyond the normal "rebuild before running" step already documented in `functions/DEPLOY-ORG-CLAIMS.md` | None beyond the existing `npm run build` step |

**The canonical question, answered:** after this phase's code ships, the ONLY runtime state still carrying
the old (primary-only) claim shape is **already-issued ID tokens and not-yet-backfilled Auth accounts**.
The dry-run/`--apply` backfill (R210) is exactly the migration step that closes this gap for existing
accounts; the backward-compat legacy arm in `storage.rules` (R211) is exactly the mechanism that keeps
not-yet-refreshed tokens working during the gap.

## Common Pitfalls

### Pitfall 1: Treating `users/{uid}.orgIds` as a multi-org source (worse than CONTEXT.md's own framing)
**What goes wrong:** A recompute that reads `orgIds` (even just as a candidate list to verify against) will
silently miss any org beyond the user's most recently created/accepted one, because `orgIds` is
**overwritten**, not appended, by both `src/stores/auth.ts:426` (invite acceptance) and `:455` (auto
org-create).
**Why it happens:** The array LOOKS like a membership list, and it originally was one when every user was
single-org (Phase 40's stated invariant, verified true then). Its write-site semantics silently changed
scope the moment ANY user could plausibly join a second org — which is exactly what Phase 74 introduces.
**How to avoid:** Never read `orgIds` for anything except the existing, unchanged "primary org" claim
computation. Derive the full `orgs` map exclusively from live `organizations/*/members/{uid}` documents.
**Warning signs:** A test asserting `orgs` after a SECOND org join shows only one entry, or a real user who
joins org B while remaining a member of org A loses Storage access to org A the next time their claim is
recomputed.

### Pitfall 2: Conflating the primary-clear and orgs-recompute write paths
**What goes wrong:** If a primary-membership delete blanket-clears the WHOLE claims object (or even just
blanket-clears `orgs` alongside `orgId`/`role`), a user who is deleted from their PRIMARY org but remains a
member of a SECOND org loses Storage access to that second org too — even though their membership there is
untouched.
**Why it happens:** The existing pre-widening code (`clearClaimKeys(uid, ORG_CLAIM_KEYS)`) only ever had
two keys to worry about and clearing both together was always correct. Widening naively by adding `orgs`
to the same clear call reintroduces exactly the bug this phase exists to fix, on the delete path.
**How to avoid:** On any membership delete, always recompute `orgs` from the live surviving `members`
documents (Pattern 1) and write that value independently of whether the primary keys are being cleared.
**Warning signs:** A test where a two-org user's PRIMARY org membership is deleted, and the resulting claim
still (correctly) carries the second org in `orgs` but the primary `orgId`/`role` keys are gone — write this
test explicitly; it is the single strongest correctness proof for R208.

### Pitfall 3: Reintroducing a cross-service Storage-rule membership check
**What goes wrong:** Any temptation to "double-check" the widened claim arm against Firestore inside
`storage.rules` (e.g. `firestore.exists(...)`) reproduces the documented production incident this project
already suffered — such a check is inert in the Storage emulator, so it would ship untested and undetected
until production.
**Why it happens:** It can feel more "correct" to cross-validate a security-critical claim against the
source-of-truth Firestore document. It is not, in this codebase's specific context — the Storage emulator's
limitation makes any such check untestable, and the existing static-assertion guard test exists precisely
to catch a well-intentioned reintroduction.
**How to avoid:** Add ONLY the new `orgs[orgId] != null` OR arm and keep the legacy arm; do not add any
`get()`/`exists()` call anywhere in `storage.rules`.
**Warning signs:** `src/storage.rules.test.ts`'s existing "claim-only membership" static-assertion test
(the one that greps for `firestore.exists(` and asserts it is absent) fails.

### Pitfall 4: Indexing into an absent `orgs` claim key without a null guard
**What goes wrong:** `request.auth.token.orgs[orgId]` on a legacy (pre-backfill) token with no `orgs` key
at all evaluates `orgs` to `null` first; indexing directly into `null` is an evaluation error in Firestore's
rules language, which the engine treats as a hard DENY rather than gracefully returning `false` — exactly
the same class of bug this codebase's own `firestore.rules` comment warns about (`isOrgEditor`'s
`get().data.get('role', '')` guard).
**Why it happens:** It is easy to write `token.orgs[orgId] != null` as a single expression without
realizing the indexing happens before the null-check.
**How to avoid:** Guard with `&&` short-circuit evaluation, checking `orgs != null` (or `'orgs' in
request.auth.token`) BEFORE indexing: `request.auth.token.orgs != null && request.auth.token.orgs[orgId]
!= null`.
**Warning signs:** A legacy-claim test (no `orgs` key at all) that should ALLOW via the backward-compat arm
instead fails with a rules evaluation error, not a clean deny.

## Code Examples

### `storage.rules` — widened `isOrgMemberByClaim` (R209/R211)
```
// Source: extends the existing function at storage.rules:28-32 (in-repo)
function isOrgMemberByClaim(orgId) {
  return request.auth != null
    && (
      // NEW — multi-org arm (R209): the claim's orgs map carries a role for this org.
      (request.auth.token.orgs != null && request.auth.token.orgs[orgId] != null)
      // Legacy arm (R211 backward-compat): pre-widening / not-yet-backfilled tokens
      // still carry only the primary orgId/role — kept unchanged, unconditionally ORed.
      || (request.auth.token.orgId == orgId && request.auth.token.role != null)
    );
}
```

### `src/storage.rules.test.ts` — minting a multi-org claim (existing idiom, in-repo)
```typescript
// Source: extends the existing testEnv.authenticatedContext(...) idiom already used
// throughout src/storage.rules.test.ts — the second argument is passed straight
// through to the emulator's mock JWT as custom claims.

// Multi-org ALLOW — both orgs readable/writable:
const multiOrgCtx = testEnv.authenticatedContext('userA', {
  orgId: 'orgA',
  role: 'editor',
  orgs: { orgA: 'editor', orgB: 'viewer' },
})

// Cross-org DENY — orgC is absent from the orgs map:
const crossOrgCtx = testEnv.authenticatedContext('userA', {
  orgId: 'orgA',
  role: 'editor',
  orgs: { orgA: 'editor', orgB: 'viewer' },
})
// ...attempt a write under orgs/orgC/** with crossOrgCtx, assertFails

// Legacy-claim ALLOW (R211) — no orgs key at all:
const legacyCtx = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
// ...attempt a write under orgs/orgA/** with legacyCtx, assertSucceeds
```

### Static-assertion guard extension — proving the `orgs` claim is actually read
```typescript
// Source: extends the existing static-assertion pattern at
// src/storage.rules.test.ts:210-236 (codeOnly = comments-stripped rule source)
expect(codeOnly).toContain('request.auth.token.orgs');
// Existing negative assertions (must still pass unchanged):
expect(codeOnly).not.toContain('firestore.exists(');
expect(codeOnly).not.toContain('isOrgMemberByFirestore');
expect(codeOnly).not.toContain('/databases/(default)/documents/');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Claim carries only the user's primary org (`{orgId, role}`) | Claim additionally carries a full `orgs` map for every org the user belongs to | This phase (v2.0 Phase 73) | `storage.rules` can authorize a genuinely multi-org user on every org, not just their primary — the hard prerequisite Phase 74's admin-assignment flow needs |
| `storage.rules`' Firestore-fallback arm covered non-primary orgs | No fallback exists (removed at Phase 40 Deploy 2, 2026-08-12) — the multi-org `orgs` claim arm is the ONLY mechanism that can ever cover a non-primary org again | 2026-08-12 (fallback removed) → 2026-08-21 (this phase closes the resulting gap) | Between those two dates, a genuinely multi-org user's non-primary-org Storage access was a documented, deliberately-tracked gap (backlog 999.5) — this phase closes it |

**Deprecated/outdated:** The `functions/DEPLOY-ORG-CLAIMS.md` runbook's "Known limitation #1 — Multi-org
users" section, and `storage.rules`' own module comment describing the "KNOWN LIMITATION (D-01/D-04)",
both explicitly document the exact gap this phase closes — both must be updated, not merely left as
historical color, since a reader following either document today would believe the gap still exists.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firestore auto-generated document IDs (used for `orgId` throughout this app, via `doc(collection(db, 'organizations'))`) are 20 characters | Standard Stack size math | Low — the byte-size computation in this research used 20-char IDs and stayed well under the 1000-byte cap through 30 simulated orgs; even CONTEXT.md's more conservative 28-char estimate would still fit comfortably at realistic org counts (a handful per user), so this assumption does not change the recommendation |
| A2 | `@firebase/rules-unit-testing`'s `authenticatedContext(uid, claims)` passes the `claims` object through unchanged as the emulator's mock custom claims, with no size/shape validation beyond what the rules themselves enforce | Code Examples / Pattern for minting multi-org test claims | Low — this is the exact mechanism the existing, passing test suite already exercises for `{orgId, role}`; adding an `orgs` key follows the identical, already-proven code path |

**If this table is empty:** N/A — two low-risk assumptions logged above; neither changes the phase's
recommended design if wrong.

## Open Questions

1. **Does the unfiltered `collectionGroup('members')` scan remain proportionate as Phase 74 onboards many
   orgs?**
   - What we know: at today's documented scale (2–3 active users per `functions/DEPLOY-ORG-CLAIMS.md`),
     a full collection-group scan on every single membership write is trivially cheap. Phase 74's own goal
     is explicitly "list every organization on the platform" and onboard new churches — the population this
     scan reads will grow over the platform's lifetime.
   - What's unclear: at what member-document count this per-write full scan becomes a real cost/latency
     concern (this project has an entire prior milestone, v1.8, devoted to exactly this class of unbounded
     cost surface).
   - Recommendation: ship the unfiltered-scan design now (in-scope, proportionate, and the only design that
     doesn't require touching out-of-scope files per CONTEXT.md). Leave a code comment (mirroring
     `backfillOrgClaims.ts`'s own D-10 scale note) flagging that a `uid`-field + collection-group-index
     redesign (see Alternatives Considered) is the documented scale-out path if a future cost audit finds
     this scan material. Do not build the scale-out path speculatively now.

2. **Should the backfill's write call site switch from bare `setCustomUserClaims` to
   `mergeAndSetCustomClaims`?**
   - What we know: the current call (`backfillOrgClaims.ts:116`) is a bare `setCustomUserClaims(uid,
     decision.claims)` — safe today only because, at the time it was written, no account could plausibly
     carry both an org-membership claim AND a `superAdmin` claim simultaneously in a way this script would
     visit. Phase 68 (super-admin) has since shipped, so that assumption may no longer hold for every
     account in the population.
   - What's unclear: whether any current owner/super-admin account has ever had `backfillOrgClaims.ts` run
     against it since Phase 68 shipped (if not, the bug is latent, not yet triggered).
   - Recommendation: switch this call site to `mergeAndSetCustomClaims` as part of this phase's changes
     regardless — it is strictly safer, costs nothing, and closes a plausible R208/R175 violation before it
     can ever fire. Write an explicit backfill test proving a super-admin account survives a backfill run
     with its `superAdmin: true` claim intact.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Functions build + backfill CLI | ✓ | v22.23.2 | — |
| npm | Functions build | ✓ | 10.9.8 | — |
| firebase-tools CLI | Emulator + eventual owner deploy | ✓ | 15.27.0 | — |
| Firestore emulator | `vitest.rules.config.ts` rules suite | ✓ (already running at time of research, port 8080) | — | `npm run test:rules` starts its own if none is running |
| Storage emulator | `src/storage.rules.test.ts` | ✓ (already running at time of research, port 9199) | — | Same as above |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none — both emulators were already running during this research
session; per `CLAUDE.md`, if a plan/execute session finds them already running, use
`npx vitest run --config vitest.rules.config.ts` directly rather than `npm run test:rules` (which fails
with "port taken" against an already-running emulator).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (functions suite: `vitest.config.ts`, node env; rules suite: `vitest.rules.config.ts`, node env against live emulators) |
| Config file | `functions/vitest.config.ts` (functions unit tests); `vitest.rules.config.ts` (repo root, rules emulator tests) |
| Quick run command (functions) | `cd functions && npx vitest run src/orgMembershipClaims.test.ts src/backfillOrgClaims.test.ts` |
| Quick run command (rules, emulator already running) | `npx vitest run --config vitest.rules.config.ts` |
| Full suite command (functions) | `cd functions && npm run test` |
| Full suite command (rules) | `npm run test:rules` (starts its own emulator via `firebase emulators:exec` — fails with "port taken" if one is already running; use the direct `npx vitest run --config vitest.rules.config.ts` form against an already-running emulator instead, per `CLAUDE.md`) |
| Type gate | `npm run type-check` (the `vue-tsc --build` form — required per `CLAUDE.md`, not the narrower `-p tsconfig.app.json` form) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R207 | Claim carries all of a user's orgs + roles in a shape both rules surfaces can read | unit | `cd functions && npx vitest run src/orgMembershipClaims.test.ts` | ✅ extend existing |
| R208 | Claim-writer recomputes the full set on any `members/*` write; preserves `superAdmin` via the shared merge helper; widening never wipes `superAdmin` and vice versa | unit | `cd functions && npx vitest run src/orgMembershipClaims.test.ts` | ✅ extend existing |
| R208 (delete-staleness + join-overwrite proof) | A removed org disappears from `orgs`; a newly-joined second org appears in `orgs` without dropping the first (proving `orgIds`-overwrite doesn't leak into the claim) | unit | `cd functions && npx vitest run src/orgMembershipClaims.test.ts` | ✅ extend existing — NEW test cases required |
| R209 | `storage.rules`' `isOrgMemberByClaim` checks the requested `orgId` against the full multi-org claim set — multi-org ALLOW on both orgs, cross-org DENY | emulator (rules) | `npx vitest run --config vitest.rules.config.ts` | ✅ extend existing |
| R210 | Idempotent, dry-run/`--apply`, owner-run backfill recomputes the widened claim for every existing user | unit | `cd functions && npx vitest run src/backfillOrgClaims.test.ts` | ✅ extend existing |
| R211 | Old single-org claim shape still works during rollout (backward-compat legacy arm) | emulator (rules) | `npx vitest run --config vitest.rules.config.ts` | ✅ extend existing — NEW legacy-claim ALLOW test required |

### Sampling Rate
- **Per task commit:** `cd functions && npx vitest run src/orgMembershipClaims.test.ts src/backfillOrgClaims.test.ts` (functions changes); `npx vitest run --config vitest.rules.config.ts` (rules changes) — emulator must already be running or use `npm run test:rules`.
- **Per wave merge:** `cd functions && npm run test` (full functions suite) AND the rules suite above AND `npm run type-check` from repo root.
- **Phase gate:** all three green before `/gsd-verify-work` — plus a manual read of the new test assertions against R208's superAdmin-preservation and delete/join-recompute cases specifically, since those are the phase's highest-risk correctness claims and easiest to accidentally assert-away with a loose mock.

### Wave 0 Gaps

None — existing test infrastructure (`orgMembershipClaims.test.ts`'s mocking seams,
`backfillOrgClaims.test.ts`'s `statefulAuth`/`mockFirestore` helpers, `src/storage.rules.test.ts`'s
emulator harness) fully covers what this phase needs to extend. No new framework, config, or shared
fixture install is required.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — Firebase Auth handles sign-in; this phase only widens a claim already attached to an authenticated session |
| V3 Session Management | No | Unchanged — ID token lifetime/refresh behavior is untouched; the existing `refreshOrgClaim` retry-window logic in `src/stores/auth.ts` is explicitly out of scope |
| V4 Access Control | Yes | Firebase custom claims (server-signed JWT, Admin-SDK-only write path) + `storage.rules` claim-based authorization — never a client-writable field |
| V5 Input Validation | Yes (indirect) | Role values are normalized server-side (`admin` → `editor`) before ever entering the claim; the claim's shape is fully server-computed, never accepts client input directly |
| V6 Cryptography | No (delegated) | Firebase-managed JWT signing (RS256) for the ID token itself — never hand-rolled; unaffected by this phase's claim-content change |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client forging/widening its own `orgs` claim | Elevation of Privilege | Custom claims are only ever writable server-side via the Admin SDK (`getAuth().setCustomUserClaims`); no Cloud Function or rule ever accepts a client-supplied claim value. Unaffected by this phase — the widened claim inherits the same write-path guarantee. |
| Legacy-arm confusion allowing cross-org access | Tampering | The legacy arm only ever matches the token's OWN primary `orgId`/`role` — it cannot be tricked into matching a different org, since `orgId == orgId` compares against the SAME requested path parameter as the new arm. Proven by the required cross-org DENY test (R209). |
| Reintroducing a cross-service `firestore.exists()` Storage-rule check | Tampering / availability (deny-everyone) | Documented production incident in `CLAUDE.md`; guarded by `src/storage.rules.test.ts`'s existing static-assertion test, which must keep passing unchanged after this phase's edit. |
| Concurrent `syncOrgMembershipClaim` + `syncSuperAdminClaim` writes for the same uid racing and one clobbering the other's read-then-write | Tampering (residual, pre-existing, NOT introduced by this phase) | Documented, accepted residual risk in `claimsHelpers.ts`'s own comment (no compare-and-swap primitive available in the Admin SDK). This phase's Pattern 3 (combining primary + orgs into one call) *narrows* this window slightly but does not eliminate it — do not attempt to "fix" it in this phase; it is explicitly out of scope, accepted risk, revisit only if a real collision is observed. |

## Sources

### Primary (HIGH confidence)
- `functions/src/orgMembershipClaims.ts`, `functions/src/claimsHelpers.ts`, `functions/src/backfillOrgClaims.ts`, `functions/src/backfillOrgClaims.test.ts`, `functions/src/orgMembershipClaims.test.ts`, `storage.rules`, `src/storage.rules.test.ts`, `firestore.rules`, `src/stores/auth.ts`, `functions/DEPLOY-ORG-CLAIMS.md` — all read directly from the working tree in this session
- `.planning/phases/73-multi-org-storage-auth-claim/73-CONTEXT.md`, `73-PATTERNS.md` — this phase's own locked decisions and pattern map
- [Control Access with Custom Claims and Security Rules — firebase.google.com](https://firebase.google.com/docs/auth/admin/custom-claims) — 1000-byte custom-claims payload limit, `auth/claims-too-large` error
- [Understand reads and writes at scale — Firestore Native mode, docs.cloud.google.com](https://docs.cloud.google.com/firestore/native/docs/understand-reads-writes-scale) — strong-consistency default for Firestore reads/queries

### Secondary (MEDIUM confidence)
- [Firestore collection group queries with document ID in where clause — github.com/firebase/firebase-admin-node#1966](https://github.com/firebase/firebase-admin-node/issues/1966) — confirms `FieldPath.documentId()` equality filtering does not work across collection-group parents without the full path

### Tertiary (LOW confidence)
- None used unverified in a load-bearing way for this research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every recommendation is grounded in already-installed, already-verified libraries in this repo
- Architecture: HIGH — every pattern is a direct extension of existing, tested, in-repo code (D-11 shared decision function, R175 merge helpers, existing collectionGroup idiom); the `orgIds`-overwrite finding is independently verified by reading `src/stores/auth.ts`, not merely inferred from CONTEXT.md
- Pitfalls: HIGH — all four pitfalls are grounded in either in-repo code comments/tests or independently-verified Firestore/Storage-rules behavior (null-indexing evaluation errors, collection-group doc-ID filtering limitation)

**Research date:** 2026-08-21
**Valid until:** 2026-09-20 (30 days — this is a stable, internal-codebase-grounded research; the only external facts cited — the 1000-byte claims cap and Firestore's strong-consistency default — are long-stable Firebase/GCP platform behaviors, not fast-moving library APIs)
