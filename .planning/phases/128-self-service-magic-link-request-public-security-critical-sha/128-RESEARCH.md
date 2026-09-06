# Phase 128: Self-Service Magic-Link Request (public, security-critical) + shared mint/send core - Research

**Researched:** 2026-09-06
**Domain:** Public unauthenticated Firebase Cloud Function (onCall) + Admin SDK email-link minting + Resend send, enumeration/rate-limit security gate, Vue Router public dynamic route
**Confidence:** HIGH (nearly everything needed is an established, already-shipped pattern in this exact codebase — no project-research pass was declared necessary, and this research confirms why)

## Summary

Phase 128 adds exactly one new attack surface — a public, unauthenticated `onCall` function — to a codebase
that already has every building block it needs: Admin-SDK link minting
(`getAuth().generateSignInWithEmailLink`), a Resend send block with header-safe From-address construction,
a Firestore-doc fixed-window rate limiter (`checkAndConsumeRateLimit`), a public-read/editor-scoped-create
slug registry (`orgSlugs`, ADR-0007), and a standalone (non-message-queue) Resend send precedent
(`functions/src/adminEmail.ts`). Every one of these was built for a different phase and is directly reusable
here with no new library, no new Firebase project configuration, and no new client SDK.

The genuinely new work is (1) a shared mint/send core module that both this phase's public callable and
Phase 129's admin-resend callable call into (R402's "one code path"), (2) the roster-gate + rate-limit +
enumeration-safety logic that wraps it for the *public* caller specifically, and (3) three small pieces of
UI wiring (a new public route + view, a login-page entry point, and a "request a new link" affordance on
the existing verify page). None of this requires a new npm package — `resend` 6.19.0 and `firebase-admin`
13.10.0 are already dependencies of `functions/`.

The one design decision this research surfaces that CONTEXT.md does not fully settle is enumeration-safety
against **timing**: the roster-match branch (mint + Resend network call) is measurably slower than the
no-match branch (no-op) inside a single synchronous callable. CONTEXT.md's Specific Ideas section flags
this ("not leaking via... obvious timing") but does not prescribe a mechanism. This research recommends a
concrete, low-risk mitigation (timing-pad the no-match branch) that fits inside the single-callable design
CONTEXT.md already locks in — see Security Domain below.

**Primary recommendation:** Build `functions/src/volunteerLink.ts` as the shared mint/send core (mirroring
the existing `functions/src/adminEmail.ts` shape exactly), export a `requestVolunteerLinkHandler` from
`functions/src/index.ts` for direct unit testing (mirroring `queueServiceMessageHandler`), wrap it as
`export const requestVolunteerLink = onCall({ secrets: [RESEND_API_KEY] }, requestVolunteerLinkHandler)`
with **no auth check**, reuse `checkAndConsumeRateLimit` with a **dedicated** counter collection keyed by
`${orgId}::${normalizedEmail}`, and reuse the org's full `people` collection fetch + in-memory
case-insensitive email compare (the exact pattern `sendQueuedMessageHandler` already uses at
`functions/src/index.ts:2044`) for the roster gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slug → orgId resolution | Browser / Client | Database (Firestore rules) | `orgSlugs/{slug}` is public-read (`get: true`) — the unauthenticated client reads it directly via the client SDK; no server round-trip needed (ADR-0007). |
| Church-not-found / church-name display | Browser / Client | — | Pure rendering off the client-side `orgSlugs` read; no server involvement. |
| Email-link minting (`generateSignInWithEmailLink`) | API / Backend | — | Admin-SDK-only capability — the client library cannot call this; MUST happen server-side (CONTEXT.md locked decision). |
| Roster gate (email ∈ `organizations/{orgId}/people`) | API / Backend | — | Must never be client-checkable (would itself be an enumeration oracle via Firestore rules); Admin SDK read inside the callable, bypassing rules entirely. |
| Rate limiting (per email+orgId) | API / Backend | Database (Firestore-doc counters) | Mirrors `checkAndConsumeRateLimit`'s existing fixed-window-in-Firestore-transaction design — server-enforced, not a client-side debounce. |
| Enumeration-safe response shaping | API / Backend | — | The callable's return value/error code is the only signal a caller sees; must be uniform regardless of roster/rate-limit outcome. |
| Email delivery | API / Backend (Resend) | — | Resend API call happens server-side inside the callable (or its shared core), using the existing `RESEND_API_KEY` secret. |
| Sign-in completion (`signInWithEmailLink`) | Browser / Client | — | Already built (v2.12, `src/stores/volunteerAuth.ts`) — out of scope for this phase, reused as-is. |
| "Request a new link" recovery affordance | Browser / Client | — | Pure UI: reads the `slug` query param already carried in the continue URL and links back to `/{slug}/volunteer`. |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R394 | Public church-scoped page `/{church-slug}/volunteer`; unknown/expired slug → clear "not found" state | `orgSlugs/{slug}` public `get` rule (`firestore.rules:550-558`), the existing `/:slug/service-:date` route-placement pattern (`src/router/index.ts:216-223`, D-19) to mirror for the new route |
| R395 | Enumeration-safe — identical confirmation regardless of roster match | `queueServiceMessageHandler`'s existing input-validation-vs-security-check split (`functions/src/index.ts:1679-1719`) as the template for "some errors are OK to differentiate, membership is never one of them"; Security Domain section below for the timing sub-case |
| R396 | Link sent only to a roster email in `organizations/{orgId}/people`; minted server-side, delivered via Resend | `orgRef.collection("people").get()` full-fetch + in-memory match pattern (`functions/src/index.ts:2040-2044`, `2199-2202`); `functions/src/adminEmail.ts` as the standalone-send shared-core template |
| R397 | Rate-limited per email+church; security-critical, threat model + ALLOW/DENY tests | `checkAndConsumeRateLimit` (`functions/src/index.ts:391-422`) — generic, already takes an arbitrary string key and a dedicated collection name; `functions/src/index.test.ts:4156+` as the existing test-harness template |
| R398 | Login page "Are you a volunteer?" entry point | `src/views/LoginView.vue` — see Open Questions for the slug-discovery gap this entry point has to solve |
| R399 | Expired/invalid link at `/volunteer/verify` offers "request a new link" back to the same church | `src/views/VolunteerLinkCompleteView.vue` (existing error state at line 53-60); continue-URL query-param carrying confirmed as an officially supported Firebase pattern (see Sources) |

## Standard Stack

### Core

No new packages. Every dependency this phase needs is already installed and already in production use.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | ^13.10.0 [VERIFIED: functions/package.json:15] | `getAuth().generateSignInWithEmailLink` (Admin-SDK-only mint) | Already the mint mechanism for v2.12's rehearse-mode links (`functions/src/index.ts:2199`) |
| `firebase-functions` | ^7.3.2 [VERIFIED: functions/package.json:16] | `onCall` wrapper, `defineSecret` | Already used for every other callable in `functions/src/index.ts` |
| `resend` | 6.19.0 (pinned, not `^`) [VERIFIED: functions/package.json:19] | Standalone-email send | Already used identically in `functions/src/adminEmail.ts` and `functions/src/index.ts:2172` |
| `firebase/functions` (client) | matches root `firebase` client SDK pin | `httpsCallable(functions, 'requestVolunteerLink')` | Already the invocation pattern for every existing client callable (`src/components/MessageComposer.vue:604`, etc.) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `firebase/firestore` (client) | matches root pin | `getDoc(doc(db, 'orgSlugs', slug))` for the public slug→orgId resolve | On mount of the new `/{slug}/volunteer` view, before rendering the request form |
| `vue-router` | already a dependency | New public route registration | Append after the existing static + `/:slug/service-:date`/`/:slug/quarter...` routes (D-19) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `checkAndConsumeRateLimit` with a synthetic key | A brand-new rate-limit helper scoped to `email+orgId` pairs | No benefit — the existing function already accepts an arbitrary string key and a dedicated collection name (added in R344/117-01 specifically so callers don't cross-deplete each other's budgets); a new helper would duplicate a working, tested transaction. |
| Hardcoded rate-limit constants (local `const`, optionally `readNumericKnob(process.env.X, fallback)`) | A new `AppConfig.volunteerLink` group in Firestore `appConfig/global` | A new AppConfig group requires updating the **client-side duplicate** `src/config/appConfigDefaults.ts` to stay in sync (an explicit, documented sync burden — see `functions/src/appConfig.ts:46`). The codebase has already made this exact tradeoff once before and chose the constant: R344's own comment states "Reusing the existing aiProxy/messaging appConfig knobs is deliberate — a new knob would need the out-of-scope frontend appConfig duplicate" (`functions/src/index.ts:1741-1742`). For a small, unlikely-to-need-live-tuning security ceiling, a local constant (optionally env-overridable, mirroring `AI_PROXY_MAX_INSTANCES`) is the lower-risk, precedent-consistent choice. |
| Single synchronous callable doing roster-check + mint + send inline | Two-phase queue/trigger split (public callable only enqueues a request doc; a separate `onDocumentCreated` trigger does the roster check + mint + send, mirroring `queueServiceMessage`/`sendQueuedMessage`) | The two-phase split would fully eliminate the timing side-channel (see Security Domain) and keep `RESEND_API_KEY` off the public function entirely (defense-in-depth beyond R131's existing "smallest key-holding surface" principle). **However, CONTEXT.md's locked decision explicitly describes one public callable that itself "(d) mints + sends via the shared core"** — so this alternative is documented here for the plan-checker's awareness but is NOT the recommended default; only revisit it if the timing-pad mitigation below is rejected at plan-review time. |

**Installation:** None required — no `npm install` needed for this phase.

**Version verification:** `functions/package.json` was read directly (not inferred from training data) — `firebase-admin@^13.10.0`, `firebase-functions@^7.3.2`, `resend@6.19.0` are exact-installed versions [VERIFIED: functions/package.json].

## Package Legitimacy Audit

**Not applicable — this phase introduces zero new external packages.** All server-side capabilities
(`firebase-admin`, `firebase-functions`, `resend`) and client-side capabilities (`firebase/functions`,
`firebase/firestore`, `vue-router`) are pre-existing dependencies already vetted and in production use
(confirmed by reading `functions/package.json` and the existing import sites cited throughout this
document). The Package Legitimacy Gate protocol (registry check, postinstall-script check) is skipped
because there is nothing to check.

## Architecture Patterns

### System Architecture Diagram

```
 Unauthenticated volunteer's browser
 ┌──────────────────────────────────────────────────────────────────────┐
 │  /{slug}/volunteer  (NEW public route, VolunteerRequestView.vue)     │
 │    1. getDoc(orgSlugs/{slug})  ──────► Firestore (public get:true)   │
 │       │  found → render church name + email form                     │
 │       │  not found → render "church not found" state                 │
 │    2. submit email                                                   │
 └──────────────────┬─────────────────────────────────────────────────┘
                     │ httpsCallable(functions, 'requestVolunteerLink')
                     │  { orgId, email }
                     ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  requestVolunteerLink  (NEW public onCall, secrets:[RESEND_API_KEY]) │
 │                                                                        │
 │  a. input guard: orgId/email present + shallow email-format check    │
 │     → invalid-argument on failure (NOT membership-revealing)         │
 │                                                                        │
 │  b. checkAndConsumeRateLimit(db, `${orgId}::${emailLower}`,          │
 │       limits, now, "volunteerLinkRateLimits")                        │
 │     → over limit: SAME generic response, do nothing further          │
 │                                                                        │
 │  c. roster gate: orgRef.collection("people").get(), in-memory        │
 │     case-insensitive email match (mirrors sendQueuedMessageHandler)  │
 │     → no match: [TIMING-PAD] then SAME generic response              │
 │                                                                        │
 │  d. match: mintAndSendVolunteerLink(...)  ── shared core ──┐         │
 │     → SAME generic response either way                     │         │
 └──────────────────────────────────────────────────────────┼─────────┘
                                                               ▼
                                      ┌───────────────────────────────────┐
                                      │ functions/src/volunteerLink.ts    │
                                      │ mintAndSendVolunteerLink()        │
                                      │  1. getAuth().generateSignInWith  │
                                      │     EmailLink(email, {            │
                                      │       url: `${BASE}/volunteer/    │
                                      │         verify?slug=${slug}`,     │
                                      │       handleCodeInApp: true })    │
                                      │  2. resolve From (org name wrap,  │
                                      │     bareEmailAddress) via         │
                                      │     getAppConfig(db)              │
                                      │  3. resend.emails.send(...)       │
                                      │     — standalone template         │
                                      └───────────────────────────────────┘
                                                (also called by Phase 129's
                                                 admin-resend callable —
                                                 R402 single code path)

 Later, volunteer opens the emailed link:
 /volunteer/verify?slug={slug}&apiKey=...&oobCode=...&mode=signIn
   → VolunteerLinkCompleteView.vue → volunteerAuth.completeSignIn(url)
   → on success: redirect to /my-schedule
   → on invalid/expired: show error + "request a new link" button
     linking to `/${route.query.slug}/volunteer`   (R399, NEW this phase)
```

### Recommended Project Structure

```
functions/src/
├── volunteerLink.ts        # NEW — shared mint/send core (mintAndSendVolunteerLink),
│                            #   mirrors adminEmail.ts's shape exactly
├── volunteerLink.test.ts   # NEW — unit tests for the shared core in isolation
├── index.ts                # requestVolunteerLinkHandler + requestVolunteerLink export
│                            #   (MUST be re-exported here — see Common Pitfalls)
└── index.test.ts           # requestVolunteerLinkHandler ALLOW/DENY test suite,
                             #   colocated with queueServiceMessageHandler's tests

src/
├── views/
│   ├── VolunteerRequestView.vue      # NEW — the /{slug}/volunteer public page
│   ├── VolunteerLinkCompleteView.vue # EDIT — add "request a new link" (R399)
│   └── LoginView.vue                 # EDIT — add "Are you a volunteer?" entry (R398)
├── router/index.ts                   # EDIT — add /:slug/volunteer, appended after
│                                      #   the existing static + memorable-share routes
└── stores/
    └── volunteerAuth.ts               # UNCHANGED — reused as-is for completion
```

### Pattern 1: Shared standalone-send core (adminEmail.ts shape)

**What:** A small, dependency-light module exporting one async function that resolves `AppConfig` sender
settings, builds the From header, and calls `resend.emails.send` directly — no Firestore `messages`
document, no queue, no token-templating system.
**When to use:** Any email that is not tied to a specific service/queued-message lifecycle (onboarding
emails, and now volunteer-link emails).
**Example:**
```typescript
// Source: functions/src/adminEmail.ts (existing file, verbatim shape to mirror)
export async function sendAdminOnboardingEmail(args: SendAdminOnboardingEmailArgs): Promise<void> {
  const { db, to, orgName, kind } = args;
  const config = await getAppConfig(db);
  const fromEmail = bareEmailAddress(config.sender.fromAddress);
  const displayName = fromDisplayName(orgName);
  const from = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;
  const resend = new Resend(RESEND_API_KEY.value());
  await resend.emails.send({ from, to, subject, text });
}
```
The new `functions/src/volunteerLink.ts` should follow this exact shape, adding the
`generateSignInWithEmailLink` mint step before the send, and accepting `slug` (for the continue URL) plus
`orgName` (for both the From header and the email body's "Sign in to {orgName}" copy).

### Pattern 2: Admin-SDK mint call + actionCodeSettings

**What:** Server-only link minting; the returned string is a complete URL, never itself an email — it must
ride an application-controlled Resend send (never call any Firebase-hosted send path).
**When to use:** Every place a magic sign-in link is produced (this phase, and Phase 129's admin resend).
**Example:**
```typescript
// Source: functions/src/index.ts:2087-2090, 2199-2202 (existing rehearse-link mint, R375)
const rehearseActionCodeSettings = {
  url: `${SERVICE_SHARE_BASE_URL.value().trim().replace(/\/+$/, "")}/volunteer/verify`,
  handleCodeInApp: true,
};
const rehearseLink = await getAuth().generateSignInWithEmailLink(
  target.email,
  rehearseActionCodeSettings,
);
```
For this phase, append `?slug=${encodeURIComponent(slug)}` to the `url` before the mint call — Firebase
appends its own `apiKey`/`oobCode`/`mode` params with `&`, so an existing query string on the continue URL
is preserved (this exact pattern — `?cartId=1234` — is Firebase's own official example; see Sources).

### Pattern 3: Generic per-key Firestore rate limiter

**What:** A fixed-window (minute + day) counter stored as a Firestore doc, checked and incremented inside
one transaction.
**When to use:** Any server-side call that must cap volume per some key (uid, email+orgId, orgId alone).
**Example:**
```typescript
// Source: functions/src/index.ts:391-422 (existing, generic since R344/117-01)
export async function checkAndConsumeRateLimit(
  db: Firestore,
  uid: string,                 // pass `${orgId}::${emailLower}` for this phase
  limits: Pick<AiProxyLimits, "maxPerMin" | "maxPerDay">,
  now: number = Date.now(),
  collectionName: string = "aiRateLimits",   // pass "volunteerLinkRateLimits"
): Promise<RateLimitResult> { /* ...existing transaction body... */ }
```
Do not build a new limiter — this function already accepts an arbitrary string key and a dedicated
collection name specifically so a new caller's counters never share a budget with an unrelated feature.

### Pattern 4: Public dynamic route placed after static routes (D-19)

**What:** A `/:slug/...` route registered at the END of the routes array so Vue Router's static-beats-
dynamic ranking never lets it shadow a real top-level route.
**Example:**
```typescript
// Source: src/router/index.ts:216-223 (existing memorable-share route, to mirror)
{
  path: '/:slug/service-:date(\\d{4}-\\d{2}-\\d{2})',
  name: 'service-memorable-share',
  component: () => import('../views/ShareView.vue'),
  // Intentionally no meta.requiresAuth — public route for unauthenticated viewers,
  // mirrors quarter-memorable-share. Appended after all static routes...
},
```
Add `{ path: '/:slug/volunteer', name: 'volunteer-request', component: () => import('../views/VolunteerRequestView.vue') }`
in the same trailing block, with no `meta.requiresAuth`.

### Anti-Patterns to Avoid

- **Adding `emailLower` query filters against `organizations/{orgId}/people`:** No such normalized field
  exists on `Person` docs today (`email: string // from PC import, CSV, or manual entry` —
  `src/types/roster.ts:21`, arbitrary case). A `.where('email', '==', input)` query will silently miss
  case-variant matches. Fetch the collection and compare in-memory, lowercased on both sides — exactly what
  `sendQueuedMessageHandler` already does.
- **Binding `RESEND_API_KEY` to more functions than necessary:** R131's "smallest key-holding surface"
  principle is explicit in this codebase (`queueServiceMessage` deliberately carries NO secrets array —
  `functions/src/index.ts:1825-1828`). The new public callable does need the secret (per CONTEXT.md's
  single-callable design), but no other new function should declare it.
- **Returning different HttpsError codes/messages for "not on roster" vs "rate-limited" vs "success":** All
  three must produce byte-identical response bodies to the client. Only genuinely structural input errors
  (missing `orgId`/`email` fields) may differ — see Security Domain.
- **Trusting a client-supplied `orgId` as already-validated:** It arrives from a public, unauthenticated
  call. It happens to be enumeration-safe without extra code (a bogus `orgId` just makes the `people` fetch
  return empty, which already produces the generic response) — but never assume it maps to a real org for
  logging/error purposes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-key request throttling | A new Firestore counter scheme | `checkAndConsumeRateLimit(db, key, limits, now, collectionName)` | Already generic, already transaction-safe, already has a test harness template (`functions/src/index.test.ts:4156+`). |
| From-header construction (org display name + bare address) | New header-escaping logic | `bareEmailAddress` + `fromDisplayName` (`functions/src/params.ts`) | Already handles the CR/LF header-injection defense and the nested-angle-bracket bug (`functions/src/params.ts:33-48`). |
| Slug → orgId resolution | A new Cloud Function/HTTP endpoint | Direct client read of `orgSlugs/{slug}` (`getDoc`) | Already public-read by design (ADR-0007); a server round-trip would only add latency with no security benefit — Admin SDK trust is irrelevant here since the doc is meant to be public. |
| Standalone (non-queued) transactional email | Extending the `messages` sub-collection / `queueServiceMessage` pipeline | A small dedicated module mirroring `functions/src/adminEmail.ts` | The message-queue pipeline exists to support scheduling, per-recipient rendering, and delivery-status tracking for *service* messages — none of which applies to a one-off link email; forcing it through that pipeline would require inventing a fake "service" context. |
| Email format validation | A full RFC 5322 validator | The codebase's existing shallow `isValidEmailFormat` (`e.includes('@') && e.includes('.')`) | This is the established client-side convention repeated in `TeamView.vue`, `OrganizationsTab.vue`, `ConfigurationTab.vue`, `SenderConfigCard.vue` — consistency matters more than strictness here since Resend/Firebase Auth reject genuinely malformed addresses anyway. |

**Key insight:** Every piece of this phase's *plumbing* already exists somewhere in the codebase for a
different feature. The actual new engineering is entirely in the security composition — the order and
uniformity of the roster/rate-limit/response-shape checks — not in any new integration code.

## Common Pitfalls

### Pitfall 1: New callable not re-exported from `functions/src/index.ts`

**What goes wrong:** `firebase deploy --only functions` silently fails to find/create the new function
("No function matches the filter").
**Why it happens:** There is no predeploy build hook; a function defined in a new file but not
`export`-ed (directly or re-exported) from `index.ts` never gets registered with the Firebase CLI's function
discovery.
**How to avoid:** If `requestVolunteerLink`'s onCall wrapper lives in `index.ts` itself (recommended,
mirroring every other callable), this is automatic. If any part is split into `volunteerLink.ts`, only the
shared *core* function should live there — the `onCall(...)` wrapper itself must stay in (or be re-exported
from) `index.ts`.
**Warning signs:** A successful `npm run build` in `functions/` but a deploy that reports zero changes to
Cloud Functions, or a client `httpsCallable` call failing with `functions/not-found`.

### Pitfall 2: Timing side-channel on the roster-match branch

**What goes wrong:** A caller (or an automated prober) can distinguish "email is on the roster" from
"email is not" purely by measuring response latency — the match branch does an Admin-SDK mint + a Resend
HTTP round-trip; the no-match branch does nothing. This is a real enumeration channel even though the
response body is identical.
**Why it happens:** `generateSignInWithEmailLink` + `resend.emails.send` together typically add well over
100ms of genuinely awaited work; a no-op response returns in single-digit milliseconds.
**How to avoid:** Insert an explicit timing pad on the no-match (and rate-limited) branches — measure
elapsed time since request start and `await` a fixed remaining budget (e.g. a `TARGET_RESPONSE_MS` local
constant calibrated a little above typical mint+send latency) before returning. This is a well-known,
industry-accepted mitigation for exactly this class of problem (the same technique used against
username-enumeration-via-login-timing). It is not perfect (network jitter still leaks some signal) but it
removes the *dominant, easily-automatable* signal, and it fits inside CONTEXT.md's locked single-callable
design without requiring the more invasive two-phase queue/trigger split (see Alternatives Considered).
**Warning signs:** A plan or review that treats "same response body" as sufficient proof of R397's
"cannot enumerate roster membership" success criterion without addressing timing.

### Pitfall 3: `people` collection has no `emailLower` field

**What goes wrong:** A `.where('email', '==', normalizedEmail)` Firestore query returns zero results for a
roster email stored with different casing, causing false "not on roster" outcomes for real volunteers.
**Why it happens:** `Person.email` is free-text, sourced from Planning Center import / CSV / manual entry
(`src/types/roster.ts:21`) with no normalization step at write time (unlike `assignedEmailsLower` on
`rehearseAccess`, which IS pre-lowercased for exactly this reason).
**How to avoid:** Fetch the full `people` collection (already proven cheap enough for a per-org read in
`sendQueuedMessageHandler`) and compare `person.email?.trim().toLowerCase() === input.trim().toLowerCase()`
in application code.
**Warning signs:** A code review or test that queries `people` with a Firestore `where` clause on `email`.

### Pitfall 4: Adding a new `AppConfig` group without updating the client duplicate

**What goes wrong:** If a config-driven (rather than hardcoded) rate limit is chosen, forgetting to mirror
the new group in `src/config/appConfigDefaults.ts` leaves the client-side default resolution out of sync
with the server, which can surface as a `ConfigurationTab.vue` admin-UI bug even though the actual
enforcement (server-side) is unaffected.
**Why it happens:** `functions/src/appConfig.ts:46` documents this as a "DELIBERATE CLIENT-SIDE DUPLICATE —
keep in sync," and it is easy to touch only the server file.
**How to avoid:** Prefer the hardcoded-constant approach recommended in Alternatives Considered, which
avoids this class of bug entirely. If a config knob is chosen anyway, grep for every other `AppConfig` field
addition's diff shape (`appConfig.ts` + `appConfigDefaults.ts` + `ConfigurationTab.vue`, if admin-editable)
before considering the change complete.

### Pitfall 5: `/volunteer` (singular, existing static route) vs `/{slug}/volunteer` (new dynamic route)

**What goes wrong:** Confusing the existing `/volunteer` landing route (`src/router/index.ts:168-172`,
`requiresAuth: true`) with the new public `/{slug}/volunteer` route, or accidentally routing an
authenticated-volunteer redirect at the wrong path.
**Why it happens:** The two paths look similar but have different segment counts (`/volunteer` is 1
segment; `/:slug/volunteer` is 2) and therefore never collide in Vue Router's matcher — but a careless
`router.push('/volunteer')` vs `router.push(\`/${slug}/volunteer\`)` typo is easy to make when both views are
being edited in the same phase.
**How to avoid:** Use named routes (`{ name: 'volunteer-request', params: { slug } }`) rather than
string-built paths wherever the new route is targeted from other views (login page, verify page), consistent
with how the router names every other route.
**Warning signs:** A "church not found" state appearing when the volunteer is actually already signed in
(a sign that `/volunteer` and `/{slug}/volunteer` got swapped somewhere).

## Code Examples

### Rate-limit key construction for an unauthenticated caller

```typescript
// No uid exists for a public caller — build a synthetic key mirroring the
// existing per-uid usage, scoped to (orgId, normalized email) per R397.
const rateLimitKey = `${orgId}::${email.trim().toLowerCase()}`;
const rate = await checkAndConsumeRateLimit(
  db,
  rateLimitKey,
  { maxPerMin: VOLUNTEER_LINK_MAX_PER_MIN, maxPerDay: VOLUNTEER_LINK_MAX_PER_DAY },
  Date.now(),
  "volunteerLinkRateLimits",   // DEDICATED collection — never shares aiRateLimits/orgEmailCounters
);
```

### Enumeration-safe response shape

```typescript
// ALWAYS the same shape on the "did we send" axis — callers cannot distinguish
// roster-hit, roster-miss, or rate-limited from the response alone.
const GENERIC_RESPONSE = {
  message: "If you're on this church's team, a sign-in link is on its way.",
};
// Reserve HttpsError('invalid-argument', ...) ONLY for structurally malformed
// input (missing orgId/email) -- this is not membership-revealing (mirrors
// queueServiceMessageHandler's upfront field-required guard,
// functions/src/index.ts:1679-1684).
```

### Continue-URL slug round-trip (official Firebase pattern)

```typescript
// Source: firebase.google.com/docs/auth/web/email-link-auth (own example uses
// `?cartId=1234` on the continue URL as precedent for exactly this technique)
const actionCodeSettings = {
  url: `${baseUrl}/volunteer/verify?slug=${encodeURIComponent(slug)}`,
  handleCodeInApp: true,
};
// Firebase appends its own apiKey/oobCode/mode params with `&`, so the final
// link the volunteer clicks is:
//   {baseUrl}/volunteer/verify?slug=grace-church&apiKey=...&oobCode=...&mode=signIn
```

```typescript
// VolunteerLinkCompleteView.vue — reading it back for the "request a new link" affordance
const route = useRoute()
const requestNewLinkTarget = computed(() =>
  typeof route.query.slug === 'string'
    ? { name: 'volunteer-request', params: { slug: route.query.slug } }
    : { name: 'volunteer-request-generic' }, // fallback if slug is somehow absent
)
```

## State of the Art

Not applicable — there is no "old approach" being replaced. This is new capability layered onto an
unchanged, already-current stack (Firebase Admin SDK email-link auth, Resend transactional email). No
deprecations apply.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `generateSignInWithEmailLink`'s action-code expiry is not officially documented/customizable, with community reports ranging 1–6 hours | Common Pitfalls / Security Domain (informs "expired link" copy) | Low — the existing `mapCompletionError` copy already says "invalid or has expired... request a new one" without asserting a specific duration, so no code depends on the exact number; only matters if a plan tries to hardcode a TTL-based UX claim. |
| A2 | The login page's "Are you a volunteer?" entry point needs a church-identification step (slug or name entry) that CONTEXT.md does not specify a mechanism for | Open Questions | Medium — if unresolved at plan time, R398 could ship as a dead-end link with no way for the volunteer to reach a real `/{slug}/volunteer` page. |
| A3 | A hardcoded (not AppConfig-driven) rate limit is the right default for `VOLUNTEER_LINK_MAX_PER_MIN`/`_DAY` | Standard Stack § Alternatives Considered | Low-Medium — if the owner wants live-tunable limits without a redeploy, this recommendation would need revisiting; the codebase precedent (R344) supports the hardcoded default but doesn't forbid a config knob. |
| A4 | Timing-pad (fixed-budget delay on the no-match/rate-limited branches) is an adequate mitigation for the enumeration-via-timing risk, rather than the two-phase queue/trigger architecture | Security Domain | Medium — this is a security-critical judgment call; a plan-checker or security review may reasonably prefer the fully-decoupled two-phase design despite it not matching CONTEXT.md's literal single-callable phrasing. Flag explicitly for review. |

## Open Questions

1. **How does a volunteer reach `/{slug}/volunteer` from the login page's "Are you a volunteer?" link when
   the login page has no slug in context?**
   - What we know: R394's page requires a slug in the URL; the login page (`src/views/LoginView.vue`) is
     not org-scoped and has no slug available. R398's roadmap success criterion only requires reaching "the
     request" — it does not require the login page itself to know the church.
   - What's unclear: whether the intended UX is (a) a small "enter your church" intermediate step that
     resolves a typed slug/name via `orgSlugs`/`orgNames` before navigating, or (b) something simpler (e.g.
     the login page's link points at the existing generic `/volunteer` page, which itself gains a
     "find your church" input).
   - Recommendation: extend the existing generic `/volunteer` page (`VolunteerSignInView.vue`) — which
     already has an email-input pattern for the cross-device "remember this email" flow — with a short
     "Enter your church's page link or name" field that does a client-side `getDoc(orgSlugs/{normalizedInput})`
     lookup and `router.push({ name: 'volunteer-request', params: { slug } })` on success, or an inline
     "we couldn't find that church" message on miss. This reuses the SAME public-read rule already in place
     and needs no new server code. Flag this as a plan-time decision, not a blocker — R398's success
     criterion is satisfiable multiple ways.

2. **Exact rate-limit numbers for `VOLUNTEER_LINK_MAX_PER_MIN`/`_DAY`.**
   - What we know: the existing `checkAndConsumeRateLimit` mechanism and collection-naming convention.
   - What's unclear: CONTEXT.md does not specify numeric ceilings (unlike `MESSAGE_MAX_RECIPIENTS`'s
     documented 200, `ORG_MAX_EMAILS_PER_DAY`'s 1000).
   - Recommendation: start conservative — e.g. 1 request per email+org per minute, 5 per email+org per day
     — since a legitimate volunteer only ever needs one link per sign-in attempt and a forgotten-password-
     style "resend" cadence of a few per day comfortably covers real retries. These are cheap to raise later
     (a hardcoded constant, no data migration) and expensive to have set too loose on a public endpoint.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Auth emulator | Local mint-path testing (link minting works without Resend) | ✓ (existing project emulator config) | matches `firebase.json` | — |
| Resend API (live) | Actual email delivery | ✗ locally — Resend won't send from a local/emulator run (per 128-CONTEXT.md's own note); reaches only the owner inbox in prod until DNS verification (backlog 999.6) | test-mode | Mint-only verification via emulator logs/`mint-volunteer-link.cjs`-style script; treat real-send confirmation as manual/UAT-only (see Validation Architecture) |
| `RESEND_API_KEY` secret | The new public callable's send step | ✓ already provisioned (bound to `sendQueuedMessage`, `messageWebhook` in prod) | Google Secret Manager | — |

**Missing dependencies with no fallback:** None — this phase does not deploy to production (CONTEXT.md:
"Do NOT deploy to prod in this phase"), so the Resend test-mode limitation does not block build/test/verify.

**Missing dependencies with fallback:** Real-email delivery confirmation is manual-only this phase (see
Validation Architecture) — the emulator-mint path is sufficient for automated verification.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (app) | Vitest (root) — `npx vitest run` (excludes `src/rules.test.ts` and `render-service/**`, per `vite.config.ts`) |
| Framework (functions) | Vitest (independent package) — `cd functions && npm test` (== `vitest run`), `functions/package.json:9` |
| Config file | root `vite.config.ts` (app); `functions/vitest` uses package defaults (no separate config file observed) |
| Quick run command (functions) | `cd functions && npx vitest run src/index.test.ts` |
| Quick run command (app) | `npx vitest run src/router/__tests__/router.test.ts src/views/__tests__/LoginView.test.ts src/views/__tests__/VolunteerLinkCompleteView.test.ts` (adjust to actual new/edited test files) |
| Full suite command (functions) | `cd functions && npm test` |
| Full suite command (app) | `npx vitest run` |
| Type gate | `npm run type-check` (root, `vue-tsc --build` — checks test files too; do NOT substitute `-p tsconfig.app.json`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R394 | Valid slug → church name + form renders; unknown slug → "not found" state | unit (component) | `npx vitest run src/views/__tests__/VolunteerRequestView.test.ts` | ❌ Wave 0 |
| R394 | New route resolves `/:slug/volunteer` without shadowing static routes | unit (router) | `npx vitest run src/router/__tests__/router.test.ts` | ✅ (extend existing file) |
| R395 | Roster-hit and roster-miss produce byte-identical response body | unit (functions handler, ALLOW/DENY pair) | `cd functions && npx vitest run src/index.test.ts -t requestVolunteerLinkHandler` | ❌ Wave 0 |
| R395 | Timing-pad keeps hit/miss response latency within an assertable tolerance | unit (functions handler, fake timers or elapsed-ms assertion) | same file, same command | ❌ Wave 0 |
| R396 | Roster-hit mints + sends (Resend mock called); roster-miss does not (Resend mock NOT called) | unit (functions handler, mocked `resend.emails.send`) | same file, same command | ❌ Wave 0 |
| R396 | Cross-org isolation — an email on Org A's roster does not match when `orgId` = Org B | unit (functions handler, ALLOW/DENY) | same file, same command | ❌ Wave 0 |
| R397 | Under-limit request proceeds; at/over-limit request is denied silently (same response, no send) | unit (functions handler + `checkAndConsumeRateLimit` fake Firestore, mirroring `functions/src/index.test.ts:4156+`'s harness) | same file, same command | ❌ Wave 0 |
| R397 | Rate-limit key never cross-depletes `aiRateLimits`/`msgEnqueueRateLimits` (dedicated collection) | unit (functions handler, assert on the counter collection name used) | same file, same command | ❌ Wave 0 |
| R398 | Login page renders the "Are you a volunteer?" link/button and it navigates correctly | unit (component) | `npx vitest run src/views/__tests__/LoginView.test.ts` | ✅ (extend existing file, assumed present) |
| R399 | `/volunteer/verify` error state renders "request a new link" targeting `/{slug}/volunteer` when `route.query.slug` present | unit (component) | `npx vitest run src/views/__tests__/VolunteerLinkCompleteView.test.ts` | ✅/❌ — confirm file exists before planning; extend or create |
| R399 | Continue-URL slug round-trip: minted link's `url` contains `?slug=` before Firebase's own params | unit (functions, `volunteerLink.test.ts` or `index.test.ts`) | `cd functions && npx vitest run src/volunteerLink.test.ts` | ❌ Wave 0 |

**Manual-only behaviors (justify):**
- Real Resend send reaching a real inbox — Resend is test-mode in this environment/prod until DNS
  verification (backlog 999.6); automated tests must mock `resend.emails.send` and assert call arguments,
  not actual delivery.
- End-to-end click-through of a real emailed link on a real device — covered by the existing
  `mint-volunteer-link.cjs`-style manual mint/verify flow noted in CONTEXT.md's Specifics, or Firebase Auth
  emulator log inspection locally.
- Cross-device / cross-browser link-open UX (already partially covered by v2.12's existing
  `needsEmailReentry` tests; only the new `slug` query-param passthrough is new here).

### Sampling Rate

- **Per task commit:** the relevant scoped `vitest run <file>` command (functions and/or app, whichever
  was touched) + `npm run type-check`.
- **Per wave merge:** full `cd functions && npm test` AND full `npx vitest run` (app) — both suites, since
  this phase touches both.
- **Phase gate:** both full suites green, plus `npm run type-check`, before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `functions/src/volunteerLink.ts` + `functions/src/volunteerLink.test.ts` — shared mint/send core and
      its unit tests (mock `getAuth()` and `Resend`)
- [ ] `functions/src/index.test.ts` — new `describe("requestVolunteerLinkHandler", ...)` block with the
      ALLOW/DENY matrix (roster hit/miss × under/over rate limit × valid/invalid input × cross-org)
- [ ] `src/views/__tests__/VolunteerRequestView.test.ts` — new component test file
- [ ] Confirm whether `src/views/__tests__/LoginView.test.ts` and
      `src/views/__tests__/VolunteerLinkCompleteView.test.ts` already exist before planning (grep at plan
      time) — extend rather than create if present, matching this codebase's one-file-per-view convention.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth passwordless email-link (`signInWithEmailLink`) — already the v2.12 mechanism, unchanged; this phase only adds a new *request* path for the same credential type. |
| V3 Session Management | no (indirect) | Session establishment happens entirely in the existing, unchanged `completeSignIn` flow (`src/stores/volunteerAuth.ts`) — out of this phase's scope. |
| V4 Access Control | yes | Roster-gate (`organizations/{orgId}/people` membership) is the sole authorization check for whether a link is minted — enforced server-side in the callable, never delegable to a client-visible rule (there is no client read of `people` involved in this flow). |
| V5 Input Validation | yes | Shallow `orgId`/`email` presence + format checks before any Firestore/Resend work, mirroring the codebase's existing `isValidEmailFormat` convention and `queueServiceMessageHandler`'s upfront field guard. |
| V6 Cryptography | no | No new cryptographic primitive — link tokens (`oobCode`) are Firebase-Auth-internal and never touched by application code. |
| V11 Business Logic (rate limiting / abuse) | yes | `checkAndConsumeRateLimit`, dedicated collection, per email+orgId key — this IS the primary control this phase adds. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Roster-membership enumeration via response body/error code | Information Disclosure | Uniform response body for hit/miss/rate-limited (locked in CONTEXT.md, R395) |
| Roster-membership enumeration via response **timing** | Information Disclosure | Timing-pad the no-match/rate-limited branches to the typical hit-branch latency (this research's Pitfall 2 / Assumption A4) |
| Inbox-spam / cost fan-out via repeated requests for the same (or many) roster emails | Denial of Service (cost/abuse) | `checkAndConsumeRateLimit` keyed by `${orgId}::${emailLower}`, dedicated `volunteerLinkRateLimits` collection, conservative hardcoded ceilings |
| Cross-org roster leakage (an email on Org A's roster triggering a send when `orgId` = Org B) | Elevation of Privilege / Info Disclosure | Roster fetch is always scoped to `organizations/{orgId}/people` for the `orgId` supplied in THIS request — never a global/cross-org query. Must be an explicit ALLOW/DENY test case. |
| Forged/arbitrary `orgId` probing (an attacker calling the function directly, bypassing the UI's `orgSlugs`-validated `orgId`) | Tampering | Naturally enumeration-safe without extra code — a bogus `orgId`'s `people` fetch returns empty, producing the identical generic response; still worth an explicit test to prove this holds. |
| Secret-surface expansion on a public endpoint | Elevation of Privilege | `RESEND_API_KEY` is necessarily bound to this function (CONTEXT.md's single-callable design) — mitigate by binding it to NO other new function, and by the callable doing no other secret-touching work. |
| Resend rendered from `mint-volunteer-link.cjs`-style manual script diverging from the shipped core | Tampering (dev-only) | The shared `mintAndSendVolunteerLink` core is the ONLY path that should ever call `generateSignInWithEmailLink` + `resend.emails.send` together in application code; a manual dev script is fine as a standalone debugging aid but must never be imported by production code. |

**Recommended ALLOW/DENY test matrix** (mirrors Phase 125's `rehearseAccess` discipline):

| # | Case | Expected |
|---|------|----------|
| DENY-1 | Email not present in `organizations/{orgId}/people` | Generic success response; Resend NOT called; Admin SDK mint NOT called (or called but never sent — pick one and assert it) |
| DENY-2 | Email present in a DIFFERENT org's `people` (cross-org) | Generic success response; Resend NOT called for THIS org's context |
| DENY-3 | Email+orgId over rate limit (minute or day window) | Generic success response; Resend NOT called; roster lookup optionally skipped |
| DENY-4 | Missing `orgId` or `email` in request payload | `HttpsError('invalid-argument', ...)` — the one case allowed to differ, since it carries no membership information |
| DENY-5 | Malformed email (fails `isValidEmailFormat`-equivalent) | `HttpsError('invalid-argument', ...)` (same rationale as DENY-4) |
| ALLOW-1 | Email present in `organizations/{orgId}/people`, under rate limit | Generic success response; `generateSignInWithEmailLink` called with `email`; `resend.emails.send` called with the minted link |
| ALLOW-2 | Same email requesting for a SECOND org where it IS also on that org's roster | Independent success for each org (rate limiter and roster gate are both per-orgId) |
| TIMING-1 | Compare elapsed ms between an ALLOW-1 case and a DENY-1 case | Within an asserted tolerance band (proves the timing-pad mitigation) |

## Sources

### Primary (HIGH confidence)
- `functions/src/index.ts` — read directly, lines 1-2280+ (mint call, Resend send block, rate limiter,
  quota function, queueServiceMessageHandler authz pattern, roster-fetch pattern) [VERIFIED: codebase read]
- `functions/src/adminEmail.ts` — read in full (standalone-send shared-core template) [VERIFIED: codebase read]
- `functions/src/params.ts` — read in full (`bareEmailAddress`, `fromDisplayName`, `RESEND_API_KEY`,
  `SERVICE_SHARE_BASE_URL`) [VERIFIED: codebase read]
- `functions/src/appConfig.ts` — read in full (`AppConfig` shape, client-duplicate warning) [VERIFIED: codebase read]
- `firestore.rules` lines ~470-575 (`orgSlugs`, `orgNames`, `inviteLookup`, `shareTokens` rule patterns,
  ADR-0007 citation) [VERIFIED: codebase read]
- `src/stores/volunteerAuth.ts`, `src/views/VolunteerLinkCompleteView.vue`, `src/views/VolunteerSignInView.vue`,
  `src/views/LoginView.vue`, `src/router/index.ts` — all read in full [VERIFIED: codebase read]
- `src/utils/slug.ts` — read in full (`deriveSlug`, `RESERVED_SLUGS`, `claimSlug`) [VERIFIED: codebase read]
- `src/types/roster.ts` — `Person.email` field definition [VERIFIED: codebase read]
- `functions/src/index.test.ts` — `queueServiceMessageHandler`/`checkAndConsumeRateLimit` test harness shape
  [VERIFIED: codebase read]
- `functions/package.json`, `functions/src/index.ts` httpsCallable client call sites — dependency versions
  and invocation pattern [VERIFIED: codebase read]
- docs.google.com Firebase Auth email-link docs (fetched via WebFetch) — continue-URL query-string
  preservation, official `?cartId=1234` precedent for carrying custom state through the link
  [CITED: firebase.google.com/docs/auth/web/email-link-auth]
- `docs/adr/0007-org-slug-claims-public-read-org-editor-scoped-create-only.md` [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)
- None used beyond the WebFetch citation above — CONTEXT.md/ROADMAP.md explicitly declared "No
  project-research pass" for this milestone since all patterns exist in the codebase, and that held true.

### Tertiary (LOW confidence)
- WebSearch results on `generateSignInWithEmailLink` action-code expiration duration — conflicting
  community reports (1 hour vs 6 hours), no official documented/customizable value found. Flagged as
  Assumption A1; does not block planning since no code depends on the exact figure.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every version pulled directly from `functions/package.json`.
- Architecture: HIGH — the shared-core, rate-limiter, and roster-fetch patterns are all copy-adjacent to
  working, already-tested code in this exact repository.
- Pitfalls: HIGH for the re-export/casing/AppConfig-duplicate pitfalls (all directly evidenced in the
  codebase); MEDIUM for the timing-pad recommendation specifically (a sound, standard mitigation, but a
  judgment call CONTEXT.md doesn't dictate — flagged for plan-review).

**Research date:** 2026-09-06
**Valid until:** 30 days (stable internal patterns; no fast-moving external dependency)
