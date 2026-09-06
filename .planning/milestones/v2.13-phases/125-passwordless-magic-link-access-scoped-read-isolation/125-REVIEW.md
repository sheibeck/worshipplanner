---
phase: 125-passwordless-magic-link-access-scoped-read-isolation
reviewed: 2026-09-06T00:58:30Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - firestore.rules
  - functions/src/index.ts
  - functions/src/messageTokens.ts
  - src/router/index.ts
  - src/rules.test.ts
  - src/stores/services.ts
  - src/stores/volunteerAuth.ts
  - src/utils/rehearseAccess.ts
  - src/views/VolunteerLinkCompleteView.vue
  - src/views/VolunteerSignInView.vue
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 125: Code Review Report

**Reviewed:** 2026-09-06T00:58:30Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the passwordless volunteer magic-link feature: `firestore.rules`' new `rehearseAccess`
block, the server-side `generateSignInWithEmailLink` insertion in `functions/src/index.ts`, the
client-side email-link completion store (`src/stores/volunteerAuth.ts`), the PII-safe projection
builder (`src/utils/rehearseAccess.ts`), the `services.ts` lock/reopen/delete lifecycle writes, the
router's `isVolunteerRoute` exemption, and the two new volunteer-facing views.

The individual mechanics reviewers were asked to weight toward — continue-URL safety, per-recipient
failure isolation, cross-org isolation, live re-check of parent status, no email/link leakage into
logs, no email-from-URL-param trust, and the `isVolunteerRoute` exemption's narrowness — all check
out and are backed by targeted tests (`src/rules.test.ts` R377 suite, `volunteerAuth.test.ts`,
`rehearseAccess.test.ts`, `router.test.ts`'s Pitfall 1 suite).

However, tracing the **email-claim trust chain** end-to-end (not just the new files, but what
already existed in `src/stores/auth.ts` that the new rule now leans on) surfaces one critical gap:
the `rehearseAccess` rule's volunteer arm trusts `request.auth.token.email` as proof the caller
legitimately received the magic link, but the app's pre-existing `loginWithEmail()` **silently
auto-creates an unverified password account for any email typed at `/login`** if no account exists
yet. Nothing in `firestore.rules` ever checks `request.auth.token.email_verified`. That combination
lets an attacker "claim" any not-yet-registered volunteer's email — for free, with no access to
that person's inbox — and satisfy the exact same rule a real magic-link volunteer relies on. See
CR-01 below; this is rated a blocker because it defeats the feature's own stated security model
("the ONLY grant is an email-claim match").

A handful of lower-severity robustness/UX gaps are also noted (a silent no-op in the
`markAsPlanned` projection write, a router redirect inconsistency for `/login`, and a couple of
code-quality/coverage items).

## Critical Issues

### CR-01: `rehearseAccess`'s email-claim check can be forged via the pre-existing password auto-register flow — no `email_verified` check anywhere in the trust chain

**File:** `firestore.rules:293-299` (root cause also in `src/stores/auth.ts:856-874`, pre-existing, not part of this phase's diff but directly weaponized by it)

**Issue:**
The volunteer arm of the `rehearseAccess` read rule is:

```
allow read: if isOrgMember(orgId)
  || (
    isSignedIn()
    && request.auth.token.email != null
    && parentIsPlanned()
    && request.auth.token.email.lower() in resource.data.get('assignedEmailsLower', [])
  );
```

This treats **any signed-in user whose ID token carries a given `email` claim** as equivalent to
"this person legitimately received the magic-link email at that address." That equivalence is
false, because `src/stores/auth.ts`'s `loginWithEmail()` — reachable by anyone, unauthenticated, at
the public `/login` route — does this:

```ts
async function loginWithEmail(email: string, password: string): Promise<User | null> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    ...
  } catch (error: unknown) {
    if (firebaseError?.code === 'auth/user-not-found' || ...) {
      // Auto-create account on first sign-in
      const result = await createUserWithEmailAndPassword(auth, email, password)
      ...
    }
  }
}
```

If nobody has ever signed up with a given email, typing that email + **any password of the
attacker's choosing** on the public login form silently **creates** a Firebase Auth account for
that address — with `email_verified: false` and no verification email ever sent (grep confirms
`sendEmailVerification`/`email_verified` appear nowhere in `auth.ts`). The resulting ID token's
`email` claim is exactly the value the attacker typed, and `firestore.rules` has no check anywhere
in the file for `request.auth.token.email_verified`.

**Concrete attack:** an attacker who knows (a) a church's `orgSlugs/{slug}` entry (public `get`,
line 462 of `firestore.rules`, resolves to the orgId) and (b) a scheduled volunteer's email address
(commonly non-secret in a church roster/team context — a fellow volunteer, a forwarded email, a
public staff directory) can:
1. Go to `/login`, type the volunteer's email with an arbitrary password → Firebase silently
   creates an unverified account with that email (or, worse, if the real volunteer hasn't signed up
   yet and later opens their genuine magic link, `signInWithEmailLink` resolves to this SAME
   attacker-created account — an outright account takeover, not just a parallel read).
2. `getDoc(organizations/{orgId}/rehearseAccess/{serviceId})` for any Planned service where that
   email is in `assignedEmailsLower` now succeeds — no magic link, no inbox access, ever required.

This is not a hypothetical Firebase quirk; it is this codebase's own, already-shipped
account-creation path being reused against a brand-new rule that assumes an email claim implies
inbox ownership. Nothing in the new `src/rules.test.ts` R377 suite (or anywhere else) exercises an
`email_verified: false` token, so the gap has no test coverage either.

**Fix:** require `email_verified` in the volunteer arm (mirrors Firebase's own guidance for any
email-claim-based authorization; `signInWithEmailLink` and Google sign-in both set
`email_verified: true`, so this does not affect any legitimate path):

```
allow read: if isOrgMember(orgId)
  || (
    isSignedIn()
    && request.auth.token.email != null
    && request.auth.token.email_verified == true
    && parentIsPlanned()
    && request.auth.token.email.lower() in resource.data.get('assignedEmailsLower', [])
  );
```

Add a `rules.test.ts` case asserting `assertFails` for an `authenticatedContext(uid, { email:
'dana@example.com', email_verified: false })` read of an otherwise-matching `rehearseAccess` doc,
and `assertSucceeds` with `email_verified: true`.

Note: `organizations/{orgId}/invites/{email}`'s create/delete rules (`firestore.rules:173-185,192`)
and `inviteLookup/{email}` (`:387-401`) have the identical `token.email` trust gap, pre-dating this
phase — worth folding into the same remediation pass since the root cause (and fix) is identical,
even though those paths are narrower (they additionally require a pre-existing invite doc created
by a trusted editor, which `rehearseAccess`'s roster-driven `assignedEmailsLower` does not).

## Warnings

### WR-01: `markAsPlanned`'s `rehearseAccess` write (and the `lastUsedAt` recompute) is silently skipped if the service isn't in the local cache

**File:** `src/stores/services.ts:566-616`

**Issue:** The service's Firestore status is flipped to `'planned'` unconditionally at line 570-573,
but the R377 projection write that grants volunteers rehearsal access only runs inside `if (service)
{ ... }` where `service = services.value.find((s) => s.id === id)` (line 576) — a lookup against
the store's **local**, possibly-stale `onSnapshot` cache, not a fresh read. If this lookup misses
for any reason (the service was just created and the listener hasn't delivered it yet, a
multi-tab/timing race, or the store was re-subscribed to a different org mid-flight), the entire
block — including the `rehearseAccess` write — is skipped with **no error, no log, no user-facing
failure**. The service is now `Planned` in the UI, editors believe messages/links will work, and no
`rehearseAccess` doc exists until the service happens to go through another
reopen→edit→markAsPlanned cycle.

**Fix:** Don't gate the projection write on the in-memory find; read the service directly (e.g.
`await getDoc(...)`) or at minimum log an explicit error when `service` is undefined so the silent
gap is visible in Sentry/console rather than only discoverable when a volunteer reports "my link
doesn't work":

```ts
const service = services.value.find((s) => s.id === id)
if (!service) {
  console.error(`markAsPlanned: service ${id} not found in local cache — rehearseAccess projection NOT written`)
} else {
  ...
}
```

### WR-02: Signed-in volunteer manually revisiting `/login` is misrouted to `/select-church` (a dead end) instead of `/volunteer`

**File:** `src/router/index.ts:265-278`

**Issue:** The `isVolunteerRoute` exemption is applied to the org-selection gate at line 216, but
the separate `to.name === 'login'` bounce-back block near the bottom of the guard does not know
about volunteers at all:

```ts
if (to.name === 'login') {
  const user = await getCurrentUser()
  if (user) {
    ...
    if (authStore.requiresOrgSelection) {
      return { name: authStore.isChurchlessSuperAdmin ? 'owner-console' : 'select-church' }
    }
    ...
  }
}
```

A magic-link volunteer (zero org memberships → `requiresOrgSelection === true`, and not a
super-admin) who is already signed in and navigates back to `/login` (bookmark, browser back
button, typed URL) is sent to `/select-church` — a picker with nothing to pick — instead of back to
`/volunteer`. Not a security issue (the rule boundary is unaffected), but a UX dead end for the one
user population this phase is building for.

**Fix:** mirror the exemption used at line 216 — treat a zero-membership, non-super-admin user the
same way `authStore.requiresOrgSelection` is already special-cased, or route explicitly to
`volunteer-home` when the signed-in user has no memberships and isn't a super-admin.

### WR-03: `VolunteerSignInView.vue`'s "remember this email" input isn't lowercased before being stored, inconsistent with the codebase's email-normalization convention

**File:** `src/views/VolunteerSignInView.vue:134-137`

**Issue:**

```ts
function handleRememberEmail(): void {
  window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, rememberEmail.value.trim())
  ...
}
```

Every other email-claim comparison in this phase (and the codebase generally — `invites/{email}`,
`rehearseAccess`'s `assignedEmailsLower`) normalizes to lowercase before comparing/storing. Here,
whatever case the volunteer types (e.g. `Dana@Example.com`) is stored verbatim and later passed
as-is to `signInWithEmailLink(auth, email, url)` in `volunteerAuth.ts:71`. If Firebase's email-link
verification is case-sensitive in any environment/SDK version, a volunteer who types their email in
different case than their roster record could hit a spurious `auth/invalid-action-code`-style
failure on the cross-device fallback path with no indication why.

**Fix:** `rememberEmail.value.trim().toLowerCase()`.

### WR-04: No test exercises a `generateSignInWithEmailLink` rejection to prove per-recipient failure isolation (T-125-13)

**File:** `functions/src/index.test.ts` (gap), implementation at `functions/src/index.ts:2198-2252`

**Issue:** The code correctly places `getAuth().generateSignInWithEmailLink(...)` inside the
existing per-recipient `try/catch` (confirmed by inspection: a throw here is caught, logs
`target.id` only, marks that one recipient `'failed'`, and the loop continues). The comment at
line 2196 explicitly claims this isolation as a load-bearing property ("T-125-13"), but no test in
`functions/src/index.test.ts` ever mocks `generateSignInWithEmailLink` to reject and asserts the
other recipients in the same batch still succeed. This is exactly the kind of regression a future
refactor (e.g. hoisting the link generation above the loop "for efficiency") could silently break.

**Fix:** add a `sendQueuedMessage` test where `generateSignInWithEmailLink` rejects for one
recipient (`mockRejectedValueOnce` or per-call conditional) and assert `sentCount`/`failedCount` and
the surviving recipients' `recipients/{id}` docs.

## Info

### IN-01: Sequential per-token regex substitution allows one token's rendered value to be re-substituted by a later token pass

**File:** `functions/src/messageTokens.ts:45-57`

**Issue:** `renderMessageTokens` runs six independent `replaceToken` passes in sequence
(`service_date`, `their_roles`, `name`, `song_list`, `service_link`, `rehearse_link`). Each pass is a
plain string `.replace()` over the **already-partially-substituted** output. If any earlier-inserted
value (e.g. `recipientName` or a song title, both editor/roster-controlled) happens to literally
contain the substring `{{rehearse_link}}`, the later `rehearse_link` pass will substitute the
volunteer's own magic sign-in link into what was meant to be a literal part of their name. This is
self-inflicted (only the org's own trusted editor/roster data can trigger it, no cross-tenant path),
but it is a real reinjection footgun that gets slightly more sensitive now that a personal
authentication link (`rehearse_link`) is one of the chained values, versus the previous four
lower-stakes tokens.

**Fix (optional, low priority):** render all tokens from the ORIGINAL template into a single pass
(e.g. one combined regex with a lookup map) rather than cascading `.replace()` calls, so an
inserted value can never itself be re-scanned for `{{...}}` markers.

### IN-02: `rehearseAccess` write rule has no field/shape validation

**File:** `firestore.rules:301-305`

**Issue:** `allow write: if isOrgEditor(orgId);` places no constraint on the shape of what's written
(unlike, e.g., `slideGroups`' `hasAll(['serviceId'])`/immutability checks, or `services`' `keys()`
diff checks). Since only an already-fully-trusted org editor can write here, this is not a security
gap, but it does mean a client bug that writes a malformed `rehearseAccess` doc (missing
`assignedEmailsLower`, wrong `orgId`) has no server-side backstop beyond `resource.data.get(...,
[])`'s default. Worth a defense-in-depth `hasAll(['serviceId','orgId','assignedEmailsLower'])` check
if this doc's shape becomes load-bearing for more than the current read rule.

### IN-03: Pre-existing `token.email` trust gap in `invites/{email}` and `inviteLookup/{email}` (same root cause as CR-01, narrower blast radius)

**File:** `firestore.rules:173-185, 192, 387-401`

**Issue:** Called out under CR-01's fix — flagged separately here because these paths are outside
this phase's diff (pre-existing) but share the exact same unverified-email trust assumption. Their
blast radius is smaller today (both require a trusted editor to have already created a
matching invite/lookup doc at that exact email), so not rated a blocker for this phase, but should
be fixed in the same pass as CR-01 rather than re-discovered later.

---

_Reviewed: 2026-09-06T00:58:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
