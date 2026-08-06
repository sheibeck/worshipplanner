# Phase 40: Custom Auth Claim for Org Membership - Research

**Researched:** 2026-08-06
**Domain:** Firebase custom auth claims, dual-read Storage Rules migration, Cloud Functions Firestore triggers, `@firebase/rules-unit-testing`
**Confidence:** HIGH — every load-bearing mechanism (claim injection into mock tokens, rules `||` short-circuiting, trigger API shape, `setCustomUserClaims` signature, 1000-byte limit, 1-hour token lifetime) was verified directly against this repo's installed package type definitions and/or fetched official Firebase documentation in this session, not recalled from training data.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Claim Shape and Byte Budget**
- The claim carries the PRIMARY org only — `orgIds[0]`. This mirrors what `loadOrgContext`
  actually does today (`auth.ts:86-99` reads the `orgIds` array and picks `ids[0]`). Bounded and far
  under the 1000-byte custom-claims limit.
- Shape is `{ orgId, role }`. Role is included because the success criterion names it and it is
  nearly free once the claim exists.
- Readable key names (`orgId`, `role`), not abbreviated. With a single org there is no byte
  pressure that would justify cryptic keys.
- A user belonging to more than one org: the claim carries `orgIds[0]`; the Firestore-membership
  branch of the dual-read continues to cover the others. This is a documented known limitation,
  not an oversight — record it explicitly in the plan and in code comments. Do not silently produce a
  claim that is wrong for multi-org users.

**Rollout and Token Propagation**
- Dual-read is `OR`, never `AND`. The rule passes if the claim matches or the existing
  Firestore membership check passes. An `AND` would lock out every member whose token predates the
  claim. This is non-negotiable.
- Force a token refresh with `getIdToken(true)` so a member does not wait up to a full
  max-token-lifetime (1 hour) for the claim to propagate.
- The forced refresh fires on org-context load — the one path every authenticated session already
  runs. Not sign-in only, which would strand a member whose claim changes mid-session.
- The claim is also set on invite acceptance, not by backfill alone. A brand-new member must not
  wait for a backfill that has already run.
- Both arms of the OR are tested separately — claim-present and claim-absent — plus the
  no-organization denial on both branches. A single combined test would pass while one arm is broken.
  This is success criterion 3 and it is the discipline CLAUDE.md demands after the deny-everyone
  incident.

**Backfill**

> ★ POPULATION IS TWO USERS — owner, 2026-08-06. Verbatim: *"I only have 2 active users in the
> current environment, so we don't have to worry about mass users for this. Just 2 and 1 outstanding
> invite that has never been accepted."*
>
> - Do not engineer the backfill for scale. No cursor document, no pagination, no batching, no
>   rate limiting, no resume-from-offset. A straight iteration over the members collection is
>   correct and complete at n=2.
> - The 1000-byte claim limit is a non-issue at this population — it stays a design constraint
>   on claim shape (still carry `orgIds[0]` only), but it is not a risk to mitigate or test against.
> - The lockout blast radius is two accounts, one of them the owner's. The dual-read `OR` and the
>   one-hour soak remain correct — they are about correctness of the rollout mechanism, not scale —
>   but the consequence of a mistake is "two people re-authenticate," not an outage.
> - The never-accepted invite is a live test case, not just trivia. It exercises the
>   invite-acceptance claim path against real data: a member document that does not exist yet, whose
>   claim must be set at acceptance time rather than by the backfill. Also confirm the backfill does
>   not crash or mis-handle a pending invite that has no `members/{uid}` document.

- Idempotency by skip-if-already-matching. Re-runnable from the top. No cursor state that could
  itself go stale.
- A Node script run with admin credentials, executed by the owner. No deploy required. Not a
  callable Cloud Function.
- Reports processed / skipped / failed counts and lists every failure by uid.

### Claude's Discretion
- The Cloud Function's exact name and file placement within `functions/src/`.
- The backfill script's path and invocation ergonomics.
- Whether the claim-setting logic is shared between the trigger and the backfill as one module
  (preferred if it avoids two implementations that can drift) or duplicated deliberately.
- Test file organization within the existing `src/storage.rules.test.ts` versus a new file.

### Deferred Ideas (OUT OF SCOPE)
- Migrating `firestore.rules` to custom claims — out of scope by requirement (R074).
- True multi-org claim support — the claim carries `orgIds[0]` only; multi-org users stay covered
  by the Firestore branch. Revisit if the app grows real multi-org switching.
- Removing the Firestore-membership fallback — that is the owner's SECOND deploy, after a
  one-hour soak. Not this phase, and not the first deploy either.
- **Nothing is deployed by this phase.** `firebase deploy` is the owner's step for both deploys.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R074 | An authenticated member of an organization can read and write objects under that organization's Storage path, and that permission is proven by an automated allow-case test that actually runs in the Storage emulator. | Focus Area 1 confirms `authenticatedContext(uid, tokenOptions)` bakes arbitrary custom claims into the mock ID token, bypassing the inert `firestore.exists()` cross-service path entirely. Focus Area 2 gives the exact dual-read rule expression. Code Examples section gives the exact test rewrite that turns the two failing allow-cases green. |
| R075 | The membership-claim rollout never locks out an existing signed-in member, and a user who belongs to no organization is still denied. | Focus Area 2's `OR`-ordering (claim first) plus Focus Area 5's two-deploy/one-hour-soak sequence. Validation Architecture section specifies the four-quadrant test matrix (claim-present/claim-absent × member/non-member) that proves this without relying on one combined test. |
</phase_requirements>

## Summary

This phase adds one new Cloud Function, widens `storage.rules` with an `OR`, and writes one backfill
script — nothing else. The critical mechanism (`@firebase/rules-unit-testing@^5.0.0`'s
`authenticatedContext(uid, tokenOptions)`) was verified directly against the installed package's own
`.d.ts` file in this session: `tokenOptions` is a `TokenOptions` object with an explicit
`[claim: string]: unknown` index signature, so `testEnv.authenticatedContext('userA', { orgId: 'orgA',
role: 'editor' })` bakes those two fields straight into the mock ID token's JWT payload, readable in
rules as `request.auth.token.orgId` / `request.auth.token.role`. This is a direct JWT-claim read with
no cross-service call, so it is completely unaffected by firebase-js-sdk#6803's Storage-emulator
`firestore.exists()` inertness — confirming this phase's premise is mechanically sound, not just
plausible.

The Cloud Function should be a single `onDocumentWritten` trigger (v7.2.5 of `firebase-functions`,
already installed, confirmed exported from `firebase-functions/v2/firestore`) on
`organizations/{orgId}/members/{uid}`, not three separate `onDocumentCreated`/`onDocumentUpdated`/
`onDocumentDeleted` triggers. `onDocumentWritten`'s `event.data` is a `Change<DocumentSnapshot> |
undefined` with `.before`/`.after` snapshots, so create/update/delete all fall out of one handler by
checking `.before.exists`/`.after.exists` — and because both invite acceptance (`ensureUserDocument`'s
batch `.set()` on `members/{uid}`) and ordinary membership creation write through the exact same
document, **this single trigger already covers the invite-acceptance claim requirement with no
separate code path** — a simplification worth telling the planner explicitly. `setCustomUserClaims`
(confirmed on the installed `firebase-admin` type: `setCustomUserClaims(uid, customUserClaims: object |
null): Promise<void>`) accepts `null` to clear all claims, which is the exact primitive needed for the
delete-membership case.

The dual-read rule must put the claim check **before** the `||`, because Firebase Rules `||` is
confirmed short-circuiting (official docs, fetched directly this session: *"`||` is
short-circuiting"*) — with the claim first, a matching claim skips the `firestore.exists()` call
entirely, which is what makes the two currently-failing allow-case tests pass in the emulator without
needing #6803 fixed. One genuine race condition was found and is not fully closed by the locked
decisions alone: `ensureUserDocument`'s invite-acceptance write is a client-side batch commit that
returns *before* the asynchronous trigger has necessarily finished running, so a `getIdToken(true)`
called immediately afterward in `loadOrgContext` can still race the trigger. This is harmless under
the first deploy (Firestore fallback still live) but becomes a real risk only after the **second**
deploy removes that fallback — flagged in Open Questions with a recommended stronger mitigation.

**Primary recommendation:** One `onDocumentWritten` trigger (mirroring `requestPptxRenderHandler`'s
exported-handler-for-testability pattern) computing `{orgId, role}` only when the written org equals
the user's `orgIds[0]`; one dual-read `storage.rules` change putting the claim check first in the
`||`; reuse `authenticatedContext(uid, { orgId, role })` to rewrite the two failing allow-case tests;
a single unbatched Node backfill script at n=2 scale; no new npm packages.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compute `{orgId, role}` claim from membership writes | API / Backend (Cloud Function, Admin SDK) | — | Only the Admin SDK can call `setCustomUserClaims`; a client can never set its own claim (that is precisely what makes the claim trustworthy in rules) |
| Enforce Storage access (dual-read) | Database / Storage (`storage.rules`) | — | Rules are evaluated by the Storage service itself, not the client or a function |
| Force claim propagation to the active session | Browser / Client (`auth.ts::loadOrgContext`) | — | Only the client SDK's `getIdToken(true)` can force its own token to re-mint early; no server-side push exists |
| Backfill existing users' claims | API / Backend (Node script, Admin SDK, run by owner) | — | Requires Admin SDK privilege; explicitly NOT a callable/deployed Cloud Function per CONTEXT.md |
| Prove correctness before deploy | Database / Storage (emulator-backed test) | Browser / Client (`@firebase/rules-unit-testing`'s mock token) | The whole point of the phase — moving the check onto a directly-testable JWT read instead of an emulator-inert cross-service call |

## Standard Stack

### Core

No new runtime dependencies. Every package this phase needs is already installed; only new *code* is added.

| Library | Installed | Latest on registry (checked 2026-08-06) | Purpose | Why Standard |
|---------|-----------|------------------------------------------|---------|--------------|
| `firebase-admin` | `^13.10.0` [VERIFIED: functions/node_modules type defs] | `14.2.0` [VERIFIED: npm registry] | `getAuth().setCustomUserClaims(uid, claims \| null)` — confirmed exact signature in `base-auth.d.ts:300` | The only API that can set a custom claim; already a transitive capability of the installed version, no bump needed |
| `firebase-functions` | `^7.2.5` [VERIFIED: functions/node_modules type defs] | `7.3.2` [VERIFIED: npm registry] | `onDocumentWritten` trigger, exported from `firebase-functions/v2/firestore` — confirmed in `firestore.d.ts:60` | Single-trigger create/update/delete coverage; same major/family already used for `requestPptxRender`'s `onDocumentCreated` |
| `@firebase/rules-unit-testing` | `^5.0.0` [VERIFIED: node_modules type defs] | `5.0.1` [VERIFIED: npm registry] | `authenticatedContext(uid, tokenOptions)` where `tokenOptions: TokenOptions` has an explicit `[claim: string]: unknown` index signature — confirmed in `public_types/index.d.ts:27-67` | The mechanism that makes rules changes testable against a mock JWT without a real Auth Emulator sign-in |

No `npm install` is required for this phase. Do not bump any of the three packages above — the
installed majors already expose every API this phase needs, verified directly rather than assumed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single `onDocumentWritten` trigger | Three separate `onDocumentCreated`/`onDocumentUpdated`/`onDocumentDeleted` triggers | More triggers to keep in sync, three separate `event.data` shapes to reason about, and the invite-acceptance-via-create case still needs the same claim-setting logic duplicated across two of the three — no benefit for this domain |
| `setCustomUserClaims(uid, null)` to clear | `setCustomUserClaims(uid, { orgId: null, role: null })` | The `null`-fields form still counts toward nothing being cleared correctly in rules (`request.auth.token.orgId == null` is a live comparison, not "claim absent") and adds needless byte weight; `null` (confirmed valid per the type signature `object \| null`) fully removes all custom claims |
| Backfill as unbatched script (locked decision) | Paginated/checkpointed Cloud Function | Explicitly rejected by the owner for this phase's n=2 population — see CONTEXT.md's ★ population note |

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** All three libraries used
(`firebase-admin`, `firebase-functions`, `@firebase/rules-unit-testing`) are already installed
dependencies of this repository, verified against their own type definitions in this session. No
`package-legitimacy check` run was needed.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────┐
                        │  Client (Browser)                        │
                        │                                           │
  Sign-in / invite ───▶ │  ensureUserDocument()                    │
  acceptance            │   - writes users/{uid} (merge)            │
                        │   - invite branch: batch.set(              │
                        │       organizations/{orgId}/members/{uid})│
                        │            │                               │
                        │            ▼                               │
                        │  loadOrgContext(uid)                       │
                        │   - reads users/{uid}.orgIds[0]            │
                        │   - onSnapshot(members/{uid}) role listen  │
                        │   - ★ NEW: getIdToken(true) forced refresh│
                        └───────────────┬───────────────────────────┘
                                        │ Firestore write
                                        ▼
                        ┌─────────────────────────────────────────┐
                        │  Cloud Functions (Admin SDK)              │
                        │                                           │
                        │  onDocumentWritten(                       │
                        │    "organizations/{orgId}/members/{uid}") │
                        │   - before/after diff → create/update/    │
                        │     delete branch                        │
                        │   - reads users/{uid}.orgIds[0] to        │
                        │     confirm this write IS the primary org│
                        │   - getAuth().setCustomUserClaims(        │
                        │       uid, {orgId, role} | null)          │
                        └───────────────┬───────────────────────────┘
                                        │ claim lands in ID token
                                        │ (next mint, or forced refresh)
                                        ▼
                        ┌─────────────────────────────────────────┐
                        │  storage.rules (Storage service)          │
                        │                                           │
                        │  allow read/write: if                     │
                        │    request.auth.token.orgId == orgId      │  ◀── evaluated FIRST
                        │      && request.auth.token.role != null   │      (short-circuits ||)
                        │    ||                                     │
                        │    firestore.exists(                      │  ◀── fallback; the
                        │      .../members/$(request.auth.uid))     │      pre-existing,
                        │                                           │      production-proven
                        │                                           │      but emulator-inert
                        │                                           │      check
                        └───────────────────────────────────────────┘

  Backfill (owner, admin creds, offline from any deploy):
    Node script → iterate organizations/*/members/* → for each,
    read current claim, skip if already {orgId, role}-matching,
    else setCustomUserClaims → report processed/skipped/failed by uid.
```

### Recommended Project Structure

```
functions/src/
├── index.ts                     # exports the new trigger (mirrors existing exports)
├── orgMembershipClaims.ts       # NEW — shared claim-computation logic + the
│                                 #   onDocumentWritten handler body, exported
│                                 #   separately from its wrapper for direct
│                                 #   unit-testability (mirrors
│                                 #   requestPptxRenderHandler/requestPptxRender)
├── orgMembershipClaims.test.ts  # NEW — mirrors index.test.ts's mocking pattern
│                                 #   (vi.mock firebase-admin/auth, firebase-admin/firestore,
│                                 #   firebase-functions/v2/firestore)
scripts/                         # or functions/scripts/ — Claude's Discretion per CONTEXT.md
└── backfillOrgClaims.ts         # NEW — Node script, admin credentials, run by owner

src/
└── storage.rules.test.ts        # MODIFIED — the two failing allow-cases gain
                                  #   tokenOptions; two NEW tests added for the
                                  #   claim-absent / no-org-denied arms (R075 SC3)

storage.rules                    # MODIFIED — dual-read OR, claim-first ordering
```

### Pattern 1: Single dual-purpose Firestore trigger (create/update/delete in one handler)

**What:** One `onDocumentWritten` trigger on `organizations/{orgId}/members/{uid}`, branching on
`event.data.before.exists` / `event.data.after.exists`, instead of three separate trigger exports.

**When to use:** Whenever a single collection-item lifecycle (create/update/delete) drives one
downstream side effect — exactly this phase's shape. `requestPptxRender` uses `onDocumentCreated`
because it only ever cares about creation; this trigger genuinely needs all three lifecycle events.

**Example:**
```typescript
// Source: functions/node_modules/firebase-functions/lib/v2/providers/firestore.d.ts:60
// (type signature verified directly against the installed package in this session)
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

interface MemberDoc {
  role: "editor" | "viewer";
}

/**
 * Exported separately from the onDocumentWritten wrapper for direct
 * unit-testability, mirroring requestPptxRenderHandler/requestPptxRender.
 */
export async function syncOrgMembershipClaimHandler(params: {
  orgId: string;
  uid: string;
  before: MemberDoc | undefined; // undefined => this write was a create
  after: MemberDoc | undefined;  // undefined => this write was a delete
}): Promise<{ action: "set" | "cleared" | "skipped"; reason?: string }> {
  const { orgId, uid, after } = params;

  // The claim only ever represents the user's PRIMARY org (orgIds[0]) per
  // 40-CONTEXT.md's locked claim shape. A write to a non-primary org's
  // membership doc (multi-org case) must NOT touch the claim.
  const userSnap = await getFirestore().collection("users").doc(uid).get();
  const orgIds = (userSnap.data()?.orgIds as string[] | undefined) ?? [];
  const primaryOrgId = orgIds[0];

  if (primaryOrgId !== orgId) {
    return { action: "skipped", reason: "not-primary-org" };
  }

  if (!after) {
    // Membership in the PRIMARY org was deleted. Clear rather than recompute
    // a new primary -- orgIds[0] itself may now be stale (TeamView.vue's
    // deleteDoc does not update users/{uid}.orgIds; a pre-existing gap this
    // phase does not fix, only must not be fooled by).
    await getAuth().setCustomUserClaims(uid, null);
    return { action: "cleared" };
  }

  await getAuth().setCustomUserClaims(uid, { orgId, role: after.role });
  return { action: "set" };
}

export const syncOrgMembershipClaim = onDocumentWritten(
  "organizations/{orgId}/members/{uid}",
  async (event) => {
    await syncOrgMembershipClaimHandler({
      orgId: event.params.orgId,
      uid: event.params.uid,
      before: event.data?.before.exists
        ? (event.data.before.data() as MemberDoc)
        : undefined,
      after: event.data?.after.exists
        ? (event.data.after.data() as MemberDoc)
        : undefined,
    });
  },
);
```

**Insight worth flagging to the planner explicitly:** invite acceptance (`ensureUserDocument`'s batch
`.set()` on `members/{uid}`) creates the same document this trigger already watches — CONTEXT.md's
"the claim is also set on invite acceptance, not by backfill alone" requirement is satisfied by this
ONE trigger with no separate invite-specific code path needed.

### Pattern 2: Dual-read Storage Rule, claim evaluated first

**What:** `storage.rules`'s two `match` blocks (`orgs/{orgId}/media/**` and `orgs/{orgId}/{allPaths=**}`)
each get their `firestore.exists(...)` condition ORed with a claim check, claim first.

**When to use:** Every `allow read`/`allow write` clause currently gated on the cross-service
`firestore.exists()` check in this file — both matches, both read and write.

**Example:**
```
// Source: storage.rules pattern, extended per 40-CONTEXT.md's locked OR-never-AND decision.
// Rules-language OR short-circuit confirmed via firebase.google.com/docs/rules/rules-language
// (fetched directly this session): "|| is short-circuiting."
match /orgs/{orgId}/{allPaths=**} {
  allow read: if request.auth != null
                 && (
                   // Claim check FIRST: if it matches, the exists() call below
                   // is never evaluated at all (confirmed short-circuit
                   // behavior) -- this is what lets the allow-case test pass
                   // in the Storage emulator without needing #6803 fixed.
                   (request.auth.token.orgId == orgId && request.auth.token.role != null)
                   || firestore.exists(
                        /databases/(default)/documents/organizations/$(orgId)/members/$(request.auth.uid))
                 );

  allow write: if request.auth != null
                  && (
                    (request.auth.token.orgId == orgId && request.auth.token.role != null)
                    || firestore.exists(
                         /databases/(default)/documents/organizations/$(orgId)/members/$(request.auth.uid))
                  )
                  && request.resource.size < 26214400;
}
```

**Caveat confirmed, not assumed:** `request.auth.token.<claim>` on a token with NO such claim set
(pre-rollout user, or a user whose primary org differs) evaluates to `null` in the CEL-based rules
language, not an error — `null == orgId` is simply `false`, so the expression safely falls through to
the second `||` operand rather than throwing. This is why the claim-check side never needs an explicit
`'orgId' in request.auth.token` guard; a missing claim degrades to `false` cleanly.

### Pattern 3: `authenticatedContext` with baked-in custom claims for emulator tests

**What:** `testEnv.authenticatedContext(uid, { orgId, role })` mints a mock ID token carrying those
exact fields as top-level JWT claims — no real Auth Emulator sign-in occurs, no Admin SDK round-trip,
no dependency on #6803's broken cross-service path.

**When to use:** Any Storage or Firestore rules test asserting behavior that depends on
`request.auth.token.<claim>`.

**Example:**
```typescript
// Source: node_modules/@firebase/rules-unit-testing/dist/esm/rules-unit-testing/src/public_types/index.d.ts:27-67
// TokenOptions has an explicit index signature: [claim: string]: unknown
// (confirmed by reading the installed package's own .d.ts in this session, not from memory)
it('allows an org member to write and read an object under their org path via the claim alone', async () => {
  // No seedMembershipDoc() call -- deliberately proving the CLAIM branch in
  // isolation, not the Firestore fallback branch (R075 success criterion 3
  // requires both arms tested separately).
  const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
  const storage = context.storage()
  const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import1/source.pptx')

  await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
  await assertSucceeds(getBytes(fileRef))
})

it('allows an org member via the Firestore fallback alone when the claim is absent (pre-rollout)', async () => {
  await seedMembershipDoc('orgA', 'userA', 'editor')
  // No tokenOptions -- proves the pre-existing production-proven branch still
  // works for a signed-in member whose token predates the claim rollout.
  const context = testEnv.authenticatedContext('userA')
  const storage = context.storage()
  const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import2/source.pptx')

  await assertSucceeds(uploadBytes(fileRef, SMALL_BYTES))
})

it('denies a user with no organization on either branch', async () => {
  // Claim present but for a DIFFERENT org, and no Firestore membership doc at
  // all -- both branches must independently deny.
  const context = testEnv.authenticatedContext('userC', { orgId: 'orgB', role: 'editor' })
  const storage = context.storage()
  const fileRef = ref(storage, 'orgs/orgA/pptx-imports/import3/source.pptx')

  await assertFails(uploadBytes(fileRef, SMALL_BYTES))
})
```

### Anti-Patterns to Avoid

- **Removing the Firestore fallback in the same deploy that adds the claim:** locks out every
  currently-signed-in user with zero claim (PITFALLS.md Pitfall 1, corroborated by the official
  custom-claims doc's propagation-timing section fetched this session).
- **`AND` instead of `OR` in the dual-read:** identical lockout, worse — even a user WITH a fresh
  claim fails if the Firestore doc has any transient read issue. Locked decision explicitly forbids
  this.
- **Trusting a client-writable Firestore `role` field as equivalent to the claim's `role`:**
  `TeamView.vue`'s `updateDoc(..., { role: newRole })` is a client write the same user (if an editor)
  could make for themselves; the claim is server-set-only via the trigger and is the only value rules
  should treat as authoritative for access decisions.
- **Backfilling with pagination/cursor/rate-limiting scaffolding:** explicitly rejected by the owner
  for this phase's n=2 population — added complexity with zero present benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Minting/verifying a custom-claim-bearing token in tests | A hand-rolled JWT signer or a real Auth-Emulator sign-in flow with `signInWithCustomToken` | `testEnv.authenticatedContext(uid, tokenOptions)` | Already does exactly this, already installed, already imported in this test file |
| Detecting create vs. update vs. delete on a Firestore write | Three separate trigger functions with manual dedup logic | `onDocumentWritten`'s single `event.data.before/after` `.exists` check | One trigger, one code path, matches the `Change<DocumentSnapshot>` type the SDK already provides |
| Clearing a user's custom claims | Manually setting every known field to `null`/undefined inside the claims object | `setCustomUserClaims(uid, null)` | Confirmed by the installed type signature (`object \| null`) to fully clear all custom claims in one call |

**Key insight:** Every piece of this phase is already a first-class, documented Firebase Admin
SDK/rules-language/testing-library capability. There is no library gap to fill — the entire phase risk
is in **correctness of sequencing** (dual-read ordering, deploy ordering, primary-org scoping), not in
missing tooling.

## Common Pitfalls

### Pitfall 1: Removing the fallback too early locks out every session with a stale token

**What goes wrong:** If `firestore.exists()` is replaced (not ORed) by the claim check in the same
deploy that adds the claim, every currently-open tab — which has zero claim on its current token —
fails every check instantly.
**Why it happens:** Claims only land on a token at next mint (natural refresh, sign-in, or explicit
`getIdToken(true)`) — confirmed via the official custom-claims doc fetched this session. There is no
server-side push that updates an already-issued token.
**How to avoid:** `OR`, never replace. Two separate deploys, ≥1 hour apart, per CONTEXT.md's locked
decision.
**Warning signs:** A `storage.rules` diff where a `match` block's `firestore.exists()` clause is
*deleted* rather than *ORed with* a new claim clause in the same commit as the claim rollout.

### Pitfall 2: Invite-acceptance race between the client's forced refresh and the async trigger

**What goes wrong:** `ensureUserDocument`'s invite branch does a client-side `batch.commit()` that
creates `members/{uid}` and returns; `onAuthStateChanged`'s handler then immediately calls
`loadOrgContext(uid)` in the very next line. If `loadOrgContext` calls `getIdToken(true)` at that
point, the Cloud Functions trigger watching that same document write may not have finished executing
yet (Cloud Functions triggers fire asynchronously, typically within a few hundred milliseconds to a
few seconds — not synchronously with the client's write). The forced refresh can complete before the
claim exists, so the freshly-refreshed token still carries no claim.
**Why it happens:** `setCustomUserClaims` is not part of the client-side write's transaction — it is a
downstream, independently-scheduled side effect.
**How to avoid (see Open Questions for the fuller recommendation):** Harmless as long as the Firestore
fallback is live (first-deploy state — the same production-proven `exists()` branch that already works
today makes the upload succeed regardless of claim timing). Becomes a real risk only after the SECOND
deploy removes the fallback, which is explicitly the owner's separate, later action — flag this
residual risk in the handoff notes rather than trying to fully close it in this phase.
**Warning signs:** A brand-new invite acceptance followed immediately by a Storage upload, tested
against a rules file that has ALREADY had its fallback removed, failing intermittently in a way that
disappears on retry (classic async-race signature).

### Pitfall 3: A rules change with only deny-case tests (this project's own prior incident)

**What goes wrong:** Per CLAUDE.md, this exact codebase already shipped a Storage rule that denied
every legitimate user while its test suite reported green, because every existing test asserted a deny
outcome and none asserted an allow outcome against the broken clause.
**Why it happens:** Deny tests pass trivially even against a completely broken (deny-everyone) rule.
**How to avoid:** Every new test added this phase for the claim path must include at least one
positive (`assertSucceeds`) case per branch, written and run FIRST, per PITFALLS.md's Pitfall 2
discipline — this phase's own two currently-failing allow-cases are the canonical proof this
discipline was missing before.
**Warning signs:** A test file where every new test name starts with "denies"/"rejects" and none
start with "allows".

## Code Examples

### Backfill script (n=2 scale, idempotent, admin credentials, owner-run)

```typescript
// Source: original code for this phase, following the parsePptxHandler/requestPptxRenderHandler
// pattern of a plain exported function testable in isolation from any CLI wrapper.
// Reuses syncOrgMembershipClaimHandler's role-resolution logic (Claude's Discretion:
// share vs. duplicate -- sharing is recommended to avoid the two implementations drifting).
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS / gcloud ADC -- owner-run, not deployed

interface BackfillResult {
  processed: number;
  skipped: number;
  failed: Array<{ uid: string; orgId: string; error: string }>;
}

export async function backfillOrgMembershipClaims(): Promise<BackfillResult> {
  const result: BackfillResult = { processed: 0, skipped: 0, failed: [] };

  // No pagination/cursor per 40-CONTEXT.md's locked decision -- a single
  // collectionGroup query is correct and complete at n=2.
  const membersSnap = await getFirestore().collectionGroup("members").get();

  for (const memberDoc of membersSnap.docs) {
    const orgId = memberDoc.ref.parent.parent?.id;
    const uid = memberDoc.id;
    if (!orgId) continue; // structurally shouldn't happen; skip defensively

    try {
      const userSnap = await getFirestore().collection("users").doc(uid).get();
      const orgIds = (userSnap.data()?.orgIds as string[] | undefined) ?? [];
      if (orgIds[0] !== orgId) {
        result.skipped++; // not this user's primary org -- claim doesn't cover it, by design
        continue;
      }

      const role = memberDoc.data().role as string;
      const existing = (await getAuth().getUser(uid)).customClaims;
      if (existing?.orgId === orgId && existing?.role === role) {
        result.skipped++; // idempotent: already matching, nothing to do
        continue;
      }

      await getAuth().setCustomUserClaims(uid, { orgId, role });
      result.processed++;
    } catch (err) {
      result.failed.push({ uid, orgId, error: String(err) });
    }
  }

  console.log("backfillOrgMembershipClaims:", result);
  return result;
}
```

### Test-mocking pattern for the new trigger (mirrors `functions/src/index.test.ts`)

```typescript
// Source: functions/src/index.test.ts's existing mocking pattern (lines 29-58),
// extended for getAuth().setCustomUserClaims and onDocumentWritten.
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ setCustomUserClaims: vi.fn() })),
}));
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: vi.fn((_path: string, handler: unknown) => handler),
  onDocumentWritten: vi.fn((_path: string, handler: unknown) => handler),
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `storage.rules` gates solely on `firestore.exists()` cross-service read | Dual-read: claim check (direct JWT read) OR the existing `firestore.exists()` | This phase | Makes the rule provably testable in the Storage emulator for the first time; production behavior unchanged during the dual-read window |
| Three-endpoint Firestore trigger style (`onDocumentCreated` alone, as used for `requestPptxRender`) | Single `onDocumentWritten` trigger for lifecycle events that need create+update+delete | This phase (first use of `onDocumentWritten` in this codebase) | One handler, one test file, no duplicated claim-computation logic across separate create/update/delete triggers |

**Deprecated/outdated:** None — no deprecated API is involved; this is a first-time application of
an existing, current pattern (`onDocumentWritten`) alongside an existing pattern
(`onDocumentCreated`, already used by `requestPptxRender`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | The recommended trigger design (read `users/{uid}.orgIds[0]` inside the handler to decide whether a given membership write affects the primary-org claim, and clear the claim entirely rather than recompute a new primary on delete) is original design reasoning grounded in this codebase's confirmed facts (client-side `deleteDoc`/`updateDoc` in `TeamView.vue`, `orgIds` picking in `auth.ts`), not sourced from any Firebase-authored reference implementation. | Architecture Patterns, Pattern 1 | Low — the design is internally consistent with locked decisions and verified codebase facts, but the planner should treat it as a proposal to confirm, not an authoritative pattern from Firebase docs |
| A2 | The invite-acceptance race window (Common Pitfalls, Pitfall 2) is closed enough for THIS phase's scope (first deploy only) but is explicitly NOT fully solved — a stronger fix (retry/poll on `getIdTokenResult(true)`, or keeping the fallback permanently for freshly-created memberships) is recommended for the SECOND deploy, which is out of this phase's build scope per CONTEXT.md. | Open Questions | Medium if the owner proceeds to the second deploy without addressing this — a newly-accepted invite could see a brief `storage/unauthorized` immediately after acceptance until the trigger catches up |
| A3 | Cloud Functions trigger latency ("a few hundred milliseconds to a few seconds") is general Firebase operational knowledge, not independently re-measured against this project's actual deployment in this research session. | Common Pitfalls, Pitfall 2 | Low — used only to establish that a race is plausible, not to set a specific numeric threshold anywhere in code |

## Open Questions

1. **Should the invite-acceptance race (Pitfall 2 / A2) be closed further inside this phase, even
   though full closure only matters after the second (owner-run) deploy?**
   - What we know: the single trigger already covers invite acceptance mechanically (Pattern 1's
     insight); CONTEXT.md's locked `getIdToken(true)`-on-org-context-load satisfies the *stated*
     requirement.
   - What's unclear: whether that single forced refresh reliably wins the race against the trigger,
     given Cloud Functions trigger latency is not instantaneous.
   - Recommendation: the planner should have `loadOrgContext`'s forced refresh retry once with a short
     delay (e.g., a single `await new Promise(r => setTimeout(r, 1500))` before a second
     `getIdTokenResult(true)`, or a small bounded retry loop) specifically on the invite-acceptance
     path, OR explicitly document in the handoff note that the Firestore fallback must remain live
     indefinitely for brand-new memberships even after the general fallback removal (a narrower,
     permanent carve-out) — a decision for the plan, not fully resolvable from research alone.

2. **Exact Cloud Function name and file path.**
   - What we know: Claude's Discretion per CONTEXT.md; `orgMembershipClaims.ts` /
     `syncOrgMembershipClaim` is this research's suggested name, chosen to read clearly next to
     `requestPptxRender`/`parsePptx`/`cleanupExpiredMedia` in `functions/src/index.ts`'s existing
     export list.
   - What's unclear: nothing blocking — purely a naming choice for the plan to finalize.
   - Recommendation: adopt the suggested name unless the planner has a stronger convention preference.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Firebase Storage emulator | The two allow-case tests (R074's headline gate) | ✓ (already configured — `src/storage.rules.test.ts` already points at `127.0.0.1:9199`) | matches installed `firebase-tools` emulator suite | — |
| Firebase Firestore emulator | Seeding membership docs for the Firestore-fallback-arm tests, and for `npm run test:rules`'s `firebase emulators:exec` wrapper | ✓ (already configured — `127.0.0.1:8080`) | — | If an emulator is already running, `npm run test:rules` fails with "port taken" — use `npx vitest run --config vitest.rules.config.ts` against the already-running instance instead (documented in CLAUDE.md and this repo's own `package.json`) |
| Admin credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default login`) | The backfill script (owner-run, not part of this phase's automated tests) | Not verifiable from this research session — owner-side setup | — | None needed for the phase's build/test work; only needed when the owner actually runs the backfill against production |
| `.env.local` | Any local test/emulator run in a worktree | Present in main checkout per CLAUDE.md; must be symlinked/copied in any worktree used for this phase | — | See CLAUDE.md's setup commands |

**Missing dependencies with no fallback:** None identified for the build-and-test scope of this phase.

**Missing dependencies with fallback:** `npm run test:rules` "port taken" — documented fallback command exists and is already the established convention in this repo.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (root `^4.0.18`; `functions/` has its own `^4.1.10` — do not cross-invoke, see CLAUDE.md's version-mismatch warning) |
| Config file | `vitest.rules.config.ts` (rules suite), default `vite.config.ts` (app suite), `functions/` has its own vitest config for the Functions suite |
| Quick run command (functions unit tests) | `cd functions && npm run test` (i.e. `vitest run`) |
| Quick run command (rules emulator tests, emulator already running) | `npx vitest run --config vitest.rules.config.ts` |
| Full suite command (rules, self-contained) | `npm run test:rules` (fails with "port taken" if an emulator is already up — use the quick-run form instead in that case) |
| Full suite command (app) | `npx vitest run` (excludes `src/rules.test.ts` by design; this phase's new/modified tests live in `src/storage.rules.test.ts`, which IS included in the default run's file glob but requires the emulators — see below) |

**Important scoping note specific to this file:** `src/storage.rules.test.ts` requires BOTH the
Firestore emulator (to seed/serve membership docs for the fallback-arm tests) AND the Storage
emulator (to actually evaluate `storage.rules`) to be running. It is not part of the emulator-free
`npx vitest run` component-test suite in practice, even though `vite.config.ts` does not exclude it by
path the way `src/rules.test.ts` is excluded. Run it via `npm run test:rules` or the direct
`vitest.rules.config.ts` invocation, never as evidence from a bare `npx vitest run` where the
emulators were not confirmed running.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| R074 | Org member allowed via claim alone (no Firestore membership doc seeded) | Storage-emulator allow-case | `npx vitest run --config vitest.rules.config.ts` | ❌ Wave 0 — new test in `src/storage.rules.test.ts` |
| R074 | Org member allowed via Firestore fallback alone (no claim on token) — the two CURRENTLY-FAILING tests | Storage-emulator allow-case | `npx vitest run --config vitest.rules.config.ts` | ✅ exists (currently failing) — becomes green once `storage.rules` gains the dual-read |
| R075 | Claim present, valid, and matching → allowed | Storage-emulator allow-case | `npx vitest run --config vitest.rules.config.ts` | ❌ Wave 0 |
| R075 | Claim absent, Firestore membership doc present → allowed (pre-rollout member) | Storage-emulator allow-case | `npx vitest run --config vitest.rules.config.ts` | ❌ Wave 0 (may already be covered by existing tests once dual-read lands — verify no duplicate) |
| R075 | Claim present for a DIFFERENT org, no Firestore doc → denied | Storage-emulator deny-case | `npx vitest run --config vitest.rules.config.ts` | ❌ Wave 0 |
| R075 | No claim, no Firestore doc (user belongs to no org) → denied on both branches | Storage-emulator deny-case | `npx vitest run --config vitest.rules.config.ts` | ❌ Wave 0 |
| R074/R075 (function) | Trigger sets `{orgId, role}` on create for the user's primary org | Functions-emulator / unit (mocked Admin SDK) | `cd functions && npm run test` | ❌ Wave 0 — new `orgMembershipClaims.test.ts` |
| R074/R075 (function) | Trigger skips a write to a non-primary org's membership doc | Unit (mocked Admin SDK) | `cd functions && npm run test` | ❌ Wave 0 |
| R074/R075 (function) | Trigger clears the claim (`setCustomUserClaims(uid, null)`) on delete of the primary org's membership doc | Unit (mocked Admin SDK) | `cd functions && npm run test` | ❌ Wave 0 |
| Backfill (CONTEXT.md, not a numbered requirement) | Skip-if-already-matching idempotency; does not crash on a pending invite with no `members/{uid}` doc | Unit (mocked Admin SDK/Firestore) | `cd functions && npm run test` (or wherever the script's tests land per Claude's Discretion on path) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd functions && npm run test` for any trigger/backfill code change;
  `npx vitest run --config vitest.rules.config.ts` (with an emulator already running via
  `firebase emulators:start --only firestore,storage`, kept up across the working session) for any
  `storage.rules`/`storage.rules.test.ts` change.
- **Per wave merge:** `npm run test:rules` (self-contained, starts its own emulator pair) as the
  clean-room confirmation, plus `npm run type-check` (the `vue-tsc --build` form per CLAUDE.md) for
  any `.ts` changes on the app side.
- **Phase gate:** Both the two originally-failing allow-cases AND the new claim-arm/deny-arm tests
  green under `npm run test:rules`, cited as evidence — this phase's stated goal is measured entirely
  by this emulator evidence plus the written two-deploy handoff, never by a live deploy.

### Wave 0 Gaps

- [ ] `functions/src/orgMembershipClaims.ts` + `orgMembershipClaims.test.ts` — the trigger and its
      unit tests (mocked Admin SDK, mirroring `index.test.ts`'s existing mock pattern)
- [ ] `storage.rules` dual-read edit (both `match` blocks, both read and write clauses)
- [ ] `src/storage.rules.test.ts` — rewrite the two failing allow-cases with `tokenOptions`, add the
      claim-absent/no-org-denied arms (R075 SC3)
- [ ] Backfill script + its own test file (path per Claude's Discretion) — idempotency and
      pending-invite-safety tests
- [ ] No new test framework/config install needed — both suites (`vitest.rules.config.ts` and
      `functions/`'s own vitest config) already exist and are already exercised by this codebase

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|---------------------|
| V2 Authentication | No — unchanged; Firebase Auth session handling is out of this phase's scope | — |
| V3 Session Management | Yes (narrowly) — token lifetime/refresh timing IS the phase's core risk surface | Firebase-managed 1-hour ID token lifetime (fixed, cannot be shortened/extended per Firebase's own architecture — confirmed via official docs fetched this session) plus explicit `getIdToken(true)` force-refresh; no custom session logic introduced |
| V4 Access Control | Yes — this is the phase's entire purpose | Server-set custom claims (`setCustomUserClaims`, Admin-SDK-only) as the authorization signal in `storage.rules`, dual-read against the pre-existing, production-proven Firestore membership check; never a client-writable field |
| V5 Input Validation | No new user input surface — the claim is computed server-side from a Firestore document the client cannot directly set the `role` field of without already being an editor (`firestore.rules`'s `isOrgEditor` write gate on `members/{uid}`) | — |
| V6 Cryptography | No — claim values are plain JSON in the JWT payload signed by Firebase's own infrastructure; nothing custom is signed or encrypted by this phase's code | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Client trusts its own writable Firestore `role` field as if it were the authoritative claim | Elevation of Privilege | Rules and any access-decision code must read `request.auth.token.role` (server-set-only) or fall back to the existing `firestore.exists()`/`get()` checks — never the client-writable Firestore field directly for an authorization decision |
| Claim rollout with `AND` instead of `OR`, or fallback removed same-deploy | Denial of Service (self-inflicted, against legitimate users) | Locked `OR`-never-`AND` decision; two separate deploys with a ≥1-hour soak, per CONTEXT.md and confirmed against the official 1-hour token-lifetime fact |
| A rules change proving only deny-cases while the underlying allow-path is actually broken (this project's own prior incident) | Denial of Service via a shipped-broken rule | Every new/modified test in this phase includes a positive (`assertSucceeds`) case, written and run before being called "done," per PITFALLS.md's Pitfall 2 discipline |
| Backfill or trigger setting a claim for an org the user does NOT actually belong to (a bug in the primary-org-scoping logic) | Elevation of Privilege | The recommended handler design (Pattern 1) independently re-derives `orgIds[0]` from `users/{uid}` rather than trusting the write's `orgId` param alone — mirrors `parsePptxHandler`'s existing "never trust the client-declared value alone" pattern already established in this codebase |

## Sources

### Primary (HIGH confidence)
- Direct read of `node_modules/@firebase/rules-unit-testing/dist/esm/rules-unit-testing/src/public_types/index.d.ts` (this session) — confirmed `TokenOptions`'s `[claim: string]: unknown` index signature and `authenticatedContext(user_id, tokenOptions?)` signature.
- Direct read of `functions/node_modules/firebase-functions/lib/v2/providers/firestore.d.ts` (this session) — confirmed `onDocumentWritten` export and `Change<DocumentSnapshot> | undefined` event-data shape.
- Direct read of `functions/node_modules/firebase-admin/lib/auth/base-auth.d.ts:300` (this session) — confirmed `setCustomUserClaims(uid, customUserClaims: object | null): Promise<void>`.
- `npm view firebase-admin version` / `npm view firebase-functions version` / `npm view @firebase/rules-unit-testing version` (this session, 2026-08-06) — confirmed installed versions are current-major and no bump is needed.
- Direct reads of `storage.rules`, `firestore.rules`, `src/storage.rules.test.ts`, `src/stores/auth.ts`, `functions/src/index.ts`, `functions/src/index.test.ts`, `src/views/TeamView.vue`, `CLAUDE.md`, `.planning/phases/40-.../40-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (this session).
- [Control Access with Custom Claims and Security Rules | Firebase Authentication](https://firebase.google.com/docs/auth/admin/custom-claims) — fetched directly this session: 1000-byte payload limit, three propagation mechanisms (sign-in/re-auth, natural token refresh, `getIdToken(true)` forced refresh), reserved-name warning (specific names not enumerated in the fetched section).
- [Firebase Rules Language Reference](https://firebase.google.com/docs/rules/rules-language) — fetched directly this session: confirmed `||` short-circuit evaluation ("`||` is short-circuiting") and that evaluation-order matters for avoiding unnecessary expensive/cross-service calls.
- Firebase ID token lifetime (1 hour, fixed, non-configurable) — [Manage User Sessions](https://firebase.google.com/docs/auth/admin/manage-sessions) and corroborating community/reference sources, confirmed via WebSearch this session.

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` and `.planning/research/PITFALLS.md` (milestone-level research, dated 2026-08-06, already cross-checked against `firebase.google.com/docs/auth/admin/custom-claims` per their own sourcing notes) — used as corroborating background, superseded where this phase's direct type-definition reads gave a more precise/current answer.

### Tertiary (LOW confidence)
- General knowledge of Cloud Functions trigger propagation latency ("a few hundred milliseconds to a few seconds") used only to establish that the invite-acceptance race (Pitfall 2) is plausible — not independently measured against this project's actual deployed environment.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every API used was confirmed against the installed package's own type definitions in this session.
- Architecture: HIGH — trigger shape, rules short-circuit behavior, and claim-clearing primitive are all confirmed, not assumed; the primary-org-scoping design (Pattern 1) is original reasoning grounded in verified codebase facts, flagged as A1 in the Assumptions Log.
- Pitfalls: HIGH for the lockout/dual-read pitfall (directly corroborated by this project's own documented prior incident plus official docs); MEDIUM for the invite-acceptance race, whose exact timing was not measured against a live deployment (A3).

**Research date:** 2026-08-06
**Valid until:** 30 days (Firebase Admin SDK/rules-language mechanics are stable; re-verify installed package versions if this phase's plan is executed significantly later than this research date)
