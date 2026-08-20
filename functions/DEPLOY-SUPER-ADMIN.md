# Deploying the super-admin access gate (Phase 68)

> ★★ **NOTHING IN THIS REPOSITORY RUNS ANY COMMAND IN THIS FILE.** Phase 68 was built under the
> v1.9 standing autonomy grant (`.planning/STATE.md`): *"Deploy policy — HAND OVER all deploys
> this milestone (default) ... Every deployable artifact ships built + tested + UNDEPLOYED with
> the exact `firebase deploy --only …` command handed over. The owner runs the first super-admin
> bootstrap script and the rules/functions deploys."* Every artifact this phase produced — the
> `isSuperAdmin()` block in `firestore.rules`, the `syncSuperAdminClaim` / `setSuperAdminClaim`
> Cloud Functions, and `functions/src/bootstrapSuperAdmin.ts` below — ships **built, tested, and
> undeployed**. Reaching this handed-over state IS the phase goal; running any deploy or the
> bootstrap `--apply` is explicitly out of scope for the phase that wrote this file.

This file lives next to `functions/src/bootstrapSuperAdmin.ts` and `functions/src/superAdminClaims.ts`
— it is not a note buried in a plan SUMMARY, following the same placement precedent as
`functions/DEPLOY-ORG-CLAIMS.md` (the v1.5 org-claims runbook) and `render-service/DEPLOY.md`.

**This grants the first account irrevocable-by-anyone-else, app-wide `superAdmin` authority.**
Deployed carelessly, or bootstrapped against the wrong email, this can hand that authority to the
wrong account, or fail to bring the enforcement online at all. Undeployed, everything in this
phase is inert and harmless — no route, rule, or Function reacts to anything until these steps run.

This file does **not** instruct writing to `.env.local` or `functions/.env` — nothing in this
phase needs a new secret or environment variable.

---

## What is being rolled out

- **The claim.** A single top-level custom-claim boolean, `superAdmin: true`, additive onto the
  same claims object that may already carry `{ orgId, role }` (never a blind replace — both live
  side by side via the shared `mergeAndSetCustomClaims`/`clearClaimKeys` helper from Plan 01).
- **The rule.** `firestore.rules`' new claim-only `isSuperAdmin()` helper
  (`request.auth.token.superAdmin == true` — no `get()`/`exists()`), gating `match
  /appConfig/{docId}` and `match /superAdmins/{uid}` (both collections: read AND write require it).
- **The functions.** In `functions/src/superAdminClaims.ts`:
  - `syncSuperAdminClaim` — an `onDocumentWritten` trigger on `superAdmins/{uid}`. Grant (doc
    created/updated) merges `{ superAdmin: true }`; revoke (doc deleted) clears only the
    `superAdmin` key, preserving any `{ orgId, role }`. This is the sole claim writer for ordinary
    grant/revoke — mirrors `syncOrgMembershipClaim`.
  - `setSuperAdminClaim` — an `onCall` that only ever writes/deletes the `superAdmins/{targetUid}`
    document (never the claim directly). Re-verifies the CALLER is already a super-admin both via
    their token claim and a fresh Firestore re-read of `superAdmins/{callerUid}` before doing
    anything, resolves the target exclusively via `getAuth().getUserByEmail()`, and calls
    `revokeRefreshTokens(targetUid)` on revoke.
- **The bootstrap.** `functions/src/bootstrapSuperAdmin.ts` — a Node script, not a deployed
  Function (deliberately excluded from `functions/src/index.ts`), that grants the very first
  super-admin. Dry-run by default; `--apply`-gated. On `--apply` it writes `superAdmins/{uid}`
  **and** calls `mergeAndSetCustomClaims` directly — it does not rely solely on
  `syncSuperAdminClaim` having been deployed yet (see Step 3's ordering note and Pitfall 6 below).
- **The client gate (already shipped, needs no separate deploy step here).** `/owner-console` +
  the `requiresSuperAdmin` router guard + the "Owner Console" nav entry all read
  `authStore.isSuperAdmin` from the existing ID-token claims — this is convenience-only. The real
  enforcement boundary is the rules above and the onCall's caller re-check, never the client route
  guard alone.

---

## Pre-flight

Before starting Step 1:

1. **Admin credentials available.** Either `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service
   account key, or run `gcloud auth application-default login` interactively. The bootstrap
   script (Step 3) needs this; the `firebase deploy` commands need you signed in separately via
   `firebase login`.
2. **Confirm the correct project is selected.** Run `firebase use` to see the active
   alias/project; this repo's `.firebaserc` default is `worship-planner-bc515`. If in doubt, run
   `firebase use worship-planner-bc515` explicitly before any deploy command below. The bootstrap
   script's CLI wrapper also prints its resolved project id before doing any work (Step 3) — read
   it before trusting a dry run.
3. **Full test suite green locally, before touching anything:**
   - Functions suite: `cd functions && npm test` — expect all suites green, including
     `superAdminClaims.test.ts` and `bootstrapSuperAdmin.test.ts`.
   - Rules suite, with Firebase emulators already running (`firebase emulators:start`):
     `npx vitest run --config vitest.rules.config.ts` — **never `npm run test:rules`** here, since
     that script starts its own emulator via `firebase emulators:exec` and fails with "port taken"
     when one is already up (CLAUDE.md).
   - Type gate: `npm run type-check` (the `vue-tsc --build` form, which also checks test files —
     `npm run type-check -p tsconfig.app.json` is not sufficient evidence, see `CLAUDE.md`).

Do not proceed to Step 1 unless all three are green.

---

## Step 1 — Deploy the Firestore rules

```bash
firebase deploy --only firestore:rules --project worship-planner-bc515
```

This activates the `isSuperAdmin()` gate on `appConfig/*` and `superAdmins/*`. The change is
**additive** — those two collections were previously covered only by the catch-all deny (nothing
could read or write them before this rule existed), so this deploy cannot lock any existing user
out of anything they could already do. It is safe to deploy on its own, ahead of the Functions
deploy in Step 2, in either order.

### What to observe

The Firebase Console's **Firestore → Rules** tab shows a new rules version with a timestamp
matching this deploy.

### Rollback

```bash
git checkout -- firestore.rules
firebase deploy --only firestore:rules --project worship-planner-bc515
```

Nothing depends on this rule existing except the (not-yet-live) super-admin surface itself, so
reverting it is harmless to every other user and collection.

---

## Step 2 — Deploy the two Functions

```bash
firebase deploy --only functions:syncSuperAdminClaim,functions:setSuperAdminClaim --project worship-planner-bc515
```

**This must happen BEFORE Step 3's bootstrap run.** `syncSuperAdminClaim` is the trigger that
turns a `superAdmins/{uid}` document into the actual `superAdmin` claim for every *subsequent*
grant/revoke made through the console's `setSuperAdminClaim` onCall. If Step 3 is run before this
deploy, the bootstrap script still succeeds on its own — it is written as a deliberate exception
that calls `mergeAndSetCustomClaims` directly, bypassing the trigger, specifically so the very
first grant does not depend on deploy ordering (Pitfall 6 / `bootstrapSuperAdmin.ts`'s own design).
But deploy the Functions first anyway: skipping this step means any *later* in-console grant or
revoke via the Owner Console roster panel silently does nothing (the doc write happens, but no
trigger exists to turn it into a claim change).

### What to observe

The Firebase Console's **Functions** list shows both `syncSuperAdminClaim` (Firestore trigger on
`superAdmins/{uid}`) and `setSuperAdminClaim` (callable) as newly deployed.

### Rollback

Redeploy the prior version of `functions/src/index.ts` (i.e. without these two exports), or simply
delete the two functions from the Firebase Console if no undeploy target is convenient. Nothing
else in this phase's rules or client code depends on these Functions existing to remain
harmless — an absent `syncSuperAdminClaim` just means grants/revokes stop propagating to claims
until it's redeployed.

---

## Step 3 — Bootstrap the first super-admin

Dry run is the **default** — this is deliberate (mirrors `backfillOrgClaims.ts`'s convention, per
CONTEXT.md's Open Question 2 resolution). Always run the dry run first and read its output before
ever passing `--apply`.

```bash
cd functions
npm run build
node lib/bootstrapSuperAdmin.js --email <owner-email>
```

Read the printed project id and the `DRY RUN` banner, and confirm the target email/uid resolved
is exactly the account you intend to grant. Once it looks correct, run for real:

```bash
node lib/bootstrapSuperAdmin.js --email <owner-email> --apply
```

`--apply` writes `superAdmins/{uid}` **and** calls `mergeAndSetCustomClaims` directly for the
resolved uid — it does not wait on or depend on the `syncSuperAdminClaim` trigger from Step 2,
though Step 2 should still be deployed first per the note above (this is the belt; the trigger
being deployed already is the suspenders for every grant/revoke after this one).

The single `--apply` gate is deliberate — no extra confirmation flag — consistent with
`backfillOrgClaims.ts`'s established convention in this repo.

### Rollback

If the wrong account was granted, revoke it the same way any super-admin revoke happens: sign in
as that (now) super-admin account (or any other super-admin) and use the Owner Console roster
panel's revoke action against the mistaken email — this deletes `superAdmins/{uid}` and calls
`revokeRefreshTokens(uid)`. If no other super-admin exists yet to do this from the console, clear
the claim directly via the Firebase Console's Authentication → user detail page, or a one-off
admin script calling `getAuth().setCustomUserClaims(uid, null)` — then also delete the
`superAdmins/{uid}` Firestore document by hand so the two stay in sync.

---

## Step 4 — First-login token refresh

The account just granted in Step 3 must **sign out and back in (or otherwise force a token
refresh)** before it sees `superAdmin` client-side. The app already does this via
`getIdTokenResult(user, true)` in `loadOrgContext` (`src/stores/auth.ts`) on every load, but a tab
that was already open and signed in before the bootstrap ran is holding a stale token in memory
until its own next refresh cycle. Simplest: close and reopen the app, or explicitly sign out and
sign back in. Once the fresh token is loaded, the "Owner Console" nav entry appears and
`/owner-console` is reachable.

---

## Known limitations and residual risks

1. **Revoked-token residual window (≤1hr, T-68-05c).** `setSuperAdminClaim`'s revoke path deletes
   `superAdmins/{targetUid}` and calls `getAuth().revokeRefreshTokens(targetUid)`, which
   invalidates that user's session at their *next server-verified check* (their next attempt to
   mint a new ID token). But an ID token already issued and sitting in the browser before the
   revoke keeps its baked-in `superAdmin: true` claim client-side for up to that token's remaining
   lifetime — Firebase ID tokens are fixed at a 1-hour lifetime, non-configurable. This is a
   **bounded, documented window, not instantaneous cutoff.** Firestore rules re-evaluate the token
   on every request server-side, so `revokeRefreshTokens` is still meaningfully protective (the
   revoked user cannot mint a *new* valid token), but treat "revoked" as "cut off within the hour,"
   never "cut off immediately," when reasoning about an urgent de-escalation.
2. **Grant propagation is also token-refresh-gated.** A freshly granted super-admin does not see
   `superAdmin` until their next token refresh (Step 4 above) — same model already established for
   `orgId`/`role` claims since v1.5. There is no real-time push channel that force-refreshes other
   open sessions.
3. **The client route guard is convenience only.** `requiresSuperAdmin` and the nav-entry gate in
   `AppSidebar.vue` exist purely so a non-super-admin doesn't see a dead-end page; they carry zero
   security weight. The enforced boundary is entirely server-side: `firestore.rules`'
   `isSuperAdmin()` on `appConfig/*`/`superAdmins/*`, and `setSuperAdminClaim`'s own caller
   re-check (token claim + fresh Firestore doc read) before it will act on any grant/revoke
   request. Never reason about this phase's security as if the client guard were doing any of the
   real work.

---

## Deferred manual verification (owner, via `/gsd-verify-work 68`)

These items are recorded in `.planning/PENDING-VERIFICATION.md` per the v1.9 standing autonomy
grant ("defer human verification to the end; never record a deferred check as passed") and are
**not** run by this file or any automated gate in this phase:

- **R177 — real-route redirect.** Signed in as a genuine super-admin, confirm the "Owner Console"
  nav entry appears and `/owner-console` loads; signed in as an ordinary user, confirm the nav
  entry is absent and a direct visit to `/owner-console` redirects to the safe default (`services`).
- **R179 — real grant/revoke end-to-end.** From the deployed console, grant a test user by email
  and then revoke them; confirm the roster updates live, the target actually gains/loses
  `superAdmin` on their next token refresh, and the callable's `permission-denied`/`not-found`
  errors surface as readable messages in the UI.
- **R176 — production `--apply`.** This runbook's Step 3, actually executed against the
  production project (`worship-planner-bc515`), granting the real first owner account. Everything
  up to this point has only been proven via unit tests against the Firebase Admin SDK emulation in
  `functions/src/bootstrapSuperAdmin.test.ts`.
- **R179 — real revoke session-cutoff timing.** Confirm, against a real signed-in session, that a
  revoked account's *existing* open tab actually loses access within the documented ≤1hr window
  (not instantly) — the unit test suite only proves `revokeRefreshTokens` is called, not the
  real-world timing of Firebase's server-side session invalidation.

---

## If something goes wrong

The fastest recovery at any point after Step 1 is to revert whichever piece just changed (rules
via Step 1's rollback, Functions via Step 2's rollback) and redeploy — neither rules nor the two
Functions can lock any *existing* (non-super-admin) user out of anything, since `appConfig/*` and
`superAdmins/*` were unreachable to everyone before this phase. If a bootstrap grant landed on the
wrong account, follow Step 3's rollback to revoke it. If the granted owner simply doesn't see the
nav entry yet, that's very likely just Step 4 (a stale token) — sign out and back in before
assuming anything is broken.
