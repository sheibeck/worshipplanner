# Phase 125: Passwordless Magic-Link Access & Scoped Read Isolation - Research

**Researched:** 2026-09-05
**Domain:** Firebase passwordless auth (email-link) + Firestore/Storage isolation rules design
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sign-in flow & link delivery (R374, R375)**
- Use Firebase Authentication **email-link (passwordless) sign-in** — `sendSignInLinkToEmail` +
  `signInWithEmailLink`. No password is ever set, requested, or stored. Uniform for all volunteers
  (including Gmail/Google-account holders) — do NOT branch to Google sign-in the way v2.5 invites do; the
  magic link is the single promoted path.
- The sign-in link is embedded in the **existing v1.7 volunteer-messaging emails** (reminder + share types)
  as a "Rehearse / My Schedule" CTA. Reuse the Resend send path (`functions/src/adminEmail.ts` pattern) and
  the existing recipient resolution — **do NOT build a new email system**. Only the link is added.
- The address used is the volunteer's **roster email** (already resolved by the messaging recipient
  resolver). Follow Firebase's documented email-link flow: persist the target email in `localStorage` when
  the link is requested/opened, and if it is absent (link opened on a different device) prompt the volunteer
  to re-enter their email to complete sign-in.
- **Owner prerequisite (tracked, like v2.5's Email/Password enablement):** the Firebase console must have
  **Email/Password → Email link (passwordless sign-in)** enabled for `worship-planner-bc515`, and the
  sign-in continue-URL domain must be authorized. Note this in the plan's owner-run steps; do not assume it.

**Session, identity & sign-out (R376)**
- The volunteer becomes a real Firebase Auth user (uid) with standard local persistence — the session
  survives a browser refresh. Reuse the existing `auth.ts` / auth-store initialization; add a volunteer
  session shape rather than forking auth.
- Playback position + downloads are attributed to that uid (not anonymous). Keep persistence **light for
  v1**: playback position may live in `localStorage` keyed by uid+track (no Firestore writes required);
  "downloads are theirs" is satisfied simply by the action happening as the authenticated user.
- Explicit **sign out** from the volunteer surface (the My Schedule header user chip), returning to a
  volunteer sign-in landing.

**Scoped read-access mechanism & isolation (R377 — SECURITY CORE)**
- A magic-link volunteer is an authenticated Firebase user but is **NOT an org member** (no `members/{uid}`
  doc, no editor/admin/superAdmin claim). Existing org-scoped rules key on the membership claim, so they
  **DENY this session by default** — the correct, fail-closed baseline. This phase adds only a **narrow,
  purpose-built read path**, never a broad grant.
- **Hard constraint:** the mechanism MUST be provable in the Firestore/Storage emulator. **No cross-service
  `firestore.exists()` in `storage.rules`** (the documented deny-everyone blind spot, firebase-js-sdk#6803 —
  see CLAUDE.md). Attachment **files** are served to volunteers via **Firebase Storage download-token URLs**
  (the bearer capability v2.11 already generates for downloads) carried in the data — NOT by widening
  `storage.rules` on `orgs/{orgId}/**`.
- **Recommended direction (finalize in phase-research/planning):** a **denormalized rehearse-access
  projection**, mirroring how `buildServiceSnapshot()` / `ShareView.vue` freeze a PII-safe projection rather
  than opening the live org tree. Research chooses between:
  - **(a) Assignment-indexed rehearse docs** — when a service becomes Planned (locked), write a
    volunteer-readable projection keyed so a volunteer's rules read only rows where their uid/roster-email is
    an assigned participant; media referenced by download-token URL. (Preferred — emulator-testable, no
    cross-service reads, no `orgs/**` widening.)
  - **(b) Scoped live rules** — allow a volunteer to read a Planned service + its songs' attachment metadata
    only when expressible **without** cross-service `exists()`; use only if it can be proven in the emulator.
- **Isolation guarantee (must be tested, not asserted):** a STRIDE-lite threat model + Firestore/Storage
  emulator **ALLOW/DENY** tests proving, at minimum: cross-org read DENIED; Draft (unlocked) service read
  DENIED; not-assigned service read DENIED; planner/editor collection writes DENIED; no cross-org
  list/enumeration. This is the phase's **security gate — non-negotiable, runs inline (not deferred UAT)**.

**Volunteer routing / surface separation (R377 defense-in-depth)**
- Volunteer routes are **separate** from planner routes (e.g. `/my-schedule`, `/rehearse/:serviceId`). A
  volunteer session is routed to My Schedule and **never** the planner app shell / service editor.
- Router guards: a volunteer (authenticated, non-member) may reach only volunteer routes; planner routes
  require membership/editor and deny/redirect a volunteer session. This is **UI defense-in-depth layered on
  top of** the data-layer rules — R377's guarantee lives at the data layer, per the success criteria.
- A user who is BOTH a member (planner) and assigned can use both surfaces; My Schedule is reachable by
  anyone assigned to a service (keyed off assignment, not role).

### Claude's Discretion
- Exact denormalization shape (a) vs (b), the projection's document schema, route paths, and the
  playback-position storage key are at the planner's discretion within the constraints above.

### Deferred Ideas (OUT OF SCOPE)
- Per-org storage quota + egress/budget alerting (owner-deferred to backlog for the whole milestone).
- Server-side playback-position sync across devices (localStorage per-uid is enough for v1).
- Rehearse UI (Phase 127) and My Schedule (Phase 126) consume this phase's session + scoped-read contract.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R374 | Volunteer signs in without a password via Firebase email-link tied to roster email | §Standard Stack, §Architecture Patterns Pattern 1, §Code Examples (client flow) |
| R375 | Magic sign-in link delivered through existing v1.7 messaging emails (reminder/share), no new email system | §Architecture Patterns Pattern 2, §Code Examples (`sendQueuedMessage` insertion point) |
| R376 | Session persists across refresh, explicit sign-out, playback/downloads attributed to uid | §Architecture Patterns Pattern 1 (session), §Common Pitfalls #1 (router trap) |
| R377 | Read-only, scoped access — own org, Planned, assigned only; never planner/editor/other-org/Draft; data-layer proof | §Architecture Patterns Pattern 3, §Common Pitfalls #2–#5, §Validation Architecture, §Security Domain |
</phase_requirements>

## Summary

This phase adds a **second, structurally distinct identity class** to an app whose entire router/store
architecture (`src/stores/auth.ts`, `src/router/index.ts`) was built around exactly one shape: "authenticated
user who either belongs to 1+ orgs (`members/{uid}` docs + claims) or is a super-admin." A magic-link
volunteer is authenticated but deliberately has **neither** — no membership doc, no `orgId`/`role`/`orgs`
claim. That is exactly the fail-closed baseline CONTEXT.md wants, but it also means the volunteer trips the
*existing* `hasNoOrg` / `requiresOrgSelection` computed properties in `auth.ts` (memberships.length === 0),
which the router's `beforeEach` guard (`src/router/index.ts:190`) currently redirects to `/select-church` for
every `requiresAuth` route except the super-admin console and the picker itself. **New volunteer routes must
be added to that exemption list** or a signed-in volunteer will bounce to a church-picker screen that has
nothing for them — this is the single most important non-obvious wiring fix in this phase and is detailed in
Common Pitfall #1.

For R377, the codebase already contains every primitive the isolation guarantee needs, proven by three
independent precedents already shipped and tested: (1) `firestore.rules` already grants a narrow,
non-membership read/delete via `request.auth.token.email.lower() == <key>` (the `invites/{email}` and
`inviteLookup/{email}` blocks) — proof that Firestore rules can scope access purely off the ID token's
`email` claim with **zero custom claims and zero cross-service calls**; (2) `shareTokens/{token}` is the
exact "frozen, PII-safe projection, link-is-the-auth" pattern CONTEXT.md points to, built by
`buildServiceSnapshot()`; (3) `SongAttachment.downloadUrl` (v2.11) is **already** a denormalized Storage
download-token URL — "reads never need a rules round-trip" per its own doc comment — so **no `storage.rules`
change is needed at all** for volunteer file access. The recommended mechanism is therefore: a
`organizations/{orgId}/rehearseAccess/{docId}` collection, one doc per Planned service, written client-side
by the locking editor (mirroring the existing `lockSnapshots` precedent) at the draft→planned transition,
carrying an `assignedEmailsLower: string[]` field and a frozen read-only projection (service + song +
attachment `downloadUrl`s, no live joins). The read rule is
`isOrgMember(orgId) || (request.auth.token.email.lower() in resource.data.assignedEmailsLower)`, plus a
**live** re-check against the parent service's current `status` (see Common Pitfall #3) so a since-reopened
service stops being readable without a separate cleanup step. No new npm packages are required anywhere in
this phase.

**Primary recommendation:** Build on Firebase Auth email-link sign-in (already-installed `firebase` 12.0.0 /
`firebase-admin` 13.10.0, no new deps), mint the sign-in link **server-side** with
`getAuth().generateSignInWithEmailLink()` inside the existing `sendQueuedMessage` trigger
(`functions/src/index.ts:2253`) rather than calling client-side `sendSignInLinkToEmail()` (which would fire
Firebase's own separate email — exactly the "new email system" R375 forbids), and gate volunteer reads with
a lock-time `rehearseAccess` projection keyed by `request.auth.token.email.lower()`, never a cross-service
Storage `exists()`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Magic-link request + completion (sign-in UI) | Browser / Client | API/Backend (Firebase Auth service) | `sendSignInLinkToEmail`/`signInWithEmailLink` are client SDK calls against Firebase Auth; no app backend involved |
| Magic-link generation for email delivery | API / Backend (Cloud Function) | — | Must use Admin SDK `generateSignInWithEmailLink()` server-side so the link can be embedded in the existing Resend email instead of Firebase sending its own |
| Session persistence + sign-out | Browser / Client | — | Firebase Auth's default `browserLocalPersistence`; `auth.ts`'s existing `onAuthStateChanged`/`logout()` |
| Scoped read authorization (R377 core) | Database / Storage (Firestore rules) | — | The enforced boundary MUST live in `firestore.rules`, not client code or router guards (data-layer, per CONTEXT.md) |
| Volunteer route separation | Browser / Client (Vue Router guard) | Database / Storage (defense-in-depth) | UI-layer denial is explicitly secondary to the rules; router guard prevents accidental UI exposure only |
| Attachment file delivery | CDN / Static (Storage bearer URL) | — | v2.11's `downloadUrl` capability token bypasses storage.rules entirely — no rule change needed |
| Rehearse projection write (at lock time) | API / Backend (client-invoked, editor-authored) | — | Mirrors `lockSnapshots`: an org editor writes it client-side under `isOrgEditor(orgId)`, not a Cloud Function |

## Standard Stack

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase` | `^12.0.0` [VERIFIED: package.json] | Client SDK — `sendSignInLinkToEmail`, `isSignInWithEmailLink`, `signInWithEmailLink` | Already the app's only auth SDK; email-link is a stock `firebase/auth` export, no new package |
| `firebase-admin` | `^13.10.0` [VERIFIED: functions/package.json] | Server SDK — `getAuth().generateSignInWithEmailLink(email, actionCodeSettings)` | Official server-side link-generation API; lets the app embed the link in its own email instead of Firebase's default template [CITED: firebase.google.com/docs/auth/admin/email-action-links] |
| `resend` | `6.19.0` [VERIFIED: functions/package.json] | Email delivery (existing `sendQueuedMessage` trigger) | Already the app's only transactional-email provider; no new send path per R375 |

### Supporting
None. This phase introduces **no new third-party dependency** — everything needed (email-link auth,
link generation, existing Resend send loop, existing rules-emulator harness) is already installed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side `sendSignInLinkToEmail()` (Firebase sends its own email) | Server-side `generateSignInWithEmailLink()` embedded in the existing Resend template | The client call is simpler but violates R375 ("do NOT build a new email system") by triggering a second, Firebase-branded email alongside the reminder — server-side generation is the only way to keep ONE email |
| Denormalized `rehearseAccess` projection (recommended) | Scoped live Firestore rules reading `services/{id}` + `songs/{id}` directly | Live rules would need a `get()` on the roster/quarter documents to resolve "is this email assigned," which is a heavier, harder-to-test, multi-hop rule; the projection is a single-doc, single-field check, matching the `shareTokens` precedent already proven in this codebase |
| Custom auth claim for "is a volunteer with assignment X" | Plain `request.auth.token.email` matching (recommended) | A custom claim requires a Cloud Functions trigger + token-refresh propagation delay (the same class of latency `refreshOrgClaim`'s 4-attempt retry in `auth.ts` exists to paper over for org members); email-claim matching is instant — Firebase issues the `email` claim on every ID token with zero extra plumbing |

**Installation:** None required — no `npm install` needed for this phase.

**Version verification:** `firebase@12.0.0` and `firebase-admin@13.10.0` confirmed directly from
`package.json`/`functions/package.json` in this repo [VERIFIED: package.json read 2026-09-05]. Both
predate and fully support `signInWithEmailLink`/`generateSignInWithEmailLink`, which have been stable
Firebase Auth APIs since SDK v9 (modular) / admin SDK v10 — no version-specific gotchas found for this
range [CITED: firebase.google.com/docs/auth/web/email-link-auth, firebase.google.com/docs/auth/admin/email-action-links].

## Package Legitimacy Audit

**No new packages are introduced by this phase.** Every capability (email-link auth, server-side link
generation, transactional email) ships in `firebase`/`firebase-admin`/`resend`, all already installed and
already used elsewhere in this codebase (`src/stores/auth.ts`, `functions/src/index.ts`). The Package
Legitimacy Gate is not applicable — no `npm view`/registry check is needed.

## Architecture Patterns

### System Architecture Diagram

```
 Volunteer's browser                          Firebase Auth               Firestore
 ┌─────────────────────┐                      ┌───────────┐               ┌────────────────────────┐
 │ /volunteer/sign-in   │  (unused this v1 —   │           │               │ organizations/{orgId}/  │
 │  (email re-entry     │   link comes via     │           │               │   rehearseAccess/{id}   │
 │   fallback only)     │   email, not typed   │           │               │  {status, assigned      │
 └──────────┬───────────┘   here first)        │           │               │   EmailsLower[],        │
            │                                   │           │               │   songs[+downloadUrl]}  │
            │ 1. clicks emailed magic link      │           │               └───────────▲─────────────┘
            ▼                                   │           │                            │ 4. scoped read
 ┌─────────────────────┐  isSignInWithEmailLink │           │  signInWithEmailLink        │  (email-claim
 │ /volunteer/verify    │──────────────────────▶│  Auth     │────────────────────────────▶│   match, NOT
 │  completion route    │  (localStorage        │  service  │  2. verifies + returns uid  │   membership)
 │                      │   emailForSignIn, or   │           │     + ID token w/ `email`   │
 │                      │   re-entered on new    │           │     claim (no org claims)   │
 │                      │   device)             └───────────┘                              │
 └──────────┬───────────┘                                                                   │
            │ 3. router: isVolunteerRoute exempts                                            │
            │    the org-selection redirect                                                  │
            ▼                                                                                │
 ┌─────────────────────┐                                                                     │
 │ /my-schedule         │─────────────────────────────────────────────────────────────────────┘
 │ /rehearse/:serviceId │   Firestore rule: isOrgMember(orgId)
 │  (Phases 126-127)    │     || request.auth.token.email.lower()
 └──────────┬───────────┘       in resource.data.assignedEmailsLower
            │
            │ 5. song file download (no rules round-trip)
            ▼
 ┌─────────────────────┐
 │ Firebase Storage     │  GET .../song-files/{id}/{file}?alt=media&token=...
 │ orgs/{orgId}/        │  (bearer download-token URL, minted at v2.11 upload time,
 │  song-files/**       │   denormalized onto SongAttachment.downloadUrl — no
 │                      │   storage.rules evaluation needed for this GET)
 └─────────────────────┘

 ── separately, at lock time (editor-side, planner app) ──
 Editor's browser (ServiceEditorView, isOrgEditor)
    draft --lock--> planned
        └── writes organizations/{orgId}/rehearseAccess/{serviceId} (mirrors lockSnapshots)
                using resolveServiceRoleAssignments() + SongAttachment.downloadUrl
                (client-side, no new Cloud Function)

 ── separately, on message send (existing v1.7 pipeline) ──
 sendQueuedMessage (functions/src/index.ts:2253, onDocumentCreated, Resend)
    for each recipient in sendList:
        rehearseLink = await getAuth().generateSignInWithEmailLink(target.email, actionCodeSettings)
        tokenCtx.rehearseLink = rehearseLink   // NEW merge-token field
        renderMessageTokens(subject/body, tokenCtx)   // {{rehearse_link}} in template
        resend.emails.send(...)   // ONE email, same as today
```

### Recommended Project Structure
```
src/
├── router/index.ts               # ADD: /volunteer/verify, /my-schedule, /rehearse/:serviceId
│                                  #   routes with meta: { requiresAuth: true, isVolunteerRoute: true }
│                                  #   ADD: !to.meta.isVolunteerRoute to the org-selection-gate condition
├── stores/
│   └── volunteerAuth.ts          # NEW (or extend auth.ts) — email-link request/complete, localStorage
│                                  #   emailForSignIn read/write, cross-device re-entry prompt
├── views/
│   ├── VolunteerSignInView.vue    # NEW — cross-device "re-enter your email" fallback only
│   └── VolunteerLinkCompleteView.vue  # NEW — signInWithEmailLink completion handler
├── utils/
│   └── rehearseAccess.ts          # NEW — pure builder: assembles the rehearseAccess projection doc
│                                  #   from Service + resolveServiceRoleAssignments() + Song attachments
│                                  #   (mirrors buildServiceSnapshot's "pure builder in stores/services.ts" idiom)
firestore.rules                    # ADD: organizations/{orgId}/rehearseAccess/{id} match block
                                    # ADD: 'rehearseAccess' to the catch-all's write exclusion list
src/rules.test.ts                  # ADD: describe('Volunteer magic-link scoped read — R377') block
functions/src/
├── index.ts                       # EDIT: sendQueuedMessage — per-recipient generateSignInWithEmailLink,
│                                  #   new MessageTokenContext.rehearseLink field
├── messageTokens.ts                # EDIT: add {{rehearse_link}} token + rehearseLink field
└── params.ts                       # possibly ADD: a dedicated continue-URL param if distinct from
                                     #   SERVICE_SHARE_BASE_URL (see Open Questions)
```

### Pattern 1: Email-link sign-in + completion (client)
**What:** Passwordless sign-in via a one-time link, with the documented cross-device fallback.
**When to use:** The volunteer's ONLY sign-in path (R374) — no password field anywhere in the volunteer UI.
**Example:**
```typescript
// Source: firebase.google.com/docs/auth/web/email-link-auth (official docs)
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { auth } from '@/firebase'

// On /volunteer/verify (the link's continue-URL target):
if (isSignInWithEmailLink(auth, window.location.href)) {
  let email = window.localStorage.getItem('emailForSignIn')
  if (!email) {
    // Cross-device fallback (R374, CONTEXT.md) — the link was opened on a
    // different device/browser than the one that requested it.
    email = window.prompt('Please provide your email for confirmation')
  }
  const result = await signInWithEmailLink(auth, email!, window.location.href)
  window.localStorage.removeItem('emailForSignIn')
  // result.user is a real Firebase Auth uid — flows into the EXISTING
  // onAuthStateChanged listener in src/stores/auth.ts unmodified.
}
```
`ActionCodeSettings.url` must point at the app's `/volunteer/verify` route and that domain must be added to
**Authorized domains** in the Firebase console (owner prerequisite, tracked like v2.5's Email/Password
enablement). `handleCodeInApp: true` is mandatory.

### Pattern 2: Server-side link generation embedded in the existing send loop
**What:** Generate the sign-in link with the Admin SDK and merge it into the CURRENT Resend email — do not
let Firebase send its own.
**When to use:** Inside `sendQueuedMessageHandler`'s per-recipient loop (R375).
**Example:**
```typescript
// Source: firebase.google.com/docs/auth/admin/email-action-links (official docs) +
// functions/src/index.ts:2174-2196 (existing send loop, real file/lines)
import { getAuth } from "firebase-admin/auth";

const actionCodeSettings = {
  url: `${resolveAppBaseUrl()}/volunteer/verify`,
  handleCodeInApp: true,
};

for (const target of sendList) {
  // ...existing per-recipient block...
  const rehearseLink = await getAuth().generateSignInWithEmailLink(target.email, actionCodeSettings);
  const tokenCtx = {
    serviceDate, theirRoles: target.roleNames, recipientName: target.name,
    songTitles, serviceLink, rehearseLink, // NEW field
  };
  const subject = renderMessageTokens(message.subject, tokenCtx);
  const body = renderMessageTokens(message.body, tokenCtx); // template now supports {{rehearse_link}}
  // ...unchanged resend.emails.send(...) call...
}
```
`generateSignInWithEmailLink` **does not send an email** — it only returns the URL string
[CITED: firebase.google.com/docs/auth/admin/email-action-links: "Construct sign-in with email link
template, embed the link and send using custom SMTP server"]. This is the load-bearing fact that satisfies
R375's "do NOT build a new email system."

### Pattern 3: Assignment-indexed rehearse projection + email-claim rule (R377 core)
**What:** A frozen, per-service read-only projection, gated by matching the caller's own ID-token `email`
claim against a field on the document — no membership doc, no cross-service call.
**When to use:** The single read path a magic-link volunteer is granted.
**Example:**
```javascript
// Source: firestore.rules:189-192 (existing invites block, real file/lines) — the PROVEN
// precedent this pattern mirrors, adapted for the new collection.
match /organizations/{orgId}/rehearseAccess/{serviceId} {
  // Live re-check against the CURRENT service status — a same-service Firestore
  // get() (NOT a cross-service Storage exists() — see Common Pitfall #3) so a
  // service that was reopened to draft after locking stops being readable
  // even if this projection doc is still physically present.
  function parentIsPlanned() {
    return exists(/databases/$(database)/documents/organizations/$(orgId)/services/$(serviceId))
      && get(/databases/$(database)/documents/organizations/$(orgId)/services/$(serviceId))
           .data.get('status', 'draft') != 'draft';
  }

  allow read: if isOrgMember(orgId)
    || (
      isSignedIn()
      && request.auth.token.email != null
      && parentIsPlanned()
      && request.auth.token.email.lower() in resource.data.get('assignedEmailsLower', [])
    );

  // Client-writable by the locking editor only — mirrors lockSnapshots
  // (firestore.rules:256-259), NOT a Cloud Function. An editor is already
  // fully trusted within their own org (R377's boundary is cross-org/
  // non-assigned isolation, not editor-vs-editor trust).
  allow write: if isOrgEditor(orgId);
}
```
```javascript
// Source: firestore.rules:322-332 (existing catch-all, real file/lines) — MUST be
// widened, exactly like services/slideGroups/pptxRenders already are.
match /{collection}/{docId} {
  allow read: if isOrgEditor(orgId);
  allow write: if isOrgEditor(orgId)
    && collection != 'services'
    && collection != 'slideGroups'
    && collection != 'pptxRenders'
    && collection != 'rehearseAccess';   // NEW — see Common Pitfall #4
}
```

### Pattern 4: Router exemption for a non-member authenticated session
**What:** Volunteer routes must NOT participate in the org-selection redirect gate.
**Example:**
```typescript
// Source: src/router/index.ts:26-30 (route declaration idiom) + :190 (the gate to widen — real file/lines)
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresEditor?: boolean
    requiresSuperAdmin?: boolean
    isVolunteerRoute?: boolean   // NEW
  }
}
{
  path: '/my-schedule',
  name: 'my-schedule',
  component: () => import('../views/MyScheduleView.vue'), // Phase 126
  meta: { requiresAuth: true, isVolunteerRoute: true },
},

// In beforeEach, the existing org-selection gate:
if (!to.meta.requiresSuperAdmin && !to.meta.isVolunteerRoute && to.name !== 'select-church') {
  // ...unchanged...
}
```

### Anti-Patterns to Avoid
- **Client-side `sendSignInLinkToEmail()` for the volunteer flow:** sends Firebase's own separate email —
  the volunteer would get TWO emails (the reminder AND a bare Firebase-branded link email), violating R375.
  Always generate server-side and embed in the existing template.
- **Widening `storage.rules`' `isOrgMember(orgId)` read grant to cover volunteers:** unnecessary — v2.11's
  `downloadUrl` bearer-token URLs already bypass rules for the exact files a volunteer needs. Touching
  `storage.rules` at all for this phase is very likely a sign of a wrong design.
- **A cross-service `firestore.exists()` inside `storage.rules`:** the documented deny-everyone bug
  (firebase-js-sdk#6803, CLAUDE.md). Not needed here since files are served via bearer URL, not rules.
- **Trusting `resetOrgContext()`'s early return as "the volunteer is handled":** it silently leaves
  `orgId`/`userRole` null and does nothing else — the volunteer session is NOT broken by this, but any NEW
  code that assumes `orgId.value` is always non-null for an authenticated user (a common assumption
  throughout the existing codebase, e.g. `updateOrgSettings`'s `if (!orgId.value...) return`) will silently
  no-op for a volunteer. Audit anything volunteer-adjacent for this assumption.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Passwordless sign-in | A custom OTP/magic-token system on top of Firestore | Firebase Auth's native email-link provider | Already free to 50k MAU (SEED-003 cost context), console-configurable, handles link expiry/replay/rate-limiting server-side |
| "Is this email allowed to sign in" gating | A custom allowlist collection checked at sign-in time | Nothing — magic-link sign-in succeeds for ANY email (Firebase can't pre-validate against your roster); scope access AFTER sign-in via the rehearseAccess projection, not at sign-in time | Firebase email-link auth has no server-side hook to reject an email before sending the link; the security boundary belongs at the READ layer, matching R377's own framing ("access is provably read-only and scoped," not "sign-in is restricted") |
| Custom claim propagation for volunteer identity | A Cloud Functions trigger minting a `volunteer: true` custom claim, with a retry-loop for propagation delay (like `refreshOrgClaim`'s 4-attempt pattern) | Plain `request.auth.token.email` matching | The ID token's `email` claim is present immediately on sign-in with zero propagation delay — inventing a parallel claims system to solve a problem that doesn't exist here |
| Per-file Storage ACL for volunteer downloads | A new `storage.rules` arm keyed by assignment | v2.11's existing `downloadUrl` capability-URL pattern | Already built, already shipped, already exempt from the Storage-emulator cross-service bug class entirely (no rules evaluation happens for a `?alt=media&token=` fetch) |

**Key insight:** Every "don't hand-roll" here resolves the same way: the codebase already shipped the
primitive this phase needs (email-claim-scoped rules in `invites/`, capability-URL files in v2.11,
frozen-projection sharing in `shareTokens`) under a DIFFERENT feature name. The research risk in this phase
is not "what library to use" — it's recognizing these three precedents and reusing their exact rule idioms
instead of re-deriving a new authorization primitive from scratch.

## Common Pitfalls

### Pitfall 1: The org-selection router gate silently strands a signed-in volunteer
**What goes wrong:** A volunteer completes `signInWithEmailLink` successfully, `onAuthStateChanged` fires,
`ensureUserDocument`/`loadOrgContext` run and correctly resolve to zero memberships — but the router's
`beforeEach` guard (`src/router/index.ts:190`) treats `memberships.length === 0` (→ `hasNoOrg` →
`requiresOrgSelection`) as "must pick/create a church" for EVERY `requiresAuth` route except
`requiresSuperAdmin` and `select-church` itself. Without an exemption, a volunteer navigating to
`/my-schedule` is redirected to `/select-church`, an empty church-picker screen with nothing for them.
**Why it happens:** The entire router/store model was designed for exactly one non-super-admin identity
shape (an org member), and a magic-link volunteer is structurally identical to "an orgless user who hasn't
been invited yet" from the guard's point of view.
**How to avoid:** Add `isVolunteerRoute?: boolean` to `RouteMeta`, mark `/my-schedule` and
`/rehearse/:serviceId` (and this phase's own `/volunteer/verify`) with it, and widen line 190's condition to
`!to.meta.requiresSuperAdmin && !to.meta.isVolunteerRoute && to.name !== 'select-church'`. No sessionStorage
flag or extra async check is needed — this is a pure route-metadata exemption.
**Warning signs:** A UAT session where "the magic link signs in but immediately bounces to a church picker"
is this pitfall, not a sign-in failure.

### Pitfall 2: Confusing "cross-service `exists()`" (forbidden) with "same-service `get()`" (fine)
**What goes wrong:** CLAUDE.md's very strong, very justified warning about `firestore.exists()` inside
`storage.rules` gets over-applied, and a plan avoids ALL `get()`/`exists()` calls in the new
`rehearseAccess` rule out of misplaced caution — even a `firestore.rules` rule reading a SIBLING Firestore
document, which is completely different and already used throughout this exact file (`isOrgMember`,
`isOrgEditor`, `slideGroups`' `parentDraft()` all call `get()`/`exists()` on other Firestore docs, and are
covered by the existing, passing rules-test suite).
**Why it happens:** The two situations look superficially similar ("a rule calling exists() on something
else") but are architecturally distinct: the documented bug is Storage rules calling into the Firestore
*service* (cross-SERVICE, inert in the emulator per firebase-js-sdk#6803); a Firestore rule calling `get()`
on another Firestore document is a same-service, fully-supported, emulator-correct operation.
**How to avoid:** The `rehearseAccess` read rule's live status re-check (Pattern 3) SHOULD use
`get()`/`exists()` against the sibling `services/{serviceId}` doc — this is required for correctness (see
Pitfall 3) and is safe. Only `storage.rules` calling into `firestore.*` is forbidden.
**Warning signs:** A plan or review comment that says "no get()/exists() anywhere in the new rule" is
overcorrecting and will produce a rule that can't re-verify Planned status live.

### Pitfall 3: A projection written at lock time can outlive the lock (Reopen)
**What goes wrong:** `firestore.rules:226-230` documents an existing "Reopen" transition
(`planned`/`exported` → `draft`) that is explicitly `hasOnly(['status','updatedAt'])` — it does NOT touch
`lockSnapshots` or (by the same logic) would not automatically touch a new `rehearseAccess` doc. If the
rehearse projection is written once at lock time and never revisited, a volunteer retains read access to a
since-reopened (no-longer-Planned) service's rehearse content — a direct violation of R377's
"Draft (unlocked) service read DENIED" requirement.
**Why it happens:** "Write once at lock time" (the pattern CONTEXT.md describes) is a snapshot; Reopen is a
status-only mutation that doesn't know a downstream projection exists.
**How to avoid:** Two independent, complementary defenses, both should be tested: (1) the rules-level live
`parentIsPlanned()` check in Pattern 3, which re-verifies the LIVE service status on every read regardless
of the projection doc's own staleness; (2) as belt-and-suspenders, delete or status-flag the
`rehearseAccess` doc in the same client-side batch that performs the Reopen write (mirrors
`deleteService()`'s existing `shareTokens` revocation pattern in `src/stores/services.ts`).
**Warning signs:** A rules test suite that only tests "projection doc doesn't exist for a draft service" and
never tests "projection doc EXISTS but parent was reopened to draft" will miss this — write that second
test explicitly.

### Pitfall 4: Forgetting to exclude the new collection from the org-scoped catch-all
**What goes wrong:** `firestore.rules:322-332`'s catch-all (`match /{collection}/{docId}`) currently OR-
combines with every more-specific sibling block for the SAME path — proven by the existing, load-bearing
`collection != 'services'`/`'slideGroups'`/`'pptxRenders'` exclusions (the file's own comment marks these
"LOAD-BEARING. Do not remove any of the three."). A new `rehearseAccess` match block added WITHOUT also
adding `collection != 'rehearseAccess'` to the catch-all's write clause leaves the catch-all's
`allow write: if isOrgEditor(orgId)` **also** granting ordinary editor writes to `rehearseAccess` — which
may be intended (editors write it at lock time) but must be a **deliberate** decision, not an accident of
rule-ordering, and must be tested (an editor writing a forged `assignedEmailsLower` entry for someone else's
email is within an editor's existing trust boundary and is NOT itself an R377 violation — but this must be
a documented, reasoned acceptance, not an unnoticed side effect).
**Why it happens:** Firestore security rules OR sibling `match` blocks together; a new collection is easy to
add without re-reading the catch-all's own exclusion list.
**How to avoid:** Any new top-level-under-org collection this phase introduces must be explicitly reasoned
about against the catch-all, one way or the other, and the decision recorded in a rules comment (matching
this file's own established commenting convention).

### Pitfall 5: Case-sensitivity / normalization mismatch between roster email and token email
**What goes wrong:** `Person.email` in the roster is free-text ("from PC import, CSV, or manual entry" per
`src/types/roster.ts:21`) and may not be lowercase; Firebase Auth's ID token `email` claim reflects
whatever case the user's account record holds. If the projection stores `assignedEmailsLower` normalized
with `.toLowerCase()` (matching the existing `ensureUserDocument`/`inviteLookup` convention in `auth.ts`)
but the rule compares against `request.auth.token.email` WITHOUT `.lower()`, an otherwise-correct assigned
volunteer can be denied due to case mismatch alone.
**Why it happens:** Two independent normalization points (roster CSV import vs. Firebase's stored account
email) that were never previously required to match exactly.
**How to avoid:** Always call `.lower()` on `request.auth.token.email` in the rule (proven supported —
`firestore.rules:192,183,337,347` all already do this) AND always write `assignedEmailsLower` pre-lowercased
in the projection builder. Write a rules test with a mixed-case roster email and a mixed-case (but
differently-cased) token email to prove the match still succeeds.

## Code Examples

### Rules test pattern for the new isolation guarantee (R377)
```typescript
// Source: src/rules.test.ts (existing pattern, real file — authenticatedContext already
// supports arbitrary token claims including `email`, proven by the existing
// "Members create — R104" describe block using exactly this shape)
describe('Volunteer magic-link scoped read access — R377', () => {
  it('ALLOWS a volunteer to read the rehearseAccess projection for a service they are assigned to', async () => {
    // seed as an org editor via testEnv.withSecurityRulesDisabled(...), then:
    const context = testEnv.authenticatedContext('volUid', { email: 'Dana@Example.com' })
    const db = context.firestore()
    await assertSucceeds(getDoc(doc(db, 'organizations', 'orgA', 'rehearseAccess', 'svc1')))
  })

  it('DENIES a volunteer reading another org\'s rehearseAccess projection', async () => { /* ... */ })
  it('DENIES a volunteer reading a service still in draft (projection exists but parent reopened)', async () => { /* ... */ })
  it('DENIES a volunteer not present in assignedEmailsLower', async () => { /* ... */ })
  it('DENIES a volunteer reading organizations/{orgId}/services/{id} directly (bypass attempt)', async () => { /* ... */ })
  it('DENIES a volunteer writing to rehearseAccess', async () => { /* ... */ })
  it('DENIES an unfiltered list() across rehearseAccess (enumeration)', async () => { /* ... */ })
})
```

## State of the Art

No deprecations or version-drift risk identified — `sendSignInLinkToEmail`/`isSignInWithEmailLink`/
`signInWithEmailLink` and Admin SDK `generateSignInWithEmailLink` are long-stable modular-SDK APIs, unchanged
across the `firebase@12`/`firebase-admin@13` range this repo already runs
[CITED: firebase.google.com/docs/auth/web/email-link-auth, firebase.google.com/docs/auth/admin/email-action-links].

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Firebase Dynamic Links for cross-platform email-link continue-URLs | Plain HTTPS continue-URL + Authorized domains | Dynamic Links was shut down (Firebase deprecated it in 2025) | Not applicable here — this app is web-only, always used a plain hosting URL, never Dynamic Links; noted only so the plan doesn't reach for a dead API |

**Deprecated/outdated:** None applicable to this phase's stack.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | An editor-side client write (mirroring `lockSnapshots`) is an acceptable trust model for `rehearseAccess`, rather than requiring a Cloud Function to author it | Architecture Patterns Pattern 3, Don't Hand-Roll | If the owner wants an extra integrity guarantee (e.g., an editor cannot forge assignment data even within their own org), a Cloud Function trigger would be needed instead — low risk since it doesn't cross the R377 boundary, but worth a planner confirmation |
| A2 | `SERVICE_SHARE_BASE_URL` (existing param, `functions/src/params.ts`) is a suitable/reusable continue-URL base for the volunteer `ActionCodeSettings.url`, rather than needing a dedicated new param | Recommended Project Structure | If the share base URL and the intended `/volunteer/verify` route live under different subpaths or need different authorized-domain handling, a new param may be needed — low risk, confirm during planning |
| A3 | The Firebase Auth "Email link (passwordless sign-in)" provider is not yet enabled on `worship-planner-bc515` | Standard Stack, User Constraints | If already enabled from prior owner action, the "owner-run steps" checklist item is a no-op; if not enabled, sign-in fails with `auth/operation-not-allowed` until the owner acts (same failure mode already handled in `LoginView.vue` for email/password) |

**If this table is empty:** N/A — see entries above; none of these three block planning, they are
confirm-during-execution items.

## Open Questions

1. **Should `rehearseAccess` be one doc per service, or one doc per (service, volunteer)?**
   - What we know: `shareTokens`/`lockSnapshots` are one-doc-per-service; a single doc holding
     `assignedEmailsLower: string[]` plus the full projection is simplest and matches those precedents,
     and keeps the write a single atomic operation at lock time.
   - What's unclear: Phase 126 (My Schedule) will need to find "every service this volunteer is assigned
     to" — a single-doc-per-service model requires either a `collectionGroup('rehearseAccess')` query with
     an `array-contains` filter (needs a composite/collection-group index — see below) or a client-side
     fan-out.
   - Recommendation: Keep one-doc-per-service (matches existing precedent, simpler lock-time write); flag
     the `collectionGroup` + `array-contains` index requirement explicitly for Phase 126's research/plan so
     it isn't discovered as a runtime "requires an index" error during Phase 126 execution.

2. **Does `SERVICE_SHARE_BASE_URL` already resolve to the exact domain that will be added to Authorized
   domains for the email-link continue-URL, or is a distinct app base URL param needed?**
   - What we know: `functions/src/adminEmail.ts`'s `resolveAppBaseUrl()` already reads this param for the
     admin-onboarding email's sign-in link.
   - What's unclear: whether the volunteer continue-URL needs a different path convention (`/volunteer/
     verify?...`) that this existing param's usage doesn't yet anticipate.
   - Recommendation: Reuse the same param, appending the new route path at call time — introduce a new
     param only if the planner finds a concrete reason the existing one can't be reused as-is.

3. **Playback-position `localStorage` key shape** — left to planner discretion per CONTEXT.md; no research
   risk identified (client-only, no security implication, R376 explicitly allows this to be "light").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Auth emulator | Rules/auth-flow testing | ✓ (configured in `firebase.json`, port 9099) | — | — |
| Firestore emulator | R377 isolation tests | ✓ (`firebase.json`, port 8080) | — | — |
| Storage emulator | Confirming no `storage.rules` change is needed | ✓ (`firebase.json`, port 9199) | — | — |
| Firebase console "Email link (passwordless sign-in)" provider | R374 sign-in to actually succeed in production | **Unconfirmed** — owner action required, tracked per CONTEXT.md | — | None — this is a hard blocker for production sign-in until enabled; local emulator testing is unaffected (the Auth emulator does not require this console toggle to accept `signInWithEmailLink` calls) |
| Authorized domain for the continue-URL | R374 link click completing sign-in | **Unconfirmed** — owner action required | — | None for production; local dev domain (`localhost`) needs separate confirmation post-April-2025 Firebase policy change [CITED: firebase.google.com/docs/auth/web/email-link-auth] |

**Missing dependencies with no fallback:**
- Firebase console Email-link provider + Authorized domain — both owner-gated, both must be called out as
  explicit owner-run steps in the plan (mirrors how v2.5's Email/Password enablement was tracked).

**Missing dependencies with fallback:**
- None — everything else needed is already running/installed in this repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` (app) / rules suite via `@firebase/rules-unit-testing ^5.0.0` against `firebase emulators:exec` [VERIFIED: package.json] |
| Config file | `vitest.rules.config.ts` (rules), root `vite.config.ts`/vitest config (app) |
| Quick run command | `npx vitest run --config vitest.rules.config.ts` (against an already-running emulator) for rules-only iteration |
| Full suite command | `npm run test:rules` (starts its own emulator) + `npx vitest run` (app suite) + `npm run type-check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R374 | Email-link sign-in completes and yields an authenticated uid with no org claims | unit/integration (Auth emulator) | `npx vitest run --config vitest.rules.config.ts` (extend `src/rules.test.ts`, or a new focused auth-flow test) | ❌ Wave 0 |
| R375 | `generateSignInWithEmailLink` link is embedded in the rendered email body via `{{rehearse_link}}` | unit | `cd functions && npm test -- messageTokens` | ❌ Wave 0 (extend `functions/src/messageTokens.test.ts`) |
| R376 | Session persists across simulated refresh; sign-out clears it | unit (store-level, mocked auth) | `npx vitest run` (extend an `auth.ts`/volunteer store test) | ❌ Wave 0 |
| R377 | Cross-org DENY, Draft DENY, not-assigned DENY, planner-write DENY, enumeration DENY, own-org+assigned ALLOW | integration (Firestore emulator, rules-unit-testing) | `npm run test:rules` | ❌ Wave 0 — this is the phase's non-negotiable gate |

### Sampling Rate
- **Per task commit:** `npx vitest run --config vitest.rules.config.ts` (fast, against a warm emulator) for
  any `firestore.rules` change; `npx vitest run` for any store/router change.
- **Per wave merge:** `npm run test:rules` (fresh emulator) + `npx vitest run` + `npm run type-check`.
- **Phase gate:** Full suite green (baseline: exactly `src/storage.rules.test.ts` failing, per CLAUDE.md —
  no new failures) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/rules.test.ts` — add the `describe('Volunteer magic-link scoped read access — R377')` block
      (7+ ALLOW/DENY cases enumerated in §Code Examples)
- [ ] `functions/src/messageTokens.test.ts` — extend for the new `rehearseLink`/`{{rehearse_link}}` token
- [ ] A focused test for the router's `isVolunteerRoute` exemption (extend existing router tests if present,
      or a new `src/router/__tests__/index.test.ts` case) — verify a zero-membership authenticated session
      reaches `/my-schedule` without a `/select-church` redirect
- [ ] Framework install: none — all frameworks already present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth email-link provider (server-managed link issuance/expiry/replay protection) — never hand-rolled |
| V3 Session Management | yes | Firebase Auth's standard local persistence + existing `onAuthStateChanged`/`logout()` in `auth.ts` — no custom session token |
| V4 Access Control | yes (this phase's core) | Firestore security rules — `request.auth.token.email` claim match + live parent-status re-check, fail-closed by default (no membership = no access except the narrow grant) |
| V5 Input Validation | yes | `ActionCodeSettings.url` and any newly-added Cloud Function inputs (e.g. per-recipient email passed to `generateSignInWithEmailLink`) — reuse existing recipient-resolution validation (`resolveRecipients`), do not re-derive |
| V6 Cryptography | n/a | No new cryptographic primitive introduced — link tokens are entirely Firebase-managed |
| V13 API and Web Service | yes | The one new Cloud-Function-adjacent surface (`generateSignInWithEmailLink` call inside `sendQueuedMessage`) runs under the SAME secrets/trust boundary as the existing Resend send (no new secret, no new public endpoint) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org read via a forged/replayed link or guessed doc path | Elevation of Privilege | `rehearseAccess` read rule requires BOTH `isOrgMember(orgId)` (path-scoped) OR an exact `email` claim match against `assignedEmailsLower` sourced from that SAME org's doc — an attacker's own valid token can never satisfy another org's array |
| Enumeration of all assigned volunteers/services via an unfiltered `list()` | Information Disclosure | Firestore denies an unconstrained `list()` against a rule that reads per-document array membership not expressible as a query-time equality filter — mirrors the existing `shareTokens`/`inviteLookup` get/list-split precedent (`allow get: if true; allow list: if isOrgEditor(...)`) already proven in this file |
| Stale authorization after Reopen (Draft after being Planned) | Tampering (of trust state) | Live `parentIsPlanned()` re-check inside the rule itself (Pattern 3 / Pitfall 3), not a one-time snapshot flag |
| Router-level-only gating mistaken for the security boundary | Elevation of Privilege | Explicit CONTEXT.md framing: router exemption is UI defense-in-depth; the enforced boundary is `firestore.rules`, verified independently by the rules-emulator test suite regardless of any router code |
| Session fixation via email passed in URL params instead of `localStorage` | Spoofing | Documented Firebase pattern already followed: email lives in `localStorage.emailForSignIn`, never a URL query param [CITED: firebase.google.com/docs/auth/web/email-link-auth] |

## Sources

### Primary (HIGH confidence)
- `firestore.rules` (this repo, read 2026-09-05) — `isOrgMember`/`isOrgEditor` helpers, `invites/{email}`
  and `inviteLookup/{email}` email-claim precedent, `services/{docId}` status machine, `lockSnapshots`,
  `shareTokens`, catch-all collection block — all lines cited inline above
- `storage.rules` (this repo, read 2026-09-05) — claim-only `isOrgMember`/`isOrgEditor`, song-files block,
  the documented cross-service `exists()` ban
- `src/stores/auth.ts` (this repo, read 2026-09-05) — `onAuthStateChanged`, `loadOrgContext`,
  `ensureUserDocument`, `hasNoOrg`/`requiresOrgSelection` computed properties, `logout()`
- `src/router/index.ts` (this repo, read 2026-09-05) — the org-selection redirect gate and its existing
  `requiresSuperAdmin`/`select-church` exemptions
- `functions/src/index.ts` (this repo, read 2026-09-05) — `sendQueuedMessageHandler`'s per-recipient send
  loop (lines ~2156-2231), `MessageTokenContext` usage
- `functions/src/messageTokens.ts` (this repo, read 2026-09-05) — the merge-token renderer to extend
- `src/types/song.ts` (this repo, read 2026-09-05) — `SongAttachment.downloadUrl`, documented as a
  "Denormalized Storage download-token URL — reads never need a rules round-trip"
- `src/utils/serviceRoles.ts`, `src/utils/messagingRecipients.ts` (this repo, read 2026-09-05) — the real
  assignment-resolution and recipient-matching data shapes (`resolveServiceRoleAssignments`,
  `Person.email`)
- `src/rules.test.ts` (this repo, read 2026-09-05) — proves `testEnv.authenticatedContext(uid, { email })`
  correctly simulates a no-org-claim token, the exact shape a magic-link volunteer will have
- `package.json` / `functions/package.json` (this repo, read 2026-09-05) — `firebase@^12.0.0`,
  `firebase-admin@^13.10.0`, `resend@6.19.0`, `@firebase/rules-unit-testing@^5.0.0`, `vitest@^4.0.18`
- [firebase.google.com/docs/auth/web/email-link-auth](https://firebase.google.com/docs/auth/web/email-link-auth) — official client email-link flow, ActionCodeSettings, cross-device fallback, console prerequisites
- [firebase.google.com/docs/auth/admin/email-action-links](https://firebase.google.com/docs/auth/admin/email-action-links) — official `generateSignInWithEmailLink` Admin SDK reference, confirms it does not itself send email

### Secondary (MEDIUM confidence)
- .planning/CONTEXT.md, REQUIREMENTS.md, STATE.md (this repo, owner-authored planning artifacts, read
  2026-09-05) — locked decisions, requirement text, milestone framing

### Tertiary (LOW confidence)
- None used for load-bearing claims in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; both client and admin SDK APIs confirmed against official
  docs and the exact installed versions in this repo.
- Architecture: HIGH — the recommended mechanism reuses three already-shipped, already-tested precedents
  found by reading the actual `firestore.rules`/`storage.rules`/type files, not derived from generic
  Firebase advice.
- Pitfalls: HIGH — all five pitfalls are grounded in specific, cited lines of this repo's existing code
  (router guard, rules catch-all, Reopen transition, roster email field), not hypothetical risks.

**Research date:** 2026-09-05
**Valid until:** 30 days (stable Firebase Auth APIs; re-verify only if `firebase`/`firebase-admin` are
upgraded across a major version before Phase 125 executes)
