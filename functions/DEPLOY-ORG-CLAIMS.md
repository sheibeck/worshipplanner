# Deploying the org-membership custom claim (and later, removing the Firestore fallback)

> ★★ **NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE.** Phase 40 was built under the
> v1.5 standing autonomy grant (`.planning/STATE.md`): *"NO DEPLOYS. `firebase deploy` and
> `gcloud run deploy` remain the owner's step."* Every artifact this phase produced —
> `storage.rules`' dual-read, the `syncOrgMembershipClaim` Cloud Function, and the backfill script
> below — ships **built, tested, and undeployed**. Reaching this handed-over state IS the phase
> goal (ROADMAP success criterion 4); running either deploy is explicitly out of scope for the
> phase that wrote this file.

This file lives next to `functions/src/backfillOrgClaims.ts` and `functions/src/orgMembershipClaims.ts`
— it is not a note buried in a plan SUMMARY, following the same placement precedent as
`render-service/DEPLOY.md`.

**Both deploys below change how every existing user's org membership is proven.** Deployed
carelessly, in the wrong order, or without the soak between them, they can lock real people out of
a live app. Undeployed, everything in this phase is inert and harmless. Population at the time
this file was written is **2 active users plus 1 never-accepted invite** (owner, 2026-08-06) — so
the blast radius of a mistake here is two accounts, one of them the owner's, recoverable by
re-authenticating. That lowers the *consequence* of a mistake, not the bar for following this
sequence correctly.

---

## What is being rolled out

- **The claim.** Two readable top-level custom-claim keys: `orgId` and `role`. Read by
  `storage.rules`' `isOrgMemberByClaim(orgId)` helper as `request.auth.token.orgId` /
  `request.auth.token.role`.
- **The function.** `syncOrgMembershipClaim` — an `onDocumentWritten` trigger on
  `organizations/{orgId}/members/{uid}` (`functions/src/orgMembershipClaims.ts`). Covers
  create/update/delete: sets `{ orgId, role }` on create/update of the user's PRIMARY membership,
  clears the claim (`setCustomUserClaims(uid, null)`) on delete of the primary membership, and is a
  structural no-op for any non-primary-org membership write or delete.
- **The rule shape.** `storage.rules`' `isOrgMember(orgId)` is currently
  `isOrgMemberByClaim(orgId) || isOrgMemberByFirestore(orgId)` — claim evaluated first, `OR`
  never `AND`, across all four `allow` clauses. The Firestore arm (the pre-existing
  cross-service `firestore.exists(...)` check) is what deploy 2 below eventually removes.
- **The backfill.** `functions/src/backfillOrgClaims.ts`'s `backfillOrgMembershipClaims` — a
  Node script, not a deployed function, that gives the claim to users whose membership document
  predates the trigger.
- **Known limitation, by design (D-01/D-04):** the claim always carries the user's PRIMARY org
  only (`users/{uid}.orgIds[0]`). A user in more than one organization stays covered for their
  non-primary orgs by the Firestore arm alone — see the mandatory pre-check in Step 4 before that
  arm is ever removed.

---

## Pre-flight

Before starting Deploy 1:

1. **Admin credentials available.** Either `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service
   account key, or run `gcloud auth application-default login` interactively. The backfill script
   (Step 2) needs this; the `firebase deploy` commands need you signed in via `firebase login`
   separately.
2. **Confirm the correct project is selected.** Run `firebase use` to see the active alias/project;
   this repo's `.firebaserc` default is `worship-planner-bc515`. If in doubt, run
   `firebase use worship-planner-bc515` explicitly before any deploy command below. The backfill's
   CLI wrapper also prints its resolved project id before doing any work (Step 2) — read it before
   confirming a dry run looks right.
3. **Full test suite green locally, before touching anything:**
   - Rules suite, with Firebase emulators already running (`firebase emulators:start`):
     `npx vitest run --config vitest.rules.config.ts` — **never `npm run test:rules`** here, since
     that script starts its own emulator via `firebase emulators:exec` and fails with "port taken"
     when one is already up.
   - Functions suite: `cd functions && npm run test` — expect all suites green, including
     `backfillOrgClaims.test.ts` and `orgMembershipClaims.test.ts`.
   - Type gate: `npm run type-check` (the `vue-tsc --build` form, which also checks test files —
     `npm run type-check -p tsconfig.app.json` is not sufficient evidence, see `CLAUDE.md`).

Do not proceed to Step 1 unless all three are green.

---

## Step 1 — Deploy the dual-read rule and the claims function together

Deploying both in one step means the rule that reads the claim and the function that writes it go
live at the same moment — there is no window where one exists without the other.

```bash
firebase deploy --only storage,functions:syncOrgMembershipClaim --project worship-planner-bc515
```

### What to observe

- The Firebase Console's **Functions** list shows `syncOrgMembershipClaim` as newly deployed
  (Firestore trigger on `organizations/{orgId}/members/{uid}`).
- The Firebase Console's **Storage → Rules** tab shows a new rules version with a timestamp
  matching this deploy.
- **The critical check:** an existing signed-in member can still upload (any org media upload, or
  a PPTX import). This is the one assertion the Storage emulator structurally cannot make —
  `firestore.exists()` is inert there (firebase-js-sdk#6803) — so this manual check is the only
  behavioural proof, in any environment, that the Firestore-fallback arm is actually still working
  in production. `src/storage.rules.test.ts`'s structural guard test only proves the fallback
  predicate is *present in the rule source*; it cannot prove the rule *evaluates correctly* against
  a real cross-service Firestore read. Do not skip this check.

### Rollback

The change is purely additive — an `OR` that widens what is allowed, never an `AND` that narrows
it — so nothing can be locked out by this deploy even if `syncOrgMembershipClaim` misbehaves. If
something still looks wrong:

```bash
git checkout -- storage.rules
firebase deploy --only storage --project worship-planner-bc515
```

Leave the function deployed; it does nothing to `storage.rules` that the reverted rule would read.

---

## Step 2 — Run the backfill

Dry run is the **default** — this is deliberate (T-40-10). Always run the dry run first and read
its output before ever passing `--apply`.

```bash
cd functions
npm run build
node lib/backfillOrgClaims.js
```

### Expected dry-run output at n=2

The script prints the resolved project id, a `==== DRY RUN ====` banner, one log line per account
naming the uid, org, and decision, and a final summary object. At the current population (2 active
members, 1 never-accepted invite) expect something like:

```
[backfillOrgClaims] target project: worship-planner-bc515
[backfillOrgClaims] ==== DRY RUN ==== no claims will be written. Pass --apply to write for real.
[backfillOrgClaims] <uid-1> (<orgId>): set { orgId: '<orgId>', role: 'editor' }
[backfillOrgClaims] <uid-2> (<orgId>): set { orgId: '<orgId>', role: 'viewer' }
[backfillOrgClaims] summary: { processed: 2, skipped: 0, failed: [] }
```

Read the summary. `processed` should equal the number of real members you expect to see, `failed`
should be empty, and there should be exactly two accounts total — not three. The never-accepted
invite has no `organizations/{orgId}/members/{uid}` document at all, so it is structurally absent
from this output; its claim is set by `syncOrgMembershipClaim` at the moment the invite is
accepted (via the bounded retry in `src/stores/auth.ts`, see Known Limitations #3 below), not by
this backfill. Do not expect to see it here, and do not treat its absence as a bug.

Once the dry run looks correct, run for real:

```bash
node lib/backfillOrgClaims.js --apply
```

### Expected result

Two accounts `processed` on the first `--apply` run. Any repeat run — accidental or deliberate —
reports both accounts `skipped` (idempotent, D-11) and calls `setCustomUserClaims` zero times. The
script exits non-zero if `failed` is non-empty; treat any failure entry as blocking until resolved
before continuing to Step 3.

### Rollback

The backfill only ever writes the exact `{ orgId, role }` claim `decideMembershipClaim` would also
write from a live membership-document trigger — there is no separate "wrong state" it can put an
account into that a future membership write wouldn't already correct. If a claim genuinely needs to
be cleared by hand (e.g. you ran it against the wrong project), clear it directly:
`getAuth().setCustomUserClaims(uid, null)` from a one-off admin script, or via the Firebase Console's
Authentication → user detail page. The Firestore fallback arm is still live at this point in the
sequence regardless, so no user's access is affected either way.

---

## Step 3 — Soak for one full max-token-lifetime (1 hour)

**Wait one full hour after Step 2 completes before touching anything else.**

Firebase ID tokens have a fixed, non-configurable 1-hour lifetime. A claim only lands on a token at
the moment that token is next minted — either by a forced refresh (`src/stores/auth.ts`'s
`refreshOrgClaim`, which fires on every `loadOrgContext` call, plan 40-03) or by the token's own
natural expiry. Waiting a full hour guarantees that **every** live session, including any tab left
open since before Step 1, has re-minted its token at least once and is now carrying the claim.

**What to observe during the soak:** both active users continue working normally — uploads,
imports, everything. This is expected and unremarkable: the Firestore-membership fallback arm is
still live during the soak, so nothing depends on the claim actually being present yet.

**Do not skip or shorten this step.** Skipping it is exactly what turns Step 4 into a lockout: if
any live token has not yet picked up the claim when the Firestore fallback is removed, that
session's next Storage request is denied outright, with no fallback left to catch it.

### Rollback

Waiting causes no state change, so there is nothing to undo from this step itself. If you decide to
abandon the rollout entirely partway through the soak, the rollback is identical to Step 1's: revert
`storage.rules` via `git checkout -- storage.rules` and `firebase deploy --only storage` — though
since Step 1 was purely additive, the dual-read rule is also safe to simply leave in place
indefinitely without ever proceeding to Step 4.

---

## Step 4 — Deploy 2: remove the Firestore-membership fallback

### Mandatory pre-check — do this before writing or deploying anything in this step

Confirm that **neither active user's `users/{uid}.orgIds` array has more than one entry.** The
claim carries `orgIds[0]` only (D-01/D-04) — once the Firestore fallback is removed, a user with a
second org in that array silently loses Storage access to every org except their primary. At n=2
this is a 30-second check in the Firestore Console (`users` collection, inspect each of the 2
active `orgIds` fields) and it is **not optional**. If either user has more than one org, stop —
do not proceed with this step until that is resolved or accepted as a known, communicated
limitation for that specific user.

### The rule edit (deliberately not written by this phase)

`40-CONTEXT.md` defers this edit on purpose — a pre-written removal sitting in the tree would
invite deploying it before the soak has actually happened. When you are ready:

1. In `storage.rules`, change `isOrgMember(orgId)` from
   `isOrgMemberByClaim(orgId) || isOrgMemberByFirestore(orgId)` to just `isOrgMemberByClaim(orgId)`
   — remove the `|| isOrgMemberByFirestore(orgId)` disjunct in all four `allow` clauses. Leave the
   size-cap conjuncts (the 25MB generic cap, the 52428800-byte media cap) completely untouched;
   this edit only ever touches the membership predicate.
2. **The tripwire — the most important sentence in this file:** plan 40-01's guard test in
   `src/storage.rules.test.ts`, titled *"keeps the Firestore-membership fallback ORed, never
   ANDed, into the membership check"*, asserts the Firestore predicate is still present and
   disjunctively joined. **That test will fail the moment this edit is made — by design.** This is
   the intended signal that the edit landed, not a regression to chase or a reason to revert.
   Updating (or deliberately removing) that test is the conscious, written act of acknowledging the
   fallback is gone. If it is edited casually, weakened, or deleted just to make the suite green
   again without that acknowledgment, the protection this phase built against an accidental
   re-introduction of the deny-everyone bug (the incident `CLAUDE.md` documents at length) is gone
   too.
3. Deploy only the storage target:

```bash
firebase deploy --only storage --project worship-planner-bc515
```

### What to observe

Both active users can still upload and read their org's media/imports as before — now proven by
the claim arm alone, with no Firestore fallback behind it.

### Rollback

Restore the fallback arm and redeploy:

```bash
git checkout -- storage.rules
firebase deploy --only storage --project worship-planner-bc515
```

Access returns immediately for anyone whose `organizations/{orgId}/members/{uid}` document exists,
regardless of claim state — the same as before Deploy 2 ever happened.

---

## Known limitations and residual risks

1. **Multi-org users — CLOSED by Phase 73, once its three steps below are deployed.** This
   limitation described a claim that carried the primary org only, leaving non-primary orgs
   dependent entirely on the Firestore fallback arm. Phase 73 adds an additive `orgs` map
   (`{ [orgId]: role }`) alongside the unchanged primary `orgId`/`role` keys, and widens
   `storage.rules`' `isOrgMemberByClaim` to also check that map — so a member's non-primary-org
   access no longer depends on the Firestore fallback arm at all, once the Phase 73 rollout below
   has run. **Until all three Phase 73 steps are deployed, this limitation is still live** — treat
   it as open for any org whose owner has not yet completed the section below.

2. **Stale claim after membership removal (T-40-04).** `setCustomUserClaims` clears a removed
   member's claim server-side immediately, but any ID token already issued to that user keeps
   working — with the old claim baked in — until it naturally expires, up to 1 hour. Today, before
   Deploy 2, the Firestore fallback arm makes removal effective immediately regardless of token
   age. After Deploy 2, there is a bounded up-to-1-hour window where a just-removed member can
   still access Storage. If an immediate, non-negotiable lockout is ever required (e.g. a
   compromised account), call `getAuth().revokeRefreshTokens(uid)` — this invalidates the user's
   session outright rather than waiting for natural token expiry.

3. **Invite-acceptance race (T-40-07).** `syncOrgMembershipClaim` is an asynchronous Firestore
   trigger, so a brand-new member's client can, in principle, force a token refresh before the
   trigger has finished writing the claim. Plan 40-03 closes the realistic window with a bounded
   retry in `src/stores/auth.ts`: `CLAIM_REFRESH_MAX_ATTEMPTS = 4` at `CLAIM_REFRESH_DELAY_MS =
   1500` ms apart, for a worst-case wait of **~4.5 seconds**, paid only once, on the just-joined
   path. If the trigger ever takes longer than that ~4.5s budget (extremely unlikely under normal
   Cloud Functions cold/warm-start latency), the new member sees exactly one `storage/unauthorized`
   on their very first request, which succeeds on retry once the claim lands — never a hard,
   permanent lockout.

4. **The Firestore-fallback arm's allow behaviour is unprovable locally, and always will be.**
   `firestore.exists()` is inert in the Storage emulator (firebase-js-sdk#6803) — this is the
   defect this entire phase exists to work around for the *claim* arm, but it can never be fixed
   for the *fallback* arm itself, since that arm's whole purpose is the cross-service Firestore
   read the emulator cannot execute. Phase 40 proves that arm exists and is correctly OR-joined
   only structurally, via the static source-assertion test in `src/storage.rules.test.ts`. Step 1's
   "existing member can still upload" observation above is this arm's *only* behavioural proof,
   in any environment, for as long as the fallback exists. `CLAUDE.md`'s lesson from the incident
   that motivated this whole phase applies directly here: **a test explained away as an environment
   quirk is an untested assertion** — which is exactly why that observation is written into this
   runbook as a required step, not left to memory or assumed to still be true.

---

## Phase 73 — widening to multi-org (`orgs` map): the owner-run rollout order

> ★★ **NOTHING IN THIS SECTION HAS BEEN RUN BY THIS PHASE EITHER.** Same standing grant as the
> banner at the top of this file. Phase 73 shipped `syncOrgMembershipClaim`'s widened write path
> (73-01), `storage.rules`' widened `isOrgMemberByClaim` (73-02), and this widened backfill
> (73-03) fully **built, tested, and undeployed**. Everything below is written for the owner to run
> by hand, in this exact order — hand-over, not automation.

### What is being added

The Phase 40 claim above carries the user's PRIMARY org only (`orgId`/`role`, from
`users/{uid}.orgIds[0]`). Phase 73 adds a purely additive third claim key, `orgs` — a
`{ [orgId]: role }` map covering **every** org a user currently belongs to, primary or not — and
widens `storage.rules`' `isOrgMemberByClaim(orgId)` to also accept membership proven by that map.
The primary `orgId`/`role` keys are **unchanged**: nothing here modifies what Deploy 1/Deploy 2
above already did, or removes the Firestore-fallback arm if it is still present in your
`storage.rules`. This is closing Known Limitation #1 above, not replacing this file's earlier
rollout.

### The three steps, in order, and why that order matters

**STEP 1 — deploy the widened writer first.**

```bash
firebase deploy --only functions:syncOrgMembershipClaim --project worship-planner-bc515
```

This makes every **new** `organizations/{orgId}/members/{uid}` write (create, update, or delete)
recompute and merge the `orgs` map immediately, on top of the unchanged primary-key behaviour.
Deploying the writer *before* anything reads `orgs` means no token is ever authorized against an
`orgs` map that was never written — there is nothing yet for STEP 3's rule to trust incorrectly.

**STEP 2 — run the backfill, dry-run then `--apply`,** to populate `orgs` for every **existing**
account (the writer above only fires on future writes):

```bash
cd functions
npm run build
node lib/backfillOrgClaims.js
```

Read the dry-run summary — one log line per uid naming the resolved decision, and a final
`{ processed, skipped, failed }` object. Once it looks right:

```bash
node lib/backfillOrgClaims.js --apply
```

**Idempotent, like Step 2 above (D-11, extended to `orgs`):** a repeat run — accidental or
deliberate — reports every account `skipped` (now checking both the primary keys AND the `orgs`
map for already-current) and calls `setCustomUserClaims` zero times. The script exits non-zero if
`failed` is non-empty; treat any failure entry as blocking until resolved before continuing to
STEP 3, exactly as Step 2 above already instructs.

**STEP 3 — deploy the widened rule last:**

```bash
firebase deploy --only storage --project worship-planner-bc515
```

Deploying the rule *last* means the `orgs`-map authorization arm only goes live once every
account's `orgs` claim already exists (STEP 1 covers every write from here forward; STEP 2 covers
every write that already happened). There is no window where the rule expects an `orgs` map that a
still-in-flight backfill hasn't written yet.

### Why this order avoids an access gap

`storage.rules`' legacy arms — both `isOrgMemberByFirestore` (if the Firestore fallback described
earlier in this file is still present in your rules) and the pre-existing single-org
`isOrgMemberByClaim(orgId)` check against the primary `orgId`/`role` keys — are untouched by 73-02
and **stay live throughout this rollout**. A single-org session's access is proven exactly as it
was before Phase 73 at every point in STEP 1 through STEP 3; the `orgs`-map arm is a pure `OR`
addition, widening what is allowed, never narrowing it. This is what "no access gap" means
concretely here: at no point does any account lose access it already had, because the check that
already worked for it is never removed by this rollout — Phase 73 only adds a second, independent
way to prove membership for accounts (or org relationships) the old primary-only claim couldn't
cover.

### Soak / token-refresh guidance — unchanged from Step 3 above

The same 1-hour soak and forced-token-refresh reasoning from **Step 3 — Soak for one full
max-token-lifetime (1 hour)** above applies identically here: a claim (including the new `orgs`
key) only lands on a token at the moment that token is next minted, either via
`src/stores/auth.ts`'s `refreshOrgClaim` or natural expiry. If you are running this Phase 73
rollout well after Phase 40's original soak, most live sessions have already re-minted a token
since then for unrelated reasons — but do not assume that; the same soak discipline that governed
Deploy 1 → Deploy 2 above governs STEP 1 → STEP 3 here for the same reason.

### Rollback

Every step here is additive — a new claim key, a widened `OR` in the rule, a backfill that only
ever writes what the deployed trigger would also write. Reverting any one step in isolation is
safe:

- Roll back the rule: `git checkout -- storage.rules && firebase deploy --only storage --project worship-planner-bc515`
  restores the pre-73-02 rule; every account's access reverts to exactly what it was under Deploy
  1/Deploy 2 above, since the primary-key and (if present) Firestore-fallback arms are untouched.
- The writer and the backfill need no rollback beyond the rule: an `orgs` claim key nobody reads
  is inert.

---

## If something goes wrong

The fastest recovery for a locked-out user, at any point after Deploy 1, is to restore the
Firestore fallback arm and redeploy the storage target (the rollback commands under Step 1 and
Step 4 above are identical for this reason). If that is somehow unavailable, having the affected
user sign out and back in re-mints their ID token carrying whatever claim the backfill or the
trigger has set at that moment — often sufficient on its own if the underlying claim state is
actually correct and the problem was only a stale cached token.
